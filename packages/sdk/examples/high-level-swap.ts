import { MangroveClient, EthersSigner } from '@mangrove-ai/sdk';
import { Wallet } from 'ethers';

async function main() {
  const wallet = new Wallet(process.env.PRIVATE_KEY!);
  const signer = new EthersSigner(wallet, [1, 8453, 42161]);

  const client = new MangroveClient({
    url: 'https://api.mangrovemarkets.com',
    signer,
    transport: 'mcp',
  });

  await client.connect();

  // One-call swap: handles approval, signing, broadcast, and polling
  const result = await client.dex.swap({
    src: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC
    dst: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', // ETH
    amount: '1000000000',
    chainId: 8453,
    slippage: 0.5,
    mevProtection: true,
    mode: 'standard', // Fee captured in swap (0.25%)
  });

  console.log('Swap result:', result);
  // { txHash, chainId, status, gasUsed, inputToken, outputToken, inputAmount, outputAmount }

  await client.disconnect();
}

main().catch(console.error);
