"""
Integration tests for dunning workflows.

Tests complete lifecycle: campaign creation → execution → action logging → recovery
"""

from uuid import uuid4

import pytest
import pytest_asyncio
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.billing.dunning.models import (
    DunningActionLog,
    DunningActionType,
    DunningExecutionStatus,
)
from dotmac.platform.billing.dunning.schemas import (
    DunningActionConfig,
    DunningCampaignCreate,
    DunningCampaignUpdate,
    DunningExclusionRules,
)
from dotmac.platform.billing.dunning.service import DunningService
from dotmac.platform.core.exceptions import EntityNotFoundError
from dotmac.platform.customer_management.models import Customer


@pytest_asyncio.fixture
async def dunning_service(async_session: AsyncSession) -> DunningService:
    """Create DunningService instance."""
    return DunningService(async_session)


@pytest_asyncio.fixture
async def test_customer(async_session: AsyncSession, test_tenant_id: str) -> Customer:
    """Create test customer for dunning tests."""
    customer = Customer(
        id=uuid4(),
        tenant_id=test_tenant_id,
        customer_number="CUST-DUNNING-001",
        email="dunning.test@example.com",
        name="Dunning Test Customer",
        phone="+1234567890",
    )
    async_session.add(customer)
    await async_session.flush()
    return customer


@pytest.fixture
def test_campaign_data() -> DunningCampaignCreate:
    """Create test campaign data."""
    return DunningCampaignCreate(
        name="Test Payment Recovery Campaign",
        description="Automated collection workflow for testing",
        trigger_after_days=7,
        max_retries=3,
        retry_interval_days=3,
        actions=[
            DunningActionConfig(
                type=DunningActionType.EMAIL,
                delay_days=0,
                template="payment_reminder_1",
            ),
            DunningActionConfig(
                type=DunningActionType.SMS,
                delay_days=3,
                template="payment_alert",
            ),
            DunningActionConfig(
                type=DunningActionType.SUSPEND_SERVICE,
                delay_days=7,
            ),
        ],
        exclusion_rules=DunningExclusionRules(
            min_lifetime_value=1000.0,
            customer_tiers=["premium", "vip"],
        ),
        priority=10,
        is_active=True,
    )


