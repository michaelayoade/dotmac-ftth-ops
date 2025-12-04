"""
User management API router.

Provides REST endpoints for user management operations.
"""

from datetime import datetime
from typing import Annotated, Any

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, ConfigDict, EmailStr, Field
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.auth.core import UserInfo
from dotmac.platform.auth.dependencies import get_current_user
from dotmac.platform.auth.platform_admin import is_platform_admin
from dotmac.platform.auth.rbac_dependencies import require_permission
from dotmac.platform.db import get_session_dependency
from dotmac.platform.tenant import get_current_tenant_id
from dotmac.platform.user_management.service import UserService

logger = structlog.get_logger(__name__)

# Create router
user_router = APIRouter(
    prefix="/users",
)

TARGET_TENANT_HEADER = "X-Target-Tenant-ID"
TARGET_TENANT_QUERY_PARAMS = ("tenant_id", "target_tenant_id")


def _tenant_scope_from_user(user: UserInfo | None) -> str | None:
    """Return tenant scope for the given user."""
    if user is None:
        return None
    if user.is_platform_admin:
        return None
    return user.tenant_id


def _resolve_target_tenant(
    actor: UserInfo,
    request: Request | None = None,
    override_tenant: str | None = None,
    *,
    require_tenant: bool = True,
) -> str | None:
    """
    Resolve tenant for administrative operations.

    Order of precedence:
        1. Explicit override (internal callers)
        2. Tenant context set by middleware
        3. Actor's assigned tenant
        4. Platform admin header/query overrides
        5. Platform admin fallback (cross-tenant) when allowed
    """
    if override_tenant:
        return override_tenant

    actor_tenant = getattr(actor, "tenant_id", None)
    if isinstance(actor_tenant, str) and actor_tenant.strip():
        return actor_tenant

    context_tenant = get_current_tenant_id()
    if isinstance(context_tenant, str) and context_tenant.strip():
        return context_tenant

    if request is not None and is_platform_admin(actor):
        header_candidate = request.headers.get(TARGET_TENANT_HEADER)
        if header_candidate:
            return header_candidate
        for query_key in TARGET_TENANT_QUERY_PARAMS:
            query_candidate = request.query_params.get(query_key)
            if query_candidate:
                return query_candidate

    if require_tenant:
        if is_platform_admin(actor):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "Specify tenant via X-Target-Tenant-ID header or tenant_id "
                    "query parameter for this operation."
                ),
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tenant context not found for user management operation.",
        )

    if is_platform_admin(actor):
        return None

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Tenant context not found for user management operation.",
    )


# ========================================
# Request/Response Models
# ========================================


class UserCreateRequest(BaseModel):  # BaseModel resolves to Any in isolation
    """User creation request model."""

    model_config = ConfigDict()

    username: str = Field(..., min_length=3, max_length=50, description="Username")
    email: EmailStr = Field(..., description="Email address")
    password: str = Field(..., min_length=8, description="Password")
    full_name: str | None = Field(None, description="Full name")
    roles: list[str] = Field(default_factory=list, description="User roles")
    is_active: bool = Field(True, description="Is user active")


class UserUpdateRequest(BaseModel):  # BaseModel resolves to Any in isolation
    """User update request model."""

    model_config = ConfigDict()

    email: EmailStr | None = Field(None, description="Email address")
    full_name: str | None = Field(None, description="Full name")
    roles: list[str] | None = Field(None, description="User roles")
    is_active: bool | None = Field(None, description="Is user active")


class UserResponse(BaseModel):  # BaseModel resolves to Any in isolation
    """User response model."""

    model_config = ConfigDict()

    user_id: str = Field(..., description="User ID")
    username: str = Field(..., description="Username")
    email: str = Field(..., description="Email address")
    full_name: str | None = Field(None, description="Full name")
    roles: list[str] = Field(default_factory=list, description="User roles")
    is_active: bool = Field(..., description="Is user active")
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: datetime = Field(..., description="Last update timestamp")
    last_login: datetime | None = Field(None, description="Last login timestamp")


class PasswordChangeRequest(BaseModel):  # BaseModel resolves to Any in isolation
    """Password change request model."""

    model_config = ConfigDict()

    current_password: str = Field(..., description="Current password")
    new_password: str = Field(..., min_length=8, description="New password")
    confirm_password: str = Field(..., description="Confirm new password")


class UserListResponse(BaseModel):  # BaseModel resolves to Any in isolation
    """User list response model."""

    model_config = ConfigDict()

    users: list[UserResponse] = Field(..., description="List of users")
    total: int = Field(..., description="Total number of users")
    page: int = Field(..., description="Current page")
    per_page: int = Field(..., description="Items per page")


# ========================================
# Dependency Injection
# ========================================


async def get_user_service(
    session: Annotated[AsyncSession, Depends(get_session_dependency)],
) -> UserService:
    """Get user service with database session."""
    return UserService(session)


# ========================================
# Endpoints
# ========================================


@user_router.get("/me", response_model=UserResponse)
async def get_current_user_profile(
    current_user: UserInfo = Depends(get_current_user),
    user_service: UserService = Depends(get_user_service),
) -> UserResponse:
    """
    Get current user's profile.

    Requires authentication.
    """
    tenant_scope = _tenant_scope_from_user(current_user)
    user = await user_service.get_user_by_id(current_user.user_id, tenant_id=tenant_scope)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User profile not found")

    return UserResponse(**user.to_dict())


