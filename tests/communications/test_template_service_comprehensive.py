"""
Comprehensive tests for template service to improve coverage.
"""

import os
import tempfile

import pytest

from dotmac.platform.communications.template_service import (
    TemplateData,
    TemplateService,
    create_template,
    get_template_service,
    quick_render,
    render_template,
)


@pytest.mark.unit
class TestTemplateServiceBasic:
    """Test basic template service operations."""

    def test_init_without_template_dir(self):
        """Test initialization without template directory."""
        service = TemplateService()

        assert service.template_dir is None
        assert service.file_env is None
        assert service.dict_env is not None
        assert len(service.templates) == 0

    def test_init_with_template_dir(self):
        """Test initialization with template directory."""
        with tempfile.TemporaryDirectory() as tmpdir:
            service = TemplateService(template_dir=tmpdir)

            assert service.template_dir == tmpdir
            assert service.file_env is not None
            assert service.dict_env is not None

    def test_init_with_nonexistent_dir(self):
        """Test initialization with nonexistent directory."""
        service = TemplateService(template_dir="/nonexistent/path")

        # Should still initialize but file_env should be None
        assert service.file_env is None
        assert service.dict_env is not None

    def test_template_globals_added(self):
        """Test that template globals are added."""
        service = TemplateService()

        # Check that common functions are available
        assert "len" in service.dict_env.globals
        assert "str" in service.dict_env.globals
        assert "now" in service.dict_env.globals
        assert "today" in service.dict_env.globals


@pytest.mark.unit
class TestTemplateCreation:
    """Test template creation operations."""

    def test_create_template_success(self):
        """Test successful template creation."""
        service = TemplateService()

        template_data = TemplateData(
            name="welcome_email",
            subject_template="Welcome {{ name }}!",
            text_template="Hello {{ name }}, welcome to {{ company }}.",
            html_template="<p>Hello {{ name }}</p>",
        )

        result = service.create_template(template_data)

        assert result.id is not None
        assert result.name == "welcome_email"
        assert "name" in result.variables
        assert "company" in result.variables
        assert template_data.id in service.templates

    def test_create_template_with_syntax_error(self):
        """Test template creation with syntax error."""
        service = TemplateService()

        template_data = TemplateData(
            name="bad_template",
            subject_template="Hello {{ name }",  # Missing closing brace
            text_template="Body",
        )

        with pytest.raises(ValueError) as exc_info:
            service.create_template(template_data)

        assert "Syntax error" in str(exc_info.value)

    def test_create_template_extracts_variables(self):
        """Test that template creation extracts variables."""
        service = TemplateService()

        template_data = TemplateData(
            name="test",
            subject_template="Hello {{ first_name }} {{ last_name }}",
            text_template="Your code is {{ code }}",
            html_template="<p>{{ first_name }}</p>",
        )

        result = service.create_template(template_data)

        # Should extract all unique variables
        assert set(result.variables) == {"first_name", "last_name", "code"}

    def test_create_template_no_variables(self):
        """Test creating template with no variables."""
        service = TemplateService()

        template_data = TemplateData(
            name="static_template", subject_template="Static Subject", text_template="Static Body"
        )

        result = service.create_template(template_data)

        assert result.variables == []


@pytest.mark.unit
class TestTemplateRetrieval:
    """Test template retrieval operations."""

    def test_get_template_success(self):
        """Test getting existing template."""
        service = TemplateService()

        template_data = TemplateData(name="test", subject_template="Subject", text_template="Body")
        created = service.create_template(template_data)

        retrieved = service.get_template(created.id)

        assert retrieved is not None
        assert retrieved.id == created.id
        assert retrieved.name == "test"

    def test_get_template_not_found(self):
        """Test getting nonexistent template."""
        service = TemplateService()

        result = service.get_template("nonexistent_id")

        assert result is None

    def test_list_templates_empty(self):
        """Test listing templates when none exist."""
        service = TemplateService()

        templates = service.list_templates()

        assert templates == []

    def test_list_templates_multiple(self):
        """Test listing multiple templates."""
        service = TemplateService()

        # Create multiple templates
        for i in range(3):
            template_data = TemplateData(
                name=f"template_{i}", subject_template=f"Subject {i}", text_template=f"Body {i}"
            )
            service.create_template(template_data)

        templates = service.list_templates()

        assert len(templates) == 3

    def test_delete_template_success(self):
        """Test deleting existing template."""
        service = TemplateService()

        template_data = TemplateData(
            name="to_delete", subject_template="Subject", text_template="Body"
        )
        created = service.create_template(template_data)

        result = service.delete_template(created.id)

        assert result is True
        assert service.get_template(created.id) is None

    def test_delete_template_not_found(self):
        """Test deleting nonexistent template."""
        service = TemplateService()

        result = service.delete_template("nonexistent_id")

        assert result is False


