"""Smoke tests for BSS Phase 1: ISP Customer Fields, Enhanced Ticketing, Dunning, and Usage Billing.

These tests verify basic functionality of all Phase 1 features:
1. ISP Customer Fields - Service location, installation tracking, network assignments
2. Enhanced Ticketing - ISP-specific ticket types, SLA tracking, escalation
3. Dunning & Collections - Campaign creation, execution lifecycle
4. Usage Billing - Usage record creation, aggregation

Smoke tests are intentionally simple and fast, focusing on the "happy path"
to ensure all features are wired up correctly.
"""

from datetime import UTC, datetime, timedelta
from decimal import Decimal
from uuid import uuid4

import pytest
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.billing.dunning.models import (
    DunningActionType,
    DunningExecutionStatus,
)
from dotmac.platform.billing.dunning.schemas import (
    DunningActionConfig,
    DunningCampaignCreate,
)
from dotmac.platform.billing.dunning.service import DunningService
from dotmac.platform.billing.usage.models import (
    BilledStatus,
    UsageAggregate,
    UsageRecord,
    UsageType,
)
from dotmac.platform.customer_management.models import Customer
from dotmac.platform.ticketing.models import (
    Ticket,
    TicketActorType,
    TicketPriority,
    TicketStatus,
    TicketType,
)


@pytest.mark.asyncio
@pytest.mark.integration
class TestISPCustomerFieldsSmoke:
    """Smoke tests for ISP customer fields."""

    async def test_create_customer_with_isp_fields(
        self, async_session: AsyncSession, smoke_test_tenant, smoke_test_technician
    ):
        """Test creating customer with ISP-specific fields."""
        tenant_id = smoke_test_tenant.id
        user_id = smoke_test_technician.id
        unique_id = str(uuid4())[:8]

        # Create customer with ISP fields
        customer = Customer(
            tenant_id=tenant_id,
            customer_number=f"CUST-{unique_id.upper()}",
            email=f"isp.customer.{unique_id}@example.com",
            first_name="John",
            last_name="Doe",
            phone="+1234567890",
            # ISP-specific fields
            service_address_line1="123 Main St, Springfield, IL 62701",
            scheduled_installation_date=datetime.now(UTC) + timedelta(days=7),
            installation_status="scheduled",
            installation_technician_id=user_id,
            installation_notes="Customer prefers morning installation",
            connection_type="fiber",
            service_plan_speed="100mbps",
            static_ip_assigned="192.168.1.100",
            # Device info stored in assigned_devices JSON field
            assigned_devices={
                "router_mac": "AA:BB:CC:DD:EE:FF",
                "ont_serial": "ONT-123456789",
            },
            created_by=str(user_id),
        )

        async_session.add(customer)
        await async_session.flush()
        await async_session.refresh(customer)

        # Verify customer created with all ISP fields
        assert customer.id is not None
        assert customer.service_address_line1 == "123 Main St, Springfield, IL 62701"
        assert customer.installation_status == "scheduled"
        assert customer.connection_type == "fiber"
        assert customer.service_plan_speed == "100mbps"
        assert customer.static_ip_assigned == "192.168.1.100"
        assert customer.assigned_devices["router_mac"] == "AA:BB:CC:DD:EE:FF"
        assert customer.assigned_devices["ont_serial"] == "ONT-123456789"

    async def test_query_customers_by_service_location(
        self, async_session: AsyncSession, smoke_test_tenant
    ):
        """Test querying customers by service location (index test)."""
        tenant_id = smoke_test_tenant.id
        unique_id = str(uuid4())[:8]

        # Create customers with different locations
        customer1 = Customer(
            tenant_id=tenant_id,
            customer_number=f"CUST-{unique_id.upper()}-1",
            email=f"customer1.{unique_id}@example.com",
            first_name="Customer",
            last_name="One",
            service_address_line1="123 Main St, Springfield, IL",
        )
        customer2 = Customer(
            tenant_id=tenant_id,
            customer_number=f"CUST-{unique_id.upper()}-2",
            email=f"customer2.{unique_id}@example.com",
            first_name="Customer",
            last_name="Two",
            service_address_line1="456 Oak Ave, Springfield, IL",
        )

        async_session.add_all([customer1, customer2])
        await async_session.flush()

        # Query by service location (tests index: ix_customer_service_location)
        # Filter by unique_id to only get customers from this test run
        result = await async_session.execute(
            select(Customer).where(
                Customer.tenant_id == tenant_id,
                Customer.service_address_line1.ilike("%Springfield%"),
                Customer.customer_number.like(f"CUST-{unique_id.upper()}%"),
            )
        )
        customers = result.scalars().all()

        assert len(customers) == 2

    async def test_query_customers_by_installation_status(
        self, async_session: AsyncSession, smoke_test_tenant
    ):
        """Test querying customers by installation status (index test)."""
        tenant_id = smoke_test_tenant.id
        unique_id = str(uuid4())[:8]

        # Create customers with different installation statuses
        customer_scheduled = Customer(
            tenant_id=tenant_id,
            customer_number=f"CUST-{unique_id.upper()}-SCHED",
            email=f"scheduled.{unique_id}@example.com",
            first_name="Scheduled",
            last_name="Customer",
            installation_status="scheduled",
        )
        customer_completed = Customer(
            tenant_id=tenant_id,
            customer_number=f"CUST-{unique_id.upper()}-COMPL",
            email=f"completed.{unique_id}@example.com",
            first_name="Completed",
            last_name="Customer",
            installation_status="completed",
        )

        async_session.add_all([customer_scheduled, customer_completed])
        await async_session.flush()

        # Query by installation status (tests index: ix_customer_installation_status)
        # Filter by unique_id to only get customers from this test run
        result = await async_session.execute(
            select(Customer).where(
                Customer.tenant_id == tenant_id,
                Customer.installation_status == "scheduled",
                Customer.customer_number.like(f"CUST-{unique_id.upper()}%"),
            )
        )
        customers = result.scalars().all()

        assert len(customers) == 1
        assert customers[0].installation_status == "scheduled"


