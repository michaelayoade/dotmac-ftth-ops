"""
Paystack Payment Plugin

Implements PaymentProvider interface for Paystack payment gateway integration.
Handles payment processing, refunds, and payment verification through Paystack API.
"""

from __future__ import annotations

import logging
from datetime import UTC, datetime
from typing import Any

from dotmac.platform.plugins.interfaces import PaymentProvider
from dotmac.platform.plugins.schema import PluginConfig, PluginHealthCheck, PluginTestResult

logger = logging.getLogger(__name__)


class PaystackPaymentPlugin(PaymentProvider):
    """
    Paystack payment provider plugin.

    Integrates with Paystack API for payment processing in Nigerian and African markets.
    Supports card payments, bank transfers, mobile money, and USSD.
    """

    def __init__(self) -> None:
        """Initialize Paystack plugin."""
        self.secret_key: str | None = None
        self.public_key: str | None = None
        self.paystack_client: Any = None
        self.configured = False

    def get_config_schema(self) -> PluginConfig:
        """
        Return Paystack configuration schema.

        Returns:
            PluginConfig with required fields for Paystack
        """
        return PluginConfig(
            plugin_name="paystack",
            display_name="Paystack Payment Gateway",
            description="Payment processing via Paystack (Nigeria and Africa)",
            provider_type="payment",
            version="1.0.0",
            config_schema={
                "secret_key": {
                    "type": "string",
                    "required": True,
                    "sensitive": True,
                    "description": "Paystack secret key (sk_live_* or sk_test_*)",
                    "validation": r"^sk_(live|test)_[a-zA-Z0-9]+$",
                },
                "public_key": {
                    "type": "string",
                    "required": True,
                    "description": "Paystack public key (pk_live_* or pk_test_*)",
                    "validation": r"^pk_(live|test)_[a-zA-Z0-9]+$",
                },
                "webhook_secret": {
                    "type": "string",
                    "required": False,
                    "sensitive": True,
                    "description": "Paystack webhook secret for event verification",
                },
                "default_currency": {
                    "type": "string",
                    "required": False,
                    "default": "NGN",
                    "description": "Default currency (NGN, GHS, ZAR, USD)",
                },
            },
            metadata={
                "supported_currencies": ["NGN", "GHS", "ZAR", "USD", "KES"],
                "supported_payment_methods": [
                    "card",
                    "bank",
                    "bank_transfer",
                    "ussd",
                    "mobile_money",
                    "qr",
                ],
                "region": "africa",
                "website": "https://paystack.com",
                "documentation": "https://paystack.com/docs/api",
            },
        )

    async def configure(self, config: dict[str, Any]) -> bool:
        """
        Configure the Paystack plugin.

        Args:
            config: Configuration dict with secret_key, public_key, etc.

        Returns:
            bool: True if configuration successful

        Raises:
            ValueError: If required configuration is missing or invalid
        """
        # Validate required fields
        secret_key = config.get("secret_key")
        public_key = config.get("public_key")

        if not secret_key:
            raise ValueError("Paystack secret_key is required")

        if not public_key:
            raise ValueError("Paystack public_key is required")

        # Validate key formats
        if not secret_key.startswith(("sk_live_", "sk_test_")):
            raise ValueError(
                "Invalid Paystack secret_key format. Must start with 'sk_live_' or 'sk_test_'"
            )

        if not public_key.startswith(("pk_live_", "pk_test_")):
            raise ValueError(
                "Invalid Paystack public_key format. Must start with 'pk_live_' or 'pk_test_'"
            )

        # Store configuration
        self.secret_key = secret_key
        self.public_key = public_key

        # Initialize Paystack client
        try:
            from pypaystack2 import Paystack

            self.paystack_client = Paystack(auth_key=self.secret_key)
            self.configured = True

            logger.info(
                "Paystack plugin configured successfully",
                extra={
                    "is_live": secret_key.startswith("sk_live_"),
                    "currency": config.get("default_currency", "NGN"),
                },
            )

            return True

        except ImportError as e:
            raise ValueError(
                "pypaystack2 library not installed. Install with: pip install pypaystack2"
            ) from e
        except Exception as e:
            logger.error(f"Failed to configure Paystack plugin: {e}")
            raise ValueError(f"Failed to initialize Paystack client: {e}") from e

    async def health_check(self) -> PluginHealthCheck:
        """
        Perform health check on Paystack connection.

        Returns:
            PluginHealthCheck with status and details
        """
        if not self.configured or not self.paystack_client:
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

            # Test API connection by fetching supported banks
            # This is a lightweight call to verify API connectivity
            response = self.paystack_client.misc.list_banks(
                country="NG",
                use_cursor=False,
                per_page=1,
            )

            end_time = datetime.now(UTC)
            response_time_ms = (end_time - start_time).total_seconds() * 1000

            if response and response.get("status"):
                secret_key = self.secret_key
                if secret_key is None:
                    return PluginHealthCheck(
                        plugin_instance_id=None,
                        status="unhealthy",
                        message="Secret key missing after configuration",
                        details={"configured": True},
                        timestamp=datetime.now(UTC).isoformat(),
                        response_time_ms=round(response_time_ms, 2),
                    )
                return PluginHealthCheck(
                    plugin_instance_id=None,
                    status="healthy",
                    message="Paystack API connection successful",
                    details={
                        "api_reachable": True,
                        "is_live_mode": secret_key.startswith("sk_live_"),
                        "response_time_ms": round(response_time_ms, 2),
                    },
                    timestamp=datetime.now(UTC).isoformat(),
                    response_time_ms=round(response_time_ms, 2),
                )
            else:
                return PluginHealthCheck(
                    plugin_instance_id=None,
                    status="unhealthy",
                    message="Paystack API returned unexpected response",
                    details={"response": response},
                    timestamp=datetime.now(UTC).isoformat(),
                    response_time_ms=round(response_time_ms, 2),
                )

        except Exception as e:
            logger.error(f"Paystack health check failed: {e}")
            return PluginHealthCheck(
                plugin_instance_id=None,
                status="unhealthy",
                message=f"Health check failed: {str(e)}",
                details={"error": str(e), "error_type": type(e).__name__},
                timestamp=datetime.now(UTC).isoformat(),
                response_time_ms=None,
            )

    async def test_connection(self, config: dict[str, Any]) -> PluginTestResult:
        """
        Test Paystack connection with provided configuration.

        Args:
            config: Configuration to test

        Returns:
            PluginTestResult with test results
        """
        start_time = datetime.now(UTC)

        try:
            # Temporarily configure with test config
            await self.configure(config)

            # Perform health check
            health = await self.health_check()

            end_time = datetime.now(UTC)
            response_time_ms = (end_time - start_time).total_seconds() * 1000

            if health.status == "healthy":
                return PluginTestResult(
                    success=True,
                    message="Paystack connection test successful",
                    details=health.details or {},
                    timestamp=datetime.now(UTC).isoformat(),
                    response_time_ms=round(response_time_ms, 2),
                )
            else:
                return PluginTestResult(
                    success=False,
                    message=f"Paystack connection test failed: {health.message}",
                    details=health.details or {},
                    timestamp=datetime.now(UTC).isoformat(),
                    response_time_ms=round(response_time_ms, 2),
                )

        except Exception as e:
            end_time = datetime.now(UTC)
            response_time_ms = (end_time - start_time).total_seconds() * 1000

            return PluginTestResult(
                success=False,
                message=f"Connection test failed: {str(e)}",
                details={"error": str(e), "error_type": type(e).__name__},
                timestamp=datetime.now(UTC).isoformat(),
                response_time_ms=round(response_time_ms, 2),
            )

    async def process_payment(
        self,
        amount: float,
        currency: str,
        payment_method: str,
        metadata: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """
        Process a payment through Paystack.

        Args:
            amount: Payment amount (in minor units, e.g., kobo for NGN)
            currency: Currency code (NGN, USD, GHS, ZAR, KES)
            payment_method: Payment method identifier (card, bank, ussd, etc.)
            metadata: Additional payment metadata (order_id, customer_email, etc.)

        Returns:
            Dict with payment result:
            {
                "payment_id": "pay_xxx",
                "transaction_id": "txn_xxx",
                "status": "success" | "pending" | "failed",
                "amount": "100.00",
                "currency": "NGN",
                "provider": "paystack",
                "reference": "paystack_ref",
                "authorization_url": "https://...",  # For pending payments
                "message": "Payment successful"
            }

        Raises:
            RuntimeError: If plugin not configured or payment processing fails
        """
        if not self.configured or not self.paystack_client:
            raise RuntimeError("Paystack plugin not configured. Call configure() first.")

        # Validate amount
        if amount <= 0:
            raise ValueError("Amount must be greater than zero")

        metadata = metadata or {}

        # Extract and validate customer email
        customer_email = metadata.get("customer_email")
        if not customer_email:
            raise ValueError("customer_email is required in metadata")

        try:
            # Convert amount to kobo/cents (Paystack expects amount in minor units)
            amount_in_kobo = int(amount * 100)

            # Generate unique reference
            import secrets

            reference = metadata.get("reference") or f"dotmac_{secrets.token_hex(12)}"

            # Prepare transaction data
            transaction_data = {
                "email": customer_email,
                "amount": amount_in_kobo,
                "currency": currency.upper(),
                "reference": reference,
                "metadata": {
                    **metadata,
                    "source": "dotmac_platform",
                    "payment_method": payment_method,
                },
            }

            # Add callback URL if provided
            callback_url = metadata.get("callback_url")
            if callback_url:
                transaction_data["callback_url"] = callback_url

            # Initialize transaction
            logger.info(
                f"Initializing Paystack transaction: {reference}",
                extra={
                    "amount": amount,
                    "currency": currency,
                    "email": customer_email,
                },
            )

            response = self.paystack_client.transactions.initialize(**transaction_data)

            if not response or not response.get("status"):
                raise RuntimeError(f"Paystack transaction initialization failed: {response}")

            data = response.get("data", {})

            # For card payments, return authorization URL for redirect
            if payment_method == "card" or payment_method == "default":
                return {
                    "payment_id": f"pay_{reference}",
                    "transaction_id": reference,
                    "reference": reference,
                    "status": "pending",
                    "amount": str(amount),
                    "currency": currency,
                    "provider": "paystack",
                    "authorization_url": data.get("authorization_url"),
                    "access_code": data.get("access_code"),
                    "message": "Payment initialized. Redirect customer to authorization_url",
                }

            # For other payment methods, may need different handling
            return {
                "payment_id": f"pay_{reference}",
                "transaction_id": reference,
                "reference": reference,
                "status": "pending",
                "amount": str(amount),
                "currency": currency,
                "provider": "paystack",
                "authorization_url": data.get("authorization_url"),
                "message": "Payment initialized successfully",
            }

        except Exception as e:
            logger.error(f"Paystack payment processing failed: {e}", exc_info=True)
            raise RuntimeError(f"Payment processing failed: {e}") from e

    async def verify_payment(self, reference: str) -> dict[str, Any]:
        """
        Verify a payment transaction status.

        Args:
            reference: Paystack transaction reference

        Returns:
            Dict with verification result

        Raises:
            RuntimeError: If verification fails
        """
        if not self.configured or not self.paystack_client:
            raise RuntimeError("Paystack plugin not configured")

        try:
            response = self.paystack_client.transactions.verify(reference=reference)

            if not response or not response.get("status"):
                raise RuntimeError(f"Paystack verification failed: {response}")

            data = response.get("data", {})

            # Map Paystack status to platform status
            status_map = {
                "success": "completed",
                "failed": "failed",
                "pending": "pending",
                "abandoned": "failed",
            }
            paystack_status = data.get("status", "pending")
            platform_status = status_map.get(paystack_status, "pending")

            return {
                "payment_id": f"pay_{reference}",
                "reference": reference,
                "status": platform_status,
                "amount": data.get("amount", 0) / 100,  # Convert from kobo
                "currency": data.get("currency"),
                "provider": "paystack",
                "transaction_id": data.get("id"),
                "paid_at": data.get("paid_at"),
                "channel": data.get("channel"),
                "card_type": data.get("authorization", {}).get("card_type"),
                "bank": data.get("authorization", {}).get("bank"),
                "last4": data.get("authorization", {}).get("last4"),
                "gateway_response": data.get("gateway_response"),
            }

        except Exception as e:
            logger.error(f"Paystack payment verification failed: {e}")
            raise RuntimeError(f"Payment verification failed: {e}") from e

    async def refund_payment(
        self,
        payment_id: str,
        amount: float | None = None,
        reason: str | None = None,
    ) -> dict[str, Any]:
        """
        Process a refund for a completed payment.

        Args:
            payment_id: Payment ID (format: pay_<reference>)
            amount: Refund amount (None for full refund)
            reason: Refund reason

        Returns:
            Dict with refund result:
            {
                "refund_id": "refund_xxx",
                "payment_id": "pay_xxx",
                "status": "pending" | "completed" | "failed",
                "amount": 100.00,
                "currency": "NGN",
                "reason": "Customer request",
                "provider": "paystack"
            }

        Raises:
            RuntimeError: If plugin not configured or refund fails
        """
        if not self.configured or not self.paystack_client:
            raise RuntimeError("Paystack plugin not configured")

        # Validate amount if provided
        if amount is not None and amount <= 0:
            raise ValueError("Refund amount must be greater than zero")

        try:
            # Extract reference from payment_id (pay_<reference>)
            reference = payment_id.replace("pay_", "")

            # Prepare refund data
            refund_data: dict[str, Any] = {
                "transaction": reference,
            }

            # Add amount if partial refund
            if amount is not None:
                refund_data["amount"] = int(amount * 100)  # Convert to kobo

            # Add merchant note if reason provided
            if reason:
                refund_data["merchant_note"] = reason

            logger.info(
                f"Processing Paystack refund for transaction: {reference}",
                extra={
                    "payment_id": payment_id,
                    "amount": amount,
                    "reason": reason,
                },
            )

            response = self.paystack_client.refunds.create(**refund_data)

            if not response or not response.get("status"):
                raise RuntimeError(f"Paystack refund failed: {response}")

            data = response.get("data", {})
            refund_data_response = data.get("refund", {}) if "refund" in data else data

            refund_id = refund_data_response.get("id")
            refund_amount = refund_data_response.get("amount", 0) / 100  # Convert from kobo
            refund_status = refund_data_response.get("status", "pending")

            return {
                "refund_id": f"refund_{refund_id}",
                "payment_id": payment_id,
                "status": (
                    refund_status
                    if refund_status in ["pending", "completed", "failed"]
                    else "pending"
                ),
                "amount": float(refund_amount),
                "currency": refund_data_response.get("currency", "NGN"),
                "reason": reason or "Refund requested",
                "provider": "paystack",
                "transaction_id": reference,
            }

        except Exception as e:
            logger.error(f"Paystack refund processing failed: {e}", exc_info=True)
            raise RuntimeError(f"Refund processing failed: {e}") from e

    async def validate_webhook(
        self,
        webhook_data: dict[str, Any],
        headers: dict[str, str] | None = None,
    ) -> bool:
        """
        Validate Paystack webhook signature.

        Paystack sends webhooks with X-Paystack-Signature header containing
        HMAC-SHA512 hash of the payload using the secret key.

        Args:
            webhook_data: Webhook payload
            headers: HTTP headers (must include X-Paystack-Signature)

        Returns:
            bool: True if signature is valid

        Raises:
            ValueError: If signature is missing or invalid
        """
        import hashlib
        import hmac
        import json

        if not headers:
            raise ValueError("Headers required for webhook validation")

        signature = headers.get("X-Paystack-Signature") or headers.get("x-paystack-signature")
        if not signature:
            raise ValueError("Missing X-Paystack-Signature header")

        if not self.secret_key:
            raise RuntimeError("Plugin not configured - secret key missing")

        # Compute HMAC-SHA512 signature
        payload_json = json.dumps(webhook_data, separators=(",", ":"))
        expected_signature = hmac.new(
            self.secret_key.encode("utf-8"),
            payload_json.encode("utf-8"),
            hashlib.sha512,
        ).hexdigest()

        # Constant-time comparison to prevent timing attacks
        return hmac.compare_digest(signature, expected_signature)

    async def process_webhook(
        self,
        webhook_data: dict[str, Any],
    ) -> dict[str, Any]:
        """
        Process Paystack webhook event.

        Args:
            webhook_data: Webhook payload with event and data

        Returns:
            Dict with standardized event data:
            {
                "event": "charge.success",
                "payment_id": "pay_xxx",
                "status": "completed" | "failed" | "pending",
                "amount": 100.00,
                "currency": "NGN",
                "reference": "paystack_ref",
                "customer_email": "test@example.com",
                "provider": "paystack"
            }
        """
        event = webhook_data.get("event")
        data = webhook_data.get("data", {})

        reference = data.get("reference")
        amount_kobo = data.get("amount", 0)
        amount = float(amount_kobo) / 100  # Convert from kobo

        # Map Paystack status to platform status
        status_map = {
            "success": "completed",
            "failed": "failed",
            "pending": "pending",
            "abandoned": "failed",
        }

        paystack_status = data.get("status", "pending")
        platform_status = status_map.get(paystack_status, "pending")

        result = {
            "event": event,
            "payment_id": f"pay_{reference}" if reference else None,
            "status": platform_status,
            "amount": amount,
            "currency": data.get("currency", "NGN"),
            "reference": reference,
            "customer_email": (
                data.get("customer", {}).get("email")
                if isinstance(data.get("customer"), dict)
                else None
            ),
            "provider": "paystack",
            "webhook_id": data.get("id"),
            "paid_at": data.get("paid_at") or data.get("paidAt"),
            "gateway_response": data.get("gateway_response"),
        }

        logger.info(
            f"Processed Paystack webhook: {event}",
            extra={
                "reference": reference,
                "status": platform_status,
                "amount": amount,
            },
        )

        return result


# Plugin registration
def register() -> PaystackPaymentPlugin:
    """Register Paystack payment plugin."""
    return PaystackPaymentPlugin()


def get_name() -> str:
    """Get plugin name."""
    return "paystack"


def get_version() -> str:
    """Get plugin version."""
    return "1.0.0"
