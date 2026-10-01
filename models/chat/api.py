"""Bounded local endpoints. No financial conversation is saved by this server."""

import threading
import time

from fastapi import APIRouter, HTTPException, Request
from neo4j.exceptions import Neo4jError, DriverError
from openai import AuthenticationError, APIError, RateLimitError

from daily import pipeline
from . import graph, service
from .config import settings
from hosting.security import allowed_origin, reserve_chat

router = APIRouter(prefix="/api/chat")
chat_lock = threading.Lock()
last_attempt = 0.0


def fail(status, code, message):
    raise HTTPException(status, {"code": code, "message": message})


@router.get("/status")
def status():
    c = settings()
    connected = False
    try:
        graph.ping()
        connected = True
    except Exception:
        pass
    available = True
    try:
        data = pipeline.read_latest()
    except FileNotFoundError:
        available, data = False, None
    return {
        "api_key_configured": bool(c["OPENAI_API_KEY"]),
        "graph_connected": connected,
        "data_available": available,
        "model": c["OPENAI_MODEL"],
        "ready": bool(c["OPENAI_API_KEY"]) and connected and available,
        "observed_through": data["forecast"]["observed_through"] if data else None,
        "reference_close": data["forecast"]["last_close"] if data else None,
    }


@router.post("")
async def chat(request: Request):
    global last_attempt
    if (
        not allowed_origin(request)
        or request.headers.get("content-type", "").split(";")[0] != "application/json"
    ):
        fail(403, "origin", "Nguồn gửi yêu cầu chưa được cho phép.")
    raw = bytearray()
    async for chunk in request.stream():
        raw.extend(chunk)
        if len(raw) > 80000:
            fail(
                413, "too_large", "Hội thoại quá dài. Hãy bắt đầu cuộc trò chuyện mới."
            )
    try:
        body = service.ChatRequest.model_validate_json(raw)
    except ValueError:
        fail(
            422,
            "invalid_input",
            "Câu hỏi phải có nội dung, tối đa 4.000 ký tự và 16 tin nhắn gần nhất.",
        )
    if not settings()["OPENAI_API_KEY"]:
        fail(
            503,
            "missing_key",
            "Chưa cấu hình API key. Thêm OPENAI_API_KEY vào models/.env rồi thử lại.",
        )
    if not chat_lock.acquire(blocking=False):
        fail(409, "busy", "Đang trả lời một câu hỏi. Vui lòng chờ.")
    try:
        if time.monotonic() - last_attempt < 3:
            fail(429, "cooldown", "Đợi vài giây trước khi gửi câu hỏi tiếp theo.")
        last_attempt = time.monotonic()
        # Keep slow network and database calls out of the event loop.
        from starlette.concurrency import run_in_threadpool

        await run_in_threadpool(reserve_chat, request.app.state.deployment)
        return await run_in_threadpool(service.answer, body)
    except HTTPException:
        raise
    except (Neo4jError, DriverError):
        fail(
            503,
            "graph_unavailable",
            "Chưa kết nối được kho dữ liệu Neo4j. Chạy python -m chat.setup từ models/.",
        )
    except FileNotFoundError:
        fail(
            503,
            "no_data",
            "Chưa có dữ liệu FPT. Chạy python -m daily.pipeline bootstrap từ models/.",
        )
    except AuthenticationError:
        fail(
            503,
            "invalid_key",
            "API key chưa được chấp nhận. Kiểm tra cấu hình trên máy chủ.",
        )
    except RateLimitError:
        fail(
            429,
            "provider_limit",
            "Dịch vụ AI đang giới hạn lượt dùng hoặc tài khoản hết hạn mức. Kiểm tra tài khoản API rồi thử lại.",
        )
    except APIError:
        fail(
            502,
            "provider_error",
            "Chưa nhận được câu trả lời từ dịch vụ AI. Kiểm tra kết nối và quyền truy cập model rồi thử lại.",
        )
    except Exception as error:
        print(f"Chat failed: {type(error).__name__}", flush=True)
        fail(
            502,
            "invalid_answer",
            "Chưa tạo được câu trả lời có nguồn hợp lệ. Hãy thử lại.",
        )
    finally:
        chat_lock.release()
