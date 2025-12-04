"""
Payment provider interfaces and implementations
"""

import json
from abc import ABC, abstractmethod
from typing import Any, cast

import anyio
from pydantic import BaseModel, ConfigDict, Field


class PaymentResult(BaseModel):
    """Payment processing result"""

    model_config = ConfigDict()

    success: bool
    provider_payment_id: str | None = None
    provider_fee: int | None = None
    error_message: str | None = None
    error_code: str | None = None


class RefundResult(BaseModel):
    """Refund processing result"""

    model_config = ConfigDict()

    success: bool
    provider_refund_id: str | None = None
    error_message: str | None = None
    error_code: str | None = None


class SetupIntent(BaseModel):
    """Payment method setup intent"""

    model_config = ConfigDict()

    intent_id: str
    client_secret: str
    status: str
    payment_method_types: list[str] = Field(default_factory=lambda: [])


class PaymentProvider(ABC):
    """Abstract payment provider interface"""

    @abstractmethod
    async def charge_payment_method(
        self,
        amount: int,
        currency: str,
        payment_method_id: str,
        metadata: dict[str, Any] | None = None,
    ) -> PaymentResult:
        """Charge a payment method"""
        pass

    @abstractmethod
    async def refund_payment(
        self,
        provider_payment_id: str,
        amount: int,
        reason: str | None = None,
    ) -> RefundResult:
        """Refund a payment"""
        pass

    @abstractmethod
    async def create_setup_intent(
        self,
        customer_id: str,
        payment_method_types: list[str] | None = None,
    ) -> SetupIntent:
        """Create setup intent for payment method setup"""
        pass

    @abstractmethod
    async def create_payment_method(
        self,
        type: str,
        details: dict[str, Any],
        customer_id: str | None = None,
    ) -> dict[str, Any]:
        """Create a payment method"""
        pass

    @abstractmethod
    async def attach_payment_method_to_customer(
        self,
        payment_method_id: str,
        customer_id: str,
    ) -> dict[str, Any]:
        """Attach payment method to customer"""
        pass

    @abstractmethod
    async def detach_payment_method(
        self,
        payment_method_id: str,
    ) -> bool:
        """Detach payment method from customer"""
        pass

    @abstractmethod
    async def handle_webhook(
        self,
        webhook_data: dict[str, Any],
        signature: str | None = None,
    ) -> dict[str, Any]:
        """Handle provider webhook events"""
        pass


class StripePaymentProvider(PaymentProvider):
    """Stripe payment provider implementation"""

    def __init__(self, api_key: str, webhook_secret: str | None = None) -> None:
        self.api_key = api_key
        self.webhook_secret = webhook_secret
        # Import stripe here to avoid dependency if not using Stripe
        try:
            import stripe

            stripe.api_key = api_key
            self.stripe = cast(Any, stripe)
        except ImportError:
            raise ImportError("stripe package is required for StripePaymentProvider")

    async def charge_payment_method(
        self,
        amount: int,
        currency: str,
        payment_method_id: str,
        metadata: dict[str, Any] | None = None,
    ) -> PaymentResult:
        """Charge a payment method using Stripe"""

        try:
            # Create payment intent and confirm (run in thread to avoid blocking event loop)
            intent = await anyio.to_thread.run_sync(
                lambda: self.stripe.PaymentIntent.create(
                    amount=amount,
                    currency=currency.lower(),
                    payment_method=payment_method_id,
                    confirm=True,
                    metadata=metadata or {},
                )
            )

            if intent.status == "succeeded":
                return PaymentResult(
                    success=True,
                    provider_payment_id=intent.id,
                    provider_fee=(
                        intent.charges.data[0].balance_transaction.fee
                        if intent.charges.data
                        else None
                    ),
                )
            else:
                return PaymentResult(
                    success=False,
                    provider_payment_id=intent.id,
                    error_message=f"Payment intent status: {intent.status}",
                )

        except self.stripe.error.CardError as e:
            return PaymentResult(
                success=False,
                error_message=e.user_message,
                error_code=e.code,
            )
        except self.stripe.error.StripeError as e:
            return PaymentResult(
                success=False,
                error_message=str(e),
                error_code=getattr(e, "code", None),
            )
        except Exception as e:
            return PaymentResult(
                success=False,
                error_message=str(e),
            )

    async def refund_payment(
        self,
        provider_payment_id: str,
        amount: int,
        reason: str | None = None,
    ) -> RefundResult:
        """Refund a Stripe payment"""

        try:
            # Run blocking Stripe call in thread
            refund = await anyio.to_thread.run_sync(
                lambda: self.stripe.Refund.create(
                    payment_intent=provider_payment_id,
                    amount=amount,
                    reason=reason or "requested_by_customer",
                )
            )

            return RefundResult(
                success=True,
                provider_refund_id=refund.id,
            )

        except self.stripe.error.StripeError as e:
            return RefundResult(
                success=False,
                error_message=str(e),
                error_code=getattr(e, "code", None),
            )
        except Exception as e:
            return RefundResult(
                success=False,
                error_message=str(e),
            )

    async def create_setup_intent(
        self,
        customer_id: str,
        payment_method_types: list[str] | None = None,
    ) -> SetupIntent:
        """Create Stripe setup intent"""

        # Run blocking Stripe call in thread
        intent = await anyio.to_thread.run_sync(
            lambda: self.stripe.SetupIntent.create(
                customer=customer_id,
                payment_method_types=payment_method_types or ["card"],
            )
        )

        return SetupIntent(
            intent_id=intent.id,
            client_secret=intent.client_secret,
            status=intent.status,
            payment_method_types=intent.payment_method_types,
        )

    async def create_payment_method(
        self,
        type: str,
        details: dict[str, Any],
        customer_id: str | None = None,
    ) -> dict[str, Any]:
        """Create a Stripe payment method"""

        # Run blocking Stripe call in thread
        payment_method = await anyio.to_thread.run_sync(
            lambda: self.stripe.PaymentMethod.create(
                type=type,
                **details,
            )
        )

        if customer_id:
            # Run blocking Stripe call in thread
            payment_method = await anyio.to_thread.run_sync(
                lambda: self.stripe.PaymentMethod.attach(
                    payment_method.id,
                    customer=customer_id,
                )
            )

        return {
            "id": payment_method.id,
            "type": payment_method.type,
            "card": payment_method.card.to_dict() if payment_method.card else None,
            "bank_account": (
                payment_method.us_bank_account.to_dict()
                if hasattr(payment_method, "us_bank_account")
                else None
            ),
        }

    async def attach_payment_method_to_customer(
        self,
        payment_method_id: str,
        customer_id: str,
    ) -> dict[str, Any]:
        """Attach Stripe payment method to customer"""

        # Run blocking Stripe call in thread
        payment_method = await anyio.to_thread.run_sync(
            lambda: self.stripe.PaymentMethod.attach(
                payment_method_id,
                customer=customer_id,
            )
        )

        return {
            "id": payment_method.id,
            "customer": payment_method.customer,
        }

    async def detach_payment_method(
        self,
        payment_method_id: str,
    ) -> bool:
        """Detach Stripe payment method"""

        try:
            # Run blocking Stripe call in thread
            await anyio.to_thread.run_sync(
                lambda: self.stripe.PaymentMethod.detach(payment_method_id)
            )
            return True
        except Exception:
            return False

    async def handle_webhook(
        self,
        webhook_data: dict[str, Any],
        signature: str | None = None,
    ) -> dict[str, Any]:
        """Handle Stripe webhook events"""

        if not self.webhook_secret:
            raise ValueError("Webhook secret not configured")

        try:
            payload = json.dumps(webhook_data)
            signature_header = signature or ""
            # Run blocking Stripe call in thread
            event = await anyio.to_thread.run_sync(
                lambda: self.stripe.Webhook.construct_event(
                    payload,
                    signature_header,
                    self.webhook_secret,
                )
            )

            # Handle different event types
            if event.type == "payment_intent.succeeded":
                payment_intent = event.data.object
                return {
                    "event_type": "payment_succeeded",
                    "payment_id": payment_intent.id,
                    "amount": payment_intent.amount,
                    "currency": payment_intent.currency,
                }
            elif event.type == "payment_intent.payment_failed":
                payment_intent = event.data.object
                return {
                    "event_type": "payment_failed",
                    "payment_id": payment_intent.id,
                    "error": payment_intent.last_payment_error,
                }
            elif event.type == "charge.refunded":
                charge = event.data.object
                return {
                    "event_type": "refund_completed",
                    "charge_id": charge.id,
                    "refund_amount": charge.amount_refunded,
                }
            else:
                return {
                    "event_type": event.type,
                    "data": event.data.object,
                }

        except self.stripe.error.SignatureVerificationError:
            raise ValueError("Invalid webhook signature")


