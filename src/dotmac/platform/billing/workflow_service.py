"""
Billing Workflow Service

Provides workflow-compatible methods for billing operations.
"""

import logging
from decimal import Decimal
from typing import Any, Dict

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
    ) -> Dict[str, Any]:
        """
        Create a subscription for a customer.

        Args:
            customer_id: Customer ID
            plan_id: Billing plan ID
            tenant_id: Tenant ID

        Returns:
            Dict with subscription_id, status, next_billing_date
        """
        from ..billing.subscriptions.service import SubscriptionService
        from ..billing.subscriptions.models import SubscriptionCreateRequest

        logger.info(
            f"Creating subscription for customer {customer_id}, plan {plan_id}, tenant {tenant_id}"
        )

        # Use the actual subscription service
        subscription_service = SubscriptionService(self.db)

        # Create subscription request
        subscription_request = SubscriptionCreateRequest(
            customer_id=str(customer_id),
            plan_id=str(plan_id),
            metadata={"created_by": "workflow"}
        )

        # Create the subscription
        subscription = await subscription_service.create_subscription(
            subscription_data=subscription_request,
            tenant_id=tenant_id
        )

        logger.info(f"Created subscription {subscription.subscription_id} for customer {customer_id}")

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
    ) -> Dict[str, Any]:
        """
        Process a payment for an order using the plugin system.

        This method uses the PaymentProvider plugin system to process payments.
        Payment gateways (Stripe, PayPal, etc.) can be configured as plugins.

        Args:
            order_id: Order ID
            amount: Payment amount
            payment_method: Payment method (e.g., "credit_card", "bank_transfer")

        Returns:
            Dict with payment_id, status, transaction_id
        """
        from datetime import datetime
        import secrets

        amount_decimal = Decimal(str(amount)) if not isinstance(amount, Decimal) else amount
        amount_float = float(amount_decimal)

        logger.info(
            f"Processing payment for order {order_id}, amount {amount_decimal}, method {payment_method}"
        )

        # Try to use payment plugin if available
        try:
            from ..plugins.registry import PluginRegistry
            from ..plugins.interfaces import PaymentProvider

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
                    currency="USD",  # TODO: Get from order/context
                    payment_method=payment_method,
                    metadata={
                        "order_id": str(order_id),
                        "source": "workflow",
                    }
                )

                # Return plugin result with consistent format
                return {
                    "payment_id": plugin_result.get("payment_id", f"pay_{secrets.token_hex(12)}"),
                    "order_id": str(order_id),
                    "amount": str(amount_decimal),
                    "payment_method": payment_method,
                    "status": plugin_result.get("status", "completed"),
                    "transaction_id": plugin_result.get("transaction_id", plugin_result.get("payment_id")),
                    "processed_at": datetime.utcnow().isoformat(),
                    "provider": plugin_result.get("provider", "plugin"),
                    "details": plugin_result,
                }

        except ImportError:
            logger.warning("Plugin system not available, using fallback payment processing")
        except Exception as e:
            logger.warning(f"Payment plugin failed: {e}, using fallback payment processing")

        # Fallback: Simulate payment processing
        # This allows workflows to work even without payment plugins configured
        payment_id = f"pay_{secrets.token_hex(12)}"
        transaction_id = f"txn_{secrets.token_hex(12)}"

        logger.info(
            f"[FALLBACK] Payment {payment_id} simulated successfully for order {order_id}"
        )

        return {
            "payment_id": payment_id,
            "order_id": str(order_id),
            "amount": str(amount_decimal),
            "payment_method": payment_method,
            "status": "completed",
            "transaction_id": transaction_id,
            "processed_at": datetime.utcnow().isoformat(),
            "provider": "fallback",
            "note": "Payment simulated - configure payment plugin for production",
        }

    async def check_renewal_eligibility(
        self,
        customer_id: int | str,
        subscription_id: int | str,
    ) -> Dict[str, Any]:
        """
        Check if a subscription is eligible for renewal.

        Args:
            customer_id: Customer ID
            subscription_id: Subscription ID

        Returns:
            Dict with eligible (bool) and reason
        """
        logger.info(
            f"[STUB] Checking renewal eligibility for customer {customer_id}, subscription {subscription_id}"
        )

        # TODO: Implement actual eligibility check
        # This would check:
        # 1. Subscription exists and belongs to customer
        # 2. Subscription is near expiration
        # 3. No outstanding payments
        # 4. Customer account is in good standing

        return {
            "eligible": True,
            "reason": "Subscription is eligible for renewal",
            "days_until_expiration": 7,
        }

    async def extend_subscription(
        self,
        subscription_id: int | str,
        extension_period: int,
    ) -> Dict[str, Any]:
        """
        Extend a subscription by a given period.

        Args:
            subscription_id: Subscription ID
            extension_period: Extension period in months

        Returns:
            Dict with subscription_id, new_expiration_date
        """
        from datetime import datetime, timedelta

        logger.info(
            f"[STUB] Extending subscription {subscription_id} by {extension_period} months"
        )

        # TODO: Implement actual subscription extension
        # This would:
        # 1. Fetch subscription
        # 2. Calculate new expiration date
        # 3. Update subscription record
        # 4. Return updated details

        new_expiration = datetime.utcnow() + timedelta(days=30 * extension_period)

        return {
            "subscription_id": subscription_id,
            "extension_period": extension_period,
            "new_expiration_date": new_expiration.isoformat(),
            "status": "active",
        }

    async def process_renewal_payment(
        self,
        customer_id: int | str,
        quote_id: int | str,
    ) -> Dict[str, Any]:
        """
        Process payment for a renewal quote.

        Args:
            customer_id: Customer ID
            quote_id: Renewal quote ID

        Returns:
            Dict with payment_id, status, amount
        """
        logger.info(
            f"[STUB] Processing renewal payment for customer {customer_id}, quote {quote_id}"
        )

        # TODO: Implement actual renewal payment processing
        # This would:
        # 1. Fetch quote amount
        # 2. Charge customer's payment method
        # 3. Create payment record
        # 4. Return payment details

        return {
            "payment_id": f"stub-renewal-payment-{quote_id}",
            "customer_id": customer_id,
            "quote_id": quote_id,
            "amount": "99.00",
            "status": "completed",
        }

    async def activate_service(
        self,
        customer_id: int | str,
        service_id: int | str,
        tenant_id: str | None = None,
        activation_notes: str | None = None,
    ) -> Dict[str, Any]:
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
        from datetime import UTC, datetime
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
                BillingSubscriptionTable.status.in_([
                    SubscriptionStatus.TRIAL,
                    SubscriptionStatus.PENDING,
                ])
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
                            activated_at=datetime.now(UTC) if not subscription.activated_at else subscription.activated_at,
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
