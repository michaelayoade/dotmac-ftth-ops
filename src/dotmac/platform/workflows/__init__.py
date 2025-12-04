"""
Workflow Engine Module

Provides workflow orchestration capabilities for automating multi-step
business processes across modules (CRM, Sales, Billing, Deployment).
"""

from .builtin_workflows import get_all_builtin_workflows, get_workflow_by_name
from .engine import WorkflowEngine
from .event_handlers import WorkflowEventHandler, register_workflow_event_handlers
from .models import (
    StepStatus,
    Workflow,
    WorkflowExecution,
    WorkflowStatus,
    WorkflowStep,
)
from .service import WorkflowService
from .service_registry import ServiceRegistry, create_default_registry

__all__ = [
    "Workflow",
    "WorkflowExecution",
    "WorkflowStep",
    "WorkflowStatus",
    "StepStatus",
    "WorkflowEngine",
    "WorkflowService",
    "ServiceRegistry",
    "create_default_registry",
    "WorkflowEventHandler",
    "register_workflow_event_handlers",
    "get_all_builtin_workflows",
    "get_workflow_by_name",
]
