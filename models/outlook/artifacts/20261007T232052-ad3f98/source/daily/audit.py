"""Recompute the saved run from raw closes and a NumPy RNN recurrence."""

import json
from pathlib import Path
import numpy as np
import pandas as pd
import torch
from . import pipeline


def audit():
    active = pipeline.read_json(pipeline.RUNTIME / "active.json")
    folder = pipeline.RUNTIME / "runs" / active["run_id"]
    manifest = pipeline.read_json(folder / "manifest.json")
    source = pipeline.read_json(folder / "dataset/source.json")
    assert manifest["source"] == source, "Manifest and archived source metadata differ"
    for name, key in [
        ("provider.csv", "provider_sha256"),
        ("closes.csv", "closes_sha256"),
    ]:
        assert pipeline.digest(folder / "dataset" / name) == source[key]
    for name, expected in manifest["source_files"].items():
        assert pipeline.digest(folder / "source" / name) == expected
    checkpoint = folder / manifest["training"]["checkpoint_file"]
    assert pipeline.digest(checkpoint) == manifest["training"]["checkpoint_sha256"]
    saved = torch.load(checkpoint, map_location="cpu", weights_only=True)
    state = {k: v.numpy() for k, v in saved["state_dict"].items()}
    closes = pd.read_csv(folder / "dataset/closes.csv")
    returns = np.log(closes.close.to_numpy()[1:] / closes.close.to_numpy()[:-1])
    norm = saved["normalization"]
    max_error = 0.0
    for split in ["validation", "test"]:
        predictions = pd.read_csv(folder / f"{split}_predictions.csv")
        indices = closes.date.tolist()
        ids = np.array([indices.index(date) for date in predictions.date])
        x = np.array([returns[k - 31 : k - 1] for k in ids])
        x = ((x - norm["x_mean"][0]) / norm["x_scale"][0]).astype(np.float32)
        h = np.zeros((len(x), saved["hidden_size"]), dtype=np.float32)
        for step in range(30):
            h = np.tanh(
                x[:, step, None] @ state["recurrent.weight_ih_l0"].T
                + state["recurrent.bias_ih_l0"]
                + h @ state["recurrent.weight_hh_l0"].T
                + state["recurrent.bias_hh_l0"]
            )
        scaled = (h @ state["output.weight"].T + state["output.bias"]).reshape(-1)
        transformed = scaled * norm["y_scale"] + norm["y_mean"]
        result = closes.close.to_numpy()[ids - 1] * np.exp(
            transformed.astype(np.float64)
        )
        np.testing.assert_allclose(result, predictions.rnn, rtol=0, atol=0.05)
        max_error = max(max_error, float(np.max(np.abs(result - predictions.rnn))))
        np.testing.assert_array_equal(closes.close.to_numpy()[ids], predictions.actual)
        for model in ["rnn", "persistence", "previous_return", "train_mean_return"]:
            error = predictions[model].to_numpy() - predictions.actual.to_numpy()
            expected = manifest["metrics"][split][model]
            assert abs(np.abs(error).mean() - expected["MAE"]) < 1e-6
            assert abs(np.sqrt(np.square(error).mean()) - expected["RMSE"]) < 1e-6
            accuracy = (
                np.sign(predictions[model] - predictions.previous)
                == np.sign(predictions.actual - predictions.previous)
            ).mean()
            assert abs(accuracy - expected["direction_accuracy"]) < 1e-10
    history = pd.read_csv(folder / manifest["training"]["history_file"])
    assert (
        int(history.loc[history.validation_loss.idxmin(), "epoch"])
        == saved["best_epoch"]
    )
    output = {
        "status": "passed",
        "run_id": active["run_id"],
        "raw_and_source_hashes": "passed",
        "manual_numpy_recurrence": "passed",
        "max_price_difference_vnd": max_error,
        "all_validation_and_test_metrics": "passed",
        "best_epoch": saved["best_epoch"],
    }
    pipeline.write_json(folder / "audit.json", output)
    artifact = Path(__file__).parent / "artifacts" / active["run_id"]
    if artifact.exists():
        pipeline.write_json(artifact / "audit.json", output)
    print(json.dumps(output, indent=2))


if __name__ == "__main__":
    audit()
