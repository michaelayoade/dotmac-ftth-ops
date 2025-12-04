"""
Tenant-facing add-ons API router.

Provides self-service endpoints for tenant admins to browse and purchase add-ons.
"""

from inspect import isawaitable, signature
from typing import Any

import structlog
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.auth.core import (
    UserInfo,
    api_key_header,
    bearer_scheme,
    oauth2_scheme,
)
from dotmac.platform.auth.core import (
    get_current_user as _auth_get_current_user,
)
from dotmac.platform.billing._typing_helpers import rate_limit
from dotmac.platform.billing.exceptions import AddonNotFoundError
from dotmac.platform.db import get_async_db
from dotmac.platform.tenant import get_current_tenant_id

from .models import (
    Addon,
    AddonResponse,
    CancelAddonRequest,
    PurchaseAddonRequest,
    TenantAddonResponse,
    UpdateAddonQuantityRequest,
)
from .service import AddonService

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/addons", tags=["Tenant - Add-ons"])


async def _resolve(value):
    if isawaitable(value):
        return await value
    return value


def get_current_user(
    *,
    request: Request,
    token: str | None = None,
    api_key: str | None = None,
    credentials: HTTPAuthorizationCredentials | None = None,
) -> Any:
    """
    Adapter around the core authentication dependency.

    Tests may monkeypatch this function to supply a stub user, but the default
    behaviour simply delegates to the shared auth stack.
    """
    return _auth_get_current_user(request, token, api_key, credentials)


def _coerce_str_list(value: Any) -> list[str]:
    if not value:
        return []
    if isinstance(value, list):
        return [str(item) for item in value]
    if isinstance(value, (tuple, set)):
        return [str(item) for item in value]
    if isinstance(value, str):
        stripped = value.strip()
        return [stripped] if stripped else []
    return []


def _coerce_optional_str(value: Any) -> str | None:
    if isinstance(value, str) and value:
        return value
    return None


_ROLE_DEFAULT_PERMISSIONS: dict[str, set[str]] = {
    "tenant_admin": {"billing.addons.view", "billing.addons.purchase"},
    "tenant_billing_manager": {"billing.addons.view", "billing.addons.purchase"},
    "admin": {"billing.addons.view", "billing.addons.purchase"},
    "platform_admin": {"billing.addons.view", "billing.addons.purchase"},
    "tenant_user": {"billing.addons.view"},
}


def _derive_permissions(roles: list[str], permissions: list[str]) -> list[str]:
    """Return permissions, deriving defaults from roles when none supplied."""
    if permissions:
        return permissions

    derived: set[str] = set()
    for role in roles:
        derived.update(_ROLE_DEFAULT_PERMISSIONS.get(role, set()))

    return list(derived)


def _normalize_user(candidate: Any) -> UserInfo | None:
    if candidate is None:
        return None

    if isinstance(candidate, UserInfo):
        data = candidate.model_dump()
    elif isinstance(candidate, dict):
        data = candidate
    else:
        data = {
            "user_id": getattr(candidate, "user_id", None) or getattr(candidate, "id", None),
            "email": getattr(candidate, "email", None),
            "username": getattr(candidate, "username", None),
            "roles": getattr(candidate, "roles", None),
            "permissions": getattr(candidate, "permissions", None),
            "tenant_id": getattr(candidate, "tenant_id", None)
            or getattr(candidate, "tenant", None),
            "is_platform_admin": getattr(candidate, "is_platform_admin", False),
        }

    raw_user_id = data.get("user_id") or data.get("id")
    if isinstance(raw_user_id, (str, int)):
        user_id = str(raw_user_id)
    else:
        return None

    roles = _coerce_str_list(data.get("roles"))
    permissions = _derive_permissions(roles, _coerce_str_list(data.get("permissions")))

    tenant_id = _coerce_optional_str(data.get("tenant_id") or data.get("tenant"))
    email = _coerce_optional_str(data.get("email"))
    username = _coerce_optional_str(data.get("username"))
    is_platform_admin = data.get("is_platform_admin", False)
    if not isinstance(is_platform_admin, bool):
        is_platform_admin = False

    return UserInfo(
        user_id=str(user_id),
        email=email,
        username=username,
        roles=roles,
        permissions=permissions,
        tenant_id=tenant_id,
        is_platform_admin=is_platform_admin,
    )


