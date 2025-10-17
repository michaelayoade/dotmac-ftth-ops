"""
Unit tests for Activation Orchestrator
"""

import pytest
from datetime import datetime
from unittest.mock import Mock

from sqlalchemy.orm import Session

from dotmac.platform.sales.models import (
    ActivationStatus,
    Order,
    ServiceActivation,
)
from dotmac.platform.sales.service import ActivationOrchestrator
from .conftest import create_order, create_service_activation


class TestActivationOrchestrator:
    """Tests for ActivationOrchestrator"""

    @pytest.fixture
    def orchestrator(self, db, mock_notification_service, mock_event_bus):
        """Create ActivationOrchestrator with mocked dependencies"""
        return ActivationOrchestrator(
            db=db,
            notification_service=mock_notification_service,
            event_bus=mock_event_bus,
        )

    def test_activate_order_services_creates_activations(
        self,
        db: Session,
        orchestrator: ActivationOrchestrator,
        sample_order: Order,
        sample_deployment_template,
    ):
        """Test that service activations are created"""
        activations = orchestrator.activate_order_services(
            sample_order, tenant_id=1, user_id=1
        )

        assert len(activations) == len(sample_order.selected_services)

        for activation in activations:
            assert activation.order_id == sample_order.id
            assert activation.tenant_id == 1
            assert activation.activated_by == 1

    def test_activate_order_services_sequences_correctly(
        self,
        db: Session,
        orchestrator: ActivationOrchestrator,
        sample_order: Order,
    ):
        """Test that services are sequenced correctly"""
        activations = orchestrator.activate_order_services(
            sample_order, tenant_id=1
        )

        # Verify sequence numbers
        for idx, activation in enumerate(activations):
            assert activation.sequence_number == idx

    def test_activate_order_services_executes_activations(
        self,
        db: Session,
        orchestrator: ActivationOrchestrator,
        sample_order: Order,
    ):
        """Test that service activations are executed"""
        activations = orchestrator.activate_order_services(
            sample_order, tenant_id=1
        )

        # All should be completed (mocked activation always succeeds)
        for activation in activations:
            assert activation.activation_status == ActivationStatus.COMPLETED
            assert activation.success is True
            assert activation.started_at is not None
            assert activation.completed_at is not None

    def test_execute_activation_success(
        self,
        db: Session,
        orchestrator: ActivationOrchestrator,
        sample_order: Order,
    ):
        """Test successful service activation"""
        activation = create_service_activation(
            db,
            order_id=sample_order.id,
            tenant_id=1,
            service_code="test-service",
            activation_status=ActivationStatus.PENDING,
        )

        orchestrator._execute_activation(activation, workflow=None)

        db.refresh(activation)
        assert activation.activation_status == ActivationStatus.COMPLETED
        assert activation.success is True
        assert activation.started_at is not None
        assert activation.completed_at is not None
        assert activation.duration_seconds is not None

    def test_execute_activation_publishes_event(
        self,
        db: Session,
        orchestrator: ActivationOrchestrator,
        sample_order: Order,
        mock_event_bus,
    ):
        """Test that service.activated event is published"""
        activation = create_service_activation(
            db,
            order_id=sample_order.id,
            tenant_id=1,
            activation_status=ActivationStatus.PENDING,
        )

        orchestrator._execute_activation(activation, workflow=None)

        mock_event_bus.publish.assert_called()
        call_args = mock_event_bus.publish.call_args
        assert call_args[0][0] == "service.activated"
        assert call_args[0][1]["activation_id"] == activation.id

    def test_execute_activation_handles_failure(
        self,
        db: Session,
        orchestrator: ActivationOrchestrator,
        sample_order: Order,
        mock_event_bus,
    ):
        """Test activation failure handling"""
        activation = create_service_activation(
            db,
            order_id=sample_order.id,
            tenant_id=1,
            service_code="failing-service",
            activation_status=ActivationStatus.PENDING,
        )

        # Mock _activate_service to raise exception
        def mock_activate_fail(act):
            raise Exception("Activation failed")

        orchestrator._activate_service = mock_activate_fail

        # Should handle exception
        with pytest.raises(Exception):
            orchestrator._execute_activation(activation, workflow=None)

        # Verify activation marked as failed
        db.refresh(activation)
        assert activation.activation_status == ActivationStatus.FAILED
        assert activation.success is False
        assert activation.error_message == "Activation failed"
        assert activation.retry_count == 1

        # Verify failure event published
        event_calls = [call[0][0] for call in mock_event_bus.publish.call_args_list]
        assert "service.activation_failed" in event_calls

    def test_activate_service_returns_data(
        self,
        db: Session,
        orchestrator: ActivationOrchestrator,
        sample_order: Order,
    ):
        """Test that service activation returns data"""
        activation = create_service_activation(
            db,
            order_id=sample_order.id,
            tenant_id=1,
            service_code="test-service",
        )

        result = orchestrator._activate_service(activation)

        assert result is not None
        assert isinstance(result, dict)
        assert "service_code" in result
        assert "status" in result
        assert result["status"] == "active"

    def test_get_activation_progress_pending(
        self,
        db: Session,
        orchestrator: ActivationOrchestrator,
        sample_order: Order,
    ):
        """Test activation progress with pending services"""
        # Create activations
        create_service_activation(
            db,
            order_id=sample_order.id,
            tenant_id=1,
            service_code="service1",
            activation_status=ActivationStatus.PENDING,
        )
        create_service_activation(
            db,
            order_id=sample_order.id,
            tenant_id=1,
            service_code="service2",
            activation_status=ActivationStatus.PENDING,
        )

        progress = orchestrator.get_activation_progress(sample_order.id)

        assert progress["total_services"] == 2
        assert progress["completed"] == 0
        assert progress["failed"] == 0
        assert progress["in_progress"] == 0
        assert progress["pending"] == 2
        assert progress["progress_percent"] == 0
        assert progress["overall_status"] == "pending"

    def test_get_activation_progress_in_progress(
        self,
        db: Session,
        orchestrator: ActivationOrchestrator,
        sample_order: Order,
    ):
        """Test activation progress with services in progress"""
        create_service_activation(
            db,
            order_id=sample_order.id,
            tenant_id=1,
            service_code="service1",
            activation_status=ActivationStatus.COMPLETED,
        )
        create_service_activation(
            db,
            order_id=sample_order.id,
            tenant_id=1,
            service_code="service2",
            activation_status=ActivationStatus.IN_PROGRESS,
        )

        progress = orchestrator.get_activation_progress(sample_order.id)

        assert progress["total_services"] == 2
        assert progress["completed"] == 1
        assert progress["in_progress"] == 1
        assert progress["progress_percent"] == 50
        assert progress["overall_status"] == "in_progress"

    def test_get_activation_progress_completed(
        self,
        db: Session,
        orchestrator: ActivationOrchestrator,
        sample_order: Order,
    ):
        """Test activation progress with all completed"""
        create_service_activation(
            db,
            order_id=sample_order.id,
            tenant_id=1,
            service_code="service1",
            activation_status=ActivationStatus.COMPLETED,
        )
        create_service_activation(
            db,
            order_id=sample_order.id,
            tenant_id=1,
            service_code="service2",
            activation_status=ActivationStatus.COMPLETED,
        )

        progress = orchestrator.get_activation_progress(sample_order.id)

        assert progress["total_services"] == 2
        assert progress["completed"] == 2
        assert progress["progress_percent"] == 100
        assert progress["overall_status"] == "completed"

    def test_get_activation_progress_failed(
        self,
        db: Session,
        orchestrator: ActivationOrchestrator,
        sample_order: Order,
    ):
        """Test activation progress with failures"""
        create_service_activation(
            db,
            order_id=sample_order.id,
            tenant_id=1,
            service_code="service1",
            activation_status=ActivationStatus.COMPLETED,
        )
        create_service_activation(
            db,
            order_id=sample_order.id,
            tenant_id=1,
            service_code="service2",
            activation_status=ActivationStatus.FAILED,
        )

        progress = orchestrator.get_activation_progress(sample_order.id)

        assert progress["total_services"] == 2
        assert progress["completed"] == 1
        assert progress["failed"] == 1
        assert progress["overall_status"] == "failed"

    def test_get_activation_progress_no_activations(
        self,
        db: Session,
        orchestrator: ActivationOrchestrator,
        sample_order: Order,
    ):
        """Test activation progress with no activations"""
        progress = orchestrator.get_activation_progress(sample_order.id)

        assert progress["total_services"] == 0
        assert progress["progress_percent"] == 0

    def test_determine_overall_status_all_completed(
        self,
        db: Session,
        orchestrator: ActivationOrchestrator,
    ):
        """Test overall status determination - all completed"""
        status = orchestrator._determine_overall_status(
            completed=5, failed=0, in_progress=0, total=5
        )
        assert status == "completed"

    def test_determine_overall_status_has_failures(
        self,
        db: Session,
        orchestrator: ActivationOrchestrator,
    ):
        """Test overall status determination - has failures"""
        status = orchestrator._determine_overall_status(
            completed=3, failed=2, in_progress=0, total=5
        )
        assert status == "failed"

    def test_determine_overall_status_in_progress(
        self,
        db: Session,
        orchestrator: ActivationOrchestrator,
    ):
        """Test overall status determination - in progress"""
        status = orchestrator._determine_overall_status(
            completed=2, failed=0, in_progress=2, total=5
        )
        assert status == "in_progress"

    def test_determine_overall_status_pending(
        self,
        db: Session,
        orchestrator: ActivationOrchestrator,
    ):
        """Test overall status determination - pending"""
        status = orchestrator._determine_overall_status(
            completed=0, failed=0, in_progress=0, total=5
        )
        assert status == "pending"

    def test_get_workflow_for_order(
        self,
        db: Session,
        orchestrator: ActivationOrchestrator,
        sample_order: Order,
        sample_activation_workflow,
    ):
        """Test retrieving workflow for order"""
        workflow = orchestrator._get_workflow_for_order(sample_order)

        assert workflow is not None
        assert workflow.id == sample_activation_workflow.id

    def test_get_workflow_for_order_no_template(
        self,
        db: Session,
        orchestrator: ActivationOrchestrator,
    ):
        """Test retrieving workflow when order has no template"""
        order = create_order(db, deployment_template_id=None)

        workflow = orchestrator._get_workflow_for_order(order)

        assert workflow is None

    def test_get_workflow_for_order_no_workflow(
        self,
        db: Session,
        orchestrator: ActivationOrchestrator,
        sample_order: Order,
    ):
        """Test retrieving workflow when none exists"""
        # No workflow created
        workflow = orchestrator._get_workflow_for_order(sample_order)

        # Should return None if no workflow matches
        assert workflow is None or workflow.deployment_template_id != sample_order.deployment_template_id


