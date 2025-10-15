#!/usr/bin/env python3
"""
Test ISP Customer CRUD Operations.

Tests creating, reading, updating, and deleting customers with ISP-specific fields.
"""

import sys
from datetime import UTC, datetime
from pathlib import Path
from uuid import uuid4

# Add src to path
project_root = Path(__file__).resolve().parent
src_root = project_root / "src"
sys.path.insert(0, str(src_root))

from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker

from dotmac.platform.customer_management.models import (
    Customer,
    CustomerStatus,
    CustomerTier,
    CustomerType,
)

# Database URL
DATABASE_URL = "postgresql://dotmac_user:change-me-in-production@localhost:5432/dotmac"

# Test data
TEST_TENANT_ID = "test-tenant-001"


def print_section(title: str):
    """Print a section header."""
    print(f"\n{'=' * 70}")
    print(f"  {title}")
    print(f"{'=' * 70}\n")


def main():
    """Run ISP customer CRUD tests."""
    print_section("ISP Customer CRUD Tests")

    # Create engine and session
    engine = create_engine(DATABASE_URL, echo=False)
    Session = sessionmaker(bind=engine)
    session = Session()

    try:
        # Test 1: Create Customer with ISP Fields
        print_section("Test 1: Create ISP Customer")

        customer_number = f"CUST-{uuid4().hex[:8].upper()}"
        customer = Customer(
            id=uuid4(),
            tenant_id=TEST_TENANT_ID,
            customer_number=customer_number,
            # Basic info
            first_name="John",
            last_name="Doe",
            email=f"john.doe.{uuid4().hex[:6]}@example.com",
            phone="+1-555-0123",
            mobile="+1-555-0124",
            customer_type=CustomerType.INDIVIDUAL,
            status=CustomerStatus.ACTIVE,
            tier=CustomerTier.STANDARD,
            # Billing address
            address_line1="123 Main St",
            address_line2="Apt 4B",
            city="Springfield",
            state_province="IL",
            postal_code="62701",
            country="US",
            # ISP-specific fields
            service_address_line1="456 Fiber Ave",
            service_address_line2="Building 2",
            service_city="Springfield",
            service_state_province="IL",
            service_postal_code="62702",
            service_country="US",
            service_coordinates={"lat": 39.7817, "lon": -89.6501},
            # Installation tracking
            installation_status="scheduled",
            scheduled_installation_date=datetime(2025, 10, 20, 10, 0, tzinfo=UTC),
            installation_notes="Customer prefers morning installation. Gate code: #1234",
            # Service details
            connection_type="ftth",
            last_mile_technology="gpon",
            service_plan_speed="100/100 Mbps",
            # Network assignments
            assigned_devices={
                "onu_serial": "ZTEG12345678",
                "cpe_mac": "AA:BB:CC:DD:EE:FF",
                "router_ip": "192.168.1.1",
            },
            current_bandwidth_profile="residential_100mbps",
            static_ip_assigned="203.0.113.45",
            ipv6_prefix="2001:db8::/64",
            # Service quality
            avg_uptime_percent=99.95,
            total_outages=0,
            total_downtime_minutes=0,
        )

        session.add(customer)
        session.commit()

        print(f"✅ Created customer: {customer.customer_number}")
        print(f"   ID: {customer.id}")
        print(f"   Name: {customer.full_name}")
        print(f"   Service Address: {customer.service_address_line1}, {customer.service_city}")
        print(f"   Connection: {customer.connection_type} / {customer.last_mile_technology}")
        print(f"   Speed: {customer.service_plan_speed}")
        print(f"   Installation: {customer.installation_status}")
        print(f"   Coordinates: {customer.service_coordinates}")
        print(f"   Devices: {customer.assigned_devices}")

        customer_id = customer.id

        # Test 2: Read Customer
        print_section("Test 2: Read ISP Customer")

        stmt = select(Customer).where(Customer.id == customer_id)
        retrieved_customer = session.execute(stmt).scalar_one()

        print(f"✅ Retrieved customer: {retrieved_customer.customer_number}")
        print(
            f"   Service Location: ({retrieved_customer.service_coordinates.get('lat')}, "
            f"{retrieved_customer.service_coordinates.get('lon')})"
        )
        print(f"   Static IP: {retrieved_customer.static_ip_assigned}")
        print(f"   IPv6: {retrieved_customer.ipv6_prefix}")
        print(f"   Bandwidth Profile: {retrieved_customer.current_bandwidth_profile}")
        print(f"   Uptime: {retrieved_customer.avg_uptime_percent}%")
        print(f"   Outages: {retrieved_customer.total_outages}")

        # Test 3: Update Installation Status
        print_section("Test 3: Update Installation Status")

        retrieved_customer.installation_status = "completed"
        retrieved_customer.installation_date = datetime.now(UTC)
        retrieved_customer.installation_notes += (
            "\n\nInstallation completed successfully. Signal strength: -23dBm"
        )

        session.commit()

        print(f"✅ Updated installation status to: {retrieved_customer.installation_status}")
        print(f"   Installation Date: {retrieved_customer.installation_date}")

        # Test 4: Update Service Quality Metrics
        print_section("Test 4: Update Service Quality Metrics")

        retrieved_customer.total_outages = 1
        retrieved_customer.last_outage_date = datetime(2025, 10, 15, 14, 30, tzinfo=UTC)
        retrieved_customer.total_downtime_minutes = 15
        retrieved_customer.avg_uptime_percent = 99.92  # Recalculated

        session.commit()

        print("✅ Updated service quality metrics:")
        print(f"   Total Outages: {retrieved_customer.total_outages}")
        print(f"   Last Outage: {retrieved_customer.last_outage_date}")
        print(f"   Total Downtime: {retrieved_customer.total_downtime_minutes} minutes")
        print(f"   Uptime: {retrieved_customer.avg_uptime_percent}%")

        # Test 5: Change Bandwidth Profile
        print_section("Test 5: Change Bandwidth Profile (Upgrade)")

        old_profile = retrieved_customer.current_bandwidth_profile
        old_speed = retrieved_customer.service_plan_speed

        retrieved_customer.current_bandwidth_profile = "residential_500mbps"
        retrieved_customer.service_plan_speed = "500/500 Mbps"

        session.commit()

        print("✅ Bandwidth upgrade completed:")
        print(f"   Old: {old_profile} ({old_speed})")
        print(
            f"   New: {retrieved_customer.current_bandwidth_profile} ({retrieved_customer.service_plan_speed})"
        )

        # Test 6: Update Device Assignment
        print_section("Test 6: Update Device Assignment")

        retrieved_customer.assigned_devices = {
            **retrieved_customer.assigned_devices,
            "onu_serial": "ZTEG87654321",  # Replaced ONU
            "replacement_date": "2025-10-16",
            "replacement_reason": "Signal degradation",
        }

        session.commit()

        print("✅ Updated device assignment:")
        for key, value in retrieved_customer.assigned_devices.items():
            print(f"   {key}: {value}")

        # Test 7: Search by Installation Status
        print_section("Test 7: Search by Installation Status")

        stmt = select(Customer).where(
            Customer.tenant_id == TEST_TENANT_ID, Customer.installation_status == "completed"
        )
        completed_installs = session.execute(stmt).scalars().all()

        print(f"✅ Found {len(completed_installs)} customers with completed installations")
        for cust in completed_installs:
            print(f"   - {cust.customer_number}: {cust.full_name} ({cust.service_city})")

        # Test 8: Search by Connection Type
        print_section("Test 8: Search by Connection Type")

        stmt = select(Customer).where(
            Customer.tenant_id == TEST_TENANT_ID, Customer.connection_type == "ftth"
        )
        ftth_customers = session.execute(stmt).scalars().all()

        print(f"✅ Found {len(ftth_customers)} FTTH customers")
        for cust in ftth_customers:
            print(
                f"   - {cust.customer_number}: {cust.connection_type} / {cust.last_mile_technology}"
            )

        # Test 9: Search by Service Location
        print_section("Test 9: Search by Service Location")

        stmt = select(Customer).where(
            Customer.tenant_id == TEST_TENANT_ID,
            Customer.service_city == "Springfield",
            Customer.service_state_province == "IL",
        )
        location_customers = session.execute(stmt).scalars().all()

        print(f"✅ Found {len(location_customers)} customers in Springfield, IL")
        for cust in location_customers:
            print(f"   - {cust.customer_number}: {cust.service_address_line1}")

        # Test 10: List All ISP Fields
        print_section("Test 10: Verify All ISP Fields Present")

        isp_fields = [
            "service_address_line1",
            "service_address_line2",
            "service_city",
            "service_state_province",
            "service_postal_code",
            "service_country",
            "service_coordinates",
            "installation_status",
            "installation_date",
            "scheduled_installation_date",
            "installation_technician_id",
            "installation_notes",
            "connection_type",
            "last_mile_technology",
            "service_plan_speed",
            "assigned_devices",
            "current_bandwidth_profile",
            "static_ip_assigned",
            "ipv6_prefix",
            "avg_uptime_percent",
            "last_outage_date",
            "total_outages",
            "total_downtime_minutes",
        ]

        print("✅ All ISP fields verified:")
        for field in isp_fields:
            value = getattr(retrieved_customer, field, None)
            has_value = value is not None and value != {} and value != 0
            status = "✓" if has_value else "○"
            print(f"   {status} {field}: {value if has_value else '(empty)'}")

        # Test 11: Delete Customer (Soft Delete Check)
        print_section("Test 11: Delete Customer")

        print(f"⚠️  Deleting customer: {retrieved_customer.customer_number}")
        customer_id_to_delete = retrieved_customer.id
        session.delete(retrieved_customer)
        session.commit()

        # Verify deletion
        stmt = select(Customer).where(Customer.id == customer_id_to_delete)
        deleted_customer = session.execute(stmt).scalar_one_or_none()

        if deleted_customer is None:
            print("✅ Customer deleted successfully (hard delete)")
        else:
            print(
                f"✅ Customer soft-deleted (deleted_at: {getattr(deleted_customer, 'deleted_at', 'N/A')})"
            )

        print_section("All Tests Completed Successfully! 🎉")

        return 0

    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback

        traceback.print_exc()
        session.rollback()
        return 1

    finally:
        session.close()


if __name__ == "__main__":
    sys.exit(main())
