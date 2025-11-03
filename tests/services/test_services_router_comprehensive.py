"""
Comprehensive tests for Orchestration Services Router (services/router.py).

Tests FastAPI endpoints for service lifecycle orchestration including
validation, error handling, background tasks, and transaction rollback.
"""

from unittest.mock import AsyncMock, Mock, patch
from uuid import uuid4

import pytest
from starlette.testclient import TestClient

from dotmac.platform.auth.core import UserInfo, get_current_user
from dotmac.platform.core.exceptions import NotFoundError, ValidationError
from dotmac.platform.database import get_async_session

pytestmark = pytest.mark.integration


@pytest.fixture
def test_user():
    """Create a test user."""
    return UserInfo(
        user_id=str(uuid4()),
        tenant_id=f"test_tenant_{uuid4()}",
        email="test@example.com",
        is_platform_admin=False,
        username="testuser",
    )


@pytest.fixture
def mock_db():
    """Create a mock database session."""
    session = AsyncMock()
    session.commit = AsyncMock()
    session.rollback = AsyncMock()
    session.flush = AsyncMock()
    session.refresh = AsyncMock()
    session.execute = AsyncMock()
    return session


@pytest.fixture
def client(test_app, test_user: UserInfo, mock_db: AsyncMock):
    """Create test client with mocked dependencies.

    Uses the standard test_app fixture from conftest.py which has
    all routers properly registered with /api/v1 prefix.
    """
    test_app.dependency_overrides[get_current_user] = lambda: test_user

    async def get_mock_db():
        yield mock_db

    test_app.dependency_overrides[get_async_session] = get_mock_db

    # Create client with default tenant header
    client = TestClient(test_app, headers={"X-Tenant-ID": test_user.tenant_id})
    yield client

    test_app.dependency_overrides.clear()


class TestConvertLeadEndpoint:
    """Test lead to customer conversion endpoint."""

    def test_convert_lead_success(
        self,
        client: TestClient,
        test_user: UserInfo,
        mock_db: AsyncMock,
    ):
        """Test successful lead conversion."""
        lead_id = uuid4()
        quote_id = uuid4()
        customer_id = uuid4()

        # Create mock service instance
        mock_service = AsyncMock()
        from datetime import datetime

        mock_service.convert_lead_to_customer.return_value = {
            "customer": Mock(id=customer_id),
            "lead": Mock(id=lead_id),
            "quote": Mock(id=quote_id),
            "conversion_date": datetime.utcnow(),
        }

        with patch(
            "dotmac.platform.services.router.OrchestrationService", return_value=mock_service
        ):
            payload = {
                "lead_id": str(lead_id),
                "accepted_quote_id": str(quote_id),
            }

            response = client.post("/api/v1/orchestration/leads/convert", json=payload)

            assert response.status_code == 200
            data = response.json()
            assert data["customer_id"] == str(customer_id)
            assert data["lead_id"] == str(lead_id)
            assert data["quote_id"] == str(quote_id)

            mock_db.commit.assert_called()

    def test_convert_lead_validation_error(
        self,
        client: TestClient,
        test_user: UserInfo,
        mock_db: AsyncMock,
    ):
        """Test lead conversion with validation error."""
        lead_id = uuid4()
        quote_id = uuid4()

        # Create mock service instance
        mock_service = AsyncMock()
        mock_service.convert_lead_to_customer.side_effect = ValidationError(
            "Lead must be in negotiating status"
        )

        with patch(
            "dotmac.platform.services.router.OrchestrationService", return_value=mock_service
        ):
            payload = {
                "lead_id": str(lead_id),
                "accepted_quote_id": str(quote_id),
            }

            response = client.post("/api/v1/orchestration/leads/convert", json=payload)

            assert response.status_code == 400
            assert "must be in negotiating" in response.json()["detail"]
            mock_db.rollback.assert_called()

    def test_convert_lead_not_found(
        self,
        client: TestClient,
        test_user: UserInfo,
        mock_db: AsyncMock,
    ):
        """Test lead conversion when lead not found."""
        lead_id = uuid4()
        quote_id = uuid4()

        # Create mock service instance
        mock_service = AsyncMock()
        # Configure convert_lead_to_customer - will be set below
        with patch(
            "dotmac.platform.services.router.OrchestrationService", return_value=mock_service
        ):
            mock_service.convert_lead_to_customer.side_effect = NotFoundError(
                f"Lead {lead_id} not found"
            )

            payload = {
                "lead_id": str(lead_id),
                "accepted_quote_id": str(quote_id),
            }

            response = client.post("/api/v1/orchestration/leads/convert", json=payload)

            assert response.status_code == 404
            assert "not found" in response.json()["detail"]
            mock_db.rollback.assert_called()

    def test_convert_lead_invalid_payload(
        self,
        client: TestClient,
    ):
        """Test lead conversion with invalid payload."""
        # Missing required field
        payload = {
            "lead_id": str(uuid4()),
            # Missing accepted_quote_id
        }

        response = client.post("/api/v1/orchestration/leads/convert", json=payload)

        assert response.status_code == 422  # Validation error


