#!/usr/bin/env python3
"""shici-hub sync backend.

Serves the static app plus a tiny state API so learning progress is stored on
the server instead of each device's browser localStorage. Every device talks to
the same JSON document; last-writer-wins with an optional optimistic lock.

Endpoints:
  GET    /api/health   -> {"ok": true}
  GET    /api/state    -> 200 {"state": {...}, "rev": N, "savedAt": iso8601}
                          404 when no state has been saved yet
  PUT    /api/state    -> body is either the state object itself or an envelope
                          {"baseRev": n|null, "state": {...}}.
                          200 {"ok": true, "rev": N+1, "savedAt": iso8601}
                          409 when baseRev does not match the current rev
                          401 when SHICI_SHARED_SECRET is set and the request's
                              X-Shici-Secret header is missing or wrong
                          400 on invalid JSON / non-object state / oversize body /
                              malformed Content-Length
  DELETE /api/state    -> {"ok": true} (idempotent)

Storage: one JSON envelope file inside --data-dir, written atomically
(tempfile + os.replace). Single process; a threading.Lock guards read-modify-write.
Corruption quarantine and structural validation happen under that same lock so a
concurrent writer can never rename away a document another thread just ACKed.

Security model: bind to the Tailscale IP by default so the port is unreachable
from outside the tailnet (traffic is WireGuard-encrypted end-to-end). There is no
user system; an optional shared secret guards the mutating endpoints:
  SHICI_SHARED_SECRET=...   -> PUT/DELETE /api/state require a matching
                               X-Shici-Secret header.
When the secret is unset, mutations stay allowed for compatibility and main()
prints a loud startup warning instead - rely on tailnet-only binding only when you
accept that any host in the tailnet can overwrite or delete shared state. Do NOT
expose this server publicly / via funnel either way.

Static files: served from SHICI_APP_ROOT, defaulting to the directory containing
this file (never the process cwd). Any request whose resolved path - after
symlink resolution and '..' collapsing - escapes that root is rejected with 403.
"""
import argparse
import hmac
import json
import os
import subprocess
import sys
import tempfile
import threading
from datetime import datetime, timezone
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import unquote, urlsplit

MAX_BODY_BYTES = 2 * 1024 * 1024  # state blobs are small; vocab files never pass through the API
API_PREFIXES = ("/api/state", "/api/health")
AUTH_HEADER = "X-Shici-Secret"
DEFAULT_APP_ROOT = os.path.dirname(os.path.abspath(__file__))


def now_iso():
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


