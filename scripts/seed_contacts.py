#!/usr/bin/env python
"""
Seed script for Contacts system

Seeds sample contacts, labels, and custom fields for testing.
Run after migration: python scripts/seed_contacts.py
"""

import sys
from pathlib import Path
from uuid import uuid4

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent))

from sqlalchemy.orm import Session

# Import models
from dotmac.platform.contacts.models import (
    Contact,
    ContactFieldDefinition,
    ContactFieldType,
    ContactLabelDefinition,
    ContactMethod,
    ContactMethodType,
    ContactStage,
    ContactStatus,
)
from dotmac.platform.customer_management.models import Customer

# Import base and settings
from dotmac.platform.db import SyncSessionLocal, get_sync_engine
from dotmac.platform.tenant.models import Tenant
from dotmac.platform.user_management.models import User


class ContactSeeder:
    """Seeds initial contact data for testing."""

    def __init__(self, db_session: Session):
        self.db = db_session
        self.tenant_id = None
        self.labels = {}
        self.fields = {}
        self.customers = []
        self.user_id = None

    def get_tenant_and_user(self):
        """Get the first tenant and user for seeding."""
        tenant = self.db.query(Tenant).first()
        if not tenant:
            print("Error: No tenant found. Please run tenant seeding first.")
            return False

        self.tenant_id = tenant.id

        user = self.db.query(User).first()
        if user:
            self.user_id = user.id

        print(f"Using tenant: {tenant.name} ({tenant.id})")
        return True

    def seed_label_definitions(self):
        """Seed contact label definitions."""
        label_data = [
            # Status labels
            ("vip", "VIP", "High-value customer", "#FFD700", "star", "status"),
            ("new", "New", "Recently added contact", "#00FF00", "plus", "status"),
            ("inactive", "Inactive", "No recent activity", "#808080", "pause", "status"),
            # Relationship labels
            (
                "decision_maker",
                "Decision Maker",
                "Can make purchasing decisions",
                "#FF4500",
                "crown",
                "relationship",
            ),
            (
                "influencer",
                "Influencer",
                "Influences decisions",
                "#FFA500",
                "users",
                "relationship",
            ),
            ("technical", "Technical", "Technical contact", "#4169E1", "code", "relationship"),
            ("billing", "Billing", "Billing contact", "#228B22", "dollar-sign", "relationship"),
            # Source labels
            ("referral", "Referral", "Referred by another customer", "#9370DB", "link", "source"),
            ("website", "Website", "From website signup", "#00CED1", "globe", "source"),
            ("event", "Event", "Met at an event", "#FF69B4", "calendar", "source"),
            ("partner", "Partner", "From partner program", "#DAA520", "handshake", "source"),
        ]

        print("Seeding contact label definitions...")
        for slug, name, description, color, icon, category in label_data:
            existing = (
                self.db.query(ContactLabelDefinition)
                .filter_by(tenant_id=self.tenant_id, slug=slug)
                .first()
            )

            if not existing:
                label = ContactLabelDefinition(
                    id=uuid4(),
                    tenant_id=self.tenant_id,
                    name=name,
                    slug=slug,
                    description=description,
                    color=color,
                    icon=icon,
                    category=category,
                    display_order=len(self.labels),
                    is_visible=True,
                    is_system=False,
                    created_by=self.user_id,
                )
                self.db.add(label)
                self.labels[slug] = label
                print(f"  ✓ Created label: {name}")
            else:
                self.labels[slug] = existing
                print(f"  - Label exists: {name}")

        self.db.commit()
        print(f"Total labels: {len(self.labels)}\n")

    def seed_field_definitions(self):
        """Seed custom field definitions."""
        field_data = [
            # Text fields
            (
                "linkedin_url",
                "LinkedIn Profile",
                ContactFieldType.URL,
                "professional",
                {"pattern": "^https://[a-z]{2,3}\\.linkedin\\.com/.*"},
            ),
            (
                "twitter_handle",
                "Twitter Handle",
                ContactFieldType.TEXT,
                "social",
                {"pattern": "^@[a-zA-Z0-9_]+$"},
            ),
            # Select fields
            (
                "industry",
                "Industry",
                ContactFieldType.SELECT,
                "professional",
                None,
                ["Technology", "Finance", "Healthcare", "Retail", "Manufacturing", "Other"],
            ),
            (
                "lead_source",
                "Lead Source",
                ContactFieldType.SELECT,
                "sales",
                None,
                ["Inbound", "Outbound", "Referral", "Event", "Partner", "Other"],
            ),
            # Number fields
            (
                "company_size",
                "Company Size",
                ContactFieldType.NUMBER,
                "professional",
                {"min": 1, "max": 1000000},
            ),
            ("deal_size", "Potential Deal Size", ContactFieldType.CURRENCY, "sales", {"min": 0}),
            # Boolean fields
            ("has_budget", "Has Budget", ContactFieldType.BOOLEAN, "sales", None),
            (
                "newsletter_subscriber",
                "Newsletter Subscriber",
                ContactFieldType.BOOLEAN,
                "marketing",
                None,
            ),
            # Date fields
            ("last_meeting", "Last Meeting Date", ContactFieldType.DATE, "activity", None),
            ("renewal_date", "Contract Renewal Date", ContactFieldType.DATE, "sales", None),
        ]

        print("Seeding custom field definitions...")
        for field_key, name, field_type, group, validation, *options in field_data:
            existing = (
                self.db.query(ContactFieldDefinition)
                .filter_by(tenant_id=self.tenant_id, field_key=field_key)
                .first()
            )

            if not existing:
                field = ContactFieldDefinition(
                    id=uuid4(),
                    tenant_id=self.tenant_id,
                    name=name,
                    field_key=field_key,
                    field_type=field_type,
                    field_group=group,
                    validation_rules=validation,
                    options=(
                        [{"value": opt, "label": opt} for opt in options[0]] if options else None
                    ),
                    display_order=len(self.fields),
                    is_visible=True,
                    is_editable=True,
                    is_searchable=True,
                    created_by=self.user_id,
                )
                self.db.add(field)
                self.fields[field_key] = field
                print(f"  ✓ Created field: {name}")
            else:
                self.fields[field_key] = existing
                print(f"  - Field exists: {name}")

        self.db.commit()
        print(f"Total fields: {len(self.fields)}\n")

    def get_sample_customers(self):
        """Get some customers to associate with contacts."""
        self.customers = self.db.query(Customer).filter_by(tenant_id=self.tenant_id).limit(5).all()
        if not self.customers:
            print(
                "Warning: No customers found. Contacts will be created without customer associations."
            )
        else:
            print(f"Found {len(self.customers)} customers to associate with contacts\n")

    def seed_contacts(self):
        """Seed sample contacts."""
        contact_data = [
            {
                "first_name": "John",
                "last_name": "Smith",
                "company": "TechCorp Inc.",
                "job_title": "CTO",
                "department": "Engineering",
                "stage": ContactStage.CUSTOMER,
                "is_decision_maker": True,
                "is_technical_contact": True,
                "labels": ["vip", "decision_maker", "technical"],
                "methods": [
                    (ContactMethodType.EMAIL, "john.smith@techcorp.com", "Work", True),
                    (ContactMethodType.PHONE, "+1-555-0100", "Office", False),
                    (ContactMethodType.MOBILE, "+1-555-0101", "Mobile", False),
                ],
                "custom_fields": {
                    "linkedin_url": "https://www.linkedin.com/in/johnsmith",
                    "industry": "Technology",
                    "company_size": 500,
                    "has_budget": True,
                    "deal_size": 250000,
                },
            },
            {
                "first_name": "Sarah",
                "last_name": "Johnson",
                "company": "FinanceHub",
                "job_title": "CFO",
                "department": "Finance",
                "stage": ContactStage.OPPORTUNITY,
                "is_decision_maker": True,
                "is_billing_contact": True,
                "labels": ["decision_maker", "billing", "new"],
                "methods": [
                    (ContactMethodType.EMAIL, "sarah.j@financehub.com", "Work", True),
                    (ContactMethodType.EMAIL, "sarah.johnson@gmail.com", "Personal", False),
                    (ContactMethodType.PHONE, "+1-555-0200", "Office", False),
                ],
                "custom_fields": {
                    "industry": "Finance",
                    "company_size": 1200,
                    "lead_source": "Referral",
                    "newsletter_subscriber": True,
                },
            },
            {
                "first_name": "Michael",
                "last_name": "Chen",
                "company": "StartupXYZ",
                "job_title": "CEO",
                "department": "Executive",
                "stage": ContactStage.LEAD,
                "is_decision_maker": True,
                "labels": ["decision_maker", "website"],
                "methods": [
                    (ContactMethodType.EMAIL, "mchen@startupxyz.io", "Work", True),
                    (ContactMethodType.MOBILE, "+1-555-0300", "Mobile", False),
                    (ContactMethodType.WEBSITE, "https://startupxyz.io", "Company", False),
                ],
                "custom_fields": {
                    "twitter_handle": "@mchen_startup",
                    "industry": "Technology",
                    "company_size": 25,
                    "lead_source": "Inbound",
                },
            },
            {
                "first_name": "Emily",
                "last_name": "Davis",
                "company": "HealthTech Solutions",
                "job_title": "VP of Operations",
                "department": "Operations",
                "stage": ContactStage.CUSTOMER,
                "labels": ["influencer", "event"],
                "methods": [
                    (ContactMethodType.EMAIL, "emily.davis@healthtech.com", "Work", True),
                    (ContactMethodType.PHONE, "+1-555-0400", "Office", False),
                    (ContactMethodType.ADDRESS, "", "Office", False),  # Will add address fields
                ],
                "custom_fields": {
                    "industry": "Healthcare",
                    "company_size": 300,
                    "lead_source": "Event",
                    "has_budget": True,
                },
                "address": {
                    "line1": "123 Health Plaza",
                    "line2": "Suite 456",
                    "city": "Boston",
                    "state": "MA",
                    "postal": "02101",
                    "country": "US",
                },
            },
            {
                "first_name": "Robert",
                "last_name": "Wilson",
                "company": "Global Retail Co",
                "job_title": "Director of IT",
                "department": "Information Technology",
                "stage": ContactStage.PROSPECT,
                "is_technical_contact": True,
                "labels": ["technical", "partner"],
                "methods": [
                    (ContactMethodType.EMAIL, "rwilson@globalretail.com", "Work", True),
                    (ContactMethodType.PHONE, "+1-555-0500", "Direct", False),
                ],
                "custom_fields": {
                    "industry": "Retail",
                    "company_size": 5000,
                    "lead_source": "Partner",
                },
            },
        ]

        print("Seeding contacts...")
        for idx, contact_info in enumerate(contact_data):
            # Check if contact already exists
            existing = (
                self.db.query(Contact)
                .filter_by(
                    tenant_id=self.tenant_id,
                    first_name=contact_info["first_name"],
                    last_name=contact_info["last_name"],
                )
                .first()
            )

            if existing:
                print(
                    f"  - Contact exists: {contact_info['first_name']} {contact_info['last_name']}"
                )
                continue

            # Create contact
            contact = Contact(
                id=uuid4(),
                tenant_id=self.tenant_id,
                customer_id=(
                    self.customers[idx % len(self.customers)].id if self.customers else None
                ),
                first_name=contact_info["first_name"],
                last_name=contact_info["last_name"],
                display_name=f"{contact_info['first_name']} {contact_info['last_name']}",
                company=contact_info.get("company"),
                job_title=contact_info.get("job_title"),
                department=contact_info.get("department"),
                status=ContactStatus.ACTIVE,
                stage=contact_info.get("stage", ContactStage.PROSPECT),
                owner_id=self.user_id,
                is_decision_maker=contact_info.get("is_decision_maker", False),
                is_billing_contact=contact_info.get("is_billing_contact", False),
                is_technical_contact=contact_info.get("is_technical_contact", False),
                custom_fields=contact_info.get("custom_fields", {}),
                preferred_language="en",
                timezone="America/New_York",
            )
            self.db.add(contact)
            self.db.flush()  # Get the contact ID

            # Add contact methods
            for method_type, value, label, is_primary in contact_info["methods"]:
                method = ContactMethod(
                    id=uuid4(),
                    contact_id=contact.id,
                    type=method_type,
                    value=value if value else f"placeholder-{method_type}",
                    label=label,
                    is_primary=is_primary,
                    is_verified=is_primary,  # Mark primary as verified
                )

                # Add address fields if it's an address type
                if method_type == ContactMethodType.ADDRESS and "address" in contact_info:
                    addr = contact_info["address"]
                    method.address_line1 = addr["line1"]
                    method.address_line2 = addr.get("line2")
                    method.city = addr["city"]
                    method.state_province = addr["state"]
                    method.postal_code = addr["postal"]
                    method.country = addr["country"]
                    method.value = (
                        f"{addr['line1']}, {addr['city']}, {addr['state']} {addr['postal']}"
                    )

                self.db.add(method)

            # Add labels
            if "labels" in contact_info:
                for label_slug in contact_info["labels"]:
                    if label_slug in self.labels:
                        contact.labels.append(self.labels[label_slug])

            print(f"  ✓ Created contact: {contact.display_name} ({contact.company})")

        self.db.commit()
        print("\nContact seeding completed!\n")

    def run(self):
        """Run the complete seeding process."""
        print("=" * 60)
        print("Contact System Seeding Process")
        print("=" * 60 + "\n")

        if not self.get_tenant_and_user():
            return

        self.seed_label_definitions()
        self.seed_field_definitions()
        self.get_sample_customers()
        self.seed_contacts()

        print("=" * 60)
        print("✅ Contact seeding completed successfully!")
        print("=" * 60)


def main():
    """Main entry point."""
    try:
        print("Connecting to database...")

        # Get database engine
        engine = get_sync_engine()

        # Test connection
        with engine.connect() as conn:
            print("Database connection successful!")

        # Use session factory
        with SyncSessionLocal() as session:
            print("Starting contact seeding process...")
            seeder = ContactSeeder(session)
            seeder.run()
            print("\nContact seeding completed successfully!")

    except Exception as e:
        print(f"\nError during contact seeding: {e}")
        print("\nPlease ensure:")
        print("1. The database server is running")
        print("2. Database migrations have been run")
        print("3. Tenant and user data exists")
        print("4. RBAC permissions have been seeded")
        import traceback

        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
