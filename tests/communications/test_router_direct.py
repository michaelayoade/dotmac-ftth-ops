"""
Direct router function tests for better coverage.
"""

from datetime import UTC, datetime
from unittest.mock import AsyncMock, Mock, patch

import pytest
from fastapi import HTTPException

from dotmac.platform.communications.email_service import EmailResponse
from dotmac.platform.communications.router import (
    BulkEmailRequest,
    EmailRequest,
    QuickRenderRequest,
    RenderRequest,
    TemplateRequest,
    cancel_bulk_email_job,
    create_template_endpoint,
    delete_template_endpoint,
    get_bulk_email_status,
    get_communication_stats,
    get_recent_activity,
    get_task_status,
    get_template_endpoint,
    health_check,
    list_templates_endpoint,
    queue_bulk_email_job,
    queue_email_endpoint,
    quick_render_endpoint,
    render_template_endpoint,
    send_email_endpoint,
)
from dotmac.platform.communications.template_service import RenderedTemplate, TemplateData

pytestmark = pytest.mark.integration

pytestmark = pytest.mark.asyncio


class TestEmailEndpointsDirect:
    """Direct tests of email endpoints."""

    async def test_send_email_endpoint_success(self):
        """Test send_email_endpoint with successful send."""
        request = EmailRequest(
            to=["test@example.com"], subject="Test Subject", text_body="Test body"
        )

        with patch("dotmac.platform.communications.router.get_email_service") as mock_get_service:
            with patch(
                "dotmac.platform.communications.router.get_async_session_context"
            ) as mock_get_db:
                # Mock email service
                mock_service = AsyncMock()
                mock_service.send_email.return_value = EmailResponse(
                    id="msg_123",
                    status="sent",
                    message="Email sent successfully",
                    recipients_count=1,
                )
                mock_get_service.return_value = mock_service

                # Mock DB context manager
                mock_db = AsyncMock()
                mock_get_db.return_value.__aenter__.return_value = mock_db
                mock_get_db.return_value.__aexit__.return_value = None

                # Mock metrics service
                with patch(
                    "dotmac.platform.communications.router.get_metrics_service"
                ) as mock_get_metrics:
                    mock_metrics = AsyncMock()
                    mock_log = Mock()
                    mock_log.id = "log_123"
                    mock_metrics.log_communication.return_value = mock_log
                    mock_metrics.update_communication_status.return_value = None
                    mock_get_metrics.return_value = mock_metrics

                    result = await send_email_endpoint(request, current_user=None)

                    assert result["message_id"] == "msg_123"
                    assert result["status"] == "sent"
                    mock_service.send_email.assert_called_once()

    async def test_queue_email_endpoint_success(self):
        """Test queue_email_endpoint successful queueing."""
        request = EmailRequest(
            to=["test@example.com"], subject="Queued Email", text_body="This will be sent async"
        )

        with patch("dotmac.platform.communications.router.queue_email") as mock_queue:
            mock_queue.return_value = "task_abc123"

            result = await queue_email_endpoint(request)

            assert result["task_id"] == "task_abc123"
            assert result["status"] == "queued"
            assert "queued for background sending" in result["message"]
            mock_queue.assert_called_once()