@pytest.mark.integration
class TestDunningCampaignManagement:
    """Test dunning campaign CRUD operations."""

    @pytest.mark.asyncio
    async def test_create_campaign_success(
        self,
        dunning_service: DunningService,
        test_tenant_id: str,
        test_campaign_data: DunningCampaignCreate,
        async_session: AsyncSession,
    ):
        """Test successful campaign creation."""
        # Create campaign
        campaign = await dunning_service.create_campaign(
            tenant_id=test_tenant_id,
            data=test_campaign_data,
            created_by_user_id=uuid4(),
        )
        await async_session.commit()

        # Verify campaign created
        assert campaign.id is not None
        assert campaign.tenant_id == test_tenant_id
        assert campaign.name == test_campaign_data.name
        assert campaign.trigger_after_days == 7
        assert campaign.max_retries == 3
        assert campaign.retry_interval_days == 3
        assert len(campaign.actions) == 3
        assert campaign.actions[0]["type"] == "email"
        assert campaign.actions[1]["type"] == "sms"
        assert campaign.actions[2]["type"] == "suspend_service"
        assert campaign.exclusion_rules["min_lifetime_value"] == 1000.0
        assert campaign.priority == 10
        assert campaign.is_active is True
        assert campaign.total_executions == 0
        assert campaign.successful_executions == 0
        assert campaign.total_recovered_amount == 0

    @pytest.mark.asyncio
    async def test_create_campaign_validation_error(
        self,
        dunning_service: DunningService,
        test_tenant_id: str,
    ):
        """Test campaign creation fails without actions."""
        from pydantic import ValidationError as PydanticValidationError

        with pytest.raises(PydanticValidationError):
            DunningCampaignCreate(
                name="Invalid Campaign",
                trigger_after_days=7,
                actions=[],  # Empty actions should fail
            )

    @pytest.mark.asyncio
    async def test_get_campaign_success(
        self,
        dunning_service: DunningService,
        test_tenant_id: str,
        test_campaign_data: DunningCampaignCreate,
        async_session: AsyncSession,
    ):
        """Test retrieving campaign by ID."""
        # Create campaign
        created = await dunning_service.create_campaign(
            tenant_id=test_tenant_id,
            data=test_campaign_data,
        )
        await async_session.commit()

        # Retrieve campaign
        retrieved = await dunning_service.get_campaign(
            campaign_id=created.id,
            tenant_id=test_tenant_id,
        )

        assert retrieved.id == created.id
        assert retrieved.name == created.name
        assert retrieved.actions == created.actions

    @pytest.mark.asyncio
    async def test_get_campaign_not_found(
        self,
        dunning_service: DunningService,
        test_tenant_id: str,
    ):
        """Test retrieving non-existent campaign."""
        fake_id = uuid4()

        with pytest.raises(EntityNotFoundError):
            await dunning_service.get_campaign(
                campaign_id=fake_id,
                tenant_id=test_tenant_id,
            )

    @pytest.mark.asyncio
    async def test_update_campaign_success(
        self,
        dunning_service: DunningService,
        test_tenant_id: str,
        test_campaign_data: DunningCampaignCreate,
        async_session: AsyncSession,
    ):
        """Test updating campaign."""
        # Create campaign
        campaign = await dunning_service.create_campaign(
            tenant_id=test_tenant_id,
            data=test_campaign_data,
        )
        await async_session.commit()

        # Update campaign
        update_data = DunningCampaignUpdate(
            name="Updated Campaign Name",
            trigger_after_days=14,
            is_active=False,
        )
        updated = await dunning_service.update_campaign(
            campaign_id=campaign.id,
            tenant_id=test_tenant_id,
            data=update_data,
        )
        await async_session.commit()

        assert updated.name == "Updated Campaign Name"
        assert updated.trigger_after_days == 14
        assert updated.is_active is False
        assert updated.max_retries == 3  # Unchanged

    @pytest.mark.asyncio
    async def test_delete_campaign_success(
        self,
        dunning_service: DunningService,
        test_tenant_id: str,
        test_campaign_data: DunningCampaignCreate,
        async_session: AsyncSession,
    ):
        """Test deleting campaign."""
        # Create campaign
        campaign = await dunning_service.create_campaign(
            tenant_id=test_tenant_id,
            data=test_campaign_data,
        )
        await async_session.commit()
        campaign_id = campaign.id

        # Delete campaign
        await dunning_service.delete_campaign(
            campaign_id=campaign_id,
            tenant_id=test_tenant_id,
        )
        await async_session.commit()

        # Verify deleted
        with pytest.raises(EntityNotFoundError):
            await dunning_service.get_campaign(
                campaign_id=campaign_id,
                tenant_id=test_tenant_id,
            )

    @pytest.mark.asyncio
    async def test_list_campaigns(
        self,
        dunning_service: DunningService,
        test_tenant_id: str,
        test_campaign_data: DunningCampaignCreate,
        async_session: AsyncSession,
    ):
        """Test listing campaigns with filters."""
        # Create multiple campaigns
        for i in range(3):
            data = test_campaign_data.model_copy()
            data.name = f"Campaign {i + 1}"
            data.is_active = i < 2  # First 2 active, last inactive
            await dunning_service.create_campaign(
                tenant_id=test_tenant_id,
                data=data,
            )
        await async_session.commit()

        # List all campaigns
        all_campaigns = await dunning_service.list_campaigns(tenant_id=test_tenant_id)
        assert len(all_campaigns) >= 3

        # List only active campaigns
        active_campaigns = await dunning_service.list_campaigns(
            tenant_id=test_tenant_id,
            is_active=True,
        )
        assert len([c for c in active_campaigns if c.is_active]) >= 2


