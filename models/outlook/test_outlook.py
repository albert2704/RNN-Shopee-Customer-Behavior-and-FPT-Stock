"""Offline causal checks and independent reconstruction of bundled RNN predictions."""

import hashlib
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

import numpy as np
import pandas as pd
import torch

from . import pipeline
from .core import HORIZONS, LOOKBACK, forecast_input, prepare_windows


def synthetic_frame():
    returns = 0.001 + 0.01 * np.sin(np.arange(1935) / 11)
    return pd.DataFrame(
        {
            "date": pd.bdate_range("2018-01-01", periods=1936),
            "close": 10000 * np.exp(np.r_[0, np.cumsum(returns)]),
        }
    )


def source_for(frame):
    return {
        "symbol": "FPT",
        "price_unit": "VND",
        "rows": len(frame),
        "first_date": str(frame.date.iloc[0].date()),
        "last_date": str(frame.date.iloc[-1].date()),
        "closes_sha256": hashlib.sha256(
            frame.to_csv(index=False, date_format="%Y-%m-%d").encode()
        ).hexdigest(),
    }


class WindowTests(unittest.TestCase):
    def setUp(self):
        self.frame = synthetic_frame()

    def test_strict_purged_boundaries_and_counts(self):
        expected = {21: (1292, 260, 261), 63: (1250, 218, 219), 126: (1187, 155, 156)}
        for h in HORIZONS:
            arrays, meta = prepare_windows(self.frame, h)
            self.assertEqual(
                tuple(
                    len(arrays["origin_" + name])
                    for name in ("train", "validation", "test")
                ),
                expected[h],
            )
            self.assertLess(arrays["index_train"][-1], arrays["origin_validation"][0])
            self.assertLess(arrays["index_validation"][-1], arrays["origin_test"][0])
            self.assertEqual(meta["origin_cutoffs"]["purged_origins_per_boundary"], h)
            self.assertTrue(np.all(arrays["index_test"] - arrays["origin_test"] == h))

    def test_direct_target_and_input_end_at_origin(self):
        prices = self.frame.close.to_numpy()
        returns = np.diff(np.log(prices))
        for h in HORIZONS:
            arrays, meta = prepare_windows(self.frame, h)
            norm = meta["normalization"]
            for split in ("train", "validation", "test"):
                for k in (0, len(arrays["origin_" + split]) - 1):
                    t = arrays["origin_" + split][k]
                    target = (
                        arrays["y_" + split][k, 0] * norm["y_scale"] + norm["y_mean"]
                    )
                    self.assertAlmostEqual(
                        float(target), np.log(prices[t + h] / prices[t]), places=6
                    )
                    inputs = (
                        arrays["x_" + split][k, :, 0] * norm["x_scale"][0]
                        + norm["x_mean"][0]
                    )
                    np.testing.assert_allclose(
                        inputs, returns[t - LOOKBACK : t], atol=2e-9
                    )

    def test_scalers_ignore_every_validation_and_test_price(self):
        for h in HORIZONS:
            original, before = prepare_windows(self.frame, h)
            changed = self.frame.copy()
            cutoff = before["origin_cutoffs"]["validation_index"]
            changed.loc[cutoff:, "close"] *= np.linspace(2, 20, len(changed) - cutoff)
            after_arrays, after = prepare_windows(changed, h)
            self.assertEqual(before["normalization"], after["normalization"])
            np.testing.assert_array_equal(original["x_train"], after_arrays["x_train"])
            np.testing.assert_array_equal(original["y_train"], after_arrays["y_train"])
            used = np.diff(np.log(self.frame.close.to_numpy()))[
                : original["origin_train"][-1]
            ]
            self.assertEqual(before["normalization"]["x_mean"][0], float(used.mean()))

    def test_frozen_input_uses_last_sixty_returns(self):
        _, meta = prepare_windows(self.frame, 63)
        norm = meta["normalization"]
        actual = forecast_input(self.frame, norm)
        expected = (
            (np.diff(np.log(self.frame.close.iloc[-61:])) - norm["x_mean"][0])
            / norm["x_scale"][0]
        ).astype(np.float32)
        np.testing.assert_array_equal(actual[0, :, 0], expected)

    def test_nonoverlapping_periods_and_sparse_six_month_count(self):
        for h, count in ((21, 13), (63, 4), (126, 2)):
            arrays, _ = prepare_windows(self.frame, h)
            origins = arrays["origin_test"][::h]
            self.assertEqual(len(origins), count)
            self.assertTrue(np.all(origins[1:] >= origins[:-1] + h))

    def test_invalid_dates_prices_short_history_and_horizon_fail(self):
        for change in ("duplicate", "reversed", "zero", "nan", "short"):
            frame = self.frame.copy()
            if change == "duplicate":
                frame.loc[1, "date"] = frame.loc[0, "date"]
            elif change == "reversed":
                frame = frame.iloc[::-1]
            elif change == "short":
                frame = frame.iloc[:61]
            else:
                frame.loc[20, "close"] = 0 if change == "zero" else np.nan
            with self.assertRaises(ValueError, msg=change):
                prepare_windows(frame, 126)
        with self.assertRaises(ValueError):
            prepare_windows(self.frame, 22)

    def test_source_hash_units_dates_and_provider_are_enforced(self):
        source = source_for(self.frame)
        pipeline.validate_source(self.frame, source)
        for key, value in (
            ("closes_sha256", "wrong"),
            ("rows", 1),
            ("last_date", "2000-01-01"),
            ("price_unit", "USD"),
        ):
            broken = {**source, key: value}
            with self.assertRaises(ValueError):
                pipeline.validate_source(self.frame, broken)
        with self.assertRaises(ValueError):
            pipeline.validate_source(
                self.frame, source, {**source, "provider": "other"}
            )

    def test_corrupt_runtime_does_not_silently_fall_back(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            valid = {
                "schema_version": 1,
                "symbol": "FPT",
                "horizons": [{"sessions": h} for h in HORIZONS],
            }
            public = root / "public.json"
            public.write_text(json.dumps(valid))
            runtime = root / "runtime"
            with (
                patch.object(pipeline, "PUBLIC", public),
                patch.object(pipeline, "RUNTIME", runtime),
            ):
                self.assertEqual(pipeline.read_latest(), valid)
                runtime.mkdir()
                (runtime / "latest.json").write_text("{")
                with self.assertRaises(ValueError):
                    pipeline.read_latest()


class SavedArtifactTests(unittest.TestCase):
    def test_refresh_uses_frozen_artifacts_and_failure_keeps_last_bundle(self):
        if not pipeline.PUBLIC.exists():
            self.skipTest("Bundled model not yet trained")
        original = pipeline.daily.read_json(pipeline.PUBLIC)
        folder = pipeline.ARTIFACTS / original["run_id"]
        dataset = pipeline.RUNTIME / "runs" / original["run_id"] / "dataset"
        if not dataset.exists():
            self.skipTest("Private training snapshot is unavailable")
        frame, source = pipeline.daily.load_snapshot(dataset)
        checkpoints = list((folder / "checkpoints").glob("*.pt"))
        hashes = [pipeline.daily.digest(path) for path in checkpoints]
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            public = root / "public.json"
            pipeline.daily.write_json(public, original)
            with (
                patch.object(pipeline, "PUBLIC", public),
                patch.object(pipeline, "RUNTIME", root / "runtime"),
                patch.object(
                    pipeline.daily,
                    "fit_model",
                    side_effect=AssertionError("Refresh must not train"),
                ),
            ):
                refreshed = pipeline.refresh(frame, source)
                self.assertEqual(refreshed["run_id"], original["run_id"])
                self.assertEqual(refreshed["horizons"], original["horizons"])
                self.assertEqual(pipeline.read_latest(), refreshed)
                previous_bytes = (root / "runtime/latest.json").read_bytes()
                with self.assertRaises(ValueError):
                    pipeline.refresh(frame, {**source, "closes_sha256": "wrong"})
                self.assertEqual(
                    (root / "runtime/latest.json").read_bytes(), previous_bytes
                )
        self.assertEqual([pipeline.daily.digest(path) for path in checkpoints], hashes)

    def test_independent_numpy_reconstruction_and_checkpoint_hashes(self):
        if not pipeline.PUBLIC.exists():
            self.skipTest("Run outlook training to create the bundled evidence first")
        published = pipeline.daily.read_json(pipeline.PUBLIC)
        folder = pipeline.ARTIFACTS / published["run_id"]
        manifest = pipeline.daily.read_json(folder / "manifest.json")
        # Raw market data remains in ignored runtime; archive contains only metadata.
        self.assertFalse((folder / "dataset").exists())
        dataset = pipeline.RUNTIME / "runs" / published["run_id"] / "dataset"
        if not dataset.exists():
            self.skipTest("Private training snapshot is not available on this machine")
        frame, source = pipeline.daily.load_snapshot(dataset)
        self.assertEqual(source["closes_sha256"], manifest["source"]["closes_sha256"])
        for h in HORIZONS:
            item = manifest["horizons"][str(h)]
            checkpoint = folder / item["training"]["checkpoint_file"]
            self.assertEqual(
                pipeline.daily.digest(checkpoint), item["training"]["checkpoint_sha256"]
            )
            saved = torch.load(checkpoint, weights_only=True, map_location="cpu")
            weights = {
                name: value.numpy().astype(np.float64)
                for name, value in saved["state_dict"].items()
            }
            rows = pd.read_csv(folder / f"{h}_test_predictions.csv").iloc[[0, -1]]
            norm = saved["normalization"]
            for row in rows.itertuples():
                prices = frame.close.iloc[
                    row.origin_index - LOOKBACK : row.origin_index + 1
                ].to_numpy()
                inputs = (
                    (np.diff(np.log(prices)) - norm["x_mean"][0]) / norm["x_scale"][0]
                ).astype(np.float32)
                hidden = np.zeros(32)
                for value in inputs:
                    hidden = np.tanh(
                        weights["recurrent.weight_ih_l0"][:, 0] * value
                        + weights["recurrent.weight_hh_l0"] @ hidden
                        + weights["recurrent.bias_ih_l0"]
                        + weights["recurrent.bias_hh_l0"]
                    )
                output = float(
                    (weights["output.weight"] @ hidden + weights["output.bias"])[0]
                )
                predicted = prices[-1] * np.exp(
                    output * norm["y_scale"] + norm["y_mean"]
                )
                self.assertAlmostEqual(predicted, row.rnn, delta=0.05)
                self.assertEqual(row.target_index - row.origin_index, h)
            for name, expected in manifest["source_files"].items():
                self.assertEqual(
                    pipeline.daily.digest(folder / "source" / name), expected
                )

    def test_checkpoint_corruption_is_rejected_before_loading(self):
        if not pipeline.PUBLIC.exists():
            self.skipTest("Bundled model not yet trained")
        folder, manifest = pipeline.load_run()
        item = manifest["horizons"]["21"]
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            checkpoint = root / item["training"]["checkpoint_file"]
            checkpoint.parent.mkdir(parents=True)
            checkpoint.write_bytes(b"not a model")
            with self.assertRaisesRegex(ValueError, "hash mismatch"):
                pipeline.load_model(root, item, 21)


if __name__ == "__main__":
    unittest.main()
