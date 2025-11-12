"""
Push Notification Channel Provider.

Sends push notifications to mobile devices using pluggable backends (Firebase, OneSignal, etc.).
"""

from typing import Any, cast

from ..models import NotificationPriority
from .base import NotificationChannelProvider, NotificationContext


class PushChannelProvider(NotificationChannelProvider):
    """
    Push notification channel with pluggable backends.

    Supports multiple push providers:
    - Firebase Cloud Messaging (FCM) - default
    - OneSignal
    - AWS SNS Mobile Push
    - Custom HTTP API

    Configuration via settings.notifications.push_provider
    """

    @property
    def channel_name(self) -> str:
        return "push"

    async def send(self, context: NotificationContext) -> bool:
        """
        Send push notification to user's devices.

        Args:
            context: Notification context with recipient push tokens

        Returns:
            True if push sent successfully to at least one device

        Raises:
            ValueError: If no push tokens available or provider not configured
        """
        if not context.recipient_push_tokens:
            raise ValueError(
                f"Cannot send push notification - no device tokens provided "
                f"(notification_id={context.notification_id})"
            )

        # Get configured provider
        provider = self.config.get("provider", "fcm").lower()

        # Prepare push payload
        push_data = self._prepare_push_payload(context)

        # Track successful sends
        successful_sends = 0

        # Send to all registered devices
        for token in context.recipient_push_tokens:
            try:
                if provider == "fcm":
                    await self._send_via_fcm(token, push_data, context)
                elif provider == "onesignal":
                    await self._send_via_onesignal(token, push_data, context)
                elif provider == "aws_sns":
                    await self._send_via_aws_sns(token, push_data, context)
                elif provider == "http":
                    await self._send_via_http(token, push_data, context)
                else:
                    raise ValueError(f"Unknown push provider: {provider}")

                successful_sends += 1

            except Exception as e:
                self.logger.warning(
                    "push.device.failed",
                    notification_id=str(context.notification_id),
                    error=str(e),
                    # Don't log full token for security
                )

        if successful_sends == 0:
            raise RuntimeError(
                f"Failed to send push notification to any device "
                f"({len(context.recipient_push_tokens)} tokens tried)"
            )

        self.logger.info(
            "push.notification.sent",
            notification_id=str(context.notification_id),
            devices=successful_sends,
            total_tokens=len(context.recipient_push_tokens),
            provider=provider,
            priority=context.priority.value,
        )

        return True

    async def _send_via_fcm(
        self, token: str, payload: dict[str, Any], context: NotificationContext
    ) -> None:
        """
        Send push notification via Firebase Cloud Messaging.

        Args:
            token: FCM device token
            payload: Push notification payload
            context: Notification context

        Raises:
            ImportError: If firebase-admin library not installed
            Exception: If FCM API call fails
        """
        try:
            import firebase_admin
            from firebase_admin import credentials, messaging
        except ImportError as e:
            raise ImportError(
                "firebase-admin library not installed. Install with: pip install firebase-admin"
            ) from e

        # Initialize Firebase app if not already done
        if not firebase_admin._apps:
            cred_path = self.config.get("fcm_credentials_path")
            if not cred_path:
                raise ValueError("FCM credentials path not configured")

            cred = credentials.Certificate(cred_path)
            firebase_admin.initialize_app(cred)

        # Prepare FCM message
        message = messaging.Message(
            notification=messaging.Notification(
                title=payload["title"],
                body=payload["body"],
            ),
            data=payload.get("data", {}),
            token=token,
            android=messaging.AndroidConfig(
                priority="high" if context.priority == NotificationPriority.URGENT else "normal",
            ),
            apns=messaging.APNSConfig(
                headers={
                    "apns-priority": (
                        "10" if context.priority == NotificationPriority.URGENT else "5"
                    ),
                },
            ),
        )

        # Send message
        response = messaging.send(message)

        self.logger.debug(
            "push.fcm.sent",
            message_id=response,
            notification_id=str(context.notification_id),
        )

    async def _send_via_onesignal(
        self, token: str, payload: dict[str, Any], context: NotificationContext
    ) -> None:
        """
        Send push notification via OneSignal.

        Args:
            token: OneSignal player ID
            payload: Push notification payload
            context: Notification context

        Raises:
            ValueError: If OneSignal not configured
            Exception: If OneSignal API call fails
        """
        import httpx

        # Get OneSignal credentials
        app_id = self.config.get("onesignal_app_id")
        api_key = self.config.get("onesignal_api_key")

        if not all([app_id, api_key]):
            raise ValueError("OneSignal credentials missing (app_id, api_key)")

        # Prepare OneSignal request
        headers = {
            "Authorization": f"Basic {api_key}",
            "Content-Type": "application/json",
        }

        onesignal_payload = {
            "app_id": app_id,
            "include_player_ids": [token],
            "headings": {"en": payload["title"]},
            "contents": {"en": payload["body"]},
            "data": payload.get("data", {}),
        }

        # Send request
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://onesignal.com/api/v1/notifications",
                json=onesignal_payload,
                headers=headers,
                timeout=10.0,
            )
            response.raise_for_status()

        self.logger.debug(
            "push.onesignal.sent",
            notification_id=str(context.notification_id),
        )

    async def _send_via_aws_sns(
        self, token: str, payload: dict[str, Any], context: NotificationContext
    ) -> None:
        """
        Send push notification via AWS SNS Mobile Push.

        Args:
            token: Platform endpoint ARN
            payload: Push notification payload
            context: Notification context

        Raises:
            ImportError: If boto3 library not installed
            Exception: If AWS SNS call fails
        """
        try:
            import boto3
        except ImportError as e:
            raise ImportError("boto3 library not installed. Install with: pip install boto3") from e

        # Get AWS configuration
        aws_region = self.config.get("aws_region", "us-east-1")

        # Initialize SNS client
        sns = boto3.client("sns", region_name=aws_region)

        # Prepare platform-specific payload
        # (AWS SNS requires different JSON structure for iOS/Android)
        import json

        message_json = {
            "default": payload["body"],
            "GCM": json.dumps(
                {
                    "notification": {
                        "title": payload["title"],
                        "body": payload["body"],
                    },
                    "data": payload.get("data", {}),
                }
            ),
            "APNS": json.dumps(
                {
                    "aps": {
                        "alert": {
                            "title": payload["title"],
                            "body": payload["body"],
                        },
                    },
                    "data": payload.get("data", {}),
                }
            ),
        }

        # Publish to endpoint
        response = sns.publish(
            TargetArn=token,
            Message=json.dumps(message_json),
            MessageStructure="json",
        )

        self.logger.debug(
            "push.aws_sns.sent",
            message_id=response.get("MessageId"),
            notification_id=str(context.notification_id),
        )

    async def _send_via_http(
        self, token: str, payload: dict[str, Any], context: NotificationContext
    ) -> None:
        """
        Send push notification via custom HTTP API.

        Args:
            token: Device token
            payload: Push notification payload
            context: Notification context

        Raises:
            ValueError: If HTTP API not configured
            Exception: If HTTP request fails
        """
        import httpx

        # Get HTTP API configuration
        api_url = self.config.get("http_api_url")
        api_key = self.config.get("http_api_key")

        if not api_url:
            raise ValueError("HTTP API URL not configured")

        # Prepare request
        headers = {}
        if api_key:
            headers["Authorization"] = f"Bearer {api_key}"

        http_payload = {
            "token": token,
            "notification": payload,
            "notification_id": str(context.notification_id),
        }

        # Send HTTP request
        async with httpx.AsyncClient() as client:
            response = await client.post(
                api_url,
                json=http_payload,
                headers=headers,
                timeout=10.0,
            )
            response.raise_for_status()

        self.logger.debug(
            "push.http.sent",
            status_code=response.status_code,
            notification_id=str(context.notification_id),
        )

    def _prepare_push_payload(self, context: NotificationContext) -> dict[str, Any]:
        """
        Prepare push notification payload.

        Args:
            context: Notification context

        Returns:
            Push payload dictionary
        """
        # Basic notification
        branding = context.branding or {}
        brand_suffix = ""
        if context.product_name or context.support_email:
            suffix_parts = []
            if context.product_name:
                suffix_parts.append(context.product_name)
            if context.support_email:
                suffix_parts.append(context.support_email)
            brand_suffix = " • ".join(suffix_parts)

        body = context.message
        if brand_suffix:
            body = f"{context.message}\n{brand_suffix}"

        payload: dict[str, Any] = {
            "title": context.title,
            "body": body,
            "data": {
                "notification_id": str(context.notification_id),
                "notification_type": context.notification_type.value,
                "priority": context.priority.value,
                "branding": branding,
            },
        }
        data_payload = cast(dict[str, Any], payload["data"])

        # Add action URL if present
        if context.action_url:
            data_payload["action_url"] = context.action_url

        # Add related entity info
        if context.related_entity_type and context.related_entity_id:
            data_payload["related_entity_type"] = context.related_entity_type
            data_payload["related_entity_id"] = context.related_entity_id

        # Add custom metadata
        if context.metadata:
            data_payload["metadata"] = context.metadata

        return payload

    async def validate_config(self) -> bool:
        """
        Validate push provider configuration.

        Returns:
            True if push provider is properly configured
        """
        provider = self.config.get("provider", "fcm").lower()

        if provider == "fcm":
            return bool(self.config.get("fcm_credentials_path"))
        elif provider == "onesignal":
            required = ["onesignal_app_id", "onesignal_api_key"]
            return all(self.config.get(key) for key in required)
        elif provider == "aws_sns":
            # AWS credentials can come from environment or IAM role
            return True
        elif provider == "http":
            return bool(self.config.get("http_api_url"))

        return False

    def supports_priority(self, priority: NotificationPriority) -> bool:
        """
        Push notifications can be expensive (battery, user attention).
        Typically only used for medium+ priority.

        Can be configured via push_min_priority setting.

        Args:
            priority: Notification priority

        Returns:
            True if priority meets minimum threshold
        """
        min_priority = self.config.get("min_priority", "MEDIUM").upper()

        priority_levels = {
            "LOW": 0,
            "MEDIUM": 1,
            "HIGH": 2,
            "URGENT": 3,
        }

        return priority_levels.get(priority.value.upper(), 0) >= priority_levels.get(
            min_priority, 1
        )

    def get_retry_config(self) -> dict[str, Any]:
        """
        Get retry configuration for push delivery.

        Returns:
            Retry configuration
        """
        return {
            "max_retries": self.config.get("max_retries", 3),
            "retry_delay": self.config.get("retry_delay", 60),
            "backoff_multiplier": self.config.get("backoff_multiplier", 2),
        }
