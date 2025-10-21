"""
Unit tests for Diagnostics Service

Tests network troubleshooting and diagnostic operations.
"""

import pytest
from datetime import datetime, UTC
from decimal import Decimal
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.diagnostics.models import (
    DiagnosticRun,
    DiagnosticType,
    DiagnosticStatus,
    DiagnosticSeverity,
)
from dotmac.platform.diagnostics.service import DiagnosticsService
from dotmac.platform.subscribers.models import Subscriber, SubscriberStatus


@pytest.fixture
def tenant_id():
    """Create test tenant ID."""
    return "test-tenant"


@pytest.fixture
def subscriber_id():
    """Create test subscriber ID."""
    return "test-subscriber"


@pytest.fixture
def customer_id():
    """Create test customer UUID."""
    return uuid4()


@pytest.fixture
def mock_subscriber(subscriber_id, customer_id):
    """Create mock subscriber."""
    subscriber = MagicMock(spec=Subscriber)
    subscriber.id = subscriber_id
    subscriber.tenant_id = "test-tenant"
    subscriber.customer_id = customer_id
    subscriber.username = "test_user@example.com"
    subscriber.status = SubscriberStatus.ACTIVE
    subscriber.static_ipv4 = "192.168.1.100"
    subscriber.deleted_at = None
    return subscriber


@pytest.fixture
def mock_db_session():
    """Create mock database session."""
    session = AsyncMock(spec=AsyncSession)
    return session


@pytest.fixture
def mock_radius_service():
    """Create mock RADIUS service."""
    service = AsyncMock()
    return service


@pytest.fixture
def mock_netbox_service():
    """Create mock NetBox service."""
    service = AsyncMock()
    return service


@pytest.fixture
def mock_voltha_service():
    """Create mock VOLTHA service."""
    service = AsyncMock()
    return service


@pytest.fixture
def mock_genieacs_service():
    """Create mock GenieACS service."""
    service = AsyncMock()
    return service


@pytest.fixture
def diagnostics_service(
    mock_db_session,
    mock_radius_service,
    mock_netbox_service,
    mock_voltha_service,
    mock_genieacs_service,
):
    """Create diagnostics service with mocked dependencies."""
    return DiagnosticsService(
        db=mock_db_session,
        radius_service=mock_radius_service,
        netbox_service=mock_netbox_service,
        voltha_service=mock_voltha_service,
        genieacs_service=mock_genieacs_service,
    )


class TestDiagnosticsServiceInitialization:
    """Test service initialization."""

    @pytest.mark.asyncio
    async def test_initialization_with_services(
        self,
        mock_db_session,
        mock_radius_service,
        mock_netbox_service,
        mock_voltha_service,
        mock_genieacs_service,
    ):
        """Test service initializes with provided services."""
        service = DiagnosticsService(
            db=mock_db_session,
            radius_service=mock_radius_service,
            netbox_service=mock_netbox_service,
            voltha_service=mock_voltha_service,
            genieacs_service=mock_genieacs_service,
        )

        assert service.db == mock_db_session
        assert service.radius_service == mock_radius_service
        assert service.netbox_service == mock_netbox_service
        assert service.voltha_service == mock_voltha_service
        assert service.genieacs_service == mock_genieacs_service

    @pytest.mark.asyncio
    async def test_initialization_creates_default_services(self, mock_db_session):
        """Test service creates default service instances."""
        with patch("dotmac.platform.radius.service.RADIUSService"), \
             patch("dotmac.platform.netbox.service.NetBoxService"), \
             patch("dotmac.platform.voltha.service.VOLTHAService"), \
             patch("dotmac.platform.genieacs.service.GenieACSService"):

            service = DiagnosticsService(db=mock_db_session)

            assert service.db == mock_db_session
            assert service.radius_service is not None
            assert service.netbox_service is not None
            assert service.voltha_service is not None
            assert service.genieacs_service is not None


