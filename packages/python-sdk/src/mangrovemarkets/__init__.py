"""MangroveMarkets Python SDK.

Quickstart:
    from mangrovemarkets import MangroveMarkets

    client = MangroveMarkets(base_url="http://localhost:8080")
    venues = client.dex.supported_venues()
"""

from ._version import __version__

__all__ = ["__version__"]
