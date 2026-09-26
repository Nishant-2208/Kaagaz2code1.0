from pydantic import BaseModel, Field
from typing import Any

class FieldValue(BaseModel):
    value: Any = None
    confidence: float = Field(ge=0, le=1)
    flagged: bool = False
