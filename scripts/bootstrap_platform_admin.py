#!/usr/bin/env python3
"""
Bootstrap script to create default platform administrator on first startup.

This script creates:
1. Default platform admin user (if not exists)
2. Essential RBAC roles (admin, user, guest)
3. Essential permissions

Run this script:
- On first deployment
- After database migrations
- As part of Docker/K8s initialization

Usage:
    python scripts/bootstrap_platform_admin.py

Environment Variables:
    PLATFORM_ADMIN_EMAIL: Email for platform admin (default: admin@platform.local)
    PLATFORM_ADMIN_PASSWORD: Password for platform admin (default: random secure password)
    DEFAULT_USER_ROLE: Role for new registrations (default: admin for first user, user thereafter)
"""

import asyncio
import os
import secrets
import sys
from datetime import UTC, datetime
from pathlib import Path
from uuid import uuid4

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.auth.core import hash_password
from dotmac.platform.auth.models import Permission, PermissionCategory, Role
from dotmac.platform.db import AsyncSessionLocal
from dotmac.platform.settings import settings
from dotmac.platform.user_management.models import User


def generate_secure_password() -> str:
    """Generate a secure random password."""
    # 32 characters: uppercase, lowercase, digits, symbols
    return secrets.token_urlsafe(24)


async def create_default_permissions(db: AsyncSession) -> dict[str, Permission]:
    """Create essential permissions if they don't exist."""
    print("📋 Creating default permissions...")

    permissions_to_create = [
        # User management
        ("user.read", "Read User", "View user information", PermissionCategory.USER),
        ("user.write", "Write User", "Create/update users", PermissionCategory.USER),
        ("user.delete", "Delete User", "Delete users", PermissionCategory.USER),
        # Customer management
        ("customer.read", "Read Customer", "View customers", PermissionCategory.CUSTOMER),
        (
            "customer.write",
            "Write Customer",
            "Create/update customers",
            PermissionCategory.CUSTOMER,
        ),
        ("customer.delete", "Delete Customer", "Delete customers", PermissionCategory.CUSTOMER),
        # Billing
        ("billing.read", "Read Billing", "View billing data", PermissionCategory.BILLING),
        ("billing.write", "Write Billing", "Manage billing", PermissionCategory.BILLING),
        # Admin operations
        (
            "admin.role.manage",
            "Manage Roles",
            "Create/update/delete roles",
            PermissionCategory.ADMIN,
        ),
        (
            "admin.permission.manage",
            "Manage Permissions",
            "Grant/revoke permissions",
            PermissionCategory.ADMIN,
        ),
        (
            "admin.tenant.manage",
            "Manage Tenants",
            "Manage tenant settings",
            PermissionCategory.ADMIN,
        ),
        (
            "admin.system.config",
            "System Configuration",
            "Configure system settings",
            PermissionCategory.ADMIN,
        ),
        # Platform admin permissions
        (
            "platform.admin",
            "Platform Admin",
            "Full platform administration",
            PermissionCategory.ADMIN,
        ),
        ("platform.tenants.read", "Read All Tenants", "View all tenants", PermissionCategory.ADMIN),
        (
            "platform.tenants.write",
            "Write All Tenants",
            "Manage all tenants",
            PermissionCategory.ADMIN,
        ),
        ("platform.impersonate", "Impersonate", "Impersonate tenants", PermissionCategory.SECURITY),
        # Analytics
        ("analytics.read", "Read Analytics", "View analytics", PermissionCategory.ANALYTICS),
    ]

    permissions: dict[str, Permission] = {}

    for perm_name, display_name, description, category in permissions_to_create:
        # Check if permission exists
        result = await db.execute(select(Permission).where(Permission.name == perm_name))
        existing_perm = result.scalar_one_or_none()

        if existing_perm:
            permissions[perm_name] = existing_perm
            print(f"  ✓ Permission '{perm_name}' already exists")
        else:
            new_perm = Permission(
                id=uuid4(),
                name=perm_name,
                display_name=display_name,
                description=description,
                category=category,
                is_active=True,
                is_system=True,  # System permissions cannot be deleted
            )
            db.add(new_perm)
            permissions[perm_name] = new_perm
            print(f"  ✓ Created permission '{perm_name}'")

    await db.commit()
    return permissions


