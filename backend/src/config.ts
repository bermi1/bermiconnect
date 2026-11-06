import 'dotenv/config';

function str(name: string, def = ''): string {
  const v = process.env[name];
  return v === undefined || v === '' ? def : v;
}
function num(name: string, def: number): number {
  const v = process.env[name];
  if (v === undefined || v === '') return def;
  const n = Number(v);
  if (Number.isNaN(n)) throw new Error(`Env ${name} must be a number`);
  return n;
}
function bool(name: string, def: boolean): boolean {
  const v = process.env[name];
  if (v === undefined || v === '') return def;
  return ['1', 'true', 'yes', 'on'].includes(v.toLowerCase());
}

export const config = {
  nodeEnv: str('NODE_ENV', 'development'),
  isProd: str('NODE_ENV', 'development') === 'production',
  port: num('PORT', 4000),
  databaseUrl: str('DATABASE_URL', 'postgres://bermi:bermi@localhost:5432/bermi_connect'),
  redisUrl: str('REDIS_URL', 'redis://localhost:6379'),
  jwtSecret: str('JWT_SECRET', 'change-me'),
  appUrl: str('APP_URL', 'http://localhost:5173'),
  corsOrigins: str('CORS_ORIGINS', '*'),
  smsProvider: str('SMS_PROVIDER', 'textify_smpp') as 'textify_smpp' | 'textify_http' | 'log',
  smpp: {
    host: str('TEXTIFY_SMPP_HOST', 'localhost'),
    port: num('TEXTIFY_SMPP_PORT', 2775),
    systemId: str('TEXTIFY_SMPP_SYSTEM_ID', 'bermi'),
    password: str('TEXTIFY_SMPP_PASSWORD', 'secret'),
    systemType: str('TEXTIFY_SMPP_SYSTEM_TYPE', ''),
    // Textify requires TLS (smpp.textify.africa:2776). Set false only for the local mock SMSC.
    tls: bool('TEXTIFY_SMPP_TLS', true),
    /** long messages: 'payload' = one submit_sm with message_payload (Textify); 'udh' = 153-char concatenated parts */
    longMode: (str('TEXTIFY_SMPP_LONG_MODE', 'payload') === 'udh' ? 'udh' : 'payload') as 'payload' | 'udh',
    tps: Math.max(1, num('TEXTIFY_SMPP_TPS', 50)),
    enquireLinkMs: num('TEXTIFY_SMPP_ENQUIRE_LINK_MS', 30000),
  },
  smsPriceTzs: num('SMS_PRICE_TZS', 18),
  // TODO(textify): DEFAULT_SENDER_ID must be a sender name APPROVED on Bermi Techs' Textify account,
  // otherwise Textify rejects every message that uses it. Request it in the Textify portal first.
  defaultSenderId: str('DEFAULT_SENDER_ID', 'BERMI'),
  signupFreeCreditTzs: num('SIGNUP_FREE_CREDIT_TZS', 500),
  adminEmails: str('ADMIN_EMAILS', '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean),
  apiKeyRateLimitPerMin: num('API_RATE_LIMIT_PER_MIN', 100),
  inboundToken: str('INBOUND_WEBHOOK_TOKEN', ''),
  workerConcurrency: num('WORKER_CONCURRENCY', 20),
  logLevel: str('LOG_LEVEL', 'info'),
  textify: {
    apiUrl: str('TEXTIFY_API_URL', 'https://portal.textify.africa/api/v1').replace(/\/$/, ''),
    apiKey: str('TEXTIFY_API_KEY', ''),
    /** how often the HTTP route reconciles statuses (ms) */
    pollMs: num('TEXTIFY_POLL_MS', 60_000),
    /** how often sender names are synced from Textify (ms) */
    senderSyncMs: num('TEXTIFY_SENDER_SYNC_MS', 600_000),
  },
  payments: {
    provider: str('PAYMENT_PROVIDER', 'sandbox') as 'sandbox' | 'textify',
    /** sandbox: mobile-money payments confirm this many ms after they start (non-production only) */
    sandboxConfirmMs: num('PAYMENT_SANDBOX_CONFIRM_MS', 4000),
    webhookSecret: str('PAYMENT_WEBHOOK_SECRET', ''),
  },
  /** "Buy SMS" packages (SMS counts) and volume tiers "minSms:priceTzs,..." (default one tier at SMS_PRICE_TZS) */
  smsPackages: str('SMS_PACKAGES', '500,2000,10000').split(',').map((x) => Number(x.trim())).filter((n) => n > 0),
  smsPriceTiers: str('SMS_PRICE_TIERS', ''),
  ai: {
    /** 'anthropic' (default) or 'mock' (deterministic, local tests only; ignored when NODE_ENV=production) */
    provider: str('AI_PROVIDER', 'anthropic') as 'anthropic' | 'mock',
    apiKey: str('ANTHROPIC_API_KEY', ''),
    model: str('ANTHROPIC_MODEL', 'claude-haiku-5-5'),
    baseUrl: str('ANTHROPIC_BASE_URL', 'https://api.anthropic.com'),
    dailyLimit: num('AI_DAILY_LIMIT', 100),
  },
};

export type Config = typeof config;
