"""
Webhook handlers for payment providers with complete subscription integration
"""

import base64
import hashlib
import hmac
import json
import logging
from abc import ABC, abstractmethod
from datetime import UTC, datetime
from typing import Any

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.billing.config import BillingConfig, get_billing_config
from dotmac.platform.billing.core.enums import InvoiceStatus, PaymentStatus
from dotmac.platform.billing.invoicing.service import InvoiceService
from dotmac.platform.billing.metrics import get_billing_metrics
from dotmac.platform.billing.payments.service import PaymentService
from dotmac.platform.billing.subscriptions.models import (
    SubscriptionCreateRequest,
    SubscriptionEventType,
    SubscriptionStatus,
    SubscriptionUpdateRequest,
)
from dotmac.platform.billing.subscriptions.service import SubscriptionService
from dotmac.platform.webhooks.events import get_event_bus
from dotmac.platform.webhooks.models import WebhookEvent

logger = logging.getLogger(__name__)


class WebhookHandler(ABC):
    """Base webhook handler interface with subscription support"""

    def __init__(self, db: AsyncSession, config: BillingConfig | None = None) -> None:
        self.db = db
        self.config = config or get_billing_config()
        self.invoice_service = InvoiceService(db)
        self.payment_service = PaymentService(db)
        self.subscription_service = SubscriptionService(db)  # Initialize subscription service
        self.metrics = get_billing_metrics()

    @abstractmethod
    async def verify_signature(
        self, payload: bytes, signature: str, headers: dict[str, str] | None = None
    ) -> bool:
        """Verify webhook signature"""
        pass

    @abstractmethod
    async def process_event(self, event_type: str, event_data: dict[str, Any]) -> dict[str, Any]:
        """Process webhook event"""
        pass

    async def handle_webhook(
        self, payload: bytes, signature: str, headers: dict[str, str]
    ) -> dict[str, Any]:
        """Handle webhook request"""
        import time

        start_time = time.time()

        # Verify signature
        if not await self.verify_signature(payload, signature, headers):
            logger.warning("Invalid webhook signature")
            raise ValueError("Invalid webhook signature")

        # Parse payload
        try:
            data = json.loads(payload)
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse webhook payload: {e}")
            raise ValueError("Invalid webhook payload")

        # Extract event type and data
        event_type = self._extract_event_type(data, headers)
        event_data = self._extract_event_data(data)
        provider = self._get_provider_name()

        # Record webhook received
        self.metrics.record_webhook_received(provider, event_type)

        # Process event
        try:
            result = await self.process_event(event_type, event_data)
            await self.db.commit()

            # Record successful processing
            duration_ms = (time.time() - start_time) * 1000
            self.metrics.record_webhook_processed(provider, event_type, True, duration_ms)

            return result
        except Exception as e:
            logger.error(f"Failed to process webhook event: {e}")
            await self.db.rollback()

            # Record failed processing
            duration_ms = (time.time() - start_time) * 1000
            self.metrics.record_webhook_processed(provider, event_type, False, duration_ms)

            raise

    @abstractmethod
    def _extract_event_type(self, data: dict[str, Any], headers: dict[str, str]) -> str:
        """Extract event type from webhook data"""
        pass

    @abstractmethod
    def _extract_event_data(self, data: dict[str, Any]) -> dict[str, Any]:
        """Extract event data from webhook payload"""
        pass

    @abstractmethod
    def _get_provider_name(self) -> str:
        """Get the payment provider name"""
        pass


