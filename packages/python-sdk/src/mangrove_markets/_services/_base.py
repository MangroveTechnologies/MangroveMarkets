from __future__ import annotations

from typing import Any, TypeVar

from pydantic import BaseModel

from .._transport._service import ServiceTransport
from ..exceptions import APIError

T = TypeVar("T", bound=BaseModel)
TOOLS_PATH = "/tools"


class BaseService:
    """Base class for all service implementations."""

    def __init__(self, transport: ServiceTransport) -> None:
        self._transport = transport

    def _call_tool(self, tool_name: str, params: dict[str, Any] | None = None) -> Any:
        """Call an MCP tool via REST bridge. Raises APIError on tool-level errors."""
        response = self._transport.request("POST", f"{TOOLS_PATH}/{tool_name}", json=params or {})
        data = response.json()
        if isinstance(data, dict) and data.get("error") is True:
            raise APIError(
                status_code=response.status_code,
                error=str(data.get("error", "unknown_error")),
                message=str(data.get("message", "Unknown tool error")),
                code=str(data.get("code", "TOOL_ERROR")),
                suggestion=data.get("suggestion"),
            )
        return data

    def _call_tool_model(
        self, tool_name: str, model: type[T], params: dict[str, Any] | None = None
    ) -> T:
        data = self._call_tool(tool_name, params)
        return model.model_validate(data)
