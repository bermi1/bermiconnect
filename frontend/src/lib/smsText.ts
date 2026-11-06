/**
 * Shared, dependency-free SMS text helpers.
 *
 * THIS FILE IS SHARED: an identical copy lives at frontend/src/lib/smsText.ts.
 * backend/test/smsText.test.ts fails if the two copies drift apart.
 *
 *  - sanitizeSms():   plain-ASCII text as Textify delivers it (curly quotes, dashes, accents transliterated; emoji removed)
 *  - countSms():      ceil(length / 160) on the cleaned text, the way Textify bills
 *  - normalizeTzPhone(): one phone string to E.164 (+255 default)
 *  - cleanPhoneCell(): one spreadsheet cell to {phone, alt, problem}
 *  - sampleRewrite(): deterministic, phrasebook-based stand-in for the AI writer (tests / demo only)
 */

/* ------------------------------------------------------------------ plain text (Textify rule) */

// Textify delivers plain ASCII text and REMOVES every other character before sending.
// So we transliterate first (curly quotes, dashes, accents, ...) and show the person what will be dropped.
// Billing follows Textify: segments = ceil(length / 160) on the cleaned text, no Unicode mode.

export const SMS_SEGMENT_CHARS = 160;

export const isPlainChar = (ch: string) => ch === '\n' || (ch >= ' ' && ch <= '~');

const REPLACE: Record<string, string> = {
  '\u2018': "'", '\u2019': "'", '\u201A': "'", '\u201B': "'", '\u2032': "'", '\u00B4': "'", '\u2039': "'", '\u203A': "'",
  '\u201C': '"', '\u201D': '"', '\u201E': '"', '\u201F': '"', '\u2033': '"', '\u00AB': '"', '\u00BB': '"',
  '\u2010': '-', '\u2011': '-', '\u2012': '-', '\u2013': '-', '\u2014': '-', '\u2015': '-', '\u2212': '-', '\u2043': '-',
  '\u2026': '...',
  '\u00A0': ' ', '\u2002': ' ', '\u2003': ' ', '\u2004': ' ', '\u2005': ' ', '\u2006': ' ', '\u2007': ' ', '\u2008': ' ',
  '\u2009': ' ', '\u200A': ' ', '\u202F': ' ', '\u205F': ' ', '\u3000': ' ', '\t': ' ',
  '\u200B': '', '\u200C': '', '\u200D': '', '\u2060': '', '\uFEFF': '', '\u00AD': '', '\r': '', '\uFE0F': '',
  '\u2022': '-', '\u00B7': '-', '\u2219': '-', '\u25CF': '-',
  '\u00D7': 'x', '\u00F7': '/', '\u2044': '/',
  '\u00A9': '(c)', '\u00AE': '(R)', '\u2122': 'TM', '\u00B0': ' deg',
  '\u00BD': '1/2', '\u00BC': '1/4', '\u00BE': '3/4',
  '\u00A3': 'GBP', '\u20AC': 'EUR', '\u00A5': 'JPY', '\u00A2': 'c', '\u00A4': '',
  '\u00DF': 'ss', '\u00C6': 'AE', '\u00E6': 'ae', '\u00D8': 'O', '\u00F8': 'o', '\u0152': 'OE', '\u0153': 'oe',
  '\u00A1': '!', '\u00BF': '?', '\u00A7': 'S.', '\u2116': 'No.',
  '\u2028': '\n', '\u2029': '\n', '\u0085': '\n',
};

export interface TextFix {
  /** the text exactly as it will be sent */
  text: string;
  /** characters that were transliterated or removed */
  changed: number;
  /** distinct characters that were transliterated (e.g. curly quotes) */
  chars: string[];
  /** distinct characters that had no plain equivalent and were removed (emoji, symbols) */
  removed: string[];
}

