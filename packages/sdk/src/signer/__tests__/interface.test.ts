import { describe, it, expect } from 'vitest';
import type { Signer } from '../interface';
import type { UnsignedTransaction } from '../../types';

describe('Signer interface', () => {
  it('mock signer returns address', async () => {
    const signer: Signer = {
      getAddress: async () => '0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18',
      signTransaction: async (tx: UnsignedTransaction) => '0xsigned_' + tx.data.slice(0, 10),
      getSupportedChainIds: async () => [1, 8453, 42161],
    };
    expect(await signer.getAddress()).toBe('0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18');
    expect(await signer.getSupportedChainIds()).toContain(8453);
  });

  it('signTransaction receives UnsignedTransaction and returns hex string', async () => {
    const signer: Signer = {
      getAddress: async () => '0xabc',
      signTransaction: async (tx: UnsignedTransaction) => {
        expect(tx.chainId).toBe(1);
        expect(tx.to).toMatch(/^0x/);
        return '0xdeadbeef';
      },
      getSupportedChainIds: async () => [1],
    };
    const result = await signer.signTransaction({
      chainId: 1, to: '0x1111111254EEB25477B68fb85Ed929f73A960582',
      data: '0x12aa3caf', value: '0', gas: '200000',
    });
    expect(result).toBe('0xdeadbeef');
  });
});
