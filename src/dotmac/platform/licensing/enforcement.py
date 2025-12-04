"""Utilities for licensing enforcement decorators and middleware."""

from __future__ import annotations

import functools
from collections.abc import Awaitable, Callable
from typing import TYPE_CHECKING, Any, ParamSpec, TypeVar, cast
from uuid import UUID

from fastapi import HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.db import get_session
from dotmac.platform.licensing.service_framework import (
    FeatureNotEntitledError,
    LicensingFrameworkService,
    QuotaExceededError,
)

if TYPE_CHECKING:
    from dotmac.platform.tenant.models import Tenant

P = ParamSpec("P")
R = TypeVar("R")

# ========================================================================
# FEATURE ENTITLEMENT DECORATORS
# ========================================================================


def require_module(
    module_code: str, capability_code: str | None = None
) -> Callable[[Callable[P, Awaitable[R]]], Callable[P, Awaitable[R]]]:
    """
    Decorator to enforce feature module entitlement.

    Usage:
        @router.get("/radius/auth")
        @require_module("radius_aaa", "radius_authentication")
        async def authenticate(tenant: Tenant = Depends(get_current_tenant)) -> Any:
            ...
    """

    def decorator(func: Callable[P, Awaitable[R]]) -> Callable[P, Awaitable[R]]:
        @functools.wraps(func)
        async def wrapper(*args: P.args, **kwargs: P.kwargs) -> R:
            # Extract tenant from dependencies
            tenant = cast("Tenant | None", kwargs.get("tenant"))
            if not tenant:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Tenant context required",
                )

            # Expect database session to be injected by FastAPI dependency
            db = cast(AsyncSession | None, kwargs.get("db"))
            if db is None:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=(
                        "Database session not provided. "
                        "Ensure the endpoint declares `db: AsyncSession = Depends(get_async_session)`."
                    ),
                )

            # Check entitlement
            service = LicensingFrameworkService(db)
            entitled = await service.check_feature_entitlement(
                tenant_id=tenant.id,
                module_code=module_code,
                capability_code=capability_code,
            )

            if not entitled:
                feature_name = (
                    f"{module_code}.{capability_code}" if capability_code else module_code
                )
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Feature not entitled: {feature_name}. Please upgrade your plan.",
                )

            return await func(*args, **kwargs)

        return wrapper

    return decorator


def check_feature_access(
    module_code: str, capability_code: str | None = None
) -> Callable[[Callable[P, Awaitable[R]]], Callable[P, Awaitable[R]]]:
    """
    Non-blocking feature check decorator.

    Adds 'feature_entitled' boolean to kwargs instead of blocking.
    Useful for optional features or degraded functionality.

    Usage:
        @router.get("/analytics/dashboard")
        @check_feature_access("analytics", "advanced_reports")
        async def dashboard(
            feature_entitled: bool,
            tenant: Tenant = Depends(get_current_tenant)
        ) -> Any:
            if feature_entitled:
                # Show advanced features
            else:
                # Show basic features
    """

    def decorator(func: Callable[P, Awaitable[R]]) -> Callable[P, Awaitable[R]]:
        @functools.wraps(func)
        async def wrapper(*args: P.args, **kwargs: P.kwargs) -> R:
            # Extract tenant from dependencies
            tenant = cast("Tenant | None", kwargs.get("tenant"))
            if not tenant:
                kwargs["feature_entitled"] = False
                return await func(*args, **kwargs)

            # Expect database session to be injected; downgrade gracefully if missing
            db = cast(AsyncSession | None, kwargs.get("db"))
            if db is None:
                kwargs["feature_entitled"] = False
                return await func(*args, **kwargs)

            # Check entitlement
            try:
                service = LicensingFrameworkService(db)
                entitled = await service.check_feature_entitlement(
                    tenant_id=tenant.id,
                    module_code=module_code,
                    capability_code=capability_code,
                )
                kwargs["feature_entitled"] = entitled
            except Exception:
                kwargs["feature_entitled"] = False

            return await func(*args, **kwargs)

        return wrapper

    return decorator


# ========================================================================
# QUOTA ENFORCEMENT DECORATORS
# ========================================================================


