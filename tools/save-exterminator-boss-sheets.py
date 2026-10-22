"""Receive the offline browser baker's two sheets and write their shared manifest.

Run this localhost-only receiver before bossModelPreview.bake; see the art guide.
It exits after the requested uploads (both bosses by default) or ten minutes.
"""
import argparse
import base64
import json
import time
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "public/images/exterminator/bosses"
parser = argparse.ArgumentParser()
parser.add_argument("--variant", choices=("rhinoceros", "scorpion"))
args = parser.parse_args()
variants = (args.variant,) if args.variant else ("rhinoceros", "scorpion")
ALLOWED = {f"{variant}{suffix}" for variant in variants for suffix in (".png", "-hit.png", ".json")}
received = set()
manifests = {}


class Receiver(BaseHTTPRequestHandler):
    def do_POST(self):
        name = self.path.lstrip("/")
        size = int(self.headers.get("Content-Length", 0))
        if name not in ALLOWED or not 0 < size <= 30_000_000:
            self.send_error(400)
            return
        raw = self.rfile.read(size)
        try:
            if name.endswith(".json"):
                manifest = json.loads(raw)
                if manifest["directions"] != 16 or not manifest["frames"]:
                    raise ValueError("Incomplete sheet manifest")
                manifests[name[:-5]] = manifest
            else:
                data = base64.b64decode(raw.split(b",", 1)[1], validate=True)
                if not data.startswith(b"\x89PNG\r\n\x1a\n"):
                    raise ValueError("Expected PNG data")
                ASSETS.mkdir(parents=True, exist_ok=True)
                (ASSETS / name).write_bytes(data)
        except (ValueError, KeyError, IndexError):
            self.send_error(400)
            return
        received.add(name)
        if len(manifests) == len(variants):
            path = ROOT / "app/exterminator/boss-sheets.json"
            merged = json.loads(path.read_text()) if path.exists() else {}
            merged.update(manifests)
            path.write_text(json.dumps(merged, separators=(",", ":"), sort_keys=True) + "\n")
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(b"saved")
        print(f"Saved {name}", flush=True)


if __name__ == "__main__":
    deadline = time.monotonic() + 600
    with HTTPServer(("127.0.0.1", 3013), Receiver) as server:
        server.timeout = 1
        while len(received) < len(ALLOWED) and time.monotonic() < deadline:
            server.handle_request()
    if received != ALLOWED:
        raise SystemExit(f"Timed out; missing {sorted(ALLOWED - received)}")
