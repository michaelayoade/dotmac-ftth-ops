"""
DataLoaders for batching GraphQL queries.

Prevents N+1 query problems by batching database requests.
"""

from __future__ import annotations

from collections import defaultdict
from typing import Any, cast

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

logger = structlog.get_logger(__name__)


class SessionLoader:
    """Batch load RADIUS sessions by username."""

    def __init__(self, db: AsyncSession):
        self.db = db
        self._cache: dict[tuple[str | None, str], list[Any]] = {}

    async def load(self, username: str, *, tenant_id: str | None = None) -> list[Any]:
        """Load sessions for a single username (with cache)."""
        cache_key = (tenant_id, username)
        if cache_key in self._cache:
            return list(self._cache[cache_key])

        # Import here to avoid circular imports
        from dotmac.platform.radius.models import RadAcct

        # Query for this specific username
        stmt = (
            select(RadAcct)
            .where(RadAcct.username == username)
            .where(RadAcct.acctstoptime.is_(None))  # Only active sessions
            .order_by(RadAcct.acctstarttime.desc())
            .limit(20)
        )
        if tenant_id is not None:
            stmt = stmt.where(RadAcct.tenant_id == tenant_id)

        result = await self.db.execute(stmt)
        sessions = result.scalars().all()

        # Cache result
        self._cache[cache_key] = list(sessions)
        return list(sessions)

    async def load_many(
        self,
        usernames: list[str],
        *,
        tenant_id: str | None = None,
    ) -> list[list[Any]]:
        """Batch load sessions for multiple usernames."""
        if not usernames:
            return []

        def cache_key(name):
            return (tenant_id, name)

        uncached_usernames = [
            username for username in usernames if cache_key(username) not in self._cache
        ]

        if uncached_usernames:
            # Import here to avoid circular imports
            from dotmac.platform.radius.models import RadAcct

            # Query all uncached sessions at once
            stmt = (
                select(RadAcct)
                .where(RadAcct.username.in_(uncached_usernames))
                .where(RadAcct.acctstoptime.is_(None))  # Only active sessions
                .order_by(RadAcct.username, RadAcct.acctstarttime.desc())
            )
            if tenant_id is not None:
                stmt = stmt.where(RadAcct.tenant_id == tenant_id)

            result = await self.db.execute(stmt)
            all_sessions = result.scalars().all()

            # Group sessions by username
            grouped: dict[str, list[Any]] = defaultdict(list)
            for session in all_sessions:
                username_value = str(session.username)
                grouped[username_value].append(session)

            # Limit each user to 20 sessions and cache
            for username in uncached_usernames:
                sessions = grouped.get(username, [])
                limited_sessions = sessions[:20]
                self._cache[cache_key(username)] = list(limited_sessions)

        # Return in same order as input usernames
        return [list(self._cache.get(cache_key(username), [])) for username in usernames]


class CustomerActivityLoader:
    """Batch load customer activities by customer_id."""

    def __init__(self, db: AsyncSession):
        self.db = db
        self._cache: dict[str, list[Any]] = {}

    async def load_many(self, customer_ids: list[str]) -> list[list[Any]]:
        """Batch load activities for multiple customers."""
        if not customer_ids:
            return []

        # Import here to avoid circular imports
        from dotmac.platform.customer_management.models import CustomerActivity

        # Query all activities at once
        stmt = (
            select(CustomerActivity)
            .where(CustomerActivity.customer_id.in_(customer_ids))
            .order_by(CustomerActivity.customer_id, CustomerActivity.created_at.desc())
        )

        result = await self.db.execute(stmt)
        all_activities = result.scalars().all()

        # Group activities by customer_id
        grouped: dict[str, list[Any]] = defaultdict(list)
        for activity in all_activities:
            grouped[str(activity.customer_id)].append(activity)

        # Limit each customer to 20 most recent activities
        for customer_id in grouped:
            grouped[customer_id] = grouped[customer_id][:20]

        # Cache all results
        self._cache.update(grouped)

        # Return in same order as input customer_ids
        return [grouped.get(customer_id, []) for customer_id in customer_ids]


