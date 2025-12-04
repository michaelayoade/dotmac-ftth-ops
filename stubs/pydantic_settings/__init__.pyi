from builtins import dict as _dict
from typing import Any, Mapping, TypeVar

from pydantic import BaseModel, ConfigDict

T = TypeVar("T", bound="BaseSettings")

SettingsConfigDict = ConfigDict


class BaseSettings(BaseModel):
    model_config: _dict[str, Any]

    @classmethod
    def model_validate(
        cls: type[T],
        data: Any,
        *,
        from_attributes: bool = ...,
        context: Mapping[str, Any] | None = ...,
    ) -> T: ...

    def model_dump(self, *args: Any, **kwargs: Any) -> _dict[str, Any]: ...
    def model_dump_json(self, *args: Any, **kwargs: Any) -> str: ...
