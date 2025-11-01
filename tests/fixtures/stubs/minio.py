"""
MinIO stub used during unit tests to avoid optional dependency imports.
"""

from __future__ import annotations

import sys
import types
from typing import Any


def ensure_minio_stub() -> None:
    """Register a lightweight MinIO stub if the real package is unavailable."""
    if "minio" in sys.modules:
        return

    minio_module = types.ModuleType("minio")

    class _DummyMinioClient:
        def __init__(self, *args: Any, **kwargs: Any) -> None:  # noqa: D401, ANN001
            """No-op MinIO client stub."""

        def bucket_exists(self, bucket: str) -> bool:  # noqa: D401, ANN001
            return True

        def make_bucket(self, bucket: str) -> None:  # noqa: D401, ANN001
            return None

        def put_object(self, *args: Any, **kwargs: Any) -> None:  # noqa: D401, ANN001
            return None

        def get_object(self, *args: Any, **kwargs: Any):  # noqa: ANN001
            class _DummyResponse:
                def read(self) -> bytes:
                    return b""

                def close(self) -> None:
                    return None

                def release_conn(self) -> None:
                    return None

            return _DummyResponse()

        def remove_object(self, *args: Any, **kwargs: Any) -> None:  # noqa: D401, ANN001
            return None

        def copy_object(self, *args: Any, **kwargs: Any) -> None:  # noqa: D401, ANN001
            return None

    minio_module.Minio = _DummyMinioClient

    error_module = types.ModuleType("minio.error")

    class S3Error(Exception):
        """Minimal S3Error stub used in unit tests."""

    error_module.S3Error = S3Error

    commonconfig_module = types.ModuleType("minio.commonconfig")

    class CopySource:
        """Lightweight stand-in for MinIO CopySource."""

        def __init__(self, bucket: str, object_name: str) -> None:
            self.bucket = bucket
            self.object_name = object_name

    commonconfig_module.CopySource = CopySource

    sys.modules["minio"] = minio_module
    sys.modules["minio.error"] = error_module
    sys.modules["minio.commonconfig"] = commonconfig_module

    minio_module.error = error_module
    minio_module.commonconfig = commonconfig_module
