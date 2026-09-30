#!/usr/bin/env python3
"""Local dev server for the Lounge: static files with caching disabled, so edits to
ES modules show up on reload. Usage: python3 tools/serve.py [port]  (default 8420)

Dev-only extra: POST /__capture?name=<slug>[&dir=shots|lightmaps/<time>][&ext=jpg|webp|png|json]
saves the body to docs/shots/ (render stills, see docs/CAPTURES.md) or assets/lightmaps/
(baked light, see tools/bake.html). Binds to 127.0.0.1 only."""

import http.server
import os
import re
import sys
from functools import partial
from urllib.parse import parse_qs, urlparse

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


class NoCache(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map, ".js": "text/javascript", ".json": "application/json", ".webp": "image/webp"}

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_POST(self):
        url = urlparse(self.path)
        if url.path != "/__capture":
            self.send_error(404)
            return
        q = parse_qs(url.query)
        name = re.sub(r"[^a-z0-9-]", "", (q.get("name") or ["shot"])[0].lower())[:60] or "shot"
        ext = (q.get("ext") or ["jpg"])[0].lower()
        if ext not in {"jpg", "webp", "png", "json"}:
            self.send_error(400)
            return
        # Only two destinations: render stills for the docs, and baked lightmaps for the site.
        where = (q.get("dir") or ["shots"])[0]
        m = re.fullmatch(r"lightmaps(?:/(morning|golden|evening))?", where)
        if where == "shots":
            out_dir = os.path.join(ROOT, "docs", "shots")
        elif m:
            out_dir = os.path.join(ROOT, "assets", "lightmaps", *( [m.group(1)] if m.group(1) else [] ))
        else:
            self.send_error(400)
            return
        length = int(self.headers.get("Content-Length", 0))
        if length <= 0 or length > 20_000_000:
            self.send_error(400)
            return
        os.makedirs(out_dir, exist_ok=True)
        path = os.path.join(out_dir, f"{name}.{ext}")
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
