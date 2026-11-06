export type AccountType = 'school' | 'business' | 'developer' | 'other';

export interface User { id: string; account_id: string; name: string; email: string; role: 'owner' | 'admin' | 'member'; created_at?: string }
export interface Account { id: string; name: string; type: AccountType; phone?: string; balance_tzs: number | string; created_at?: string }
export interface AuthResult { token: string; user: User; account: Account }

export interface DailyStat { date: string; sent: number; delivered: number; failed: number }
export interface AccountStats {
  balance_tzs: number | string; sent_today: number; sent_30d: number; delivered_rate: number;
  campaigns_active: number; contacts_total: number; daily: DailyStat[]; price_per_sms_tzs?: number;
}

export interface Contact {
  id: string; phone: string; first_name?: string | null; last_name?: string | null;
  fields?: Record<string, string> | null; opted_out?: boolean; created_at?: string; group_ids?: string[];
}
export interface Group { id: string; name: string; description?: string | null; created_at?: string; contact_count?: number; member_count?: number }
export interface Template { id: string; name: string; body: string; created_at?: string }
export interface SenderId { id: string; name: string; purpose?: string; status: 'pending' | 'approved' | 'rejected'; created_at?: string }

export type CampaignStatus = 'draft' | 'scheduled' | 'sending' | 'completed' | 'failed' | 'cancelled';
export interface Campaign {
  id: string; name: string; sender_id: string; body: string; status: CampaignStatus;
  scheduled_at?: string | null; group_ids: string[]; total_recipients: number; sent_count: number;
  delivered_count: number; failed_count: number; cost_tzs: number | string; created_at: string;
  started_at?: string | null; completed_at?: string | null;
  source?: 'groups' | 'file'; template?: string | null;
}
export type MessageStatus = 'queued' | 'sent' | 'delivered' | 'failed' | 'rejected';
export interface Message {
  id: string; campaign_id?: string | null; to_phone: string; sender_id: string; body: string;
  segments: number; encoding: 'GSM7' | 'UCS2'; status: MessageStatus; error_code?: string | null;
  cost_tzs: number | string; reference?: string | null; row_ref?: string | null; created_at: string; sent_at?: string | null; delivered_at?: string | null;
}
export interface Transaction {
  id: string; type: 'topup' | 'charge' | 'refund' | 'bonus'; amount_tzs: number | string; balance_after: number | string;
  description?: string; reference?: string; created_at: string; status?: string;
}
export interface ApiKey { id: string; name: string; prefix: string; mode: 'live' | 'test'; last_used_at?: string | null; revoked_at?: string | null; created_at: string; key?: string }
export type WebhookEvent = 'message.delivered' | 'message.failed' | 'campaign.completed' | 'message.inbound';
export interface Webhook { id: string; url: string; events: WebhookEvent[]; secret?: string; active: boolean; created_at: string }
export interface Estimate { recipients: number; segments: number; cost_tzs: number | string }
