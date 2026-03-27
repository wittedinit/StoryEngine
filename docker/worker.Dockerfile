FROM python:3.12-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    curl \
    tini \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY backend/pyproject.toml .
RUN pip install --no-cache-dir ".[worker]"

COPY backend/ .
RUN pip install --no-cache-dir -e .

RUN mkdir -p /work/audio /segments /data/usearch /config

ENTRYPOINT ["tini", "--"]
CMD ["sh", "-c", "celery -A app.celery_app:celery worker -Q scan,pipeline --concurrency=${SE_WORKER_CONCURRENCY:-2} --loglevel=info & celery -A app.celery_app:celery worker -Q gpu --concurrency=1 --loglevel=info & celery -A app.celery_app:celery worker -Q llm --concurrency=2 --loglevel=info & wait"]
