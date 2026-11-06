# Deploying Bermi Connect to production

This guide takes a fresh Ubuntu 24.04 VPS (Contabo, DigitalOcean, Hetzner, AWS Lightsail…) to a live
platform at:

| Host | Serves | Container |
| --- | --- | --- |
| `app.bermiconnect.co.tz` | Dashboard (React) | `frontend` → `127.0.0.1:8080` |
| `api.bermiconnect.co.tz` | REST API `/v1` | `api` → `127.0.0.1:4000` |
| `docs.bermiconnect.co.tz` | Developer docs, user guide, Redoc | `docs` → `127.0.0.1:8081` |

Everything runs in Docker Compose. Caddy on the host terminates TLS with automatic Let's Encrypt
certificates. Postgres and Redis are never exposed to the internet.

```
Internet ──443──▶ Caddy (host) ──▶ frontend :8080
                               ├─▶ api      :4000 ──▶ postgres, redis
                               └─▶ docs     :8081
                  worker ──SMPP (TLS) :port──▶ Textify SMSC ──▶ Vodacom / Yas / Airtel / Halotel / TTCL
```

---

## 1. Size the server

| Volume | Spec |
| --- | --- |
| Launch, up to ~200k SMS/month | 2 vCPU, 4 GB RAM, 80 GB SSD |
| Up to ~2M SMS/month | 4 vCPU, 8 GB RAM, 160 GB SSD |

Pick a region with low latency to Textify's SMSC (ask them where it is hosted). Get a **static public
IPv4**: Textify will whitelist it, and it must not change.

## 2. Prepare the server

```bash
ssh root@YOUR_VPS_IP

# a deploy user
adduser --disabled-password --gecos "" bermi
usermod -aG sudo bermi
mkdir -p /home/bermi/.ssh && cp ~/.ssh/authorized_keys /home/bermi/.ssh/ && chown -R bermi:bermi /home/bermi/.ssh

# updates, time zone (logs in EAT), basics
apt update && apt -y upgrade
timedatectl set-timezone Africa/Dar_es_Salaam
apt -y install ufw fail2ban unattended-upgrades git curl
dpkg-reconfigure -plow unattended-upgrades

# firewall: SSH + HTTP(S) only. SMPP is OUTBOUND, so no inbound port is needed for it.
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow 80,443/tcp
ufw enable

# disable password SSH logins
sed -i 's/^#\?PasswordAuthentication .*/PasswordAuthentication no/' /etc/ssh/sshd_config
sed -i 's/^#\?PermitRootLogin .*/PermitRootLogin prohibit-password/' /etc/ssh/sshd_config
systemctl restart ssh
```

> Docker publishes ports by editing iptables directly, which bypasses UFW. That is why
> `docker-compose.yml` binds every port to `127.0.0.1`. Do not change them to `0.0.0.0`.

Add 2 GB swap on small instances:

```bash
fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

## 3. Install Docker

```bash
curl -fsSL https://get.docker.com | sh
usermod -aG docker bermi
docker compose version   # should print v2.x
```

Log out and back in as `bermi`.

## 4. DNS

At your `.co.tz` registrar (or Cloudflare), create **A records** pointing to the VPS IP:

| Name | Type | Value |
| --- | --- | --- |
| `app` | A | `YOUR_VPS_IP` |
| `api` | A | `YOUR_VPS_IP` |
| `docs` | A | `YOUR_VPS_IP` |
| `@` | A | `YOUR_VPS_IP` (optional, redirects to app) |

If you use Cloudflare, set the records to **DNS only** (grey cloud) until certificates are issued, then
you may switch on the proxy with SSL mode **Full (strict)**. Check propagation with
`dig +short api.bermiconnect.co.tz`.

## 5. Get the code and configure

```bash
sudo mkdir -p /opt/bermi-connect && sudo chown bermi:bermi /opt/bermi-connect
git clone git@github.com:YOUR_ORG/bermi-connect.git /opt/bermi-connect
cd /opt/bermi-connect
cp .env.example .env
chmod 600 .env
```

Edit `.env`. The production values that matter:

```dotenv
NODE_ENV=production
PORT=4000
APP_URL=https://app.bermiconnect.co.tz
CORS_ORIGINS=https://app.bermiconnect.co.tz,https://docs.bermiconnect.co.tz

