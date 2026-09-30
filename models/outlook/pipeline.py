"""Train direct outlook models once; refresh only frozen inference.

From models/: python -m outlook.pipeline train --snapshot <validated snapshot folder>
"""

import argparse
import copy
import hashlib
import importlib.metadata
from pathlib import Path
import shutil
import uuid

import numpy as np
import pandas as pd
import torch

from daily import pipeline as daily
from daily.core import score, vietnam_now
from .core import (
    HORIZONS,
    LOOKBACK,
    MONTHS,
    forecast_input,
    prepare_windows,
    validate_frame,
)

MODELS = Path(__file__).resolve().parents[1]
RUNTIME = daily.RUNTIME / "outlook"
ARTIFACTS = MODELS / "outlook/artifacts"
BUNDLED_PUBLIC = MODELS.parent / "website/public/data/fpt-outlook.json"
PUBLIC = daily.PUBLIC_DIR / "fpt-outlook.json"
CONFIG = copy.deepcopy(daily.CONFIG)
SOURCE_FIELDS = (
    "symbol",
    "provider",
    "package",
    "package_version",
    "price_basis",
    "price_multiplier",
    "price_unit",
)


def validate_source(frame, source, trained=None):
    validate_frame(frame)
    if source.get("symbol") != "FPT" or source.get("price_unit") != "VND":
        raise ValueError("Outlook requires the FPT VND source")
    if source.get("rows") != len(frame):
        raise ValueError("Outlook source row count mismatch")
    for field, index in (("first_date", 0), ("last_date", -1)):
        if source.get(field) != str(frame.date.iloc[index].date()):
            raise ValueError("Outlook source date mismatch")
    canonical = frame[["date", "close"]].to_csv(index=False, date_format="%Y-%m-%d")
    if hashlib.sha256(canonical.encode()).hexdigest() != source.get("closes_sha256"):
        raise ValueError("Outlook input does not match source hash")
    if trained:
        if any(source.get(key) != trained.get(key) for key in SOURCE_FIELDS):
            raise ValueError("Outlook training and inference source mismatch")
        if source["last_date"] < trained["last_date"]:
            raise ValueError("Outlook input is older than training source")


def read_latest():
    """A complete atomic runtime bundle wins; public is the portable fallback."""
    path = RUNTIME / "latest.json"
    source = path if path.exists() else PUBLIC if PUBLIC.exists() else BUNDLED_PUBLIC
    value = daily.read_json(source)
    if value.get("schema_version") != 1 or value.get("symbol") != "FPT":
        raise ValueError("Invalid outlook snapshot")
    if [item["sessions"] for item in value["horizons"]] != list(HORIZONS):
        raise ValueError("Incomplete outlook snapshot")
    return value


def load_run(run_id=None):
    run_id = run_id or read_latest()["run_id"]
    if not run_id or Path(run_id).name != run_id:
        raise ValueError("Invalid outlook run id")
    folder = RUNTIME / "runs" / run_id
    if not folder.is_dir():
        folder = ARTIFACTS / run_id
    manifest = daily.read_json(folder / "manifest.json")
    if manifest["run_id"] != run_id:
        raise ValueError("Outlook manifest run mismatch")
    return folder, manifest


def load_model(folder, item, horizon):
    relative = Path(item["training"]["checkpoint_file"])
    if relative.is_absolute() or ".." in relative.parts:
        raise ValueError("Invalid outlook checkpoint path")
    checkpoint = folder / relative
    if daily.digest(checkpoint) != item["training"]["checkpoint_sha256"]:
        raise ValueError("Outlook checkpoint hash mismatch")
    saved = torch.load(checkpoint, map_location="cpu", weights_only=True)
    if (
        saved["kind"] != "rnn"
        or saved["lookback"] != LOOKBACK
        or saved["hidden_size"] != 32
        or saved["input_size"] != 1
        or saved["target_transform"] != f"log(Close[t+{horizon}] / Close[t])"
        or saved["normalization"] != item["meta"]["normalization"]
    ):
        raise ValueError("Outlook checkpoint contract mismatch")
    model = daily.RecurrentForecaster(1, "rnn", 32)
    model.load_state_dict(saved["state_dict"])
    model.eval()
    return model, saved


