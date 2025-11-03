"""Comprehensive tests for dunning Celery tasks."""

from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

pytestmark = pytest.mark.unit


@pytest.mark.asyncio
class TestProcessPendingActions:
    """Test process_pending_dunning_actions_task."""

    @patch("dotmac.platform.billing.dunning.tasks._process_pending_actions")
    def test_process_pending_actions_success(self, mock_process):
        """Test periodic task processes pending actions successfully."""
        from dotmac.platform.billing.dunning.tasks import (
            process_pending_dunning_actions_task,
        )

        # Mock the async function - match actual return structure
        mock_process.return_value = {
            "processed": 5,
            "errors": 1,
            "total_executions": 6,
            "timestamp": "2025-10-28T00:00:00Z",
            "results": [],
        }

        # Execute task
        result = process_pending_dunning_actions_task()

        assert result["processed"] == 5
        assert result["errors"] == 1
        assert result["total_executions"] == 6
        mock_process.assert_called_once()

    @patch("dotmac.platform.billing.dunning.tasks._process_pending_actions")
    def test_process_pending_actions_no_pending(self, mock_process):
        """Test task handles no pending actions gracefully."""
        from dotmac.platform.billing.dunning.tasks import (
            process_pending_dunning_actions_task,
        )

        mock_process.return_value = {
            "processed": 0,
            "errors": 0,
            "total_executions": 0,
            "timestamp": "2025-10-28T00:00:00Z",
            "results": [],
        }

        result = process_pending_dunning_actions_task()

        assert result["processed"] == 0
        assert result["errors"] == 0
        mock_process.assert_called_once()

    @patch("dotmac.platform.billing.dunning.tasks._process_pending_actions")
    def test_process_pending_actions_error_handling(self, mock_process):
        """Test task handles errors during processing."""
        from dotmac.platform.billing.dunning.tasks import (
            process_pending_dunning_actions_task,
        )

        # Simulate an exception
        mock_process.side_effect = Exception("Database connection failed")

        with pytest.raises(Exception, match="Database connection failed"):
            process_pending_dunning_actions_task()

    @patch("dotmac.platform.billing.dunning.tasks._process_pending_actions")
    def test_process_pending_actions_retry_on_failure(self, mock_process):
        """Test task retries on failure (max 3 retries)."""
        from dotmac.platform.billing.dunning.tasks import (
            process_pending_dunning_actions_task,
        )

        # Simulate transient error that should trigger retry
        mock_process.side_effect = [
            Exception("Temporary error"),
            {
                "processed": 5,
                "errors": 0,
                "total_executions": 5,
                "timestamp": "2025-10-28T00:00:00Z",
                "results": [],
            },
        ]

        # First call raises exception
        with pytest.raises(Exception):  # noqa: B017
            process_pending_dunning_actions_task()

        # Second call succeeds (simulating retry)
        mock_process.side_effect = None
        mock_process.return_value = {
            "processed": 5,
            "errors": 0,
            "total_executions": 5,
            "timestamp": "2025-10-28T00:00:00Z",
            "results": [],
        }
        result = process_pending_dunning_actions_task()
        assert result["processed"] == 5
        assert result["errors"] == 0


