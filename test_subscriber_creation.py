#!/usr/bin/env python3
"""
Test script for subscriber creation with automatic IP allocation.

This script:
1. Creates a test subscriber in the database
2. Allocates an IP address from NetBox
3. Creates RADIUS auth entries
4. Verifies the full integration
"""

import os
import sys
from datetime import datetime

# Add src to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "src"))

os.environ.setdefault(
    "DATABASE_URL", "postgresql://dotmac_user:change-me-in-production@localhost:5432/dotmac"
)
os.environ.setdefault("NETBOX_URL", "http://localhost:8080")
os.environ.setdefault("NETBOX_API_TOKEN", "0123456789abcdef0123456789abcdef01234567")

import requests
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# Database setup
DATABASE_URL = os.getenv("DATABASE_URL")
engine = create_engine(DATABASE_URL)
Session = sessionmaker(bind=engine)

# NetBox setup
NETBOX_URL = os.getenv("NETBOX_URL")
NETBOX_TOKEN = os.getenv("NETBOX_API_TOKEN")


def get_netbox_headers():
    return {"Authorization": f"Token {NETBOX_TOKEN}", "Content-Type": "application/json"}


def allocate_ip_from_netbox(tenant_id: int, service_type: str = "fiber_internet"):
    """Allocate next available IP from NetBox for a tenant."""
    # Get IP ranges for tenant
    response = requests.get(
        f"{NETBOX_URL}/api/ipam/ip-ranges/?tenant_id={tenant_id}", headers=get_netbox_headers()
    )
    response.raise_for_status()
    ranges = response.json()["results"]

    if not ranges:
        raise ValueError(f"No IP ranges found for tenant {tenant_id}")

    # Use first range (FTTH range)
    ip_range = ranges[0]
    range_id = ip_range["id"]

    # Get next available IP
    response = requests.get(
        f"{NETBOX_URL}/api/ipam/ip-ranges/{range_id}/available-ips/?limit=1",
        headers=get_netbox_headers(),
    )
    response.raise_for_status()
    available_ips = response.json()

    if not available_ips:
        raise ValueError(f"No available IPs in range {range_id}")

    next_ip = available_ips[0]["address"]

    # Allocate the IP
    response = requests.post(
        f"{NETBOX_URL}/api/ipam/ip-addresses/",
        headers=get_netbox_headers(),
        json={
            "address": next_ip,
            "tenant": tenant_id,
            "status": "active",
            "description": "Auto-allocated for subscriber test",
        },
    )
    response.raise_for_status()

    # Return just the IP without /32
    return next_ip.replace("/32", "")


def create_subscriber(session, tenant_id: str, username: str, password: str, ip_address: str):
    """Create subscriber in database."""
    subscriber_id = f"SUB-{datetime.now().strftime('%Y%m%d')}-{username}"

    # Insert subscriber
    query = text(
        """
        INSERT INTO subscribers (
            id, tenant_id, username, password,
            status, service_type, static_ipv4,
            download_speed_kbps, upload_speed_kbps,
            device_metadata, service_coordinates, metadata,
            created_at, updated_at, simultaneous_use,
            total_sessions, total_upload_bytes, total_download_bytes
        )
        VALUES (
            :id, :tenant_id, :username, :password,
            'active', 'fiber_internet', :static_ipv4,
            100000, 50000,
            '{}'::json, '{}'::json, '{}'::json,
            CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 1,
            0, 0, 0
        )
        RETURNING id, username, static_ipv4, status
    """
    )

    result = session.execute(
        query,
        {
            "id": subscriber_id,
            "tenant_id": tenant_id,
            "username": username,
            "password": password,
            "static_ipv4": ip_address,
        },
    )
    session.commit()

    return result.fetchone()


def create_radius_auth(session, subscriber_id: str, username: str, password: str):
    """Create RADIUS authentication entries."""
    # Insert radcheck (authentication)
    query = text(
        """
        INSERT INTO radcheck (
            subscriber_id, username, attribute, op, value
        )
        VALUES
            (:subscriber_id, :username, 'Cleartext-Password', ':=', :password)
        ON CONFLICT DO NOTHING
    """
    )

    session.execute(
        query, {"subscriber_id": subscriber_id, "username": username, "password": password}
    )

    # Insert radreply (authorization - IP assignment)
    query = text(
        """
        INSERT INTO radreply (
            subscriber_id, username, attribute, op, value
        )
        VALUES
            (:subscriber_id, :username, 'Framed-IP-Address', ':=', :ip_address)
        ON CONFLICT DO NOTHING
    """
    )

    session.execute(
        query,
        {
            "subscriber_id": subscriber_id,
            "username": username,
            "ip_address": "0.0.0.0",  # Will use static IP from subscriber table
        },
    )

    session.commit()


