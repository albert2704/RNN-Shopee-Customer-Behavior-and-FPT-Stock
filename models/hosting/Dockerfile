FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 OMP_NUM_THREADS=2 MKL_NUM_THREADS=2 \
    VNSTOCK_TELEMETRY=off VNSTOCK_DISABLE_AGENT_SETUP=1 \
    VNSTOCK_DISABLE_GLOBAL_AGENT=1
WORKDIR /app/models

# Install the CPU wheel first to avoid downloading CUDA dependencies on Linux.
COPY models/daily/requirements.txt daily/requirements.txt
COPY models/chat/requirements.txt chat/requirements.txt
RUN pip install --index-url https://download.pytorch.org/whl/cpu torch==2.14.1 \
    && pip install -r chat/requirements.txt

COPY models/src src
COPY models/daily daily
COPY models/outlook outlook
COPY models/chat chat
COPY models/hosting hosting
COPY website/public/data/fpt-daily.json /app/website/public/data/fpt-daily.json
COPY website/public/data/fpt-outlook.json /app/website/public/data/fpt-outlook.json
COPY website/public/data/fpt-published.json /app/website/public/data/fpt-published.json

EXPOSE 10000
CMD ["python", "-m", "hosting.start"]
