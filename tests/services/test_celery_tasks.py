"""
Unit tests for Celery tasks in services/tasks.py.

Tests argument translation, retry behavior, and serialization without
requiring a running Celery worker.
"""

from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, Mock, patch
from uuid import UUID, uuid4

import pytest

from dotmac.platform.services.tasks import (
    convert_lead_to_customer_async,
    deprovision_subscriber_async,
    provision_subscriber_async,
)


@pytest.fixture
def mock_task_request():
    """Create a mock Celery task request."""
    request = Mock()
    request.id = "task_123"
    request.retries = 0
    return request


@pytest.fixture
def mock_celery_task():
    """Create a mock Celery task with retry capability."""
    task = Mock()
    task.request = Mock()
    task.request.id = "task_123"
    task.request.retries = 0
    task.retry = Mock(side_effect=Exception("Retry called"))
    return task


class TestProvisionSubscriberAsync:
    """Test async subscriber provisioning Celery task."""

    @patch("dotmac.platform.services.tasks.get_async_session")
    @patch("dotmac.platform.services.tasks.OrchestrationService")
    @patch("asyncio.run")
    def test_provision_subscriber_success(
        self,
        mock_asyncio_run: Mock,
        mock_service_class: Mock,
        mock_get_session: Mock,
        mock_celery_task: Mock,
    ):
        """Test successful subscriber provisioning."""
        tenant_id = "test_tenant"
        customer_id = str(uuid4())
        subscriber_id = f"{tenant_id}_testuser"

        # Mock OrchestrationService
        mock_service = AsyncMock()
        mock_subscriber = Mock()
        mock_subscriber.id = subscriber_id
        mock_customer = Mock()
        mock_customer.id = UUID(customer_id)

        mock_service.provision_subscriber = AsyncMock(
            return_value={
                "subscriber": mock_subscriber,
                "customer": mock_customer,
                "ip_allocation": {"address": "10.0.0.100", "id": 123},
                "voltha_status": {"onu_id": "onu_123"},
                "genieacs_status": {"device_id": "device_123"},
                "provisioning_date": datetime.utcnow(),
            }
        )
        mock_service_class.return_value = mock_service

        # Mock async session
        async def mock_session_gen():
            yield AsyncMock()

        mock_get_session.return_value = mock_session_gen()

        # Mock asyncio.run to actually execute the coroutine
        def run_coro(coro):
            import asyncio

            loop = asyncio.new_event_loop()
            try:
                return loop.run_until_complete(coro)
            finally:
                loop.close()

        mock_asyncio_run.side_effect = run_coro

        # Execute task
        result = provision_subscriber_async(
            mock_celery_task,
            tenant_id=tenant_id,
            customer_id=customer_id,
            username="testuser",
            password="password123",
            service_plan="100M",
            download_speed_kbps=100000,
            upload_speed_kbps=50000,
            onu_serial="ABCD12345678",
            cpe_mac_address="AA:BB:CC:DD:EE:FF",
            site_id="site_1",
            user_id=str(uuid4()),
        )

        # Verify result structure
        assert result["subscriber_id"] == subscriber_id
        assert result["customer_id"] == customer_id
        assert result["ip_allocation"]["address"] == "10.0.0.100"
        assert "provisioning_date" in result

    @patch("dotmac.platform.services.tasks.get_async_session")
    @patch("dotmac.platform.services.tasks.OrchestrationService")
    def test_provision_subscriber_uuid_conversion(
        self,
        mock_service_class: Mock,
        mock_get_session: Mock,
        mock_celery_task: Mock,
    ):
        """Test that string UUIDs are converted to UUID objects."""
        tenant_id = "test_tenant"
        customer_id = str(uuid4())
        user_id = str(uuid4())

        mock_service = AsyncMock()
        mock_service.provision_subscriber = AsyncMock(
            return_value={
                "subscriber": Mock(id=f"{tenant_id}_test"),
                "customer": Mock(id=UUID(customer_id)),
                "provisioning_date": datetime.utcnow(),
            }
        )
        mock_service_class.return_value = mock_service

        async def mock_session_gen():
            yield AsyncMock()

        mock_get_session.return_value = mock_session_gen()

        with patch("asyncio.run") as mock_run:

            def run_coro(coro):
                import asyncio

                loop = asyncio.new_event_loop()
                try:
                    return loop.run_until_complete(coro)
                finally:
                    loop.close()

            mock_run.side_effect = run_coro

            provision_subscriber_async(
                mock_celery_task,
                tenant_id=tenant_id,
                customer_id=customer_id,
                username="testuser",
                password="password123",
                service_plan="100M",
                download_speed_kbps=100000,
                upload_speed_kbps=50000,
                user_id=user_id,
            )

            # Verify UUIDs were converted
            call_kwargs = mock_service.provision_subscriber.call_args[1]
            assert isinstance(call_kwargs["customer_id"], UUID)
            assert isinstance(call_kwargs["user_id"], UUID)
            assert str(call_kwargs["customer_id"]) == customer_id
            assert str(call_kwargs["user_id"]) == user_id

    @patch("dotmac.platform.services.tasks.get_async_session")
    @patch("dotmac.platform.services.tasks.OrchestrationService")
    def test_provision_subscriber_retry_on_failure(
        self,
        mock_service_class: Mock,
        mock_get_session: Mock,
        mock_celery_task: Mock,
    ):
        """Test retry behavior on provisioning failure."""
        mock_celery_task.request.retries = 1  # Second attempt

        # Mock service to raise exception
        mock_service = AsyncMock()
        mock_service.provision_subscriber = AsyncMock(side_effect=Exception("RADIUS unavailable"))
        mock_service_class.return_value = mock_service

        async def mock_session_gen():
            yield AsyncMock()

        mock_get_session.return_value = mock_session_gen()

        with patch("asyncio.run") as mock_run:
            mock_run.side_effect = Exception("RADIUS unavailable")

            with pytest.raises(Exception):
                provision_subscriber_async(
                    mock_celery_task,
                    tenant_id="test_tenant",
                    customer_id=str(uuid4()),
                    username="testuser",
                    password="password123",
                    service_plan="100M",
                    download_speed_kbps=100000,
                    upload_speed_kbps=50000,
                )

            # Verify retry was called with exponential backoff
            mock_celery_task.retry.assert_called_once()
            call_kwargs = mock_celery_task.retry.call_args[1]
            # Retry countdown should be 60 * (2^1) = 120 seconds
            assert call_kwargs["countdown"] == 120

    @patch("dotmac.platform.services.tasks.get_async_session")
    @patch("dotmac.platform.services.tasks.OrchestrationService")
    def test_provision_subscriber_serialization(
        self,
        mock_service_class: Mock,
        mock_get_session: Mock,
        mock_celery_task: Mock,
    ):
        """Test that non-serializable objects are converted to dicts."""
        # Mock service
        mock_service = AsyncMock()
        mock_service.provision_subscriber = AsyncMock(
            return_value={
                "subscriber": Mock(id="sub_123"),
                "customer": Mock(id=uuid4()),
                "ip_allocation": {"address": "10.0.0.100"},
                "provisioning_date": datetime(2025, 10, 26, 12, 0, 0),
            }
        )
        mock_service_class.return_value = mock_service

        async def mock_session_gen():
            yield AsyncMock()

        mock_get_session.return_value = mock_session_gen()

        with patch("asyncio.run") as mock_run:

            def run_coro(coro):
                import asyncio

                loop = asyncio.new_event_loop()
                try:
                    return loop.run_until_complete(coro)
                finally:
                    loop.close()

            mock_run.side_effect = run_coro

            result = provision_subscriber_async(
                mock_celery_task,
                tenant_id="test_tenant",
                customer_id=str(uuid4()),
                username="testuser",
                password="password123",
                service_plan="100M",
                download_speed_kbps=100000,
                upload_speed_kbps=50000,
            )

            # Verify datetime is serialized to ISO format
            assert isinstance(result["provisioning_date"], str)
            assert "2025-10-26" in result["provisioning_date"]


