import type { AiProvider } from './types.js';
import { AiProviderError } from './types.js';

/** Anthropic Messages API over plain fetch (no SDK dependency). */
export class AnthropicProvider implements AiProvider {
  readonly name = 'anthropic';
  constructor(
    private apiKey: string,
    private model: string,
    private baseUrl = 'https://api.anthropic.com',
    private timeoutMs = 20_000,
  ) {}

  async complete(system: string, user: string): Promise<string> {
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}/v1/messages`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: 400,
          temperature: 0.3,
          system,
          messages: [{ role: 'user', content: user }],
        }),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (e: any) {
      throw new AiProviderError(`AI provider unreachable: ${e?.name === 'TimeoutError' ? 'timed out' : e?.message ?? e}`);
    }
    const body: any = await res.json().catch(() => null);
    if (!res.ok) throw new AiProviderError(`AI provider error ${res.status}: ${body?.error?.message ?? 'unknown'}`, res.status);
    const text = (body?.content ?? [])
      .filter((b: any) => b?.type === 'text')
      .map((b: any) => b.text)
      .join('')
      .trim();
    if (!text) throw new AiProviderError('AI provider returned no text');
    return text;
  }
}
