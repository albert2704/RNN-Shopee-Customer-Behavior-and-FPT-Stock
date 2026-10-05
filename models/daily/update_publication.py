"""Publish fresh FPT inference for GitHub Actions, without training any weights."""

import argparse
from pathlib import Path

from daily import pipeline, published
from daily.core import vietnam_now
from outlook import pipeline as outlook


def update(snapshot=None):
    pipeline.bootstrap()
    previous_path = published.bundled_path()
    previous = published.validate(pipeline.read_json(previous_path)) if previous_path.exists() else None
    if previous:
        # Restore the complete durable ledger, not just the public last 20 entries.
        pipeline.publish(previous["daily"], previous["ledger"])
    current = previous["daily"] if previous else pipeline.read_latest()
    if snapshot:
        frame, source = pipeline.load_snapshot(snapshot)
    else:
        frame, source, _ = pipeline.fetch_snapshot()
    if source["last_date"] < current["source"]["last_date"]:
        raise ValueError("Provider cutoff is older than the published data")
    if previous and source["closes_sha256"] == current["source"]["closes_sha256"]:
        print(f"No new FPT data; keeping {source['last_date']} publication.")
        return False
    daily, ledger = pipeline.make_forecast(frame, source)
    monthly = outlook.make_forecast(frame, source)
    bundle = {"schema_version": 1, "published_at": vietnam_now().isoformat(),
              "daily": daily, "outlook": monthly, "ledger": ledger}
    published.validate(bundle, previous)
    # All outputs are committed together by the workflow. The API reads only bundle.
    pipeline.write_json(pipeline.BUNDLED_PUBLIC, daily)
    pipeline.write_json(outlook.BUNDLED_PUBLIC, monthly)
    pipeline.write_json(previous_path, bundle)
    print(f"Published FPT close {daily['forecast']['last_close']:,.0f} VND through {source['last_date']}; frozen daily + 1/3/6 month models.")
    return True


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--snapshot", type=Path)
    update(parser.parse_args().snapshot)