async def create_default_roles(
    db: AsyncSession, permissions: dict[str, Permission]
) -> dict[str, Role]:
    """Create essential roles if they don't exist."""
    print("\n👥 Creating default roles...")

    roles: dict[str, Role] = {}

    # Admin role - full tenant management
    admin_result = await db.execute(select(Role).where(Role.name == "admin"))
    admin_role = admin_result.scalar_one_or_none()

    if not admin_role:
        admin_role = Role(
            id=uuid4(),
            name="admin",
            display_name="Administrator",
            description="Full administrative access within tenant",
            priority=100,
            is_active=True,
            is_system=True,
            is_default=False,  # NOT default - must be explicitly assigned
        )
        # Add all non-platform permissions
        admin_perms = [
            permissions[p]
            for p in [
                "user.read",
                "user.write",
                "user.delete",
                "customer.read",
                "customer.write",
                "customer.delete",
                "billing.read",
                "billing.write",
                "admin.role.manage",
                "admin.permission.manage",
                "admin.tenant.manage",
                "admin.system.config",
                "analytics.read",
            ]
            if p in permissions
        ]
        admin_role.permissions.extend(admin_perms)
        db.add(admin_role)
        print("  ✓ Created role 'admin' with full tenant permissions")
    else:
        print("  ✓ Role 'admin' already exists")

    roles["admin"] = admin_role

    # User role - standard user permissions
    user_result = await db.execute(select(Role).where(Role.name == "user"))
    user_role = user_result.scalar_one_or_none()

    if not user_role:
        user_role = Role(
            id=uuid4(),
            name="user",
            display_name="Standard User",
            description="Standard user access",
            priority=50,
            is_active=True,
            is_system=True,
            is_default=True,  # Default role for new registrations
        )
        # Add basic permissions
        user_perms = [
            permissions[p]
            for p in ["user.read", "customer.read", "billing.read"]
            if p in permissions
        ]
        user_role.permissions.extend(user_perms)
        db.add(user_role)
        print("  ✓ Created role 'user' (default for new registrations)")
    else:
        print("  ✓ Role 'user' already exists")

    roles["user"] = user_role

    # Guest role - minimal permissions
    guest_result = await db.execute(select(Role).where(Role.name == "guest"))
    guest_role = guest_result.scalar_one_or_none()

    if not guest_role:
        guest_role = Role(
            id=uuid4(),
            name="guest",
            display_name="Guest",
            description="Minimal read-only access",
            priority=10,
            is_active=True,
            is_system=True,
            is_default=False,
        )
        # No permissions for guest by default
        db.add(guest_role)
        print("  ✓ Created role 'guest' (read-only)")
    else:
        print("  ✓ Role 'guest' already exists")

    roles["guest"] = guest_role

    await db.commit()
    return roles