class TestTemplateEndpointsDirect:
    """Direct tests of template management endpoints."""

    @pytest.mark.integration  # Requires communication_templates table
    async def test_create_template_endpoint_success(self):
        """Test creating a template via endpoint."""
        request = TemplateRequest(
            name="welcome",
            subject_template="Welcome {{ name }}",
            text_template="Hello {{ name }}",
            html_template="<p>Hello {{ name }}</p>",
        )

        with patch("dotmac.platform.communications.router.create_template") as mock_create:
            template = TemplateData(
                name="welcome",
                subject_template="Welcome {{ name }}",
                text_template="Hello {{ name }}",
                html_template="<p>Hello {{ name }}</p>",
                variables=["name"],
            )
            template.id = "tpl_123"
            template.created_at = datetime.now(UTC)
            mock_create.return_value = template

            result = await create_template_endpoint(request)

            assert result.id == "tpl_123"
            assert result.name == "welcome"
            assert "name" in result.variables

    async def test_create_template_endpoint_failure(self):
        """Test template creation failure."""
        request = TemplateRequest(name="bad", subject_template="{{ invalid", text_template="Body")

        with patch("dotmac.platform.communications.router.create_template") as mock_create:
            mock_create.side_effect = ValueError("Syntax error")

            with pytest.raises(HTTPException) as exc_info:
                await create_template_endpoint(request)

            assert exc_info.value.status_code == 400

    @pytest.mark.integration  # Requires communication_templates table
    async def test_list_templates_endpoint_success(self):
        """Test listing templates."""
        with patch(
            "dotmac.platform.communications.router.get_template_service"
        ) as mock_get_service:
            mock_service = Mock()
            template = TemplateData(
                name="test", subject_template="Subject", text_template="Body", variables=[]
            )
            template.id = "tpl_1"
            template.created_at = datetime.now(UTC)
            mock_service.list_templates.return_value = [template]
            mock_get_service.return_value = mock_service

            result = await list_templates_endpoint()

            assert len(result) == 1
            assert result[0].id == "tpl_1"

    async def test_get_template_endpoint_success(self):
        """Test getting specific template."""
        with patch(
            "dotmac.platform.communications.router.get_template_service"
        ) as mock_get_service:
            mock_service = Mock()
            template = TemplateData(
                name="test", subject_template="Subject", text_template="Body", variables=[]
            )
            template.id = "tpl_abc"
            template.created_at = datetime.now(UTC)
            mock_service.get_template.return_value = template
            mock_get_service.return_value = mock_service

            result = await get_template_endpoint("tpl_abc")

            assert result.id == "tpl_abc"

    async def test_get_template_endpoint_not_found(self):
        """Test getting nonexistent template."""
        with patch(
            "dotmac.platform.communications.router.get_template_service"
        ) as mock_get_service:
            mock_service = Mock()
            mock_service.get_template.return_value = None
            mock_get_service.return_value = mock_service

            with pytest.raises(HTTPException) as exc_info:
                await get_template_endpoint("nonexistent")

            assert exc_info.value.status_code == 404

    async def test_delete_template_endpoint_success(self):
        """Test deleting template."""
        with patch(
            "dotmac.platform.communications.router.get_template_service"
        ) as mock_get_service:
            mock_service = Mock()
            mock_service.delete_template.return_value = True
            mock_get_service.return_value = mock_service

            result = await delete_template_endpoint("tpl_123")

            assert result["message"] == "Template deleted successfully"

    async def test_delete_template_endpoint_not_found(self):
        """Test deleting nonexistent template."""
        with patch(
            "dotmac.platform.communications.router.get_template_service"
        ) as mock_get_service:
            mock_service = Mock()
            mock_service.delete_template.return_value = False
            mock_get_service.return_value = mock_service

            with pytest.raises(HTTPException) as exc_info:
                await delete_template_endpoint("nonexistent")

            assert exc_info.value.status_code == 404

    async def test_render_template_endpoint_success(self):
        """Test rendering template."""
        request = RenderRequest(template_id="tpl_123", data={"name": "John"})

        with patch("dotmac.platform.communications.router.render_template") as mock_render:
            mock_render.return_value = RenderedTemplate(
                template_id="tpl_123",
                subject="Hello John",
                text_body="Body",
                html_body="<p>HTML</p>",
            )

            result = await render_template_endpoint(request)

            assert result.subject == "Hello John"

    async def test_render_template_endpoint_failure(self):
        """Test render template failure."""
        request = RenderRequest(template_id="tpl_123", data={})

        with patch("dotmac.platform.communications.router.render_template") as mock_render:
            mock_render.side_effect = ValueError("Missing variable")

            with pytest.raises(HTTPException) as exc_info:
                await render_template_endpoint(request)

            assert exc_info.value.status_code == 404

    async def test_quick_render_endpoint_success(self):
        """Test quick render."""
        request = QuickRenderRequest(
            subject="Hello {{ name }}",
            text_body="Body {{ name }}",
            html_body="<p>{{ name }}</p>",
            data={"name": "Alice"},
        )

        with patch("dotmac.platform.communications.router.quick_render") as mock_quick:
            mock_quick.return_value = {
                "subject": "Hello Alice",
                "text_body": "Body Alice",
                "html_body": "<p>Alice</p>",
            }

            result = await quick_render_endpoint(request)

            assert result["subject"] == "Hello Alice"

    async def test_quick_render_endpoint_failure(self):
        """Test quick render failure."""
        request = QuickRenderRequest(subject="{{ invalid", text_body="Body", data={})

        with patch("dotmac.platform.communications.router.quick_render") as mock_quick:
            mock_quick.side_effect = ValueError("Syntax error")

            with pytest.raises(HTTPException) as exc_info:
                await quick_render_endpoint(request)

            assert exc_info.value.status_code == 400


