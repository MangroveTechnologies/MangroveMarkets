import type { UnsignedTransaction } from './dex';

/**
 * Interface for transaction signing. The SDK never sees private keys -- it passes
 * unsigned calldata to the Signer and gets signed bytes back.
 */
export interface Signer {
  /** Return the signer's public address (checksummed hex for EVM). */
  getAddress(): Promise<string>;

  /**
   * Sign an unsigned transaction and return the raw signed hex string.
   * @param tx - Chain-agnostic unsigned transaction to sign.
   * @returns Raw signed transaction as a hex string.
   */
  signTransaction(tx: UnsignedTransaction): Promise<string>;

  /** Return the list of chain IDs this signer can sign for. */
  getSupportedChainIds(): Promise<number[]>;
}
