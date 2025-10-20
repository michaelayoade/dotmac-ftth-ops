## Orchestration Service Documentation

## Overview

The Orchestration Service provides atomic multi-system operations with automatic rollback capabilities using the Saga pattern. It eliminates data inconsistency issues by coordinating transactions across RADIUS, VOLTHA, NetBox, GenieACS, Billing, and other systems.

### The Problem

**Before Orchestration (Manual Multi-System Provisioning):**

```python
# ❌ Current: NO ORCHESTRATION
# 1. Create subscriber in database
subscriber = create_subscriber(...)

# 2. Create RADIUS auth (separate API call)
radius_user = create_radius_account(...)

# 3. Allocate IP from NetBox (separate API call)
ip_address = allocate_ip(...)

# 4. Activate ONU in VOLTHA (separate API call)
onu = activate_onu(...)

# 5. Configure CPE in GenieACS (separate API call)
cpe = configure_cpe(...)  # ← FAILS HERE!

# 6. Create service in billing (never reached)
service = create_billing_service(...)

# 🔥 PROBLEM: If step 5 fails, steps 1-4 are already committed
# NO AUTOMATIC ROLLBACK!
```

**After Orchestration (Atomic Operation with Rollback):**

```python
# ✅ Orchestrated: Single atomic operation
POST /api/v1/orchestration/provision-subscriber
{
  "customer_id": "...",
  "service_plan_id": "...",
  "onu_serial": "...",
  "cpe_mac": "..."
}

# ✅ Automatic rollback if any step fails
# ✅ Data consistency guaranteed
# ✅ Single API call
# ✅ Built-in retry logic
```

## Key Features

### 1. Atomic Operations
- Single API call for complex multi-system provisioning
- All-or-nothing execution guarantee
- Automatic transaction management

### 2. Automatic Rollback (Saga Pattern)
- Compensation logic for each step
- Reverse execution on failure
- Clean state restoration

### 3. Workflow State Persistence
- All steps tracked in database
- Resume capability after crashes
- Complete audit trail

### 4. Retry Mechanisms
- Configurable retry per step
- Exponential backoff support
- Manual retry for failed workflows

### 5. Monitoring & Logging
- Detailed step-by-step logs
- Workflow statistics
- Error tracking and reporting

## Architecture

### Components

```
┌─────────────────────────────────────────────────────────────────┐
│                       API Router Layer                          │
│  POST /api/v1/orchestration/provision-subscriber               │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Orchestration Service                         │
│  - Workflow creation                                            │
│  - Workflow management                                          │
│  - Statistics & monitoring                                      │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Saga Orchestrator                            │
│  - Sequential step execution                                    │
│  - Compensation (rollback) logic                                │
│  - Error handling & retry                                       │
└───────────────────────────┬─────────────────────────────────────┘
                            │
             ┌──────────────┼──────────────┐
             ▼              ▼              ▼
       ┌─────────┐    ┌─────────┐   ┌─────────┐
       │Database │    │  APIs   │   │External │
       │  Steps  │    │ (REST)  │   │Services │
       └─────────┘    └─────────┘   └─────────┘
```

### Saga Pattern Implementation

The Saga pattern coordinates distributed transactions by:

1. **Forward Recovery (Happy Path):**
   - Execute steps sequentially
   - Store compensation data after each step
   - Continue to next step on success

2. **Backward Recovery (Failure):**
   - Stop on first failure
   - Execute compensation handlers in reverse order
   - Restore system to consistent state

3. **Idempotency:**
   - Each step can be safely retried
   - Compensation can be safely retried
   - No duplicate side effects

## Database Schema

### Workflow Model

