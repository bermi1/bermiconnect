"""Offline tests: spins up a local mock HTTP server on 127.0.0.1."""
import hashlib
import hmac
import json
import os
import sys
import threading
import unittest
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, HTTPServer

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from bermi_connect import (  # noqa: E402
    BermiConnect, verify_signature, normalize_phone, count_segments,
    InsufficientBalanceError, SenderNotApprovedError, AuthenticationError, RateLimitError, NotFoundError,
)

STATE = {"requests": [], "routes": {}}


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def _handle(self):
        n = int(self.headers.get("Content-Length") or 0)
        body = json.loads(self.rfile.read(n)) if n else None
        STATE["requests"].append({"method": self.command, "path": self.path, "body": body,
                                  "auth": self.headers.get("Authorization")})
        key = (self.command, self.path.split("?")[0])
        route = STATE["routes"].get(key)
        if callable(route):
            route = route()
        status, payload, headers = route if route else (404, {"error": {"code": "not_found", "message": "no route"}}, {})
        out = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(out)))
        for k, v in headers.items():
            self.send_header(k, v)
        self.end_headers()
        self.wfile.write(out)

    do_GET = do_POST = _handle


class ClientTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = HTTPServer(("127.0.0.1", 0), Handler)
        threading.Thread(target=cls.server.serve_forever, daemon=True).start()
        cls.base = f"http://127.0.0.1:{cls.server.server_address[1]}/v1"

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()

    def setUp(self):
        STATE["requests"].clear()
        STATE["routes"].clear()
        self.bc = BermiConnect("bc_test_abc", base_url=self.base, max_retries=1)

    def test_sms_send(self):
        STATE["routes"][("POST", "/v1/sms/send")] = (202, {"data": {
            "batch_id": "b1", "total_cost_tzs": 50,
            "messages": [{"id": "m1", "to": "+255712345678", "status": "queued", "segments": 1, "cost_tzs": 25},
                         {"id": "m2", "to": "+255754000111", "status": "queued", "segments": 1, "cost_tzs": 25}]}}, {})
        r = self.bc.sms.send(to=["0712345678", "0754000111"], message="Habari", sender_id="BERMI",
                             schedule_at=datetime(2026, 12, 1, 6, 0, tzinfo=timezone.utc))
        self.assertEqual(r["total_cost_tzs"], 50)
        req = STATE["requests"][0]
        self.assertEqual(req["auth"], "Bearer bc_test_abc")
        self.assertEqual(req["body"]["to"], ["0712345678", "0754000111"])
        self.assertEqual(req["body"]["schedule_at"], "2026-12-01T06:00:00+00:00")
        self.assertNotIn("reference", req["body"])
        self.assertTrue(self.bc.test_mode)

    def test_sms_get_and_list(self):
        STATE["routes"][("GET", "/v1/sms/m1")] = (200, {"data": {"id": "m1", "status": "delivered"}}, {})
        STATE["routes"][("GET", "/v1/sms")] = (200, {"data": [{"id": "m1"}], "meta": {"page": 1, "per_page": 50, "total": 1}}, {})
        self.assertEqual(self.bc.sms.get("m1")["status"], "delivered")
        page = self.bc.sms.list(status="delivered", per_page=50)
        self.assertEqual(page["meta"]["total"], 1)
        self.assertIn("status=delivered", STATE["requests"][1]["path"])

    def test_otp(self):
        STATE["routes"][("POST", "/v1/otp/send")] = (200, {"data": {"otp_id": "o1", "expires_at": "x"}}, {})
        STATE["routes"][("POST", "/v1/otp/verify")] = (200, {"data": {"verified": False}}, {})
        self.assertEqual(self.bc.otp.send(phone="0712345678", length=4)["otp_id"], "o1")
        self.assertIs(self.bc.otp.verify("o1", 1234), False)
        self.assertEqual(STATE["requests"][1]["body"], {"otp_id": "o1", "code": "1234"})

    def test_balance(self):
        STATE["routes"][("GET", "/v1/balance")] = (200, {"data": {"balance_tzs": 500, "price_per_sms_tzs": 25}}, {})
        self.assertEqual(self.bc.balance.get()["balance_tzs"], 500)

    def test_typed_errors(self):
        cases = [(402, "insufficient_balance", InsufficientBalanceError),
                 (422, "sender_not_approved", SenderNotApprovedError),
                 (401, "unauthorized", AuthenticationError),
                 (404, "not_found", NotFoundError)]
        for status, code, cls in cases:
            STATE["routes"][("POST", "/v1/sms/send")] = (status, {"error": {"code": code, "message": "nope"}}, {})
            with self.assertRaises(cls) as ctx:
                self.bc.sms.send(to="0712345678", message="x")
            self.assertEqual(ctx.exception.code, code)
            self.assertEqual(ctx.exception.status, status)

    def test_rate_limit_retry_on_get(self):
        calls = {"n": 0}

        def route():
            calls["n"] += 1
            if calls["n"] == 1:
                return (429, {"error": {"code": "rate_limited", "message": "slow"}}, {"Retry-After": "0"})
            return (200, {"data": {"balance_tzs": 1, "price_per_sms_tzs": 25}}, {})
        STATE["routes"][("GET", "/v1/balance")] = route
        self.assertEqual(self.bc.balance.get()["balance_tzs"], 1)
        self.assertEqual(calls["n"], 2)

    def test_rate_limit_no_retry_on_post(self):
        STATE["routes"][("POST", "/v1/sms/send")] = (429, {"error": {"code": "rate_limited", "message": "slow"}}, {"Retry-After": "9"})
        with self.assertRaises(RateLimitError) as ctx:
            self.bc.sms.send(to="0712345678", message="x")
        self.assertEqual(ctx.exception.retry_after, 9.0)
        self.assertEqual(len(STATE["requests"]), 1)


class HelperTests(unittest.TestCase):
    def test_verify_signature(self):
        secret = "whsec_test_123"
        body = json.dumps({"event": "message.delivered", "data": {"id": "m1"}}).encode()
        sig = "sha256=" + hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
        self.assertTrue(verify_signature(body, sig, secret))
        self.assertTrue(BermiConnect("bc_live_x").webhooks.verify_signature(body.decode(), sig, secret))
        self.assertFalse(verify_signature(body + b" ", sig, secret))
        self.assertFalse(verify_signature(body, sig, "wrong"))
        self.assertFalse(verify_signature(body, None, secret))

    def test_normalize_phone(self):
        for v in ["0712345678", "712345678", "255712345678", "+255712345678", "+255 712 345 678", "00255712345678"]:
            self.assertEqual(normalize_phone(v), "+255712345678", v)
        self.assertEqual(normalize_phone("0688123456"), "+255688123456")
        self.assertIsNone(normalize_phone("0712"))

    def test_count_segments(self):
        self.assertEqual(count_segments("a" * 160)["segments"], 1)
        self.assertEqual(count_segments("a" * 161)["segments"], 2)
        self.assertEqual(count_segments("a" * 307)["segments"], 3)
        self.assertEqual(count_segments("Habari 👋")["encoding"], "UCS2")
        self.assertEqual(count_segments("ś" + "x" * 70)["segments"], 2)


if __name__ == "__main__":
    unittest.main()
