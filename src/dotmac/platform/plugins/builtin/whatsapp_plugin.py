"""
WhatsApp Business API Plugin.

Example plugin demonstrating the dynamic configuration system.
This plugin integrates with WhatsApp Business API for notifications.
"""

import logging
from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

import httpx

from ..interfaces import NotificationProvider
from ..schema import (
    FieldSpec,
    FieldType,
    PluginConfig,
    PluginHealthCheck,
    PluginTestResult,
    PluginType,
    SelectOption,
    ValidationRule,
)

logger = logging.getLogger(__name__)


class WhatsAppProvider(NotificationProvider):
    """WhatsApp Business API notification provider."""

    def __init__(self) -> None:
        self.api_token: str | None = None
        self.phone_number: str | None = None
        self.base_url = "https://graph.facebook.com/v18.0"
        self.sandbox_mode = True
        self.webhook_verify_token: str | None = None
        self.business_account_id: str | None = None
        self.configured = False

    def get_config_schema(self) -> PluginConfig:
        """Return the plugin configuration schema."""
        return PluginConfig(
            name="WhatsApp Business",
            type=PluginType.NOTIFICATION,
            version="1.0.0",
            description="Send notifications via WhatsApp Business API using Meta's Graph API",
            author="DotMac Platform",
            homepage="https://developers.facebook.com/docs/whatsapp",
            fields=[
                # Basic Configuration
                FieldSpec(
                    key="phone_number",
                    label="Business Phone Number",
                    type=FieldType.PHONE,
                    description="WhatsApp Business phone number (with country code, e.g., +1234567890)",
                    required=True,
                    placeholder="+1234567890",
                    help_text="Your verified WhatsApp Business phone number",
                    group="Basic Configuration",
                    order=1,
                    pattern=r"^\+[1-9]\d{1,14}$",
                    validation_rules=[
                        ValidationRule(
                            type="pattern",
                            value=r"^\+[1-9]\d{1,14}$",
                            message="Phone number must start with + and country code",
                        )
                    ],
                ),
                FieldSpec(
                    key="api_token",
                    label="API Access Token",
                    type=FieldType.SECRET,
                    description="WhatsApp Business API access token from Meta for Developers",
                    required=True,
                    is_secret=True,
                    help_text="Generate this token from your Meta for Developers dashboard",
                    group="Basic Configuration",
                    order=2,
                    min_length=50,
                ),
                FieldSpec(
                    key="business_account_id",
                    label="WhatsApp Business Account ID",
                    type=FieldType.STRING,
                    description="Your WhatsApp Business Account ID",
                    required=True,
                    help_text="Found in your Meta Business Manager under WhatsApp Business Accounts",
                    group="Basic Configuration",
                    order=3,
                ),
                # Environment Settings
                FieldSpec(
                    key="sandbox_mode",
                    label="Sandbox Mode",
                    type=FieldType.BOOLEAN,
                    description="Use test environment for development",
                    required=False,
                    default=True,
                    help_text="Enable for testing, disable for production",
                    group="Environment",
                    order=1,
                ),
                FieldSpec(
                    key="api_version",
                    label="API Version",
                    type=FieldType.SELECT,
                    description="WhatsApp Business API version to use",
                    required=False,
                    default="v18.0",
                    group="Environment",
                    order=2,
                    options=[
                        SelectOption(
                            value="v18.0",
                            label="v18.0 (Latest)",
                            description="Latest stable version",
                        ),
                        SelectOption(
                            value="v17.0", label="v17.0", description="Previous stable version"
                        ),
                        SelectOption(value="v16.0", label="v16.0", description="Legacy version"),
                    ],
                ),
                # Message Settings
                FieldSpec(
                    key="default_template",
                    label="Default Message Template",
                    type=FieldType.SELECT,
                    description="Default template for notifications",
                    required=False,
                    group="Message Settings",
                    order=1,
                    options=[
                        SelectOption(
                            value="hello_world",
                            label="Hello World",
                            description="Basic greeting template",
                        ),
                        SelectOption(
                            value="custom",
                            label="Custom Template",
                            description="Use custom template",
                        ),
                    ],
                ),
                FieldSpec(
                    key="message_retry_count",
                    label="Message Retry Count",
                    type=FieldType.INTEGER,
                    description="Number of times to retry failed messages",
                    required=False,
                    default=3,
                    min_value=0,
                    max_value=5,
                    group="Message Settings",
                    order=2,
                ),
                FieldSpec(
                    key="message_timeout",
                    label="Message Timeout (seconds)",
                    type=FieldType.INTEGER,
                    description="Timeout for message sending",
                    required=False,
                    default=30,
                    min_value=10,
                    max_value=300,
                    group="Message Settings",
                    order=3,
                ),
                # Webhook Configuration
                FieldSpec(
                    key="webhook_url",
                    label="Webhook URL",
                    type=FieldType.URL,
                    description="URL to receive WhatsApp webhook events",
                    required=False,
                    placeholder="https://your-domain.com/webhook/whatsapp",
                    group="Webhooks",
                    order=1,
                ),
                FieldSpec(
                    key="webhook_verify_token",
                    label="Webhook Verify Token",
                    type=FieldType.SECRET,
                    description="Token for webhook verification",
                    required=False,
                    is_secret=True,
                    group="Webhooks",
                    order=2,
                ),
                # Advanced Settings
                FieldSpec(
                    key="rate_limit_per_second",
                    label="Rate Limit (per second)",
                    type=FieldType.INTEGER,
                    description="Maximum messages per second",
                    required=False,
                    default=10,
                    min_value=1,
                    max_value=100,
                    group="Advanced",
                    order=1,
                ),
                FieldSpec(
                    key="enable_delivery_receipts",
                    label="Enable Delivery Receipts",
                    type=FieldType.BOOLEAN,
                    description="Track message delivery status",
                    required=False,
                    default=True,
                    group="Advanced",
                    order=2,
                ),
                FieldSpec(
                    key="custom_headers",
                    label="Custom Headers",
                    type=FieldType.JSON,
                    description="Additional headers for API requests (JSON format)",
                    required=False,
                    placeholder='{"X-Custom-Header": "value"}',
                    group="Advanced",
                    order=3,
                ),
            ],
            dependencies=["httpx", "pydantic"],
            tags=["messaging", "whatsapp", "notifications", "meta", "business-api"],
            supports_health_check=True,
            supports_test_connection=True,
        )

    async def configure(self, config: dict[str, Any]) -> bool:
        """Configure the WhatsApp provider."""
        try:
            self.phone_number = config.get("phone_number")
            self.api_token = config.get("api_token")
            self.business_account_id = config.get("business_account_id")
            self.sandbox_mode = config.get("sandbox_mode", True)
            self.webhook_verify_token = config.get("webhook_verify_token")

            # Validate required fields
            if not self.phone_number:
                raise ValueError("Phone number is required")
            if not self.api_token:
                raise ValueError("API token is required")
            if not self.business_account_id:
                raise ValueError("Business Account ID is required")

            # Update API base URL based on version
            api_version = config.get("api_version", "v18.0")
            self.base_url = f"https://graph.facebook.com/{api_version}"

            self.configured = True
            logger.info("WhatsApp provider configured successfully")
            return True

        except Exception as e:
            logger.error(f"Failed to configure WhatsApp provider: {e}")
            self.configured = False
            return False

    async def send_notification(
        self,
        recipient: str,
        message: str,
        subject: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> bool:
        """Send a WhatsApp notification."""
        if not self.configured:
            raise RuntimeError("WhatsApp provider not configured")

        try:
            # Prepare message payload
            payload = {
                "messaging_product": "whatsapp",
                "to": recipient,
                "type": "text",
                "text": {"body": message},
            }

            # Add custom headers if configured
            headers = {
                "Authorization": f"Bearer {self.api_token}",
                "Content-Type": "application/json",
            }

            # Send message via WhatsApp Business API
            url = f"{self.base_url}/{self.business_account_id}/messages"

            async with httpx.AsyncClient() as client:
                response = await client.post(url, json=payload, headers=headers)
                response.raise_for_status()

                result = response.json()
                message_id = result.get("messages", [{}])[0].get("id")

                if message_id:
                    logger.info(f"WhatsApp message sent successfully: {message_id}")
                    return True
                else:
                    logger.error(f"Failed to send WhatsApp message: {result}")
                    return False

        except httpx.HTTPError as e:
            logger.error(f"HTTP error sending WhatsApp message: {e}")
            return False
        except Exception as e:
            logger.error(f"Error sending WhatsApp notification: {e}")
            return False

    async def health_check(self) -> PluginHealthCheck:
        """Perform health check of WhatsApp provider."""
        start_time = datetime.now(UTC)

        try:
            if not self.configured:
                return PluginHealthCheck(
                    plugin_instance_id=uuid4(),  # Temporary ID for standalone use
                    status="unhealthy",
                    message="Provider not configured",
                    details={"configured": False},
                    timestamp=start_time.isoformat(),
                    response_time_ms=0,
                )

            # Test API connectivity
            url = f"{self.base_url}/{self.business_account_id}"
            headers = {
                "Authorization": f"Bearer {self.api_token}",
            }

            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(url, headers=headers)
                response.raise_for_status()

                business_info = response.json()

                duration_ms = int((datetime.now(UTC) - start_time).total_seconds() * 1000)

                return PluginHealthCheck(
                    plugin_instance_id=uuid4(),  # Temporary ID for standalone use
                    status="healthy",
                    message="WhatsApp Business API is accessible",
                    details={
                        "business_account_id": self.business_account_id,
                        "phone_number": self.phone_number,
                        "sandbox_mode": self.sandbox_mode,
                        "api_accessible": True,
                        "business_name": business_info.get("name", "Unknown"),
                    },
                    timestamp=datetime.now(UTC).isoformat(),
                    response_time_ms=duration_ms,
                )

        except httpx.HTTPError as e:
            duration_ms = int((datetime.now(UTC) - start_time).total_seconds() * 1000)
            return PluginHealthCheck(
                plugin_instance_id=uuid4(),
                status="unhealthy",
                message=f"API connectivity failed: {str(e)}",
                details={
                    "configured": self.configured,
                    "error": str(e),
                    "api_accessible": False,
                },
                timestamp=datetime.now(UTC).isoformat(),
                response_time_ms=duration_ms,
            )
        except Exception as e:
            duration_ms = int((datetime.now(UTC) - start_time).total_seconds() * 1000)
            return PluginHealthCheck(
                plugin_instance_id=uuid4(),
                status="unhealthy",
                message=f"Health check failed: {str(e)}",
                details={
                    "configured": self.configured,
                    "error": str(e),
                },
                timestamp=datetime.now(UTC).isoformat(),
                response_time_ms=duration_ms,
            )

    async def test_connection(self, config: dict[str, Any]) -> PluginTestResult:
        """Test WhatsApp connection with provided configuration."""
        start_time = datetime.now(UTC)

        try:
            # Temporarily configure with test config
            api_token = config.get("api_token")
            business_account_id = config.get("business_account_id")
            api_version = config.get("api_version", "v18.0")

            if not api_token:
                return PluginTestResult(
                    success=False,
                    message="API token is required",
                    details={"error": "missing_api_token"},
                    timestamp=start_time.isoformat(),
                    response_time_ms=0,
                )

            if not business_account_id:
                return PluginTestResult(
                    success=False,
                    message="Business Account ID is required",
                    details={"error": "missing_business_account_id"},
                    timestamp=start_time.isoformat(),
                    response_time_ms=0,
                )

            # Test API connectivity
            base_url = f"https://graph.facebook.com/{api_version}"
            url = f"{base_url}/{business_account_id}"
            headers = {
                "Authorization": f"Bearer {api_token}",
            }

            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.get(url, headers=headers)
                response.raise_for_status()

                business_info = response.json()

                duration_ms = int((datetime.now(UTC) - start_time).total_seconds() * 1000)
                return PluginTestResult(
                    success=True,
                    message="Connection successful",
                    details={
                        "business_account_id": business_account_id,
                        "business_name": business_info.get("name", "Unknown"),
                        "status": "verified",
                        "api_version": api_version,
                    },
                    timestamp=datetime.now(UTC).isoformat(),
                    response_time_ms=duration_ms,
                )

        except httpx.HTTPStatusError as e:
            duration_ms = int((datetime.now(UTC) - start_time).total_seconds() * 1000)
            error_details: dict[str, Any] = {"status_code": e.response.status_code}
            try:
                error_response = e.response.json()
                error_details.update(error_response)
            except Exception:
                error_details["response_text"] = e.response.text

            return PluginTestResult(
                success=False,
                message=f"API error: {e.response.status_code}",
                details=error_details,
                timestamp=datetime.now(UTC).isoformat(),
                response_time_ms=duration_ms,
            )

        except httpx.RequestError as e:
            duration_ms = int((datetime.now(UTC) - start_time).total_seconds() * 1000)
            return PluginTestResult(
                success=False,
                message=f"Connection failed: {str(e)}",
                details={"error": str(e), "type": "connection_error"},
                timestamp=datetime.now(UTC).isoformat(),
                response_time_ms=duration_ms,
            )

        except Exception as e:
            duration_ms = int((datetime.now(UTC) - start_time).total_seconds() * 1000)
            return PluginTestResult(
                success=False,
                message=f"Test failed: {str(e)}",
                details={"error": str(e), "type": "unexpected_error"},
                timestamp=datetime.now(UTC).isoformat(),
                response_time_ms=duration_ms,
            )


def register() -> WhatsAppProvider:
    """Register the WhatsApp plugin."""
    return WhatsAppProvider()
