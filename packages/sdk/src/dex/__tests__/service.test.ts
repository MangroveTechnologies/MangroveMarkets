import { describe, it, expect, beforeEach } from 'vitest';
import { DexService } from '../service';
import { MockTransport } from '../../transport/__tests__/mock';

describe('DexService', () => {
  let transport: MockTransport;
  let dex: DexService;

  beforeEach(() => {
    transport = new MockTransport();
    dex = new DexService(transport);
  });

  it('getQuote normalizes snake_case server response to camelCase Quote', async () => {
    // Server returns snake_case (Pydantic model_dump output)
    transport.addResponse('dex_get_quote', {
      quote_id: 'q-123',
      venue_id: '1inch',
      input_token: '0xA0b8...',
      output_token: '0xEeee...',
      input_amount: 1000000000,
      output_amount: 500000000000000000,
      mangrove_fee: 0.25,
      chain_id: 8453,
      billing_mode: 'standard',
      routes: ['1inch-classic'],
      expires_at: '2026-02-24T12:00:00Z',
    } as any);

    const result = await dex.getQuote({ src: '0xA0b8...', dst: '0xEeee...', amount: '1000000000', chainId: 8453 });

    expect(result.quoteId).toBe('q-123');
    expect(result.venueId).toBe('1inch');
    expect(result.inputToken).toBe('0xA0b8...');
    expect(result.outputToken).toBe('0xEeee...');
    expect(result.inputAmount).toBe('1000000000');
    expect(result.outputAmount).toBe('500000000000000000');
    expect(result.chainId).toBe(8453);
    expect(result.billingMode).toBe('standard');
    expect(transport.calls[0].name).toBe('dex_get_quote');
    expect(transport.calls[0].params.input_token).toBe('0xA0b8...');
  });

  it('prepareSwap normalizes nested payload to flat UnsignedTransaction', async () => {
    // Server returns chain_family + nested payload (Phase 0 model)
    transport.addResponse('dex_prepare_swap', {
      chain_family: 'evm',
      chain_id: 8453,
      venue_id: '1inch',
      description: 'Swap via 1inch',
      payload: {
        to: '0x1111...',
        data: '0x12aa3caf...',
        value: '0',
        gas: 200000,
        maxFeePerGas: '25000000000',
        maxPriorityFeePerGas: '1000000000',
      },
      estimated_gas: '200000',
      expires_at: null,
    } as any);

    const result = await dex.prepareSwap({ quoteId: 'q-123', walletAddress: '0xWallet', slippage: 0.5 });

    expect(result.to).toBe('0x1111...');
    expect(result.data).toBe('0x12aa3caf...');
    expect(result.value).toBe('0');
    expect(result.gas).toBe('200000');
    expect(result.chainId).toBe(8453);
    expect(result.maxFeePerGas).toBe('25000000000');
    expect(result.maxPriorityFeePerGas).toBe('1000000000');
    expect(transport.calls[0].params.quote_id).toBe('q-123');
    expect(transport.calls[0].params.slippage).toBe(0.5);
  });

  it('approveToken normalizes nested payload to flat UnsignedTransaction', async () => {
    transport.addResponse('dex_approve_token', {
      chain_family: 'evm',
      chain_id: 8453,
      venue_id: '1inch',
      description: 'Approve USDC',
      payload: {
        to: '0xA0b8...',
        data: '0x095ea7b3...',
        value: '0',
        gas: 50000,
      },
      estimated_gas: null,
      expires_at: null,
    } as any);

    const result = await dex.approveToken({ tokenAddress: '0xA0b8...', chainId: 8453, walletAddress: '0xWallet' });

    expect(result.to).toBe('0xA0b8...');
    expect(result.data).toContain('0x095ea7b3');
    expect(result.chainId).toBe(8453);
    expect(transport.calls[0].params.token_address).toBe('0xA0b8...');
  });

  it('broadcast normalizes snake_case BroadcastResult', async () => {
    transport.addResponse('dex_broadcast', {
      tx_hash: '0xabc123',
      chain_family: 'evm',
      chain_id: 8453,
      venue_id: '1inch',
      broadcast_method: 'public',
    } as any);

    const result = await dex.broadcast({ chainId: 8453, signedTx: '0xsigned', mevProtection: false });

    expect(result.txHash).toBe('0xabc123');
    expect(result.chainId).toBe(8453);
    expect(result.broadcastMethod).toBe('public');
    expect(transport.calls[0].params.signed_tx).toBe('0xsigned');
  });

  it('txStatus normalizes snake_case TransactionStatus', async () => {
    transport.addResponse('dex_tx_status', {
      tx_hash: '0xabc123',
      chain_family: 'evm',
      chain_id: 8453,
      status: 'confirmed',
      block_number: 12345,
      confirmations: 5,
      gas_used: '180000',
      error_message: null,
      raw: null,
    } as any);

    const result = await dex.txStatus({ txHash: '0xabc123', chainId: 8453 });

    expect(result.txHash).toBe('0xabc123');
    expect(result.status).toBe('confirmed');
    expect(result.blockNumber).toBe(12345);
    expect(result.gasUsed).toBe('180000');
  });

  it('supportedVenues calls dex_supported_venues', async () => {
    transport.addResponse('dex_supported_venues', { chains: [{ id: 1, name: 'Ethereum' }, { id: 8453, name: 'Base' }] });
    const result = await dex.supportedVenues();
    expect((result as any).chains).toHaveLength(2);
  });

  it('supportedPairs calls dex_supported_pairs', async () => {
    transport.addResponse('dex_supported_pairs', { pairs: [{ base: 'ETH', quote: 'USDC' }] });
    const result = await dex.supportedPairs('1inch');
    expect(transport.calls[0].params.venue_id).toBe('1inch');
  });
});
