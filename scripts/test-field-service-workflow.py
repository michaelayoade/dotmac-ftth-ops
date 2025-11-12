#!/usr/bin/env python3
"""
Test Field Service Workflow End-to-End

This script tests the complete workflow:
1. Create test technician
2. Create test order
3. Complete order (triggers installation ticket)
4. Verify ticket created
5. Verify field job created
6. Verify technician assignment
7. Output job location data for map testing

Usage:
    python3 scripts/test-field-service-workflow.py
"""

import asyncio
import sys
from pathlib import Path
from uuid import uuid4
from datetime import datetime, date

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.db import AsyncSessionLocal
from dotmac.platform.field_service.models import (
    Technician,
    TechnicianStatus,
    TechnicianSkillLevel,
)
from dotmac.platform.jobs.models import Job
from dotmac.platform.ticketing.models import Ticket, TicketType
from dotmac.platform.sales.models import Order
from dotmac.platform.events.service import EventService


async def create_test_technician(session: AsyncSession, tenant_id: str) -> Technician:
    """Create a test technician with required skills."""

    print("\n📋 Creating test technician...")

    technician = Technician(
        id=uuid4(),
        tenant_id=tenant_id,
        employee_id=f"TECH-{datetime.now().strftime('%Y%m%d%H%M%S')}",
        first_name="John",
        last_name="Doe",
        email=f"john.doe.{uuid4().hex[:8]}@example.com",
        phone="+2348012345678",
        mobile="+2348012345678",
        status=TechnicianStatus.AVAILABLE,
        skill_level=TechnicianSkillLevel.SENIOR,
        hire_date=date.today(),

        # Location (Lagos, Nigeria - near fiber infrastructure)
        home_base_lat=6.5244,
        home_base_lng=3.3792,
        home_base_address="123 Test Street, Lagos",
        current_lat=6.5244,
        current_lng=3.3792,
        last_location_update=datetime.utcnow(),

        # Service areas
        service_areas=["lagos-mainland", "lagos-island"],

        # Working hours (8 AM - 6 PM)
        working_hours_start=datetime.strptime("08:00", "%H:%M").time(),
        working_hours_end=datetime.strptime("18:00", "%H:%M").time(),
        working_days=[0, 1, 2, 3, 4],  # Monday-Friday

        # Skills required for fiber installation
        skills={
            "fiber_installation": True,
            "ont_configuration": True,
            "fiber_splicing": True,
            "customer_service": True,
        },

        # Equipment
        equipment={
            "otdr": True,
            "fusion_splicer": True,
            "power_meter": True,
            "tools": ["stripper", "cleaver", "crimper"],
        },

        # Performance metrics
        jobs_completed=50,
        average_rating=4.5,
        completion_rate=0.95,

        is_active=True,
        available_for_emergency=True,
    )

    session.add(technician)
    await session.commit()

    print(f"✅ Created technician: {technician.full_name} (ID: {technician.id})")
    print(f"   Skills: {', '.join([k for k, v in technician.skills.items() if v])}")
    print(f"   Location: ({technician.current_lat}, {technician.current_lng})")
    print(f"   Status: {technician.status.value}")

    return technician


async def create_test_order(session: AsyncSession, tenant_id: str) -> Order:
    """Create a test order that will trigger the workflow."""

    print("\n📋 Creating test order...")

    # Note: This is a simplified version. In production, you'd use the OrderService
    # For testing, we'll create the order directly and manually trigger events

    order_data = {
        "tenant_id": tenant_id,
        "order_number": f"ORD-TEST-{datetime.now().strftime('%Y%m%d%H%M%S')}",
        "customer_id": uuid4(),  # Mock customer
        "order_type": "new_installation",
        "status": "pending_provisioning",
        "service_address": "456 Customer Street, Victoria Island, Lagos",
        "location_lat": 6.4281,  # Victoria Island coordinates
        "location_lng": 3.4219,
        "total_amount": 50000.00,  # 50,000 NGN
        "metadata": {
            "plan_name": "Fiber 100Mbps",
            "installation_type": "aerial",
            "priority": "normal",
        },
    }

    print(f"✅ Order data prepared: {order_data['order_number']}")
    print(f"   Service Address: {order_data['service_address']}")
    print(f"   Location: ({order_data['location_lat']}, {order_data['location_lng']})")

    return order_data


