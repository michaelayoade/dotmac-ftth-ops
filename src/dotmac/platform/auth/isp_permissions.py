"""Bootstrap ISP-specific RBAC permissions and roles."""

from __future__ import annotations

from collections.abc import Iterable

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.auth.models import Permission, PermissionCategory, Role

ISP_PERMISSIONS: tuple[tuple[str, str, PermissionCategory], ...] = (
    ("isp.radius.read", "View RADIUS subscribers and sessions", PermissionCategory.SECURITY),
    ("isp.radius.write", "Manage RADIUS subscribers and NAS devices", PermissionCategory.SECURITY),
    (
        "isp.radius.sessions.manage",
        "Force disconnect active RADIUS sessions",
        PermissionCategory.SECURITY,
    ),
    ("isp.ipam.read", "View IPAM data in NetBox", PermissionCategory.IPAM),
    ("isp.ipam.write", "Manage IPAM data in NetBox", PermissionCategory.IPAM),
    ("isp.network.pon.read", "View PON network devices in VOLTHA", PermissionCategory.NETWORK),
    ("isp.network.pon.write", "Manage PON network devices in VOLTHA", PermissionCategory.NETWORK),
    ("isp.cpe.read", "View CPE devices in GenieACS", PermissionCategory.CPE),
    ("isp.cpe.write", "Manage CPE devices in GenieACS", PermissionCategory.CPE),
    ("isp.automation.read", "View automation runs in AWX", PermissionCategory.AUTOMATION),
    ("isp.automation.execute", "Execute automation jobs in AWX", PermissionCategory.AUTOMATION),
    ("isp.oss.read", "View tenant OSS integration configuration", PermissionCategory.ADMIN),
    ("isp.oss.configure", "Manage tenant OSS integration configuration", PermissionCategory.ADMIN),
)


ROLE_PERMISSION_MAP: dict[str, Iterable[str]] = {
    "tenant_admin": [perm[0] for perm in ISP_PERMISSIONS],
    "admin": [perm[0] for perm in ISP_PERMISSIONS],
}


async def _get_permission(session: AsyncSession, name: str) -> Permission | None:
    result = await session.execute(select(Permission).where(Permission.name == name))
    return result.scalars().first()


async def _get_role(session: AsyncSession, name: str) -> Role | None:
    result = await session.execute(select(Role).where(Role.name == name))
    return result.scalars().first()


async def ensure_isp_rbac(session: AsyncSession) -> None:
    """Ensure ISP-specific permissions and role assignments exist."""

    created_permissions = []

    for name, description, category in ISP_PERMISSIONS:
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
                description=f"Default role for {role_name}",
                is_system=True,
                is_active=True,
            )
            session.add(role)
            await session.flush()
        role_cache[role_name] = role

    # Map permissions to roles
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
