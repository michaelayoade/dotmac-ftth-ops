"""
Example usage of the simplified Celery-based events system.

This demonstrates how the new events system replaces 2500+ lines
of complex code with simple, direct Celery usage.
"""

from dotmac.platform.communications.events import event_handler, publish_event


# Define event handlers using the simple decorator
@event_handler("user.created", max_retries=3, retry_delay=5)
def send_welcome_email(event):
    """Send welcome email when user is created."""
    user_id = event.payload["user_id"]
    email = event.payload["email"]

    print(f"Sending welcome email to {email} for user {user_id}")

    # In real code, this would:
    # - Send actual email via SendGrid/etc
    # - Log the action
    # - Update user preferences

    return {"email_sent": True, "user_id": user_id}


@event_handler("user.created")
def update_user_analytics(event):
    """Update analytics when user is created."""
    user_id = event.payload["user_id"]

    print(f"Updating analytics for user {user_id}")

    # In real code, this would:
    # - Update analytics database
    # - Trigger metric calculations
    # - Send to data pipeline

    return {"analytics_updated": True}


@event_handler("order.completed", max_retries=5, retry_delay=10)
def process_order_completion(event):
    """Process completed orders."""
    order_id = event.payload["order_id"]
    customer_id = event.payload["customer_id"]
    total = event.payload["total"]

    print(f"Processing completed order {order_id} for customer {customer_id}, total: ${total}")

    # In real code, this would:
    # - Update inventory
    # - Generate invoice
    # - Send confirmation email
    # - Update customer records

    return {"order_processed": True, "order_id": order_id}


@event_handler("product.low_stock")
def handle_low_stock_alert(event):
    """Handle low stock alerts."""
    product_id = event.payload["product_id"]
    current_stock = event.payload["current_stock"]
    threshold = event.payload["threshold"]

    print(
        f"Low stock alert: Product {product_id} has {current_stock} items (threshold: {threshold})"
    )

    # In real code, this would:
    # - Notify procurement team
    # - Auto-reorder if configured
    # - Update product status

    return {"alert_processed": True}


def example_usage():
    """Demonstrate publishing events."""

    # Example 1: User registration
    print("Publishing user.created event...")
    event_id = publish_event(
        "user.created",
        {
            "user_id": 12345,
            "email": "newuser@example.com",
            "name": "Jane Doe",
            "signup_source": "web",
        },
    )
    print(f"Published event {event_id}")

    # Example 2: Order completion
    print("\nPublishing order.completed event...")
    event_id = publish_event(
        "order.completed",
        {
            "order_id": "ORD-67890",
            "customer_id": 12345,
            "total": 89.99,
            "items": [
                {"product_id": "PROD-1", "quantity": 2},
                {"product_id": "PROD-2", "quantity": 1},
            ],
        },
    )
    print(f"Published event {event_id}")

    # Example 3: Multi-tenant event
    print("\nPublishing tenant-specific event...")
    event_id = publish_event(
        "product.low_stock",
        {"product_id": "PROD-123", "current_stock": 5, "threshold": 10},
        tenant_id="tenant-abc",
    )
    print(f"Published tenant event {event_id}")


if __name__ == "__main__":
    print("=== Celery Events System Example ===")
    print("Benefits of the new system:")
    print("- 94% code reduction (2543 → 163 lines)")
    print("- Uses industry-standard Celery")
    print("- Built-in retry, monitoring, scaling")
    print("- No custom abstractions")
    print("- Direct Celery task management")
    print()

    example_usage()

    print("\nTo process these events, run Celery workers:")
    print("celery -A dotmac.platform.tasks worker --loglevel=info")
