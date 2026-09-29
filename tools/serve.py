#!/usr/bin/env python3
"""Local dev server for the Lounge: static files with caching disabled, so edits to
ES modules show up on reload. Usage: python3 tools/serve.py [port]  (default 8420)

Dev-only extra: POST /__capture?name=<slug> with an image body saves it to docs/shots/<slug>.jpg —
used to grab renders for the README and concept board (see docs/CAPTURES.md). Binds to 127.0.0.1 only."""

import http.server
import os
import re
import sys
from functools import partial
from urllib.parse import parse_qs, urlparse

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


class NoCache(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map, ".js": "text/javascript", ".json": "application/json"}

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_POST(self):
        url = urlparse(self.path)
        if url.path != "/__capture":
            self.send_error(404)
            return
        name = re.sub(r"[^a-z0-9-]", "", (parse_qs(url.query).get("name") or ["shot"])[0].lower())[:60] or "shot"
        length = int(self.headers.get("Content-Length", 0))
        if length <= 0 or length > 20_000_000:
            self.send_error(400)
            return
        out_dir = os.path.join(ROOT, "docs", "shots")
        os.makedirs(out_dir, exist_ok=True)
        path = os.path.join(out_dir, f"{name}.jpg")
        with open(path, "wb") as f:
            f.write(self.rfile.read(length))
        self.send_response(200)
        self.end_headers()
        self.wfile.write(path.encode())

    def log_message(self, fmt, *args):
        if "404" in (args[1] if len(args) > 1 else ""):
            super().log_message(fmt, *args)


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8420
    handler = partial(NoCache, directory=ROOT)
    with http.server.ThreadingHTTPServer(("127.0.0.1", port), handler) as httpd:
        print(f"The Lounge is open at http://localhost:{port}")
        httpd.serve_forever()
