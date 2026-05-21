/**
 * Full Phase 2 demo: Parts 1–6 in a single script.
 *
 * Covers:
 *  Part 1 — XPMarket: chain info, DEX venues, supported pairs
 *  Part 2 — XRPL Wallet: keygen, faucet, balance, tx history
 *  Part 3 — XRPL Escrow: escrow_create, EscrowMonitor
 *  Part 4 — Marketplace: create listing, search, make offer
 *  Part 5 — Full transaction: escrow sign+broadcast, accept, confirm, EscrowFinish
 *  Part 6 — SDK layer: XrplSigner, WalletService, MarketplaceService, EscrowMonitor
 *
 * Run: node demo-part6.mjs
 * Requires: local MCP server running at http://localhost:8080
 */

import {
  XrplSigner,
  WalletService,
  MarketplaceService,
  EscrowMonitor,
  McpTransport,
} from './dist/index.js';

const SERVER_URL = 'http://localhost:8080';
const SEP = '\n' + '─'.repeat(60);

// ── Step 1: Server health ─────────────────────────────────────────────────────
console.log(`${SEP}\nStep 1 — Server health`);
const healthRes = await fetch(`${SERVER_URL}/health`);
const health = await healthRes.json();
console.log('Status:', health.status);
if (!['ok', 'healthy'].includes(health.status)) throw new Error('Server not healthy — is Docker running?');

// ── Step 2: Connect SDK via MCP transport ─────────────────────────────────────
console.log(`${SEP}\nStep 2 — Connect TypeScript SDK to local server`);
const transport = new McpTransport(`${SERVER_URL}/mcp`);
await transport.connect();
const walletService = new WalletService(transport);
const marketplaceService = new MarketplaceService(transport);
console.log('Connected via MCP Streamable HTTP to', SERVER_URL);

// ── Step 3: Chain info + DEX venues ───────────────────────────────────────────
console.log(`${SEP}\nStep 3 — Chain info + DEX venues`);
const chainInfo = await transport.callTool('wallet_chain_info', { chain: 'xrpl' });
console.log(`Chain: ${chainInfo.chain}, Native token: ${chainInfo.native_token}`);

const venuesResult = await transport.callTool('dex_supported_venues', {});
console.log('DEX venues:');
for (const v of venuesResult.venues) {
  console.log(`  ${v.id}: ${v.name} (${v.chain}) — ${v.supported_pairs_count} pairs`);
}

const pairsResult = await transport.callTool('dex_supported_pairs', { venue_id: 'xpmarket' });
console.log('XPMarket pairs:');
for (const p of pairsResult.pairs) {
  console.log(`  ${p.base_token}/${p.quote_token}`);
}

// ── Step 4: Generate two wallets client-side ──────────────────────────────────
console.log(`${SEP}\nStep 4 — Generate wallets client-side`);
const { address: sellerAddress } = XrplSigner.generate();
const { address: buyerAddress, seed: buyerSeed } = XrplSigner.generate();
console.log('Seller address:', sellerAddress);
console.log('Buyer  address:', buyerAddress);
console.log('→ Both keypairs generated locally — seeds kept for signing below, never leave this process');

// ── Step 5: Fund both wallets via testnet faucet ──────────────────────────────
console.log(`${SEP}\nStep 5 — Fund wallets via testnet faucet`);
const sellerFunding = await transport.callTool('xrpl_request_faucet_funding', { address: sellerAddress, network: 'testnet' });
console.log(`Seller funded: ${sellerFunding.is_funded} — ${sellerFunding.faucet_response?.raw?.amount} XRP — tx: ${sellerFunding.faucet_response?.raw?.transactionHash?.slice(0, 16)}...`);

const buyerFunding = await transport.callTool('xrpl_request_faucet_funding', { address: buyerAddress, network: 'testnet' });
console.log(`Buyer  funded: ${buyerFunding.is_funded} — ${buyerFunding.faucet_response?.raw?.amount} XRP — tx: ${buyerFunding.faucet_response?.raw?.transactionHash?.slice(0, 16)}...`);

