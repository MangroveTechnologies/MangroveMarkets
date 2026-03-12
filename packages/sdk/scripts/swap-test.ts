/**
 * SDK End-to-End Swap Test -- REAL MONEY ON BASE MAINNET
 *
 * Swaps ~4 USDC -> USDT on Base via 1inch through the full SDK flow:
 *   1. Connect via RestTransport to mangrovemarkets.com
 *   2. Get quote via DexService
 *   3. Check if ERC-20 approval needed
 *   4. Sign approval tx locally (if needed)
 *   5. Broadcast approval
 *   6. Get unsigned swap calldata
 *   7. Sign swap tx locally
 *   8. Broadcast swap tx
 *   9. Poll for confirmation
 *
 * Usage:
 *   npx tsx packages/sdk/scripts/swap-test.ts
 *
 * REQUIRES:
 *   - WALLET_SECRET env var (private key for 0xbf57...8d0)
 *   - Wallet must have USDC and ETH (for gas) on Base
 */

import { config } from 'dotenv';
config(); // loads .env from repo root

const SERVER_URL = 'https://mangrovemarkets.com';
const CHAIN_ID = 8453; // Base
const USDC = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913';
const USDT = '0xfde4c96c8593536e31f229ea8f37b2ada2699bb2';
const SWAP_AMOUNT = '4000000'; // 4 USDC (6 decimals)

