/**
 * SMS segment counting, matched to Textify billing.
 *
 * Textify delivers plain ASCII text only and removes every other character, so there is no Unicode
 * (UCS-2) mode: text is cleaned first (sanitizeSms) and billed as ceil(length / 160) SMS.
 * `encoding` stays in the API for compatibility and is always 'GSM7' (= plain text).
 *
 * splitParts() is only used by the UDH long-message mode (TEXTIFY_SMPP_LONG_MODE=udh, local mock SMSC);
 * Textify itself takes long messages in one submit_sm via the message_payload TLV.
 */
import { countSms, sanitizeSms } from './smsText.js';

export type Encoding = 'GSM7' | 'UCS2';

export const SEGMENT_CHARS = 160;
const UDH_PART_CHARS = 153;

/** Always plain text now; kept for callers and the DB column. */
export function detectEncoding(_text: string): Encoding {
  return 'GSM7';
}

export function cleanText(text: string): string {
  return sanitizeSms(text).text;
}

export function messageLength(text: string): number {
  return cleanText(text).length;
}

/** Split (cleaned) text into 153-char parts for UDH concatenation. */
export function splitParts(text: string): string[] {
  const t = cleanText(text);
  if (t.length <= SEGMENT_CHARS) return [t];
  const parts: string[] = [];
  for (let i = 0; i < t.length; i += UDH_PART_CHARS) parts.push(t.slice(i, i + UDH_PART_CHARS));
  return parts;
}

export interface SegmentInfo {
  encoding: Encoding;
  length: number;
  segments: number;
  per_segment: number;
  remaining: number;
  /** characters Textify would remove (emoji, symbols) */
  removed: string[];
}

export function countSegments(text: string): SegmentInfo {
  const c = countSms(text);
  return { encoding: 'GSM7', length: c.length, segments: c.segments, per_segment: SEGMENT_CHARS, remaining: c.remaining, removed: c.removed };
}
