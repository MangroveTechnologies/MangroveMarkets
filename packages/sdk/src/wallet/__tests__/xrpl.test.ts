import { describe, it, expect, vi } from 'vitest';
import { WalletService } from '../service.js';
import type { Transport } from '../../types/transport.js';

function mockTransport(response: unknown): Transport {
  return {
    callTool: vi.fn().mockResolvedValue(response),
    connect: vi.fn(),
    disconnect: vi.fn(),
  } as unknown as Transport;
}

describe('WalletService XRPL', () => {
  it('createXrplWallet returns address starting with r', () => {
    const t = mockTransport({});
    const svc = new WalletService(t);
    const result = svc.createXrplWallet();
    expect(result.address).toMatch(/^r/);
    expect(typeof result.seed).toBe('string');
    expect(typeof result.publicKey).toBe('string');
  });

  it('xrplBalance calls wallet_xrpl_balance and normalizes response', async () => {
    const raw = {
      xrp: { balance: '100.0', reserve: '10.0', available: '90.0' },
      issued_currencies: [{ currency: 'USD', issuer: 'rIssuer', balance: '50.0', limit: '1000' }],
    };
    const t = mockTransport(raw);
    const svc = new WalletService(t);
    const result = await svc.xrplBalance('rTestAddress', 'testnet');
    expect(t.callTool).toHaveBeenCalledWith('wallet_xrpl_balance', { address: 'rTestAddress', network: 'testnet' });
    expect(result.xrp.balance).toBe('100.0');
    expect(result.issuedCurrencies).toHaveLength(1);
    expect(result.issuedCurrencies[0].currency).toBe('USD');
  });

  it('xrplSend calls wallet_xrpl_send and returns normalized unsignedTx', async () => {
    const raw = {
      unsigned_tx: { TransactionType: 'Payment', Account: 'rFrom', Sequence: 1, LastLedgerSequence: 9999, Fee: '12' },
      signing_instructions: 'Sign with your XRPL wallet',
    };
    const t = mockTransport(raw);
    const svc = new WalletService(t);
    const result = await svc.xrplSend({ fromAddress: 'rFrom', toAddress: 'rTo', amount: '10' });
    expect(t.callTool).toHaveBeenCalledWith('wallet_xrpl_send', { from_address: 'rFrom', to_address: 'rTo', amount: '10' });
    expect(result.unsignedTx.chain_family).toBe('XRPL');
    expect(result.signingInstructions).toBe('Sign with your XRPL wallet');
  });

  it('xrplTransactions calls wallet_xrpl_transactions and normalizes', async () => {
    const raw = {
      address: 'rTest',
      network: 'testnet',
      count: 1,
      transactions: [{ tx_hash: 'abc123', tx_type: 'Payment', status: 'SUCCESS' }],
    };
    const t = mockTransport(raw);
    const svc = new WalletService(t);
    const result = await svc.xrplTransactions('rTest', { limit: 10 });
    expect(t.callTool).toHaveBeenCalledWith('wallet_xrpl_transactions', { address: 'rTest', limit: 10 });
    expect(result.count).toBe(1);
    expect(result.transactions[0].txHash).toBe('abc123');
  });
});