```python
class Workflow(BaseModel):
    workflow_id: str          # Unique workflow identifier
    workflow_type: WorkflowType  # provision_subscriber, etc.
    status: WorkflowStatus    # pending, running, completed, failed, etc.

    tenant_id: str            # Multi-tenancy isolation
    initiator_id: str         # User who started the workflow

    input_data: JSON          # Original request data
    output_data: JSON         # Final workflow output
    context: JSON             # Shared data between steps

    started_at: datetime
    completed_at: datetime
    failed_at: datetime

    error_message: str
    retry_count: int
    max_retries: int = 3

    steps: List[WorkflowStep]  # Relationship to steps
```

### WorkflowStep Model

```python
class WorkflowStep(BaseModel):
    step_id: str
    step_order: int           # Execution order
    step_name: str            # Human-readable name
    target_system: str        # radius, voltha, netbox, etc.

    status: WorkflowStepStatus

    input_data: JSON
    output_data: JSON
    compensation_data: JSON   # Data for rollback

    started_at: datetime
    completed_at: datetime
    failed_at: datetime

    error_message: str
    retry_count: int
```

## Subscriber Provisioning Workflow

### Workflow Steps

```
1. Create Customer Record
   ├─ Handler: create_customer_handler
   ├─ Compensation: delete_customer_handler
   └─ System: Database

2. Create Subscriber Record
   ├─ Handler: create_subscriber_handler
   ├─ Compensation: delete_subscriber_handler
   └─ System: Database

3. Create RADIUS Account
   ├─ Handler: create_radius_account_handler
   ├─ Compensation: delete_radius_account_handler
   └─ System: RADIUS API

4. Allocate IP Address
   ├─ Handler: allocate_ip_handler
   ├─ Compensation: release_ip_handler
   ├─ System: NetBox API
   └─ Optional: Can skip if not needed

5. Activate ONU
   ├─ Handler: activate_onu_handler
   ├─ Compensation: deactivate_onu_handler
   ├─ System: VOLTHA API
   └─ Retry: Up to 5 attempts

6. Configure CPE
   ├─ Handler: configure_cpe_handler
   ├─ Compensation: unconfigure_cpe_handler
   ├─ System: GenieACS API
   └─ Optional: Can skip if not needed

7. Create Billing Service
   ├─ Handler: create_billing_service_handler
   ├─ Compensation: delete_billing_service_handler
   └─ System: Database
```

### Execution Flow

**Success Scenario:**
```
Step 1: Create Customer → SUCCESS ✓
  └─ Store: customer_id = "cust_123"

Step 2: Create Subscriber → SUCCESS ✓
  └─ Store: subscriber_id = "sub_456"

Step 3: Create RADIUS → SUCCESS ✓
  └─ Store: radius_username = "user@example.com"

Step 4: Allocate IP → SUCCESS ✓
  └─ Store: ipv4_address = "10.0.1.50"

Step 5: Activate ONU → SUCCESS ✓
  └─ Store: onu_id = "onu_789"

Step 6: Configure CPE → SUCCESS ✓
  └─ Store: cpe_id = "cpe_101"

Step 7: Create Billing Service → SUCCESS ✓
  └─ Store: service_id = "svc_202"

Result: Workflow COMPLETED ✓
```

**Failure Scenario with Rollback:**
```
Step 1: Create Customer → SUCCESS ✓
  └─ Store compensation_data for rollback

Step 2: Create Subscriber → SUCCESS ✓
  └─ Store compensation_data for rollback

Step 3: Create RADIUS → SUCCESS ✓
  └─ Store compensation_data for rollback

Step 4: Allocate IP → SUCCESS ✓
  └─ Store compensation_data for rollback

Step 5: Activate ONU → FAILED ✗
  └─ Error: "ONU serial not found"

───── AUTOMATIC ROLLBACK STARTS ─────

Compensate Step 4: Release IP → SUCCESS ✓
Compensate Step 3: Delete RADIUS → SUCCESS ✓
Compensate Step 2: Delete Subscriber → SUCCESS ✓
Compensate Step 1: Delete Customer → SUCCESS ✓

Result: Workflow ROLLED_BACK ✓
  System restored to pre-workflow state
```

