"""
Diagnostics Module.

Network diagnostics and troubleshooting for ISP services.
"""

# Import only models to avoid circular imports
# Lazy import for service to avoid circular imports
from typing import Any

from dotmac.platform.diagnostics.models import (
    DiagnosticRun,
    DiagnosticSeverity,
    DiagnosticStatus,
    DiagnosticType,
)


def __getattr__(name: str) -> Any:
    if name == "DiagnosticsService":
        from dotmac.platform.diagnostics.service import DiagnosticsService

        return DiagnosticsService
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")


__all__ = [
    # Models
    "DiagnosticRun",
    "DiagnosticType",
    "DiagnosticStatus",
    "DiagnosticSeverity",
    # Services
    "DiagnosticsService",
]
