"""
API endpoints for RBAC management
"""

from datetime import datetime
from typing import TYPE_CHECKING, Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.auth.core import UserInfo, get_current_user
from dotmac.platform.auth.models import PermissionCategory
from dotmac.platform.auth.rbac_dependencies import require_admin, require_permission
from dotmac.platform.auth.rbac_service import RBACService, get_rbac_service
from dotmac.platform.db import get_async_session

if TYPE_CHECKING:
    from dotmac.platform.auth.models import Role

router = APIRouter(
    prefix="",
)


# ==================== Pydantic Models ====================


class PermissionResponse(BaseModel):
    """Permission response model"""

    model_config = ConfigDict()

    id: UUID
    name: str
    display_name: str
    description: str | None
    category: PermissionCategory
    is_active: bool
    is_system: bool


class RoleResponse(BaseModel):
    """Role response model"""

    model_config = ConfigDict()

    id: UUID
    name: str
    display_name: str
    description: str | None
    priority: int
    is_active: bool
    is_system: bool
    is_default: bool
    permissions: list[PermissionResponse] = []
    user_count: int | None = None


class RoleCreateRequest(BaseModel):
    """Request to create a role"""

    model_config = ConfigDict()

    name: str = Field(..., min_length=1, max_length=100)
    display_name: str = Field(..., min_length=1, max_length=200)
    description: str | None = None
    permissions: list[str] = Field(default_factory=lambda: [])
    parent_role: str | None = None
    is_default: bool = False


class RoleUpdateRequest(BaseModel):
    """Request to update a role"""

    model_config = ConfigDict()

    display_name: str | None = Field(None, min_length=1, max_length=200)
    description: str | None = None
    permissions: list[str] | None = None
    is_active: bool | None = None
    is_default: bool | None = None


class UserRoleAssignment(BaseModel):
    """User role assignment request"""

    model_config = ConfigDict()

    user_id: UUID
    role_name: str
    expires_at: datetime | None = None
    metadata: dict[str, Any] | None = None


class UserPermissionGrant(BaseModel):
    """Direct permission grant request"""

    model_config = ConfigDict()

    user_id: UUID
    permission_name: str
    granted: bool = True  # True to grant, False to revoke
    expires_at: datetime | None = None
    reason: str | None = None


class PermissionGrantRequest(BaseModel):
    """Request to grant permission to user"""

    model_config = ConfigDict()

    permission_name: str
    expires_at: datetime | None = None
    reason: str | None = None


class UserPermissionsResponse(BaseModel):
    """User permissions response"""

    model_config = ConfigDict()

    user_id: UUID
    permissions: list[str]
    denied_permissions: list[str] = []
    roles: list[RoleResponse]
    direct_grants: list[PermissionResponse]
    effective_permissions: list[str]  # All permissions after inheritance


# ==================== Permission Endpoints ====================


@router.get("/permissions", response_model=list[PermissionResponse])
async def list_permissions(
    category: PermissionCategory | None = None,
    active_only: bool = True,
    db: AsyncSession = Depends(get_async_session),
    current_user: UserInfo = Depends(require_permission("admin.role.manage")),
) -> list[PermissionResponse]:
    """List all available permissions"""
    from dotmac.platform.auth.models import Permission

    query = select(Permission)

    if category:
        query = query.where(Permission.category == category)

    if active_only:
        query = query.where(Permission.is_active)

    query = query.order_by(Permission.category, Permission.name)
    result = await db.execute(query)
    permissions = result.scalars().all()

    return [
        PermissionResponse(
            id=p.id,
            name=p.name,
            display_name=p.display_name,
            description=p.description,
            category=p.category,
            is_active=p.is_active,
            is_system=p.is_system,
        )
        for p in permissions
    ]


@router.get("/permissions/{permission_name}", response_model=PermissionResponse)
async def get_permission(
    permission_name: str,
    db: AsyncSession = Depends(get_async_session),
    current_user: UserInfo = Depends(require_permission("admin.role.manage")),
) -> PermissionResponse:
    """Get details of a specific permission"""
    from dotmac.platform.auth.models import Permission

    result = await db.execute(select(Permission).where(Permission.name == permission_name))
    permission = result.scalar_one_or_none()

    if not permission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Permission '{permission_name}' not found",
        )

    return PermissionResponse(
        id=permission.id,
        name=permission.name,
        display_name=permission.display_name,
        description=permission.description,
        category=permission.category,
        is_active=permission.is_active,
        is_system=permission.is_system,
    )