/** Deterministic cleaner: transliterate to plain ASCII, drop what has no equivalent. */
export function sanitizeSms(input: string): TextFix {
  let out = '';
  let changed = 0;
  const chars = new Set<string>();
  const removed = new Set<string>();
  for (const ch of Array.from(input)) {
    if (isPlainChar(ch)) { out += ch; continue; }
    let rep: string | undefined = REPLACE[ch];
    if (rep === undefined) {
      // strip accents (e -> e, A-ring -> A, ...)
      const base = ch.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if (base && base !== ch && Array.from(base).every(isPlainChar)) rep = base;
    }
    changed++;
    if (rep === undefined) { removed.add(ch); continue; }
    out += rep;
    chars.add(ch);
  }
  return { text: out, changed, chars: [...chars], removed: [...removed] };
}

export interface SmsCount {
  /** cleaned text (what Textify will deliver) */
  text: string;
  length: number;
  /** ceil(length / 160), at least 1 */
  segments: number;
  /** characters left before the next SMS */
  remaining: number;
  removed: string[];
  changed: number;
}

/** Count SMS the way Textify bills: ceil(length / 160) on the cleaned text. */
export function countSms(input: string): SmsCount {
  const f = sanitizeSms(input);
  const length = f.text.length;
  const segments = Math.max(1, Math.ceil(length / SMS_SEGMENT_CHARS));
  return { text: f.text, length, segments, remaining: segments * SMS_SEGMENT_CHARS - length, removed: f.removed, changed: f.changed };
}

/* ------------------------------------------------------------------ phones */

/** Tanzanian mobile numbers: 255 + 9 digits starting with 6 or 7. */
const validTz = (digits: string) => /^255[67]\d{8}$/.test(digits);

/**
 * One phone string to E.164. Tanzania (+255) is the default country.
 * Accepts 07xx / 06xx, 7xx / 6xx (leading 0 lost), 2557xx, +2557xx, 002557xx and other +<cc> numbers.
 * Spaces, dashes, dots and parentheses are ignored.
 */
export function normalizeTzPhone(input: string | number | null | undefined): string | null {
  if (input === null || input === undefined) return null;
  let s = String(input).trim().replace(/[\s\-().]/g, '');
  if (!s) return null;
  if (s.startsWith('00')) s = '+' + s.slice(2);
  if (s.startsWith('+')) {
    const digits = s.slice(1);
    if (!/^\d{8,15}$/.test(digits)) return null;
    if (digits.startsWith('255')) return validTz(digits) ? '+' + digits : null;
    return '+' + digits;
  }
  if (!/^\d+$/.test(s)) return null;
  if (s.startsWith('255')) return validTz(s) ? '+' + s : null;
  if (s.startsWith('0') && s.length === 10) {
    const d = '255' + s.slice(1);
    return validTz(d) ? '+' + d : null;
  }
  if (s.length === 9 && /^[67]/.test(s)) return '+255' + s;
  return null;
}

export type PhoneProblem = 'missing' | 'no_phone' | 'excel_shortened' | 'invalid';

export interface PhoneCell {
  /** E.164, or null when the cell has no usable number */
  phone: string | null;
  /** a second number found in the same cell */
  alt: string | null;
  raw: string;
  problem: PhoneProblem | null;
  /** plain-words reason, set when problem is set */
  reason: string | null;
}

const NO_PHONE = /^(-+|—|n\/?a|none|nil|null|hakuna|hana|hana simu|hana namba|hamna|haina|no phone|no number|x|0)$/i;
const SCIENTIFIC = /^[+-]?\d+(?:[.,]\d+)?e[+-]?\d+$/i;
const SPLIT = /\s*(?:\/|,|;|\||\n|&|\bau\b|\bna\b|\bor\b|\band\b)\s*/i;

function reasonFor(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return 'Not a phone number';
  const local = digits.startsWith('255') ? digits.slice(3) : digits.replace(/^0/, '');
  if (local.length < 9) return 'Too short (missing digits)';
  if (local.length > 9) return 'Too long';
  return 'Not a Tanzanian mobile number';
}

/**
 * Clean one spreadsheet cell. `value` is the RAW cell value: a number when Excel stored a number
 * (leading 0 lost, which is fine), a string otherwise. Scientific notation strings are never guessed.
 */
