"""
Fault Management API Router

REST endpoints for alarm management, SLA monitoring, and maintenance windows.
"""

from datetime import datetime
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.auth.core import UserInfo
from dotmac.platform.auth.rbac_dependencies import require_permission
from dotmac.platform.db import get_session_dependency
from dotmac.platform.fault_management.schemas import (
    AlarmAcknowledge,
    AlarmCreate,
    AlarmCreateTicketRequest,
    AlarmNoteCreate,
    AlarmQueryParams,
    AlarmResponse,
    AlarmRuleCreate,
    AlarmRuleResponse,
    AlarmRuleUpdate,
    AlarmStatistics,
    AlarmUpdate,
    MaintenanceWindowCreate,
    MaintenanceWindowResponse,
    MaintenanceWindowUpdate,
    SLABreachResponse,
    SLAComplianceReport,
    SLADefinitionCreate,
    SLADefinitionResponse,
    SLADefinitionUpdate,
    SLAInstanceCreate,
    SLAInstanceResponse,
    SLAStatus,
)
from dotmac.platform.fault_management.service import AlarmService
from dotmac.platform.fault_management.sla_service import SLAMonitoringService
from dotmac.platform.tenant.dependencies import TenantAdminAccess

router = APIRouter(prefix="/api/v1/faults", tags=["Fault Management"])


# =============================================================================
# Dependencies
# =============================================================================


def get_alarm_service(
    tenant_access: TenantAdminAccess,
    session: AsyncSession = Depends(get_session_dependency),
) -> AlarmService:
    """Get alarm service instance"""
    _, tenant = tenant_access
    return AlarmService(session, tenant.id)


def get_sla_service(
    tenant_access: TenantAdminAccess,
    session: AsyncSession = Depends(get_session_dependency),
) -> SLAMonitoringService:
    """Get SLA monitoring service instance"""
    _, tenant = tenant_access
    return SLAMonitoringService(session, tenant.id)


# =============================================================================
# Alarm Endpoints
# =============================================================================


@router.post(
    "/alarms",
    response_model=AlarmResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create Alarm",
    description="Create new alarm with automatic correlation",
)
async def create_alarm(
    data: AlarmCreate,
    user: UserInfo = Depends(require_permission("faults.alarms.write")),
    service: AlarmService = Depends(get_alarm_service),
) -> AlarmResponse:
    """Create new alarm"""
    return await service.create(data, user_id=user.user_id)


@router.get(
    "/alarms",
    response_model=list[AlarmResponse],
    summary="List Alarms",
    description="List alarms with filtering and pagination",
)
async def list_alarms(
    severity: list[str] | None = Query(None),
    status: list[str] | None = Query(None),
    source: list[str] | None = Query(None),
    alarm_type: str | None = Query(None),
    resource_type: str | None = Query(None),
    resource_id: str | None = Query(None),
    customer_id: UUID | None = Query(None),
    assigned_to: UUID | None = Query(None),
    is_root_cause: bool | None = Query(None),
    from_date: datetime | None = Query(None),
    to_date: datetime | None = Query(None),
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    _: UserInfo = Depends(require_permission("faults.alarms.read")),
    service: AlarmService = Depends(get_alarm_service),
) -> list[AlarmResponse]:
    """List alarms"""
    params = AlarmQueryParams(
        severity=severity,
        status=status,
        source=source,
        alarm_type=alarm_type,
        resource_type=resource_type,
        resource_id=resource_id,
        customer_id=customer_id,
        assigned_to=assigned_to,
        is_root_cause=is_root_cause,
        from_date=from_date,
        to_date=to_date,
        limit=limit,
        offset=offset,
    )
    result = await service.query(params)
    return list(result)


@router.get(
    "/alarms/{alarm_id}",
    response_model=AlarmResponse,
    summary="Get Alarm",
    description="Get alarm details by ID",
)
async def get_alarm(
    alarm_id: UUID,
    _: UserInfo = Depends(require_permission("faults.alarms.read")),
    service: AlarmService = Depends(get_alarm_service),
) -> AlarmResponse:
    """Get alarm by ID"""
    alarm = await service.get(alarm_id)
    if not alarm:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alarm not found")
    return alarm


