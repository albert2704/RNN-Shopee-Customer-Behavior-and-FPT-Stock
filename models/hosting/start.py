"""Bootstrap shipped weights on the mounted disk, then serve one API worker."""

import os


def main():
    from .security import settings
    settings()  # Fail before startup if production admission settings are absent.
    import torch
    torch.set_num_threads(2)
    from daily import pipeline
    from outlook import pipeline as outlook
    pipeline.bootstrap()
    pipeline.load_active()
    result = outlook.read_latest()
    folder, manifest = outlook.load_run(result["run_id"])
    for horizon, item in manifest["horizons"].items():
        outlook.load_model(folder, item, int(horizon))
    import uvicorn
    uvicorn.run("daily.api:app", host="0.0.0.0",
                port=int(os.environ.get("PORT", "10000")), workers=1,
                proxy_headers=False, access_log=False)


if __name__ == "__main__":
    main()
