# MangroveMarkets Python SDK

Python SDK for MangroveMarkets -- DEX aggregation, wallet management, and portfolio analytics for agents.

## Installation

```bash
pip install mangrovemarkets
```

## Quickstart

```python
from mangrovemarkets import MangroveMarkets

client = MangroveMarkets(base_url="http://localhost:8080")
venues = client.dex.supported_venues()
```
