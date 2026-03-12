import type { MangrovePluginConfig } from '../config';

export interface StatusResult {
  url: string;
  transport: string;
  connected: boolean;
}

/**
 * Handle the /mangrove-status command. Returns the current connection state
 * including server URL, transport type, and whether the client is connected.
 * @param config - The plugin configuration
 * @param isConnected - Whether the client is currently connected to the MCP server
 * @returns Status result with url, transport, and connected fields
 */
export function handleStatus(config: MangrovePluginConfig, isConnected: boolean): StatusResult {
  return {
    url: config.url,
    transport: config.transport,
    connected: isConnected,
  };
}
