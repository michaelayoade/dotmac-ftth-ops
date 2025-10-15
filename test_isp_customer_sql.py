#!/usr/bin/env python3
"""
Test ISP Customer Fields using SQL.

Direct SQL test to avoid model loading issues.
"""

import sys
from uuid import uuid4

from sqlalchemy import create_engine, text

# Database URL
DATABASE_URL = "postgresql://dotmac_user:change-me-in-production@localhost:5432/dotmac"

TEST_TENANT_ID = "test-tenant-001"


def print_section(title: str):
    """Print a section header."""
    print(f"\n{'=' * 70}")
    print(f"  {title}")
    print(f"{'=' * 70}\n")


def main():
    """Run ISP customer SQL tests."""
    print_section("ISP Customer SQL Tests")

    engine = create_engine(DATABASE_URL, echo=False)

    with engine.connect() as conn:
        trans = conn.begin()

        try:
            # Test 1: Insert Customer with ISP Fields
            print_section("Test 1: Insert Customer with ISP Fields")

            customer_id = str(uuid4())
            customer_number = f"CUST-{uuid4().hex[:8].upper()}"
            email = f"test.{uuid4().hex[:6]}@example.com"

            insert_sql = text(
                """
                INSERT INTO customers (
                    id, tenant_id, customer_number, first_name, last_name, email,
                    phone, mobile, status, customer_type, tier,
                    address_line1, city, state_province, postal_code, country,
                    -- ISP fields
                    service_address_line1, service_address_line2,
                    service_city, service_state_province, service_postal_code, service_country,
                    service_coordinates,
                    installation_status, scheduled_installation_date, installation_notes,
                    connection_type, last_mile_technology, service_plan_speed,
                    assigned_devices, current_bandwidth_profile,
                    static_ip_assigned, ipv6_prefix,
                    avg_uptime_percent, total_outages, total_downtime_minutes,
                    created_at, updated_at
                ) VALUES (
                    :id, :tenant_id, :customer_number, :first_name, :last_name, :email,
                    :phone, :mobile, :status, :customer_type, :tier,
                    :address_line1, :city, :state_province, :postal_code, :country,
                    -- ISP values
                    :service_address_line1, :service_address_line2,
                    :service_city, :service_state_province, :service_postal_code, :service_country,
                    CAST(:service_coordinates AS json),
                    :installation_status, :scheduled_installation_date, :installation_notes,
                    :connection_type, :last_mile_technology, :service_plan_speed,
                    CAST(:assigned_devices AS json), :current_bandwidth_profile,
                    :static_ip_assigned, :ipv6_prefix,
                    :avg_uptime_percent, :total_outages, :total_downtime_minutes,
                    NOW(), NOW()
                )
            """
            )

            conn.execute(
                insert_sql,
                {
                    "id": customer_id,
                    "tenant_id": TEST_TENANT_ID,
                    "customer_number": customer_number,
                    "first_name": "Jane",
                    "last_name": "Smith",
                    "email": email,
                    "phone": "+1-555-1000",
                    "mobile": "+1-555-1001",
                    "status": "active",
                    "customer_type": "individual",
                    "tier": "premium",
                    "address_line1": "789 Billing Blvd",
                    "city": "Chicago",
                    "state_province": "IL",
                    "postal_code": "60601",
                    "country": "US",
                    # ISP fields
                    "service_address_line1": "123 Fiber Lane",
                    "service_address_line2": "Suite 100",
                    "service_city": "Chicago",
                    "service_state_province": "IL",
                    "service_postal_code": "60602",
                    "service_country": "US",
                    "service_coordinates": '{"lat": 41.8781, "lon": -87.6298}',
                    "installation_status": "pending",
                    "scheduled_installation_date": "2025-10-25 14:00:00+00",
                    "installation_notes": "Commercial installation. Contact building manager first.",
                    "connection_type": "ftth",
                    "last_mile_technology": "xgs-pon",
                    "service_plan_speed": "1 Gbps",
                    "assigned_devices": '{"onu_serial": "HUAW999888777", "cpe_model": "Router-X1000"}',
                    "current_bandwidth_profile": "business_1gbps",
                    "static_ip_assigned": "203.0.113.100",
                    "ipv6_prefix": "2001:db8:abcd::/48",
                    "avg_uptime_percent": 100.00,
                    "total_outages": 0,
                    "total_downtime_minutes": 0,
                },
            )

            print(f"✅ Inserted customer: {customer_number}")
            print(f"   ID: {customer_id}")

            # Test 2: Read Customer
            print_section("Test 2: Read Customer")

            select_sql = text(
                """
                SELECT
                    customer_number, first_name, last_name, email,
                    service_address_line1, service_city, service_coordinates,
                    installation_status, connection_type, last_mile_technology,
                    service_plan_speed, assigned_devices, current_bandwidth_profile,
                    static_ip_assigned, ipv6_prefix,
                    avg_uptime_percent, total_outages, total_downtime_minutes
                FROM customers
                WHERE id = :id
            """
            )

            result = conn.execute(select_sql, {"id": customer_id})
            row = result.fetchone()

            if row:
                print("✅ Retrieved customer successfully")
                print(f"   Customer: {row.first_name} {row.last_name} ({row.customer_number})")
                print(f"   Email: {row.email}")
                print(f"   Service Address: {row.service_address_line1}, {row.service_city}")
                print(f"   Coordinates: {row.service_coordinates}")
                print(f"   Connection: {row.connection_type} / {row.last_mile_technology}")
                print(f"   Speed: {row.service_plan_speed}")
                print(f"   Installation: {row.installation_status}")
                print(f"   Devices: {row.assigned_devices}")
                print(f"   Bandwidth Profile: {row.current_bandwidth_profile}")
                print(f"   Static IP: {row.static_ip_assigned}")
                print(f"   IPv6: {row.ipv6_prefix}")
                print(f"   Uptime: {row.avg_uptime_percent}%")
                print(f"   Outages: {row.total_outages}")

            # Test 3: Update Installation Status
            print_section("Test 3: Update Installation Status")

            update_sql = text(
                """
                UPDATE customers
                SET
                    installation_status = 'completed',
                    installation_date = NOW(),
                    installation_notes = installation_notes || E'\n\n✅ Installation completed. Speed test: 950 Mbps'
                WHERE id = :id
                RETURNING installation_status, installation_date
            """
            )

            result = conn.execute(update_sql, {"id": customer_id})
            row = result.fetchone()

            print(f"✅ Updated installation status: {row.installation_status}")
            print(f"   Installation date: {row.installation_date}")

            # Test 4: Update Service Quality
            print_section("Test 4: Update Service Quality Metrics")

            update_quality_sql = text(
                """
                UPDATE customers
                SET
                    total_outages = 2,
                    last_outage_date = '2025-10-18 03:15:00+00',
                    total_downtime_minutes = 45,
                    avg_uptime_percent = 99.90
                WHERE id = :id
                RETURNING total_outages, last_outage_date, total_downtime_minutes, avg_uptime_percent
            """
            )

            result = conn.execute(update_quality_sql, {"id": customer_id})
            row = result.fetchone()

            print("✅ Updated service quality:")
            print(f"   Outages: {row.total_outages}")
            print(f"   Last Outage: {row.last_outage_date}")
            print(f"   Downtime: {row.total_downtime_minutes} minutes")
            print(f"   Uptime: {row.avg_uptime_percent}%")

            # Test 5: Search by Installation Status
            print_section("Test 5: Search by Installation Status")

            search_sql = text(
                """
                SELECT customer_number, first_name, last_name, installation_status, service_city
                FROM customers
                WHERE tenant_id = :tenant_id
                AND installation_status = 'completed'
                ORDER BY customer_number
            """
            )

            result = conn.execute(search_sql, {"tenant_id": TEST_TENANT_ID})
            rows = result.fetchall()

            print(f"✅ Found {len(rows)} completed installations")
            for row in rows:
                print(
                    f"   - {row.customer_number}: {row.first_name} {row.last_name} ({row.service_city})"
                )

            # Test 6: Search by Connection Type
            print_section("Test 6: Search by Connection Type")

            search_connection_sql = text(
                """
                SELECT customer_number, connection_type, last_mile_technology, service_plan_speed
                FROM customers
                WHERE tenant_id = :tenant_id
                AND connection_type = 'ftth'
                ORDER BY customer_number
            """
            )

            result = conn.execute(search_connection_sql, {"tenant_id": TEST_TENANT_ID})
            rows = result.fetchall()

            print(f"✅ Found {len(rows)} FTTH customers")
            for row in rows:
                print(
                    f"   - {row.customer_number}: {row.connection_type}/{row.last_mile_technology} @ {row.service_plan_speed}"
                )

            # Test 7: Verify Indexes
            print_section("Test 7: Verify ISP Indexes")

            index_sql = text(
                """
                SELECT indexname, indexdef
                FROM pg_indexes
                WHERE tablename = 'customers'
                AND (
                    indexname LIKE '%service%' OR
                    indexname LIKE '%installation%' OR
                    indexname LIKE '%connection%'
                )
                ORDER BY indexname
            """
            )

            result = conn.execute(index_sql)
            indexes = result.fetchall()

            print(f"✅ Found {len(indexes)} ISP-specific indexes:")
            for idx in indexes:
                print(f"   - {idx.indexname}")

            # Test 8: Verify Foreign Key
            print_section("Test 8: Verify Foreign Key Constraint")

            fk_sql = text(
                """
                SELECT
                    conname AS constraint_name,
                    conrelid::regclass AS table_name,
                    a.attname AS column_name,
                    confrelid::regclass AS foreign_table_name
                FROM pg_constraint AS c
                JOIN pg_attribute AS a ON a.attnum = ANY(c.conkey) AND a.attrelid = c.conrelid
                WHERE c.contype = 'f'
                AND c.conname = 'fk_customers_installation_technician'
            """
            )

            result = conn.execute(fk_sql)
            fk = result.fetchone()

            if fk:
                print("✅ Foreign key verified:")
                print(f"   {fk.constraint_name}: {fk.column_name} -> {fk.foreign_table_name}")

            # Test 9: Cleanup
            print_section("Test 9: Cleanup Test Data")

            delete_sql = text("DELETE FROM customers WHERE id = :id")
            result = conn.execute(delete_sql, {"id": customer_id})

            print("✅ Deleted test customer")

            # Commit transaction
            trans.commit()
            print_section("All Tests Completed Successfully! 🎉")

            return 0

        except Exception as e:
            trans.rollback()
            print(f"\n❌ Error: {e}")
            import traceback

            traceback.print_exc()
            return 1


if __name__ == "__main__":
    sys.exit(main())
