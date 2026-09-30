"""Deployment admission, persistence and startup tests without paid API calls."""

from concurrent.futures import ThreadPoolExecutor
from dataclasses import replace
from datetime import datetime, timedelta, timezone
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from fastapi import FastAPI, HTTPException, Request
from fastapi.testclient import TestClient

from hosting.security import install, settings, allowed_origin, reserve_chat

CODE = "classroom-test-credential-only-12345"
ENV = {
    "A6_ENV": "production", "A6_ALLOWED_ORIGINS": "https://sequence.example",
    "A6_ALLOWED_HOSTS": "api.example", "CHAT_DEMO_CODE": CODE,
}


class HostingTests(unittest.TestCase):
    def test_production_fails_closed_and_rejects_wildcard_origins(self):
        for changed in ({"CHAT_DEMO_CODE": ""}, {"CHAT_DEMO_CODE": "short"},
                        {"A6_ALLOWED_ORIGINS": ""},
                        {"A6_ALLOWED_ORIGINS": "https://*.vercel.app"},
                        {"A6_ALLOWED_ORIGINS": "https://user:password@example.org"},
                        {"A6_ALLOWED_ORIGINS": "http://sequence.example"},
                        {"A6_ALLOWED_HOSTS": "*"}):
            with patch.dict(os.environ, {**ENV, **changed}, clear=True):
                with self.assertRaises(ValueError):
                    settings()

    def test_local_defaults_and_render_host(self):
        with patch.dict(os.environ, {}, clear=True):
            local = settings()
            self.assertFalse(local.production)
            self.assertIn("http://127.0.0.1:4173", local.origins)
            self.assertEqual(local.code, "")
        with patch.dict(os.environ, {**ENV, "A6_ALLOWED_HOSTS": "",
                                   "RENDER_EXTERNAL_HOSTNAME": "api.onrender.com"}, clear=True):
            self.assertIn("api.onrender.com", settings().hosts)

    def test_admission_preflight_host_and_origin(self):
        with patch.dict(os.environ, ENV, clear=True):
            app = FastAPI()
            install(app)

        @app.get("/healthz")
        def health():
            return {"status": "ok"}

        @app.get("/api/chat/status")
        def status():
            return {"ready": True}

        @app.post("/api/chat")
        def chat(request: Request):
            if not allowed_origin(request):
                raise HTTPException(403)
            return {"ok": True}

        with TestClient(app, base_url="https://api.example") as client:
            self.assertEqual(client.get("/healthz").status_code, 200)
            for supplied in ("", "bad", "x" * 129):
                response = client.get("/api/chat/status", headers={"X-Demo-Access-Code": supplied})
                self.assertEqual(response.status_code, 401)
            headers = {"Origin": "https://sequence.example", "X-Demo-Access-Code": CODE}
            ok = client.post("/api/chat", headers=headers)
            self.assertEqual(ok.status_code, 200)
            self.assertEqual(ok.headers["access-control-allow-origin"], headers["Origin"])
            self.assertEqual(ok.headers["cache-control"], "no-store")
            self.assertEqual(client.post("/api/chat", headers={**headers, "Origin": "https://evil.example"}).status_code, 403)
            self.assertEqual(client.get("/healthz", headers={"Host": "evil.example"}).status_code, 400)
            preflight = client.options("/api/chat", headers={
                "Origin": headers["Origin"], "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "content-type,x-demo-access-code",
            })
            self.assertEqual(preflight.status_code, 200)

    def test_quota_survives_connections_and_resets_by_day(self):
        with tempfile.TemporaryDirectory() as folder, patch.dict(os.environ, ENV, clear=True):
            config = replace(settings(), quota_path=Path(folder) / "usage.sqlite3",
                             minute_limit=1, daily_limit=2)
            now = datetime(2026, 10, 8, 12, tzinfo=timezone.utc)
            reserve_chat(config, now)
            with self.assertRaises(HTTPException):
                reserve_chat(config, now)
            reserve_chat(config, now + timedelta(minutes=1))
            with self.assertRaises(HTTPException):
                reserve_chat(config, now + timedelta(minutes=2))
            reserve_chat(config, now + timedelta(days=1))

    def test_concurrent_reservations_cannot_exceed_cap(self):
        with tempfile.TemporaryDirectory() as folder, patch.dict(os.environ, ENV, clear=True):
            config = replace(settings(), quota_path=Path(folder) / "usage.sqlite3",
                             daily_limit=3, minute_limit=3)
            def attempt(_):
                try:
                    reserve_chat(config)
                    return True
                except HTTPException:
                    return False
            with ThreadPoolExecutor(max_workers=8) as pool:
                self.assertEqual(sum(pool.map(attempt, range(12))), 3)

    def test_bootstrap_uses_seed_and_keeps_disk_state(self):
        from daily import pipeline
        from outlook import pipeline as outlook
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            export = root / "public/fpt-daily.json"
            with patch.object(pipeline, "RUNTIME", root / "runtime"), \
                 patch.object(pipeline, "PUBLIC", export), \
                 patch.object(outlook, "RUNTIME", root / "runtime/outlook"), \
                 patch.object(outlook, "PUBLIC", root / "public/fpt-outlook.json"):
                pipeline.bootstrap()
                first = pipeline.read_latest()
                before = (root / "runtime/active.json").read_bytes()
                pipeline.bootstrap()
                self.assertEqual(before, (root / "runtime/active.json").read_bytes())
                self.assertEqual(first["model"]["run_id"], pipeline.read_latest()["model"]["run_id"])
                self.assertTrue(export.exists())
                result = outlook.read_latest()
                bundle, manifest = outlook.load_run(result["run_id"])
                for horizon, item in manifest["horizons"].items():
                    outlook.load_model(bundle, item, int(horizon))
                outlook.publish(result)
                self.assertTrue((root / "public/fpt-outlook.json").exists())


if __name__ == "__main__":
    unittest.main()