class CustomerNoteLoader:
    """Batch load customer notes by customer_id."""

    def __init__(self, db: AsyncSession):
        self.db = db
        self._cache: dict[str, list[Any]] = {}

    async def load_many(self, customer_ids: list[str]) -> list[list[Any]]:
        """Batch load notes for multiple customers."""
        if not customer_ids:
            return []

        # Import here to avoid circular imports
        from dotmac.platform.customer_management.models import CustomerNote

        # Query all notes at once (non-deleted only)
        stmt = (
            select(CustomerNote)
            .where(CustomerNote.customer_id.in_(customer_ids))
            .where(CustomerNote.deleted_at.is_(None))  # Only non-deleted notes
            .order_by(CustomerNote.customer_id, CustomerNote.created_at.desc())
        )

        result = await self.db.execute(stmt)
        all_notes = result.scalars().all()

        # Group notes by customer_id
        grouped: dict[str, list[Any]] = defaultdict(list)
        for note in all_notes:
            grouped[str(note.customer_id)].append(note)

        # Limit each customer to 10 most recent notes
        for customer_id in grouped:
            grouped[customer_id] = grouped[customer_id][:10]

        # Cache all results
        self._cache.update(grouped)

        # Return in same order as input customer_ids
        return [grouped.get(customer_id, []) for customer_id in customer_ids]


class PaymentCustomerLoader:
    """Batch load customer data for payments."""

    def __init__(self, db: AsyncSession):
        self.db = db
        self._cache: dict[str, Any] = {}

    async def load_many(self, customer_ids: list[str]) -> list[Any | None]:
        """Batch load customer data for multiple customer IDs."""
        if not customer_ids:
            return []

        # Import here to avoid circular imports
        from dotmac.platform.customer_management.models import Customer

        # Filter out already cached IDs
        uncached_ids = [cid for cid in customer_ids if cid not in self._cache]

        if uncached_ids:
            # Query all customers at once
            stmt = select(Customer).where(Customer.id.in_(list(uncached_ids)))

            result = await self.db.execute(stmt)
            customers = result.scalars().all()

            # Cache results
            for customer in customers:
                self._cache[str(customer.id)] = customer

        # Return in same order as input customer_ids (None if not found)
        return [self._cache.get(customer_id) for customer_id in customer_ids]


class PaymentInvoiceLoader:
    """Batch load invoice data for payments."""

    def __init__(self, db: AsyncSession):
        self.db = db
        self._cache: dict[str, Any] = {}

    async def load_many(self, invoice_ids: list[str]) -> list[Any | None]:
        """Batch load invoice data for multiple invoice IDs."""
        if not invoice_ids:
            return []

        # Import here to avoid circular imports
        from dotmac.platform.billing.invoicing.entities import InvoiceEntity

        # Filter out already cached IDs and None values
        valid_ids = [iid for iid in invoice_ids if iid and iid not in self._cache]

        if valid_ids:
            # Query all invoices at once
            stmt = select(InvoiceEntity).where(InvoiceEntity.invoice_id.in_(list(valid_ids)))

            result = await self.db.execute(stmt)
            invoices = result.scalars().all()

            # Cache results
            for invoice in invoices:
                self._cache[str(invoice.invoice_id)] = invoice

        # Return in same order as input invoice_ids (None if not found)
        return [self._cache.get(invoice_id) if invoice_id else None for invoice_id in invoice_ids]


class TenantSettingsLoader:
    """Batch load tenant settings by tenant_id."""

    def __init__(self, db: AsyncSession):
        self.db = db
        self._cache: dict[str, list[Any]] = {}

    async def load_many(self, tenant_ids: list[str]) -> list[list[Any]]:
        """Batch load settings for multiple tenants."""
        if not tenant_ids:
            return []

        # Import here to avoid circular imports
        from dotmac.platform.tenant.models import TenantSetting

        # Query all settings at once
        stmt = (
            select(TenantSetting)
            .where(TenantSetting.tenant_id.in_(tenant_ids))
            .order_by(TenantSetting.tenant_id, TenantSetting.key)
        )

        result = await self.db.execute(stmt)
        all_settings = result.scalars().all()

        # Group settings by tenant_id
        grouped: dict[str, list[Any]] = defaultdict(list)
        for setting in all_settings:
            grouped[str(setting.tenant_id)].append(setting)

        self._cache.update(grouped)

        # Return in same order as input tenant_ids
        return [grouped.get(tenant_id, []) for tenant_id in tenant_ids]


