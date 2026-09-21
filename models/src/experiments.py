#!/usr/bin/env python3
"""Điểm chạy A6 và lớp tương thích cho notebook.

Chạy: python src/experiments.py
Chỉ kiểm tra, không ghi: python src/experiments.py --verify-only --no-write

Các phép tính nằm trong module nhỏ theo từng bước. Mỗi lời gọi truyền
ROOT/CONFIG hiện tại xuống module con để notebook và kiểm chứng dùng
cùng cấu hình và đường dẫn.
"""

from __future__ import annotations

import os
from pathlib import Path
import sys

# Đặt trước khi import NumPy/PyTorch, như phiên bản thí nghiệm gốc.
os.environ.setdefault("OMP_NUM_THREADS", "2")
os.environ.setdefault("MKL_NUM_THREADS", "2")
os.environ.setdefault("MPLCONFIGDIR", "/tmp/a6-matplotlib")

# Hỗ trợ importlib.spec_from_file_location ở mọi thư mục chạy.
SOURCE_DIR = Path(__file__).resolve().parent
if str(SOURCE_DIR) not in sys.path:
    sys.path.insert(0, str(SOURCE_DIR))

import argparse
import json
import platform
import numpy as np
import pandas as pd
import torch

from config import CONFIG as _DEFAULT_CONFIG
from io_utils import save_json, sha256, archive_sources
from models import RecurrentForecaster
from evaluation import predict, original_units, metrics
import preprocessing as _data
import training as _training
import evaluation as _evaluation
import plots as _plots
import verification as _verification

ROOT = SOURCE_DIR.parent
CONFIG = dict(_DEFAULT_CONFIG)
__all__ = [
    "ROOT",
    "CONFIG",
    "RecurrentForecaster",
    "predict",
    "original_units",
    "metrics",
    "save_json",
    "sha256",
    "set_seed",
    "prepare_retailrocket",
    "prepare_amazon",
    "prepare_data",
    "fit_model",
    "evaluate",
    "plot_dataset",
    "verify_saved_outputs",
    "main",
]


def set_seed(seed=42):
    return _training.set_seed(seed, config=CONFIG)


def prepare_retailrocket():
    return _data.prepare_retailrocket(root=ROOT)


def prepare_amazon():
    return _data.prepare_amazon(root=ROOT)


def prepare_data(name):
    return _data.prepare_data(name, root=ROOT)


def fit_model(name, kind, arrays, meta):
    return _training.fit_model(name, kind, arrays, meta, root=ROOT, config=CONFIG)


def evaluate(name, frame, arrays, meta):
    return _evaluation.evaluate(
        name, frame, arrays, meta, root=ROOT, fit_model=fit_model
    )


def plot_dataset(name, frame, meta):
    return _plots.plot_dataset(name, frame, meta, root=ROOT)


def verify_saved_outputs(summary, *, write_output=True):
    return _verification.verify_saved_outputs(
        summary, root=ROOT, write_output=write_output
    )


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--dataset", choices=["all", "retailrocket", "amazon"], default="all"
    )
    parser.add_argument("--verify-only", action="store_true")
    parser.add_argument(
        "--no-write",
        action="store_true",
        help="Dùng với --verify-only để giữ nguyên JSON kiểm chứng lịch sử.",
    )
    args = parser.parse_args()
    if args.no_write and not args.verify_only:
        parser.error("--no-write chỉ dùng cùng --verify-only")
    result_path = ROOT / "results/summary.json"
    if args.verify_only:
        result = verify_saved_outputs(
            json.loads(result_path.read_text()), write_output=not args.no_write
        )
        print(json.dumps(result, indent=2))
        return

    set_seed()
    (ROOT / "results").mkdir(parents=True, exist_ok=True)
    source_files = {
        str(path.relative_to(ROOT)): sha256(path)
        for path in sorted(SOURCE_DIR.glob("*.py"))
    }
    summary = dict(
        config=CONFIG,
        created_at_utc=pd.Timestamp.now(tz="UTC").isoformat(),
        environment=dict(
            python=sys.version,
            executable=sys.executable,
            platform=platform.platform(),
            numpy=np.__version__,
            pandas=pd.__version__,
            torch=torch.__version__,
            device="cpu",
        ),
        source_file="src/experiments.py",
        source_sha256=sha256(__file__),
        source_files=source_files,
        datasets={},
    )
    if result_path.exists() and args.dataset != "all":
        summary["datasets"] = json.loads(result_path.read_text()).get("datasets", {})
    names = ["retailrocket", "amazon"] if args.dataset == "all" else [args.dataset]
    for name in names:
        frame, arrays, meta = prepare_data(name)
        meta["models"] = evaluate(name, frame, arrays, meta)
        # Ghi rõ các module của bộ dữ liệu được huấn luyện trong lần chạy này.
        meta["source_files"] = source_files
        summary["datasets"][name] = meta
        save_json(result_path, summary)
        save_json(ROOT / "results" / name / "manifest.json", meta)
        plot_dataset(name, frame, meta)
        print(
            json.dumps(
                {name: {k: v["metrics"]["test"] for k, v in meta["models"].items()}},
                indent=2,
            ),
            flush=True,
        )
    summary["verification"] = verify_saved_outputs(summary)
    save_json(result_path, summary)
    archive_sources(ROOT, SOURCE_DIR, source_files)
    print("All experiments and saved-output checks completed.", flush=True)


if __name__ == "__main__":
    main()