# Postgres (used by both the postgres container and the API; compose builds DATABASE_URL from these)
POSTGRES_USER=bermi
POSTGRES_PASSWORD=<openssl rand -hex 24>
POSTGRES_DB=bermi_connect

JWT_SECRET=<openssl rand -hex 48>
ADMIN_EMAILS=you@bermitechs.co.tz

# Frontend build-time values
VITE_API_URL=https://api.bermiconnect.co.tz/v1
VITE_DOCS_URL=https://docs.bermiconnect.co.tz

# SMS
SMS_PROVIDER=textify_smpp
SMS_PRICE_TZS=18
DEFAULT_SENDER_ID=BERMI
SIGNUP_FREE_CREDIT_TZS=500
TEXTIFY_SMPP_HOST=<from Textify>
TEXTIFY_SMPP_PORT=<from Textify>
TEXTIFY_SMPP_SYSTEM_ID=<from Textify>
TEXTIFY_SMPP_PASSWORD=<from Textify>
TEXTIFY_SMPP_SYSTEM_TYPE=
TEXTIFY_SMPP_TLS=true
TEXTIFY_SMPP_TPS=<agreed TPS>
API_RATE_LIMIT_PER_MIN=100
INBOUND_WEBHOOK_TOKEN=<openssl rand -hex 24>
```

`DATABASE_URL` and `REDIS_URL` are set by `docker-compose.yml` to the internal service names, so the
`localhost` values in `.env.example` are ignored inside containers.

Until you have Textify credentials, use `SMS_PROVIDER=log` (messages are only logged), or run the mock
SMSC: `docker compose --profile mock up -d mock-smsc` with `TEXTIFY_SMPP_HOST=mock-smsc`.

## 6. Build, migrate, start

```bash
cd /opt/bermi-connect
docker compose build
docker compose up -d postgres redis
docker compose run --rm api npm run migrate
docker compose up -d
docker compose ps          # all services "healthy" after ~30 s
curl -s http://127.0.0.1:4000/v1/health
# {"ok":true,"db":true,"redis":true,"smpp":"bound"}
```

## 7. Reverse proxy with Caddy and Let's Encrypt

```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install -y caddy
sudo mkdir -p /var/log/caddy && sudo chown caddy:caddy /var/log/caddy
sudo cp /opt/bermi-connect/deploy/Caddyfile /etc/caddy/Caddyfile
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

The Caddyfile in `deploy/Caddyfile`:

```caddy
{
	email ops@bermiconnect.co.tz
}

(common) {
	encode zstd gzip
	header {
		Strict-Transport-Security "max-age=31536000; includeSubDomains"
		X-Content-Type-Options nosniff
		Referrer-Policy strict-origin-when-cross-origin
		-Server
	}
	log {
		output file /var/log/caddy/{args[0]}.log {
			roll_size 20MiB
			roll_keep 10
		}
	}
}

app.bermiconnect.co.tz {
	import common app
	reverse_proxy 127.0.0.1:8080
}

api.bermiconnect.co.tz {
	import common api
	request_body {
		max_size 10MB
	}
	reverse_proxy 127.0.0.1:4000 {
		header_up X-Real-IP {remote_host}
	}
}

docs.bermiconnect.co.tz {
	import common docs
	reverse_proxy 127.0.0.1:8081
}

bermiconnect.co.tz, www.bermiconnect.co.tz {
	redir https://app.bermiconnect.co.tz{uri} permanent
}
```

Caddy requests certificates on first request; watch with `journalctl -u caddy -f`. Then check that
`https://app.bermiconnect.co.tz`, `https://api.bermiconnect.co.tz/v1/health` and
`https://docs.bermiconnect.co.tz` all load with a valid padlock.

The API should trust `X-Forwarded-For` from the proxy (Express `app.set('trust proxy', 1)`), so rate
limits and logs see client IPs, not `127.0.0.1`.

