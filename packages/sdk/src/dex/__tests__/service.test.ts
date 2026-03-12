import { describe, it, expect, beforeEach } from 'vitest';
import { DexService } from '../service';
import { MockTransport } from '../../transport/__tests__/mock';
import type { Quote, UnsignedTransaction, BroadcastResult, TransactionStatus } from '../../types';

describe('DexService', () => {
  let transport: MockTransport;
  let dex: DexService;

  beforeEach(() => {
    transport = new MockTransport();
    dex = new DexService(transport);
  });

  it('getQuote calls dex_get_quote and returns Quote', async () => {
    const mockQuote: Quote = {
      quoteId: 'q-123',
      venueId: '1inch',
      inputToken: '0xA0b8...',
      outputToken: '0xEeee...',
      inputAmount: '1000000000',
      outputAmount: '500000000000000000',
      mangroveFee: '0.25',
      chainId: 8453,
      billingMode: 'standard',
      routes: ['1inch-classic'],
      expiresAt: '2026-02-24T12:00:00Z',
    };
    transport.addResponse('dex_get_quote', mockQuote as any);

    const result = await dex.getQuote({ src: '0xA0b8...', dst: '0xEeee...', amount: '1000000000', chainId: 8453 });

    expect(result.quoteId).toBe('q-123');
    expect(transport.calls[0].name).toBe('dex_get_quote');
    expect(transport.calls[0].params.input_token).toBe('0xA0b8...');
  });

  it('prepareSwap calls dex_prepare_swap and returns UnsignedTransaction', async () => {
    const mockTx: UnsignedTransaction = {
      chainId: 8453,
      to: '0x1111...',
      data: '0x12aa3caf...',
      value: '0',
      gas: '200000',
    };
    transport.addResponse('dex_prepare_swap', mockTx as any);

    const result = await dex.prepareSwap({ quoteId: 'q-123', walletAddress: '0xWallet', slippage: 0.5 });

    expect(result.to).toBe('0x1111...');
    expect(transport.calls[0].params.quote_id).toBe('q-123');
    expect(transport.calls[0].params.slippage).toBe(0.5);
  });

  it('approveToken calls dex_approve_token and returns UnsignedTransaction', async () => {
    const mockTx: UnsignedTransaction = {
      chainId: 8453,
      to: '0xA0b8...',
      data: '0x095ea7b3...',
      value: '0',
      gas: '50000',
    };
    transport.addResponse('dex_approve_token', mockTx as any);

    const result = await dex.approveToken({ tokenAddress: '0xA0b8...', chainId: 8453, walletAddress: '0xWallet' });

    expect(result.data).toContain('0x095ea7b3');
    expect(transport.calls[0].params.token_address).toBe('0xA0b8...');
  });

  it('broadcast calls dex_broadcast and returns BroadcastResult', async () => {
    const mockResult: BroadcastResult = {
      txHash: '0xabc123',
      chainId: 8453,
      broadcastMethod: 'public',
    };
    transport.addResponse('dex_broadcast', mockResult as any);

    const result = await dex.broadcast({ chainId: 8453, signedTx: '0xsigned', mevProtection: false });

    expect(result.txHash).toBe('0xabc123');
    expect(transport.calls[0].params.signed_tx).toBe('0xsigned');
  });

  it('txStatus calls dex_tx_status and returns TransactionStatus', async () => {
    const mockStatus: TransactionStatus = {
      txHash: '0xabc123',
      chainId: 8453,
      status: 'confirmed',
      blockNumber: 12345,
      gasUsed: '180000',
    };
    transport.addResponse('dex_tx_status', mockStatus as any);

    const result = await dex.txStatus({ txHash: '0xabc123', chainId: 8453 });

    expect(result.status).toBe('confirmed');
  });

  it('supportedVenues calls dex_supported_venues', async () => {
    transport.addResponse('dex_supported_venues', { chains: [{ id: 1, name: 'Ethereum' }, { id: 8453, name: 'Base' }] });
    const result = await dex.supportedVenues();
    expect(result.chains).toHaveLength(2);
  });

  it('supportedPairs calls dex_supported_pairs', async () => {
    transport.addResponse('dex_supported_pairs', { pairs: [{ base: 'ETH', quote: 'USDC' }] });
    const result = await dex.supportedPairs('1inch');
    expect(transport.calls[0].params.venue_id).toBe('1inch');
  });
});
