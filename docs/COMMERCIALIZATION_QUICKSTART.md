# Commercialization Control Plane - Quick Start Guide

## For Development Teams

This guide provides practical next steps for implementing the Commercialization Control Plane, focusing on Phase 1 (Foundation & Integration).

---

## Week 1: Sprint 1 - Workflow Engine Foundation

### Day 1-2: Project Setup

#### 1. Create Workflow Module Structure

```bash
mkdir -p src/dotmac/platform/workflows
cd src/dotmac/platform/workflows
touch __init__.py engine.py models.py schemas.py router.py service.py
```

#### 2. Define Workflow Models

**File**: `src/dotmac/platform/workflows/models.py`

```python
from sqlalchemy import Column, Integer, String, JSON, DateTime, Enum, Boolean, Text
from sqlalchemy.orm import relationship
from ..core.models import Base, TimestampMixin
import enum

class WorkflowStatus(str, enum.Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"

class StepStatus(str, enum.Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    SKIPPED = "skipped"

class Workflow(Base, TimestampMixin):
    """Workflow template definition"""
    __tablename__ = "workflows"

    id = Column(Integer, primary_key=True)
    name = Column(String(255), unique=True, nullable=False, index=True)
    description = Column(Text)
    definition = Column(JSON, nullable=False)  # Workflow steps definition
    is_active = Column(Boolean, default=True, nullable=False)
    version = Column(String(20), default="1.0.0")
    tags = Column(JSON)

    executions = relationship("WorkflowExecution", back_populates="workflow")

class WorkflowExecution(Base, TimestampMixin):
    """Workflow execution instance"""
    __tablename__ = "workflow_executions"

    id = Column(Integer, primary_key=True)
    workflow_id = Column(Integer, ForeignKey("workflows.id"), nullable=False)
    status = Column(Enum(WorkflowStatus), default=WorkflowStatus.PENDING, nullable=False)
    context = Column(JSON)  # Input data
    result = Column(JSON)  # Output data
    error_message = Column(Text)
    started_at = Column(DateTime)
    completed_at = Column(DateTime)

    # Relationships
    workflow = relationship("Workflow", back_populates="executions")
    steps = relationship("WorkflowStep", back_populates="execution", cascade="all, delete-orphan")

    # Source tracking
    trigger_type = Column(String(50))  # "manual", "event", "scheduled"
    trigger_source = Column(String(255))  # Event name or user ID
    tenant_id = Column(Integer, ForeignKey("tenant.id"))

class WorkflowStep(Base, TimestampMixin):
    """Individual step in workflow execution"""
    __tablename__ = "workflow_steps"

    id = Column(Integer, primary_key=True)
    execution_id = Column(Integer, ForeignKey("workflow_executions.id"), nullable=False)
    step_name = Column(String(255), nullable=False)
    step_type = Column(String(50), nullable=False)  # "service_call", "condition", "transform"
    sequence_number = Column(Integer, nullable=False)
    status = Column(Enum(StepStatus), default=StepStatus.PENDING, nullable=False)
    input_data = Column(JSON)
    output_data = Column(JSON)
    error_message = Column(Text)
    retry_count = Column(Integer, default=0)
    started_at = Column(DateTime)
    completed_at = Column(DateTime)
    duration_seconds = Column(Integer)

    execution = relationship("WorkflowExecution", back_populates="steps")
```

#### 3. Create Database Migration

```bash
# Generate migration
poetry run alembic revision -m "Add workflow tables"

# Edit the generated migration file
```

**Migration Content**:
```python
def upgrade():
    # Create workflow tables
    op.create_table(
        'workflows',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text()),
        sa.Column('definition', sa.JSON(), nullable=False),
        sa.Column('is_active', sa.Boolean(), default=True),
        sa.Column('version', sa.String(20)),
        sa.Column('tags', sa.JSON()),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_workflows_name', 'workflows', ['name'], unique=True)

    # Similar for workflow_executions and workflow_steps...
```

