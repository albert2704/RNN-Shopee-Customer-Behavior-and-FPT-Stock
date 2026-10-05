"""Loopback API. Start from models/: python -m daily.api"""

import threading
import time

from fastapi import FastAPI, HTTPException, Request
from hosting.security import install, allowed_origin

from . import pipeline
from chat.api import router as chat_router
from chat.investment import compatible_outlook, company_documents

app = FastAPI(title="FPT daily forecast", docs_url=None, redoc_url=None)
install(app)
app.include_router(chat_router)
refresh_lock = threading.Lock()
last_attempt = 0.0


@app.get("/healthz")
def health():
    return {"status": "ok"}


@app.get("/api/fpt/daily")
def latest():
    try:
        result = pipeline.read_latest()
        result["delivery"] = "local_api"
        return result
    except FileNotFoundError as error:
        raise HTTPException(
            503, "Chưa có mô hình và dự báo. Chạy lệnh train trước."
        ) from error


@app.get("/api/fpt/outlook")
def investment_outlook():
    try:
        result, reason = compatible_outlook(pipeline.read_latest())
        if result is None:
            raise HTTPException(503, reason)
        return {
            **result,
            "company_documents": company_documents(),
            "delivery": "local_api",
        }
    except FileNotFoundError as error:
        raise HTTPException(
            503, "Chưa có dự báo theo tháng. Chạy python -m outlook.pipeline train."
        ) from error
    except ValueError as error:
        raise HTTPException(
            503, "Bản dự báo theo tháng chưa hợp lệ; cần kiểm tra lại dữ liệu."
        ) from error


@app.post("/api/fpt/daily/refresh")
def refresh(request: Request):
    global last_attempt
    # Require a same-origin JSON action; no cross-site form-triggered refresh.
    if (
        not allowed_origin(request)
        or request.headers.get("content-type", "").split(";")[0] != "application/json"
    ):
        raise HTTPException(403, "Nguồn gửi yêu cầu chưa được cho phép.")
    if not request.app.state.deployment.allow_refresh:
        raise HTTPException(403, "Dữ liệu được cập nhật tự động sau giờ đóng cửa. Có thể chạy lại tác vụ Update FPT daily data trên GitHub.")
    if not refresh_lock.acquire(blocking=False):
        raise HTTPException(409, "Đang cập nhật dữ liệu.")
    try:
        if time.monotonic() - last_attempt < 60:
            raise HTTPException(429, "Đợi một phút trước khi cập nhật lại.")
        last_attempt = time.monotonic()
        try:
            result = pipeline.refresh()
        except FileNotFoundError as error:
            raise HTTPException(
                503, "Chưa có mô hình. Chạy lệnh train trước."
            ) from error
        except Exception as error:
            # Do not leak local paths, credentials or provider response bodies.
            print(f"FPT refresh failed: {type(error).__name__}", flush=True)
            raise HTTPException(
                502,
                "Nguồn dữ liệu chưa phản hồi hoặc dữ liệu không hợp lệ. Bản dự báo trước được giữ lại.",
            ) from error
        result["delivery"] = "local_api"
        return result
    finally:
        refresh_lock.release()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=8006)
