"""
Tests for the communications system.

Tests the clean implementation with standard libraries.
"""

from datetime import datetime
from unittest.mock import AsyncMock, Mock, patch

import pytest

from dotmac.platform.communications.email_service import (
    EmailMessage,
    EmailResponse,
    EmailService,
    get_email_service,
    send_email,
)
from dotmac.platform.communications.task_service import (
    BulkEmailJob,
    BulkEmailResult,
    TaskService,
    get_task_service,
    queue_bulk_emails,
    queue_email,
)
from dotmac.platform.communications.template_service import (
    RenderedTemplate,
    TemplateData,
    TemplateService,
    create_template,
    get_template_service,
    quick_render,
    render_template,
)


@pytest.mark.integration
class TestEmailService:
    """Test the email service."""

    def test_email_message_validation(self):
        """Test email message model validation."""
        # Valid message
        message = EmailMessage(
            to=["user@example.com"],
            subject="Test Subject",
            text_body="Hello World",
            html_body="<p>Hello World</p>",
        )

        assert message.to == ["user@example.com"]
        assert message.subject == "Test Subject"
        assert message.text_body == "Hello World"
        assert message.html_body == "<p>Hello World</p>"

    def test_email_response_model(self):
        """Test email response model."""
        response = EmailResponse(
            id="test-123", status="sent", message="Email sent successfully", recipients_count=1
        )

        assert response.id == "test-123"
        assert response.status == "sent"
        assert response.message == "Email sent successfully"
        assert response.recipients_count == 1
        assert isinstance(response.sent_at, datetime)

    def test_email_service_initialization(self):
        """Test email service initialization."""
        service = EmailService(
            smtp_host="localhost", smtp_port=587, use_tls=True, default_from="test@example.com"
        )

        assert service.smtp_host == "localhost"
        assert service.smtp_port == 587
        assert service.use_tls is True
        assert service.default_from == "test@example.com"

    @pytest.mark.asyncio
    async def test_send_email_basic(self):
        """Test basic email sending."""
        service = EmailService()

        message = EmailMessage(
            to=["recipient@example.com"], subject="Test Email", text_body="This is a test email."
        )

        # Mock SMTP to avoid actual sending
        with patch("smtplib.SMTP") as mock_smtp:
            mock_server = Mock()
            mock_smtp.return_value.__enter__.return_value = mock_server

            response = await service.send_email(message)

            assert response.status == "sent"
            assert response.recipients_count == 1
            assert "email_" in response.id
            mock_server.send_message.assert_called_once()

    @pytest.mark.asyncio
    async def test_send_bulk_emails(self):
        """Test bulk email sending."""
        service = EmailService()

        messages = [
            EmailMessage(to=[f"user{i}@example.com"], subject=f"Test {i}", text_body="Test")
            for i in range(3)
        ]

        with patch.object(service, "send_email") as mock_send:
            # Mock successful sends
            mock_send.return_value = EmailResponse(
                id="test", status="sent", message="OK", recipients_count=1
            )

            responses = await service.send_bulk_emails(messages)

            assert len(responses) == 3
            assert all(r.status == "sent" for r in responses)
            assert mock_send.call_count == 3

    def test_get_email_service_singleton(self):
        """Test email service singleton."""
        service1 = get_email_service()
        service2 = get_email_service()
        assert service1 is service2

    @pytest.mark.asyncio
    async def test_send_email_convenience(self):
        """Test convenience function."""
        with patch(
            "dotmac.platform.communications.email_service.get_email_service"
        ) as mock_get_service:
            mock_service = AsyncMock()
            mock_service.send_email.return_value = EmailResponse(
                id="test", status="sent", message="OK", recipients_count=1
            )
            mock_get_service.return_value = mock_service

            response = await send_email(to=["user@example.com"], subject="Test", text_body="Hello")

            assert response.status == "sent"
            mock_service.send_email.assert_called_once()