class TenantUsageLoader:
    """Batch load tenant usage records by tenant_id."""

    def __init__(self, db: AsyncSession):
        self.db = db
        self._cache: dict[str, list[Any]] = {}

    async def load_many(self, tenant_ids: list[str]) -> list[list[Any]]:
        """Batch load usage records for multiple tenants."""
        if not tenant_ids:
            return []

        # Import here to avoid circular imports
        from dotmac.platform.tenant.models import TenantUsage

        # Query recent usage records (last 12 months)
        stmt = (
            select(TenantUsage)
            .where(TenantUsage.tenant_id.in_(tenant_ids))
            .order_by(TenantUsage.tenant_id, TenantUsage.period_start.desc())
        )

        result = await self.db.execute(stmt)
        all_usage = result.scalars().all()

        # Group usage by tenant_id, limit to 12 most recent
        grouped: dict[str, list[Any]] = defaultdict(list)
        for usage in all_usage:
            grouped[str(usage.tenant_id)].append(usage)

        # Limit each tenant to 12 most recent records
        for tenant_id in grouped:
            grouped[tenant_id] = grouped[tenant_id][:12]

        self._cache.update(grouped)

        return [grouped.get(tenant_id, []) for tenant_id in tenant_ids]


class TenantInvitationsLoader:
    """Batch load tenant invitations by tenant_id."""

    def __init__(self, db: AsyncSession):
        self.db = db
        self._cache: dict[str, list[Any]] = {}

    async def load_many(self, tenant_ids: list[str]) -> list[list[Any]]:
        """Batch load invitations for multiple tenants."""
        if not tenant_ids:
            return []

        # Import here to avoid circular imports
        from dotmac.platform.tenant.models import TenantInvitation

        # Query all pending invitations
        stmt = (
            select(TenantInvitation)
            .where(TenantInvitation.tenant_id.in_(tenant_ids))
            .order_by(TenantInvitation.tenant_id, TenantInvitation.created_at.desc())
        )

        result = await self.db.execute(stmt)
        all_invitations = result.scalars().all()

        # Group invitations by tenant_id
        grouped: dict[str, list[Any]] = defaultdict(list)
        for invitation in all_invitations:
            grouped[str(invitation.tenant_id)].append(invitation)

        self._cache.update(grouped)

        return [grouped.get(tenant_id, []) for tenant_id in tenant_ids]


class UserRolesLoader:
    """Batch load user roles by user_id."""

    def __init__(self, db: AsyncSession):
        self.db = db
        self._cache: dict[str, list[Any]] = {}

    async def load_many(self, user_ids: list[str]) -> list[list[Any]]:
        """Batch load roles for multiple users."""
        if not user_ids:
            return []

        # Import here to avoid circular imports
        from dotmac.platform.auth.models import Role, user_roles

        # Query all user_roles relationships
        stmt = select(user_roles).where(user_roles.c.user_id.in_(user_ids))

        result = await self.db.execute(stmt)
        user_role_rows = result.all()

        # Get unique role IDs
        role_ids = list({row.role_id for row in user_role_rows})

        # Fetch all roles at once
        roles_stmt = select(Role).where(Role.id.in_(role_ids))
        roles_result = await self.db.execute(roles_stmt)
        all_roles = roles_result.scalars().all()

        # Create role lookup
        roles_by_id = {str(role.id): role for role in all_roles}

        # Group roles by user_id
        grouped: dict[str, list[Any]] = defaultdict(list)
        for row in user_role_rows:
            user_id_str = str(row.user_id)
            role = roles_by_id.get(str(row.role_id))
            if role:
                grouped[user_id_str].append(role)

        self._cache.update(grouped)

        # Return in same order as input user_ids
        return [grouped.get(user_id, []) for user_id in user_ids]