class TestDeprovisionSubscriberAsync:
    """Test async subscriber deprovisioning Celery task."""

    @patch("dotmac.platform.services.tasks.get_async_session")
    @patch("dotmac.platform.services.tasks.OrchestrationService")
    @patch("asyncio.run")
    def test_deprovision_subscriber_success(
        self,
        mock_asyncio_run: Mock,
        mock_service_class: Mock,
        mock_get_session: Mock,
        mock_celery_task: Mock,
    ):
        """Test successful subscriber deprovisioning."""
        tenant_id = "test_tenant"
        subscriber_id = f"{tenant_id}_testuser"

        mock_service = AsyncMock()
        mock_service.deprovision_subscriber = AsyncMock(
            return_value={
                "subscriber": Mock(id=subscriber_id),
                "session_termination": {"success": True},
                "cpe_removal": {"success": True},
                "onu_removal": {"success": True},
                "ip_release": {"success": True},
                "deprovisioning_date": datetime.utcnow(),
            }
        )
        mock_service_class.return_value = mock_service

        async def mock_session_gen():
            yield AsyncMock()

        mock_get_session.return_value = mock_session_gen()

        def run_coro(coro):
            import asyncio

            loop = asyncio.new_event_loop()
            try:
                return loop.run_until_complete(coro)
            finally:
                loop.close()

        mock_asyncio_run.side_effect = run_coro

        result = deprovision_subscriber_async(
            mock_celery_task,
            tenant_id=tenant_id,
            subscriber_id=subscriber_id,
            reason="Customer request",
            user_id=str(uuid4()),
        )

        assert result["subscriber_id"] == subscriber_id
        assert "deprovisioning_date" in result

    @patch("dotmac.platform.services.tasks.get_async_session")
    @patch("dotmac.platform.services.tasks.OrchestrationService")
    def test_deprovision_subscriber_retry_on_failure(
        self,
        mock_service_class: Mock,
        mock_get_session: Mock,
        mock_celery_task: Mock,
    ):
        """Test retry behavior on deprovisioning failure."""
        mock_celery_task.request.retries = 2  # Third attempt

        mock_service = AsyncMock()
        mock_service.deprovision_subscriber = AsyncMock(side_effect=Exception("Network error"))
        mock_service_class.return_value = mock_service

        async def mock_session_gen():
            yield AsyncMock()

        mock_get_session.return_value = mock_session_gen()

        with patch("asyncio.run") as mock_run:
            mock_run.side_effect = Exception("Network error")

            with pytest.raises(Exception):
                deprovision_subscriber_async(
                    mock_celery_task,
                    tenant_id="test_tenant",
                    subscriber_id="sub_123",
                    reason="Test",
                )

            # Verify retry with exponential backoff: 60 * (2^2) = 240 seconds
            mock_celery_task.retry.assert_called_once()
            call_kwargs = mock_celery_task.retry.call_args[1]
            assert call_kwargs["countdown"] == 240