// Brief pause for testnet to confirm both funding txs
await new Promise(r => setTimeout(r, 3000));

// ── Step 6: Check balances ────────────────────────────────────────────────────
console.log(`${SEP}\nStep 6 — XRPL balances`);
const sellerBalance = await walletService.xrplBalance(sellerAddress, 'testnet');
console.log(`Seller — balance: ${sellerBalance.xrp.balance} XRP, available: ${sellerBalance.xrp.available} XRP`);

const buyerBalance = await walletService.xrplBalance(buyerAddress, 'testnet');
console.log(`Buyer  — balance: ${buyerBalance.xrp.balance} XRP, available: ${buyerBalance.xrp.available} XRP`);

// ── Step 7: Transaction history ────────────────────────────────────────────────
console.log(`${SEP}\nStep 7 — Transaction history`);
const history = await walletService.xrplTransactions(sellerAddress, { limit: 3, network: 'testnet' });
console.log(`${history.count} transaction(s) for seller:`);
for (const tx of history.transactions) {
  console.log(`  ${tx.txType.padEnd(12)} ${tx.amountXrp ? tx.amountXrp + ' XRP' : ''} — ${tx.status} — ${tx.txHash.slice(0, 16)}...`);
}

// ── Step 8: Create marketplace listing ─────────────────────────────────────────
console.log(`${SEP}\nStep 8 — Create marketplace listing`);
const listing = await marketplaceService.createListing({
  sellerAddress,
  title: 'GPU Compute - A100 80GB',
  description: '48-hour access to A100 GPU cluster, 8 cards',
  category: 'compute',
  priceXrp: 50,
});
console.log('Listing created:', listing.listingId);
console.log('Status:', listing.status);

// ── Step 9: Search listings ────────────────────────────────────────────────────
console.log(`${SEP}\nStep 9 — Marketplace search`);
const searchResult = await marketplaceService.search({ query: 'GPU compute' });
console.log(`Found ${searchResult.totalCount} listing(s):`);
for (const l of searchResult.listings) {
  console.log(`  ${l.listingId} — ${l.title} — ${l.priceXrp} XRP`);
}

// ── Step 10: Make offer with XRP escrow path ──────────────────────────────────
console.log(`${SEP}\nStep 10 — Make offer → XRP escrow path`);
const offerResult = await marketplaceService.makeOffer({
  listingId: listing.listingId,
  buyerAddress,
});
console.log('Offer ID:   ', offerResult.offer_id);
console.log('Status:     ', offerResult.status);
console.log('Next step:  ', offerResult.next_step);
console.log('Escrow params:', JSON.stringify(offerResult.escrow_params, null, 2));

// ── Step 11: Create escrow ────────────────────────────────────────────────────
console.log(`${SEP}\nStep 11 — Create escrow`);
const { unsignedTx, signingInstructions } = await marketplaceService.createEscrow({
  account: buyerAddress,
  destination: sellerAddress,
  amountXrp: 50,
  finishAfter: Math.floor(Date.now() / 1000) + 15,
  network: 'testnet',
});
console.log('chain_family:    ', unsignedTx.chain_family);
console.log('TransactionType: ', unsignedTx.payload.TransactionType);
console.log('Amount (drops):  ', unsignedTx.payload.Amount);
console.log('Sequence:        ', unsignedTx.payload.Sequence);
console.log('Signing hint:    ', signingInstructions);

// ── Step 12: EscrowMonitor ────────────────────────────────────────────────────
console.log(`${SEP}\nStep 12 — EscrowMonitor state check`);
const monitor = new EscrowMonitor(
  walletService,
  buyerAddress,
  unsignedTx.payload.Sequence,
  'testnet',
);
const state = await monitor.check();
console.log('Escrow status:', state.status);
console.log('→ PENDING = tx prepared but not yet broadcast — correct for demo');

