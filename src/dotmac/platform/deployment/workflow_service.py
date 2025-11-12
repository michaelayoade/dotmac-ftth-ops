"""
Deployment Workflow Service

Provides workflow-compatible methods for deployment and provisioning operations.
"""

import logging
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.settings import settings

from .models import DeploymentBackend, DeploymentTemplate
from .schemas import ProvisionRequest
from .service import DeploymentService

logger = logging.getLogger(__name__)


def _format_url(template: str, **values: Any) -> str:
    """Render simple string templates with fallbacks."""
    try:
        return template.format(**values)
    except (KeyError, ValueError):
        return template


class WorkflowDeploymentService:
    """
    Deployment service for workflow integration.

    Wraps DeploymentService with workflow-compatible methods.
    """

    def __init__(self, db: AsyncSession):
        self.db = db
        # Note: DeploymentService expects sync Session, we'll handle async conversion
        self.deployment_service = None  # Will be created per operation if needed

    async def provision_tenant(
        self,
        customer_id: int | str,
        license_key: str,
        deployment_type: str,
        tenant_id: int,
        environment: str = "production",
        region: str | None = None,
        config: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """
        Provision a new tenant instance for a customer.

        This method provisions a complete tenant environment using the deployment
        orchestration system. It creates infrastructure, deploys services, and
        configures endpoints based on the specified deployment template.

        Args:
            customer_id: Customer ID (UUID or integer)
            license_key: License key for the tenant
            deployment_type: Type of deployment (e.g., "kubernetes", "docker_compose")
            tenant_id: Tenant ID (integer)
            environment: Environment name (default: "production")
            region: Geographic region (e.g., "us-east-1", "eu-west-1")
            config: Custom configuration overrides

        Returns:
            Dict with deployment details:
            {
                "tenant_url": "https://tenant-123.example.com",
                "tenant_id": 123,
                "deployment_id": 456,
                "instance_id": 789,
                "deployment_type": "kubernetes",
                "license_key": "XXXX-XXXX-...",
                "status": "provisioning" | "active" | "failed",
                "endpoints": {"api": "...", "ui": "...", "db": "..."},
                "namespace": "tenant-123-prod",
                "cluster_name": "main-cluster",
                "backend_job_id": "helm-release-123",
                "version": "1.0.0",
                "environment": "production",
                "region": "us-east-1",
                "allocated_resources": {
                    "cpu": 4,
                    "memory_gb": 16,
                    "storage_gb": 100
                }
            }

        Raises:
            ValueError: If template not found or invalid configuration
            RuntimeError: If provisioning fails
        """
        logger.info(
            f"Provisioning tenant for customer {customer_id}, "
            f"type {deployment_type}, tenant_id {tenant_id}"
        )

        # Convert customer_id and tenant_id to integers
        customer_id_int = int(customer_id) if isinstance(customer_id, str) else customer_id
        tenant_id_int = int(tenant_id) if isinstance(tenant_id, str) else tenant_id

        # Map deployment_type string to DeploymentBackend enum
        backend_map = {
            "kubernetes": DeploymentBackend.KUBERNETES,
            "k8s": DeploymentBackend.KUBERNETES,
            "awx": DeploymentBackend.AWX_ANSIBLE,
            "awx_ansible": DeploymentBackend.AWX_ANSIBLE,
            "ansible": DeploymentBackend.AWX_ANSIBLE,
            "docker_compose": DeploymentBackend.DOCKER_COMPOSE,
            "docker": DeploymentBackend.DOCKER_COMPOSE,
            "terraform": DeploymentBackend.TERRAFORM,
            "tf": DeploymentBackend.TERRAFORM,
            "manual": DeploymentBackend.MANUAL,
        }

        backend = backend_map.get(deployment_type.lower())
        if not backend:
            raise ValueError(
                f"Invalid deployment_type '{deployment_type}'. "
                f"Must be one of: {list(backend_map.keys())}"
            )

        # Find active template for this backend
        result = await self.db.execute(
            select(DeploymentTemplate)
            .where(
                DeploymentTemplate.backend == backend,
                DeploymentTemplate.is_active == True,  # noqa: E712
            )
            .order_by(DeploymentTemplate.created_at.desc())
        )
        template = result.scalar_one_or_none()

        if not template:
            raise ValueError(f"No active deployment template found for backend '{deployment_type}'")

        logger.info(
            f"Using deployment template: {template.name} "
            f"(v{template.version}, backend={template.backend.value})"
        )

        # Build configuration
        provision_config = config or {}
        provision_config.update(
            {
                "customer_id": customer_id_int,
                "license_key": license_key,
                "tenant_name": f"tenant-{tenant_id_int}",
                "tenant_subdomain": f"tenant-{tenant_id_int}",
            }
        )

        # Merge with template defaults
        if template.default_config:
            for key, value in template.default_config.items():
                if key not in provision_config:
                    provision_config[key] = value

        # Create provision request
        provision_request = ProvisionRequest(
            template_id=template.id,
            environment=environment,
            region=region,
            config=provision_config,
            allocated_cpu=template.cpu_cores,
            allocated_memory_gb=template.memory_gb,
            allocated_storage_gb=template.storage_gb,
            tags={
                "customer_id": str(customer_id_int),
                "license_key": license_key,
                "provisioned_by": "workflow",
            },
            notes=f"Provisioned for customer {customer_id_int} via workflow",
        )

        # Execute provisioning via DeploymentService
        # Note: DeploymentService.provision_deployment is async
        try:
            # Create deployment service instance
            # Note: In production, you might need to handle sync/async session conversion
            # For now, we'll create a temporary approach

            # Get sync session for DeploymentService
            # Since we're in async context, we'll use the async session directly
            # and let SQLAlchemy handle it
            deployment_service = DeploymentService(self.db)
            instance, execution = await deployment_service.provision_deployment(
                tenant_id=tenant_id_int,
                request=provision_request,
                triggered_by=None,  # System-generated
                secrets={"license_key": license_key},
            )

            logger.info(
                f"Deployment provisioned: instance_id={instance.id}, "
                f"state={instance.state.value}, execution_id={execution.id}"
            )

            # Build tenant URL from endpoints
            tenant_url = _format_url(
                settings.urls.tenant_url_template,
                tenant_id=tenant_id_int,
                tenant=str(tenant_id_int),
            )
            if instance.endpoints and "ui" in instance.endpoints:
                tenant_url = instance.endpoints["ui"]
            elif instance.endpoints and "api" in instance.endpoints:
                tenant_url = instance.endpoints["api"]

            # Return workflow-compatible response
            return {
                "tenant_url": tenant_url,
                "tenant_id": tenant_id_int,
                "deployment_id": template.id,
                "instance_id": instance.id,
                "execution_id": execution.id,
                "deployment_type": deployment_type,
                "backend": template.backend.value,
                "license_key": license_key,
                "status": instance.state.value,
                "endpoints": instance.endpoints or {},
                "namespace": instance.namespace,
                "cluster_name": instance.cluster_name,
                "backend_job_id": instance.backend_job_id,
                "version": instance.version,
                "environment": instance.environment,
                "region": instance.region,
                "allocated_resources": {
                    "cpu": instance.allocated_cpu,
                    "memory_gb": instance.allocated_memory_gb,
                    "storage_gb": instance.allocated_storage_gb,
                },
                "health_check_url": instance.health_check_url,
                "provisioned_at": instance.created_at.isoformat(),
            }

        except ValueError as e:
            logger.error(f"Validation error provisioning tenant: {e}")
            raise

        except Exception as e:
            logger.error(f"Error provisioning tenant: {e}", exc_info=True)
            raise RuntimeError(f"Failed to provision tenant: {e}") from e

    async def schedule_deployment(
        self,
        order_id: int | str,
        customer_id: int | str,
        priority: str,
        scheduled_date: str | None = None,
    ) -> dict[str, Any]:
        """
        Schedule a deployment for an order.

        This method creates a deployment schedule record and queues the deployment
        job for execution at the specified date/time. It integrates with the
        DeploymentService scheduling system.

        Args:
            order_id: Order ID
            customer_id: Customer ID
            priority: Priority level ("high", "normal", "low")
            scheduled_date: ISO format date/time for deployment (optional, defaults to immediate)

        Returns:
            Dict with deployment_schedule_id, order_id, status, scheduled_date

        Raises:
            ValueError: If priority is invalid or scheduled_date is malformed
            RuntimeError: If deployment scheduling fails
        """
        from datetime import datetime, timedelta

        logger.info(
            "Scheduling deployment for order",
            extra={
                "order_id": order_id,
                "customer_id": customer_id,
                "priority": priority,
                "scheduled_date": scheduled_date,
            },
        )

        try:
            # Validate priority
            valid_priorities = ["high", "normal", "low"]
            if priority not in valid_priorities:
                raise ValueError(f"Invalid priority: {priority}. Must be one of {valid_priorities}")

            # Parse scheduled date or default to 1 hour from now
            if scheduled_date:
                try:
                    scheduled_at = datetime.fromisoformat(scheduled_date.replace("Z", "+00:00"))
                except ValueError as e:
                    raise ValueError(f"Invalid scheduled_date format: {e}")
            else:
                # Default to 1 hour from now for immediate deployments
                scheduled_at = datetime.utcnow() + timedelta(hours=1)

            # Validate scheduled time is in the future
            if scheduled_at <= datetime.utcnow():
                raise ValueError("scheduled_date must be in the future")

            # Retrieve customer to get tenant_id
            from dotmac.platform.customer_management.service import CustomerService

            customer_service = CustomerService(self.db)
            customer = await customer_service.get_customer(int(customer_id))
            if customer is None:
                raise ValueError(f"Customer {customer_id} not found")
            tenant_id = customer.tenant_id

            # Create deployment schedule using DeploymentService
            # We'll use the 'provision' operation as default for order deployments
            schedule_result = await self.deployment_service.schedule_deployment(
                tenant_id=tenant_id,
                operation="provision",
                scheduled_at=scheduled_at,
                provision_request=None,  # Will be populated from order details when executed
                instance_id=None,
                triggered_by=None,  # System-triggered
                metadata={
                    "order_id": str(order_id),
                    "customer_id": str(customer_id),
                    "priority": priority,
                    "workflow": "deployment_workflow",
                },
            )

            logger.info(
                "Deployment scheduled successfully",
                extra={
                    "schedule_id": schedule_result["schedule_id"],
                    "order_id": order_id,
                    "scheduled_at": scheduled_at.isoformat(),
                },
            )

            return {
                "deployment_schedule_id": schedule_result["schedule_id"],
                "order_id": str(order_id),
                "customer_id": str(customer_id),
                "priority": priority,
                "scheduled_date": scheduled_at.isoformat(),
                "status": "scheduled",
                "schedule_type": schedule_result["schedule_type"],
            }

        except ValueError:
            # Re-raise validation errors
            raise
        except Exception as e:
            logger.error(
                "Failed to schedule deployment",
                extra={
                    "order_id": order_id,
                    "customer_id": customer_id,
                    "error": str(e),
                },
            )
            raise RuntimeError(f"Failed to schedule deployment: {e}") from e

    async def provision_partner_tenant(
        self,
        customer_id: int | str,
        partner_id: int | str,
        license_key: str,
        deployment_type: str,
        white_label_config: dict[str, Any] | None = None,
        tenant_id: int | None = None,
        environment: str = "production",
        region: str | None = None,
    ) -> dict[str, Any]:
        """
        Provision a white-labeled tenant for a partner's customer.

        This method provisions a tenant instance with partner-specific
        white-label branding and configuration. The deployment uses the
        standard provisioning flow but applies partner branding and settings.

        Args:
            customer_id: Customer ID (UUID or string)
            partner_id: Partner ID (UUID or string)
            license_key: License key for the tenant
            deployment_type: Deployment backend type (kubernetes, docker_compose, etc)
            white_label_config: White-label configuration:
                - company_name: Partner's branding name
                - logo_url: Partner logo URL
                - primary_color: Primary brand color (hex)
                - secondary_color: Secondary brand color (hex)
                - custom_domain: Custom domain (optional)
                - support_email: Partner support email
                - support_phone: Partner support phone
            tenant_id: Tenant ID (integer)
            environment: Environment (production, staging, development)
            region: Deployment region (optional)

        Returns:
            Dict with tenant provisioning details:
            {
                "tenant_url": str,  # Tenant access URL
                "tenant_id": int,  # Tenant ID
                "instance_id": str,  # Deployment instance UUID
                "deployment_type": str,  # Backend type
                "partner_id": str,  # Partner UUID
                "white_label_applied": bool,  # Whether branding applied
                "custom_domain": str,  # Custom domain (if configured)
                "status": str,  # Provisioning status
                "allocated_resources": dict,  # Resource allocation
                "endpoints": dict,  # Service endpoints
            }

        Raises:
            ValueError: If partner/customer not found or invalid configuration
            RuntimeError: If provisioning fails
        """
        from uuid import UUID

        logger.info(
            f"Provisioning partner tenant for customer {customer_id}, "
            f"partner {partner_id}, deployment_type {deployment_type}"
        )

        # Convert IDs to appropriate types
        try:
            partner_uuid = (
                UUID(partner_id) if isinstance(partner_id, str) else UUID(str(partner_id))
            )
            customer_uuid = (
                UUID(customer_id) if isinstance(customer_id, str) else UUID(str(customer_id))
            )
        except (ValueError, AttributeError) as e:
            raise ValueError(f"Invalid ID format: {e}") from e

        try:
            # Verify partner exists and is active
            from sqlalchemy import select

            from ..partner_management.models import Partner, PartnerAccount, PartnerStatus

            partner_result = await self.db.execute(
                select(Partner).where(
                    Partner.id == partner_uuid,
                    Partner.deleted_at.is_(None),
                )
            )
            partner = partner_result.scalar_one_or_none()

            if not partner:
                raise ValueError(f"Partner not found: {partner_id}")

            if partner.status != PartnerStatus.ACTIVE:
                raise ValueError(
                    f"Partner {partner_id} is not active (status: {partner.status.value})"
                )

            # Verify customer belongs to partner
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

            # Use tenant_id from partner if not provided
            if not tenant_id:
                tenant_id = int(partner.tenant_id) if partner.tenant_id.isdigit() else None

            # Build white-label configuration
            white_label = white_label_config or {}

            # Apply partner branding defaults if not provided
            if "company_name" not in white_label:
                white_label["company_name"] = partner.company_name
            if "support_email" not in white_label:
                white_label["support_email"] = partner.support_email or partner.primary_email
            if "support_phone" not in white_label:
                white_label["support_phone"] = partner.phone

            # Build deployment configuration with white-label settings
            partner_config = {
                "white_label": white_label,
                "partner_id": str(partner_uuid),
                "partner_name": partner.company_name,
                "engagement_type": partner_account.engagement_type,
                "partner_support": {
                    "email": white_label.get("support_email"),
                    "phone": white_label.get("support_phone"),
                },
            }

            # Use standard provisioning with partner configuration
            tenant_info = await self.provision_tenant(
                customer_id=customer_uuid,
                license_key=license_key,
                deployment_type=deployment_type,
                tenant_id=tenant_id,
                environment=environment,
                region=region,
                config=partner_config,
            )

            # Generate tenant URL (use custom domain if provided)
            custom_domain = white_label.get("custom_domain")
            if custom_domain:
                tenant_url = f"https://{custom_domain}"
            else:
                # Generate subdomain based on partner and customer
                subdomain = f"{partner.partner_number.lower()}-{customer_uuid.hex[:8]}"
                tenant_url = _format_url(
                    settings.urls.partner_subdomain_template,
                    subdomain=subdomain,
                    partner_number=partner.partner_number,
                    customer_hash=customer_uuid.hex[:8],
                )

            # Update tenant_info with partner-specific details
            tenant_info.update(
                {
                    "partner_id": str(partner_uuid),
                    "partner_number": partner.partner_number,
                    "partner_name": partner.company_name,
                    "white_label_applied": True,
                    "white_label_config": white_label,
                    "custom_domain": custom_domain,
                    "engagement_type": partner_account.engagement_type,
                }
            )

            # If custom_domain provided, override tenant_url
            if custom_domain:
                tenant_info["tenant_url"] = tenant_url

            logger.info(
                f"Partner tenant provisioned successfully: tenant={tenant_info['tenant_id']}, "
                f"partner={partner_id}, customer={customer_id}, "
                f"white_label={bool(white_label)}"
            )

            return tenant_info

        except ValueError:
            raise
        except Exception as e:
            logger.error(f"Error provisioning partner tenant: {e}", exc_info=True)
            raise RuntimeError(f"Failed to provision partner tenant: {e}") from e
