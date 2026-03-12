import { describe, it, expect } from 'vitest';
import {
  normalizeQuote,
  normalizeUnsignedTx,
  normalizeBroadcastResult,
  normalizeTransactionStatus,
} from '../normalize';

describe('normalizeQuote', () => {
  it('converts snake_case server response to camelCase', () => {
    const result = normalizeQuote({
      quote_id: 'q-1',
      venue_id: '1inch',
      input_token: '0xUSDC',
      output_token: '0xETH',
      input_amount: 1000000,
      output_amount: 500000000000000000,
      mangrove_fee: 0.25,
      chain_id: 8453,
      billing_mode: 'standard',
      routes: ['classic'],
      expires_at: '2026-03-12T00:00:00Z',
    });

    expect(result.quoteId).toBe('q-1');
    expect(result.venueId).toBe('1inch');
    expect(result.inputToken).toBe('0xUSDC');
    expect(result.chainId).toBe(8453);
    expect(result.billingMode).toBe('standard');
    expect(result.inputAmount).toBe('1000000');
  });

  it('passes through already-camelCase responses', () => {
    const result = normalizeQuote({
      quoteId: 'q-2',
      venueId: '1inch',
      inputToken: '0xUSDC',
      outputToken: '0xETH',
      inputAmount: '1000000',
      outputAmount: '500000000000000000',
      mangroveFee: '0.25',
      chainId: 8453,
      billingMode: 'standard',
      routes: [],
      expiresAt: '',
    });

    expect(result.quoteId).toBe('q-2');
    expect(result.chainId).toBe(8453);
  });
});

describe('normalizeUnsignedTx', () => {
  it('flattens payload into top-level fields', () => {
    const result = normalizeUnsignedTx({
      chain_family: 'evm',
      chain_id: 8453,
      venue_id: '1inch',
      description: 'Swap via 1inch',
      payload: {
        to: '0x1111',
        data: '0xabcd',
        value: '0',
        gas: 200000,
        maxFeePerGas: '25000000000',
      },
      estimated_gas: '200000',
    });

    expect(result.chainId).toBe(8453);
    expect(result.to).toBe('0x1111');
    expect(result.data).toBe('0xabcd');
    expect(result.value).toBe('0');
    expect(result.gas).toBe('200000');
    expect(result.maxFeePerGas).toBe('25000000000');
  });

  it('uses payload.chainId over chain_id when both present', () => {
    const result = normalizeUnsignedTx({
      chain_id: 1,
      payload: { chainId: 8453, to: '0x', data: '0x', value: '0', gas: 100 },
    });
    expect(result.chainId).toBe(8453);
  });

  it('handles flat response (already SDK format)', () => {
    const result = normalizeUnsignedTx({
      chainId: 8453,
      to: '0x1111',
      data: '0xabcd',
      value: '0',
      gas: '200000',
    });

    expect(result.chainId).toBe(8453);
    expect(result.to).toBe('0x1111');
  });
});

describe('normalizeBroadcastResult', () => {
  it('converts snake_case to camelCase', () => {
    const result = normalizeBroadcastResult({
      tx_hash: '0xabc',
      chain_family: 'evm',
      chain_id: 8453,
      venue_id: '1inch',
      broadcast_method: 'public',
    });

    expect(result.txHash).toBe('0xabc');
    expect(result.chainId).toBe(8453);
    expect(result.broadcastMethod).toBe('public');
  });
});

describe('normalizeTransactionStatus', () => {
  it('converts snake_case to camelCase', () => {
    const result = normalizeTransactionStatus({
      tx_hash: '0xabc',
      chain_family: 'evm',
      chain_id: 8453,
      status: 'confirmed',
      block_number: 12345,
      gas_used: '180000',
    });

    expect(result.txHash).toBe('0xabc');
    expect(result.status).toBe('confirmed');
    expect(result.blockNumber).toBe(12345);
    expect(result.gasUsed).toBe('180000');
  });

  it('omits optional fields when null', () => {
    const result = normalizeTransactionStatus({
      tx_hash: '0xabc',
      chain_id: 8453,
      status: 'pending',
      block_number: null,
      gas_used: null,
    });

    expect(result.txHash).toBe('0xabc');
    expect(result.status).toBe('pending');
    expect(result.blockNumber).toBeUndefined();
    expect(result.gasUsed).toBeUndefined();
  });
});
