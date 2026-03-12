import { MangroveClient, EthersSigner } from '@mangrovemarkets/sdk';
import { Wallet } from 'ethers';

async function main() {
  const wallet = new Wallet(process.env.PRIVATE_KEY!);
  const signer = new EthersSigner(wallet, [1, 8453]);

  const client = new MangroveClient({
    url: 'https://api.mangrovemarkets.com',
    signer,
  });

  await client.connect();

  // Step 1: Get quote
  const quote = await client.dex.getQuote({
    src: '0xUSDC_ADDRESS',
    dst: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
    amount: '1000000000',
    chainId: 8453,
  });
  console.log('Quote:', quote.quoteId, 'output:', quote.outputAmount);

  // Step 2: Approve token (ERC20 only)
  const approvalTx = await client.dex.approveToken({
    tokenAddress: '0xUSDC_ADDRESS',
    chainId: 8453,
  });
  const signedApproval = await signer.signTransaction(approvalTx);
  const approvalResult = await client.dex.broadcast({
    chainId: 8453,
    signedTx: signedApproval,
  });
  console.log('Approval tx:', approvalResult.txHash);

  // Step 3: Prepare and sign swap
  const swapTx = await client.dex.prepareSwap(quote.quoteId, 0.5);
  const signedSwap = await signer.signTransaction(swapTx);
  const { txHash } = await client.dex.broadcast({
    chainId: 8453,
    signedTx: signedSwap,
    mevProtection: true,
  });
  console.log('Swap tx:', txHash);

  // Step 4: Poll status
  let status = await client.dex.txStatus({ txHash, chainId: 8453 });
  while (status.status === 'pending') {
    await new Promise(r => setTimeout(r, 3000));
    status = await client.dex.txStatus({ txHash, chainId: 8453 });
  }
  console.log('Final status:', status);

  await client.disconnect();
}

main().catch(console.error);