## API Usage

### 1. Provision Subscriber

**Endpoint:**
```
POST /api/v1/orchestration/provision-subscriber
```

**Request:**
```json
{
  "first_name": "John",
  "last_name": "Doe",
  "email": "john.doe@example.com",
  "phone": "+1-555-123-4567",
  "service_address": "123 Main St",
  "service_city": "New York",
  "service_state": "NY",
  "service_postal_code": "10001",
  "service_plan_id": "plan_premium_1000",
  "bandwidth_mbps": 1000,
  "connection_type": "ftth",
  "onu_serial": "ALCL12345678",
  "cpe_mac": "00:11:22:33:44:55",
  "auto_activate": true,
  "create_radius_account": true,
  "allocate_ip_from_netbox": true,
  "configure_voltha": true,
  "configure_genieacs": true
}
```

**Response (Success):**
```json
{
  "workflow_id": "wf_a1b2c3d4e5f6",
  "subscriber_id": "sub_789",
  "customer_id": "cust_456",
  "status": "completed",
  "radius_username": "john.doe@example.com",
  "ipv4_address": "10.0.1.50",
  "vlan_id": 100,
  "onu_id": "onu_101",
  "cpe_id": "cpe_202",
  "service_id": "svc_303",
  "steps_completed": 7,
  "total_steps": 7,
  "error_message": null,
  "created_at": "2025-10-15T12:00:00Z",
  "completed_at": "2025-10-15T12:00:45Z"
}
```

**Response (Failure with Rollback):**
```json
{
  "workflow_id": "wf_x1y2z3a4b5c6",
  "subscriber_id": "",
  "customer_id": "cust_789",
  "status": "rolled_back",
  "radius_username": null,
  "ipv4_address": null,
  "vlan_id": null,
  "onu_id": null,
  "cpe_id": null,
  "service_id": null,
  "steps_completed": 4,
  "total_steps": 7,
  "error_message": "Step 5 (activate_onu) failed: ONU serial not found",
  "created_at": "2025-10-15T12:00:00Z",
  "completed_at": null
}
```

### 2. Get Workflow Status

**Endpoint:**
```
GET /api/v1/orchestration/workflows/{workflow_id}
```

**Response:**
```json
{
  "workflow_id": "wf_a1b2c3d4e5f6",
  "workflow_type": "provision_subscriber",
  "status": "running",
  "started_at": "2025-10-15T12:00:00Z",
  "completed_at": null,
  "failed_at": null,
  "error_message": null,
  "retry_count": 0,
  "steps": [
    {
      "step_id": "wf_a1b2c3d4e5f6_step_0",
      "step_name": "create_customer",
      "step_order": 0,
      "target_system": "database",
      "status": "completed",
      "started_at": "2025-10-15T12:00:01Z",
      "completed_at": "2025-10-15T12:00:02Z",
      "failed_at": null,
      "error_message": null,
      "retry_count": 0,
      "output_data": {
        "customer_id": "cust_456"
      }
    },
    {
      "step_id": "wf_a1b2c3d4e5f6_step_1",
      "step_name": "create_subscriber",
      "step_order": 1,
      "target_system": "database",
      "status": "running",
      "started_at": "2025-10-15T12:00:03Z",
      "completed_at": null,
      "failed_at": null,
      "error_message": null,
      "retry_count": 0,
      "output_data": null
    }
  ]
}
```

### 3. List Workflows

**Endpoint:**
```
GET /api/v1/orchestration/workflows?status=failed&limit=10
```

**Response:**
```json
{
  "workflows": [
    {
      "workflow_id": "wf_abc123",
      "workflow_type": "provision_subscriber",
      "status": "failed",
      "started_at": "2025-10-15T11:00:00Z",
      "completed_at": null,
      "failed_at": "2025-10-15T11:00:30Z",
      "error_message": "Network timeout",
      "retry_count": 3,
      "steps": []
    }
  ],
  "total": 5,
  "limit": 10,
  "offset": 0
}
```

