"""
Comprehensive workflow tests for OrchestrationService.

Tests each workflow method in isolation with mocked dependencies to ensure
correct multi-system coordination and error handling.
"""

from datetime import datetime
from unittest.mock import AsyncMock, Mock, patch
from uuid import UUID, uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.core.exceptions import NotFoundError, ValidationError
from dotmac.platform.crm.models import Lead, LeadStatus, Quote, QuoteStatus
from dotmac.platform.customer_management.models import Customer, CustomerStatus
from dotmac.platform.radius.schemas import RADIUSSubscriberCreate
from dotmac.platform.services.orchestration import OrchestrationService
from dotmac.platform.subscribers.models import Subscriber, SubscriberStatus


@pytest.fixture
def mock_db():
    """Create a mock database session."""
    session = AsyncMock(spec=AsyncSession)
    session.commit = AsyncMock()
    session.rollback = AsyncMock()
    session.flush = AsyncMock()
    session.refresh = AsyncMock()
    session.execute = AsyncMock()
    session.scalar = AsyncMock()
    session.add = Mock()
    session.delete = Mock()
    return session


@pytest.fixture
def tenant_id():
    """Generate test tenant ID."""
    return f"test_tenant_{uuid4()}"


@pytest.fixture
def user_id():
    """Generate test user ID."""
    return uuid4()