class StripeWebhookHandler(WebhookHandler):
    """Stripe webhook handler with full subscription integration"""

    def _get_provider_name(self) -> str:
        """Get the payment provider name"""
        return "stripe"

    async def verify_signature(
        self, payload: bytes, signature: str, headers: dict[str, str] | None = None
    ) -> bool:
        """Verify Stripe webhook signature using webhook secret"""
        if not self.config.stripe or not self.config.stripe.webhook_secret:
            logger.error("Stripe webhook secret not configured")
            return False

        try:
            # Parse Stripe signature header
            timestamp = None
            signatures = []
            for item in signature.split(","):
                key, value = item.split("=")
                if key == "t":
                    timestamp = value
                elif key == "v1":
                    signatures.append(value)

            if not timestamp or not signatures:
                return False

            # Construct signed payload
            signed_payload = f"{timestamp}.{payload.decode('utf-8')}"

            # Compute expected signature
            expected_signature = hmac.new(
                self.config.stripe.webhook_secret.encode("utf-8"),
                signed_payload.encode("utf-8"),
                hashlib.sha256,
            ).hexdigest()

            # Check if any signature matches
            return any(hmac.compare_digest(sig, expected_signature) for sig in signatures)

        except Exception as e:
            logger.error(f"Failed to verify Stripe signature: {e}")
            return False

    def _extract_event_type(self, data: dict[str, Any], headers: dict[str, str]) -> str:
        """Extract Stripe event type"""
        event_type: str = data.get("type", "")
        return event_type

    def _extract_event_data(self, data: dict[str, Any]) -> dict[str, Any]:
        """Extract Stripe event data"""
        event_obj: dict[str, Any] = data.get("data", {})
        result: dict[str, Any] = event_obj.get("object", {})
        return result

    def _get_event_handlers(self) -> dict[str, Any]:
        """Get event type to handler method mapping."""
        return {
            # Payment events
            "payment_intent.succeeded": self._handle_payment_succeeded,
            "payment_intent.payment_failed": self._handle_payment_failed,
            "charge.refunded": self._handle_charge_refunded,
            # Invoice events
            "invoice.payment_succeeded": self._handle_invoice_paid,
            "invoice.payment_failed": self._handle_invoice_payment_failed,
            "invoice.finalized": self._handle_invoice_finalized,
            # Customer subscription events
            "customer.subscription.created": self._handle_subscription_created,
            "customer.subscription.updated": self._handle_subscription_updated,
            "customer.subscription.deleted": self._handle_subscription_cancelled,
            "customer.subscription.trial_will_end": self._handle_subscription_trial_ending,
        }

    async def process_event(self, event_type: str, event_data: dict[str, Any]) -> dict[str, Any]:
        """Process Stripe webhook events"""
        logger.info(f"Processing Stripe event: {event_type}")

        # Get handler for event type
        handlers = self._get_event_handlers()
        handler = handlers.get(event_type)

        if handler:
            result: dict[str, Any] = await handler(event_data)
            return result
        else:
            logger.info(f"Unhandled Stripe event type: {event_type}")
            return {"status": "ignored", "event_type": event_type}

    async def _handle_payment_succeeded(self, event_data: dict[str, Any]) -> dict[str, Any]:
        """Handle successful payment"""
        payment_intent_id = event_data.get("id")
        amount = event_data.get("amount")
        currency = event_data.get("currency")
        metadata = event_data.get("metadata", {})

        tenant_id = metadata.get("tenant_id")
        invoice_id = metadata.get("invoice_id")
        payment_id = metadata.get("payment_id")

        # Update payment status
        if payment_id and tenant_id:
            await self.payment_service.update_payment_status(
                tenant_id=tenant_id,
                payment_id=payment_id,
                new_status=PaymentStatus.SUCCEEDED,
                provider_data={
                    "stripe_payment_intent_id": payment_intent_id,
                    "stripe_amount": amount,
                    "stripe_currency": currency,
                },
            )

        # Mark invoice as paid if linked
        if invoice_id and tenant_id:
            await self.invoice_service.mark_invoice_paid(
                tenant_id, invoice_id, payment_id=payment_id
            )

        return {
            "status": "processed",
            "payment_intent_id": payment_intent_id,
            "amount": amount,
            "currency": currency,
        }

    async def _handle_payment_failed(self, event_data: dict[str, Any]) -> dict[str, Any]:
        """Handle failed payment"""
        payment_intent_id = event_data.get("id")
        error_message = event_data.get("last_payment_error", {}).get("message")
        metadata = event_data.get("metadata", {})

        tenant_id = metadata.get("tenant_id")
        payment_id = metadata.get("payment_id")

        # Update payment status
        if payment_id and tenant_id:
            await self.payment_service.update_payment_status(
                tenant_id=tenant_id,
                payment_id=payment_id,
                new_status=PaymentStatus.FAILED,
                provider_data={
                    "stripe_payment_intent_id": payment_intent_id,
                    "stripe_error": error_message,
                },
                error_message=error_message,
            )

        return {
            "status": "processed",
            "payment_intent_id": payment_intent_id,
            "error": error_message,
        }

    async def _handle_charge_refunded(self, event_data: dict[str, Any]) -> dict[str, Any]:
        """Handle charge refund"""
        from decimal import Decimal

        charge_id = event_data.get("id")
        amount_refunded = event_data.get("amount_refunded")  # in cents
        refunds = event_data.get("refunds", {}).get("data", [])
        metadata = event_data.get("metadata", {})

        tenant_id = metadata.get("tenant_id")
        payment_id = metadata.get("payment_id")

        # Process refund notification
        if payment_id and tenant_id and amount_refunded:
            # Keep amount in minor units (cents) to match payment.amount storage
            refund_amount = Decimal(str(amount_refunded))

            # Get the most recent refund for details
            refund_reason = None
            provider_refund_id = None
            if refunds:
                latest_refund = refunds[0]
                refund_reason = latest_refund.get("reason")
                provider_refund_id = latest_refund.get("id")

            await self.payment_service.process_refund_notification(
                tenant_id=tenant_id,
                payment_id=payment_id,
                refund_amount=refund_amount,
                provider_refund_id=provider_refund_id,
                reason=refund_reason or "Refunded via Stripe",
            )

        return {
            "status": "processed",
            "charge_id": charge_id,
            "amount_refunded": amount_refunded,
        }

    async def _handle_invoice_paid(self, event_data: dict[str, Any]) -> dict[str, Any]:
        """Handle invoice payment succeeded"""
        stripe_invoice_id = event_data.get("id")
        metadata = event_data.get("metadata", {})
        tenant_id = metadata.get("tenant_id")
        invoice_id = metadata.get("invoice_id")

        if invoice_id and tenant_id:
            await self.invoice_service.mark_invoice_paid(tenant_id, invoice_id)

        return {
            "status": "processed",
            "stripe_invoice_id": stripe_invoice_id,
            "invoice_id": invoice_id,
        }

    async def _handle_invoice_payment_failed(self, event_data: dict[str, Any]) -> dict[str, Any]:
        """Handle invoice payment failed"""
        stripe_invoice_id = event_data.get("id")
        metadata = event_data.get("metadata", {})
        tenant_id = metadata.get("tenant_id")
        invoice_id = metadata.get("invoice_id")

        if invoice_id and tenant_id:
            # Update invoice status
            invoice = await self.invoice_service.get_invoice(tenant_id, invoice_id)
            if invoice:
                invoice.payment_status = PaymentStatus.FAILED
                await self.db.commit()

                # Publish webhook event
                try:
                    await get_event_bus().publish(
                        event_type=WebhookEvent.INVOICE_PAYMENT_FAILED.value,
                        event_data={
                            "invoice_id": invoice_id,
                            "invoice_number": invoice.invoice_number,
                            "customer_id": invoice.customer_id,
                            "amount": invoice.total_amount,
                            "currency": invoice.currency,
                            "status": invoice.status.value,
                            "payment_status": invoice.payment_status.value,
                            "stripe_invoice_id": stripe_invoice_id,
                            "failed_at": datetime.now(UTC).isoformat(),
                        },
                        tenant_id=tenant_id,
                        db=self.db,
                    )
                except Exception as e:
                    logger.warning("Failed to publish invoice.payment_failed event", error=str(e))

        return {
            "status": "processed",
            "stripe_invoice_id": stripe_invoice_id,
            "invoice_id": invoice_id,
        }

    async def _handle_invoice_finalized(self, event_data: dict[str, Any]) -> dict[str, Any]:
        """Handle invoice finalized"""
        stripe_invoice_id = event_data.get("id")
        metadata = event_data.get("metadata", {})
        tenant_id = metadata.get("tenant_id")
        invoice_id = metadata.get("invoice_id")

        if invoice_id and tenant_id:
            # Finalize invoice if still draft
            invoice = await self.invoice_service.get_invoice(tenant_id, invoice_id)
            if invoice and invoice.status == InvoiceStatus.DRAFT:
                await self.invoice_service.finalize_invoice(tenant_id, invoice_id)

        return {
            "status": "processed",
            "stripe_invoice_id": stripe_invoice_id,
            "invoice_id": invoice_id,
        }

    async def _handle_subscription_created(self, event_data: dict[str, Any]) -> dict[str, Any]:
        """Handle subscription created with full integration"""
        subscription_id = event_data.get("id")
        customer_id = event_data.get("customer")
        metadata = event_data.get("metadata", {})

        tenant_id = metadata.get("tenant_id")
        customer_id_internal = metadata.get("customer_id")
        plan_id = metadata.get("plan_id")

        logger.info(f"Subscription created: {subscription_id} for customer {customer_id}")

        if tenant_id and customer_id_internal and plan_id:
            try:
                # Create subscription in our system
                subscription_request = SubscriptionCreateRequest(
                    customer_id=customer_id_internal,
                    plan_id=plan_id,
                    start_date=None,
                    custom_price=None,
                    trial_end_override=None,
                    metadata={
                        "stripe_customer_id": customer_id,
                        "stripe_subscription_id": subscription_id,
                        "created_via": "stripe_webhook",
                    },
                )

                subscription = await self.subscription_service.create_subscription(
                    subscription_data=subscription_request, tenant_id=tenant_id
                )

                # Record subscription created event
                await self.subscription_service.record_event(
                    subscription_id=subscription.subscription_id,
                    tenant_id=tenant_id,
                    event_type=SubscriptionEventType.CREATED,
                    event_data={
                        "source": "stripe_webhook",
                        "stripe_subscription_id": subscription_id,
                    },
                )

                logger.info(
                    f"Created subscription {subscription.subscription_id} from Stripe webhook"
                )

                return {
                    "status": "processed",
                    "subscription_id": subscription.subscription_id,
                    "stripe_subscription_id": subscription_id,
                }
            except Exception as e:
                logger.error(f"Failed to create subscription from webhook: {e}")
                return {
                    "status": "error",
                    "error": str(e),
                    "stripe_subscription_id": subscription_id,
                }

        return {
            "status": "acknowledged",
            "subscription_id": subscription_id,
            "message": "Missing metadata for full integration",
        }

    async def _handle_subscription_updated(self, event_data: dict[str, Any]) -> dict[str, Any]:
        """Handle subscription updated with full integration"""
        stripe_subscription_id = event_data.get("id")
        status = event_data.get("status")
        metadata = event_data.get("metadata", {})

        tenant_id = metadata.get("tenant_id")
        subscription_id = metadata.get("subscription_id")

        logger.info(f"Subscription updated: {stripe_subscription_id}, status: {status}")

        if tenant_id and subscription_id:
            try:
                # Map Stripe status to our status
                status_map: dict[str, SubscriptionStatus] = {
                    "active": SubscriptionStatus.ACTIVE,
                    "past_due": SubscriptionStatus.PAST_DUE,
                    "canceled": SubscriptionStatus.CANCELED,
                    "incomplete": SubscriptionStatus.INCOMPLETE,
                    "incomplete_expired": SubscriptionStatus.ENDED,
                    "trialing": SubscriptionStatus.TRIALING,
                    "unpaid": SubscriptionStatus.PAST_DUE,
                }

                status_str: str = str(status) if status else ""
                new_status = status_map.get(status_str)

                if new_status:
                    # Update subscription status
                    subscription = await self.subscription_service.get_subscription(
                        subscription_id=subscription_id, tenant_id=tenant_id
                    )

                    if subscription and subscription.status != new_status:
                        # Update metadata to track the status change
                        updated_metadata = (
                            subscription.metadata.copy() if subscription.metadata else {}
                        )
                        updated_metadata["last_stripe_update"] = datetime.now(UTC).isoformat()
                        updated_metadata["stripe_status"] = status_str

                        update_request = SubscriptionUpdateRequest(
                            status=new_status, metadata=updated_metadata
                        )

                        await self.subscription_service.update_subscription(
                            subscription_id=subscription_id,
                            updates=update_request,
                            tenant_id=tenant_id,
                        )

                        # Record status change event - use appropriate event type based on new status
                        event_type_map = {
                            SubscriptionStatus.ACTIVE: SubscriptionEventType.ACTIVATED,
                            SubscriptionStatus.CANCELED: SubscriptionEventType.CANCELED,
                            SubscriptionStatus.PAUSED: SubscriptionEventType.PAUSED,
                            SubscriptionStatus.ENDED: SubscriptionEventType.ENDED,
                        }
                        event_type = event_type_map.get(new_status, SubscriptionEventType.RENEWED)

                        await self.subscription_service.record_event(
                            subscription_id=subscription_id,
                            tenant_id=tenant_id,
                            event_type=event_type,
                            event_data={
                                "old_status": subscription.status.value,
                                "new_status": new_status.value,
                                "source": "stripe_webhook",
                            },
                        )

                        logger.info(
                            f"Updated subscription {subscription_id} status to {new_status.value}"
                        )

                return {
                    "status": "processed",
                    "subscription_id": subscription_id,
                    "new_status": new_status.value if new_status else status,
                }
            except Exception as e:
                logger.error(f"Failed to update subscription from webhook: {e}")
                return {
                    "status": "error",
                    "error": str(e),
                    "stripe_subscription_id": stripe_subscription_id,
                }

        return {"status": "acknowledged", "subscription_id": stripe_subscription_id}

    async def _handle_subscription_cancelled(self, event_data: dict[str, Any]) -> dict[str, Any]:
        """Handle subscription cancelled with full integration"""
        stripe_subscription_id = event_data.get("id")
        metadata = event_data.get("metadata", {})

        tenant_id = metadata.get("tenant_id")
        subscription_id = metadata.get("subscription_id")

        logger.info(f"Subscription cancelled: {stripe_subscription_id}")

        if tenant_id and subscription_id:
            try:
                # Cancel subscription in our system (immediately since Stripe already cancelled it)
                await self.subscription_service.cancel_subscription(
                    subscription_id=subscription_id,
                    tenant_id=tenant_id,
                    at_period_end=False,  # Immediate cancellation
                )

                # Record cancellation event
                await self.subscription_service.record_event(
                    subscription_id=subscription_id,
                    tenant_id=tenant_id,
                    event_type=SubscriptionEventType.CANCELED,
                    event_data={
                        "source": "stripe_webhook",
                        "stripe_subscription_id": stripe_subscription_id,
                        "reason": "Cancelled via Stripe",
                    },
                )

                logger.info(f"Cancelled subscription {subscription_id} from Stripe webhook")

                return {
                    "status": "processed",
                    "subscription_id": subscription_id,
                    "message": "Subscription cancelled",
                }
            except Exception as e:
                logger.error(f"Failed to cancel subscription from webhook: {e}")
                return {
                    "status": "error",
                    "error": str(e),
                    "stripe_subscription_id": stripe_subscription_id,
                }

        return {"status": "acknowledged", "subscription_id": stripe_subscription_id}

    async def _handle_subscription_trial_ending(self, event_data: dict[str, Any]) -> dict[str, Any]:
        """Handle subscription trial ending notification"""
        stripe_subscription_id = event_data.get("id")
        trial_end = event_data.get("trial_end")
        metadata = event_data.get("metadata", {})

        tenant_id = metadata.get("tenant_id")
        subscription_id = metadata.get("subscription_id")

        logger.info(f"Subscription trial ending: {stripe_subscription_id}")

        if tenant_id and subscription_id:
            # Record trial ending event
            await self.subscription_service.record_event(
                subscription_id=subscription_id,
                tenant_id=tenant_id,
                event_type=SubscriptionEventType.TRIAL_ENDING,
                event_data={
                    "trial_end": trial_end,
                    "source": "stripe_webhook",
                    "stripe_event": "customer.subscription.trial_will_end",
                },
            )

            # Could trigger notifications to customer here

            return {
                "status": "processed",
                "subscription_id": subscription_id,
                "trial_end": trial_end,
            }

        return {"status": "acknowledged", "subscription_id": stripe_subscription_id}


