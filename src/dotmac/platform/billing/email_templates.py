"""
Email templates for tenant billing events.

These templates can be customized per tenant or globally.
All templates support HTML and plain text versions.
"""

from typing import Any

from dotmac.platform.settings import settings

# Email template registry
EMAIL_TEMPLATES = {
    # Subscription Events
    "subscription_created": {
        "subject": "Welcome to {plan_name}!",
        "html": """
            <h2>Welcome to {plan_name}!</h2>
            <p>Thank you for subscribing to our {plan_name} plan.</p>

            <h3>Subscription Details:</h3>
            <ul>
                <li><strong>Plan:</strong> {plan_name}</li>
                <li><strong>Price:</strong> {price_formatted} / {billing_cycle}</li>
                <li><strong>Start Date:</strong> {start_date}</li>
                <li><strong>Next Billing:</strong> {next_billing_date}</li>
            </ul>

            {trial_info}

            <p>You can manage your subscription anytime in your billing dashboard.</p>

            <p>
                <a href="{dashboard_url}" style="background-color: #0070f3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                    View Dashboard
                </a>
            </p>
        """,
        "text": """
Welcome to {plan_name}!

Thank you for subscribing to our {plan_name} plan.

Subscription Details:
- Plan: {plan_name}
- Price: {price_formatted} / {billing_cycle}
- Start Date: {start_date}
- Next Billing: {next_billing_date}

{trial_info}

You can manage your subscription anytime in your billing dashboard: {dashboard_url}
        """,
    },
    "subscription_upgraded": {
        "subject": "Your plan has been upgraded to {new_plan_name}",
        "html": """
            <h2>Plan Upgrade Confirmed</h2>
            <p>Your subscription has been successfully upgraded!</p>

            <h3>Upgrade Summary:</h3>
            <table style="width: 100%; border-collapse: collapse;">
                <tr style="background-color: #f5f5f5;">
                    <th style="padding: 8px; text-align: left;">Item</th>
                    <th style="padding: 8px; text-align: right;">Amount</th>
                </tr>
                <tr>
                    <td style="padding: 8px;">Previous Plan ({old_plan_name})</td>
                    <td style="padding: 8px; text-align: right;">-{prorated_credit_formatted}</td>
                </tr>
                <tr>
                    <td style="padding: 8px;">New Plan ({new_plan_name})</td>
                    <td style="padding: 8px; text-align: right;">{prorated_charge_formatted}</td>
                </tr>
                <tr style="font-weight: bold; background-color: #f5f5f5;">
                    <td style="padding: 8px;">Amount Charged Today</td>
                    <td style="padding: 8px; text-align: right;">{total_charged_formatted}</td>
                </tr>
            </table>

            <p><strong>Next Billing Date:</strong> {next_billing_date}</p>
            <p><strong>New Billing Amount:</strong> {new_price_formatted} / {billing_cycle}</p>
        """,
        "text": """
Plan Upgrade Confirmed

Your subscription has been successfully upgraded!

Upgrade Summary:
- Previous Plan ({old_plan_name}): -{prorated_credit_formatted}
- New Plan ({new_plan_name}): {prorated_charge_formatted}
- Amount Charged Today: {total_charged_formatted}

Next Billing Date: {next_billing_date}
New Billing Amount: {new_price_formatted} / {billing_cycle}
        """,
    },
    "subscription_canceled": {
        "subject": "Your subscription has been canceled",
        "html": """
            <h2>Subscription Canceled</h2>
            <p>We're sorry to see you go. Your subscription has been canceled.</p>

            <h3>Cancellation Details:</h3>
            <ul>
                <li><strong>Plan:</strong> {plan_name}</li>
                <li><strong>Access Until:</strong> {access_until_date}</li>
                <li><strong>Refund Amount:</strong> {refund_formatted}</li>
            </ul>

            <p><strong>Data Retention:</strong> Your data will be retained for 30 days. You can reactivate your subscription within this period to restore full access.</p>

            <h3>We'd Love Your Feedback</h3>
            <p>Your feedback helps us improve. Would you mind sharing why you canceled?</p>
            <p>{feedback_reason}</p>

            <p>
                <a href="{reactivate_url}" style="background-color: #0070f3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                    Reactivate Subscription
                </a>
            </p>
        """,
        "text": """
Subscription Canceled

We're sorry to see you go. Your subscription has been canceled.

Cancellation Details:
- Plan: {plan_name}
- Access Until: {access_until_date}
- Refund Amount: {refund_formatted}

Data Retention: Your data will be retained for 30 days. You can reactivate your subscription within this period.

Reason: {feedback_reason}

Reactivate: {reactivate_url}
        """,
    },
    # Payment Events
    "payment_succeeded": {
        "subject": "Payment Receipt - {amount_formatted}",
        "html": """
            <h2>Payment Successful</h2>
            <p>Thank you! Your payment has been processed successfully.</p>

            <h3>Payment Details:</h3>
            <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                <tr>
                    <td style="padding: 8px;"><strong>Amount:</strong></td>
                    <td style="padding: 8px; text-align: right;">{amount_formatted}</td>
                </tr>
                <tr>
                    <td style="padding: 8px;"><strong>Payment Date:</strong></td>
                    <td style="padding: 8px; text-align: right;">{payment_date}</td>
                </tr>
                <tr>
                    <td style="padding: 8px;"><strong>Payment Method:</strong></td>
                    <td style="padding: 8px; text-align: right;">{payment_method}</td>
                </tr>
                <tr>
                    <td style="padding: 8px;"><strong>Invoice Number:</strong></td>
                    <td style="padding: 8px; text-align: right;">{invoice_number}</td>
                </tr>
            </table>

            <p>
                <a href="{invoice_url}" style="background-color: #0070f3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                    Download Invoice
                </a>
            </p>
        """,
        "text": """
Payment Successful

Thank you! Your payment has been processed successfully.

Payment Details:
- Amount: {amount_formatted}
- Payment Date: {payment_date}
- Payment Method: {payment_method}
- Invoice Number: {invoice_number}

Download Invoice: {invoice_url}
        """,
    },
    "payment_failed": {
        "subject": "Payment Failed - Action Required",
        "html": """
            <h2 style="color: #dc2626;">Payment Failed</h2>
            <p>We were unable to process your payment for {amount_formatted}.</p>

            <h3>Details:</h3>
            <ul>
                <li><strong>Amount:</strong> {amount_formatted}</li>
                <li><strong>Payment Method:</strong> {payment_method}</li>
                <li><strong>Failure Reason:</strong> {failure_reason}</li>
                <li><strong>Retry Date:</strong> {retry_date}</li>
            </ul>

            <p><strong>What happens next?</strong></p>
            <p>We'll automatically retry the payment {retry_date}. To avoid service interruption, please:</p>
            <ul>
                <li>Verify your payment method details are up to date</li>
                <li>Ensure sufficient funds are available</li>
                <li>Update your payment method if needed</li>
            </ul>

            <p>
                <a href="{update_payment_url}" style="background-color: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                    Update Payment Method
                </a>
            </p>
        """,
        "text": """
Payment Failed - Action Required

We were unable to process your payment for {amount_formatted}.

Details:
- Amount: {amount_formatted}
- Payment Method: {payment_method}
- Failure Reason: {failure_reason}
- Retry Date: {retry_date}

What happens next?
We'll automatically retry the payment {retry_date}. Please update your payment method if needed.

Update Payment Method: {update_payment_url}
        """,
    },
    # Invoice Events
    "invoice_generated": {
        "subject": "New Invoice #{invoice_number} - {amount_formatted}",
        "html": """
            <h2>New Invoice Available</h2>
            <p>A new invoice has been generated for your subscription.</p>

            <h3>Invoice Summary:</h3>
            <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                <tr>
                    <td style="padding: 8px;"><strong>Invoice Number:</strong></td>
                    <td style="padding: 8px; text-align: right;">#{invoice_number}</td>
                </tr>
                <tr>
                    <td style="padding: 8px;"><strong>Issue Date:</strong></td>
                    <td style="padding: 8px; text-align: right;">{issue_date}</td>
                </tr>
                <tr>
                    <td style="padding: 8px;"><strong>Due Date:</strong></td>
                    <td style="padding: 8px; text-align: right;">{due_date}</td>
                </tr>
                <tr style="font-weight: bold; background-color: #f5f5f5;">
                    <td style="padding: 8px;">Amount Due:</td>
                    <td style="padding: 8px; text-align: right;">{amount_formatted}</td>
                </tr>
            </table>

            <p>Payment will be automatically charged to your {payment_method} on {due_date}.</p>

            <p>
                <a href="{invoice_url}" style="background-color: #0070f3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                    View Invoice
                </a>
            </p>
        """,
        "text": """
New Invoice Available

A new invoice has been generated for your subscription.

Invoice Summary:
- Invoice Number: #{invoice_number}
- Issue Date: {issue_date}
- Due Date: {due_date}
- Amount Due: {amount_formatted}

Payment will be automatically charged to your {payment_method} on {due_date}.

View Invoice: {invoice_url}
        """,
    },
    # Add-on Events
    "addon_purchased": {
        "subject": "Add-on Activated: {addon_name}",
        "html": """
            <h2>Add-on Activated</h2>
            <p>Great choice! Your {addon_name} add-on has been activated.</p>

            <h3>Add-on Details:</h3>
            <ul>
                <li><strong>Name:</strong> {addon_name}</li>
                <li><strong>Price:</strong> {price_formatted} / {billing_cycle}</li>
                <li><strong>Quantity:</strong> {quantity}</li>
                <li><strong>Total:</strong> {total_formatted} / {billing_cycle}</li>
            </ul>

            <p>This add-on will be included in your next invoice on {next_billing_date}.</p>

            <p>
                <a href="{addon_url}" style="background-color: #0070f3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                    Manage Add-ons
                </a>
            </p>
        """,
        "text": """
Add-on Activated

Great choice! Your {addon_name} add-on has been activated.

Add-on Details:
- Name: {addon_name}
- Price: {price_formatted} / {billing_cycle}
- Quantity: {quantity}
- Total: {total_formatted} / {billing_cycle}

This add-on will be included in your next invoice on {next_billing_date}.

Manage Add-ons: {addon_url}
        """,
    },
    # Usage Alerts
    "usage_limit_warning": {
        "subject": "Usage Alert: Approaching {metric_name} Limit",
        "html": """
            <h2 style="color: #f59e0b;">Usage Limit Warning</h2>
            <p>You're approaching your {metric_name} limit for the current billing period.</p>

            <h3>Current Usage:</h3>
            <ul>
                <li><strong>{metric_name}:</strong> {current_usage} of {limit} ({percentage}% used)</li>
                <li><strong>Billing Period:</strong> {period_start} - {period_end}</li>
                <li><strong>Remaining:</strong> {remaining} {unit}</li>
            </ul>

            <p><strong>What happens if I exceed my limit?</strong></p>
            <p>Depending on your plan:</p>
            <ul>
                <li>Service may be temporarily paused</li>
                <li>Overage charges may apply</li>
                <li>You may be prompted to upgrade</li>
            </ul>

            <p>
                <a href="{upgrade_url}" style="background-color: #0070f3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                    Upgrade Plan
                </a>
            </p>
        """,
        "text": """
Usage Limit Warning

You're approaching your {metric_name} limit for the current billing period.

Current Usage:
- {metric_name}: {current_usage} of {limit} ({percentage}% used)
- Billing Period: {period_start} - {period_end}
- Remaining: {remaining} {unit}

Consider upgrading your plan: {upgrade_url}
        """,
    },
}