class UserPermissionsLoader:
    """Batch load user permissions by user_id."""

    def __init__(self, db: AsyncSession):
        self.db = db
        self._cache: dict[str, list[Any]] = {}

    async def load_many(self, user_ids: list[str]) -> list[list[Any]]:
        """Batch load permissions for multiple users."""
        if not user_ids:
            return []

        # Import here to avoid circular imports
        from dotmac.platform.auth.models import Permission, role_permissions, user_roles

        # Get all roles for these users
        user_roles_stmt = select(user_roles).where(user_roles.c.user_id.in_(user_ids))
        user_roles_result = await self.db.execute(user_roles_stmt)
        user_role_rows = user_roles_result.all()

        # Get unique role IDs
        role_ids = list({row.role_id for row in user_role_rows})

        if not role_ids:
            # No roles found, return empty lists
            return [[] for _ in user_ids]

        # Get all permissions for these roles
        role_perms_stmt = select(role_permissions).where(role_permissions.c.role_id.in_(role_ids))
        role_perms_result = await self.db.execute(role_perms_stmt)
        role_perm_rows = role_perms_result.all()

        # Get unique permission IDs
        permission_ids = list({row.permission_id for row in role_perm_rows})

        if not permission_ids:
            # No permissions found, return empty lists
            return [[] for _ in user_ids]

        # Fetch all permissions at once
        perms_stmt = select(Permission).where(Permission.id.in_(permission_ids))
        perms_result = await self.db.execute(perms_stmt)
        all_permissions = perms_result.scalars().all()

        # Create permission lookup
        perms_by_id = {str(perm.id): perm for perm in all_permissions}

        # Create role -> permissions mapping
        role_to_perms: dict[str, list[Any]] = defaultdict(list)
        for row in role_perm_rows:
            role_id_str = str(row.role_id)
            perm = perms_by_id.get(str(row.permission_id))
            if perm:
                role_to_perms[role_id_str].append(perm)

        # Group permissions by user_id (via roles)
        grouped: dict[str, set[Any]] = defaultdict(set)
        for row in user_role_rows:
            user_id_str = str(row.user_id)
            role_id_str = str(row.role_id)
            perms = role_to_perms.get(role_id_str, [])
            grouped[user_id_str].update(perms)

        # Convert sets to lists and cache
        grouped_lists = {user_id: list(perms) for user_id, perms in grouped.items()}
        self._cache.update(grouped_lists)

        # Return in same order as input user_ids
        return [grouped_lists.get(user_id, []) for user_id in user_ids]


class UserTeamsLoader:
    """Batch load user team memberships by user_id."""

    def __init__(self, db: AsyncSession):
        self.db = db
        self._cache: dict[str, list[Any]] = {}

    async def load_many(self, user_ids: list[str]) -> list[list[Any]]:
        """Batch load team memberships for multiple users."""
        if not user_ids:
            return []

        # Import here to avoid circular imports
        from dotmac.platform.user_management.models import Team, TeamMember

        # Query all team memberships at once
        stmt = (
            select(TeamMember)
            .where(TeamMember.user_id.in_(user_ids))
            .where(TeamMember.is_active == True)  # noqa: E712
            .order_by(TeamMember.user_id, TeamMember.created_at.desc())
        )

        result = await self.db.execute(stmt)
        all_memberships = result.scalars().all()

        # Get unique team IDs
        team_ids = list({m.team_id for m in all_memberships})

        # Fetch all teams at once
        teams_stmt = select(Team).where(Team.id.in_(team_ids))
        teams_result = await self.db.execute(teams_stmt)
        all_teams = teams_result.scalars().all()

        # Create team lookup
        teams_by_id = {str(team.id): team for team in all_teams}

        # Group memberships by user_id, attaching team data
        grouped: dict[str, list[Any]] = defaultdict(list)
        for membership in all_memberships:
            user_id_str = str(membership.user_id)
            # Attach team data to membership for easy access
            membership._team = teams_by_id.get(str(membership.team_id))
            grouped[user_id_str].append(membership)

        self._cache.update(grouped)

        # Return in same order as input user_ids
        return [grouped.get(user_id, []) for user_id in user_ids]


