-- Textify upstream: sender names are registered on Bermi's single Textify account.
ALTER TABLE sender_ids ADD COLUMN IF NOT EXISTS sample_message text;
ALTER TABLE sender_ids ADD COLUMN IF NOT EXISTS textify_sender_id text;
ALTER TABLE sender_ids ADD COLUMN IF NOT EXISTS textify_status text;      -- requested | approved | declined (as Textify reports it)
ALTER TABLE sender_ids ADD COLUMN IF NOT EXISTS synced_at timestamptz;
ALTER TABLE sender_ids ADD COLUMN IF NOT EXISTS sync_error text;
CREATE INDEX IF NOT EXISTS sender_ids_textify_idx ON sender_ids(textify_sender_id);

-- Buy SMS: one row per payment attempt. The wallet is credited only when the payment completes.
CREATE TABLE IF NOT EXISTS payments (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id     uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  reference      text NOT NULL UNIQUE,
  provider       text NOT NULL,
  method         text NOT NULL CHECK (method IN ('mpesa','airtel','mixx','halopesa','tpesa','card','manual')),
  phone          text,
  sms_count      int NOT NULL,
  amount_tzs     numeric(14,2) NOT NULL,          -- what the customer pays
  credit_tzs     numeric(14,2) NOT NULL,          -- what the wallet receives (sms_count x SMS_PRICE_TZS)
  status         text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','completed','failed','cancelled')),
  checkout_url   text,
  instructions   text,
  provider_ref   text,
  failure_reason text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  completed_at   timestamptz
);
CREATE INDEX IF NOT EXISTS payments_account_idx ON payments(account_id, created_at DESC);