class MockPaymentProvider(PaymentProvider):
    """Mock payment provider for testing"""

    def __init__(self, always_succeed: bool = True) -> None:
        self.always_succeed = always_succeed
        self.payment_counter = 0
        self.refund_counter = 0

    async def charge_payment_method(
        self,
        amount: int,
        currency: str,
        payment_method_id: str,
        metadata: dict[str, Any] | None = None,
    ) -> PaymentResult:
        """Mock charge implementation"""

        self.payment_counter += 1

        if self.always_succeed:
            return PaymentResult(
                success=True,
                provider_payment_id=f"mock_payment_{self.payment_counter}",
                provider_fee=int(amount * 0.029),  # 2.9% fee
            )
        else:
            return PaymentResult(
                success=False,
                error_message="Mock payment failed",
                error_code="mock_error",
            )

    async def refund_payment(
        self,
        provider_payment_id: str,
        amount: int,
        reason: str | None = None,
    ) -> RefundResult:
        """Mock refund implementation"""

        self.refund_counter += 1

        if self.always_succeed:
            return RefundResult(
                success=True,
                provider_refund_id=f"mock_refund_{self.refund_counter}",
            )
        else:
            return RefundResult(
                success=False,
                error_message="Mock refund failed",
                error_code="mock_error",
            )

    async def create_setup_intent(
        self,
        customer_id: str,
        payment_method_types: list[str] | None = None,
    ) -> SetupIntent:
        """Mock setup intent creation"""

        return SetupIntent(
            intent_id=f"mock_setup_intent_{customer_id}",
            client_secret=f"mock_secret_{customer_id}",
            status="requires_payment_method",
            payment_method_types=payment_method_types or ["card"],
        )

    async def create_payment_method(
        self,
        type: str,
        details: dict[str, Any],
        customer_id: str | None = None,
    ) -> dict[str, Any]:
        """Mock payment method creation"""

        return {
            "id": f"mock_pm_{customer_id or 'guest'}",
            "type": type,
            "customer": customer_id,
        }

    async def attach_payment_method_to_customer(
        self,
        payment_method_id: str,
        customer_id: str,
    ) -> dict[str, Any]:
        """Mock payment method attachment"""

        return {
            "id": payment_method_id,
            "customer": customer_id,
        }

    async def detach_payment_method(
        self,
        payment_method_id: str,
    ) -> bool:
        """Mock payment method detachment"""

        return True

    async def handle_webhook(
        self,
        webhook_data: dict[str, Any],
        signature: str | None = None,
    ) -> dict[str, Any]:
        """Mock webhook handling"""

        return {
            "event_type": "mock_webhook",
            "data": webhook_data,
        }
