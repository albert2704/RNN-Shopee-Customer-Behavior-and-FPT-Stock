#!/usr/bin/env python3
"""Download the named public Kaggle CSV files and verify snapshot hashes."""
from pathlib import Path
import argparse
import hashlib
import io
import urllib.request
import zipfile

ROOT = Path(__file__).resolve().parents[1]
DATASETS = {'shopee': [('hninshwezinhlaing/shopee-th-customer-journey-and-operations-dataset', 'shopee_orders_thailand.csv', 'data/raw/shopee_orders_thailand.csv', '78c96592defc22244c90fd5a290e5320c35d0c6fd97b34b26edf3dea9f32a9e2'), ('hninshwezinhlaing/shopee-th-customer-journey-and-operations-dataset', 'shopee_website_sessions_thailand.csv', 'data/raw/shopee_website_sessions_thailand.csv', 'bd38474aa4fd81896ff3007d4f54395633015336b120329585337cd1425fd76d'), ('hninshwezinhlaing/shopee-th-customer-journey-and-operations-dataset', 'shopee_session_activities_thailand.csv', 'data/raw/shopee_session_activities_thailand.csv', '6a79c6bb47a5dffc4120fa3ac7c2cdeb5e25be7f093caded6f8ccafd9435bece')], 'fpt': [('thangtranquang/stock-vn30-vietnam', 'FPT.csv', 'data/raw/FPT.csv', 'd37b285ba68dc25e9020558e968aac3b2a1db1b0412ca31066269c483382d1bc')]}
sha = lambda data: hashlib.sha256(data).hexdigest()

def download_file(name, entry):
    slug, filename, relative, expected = entry
    target = ROOT / relative
    if target.exists():
        if sha(target.read_bytes()) != expected:
            raise RuntimeError(f"{relative} exists with an unexpected hash; refusing to overwrite.")
        print(f"Verified existing {relative}")
        return
    url = f"https://www.kaggle.com/api/v1/datasets/download/{slug}/{filename}"
    url += "?datasetVersionNumber=1"
    print(f"Downloading {name} from {url}")
    request = urllib.request.Request(url, headers={"User-Agent": "RNN-Lab-educational-download/1.0"})
    with urllib.request.urlopen(request, timeout=180) as response:
        payload = response.read()
    if zipfile.is_zipfile(io.BytesIO(payload)):
        with zipfile.ZipFile(io.BytesIO(payload)) as archive:
            matches = [n for n in archive.namelist() if n == filename]
            if len(matches) != 1:
                raise RuntimeError(f"Archive does not contain the expected exact filename {filename}.")
            payload = archive.read(filename)  # Do not extract arbitrary archive paths.
    if sha(payload) != expected:
        raise RuntimeError(f"Snapshot checksum differs for {name}. No file saved. See README for the required version.")
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(payload)
    print(f"Saved verified {relative} ({len(payload):,} bytes)")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dataset", choices=["all", *DATASETS], default="all")
    args = parser.parse_args()
    for name in DATASETS if args.dataset == "all" else [args.dataset]:
        for entry in DATASETS[name]:
            download_file(name, entry)