@pytest.mark.integration
class TestConvertLeadToCustomer:
    """Test lead to customer conversion workflow."""

    @pytest.mark.asyncio
    async def test_convert_lead_success(
        self,
        mock_db: AsyncMock,
        tenant_id: str,
        user_id: UUID,
    ):
        """Test successful lead to customer conversion."""
        lead_id = uuid4()
        quote_id = uuid4()

        # Create sample lead using Mock
        lead = Mock(spec=Lead)
        lead.id = lead_id
        lead.tenant_id = tenant_id
        lead.first_name = "John"
        lead.last_name = "Doe"
        lead.email = "john@example.com"
        lead.phone = "+1234567890"
        lead.status = LeadStatus.NEGOTIATING
        lead.service_address_line1 = "123 Main St"
        lead.service_city = "Test City"
        lead.source = Mock(value="website")
        lead.company_name = None
        lead.service_address_line2 = None
        lead.service_state_province = "TS"
        lead.service_postal_code = "12345"
        lead.service_country = "US"
        lead.partner_id = None

        # Create sample quote using Mock
        quote = Mock(spec=Quote)
        quote.id = quote_id
        quote.tenant_id = tenant_id
        quote.lead_id = lead_id
        quote.status = QuoteStatus.ACCEPTED

        # Mock services
        mock_lead_service = AsyncMock()
        mock_lead_service.get_lead = AsyncMock(return_value=lead)
        mock_lead_service.convert_to_customer = AsyncMock(return_value=lead)

        mock_quote_service = AsyncMock()
        mock_quote_service.get_quote = AsyncMock(return_value=quote)

        mock_customer_service = AsyncMock()
        customer = Customer(
            id=uuid4(),
            tenant_id=tenant_id,
            first_name="John",
            last_name="Doe",
            email="john@example.com",
            status=CustomerStatus.ACTIVE,
        )
        mock_customer_service.create_customer = AsyncMock(return_value=customer)

        # Create service with mocked dependencies
        service = OrchestrationService(
            db=mock_db,
            customer_service=mock_customer_service,
            lead_service=mock_lead_service,
            quote_service=mock_quote_service,
        )

        # Execute conversion
        result = await service.convert_lead_to_customer(
            tenant_id=tenant_id,
            lead_id=lead_id,
            accepted_quote_id=quote_id,
            user_id=user_id,
        )

        # Assertions
        assert result["customer"].id == customer.id
        assert result["lead"] == lead
        assert result["quote"] == quote
        assert "conversion_date" in result

        # Verify service interactions
        mock_lead_service.get_lead.assert_called_once_with(tenant_id, lead_id)
        mock_quote_service.get_quote.assert_called_once_with(tenant_id, quote_id)
        mock_customer_service.create_customer.assert_called_once()
        mock_lead_service.convert_to_customer.assert_called_once()
        mock_db.commit.assert_called_once()

    @pytest.mark.asyncio
    async def test_convert_lead_invalid_status(
        self,
        mock_db: AsyncMock,
        tenant_id: str,
        user_id: UUID,
    ):
        """Test conversion fails when lead has invalid status."""
        lead_id = uuid4()
        quote_id = uuid4()

        # Lead with wrong status
        lead = Lead(
            id=lead_id,
            tenant_id=tenant_id,
            first_name="John",
            last_name="Doe",
            email="john@example.com",
            status=LeadStatus.NEW,  # Invalid status for conversion
        )

        mock_lead_service = AsyncMock()
        mock_lead_service.get_lead = AsyncMock(return_value=lead)

        service = OrchestrationService(
            db=mock_db,
            lead_service=mock_lead_service,
        )

        # Should raise ValidationError
        with pytest.raises(ValidationError, match="must be in negotiating or quote_sent status"):
            await service.convert_lead_to_customer(
                tenant_id=tenant_id,
                lead_id=lead_id,
                accepted_quote_id=quote_id,
                user_id=user_id,
            )

    @pytest.mark.asyncio
    async def test_convert_lead_quote_not_accepted(
        self,
        mock_db: AsyncMock,
        tenant_id: str,
        user_id: UUID,
    ):
        """Test conversion fails when quote is not accepted."""
        lead_id = uuid4()
        quote_id = uuid4()

        lead = Lead(
            id=lead_id,
            tenant_id=tenant_id,
            first_name="John",
            last_name="Doe",
            email="john@example.com",
            status=LeadStatus.NEGOTIATING,
        )

        # Quote not accepted
        quote = Quote(
            id=quote_id,
            tenant_id=tenant_id,
            lead_id=lead_id,
            status=QuoteStatus.DRAFT,  # Not accepted
        )

        mock_lead_service = AsyncMock()
        mock_lead_service.get_lead = AsyncMock(return_value=lead)

        mock_quote_service = AsyncMock()
        mock_quote_service.get_quote = AsyncMock(return_value=quote)

        service = OrchestrationService(
            db=mock_db,
            lead_service=mock_lead_service,
            quote_service=mock_quote_service,
        )

        with pytest.raises(ValidationError, match="must be accepted"):
            await service.convert_lead_to_customer(
                tenant_id=tenant_id,
                lead_id=lead_id,
                accepted_quote_id=quote_id,
                user_id=user_id,
            )

    @pytest.mark.asyncio
    async def test_convert_lead_quote_mismatch(
        self,
        mock_db: AsyncMock,
        tenant_id: str,
        user_id: UUID,
    ):
        """Test conversion fails when quote belongs to different lead."""
        lead_id = uuid4()
        quote_id = uuid4()
        different_lead_id = uuid4()

        lead = Lead(
            id=lead_id,
            tenant_id=tenant_id,
            first_name="John",
            last_name="Doe",
            email="john@example.com",
            status=LeadStatus.NEGOTIATING,
        )

        quote = Quote(
            id=quote_id,
            tenant_id=tenant_id,
            lead_id=different_lead_id,  # Different lead!
            status=QuoteStatus.ACCEPTED,
        )

        mock_lead_service = AsyncMock()
        mock_lead_service.get_lead = AsyncMock(return_value=lead)

        mock_quote_service = AsyncMock()
        mock_quote_service.get_quote = AsyncMock(return_value=quote)

        service = OrchestrationService(
            db=mock_db,
            lead_service=mock_lead_service,
            quote_service=mock_quote_service,
        )

        with pytest.raises(ValidationError, match="does not belong to lead"):
            await service.convert_lead_to_customer(
                tenant_id=tenant_id,
                lead_id=lead_id,
                accepted_quote_id=quote_id,
                user_id=user_id,
            )


