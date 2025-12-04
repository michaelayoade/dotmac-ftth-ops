"""
Billing system exceptions.

Custom exceptions for billing operations with clear error messages.
Provides comprehensive error handling with status codes, context, and recovery hints.
"""

from typing import Any


class BillingError(Exception):
    """
    Base billing system error with enhanced context.

    Attributes:
        message: Human-readable error message
        error_code: Machine-readable error code for API responses
        status_code: HTTP status code for this error type
        context: Additional context data about the error
        recovery_hint: Suggested action to resolve the error
    """

    def __init__(
        self,
        message: str,
        error_code: str | None = None,
        status_code: int = 400,
        context: dict[str, Any] | None = None,
        recovery_hint: str | None = None,
    ):
        self.message = message
        self.error_code = error_code or "BILLING_ERROR"
        self.status_code = status_code
        self.context = context or {}
        self.recovery_hint = recovery_hint
        super().__init__(self.message)

    def to_dict(self) -> dict[str, Any]:
        """Convert error to dictionary for API responses."""
        return {
            "error_code": self.error_code,
            "message": self.message,
            "status_code": self.status_code,
            "context": self.context,
            "recovery_hint": self.recovery_hint,
        }


class ProductError(BillingError):
    """Product-related errors."""

    def __init__(
        self,
        message: str,
        context: dict[str, Any] | None = None,
        recovery_hint: str | None = None,
    ):
        super().__init__(
            message, "PRODUCT_ERROR", status_code=400, context=context, recovery_hint=recovery_hint
        )


class ProductNotFoundError(ProductError):
    """Product not found error."""

    def __init__(self, message: str, product_id: str | None = None, sku: str | None = None) -> None:
        context = {}
        if product_id:
            context["product_id"] = product_id
        if sku:
            context["sku"] = sku

        super().__init__(
            message,
            context=context,
            recovery_hint="Verify the product ID or SKU and ensure the product exists and is active",
        )
        self.error_code = "PRODUCT_NOT_FOUND"
        self.status_code = 404


class CategoryNotFoundError(ProductError):
    """Category not found error."""

    def __init__(
        self, message: str, category_id: str | None = None, category_name: str | None = None
    ):
        context = {}
        if category_id:
            context["category_id"] = category_id
        if category_name:
            context["category_name"] = category_name

        super().__init__(
            message,
            context=context,
            recovery_hint="Verify the category ID or name and ensure it exists",
        )
        self.error_code = "CATEGORY_NOT_FOUND"
        self.status_code = 404


class DuplicateProductError(ProductError):
    """Product already exists error."""

    def __init__(self, message: str, sku: str) -> None:
        super().__init__(
            message,
            context={"sku": sku},
            recovery_hint="Use a unique SKU or update the existing product",
        )
        self.error_code = "DUPLICATE_PRODUCT"
        self.status_code = 409


class SubscriptionError(BillingError):
    """Subscription-related errors."""

    def __init__(
        self,
        message: str,
        context: dict[str, Any] | None = None,
        recovery_hint: str | None = None,
    ):
        super().__init__(
            message,
            "SUBSCRIPTION_ERROR",
            status_code=400,
            context=context,
            recovery_hint=recovery_hint,
        )


class SubscriptionNotFoundError(SubscriptionError):
    """Subscription not found error."""

    def __init__(
        self, message: str, subscription_id: str | None = None, customer_id: str | None = None
    ):
        context = {}
        if subscription_id:
            context["subscription_id"] = subscription_id
        if customer_id:
            context["customer_id"] = customer_id

        super().__init__(
            message,
            context=context,
            recovery_hint="Verify the subscription ID and ensure it exists and is accessible",
        )
        self.error_code = "SUBSCRIPTION_NOT_FOUND"
        self.status_code = 404


class SubscriptionStateError(SubscriptionError):
    """Invalid subscription state transition error."""

    def __init__(self, message: str, current_state: str, requested_state: str) -> None:
        super().__init__(
            message,
            context={"current_state": current_state, "requested_state": requested_state},
            recovery_hint=f"Cannot transition from {current_state} to {requested_state}. Check subscription status first.",
        )
        self.error_code = "INVALID_SUBSCRIPTION_STATE"


class PlanNotFoundError(SubscriptionError):
    """Subscription plan not found error."""

    def __init__(self, message: str, plan_id: str | None = None) -> None:
        context = {}
        if plan_id:
            context["plan_id"] = plan_id

        super().__init__(
            message,
            context=context,
            recovery_hint="Verify the plan ID and ensure it exists and is active",
        )
        self.error_code = "PLAN_NOT_FOUND"
        self.status_code = 404


class PricingError(BillingError):
    """Pricing-related errors."""

    def __init__(
        self,
        message: str,
        context: dict[str, Any] | None = None,
        recovery_hint: str | None = None,
    ):
        super().__init__(
            message, "PRICING_ERROR", status_code=400, context=context, recovery_hint=recovery_hint
        )


