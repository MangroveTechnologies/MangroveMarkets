import { describe, it, expect, beforeEach } from 'vitest';
import { OneInchService } from '../service';
import { MockTransport } from '../../transport/__tests__/mock';

describe('OneInchService', () => {
  let transport: MockTransport;
  let oneinch: OneInchService;

  beforeEach(() => {
    transport = new MockTransport();
    oneinch = new OneInchService(transport);
  });

  it('getBalances calls oneinch_balances with chain_id and wallet', async () => {
    transport.addResponse('oneinch_balances', { balances: { '0xA0b8...': '1000000' } });

    const result = await oneinch.getBalances({ chainId: 8453, wallet: '0xWallet' });

    expect(transport.calls[0].name).toBe('oneinch_balances');
    expect(transport.calls[0].params).toEqual({ chain_id: 8453, wallet: '0xWallet' });
    expect(result.balances).toBeDefined();
  });

  it('getAllowances calls oneinch_allowances with chain_id, wallet, and spender', async () => {
    transport.addResponse('oneinch_allowances', { allowances: { '0xToken': '115792089237316195423570985008687907853269984665640564039457584007913129639935' } });

    const result = await oneinch.getAllowances({ chainId: 8453, wallet: '0xWallet', spender: '0xSpender' });

    expect(transport.calls[0].name).toBe('oneinch_allowances');
    expect(transport.calls[0].params).toEqual({ chain_id: 8453, wallet: '0xWallet', spender: '0xSpender' });
    expect(result.allowances).toBeDefined();
  });

  it('getSpotPrice calls oneinch_spot_price with chain_id and tokens', async () => {
    transport.addResponse('oneinch_spot_price', { prices: { '0xA0b8...': '1.0001' } });

    const result = await oneinch.getSpotPrice({ chainId: 8453, tokens: '0xA0b8...' });

    expect(transport.calls[0].name).toBe('oneinch_spot_price');
    expect(transport.calls[0].params).toEqual({ chain_id: 8453, tokens: '0xA0b8...' });
    expect(result.prices).toBeDefined();
  });

  it('getGasPrice calls oneinch_gas_price with chain_id', async () => {
    transport.addResponse('oneinch_gas_price', { baseFee: '0.01', maxPriorityFeePerGas: '0.001' });

    const result = await oneinch.getGasPrice({ chainId: 8453 });

    expect(transport.calls[0].name).toBe('oneinch_gas_price');
    expect(transport.calls[0].params).toEqual({ chain_id: 8453 });
    expect(result.baseFee).toBeDefined();
  });

  it('searchTokens calls oneinch_token_search with chain_id and query', async () => {
    transport.addResponse('oneinch_token_search', { tokens: [{ symbol: 'USDC', address: '0xA0b8...' }] });

    const result = await oneinch.searchTokens({ chainId: 8453, query: 'USDC' });

    expect(transport.calls[0].name).toBe('oneinch_token_search');
    expect(transport.calls[0].params).toEqual({ chain_id: 8453, query: 'USDC' });
    expect(result.tokens).toBeDefined();
  });

  it('getTokenInfo calls oneinch_token_info with chain_id and address', async () => {
    transport.addResponse('oneinch_token_info', { symbol: 'USDC', decimals: 6, name: 'USD Coin' });

    const result = await oneinch.getTokenInfo({ chainId: 8453, address: '0xA0b8...' });

    expect(transport.calls[0].name).toBe('oneinch_token_info');
    expect(transport.calls[0].params).toEqual({ chain_id: 8453, address: '0xA0b8...' });
    expect(result.symbol).toBe('USDC');
  });

  it('getPortfolioValue calls oneinch_portfolio_value with addresses', async () => {
    transport.addResponse('oneinch_portfolio_value', { totalValue: '12345.67' });

    const result = await oneinch.getPortfolioValue({ addresses: '0xWallet1,0xWallet2' });

    expect(transport.calls[0].name).toBe('oneinch_portfolio_value');
    expect(transport.calls[0].params).toEqual({ addresses: '0xWallet1,0xWallet2' });
    expect(result.totalValue).toBeDefined();
  });

  it('getPortfolioValue passes optional chainId', async () => {
    transport.addResponse('oneinch_portfolio_value', { totalValue: '500.00' });

    await oneinch.getPortfolioValue({ addresses: '0xWallet', chainId: 8453 });

    expect(transport.calls[0].params).toEqual({ addresses: '0xWallet', chain_id: 8453 });
  });

  it('getPortfolioPnl calls oneinch_portfolio_pnl with addresses', async () => {
    transport.addResponse('oneinch_portfolio_pnl', { pnl: '1234.56' });

    const result = await oneinch.getPortfolioPnl({ addresses: '0xWallet' });

    expect(transport.calls[0].name).toBe('oneinch_portfolio_pnl');
    expect(transport.calls[0].params).toEqual({ addresses: '0xWallet' });
    expect(result.pnl).toBeDefined();
  });

  it('getPortfolioTokens calls oneinch_portfolio_tokens with addresses', async () => {
    transport.addResponse('oneinch_portfolio_tokens', { tokens: [{ symbol: 'ETH', balance: '1.5' }] });

    const result = await oneinch.getPortfolioTokens({ addresses: '0xWallet' });

    expect(transport.calls[0].name).toBe('oneinch_portfolio_tokens');
    expect(transport.calls[0].params).toEqual({ addresses: '0xWallet' });
    expect(result.tokens).toBeDefined();
  });

  it('getPortfolioDefi calls oneinch_portfolio_defi with addresses', async () => {
    transport.addResponse('oneinch_portfolio_defi', { protocols: [{ name: 'Aave', value: '1000' }] });

    const result = await oneinch.getPortfolioDefi({ addresses: '0xWallet' });

    expect(transport.calls[0].name).toBe('oneinch_portfolio_defi');
    expect(transport.calls[0].params).toEqual({ addresses: '0xWallet' });
    expect(result.protocols).toBeDefined();
  });

  it('getChart calls oneinch_chart with chain_id, address, and default timerange', async () => {
    transport.addResponse('oneinch_chart', { points: [{ timestamp: 1000, price: 1.0 }] });

    const result = await oneinch.getChart({ chainId: 8453, address: '0xToken' });

    expect(transport.calls[0].name).toBe('oneinch_chart');
    expect(transport.calls[0].params).toEqual({ chain_id: 8453, address: '0xToken', timerange: '1month' });
    expect(result.points).toBeDefined();
  });

  it('getChart accepts custom timerange', async () => {
    transport.addResponse('oneinch_chart', { points: [] });

    await oneinch.getChart({ chainId: 1, address: '0xToken', timerange: '1year' });

    expect(transport.calls[0].params.timerange).toBe('1year');
  });

  it('getHistory calls oneinch_history with address and default limit', async () => {
    transport.addResponse('oneinch_history', { events: [{ type: 'swap', txHash: '0xabc' }] });

    const result = await oneinch.getHistory({ address: '0xWallet' });

    expect(transport.calls[0].name).toBe('oneinch_history');
    expect(transport.calls[0].params).toEqual({ address: '0xWallet', limit: 50 });
    expect(result.events).toBeDefined();
  });

  it('getHistory accepts custom limit', async () => {
    transport.addResponse('oneinch_history', { events: [] });

    await oneinch.getHistory({ address: '0xWallet', limit: 10 });

    expect(transport.calls[0].params.limit).toBe(10);
  });
});
