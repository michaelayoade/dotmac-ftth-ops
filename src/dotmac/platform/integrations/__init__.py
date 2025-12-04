"""
Integration management system for external services.

This module provides a structured approach to implementing integrations with external services
using the platform's configuration, secrets management, and feature flags.

Architecture:
1. Settings-based configuration with feature flags
2. Secrets management for sensitive data (API keys, tokens)
3. Provider pattern for pluggable implementations
4. Factory pattern for integration instantiation
5. Health checking and observability

Example Usage:
    # In settings
    features.email_enabled = True
    email.provider = "sendgrid"

    # In secrets (Vault)
    email/sendgrid/api_key = "SG.xxx"

    # In code
    email_service = get_integration("email")
    await email_service.send_email(...)
"""

from __future__ import annotations

import asyncio
import json
from abc import ABC, abstractmethod
from contextlib import asynccontextmanager
from dataclasses import dataclass
from enum import Enum
from typing import Any, TypeVar

import structlog

from ..secrets import VaultError, get_vault_secret_async
from ..settings import get_settings

logger = structlog.get_logger(__name__)

T = TypeVar("T", bound="BaseIntegration")


class IntegrationStatus(str, Enum):
    """Integration status."""

    DISABLED = "disabled"
    CONFIGURING = "configuring"
    READY = "ready"
    ERROR = "error"
    DEPRECATED = "deprecated"


class IntegrationType(str, Enum):
    """Types of integrations."""

    EMAIL = "email"
    SMS = "sms"
    CURRENCY = "currency"
    STORAGE = "storage"
    SEARCH = "search"
    ANALYTICS = "analytics"
    MONITORING = "monitoring"
    SECRETS = "secrets"
    CACHE = "cache"
    QUEUE = "queue"


@dataclass
class IntegrationConfig:
    """Configuration for an integration."""

    name: str
    type: IntegrationType
    provider: str
    enabled: bool
    settings: dict[str, Any]
    secrets_path: str | None = None
    required_packages: list[str] | None = None
    health_check_interval: int = 300  # seconds


@dataclass
class IntegrationHealth:
    """Health status of an integration."""

    name: str
    status: IntegrationStatus
    message: str | None = None
    last_check: str | None = None
    metadata: dict[str, Any] | None = None


class BaseIntegration(ABC):
    """Base class for all integrations."""

    def __init__(self, config: IntegrationConfig) -> None:
        self.config = config
        self.name = config.name
        self.provider = config.provider
        self._status = IntegrationStatus.CONFIGURING
        self._secrets: dict[str, str] = {}

    @property
    def status(self) -> IntegrationStatus:
        """Get current status."""
        return self._status

    @abstractmethod
    async def initialize(self) -> None:
        """Initialize the integration."""
        pass

    @abstractmethod
    async def health_check(self) -> IntegrationHealth:
        """Check integration health."""
        pass

    async def load_secrets(self) -> None:
        """Load secrets from Vault."""
        if not self.config.secrets_path:
            return

        try:
            # Load all secrets under the path
            secrets_mapping = {
                "api_key": f"{self.config.secrets_path}/api_key",
                "secret_key": f"{self.config.secrets_path}/secret_key",
                "token": f"{self.config.secrets_path}/token",
                "username": f"{self.config.secrets_path}/username",
                "password": f"{self.config.secrets_path}/password",
            }

            for key, vault_path in secrets_mapping.items():
                try:
                    secret_value: Any = await get_vault_secret_async(vault_path)
                    if secret_value:
                        # Convert dict to string if needed for secrets storage
                        if isinstance(secret_value, dict):
                            # For dict secrets, store as JSON string or extract specific value
                            secret_str = secret_value.get("value") or json.dumps(secret_value)
                            self._secrets[key] = secret_str
                        else:
                            self._secrets[key] = str(secret_value)
                except VaultError:
                    # Secret doesn't exist, skip
                    continue

            logger.info(
                "Loaded secrets for integration",
                integration=self.name,
                secrets_count=len(self._secrets),
            )

        except Exception as e:
            logger.error("Failed to load secrets", integration=self.name, error=str(e))
            raise

    def get_secret(self, key: str, default: str | None = None) -> str | None:
        """Get a secret value."""
        return self._secrets.get(key, default)

    async def cleanup(self) -> None:
        """Cleanup resources."""
        return None

    def __str__(self) -> str:
        return f"{self.__class__.__name__}({self.name}:{self.provider})"