@pytest.mark.asyncio
@pytest.mark.integration
class TestEnhancedTicketingSmoke:
    """Smoke tests for enhanced ticketing with ISP fields."""

    async def test_create_ticket_with_isp_fields(
        self, async_session: AsyncSession, smoke_test_customer, smoke_test_tenant
    ):
        """Test creating ticket with ISP-specific fields."""
        tenant_id = smoke_test_tenant.id
        user_id = uuid4()

        # Create ISP-specific ticket
        ticket = Ticket(
            tenant_id=tenant_id,
            ticket_number=f"TKT-{uuid4().hex[:8].upper()}",
            customer_id=smoke_test_customer.id,
            subject="Internet Connection Issue",
            status=TicketStatus.OPEN,
            priority=TicketPriority.HIGH,
            origin_type=TicketActorType.CUSTOMER,
            target_type=TicketActorType.TENANT,
            # ISP-specific fields
            ticket_type=TicketType.OUTAGE_REPORT,
            service_address="123 Main St, Springfield, IL",
            affected_services=["internet", "voip"],
            device_serial_numbers=["ONT-123456", "ROUTER-789012"],
            # SLA tracking
            sla_due_date=datetime.now(UTC) + timedelta(hours=4),
            sla_breached=False,
            # Escalation
            escalation_level=0,
            # Store description in context JSON
            context={"description": "Customer reports intermittent connectivity"},
            created_by=str(user_id),
        )

        async_session.add(ticket)
        await async_session.flush()
        await async_session.refresh(ticket)

        # Verify ticket created with ISP fields
        assert ticket.id is not None
        assert ticket.ticket_type == TicketType.OUTAGE_REPORT
        assert ticket.service_address == "123 Main St, Springfield, IL"
        assert ticket.affected_services == ["internet", "voip"]
        assert len(ticket.device_serial_numbers) == 2
        assert ticket.sla_due_date is not None
        assert ticket.escalation_level == 0

    async def test_sla_breach_detection(
        self, async_session: AsyncSession, smoke_test_customer, smoke_test_tenant
    ):
        """Test SLA breach detection and tracking."""
        tenant_id = smoke_test_tenant.id
        unique_id = uuid4().hex[:8].upper()

        # Create ticket with past SLA due date
        ticket = Ticket(
            tenant_id=tenant_id,
            ticket_number=f"TKT-SLA-{unique_id}",
            customer_id=smoke_test_customer.id,
            subject="SLA Test",
            status=TicketStatus.OPEN,
            priority=TicketPriority.NORMAL,
            origin_type=TicketActorType.CUSTOMER,
            target_type=TicketActorType.TENANT,
            ticket_type=TicketType.TECHNICAL_SUPPORT,
            sla_due_date=datetime.now(UTC) - timedelta(hours=1),  # Past due
            sla_breached=True,
        )

        async_session.add(ticket)
        await async_session.flush()

        # Query breached SLA tickets
        # Filter by unique_id to isolate this test's data
        result = await async_session.execute(
            select(Ticket).where(
                Ticket.tenant_id == tenant_id,
                Ticket.sla_breached == True,  # noqa: E712
                Ticket.ticket_number.like(f"%{unique_id}%"),
            )
        )
        breached_tickets = result.scalars().all()

        assert len(breached_tickets) == 1
        assert breached_tickets[0].sla_breached is True

    async def test_ticket_escalation(
        self, async_session: AsyncSession, smoke_test_customer, smoke_test_tenant
    ):
        """Test ticket escalation workflow."""
        tenant_id = smoke_test_tenant.id
        unique_id = uuid4().hex[:8].upper()
        escalated_to_user = uuid4()

        # Create escalated ticket
        ticket = Ticket(
            tenant_id=tenant_id,
            ticket_number=f"TKT-ESC-{unique_id}",
            customer_id=smoke_test_customer.id,
            subject="Escalated Issue",
            status=TicketStatus.IN_PROGRESS,
            priority=TicketPriority.URGENT,
            origin_type=TicketActorType.CUSTOMER,
            target_type=TicketActorType.TENANT,
            ticket_type=TicketType.TECHNICAL_SUPPORT,
            escalation_level=2,  # L2 support
            escalated_at=datetime.now(UTC),
            escalated_to_user_id=escalated_to_user,
        )

        async_session.add(ticket)
        await async_session.flush()

        # Query escalated tickets
        # Filter by unique_id to isolate this test's data
        result = await async_session.execute(
            select(Ticket).where(
                Ticket.tenant_id == tenant_id,
                Ticket.escalation_level > 0,
                Ticket.ticket_number.like(f"%{unique_id}%"),
            )
        )
        escalated_tickets = result.scalars().all()

        assert len(escalated_tickets) == 1
        assert escalated_tickets[0].escalation_level == 2
        assert escalated_tickets[0].escalated_to_user_id == escalated_to_user