class TestUtilityEndpointsDirect:
    """Direct tests of utility endpoints."""

    async def test_health_check_endpoint_healthy(self):
        """Test health check when all services healthy."""
        with patch("dotmac.platform.communications.router.get_email_service") as mock_email:
            with patch(
                "dotmac.platform.communications.router.get_template_service"
            ) as mock_template:
                with patch("dotmac.platform.communications.router.get_task_service") as mock_task:
                    mock_email.return_value = Mock()
                    mock_template.return_value = Mock()
                    mock_task.return_value = Mock()

                    result = await health_check()

                    assert result["status"] == "healthy"
                    assert result["services"]["email_service"] == "available"
                    assert result["services"]["template_service"] == "available"
                    assert result["services"]["task_service"] == "available"

    async def test_get_task_status_endpoint_success(self):
        """Test getting task status."""
        with patch("dotmac.platform.communications.router.get_task_service") as mock_get_service:
            mock_service = Mock()
            mock_service.get_task_status.return_value = {
                "task_id": "task_123",
                "status": "SUCCESS",
                "result": {"message_id": "msg_123"},
            }
            mock_get_service.return_value = mock_service

            result = await get_task_status("task_123")

            assert result["task_id"] == "task_123"
            assert result["status"] == "SUCCESS"


class TestBulkEmailEndpointsDirect:
    """Direct tests of bulk email endpoints."""

    async def test_queue_bulk_email_job_success(self):
        """Test queuing bulk email job."""
        request = BulkEmailRequest(
            job_name="test_campaign",
            messages=[
                EmailRequest(to=["user1@example.com"], subject="Test 1", text_body="Body 1"),
                EmailRequest(to=["user2@example.com"], subject="Test 2", text_body="Body 2"),
            ],
        )

        with patch("dotmac.platform.communications.router.queue_bulk_emails") as mock_queue:
            mock_queue.return_value = "job_abc123"

            result = await queue_bulk_email_job(request)

            assert result["job_id"] == "job_abc123"
            assert result["status"] == "queued"
            assert "2 messages" in result["message"]

    async def test_get_bulk_email_status_success(self):
        """Test getting bulk email job status."""
        with patch("dotmac.platform.communications.router.get_task_service") as mock_get_service:
            mock_service = Mock()
            mock_service.get_task_status.return_value = {
                "job_id": "job_123",
                "status": "PROGRESS",
                "progress": {"completed": 50, "total": 100},
            }
            mock_get_service.return_value = mock_service

            result = await get_bulk_email_status("job_123")

            assert result["job_id"] == "job_123"
            assert result["status"] == "PROGRESS"

    async def test_get_bulk_email_status_not_found(self):
        """Test getting status of nonexistent job."""
        with patch("dotmac.platform.communications.router.get_task_service") as mock_get_service:
            mock_service = Mock()
            mock_service.get_task_status.return_value = None
            mock_get_service.return_value = mock_service

            with pytest.raises(HTTPException) as exc_info:
                await get_bulk_email_status("nonexistent")

            assert exc_info.value.status_code == 404

    async def test_cancel_bulk_email_job_success(self):
        """Test cancelling bulk email job."""
        with patch("dotmac.platform.communications.router.get_task_service") as mock_get_service:
            mock_service = Mock()
            mock_service.cancel_task.return_value = True
            mock_get_service.return_value = mock_service

            result = await cancel_bulk_email_job("job_123")

            assert result["success"] is True
            assert "cancelled successfully" in result["message"]

    async def test_cancel_bulk_email_job_cannot_cancel(self):
        """Test cancelling job that cannot be cancelled."""
        with patch("dotmac.platform.communications.router.get_task_service") as mock_get_service:
            mock_service = Mock()
            mock_service.cancel_task.return_value = False
            mock_get_service.return_value = mock_service

            result = await cancel_bulk_email_job("job_123")

            assert result["success"] is False
            assert "could not be cancelled" in result["message"]