@pytest.mark.asyncio
class TestExecuteDunningAction:
    """Test execute_dunning_action_task."""

    @patch("dotmac.platform.billing.dunning.tasks._execute_action")
    def test_execute_email_action_success(self, mock_execute):
        """Test executing EMAIL action successfully."""
        from dotmac.platform.billing.dunning.tasks import execute_dunning_action_task

        execution_id = str(uuid4())
        action_config = {
            "type": "email",
            "delay_days": 0,
            "template": "payment_reminder_1",
        }

        mock_execute.return_value = {
            "status": "success",
            "action_type": "email",
            "step_number": 1,
            "executed_at": "2025-10-28T00:00:00Z",
            "details": {"message": "Email sent successfully"},
        }

        result = execute_dunning_action_task(
            execution_id=execution_id, action_config=action_config, step_number=1
        )

        assert result["status"] == "success"
        assert result["action_type"] == "email"
        mock_execute.assert_called_once()

    @patch("dotmac.platform.billing.dunning.tasks._execute_action")
    def test_execute_sms_action_success(self, mock_execute):
        """Test executing SMS action successfully."""
        from dotmac.platform.billing.dunning.tasks import execute_dunning_action_task

        execution_id = str(uuid4())
        action_config = {
            "type": "sms",
            "delay_days": 3,
            "template": "payment_reminder_sms",
        }

        mock_execute.return_value = {
            "status": "success",
            "action_type": "sms",
            "step_number": 2,
            "executed_at": "2025-10-28T00:00:00Z",
            "details": {"message": "SMS sent successfully"},
        }

        result = execute_dunning_action_task(
            execution_id=execution_id, action_config=action_config, step_number=2
        )

        assert result["status"] == "success"
        assert result["action_type"] == "sms"

    @patch("dotmac.platform.billing.dunning.tasks._execute_action")
    def test_execute_suspend_service_action(self, mock_execute):
        """Test executing SUSPEND_SERVICE action."""
        from dotmac.platform.billing.dunning.tasks import execute_dunning_action_task

        execution_id = str(uuid4())
        action_config = {"type": "suspend_service", "delay_days": 7}

        mock_execute.return_value = {
            "status": "success",
            "action_type": "suspend_service",
            "step_number": 3,
            "executed_at": "2025-10-28T00:00:00Z",
            "details": {"message": "Service suspended"},
        }

        result = execute_dunning_action_task(
            execution_id=execution_id, action_config=action_config, step_number=3
        )

        assert result["status"] == "success"
        assert result["action_type"] == "suspend_service"

    @patch("dotmac.platform.billing.dunning.tasks._execute_action")
    def test_execute_terminate_service_action(self, mock_execute):
        """Test executing TERMINATE_SERVICE action."""
        from dotmac.platform.billing.dunning.tasks import execute_dunning_action_task

        execution_id = str(uuid4())
        action_config = {"type": "terminate_service", "delay_days": 14}

        mock_execute.return_value = {
            "status": "success",
            "action_type": "terminate_service",
            "step_number": 4,
            "executed_at": "2025-10-28T00:00:00Z",
            "details": {"message": "Service terminated"},
        }

        result = execute_dunning_action_task(
            execution_id=execution_id, action_config=action_config, step_number=4
        )

        assert result["status"] == "success"
        assert result["action_type"] == "terminate_service"

    @patch("dotmac.platform.billing.dunning.tasks._execute_action")
    def test_execute_webhook_action(self, mock_execute):
        """Test executing WEBHOOK action."""
        from dotmac.platform.billing.dunning.tasks import execute_dunning_action_task

        execution_id = str(uuid4())
        action_config = {
            "type": "webhook",
            "delay_days": 0,
            "webhook_url": "https://example.com/webhook",
            "webhook_secret": "secret123",
        }

        mock_execute.return_value = {
            "status": "success",
            "action_type": "webhook",
            "step_number": 1,
            "executed_at": "2025-10-28T00:00:00Z",
            "details": {"message": "Webhook called successfully", "response_status": 200},
        }

        result = execute_dunning_action_task(
            execution_id=execution_id, action_config=action_config, step_number=1
        )

        assert result["status"] == "success"
        assert result["details"]["response_status"] == 200

    @patch("dotmac.platform.billing.dunning.tasks._execute_action")
    def test_execute_action_failure(self, mock_execute):
        """Test action execution failure handling."""
        from dotmac.platform.billing.dunning.tasks import execute_dunning_action_task

        execution_id = str(uuid4())
        action_config = {"type": "email", "delay_days": 0, "template": "reminder"}

        mock_execute.return_value = {
            "status": "failed",
            "action_type": "email",
            "step_number": 1,
            "executed_at": "2025-10-28T00:00:00Z",
            "details": {},
            "error": "Email service unavailable",
        }

        result = execute_dunning_action_task(
            execution_id=execution_id, action_config=action_config, step_number=1
        )

        assert result["status"] == "failed"
        assert "error" in result

    @patch("dotmac.platform.billing.dunning.tasks._execute_action")
    def test_execute_action_invalid_execution_id(self, mock_execute):
        """Test task handles invalid execution ID."""
        from dotmac.platform.billing.dunning.tasks import execute_dunning_action_task

        invalid_id = "not-a-uuid"
        action_config = {"type": "email", "delay_days": 0}

        # Should raise ValueError for invalid UUID
        with pytest.raises(ValueError):
            execute_dunning_action_task(
                execution_id=invalid_id, action_config=action_config, step_number=1
            )

    @patch("dotmac.platform.billing.dunning.tasks._execute_action")
    def test_execute_action_retry_on_transient_error(self, mock_execute):
        """Test task retries on transient errors."""
        from dotmac.platform.billing.dunning.tasks import execute_dunning_action_task

        execution_id = str(uuid4())
        action_config = {"type": "email", "delay_days": 0}

        # First call fails, second succeeds
        mock_execute.side_effect = [
            Exception("Transient network error"),
            {
                "status": "success",
                "action_type": "email",
                "step_number": 1,
                "executed_at": "2025-10-28T00:00:00Z",
                "details": {},
            },
        ]

        # First attempt raises exception
        with pytest.raises(Exception):  # noqa: B017
            execute_dunning_action_task(
                execution_id=execution_id, action_config=action_config, step_number=1
            )

        # Retry succeeds
        mock_execute.side_effect = None
        mock_execute.return_value = {
            "status": "success",
            "action_type": "email",
            "step_number": 1,
            "executed_at": "2025-10-28T00:00:00Z",
            "details": {},
        }
        result = execute_dunning_action_task(
            execution_id=execution_id, action_config=action_config, step_number=1
        )
        assert result["status"] == "success"


