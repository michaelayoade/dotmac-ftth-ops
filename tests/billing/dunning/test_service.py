"""Comprehensive tests for dunning service layer."""

from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from pydantic import ValidationError as PydanticValidationError

from dotmac.platform.billing.dunning.models import DunningExecutionStatus
from dotmac.platform.billing.dunning.schemas import (
    DunningCampaignCreate,
    DunningCampaignUpdate,
)
from dotmac.platform.billing.dunning.service import DunningService
from dotmac.platform.core.exceptions import EntityNotFoundError

pytestmark = pytest.mark.integration


@pytest.mark.asyncio
class TestDunningCampaignCRUD:
    """Test campaign CRUD operations."""

    async def test_create_campaign_success(
        self, async_session, test_tenant_id, test_user_id, sample_campaign_data
    ):
        """Test successful campaign creation."""
        service = DunningService(async_session)

        campaign = await service.create_campaign(
            tenant_id=test_tenant_id,
            data=sample_campaign_data,
            created_by_user_id=test_user_id,
        )

        assert campaign.id is not None
        assert campaign.tenant_id == test_tenant_id
        assert campaign.name == sample_campaign_data.name
        assert campaign.trigger_after_days == sample_campaign_data.trigger_after_days
        assert campaign.max_retries == sample_campaign_data.max_retries
        assert len(campaign.actions) == 3
        assert campaign.is_active is True
        assert campaign.priority == 5
        assert campaign.total_executions == 0
        assert campaign.successful_executions == 0
        assert campaign.total_recovered_amount == 0

    async def test_create_campaign_validation_no_actions(
        self, async_session, test_tenant_id, test_user_id
    ):
        """Test campaign creation fails without actions."""
        service = DunningService(async_session)

        with pytest.raises(PydanticValidationError, match="at least 1 item"):
            await service.create_campaign(
                tenant_id=test_tenant_id,
                data=DunningCampaignCreate(
                    name="Invalid Campaign",
                    trigger_after_days=7,
                    actions=[],  # Empty actions
                ),
                created_by_user_id=test_user_id,
            )

    async def test_get_campaign(self, async_session, sample_campaign, test_tenant_id):
        """Test retrieving a campaign."""
        service = DunningService(async_session)

        campaign = await service.get_campaign(
            campaign_id=sample_campaign.id,
            tenant_id=test_tenant_id,
        )

        assert campaign is not None
        assert campaign.id == sample_campaign.id
        assert campaign.name == sample_campaign.name

    async def test_get_campaign_wrong_tenant(self, async_session, sample_campaign):
        """Test campaign not found for wrong tenant."""
        service = DunningService(async_session)

        with pytest.raises(EntityNotFoundError):
            await service.get_campaign(
                campaign_id=sample_campaign.id,
                tenant_id=str(uuid4()),
            )

    async def test_list_campaigns(self, async_session, sample_campaign, test_tenant_id):
        """Test listing campaigns."""
        service = DunningService(async_session)

        campaigns = await service.list_campaigns(
            tenant_id=test_tenant_id,
            active_only=True,
        )

        assert len(campaigns) == 1
        assert campaigns[0].id == sample_campaign.id

    async def test_update_campaign(
        self, async_session, sample_campaign, test_tenant_id, test_user_id
    ):
        """Test updating a campaign."""
        service = DunningService(async_session)

        update_data = DunningCampaignUpdate(
            name="Updated Campaign Name",
            priority=10,
            is_active=False,
        )

        updated = await service.update_campaign(
            campaign_id=sample_campaign.id,
            tenant_id=test_tenant_id,
            data=update_data,
            updated_by_user_id=test_user_id,
        )

        assert updated.name == "Updated Campaign Name"
        assert updated.priority == 10
        assert updated.is_active is False

    async def test_delete_campaign(
        self, async_session, sample_campaign, test_tenant_id, test_user_id
    ):
        """Test deleting (soft delete) a campaign."""
        service = DunningService(async_session)

        success = await service.delete_campaign(
            campaign_id=sample_campaign.id,
            tenant_id=test_tenant_id,
            deleted_by_user_id=test_user_id,
        )

        assert success is True

        # Verify campaign is marked inactive
        campaign = await service.get_campaign(
            campaign_id=sample_campaign.id,
            tenant_id=test_tenant_id,
        )
        assert campaign.is_active is False


