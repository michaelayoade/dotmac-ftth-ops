"""
Billing module dependencies and common utilities.

This module provides shared dependencies for billing endpoints,
including tenant context resolution and database session management.
"""

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.database import get_async_session
from dotmac.platform.tenant import get_current_tenant_id


async def get_tenant_id(request: Request) -> str:
    """
    Get tenant ID from request context.

    The tenant ID should be set by TenantMiddleware from:
    1. Request state (set by middleware)
    2. X-Tenant-ID header
    3. tenant_id query parameter
    4. Default tenant ID (in single-tenant mode)

    Args:
        request: The current HTTP request

    Returns:
        The tenant ID for the current request

    Raises:
        HTTPException: If tenant ID cannot be determined
    """
    # First try to get from context variable (set by middleware)
    tenant_id: str | None = get_current_tenant_id()
    if tenant_id:
        return tenant_id

    # Then check request state (fallback for direct state access)
    if hasattr(request.state, "tenant_id"):
        state_tenant = request.state.tenant_id
        if isinstance(state_tenant, str) and state_tenant:
            return state_tenant

    # If we get here, tenant middleware didn't set the context
    # This should not happen if middleware is configured correctly
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Tenant context not found. Ensure X-Tenant-ID header or tenant_id query param is provided.",
    )


class BillingServiceDeps:
    """
    Common dependencies for billing service endpoints.

    Use this class to inject both database session and tenant context
    into billing service endpoints.

    Example:
        @router.post("/invoices")
        async def create_invoice(
            deps: BillingServiceDeps = Depends(),
            invoice_data: CreateInvoiceRequest,
        ):
            service = InvoiceService(deps.db)
            return await service.create_invoice(
                tenant_id=deps.tenant_id,
                ...
            )
    """

    def __init__(
        self,
        request: Request,
        db: AsyncSession = Depends(get_async_session),
    ):
        self.db = db
        self.request = request
        self._tenant_id: str | None = None

    @property
    def tenant_id(self) -> str:
        """Get tenant ID lazily when accessed."""
        if self._tenant_id is None:
            # Use async context in sync property by checking context var
            context_tenant: str | None = get_current_tenant_id()
            if context_tenant:
                self._tenant_id = context_tenant

            # Fallback to request state
            if self._tenant_id is None and hasattr(self.request.state, "tenant_id"):
                state_tenant = self.request.state.tenant_id
                if isinstance(state_tenant, str) and state_tenant:
                    self._tenant_id = state_tenant

            # Final validation
            if not self._tenant_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Tenant context not found. Ensure X-Tenant-ID header or tenant_id query param is provided.",
                )

        return self._tenant_id


# Convenience function for backwards compatibility
def get_tenant_id_from_request(request: Request) -> str:
    """
    Extract tenant ID from request.

    This is a compatibility wrapper for existing code.
    New code should use get_tenant_id dependency or BillingServiceDeps.

    Args:
        request: The current HTTP request

    Returns:
        The tenant ID for the current request

    Raises:
        HTTPException: If tenant ID cannot be determined
    """
    # Use context variable first
    tenant_id: str | None = get_current_tenant_id()
    if tenant_id:
        return tenant_id

    # Check request state (set by middleware)
    if hasattr(request.state, "tenant_id"):
        state_tenant = request.state.tenant_id
        if isinstance(state_tenant, str) and state_tenant:
            return state_tenant

    # Fallback to header (should not be needed if middleware is working)
    tenant_id = request.headers.get("X-Tenant-ID")
    if tenant_id:
        return tenant_id

    # Fallback to query parameter (should not be needed if middleware is working)
    tenant_id = request.query_params.get("tenant_id")
    if tenant_id:
        return tenant_id

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Tenant ID is required. Provide via X-Tenant-ID header or tenant_id query param.",
    )
