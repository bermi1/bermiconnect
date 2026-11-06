import type { WriteAction } from '../lib/smsText.js';

export type { WriteAction };

export interface AiRequest {
  action: WriteAction;
  /** the text to transform (every action except 'write') */
  text: string;
  /** the one-line instruction ('write' only) */
  prompt: string;
  /** set on the retry: what the previous attempt got wrong */
  feedback?: string[];
}

/** A text-generation provider. Small on purpose so another vendor can be added later. */
export interface AiProvider {
  readonly name: string;
  complete(system: string, user: string): Promise<string>;
}

export class AiNotConfiguredError extends Error {
  constructor() {
    super('AI help is not switched on for this server (ANTHROPIC_API_KEY is not set)');
  }
}

export class AiProviderError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
  }
}
