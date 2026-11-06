import { sampleRewrite, type WriteAction } from '../lib/smsText.js';
import type { AiProvider } from './types.js';

/**
 * Deterministic provider for local tests (AI_PROVIDER=mock). Never selected when NODE_ENV=production.
 * It reads the action and input back out of the user prompt built by prompt.ts.
 */
export class MockProvider implements AiProvider {
  readonly name = 'mock';
  async complete(_system: string, user: string): Promise<string> {
    const action = (/^Action: (\w+)/m.exec(user)?.[1] ?? 'shorten') as WriteAction;
    const body = /<input>\n([\s\S]*?)\n<\/input>/.exec(user)?.[1] ?? '';
    // A test hook: an input containing "[mock-drop-tags]" makes the first attempt lose its tags,
    // so the validator + retry path can be exercised end-to-end.
    if (body.includes('[mock-drop-tags]') && !user.includes('Your previous answer')) return 'Habari mzazi, karibu.';
    const clean = body.replace('[mock-drop-tags]', '').trim();
    return action === 'write' ? sampleRewrite('write', '', clean) : sampleRewrite(action, clean);
  }
}
