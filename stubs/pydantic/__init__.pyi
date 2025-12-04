from __future__ import annotations

from builtins import dict as _dict
from typing import Any, Callable, Mapping, Sequence, TypeVar

ModelT = TypeVar("ModelT", bound="BaseModel")


class ValidationError(Exception):
    def errors(self) -> list[Any]: ...
    def json(self, *args: Any, **kwargs: Any) -> str: ...


class FieldInfo:
    default: Any
    annotation: Any
    description: str | None
    metadata: tuple[Any, ...]
    def is_required(self, *, return_true_if_required: bool = ...) -> bool: ...


class ConfigDict(dict[str, Any]):
    ...


class SecretStr(str):
    def get_secret_value(self) -> str: ...


class SecretBytes(bytes):
    def get_secret_value(self) -> bytes: ...


class EmailStr(str):
    ...


class AliasChoices:
    def __init__(self, *choices: str, preferred: str | None = ...) -> None: ...


class ValidationInfo:
    data: Mapping[str, Any]
    config: Mapping[str, Any] | None


class FieldValidationInfo:
    data: Mapping[str, Any]
    field_name: str


class BaseModel:
    model_config: _dict[str, Any]
    model_fields: _dict[str, FieldInfo]
    def __init__(self, *args: Any, **kwargs: Any) -> None: ...
    def model_dump(self, *args: Any, **kwargs: Any) -> _dict[str, Any]: ...
    def model_dump_json(self, *args: Any, **kwargs: Any) -> str: ...
    def dict(self, *args: Any, **kwargs: Any) -> _dict[str, Any]: ...
    def json(self, *args: Any, **kwargs: Any) -> str: ...
    def model_copy(self: ModelT, *args: Any, **kwargs: Any) -> ModelT: ...
    @classmethod
    def model_validate(
        cls: type[ModelT],
        data: Any,
        *,
        from_attributes: bool = ...,
        context: Mapping[str, Any] | None = ...,
    ) -> ModelT: ...
    @classmethod
    def model_validate_json(
        cls: type[ModelT],
        data: Any,
        *,
        context: Mapping[str, Any] | None = ...,
    ) -> ModelT: ...
    @classmethod
    def model_json_schema(cls, *args: Any, **kwargs: Any) -> _dict[str, Any]: ...
    @classmethod
    def parse_obj(cls: type[ModelT], obj: Any) -> ModelT: ...
    @classmethod
    def parse_raw(cls: type[ModelT], data: str | bytes, *args: Any, **kwargs: Any) -> ModelT: ...


def Field(*args: Any, **kwargs: Any) -> Any: ...


def computed_field(*args: Any, **kwargs: Any) -> Callable[[Callable[..., Any]], Any]: ...


def validator(*fields: str, **kwargs: Any) -> Callable[..., Any]: ...


def field_validator(*fields: str, mode: str = ...) -> Callable[..., Any]: ...


def model_validator(*, mode: str = ...) -> Callable[..., Any]: ...


class RootModel(BaseModel):
    root: Any


__all__ = [
    "AliasChoices",
    "BaseModel",
    "ConfigDict",
    "EmailStr",
    "Field",
    "FieldInfo",
    "FieldValidationInfo",
    "RootModel",
    "SecretBytes",
    "SecretStr",
    "ValidationError",
    "ValidationInfo",
    "computed_field",
    "field_validator",
    "model_validator",
    "validator",
]
