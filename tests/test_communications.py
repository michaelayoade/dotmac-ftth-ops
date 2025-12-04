"""Unit tests for the simplified communications package."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from dotmac.platform.communications import (
    EmailMessage,
    EmailResponse,
    EmailService,
    TemplateData,
    TemplateService,
    create_template,
    get_email_service,
    get_task_service,
    get_template_service,
    queue_bulk_emails,
    queue_email,
    quick_render,
    render_template,
    send_email,
)


@pytest.fixture(autouse=True)
def reset_singletons(monkeypatch):
    """Ensure module-level singletons do not leak between tests."""

    from dotmac.platform.communications import email_service as email_module
    from dotmac.platform.communications import task_service as task_module
    from dotmac.platform.communications import template_service as tpl_module

    monkeypatch.setattr(email_module, "_email_service", None)
    monkeypatch.setattr(tpl_module, "_template_service", None)
    monkeypatch.setattr(task_module, "_task_service", None, raising=False)


@pytest.mark.integration
class TestEmailMessage:
    """EmailMessage validation and defaults."""

    def test_minimal_message(self):
        message = EmailMessage(to=["user@example.com"], subject="Hello")

        assert message.to == ["user@example.com"]
        assert message.subject == "Hello"
        assert message.text_body is None
        assert message.html_body is None
        assert message.cc == []
        assert message.bcc == []

    def test_message_with_all_fields(self):
        message = EmailMessage(
            to=["user@example.com"],
            subject="Welcome",
            text_body="Hi there",
            html_body="<p>Hi there</p>",
            from_email="noreply@example.com",
            from_name="DotMac",
            reply_to="support@example.com",
            cc=["cc@example.com"],
            bcc=["bcc@example.com"],
        )

        assert message.reply_to == "support@example.com"
        assert message.cc == ["cc@example.com"]
        assert message.bcc == ["bcc@example.com"]


@pytest.mark.integration
class TestEmailService:
    """Behaviour of the EmailService class."""

    @pytest.mark.asyncio
    async def test_send_email_success(self):
        service = EmailService()
        message = EmailMessage(to=["user@example.com"], subject="Subject", text_body="Body")

        with patch.object(service, "_send_smtp", new_callable=AsyncMock) as mock_send:
            response = await service.send_email(message)

        mock_send.assert_awaited_once()
        assert response.status == "sent"
        assert response.recipients_count == 1

    @pytest.mark.asyncio
    async def test_send_email_failure(self):
        service = EmailService()
        message = EmailMessage(to=["user@example.com"], subject="Subject")

        async def raise_error(*_args, **_kwargs):
            raise RuntimeError("SMTP unavailable")

        with patch.object(service, "_send_smtp", new=AsyncMock(side_effect=raise_error)):
            response = await service.send_email(message)

        assert response.status == "failed"
        assert "SMTP unavailable" in response.message

    @pytest.mark.asyncio
    async def test_send_bulk_emails(self):
        service = EmailService()
        messages: list[EmailMessage] = [
            EmailMessage(to=["one@example.com"], subject="One"),
            EmailMessage(to=["two@example.com"], subject="Two"),
        ]

        # First succeeds, second raises
        async def send_side_effect(*_args, **_kwargs):
            if _args[1].subject == "Two":
                raise RuntimeError("Boom")

        with patch.object(service, "_send_smtp", new=AsyncMock(side_effect=send_side_effect)):
            responses = await service.send_bulk_emails(messages)

        assert len(responses) == 2
        assert responses[0].status == "sent"
        assert responses[1].status == "failed"


@pytest.mark.integration
class TestEmailConvenienceHelpers:
    """Global helper functions for email delivery."""

    def test_get_email_service_memoizes(self):
        first = get_email_service()
        second = get_email_service()

        assert first is second

    @pytest.mark.asyncio
    async def test_send_email_helper_uses_service(self):
        fake_service = EmailService()
        async_mock = AsyncMock(
            return_value=EmailResponse(
                id="test",
                status="sent",
                message="ok",
                recipients_count=1,
            )
        )

        with (
            patch("dotmac.platform.communications.email_service._email_service", fake_service),
            patch.object(fake_service, "send_email", async_mock),
        ):
            response = await send_email(["user@example.com"], "Test", text_body="Hi")

        async_mock.assert_awaited_once()
        assert response.status == "sent"


@pytest.mark.integration
class TestTemplateService:
    """Template creation and rendering."""

    def test_create_and_render_template(self):
        service = get_template_service()

        template = TemplateData(
            name="Welcome",
            subject_template="Hello {{ name }}",
            text_template="Hi {{ name }}",
            html_template="<p>Hi {{ name }}</p>",
        )

        created = service.create_template(template)
        result = service.render_template(created.id, {"name": "Ayo"})

        assert result.subject == "Hello Ayo"
        assert result.text_body == "Hi Ayo"
        assert result.html_body == "<p>Hi Ayo</p>"
        assert result.missing_variables == []

    def test_render_template_with_missing_variables(self):
        service = TemplateService()
        template = TemplateData(
            name="Reminder",
            subject_template="Reminder for {{ event }}",
            text_template="Dear {{ user }}, see you soon",
        )

        created = service.create_template(template)
        result = service.render_template(created.id, {"event": "Launch"})

        assert result.missing_variables == ["user"]

    def test_quick_render_helper(self):
        rendered = quick_render("Hello {{ who }}", text_body="Hi {{ who }}", data={"who": "World"})

        assert rendered["subject"] == "Hello World"
        assert rendered["text_body"] == "Hi World"

    def test_module_level_create_and_render(self):
        tpl = create_template(
            name="Order",
            subject_template="Order {{ id }}",
            text_template="Order total: {{ total }}",
        )

        rendered = render_template(tpl.id, {"id": "123", "total": "$50"})

        assert rendered.subject == "Order 123"
        assert rendered.text_body == "Order total: $50"


@pytest.mark.integration
class TestTaskHelpers:
    """queue_email and queue_bulk_emails forwarding to the task service."""

    def test_get_task_service_returns_singleton(self):
        first = get_task_service()
        second = get_task_service()

        assert first is second

    def test_queue_email_uses_service(self, monkeypatch):
        fake_service = MagicMock()
        monkeypatch.setattr(
            "dotmac.platform.communications.task_service.get_task_service",
            lambda: fake_service,
        )

        queue_email(to=["user@example.com"], subject="Queued")

        fake_service.send_email_async.assert_called_once()

    def test_queue_bulk_emails_uses_service(self, monkeypatch):
        fake_service = MagicMock()
        monkeypatch.setattr(
            "dotmac.platform.communications.task_service.get_task_service",
            lambda: fake_service,
        )

        messages = [EmailMessage(to=["user@example.com"], subject="Test")]
        queue_bulk_emails(name="Campaign", messages=messages)

        fake_service.send_bulk_emails_async.assert_called_once()
