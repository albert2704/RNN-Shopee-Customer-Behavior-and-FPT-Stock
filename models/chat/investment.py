"""Attach compatible horizon forecasts and dated public company evidence."""

import json
from datetime import date
from pathlib import Path
from urllib.parse import urlparse

from daily.core import vietnam_now

COMPANY_FILE = Path(__file__).with_name("company_evidence.json")
HORIZONS = {1: 21, 3: 63, 6: 126}


def company_documents(today=None):
    today = today or vietnam_now().date()
    if not COMPANY_FILE.exists():
        return []
    content = json.loads(COMPANY_FILE.read_text())
    if content.get("schema_version") != 1:
        raise ValueError("Invalid company evidence schema")
    result, seen = [], set()
    for doc in content["documents"]:
        if date.fromisoformat(doc["published_at"]) > today:
            continue
        url = urlparse(doc["source_url"])
        if url.scheme != "https" or not (
            url.hostname == "fpt.com" or (url.hostname or "").endswith(".fpt.com")
        ):
            raise ValueError("Company evidence must cite official FPT sources")
        key = doc["citation_id"]
        if not key.startswith("B") or key in seen or not doc["text"].strip():
            raise ValueError("Invalid company evidence identity")
        seen.add(key)
        result.append(doc)
    return result


def read_outlook():
    from outlook.pipeline import read_latest

    return read_latest()


def compatible_outlook(data):
    try:
        # A hosted daily read carries the outlook from the same atomic publication.
        outlook = data["outlook"] if "outlook" in data else read_outlook()
    except (FileNotFoundError, ImportError):
        return None, "Chưa có bản dự báo theo tháng."
    # A date alone cannot detect a provider revision to historical prices.
    if (
        outlook.get("schema_version") != 1
        or outlook.get("symbol") != "FPT"
        or outlook.get("observed_through") != data["forecast"]["observed_through"]
        or outlook.get("last_close") != data["forecast"]["last_close"]
        or outlook.get("source", {}).get("closes_sha256")
        != data["source"]["closes_sha256"]
    ):
        return None, "Dự báo theo tháng chưa khớp với bản dữ liệu giá đang xem."
    horizons = outlook.get("horizons", [])
    if (
        len(horizons) != 3
        or {h.get("months"): h.get("sessions") for h in horizons} != HORIZONS
    ):
        raise ValueError("Incomplete horizon forecast")
    return outlook, None


def attach(data):
    outlook, reason = compatible_outlook(data)
    return {
        **data,
        "outlook": outlook,
        "outlook_unavailable": reason,
        "company_documents": company_documents(),
    }


def plain_horizon(outlook, horizon):
    """A numerical estimate and qualitative test context, without a metric dump."""
    support = horizon["support"]
    quality = (
        "Sai lệch nhỏ hơn cách giữ nguyên giá trong lần kiểm tra đã lưu."
        if support["beats_persistence"]
        else "Chưa cho thấy sai lệch nhỏ hơn cách giữ nguyên giá trong lần kiểm tra đã lưu."
    )
    if horizon["test"]["rnn"]["direction_accuracy"] < 0.5:
        quality += " Chiều tăng/giảm dự báo cũng sai trong phần lớn trường hợp kiểm tra. Không dùng riêng tín hiệu này để khuyến nghị mua."
    return {
        "months_approx": horizon["months"],
        "trading_sessions": horizon["sessions"],
        "observed_price": {
            "date": outlook["observed_through"],
            "close_vnd": outlook["last_close"],
        },
        "forecast": {
            "estimated_close_vnd": horizon["predicted_close"],
            "estimated_price_change_pct": horizon["predicted_return_pct"],
            "target": f"Sau {horizon['sessions']} phiên ghi nhận tiếp theo, xấp xỉ {horizon['months']} tháng",
            "target_date": None,
        },
        "quality": quality,
        "limitations": (
            "Dự báo thử nghiệm với ít giai đoạn đối chiếu không chồng lấp, chưa chứng minh có lợi thế đầu tư. "
            "Nguồn giá chưa xác nhận điều chỉnh chia tách/cổ tức; đây không phải tổng lợi nhuận gồm cổ tức. "
            "Thông tin doanh nghiệp được phân tích riêng, không phải đầu vào của mạng dự báo giá. "
            "Mức thay đổi là một ước tính, không phải xác suất, mức lãi cam kết hoặc mục tiêu giao dịch."
        ),
    }