@pytest.mark.unit
class TestTemplateRendering:
    """Test template rendering operations."""

    def test_render_template_success(self):
        """Test successful template rendering."""
        service = TemplateService()

        template_data = TemplateData(
            name="greeting",
            subject_template="Hello {{ name }}!",
            text_template="Welcome {{ name }} to {{ company }}.",
            html_template="<p>Hello {{ name }}</p>",
        )
        created = service.create_template(template_data)

        result = service.render_template(created.id, {"name": "Alice", "company": "Acme Corp"})

        assert result.template_id == created.id
        assert result.subject == "Hello Alice!"
        assert "Alice" in result.text_body
        assert "Acme Corp" in result.text_body
        assert "<p>Hello Alice</p>" in result.html_body

    def test_render_template_not_found(self):
        """Test rendering nonexistent template."""
        service = TemplateService()

        with pytest.raises(ValueError) as exc_info:
            service.render_template("nonexistent", {})

        assert "not found" in str(exc_info.value)

    def test_render_template_missing_variables(self):
        """Test rendering with missing variables."""
        service = TemplateService()

        template_data = TemplateData(
            name="test", subject_template="Hello {{ name }}!", text_template="Code: {{ code }}"
        )
        created = service.create_template(template_data)

        # Render with only name, missing code
        result = service.render_template(created.id, {"name": "Bob"})

        assert result.missing_variables == ["code"]

    def test_render_template_no_missing_variables(self):
        """Test rendering with all variables provided."""
        service = TemplateService()

        template_data = TemplateData(
            name="test", subject_template="Hello {{ name }}!", text_template="Body"
        )
        created = service.create_template(template_data)

        result = service.render_template(created.id, {"name": "Charlie"})

        assert result.missing_variables == []

    def test_render_template_text_only(self):
        """Test rendering template with text only."""
        service = TemplateService()

        template_data = TemplateData(
            name="text_only", subject_template="Subject", text_template="Plain text body"
        )
        created = service.create_template(template_data)

        result = service.render_template(created.id, {})

        assert result.subject == "Subject"
        assert result.text_body == "Plain text body"
        assert result.html_body is None

    def test_render_template_html_only(self):
        """Test rendering template with HTML only."""
        service = TemplateService()

        template_data = TemplateData(
            name="html_only", subject_template="Subject", html_template="<p>HTML body</p>"
        )
        created = service.create_template(template_data)

        result = service.render_template(created.id, {})

        assert result.subject == "Subject"
        assert result.text_body is None
        assert result.html_body == "<p>HTML body</p>"


@pytest.mark.unit
class TestStringTemplateRendering:
    """Test rendering templates from strings."""

    def test_render_string_template_all_parts(self):
        """Test rendering with all template parts."""
        service = TemplateService()

        result = service.render_string_template(
            subject_template="Hello {{ name }}",
            text_template="Welcome {{ name }}",
            html_template="<p>Hello {{ name }}</p>",
            data={"name": "David"},
        )

        assert result["subject"] == "Hello David"
        assert result["text_body"] == "Welcome David"
        assert result["html_body"] == "<p>Hello David</p>"

    def test_render_string_template_subject_only(self):
        """Test rendering with subject only."""
        service = TemplateService()

        result = service.render_string_template(subject_template="Static Subject", data={})

        assert result["subject"] == "Static Subject"
        assert "text_body" not in result
        assert "html_body" not in result

    def test_render_string_template_no_data(self):
        """Test rendering with no data provided."""
        service = TemplateService()

        result = service.render_string_template(
            subject_template="No variables", text_template="Static text"
        )

        assert result["subject"] == "No variables"
        assert result["text_body"] == "Static text"

    def test_render_string_template_with_error(self):
        """Test rendering with template error."""
        service = TemplateService()

        with pytest.raises(ValueError) as exc_info:
            service.render_string_template(
                subject_template="Hello {{ name }",
                data={},  # Syntax error
            )

        assert "Template rendering error" in str(exc_info.value)


