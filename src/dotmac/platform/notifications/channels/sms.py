"""
SMS Channel Provider.

Sends notifications via SMS using pluggable SMS backends (Twilio, AWS SNS, etc.).
"""

from typing import Any

from ..models import NotificationPriority
from .base import NotificationChannelProvider, NotificationContext


class SMSChannelProvider(NotificationChannelProvider):
    """
    SMS notification channel with pluggable backends.

    Supports multiple SMS providers:
    - Twilio (default)
    - AWS SNS
    - Custom HTTP API

    Configuration via settings.notifications.sms_provider
    """

    @property
    def channel_name(self) -> str:
        return "sms"

    async def send(self, context: NotificationContext) -> bool:
        """
        Send notification via SMS.

        Args:
            context: Notification context with recipient phone

        Returns:
            True if SMS sent successfully

        Raises:
            ValueError: If recipient phone is missing or provider not configured
        """
        if not context.recipient_phone:
            raise ValueError(
                f"Cannot send SMS notification - no recipient phone provided "
                f"(notification_id={context.notification_id})"
            )

        # Get configured provider
        provider = self.config.get("provider", "twilio").lower()

        # Format message (SMS has length limits)
        sms_message = self._format_sms_message(context)

        # Send via configured provider
        if provider == "twilio":
            await self._send_via_twilio(context.recipient_phone, sms_message, context)
        elif provider == "aws_sns":
            await self._send_via_aws_sns(context.recipient_phone, sms_message, context)
        elif provider == "http":
            await self._send_via_http(context.recipient_phone, sms_message, context)
        else:
            raise ValueError(f"Unknown SMS provider: {provider}")

        self.logger.info(
            "sms.notification.sent",
            notification_id=str(context.notification_id),
            phone=self._mask_phone(context.recipient_phone),
            provider=provider,
            priority=context.priority.value,
        )

        return True

    async def _send_via_twilio(
        self, phone: str, message: str, context: NotificationContext
    ) -> None:
        """
        Send SMS via Twilio.

        Args:
            phone: Recipient phone number (E.164 format)
            message: SMS message text
            context: Notification context

        Raises:
            ImportError: If twilio library not installed
            Exception: If Twilio API call fails
        """
        try:
            from twilio.rest import Client
        except ImportError as e:
            raise ImportError(
                "Twilio library not installed. Install with: pip install twilio"
            ) from e

        # Get Twilio credentials from config
        account_sid = self.config.get("twilio_account_sid")
        auth_token = self.config.get("twilio_auth_token")
        from_number = self.config.get("twilio_from_number")

        if not all([account_sid, auth_token, from_number]):
            raise ValueError(
                "Twilio credentials missing. Required: twilio_account_sid, "
                "twilio_auth_token, twilio_from_number"
            )

        # Initialize Twilio client
        client = Client(account_sid, auth_token)

        # Send SMS
        twilio_message = client.messages.create(
            body=message,
            from_=from_number,
            to=phone,
        )

        self.logger.debug(
            "sms.twilio.sent",
            message_sid=twilio_message.sid,
            status=twilio_message.status,
            notification_id=str(context.notification_id),
        )

    async def _send_via_aws_sns(
        self, phone: str, message: str, context: NotificationContext
    ) -> None:
        """
        Send SMS via AWS SNS.

        Args:
            phone: Recipient phone number (E.164 format)
            message: SMS message text
            context: Notification context

        Raises:
            ImportError: If boto3 library not installed
            Exception: If AWS SNS call fails
        """
        try:
            import boto3
        except ImportError as e:
            raise ImportError("boto3 library not installed. Install with: pip install boto3") from e

        # Get AWS credentials from config (or use environment/IAM role)
        aws_region = self.config.get("aws_region", "us-east-1")

        # Initialize SNS client
        sns = boto3.client("sns", region_name=aws_region)

        # Send SMS
        response = sns.publish(
            PhoneNumber=phone,
            Message=message,
            MessageAttributes={
                "AWS.SNS.SMS.SenderID": {
                    "DataType": "String",
                    "StringValue": self.config.get("sender_id", "ISP"),
                },
                "AWS.SNS.SMS.SMSType": {
                    "DataType": "String",
                    "StringValue": "Transactional",  # Better delivery for notifications
                },
            },
        )

        self.logger.debug(
            "sms.aws_sns.sent",
            message_id=response.get("MessageId"),
            notification_id=str(context.notification_id),
        )

    async def _send_via_http(self, phone: str, message: str, context: NotificationContext) -> None:
        """
        Send SMS via custom HTTP API.

        Args:
            phone: Recipient phone number
            message: SMS message text
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

        payload = {
            "to": phone,
            "message": message,
            "notification_id": str(context.notification_id),
        }

        # Send HTTP request
        async with httpx.AsyncClient() as client:
            response = await client.post(
                api_url,
                json=payload,
                headers=headers,
                timeout=10.0,
            )
            response.raise_for_status()

        self.logger.debug(
            "sms.http.sent",
            status_code=response.status_code,
            notification_id=str(context.notification_id),
        )

    def _format_sms_message(self, context: NotificationContext) -> str:
        """
        Format notification for SMS delivery.

        SMS messages have character limits (160 for GSM, 70 for Unicode).
        We format concisely and truncate if needed.

        Args:
            context: Notification context

        Returns:
            Formatted SMS message
        """
        # Priority prefix for urgent messages
        priority_prefix = ""
        if context.priority in (NotificationPriority.HIGH, NotificationPriority.URGENT):
            priority_prefix = f"[{context.priority.value.upper()}] "

        # Format: [PRIORITY] Title - Message
        sms_text = f"{priority_prefix}{context.title}"

        # Add message if there's space
        max_length = int(self.config.get("max_length", 160))
        if len(sms_text) + len(context.message) + 3 < max_length:
            sms_text += f" - {context.message}"
        else:
            # Truncate message to fit
            available_space = max_length - len(sms_text) - 6  # " - ..."
            if available_space > 0:
                truncated_message = context.message[:available_space]
                sms_text += f" - {truncated_message}..."

        return sms_text

    def _mask_phone(self, phone: str) -> str:
        """
        Mask phone number for logging (privacy).

        Args:
            phone: Phone number

        Returns:
            Masked phone number
        """
        if len(phone) > 4:
            return f"***{phone[-4:]}"
        return "***"

    async def validate_config(self) -> bool:
        """
        Validate SMS provider configuration.

        Returns:
            True if SMS provider is properly configured
        """
        provider = self.config.get("provider", "twilio").lower()

        if provider == "twilio":
            required = ["twilio_account_sid", "twilio_auth_token", "twilio_from_number"]
            return all(self.config.get(key) for key in required)
        elif provider == "aws_sns":
            # AWS credentials can come from environment or IAM role
            return True
        elif provider == "http":
            return bool(self.config.get("http_api_url"))

        return False

    def supports_priority(self, priority: NotificationPriority) -> bool:
        """
        SMS typically only used for high/urgent notifications due to cost.

        Can be configured via sms_min_priority setting.

        Args:
            priority: Notification priority

        Returns:
            True if priority meets minimum threshold
        """
        min_priority = self.config.get("min_priority", "HIGH").upper()

        priority_levels = {
            "LOW": 0,
            "MEDIUM": 1,
            "HIGH": 2,
            "URGENT": 3,
        }

        return priority_levels.get(priority.value.upper(), 0) >= priority_levels.get(
            min_priority, 2
        )

    def get_retry_config(self) -> dict[str, Any]:
        """
        Get retry configuration for SMS delivery.

        SMS typically has lower retry counts than email due to cost.

        Returns:
            Retry configuration
        """
        return {
            "max_retries": self.config.get("max_retries", 2),  # Lower for SMS
            "retry_delay": self.config.get("retry_delay", 120),  # 2 minutes
            "backoff_multiplier": self.config.get("backoff_multiplier", 2),
        }
