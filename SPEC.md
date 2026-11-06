# Bermi Connect — Shared Build Spec (source of truth for all agents)

Bermi Connect (by Bermi Techs, Dar es Salaam) is a bulk SMS & campaign platform for
schools, businesses and developers — "like Beem, but much easier". SMS goes out through
**Textify over SMPP** (primary). The provider layer is pluggable so a second route
(HTTP) can be added later.

Brand: name "Bermi Connect", tagline "Reach everyone. Instantly." Primary color #0E7C66
(deep green), accent #F5A524 (amber), dark ink #0B1F1A. Font: Inter / system. Currency TZS.
Phone numbers stored E.164 (Tanzania default +255; accept 07xx, 06xx, 2557xx, +2557xx).

## Monorepo layout
```
bermi-connect/
  SPEC.md
  docker-compose.yml        (docs agent)
  .env.example              (backend agent)
  backend/                  (backend agent)  Node 22 + TypeScript + Express
  frontend/                 (frontend agent) React 18 + Vite + TypeScript + Tailwind
  docs/                     (docs agent)     API docs site (static) + openapi.yaml
  sdks/js  sdks/python  sdks/php   (docs agent)
  DEPLOY.md                 (docs agent)
```

## Backend stack
- Express + TypeScript, `pg` (PostgreSQL 16), BullMQ on Redis 7, zod validation,
  bcryptjs, jsonwebtoken, `smpp` npm package for SMPP client, pino logging.
- Port 4000. All routes under `/v1`. JSON everywhere. CORS on.
- SQL migrations in `backend/migrations/*.sql`, run by `npm run migrate`.
- `npm run dev` (api), `npm run worker` (queue workers), `npm run build && npm start`.
- `npm run mock-smsc` starts a local mock SMPP server (port 2775) that accepts
  submit_sm, returns message_id, and sends deliver_sm delivery receipts ~2s later
  (90% DELIVRD, 10% UNDELIV) — used for local testing without Textify.

## Environment variables
```
PORT=4000
DATABASE_URL=postgres://bermi:bermi@localhost:5432/bermi_connect
REDIS_URL=redis://localhost:6379
JWT_SECRET=change-me
APP_URL=http://localhost:5173
SMS_PROVIDER=textify_smpp          # textify_smpp | log (log = print only)
TEXTIFY_SMPP_HOST=localhost
TEXTIFY_SMPP_PORT=2775
TEXTIFY_SMPP_SYSTEM_ID=bermi
TEXTIFY_SMPP_PASSWORD=secret
TEXTIFY_SMPP_SYSTEM_TYPE=
TEXTIFY_SMPP_TLS=false
TEXTIFY_SMPP_TPS=50                # throttle messages/sec
SMS_PRICE_TZS=18                   # price per SMS segment charged to customers
DEFAULT_SENDER_ID=BERMI
SIGNUP_FREE_CREDIT_TZS=500
```

## Auth
Two methods:
1. Dashboard: `Authorization: Bearer <JWT>` from login (7-day expiry).
2. Developer API: `Authorization: Bearer bc_live_<random>` API key (or `X-API-Key`).
   Keys stored hashed (sha256); only prefix shown after creation. `bc_test_` keys
   simulate sends (no provider call, no charge, status goes to `delivered`).
Both resolve to an `account_id`. Every resource is scoped by account.

## Response envelope
Success: `{ "data": ..., "meta"?: {page, per_page, total} }`
Error:   `{ "error": { "code": "insufficient_balance", "message": "..." } }`
HTTP codes: 400 validation_error, 401 unauthorized, 402 insufficient_balance,
403 forbidden, 404 not_found, 409 conflict, 422 sender_not_approved, 429 rate_limited.
Pagination: `?page=1&per_page=50` (max 200).

## Database tables (PostgreSQL)
- accounts(id uuid pk, name, type ['school','business','developer','other'], phone,
  balance_tzs numeric(14,2) default 0, created_at)
- users(id uuid, account_id fk, name, email unique, password_hash, role ['owner','admin','member'], created_at)
- api_keys(id, account_id, name, prefix, key_hash, mode ['live','test'], last_used_at, revoked_at, created_at)
- sender_ids(id, account_id, name varchar(11), purpose text, status ['pending','approved','rejected'], created_at)
  — admin approves; DEFAULT_SENDER_ID is always usable.
- contact_groups(id, account_id, name, description, created_at)  e.g. "Form 4 Parents"
- contacts(id, account_id, phone, first_name, last_name, fields jsonb, opted_out bool, created_at,
  unique(account_id, phone))
- contact_group_members(group_id, contact_id, pk both)
- templates(id, account_id, name, body, created_at) — body supports {{first_name}}, {{last_name}}, {{any_field}}
- campaigns(id, account_id, name, sender_id, body, status ['draft','scheduled','sending','completed','failed','cancelled'],
  scheduled_at, group_ids uuid[], total_recipients int, sent_count, delivered_count, failed_count,
  cost_tzs, created_at, started_at, completed_at)
- messages(id uuid, account_id, campaign_id nullable, api_key_id nullable, to_phone, sender_id, body,
  segments int, encoding ['GSM7','UCS2'], status ['queued','sent','delivered','failed','rejected'],
  provider_message_id, error_code, cost_tzs, reference (client ref), created_at, sent_at, delivered_at)
  index on (account_id, created_at desc), (provider_message_id)
- transactions(id, account_id, type ['topup','charge','refund','bonus'], amount_tzs, balance_after,
  description, reference, created_at)
- webhooks(id, account_id, url, events text[] ['message.delivered','message.failed','campaign.completed','message.inbound'],
  secret, active, created_at)
- inbound_messages(id, account_id nullable, from_phone, to, body, received_at)
- otp_requests(id, account_id, phone, code_hash, expires_at, attempts, verified_at, created_at)

