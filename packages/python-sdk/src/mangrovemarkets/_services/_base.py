from __future__ import annotations

from typing import Any, TypeVar

from pydantic import BaseModel

from .._transport._service import ServiceTransport

T = TypeVar("T", bound=BaseModel)
TOOLS_PATH = "/tools"


class BaseService:
    """Base class for all service implementations."""

    def __init__(self, transport: ServiceTransport) -> None:
        self._transport = transport

    def _call_tool(self, tool_name: str, params: dict[str, Any] | None = None) -> Any:
        response = self._transport.request("POST", f"{TOOLS_PATH}/{tool_name}", json=params or {})
        return response.json()

    def _call_tool_model(
        self, tool_name: str, model: type[T], params: dict[str, Any] | None = None
    ) -> T:
        data = self._call_tool(tool_name, params)
        return model.model_validate(data)
