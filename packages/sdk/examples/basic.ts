import { MangroveClient, EthersSigner } from '@mangrove-ai/sdk';
// import { Wallet } from 'ethers'; // uncomment with real wallet

async function main() {
  // const wallet = new Wallet(process.env.PRIVATE_KEY!);
  // const signer = new EthersSigner(wallet, [1, 8453, 42161]);

  const client = new MangroveClient({
    url: process.env.MANGROVE_URL || 'https://api.mangrovemarkets.com',
    // signer,
    transport: 'mcp',
  });

  await client.connect();

  // Get a quote
  const quote = await client.dex.getQuote({
    src: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC
    dst: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', // ETH
    amount: '1000000000', // 1000 USDC
    chainId: 8453,
  });

  console.log('Quote:', quote);
  await client.disconnect();
}

main().catch(console.error);
