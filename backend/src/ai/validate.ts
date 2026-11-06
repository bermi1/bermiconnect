import { extractTags, sanitizeSms, TAG_RE } from '../lib/smsText.js';
import type { WriteAction } from './types.js';

export interface ValidationResult {
  ok: boolean;
  text: string;
  /** rule violations, phrased for the model (used for the retry) */
  problems: string[];
  /** the same problems, phrased for the person */
  warnings: string[];
}

const stripTags = (s: string) => s.replace(TAG_RE, ' ');
export const digitRuns = (s: string) => [...new Set(stripTags(s).match(/\d+/g) ?? [])];

/**
 * Check a model reply against the input.
 *  - every {{tag}} in the input is still present
 *  - every digit sequence in the input is still present (not for 'write')
 *  - characters are cleaned to plain text (Textify removes anything else; emoji are a problem because content is lost)
 */
export function validateReply(action: WriteAction, input: string, reply: string): ValidationResult {
  const fixed = sanitizeSms(reply);
  const text = fixed.text;
  const problems: string[] = [];
  const warnings: string[] = [];

  const outTags = new Set(extractTags(text));
  const missingTags = extractTags(input).filter((t) => !outTags.has(t));
  if (missingTags.length) {
    problems.push(`Keep these tags exactly: ${missingTags.join(', ')}`);
    warnings.push(`Missing ${missingTags.length === 1 ? 'tag' : 'tags'} ${missingTags.join(', ')}. Add ${missingTags.length === 1 ? 'it' : 'them'} back before sending.`);
  }

  if (action !== 'write') {
    const outText = ` ${stripTags(text)} `;
    const lost = digitRuns(input).filter((d) => !new RegExp(`(^|\\D)${d}(\\D|$)`).test(outText));
    if (lost.length) {
      problems.push(`Keep these numbers exactly: ${lost.join(', ')}`);
      warnings.push(`Check the numbers: ${lost.join(', ')} ${lost.length === 1 ? 'is' : 'are'} missing or changed.`);
    }
  }

  if (fixed.removed.length) {
    problems.push(`Use plain characters only (no emoji or symbols). Remove: ${fixed.removed.join(' ')}`);
    warnings.push(`Emoji and special symbols (${fixed.removed.join(' ')}) were removed because SMS can't carry them.`);
  }
  if (!text.trim()) {
    problems.push('Reply with the SMS text.');
    warnings.push('The AI returned an empty message.');
  }
  return { ok: problems.length === 0, text, problems, warnings };
}
