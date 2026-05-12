import { describe, it, expect, beforeAll } from 'vitest';
import { Wallet } from 'xrpl';
import { XrplSigner } from '../xrpl.js';

// Generate a valid seed at test startup — avoids hardcoding a seed that may fail checksum
let testSeed: string;
let testAddress: string;

beforeAll(() => {
  const wallet = Wallet.generate();
  testSeed = wallet.seed!;
  testAddress = wallet.classicAddress;
});

describe('XrplSigner', () => {
  it('fromSeed constructs correctly', () => {
    const signer = XrplSigner.fromSeed(testSeed);
    expect(signer).toBeInstanceOf(XrplSigner);
  });

  it('getAddress returns classic address starting with r', async () => {
    const signer = XrplSigner.fromSeed(testSeed);
    const address = await signer.getAddress();
    expect(address).toMatch(/^r/);
  });

  it('signTransaction with XRPL tx returns JSON with tx_blob', async () => {
    const signer = XrplSigner.fromSeed(testSeed);
    const tx = {
      chain_family: 'XRPL' as const,
      payload: {
        TransactionType: 'Payment' as const,
        Account: testAddress,
        Destination: 'rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh',
        Amount: '1000000',
        Sequence: 1,
        LastLedgerSequence: 9999999,
        Fee: '12',
      },
    };
    const result = await signer.signTransaction(tx);
    const parsed = JSON.parse(result);
    expect(parsed).toHaveProperty('tx_blob');
    expect(typeof parsed.tx_blob).toBe('string');
    expect(parsed.tx_blob.length).toBeGreaterThan(0);
  });

  it('getSupportedChainIds returns empty array', async () => {
    const signer = XrplSigner.fromSeed(testSeed);
    expect(await signer.getSupportedChainIds()).toEqual([]);
  });

  it('throws if given non-XRPL transaction', async () => {
    const signer = XrplSigner.fromSeed(testSeed);
    const evmTx = { chain_family: 'EVM' as const, chainId: 1, to: '0x', data: '0x', value: '0', gas: '21000' };
    await expect(signer.signTransaction(evmTx)).rejects.toThrow('XrplSigner only supports XRPL');
  });
});
