"""Pinned Vnstock Community KBS daily history, with explicit units and cutoff."""

import argparse
import importlib.metadata
import os
from pathlib import Path

# Do not let this data dependency send telemetry or write agent instructions.
os.environ["VNSTOCK_TELEMETRY"] = "off"
os.environ["VNSTOCK_DISABLE_AGENT_SETUP"] = "1"
os.environ["VNSTOCK_DISABLE_GLOBAL_AGENT"] = "1"

from .core import clean_closes, vietnam_now
from .pipeline import digest, write_json

VERSION = "4.0.9"
SOURCE_URL = "https://www.vnstocks.com/docs/vnstock/du-lieu-thi-truong-market-data"


def fetch(output):
    version = importlib.metadata.version("vnstock")
    if version != VERSION:
        raise ValueError(
            f"Expected vnstock {VERSION}, received {version}; revalidate the adapter before upgrading"
        )
    from vnstock import Market

    now = vietnam_now()
    # Stay inside the Community edition's eight-year history entitlement.
    START = f"{now.year - 7}-01-01"
    # Omitting count silently limits this API to the latest 100 bars.
    raw = (
        Market()
        .equity("FPT")
        .ohlcv(
            start=START,
            end=now.date().isoformat(),
            interval="1D",
            count=10000,
            source="kbs",
        )
    )
    if raw is None or raw.empty:
        raise ValueError("Provider returned no FPT prices")
    frame = clean_closes(raw, price_multiplier=1000, now=now)
    if str(frame.date.iloc[0].date()) > f"{now.year - 7}-03-01":
        raise ValueError(
            "Requested history appears truncated; do not train on the API's default 100 rows"
        )
    if len(frame) < 631:
        raise ValueError("Insufficient historical coverage")
    output = Path(output)
    output.mkdir(parents=True, exist_ok=False)
    raw.to_csv(output / "provider.csv", index=False)
    frame.to_csv(output / "closes.csv", index=False)
    source = {
        "symbol": "FPT",
        "provider": "KBS via Vnstock Community",
        "package": "vnstock",
        "package_version": version,
        "source_url": SOURCE_URL,
        "retrieved_at": now.isoformat(),
        "requested_start": START,
        "requested_end": now.date().isoformat(),
        "first_date": str(frame.date.iloc[0].date()),
        "last_date": str(frame.date.iloc[-1].date()),
        "rows": len(frame),
        "raw_rows": len(raw),
        "excluded_rows": len(raw) - len(frame),
        "price_multiplier": 1000,
        "price_unit": "VND",
        "upstream_price_unit": "thousand VND",
        "price_basis": "KBS upstream historical close as returned by vnstock 4.0.9; corporate action adjustment unconfirmed",
        "adjustment_note": "Giá lịch sử do KBS cung cấp, đổi từ nghìn VND sang VND. Adapter cộng đồng chưa xác nhận rõ cách điều chỉnh cổ tức/chia tách; không trộn với CSV Kaggle hoặc coi đây là giá khớp lệnh lịch sử chưa điều chỉnh.",
        "completion_policy": "Exclude current Vietnam date before 16:00; provider publication/finality is not guaranteed",
        "provider_sha256": digest(output / "provider.csv"),
        "closes_sha256": digest(output / "closes.csv"),
    }
    write_json(output / "source.json", source)
    print(f"Saved {len(frame)} completed FPT sessions through {source['last_date']}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True)
    fetch(parser.parse_args().output)
