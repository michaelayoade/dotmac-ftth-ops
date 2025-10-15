#!/usr/bin/env python
"""
Create Admin User Script
Creates an admin user with proper roles and permissions for testing
"""

import sys
from datetime import UTC, datetime
from pathlib import Path
from uuid import uuid4

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent))

from sqlalchemy import text

from dotmac.platform.db import get_sync_engine


def create_admin_user():
    """Create admin user using raw SQL"""
    engine = get_sync_engine()

    # User data
    user_id = str(uuid4())
    email = "admin@example.com"
    username = "admin"
    password_hash = "$2b$12$LQv3c1yqBw4iXPcZqhQ0.ehmpXLhUO5XvG8TL8OxqL3qV7xQ9sRxm"  # admin123

    with engine.begin() as conn:
        # Check if user already exists
        result = conn.execute(text("SELECT id FROM users WHERE email = :email"), {"email": email})

        existing_user = result.fetchone()
        if existing_user:
            user_id = existing_user[0]
            print(f"User {email} already exists with ID: {user_id}")
        else:
            # Create user
            conn.execute(
                text(
                    """
                INSERT INTO users (
                    id, username, email, password_hash, full_name,
                    is_active, is_verified, created_at, updated_at
                )
                VALUES (
                    :id, :username, :email, :password_hash, :full_name,
                    :is_active, :is_verified, :created_at, :updated_at
                )
            """
                ),
                {
                    "id": user_id,
                    "username": username,
                    "email": email,
                    "password_hash": password_hash,
                    "full_name": "System Administrator",
                    "is_active": True,
                    "is_verified": True,
                    "created_at": datetime.now(UTC),
                    "updated_at": datetime.now(UTC),
                },
            )
            print(f"✓ Created user: {email}")

        # Get admin role
        result = conn.execute(text("SELECT id FROM roles WHERE name = 'admin'"))
        admin_role = result.fetchone()

        if not admin_role:
            print("❌ Admin role not found. Please run RBAC seed script first.")
            return

        admin_role_id = admin_role[0]

        # Check if user already has admin role
        result = conn.execute(
            text("SELECT 1 FROM user_roles WHERE user_id = :user_id AND role_id = :role_id"),
            {"user_id": user_id, "role_id": admin_role_id},
        )

        if result.fetchone():
            print(f"User {email} already has admin role")
        else:
            # Assign admin role
            conn.execute(
                text(
                    """
                INSERT INTO user_roles (user_id, role_id, granted_at, granted_by)
                VALUES (:user_id, :role_id, :granted_at, :granted_by)
            """
                ),
                {
                    "user_id": user_id,
                    "role_id": admin_role_id,
                    "granted_at": datetime.now(UTC),
                    "granted_by": user_id,  # Self-granted for bootstrap
                },
            )
            print(f"✓ Assigned admin role to: {email}")

        # Also assign superuser role for full access
        result = conn.execute(text("SELECT id FROM roles WHERE name = 'superuser'"))
        superuser_role = result.fetchone()

        if superuser_role:
            superuser_role_id = superuser_role[0]

            # Check if user already has superuser role
            result = conn.execute(
                text("SELECT 1 FROM user_roles WHERE user_id = :user_id AND role_id = :role_id"),
                {"user_id": user_id, "role_id": superuser_role_id},
            )

            if not result.fetchone():
                conn.execute(
                    text(
                        """
                    INSERT INTO user_roles (user_id, role_id, granted_at, granted_by)
                    VALUES (:user_id, :role_id, :granted_at, :granted_by)
                """
                    ),
                    {
                        "user_id": user_id,
                        "role_id": superuser_role_id,
                        "granted_at": datetime.now(UTC),
                        "granted_by": user_id,
                    },
                )
                print(f"✓ Assigned superuser role to: {email}")

        print("\n✅ Admin user ready!")
        print(f"Email: {email}")
        print("Password: admin123")
        print("Roles: admin, superuser")


def main():
    """Main entry point"""
    try:
        print("=" * 60)
        print("Creating Admin User")
        print("=" * 60 + "\n")

        print("Connecting to database...")
        engine = get_sync_engine()

        # Test connection
        with engine.connect() as conn:
            print("Database connection successful!")

        create_admin_user()

        print("\n" + "=" * 60)
        print("✅ Admin user creation completed!")
        print("=" * 60)

    except Exception as e:
        print(f"\nError creating admin user: {e}")
        print("\nPlease ensure:")
        print("1. The database server is running")
        print("2. Database migrations have been run")
        print("3. RBAC seed script has been run")
        import traceback

        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