export function cleanPhoneCell(value: unknown): PhoneCell {
  if (value === null || value === undefined || (typeof value === 'string' && !value.trim())) {
    return { phone: null, alt: null, raw: '', problem: 'missing', reason: 'No number' };
  }
  if (typeof value === 'number') {
    const raw = String(value);
    if (!Number.isFinite(value) || !Number.isInteger(value)) {
      return { phone: null, alt: null, raw, problem: 'invalid', reason: 'Not a phone number' };
    }
    const p = normalizeTzPhone(raw);
    return p ? { phone: p, alt: null, raw, problem: null, reason: null } : { phone: null, alt: null, raw, problem: 'invalid', reason: reasonFor(raw) };
  }
  const raw = String(value).trim();
  if (NO_PHONE.test(raw)) return { phone: null, alt: null, raw, problem: 'no_phone', reason: `No number ("${raw}")` };
  if (SCIENTIFIC.test(raw.replace(/\s/g, ''))) {
    return { phone: null, alt: null, raw, problem: 'excel_shortened', reason: 'Excel shortened this number - fix it in the sheet' };
  }
  const parts = raw.split(SPLIT).map((p) => p.trim()).filter(Boolean);
  const found: string[] = [];
  for (const part of parts) {
    const p = normalizeTzPhone(part);
    if (p && !found.includes(p)) found.push(p);
  }
  if (!found.length) {
    if (!/\d/.test(raw)) return { phone: null, alt: null, raw, problem: 'no_phone', reason: `No number ("${raw}")` };
    return { phone: null, alt: null, raw, problem: 'invalid', reason: reasonFor(parts[0] ?? raw) };
  }
  return { phone: found[0], alt: found[1] ?? null, raw, problem: null, reason: null };
}

export interface RowPhone {
  to: string | null;
  /** another number for the same row (second number in the cell, or the second column) */
  alt: string | null;
  /** true when `to` came from the second phone column because the first was unusable */
  usedFallback: boolean;
  /** problem with the first phone column, even if the fallback saved the row */
  primary: PhoneCell;
}

/** Pick the number to send to for one row, using a second column as a fallback. */
export function pickRowPhone(primaryValue: unknown, fallbackValue?: unknown): RowPhone {
  const primary = cleanPhoneCell(primaryValue);
  const second = fallbackValue === undefined ? null : cleanPhoneCell(fallbackValue);
  if (primary.phone) {
    const alt = primary.alt ?? (second?.phone && second.phone !== primary.phone ? second.phone : null);
    return { to: primary.phone, alt, usedFallback: false, primary };
  }
  if (second?.phone) return { to: second.phone, alt: second.alt, usedFallback: true, primary };
  return { to: null, alt: null, usedFallback: false, primary };
}

/* ------------------------------------------------------------------ tags */

export const TAG_RE = /\{\{\s*([^{}]+?)\s*\}\}/g;

/** Distinct {{tags}} in the text, normalised to `{{Name}}` (inner spaces trimmed). */
export function extractTags(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(TAG_RE)) {
    const t = `{{${m[1].trim()}}}`;
    if (!out.includes(t)) out.push(t);
  }
  return out;
}

/** Render {{Column Name}} tags from a row (case-insensitive, spaces allowed). Unknown tags → ''. */
export function renderRow(template: string, row: Record<string, unknown>): string {
  const lower = new Map<string, unknown>();
  for (const [k, v] of Object.entries(row)) lower.set(k.trim().toLowerCase(), v);
  return template.replace(TAG_RE, (_m, key: string) => {
    const v = lower.get(key.trim().toLowerCase());
    return v === undefined || v === null ? '' : String(v).trim();
  });
}

/* ------------------------------------------------------------------ sample rewrite (no AI) */

export type WriteAction = 'write' | 'shorten' | 'swahili' | 'english' | 'friendlier' | 'formal';

