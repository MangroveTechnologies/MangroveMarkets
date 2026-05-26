from __future__ import annotations

from mangrove_markets._transport._mock import MockTransport


def make_mock() -> MockTransport:
    return MockTransport()