class ProfileChangeHistoryLoader:
    """Batch load profile change history by user_id."""

    def __init__(self, db: AsyncSession):
        self.db = db
        self._cache: dict[str, list[Any]] = {}

    async def load_many(self, user_ids: list[str]) -> list[list[Any]]:
        """Batch load profile changes for multiple users."""
        if not user_ids:
            return []

        # Import here to avoid circular imports
        from dotmac.platform.user_management.models import ProfileChangeHistory, User

        # Query all profile changes at once (limit to 20 most recent per user)
        stmt = (
            select(ProfileChangeHistory)
            .where(ProfileChangeHistory.user_id.in_(user_ids))
            .order_by(ProfileChangeHistory.user_id, ProfileChangeHistory.created_at.desc())
        )

        result = await self.db.execute(stmt)
        all_changes = result.scalars().all()

        # Get unique changed_by_user_ids for username lookup
        changed_by_ids = list({c.changed_by_user_id for c in all_changes})

        # Fetch all users who made changes
        users_stmt = select(User).where(User.id.in_(changed_by_ids))
        users_result = await self.db.execute(users_stmt)
        all_users = users_result.scalars().all()

        # Create user lookup
        users_by_id = {str(user.id): user.username for user in all_users}

        # Group changes by user_id, attaching username
        grouped: dict[str, list[Any]] = defaultdict(list)
        for change in all_changes:
            user_id_str = str(change.user_id)
            # Attach username for easy access
            change._changed_by_username = users_by_id.get(str(change.changed_by_user_id))
            grouped[user_id_str].append(change)

        # Limit each user to 20 most recent changes
        for user_id in grouped:
            grouped[user_id] = grouped[user_id][:20]

        self._cache.update(grouped)

        # Return in same order as input user_ids
        return [grouped.get(user_id, []) for user_id in user_ids]


class SubscriptionPlanLoader:
    """Batch load subscription plans by plan_id."""

    def __init__(self, db: AsyncSession):
        self.db = db
        self._cache: dict[str, Any] = {}

    async def load_many(self, plan_ids: list[str]) -> list[Any | None]:
        """Batch load plans for multiple plan IDs."""
        if not plan_ids:
            return []

        # Import here to avoid circular imports
        from dotmac.platform.billing.subscriptions.models import SubscriptionPlan

        # Filter out already cached IDs
        uncached_ids = [pid for pid in plan_ids if pid not in self._cache]

        if uncached_ids:
            # Query all plans at once
            plan_id_column = cast(Any, SubscriptionPlan.plan_id)
            stmt = select(SubscriptionPlan).where(plan_id_column.in_(uncached_ids))

            result = await self.db.execute(stmt)
            plans = result.scalars().all()

            # Cache results
            for plan in plans:
                self._cache[plan.plan_id] = plan

        # Return in same order as input plan_ids (None if not found)
        return [self._cache.get(plan_id) for plan_id in plan_ids]


class SubscriptionCustomerLoader:
    """Batch load customer data for subscriptions."""

    def __init__(self, db: AsyncSession):
        self.db = db
        self._cache: dict[str, Any] = {}

    async def load_many(self, customer_ids: list[str]) -> list[Any | None]:
        """Batch load customer data for multiple customer IDs."""
        if not customer_ids:
            return []

        # Import here to avoid circular imports
        from dotmac.platform.customer_management.models import Customer

        # Filter out already cached IDs
        uncached_ids = [cid for cid in customer_ids if cid not in self._cache]

        if uncached_ids:
            # Query all customers at once
            stmt = select(Customer).where(Customer.id.in_(uncached_ids))

            result = await self.db.execute(stmt)
            customers = result.scalars().all()

            # Cache results
            for customer in customers:
                self._cache[str(customer.id)] = customer

        # Return in same order as input customer_ids (None if not found)
        return [self._cache.get(customer_id) for customer_id in customer_ids]


class SubscriptionInvoicesLoader:
    """Batch load recent invoices for subscriptions."""

    def __init__(self, db: AsyncSession):
        self.db = db
        self._cache: dict[str, list[Any]] = {}

    async def load_many(self, subscription_ids: list[str]) -> list[list[Any]]:
        """Batch load recent invoices for multiple subscriptions."""
        if not subscription_ids:
            return []

        # Import here to avoid circular imports
        from dotmac.platform.billing.invoicing.entities import InvoiceEntity

        # Query all invoices at once (limit to 5 most recent per subscription)
        stmt = (
            select(InvoiceEntity)
            .where(InvoiceEntity.subscription_id.in_(subscription_ids))
            .order_by(InvoiceEntity.subscription_id, InvoiceEntity.created_at.desc())
        )

        result = await self.db.execute(stmt)
        all_invoices = result.scalars().all()

        # Group invoices by subscription_id
        grouped: dict[str, list[Any]] = defaultdict(list)
        for invoice in all_invoices:
            if invoice.subscription_id:
                grouped[invoice.subscription_id].append(invoice)

        # Limit each subscription to 5 most recent invoices
        for sub_id in grouped:
            grouped[sub_id] = grouped[sub_id][:5]

        self._cache.update(grouped)

        # Return in same order as input subscription_ids
        return [grouped.get(sub_id, []) for sub_id in subscription_ids]