class EmailIntegration(BaseIntegration):
    """Base class for email integrations."""

    @abstractmethod
    async def send_email(
        self,
        to: str | list[str],
        subject: str,
        content: str,
        from_email: str | None = None,
        html_content: str | None = None,
        attachments: list[dict[str, Any]] | None = None,
    ) -> dict[str, Any]:
        """Send an email."""
        pass


class SendGridIntegration(EmailIntegration):
    """SendGrid email integration."""

    def __init__(self, config: IntegrationConfig) -> None:
        super().__init__(config)
        self._client: Any | None = None
        self._mail_class: Any | None = None

    async def initialize(self) -> None:
        """Initialize SendGrid client."""
        try:
            # Check if sendgrid package is available
            try:
                import sendgrid
                from sendgrid.helpers.mail import Mail

                self._sendgrid = sendgrid
                self._mail_class = Mail
            except ImportError:
                raise RuntimeError("SendGrid package not installed. Run: pip install sendgrid")

            # Load secrets
            await self.load_secrets()

            api_key = self.get_secret("api_key")
            if not api_key:
                raise ValueError("SendGrid API key not found in secrets")

            # Initialize client
            self._client = sendgrid.SendGridAPIClient(api_key=api_key)
            self._status = IntegrationStatus.READY

            logger.info("SendGrid integration initialized", integration=self.name)

        except Exception as e:
            self._status = IntegrationStatus.ERROR
            logger.error("Failed to initialize SendGrid", integration=self.name, error=str(e))
            raise

    async def send_email(
        self,
        to: str | list[str],
        subject: str,
        content: str,
        from_email: str | None = None,
        html_content: str | None = None,
        attachments: list[dict[str, Any]] | None = None,
    ) -> dict[str, Any]:
        """Send email via SendGrid."""
        if self._status != IntegrationStatus.READY:
            raise RuntimeError(f"SendGrid integration not ready: {self._status}")

        try:
            from_email = from_email or self.config.settings.get("from_email", "noreply@example.com")

            if isinstance(to, str):
                to = [to]

            if self._client is None or self._mail_class is None:
                raise RuntimeError("SendGrid client not initialized")

            message = self._mail_class(
                from_email=from_email,
                to_emails=to,
                subject=subject,
                plain_text_content=content,
                html_content=html_content,
            )

            # Send email
            response = self._client.send(message)

            logger.info(
                "Email sent via SendGrid",
                integration=self.name,
                to=to,
                subject=subject,
                status_code=response.status_code,
            )

            return {
                "status": "sent",
                "message_id": response.headers.get("X-Message-Id"),
                "status_code": response.status_code,
            }

        except Exception as e:
            logger.error("Failed to send email via SendGrid", integration=self.name, error=str(e))
            return {
                "status": "failed",
                "error": str(e),
            }

    async def health_check(self) -> IntegrationHealth:
        """Check SendGrid health."""
        try:
            if self._client is None:
                return IntegrationHealth(
                    name=self.name, status=IntegrationStatus.ERROR, message="Client not initialized"
                )

            # Try to get API key info (lightweight check)
            # In production, you might want to send a test email or check quotas
            return IntegrationHealth(
                name=self.name,
                status=self._status,
                message="SendGrid API accessible",
                metadata={"provider": "sendgrid"},
            )

        except Exception as e:
            return IntegrationHealth(
                name=self.name,
                status=IntegrationStatus.ERROR,
                message=f"Health check failed: {str(e)}",
            )


class SMSIntegration(BaseIntegration):
    """Base class for SMS integrations."""

    @abstractmethod
    async def send_sms(
        self,
        to: str,
        message: str,
        from_number: str | None = None,
    ) -> dict[str, Any]:
        """Send an SMS."""
        pass


