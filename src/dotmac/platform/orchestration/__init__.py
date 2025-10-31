"""
Orchestration Service

Provides atomic multi-system operations with automatic rollback capabilities.
Implements the Saga pattern for distributed transactions across RADIUS, VOLTHA,
NetBox, GenieACS, Billing, and other systems.

Key Features:
- Atomic subscriber provisioning
- Automatic rollback on failures
- Workflow state persistence
- Retry mechanisms
- Comprehensive logging and monitoring
"""

from .models import (
    OrchestrationWorkflow,
    OrchestrationWorkflowStep,
    WorkflowStatus,
    WorkflowStepStatus,
    WorkflowType,
)
from .saga import SagaOrchestrator
from .schemas import (
    ProvisionSubscriberRequest,
    ProvisionSubscriberResponse,
    WorkflowResponse,
    WorkflowStepResponse,
)
from .service import OrchestrationService

# Backwards compatibility exports for legacy imports
Workflow = OrchestrationWorkflow
WorkflowStep = OrchestrationWorkflowStep

__all__ = [
    # Models
    "OrchestrationWorkflow",
    "OrchestrationWorkflowStep",
    "Workflow",
    "WorkflowStep",
    "WorkflowStatus",
    "WorkflowStepStatus",
    "WorkflowType",
    # Schemas
    "ProvisionSubscriberRequest",
    "ProvisionSubscriberResponse",
    "WorkflowResponse",
    "WorkflowStepResponse",
    # Services
    "OrchestrationService",
    "SagaOrchestrator",
]