class TestConvertLeadAsyncEndpoint:
    """Test async lead conversion endpoint."""

    def test_convert_lead_async_success(
        self,
        client: TestClient,
        test_user: UserInfo,
    ):
        """Test async lead conversion returns task ID."""
        lead_id = uuid4()
        quote_id = uuid4()

        with patch("dotmac.platform.services.router.convert_lead_to_customer_async") as mock_task:
            mock_celery_result = Mock()
            mock_celery_result.id = "task_12345"
            mock_task.delay.return_value = mock_celery_result

            payload = {
                "lead_id": str(lead_id),
                "accepted_quote_id": str(quote_id),
            }

            response = client.post("/api/v1/orchestration/leads/convert/async", json=payload)

            assert response.status_code == 202
            data = response.json()
            assert data["task_id"] == "task_12345"
            assert data["status"] == "processing"

            # Verify task was queued
            mock_task.delay.assert_called_once_with(
                tenant_id=test_user.tenant_id,
                lead_id=str(lead_id),
                accepted_quote_id=str(quote_id),
                user_id=test_user.user_id,
            )


class TestProvisionSubscriberEndpoint:
    """Test subscriber provisioning endpoint."""

    def test_provision_subscriber_success(
        self,
        client: TestClient,
        test_user: UserInfo,
        mock_db: AsyncMock,
    ):
        """Test successful subscriber provisioning."""
        customer_id = uuid4()
        subscriber_id = f"{test_user.tenant_id}_testuser"

        # Create mock service instance
        mock_service = AsyncMock()
        # Configure provision_subscriber - will be set below
        with patch(
            "dotmac.platform.services.router.OrchestrationService", return_value=mock_service
        ):
            from datetime import datetime

            from dotmac.platform.subscribers.models import SubscriberStatus

            mock_service.provision_subscriber.return_value = {
                "subscriber": Mock(
                    id=subscriber_id,
                    username="testuser",
                    status=SubscriberStatus.ACTIVE,
                ),
                "customer": Mock(id=customer_id),
                "ip_allocation": {"address": "10.0.0.100"},
                "provisioning_date": datetime.utcnow(),
            }

            payload = {
                "customer_id": str(customer_id),
                "username": "testuser",
                "password": "securepass123",
                "service_plan": "100M",
                "download_speed_kbps": 100000,
                "upload_speed_kbps": 50000,
            }

            response = client.post("/api/v1/orchestration/subscribers/provision", json=payload)

            assert response.status_code == 201
            data = response.json()
            assert data["subscriber_id"] == subscriber_id
            assert data["username"] == "testuser"
            assert data["status"] == "active"
            assert data["ip_address"] == "10.0.0.100"

    def test_provision_subscriber_with_onu_and_cpe(
        self,
        client: TestClient,
        test_user: UserInfo,
        mock_db: AsyncMock,
    ):
        """Test subscriber provisioning with ONU and CPE."""
        customer_id = uuid4()
        subscriber_id = f"{test_user.tenant_id}_testuser"

        # Create mock service instance
        mock_service = AsyncMock()
        # Configure provision_subscriber - will be set below
        with patch(
            "dotmac.platform.services.router.OrchestrationService", return_value=mock_service
        ):
            from datetime import datetime

            from dotmac.platform.subscribers.models import SubscriberStatus

            mock_service.provision_subscriber.return_value = {
                "subscriber": Mock(
                    id=subscriber_id,
                    username="testuser",
                    status=SubscriberStatus.ACTIVE,
                ),
                "customer": Mock(id=customer_id),
                "ip_allocation": {"address": "10.0.0.100"},
                "voltha_status": {"onu_id": "onu_123"},
                "genieacs_status": {"device_id": "device_123"},
                "provisioning_date": datetime.utcnow(),
            }

            payload = {
                "customer_id": str(customer_id),
                "username": "testuser",
                "password": "securepass123",
                "service_plan": "100M",
                "download_speed_kbps": 100000,
                "upload_speed_kbps": 50000,
                "onu_serial": "ABCD12345678",
                "cpe_mac_address": "AA:BB:CC:DD:EE:FF",
                "site_id": "site_1",
            }

            response = client.post("/api/v1/orchestration/subscribers/provision", json=payload)

            assert response.status_code == 201
            data = response.json()
            assert data["subscriber_id"] == subscriber_id

    def test_provision_subscriber_validation_errors(
        self,
        client: TestClient,
    ):
        """Test subscriber provisioning with validation errors."""
        # Test missing required fields
        payload = {
            "customer_id": str(uuid4()),
            "username": "ab",  # Too short
            "password": "weak",  # Too short
            "service_plan": "100M",
            "download_speed_kbps": 0,  # Must be > 0
            "upload_speed_kbps": -1000,  # Must be > 0
        }

        response = client.post("/api/v1/orchestration/subscribers/provision", json=payload)

        assert response.status_code == 422

    def test_provision_subscriber_customer_not_found(
        self,
        client: TestClient,
        test_user: UserInfo,
        mock_db: AsyncMock,
    ):
        """Test provisioning when customer doesn't exist."""
        customer_id = uuid4()

        # Create mock service instance
        mock_service = AsyncMock()
        # Configure provision_subscriber - will be set below
        with patch(
            "dotmac.platform.services.router.OrchestrationService", return_value=mock_service
        ):
            mock_service.provision_subscriber.side_effect = NotFoundError(
                f"Customer {customer_id} not found"
            )

            payload = {
                "customer_id": str(customer_id),
                "username": "testuser",
                "password": "securepass123",
                "service_plan": "100M",
                "download_speed_kbps": 100000,
                "upload_speed_kbps": 50000,
            }

            response = client.post("/api/v1/orchestration/subscribers/provision", json=payload)

            assert response.status_code == 404
            mock_db.rollback.assert_called()

    def test_provision_subscriber_duplicate_username(
        self,
        client: TestClient,
        test_user: UserInfo,
        mock_db: AsyncMock,
    ):
        """Test provisioning with duplicate username."""
        customer_id = uuid4()

        # Create mock service instance
        mock_service = AsyncMock()
        # Configure provision_subscriber - will be set below
        with patch(
            "dotmac.platform.services.router.OrchestrationService", return_value=mock_service
        ):
            mock_service.provision_subscriber.side_effect = ValidationError(
                "Subscriber with username testuser already exists"
            )

            payload = {
                "customer_id": str(customer_id),
                "username": "testuser",
                "password": "securepass123",
                "service_plan": "100M",
                "download_speed_kbps": 100000,
                "upload_speed_kbps": 50000,
            }

            response = client.post("/api/v1/orchestration/subscribers/provision", json=payload)

            assert response.status_code == 400
            assert "already exists" in response.json()["detail"]