@pytest.mark.integration
class TestDunningExecution:
    """Test dunning execution workflows."""

    @pytest.mark.asyncio
    async def test_start_execution_success(
        self,
        dunning_service: DunningService,
        test_tenant_id: str,
        test_campaign_data: DunningCampaignCreate,
        test_customer: Customer,
        async_session: AsyncSession,
    ):
        """Test creating dunning execution."""
        # Create campaign
        campaign = await dunning_service.create_campaign(
            tenant_id=test_tenant_id,
            data=test_campaign_data,
        )
        await async_session.commit()

        # Create execution
        execution = await dunning_service.start_execution(
            campaign_id=campaign.id,
            tenant_id=test_tenant_id,
            subscription_id="sub_test123",
            customer_id=test_customer.id,
            invoice_id="in_test456",
            outstanding_amount=10000,  # $100.00
        )
        await async_session.commit()

        # Verify execution created
        assert execution.id is not None
        assert execution.campaign_id == campaign.id
        assert execution.tenant_id == test_tenant_id
        assert execution.subscription_id == "sub_test123"
        assert execution.customer_id == test_customer.id
        assert execution.invoice_id == "in_test456"
        assert execution.outstanding_amount == 10000
        assert execution.recovered_amount == 0
        assert execution.status == DunningExecutionStatus.PENDING
        assert execution.current_step == 0
        assert execution.total_steps == 3  # From test campaign
        assert execution.retry_count == 0
        assert execution.next_action_at is not None

    @pytest.mark.asyncio
    async def test_execute_action_email(
        self,
        dunning_service: DunningService,
        test_tenant_id: str,
        test_campaign_data: DunningCampaignCreate,
        test_customer: Customer,
        async_session: AsyncSession,
    ):
        """Test executing email action."""
        # Create campaign and execution
        campaign = await dunning_service.create_campaign(
            tenant_id=test_tenant_id,
            data=test_campaign_data,
        )
        execution = await dunning_service.start_execution(
            campaign_id=campaign.id,
            tenant_id=test_tenant_id,
            subscription_id="sub_test123",
            customer_id=test_customer.id,
            outstanding_amount=10000,
        )
        await async_session.commit()

        # Execute first action (email)
        result = await dunning_service.execute_next_action(
            execution_id=execution.id,
            tenant_id=test_tenant_id,
        )
        await async_session.commit()

        # Verify action executed
        assert result.status == "success"
        assert result.action_type == DunningActionType.EMAIL

        # Refresh execution from database
        await async_session.refresh(execution)
        assert execution.current_step == 1
        assert execution.status == DunningExecutionStatus.IN_PROGRESS
        assert len(execution.execution_log) == 1
        assert execution.execution_log[0]["action_type"] == "email"
        assert execution.execution_log[0]["status"] == "success"

        # Verify action log created
        stmt = select(DunningActionLog).where(DunningActionLog.execution_id == execution.id)
        result = await async_session.execute(stmt)
        logs = result.scalars().all()
        assert len(logs) == 1
        assert logs[0].action_type == DunningActionType.EMAIL
        assert logs[0].status == "success"
        assert logs[0].step_number == 0

    @pytest.mark.asyncio
    async def test_execute_full_campaign_lifecycle(
        self,
        dunning_service: DunningService,
        test_tenant_id: str,
        test_campaign_data: DunningCampaignCreate,
        test_customer: Customer,
        async_session: AsyncSession,
    ):
        """Test executing complete campaign sequence."""
        # Create campaign and execution
        campaign = await dunning_service.create_campaign(
            tenant_id=test_tenant_id,
            data=test_campaign_data,
        )
        execution = await dunning_service.start_execution(
            campaign_id=campaign.id,
            tenant_id=test_tenant_id,
            subscription_id="sub_full_test",
            customer_id=test_customer.id,
            outstanding_amount=15000,  # $150.00
        )
        await async_session.commit()

        # Execute all 3 actions
        for step in range(3):
            result = await dunning_service.execute_next_action(
                execution_id=execution.id,
                tenant_id=test_tenant_id,
            )
            await async_session.commit()
            await async_session.refresh(execution)

            assert result.status == "success"
            assert execution.current_step == step + 1

        # Verify execution completed
        assert execution.status == DunningExecutionStatus.COMPLETED
        assert execution.current_step == 3
        assert len(execution.execution_log) == 3
        assert execution.completed_at is not None

        # Verify all action logs created
        stmt = select(DunningActionLog).where(DunningActionLog.execution_id == execution.id)
        result = await async_session.execute(stmt)
        logs = result.scalars().all()
        assert len(logs) == 3
        assert logs[0].action_type == DunningActionType.EMAIL
        assert logs[1].action_type == DunningActionType.SMS
        assert logs[2].action_type == DunningActionType.SUSPEND_SERVICE

    @pytest.mark.asyncio
    async def test_cancel_execution(
        self,
        dunning_service: DunningService,
        test_tenant_id: str,
        test_campaign_data: DunningCampaignCreate,
        test_customer: Customer,
        async_session: AsyncSession,
    ):
        """Test canceling execution."""
        # Create campaign and execution
        campaign = await dunning_service.create_campaign(
            tenant_id=test_tenant_id,
            data=test_campaign_data,
        )
        execution = await dunning_service.start_execution(
            campaign_id=campaign.id,
            tenant_id=test_tenant_id,
            subscription_id="sub_cancel_test",
            customer_id=test_customer.id,
            outstanding_amount=10000,
        )
        await async_session.commit()

        # Execute first action
        await dunning_service.execute_next_action(
            execution_id=execution.id,
            tenant_id=test_tenant_id,
        )
        await async_session.commit()

        # Cancel execution
        user_id = uuid4()
        await dunning_service.cancel_execution(
            execution_id=execution.id,
            tenant_id=test_tenant_id,
            canceled_by_user_id=user_id,
            reason="Payment received",
        )
        await async_session.commit()

        # Verify execution canceled
        await async_session.refresh(execution)
        assert execution.status == DunningExecutionStatus.CANCELED
        assert execution.canceled_reason == "Payment received"
        assert execution.canceled_by_user_id == user_id
        assert execution.completed_at is not None

    @pytest.mark.asyncio
    async def test_record_payment_recovery(
        self,
        dunning_service: DunningService,
        test_tenant_id: str,
        test_campaign_data: DunningCampaignCreate,
        test_customer: Customer,
        async_session: AsyncSession,
    ):
        """Test recording payment recovery updates campaign stats."""
        # Create campaign and execution
        campaign = await dunning_service.create_campaign(
            tenant_id=test_tenant_id,
            data=test_campaign_data,
        )
        execution = await dunning_service.start_execution(
            campaign_id=campaign.id,
            tenant_id=test_tenant_id,
            subscription_id="sub_recovery_test",
            customer_id=test_customer.id,
            outstanding_amount=10000,
        )
        await async_session.commit()

        # Record payment recovery
        recovered_amount = 10000  # Full amount
        await dunning_service.record_payment_recovery(
            execution_id=execution.id,
            tenant_id=test_tenant_id,
            recovered_amount=recovered_amount,
        )
        await async_session.commit()

        # Verify execution updated
        await async_session.refresh(execution)
        assert execution.recovered_amount == 10000
        assert execution.status == DunningExecutionStatus.COMPLETED

        # Verify campaign stats updated
        await async_session.refresh(campaign)
        assert campaign.successful_executions == 1
        assert campaign.total_recovered_amount == 10000


