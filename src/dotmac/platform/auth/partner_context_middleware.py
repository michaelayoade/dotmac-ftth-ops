"""Partner Tenant Context Middleware for multi-tenant partner access."""

from typing import Any

import structlog
from fastapi import HTTPException, Request, status
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import Response

from dotmac.platform.auth.core import UserInfo

logger = structlog.get_logger(__name__)


class PartnerTenantContextMiddleware(BaseHTTPMiddleware):
    """
    Middleware to handle partner multi-tenant context switching.

    This middleware:
    1. Checks for X-Active-Tenant-Id header in requests
    2. Validates that the authenticated user has partner access to the tenant
    3. Enriches UserInfo with active_managed_tenant_id for cross-tenant access
    4. Ensures security by validating partner-tenant links

    Security:
    - Only applies to authenticated requests with partner_id
    - Validates tenant ID is in user's managed_tenant_ids
    - Prevents unauthorized cross-tenant access
    - Audit trail is handled by AuditContextMiddleware
    """

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        """Process request and validate partner tenant context."""

        # Check for X-Active-Tenant-Id header
        active_tenant_id = request.headers.get("X-Active-Tenant-Id")

        if not active_tenant_id:
            # No context switching requested, proceed normally
            return await call_next(request)

        # Get current user from request state (set by auth dependency)
        user_info: UserInfo | None = request.state.__dict__.get("user")

        if not user_info:
            # User not authenticated yet, let auth middleware handle it
            # Store the requested tenant ID for later processing
            request.state.requested_active_tenant_id = active_tenant_id
            return await call_next(request)

        # Validate partner context switch
        if not user_info.partner_id:
            logger.warning(
                "Non-partner user attempted cross-tenant access",
                user_id=user_info.user_id,
                requested_tenant=active_tenant_id,
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cross-tenant access requires partner account",
            )

        # Validate tenant is in managed list
        if active_tenant_id not in user_info.managed_tenant_ids:
            logger.warning(
                "Partner attempted access to unauthorized tenant",
                user_id=user_info.user_id,
                partner_id=user_info.partner_id,
                requested_tenant=active_tenant_id,
                managed_tenants=user_info.managed_tenant_ids,
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Partner does not have access to tenant {active_tenant_id}",
            )

        # Enrich UserInfo with active managed tenant context
        # Create a new UserInfo instance with updated context
        enriched_user_info = UserInfo(
            user_id=user_info.user_id,
            email=user_info.email,
            username=user_info.username,
            roles=user_info.roles,
            permissions=user_info.permissions,
            tenant_id=user_info.tenant_id,
            is_platform_admin=user_info.is_platform_admin,
            partner_id=user_info.partner_id,
            managed_tenant_ids=user_info.managed_tenant_ids,
            active_managed_tenant_id=active_tenant_id,
        )

        # Update request state with enriched user info
        request.state.user = enriched_user_info

        logger.info(
            "Partner context switched to managed tenant",
            user_id=enriched_user_info.user_id,
            partner_id=enriched_user_info.partner_id,
            home_tenant=enriched_user_info.tenant_id,
            active_tenant=active_tenant_id,
            is_cross_tenant=enriched_user_info.is_cross_tenant_access,
        )

        # Proceed with request
        response = await call_next(request)

        # Add response header to indicate active tenant context
        response.headers["X-Active-Tenant-Id"] = active_tenant_id
        if enriched_user_info.is_cross_tenant_access:
            response.headers["X-Cross-Tenant-Access"] = "true"

        return response


async def validate_partner_tenant_link(
    partner_id: str, managed_tenant_id: str, db_session: Any
) -> bool:
    """
    Validate that an active partner-tenant link exists.

    Args:
        partner_id: Partner UUID
        managed_tenant_id: Tenant ID to access
        db_session: Database session

    Returns:
        True if valid link exists, False otherwise
    """
    try:
        from sqlalchemy import select
        from sqlalchemy.ext.asyncio import AsyncSession

        from dotmac.platform.partner_management.models import PartnerTenantLink

        if not isinstance(db_session, AsyncSession):
            logger.error("Invalid database session type for partner link validation")
            return False

        # Query for active link
        result = await db_session.execute(
            select(PartnerTenantLink).where(
                PartnerTenantLink.partner_id == partner_id,
                PartnerTenantLink.managed_tenant_id == managed_tenant_id,
                PartnerTenantLink.is_active == True,  # noqa: E712
            )
        )
        link = result.scalars().first()

        if not link:
            return False

        # Check if link is expired
        if link.is_expired:
            logger.warning(
                "Partner-tenant link is expired",
                partner_id=partner_id,
                managed_tenant_id=managed_tenant_id,
                end_date=link.end_date,
            )
            return False

        return True
    except Exception as e:
        logger.error(
            "Failed to validate partner-tenant link",
            partner_id=partner_id,
            managed_tenant_id=managed_tenant_id,
            error=str(e),
        )
        return False