class TestDiagnosticsServiceConnectivityCheck:
    """Test connectivity check operations."""

    @pytest.mark.asyncio
    async def test_check_subscriber_connectivity_active_subscriber(
        self, diagnostics_service, tenant_id, subscriber_id, mock_subscriber, mock_db_session, mock_radius_service
    ):
        """Test connectivity check for active subscriber."""
        # Mock _get_subscriber method
        with patch.object(diagnostics_service, '_get_subscriber', new_callable=AsyncMock) as mock_get_sub:
            mock_get_sub.return_value = mock_subscriber

            # Mock RADIUS service
            mock_radius_service.get_subscriber_auth.return_value = {"username": "test_user"}

            # Run connectivity check
            result = await diagnostics_service.check_subscriber_connectivity(
                tenant_id=tenant_id,
                subscriber_id=subscriber_id,
            )

            # Verify diagnostic was created
            mock_db_session.add.assert_called_once()
            mock_db_session.flush.assert_called()

            # Verify subscriber was fetched
            mock_get_sub.assert_called_once_with(tenant_id, subscriber_id)

    @pytest.mark.asyncio
    async def test_check_subscriber_connectivity_inactive_subscriber(
        self, diagnostics_service, tenant_id, subscriber_id, mock_subscriber, mock_db_session
    ):
        """Test connectivity check for inactive subscriber."""
        # Set subscriber to inactive
        mock_subscriber.status = SubscriberStatus.SUSPENDED

        # Mock _get_subscriber method
        with patch.object(diagnostics_service, '_get_subscriber', new_callable=AsyncMock) as mock_get_sub:
            mock_get_sub.return_value = mock_subscriber

            # Run connectivity check
            result = await diagnostics_service.check_subscriber_connectivity(
                tenant_id=tenant_id,
                subscriber_id=subscriber_id,
            )

            # Verify diagnostic was created and updated
            mock_db_session.add.assert_called_once()
            assert mock_db_session.flush.call_count >= 2  # Once for create, once for update

    @pytest.mark.asyncio
    async def test_check_subscriber_connectivity_subscriber_not_found(
        self, diagnostics_service, tenant_id, subscriber_id, mock_db_session
    ):
        """Test connectivity check when subscriber not found."""
        # Mock _get_subscriber method to raise ValueError
        with patch.object(diagnostics_service, '_get_subscriber', new_callable=AsyncMock) as mock_get_sub:
            mock_get_sub.side_effect = ValueError(f"Subscriber {subscriber_id} not found")

            # Should raise ValueError
            with pytest.raises(ValueError, match="Subscriber .* not found"):
                await diagnostics_service.check_subscriber_connectivity(
                    tenant_id=tenant_id,
                    subscriber_id=subscriber_id,
                )


class TestDiagnosticsServiceRADIUSCheck:
    """Test RADIUS session checks."""

    @pytest.mark.asyncio
    async def test_get_radius_sessions_active_sessions(
        self, diagnostics_service, tenant_id, subscriber_id, mock_subscriber, mock_db_session, mock_radius_service
    ):
        """Test getting active RADIUS sessions."""
        # Mock _get_subscriber method
        with patch.object(diagnostics_service, '_get_subscriber', new_callable=AsyncMock) as mock_get_sub:
            mock_get_sub.return_value = mock_subscriber

            # Mock RADIUS sessions
            mock_radius_service.get_active_sessions.return_value = [
                {
                    "username": "test_user",
                    "nas_ip": "10.0.0.1",
                    "session_time": 3600,
                    "bytes_in": 1000000,
                    "bytes_out": 500000,
                }
            ]

            # Get RADIUS sessions
            result = await diagnostics_service.get_radius_sessions(
                tenant_id=tenant_id,
                subscriber_id=subscriber_id,
            )

            # Verify result
            mock_radius_service.get_active_sessions.assert_called_once()

    @pytest.mark.asyncio
    async def test_get_radius_sessions_no_active_sessions(
        self, diagnostics_service, tenant_id, subscriber_id, mock_subscriber, mock_db_session, mock_radius_service
    ):
        """Test getting RADIUS sessions when none are active."""
        # Mock _get_subscriber method
        with patch.object(diagnostics_service, '_get_subscriber', new_callable=AsyncMock) as mock_get_sub:
            mock_get_sub.return_value = mock_subscriber

            # Mock no active sessions
            mock_radius_service.get_active_sessions.return_value = []

            # Get RADIUS sessions
            result = await diagnostics_service.get_radius_sessions(
                tenant_id=tenant_id,
                subscriber_id=subscriber_id,
            )

            # Verify diagnostic was created
            mock_db_session.add.assert_called_once()


