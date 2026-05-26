from __future__ import annotations

from typing import Any

from ._base import MangroveModel


class ToolResponse(MangroveModel):
    """Wrapper for MCP tool REST responses."""

    success: bool = True
    data: Any = None
    error: bool = False
    code: str | None = None
    message: str | None = None
    suggestion: str | None = None
