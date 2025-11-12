"""
Field Service Module

Technician management, job assignment, and field operations tracking.
"""

from __future__ import annotations

import structlog

# Import project_management models first to ensure TechnicianSchedule and TaskAssignment
# are registered with SQLAlchemy before Technician references them in relationships.
try:
    from dotmac.platform import project_management  # noqa: F401
except Exception as exc:  # pragma: no cover - defensive to keep technicians available
    logger_temp = structlog.get_logger(__name__)
    logger_temp.warning(
        "field_service.project_management_import_failed",
        error=str(exc),
    )

from dotmac.platform.field_service.models import (
    Technician,
    TechnicianAvailability,
    TechnicianLocationHistory,
    TechnicianSkillLevel,
    TechnicianStatus,
)

logger = structlog.get_logger(__name__)

__all__ = [
    "Technician",
    "TechnicianStatus",
    "TechnicianSkillLevel",
    "TechnicianAvailability",
    "TechnicianLocationHistory",
]