def enforce_quota(
    quota_code: str, quantity: int = 1, metadata_key: str | None = None
) -> Callable[[Callable[P, Awaitable[R]]], Callable[P, Awaitable[R]]]:
    """
    Decorator to enforce quota limits.

    Usage:
        @router.post("/users")
        @enforce_quota("staff_users", quantity=1)
        async def create_user(
            user_data: UserCreate,
            tenant: Tenant = Depends(get_current_tenant)
        ) -> Any:
            ...

    Args:
        quota_code: The quota to enforce (e.g., "staff_users")
        quantity: How many units to consume
        metadata_key: If provided, extract quantity from kwargs[metadata_key]
    """

    def decorator(func: Callable[P, Awaitable[R]]) -> Callable[P, Awaitable[R]]:
        @functools.wraps(func)
        async def wrapper(*args: P.args, **kwargs: P.kwargs) -> R:
            # Extract tenant from dependencies
            tenant = cast("Tenant | None", kwargs.get("tenant"))
            if not tenant:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Tenant context required",
                )

            # Expect database session to be injected by FastAPI dependency
            db = cast(AsyncSession | None, kwargs.get("db"))
            if db is None:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=(
                        "Database session not provided. "
                        "Ensure the endpoint declares `db: AsyncSession = Depends(get_async_session)`."
                    ),
                )

            # Determine quantity to consume
            qty = quantity
            if metadata_key and metadata_key in kwargs:
                qty_value = kwargs[metadata_key]
                if isinstance(qty_value, int):
                    qty = qty_value
                elif isinstance(qty_value, str):
                    qty = int(qty_value)
                elif isinstance(qty_value, float):
                    qty = int(qty_value)
                else:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Invalid quota quantity",
                    )

            # Check and consume quota
            service = LicensingFrameworkService(db)
            try:
                await service.consume_quota(
                    tenant_id=tenant.id,
                    quota_code=quota_code,
                    quantity=qty,
                    metadata={"endpoint": func.__name__},
                )
            except QuotaExceededError as e:
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=str(e),
                )
            except FeatureNotEntitledError as e:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=str(e),
                )

            return await func(*args, **kwargs)

        return wrapper

    return decorator


def check_quota(
    quota_code: str, quantity: int = 1
) -> Callable[[Callable[P, Awaitable[R]]], Callable[P, Awaitable[R]]]:
    """
    Non-blocking quota check decorator.

    Adds 'quota_available' boolean and 'quota_info' dict to kwargs.

    Usage:
        @router.post("/customers")
        @check_quota("active_subscribers", quantity=1)
        async def create_customer(
            quota_available: bool,
            quota_info: dict,
            customer_data: CustomerCreate,
            tenant: Tenant = Depends(get_current_tenant)
        ) -> Any:
            if not quota_available:
                if quota_info.get("overage_allowed"):
                    # Warn about overage charges
                    pass
                else:
                    # Reject creation
                    raise HTTPException(status_code=429, detail="Quota exceeded")
    """

    def decorator(func: Callable[P, Awaitable[R]]) -> Callable[P, Awaitable[R]]:
        @functools.wraps(func)
        async def wrapper(*args: P.args, **kwargs: P.kwargs) -> R:
            # Extract tenant from dependencies
            tenant = cast("Tenant | None", kwargs.get("tenant"))
            if not tenant:
                kwargs["quota_available"] = False
                kwargs["quota_info"] = {}
                return await func(*args, **kwargs)

            # Expect database session to be injected; fallback to False if missing
            db = cast(AsyncSession | None, kwargs.get("db"))
            if db is None:
                kwargs["quota_available"] = False
                kwargs["quota_info"] = {}
                return await func(*args, **kwargs)

            # Check quota
            try:
                service = LicensingFrameworkService(db)
                result = await service.check_quota(
                    tenant_id=tenant.id,
                    quota_code=quota_code,
                    requested_quantity=quantity,
                )
                kwargs["quota_available"] = result["allowed"]
                kwargs["quota_info"] = result
            except Exception:
                kwargs["quota_available"] = False
                kwargs["quota_info"] = {}

            return await func(*args, **kwargs)

        return wrapper

    return decorator


# ========================================================================
# MIDDLEWARE
# ========================================================================


class FeatureEntitlementMiddleware:
    """
    Middleware to automatically check feature entitlements based on route.

    Configure route -> module mapping in your application:

        ROUTE_MODULE_MAP = {
            "/api/v1/radius": ("radius_aaa", None),
            "/api/v1/wireless": ("wireless_management", None),
            "/api/v1/billing/analytics": ("analytics", "billing_reports"),
        }

        app.add_middleware(
            FeatureEntitlementMiddleware,
            route_module_map=ROUTE_MODULE_MAP
        )
    """

    def __init__(
        self,
        app: Any,
        route_module_map: dict[str, tuple[str, str | None]],
    ) -> None:
        """
        Initialize middleware.

        Args:
            app: FastAPI application
            route_module_map: Dict mapping route prefixes to (module_code, capability_code)
        """
        self.app = app
        self.route_module_map = route_module_map

    async def __call__(
        self, request: Request, call_next: Callable[[Request], Awaitable[Any]]
    ) -> Any:
        """Process request."""
        # Check if route requires entitlement
        path = request.url.path
        module_config = None

        # Find matching route (longest prefix match)
        for route_prefix, config in sorted(
            self.route_module_map.items(), key=lambda x: len(x[0]), reverse=True
        ):
            if path.startswith(route_prefix):
                module_config = config
                break

        if module_config:
            module_code, capability_code = module_config

            # Extract tenant from request state (set by auth middleware)
            tenant = cast("Tenant | None", getattr(request.state, "tenant", None))
            if tenant:
                # Get database session
                async for session in get_session():
                    db = cast(AsyncSession, session)
                    service = LicensingFrameworkService(db)
                    entitled = await service.check_feature_entitlement(
                        tenant_id=tenant.id,
                        module_code=module_code,
                        capability_code=capability_code,
                    )

                    if not entitled:
                        feature_name = (
                            f"{module_code}.{capability_code}" if capability_code else module_code
                        )
                        raise HTTPException(
                            status_code=status.HTTP_403_FORBIDDEN,
                            detail=f"Feature not entitled: {feature_name}. Please upgrade your plan.",
                        )
                    break

        # Continue processing
        response = await call_next(request)
        return response


