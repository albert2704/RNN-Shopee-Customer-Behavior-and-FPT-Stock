"""Publication acceptance, retention, restart and per-request coherence checks."""

import copy
from datetime import datetime, timedelta
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from daily import pipeline, published, update_publication


class PublicationTests(unittest.TestCase):
    def setUp(self):
        self.bundle = pipeline.read_json(published.bundled_path())
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.cache = Path(self.temp.name) / "published.json"
        for target in (
            patch.object(published, "enabled", return_value=True),
            patch.object(published, "cache_path", return_value=self.cache),
            patch.object(published, "_cache", None),
            patch.object(published, "_attempt", None),
            patch.object(published, "vietnam_now", return_value=datetime.fromisoformat(self.bundle["published_at"]) + timedelta(days=10)),
        ):
            target.start()
            self.addCleanup(target.stop)

    def revised(self, newer_date=False):
        value = copy.deepcopy(self.bundle)
        retrieved = datetime.fromisoformat(value["daily"]["source"]["retrieved_at"])
        when = datetime.fromisoformat(value["published_at"]) + timedelta(days=1)
        value["published_at"] = when.isoformat()
        for source in (value["daily"]["source"], value["outlook"]["source"]):
            source["retrieved_at"] = (retrieved + timedelta(days=1)).isoformat()
            source["closes_sha256"] = "b" * 64
        if newer_date:
            day = (datetime.fromisoformat(value["daily"]["source"]["last_date"]) + timedelta(days=1)).date().isoformat()
            value["daily"]["source"]["last_date"] = day
            value["outlook"]["source"]["last_date"] = day
            value["daily"]["forecast"]["observed_through"] = day
            value["outlook"]["observed_through"] = day
            value["daily"]["history"][-1]["date"] = day
        return value

    def test_committed_bundle_matches_both_static_files(self):
        published.validate(self.bundle)
        self.assertEqual(self.bundle["daily"], pipeline.read_json(pipeline.BUNDLED_PUBLIC))
        self.assertEqual(self.bundle["outlook"], pipeline.read_json(pipeline.BUNDLED_PUBLIC.with_name("fpt-outlook.json")))

    def test_newer_and_same_date_revision_accepted(self):
        for newer in (False, True):
            candidate = self.revised(newer)
            with patch.object(published, "download", return_value=candidate), patch.object(published, "_attempt", None):
                result = published.read()
            self.assertEqual(result, candidate)
            self.assertEqual(pipeline.read_json(self.cache), candidate)

    def test_mismatched_source_date_price_model_or_horizon_rejected(self):
        for case in ("hash", "date", "price", "model", "horizon", "nan", "math", "ledger"):
            candidate = self.revised()
            if case == "hash": candidate["outlook"]["source"]["closes_sha256"] = "c" * 64
            if case == "date": candidate["outlook"]["observed_through"] = "2000-01-01"
            if case == "price": candidate["outlook"]["last_close"] += 1
            if case == "model": candidate["daily"]["model"]["checkpoint_sha256"] = "c" * 64
            if case == "horizon": candidate["outlook"]["horizons"].pop()
            if case == "nan": candidate["daily"]["forecast"]["predicted_close"] = float("nan")
            if case == "math": candidate["outlook"]["horizons"][0]["predicted_close"] *= 2
            if case == "ledger": candidate["ledger"] = []
            with self.assertRaises((ValueError, KeyError), msg=case):
                published.validate(candidate, self.bundle)

    def test_older_response_retains_current_generation(self):
        newer = self.revised(True)
        with patch.object(published, "_cache", newer), patch.object(published, "download", return_value=self.bundle):
            self.assertEqual(published.read(), newer)
        revision = self.revised()
        with self.assertRaisesRegex(ValueError, "older"):
            published.validate(self.bundle, revision)

    def test_timeout_retains_snapshot_and_ttl_suppresses_repeat(self):
        with patch.object(published, "download", side_effect=TimeoutError) as fetch:
            self.assertEqual(published.read(), self.bundle)
            self.assertEqual(published.read(), self.bundle)
            self.assertEqual(fetch.call_count, 1)

    def test_cold_restart_uses_persisted_newer_snapshot_offline(self):
        newer = self.revised()
        pipeline.write_json(self.cache, newer)
        with patch.object(published, "download", side_effect=OSError):
            self.assertEqual(published.read(), newer)

    def test_corrupt_cache_retains_packaged_snapshot(self):
        for invalid in ('null', '[]', '{"schema_version":1}', '{"schema_version":1,"daily":[],"outlook":null}'):
            self.cache.write_text(invalid)
            with patch.object(published, "download", side_effect=OSError), patch.object(published, "_cache", None), patch.object(published, "_attempt", None):
                self.assertEqual(published.read(), self.bundle)

    def test_one_request_keeps_matching_outlook_when_cache_changes(self):
        from chat.investment import compatible_outlook
        with patch.object(published, "download", return_value=self.bundle):
            first = pipeline.read_latest()
        with patch.object(published, "_cache", self.revised(True)):
            monthly, reason = compatible_outlook(first)
            self.assertIsNone(reason)
            self.assertEqual(monthly, self.bundle["outlook"])
        first["forecast"]["last_close"] = 0
        self.assertEqual(published._cache, self.bundle)

    def test_local_mode_never_downloads(self):
        with patch.object(published, "enabled", return_value=False), patch.object(published, "download") as fetch:
            self.assertIsNone(published.read())
            fetch.assert_not_called()

    def test_unchanged_input_skips_inference_and_artifact_writes(self):
        with (
            patch.object(pipeline, "bootstrap"),
            patch.object(pipeline, "publish"),
            patch.object(pipeline, "load_snapshot", return_value=(None, self.bundle["daily"]["source"])),
            patch.object(pipeline, "make_forecast", side_effect=AssertionError("Must not infer unchanged input")),
            patch.object(pipeline, "fit_model", side_effect=AssertionError("Must never train")),
            patch.object(pipeline, "write_json") as write,
        ):
            self.assertFalse(update_publication.update(Path("snapshot")))
            write.assert_not_called()


if __name__ == "__main__":
    unittest.main()
