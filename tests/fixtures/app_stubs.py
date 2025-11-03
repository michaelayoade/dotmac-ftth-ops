"""Helper stubs for FastAPI application fixtures."""

from __future__ import annotations

import logging
from collections.abc import Iterable
from contextlib import suppress
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

logger = logging.getLogger(__name__)

__all__ = [
    "create_mock_redis",
    "start_infrastructure_patchers",
]


def create_mock_redis() -> MagicMock:
    """Create an async-compatible Redis mock."""
    mock_redis = MagicMock()
    mock_redis.get = AsyncMock(return_value=None)
    mock_redis.set = AsyncMock(return_value=True)
    mock_redis.delete = AsyncMock(return_value=True)
    mock_redis.exists = AsyncMock(return_value=False)
    mock_redis.expire = AsyncMock(return_value=True)
    mock_redis.ttl = AsyncMock(return_value=-1)
    mock_redis.keys = AsyncMock(return_value=[])
    mock_redis.scan = AsyncMock(return_value=(0, []))
    mock_redis.ping = AsyncMock(return_value=True)
    mock_redis.setex = AsyncMock(return_value=True)
    mock_redis.scan_iter = AsyncMock(return_value=iter(()))
    return mock_redis


def start_infrastructure_patchers() -> list[Any]:
    """Start infrastructure patchers used by the test application."""
    patchers: list[Any] = []

    with suppress(ImportError):
        patcher = patch(
            "dotmac.platform.auth.rbac_service.RBACService.user_has_all_permissions",
            new_callable=AsyncMock,
            return_value=True,
        )
        patcher.start()
        patchers.append(patcher)

    # Event bus stubs ------------------------------------------------------
    with suppress(ImportError):
        from uuid import uuid4

        class _StubEventBus:
            def __init__(self) -> None:
                self._registered: dict[str, dict[str, Any]] = {}

            def subscribe(self, event_type: str, handler: Any) -> None:
                self._registered.setdefault(event_type, {"handlers": []})

            def unsubscribe(self, event_type: str, handler: Any) -> None:
                pass

            async def publish(
                self,
                event_type: str,
                payload: dict[str, Any] | None = None,
                metadata: dict[str, Any] | None = None,
                priority: Any | None = None,
            ) -> dict[str, Any]:
                return {
                    "id": f"evt_{uuid4().hex[:8]}",
                    "event_type": event_type,
                    "payload": payload or {},
                    "metadata": metadata or {},
                }

            def register_event(
                self,
                event_type: str,
                description: str,
                schema: dict[str, Any] | None = None,
                example: dict[str, Any] | None = None,
            ) -> None:
                self._registered[event_type] = {
                    "description": description,
                    "schema": schema,
                    "example": example,
                }

            async def start(self) -> None:  # pragma: no cover - not needed in tests
                pass

            async def stop(self) -> None:  # pragma: no cover - not needed in tests
                pass

        stub_event_bus = _StubEventBus()

        event_bus_patcher = patch(
            "dotmac.platform.events.bus.get_event_bus",
            side_effect=lambda *args, **kwargs: stub_event_bus,
        )
        event_bus_patcher.start()
        patchers.append(event_bus_patcher)

        webhook_event_bus_patcher = patch(
            "dotmac.platform.webhooks.events.get_event_bus",
            side_effect=lambda: stub_event_bus,
        )
        webhook_event_bus_patcher.start()
        patchers.append(webhook_event_bus_patcher)

    # Storage service stub -------------------------------------------------
    with suppress(ImportError):
        from uuid import uuid4

        class _StubStorageService:
            def __init__(self) -> None:
                self._files: dict[str, dict[str, Any]] = {}

            async def store(
                self,
                file_data: bytes,
                file_name: str,
                content_type: str,
                path: str | None = None,
                metadata: dict[str, Any] | None = None,
                tenant_id: str | None = None,
            ) -> str:
                file_id = f"file_{uuid4().hex[:8]}"
                self._files[file_id] = {
                    "data": file_data,
                    "name": file_name,
                    "content_type": content_type,
                    "path": path,
                    "metadata": metadata or {},
                    "tenant_id": tenant_id,
                }
                return file_id

            async def retrieve(
                self,
                file_id: str,
                tenant_id: str | None = None,
            ) -> tuple[bytes | None, dict[str, Any] | None]:
                record = self._files.get(file_id)
                if not record:
                    return None, None
                return record["data"], record["metadata"]

            async def delete(self, file_id: str, tenant_id: str | None = None) -> bool:
                return self._files.pop(file_id, None) is not None

            async def list_files(
                self,
                path: str | None = None,
                limit: int = 100,
                offset: int = 0,
                tenant_id: str | None = None,
            ) -> list[dict[str, Any]]:
                return []

            async def get_metadata(self, file_id: str) -> dict[str, Any] | None:
                record = self._files.get(file_id)
                return record["metadata"] if record else None

            async def move(
                self,
                file_id: str,
                destination: str,
                tenant_id: str | None = None,
            ) -> bool:
                if file_id not in self._files:
                    return False
                self._files[file_id]["path"] = destination
                return True

            async def copy(
                self,
                file_id: str,
                destination: str,
                tenant_id: str | None = None,
            ) -> bool:
                record = self._files.get(file_id)
                if not record:
                    return False
                new_id = f"file_{uuid4().hex[:8]}"
                new_record = record.copy()
                new_record["path"] = destination
                self._files[new_id] = new_record
                return True

        storage_stub = _StubStorageService()
        storage_patcher = patch(
            "dotmac.platform.file_storage.service.get_storage_service",
            return_value=storage_stub,
        )
        storage_patcher.start()
        patchers.append(storage_patcher)

    # Email service stub ---------------------------------------------------
    with suppress(ImportError):
        from uuid import uuid4

        from dotmac.platform.communications.email_service import EmailResponse

        class _StubEmailService:
            async def send_email(
                self,
                message: Any,
                tenant_id: str | None = None,
                db: Any | None = None,
            ) -> EmailResponse:
                return EmailResponse(
                    id=f"email_{uuid4().hex[:8]}",
                    status="queued",
                    message="Email queued (stub)",
                    recipients_count=len(getattr(message, "to", [])),
                )

            async def send_bulk_emails(self, messages: Iterable[Any]) -> list[EmailResponse]:
                return [
                    EmailResponse(
                        id=f"email_{uuid4().hex[:8]}",
                        status="queued",
                        message="Email queued (stub)",
                        recipients_count=len(getattr(msg, "to", [])),
                    )
                    for msg in messages
                ]

        email_stub = _StubEmailService()
        email_patcher = patch(
            "dotmac.platform.communications.email_service.get_email_service",
            return_value=email_stub,
        )
        email_patcher.start()
        patchers.append(email_patcher)

    if not patchers:
        logger.debug("No infrastructure patchers were started for the test app fixtures.")

    return patchers