@pytest.mark.integration
class TestProvisionSubscriber:
    """Test subscriber provisioning workflow."""

    @pytest.mark.asyncio
    async def test_provision_subscriber_success(
        self,
        mock_db: AsyncMock,
        tenant_id: str,
        user_id: UUID,
    ):
        """Test successful end-to-end subscriber provisioning."""
        customer_id = uuid4()
        username = "testuser123"
        password = "securepass123"

        # Mock customer
        customer = Customer(
            id=customer_id,
            tenant_id=tenant_id,
            first_name="John",
            last_name="Doe",
            email="john@example.com",
            service_address_line1="123 Main St",
            service_city="Test City",
        )

        # Mock database queries
        mock_customer_result = Mock()
        mock_customer_result.scalar_one_or_none = Mock(return_value=customer)

        mock_existing_result = Mock()
        mock_existing_result.scalar_one_or_none = Mock(return_value=None)  # No existing subscriber

        mock_db.execute.side_effect = [mock_customer_result, mock_existing_result]

        # Mock RADIUS service
        mock_radius_service = AsyncMock()
        mock_radius_service.create_subscriber = AsyncMock()
        mock_radius_factory = Mock(return_value=mock_radius_service)

        # Mock NetBox service
        mock_netbox_service = AsyncMock()
        mock_netbox_service.allocate_subscriber_ip = AsyncMock(
            return_value={"address": "10.0.0.100", "id": 123}
        )

        # Mock VOLTHA service
        mock_voltha_service = AsyncMock()
        mock_voltha_service.provision_onu = AsyncMock(return_value={"onu_id": "onu_123"})

        # Mock GenieACS service
        mock_genieacs_service = AsyncMock()
        mock_genieacs_service.provision_cpe = AsyncMock(return_value={"device_id": "device_123"})

        # Mock notification service
        mock_notification_service = AsyncMock()
        mock_notification_service.create_notification = AsyncMock()

        service = OrchestrationService(
            db=mock_db,
            radius_service=mock_radius_factory,
            netbox_service=mock_netbox_service,
            voltha_service=mock_voltha_service,
            genieacs_service=mock_genieacs_service,
            notification_service=mock_notification_service,
        )

        result = await service.provision_subscriber(
            tenant_id=tenant_id,
            customer_id=customer_id,
            username=username,
            password=password,
            service_plan="100M",
            download_speed_kbps=100000,
            upload_speed_kbps=50000,
            onu_serial="ABCD12345678",
            cpe_mac_address="AA:BB:CC:DD:EE:FF",
            site_id="site_1",
            user_id=user_id,
        )

        # Verify results
        assert result["subscriber"].username == username
        assert result["subscriber"].status == SubscriberStatus.ACTIVE
        assert result["ip_allocation"]["address"] == "10.0.0.100"
        assert result["voltha_status"]["onu_id"] == "onu_123"
        assert result["genieacs_status"]["device_id"] == "device_123"

        # Verify service calls
        mock_db.add.assert_called()  # Subscriber added
        mock_db.commit.assert_called_once()
        mock_radius_service.create_subscriber.assert_called_once()
        mock_netbox_service.allocate_subscriber_ip.assert_called_once()
        mock_voltha_service.provision_onu.assert_called_once()
        mock_genieacs_service.provision_cpe.assert_called_once()

    @pytest.mark.asyncio
    async def test_provision_subscriber_customer_not_found(
        self,
        mock_db: AsyncMock,
        tenant_id: str,
        user_id: UUID,
    ):
        """Test provisioning fails when customer doesn't exist."""
        customer_id = uuid4()

        # Customer not found
        mock_result = Mock()
        mock_result.scalar_one_or_none = Mock(return_value=None)
        mock_db.execute.return_value = mock_result

        service = OrchestrationService(db=mock_db)

        with pytest.raises(NotFoundError, match="Customer .* not found"):
            await service.provision_subscriber(
                tenant_id=tenant_id,
                customer_id=customer_id,
                username="testuser",
                password="password",
                service_plan="100M",
                download_speed_kbps=100000,
                upload_speed_kbps=50000,
            )

    @pytest.mark.asyncio
    async def test_provision_subscriber_duplicate_username(
        self,
        mock_db: AsyncMock,
        tenant_id: str,
        user_id: UUID,
    ):
        """Test provisioning fails when username already exists."""
        customer_id = uuid4()
        username = "existing_user"

        # Mock customer
        customer = Customer(id=customer_id, tenant_id=tenant_id)
        mock_customer_result = Mock()
        mock_customer_result.scalar_one_or_none = Mock(return_value=customer)

        # Mock existing subscriber with same username
        existing_subscriber = Subscriber(
            id=f"{tenant_id}_{username}",
            tenant_id=tenant_id,
            username=username,
        )
        mock_existing_result = Mock()
        mock_existing_result.scalar_one_or_none = Mock(return_value=existing_subscriber)

        mock_db.execute.side_effect = [mock_customer_result, mock_existing_result]

        service = OrchestrationService(db=mock_db)

        with pytest.raises(ValidationError, match="already exists"):
            await service.provision_subscriber(
                tenant_id=tenant_id,
                customer_id=customer_id,
                username=username,
                password="password",
                service_plan="100M",
                download_speed_kbps=100000,
                upload_speed_kbps=50000,
            )

    @pytest.mark.asyncio
    async def test_provision_subscriber_radius_failure(
        self,
        mock_db: AsyncMock,
        tenant_id: str,
        user_id: UUID,
    ):
        """Test provisioning fails gracefully when RADIUS creation fails."""
        customer_id = uuid4()

        customer = Customer(
            id=customer_id,
            tenant_id=tenant_id,
            service_address_line1="123 Main St",
            service_city="Test City",
        )

        mock_customer_result = Mock()
        mock_customer_result.scalar_one_or_none = Mock(return_value=customer)

        mock_existing_result = Mock()
        mock_existing_result.scalar_one_or_none = Mock(return_value=None)

        mock_db.execute.side_effect = [mock_customer_result, mock_existing_result]

        # Mock RADIUS failure
        mock_radius_service = AsyncMock()
        mock_radius_service.create_subscriber = AsyncMock(side_effect=Exception("RADIUS error"))
        mock_radius_factory = Mock(return_value=mock_radius_service)

        # Mock NetBox
        mock_netbox_service = AsyncMock()
        mock_netbox_service.allocate_subscriber_ip = AsyncMock(
            return_value={"address": "10.0.0.100", "id": 123}
        )

        service = OrchestrationService(
            db=mock_db,
            radius_service=mock_radius_factory,
            netbox_service=mock_netbox_service,
        )

        with pytest.raises(ValidationError, match="Failed to create RADIUS authentication"):
            await service.provision_subscriber(
                tenant_id=tenant_id,
                customer_id=customer_id,
                username="testuser",
                password="password",
                service_plan="100M",
                download_speed_kbps=100000,
                upload_speed_kbps=50000,
            )

    @pytest.mark.asyncio
    async def test_provision_subscriber_partial_success(
        self,
        mock_db: AsyncMock,
        tenant_id: str,
        user_id: UUID,
    ):
        """Test provisioning continues when optional services fail."""
        customer_id = uuid4()

        customer = Customer(
            id=customer_id,
            tenant_id=tenant_id,
            service_address_line1="123 Main St",
            service_city="Test City",
        )

        mock_customer_result = Mock()
        mock_customer_result.scalar_one_or_none = Mock(return_value=customer)

        mock_existing_result = Mock()
        mock_existing_result.scalar_one_or_none = Mock(return_value=None)

        mock_db.execute.side_effect = [mock_customer_result, mock_existing_result]

        # RADIUS succeeds
        mock_radius_service = AsyncMock()
        mock_radius_service.create_subscriber = AsyncMock()
        mock_radius_factory = Mock(return_value=mock_radius_service)

        # NetBox succeeds
        mock_netbox_service = AsyncMock()
        mock_netbox_service.allocate_subscriber_ip = AsyncMock(
            return_value={"address": "10.0.0.100", "id": 123}
        )

        # VOLTHA fails (optional)
        mock_voltha_service = AsyncMock()
        mock_voltha_service.provision_onu = AsyncMock(side_effect=Exception("VOLTHA error"))

        # GenieACS succeeds
        mock_genieacs_service = AsyncMock()
        mock_genieacs_service.provision_cpe = AsyncMock(return_value={"device_id": "device_123"})

        service = OrchestrationService(
            db=mock_db,
            radius_service=mock_radius_factory,
            netbox_service=mock_netbox_service,
            voltha_service=mock_voltha_service,
            genieacs_service=mock_genieacs_service,
        )

        # Should succeed despite VOLTHA failure
        result = await service.provision_subscriber(
            tenant_id=tenant_id,
            customer_id=customer_id,
            username="testuser",
            password="password",
            service_plan="100M",
            download_speed_kbps=100000,
            upload_speed_kbps=50000,
            onu_serial="ABCD12345678",
            cpe_mac_address="AA:BB:CC:DD:EE:FF",
        )

        assert result["subscriber"].status == SubscriberStatus.ACTIVE
        assert result["voltha_status"] is None  # Failed
        assert result["genieacs_status"]["device_id"] == "device_123"  # Succeeded