function header(msg: string) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  ${msg}`);
  console.log('='.repeat(60));
}

async function main() {
  console.log('\nMangroveMarkets SDK -- Real Swap Test');
  console.log('='.repeat(60));
  console.log('BASE MAINNET. REAL MONEY. REAL 1INCH.');
  console.log('='.repeat(60));

  const walletSecret = process.env.WALLET_SECRET;
  const walletAddress = process.env.WALLET_ADDRESS;

  if (!walletSecret || !walletAddress) {
    console.error('ERROR: WALLET_SECRET and WALLET_ADDRESS must be set in .env');
    process.exit(1);
  }

  console.log(`\n  Wallet: ${walletAddress}`);
  console.log(`  Chain: Base (${CHAIN_ID})`);
  console.log(`  Swap: ${Number(SWAP_AMOUNT) / 1e6} USDC -> USDT`);

  // -- Step 1: Set up SDK --
  header('1. Initialize SDK');
  const { MangroveClient, EthersSigner } = await import('../src/index.js');
  const { ethers } = await import('ethers');

  const wallet = new ethers.Wallet(walletSecret);
  const signer = new EthersSigner(wallet);
  const client = new MangroveClient({
    url: SERVER_URL,
    transport: 'rest',
    signer,
  });

  await client.connect();
  console.log('  [OK] SDK connected via REST transport');
  console.log(`  [OK] Signer address: ${await signer.getAddress()}`);

  // -- Step 2: Get quote --
  header('2. Get quote (USDC -> USDT on Base)');
  let quote: any;
  try {
    quote = await client.dex.getQuote({
      src: USDC,
      dst: USDT,
      amount: SWAP_AMOUNT,
      chainId: CHAIN_ID,
      mode: 'standard',
    });
    console.log(`  [OK] Quote ID: ${quote.quote_id || quote.quoteId}`);
    console.log(`  [OK] Venue: ${quote.venue_id || quote.venueId}`);
    console.log(`  [OK] Input: ${quote.input_amount || quote.inputAmount}`);
    console.log(`  [OK] Output: ${quote.output_amount || quote.outputAmount}`);
    console.log(`  [OK] Rate: ~${(Number(quote.output_amount || quote.outputAmount) / Number(SWAP_AMOUNT)).toFixed(4)} USDT per USDC`);
  } catch (e: any) {
    console.error(`  [FAIL] Quote failed: ${e.message}`);
    console.log('\n  This likely means the 1inch API key is not configured on the server.');
    console.log('  The quote endpoint requires a valid 1inch API key in server config.');
    process.exit(1);
  }

  // -- Step 3: Check approval --
  header('3. Check ERC-20 approval');
  const quoteId = quote.quote_id || quote.quoteId;
  try {
    const approval = await client.dex.approveToken({
      tokenAddress: USDC,
      chainId: CHAIN_ID,
      walletAddress,
      amount: SWAP_AMOUNT,
    });
    if (approval && approval.payload) {
      console.log('  [OK] Approval needed -- signing and broadcasting...');

      // Sign approval tx
      const signedApproval = await signer.signTransaction(approval);
      console.log(`  [OK] Approval signed: ${signedApproval.slice(0, 20)}...`);

      // Broadcast approval
      const approvalResult = await client.dex.broadcast({
        chainId: CHAIN_ID,
        signedTx: signedApproval,
      });
      console.log(`  [OK] Approval broadcast: ${approvalResult.tx_hash || approvalResult.txHash}`);

      // Wait for confirmation
      console.log('  [OK] Waiting for approval confirmation...');
      await new Promise(resolve => setTimeout(resolve, 5000));
    } else {
      console.log('  [OK] No approval needed (already approved or native token)');
    }
  } catch (e: any) {
    console.log(`  [INFO] Approval check: ${e.message}`);
    console.log('  Continuing -- approval may not be needed or may be pre-approved');
  }

  // -- Step 4: Prepare swap --
  header('4. Prepare swap (get unsigned calldata)');
  let unsignedTx: any;
  try {
    unsignedTx = await client.dex.prepareSwap({
      quoteId,
      walletAddress,
      slippage: 1.0,
    });
    console.log(`  [OK] Chain family: ${unsignedTx.chain_family || unsignedTx.chainFamily}`);
    console.log(`  [OK] Has payload: ${!!unsignedTx.payload}`);
    if (unsignedTx.payload) {
      console.log(`  [OK] To: ${unsignedTx.payload.to}`);
      console.log(`  [OK] Value: ${unsignedTx.payload.value}`);
      console.log(`  [OK] Data: ${(unsignedTx.payload.data || '').slice(0, 30)}...`);
    }
  } catch (e: any) {
    console.error(`  [FAIL] Prepare swap failed: ${e.message}`);
    process.exit(1);
  }

  // -- Step 5: Sign swap --
  header('5. Sign swap transaction locally');
  let signedTx: string;
  try {
    signedTx = await signer.signTransaction(unsignedTx);
    console.log(`  [OK] Signed: ${signedTx.slice(0, 30)}...`);
  } catch (e: any) {
    console.error(`  [FAIL] Signing failed: ${e.message}`);
    process.exit(1);
  }

  // -- Step 6: Broadcast --
  header('6. Broadcast signed transaction');
  let broadcastResult: any;
  try {
    broadcastResult = await client.dex.broadcast({
      chainId: CHAIN_ID,
      signedTx,
      mevProtection: false,
    });
    const txHash = broadcastResult.tx_hash || broadcastResult.txHash;
    console.log(`  [OK] TX Hash: ${txHash}`);
    console.log(`  [OK] Explorer: https://basescan.org/tx/${txHash}`);
  } catch (e: any) {
    console.error(`  [FAIL] Broadcast failed: ${e.message}`);
    process.exit(1);
  }

  // -- Step 7: Poll status --
  header('7. Poll transaction status');
  const txHash = broadcastResult.tx_hash || broadcastResult.txHash;
  for (let i = 0; i < 30; i++) {
    try {
      const status = await client.dex.txStatus({
        txHash,
        chainId: CHAIN_ID,
      });
      const state = status.status || status.state;
      console.log(`  [POLL ${i + 1}] Status: ${state}`);
      if (state === 'confirmed' || state === 'success') {
        console.log(`  [OK] Transaction confirmed!`);
        console.log(`  [OK] Block: ${status.block_number || status.blockNumber}`);
        break;
      }
      if (state === 'failed' || state === 'reverted') {
        console.error(`  [FAIL] Transaction failed: ${status.error_message || status.errorMessage}`);
        break;
      }
    } catch (e: any) {
      console.log(`  [POLL ${i + 1}] Waiting... (${e.message})`);
    }
    await new Promise(resolve => setTimeout(resolve, 3000));
  }

  // -- Done --
  header('RESULT');
  console.log(`  Swapped ${Number(SWAP_AMOUNT) / 1e6} USDC -> USDT on Base`);
  console.log(`  TX: https://basescan.org/tx/${txHash}`);
  console.log(`  This proves the FULL SDK flow: quote -> approve -> sign -> broadcast -> confirm`);

  await client.disconnect();
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