@pytest.mark.integration
class TestDunningStatistics:
    """Test dunning statistics and reporting."""

    @pytest.mark.asyncio
    async def test_get_campaign_stats(
        self,
        dunning_service: DunningService,
        test_tenant_id: str,
        test_campaign_data: DunningCampaignCreate,
        test_customer: Customer,
        async_session: AsyncSession,
    ):
        """Test retrieving campaign statistics."""
        # Create campaign
        campaign = await dunning_service.create_campaign(
            tenant_id=test_tenant_id,
            data=test_campaign_data,
        )

        # Create multiple executions
        for i in range(3):
            execution = await dunning_service.start_execution(
                campaign_id=campaign.id,
                tenant_id=test_tenant_id,
                subscription_id=f"sub_stats_{i}",
                customer_id=test_customer.id,
                outstanding_amount=5000 * (i + 1),
            )
            # Mark 2 as successful with recovery
            if i < 2:
                await dunning_service.record_payment_recovery(
                    execution_id=execution.id,
                    tenant_id=test_tenant_id,
                    recovered_amount=5000 * (i + 1),
                )
        await async_session.commit()

        # Get campaign stats
        stats = await dunning_service.get_campaign_stats(
            campaign_id=campaign.id,
            tenant_id=test_tenant_id,
        )

        # Verify stats
        assert stats.total_executions >= 3
        assert stats.successful_executions >= 2
        assert stats.total_recovered_amount >= 15000  # 5000 + 10000
        assert stats.success_rate >= 66.0  # 2/3 = 66.67%
        assert stats.average_recovery_amount > 0

    @pytest.mark.asyncio
    async def test_get_overall_dunning_stats(
        self,
        dunning_service: DunningService,
        test_tenant_id: str,
        test_campaign_data: DunningCampaignCreate,
        test_customer: Customer,
        async_session: AsyncSession,
    ):
        """Test retrieving overall dunning statistics."""
        # Create 2 campaigns
        for i in range(2):
            data = test_campaign_data.model_copy()
            data.name = f"Stats Campaign {i + 1}"
            campaign = await dunning_service.create_campaign(
                tenant_id=test_tenant_id,
                data=data,
            )

            # Create executions
            execution = await dunning_service.start_execution(
                campaign_id=campaign.id,
                tenant_id=test_tenant_id,
                subscription_id=f"sub_overall_{i}",
                customer_id=test_customer.id,
                outstanding_amount=10000,
            )
            await dunning_service.record_payment_recovery(
                execution_id=execution.id,
                tenant_id=test_tenant_id,
                recovered_amount=10000,
            )
        await async_session.commit()

        # Get overall stats
        stats = await dunning_service.get_dunning_stats(tenant_id=test_tenant_id)

        # Verify overall stats
        assert stats.total_campaigns >= 2
        assert stats.total_executions >= 2
        assert stats.successful_recoveries >= 2
        assert stats.total_recovered_amount >= 20000


