import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { aiWrite } from '../src/ai/index.js';
import { MockProvider } from '../src/ai/mock.js';
import { buildUserPrompt, SYSTEM_PROMPT, tidyModelText } from '../src/ai/prompt.js';
import type { AiProvider } from '../src/ai/types.js';
import { digitRuns, validateReply } from '../src/ai/validate.js';

class Scripted implements AiProvider {
  name = 'scripted';
  calls: string[] = [];
  constructor(private replies: string[]) {}
  async complete(_s: string, u: string) {
    this.calls.push(u);
    return this.replies[Math.min(this.calls.length - 1, this.replies.length - 1)];
  }
}

describe('system prompt', () => {
  it('states every required rule', () => {
    for (const re of [/SMS text only/i, /GSM-7/, /no emoji/i, /curly quotes/i, /long dashes/i, /160 characters/, /\{\{tag\}\}/, /number, date, time, amount/i, /Never invent facts/i, /Tanzanian Swahili/]) {
      assert.match(SYSTEM_PROMPT, re);
    }
  });
  it('wraps input and includes feedback on retry', () => {
    const u = buildUserPrompt({ action: 'shorten', text: 'Hi {{a}}', prompt: '', feedback: ['Keep these tags exactly: {{a}}'] });
    assert.match(u, /<input>\nHi \{\{a\}\}\n<\/input>/);
    assert.match(u, /previous answer broke these rules/);
  });
  it('strips wrappers', () => {
    assert.equal(tidyModelText('Here is the SMS: "Habari mzazi"'), 'Habari mzazi');
  });
});

describe('validators', () => {
  it('passes a good reply', () => {
    const r = validateReply('shorten', 'Dear {{first_name}}, pay TZS 150,000 by 15 Nov.', 'Habari {{first_name}}, lipa TZS 150,000 kabla 15 Nov.');
    assert.equal(r.ok, true);
  });
  it('catches a missing tag', () => {
    const r = validateReply('swahili', 'Dear {{first_name}}, hello', 'Mpendwa mzazi, habari');
    assert.equal(r.ok, false);
    assert.match(r.problems[0], /\{\{first_name\}\}/);
  });
  it('catches a changed number but not for write', () => {
    assert.equal(validateReply('shorten', 'Pay 150,000 by 15/11', 'Pay 150,000 by 16/11').ok, false);
    assert.equal(validateReply('write', 'remind about 15/11', 'Kikao ni kesho').ok, true);
  });
  it('ignores digits inside tags', () => {
    assert.deepEqual(digitRuns('{{B/MATH 2}} score 45'), ['45']);
  });
  it('GSM-cleans replies and flags emoji', () => {
    const r = validateReply('friendlier', 'Hi', '“Habari” – karibu');
    assert.equal(r.text, '"Habari" - karibu');
    assert.equal(r.ok, true);
    assert.equal(validateReply('friendlier', 'Hi', 'Karibu 🎉').ok, false);
  });
});

describe('aiWrite', () => {
  it('retries once on a failed check, then succeeds', async () => {
    const p = new Scripted(['Habari mzazi', 'Habari {{first_name}}']);
    const r = await aiWrite({ action: 'swahili', text: 'Hello {{first_name}}', prompt: '' }, p);
    assert.equal(p.calls.length, 2);
    assert.equal(r.text, 'Habari {{first_name}}');
    assert.deepEqual(r.warnings, []);
    assert.equal(r.attempts, 2);
  });
  it('returns the text with warnings after the retry also fails', async () => {
    const p = new Scripted(['Lipa 100', 'Lipa 100']);
    const r = await aiWrite({ action: 'shorten', text: 'Pay 150 now', prompt: '' }, p);
    assert.equal(p.calls.length, 2);
    assert.equal(r.text, 'Lipa 100');
    assert.ok(r.warnings.some((w) => /150/.test(w)));
  });
  it('reports length, segments and encoding', async () => {
    const r = await aiWrite({ action: 'shorten', text: 'x', prompt: '' }, new Scripted(['a'.repeat(170)]));
    assert.equal(r.segments, 2);
    assert.equal(r.encoding, 'GSM7');
    assert.ok(r.warnings.some((w) => /2 SMS/.test(w)));
  });
  it('mock provider is deterministic and keeps tags', async () => {
    const a = await aiWrite({ action: 'swahili', text: 'Dear parent, fees for {{student}} are due Friday.', prompt: '' }, new MockProvider());
    const b = await aiWrite({ action: 'swahili', text: 'Dear parent, fees for {{student}} are due Friday.', prompt: '' }, new MockProvider());
    assert.equal(a.text, b.text);
    assert.match(a.text, /\{\{student\}\}/);
  });
  it('mock test hook exercises the retry', async () => {
    const r = await aiWrite({ action: 'shorten', text: 'Hi {{first_name}} [mock-drop-tags]', prompt: '' }, new MockProvider());
    assert.equal(r.attempts, 2);
    assert.match(r.text, /\{\{first_name\}\}/);
  });
});
