-- Bermi Connect initial schema
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE accounts (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL,
  type         text NOT NULL DEFAULT 'other' CHECK (type IN ('school','business','developer','other')),
  phone        text,
  balance_tzs  numeric(14,2) NOT NULL DEFAULT 0 CHECK (balance_tzs >= 0),
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id    uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name          text NOT NULL,
  email         text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  role          text NOT NULL DEFAULT 'owner' CHECK (role IN ('owner','admin','member')),
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX users_account_idx ON users(account_id);

CREATE TABLE api_keys (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id   uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name         text NOT NULL,
  prefix       text NOT NULL,
  key_hash     text NOT NULL UNIQUE,
  mode         text NOT NULL CHECK (mode IN ('live','test')),
  last_used_at timestamptz,
  revoked_at   timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX api_keys_account_idx ON api_keys(account_id);

CREATE TABLE sender_ids (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id  uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name        varchar(11) NOT NULL,
  purpose     text,
  status      text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, name)
);

CREATE TABLE contact_groups (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id  uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name        text NOT NULL,
  description text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX contact_groups_account_idx ON contact_groups(account_id);

CREATE TABLE contacts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id  uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  phone       text NOT NULL,
  first_name  text,
  last_name   text,
  fields      jsonb NOT NULL DEFAULT '{}'::jsonb,
  opted_out   boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, phone)
);
CREATE INDEX contacts_phone_idx ON contacts(phone);

CREATE TABLE contact_group_members (
  group_id   uuid NOT NULL REFERENCES contact_groups(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  PRIMARY KEY (group_id, contact_id)
);
CREATE INDEX cgm_contact_idx ON contact_group_members(contact_id);

CREATE TABLE templates (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id  uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name        text NOT NULL,
  body        text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX templates_account_idx ON templates(account_id);

CREATE TABLE campaigns (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id       uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name             text NOT NULL,
  sender_id        text NOT NULL,
  body             text NOT NULL,
  status           text NOT NULL DEFAULT 'draft'
                   CHECK (status IN ('draft','scheduled','sending','completed','failed','cancelled')),
  scheduled_at     timestamptz,
  group_ids        uuid[] NOT NULL DEFAULT '{}',
  total_recipients int NOT NULL DEFAULT 0,
  sent_count       int NOT NULL DEFAULT 0,
  delivered_count  int NOT NULL DEFAULT 0,
  failed_count     int NOT NULL DEFAULT 0,
  cost_tzs         numeric(14,2) NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now(),
  started_at       timestamptz,
  completed_at     timestamptz
);
CREATE INDEX campaigns_account_idx ON campaigns(account_id, created_at DESC);

CREATE TABLE messages (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id          uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  campaign_id         uuid REFERENCES campaigns(id) ON DELETE SET NULL,
  api_key_id          uuid REFERENCES api_keys(id) ON DELETE SET NULL,
  batch_id            uuid,
  contact_id          uuid REFERENCES contacts(id) ON DELETE SET NULL,
  to_phone            text NOT NULL,
  sender_id           text NOT NULL,
  body                text NOT NULL,
  segments            int NOT NULL DEFAULT 1,
  encoding            text NOT NULL DEFAULT 'GSM7' CHECK (encoding IN ('GSM7','UCS2')),
  status              text NOT NULL DEFAULT 'queued'
                      CHECK (status IN ('queued','sent','delivered','failed','rejected')),
  test_mode           boolean NOT NULL DEFAULT false,
  provider_message_id text,
  error_code          text,
  cost_tzs            numeric(14,2) NOT NULL DEFAULT 0,
  refunded            boolean NOT NULL DEFAULT false,
  reference           text,
  scheduled_at        timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  sent_at             timestamptz,
  delivered_at        timestamptz
);
CREATE INDEX messages_account_created_idx ON messages(account_id, created_at DESC);
CREATE INDEX messages_provider_id_idx ON messages(provider_message_id);
CREATE INDEX messages_campaign_idx ON messages(campaign_id);
CREATE INDEX messages_batch_idx ON messages(batch_id);

-- One row per SMPP part (concatenated messages get one provider id per part)
CREATE TABLE message_parts (
  provider_message_id text PRIMARY KEY,
  message_id          uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  part_no             int NOT NULL,
  status              text NOT NULL DEFAULT 'sent',
  updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX message_parts_message_idx ON message_parts(message_id);

CREATE TABLE transactions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id    uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  type          text NOT NULL CHECK (type IN ('topup','charge','refund','bonus')),
  status        text NOT NULL DEFAULT 'completed' CHECK (status IN ('pending','completed','failed')),
  amount_tzs    numeric(14,2) NOT NULL,
  balance_after numeric(14,2),
  description   text,
  reference     text,
  method        text,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX transactions_account_idx ON transactions(account_id, created_at DESC);

CREATE TABLE webhooks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id  uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  url         text NOT NULL,
  events      text[] NOT NULL DEFAULT ARRAY['message.delivered','message.failed','campaign.completed','message.inbound'],
  secret      text NOT NULL,
  active      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX webhooks_account_idx ON webhooks(account_id);

CREATE TABLE inbound_messages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id  uuid REFERENCES accounts(id) ON DELETE SET NULL,
  from_phone  text NOT NULL,
  "to"        text,
  body        text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX inbound_account_idx ON inbound_messages(account_id, received_at DESC);

CREATE TABLE otp_requests (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id  uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  phone       text NOT NULL,
  code_hash   text NOT NULL,
  message_id  uuid REFERENCES messages(id) ON DELETE SET NULL,
  expires_at  timestamptz NOT NULL,
  attempts    int NOT NULL DEFAULT 0,
  verified_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX otp_account_idx ON otp_requests(account_id, created_at DESC);
