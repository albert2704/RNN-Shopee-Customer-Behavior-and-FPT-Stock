"""Isolated training, immutable evidence and daily inference for FPT.

Run from models/: python -m daily.pipeline train / refresh / export.
No HTTP request trains a model. Daily forecasts reuse the saved scaler.
"""

import argparse
import hashlib
import importlib.metadata
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import uuid

import numpy as np
import pandas as pd
import torch

from .core import clean_closes, forecast_input, prepare_windows, score, vietnam_now

MODELS = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(MODELS / "src"))
from config import CONFIG
from evaluation import predict
from models import RecurrentForecaster
from training import fit_model

RUNTIME = Path(os.environ.get("FPT_DAILY_HOME", MODELS / "daily/runtime"))
PUBLIC = MODELS.parent / "website/public/data/fpt-daily.json"


def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def read_json(path):
    return json.loads(Path(path).read_text())


def write_json(path, value):
    """Atomic replacement so refresh failures cannot truncate the last result."""
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(mode="w", dir=path.parent, delete=False, encoding="utf-8") as handle:
        json.dump(value, handle, ensure_ascii=False, indent=2, allow_nan=False)
        temporary = handle.name
    os.replace(temporary, path)


def load_snapshot(folder):
    folder = Path(folder)
    metadata = read_json(folder / "source.json")
    if digest(folder / "closes.csv") != metadata["closes_sha256"]:
        raise ValueError("Dataset hash mismatch")
    raw = pd.read_csv(folder / "closes.csv").rename(columns={"date": "time"})
    frame = clean_closes(raw, price_multiplier=1)
    if frame.date.iloc[-1].strftime("%Y-%m-%d") != metadata["last_date"]:
        raise ValueError("Snapshot includes a session that is not complete yet")
    return frame, metadata


def fetch_snapshot():
    """Provider runs separately so network hangs have a hard timeout."""
    RUNTIME.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(dir=RUNTIME) as temp:
        output = Path(temp) / "snapshot"
        result = subprocess.run([sys.executable, "-m", "daily.provider", "--output", str(output)], cwd=MODELS, capture_output=True, text=True, timeout=90)
        if result.returncode:
            raise RuntimeError("Không lấy được dữ liệu FPT từ nguồn. Thử lại sau hoặc chạy lệnh fetch để xem chẩn đoán.")
        frame, source = load_snapshot(output)
        identifier = source["closes_sha256"][:16]
        target = RUNTIME / "snapshots" / identifier
        target.parent.mkdir(parents=True, exist_ok=True)
        if not target.exists():
            shutil.copytree(output, target)
        return frame, source, target


def train(snapshot=None):
    if snapshot:
        snapshot = Path(snapshot)
        frame, source = load_snapshot(snapshot)
    else:
        frame, source, snapshot = fetch_snapshot()
    arrays, meta = prepare_windows(frame)
    run_id = vietnam_now().strftime("%Y%m%dT%H%M%S") + "-" + uuid.uuid4().hex[:6]
    folder = RUNTIME / "runs" / run_id
    folder.mkdir(parents=True)
    shutil.copytree(snapshot, folder / "dataset")
    source_files = {}
    for base in [MODELS / "src", MODELS / "daily"]:
        for path in base.glob("*.py"):
            relative = path.relative_to(MODELS)
            destination = folder / "source" / relative
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(path, destination)
            source_files[str(relative)] = digest(path)
    model, training = fit_model("fpt_daily", "rnn", arrays, meta, root=folder, config=dict(CONFIG))
    all_metrics = {}
    for split in ["validation", "test"]:
        ids = arrays["index_" + split]
        previous, actual = frame.close.to_numpy()[ids-1], frame.close.to_numpy()[ids]
        log_returns = predict(model, arrays["x_" + split]) * meta["normalization"]["y_scale"] + meta["normalization"]["y_mean"]
        predicted = previous * np.exp(log_returns.astype(np.float64))
        prior_return = np.log(previous / frame.close.to_numpy()[ids-2])
        mean_return = meta["normalization"]["y_mean"]
        candidates = {"rnn": predicted, "persistence": previous, "previous_return": previous * np.exp(prior_return), "train_mean_return": previous * np.exp(mean_return)}
        all_metrics[split] = {name: score(actual, values, previous) for name, values in candidates.items()}
        pd.DataFrame({"date": frame.date.iloc[ids].dt.strftime("%Y-%m-%d").to_numpy(), "previous": previous, "actual": actual, **candidates}).to_csv(folder / f"{split}_predictions.csv", index=False)
    manifest = {"schema_version": 1, "run_id": run_id, "created_at": vietnam_now().isoformat(), "source": source, "source_files": source_files, "meta": meta, "config": CONFIG, "training": training, "metrics": all_metrics, "environment": {name: importlib.metadata.version(name) for name in ["torch", "numpy", "pandas"]}, "policy": "Frozen weights selected on validation. Test has no tuning. One seed, one chronological split; experimental regardless of baseline comparison."}
    write_json(folder / "manifest.json", manifest)
    # Activate only after training, saved checkpoint validation and test export succeed.
    write_json(RUNTIME / "active.json", {"run_id": run_id})
    result = make_forecast(frame, source)
    write_json(RUNTIME / "latest.json", result)
    write_json(PUBLIC, result)
    print(json.dumps({"run_id": run_id, "source_last_date": source["last_date"], "test": all_metrics["test"], "forecast": result["forecast"]}, ensure_ascii=False, indent=2))
    return result


