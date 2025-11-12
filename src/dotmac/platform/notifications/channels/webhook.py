"""
Webhook Channel Provider.

Sends notifications to external systems via HTTP webhooks.
"""

import hashlib
import hmac
import json
from typing import Any

from ..models import NotificationPriority
from .base import NotificationChannelProvider, NotificationContext


class WebhookChannelProvider(NotificationChannelProvider):
    """
    Webhook notification channel.

    Sends notification data to configured webhook endpoints.
    Useful for integrating with:
    - Slack
    - Microsoft Teams
    - Discord
    - Custom monitoring systems
    - Third-party ticketing systems
    """

    @property
    def channel_name(self) -> str:
        return "webhook"

    async def send(self, context: NotificationContext) -> bool:
        """
        Send notification to webhook endpoint(s).

        Args:
            context: Notification context

        Returns:
            True if webhook(s) called successfully

        Raises:
            ValueError: If no webhook URLs configured
            Exception: If all webhook calls fail
        """
        # Get configured webhook URLs
        webhook_urls = self.config.get("urls", [])
        if isinstance(webhook_urls, str):
            webhook_urls = [webhook_urls]

        if not webhook_urls:
            raise ValueError("No webhook URLs configured")

        # Prepare webhook payload
        payload = self._prepare_webhook_payload(context)

        # Track successful sends
        successful_sends = 0

        # Send to all configured webhooks
        for url in webhook_urls:
            try:
                await self._send_webhook(url, payload, context)
                successful_sends += 1
            except Exception as e:
                self.logger.warning(
                    "webhook.send.failed",
                    url=self._mask_url(url),
                    error=str(e),
                    notification_id=str(context.notification_id),
                )

        if successful_sends == 0:
            raise RuntimeError(
                f"Failed to send webhook notification to any endpoint "
                f"({len(webhook_urls)} URLs tried)"
            )

        self.logger.info(
            "webhook.notification.sent",
            notification_id=str(context.notification_id),
            webhooks=successful_sends,
            total_urls=len(webhook_urls),
            priority=context.priority.value,
        )

        return True

    async def _send_webhook(
        self, url: str, payload: dict[str, Any], context: NotificationContext
    ) -> None:
        """
        Send webhook HTTP request.

        Args:
            url: Webhook URL
            payload: Webhook payload
            context: Notification context

        Raises:
            Exception: If HTTP request fails
        """
        import httpx

        # Prepare headers
        headers = {
            "Content-Type": "application/json",
            "User-Agent": "ISP-Platform-Notifications/1.0",
        }

        # Add signature if secret configured (for verification)
        secret = self.config.get("secret")
        if secret:
            signature = self._generate_signature(payload, secret)
            headers["X-Webhook-Signature"] = signature

        # Add custom headers
        custom_headers = self.config.get("headers", {})
        headers.update(custom_headers)

        # Send HTTP POST request
        async with httpx.AsyncClient() as client:
            response = await client.post(
                url,
                json=payload,
                headers=headers,
                timeout=self.config.get("timeout", 10.0),
            )

            # Check response status
            if response.status_code not in [200, 201, 202, 204]:
                raise Exception(f"Webhook returned status {response.status_code}: {response.text}")

        self.logger.debug(
            "webhook.http.sent",
            status_code=response.status_code,
            url=self._mask_url(url),
            notification_id=str(context.notification_id),
        )

    def _prepare_webhook_payload(self, context: NotificationContext) -> dict[str, Any]:
        """
        Prepare webhook payload.

        Format can be customized via config (standard, slack, teams, etc.).

        Args:
            context: Notification context

        Returns:
            Webhook payload dictionary
        """
        # Get payload format
        format_type = self.config.get("format", "standard").lower()

        if format_type == "slack":
            return self._format_slack(context)
        elif format_type == "teams":
            return self._format_teams(context)
        elif format_type == "discord":
            return self._format_discord(context)
        else:
            return self._format_standard(context)

    def _format_standard(self, context: NotificationContext) -> dict[str, Any]:
        """Standard webhook payload format."""
        payload = {
            "notification_id": str(context.notification_id),
            "tenant_id": context.tenant_id,
            "user_id": str(context.user_id),
            "type": context.notification_type.value,
            "priority": context.priority.value,
            "title": context.title,
            "message": context.message,
            "action_url": context.action_url,
            "action_label": context.action_label,
            "related_entity_type": context.related_entity_type,
            "related_entity_id": context.related_entity_id,
            "metadata": context.metadata,
            "created_at": context.created_at.isoformat() if context.created_at else None,
        }
        if context.product_name:
            payload["product_name"] = context.product_name
        if context.support_email:
            payload["support_email"] = context.support_email
        if context.branding:
            payload["branding"] = context.branding
        return payload

    def _format_slack(self, context: NotificationContext) -> dict[str, Any]:
        """
        Slack webhook payload format.

        Uses Slack's Block Kit for rich formatting.
        """
        # Priority color
        priority_colors = {
            NotificationPriority.LOW: "#6c757d",
            NotificationPriority.MEDIUM: "#0dcaf0",
            NotificationPriority.HIGH: "#fd7e14",
            NotificationPriority.URGENT: "#dc3545",
        }

        brand_line = []
        if context.product_name:
            brand_line.append(context.product_name)
        if context.support_email:
            brand_line.append(f"<mailto:{context.support_email}|Support>")

        blocks = [
            {
                "type": "header",
                "text": {"type": "plain_text", "text": context.title},
            },
            {
                "type": "section",
                "text": {"type": "mrkdwn", "text": context.message},
            },
            {
                "type": "context",
                "elements": [
                    {
                        "type": "mrkdwn",
                        "text": f"*Priority:* {context.priority.value.upper()} | *Type:* {context.notification_type.value}",
                    }
                ],
            },
        ]

        # Add action button if present
        if context.action_url and context.action_label:
            blocks.append(
                {
                    "type": "actions",
                    "elements": [
                        {
                            "type": "button",
                            "text": {"type": "plain_text", "text": context.action_label},
                            "url": context.action_url,
                        }
                    ],
                }
            )

        if brand_line:
            blocks.append(
                {
                    "type": "context",
                    "elements": [{"type": "mrkdwn", "text": " • ".join(brand_line)}],
                }
            )

        return {
            "attachments": [
                {
                    "color": priority_colors.get(
                        context.priority, priority_colors[NotificationPriority.MEDIUM]
                    ),
                    "blocks": blocks,
                }
            ]
        }

    def _format_teams(self, context: NotificationContext) -> dict[str, Any]:
        """Microsoft Teams webhook payload format."""
        # Priority theme color
        priority_colors = {
            NotificationPriority.LOW: "808080",
            NotificationPriority.MEDIUM: "0078D4",
            NotificationPriority.HIGH: "FF8C00",
            NotificationPriority.URGENT: "DC143C",
        }

        facts = [
            {"name": "Priority", "value": context.priority.value.upper()},
            {"name": "Type", "value": context.notification_type.value},
        ]
        if context.product_name:
            facts.append({"name": "Product", "value": context.product_name})
        if context.support_email:
            facts.append({"name": "Support", "value": context.support_email})

        card = {
            "@type": "MessageCard",
            "@context": "https://schema.org/extensions",
            "summary": context.title,
            "themeColor": priority_colors.get(
                context.priority, priority_colors[NotificationPriority.MEDIUM]
            ),
            "title": context.title,
            "text": context.message,
            "sections": [{"facts": facts}],
        }

        # Add action button if present
        if context.action_url and context.action_label:
            card["potentialAction"] = [
                {
                    "@type": "OpenUri",
                    "name": context.action_label,
                    "targets": [{"os": "default", "uri": context.action_url}],
                }
            ]

        return card

    def _format_discord(self, context: NotificationContext) -> dict[str, Any]:
        """Discord webhook payload format."""
        # Priority color (Discord uses decimal color codes)
        priority_colors = {
            NotificationPriority.LOW: 7107968,  # Gray
            NotificationPriority.MEDIUM: 3447003,  # Blue
            NotificationPriority.HIGH: 16753920,  # Orange
            NotificationPriority.URGENT: 15158332,  # Red
        }

        embed: dict[str, Any] = {
            "title": context.title,
            "description": context.message,
            "color": priority_colors.get(
                context.priority, priority_colors[NotificationPriority.MEDIUM]
            ),
            "fields": [
                {"name": "Priority", "value": context.priority.value.upper(), "inline": True},
                {"name": "Type", "value": context.notification_type.value, "inline": True},
            ],
        }
        if context.product_name:
            embed["fields"].append(
                {"name": "Product", "value": context.product_name, "inline": True}
            )
        if context.support_email:
            embed["fields"].append(
                {"name": "Support", "value": context.support_email, "inline": False}
            )

        # Add action URL if present
        if context.action_url:
            embed["url"] = context.action_url

        return {"embeds": [embed]}

    def _generate_signature(self, payload: dict[str, Any], secret: str) -> str:
        """
        Generate HMAC signature for webhook verification.

        Args:
            payload: Webhook payload
            secret: Shared secret

        Returns:
            Hex-encoded HMAC signature
        """
        payload_bytes = json.dumps(payload, sort_keys=True).encode("utf-8")
        signature = hmac.new(secret.encode("utf-8"), payload_bytes, hashlib.sha256).hexdigest()
        return signature

    def _mask_url(self, url: str) -> str:
        """
        Mask webhook URL for logging (privacy/security).

        Args:
            url: Webhook URL

        Returns:
            Masked URL
        """
        if "://" in url:
            parts = url.split("://", 1)
            protocol = parts[0]
            rest = parts[1]

            # Show only domain, hide path
            if "/" in rest:
                domain = rest.split("/", 1)[0]
                return f"{protocol}://{domain}/***"

        return "***"

    async def validate_config(self) -> bool:
        """
        Validate webhook configuration.

        Returns:
            True if at least one webhook URL is configured
        """
        urls = self.config.get("urls", [])
        if isinstance(urls, str):
            urls = [urls]
        return len(urls) > 0

    def supports_priority(self, priority: NotificationPriority) -> bool:
        """
        Webhooks support all priorities.

        Args:
            priority: Notification priority

        Returns:
            Always True
        """
        return True

    def get_retry_config(self) -> dict[str, Any]:
        """
        Get retry configuration for webhook delivery.

        Returns:
            Retry configuration
        """
        return {
            "max_retries": self.config.get("max_retries", 3),
            "retry_delay": self.config.get("retry_delay", 30),  # Faster for webhooks
            "backoff_multiplier": self.config.get("backoff_multiplier", 2),
        }