@pytest.mark.asyncio
@pytest.mark.integration
class TestDunningSmoke:
    """Smoke tests for dunning & collections."""

    async def test_create_dunning_campaign(self, async_session: AsyncSession, smoke_test_tenant):
        """Test creating a dunning campaign."""
        tenant_id = smoke_test_tenant.id
        user_id = uuid4()

        service = DunningService(async_session)

        # Create campaign
        campaign_data = DunningCampaignCreate(
            name="Smoke Test Campaign",
            description="Test dunning campaign",
            trigger_after_days=7,
            max_retries=3,
            retry_interval_days=3,
            actions=[
                DunningActionConfig(
                    type=DunningActionType.EMAIL, delay_days=0, template="reminder_1"
                ),
                DunningActionConfig(
                    type=DunningActionType.EMAIL, delay_days=3, template="reminder_2"
                ),
                DunningActionConfig(type=DunningActionType.SUSPEND_SERVICE, delay_days=7),
            ],
            priority=5,
            is_active=True,
        )

        campaign = await service.create_campaign(
            tenant_id=tenant_id, data=campaign_data, created_by_user_id=user_id
        )

        await async_session.flush()

        # Verify campaign created
        assert campaign.id is not None
        assert campaign.name == "Smoke Test Campaign"
        assert campaign.trigger_after_days == 7
        assert len(campaign.actions) == 3
        assert campaign.is_active is True

    async def test_start_dunning_execution(self, async_session: AsyncSession, smoke_test_tenant):
        """Test starting a dunning execution."""
        tenant_id = smoke_test_tenant.id
        user_id = uuid4()
        unique_id = str(uuid4())[:8]  # Add unique ID for data isolation

        service = DunningService(async_session)

        # Create campaign first
        campaign_data = DunningCampaignCreate(
            name="Test Campaign",
            trigger_after_days=7,
            actions=[
                DunningActionConfig(
                    type=DunningActionType.EMAIL, delay_days=0, template="reminder"
                ),
            ],
        )

        campaign = await service.create_campaign(
            tenant_id=tenant_id, data=campaign_data, created_by_user_id=user_id
        )
        await async_session.flush()

        # Start execution
        execution = await service.start_execution(
            campaign_id=campaign.id,
            tenant_id=tenant_id,
            subscription_id=f"sub_smoke_test_{unique_id}",  # Unique per test run
            customer_id=uuid4(),
            invoice_id=f"inv_smoke_test_{unique_id}",  # Unique per test run
            outstanding_amount=10000,  # $100.00
        )

        await async_session.flush()

        # Verify execution started
        assert execution.id is not None
        assert execution.campaign_id == campaign.id
        assert execution.status == DunningExecutionStatus.PENDING
        assert execution.outstanding_amount == 10000
        assert execution.current_step == 0
        assert execution.next_action_at is not None

    async def test_get_campaign_stats(self, async_session: AsyncSession, smoke_test_tenant):
        """Test retrieving campaign statistics."""
        tenant_id = smoke_test_tenant.id
        user_id = uuid4()

        service = DunningService(async_session)

        # Create campaign
        campaign_data = DunningCampaignCreate(
            name="Stats Test Campaign",
            trigger_after_days=7,
            actions=[
                DunningActionConfig(
                    type=DunningActionType.EMAIL, delay_days=0, template="reminder"
                ),
            ],
        )

        campaign = await service.create_campaign(
            tenant_id=tenant_id, data=campaign_data, created_by_user_id=user_id
        )
        await async_session.flush()

        # Get stats
        stats = await service.get_campaign_stats(campaign_id=campaign.id, tenant_id=tenant_id)

        # Verify stats returned
        assert stats.campaign_id == campaign.id
        assert stats.campaign_name == "Stats Test Campaign"
        assert stats.total_executions == 0
        assert stats.success_rate >= 0