<details>
<summary>Prefer nginx + certbot?</summary>

```bash
sudo apt install -y nginx certbot python3-certbot-nginx
```

`/etc/nginx/sites-available/bermi`:

```nginx
server { server_name app.bermiconnect.co.tz;  location / { proxy_pass http://127.0.0.1:8080; include proxy_params; } }
server { server_name docs.bermiconnect.co.tz; location / { proxy_pass http://127.0.0.1:8081; include proxy_params; } }
server {
  server_name api.bermiconnect.co.tz;
  client_max_body_size 10m;
  location / { proxy_pass http://127.0.0.1:4000; include proxy_params; proxy_read_timeout 60s; }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/bermi /etc/nginx/sites-enabled/ && sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d app.bermiconnect.co.tz -d api.bermiconnect.co.tz -d docs.bermiconnect.co.tz --redirect -m ops@bermiconnect.co.tz --agree-tos
```

Certbot installs a renewal timer; check it with `sudo certbot renew --dry-run`.
</details>

## 8. Connect Textify SMPP

### 8.1 What to ask Textify for

Send Textify a written request (email) covering:

| Item | Why | Goes into |
| --- | --- | --- |
| **SMPP host** (IP or DNS) and **port** for production, plus a test/staging endpoint if they have one | Where the worker connects | `TEXTIFY_SMPP_HOST`, `TEXTIFY_SMPP_PORT` |
| **system_id** and **password** (max 8 characters per SMPP 3.4) | Bind credentials | `TEXTIFY_SMPP_SYSTEM_ID`, `TEXTIFY_SMPP_PASSWORD` |
| **system_type** (often blank) | Some SMSCs require a value | `TEXTIFY_SMPP_SYSTEM_TYPE` |
| **TLS**: is SMPP over TLS supported, and on which port? | Credentials and message content otherwise travel in clear text; insist on TLS or a VPN | `TEXTIFY_SMPP_TLS=true` |
| **SMPP version** (3.4 expected) and **bind type** (we use one `transceiver`) | Compatibility | n/a |
| **Max concurrent binds** per system_id | We hold exactly one; confirm it is allowed | n/a |
| **TPS** (throughput per second) and whether it is per bind or per account | Throttling; exceeding it gives `ESME_RTHROTTLED` | `TEXTIFY_SMPP_TPS` |
| **IP whitelisting**: give them your VPS public IP (`curl -4 ifconfig.me`) | Binds from other IPs are refused | n/a |
| **Delivery receipts**: confirm `registered_delivery=1` is honoured and the `deliver_sm` receipt text format (`id:… stat:DELIVRD …`), and whether the receipt `id` is hex or decimal | Status updates and refunds | n/a |
| **Long messages**: UDH concatenation or `message_payload`? | Multi-part SMS | n/a |
| **Encoding**: `data_coding` 0 = GSM-7 default alphabet, 8 = UCS-2 | Swahili and emoji text | n/a |
| **Alphanumeric sender**: `source_addr_ton=5, npi=0` accepted? | Sender IDs | n/a |
| **Inbound (MO)**: a short code or long number for replies and STOP, delivered over the same bind? Or HTTP push to `https://api.bermiconnect.co.tz/v1/inbound/textify`? | Opt-outs and `message.inbound` | `INBOUND_WEBHOOK_TOKEN` if HTTP |
| **Error code list** (`command_status` and DLR `err:` values) | Mapping `error_code` for customers | n/a |
| **Pricing per network**, billing (prepaid or postpaid), and a balance or usage report | Your margin over TZS 18 | `SMS_PRICE_TZS` |
| **Sender ID registration process** per network and lead time | Customer onboarding | n/a |
| **Support contact and escalation** (24/7 NOC), maintenance windows | Incidents | n/a |

### 8.2 Sender ID registration (TCRA)

Tanzanian networks only deliver alphanumeric sender IDs that are registered with them, under TCRA's
Electronic and Postal Communications (EPOCA) rules on unsolicited messages and consumer protection.
In practice:

- Each sender ID is at most 11 characters (letters and digits) and must clearly identify the
  organisation. Names that imitate banks, mobile money, government bodies or other brands are refused.