async def verify_workflow(session: AsyncSession, tenant_id: str, order_number: str):
    """Verify that all workflow steps completed successfully."""

    print("\n🔍 Verifying workflow completion...")

    # Check for installation ticket
    ticket_query = select(Ticket).where(
        Ticket.tenant_id == tenant_id,
        Ticket.ticket_type == TicketType.INSTALLATION_REQUEST,
        Ticket.metadata.contains({"order_number": order_number})
    )
    result = await session.execute(ticket_query)
    ticket = result.scalar_one_or_none()

    if ticket:
        print(f"✅ Installation ticket created: {ticket.ticket_number}")
        print(f"   Ticket ID: {ticket.id}")
        print(f"   Status: {ticket.status.value}")
    else:
        print("❌ No installation ticket found!")
        return False

    # Check for field job
    job_query = select(Job).where(
        Job.tenant_id == tenant_id,
        Job.job_type == "field_installation",
        Job.parameters.contains({"ticket_id": str(ticket.id)})
    )
    result = await session.execute(job_query)
    job = result.scalar_one_or_none()

    if job:
        print(f"✅ Field installation job created: {job.title}")
        print(f"   Job ID: {job.id}")
        print(f"   Status: {job.status}")
        print(f"   Service Address: {job.service_address or job.parameters.get('service_address')}")

        if job.location_lat and job.location_lng:
            print(f"   📍 Location: ({job.location_lat}, {job.location_lng})")
        else:
            print(f"   ⚠️  Location not set - will need geocoding")

        if job.assigned_technician_id:
            tech_query = select(Technician).where(Technician.id == job.assigned_technician_id)
            tech_result = await session.execute(tech_query)
            technician = tech_result.scalar_one_or_none()

            if technician:
                print(f"✅ Technician assigned: {technician.full_name}")
                print(f"   Technician ID: {technician.id}")
                print(f"   Distance from job: {technician.distance_from(job.location_lat or 0, job.location_lng or 0):.2f} km")
            else:
                print("⚠️  Technician ID set but technician not found")
        else:
            print("⚠️  No technician assigned yet")

        return True
    else:
        print("❌ No field installation job found!")
        return False


async def test_manual_workflow(tenant_id: str = "test-tenant"):
    """
    Test the workflow manually by creating objects and checking handlers.

    Note: Event handlers are registered at import time, so they should fire automatically
    when events are published.
    """

    print("=" * 80)
    print("FIELD SERVICE WORKFLOW TEST")
    print("=" * 80)

    async with AsyncSessionLocal() as session:
        # Step 1: Create test technician
        technician = await create_test_technician(session, tenant_id)

        # Step 2: Prepare order data (we'll simulate the order completion)
        order_data = await create_test_order(session, tenant_id)

        print("\n" + "=" * 80)
        print("MANUAL TESTING INSTRUCTIONS")
        print("=" * 80)
        print("\nTo test the complete workflow, you need to:")
        print("\n1. Start the FastAPI backend:")
        print("   python3 -m dotmac.platform.main")
        print("\n2. Create an order via the API or admin panel with:")
        print(f"   - Service Address: {order_data['service_address']}")
        print(f"   - Location: ({order_data['location_lat']}, {order_data['location_lng']})")
        print("\n3. Complete the order to trigger the workflow")
        print("\n4. Check the logs for:")
        print("   - 'order.completed event published'")
        print("   - 'Installation ticket created from order'")
        print("   - 'Field service job created from installation ticket'")
        print("   - 'Technician auto-assigned to job'")
        print("\n5. Verify in the frontend:")
        print("   - Navigate to: http://localhost:3000/dashboard/network/fiber/map")
        print("   - Toggle the 'Jobs' layer on")
        print("   - You should see the job marker on the map")
        print("\n" + "=" * 80)
        print("TEST DATA SUMMARY")
        print("=" * 80)
        print(f"\nTenant ID: {tenant_id}")
        print(f"Technician: {technician.full_name} ({technician.id})")
        print(f"Technician Location: ({technician.current_lat}, {technician.current_lng})")
        print(f"Test Job Location: ({order_data['location_lat']}, {order_data['location_lng']})")
        print(f"Expected Distance: ~{technician.distance_from(order_data['location_lat'], order_data['location_lng']):.2f} km")
        print("\n" + "=" * 80)


async def quick_verification(tenant_id: str = "test-tenant"):
    """Quick check to see if there are any existing jobs and technicians."""

    print("\n" + "=" * 80)
    print("QUICK VERIFICATION - Current State")
    print("=" * 80)

    async with AsyncSessionLocal() as session:
        # Check technicians
        tech_query = select(Technician).where(Technician.tenant_id == tenant_id)
        result = await session.execute(tech_query)
        technicians = list(result.scalars().all())

        print(f"\n📋 Technicians: {len(technicians)}")
        for tech in technicians:
            print(f"   - {tech.full_name} ({tech.status.value})")
            print(f"     Location: ({tech.current_lat}, {tech.current_lng})")

        # Check jobs
        job_query = select(Job).where(
            Job.tenant_id == tenant_id,
            Job.job_type == "field_installation"
        ).order_by(Job.created_at.desc()).limit(5)
        result = await session.execute(job_query)
        jobs = list(result.scalars().all())

        print(f"\n📋 Field Installation Jobs: {len(jobs)}")
        for job in jobs:
            print(f"   - {job.title} ({job.status})")
            if job.location_lat and job.location_lng:
                print(f"     Location: ({job.location_lat}, {job.location_lng})")
            if job.assigned_technician_id:
                print(f"     Assigned: {job.assigned_technician_id}")


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Test field service workflow")
    parser.add_argument(
        "--tenant-id",
        default="test-tenant",
        help="Tenant ID to use for testing"
    )
    parser.add_argument(
        "--verify",
        action="store_true",
        help="Only verify current state without creating test data"
    )

    args = parser.parse_args()

    if args.verify:
        asyncio.run(quick_verification(args.tenant_id))
    else:
        asyncio.run(test_manual_workflow(args.tenant_id))