// Small phrasebook. Longer phrases first. Used only by the mock provider and the demo build.
const EN_SW: [string, string][] = [
  ['school fees', 'ada ya shule'], ['parents meeting', 'kikao cha wazazi'], ['exam results', 'matokeo ya mtihani'],
  ['report card', 'ripoti'], ['thank you', 'asante'], ['please', 'tafadhali'], ['reminder', 'ukumbusho'],
  ['parents', 'wazazi'], ['parent', 'mzazi'], ['fees', 'ada'], ['due', 'inadaiwa'], ['by', 'kabla ya'],
  ['on', 'tarehe'], ['monday', 'Jumatatu'], ['tuesday', 'Jumanne'], ['wednesday', 'Jumatano'], ['thursday', 'Alhamisi'],
  ['friday', 'Ijumaa'], ['saturday', 'Jumamosi'], ['sunday', 'Jumapili'], ['today', 'leo'], ['tomorrow', 'kesho'],
  ['meeting', 'kikao'], ['school', 'shule'], ['student', 'mwanafunzi'], ['results', 'matokeo'], ['pay', 'lipa'],
  ['hello', 'habari'], ['dear', 'mpendwa'], ['welcome', 'karibu'], ['and', 'na'], ['your', 'yako'], ['at', 'saa'],
  ['term', 'muhula'], ['order', 'oda'], ['ready', 'tayari'], ['offer', 'ofa'], ['customer', 'mteja'],
];
const SW_EN: [string, string][] = EN_SW.map(([en, sw]) => [sw, en]);
const SHORT: [RegExp, string][] = [
  [/\bplease\b/gi, 'pls'], [/\btafadhali\b/gi, 'tafadhali'], [/\bthank you very much\b/gi, 'thanks'], [/\bthank you\b/gi, 'thanks'],
  [/\bwe would like to\b/gi, ''], [/\bkindly\b/gi, ''], [/\bremind you that\b/gi, ''], [/\bthis coming\b/gi, ''],
  [/\bmake sure that you\b/gi, ''], [/\bbefore the deadline\b/gi, ''], [/\bfor your cooperation\b/gi, ''],
  [/\bvery much\b/gi, ''], [/\binformation\b/gi, 'info'], [/\bnumber\b/gi, 'no.'], [/\bapproximately\b/gi, 'about'],
];

function translate(text: string, book: [string, string][]): string {
  const sorted = [...book].sort((a, b) => b[0].length - a[0].length);
  // protect tags so they are never translated
  const tags: string[] = [];
  let s = text.replace(TAG_RE, (m) => { tags.push(m); return `\u0000${tags.length - 1}\u0000`; });
  for (const [from, to] of sorted) {
    s = s.replace(new RegExp(`\\b${from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi'), (m) =>
      m[0] === m[0].toUpperCase() ? to[0].toUpperCase() + to.slice(1) : to);
  }
  return s.replace(/\u0000(\d+)\u0000/g, (_m, i) => tags[Number(i)]);
}

const tidy = (s: string) => s.replace(/[ ]{2,}/g, ' ').replace(/\s+([,.!?])/g, '$1').replace(/^[\s,.]+/, '').trim();

/** Deterministic stand-in for the AI writer. Clearly not AI: a phrasebook and a few rules. */
export function sampleRewrite(action: WriteAction, text = '', prompt = ''): string {
  const src = sanitizeSms(action === 'write' ? prompt : text).text.trim();
  let out: string;
  switch (action) {
    case 'write': {
      const p = src.replace(/^(please\s+)?(write|send|tell|remind|ask|inform|notify)\s+/i, (_m, _p, verb: string) => (verb.toLowerCase() === 'remind' ? 'Reminder to ' : ''));
      out = `Habari, ${p.charAt(0).toLowerCase()}${p.slice(1)}${/[.!?]$/.test(p) ? '' : '.'} Asante.`;
      break;
    }
    case 'shorten': {
      out = src;
      for (const [re, rep] of SHORT) out = out.replace(re, rep);
      out = tidy(out);
      if (out.length > 160) {
        const cut = out.slice(0, 157);
        out = cut.slice(0, Math.max(cut.lastIndexOf(' '), 100)).replace(/[,;:\s]+$/, '') + '...';
      }
      break;
    }
    case 'swahili': out = translate(src, EN_SW); break;
    case 'english': out = translate(src, SW_EN); break;
    case 'friendlier': out = /^(habari|hi|hello|karibu)/i.test(src) ? `${src} Asante sana!` : `Habari! ${src}`; break;
    case 'formal': out = /^(dear|ndugu|mpendwa)/i.test(src) ? src : `Dear Parent/Guardian, ${src.charAt(0).toLowerCase()}${src.slice(1)}`; break;
    default: out = src;
  }
  return sanitizeSms(tidy(out)).text;
}
