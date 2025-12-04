"""Bootstrap Field Service & Project Management RBAC permissions."""

from __future__ import annotations

from collections.abc import Iterable

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.auth.models import Permission, PermissionCategory, Role

FIELD_SERVICE_PERMISSIONS: tuple[tuple[str, str, PermissionCategory], ...] = (
    # Project lifecycle
    ("field_service.project.read", "View field-service projects", PermissionCategory.FIELD_SERVICE),
    (
        "field_service.project.manage",
        "Create or update field-service projects",
        PermissionCategory.FIELD_SERVICE,
    ),
    # Task execution
    ("field_service.task.read", "View field-service tasks", PermissionCategory.FIELD_SERVICE),
    (
        "field_service.task.manage",
        "Create or update field-service tasks",
        PermissionCategory.FIELD_SERVICE,
    ),
    # Crew/dispatch teams
    ("field_service.team.read", "View field-service teams", PermissionCategory.FIELD_SERVICE),
    (
        "field_service.team.manage",
        "Create or update field-service teams",
        PermissionCategory.FIELD_SERVICE,
    ),
    # Technician roster & status
    (
        "field_service.technician.read",
        "View technicians and status",
        PermissionCategory.FIELD_SERVICE,
    ),
    (
        "field_service.technician.manage",
        "Update technician profile or status",
        PermissionCategory.FIELD_SERVICE,
    ),
    (
        "field_service.technician.location.update",
        "Report technician GPS/location updates",
        PermissionCategory.FIELD_SERVICE,
    ),
    # Geofence & proximity analytics
    (
        "field_service.geofence.read",
        "View geofence insights and nearby jobs",
        PermissionCategory.FIELD_SERVICE,
    ),
    # Time tracking
    (
        "field_service.time_entry.read",
        "View technician time entries",
        PermissionCategory.FIELD_SERVICE,
    ),
    (
        "field_service.time_entry.manage",
        "Clock in/out or modify time entries",
        PermissionCategory.FIELD_SERVICE,
    ),
    # Shared resources (equipment/vehicles)
    (
        "field_service.resource.read",
        "View shared resource inventory",
        PermissionCategory.FIELD_SERVICE,
    ),
    (
        "field_service.resource.manage",
        "Assign or update shared resources",
        PermissionCategory.FIELD_SERVICE,
    ),
)


ROLE_PERMISSION_MAP: dict[str, Iterable[str]] = {
    # Existing high-privilege roles get full coverage
    "tenant_admin": [perm[0] for perm in FIELD_SERVICE_PERMISSIONS],
    "admin": [perm[0] for perm in FIELD_SERVICE_PERMISSIONS],
    # Purpose-built roles for dispatchers & technicians
    "field_service_dispatcher": [
        "field_service.project.read",
        "field_service.project.manage",
        "field_service.task.read",
        "field_service.task.manage",
        "field_service.team.read",
        "field_service.team.manage",
        "field_service.technician.read",
        "field_service.technician.manage",
        "field_service.geofence.read",
        "field_service.time_entry.read",
        "field_service.time_entry.manage",
        "field_service.resource.read",
        "field_service.resource.manage",
    ],
    "field_service_technician": [
        "field_service.technician.read",
        "field_service.technician.location.update",
        "field_service.geofence.read",
        "field_service.task.read",
        "field_service.time_entry.read",
        "field_service.time_entry.manage",
        "field_service.resource.read",
    ],
}


async def _get_permission(session: AsyncSession, name: str) -> Permission | None:
    result = await session.execute(select(Permission).where(Permission.name == name))
    return result.scalars().first()


async def _get_role(session: AsyncSession, name: str) -> Role | None:
    result = await session.execute(select(Role).where(Role.name == name))
    return result.scalars().first()


async def ensure_field_service_rbac(session: AsyncSession) -> None:
    """Ensure field-service permissions and helper roles exist."""

    created_permissions = []

    for name, description, category in FIELD_SERVICE_PERMISSIONS:
        permission = await _get_permission(session, name)
        if not permission:
            permission = Permission(
                name=name,
                display_name=name.replace(".", " ").title(),
                description=description,
                category=category,
                is_active=True,
                is_system=True,
            )
            session.add(permission)
            created_permissions.append(name)

    if created_permissions:
        await session.flush()

    role_cache: dict[str, Role] = {}

    for role_name, _permissions in ROLE_PERMISSION_MAP.items():
        role = await _get_role(session, role_name)
        if not role:
            role = Role(
                name=role_name,
                display_name=role_name.replace("_", " ").title(),
                description=f"Field service role: {role_name}",
                is_system=True,
                is_active=True,
            )
            session.add(role)
            await session.flush()
        role_cache[role_name] = role

    for role_name, permissions in ROLE_PERMISSION_MAP.items():
        role = role_cache[role_name]
        await session.refresh(role, ["permissions"])
        existing = {perm.name for perm in role.permissions}
        to_add = []
        for perm_name in permissions:
            if perm_name in existing:
                continue
            permission = await _get_permission(session, perm_name)
            if permission:
                to_add.append(permission)
        if to_add:
            role.permissions.extend(to_add)
            await session.flush()

    await session.commit()


__all__ = ["ensure_field_service_rbac", "FIELD_SERVICE_PERMISSIONS"]
