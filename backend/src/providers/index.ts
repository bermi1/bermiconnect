import { config } from '../config.js';
import { LogProvider } from './log.js';
import { TextifyHttpProvider } from './textifyHttp.js';
import { TextifySmppProvider } from './textifySmpp.js';
import type { SmsProvider } from './types.js';

export * from './types.js';

let instance: SmsProvider | null = null;

/** Select provider from SMS_PROVIDER: textify_smpp (recommended) | textify_http (backup) | log. */
export function getProvider(): SmsProvider {
  if (instance) return instance;
  switch (config.smsProvider) {
    case 'log':
      instance = new LogProvider();
      break;
    case 'textify_http':
      instance = new TextifyHttpProvider();
      break;
    case 'textify_smpp':
    default:
      instance = new TextifySmppProvider();
  }
  return instance;
}