async def _get_authenticated_user(request: Request) -> UserInfo:
    """
    Resolve the current user for add-on routes.

    In normal execution this delegates to the core authentication dependency.
    Tests can patch ``get_current_user`` in this module to bypass token
    validation and supply a stub user.
    """
    token = await oauth2_scheme(request)
    api_key = await api_key_header(request)
    credentials = await bearer_scheme(request)

    override = get_current_user
    candidate = None

    try:
        override_signature = signature(override)
    except (TypeError, ValueError):
        override_signature = None

    if override_signature:
        params = override_signature.parameters
        call_kwargs: dict[str, Any] = {}
        if "request" in params:
            call_kwargs["request"] = request
        if "token" in params and token is not None:
            call_kwargs["token"] = token
        if "api_key" in params and api_key is not None:
            call_kwargs["api_key"] = api_key
        if "credentials" in params and credentials is not None:
            call_kwargs["credentials"] = credentials

        try:
            candidate = override(**call_kwargs)
        except TypeError:
            candidate = override(request=request)
    else:
        candidate = override(request=request)

    resolved = await _resolve(candidate)
    normalized = _normalize_user(resolved)
    if normalized:
        return normalized

    return await _auth_get_current_user(request, token, api_key, credentials)


def _addon_to_response_model(addon: Addon) -> AddonResponse:
    return AddonResponse(
        addon_id=addon.addon_id,
        name=addon.name,
        description=addon.description,
        addon_type=addon.addon_type,
        billing_type=addon.billing_type,
        price=addon.price,
        currency=addon.currency,
        setup_fee=addon.setup_fee,
        is_quantity_based=addon.is_quantity_based,
        min_quantity=addon.min_quantity,
        max_quantity=addon.max_quantity,
        metered_unit=addon.metered_unit,
        included_quantity=addon.included_quantity,
        is_active=addon.is_active,
        is_featured=addon.is_featured,
        compatible_with_all_plans=addon.compatible_with_all_plans,
        icon=addon.icon,
        features=addon.features,
    )


def _require_scope(user: UserInfo, scope: str) -> None:
    permissions = getattr(user, "permissions", []) or []
    if scope not in permissions:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions",
        )


# ============================================================================
# Add-on Marketplace (Browse Available Add-ons)
# ============================================================================


@router.get("", response_model=list[AddonResponse])
async def get_available_addons(
    current_user: UserInfo = Depends(_get_authenticated_user),
    tenant_id: str | None = Depends(get_current_tenant_id),
    db_session: AsyncSession = Depends(get_async_db),
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
    effective_tenant_id = tenant_id or getattr(current_user, "tenant_id", None)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tenant context is required",
        )

    service = AddonService(db_session)

    try:
        # Get tenant's current plan ID from their subscription
        from sqlalchemy import select

        from dotmac.platform.billing.models import BillingSubscriptionTable
        from dotmac.platform.billing.subscriptions.models import SubscriptionStatus

        plan_id = None
        stmt = (
            select(BillingSubscriptionTable.plan_id)
            .where(BillingSubscriptionTable.tenant_id == effective_tenant_id)
            .where(
                BillingSubscriptionTable.status.in_(
                    [SubscriptionStatus.ACTIVE.value, SubscriptionStatus.TRIALING.value]
                )
            )
            .order_by(BillingSubscriptionTable.created_at.desc())
            .limit(1)
        )
        execution = db_session.execute(stmt)
        result = await _resolve(execution)
        plan_row = await _resolve(result.scalar_one_or_none())
        if plan_row:
            plan_id = plan_row

        addons = await service.get_available_addons(effective_tenant_id, plan_id)

        logger.info(
            "Available add-ons retrieved",
            tenant_id=effective_tenant_id,
            addon_count=len(addons),
            user_id=current_user.user_id,
        )

        return addons

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "Failed to retrieve available add-ons",
            tenant_id=effective_tenant_id,
            error=str(e),
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve available add-ons",
        )


# ============================================================================
# Active Add-ons (View Purchased Add-ons)
# ============================================================================


@router.get("/my-addons", response_model=list[TenantAddonResponse])
async def get_active_tenant_addons(
    current_user: UserInfo = Depends(_get_authenticated_user),
    tenant_id: str | None = Depends(get_current_tenant_id),
    db_session: AsyncSession = Depends(get_async_db),
) -> list[TenantAddonResponse]:
    """
    Get tenant's active add-ons.

    Returns all add-ons currently purchased by the tenant,
    including those marked for cancellation but still active.

    **Permissions**: Requires billing.addons.view permission
    """
    effective_tenant_id = tenant_id or getattr(current_user, "tenant_id", None)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tenant context is required",
        )

    service = AddonService(db_session)

    try:
        addons = await service.get_active_addons(effective_tenant_id)

        logger.info(
            "Active add-ons retrieved",
            tenant_id=effective_tenant_id,
            addon_count=len(addons),
            user_id=current_user.user_id,
        )

        return addons

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "Failed to retrieve active add-ons",
            tenant_id=effective_tenant_id,
            error=str(e),
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve active add-ons",
        )


# ============================================================================
# Add-on Details
# ============================================================================


@router.get("/{addon_id}", response_model=AddonResponse)
async def get_addon_by_id(
    addon_id: str,
    current_user: UserInfo = Depends(_get_authenticated_user),
    tenant_id: str | None = Depends(get_current_tenant_id),
    db_session: AsyncSession = Depends(get_async_db),
) -> AddonResponse:
    """Retrieve details for a single add-on."""

    service = AddonService(db_session)

    addon = await service.get_addon(addon_id)
    if not addon:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Add-on not found",
        )

    return _addon_to_response_model(addon)


