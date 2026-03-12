export interface ConnectResult {
  url: string;
  transport: 'mcp' | 'rest';
}

export function handleConnect(url: string, transport?: 'mcp' | 'rest'): ConnectResult {
  return { url, transport: transport ?? 'mcp' };
}
