"""Lightweight structlog type stubs used by mypy."""

from typing import Any, Protocol, Sequence


class BoundLogger(Protocol):
    """Protocol for structlog BoundLogger accepting arbitrary key/value pairs."""

    def debug(self, event: str | None = None, **kw: Any) -> None: ...
    def info(self, event: str | None = None, **kw: Any) -> None: ...
    def warning(self, event: str | None = None, **kw: Any) -> None: ...
    def error(self, event: str | None = None, **kw: Any) -> None: ...
    def critical(self, event: str | None = None, **kw: Any) -> None: ...
    def exception(self, event: str | None = None, **kw: Any) -> None: ...
    def log(self, level: Any, event: str | None = None, **kw: Any) -> None: ...
    def bind(self, **kw: Any) -> BoundLogger: ...
    def unbind(self, *keys: str) -> BoundLogger: ...
    def try_unbind(self, *keys: str) -> BoundLogger: ...
    def new(self, **kw: Any) -> BoundLogger: ...


def configure(
    *,
    processors: Sequence[Any],
    wrapper_class: type[BoundLogger] | Any = ...,
    logger_factory: Any = ...,
    cache_logger_on_first_use: bool = ...,
) -> None: ...


def get_logger(name: str | None = None) -> BoundLogger: ...


stdlib: Any
processors: Any
contextvars: Any
dev: Any


__all__ = [
    "BoundLogger",
    "configure",
    "contextvars",
    "dev",
    "get_logger",
    "processors",
    "stdlib",
]