class DeviceTrafficLoader:
    """Batch load traffic statistics for network devices.

    This loader uses the network monitoring service to fetch traffic data
    for multiple devices in a single batch operation.
    """

    def __init__(self, db: AsyncSession):
        self.db = db
        self._cache: dict[str, Any] = {}

    async def load_many(self, device_ids: list[str]) -> list[Any | None]:
        """Batch load traffic stats for multiple devices."""
        if not device_ids:
            return []

        # Filter out already cached IDs
        uncached_ids = [did for did in device_ids if did not in self._cache]

        if uncached_ids:
            # Note: In a real implementation, this would call the network monitoring service
            # For now, we'll return placeholder data
            # The actual implementation would integrate with NetBox, GenieACS, or VOLTHA

            # from dotmac.platform.network_monitoring.service import NetworkMonitoringService
            # service = NetworkMonitoringService(...)
            # traffic_list = await service.batch_get_traffic_stats(uncached_ids)

            # Placeholder: Cache None for devices without traffic data
            for device_id in uncached_ids:
                self._cache[device_id] = None

        # Return in same order as input device_ids (None if not found)
        return [self._cache.get(device_id) for device_id in device_ids]


class DeviceAlertsLoader:
    """Batch load alerts for network devices."""

    def __init__(self, db: AsyncSession):
        self.db = db
        self._cache: dict[str, list[Any]] = {}

    async def load_many(self, device_ids: list[str]) -> list[list[Any]]:
        """Batch load alerts for multiple devices."""
        if not device_ids:
            return []

        # Filter out already cached IDs
        uncached_ids = [did for did in device_ids if did not in self._cache]

        if uncached_ids:
            # Note: In a real implementation, this would query network alerts
            # from a monitoring database or service

            # from dotmac.platform.network_monitoring.models import NetworkAlert
            # stmt = (
            #     select(NetworkAlert)
            #     .where(NetworkAlert.device_id.in_(uncached_ids))
            #     .where(NetworkAlert.is_active == True)
            #     .order_by(NetworkAlert.device_id, NetworkAlert.triggered_at.desc())
            # )
            # result = await self.db.execute(stmt)
            # alerts = result.scalars().all()

            # Group alerts by device_id
            # grouped: dict[str, list[Any]] = defaultdict(list)
            # for alert in alerts:
            #     grouped[alert.device_id].append(alert)

            # For now, placeholder implementation
            for device_id in uncached_ids:
                self._cache[device_id] = []

        # Return in same order as input device_ids
        return [self._cache.get(device_id, []) for device_id in device_ids]


