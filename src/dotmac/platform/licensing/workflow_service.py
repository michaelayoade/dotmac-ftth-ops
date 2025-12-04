"""
Licensing Workflow Service

Provides workflow-compatible methods for licensing operations.
Enhanced with comprehensive error handling, retry logic, and metrics.
"""

import logging
from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.workflows.base import WorkflowServiceBase
from dotmac.platform.workflows.validation_schemas import (
    AllocateFromPartnerInput,
    IssueLicenseInput,
)

from .models import LicenseTemplate
from .schemas import LicenseCreate
from .service import LicensingService

logger = logging.getLogger(__name__)


class LicenseService(WorkflowServiceBase):
    """
    License service for workflow integration.

    Provides license issuance and allocation methods for workflows with
    comprehensive error handling, retry logic, performance metrics, and logging.

    Inherits from WorkflowServiceBase:
    - Automatic retry logic for database operations
    - Circuit breaker for external service calls
    - Request/response logging
    - Performance metrics tracking
    - Pydantic input validation
    - Transaction management
    """

    def __init__(self, db: AsyncSession) -> None:
        super().__init__(db=db, service_name="LicenseService")
        self.db = db

    @WorkflowServiceBase.operation("issue_license")
    async def issue_license(
        self,
        customer_id: int | str,
        license_template_id: int | str,
        tenant_id: str,
        issued_to: str | None = None,
        issued_via: str | None = None,
        reseller_id: str | None = None,
        additional_metadata: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """
        Issue a license to a customer based on a license template.

        This method creates a fully functional software license using the
        composable licensing framework with comprehensive error handling and retry logic.

        Features (via WorkflowServiceBase) -> Any:
        - Automatic request/response logging
        - Performance metrics tracking
        - Input validation with Pydantic
        - Transaction retry logic
        - Detailed error logging

        Args:
            customer_id: Customer ID (UUID or integer)
            license_template_id: License template/type ID (UUID)
            tenant_id: Tenant ID
            issued_to: Optional name of the licensee (defaults to customer email/name)
            issued_via: Source of license issuance (e.g., "workflow", "api", "manual", "partner")
            reseller_id: Optional reseller/partner ID if issued through partner
            additional_metadata: Optional additional metadata to merge with license

        Returns:
            Dict with license details:
            {
                "license_key": "XXXX-XXXX-XXXX-XXXX-XXXX",
                "license_id": "uuid",
                "customer_id": "customer_id",
                "template_id": "template_id",
                "tenant_id": "tenant_id",
                "product_id": "product_id",
                "product_name": "Product Name",
                "license_type": "SUBSCRIPTION",
                "status": "ACTIVE",
                "issued_date": "2025-10-16T...",
                "expiry_date": "2026-10-16T...",
                "max_activations": 5
            }

        Raises:
            ValueError: If template not found or inactive
        """
        # Validate inputs using Pydantic schema
        validated = self.validate_input(
            IssueLicenseInput,
            {
                "customer_id": str(customer_id),
                "license_template_id": str(license_template_id),
                "tenant_id": tenant_id,
                "issued_to": issued_to,
                "issued_via": issued_via,
                "reseller_id": reseller_id,
                "additional_metadata": additional_metadata,
            },
        )

        # Use validated values
        customer_id_str = validated.customer_id
        license_template_id = validated.license_template_id
        tenant_id = validated.tenant_id
        issued_to = validated.issued_to
        issued_via = validated.issued_via or "workflow"
        reseller_id = validated.reseller_id
        additional_metadata = validated.additional_metadata

        # Use transaction context manager with automatic rollback
        async with self.transaction("issue_license"):
            # Fetch license template with retry logic
            async def fetch_template() -> Any:
                result = await self.db.execute(
                    select(LicenseTemplate).where(
                        LicenseTemplate.id == license_template_id,
                        LicenseTemplate.tenant_id == tenant_id,
                    )
                )
                return result.scalar_one_or_none()

            template = await self.with_retry(fetch_template)

            if not template:
                raise ValueError(
                    f"License template {license_template_id} not found for tenant {tenant_id}"
                )

            if not template.active:
                raise ValueError(f"License template {license_template_id} is inactive")

            # Get customer details if issued_to not provided
            if not issued_to:
                # Try to get customer from database with retry
                async def fetch_customer() -> Any:
                    from ..customer_management.models import Customer

                    customer_result = await self.db.execute(
                        select(Customer).where(
                            Customer.id == customer_id_str,
                            Customer.tenant_id == tenant_id,
                        )
                    )
                    return customer_result.scalar_one_or_none()

                customer = await self.with_retry(fetch_customer)
                if customer:
                    issued_to = (
                        f"{customer.first_name} {customer.last_name}".strip() or customer.email
                    )
                else:
                    issued_to = f"Customer {customer_id_str}"

            # Calculate expiry date based on template
            issued_date = datetime.now(UTC)
            expiry_date = issued_date + timedelta(days=template.default_duration)

            # Calculate maintenance expiry (usually same as expiry for subscriptions)
            maintenance_expiry = expiry_date

            # Build metadata with flexible issued_via
            license_metadata = {
                "template_id": str(template.id),
                "template_name": template.template_name,
                "issued_via": issued_via,
                "pricing": template.pricing,
                "issued_at": issued_date.isoformat(),
            }

            # Merge additional metadata if provided
            if additional_metadata:
                license_metadata.update(additional_metadata)

            # Get product version from template metadata or default
            product_version = (
                template.metadata_.get("product_version", "1.0") if template.metadata_ else "1.0"
            )

            # Build license creation request from template
            license_data = LicenseCreate(
                product_id=template.product_id,
                product_name=f"License for {template.template_name}",
                product_version=product_version,
                license_type=template.license_type,
                license_model=template.license_model,
                customer_id=customer_id_str,
                reseller_id=reseller_id,
                issued_to=issued_to,
                max_activations=template.max_activations,
                features=template.features.get("features", []),
                restrictions=template.restrictions.get("restrictions", []),
                expiry_date=expiry_date,
                maintenance_expiry=maintenance_expiry,
                auto_renewal=template.auto_renewal_enabled,
                trial_period_days=(
                    template.trial_duration_days if template.trial_allowed else None
                ),
                grace_period_days=template.grace_period_days,
                metadata=license_metadata,
            )

            # Create license using LicensingService with retry logic
            licensing_service = LicensingService(
                session=self.db,
                tenant_id=tenant_id,
                user_id=None,  # System-generated license
            )

            license_obj = await self.with_retry(licensing_service.create_license, license_data)

        # Return workflow-compatible response (transaction committed by context manager)
        return {
            "license_key": license_obj.license_key,
            "license_id": license_obj.id,
            "customer_id": customer_id_str,
            "template_id": str(license_template_id),
            "tenant_id": tenant_id,
            "product_id": license_obj.product_id,
            "product_name": license_obj.product_name,
            "license_type": license_obj.license_type.value,
            "license_model": license_obj.license_model.value,
            "status": license_obj.status.value,
            "issued_to": license_obj.issued_to,
            "issued_date": license_obj.issued_date.isoformat(),
            "expiry_date": (
                license_obj.expiry_date.isoformat() if license_obj.expiry_date else None
            ),
            "max_activations": license_obj.max_activations,
            "current_activations": license_obj.current_activations,
        }

    @WorkflowServiceBase.operation("allocate_from_partner")
    async def allocate_from_partner(
        self,
        partner_id: int | str,
        customer_id: int | str,
        license_template_id: int | str,
        license_count: int = 1,
        tenant_id: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """
        Allocate licenses from a partner's pool to a customer.

        This method allows partners to distribute licenses from their
        allocated quota to their customers with comprehensive error handling and retry logic.

        Features (via WorkflowServiceBase) -> Any:
        - Automatic request/response logging
        - Performance metrics tracking
        - Input validation with Pydantic
        - Transaction retry logic
        - Detailed error logging

        Args:
            partner_id: Partner ID (UUID or string)
            customer_id: Customer ID (UUID or string)
            license_template_id: License template to use for allocation
            license_count: Number of licenses to allocate (default 1)
            tenant_id: Tenant ID for multi-tenant isolation
            metadata: Additional metadata for the licenses

        Returns:
            Dict with allocation details:
            {
                "partner_id": str,  # Partner UUID
                "customer_id": str,  # Customer UUID
                "licenses_allocated": int,  # Number of licenses created
                "license_keys": list[str],  # List of license keys
                "license_ids": list[str],  # List of license UUIDs
                "template_id": str,  # Template used
                "quota_remaining": int,  # Partner quota after allocation
                "allocated_at": str,  # ISO timestamp
                "status": str,  # Allocation status
            }

        Raises:
            ValueError: If partner/customer not found, quota exceeded, or invalid params
            RuntimeError: If allocation fails
        """
        from uuid import UUID

        # Validate inputs using Pydantic schema
        validated = self.validate_input(
            AllocateFromPartnerInput,
            {
                "partner_id": str(partner_id),
                "customer_id": str(customer_id),
                "license_template_id": str(license_template_id),
                "license_count": license_count,
                "tenant_id": tenant_id,
                "metadata": metadata,
            },
        )

        # Use validated values
        partner_id = validated.partner_id
        customer_id = validated.customer_id
        license_template_id = validated.license_template_id
        license_count = validated.license_count
        tenant_id = validated.tenant_id
        metadata = validated.metadata

        # Convert IDs to UUIDs
        partner_uuid = UUID(partner_id)
        customer_uuid = UUID(customer_id)
        template_uuid = UUID(license_template_id)

        # Use transaction context manager with automatic rollback
        async with self.transaction("allocate_from_partner"):
            # Check partner quota using partner workflow service
            from ..partner_management.workflow_service import (
                PartnerService as PartnerWorkflowService,
            )

            partner_workflow = PartnerWorkflowService(self.db)
            quota_check = await partner_workflow.check_license_quota(
                partner_id=partner_uuid,
                requested_licenses=license_count,
                tenant_id=tenant_id,
            )

            if not quota_check["available"]:
                raise ValueError(
                    f"Partner {partner_id} has insufficient quota. "
                    f"Requested: {license_count}, "
                    f"Available: {quota_check['quota_remaining']}"
                )

            # Get tenant_id from partner if not provided
            if not tenant_id:
                from ..partner_management.models import Partner

                partner_result = await self.db.execute(
                    select(Partner).where(Partner.id == partner_uuid)
                )
                partner = partner_result.scalar_one_or_none()
                if partner:
                    tenant_id = partner.tenant_id
                else:
                    raise ValueError(f"Partner not found: {partner_id}")

            # Verify customer exists and belongs to partner
            from ..partner_management.models import PartnerAccount

            account_result = await self.db.execute(
                select(PartnerAccount).where(
                    PartnerAccount.partner_id == partner_uuid,
                    PartnerAccount.customer_id == customer_uuid,
                    PartnerAccount.is_active == True,  # noqa: E712
                )
            )
            partner_account = account_result.scalar_one_or_none()

            if not partner_account:
                raise ValueError(
                    f"No active partner account found linking partner {partner_id} "
                    f"to customer {customer_id}"
                )

            # Fetch license template
            template_result = await self.db.execute(
                select(LicenseTemplate).where(
                    LicenseTemplate.id == template_uuid,
                    LicenseTemplate.active == True,  # noqa: E712
                )
            )
            template = template_result.scalar_one_or_none()

            if not template:
                raise ValueError(f"License template not found or inactive: {license_template_id}")

            # Allocate licenses by issuing them to the customer
            license_keys = []
            license_ids = []

            for i in range(license_count):
                # Build metadata including partner information
                license_metadata = metadata or {}
                license_metadata.update(
                    {
                        "partner_id": str(partner_uuid),
                        "partner_allocated": True,
                        "partner_name": quota_check.get("partner_name", ""),
                        "partner_number": quota_check.get("partner_number", ""),
                        "allocation_index": i + 1,
                        "allocation_count": license_count,
                        "allocated_at": datetime.now(UTC).isoformat(),
                        "engagement_type": partner_account.engagement_type,
                    }
                )

                # Issue license using the existing method with partner context
                license_info = await self.issue_license(
                    customer_id=customer_uuid,
                    license_template_id=template_uuid,
                    tenant_id=tenant_id,
                    issued_via="partner",
                    reseller_id=str(partner_uuid),
                    additional_metadata=license_metadata,
                )

                license_keys.append(license_info["license_key"])
                license_ids.append(license_info["license_id"])

            # Commit all changes
            await self.db.commit()

            # Get updated quota
            updated_quota = await partner_workflow.check_license_quota(
                partner_id=partner_uuid,
                requested_licenses=0,
                tenant_id=tenant_id,
            )

            logger.info(
                f"Successfully allocated {license_count} licenses from partner {partner_id} "
                f"to customer {customer_id}. Quota remaining: {updated_quota['quota_remaining']}"
            )

            return {
                "partner_id": str(partner_uuid),
                "partner_name": quota_check["partner_name"],
                "customer_id": str(customer_uuid),
                "licenses_allocated": license_count,
                "license_keys": license_keys,
                "license_ids": license_ids,
                "template_id": str(template_uuid),
                "template_name": template.template_name,
                "product_id": template.product_id,
                "quota_before": quota_check["quota_remaining"] + license_count,
                "quota_after": updated_quota["quota_remaining"],
                "quota_remaining": updated_quota["quota_remaining"],
                "allocated_at": datetime.now(UTC).isoformat(),
                "status": "allocated",
                "engagement_type": partner_account.engagement_type,
            }