@pytest.mark.integration
class TestDeprovisionSubscriber:
    """Test subscriber deprovisioning workflow."""

    @pytest.mark.asyncio
    async def test_deprovision_subscriber_success(
        self,
        mock_db: AsyncMock,
        tenant_id: str,
        user_id: UUID,
    ):
        """Test successful subscriber deprovisioning."""
        subscriber_id = f"{tenant_id}_testuser"

        # Mock subscriber
        subscriber = Subscriber(
            id=subscriber_id,
            tenant_id=tenant_id,
            username="testuser",
            genieacs_device_id="device_123",
            voltha_onu_id="onu_123",
            netbox_ip_id=456,
        )

        mock_result = Mock()
        mock_result.scalar_one_or_none = Mock(return_value=subscriber)
        mock_db.execute.return_value = mock_result

        # Mock services
        mock_radius_service = AsyncMock()
        mock_radius_service.disconnect_session = AsyncMock()
        mock_radius_service.delete_subscriber = AsyncMock()
        mock_radius_factory = Mock(return_value=mock_radius_service)

        mock_genieacs_service = AsyncMock()
        mock_genieacs_service.delete_device = AsyncMock(return_value=True)

        mock_voltha_service = AsyncMock()
        mock_voltha_service.delete_onu = AsyncMock(return_value=True)

        mock_netbox_service = AsyncMock()
        mock_netbox_service.release_ip = AsyncMock(return_value=True)

        service = OrchestrationService(
            db=mock_db,
            radius_service=mock_radius_factory,
            genieacs_service=mock_genieacs_service,
            voltha_service=mock_voltha_service,
            netbox_service=mock_netbox_service,
        )

        result = await service.deprovision_subscriber(
            tenant_id=tenant_id,
            subscriber_id=subscriber_id,
            reason="Service terminated",
            user_id=user_id,
        )

        # Verify results
        assert result["subscriber"].status == SubscriberStatus.TERMINATED
        assert result["subscriber"].termination_date is not None

        # Verify service calls
        mock_radius_service.disconnect_session.assert_called_once()
        mock_radius_service.delete_subscriber.assert_called_once()
        mock_genieacs_service.delete_device.assert_called_once()
        mock_voltha_service.delete_onu.assert_called_once()
        mock_netbox_service.release_ip.assert_called_once()
        mock_db.commit.assert_called_once()

    @pytest.mark.asyncio
    async def test_deprovision_subscriber_not_found(
        self,
        mock_db: AsyncMock,
        tenant_id: str,
        user_id: UUID,
    ):
        """Test deprovisioning fails when subscriber doesn't exist."""
        subscriber_id = f"{tenant_id}_nonexistent"

        mock_result = Mock()
        mock_result.scalar_one_or_none = Mock(return_value=None)
        mock_db.execute.return_value = mock_result

        service = OrchestrationService(db=mock_db)

        with pytest.raises(NotFoundError, match="Subscriber .* not found"):
            await service.deprovision_subscriber(
                tenant_id=tenant_id,
                subscriber_id=subscriber_id,
                reason="Test",
                user_id=user_id,
            )


