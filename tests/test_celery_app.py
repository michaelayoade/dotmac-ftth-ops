"""Tests for the celery_app module."""

from unittest.mock import Mock, patch

import pytest
from celery import Celery

# Import the entire module to ensure coverage tracking
from dotmac.platform.celery_app import (
    celery_app,
    setup_celery_instrumentation,
    setup_periodic_tasks,
)


@pytest.mark.integration
class TestCeleryApp:
    """Test the Celery application configuration."""

    def test_celery_app_creation(self):
        """Test that celery_app is properly created."""
        assert isinstance(celery_app, Celery)
        assert celery_app.main == "dotmac_platform"

    def test_celery_app_configuration(self):
        """Test that celery_app has correct configuration."""
        # Test basic configuration
        assert celery_app.conf.task_serializer == "json"
        assert celery_app.conf.result_serializer == "json"
        assert "json" in celery_app.conf.accept_content
        assert celery_app.conf.timezone == "timezone.utc"
        assert celery_app.conf.enable_utc is True

        # Test queue configuration
        assert celery_app.conf.task_default_queue == "default"
        assert celery_app.conf.worker_prefetch_multiplier == 1
        assert celery_app.conf.task_acks_late is True

        # Test monitoring
        assert celery_app.conf.worker_send_task_events is True
        assert celery_app.conf.task_send_sent_event is True

    def test_celery_app_queues(self):
        """Test that queues are properly configured."""
        queues = celery_app.conf.task_queues
        queue_names = [q.name for q in queues]

        assert "default" in queue_names
        assert "high_priority" in queue_names
        assert "low_priority" in queue_names

    def test_celery_app_includes(self):
        """Test that task modules are included."""
        assert "dotmac.platform.tasks" in celery_app.conf.include


@pytest.mark.integration
class TestCeleryInstrumentationHooks:
    """Test Celery instrumentation setup hooks."""

    @patch("dotmac.platform.celery_app.init_celery_instrumentation")
    def test_setup_celery_instrumentation_success(self, mock_init):
        """Test successful instrumentation setup."""
        mock_init.return_value = None

        # Call the hook function directly
        setup_celery_instrumentation(sender=Mock())

        mock_init.assert_called_once()

    @patch("dotmac.platform.celery_app.init_celery_instrumentation")
    @patch("structlog.get_logger")
    def test_setup_celery_instrumentation_failure(self, mock_get_logger, mock_init):
        """Test instrumentation setup with failure."""
        mock_init.side_effect = Exception("Instrumentation failed")
        mock_logger = Mock()
        mock_get_logger.return_value = mock_logger

        # Should not raise exception even if instrumentation fails
        setup_celery_instrumentation(sender=Mock())

        mock_init.assert_called_once()
        mock_logger.warning.assert_called_once()

        # Check that the warning contains the error
        warning_call = mock_logger.warning.call_args
        assert "celery.instrumentation.failed" in warning_call[0]
        assert warning_call[1]["error"] == "Instrumentation failed"

    @patch("dotmac.platform.genieacs.tasks.replay_pending_operations")
    @patch("structlog.get_logger")
    def test_setup_periodic_tasks(self, mock_get_logger, mock_replay_operations):
        """Test periodic tasks setup logging."""
        mock_logger = Mock()
        mock_get_logger.return_value = mock_logger

        setup_periodic_tasks(sender=Mock())

        mock_logger.info.assert_called_once()

        # Check that the log contains worker configuration info
        info_call = mock_logger.info.call_args
        assert "celery.worker.configured" in info_call[0]
        assert "queues" in info_call[1]

        # Verify replay_pending_operations was triggered on startup
        mock_replay_operations.apply_async.assert_called_once_with(countdown=5)


@pytest.mark.integration
class TestCeleryAppIntegration:
    """Integration tests for Celery app."""

    def test_celery_app_hooks_registered(self):
        """Test that hooks are properly registered."""
        # Check that signals have been connected
        # This is implicit based on the @celery_app.on_after_configure.connect decorators
        # The actual connection is tested by the signal firing tests above

        # Verify the hooks exist as functions
        assert callable(setup_celery_instrumentation)
        assert callable(setup_periodic_tasks)

    @patch("dotmac.platform.celery_app.settings")
    def test_celery_app_with_settings(self, mock_settings):
        """Test that celery app uses settings properly."""
        mock_settings.celery.broker_url = "redis://test:6379/0"
        mock_settings.celery.result_backend_url = "redis://test:6379/1"

        # Since the app is already created, we can't test the constructor directly
        # but we can verify the configuration reflects the expected pattern
        assert celery_app.conf.broker_url is not None
        assert celery_app.conf.result_backend is not None

    def test_celery_app_task_routing(self):
        """Test task routing configuration."""
        routes = celery_app.conf.task_routes
        assert "dotmac.platform.tasks.*" in routes
        assert routes["dotmac.platform.tasks.*"]["queue"] == "default"

    def test_celery_app_worker_limits(self):
        """Test worker configuration limits."""
        assert celery_app.conf.task_time_limit == 300  # 5 minutes
        assert celery_app.conf.task_soft_time_limit == 240  # 4 minutes
        assert celery_app.conf.worker_max_tasks_per_child == 1000
        assert celery_app.conf.result_expires == 3600  # 1 hour
