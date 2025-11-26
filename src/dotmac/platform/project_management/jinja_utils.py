"""
Jinja2 Template Utilities

Utilities for rendering project and task templates using Jinja2.
"""

from typing import Any

import structlog
from jinja2 import Environment, StrictUndefined, TemplateSyntaxError, select_autoescape

logger = structlog.get_logger(__name__)


def create_jinja_environment() -> Environment:
    """
    Create a Jinja2 environment for template rendering.

    Features:
    - StrictUndefined: Raises error on missing variables (fail fast)
    - trim_blocks: Remove first newline after block
    - lstrip_blocks: Strip leading spaces/tabs from block
    - autoescape: Enabled for HTML/XML files only (security best practice)

    Returns:
        Configured Jinja2 Environment
    """
    env = Environment(
        undefined=StrictUndefined,
        trim_blocks=True,
        lstrip_blocks=True,
        autoescape=select_autoescape(enabled_extensions=("html", "xml"), default_for_string=False),
    )

    # Add custom filters
    env.filters["titlecase"] = lambda s: s.title() if s else ""
    env.filters["uppercase"] = lambda s: s.upper() if s else ""
    env.filters["lowercase"] = lambda s: s.lower() if s else ""

    return env


# Global Jinja2 environment
jinja_env = create_jinja_environment()
_ERROR_SENTINEL = "__TEMPLATE_RENDER_ERROR__"


def render_template(
    template_string: str | None,
    context: dict[str, Any],
    default: str = "",
) -> str:
    """
    Render a Jinja2 template string with the given context.

    Args:
        template_string: Jinja2 template string (e.g., "Hello {{ name }}")
        context: Dictionary of variables to render
        default: Default value if template_string is None or rendering fails

    Returns:
        Rendered string or default value

    Examples:
        >>> render_template("Project - {{ customer_name }}", {"customer_name": "Acme"})
        'Project - Acme'

        >>> render_template("{{ customer_name|upper }}", {"customer_name": "acme corp"})
        'ACME CORP'

        >>> render_template("{% if priority == 'high' %}URGENT{% endif %}", {"priority": "high"})
        'URGENT'
    """
    if not template_string:
        return default

    try:
        template = jinja_env.from_string(template_string)
        rendered = template.render(**context)
        return rendered.strip()
    except TemplateSyntaxError as e:
        logger.error(
            "Jinja2 template syntax error",
            template=template_string,
            error=str(e),
            line=e.lineno,
        )
        return default
    except Exception as e:
        logger.error(
            "Failed to render Jinja2 template",
            template=template_string,
            error=str(e),
            exc_info=True,
        )
        return default


def validate_template(template_string: str) -> tuple[bool, str | None]:
    """
    Validate a Jinja2 template string for syntax errors.

    Args:
        template_string: Template string to validate

    Returns:
        Tuple of (is_valid, error_message)

    Examples:
        >>> validate_template("Hello {{ name }}")
        (True, None)

        >>> validate_template("Hello {{ name")
        (False, "unexpected end of template")
    """
    try:
        jinja_env.from_string(template_string)
        return True, None
    except TemplateSyntaxError as e:
        return False, f"Syntax error at line {e.lineno}: {e.message}"
    except Exception as e:
        return False, str(e)


def render_with_fallback(
    template_string: str | None,
    context: dict[str, Any],
    fallback_template: str,
) -> str:
    """
    Render template with automatic fallback to simpler template on error.

    Useful when user-provided templates might have errors.

    Args:
        template_string: Primary template to try
        context: Rendering context
        fallback_template: Fallback template if primary fails

    Returns:
        Rendered string from primary or fallback template
    """
    if not template_string:
        return render_template(fallback_template, context)

    # Try primary template
    result = render_template(template_string, context, default=_ERROR_SENTINEL)
    if result != _ERROR_SENTINEL:
        return result

    # Fall back to simpler template
    logger.warning(
        "Falling back to default template",
        primary_template=template_string,
        fallback_template=fallback_template,
    )
    return render_template(fallback_template, context, default="")
