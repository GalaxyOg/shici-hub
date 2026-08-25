#!/usr/bin/env python3
"""API + storage tests for the shici-hub sync backend (server.py).

Starts a real ThreadingHTTPServer on an ephemeral port with a temp data dir,
then exercises every endpoint including edge cases and concurrent writes.

Run:  python3 tests/api_test.py
"""
import json
import os
import shutil
import socket
import types
import sys
import tempfile
import threading
import time
import unittest
import urllib.error
import urllib.request
from typing import Any

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import server  # noqa: E402


def http(method: str, url: str, body=None, headers=None) -> tuple[int, Any]:
    """Returns (status_code, parsed_json_or_text)."""
    data = None
    extra_headers = dict(headers or {})
    if body is not None:
        if isinstance(body, (dict, list)):
            data = json.dumps(body).encode("utf-8")
            extra_headers.setdefault("Content-Type", "application/json")
        else:
            data = body.encode("utf-8")
    req = urllib.request.Request(url, data=data, method=method, headers=extra_headers)
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            raw = resp.read()
            return resp.status, json.loads(raw.decode("utf-8")) if raw else None
    except urllib.error.HTTPError as err:
        raw = err.read()
        try:
            parsed = json.loads(raw.decode("utf-8")) if raw else None
        except json.JSONDecodeError:
            parsed = raw.decode("utf-8", errors="replace")
        return err.code, parsed


class BackendTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.app_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
        os.environ["SHICI_APP_ROOT"] = cls.app_root
        cls.data_dir = tempfile.mkdtemp(prefix="shici-hub-test-")
        cls.store = server.Store(cls.data_dir)
        server.Handler.store = cls.store
        cls.server = server.ThreadingHTTPServer(("127.0.0.1", 0), server.Handler)
        port = cls.server.server_address[1]
        threading.Thread(target=cls.server.serve_forever, daemon=True).start()
        cls.base = f"http://127.0.0.1:{port}"

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        shutil.rmtree(cls.data_dir, ignore_errors=True)

    def setUp(self):
        self.store.delete()  # fresh store per test

    STATE_V1 = {"dailyGoal": 20, "decks": ["IELTS"], "records": {"alpha": {"stage": 1}}}
    STATE_V2 = {"dailyGoal": 30, "decks": ["GRE"], "records": {"beta": {"stage": 2}, "alpha": {"stage": 2}}}

    # -- health -----------------------------------------------------------
    def test_health(self):
        status, body = http("GET", self.base + "/api/health")
        self.assertEqual(status, 200)
        self.assertTrue(body["ok"])

    # -- state lifecycle ----------------------------------------------------
    def test_get_before_any_save_is_404(self):
        status, _ = http("GET", self.base + "/api/state")
        self.assertEqual(status, 404)

    def test_put_then_get_roundtrip(self):
        status, body = http("PUT", self.base + "/api/state", {"baseRev": None, "state": self.STATE_V1})
        self.assertEqual(status, 200)
        self.assertEqual(body["rev"], 1)
        self.assertIn("savedAt", body)

        status, got = http("GET", self.base + "/api/state")
        self.assertEqual(status, 200)
        self.assertEqual(got["state"], self.STATE_V1)
        self.assertEqual(got["rev"], 1)

    def test_optimistic_locking(self):
        status, _ = http("PUT", self.base + "/api/state", {"baseRev": None, "state": self.STATE_V1})
        self.assertEqual(status, 200)

        # matching baseRev succeeds and increments rev
        status, body = http("PUT", self.base + "/api/state", {"baseRev": 1, "state": self.STATE_V2})
        self.assertEqual(status, 200)
        self.assertEqual(body["rev"], 2)

        # stale baseRev is rejected with conflict info
        status, body = http("PUT", self.base + "/api/state", {"baseRev": 1, "state": self.STATE_V1})
        self.assertEqual(status, 409)
        self.assertEqual(body["rev"], 2)

    def test_put_accepts_bare_state_object(self):
        status, body = http("PUT", self.base + "/api/state", self.STATE_V1)
        self.assertEqual(status, 200)
        self.assertEqual(body["rev"], 1)

    # -- validation ---------------------------------------------------------
    def test_invalid_json_rejected(self):
        status, _ = http("PUT", self.base + "/api/state", "{not json")
        self.assertEqual(status, 400)

    def test_non_object_state_rejected(self):
        status, _ = http("PUT", self.base + "/api/state", {"baseRev": None, "state": [1, 2, 3]})
        self.assertEqual(status, 400)

    def test_invalid_baserev_rejected(self):
        status, _ = http("PUT", self.base + "/api/state", {"baseRev": "abc", "state": self.STATE_V1})
        self.assertEqual(status, 400)

    def test_oversize_body_rejected(self):
        # The server refuses to read beyond MAX_BODY_BYTES and drops the socket.
        # urllib may therefore surface either a clean HTTP 400 or a URLError from
        # the mid-upload teardown; both are valid rejection signals, and what must
        # hold on every platform is that nothing got persisted.
        big = {"w": "x" * (server.MAX_BODY_BYTES + 5)}
        try:
            status, body = http("PUT", self.base + "/api/state", {"baseRev": None, "state": big})
        except urllib.error.URLError:
            pass  # connection torn down while the oversized upload was in flight
        else:
            self.assertEqual(status, 400)
            self.assertIsInstance(body, dict)
            self.assertIn("error", body)
        status, _ = http("GET", self.base + "/api/state")
        self.assertEqual(status, 404, "an oversize body must never be persisted")

    # -- raw-socket edge cases (deterministic: no mid-upload races) ------------
    def raw_http(self, request_bytes: bytes) -> bytes:
        """Send a hand-built HTTP/1.1 request on its own socket and read the full reply."""
        port = self.server.server_address[1]
        with socket.create_connection(("127.0.0.1", port), timeout=10) as sock:
            sock.sendall(request_bytes)
            chunks = []
            while True:
                chunk = sock.recv(65536)
                if not chunk:
                    break
                chunks.append(chunk)
        return b"".join(chunks)

    def _split_response(self, raw: bytes) -> tuple[str, str]:
        head, _, body = raw.partition(b"\r\n\r\n")
        status_line = head.split(b"\r\n", 1)[0].decode("ascii", "replace")
        return status_line, body.decode("utf-8", "replace")

    def test_malformed_content_length_rejected_with_400(self):
        # A garbage Content-Length used to raise inside the handler before any
        # response was sent (connection just dropped). It must now produce a
        # semantic 400 JSON error.
        request = b"PUT /api/state HTTP/1.1\r\nHost: test\r\nContent-Length: abc\r\nConnection: close\r\n\r\n"
        status_line, body = self._split_response(self.raw_http(request))
        self.assertIn(" 400 ", " " + status_line)
        payload = json.loads(body)
        self.assertEqual(payload["error"], "invalid Content-Length header")

    def test_oversize_declared_length_rejected_deterministically(self):
        # Declare an oversized body but never send it: the server must answer a
        # clean 400 without reading, which makes this assertion race-free.
        declared = server.MAX_BODY_BYTES + 5
        request = (
            f"PUT /api/state HTTP/1.1\r\nHost: test\r\nContent-Length: {declared}\r\nConnection: close\r\n\r\n"
        ).encode("ascii")
        status_line, body = self._split_response(self.raw_http(request))
        self.assertIn(" 400 ", " " + status_line)
        payload = json.loads(body)
        self.assertIn(str(server.MAX_BODY_BYTES), payload["error"])
        status, _ = http("GET", self.base + "/api/state")
        self.assertEqual(status, 404, "an oversize upload must never be persisted")

    # -- static path containment (review item: symlink/realpath escape) --------
    def test_symlink_escape_outside_app_root_rejected(self):
        outside = os.path.join(self.data_dir, "outside-secret.txt")
        with open(outside, "w", encoding="utf-8") as fh:
            fh.write("TOP-SECRET-MARKER\n")
        link_name = ".shici-test-symlink"
        link_path = os.path.join(self.app_root, link_name)
        self.assertTrue(os.access(self.app_root, os.W_OK), "app root must be writable for this fixture")
        try:
            os.symlink(outside, link_path)
            req = urllib.request.Request(self.base + "/" + link_name)
            with self.assertRaises(urllib.error.HTTPError) as ctx:
                with urllib.request.urlopen(req, timeout=10):
                    pass
            self.assertIn(ctx.exception.code, (403, 404), "escaped symlink must not be served")
            leaked = ctx.exception.read().decode("utf-8", errors="replace")
            self.assertNotIn("TOP-SECRET-MARKER", leaked)
        finally:
            if os.path.lexists(link_path):
                os.unlink(link_path)

    def test_static_containment_rules(self):
        # Unit-level checks of the resolver used by do_GET/do_HEAD.
        inside = types.SimpleNamespace(path="/app.js")
        self.assertTrue(server.Handler._static_allowed(inside))
        traversal = types.SimpleNamespace(path="/" + "%2e%2e/" * 8 + "etc/passwd")
        self.assertFalse(server.Handler._static_allowed(traversal), "'..' chains must escape and be rejected")

    # -- envelope recovery (review item: valid JSON but not an envelope) -------
    def test_non_envelope_file_is_quarantined_and_recovers(self):
        path = os.path.join(self.data_dir, "state.json")
        with open(path, "w", encoding="utf-8") as fh:
            fh.write('{"unrelated": true}')  # valid JSON, not an envelope
        status, _ = http("GET", self.base + "/api/state")
        self.assertEqual(status, 404, "a non-envelope file must be treated as empty, not served")
        quarantined = [f for f in os.listdir(self.data_dir) if ".corrupt-" in f]
        self.assertEqual(len(quarantined), 1, "junk envelope should be quarantined, not left behind")
        status, body = http("PUT", self.base + "/api/state", {"baseRev": None, "state": self.STATE_V1})
        self.assertEqual(status, 200)
        self.assertEqual(body["rev"], 1, "recovery must restart cleanly from rev 1")

    def test_bad_rev_value_coerced_to_zero_without_quarantine(self):
        path = os.path.join(self.data_dir, "state.json")
        with open(path, "w", encoding="utf-8") as fh:
            json.dump({"rev": "garbage", "savedAt": "", "state": self.STATE_V1}, fh)
        status, got = http("GET", self.base + "/api/state")
        self.assertEqual(status, 200, "a bad rev must not crash the API or quarantine a usable document")
        self.assertEqual(got["rev"], 0)
        self.assertEqual(got["state"], self.STATE_V1)

    # -- shared-secret auth for mutating endpoints -----------------------------
    def test_mutations_require_shared_secret_when_configured(self):
        os.environ["SHICI_SHARED_SECRET"] = "s3cret-test"
        try:
            status, body = http("PUT", self.base + "/api/state", {"baseRev": None, "state": self.STATE_V1})
            self.assertEqual(status, 401, "PUT without the secret must be rejected")
            self.assertIn("error", body)

            status, _ = http(
                "PUT", self.base + "/api/state",
                {"baseRev": None, "state": self.STATE_V1},
                headers={server.AUTH_HEADER: "wrong"},
            )
            self.assertEqual(status, 401, "a wrong secret must be rejected")

            status, body = http(
                "PUT", self.base + "/api/state",
                {"baseRev": None, "state": self.STATE_V1},
                headers={server.AUTH_HEADER: "s3cret-test"},
            )
            self.assertEqual(status, 200)
            self.assertEqual(body["rev"], 1)

            status, _ = http("GET", self.base + "/api/state")
            self.assertEqual(status, 200, "read endpoints stay open without the secret")

            status, _ = http("DELETE", self.base + "/api/state")
            self.assertEqual(status, 401, "DELETE without the secret must be rejected")
            status, body = http("DELETE", self.base + "/api/state", headers={server.AUTH_HEADER: "s3cret-test"})
            self.assertEqual(status, 200)
            status, _ = http("GET", self.base + "/api/state")
            self.assertEqual(status, 404)
        finally:
            del os.environ["SHICI_SHARED_SECRET"]

    # -- delete --------------------------------------------------------------
    def test_delete_is_idempotent(self):
        http("PUT", self.base + "/api/state", {"baseRev": None, "state": self.STATE_V1})
        status, _ = http("DELETE", self.base + "/api/state")
        self.assertEqual(status, 200)
        status, _ = http("GET", self.base + "/api/state")
        self.assertEqual(status, 404)
        # second delete on missing file still succeeds (idempotent)
        status, _ = http("DELETE", self.base + "/api/state")
        self.assertEqual(status, 200)

    # -- routes ---------------------------------------------------------------
    def test_unknown_api_route_404(self):
        status, body = http("GET", self.base + "/api/nope")
        self.assertEqual(status, 404)
        self.assertIn("error", body)

    def test_put_on_health_is_405(self):
        status, _ = http("PUT", self.base + "/api/health", {})
        self.assertEqual(status, 405)

    # -- static serving ----------------------------------------------------------
    def test_static_index_served(self):
        req = urllib.request.Request(self.base + "/")
        with urllib.request.urlopen(req, timeout=10) as resp:
            html = resp.read().decode("utf-8")
        self.assertIn("<!doctype", html.lower())
        self.assertIn("shici-memory-v1" if False else "拾词", html)

    def test_static_app_js_served(self):
        req = urllib.request.Request(self.base + "/app.js")
        with urllib.request.urlopen(req, timeout=10) as resp:
            body = resp.read().decode("utf-8")
        self.assertIn("function load()", body)

    # -- cache headers -----------------------------------------------------------
    def test_static_responses_require_revalidation(self):
        req = urllib.request.Request(self.base + "/app.js")
        with urllib.request.urlopen(req, timeout=10) as resp:
            cache_control = [value for key, value in resp.headers.items() if key.lower() == "cache-control"]
        self.assertEqual(
            cache_control, ["no-cache"],
            "static files must revalidate on every load so WebViews cannot serve stale scripts")

    def test_api_health_stays_no_store(self):
        with urllib.request.urlopen(urllib.request.Request(self.base + "/api/health"), timeout=10) as resp:
            cache_control = [value for key, value in resp.headers.items() if key.lower() == "cache-control"]
        self.assertEqual(
            cache_control, ["no-store"],
            "API responses must keep no-store and never gain the static revalidation header")

    # -- storage layer -------------------------------------------------------------
    def test_corrupt_file_quarantined_and_recovers(self):
        path = os.path.join(self.data_dir, "state.json")
        with open(path, "w", encoding="utf-8") as fh:
            fh.write("{corrupted!!")
        self.assertIsNone(self.store.read())
        quarantined = [f for f in os.listdir(self.data_dir) if ".corrupt-" in f]
        self.assertEqual(len(quarantined), 1, "corrupt file should be quarantined, not lost")
        # a fresh PUT must succeed after corruption
        envelope, conflict = self.store.write(self.STATE_V1, None)
        self.assertFalse(conflict)
        self.assertEqual(envelope["rev"], 1)

    def test_atomic_write_leaves_no_temp_files(self):
        for i in range(5):
            http("PUT", self.base + "/api/state", {"baseRev": None, "state": {f"k{i}": i}})
        leftovers = [f for f in os.listdir(self.data_dir) if f.startswith(".state-")]
        self.assertEqual(leftovers, [], "atomic writes must not leave temp files behind")

    def test_quarantine_never_loses_an_acknowledged_document(self):
        # Regression: quarantining a corrupt file used to run outside the store
        # lock, so a slow reader could rename away a document another thread had
        # just written and ACKed. With quarantine under the same lock this is now
        # deterministic: exactly one .corrupt-* file, every write survives, final
        # rev equals the number of writers.
        path = os.path.join(self.data_dir, "state.json")
        with open(path, "w", encoding="utf-8") as fh:
            fh.write("{corrupted!!")

        n_writers = 8
        errors = []

        def writer(i):
            try:
                envelope, conflict = self.store.write({"writer": i}, None)
                assert not conflict and envelope is not None, f"writer {i} lost its write"
            except Exception as exc:  # noqa: BLE001 - reported via the errors list
                errors.append(exc)

        readers_done = threading.Event()

        def reader():
            while not readers_done.is_set():
                self.store.read()

        threads = [threading.Thread(target=reader) for _ in range(4)]
        writers = [threading.Thread(target=writer, args=(i,)) for i in range(n_writers)]
        for t in threads + writers:
            t.start()
        for w in writers:
            w.join(timeout=15)
        readers_done.set()
        for r in threads:
            r.join(timeout=15)

        self.assertEqual(errors, [], "no writer may fail while readers churn")
        quarantined = [f for f in os.listdir(self.data_dir) if ".corrupt-" in f]
        self.assertEqual(len(quarantined), 1, "only the original corrupt file may be quarantined")
        status, got = http("GET", self.base + "/api/state")
        self.assertEqual(status, 200, "the last ACKed document must still be on disk")
        self.assertEqual(got["rev"], n_writers)
        self.assertIn("writer", got["state"], "final state must be one complete valid document")

    # -- concurrency --------------------------------------------------------------
    def test_concurrent_writers_all_succeed_and_state_stays_valid(self):
        n = 12

        def worker(i):
            status, _ = http(
                "PUT", self.base + "/api/state",
                {"baseRev": None, "state": {"writer": i, "payload": f"v{i}", "records": {f"w{i}": i}}},
            )
            assert status == 200, f"worker {i} got {status}"

        threads = [threading.Thread(target=worker, args=(i,)) for i in range(n)]
        start = time.monotonic()
        for t in threads:
            t.start()
        for t in threads:
            t.join(timeout=15)
        elapsed = time.monotonic() - start
        self.assertLess(elapsed, 10, "concurrent writes must not deadlock")

        status, got = http("GET", self.base + "/api/state")
        self.assertEqual(status, 200)
        self.assertEqual(got["rev"], n, "every successful write should bump rev exactly once")
        self.assertIn("writer", got["state"], "final state must be one complete valid document")


if __name__ == "__main__":
    unittest.main(verbosity=2)
