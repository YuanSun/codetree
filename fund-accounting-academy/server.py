#!/usr/bin/env python3
"""Serve the Fund Accounting Academy (pure static files, no dependencies).

    python3 server.py                 # -> http://localhost:13000
    python3 server.py --host 0.0.0.0  # reachable from other devices on your network
"""
import argparse
import functools
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent


class Handler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-cache")  # edits show up on refresh
        super().end_headers()


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--host", default="127.0.0.1")
    ap.add_argument("--port", type=int, default=13000)
    args = ap.parse_args()
    handler = functools.partial(Handler, directory=str(ROOT))
    with ThreadingHTTPServer((args.host, args.port), handler) as srv:
        print(f"Fund Accounting Academy on http://{args.host}:{args.port}")
        try:
            srv.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == "__main__":
    main()
