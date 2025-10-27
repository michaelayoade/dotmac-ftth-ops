"""
Clean communications module initialization.

Provides a simple, clean API for the communications system using standard libraries.
This replaces the complex 392-line __init__.py with a much simpler implementation.
"""

# Version info
from ..version import get_version
from .email_service import (
    EmailMessage,
    EmailResponse,
    EmailService,
    get_email_service,
    send_email,
)
from .plugins import (
    list_plugins as list_email_plugins,
)
from .plugins import (
    register_plugin as register_email_plugin,
)
from .router import router
from .task_service import (
    BulkEmailJob,
    BulkEmailResult,
    TaskService,
    get_task_service,
    queue_bulk_emails,
    queue_email,
)
from .template_service import (
    RenderedTemplate,
    TemplateData,
    TemplateService,
    create_template,
    get_template_service,
    quick_render,
    render_template,
)

__version__ = get_version()

# Public API
__all__ = [
    # Email
    "EmailMessage",
    "EmailResponse",
    "EmailService",
    "get_email_service",
    "send_email",
    # Plugin helpers
    "register_email_plugin",
    "list_email_plugins",
    # Templates
    "TemplateData",
    "RenderedTemplate",
    "TemplateService",
    "get_template_service",
    "create_template",
    "render_template",
    "quick_render",
    # Tasks
    "BulkEmailJob",
    "BulkEmailResult",
    "TaskService",
    "get_task_service",
    "queue_email",
    "queue_bulk_emails",
    # Router
    "router",
    # Version
    "__version__",
]
