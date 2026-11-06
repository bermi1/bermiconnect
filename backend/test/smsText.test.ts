import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { cleanPhoneCell, countSms, extractTags, pickRowPhone, renderRow, sampleRewrite, sanitizeSms } from '../src/lib/smsText.js';
import { countSegments } from '../src/lib/segments.js';
import { parseCsvText } from './helpers.js';

const here = path.dirname(fileURLToPath(import.meta.url));

describe('shared smsText copy', () => {
  it('frontend copy is identical to the backend copy', () => {
    const a = fs.readFileSync(path.join(here, '../src/lib/smsText.ts'), 'utf8');
    const b = fs.readFileSync(path.join(here, '../../frontend/src/lib/smsText.ts'), 'utf8');
    assert.equal(b, a, 'frontend/src/lib/smsText.ts must be an exact copy of backend/src/lib/smsText.ts');
  });
});

describe('sanitizeSms (Textify plain text)', () => {
  it('transliterates curly quotes, long dashes, ellipsis and non-breaking spaces', () => {
    const r = sanitizeSms('\u201CKaribu\u201D \u2013 it\u2019s due\u2026\u00A0Friday \u2014 ok');
    assert.equal(r.text, '"Karibu" - it\'s due... Friday - ok');
    assert.equal(r.changed, 7);
    assert.deepEqual(r.removed, []);
  });
  it('leaves plain ASCII untouched, including brackets and braces', () => {
    const s = 'Habari {{first_name}}! Ada: TZS 150,000 [Term 3] ~ ^ |';
    assert.deepEqual(sanitizeSms(s), { text: s, changed: 0, chars: [], removed: [] });
  });
  it('strips accents, converts currency and drops zero-width characters', () => {
    assert.equal(sanitizeSms('Caf\u00E1 na\u200B J\u00F4 \u00E9t\u00E9 \u20AC10 \u00A35').text, 'Cafa na Jo ete EUR10 GBP5');
  });
  it('removes emoji (Textify would) and reports them', () => {
    const r = sanitizeSms('Asante \uD83D\uDE4F\uD83C\uDF89');
    assert.equal(r.text, 'Asante ');
    assert.deepEqual(r.removed, ['\uD83D\uDE4F', '\uD83C\uDF89']);
  });
  it('countSms bills ceil(len/160) on the cleaned text', () => {
    assert.equal(countSms('\u201CJUMA\u201D \u2013 Wastani 45.4, Div III, Nafasi 15/25.').segments, 1);
    assert.equal(countSms('x'.repeat(161)).segments, 2);
    assert.equal(countSms('').segments, 1);
  });
});

describe('cleanPhoneCell', () => {
  const ok = (v: unknown, e164: string, alt: string | null = null) => {
    const r = cleanPhoneCell(v);
    assert.equal(r.problem, null, `${String(v)}: ${r.reason}`);
    assert.equal(r.phone, e164);
    assert.equal(r.alt, alt);
  };
  it('handles every format in the sample sheet', () => {
    ok('0712 345 601', '+255712345601');
    ok('255754123402', '+255754123402');
    ok('+255 683 111 203', '+255683111203');
    ok('0655-123-404', '+255655123404');
    ok('0655.123.404', '+255655123404');
    ok('255 715 667 412', '+255715667412');
    ok('712345601', '+255712345601');
    ok('+255744223417', '+255744223417');
  });
  it('uses the raw numeric cell value (leading 0 lost)', () => {
    ok(712345410, '+255712345410');
    ok(255754123402, '+255754123402');
  });
  it('takes the first of two numbers and keeps the second', () => {
    ok('0754 889 423 / 0784 889 424', '+255754889423', '+255784889424');
    ok('0754889423, 0784889424', '+255754889423', '+255784889424');
    ok('0754889423 au 0784889424', '+255754889423', '+255784889424');
  });
  it('reports blank and "Hana simu"', () => {
    assert.equal(cleanPhoneCell('').problem, 'missing');
    assert.equal(cleanPhoneCell(null).problem, 'missing');
    for (const v of ['Hana simu', 'hakuna', 'N/A', '-']) assert.equal(cleanPhoneCell(v).problem, 'no_phone', v);
  });
  it('flags scientific notation and never guesses', () => {
    const r = cleanPhoneCell('7.12346E+08');
    assert.equal(r.problem, 'excel_shortened');
    assert.equal(r.phone, null);
    assert.match(r.reason!, /Excel shortened this number/);
    assert.equal(cleanPhoneCell('7,12346e8').problem, 'excel_shortened');
  });
  it('flags too-short and non-integer numbers', () => {
    const r = cleanPhoneCell('07123456');
    assert.equal(r.problem, 'invalid');
    assert.match(r.reason!, /short/i);
    assert.equal(cleanPhoneCell(712346000.5).problem, 'invalid');
  });
});