### Day 3-4: Workflow Engine Implementation

**File**: `src/dotmac/platform/workflows/engine.py`

```python
from typing import Any, Dict, Optional
from datetime import datetime
from sqlalchemy.orm import Session
from .models import Workflow, WorkflowExecution, WorkflowStep, WorkflowStatus, StepStatus


class WorkflowEngine:
    """Execute workflows with step-by-step processing"""

    def __init__(self, db: Session):
        self.db = db

    async def execute_workflow(
        self,
        workflow_name: str,
        context: Dict[str, Any],
        tenant_id: Optional[int] = None,
    ) -> WorkflowExecution:
        """Execute a workflow by name with given context"""

        # Get workflow definition
        workflow = self.db.query(Workflow).filter(
            Workflow.name == workflow_name,
            Workflow.is_active == True
        ).first()

        if not workflow:
            raise ValueError(f"Workflow '{workflow_name}' not found")

        # Create execution record
        execution = WorkflowExecution(
            workflow_id=workflow.id,
            status=WorkflowStatus.PENDING,
            context=context,
            tenant_id=tenant_id,
        )
        self.db.add(execution)
        self.db.commit()
        self.db.refresh(execution)

        # Start execution
        try:
            execution.status = WorkflowStatus.RUNNING
            execution.started_at = datetime.utcnow()
            self.db.commit()

            # Execute steps
            result = await self._execute_steps(execution, workflow.definition)

            # Mark complete
            execution.status = WorkflowStatus.COMPLETED
            execution.result = result
            execution.completed_at = datetime.utcnow()
            self.db.commit()

        except Exception as e:
            execution.status = WorkflowStatus.FAILED
            execution.error_message = str(e)
            execution.completed_at = datetime.utcnow()
            self.db.commit()
            raise

        return execution

    async def _execute_steps(
        self, execution: WorkflowExecution, definition: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Execute workflow steps sequentially"""

        steps = definition.get("steps", [])
        context = execution.context.copy()
        results = {}

        for idx, step_def in enumerate(steps):
            step = WorkflowStep(
                execution_id=execution.id,
                step_name=step_def["name"],
                step_type=step_def["type"],
                sequence_number=idx,
                status=StepStatus.PENDING,
                input_data=context,
            )
            self.db.add(step)
            self.db.commit()

            try:
                # Execute step
                step.status = StepStatus.RUNNING
                step.started_at = datetime.utcnow()
                self.db.commit()

                step_result = await self._execute_step(step_def, context)

                step.status = StepStatus.COMPLETED
                step.output_data = step_result
                step.completed_at = datetime.utcnow()
                step.duration_seconds = int(
                    (step.completed_at - step.started_at).total_seconds()
                )
                self.db.commit()

                # Update context with step results
                results[step_def["name"]] = step_result
                context.update(step_result)

            except Exception as e:
                step.status = StepStatus.FAILED
                step.error_message = str(e)
                step.completed_at = datetime.utcnow()
                self.db.commit()

                # Check if step is critical
                if step_def.get("critical", True):
                    raise

        return results

    async def _execute_step(
        self, step_def: Dict[str, Any], context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Execute a single workflow step"""

        step_type = step_def["type"]

        if step_type == "service_call":
            return await self._execute_service_call(step_def, context)
        elif step_type == "condition":
            return await self._execute_condition(step_def, context)
        elif step_type == "transform":
            return await self._execute_transform(step_def, context)
        else:
            raise ValueError(f"Unknown step type: {step_type}")

    async def _execute_service_call(
        self, step_def: Dict[str, Any], context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Call another service"""

        service_name = step_def["service"]
        method_name = step_def["method"]
        params = step_def.get("params", {})

        # Resolve params from context
        resolved_params = self._resolve_params(params, context)

        # Get service instance (dependency injection)
        service = self._get_service(service_name)

        # Call method
        method = getattr(service, method_name)
        result = await method(**resolved_params)

        return {"result": result}

    def _resolve_params(
        self, params: Dict[str, Any], context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Resolve parameters from context using ${variable} syntax"""

        resolved = {}
        for key, value in params.items():
            if isinstance(value, str) and value.startswith("${") and value.endswith("}"):
                var_name = value[2:-1]
                resolved[key] = context.get(var_name)
            else:
                resolved[key] = value

        return resolved

    def _get_service(self, service_name: str):
        """Get service instance by name"""

        # Service registry would be injected
        # For now, return mock
        return None
```