# ==================== Role Endpoints ====================


@router.get("/roles", response_model=list[RoleResponse])
async def list_roles(
    active_only: bool = True,
    include_permissions: bool = False,
    include_user_count: bool = False,
    db: AsyncSession = Depends(get_async_session),
    current_user: UserInfo = Depends(require_permission("admin.role.manage")),
) -> list[RoleResponse]:
    """List all available roles"""
    from sqlalchemy.orm import selectinload

    from dotmac.platform.auth.models import Role, user_roles

    query = select(Role)

    if active_only:
        query = query.where(Role.is_active)

    if include_permissions:
        query = query.options(selectinload(Role.permissions))

    query = query.order_by(Role.priority.desc(), Role.name)
    result = await db.execute(query)
    roles = result.scalars().all()

    response = []
    for role in roles:
        role_resp = RoleResponse(
            id=role.id,
            name=role.name,
            display_name=role.display_name,
            description=role.description,
            priority=role.priority,
            is_active=role.is_active,
            is_system=role.is_system,
            is_default=role.is_default,
        )

        if include_permissions:
            role_resp.permissions = [
                PermissionResponse(
                    id=p.id,
                    name=p.name,
                    display_name=p.display_name,
                    description=p.description,
                    category=p.category,
                    is_active=p.is_active,
                    is_system=p.is_system,
                )
                for p in role.permissions
            ]

        if include_user_count:
            count_result = await db.execute(
                select(func.count(user_roles.c.user_id)).where(user_roles.c.role_id == role.id)
            )
            count = count_result.scalar()
            role_resp.user_count = count

        response.append(role_resp)

    return response


@router.post("/roles", response_model=RoleResponse, status_code=status.HTTP_201_CREATED)
async def create_role(
    request: RoleCreateRequest,
    db: AsyncSession = Depends(get_async_session),
    rbac_service: RBACService = Depends(get_rbac_service),
    current_user: UserInfo = Depends(require_admin),
) -> RoleResponse:
    """Create a new role"""
    try:
        role = await rbac_service.create_role(
            name=request.name,
            display_name=request.display_name,
            description=request.description,
            permissions=request.permissions,
            parent_role=request.parent_role,
            is_default=request.is_default,
        )
        await db.commit()

        return RoleResponse(
            id=role.id,
            name=role.name,
            display_name=role.display_name,
            description=role.description,
            priority=role.priority,
            is_active=role.is_active,
            is_system=role.is_system,
            is_default=role.is_default,
        )
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


async def _update_role_basic_fields(role: "Role", request: RoleUpdateRequest) -> None:
    """Update basic role fields."""
    if request.display_name is not None:
        role.display_name = request.display_name
    if request.description is not None:
        role.description = request.description
    if request.is_active is not None:
        role.is_active = request.is_active


async def _update_role_default_status(
    role: "Role", request: RoleUpdateRequest, db: AsyncSession
) -> None:
    """Update role default status."""
    from dotmac.platform.auth.models import Role

    if request.is_default is not None:
        # Only one role can be default
        if request.is_default:
            await db.execute(update(Role).where(Role.id != role.id).values(is_default=False))
        role.is_default = request.is_default


async def _update_role_permissions(
    role: "Role", request: RoleUpdateRequest, db: AsyncSession
) -> None:
    """Update role permissions."""
    from dotmac.platform.auth.models import Permission

    if request.permissions is not None:
        # Update permissions - permissions relationship is already loaded
        role.permissions.clear()
        for perm_name in request.permissions:
            perm_result = await db.execute(select(Permission).where(Permission.name == perm_name))
            permission = perm_result.scalar_one_or_none()
            if permission:
                role.permissions.append(permission)


