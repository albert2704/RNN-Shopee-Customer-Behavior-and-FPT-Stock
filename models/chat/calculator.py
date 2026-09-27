"""Budget arithmetic is Python code, never a language-model calculation."""

import re
from decimal import Decimal, InvalidOperation, ROUND_FLOOR

from .evidence import fold

FOREIGN_CURRENCY = (
    r"[$€£¥]|\b(usd|eur|gbp|jpy|cny|thb|usdt|dollar|euro|baht|yen|do la)\b"
)


def parse_amount(text):
    normalized = fold(text)
    # Explicit VND words/units only: an isolated 200, years or percentages are ambiguous.
    if re.search(r"[-−+]\s*\d|\bam\s+\d|\bkhong co\b", normalized) or re.search(
        FOREIGN_CURRENCY, normalized
    ):
        return None
    hits = re.findall(
        r"(?<![\w.])([0-9][0-9.,]*)\s*(trieu|tr\b|ty\b|ti\b|vnd\b|dong\b)", normalized
    )
    values = []
    for raw, unit in hits:
        try:
            if unit in {"trieu", "tr", "ty", "ti"}:
                if not re.fullmatch(r"\d+(?:[.,]\d{1,2})?", raw):
                    continue
                number = Decimal(raw.replace(",", "."))
                value = number * (
                    1_000_000 if unit in {"trieu", "tr"} else 1_000_000_000
                )
            else:
                # Accept plain digits or conventional thousands separators, not uncertain decimal money.
                if not (
                    raw.isdigit()
                    or re.fullmatch(r"\d{1,3}([.,])\d{3}(?:\1\d{3})*", raw)
                ):
                    continue
                value = Decimal(raw.replace(",", "").replace(".", ""))
            if value.is_finite() and 0 < value <= 1_000_000_000_000:
                values.append(value)
        except InvalidOperation:
            continue
    unique = set(values)
    return next(iter(unique)) if len(unique) == 1 and len(values) == len(hits) else None


def scenario(messages, forecast):
    # A new explicit amount supersedes an old one. Multiple different amounts in one
    # turn (e.g. total savings and reserve) require clarification instead of guessing.
    chosen = None
    for message in reversed(messages):
        if message["role"] != "user":
            continue
        normalized = fold(message["content"])
        if re.search(FOREIGN_CURRENCY, normalized):
            return None
        # A requested alternate price is unsupported; do not silently reuse the saved close.
        if re.search(r"\bgia\b(?:\s+[a-z]+){0,3}\s+\d", normalized):
            return None
        has_amount = re.search(
            r"\d[\d.,]*\s*(trieu|tr\b|ty\b|ti\b|vnd|dong)", normalized
        )
        # Be conservative: reserve, price, debt or acceptable loss is not capital.
        if has_amount and (
            re.search(
                r"\b(lo|mat|du phong|de danh|giu lai|no|thu nhap|luong|lai|phi|thue)\b",
                normalized,
            )
            or re.search(
                r"\bgia\b(?:\s+[a-z]+){0,3}\s+\d[\d.,]*\s*(trieu|tr\b|ty\b|ti\b|vnd|dong)",
                normalized,
            )
        ):
            return None
        if re.search(
            r"mot nua|phan tram|%|chi (co|dung|dau tu)\s+\d+(?![\d.,])\s*$", normalized
        ):
            return None
        value = parse_amount(message["content"])
        # Amount-only replies or explicit capital/purchase wording are recognized.
        if value is not None and not (
            re.search(r"\b(co|von|ngan sach|dung|dau tu|mua)\b", normalized)
            or re.fullmatch(
                r"[\d.,]+\s*(trieu|tr|ty|ti|vnd|dong)[.!?]?", normalized.strip()
            )
        ):
            return None
        if value is not None:
            chosen = value
            break
        if has_amount:
            return None
    if chosen is None:
        return None
    price = Decimal(str(forecast["last_close"]))
    if not price.is_finite() or price <= 0:
        raise ValueError("Invalid reference price")
    shares = int((chosen / price).to_integral_value(rounding=ROUND_FLOOR))
    cost = price * shares
    return {
        "budget_vnd": float(chosen),
        "reference_close_vnd": float(price),
        "observed_through": forecast["observed_through"],
        "whole_shares": shares,
        "cost_vnd": float(cost),
        "remaining_vnd": float(chosen - cost),
        "assumption": "Phép tính cổ phiếu nguyên cho số tiền được yêu cầu, không phải tỷ trọng đề xuất. "
        "Chưa tính phí, thuế, trượt giá và quy định lô giao dịch.",
    }
