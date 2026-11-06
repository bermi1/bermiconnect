# Bermi Connect

**Reach everyone. Instantly.** A bulk SMS and campaign platform for Tanzanian schools, businesses and
developers, by Bermi Techs (Dar es Salaam). Messages go out through **Textify over SMPP**, and the
provider layer is pluggable. Prices are in TZS (default TZS 18 per SMS segment, prepaid wallet).

## What's in this repo

```
bermi-connect/
├── SPEC.md               Shared build spec / API contract (source of truth)
├── docker-compose.yml    postgres, redis, api, worker, frontend, docs (+ optional mock-smsc)
├── DEPLOY.md             Production deployment on an Ubuntu VPS, Caddy, Textify SMPP, backups, go-live checklist
├── .env.example          All environment variables
├── backend/              Node 22 + TypeScript + Express API, BullMQ workers, SMPP client, migrations
├── frontend/             React 18 + Vite + Tailwind dashboard and marketing site
├── docs/                 Static developer docs (no build step)
│   ├── index.html          Guides with tabbed cURL/JS/Python/PHP samples and a "Try it" panel
│   ├── reference.html      Redoc rendering of openapi.yaml
│   ├── user-guide.html     Non-technical guide for schools and businesses (English + Swahili)
│   └── openapi.yaml        OpenAPI 3.1 spec for every endpoint
├── sdks/
│   ├── js/                 npm "bermi-connect" (TypeScript, zero dependencies, fetch)
│   ├── python/             "bermi_connect" (standard library only)
│   └── php/                composer "bermitechs/bermi-connect" (PSR-4, PHP 8.1+)
└── deploy/               Caddyfile, docs nginx config, backup script
```

## How it works

```
Dashboard / API client ──▶ api (Express, /v1) ──▶ Postgres (accounts, wallet, contacts, messages)
                                   │
                                   └──▶ Redis / BullMQ ──▶ worker ──SMPP transceiver──▶ Textify ──▶ networks
                                                             ▲                │
                                         webhooks queue ◀────┴── deliver_sm (DLR / inbound / STOP)
```

1. A send (`POST /v1/sms/send` or a campaign) validates numbers, renders personalisation, counts
   segments (GSM-7 160/153, UCS-2 70/67), **charges the wallet** and enqueues one job per message.
2. The worker holds one persistent SMPP bind, throttled to `TEXTIFY_SMPP_TPS`, and submits each
   message (`registered_delivery=1`).
3. Delivery receipts update status (`queued → sent → delivered | failed | rejected`), refund failures,
   and fire signed webhooks (`X-Bermi-Signature: sha256=…`).
4. Inbound `STOP` opts the number out across all accounts.

## Run it locally

With Docker:

```bash
cp .env.example .env                     # defaults work for local use
docker compose --profile mock up -d --build
docker compose run --rm api npm run migrate
# app  http://localhost:8080   api  http://localhost:4000/v1/health   docs  http://localhost:8081
```

Set `TEXTIFY_SMPP_HOST=mock-smsc` in `.env` to use the bundled mock SMSC (90% delivered, 10% failed),
or `SMS_PROVIDER=log` to only log messages.

Without Docker (Postgres 16 and Redis 7 running locally):

```bash
cd backend && npm install && npm run migrate
npm run mock-smsc &      # port 2775
npm run dev &            # API on :4000
npm run worker &         # queue workers
cd ../frontend && npm install && npm run dev   # http://localhost:5173
cd ../docs && python3 -m http.server 8081      # docs
```

## API at a glance

```bash
curl -X POST http://localhost:4000/v1/sms/send \
  -H "Authorization: Bearer bc_test_xxx" -H "Content-Type: application/json" \
  -d '{"to":["0712345678","0754000111"],"message":"Habari! Karibu Bermi Connect."}'
```

| | |
| --- | --- |
| Auth | `Authorization: Bearer bc_live_…` / `bc_test_…` or `X-API-Key`; dashboard uses a 7-day JWT |
| Envelope | `{ "data": …, "meta"?: {page, per_page, total} }` / `{ "error": { "code", "message" } }` |
| Rate limit | 100 requests/min per key (`429 rate_limited`, `Retry-After`) |
| Test mode | `bc_test_` keys: no network, no charge, messages go to `delivered` |

The full reference is in `docs/openapi.yaml`. To validate it:

```bash
npx @redocly/cli lint --config docs/redocly.yaml docs/openapi.yaml
```

## SDK tests (offline)

```bash
cd sdks/js && npm test                                   # Node 22.6+
cd sdks/python && python3 -m unittest discover -s tests
cd sdks/php && php tests/run.php
```

## Deploying

See [DEPLOY.md](DEPLOY.md): VPS hardening, Docker, DNS for `app.` / `api.` / `docs.bermiconnect.co.tz`,
Caddy with Let's Encrypt, what to request from Textify (host, port, system_id, password, system_type,
TLS, TPS, IP whitelist), TCRA sender ID registration, `pg_dump` backups, monitoring and a go-live
checklist.
