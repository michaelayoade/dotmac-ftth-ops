"""Bootstrap tenant billing RBAC permissions and roles."""

from __future__ import annotations

from collections.abc import Iterable

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.auth.models import Permission, PermissionCategory, Role

# Tenant billing permissions
BILLING_PERMISSIONS: tuple[tuple[str, str, PermissionCategory], ...] = (
    # Subscription management
    ("billing.subscription.view", "View subscription details", PermissionCategory.BILLING),
    (
        "billing.subscription.manage",
        "Upgrade/downgrade subscription plans",
        PermissionCategory.BILLING,
    ),
    (
        "billing.subscription.cancel",
        "Cancel subscription",
        PermissionCategory.BILLING,
    ),
    # Add-on management
    ("billing.addons.view", "View available add-ons", PermissionCategory.BILLING),
    ("billing.addons.purchase", "Purchase and manage add-ons", PermissionCategory.BILLING),
    # Payment methods
    ("billing.payment_methods.view", "View saved payment methods", PermissionCategory.BILLING),
    (
        "billing.payment_methods.manage",
        "Add/remove payment methods",
        PermissionCategory.BILLING,
    ),
    # Invoices and payments
    ("billing.invoices.view", "View invoices and payment history", PermissionCategory.BILLING),
    ("billing.invoices.download", "Download invoices and receipts", PermissionCategory.BILLING),
    # Usage monitoring
    ("billing.usage.view", "View usage metrics and balance", PermissionCategory.BILLING),
)


ROLE_PERMISSION_MAP: dict[str, Iterable[str]] = {
    # Tenant admins get all billing permissions
    "tenant_admin": [perm[0] for perm in BILLING_PERMISSIONS],
    # Platform admins get all permissions
    "admin": [perm[0] for perm in BILLING_PERMISSIONS],
    # Tenant billing managers get subset (no cancellation)
    "tenant_billing_manager": [
        "billing.subscription.view",
        "billing.subscription.manage",
        "billing.addons.view",
        "billing.addons.purchase",
        "billing.payment_methods.view",
        "billing.payment_methods.manage",
        "billing.invoices.view",
        "billing.invoices.download",
        "billing.usage.view",
    ],
    # Regular tenant users can only view
    "tenant_user": [
        "billing.subscription.view",
        "billing.addons.view",
        "billing.invoices.view",
        "billing.usage.view",
    ],
}


async def _get_permission(session: AsyncSession, name: str) -> Permission | None:
    result = await session.execute(select(Permission).where(Permission.name == name))
    return result.scalars().first()


async def _get_role(session: AsyncSession, name: str) -> Role | None:
    result = await session.execute(select(Role).where(Role.name == name))
    return result.scalars().first()


async def ensure_billing_rbac(session: AsyncSession) -> None:
    """Ensure tenant billing permissions and role assignments exist."""

    created_permissions = []

    # Create permissions
    for name, description, category in BILLING_PERMISSIONS:
        permission = await _get_permission(session, name)
        if not permission:
            permission = Permission(
                name=name,
                display_name=name.replace(".", " ").replace("_", " ").title(),
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

    # Create or get roles
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
