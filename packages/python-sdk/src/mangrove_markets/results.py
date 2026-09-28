"""Opt-in full tool responses. Business methods retain their existing return types."""

from __future__ import annotations

import json
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, StrictBool, StrictStr, model_validator

RESULT_FORMAT_HEADER = "X-Mangrove-Result-Format"
RESULT_FORMAT = "mcp-v1"


class ContentBlock(BaseModel):
    """Preserve all fields, including media, resource and future content types."""

    model_config = ConfigDict(extra="allow")
    type: StrictStr

    @model_validator(mode="after")
    def validate_text(self) -> ContentBlock:
        if self.type == "text" and not isinstance(getattr(self, "text", None), str):
            raise ValueError("Text content requires a string")
        return self


class ToolResult(BaseModel):
    """MCP envelope, with aliases matching the wire protocol."""

    model_config = ConfigDict(extra="allow", populate_by_name=True)
    content: list[ContentBlock]
    structured_content: dict[str, Any] | None = Field(default=None, alias="structuredContent")
    is_error: StrictBool = Field(default=False, alias="isError")
    meta: dict[str, Any] | None = Field(default=None, alias="_meta")

    def data(self) -> Any:
        """Decode first JSON text, falling back to structured data; retain both."""
        for block in self.content:
            if block.type == "text":
                text = getattr(block, "text", None)
                try:
                    return json.loads(text) if isinstance(text, str) else self.structured_content
                except ValueError:
                    return self.structured_content
        return self.structured_content


class ToolResponse(BaseModel):
    """One invocation's result and HTTP response metadata, with no shared state."""

    result: ToolResult
    status: int
    headers: dict[str, str]
