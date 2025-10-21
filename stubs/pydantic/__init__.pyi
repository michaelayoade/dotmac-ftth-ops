from __future__ import annotations

from typing import Any, Callable, Mapping, TypeVar

T = TypeVar("T")

class BaseModel:
    model_config: dict[str, Any]
    def __init__(self, *args: Any, **kwargs: Any) -> None: ...
    def model_dump(self, *args: Any, **kwargs: Any) -> dict[str, Any]: ...
    @classmethod
    def model_validate(cls: type[T], data: Any) -> T: ...

class FieldInfo:
    default: Any

def Field(
    default: Any = ...,
    *,
    default_factory: Callable[[], Any] | None = ...,
    description: str | None = ...,
    ge: float | int | None = ...,
    le: float | int | None = ...,
    min_length: int | None = ...,
    max_length: int | None = ...,
) -> Any: ...

class ConfigDict(dict[str, Any]):
    ...

class SecretStr(str):
    ...

SecretBytes = bytes
