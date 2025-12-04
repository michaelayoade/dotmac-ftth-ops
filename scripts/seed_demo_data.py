#!/usr/bin/env python3
"""
Demo Data Seeding Script

Seeds the staging database with realistic demo data for:
- Demo tenant
- User accounts (various roles)
- Sample customers
- Sample subscriptions
- Sample invoices
- Network infrastructure
"""

import asyncio
import logging
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.auth.core import hash_password
from dotmac.platform.customer_management.models import Customer, CustomerStatus
from dotmac.platform.db import AsyncSessionLocal
from dotmac.platform.tenant.models import Tenant, TenantStatus
from dotmac.platform.user_management.models import User, UserRole, UserStatus

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

DEMO_TENANT_ID = "demo-tenant"

# Demo user accounts
DEMO_USERS = [
    {
        "email": "admin@dotmac.com",
        "username": "admin",
        "first_name": "Platform",
        "last_name": "Administrator",
        "password": "Admin123!",
        "role": UserRole.PLATFORM_ADMIN,
        "is_platform_admin": True,
    },
    {
        "email": "isp-admin@demo.com",
        "username": "isp-admin",
        "first_name": "ISP",
        "last_name": "Administrator",
        "password": "IspAdmin123!",
        "role": UserRole.ADMIN,
        "is_platform_admin": False,
    },
    {
        "email": "billing@demo.com",
        "username": "billing-manager",
        "first_name": "Billing",
        "last_name": "Manager",
        "password": "Billing123!",
        "role": UserRole.BILLING_MANAGER,
        "is_platform_admin": False,
    },
    {
        "email": "support@demo.com",
        "username": "support-agent",
        "first_name": "Support",
        "last_name": "Agent",
        "password": "Support123!",
        "role": UserRole.SUPPORT,
        "is_platform_admin": False,
    },
    {
        "email": "customer@demo.com",
        "username": "demo-customer",
        "first_name": "Demo",
        "last_name": "Customer",
        "password": "Customer123!",
        "role": UserRole.USER,
        "is_platform_admin": False,
    },
]

# Demo customers
DEMO_CUSTOMERS = [
    {
        "first_name": "John",
        "last_name": "Smith",
        "email": "john.smith@example.com",
        "phone": "+1-555-0101",
        "service_address": "123 Main St, Apt 4B",
        "service_city": "New York",
        "service_state": "NY",
        "service_zip": "10001",
        "connection_type": "fiber",
    },
    {
        "first_name": "Sarah",
        "last_name": "Johnson",
        "email": "sarah.j@example.com",
        "phone": "+1-555-0102",
        "service_address": "456 Oak Avenue",
        "service_city": "Brooklyn",
        "service_state": "NY",
        "service_zip": "11201",
        "connection_type": "fiber",
    },
    {
        "first_name": "Michael",
        "last_name": "Chen",
        "email": "m.chen@example.com",
        "phone": "+1-555-0103",
        "service_address": "789 Elm Street, Suite 200",
        "service_city": "Queens",
        "service_state": "NY",
        "service_zip": "11355",
        "connection_type": "wireless",
    },
    {
        "first_name": "Emily",
        "last_name": "Williams",
        "email": "emily.w@example.com",
        "phone": "+1-555-0104",
        "service_address": "321 Pine Road",
        "service_city": "Manhattan",
        "service_state": "NY",
        "service_zip": "10002",
        "connection_type": "fiber",
    },
    {
        "first_name": "David",
        "last_name": "Martinez",
        "email": "d.martinez@example.com",
        "phone": "+1-555-0105",
        "service_address": "555 Maple Drive",
        "service_city": "Bronx",
        "service_state": "NY",
        "service_zip": "10451",
        "connection_type": "fiber",
    },
]


async def create_demo_tenant(db: AsyncSession) -> Tenant:
    """Create or get demo tenant."""
    stmt = select(Tenant).where(Tenant.id == DEMO_TENANT_ID)
    result = await db.execute(stmt)
    tenant = result.scalar_one_or_none()

    if tenant:
        logger.info(f"Demo tenant already exists: {DEMO_TENANT_ID}")
        return tenant

    tenant = Tenant(
        id=DEMO_TENANT_ID,
        name="Demo ISP",
        slug="demo-isp",
        status=TenantStatus.ACTIVE,
        company_name="Demo ISP Inc.",
        contact_email="contact@demo-isp.com",
        contact_phone="+1-555-DEMO-ISP",
        address="123 Demo Street",
        city="Demo City",
        state="NY",
        postal_code="10001",
        country="US",
        timezone="America/New_York",
        settings={
            "billing_enabled": True,
            "radius_enabled": True,
            "crm_enabled": True,
            "max_users": 1000,
            "features": {
                "analytics": True,
                "dunning": True,
                "ticketing": True,
            },
        },
    )

    db.add(tenant)
    await db.commit()
    await db.refresh(tenant)

    logger.info(f"Created demo tenant: {tenant.name} ({tenant.id})")
    return tenant


async def create_demo_users(db: AsyncSession) -> list[User]:
    """Create demo user accounts."""
    users = []

    for user_data in DEMO_USERS:
        # Check if user already exists
        stmt = select(User).where(User.email == user_data["email"])
        result = await db.execute(stmt)
        existing_user = result.scalar_one_or_none()

        if existing_user:
            logger.info(f"User already exists: {user_data['email']}")
            users.append(existing_user)
            continue

        # Create new user
        user = User(
            id=uuid4(),
            tenant_id=None if user_data["is_platform_admin"] else DEMO_TENANT_ID,
            email=user_data["email"],
            username=user_data["username"],
            first_name=user_data["first_name"],
            last_name=user_data["last_name"],
            password_hash=hash_password(user_data["password"]),
            role=user_data["role"],
            is_active=True,
            is_verified=True,
            status=UserStatus.ACTIVE,
            is_platform_admin=user_data["is_platform_admin"],
            preferences={
                "theme": "light",
                "notifications_enabled": True,
            },
        )

        db.add(user)
        users.append(user)
        logger.info(
            f"Created user: {user.email} ({user.role.value}) - "
            f"Platform Admin: {user.is_platform_admin}"
        )

    await db.commit()
    return users