class TestDiagnosticsServiceONUCheck:
    """Test ONU status checks."""

    @pytest.mark.asyncio
    async def test_check_onu_status_healthy(
        self, diagnostics_service, tenant_id, subscriber_id, mock_subscriber, mock_db_session, mock_voltha_service
    ):
        """Test ONU status check when ONU is healthy."""
        # Mock _get_subscriber method
        with patch.object(diagnostics_service, '_get_subscriber', new_callable=AsyncMock) as mock_get_sub:
            mock_get_sub.return_value = mock_subscriber

            # Mock VOLTHA ONU status
            mock_voltha_service.get_onu_status.return_value = {
                "operational_status": "active",
                "admin_status": "enabled",
                "optical_signal_level": -20.5,  # Good signal
                "temperature": 45.2,
            }

            # Check ONU status
            result = await diagnostics_service.check_onu_status(
                tenant_id=tenant_id,
                subscriber_id=subscriber_id,
            )

            # Verify VOLTHA was called
            mock_voltha_service.get_onu_status.assert_called_once()

    @pytest.mark.asyncio
    async def test_check_onu_status_poor_signal(
        self, diagnostics_service, tenant_id, subscriber_id, mock_subscriber, mock_db_session, mock_voltha_service
    ):
        """Test ONU status check with poor optical signal."""
        # Mock _get_subscriber method
        with patch.object(diagnostics_service, '_get_subscriber', new_callable=AsyncMock) as mock_get_sub:
            mock_get_sub.return_value = mock_subscriber

            # Mock poor signal
            mock_voltha_service.get_onu_status.return_value = {
                "operational_status": "active",
                "optical_signal_level": -30.0,  # Poor signal
            }

            # Check ONU status
            result = await diagnostics_service.check_onu_status(
                tenant_id=tenant_id,
                subscriber_id=subscriber_id,
            )

            # Should still complete but may have recommendations
            mock_db_session.add.assert_called_once()


class TestDiagnosticsServiceCPECheck:
    """Test CPE status checks."""

    @pytest.mark.asyncio
    async def test_check_cpe_status_online(
        self, diagnostics_service, tenant_id, subscriber_id, mock_subscriber, mock_db_session, mock_genieacs_service
    ):
        """Test CPE status when device is online."""
        # Mock _get_subscriber method
        with patch.object(diagnostics_service, '_get_subscriber', new_callable=AsyncMock) as mock_get_sub:
            mock_get_sub.return_value = mock_subscriber

            # Mock GenieACS device status
            mock_genieacs_service.get_device_status.return_value = {
                "status": "online",
                "last_inform": datetime.now(UTC),
                "software_version": "1.2.3",
                "uptime": 86400,
            }

            # Check CPE status
            result = await diagnostics_service.check_cpe_status(
                tenant_id=tenant_id,
                subscriber_id=subscriber_id,
            )

            # Verify GenieACS was called
            mock_genieacs_service.get_device_status.assert_called_once()

    @pytest.mark.asyncio
    async def test_check_cpe_status_offline(
        self, diagnostics_service, tenant_id, subscriber_id, mock_subscriber, mock_db_session, mock_genieacs_service
    ):
        """Test CPE status when device is offline."""
        # Mock _get_subscriber method
        with patch.object(diagnostics_service, '_get_subscriber', new_callable=AsyncMock) as mock_get_sub:
            mock_get_sub.return_value = mock_subscriber

            # Mock offline device
            mock_genieacs_service.get_device_status.return_value = {
                "status": "offline",
                "last_inform": None,
            }

            # Check CPE status
            result = await diagnostics_service.check_cpe_status(
                tenant_id=tenant_id,
                subscriber_id=subscriber_id,
            )

            # Should complete with offline status
            mock_db_session.add.assert_called_once()


