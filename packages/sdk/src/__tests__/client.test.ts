import { describe, it, expect, vi } from 'vitest';
import { MangroveClient } from '../client';
import type { Signer } from '../types';

const mockTransportInstance = {
  connect: vi.fn().mockResolvedValue(undefined),
  disconnect: vi.fn().mockResolvedValue(undefined),
  callTool: vi.fn().mockResolvedValue({}),
};

vi.mock('../transport/mcp', () => ({
  McpTransport: class MockMcpTransport {
    connect = mockTransportInstance.connect;
    disconnect = mockTransportInstance.disconnect;
    callTool = mockTransportInstance.callTool;
    constructor(_url: string, _apiKey?: string) {}
  },
}));

vi.mock('../transport/rest', () => ({
  RestTransport: class MockRestTransport {
    connect = mockTransportInstance.connect;
    disconnect = mockTransportInstance.disconnect;
    callTool = mockTransportInstance.callTool;
    constructor(_url: string, _apiKey?: string) {}
  },
}));

const mockSigner: Signer = {
  getAddress: vi.fn().mockResolvedValue('0xWallet'),
  signTransaction: vi.fn().mockResolvedValue('0xsigned'),
  getSupportedChainIds: vi.fn().mockResolvedValue([1, 8453]),
};

describe('MangroveClient', () => {
  it('creates MCP transport by default', () => {
    const client = new MangroveClient({
      url: 'https://api.mangrovemarkets.com',
      signer: mockSigner,
    });
    expect(client).toBeDefined();
  });

  it('creates REST transport when specified', () => {
    const client = new MangroveClient({
      url: 'https://api.mangrovemarkets.com',
      signer: mockSigner,
      transport: 'rest',
    });
    expect(client).toBeDefined();
  });

  it('exposes dex service', () => {
    const client = new MangroveClient({
      url: 'https://api.mangrovemarkets.com',
      signer: mockSigner,
    });
    expect(client.dex).toBeDefined();
    expect(client.dex.getQuote).toBeDefined();
    expect(client.dex.swap).toBeDefined();
  });

  it('connect delegates to transport', async () => {
    const client = new MangroveClient({
      url: 'https://api.mangrovemarkets.com',
      signer: mockSigner,
    });
    await client.connect();
    expect(mockTransportInstance.connect).toHaveBeenCalled();
  });

  it('disconnect delegates to transport', async () => {
    const client = new MangroveClient({
      url: 'https://api.mangrovemarkets.com',
      signer: mockSigner,
    });
    await client.connect();
    await client.disconnect();
    expect(mockTransportInstance.disconnect).toHaveBeenCalled();
  });
});