@pytest.mark.integration
class TestSuspendAndReactivate:
    """Test subscriber suspension and reactivation workflows."""

    @pytest.mark.asyncio
    async def test_suspend_subscriber_success(
        self,
        mock_db: AsyncMock,
        tenant_id: str,
        user_id: UUID,
    ):
        """Test successful subscriber suspension."""
        subscriber_id = f"{tenant_id}_testuser"

        subscriber = Subscriber(
            id=subscriber_id,
            tenant_id=tenant_id,
            username="testuser",
            status=SubscriberStatus.ACTIVE,
        )

        mock_subscriber_result = Mock()
        mock_subscriber_result.scalar_one_or_none = Mock(return_value=subscriber)

        from dotmac.platform.radius.models import RadCheck

        radcheck = RadCheck(
            tenant_id=tenant_id,
            subscriber_id=subscriber_id,
            attribute="Cleartext-Password",
            value="password",
        )

        mock_radcheck_result = Mock()
        mock_radcheck_result.scalar_one_or_none = Mock(return_value=radcheck)

        mock_db.execute.side_effect = [mock_subscriber_result, mock_radcheck_result]

        mock_radius_service = AsyncMock()
        mock_radius_service.disconnect_session = AsyncMock()
        mock_radius_factory = Mock(return_value=mock_radius_service)

        service = OrchestrationService(
            db=mock_db,
            radius_service=mock_radius_factory,
        )

        result = await service.suspend_subscriber(
            tenant_id=tenant_id,
            subscriber_id=subscriber_id,
            reason="Non-payment",
            user_id=user_id,
        )

        assert result["subscriber"].status == SubscriberStatus.SUSPENDED
        assert result["subscriber"].suspension_date is not None
        assert radcheck.attribute == "Auth-Type"
        assert radcheck.value == "Reject"

    @pytest.mark.asyncio
    async def test_reactivate_subscriber_success(
        self,
        mock_db: AsyncMock,
        tenant_id: str,
        user_id: UUID,
    ):
        """Test successful subscriber reactivation."""
        subscriber_id = f"{tenant_id}_testuser"

        subscriber = Subscriber(
            id=subscriber_id,
            tenant_id=tenant_id,
            username="testuser",
            password="password123",
            status=SubscriberStatus.SUSPENDED,
            metadata_={"suspension_reason": "Non-payment"},
        )

        mock_subscriber_result = Mock()
        mock_subscriber_result.scalar_one_or_none = Mock(return_value=subscriber)

        from dotmac.platform.radius.models import RadCheck

        radcheck = RadCheck(
            tenant_id=tenant_id,
            subscriber_id=subscriber_id,
            attribute="Auth-Type",
            value="Reject",
        )

        mock_radcheck_result = Mock()
        mock_radcheck_result.scalar_one_or_none = Mock(return_value=radcheck)

        mock_db.execute.side_effect = [mock_subscriber_result, mock_radcheck_result]

        service = OrchestrationService(db=mock_db)

        result = await service.reactivate_subscriber(
            tenant_id=tenant_id,
            subscriber_id=subscriber_id,
            user_id=user_id,
        )

        assert result["subscriber"].status == SubscriberStatus.ACTIVE
        assert result["subscriber"].suspension_date is None
        assert radcheck.attribute == "Cleartext-Password"
        assert radcheck.value == "password123"
        assert "suspension_reason" not in result["subscriber"].metadata_

    @pytest.mark.asyncio
    async def test_reactivate_non_suspended_subscriber(
        self,
        mock_db: AsyncMock,
        tenant_id: str,
        user_id: UUID,
    ):
        """Test reactivation fails when subscriber is not suspended."""
        subscriber_id = f"{tenant_id}_testuser"

        subscriber = Subscriber(
            id=subscriber_id,
            tenant_id=tenant_id,
            username="testuser",
            status=SubscriberStatus.ACTIVE,  # Not suspended
        )

        mock_result = Mock()
        mock_result.scalar_one_or_none = Mock(return_value=subscriber)
        mock_db.execute.return_value = mock_result

        service = OrchestrationService(db=mock_db)

        with pytest.raises(ValidationError, match="must be suspended to reactivate"):
            await service.reactivate_subscriber(
                tenant_id=tenant_id,
                subscriber_id=subscriber_id,
                user_id=user_id,
            )