@router.put("/roles/{role_id}", response_model=RoleResponse)
async def update_role(
    role_id: UUID,
    request: RoleUpdateRequest,
    db: AsyncSession = Depends(get_async_session),
    current_user: UserInfo = Depends(require_admin),
) -> RoleResponse:
    """Update an existing role"""
    from sqlalchemy.orm import selectinload as sel

    from dotmac.platform.auth.models import Role

    # Load role with permissions relationship to avoid lazy loading
    result = await db.execute(select(Role).where(Role.id == role_id).options(sel(Role.permissions)))
    role = result.scalar_one_or_none()

    if not role:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Role not found")

    if role.is_system:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="System roles cannot be modified"
        )

    # Update using helper functions
    await _update_role_basic_fields(role, request)
    await _update_role_default_status(role, request, db)
    await _update_role_permissions(role, request, db)

    await db.commit()

    return RoleResponse(
        id=role.id,
        name=role.name,
        display_name=role.display_name,
        description=role.description,
        priority=role.priority,
        is_active=role.is_active,
        is_system=role.is_system,
        is_default=role.is_default,
    )


@router.delete("/roles/{role_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_role(
    role_id: UUID,
    db: AsyncSession = Depends(get_async_session),
    current_user: UserInfo = Depends(require_admin),
) -> None:
    """Delete a role"""
    from dotmac.platform.auth.models import Role

    result = await db.execute(select(Role).where(Role.id == role_id))
    role = result.scalar_one_or_none()

    if not role:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Role not found")

    if role.is_system:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="System roles cannot be deleted"
        )

    await db.delete(role)
    await db.commit()


# ==================== User Role Assignment ====================


@router.post("/users/{user_id}/roles/{role_id}", status_code=status.HTTP_204_NO_CONTENT)
async def assign_role_to_user(
    user_id: UUID,
    role_id: UUID,
    db: AsyncSession = Depends(get_async_session),
    rbac_service: RBACService = Depends(get_rbac_service),
    current_user: UserInfo = Depends(require_admin),
) -> None:
    """Assign a role to a user"""
    from dotmac.platform.auth.models import Role

    # Get role by ID
    result = await db.execute(select(Role).where(Role.id == role_id))
    role = result.scalar_one_or_none()

    if not role:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Role not found")

    await rbac_service.assign_role_to_user(
        user_id=user_id, role_name=role.name, granted_by=UUID(current_user.user_id)
    )
    await db.commit()


@router.delete("/users/{user_id}/roles/{role_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_role_from_user(
    user_id: UUID,
    role_id: UUID,
    db: AsyncSession = Depends(get_async_session),
    rbac_service: RBACService = Depends(get_rbac_service),
    current_user: UserInfo = Depends(require_admin),
) -> None:
    """Revoke a role from a user"""
    from dotmac.platform.auth.models import Role

    # Get role by ID
    result = await db.execute(select(Role).where(Role.id == role_id))
    role = result.scalar_one_or_none()

    if not role:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Role not found")

    await rbac_service.revoke_role_from_user(
        user_id=user_id, role_name=role.name, revoked_by=UUID(current_user.user_id)
    )
    await db.commit()


# ==================== User Permission Management ====================


@router.get("/users/{user_id}/permissions", response_model=UserPermissionsResponse)
async def get_user_permissions(
    user_id: UUID,
    db: AsyncSession = Depends(get_async_session),
    rbac_service: RBACService = Depends(get_rbac_service),
    current_user: UserInfo = Depends(require_permission("admin.user.read")),
) -> UserPermissionsResponse:
    """Get all permissions for a user"""
    # Get effective permissions
    permissions_snapshot = await rbac_service.get_user_permissions(user_id)

    # Get roles
    roles = await rbac_service.get_user_roles(user_id)

    # Get direct permission grants
    from dotmac.platform.auth.models import Permission, user_permissions

    result = await db.execute(
        select(Permission)
        .join(user_permissions)
        .where(user_permissions.c.user_id == user_id, user_permissions.c.granted)
    )
    direct_perms = result.scalars().all()

    return UserPermissionsResponse(
        user_id=user_id,
        permissions=list(permissions_snapshot),
        denied_permissions=list(permissions_snapshot.denies),
        roles=[
            RoleResponse(
                id=r.id,
                name=r.name,
                display_name=r.display_name,
                description=r.description,
                priority=r.priority,
                is_active=r.is_active,
                is_system=r.is_system,
                is_default=r.is_default,
            )
            for r in roles
        ],
        direct_grants=[
            PermissionResponse(
                id=p.id,
                name=p.name,
                display_name=p.display_name,
                description=p.description,
                category=p.category,
                is_active=p.is_active,
                is_system=p.is_system,
            )
            for p in direct_perms
        ],
        effective_permissions=list(permissions_snapshot),
    )


