"""
Service layer for tenant onboarding automation.
"""

from __future__ import annotations

import secrets
from datetime import UTC, datetime
from typing import Any

import structlog

from dotmac.platform.user_management.service import UserService

from .models import Tenant, TenantStatus
from .onboarding_schemas import TenantOnboardingRequest
from .schemas import TenantSettingCreate, TenantUpdate
from .service import (
    TenantAlreadyExistsError,
    TenantNotFoundError,
    TenantService,
)

logger = structlog.get_logger(__name__)


class TenantOnboardingService:
    """Coordinate tenant onboarding automation tasks."""

    def __init__(
        self,
        tenant_service: TenantService,
        user_service: UserService | None = None,
    ) -> None:
        self.tenant_service = tenant_service
        self.user_service = user_service

    async def run_onboarding(
        self,
        payload: TenantOnboardingRequest,
        initiated_by: str | None = None,
    ) -> dict[str, Any]:
        """
        Execute onboarding automation for a tenant.

        Returns a dictionary containing tenant object plus contextual metadata suitable
        for serialisation by the API layer.
        """
        logs: list[str] = []
        warnings: list[str] = []
        applied_settings: list[str] = []
        created_invitations = []
        admin_user_id: str | None = None
        admin_user_password: str | None = None
        feature_flags_updated = False
        created = False

        now = datetime.now(UTC)
        now_iso = now.isoformat()

        tenant = await self._resolve_or_create_tenant(payload, initiated_by, logs)
        if tenant is None:
            raise TenantNotFoundError("Unable to resolve tenant for onboarding.")
        created = getattr(tenant, "_onboarding_created", False)

        metadata_updates = dict(payload.metadata)
        metadata_updates.setdefault("onboarding_started_at", now_iso)
        if initiated_by:
            metadata_updates.setdefault("onboarding_initiated_by", initiated_by)

        status_value = metadata_updates.get("onboarding_status")
        if not status_value:
            status_value = (
                "completed" if payload.options.mark_onboarding_complete else "in_progress"
            )
            metadata_updates["onboarding_status"] = status_value

        if payload.options.mark_onboarding_complete:
            metadata_updates.setdefault("onboarding_completed", True)
            metadata_updates.setdefault("onboarding_completed_at", now_iso)

        # Apply optional feature flag overrides
        if payload.feature_flags is not None:
            tenant = await self.tenant_service.update_tenant_features(
                tenant.id,
                payload.feature_flags,
                updated_by=initiated_by,
            )
            feature_flags_updated = True
            logs.append(f"Updated feature flags for tenant {tenant.id}.")

        # Apply default settings and user-provided settings
        if payload.options.apply_default_settings:
            default_settings = self._default_settings(status_value, now_iso)
        else:
            default_settings = []

        for setting in [*default_settings, *payload.settings]:
            saved = await self.tenant_service.set_tenant_setting(tenant.id, setting)
            if saved.key not in applied_settings:
                applied_settings.append(saved.key)

        if applied_settings:
            logs.append(f"Applied {len(applied_settings)} tenant settings.")

        # Merge metadata onto tenant
        tenant = await self.tenant_service.update_tenant_metadata(
            tenant.id,
            metadata_updates,
            updated_by=initiated_by,
        )
        logs.append("Updated tenant metadata for onboarding context.")

        # Optionally activate tenant
        if payload.options.activate_tenant and tenant.status != TenantStatus.ACTIVE:
            status_update = TenantUpdate.model_validate({"status": TenantStatus.ACTIVE})
            tenant = await self.tenant_service.update_tenant(
                tenant.id,
                status_update,
                updated_by=initiated_by,
            )
            logs.append("Tenant status updated to ACTIVE as part of onboarding.")

        # Provision admin user if requested
        if payload.admin_user:
            admin_user_id, admin_user_password = await self._provision_admin_user(
                tenant.id,
                payload,
                initiated_by,
                logs,
                warnings,
            )

        # Create invitations if provided
        for invitation_data in payload.invitations:
            try:
                invitation = await self.tenant_service.create_invitation(
                    tenant.id,
                    invitation_data,
                    invited_by=initiated_by or "system",
                )
                created_invitations.append(invitation)
            except ValueError as exc:
                warning = f"Failed to create invitation for {invitation_data.email}: {exc}"
                warnings.append(warning)
                logger.warning("tenant.onboarding.invitation_failed", error=str(exc))

        if created_invitations:
            logs.append(f"Created {len(created_invitations)} onboarding invitations.")

        logs.append(f"Tenant onboarding automation complete for {tenant.id}.")

        onboarding_status = status_value
        metadata = getattr(tenant, "custom_metadata", {}) or {}

        result: dict[str, Any] = {
            "tenant": tenant,
            "created": created,
            "onboarding_status": onboarding_status,
            "admin_user_id": admin_user_id,
            "admin_user_password": admin_user_password,
            "invitations": created_invitations,
            "applied_settings": applied_settings,
            "metadata": metadata,
            "feature_flags_updated": feature_flags_updated,
            "warnings": warnings,
            "logs": logs,
        }
        return result

    async def get_onboarding_status(self, tenant_id: str) -> dict[str, Any]:
        """Return onboarding status information for a tenant."""
        tenant = await self.tenant_service.get_tenant(tenant_id)
        metadata = getattr(tenant, "custom_metadata", {}) or {}
        completed = bool(metadata.get("onboarding_completed"))
        status_value = metadata.get("onboarding_status")
        if not status_value:
            status_value = "completed" if completed else "not_started"

        return {
            "tenant_id": tenant.id,
            "status": status_value,
            "completed": completed,
            "metadata": metadata,
            "updated_at": getattr(tenant, "updated_at", None),
        }

    async def _resolve_or_create_tenant(
        self,
        payload: TenantOnboardingRequest,
        initiated_by: str | None,
        logs: list[str],
    ) -> Tenant | None:
        """Create or load the tenant targeted by onboarding."""
        if payload.tenant_id:
            tenant = await self.tenant_service.get_tenant(payload.tenant_id)
            logs.append(f"Resolved existing tenant {tenant.id} for onboarding.")
            tenant._onboarding_created = False  # type: ignore[attr-defined]
            return tenant

        if payload.tenant is None:
            return None

        try:
            tenant = await self.tenant_service.create_tenant(
                payload.tenant,
                created_by=initiated_by,
            )
            logs.append(f"Created tenant {tenant.id} during onboarding.")
            tenant._onboarding_created = True  # type: ignore[attr-defined]
            return tenant
        except TenantAlreadyExistsError:
            if not payload.options.allow_existing_tenant:
                raise
            tenant = await self.tenant_service.get_tenant_by_slug(payload.tenant.slug)
            logs.append(
                f"Tenant with slug '{payload.tenant.slug}' already exists; reusing existing tenant {tenant.id}."
            )
            tenant._onboarding_created = False  # type: ignore[attr-defined]
            return tenant

    async def _provision_admin_user(
        self,
        tenant_id: str,
        payload: TenantOnboardingRequest,
        initiated_by: str | None,
        logs: list[str],
        warnings: list[str],
    ) -> tuple[str | None, str | None]:
        """Create the requested admin user, returning (user_id, generated_password)."""
        if not self.user_service:
            raise RuntimeError("User service is not configured; cannot provision admin user.")

        admin_payload = payload.admin_user
        if admin_payload is None:
            return None, None

        password = admin_payload.password
        generated_password = False
        if password is None and admin_payload.generate_password:
            password = self._generate_password()
            generated_password = True

        roles = list(admin_payload.roles)
        if "tenant_admin" not in {role.lower() for role in roles}:
            roles.append("tenant_admin")

        try:
            user = await self.user_service.create_user(
                username=admin_payload.username,
                email=admin_payload.email,
                password=password or "",
                full_name=admin_payload.full_name,
                roles=roles,
                tenant_id=tenant_id,
                is_active=True,
            )
        except ValueError as exc:
            warning = f"Failed to create admin user {admin_payload.username}: {exc}"
            warnings.append(warning)
            logger.warning("tenant.onboarding.admin_user_failed", error=str(exc))
            return None, None

        logs.append(
            f"Provisioned admin user {admin_payload.username} ({user.id}) for tenant {tenant_id}."
        )

        if initiated_by:
            logger.info(
                "tenant.onboarding.admin_user_created",
                tenant_id=tenant_id,
                admin_user_id=str(user.id),
                initiated_by=initiated_by,
            )

        return str(user.id), password if generated_password else None

    @staticmethod
    def _default_settings(status_value: str, timestamp_iso: str) -> list[TenantSettingCreate]:
        """Build default tenant settings applied during onboarding."""
        return [
            TenantSettingCreate(
                key="onboarding.status",
                value=status_value,
                value_type="string",
                description="Tracks onboarding automation status.",
            ),
            TenantSettingCreate(
                key="onboarding.last_updated_at",
                value=timestamp_iso,
                value_type="datetime",
                description="Last time onboarding automation was executed.",
            ),
        ]

    @staticmethod
    def _generate_password() -> str:
        """Generate a strong random password for admin user provisioning."""
        # 32 bytes gives a 43 character urlsafe string, providing ample entropy.
        return secrets.token_urlsafe(32)