@pytest.mark.asyncio
@pytest.mark.integration
class TestUsageBillingSmoke:
    """Smoke tests for usage billing."""

    async def test_create_usage_record(
        self, async_session: AsyncSession, smoke_test_customer, smoke_test_tenant
    ):
        """Test creating a usage record."""
        tenant_id = smoke_test_tenant.id
        user_id = uuid4()
        unique_id = str(uuid4())[:8]

        # Create usage record
        usage = UsageRecord(
            tenant_id=tenant_id,
            subscription_id=f"sub_smoke_{unique_id}",
            customer_id=smoke_test_customer.id,
            usage_type=UsageType.DATA_TRANSFER,
            quantity=Decimal("15.5"),  # 15.5 GB
            unit="GB",
            unit_price=Decimal("10.00"),  # $0.10 per GB
            total_amount=155,  # $1.55 in cents
            currency="USD",
            period_start=datetime.now(UTC) - timedelta(days=1),
            period_end=datetime.now(UTC),
            billed_status=BilledStatus.PENDING,
            source_system="radius",
            source_record_id="radius_12345",
            description="Internet data usage",
            created_by=str(
                user_id
            ),  # AuditMixin provides created_by (string), not created_by_user_id
        )

        async_session.add(usage)
        await async_session.flush()
        await async_session.refresh(usage)

        # Verify usage record created
        assert usage.id is not None
        assert usage.usage_type == UsageType.DATA_TRANSFER
        assert usage.quantity == Decimal("15.5")
        assert usage.total_amount == 155
        assert usage.billed_status == BilledStatus.PENDING

    async def test_query_usage_by_subscription(
        self, async_session: AsyncSession, smoke_test_customer, smoke_test_tenant
    ):
        """Test querying usage records by subscription (index test)."""
        tenant_id = smoke_test_tenant.id
        unique_id = str(uuid4())[:8]
        subscription_id = f"sub_test_{unique_id}"

        # Create multiple usage records
        usage1 = UsageRecord(
            tenant_id=tenant_id,
            subscription_id=subscription_id,
            customer_id=smoke_test_customer.id,
            usage_type=UsageType.DATA_TRANSFER,
            quantity=Decimal("10.0"),
            unit="GB",
            unit_price=Decimal("10.00"),
            total_amount=100,
            period_start=datetime.now(UTC) - timedelta(days=1),
            period_end=datetime.now(UTC),
            billed_status=BilledStatus.PENDING,
            source_system="api",
        )
        usage2 = UsageRecord(
            tenant_id=tenant_id,
            subscription_id=subscription_id,
            customer_id=smoke_test_customer.id,
            usage_type=UsageType.VOICE_MINUTES,
            quantity=Decimal("120.0"),
            unit="minutes",
            unit_price=Decimal("0.05"),
            total_amount=600,
            period_start=datetime.now(UTC) - timedelta(days=1),
            period_end=datetime.now(UTC),
            billed_status=BilledStatus.PENDING,
            source_system="api",
        )

        async_session.add_all([usage1, usage2])
        await async_session.flush()

        # Query by subscription (tests index: ix_usage_records_subscription)
        result = await async_session.execute(
            select(UsageRecord).where(
                UsageRecord.tenant_id == tenant_id,
                UsageRecord.subscription_id == subscription_id,
            )
        )
        records = result.scalars().all()

        assert len(records) == 2

    async def test_query_pending_usage(
        self, async_session: AsyncSession, smoke_test_customer, smoke_test_tenant
    ):
        """Test querying pending usage records for billing."""
        tenant_id = smoke_test_tenant.id
        unique_id = str(uuid4())[:8]

        # Create usage records with different statuses
        pending_usage = UsageRecord(
            tenant_id=tenant_id,
            subscription_id=f"sub_pending_{unique_id}",
            customer_id=smoke_test_customer.id,
            usage_type=UsageType.OVERAGE_GB,
            quantity=Decimal("5.0"),
            unit="GB",
            unit_price=Decimal("20.00"),
            total_amount=100,
            period_start=datetime.now(UTC) - timedelta(days=1),
            period_end=datetime.now(UTC),
            billed_status=BilledStatus.PENDING,
            source_system="radius",
        )
        billed_usage = UsageRecord(
            tenant_id=tenant_id,
            subscription_id=f"sub_billed_{unique_id}",
            customer_id=smoke_test_customer.id,
            usage_type=UsageType.DATA_TRANSFER,
            quantity=Decimal("10.0"),
            unit="GB",
            unit_price=Decimal("10.00"),
            total_amount=100,
            period_start=datetime.now(UTC) - timedelta(days=2),
            period_end=datetime.now(UTC) - timedelta(days=1),
            billed_status=BilledStatus.BILLED,
            invoice_id="inv_123",
            billed_at=datetime.now(UTC),
            source_system="radius",
        )

        async_session.add_all([pending_usage, billed_usage])
        await async_session.flush()

        # Query pending usage (tests index: ix_usage_records_billed_status)
        # Filter by unique_id to isolate this test's data
        result = await async_session.execute(
            select(UsageRecord).where(
                UsageRecord.tenant_id == tenant_id,
                UsageRecord.billed_status == BilledStatus.PENDING,
                UsageRecord.subscription_id.like(f"%_{unique_id}"),
            )
        )
        pending_records = result.scalars().all()

        assert len(pending_records) == 1
        assert pending_records[0].billed_status == BilledStatus.PENDING

    async def test_create_usage_aggregate(self, async_session: AsyncSession, smoke_test_tenant):
        """Test creating usage aggregate for reporting."""
        tenant_id = smoke_test_tenant.id
        unique_id = str(uuid4())[:8]
        subscription_id = f"sub_agg_{unique_id}"

        # Create aggregate
        aggregate = UsageAggregate(
            tenant_id=tenant_id,
            subscription_id=subscription_id,
            customer_id=uuid4(),
            usage_type=UsageType.DATA_TRANSFER,
            period_start=datetime.now(UTC).replace(hour=0, minute=0, second=0, microsecond=0),
            period_end=datetime.now(UTC).replace(hour=23, minute=59, second=59, microsecond=999999),
            period_type="daily",
            total_quantity=Decimal("250.5"),  # Total GB for the day
            total_amount=2505,  # $25.05
            record_count=15,
            min_quantity=Decimal("10.0"),
            max_quantity=Decimal("50.0"),
        )

        async_session.add(aggregate)
        await async_session.flush()
        await async_session.refresh(aggregate)

        # Verify aggregate created
        assert aggregate.id is not None
        assert aggregate.total_quantity == Decimal("250.5")
        assert aggregate.total_amount == 2505
        assert aggregate.record_count == 15
        assert aggregate.period_type == "daily"