class TestConvertLeadToCustomerAsync:
    """Test async lead conversion Celery task."""

    @patch("dotmac.platform.services.tasks.get_async_session")
    @patch("dotmac.platform.services.tasks.OrchestrationService")
    @patch("asyncio.run")
    def test_convert_lead_success(
        self,
        mock_asyncio_run: Mock,
        mock_service_class: Mock,
        mock_get_session: Mock,
        mock_celery_task: Mock,
    ):
        """Test successful lead conversion."""
        tenant_id = "test_tenant"
        lead_id = uuid4()
        quote_id = uuid4()
        customer_id = uuid4()

        mock_service = AsyncMock()
        mock_service.convert_lead_to_customer = AsyncMock(
            return_value={
                "customer": Mock(id=customer_id),
                "lead": Mock(id=lead_id),
                "quote": Mock(id=quote_id),
                "conversion_date": datetime.utcnow(),
            }
        )
        mock_service_class.return_value = mock_service

        async def mock_session_gen():
            yield AsyncMock()

        mock_get_session.return_value = mock_session_gen()

        def run_coro(coro):
            import asyncio

            loop = asyncio.new_event_loop()
            try:
                return loop.run_until_complete(coro)
            finally:
                loop.close()

        mock_asyncio_run.side_effect = run_coro

        result = convert_lead_to_customer_async(
            mock_celery_task,
            tenant_id=tenant_id,
            lead_id=str(lead_id),
            accepted_quote_id=str(quote_id),
            user_id=str(uuid4()),
        )

        assert result["customer_id"] == str(customer_id)
        assert result["lead_id"] == str(lead_id)
        assert result["quote_id"] == str(quote_id)
        assert "conversion_date" in result

    @patch("dotmac.platform.services.tasks.get_async_session")
    @patch("dotmac.platform.services.tasks.OrchestrationService")
    def test_convert_lead_uuid_conversion(
        self,
        mock_service_class: Mock,
        mock_get_session: Mock,
        mock_celery_task: Mock,
    ):
        """Test UUID string to UUID object conversion."""
        tenant_id = "test_tenant"
        lead_id = str(uuid4())
        quote_id = str(uuid4())
        user_id = str(uuid4())

        mock_service = AsyncMock()
        mock_service.convert_lead_to_customer = AsyncMock(
            return_value={
                "customer": Mock(id=uuid4()),
                "lead": Mock(id=UUID(lead_id)),
                "quote": Mock(id=UUID(quote_id)),
                "conversion_date": datetime.utcnow(),
            }
        )
        mock_service_class.return_value = mock_service

        async def mock_session_gen():
            yield AsyncMock()

        mock_get_session.return_value = mock_session_gen()

        with patch("asyncio.run") as mock_run:

            def run_coro(coro):
                import asyncio

                loop = asyncio.new_event_loop()
                try:
                    return loop.run_until_complete(coro)
                finally:
                    loop.close()

            mock_run.side_effect = run_coro

            convert_lead_to_customer_async(
                mock_celery_task,
                tenant_id=tenant_id,
                lead_id=lead_id,
                accepted_quote_id=quote_id,
                user_id=user_id,
            )

            # Verify UUIDs were converted
            call_kwargs = mock_service.convert_lead_to_customer.call_args[1]
            assert isinstance(call_kwargs["lead_id"], UUID)
            assert isinstance(call_kwargs["accepted_quote_id"], UUID)
            assert isinstance(call_kwargs["user_id"], UUID)

    @patch("dotmac.platform.services.tasks.get_async_session")
    @patch("dotmac.platform.services.tasks.OrchestrationService")
    def test_convert_lead_no_retry_on_failure(
        self,
        mock_service_class: Mock,
        mock_get_session: Mock,
        mock_celery_task: Mock,
    ):
        """Test that lead conversion does not retry (no max_retries set)."""
        mock_service = AsyncMock()
        mock_service.convert_lead_to_customer = AsyncMock(
            side_effect=Exception("Validation error")
        )
        mock_service_class.return_value = mock_service

        async def mock_session_gen():
            yield AsyncMock()

        mock_get_session.return_value = mock_session_gen()

        with patch("asyncio.run") as mock_run:
            mock_run.side_effect = Exception("Validation error")

            # Should raise exception without retrying
            with pytest.raises(Exception, match="Validation error"):
                convert_lead_to_customer_async(
                    mock_celery_task,
                    tenant_id="test_tenant",
                    lead_id=str(uuid4()),
                    accepted_quote_id=str(uuid4()),
                )

            # Verify no retry was attempted (convert_lead doesn't use retry)
            mock_celery_task.retry.assert_not_called()