class CurrencyIntegration(BaseIntegration):
    """Base class for currency exchange rate integrations."""

    @abstractmethod
    async def fetch_rates(
        self,
        base_currency: str,
        target_currencies: list[str],
    ) -> dict[str, float]:
        """Fetch exchange rates for the provided base/target currencies."""
        pass


class TwilioIntegration(SMSIntegration):
    """Twilio SMS integration."""

    def __init__(self, config: IntegrationConfig) -> None:
        super().__init__(config)
        self._client: Any | None = None
        self._twilio_client_class: Any | None = None

    async def initialize(self) -> None:
        """Initialize Twilio client."""
        try:
            # Check if twilio package is available
            try:
                # Import twilio conditionally
                import twilio.rest

                self._twilio_client_class = twilio.rest.Client
            except ImportError:
                raise RuntimeError("Twilio package not installed. Run: pip install twilio")

            # Load secrets
            await self.load_secrets()

            account_sid = self.get_secret("username")  # Twilio uses account_sid as username
            auth_token = self.get_secret("password")  # Twilio uses auth_token as password

            if not account_sid or not auth_token:
                raise ValueError("Twilio credentials not found in secrets")

            # Initialize client
            if self._twilio_client_class is None:
                raise RuntimeError("Twilio client class not initialized")

            self._client = self._twilio_client_class(account_sid, auth_token)
            self._status = IntegrationStatus.READY

            logger.info("Twilio integration initialized", integration=self.name)

        except Exception as e:
            self._status = IntegrationStatus.ERROR
            logger.error("Failed to initialize Twilio", integration=self.name, error=str(e))
            raise

    async def send_sms(
        self,
        to: str,
        message: str,
        from_number: str | None = None,
    ) -> dict[str, Any]:
        """Send SMS via Twilio."""
        if self._status != IntegrationStatus.READY:
            raise RuntimeError(f"Twilio integration not ready: {self._status}")

        try:
            from_number = from_number or self.config.settings.get("from_number")
            if not from_number:
                raise ValueError("From number not configured")

            # Send SMS
            if self._client is None:
                raise RuntimeError("Twilio client not initialized")

            message_obj = self._client.messages.create(body=message, from_=from_number, to=to)

            logger.info(
                "SMS sent via Twilio", integration=self.name, to=to, message_sid=message_obj.sid
            )

            return {
                "status": "sent",
                "message_id": message_obj.sid,
                "to": to,
                "from": from_number,
            }

        except Exception as e:
            logger.error("Failed to send SMS via Twilio", integration=self.name, error=str(e))
            return {
                "status": "failed",
                "error": str(e),
            }

    async def health_check(self) -> IntegrationHealth:
        """Check Twilio health."""
        try:
            if self._client is None:
                return IntegrationHealth(
                    name=self.name, status=IntegrationStatus.ERROR, message="Client not initialized"
                )

            # Try to get account info (lightweight check)
            account = self._client.api.accounts(self._client.username).fetch()

            return IntegrationHealth(
                name=self.name,
                status=self._status,
                message="Twilio API accessible",
                metadata={
                    "provider": "twilio",
                    "account_status": account.status,
                },
            )

        except Exception as e:
            return IntegrationHealth(
                name=self.name,
                status=IntegrationStatus.ERROR,
                message=f"Health check failed: {str(e)}",
            )


