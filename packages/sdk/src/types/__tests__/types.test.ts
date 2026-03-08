import { describe, it, expect } from 'vitest';
import type {
  Quote, UnsignedTransaction, BroadcastResult, TransactionStatus,
  SwapResult, SwapParams, QuoteParams, ApproveParams, BroadcastParams,
  BillingMode, Transport, Signer, MangroveConfig,
} from '../../types';

describe('DEX types', () => {
  it('Quote has required fields', () => {
    const quote: Quote = {
      quoteId: 'q-123', venueId: '1inch', inputToken: '0xA0b8...',
      outputToken: '0xEeee...', inputAmount: '1000000000',
      outputAmount: '500000000000000000', mangroveFee: '0.25',
      chainId: 8453, billingMode: 'standard', routes: ['1inch-classic'],
      expiresAt: '2026-02-24T12:00:00Z',
    };
    expect(quote.quoteId).toBe('q-123');
    expect(quote.billingMode).toBe('standard');
  });

  it('UnsignedTransaction has EVM calldata fields', () => {
    const tx: UnsignedTransaction = {
      chainId: 8453, to: '0x1111111254EEB25477B68fb85Ed929f73A960582',
      data: '0x12aa3caf...', value: '0', gas: '200000',
    };
    expect(tx.chainId).toBe(8453);
    expect(tx.to).toMatch(/^0x/);
  });

  it('SwapParams accepts all swap config', () => {
    const params: SwapParams = {
      src: '0xA0b8...', dst: '0xEeee...', amount: '1000000000',
      chainId: 8453, slippage: 0.5, mevProtection: true, mode: 'standard',
    };
    expect(params.slippage).toBe(0.5);
  });

  it('BillingMode is standard or x402', () => {
    const standard: BillingMode = 'standard';
    const x402: BillingMode = 'x402';
    expect(standard).toBe('standard');
    expect(x402).toBe('x402');
  });
});

describe('Transport interface', () => {
  it('Transport defines callTool, connect, disconnect', () => {
    const mock: Transport = {
      callTool: async () => ({}),
      connect: async () => {},
      disconnect: async () => {},
    };
    expect(mock.callTool).toBeDefined();
  });
});

describe('Signer interface', () => {
  it('Signer defines getAddress, signTransaction, getSupportedChainIds', () => {
    const mock: Signer = {
      getAddress: async () => '0xabc123',
      signTransaction: async () => '0xsigned',
      getSupportedChainIds: async () => [1, 8453],
    };
    expect(mock.getAddress).toBeDefined();
  });
});

describe('MangroveConfig', () => {
  it('accepts url, signer, transport, apiKey', () => {
    const config: MangroveConfig = { url: 'https://api.mangrovemarkets.com', transport: 'mcp' };
    expect(config.url).toBe('https://api.mangrovemarkets.com');
  });
});