@router.patch(
    "/alarms/{alarm_id}",
    response_model=AlarmResponse,
    summary="Update Alarm",
    description="Update alarm properties",
)
async def update_alarm(
    alarm_id: UUID,
    data: AlarmUpdate,
    user: UserInfo = Depends(require_permission("faults.alarms.write")),
    service: AlarmService = Depends(get_alarm_service),
) -> AlarmResponse:
    """Update alarm"""
    alarm = await service.update(alarm_id, data, user_id=user.user_id)
    if not alarm:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alarm not found")
    return alarm


@router.post(
    "/alarms/{alarm_id}/acknowledge",
    response_model=AlarmResponse,
    summary="Acknowledge Alarm",
    description="Acknowledge alarm to show it's being handled",
)
async def acknowledge_alarm(
    alarm_id: UUID,
    data: AlarmAcknowledge,
    user: UserInfo = Depends(require_permission("faults.alarms.write")),
    service: AlarmService = Depends(get_alarm_service),
) -> AlarmResponse:
    """Acknowledge alarm"""
    alarm = await service.acknowledge(alarm_id, data.note, user.user_id)
    if not alarm:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alarm not found")
    return alarm


@router.post(
    "/alarms/{alarm_id}/clear",
    response_model=AlarmResponse,
    summary="Clear Alarm",
    description="Clear alarm and correlated children",
)
async def clear_alarm(
    alarm_id: UUID,
    user: UserInfo = Depends(require_permission("faults.alarms.write")),
    service: AlarmService = Depends(get_alarm_service),
) -> AlarmResponse:
    """Clear alarm"""
    alarm = await service.clear(alarm_id, user_id=user.user_id)
    if not alarm:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alarm not found")
    return alarm


@router.post(
    "/alarms/{alarm_id}/resolve",
    response_model=AlarmResponse,
    summary="Resolve Alarm",
    description="Mark alarm as resolved with resolution note",
)
async def resolve_alarm(
    alarm_id: UUID,
    resolution_note: str,
    user: UserInfo = Depends(require_permission("faults.alarms.write")),
    service: AlarmService = Depends(get_alarm_service),
) -> AlarmResponse:
    """Resolve alarm"""
    alarm = await service.resolve(alarm_id, resolution_note, user.user_id)
    if not alarm:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alarm not found")
    return alarm


@router.post(
    "/alarms/{alarm_id}/notes",
    status_code=status.HTTP_201_CREATED,
    summary="Add Alarm Note",
    description="Add investigation note to alarm",
)
async def add_alarm_note(
    alarm_id: UUID,
    data: AlarmNoteCreate,
    user: UserInfo = Depends(require_permission("faults.alarms.write")),
    service: AlarmService = Depends(get_alarm_service),
) -> dict[str, Any]:
    """Add note to alarm"""
    await service.add_note(alarm_id, data, user.user_id)
    return {"message": "Note added successfully"}


@router.post(
    "/alarms/{alarm_id}/create-ticket",
    status_code=status.HTTP_201_CREATED,
    summary="Create Ticket from Alarm",
    description="Manually create a support ticket from an alarm",
)
async def create_ticket_from_alarm(
    alarm_id: UUID,
    data: AlarmCreateTicketRequest,
    user: UserInfo = Depends(require_permission("faults.alarms.write")),
    service: AlarmService = Depends(get_alarm_service),
) -> dict[str, Any]:
    """
    Create a support ticket from an alarm.

    This allows operators to manually escalate alarms to support tickets.
    The alarm details, probable cause, and recommended actions are automatically
    included in the ticket description.
    """
    try:
        result = await service.create_ticket_from_alarm(
            alarm_id=alarm_id,
            priority=data.priority,
            additional_notes=data.additional_notes,
            assign_to_user_id=data.assign_to_user_id,
            user_id=user.user_id,
        )
        if not isinstance(result, dict):
            raise TypeError("AlarmService.create_ticket_from_alarm must return a dictionary")
        return result
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create ticket: {str(e)}",
        )