def load_active():
    run_id = read_json(RUNTIME / "active.json")["run_id"]
    if not run_id or Path(run_id).name != run_id:
        raise ValueError("Invalid active run")
    folder = RUNTIME / "runs" / run_id
    manifest = read_json(folder / "manifest.json")
    checkpoint = folder / manifest["training"]["checkpoint_file"]
    if digest(checkpoint) != manifest["training"]["checkpoint_sha256"]:
        raise ValueError("Model checkpoint hash mismatch")
    saved = torch.load(checkpoint, map_location="cpu", weights_only=True)
    model = RecurrentForecaster(saved["input_size"], saved["kind"], saved["hidden_size"])
    model.load_state_dict(saved["state_dict"])
    model.eval()
    return model, saved, manifest


def resolve_ledger(entries, frame):
    """Never score an already past target as a prospectively issued forecast."""
    for entry in entries:
        if entry.get("actual") is not None:
            continue
        later = frame[frame.date > pd.Timestamp(entry["observed_through"])]
        if later.empty:
            continue
        first = later.iloc[0]
        issued = pd.Timestamp(entry["created_at"]).tz_convert("Asia/Ho_Chi_Minh")
        actual_date = first.date.date()
        # Issuance must precede the closing auction, not the 16:00 fetch cutoff.
        prospective = actual_date > issued.date() or (actual_date == issued.date() and (issued.hour, issued.minute) < (14, 30))
        anchor = frame[frame.date == pd.Timestamp(entry["observed_through"])]
        comparable = not anchor.empty and np.isclose(float(anchor.close.iloc[0]), entry["last_close"], rtol=1e-8, atol=.01)
        entry.update(actual=float(first.close), actual_date=str(actual_date), absolute_error=abs(float(first.close)-entry["predicted_close"]) if comparable else None, prospective=prospective, comparable=bool(comparable))
    return entries


def make_forecast(frame, source):
    model, saved, manifest = load_active()
    trained_source = manifest["source"]
    for field in ["provider", "package_version", "price_basis", "price_multiplier"]:
        if source[field] != trained_source[field]:
            raise ValueError(f"Training and refresh source mismatch: {field}")
    if source["last_date"] < trained_source["last_date"]:
        raise ValueError("Provider returned an older data cutoff than the active model")
    x = forecast_input(frame, saved["normalization"])
    output = float(predict(model, x)[0])
    predicted_return = output * saved["normalization"]["y_scale"] + saved["normalization"]["y_mean"]
    previous = float(frame.close.iloc[-1])
    predicted = float(previous * np.exp(predicted_return))
    if not np.isfinite(predicted) or predicted <= 0:
        raise ValueError("Invalid forecast")
    cutoff = str(frame.date.iloc[-1].date())
    timestamp = vietnam_now().isoformat()
    window_hash = hashlib.sha256(frame.tail(31).to_csv(index=False).encode()).hexdigest()
    identifier = hashlib.sha256((manifest["run_id"] + window_hash).encode()).hexdigest()[:20]
    record = {"id": identifier, "created_at": timestamp, "model_id": manifest["run_id"], "observed_through": cutoff, "last_close": previous, "predicted_close": predicted, "predicted_return_pct": float(np.expm1(predicted_return)*100), "direction": "up" if predicted_return > 0 else "down" if predicted_return < 0 else "flat", "actual": None, "input_sha256": window_hash}
    ledger_file = RUNTIME / "ledger.json"
    ledger = resolve_ledger(read_json(ledger_file) if ledger_file.exists() else [], frame)
    existing = next((item for item in ledger if item["id"] == identifier), None)
    if existing:
        record = existing
    else:
        ledger.append(record)
    write_json(ledger_file, ledger)
    test = manifest["metrics"]["test"]
    result = {"schema_version": 1, "symbol": "FPT", "generated_at": timestamp, "source": source, "forecast": record, "model": {"run_id": manifest["run_id"], "trained_at": manifest["created_at"], "hidden_size": saved["hidden_size"], "lookback": saved["lookback"], "epochs_run": manifest["training"]["epochs_run"], "best_epoch": saved["best_epoch"], "splits": manifest["meta"]["splits"], "test": test, "beats_persistence_mae": test["rnn"]["MAE"] < test["persistence"]["MAE"], "checkpoint_sha256": manifest["training"]["checkpoint_sha256"]}, "history": [{"date": str(row.date.date()), "close": float(row.close)} for row in frame.tail(60).itertuples()], "ledger": ledger[-20:], "delivery": "saved_snapshot", "target": "Next recorded trading session after observed_through; not a calendar date or a trading recommendation."}
    return with_freshness(result)


def with_freshness(result):
    result = dict(result)
    now = vietnam_now()
    age = (now.date() - pd.Timestamp(result["forecast"]["observed_through"]).date()).days
    result["freshness"] = {"checked_at": now.isoformat(), "calendar_days": age, "stale": age >= 7, "threshold_days": 7}
    return result


def refresh():
    frame, source, _ = fetch_snapshot()
    result = make_forecast(frame, source)
    write_json(RUNTIME / "latest.json", result)
    write_json(PUBLIC, result)
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=["fetch", "train", "refresh", "export"])
    parser.add_argument("--snapshot", type=Path, help="Validated snapshot folder for reproducible training")
    args = parser.parse_args()
    if args.command == "fetch":
        _, source, path = fetch_snapshot()
        print(json.dumps({"snapshot": str(path), "source": source}, ensure_ascii=False, indent=2))
    elif args.command == "train":
        train(args.snapshot)
    elif args.command == "refresh":
        print(json.dumps(refresh()["forecast"], ensure_ascii=False, indent=2))
    else:
        write_json(PUBLIC, with_freshness(read_json(RUNTIME / "latest.json")))
        print(PUBLIC)


if __name__ == "__main__":
    main()
