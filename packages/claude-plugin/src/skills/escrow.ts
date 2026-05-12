export interface EscrowCreateAction {
  action: 'create';
  account: string;
  destination: string;
  amountXrp: number;
  finishAfter?: number;
  network?: string;
}

export interface EscrowReleaseAction {
  action: 'release';
  account: string;
  owner: string;
  offerSequence: number;
  network?: string;
}

export interface EscrowCancelAction {
  action: 'cancel';
  account: string;
  owner: string;
  offerSequence: number;
  network?: string;
}

export interface EscrowMonitorAction {
  action: 'monitor';
  buyerAddress: string;
  offerSequence: number;
  network?: string;
}

export type EscrowParams =
  | EscrowCreateAction
  | EscrowReleaseAction
  | EscrowCancelAction
  | EscrowMonitorAction;

/**
 * Handle a /escrow skill invocation. Delegates to client.marketplace for create/release/cancel,
 * and creates an EscrowMonitor for status checks.
 */
export async function handleEscrow(
  client: { marketplace: any; wallet: any },
  params: EscrowParams,
): Promise<unknown> {
  switch (params.action) {
    case 'create':
      return client.marketplace.createEscrow({
        account: params.account,
        destination: params.destination,
        amountXrp: params.amountXrp,
        finishAfter: params.finishAfter,
        network: params.network,
      });
    case 'release':
      return client.marketplace.releaseEscrow({
        account: params.account,
        owner: params.owner,
        offerSequence: params.offerSequence,
        network: params.network,
      });
    case 'cancel':
      return client.marketplace.cancelEscrow({
        account: params.account,
        owner: params.owner,
        offerSequence: params.offerSequence,
        network: params.network,
      });
    case 'monitor': {
      const { EscrowMonitor } = await import('@mangrove-ai/sdk');
      const monitor = new EscrowMonitor(
        client.wallet,
        params.buyerAddress,
        params.offerSequence,
        params.network ?? 'testnet',
      );
      return monitor.check();
    }
    default:
      throw new Error(`Unknown escrow action: ${(params as { action: string }).action}`);
  }
}
