#!/usr/bin/env python3
"""
Seed data for billing add-ons catalog.

Creates sample add-ons for ISP platform including:
- Additional user seats
- Priority support
- Advanced analytics
- Static IP addresses
- Bandwidth upgrades
"""

import asyncio
import sys
from datetime import UTC, datetime
from decimal import Decimal
from pathlib import Path
from uuid import uuid4

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select

from dotmac.platform.db import get_async_database_url
from dotmac.platform.billing.models import BillingAddonTable


async def seed_addons():
    """Create sample add-ons in the database."""

    # Sample tenant ID (use your actual tenant ID)
    TENANT_ID = "default_tenant"

    addons_data = [
        {
            "addon_id": f"addon_{uuid4().hex[:12]}",
            "tenant_id": TENANT_ID,
            "name": "Additional User Seats (5 seats)",
            "description": "Add 5 additional user seats to your subscription for team collaboration",
            "addon_type": "user_seats",
            "billing_type": "recurring",
            "price": Decimal("25.00"),
            "currency": "USD",
            "setup_fee": None,
            "is_quantity_based": True,
            "min_quantity": 1,
            "max_quantity": 10,
            "metered_unit": None,
            "included_quantity": None,
            "is_active": True,
            "is_featured": True,
            "compatible_with_all_plans": True,
            "compatible_plan_ids": [],
            "metadata_json": {
                "seats_per_unit": 5,
                "permissions": ["user_management", "team_collaboration"]
            },
            "icon": "users-plus",
            "features": [
                "5 additional user accounts",
                "Full access to platform features",
                "Team collaboration tools",
                "Role-based access control"
            ],
        },
        {
            "addon_id": f"addon_{uuid4().hex[:12]}",
            "tenant_id": TENANT_ID,
            "name": "Priority Support",
            "description": "24/7 premium support with dedicated account manager and 1-hour response time",
            "addon_type": "service",
            "billing_type": "recurring",
            "price": Decimal("99.00"),
            "currency": "USD",
            "setup_fee": Decimal("50.00"),
            "is_quantity_based": False,
            "min_quantity": 1,
            "max_quantity": None,
            "metered_unit": None,
            "included_quantity": None,
            "is_active": True,
            "is_featured": True,
            "compatible_with_all_plans": True,
            "compatible_plan_ids": [],
            "metadata_json": {
                "response_time_sla": "1 hour",
                "availability": "24/7",
                "dedicated_manager": True
            },
            "icon": "headset",
            "features": [
                "24/7 premium support access",
                "Dedicated account manager",
                "1-hour response time SLA",
                "Priority bug fixes",
                "Direct phone support"
            ],
        },
        {
            "addon_id": f"addon_{uuid4().hex[:12]}",
            "tenant_id": TENANT_ID,
            "name": "Advanced Analytics Dashboard",
            "description": "Real-time analytics, custom reports, and data export capabilities",
            "addon_type": "feature",
            "billing_type": "recurring",
            "price": Decimal("49.00"),
            "currency": "USD",
            "setup_fee": None,
            "is_quantity_based": False,
            "min_quantity": 1,
            "max_quantity": None,
            "metered_unit": None,
            "included_quantity": None,
            "is_active": True,
            "is_featured": True,
            "compatible_with_all_plans": False,
            "compatible_plan_ids": [],  # Can specify plan IDs here
            "metadata_json": {
                "report_retention_days": 365,
                "custom_reports": True,
                "api_access": True
            },
            "icon": "chart-bar",
            "features": [
                "Real-time analytics dashboard",
                "Custom report builder",
                "Data export (CSV, Excel, PDF)",
                "Historical data (365 days)",
                "API access for integrations"
            ],
        },
        {
            "addon_id": f"addon_{uuid4().hex[:12]}",
            "tenant_id": TENANT_ID,
            "name": "Static IP Address",
            "description": "Dedicated static IP address for your connection",
            "addon_type": "resource",
            "billing_type": "recurring",
            "price": Decimal("10.00"),
            "currency": "USD",
            "setup_fee": Decimal("25.00"),
            "is_quantity_based": True,
            "min_quantity": 1,
            "max_quantity": 5,
            "metered_unit": None,
            "included_quantity": None,
            "is_active": True,
            "is_featured": False,
            "compatible_with_all_plans": True,
            "compatible_plan_ids": [],
            "metadata_json": {
                "ip_type": "static_ipv4",
                "assignment_type": "dedicated"
            },
            "icon": "network",
            "features": [
                "Dedicated static IPv4 address",
                "Permanent assignment",
                "Ideal for hosting services",
                "No additional traffic charges"
            ],
        },
        {
            "addon_id": f"addon_{uuid4().hex[:12]}",
            "tenant_id": TENANT_ID,
            "name": "Bandwidth Boost (50 Mbps)",
            "description": "Increase your connection speed by 50 Mbps",
            "addon_type": "resource",
            "billing_type": "recurring",
            "price": Decimal("15.00"),
            "currency": "USD",
            "setup_fee": None,
            "is_quantity_based": True,
            "min_quantity": 1,
            "max_quantity": 10,
            "metered_unit": None,
            "included_quantity": None,
            "is_active": True,
            "is_featured": True,
            "compatible_with_all_plans": True,
            "compatible_plan_ids": [],
            "metadata_json": {
                "bandwidth_increase_mbps": 50,
                "applies_to": ["download", "upload"]
            },
            "icon": "speedometer",
            "features": [
                "50 Mbps additional bandwidth",
                "No data caps",
                "Instant activation",
                "Can be stacked for more speed"
            ],
        },
        {
            "addon_id": f"addon_{uuid4().hex[:12]}",
            "tenant_id": TENANT_ID,
            "name": "Cloud Storage (100 GB)",
            "description": "Secure cloud storage for backups and file sharing",
            "addon_type": "resource",
            "billing_type": "recurring",
            "price": Decimal("5.00"),
            "currency": "USD",
            "setup_fee": None,
            "is_quantity_based": True,
            "min_quantity": 1,
            "max_quantity": 50,
            "metered_unit": None,
            "included_quantity": None,
            "is_active": True,
            "is_featured": False,
            "compatible_with_all_plans": True,
            "compatible_plan_ids": [],
            "metadata_json": {
                "storage_gb": 100,
                "encryption": "AES-256",
                "backup_retention_days": 30
            },
            "icon": "cloud",
            "features": [
                "100 GB secure cloud storage",
                "AES-256 encryption",
                "File sharing capabilities",
                "30-day backup retention",
                "Web and mobile access"
            ],
        },
        {
            "addon_id": f"addon_{uuid4().hex[:12]}",
            "tenant_id": TENANT_ID,
            "name": "API Access (Metered)",
            "description": "Pay-per-use API access for custom integrations",
            "addon_type": "integration",
            "billing_type": "metered",
            "price": Decimal("0.01"),  # Per API call
            "currency": "USD",
            "setup_fee": Decimal("100.00"),
            "is_quantity_based": False,
            "min_quantity": 1,
            "max_quantity": None,
            "metered_unit": "API calls",
            "included_quantity": 1000,  # First 1000 calls included
            "is_active": True,
            "is_featured": False,
            "compatible_with_all_plans": False,
            "compatible_plan_ids": [],  # Typically for enterprise plans
            "metadata_json": {
                "rate_limit_per_minute": 100,
                "included_calls": 1000,
                "overage_rate": 0.01
            },
            "icon": "code",
            "features": [
                "Full REST API access",
                "1,000 calls included monthly",
                "$0.01 per additional call",
                "100 calls/min rate limit",
                "Comprehensive documentation",
                "Webhook support"
            ],
        },
    ]

    # Get database session
    engine = create_async_engine(get_async_database_url(), echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        try:
            # Check if addons already exist
            stmt = select(BillingAddonTable).where(
                BillingAddonTable.tenant_id == TENANT_ID
            )
            result = await session.execute(stmt)
            existing_addons = result.scalars().all()

            if existing_addons:
                print(f"✓ Found {len(existing_addons)} existing add-ons for tenant {TENANT_ID}")
                print("Skipping seed - add-ons already exist")
                return

            # Insert add-ons
            now = datetime.now(UTC)
            for addon_data in addons_data:
                addon = BillingAddonTable(
                    **addon_data,
                    created_at=now,
                    updated_at=now,
                )
                session.add(addon)

            await session.commit()

            print(f"✓ Successfully seeded {len(addons_data)} add-ons for tenant {TENANT_ID}")
            print("\nAdd-ons created:")
            for addon_data in addons_data:
                print(f"  - {addon_data['name']} (${addon_data['price']}/mo)")

        except Exception as e:
            await session.rollback()
            print(f"✗ Error seeding add-ons: {e}")
            raise


if __name__ == "__main__":
    print("Seeding billing add-ons...")
    asyncio.run(seed_addons())
    print("Done!")
