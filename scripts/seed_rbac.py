#!/usr/bin/env python
"""
Seed script for RBAC permissions and roles
Run after migration: python scripts/seed_rbac.py
"""

import sys
from pathlib import Path
from uuid import uuid4

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent))


from sqlalchemy.orm import Session

# Import the models
from dotmac.platform.auth.models import Permission, Role

# Import base and settings
from dotmac.platform.db import SyncSessionLocal, get_sync_engine


class RBACSeeder:
    """Seeds initial RBAC data"""

    def __init__(self, db_session: Session):
        self.db = db_session
        self.permissions_map = {}
        self.roles_map = {}

    def seed_permissions(self):
        """Seed all permissions from the matrix"""
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
            (
                "analytics.update",
                "Update Analytics",
                "analytics",
                "Modify analytics configurations",
            ),
            ("analytics.delete", "Delete Analytics", "analytics", "Remove analytics data"),
            (
                "analytics.manage",
                "Manage Analytics",
                "analytics",
                "Full analytics system management",
            ),
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

        print("Seeding permissions...")
        for name, display_name, category, description in permissions_data:
            if not self.db.query(Permission).filter_by(name=name).first():
                permission = Permission(
                    id=uuid4(),
                    name=name,
                    display_name=display_name,
                    category=category,
                    description=description,
                    is_system=True,  # System permissions can't be deleted
                )
                self.db.add(permission)
                self.permissions_map[name] = permission
                print(f"  ✓ Created permission: {name}")
            else:
                self.permissions_map[name] = self.db.query(Permission).filter_by(name=name).first()
                print(f"  - Permission exists: {name}")

        self.db.commit()
        print(f"Total permissions: {len(self.permissions_map)}\n")

    def seed_roles(self):
        """Seed initial roles with permissions"""
        roles_data = [
            # Basic user role
            {
                "name": "user",
                "display_name": "User",
                "description": "Basic read permissions for standard users",
                "priority": 1,
                "permissions": ["settings.read", "analytics.read"],
                "is_default": True,  # Auto-assigned to new users
            },
            # Analyst role
            {
                "name": "analyst",
                "display_name": "Analyst",
                "description": "Read-only access for analytics and reporting",
                "priority": 10,
                "permissions": [
                    "analytics.read",
                    "analytics.create",
                    "billing.read",
                    "customers.read",
                    "communications.read",
                    "settings.read",
                ],
            },
            # Developer role
            {
                "name": "developer",
                "display_name": "Developer",
                "description": "Infrastructure and API access for developers",
                "priority": 15,
                "permissions": [
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
            },
            # Manager role
            {
                "name": "manager",
                "display_name": "Manager",
                "description": "Read/write access for business operations",
                "priority": 20,
                "permissions": [
                    "users.read",
                    "users.create",
                    "users.update",
                    "customers.read",
                    "customers.create",
                    "customers.update",
                    "customers.manage",
                    "contacts.read",
                    "contacts.create",
                    "contacts.update",
                    "contacts.manage",
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
            },
            # Admin role
            {
                "name": "admin",
                "display_name": "Administrator",
                "description": "Full management permissions except system-level operations",
                "priority": 50,
                "permissions": [
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
                    "contacts.read",
                    "contacts.create",
                    "contacts.update",
                    "contacts.delete",
                    "contacts.manage",
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
                "is_system": True,
            },
            # Superuser role
            {
                "name": "superuser",
                "display_name": "Super User",
                "description": "All permissions including system-level operations",
                "priority": 100,
                "permissions": ["*"],  # Wildcard - all permissions
                "is_system": True,
            },
        ]

        print("Seeding roles...")
        for role_data in roles_data:
            name = role_data["name"]

            if not self.db.query(Role).filter_by(name=name).first():
                # Get parent role if specified
                parent = None
                if "parent" in role_data:
                    parent = self.roles_map.get(role_data["parent"])
                    if not parent:
                        parent = self.db.query(Role).filter_by(name=role_data["parent"]).first()

                # Create role
                role = Role(
                    id=uuid4(),
                    name=name,
                    display_name=role_data["display_name"],
                    description=role_data["description"],
                    priority=role_data["priority"],
                    parent_id=parent.id if parent else None,
                    is_default=role_data.get("is_default", False),
                    is_system=role_data.get("is_system", False),
                )
                self.db.add(role)
                self.db.flush()  # Get the ID

                # Add permissions
                for perm_name in role_data["permissions"]:
                    if perm_name == "*":
                        # Add all permissions for admin roles
                        for permission in self.permissions_map.values():
                            role.permissions.append(permission)
                    elif perm_name in self.permissions_map:
                        role.permissions.append(self.permissions_map[perm_name])
                    else:
                        print(f"    Warning: Permission '{perm_name}' not found")

                self.roles_map[name] = role
                print(f"  ✓ Created role: {name} (priority: {role.priority})")
            else:
                print(f"  - Role exists: {name}")

        self.db.commit()
        print(f"Total roles: {len(self.roles_map)}\n")

    def create_sample_assignments(self):
        """Show information about role assignments"""
        print("Role Assignment Information:")
        print("=" * 40)
        print("Default role assignments:")
        print("  - New users automatically get 'user' role")
        print("  - Role assignments should be done through the admin interface")
        print("  - Available roles:")

        # Show all roles with their priorities
        for role_name, role in self.roles_map.items():
            print(f"    • {role.display_name} ({role_name}) - Priority: {role.priority}")

        print("\nTo assign roles to users:")
        print("  1. Use the web admin interface")
        print("  2. Use the RBAC API endpoints")
        print("  3. Use the CLI management commands")
        print()

    def run(self):
        """Run the complete seeding process"""
        print("=" * 60)
        print("RBAC Seeding Process")
        print("=" * 60 + "\n")

        self.seed_permissions()
        self.seed_roles()
        self.create_sample_assignments()

        print("=" * 60)
        print("✅ RBAC seeding completed successfully!")
        print("=" * 60)


def main():
    """Main entry point"""
    try:
        print("Connecting to database...")

        # Get database engine
        engine = get_sync_engine()

        # Test connection
        with engine.connect() as conn:
            print("Database connection successful!")

        # Use session factory
        with SyncSessionLocal() as session:
            print("Starting RBAC seeding process...")
            seeder = RBACSeeder(session)
            seeder.run()
            print("\nRBAC seeding completed successfully!")

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
