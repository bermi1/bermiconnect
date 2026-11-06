# Bermi Connect — instructions for Claude Code

Bermi Connect is a white-label bulk SMS platform by **Bermi Techs** (Dar es Salaam), the first product of its "Communication Intelligence" branch.

Bermi resells SMS from **Textify Africa** under its own brand, and customers never see Textify. Read `SPEC.md` for the original API contract and `research/plan.md` for the product decisions.

## Product direction (from the founder)
- **Keep it simple.** Normal SMS reselling, done well, with AI as a helper. No voice, WhatsApp or "understanding layer" yet; voice is shown as "coming soon".
- **Price:** TZS 18 per SMS unit.
- **Customers:** schools, businesses, SACCOs, churches, developers.
- **Customers can, inside Bermi:**
  - buy SMS packages and pay with mobile money (M-Pesa, Airtel Money, Mixx by Yas, HaloPesa, T-Pesa) or card;
  - request a sender ID;
  - send: quick SMS, send from Excel, campaign to a group;
  - see reports;
  - use the developer API.
- **Website:** simple, clean, interactive and modern, with animation and 3D motion. **No emoji anywhere. Real icons only** (lucide-react).
- **Brand:** navy `#201F5B`, amber `#F5A524`, the real logo in `frontend/src/components/Logo.tsx`.

## Upstream: Textify Africa
- **Public API docs:** https://textify.africa/docs/
- **docs.textify.africa:** the Credits, Webhooks and SMPP pages are JS-rendered. Ask the founder to paste them; never invent endpoint shapes.
- **HTTP API:**
  - Base URL `https://portal.textify.africa/api/v1`, header `Authorization: Bearer $TEXTIFY_API_KEY`.
  - Envelope: `{success, status_code, status_text, message, data, error}`.
  - `POST /messages {sender_name, messages:[{receiver, content}], is_scheduled, scheduled_date}` returns 201 with `data:null`. It returns no message IDs, so use reconciliation polling.
  - `GET /messages`, `/messages/search`, `/messages/{id}`. Statuses: scheduled, sending, processing, sent, delivered, undelivered, failed.
  - `POST /sender-names {name<=11, reason}`. Status goes requested → approved/declined. Also `GET /sender-names?status=`.
  - `POST /otps`, `POST /otps/verify`. We use our own OTP sent via the SMS route instead.
- **SMPP (preferred for sending):**
  - `smpp.textify.africa:2776`, **TLS required**. Allow outbound to `172.234.214.128`. Use a static server IP.
  - Bind as transceiver.
  - Sender: `source_addr` TON 5 / NPI 0. Destination: `255712345678` TON 1 / NPI 1.
  - Long text goes in **`message_payload`, not UDH**.
  - `registered_delivery=1`; only final receipts are sent.
  - `enquire_link` at most every 60 s; the link is dropped after 3 minutes of silence.
- **Text rules:** characters outside ASCII are **removed** by Textify. Billing is `ceil(len/160)` units on the sanitised text. The UI warns about this and offers a one-tap fix.
- **Secrets:**
  - `TEXTIFY_API_KEY` lives only in `backend/.env`, which git ignores.
  - **This repo is public.** Never commit, log or print keys.
  - `.env.example` holds placeholders only.

## Repo layout
- `backend/`
  - Express + TypeScript, Postgres, BullMQ/Redis.
  - Scripts: `npm run dev`, `worker`, `migrate`, `seed`, `test`, `mock-smsc` (local SMPP simulator), `mock-textify-http` (local HTTP API simulator).
  - Providers live in `src/providers` (`textify_smpp`, `textify_http`, `log`). Payments in `src/payments`. AI writing helper in `src/ai` (Anthropic API, `AI_PROVIDER=mock` for local only).
- `frontend/`
  - React + Vite + Tailwind + TanStack Query.
  - Demo build: `VITE_DEMO=1 npx vite build --config vite.demo.config.ts`. It intercepts the API using `src/demo/mockApi.ts` and `snapshot.json`.