def evaluate(model, arrays, meta, frame, split, folder, horizon):
    origins, targets = arrays["origin_" + split], arrays["index_" + split]
    prices = frame.close.to_numpy(dtype=np.float64)
    anchor, actual = prices[origins], prices[targets]
    norm = meta["normalization"]
    predicted_log = (
        daily.predict(model, arrays["x_" + split]).astype(np.float64) * norm["y_scale"]
        + norm["y_mean"]
    )
    candidates = {
        "rnn": anchor * np.exp(predicted_log),
        "persistence": anchor.copy(),
        "train_mean_return": anchor * np.exp(norm["y_mean"]),
    }
    metrics = {name: score(actual, value, anchor) for name, value in candidates.items()}
    # Start at the first test origin by fixed policy, never choose an offset by results.
    subset = np.arange(0, len(origins), horizon)
    non_overlapping = {
        name: score(actual[subset], value[subset], anchor[subset])
        for name, value in candidates.items()
    }
    pd.DataFrame(
        {
            "origin_index": origins,
            "target_index": targets,
            "origin_date": frame.date.iloc[origins].dt.strftime("%Y-%m-%d").to_numpy(),
            "target_date": frame.date.iloc[targets].dt.strftime("%Y-%m-%d").to_numpy(),
            "anchor_close": anchor,
            "actual": actual,
            "actual_log_return": np.log(actual / anchor),
            "predicted_log_return": predicted_log,
            "non_overlapping": np.isin(np.arange(len(origins)), subset),
            **candidates,
        }
    ).to_csv(folder / f"{horizon}_{split}_predictions.csv", index=False)
    return {"all": metrics, "non_overlapping": non_overlapping}


def make_forecast(frame, source, *, run_id=None):
    folder, manifest = load_run(run_id)
    validate_source(frame, source, manifest["source"])
    anchor = float(frame.close.iloc[-1])
    horizons = []
    for horizon in HORIZONS:
        item = manifest["horizons"][str(horizon)]
        model, saved = load_model(folder, item, horizon)
        output = float(
            daily.predict(model, forecast_input(frame, saved["normalization"]))[0]
        )
        change = (
            output * saved["normalization"]["y_scale"]
            + saved["normalization"]["y_mean"]
        )
        predicted = float(anchor * np.exp(change))
        if not np.isfinite(predicted) or predicted <= 0:
            raise ValueError("Invalid outlook prediction")
        test = item["evaluation"]["test"]["all"]
        sparse = item["evaluation"]["test"]["non_overlapping"]
        count = sparse["rnn"]["count"]
        beats = test["rnn"]["MAE"] < test["persistence"]["MAE"]
        reason = (
            (
                "Sai lệch giá trên tập kiểm tra thấp hơn cách giữ nguyên giá. "
                if beats
                else "Sai lệch giá trên tập kiểm tra chưa tốt hơn cách giữ nguyên giá. "
            )
            + f"Chỉ có {count} giai đoạn kiểm tra không chồng lấn, chưa chứng minh hiệu quả đầu tư."
        )
        horizons.append(
            {
                "months": MONTHS[horizon],
                "sessions": horizon,
                "label": f"Khoảng {MONTHS[horizon]} tháng ({horizon} phiên)",
                "predicted_close": predicted,
                "predicted_return_pct": float(np.expm1(change) * 100),
                "direction": "up" if change > 0 else "down" if change < 0 else "flat",
                "target_date": None,
                "test": test,
                "non_overlapping": {
                    "count": count,
                    "rnn_mae": sparse["rnn"]["MAE"],
                    "persistence_mae": sparse["persistence"]["MAE"],
                    "direction_accuracy": sparse["rnn"]["direction_accuracy"],
                },
                "test_period": item["meta"]["splits"]["test"],
                "lookback": LOOKBACK,
                "hidden_size": saved["hidden_size"],
                "best_epoch": saved["best_epoch"],
                "epochs_run": item["training"]["epochs_run"],
                "support": {
                    "status": "experimental",
                    "beats_persistence": beats,
                    "non_overlapping_count": count,
                    "reason": reason,
                },
            }
        )
    return {
        "schema_version": 1,
        "symbol": "FPT",
        "run_id": manifest["run_id"],
        "observed_through": source["last_date"],
        "last_close": anchor,
        "generated_at": vietnam_now().isoformat(),
        "source": source,
        "horizons": horizons,
    }


