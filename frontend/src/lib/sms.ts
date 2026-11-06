import { fixGsm, normalizeTzPhone } from './smsText';
// GSM 03.38 basic charset + extension table (extension chars count as 2 septets)
const GSM_BASIC =
  '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà';
const GSM_EXT = '^{}\\[~]|€\f';
const basic = new Set(Array.from(GSM_BASIC));
const ext = new Set(Array.from(GSM_EXT));

export const PRICE_TZS = 18;

export interface SegmentInfo { encoding: 'GSM7' | 'UCS2'; length: number; segments: number; perSegment: number; remaining: number; nonGsm: string[] }

export function analyse(text: string): SegmentInfo {
  const chars = Array.from(text);
  const nonGsm = chars.filter((c) => !basic.has(c) && !ext.has(c));
  if (nonGsm.length === 0) {
    const length = chars.reduce((n, c) => n + (ext.has(c) ? 2 : 1), 0);
    const single = length <= 160;
    const perSegment = single ? 160 : 153;
    const segments = length === 0 ? 0 : single ? 1 : Math.ceil(length / 153);
    return { encoding: 'GSM7', length, segments, perSegment, remaining: segments === 0 ? 160 : segments * perSegment - length, nonGsm: [] };
  }
  // UCS-2 counts UTF-16 code units
  const length = text.length;
  const single = length <= 70;
  const perSegment = single ? 70 : 67;
  const segments = length === 0 ? 0 : single ? 1 : Math.ceil(length / 67);
  return { encoding: 'UCS2', length, segments, perSegment, remaining: segments * perSegment - length, nonGsm: Array.from(new Set(nonGsm)).slice(0, 6) };
}

export const SAMPLE_CONTACT: Record<string, string> = {
  first_name: 'Amina', last_name: 'Mushi', student_name: 'Neema', class: 'Form 4', balance: '150,000', date: '12 Nov',
};

export function render(body: string, vars: Record<string, string | undefined | null> = SAMPLE_CONTACT) {
  return body.replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (m, k: string) => (k in vars ? (vars[k] ?? '').toString() : /^[a-zA-Z0-9_]+$/.test(k) ? '' : m));
}

export const TAGS = [
  { tag: '{{first_name}}', label: 'First name' },
  { tag: '{{last_name}}', label: 'Last name' },
];

/** Normalise TZ phone numbers to E.164. Returns null if invalid. (Shared with the backend.) */
export function normalisePhone(raw: string): string | null {
  return normalizeTzPhone(raw);
}

export { fixGsm, cleanPhoneCell, pickRowPhone, renderRow, extractTags, sampleRewrite } from './smsText';
export type { GsmFix, PhoneCell, WriteAction } from './smsText';

/** Info for the "Fix special characters" suggestion, or null when there is nothing worth fixing. */
export function gsmSuggestion(text: string, recipients = 1) {
  const fix = fixGsm(text);
  if (!fix.changed) return null;
  const before = analyse(render(text));
  const after = analyse(render(fix.text));
  return { ...fix, before, after, saved: Math.max(0, (before.segments - after.segments) * Math.max(recipients, 1)) };
}

export function splitPhones(input: string) {
  const parts = input.split(/[\n,;]+/).map((p) => p.trim()).filter(Boolean);
  const valid: string[] = [];
  const invalid: string[] = [];
  parts.forEach((p) => {
    const n = normalisePhone(p);
    if (n) { if (!valid.includes(n)) valid.push(n); } else invalid.push(p);
  });
  return { valid, invalid };
}
