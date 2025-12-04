"""
Alert Delivery Plugins for Network Monitoring

Implements AlertDeliveryProvider interface for delivering network alerts via:
- Webhook (generic HTTP POST)
- Slack (using incoming webhooks)
- Email (via SMTP)

These plugins integrate with the network monitoring module to deliver
alerts to external systems when network issues are detected.
"""

from __future__ import annotations

import logging
import smtplib
import ssl
from datetime import UTC, datetime
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Any

from dotmac.platform.plugins.interfaces import AlertDeliveryProvider
from dotmac.platform.plugins.schema import (
    FieldSpec,
    FieldType,
    PluginConfig,
    PluginHealthCheck,
    PluginTestResult,
)

logger = logging.getLogger(__name__)


# =============================================================================
# Webhook Alert Delivery Plugin
# =============================================================================


class WebhookAlertPlugin(AlertDeliveryProvider):
    """
    Webhook-based alert delivery plugin.

    Sends alerts as JSON payloads to configured HTTP endpoints.
    Supports custom headers, authentication, and payload templates.
    """

    def __init__(self) -> None:
        """Initialize webhook plugin."""
        self.webhook_url: str | None = None
        self.auth_header: str | None = None
        self.custom_headers: dict[str, str] = {}
        self.timeout: int = 30
        self.retry_count: int = 3
        self.configured = False

    def get_config_schema(self) -> PluginConfig:
        """Return webhook configuration schema."""
        return PluginConfig(
            plugin_name="webhook_alert",
            display_name="Webhook Alert Delivery",
            description="Deliver network alerts to HTTP webhook endpoints",
            provider_type="alert_delivery",
            version="1.0.0",
            config_schema={
                "webhook_url": {
                    "type": "string",
                    "required": True,
                    "description": "HTTP(S) URL to POST alerts to",
                    "validation": r"^https?://.+",
                },
                "auth_header": {
                    "type": "string",
                    "required": False,
                    "sensitive": True,
                    "description": "Authorization header value (e.g., 'Bearer token123')",
                },
                "custom_headers": {
                    "type": "object",
                    "required": False,
                    "description": "Additional HTTP headers to send",
                },
                "timeout": {
                    "type": "integer",
                    "required": False,
                    "default": 30,
                    "description": "Request timeout in seconds",
                },
                "retry_count": {
                    "type": "integer",
                    "required": False,
                    "default": 3,
                    "description": "Number of retry attempts on failure",
                },
                "payload_template": {
                    "type": "string",
                    "required": False,
                    "description": "Custom JSON template with {alert_*} placeholders",
                },
            },
            fields=[
                FieldSpec(
                    name="webhook_url",
                    field_type=FieldType.URL,
                    label="Webhook URL",
                    description="Endpoint to receive alert notifications",
                    required=True,
                ),
                FieldSpec(
                    name="auth_header",
                    field_type=FieldType.SECRET,
                    label="Authorization Header",
                    description="Bearer token or API key for authentication",
                    required=False,
                ),
            ],
            metadata={
                "supported_methods": ["POST"],
                "content_type": "application/json",
            },
        )

    async def configure(self, config: dict[str, Any]) -> bool:
        """Configure the webhook plugin."""
        webhook_url = config.get("webhook_url")
        if not webhook_url:
            raise ValueError("webhook_url is required")

        if not webhook_url.startswith(("http://", "https://")):
            raise ValueError("webhook_url must be a valid HTTP(S) URL")

        self.webhook_url = webhook_url
        self.auth_header = config.get("auth_header")
        self.custom_headers = config.get("custom_headers", {})
        self.timeout = config.get("timeout", 30)
        self.retry_count = config.get("retry_count", 3)
        self.configured = True

        logger.info(f"Webhook alert plugin configured for: {webhook_url}")
        return True

    async def health_check(self) -> PluginHealthCheck:
        """Check webhook endpoint health."""
        if not self.configured or not self.webhook_url:
            return PluginHealthCheck(
                plugin_instance_id=None,
                status="unhealthy",
                message="Plugin not configured",
                details={"configured": False},
                timestamp=datetime.now(UTC).isoformat(),
                response_time_ms=None,
            )

        try:
            import httpx

            start_time = datetime.now(UTC)

            headers = {"Content-Type": "application/json", **self.custom_headers}
            if self.auth_header:
                headers["Authorization"] = self.auth_header

            # Send a test ping (HEAD or OPTIONS if supported)
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.options(self.webhook_url, headers=headers)

            end_time = datetime.now(UTC)
            response_time_ms = (end_time - start_time).total_seconds() * 1000

            # Accept any 2xx or 405 (Method Not Allowed is ok for OPTIONS)
            if response.status_code < 500:
                return PluginHealthCheck(
                    plugin_instance_id=None,
                    status="healthy",
                    message="Webhook endpoint reachable",
                    details={
                        "url": self.webhook_url,
                        "status_code": response.status_code,
                    },
                    timestamp=datetime.now(UTC).isoformat(),
                    response_time_ms=round(response_time_ms, 2),
                )
            else:
                return PluginHealthCheck(
                    plugin_instance_id=None,
                    status="unhealthy",
                    message=f"Webhook endpoint returned {response.status_code}",
                    details={"status_code": response.status_code},
                    timestamp=datetime.now(UTC).isoformat(),
                    response_time_ms=round(response_time_ms, 2),
                )

        except ImportError:
            return PluginHealthCheck(
                plugin_instance_id=None,
                status="unknown",
                message="httpx library not available",
                details={},
                timestamp=datetime.now(UTC).isoformat(),
                response_time_ms=None,
            )
        except Exception as e:
            return PluginHealthCheck(
                plugin_instance_id=None,
                status="unhealthy",
                message=f"Health check failed: {e}",
                details={"error": str(e)},
                timestamp=datetime.now(UTC).isoformat(),
                response_time_ms=None,
            )

    async def test_connection(self, config: dict[str, Any]) -> PluginTestResult:
        """Test webhook connection."""
        start_time = datetime.now(UTC)

        try:
            await self.configure(config)
            health = await self.health_check()

            end_time = datetime.now(UTC)
            response_time_ms = (end_time - start_time).total_seconds() * 1000

            return PluginTestResult(
                success=health.status == "healthy",
                message=health.message,
                details=health.details or {},
                timestamp=datetime.now(UTC).isoformat(),
                response_time_ms=round(response_time_ms, 2),
            )

        except Exception as e:
            end_time = datetime.now(UTC)
            response_time_ms = (end_time - start_time).total_seconds() * 1000

            return PluginTestResult(
                success=False,
                message=f"Connection test failed: {e}",
                details={"error": str(e)},
                timestamp=datetime.now(UTC).isoformat(),
                response_time_ms=round(response_time_ms, 2),
            )

    async def deliver_alert(
        self,
        alert: dict[str, Any],
        recipients: list[str] | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> bool:
        """
        Deliver alert via webhook POST.

        Args:
            alert: Alert data dictionary
            recipients: Ignored for webhooks (URL is the recipient)
            metadata: Additional metadata to include in payload

        Returns:
            bool: True if delivery successful
        """
        if not self.configured or not self.webhook_url:
            raise RuntimeError("Webhook plugin not configured")

        try:
            import httpx

            headers = {"Content-Type": "application/json", **self.custom_headers}
            if self.auth_header:
                headers["Authorization"] = self.auth_header

            # Build payload
            payload = {
                "event": "network_alert",
                "timestamp": datetime.now(UTC).isoformat(),
                "alert": alert,
                "metadata": metadata or {},
            }

            # Retry logic
            last_error = None
            for attempt in range(self.retry_count):
                try:
                    async with httpx.AsyncClient(timeout=self.timeout) as client:
                        response = await client.post(
                            self.webhook_url,
                            json=payload,
                            headers=headers,
                        )

                    if response.status_code < 300:
                        logger.info(
                            f"Alert delivered via webhook: {alert.get('alert_id')}",
                            extra={"status_code": response.status_code},
                        )
                        return True
                    else:
                        last_error = f"HTTP {response.status_code}: {response.text[:200]}"
                        logger.warning(
                            f"Webhook delivery attempt {attempt + 1} failed: {last_error}"
                        )

                except Exception as e:
                    last_error = str(e)
                    logger.warning(f"Webhook delivery attempt {attempt + 1} error: {e}")

            logger.error(f"Webhook delivery failed after {self.retry_count} attempts: {last_error}")
            return False

        except ImportError:
            logger.error("httpx library not available for webhook delivery")
            return False


# =============================================================================
# Slack Alert Delivery Plugin
# =============================================================================


class SlackAlertPlugin(AlertDeliveryProvider):
    """
    Slack-based alert delivery plugin.

    Uses Slack incoming webhooks to post alerts to channels.
    Supports message formatting, severity colors, and @mentions.
    """

    def __init__(self) -> None:
        """Initialize Slack plugin."""
        self.webhook_url: str | None = None
        self.channel: str | None = None
        self.username: str = "Network Monitor"
        self.icon_emoji: str = ":warning:"
        self.mention_users: list[str] = []
        self.configured = False

    def get_config_schema(self) -> PluginConfig:
        """Return Slack configuration schema."""
        return PluginConfig(
            plugin_name="slack_alert",
            display_name="Slack Alert Delivery",
            description="Deliver network alerts to Slack channels",
            provider_type="alert_delivery",
            version="1.0.0",
            config_schema={
                "webhook_url": {
                    "type": "string",
                    "required": True,
                    "sensitive": True,
                    "description": "Slack incoming webhook URL",
                    "validation": r"^https://hooks\.slack\.com/services/.+",
                },
                "channel": {
                    "type": "string",
                    "required": False,
                    "description": "Override channel (e.g., #alerts)",
                },
                "username": {
                    "type": "string",
                    "required": False,
                    "default": "Network Monitor",
                    "description": "Bot username to display",
                },
                "icon_emoji": {
                    "type": "string",
                    "required": False,
                    "default": ":warning:",
                    "description": "Emoji icon for messages",
                },
                "mention_on_critical": {
                    "type": "array",
                    "required": False,
                    "description": "User IDs to @mention on critical alerts",
                },
            },
            fields=[
                FieldSpec(
                    name="webhook_url",
                    field_type=FieldType.SECRET,
                    label="Webhook URL",
                    description="Slack incoming webhook URL from app settings",
                    required=True,
                ),
                FieldSpec(
                    name="channel",
                    field_type=FieldType.TEXT,
                    label="Channel Override",
                    description="Channel to post to (optional)",
                    required=False,
                    placeholder="#network-alerts",
                ),
            ],
            metadata={
                "provider": "slack",
                "documentation": "https://api.slack.com/messaging/webhooks",
            },
        )

    async def configure(self, config: dict[str, Any]) -> bool:
        """Configure the Slack plugin."""
        webhook_url = config.get("webhook_url")
        if not webhook_url:
            raise ValueError("webhook_url is required")

        if not webhook_url.startswith("https://hooks.slack.com/"):
            raise ValueError("Invalid Slack webhook URL format")

        self.webhook_url = webhook_url
        self.channel = config.get("channel")
        self.username = config.get("username", "Network Monitor")
        self.icon_emoji = config.get("icon_emoji", ":warning:")
        self.mention_users = config.get("mention_on_critical", [])
        self.configured = True

        logger.info("Slack alert plugin configured")
        return True

    async def health_check(self) -> PluginHealthCheck:
        """Check Slack webhook health."""
        if not self.configured or not self.webhook_url:
            return PluginHealthCheck(
                plugin_instance_id=None,
                status="unhealthy",
                message="Plugin not configured",
                details={"configured": False},
                timestamp=datetime.now(UTC).isoformat(),
                response_time_ms=None,
            )

        # Slack webhooks don't support health checks without posting
        # Return healthy if configured
        return PluginHealthCheck(
            plugin_instance_id=None,
            status="healthy",
            message="Slack webhook configured",
            details={"channel": self.channel or "default"},
            timestamp=datetime.now(UTC).isoformat(),
            response_time_ms=None,
        )

    async def test_connection(self, config: dict[str, Any]) -> PluginTestResult:
        """Test Slack connection by sending a test message."""
        start_time = datetime.now(UTC)

        try:
            await self.configure(config)

            import httpx

            test_payload = {
                "text": ":test_tube: DotMac Alert Plugin Test",
                "username": self.username,
                "icon_emoji": ":white_check_mark:",
            }

            if self.channel:
                test_payload["channel"] = self.channel

            async with httpx.AsyncClient(timeout=30) as client:
                response = await client.post(
                    self.webhook_url,  # type: ignore
                    json=test_payload,
                )

            end_time = datetime.now(UTC)
            response_time_ms = (end_time - start_time).total_seconds() * 1000

            if response.status_code == 200 and response.text == "ok":
                return PluginTestResult(
                    success=True,
                    message="Slack test message sent successfully",
                    details={"channel": self.channel or "default"},
                    timestamp=datetime.now(UTC).isoformat(),
                    response_time_ms=round(response_time_ms, 2),
                )
            else:
                return PluginTestResult(
                    success=False,
                    message=f"Slack returned: {response.text}",
                    details={"status_code": response.status_code},
                    timestamp=datetime.now(UTC).isoformat(),
                    response_time_ms=round(response_time_ms, 2),
                )

        except Exception as e:
            end_time = datetime.now(UTC)
            response_time_ms = (end_time - start_time).total_seconds() * 1000

            return PluginTestResult(
                success=False,
                message=f"Connection test failed: {e}",
                details={"error": str(e)},
                timestamp=datetime.now(UTC).isoformat(),
                response_time_ms=round(response_time_ms, 2),
            )

    def _severity_to_color(self, severity: str) -> str:
        """Map alert severity to Slack attachment color."""
        colors = {
            "critical": "#FF0000",  # Red
            "error": "#FF0000",
            "warning": "#FFA500",  # Orange
            "info": "#0000FF",  # Blue
            "notice": "#808080",  # Gray
        }
        return colors.get(severity.lower(), "#808080")

    def _severity_to_emoji(self, severity: str) -> str:
        """Map alert severity to emoji."""
        emojis = {
            "critical": ":rotating_light:",
            "error": ":x:",
            "warning": ":warning:",
            "info": ":information_source:",
            "notice": ":bell:",
        }
        return emojis.get(severity.lower(), ":bell:")

    async def deliver_alert(
        self,
        alert: dict[str, Any],
        recipients: list[str] | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> bool:
        """
        Deliver alert to Slack.

        Args:
            alert: Alert data dictionary
            recipients: Slack user IDs to @mention
            metadata: Additional context

        Returns:
            bool: True if delivery successful
        """
        if not self.configured or not self.webhook_url:
            raise RuntimeError("Slack plugin not configured")

        try:
            import httpx

            severity = alert.get("severity", "warning")
            emoji = self._severity_to_emoji(severity)
            color = self._severity_to_color(severity)

            # Build mentions for critical alerts
            mentions = ""
            if severity.lower() == "critical":
                mention_list = recipients or self.mention_users
                if mention_list:
                    mentions = " " + " ".join(f"<@{uid}>" for uid in mention_list)

            # Build Slack message with attachments
            payload: dict[str, Any] = {
                "username": self.username,
                "icon_emoji": self.icon_emoji,
                "attachments": [
                    {
                        "color": color,
                        "title": f"{emoji} {alert.get('title', 'Network Alert')}",
                        "text": alert.get("description", ""),
                        "fields": [
                            {
                                "title": "Severity",
                                "value": severity.upper(),
                                "short": True,
                            },
                            {
                                "title": "Device",
                                "value": alert.get(
                                    "device_name", alert.get("device_id", "Unknown")
                                ),
                                "short": True,
                            },
                            {
                                "title": "Alert ID",
                                "value": alert.get("alert_id", "N/A"),
                                "short": True,
                            },
                            {
                                "title": "Triggered",
                                "value": alert.get("triggered_at", datetime.now(UTC).isoformat()),
                                "short": True,
                            },
                        ],
                        "footer": "DotMac Network Monitor",
                        "ts": int(datetime.now(UTC).timestamp()),
                    }
                ],
            }

            if mentions:
                payload["text"] = mentions

            if self.channel:
                payload["channel"] = self.channel

            async with httpx.AsyncClient(timeout=30) as client:
                response = await client.post(self.webhook_url, json=payload)

            if response.status_code == 200 and response.text == "ok":
                logger.info(f"Alert delivered to Slack: {alert.get('alert_id')}")
                return True
            else:
                logger.error(f"Slack delivery failed: {response.text}")
                return False

        except ImportError:
            logger.error("httpx library not available for Slack delivery")
            return False
        except Exception as e:
            logger.error(f"Slack delivery error: {e}")
            return False


# =============================================================================
# Email Alert Delivery Plugin
# =============================================================================


class EmailAlertPlugin(AlertDeliveryProvider):
    """
    Email-based alert delivery plugin.

    Sends alerts via SMTP with HTML formatting.
    Supports TLS/SSL, authentication, and multiple recipients.
    """

    def __init__(self) -> None:
        """Initialize email plugin."""
        self.smtp_host: str | None = None
        self.smtp_port: int = 587
        self.smtp_user: str | None = None
        self.smtp_password: str | None = None
        self.use_tls: bool = True
        self.from_email: str | None = None
        self.from_name: str = "Network Monitor"
        self.default_recipients: list[str] = []
        self.configured = False

    def get_config_schema(self) -> PluginConfig:
        """Return email configuration schema."""
        return PluginConfig(
            plugin_name="email_alert",
            display_name="Email Alert Delivery",
            description="Deliver network alerts via email (SMTP)",
            provider_type="alert_delivery",
            version="1.0.0",
            config_schema={
                "smtp_host": {
                    "type": "string",
                    "required": True,
                    "description": "SMTP server hostname",
                },
                "smtp_port": {
                    "type": "integer",
                    "required": False,
                    "default": 587,
                    "description": "SMTP port (587 for TLS, 465 for SSL)",
                },
                "smtp_user": {
                    "type": "string",
                    "required": False,
                    "description": "SMTP authentication username",
                },
                "smtp_password": {
                    "type": "string",
                    "required": False,
                    "sensitive": True,
                    "description": "SMTP authentication password",
                },
                "use_tls": {
                    "type": "boolean",
                    "required": False,
                    "default": True,
                    "description": "Enable TLS encryption",
                },
                "from_email": {
                    "type": "string",
                    "required": True,
                    "description": "Sender email address",
                    "validation": r"^[^@]+@[^@]+\.[^@]+$",
                },
                "from_name": {
                    "type": "string",
                    "required": False,
                    "default": "Network Monitor",
                    "description": "Sender display name",
                },
                "default_recipients": {
                    "type": "array",
                    "required": False,
                    "description": "Default email recipients",
                },
            },
            fields=[
                FieldSpec(
                    name="smtp_host",
                    field_type=FieldType.TEXT,
                    label="SMTP Server",
                    description="SMTP server hostname (e.g., smtp.gmail.com)",
                    required=True,
                ),
                FieldSpec(
                    name="smtp_port",
                    field_type=FieldType.INTEGER,
                    label="SMTP Port",
                    description="SMTP port number",
                    required=False,
                    default_value="587",
                ),
                FieldSpec(
                    name="smtp_user",
                    field_type=FieldType.TEXT,
                    label="Username",
                    description="SMTP authentication username",
                    required=False,
                ),
                FieldSpec(
                    name="smtp_password",
                    field_type=FieldType.SECRET,
                    label="Password",
                    description="SMTP authentication password",
                    required=False,
                ),
                FieldSpec(
                    name="from_email",
                    field_type=FieldType.EMAIL,
                    label="From Email",
                    description="Sender email address",
                    required=True,
                ),
            ],
            metadata={
                "supported_protocols": ["SMTP", "SMTP+TLS", "SMTPS"],
            },
        )

    async def configure(self, config: dict[str, Any]) -> bool:
        """Configure the email plugin."""
        smtp_host = config.get("smtp_host")
        from_email = config.get("from_email")

        if not smtp_host:
            raise ValueError("smtp_host is required")
        if not from_email:
            raise ValueError("from_email is required")

        self.smtp_host = smtp_host
        self.smtp_port = config.get("smtp_port", 587)
        self.smtp_user = config.get("smtp_user")
        self.smtp_password = config.get("smtp_password")
        self.use_tls = config.get("use_tls", True)
        self.from_email = from_email
        self.from_name = config.get("from_name", "Network Monitor")
        self.default_recipients = config.get("default_recipients", [])
        self.configured = True

        logger.info(f"Email alert plugin configured for SMTP: {smtp_host}")
        return True

    async def health_check(self) -> PluginHealthCheck:
        """Check SMTP server health."""
        if not self.configured or not self.smtp_host:
            return PluginHealthCheck(
                plugin_instance_id=None,
                status="unhealthy",
                message="Plugin not configured",
                details={"configured": False},
                timestamp=datetime.now(UTC).isoformat(),
                response_time_ms=None,
            )

        try:
            start_time = datetime.now(UTC)

            # Test SMTP connection
            if self.smtp_port == 465:
                # SSL connection
                context = ssl.create_default_context()
                with smtplib.SMTP_SSL(
                    self.smtp_host, self.smtp_port, context=context, timeout=10
                ) as server:
                    if self.smtp_user and self.smtp_password:
                        server.login(self.smtp_user, self.smtp_password)
            else:
                # TLS connection
                with smtplib.SMTP(self.smtp_host, self.smtp_port, timeout=10) as server:
                    if self.use_tls:
                        server.starttls()
                    if self.smtp_user and self.smtp_password:
                        server.login(self.smtp_user, self.smtp_password)

            end_time = datetime.now(UTC)
            response_time_ms = (end_time - start_time).total_seconds() * 1000

            return PluginHealthCheck(
                plugin_instance_id=None,
                status="healthy",
                message="SMTP connection successful",
                details={
                    "smtp_host": self.smtp_host,
                    "smtp_port": self.smtp_port,
                    "tls_enabled": self.use_tls,
                },
                timestamp=datetime.now(UTC).isoformat(),
                response_time_ms=round(response_time_ms, 2),
            )

        except Exception as e:
            return PluginHealthCheck(
                plugin_instance_id=None,
                status="unhealthy",
                message=f"SMTP connection failed: {e}",
                details={"error": str(e)},
                timestamp=datetime.now(UTC).isoformat(),
                response_time_ms=None,
            )

    async def test_connection(self, config: dict[str, Any]) -> PluginTestResult:
        """Test email connection."""
        start_time = datetime.now(UTC)

        try:
            await self.configure(config)
            health = await self.health_check()

            end_time = datetime.now(UTC)
            response_time_ms = (end_time - start_time).total_seconds() * 1000

            return PluginTestResult(
                success=health.status == "healthy",
                message=health.message,
                details=health.details or {},
                timestamp=datetime.now(UTC).isoformat(),
                response_time_ms=round(response_time_ms, 2),
            )

        except Exception as e:
            end_time = datetime.now(UTC)
            response_time_ms = (end_time - start_time).total_seconds() * 1000

            return PluginTestResult(
                success=False,
                message=f"Connection test failed: {e}",
                details={"error": str(e)},
                timestamp=datetime.now(UTC).isoformat(),
                response_time_ms=round(response_time_ms, 2),
            )

    def _severity_to_color(self, severity: str) -> str:
        """Map severity to HTML color."""
        colors = {
            "critical": "#dc3545",
            "error": "#dc3545",
            "warning": "#ffc107",
            "info": "#17a2b8",
            "notice": "#6c757d",
        }
        return colors.get(severity.lower(), "#6c757d")

    def _build_html_body(self, alert: dict[str, Any]) -> str:
        """Build HTML email body."""
        severity = alert.get("severity", "warning")
        color = self._severity_to_color(severity)

        return f"""
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {{ font-family: Arial, sans-serif; margin: 0; padding: 20px; }}
                .alert-box {{
                    border-left: 4px solid {color};
                    padding: 15px;
                    background-color: #f8f9fa;
                    margin-bottom: 20px;
                }}
                .severity {{
                    display: inline-block;
                    padding: 4px 8px;
                    background-color: {color};
                    color: white;
                    border-radius: 4px;
                    font-weight: bold;
                    text-transform: uppercase;
                }}
                .details {{ margin-top: 15px; }}
                .details table {{ border-collapse: collapse; width: 100%; }}
                .details td {{ padding: 8px; border-bottom: 1px solid #ddd; }}
                .details td:first-child {{ font-weight: bold; width: 30%; }}
                .footer {{ margin-top: 20px; color: #6c757d; font-size: 12px; }}
            </style>
        </head>
        <body>
            <div class="alert-box">
                <span class="severity">{severity}</span>
                <h2>{alert.get("title", "Network Alert")}</h2>
                <p>{alert.get("description", "")}</p>
            </div>

            <div class="details">
                <table>
                    <tr>
                        <td>Alert ID</td>
                        <td>{alert.get("alert_id", "N/A")}</td>
                    </tr>
                    <tr>
                        <td>Device</td>
                        <td>{alert.get("device_name", alert.get("device_id", "Unknown"))}</td>
                    </tr>
                    <tr>
                        <td>Triggered At</td>
                        <td>{alert.get("triggered_at", datetime.now(UTC).isoformat())}</td>
                    </tr>
                </table>
            </div>

            <div class="footer">
                <p>This alert was generated by DotMac Network Monitor.</p>
            </div>
        </body>
        </html>
        """

    async def deliver_alert(
        self,
        alert: dict[str, Any],
        recipients: list[str] | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> bool:
        """
        Deliver alert via email.

        Args:
            alert: Alert data dictionary
            recipients: Email addresses to send to
            metadata: Additional context

        Returns:
            bool: True if delivery successful
        """
        if not self.configured or not self.smtp_host or not self.from_email:
            raise RuntimeError("Email plugin not configured")

        to_addresses = recipients or self.default_recipients
        if not to_addresses:
            logger.error("No email recipients specified")
            return False

        try:
            severity = alert.get("severity", "warning")
            subject = f"[{severity.upper()}] {alert.get('title', 'Network Alert')}"

            # Build email message
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = f"{self.from_name} <{self.from_email}>"
            msg["To"] = ", ".join(to_addresses)

            # Plain text version
            text_body = f"""
Network Alert: {alert.get("title", "Alert")}

Severity: {severity.upper()}
Device: {alert.get("device_name", alert.get("device_id", "Unknown"))}
Alert ID: {alert.get("alert_id", "N/A")}
Triggered: {alert.get("triggered_at", "Unknown")}

Description:
{alert.get("description", "No description provided")}

---
DotMac Network Monitor
            """

            html_body = self._build_html_body(alert)

            msg.attach(MIMEText(text_body, "plain"))
            msg.attach(MIMEText(html_body, "html"))

            # Send email
            if self.smtp_port == 465:
                context = ssl.create_default_context()
                with smtplib.SMTP_SSL(self.smtp_host, self.smtp_port, context=context) as server:
                    if self.smtp_user and self.smtp_password:
                        server.login(self.smtp_user, self.smtp_password)
                    server.sendmail(self.from_email, to_addresses, msg.as_string())
            else:
                with smtplib.SMTP(self.smtp_host, self.smtp_port) as server:
                    if self.use_tls:
                        server.starttls()
                    if self.smtp_user and self.smtp_password:
                        server.login(self.smtp_user, self.smtp_password)
                    server.sendmail(self.from_email, to_addresses, msg.as_string())

            logger.info(
                f"Alert delivered via email: {alert.get('alert_id')}",
                extra={"recipients": to_addresses},
            )
            return True

        except Exception as e:
            logger.error(f"Email delivery failed: {e}")
            return False


# =============================================================================
# Plugin Registration
# =============================================================================


def register_webhook() -> WebhookAlertPlugin:
    """Register webhook alert plugin."""
    return WebhookAlertPlugin()


def register_slack() -> SlackAlertPlugin:
    """Register Slack alert plugin."""
    return SlackAlertPlugin()


def register_email() -> EmailAlertPlugin:
    """Register email alert plugin."""
    return EmailAlertPlugin()


# Export all plugins
ALERT_DELIVERY_PLUGINS = {
    "webhook_alert": WebhookAlertPlugin,
    "slack_alert": SlackAlertPlugin,
    "email_alert": EmailAlertPlugin,
}