def publish(result):
    # Each replacement contains all three models, one anchor and one source hash.
    daily.write_json(PUBLIC, result)
    daily.write_json(RUNTIME / "latest.json", result)


def refresh(frame, source):
    result = make_forecast(frame, source)
    publish(result)
    return result


def train(snapshot):
    frame, source = daily.load_snapshot(snapshot)
    validate_source(frame, source)
    run_id = vietnam_now().strftime("%Y%m%dT%H%M%S") + "-" + uuid.uuid4().hex[:6]
    folder = RUNTIME / "runs" / run_id
    folder.mkdir(parents=True)
    shutil.copytree(snapshot, folder / "dataset")
    daily.write_json(folder / "source.json", source)
    source_files = {}
    for package in ("src", "daily", "outlook"):
        for path in (MODELS / package).glob("*.py"):
            relative = path.relative_to(MODELS)
            target = folder / "source" / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(path, target)
            source_files[str(relative)] = daily.digest(path)
    config = copy.deepcopy(CONFIG)
    trained = {}
    # Fix every architecture/configuration and finish validation selection before any test evaluation.
    for horizon in HORIZONS:
        arrays, meta = prepare_windows(frame, horizon)
        model, training = daily.fit_model(
            f"fpt_outlook_{horizon}", "rnn", arrays, meta, root=folder, config=config
        )
        trained[horizon] = (model, arrays, meta, training)
    items = {}
    for horizon, (model, arrays, meta, training) in trained.items():
        evaluation = {
            split: evaluate(model, arrays, meta, frame, split, folder, horizon)
            for split in ("validation", "test")
        }
        items[str(horizon)] = {
            "meta": meta,
            "training": training,
            "evaluation": evaluation,
        }
    manifest = {
        "schema_version": 1,
        "run_id": run_id,
        "created_at": vietnam_now().isoformat(),
        "source": source,
        "source_files": source_files,
        "config": config,
        "horizons": items,
        "environment": {
            name: importlib.metadata.version(name)
            for name in ("torch", "numpy", "pandas")
        },
        "policy": "Fixed direct horizons/configuration, one seed. Minimum validation MSE selects each checkpoint before test. Nonoverlapping origins start at the first origin and advance h sessions. They are not necessarily independent. Unconfirmed source adjustment; forecasts are not total investment returns.",
    }
    daily.write_json(folder / "manifest.json", manifest)
    result = make_forecast(frame, source, run_id=run_id)
    daily.write_json(folder / "forecast.json", result)
    archive = ARTIFACTS / run_id
    shutil.copytree(
        folder, archive, ignore=shutil.ignore_patterns("dataset", "__pycache__")
    )
    publish(result)
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=["train"])
    parser.add_argument("--snapshot", required=True, type=Path)
    args = parser.parse_args()
    result = train(args.snapshot)
    print(f"Published outlook {result['run_id']} through {result['observed_through']}")
    for item in result["horizons"]:
        print(
            f"{item['sessions']} sessions: {item['predicted_return_pct']:.4f}%; nonoverlapping test count={item['non_overlapping']['count']}"
        )


if __name__ == "__main__":
    main()
