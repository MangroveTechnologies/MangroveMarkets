import { MangroveClient } from '@mangrovemarkets/sdk';
import type { OpenClawMangroveConfig } from './config';

let _instance: MangroveClient | null = null;

export function getMangroveClient(config: OpenClawMangroveConfig): MangroveClient {
  if (!_instance) {
    _instance = new MangroveClient({
      url: config.url,
      transport: config.transport ?? 'mcp',
      apiKey: config.apiKey,
    });
  }
  return _instance;
}

export function resetClient(): void {
  _instance = null;
}