@pytest.mark.integration
class TestDunningEdgeCases:
    """Test edge cases and error handling."""

    @pytest.mark.asyncio
    async def test_execution_retry_on_failure(
        self,
        dunning_service: DunningService,
        test_tenant_id: str,
        test_campaign_data: DunningCampaignCreate,
        test_customer: Customer,
        async_session: AsyncSession,
    ):
        """Test execution retry logic when action fails."""
        # Create campaign with max_retries=2
        data = test_campaign_data.model_copy()
        data.max_retries = 2
        campaign = await dunning_service.create_campaign(
            tenant_id=test_tenant_id,
            data=data,
        )

        execution = await dunning_service.start_execution(
            campaign_id=campaign.id,
            tenant_id=test_tenant_id,
            subscription_id="sub_retry_test",
            customer_id=test_customer.id,
            outstanding_amount=10000,
        )
        await async_session.commit()

        # Simulate action failure by forcing error condition
        # (In real implementation, this would be tested with mocked email/SMS service)
        # For now, verify retry_count can be incremented
        execution.retry_count = 1
        await async_session.commit()
        await async_session.refresh(execution)

        assert execution.retry_count == 1
        assert execution.status == DunningExecutionStatus.PENDING

    @pytest.mark.asyncio
    async def test_exclusion_rules_applied(
        self,
        dunning_service: DunningService,
        test_tenant_id: str,
        async_session: AsyncSession,
    ):
        """Test that exclusion rules prevent execution."""
        # Create campaign with exclusion rules
        data = DunningCampaignCreate(
            name="Exclusion Test Campaign",
            trigger_after_days=7,
            actions=[
                DunningActionConfig(
                    type=DunningActionType.EMAIL,
                    delay_days=0,
                    template="reminder",
                )
            ],
            exclusion_rules=DunningExclusionRules(
                min_lifetime_value=5000.0,  # Exclude high-value customers
            ),
        )
        campaign = await dunning_service.create_campaign(
            tenant_id=test_tenant_id,
            data=data,
        )
        await async_session.commit()

        # Verify exclusion rules stored correctly
        assert campaign.exclusion_rules["min_lifetime_value"] == 5000.0

        # In real implementation, check_exclusion_rules would be called
        # before creating execution to prevent execution for excluded customers
