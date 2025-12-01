"""
Read-only RBAC endpoints for frontend integration.

Provides simple endpoints that the React RBAC context expects.
"""

from uuid import UUID

from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.auth.core import UserInfo, get_current_user
from dotmac.platform.auth.models import Role
from dotmac.platform.auth.rbac_service import RBACService
from dotmac.platform.db import get_session_dependency

router = APIRouter(prefix="", tags=["RBAC"])


class PermissionInfo(BaseModel):
    """Simple permission info for frontend"""

    model_config = ConfigDict()

    name: str
    display_name: str = ""
    description: str = ""
    category: str = ""
    resource: str = ""
    action: str = ""
    is_system: bool = False


class RoleInfo(BaseModel):
    """Simple role info for frontend"""

    model_config = ConfigDict()

    name: str
    display_name: str
    description: str = ""
    parent_role: str = ""
    is_system: bool = False
    is_active: bool = True


class UserPermissionsResponse(BaseModel):
    """User permissions response matching frontend expectations"""

    model_config = ConfigDict()

    user_id: str
    roles: list[RoleInfo]
    direct_permissions: list[PermissionInfo]
    effective_permissions: list[PermissionInfo]
    is_superuser: bool = False


class PermissionCheckRequest(BaseModel):
    """Permission check request body."""

    model_config = ConfigDict()

    permissions: list[str]


class PermissionCheckResponse(BaseModel):
    """Permission check response body."""

    model_config = ConfigDict()

    results: dict[str, bool]


@router.get("/my-permissions")
async def get_my_permissions(
    current_user: UserInfo = Depends(get_current_user),
    db: AsyncSession = Depends(get_session_dependency),
) -> UserPermissionsResponse:
    """Get current user's permissions.

    Returns a UserPermissions object that the frontend RBACContext expects.
    """
    from sqlalchemy import select

    from dotmac.platform.user_management.models import User

    # Get the full user object to check is_superuser
    # Convert string user_id to UUID for database lookup
    user = await db.get(User, UUID(current_user.user_id))

    # Convert role names to RoleInfo objects
    roles = []
    for role_name in current_user.roles or []:
        # Try to get the role from the database
        role = await db.execute(select(Role).where(Role.name == role_name))
        role_obj = role.scalar_one_or_none()
        if role_obj:
            roles.append(
                RoleInfo(
                    name=role_obj.name,
                    display_name=role_obj.display_name,
                    description=role_obj.description or "",
                    parent_role="",
                    is_system=role_obj.is_system,
                    is_active=role_obj.is_active,
                )
            )
        else:
            # Fallback if role not found
            roles.append(
                RoleInfo(
                    name=role_name,
                    display_name=role_name.replace("_", " ").title(),
                    description="",
                    parent_role="",
                    is_system=False,
                    is_active=True,
                )
            )

    # Convert permission names to PermissionInfo objects.
    # Support multiple formats: "category.resource.action", "category.action", and "category:action"
    # so the frontend always receives consistent category/action.
    permissions = []
    for perm_name in current_user.permissions or []:
        category = ""
        resource = ""
        action = ""

        if "." in perm_name:
            parts = perm_name.split(".")
            # "a.b.c" -> category=a, resource=b, action=c
            # "a.b"   -> category=a, resource=b, action=""
            # "a"     -> category=a, resource="", action=""
            category = parts[0] if len(parts) > 0 else ""
            if len(parts) >= 3:
                resource = parts[1]
                action = parts[2]
            elif len(parts) == 2:
                resource = parts[1]
                action = ""
        elif ":" in perm_name:
            # Support older "category:action" style
            parts = perm_name.split(":")
            category = parts[0] if len(parts) > 0 else ""
            action = parts[1] if len(parts) > 1 else ""
        else:
            # Single word permission - treat as category
            category = perm_name

        permissions.append(
            PermissionInfo(
                name=perm_name,
                display_name=perm_name.replace(".", " ").replace(":", " ").title(),
                description="",
                category=category,
                resource=resource,
                action=action,
                is_system=True,
            )
        )

    return UserPermissionsResponse(
        user_id=current_user.user_id,
        roles=roles,
        direct_permissions=permissions,  # All permissions are direct for now
        effective_permissions=permissions,  # Same as direct
        is_superuser=user.is_superuser if user else False,
    )


@router.get("/roles")
async def get_roles(
    active_only: bool = True,
    db: AsyncSession = Depends(get_session_dependency),
    current_user: UserInfo = Depends(get_current_user),  # Just require authentication
) -> list[RoleInfo]:
    """Get available roles.

    Returns basic role information for admin interfaces.
    """
    from sqlalchemy import select

    # Query the database for roles
    query = select(Role)
    if active_only:
        query = query.where(Role.is_active)

    result = await db.execute(query)
    roles = result.scalars().all()

    return [
        RoleInfo(
            name=role.name,
            display_name=role.display_name,
            description=role.description or "",
            is_active=role.is_active,
        )
        for role in roles
    ]


@router.get("/my-roles")
async def get_my_roles(current_user: UserInfo = Depends(get_current_user)) -> list[str]:
    """Get current user's roles."""
    return current_user.roles or []


@router.post("/check", response_model=PermissionCheckResponse)
async def check_permissions(
    request: PermissionCheckRequest,
    current_user: UserInfo = Depends(get_current_user),
    db: AsyncSession = Depends(get_session_dependency),
) -> PermissionCheckResponse:
    """Check a list of permissions for the current user."""
    rbac_service = RBACService(db)
    tenant_scope = getattr(current_user, "effective_tenant_id", None) or current_user.tenant_id

    results: dict[str, bool] = {}
    for perm in request.permissions:
        results[perm] = await rbac_service.user_has_permission(
            current_user.user_id,
            perm,
            is_platform_admin=current_user.is_platform_admin,
            tenant_id=tenant_scope,
        )

    return PermissionCheckResponse(results=results)
