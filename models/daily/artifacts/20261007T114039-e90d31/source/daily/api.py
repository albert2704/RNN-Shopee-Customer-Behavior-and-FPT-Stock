"""Loopback API. Start from models/: python -m daily.api"""

import threading
import time

from fastapi import FastAPI, HTTPException, Request
from starlette.middleware.trustedhost import TrustedHostMiddleware

from . import pipeline

app = FastAPI(title="FPT daily forecast", docs_url=None, redoc_url=None)
app.add_middleware(TrustedHostMiddleware, allowed_hosts=["127.0.0.1", "localhost", "testserver"])
refresh_lock = threading.Lock()
last_attempt = 0.0
ALLOWED_ORIGINS = {f"http://{host}:{port}" for host in ["127.0.0.1", "localhost"] for port in [4173, 5173, 8006]}


@app.get("/api/fpt/daily")
def latest():
    try:
        result = pipeline.with_freshness(pipeline.read_json(pipeline.RUNTIME / "latest.json"))
        result["delivery"] = "local_api"
        return result
    except FileNotFoundError as error:
        raise HTTPException(503, "Chưa có mô hình và dự báo. Chạy lệnh train trước.") from error


@app.post("/api/fpt/daily/refresh")
def refresh(request: Request):
    global last_attempt
    # Require a same-origin JSON action; no cross-site form-triggered refresh.
    if request.headers.get("origin") not in ALLOWED_ORIGINS or request.headers.get("content-type", "").split(";")[0] != "application/json":
        raise HTTPException(403, "Chỉ cập nhật từ website chạy cục bộ.")
    if not refresh_lock.acquire(blocking=False):
        raise HTTPException(409, "Đang cập nhật dữ liệu.")
    try:
        if time.monotonic() - last_attempt < 60:
            raise HTTPException(429, "Đợi một phút trước khi cập nhật lại.")
        last_attempt = time.monotonic()
        try:
            result = pipeline.refresh()
        except FileNotFoundError as error:
            raise HTTPException(503, "Chưa có mô hình. Chạy lệnh train trước.") from error
        except Exception as error:
            # Do not leak local paths, credentials or provider response bodies.
            print(f"FPT refresh failed: {type(error).__name__}", flush=True)
            raise HTTPException(502, "Nguồn dữ liệu chưa phản hồi hoặc dữ liệu không hợp lệ. Bản dự báo trước được giữ lại.") from error
        result["delivery"] = "local_api"
        return result
    finally:
        refresh_lock.release()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8006)
