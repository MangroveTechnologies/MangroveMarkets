import { describe, it, expect, vi, beforeEach } from 'vitest';
import { McpTransport } from '../mcp';

const mockConnect = vi.fn().mockResolvedValue(undefined);
const mockClose = vi.fn().mockResolvedValue(undefined);
const mockCallTool = vi.fn().mockResolvedValue({
  content: [{ type: 'text', text: JSON.stringify({ quoteId: 'q-1' }) }],
});

vi.mock('@modelcontextprotocol/sdk/client/index.js', () => ({
  Client: class MockClient {
    connect = mockConnect;
    close = mockClose;
    callTool = mockCallTool;
    constructor(_opts: any) {}
  },
}));

vi.mock('@modelcontextprotocol/sdk/client/streamableHttp.js', () => ({
  StreamableHTTPClientTransport: class MockTransport {
    constructor(_url: any, _opts?: any) {}
  },
}));

describe('McpTransport', () => {
  let transport: McpTransport;

  beforeEach(() => {
    vi.clearAllMocks();
    transport = new McpTransport('https://api.mangrovemarkets.com/mcp');
  });

  it('connect creates MCP client and connects', async () => {
    await transport.connect();
    expect(mockConnect).toHaveBeenCalled();
  });

  it('callTool sends tool call and parses JSON response', async () => {
    await transport.connect();
    const result = await transport.callTool('dex_get_quote', { src: '0xa', dst: '0xb' });
    expect(result).toEqual({ quoteId: 'q-1' });
  });

  it('callTool throws if not connected', async () => {
    await expect(transport.callTool('dex_get_quote', {})).rejects.toThrow('Not connected');
  });

  it('disconnect closes the client', async () => {
    await transport.connect();
    await transport.disconnect();
    expect(mockClose).toHaveBeenCalled();
  });
});
