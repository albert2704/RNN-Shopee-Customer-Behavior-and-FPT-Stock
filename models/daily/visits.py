"""One background refresh shared by visitors; no timer or scheduled work."""

import threading
import time

from . import pipeline
from .core import vietnam_now

_lock = threading.Lock()
refresh_lock = threading.Lock()
_state = {"state": "idle", "checked_at": None}
_attempt = None
_period = None
REUSE_SECONDS = 300


def status():
    with _lock:
        return dict(_state)


def _run():
    global _state
    try:
        with refresh_lock:
            result = pipeline.refresh()
        state = {"state": "ready", "checked_at": vietnam_now().isoformat(),
                 "observed_through": result["forecast"]["observed_through"]}
    except Exception as error:
        # Never expose provider response bodies or secrets in diagnostics.
        print(f"Visit refresh failed: {type(error).__name__}", flush=True)
        state = {"state": "failed", "checked_at": vietnam_now().isoformat()}
    with _lock:
        _state = state


def start():
    global _state, _attempt, _period
    now = vietnam_now()
    period = (now.date(), now.hour >= 16)
    with _lock:
        if _state["state"] == "refreshing":
            return dict(_state)
        if _attempt is not None and _period == period and time.monotonic() - _attempt < REUSE_SECONDS:
            return dict(_state)
        _attempt, _period = time.monotonic(), period
        _state = {"state": "refreshing", "checked_at": None}
        threading.Thread(target=_run, daemon=True, name="fpt-visit-refresh").start()
        return dict(_state)
