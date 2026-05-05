"""Minimal Ollama HTTP mock for the smoke test.

Responds to the handful of endpoints StoryEngine actually calls:
  GET  /                - Ollama health probe (returns 200 plain text).
  GET  /api/tags        - Returns a fake model list.
  POST /api/generate    - Returns a canned story-detection JSON payload.
  POST /api/embeddings  - Returns a fixed-length zero embedding.

Stdlib-only so the Docker image stays tiny.
"""
import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

CANNED_STORIES = {
    "stories": [
        {
            "title": "Smoke Test Story",
            "summary": "A single canned story produced by the ollama-mock for end-to-end testing.",
            "start_time": 0.0,
            "end_time": 5.0,
            "confidence": 0.95,
        }
    ]
}

CANNED_GENERATE = {
    "model": "llama3.1:8b",
    "created_at": "2026-01-01T00:00:00Z",
    "response": json.dumps(CANNED_STORIES),
    "done": True,
}

CANNED_EMBEDDING = {"embedding": [0.0] * 768}

CANNED_TAGS = {
    "models": [
        {"name": "llama3.1:8b", "size": 1, "digest": "test"},
        {"name": "nomic-embed-text", "size": 1, "digest": "test"},
    ]
}


def _send_json(handler, status, payload):
    body = json.dumps(payload).encode()
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json")
    handler.send_header("Content-Length", str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)


def _send_text(handler, status, text):
    body = text.encode()
    handler.send_response(status)
    handler.send_header("Content-Type", "text/plain")
    handler.send_header("Content-Length", str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):  # noqa: N802 - stdlib API
        if self.path == "/":
            _send_text(self, 200, "Ollama is running")
            return
        if self.path == "/api/tags":
            _send_json(self, 200, CANNED_TAGS)
            return
        self.send_error(404)

    def do_POST(self):  # noqa: N802 - stdlib API
        # Drain the body so the client sees a clean response.
        length = int(self.headers.get("Content-Length", "0"))
        if length:
            self.rfile.read(length)
        if self.path == "/api/generate":
            _send_json(self, 200, CANNED_GENERATE)
            return
        if self.path == "/api/embeddings":
            _send_json(self, 200, CANNED_EMBEDDING)
            return
        self.send_error(404)

    def log_message(self, format, *args):  # noqa: A002 - stdlib API
        # Quiet logging to keep CI output readable.
        pass


def main():
    server = ThreadingHTTPServer(("0.0.0.0", 11434), Handler)
    print("ollama-mock listening on :11434", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
