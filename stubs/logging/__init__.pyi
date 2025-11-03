"""Type stubs for logging module that allows structured logging with **kwargs."""

import sys
from typing import Any, Protocol, TypeVar, IO
from collections.abc import Callable
from types import TracebackType

_T = TypeVar("_T")
_ExcInfoType = tuple[type[BaseException], BaseException, TracebackType | None] | tuple[None, None, None]

# Export common constants
DEBUG: int
INFO: int
WARNING: int
ERROR: int
CRITICAL: int

# Base classes defined as stubs
class Filterer:
    """Base class for Logger and Handler which allows them to share common code."""
    def addFilter(self, filter: Filter | Callable[[LogRecord], bool | LogRecord]) -> None: ...
    def removeFilter(self, filter: Filter | Callable[[LogRecord], bool | LogRecord]) -> None: ...
    def filter(self, record: LogRecord) -> bool: ...

class Handler(Filterer):
    """Base handler class."""
    level: int
    def setLevel(self, level: int | str) -> None: ...
    def setFormatter(self, fmt: Formatter | None) -> None: ...
    def handle(self, record: LogRecord) -> bool: ...
    def emit(self, record: LogRecord) -> None: ...
    def flush(self) -> None: ...
    def close(self) -> None: ...

class LogRecord:
    """A LogRecord instance represents an event being logged."""
    name: str
    msg: Any
    args: tuple[Any, ...] | dict[str, Any]
    created: float
    levelname: str
    levelno: int
    pathname: str
    filename: str
    module: str
    exc_info: _ExcInfoType | None
    lineno: int
    funcName: str
    sinfo: str | None

class Filter:
    """Filter instances are used to perform arbitrary filtering of LogRecords."""
    def filter(self, record: LogRecord) -> bool: ...

class Formatter:
    """Formatter instances are used to convert a LogRecord to text."""
    def format(self, record: LogRecord) -> str: ...

class StreamHandler(Handler):
    """A handler class which writes logging records to a stream."""
    stream: IO[str]
    def __init__(self, stream: IO[str] | None = None) -> None: ...

class FileHandler(StreamHandler):
    """A handler class which writes formatted logging records to disk files."""
    def __init__(self, filename: str, mode: str = "a", encoding: str | None = None, delay: bool = False) -> None: ...

# Export common functions
def getLogger(name: str | None = None) -> Logger: ...
def basicConfig(**kwargs: Any) -> None: ...

# Override Logger class to support **kwargs
class Logger(Filterer):
    """Logger class that supports arbitrary keyword arguments for structured logging."""

    name: str
    level: int
    parent: Logger | None
    propagate: bool
    handlers: list[Handler]
    disabled: bool

    def __init__(self, name: str, level: int = ...) -> None: ...
    def setLevel(self, level: int | str) -> None: ...
    def isEnabledFor(self, level: int) -> bool: ...
    def getEffectiveLevel(self) -> int: ...
    def getChild(self, suffix: str) -> Logger: ...

    # Structured logging methods with **kwargs support
    def debug(
        self,
        msg: object,
        *args: object,
        exc_info: _ExcInfoType | bool | None = None,
        stack_info: bool = False,
        stacklevel: int = 1,
        extra: dict[str, Any] | None = None,
        **kwargs: Any,
    ) -> None: ...

    def info(
        self,
        msg: object,
        *args: object,
        exc_info: _ExcInfoType | bool | None = None,
        stack_info: bool = False,
        stacklevel: int = 1,
        extra: dict[str, Any] | None = None,
        **kwargs: Any,
    ) -> None: ...

    def warning(
        self,
        msg: object,
        *args: object,
        exc_info: _ExcInfoType | bool | None = None,
        stack_info: bool = False,
        stacklevel: int = 1,
        extra: dict[str, Any] | None = None,
        **kwargs: Any,
    ) -> None: ...

    def warn(
        self,
        msg: object,
        *args: object,
        exc_info: _ExcInfoType | bool | None = None,
        stack_info: bool = False,
        stacklevel: int = 1,
        extra: dict[str, Any] | None = None,
        **kwargs: Any,
    ) -> None: ...

    def error(
        self,
        msg: object,
        *args: object,
        exc_info: _ExcInfoType | bool | None = None,
        stack_info: bool = False,
        stacklevel: int = 1,
        extra: dict[str, Any] | None = None,
        **kwargs: Any,
    ) -> None: ...

    def exception(
        self,
        msg: object,
        *args: object,
        exc_info: _ExcInfoType | bool = True,
        stack_info: bool = False,
        stacklevel: int = 1,
        extra: dict[str, Any] | None = None,
        **kwargs: Any,
    ) -> None: ...

    def critical(
        self,
        msg: object,
        *args: object,
        exc_info: _ExcInfoType | bool | None = None,
        stack_info: bool = False,
        stacklevel: int = 1,
        extra: dict[str, Any] | None = None,
        **kwargs: Any,
    ) -> None: ...

    def fatal(
        self,
        msg: object,
        *args: object,
        exc_info: _ExcInfoType | bool | None = None,
        stack_info: bool = False,
        stacklevel: int = 1,
        extra: dict[str, Any] | None = None,
        **kwargs: Any,
    ) -> None: ...

    def log(
        self,
        level: int,
        msg: object,
        *args: object,
        exc_info: _ExcInfoType | bool | None = None,
        stack_info: bool = False,
        stacklevel: int = 1,
        extra: dict[str, Any] | None = None,
        **kwargs: Any,
    ) -> None: ...

    def findCaller(self, stack_info: bool = False, stacklevel: int = 1) -> tuple[str, int, str, str | None]: ...
    def makeRecord(
        self,
        name: str,
        level: int,
        fn: str,
        lno: int,
        msg: object,
        args: tuple[object, ...] | dict[str, object],
        exc_info: _ExcInfoType | None,
        func: str | None = None,
        extra: dict[str, object] | None = None,
        sinfo: str | None = None,
    ) -> LogRecord: ...
    def handle(self, record: LogRecord) -> None: ...
    def addHandler(self, hdlr: Handler) -> None: ...
    def removeHandler(self, hdlr: Handler) -> None: ...
    def hasHandlers(self) -> bool: ...
    def callHandlers(self, record: LogRecord) -> None: ...
    def addFilter(self, filter: Filter | Callable[[LogRecord], bool | LogRecord]) -> None: ...
    def removeFilter(self, filter: Filter | Callable[[LogRecord], bool | LogRecord]) -> None: ...
    def filter(self, record: LogRecord) -> bool: ...
    def _log(
        self,
        level: int,
        msg: object,
        args: tuple[object, ...],
        exc_info: _ExcInfoType | bool | None = None,
        extra: dict[str, object] | None = None,
        stack_info: bool = False,
        stacklevel: int = 1,
    ) -> None: ...