class TestProvisionSubscriberAsyncEndpoint:
    """Test async subscriber provisioning endpoint."""

    def test_provision_subscriber_async_success(
        self,
        client: TestClient,
        test_user: UserInfo,
    ):
        """Test async provisioning returns task ID."""
        customer_id = uuid4()

        with patch("dotmac.platform.services.router.provision_subscriber_async") as mock_task:
            mock_celery_result = Mock()
            mock_celery_result.id = "task_67890"
            mock_task.delay.return_value = mock_celery_result

            payload = {
                "customer_id": str(customer_id),
                "username": "testuser",
                "password": "securepass123",
                "service_plan": "100M",
                "download_speed_kbps": 100000,
                "upload_speed_kbps": 50000,
            }

            response = client.post(
                "/api/v1/orchestration/subscribers/provision/async", json=payload
            )

            assert response.status_code == 202
            data = response.json()
            assert data["task_id"] == "task_67890"
            assert "provisioning started" in data["message"]


class TestDeprovisionSubscriberEndpoint:
    """Test subscriber deprovisioning endpoint."""

    def test_deprovision_subscriber_success(
        self,
        client: TestClient,
        test_user: UserInfo,
        mock_db: AsyncMock,
    ):
        """Test successful subscriber deprovisioning."""
        subscriber_id = f"{test_user.tenant_id}_testuser"

        # Create mock service instance
        mock_service = AsyncMock()
        # Configure deprovision_subscriber - will be set below
        with patch(
            "dotmac.platform.services.router.OrchestrationService", return_value=mock_service
        ):
            from datetime import datetime

            from dotmac.platform.subscribers.models import SubscriberStatus

            mock_service.deprovision_subscriber.return_value = {
                "subscriber": Mock(
                    id=subscriber_id,
                    status=SubscriberStatus.TERMINATED,
                ),
                "deprovisioning_date": datetime.utcnow(),
            }

            payload = {
                "reason": "Customer requested termination",
            }

            response = client.post(
                f"/api/v1/orchestration/subscribers/{subscriber_id}/deprovision",
                json=payload,
            )

            assert response.status_code == 200
            data = response.json()
            assert data["subscriber_id"] == subscriber_id
            assert data["status"] == "terminated"

    def test_deprovision_subscriber_not_found(
        self,
        client: TestClient,
        test_user: UserInfo,
        mock_db: AsyncMock,
    ):
        """Test deprovisioning non-existent subscriber."""
        subscriber_id = "nonexistent"

        # Create mock service instance
        mock_service = AsyncMock()
        # Configure deprovision_subscriber - will be set below
        with patch(
            "dotmac.platform.services.router.OrchestrationService", return_value=mock_service
        ):
            mock_service.deprovision_subscriber.side_effect = NotFoundError(
                f"Subscriber {subscriber_id} not found"
            )

            payload = {"reason": "Test"}

            response = client.post(
                f"/api/v1/orchestration/subscribers/{subscriber_id}/deprovision",
                json=payload,
            )

            assert response.status_code == 404


