import { describe, it, expect, vi } from 'vitest';
import { EthersSigner } from '../ethers';
import type { UnsignedTransaction } from '../../types';

const mockWallet = {
  address: '0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18',
  signTransaction: vi.fn().mockResolvedValue('0xsigned_transaction_hex'),
};

describe('EthersSigner', () => {
  it('getAddress returns wallet address', async () => {
    const signer = new EthersSigner(mockWallet as any, [1, 8453]);
    expect(await signer.getAddress()).toBe('0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18');
  });

  it('signTransaction delegates to ethers wallet', async () => {
    const signer = new EthersSigner(mockWallet as any, [1, 8453]);
    const tx: UnsignedTransaction = {
      chainId: 1, to: '0x1111111254EEB25477B68fb85Ed929f73A960582',
      data: '0x12aa3caf', value: '0', gas: '200000',
    };
    const signed = await signer.signTransaction(tx);
    expect(signed).toBe('0xsigned_transaction_hex');
    expect(mockWallet.signTransaction).toHaveBeenCalledWith({
      chainId: 1, to: '0x1111111254EEB25477B68fb85Ed929f73A960582',
      data: '0x12aa3caf', value: '0', gasLimit: '200000',
    });
  });

  it('getSupportedChainIds returns configured chains', async () => {
    const signer = new EthersSigner(mockWallet as any, [1, 8453, 42161]);
    expect(await signer.getSupportedChainIds()).toEqual([1, 8453, 42161]);
  });
});