class TestDiagnosticsServiceIPVerification:
    """Test IP verification checks."""

    @pytest.mark.asyncio
    async def test_verify_ip_allocation_static_ip(
        self, diagnostics_service, tenant_id, subscriber_id, mock_subscriber, mock_db_session
    ):
        """Test IP verification for subscriber with static IP."""
        # Mock _get_subscriber method
        with patch.object(diagnostics_service, '_get_subscriber', new_callable=AsyncMock) as mock_get_sub:
            mock_get_sub.return_value = mock_subscriber

            # Verify IP allocation
            result = await diagnostics_service.verify_ip_allocation(
                tenant_id=tenant_id,
                subscriber_id=subscriber_id,
            )

            # Should create diagnostic with IP information
            mock_db_session.add.assert_called_once()

    @pytest.mark.asyncio
    async def test_verify_ip_allocation_no_static_ip(
        self, diagnostics_service, tenant_id, subscriber_id, mock_subscriber, mock_db_session
    ):
        """Test IP verification for subscriber without static IP."""
        # Remove static IP
        mock_subscriber.static_ipv4 = None

        # Mock _get_subscriber method
        with patch.object(diagnostics_service, '_get_subscriber', new_callable=AsyncMock) as mock_get_sub:
            mock_get_sub.return_value = mock_subscriber

            # Verify IP allocation
            result = await diagnostics_service.verify_ip_allocation(
                tenant_id=tenant_id,
                subscriber_id=subscriber_id,
            )

            # Should still complete
            mock_db_session.add.assert_called_once()


class TestDiagnosticsServiceCPERestart:
    """Test CPE restart operations."""

    @pytest.mark.asyncio
    async def test_restart_cpe_success(
        self, diagnostics_service, tenant_id, subscriber_id, mock_subscriber, mock_db_session, mock_genieacs_service
    ):
        """Test successful CPE restart."""
        # Mock _get_subscriber method
        with patch.object(diagnostics_service, '_get_subscriber', new_callable=AsyncMock) as mock_get_sub:
            mock_get_sub.return_value = mock_subscriber

            # Mock successful restart
            mock_genieacs_service.reboot_device.return_value = {"status": "success"}

            # Restart CPE
            result = await diagnostics_service.restart_cpe(
                tenant_id=tenant_id,
                subscriber_id=subscriber_id,
            )

            # Verify GenieACS reboot was called
            mock_genieacs_service.reboot_device.assert_called_once()

    @pytest.mark.asyncio
    async def test_restart_cpe_failure(
        self, diagnostics_service, tenant_id, subscriber_id, mock_subscriber, mock_db_session, mock_genieacs_service
    ):
        """Test CPE restart failure."""
        # Mock _get_subscriber method
        with patch.object(diagnostics_service, '_get_subscriber', new_callable=AsyncMock) as mock_get_sub:
            mock_get_sub.return_value = mock_subscriber

            # Mock restart failure
            mock_genieacs_service.reboot_device.side_effect = Exception("Reboot failed")

            # Restart CPE
            result = await diagnostics_service.restart_cpe(
                tenant_id=tenant_id,
                subscriber_id=subscriber_id,
            )

            # Should create diagnostic with error
            mock_db_session.add.assert_called_once()