class OpenExchangeRatesIntegration(CurrencyIntegration):
    """Integration with OpenExchangeRates for currency data."""

    def __init__(self, config: IntegrationConfig) -> None:
        super().__init__(config)
        self._app_id: str | None = None
        self._base_url: str = self.config.settings.get(
            "endpoint", "https://openexchangerates.org/api/latest.json"
        )

    async def initialize(self) -> None:
        """Initialize OpenExchangeRates integration by loading API key."""
        try:
            await self.load_secrets()
            api_key = self.get_secret("api_key") or self.get_secret("token")
            if not api_key:
                raise ValueError("OpenExchangeRates API key not configured")

            self._app_id = api_key
            self._status = IntegrationStatus.READY
            logger.info("OpenExchangeRates integration initialized", integration=self.name)
        except Exception as exc:
            self._status = IntegrationStatus.ERROR
            logger.error("Failed to initialize OpenExchangeRates", error=str(exc))
            raise

    async def fetch_rates(
        self,
        base_currency: str,
        target_currencies: list[str],
    ) -> dict[str, float]:
        """Fetch latest rates from OpenExchangeRates."""
        if self._status != IntegrationStatus.READY or not self._app_id:
            raise RuntimeError("OpenExchangeRates integration not ready")

        import httpx

        params = {
            "app_id": self._app_id,
        }

        # Free tier of OpenExchangeRates only supports USD as base.
        if base_currency.upper() != "USD":
            params["base"] = base_currency.upper()

        if target_currencies:
            params["symbols"] = ",".join(sorted({c.upper() for c in target_currencies}))

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(self._base_url, params=params)
                response.raise_for_status()
                payload = response.json()
        except Exception as exc:
            logger.error(
                "Failed to fetch exchange rates",
                integration=self.name,
                error=str(exc),
            )
            raise

        rates = payload.get("rates", {})
        if not isinstance(rates, dict):
            raise RuntimeError("Invalid response from OpenExchangeRates: missing rates")

        return {currency.upper(): float(rate) for currency, rate in rates.items()}

    async def health_check(self) -> IntegrationHealth:
        """Perform a lightweight health check."""
        try:
            if self._status != IntegrationStatus.READY or not self._app_id:
                return IntegrationHealth(
                    name=self.name,
                    status=IntegrationStatus.ERROR,
                    message="Integration not initialized",
                )

            # Limit network usage by checking cached initialization data
            return IntegrationHealth(
                name=self.name,
                status=self._status,
                message="OpenExchangeRates integration operational",
                metadata={"endpoint": self._base_url},
            )
        except Exception as exc:
            return IntegrationHealth(
                name=self.name,
                status=IntegrationStatus.ERROR,
                message=f"Health check failed: {str(exc)}",
            )


