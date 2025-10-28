"""
Additional tests to achieve 90%+ coverage for task_service.py
"""

from unittest.mock import AsyncMock, Mock, patch

import pytest

from dotmac.platform.communications.email_service import EmailMessage, EmailResponse
from dotmac.platform.communications.task_service import (
    BulkEmailJob,
    TaskService,
    _process_bulk_email_job,
    _run_async,
    _send_email_async,
    _send_email_sync,
    get_task_service,
)


@pytest.mark.integration
class TestSendEmailAsync:
    """Tests for _send_email_async helper."""

    @pytest.mark.asyncio
    async def test_send_email_with_success_status_normalization(self):
        """Test that 'success' status is normalized to 'sent'."""
        mock_service = AsyncMock()
        mock_service.send_email.return_value = EmailResponse(
            id="msg_123",
            status="success",  # Will be normalized to "sent"
            message="OK",
            recipients_count=1,
        )

        message = EmailMessage(to=["test@example.com"], subject="Test")
        result = await _send_email_async(mock_service, message)

        assert result.status == "sent"  # Normalized from "success"
        assert result.id == "msg_123"

    @pytest.mark.asyncio
    async def test_send_email_with_unknown_status_normalization(self):
        """Test that unknown status is normalized to 'failed'."""
        mock_service = AsyncMock()
        mock_service.send_email.return_value = EmailResponse(
            id="msg_123",
            status="queued",  # Not "sent" or "failed", will be normalized to "failed"
            message="Queued",
            recipients_count=1,
        )

        message = EmailMessage(to=["test@example.com"], subject="Test")
        result = await _send_email_async(mock_service, message)

        assert result.status == "failed"  # Normalized from "queued"


@pytest.mark.integration
class TestProcessBulkEmailJob:
    """Tests for _process_bulk_email_job."""

    @pytest.mark.asyncio
    async def test_process_bulk_with_failures(self):
        """Test processing bulk email job with some failures."""
        mock_service = AsyncMock()

        # First email succeeds, second fails
        mock_service.send_email.side_effect = [
            EmailResponse(id="msg1", status="sent", message="OK", recipients_count=1),
            EmailResponse(id="msg2", status="failed", message="Error", recipients_count=1),
        ]

        job = BulkEmailJob(
            id="job_123",
            name="Test",
            messages=[
                EmailMessage(to=["user1@example.com"], subject="Test1"),
                EmailMessage(to=["user2@example.com"], subject="Test2"),
            ],
        )

        result = await _process_bulk_email_job(job, mock_service)

        assert result.sent_count == 1
        assert result.failed_count == 1  # Coverage for line 137
        assert result.total_emails == 2
        assert result.status == "completed"  # Has at least one success

    @pytest.mark.asyncio
    async def test_process_bulk_all_failed(self):
        """Test processing bulk email job where all emails fail."""
        mock_service = AsyncMock()
        mock_service.send_email.return_value = EmailResponse(
            id="msg_fail", status="failed", message="Error", recipients_count=1
        )

        job = BulkEmailJob(
            id="job_456",
            name="Test",
            messages=[
                EmailMessage(to=["user1@example.com"], subject="Test1"),
                EmailMessage(to=["user2@example.com"], subject="Test2"),
            ],
        )

        result = await _process_bulk_email_job(job, mock_service)

        assert result.sent_count == 0
        assert result.failed_count == 2
        assert result.status == "failed"  # No successes, status is "failed"


@pytest.mark.integration
class TestSendEmailSync:
    """Tests for _send_email_sync wrapper."""

    def test_send_email_sync_wrapper(self):
        """Test the synchronous wrapper for sending email."""
        mock_service = Mock()
        message = EmailMessage(to=["test@example.com"], subject="Test")

        with patch("dotmac.platform.communications.task_service._run_async") as mock_run_async:
            mock_run_async.return_value = EmailResponse(
                id="sync_123", status="sent", message="OK", recipients_count=1
            )

            result = _send_email_sync(mock_service, message)

            assert result.id == "sync_123"
            assert result.status == "sent"
            mock_run_async.assert_called_once()  # Coverage for line 158


