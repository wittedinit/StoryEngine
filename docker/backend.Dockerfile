FROM python:3.12-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    curl \
    tini \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY backend/pyproject.toml .
RUN pip install --no-cache-dir ".[server]"

COPY backend/ .
RUN pip install --no-cache-dir -e .

RUN mkdir -p /work /segments /data/downloads /config

COPY docker/entrypoints/backend.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 8000

ENTRYPOINT ["tini", "--"]
CMD ["/entrypoint.sh"]
