"""
Audit and activity tracking module for the DotMac platform.

This module provides comprehensive audit logging and activity tracking capabilities
for monitoring user actions, system events, and security-related activities.

Key Features:
- Comprehensive activity logging with structured metadata
- Multi-tenant aware audit trails
- RESTful API endpoints for audit data retrieval
- Dashboard-ready activity summaries
- Configurable retention and filtering
- Integration with existing authentication and authorization

Usage Examples:

    # Log user activities
    from dotmac.platform.audit import log_user_activity, ActivityType

    await log_user_activity(
        user_id="user123",
        activity_type=ActivityType.USER_LOGIN,
        action="login",
        description="User logged in successfully",
        metadata={"ip": "192.168.1.100"}
    )

    # Log API activities
    from dotmac.platform.audit import log_api_activity

    await log_api_activity(
        request=request,
        action="create_secret",
        description="Created new secret via API",
        resource_type="secret",
        resource_id="secret_id"
    )

    # Get recent activities for frontend
    from dotmac.platform.audit import AuditService

    service = AuditService()
    activities = await service.get_recent_activities(
        tenant_id="tenant123",
        limit=20
    )
"""

from .middleware import AuditContextMiddleware, create_audit_aware_dependency
from .models import (
    ActivitySeverity,
    ActivityType,
    AuditActivity,
    AuditActivityCreate,
    AuditActivityList,
    AuditActivityResponse,
    AuditFilterParams,
)
from .service import (
    AuditService,
    log_api_activity,
    log_system_activity,
    log_user_activity,
)

__all__ = [
    # Models and enums
    "ActivityType",
    "ActivitySeverity",
    "AuditActivity",
    "AuditActivityCreate",
    "AuditActivityResponse",
    "AuditActivityList",
    "AuditFilterParams",
    # Service and helpers
    "AuditService",
    "log_user_activity",
    "log_api_activity",
    "log_system_activity",
    # Middleware
    "AuditContextMiddleware",
    "create_audit_aware_dependency",
]