class TestSuspendSubscriberEndpoint:
    """Test subscriber suspension endpoint."""

    def test_suspend_subscriber_success(
        self,
        client: TestClient,
        test_user: UserInfo,
        mock_db: AsyncMock,
    ):
        """Test successful subscriber suspension."""
        subscriber_id = f"{test_user.tenant_id}_testuser"

        # Create mock service instance
        mock_service = AsyncMock()
        # Configure suspend_subscriber - will be set below
        with patch(
            "dotmac.platform.services.router.OrchestrationService", return_value=mock_service
        ):
            from datetime import datetime

            from dotmac.platform.subscribers.models import SubscriberStatus

            mock_service.suspend_subscriber.return_value = {
                "subscriber": Mock(
                    id=subscriber_id,
                    status=SubscriberStatus.SUSPENDED,
                ),
                "suspension_date": datetime.utcnow(),
            }

            payload = {"reason": "Non-payment"}

            response = client.post(
                f"/api/v1/orchestration/subscribers/{subscriber_id}/suspend",
                json=payload,
            )

            assert response.status_code == 200
            data = response.json()
            assert data["subscriber_id"] == subscriber_id
            assert data["status"] == "suspended"


class TestReactivateSubscriberEndpoint:
    """Test subscriber reactivation endpoint."""

    def test_reactivate_subscriber_success(
        self,
        client: TestClient,
        test_user: UserInfo,
        mock_db: AsyncMock,
    ):
        """Test successful subscriber reactivation."""
        subscriber_id = f"{test_user.tenant_id}_testuser"

        # Create mock service instance
        mock_service = AsyncMock()
        # Configure reactivate_subscriber - will be set below
        with patch(
            "dotmac.platform.services.router.OrchestrationService", return_value=mock_service
        ):
            from datetime import datetime

            from dotmac.platform.subscribers.models import SubscriberStatus

            mock_service.reactivate_subscriber.return_value = {
                "subscriber": Mock(
                    id=subscriber_id,
                    status=SubscriberStatus.ACTIVE,
                ),
                "reactivation_date": datetime.utcnow(),
            }

            response = client.post(
                f"/api/v1/orchestration/subscribers/{subscriber_id}/reactivate",
            )

            assert response.status_code == 200
            data = response.json()
            assert data["subscriber_id"] == subscriber_id
            assert data["status"] == "active"

    def test_reactivate_non_suspended_subscriber(
        self,
        client: TestClient,
        test_user: UserInfo,
        mock_db: AsyncMock,
    ):
        """Test reactivating non-suspended subscriber fails."""
        subscriber_id = f"{test_user.tenant_id}_testuser"

        # Create mock service instance
        mock_service = AsyncMock()
        # Configure reactivate_subscriber - will be set below
        with patch(
            "dotmac.platform.services.router.OrchestrationService", return_value=mock_service
        ):
            mock_service.reactivate_subscriber.side_effect = ValidationError(
                "Subscriber must be suspended to reactivate"
            )

            response = client.post(
                f"/api/v1/orchestration/subscribers/{subscriber_id}/reactivate",
            )

            assert response.status_code == 400
            assert "must be suspended" in response.json()["detail"]


