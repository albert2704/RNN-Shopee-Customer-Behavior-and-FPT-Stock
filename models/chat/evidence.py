"""Small, versioned corpus from the same canonical data as the FPT dashboard."""

import hashlib
import json
import re
import unicodedata
from datetime import datetime
from zoneinfo import ZoneInfo

EDUCATION_URL = (
    "https://www.investor.gov/introduction-investing/getting-started/asset-allocation"
)


def fold(text):
    value = unicodedata.normalize("NFKD", text.casefold().replace("đ", "d"))
    return "".join(c for c in value if not unicodedata.combining(c))


def search_query(text):
    # Never pass Lucene operators from user input to the index.
    terms = list(dict.fromkeys(re.findall(r"[a-z0-9]+", fold(text))))[:32]
    return " OR ".join(f'"{term}"' for term in terms) or '"fpt"'


def corpus(data):
    f, m, s = data["forecast"], data["model"], data["source"]
    bundle = {
        key: data.get(key)
        for key in (
            "forecast",
            "model",
            "source",
            "ledger",
            "outlook",
            "company_documents",
        )
    }
    version = hashlib.sha256(json.dumps(bundle, sort_keys=True).encode()).hexdigest()
    test = m["test"]
    rows = []

    def add(key, title, text, pointer, entity, url="/api/fpt/daily", **extra):
        rows.append(
            {
                "id": f"a6:{version}:{key}",
                "bundle": version,
                "citation_id": key,
                "title": title,
                "text": text,
                "source_url": url,
                "source_pointer": pointer,
                "entity": entity,
                "search_text": fold(title + " " + text),
                **extra,
            }
        )

    add(
        "E1",
        "Phạm vi và cách dùng",
        "Chat có dữ liệu giá, dự báo và các công bố doanh nghiệp FPT được trích dẫn. "
        "Không có dữ liệu để xếp hạng các cổ phiếu khác, định giá doanh nghiệp hoặc tối ưu danh mục. "
        "E2 là dự báo một phiên. Nếu có H1/H3/H6, đó là các mạng riêng dự báo trực tiếp 21/63/126 phiên, "
        "xấp xỉ 1/3/6 tháng; không kéo dài dự báo một phiên. Nếu không có H thì chưa có dự báo tháng hợp lệ. "
        "Số tiền đầu tư không phải đầu vào RNN. "
        "Cần hỏi thời gian đầu tư, khoản dự phòng và mức lỗ chấp nhận trước khi bàn phân bổ vốn. "
        "Không có xác suất tăng đã hiệu chỉnh, lợi nhuận đảm bảo hoặc kiểm chứng chiến lược giao dịch.",
        "models/chat/evidence.py · scope",
        "stock",
        "/downloads/a6-rnn-source.zip",
    )
    add(
        "E2",
        "Giá đóng cửa và dự báo FPT",
        json.dumps(f, ensure_ascii=False)
        + " Giá là bản đóng cửa đã lưu theo observed_through, không phải giá trực tiếp. "
        "Mục tiêu là phiên được ghi nhận kế tiếp, không tự suy ra ngày lịch. "
        "predicted_return_pct là phần trăm thay đổi giá dự báo, không phải xác suất tăng.",
        "/forecast",
        "forecast",
    )
    add(
        "E3",
        "RNN so với cách giữ giá phiên trước",
        json.dumps(
            {
                "test_period": m["splits"]["test"],
                "metrics": test,
                "beats_persistence_mae": m["beats_persistence_mae"],
            },
            ensure_ascii=False,
        )
        + " MAE càng nhỏ càng tốt; đơn vị VND/cổ phiếu. direction_accuracy là tỷ lệ "
        "đúng dấu tăng/giảm/không đổi trên tập kiểm tra, không phải xác suất ngày mai. "
        "Không biến MAE thành khoảng tin cậy. Persistence luôn dự báo không đổi; "
        "không dùng direction_accuracy của persistence để tuyên bố có lợi thế đầu tư.",
        "/model/test",
        "model",
    )
    add(
        "E4",
        "Nguồn dữ liệu và đơn vị",
        json.dumps(s, ensure_ascii=False),
        "/source",
        "source",
    )
    add(
        "E5",
        "Huấn luyện RNN dự báo một phiên và hidden state",
        json.dumps(
            {
                key: m[key]
                for key in (
                    "run_id",
                    "trained_at",
                    "hidden_size",
                    "lookback",
                    "epochs_run",
                    "best_epoch",
                    "splits",
                )
            },
            ensure_ascii=False,
        )
        + " Input: 30 log returns từ 31 giá đóng cửa. Hidden state 32 số, được cập nhật "
        "qua từng bước bằng cùng trọng số đã học. 32 là lựa chọn siêu tham số, không phải 32 ngày. "
        "Chia theo thời gian, scaler chỉ fit trên train, chọn checkpoint bằng validation. "
        "Epoch là một lượt qua dữ liệu train; dừng sớm theo validation. Test không dùng chọn checkpoint. "
        "Hiện chỉ có một seed và một cách chia; chưa chứng minh hidden_size=32 là tối ưu.",
        "/model",
        "model",
    )
    add(
        "E6",
        "Dự báo đã có kết quả chưa?",
        json.dumps(data["ledger"], ensure_ascii=False)
        + " actual=null nghĩa là chưa có kết quả quan sát để đánh giá dự báo đó. "
        "Chỉ so sai số khi dự báo được phát trước mục tiêu và nguồn giá còn so sánh được.",
        "/ledger",
        "forecast",
    )
    add(
        "E7",
        "Số tiền, thời hạn và rủi ro",
        "Khung giáo dục đầu tư: phân bổ tài sản phụ thuộc "
        "thời gian đầu tư và khả năng chịu rủi ro; đa dạng hóa giúp giảm rủi ro tập trung. "
        "Nguồn này không đề xuất tỷ trọng FPT hoặc cổ phiếu Việt Nam cụ thể.",
        "Asset allocation · time horizon, risk tolerance, diversification",
        "stock",
        EDUCATION_URL,
    )
    add(
        "E8",
        "Phép tính số cổ phiếu khi được yêu cầu",
        "Máy tính dùng số tiền người dùng nêu và "
        "giá đóng cửa đã lưu. Cổ phiếu nguyên = floor(vốn / giá); tiền còn = vốn − cổ phiếu × giá. "
        "Đây là số học cho toàn bộ số tiền đang xét, không phải khuyên dùng hết vốn. "
        "Chưa tính phí, thuế, trượt giá hoặc tính khả thi theo quy định lô giao dịch. "
        "Chỉ tính khi được hỏi số lượng cổ phiếu; nhắc tới ngân sách không tự yêu cầu phép tính.",
        "models/chat/calculator.py",
        "stock",
        "/downloads/a6-rnn-source.zip",
    )
    outlook = data.get("outlook")
    if outlook:
        for horizon in outlook["horizons"]:
            add(
                f"H{horizon['months']}",
                f"Dự báo FPT khoảng {horizon['months']} tháng",
                json.dumps(
                    {
                        "observed_through": outlook["observed_through"],
                        "last_close": outlook["last_close"],
                        **horizon,
                    },
                    ensure_ascii=False,
                ),
                f"/horizons/{horizon['months']} months",
                "horizon",
                "/api/fpt/outlook",
                horizon_sessions=horizon["sessions"],
            )
    for doc in data.get("company_documents", []):
        add(
            doc["citation_id"],
            doc["title"],
            f"Ngày nguồn: {doc['published_at']}. Kỳ thông tin: {doc['period']}. "
            + doc["text"],
            doc["source_pointer"],
            "company",
            doc["source_url"],
            published_at=doc["published_at"],
            category=doc["category"],
        )
    return version, rows


def freshness(data):
    today = datetime.now(ZoneInfo("Asia/Ho_Chi_Minh")).date()
    observed = datetime.fromisoformat(data["forecast"]["observed_through"]).date()
    return {
        "today": str(today),
        "observed_through": str(observed),
        "calendar_days": (today - observed).days,
        "stale": (today - observed).days >= 7,
    }
