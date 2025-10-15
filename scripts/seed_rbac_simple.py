#!/usr/bin/env python
"""
Simple RBAC Seed Script using raw SQL
Avoids complex SQLAlchemy relationship issues
"""

import sys
from datetime import UTC, datetime
from pathlib import Path
from uuid import uuid4

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent))

from sqlalchemy import text

from dotmac.platform.db import get_sync_engine


def seed_rbac_data():
    """Seed RBAC data using raw SQL"""
    engine = get_sync_engine()

    permissions_data = [
        # User Management
        ("users.read", "View Users", "users", "View user accounts and profiles"),
        ("users.create", "Create Users", "users", "Create new user accounts"),
        ("users.update", "Update Users", "users", "Modify user accounts and profiles"),
        ("users.delete", "Delete Users", "users", "Remove user accounts"),
        ("users.manage", "Manage Users", "users", "Full user management capabilities"),
        # Customer Management
        ("customers.read", "View Customers", "customers", "View customer details and lists"),
        ("customers.create", "Create Customers", "customers", "Create new customer accounts"),
        ("customers.update", "Update Customers", "customers", "Edit customer information"),
        ("customers.delete", "Delete Customers", "customers", "Remove customer accounts"),
        (
            "customers.manage",
            "Manage Customers",
            "customers",
            "Full customer management capabilities",
        ),
        # Contact Management
        ("contacts.read", "View Contacts", "contacts", "View contact details and lists"),
        ("contacts.create", "Create Contacts", "contacts", "Create new contacts"),
        ("contacts.update", "Update Contacts", "contacts", "Edit contact information"),
        ("contacts.delete", "Delete Contacts", "contacts", "Remove contacts"),
        (
            "contacts.manage",
            "Manage Contacts",
            "contacts",
            "Full contact management including labels and fields",
        ),
        # Billing & Payments
        ("billing.read", "View Billing", "billing", "View billing information and invoices"),
        ("billing.create", "Create Billing", "billing", "Create invoices and billing records"),
        ("billing.update", "Update Billing", "billing", "Modify invoices and billing settings"),
        ("billing.delete", "Delete Billing", "billing", "Remove billing records and invoices"),
        ("billing.manage", "Manage Billing", "billing", "Full billing system management"),
        ("billing.execute", "Process Payments", "billing", "Process payments and refunds"),
        # Analytics & Reporting
        ("analytics.read", "View Analytics", "analytics", "Access dashboards and reports"),
        ("analytics.create", "Create Reports", "analytics", "Generate custom reports"),
        ("analytics.update", "Update Analytics", "analytics", "Modify analytics configurations"),
        ("analytics.delete", "Delete Analytics", "analytics", "Remove analytics data"),
        ("analytics.manage", "Manage Analytics", "analytics", "Full analytics system management"),
        # Communications
        (
            "communications.read",
            "View Communications",
            "communications",
            "View communication logs and templates",
        ),
        (
            "communications.create",
            "Create Communications",
            "communications",
            "Send emails and notifications",
        ),
        (
            "communications.update",
            "Update Communications",
            "communications",
            "Modify communication templates",
        ),
        (
            "communications.delete",
            "Delete Communications",
            "communications",
            "Remove communication records",
        ),
        (
            "communications.manage",
            "Manage Communications",
            "communications",
            "Full communication system management",
        ),
        (
            "communications.execute",
            "Send Communications",
            "communications",
            "Execute communication campaigns",
        ),
        # Infrastructure
        (
            "infrastructure.read",
            "View Infrastructure",
            "infrastructure",
            "View system configuration and status",
        ),
        (
            "infrastructure.create",
            "Create Infrastructure",
            "infrastructure",
            "Create infrastructure resources",
        ),
        (
            "infrastructure.update",
            "Update Infrastructure",
            "infrastructure",
            "Modify infrastructure settings",
        ),
        (
            "infrastructure.delete",
            "Delete Infrastructure",
            "infrastructure",
            "Remove infrastructure resources",
        ),
        (
            "infrastructure.manage",
            "Manage Infrastructure",
            "infrastructure",
            "Full infrastructure management",
        ),
        (
            "infrastructure.execute",
            "Execute Infrastructure",
            "infrastructure",
            "Deploy and operate infrastructure",
        ),
        # Secrets Management
        ("secrets.read", "Read Secrets", "secrets", "Access secret values"),
        ("secrets.create", "Create Secrets", "secrets", "Create new secrets"),
        ("secrets.update", "Update Secrets", "secrets", "Modify existing secrets"),
        ("secrets.delete", "Delete Secrets", "secrets", "Remove secrets"),
        ("secrets.manage", "Manage Secrets", "secrets", "Full secrets management"),
        ("secrets.execute", "Rotate Secrets", "secrets", "Execute secret rotation"),
        # Settings
        ("settings.read", "View Settings", "settings", "View system and user settings"),
        ("settings.create", "Create Settings", "settings", "Create new configuration settings"),
        ("settings.update", "Update Settings", "settings", "Modify system settings"),
        ("settings.delete", "Delete Settings", "settings", "Remove configuration settings"),
        ("settings.manage", "Manage Settings", "settings", "Full settings management"),
        # System Administration
        ("system.read", "View System", "system", "View system status and logs"),
        ("system.create", "Create System Resources", "system", "Create system-level resources"),
        ("system.update", "Update System", "system", "Modify system configuration"),
        ("system.delete", "Delete System Resources", "system", "Remove system resources"),
        ("system.manage", "Manage System", "system", "Full system administration"),
        ("system.execute", "Execute System Operations", "system", "Perform system operations"),
    ]

    roles_data = [
        # Basic user role
        (
            "user",
            "User",
            "Basic read permissions for standard users",
            1,
            True,
            False,
            ["settings.read", "analytics.read"],
        ),
        # Analyst role
        (
            "analyst",
            "Analyst",
            "Read-only access for analytics and reporting",
            10,
            False,
            False,
            [
                "analytics.read",
                "analytics.create",
                "billing.read",
                "customers.read",
                "communications.read",
                "settings.read",
            ],
        ),
        # Developer role
        (
            "developer",
            "Developer",
            "Infrastructure and API access for developers",
            15,
            False,
            False,
            [
                "infrastructure.read",
                "infrastructure.create",
                "infrastructure.update",
                "infrastructure.execute",
                "secrets.read",
                "secrets.create",
                "secrets.update",
                "analytics.read",
                "settings.read",
                "settings.update",
            ],
        ),
        # Manager role
        (
            "manager",
            "Manager",
            "Read/write access for business operations",
            20,
            False,
            False,
            [
                "users.read",
                "users.create",
                "users.update",
                "customers.read",
                "customers.create",
                "customers.update",
                "customers.manage",
                "billing.read",
                "billing.create",
                "billing.update",
                "billing.execute",
                "analytics.read",
                "analytics.create",
                "communications.read",
                "communications.create",
                "communications.update",
                "communications.execute",
                "settings.read",
                "settings.update",
            ],
        ),
        # Admin role
        (
            "admin",
            "Administrator",
            "Full management permissions except system-level operations",
            50,
            False,
            True,
            [
                "users.read",
                "users.create",
                "users.update",
                "users.delete",
                "users.manage",
                "customers.read",
                "customers.create",
                "customers.update",
                "customers.delete",
                "customers.manage",
                "billing.read",
                "billing.create",
                "billing.update",
                "billing.delete",
                "billing.manage",
                "billing.execute",
                "analytics.read",
                "analytics.create",
                "analytics.update",
                "analytics.delete",
                "analytics.manage",
                "communications.read",
                "communications.create",
                "communications.update",
                "communications.delete",
                "communications.manage",
                "communications.execute",
                "infrastructure.read",
                "infrastructure.create",
                "infrastructure.update",
                "infrastructure.execute",
                "secrets.read",
                "secrets.create",
                "secrets.update",
                "secrets.execute",
                "settings.read",
                "settings.create",
                "settings.update",
                "settings.delete",
                "settings.manage",
            ],
        ),
        # Superuser role
        (
            "superuser",
            "Super User",
            "All permissions including system-level operations",
            100,
            False,
            True,
            ["*"],
        ),
    ]

    with engine.begin() as conn:
        print("Seeding permissions...")
        permission_ids = {}

        # Insert permissions
        for name, display_name, category, description in permissions_data:
            # Check if permission exists
            result = conn.execute(
                text("SELECT id FROM permissions WHERE name = :name"), {"name": name}
            )

            existing = result.fetchone()
            if existing:
                permission_ids[name] = existing[0]
                print(f"  - Permission exists: {name}")
            else:
                permission_id = str(uuid4())
                permission_ids[name] = permission_id

                conn.execute(
                    text(
                        """
                    INSERT INTO permissions (id, name, display_name, description, category, is_active, is_system, created_at, updated_at)
                    VALUES (:id, :name, :display_name, :description, :category, :is_active, :is_system, :created_at, :updated_at)
                """
                    ),
                    {
                        "id": permission_id,
                        "name": name,
                        "display_name": display_name,
                        "description": description,
                        "category": category,
                        "is_active": True,
                        "is_system": True,
                        "created_at": datetime.now(UTC),
                        "updated_at": datetime.now(UTC),
                    },
                )
                print(f"  ✓ Created permission: {name}")

        print(f"Total permissions: {len(permission_ids)}\n")

        print("Seeding roles...")
        role_ids = {}

        # Insert roles
        for (
            name,
            display_name,
            description,
            priority,
            is_default,
            is_system,
            permissions,
        ) in roles_data:
            # Check if role exists
            result = conn.execute(text("SELECT id FROM roles WHERE name = :name"), {"name": name})

            existing = result.fetchone()
            if existing:
                role_ids[name] = existing[0]
                print(f"  - Role exists: {name}")
            else:
                role_id = str(uuid4())
                role_ids[name] = role_id

                conn.execute(
                    text(
                        """
                    INSERT INTO roles (id, name, display_name, description, priority, is_active, is_system, is_default, created_at, updated_at)
                    VALUES (:id, :name, :display_name, :description, :priority, :is_active, :is_system, :is_default, :created_at, :updated_at)
                """
                    ),
                    {
                        "id": role_id,
                        "name": name,
                        "display_name": display_name,
                        "description": description,
                        "priority": priority,
                        "is_active": True,
                        "is_system": is_system,
                        "is_default": is_default,
                        "created_at": datetime.now(UTC),
                        "updated_at": datetime.now(UTC),
                    },
                )

                # Add role permissions
                for perm_name in permissions:
                    if perm_name == "*":
                        # Add all permissions for wildcard roles
                        for perm_name_all in permission_ids.keys():
                            # Check if role-permission already exists
                            check_result = conn.execute(
                                text(
                                    "SELECT 1 FROM role_permissions WHERE role_id = :role_id AND permission_id = :permission_id"
                                ),
                                {
                                    "role_id": role_id,
                                    "permission_id": permission_ids[perm_name_all],
                                },
                            )

                            if not check_result.fetchone():
                                conn.execute(
                                    text(
                                        """
                                    INSERT INTO role_permissions (role_id, permission_id, granted_at)
                                    VALUES (:role_id, :permission_id, :granted_at)
                                """
                                    ),
                                    {
                                        "role_id": role_id,
                                        "permission_id": permission_ids[perm_name_all],
                                        "granted_at": datetime.now(UTC),
                                    },
                                )
                    elif perm_name in permission_ids:
                        # Check if role-permission already exists
                        check_result = conn.execute(
                            text(
                                "SELECT 1 FROM role_permissions WHERE role_id = :role_id AND permission_id = :permission_id"
                            ),
                            {"role_id": role_id, "permission_id": permission_ids[perm_name]},
                        )

                        if not check_result.fetchone():
                            conn.execute(
                                text(
                                    """
                                INSERT INTO role_permissions (role_id, permission_id, granted_at)
                                VALUES (:role_id, :permission_id, :granted_at)
                            """
                                ),
                                {
                                    "role_id": role_id,
                                    "permission_id": permission_ids[perm_name],
                                    "granted_at": datetime.now(UTC),
                                },
                            )
                    else:
                        print(f"    Warning: Permission '{perm_name}' not found")

                print(f"  ✓ Created role: {name} (priority: {priority})")

        print(f"Total roles: {len(role_ids)}\n")

        print("Role Assignment Information:")
        print("=" * 40)
        print("Default role assignments:")
        print("  - New users automatically get 'user' role")
        print("  - Role assignments should be done through the admin interface")
        print("  - Available roles:")

        for name, display_name, description, priority, is_default, is_system, _ in roles_data:
            print(f"    • {display_name} ({name}) - Priority: {priority}")

        print("\nTo assign roles to users:")
        print("  1. Use the web admin interface")
        print("  2. Use the RBAC API endpoints")
        print("  3. Use the CLI management commands")
        print()


def main():
    """Main entry point"""
    try:
        print("=" * 60)
        print("RBAC Seeding Process (Simple)")
        print("=" * 60 + "\n")

        print("Connecting to database...")
        engine = get_sync_engine()

        # Test connection
        with engine.connect() as conn:
            print("Database connection successful!")

        seed_rbac_data()

        print("=" * 60)
        print("✅ RBAC seeding completed successfully!")
        print("=" * 60)

    except Exception as e:
        print(f"\nError during RBAC seeding: {e}")
        print("\nPlease ensure:")
        print("1. The database server is running")
        print("2. The database URL is correct in your settings")
        print("3. You have the necessary permissions")
        print("4. Database migrations have been run")
        print("5. Required environment variables are set")
        import traceback

        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