class InvalidPricingRuleError(PricingError):
    """Invalid pricing rule configuration."""

    def __init__(
        self,
        message: str,
        rule_id: str | None = None,
        validation_errors: dict[str, Any] | None = None,
    ):
        context: dict[str, Any] = {}
        if rule_id:
            context["rule_id"] = rule_id
        if validation_errors:
            context["validation_errors"] = validation_errors

        super().__init__(
            message,
            context=context,
            recovery_hint="Review pricing rule configuration and ensure all required fields are valid",
        )
        self.error_code = "INVALID_PRICING_RULE"


class PriceCalculationError(PricingError):
    """Error during price calculation."""

    def __init__(
        self, message: str, product_id: str | None = None, quantity: int | None = None
    ) -> None:
        context: dict[str, Any] = {}
        if product_id:
            context["product_id"] = product_id
        if quantity:
            context["quantity"] = quantity

        super().__init__(
            message,
            context=context,
            recovery_hint="Check product pricing configuration and ensure all required pricing data is available",
        )
        self.error_code = "PRICE_CALCULATION_ERROR"


class UsageTrackingError(BillingError):
    """Usage tracking errors."""

    def __init__(
        self,
        message: str,
        context: dict[str, Any] | None = None,
        recovery_hint: str | None = None,
    ):
        super().__init__(
            message,
            "USAGE_TRACKING_ERROR",
            status_code=400,
            context=context,
            recovery_hint=recovery_hint,
        )


class UsageLimitExceededError(UsageTrackingError):
    """Usage limit exceeded error."""

    def __init__(self, message: str, current_usage: int, limit: int, metric_name: str) -> None:
        super().__init__(
            message,
            context={"current_usage": current_usage, "limit": limit, "metric_name": metric_name},
            recovery_hint="Upgrade your plan or purchase additional usage capacity",
        )
        self.error_code = "USAGE_LIMIT_EXCEEDED"


class BillingConfigurationError(BillingError):
    """Billing configuration errors."""

    def __init__(
        self, message: str, config_key: str | None = None, recovery_hint: str | None = None
    ):
        context = {}
        if config_key:
            context["config_key"] = config_key

        super().__init__(
            message,
            "BILLING_CONFIG_ERROR",
            status_code=500,
            context=context,
            recovery_hint=recovery_hint or "Check billing configuration settings",
        )


class PaymentError(BillingError):
    """Payment processing errors."""

    def __init__(
        self,
        message: str,
        context: dict[str, Any] | None = None,
        recovery_hint: str | None = None,
    ):
        super().__init__(
            message, "PAYMENT_ERROR", status_code=402, context=context, recovery_hint=recovery_hint
        )


class PaymentMethodError(PaymentError):
    """Payment method errors."""

    def __init__(self, message: str, payment_method_id: str | None = None) -> None:
        context = {}
        if payment_method_id:
            context["payment_method_id"] = payment_method_id

        super().__init__(
            message,
            context=context,
            recovery_hint="Verify payment method is valid and has sufficient funds",
        )
        self.error_code = "PAYMENT_METHOD_ERROR"


class InvoiceError(BillingError):
    """Invoice-related errors."""

    def __init__(
        self,
        message: str,
        context: dict[str, Any] | None = None,
        recovery_hint: str | None = None,
    ):
        super().__init__(
            message, "INVOICE_ERROR", status_code=400, context=context, recovery_hint=recovery_hint
        )


class InvoiceNotFoundError(InvoiceError):
    """Invoice not found error."""

    def __init__(self, message: str, invoice_id: str | None = None) -> None:
        context = {}
        if invoice_id:
            context["invoice_id"] = invoice_id

        super().__init__(
            message, context=context, recovery_hint="Verify the invoice ID and ensure it exists"
        )
        self.error_code = "INVOICE_NOT_FOUND"
        self.status_code = 404


class WebhookError(BillingError):
    """Webhook processing errors."""

    def __init__(
        self, message: str, webhook_type: str | None = None, provider: str | None = None
    ) -> None:
        context = {}
        if webhook_type:
            context["webhook_type"] = webhook_type
        if provider:
            context["provider"] = provider

        super().__init__(
            message,
            "WEBHOOK_ERROR",
            status_code=400,
            context=context,
            recovery_hint="Check webhook configuration and retry the webhook delivery",
        )


class AddonError(BillingError):
    """Add-on related errors."""

    def __init__(
        self,
        message: str,
        context: dict[str, Any] | None = None,
        recovery_hint: str | None = None,
    ):
        super().__init__(
            message, "ADDON_ERROR", status_code=400, context=context, recovery_hint=recovery_hint
        )


class AddonNotFoundError(AddonError):
    """Add-on not found error."""

    def __init__(self, message: str, addon_id: str | None = None) -> None:
        context = {}
        if addon_id:
            context["addon_id"] = addon_id

        super().__init__(
            message,
            context=context,
            recovery_hint="Verify the add-on ID and ensure it exists and is active",
        )
        self.error_code = "ADDON_NOT_FOUND"
        self.status_code = 404