class TestAsyncSessionHandling:
    """Test async session generator handling."""

    @patch("dotmac.platform.services.tasks.get_async_session")
    @patch("dotmac.platform.services.tasks.OrchestrationService")
    def test_session_generator_properly_consumed(
        self,
        mock_service_class: Mock,
        mock_get_session: Mock,
        mock_celery_task: Mock,
    ):
        """Test that async session generator is properly consumed."""
        session_created = False

        async def mock_session_gen():
            nonlocal session_created
            session_created = True
            yield AsyncMock()

        mock_get_session.return_value = mock_session_gen()

        mock_service = AsyncMock()
        mock_service.provision_subscriber = AsyncMock(
            return_value={
                "subscriber": Mock(id="sub_123"),
                "customer": Mock(id=uuid4()),
                "provisioning_date": datetime.utcnow(),
            }
        )
        mock_service_class.return_value = mock_service

        with patch("asyncio.run") as mock_run:

            def run_coro(coro):
                import asyncio

                loop = asyncio.new_event_loop()
                try:
                    return loop.run_until_complete(coro)
                finally:
                    loop.close()

            mock_run.side_effect = run_coro

            provision_subscriber_async(
                mock_celery_task,
                tenant_id="test_tenant",
                customer_id=str(uuid4()),
                username="testuser",
                password="password123",
                service_plan="100M",
                download_speed_kbps=100000,
                upload_speed_kbps=50000,
            )

            # Verify session generator was consumed
            assert session_created
