FROM python:3.12-alpine

WORKDIR /app
COPY docker/ollama-mock/server.py /app/server.py

EXPOSE 11434

HEALTHCHECK --interval=5s --timeout=3s --retries=5 \
    CMD wget --quiet --tries=1 --spider http://127.0.0.1:11434/ || exit 1

CMD ["python", "/app/server.py"]
