#!/usr/bin/env python3
"""Initialize database with tables and test data."""

import os
from uuid import uuid4

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

# Import all models to ensure they're registered
from dotmac.platform.auth.models import Permission, PermissionCategory, Role
from dotmac.platform.db import Base
from dotmac.platform.user_management.models import User

try:
    from dotmac.platform.audit.models import AuditActivity
except ImportError:
    pass

# Import hashing function
from dotmac.platform.auth.core import hash_password


def create_tables():
    """Create all database tables."""
    # Get database URL from environment or settings
    database_url = os.getenv(
        "DATABASE_URL", "postgresql://dotmac_user:change-me-in-production@localhost:5432/dotmac"
    )
    engine = create_engine(database_url)

    # Create all tables
    Base.metadata.create_all(bind=engine)
    print("✅ All tables created successfully!")

    return engine


def seed_test_data(engine):
    """Seed database with test data."""
    with Session(engine) as session:
        # Check if data already exists
        existing_users = session.query(User).count()
        if existing_users > 0:
            print("⚠️  Data already exists, skipping seed")
            return

        # Create test users
        users = [
            User(
                id=uuid4(),
                username="admin",
                email="admin@example.com",
                is_verified=True,
                password_hash=hash_password("admin123"),
                is_active=True,
                is_superuser=True,
            ),
            User(
                id=uuid4(),
                username="test",
                email="test@example.com",
                is_verified=True,
                password_hash=hash_password("password123"),
                is_active=True,
                is_superuser=False,
            ),
        ]

        for user in users:
            session.add(user)

        # Create default roles
        roles = [
            Role(
                id=uuid4(),
                name="admin",
                display_name="Administrator",
                description="Full system access",
                is_system=True,
                is_active=True,
                priority=100,
            ),
            Role(
                id=uuid4(),
                name="user",
                display_name="User",
                description="Standard user access",
                is_system=True,
                is_active=True,
                is_default=True,
                priority=10,
            ),
        ]

        for role in roles:
            session.add(role)

        # Create basic permissions
        permissions = [
            Permission(
                id=uuid4(),
                name="admin.access",
                display_name="Admin Access",
                description="Access admin features",
                category=PermissionCategory.ADMIN,
                is_active=True,
                is_system=True,
            ),
            Permission(
                id=uuid4(),
                name="user.profile.read",
                display_name="Read Profile",
                description="Read own profile",
                category=PermissionCategory.CUSTOMER,
                is_active=True,
                is_system=True,
            ),
            Permission(
                id=uuid4(),
                name="user.profile.write",
                display_name="Update Profile",
                description="Update own profile",
                category=PermissionCategory.CUSTOMER,
                is_active=True,
                is_system=True,
            ),
        ]

        for perm in permissions:
            session.add(perm)

        session.commit()

        # Assign roles to users
        admin_role = session.query(Role).filter_by(name="admin").first()
        user_role = session.query(Role).filter_by(name="user").first()

        admin_user = session.query(User).filter_by(username="admin").first()
        test_user = session.query(User).filter_by(username="test").first()

        # Assign roles
        if admin_role and admin_user:
            admin_user.roles.append(admin_role)

        if user_role and test_user:
            test_user.roles.append(user_role)

        # Assign permissions to roles
        admin_perm = session.query(Permission).filter_by(name="admin.access").first()
        user_read_perm = session.query(Permission).filter_by(name="user.profile.read").first()
        user_write_perm = session.query(Permission).filter_by(name="user.profile.write").first()

        if admin_role and admin_perm:
            admin_role.permissions.append(admin_perm)

        if user_role:
            if user_read_perm:
                user_role.permissions.append(user_read_perm)
            if user_write_perm:
                user_role.permissions.append(user_write_perm)

        session.commit()

        print("✅ Test data seeded successfully!")
        print("\n📝 Test Accounts:")
        print("  Admin: admin@example.com / admin123")
        print("  User:  test@example.com / password123")


if __name__ == "__main__":
    engine = create_tables()
    seed_test_data(engine)
    print("\n🎉 Database initialization complete!")
