"""Visit-driven work, concurrency, retry boundaries and origin admission."""

from concurrent.futures import ThreadPoolExecutor
from dataclasses import replace
from datetime import datetime, timedelta
from threading import Event
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient
from daily import visits
from daily.core import VIETNAM


class VisitTests(unittest.TestCase):
    def setUp(self):
        self.now = datetime(2026, 10, 15, 15, 59, tzinfo=VIETNAM)
        for target in (
            patch.object(visits, "_state", {"state": "idle", "checked_at": None}),
            patch.object(visits, "_attempt", None),
            patch.object(visits, "_period", None),
            patch.object(visits, "vietnam_now", return_value=self.now),
        ):
            target.start()
            self.addCleanup(target.stop)

    def test_concurrent_visitors_share_one_provider_job(self):
        started, release, done = Event(), Event(), Event()
        def refresh():
            started.set()
            release.wait(5)
            return {"forecast": {"observed_through": "2026-10-14"}}
        original = visits._run
        def run():
            try:
                original()
            finally:
                done.set()
        with patch.object(visits.pipeline, "refresh", side_effect=refresh) as fetch, patch.object(visits, "_run", side_effect=run):
            try:
                with ThreadPoolExecutor(max_workers=8) as pool:
                    values = list(pool.map(lambda _: visits.start(), range(20)))
                self.assertTrue(started.wait(2))
                self.assertTrue(all(value["state"] == "refreshing" for value in values))
                for _ in range(10):
                    self.assertEqual(visits.status()["state"], "refreshing")
                self.assertEqual(fetch.call_count, 1)
            finally:
                release.set()
                self.assertTrue(done.wait(5))
            self.assertEqual(visits.start()["state"], "ready")
            self.assertEqual(fetch.call_count, 1)

    def test_failure_is_cached_but_close_cutoff_or_expiry_allows_new_visit(self):
        with patch.object(visits.threading, "Thread") as thread:
            visits.start()
            with patch.object(visits.pipeline, "refresh", side_effect=TimeoutError):
                visits._run()
            self.assertEqual(visits.start()["state"], "failed")
            self.assertEqual(thread.call_count, 1)
            with patch.object(visits, "vietnam_now", return_value=self.now + timedelta(minutes=1)):
                self.assertEqual(visits.start()["state"], "refreshing")
            self.assertEqual(thread.call_count, 2)
            visits._state = {"state": "failed", "checked_at": None}
            visits._attempt -= visits.REUSE_SECONDS + 1
            visits.start()
            self.assertEqual(thread.call_count, 3)

    def test_only_allowed_json_visit_starts_work(self):
        from daily.api import app
        config = replace(app.state.deployment, allow_refresh=True,
                         origins={"https://sequence.example"}, require_access_code=False)
        with patch.object(app.state, "deployment", config), TestClient(app) as client, patch.object(visits, "start", return_value={"state": "refreshing", "checked_at": None}) as start:
            self.assertEqual(client.get("/api/fpt/visit").json()["state"], "idle")
            self.assertEqual(client.get("/healthz").status_code, 200)
            start.assert_not_called()
            for headers in ({}, {"Origin": "https://evil.example"}, {"Origin": "https://sequence.example", "Content-Type": "text/plain"}):
                self.assertEqual(client.post("/api/fpt/visit", headers=headers).status_code, 403)
            start.assert_not_called()
            headers = {"Origin": "https://sequence.example", "Content-Type": "application/json"}
            self.assertEqual(client.post("/api/fpt/visit", headers=headers).status_code, 200)
            start.assert_called_once()
            with patch.object(app.state, "deployment", replace(config, allow_refresh=False)):
                self.assertEqual(client.post("/api/fpt/visit", headers=headers).status_code, 403)


if __name__ == "__main__":
    unittest.main()
