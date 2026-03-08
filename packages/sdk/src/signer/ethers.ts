import type { Signer } from '../types/signer';
import type { UnsignedTransaction } from '../types/dex';

interface EthersWallet {
  address: string;
  signTransaction(tx: Record<string, unknown>): Promise<string>;
}

/**
 * Signer adapter for ethers.js Wallet. Maps UnsignedTransaction fields to
 * ethers.js format (gas -> gasLimit, spreads EIP-1559 fields).
 */
export class EthersSigner implements Signer {
  private wallet: EthersWallet;
  private chainIds: number[];

  /**
   * Create an EthersSigner from an ethers.js Wallet and list of supported chain IDs.
   * @param wallet - An ethers.js Wallet instance (or any object matching EthersWallet).
   * @param supportedChainIds - Chain IDs this wallet can sign transactions for.
   */
  constructor(wallet: EthersWallet, supportedChainIds: number[]) {
    this.wallet = wallet;
    this.chainIds = supportedChainIds;
  }

  /** {@inheritDoc Signer.getAddress} */
  async getAddress(): Promise<string> {
    return this.wallet.address;
  }

  /** {@inheritDoc Signer.signTransaction} */
  async signTransaction(tx: UnsignedTransaction): Promise<string> {
    return this.wallet.signTransaction({
      chainId: tx.chainId,
      to: tx.to,
      data: tx.data,
      value: tx.value,
      gasLimit: tx.gas,
      ...(tx.gasPrice ? { gasPrice: tx.gasPrice } : {}),
      ...(tx.maxFeePerGas ? { maxFeePerGas: tx.maxFeePerGas } : {}),
      ...(tx.maxPriorityFeePerGas ? { maxPriorityFeePerGas: tx.maxPriorityFeePerGas } : {}),
    });
  }

  /** {@inheritDoc Signer.getSupportedChainIds} */
  async getSupportedChainIds(): Promise<number[]> {
    return this.chainIds;
  }
}