class Store:
    """Single-document JSON store with a monotonic revision counter.

    Every state transition - including quarantining corrupt files - happens under
    self.lock so a concurrent reader can never rename away a document that another
    thread has already written and acknowledged.
    """

    def __init__(self, data_dir):
        self.path = os.path.join(data_dir, "state.json")
        self.data_dir = data_dir
        self.lock = threading.Lock()
        os.makedirs(data_dir, exist_ok=True)

    def read(self):
        """Return (envelope|None). envelope: {"rev": int, "savedAt": str, "state": dict}"""
        with self.lock:
            return self._read_unlocked()

    def _read_unlocked(self):
        """Same as read(); the caller must already hold self.lock."""
        try:
            with open(self.path, "r", encoding="utf-8") as fh:
                data = json.load(fh)
        except FileNotFoundError:
            return None
        except (json.JSONDecodeError, OSError):
            # Corrupt file: preserve it for inspection but treat the store as empty so
            # the app can recover by pushing fresh state. The rename happens under the
            # lock so a writer cannot swap in a fresh document between our parse and
            # our quarantine (which would lose an already-ACKed revision).
            self._quarantine()
            return None
        if not isinstance(data, dict) or "state" not in data:
            # Valid JSON but not an envelope (e.g. junk left by another tool):
            # quarantining it stops every boot from silently restarting at rev 1
            # while the garbage file stays on disk forever.
            self._quarantine()
            return None
        state = data["state"]
        if not isinstance(state, dict) or isinstance(state, list):
            self._quarantine()
            return None
        try:
            rev = int(data.get("rev", 0))
        except (TypeError, ValueError):
            rev = 0  # defensive: a broken counter must never crash the API
        return {"rev": rev, "savedAt": str(data.get("savedAt", "")), "state": state}

    def _quarantine(self):
        try:
            os.replace(self.path, self.path + ".corrupt-" + datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ"))
        except OSError:
            pass

    def write(self, state, base_rev=None):
        """Atomically persist state. Returns (envelope, conflict)."""
        with self.lock:
            current = self._read_unlocked()
            cur_rev = current["rev"] if current else 0
            if base_rev is not None and int(base_rev) != cur_rev:
                return None, True
            envelope = {"rev": cur_rev + 1, "savedAt": now_iso(), "state": state}
            fd, tmp_path = tempfile.mkstemp(dir=self.data_dir, prefix=".state-", suffix=".tmp")
            try:
                with os.fdopen(fd, "w", encoding="utf-8") as fh:
                    json.dump(envelope, fh, ensure_ascii=False)
                    fh.flush()
                    os.fsync(fh.fileno())
                os.replace(tmp_path, self.path)
            except BaseException:
                try:
                    os.unlink(tmp_path)
                except OSError:
                    pass
                raise
            return envelope, False

    def delete(self):
        with self.lock:
            try:
                os.remove(self.path)
            except FileNotFoundError:
                pass


def app_root():
    """Directory served for static files (SHICI_APP_ROOT or this file's directory)."""
    return os.environ.get("SHICI_APP_ROOT") or DEFAULT_APP_ROOT


class Handler(SimpleHTTPRequestHandler):
    store: "Store | None" = None  # set in main()

    def __init__(self, *args, **kwargs):
        kwargs.setdefault("directory", app_root())
        super().__init__(*args, **kwargs)

    # -- helpers -----------------------------------------------------------
    def send_json(self, code, payload):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def _parse_content_length(self):
        """Return (length, ok). Missing header means an empty body; malformed or
        negative values are reported as errors instead of raising."""
        raw = self.headers.get("Content-Length")
        if raw is None:
            return 0, True
        try:
            length = int(raw)
        except ValueError:
            return 0, False
        if length < 0:
            return 0, False
        return length, True

    def _drain_body_or_close(self):
        """Consume an unread request body so keep-alive framing stays in sync. When the
        declared size is untrusted (malformed or oversize) we cannot drain safely, so
        mark the connection for closing after our reply instead."""
        length, ok = self._parse_content_length()
        if not ok:
            self.close_connection = True
            return
        if 0 < length <= MAX_BODY_BYTES:
            try:
                self.rfile.read(length)
            except OSError:
                self.close_connection = True

    def read_json_body(self):
        length, ok = self._parse_content_length()
        if not ok:
            # Malformed Content-Length: we cannot know how much body is coming, so
            # reply and close the connection rather than desync a keep-alive stream.
            self.close_connection = True
            return None, "invalid Content-Length header"
        if length > MAX_BODY_BYTES:
            # Do not read oversize uploads; reply 400 and drop the socket (the client
            # may still be sending bytes, so a mid-upload reset is possible).
            self.close_connection = True
            return None, f"body exceeds max size {MAX_BODY_BYTES} bytes"
        try:
            raw = self.rfile.read(length) if length else b""
        except OSError:
            self.close_connection = True
            return None, "failed to read request body"
        try:
            data = json.loads(raw.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            return None, "request body is not valid JSON"
        base_rev, state = None, data
        if isinstance(data, dict) and "state" in data:
            if "baseRev" in data:
                try:
                    base_rev = int(data["baseRev"]) if data["baseRev"] is not None else None
                except (TypeError, ValueError):
                    return None, "baseRev must be an integer or null"
            state = data["state"]
        if not isinstance(state, dict) or isinstance(state, list):
            return None, "state must be a JSON object"
        return {"base_rev": base_rev, "state": state}, None

    def _authorized(self):
        """Mutating endpoints are gated by an optional shared secret.

        Design (see deployment notes in the README and startup logs): when
        SHICI_SHARED_SECRET is set, PUT/DELETE /api/state require a matching
        X-Shici-Secret header; GETs stay open because the app must be able to load
        state on every page load without credentials. When unset, mutations remain
        allowed for compatibility - main() prints a loud startup warning instead,
        since this server has no user system and is meant to sit behind tailnet-only
        binding rather than the public internet.
        """
        secret = os.environ.get("SHICI_SHARED_SECRET")
        if not secret:
            return True
        provided = self.headers.get(AUTH_HEADER) or ""
        return hmac.compare_digest(provided.encode("utf-8"), secret.encode("utf-8"))

    def _static_allowed(self):
        """Reject requests whose resolved path escapes the app root (symlinks, '..')."""
        try:
            root = os.path.realpath(app_root())
            words = [w for w in unquote(urlsplit(self.path).path).split("/") if w]
            candidate = os.path.realpath(os.path.join(root, *words)) if words else root
        except (ValueError, UnicodeError, OSError):
            return False  # e.g. bad percent-encoding or an embedded NUL byte
        return candidate == root or candidate.startswith(root + os.sep)

    # -- API routes ----------------------------------------------------------
    def route_api(self, method):
        path = self.path.split("?", 1)[0]
        if path == "/api/health":
            if method in ("GET", "HEAD"):
                self.send_json(200, {"ok": True})
            else:
                self._drain_body_or_close()
                self.send_json(405, {"error": "method not allowed"})
            return True
        store = self.store
        if store is None:
            self._drain_body_or_close()
            self.send_json(503, {"error": "store not initialized"})
            return True
        if path == "/api/state":
            if method in ("GET", "HEAD"):
                envelope = store.read()
                if envelope is None:
                    self.send_json(404, {"error": "no state saved yet"})
                else:
                    self.send_json(200, envelope)
            elif method == "PUT":
                if not self._authorized():
                    self._drain_body_or_close()
                    self.send_json(401, {"error": "unauthorized"})
                    return True
                parsed, err = self.read_json_body()
                if err:
                    self.send_json(400, {"error": err})
                    return True
                envelope, conflict = store.write(parsed["state"], parsed["base_rev"])
                if conflict:
                    current = store.read()
                    self.send_json(409, {"error": "conflict", "rev": current["rev"] if current else 0})
                else:
                    self.send_json(200, {"ok": True, "rev": envelope["rev"], "savedAt": envelope["savedAt"]})
            elif method == "DELETE":
                if not self._authorized():
                    self._drain_body_or_close()
                    self.send_json(401, {"error": "unauthorized"})
                    return True
                store.delete()
                self.send_json(200, {"ok": True})
            else:
                self._drain_body_or_close()
                self.send_json(405, {"error": "method not allowed"})
            return True
        if path.startswith("/api/"):
            self._drain_body_or_close()
            self.send_json(404, {"error": "unknown api route"})
            return True
        return False

    # -- HTTP verbs ----------------------------------------------------------
    def do_GET(self):
        if self.route_api("GET"):
            return
        if not self._static_allowed():
            self.send_error(403)
            return
        super().do_GET()

    def do_HEAD(self):
        if self.route_api("HEAD"):
            return
        if not self._static_allowed():
            self.send_error(403)
            return
        super().do_HEAD()

    def do_PUT(self):
        if self.route_api("PUT"):
            return
        self._drain_body_or_close()
        self.send_json(405, {"error": "method not allowed"})

    def do_DELETE(self):
        if self.route_api("DELETE"):
            return
        self._drain_body_or_close()
        self.send_json(405, {"error": "method not allowed"})


def tailscale_ip():
    try:
        out = subprocess.check_output(["tailscale", "ip", "-4"], text=True, timeout=10).strip()
        if out:
            return out
    except Exception as exc:  # noqa: BLE001 - any failure falls back to localhost
        print(f"warning: could not determine Tailscale IP ({exc}); binding 127.0.0.1 instead", file=sys.stderr)
    return "127.0.0.1"


def main():
    parser = argparse.ArgumentParser(description="shici-hub sync backend")
    parser.add_argument("--bind", default=None, help="IP to bind (default: this node's Tailscale IP)")
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--data-dir", required=True, help="directory for state.json (use local disk, not network fs)")
    args = parser.parse_args()

    Handler.store = Store(args.data_dir)
    bind = args.bind or tailscale_ip()
    print(f"shici-hub backend: app root {app_root()}, data dir {args.data_dir}", flush=True)
    if os.environ.get("SHICI_SHARED_SECRET"):
        print(f"shared-secret auth enabled for PUT/DELETE /api/state (header {AUTH_HEADER})", flush=True)
    else:
        print(
            "warning: SHICI_SHARED_SECRET is not set - PUT/DELETE /api/state are UNAUTHENTICATED, "
            "any host on the tailnet can overwrite or delete shared state. Set it to enable auth.",
            file=sys.stderr,
            flush=True,
        )
    server = ThreadingHTTPServer((bind, args.port), Handler)
    server.daemon_threads = True
    print(f"listening on {bind}:{args.port} (tailnet only; do not expose publicly)", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