@pytest.mark.unit
class TestFileTemplateLoading:
    """Test file-based template loading."""

    def test_load_file_template_without_file_env(self):
        """Test loading file template when file env not configured."""
        service = TemplateService()

        with pytest.raises(ValueError) as exc_info:
            service.load_file_template("test.html")

        assert "not configured" in str(exc_info.value)

    def test_load_file_template_success(self):
        """Test successful file template loading."""
        with tempfile.TemporaryDirectory() as tmpdir:
            # Create a template file
            template_path = os.path.join(tmpdir, "test.html")
            with open(template_path, "w") as f:
                f.write("<p>Hello {{ name }}</p>")

            service = TemplateService(template_dir=tmpdir)

            template = service.load_file_template("test.html")

            assert template is not None
            rendered = template.render(name="Eve")
            assert "Hello Eve" in rendered


@pytest.mark.unit
class TestTemplateServiceFactory:
    """Test factory and convenience functions."""

    def test_get_template_service_singleton(self):
        """Test that get_template_service returns singleton."""
        # Reset singleton
        import dotmac.platform.communications.template_service as ts_module

        ts_module._template_service = None

        service1 = get_template_service()
        service2 = get_template_service()

        assert service1 is service2

    def test_create_template_convenience(self):
        """Test create_template convenience function."""
        # Reset singleton
        import dotmac.platform.communications.template_service as ts_module

        ts_module._template_service = None

        result = create_template(
            name="test_convenience",
            subject_template="Subject {{ var }}",
            text_template="Body {{ var }}",
            html_template="<p>{{ var }}</p>",
        )

        assert result.name == "test_convenience"
        assert "var" in result.variables

    def test_render_template_convenience(self):
        """Test render_template convenience function."""
        # Reset singleton
        import dotmac.platform.communications.template_service as ts_module

        ts_module._template_service = None

        # Create a template first
        template = create_template(
            name="render_test", subject_template="Hello {{ name }}", text_template="Body"
        )

        # Render it
        result = render_template(template.id, {"name": "Frank"})

        assert result.subject == "Hello Frank"

    def test_quick_render_convenience(self):
        """Test quick_render convenience function."""
        # Reset singleton
        import dotmac.platform.communications.template_service as ts_module

        ts_module._template_service = None

        result = quick_render(
            subject="Quick {{ name }}",
            text_body="Body {{ name }}",
            html_body="<p>{{ name }}</p>",
            data={"name": "Grace"},
        )

        assert result["subject"] == "Quick Grace"
        assert result["text_body"] == "Body Grace"
        assert result["html_body"] == "<p>Grace</p>"

    def test_quick_render_no_data(self):
        """Test quick_render with no data."""
        # Reset singleton
        import dotmac.platform.communications.template_service as ts_module

        ts_module._template_service = None

        result = quick_render(subject="Static", text_body="Static body")

        assert result["subject"] == "Static"
        assert result["text_body"] == "Static body"


@pytest.mark.unit
class TestTemplateErrorHandling:
    """Test error handling in template operations."""

    def test_extract_variables_with_syntax_error(self):
        """Test variable extraction skips templates with syntax errors."""
        service = TemplateService()

        # The _extract_variables method should skip templates with syntax errors
        template_data = TemplateData(
            name="test",
            subject_template="Hello {{ name }}",  # Valid
            text_template="Bad {{ syntax }",  # Invalid
            html_template="<p>{{ other }}</p>",  # Valid
        )

        # This should still extract variables from valid templates
        variables = service._extract_variables(template_data)

        # Should extract from valid templates only
        assert "name" in variables
        assert "other" in variables

    def test_validate_template_syntax_error_in_text(self):
        """Test syntax validation catches errors in text template."""
        service = TemplateService()

        template_data = TemplateData(
            name="test",
            subject_template="Valid {{ var }}",
            text_template="Invalid {{ var }",  # Missing closing brace
        )

        with pytest.raises(ValueError) as exc_info:
            service._validate_template_syntax(template_data)

        assert "Syntax error in text template" in str(exc_info.value)

    def test_validate_template_syntax_error_in_html(self):
        """Test syntax validation catches errors in HTML template."""
        service = TemplateService()

        template_data = TemplateData(
            name="test",
            subject_template="Valid",
            html_template="Invalid {{ var }",  # Missing closing brace
        )

        with pytest.raises(ValueError) as exc_info:
            service._validate_template_syntax(template_data)

        assert "Syntax error in html template" in str(exc_info.value)

    def test_find_missing_variables(self):
        """Test finding missing variables."""
        service = TemplateService()

        template_data = TemplateData(
            name="test", subject_template="Hello {{ name }}", text_template="Code: {{ code }}"
        )
        # Manually set variables
        template_data.variables = ["name", "code", "extra"]

        missing = service._find_missing_variables(template_data, {"name": "Test", "code": "123"})

        assert missing == ["extra"]
