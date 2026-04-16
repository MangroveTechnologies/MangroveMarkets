from pydantic import BaseModel, ConfigDict


class MangroveModel(BaseModel):
    """Base model for all MangroveMarkets SDK models."""

    model_config = ConfigDict(extra="allow")