@pytest.mark.integration
class TestTemplateService:
    """Test the template service."""

    def test_template_data_model(self):
        """Test template data model."""
        template = TemplateData(
            name="welcome_email",
            subject_template="Welcome {{name}}!",
            html_template="<p>Hello {{name}}!</p>",
            text_template="Hello {{name}}!",
        )

        assert template.name == "welcome_email"
        assert template.subject_template == "Welcome {{name}}!"
        assert template.html_template == "<p>Hello {{name}}!</p>"
        assert template.text_template == "Hello {{name}}!"
        assert template.id.startswith("tpl_")
        assert isinstance(template.created_at, datetime)

    def test_rendered_template_model(self):
        """Test rendered template model."""
        rendered = RenderedTemplate(
            template_id="test-123",
            subject="Welcome John!",
            html_body="<p>Hello John!</p>",
            text_body="Hello John!",
            variables_used=["name"],
            missing_variables=[],
        )

        assert rendered.template_id == "test-123"
        assert rendered.subject == "Welcome John!"
        assert rendered.variables_used == ["name"]
        assert rendered.missing_variables == []

    def test_template_service_initialization(self):
        """Test template service initialization."""
        service = TemplateService()

        assert service.templates == {}
        assert service.dict_env is not None
        assert service.file_env is None  # No template dir provided

    def test_create_template_success(self):
        """Test template creation."""
        service = TemplateService()

        template_data = TemplateData(
            name="test_template",
            subject_template="Hello {{name}}",
            text_template="Dear {{name}}, welcome!",
        )

        created = service.create_template(template_data)

        assert created.name == "test_template"
        assert created.variables == ["name"]
        assert service.get_template(created.id) == created

    def test_create_template_syntax_error(self):
        """Test template creation with syntax error."""
        service = TemplateService()

        template_data = TemplateData(
            name="bad_template",
            subject_template="Hello {{name",  # Missing closing brace
            text_template="Test",
        )

        with pytest.raises(ValueError, match="Syntax error"):
            service.create_template(template_data)

    def test_render_template_success(self):
        """Test template rendering."""
        service = TemplateService()

        template = TemplateData(
            name="greeting",
            subject_template="Hello {{name}}!",
            text_template="Welcome {{name}} to {{company}}!",
            html_template="<p>Welcome {{name}} to <b>{{company}}</b>!</p>",
        )

        created = service.create_template(template)

        rendered = service.render_template(created.id, {"name": "John", "company": "Acme Corp"})

        assert rendered.subject == "Hello John!"
        assert rendered.text_body == "Welcome John to Acme Corp!"
        assert rendered.html_body == "<p>Welcome John to <b>Acme Corp</b>!</p>"
        assert "name" in rendered.variables_used
        assert "company" in rendered.variables_used
        assert len(rendered.missing_variables) == 0

    def test_render_template_missing_variables(self):
        """Test template rendering with missing variables."""
        service = TemplateService()

        template = TemplateData(
            name="greeting",
            subject_template="Hello {{name}}!",
            text_template="Welcome to {{company}}!",
        )

        created = service.create_template(template)

        rendered = service.render_template(
            created.id,
            {
                "name": "John"
                # Missing "company"
            },
        )

        assert rendered.subject == "Hello John!"
        assert "company" in rendered.missing_variables

    def test_render_string_template(self):
        """Test rendering templates from strings."""
        service = TemplateService()

        result = service.render_string_template(
            subject_template="Hello {{name}}",
            text_template="Welcome {{name}}!",
            html_template="<p>Hi {{name}}!</p>",
            data={"name": "Alice"},
        )

        assert result["subject"] == "Hello Alice"
        assert result["text_body"] == "Welcome Alice!"
        assert result["html_body"] == "<p>Hi Alice!</p>"

    def test_list_and_delete_templates(self):
        """Test template listing and deletion."""
        service = TemplateService()

        # Create templates
        template1 = service.create_template(
            TemplateData(name="template1", subject_template="Subject 1")
        )
        service.create_template(TemplateData(name="template2", subject_template="Subject 2"))

        # List templates
        templates = service.list_templates()
        assert len(templates) == 2
        assert any(t.name == "template1" for t in templates)
        assert any(t.name == "template2" for t in templates)

        # Delete template
        deleted = service.delete_template(template1.id)
        assert deleted is True

        templates = service.list_templates()
        assert len(templates) == 1
        assert templates[0].name == "template2"

    def test_get_template_service_singleton(self):
        """Test template service singleton."""
        service1 = get_template_service()
        service2 = get_template_service()
        assert service1 is service2

    def test_convenience_functions(self):
        """Test convenience functions."""
        # Create template
        template = create_template(
            name="test", subject_template="Hello {{name}}", text_template="Hi {{name}}!"
        )

        assert template.name == "test"
        assert "name" in template.variables

        # Render template
        rendered = render_template(template.id, {"name": "Bob"})
        assert rendered.subject == "Hello Bob"
        assert rendered.text_body == "Hi Bob!"

        # Quick render
        result = quick_render(
            subject="Quick {{type}}", text_body="This is {{type}}", data={"type": "test"}
        )
        assert result["subject"] == "Quick test"
        assert result["text_body"] == "This is test"


