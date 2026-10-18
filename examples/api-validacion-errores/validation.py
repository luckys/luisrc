import re
from typing import Literal, Self

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class ReservationInput(BaseModel):
    model_config = ConfigDict(strict=True, extra="forbid")

    sku: str
    quantity: int = Field(ge=1, le=100)
    expectedVersion: int = Field(ge=1, le=1_000_000)
    priority: Literal["standard", "express"]
    note: str = Field(default="", max_length=80)

    @field_validator("sku")
    @classmethod
    def valid_sku(cls, value: str) -> str:
        if re.fullmatch(r"[A-Z][A-Z0-9-]{0,23}", value) is None:
            raise ValueError("invalid_sku")
        return value

    @field_validator("quantity", "expectedVersion", mode="before")
    @classmethod
    def json_integer(cls, value: object) -> object:
        # JSON Schema acepta 2.0 como integer; no convertimos strings ni bools.
        if isinstance(value, float) and value.is_integer():
            return int(value)
        return value

    @model_validator(mode="after")
    def express_limit(self) -> Self:
        if self.priority == "express" and self.quantity > 5:
            raise ValueError("express_limit")
        return self