# ========================================================================
# DEPENDENCY INJECTION HELPERS
# ========================================================================


async def require_module_dependency(
    module_code: str,
    capability_code: str | None = None,
    tenant: Tenant | None = None,
    db: AsyncSession | None = None,
) -> None:
    """
    Dependency injection helper for feature entitlement.

    Usage:
        from fastapi import Depends

        @router.get("/radius/auth")
        async def authenticate(
            _: None = Depends(
                lambda t=Depends(get_current_tenant), db=Depends(get_async_session) -> None:
                    require_module_dependency("radius_aaa", "radius_authentication", t, db)
            ),
            tenant: Tenant = Depends(get_current_tenant)
        ) -> Any:
            ...
    """
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Tenant context required",
        )

    if db is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=(
                "Database session not provided. "
                "Inject `AsyncSession = Depends(get_async_session)` in the dependency chain."
            ),
        )

    service = LicensingFrameworkService(db)
    entitled = await service.check_feature_entitlement(
        tenant_id=tenant.id,
        module_code=module_code,
        capability_code=capability_code,
    )

    if not entitled:
        feature_name = f"{module_code}.{capability_code}" if capability_code else module_code
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Feature not entitled: {feature_name}. Please upgrade your plan.",
        )


async def check_quota_dependency(
    quota_code: str,
    quantity: int = 1,
    tenant: Tenant | None = None,
    db: AsyncSession | None = None,
) -> dict[str, Any]:
    """
    Dependency injection helper for quota checking.

    Returns quota check result dict.

    Usage:
        @router.post("/users")
        async def create_user(
            quota_check: dict = Depends(
                lambda t=Depends(get_current_tenant), db=Depends(get_async_session) -> dict[str, Any]:
                    check_quota_dependency("staff_users", 1, t, db)
            ),
            tenant: Tenant = Depends(get_current_tenant)
        ) -> Any:
            if not quota_check["allowed"]:
                raise HTTPException(status_code=429, detail="Quota exceeded")
            ...
    """
    if not tenant:
        return {
            "allowed": False,
            "allocated": 0,
            "current": 0,
            "available": 0,
            "overage_allowed": False,
            "overage_rate": 0.0,
        }

    if db is None:
        return {
            "allowed": False,
            "allocated": 0,
            "current": 0,
            "available": 0,
            "overage_allowed": False,
            "overage_rate": 0.0,
        }

    service = LicensingFrameworkService(db)
    try:
        return await service.check_quota(
            tenant_id=tenant.id,
            quota_code=quota_code,
            requested_quantity=quantity,
        )
    except Exception:
        return {
            "allowed": False,
            "allocated": 0,
            "current": 0,
            "available": 0,
            "overage_allowed": False,
            "overage_rate": 0.0,
        }


# ========================================================================
# CONTEXT MANAGERS
# ========================================================================


class QuotaContext:
    """
    Context manager for quota enforcement.

    Usage:
        async with QuotaContext(tenant_id, "api_calls", db):
            # Make API call
            result = await external_api.call()
        # Quota automatically consumed if no exception
    """

    def __init__(
        self,
        tenant_id: UUID,
        quota_code: str,
        db: AsyncSession,
        quantity: int = 1,
        metadata: dict[str, Any] | None = None,
    ) -> None:
        self.tenant_id = tenant_id
        self.quota_code = quota_code
        self.db = db
        self.quantity = quantity
        self.metadata = metadata or {}
        self.service = LicensingFrameworkService(db)

    async def __aenter__(self) -> QuotaContext:
        """Check quota before entering context."""
        try:
            result = await self.service.check_quota(
                tenant_id=self.tenant_id,
                quota_code=self.quota_code,
                requested_quantity=self.quantity,
            )
            if not result["allowed"]:
                raise QuotaExceededError(
                    f"Quota {self.quota_code} exceeded. "
                    f"Allocated: {result['allocated']}, Current: {result['current']}"
                )
        except FeatureNotEntitledError as e:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=str(e),
            )
        return self

    async def __aexit__(self, exc_type: Any, exc_val: Any, exc_tb: Any) -> bool:
        """Consume quota on successful exit."""
        if exc_type is None:
            # No exception, consume quota
            try:
                await self.service.consume_quota(
                    tenant_id=self.tenant_id,
                    quota_code=self.quota_code,
                    quantity=self.quantity,
                    metadata=self.metadata,
                )
            except QuotaExceededError:
                # Should not happen since we checked in __aenter__
                pass
        # Don't suppress exceptions
        return False
