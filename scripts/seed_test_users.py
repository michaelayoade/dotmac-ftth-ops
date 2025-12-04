#!/usr/bin/env python3
"""
Seed Test Users for E2E Testing

Creates different types of users with various access levels for testing:
- Platform Admin
- Tenant Admin
- ISP Manager
- Customer Support
- Regular User
- Read-only User
"""

import asyncio
import sys
import uuid
from datetime import UTC, datetime
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root / "src"))

from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.db import AsyncSessionLocal, Base
from dotmac.platform.tenant.models import Tenant, TenantStatus, TenantPlanType
from dotmac.platform.user_management.models import User

# Import all models to ensure relationships are registered
try:
    from dotmac.platform.radius.models import RadCheck, NAS  # noqa: F401
    from dotmac.platform.subscribers.models import Subscriber  # noqa: F401
    from dotmac.platform.customer_management.models import Customer  # noqa: F401
    from dotmac.platform.crm.models import Lead, Opportunity, Contact  # noqa: F401
except ImportError:
    pass  # Some models may not be available

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    """Hash a password for storing."""
    return pwd_context.hash(password)


async def create_test_tenant(db: AsyncSession) -> str:
    """Create a test tenant organization."""
    # Check if tenant already exists
    result = await db.execute(select(Tenant).where(Tenant.slug == "test-org"))
    existing_tenant = result.scalar_one_or_none()

    if existing_tenant:
        print(f"✓ Test tenant already exists: {existing_tenant.name} (ID: {existing_tenant.id})")
        return existing_tenant.id

    # Create new tenant
    tenant = Tenant(
        id=str(uuid.uuid4()),
        name="Test Organization",
        slug="test-org",
        domain="test-org.example.com",
        status=TenantStatus.ACTIVE,
        plan_type=TenantPlanType.ENTERPRISE,
        email="admin@test-org.example.com",
        phone="+1234567890",
        billing_cycle="monthly",  # Default billing cycle
        timezone="UTC",  # Default timezone
    )

    db.add(tenant)
    await db.commit()
    await db.refresh(tenant)

    print(f"✓ Created test tenant: {tenant.name} (ID: {tenant.id})")
    return tenant.id


async def create_user(
    db: AsyncSession,
    username: str,
    email: str,
    password: str,
    full_name: str,
    tenant_id: str,
    roles: list[str] = None,
    is_superuser: bool = False,
    is_platform_admin: bool = False,
) -> User:
    """Create a user with specified properties."""
    # Check if user already exists
    result = await db.execute(
        select(User).where(User.tenant_id == tenant_id, User.username == username)
    )
    existing_user = result.scalar_one_or_none()

    if existing_user:
        print(f"  ⚠ User already exists: {username} ({email})")
        return existing_user

    user = User(
        id=uuid.uuid4(),
        username=username,
        email=email,
        password_hash=hash_password(password),
        full_name=full_name,
        first_name=full_name.split()[0] if full_name else username,
        last_name=full_name.split()[-1] if len(full_name.split()) > 1 else "",
        tenant_id=tenant_id,
        roles=roles or [],
        permissions=[],
        is_active=True,
        is_verified=True,
        is_superuser=is_superuser,
        is_platform_admin=is_platform_admin,
        mfa_enabled=False,
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )

    db.add(user)
    await db.commit()
    await db.refresh(user)

    print(f"  ✓ Created user: {username} ({email}) - Roles: {roles or []}")
    return user


async def seed_test_users():
    """Seed database with test users for different access levels."""
    print("\n" + "=" * 70)
    print("SEEDING TEST USERS FOR E2E TESTING")
    print("=" * 70 + "\n")

    # Get database session
    async with AsyncSessionLocal() as db:
        # Create test tenant
        tenant_id = await create_test_tenant(db)

        print("\nCreating test users...")
        print("-" * 70)

        # 1. Platform Admin (super user with all access)
        await create_user(
            db=db,
            username="admin",
            email="admin@example.com",
            password="admin123",
            full_name="Platform Administrator",
            tenant_id=tenant_id,
            roles=["platform_admin", "admin"],
            is_superuser=True,
            is_platform_admin=True,
        )

        # 2. Tenant Admin (organization administrator)
        await create_user(
            db=db,
            username="tenant_admin",
            email="tenant.admin@example.com",
            password="admin123",
            full_name="Tenant Administrator",
            tenant_id=tenant_id,
            roles=["tenant_admin", "admin"],
            is_superuser=False,
            is_platform_admin=False,
        )

        # 3. ISP Manager (manages ISP operations)
        await create_user(
            db=db,
            username="isp_manager",
            email="isp.manager@example.com",
            password="admin123",
            full_name="ISP Manager",
            tenant_id=tenant_id,
            roles=["isp_manager", "manager"],
            is_superuser=False,
            is_platform_admin=False,
        )

        # 4. Customer Support (can view and assist customers)
        await create_user(
            db=db,
            username="support",
            email="support@example.com",
            password="admin123",
            full_name="Customer Support Agent",
            tenant_id=tenant_id,
            roles=["customer_support", "support"],
            is_superuser=False,
            is_platform_admin=False,
        )

        # 5. Billing Manager (manages billing and invoices)
        await create_user(
            db=db,
            username="billing",
            email="billing@example.com",
            password="admin123",
            full_name="Billing Manager",
            tenant_id=tenant_id,
            roles=["billing_manager", "finance"],
            is_superuser=False,
            is_platform_admin=False,
        )

        # 6. Network Engineer (manages network and infrastructure)
        await create_user(
            db=db,
            username="network_eng",
            email="network@example.com",
            password="admin123",
            full_name="Network Engineer",
            tenant_id=tenant_id,
            roles=["network_engineer", "engineer"],
            is_superuser=False,
            is_platform_admin=False,
        )

        # 7. Regular User (standard user access)
        await create_user(
            db=db,
            username="user",
            email="user@example.com",
            password="user123",
            full_name="Regular User",
            tenant_id=tenant_id,
            roles=["user"],
            is_superuser=False,
            is_platform_admin=False,
        )

        # 8. Read-only User (view-only access)
        await create_user(
            db=db,
            username="readonly",
            email="readonly@example.com",
            password="readonly123",
            full_name="Read Only User",
            tenant_id=tenant_id,
            roles=["readonly", "viewer"],
            is_superuser=False,
            is_platform_admin=False,
        )

        # 9. Test User (for general testing)
        await create_user(
            db=db,
            username="testuser",
            email="test@example.com",
            password="test123",
            full_name="Test User",
            tenant_id=tenant_id,
            roles=["user", "tester"],
            is_superuser=False,
            is_platform_admin=False,
        )

    print("\n" + "=" * 70)
    print("TEST USERS SEEDED SUCCESSFULLY!")
    print("=" * 70)

    print("\n📋 Test Credentials:")
    print("-" * 70)
    print("Platform Admin:      admin           / admin123")
    print("Tenant Admin:        tenant_admin    / admin123")
    print("ISP Manager:         isp_manager     / admin123")
    print("Customer Support:    support         / admin123")
    print("Billing Manager:     billing         / admin123")
    print("Network Engineer:    network_eng     / admin123")
    print("Regular User:        user            / user123")
    print("Read-only User:      readonly        / readonly123")
    print("Test User:           testuser        / test123")
    print("-" * 70)

    print("\n✨ You can now run Playwright tests with these credentials!")
    print("\n")


if __name__ == "__main__":
    asyncio.run(seed_test_users())
