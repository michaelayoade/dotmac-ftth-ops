"""
Workflow Schemas

Pydantic schemas for API request/response validation.
"""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field

from .models import StepStatus, WorkflowStatus

# Workflow Template Schemas


class WorkflowCreate(BaseModel):
    """Schema for creating a workflow template"""

    name: str = Field(..., min_length=1, max_length=255, description="Unique workflow name")
    description: str | None = Field(None, description="Workflow description")
    definition: dict[str, Any] = Field(..., description="Workflow definition with steps")
    version: str = Field(default="1.0.0", description="Workflow version")
    tags: dict[str, Any] | None = Field(None, description="Metadata tags")


class WorkflowUpdate(BaseModel):
    """Schema for updating a workflow template"""

    description: str | None = None
    definition: dict[str, Any] | None = None
    is_active: bool | None = None
    tags: dict[str, Any] | None = None


class WorkflowResponse(BaseModel):
    """Schema for workflow template response"""

    id: int
    name: str
    description: str | None
    definition: dict[str, Any]
    is_active: bool
    version: str
    tags: dict[str, Any] | None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class WorkflowListResponse(BaseModel):
    """Schema for workflow list response"""

    workflows: list[WorkflowResponse]
    total: int


# Workflow Execution Schemas


class WorkflowExecuteRequest(BaseModel):
    """Schema for executing a workflow"""

    workflow_name: str = Field(..., description="Name of workflow to execute")
    context: dict[str, Any] = Field(default_factory=dict, description="Input context")
    trigger_type: str = Field(default="manual", description="Trigger type")
    trigger_source: str | None = Field(None, description="Trigger source")
    tenant_id: str | None = Field(None, description="Tenant ID")


class WorkflowStepResponse(BaseModel):
    """Schema for workflow step response"""

    id: int
    step_name: str
    step_type: str
    sequence_number: int
    status: StepStatus
    input_data: dict[str, Any] | None
    output_data: dict[str, Any] | None
    error_message: str | None
    error_details: dict[str, Any] | None
    retry_count: int
    max_retries: int
    started_at: datetime | None
    completed_at: datetime | None
    duration_seconds: int | None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class WorkflowExecutionResponse(BaseModel):
    """Schema for workflow execution response"""

    id: int
    workflow_id: int
    status: WorkflowStatus
    context: dict[str, Any] | None
    result: dict[str, Any] | None
    error_message: str | None
    started_at: datetime | None
    completed_at: datetime | None
    trigger_type: str | None
    trigger_source: str | None
    tenant_id: str | None
    created_at: datetime
    updated_at: datetime
    steps: list[WorkflowStepResponse] | None = None

    class Config:
        from_attributes = True


class WorkflowExecutionListResponse(BaseModel):
    """Schema for execution list response"""

    executions: list[WorkflowExecutionResponse]
    total: int


class WorkflowStatsResponse(BaseModel):
    """Schema for workflow statistics response"""

    total: int
    by_status: dict[str, int]


# Built-in Workflow Definitions


class StepDefinition(BaseModel):
    """Schema for a single workflow step definition"""

    name: str = Field(..., description="Step name")
    type: str = Field(..., description="Step type: service_call, transform, condition, wait")
    description: str | None = Field(None, description="Step description")
    input: dict[str, Any] | None = Field(None, description="Step input parameters")
    params: dict[str, Any] | None = Field(None, description="Service call parameters")
    service: str | None = Field(None, description="Service name for service_call type")
    method: str | None = Field(None, description="Method name for service_call type")
    transform_type: str | None = Field(None, description="Transform type: map, filter")
    mapping: dict[str, str] | None = Field(None, description="Key mapping for transform")
    condition: dict[str, Any] | None = Field(None, description="Condition expression")
    duration: int | None = Field(None, description="Wait duration in seconds")
    max_retries: int = Field(default=3, description="Maximum retry attempts")