- Registration goes through Textify to each network (Vodacom, Yas/Tigo-Zantel, Airtel, Halotel, TTCL).
  Usually needed: a request letter on letterhead, BRELA certificate or school registration, TIN,
  intended use and sample messages. Lead time is typically 3 to 7 working days, and networks may differ.
- Promotional content must give the recipient a way to opt out (STOP), and must not be sent at
  unreasonable hours. Transactional traffic (OTPs, receipts, school notices to parents) is treated more
  leniently, but still needs a registered sender.
- Keep records of consent and of what was sent; TCRA can ask for them.
- Register the platform default `BERMI` first, before go-live.

Workflow in Bermi Connect: the customer requests a sender ID in the dashboard (status `pending`) →
you submit the documents to Textify → when Textify confirms it is live on the networks, approve it in
**Admin → Sender IDs** (`POST /v1/admin/sender-ids/:id/approve`). Do not approve before the networks
confirm, or messages will be rejected and refunded.

### 8.3 Connect and test

```bash
# from the VPS, before configuring the app:
nc -vz $TEXTIFY_SMPP_HOST $TEXTIFY_SMPP_PORT                     # TCP reachable (whitelisting works)
openssl s_client -connect $TEXTIFY_SMPP_HOST:$TEXTIFY_SMPP_PORT  # if TLS: certificate chain is valid
```

Put the credentials in `.env`, then:

```bash
docker compose up -d --force-recreate worker api
docker compose logs -f worker      # look for "SMPP bound" and enquire_link every 30 s
curl -s https://api.bermiconnect.co.tz/v1/health   # "smpp":"bound"
```

Send to each network with your own phones (one Vodacom, Yas/Tigo, Airtel, Halotel, TTCL number) using a
**live** key: a short GSM-7 message, a 200-character message (2 parts), and a Swahili + emoji message
(UCS-2). Check that each arrives, that the parts are joined, that the status goes to `delivered`, and that
a message to a switched-off phone eventually goes to `failed` and is refunded. Reply `STOP` from one
phone and check that the contact is marked opted out.

If the bind fails: `ESME_RBINDFAIL` / `ESME_RINVPASWD` means credentials; a connection reset straight
after connecting usually means the IP is not whitelisted yet; `ESME_RTHROTTLED` means lower
`TEXTIFY_SMPP_TPS`.

## 9. Backups

`deploy/backup.sh` takes a compressed `pg_dump`, verifies it, keeps 14 days locally and copies it
off-site with rclone if a remote named `offsite` exists (Backblaze B2, S3, Google Drive, …).

```bash
sudo mkdir -p /var/backups/bermi && sudo chown bermi:bermi /var/backups/bermi
# optional off-site: rclone config  → create remote "offsite"
crontab -e
```

```cron
# 02:30 EAT every night
30 2 * * * /opt/bermi-connect/deploy/backup.sh >> /var/log/bermi-backup.log 2>&1
```

**Restore** (practise this once before go-live):

```bash
docker compose stop api worker
docker compose exec -T postgres dropdb -U bermi bermi_connect
docker compose exec -T postgres createdb -U bermi bermi_connect
docker compose exec -T postgres pg_restore -U bermi -d bermi_connect --no-owner < /var/backups/bermi/bermi-YYYYMMDD-HHMM.dump
docker compose start api worker
```

Redis holds queues and scheduled jobs (AOF is on). It is rebuilt from Postgres state where possible,
but take a VPS snapshot weekly from your provider's panel as well.

## 10. Monitoring

- **Uptime**: point UptimeRobot / Better Stack / Healthchecks.io at
  `https://api.bermiconnect.co.tz/v1/health` every minute. It returns `503` when the database, Redis
  or the SMPP bind is down. Alert by SMS through a *different* provider, and by email.
- **Backups**: add a heartbeat (e.g. `curl -fsS https://hc-ping.com/<uuid>` at the end of the cron
  line) so a missed backup alerts you.