def render_template(template_name: str, context: dict[str, Any]) -> tuple[str, str, str]:
    """
    Render email template with context data.

    Args:
        template_name: Name of the template to render
        context: Dictionary of variables to interpolate

    Returns:
        Tuple of (subject, html_body, text_body)
    """
    if template_name not in EMAIL_TEMPLATES:
        raise ValueError(f"Unknown email template: {template_name}")

    template = EMAIL_TEMPLATES[template_name]

    subject = template["subject"].format(**context)
    html = template["html"].format(**context)
    text = template["text"].format(**context)

    return subject, html, text


# Template context builders
def build_subscription_created_context(subscription: Any, tenant: Any) -> dict[str, Any]:
    """Build context for subscription_created email"""
    return {
        "plan_name": subscription.plan_name,
        "price_formatted": f"${subscription.price_amount / 100:.2f}",
        "billing_cycle": subscription.billing_cycle,
        "start_date": subscription.started_at.strftime("%B %d, %Y"),
        "next_billing_date": subscription.current_period_end.strftime("%B %d, %Y"),
        "trial_info": (
            f"<p><strong>Trial Period:</strong> Your trial ends on {subscription.trial_end.strftime('%B %d, %Y')}</p>"
            if subscription.trial_end
            else ""
        ),
        "dashboard_url": settings.urls.customer_billing_dashboard_url,
    }


def build_payment_failed_context(payment: Any, subscription: Any) -> dict[str, Any]:
    """Build context for payment_failed email"""
    return {
        "amount_formatted": f"${payment.amount / 100:.2f}",
        "payment_method": f"••••{payment.payment_method_last4}",
        "failure_reason": payment.error_message or "Payment declined",
        "retry_date": "within 3 days",
        "update_payment_url": settings.urls.payment_method_update_url,
    }
