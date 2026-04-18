"""Quick start: check chain info and list DEX venues."""

import os

from mangrovemarkets import MangroveMarkets

client = MangroveMarkets(
    base_url="https://mangrovemarkets-pcqgpciucq-uc.a.run.app",
    api_key=os.getenv("MANGROVE_API_KEY"),
)

# Chain info
info = client.wallet.chain_info(chain="evm")
print(f"Chain: {info.chain}, Native token: {info.native_token}")

# DEX venues
venues = client.dex.supported_venues()
for v in venues:
    print(f"  {v.id}: {v.name} ({v.chain}) - {v.supported_pairs_count} pairs")

client.close()