@router.post("/users/assign-role", status_code=status.HTTP_204_NO_CONTENT)
async def assign_role_to_user_legacy(
    request: UserRoleAssignment,
    db: AsyncSession = Depends(get_async_session),
    rbac_service: RBACService = Depends(get_rbac_service),
    current_user: UserInfo = Depends(require_admin),
) -> None:
    """Assign a role to a user (legacy endpoint)"""
    await rbac_service.assign_role_to_user(
        user_id=request.user_id,
        role_name=request.role_name,
        granted_by=UUID(current_user.user_id),
        expires_at=request.expires_at,
        metadata=request.metadata,
    )


@router.post("/users/revoke-role", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_role_from_user_legacy(
    request: UserRoleAssignment,
    db: AsyncSession = Depends(get_async_session),
    rbac_service: RBACService = Depends(get_rbac_service),
    current_user: UserInfo = Depends(require_admin),
) -> None:
    """Revoke a role from a user (legacy endpoint)"""
    await rbac_service.revoke_role_from_user(
        user_id=request.user_id,
        role_name=request.role_name,
        revoked_by=UUID(current_user.user_id),
        reason=request.metadata.get("reason") if request.metadata else None,
    )


@router.post("/users/{user_id}/permissions", status_code=status.HTTP_204_NO_CONTENT)
async def grant_permission_to_user(
    user_id: UUID,
    request: PermissionGrantRequest,
    db: AsyncSession = Depends(get_async_session),
    rbac_service: RBACService = Depends(get_rbac_service),
    current_user: UserInfo = Depends(require_admin),
) -> None:
    """Grant a permission directly to a user"""
    await rbac_service.grant_permission_to_user(
        user_id=user_id,
        permission_name=request.permission_name,
        granted_by=UUID(current_user.user_id),
        expires_at=request.expires_at,
        reason=request.reason,
    )
    await db.commit()


@router.delete(
    "/users/{user_id}/permissions/{permission_name}", status_code=status.HTTP_204_NO_CONTENT
)
async def revoke_permission_from_user(
    user_id: UUID,
    permission_name: str,
    db: AsyncSession = Depends(get_async_session),
    rbac_service: RBACService = Depends(get_rbac_service),
    current_user: UserInfo = Depends(require_admin),
) -> None:
    """Revoke a permission from a user"""
    await rbac_service.revoke_permission_from_user(
        user_id=user_id, permission_name=permission_name, revoked_by=UUID(current_user.user_id)
    )
    await db.commit()


@router.post("/users/grant-permission", status_code=status.HTTP_204_NO_CONTENT)
async def grant_permission_to_user_legacy(
    request: UserPermissionGrant,
    db: AsyncSession = Depends(get_async_session),
    rbac_service: RBACService = Depends(get_rbac_service),
    current_user: UserInfo = Depends(require_admin),
) -> None:
    """Grant or revoke a specific permission directly to/from a user (legacy endpoint)"""
    if request.granted:
        await rbac_service.grant_permission_to_user(
            user_id=request.user_id,
            permission_name=request.permission_name,
            granted_by=UUID(current_user.user_id),
            expires_at=request.expires_at,
            reason=request.reason,
        )
    else:
        # Revoke by setting granted=False in user_permissions
        from dotmac.platform.auth.models import Permission, user_permissions

        result = await db.execute(
            select(Permission).where(Permission.name == request.permission_name)
        )
        permission = result.scalar_one_or_none()
        if permission:
            await db.execute(
                update(user_permissions)
                .where(
                    user_permissions.c.user_id == request.user_id,
                    user_permissions.c.permission_id == permission.id,
                )
                .values(granted=False, reason=request.reason)
            )
            await db.commit()


@router.get("/my-permissions", response_model=UserPermissionsResponse)
async def get_my_permissions(
    db: AsyncSession = Depends(get_async_session),
    rbac_service: RBACService = Depends(get_rbac_service),
    current_user: UserInfo = Depends(get_current_user),
) -> UserPermissionsResponse:
    """Get current user's permissions"""
    return await get_user_permissions(UUID(current_user.user_id), db, rbac_service, current_user)