class TestStatsActivityEndpointsDirect:
    """Direct tests of stats and activity endpoints."""

    @pytest.mark.integration  # Requires proper async context manager setup
    async def test_get_communication_stats_from_db(self):
        """Test getting stats from database."""
        with patch(
            "dotmac.platform.communications.router.get_async_session_context"
        ) as mock_get_db:
            with patch(
                "dotmac.platform.communications.router.get_metrics_service"
            ) as mock_get_metrics:
                mock_db = AsyncMock()
                mock_get_db.return_value.__aenter__.return_value = mock_db
                mock_get_db.return_value.__aexit__.return_value = None

                mock_metrics = AsyncMock()
                mock_metrics.get_stats.return_value = {
                    "sent": 100,
                    "delivered": 95,
                    "failed": 5,
                    "pending": 10,
                }
                mock_get_metrics.return_value = mock_metrics

                result = await get_communication_stats(current_user=None)

                assert result["total_sent"] == 100
                assert result["total_delivered"] == 95
                assert result["total_failed"] == 5
                # pending is not in the returned stats, it's in the mock input
                assert "total_sent" in result

    @pytest.mark.integration  # Requires proper async context manager setup
    async def test_get_communication_stats_with_user(self):
        """Test getting stats with authenticated user."""
        mock_user = Mock()
        mock_user.tenant_id = "tenant_123"

        with patch(
            "dotmac.platform.communications.router.get_async_session_context"
        ) as mock_get_db:
            with patch(
                "dotmac.platform.communications.router.get_metrics_service"
            ) as mock_get_metrics:
                mock_db = AsyncMock()
                mock_get_db.return_value.__aenter__.return_value = mock_db
                mock_get_db.return_value.__aexit__.return_value = None

                mock_metrics = AsyncMock()
                mock_metrics.get_stats.return_value = {
                    "sent": 50,
                    "delivered": 48,
                    "failed": 2,
                    "pending": 5,
                }
                mock_get_metrics.return_value = mock_metrics

                result = await get_communication_stats(current_user=mock_user)

                # Verify tenant_id was passed
                mock_metrics.get_stats.assert_called_once_with(tenant_id="tenant_123")
                assert result["total_sent"] == 50

    @pytest.mark.integration  # Requires proper async context manager setup
    async def test_get_recent_activity_from_db(self):
        """Test getting activity from database."""
        with patch(
            "dotmac.platform.communications.router.get_async_session_context"
        ) as mock_get_db:
            with patch(
                "dotmac.platform.communications.router.get_metrics_service"
            ) as mock_get_metrics:
                mock_db = AsyncMock()
                mock_get_db.return_value.__aenter__.return_value = mock_db
                mock_get_db.return_value.__aexit__.return_value = None

                # Create mock log entries
                mock_log = Mock()
                mock_log.id = "log_123"
                mock_log.type = Mock(value="email")
                mock_log.recipient = "user@example.com"
                mock_log.subject = "Test"
                mock_log.status = Mock(value="sent")
                mock_log.created_at = datetime.now(UTC)
                mock_log.metadata_ = {}

                mock_metrics = AsyncMock()
                mock_metrics.get_recent_activity.return_value = [mock_log]
                mock_get_metrics.return_value = mock_metrics

                result = await get_recent_activity(
                    limit=10, offset=0, type_filter=None, current_user=None
                )

                # Result is ActivityTimeline with activity list
                assert len(result.activity) == 1
                # activity is a list of ActivityPoint objects
                assert result.start_date
                assert result.end_date

    @pytest.mark.integration  # Requires proper async context manager setup
    async def test_get_recent_activity_with_filters(self):
        """Test getting activity with filters."""
        with patch(
            "dotmac.platform.communications.router.get_async_session_context"
        ) as mock_get_db:
            with patch(
                "dotmac.platform.communications.router.get_metrics_service"
            ) as mock_get_metrics:
                with patch(
                    "dotmac.platform.communications.router.CommunicationType"
                ) as mock_comm_type:
                    mock_db = AsyncMock()
                    mock_get_db.return_value.__aenter__.return_value = mock_db
                    mock_get_db.return_value.__aexit__.return_value = None

                    mock_comm_type.EMAIL = Mock(value="email")

                    mock_metrics = AsyncMock()
                    mock_metrics.get_recent_activity.return_value = []
                    mock_get_metrics.return_value = mock_metrics

                    result = await get_recent_activity(
                        limit=5, offset=0, type_filter="email", current_user=None
                    )

                    # Verify filters were passed
                    mock_metrics.get_recent_activity.assert_called_once()
                    # Result is ActivityTimeline, not a list
                    assert hasattr(result, "activity")
                    assert isinstance(result.activity, list)
