"""Read one validated daily/outlook publication from our public repository.

No provider fetch, model training, credentials or graph writes happen here.
Local mode is offline by default. Production retains the last good publication.
"""

import copy
from datetime import date, datetime
import json
import math
import os
import re
import threading
import time
from urllib.request import Request, urlopen

from . import pipeline
from .core import vietnam_now

URL = ("https://raw.githubusercontent.com/albert2704/"
       "RNN-Shopee-Customer-Behavior-and-FPT-Stock/main/"
       "website/public/data/fpt-published.json")
TTL = 300
MAX_BYTES = 2 * 1024 * 1024
_lock = threading.Lock()
_cache = None
_attempt = None


def enabled():
    default = "true" if os.environ.get("A6_ENV") == "production" else "false"
    return os.environ.get("FPT_PUBLISHED_UPDATES", default).lower() == "true"


def bundled_path():
    return pipeline.BUNDLED_PUBLIC.with_name("fpt-published.json")


def cache_path():
    return pipeline.RUNTIME / "published.json"


def timestamp(value):
    result = datetime.fromisoformat(value)
    if result.tzinfo is None:
        raise ValueError("Publication timestamp must have a timezone")
    return result


def positive(value):
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or value <= 0:
        raise ValueError("Invalid published price")


def validate(bundle, previous=None):
    """Validate the whole generation before accepting any part of it."""
    json.dumps(bundle, allow_nan=False)
    if not isinstance(bundle, dict) or bundle.get("schema_version") != 1:
        raise ValueError("Invalid publication schema")
    daily, outlook = bundle["daily"], bundle["outlook"]
    if not isinstance(daily, dict) or not isinstance(outlook, dict):
        raise ValueError("Invalid forecast objects")
    forecast, source = daily["forecast"], daily["source"]
    base_daily = pipeline.read_json(pipeline.BUNDLED_PUBLIC)
    base_outlook = pipeline.read_json(pipeline.BUNDLED_PUBLIC.with_name("fpt-outlook.json"))
    if daily.get("schema_version") != 1 or outlook.get("schema_version") != 1:
        raise ValueError("Invalid forecast schema")
    if daily.get("symbol") != "FPT" or outlook.get("symbol") != "FPT":
        raise ValueError("Invalid published symbol")
    if daily["model"] != base_daily["model"] or forecast["model_id"] != daily["model"]["run_id"]:
        raise ValueError("Published daily model differs from shipped model")
    if outlook["run_id"] != base_outlook["run_id"]:
        raise ValueError("Published outlook model differs from shipped model")
    for key in ("symbol", "provider", "package", "package_version", "price_unit", "price_multiplier", "price_basis"):
        if source[key] != base_daily["source"][key]:
            raise ValueError("Published source differs from trained source")
    if source != outlook["source"] or not re.fullmatch(r"[0-9a-f]{64}", source["closes_sha256"]):
        raise ValueError("Published input sources disagree")
    cutoff = date.fromisoformat(source["last_date"])
    now = vietnam_now()
    if cutoff > now.date() or (cutoff == now.date() and now.hour < 16):
        raise ValueError("Published close is not a completed session")
    if source["last_date"] != forecast["observed_through"] or source["last_date"] != outlook["observed_through"]:
        raise ValueError("Published dates disagree")
    if outlook["last_close"] != forecast["last_close"]:
        raise ValueError("Published reference prices disagree")
    positive(forecast["last_close"])
    if source["last_date"] < max(base_daily["source"]["last_date"], base_outlook["source"]["last_date"]):
        raise ValueError("Published source predates shipped snapshot")
    issued = timestamp(bundle["published_at"])
    retrieved = timestamp(source["retrieved_at"])
    if retrieved > issued or issued > now:
        raise ValueError("Invalid publication time")
    if previous:
        prior = previous["daily"]["source"]
        if source["last_date"] < prior["last_date"] or retrieved < timestamp(prior["retrieved_at"]) or issued < timestamp(previous["published_at"]):
            raise ValueError("Refusing an older publication")
    history = daily["history"]
    if not history or history[-1] != {"date": source["last_date"], "close": forecast["last_close"]}:
        raise ValueError("Published history does not end at reference close")
    dates = [date.fromisoformat(row["date"]) for row in history]
    if any(a >= b for a, b in zip(dates, dates[1:])):
        raise ValueError("Published history is not chronological")
    for row in history:
        positive(row["close"])
    if [(h["months"], h["sessions"]) for h in outlook["horizons"]] != [(1, 21), (3, 63), (6, 126)]:
        raise ValueError("Incomplete published outlook")
    dynamic = {"predicted_close", "predicted_return_pct", "direction"}
    for item, reference in zip(outlook["horizons"], base_outlook["horizons"]):
        if {k: v for k, v in item.items() if k not in dynamic} != {k: v for k, v in reference.items() if k not in dynamic}:
            raise ValueError("Published outlook evaluation differs from shipped model")
    for prediction in [forecast, *outlook["horizons"]]:
        positive(prediction["predicted_close"])
        change = prediction["predicted_return_pct"]
        if not math.isclose(prediction["predicted_close"], forecast["last_close"] * (1 + change / 100), rel_tol=1e-8):
            raise ValueError("Published price and return disagree")
        if prediction["direction"] != ("up" if change > 0 else "down" if change < 0 else "flat"):
            raise ValueError("Published direction disagrees with return")
    if not isinstance(bundle["ledger"], list) or bundle["ledger"][-20:] != daily["ledger"]:
        raise ValueError("Published ledger mismatch")
    return bundle


def download():
    request = Request(URL, headers={"User-Agent": "Sequence-FPT/1", "Cache-Control": "no-cache"})
    with urlopen(request, timeout=3) as response:
        raw = response.read(MAX_BYTES + 1)
    if len(raw) > MAX_BYTES:
        raise ValueError("Publication exceeds size limit")
    return json.loads(raw)


def read():
    global _cache, _attempt
    if not enabled():
        return None
    with _lock:
        if _cache is None:
            for path in (bundled_path(), cache_path()):
                if path.exists():
                    try:
                        _cache = validate(pipeline.read_json(path), _cache)
                    except Exception as error:
                        print(f"FPT saved publication rejected: {type(error).__name__}", flush=True)
        now = time.monotonic()
        if _attempt is None or now - _attempt >= TTL:
            _attempt = now
            try:
                candidate = validate(download(), _cache)
                if candidate != _cache:
                    pipeline.write_json(cache_path(), candidate)
                    _cache = candidate
                    print(f"FPT publication loaded: {candidate['daily']['source']['last_date']}", flush=True)
            except Exception as error:
                # Never log provider bodies or environment values.
                print(f"FPT publication unavailable; retaining saved data: {type(error).__name__}", flush=True)
        return copy.deepcopy(_cache)