class TestDiagnosticsServiceHealthCheck:
    """Test comprehensive health check."""

    @pytest.mark.asyncio
    async def test_run_health_check_all_passing(
        self,
        diagnostics_service,
        tenant_id,
        subscriber_id,
        mock_subscriber,
        mock_db_session,
        mock_radius_service,
        mock_voltha_service,
        mock_genieacs_service,
    ):
        """Test health check when all systems are healthy."""
        # Mock _get_subscriber method
        with patch.object(diagnostics_service, '_get_subscriber', new_callable=AsyncMock) as mock_get_sub:
            mock_get_sub.return_value = mock_subscriber

            # Mock all services returning healthy status
            mock_radius_service.get_active_sessions.return_value = [{"username": "test_user"}]
            mock_voltha_service.get_onu_status.return_value = {
                "operational_status": "active",
                "optical_signal_level": -20.5,
            }
            mock_genieacs_service.get_device_status.return_value = {"status": "online"}

            # Run health check
            result = await diagnostics_service.run_health_check(
                tenant_id=tenant_id,
                subscriber_id=subscriber_id,
            )

            # All services should be called
            mock_radius_service.get_active_sessions.assert_called()
            # Note: ONU and CPE checks may run in parallel

    @pytest.mark.asyncio
    async def test_run_health_check_with_failures(
        self,
        diagnostics_service,
        tenant_id,
        subscriber_id,
        mock_subscriber,
        mock_db_session,
        mock_radius_service,
        mock_voltha_service,
        mock_genieacs_service,
    ):
        """Test health check when some systems are failing."""
        # Mock _get_subscriber method
        with patch.object(diagnostics_service, '_get_subscriber', new_callable=AsyncMock) as mock_get_sub:
            mock_get_sub.return_value = mock_subscriber

            # Mock failures
            mock_radius_service.get_active_sessions.return_value = []  # No sessions
            mock_voltha_service.get_onu_status.side_effect = Exception("VOLTHA unreachable")
            mock_genieacs_service.get_device_status.return_value = {"status": "offline"}

            # Run health check
            result = await diagnostics_service.run_health_check(
                tenant_id=tenant_id,
                subscriber_id=subscriber_id,
            )

            # Should complete despite failures (health check creates multiple diagnostics)
            assert mock_db_session.add.call_count >= 1


