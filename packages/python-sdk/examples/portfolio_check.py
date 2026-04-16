"""Check portfolio value and token holdings."""

from mangrovemarkets import MangroveMarkets

client = MangroveMarkets(base_url="http://localhost:8080")

wallet = "0xYOUR_WALLET_ADDRESS"

# Portfolio overview
value = client.portfolio.value(addresses=wallet)
print(f"Total portfolio: ${value.total_value_usd:,.2f}")

# P&L
pnl = client.portfolio.pnl(addresses=wallet)
print(f"Total P&L: ${pnl.total_pnl_usd:,.2f}")

# Token holdings
holdings = client.portfolio.tokens(addresses=wallet)
for token in holdings.tokens or []:
    print(f"  {token.get('symbol', '???')}: {token.get('balance', 0)} (${token.get('value_usd', 0):,.2f})")

# Recent transactions
history = client.portfolio.history(address=wallet, limit=5)
for tx in history:
    print(f"  {tx.tx_hash[:10]}... - {tx.status}")

client.close()
