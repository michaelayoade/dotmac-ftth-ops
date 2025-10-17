"""
Tenant-facing add-ons API router.

Provides self-service endpoints for tenant admins to browse and purchase add-ons.
"""

import structlog
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.auth.core import UserInfo
from dotmac.platform.auth.dependencies import get_current_user, require_scopes
from dotmac.platform.billing._typing_helpers import rate_limit
from dotmac.platform.billing.exceptions import AddonNotFoundError
from dotmac.platform.db import get_async_session
from dotmac.platform.tenant import get_current_tenant_id

from .models import (
    AddonResponse,
    CancelAddonRequest,
    PurchaseAddonRequest,
    TenantAddonResponse,
    UpdateAddonQuantityRequest,
)
from .service import AddonService

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/tenant/addons", tags=["Tenant - Add-ons"])


# ============================================================================
# Add-on Marketplace (Browse Available Add-ons)
# ============================================================================


@router.get("/available", response_model=list[AddonResponse])
async def get_available_addons(
    tenant_id: str = Depends(get_current_tenant_id),
    db_session: AsyncSession = Depends(get_async_session),
    current_user: UserInfo = Depends(require_scopes("billing.addons.view")),
) -> list[AddonResponse]:
    """
    Browse available add-ons marketplace.

    Returns all add-ons available for the tenant's current subscription plan.
    Filters by:
    - Active status
    - Plan compatibility
    - Tenant eligibility

    **Permissions**: Requires billing.addons.view permission
    """
    service = AddonService(db_session)

    try:
        # Get tenant's current plan ID from their subscription
        # TODO: Fetch plan_id from tenant's active subscription
        plan_id = None

        addons = await service.get_available_addons(tenant_id, plan_id)

        logger.info(
            "Available add-ons retrieved",
            tenant_id=tenant_id,
            addon_count=len(addons),
            user_id=current_user.user_id,
        )

        return addons

    except Exception as e:
        logger.error(
            "Failed to retrieve available add-ons",
            tenant_id=tenant_id,
            error=str(e),
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve available add-ons",
        )


# ============================================================================
# Active Add-ons (View Purchased Add-ons)
# ============================================================================


@router.get("/active", response_model=list[TenantAddonResponse])
async def get_active_tenant_addons(
    tenant_id: str = Depends(get_current_tenant_id),
    db_session: AsyncSession = Depends(get_async_session),
    current_user: UserInfo = Depends(require_scopes("billing.addons.view")),
) -> list[TenantAddonResponse]:
    """
    Get tenant's active add-ons.

    Returns all add-ons currently purchased by the tenant,
    including those marked for cancellation but still active.

    **Permissions**: Requires billing.addons.view permission
    """
    service = AddonService(db_session)

    try:
        addons = await service.get_active_addons(tenant_id)

        logger.info(
            "Active add-ons retrieved",
            tenant_id=tenant_id,
            addon_count=len(addons),
            user_id=current_user.user_id,
        )

        return addons

    except Exception as e:
        logger.error(
            "Failed to retrieve active add-ons",
            tenant_id=tenant_id,
            error=str(e),
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve active add-ons",
        )


# ============================================================================
# Purchase Add-on
# ============================================================================


@router.post("/{addon_id}/purchase", response_model=TenantAddonResponse)
@rate_limit("10/minute")  # type: ignore[misc]
async def purchase_addon(
    addon_id: str,
    request: PurchaseAddonRequest,
    tenant_id: str = Depends(get_current_tenant_id),
    db_session: AsyncSession = Depends(get_async_session),
    current_user: UserInfo = Depends(require_scopes("billing.addons.purchase")),
) -> TenantAddonResponse:
    """
    Purchase an add-on for the tenant.

    **What happens**:
    1. Validates add-on exists and is available
    2. Checks plan compatibility
    3. Validates quantity constraints
    4. Creates invoice for charges (price * quantity + setup_fee)
    5. Activates add-on immediately
    6. Sends confirmation email

    **Pricing**:
    - One-time add-ons: Single charge
    - Recurring add-ons: Charged every billing cycle
    - Metered add-ons: Usage-based billing

    **Permissions**: Requires billing.addons.purchase permission (TENANT_ADMIN or TENANT_BILLING_MANAGER)
    **Rate Limit**: 10 purchases per minute
    """
    # Validate addon_id matches request
    if addon_id != request.addon_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Add-on ID in URL does not match request body",
        )

    service = AddonService(db_session)

    try:
        tenant_addon = await service.purchase_addon(
            tenant_id=tenant_id,
            addon_id=request.addon_id,
            quantity=request.quantity,
            subscription_id=request.subscription_id,
            purchased_by_user_id=current_user.user_id,
        )

        logger.info(
            "Add-on purchased",
            tenant_id=tenant_id,
            addon_id=addon_id,
            quantity=request.quantity,
            user_id=current_user.user_id,
        )

        return tenant_addon

    except AddonNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except NotImplementedError as e:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail=str(e),
        )
    except Exception as e:
        logger.error(
            "Failed to purchase add-on",
            tenant_id=tenant_id,
            addon_id=addon_id,
            error=str(e),
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to purchase add-on",
        )


# ============================================================================
# Update Add-on Quantity
# ============================================================================


