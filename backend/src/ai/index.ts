import { config } from '../config.js';
import { countSegments } from '../lib/segments.js';
import { logger } from '../logger.js';
import { AnthropicProvider } from './anthropic.js';
import { MockProvider } from './mock.js';
import { buildUserPrompt, SYSTEM_PROMPT, tidyModelText } from './prompt.js';
import { AiNotConfiguredError, type AiProvider, type AiRequest } from './types.js';
import { validateReply } from './validate.js';

export * from './types.js';

let cached: AiProvider | null | undefined;

/** The configured provider, or null when AI is not switched on. The mock is never used in production. */
export function getProvider(): AiProvider | null {
  if (cached !== undefined) return cached;
  if (config.ai.provider === 'mock' && !config.isProd) cached = new MockProvider();
  else if (config.ai.apiKey) cached = new AnthropicProvider(config.ai.apiKey, config.ai.model, config.ai.baseUrl);
  else cached = null;
  return cached;
}

/** Tests only. */
export function setProvider(p: AiProvider | null | undefined) {
  cached = p;
}

export interface AiWriteResult {
  text: string;
  length: number;
  segments: number;
  encoding: 'GSM7' | 'UCS2';
  warnings: string[];
  attempts: number;
  provider: string;
}

/** Run one AI action with validation; on a failed check retry once, then return with warnings. */
export async function aiWrite(req: AiRequest, provider = getProvider()): Promise<AiWriteResult> {
  if (!provider) throw new AiNotConfiguredError();
  const input = req.action === 'write' ? req.prompt : req.text;
  let attempts = 0;
  let result = null as ReturnType<typeof validateReply> | null;
  let feedback: string[] | undefined;
  while (attempts < 2) {
    attempts++;
    const raw = await provider.complete(SYSTEM_PROMPT, buildUserPrompt({ ...req, feedback }));
    result = validateReply(req.action, input, tidyModelText(raw));
    if (result.ok) break;
    logger.info({ action: req.action, attempt: attempts, problems: result.problems }, 'ai reply failed validation');
    feedback = result.problems;
  }
  const r = result!;
  const seg = countSegments(r.text);
  const warnings = r.ok ? [] : [...r.warnings];
  if (seg.segments > 1) warnings.push(`This is ${seg.segments} SMS per person. Try "Shorten to 1 SMS".`);
  return { text: r.text, length: seg.length, segments: seg.segments, encoding: seg.encoding, warnings, attempts, provider: provider.name };
}
