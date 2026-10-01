"""Admission and durable usage limits for a single instance classroom demo."""

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
import hmac
import os
from pathlib import Path
import sqlite3
from urllib.parse import urlsplit

from fastapi import HTTPException
from starlette.middleware.cors import CORSMiddleware
from starlette.middleware.trustedhost import TrustedHostMiddleware
from starlette.responses import JSONResponse

LOCAL_ORIGINS = {
    f"http://{host}:{port}"
    for host in ("localhost", "127.0.0.1")
    for port in (4173, 5173, 8006)
}


@dataclass(frozen=True)
class Deployment:
    production: bool
    origins: set[str]
    hosts: list[str]
    code: str
    quota_path: Path
    daily_limit: int
    minute_limit: int
    allow_refresh: bool


def settings():
    mode = os.environ.get("A6_ENV", "local")
    if mode not in {"local", "production"}:
        raise ValueError("A6_ENV must be local or production")
    production = mode == "production"
    origins = {
        item.strip().rstrip("/")
        for item in os.environ.get("A6_ALLOWED_ORIGINS", "").split(",")
        if item.strip()
    }
    if not origins and not production:
        origins = LOCAL_ORIGINS.copy()
    for origin in origins:
        parsed = urlsplit(origin)
        if (
            not parsed.hostname or parsed.username or parsed.password
            or parsed.path or parsed.query or parsed.fragment or "*" in origin
            or parsed.scheme not in ({"https"} if production else {"http", "https"})
        ):
            raise ValueError("A6_ALLOWED_ORIGINS must contain exact web origins")
    code = os.environ.get("CHAT_DEMO_CODE", "")
    if (production or code) and not 24 <= len(code) <= 128:
        raise ValueError("CHAT_DEMO_CODE must contain 24 to 128 characters")
    if production and not origins:
        raise ValueError("A6_ALLOWED_ORIGINS is required in production")
    hosts = [
        item.strip()
        for item in os.environ.get("A6_ALLOWED_HOSTS", "").split(",")
        if item.strip()
    ]
    if render_host := os.environ.get("RENDER_EXTERNAL_HOSTNAME", ""):
        hosts.append(render_host)
    if production and not hosts:
        raise ValueError("Configure the public API host")
    if any("*" in host or "/" in host or ":" in host for host in hosts):
        raise ValueError("A6_ALLOWED_HOSTS must contain exact host names")
    hosts.extend(["localhost", "127.0.0.1"])
    if not production:
        hosts.append("testserver")
    root = Path(os.environ.get(
        "FPT_DAILY_HOME", Path(__file__).resolve().parents[1] / "daily/runtime"
    ))
    daily_limit = int(os.environ.get("CHAT_DAILY_LIMIT", "100"))
    minute_limit = int(os.environ.get("CHAT_MINUTE_LIMIT", "5"))
    if not 1 <= minute_limit <= daily_limit <= 1000:
        raise ValueError("Chat limits must satisfy 1 <= minute <= daily <= 1000")
    allow_refresh = os.environ.get("A6_ALLOW_REFRESH", "false" if production else "true")
    if allow_refresh not in {"true", "false"}:
        raise ValueError("A6_ALLOW_REFRESH must be true or false")
    return Deployment(production, origins, hosts, code, root / "chat-usage.sqlite3",
                      daily_limit, minute_limit, allow_refresh == "true")


def install(app):
    config = settings()
    app.state.deployment = config
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=config.hosts)

    @app.middleware("http")
    async def demo_access(request, call_next):
        protected = request.url.path.startswith("/api/chat") or (
            request.url.path == "/api/fpt/daily/refresh"
        )
        if config.code and protected and request.method != "OPTIONS":
            supplied = request.headers.get("x-demo-access-code", "")
            if len(supplied) > 128 or not hmac.compare_digest(
                supplied.encode(), config.code.encode()
            ):
                return JSONResponse(
                    {"detail": {"code": "access_required", "message":
                     "Nhập mã truy cập bản demo để sử dụng trợ lý."}},
                    status_code=401, headers={"Cache-Control": "no-store"},
                )
        response = await call_next(request)
        if request.url.path.startswith("/api/"):
            response.headers["Cache-Control"] = "no-store"
        return response

    # CORS is outermost so preflight never needs a credential.
    app.add_middleware(
        CORSMiddleware, allow_origins=sorted(config.origins),
        allow_methods=["GET", "POST"],
        allow_headers=["Content-Type", "X-Demo-Access-Code"],
    )


def allowed_origin(request):
    return request.headers.get("origin") in request.app.state.deployment.origins


def reserve_chat(config, now=None):
    """Count attempts atomically; no conversation or client identifiers are saved."""
    if not config.code and not config.production:
        return
    now = now or datetime.now(timezone.utc)
    if config.production:
        from .quota import reserve
        return reserve(config, now)
    day = now.astimezone(timezone(timedelta(hours=7))).date().isoformat()
    minute = int(now.timestamp()) // 60
    config.quota_path.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(config.quota_path, timeout=5) as db:
        db.execute("CREATE TABLE IF NOT EXISTS usage (bucket TEXT PRIMARY KEY, count INTEGER NOT NULL)")
        db.execute("BEGIN IMMEDIATE")
        buckets = [(f"day:{day}", config.daily_limit),
                   (f"minute:{minute}", config.minute_limit)]
        for bucket, limit in buckets:
            row = db.execute("SELECT count FROM usage WHERE bucket=?", (bucket,)).fetchone()
            if row and row[0] >= limit:
                db.rollback()
                raise HTTPException(429, {"code": "demo_limit", "message":
                    "Bản demo đã đạt giới hạn lượt hỏi. Vui lòng thử lại sau."})
        for bucket, _ in buckets:
            db.execute("INSERT INTO usage VALUES (?, 1) ON CONFLICT(bucket) DO UPDATE SET count=count+1", (bucket,))
        # Keep recent buckets so a request crossing midnight cannot erase the
        # current day's counter while another reservation is waiting for a lock.
        old_day = (now - timedelta(days=2)).astimezone(
            timezone(timedelta(hours=7))
        ).date().isoformat()
        db.execute("DELETE FROM usage WHERE (bucket LIKE 'day:%' AND bucket < ?) "
                   "OR (bucket LIKE 'minute:%' AND CAST(substr(bucket, 8) AS INTEGER) < ?)",
                   (f"day:{old_day}", minute - 10))
