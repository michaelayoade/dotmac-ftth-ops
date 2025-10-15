"""
Fault Management Module

Comprehensive fault management system with:
- Alarm collection and correlation
- SLA monitoring and breach detection
- Automatic ticket creation
- Network event processing
"""

from dotmac.platform.fault_management.models import (
    Alarm,
    AlarmNote,
    AlarmRule,
    AlarmSeverity,
    AlarmSource,
    AlarmStatus,
    CorrelationAction,
    MaintenanceWindow,
    SLABreach,
    SLADefinition,
    SLAInstance,
    SLAStatus,
)
from dotmac.platform.fault_management.schemas import (
    AlarmCreate,
    AlarmQueryParams,
    AlarmResponse,
    AlarmStatistics,
    AlarmUpdate,
    SLABreachResponse,
    SLAComplianceReport,
    SLADefinitionCreate,
    SLADefinitionResponse,
    SLAInstanceResponse,
)

__all__ = [
    # Models
    "Alarm",
    "AlarmNote",
    "AlarmRule",
    "AlarmSeverity",
    "AlarmSource",
    "AlarmStatus",
    "CorrelationAction",
    "SLADefinition",
    "SLAInstance",
    "SLABreach",
    "SLAStatus",
    "MaintenanceWindow",
    # Schemas
    "AlarmCreate",
    "AlarmUpdate",
    "AlarmResponse",
    "AlarmQueryParams",
    "AlarmStatistics",
    "SLADefinitionCreate",
    "SLADefinitionResponse",
    "SLAInstanceResponse",
    "SLABreachResponse",
    "SLAComplianceReport",
]
