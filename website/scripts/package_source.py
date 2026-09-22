#!/usr/bin/env python3
"""Đóng gói models/ và website/: mã nguồn, dữ liệu tổng hợp và checkpoint."""

from pathlib import Path, PurePosixPath
import hashlib
import json
import zipfile

WEBSITE = Path(__file__).resolve().parents[1]
PROJECT = WEBSITE.parent
OUT = WEBSITE / "public/downloads/a6-rnn-source.zip"
PREFIX = "a6-rnn-source/"


def build():
    # Chỉ lấy tệp cần để đọc, chạy và tái lập hai bộ dữ liệu; không gom cả workspace.
    files = [
        "README.md",
        ".gitignore",
        "models/README.md",
        "models/CODE_MAP_VI.md",
        "models/requirements.txt",
        "models/scripts/independent_audit.py",
        "models/scripts/download_data.py",
        "models/data/source_manifest.json",
        "models/results/summary.json",
        "models/results/verification.json",
        "models/results/independent_audit.json",
        "models/results/toy_rnn.json",
        "website/package.json",
        "website/package-lock.json",
        "website/tsconfig.json",
        "website/vite.config.ts",
        "website/index.html",
        "website/README.md",
        "website/PRESENTATION_GUIDE.md",
        "website/DEMO_BRIEFING_VI.md",
        "website/.prettierrc.json",
        "website/.gitignore",
        "website/public/favicon.svg",
        "website/public/data/demo.json",
        "website/public/data/retailrocket.json",
        "website/public/data/amazon.json",
        "website/public/downloads/guide-trinh-bay.md",
        "website/public/downloads/demo-briefing-vi.md",
    ]
    for folder, suffixes in [
        ("models/src", {".py"}),
        ("models/results/provenance", {".py", ".json"}),
        ("models/data/processed", {".csv", ".npz"}),
        ("models/checkpoints", {".pt"}),
        ("models/results/retailrocket", {".csv", ".json"}),
        ("models/results/amazon", {".csv", ".json"}),
        ("website/src", {".ts", ".tsx", ".css"}),
        ("website/scripts", {".py", ".mjs"}),
        ("website/public/fonts", {".ttf", ".txt"}),
    ]:
        files.extend(
            str(path.relative_to(PROJECT))
            for path in sorted((PROJECT / folder).rglob("*"))
            if path.is_file()
            and path.suffix in suffixes
            and "__pycache__" not in path.parts
        )
    contents = {name: (PROJECT / name).read_bytes() for name in files}
    # Giữ số liệu thí nghiệm; bỏ đường dẫn môi trường riêng của máy tác giả.
    summary_path = "models/results/summary.json"
    summary = json.loads(contents[summary_path])
    summary.get("environment", {}).pop("executable", None)
    contents[summary_path] = json.dumps(
        summary, indent=2, ensure_ascii=False
    ).encode()
    manifest = {
        "description": "RNN Lab: models and website; aggregate results, no raw data",
        "files": [
            {"path": path, "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()}
            for path, data in sorted(contents.items())
        ],
    }
    contents["PACKAGE_MANIFEST.json"] = json.dumps(
        manifest, indent=2, ensure_ascii=False
    ).encode()
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for path, data in sorted(contents.items()):
            name = PREFIX + path
            assert (
                not PurePosixPath(name).is_absolute()
                and ".." not in PurePosixPath(name).parts
            )
            info = zipfile.ZipInfo(name, date_time=(2026, 9, 28, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            archive.writestr(info, data, compresslevel=9)
    with zipfile.ZipFile(OUT) as archive:
        assert archive.testzip() is None
        assert len(archive.namelist()) == len(contents)
        for path in archive.namelist():
            parts = PurePosixPath(path).parts
            assert "raw" not in parts and "node_modules" not in parts, path
            assert not path.endswith((".pdf", ".docx", ".ipynb")), path
            assert parts[1] in {"README.md", ".gitignore", "PACKAGE_MANIFEST.json", "models", "website"}, path
        for item in manifest["files"]:
            assert (
                hashlib.sha256(archive.read(PREFIX + item["path"])).hexdigest()
                == item["sha256"]
            )
        for name in archive.namelist():
            if name.endswith((".py", ".json", ".md", ".txt")):
                value = archive.read(name).decode()
                private_prefix = "/" + "Users" + "/"
                private_account = "viet" + "nhq"
                assert private_prefix not in value and private_account not in value, name
    assert OUT.stat().st_size < 10_000_000
    print(
        json.dumps(
            {
                "file": str(OUT),
                "bytes": OUT.stat().st_size,
                "entries": len(contents),
                "status": "archive integrity and privacy allowlist passed",
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    build()