class WorkflowDefinition(BaseModel):
    """Schema for complete workflow definition"""

    steps: list[StepDefinition] = Field(..., description="Workflow steps")
    metadata: dict[str, Any] | None = Field(None, description="Workflow metadata")


# Examples for documentation


EXAMPLE_LEAD_TO_CUSTOMER_WORKFLOW = {
    "name": "lead_to_customer_onboarding",
    "description": "Automated workflow from qualified lead to deployed customer",
    "definition": {
        "steps": [
            {
                "name": "create_customer",
                "type": "service_call",
                "service": "customer_service",
                "method": "create_from_lead",
                "params": {
                    "lead_id": "${context.lead_id}",
                    "tenant_id": "${context.tenant_id}",
                },
                "max_retries": 3,
            },
            {
                "name": "create_subscription",
                "type": "service_call",
                "service": "billing_service",
                "method": "create_subscription",
                "params": {
                    "customer_id": "${step_create_customer_result.customer_id}",
                    "plan_id": "${context.plan_id}",
                },
                "max_retries": 3,
            },
            {
                "name": "issue_license",
                "type": "service_call",
                "service": "license_service",
                "method": "issue_license",
                "params": {
                    "customer_id": "${step_create_customer_result.customer_id}",
                    "license_template_id": "${context.license_template_id}",
                },
                "max_retries": 3,
            },
            {
                "name": "provision_tenant",
                "type": "service_call",
                "service": "deployment_service",
                "method": "provision_tenant",
                "params": {
                    "customer_id": "${step_create_customer_result.customer_id}",
                    "license_key": "${step_issue_license_result.license_key}",
                },
                "max_retries": 2,
            },
            {
                "name": "send_welcome_email",
                "type": "service_call",
                "service": "communications_service",
                "method": "send_template_email",
                "params": {
                    "template": "customer_welcome",
                    "recipient": "${step_create_customer_result.email}",
                    "variables": {
                        "customer_name": "${step_create_customer_result.name}",
                        "tenant_url": "${step_provision_tenant_result.tenant_url}",
                        "license_key": "${step_issue_license_result.license_key}",
                    },
                },
                "max_retries": 3,
            },
        ]
    },
    "version": "1.0.0",
    "tags": {"category": "onboarding", "priority": "high"},
}


EXAMPLE_QUOTE_ACCEPTED_WORKFLOW = {
    "name": "quote_accepted_to_order",
    "description": "Automated workflow from quote acceptance to order creation",
    "definition": {
        "steps": [
            {
                "name": "create_order",
                "type": "service_call",
                "service": "sales_service",
                "method": "create_order_from_quote",
                "params": {
                    "quote_id": "${context.quote_id}",
                },
                "max_retries": 3,
            },
            {
                "name": "check_payment_required",
                "type": "condition",
                "condition": {
                    "operator": "eq",
                    "left": "${context.payment_method}",
                    "right": "prepaid",
                },
            },
            {
                "name": "process_payment",
                "type": "service_call",
                "service": "billing_service",
                "method": "process_payment",
                "params": {
                    "order_id": "${step_create_order_result.order_id}",
                    "amount": "${context.total_amount}",
                },
                "max_retries": 2,
            },
            {
                "name": "trigger_deployment",
                "type": "service_call",
                "service": "deployment_service",
                "method": "schedule_deployment",
                "params": {
                    "order_id": "${step_create_order_result.order_id}",
                    "priority": "${context.priority}",
                },
                "max_retries": 3,
            },
            {
                "name": "notify_operations",
                "type": "service_call",
                "service": "notifications_service",
                "method": "notify_team",
                "params": {
                    "team": "operations",
                    "message": "New order ready for deployment",
                    "order_id": "${step_create_order_result.order_id}",
                },
                "max_retries": 3,
            },
        ]
    },
    "version": "1.0.0",
    "tags": {"category": "sales", "priority": "high"},
}