@pytest.mark.integration
class TestTaskService:
    """Test the task service."""

    def test_bulk_email_job_model(self):
        """Test bulk email job model."""
        messages = [
            EmailMessage(to=["user1@example.com"], subject="Test", text_body="Hello"),
            EmailMessage(to=["user2@example.com"], subject="Test", text_body="Hello"),
        ]

        job = BulkEmailJob(name="test_job", messages=messages)

        assert job.name == "test_job"
        assert len(job.messages) == 2
        assert job.status == "queued"
        assert job.id.startswith("bulk_")
        assert isinstance(job.created_at, datetime)

    def test_bulk_email_result_model(self):
        """Test bulk email result model."""
        result = BulkEmailResult(
            job_id="job-123",
            status="completed",
            total_emails=5,
            sent_count=4,
            failed_count=1,
            responses=[],
        )

        assert result.job_id == "job-123"
        assert result.status == "completed"
        assert result.total_emails == 5
        assert result.sent_count == 4
        assert result.failed_count == 1

    def test_task_service_initialization(self):
        """Test task service initialization."""
        service = TaskService()
        assert service.celery is not None

    @patch("dotmac.platform.communications.task_service.send_single_email_task")
    def test_send_email_async(self, mock_task):
        """Test async email sending."""
        service = TaskService()

        mock_task.delay.return_value.id = "task-123"

        message = EmailMessage(to=["user@example.com"], subject="Test", text_body="Hello")

        task_id = service.send_email_async(message)

        assert task_id == "task-123"
        mock_task.delay.assert_called_once()

    @patch("dotmac.platform.communications.task_service.send_bulk_email_task")
    def test_send_bulk_emails_async(self, mock_task):
        """Test async bulk email sending."""
        service = TaskService()

        mock_task.delay.return_value.id = "bulk-task-456"

        messages = [
            EmailMessage(to=["user1@example.com"], subject="Test", text_body="Hello"),
            EmailMessage(to=["user2@example.com"], subject="Test", text_body="Hello"),
        ]

        job = BulkEmailJob(name="test_bulk", messages=messages)
        task_id = service.send_bulk_emails_async(job)

        assert task_id == "bulk-task-456"
        mock_task.delay.assert_called_once()

    def test_get_task_service_singleton(self):
        """Test task service singleton."""
        service1 = get_task_service()
        service2 = get_task_service()
        assert service1 is service2

    @patch("dotmac.platform.communications.task_service.send_single_email_task")
    def test_queue_email_convenience(self, mock_task):
        """Test queue email convenience function."""
        mock_task.delay.return_value.id = "convenience-123"

        task_id = queue_email(
            to=["user@example.com"],
            subject="Convenience Test",
            text_body="Hello from convenience function",
        )

        assert task_id == "convenience-123"
        mock_task.delay.assert_called_once()

    @pytest.mark.integration  # Requires communication_bulk_jobs table
    @patch("dotmac.platform.communications.task_service.send_bulk_email_task")
    def test_queue_bulk_emails_convenience(self, mock_task):
        """Test queue bulk emails convenience function."""
        mock_task.delay.return_value.id = "bulk-convenience-456"

        messages = [EmailMessage(to=["user@example.com"], subject="Test", text_body="Hello")]

        task_id = queue_bulk_emails("convenience_bulk", messages)

        assert task_id == "bulk-convenience-456"
        mock_task.delay.assert_called_once()


@pytest.mark.integration
class TestIntegration:
    """Test integration between services."""

    @pytest.mark.asyncio
    async def test_template_to_email_flow(self):
        """Test complete flow from template to email."""
        # Create template
        template_service = get_template_service()
        template = template_service.create_template(
            TemplateData(
                name="integration_test",
                subject_template="Welcome {{name}} to {{company}}!",
                text_template="Hello {{name}}, welcome to {{company}}!",
                html_template="<p>Hello {{name}}, welcome to <b>{{company}}</b>!</p>",
            )
        )

        # Render template
        rendered = template_service.render_template(
            template.id, {"name": "John Doe", "company": "Test Corp"}
        )

        # Send email with rendered content
        email_service = get_email_service()

        with patch("smtplib.SMTP") as mock_smtp:
            mock_server = Mock()
            mock_smtp.return_value.__enter__.return_value = mock_server

            message = EmailMessage(
                to=["john@example.com"],
                subject=rendered.subject,
                text_body=rendered.text_body,
                html_body=rendered.html_body,
            )

            response = await email_service.send_email(message)

            assert response.status == "sent"
            assert mock_server.send_message.assert_called_once

    def test_service_singletons(self):
        """Test that all services are singletons."""
        # Test email service
        email1 = get_email_service()
        email2 = get_email_service()
        assert email1 is email2

        # Test template service
        template1 = get_template_service()
        template2 = get_template_service()
        assert template1 is template2

        # Test task service
        task1 = get_task_service()
        task2 = get_task_service()
        assert task1 is task2

    def test_error_handling_across_services(self):
        """Test error handling across integrated services."""
        template_service = get_template_service()

        # Test template not found error
        with pytest.raises(ValueError, match="Template not found"):
            template_service.render_template("nonexistent-id", {})

        # Test template syntax error
        with pytest.raises(ValueError, match="Syntax error"):
            template_service.create_template(
                TemplateData(name="bad", subject_template="Bad {{syntax")  # Missing closing brace
            )


@pytest.mark.integration
class TestServiceAvailability:
    """Test service availability."""

    def test_services_available(self):
        """Test that all communication services are available and can be instantiated."""
        # If imports failed, the test suite would have failed at import time
        # This test verifies that services can be properly instantiated
        email_service = get_email_service()
        template_service = get_template_service()
        task_service = get_task_service()

        assert email_service is not None
        assert template_service is not None
        assert task_service is not None

    def test_imports_successful(self):
        """Test that all required imports are successful."""
        # If this test runs, it means all imports succeeded
        # Any import errors will cause the test file to fail at import time
        assert EmailMessage is not None
        assert EmailService is not None
        assert TemplateService is not None
        assert TaskService is not None