@router.get(
    "/alarms/statistics",
    response_model=AlarmStatistics,
    summary="Get Alarm Statistics",
    description="Get aggregated alarm statistics",
)
async def get_alarm_statistics(
    from_date: datetime | None = Query(None),
    to_date: datetime | None = Query(None),
    _: UserInfo = Depends(require_permission("faults.alarms.read")),
    service: AlarmService = Depends(get_alarm_service),
) -> AlarmStatistics:
    """Get alarm statistics"""
    return await service.get_statistics(from_date, to_date)


# =============================================================================
# Alarm Rule Endpoints
# =============================================================================


@router.post(
    "/alarm-rules",
    response_model=AlarmRuleResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create Alarm Rule",
    description="Create correlation/suppression/escalation rule",
)
async def create_alarm_rule(
    data: AlarmRuleCreate,
    user: UserInfo = Depends(require_permission("faults.rules.write")),
    service: AlarmService = Depends(get_alarm_service),
) -> AlarmRuleResponse:
    """Create alarm rule"""
    return await service.create_rule(data, user_id=user.user_id)


@router.get(
    "/alarm-rules",
    response_model=list[AlarmRuleResponse],
    summary="List Alarm Rules",
    description="List all alarm rules",
)
async def list_alarm_rules(
    _: UserInfo = Depends(require_permission("faults.rules.read")),
    service: AlarmService = Depends(get_alarm_service),
) -> list[AlarmRuleResponse]:
    """List alarm rules"""
    result = await service.list_rules()
    return list(result)


@router.patch(
    "/alarm-rules/{rule_id}",
    response_model=AlarmRuleResponse,
    summary="Update Alarm Rule",
    description="Update alarm rule configuration",
)
async def update_alarm_rule(
    rule_id: UUID,
    data: AlarmRuleUpdate,
    user: UserInfo = Depends(require_permission("faults.rules.write")),
    service: AlarmService = Depends(get_alarm_service),
) -> AlarmRuleResponse:
    """Update alarm rule"""
    rule = await service.update_rule(rule_id, data, user_id=user.user_id)
    if not rule:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rule not found")
    return rule