class TestTransactionRollback:
    """Test transaction rollback on errors."""

    def test_convert_lead_rolls_back_on_error(
        self,
        client: TestClient,
        test_user: UserInfo,
        mock_db: AsyncMock,
    ):
        """Test database rollback when conversion fails."""
        # Create mock service instance

        mock_service = AsyncMock()

        # Configure convert_lead_to_customer - will be set below

        with patch(
            "dotmac.platform.services.router.OrchestrationService", return_value=mock_service
        ):
            mock_service.convert_lead_to_customer.side_effect = Exception("Unexpected error")

            payload = {
                "lead_id": str(uuid4()),
                "accepted_quote_id": str(uuid4()),
            }

            response = client.post("/api/v1/orchestration/leads/convert", json=payload)

            assert response.status_code == 500
            mock_db.rollback.assert_called()

    def test_provision_subscriber_rolls_back_on_error(
        self,
        client: TestClient,
        test_user: UserInfo,
        mock_db: AsyncMock,
    ):
        """Test database rollback when provisioning fails."""
        # Create mock service instance

        mock_service = AsyncMock()

        # Configure provision_subscriber - will be set below

        with patch(
            "dotmac.platform.services.router.OrchestrationService", return_value=mock_service
        ):
            mock_service.provision_subscriber.side_effect = Exception("RADIUS service unavailable")

            payload = {
                "customer_id": str(uuid4()),
                "username": "testuser",
                "password": "securepass123",
                "service_plan": "100M",
                "download_speed_kbps": 100000,
                "upload_speed_kbps": 50000,
            }

            response = client.post("/api/v1/orchestration/subscribers/provision", json=payload)

            assert response.status_code == 500
            mock_db.rollback.assert_called()