### 4. Retry Failed Workflow

**Endpoint:**
```
POST /api/v1/orchestration/workflows/{workflow_id}/retry
```

**Response:**
```json
{
  "workflow_id": "wf_abc123",
  "workflow_type": "provision_subscriber",
  "status": "running",
  "retry_count": 1,
  "steps": []
}
```

### 5. Get Statistics

**Endpoint:**
```
GET /api/v1/orchestration/statistics
```

**Response:**
```json
{
  "total_workflows": 1523,
  "pending_workflows": 12,
  "running_workflows": 5,
  "completed_workflows": 1420,
  "failed_workflows": 45,
  "rolled_back_workflows": 41,
  "success_rate": 93.2,
  "average_duration_seconds": 42.5,
  "total_compensations": 41,
  "by_type": {
    "provision_subscriber": 1523
  },
  "by_status": {
    "completed": 1420,
    "failed": 45,
    "rolled_back": 41,
    "running": 5,
    "pending": 12
  }
}
```

## Error Handling

### Retry Strategy

Each step has configurable retry logic:

```python
StepDefinition(
    step_name="activate_onu",
    max_retries=5,           # Retry up to 5 times
    timeout_seconds=60,      # 60 second timeout per attempt
    required=True,           # Must succeed for workflow to continue
)
```

**Retry Behavior:**
1. First attempt fails → Wait → Retry
2. Second attempt fails → Wait → Retry
3. Continue until max_retries reached
4. If all retries fail → Trigger compensation

### Compensation Failures

If compensation (rollback) fails:

1. **Mark step as `compensation_failed`**
2. **Continue compensating other steps**
3. **Log detailed error information**
4. **Alert operations team**
5. **Manual intervention may be required**

### Idempotency

All handlers must be idempotent:

```python
async def create_radius_account_handler(...):
    # Check if already exists
    existing = await radius_service.get_user(username)
    if existing:
        logger.info("RADIUS account already exists, skipping")
        return existing

    # Create only if not exists
    return await radius_service.create_user(...)
```

## Monitoring & Observability

### Logging

All workflow operations are logged:

```
INFO: Starting workflow execution: wf_abc123 (type=provision_subscriber, steps=7)
INFO: Executing step create_customer (order=0, system=database)
INFO: Step create_customer completed successfully
INFO: Executing step create_subscriber (order=1, system=database)
INFO: Step create_subscriber completed successfully
INFO: Executing step create_radius_account (order=2, system=radius)
INFO: Created RADIUS account: john.doe@example.com
INFO: Step create_radius_account completed successfully
INFO: Workflow wf_abc123 completed successfully
```

### Metrics

Track key metrics:
- Workflow success rate
- Average execution time
- Failure rate by step
- Compensation success rate
- System availability

### Alerts

Configure alerts for:
- Workflow failures exceeding threshold
- Compensation failures
- Long-running workflows
- High retry counts

## Best Practices

### 1. Step Design

**DO:**
- Keep steps small and focused
- Make handlers idempotent
- Store minimal compensation data
- Use descriptive step names
- Set appropriate timeouts

**DON'T:**
- Combine multiple operations in one step
- Store sensitive data in compensation_data
- Make steps dependent on external timing
- Skip error handling

### 2. Compensation Handlers

**DO:**
- Test compensation thoroughly
- Handle partial state gracefully
- Log compensation actions
- Make compensation idempotent
- Clean up all created resources

**DON'T:**
- Assume step succeeded fully
- Fail silently
- Leave orphaned resources
- Require manual intervention

### 3. Error Handling

**DO:**
- Use specific exception types
- Log detailed error context
- Provide actionable error messages
- Track error patterns

