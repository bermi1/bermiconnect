import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { normalizePhone } from '../src/lib/phone.js';
import { renderTemplate } from '../src/lib/render.js';
import { cleanText, countSegments, splitParts } from '../src/lib/segments.js';
import { parseReceipt } from '../src/lib/dlr.js';

describe('segments (Textify rule: plain text, ceil(len/160))', () => {
  it('empty / short message is 1 segment', () => {
    assert.equal(countSegments('').segments, 1);
    assert.deepEqual(countSegments('Habari'), { encoding: 'GSM7', length: 6, segments: 1, per_segment: 160, remaining: 154, removed: [] });
  });
  it('160 = 1, 161 = 2, 320 = 2, 321 = 3 (no 153-char UDH parts)', () => {
    assert.equal(countSegments('a'.repeat(160)).segments, 1);
    assert.equal(countSegments('a'.repeat(161)).segments, 2);
    assert.equal(countSegments('a'.repeat(306)).segments, 2);
    assert.equal(countSegments('a'.repeat(320)).segments, 2);
    assert.equal(countSegments('a'.repeat(321)).segments, 3);
  });
  it('former GSM extension chars count once (plain ASCII)', () => {
    assert.equal(countSegments('[]{}^~|\\'.repeat(20)).length, 160);
    assert.equal(countSegments('[]{}^~|\\'.repeat(20)).segments, 1);
  });
  it('emoji are removed and never switch to a 70-char mode', () => {
    const s = countSegments('Asante sana 🙏'.padEnd(150, '.'));
    assert.equal(s.encoding, 'GSM7');
    assert.equal(s.segments, 1);
    assert.deepEqual(s.removed, ['🙏']);
  });
  it('accents and euro are transliterated before counting', () => {
    assert.equal(cleanText('Café €5'), 'Cafe EUR5');
  });
  it('splitParts (UDH mode only) uses 153-char parts', () => {
    const parts = splitParts('a'.repeat(400));
    assert.deepEqual(parts.map((p) => p.length), [153, 153, 94]);
    assert.deepEqual(splitParts('short'), ['short']);
  });
});

describe('phone', () => {
  it('normalises Tanzanian formats', () => {
    for (const v of ['0712345678', '712345678', '255712345678', '+255712345678', '+255 712 345 678', '00255712345678', '0712-345-678'])
      assert.equal(normalizePhone(v), '+255712345678', v);
    assert.equal(normalizePhone('0612345678'), '+255612345678');
  });
  it('rejects junk', () => {
    for (const v of ['', 'abc', '0512345678', '07123', '2551234', '+25571234567']) assert.equal(normalizePhone(v), null, v);
  });
  it('accepts other international numbers', () => {
    assert.equal(normalizePhone('+254712345678'), '+254712345678');
  });
});

describe('render', () => {
  it('renders contact fields', () => {
    assert.equal(
      renderTemplate('Hi {{first_name}} {{ last_name }}, fee {{fee_balance}}{{missing}}', { first_name: 'Amina', last_name: 'M', fields: { fee_balance: '10,000' } }),
      'Hi Amina M, fee 10,000',
    );
    assert.equal(renderTemplate('Your code is {{code}}', null, { code: '123456' }), 'Your code is 123456');
  });
});

describe('dlr parse', () => {
  it('parses standard receipt text', () => {
    assert.deepEqual(parseReceipt('id:abc123 sub:001 dlvrd:001 submit date:2611051200 done date:2611051201 stat:DELIVRD err:000 text:Hi'), {
      id: 'abc123',
      stat: 'DELIVRD',
      err: '000',
    });
    assert.equal(parseReceipt('hello'), null);
  });
});