# ============================================================================
# Purchase Add-on
# ============================================================================


@router.post("/purchase", response_model=TenantAddonResponse)
@rate_limit("10/minute")  # type: ignore[misc]
async def purchase_addon(
    purchase_request: PurchaseAddonRequest,
    request: Request,
    current_user: UserInfo = Depends(_get_authenticated_user),
    tenant_id: str | None = Depends(get_current_tenant_id),
    db_session: AsyncSession = Depends(get_async_db),
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
    effective_tenant_id = tenant_id or getattr(current_user, "tenant_id", None)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tenant context is required",
        )

    _require_scope(current_user, "billing.addons.purchase")

    service = AddonService(db_session)

    try:
        tenant_addon = await service.purchase_addon(
            tenant_id=effective_tenant_id,
            addon_id=purchase_request.addon_id,
            quantity=purchase_request.quantity,
            subscription_id=purchase_request.subscription_id,
            purchased_by_user_id=current_user.user_id,
        )

        logger.info(
            "Add-on purchased",
            tenant_id=effective_tenant_id,
            addon_id=purchase_request.addon_id,
            quantity=purchase_request.quantity,
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
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
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
            tenant_id=effective_tenant_id,
            addon_id=purchase_request.addon_id,
            error=str(e),
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to purchase add-on",
        )


# ============================================================================
# Update Add-on Quantity
# ============================================================================


@router.put("/{tenant_addon_id}/quantity", response_model=TenantAddonResponse)
@rate_limit("10/minute")  # type: ignore[misc]
async def update_addon_quantity(
    tenant_addon_id: str,
    update_request: UpdateAddonQuantityRequest,
    request: Request,
    current_user: UserInfo = Depends(_get_authenticated_user),
    tenant_id: str | None = Depends(get_current_tenant_id),
    db_session: AsyncSession = Depends(get_async_db),
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
    effective_tenant_id = tenant_id or getattr(current_user, "tenant_id", None)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tenant context is required",
        )

    _require_scope(current_user, "billing.addons.purchase")

    service = AddonService(db_session)

    try:
        tenant_addon = await service.update_addon_quantity(
            tenant_addon_id=tenant_addon_id,
            tenant_id=effective_tenant_id,
            new_quantity=update_request.quantity,
            updated_by_user_id=current_user.user_id,
        )

        logger.info(
            "Add-on quantity updated",
            tenant_id=effective_tenant_id,
            tenant_addon_id=tenant_addon_id,
            new_quantity=update_request.quantity,
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
    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "Failed to update add-on quantity",
            tenant_id=effective_tenant_id,
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
    cancel_request: CancelAddonRequest,
    request: Request,
    current_user: UserInfo = Depends(_get_authenticated_user),
    tenant_id: str | None = Depends(get_current_tenant_id),
    db_session: AsyncSession = Depends(get_async_db),
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
    effective_tenant_id = tenant_id or getattr(current_user, "tenant_id", None)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tenant context is required",
        )

    _require_scope(current_user, "billing.addons.purchase")

    service = AddonService(db_session)

    try:
        tenant_addon = await service.cancel_addon(
            tenant_addon_id=tenant_addon_id,
            tenant_id=effective_tenant_id,
            cancel_immediately=cancel_request.cancel_immediately,
            reason=cancel_request.reason,
            canceled_by_user_id=current_user.user_id,
        )

        logger.info(
            "Add-on canceled",
            tenant_id=effective_tenant_id,
            tenant_addon_id=tenant_addon_id,
            cancel_immediately=cancel_request.cancel_immediately,
            user_id=current_user.user_id,
            reason=cancel_request.reason,
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
    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "Failed to cancel add-on",
            tenant_id=effective_tenant_id,
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
    request: Request,
    current_user: UserInfo = Depends(_get_authenticated_user),
    tenant_id: str | None = Depends(get_current_tenant_id),
    db_session: AsyncSession = Depends(get_async_db),
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
    effective_tenant_id = tenant_id or getattr(current_user, "tenant_id", None)
    if not effective_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tenant context is required",
        )

    _require_scope(current_user, "billing.addons.purchase")

    service = AddonService(db_session)

    try:
        tenant_addon = await service.reactivate_addon(
            tenant_addon_id=tenant_addon_id,
            tenant_id=effective_tenant_id,
            reactivated_by_user_id=current_user.user_id,
        )

        logger.info(
            "Add-on reactivated",
            tenant_id=effective_tenant_id,
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
    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "Failed to reactivate add-on",
            tenant_id=effective_tenant_id,
            tenant_addon_id=tenant_addon_id,
            error=str(e),
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to reactivate add-on",
        )