- `docs/`: static developer docs, `openapi.yaml` (lint with `npx @redocly/cli lint --config docs/redocly.yaml docs/openapi.yaml`) and `user-guide.html`.
- `sdks/`: JavaScript, Python and PHP SDKs, each with offline tests.
- `docker-compose.yml`, `DEPLOY.md`, `deploy/`: production setup (Caddy, backups).
- `research/`: market, field and plan reports, plus `sample-results-form2.csv`, a deliberately messy school results sheet used to test the Excel sender.

## Current state (handoff, 6 Nov 2026)
**Done and tested earlier:**
- Core SMS platform: auth, contacts and groups, campaigns, templates, sender IDs, wallet, API keys, webhooks, OTP, rate limits.
- End-to-end test against the mock SMSC.
- Docs, SDKs, docker-compose.

**Built in the last round, not fully verified:**
- AI writing helper (`/v1/ai/write`).
- Send from Excel (`SendFromExcel.tsx`, `/v1/campaigns/from-file`).
- Simplified navigation (Send hub, Reports).
- `textify_http` provider and `mock-textify-http`.
- ASCII/160 text rules (`frontend/src/lib/smsText.ts`).

**Known broken:** the frontend typecheck fails mid-refactor.
- `frontend/src/lib/sms.ts` and `frontend/src/lib/sheet.ts` import `fixGsm` / `GsmFix` from `./smsText`, which now exports `sanitizeSms` / `TextFix` instead.
- `frontend/src/components/Composer.tsx` has an unused `Link` import.
- Fix these first.

## Remaining work, in order
1. **Fix the frontend typecheck**, then run `npx tsc --noEmit` in both apps, `npm test` in the backend, and `npm run build` in the frontend.
2. **Textify SMPP provider** (`backend/src/providers/textifySmpp.ts`):
   - TLS on.
   - `TEXTIFY_SMPP_LONG_MODE=payload|udh`, default `payload`.
   - ASCII sanitise before submit.
   - Make the mock SMSC support `message_payload`.
3. **Segments and billing:** `ceil(len/160)` on the sanitised text, everywhere: backend `lib/segments.ts`, frontend, docs, SDKs, tests.
4. **Sender names via Textify:**
   - When a customer requests one, call `POST /sender-names`, then store `textify_sender_id` and the status.
   - Sync job every 10 minutes, plus an admin "sync now" button.
5. **Buy SMS:**
   - Packages (500, 2,000, 10,000 or custom at TZS 18; tiers configurable).
   - `PaymentProvider` interface (`initiate` / `confirm` webhook), with a `sandbox` provider and a `textify` adapter stub with TODOs.
   - UI: pick a package, pick a method, enter phone, see "approve on your phone" (polling), success.
6. **Website:**
   - **Hero:** a 3D scene using three + @react-three/fiber + drei at pinned versions, lazy-loaded after first paint, with a CSS fallback for low-end devices, no WebGL, or reduced motion.
   - **Interactions:** spring motion, an interactive spreadsheet-to-SMS demo, an AI "shorten to 1 SMS" demo, and a live TZS 18 calculator.
   - **Honesty:** only real features are shown; voice is marked "coming soon".
   - **Performance budget:** under about 200 KB gzip without the 3D part. Test at 390px and on desktop.
7. **Docs and SDKs:** cover the new endpoints, the ASCII/160 rule, and buying and sender-ID flows. Keep the OpenAPI lint clean.
8. **Health:** `/v1/health` shows the upstream provider status. Add an admin page for Textify balance (adapter pending docs) and sender-name sync.
9. **Verify end to end** with curl against both mocks, and with Playwright for Send from Excel, Buy SMS and Request sender ID at desktop and 390px widths.

## Founder to-do in the Textify portal
- Create an SMPP login (none exists yet).
- Give Textify the server's static IP.
- Get the default sender `BERMI` approved.
- Paste the Credits and Webhooks docs pages.
- Rotate the API key after setup, because it was shared in a chat.

## Rules
- Before every commit, check for secrets: `git grep -nE 'txf_[a-f0-9]{8,}|[a-f0-9]{64}'` must return nothing.
- Never fake features in the UI. Mark them "coming soon".
- Use plain language for school secretaries and shop owners. Swahili touches are welcome.
