import { Wallet } from 'xrpl';
import type { Signer } from '../types/signer.js';
import type { UnsignedTransaction, XrplUnsignedTransaction } from '../types/dex.js';

export class XrplSigner implements Signer {
  private wallet: Wallet;

  private constructor(wallet: Wallet) {
    this.wallet = wallet;
  }

  static fromSeed(seed: string): XrplSigner {
    return new XrplSigner(Wallet.fromSeed(seed));
  }

  static fromMnemonic(mnemonic: string): XrplSigner {
    return new XrplSigner(Wallet.fromMnemonic(mnemonic));
  }

  static generate(): { signer: XrplSigner; address: string; seed: string } {
    const wallet = Wallet.generate();
    return {
      signer: new XrplSigner(wallet),
      address: wallet.classicAddress,
      seed: wallet.seed!,
    };
  }

  async getAddress(): Promise<string> {
    return this.wallet.classicAddress;
  }

  async signTransaction(tx: UnsignedTransaction): Promise<string> {
    if (tx.chain_family !== "XRPL") {
      throw new Error("XrplSigner only supports XRPL transactions");
    }
    const xrplTx = tx as XrplUnsignedTransaction;
    const signed = this.wallet.sign(xrplTx.payload as Parameters<Wallet['sign']>[0]);
    return JSON.stringify({ tx_blob: signed.tx_blob, tx_hash: signed.hash });
  }

  async getSupportedChainIds(): Promise<number[]> {
    return [];
  }
}
