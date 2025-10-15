"""
Event-Driven Architecture Demo.

This example demonstrates how to use the event bus to decouple
modules through event publishing and subscription.
"""

import asyncio

from dotmac.platform.billing.events import (
    emit_invoice_created,
    emit_invoice_paid,
    emit_subscription_created,
)
from dotmac.platform.events import Event, EventPriority, get_event_bus, subscribe

# ============================================================================
# Define Custom Event Handlers
# ============================================================================


@subscribe("invoice.created")
async def log_invoice_created(event: Event):
    """Log when an invoice is created."""
    print("\n[Logger] Invoice created:")
    print(f"  - Invoice ID: {event.payload['invoice_id']}")
    print(f"  - Customer: {event.payload['customer_id']}")
    print(f"  - Amount: ${event.payload['amount']}")
    print(f"  - Event ID: {event.event_id}")


@subscribe("invoice.created")
async def notify_accounting(event: Event):
    """Notify accounting system of new invoice."""
    print("\n[Accounting] New invoice to record:")
    print(f"  - Invoice: {event.payload['invoice_id']}")
    print(f"  - Amount: ${event.payload['amount']}")


@subscribe("invoice.paid")
async def update_customer_balance(event: Event):
    """Update customer balance when invoice is paid."""
    print("\n[Customer Service] Updating balance:")
    print(f"  - Customer: {event.payload['customer_id']}")
    print(f"  - Payment: {event.payload['payment_id']}")
    print(f"  - Amount: ${event.payload['amount']}")


@subscribe("invoice.paid")
async def send_thank_you_email(event: Event):
    """Send thank you email after payment."""
    print("\n[Communications] Sending thank you email:")
    print(f"  - Customer: {event.payload['customer_id']}")
    print(f"  - Invoice: {event.payload['invoice_id']}")


@subscribe("subscription.created")
async def provision_resources(event: Event):
    """Provision resources for new subscription."""
    print("\n[Provisioning] Creating resources:")
    print(f"  - Subscription: {event.payload['subscription_id']}")
    print(f"  - Plan: {event.payload['plan_id']}")


@subscribe("subscription.created")
async def send_welcome_package(event: Event):
    """Send welcome package to new subscriber."""
    print("\n[Communications] Sending welcome package:")
    print(f"  - Customer: {event.payload['customer_id']}")


# ============================================================================
# Demo Scenarios
# ============================================================================


async def demo_invoice_workflow():
    """Demonstrate invoice creation and payment workflow."""
    print("=" * 70)
    print("DEMO 1: Invoice Workflow")
    print("=" * 70)

    # Create invoice - triggers multiple handlers
    await emit_invoice_created(
        invoice_id="INV-2024-001",
        customer_id="CUST-12345",
        amount=299.99,
        currency="USD",
        tenant_id="demo-tenant",
    )

    await asyncio.sleep(0.2)  # Let handlers process

    # Pay invoice - triggers different handlers
    await emit_invoice_paid(
        invoice_id="INV-2024-001",
        customer_id="CUST-12345",
        amount=299.99,
        payment_id="PAY-98765",
        tenant_id="demo-tenant",
    )

    await asyncio.sleep(0.2)


async def demo_subscription_workflow():
    """Demonstrate subscription creation workflow."""
    print("\n" + "=" * 70)
    print("DEMO 2: Subscription Workflow")
    print("=" * 70)

    # Create subscription - triggers multiple handlers
    await emit_subscription_created(
        subscription_id="SUB-2024-001",
        customer_id="CUST-12345",
        plan_id="PLAN-PRO",
        tenant_id="demo-tenant",
    )

    await asyncio.sleep(0.2)


async def demo_custom_events():
    """Demonstrate custom event publishing."""
    print("\n" + "=" * 70)
    print("DEMO 3: Custom Events")
    print("=" * 70)

    event_bus = get_event_bus(redis_client=None, enable_persistence=False)

    # Define custom handler
    @subscribe("user.registered")
    async def send_welcome_email(event: Event):
        print(f"\n[Email] Sending welcome email to {event.payload['email']}")

    @subscribe("user.registered")
    async def create_trial_subscription(event: Event):
        print(f"\n[Billing] Creating trial for user {event.payload['user_id']}")

    # Publish custom event
    await event_bus.publish(
        event_type="user.registered",
        payload={
            "user_id": "user-001",
            "email": "newuser@example.com",
            "name": "Jane Doe",
        },
        priority=EventPriority.HIGH,
    )

    await asyncio.sleep(0.2)


async def demo_event_query():
    """Demonstrate event querying and replay."""
    print("\n" + "=" * 70)
    print("DEMO 4: Event Query and Replay")
    print("=" * 70)

    event_bus = get_event_bus(redis_client=None, enable_persistence=True)

    # Publish some events
    event1 = await event_bus.publish(
        event_type="test.event",
        payload={"message": "First event"},
    )

    await event_bus.publish(
        event_type="test.event",
        payload={"message": "Second event"},
    )

    await asyncio.sleep(0.1)

    # Query events
    events = await event_bus.get_events(event_type="test.event")
    print(f"\n[Query] Found {len(events)} events of type 'test.event'")
    for event in events:
        print(f"  - {event.event_id}: {event.payload['message']}")

    # Replay an event
    print(f"\n[Replay] Replaying event {event1.event_id}")

    @subscribe("test.event")
    async def log_test_event(event: Event):
        print(f"  - Received: {event.payload['message']}")

    await event_bus.replay_event(event1.event_id)
    await asyncio.sleep(0.1)


async def demo_error_handling():
    """Demonstrate error handling and retry."""
    print("\n" + "=" * 70)
    print("DEMO 5: Error Handling and Retry")
    print("=" * 70)

    event_bus = get_event_bus(redis_client=None, enable_persistence=True)

    attempt_count = 0

    @subscribe("flaky.event")
    async def flaky_handler(event: Event):
        nonlocal attempt_count
        attempt_count += 1
        print(f"\n[Handler] Attempt {attempt_count}")

        if attempt_count < 2:
            print("  - Simulating failure...")
            raise Exception("Temporary error")
        else:
            print("  - Success!")

    await event_bus.publish(
        event_type="flaky.event",
        payload={"data": "test"},
    )

    await asyncio.sleep(1.5)  # Wait for retries

    print(f"\n[Summary] Handler succeeded after {attempt_count} attempts")


# ============================================================================
# Main Demo
# ============================================================================


async def main():
    """Run all demos."""
    print("\n")
    print("╔" + "=" * 68 + "╗")
    print("║" + " " * 20 + "EVENT-DRIVEN ARCHITECTURE DEMO" + " " * 18 + "║")
    print("╚" + "=" * 68 + "╝")

    # Run demos
    await demo_invoice_workflow()
    await demo_subscription_workflow()
    await demo_custom_events()
    await demo_event_query()
    await demo_error_handling()

    print("\n" + "=" * 70)
    print("DEMO COMPLETE")
    print("=" * 70)
    print("\nKey Takeaways:")
    print("  ✓ Events decouple modules")
    print("  ✓ Multiple handlers can react to same event")
    print("  ✓ Automatic retry on failures")
    print("  ✓ Event persistence for audit trail")
    print("  ✓ Easy to add new functionality without changing existing code")
    print()


if __name__ == "__main__":
    asyncio.run(main())
