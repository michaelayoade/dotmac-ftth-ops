"""Plugin interfaces and base classes."""

from __future__ import annotations

from abc import ABC, abstractmethod
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from .schema import PluginConfig, PluginHealthCheck, PluginTestResult

ZERO_UUID = UUID(int=0)


class PluginProvider(ABC):
    """Base class for plugin providers."""

    @abstractmethod
    def get_config_schema(self) -> PluginConfig:
        """
        Return the plugin's configuration schema.

        Returns:
            PluginConfig: Schema describing configuration fields
        """
        pass

    @abstractmethod
    async def configure(self, config: dict[str, Any]) -> bool:
        """
        Configure the plugin with provided settings.

        Args:
            config: Configuration values

        Returns:
            bool: True if configuration successful
        """
        pass

    async def health_check(self) -> PluginHealthCheck:
        """
        Perform a health check of the plugin.

        Returns:
            PluginHealthCheck: Health status result
        """
        return PluginHealthCheck(
            plugin_instance_id=ZERO_UUID,
            status="unknown",
            message="Health check not implemented",
            details={},
            timestamp=datetime.now(UTC).isoformat(),
            response_time_ms=None,
        )

    async def test_connection(self, config: dict[str, Any]) -> PluginTestResult:
        """
        Test connection with the provided configuration.

        Args:
            config: Configuration to test

        Returns:
            PluginTestResult: Test result
        """
        return PluginTestResult(
            success=False,
            message="Connection test not implemented",
            details={},
            timestamp=datetime.now(UTC).isoformat(),
            response_time_ms=None,
        )


class NotificationProvider(PluginProvider):
    """Base class for notification providers."""

    @abstractmethod
    async def send_notification(
        self,
        recipient: str,
        message: str,
        subject: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> bool:
        """
        Send a notification.

        Args:
            recipient: Notification recipient
            message: Message content
            subject: Optional subject/title
            metadata: Additional metadata

        Returns:
            bool: True if sent successfully
        """
        pass


class PaymentProvider(PluginProvider):
    """Base class for payment providers."""

    @abstractmethod
    async def process_payment(
        self,
        amount: float,
        currency: str,
        payment_method: str,
        metadata: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """
        Process a payment.

        Args:
            amount: Payment amount
            currency: Currency code
            payment_method: Payment method identifier
            metadata: Additional payment metadata

        Returns:
            Dict with payment result details
        """
        pass


class StorageProvider(PluginProvider):
    """Base class for storage providers."""

    @abstractmethod
    async def store_file(
        self, key: str, content: bytes, metadata: dict[str, Any] | None = None
    ) -> str:
        """
        Store a file.

        Args:
            key: File key/path
            content: File content
            metadata: File metadata

        Returns:
            str: Storage URL or identifier
        """
        pass

    @abstractmethod
    async def retrieve_file(self, key: str) -> bytes:
        """
        Retrieve a file.

        Args:
            key: File key/path

        Returns:
            bytes: File content
        """
        pass


class SearchProvider(PluginProvider):
    """Base class for search providers."""

    @abstractmethod
    async def index_document(self, index: str, doc_id: str, document: dict[str, Any]) -> bool:
        """
        Index a document.

        Args:
            index: Index name
            doc_id: Document ID
            document: Document data

        Returns:
            bool: True if indexed successfully
        """
        pass

    @abstractmethod
    async def search_documents(
        self, index: str, query: str, limit: int = 10
    ) -> list[dict[str, Any]]:
        """
        Search for documents.

        Args:
            index: Index name
            query: Search query
            limit: Maximum results

        Returns:
            List of matching documents
        """
        pass


class AuthenticationProvider(PluginProvider):
    """Base class for authentication providers."""

    @abstractmethod
    async def authenticate_user(self, credentials: dict[str, Any]) -> dict[str, Any] | None:
        """
        Authenticate a user.

        Args:
            credentials: User credentials

        Returns:
            User info if authenticated, None otherwise
        """
        pass


class IntegrationProvider(PluginProvider):
    """Base class for general integration providers."""

    @abstractmethod
    async def execute_action(self, action: str, params: dict[str, Any]) -> dict[str, Any]:
        """
        Execute an integration action.

        Args:
            action: Action name
            params: Action parameters

        Returns:
            Dict with action result
        """
        pass


class AnalyticsProvider(PluginProvider):
    """Base class for analytics providers."""

    @abstractmethod
    async def track_event(self, event: str, properties: dict[str, Any]) -> bool:
        """
        Track an analytics event.

        Args:
            event: Event name
            properties: Event properties

        Returns:
            bool: True if tracked successfully
        """
        pass


class WorkflowProvider(PluginProvider):
    """Base class for workflow providers."""

    @abstractmethod
    async def execute_workflow(self, workflow_id: str, inputs: dict[str, Any]) -> dict[str, Any]:
        """
        Execute a workflow.

        Args:
            workflow_id: Workflow identifier
            inputs: Workflow inputs

        Returns:
            Dict with workflow result
        """
        pass


class PluginInterface(ABC):
    """Interface for plugin modules."""

    @abstractmethod
    def register(self) -> PluginProvider:
        """
        Register the plugin and return its provider instance.

        Returns:
            PluginProvider: The plugin provider instance
        """
        pass

    @abstractmethod
    def get_name(self) -> str:
        """
        Get the plugin name.

        Returns:
            str: Plugin name
        """
        pass

    @abstractmethod
    def get_version(self) -> str:
        """
        Get the plugin version.

        Returns:
            str: Plugin version
        """
        pass


# Provider type mapping
PROVIDER_TYPE_MAP = {
    "notification": NotificationProvider,
    "payment": PaymentProvider,
    "storage": StorageProvider,
    "search": SearchProvider,
    "authentication": AuthenticationProvider,
    "integration": IntegrationProvider,
    "analytics": AnalyticsProvider,
    "workflow": WorkflowProvider,
}