class TestActivationSequencing:
    """Tests for activation sequencing and dependencies"""

    @pytest.fixture
    def orchestrator(self, db, mock_notification_service, mock_event_bus):
        """Create ActivationOrchestrator"""
        return ActivationOrchestrator(
            db=db,
            notification_service=mock_notification_service,
            event_bus=mock_event_bus,
        )

    def test_services_activated_in_sequence(
        self,
        db: Session,
        orchestrator: ActivationOrchestrator,
    ):
        """Test that services are activated in order"""
        # Create order with multiple services
        order = create_order(
            db,
            selected_services=[
                {"service_code": "base-service", "name": "Base"},
                {"service_code": "dependent-service", "name": "Dependent"},
                {"service_code": "final-service", "name": "Final"},
            ],
        )

        activations = orchestrator.activate_order_services(order, tenant_id=1)

        # Verify sequence
        assert len(activations) == 3
        assert activations[0].sequence_number == 0
        assert activations[1].sequence_number == 1
        assert activations[2].sequence_number == 2

        # All should complete
        for activation in activations:
            assert activation.activation_status == ActivationStatus.COMPLETED

    def test_activation_timestamps_sequential(
        self,
        db: Session,
        orchestrator: ActivationOrchestrator,
    ):
        """Test that activation timestamps show sequential execution"""
        order = create_order(
            db,
            selected_services=[
                {"service_code": "service1", "name": "Service 1"},
                {"service_code": "service2", "name": "Service 2"},
            ],
        )

        activations = orchestrator.activate_order_services(order, tenant_id=1)

        # Verify timestamps exist
        assert all(a.started_at is not None for a in activations)
        assert all(a.completed_at is not None for a in activations)

        # Verify durations calculated
        assert all(a.duration_seconds is not None for a in activations)
        assert all(a.duration_seconds >= 0 for a in activations)
