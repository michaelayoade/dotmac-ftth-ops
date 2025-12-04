#!/usr/bin/env python3
"""
Create Test Users for E2E Testing

Creates test user accounts for automated testing
"""

import asyncio
import sys
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root / "src"))

from sqlalchemy import select
from src.dotmac.platform.auth.models import User, TenantMembership
from src.dotmac.platform.tenant.models import Tenant
from src.dotmac.platform.database import get_session
from src.dotmac.platform.auth.core import get_password_hash


async def create_test_users():
    """Create test users for E2E testing"""

    print("🔧 Creating test users for E2E testing...")
    print()

    async with get_session() as session:
        # Test user credentials
        test_users = [
            {
                "email": "test@example.com",
                "password": "TestPass123!",
                "full_name": "Test User",
                "tenant_name": "Test ISP",
                "role": "admin"
            },
            {
                "email": "operator@test.com",
                "password": "OperatorPass123!",
                "full_name": "Test Operator",
                "tenant_name": "Test ISP",
                "role": "operator"
            },
            {
                "email": "customer@test.com",
                "password": "CustomerPass123!",
                "full_name": "Test Customer",
                "tenant_name": "Test ISP",
                "role": "customer"
            }
        ]

        for user_data in test_users:
            # Check if user already exists
            result = await session.execute(
                select(User).where(User.email == user_data["email"])
            )
            existing_user = result.scalar_one_or_none()

            if existing_user:
                print(f"✓ User {user_data['email']} already exists")
                continue

            # Check if tenant exists
            result = await session.execute(
                select(Tenant).where(Tenant.name == user_data["tenant_name"])
            )
            tenant = result.scalar_one_or_none()

            if not tenant:
                # Create tenant
                tenant = Tenant(
                    name=user_data["tenant_name"],
                    slug=user_data["tenant_name"].lower().replace(" ", "-"),
                    tenant_type="isp",
                    is_active=True
                )
                session.add(tenant)
                await session.flush()
                print(f"✓ Created tenant: {tenant.name}")

            # Create user
            user = User(
                email=user_data["email"],
                hashed_password=get_password_hash(user_data["password"]),
                full_name=user_data["full_name"],
                is_active=True,
                is_verified=True
            )
            session.add(user)
            await session.flush()

            # Create tenant membership
            membership = TenantMembership(
                user_id=user.id,
                tenant_id=tenant.id,
                role=user_data["role"]
            )
            session.add(membership)

            await session.commit()

            print(f"✓ Created user: {user_data['email']} (password: {user_data['password']})")

        print()
        print("✅ Test users created successfully!")
        print()
        print("Test Credentials:")
        print("─────────────────────────────────────────")
        print("Admin:    test@example.com / TestPass123!")
        print("Operator: operator@test.com / OperatorPass123!")
        print("Customer: customer@test.com / CustomerPass123!")
        print()
        print("Set environment variables for E2E tests:")
        print('export TEST_USER_EMAIL="test@example.com"')
        print('export TEST_USER_PASSWORD="TestPass123!"')
        print()


if __name__ == "__main__":
    try:
        asyncio.run(create_test_users())
    except Exception as e:
        print(f"❌ Error creating test users: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
