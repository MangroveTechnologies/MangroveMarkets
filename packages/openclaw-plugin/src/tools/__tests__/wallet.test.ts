import { expect, it, vi } from 'vitest';
import { walletToolHandlers } from '../wallet';

it.each(['mangrove_wallet_create', 'mangrove_xrpl_create'] as const)(
  '%s never generates keys for an AI tool transcript', async name => {
    const client = { wallet: { create: vi.fn(), createXrplWallet: vi.fn() } };
    const handlers = walletToolHandlers(client);
    await expect(handlers[name]({ chain: 'xrpl' })).rejects.toMatchObject({ code: 'LOCAL_CUSTODY_REQUIRED' });
    expect(client.wallet.create).not.toHaveBeenCalled();
    expect(client.wallet.createXrplWallet).not.toHaveBeenCalled();
  },
);

it('does not advertise wallet creation without local custody', async () => {
  const { readFileSync } = await import('node:fs');
  const manifest = JSON.parse(readFileSync(new URL('../../../openclaw.plugin.json', import.meta.url), 'utf8'));
  expect(manifest.tools.map((tool: { name: string }) => tool.name)).not.toContain('mangrove_wallet_create');
});