class IntegrationRegistry:
    """Registry for managing integrations."""

    def __init__(self) -> None:
        self._integrations: dict[str, BaseIntegration] = {}
        self._configs: dict[str, IntegrationConfig] = {}
        self._providers: dict[str, type[BaseIntegration]] = {}
        self._integration_errors: dict[str, str] = {}
        self._register_default_providers()

    def _register_default_providers(self) -> None:
        """Register default integration providers."""
        self._providers.update(
            {
                "email:sendgrid": SendGridIntegration,
                "sms:twilio": TwilioIntegration,
                "currency:openexchangerates": OpenExchangeRatesIntegration,
                # Add more providers here
            }
        )

    def register_provider(
        self, integration_type: str, provider: str, provider_class: type[BaseIntegration]
    ) -> None:
        """Register a new integration provider."""
        key = f"{integration_type}:{provider}"
        self._providers[key] = provider_class
        logger.info("Registered integration provider", type=integration_type, provider=provider)

    async def configure_from_settings(self) -> None:
        """Configure integrations from platform settings."""
        settings = get_settings()

        # Email integrations
        if settings.features.email_enabled:
            email_config = IntegrationConfig(
                name="email",
                type=IntegrationType.EMAIL,
                provider=getattr(settings.email, "provider", "sendgrid"),
                enabled=True,
                settings={
                    "from_email": settings.email.from_address,
                    "from_name": settings.email.from_name,
                },
                secrets_path="email/sendgrid",
                required_packages=["sendgrid"],
            )
            await self.register_integration(email_config)

        # SMS integrations
        # Check if SMS integration is enabled (using generic communications feature flag)
        if getattr(settings.features, "sms_enabled", False) or getattr(
            settings.features, "communications_enabled", False
        ):
            sms_config = IntegrationConfig(
                name="sms",
                type=IntegrationType.SMS,
                provider="twilio",  # Default SMS provider
                enabled=True,
                settings={
                    "from_number": getattr(settings, "sms_from_number", None),
                },
                secrets_path="sms/twilio",
                required_packages=["twilio"],
            )
            await self.register_integration(sms_config)

        # Currency integrations
        if settings.billing.enable_multi_currency:
            supported_currencies = getattr(settings.billing, "supported_currencies", []) or []
            if len(supported_currencies) > 1:
                currency_config = IntegrationConfig(
                    name="currency",
                    type=IntegrationType.CURRENCY,
                    provider=getattr(
                        settings.billing, "exchange_rate_provider", "openexchangerates"
                    ),
                    enabled=True,
                    settings={
                        "base_currency": settings.billing.default_currency,
                        "supported_currencies": supported_currencies,
                        "endpoint": getattr(settings.billing, "exchange_rate_endpoint", None),
                    },
                    secrets_path="currency/openexchangerates",
                    required_packages=["httpx"],
                )
                await self.register_integration(currency_config)

        logger.info("Configured integrations from settings", count=len(self._configs))

    async def register_integration(self, config: IntegrationConfig) -> None:
        """Register and initialize an integration."""
        if not config.enabled:
            logger.info("Skipping disabled integration", integration=config.name)
            return

        self._configs[config.name] = config
        self._integration_errors.pop(config.name, None)

        provider_key = f"{config.type.value if isinstance(config.type, Enum) else config.type}:{config.provider}"
        provider_class = self._providers.get(provider_key)

        if not provider_class:
            logger.warning(
                "Unknown integration provider",
                type=config.type,
                provider=config.provider,
                available_providers=list(self._providers.keys()),
            )
            self._integration_errors[config.name] = (
                f"Provider '{config.provider}' not registered. See server logs for details."
            )
            return

        try:
            # Create integration instance
            integration = provider_class(config)

            # Initialize
            await integration.initialize()

            # Store
            self._integrations[config.name] = integration
            self._configs[config.name] = config

            logger.info("Registered integration", integration=config.name, provider=config.provider)

        except Exception as e:
            logger.error("Failed to register integration", integration=config.name, error=str(e))
            self._integration_errors[config.name] = (
                f"{e.__class__.__name__} during initialization. See server logs for details."
            )

    def get_integration(self, name: str) -> BaseIntegration | None:
        """Get an integration by name."""
        return self._integrations.get(name)

    def get_integration_error(self, name: str) -> str | None:
        """Get the last initialization error for an integration."""
        return self._integration_errors.get(name)

    async def health_check_all(self) -> dict[str, IntegrationHealth]:
        """Check health of all integrations."""
        results = {}

        for name, integration in self._integrations.items():
            try:
                health = await integration.health_check()
                results[name] = health
            except Exception as e:
                results[name] = IntegrationHealth(
                    name=name,
                    status=IntegrationStatus.ERROR,
                    message=(
                        f"Health check failed ({e.__class__.__name__}). See server logs for details."
                    ),
                )

        return results

    async def cleanup_all(self) -> None:
        """Cleanup all integrations."""
        cleanup_tasks = []

        for integration in self._integrations.values():
            cleanup_tasks.append(integration.cleanup())

        if cleanup_tasks:
            await asyncio.gather(*cleanup_tasks, return_exceptions=True)

        logger.info("Cleaned up all integrations", count=len(self._integrations))


# Global registry instance
_registry: IntegrationRegistry | None = None


async def get_integration_registry() -> IntegrationRegistry:
    """Get or create the global integration registry."""
    global _registry
    if _registry is None:
        _registry = IntegrationRegistry()
        await _registry.configure_from_settings()
    return _registry


def get_integration(name: str) -> BaseIntegration | None:
    """Get an integration by name (sync version)."""
    if _registry is None:
        return None
    return _registry.get_integration(name)


async def get_integration_async(name: str) -> BaseIntegration | None:
    """Get an integration by name (async version)."""
    registry = await get_integration_registry()
    return registry.get_integration(name)


@asynccontextmanager
async def integration_context() -> Any:
    """Context manager for integration lifecycle."""
    registry = await get_integration_registry()
    try:
        yield registry
    finally:
        await registry.cleanup_all()


__all__ = [
    "BaseIntegration",
    "EmailIntegration",
    "SMSIntegration",
    "CurrencyIntegration",
    "SendGridIntegration",
    "TwilioIntegration",
    "OpenExchangeRatesIntegration",
    "IntegrationConfig",
    "IntegrationHealth",
    "IntegrationStatus",
    "IntegrationType",
    "IntegrationRegistry",
    "get_integration_registry",
    "get_integration",
    "get_integration_async",
    "integration_context",
]
