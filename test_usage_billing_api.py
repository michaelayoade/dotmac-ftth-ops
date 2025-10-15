#!/usr/bin/env python3
"""
Test script for Usage Billing API endpoints.

Tests CRUD operations, statistics, and aggregates for metered billing.
"""

import asyncio
from datetime import datetime, timedelta
from decimal import Decimal
from uuid import uuid4

from sqlalchemy.ext.asyncio import AsyncSession

from src.dotmac.platform.billing.usage.models import BilledStatus, UsageRecord, UsageType
from src.dotmac.platform.database import get_async_session


async def test_create_usage_record(
    db: AsyncSession, tenant_id: str, customer_id: str
) -> UsageRecord:
    """Test creating a usage record."""
    print("\n1. Testing usage record creation...")

    usage_record = UsageRecord(
        tenant_id=tenant_id,
        subscription_id="sub-test-001",
        customer_id=customer_id,
        usage_type=UsageType.DATA_TRANSFER,
        quantity=Decimal("150.5"),
        unit="GB",
        unit_price=Decimal("10.0"),  # $0.10/GB
        total_amount=1505,  # $15.05
        currency="USD",
        period_start=datetime.utcnow() - timedelta(hours=24),
        period_end=datetime.utcnow(),
        billed_status=BilledStatus.PENDING,
        source_system="test",
        source_record_id="test-001",
        description="Test data transfer usage",
        created_by="test-user",
    )

    db.add(usage_record)
    await db.commit()
    await db.refresh(usage_record)

    print(f"✅ Created usage record: {usage_record.id}")
    print(f"   Type: {usage_record.usage_type.value}")
    print(f"   Quantity: {usage_record.quantity} {usage_record.unit}")
    print(f"   Amount: ${usage_record.total_amount / 100:.2f}")

    return usage_record


async def test_create_multiple_records(
    db: AsyncSession, tenant_id: str, customer_id: str
) -> list[UsageRecord]:
    """Test creating multiple usage records of different types."""
    print("\n2. Testing bulk creation...")

    records = [
        UsageRecord(
            tenant_id=tenant_id,
            subscription_id="sub-test-001",
            customer_id=customer_id,
            usage_type=UsageType.VOICE_MINUTES,
            quantity=Decimal("120"),
            unit="minutes",
            unit_price=Decimal("5.0"),  # $0.05/min
            total_amount=600,  # $6.00
            currency="USD",
            period_start=datetime.utcnow() - timedelta(days=2),
            period_end=datetime.utcnow() - timedelta(days=1),
            billed_status=BilledStatus.BILLED,
            source_system="test",
            description="VoIP call minutes",
            created_by="test-user",
        ),
        UsageRecord(
            tenant_id=tenant_id,
            subscription_id="sub-test-002",
            customer_id=customer_id,
            usage_type=UsageType.OVERAGE_GB,
            quantity=Decimal("50"),
            unit="GB",
            unit_price=Decimal("20.0"),  # $0.20/GB overage
            total_amount=1000,  # $10.00
            currency="USD",
            period_start=datetime.utcnow() - timedelta(days=3),
            period_end=datetime.utcnow() - timedelta(days=2),
            billed_status=BilledStatus.PENDING,
            source_system="test",
            description="Data overage charges",
            created_by="test-user",
        ),
        UsageRecord(
            tenant_id=tenant_id,
            subscription_id="sub-test-001",
            customer_id=customer_id,
            usage_type=UsageType.EQUIPMENT_RENTAL,
            quantity=Decimal("1"),
            unit="month",
            unit_price=Decimal("500.0"),  # $5.00/month
            total_amount=500,  # $5.00
            currency="USD",
            period_start=datetime.utcnow() - timedelta(days=30),
            period_end=datetime.utcnow(),
            billed_status=BilledStatus.BILLED,
            source_system="test",
            description="ONT equipment rental",
            created_by="test-user",
        ),
    ]

    db.add_all(records)
    await db.commit()

    for record in records:
        await db.refresh(record)

    print(f"✅ Created {len(records)} usage records")
    for record in records:
        print(
            f"   - {record.usage_type.value}: ${record.total_amount / 100:.2f} ({record.billed_status.value})"
        )

    return records