### Day 5: Built-in Workflows

**File**: `src/dotmac/platform/workflows/builtin.py`

```python
# Pre-defined workflows

LEAD_TO_CUSTOMER_WORKFLOW = {
    "name": "lead_to_customer",
    "description": "Complete workflow from lead to deployed customer",
    "version": "1.0.0",
    "steps": [
        {
            "name": "qualify_lead",
            "type": "service_call",
            "service": "crm_service",
            "method": "qualify_lead",
            "params": {"lead_id": "${lead_id}"},
            "critical": True,
        },
        {
            "name": "generate_quote",
            "type": "service_call",
            "service": "crm_service",
            "method": "generate_quote",
            "params": {"lead_id": "${lead_id}"},
            "critical": True,
        },
        {
            "name": "wait_for_quote_acceptance",
            "type": "condition",
            "condition": "quote.status == 'accepted'",
            "timeout_seconds": 604800,  # 7 days
            "critical": True,
        },
        {
            "name": "process_payment",
            "type": "service_call",
            "service": "billing_service",
            "method": "process_payment",
            "params": {
                "quote_id": "${quote.id}",
                "amount": "${quote.total_amount}",
            },
            "critical": True,
        },
        {
            "name": "issue_license",
            "type": "service_call",
            "service": "licensing_service",
            "method": "issue_license",
            "params": {
                "customer_id": "${lead.customer_id}",
                "products": "${quote.items}",
            },
            "critical": True,
        },
        {
            "name": "create_order",
            "type": "service_call",
            "service": "sales_service",
            "method": "create_order_from_quote",
            "params": {"quote_id": "${quote.id}"},
            "critical": True,
        },
        {
            "name": "process_order",
            "type": "service_call",
            "service": "sales_service",
            "method": "process_order",
            "params": {"order_id": "${order.id}"},
            "critical": True,
        },
        {
            "name": "send_welcome",
            "type": "service_call",
            "service": "notification_service",
            "method": "send_welcome_email",
            "params": {
                "customer_email": "${lead.customer_email}",
                "tenant_subdomain": "${order.organization_slug}",
            },
            "critical": False,
        },
    ],
}

QUOTE_ACCEPTED_WORKFLOW = {
    "name": "quote_accepted",
    "description": "Process accepted quote to deployment",
    "version": "1.0.0",
    "steps": [
        {
            "name": "create_order",
            "type": "service_call",
            "service": "sales_service",
            "method": "create_order_from_quote",
            "params": {"quote_id": "${quote_id}"},
        },
        {
            "name": "submit_order",
            "type": "service_call",
            "service": "sales_service",
            "method": "submit_order",
            "params": {
                "order_id": "${order.id}",
                "auto_activate": True,
            },
        },
    ],
}

# Function to seed workflows
def seed_workflows(db: Session):
    """Seed built-in workflows"""
    from .models import Workflow

    workflows = [
        LEAD_TO_CUSTOMER_WORKFLOW,
        QUOTE_ACCEPTED_WORKFLOW,
    ]

    for workflow_def in workflows:
        existing = db.query(Workflow).filter(
            Workflow.name == workflow_def["name"]
        ).first()

        if not existing:
            workflow = Workflow(
                name=workflow_def["name"],
                description=workflow_def["description"],
                definition=workflow_def,
                version=workflow_def["version"],
                is_active=True,
            )
            db.add(workflow)

    db.commit()
```

