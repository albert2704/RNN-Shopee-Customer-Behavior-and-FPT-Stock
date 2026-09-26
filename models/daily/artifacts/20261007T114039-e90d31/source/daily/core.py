"""Validate daily closes and build causal train/validation/test windows."""

from datetime import datetime
from zoneinfo import ZoneInfo

import numpy as np
import pandas as pd

VIETNAM = ZoneInfo("Asia/Ho_Chi_Minh")
LOOKBACK = 30


def vietnam_now():
    return datetime.now(VIETNAM)


def clean_closes(raw, *, price_multiplier, now=None):
    """No filling missing sessions, no guessing units, no unfinished daily bar.

    Today is admitted only after 16:00 Vietnam time, a conservative retrieval
    cutoff, not an assertion about the provider's publication SLA.
    """
    now = now or vietnam_now()
    if now.tzinfo is None:
        raise ValueError("now must include a timezone")
    now = now.astimezone(VIETNAM)
    if not np.isfinite(price_multiplier) or price_multiplier <= 0:
        raise ValueError("Explicit positive price multiplier required")
    if not {"time", "close"}.issubset(raw.columns):
        raise ValueError("Provider must return time and close")
    times = pd.to_datetime(raw["time"], errors="raise")
    if times.isna().any():
        raise ValueError("Missing trading date")
    if times.dt.tz is not None:
        times = times.dt.tz_convert(VIETNAM).dt.tz_localize(None)
    dates = times.dt.normalize()
    values = pd.to_numeric(raw["close"], errors="raise").astype(float) * price_multiplier
    if not np.isfinite(values).all() or (values <= 0).any():
        raise ValueError("Close prices must be finite and positive")
    frame = pd.DataFrame({"date": dates, "close": values}).drop_duplicates()
    if frame.date.duplicated().any():
        raise ValueError("Conflicting prices for the same trading date")
    if (frame.date > pd.Timestamp(now.date())).any():
        raise ValueError("Provider returned future dates")
    if now.hour < 16:
        frame = frame[frame.date < pd.Timestamp(now.date())]
    frame = frame.sort_values("date").reset_index(drop=True)
    if len(frame) < LOOKBACK + 1:
        raise ValueError("Need at least 31 completed closing prices")
    return frame


def prepare_windows(frame):
    """Target close index k uses prices k-31..k-1 and predicts close k."""
    closes = frame.close.to_numpy(dtype=np.float64)
    returns = np.diff(np.log(closes))
    ids = np.arange(LOOKBACK, len(returns))
    if len(ids) < 600:
        raise ValueError("Training requires at least 631 daily closes")
    n_train, n_val = int(len(ids) * .70), int(len(ids) * .15)
    splits = {"train": ids[:n_train], "validation": ids[n_train:n_train+n_val], "test": ids[n_train+n_val:]}
    # Input scaler fits only observations actually used as training inputs.
    x_fit = returns[:splits["train"][-1]]
    y_fit = returns[splits["train"]]
    xm, xs = float(x_fit.mean()), float(x_fit.std()) or 1.0
    ym, ys = float(y_fit.mean()), float(y_fit.std()) or 1.0
    x_scaled = ((returns - xm) / xs).astype(np.float32)
    y_scaled = ((returns - ym) / ys).astype(np.float32)
    arrays, ranges = {}, {}
    for split, indices in splits.items():
        arrays["x_" + split] = np.stack([x_scaled[t-LOOKBACK:t, None] for t in indices])
        arrays["y_" + split] = y_scaled[indices, None]
        arrays["index_" + split] = indices + 1
        ranges[split] = {"count": len(indices), "first": str(frame.date.iloc[indices[0]+1].date()), "last": str(frame.date.iloc[indices[-1]+1].date())}
    meta = {"features": ["log_return"], "lookback": LOOKBACK, "normalization": {"x_mean": [xm], "x_scale": [xs], "y_mean": ym, "y_scale": ys}, "target_transform": "log(Close_t / Close_t-1)", "splits": ranges}
    return arrays, meta


def score(actual, predicted, previous):
    actual, predicted, previous = map(lambda x: np.asarray(x, dtype=np.float64), (actual, predicted, previous))
    if not (np.isfinite(actual).all() and np.isfinite(predicted).all()):
        raise ValueError("Nonfinite predictions")
    errors = predicted - actual
    direction = np.sign(actual - previous)
    predicted_direction = np.sign(predicted - previous)
    changed = direction != 0
    return {"MAE": float(np.abs(errors).mean()), "RMSE": float(np.sqrt(np.square(errors).mean())), "direction_accuracy": float((direction == predicted_direction).mean()), "changed_direction_accuracy": float((direction[changed] == predicted_direction[changed]).mean()) if changed.any() else None, "count": len(actual), "unchanged_count": int((~changed).sum())}


def forecast_input(frame, normalization):
    returns = np.diff(np.log(frame.close.to_numpy(dtype=np.float64)[-(LOOKBACK+1):]))
    return ((returns - normalization["x_mean"][0]) / normalization["x_scale"][0]).astype(np.float32).reshape(1, LOOKBACK, 1)