@router.patch("/{tenant_addon_id}/quantity", response_model=TenantAddonResponse)
@rate_limit("10/minute")  # type: ignore[misc]
async def update_addon_quantity(
    tenant_addon_id: str,
    request: UpdateAddonQuantityRequest,
    tenant_id: str = Depends(get_current_tenant_id),
    db_session: AsyncSession = Depends(get_async_session),
    current_user: UserInfo = Depends(require_scopes("billing.addons.purchase")),
) -> TenantAddonResponse:
    """
    Adjust quantity for a tenant's add-on.

    Only works for quantity-based add-ons (e.g., user seats, storage GB).

    **What happens**:
    - **Increase**: Prorated charge for additional units
    - **Decrease**: Credit applied to next invoice

    **Constraints**:
    - Quantity must be within add-on's min/max limits
    - Cannot adjust quantity for non-quantity-based add-ons
    - Add-on must be in ACTIVE status

    **Permissions**: Requires billing.addons.purchase permission (TENANT_ADMIN or TENANT_BILLING_MANAGER)
    **Rate Limit**: 10 adjustments per minute
    """
    service = AddonService(db_session)

    try:
        tenant_addon = await service.update_addon_quantity(
            tenant_addon_id=tenant_addon_id,
            tenant_id=tenant_id,
            new_quantity=request.quantity,
            updated_by_user_id=current_user.user_id,
        )

        logger.info(
            "Add-on quantity updated",
            tenant_id=tenant_id,
            tenant_addon_id=tenant_addon_id,
            new_quantity=request.quantity,
            user_id=current_user.user_id,
        )

        return tenant_addon

    except AddonNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except NotImplementedError as e:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail=str(e),
        )
    except Exception as e:
        logger.error(
            "Failed to update add-on quantity",
            tenant_id=tenant_id,
            tenant_addon_id=tenant_addon_id,
            error=str(e),
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update add-on quantity",
        )


# ============================================================================
# Cancel Add-on
# ============================================================================


@router.post("/{tenant_addon_id}/cancel", response_model=TenantAddonResponse)
@rate_limit("5/minute")  # type: ignore[misc]
async def cancel_addon(
    tenant_addon_id: str,
    request: CancelAddonRequest,
    tenant_id: str = Depends(get_current_tenant_id),
    db_session: AsyncSession = Depends(get_async_session),
    current_user: UserInfo = Depends(require_scopes("billing.addons.purchase")),
) -> TenantAddonResponse:
    """
    Cancel a tenant's add-on.

    **Cancellation Options**:
    - **At period end** (default): Add-on remains active until current billing period ends
    - **Immediate**: Add-on ends immediately, prorated refund issued

    **What happens**:
    1. Marks add-on for cancellation
    2. Calculates refund (if immediate cancellation)
    3. Issues credit/refund
    4. Sends cancellation confirmation email
    5. Records cancellation reason

    **Important**:
    - Canceling at period end allows continued access
    - Immediate cancellation ends access immediately
    - Refunds processed according to billing policy

    **Permissions**: Requires billing.addons.purchase permission (TENANT_ADMIN or TENANT_BILLING_MANAGER)
    **Rate Limit**: 5 cancellations per minute
    """
    service = AddonService(db_session)

    try:
        tenant_addon = await service.cancel_addon(
            tenant_addon_id=tenant_addon_id,
            tenant_id=tenant_id,
            cancel_immediately=request.cancel_immediately,
            reason=request.reason,
            canceled_by_user_id=current_user.user_id,
        )

        logger.info(
            "Add-on canceled",
            tenant_id=tenant_id,
            tenant_addon_id=tenant_addon_id,
            cancel_immediately=request.cancel_immediately,
            user_id=current_user.user_id,
            reason=request.reason,
        )

        return tenant_addon

    except AddonNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except NotImplementedError as e:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail=str(e),
        )
    except Exception as e:
        logger.error(
            "Failed to cancel add-on",
            tenant_id=tenant_id,
            tenant_addon_id=tenant_addon_id,
            error=str(e),
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to cancel add-on",
        )


# ============================================================================
# Reactivate Add-on
# ============================================================================


@router.post("/{tenant_addon_id}/reactivate", response_model=TenantAddonResponse)
@rate_limit("5/minute")  # type: ignore[misc]
async def reactivate_addon(
    tenant_addon_id: str,
    tenant_id: str = Depends(get_current_tenant_id),
    db_session: AsyncSession = Depends(get_async_session),
    current_user: UserInfo = Depends(require_scopes("billing.addons.purchase")),
) -> TenantAddonResponse:
    """
    Reactivate a canceled add-on before period end.

    **Requirements**:
    - Add-on must be in "canceled" status
    - Current billing period must not have ended yet
    - Cannot reactivate fully ended add-ons

    **What happens**:
    1. Removes cancellation flag
    2. Add-on continues as normal
    3. Next renewal will proceed automatically
    4. Sends reactivation confirmation email

    **Permissions**: Requires billing.addons.purchase permission (TENANT_ADMIN or TENANT_BILLING_MANAGER)
    **Rate Limit**: 5 requests per minute
    """
    service = AddonService(db_session)

    try:
        tenant_addon = await service.reactivate_addon(
            tenant_addon_id=tenant_addon_id,
            tenant_id=tenant_id,
            reactivated_by_user_id=current_user.user_id,
        )

        logger.info(
            "Add-on reactivated",
            tenant_id=tenant_id,
            tenant_addon_id=tenant_addon_id,
            user_id=current_user.user_id,
        )

        return tenant_addon

    except AddonNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except NotImplementedError as e:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail=str(e),
        )
    except Exception as e:
        logger.error(
            "Failed to reactivate add-on",
            tenant_id=tenant_id,
            tenant_addon_id=tenant_addon_id,
            error=str(e),
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to reactivate add-on",
        )
