"""Đọc/ghi JSON và dấu vân tay SHA-256 để đối chiếu đúng tệp."""

from pathlib import Path
import hashlib
import json


def save_json(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(value, indent=2, ensure_ascii=False, allow_nan=False),
        encoding="utf-8",
    )


def sha256(path):
    digest = hashlib.sha256()
    with open(path, "rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def archive_sources(root, source_dir, source_files):
    """Lưu mã thực thi cho lần chạy mới, gồm mọi module sau khi tách tệp.

    Hàm chỉ chạy sau huấn luyện, không đổi bản lưu của thí nghiệm cũ khi import.
    Hash từng module được ghi trong summary; file gốc vẫn có tên tương thích.
    """
    provenance = root / "results/provenance"
    provenance.mkdir(parents=True, exist_ok=True)
    for relative_path, expected_hash in source_files.items():
        source = root / relative_path
        assert sha256(source) == expected_hash, "Source changed during execution"
        snapshot = provenance / "source" / relative_path
        snapshot.parent.mkdir(parents=True, exist_ok=True)
        snapshot.write_bytes(source.read_bytes())
    (provenance / "executed_experiments.py").write_bytes(
        (source_dir / "experiments.py").read_bytes()
    )
