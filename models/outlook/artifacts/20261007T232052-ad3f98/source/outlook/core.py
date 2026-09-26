"""Causal direct horizon targets with purged chronological origin regions."""

import numpy as np
import pandas as pd

LOOKBACK = 60
HORIZONS = (21, 63, 126)
MONTHS = {21: 1, 63: 3, 126: 6}


def validate_frame(frame):
    if not {"date", "close"}.issubset(frame.columns) or len(frame) < LOOKBACK + 1:
        raise ValueError("Outlook requires at least 61 completed closes")
    dates = pd.to_datetime(frame.date, errors="raise")
    prices = frame.close.to_numpy(dtype=np.float64)
    if dates.isna().any() or dates.duplicated().any() or not dates.is_monotonic_increasing:
        raise ValueError("Outlook dates must be unique and increasing")
    if not np.isfinite(prices).all() or (prices <= 0).any():
        raise ValueError("Outlook closes must be finite and positive")
    return prices


def prepare_windows(frame, horizon):
    """Origin t sees P[t], uses returns t-59..t, predicts log(P[t+h]/P[t])."""
    if horizon not in HORIZONS:
        raise ValueError("Unsupported outlook horizon")
    prices = validate_frame(frame)
    origins = np.arange(LOOKBACK, len(prices))
    validation_start = LOOKBACK + int(len(origins) * 0.70)
    test_start = validation_start + int(len(origins) * 0.15)
    splits = {
        "train": origins[origins + horizon < validation_start],
        "validation": origins[
            (origins >= validation_start) & (origins + horizon < test_start)
        ],
        "test": origins[(origins >= test_start) & (origins + horizon < len(prices))],
    }
    if any(len(ids) < 2 for ids in splits.values()):
        raise ValueError("Not enough closes for all purged outlook splits")
    returns = np.diff(np.log(prices))
    # The union of training inputs is contiguous; do not count overlapping windows twice.
    x_fit = returns[: splits["train"][-1]]
    train_ids = splits["train"]
    y_fit = np.log(prices[train_ids + horizon] / prices[train_ids])
    xm, xs = float(x_fit.mean()), float(x_fit.std()) or 1.0
    ym, ys = float(y_fit.mean()), float(y_fit.std()) or 1.0
    scaled = ((returns - xm) / xs).astype(np.float32)
    arrays, ranges = {}, {}
    for split, ids in splits.items():
        targets = ids + horizon
        arrays["x_" + split] = np.stack(
            [scaled[t - LOOKBACK : t, None] for t in ids]
        )
        arrays["y_" + split] = (
            (np.log(prices[targets] / prices[ids]) - ym) / ys
        ).astype(np.float32)[:, None]
        arrays["origin_" + split] = ids
        arrays["index_" + split] = targets
        ranges[split] = {
            "count": len(ids),
            "first_origin": str(frame.date.iloc[ids[0]].date()),
            "last_origin": str(frame.date.iloc[ids[-1]].date()),
            "first_target": str(frame.date.iloc[targets[0]].date()),
            "last_target": str(frame.date.iloc[targets[-1]].date()),
        }
    meta = {
        "features": ["log_return"],
        "lookback": LOOKBACK,
        "horizon_sessions": horizon,
        "normalization": {"x_mean": [xm], "x_scale": [xs], "y_mean": ym, "y_scale": ys},
        "target_transform": f"log(Close[t+{horizon}] / Close[t])",
        "splits": ranges,
        "origin_cutoffs": {
            "validation_index": validation_start,
            "test_index": test_start,
            "purged_origins_per_boundary": horizon,
            "rule": "train target < first validation origin; validation target < first test origin",
        },
    }
    return arrays, meta


def forecast_input(frame, normalization):
    prices = validate_frame(frame)
    values = np.diff(np.log(prices[-(LOOKBACK + 1) :]))
    return (
        ((values - normalization["x_mean"][0]) / normalization["x_scale"][0])
        .astype(np.float32)
        .reshape(1, LOOKBACK, 1)
    )