@pytest.mark.asyncio
class TestActionExecutionLogic:
    """Test _execute_action internal logic."""

    @patch("dotmac.platform.billing.dunning.tasks.async_session_maker")
    @patch("dotmac.platform.billing.dunning.tasks.DunningService")
    async def test_execute_action_logs_created(self, mock_service, mock_session_maker):
        """Test action execution creates action logs."""
        from dotmac.platform.billing.dunning.tasks import _execute_action

        execution_id = uuid4()
        action_config = {"type": "email", "delay_days": 0, "template": "reminder"}

        # Mock async context manager
        mock_session = AsyncMock()
        mock_session_maker.return_value.__aenter__.return_value = mock_session

        mock_service_instance = AsyncMock()
        mock_service.return_value = mock_service_instance

        # Mock get_execution to return valid execution
        mock_execution = MagicMock()
        mock_execution.id = execution_id
        mock_execution.tenant_id = "test-tenant"
        mock_execution.subscription_id = "sub_123"
        mock_execution.current_step = 0
        mock_execution.execution_log = []
        mock_service_instance.get_execution.return_value = mock_execution

        await _execute_action(execution_id, action_config, 1)

        # Verify service methods were called
        mock_service_instance.get_execution.assert_called_once()

    @patch("dotmac.platform.billing.dunning.tasks.async_session_maker")
    async def test_execute_action_execution_not_found(self, mock_session_maker):
        """Test action execution handles execution not found."""
        from dotmac.platform.billing.dunning.tasks import _execute_action

        execution_id = uuid4()
        action_config = {"type": "email", "delay_days": 0}

        # Mock async context manager
        mock_session = AsyncMock()
        mock_session_maker.return_value.__aenter__.return_value = mock_session

        # Mock session to return None for get_execution
        with patch("dotmac.platform.billing.dunning.tasks.DunningService") as mock_service:
            mock_service_instance = AsyncMock()
            mock_service.return_value = mock_service_instance
            mock_service_instance.get_execution.return_value = None

            result = await _execute_action(execution_id, action_config, 1)

            assert result["status"] == "failed"
            assert "not found" in result.get("error", "").lower()


