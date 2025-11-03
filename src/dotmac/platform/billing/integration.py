"""
Billing integration service.

Connects the billing system with existing invoice and payment systems.
Handles automated billing workflows and subscription lifecycle integration.
"""

import logging
from datetime import UTC, datetime, timedelta
from decimal import Decimal, InvalidOperation
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.customer_management.models import Customer

from .catalog.service import ProductService
from .core.enums import InvoiceStatus
from .invoicing.service import InvoiceService
from .pricing.models import PriceCalculationRequest
from .pricing.service import PricingEngine
from .subscriptions.models import (
    Subscription,
    SubscriptionEventType,
    SubscriptionPlan,
    SubscriptionStatus,
)
from .subscriptions.service import SubscriptionService

logger = logging.getLogger(__name__)


class InvoiceItem(BaseModel):
    """Invoice line item from billing calculation."""

    model_config = ConfigDict()

    description: str = Field(description="Item description")
    product_id: str = Field(description="Product identifier")
    quantity: int = Field(description="Quantity", ge=1)
    unit_price: Decimal = Field(description="Unit price")
    total_amount: Decimal = Field(description="Total amount before discounts")
    discount_amount: Decimal = Field(default=Decimal("0"), description="Discount applied")
    final_amount: Decimal = Field(description="Final amount after discounts")
    metadata: dict[str, Any] = Field(default_factory=dict, description="Additional metadata")


class BillingInvoiceRequest(BaseModel):
    """Request to create invoice from billing system."""

    model_config = ConfigDict()

    customer_id: str = Field(description="Customer identifier")
    subscription_id: str | None = Field(None, description="Related subscription")
    billing_period_start: datetime = Field(description="Billing period start")
    billing_period_end: datetime = Field(description="Billing period end")
    items: list[InvoiceItem] = Field(description="Invoice line items")
    subtotal: Decimal = Field(description="Subtotal before discounts")
    total_discount: Decimal = Field(description="Total discount amount")
    total_amount: Decimal = Field(description="Final invoice amount")
    currency: str = Field("USD", description="Currency code (ISO 4217)")
    metadata: dict[str, Any] = Field(default_factory=dict, description="Additional metadata")


