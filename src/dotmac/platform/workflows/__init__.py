"""
Workflow Engine Module

Provides workflow orchestration capabilities for automating multi-step
business processes across modules (CRM, Sales, Billing, Deployment).
"""

from .models import (
    Workflow,
    WorkflowExecution,
    WorkflowStep,
    WorkflowStatus,
    StepStatus,
)
from .engine import WorkflowEngine
from .service import WorkflowService
from .service_registry import ServiceRegistry, create_default_registry
from .event_handlers import WorkflowEventHandler, register_workflow_event_handlers
from .builtin_workflows import get_all_builtin_workflows, get_workflow_by_name

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