@pytest.mark.asyncio
class TestDunningExecutions:
    """Test execution lifecycle."""

    async def test_start_execution_success(
        self, async_session, sample_campaign, test_tenant_id, test_customer_id
    ):
        """Test starting a new execution."""
        service = DunningService(async_session)

        execution = await service.start_execution(
            campaign_id=sample_campaign.id,
            tenant_id=test_tenant_id,
            subscription_id="sub_test_123",
            customer_id=test_customer_id,
            invoice_id="inv_test_123",
            outstanding_amount=10000,
            metadata={"test": "data"},
        )

        assert execution.id is not None
        assert execution.campaign_id == sample_campaign.id
        assert execution.subscription_id == "sub_test_123"
        assert execution.outstanding_amount == 10000
        assert execution.recovered_amount == 0
        assert execution.status == DunningExecutionStatus.PENDING
        assert execution.current_step == 0
        assert execution.total_steps == 3  # From sample campaign
        assert execution.next_action_at is not None

    async def test_start_execution_duplicate_subscription(
        self, async_session, sample_execution, test_tenant_id, test_customer_id
    ):
        """Test starting execution fails for subscription with active execution."""
        service = DunningService(async_session)

        with pytest.raises(ValueError, match="already has an active execution"):
            await service.start_execution(
                campaign_id=sample_execution.campaign_id,
                tenant_id=test_tenant_id,
                subscription_id=sample_execution.subscription_id,
                customer_id=test_customer_id,
                invoice_id="inv_test_456",
                outstanding_amount=5000,
            )

    async def test_get_execution(self, async_session, sample_execution, test_tenant_id):
        """Test retrieving an execution."""
        service = DunningService(async_session)

        execution = await service.get_execution(
            execution_id=sample_execution.id,
            tenant_id=test_tenant_id,
        )

        assert execution is not None
        assert execution.id == sample_execution.id

    async def test_list_executions(self, async_session, sample_execution, test_tenant_id):
        """Test listing executions."""
        service = DunningService(async_session)

        executions = await service.list_executions(
            tenant_id=test_tenant_id,
        )

        assert len(executions) >= 1
        assert any(e.id == sample_execution.id for e in executions)

    async def test_list_executions_filtered_by_status(
        self, async_session, sample_execution, test_tenant_id
    ):
        """Test listing executions filtered by status."""
        service = DunningService(async_session)

        executions = await service.list_executions(
            tenant_id=test_tenant_id,
            status=DunningExecutionStatus.PENDING,
        )

        assert len(executions) >= 1
        assert all(e.status == DunningExecutionStatus.PENDING for e in executions)

    async def test_cancel_execution(
        self, async_session, sample_execution, test_tenant_id, test_user_id
    ):
        """Test canceling an execution."""
        service = DunningService(async_session)

        success = await service.cancel_execution(
            execution_id=sample_execution.id,
            tenant_id=test_tenant_id,
            reason="Customer paid invoice",
            canceled_by_user_id=test_user_id,
        )

        assert success is True

        # Verify execution is canceled
        execution = await service.get_execution(
            execution_id=sample_execution.id,
            tenant_id=test_tenant_id,
        )
        assert execution.status == DunningExecutionStatus.CANCELED
        assert execution.canceled_reason == "Customer paid invoice"

    async def test_get_pending_actions(
        self, async_session, test_tenant_id, test_customer_id, sample_campaign_data
    ):
        """Test retrieving executions with pending actions."""
        service = DunningService(async_session)

        # Create campaign
        campaign = await service.create_campaign(
            tenant_id=test_tenant_id,
            data=sample_campaign_data,
            created_by_user_id=uuid4(),
        )
        await async_session.commit()

        # Create execution with past next_action_at
        execution = await service.start_execution(
            campaign_id=campaign.id,
            tenant_id=test_tenant_id,
            subscription_id="sub_pending_test",
            customer_id=test_customer_id,
            invoice_id="inv_pending_test",
            outstanding_amount=5000,
        )

        # Set next_action_at to past
        execution.next_action_at = datetime.now(UTC) - timedelta(hours=1)
        await async_session.commit()

        # Get pending actions
        pending = await service.get_pending_actions(
            tenant_id=test_tenant_id,
            limit=10,
        )

        assert len(pending) >= 1
        assert any(e.id == execution.id for e in pending)


@pytest.mark.asyncio
class TestDunningStatistics:
    """Test statistics and reporting."""

    async def test_get_campaign_stats(self, async_session, sample_campaign, test_tenant_id):
        """Test retrieving campaign statistics."""
        service = DunningService(async_session)

        stats = await service.get_campaign_stats(
            campaign_id=sample_campaign.id,
            tenant_id=test_tenant_id,
        )

        assert stats.campaign_id == sample_campaign.id
        assert stats.campaign_name == sample_campaign.name
        assert stats.total_executions >= 0
        assert stats.success_rate >= 0
        assert stats.recovery_rate >= 0

    async def test_get_tenant_stats(self, async_session, test_tenant_id):
        """Test retrieving tenant-wide statistics."""
        service = DunningService(async_session)

        stats = await service.get_tenant_stats(tenant_id=test_tenant_id)

        assert stats.total_campaigns >= 0
        assert stats.active_campaigns >= 0
        assert stats.total_executions >= 0
        assert stats.average_recovery_rate >= 0