@user_router.put("/me", response_model=UserResponse)
async def update_current_user_profile(
    updates: UserUpdateRequest,
    current_user: UserInfo = Depends(get_current_user),
    user_service: UserService = Depends(get_user_service),
) -> UserResponse:
    """
    Update current user's profile.

    Requires authentication.
    """
    # Users can't change their own roles
    update_data = updates.model_dump(exclude_unset=True, exclude={"roles"})

    tenant_scope = _tenant_scope_from_user(current_user)
    updated_user = await user_service.update_user(
        user_id=current_user.user_id,
        tenant_id=tenant_scope,
        **update_data,
    )
    if not updated_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    return UserResponse(**updated_user.to_dict())


@user_router.post("/me/change-password")
async def change_password(
    request: PasswordChangeRequest,
    current_user: UserInfo = Depends(get_current_user),
    user_service: UserService = Depends(get_user_service),
) -> dict[str, Any]:
    """
    Change current user's password.

    Requires authentication.
    """
    if request.new_password != request.confirm_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Passwords do not match"
        )

    tenant_scope = _tenant_scope_from_user(current_user)
    success = await user_service.change_password(
        user_id=current_user.user_id,
        current_password=request.current_password,
        new_password=request.new_password,
        tenant_id=tenant_scope,
    )

    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to change password - current password may be incorrect",
        )

    return {"message": "Password changed successfully"}


@user_router.get("", response_model=UserListResponse)
async def list_users(
    request: Request,
    skip: int = Query(0, ge=0, description="Skip records"),
    limit: int = Query(100, ge=1, le=1000, description="Limit records"),
    is_active: bool | None = Query(None, description="Filter by active status"),
    role: str | None = Query(None, description="Filter by role"),
    search: str | None = Query(None, description="Search term"),
    admin_user: UserInfo = Depends(require_permission("users.read")),
    user_service: UserService = Depends(get_user_service),
) -> UserListResponse:
    """
    List all users.

    Requires admin role.
    """
    tenant_id = _resolve_target_tenant(admin_user, request, require_tenant=False)
    require_tenant_flag = tenant_id is not None

    users, total = await user_service.list_users(
        skip=skip,
        limit=limit,
        is_active=is_active,
        role=role,
        search=search,
        tenant_id=tenant_id,
        require_tenant=require_tenant_flag,
    )

    return UserListResponse(
        users=[UserResponse(**u.to_dict()) for u in users],
        total=total,
        page=skip // limit + 1,
        per_page=limit,
    )


@user_router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    user_data: UserCreateRequest,
    request: Request,
    admin_user: UserInfo = Depends(require_permission("users.create")),
    user_service: UserService = Depends(get_user_service),
) -> UserResponse:
    """
    Create a new user.

    Requires admin role.
    """
    target_tenant = _resolve_target_tenant(admin_user, request, require_tenant=True)

    try:
        new_user = await user_service.create_user(
            username=user_data.username,
            email=user_data.email,
            password=user_data.password,
            full_name=user_data.full_name,
            roles=user_data.roles,
            is_active=user_data.is_active,
            tenant_id=target_tenant,
        )
        return UserResponse(**new_user.to_dict())
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@user_router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: str,
    request: Request,
    admin_user: UserInfo = Depends(require_permission("users.read")),
    user_service: UserService = Depends(get_user_service),
) -> UserResponse:
    """
    Get a specific user by ID.

    Requires admin role.
    """
    target_tenant = _resolve_target_tenant(admin_user, request, require_tenant=False)
    user = await user_service.get_user_by_id(user_id, tenant_id=target_tenant)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=f"User {user_id} not found"
        )

    return UserResponse(**user.to_dict())


@user_router.put("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: str,
    updates: UserUpdateRequest,
    request: Request,
    admin_user: UserInfo = Depends(require_permission("users.update")),
    user_service: UserService = Depends(get_user_service),
) -> UserResponse:
    """
    Update a user.

    Requires admin role.
    """
    update_data = updates.model_dump(exclude_unset=True)
    target_tenant = _resolve_target_tenant(admin_user, request, require_tenant=True)

    try:
        updated_user = await user_service.update_user(
            user_id=user_id,
            tenant_id=target_tenant,
            **update_data,
        )
        if not updated_user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail=f"User {user_id} not found"
            )

        return UserResponse(**updated_user.to_dict())
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@user_router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: str,
    request: Request,
    admin_user: UserInfo = Depends(require_permission("users.delete")),
    user_service: UserService = Depends(get_user_service),
) -> None:
    """
    Delete a user.

    Requires admin role.
    """
    target_tenant = _resolve_target_tenant(admin_user, request, require_tenant=True)

    success = await user_service.delete_user(user_id, tenant_id=target_tenant)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=f"User {user_id} not found"
        )


@user_router.post("/{user_id}/disable")
async def disable_user(
    user_id: str,
    request: Request,
    admin_user: UserInfo = Depends(require_permission("users.update")),
    user_service: UserService = Depends(get_user_service),
) -> dict[str, Any]:
    """
    Disable a user account.

    Requires admin role.
    """
    target_tenant = _resolve_target_tenant(admin_user, request, require_tenant=True)
    updated_user = await user_service.update_user(
        user_id=user_id,
        tenant_id=target_tenant,
        is_active=False,
    )
    if not updated_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=f"User {user_id} not found"
        )

    return {"message": f"User {user_id} disabled successfully"}


@user_router.post("/{user_id}/enable")
async def enable_user(
    user_id: str,
    request: Request,
    admin_user: UserInfo = Depends(require_permission("users.update")),
    user_service: UserService = Depends(get_user_service),
) -> dict[str, Any]:
    """
    Enable a user account.

    Requires admin role.
    """
    target_tenant = _resolve_target_tenant(admin_user, request, require_tenant=True)
    updated_user = await user_service.update_user(
        user_id=user_id,
        tenant_id=target_tenant,
        is_active=True,
    )
    if not updated_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=f"User {user_id} not found"
        )

    return {"message": f"User {user_id} enabled successfully"}


# Export router
__all__ = ["user_router"]
