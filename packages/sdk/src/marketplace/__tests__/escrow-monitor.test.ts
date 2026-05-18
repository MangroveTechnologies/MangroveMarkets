import { describe, it, expect, vi } from 'vitest';
import { EscrowMonitor } from '../escrow-monitor.js';
import type { WalletService } from '../../wallet/service.js';

function mockWalletService(transactions: unknown[]): WalletService {
  return {
    xrplTransactions: vi.fn().mockResolvedValue({
      address: 'rBuyer',
      count: transactions.length,
      transactions,
    }),
  } as unknown as WalletService;
}

describe('EscrowMonitor', () => {
  it('check() returns ESCROWED when EscrowCreate found, no close tx', async () => {
    const ws = mockWalletService([
      { txHash: 'abc', txType: 'EscrowCreate', status: 'SUCCESS', sequence: 42 },
    ]);
    const monitor = new EscrowMonitor(ws, 'rBuyer', 42, 'testnet');
    const state = await monitor.check();
    expect(state.status).toBe('ESCROWED');
    expect(state.escrowCreateHash).toBe('abc');
  });

  it('check() returns RELEASED when EscrowFinish with matching offerSequence found', async () => {
    const ws = mockWalletService([
      { txHash: 'abc', txType: 'EscrowCreate', status: 'SUCCESS', sequence: 42 },
      { txHash: 'def', txType: 'EscrowFinish', status: 'SUCCESS', offerSequence: 42 },
    ]);
    const monitor = new EscrowMonitor(ws, 'rBuyer', 42, 'testnet');
    const state = await monitor.check();
    expect(state.status).toBe('RELEASED');
    expect(state.escrowCloseHash).toBe('def');
  });

  it('check() ignores EscrowFinish for a different offerSequence', async () => {
    const ws = mockWalletService([
      { txHash: 'abc', txType: 'EscrowCreate', status: 'SUCCESS', sequence: 42 },
      { txHash: 'def', txType: 'EscrowFinish', status: 'SUCCESS', offerSequence: 99 }, // different escrow
    ]);
    const monitor = new EscrowMonitor(ws, 'rBuyer', 42, 'testnet');
    const state = await monitor.check();
    expect(state.status).toBe('ESCROWED'); // NOT released
  });

  it('check() returns CANCELLED when EscrowCancel with matching offerSequence found', async () => {
    const ws = mockWalletService([
      { txHash: 'abc', txType: 'EscrowCreate', status: 'SUCCESS', sequence: 42 },
      { txHash: 'ghi', txType: 'EscrowCancel', status: 'SUCCESS', offerSequence: 42 },
    ]);
    const monitor = new EscrowMonitor(ws, 'rBuyer', 42, 'testnet');
    const state = await monitor.check();
    expect(state.status).toBe('CANCELLED');
  });

  it('check() returns PENDING when no transactions found', async () => {
    const ws = mockWalletService([]);
    const monitor = new EscrowMonitor(ws, 'rBuyer', 42, 'testnet');
    const state = await monitor.check();
    expect(state.status).toBe('PENDING');
  });

  it('poll() resolves with RELEASED when terminal state reached', async () => {
    const ws = mockWalletService([
      { txHash: 'abc', txType: 'EscrowCreate', status: 'SUCCESS', sequence: 42 },
      { txHash: 'def', txType: 'EscrowFinish', status: 'SUCCESS', offerSequence: 42 },
    ]);
    const monitor = new EscrowMonitor(ws, 'rBuyer', 42, 'testnet');
    const state = await monitor.poll({ intervalMs: 0, maxAttempts: 5 });
    expect(state.status).toBe('RELEASED');
  });
});