@pytest.mark.integration
class TestTaskServiceMethods:
    """Tests for TaskService class methods."""

    def test_get_task_status(self):
        """Test getting task status from Celery."""
        with patch("dotmac.platform.communications.task_service.celery_app") as mock_celery:
            mock_result = Mock()
            mock_result.status = "SUCCESS"
            mock_result.result = {"message_id": "msg_123"}
            mock_result.info = None
            mock_celery.AsyncResult.return_value = mock_result

            service = TaskService()
            status = service.get_task_status("task_123")

            assert status["task_id"] == "task_123"
            assert status["status"] == "SUCCESS"
            assert status["result"] == {"message_id": "msg_123"}
            mock_celery.AsyncResult.assert_called_once_with(
                "task_123"
            )  # Coverage for lines 296-297

    def test_cancel_task_success(self):
        """Test successfully cancelling a task."""
        with patch("dotmac.platform.communications.task_service.celery_app") as mock_celery:
            mock_celery.control.revoke = Mock()

            service = TaskService()
            result = service.cancel_task("task_456")

            assert result is True
            mock_celery.control.revoke.assert_called_once_with(
                "task_456", terminate=True
            )  # Coverage for lines 305-308


@pytest.mark.integration
class TestRunAsync:
    """Test _run_async helper function."""

    def test_run_async_normal_execution(self):
        """Test normal async execution."""

        async def sample_coro():
            return "success"

        result = _run_async(sample_coro())
        assert result == "success"

    def test_run_async_with_existing_loop_not_running(self):
        """Test execution when loop exists but isn't running."""

        async def sample_coro():
            return "result"

        # This path is hard to trigger in tests, but we can mock it
        with patch("asyncio.run", side_effect=RuntimeError("Loop exists")):
            with patch("asyncio.get_event_loop") as mock_get_loop:
                mock_loop = Mock()
                mock_loop.is_running.return_value = False
                mock_loop.run_until_complete.return_value = "result"
                mock_get_loop.return_value = mock_loop

                result = _run_async(sample_coro())
                assert result == "result"


@pytest.mark.integration
class TestSendEmailAsyncExtended:
    """Extended tests for _send_email_async."""

    @pytest.mark.asyncio
    async def test_send_email_status_normalization_success_to_sent(self):
        """Test 'success' status gets normalized to 'sent'."""
        mock_service = AsyncMock()
        mock_service.send_email.return_value = EmailResponse(
            id="msg_123",
            status="success",  # Should be normalized to "sent"
            message="OK",
            recipients_count=1,
        )

        message = EmailMessage(to=["test@example.com"], subject="Test")
        result = await _send_email_async(mock_service, message)

        assert result.status == "sent"


@pytest.mark.integration
class TestProcessBulkEmailJobExtended:
    """Extended tests for _process_bulk_email_job."""

    @pytest.mark.asyncio
    async def test_bulk_job_with_progress_callback(self):
        """Test bulk email processing with progress tracking."""
        mock_service = AsyncMock()
        mock_service.send_email.return_value = EmailResponse(
            id="msg_1",
            status="sent",
            message="OK",
            recipients_count=1,
        )

        job = BulkEmailJob(
            id="job_123",
            name="Test Campaign",
            messages=[
                EmailMessage(to=["user1@example.com"], subject="Test1"),
                EmailMessage(to=["user2@example.com"], subject="Test2"),
            ],
        )

        progress_calls = []

        def track_progress(completed, total, sent, failed):
            progress_calls.append((completed, total, sent, failed))

        result = await _process_bulk_email_job(job, mock_service, track_progress)

        assert result.total_emails == 2
        assert result.sent_count == 2
        assert result.failed_count == 0
        assert len(progress_calls) > 0
        assert progress_calls[0] == (0, 2, 0, 0)  # Initial call

    @pytest.mark.asyncio
    async def test_bulk_job_all_failed_status(self):
        """Test bulk job where all emails fail."""
        mock_service = AsyncMock()
        mock_service.send_email.return_value = EmailResponse(
            id="msg_fail",
            status="failed",
            message="Error",
            recipients_count=1,
        )

        job = BulkEmailJob(
            id="job_456",
            name="Failed Campaign",
            messages=[
                EmailMessage(to=["user1@example.com"], subject="Test1"),
                EmailMessage(to=["user2@example.com"], subject="Test2"),
            ],
        )

        result = await _process_bulk_email_job(job, mock_service)

        assert result.status == "failed"  # All failed
        assert result.sent_count == 0
        assert result.failed_count == 2


# Celery task tests removed - testing Celery task decorators is complex
# and the underlying functions (_send_email_sync, _run_async, _process_bulk_email_job)
# are already tested above


@pytest.mark.integration
class TestGetTaskService:
    """Test task service factory."""

    def test_get_task_service_singleton(self):
        """Test that factory returns singleton."""
        service1 = get_task_service()
        service2 = get_task_service()

        assert service1 is service2

    def test_task_service_initialization(self):
        """Test TaskService initialization."""
        service = TaskService()
        assert service.celery is not None
