"""Development auth bootstrap helpers."""

from __future__ import annotations

from collections.abc import Callable
from typing import cast

import structlog
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.db import AsyncSessionLocal
from dotmac.platform.settings import settings
from dotmac.platform.user_management.service import UserService

logger = structlog.get_logger(__name__)


SessionFactory = Callable[[], AsyncSession]


async def ensure_default_admin_user(session_factory: SessionFactory | None = None) -> None:
    """Ensure a default administrator exists in non-production environments."""
    if settings.is_production:
        return

    username = settings.auth.default_admin_username
    email = settings.auth.default_admin_email
    password = settings.auth.default_admin_password

    factory: SessionFactory = cast(SessionFactory, session_factory or AsyncSessionLocal)

    async with factory() as session:
        service = UserService(session)

        existing = await service.get_user_by_username(username)
        if existing:
            return

        try:
            user = await service.create_user(
                username=username,
                email=email,
                password=password,
                full_name="Development Administrator",
                roles=["platform_admin"],
                tenant_id=None,
            )
        except ValueError:
            return

        user.is_superuser = True
        user.is_platform_admin = True
        user.is_verified = True

        await session.commit()
        logger.info("auth.default_admin.created", username=username, email=email)