class BillingIntegrationService:
    """Service for integrating billing system with invoices and payments."""

    def __init__(self, db_session: AsyncSession) -> None:
        self.db = db_session
        self.catalog_service = ProductService(db_session)
        self.subscription_service = SubscriptionService(db_session)
        self.pricing_service = PricingEngine(db_session)
        self.invoice_service = InvoiceService(db_session)

    async def process_subscription_billing(
        self, subscription_id: str, tenant_id: str
    ) -> str | None:
        """
        Process billing for a subscription.

        Returns invoice ID if created, None if no billing needed.
        """
        try:
            # Get subscription details
            subscription = await self.subscription_service.get_subscription(
                subscription_id, tenant_id
            )
            if not subscription or not subscription.is_active():
                logger.warning(
                    "Subscription not active for billing",
                    extra={"subscription_id": subscription_id, "tenant_id": tenant_id},
                )
                return None

            # Get subscription plan
            plan = await self.subscription_service.get_plan(subscription.plan_id, tenant_id)
            if not plan:
                logger.error(
                    "Plan not found for subscription",
                    extra={"subscription_id": subscription_id, "plan_id": subscription.plan_id},
                )
                return None

            # Skip if still in trial
            if subscription.is_in_trial():
                logger.info(
                    "Subscription in trial, skipping billing",
                    extra={"subscription_id": subscription_id},
                )
                return None

            # Calculate pricing
            invoice_items: list[InvoiceItem] = []
            total_amount = Decimal("0")
            total_discount = Decimal("0")

            # Base subscription fee
            effective_price: Decimal = subscription.custom_price or plan.price
            base_price = effective_price

            # Apply pricing rules for subscription
            pricing_request = PriceCalculationRequest(
                product_id=plan.product_id,
                quantity=1,
                customer_id=subscription.customer_id,
                customer_segments=[],  # Could be enhanced with customer segments
                calculation_date=datetime.now(UTC),
                currency=plan.currency,
            )

            pricing_result = await self.pricing_service.calculate_price(pricing_request, tenant_id)

            # Create base subscription item
            subscription_item = InvoiceItem(
                description=f"Subscription: {plan.name}",
                product_id=plan.product_id,
                quantity=1,
                unit_price=base_price,
                total_amount=base_price,
                discount_amount=pricing_result.total_discount_amount,
                final_amount=pricing_result.final_price,
                metadata={
                    "subscription_id": subscription_id,
                    "plan_id": plan.plan_id,
                    "billing_cycle": plan.billing_cycle,
                },
            )
            invoice_items.append(subscription_item)
            total_amount += base_price
            total_discount += pricing_result.total_discount_amount

            # Add setup fee if applicable and first billing
            if plan.has_setup_fee() and self._is_first_billing(subscription):
                setup_fee = plan.setup_fee
                if setup_fee is None:
                    logger.warning(
                        "Plan reports setup fee but value is missing",
                        extra={"plan_id": plan.plan_id, "subscription_id": subscription_id},
                    )
                    setup_fee = Decimal("0")

                setup_item = InvoiceItem(
                    description=f"Setup Fee: {plan.name}",
                    product_id=plan.product_id,
                    quantity=1,
                    unit_price=setup_fee,
                    total_amount=setup_fee,
                    discount_amount=Decimal("0"),
                    final_amount=setup_fee,
                    metadata={"type": "setup_fee", "subscription_id": subscription_id},
                )
                invoice_items.append(setup_item)
                total_amount += setup_fee

            # Process usage-based charges if applicable
            if plan.supports_usage_billing():
                usage_items = await self._calculate_usage_charges(subscription, plan, tenant_id)
                invoice_items.extend(usage_items)
                for item in usage_items:
                    total_amount += item.total_amount
                    total_discount += item.discount_amount

            # Create invoice request
            invoice_request = BillingInvoiceRequest(
                customer_id=subscription.customer_id,
                subscription_id=subscription_id,
                billing_period_start=subscription.current_period_start,
                billing_period_end=subscription.current_period_end,
                items=invoice_items,
                subtotal=total_amount,
                total_discount=total_discount,
                total_amount=total_amount - total_discount,
                currency=plan.currency,
                metadata={
                    "billing_source": "subscription",
                    "subscription_id": subscription_id,
                    "plan_id": plan.plan_id,
                    "tenant_id": tenant_id,
                },
            )

            # Create invoice through existing system
            invoice_id = await self._create_invoice(invoice_request, tenant_id)

            if invoice_id:
                # Record billing event
                await self.subscription_service.record_event(
                    subscription_id,
                    SubscriptionEventType.RENEWED,
                    {"invoice_id": invoice_id, "amount": str(invoice_request.total_amount)},
                    tenant_id,
                )

                logger.info(
                    "Subscription billing completed",
                    extra={
                        "subscription_id": subscription_id,
                        "invoice_id": invoice_id,
                        "amount": str(invoice_request.total_amount),
                    },
                )

            return invoice_id

        except Exception as e:
            logger.error(
                "Failed to process subscription billing",
                extra={"subscription_id": subscription_id, "error": str(e)},
            )
            raise

    async def _calculate_usage_charges(
        self,
        subscription: Subscription,
        plan: SubscriptionPlan,
        tenant_id: str,
    ) -> list[InvoiceItem]:
        """Calculate usage-based charges for subscription."""
        usage_items: list[InvoiceItem] = []

        for usage_type, current_usage in subscription.usage_records.items():
            # Get included allowance
            included = plan.included_usage.get(usage_type, 0)

            # Calculate overage
            overage = max(0, current_usage - included)

            if overage > 0:
                # Get overage rate
                overage_rate = plan.overage_rates.get(usage_type, Decimal("0"))

                if overage_rate > 0:
                    overage_amount = Decimal(str(overage)) * overage_rate

                    # Apply pricing rules to usage charges
                    # Note: This could be enhanced with specific usage pricing rules

                    usage_item = InvoiceItem(
                        description=f"Usage Overage: {usage_type.replace('_', ' ').title()}",
                        product_id=plan.product_id,
                        quantity=overage,
                        unit_price=overage_rate,
                        total_amount=overage_amount,
                        discount_amount=Decimal("0"),  # Could apply usage-specific discounts
                        final_amount=overage_amount,
                        metadata={
                            "usage_type": usage_type,
                            "included_allowance": included,
                            "actual_usage": current_usage,
                            "overage_units": overage,
                        },
                    )
                    usage_items.append(usage_item)

        return usage_items

    def _is_first_billing(self, subscription: Subscription) -> bool:
        """Check if this is the first billing for the subscription."""
        created_at = getattr(subscription, "created_at", None)
        if not isinstance(created_at, datetime):
            return False

        threshold = datetime.now(UTC) - timedelta(days=7)
        return created_at >= threshold

    async def _resolve_customer_billing_details(
        self, customer_id: str, tenant_id: str
    ) -> tuple[str, dict[str, str]]:
        """
        Resolve billing email and address information for the customer.

        Returns secure defaults when the customer record cannot be found.
        """
        fallback_email = f"{customer_id}@example.com"
        fallback_address: dict[str, str] = {"name": fallback_email}

        try:
            customer_uuid = UUID(customer_id)
        except (ValueError, TypeError):
            customer_uuid = None

        if customer_uuid is None:
            logger.warning(
                "Unable to resolve customer UUID for billing details",
                extra={"customer_id": customer_id, "tenant_id": tenant_id},
            )
            return fallback_email, fallback_address

        stmt = (
            select(Customer)
            .where(
                Customer.id == customer_uuid,
                Customer.tenant_id == tenant_id,
                Customer.deleted_at.is_(None),
            )
            .limit(1)
        )
        result = await self.db.execute(stmt)
        customer = result.scalar_one_or_none()

        if customer is None:
            logger.warning(
                "Customer not found when resolving billing details",
                extra={"customer_id": customer_id, "tenant_id": tenant_id},
            )
            return fallback_email, fallback_address

        billing_email = customer.email or fallback_email
        name = (
            customer.display_name
            or customer.company_name
            or " ".join(filter(None, [customer.first_name, customer.last_name]))
        ).strip()

        billing_address = {
            "name": name or billing_email,
            "line1": customer.address_line1,
            "line2": customer.address_line2,
            "city": customer.city,
            "state": customer.state_province,
            "postal_code": customer.postal_code,
            "country": customer.country,
            "email": customer.email,
            "phone": customer.phone or customer.mobile,
        }

        # Remove empty or None values to avoid polluting downstream logic
        filtered_address = {key: value for key, value in billing_address.items() if value}

        return billing_email, filtered_address

    async def _create_invoice(
        self, invoice_request: BillingInvoiceRequest, tenant_id: str
    ) -> str | None:
        """
        Create invoice using existing invoice system.
        """
        try:
            # Convert invoice items to the format expected by InvoiceService
            line_items = []
            for item in invoice_request.items:
                line_items.append(
                    {
                        "description": item.description,
                        "quantity": item.quantity,
                        "unit_price": int(item.unit_price * 100),  # Convert to cents
                        "total_price": int(item.total_amount * 100),
                        "product_id": item.product_id,
                        "subscription_id": invoice_request.subscription_id,
                    }
                )

            billing_email, billing_address = await self._resolve_customer_billing_details(
                invoice_request.customer_id, tenant_id
            )
            resolved_currency = (invoice_request.currency or "USD").upper()

            # Create invoice using the actual invoice service
            invoice = await self.invoice_service.create_invoice(
                tenant_id=tenant_id,
                customer_id=invoice_request.customer_id,
                billing_email=billing_email,
                billing_address=billing_address,
                line_items=line_items,
                currency=resolved_currency,
                notes=f"Subscription billing for period {invoice_request.billing_period_start.date()} to {invoice_request.billing_period_end.date()}",
                extra_data=invoice_request.metadata,
            )

            invoice_id_value: str | None = invoice.invoice_id
            if invoice_id_value is None:
                logger.error(
                    "Invoice created without identifier",
                    extra={
                        "customer_id": invoice_request.customer_id,
                        "subscription_id": invoice_request.subscription_id,
                        "tenant_id": tenant_id,
                    },
                )
                return None

            logger.info(
                "Created invoice from billing system",
                extra={
                    "invoice_id": invoice_id_value,
                    "customer_id": invoice_request.customer_id,
                    "subscription_id": invoice_request.subscription_id,
                    "amount": str(invoice_request.total_amount),
                    "items_count": len(invoice_request.items),
                    "tenant_id": tenant_id,
                },
            )

            # Auto-finalize the invoice if needed
            if invoice.status == InvoiceStatus.DRAFT:
                finalized_invoice = await self.invoice_service.finalize_invoice(
                    tenant_id=tenant_id,
                    invoice_id=invoice_id_value,
                )
                logger.info(
                    "Auto-finalized subscription invoice",
                    extra={
                        "invoice_id": finalized_invoice.invoice_id,
                        "subscription_id": invoice_request.subscription_id,
                    },
                )

            return invoice_id_value

        except Exception as e:
            logger.error(
                "Failed to create invoice from billing system",
                extra={
                    "customer_id": invoice_request.customer_id,
                    "subscription_id": invoice_request.subscription_id,
                    "error": str(e),
                    "tenant_id": tenant_id,
                },
            )
            return None

    async def process_failed_payment(
        self, subscription_id: str, invoice_id: str, tenant_id: str, retry_count: int = 0
    ) -> bool:
        """
        Handle failed payment for subscription.

        Returns True if subscription should remain active, False if should be suspended.
        """
        try:
            subscription = await self.subscription_service.get_subscription(
                subscription_id, tenant_id
            )
            if not subscription:
                return False

            # Update subscription status
            if retry_count == 0:
                # First failure - mark as past due
                await self.subscription_service._update_subscription_status(
                    subscription_id, SubscriptionStatus.PAST_DUE, tenant_id
                )

                # Record event
                await self.subscription_service.record_event(
                    subscription_id,
                    SubscriptionEventType.PAYMENT_FAILED,
                    {"invoice_id": invoice_id, "retry_count": retry_count},
                    tenant_id,
                )

                logger.warning(
                    "Subscription payment failed, marked as past due",
                    extra={"subscription_id": subscription_id, "invoice_id": invoice_id},
                )

                return True  # Keep active for retry

            elif retry_count < 3:
                # Still in retry window
                logger.info(
                    "Subscription payment retry failed",
                    extra={"subscription_id": subscription_id, "retry_count": retry_count},
                )
                return True

            else:
                # Too many failures - cancel subscription
                await self.subscription_service.cancel_subscription(
                    subscription_id, tenant_id, at_period_end=False
                )

                await self.subscription_service.record_event(
                    subscription_id,
                    SubscriptionEventType.ENDED,
                    {"reason": "payment_failure", "invoice_id": invoice_id},
                    tenant_id,
                )

                logger.error(
                    "Subscription canceled due to payment failures",
                    extra={"subscription_id": subscription_id, "invoice_id": invoice_id},
                )

                return False

        except Exception as e:
            logger.error(
                "Failed to process payment failure",
                extra={"subscription_id": subscription_id, "error": str(e)},
            )
            raise

    async def process_successful_payment(
        self, subscription_id: str, invoice_id: str, tenant_id: str
    ) -> bool:
        """Handle successful payment for subscription."""
        try:
            subscription = await self.subscription_service.get_subscription(
                subscription_id, tenant_id
            )
            if not subscription:
                return False

            # Update subscription to active if it was past due
            if subscription.status == SubscriptionStatus.PAST_DUE:
                await self.subscription_service._update_subscription_status(
                    subscription_id, SubscriptionStatus.ACTIVE, tenant_id
                )

            # Record successful payment event
            await self.subscription_service.record_event(
                subscription_id,
                SubscriptionEventType.PAYMENT_SUCCEEDED,
                {"invoice_id": invoice_id},
                tenant_id,
            )

            # Reset usage records for new billing period
            await self.subscription_service._reset_usage_for_new_period(subscription_id, tenant_id)

            logger.info(
                "Subscription payment processed successfully",
                extra={"subscription_id": subscription_id, "invoice_id": invoice_id},
            )

            return True

        except Exception as e:
            logger.error(
                "Failed to process successful payment",
                extra={"subscription_id": subscription_id, "error": str(e)},
            )
            raise

    async def process_subscription_renewals(self, tenant_id: str) -> dict[str, Any]:
        """
        Process all subscription renewals for a tenant.

        This would typically be called by a scheduled job.
        """
        results = {
            "processed": 0,
            "created_invoices": 0,
            "errors": 0,
            "skipped": 0,
        }

        try:
            # Find subscriptions that need renewal
            subscriptions_due = await self.subscription_service.get_subscriptions_due_for_renewal(
                tenant_id
            )

            logger.info(
                "Processing subscription renewals",
                extra={"tenant_id": tenant_id, "count": len(subscriptions_due)},
            )

            for subscription in subscriptions_due:
                try:
                    invoice_id = await self.process_subscription_billing(
                        subscription.subscription_id, tenant_id
                    )

                    results["processed"] += 1

                    if invoice_id:
                        results["created_invoices"] += 1
                    else:
                        results["skipped"] += 1

                except Exception as e:
                    logger.error(
                        "Failed to process subscription renewal",
                        extra={"subscription_id": subscription.subscription_id, "error": str(e)},
                    )
                    results["errors"] += 1

            logger.info(
                "Subscription renewal batch completed",
                extra={"tenant_id": tenant_id, "results": results},
            )

        except Exception as e:
            logger.error(
                "Failed to process subscription renewals",
                extra={"tenant_id": tenant_id, "error": str(e)},
            )
            results["errors"] += 1

        return results

    async def generate_usage_invoice(
        self,
        customer_id: str,
        product_id: str,
        usage_data: dict[str, int],
        tenant_id: str,
        billing_period_start: datetime | None = None,
        billing_period_end: datetime | None = None,
    ) -> str | None:
        """
        Generate usage-based invoice for a customer.

        For usage-based products that are billed separately from subscriptions.
        """
        try:
            # Get product details
            product = await self.catalog_service.get_product(product_id, tenant_id)
            if not product or not product.is_usage_based():
                logger.error(
                    "Product not found or not usage-based", extra={"product_id": product_id}
                )
                return None

            # Set default billing period
            if not billing_period_end:
                billing_period_end = datetime.now(UTC)
            if not billing_period_start:
                billing_period_start = billing_period_end - timedelta(days=30)

            # Calculate charges
            invoice_items: list[InvoiceItem] = []
            total_amount = Decimal("0")

            usage_rates: dict[str, Decimal] = {}
            raw_usage_rates = product.metadata.get("usage_rates")
            if isinstance(raw_usage_rates, dict):
                for rate_type, raw_value in raw_usage_rates.items():
                    try:
                        usage_rates[rate_type] = Decimal(str(raw_value))
                    except (InvalidOperation, TypeError, ValueError):
                        logger.warning(
                            "Invalid usage rate configuration",
                            extra={
                                "product_id": product_id,
                                "usage_type": rate_type,
                                "value": raw_value,
                            },
                        )

            for usage_type, usage_count in usage_data.items():
                if usage_count > 0:
                    usage_rate = usage_rates.get(usage_type, Decimal("0"))

                    if usage_rate > 0:
                        charge_amount = Decimal(str(usage_count)) * usage_rate

                        # Apply pricing rules
                        pricing_request = PriceCalculationRequest(
                            product_id=product_id,
                            quantity=usage_count,
                            customer_id=customer_id,
                            customer_segments=[],
                            calculation_date=billing_period_end,
                            currency=product.currency,
                        )

                        pricing_result = await self.pricing_service.calculate_price(
                            pricing_request, tenant_id
                        )

                        usage_item = InvoiceItem(
                            description=f"Usage: {usage_type.replace('_', ' ').title()}",
                            product_id=product_id,
                            quantity=usage_count,
                            unit_price=usage_rate,
                            total_amount=charge_amount,
                            discount_amount=pricing_result.total_discount_amount,
                            final_amount=pricing_result.final_price,
                            metadata={"usage_type": usage_type},
                        )
                        invoice_items.append(usage_item)
                        total_amount += pricing_result.final_price

            if not invoice_items:
                logger.info(
                    "No usage charges to bill",
                    extra={"customer_id": customer_id, "product_id": product_id},
                )
                return None

            # Create invoice
            invoice_request = BillingInvoiceRequest(
                customer_id=customer_id,
                subscription_id=None,
                billing_period_start=billing_period_start,
                billing_period_end=billing_period_end,
                items=invoice_items,
                subtotal=sum((item.total_amount for item in invoice_items), Decimal("0")),
                total_discount=sum((item.discount_amount for item in invoice_items), Decimal("0")),
                total_amount=total_amount,
                currency=product.currency,
                metadata={
                    "billing_source": "usage",
                    "product_id": product_id,
                    "tenant_id": tenant_id,
                },
            )

            invoice_id = await self._create_invoice(invoice_request, tenant_id)

            logger.info(
                "Usage invoice created",
                extra={
                    "customer_id": customer_id,
                    "product_id": product_id,
                    "invoice_id": invoice_id,
                    "amount": str(total_amount),
                },
            )

            return invoice_id

        except Exception as e:
            logger.error(
                "Failed to generate usage invoice",
                extra={"customer_id": customer_id, "product_id": product_id, "error": str(e)},
            )
            raise
