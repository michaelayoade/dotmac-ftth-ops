"""
License Issuer

Issues and manages licenses for ISP tenants.
"""

import secrets
from datetime import datetime, timedelta
from typing import Optional
from uuid import UUID

import httpx
import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from control_plane.licensing.models import (
    LicenseToken,
    OveragePolicy,
    TenantLicense,
    TenantPlan,
)
from dotmac.platform.tenant.models import Tenant

logger = structlog.get_logger(__name__)


class LicenseIssuer:
    """
    Issues and manages licenses for ISP tenants.

    Responsibilities:
    - Issue new licenses based on tenant plan
    - Push licenses to ISP instances
    - Handle plan changes
    - Track license versions
    """

    LICENSE_VALIDITY_DAYS = 30

    def __init__(self, signing_key: str, platform_api_key: str):
        self.signing_key = signing_key
        self.platform_api_key = platform_api_key

    async def issue_license(
        self,
        db: AsyncSession,
        tenant_id: UUID,
    ) -> TenantLicense:
        """
        Issue new license based on tenant's current plan.

        Creates or updates the TenantLicense record and generates
        a signed JWT token.
        """
        # Get tenant with plan
        tenant = await db.get(Tenant, tenant_id)
        if not tenant:
            raise ValueError(f"Tenant {tenant_id} not found")

        plan = await db.get(TenantPlan, tenant.plan_id)
        if not plan:
            raise ValueError(f"Plan {tenant.plan_id} not found")

        # Get or create license record
        result = await db.execute(
            select(TenantLicense).where(TenantLicense.tenant_id == tenant_id)
        )
        license_record = result.scalar_one_or_none()

        now = datetime.utcnow()
        new_version = (license_record.version + 1) if license_record else 1
        nonce = secrets.token_urlsafe(16)

        # Create license token
        license_token = LicenseToken.from_plan_and_tenant(
            tenant_id=str(tenant_id),
            plan=plan,
            version=new_version,
            validity_days=self.LICENSE_VALIDITY_DAYS,
        )

        # Sign it
        signed_token = license_token.to_jwt(self.signing_key)

        if license_record:
            # Update existing
            license_record.version = new_version
            license_record.nonce = nonce
            license_record.issued_at = now
            license_record.expires_at = license_token.expires_at
            license_record.signed_token = signed_token
            license_record.plan_id = plan.id
        else:
            # Create new
            license_record = TenantLicense(
                tenant_id=tenant_id,
                plan_id=plan.id,
                version=new_version,
                nonce=nonce,
                issued_at=now,
                expires_at=license_token.expires_at,
                signed_token=signed_token,
            )
            db.add(license_record)

        await db.commit()
        await db.refresh(license_record)

        logger.info(
            "license_issued",
            tenant_id=str(tenant_id),
            plan_id=str(plan.id),
            max_subscribers=plan.max_subscribers,
            version=new_version,
            expires_at=license_token.expires_at.isoformat(),
        )

        return license_record

    async def get_signed_license(
        self,
        db: AsyncSession,
        tenant_id: UUID,
    ) -> Optional[str]:
        """
        Get the current signed license token for a tenant.

        Returns None if no license exists.
        """
        result = await db.execute(
            select(TenantLicense).where(TenantLicense.tenant_id == tenant_id)
        )
        license_record = result.scalar_one_or_none()

        if not license_record:
            return None

        # Check if expired and re-issue if needed
        if license_record.is_expired():
            license_record = await self.issue_license(db, tenant_id)

        return license_record.signed_token

    async def push_license_to_instance(
        self,
        db: AsyncSession,
        tenant_id: UUID,
    ) -> bool:
        """
        Push license to ISP instance.

        Returns True if push succeeded, False otherwise.
        """
        # Get tenant deployment info
        tenant = await db.get(Tenant, tenant_id)
        if not tenant or not tenant.instance_url:
            logger.warning(
                "no_instance_url",
                tenant_id=str(tenant_id),
            )
            return False

        # Get signed license
        signed_token = await self.get_signed_license(db, tenant_id)
        if not signed_token:
            logger.warning(
                "no_license_to_push",
                tenant_id=str(tenant_id),
            )
            return False

        try:
            async with httpx.AsyncClient(timeout=30) as client:
                response = await client.post(
                    f"{tenant.instance_url}/api/v1/license/sync",
                    json={"license_token": signed_token},
                    headers={"X-Platform-API-Key": self.platform_api_key},
                )
                response.raise_for_status()

            logger.info(
                "license_pushed",
                tenant_id=str(tenant_id),
                instance_url=tenant.instance_url,
            )
            return True

        except httpx.HTTPError as e:
            logger.error(
                "license_push_failed",
                tenant_id=str(tenant_id),
                error=str(e),
            )
            return False

    async def on_plan_change(
        self,
        db: AsyncSession,
        tenant_id: UUID,
        new_plan_id: UUID,
    ) -> TenantLicense:
        """
        Handle plan upgrade/downgrade.

        Issues new license immediately and pushes to instance.
        """
        # Update tenant plan
        tenant = await db.get(Tenant, tenant_id)
        if not tenant:
            raise ValueError(f"Tenant {tenant_id} not found")

        old_plan_id = tenant.plan_id
        tenant.plan_id = new_plan_id
        await db.commit()

        # Issue new license
        license_record = await self.issue_license(db, tenant_id)

        # Push to instance
        await self.push_license_to_instance(db, tenant_id)

        logger.info(
            "license_updated_for_plan_change",
            tenant_id=str(tenant_id),
            old_plan_id=str(old_plan_id),
            new_plan_id=str(new_plan_id),
        )

        return license_record

    async def refresh_expiring_licenses(
        self,
        db: AsyncSession,
        days_before_expiry: int = 7,
    ) -> list[UUID]:
        """
        Refresh licenses that are about to expire.

        Called by a scheduled job.
        """
        threshold = datetime.utcnow() + timedelta(days=days_before_expiry)

        result = await db.execute(
            select(TenantLicense).where(
                TenantLicense.expires_at < threshold
            )
        )
        expiring_licenses = result.scalars().all()

        refreshed = []
        for license_record in expiring_licenses:
            try:
                await self.issue_license(db, license_record.tenant_id)
                await self.push_license_to_instance(db, license_record.tenant_id)
                refreshed.append(license_record.tenant_id)
            except Exception as e:
                logger.error(
                    "license_refresh_failed",
                    tenant_id=str(license_record.tenant_id),
                    error=str(e),
                )

        logger.info(
            "expiring_licenses_refreshed",
            count=len(refreshed),
            days_before_expiry=days_before_expiry,
        )

        return refreshed
