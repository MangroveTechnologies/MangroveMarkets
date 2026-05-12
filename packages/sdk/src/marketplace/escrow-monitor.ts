import type { WalletService } from '../wallet/service.js';

export interface EscrowState {
  status: "PENDING" | "ESCROWED" | "RELEASED" | "CANCELLED" | "UNKNOWN";
  escrowCreateHash?: string;
  escrowCloseHash?: string;
  lastChecked: Date;
}

export class EscrowMonitor {
  constructor(
    private walletService: WalletService,
    private buyerAddress: string,
    private offerSequence: number,
    private network: string,
  ) {}

  async check(): Promise<EscrowState> {
    const history = await this.walletService.xrplTransactions(this.buyerAddress, {
      limit: 50,
      network: this.network,
    });

    let createHash: string | undefined;
    let closeHash: string | undefined;
    let closeType: "EscrowFinish" | "EscrowCancel" | undefined;

    for (const tx of history.transactions) {
      if (tx.txType === "EscrowCreate" && tx.status === "SUCCESS") {
        // Match by sequence number if available; fall through to first-found if not
        if (tx.sequence == null || tx.sequence === this.offerSequence) {
          createHash = tx.txHash;
        }
      }
      if ((tx.txType === "EscrowFinish" || tx.txType === "EscrowCancel") && tx.status === "SUCCESS") {
        // Match by offerSequence pointing back to the create
        if (tx.offerSequence == null || tx.offerSequence === this.offerSequence) {
          closeHash = tx.txHash;
          closeType = tx.txType as "EscrowFinish" | "EscrowCancel";
        }
      }
    }

    const now = new Date();

    if (closeType === "EscrowFinish") {
      return { status: "RELEASED", escrowCreateHash: createHash, escrowCloseHash: closeHash, lastChecked: now };
    }
    if (closeType === "EscrowCancel") {
      return { status: "CANCELLED", escrowCreateHash: createHash, escrowCloseHash: closeHash, lastChecked: now };
    }
    if (createHash) {
      return { status: "ESCROWED", escrowCreateHash: createHash, lastChecked: now };
    }
    return { status: "PENDING", lastChecked: now };
  }

  async poll(options?: {
    intervalMs?: number;
    maxAttempts?: number;
    onUpdate?: (state: EscrowState) => void;
  }): Promise<EscrowState> {
    const intervalMs = options?.intervalMs ?? 10000;
    const maxAttempts = options?.maxAttempts ?? 30;

    for (let i = 0; i < maxAttempts; i++) {
      const state = await this.check();
      options?.onUpdate?.(state);
      if (state.status === "RELEASED" || state.status === "CANCELLED") {
        return state;
      }
      if (i < maxAttempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
      }
    }
    return this.check();
  }
}
