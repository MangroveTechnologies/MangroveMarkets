import { MangroveClient } from '@mangrovemarkets/sdk';
import type { OpenClawMangroveConfig } from './config';

let _instance: MangroveClient | null = null;

/**
 * Get or create the MangroveClient singleton. Returns the existing instance
 * if one has already been created, otherwise creates a new one from config.
 * @param config - The OpenClaw plugin configuration
 * @returns The MangroveClient singleton instance
 */
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

/**
 * Reset the MangroveClient singleton. The next call to getMangroveClient()
 * will create a fresh instance. Useful for testing and reconnection.
 */
export function resetClient(): void {
  _instance = null;
}
