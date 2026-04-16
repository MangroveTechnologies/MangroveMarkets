from __future__ import annotations

from typing import Protocol


class AuthStrategy(Protocol):
    def apply(self, headers: dict[str, str]) -> dict[str, str]: ...


class ApiKeyAuth:
    """Authorization: Bearer {api_key}"""

    def __init__(self, api_key: str) -> None:
        self._api_key = api_key

    def apply(self, headers: dict[str, str]) -> dict[str, str]:
        headers["Authorization"] = f"Bearer {self._api_key}"
        return headers


class NoAuth:
    """No authentication headers."""

    def apply(self, headers: dict[str, str]) -> dict[str, str]:
        return headers
