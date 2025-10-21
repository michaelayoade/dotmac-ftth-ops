"""
Service Registry for Workflow Engine

Provides dependency injection and service location for workflow steps.
"""

import logging
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


class ServiceRegistry:
    """
    Registry for platform services used by workflow engine.

    This enables workflows to call other platform services (CRM, billing, etc.)
    without tight coupling.
    """

    def __init__(self, db_session: AsyncSession):
        self.db = db_session
        self._services: dict[str, Any] = {}
        self._service_factories: dict[str, Any] = {}

    def register_service(self, name: str, service: Any) -> None:
        """
        Register a service instance.

        Args:
            name: Service name (e.g., "customer_service", "billing_service")
            service: Service instance
        """
        self._services[name] = service
        logger.debug(f"Registered service: {name}")

    def register_factory(self, name: str, factory: Any) -> None:
        """
        Register a service factory function.

        Args:
            name: Service name
            factory: Callable that returns service instance (receives db_session)
        """
        self._service_factories[name] = factory
        logger.debug(f"Registered service factory: {name}")

    def get_service(self, name: str) -> Any:
        """
        Get a service instance by name.

        Args:
            name: Service name

        Returns:
            Service instance

        Raises:
            ValueError: If service not found
        """
        # Check if service instance already exists
        if name in self._services:
            return self._services[name]

        # Check if factory exists and create instance
        if name in self._service_factories:
            factory = self._service_factories[name]
            service = factory(self.db)
            self._services[name] = service
            return service

        raise ValueError(f"Service not found: {name}")

    def has_service(self, name: str) -> bool:
        """
        Check if a service is registered.

        Args:
            name: Service name

        Returns:
            True if service is registered
        """
        return name in self._services or name in self._service_factories


def create_default_registry(db_session: AsyncSession) -> ServiceRegistry:
    """
    Create a service registry with default platform services.

    Args:
        db_session: Database session

    Returns:
        ServiceRegistry instance with common services registered
    """
    registry = ServiceRegistry(db_session)

    # Register service factories for lazy initialization
    # These will be created on-demand when first requested

    # Customer Management - Workflow Adapter
    def customer_service_factory(db: AsyncSession) -> Any:
        from ..customer_management.workflow_service import CustomerService

        return CustomerService(db)

    registry.register_factory("customer_service", customer_service_factory)

    # CRM (Leads, Quotes, Site Surveys) - Workflow Adapter
    def crm_service_factory(db: AsyncSession) -> Any:
        from ..crm.workflow_service import CRMService

        return CRMService(db)

    registry.register_factory("crm_service", crm_service_factory)

    # Billing & Subscriptions - Workflow Adapter
    def billing_service_factory(db: AsyncSession) -> Any:
        from ..billing.workflow_service import BillingService

        return BillingService(db)

    registry.register_factory("billing_service", billing_service_factory)

    # License Management - Workflow Adapter
    def license_service_factory(db: AsyncSession) -> Any:
        from ..licensing.workflow_service import LicenseService

        return LicenseService(db)

    registry.register_factory("license_service", license_service_factory)

    # Deployment Orchestration - Workflow Adapter
    def deployment_service_factory(db: AsyncSession) -> Any:
        from ..deployment.workflow_service import WorkflowDeploymentService

        return WorkflowDeploymentService(db)

    registry.register_factory("deployment_service", deployment_service_factory)

    # Communications (Email, SMS) - Workflow Adapter
    def communications_service_factory(db: AsyncSession) -> Any:
        from ..communications.workflow_service import CommunicationsService

        return CommunicationsService(db)

    registry.register_factory("communications_service", communications_service_factory)

    # Ticketing - Workflow Adapter
    def ticketing_service_factory(db: AsyncSession) -> Any:
        from ..ticketing.workflow_service import TicketingService

        return TicketingService(db)

    registry.register_factory("ticketing_service", ticketing_service_factory)

    # Partner Management - Workflow Adapter
    def partner_service_factory(db: AsyncSession) -> Any:
        from ..partner_management.workflow_service import PartnerService

        return PartnerService(db)

    registry.register_factory("partner_service", partner_service_factory)

    # Sales/Orders - Workflow Adapter
    def sales_service_factory(db: AsyncSession) -> Any:
        from ..sales.workflow_service import SalesService

        return SalesService(db)

    registry.register_factory("sales_service", sales_service_factory)

    # Notifications - Workflow Adapter
    def notifications_service_factory(db: AsyncSession) -> Any:
        from ..notifications.workflow_service import NotificationsService

        return NotificationsService(db)

    registry.register_factory("notifications_service", notifications_service_factory)

    # ISP-specific services

    # Network Resource Management - Workflow Adapter (NEW)
    def network_service_factory(db: AsyncSession) -> Any:
        from ..network.workflow_service import NetworkService

        return NetworkService(db)

    registry.register_factory("network_service", network_service_factory)

    # RADIUS Management - Workflow Adapter
    def radius_service_factory(db: AsyncSession) -> Any:
        from ..radius.workflow_service import RADIUSService

        return RADIUSService(db)

    registry.register_factory("radius_service", radius_service_factory)

    # GenieACS (CPE Management) - Workflow Adapter
    def genieacs_service_factory(db: AsyncSession) -> Any:
        from ..genieacs.workflow_service import GenieACSService

        return GenieACSService(db)

    registry.register_factory("genieacs_service", genieacs_service_factory)

    logger.info("Service registry initialized with default services")
    return registry


class WorkflowEngineWithRegistry:
    """
    Extended workflow engine that includes service registry support.

    This wraps the base WorkflowEngine and overrides _get_service to use the registry.
    """

    def __init__(
        self,
        engine: Any,  # WorkflowEngine instance
        registry: ServiceRegistry,
    ):
        self.engine = engine
        self.registry = registry

    async def _get_service(self, service_name: str) -> Any:
        """
        Get service from registry for workflow execution.

        Args:
            service_name: Name of service to retrieve

        Returns:
            Service instance

        Raises:
            ValueError: If service not found
        """
        try:
            service = self.registry.get_service(service_name)
            if service is None:
                raise ValueError(f"Service {service_name} returned None")
            return service
        except Exception as e:
            logger.error(f"Failed to get service {service_name}: {e}")
            raise

    def __getattr__(self, name: str) -> Any:
        """Delegate all other attributes to the underlying engine."""
        return getattr(self.engine, name)
