# Bermi Connect — Backend

Node 22 + TypeScript + Express API, BullMQ workers and an SMPP client for Textify.
`../SPEC.md` is the source of truth; differences from it are listed under **Spec deviations** below.

```
src/
  server.ts          API entry (port 4000, routes under /v1)
  worker.ts          queue workers: sms-send, campaign-dispatch, webhooks + the SMPP bind
  mock-smsc.ts       local mock SMPP server (port 2775, control HTTP on 2776)
  migrate.ts seed.ts
  providers/         index.ts (selects provider), textifySmpp.ts, log.ts, types.ts
  services/          billing, messages (charge/refund/DLR/inbound), campaigns, webhooks, senderIds
  routes/            auth, sms (+otp, balance), contacts (+groups, templates), campaigns, account (sender-ids, api-keys, webhooks, wallet, admin), public
  lib/               segments, phone, render, dlr, crypto, http
  payments/          paymentProvider.initiate() — TODO hook for Selcom/AzamPay
migrations/*.sql     plain SQL, applied in order and tracked in schema_migrations
test/                node:test unit tests (segments, phone, template render, DLR parsing)
```

## Run locally

Requirements: Node 22, PostgreSQL 16, Redis 7.

```bash
# 1. Postgres + Redis (Debian/Ubuntu example)
sudo service postgresql start
sudo -u postgres psql -c "CREATE USER bermi WITH PASSWORD 'bermi' CREATEDB;"
sudo -u postgres psql -c "CREATE DATABASE bermi_connect OWNER bermi;"
redis-server --daemonize yes

# 2. Install, configure, migrate, seed
cd backend
npm install
cp ../.env.example .env          # the VITE_* / POSTGRES_* lines are ignored by the backend
npm run migrate
npm run seed                     # prints demo login + API keys

# 3. Start (three terminals)
npm run mock-smsc                # mock SMSC on :2775 (skip this when you use real Textify)
npm run worker                   # queues + SMPP bind
npm run dev                      # API on :4000 with reload (or: npm run start:api)
```

Check it is up: `curl localhost:4000/v1/health` returns `{"data":{"ok":true,"db":true,"redis":true,"smpp":"bound",...}}`.

Other scripts:

| script | what it does |
|---|---|
| `npm test` | unit tests (node:test via tsx) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run build && npm start` / `npm run start:worker` | compiled JS from `dist/` |
| `SMS_PROVIDER=log npm run worker` | print SMS to the log instead of sending; each one is marked DELIVRD after 1s |

## Demo data (`npm run seed`)

Re-running the seed resets the demo account.

- Login: **demo@bermiconnect.co.tz / demo1234** ("Demo Secondary School", school, TZS 10,000)
- Sender IDs: `DEMOSCHOOL` (approved), `DSS-ALERT` (pending)
- Groups: "Form 4 Parents" (14), "Teachers" (7); 20 Tanzanian contacts with `student`, `class`, `fee_balance` and `subject` fields
- Templates: fee reminder, exam results, parents meeting (Swahili and English)
- API keys (fixed values, local dev only):
  - test: `bc_test_demo0000000000000000000000000000`
  - live: `bc_live_demo0000000000000000000000000000`

Platform admin is controlled by `ADMIN_EMAILS` (add `demo@bermiconnect.co.tz` locally to try the `/admin` endpoints).

## Try it

```bash
KEY=bc_live_demo0000000000000000000000000000
curl -X POST localhost:4000/v1/sms/send -H "Authorization: Bearer $KEY" -H 'Content-Type: application/json' \
  -d '{"to":["0712345601","0754123402"],"message":"Habari! Karibu Bermi Connect","sender_id":"DEMOSCHOOL"}'
