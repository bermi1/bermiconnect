# bermi-connect (JavaScript / TypeScript)

Official SDK for the [Bermi Connect](https://docs.bermiconnect.co.tz) bulk SMS API. Zero dependencies; it uses the
built-in `fetch`, so it runs on Node 18+, Bun, Deno, Cloudflare Workers and modern browsers.

```bash
npm install bermi-connect
```

## Usage

```ts
import { BermiConnect, InsufficientBalanceError } from "bermi-connect";

const bc = new BermiConnect({ apiKey: process.env.BERMI_API_KEY! });
// options: baseUrl (default https://api.bermiconnect.co.tz/v1), timeout (ms), maxRetries, fetch

// Single or bulk (up to 1000 numbers). 07xx, 06xx, 2557xx and +2557xx are all accepted.
const { batch_id, messages, total_cost_tzs } = await bc.sms.send({
  to: ["0712345678", "+255754000111"],
  message: "Habari! Mkutano wa wazazi ni Jumamosi saa 3 asubuhi.",
  sender_id: "KIBASILA",
  reference: "meeting-2026-11",
  // schedule_at: new Date("2026-11-20T04:00:00Z"),
});

const msg = await bc.sms.get(messages[0].id);          // status: queued | sent | delivered | failed | rejected
const page = await bc.sms.list({ status: "failed", page: 1, per_page: 50 });

const { otp_id } = await bc.otp.send({ phone: "0712345678", template: "Your Duka code is {{code}}" });
const ok = await bc.otp.verify(otp_id, "482913");      // boolean

const { balance_tzs, price_per_sms_tzs } = await bc.balance.get();
```

### Errors

Every API error is thrown as a subclass of `BermiError` with `.code`, `.status` and `.details`:

| Class | HTTP | code |
| --- | --- | --- |
| `ValidationError` | 400 | `validation_error` |
| `AuthenticationError` | 401 | `unauthorized` |
| `InsufficientBalanceError` | 402 | `insufficient_balance` |
| `ForbiddenError` | 403 | `forbidden` |
| `NotFoundError` | 404 | `not_found` |
| `ConflictError` | 409 | `conflict` |
| `SenderNotApprovedError` | 422 | `sender_not_approved` |
| `RateLimitError` | 429 | `rate_limited` (has `.retryAfter` seconds) |
| `ApiError` | 5xx / other | |
| `ConnectionError` | - | network failure or timeout |

GET requests are retried automatically on 429 / 5xx / network errors (`maxRetries`, default 2). POSTs are never
retried, so a send is never duplicated by the SDK.

```ts
try { await bc.sms.send({ to: "0712345678", message: "Hi" }); }
catch (e) { if (e instanceof InsufficientBalanceError) { /* top up */ } else throw e; }
```

### Webhooks

```ts
import express from "express";
import { BermiConnect } from "bermi-connect";

app.post("/hooks/bermi", express.raw({ type: "application/json" }), async (req, res) => {
  const ok = await BermiConnect.verifySignature(req.body, req.get("X-Bermi-Signature"), process.env.BERMI_WEBHOOK_SECRET!);
  if (!ok) return res.sendStatus(401);
  const { event, data } = JSON.parse(req.body.toString("utf8"));
  res.sendStatus(200);
});
```

Always verify against the **raw** body. `bc.webhooks.verifySignature(...)` is the same function.

### Helpers

- `normalizePhone("0712 345 678")` returns `"+255712345678"` (or `null`)
- `countSegments(text)` returns `{ encoding: "GSM7" | "UCS2", segments, length }` using the billing rules

### Test mode

Use a `bc_test_` key: nothing is sent, nothing is charged, every message goes to `delivered`. `bc.testMode` is `true`.

## Development

```bash
npm test        # offline tests with a mocked fetch (Node 22.6+ for --experimental-strip-types)
npm run build   # emits dist/ (ESM + .d.ts)
```