async def test_query_usage_records(db: AsyncSession, tenant_id: str) -> None:
    """Test querying usage records with filters."""
    print("\n3. Testing query operations...")

    from sqlalchemy import select

    # Query all pending records
    query = select(UsageRecord).where(
        UsageRecord.tenant_id == tenant_id,
        UsageRecord.billed_status == BilledStatus.PENDING,
    )
    result = await db.execute(query)
    pending_records = list(result.scalars().all())

    print(f"✅ Found {len(pending_records)} pending records")
    for record in pending_records:
        print(f"   - {record.usage_type.value}: ${record.total_amount / 100:.2f}")

    # Query by usage type
    query = select(UsageRecord).where(
        UsageRecord.tenant_id == tenant_id,
        UsageRecord.usage_type == UsageType.DATA_TRANSFER,
    )
    result = await db.execute(query)
    data_records = list(result.scalars().all())

    print(f"✅ Found {len(data_records)} data transfer records")


async def test_update_usage_record(db: AsyncSession, record: UsageRecord) -> None:
    """Test updating a usage record."""
    print("\n4. Testing update operations...")

    # Update billing status
    record.billed_status = BilledStatus.BILLED
    record.billed_at = datetime.utcnow()
    record.invoice_id = "inv-test-001"
    record.updated_by = "test-user"

    await db.commit()
    await db.refresh(record)

    print(f"✅ Updated record {record.id}")
    print(f"   Status: {record.billed_status.value}")
    print(f"   Invoice: {record.invoice_id}")
    print(f"   Billed at: {record.billed_at}")


async def test_calculate_statistics(db: AsyncSession, tenant_id: str) -> None:
    """Test calculating usage statistics."""
    print("\n5. Testing statistics calculation...")

    from sqlalchemy import select

    query = select(UsageRecord).where(UsageRecord.tenant_id == tenant_id)
    result = await db.execute(query)
    all_records = list(result.scalars().all())

    total_records = len(all_records)
    total_amount = sum(r.total_amount for r in all_records)
    pending_amount = sum(
        r.total_amount for r in all_records if r.billed_status == BilledStatus.PENDING
    )
    billed_amount = sum(
        r.total_amount for r in all_records if r.billed_status == BilledStatus.BILLED
    )

    print("✅ Statistics calculated:")
    print(f"   Total records: {total_records}")
    print(f"   Total amount: ${total_amount / 100:.2f}")
    print(f"   Pending: ${pending_amount / 100:.2f}")
    print(f"   Billed: ${billed_amount / 100:.2f}")

    # Group by usage type
    by_type: dict[str, tuple[int, int]] = {}  # usage_type -> (count, amount)
    for record in all_records:
        usage_type = record.usage_type.value
        if usage_type not in by_type:
            by_type[usage_type] = (0, 0)
        count, amount = by_type[usage_type]
        by_type[usage_type] = (count + 1, amount + record.total_amount)

    print("\n   By usage type:")
    for usage_type, (count, amount) in by_type.items():
        print(f"   - {usage_type}: {count} records, ${amount / 100:.2f}")


async def test_delete_usage_record(db: AsyncSession, record: UsageRecord) -> None:
    """Test deleting a usage record."""
    print("\n6. Testing delete operations...")

    record_id = record.id

    # Only pending or excluded records can be deleted
    if record.billed_status == BilledStatus.BILLED:
        print(f"⚠️  Cannot delete billed record {record_id}")
        print("   Changing status to excluded instead...")
        record.billed_status = BilledStatus.EXCLUDED
        await db.commit()
    else:
        await db.delete(record)
        await db.commit()
        print(f"✅ Deleted record {record_id}")


async def main():
    """Run all tests."""
    print("=" * 60)
    print("Usage Billing API Test Suite")
    print("=" * 60)

    # Test tenant and customer IDs
    tenant_id = "test-tenant"
    customer_id = str(uuid4())

    # Get database session
    async for db in get_async_session():
        try:
            # Run tests
            record1 = await test_create_usage_record(db, tenant_id, customer_id)
            additional_records = await test_create_multiple_records(db, tenant_id, customer_id)
            await test_query_usage_records(db, tenant_id)
            await test_update_usage_record(db, record1)
            await test_calculate_statistics(db, tenant_id)

            # Clean up
            print("\n7. Cleaning up test data...")
            await test_delete_usage_record(db, record1)
            for record in additional_records:
                await test_delete_usage_record(db, record)

            print("\n" + "=" * 60)
            print("✅ All tests passed!")
            print("=" * 60)

        except Exception as e:
            print(f"\n❌ Test failed: {e}")
            import traceback

            traceback.print_exc()
        finally:
            await db.close()
        break


if __name__ == "__main__":
    asyncio.run(main())
