"""Quick start: check chain info and list DEX venues."""

from mangrovemarkets import MangroveMarkets

client = MangroveMarkets(base_url="http://localhost:8080")

# Chain info
info = client.wallet.chain_info(chain="evm")
print(f"Chain: {info.chain}, Native token: {info.native_token}")

# DEX venues
venues = client.dex.supported_venues()
for v in venues:
    print(f"  {v.id}: {v.name} ({v.chain}) - {v.supported_pairs_count} pairs")

client.close()
