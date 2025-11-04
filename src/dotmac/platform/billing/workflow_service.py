"""
Billing Workflow Service

Provides workflow-compatible methods for billing operations.
"""

import logging
from datetime import UTC, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


class BillingService:
    """
    Billing service for workflow integration.

    Provides subscription, payment, and billing methods for workflows.
    """

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_subscription(
        self,
        customer_id: int | str,
        plan_id: int | str,
        tenant_id: str,
    ) -> dict[str, Any]:
        """
        Create a subscription for a customer.

        Args:
            customer_id: Customer ID
            plan_id: Billing plan ID
            tenant_id: Tenant ID

        Returns:
            Dict with subscription_id, status, next_billing_date
        """
        from ..billing.subscriptions.models import SubscriptionCreateRequest
        from ..billing.subscriptions.service import SubscriptionService

        logger.info(
            f"Creating subscription for customer {customer_id}, plan {plan_id}, tenant {tenant_id}"
        )

        # Use the actual subscription service
        subscription_service = SubscriptionService(self.db)

        # Create subscription request
        subscription_request = SubscriptionCreateRequest(
            customer_id=str(customer_id), plan_id=str(plan_id), metadata={"created_by": "workflow"}
        )

        # Create the subscription
        subscription = await subscription_service.create_subscription(
            subscription_data=subscription_request, tenant_id=tenant_id
        )

        logger.info(
            f"Created subscription {subscription.subscription_id} for customer {customer_id}"
        )

        return {
            "subscription_id": subscription.subscription_id,
            "customer_id": subscription.customer_id,
            "plan_id": subscription.plan_id,
            "status": subscription.status.value,
            "next_billing_date": subscription.current_period_end.isoformat(),
            "created_at": subscription.current_period_start.isoformat(),
        }

    async def process_payment(
        self,
        order_id: int | str,
        amount: Decimal | str | float,
        payment_method: str,
        currency: str | None = None,
    ) -> dict[str, Any]:
        """
        Process a payment for an order using the plugin system.

        This method uses the PaymentProvider plugin system to process payments.
        Payment gateways (Stripe, PayPal, etc.) can be configured as plugins.

        Args:
            order_id: Order ID
            amount: Payment amount
            payment_method: Payment method (e.g., "credit_card", "bank_transfer")
            currency: Currency code (e.g., "USD", "NGN"). If not provided, will try to fetch from quote/order.

        Returns:
            Dict with payment_id, status, transaction_id
        """
        import secrets
        from uuid import UUID

        amount_decimal = Decimal(str(amount)) if not isinstance(amount, Decimal) else amount
        amount_float = float(amount_decimal)

        # Get currency from context if not provided
        if not currency:
            try:
                # Try to interpret order_id as a quote UUID and fetch currency
                from sqlalchemy import select

                from ..crm.models import Quote

                try:
                    quote_uuid = (
                        UUID(order_id) if isinstance(order_id, str) else UUID(str(order_id))
                    )
                    quote_stmt = select(Quote).where(Quote.id == quote_uuid)
                    quote_result = await self.db.execute(quote_stmt)
                    quote = quote_result.scalar_one_or_none()
                    if quote and hasattr(quote, "currency"):
                        currency = quote.currency
                        logger.info(f"Currency retrieved from quote: {currency}")
                except (ValueError, AttributeError):
                    pass
            except Exception as e:
                logger.warning(f"Could not fetch currency from order context: {e}")

            # Default to USD if still not found
            if not currency:
                currency = "USD"
                logger.info("Using default currency: USD")

        logger.info(
            f"Processing payment for order {order_id}, amount {amount_decimal} {currency}, method {payment_method}"
        )

        # Try to use payment plugin if available
        try:
            from ..plugins.registry import PluginRegistry

            # Get plugin registry instance
            plugin_registry = PluginRegistry()

            # Look for an active payment provider plugin
            payment_plugin = None

            # Check if there's a configured payment plugin instance
            # Plugins are registered with names like "stripe", "paypal", etc.
            for instance in plugin_registry._instances.values():
                if instance.status == "active" and instance.provider_type == "payment":
                    # Get the plugin provider
                    plugin_name = instance.plugin_name
                    if plugin_name in plugin_registry._plugins:
                        payment_plugin = plugin_registry._plugins[plugin_name]
                        logger.info(f"Using payment plugin: {plugin_name}")
                        break

            if payment_plugin:
                # Process payment through plugin
                plugin_result = await payment_plugin.process_payment(
                    amount=amount_float,
                    currency=currency,
                    payment_method=payment_method,
                    metadata={
                        "order_id": str(order_id),
                        "source": "workflow",
                    },
                )

                # Return plugin result with consistent format
                return {
                    "payment_id": plugin_result.get("payment_id", f"pay_{secrets.token_hex(12)}"),
                    "order_id": str(order_id),
                    "amount": str(amount_decimal),
                    "payment_method": payment_method,
                    "status": plugin_result.get("status", "completed"),
                    "transaction_id": plugin_result.get(
                        "transaction_id", plugin_result.get("payment_id")
                    ),
                    "processed_at": datetime.utcnow().isoformat(),
                    "provider": plugin_result.get("provider", "plugin"),
                    "details": plugin_result,
                }

        except ImportError as e:
            logger.warning(f"Plugin system not available: {e}")
            # Check if payment plugin is required
            from ..settings import get_settings

            settings = get_settings()
            if settings.billing.require_payment_plugin:
                raise RuntimeError(
                    "Payment plugin required but not available. "
                    "Set BILLING__REQUIRE_PAYMENT_PLUGIN=false to allow fallback, "
                    "or configure a payment plugin (Stripe, PayPal, etc.)"
                ) from e
        except Exception as e:
            logger.warning(f"Payment plugin failed: {e}")
            # Check if payment plugin is required
            from ..settings import get_settings

            settings = get_settings()
            if settings.billing.require_payment_plugin:
                raise RuntimeError(
                    f"Payment processing failed and payment plugin is required: {e}. "
                    "Configure a payment plugin or set BILLING__REQUIRE_PAYMENT_PLUGIN=false"
                ) from e

        # Fallback: Simulate payment processing
        # This allows workflows to work in development/testing without payment plugins
        # IMPORTANT: Set BILLING__REQUIRE_PAYMENT_PLUGIN=true in production to prevent this

        # Get settings to check environment and plugin requirement
        from ..settings import get_settings

        settings = get_settings()

        # CRITICAL: Block fallback in production environment
        if settings.is_production:
            raise RuntimeError(
                "CRITICAL: Cannot process payments in production without a payment plugin. "
                "Simulated payments are blocked in production mode. "
                "Configure a payment plugin (Paystack, Stripe, etc.) or contact system administrator."
            )

        # Additional check: Enforce plugin requirement even in non-production
        if settings.billing.require_payment_plugin:
            raise RuntimeError(
                "Payment plugin is required (BILLING__REQUIRE_PAYMENT_PLUGIN=true) but no plugin is available. "
                "Either configure a payment plugin or set BILLING__REQUIRE_PAYMENT_PLUGIN=false for development/testing only."
            )

        # Log prominent warning for development/testing
        logger.warning("=" * 80)
        logger.warning(f"⚠️  [MOCK PAYMENT] Using simulated payment processing for order {order_id}")
        logger.warning("⚠️  NO REAL MONEY IS BEING COLLECTED")
        logger.warning(f"⚠️  Environment: {settings.environment.value}")
        logger.warning(
            "⚠️  This is ONLY allowed in development/testing with BILLING__REQUIRE_PAYMENT_PLUGIN=false"
        )
        logger.warning("=" * 80)

        payment_id = f"pay_mock_{secrets.token_hex(12)}"
        transaction_id = f"txn_mock_{secrets.token_hex(12)}"

        return {
            "payment_id": payment_id,
            "order_id": str(order_id),
            "amount": str(amount_decimal),
            "payment_method": payment_method,
            "status": "completed",
            "transaction_id": transaction_id,
            "processed_at": datetime.utcnow().isoformat(),
            "provider": "mock",
            "warning": "⚠️ SIMULATED PAYMENT - NO MONEY COLLECTED - DEVELOPMENT/TESTING ONLY",
            "mock_payment": True,
        }

    async def check_renewal_eligibility(
        self,
        customer_id: int | str,
        subscription_id: int | str,
        tenant_id: str | None = None,
        renewal_window_days: int = 30,
    ) -> dict[str, Any]:
        """
        Check if a subscription is eligible for renewal.

        This method performs comprehensive eligibility checks including:
        - Subscription exists and belongs to customer
        - Subscription is within renewal window
        - Subscription is in eligible status (active, past_due)
        - No blocking issues (suspended account, etc.)

        Args:
            customer_id: Customer ID (UUID or integer)
            subscription_id: Subscription ID (UUID or string)
            tenant_id: Tenant ID for multi-tenant isolation
            renewal_window_days: Days before expiration to allow renewal (default 30)

        Returns:
            Dict with eligibility details:
            {
                "eligible": bool,  # Overall eligibility
                "subscription_id": str,
                "customer_id": str,
                "status": str,  # Subscription status
                "days_until_expiration": int,
                "current_period_end": str,  # ISO timestamp
                "reason": str,  # Explanation
                "blocking_issues": list[str],  # Any blocking issues
                "can_renew_early": bool,  # Within renewal window
            }

        Raises:
            ValueError: If subscription or customer not found
        """

        from sqlalchemy import select

        logger.info(
            f"Checking renewal eligibility for customer {customer_id}, "
            f"subscription {subscription_id}"
        )

        customer_id_str = str(customer_id)
        subscription_id_str = str(subscription_id)

        try:
            from ..billing.subscriptions.models import BillingSubscriptionTable, SubscriptionStatus

            # Fetch subscription
            stmt = select(BillingSubscriptionTable).where(
                BillingSubscriptionTable.subscription_id == subscription_id_str,
            )

            if tenant_id:
                stmt = stmt.where(BillingSubscriptionTable.tenant_id == tenant_id)

            result = await self.db.execute(stmt)
            subscription = result.scalar_one_or_none()

            if not subscription:
                raise ValueError(f"Subscription {subscription_id} not found")

            # Verify subscription belongs to customer
            if subscription.customer_id != customer_id_str:
                raise ValueError(
                    f"Subscription {subscription_id} does not belong to customer {customer_id}"
                )

            # Calculate days until expiration
            now = datetime.now(UTC)
            time_until_expiration = subscription.current_period_end - now
            days_until_expiration = max(0, time_until_expiration.days)

            # Check eligibility criteria
            blocking_issues = []
            eligible = True
            reason_parts = []

            # 1. Check subscription status
            eligible_statuses = [
                SubscriptionStatus.ACTIVE,
                SubscriptionStatus.PAST_DUE,
                SubscriptionStatus.TRIALING,
            ]

            if subscription.status not in eligible_statuses:
                eligible = False
                blocking_issues.append(
                    f"Subscription status is {subscription.status.value}, "
                    f"must be one of: {[s.value for s in eligible_statuses]}"
                )
                reason_parts.append(f"Status: {subscription.status.value}")

            # 2. Check if within renewal window
            can_renew_early = days_until_expiration <= renewal_window_days

            if not can_renew_early and eligible:
                eligible = False
                blocking_issues.append(
                    f"Outside renewal window: {days_until_expiration} days remaining "
                    f"(window is {renewal_window_days} days)"
                )
                reason_parts.append("Too early for renewal")

            # 3. Check if already expired
            if days_until_expiration == 0 and time_until_expiration.total_seconds() < 0:
                # Already expired but might still be renewable (grace period)
                reason_parts.append("Subscription expired")
                if subscription.status == SubscriptionStatus.CANCELLED:
                    eligible = False
                    blocking_issues.append("Subscription is cancelled and expired")

            # 4. Check if cancelled at period end
            if subscription.cancel_at_period_end:
                # Still eligible for renewal to un-cancel
                reason_parts.append("Scheduled for cancellation")

            # Build reason message
            if eligible:
                if not reason_parts:
                    reason = "Subscription is eligible for renewal"
                else:
                    reason = f"Eligible for renewal. Note: {', '.join(reason_parts)}"
            else:
                if blocking_issues:
                    reason = f"Not eligible: {'; '.join(blocking_issues)}"
                else:
                    reason = "Not eligible for renewal"

            logger.info(
                f"Renewal eligibility check complete: subscription={subscription_id}, "
                f"eligible={eligible}, days_until_expiration={days_until_expiration}"
            )

            return {
                "eligible": eligible,
                "subscription_id": subscription_id_str,
                "customer_id": customer_id_str,
                "plan_id": subscription.plan_id,
                "status": subscription.status.value,
                "days_until_expiration": days_until_expiration,
                "current_period_end": subscription.current_period_end.isoformat(),
                "reason": reason,
                "blocking_issues": blocking_issues,
                "can_renew_early": can_renew_early,
                "cancel_at_period_end": subscription.cancel_at_period_end,
                "checked_at": now.isoformat(),
            }

        except ValueError:
            raise
        except Exception as e:
            logger.error(f"Error checking renewal eligibility: {e}", exc_info=True)
            raise RuntimeError(f"Failed to check renewal eligibility: {e}") from e

    async def extend_subscription(
        self,
        subscription_id: int | str,
        extension_period: int,
        tenant_id: str | None = None,
        reason: str | None = None,
    ) -> dict[str, Any]:
        """
        Extend a subscription by a given period.

        This method extends the subscription's current_period_end date,
        effectively adding more time to the subscription. This is typically
        used for promotional extensions, service credits, or manual adjustments.

        Args:
            subscription_id: Subscription ID (UUID or string)
            extension_period: Extension period in months (1-36 typically)
            tenant_id: Tenant ID for multi-tenant isolation
            reason: Reason for extension (for audit trail)

        Returns:
            Dict with extension details:
            {
                "subscription_id": str,
                "extension_period": int,
                "previous_expiration": str,  # ISO timestamp
                "new_expiration": str,  # ISO timestamp
                "status": str,
                "extended_by": str,  # "workflow"
                "reason": str | None,
                "extended_at": str,  # ISO timestamp
            }

        Raises:
            ValueError: If subscription not found or invalid extension period
            RuntimeError: If extension fails
        """
        from datetime import timedelta

        from sqlalchemy import select, update

        logger.info(f"Extending subscription {subscription_id} by {extension_period} months")

        # Validate extension period
        if extension_period < 1 or extension_period > 36:
            raise ValueError(f"Invalid extension_period: {extension_period} (must be 1-36 months)")

        subscription_id_str = str(subscription_id)

        try:
            from ..billing.subscriptions.models import BillingSubscriptionTable

            # Fetch subscription
            stmt = select(BillingSubscriptionTable).where(
                BillingSubscriptionTable.subscription_id == subscription_id_str,
            )

            if tenant_id:
                stmt = stmt.where(BillingSubscriptionTable.tenant_id == tenant_id)

            result = await self.db.execute(stmt)
            subscription = result.scalar_one_or_none()

            if not subscription:
                raise ValueError(f"Subscription {subscription_id} not found")

            # Store previous expiration for response
            previous_expiration = subscription.current_period_end

            # Calculate new expiration date
            # Approximate months as 30 days for simplicity
            days_to_add = extension_period * 30
            new_expiration = previous_expiration + timedelta(days=days_to_add)

            # Update subscription
            update_stmt = (
                update(BillingSubscriptionTable)
                .where(BillingSubscriptionTable.subscription_id == subscription_id_str)
                .values(
                    current_period_end=new_expiration,
                    updated_at=datetime.now(UTC),
                )
            )

            if tenant_id:
                update_stmt = update_stmt.where(BillingSubscriptionTable.tenant_id == tenant_id)

            await self.db.execute(update_stmt)

            # Update subscription metadata to track extension
            extension_metadata = {
                "extended_at": datetime.now(UTC).isoformat(),
                "extended_by": "workflow",
                "extension_period_months": extension_period,
                "previous_expiration": previous_expiration.isoformat(),
                "new_expiration": new_expiration.isoformat(),
                "reason": reason or "Manual extension",
            }

            # Merge with existing metadata
            existing_metadata = subscription.metadata or {}
            extensions_history = existing_metadata.get("extensions", [])
            extensions_history.append(extension_metadata)
            existing_metadata["extensions"] = extensions_history
            existing_metadata["last_extension"] = extension_metadata

            update_metadata_stmt = (
                update(BillingSubscriptionTable)
                .where(BillingSubscriptionTable.subscription_id == subscription_id_str)
                .values(metadata=existing_metadata)
            )

            if tenant_id:
                update_metadata_stmt = update_metadata_stmt.where(
                    BillingSubscriptionTable.tenant_id == tenant_id
                )

            await self.db.execute(update_metadata_stmt)

            # Commit changes
            await self.db.commit()

            logger.info(
                f"Subscription extended successfully: {subscription_id}, "
                f"previous_expiration={previous_expiration.isoformat()}, "
                f"new_expiration={new_expiration.isoformat()}"
            )

            return {
                "subscription_id": subscription_id_str,
                "customer_id": subscription.customer_id,
                "plan_id": subscription.plan_id,
                "extension_period": extension_period,
                "previous_expiration": previous_expiration.isoformat(),
                "new_expiration": new_expiration.isoformat(),
                "days_extended": days_to_add,
                "status": subscription.status.value,
                "extended_by": "workflow",
                "reason": reason,
                "extended_at": datetime.now(UTC).isoformat(),
            }

        except ValueError:
            raise
        except Exception as e:
            logger.error(f"Error extending subscription: {e}", exc_info=True)
            await self.db.rollback()
            raise RuntimeError(f"Failed to extend subscription: {e}") from e

    async def process_renewal_payment(
        self,
        customer_id: int | str,
        quote_id: int | str,
        payment_method: str = "default",
        tenant_id: str | None = None,
    ) -> dict[str, Any]:
        """
        Process payment for a renewal quote.

        This method processes payment for a renewal quote by:
        1. Fetching the quote from the database
        2. Validating quote status and customer ownership
        3. Processing payment using the payment plugin system
        4. Updating quote status to ACCEPTED
        5. Creating payment record with quote linkage

        Args:
            customer_id: Customer ID (UUID or string)
            quote_id: Renewal quote ID (UUID or string)
            payment_method: Payment method (e.g., "credit_card", "bank_transfer", "default")
            tenant_id: Optional tenant ID for multi-tenant isolation

        Returns:
            Dict with payment details:
            {
                "payment_id": str,           # Payment UUID
                "transaction_id": str,       # Transaction ID from payment provider
                "quote_id": str,             # Quote UUID
                "quote_number": str,         # Human-readable quote number
                "customer_id": str,          # Customer UUID
                "amount": str,               # Payment amount (total upfront cost)
                "payment_method": str,       # Payment method used
                "status": str,               # Payment status (completed, pending, failed)
                "processed_at": str,         # ISO timestamp
                "provider": str,             # Payment provider name
                "subscription_id": str,      # Associated subscription ID if available
                "quote_status": str,         # Updated quote status
            }

        Raises:
            ValueError: If quote not found, customer mismatch, or invalid status
            RuntimeError: If payment processing fails
        """
        from uuid import UUID

        from sqlalchemy import select

        from ..crm.models import Quote, QuoteStatus

        logger.info(f"Processing renewal payment for customer {customer_id}, quote {quote_id}")

        # Convert IDs to UUIDs
        try:
            customer_uuid = (
                UUID(customer_id) if isinstance(customer_id, str) else UUID(str(customer_id))
            )
            quote_uuid = UUID(quote_id) if isinstance(quote_id, str) else UUID(str(quote_id))
        except (ValueError, AttributeError) as e:
            raise ValueError(f"Invalid ID format: {e}") from e

        try:
            # 1. Fetch renewal quote from database
            quote_stmt = select(Quote).where(Quote.id == quote_uuid)

            # Add tenant isolation if provided
            if tenant_id:
                quote_stmt = quote_stmt.where(Quote.tenant_id == tenant_id)

            quote_result = await self.db.execute(quote_stmt)
            quote = quote_result.scalar_one_or_none()

            if not quote:
                raise ValueError(
                    f"Quote {quote_id} not found"
                    + (f" for tenant {tenant_id}" if tenant_id else "")
                )

            # 2. Validate quote status
            # Can only process payment for draft or pending quotes
            valid_statuses = [QuoteStatus.DRAFT, QuoteStatus.PENDING]
            if quote.status not in valid_statuses:
                raise ValueError(
                    f"Cannot process payment for quote with status '{quote.status.value}'. "
                    f"Quote must be in DRAFT or PENDING status. Current status: {quote.status.value}"
                )

            # 3. Verify customer ownership
            # Get lead associated with quote to validate customer
            from ..crm.models import Lead

            lead_stmt = select(Lead).where(Lead.id == quote.lead_id)
            lead_result = await self.db.execute(lead_stmt)
            lead = lead_result.scalar_one_or_none()

            if not lead:
                raise ValueError(f"Lead not found for quote {quote_id}")

            # Check if lead's customer_id matches (for renewal quotes with existing customers)
            if lead.customer_id and str(lead.customer_id) != str(customer_uuid):
                raise ValueError(
                    f"Customer mismatch: Quote belongs to customer {lead.customer_id}, "
                    f"but payment requested for customer {customer_uuid}"
                )

            # 4. Calculate payment amount (total upfront cost for renewal)
            payment_amount = quote.total_upfront_cost

            logger.info(
                f"Processing payment of {payment_amount} for quote {quote.quote_number} "
                f"(customer: {customer_uuid})"
            )

            # 5. Process payment using existing payment method
            # Use quote_id as the order_id for payment tracking
            payment_result = await self.process_payment(
                order_id=str(quote_uuid),
                amount=payment_amount,
                payment_method=payment_method,
            )

            # 6. Update quote status to ACCEPTED after successful payment
            quote.status = QuoteStatus.ACCEPTED
            quote.updated_at = datetime.now(UTC)

            # Add payment metadata to quote
            quote_metadata = quote.metadata_ or {}
            quote_metadata.update(
                {
                    "payment_processed_at": datetime.now(UTC).isoformat(),
                    "payment_id": payment_result["payment_id"],
                    "transaction_id": payment_result["transaction_id"],
                    "payment_method": payment_method,
                    "payment_provider": payment_result.get("provider", "unknown"),
                }
            )
            quote.metadata_ = quote_metadata

            # Commit quote updates
            await self.db.commit()
            await self.db.refresh(quote)

            logger.info(
                f"Renewal payment processed successfully. Payment ID: {payment_result['payment_id']}, "
                f"Transaction ID: {payment_result['transaction_id']}, Quote: {quote.quote_number}"
            )

            # 7. Get subscription ID if available from quote metadata
            subscription_id = None
            if quote.metadata_:
                subscription_id = quote.metadata_.get("subscription_id")

            # 8. Return comprehensive payment details
            return {
                "payment_id": payment_result["payment_id"],
                "transaction_id": payment_result["transaction_id"],
                "quote_id": str(quote.id),
                "quote_number": quote.quote_number,
                "customer_id": str(customer_uuid),
                "amount": str(payment_amount),
                "monthly_recurring_charge": str(quote.monthly_recurring_charge),
                "contract_term_months": quote.contract_term_months,
                "payment_method": payment_method,
                "status": payment_result["status"],
                "processed_at": payment_result["processed_at"],
                "provider": payment_result.get("provider", "unknown"),
                "subscription_id": subscription_id,
                "quote_status": quote.status.value,
                "service_plan_name": quote.service_plan_name,
                "bandwidth": quote.bandwidth,
                "lead_id": str(quote.lead_id),
            }

        except ValueError:
            raise
        except Exception as e:
            logger.error(f"Error processing renewal payment: {e}", exc_info=True)
            await self.db.rollback()
            raise RuntimeError(f"Failed to process renewal payment: {e}") from e

    async def activate_service(
        self,
        customer_id: int | str,
        service_id: int | str,
        tenant_id: str | None = None,
        activation_notes: str | None = None,
    ) -> dict[str, Any]:
        """
        Activate a service for an ISP customer.

        This method activates a previously provisioned service, updating
        the customer's service status and associated subscription to active.
        It triggers billing to begin and marks the service as operational.

        Args:
            customer_id: Customer ID
            service_id: Service ID (from network allocation)
            tenant_id: Tenant ID for multi-tenant isolation
            activation_notes: Optional notes about the activation

        Returns:
            Dict with service activation details:
            {
                "service_id": str,
                "customer_id": str,
                "status": "active",
                "activated_at": "2025-10-16T12:00:00+00:00",
                "subscription_activated": bool,
                "billing_started": bool,
                "activation_notes": str | None
            }

        Raises:
            ValueError: If customer or service not found
        """

        from sqlalchemy import select, update

        logger.info(f"Activating service {service_id} for customer {customer_id}")

        customer_id_str = str(customer_id)
        service_id_str = str(service_id)

        # Get customer details
        from ..customer_management.models import Customer

        stmt = select(Customer).where(Customer.id == customer_id_str)
        if tenant_id:
            stmt = stmt.where(Customer.tenant_id == tenant_id)

        result = await self.db.execute(stmt)
        customer = result.scalar_one_or_none()

        if not customer:
            raise ValueError(
                f"Customer {customer_id} not found"
                + (f" in tenant {tenant_id}" if tenant_id else "")
            )

        tenant_id = customer.tenant_id

        # Update customer ISP-specific fields to mark service as active
        # This assumes customer has ISP fields from BSS Phase 1
        try:
            from ..customer_management.models import InstallationStatus

            update_stmt = (
                update(Customer)
                .where(Customer.id == customer_id_str)
                .values(
                    installation_status=InstallationStatus.COMPLETED,
                    installation_completed_at=datetime.now(UTC),
                    connection_status="active",
                )
            )
            await self.db.execute(update_stmt)
            await self.db.flush()

            logger.info(f"Updated customer {customer_id} installation status to COMPLETED")

        except (ImportError, AttributeError):
            # ISP fields not available, skip this step
            logger.warning("ISP customer fields not available, skipping installation status update")

        # Activate associated subscriptions
        subscription_activated = False
        try:
            from ..billing.subscriptions.models import BillingSubscriptionTable, SubscriptionStatus

            # Find active or trial subscriptions for this customer
            sub_stmt = select(BillingSubscriptionTable).where(
                BillingSubscriptionTable.customer_id == customer_id_str,
                BillingSubscriptionTable.tenant_id == tenant_id,
                BillingSubscriptionTable.status.in_(
                    [
                        SubscriptionStatus.TRIAL,
                        SubscriptionStatus.PENDING,
                    ]
                ),
            )

            sub_result = await self.db.execute(sub_stmt)
            subscriptions = sub_result.scalars().all()

            if subscriptions:
                for subscription in subscriptions:
                    # Activate subscription
                    sub_update = (
                        update(BillingSubscriptionTable)
                        .where(BillingSubscriptionTable.id == subscription.id)
                        .values(
                            status=SubscriptionStatus.ACTIVE,
                            activated_at=(
                                datetime.now(UTC)
                                if not subscription.activated_at
                                else subscription.activated_at
                            ),
                        )
                    )
                    await self.db.execute(sub_update)

                await self.db.flush()
                subscription_activated = True

                logger.info(
                    f"Activated {len(subscriptions)} subscription(s) for customer {customer_id}"
                )

        except (ImportError, AttributeError) as e:
            logger.warning(f"Could not activate subscriptions: {e}")

        # Mark billing as started
        # In production, this might trigger:
        # - First invoice generation
        # - Payment schedule creation
        # - Usage tracking activation
        billing_started = subscription_activated

        # Store activation metadata in customer context
        try:
            activation_metadata = {
                "service_activation": {
                    "service_id": service_id_str,
                    "activated_at": datetime.now(UTC).isoformat(),
                    "activated_by": "workflow",
                    "notes": activation_notes,
                }
            }

            # Update customer context/metadata
            update_stmt = (
                update(Customer)
                .where(Customer.id == customer_id_str)
                .values(
                    metadata={
                        **(customer.metadata or {}),
                        **activation_metadata,
                    }
                )
            )
            await self.db.execute(update_stmt)

        except Exception as e:
            logger.warning(f"Could not update activation metadata: {e}")

        # Commit all changes
        await self.db.commit()

        activated_at = datetime.now(UTC)

        logger.info(
            f"Service activated successfully: service_id={service_id}, "
            f"customer={customer_id}, subscription_activated={subscription_activated}"
        )

        return {
            "service_id": service_id_str,
            "customer_id": customer_id_str,
            "customer_email": customer.email,
            "status": "active",
            "activated_at": activated_at.isoformat(),
            "subscription_activated": subscription_activated,
            "billing_started": billing_started,
            "activation_notes": activation_notes,
        }