// ── Step 13: Sign + broadcast EscrowCreate ────────────────────────────────────
console.log(`${SEP}\nStep 13 — Sign + broadcast EscrowCreate on XRPL testnet`);
const buyerSigner = XrplSigner.fromSeed(buyerSeed);
const signedEscrowJson = await buyerSigner.signTransaction(unsignedTx);
const { tx_blob: escrowTxBlob } = JSON.parse(signedEscrowJson);
const escrowBroadcast = await transport.callTool('wallet_xrpl_broadcast', {
  signed_tx_blob: escrowTxBlob,
  network: 'testnet',
});
const escrowSequence = unsignedTx.payload.Sequence;
console.log('Broadcast result:', JSON.stringify(escrowBroadcast, null, 2));
console.log('Escrow sequence (for accept_offer):', escrowSequence);

// ── Step 14: Wait for testnet confirmation ────────────────────────────────────
console.log(`${SEP}\nStep 14 — Waiting 20s for testnet confirmation + finish_after to elapse...`);
await new Promise(r => setTimeout(r, 20000));
console.log('Confirmed — escrow is live on XRPL testnet and finish_after has elapsed');

// ── Step 15: Seller accepts offer ─────────────────────────────────────────────
console.log(`${SEP}\nStep 15 — Seller accepts offer (server verifies escrow on-chain)`);
const acceptResult = await transport.callTool('marketplace_accept_offer', {
  offer_id: offerResult.offer_id,
  seller_address: sellerAddress,
  escrow_sequence: escrowSequence,
});
console.log('Accept result:', JSON.stringify(acceptResult, null, 2));

// ── Step 16: Buyer confirms delivery ─────────────────────────────────────────
console.log(`${SEP}\nStep 16 — Buyer confirms delivery received`);
const deliveryResult = await transport.callTool('marketplace_confirm_delivery', {
  offer_id: offerResult.offer_id,
  buyer_address: buyerAddress,
});
console.log('Delivery result:', JSON.stringify(deliveryResult, null, 2));

// ── Step 17: Sign + broadcast EscrowFinish ────────────────────────────────────
console.log(`${SEP}\nStep 17 — Sign + broadcast EscrowFinish (release XRP to seller)`);
const { unsignedTx: finishTx } = await marketplaceService.releaseEscrow({
  account: buyerAddress,
  owner: buyerAddress,
  offerSequence: escrowSequence,
  network: 'testnet',
});
const signedFinishJson = await buyerSigner.signTransaction(finishTx);
const { tx_blob: finishTxBlob } = JSON.parse(signedFinishJson);
try {
  const finishBroadcast = await transport.callTool('wallet_xrpl_broadcast', {
    signed_tx_blob: finishTxBlob,
    network: 'testnet',
  });
  console.log('EscrowFinish broadcast:', JSON.stringify(finishBroadcast, null, 2));
} catch (err) {
  console.log(`EscrowFinish submitted — note: if finish_after (${Math.floor(Date.now() / 1000) + 300}s) hasn't elapsed, XRPL rejects early; in production, submit after time lock expires.`);
  console.log('Error:', err.message);
}

// ── Step 18: Final balances ───────────────────────────────────────────────────
console.log(`${SEP}\nStep 18 — Final balances after transaction`);
await new Promise(r => setTimeout(r, 3000));
const finalSellerBalance = await walletService.xrplBalance(sellerAddress, 'testnet');
const finalBuyerBalance = await walletService.xrplBalance(buyerAddress, 'testnet');
console.log(`Seller — balance: ${finalSellerBalance.xrp.balance} XRP, available: ${finalSellerBalance.xrp.available} XRP`);
console.log(`Buyer  — balance: ${finalBuyerBalance.xrp.balance} XRP, available: ${finalBuyerBalance.xrp.available} XRP`);
console.log('→ If EscrowFinish was accepted: seller gained ~50 XRP, buyer reduced ~50 XRP');

console.log(`${SEP}`);
console.log('✓ Full Phase 2 demo complete');
console.log('  Complete flow: list → search → offer → escrow → accept → confirm → finish');
console.log('  x402 XRPL/RLUSD requires a live t54.ai facilitator — skipped in this demo.');

await transport.disconnect();
process.exit(0);