## Segment & cost rules
GSM-7: 160 chars single, 153 per part. UCS-2 (any non-GSM char, e.g. emoji): 70 single, 67 per part.
cost = segments × SMS_PRICE_TZS. Balance is reserved/charged at enqueue; failed/rejected messages
are refunded. Opted-out contacts skipped. Personalisation rendered per recipient before segment count.
Inbound "STOP" from a number sets opted_out=true for all accounts' contacts with that phone.

## REST endpoints (all under /v1)
Auth & account (JWT):
- POST /auth/register {name, email, password, account_name, account_type, phone} → {token, user, account}
- POST /auth/login {email, password} → {token, user, account}
- GET  /me → {user, account}
- GET  /account/stats → {balance_tzs, sent_today, sent_30d, delivered_rate, campaigns_active, contacts_total, daily:[{date,sent,delivered,failed}] (last 14d)}

Developer API (API key OR JWT):
- POST /sms/send {to: string|string[], message, sender_id?, reference?, schedule_at?}
  → 202 {data: {batch_id, messages:[{id,to,status,segments,cost_tzs}], total_cost_tzs}}  (max 1000 recipients)
- GET  /sms/:id → message
- GET  /sms?status=&from=&to=&campaign_id=&page= → list
- POST /otp/send {phone, sender_id?, length?=6, expires_in?=300, template?="Your code is {{code}}"} → {otp_id, expires_at}
- POST /otp/verify {otp_id, code} → {verified: bool}
- GET  /balance → {balance_tzs, price_per_sms_tzs}

Dashboard resources (JWT; also allowed with live API key):
- CRUD /contacts (search ?q=, ?group_id=), POST /contacts/import (multipart CSV: phone,first_name,last_name,+extra cols; optional group_id)
- CRUD /groups, POST /groups/:id/contacts {contact_ids[]}, DELETE /groups/:id/contacts/:contactId
- CRUD /templates
- CRUD /sender-ids (create = request, status pending)
- Campaigns: GET/POST /campaigns, GET/PATCH/DELETE /campaigns/:id, POST /campaigns/:id/send (now or at scheduled_at),
  POST /campaigns/:id/cancel, GET /campaigns/:id/messages, POST /campaigns/estimate {group_ids, body} → {recipients, segments, cost_tzs}
- CRUD /api-keys (POST returns full key ONCE), DELETE revokes
- CRUD /webhooks, POST /webhooks/:id/test
- GET /transactions, POST /wallet/topup {amount_tzs, method:'mpesa'|'tigopesa'|'airtel'|'card'|'manual', phone?}
  → creates pending topup; for MVP a `manual`/sandbox flow credits immediately when NODE_ENV!=production.
  Leave a clear TODO hook `paymentProvider.initiate()` for a real gateway (e.g. Selcom/AzamPay).
- Admin (role owner of the platform account flagged by env ADMIN_EMAILS): GET /admin/sender-ids?status=pending, POST /admin/sender-ids/:id/approve|reject, POST /admin/accounts/:id/credit

Public:
- GET /health → {ok, db, redis, smpp:'bound'|'down'}
- POST /inbound/textify (HTTP fallback for MO/DLR if Textify pushes over HTTP)

## Queue & SMPP
- Queue `sms-send`: job per message. Worker uses a single persistent SMPP transceiver bind
  (auto-reconnect with backoff, enquire_link every 30s), throttled to TEXTIFY_SMPP_TPS.
  Long messages: use UDH concatenation or message_payload; UCS2 → data_coding 8, GSM → 0.
  source_addr = sender_id (alphanumeric: source_addr_ton 5, npi 0), destination ton 1 npi 1 without '+'.
  Request registered_delivery=1.
- deliver_sm with esm_class receipt → parse `id:... stat:DELIVRD ...` → update message status,
  refund on failure, fire webhooks. Non-receipt deliver_sm → inbound_messages + STOP handling + webhook.
- Queue `campaign-dispatch`: expands campaign recipients, renders per contact, charges, enqueues sms-send.
  Delayed jobs for scheduled campaigns/sends.
- Queue `webhooks`: POST JSON {event, data, created_at} with header `X-Bermi-Signature: sha256=<hmac(secret, body)>`, retries 5x exp backoff.

## Frontend (talks to VITE_API_URL default http://localhost:4000/v1)
Pages: Landing (public marketing: hero, for Schools / Businesses / Developers, pricing TZS 18/SMS,
features, code snippet, CTA), Login, Register (choose account type), Dashboard overview (stats + 14d chart),
Send Quick SMS, Campaigns (list, create wizard: name → audience groups → message w/ template + live
segment/cost counter + personalisation tags → schedule/send → review), Campaign detail (progress, delivery report, export CSV),
Contacts (table, search, add, CSV import with preview, groups), Templates, Sender IDs, Messages log, Wallet
(balance, top-up modal with M-Pesa/Tigo Pesa/Airtel Money/Card, transactions), Developers (API keys, webhooks,
quick-start snippets, link to docs), Settings. Mobile-responsive. Swahili-friendly copy where natural (e.g. "Karibu").
School-friendly presets: template examples for fee reminders, exam results, meeting notices.

## Docs
Static docs site (docs/index.html etc., no build step needed or a simple one) covering: Introduction,
Quick start (3 steps), Authentication, Phone formats, Send SMS, Bulk send, Message status, OTP, Balance,
Webhooks (+ signature verification code), Errors, Rate limits (default 100 req/min per key), Test mode,
SDKs, code samples in cURL / JavaScript / Python / PHP for each endpoint. Plus docs/openapi.yaml (OpenAPI 3.1).
Also user guide for schools/businesses (non-technical, how to run a campaign).
