"""
Shared Pydantic helpers to keep serialization consistent across models.

Pydantic v2 deprecates ``json_encoders`` and V1-style validators.  This module
provides a common base model that centralises the most common serialization
rules (ISO datetimes, stringified decimals/UUIDs) using ``field_serializer``.
"""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict
from pydantic.functional_serializers import field_serializer


class AppBaseModel(BaseModel):  # BaseModel resolves to Any in isolation
    """
    Base Pydantic model with sensible serialization defaults.

    * Datetime/date values are serialised to ISO-8601 strings.
    * Decimal values are converted to strings to avoid float precision loss.
    * UUID values are serialised to their canonical string representation.
    """

    model_config = ConfigDict()

    @field_serializer("*", when_used="json", check_fields=False)
    def _serialize_special(self, value: Any) -> Any:  # noqa: D401 - inline doc
        """Serialize special types to JSON-compatible formats."""
        if value is None:
            return None
        if isinstance(value, (datetime, date)):
            return value.isoformat()
        if isinstance(value, Decimal):
            return str(value)
        if isinstance(value, UUID):
            return str(value)
        return value
