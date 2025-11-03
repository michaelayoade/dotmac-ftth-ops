from typing import Any

from sqlalchemy.types import TypeDecorator


class JSONBCompat(TypeDecorator[Any]):
    cache_ok: bool
