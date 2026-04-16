from __future__ import annotations

from abc import ABC, abstractmethod


class AuthStrategy(ABC):
    """Strategy for applying authentication to request headers."""

    @abstractmethod
    def apply(self, headers: dict[str, str]) -> dict[str, str]: ...


class ApiKeyAuth(AuthStrategy):
    """Authorization: Bearer {api_key}"""

    def __init__(self, api_key: str) -> None:
        self._api_key = api_key

    def apply(self, headers: dict[str, str]) -> dict[str, str]:
        headers["Authorization"] = f"Bearer {self._api_key}"
        return headers


class NoAuth(AuthStrategy):
    """No authentication headers."""

    def apply(self, headers: dict[str, str]) -> dict[str, str]:
        return headers
