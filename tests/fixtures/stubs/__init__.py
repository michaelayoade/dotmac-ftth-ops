"""
Lightweight dependency stubs used by the shared pytest environment.

These helpers keep heavyweight shim implementations out of
``tests.fixtures.environment`` so the environment module stays focused on
configuration rather than mock implementations.
"""

from __future__ import annotations

from .minio import ensure_minio_stub
from .redis import create_fakeredis_stub

__all__ = ["ensure_minio_stub", "create_fakeredis_stub"]