@pytest.mark.asyncio
@pytest.mark.integration
@pytest.mark.serial_only
class TestDatabaseMigrations:
    """Smoke tests to verify all Phase 1 migrations are applied."""

    async def test_all_phase1_tables_exist(self, async_db_session: AsyncSession, postgres_only):
        """Test all Phase 1 tables exist in database."""
        # Query information_schema to check tables exist
        result = await async_db_session.execute(
            text(
                """
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_name IN (
                'customers',
                'tickets',
                'dunning_campaigns',
                'dunning_executions',
                'dunning_action_logs',
                'usage_records',
                'usage_aggregates'
            )
            ORDER BY table_name
            """
            )
        )
        tables = [row[0] for row in result.fetchall()]

        expected_tables = {
            "customers",
            "tickets",
            "dunning_campaigns",
            "dunning_executions",
            "dunning_action_logs",
            "usage_records",
            "usage_aggregates",
        }

        assert set(tables) == expected_tables

    async def test_isp_customer_columns_exist(self, async_db_session: AsyncSession, postgres_only):
        """Test ISP customer columns exist in customers table."""
        result = await async_db_session.execute(
            text(
                """
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'customers'
            AND column_name IN (
                'service_address_line1',
                'installation_status',
                'connection_type',
                'service_plan_speed',
                'static_ip_assigned',
                'assigned_devices',
                'current_bandwidth_profile'
            )
            ORDER BY column_name
            """
            )
        )
        columns = [row[0] for row in result.fetchall()]

        expected_columns = [
            "assigned_devices",
            "connection_type",
            "current_bandwidth_profile",
            "installation_status",
            "service_address_line1",
            "service_plan_speed",
            "static_ip_assigned",
        ]

        assert sorted(columns) == expected_columns

    async def test_ticket_isp_columns_exist(self, async_db_session: AsyncSession, postgres_only):
        """Test ISP ticket columns exist in tickets table."""
        result = await async_db_session.execute(
            text(
                """
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'tickets'
            AND column_name IN (
                'ticket_type',
                'service_address',
                'affected_services',
                'sla_due_date',
                'escalation_level'
            )
            ORDER BY column_name
            """
            )
        )
        columns = [row[0] for row in result.fetchall()]

        expected_columns = [
            "affected_services",
            "escalation_level",
            "service_address",
            "sla_due_date",
            "ticket_type",
        ]

        assert sorted(columns) == expected_columns
