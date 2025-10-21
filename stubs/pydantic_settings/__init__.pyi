from typing import Any, TypeVar

from pydantic import BaseModel

T = TypeVar("T", bound="BaseSettings")

class SettingsConfigDict(dict[str, Any]):
    ...

class BaseSettings(BaseModel):
    model_config: SettingsConfigDict
    @classmethod
    def model_validate(cls: type[T], data: Any) -> T: ...
    def model_dump(self, *args: Any, **kwargs: Any) -> dict[str, Any]: ...