curl localhost:4000/v1/sms/<id> -H "Authorization: Bearer $KEY"     # queued → sent → delivered (~2s)
curl localhost:4000/v1/balance -H "Authorization: Bearer $KEY"
```

## Mock SMSC

- Accepts any bind. Answers `submit_sm` with a hex id and sends a `deliver_sm` receipt about 2s later (90% `DELIVRD`, 10% `UNDELIV`).
- Numbers ending in `0000` always get `UNDELIV`. Numbers ending in `9999` are rejected at submit (`ESME_RINVDSTADR`) and end up as `rejected`.
- Inject an inbound (MO) message: `curl -X POST localhost:2776/mo -d '{"from":"255712345601","to":"DEMOSCHOOL","text":"STOP"}'`. If you run it in a terminal you can also type `MO 255712345601 STOP` on stdin.
- Env: `MOCK_SMSC_PORT`, `MOCK_SMSC_HTTP_PORT`, `MOCK_SMSC_DLR_DELAY_MS`, `MOCK_SMSC_FAIL_RATE`.

## How sending works

1. **Enqueue.** `/sms/send` and `/otp/send`, plus campaign dispatch, render the body and count segments. In one SQL transaction they lock the account (`SELECT … FOR UPDATE`), check the balance, debit it, write a `charge` transaction and insert the messages. Only then is one `sms-send` job pushed per message (jobId = message id). A send with `schedule_at` becomes a delayed job.
2. **Worker.** Holds one persistent `bind_transceiver`, with exponential reconnect backoff (1s up to 60s) and an `enquire_link` every 30s (it drops the link if there's no reply within 10s). A token bucket throttles PDUs to `TEXTIFY_SMPP_TPS`.
   - GSM-7 goes out as `data_coding 0` and UCS-2 as `8`.
   - Long messages are split into 153- or 67-unit parts, each sent with an 8-bit concat UDH (`esm_class 0x40`).
   - Alphanumeric senders use TON 5 / NPI 0. Destinations use TON 1 / NPI 1, with no `+`. `registered_delivery=1`.
3. **Receipts.** A `deliver_sm` that is a receipt is parsed from `id:… stat:…` (or `receipted_message_id`).
   - Each part is tracked in `message_parts`. A message is `delivered` when every part is delivered and `failed` as soon as any part fails.
   - Failed and rejected messages are refunded exactly once, in a transaction.
   - Campaign counters update, webhooks fire, and the campaign moves to `completed` once nothing is left queued or sent.
4. **Inbound.** Any other `deliver_sm` is stored in `inbound_messages` (concatenated MOs are reassembled) and fires `message.inbound`. `STOP`/`UNSUBSCRIBE`/`ACHA`/`SITISHA` sets `opted_out=true` on every account's contact with that phone.
5. **Webhooks.** `POST {event,data,created_at}` with `X-Bermi-Signature: sha256=<hex hmac(secret, raw body)>`, `X-Bermi-Event` and `X-Bermi-Delivery`. 10s timeout, 5 retries with exponential backoff starting at 30s.
6. **Test keys (`bc_test_`).** Never touch the provider and are never charged (cost 0). The message goes queued → sent → delivered in about 0.5s.

## Docker

One image. The default command is the API; pick another role with the command:

```bash
docker build -t bermi-connect/backend ./backend
docker run --env-file .env -p 4000:4000 bermi-connect/backend                  # api
docker run --env-file .env bermi-connect/backend npm run worker                # worker
docker run --env-file .env bermi-connect/backend npm run migrate               # migrations
```

`../docker-compose.yml` already wires up `api`, `worker` and the optional `mock-smsc`. Run **exactly one worker**, because it owns the single SMPP bind.

## Spec deviations / additions

Spec-compatible additions:

- Extra columns: `messages.batch_id`, `contact_id`, `test_mode`, `refunded`, `scheduled_at`; `transactions.status` (`pending|completed|failed`) and `method`; `otp_requests.message_id`.
- New table `message_parts` (one row per SMPP part).
- Message objects expose `to` (the `to_phone` column) and include `batch_id`, `test_mode`, `scheduled_at`.
- Status codes: creates return 201, deletes return 204 with no body, and `/sms/send` and `/campaigns/:id/send` return 202.
- `/sms/send`:
  - Any invalid number makes the whole request fail with 400 (`details.invalid`).
  - Duplicates are removed after normalisation.
  - Opted-out recipients are skipped and listed in `opted_out`. If every recipient has opted out, the request fails with 400.
  - `to` may also be a comma-separated string.
- `rejected` means refused before delivery (submit_sm error, opted out, cancelled, or the provider was unreachable after all retries). `failed` means a negative delivery receipt. Both are refunded.
- OTP:
  - `/otp/send` also returns `message_id` and `cost_tzs`. With a **test key** it also returns `code`.
  - `/otp/verify` always returns 200. Failures look like `{verified:false, reason:'invalid_code'|'expired'|'already_used'|'too_many_attempts'}`.
  - The code is locked after 5 wrong attempts.
- `/balance` also returns `currency: 'TZS'`. `/account/stats` also returns `price_per_sms_tzs`. `delivered_rate` is 0–1 and `daily[].date` is `YYYY-MM-DD`.
- `/campaigns/estimate` also returns `segments_per_message` and `encoding`. `GET /campaigns/:id` adds `by_status` counts. `POST /campaigns/:id/cancel` refunds messages still queued and returns `refunded_messages` / `refunded_tzs`.
- Campaign send: if `scheduled_at` is more than 5s in the future the status becomes `scheduled`; otherwise it is `sending`. An immediate send checks the balance up front (402). A scheduled one is charged when it dispatches and becomes `failed` if the balance is too low then.
- `/wallet/topup`:
  - Returns `{status, transaction, balance_tzs?, checkout_url?, instructions?, sandbox?}`.
  - Minimum is TZS 1,000. Mobile-money methods need `phone`.
  - When `NODE_ENV!=production` every method credits immediately (`status:'completed'`).
- `/me`:
  - `PATCH /me` accepts `{name?, account_name?, account_phone?, current_password?+new_password?}`.
  - User objects include `is_admin`.
- `/api-keys` needs a JWT. `POST` returns the full key once in `key`. `DELETE` revokes it (sets `revoked_at`) rather than deleting the row.
- `POST /webhooks` returns `secret` once. `PATCH` accepts `{url, events, active, rotate_secret}`. `/webhooks/:id/test` sends a signed sample event synchronously and returns `{ok, status, duration_ms, response_body}`.
- Live API keys can use dashboard resources. **Test keys** get 403 everywhere except `/sms*`, `/otp/*` and `/balance`.
- Rate limiting:
  - 100 requests/min per API key, as a fixed window in Redis (`API_RATE_LIMIT_PER_MIN`).
  - Responses carry `X-RateLimit-Limit`, `X-RateLimit-Remaining` and `X-RateLimit-Reset`.
  - Over the limit: 429 with `Retry-After`.
  - JWT requests are not rate-limited.
- Extra endpoints:
  - `POST /sms/segments {message}` (no auth)
  - `GET /inbound` (replies and STOPs)
  - `POST /contacts/bulk-delete {ids}`
  - `GET /admin/accounts`
  - `PUT` aliases for every `PATCH`
- `/health` lives at `/v1/health` (`/health` redirects there). It returns 503 when the DB or Redis is down. The SMPP state is reported by the worker through Redis.
- `/inbound/textify` accepts JSON or form data. DLR shape: `{message_id, status, err?}`, or `{text:"id:.. stat:.."}`. MO shape: `{from, to, text}`. If `INBOUND_WEBHOOK_TOKEN` is set, it is checked via `?token=` or `X-Inbound-Token`.
- CSV import:
  - The response is `{total_rows, imported, created, updated, skipped, invalid, duplicates, errors[], group_id}`.
  - Header aliases are accepted (`msisdn`, `mobile`, `simu`, `jina`, `surname`, …).
  - Existing contacts are upserted: their fields are merged.
- Inbound messages are attributed to the account that last messaged the number.
- Extra env vars: `CORS_ORIGINS`, `ADMIN_EMAILS`, `INBOUND_WEBHOOK_TOKEN`, `API_RATE_LIMIT_PER_MIN`, `TEXTIFY_SMPP_ENQUIRE_LINK_MS`, `WORKER_CONCURRENCY`, `LOG_LEVEL`, `NODE_ENV`.