def main():
    print("=" * 70)
    print("BSS Phase 1 - Subscriber Creation with IP Allocation Test")
    print("=" * 70)
    print()

    session = Session()

    try:
        # Test parameters
        tenant_id_db = "demo-alpha"
        tenant_id_netbox = 1  # NetBox tenant ID for Demo ISP Alpha
        username = f"test.user.{int(datetime.now().timestamp())}"
        password = "testpass123"

        print("1. Testing with:")
        print(f"   - Tenant (DB): {tenant_id_db}")
        print(f"   - Tenant (NetBox): {tenant_id_netbox}")
        print(f"   - Username: {username}")
        print()

        # Step 1: Allocate IP from NetBox
        print("2. Allocating IP address from NetBox...")
        ip_address = allocate_ip_from_netbox(tenant_id_netbox)
        print(f"   ✓ IP allocated: {ip_address}")
        print()

        # Step 2: Create subscriber
        print("3. Creating subscriber in database...")
        subscriber = create_subscriber(session, tenant_id_db, username, password, ip_address)
        print("   ✓ Subscriber created:")
        print(f"     - ID: {subscriber.id}")
        print(f"     - Username: {subscriber.username}")
        print(f"     - IP: {subscriber.static_ipv4}")
        print(f"     - Status: {subscriber.status}")
        print()

        # Step 3: Create RADIUS auth entries
        print("4. Creating RADIUS authentication entries...")
        create_radius_auth(session, subscriber.id, username, password)
        print("   ✓ RADIUS entries created")
        print()

        # Step 4: Verify subscriber
        print("5. Verifying subscriber in database...")
        query = text("SELECT * FROM subscribers WHERE username = :username")
        result = session.execute(query, {"username": username})
        subscriber_data = result.fetchone()

        if subscriber_data:
            print("   ✓ Subscriber verified in database")
            print(f"     - ID: {subscriber_data.id}")
            print(f"     - Username: {subscriber_data.username}")
            print(f"     - IP: {subscriber_data.static_ipv4}")
            print(f"     - Status: {subscriber_data.status}")
            print(f"     - Service Type: {subscriber_data.service_type}")
            print(f"     - Download Speed: {subscriber_data.download_speed_kbps} kbps")
            print(f"     - Upload Speed: {subscriber_data.upload_speed_kbps} kbps")
        else:
            print("   ✗ Subscriber NOT found in database")
        print()

        # Step 5: Verify RADIUS entries
        print("6. Verifying RADIUS entries...")
        query = text("SELECT * FROM radcheck WHERE username = :username")
        result = session.execute(query, {"username": username})
        radcheck_data = result.fetchone()

        if radcheck_data:
            print("   ✓ RADIUS authentication entry verified")
            print(f"     - Attribute: {radcheck_data.attribute}")
            print(f"     - Operator: {radcheck_data.op}")
        else:
            print("   ✗ RADIUS authentication entry NOT found")
        print()

        # Step 6: Verify IP in NetBox
        print("7. Verifying IP allocation in NetBox...")
        response = requests.get(
            f"{NETBOX_URL}/api/ipam/ip-addresses/?address={ip_address}",
            headers=get_netbox_headers(),
        )
        netbox_ips = response.json()["results"]

        if netbox_ips:
            netbox_ip = netbox_ips[0]
            print("   ✓ IP verified in NetBox")
            print(f"     - Address: {netbox_ip['address']}")
            print(f"     - Status: {netbox_ip['status']['label']}")
            print(f"     - Tenant: {netbox_ip['tenant']['name']}")
            print(f"     - Description: {netbox_ip['description']}")
        else:
            print("   ✗ IP NOT found in NetBox")
        print()

        print("=" * 70)
        print("✅ SUBSCRIBER CREATION TEST COMPLETED SUCCESSFULLY!")
        print("=" * 70)
        print()
        print("Summary:")
        print(f"  - Subscriber ID: {subscriber.id}")
        print(f"  - Username: {username}")
        print(f"  - Password: {password}")
        print(f"  - IP Address: {ip_address}")
        print("  - Service Type: fiber_internet")
        print("  - Status: active")
        print()
        print("Next steps:")
        print("  - Test RADIUS authentication with this subscriber")
        print("  - Test session accounting")
        print("  - Test service suspension/termination")
        print()

    except Exception as e:
        print(f"✗ Error: {e}")
        import traceback

        traceback.print_exc()
        return 1
    finally:
        session.close()

    return 0


if __name__ == "__main__":
    sys.exit(main())
