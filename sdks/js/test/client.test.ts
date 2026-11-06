import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import {
  BermiConnect, normalizePhone, countSegments,
  InsufficientBalanceError, SenderNotApprovedError, RateLimitError, AuthenticationError, NotFoundError,
} from "../src/index.ts";

type Call = { url: string; init: RequestInit };

function mockFetch(handler: (call: Call) => { status?: number; body?: unknown; headers?: Record<string, string> }) {
  const calls: Call[] = [];
  const f = (async (url: string, init: RequestInit) => {
    const call = { url: String(url), init };
    calls.push(call);
    const r = handler(call);
    return new Response(r.body === undefined ? "" : JSON.stringify(r.body), {
      status: r.status ?? 200,
      headers: { "content-type": "application/json", ...(r.headers ?? {}) },
    });
  }) as unknown as typeof fetch;
  return { f, calls };
}

const BASE = "http://mock.local/v1";

test("sms.send posts JSON with bearer key and returns data", async () => {
  const { f, calls } = mockFetch(() => ({
    status: 202,
    body: { data: { batch_id: "b1", messages: [{ id: "m1", to: "+255712345678", status: "queued", segments: 1, cost_tzs: 25 }], total_cost_tzs: 25 } },
  }));
  const bc = new BermiConnect({ apiKey: "bc_test_abc", baseUrl: BASE, fetch: f });
  const when = new Date("2026-12-01T06:00:00Z");
  const r = await bc.sms.send({ to: "0712345678", message: "Habari", sender_id: "BERMI", schedule_at: when });
  assert.equal(r.batch_id, "b1");
  assert.equal(r.total_cost_tzs, 25);
  assert.equal(calls[0].url, BASE + "/sms/send");
  assert.equal(calls[0].init.method, "POST");
  const h = calls[0].init.headers as Record<string, string>;
  assert.equal(h.Authorization, "Bearer bc_test_abc");
  const sent = JSON.parse(String(calls[0].init.body));
  assert.equal(sent.schedule_at, "2026-12-01T06:00:00.000Z");
  assert.equal(bc.testMode, true);
});

test("sms.get and sms.list build URLs and pass meta", async () => {
  const { f, calls } = mockFetch(({ url }) =>
    url.includes("/sms/") ? { body: { data: { id: "m 1", status: "delivered" } } }
      : { body: { data: [{ id: "m1" }], meta: { page: 2, per_page: 10, total: 11 } } });
  const bc = new BermiConnect({ apiKey: "bc_live_x", baseUrl: BASE + "/", fetch: f });
  const m = await bc.sms.get("m 1");
  assert.equal(m.status, "delivered");
  assert.equal(calls[0].url, BASE + "/sms/m%201");
  const page = await bc.sms.list({ status: "delivered", page: 2, per_page: 10 });
  assert.equal(page.meta.total, 11);
  const u = new URL(calls[1].url);
  assert.equal(u.searchParams.get("status"), "delivered");
  assert.equal(u.searchParams.get("page"), "2");
  assert.equal(u.searchParams.has("campaign_id"), false);
});

test("otp send + verify", async () => {
  const { f } = mockFetch(({ url }) =>
    url.endsWith("/otp/send") ? { body: { data: { otp_id: "o1", expires_at: "2026-11-05T10:20:00Z" } } }
      : { body: { data: { verified: true } } });
  const bc = new BermiConnect({ apiKey: "bc_live_x", baseUrl: BASE, fetch: f });
  const o = await bc.otp.send({ phone: "0712345678" });
  assert.equal(o.otp_id, "o1");
  assert.equal(await bc.otp.verify("o1", "123456"), true);
});

test("balance.get", async () => {
  const { f } = mockFetch(() => ({ body: { data: { balance_tzs: 1000, price_per_sms_tzs: 25 } } }));
  const bc = new BermiConnect({ apiKey: "bc_live_x", baseUrl: BASE, fetch: f });
  assert.deepEqual(await bc.balance.get(), { balance_tzs: 1000, price_per_sms_tzs: 25 });
});