class DataLoaderRegistry:
    """Registry of all DataLoaders for a request."""

    def __init__(self, db: AsyncSession):
        self.db = db
        self._loaders: dict[str, Any] = {}

    def get_session_loader(self) -> SessionLoader:
        """Get or create SessionLoader for this request."""
        if "session" not in self._loaders:
            self._loaders["session"] = SessionLoader(self.db)
        return cast(SessionLoader, self._loaders["session"])

    def get_customer_activity_loader(self) -> CustomerActivityLoader:
        """Get or create CustomerActivityLoader for this request."""
        if "customer_activity" not in self._loaders:
            self._loaders["customer_activity"] = CustomerActivityLoader(self.db)
        return cast(CustomerActivityLoader, self._loaders["customer_activity"])

    def get_customer_note_loader(self) -> CustomerNoteLoader:
        """Get or create CustomerNoteLoader for this request."""
        if "customer_note" not in self._loaders:
            self._loaders["customer_note"] = CustomerNoteLoader(self.db)
        return cast(CustomerNoteLoader, self._loaders["customer_note"])

    def get_payment_customer_loader(self) -> PaymentCustomerLoader:
        """Get or create PaymentCustomerLoader for this request."""
        if "payment_customer" not in self._loaders:
            self._loaders["payment_customer"] = PaymentCustomerLoader(self.db)
        return cast(PaymentCustomerLoader, self._loaders["payment_customer"])

    def get_payment_invoice_loader(self) -> PaymentInvoiceLoader:
        """Get or create PaymentInvoiceLoader for this request."""
        if "payment_invoice" not in self._loaders:
            self._loaders["payment_invoice"] = PaymentInvoiceLoader(self.db)
        return cast(PaymentInvoiceLoader, self._loaders["payment_invoice"])

    def get_tenant_settings_loader(self) -> TenantSettingsLoader:
        """Get or create TenantSettingsLoader for this request."""
        if "tenant_settings" not in self._loaders:
            self._loaders["tenant_settings"] = TenantSettingsLoader(self.db)
        return cast(TenantSettingsLoader, self._loaders["tenant_settings"])

    def get_tenant_usage_loader(self) -> TenantUsageLoader:
        """Get or create TenantUsageLoader for this request."""
        if "tenant_usage" not in self._loaders:
            self._loaders["tenant_usage"] = TenantUsageLoader(self.db)
        return cast(TenantUsageLoader, self._loaders["tenant_usage"])

    def get_tenant_invitations_loader(self) -> TenantInvitationsLoader:
        """Get or create TenantInvitationsLoader for this request."""
        if "tenant_invitations" not in self._loaders:
            self._loaders["tenant_invitations"] = TenantInvitationsLoader(self.db)
        return cast(TenantInvitationsLoader, self._loaders["tenant_invitations"])

    def get_user_roles_loader(self) -> UserRolesLoader:
        """Get or create UserRolesLoader for this request."""
        if "user_roles" not in self._loaders:
            self._loaders["user_roles"] = UserRolesLoader(self.db)
        return cast(UserRolesLoader, self._loaders["user_roles"])

    def get_user_permissions_loader(self) -> UserPermissionsLoader:
        """Get or create UserPermissionsLoader for this request."""
        if "user_permissions" not in self._loaders:
            self._loaders["user_permissions"] = UserPermissionsLoader(self.db)
        return cast(UserPermissionsLoader, self._loaders["user_permissions"])

    def get_user_teams_loader(self) -> UserTeamsLoader:
        """Get or create UserTeamsLoader for this request."""
        if "user_teams" not in self._loaders:
            self._loaders["user_teams"] = UserTeamsLoader(self.db)
        return cast(UserTeamsLoader, self._loaders["user_teams"])

    def get_profile_change_history_loader(self) -> ProfileChangeHistoryLoader:
        """Get or create ProfileChangeHistoryLoader for this request."""
        if "profile_changes" not in self._loaders:
            self._loaders["profile_changes"] = ProfileChangeHistoryLoader(self.db)
        return cast(ProfileChangeHistoryLoader, self._loaders["profile_changes"])

    def get_subscription_plan_loader(self) -> SubscriptionPlanLoader:
        """Get or create SubscriptionPlanLoader for this request."""
        if "subscription_plan" not in self._loaders:
            self._loaders["subscription_plan"] = SubscriptionPlanLoader(self.db)
        return cast(SubscriptionPlanLoader, self._loaders["subscription_plan"])

    def get_subscription_customer_loader(self) -> SubscriptionCustomerLoader:
        """Get or create SubscriptionCustomerLoader for this request."""
        if "subscription_customer" not in self._loaders:
            self._loaders["subscription_customer"] = SubscriptionCustomerLoader(self.db)
        return cast(SubscriptionCustomerLoader, self._loaders["subscription_customer"])

    def get_subscription_invoices_loader(self) -> SubscriptionInvoicesLoader:
        """Get or create SubscriptionInvoicesLoader for this request."""
        if "subscription_invoices" not in self._loaders:
            self._loaders["subscription_invoices"] = SubscriptionInvoicesLoader(self.db)
        return cast(SubscriptionInvoicesLoader, self._loaders["subscription_invoices"])

    def get_device_traffic_loader(self) -> DeviceTrafficLoader:
        """Get or create DeviceTrafficLoader for this request."""
        if "device_traffic" not in self._loaders:
            self._loaders["device_traffic"] = DeviceTrafficLoader(self.db)
        return cast(DeviceTrafficLoader, self._loaders["device_traffic"])

    def get_device_alerts_loader(self) -> DeviceAlertsLoader:
        """Get or create DeviceAlertsLoader for this request."""
        if "device_alerts" not in self._loaders:
            self._loaders["device_alerts"] = DeviceAlertsLoader(self.db)
        return cast(DeviceAlertsLoader, self._loaders["device_alerts"])
