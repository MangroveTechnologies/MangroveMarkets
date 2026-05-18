import { EscrowMonitor } from '@mangrove-ai/sdk';

/**
 * Create escrow tool handlers delegating to the MangroveClient's marketplace service.
 * @param client - The MangroveClient instance
 * @returns Object mapping tool names to async handler functions
 */
export function escrowToolHandlers(client: any) {
  return {
    mangrove_escrow_create: async (params: any) =>
      client.marketplace.createEscrow({
        account: params.account,
        destination: params.destination,
        amountXrp: params.amount_xrp ?? params.amountXrp,
        finishAfter: params.finish_after ?? params.finishAfter,
        network: params.network,
      }),
    mangrove_escrow_release: async (params: any) =>
      client.marketplace.releaseEscrow({
        account: params.account,
        owner: params.owner,
        offerSequence: params.offer_sequence ?? params.offerSequence,
        network: params.network,
      }),
    mangrove_escrow_cancel: async (params: any) =>
      client.marketplace.cancelEscrow({
        account: params.account,
        owner: params.owner,
        offerSequence: params.offer_sequence ?? params.offerSequence,
        network: params.network,
      }),
    mangrove_escrow_status: async (params: any) => {
      const monitor = new EscrowMonitor(
        client.wallet,
        params.buyer_address ?? params.buyerAddress,
        params.offer_sequence ?? params.offerSequence,
        params.network ?? 'testnet',
      );
      return monitor.check();
    },
  };
}
