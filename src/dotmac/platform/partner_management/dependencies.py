"""
Shared dependencies for partner management routers.

Provides authenticated partner resolution for partner portal endpoints.
"""

from __future__ import annotations

from uuid import UUID

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.auth.core import UserInfo, ensure_uuid, get_current_user
from dotmac.platform.auth.platform_admin import is_platform_admin
from dotmac.platform.db import get_session_dependency
from dotmac.platform.partner_management.models import Partner, PartnerStatus, PartnerUser
from dotmac.platform.tenant import get_current_tenant_id


async def _get_partner_by_id(
    session: AsyncSession,
    partner_id: UUID,
    tenant_id: str | None,
) -> Partner | None:
    """Fetch partner by ID with optional tenant scoping."""
    query = select(Partner).where(Partner.id == partner_id, Partner.deleted_at.is_(None))

    if tenant_id:
        query = query.where(Partner.tenant_id == tenant_id)

    result = await session.execute(query)
    return result.scalar_one_or_none()


async def _get_partner_for_platform_admin(
    session: AsyncSession,
    partner_identifier: str,
    tenant_id: str | None,
) -> Partner:
    """Resolve partner for a platform administrator using an explicit identifier."""
    try:
        partner_uuid = ensure_uuid(partner_identifier)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid partner_id provided. Expected UUID.",
        ) from exc

    partner = await _get_partner_by_id(session, partner_uuid, tenant_id)
    if not partner:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Partner {partner_uuid} not found",
        )
    return partner


async def _get_partner_for_portal_user(
    session: AsyncSession,
    current_user: UserInfo,
    tenant_id: str | None,
) -> Partner:
    """Resolve partner associated with the current authenticated partner user."""
    if not current_user.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Partner portal access requires an authenticated user.",
        )

    try:
        user_uuid = ensure_uuid(current_user.user_id)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Authenticated user context is invalid for partner portal access.",
        ) from exc

    partner_user_query = select(PartnerUser).where(
        PartnerUser.user_id == user_uuid,
        PartnerUser.is_active.is_(True),
        PartnerUser.deleted_at.is_(None),
    )

    if tenant_id:
        partner_user_query = partner_user_query.where(PartnerUser.tenant_id == tenant_id)

    partner_user_result = await session.execute(partner_user_query)
    partner_user = partner_user_result.scalar_one_or_none()

    if not partner_user:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Partner portal access denied for this user.",
        )

    partner = await _get_partner_by_id(session, partner_user.partner_id, tenant_id)
    if not partner:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Partner account not found.",
        )

    if partner.status != PartnerStatus.ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Partner account is not active.",
        )

    return partner


async def get_portal_partner(
    request: Request,
    current_user: UserInfo = Depends(get_current_user),
    session: AsyncSession = Depends(get_session_dependency),
) -> Partner:
    """
    Resolve the partner context for partner portal endpoints.

    * Partner users are mapped via PartnerUser entries.
    * Platform administrators must specify the partner via query param or header.
    """

    tenant_id = get_current_tenant_id()

    if is_platform_admin(current_user):
        partner_identifier: str | None = (
            request.query_params.get("partner_id")
            or request.headers.get("X-Partner-ID")
            or request.path_params.get("partner_id")
        )
        if not partner_identifier:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Platform admin access requires partner_id via query parameter or header.",
            )
        partner = await _get_partner_for_platform_admin(session, partner_identifier, tenant_id)
    else:
        partner = await _get_partner_for_portal_user(session, current_user, tenant_id)

    # Persist partner context on the request for downstream usage.
    try:
        request.state.partner_id = str(partner.id)
    except Exception:  # pragma: no cover - defensive
        pass

    return partner


__all__ = ["get_portal_partner"]
