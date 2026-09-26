"""Offline regression checks; no provider calls or writes to active runs."""
from datetime import datetime
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import numpy as np
import pandas as pd
from .core import VIETNAM, clean_closes, prepare_windows, forecast_input, score


def sample_frame(n=750):
    changes = .005 * np.sin(np.arange(n) / 7) + .001
    return pd.DataFrame({"date": pd.bdate_range("2020-01-01", periods=n), "close": 50000 * np.exp(np.cumsum(changes))})


class DailyCoreTests(unittest.TestCase):
    def test_incomplete_today_excluded_and_unit_conversion(self):
        raw = sample_frame(40).rename(columns={"date": "time"})
        today = raw.time.iloc[-1].date()
        morning = datetime.combine(today, datetime.min.time(), tzinfo=VIETNAM).replace(hour=10)
        result = clean_closes(raw, price_multiplier=1000, now=morning)
        self.assertEqual(len(result), 39)
        self.assertEqual(result.close.iloc[0], raw.close.iloc[0] * 1000)
        self.assertEqual(len(clean_closes(raw, price_multiplier=1, now=morning.replace(hour=16))), 40)

    def test_rejects_conflicting_dates_nonfinite_and_future(self):
        raw = sample_frame(40).rename(columns={"date": "time"})
        with self.assertRaisesRegex(ValueError, "Conflicting"):
            clean_closes(pd.concat([raw, raw.tail(1).assign(close=1)]), price_multiplier=1)
        for value in [0, -1, np.inf, np.nan]:
            bad = raw.copy()
            bad.loc[0, "close"] = value
            with self.assertRaises(ValueError):
                clean_closes(bad, price_multiplier=1)
        raw.loc[39, "time"] = pd.Timestamp("2099-01-01")
        with self.assertRaisesRegex(ValueError, "future"):
            clean_closes(raw, price_multiplier=1)

    def test_causal_windows_and_training_only_scalers(self):
        frame = sample_frame()
        arrays, meta = prepare_windows(frame)
        returns = np.diff(np.log(frame.close.to_numpy()))
        norm = meta["normalization"]
        for split in ["train", "validation", "test"]:
            for i, target in enumerate(arrays["index_" + split]):
                restored = arrays["x_" + split][i, :, 0] * norm["x_scale"][0] + norm["x_mean"][0]
                np.testing.assert_allclose(restored, returns[target-31:target-1], atol=1e-8)
                actual = arrays["y_" + split][i, 0] * norm["y_scale"] + norm["y_mean"]
                self.assertAlmostEqual(actual, returns[target-1], places=7)
        changed = frame.copy()
        changed.loc[arrays["index_test"][0]:, "close"] *= 3
        altered, changed_meta = prepare_windows(changed)
        self.assertEqual(norm, changed_meta["normalization"])
        np.testing.assert_array_equal(arrays["x_train"], altered["x_train"])
        np.testing.assert_array_equal(arrays["y_train"], altered["y_train"])
        self.assertEqual(arrays["index_train"][-1] + 1, arrays["index_validation"][0])
        self.assertEqual(arrays["index_validation"][-1] + 1, arrays["index_test"][0])

    def test_live_input_has_30_returns_and_frozen_scaler(self):
        frame = sample_frame()
        _, meta = prepare_windows(frame)
        norm = meta["normalization"]
        result = forecast_input(frame, norm)
        self.assertEqual(result.shape, (1, 30, 1))
        actual = result[0, :, 0] * norm["x_scale"][0] + norm["x_mean"][0]
        np.testing.assert_allclose(actual, np.diff(np.log(frame.close.tail(31))), atol=1e-8)

    def test_metric_no_change_is_a_separate_direction(self):
        result = score([100, 110, 90], [100, 105, 100], [100, 100, 100])
        self.assertAlmostEqual(result["MAE"], 5)
        self.assertAlmostEqual(result["direction_accuracy"], 2/3)
        self.assertEqual(result["changed_direction_accuracy"], .5)
        self.assertEqual(result["unchanged_count"], 1)

    def test_ledger_no_hindsight_or_adjusted_price_scoring(self):
        from .pipeline import resolve_ledger
        frame = pd.DataFrame({"date": pd.to_datetime(["2026-10-06", "2026-10-07"]), "close": [60000., 61000.]})
        base = {"observed_through": "2026-10-06", "predicted_close": 60500., "last_close": 60000., "created_at": "2026-10-07T10:00:00+07:00", "actual": None}
        [record] = resolve_ledger([dict(base)], frame)
        self.assertTrue(record["prospective"])
        self.assertEqual(record["absolute_error"], 500)
        [late] = resolve_ledger([{**base, "created_at": "2026-10-07T15:00:00+07:00"}], frame)
        self.assertFalse(late["prospective"])
        [revised] = resolve_ledger([{**base, "last_close": 65000.}], frame)
        self.assertFalse(revised["comparable"])
        self.assertIsNone(revised["absolute_error"])

    def test_snapshot_hash_mismatch_fails_closed(self):
        from .pipeline import load_snapshot, write_json
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder)
            (path / "closes.csv").write_text("date,close\n2020-01-01,123\n")
            write_json(path / "source.json", {"closes_sha256": "wrong"})
            with self.assertRaisesRegex(ValueError, "hash"):
                load_snapshot(path)


class DailyApiTests(unittest.TestCase):
    def setUp(self):
        from fastapi.testclient import TestClient
        from . import api
        self.api = api
        self.client = TestClient(api.app)
        api.last_attempt = 0

    def test_refresh_origin_guard(self):
        with patch.object(self.api.pipeline, "refresh") as refresh:
            for origin in ["https://evil.example", "null", ""]:
                self.assertEqual(self.client.post("/api/fpt/daily/refresh", json={}, headers={"Origin": origin}).status_code, 403)
            refresh.assert_not_called()

    def test_refresh_success_and_rate_limit(self):
        with patch.object(self.api.pipeline, "refresh", return_value={"forecast": {"predicted_close": 100}}) as refresh:
            headers = {"Origin": "http://127.0.0.1:4173"}
            first = self.client.post("/api/fpt/daily/refresh", json={}, headers=headers)
            self.assertEqual(first.status_code, 200)
            self.assertEqual(first.json()["delivery"], "local_api")
            self.assertEqual(self.client.post("/api/fpt/daily/refresh", json={}, headers=headers).status_code, 429)
            self.assertEqual(refresh.call_count, 1)

    def test_provider_error_is_explicit_and_hides_diagnostics(self):
        with patch.object(self.api.pipeline, "refresh", side_effect=RuntimeError("private diagnostics")):
            response = self.client.post("/api/fpt/daily/refresh", json={}, headers={"Origin": "http://127.0.0.1:4173"})
            self.assertEqual(response.status_code, 502)
            self.assertNotIn("private diagnostics", response.text)

    def test_concurrent_refresh_rejected(self):
        self.api.refresh_lock.acquire()
        try:
            self.assertEqual(self.client.post("/api/fpt/daily/refresh", json={}, headers={"Origin": "http://127.0.0.1:4173"}).status_code, 409)
        finally:
            self.api.refresh_lock.release()


if __name__ == "__main__":
    unittest.main()