---

## Week 2: Sprint 2 - Event Bus Integration

### Event Handler Registration

**File**: `src/dotmac/platform/crm/event_handlers.py` (create if not exists)

```python
from ..events.bus import event_bus
from ..workflows.engine import WorkflowEngine


@event_bus.subscribe("crm.quote.accepted")
async def on_quote_accepted(event):
    """Trigger order creation when quote is accepted"""

    engine = WorkflowEngine(db=event.db)

    await engine.execute_workflow(
        workflow_name="quote_accepted",
        context={
            "quote_id": event.data["quote_id"],
            "lead_id": event.data["lead_id"],
            "customer_email": event.data["customer_email"],
        },
        tenant_id=event.tenant_id,
    )


@event_bus.subscribe("billing.payment.received")
async def on_payment_received(event):
    """Issue license when payment received"""

    # Auto-create license
    # (Implementation here)

    pass
```

### CRM Module Enhancement

**File**: `src/dotmac/platform/crm/service.py` (add to existing)

```python
def accept_quote(self, quote_id: int, user_id: int) -> Quote:
    """Accept a quote and trigger downstream workflows"""

    quote = self.db.query(Quote).filter(Quote.id == quote_id).first()
    if not quote:
        raise ValueError("Quote not found")

    # Update quote status
    quote.status = "accepted"
    quote.accepted_at = datetime.utcnow()
    quote.accepted_by = user_id
    self.db.commit()

    # Publish event
    self.event_bus.publish("crm.quote.accepted", {
        "quote_id": quote.id,
        "lead_id": quote.lead_id,
        "customer_email": quote.customer_email,
        "total_amount": float(quote.total_amount),
        "products": [item.to_dict() for item in quote.items],
    })

    return quote
```

---

## Week 3: Sprint 3 - Sales Module Integration

### Create Order from Quote

**File**: `src/dotmac/platform/sales/service.py` (add method)

```python
def create_order_from_quote(self, quote_id: int) -> Order:
    """Create order from accepted CRM quote"""

    # Get quote
    quote = self.db.query(Quote).filter(Quote.id == quote_id).first()
    if not quote:
        raise ValueError("Quote not found")

    # Map quote to order
    order_data = OrderCreate(
        customer_email=quote.customer_email,
        customer_name=quote.customer_name,
        company_name=quote.company_name,
        organization_slug=quote.organization_slug,
        deployment_region=quote.deployment_region,
        selected_services=[
            ServiceSelection(
                service_code=item.product_code,
                name=item.product_name,
                quantity=item.quantity,
            )
            for item in quote.items
        ],
        currency=quote.currency,
        billing_cycle=quote.billing_cycle,
        source="crm_quote",
        external_order_id=f"QUOTE-{quote.quote_number}",
    )

    # Create order
    order = self.create_order(order_data)

    # Link quote to order
    quote.order_id = order.id
    self.db.commit()

    return order
```

---

## Week 4: Sprint 4 - Integration Testing

### End-to-End Test

**File**: `tests/integration/test_lead_to_customer_workflow.py`

```python
import pytest
from dotmac.platform.workflows.engine import WorkflowEngine


@pytest.mark.integration
async def test_lead_to_customer_workflow(
    db,
    crm_service,
    sales_service,
    deployment_service,
):
    """Test complete lead-to-customer workflow"""

    # 1. Create lead
    lead = crm_service.create_lead(...)

    # 2. Qualify lead
    crm_service.qualify_lead(lead.id)

    # 3. Generate quote
    quote = crm_service.generate_quote(lead.id)

    # 4. Accept quote (triggers workflow)
    crm_service.accept_quote(quote.id, user_id=1)

    # 5. Wait for workflow completion
    # (Use polling or event waiting)
    await wait_for_workflow_completion(quote.id, timeout=300)

    # 6. Verify results
    # - Order created
    order = db.query(Order).filter(Order.external_order_id == f"QUOTE-{quote.quote_number}").first()
    assert order is not None
    assert order.status == OrderStatus.ACTIVE

    # - Tenant created
    assert order.tenant_id is not None

    # - Deployment provisioned
    assert order.deployment_instance_id is not None

    # - Services activated
    activations = db.query(ServiceActivation).filter(
        ServiceActivation.order_id == order.id
    ).all()
    assert len(activations) > 0
    assert all(a.activation_status == ActivationStatus.COMPLETED for a in activations)
```

