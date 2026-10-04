"""Deployment admission, persistence and startup tests without paid API calls."""

from concurrent.futures import ThreadPoolExecutor
from dataclasses import replace
from datetime import datetime, timedelta, timezone
import os
from pathlib import Path
import tempfile
import unittest
import uuid
from unittest.mock import patch

from fastapi import FastAPI, HTTPException, Request
from fastapi.testclient import TestClient

from hosting.security import install, settings, allowed_origin, reserve_chat

CODE = "classroom-test-credential-only-12345"
ENV = {
    "A6_ENV": "production", "A6_ALLOWED_ORIGINS": "https://sequence.example",
    "A6_ALLOWED_HOSTS": "api.example", "CHAT_DEMO_CODE": CODE,
    "CHAT_REQUIRE_ACCESS_CODE": "true",
    "CHAT_ENFORCE_LIMITS": "true",
}


class HostingTests(unittest.TestCase):
    def test_production_fails_closed_and_rejects_wildcard_origins(self):
        for changed in ({"CHAT_DEMO_CODE": ""}, {"CHAT_DEMO_CODE": "short"},
                        {"CHAT_REQUIRE_ACCESS_CODE": "yes"},
                        {"CHAT_ENFORCE_LIMITS": "yes"},
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
            self.assertFalse(local.require_access_code)
            self.assertFalse(local.enforce_limits)
        with patch.dict(os.environ, {**ENV, "A6_ALLOWED_HOSTS": "",
                                   "RENDER_EXTERNAL_HOSTNAME": "api.onrender.com"}, clear=True):
            self.assertIn("api.onrender.com", settings().hosts)

    def test_public_production_accepts_chat_without_code_or_quota_and_preserves_guards(self):
        for saved_code in ("", CODE):
            with self.subTest(saved_code=bool(saved_code)), patch.dict(os.environ, {
                key: value for key, value in {**ENV, "CHAT_DEMO_CODE": saved_code,
                    "CHAT_DAILY_LIMIT": "0", "CHAT_MINUTE_LIMIT": "0"}.items()
                if key not in {"CHAT_REQUIRE_ACCESS_CODE", "CHAT_ENFORCE_LIMITS"}
            }, clear=True):
                app = FastAPI()
                install(app)
                self.assertFalse(app.state.deployment.require_access_code)
                self.assertFalse(app.state.deployment.enforce_limits)
                self.assertEqual(app.state.deployment.code, "")

                @app.get("/api/chat/status")
                def status():
                    return {"ready": True}

                @app.post("/api/chat")
                def chat(request: Request):
                    if not allowed_origin(request):
                        raise HTTPException(403)
                    reserve_chat(request.app.state.deployment)
                    return {"ok": True}

                with TestClient(app, base_url="https://api.example") as client, patch(
                    "hosting.quota.reserve"
                ) as reserve:
                    headers = {"Origin": "https://sequence.example"}
                    self.assertEqual(client.get("/api/chat/status").status_code, 200)
                    response = client.post("/api/chat", headers=headers)
                    self.assertEqual(response.status_code, 200)
                    self.assertEqual(response.headers["cache-control"], "no-store")
                    self.assertEqual(response.headers["access-control-allow-origin"], headers["Origin"])
                    for _ in range(6):
                        self.assertEqual(client.post("/api/chat", headers=headers).status_code, 200)
                    reserve.assert_not_called()
                    self.assertEqual(client.post("/api/chat", headers={"Origin": "https://evil.example"}).status_code, 403)
                    self.assertEqual(client.post("/api/chat").status_code, 403)
                    self.assertEqual(client.get("/api/chat/status", headers={"Host": "evil.example"}).status_code, 400)
                    reserve.assert_not_called()

    def test_optional_public_quota_remains_enforced(self):
        with patch.dict(os.environ, {**ENV, "CHAT_REQUIRE_ACCESS_CODE": "false"}, clear=True), patch(
            "hosting.quota.reserve", side_effect=HTTPException(429, {"code": "demo_limit"})
        ) as reserve:
            config = settings()
            with self.assertRaises(HTTPException) as failure:
                reserve_chat(config)
            self.assertEqual(failure.exception.status_code, 429)
            self.assertEqual(reserve.call_args.args[0], config)

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
            config = replace(settings(), production=False, quota_path=Path(folder) / "usage.sqlite3",
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
            config = replace(settings(), production=False, quota_path=Path(folder) / "usage.sqlite3",
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

    def test_production_requires_durable_quota(self):
        from hosting import quota
        with patch.dict(os.environ, {**ENV, "CHAT_REQUIRE_ACCESS_CODE": "false"}, clear=True), patch.object(
            quota.graph, "driver", side_effect=RuntimeError("private-connection-details")
        ):
            with self.assertRaises(HTTPException) as failure:
                reserve_chat(settings())
            self.assertEqual(failure.exception.status_code, 503)
            self.assertNotIn("private-connection", str(failure.exception.detail))

    def test_hosted_refresh_is_disabled_before_provider_call(self):
        from daily import api
        with patch.dict(os.environ, {**ENV, "CHAT_REQUIRE_ACCESS_CODE": "false"}, clear=True), patch.object(
            api.app.state, "deployment", settings()
        ), patch.object(api.pipeline, "refresh") as provider:
            # The module's middleware keeps its local test settings; the route
            # consults the production deployment state before any provider work.
            with TestClient(api.app) as client:
                response = client.post("/api/fpt/daily/refresh", json={},
                                       headers={"Origin": "https://sequence.example"})
            self.assertEqual(response.status_code, 403)
            provider.assert_not_called()

    @unittest.skipUnless(os.environ.get("A6_TEST_NEO4J") == "1", "optional local graph integration")
    def test_graph_quota_concurrency_persistence_and_boundaries(self):
        from hosting import quota
        scope = "quota-test-" + uuid.uuid4().hex
        config = replace(settings(), daily_limit=4, minute_limit=3)
        now = datetime(2026, 10, 8, 16, 58, 30, tzinfo=timezone.utc)
        def attempt(_):
            try:
                quota.reserve(config, now, scope)
                return True
            except HTTPException as error:
                self.assertEqual(error.status_code, 429)
                return False
        try:
            with ThreadPoolExecutor(max_workers=6) as pool:
                self.assertEqual(sum(pool.map(attempt, range(10))), 3)
            # Independent connections preserve counts; minute rollover allows
            # one more call, but cannot erase the previous minute's limit.
            quota.reserve(config, now + timedelta(seconds=30), scope)
            with self.assertRaises(HTTPException) as failure:
                quota.reserve(config, now, scope)
            self.assertEqual(failure.exception.status_code, 429)
            quota.reserve(config, now + timedelta(days=1), scope)
            # Previous day's remaining allowance is still enforced even when
            # a delayed reservation arrives after the new day started.
            with self.assertRaises(HTTPException) as failure:
                quota.reserve(config, now + timedelta(minutes=1), scope)
            self.assertEqual(failure.exception.status_code, 429)
        finally:
            with quota.graph.driver() as db:
                db.execute_query("MATCH (q:A6Quota) WHERE q.scope=$scope OR q.id=$lock DELETE q",
                                 scope=scope, lock=scope + ":lock", database_="neo4j")


if __name__ == "__main__":
    unittest.main()
