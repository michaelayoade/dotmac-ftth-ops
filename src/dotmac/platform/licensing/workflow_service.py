"""
Licensing Workflow Service

Provides workflow-compatible methods for licensing operations.
"""

import logging
from datetime import UTC, datetime, timedelta
from typing import Any, Dict

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .models import LicenseStatus, LicenseTemplate
from .schemas import LicenseCreate
from .service import LicensingService

logger = logging.getLogger(__name__)


class LicenseService:
    """
    License service for workflow integration.

    Provides license issuance and allocation methods for workflows.
    """

    def __init__(self, db: AsyncSession):
        self.db = db

    async def issue_license(
        self,
        customer_id: int | str,
        license_template_id: int | str,
        tenant_id: str,
        issued_to: str | None = None,
    ) -> Dict[str, Any]:
        """
        Issue a license to a customer based on a license template.

        This method creates a fully functional software license using the
        composable licensing framework. It fetches the template configuration,
        generates a unique license key, and stores the license in the database.

        Args:
            customer_id: Customer ID (UUID or integer)
            license_template_id: License template/type ID (UUID)
            tenant_id: Tenant ID
            issued_to: Optional name of the licensee (defaults to customer email/name)

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
        logger.info(
            f"Issuing license for customer {customer_id} using template {license_template_id}, tenant {tenant_id}"
        )

        # Convert customer_id to string if integer
        customer_id_str = str(customer_id)

        # Fetch license template
        result = await self.db.execute(
            select(LicenseTemplate).where(
                LicenseTemplate.id == str(license_template_id),
                LicenseTemplate.tenant_id == tenant_id,
            )
        )
        template = result.scalar_one_or_none()

        if not template:
            raise ValueError(
                f"License template {license_template_id} not found for tenant {tenant_id}"
            )

        if not template.active:
            raise ValueError(f"License template {license_template_id} is inactive")

        # Get customer details if issued_to not provided
        if not issued_to:
            # Try to get customer from database
            from ..customer_management.models import Customer

            customer_result = await self.db.execute(
                select(Customer).where(
                    Customer.id == customer_id_str,
                    Customer.tenant_id == tenant_id,
                )
            )
            customer = customer_result.scalar_one_or_none()
            if customer:
                issued_to = f"{customer.first_name} {customer.last_name}".strip() or customer.email
            else:
                issued_to = f"Customer {customer_id_str}"

        # Calculate expiry date based on template
        issued_date = datetime.now(UTC)
        expiry_date = issued_date + timedelta(days=template.default_duration)

        # Calculate maintenance expiry (usually same as expiry for subscriptions)
        maintenance_expiry = expiry_date

        # Build license creation request from template
        license_data = LicenseCreate(
            product_id=template.product_id,
            product_name=f"License for {template.template_name}",
            product_version="1.0",  # Could be derived from template metadata
            license_type=template.license_type,
            license_model=template.license_model,
            customer_id=customer_id_str,
            reseller_id=None,  # Could be added as parameter
            issued_to=issued_to,
            max_activations=template.max_activations,
            features=template.features.get("features", []),
            restrictions=template.restrictions.get("restrictions", []),
            expiry_date=expiry_date,
            maintenance_expiry=maintenance_expiry,
            auto_renewal=template.auto_renewal_enabled,
            trial_period_days=template.trial_duration_days if template.trial_allowed else None,
            grace_period_days=template.grace_period_days,
            metadata={
                "template_id": str(template.id),
                "template_name": template.template_name,
                "issued_via": "workflow",
                "pricing": template.pricing,
            },
        )

        # Create license using LicensingService
        licensing_service = LicensingService(
            session=self.db,
            tenant_id=tenant_id,
            user_id=None,  # System-generated license
        )

        license_obj = await licensing_service.create_license(license_data)

        logger.info(
            f"License issued successfully: {license_obj.license_key} "
            f"(ID: {license_obj.id}) for customer {customer_id}"
        )

        # Return workflow-compatible response
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
            "expiry_date": license_obj.expiry_date.isoformat() if license_obj.expiry_date else None,
            "max_activations": license_obj.max_activations,
            "current_activations": license_obj.current_activations,
        }

    async def allocate_from_partner(
        self,
        partner_id: int | str,
        customer_id: int | str,
        license_template_id: int | str,
        license_count: int = 1,
        tenant_id: str | None = None,
        metadata: Dict[str, Any] | None = None,
    ) -> Dict[str, Any]:
        """
        Allocate licenses from a partner's pool to a customer.

        This method allows partners to distribute licenses from their
        allocated quota to their customers. The partner must have sufficient
        quota available. Licenses are created using the specified template.

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

        logger.info(
            f"Allocating {license_count} licenses from partner {partner_id} "
            f"to customer {customer_id} using template {license_template_id}"
        )

        # Validate inputs
        if license_count < 1:
            raise ValueError(f"Invalid license_count: {license_count} (must be >= 1)")

        # Convert IDs to UUIDs
        try:
            partner_uuid = UUID(partner_id) if isinstance(partner_id, str) else UUID(str(partner_id))
            customer_uuid = UUID(customer_id) if isinstance(customer_id, str) else UUID(str(customer_id))
            template_uuid = UUID(license_template_id) if isinstance(license_template_id, str) else UUID(str(license_template_id))
        except (ValueError, AttributeError) as e:
            raise ValueError(f"Invalid ID format: {e}") from e

        try:
            # Check partner quota using partner workflow service
            from ..partner_management.workflow_service import PartnerService as PartnerWorkflowService

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
                license_metadata.update({
                    "partner_id": str(partner_uuid),
                    "partner_allocated": True,
                    "allocation_index": i + 1,
                    "allocation_count": license_count,
                    "allocated_at": datetime.now(UTC).isoformat(),
                })

                # Issue license using the existing method
                license_info = await self.issue_license(
                    customer_id=customer_uuid,
                    license_template_id=template_uuid,
                    tenant_id=tenant_id,
                )

                # Update license metadata to include partner info
                from .models import License

                license_result = await self.db.execute(
                    select(License).where(License.id == license_info["license_id"])
                )
                license_obj = license_result.scalar_one()
                license_obj.extra_data = {
                    **license_obj.extra_data,
                    **license_metadata,
                }

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

        except ValueError:
            raise
        except Exception as e:
            logger.error(f"Error allocating licenses from partner: {e}", exc_info=True)
            await self.db.rollback()
            raise RuntimeError(f"Failed to allocate licenses from partner: {e}") from e