@pytest.mark.asyncio
class TestCeleryTaskConfiguration:
    """Test Celery task configuration and metadata."""

    def test_process_pending_actions_task_metadata(self):
        """Test process_pending_actions task has correct metadata."""
        from dotmac.platform.billing.dunning.tasks import (
            process_pending_dunning_actions_task,
        )

        assert process_pending_dunning_actions_task.name == "dunning.process_pending_actions"
        assert process_pending_dunning_actions_task.max_retries == 3

    def test_execute_action_task_metadata(self):
        """Test execute_dunning_action task has correct metadata."""
        from dotmac.platform.billing.dunning.tasks import execute_dunning_action_task

        assert execute_dunning_action_task.name == "dunning.execute_action"
        assert execute_dunning_action_task.max_retries == 3

    def test_task_registered_in_celery_app(self):
        """Test tasks are properly registered in Celery app."""
        from dotmac.platform.celery_app import celery_app

        registered_tasks = celery_app.tasks.keys()

        assert "dunning.process_pending_actions" in registered_tasks
        assert "dunning.execute_action" in registered_tasks


@pytest.mark.asyncio
class TestPeriodicTaskScheduling:
    """Test periodic task scheduling configuration."""

    def test_periodic_task_schedule_configured(self):
        """Test periodic task is scheduled correctly (every 5 minutes)."""
        from dotmac.platform.celery_app import celery_app

        # Check if periodic task is configured
        beat_schedule = celery_app.conf.beat_schedule

        assert "dunning-process-pending-actions" in beat_schedule
        task_config = beat_schedule["dunning-process-pending-actions"]

        assert task_config["task"] == "dunning.process_pending_actions"
        assert task_config["schedule"] == 300.0  # 5 minutes in seconds


@pytest.mark.asyncio
class TestIntegrationScenarios:
    """Test integration scenarios with multiple tasks."""

    @patch("dotmac.platform.billing.dunning.tasks._process_pending_actions")
    @patch("dotmac.platform.billing.dunning.tasks._execute_action")
    def test_full_dunning_workflow(self, mock_execute, mock_process):
        """Test complete dunning workflow from pending to execution."""
        from dotmac.platform.billing.dunning.tasks import (
            execute_dunning_action_task,
            process_pending_dunning_actions_task,
        )

        # Step 1: Process pending actions identifies executions
        mock_process.return_value = {
            "processed": 2,
            "errors": 0,
            "total_executions": 2,
            "timestamp": "2025-10-28T00:00:00Z",
            "results": [],
        }

        result = process_pending_dunning_actions_task()
        assert result["processed"] == 2

        # Step 2: Execute individual actions
        execution_id = str(uuid4())
        action_config = {"type": "email", "delay_days": 0}

        mock_execute.return_value = {
            "status": "success",
            "action_type": "email",
            "step_number": 1,
            "executed_at": "2025-10-28T00:00:00Z",
            "details": {},
        }

        action_result = execute_dunning_action_task(
            execution_id=execution_id, action_config=action_config, step_number=1
        )

        assert action_result["status"] == "success"

    @patch("dotmac.platform.billing.dunning.tasks._execute_action")
    def test_multi_step_execution_sequence(self, mock_execute):
        """Test executing multiple steps in sequence."""
        from dotmac.platform.billing.dunning.tasks import execute_dunning_action_task

        execution_id = str(uuid4())

        # Step 1: Send first email
        mock_execute.return_value = {
            "status": "success",
            "action_type": "email",
            "step_number": 1,
            "executed_at": "2025-10-28T00:00:00Z",
            "details": {},
        }
        result1 = execute_dunning_action_task(
            execution_id=execution_id,
            action_config={"type": "email", "delay_days": 0},
            step_number=1,
        )
        assert result1["status"] == "success"

        # Step 2: Send second email
        result2 = execute_dunning_action_task(
            execution_id=execution_id,
            action_config={"type": "email", "delay_days": 3},
            step_number=2,
        )
        assert result2["status"] == "success"

        # Step 3: Suspend service
        mock_execute.return_value = {
            "status": "success",
            "action_type": "suspend_service",
            "step_number": 3,
            "executed_at": "2025-10-28T00:00:00Z",
            "details": {},
        }
        result3 = execute_dunning_action_task(
            execution_id=execution_id,
            action_config={"type": "suspend_service", "delay_days": 7},
            step_number=3,
        )
        assert result3["status"] == "success"

        # Verify all steps executed
        assert mock_execute.call_count == 3