- **Logs**: `docker compose logs -f --since 10m api worker`. Logs are JSON (pino); rotation is set
  in compose (5 × 20 MB per container). For search, ship them to Better Stack, Grafana Loki or Axiom.
- **Resources**: `docker stats`, `df -h`. Alert at 80% disk. Install `netdata` for a quick dashboard.
- **Business metrics to watch daily**: queue depth (`docker compose exec redis redis-cli llen bull:sms-send:wait`),
  delivery rate (alert if under 85% over an hour), share of `rejected`, refunds, failed webhook
  deliveries, your Textify balance.
- **Security**: `fail2ban-client status sshd`; review `ADMIN_EMAILS`; rotate `JWT_SECRET` only with a
  planned forced logout.

## 11. Updating

```bash
cd /opt/bermi-connect
./deploy/backup.sh
git pull
docker compose build
docker compose run --rm api npm run migrate
docker compose up -d
docker compose ps
```

The worker drains in-flight jobs on SIGTERM; scheduled jobs live in Redis and survive restarts.
Updating `docs/` needs no rebuild (it is a read-only bind mount).

## 12. Go-live checklist

**Infrastructure**
- [ ] Static IP whitelisted by Textify; `nc -vz` to the SMSC succeeds
- [ ] DNS for `app`, `api`, `docs` resolves; HTTPS valid on all three
- [ ] UFW allows only 22, 80, 443; container ports bound to 127.0.0.1 (`ss -tlnp`)
- [ ] SSH password login disabled; fail2ban running; unattended-upgrades on

**Configuration**
- [ ] `NODE_ENV=production` (disables instant `manual` top-ups)
- [ ] Strong unique `JWT_SECRET`, `POSTGRES_PASSWORD`, `INBOUND_WEBHOOK_TOKEN`; `.env` is `chmod 600` and not in git
- [ ] `CORS_ORIGINS` limited to the app and docs domains
- [ ] `ADMIN_EMAILS` set; admin account created and can log in
- [ ] `SMS_PRICE_TZS`, `SIGNUP_FREE_CREDIT_TZS`, `DEFAULT_SENDER_ID` confirmed

**SMS**
- [ ] `/v1/health` shows `"smpp":"bound"` and stays bound for 24 h (enquire_link OK)
- [ ] `BERMI` sender ID registered on all networks
- [ ] Test sends delivered on Vodacom, Yas/Tigo, Airtel, Halotel, TTCL
- [ ] Multi-part GSM-7 and UCS-2 messages join correctly on handsets
- [ ] DLRs update status; a failed message is refunded
- [ ] STOP reply opts out; `message.inbound` webhook fires
- [ ] `TEXTIFY_SMPP_TPS` matches the contract; a 1000-recipient send completes without throttling errors

**Money**
- [ ] Payment gateway (Selcom / AzamPay / ClickPesa) wired into `paymentProvider.initiate()` and its callback verified
- [ ] Test top-up with each method (M-Pesa, Tigo Pesa, Airtel Money, card) credits the wallet once
- [ ] Transactions balance: top-ups − charges + refunds = wallet balance for a test account

**Operations**
- [ ] Nightly backup runs, is copied off-site, and a restore was tested
- [ ] Uptime and backup heartbeat alerts reach a phone
- [ ] Docs site live, `openapi.yaml` downloadable, Try-it works against production with a test key
- [ ] Terms of service, privacy policy and acceptable-use (no spam) published on the app
- [ ] Support email monitored

## Troubleshooting

| Symptom | Check |
| --- | --- |
| `smpp: down` | `docker compose logs worker`; IP whitelist; credentials; TLS flag matches the port |
| Messages stuck `queued` | Worker running? `docker compose ps worker`; Redis healthy; SMPP bound |
| Stuck `sent`, never `delivered` | DLRs not arriving: confirm `registered_delivery` with Textify and the receipt `id` format matches `provider_message_id` |
| All `rejected` for one network | Sender ID not registered on that network |
| 502 from Caddy | Container down or unhealthy: `docker compose ps`, `docker compose logs api` |
| Certificate not issued | DNS not pointing at the VPS, Cloudflare proxy on, or port 80 blocked |
