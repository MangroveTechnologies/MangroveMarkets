from __future__ import annotations

from mangrovemarkets._transport._mock import MockTransport


def make_mock() -> MockTransport:
    return MockTransport()