**DON'T:**
- Catch generic exceptions
- Hide error details
- Retry indefinitely
- Ignore compensation failures

### 4. Testing

**DO:**
- Test happy path
- Test each failure scenario
- Test compensation logic
- Test retry behavior
- Test concurrent workflows

**DON'T:**
- Test only successful flows
- Skip integration testing
- Assume mocks match reality
- Ignore edge cases

## Performance Considerations

### Execution Time

Typical workflow execution:
```
Step 1 (Database): ~100ms
Step 2 (Database): ~100ms
Step 3 (RADIUS API): ~500ms
Step 4 (NetBox API): ~300ms
Step 5 (VOLTHA API): ~2000ms  ← Slowest
Step 6 (GenieACS API): ~1000ms
Step 7 (Database): ~100ms

Total: ~4.1 seconds
```

### Optimization Strategies

1. **Parallel Execution (Future Enhancement):**
   ```python
   # Execute independent steps in parallel
   await asyncio.gather(
       step3_handler(),  # RADIUS
       step4_handler(),  # NetBox
   )
   ```

2. **Caching:**
   - Cache service plan configurations
   - Cache IP pool information
   - Cache device templates

3. **Connection Pooling:**
   - Reuse database connections
   - Pool API client connections
   - Implement circuit breakers

4. **Batch Operations:**
   - Batch multiple subscribers if needed
   - Bulk IP allocations
   - Batch RADIUS updates

## Troubleshooting

### Common Issues

**1. Workflow Stuck in RUNNING:**

```sql
-- Find stuck workflows
SELECT workflow_id, started_at, EXTRACT(EPOCH FROM (NOW() - started_at)) as duration_seconds
FROM orchestration_workflows
WHERE status = 'running'
  AND started_at < NOW() - INTERVAL '10 minutes';

-- Manual intervention may be needed
UPDATE orchestration_workflows
SET status = 'failed', failed_at = NOW()
WHERE workflow_id = 'wf_abc123';
```

**2. Compensation Failed:**

```sql
-- Find workflows with compensation failures
SELECT workflow_id, error_message, compensation_error
FROM orchestration_workflows
WHERE compensation_error IS NOT NULL;

-- Review step compensation status
SELECT step_name, status, error_message
FROM orchestration_workflow_steps
WHERE workflow_id = 'wf_abc123'
  AND status = 'compensation_failed';
```

**3. High Failure Rate:**

```sql
-- Analyze failure patterns
SELECT
    target_system,
    step_name,
    COUNT(*) as failure_count,
    AVG(retry_count) as avg_retries
FROM orchestration_workflow_steps
WHERE status = 'failed'
  AND created_at > NOW() - INTERVAL '24 hours'
GROUP BY target_system, step_name
ORDER BY failure_count DESC;
```

## Future Enhancements

### Phase 2
- [ ] Parallel step execution
- [ ] Conditional workflows (if/else logic)
- [ ] Sub-workflows (nested workflows)
- [ ] Scheduled workflows
- [ ] Webhook notifications

### Phase 3
- [ ] Visual workflow builder UI
- [ ] Advanced retry strategies (exponential backoff)
- [ ] Circuit breaker integration
- [ ] Distributed tracing
- [ ] Real-time workflow monitoring dashboard

### Phase 4
- [ ] AI-powered failure prediction
- [ ] Automated compensation strategy selection
- [ ] Multi-region orchestration
- [ ] Event-driven workflows
- [ ] Workflow versioning

## References

- [Saga Pattern](https://microservices.io/patterns/data/saga.html)
- [Distributed Transactions](https://martin.kleppmann.com/2015/05/11/please-stop-calling-databases-cp-or-ap.html)
- [Orchestration vs Choreography](https://medium.com/capital-one-tech/microservices-orchestration-vs-choreography-c9f14e1c9d5)

---

**Last Updated:** 2025-10-15
**Version:** 1.0.0
**Maintainer:** Backend Team
