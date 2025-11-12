#!/usr/bin/env python3
"""
Migrate existing users from legacy auth system to Better Auth.

This script:
1. Queries all existing users from the 'users' table
2. Creates corresponding Better Auth user records
3. Sets up organization memberships based on tenant associations
4. Assigns roles based on existing RBAC permissions
5. Handles password migration (users will need to reset passwords)

Usage:
    poetry run python3 scripts/migrate_users_to_better_auth.py [--dry-run] [--limit N]

Options:
    --dry-run    Show what would be migrated without making changes
    --limit N    Only migrate first N users (for testing)
    --force      Skip confirmation prompt
"""

import asyncio
import argparse
from datetime import datetime, UTC
from uuid import uuid4
import bcrypt
from sqlalchemy import create_engine, text, select
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
import os
import sys

# Add src to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from dotmac.platform.auth.models import User


class UserMigrationService:
    """Service for migrating users to Better Auth."""

    def __init__(self, db: AsyncSession, dry_run: bool = False):
        """Initialize migration service.

        Args:
            db: Database session
            dry_run: If True, don't make any changes
        """
        self.db = db
        self.dry_run = dry_run
        self.stats = {
            "total_users": 0,
            "migrated": 0,
            "skipped": 0,
            "errors": 0,
            "orgs_created": 0,
        }

    async def migrate_all_users(self, limit: int | None = None):
        """Migrate all users from legacy system to Better Auth.

        Args:
            limit: Optional limit on number of users to migrate
        """
        print("=" * 80)
        print("BETTER AUTH USER MIGRATION")
        print("=" * 80)
        print()

        if self.dry_run:
            print("🔍 DRY RUN MODE - No changes will be made")
            print()

        # Get all users from legacy system
        query = select(User)
        if limit:
            query = query.limit(limit)

        result = await self.db.execute(query)
        users = result.scalars().all()

        self.stats["total_users"] = len(users)

        print(f"Found {len(users)} users to migrate")
        print()

        # Group users by tenant for organization creation
        tenant_users = {}
        for user in users:
            # Determine tenant ID from user's metadata or relationships
            tenant_id = await self._get_user_tenant_id(user)
            if tenant_id:
                if tenant_id not in tenant_users:
                    tenant_users[tenant_id] = []
                tenant_users[tenant_id].append(user)

        # Migrate tenant by tenant
        for tenant_id, tenant_user_list in tenant_users.items():
            await self._migrate_tenant_users(tenant_id, tenant_user_list)

        # Migrate users without tenant (platform admins)
        users_without_tenant = [u for u in users if await self._get_user_tenant_id(u) is None]
        if users_without_tenant:
            await self._migrate_platform_users(users_without_tenant)

        # Print summary
        print()
        print("=" * 80)
        print("MIGRATION SUMMARY")
        print("=" * 80)
        print(f"Total users found:      {self.stats['total_users']}")
        print(f"Successfully migrated:  {self.stats['migrated']}")
        print(f"Skipped (existing):     {self.stats['skipped']}")
        print(f"Errors:                 {self.stats['errors']}")
        print(f"Organizations created:  {self.stats['orgs_created']}")
        print()

        if not self.dry_run:
            print("✅ Migration completed successfully!")
        else:
            print("ℹ️  Dry run completed. Run without --dry-run to apply changes.")

    async def _get_user_tenant_id(self, user: User) -> str | None:
        """Get tenant ID for a user.

        Args:
            user: User model

        Returns:
            Tenant ID string or None
        """
        # Check if user has tenant_id field
        if hasattr(user, 'tenant_id') and user.tenant_id:
            return str(user.tenant_id)

        # Query user-role assignments to find tenant
        query = text("""
            SELECT tenant_id
            FROM user_roles
            WHERE user_id = :user_id
            AND tenant_id IS NOT NULL
            LIMIT 1
        """)

        result = await self.db.execute(query, {"user_id": str(user.id)})
        row = result.fetchone()

        return str(row[0]) if row else None

    async def _migrate_tenant_users(self, tenant_id: str, users: list[User]):
        """Migrate users for a specific tenant.

        Args:
            tenant_id: Tenant/Organization ID
            users: List of users in this tenant
        """
        print(f"Migrating tenant: {tenant_id} ({len(users)} users)")

        # Get or create organization
        org_id, org_name = await self._get_or_create_organization(tenant_id)

        if not org_id:
            print(f"  ❌ Failed to create organization for tenant {tenant_id}")
            return

        # Migrate each user
        for user in users:
            await self._migrate_user(user, org_id, org_name)

    async def _migrate_platform_users(self, users: list[User]):
        """Migrate platform admin users (no tenant).

        Args:
            users: List of platform admin users
        """
        print(f"Migrating platform admins ({len(users)} users)")

        # Create default platform organization if needed
        org_id, org_name = await self._get_or_create_organization(
            "platform",
            org_name="Platform Administration"
        )

        for user in users:
            await self._migrate_user(user, org_id, org_name, is_platform_admin=True)

    async def _get_or_create_organization(
        self,
        tenant_id: str,
        org_name: str | None = None
    ) -> tuple[str | None, str | None]:
        """Get or create a Better Auth organization.

        Args:
            tenant_id: Tenant ID
            org_name: Optional organization name

        Returns:
            Tuple of (org_id, org_name) or (None, None) on error
        """
        # Check if organization already exists
        query = text("""
            SELECT id, name
            FROM "organization"
            WHERE slug = :slug
            LIMIT 1
        """)

        slug = f"tenant-{tenant_id}"
        result = await self.db.execute(query, {"slug": slug})
        existing = result.fetchone()

        if existing:
            return str(existing[0]), str(existing[1])

        # Create new organization
        if not org_name:
            # Try to get tenant name from tenants table
            tenant_query = text("""
                SELECT name
                FROM tenants
                WHERE id = :tenant_id
                LIMIT 1
            """)

            result = await self.db.execute(tenant_query, {"tenant_id": tenant_id})
            tenant_row = result.fetchone()
            org_name = tenant_row[0] if tenant_row else f"Organization {tenant_id[:8]}"

        org_id = str(uuid4())

        if self.dry_run:
            print(f"  [DRY RUN] Would create organization: {org_name} (slug: {slug})")
            return org_id, org_name

        try:
            insert_query = text("""
                INSERT INTO "organization" (id, name, slug, created_at, updated_at)
                VALUES (:id, :name, :slug, :created_at, :updated_at)
            """)

            await self.db.execute(insert_query, {
                "id": org_id,
                "name": org_name,
                "slug": slug,
                "created_at": datetime.now(UTC),
                "updated_at": datetime.now(UTC),
            })

            await self.db.commit()

            self.stats["orgs_created"] += 1
            print(f"  ✅ Created organization: {org_name}")

            return org_id, org_name

        except Exception as e:
            print(f"  ❌ Error creating organization: {e}")
            await self.db.rollback()
            return None, None

    async def _migrate_user(
        self,
        user: User,
        org_id: str,
        org_name: str,
        is_platform_admin: bool = False
    ):
        """Migrate a single user to Better Auth.

        Args:
            user: User model to migrate
            org_id: Organization ID to assign user to
            org_name: Organization name
            is_platform_admin: Whether user is platform admin
        """
        print(f"  Migrating user: {user.email}")

        # Check if user already exists in Better Auth
        check_query = text("""
            SELECT id
            FROM "user"
            WHERE id = :user_id OR email = :email
            LIMIT 1
        """)

        result = await self.db.execute(check_query, {
            "user_id": str(user.id),
            "email": user.email
        })

        if result.fetchone():
            print(f"    ⏭️  User already exists in Better Auth, skipping")
            self.stats["skipped"] += 1
            return

        if self.dry_run:
            print(f"    [DRY RUN] Would migrate user to organization: {org_name}")
            self.stats["migrated"] += 1
            return

        try:
            # Create user in Better Auth
            insert_user = text("""
                INSERT INTO "user" (id, email, name, email_verified, created_at, updated_at)
                VALUES (:id, :email, :name, :email_verified, :created_at, :updated_at)
            """)

            await self.db.execute(insert_user, {
                "id": str(user.id),
                "email": user.email,
                "name": user.full_name or user.username,
                "email_verified": user.is_verified if hasattr(user, 'is_verified') else user.is_active,
                "created_at": user.created_at or datetime.now(UTC),
                "updated_at": datetime.now(UTC),
            })

            # Determine user role
            role = await self._get_user_role(user, is_platform_admin)

            # Create organization membership
            insert_member = text("""
                INSERT INTO "organization_member" (id, organization_id, user_id, role, created_at, updated_at)
                VALUES (:id, :org_id, :user_id, :role, :created_at, :updated_at)
            """)

            await self.db.execute(insert_member, {
                "id": str(uuid4()),
                "org_id": org_id,
                "user_id": str(user.id),
                "role": role,
                "created_at": datetime.now(UTC),
                "updated_at": datetime.now(UTC),
            })

            # NOTE: Users will need to reset their passwords via "Forgot Password"
            # Better Auth uses a different password hashing algorithm than our legacy system

            await self.db.commit()

            print(f"    ✅ Migrated as {role} in {org_name}")
            self.stats["migrated"] += 1

        except Exception as e:
            print(f"    ❌ Error migrating user: {e}")
            await self.db.rollback()
            self.stats["errors"] += 1

    async def _get_user_role(self, user: User, is_platform_admin: bool = False) -> str:
        """Determine Better Auth role for a user.

        Args:
            user: User model
            is_platform_admin: Whether user is platform admin

        Returns:
            Role string (e.g., 'super_admin', 'tenant_admin', etc.)
        """
        if is_platform_admin:
            return "super_admin"

        # Query user's roles from RBAC system
        query = text("""
            SELECT r.name
            FROM roles r
            JOIN user_roles ur ON r.id = ur.role_id
            WHERE ur.user_id = :user_id
            ORDER BY r.name
            LIMIT 1
        """)

        result = await self.db.execute(query, {"user_id": str(user.id)})
        row = result.fetchone()

        if not row:
            return "tenant_member"  # Default role

        role_name = row[0].lower()

        # Map legacy roles to Better Auth roles
        role_mapping = {
            "admin": "tenant_admin",
            "owner": "tenant_owner",
            "manager": "tenant_admin",
            "network_admin": "network_admin",
            "support": "support_agent",
            "technician": "technician",
            "customer": "customer",
            "user": "tenant_member",
        }

        return role_mapping.get(role_name, "tenant_member")


async def main():
    """Main migration function."""
    parser = argparse.ArgumentParser(description="Migrate users to Better Auth")
    parser.add_argument("--dry-run", action="store_true", help="Show changes without applying")
    parser.add_argument("--limit", type=int, help="Limit number of users to migrate")
    parser.add_argument("--force", action="store_true", help="Skip confirmation prompt")

    args = parser.parse_args()

    # Database setup
    db_url = os.getenv("DATABASE_URL", "postgresql://dotmac:dotmac@localhost:5433/dotmac_platform")
    async_db_url = db_url.replace("postgresql://", "postgresql+asyncpg://")

    engine = create_async_engine(async_db_url)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        # Show warning
        if not args.dry_run and not args.force:
            print()
            print("⚠️  WARNING: This will migrate users to Better Auth!")
            print()
            print("   - Existing users will be created in Better Auth")
            print("   - Organizations will be created based on tenants")
            print("   - Users will need to reset passwords (password migration not supported)")
            print()
            response = input("Continue? (yes/no): ")

            if response.lower() != "yes":
                print("Migration cancelled.")
                return

        # Run migration
        service = UserMigrationService(session, dry_run=args.dry_run)
        await service.migrate_all_users(limit=args.limit)

        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