@router.delete(
    "/alarm-rules/{rule_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete Alarm Rule",
    description="Delete alarm rule",
)
async def delete_alarm_rule(
    rule_id: UUID,
    _: UserInfo = Depends(require_permission("faults.rules.write")),
    service: AlarmService = Depends(get_alarm_service),
) -> None:
    """Delete alarm rule"""
    deleted = await service.delete_rule(rule_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rule not found")


# =============================================================================
# SLA Definition Endpoints
# =============================================================================


@router.post(
    "/sla-definitions",
    response_model=SLADefinitionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create SLA Definition",
    description="Create SLA template with targets",
)
async def create_sla_definition(
    data: SLADefinitionCreate,
    user: UserInfo = Depends(require_permission("faults.sla.write")),
    service: SLAMonitoringService = Depends(get_sla_service),
) -> SLADefinitionResponse:
    """Create SLA definition"""
    return await service.create_definition(data, user_id=user.user_id)


@router.get(
    "/sla-definitions",
    response_model=list[SLADefinitionResponse],
    summary="List SLA Definitions",
    description="List all SLA definitions",
)
async def list_sla_definitions(
    _: UserInfo = Depends(require_permission("faults.sla.read")),
    service: SLAMonitoringService = Depends(get_sla_service),
) -> list[SLADefinitionResponse]:
    """List SLA definitions"""
    result = await service.list_definitions()
    return list(result)


@router.patch(
    "/sla-definitions/{definition_id}",
    response_model=SLADefinitionResponse,
    summary="Update SLA Definition",
    description="Update SLA definition targets",
)
async def update_sla_definition(
    definition_id: UUID,
    data: SLADefinitionUpdate,
    _: UserInfo = Depends(require_permission("faults.sla.write")),
    service: SLAMonitoringService = Depends(get_sla_service),
) -> SLADefinitionResponse:
    """Update SLA definition"""
    definition = await service.update_definition(definition_id, data)
    if not definition:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Definition not found")
    return definition


# =============================================================================
# SLA Instance Endpoints
# =============================================================================


@router.post(
    "/sla-instances",
    response_model=SLAInstanceResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create SLA Instance",
    description="Create SLA instance for customer/service",
)
async def create_sla_instance(
    data: SLAInstanceCreate,
    user: UserInfo = Depends(require_permission("faults.sla.write")),
    service: SLAMonitoringService = Depends(get_sla_service),
) -> SLAInstanceResponse:
    """Create SLA instance"""
    return await service.create_instance(data, user_id=user.user_id)


@router.get(
    "/sla-instances",
    response_model=list[SLAInstanceResponse],
    summary="List SLA Instances",
    description="List SLA instances with filters",
)
async def list_sla_instances(
    customer_id: UUID | None = Query(None),
    service_id: UUID | None = Query(None),
    status_filter: SLAStatus | None = Query(None, alias="status"),
    _: UserInfo = Depends(require_permission("faults.sla.read")),
    service: SLAMonitoringService = Depends(get_sla_service),
) -> list[SLAInstanceResponse]:
    """List SLA instances"""
    result = await service.list_instances(customer_id, service_id, status_filter)
    return list(result)


@router.get(
    "/sla-instances/{instance_id}",
    response_model=SLAInstanceResponse,
    summary="Get SLA Instance",
    description="Get SLA instance details",
)
async def get_sla_instance(
    instance_id: UUID,
    _: UserInfo = Depends(require_permission("faults.sla.read")),
    service: SLAMonitoringService = Depends(get_sla_service),
) -> SLAInstanceResponse:
    """Get SLA instance"""
    instance = await service.get_instance(instance_id)
    if not instance:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Instance not found")
    return instance


# =============================================================================
# SLA Breach Endpoints
# =============================================================================


@router.get(
    "/sla-breaches",
    response_model=list[SLABreachResponse],
    summary="List SLA Breaches",
    description="List SLA breach records",
)
async def list_sla_breaches(
    instance_id: UUID | None = Query(None),
    resolved: bool | None = Query(None),
    _: UserInfo = Depends(require_permission("faults.sla.read")),
    service: SLAMonitoringService = Depends(get_sla_service),
) -> list[SLABreachResponse]:
    """List SLA breaches"""
    result = await service.list_breaches(instance_id, resolved)
    return list(result)


@router.get(
    "/sla-compliance",
    response_model=SLAComplianceReport,
    summary="Get SLA Compliance Report",
    description="Generate compliance report for period",
)
async def get_sla_compliance_report(
    customer_id: UUID | None = Query(None),
    period_start: datetime | None = Query(None),
    period_end: datetime | None = Query(None),
    _: UserInfo = Depends(require_permission("faults.sla.read")),
    service: SLAMonitoringService = Depends(get_sla_service),
) -> SLAComplianceReport:
    """Get SLA compliance report"""
    return await service.get_compliance_report(customer_id, period_start, period_end)


# =============================================================================
# Maintenance Window Endpoints
# =============================================================================


@router.post(
    "/maintenance-windows",
    response_model=MaintenanceWindowResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create Maintenance Window",
    description="Schedule maintenance window",
)
async def create_maintenance_window(
    data: MaintenanceWindowCreate,
    user: UserInfo = Depends(require_permission("faults.maintenance.write")),
    alarm_service: AlarmService = Depends(get_alarm_service),
) -> MaintenanceWindowResponse:
    """Create maintenance window"""
    return await alarm_service.create_maintenance_window(data, user_id=user.user_id)


@router.patch(
    "/maintenance-windows/{window_id}",
    response_model=MaintenanceWindowResponse,
    summary="Update Maintenance Window",
    description="Update maintenance window",
)
async def update_maintenance_window(
    window_id: UUID,
    data: MaintenanceWindowUpdate,
    _: UserInfo = Depends(require_permission("faults.maintenance.write")),
    alarm_service: AlarmService = Depends(get_alarm_service),
) -> MaintenanceWindowResponse:
    """Update maintenance window"""
    window = await alarm_service.update_maintenance_window(window_id, data)
    if not window:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Window not found")
    return window
