import type { MangrovePluginConfig } from '../config';

export interface StatusResult {
  url: string;
  transport: string;
  connected: boolean;
}

export function handleStatus(config: MangrovePluginConfig, isConnected: boolean): StatusResult {
  return {
    url: config.url,
    transport: config.transport,
    connected: isConnected,
  };
}
