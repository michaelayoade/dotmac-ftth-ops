"""
Tenant management service layer.

Provides business logic for tenant operations including:
- CRUD operations
- Usage tracking
- Feature management
- Invitation handling
"""

import secrets
from datetime import UTC, datetime, timedelta
from typing import Any

import structlog
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import attributes

from ..settings import settings
from .models import (
    Tenant,
    TenantInvitation,
    TenantInvitationStatus,
    TenantPlanType,
    TenantSetting,
    TenantStatus,
    TenantUsage,
)
from .schemas import (
    TenantBrandingConfig,
    TenantBrandingResponse,
    TenantBrandingUpdate,
    TenantCreate,
    TenantInvitationCreate,
    TenantSettingCreate,
    TenantStatsResponse,
    TenantUpdate,
    TenantUsageCreate,
)

logger = structlog.get_logger(__name__)


class TenantNotFoundError(Exception):
    """Raised when tenant is not found."""

    pass


class TenantAlreadyExistsError(Exception):
    """Raised when tenant already exists."""

    pass


class TenantLimitExceededError(Exception):
    """Raised when tenant exceeds limits."""

    pass


class TenantService:
    """Service for managing tenants."""

    def __init__(self, db: AsyncSession) -> None:
        """Initialize tenant service."""
        self.db = db

    async def create_tenant(
        self, tenant_data: TenantCreate, created_by: str | None = None
    ) -> Tenant:
        """
        Create a new tenant.

        Args:
            tenant_data: Tenant creation data
            created_by: User ID creating the tenant

        Returns:
            Created tenant

        Raises:
            TenantAlreadyExistsError: If slug or domain already exists
        """
        try:
            # Check if tenant with slug already exists
            stmt = select(Tenant).where(
                Tenant.slug == tenant_data.slug, Tenant.deleted_at.is_(None)
            )
            existing = await self.db.execute(stmt)
            if existing.scalar_one_or_none():
                raise TenantAlreadyExistsError(
                    f"Tenant with slug '{tenant_data.slug}' already exists"
                )

            # Check domain if provided
            if tenant_data.domain:
                stmt = select(Tenant).where(
                    Tenant.domain == tenant_data.domain, Tenant.deleted_at.is_(None)
                )
                existing = await self.db.execute(stmt)
                if existing.scalar_one_or_none():
                    raise TenantAlreadyExistsError(
                        f"Tenant with domain '{tenant_data.domain}' already exists"
                    )

            # Create tenant
            tenant = Tenant(
                name=tenant_data.name,
                slug=tenant_data.slug,
                domain=tenant_data.domain,
                email=tenant_data.email,
                phone=tenant_data.phone,
                plan_type=tenant_data.plan_type,
                billing_cycle=tenant_data.billing_cycle,
                billing_email=tenant_data.billing_email,
                max_users=tenant_data.max_users,
                max_api_calls_per_month=tenant_data.max_api_calls_per_month,
                max_storage_gb=tenant_data.max_storage_gb,
                company_size=tenant_data.company_size,
                industry=tenant_data.industry,
                country=tenant_data.country,
                timezone=tenant_data.timezone,
                status=TenantStatus.TRIAL,
                created_by=created_by,
                updated_by=created_by,
            )

            # Set trial period from settings
            tenant.trial_ends_at = datetime.now(UTC) + timedelta(
                days=settings.billing.default_trial_days
            )

            # Set default features based on plan
            tenant.features = self._get_default_features(tenant_data.plan_type)

            if tenant_data.branding:
                tenant.custom_metadata = tenant.custom_metadata or {}
                tenant.custom_metadata["branding"] = tenant_data.branding.model_dump(
                    exclude_none=True
                )

            self.db.add(tenant)
            await self.db.commit()
            await self.db.refresh(tenant)

            return tenant
        except TenantAlreadyExistsError:
            # Re-raise business logic exceptions
            raise
        except Exception as e:
            # Rollback on error
            await self.db.rollback()
            raise RuntimeError(f"Failed to create tenant: {str(e)}") from e

    async def get_tenant(self, tenant_id: str, include_deleted: bool = False) -> Tenant:
        """
        Get tenant by ID.

        Args:
            tenant_id: Tenant ID
            include_deleted: Include soft-deleted tenants

        Returns:
            Tenant

        Raises:
            TenantNotFoundError: If tenant not found
        """
        stmt = select(Tenant).where(Tenant.id == tenant_id)

        if not include_deleted:
            stmt = stmt.where(Tenant.deleted_at.is_(None))

        result = await self.db.execute(stmt)
        tenant = result.scalar_one_or_none()

        if not tenant:
            raise TenantNotFoundError(f"Tenant with ID '{tenant_id}' not found")

        return tenant

    async def get_tenant_by_slug(self, slug: str, include_deleted: bool = False) -> Tenant:
        """
        Get tenant by slug.

        Args:
            slug: Tenant slug
            include_deleted: Include soft-deleted tenants

        Returns:
            Tenant

        Raises:
            TenantNotFoundError: If tenant not found
        """
        stmt = select(Tenant).where(Tenant.slug == slug)

        if not include_deleted:
            stmt = stmt.where(Tenant.deleted_at.is_(None))

        result = await self.db.execute(stmt)
        tenant = result.scalar_one_or_none()

        if not tenant:
            raise TenantNotFoundError(f"Tenant with slug '{slug}' not found")

        return tenant

    async def list_tenants(
        self,
        page: int = 1,
        page_size: int = 20,
        status: TenantStatus | None = None,
        plan_type: TenantPlanType | None = None,
        search: str | None = None,
        include_deleted: bool = False,
    ) -> tuple[list[Tenant], int]:
        """
        List tenants with pagination and filters.

        Args:
            page: Page number (1-indexed)
            page_size: Items per page
            status: Filter by status
            plan_type: Filter by plan type
            search: Search in name, slug, email
            include_deleted: Include soft-deleted tenants

        Returns:
            Tuple of (tenants, total_count)
        """
        try:
            stmt = select(Tenant)

            # Apply filters
            if not include_deleted:
                stmt = stmt.where(Tenant.deleted_at.is_(None))

            if status:
                stmt = stmt.where(Tenant.status == status)

            if plan_type:
                stmt = stmt.where(Tenant.plan_type == plan_type)

            if search:
                search_pattern = f"%{search}%"
                stmt = stmt.where(
                    or_(
                        Tenant.name.ilike(search_pattern),
                        Tenant.slug.ilike(search_pattern),
                        Tenant.email.ilike(search_pattern),
                    )
                )

            # Get total count
            count_stmt = select(func.count()).select_from(stmt.subquery())
            total_result = await self.db.execute(count_stmt)
            total = total_result.scalar_one()

            # Apply pagination
            offset = (page - 1) * page_size
            stmt = stmt.offset(offset).limit(page_size).order_by(Tenant.created_at.desc())

            # Execute query
            result = await self.db.execute(stmt)
            tenants = list(result.scalars().all())

            return tenants, total
        except Exception as exc:
            logger.exception(
                "tenant.list.failed",
                error=str(exc),
                page=page,
                page_size=page_size,
                status=str(status) if status else None,
                plan_type=str(plan_type) if plan_type else None,
                search=search,
                include_deleted=include_deleted,
            )
            await self.db.rollback()
            return [], 0

    async def update_tenant(
        self, tenant_id: str, tenant_data: TenantUpdate, updated_by: str | None = None
    ) -> Tenant:
        """
        Update tenant.

        Args:
            tenant_id: Tenant ID
            tenant_data: Update data
            updated_by: User ID making the update

        Returns:
            Updated tenant

        Raises:
            TenantNotFoundError: If tenant not found
        """
        try:
            tenant = await self.get_tenant(tenant_id)

            # Update fields
            update_fields = tenant_data.model_dump(exclude_unset=True)
            for field, value in update_fields.items():
                setattr(tenant, field, value)

            tenant.updated_by = updated_by
            tenant.updated_at = datetime.now(UTC)

            await self.db.commit()
            await self.db.refresh(tenant)

            return tenant
        except TenantNotFoundError:
            # Re-raise business logic exceptions
            raise
        except Exception as e:
            # Rollback on error
            await self.db.rollback()
            raise RuntimeError(f"Failed to update tenant: {str(e)}") from e

    async def delete_tenant(
        self, tenant_id: str, permanent: bool = False, deleted_by: str | None = None
    ) -> None:
        """
        Delete tenant (soft or hard delete).

        Args:
            tenant_id: Tenant ID
            permanent: Permanently delete if True, soft delete if False
            deleted_by: User ID performing deletion

        Raises:
            TenantNotFoundError: If tenant not found
        """
        tenant = await self.get_tenant(tenant_id)

        if permanent:
            await self.db.delete(tenant)
        else:
            tenant.soft_delete()
            tenant.updated_by = deleted_by

        await self.db.commit()

    async def restore_tenant(self, tenant_id: str, restored_by: str | None = None) -> Tenant:
        """
        Restore soft-deleted tenant.

        Args:
            tenant_id: Tenant ID
            restored_by: User ID performing restoration

        Returns:
            Restored tenant

        Raises:
            TenantNotFoundError: If tenant not found
        """
        tenant = await self.get_tenant(tenant_id, include_deleted=True)

        if not tenant.is_deleted:
            return tenant

        tenant.restore()
        # Status is preserved from before deletion
        tenant.updated_by = restored_by
        tenant.updated_at = datetime.now(UTC)

        await self.db.commit()
        await self.db.refresh(tenant)

        return tenant

    # Settings Management
    async def get_tenant_settings(self, tenant_id: str) -> list[TenantSetting]:
        """Get all settings for a tenant."""
        stmt = select(TenantSetting).where(TenantSetting.tenant_id == tenant_id)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def get_tenant_setting(self, tenant_id: str, key: str) -> TenantSetting | None:
        """Get a specific tenant setting."""
        stmt = select(TenantSetting).where(
            and_(TenantSetting.tenant_id == tenant_id, TenantSetting.key == key)
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def set_tenant_setting(
        self, tenant_id: str, setting_data: TenantSettingCreate
    ) -> TenantSetting:
        """Set or update a tenant setting."""
        # Check if setting exists
        existing = await self.get_tenant_setting(tenant_id, setting_data.key)

        if existing:
            # Update existing
            existing.value = setting_data.value
            existing.value_type = setting_data.value_type
            existing.description = setting_data.description
            existing.is_encrypted = setting_data.is_encrypted
            existing.updated_at = datetime.now(UTC)
            setting = existing
        else:
            # Create new
            setting = TenantSetting(
                tenant_id=tenant_id,
                key=setting_data.key,
                value=setting_data.value,
                value_type=setting_data.value_type,
                description=setting_data.description,
                is_encrypted=setting_data.is_encrypted,
            )
            self.db.add(setting)

        await self.db.commit()
        await self.db.refresh(setting)
        return setting

    async def delete_tenant_setting(self, tenant_id: str, key: str) -> None:
        """Delete a tenant setting."""
        setting = await self.get_tenant_setting(tenant_id, key)
        if setting:
            await self.db.delete(setting)
            await self.db.commit()

    # Usage Tracking
    async def record_usage(self, tenant_id: str, usage_data: TenantUsageCreate) -> TenantUsage:
        """Record usage metrics for a tenant."""
        usage = TenantUsage(
            tenant_id=tenant_id,
            period_start=usage_data.period_start,
            period_end=usage_data.period_end,
            api_calls=usage_data.api_calls,
            storage_gb=usage_data.storage_gb,
            active_users=usage_data.active_users,
            bandwidth_gb=usage_data.bandwidth_gb,
            metrics=usage_data.metrics,
        )

        self.db.add(usage)
        await self.db.commit()
        await self.db.refresh(usage)

        return usage

    async def get_tenant_usage(
        self, tenant_id: str, start_date: datetime | None = None, end_date: datetime | None = None
    ) -> list[TenantUsage]:
        """Get usage records for a tenant."""
        stmt = select(TenantUsage).where(TenantUsage.tenant_id == tenant_id)

        if start_date:
            stmt = stmt.where(TenantUsage.period_start >= start_date)

        if end_date:
            stmt = stmt.where(TenantUsage.period_end <= end_date)

        stmt = stmt.order_by(TenantUsage.period_start.desc())

        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def update_tenant_usage_counters(
        self,
        tenant_id: str,
        api_calls: int | None = None,
        storage_gb: float | None = None,
        users: int | None = None,
    ) -> Tenant:
        """Update current usage counters on tenant."""
        tenant = await self.get_tenant(tenant_id)

        if api_calls is not None:
            tenant.current_api_calls += api_calls

        if storage_gb is not None:
            tenant.current_storage_gb = storage_gb

        if users is not None:
            tenant.current_users = users

        await self.db.commit()
        await self.db.refresh(tenant)

        return tenant

    # Invitations
    async def create_invitation(
        self, tenant_id: str, invitation_data: TenantInvitationCreate, invited_by: str
    ) -> TenantInvitation:
        """Create a tenant invitation."""
        # Generate secure token
        token = secrets.token_urlsafe(32)

        # Set expiry (7 days)
        expires_at = datetime.now(UTC) + timedelta(days=7)

        invitation = TenantInvitation(
            tenant_id=tenant_id,
            email=invitation_data.email,
            role=invitation_data.role,
            invited_by=invited_by,
            token=token,
            expires_at=expires_at,
        )

        self.db.add(invitation)
        await self.db.commit()
        await self.db.refresh(invitation)

        return invitation

    async def get_invitation(self, invitation_id: str) -> TenantInvitation:
        """Get invitation by ID."""
        stmt = select(TenantInvitation).where(TenantInvitation.id == invitation_id)
        result = await self.db.execute(stmt)
        invitation = result.scalar_one_or_none()

        if not invitation:
            raise ValueError(f"Invitation with ID '{invitation_id}' not found")

        return invitation

    async def get_invitation_by_token(self, token: str) -> TenantInvitation:
        """Get invitation by token."""
        stmt = select(TenantInvitation).where(TenantInvitation.token == token)
        result = await self.db.execute(stmt)
        invitation = result.scalar_one_or_none()

        if not invitation:
            raise ValueError("Invalid invitation token")

        return invitation

    async def accept_invitation(self, token: str) -> TenantInvitation:
        """Accept a tenant invitation."""
        invitation = await self.get_invitation_by_token(token)

        if invitation.status != TenantInvitationStatus.PENDING:
            raise ValueError("Invitation has already been processed")

        if invitation.is_expired:
            invitation.status = TenantInvitationStatus.EXPIRED
            await self.db.commit()
            raise ValueError("Invitation has expired")

        invitation.status = TenantInvitationStatus.ACCEPTED
        invitation.accepted_at = datetime.now(UTC)

        await self.db.commit()
        await self.db.refresh(invitation)

        return invitation

    async def revoke_invitation(self, invitation_id: str) -> TenantInvitation:
        """Revoke a tenant invitation."""
        invitation = await self.get_invitation(invitation_id)

        if invitation.status == TenantInvitationStatus.ACCEPTED:
            raise ValueError("Cannot revoke accepted invitation")

        invitation.status = TenantInvitationStatus.REVOKED

        await self.db.commit()
        await self.db.refresh(invitation)

        return invitation

    async def list_tenant_invitations(
        self, tenant_id: str, status: TenantInvitationStatus | None = None
    ) -> list[TenantInvitation]:
        """List invitations for a tenant."""
        stmt = select(TenantInvitation).where(TenantInvitation.tenant_id == tenant_id)

        if status:
            stmt = stmt.where(TenantInvitation.status == status)

        stmt = stmt.order_by(TenantInvitation.created_at.desc())

        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    # Feature Management
    async def update_tenant_features(
        self,
        tenant_id: str,
        features: dict[str, bool] | None,
        updated_by: str | None = None,
    ) -> Tenant:
        """Update tenant feature flags."""
        try:
            tenant = await self.get_tenant(tenant_id)

            # Handle None values before validation
            if features is None:
                features = {}

            # Merge with existing features
            tenant.features.update(features)
            # Flag the JSON column as modified so SQLAlchemy tracks the change
            attributes.flag_modified(tenant, "features")
            tenant.updated_by = updated_by
            tenant.updated_at = datetime.now(UTC)

            await self.db.commit()
            await self.db.refresh(tenant)

            return tenant
        except TenantNotFoundError:
            # Re-raise business logic exceptions
            raise
        except Exception as e:
            # Rollback on error
            await self.db.rollback()
            raise RuntimeError(f"Failed to update tenant features: {str(e)}") from e

    async def update_tenant_metadata(
        self,
        tenant_id: str,
        metadata: dict[str, Any] | None,
        updated_by: str | None = None,
    ) -> Tenant:
        """Update tenant metadata."""
        try:
            tenant = await self.get_tenant(tenant_id)

            # Handle None values before validation
            if metadata is None:
                metadata = {}

            # Merge with existing metadata
            tenant.custom_metadata.update(metadata)
            # Flag the JSON column as modified so SQLAlchemy tracks the change
            attributes.flag_modified(tenant, "custom_metadata")
            tenant.updated_by = updated_by
            tenant.updated_at = datetime.now(UTC)

            await self.db.commit()
            await self.db.refresh(tenant)

            return tenant
        except TenantNotFoundError:
            # Re-raise business logic exceptions
            raise
        except Exception as e:
            # Rollback on error
            await self.db.rollback()
            raise RuntimeError(f"Failed to update tenant metadata: {str(e)}") from e

    # Statistics
    async def get_tenant_stats(self, tenant_id: str) -> TenantStatsResponse:
        """Get tenant usage statistics."""
        tenant = await self.get_tenant(tenant_id)

        # Calculate usage percentages
        user_usage_percent = (
            (tenant.current_users / tenant.max_users * 100) if tenant.max_users > 0 else 0
        )
        api_usage_percent = (
            (tenant.current_api_calls / tenant.max_api_calls_per_month * 100)
            if tenant.max_api_calls_per_month > 0
            else 0
        )
        storage_usage_percent = (
            (float(tenant.current_storage_gb) / tenant.max_storage_gb * 100)
            if tenant.max_storage_gb > 0
            else 0
        )

        # Calculate days until expiry
        days_until_expiry = None
        if tenant.subscription_ends_at:
            delta = tenant.subscription_ends_at - datetime.now(UTC)
            days_until_expiry = delta.days

        return TenantStatsResponse(
            tenant_id=tenant.id,
            total_users=tenant.current_users,
            active_users=tenant.current_users,
            total_api_calls=tenant.current_api_calls,
            total_storage_gb=float(tenant.current_storage_gb),
            total_bandwidth_gb=0,  # Could aggregate from usage records
            user_limit=tenant.max_users,
            api_limit=tenant.max_api_calls_per_month,
            storage_limit=tenant.max_storage_gb,
            user_usage_percent=user_usage_percent,
            api_usage_percent=api_usage_percent,
            storage_usage_percent=storage_usage_percent,
            plan_type=tenant.plan_type,
            status=tenant.status,
            days_until_expiry=days_until_expiry,
        )

    # Bulk Operations
    async def bulk_update_status(
        self, tenant_ids: list[str], status: TenantStatus, updated_by: str | None = None
    ) -> int:
        """Bulk update tenant status."""
        stmt = select(Tenant).where(Tenant.id.in_(tenant_ids), Tenant.deleted_at.is_(None))
        result = await self.db.execute(stmt)
        tenants = list(result.scalars().all())

        for tenant in tenants:
            tenant.status = status
            tenant.updated_by = updated_by
            tenant.updated_at = datetime.now(UTC)

        await self.db.commit()

        return len(tenants)

    async def bulk_delete_tenants(
        self, tenant_ids: list[str], permanent: bool = False, deleted_by: str | None = None
    ) -> int:
        """Bulk delete tenants."""
        stmt = select(Tenant).where(Tenant.id.in_(tenant_ids), Tenant.deleted_at.is_(None))
        result = await self.db.execute(stmt)
        tenants = list(result.scalars().all())

        for tenant in tenants:
            if permanent:
                await self.db.delete(tenant)
            else:
                tenant.soft_delete()
                tenant.updated_by = deleted_by

        await self.db.commit()

        return len(tenants)

    # Helper methods
    def _get_default_features(self, plan_type: TenantPlanType) -> dict[str, bool]:
        """Get default features based on plan type."""
        features = {
            "api_access": True,
            "webhooks": False,
            "custom_domain": False,
            "sso": False,
            "advanced_analytics": False,
            "priority_support": False,
            "white_label": False,
        }

        if plan_type in [
            TenantPlanType.PROFESSIONAL,
            TenantPlanType.ENTERPRISE,
            TenantPlanType.CUSTOM,
        ]:
            features.update({"webhooks": True, "advanced_analytics": True})

        if plan_type in [TenantPlanType.ENTERPRISE, TenantPlanType.CUSTOM]:
            features.update(
                {
                    "custom_domain": True,
                    "sso": True,
                    "priority_support": True,
                    "white_label": True,
                }
            )

        return features

    # Branding helpers
    @staticmethod
    def _get_branding_defaults() -> dict[str, Any]:
        """Return global branding defaults."""
        return {
            "product_name": settings.brand.product_name,
            "product_tagline": settings.brand.product_tagline,
            "company_name": settings.brand.company_name,
            "support_email": settings.brand.support_email,
            "success_email": settings.brand.success_email,
            "operations_email": settings.brand.operations_email,
            "partner_support_email": settings.brand.partner_support_email,
            "primary_color": None,
            "primary_hover_color": None,
            "primary_foreground_color": None,
            "secondary_color": None,
            "secondary_hover_color": None,
            "secondary_foreground_color": None,
            "accent_color": None,
            "background_color": None,
            "foreground_color": None,
            "primary_color_dark": None,
            "primary_hover_color_dark": None,
            "primary_foreground_color_dark": None,
            "secondary_color_dark": None,
            "secondary_hover_color_dark": None,
            "secondary_foreground_color_dark": None,
            "accent_color_dark": None,
            "background_color_dark": None,
            "foreground_color_dark": None,
            "logo_light_url": None,
            "logo_dark_url": None,
            "favicon_url": None,
            "docs_url": None,
            "support_portal_url": None,
            "status_page_url": None,
            "terms_url": None,
            "privacy_url": None,
        }

    @staticmethod
    def get_default_branding_config() -> TenantBrandingConfig:
        """Return branding config constructed from global defaults."""
        return TenantBrandingConfig.model_validate(TenantService._get_branding_defaults())

    def _build_tenant_branding_response(self, tenant: Tenant) -> TenantBrandingResponse:
        """Merge tenant overrides with defaults."""
        tenant_branding: dict[str, Any] = {}
        if isinstance(tenant.custom_metadata, dict):
            tenant_branding = tenant.custom_metadata.get("branding") or {}

        branding_payload = self._get_branding_defaults()
        branding_payload.update(
            {k: v for k, v in (tenant_branding or {}).items() if v not in (None, "")}
        )

        return TenantBrandingResponse(
            tenant_id=tenant.id,
            branding=TenantBrandingConfig.model_validate(branding_payload),
            updated_at=tenant.updated_at,
        )

    async def get_tenant_branding(self, tenant_id: str) -> TenantBrandingResponse:
        """Retrieve branding for a tenant."""
        tenant = await self.get_tenant(tenant_id)
        return self._build_tenant_branding_response(tenant)

    async def update_tenant_branding(
        self, tenant_id: str, branding_update: TenantBrandingUpdate
    ) -> TenantBrandingResponse:
        """Persist tenant branding overrides."""
        tenant = await self.get_tenant(tenant_id)

        if not isinstance(tenant.custom_metadata, dict):
            tenant.custom_metadata = {}

        branding_data = tenant.custom_metadata.get("branding") or {}
        updates = branding_update.branding.model_dump(exclude_unset=True)
        branding_data.update({k: v for k, v in updates.items() if v is not None})

        # Create new dict to ensure SQLAlchemy detects the change (mutable JSON tracking)
        new_metadata = dict(tenant.custom_metadata)
        new_metadata["branding"] = branding_data
        tenant.custom_metadata = new_metadata
        tenant.updated_at = datetime.now(UTC)

        await self.db.commit()
        await self.db.refresh(tenant)

        return self._build_tenant_branding_response(tenant)
