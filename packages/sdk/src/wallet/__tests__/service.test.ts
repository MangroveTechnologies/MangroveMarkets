import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WalletService } from '../service';
import type { Transport } from '../../types/transport';

function mockTransport(): Transport {
  return {
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    callTool: vi.fn().mockResolvedValue({}),
  };
}

describe('WalletService', () => {
  let transport: ReturnType<typeof mockTransport>;
  let wallet: WalletService;

  beforeEach(() => {
    transport = mockTransport();
    wallet = new WalletService(transport);
  });

  describe('chainInfo', () => {
    it('calls wallet_chain_info with default chain and normalizes response', async () => {
      (transport.callTool as ReturnType<typeof vi.fn>).mockResolvedValue({
        chain: 'xrpl',
        chain_family: 'xrpl',
        native_token: 'XRP',
        wallet_creation: 'server_faucet',
        networks: {
          testnet: {
            name: 'XRPL Testnet',
            rpc_url: 'https://s.altnet.rippletest.net:51234',
            explorer: 'https://testnet.xrpl.org',
            faucet_url: 'https://faucet.altnet.rippletest.net',
          },
        },
      });

      const result = await wallet.chainInfo();

      expect(transport.callTool).toHaveBeenCalledWith('wallet_chain_info', {
        chain: 'xrpl',
      });
      expect(result.chain).toBe('xrpl');
      expect(result.chainFamily).toBe('xrpl');
      expect(result.nativeToken).toBe('XRP');
      expect(result.walletCreation).toBe('server_faucet');
      expect(result.networks.testnet).toBeDefined();
    });

    it('passes custom chain parameter', async () => {
      (transport.callTool as ReturnType<typeof vi.fn>).mockResolvedValue({
        chain: 'evm',
        chain_family: 'evm',
        native_token: 'ETH',
        wallet_creation: 'client_side_only',
        networks: {},
        supported_chain_ids: [1, 8453],
        sdk_method: "client.wallet.create('evm')",
      });

      const result = await wallet.chainInfo({ chain: 'evm' });

      expect(transport.callTool).toHaveBeenCalledWith('wallet_chain_info', {
        chain: 'evm',
      });
      expect(result.chainFamily).toBe('evm');
      expect(result.nativeToken).toBe('ETH');
      expect(result.supportedChainIds).toEqual([1, 8453]);
      expect(result.sdkMethod).toBe("client.wallet.create('evm')");
    });
  });

  describe('create locally', () => {
    it('creates an unfunded XRPL wallet without a request or the legacy helper', async () => {
      const { Wallet } = await import('xrpl');
      const legacyCreate = vi.spyOn(wallet, 'createXrplWallet').mockImplementation(() => {
        throw new Error('Legacy helper must not be used');
      });
      const result = await wallet.create();
      expect(result.chain).toBe('xrpl');
      expect(result.network).toBe('testnet');
      expect(result.isFunded).toBe(false);
      expect(Wallet.fromSeed(result.secret!).classicAddress).toBe(result.address);
      expect(transport.callTool).not.toHaveBeenCalled();
      expect(legacyCreate).not.toHaveBeenCalled();
    });

    it('creates a valid EVM wallet without a request', async () => {
      const { Wallet } = await import('ethers');
      const result = await wallet.create({ chain: 'evm', chainId: 8453 });
      expect(new Wallet(result.privateKey!).address).toBe(result.address);
      expect(result.chainId).toBe(8453);
      expect(result.isFunded).toBe(false);
      expect(transport.callTool).not.toHaveBeenCalled();
    });

    it('generates different keys per invocation', async () => {
      const a = await wallet.create();
      const b = await wallet.create();
      expect(a.address).not.toBe(b.address);
      expect(a.secret).not.toBe(b.secret);
    });

    it.each([
      { chain: 'solana' }, { chain: 'xrpl', network: 'invalid' },
      { chain: 'evm', chainId: -1 }, { chain: 'xrpl', chainId: 1 },
    ])('rejects unsupported input locally: %j', async params => {
      await expect(wallet.create(params)).rejects.toThrow();
      expect(transport.callTool).not.toHaveBeenCalled();
    });
  });

  describe('balance', () => {
    it('calls wallet_balance with address and chain', async () => {
      const stubResponse = {
        error: true,
        code: 'NOT_IMPLEMENTED',
        message: 'wallet_balance not yet implemented',
      };
      (transport.callTool as ReturnType<typeof vi.fn>).mockResolvedValue(stubResponse);

      const result = await wallet.balance({ address: 'rAddr123' });

      expect(transport.callTool).toHaveBeenCalledWith('wallet_balance', {
        address: 'rAddr123',
        chain: 'xrpl',
      });
      expect(result).toEqual(stubResponse);
    });

    it('includes chain_id when provided', async () => {
      (transport.callTool as ReturnType<typeof vi.fn>).mockResolvedValue({});

      await wallet.balance({ address: '0xAddr', chain: 'evm', chainId: 8453 });

      expect(transport.callTool).toHaveBeenCalledWith('wallet_balance', {
        address: '0xAddr',
        chain: 'evm',
        chain_id: 8453,
      });
    });
  });

  describe('transactions', () => {
    it('calls wallet_transactions with address, chain, and default limit', async () => {
      const stubResponse = {
        error: true,
        code: 'NOT_IMPLEMENTED',
        message: 'wallet_transactions not yet implemented',
      };
      (transport.callTool as ReturnType<typeof vi.fn>).mockResolvedValue(stubResponse);

      const result = await wallet.transactions({ address: 'rAddr123' });

      expect(transport.callTool).toHaveBeenCalledWith('wallet_transactions', {
        address: 'rAddr123',
        chain: 'xrpl',
        limit: 20,
      });
      expect(result).toEqual(stubResponse);
    });

    it('passes custom limit and chain_id', async () => {
      (transport.callTool as ReturnType<typeof vi.fn>).mockResolvedValue({});

      await wallet.transactions({
        address: '0xAddr',
        chain: 'evm',
        chainId: 1,
        limit: 50,
      });

      expect(transport.callTool).toHaveBeenCalledWith('wallet_transactions', {
        address: '0xAddr',
        chain: 'evm',
        chain_id: 1,
        limit: 50,
      });
    });
  });
});
