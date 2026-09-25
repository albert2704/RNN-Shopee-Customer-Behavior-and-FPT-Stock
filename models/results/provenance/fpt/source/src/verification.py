"""Kiểm chứng kết quả có sẵn; không chạy huấn luyện."""

import numpy as np
import pandas as pd
from evaluation import metrics
from io_utils import save_json, sha256


def verify_saved_outputs(summary, *, root, write_output=True):
    """Đối chiếu cửa sổ, scaler train, CSV và checkpoint đã lưu.

    write_output=False chạy kiểm tra mà không đổi JSON kiểm chứng lịch sử.
    Kiểm tra nạp lại checkpoint nêu trong kết quả được thực hiện lúc train;
    scripts/independent_audit.py kiểm tra lại suy luận bằng model độc lập.
    """
    checks = []
    for name, meta in summary["datasets"].items():
        frame = pd.read_csv(
            root / meta["prepared_series_file"], index_col="timestamp", parse_dates=True
        )
        arrays = np.load(root / meta["prepared_windows_file"])
        train_end = meta["splits"]["train"]["last_target_index"]
        raw_features = frame[meta["features"]].to_numpy()
        norm = meta["normalization"]
        np.testing.assert_allclose(
            raw_features[: train_end + 1].mean(axis=0), norm["x_mean"], atol=1e-10
        )
        np.testing.assert_allclose(
            raw_features[: train_end + 1].std(axis=0), norm["x_scale"], atol=1e-10
        )
        train_ids = arrays["index_train"]
        np.testing.assert_allclose(
            frame.model_target.iloc[train_ids].mean(), norm["y_mean"], atol=1e-10
        )
        np.testing.assert_allclose(
            frame.model_target.iloc[train_ids].std(ddof=0), norm["y_scale"], atol=1e-10
        )
        for split in ["train", "validation", "test"]:
            ids = arrays["index_" + split]
            assert np.all(np.diff(ids) == 1)
            for pos in [0, len(ids) // 2, len(ids) - 1]:
                t = ids[pos]
                expected = (
                    raw_features[t - meta["lookback"] : t] - norm["x_mean"]
                ) / norm["x_scale"]
                np.testing.assert_allclose(
                    arrays["x_" + split][pos], expected, atol=1e-6
                )
                assert frame.index[t - 1] < frame.index[t]
        assert (
            meta["splits"]["train"]["last_timestamp"]
            < meta["splits"]["validation"]["first_timestamp"]
        )
        assert (
            meta["splits"]["validation"]["last_timestamp"]
            < meta["splits"]["test"]["first_timestamp"]
        )
        reference = None
        for kind, result in meta["models"].items():
            p = pd.read_csv(root / result["predictions_file"])
            for split in ["validation", "test"]:
                part = p[p.split == split]
                ids = arrays["index_" + split]
                assert np.array_equal(part.target_index.to_numpy(), ids)
                np.testing.assert_allclose(
                    part.actual, frame.target.iloc[ids], atol=1e-10
                )
                np.testing.assert_allclose(
                    part.previous, frame.target.iloc[ids - 1], atol=1e-10
                )
                recomputed = metrics(part.actual, part.predicted)
                for key in ["MAE", "RMSE"]:
                    assert np.isclose(
                        recomputed[key],
                        result["metrics"][split][key],
                        rtol=1e-10,
                        atol=1e-10,
                    )
                if kind == "persistence":
                    np.testing.assert_array_equal(part.predicted, part.previous)
                if kind == "seasonal":
                    np.testing.assert_allclose(
                        part.predicted, frame.target.iloc[ids - 168]
                    )
            columns = p[["split", "timestamp", "actual", "target_index"]]
            if reference is not None:
                pd.testing.assert_frame_equal(columns, reference)
            reference = columns
            if kind in ["rnn", "gru"]:
                history = pd.read_csv(root / result["history_file"])
                assert (
                    int(history.loc[history.validation_loss.idxmin(), "epoch"])
                    == result["best_epoch"]
                )
                assert (
                    sha256(root / result["checkpoint_file"])
                    == result["checkpoint_sha256"]
                )
        checks.append(
            dict(
                dataset=name,
                status="passed",
                checks=[
                    "disjoint chronological targets",
                    "strictly historical input windows",
                    "train-only scaler recomputation",
                    "identical evaluation targets across models",
                    "saved CSV actual/previous values",
                    "baseline formulas",
                    "MAE/RMSE recomputation",
                    "validation-minimum checkpoint epoch",
                    "checkpoint SHA256",
                    "checkpoint reload prediction equivalence (checked during training)",
                ],
            )
        )
    result = dict(
        status="passed",
        checked_at_utc=pd.Timestamp.now(tz="UTC").isoformat(),
        datasets=checks,
    )
    if write_output:
        save_json(root / "results/verification.json", result)
    return result