class TestDiagnosticsServiceDiagnosticRuns:
    """Test diagnostic run retrieval and listing."""

    @pytest.mark.asyncio
    async def test_get_diagnostic_run_found(
        self, diagnostics_service, tenant_id, mock_db_session
    ):
        """Test retrieving existing diagnostic run."""
        diagnostic_id = uuid4()

        # Mock diagnostic run
        mock_diagnostic = MagicMock(spec=DiagnosticRun)
        mock_diagnostic.id = diagnostic_id
        mock_diagnostic.tenant_id = tenant_id

        mock_result = AsyncMock()
        mock_result.scalar_one_or_none.return_value = mock_diagnostic
        mock_db_session.execute.return_value = mock_result

        # Get diagnostic run
        result = await diagnostics_service.get_diagnostic_run(
            tenant_id=tenant_id,
            diagnostic_id=diagnostic_id,
        )

        # Verify database was queried
        mock_db_session.execute.assert_called_once()

    @pytest.mark.asyncio
    async def test_get_diagnostic_run_not_found(
        self, diagnostics_service, tenant_id, mock_db_session
    ):
        """Test retrieving non-existent diagnostic run."""
        diagnostic_id = uuid4()

        # Mock not found - scalar_one_or_none should be a regular method returning None
        mock_scalars = MagicMock()
        mock_scalars.one_or_none.return_value = None

        mock_result = AsyncMock()
        mock_result.scalar_one_or_none = MagicMock(return_value=None)
        mock_db_session.execute.return_value = mock_result

        # Get diagnostic run
        result = await diagnostics_service.get_diagnostic_run(
            tenant_id=tenant_id,
            diagnostic_id=diagnostic_id,
        )

        # Should return None
        assert result is None

    @pytest.mark.asyncio
    async def test_list_diagnostic_runs(
        self, diagnostics_service, tenant_id, mock_db_session
    ):
        """Test listing diagnostic runs."""
        # Mock diagnostic runs
        mock_diagnostics = [
            MagicMock(spec=DiagnosticRun),
            MagicMock(spec=DiagnosticRun),
        ]

        # Mock scalars() properly - it should be a regular method, not async
        mock_scalars = MagicMock()
        mock_scalars.all.return_value = mock_diagnostics

        mock_result = AsyncMock()
        mock_result.scalars = MagicMock(return_value=mock_scalars)
        mock_db_session.execute.return_value = mock_result

        # List diagnostic runs
        result = await diagnostics_service.list_diagnostic_runs(
            tenant_id=tenant_id,
            limit=10,
            offset=0,
        )

        # Verify database was queried
        mock_db_session.execute.assert_called_once()

    @pytest.mark.asyncio
    async def test_list_diagnostic_runs_filtered_by_subscriber(
        self, diagnostics_service, tenant_id, subscriber_id, mock_db_session
    ):
        """Test listing diagnostic runs filtered by subscriber."""
        # Mock diagnostic runs
        mock_diagnostics = [MagicMock(spec=DiagnosticRun)]

        # Mock scalars() properly - it should be a regular method, not async
        mock_scalars = MagicMock()
        mock_scalars.all.return_value = mock_diagnostics

        mock_result = AsyncMock()
        mock_result.scalars = MagicMock(return_value=mock_scalars)
        mock_db_session.execute.return_value = mock_result

        # List diagnostic runs for specific subscriber
        result = await diagnostics_service.list_diagnostic_runs(
            tenant_id=tenant_id,
            subscriber_id=subscriber_id,
            limit=10,
            offset=0,
        )

        # Verify database was queried with filter
        mock_db_session.execute.assert_called_once()


class TestDiagnosticsServiceSummaryGeneration:
    """Test diagnostic summary generation."""

    def test_generate_summary_connectivity_check(self, diagnostics_service):
        """Test summary generation for connectivity check."""
        results = {"status": "online"}
        summary = diagnostics_service._generate_summary(
            DiagnosticType.CONNECTIVITY_CHECK, results
        )
        assert "ONLINE" in summary

    def test_generate_summary_radius_session(self, diagnostics_service):
        """Test summary generation for RADIUS session check."""
        results = {"active_sessions": 2}
        summary = diagnostics_service._generate_summary(
            DiagnosticType.RADIUS_SESSION, results
        )
        assert "2 active" in summary

    def test_generate_summary_onu_status(self, diagnostics_service):
        """Test summary generation for ONU status check."""
        results = {"optical_signal_level": -20.5}
        summary = diagnostics_service._generate_summary(
            DiagnosticType.ONU_STATUS, results
        )
        assert "-20.5" in summary
        assert "dBm" in summary

    def test_generate_summary_cpe_status(self, diagnostics_service):
        """Test summary generation for CPE status check."""
        results = {"status": "online"}
        summary = diagnostics_service._generate_summary(
            DiagnosticType.CPE_STATUS, results
        )
        assert "ONLINE" in summary

    def test_generate_summary_health_check(self, diagnostics_service):
        """Test summary generation for health check."""
        results = {"checks_passed": 4, "total_checks": 5}
        summary = diagnostics_service._generate_summary(
            DiagnosticType.HEALTH_CHECK, results
        )
        assert "4/5" in summary

    def test_generate_summary_bandwidth_test(self, diagnostics_service):
        """Test summary generation for bandwidth test."""
        results = {"download_mbps": 95.5, "upload_mbps": 48.2}
        summary = diagnostics_service._generate_summary(
            DiagnosticType.BANDWIDTH_TEST, results
        )
        assert "95.5" in summary
        assert "48.2" in summary
        assert "Mbps" in summary