class PayPalWebhookHandler(WebhookHandler):
    """PayPal webhook handler with signature verification and subscription integration"""

    def _get_provider_name(self) -> str:
        """Get the payment provider name"""
        return "paypal"

    def _validate_paypal_config(self) -> tuple[bool, bool]:
        """Validate PayPal configuration and return (is_valid, is_sandbox)."""
        if not self.config.paypal:
            logger.error("PayPal configuration not found")
            return False, False

        is_sandbox = self.config.paypal.environment == "sandbox"

        if is_sandbox:
            logger.warning("PayPal webhook signature verification in sandbox mode")
            if not self.config.paypal.webhook_id:
                logger.warning("PayPal webhook ID not configured, skipping verification in sandbox")
                return False, True  # Skip verification in sandbox without webhook_id

        return True, is_sandbox

    def _extract_paypal_headers(
        self, headers: dict[str, str] | None, signature: str
    ) -> dict[str, str] | None:
        """Extract and validate PayPal webhook headers."""
        if not headers:
            logger.error("Missing headers for PayPal webhook verification")
            return None

        extracted = {
            "transmission_id": headers.get("paypal-transmission-id", ""),
            "transmission_time": headers.get("paypal-transmission-time", ""),
            "cert_url": headers.get("paypal-cert-url", ""),
            "auth_algo": headers.get("paypal-auth-algo", ""),
            "transmission_sig": headers.get("paypal-transmission-sig", signature),
        }

        if not all(extracted.values()):
            logger.error("Missing required PayPal webhook headers")
            return None

        return extracted

    def _build_verification_data(
        self, extracted_headers: dict[str, str], payload: bytes
    ) -> dict[str, Any]:
        """Build PayPal verification request data."""
        if not self.config.paypal or not self.config.paypal.webhook_id:
            raise ValueError("PayPal webhook_id not configured")

        return {
            "auth_algo": extracted_headers["auth_algo"],
            "cert_url": extracted_headers["cert_url"],
            "transmission_id": extracted_headers["transmission_id"],
            "transmission_sig": extracted_headers["transmission_sig"],
            "transmission_time": extracted_headers["transmission_time"],
            "webhook_id": self.config.paypal.webhook_id,
            "webhook_event": json.loads(payload),
        }

    def _handle_verification_response(self, response: httpx.Response, is_sandbox: bool) -> bool:
        """Handle PayPal verification response."""
        if response.status_code == 200:
            result = response.json()
            verification_status = result.get("verification_status")

            if verification_status == "SUCCESS":
                logger.info("PayPal webhook signature verified successfully")
                return True
            else:
                logger.warning(f"PayPal webhook verification failed: {verification_status}")
                return False
        else:
            logger.error(f"PayPal verification API error: {response.status_code}")
            if is_sandbox:
                logger.warning("Allowing webhook in sandbox despite verification failure")
                return True
            return False

    async def verify_signature(
        self, payload: bytes, signature: str, headers: dict[str, str] | None = None
    ) -> bool:
        """Verify PayPal webhook signature with full implementation"""
        # Validate configuration
        config_valid, is_sandbox = self._validate_paypal_config()
        if not config_valid:
            return is_sandbox  # True in sandbox without webhook_id, False otherwise

        try:
            # Extract headers
            extracted_headers = self._extract_paypal_headers(headers, signature)
            if not extracted_headers:
                return False

            # Build verification request
            verification_url = (
                f"{self._get_paypal_base_url()}/v1/notifications/verify-webhook-signature"
            )
            verification_data = self._build_verification_data(extracted_headers, payload)

            # Get access token
            access_token = await self._get_paypal_access_token()

            # Make verification request
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    verification_url,
                    json=verification_data,
                    headers={
                        "Authorization": f"Bearer {access_token}",
                        "Content-Type": "application/json",
                    },
                    timeout=10.0,
                )

                return self._handle_verification_response(response, is_sandbox)

        except Exception as e:
            logger.error(f"Failed to verify PayPal signature: {e}")
            # Fail closed in production, lenient in sandbox
            if self.config.paypal and self.config.paypal.environment == "production":
                return False
            logger.warning("Allowing webhook in sandbox despite verification error")
            return True

    def _get_paypal_base_url(self) -> str:
        """Get PayPal API base URL based on environment"""
        if not self.config.paypal:
            raise ValueError("PayPal configuration not found")

        if self.config.paypal.environment == "sandbox":
            return "https://api.sandbox.paypal.com"
        return "https://api.paypal.com"

    async def _get_paypal_access_token(self) -> str:
        """Get PayPal OAuth access token"""
        if not self.config.paypal:
            raise ValueError("PayPal configuration not found")

        auth_url = f"{self._get_paypal_base_url()}/v1/oauth2/token"

        # Create basic auth header
        credentials = f"{self.config.paypal.client_id}:{self.config.paypal.client_secret}"
        encoded_credentials = base64.b64encode(credentials.encode()).decode()

        async with httpx.AsyncClient() as client:
            response = await client.post(
                auth_url,
                data={"grant_type": "client_credentials"},
                headers={
                    "Authorization": f"Basic {encoded_credentials}",
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                timeout=10.0,
            )

            if response.status_code == 200:
                token_data = response.json()
                access_token: str = token_data.get("access_token", "")
                if not access_token:
                    raise Exception("PayPal access token not found in response")
                return access_token
            else:
                raise Exception(f"Failed to get PayPal access token: {response.status_code}")

    def _extract_event_type(self, data: dict[str, Any], headers: dict[str, str]) -> str:
        """Extract PayPal event type"""
        event_type: str = data.get("event_type", "")
        return event_type

    def _extract_event_data(self, data: dict[str, Any]) -> dict[str, Any]:
        """Extract PayPal event data"""
        resource: dict[str, Any] = data.get("resource", {})
        return resource

    async def process_event(self, event_type: str, event_data: dict[str, Any]) -> dict[str, Any]:
        """Process PayPal webhook events"""
        logger.info(f"Processing PayPal event: {event_type}")

        # Payment events
        if event_type == "PAYMENT.CAPTURE.COMPLETED":
            return await self._handle_payment_completed(event_data)
        elif event_type == "PAYMENT.CAPTURE.DENIED":
            return await self._handle_payment_denied(event_data)
        elif event_type == "PAYMENT.CAPTURE.REFUNDED":
            return await self._handle_payment_refunded(event_data)

        # Subscription events
        elif event_type == "BILLING.SUBSCRIPTION.CREATED":
            return await self._handle_subscription_created(event_data)
        elif event_type == "BILLING.SUBSCRIPTION.ACTIVATED":
            return await self._handle_subscription_activated(event_data)
        elif event_type == "BILLING.SUBSCRIPTION.UPDATED":
            return await self._handle_subscription_updated(event_data)
        elif event_type == "BILLING.SUBSCRIPTION.CANCELLED":
            return await self._handle_subscription_cancelled(event_data)
        elif event_type == "BILLING.SUBSCRIPTION.SUSPENDED":
            return await self._handle_subscription_suspended(event_data)
        elif event_type == "BILLING.SUBSCRIPTION.PAYMENT.FAILED":
            return await self._handle_subscription_payment_failed(event_data)

        else:
            logger.info(f"Unhandled PayPal event type: {event_type}")
            return {"status": "ignored", "event_type": event_type}

    async def _handle_payment_completed(self, event_data: dict[str, Any]) -> dict[str, Any]:
        """Handle payment completed"""
        capture_id = event_data.get("id")
        amount = event_data.get("amount", {}).get("value")
        currency = event_data.get("amount", {}).get("currency_code")
        custom_id = event_data.get("custom_id")

        # Parse custom_id for tenant_id and payment_id
        if custom_id:
            parts = custom_id.split(":")
            if len(parts) >= 2:
                tenant_id = parts[0]
                payment_id = parts[1]

                # Update payment status
                await self.payment_service.update_payment_status(
                    tenant_id=tenant_id,
                    payment_id=payment_id,
                    new_status=PaymentStatus.SUCCEEDED,
                    provider_data={
                        "paypal_capture_id": capture_id,
                        "paypal_amount": amount,
                        "paypal_currency": currency,
                    },
                )

        return {
            "status": "processed",
            "capture_id": capture_id,
            "amount": amount,
            "currency": currency,
        }

    async def _handle_payment_denied(self, event_data: dict[str, Any]) -> dict[str, Any]:
        """Handle payment denied"""
        capture_id = event_data.get("id")
        custom_id = event_data.get("custom_id")
        status_details = event_data.get("status_details", {})

        # Parse custom_id for tenant_id and payment_id
        if custom_id:
            parts = custom_id.split(":")
            if len(parts) >= 2:
                tenant_id = parts[0]
                payment_id = parts[1]

                # Update payment status
                await self.payment_service.update_payment_status(
                    tenant_id=tenant_id,
                    payment_id=payment_id,
                    new_status=PaymentStatus.FAILED,
                    provider_data={
                        "paypal_capture_id": capture_id,
                        "paypal_status_details": status_details,
                    },
                    error_message="Payment denied by PayPal",
                )

        return {"status": "processed", "capture_id": capture_id}

    async def _handle_payment_refunded(self, event_data: dict[str, Any]) -> dict[str, Any]:
        """Handle payment refunded"""
        from decimal import Decimal

        refund_id = event_data.get("id")
        amount = event_data.get("amount", {}).get("value")
        custom_id = event_data.get("custom_id")

        # Parse custom_id for tenant_id and payment_id
        if custom_id and amount:
            parts = custom_id.split(":")
            if len(parts) >= 2:
                tenant_id = parts[0]
                payment_id = parts[1]

                # Process refund notification
                refund_amount = Decimal(str(amount))
                await self.payment_service.process_refund_notification(
                    tenant_id=tenant_id,
                    payment_id=payment_id,
                    refund_amount=refund_amount,
                    provider_refund_id=refund_id,
                    reason="Refunded via PayPal",
                )

        return {"status": "processed", "refund_id": refund_id, "amount": amount}

    async def _handle_subscription_created(self, event_data: dict[str, Any]) -> dict[str, Any]:
        """Handle subscription created with full integration"""
        paypal_subscription_id = event_data.get("id")
        plan_id = event_data.get("plan_id")
        custom_id = event_data.get("custom_id")

        logger.info(f"PayPal subscription created: {paypal_subscription_id}")

        # Parse custom_id for tenant_id and customer_id
        if custom_id:
            parts = custom_id.split(":")
            if len(parts) >= 2:
                tenant_id = parts[0]
                customer_id = parts[1]
                internal_plan_id = parts[2] if len(parts) > 2 else plan_id

                try:
                    # Ensure plan_id is a string
                    plan_str: str = str(internal_plan_id) if internal_plan_id else str(plan_id)

                    # Create subscription in our system
                    subscription_request = SubscriptionCreateRequest(
                        customer_id=customer_id,
                        plan_id=plan_str,
                        start_date=None,
                        custom_price=None,
                        trial_end_override=None,
                        metadata={
                            "paypal_subscription_id": paypal_subscription_id,
                            "paypal_plan_id": plan_id,
                            "created_via": "paypal_webhook",
                        },
                    )

                    subscription = await self.subscription_service.create_subscription(
                        subscription_data=subscription_request, tenant_id=tenant_id
                    )

                    # Record subscription created event
                    await self.subscription_service.record_event(
                        subscription_id=subscription.subscription_id,
                        tenant_id=tenant_id,
                        event_type=SubscriptionEventType.CREATED,
                        event_data={
                            "source": "paypal_webhook",
                            "paypal_subscription_id": paypal_subscription_id,
                        },
                    )

                    logger.info(
                        f"Created subscription {subscription.subscription_id} from PayPal webhook"
                    )

                    return {
                        "status": "processed",
                        "subscription_id": subscription.subscription_id,
                        "paypal_subscription_id": paypal_subscription_id,
                    }
                except Exception as e:
                    logger.error(f"Failed to create subscription from PayPal webhook: {e}")
                    return {
                        "status": "error",
                        "error": str(e),
                        "paypal_subscription_id": paypal_subscription_id,
                    }

        return {"status": "acknowledged", "subscription_id": paypal_subscription_id}

    async def _handle_subscription_activated(self, event_data: dict[str, Any]) -> dict[str, Any]:
        """Handle subscription activated"""
        paypal_subscription_id = event_data.get("id")
        custom_id = event_data.get("custom_id")

        if custom_id:
            parts = custom_id.split(":")
            if len(parts) >= 3:
                tenant_id = parts[0]
                subscription_id = parts[2]  # Our internal subscription ID

                try:
                    # Update subscription status to active
                    update_request = SubscriptionUpdateRequest(
                        status=SubscriptionStatus.ACTIVE,
                        metadata={"paypal_activated": datetime.now(UTC).isoformat()},
                    )

                    await self.subscription_service.update_subscription(
                        subscription_id=subscription_id,
                        updates=update_request,
                        tenant_id=tenant_id,
                    )

                    # Record activation event
                    await self.subscription_service.record_event(
                        subscription_id=subscription_id,
                        tenant_id=tenant_id,
                        event_type=SubscriptionEventType.ACTIVATED,
                        event_data={
                            "source": "paypal_webhook",
                            "paypal_subscription_id": paypal_subscription_id,
                        },
                    )

                    return {
                        "status": "processed",
                        "subscription_id": subscription_id,
                        "message": "Subscription activated",
                    }
                except Exception as e:
                    logger.error(f"Failed to activate subscription: {e}")
                    return {"status": "error", "error": str(e)}

        return {"status": "acknowledged", "subscription_id": paypal_subscription_id}

    async def _handle_subscription_updated(self, event_data: dict[str, Any]) -> dict[str, Any]:
        """Handle subscription updated"""
        paypal_subscription_id = event_data.get("id")
        status = event_data.get("status")
        custom_id = event_data.get("custom_id")

        logger.info(f"PayPal subscription updated: {paypal_subscription_id}, status: {status}")

        if custom_id:
            parts = custom_id.split(":")
            if len(parts) >= 3:
                tenant_id = parts[0]
                subscription_id = parts[2]

                try:
                    # Map PayPal status to our status
                    status_map: dict[str, SubscriptionStatus] = {
                        "ACTIVE": SubscriptionStatus.ACTIVE,
                        "SUSPENDED": SubscriptionStatus.PAUSED,
                        "CANCELLED": SubscriptionStatus.CANCELED,
                        "EXPIRED": SubscriptionStatus.ENDED,
                    }

                    status_str: str = str(status) if status else ""
                    new_status = status_map.get(status_str)

                    if new_status:
                        update_request = SubscriptionUpdateRequest(
                            status=new_status,
                            metadata={
                                "last_paypal_update": datetime.now(UTC).isoformat(),
                                "paypal_status": status_str,
                            },
                        )

                        await self.subscription_service.update_subscription(
                            subscription_id=subscription_id,
                            updates=update_request,
                            tenant_id=tenant_id,
                        )

                        # Record status change event - use appropriate event type
                        event_type_map = {
                            SubscriptionStatus.ACTIVE: SubscriptionEventType.ACTIVATED,
                            SubscriptionStatus.CANCELED: SubscriptionEventType.CANCELED,
                            SubscriptionStatus.PAUSED: SubscriptionEventType.PAUSED,
                            SubscriptionStatus.ENDED: SubscriptionEventType.ENDED,
                        }
                        event_type = event_type_map.get(new_status, SubscriptionEventType.RENEWED)

                        await self.subscription_service.record_event(
                            subscription_id=subscription_id,
                            tenant_id=tenant_id,
                            event_type=event_type,
                            event_data={"new_status": new_status.value, "source": "paypal_webhook"},
                        )

                        return {
                            "status": "processed",
                            "subscription_id": subscription_id,
                            "new_status": new_status.value,
                        }
                except Exception as e:
                    logger.error(f"Failed to update subscription: {e}")
                    return {"status": "error", "error": str(e)}

        return {"status": "acknowledged", "subscription_id": paypal_subscription_id}

    async def _handle_subscription_cancelled(self, event_data: dict[str, Any]) -> dict[str, Any]:
        """Handle subscription cancelled with full integration"""
        paypal_subscription_id = event_data.get("id")
        custom_id = event_data.get("custom_id")

        logger.info(f"PayPal subscription cancelled: {paypal_subscription_id}")

        if custom_id:
            parts = custom_id.split(":")
            if len(parts) >= 3:
                tenant_id = parts[0]
                subscription_id = parts[2]

                try:
                    # Cancel subscription in our system (immediately since PayPal already cancelled it)
                    await self.subscription_service.cancel_subscription(
                        subscription_id=subscription_id,
                        tenant_id=tenant_id,
                        at_period_end=False,  # Immediate cancellation
                    )

                    # Record cancellation event
                    await self.subscription_service.record_event(
                        subscription_id=subscription_id,
                        tenant_id=tenant_id,
                        event_type=SubscriptionEventType.CANCELED,
                        event_data={
                            "source": "paypal_webhook",
                            "paypal_subscription_id": paypal_subscription_id,
                            "reason": "Cancelled via PayPal",
                        },
                    )

                    return {
                        "status": "processed",
                        "subscription_id": subscription_id,
                        "message": "Subscription cancelled",
                    }
                except Exception as e:
                    logger.error(f"Failed to cancel subscription: {e}")
                    return {"status": "error", "error": str(e)}

        return {"status": "acknowledged", "subscription_id": paypal_subscription_id}

    async def _handle_subscription_suspended(self, event_data: dict[str, Any]) -> dict[str, Any]:
        """Handle subscription suspended"""
        paypal_subscription_id = event_data.get("id")
        custom_id = event_data.get("custom_id")

        if custom_id:
            parts = custom_id.split(":")
            if len(parts) >= 3:
                tenant_id = parts[0]
                subscription_id = parts[2]

                try:
                    # Update subscription status to paused (suspended)
                    update_request = SubscriptionUpdateRequest(
                        status=SubscriptionStatus.PAUSED,
                        metadata={"paypal_suspended": datetime.now(UTC).isoformat()},
                    )

                    await self.subscription_service.update_subscription(
                        subscription_id=subscription_id,
                        updates=update_request,
                        tenant_id=tenant_id,
                    )

                    # Record suspension event
                    await self.subscription_service.record_event(
                        subscription_id=subscription_id,
                        tenant_id=tenant_id,
                        event_type=SubscriptionEventType.PAUSED,
                        event_data={
                            "source": "paypal_webhook",
                            "paypal_subscription_id": paypal_subscription_id,
                        },
                    )

                    return {
                        "status": "processed",
                        "subscription_id": subscription_id,
                        "message": "Subscription suspended",
                    }
                except Exception as e:
                    logger.error(f"Failed to suspend subscription: {e}")
                    return {"status": "error", "error": str(e)}

        return {"status": "acknowledged", "subscription_id": paypal_subscription_id}

    async def _handle_subscription_payment_failed(
        self, event_data: dict[str, Any]
    ) -> dict[str, Any]:
        """Handle subscription payment failed"""
        paypal_subscription_id = event_data.get("id")
        custom_id = event_data.get("custom_id")

        if custom_id:
            parts = custom_id.split(":")
            if len(parts) >= 3:
                tenant_id = parts[0]
                subscription_id = parts[2]

                try:
                    # Update subscription status to past_due due to payment failure
                    update_request = SubscriptionUpdateRequest(
                        status=SubscriptionStatus.PAST_DUE,
                        metadata={"last_payment_failed": datetime.now(UTC).isoformat()},
                    )

                    await self.subscription_service.update_subscription(
                        subscription_id=subscription_id,
                        updates=update_request,
                        tenant_id=tenant_id,
                    )

                    # Record payment failed event
                    await self.subscription_service.record_event(
                        subscription_id=subscription_id,
                        tenant_id=tenant_id,
                        event_type=SubscriptionEventType.PAYMENT_FAILED,
                        event_data={
                            "source": "paypal_webhook",
                            "paypal_subscription_id": paypal_subscription_id,
                        },
                    )

                    return {
                        "status": "processed",
                        "subscription_id": subscription_id,
                        "message": "Subscription payment failed, status updated to past_due",
                    }
                except Exception as e:
                    logger.error(f"Failed to update subscription after payment failure: {e}")
                    return {"status": "error", "error": str(e)}

        return {"status": "acknowledged", "subscription_id": paypal_subscription_id}