test("typed errors map from error codes", async () => {
  const cases: [number, string, Function][] = [
    [402, "insufficient_balance", InsufficientBalanceError],
    [422, "sender_not_approved", SenderNotApprovedError],
    [401, "unauthorized", AuthenticationError],
    [404, "not_found", NotFoundError],
  ];
  for (const [status, code, Cls] of cases) {
    const { f } = mockFetch(() => ({ status, body: { error: { code, message: "nope" } } }));
    const bc = new BermiConnect({ apiKey: "bc_live_x", baseUrl: BASE, fetch: f, maxRetries: 0 });
    await assert.rejects(bc.sms.send({ to: "0712345678", message: "x" }), (e: any) => {
      assert.ok(e instanceof Cls, `${code} -> ${e.constructor.name}`);
      assert.equal(e.code, code);
      assert.equal(e.status, status);
      return true;
    });
  }
});

test("GET retries on 429 then succeeds; POST does not retry", async () => {
  let n = 0;
  const { f } = mockFetch(() => (n++ === 0
    ? { status: 429, body: { error: { code: "rate_limited", message: "slow" } }, headers: { "retry-after": "0" } }
    : { body: { data: { balance_tzs: 5, price_per_sms_tzs: 25 } } }));
  const bc = new BermiConnect({ apiKey: "bc_live_x", baseUrl: BASE, fetch: f });
  assert.equal((await bc.balance.get()).balance_tzs, 5);

  const { f: f2, calls } = mockFetch(() => ({ status: 429, body: { error: { code: "rate_limited", message: "slow" } }, headers: { "retry-after": "7" } }));
  const bc2 = new BermiConnect({ apiKey: "bc_live_x", baseUrl: BASE, fetch: f2 });
  await assert.rejects(bc2.sms.send({ to: "0712345678", message: "x" }), (e: any) => e instanceof RateLimitError && e.retryAfter === 7);
  assert.equal(calls.length, 1);
});

test("webhooks.verifySignature", async () => {
  const secret = "whsec_test_123";
  const body = JSON.stringify({ event: "message.delivered", data: { id: "m1" }, created_at: "2026-11-05T10:00:00Z" });
  const sig = "sha256=" + createHmac("sha256", secret).update(body).digest("hex");
  const bc = new BermiConnect({ apiKey: "bc_live_x", baseUrl: BASE, fetch: mockFetch(() => ({})).f });
  assert.equal(await bc.webhooks.verifySignature(body, sig, secret), true);
  assert.equal(await bc.webhooks.verifySignature(body + " ", sig, secret), false);
  assert.equal(await bc.webhooks.verifySignature(body, sig, "wrong"), false);
  assert.equal(await bc.webhooks.verifySignature(body, undefined, secret), false);
});

test("normalizePhone", () => {
  for (const v of ["0712345678", "712345678", "255712345678", "+255712345678", "+255 712 345 678", "00255712345678"]) {
    assert.equal(normalizePhone(v), "+255712345678", v);
  }
  assert.equal(normalizePhone("0688123456"), "+255688123456");
  assert.equal(normalizePhone("+254712345678"), "+254712345678");
  assert.equal(normalizePhone("0712"), null);
  assert.equal(normalizePhone("abc"), null);
});

test("countSegments", () => {
  assert.deepEqual(countSegments("a".repeat(160)), { encoding: "GSM7", length: 160, segments: 1 });
  assert.equal(countSegments("a".repeat(161)).segments, 2);
  assert.equal(countSegments("a".repeat(306)).segments, 2);
  assert.equal(countSegments("a".repeat(307)).segments, 3);
  assert.equal(countSegments("€".repeat(80)).segments, 1); // 160 septets
  assert.equal(countSegments("Habari 👋").encoding, "UCS2");
  assert.equal(countSegments("x".repeat(70) + "").segments, 1);
  assert.equal(countSegments("ü" + "x".repeat(69)).encoding, "GSM7");
  assert.equal(countSegments("ś" + "x".repeat(70)).segments, 2);
});