---

## Configuration

### Environment Variables

Add to `.env`:

```bash
# Workflows
WORKFLOW_ENGINE_ENABLED=true
WORKFLOW_EXECUTION_TIMEOUT=3600  # 1 hour
WORKFLOW_RETRY_ENABLED=true
WORKFLOW_RETRY_MAX_ATTEMPTS=3

# Event Bus
EVENT_BUS_TYPE=redis  # or "kafka" for production
EVENT_BUS_URL=redis://localhost:6379/0

# Integrations
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
```

### Register Routes

**File**: `src/dotmac/platform/routers.py` (add)

```python
RouterConfig(
    module_path="dotmac.platform.workflows.router",
    router_name="router",
    prefix="/api/v1/workflows",
    tags=["Workflows"],
    description="Workflow engine and execution tracking",
    requires_auth=True,
),
```

---

## Testing Checklist

### Unit Tests
- [ ] Workflow engine can parse workflow definitions
- [ ] Workflow engine creates execution records
- [ ] Step execution updates status correctly
- [ ] Error handling works (failed steps)
- [ ] Context variables resolve correctly

### Integration Tests
- [ ] Quote acceptance triggers workflow
- [ ] Order created from quote
- [ ] Deployment provisioned from order
- [ ] Services activated
- [ ] Notifications sent

### Manual Testing
- [ ] Create lead in CRM UI
- [ ] Generate quote
- [ ] Accept quote
- [ ] Monitor workflow execution in logs
- [ ] Verify order created
- [ ] Check deployment status
- [ ] Confirm welcome email sent

---

## Monitoring & Debugging

### Check Workflow Execution

```bash
# View workflow executions
psql -d dotmac -c "SELECT * FROM workflow_executions ORDER BY created_at DESC LIMIT 10;"

# View workflow steps
psql -d dotmac -c "SELECT * FROM workflow_steps WHERE execution_id = 1;"

# Check failed workflows
psql -d dotmac -c "SELECT * FROM workflow_executions WHERE status = 'failed';"
```

### API Endpoints for Debugging

```bash
# List workflows
curl http://localhost:8000/api/v1/workflows

# Get execution status
curl http://localhost:8000/api/v1/workflows/executions/1

# Manual trigger (for testing)
curl -X POST http://localhost:8000/api/v1/workflows/execute \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "workflow_name": "quote_accepted",
    "context": {"quote_id": 1}
  }'
```

---

## Common Issues & Solutions

### Issue: Workflow doesn't trigger
**Solution**: Check event bus connection, verify event handler registered

### Issue: Step fails with "Service not found"
**Solution**: Ensure service is properly injected in `_get_service()` method

### Issue: Context variables not resolving
**Solution**: Check parameter syntax (`${variable_name}`) and ensure variable exists in context

### Issue: Workflow times out
**Solution**: Increase `WORKFLOW_EXECUTION_TIMEOUT` or optimize slow steps

---

## Next Steps After Phase 1

Once Phase 1 is complete and tested:

1. **Phase 2**: Start shopping cart implementation
2. **Frontend**: Build workflow execution viewer UI
3. **Analytics**: Add workflow execution metrics to dashboard
4. **Documentation**: Document workflow DSL and custom workflow creation

---

**Document Version**: 1.0
**Last Updated**: 2025-10-16
**Target Audience**: Development Team
**Prerequisites**: Completed deployment orchestration and sales automation modules