async def create_demo_customers(db: AsyncSession) -> list[Customer]:
    """Create demo customers."""
    customers = []

    for customer_data in DEMO_CUSTOMERS:
        # Check if customer already exists
        stmt = select(Customer).where(
            Customer.email == customer_data["email"],
            Customer.tenant_id == DEMO_TENANT_ID,
        )
        result = await db.execute(stmt)
        existing_customer = result.scalar_one_or_none()

        if existing_customer:
            logger.info(f"Customer already exists: {customer_data['email']}")
            customers.append(existing_customer)
            continue

        # Create new customer
        customer = Customer(
            id=uuid4(),
            tenant_id=DEMO_TENANT_ID,
            first_name=customer_data["first_name"],
            last_name=customer_data["last_name"],
            email=customer_data["email"],
            phone=customer_data["phone"],
            status=CustomerStatus.ACTIVE,
            # ISP-specific fields
            service_address=customer_data["service_address"],
            service_city=customer_data["service_city"],
            service_state=customer_data["service_state"],
            service_zip=customer_data["service_zip"],
            connection_type=customer_data["connection_type"],
            installation_status="completed",
            service_plan_speed="100 Mbps",
            # Standard fields
            billing_address=customer_data["service_address"],
            billing_city=customer_data["service_city"],
            billing_state=customer_data["service_state"],
            billing_postal_code=customer_data["service_zip"],
            billing_country="US",
        )

        db.add(customer)
        customers.append(customer)
        logger.info(f"Created customer: {customer.email}")

    await db.commit()
    return customers


async def create_demo_subscriptions(db: AsyncSession, customers: list[Customer]):
    """Create demo subscriptions for customers."""
    try:
        from dotmac.platform.billing.subscriptions.models import (
            BillingCycle,
            Subscription,
            SubscriptionStatus,
        )

        subscriptions = []

        plans = [
            {
                "name": "Fiber 100 Mbps",
                "amount": Decimal("49.99"),
                "speed": "100 Mbps",
            },
            {
                "name": "Fiber 500 Mbps",
                "amount": Decimal("79.99"),
                "speed": "500 Mbps",
            },
            {
                "name": "Fiber 1 Gbps",
                "amount": Decimal("99.99"),
                "speed": "1 Gbps",
            },
            {
                "name": "Wireless 50 Mbps",
                "amount": Decimal("39.99"),
                "speed": "50 Mbps",
            },
        ]

        for i, customer in enumerate(customers[:4]):  # First 4 customers
            plan = plans[i % len(plans)]

            subscription = Subscription(
                id=uuid4(),
                tenant_id=DEMO_TENANT_ID,
                customer_id=customer.id,
                plan_name=plan["name"],
                status=SubscriptionStatus.ACTIVE,
                amount=plan["amount"],
                billing_cycle=BillingCycle.MONTHLY,
                start_date=datetime.now(UTC) - timedelta(days=30),
                current_period_start=datetime.now(UTC).replace(day=1),
                current_period_end=(
                    datetime.now(UTC).replace(day=1) + timedelta(days=32)
                ).replace(day=1) - timedelta(days=1),
                metadata={
                    "service_plan_speed": plan["speed"],
                    "connection_type": customer.connection_type,
                },
            )

            db.add(subscription)
            subscriptions.append(subscription)
            logger.info(
                f"Created subscription for {customer.email}: {plan['name']} - ${plan['amount']}/month"
            )

        await db.commit()
        return subscriptions

    except ImportError:
        logger.warning("Subscription models not available, skipping subscription creation")
        return []


async def main():
    """Main seeding function."""
    logger.info("=" * 60)
    logger.info("Starting Demo Data Seeding")
    logger.info("=" * 60)

    async with AsyncSessionLocal() as db:
        try:
            # Create demo tenant
            logger.info("\n1. Creating demo tenant...")
            tenant = await create_demo_tenant(db)

            # Create demo users
            logger.info("\n2. Creating demo users...")
            users = await create_demo_users(db)

            # Create demo customers
            logger.info("\n3. Creating demo customers...")
            customers = await create_demo_customers(db)

            # Create demo subscriptions
            logger.info("\n4. Creating demo subscriptions...")
            subscriptions = await create_demo_subscriptions(db, customers)

            logger.info("\n" + "=" * 60)
            logger.info("Demo Data Seeding Complete!")
            logger.info("=" * 60)
            logger.info(f"\nTenant: {tenant.name}")
            logger.info(f"Users: {len(users)}")
            logger.info(f"Customers: {len(customers)}")
            logger.info(f"Subscriptions: {len(subscriptions)}")

            logger.info("\n📝 Demo Accounts:")
            logger.info("-" * 60)
            for user_data in DEMO_USERS:
                logger.info(
                    f"Email: {user_data['email']:<30} Password: {user_data['password']}"
                )
            logger.info("-" * 60)

        except Exception as e:
            logger.error(f"Error seeding demo data: {e}", exc_info=True)
            raise


if __name__ == "__main__":
    asyncio.run(main())
