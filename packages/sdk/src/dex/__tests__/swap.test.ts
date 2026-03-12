import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SwapOrchestrator } from '../swap';
import { DexService } from '../service';
import { MockTransport } from '../../transport/__tests__/mock';
import type { Signer } from '../../types';

// Native ETH address constant
const NATIVE_TOKEN = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
const FUTURE_EXPIRY = '2099-12-31T23:59:59Z';

function createMockSigner(): Signer {
  return {
    getAddress: vi.fn().mockResolvedValue('0xUserWallet'),
    signTransaction: vi.fn().mockResolvedValue('0xsigned_hex'),
    getSupportedChainIds: vi.fn().mockResolvedValue([1, 8453]),
  };
}

describe('SwapOrchestrator', () => {
  let transport: MockTransport;
  let dex: DexService;
  let signer: Signer;
  let orchestrator: SwapOrchestrator;

  beforeEach(() => {
    transport = new MockTransport();
    dex = new DexService(transport);
    signer = createMockSigner();
    orchestrator = new SwapOrchestrator(dex, signer, transport);
  });

  it('swaps native token (no approval needed)', async () => {
    transport.addResponse('dex_get_quote', {
      quoteId: 'q-1', venueId: '1inch', inputToken: NATIVE_TOKEN,
      outputToken: '0xUSDC', inputAmount: '1000000000000000000',
      outputAmount: '2000000000', mangroveFee: '0.25', chainId: 8453,
      billingMode: 'standard', routes: ['1inch'], expiresAt: FUTURE_EXPIRY,
    });
    transport.addResponse('dex_prepare_swap', {
      chainId: 8453, to: '0x1inch', data: '0xswapdata', value: '1000000000000000000', gas: '200000',
    });
    transport.addResponse('dex_broadcast', {
      txHash: '0xtxhash', chainId: 8453, broadcastMethod: 'public',
    });
    transport.addResponse('dex_tx_status', {
      txHash: '0xtxhash', chainId: 8453, status: 'confirmed', blockNumber: 100, gasUsed: '180000',
    });

    const result = await orchestrator.swap({
      src: NATIVE_TOKEN, dst: '0xUSDC', amount: '1000000000000000000',
      chainId: 8453, slippage: 0.5,
    });

    expect(result.txHash).toBe('0xtxhash');
    expect(result.status).toBe('confirmed');
    const approvalCalls = transport.calls.filter(c => c.name === 'dex_approve_token');
    expect(approvalCalls).toHaveLength(0);
    expect(signer.signTransaction).toHaveBeenCalledTimes(1);
  });

  it('swaps ERC20 token (needs approval)', async () => {
    transport.addResponse('dex_get_quote', {
      quoteId: 'q-2', venueId: '1inch', inputToken: '0xUSDC',
      outputToken: NATIVE_TOKEN, inputAmount: '2000000000',
      outputAmount: '1000000000000000000', mangroveFee: '0.25', chainId: 8453,
      billingMode: 'standard', routes: ['1inch'], expiresAt: FUTURE_EXPIRY,
    });
    // Server wraps allowances in {allowances: {token: amount}}
    transport.addResponse('oneinch_allowances', { allowances: { '0xUSDC': '0' } });
    transport.addResponse('dex_approve_token', {
      chainId: 8453, to: '0xUSDC', data: '0xapprovedata', value: '0', gas: '50000',
    });
    transport.addResponse('dex_broadcast', {
      txHash: '0xapproval_hash', chainId: 8453, broadcastMethod: 'public',
    });
    transport.addResponse('dex_tx_status', {
      txHash: '0xapproval_hash', chainId: 8453, status: 'confirmed', blockNumber: 99, gasUsed: '45000',
    });
    transport.addResponse('dex_prepare_swap', {
      chainId: 8453, to: '0x1inch', data: '0xswapdata', value: '0', gas: '200000',
    });
    transport.addResponse('dex_broadcast', {
      txHash: '0xswap_hash', chainId: 8453, broadcastMethod: 'public',
    });
    transport.addResponse('dex_tx_status', {
      txHash: '0xswap_hash', chainId: 8453, status: 'confirmed', blockNumber: 101, gasUsed: '180000',
    });

    const result = await orchestrator.swap({
      src: '0xUSDC', dst: NATIVE_TOKEN, amount: '2000000000', chainId: 8453,
    });

    expect(result.txHash).toBe('0xswap_hash');
    expect(result.status).toBe('confirmed');
    expect(signer.signTransaction).toHaveBeenCalledTimes(2);
  });

  it('skips approval when allowance is sufficient', async () => {
    transport.addResponse('dex_get_quote', {
      quoteId: 'q-4', venueId: '1inch', inputToken: '0xUSDC',
      outputToken: NATIVE_TOKEN, inputAmount: '2000000000',
      outputAmount: '1000000000000000000', mangroveFee: '0.25', chainId: 8453,
      billingMode: 'standard', routes: ['1inch'], expiresAt: FUTURE_EXPIRY,
    });
    // Sufficient allowance -- should NOT trigger approval
    transport.addResponse('oneinch_allowances', { allowances: { '0xUSDC': '999999999999' } });
    transport.addResponse('dex_prepare_swap', {
      chainId: 8453, to: '0x1inch', data: '0xswapdata', value: '0', gas: '200000',
    });
    transport.addResponse('dex_broadcast', {
      txHash: '0xswap_hash', chainId: 8453, broadcastMethod: 'public',
    });
    transport.addResponse('dex_tx_status', {
      txHash: '0xswap_hash', chainId: 8453, status: 'confirmed', blockNumber: 101, gasUsed: '180000',
    });

    const result = await orchestrator.swap({
      src: '0xUSDC', dst: NATIVE_TOKEN, amount: '2000000000', chainId: 8453,
    });

    expect(result.txHash).toBe('0xswap_hash');
    expect(signer.signTransaction).toHaveBeenCalledTimes(1); // only swap, no approval
    const approvalCalls = transport.calls.filter(c => c.name === 'dex_approve_token');
    expect(approvalCalls).toHaveLength(0);
  });

  it('throws on failed approval', async () => {
    transport.addResponse('dex_get_quote', {
      quoteId: 'q-5', venueId: '1inch', inputToken: '0xUSDC',
      outputToken: NATIVE_TOKEN, inputAmount: '2000000000',
      outputAmount: '1000000000000000000', mangroveFee: '0.25', chainId: 8453,
      billingMode: 'standard', routes: ['1inch'], expiresAt: FUTURE_EXPIRY,
    });
    transport.addResponse('oneinch_allowances', { allowances: { '0xUSDC': '0' } });
    transport.addResponse('dex_approve_token', {
      chainId: 8453, to: '0xUSDC', data: '0xapprovedata', value: '0', gas: '50000',
    });
    transport.addResponse('dex_broadcast', {
      txHash: '0xfailed_approval', chainId: 8453, broadcastMethod: 'public',
    });
    transport.addResponse('dex_tx_status', {
      txHash: '0xfailed_approval', chainId: 8453, status: 'failed',
    });

    await expect(orchestrator.swap({
      src: '0xUSDC', dst: NATIVE_TOKEN, amount: '2000000000', chainId: 8453,
    })).rejects.toThrow('Approval transaction failed');
  });

  it('returns error on failed swap', async () => {
    transport.addResponse('dex_get_quote', {
      quoteId: 'q-3', venueId: '1inch', inputToken: NATIVE_TOKEN,
      outputToken: '0xUSDC', inputAmount: '1000', outputAmount: '2000',
      mangroveFee: '0.25', chainId: 1, billingMode: 'standard',
      routes: ['1inch'], expiresAt: FUTURE_EXPIRY,
    });
    transport.addResponse('dex_prepare_swap', {
      chainId: 1, to: '0x1inch', data: '0xswap', value: '1000', gas: '200000',
    });
    transport.addResponse('dex_broadcast', {
      txHash: '0xfailed', chainId: 1, broadcastMethod: 'public',
    });
    transport.addResponse('dex_tx_status', {
      txHash: '0xfailed', chainId: 1, status: 'failed',
    });

    const result = await orchestrator.swap({
      src: NATIVE_TOKEN, dst: '0xUSDC', amount: '1000', chainId: 1,
    });

    expect(result.status).toBe('failed');
  });
});
