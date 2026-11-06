import { normalizeTzPhone } from './smsText.js';

/**
 * Phone normalisation to E.164. Tanzania (+255) is the default country.
 * Accepts: 07xxxxxxxx, 06xxxxxxxx, 7xxxxxxxx, 2557xxxxxxxx, +2557xxxxxxxx, 002557..., and
 * other international numbers in +<cc>... form. Spaces, dashes, dots and parentheses are ignored.
 * The implementation lives in smsText.ts, which is shared with the frontend.
 */
export function normalizePhone(input: string | number | null | undefined): string | null {
  return normalizeTzPhone(input);
}

/** E.164 without '+', as SMPP destination_addr with TON 1 / NPI 1. */
export function toSmppAddr(e164: string): string {
  return e164.replace(/^\+/, '');
}