async def create_platform_admin(db: AsyncSession, roles: dict[str, Role]) -> User:
    """Create default platform administrator if not exists."""
    print("\n🔐 Creating platform administrator...")

    # Get credentials from environment or generate
    admin_email = os.getenv("PLATFORM_ADMIN_EMAIL", "admin@platform.local")
    admin_password = os.getenv("PLATFORM_ADMIN_PASSWORD")

    password_generated = False
    if not admin_password:
        admin_password = generate_secure_password()
        password_generated = True

    # Check if platform admin already exists
    result = await db.execute(select(User).where(User.email == admin_email))
    existing_admin = result.scalar_one_or_none()

    if existing_admin:
        print(f"  ✓ Platform admin already exists: {admin_email}")
        return existing_admin

    # Create "platform_admin" role if it doesn't exist
    platform_admin_role_result = await db.execute(select(Role).where(Role.name == "platform_admin"))
    platform_admin_role = platform_admin_role_result.scalar_one_or_none()

    if not platform_admin_role:
        # Create platform_admin role with ALL permissions
        all_permissions_result = await db.execute(select(Permission))
        all_permissions = all_permissions_result.scalars().all()

        platform_admin_role = Role(
            id=uuid4(),
            name="platform_admin",
            display_name="Platform Administrator",
            description="Full platform administration access (cross-tenant)",
            priority=1000,  # Highest priority
            is_active=True,
            is_system=True,
            is_default=False,
        )
        # Assign ALL permissions to platform admin role
        platform_admin_role.permissions.extend(all_permissions)
        db.add(platform_admin_role)
        await db.commit()
        print("  ✓ Created 'platform_admin' role with all permissions")

    # Create platform admin USER
    platform_admin = User(
        id=uuid4(),
        username="platformadmin",
        email=admin_email,
        password_hash=hash_password(admin_password),
        full_name="Platform Administrator",
        is_active=True,
        is_verified=True,
        is_superuser=True,
        is_platform_admin=True,  # KEY: Platform admin flag
        tenant_id=None,  # Platform admins not bound to any tenant
        roles=[],  # RBAC manages roles via user_roles table
        permissions=[],  # RBAC manages permissions
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )

    db.add(platform_admin)
    await db.flush()  # Flush to get ID before adding to user_roles

    # Assign platform_admin role via user_roles table (RBAC)
    from sqlalchemy import insert

    from dotmac.platform.auth.models import user_roles

    await db.execute(
        insert(user_roles).values(
            user_id=platform_admin.id,
            role_id=platform_admin_role.id,
            granted_at=datetime.now(UTC),
            granted_by=platform_admin.id,  # Self-granted during bootstrap
        )
    )

    await db.commit()

    print(f"\n{'=' * 60}")
    print("✅ Platform Administrator Created Successfully!")
    print(f"{'=' * 60}")
    print(f"Email:    {admin_email}")
    print("Username: platformadmin")

    if password_generated:
        print(f"Password: {admin_password}")
        print("\n⚠️  IMPORTANT: Save this password securely!")
        print("⚠️  This is the only time it will be displayed.")
        print("⚠️  Set PLATFORM_ADMIN_PASSWORD env var to use a custom password.")
    else:
        print("Password: <from PLATFORM_ADMIN_PASSWORD env var>")

    print(f"{'=' * 60}\n")

    return platform_admin


async def update_default_user_role_config() -> None:
    """Update settings to use 'admin' as default role for first registrations."""
    from dotmac.platform.auth.core import DEFAULT_USER_ROLE

    print("\n⚙️  Configuration:")
    print("  - First registered user gets 'admin' role automatically")
    print(f"  - Subsequent users get '{DEFAULT_USER_ROLE}' role (configurable)")
    print("  - Platform admin can change roles via API")


async def bootstrap_platform() -> None:
    """Main bootstrap function."""
    print(f"\n{'=' * 60}")
    print("🚀 DotMac Platform Bootstrap")
    print(f"{'=' * 60}\n")
    print(f"Environment: {settings.environment}")
    print(f"{'=' * 60}\n")

    async with AsyncSessionLocal() as db:
        try:
            # Step 1: Create permissions
            permissions = await create_default_permissions(db)

            # Step 2: Create roles
            roles = await create_default_roles(db, permissions)

            # Step 3: Create platform admin
            platform_admin = await create_platform_admin(db, roles)

            # Step 4: Update config
            await update_default_user_role_config()

            print(f"\n{'=' * 60}")
            print("✅ Bootstrap Complete!")
            print(f"{'=' * 60}\n")
            print("Next steps:")
            print("1. Start the backend: make dev-backend")
            print("2. Login with platform admin credentials")
            print("3. Create tenants and invite users")
            print("4. Users who register get 'admin' role for their tenant")
            print(f"{'=' * 60}\n")

        except Exception as e:
            print(f"\n❌ Bootstrap failed: {e}")
            import traceback

            traceback.print_exc()
            await db.rollback()
            raise


if __name__ == "__main__":
    asyncio.run(bootstrap_platform())
