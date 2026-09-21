#!/usr/bin/env python3
"""Assignment 6: causal one-step RNN/GRU forecasting on two real time series.

Run from the assignment6 folder: python src/experiments.py
No random train/test split, fitted future statistics, or test-set tuning is used.
"""
from __future__ import annotations

import os
os.environ.setdefault("OMP_NUM_THREADS", "2")
os.environ.setdefault("MKL_NUM_THREADS", "2")
os.environ.setdefault("MPLCONFIGDIR", "/tmp/a6-matplotlib")

import argparse
import copy
import hashlib
import json
import platform
import random
import sys
import time
from pathlib import Path

import numpy as np
import pandas as pd
import torch
from torch import nn
from torch.utils.data import DataLoader, TensorDataset

ROOT = Path(__file__).resolve().parents[1]
CONFIG = dict(seed=42, hidden_size=32, num_layers=1, batch_size=64,
              learning_rate=0.001, max_epochs=40, patience=8,
              gradient_clip_norm=1.0, cpu_threads=2, dropout=0.0,
              split_fractions=[0.70, 0.15, 0.15], loss="MSE on standardized transformed target")


def save_json(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False, allow_nan=False), encoding="utf-8")


def sha256(path):
    digest = hashlib.sha256()
    with open(path, "rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def set_seed(seed=42):
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    torch.set_num_threads(CONFIG["cpu_threads"])
    torch.use_deterministic_algorithms(True)


def prepare_retailrocket():
    """Use aggregate behavior, not individual-customer churn or conversion labels."""
    source = ROOT / "data/raw/events.csv"
    events = pd.read_csv(source)
    raw_rows = len(events)
    duplicates = int(events.duplicated().sum())
    missing = {str(k): int(v) for k, v in events.isna().sum().items()}
    descending = int((events.timestamp.diff() < 0).sum())
    original_event_counts = {str(k): int(v) for k, v in events.event.value_counts().items()}
    # Remove only records identical in every source column; retain repeat actions otherwise.
    events = events.drop_duplicates().copy()
    assert not events.timestamp.isna().any()
    assert set(events.event.unique()) == {"view", "addtocart", "transaction"}
    events["time"] = pd.to_datetime(events.timestamp, unit="ms", utc=True)
    first, last = events.time.min(), events.time.max()
    start = first.normalize() + pd.Timedelta(days=1)
    stop = last.normalize()  # exclusive; partial final UTC day is omitted
    events = events[(events.time >= start) & (events.time < stop)]
    hours = pd.date_range(start, stop, freq="h", inclusive="left")
    observed = events.groupby([events.time.dt.floor("h"), "event"]).size().unstack(fill_value=0)
    frame = observed.reindex(hours, fill_value=0)[["view", "addtocart", "transaction"]].copy()
    frame.index.name = "timestamp"
    frame["target"] = frame.transaction.astype(float)
    for column in ["view", "addtocart", "transaction"]:
        frame["log_" + column] = np.log1p(frame[column].astype(float))
    for prefix, values, period in [("hour", frame.index.hour, 24), ("weekday", frame.index.dayofweek, 7)]:
        frame[prefix + "_sin"] = np.sin(2 * np.pi * values / period)
        frame[prefix + "_cos"] = np.cos(2 * np.pi * values / period)
    frame["model_target"] = frame.log_transaction
    features = ["log_view", "log_addtocart", "log_transaction", "hour_sin", "hour_cos", "weekday_sin", "weekday_cos"]
    audit = dict(
        source_file="data/raw/events.csv", source_sha256=sha256(source),
        source_url="https://www.kaggle.com/datasets/retailrocket/ecommerce-dataset",
        raw_rows=raw_rows, missing_by_column=missing,
        duplicate_rows=duplicates, duplicate_decision="Remove exact full-row duplicates only. Simultaneous genuine identical actions cannot be distinguished; this is an explicit cleaning assumption.",
        raw_event_counts=original_event_counts, raw_distinct_visitors=int(pd.read_csv(source, usecols=["visitorid"]).visitorid.nunique()),
        descending_adjacent_timestamp_pairs=descending,
        raw_first_timestamp=first.isoformat(), raw_last_timestamp=last.isoformat(),
        first_timestamp=frame.index[0].isoformat(), last_timestamp=frame.index[-1].isoformat(),
        clean_event_rows=len(events), excluded_boundary_event_rows=raw_rows - duplicates - len(events),
        series_rows=len(frame), interval="1 hour, UTC", source_was_sorted=descending == 0,
        empty_observation_hours=int((frame[["view", "addtocart", "transaction"]].sum(axis=1) == 0).sum()),
        zero_target_hours=int((frame.target == 0).sum()),
        event_counts_after_cleaning={k: int(frame[k].sum()) for k in ["view", "addtocart", "transaction"]},
        target_mean=float(frame.target.mean()), target_std=float(frame.target.std()),
        target_min=float(frame.target.min()), target_max=float(frame.target.max()),
        target_quantiles={str(k): float(v) for k, v in frame.target.quantile([0, .25, .5, .75, .95, 1]).items()},
        boundary_policy="Discard first and last partial UTC calendar days; aggregate retained events by hour and sort the hourly index.",
        zero_assumption="An hour/event type absent from the log is encoded as zero observed events. Logging outages cannot be separated from genuine inactivity; zero does not prove zero latent customer demand.",
        missing_decision="Missing transactionid on non-transaction events is structurally expected; transactionid is not an input. No numeric interpolation or future filling.",
        outlier_decision="Retain all observed counts; log1p reduces skew without clipping observed targets.",
        behavior_meaning="Aggregate view/add-to-cart/transaction activity over time; not individual-user classification. Transactions are event rows, not guaranteed unique orders or revenue.")
    return frame, features, 24, audit


def prepare_amazon():
    source = ROOT / "data/raw/AMZN.csv"
    raw = pd.read_csv(source)
    missing = {str(k): int(v) for k, v in raw.isna().sum().items()}
    raw_rows, duplicates = len(raw), int(raw.duplicated().sum())
    cleaned = raw.drop_duplicates().copy()
    cleaned["timestamp"] = pd.to_datetime(cleaned.Date, utc=True)
    cleaned = cleaned.sort_values("timestamp")
    assert not cleaned.timestamp.duplicated().any(), "Conflicting daily records require manual resolution"
    assert not cleaned[["timestamp", "Adj Close"]].isna().any().any()
    assert (cleaned["Adj Close"] > 0).all()
    frame = cleaned.set_index("timestamp")[["Open", "High", "Low", "Close", "Adj Close", "Volume"]].copy()
    frame["target"] = frame["Adj Close"]
    frame["log_return"] = np.log(frame.target / frame.target.shift(1))
    # The initial price has no observed previous-session return; omit that row only.
    frame = frame.iloc[1:].copy()
    frame["model_target"] = frame.log_return
    audit = dict(
        source_file="data/raw/AMZN.csv", source_sha256=sha256(source),
        source_url="https://www.kaggle.com/datasets/henryshan/amazon-com-inc-amzn",
        raw_rows=raw_rows, missing_by_column=missing, duplicate_rows=duplicates,
        duplicate_decision="Remove exact duplicate rows; reject conflicting dates.", clean_rows=len(cleaned),
        raw_first_timestamp=cleaned.timestamp.min().isoformat(), raw_last_timestamp=cleaned.timestamp.max().isoformat(),
        first_timestamp=frame.index[0].isoformat(), last_timestamp=frame.index[-1].isoformat(),
        series_rows=len(frame), interval="Next recorded trading session; weekends and exchange holidays are not interpolated",
        first_return_row_removed=1, target_mean=float(frame.target.mean()), target_std=float(frame.target.std()),
        target_min=float(frame.target.min()), target_max=float(frame.target.max()),
        target_quantiles={str(k): float(v) for k, v in frame.target.quantile([0, .25, .5, .75, .95, 1]).items()},
        log_return_mean=float(frame.log_return.mean()), log_return_std=float(frame.log_return.std()),
        missing_decision="No missing stock fields; no interpolation or resampling to non-trading dates.",
        outlier_decision="Retain all sessions and large returns; no target clipping or winsorization.",
        adjustment_caveat="Use source-provided retrospective Adj Close. Source adjustment factors may incorporate corporate actions that became known later; this is a historical educational benchmark, not a point-in-time trading backtest.",
        price_unit="USD per source-adjusted share")
    return frame, ["log_return"], 30, audit


def prepare_data(name):
    """Split by target time. A sample with target t uses only rows [t-L, t)."""
    frame, features, lookback, audit = prepare_retailrocket() if name == "retailrocket" else prepare_amazon()
    targets = np.arange(lookback, len(frame), dtype=np.int64)
    train_count, val_count = int(.70 * len(targets)), int(.15 * len(targets))
    indices = dict(train=targets[:train_count], validation=targets[train_count:train_count + val_count],
                   test=targets[train_count + val_count:])
    train_end = int(indices["train"][-1])
    feature_values = frame[features].to_numpy(dtype=np.float64)
    target_values = frame.model_target.to_numpy(dtype=np.float64)
    x_mean = feature_values[:train_end + 1].mean(axis=0)
    x_scale = feature_values[:train_end + 1].std(axis=0)
    x_scale[x_scale == 0] = 1.
    y_mean = float(target_values[indices["train"]].mean())
    y_scale = float(target_values[indices["train"]].std()) or 1.
    scaled_x = ((feature_values - x_mean) / x_scale).astype(np.float32)
    scaled_y = ((target_values - y_mean) / y_scale).astype(np.float32)
    arrays, splits = {}, {}
    for split, ids in indices.items():
        arrays["x_" + split] = np.stack([scaled_x[t - lookback:t] for t in ids])
        arrays["y_" + split] = scaled_y[ids, None]
        arrays["index_" + split] = ids
        splits[split] = dict(n=len(ids), first_timestamp=frame.index[ids[0]].isoformat(),
                             last_timestamp=frame.index[ids[-1]].isoformat(),
                             first_target_index=int(ids[0]), last_target_index=int(ids[-1]))
    folder = ROOT / "data/processed"
    folder.mkdir(parents=True, exist_ok=True)
    frame.to_csv(folder / f"{name}.csv", index=True)
    np.savez_compressed(folder / f"{name}_windows.npz", **arrays)
    meta = dict(name=name, audit=audit, features=features, lookback=lookback, splits=splits,
                normalization=dict(x_mean=x_mean.tolist(), x_scale=x_scale.tolist(), y_mean=y_mean, y_scale=y_scale,
                                   fit_first_timestamp=frame.index[0].isoformat(), fit_last_timestamp=frame.index[train_end].isoformat(),
                                   feature_fit_rows=train_end + 1, target_fit_rows=len(indices["train"]),
                                   x_method="Per-feature population mean/std fitted to training timestamps only, including available lookback context.",
                                   y_method="Population mean/std of transformed training targets only."),
                prediction_task="Next-hour observed transaction-event count" if name == "retailrocket" else "Next-trading-session adjusted closing price",
                target_transform="log1p(count)" if name == "retailrocket" else "log(AdjClose_t / AdjClose_t-1)",
                inverse_transform="max(0, expm1(predicted transformed target))" if name == "retailrocket" else "AdjClose_t-1 * exp(predicted log return)",
                target_unit="transaction events per hour" if name == "retailrocket" else "USD per source-adjusted share",
                evaluation_policy="Chronological 70/15/15 split of eligible target indices. One-step rolling forecasts use observed history, including earlier validation/test observations. Hidden state is reset for each independent window. This is not recursive or multi-step forecasting.",
                transform_caveat="MSE on log1p counts learns a transformed-space conditional mean; expm1 does not generally equal the arithmetic conditional mean of counts." if name == "retailrocket" else "MSE on log returns differs from dollar-price MSE; return errors are amplified when reconstructed at high price levels.",
                prepared_series_file=f"data/processed/{name}.csv",
                prepared_windows_file=f"data/processed/{name}_windows.npz")
    assert indices["train"][-1] < indices["validation"][0] <= indices["validation"][-1] < indices["test"][0]
    assert all((ids - lookback >= 0).all() for ids in indices.values())
    assert all(np.isfinite(array).all() for key, array in arrays.items() if key.startswith(("x_", "y_")))
    return frame, arrays, meta


class RecurrentForecaster(nn.Module):
    """Causal many-to-one RNN/GRU; x has shape (batch, lookback, features)."""
    def __init__(self, input_size, kind="rnn", hidden_size=32):
        super().__init__()
        cls = nn.RNN if kind == "rnn" else nn.GRU
        self.recurrent = cls(input_size, hidden_size, num_layers=1, batch_first=True,
                             bidirectional=False, dropout=0.0)
        self.output = nn.Linear(hidden_size, 1)

    def forward(self, x):
        sequence, hidden = self.recurrent(x)  # default h0 = zeros, reset each batch/window
        return self.output(sequence[:, -1, :])


@torch.no_grad()
def predict(model, x):
    model.eval()
    pieces = [model(torch.from_numpy(x[first:first + 256])).numpy().reshape(-1)
              for first in range(0, len(x), 256)]
    return np.concatenate(pieces)


def original_units(name, scaled_predictions, meta, previous):
    transformed = np.asarray(scaled_predictions, dtype=np.float64) * meta["normalization"]["y_scale"] + meta["normalization"]["y_mean"]
    if name == "retailrocket":
        return np.maximum(0., np.expm1(transformed))
    return previous * np.exp(transformed)


def metrics(actual, predicted):
    errors = np.asarray(predicted, dtype=np.float64) - np.asarray(actual, dtype=np.float64)
    assert np.isfinite(errors).all()
    return dict(MAE=float(np.abs(errors).mean()), RMSE=float(np.sqrt(np.square(errors).mean())))


def fit_model(name, kind, arrays, meta):
    set_seed(CONFIG["seed"])
    model = RecurrentForecaster(len(meta["features"]), kind, CONFIG["hidden_size"])
    optimizer = torch.optim.Adam(model.parameters(), lr=CONFIG["learning_rate"])
    loss_fn = nn.MSELoss()
    generator = torch.Generator().manual_seed(CONFIG["seed"])
    loader = DataLoader(TensorDataset(torch.from_numpy(arrays["x_train"]), torch.from_numpy(arrays["y_train"])),
                        batch_size=CONFIG["batch_size"], shuffle=True, generator=generator, num_workers=0)
    history, best_loss, best_state, best_epoch, stale = [], float("inf"), None, 0, 0
    start = time.perf_counter()
    for epoch in range(1, CONFIG["max_epochs"] + 1):
        model.train()
        total, seen = 0., 0
        for x, y in loader:
            optimizer.zero_grad(set_to_none=True)
            loss = loss_fn(model(x), y)
            loss.backward()
            nn.utils.clip_grad_norm_(model.parameters(), CONFIG["gradient_clip_norm"])
            optimizer.step()
            total += float(loss.detach()) * len(x)
            seen += len(x)
        val_pred = predict(model, arrays["x_validation"])
        val_mse = float(np.square(val_pred - arrays["y_validation"].reshape(-1)).mean())
        history.append(dict(epoch=epoch, train_loss=total / seen, validation_loss=val_mse))
        if val_mse < best_loss:
            best_loss, best_epoch, stale = val_mse, epoch, 0
            best_state = copy.deepcopy(model.state_dict())
        else:
            stale += 1
        print(f"{name}/{kind} epoch={epoch:02d} train={total/seen:.6f} val={val_mse:.6f}", flush=True)
        if stale >= CONFIG["patience"]:
            break
    assert best_state is not None
    model.load_state_dict(best_state)
    checkpoint = ROOT / "models" / f"{name}_{kind}.pt"
    checkpoint.parent.mkdir(parents=True, exist_ok=True)
    torch.save(dict(state_dict=best_state, kind=kind, input_size=len(meta["features"]), hidden_size=CONFIG["hidden_size"],
                    config=CONFIG, normalization=meta["normalization"], features=meta["features"], lookback=meta["lookback"],
                    best_epoch=best_epoch, best_validation_loss=best_loss, target_transform=meta["target_transform"]), checkpoint)
    # Check checkpoint fidelity on validation only before evaluating test.
    saved = torch.load(checkpoint, map_location="cpu", weights_only=True)
    restored = RecurrentForecaster(saved["input_size"], saved["kind"], saved["hidden_size"])
    restored.load_state_dict(saved["state_dict"])
    assert np.array_equal(predict(model, arrays["x_validation"][:32]), predict(restored, arrays["x_validation"][:32]))
    folder = ROOT / "results" / name
    folder.mkdir(parents=True, exist_ok=True)
    pd.DataFrame(history).to_csv(folder / f"{kind}_history.csv", index=False)
    result = dict(best_epoch=best_epoch, epochs_run=len(history), best_validation_loss=best_loss,
                  parameters=sum(p.numel() for p in model.parameters()), seconds=time.perf_counter() - start,
                  history_file=f"results/{name}/{kind}_history.csv", checkpoint_file=f"models/{name}_{kind}.pt",
                  checkpoint_sha256=sha256(checkpoint), selection="Minimum validation transformed-space MSE; test is not read during optimization/selection.")
    return restored, result


def evaluate(name, frame, arrays, meta):
    models = {}
    for kind in ["rnn", "gru"]:
        model, result = fit_model(name, kind, arrays, meta)
        rows, result["metrics"], result["transformed_MSE"] = [], {}, {}
        for split in ["validation", "test"]:
            ids = arrays["index_" + split]
            previous = frame.target.to_numpy()[ids - 1]
            actual = frame.target.to_numpy()[ids]
            # Exactly one test prediction pass after the validation-selected checkpoint is fixed.
            scaled_pred = predict(model, arrays["x_" + split])
            predicted = original_units(name, scaled_pred, meta, previous)
            result["metrics"][split] = metrics(actual, predicted)
            result["transformed_MSE"][split] = float(np.square(scaled_pred - arrays["y_" + split].reshape(-1)).mean())
            rows.append(pd.DataFrame(dict(split=split, timestamp=frame.index[ids], actual=actual, predicted=predicted,
                                          previous=previous, target_index=ids)))
        path = ROOT / "results" / name / f"{kind}_predictions.csv"
        pd.concat(rows, ignore_index=True).to_csv(path, index=False)
        result["predictions_file"] = str(path.relative_to(ROOT))
        models[kind] = result
    baseline_names = ["persistence", "seasonal"] if name == "retailrocket" else ["persistence", "train_mean"]
    for kind in baseline_names:
        rows, result = [], dict(metrics={})
        for split in ["validation", "test"]:
            ids = arrays["index_" + split]
            previous, actual = frame.target.to_numpy()[ids - 1], frame.target.to_numpy()[ids]
            if kind == "seasonal":
                assert (ids >= 168).all()
                predicted = frame.target.to_numpy()[ids - 168]
            elif kind == "train_mean":
                predicted = previous * np.exp(meta["normalization"]["y_mean"])
            else:
                predicted = previous.copy()
            result["metrics"][split] = metrics(actual, predicted)
            rows.append(pd.DataFrame(dict(split=split, timestamp=frame.index[ids], actual=actual, predicted=predicted,
                                          previous=previous, target_index=ids)))
        path = ROOT / "results" / name / f"{kind}_predictions.csv"
        pd.concat(rows, ignore_index=True).to_csv(path, index=False)
        result["predictions_file"] = str(path.relative_to(ROOT))
        result["definition"] = {"persistence": "Previous observed target value", "seasonal": "Observed transaction-event count at the same hour 168 hours earlier", "train_mean": "Previous adjusted close multiplied by exp(mean training log return)"}[kind]
        models[kind] = result
    return models


def plot_dataset(name, frame, meta):
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    plt.rcParams.update({"font.size": 10, "axes.spines.top": False, "axes.spines.right": False,
                         "savefig.dpi": 160, "axes.titleweight": "bold", "figure.facecolor": "white"})
    folder = ROOT / "figures"
    folder.mkdir(parents=True, exist_ok=True)
    colors = dict(rnn="#2864BA", gru="#CC5137", persistence="#747C86", seasonal="#739B43", train_mean="#739B43")
    def shade(ax):
        for split, color in [("validation", "#f2d7ac"), ("test", "#c9e4e7")]:
            s = meta["splits"][split]
            ax.axvspan(pd.Timestamp(s["first_timestamp"]), pd.Timestamp(s["last_timestamp"]), color=color, alpha=.6, label=split.title())
    fig, axes = plt.subplots(2, 1, figsize=(11, 7.3), layout="constrained")
    if name == "retailrocket":
        daily = frame[["view", "addtocart", "transaction"]].resample("D").sum()
        for col in daily:
            axes[0].plot(daily.index, daily[col], label=col, lw=1.3)
        axes[0].set(yscale="log", ylabel="Observed events per day (log scale)", title="Retailrocket: recorded customer actions over time")
        shade(axes[0]); axes[0].legend(ncol=5, fontsize=8)
        hourly = frame.groupby(frame.index.hour).transaction.mean()
        axes[1].bar(hourly.index, hourly.values, color="#2864BA")
        axes[1].set(xlabel="Hour of day (UTC)", ylabel="Mean transaction events / hour", title="Descriptive hourly profile across the full series (EDA only)", xticks=np.arange(0, 24, 2))
    else:
        axes[0].plot(frame.index, frame.target, color="#243A57", lw=1)
        shade(axes[0]); axes[0].legend()
        axes[0].set(ylabel="Adjusted close (USD)", title="Amazon: historical source-adjusted closing price")
        axes[1].plot(frame.index, frame.log_return * 100, color="#2864BA", lw=.5)
        axes[1].set(ylabel="Session log return (%)", xlabel="Trading date", title="Log returns retain jumps and changing volatility")
    fig.savefig(folder / f"{name}_eda.png"); plt.close(fig)
    fig, ax = plt.subplots(figsize=(10, 4.7), layout="constrained")
    for kind in ["rnn", "gru"]:
        history = pd.read_csv(ROOT / meta["models"][kind]["history_file"])
        ax.plot(history.epoch, history.train_loss, color=colors[kind], label=f"{kind.upper()} training")
        ax.plot(history.epoch, history.validation_loss, color=colors[kind], ls="--", label=f"{kind.upper()} validation")
        epoch = meta["models"][kind]["best_epoch"]
        ax.scatter([epoch], [history.loc[history.epoch == epoch, "validation_loss"].iloc[0]], color=colors[kind], s=55, zorder=5)
    ax.set(xlabel="Epoch", ylabel="MSE on standardized transformed target", title=f"{name.title()}: learning curves; dots mark selected checkpoints")
    ax.legend(ncol=2); fig.savefig(folder / f"{name}_loss.png"); plt.close(fig)
    predictions = {kind: pd.read_csv(ROOT / result["predictions_file"], parse_dates=["timestamp"]).query("split == 'test'") for kind, result in meta["models"].items()}
    primary = predictions["rnn"]
    fig, axes = plt.subplots(2, 1, figsize=(11, 7.6), layout="constrained")
    for ax, subset, title in [(axes[0], slice(None), "Entire held-out test period"),
                              (axes[1], slice(-168 if name == "retailrocket" else -90, None), "Final 7 days" if name == "retailrocket" else "Final 90 trading sessions")]:
        part = primary.iloc[subset]
        ax.plot(part.timestamp, part.actual, color="#142338", lw=1.8, label="Observed")
        for kind, pred in predictions.items():
            p = pred.iloc[subset]
            ax.plot(p.timestamp, p.predicted, label=kind.upper() if kind in ["rnn", "gru"] else kind.replace("_", " "), color=colors[kind], alpha=.85, lw=1)
        ax.set(title=title, ylabel=meta["target_unit"], xlabel="Target timestamp")
        ax.legend(ncol=len(predictions) + 1, fontsize=8)
    fig.suptitle(f"{name.title()}: one-step forecasts using observed history", weight="bold")
    fig.savefig(folder / f"{name}_predictions.png"); plt.close(fig)
    fig, axes = plt.subplots(1, 2, figsize=(11, 4.5), layout="constrained")
    for kind in ["rnn", "gru"]:
        p = predictions[kind]; residual = p.actual - p.predicted
        axes[0].plot(p.timestamp, residual, color=colors[kind], alpha=.7, lw=.8, label=kind.upper())
        axes[1].hist(residual, bins=35, alpha=.5, color=colors[kind], label=kind.upper())
    axes[0].axhline(0, color="black", lw=.8)
    axes[0].set(title="Test residuals: observed minus forecast", ylabel=meta["target_unit"], xlabel="Target timestamp")
    axes[0].tick_params(axis="x", rotation=25); axes[0].legend()
    axes[1].set(title="Residual distribution", xlabel=meta["target_unit"], ylabel="Test observations"); axes[1].legend()
    fig.savefig(folder / f"{name}_residuals.png"); plt.close(fig)
    fig, axes = plt.subplots(1, 2, figsize=(10, 4.7), layout="constrained")
    kinds = list(meta["models"])
    for ax, metric in zip(axes, ["MAE", "RMSE"]):
        vals = [meta["models"][k]["metrics"]["test"][metric] for k in kinds]
        bars = ax.bar([k.upper() if k in ["rnn", "gru"] else k.replace("_", " ") for k in kinds], vals, color=[colors[k] for k in kinds])
        ax.bar_label(bars, fmt="%.3f", padding=4, fontsize=9)
        ax.set(title=f"Test {metric} (lower is better)", ylabel=meta["target_unit"], ylim=(0, max(vals) * 1.18))
    fig.suptitle(f"{name.title()}: same target dates for all comparisons", weight="bold")
    fig.savefig(folder / f"{name}_metrics.png"); plt.close(fig)


def verify_saved_outputs(summary):
    """Meaningful checks: dates, causal windows, train statistics, checkpoints and CSV metrics."""
    checks = []
    for name, meta in summary["datasets"].items():
        frame = pd.read_csv(ROOT / meta["prepared_series_file"], index_col="timestamp", parse_dates=True)
        arrays = np.load(ROOT / meta["prepared_windows_file"])
        train_end = meta["splits"]["train"]["last_target_index"]
        raw_features = frame[meta["features"]].to_numpy()
        norm = meta["normalization"]
        np.testing.assert_allclose(raw_features[:train_end + 1].mean(axis=0), norm["x_mean"], atol=1e-10)
        np.testing.assert_allclose(raw_features[:train_end + 1].std(axis=0), norm["x_scale"], atol=1e-10)
        train_ids = arrays["index_train"]
        np.testing.assert_allclose(frame.model_target.iloc[train_ids].mean(), norm["y_mean"], atol=1e-10)
        np.testing.assert_allclose(frame.model_target.iloc[train_ids].std(ddof=0), norm["y_scale"], atol=1e-10)
        for split in ["train", "validation", "test"]:
            ids = arrays["index_" + split]
            assert np.all(np.diff(ids) == 1)
            for pos in [0, len(ids) // 2, len(ids) - 1]:
                t = ids[pos]
                expected = (raw_features[t - meta["lookback"]:t] - norm["x_mean"]) / norm["x_scale"]
                np.testing.assert_allclose(arrays["x_" + split][pos], expected, atol=1e-6)
                assert frame.index[t - 1] < frame.index[t]
        assert meta["splits"]["train"]["last_timestamp"] < meta["splits"]["validation"]["first_timestamp"]
        assert meta["splits"]["validation"]["last_timestamp"] < meta["splits"]["test"]["first_timestamp"]
        reference = None
        for kind, result in meta["models"].items():
            p = pd.read_csv(ROOT / result["predictions_file"])
            for split in ["validation", "test"]:
                part = p[p.split == split]
                ids = arrays["index_" + split]
                assert np.array_equal(part.target_index.to_numpy(), ids)
                np.testing.assert_allclose(part.actual, frame.target.iloc[ids], atol=1e-10)
                np.testing.assert_allclose(part.previous, frame.target.iloc[ids - 1], atol=1e-10)
                recomputed = metrics(part.actual, part.predicted)
                for key in ["MAE", "RMSE"]:
                    assert np.isclose(recomputed[key], result["metrics"][split][key], rtol=1e-10, atol=1e-10)
                if kind == "persistence":
                    np.testing.assert_array_equal(part.predicted, part.previous)
                if kind == "seasonal":
                    np.testing.assert_allclose(part.predicted, frame.target.iloc[ids - 168])
            columns = p[["split", "timestamp", "actual", "target_index"]]
            if reference is not None:
                pd.testing.assert_frame_equal(columns, reference)
            reference = columns
            if kind in ["rnn", "gru"]:
                history = pd.read_csv(ROOT / result["history_file"])
                assert int(history.loc[history.validation_loss.idxmin(), "epoch"]) == result["best_epoch"]
                assert sha256(ROOT / result["checkpoint_file"]) == result["checkpoint_sha256"]
        checks.append(dict(dataset=name, status="passed", checks=["disjoint chronological targets", "strictly historical input windows", "train-only scaler recomputation", "identical evaluation targets across models", "saved CSV actual/previous values", "baseline formulas", "MAE/RMSE recomputation", "validation-minimum checkpoint epoch", "checkpoint SHA256", "checkpoint reload prediction equivalence (checked during training)"]))
    result = dict(status="passed", checked_at_utc=pd.Timestamp.now(tz="UTC").isoformat(), datasets=checks)
    save_json(ROOT / "results/verification.json", result)
    return result


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dataset", choices=["all", "retailrocket", "amazon"], default="all")
    parser.add_argument("--verify-only", action="store_true")
    args = parser.parse_args()
    result_path = ROOT / "results/summary.json"
    if args.verify_only:
        print(json.dumps(verify_saved_outputs(json.loads(result_path.read_text())), indent=2)); return
    set_seed()
    (ROOT / "results").mkdir(parents=True, exist_ok=True)
    summary = dict(config=CONFIG, created_at_utc=pd.Timestamp.now(tz="UTC").isoformat(),
                   environment=dict(python=sys.version, executable=sys.executable, platform=platform.platform(),
                                    numpy=np.__version__, pandas=pd.__version__, torch=torch.__version__, device="cpu"),
                   source_file="src/experiments.py", source_sha256=sha256(__file__), datasets={})
    if result_path.exists() and args.dataset != "all":
        summary["datasets"] = json.loads(result_path.read_text()).get("datasets", {})
    for name in (["retailrocket", "amazon"] if args.dataset == "all" else [args.dataset]):
        frame, arrays, meta = prepare_data(name)
        meta["models"] = evaluate(name, frame, arrays, meta)
        summary["datasets"][name] = meta
        save_json(result_path, summary)
        save_json(ROOT / "results" / name / "manifest.json", meta)
        plot_dataset(name, frame, meta)
        print(json.dumps({name: {k: v["metrics"]["test"] for k, v in meta["models"].items()}}, indent=2), flush=True)
    summary["verification"] = verify_saved_outputs(summary)
    save_json(result_path, summary)
    provenance = ROOT / "results/provenance"
    provenance.mkdir(parents=True, exist_ok=True)
    (provenance / "executed_experiments.py").write_bytes(Path(__file__).read_bytes())
    print("All experiments and saved-output checks completed.", flush=True)


if __name__ == "__main__":
    main()