describe('pickRowPhone', () => {
  it('falls back to the second column', () => {
    const r = pickRowPhone('', '0715 000 108');
    assert.equal(r.to, '+255715000108');
    assert.equal(r.usedFallback, true);
    assert.equal(r.primary.problem, 'missing');
  });
  it('rescues the E+08 row with the second column but still reports it', () => {
    const r = pickRowPhone('7.12346E+08', '0712 345 410');
    assert.equal(r.to, '+255712345410');
    assert.equal(r.primary.problem, 'excel_shortened');
  });
  it('keeps the second column as alt when the first is good', () => {
    assert.equal(pickRowPhone('0712345601', '0754345601').alt, '+255754345601');
  });
});

describe('tags', () => {
  it('extracts and renders tags with spaces, case-insensitively', () => {
    const t = 'Mzazi wa {{JINA LA MWANAFUNZI}}: wastani {{ wastani }}, {{DIV}}.';
    assert.deepEqual(extractTags(t), ['{{JINA LA MWANAFUNZI}}', '{{wastani}}', '{{DIV}}']);
    assert.equal(renderRow(t, { 'JINA LA MWANAFUNZI': 'JUMA ALLY', WASTANI: 45.4, DIV: 'III' }), 'Mzazi wa JUMA ALLY: wastani 45.4, III.');
  });
});

describe('sample sheet end to end (shared helpers)', () => {
  it('23 sendable, 2 unsendable, the E+08 row flagged', () => {
    const csv = fs.readFileSync(path.join(here, '../../research/sample-results-form2.csv'), 'utf8');
    const rows = parseCsvText(csv);
    const header = rows.findIndex((r) => r.includes('NAMBA YA MZAZI'));
    assert.equal(header, 3);
    const p1 = rows[header].indexOf('NAMBA YA MZAZI');
    const p2 = rows[header].indexOf('NAMBA YA MZAZI 2');
    const data = rows.slice(header + 1).filter((r) => r.some((c) => c.trim()));
    assert.equal(data.length, 25);
    const picked = data.map((r) => pickRowPhone(r[p1], r[p2]));
    assert.equal(picked.filter((p) => p.to).length, 23);
    const bad = picked.map((p, i) => ({ p, row: header + 2 + i })).filter((x) => !x.p.to);
    assert.deepEqual(bad.map((b) => b.row), [10, 18]); // GODFREY (07123456), ANNA (Hana simu)
    const flagged = picked.findIndex((p) => p.primary.problem === 'excel_shortened');
    assert.equal(data[flagged][2], 'EMMANUEL JOSEPH MALLYA');
  });
});

describe('sampleRewrite (mock / demo)', () => {
  it('keeps tags and numbers when translating', () => {
    const out = sampleRewrite('swahili', 'Dear parent, school fees of TZS 150,000 for {{student}} are due Friday.');
    assert.match(out, /\{\{student\}\}/);
    assert.match(out, /150,000/);
    assert.match(out, /Ijumaa/);
  });
  it('shortens to 1 SMS', () => {
    const long = 'Dear parent, we would like to kindly remind you that the school fees for term three are due this coming Friday. Please make sure that you pay through the school bank account before the deadline. Thank you very much for your cooperation.';
    assert.ok(countSegments(sampleRewrite('shorten', long)).segments === 1);
  });
});
