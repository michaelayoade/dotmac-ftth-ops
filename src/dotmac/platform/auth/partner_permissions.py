"""Bootstrap partner multi-account management RBAC permissions and roles."""

from __future__ import annotations

from collections.abc import Iterable

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.auth.models import Permission, PermissionCategory, Role

# Partner multi-account management permissions
PARTNER_PERMISSIONS: tuple[tuple[str, str, PermissionCategory], ...] = (
    # Tenant management - accessing managed tenant accounts
    ("partner.tenants.list", "List managed tenant accounts", PermissionCategory.PARTNER),
    (
        "partner.tenants.switch_context",
        "Switch context to managed tenant",
        PermissionCategory.PARTNER,
    ),
    # Billing operations - consolidated billing across tenants
    (
        "partner.billing.read",
        "View billing data for managed tenants",
        PermissionCategory.PARTNER,
    ),
    (
        "partner.billing.summary.read",
        "View consolidated billing summary",
        PermissionCategory.PARTNER,
    ),
    (
        "partner.billing.invoices.read",
        "View invoices for managed tenants",
        PermissionCategory.PARTNER,
    ),
    (
        "partner.billing.invoices.export",
        "Export invoices for managed tenants",
        PermissionCategory.PARTNER,
    ),
    # Support operations - multi-tenant ticket management
    (
        "partner.support.tickets.list",
        "List tickets across managed tenants",
        PermissionCategory.PARTNER,
    ),
    (
        "partner.support.tickets.read",
        "View ticket details for managed tenants",
        PermissionCategory.PARTNER,
    ),
    (
        "partner.support.tickets.create",
        "Create tickets on behalf of managed tenants",
        PermissionCategory.PARTNER,
    ),
    (
        "partner.support.tickets.update",
        "Update tickets for managed tenants",
        PermissionCategory.PARTNER,
    ),
    # Provisioning - subscriber management across tenants
    (
        "partner.provisioning.subscribers.activate",
        "Activate subscribers in managed tenants",
        PermissionCategory.PARTNER,
    ),
    (
        "partner.provisioning.subscribers.suspend",
        "Suspend subscribers in managed tenants",
        PermissionCategory.PARTNER,
    ),
    (
        "partner.provisioning.plans.assign",
        "Assign plans to subscribers in managed tenants",
        PermissionCategory.PARTNER,
    ),
    # Reports - analytics and compliance across tenants
    (
        "partner.reports.usage.read",
        "View usage reports for managed tenants",
        PermissionCategory.PARTNER,
    ),
    (
        "partner.reports.sla.read",
        "View SLA compliance reports for managed tenants",
        PermissionCategory.PARTNER,
    ),
    (
        "partner.reports.export",
        "Export reports for managed tenants",
        PermissionCategory.PARTNER,
    ),
    # Alerts - notifications for partner-managed tenants
    (
        "partner.alerts.sla.read",
        "View SLA breach alerts for managed tenants",
        PermissionCategory.PARTNER,
    ),
    (
        "partner.alerts.billing.read",
        "View billing threshold alerts for managed tenants",
        PermissionCategory.PARTNER,
    ),
)


# Role to permission mappings
ROLE_PERMISSION_MAP: dict[str, Iterable[str]] = {
    # Platform admins get all partner permissions
    "admin": [perm[0] for perm in PARTNER_PERMISSIONS],
    # MSP Full Access - all operations for managed tenants
    "partner_msp_full": [perm[0] for perm in PARTNER_PERMISSIONS],
    # MSP Billing - billing and revenue operations only
    "partner_msp_billing": [
        "partner.tenants.list",
        "partner.tenants.switch_context",
        "partner.billing.read",
        "partner.billing.summary.read",
        "partner.billing.invoices.read",
        "partner.billing.invoices.export",
        "partner.reports.usage.read",
        "partner.reports.export",
        "partner.alerts.billing.read",
    ],
    # MSP Support - support and ticketing operations only
    "partner_msp_support": [
        "partner.tenants.list",
        "partner.tenants.switch_context",
        "partner.support.tickets.list",
        "partner.support.tickets.read",
        "partner.support.tickets.create",
        "partner.support.tickets.update",
        "partner.reports.sla.read",
        "partner.alerts.sla.read",
    ],
    # Auditor - read-only access for compliance
    "partner_auditor": [
        "partner.tenants.list",
        "partner.billing.read",
        "partner.billing.summary.read",
        "partner.billing.invoices.read",
        "partner.support.tickets.list",
        "partner.support.tickets.read",
        "partner.reports.usage.read",
        "partner.reports.sla.read",
        "partner.alerts.sla.read",
        "partner.alerts.billing.read",
    ],
}


async def _get_permission(session: AsyncSession, name: str) -> Permission | None:
    result = await session.execute(select(Permission).where(Permission.name == name))
    return result.scalars().first()


async def _get_role(session: AsyncSession, name: str) -> Role | None:
    result = await session.execute(select(Role).where(Role.name == name))
    return result.scalars().first()


async def ensure_partner_rbac(session: AsyncSession) -> None:
    """Ensure partner multi-account management permissions and role assignments exist."""

    created_permissions = []

    # Create permissions
    for name, description, category in PARTNER_PERMISSIONS:
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
