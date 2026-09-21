#!/usr/bin/env python3
"""Reproduce independent A6 checks without importing the experiment implementation.

Run from any directory: python /path/to/assignment6/scripts/independent_audit.py
Reads the saved data, checkpoints and predictions; writes only the audit JSON.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd
import torch
from torch import nn

ROOT = Path(__file__).resolve().parents[1]


class IndependentModel(nn.Module):
    """Checkpoint-compatible architecture defined independently of experiments.py."""

    def __init__(self, kind, inputs, hidden):
        super().__init__()
        recurrent = nn.RNN if kind == "rnn" else nn.GRU
        self.recurrent = recurrent(inputs, hidden, batch_first=True)
        self.output = nn.Linear(hidden, 1)

    def forward(self, x):
        return self.output(self.recurrent(x)[0][:, -1, :])


def audit_saved_dataset(name, meta, summary):
    frame = pd.read_csv(
        ROOT / meta["prepared_series_file"], index_col="timestamp", parse_dates=True
    )
    windows = np.load(ROOT / meta["prepared_windows_file"])
    norm = meta["normalization"]
    features = frame[meta["features"]].to_numpy()
    end = meta["splits"]["train"]["last_target_index"]
    lookback = meta["lookback"]
    assert frame.index.is_monotonic_increasing and not frame.index.has_duplicates

    train_targets = windows["index_train"]
    np.testing.assert_allclose(features[: end + 1].mean(0), norm["x_mean"], atol=1e-10)
    np.testing.assert_allclose(features[: end + 1].std(0), norm["x_scale"], atol=1e-10)
    np.testing.assert_allclose(
        frame.model_target.iloc[train_targets].mean(), norm["y_mean"], atol=1e-10
    )
    np.testing.assert_allclose(
        frame.model_target.iloc[train_targets].std(ddof=0), norm["y_scale"], atol=1e-10
    )

    seen = set()
    window_counts = {}
    for split in ["train", "validation", "test"]:
        ids = windows["index_" + split]
        assert not seen.intersection(ids)
        seen.update(ids)
        expected = np.stack(
            [
                (features[i - lookback : i] - norm["x_mean"]) / norm["x_scale"]
                for i in ids
            ]
        )
        np.testing.assert_allclose(
            windows["x_" + split], expected, rtol=1e-6, atol=1e-6
        )
        np.testing.assert_allclose(
            windows["y_" + split].ravel(),
            (frame.model_target.iloc[ids] - norm["y_mean"]) / norm["y_scale"],
            rtol=1e-6,
            atol=1e-6,
        )
        window_counts[split] = len(ids)

    reloaded_models = []
    for kind, result in meta["models"].items():
        predictions = pd.read_csv(ROOT / result["predictions_file"])
        assert predictions.isna().sum().sum() == 0
        for split in ["validation", "test"]:
            part = predictions[predictions.split == split]
            ids = windows["index_" + split]
            np.testing.assert_array_equal(part.target_index, ids)
            np.testing.assert_allclose(part.actual, frame.target.iloc[ids])
            np.testing.assert_allclose(part.previous, frame.target.iloc[ids - 1])
            assert (
                pd.to_datetime(part.timestamp, utc=True).to_numpy()
                == frame.index[ids].to_numpy()
            ).all()
            errors = part.predicted.to_numpy() - part.actual.to_numpy()
            assert np.isfinite(errors).all()
            np.testing.assert_allclose(
                [np.abs(errors).mean(), np.sqrt((errors**2).mean())],
                [result["metrics"][split]["MAE"], result["metrics"][split]["RMSE"]],
                rtol=1e-10,
            )
            if kind == "persistence":
                np.testing.assert_allclose(part.predicted, frame.target.iloc[ids - 1])
            elif kind == "seasonal":
                np.testing.assert_allclose(part.predicted, frame.target.iloc[ids - 168])
            elif kind == "train_mean":
                np.testing.assert_allclose(
                    part.predicted, frame.target.iloc[ids - 1] * np.exp(norm["y_mean"])
                )

        if kind in ["rnn", "gru"]:
            saved = torch.load(
                ROOT / result["checkpoint_file"], weights_only=True, map_location="cpu"
            )
            model = IndependentModel(
                kind, len(meta["features"]), summary["config"]["hidden_size"]
            )
            model.load_state_dict(saved["state_dict"])
            model.eval()
            x = windows["x_test"]
            with torch.no_grad():
                scaled = np.concatenate(
                    [
                        model(torch.from_numpy(x[i : i + 256])).numpy().ravel()
                        for i in range(0, len(x), 256)
                    ]
                )
            transformed = scaled.astype("float64") * norm["y_scale"] + norm["y_mean"]
            ids = windows["index_test"]
            if name == "retailrocket":
                original_units = np.maximum(0, np.expm1(transformed))
            else:
                original_units = frame.target.to_numpy()[ids - 1] * np.exp(transformed)
            np.testing.assert_allclose(
                original_units,
                predictions[predictions.split == "test"].predicted,
                rtol=1e-9,
                atol=1e-9,
            )
            reloaded_models.append(kind)

    windows.close()
    print(f"{name}: all windows, scalers, predictions, metrics and checkpoints PASS")
    return {
        "dataset": name,
        "status": "passed",
        "windows_checked": window_counts,
        "models_checked": list(meta["models"]),
        "independently_reloaded_models": reloaded_models,
        "test_predictions_per_reloaded_model": window_counts["test"],
        "checks": [
            "sorted unique processed timestamps",
            "training-only feature and target normalization",
            "disjoint target indices",
            "every saved input window uses exactly preceding rows",
            "every saved transformed target",
            "prediction target indices, timestamps, actual and previous values",
            "no missing predictions and finite errors",
            "all baseline formulas",
            "original-unit MAE and RMSE recomputation",
            "independently defined checkpoint model reproduces all test predictions",
        ],
    }


def audit_raw_transformations():
    raw_stock = pd.read_csv(ROOT / "data/raw/AMZN.csv")
    prepared_stock = pd.read_csv(ROOT / "data/processed/amazon.csv")
    np.testing.assert_allclose(prepared_stock.target, raw_stock["Adj Close"].iloc[1:])
    np.testing.assert_allclose(
        prepared_stock.log_return,
        np.diff(np.log(raw_stock["Adj Close"])),
        rtol=1e-8,
        atol=1e-12,
    )
    events = pd.read_csv(ROOT / "data/raw/events.csv").drop_duplicates()
    events["time"] = pd.to_datetime(events.timestamp, unit="ms", utc=True)
    # These are the retained calendar-day boundaries for the supplied source snapshot.
    events = events[
        (events.time >= pd.Timestamp("2015-05-04", tz="UTC"))
        & (events.time < pd.Timestamp("2015-09-18", tz="UTC"))
    ]
    actual = (
        events.groupby([events.time.dt.floor("h"), "event"])
        .size()
        .unstack(fill_value=0)
    )
    prepared = pd.read_csv(
        ROOT / "data/processed/retailrocket.csv",
        index_col="timestamp",
        parse_dates=True,
    )
    columns = ["view", "addtocart", "transaction"]
    np.testing.assert_array_equal(actual[columns], prepared[columns])
    np.testing.assert_array_equal(actual.index, prepared.index)
    print("Raw-to-processed transformations PASS")


def audit_source_provenance(summary):
    """Kiểm tra mã của lần chạy lịch sử, tách biệt với mã đang giảng giải.

    Tách module/thêm chú thích làm đổi hash hiện tại nhưng không đổi nguồn
    đã tạo checkpoint. Không được tuyên bố hai bản mã có cùng hash.
    """
    snapshot = ROOT / "results/provenance/executed_experiments.py"
    recorded_sha = summary["source_sha256"]
    snapshot_sha = hashlib.sha256(snapshot.read_bytes()).hexdigest()
    assert snapshot_sha == recorded_sha, "Historical source snapshot changed"
    current = ROOT / summary["source_file"]
    current_sha = hashlib.sha256(current.read_bytes()).hexdigest()
    # Những lần chạy sau khi tách module ghi thêm hash của toàn bộ src.
    for relative_path, expected_sha in summary.get("source_files", {}).items():
        archived = ROOT / "results/provenance/source" / relative_path
        assert hashlib.sha256(archived.read_bytes()).hexdigest() == expected_sha
    return {
        "historical_snapshot": str(snapshot.relative_to(ROOT)),
        "historical_snapshot_matches_recorded_hash": "passed",
        "recorded_source_sha256": recorded_sha,
        "current_source": str(current.relative_to(ROOT)),
        "current_source_sha256": current_sha,
        "current_source_matches_historical": current_sha == recorded_sha,
        "archived_module_hashes_checked": len(summary.get("source_files", {})),
        "scope": "Historical source hash is checked against its archived snapshot. Current refactored code is distinct; numerical parity is checked separately.",
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--no-write",
        action="store_true",
        help="Chỉ kiểm tra; không thay JSON kiểm chứng lịch sử.",
    )
    parser.add_argument("--output", type=Path, help="Ghi báo cáo vào tệp khác.")
    parser.add_argument(
        "--skip-raw",
        action="store_true",
        help="Kiểm tra dữ liệu xử lý và checkpoint; bỏ phần cần CSV gốc chưa tải.",
    )
    args = parser.parse_args()
    if args.no_write and args.output:
        parser.error("Chọn --no-write hoặc --output, không dùng đồng thời")
    summary = json.loads((ROOT / "results/summary.json").read_text(encoding="utf-8"))
    torch.set_num_threads(2)
    datasets = [
        audit_saved_dataset(name, meta, summary)
        for name, meta in summary["datasets"].items()
    ]
    if args.skip_raw:
        print("Raw-to-processed checks SKIPPED (--skip-raw); saved windows and checkpoints checked.")
    else:
        audit_raw_transformations()
    provenance = audit_source_provenance(summary)
    print("Historical executed-source snapshot SHA matches recorded run PASS")
    print(
        "Current source matches historical:",
        provenance["current_source_matches_historical"],
    )
    result = {
        "status": "passed",
        "checked_at_utc": datetime.now(timezone.utc).isoformat(),
        "audit_script": "scripts/independent_audit.py",
        "audit_script_sha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        "independence": "Does not import experiments.py; separately defines model and recomputes data transformations and metrics.",
        "datasets": datasets,
        "raw_to_processed_transformations": "skipped (--skip-raw)" if args.skip_raw else "passed",
        "source_provenance": provenance,
        "prediction_tolerance": {"rtol": 1e-9, "atol": 1e-9},
        "portability_note": "Paths are script-relative. Exact checkpoint comparisons may vary across hardware or library versions.",
    }
    if args.no_write:
        print("PASS; no saved artifacts were changed (--no-write).")
        return
    output = args.output or ROOT / "results/independent_audit.json"
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(
        json.dumps(result, indent=2, ensure_ascii=False, allow_nan=False) + "\n",
        encoding="utf-8",
    )
    print(f"Saved {output}")


if __name__ == "__main__":
    main()
