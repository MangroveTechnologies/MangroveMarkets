/**
 * Mangrove Markets SDK - Usage Examples
 * 
 * This file demonstrates how to use the TypeScript SDK to interact
 * with the Mangrove Markets marketplace and DEX.
 */
import { MangroveClient } from './client/MangroveClient';

async function main() {
  // Initialize the client
  const client = new MangroveClient({
    baseUrl: process.env.MANGROVE_API_URL || 'http://localhost:8080',
    apiKey: process.env.MANGROVE_API_KEY,
    timeout: 30000,
  });

  try {
    // Health check
    const health = await client.health(true);
    console.log('Health:', health);

    // List marketplace listings
    const listings = await client.listListings({ limit: 10 });
    console.log('Listings:', listings);

    // Get a DEX quote
    const quote = await client.getDexQuote({
      fromToken: 'XRP',
      toToken: 'MGVI',
      amount: '100',
      side: 'buy',
    });
    console.log('Quote:', quote);

    // Get wallet balances
    const balances = await client.getBalances('rABC123...');
    console.log('Balances:', balances);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

main();
