# Workflow System - Quick Start Guide

## Overview

The workflow system automates multi-step business processes across the platform. All 5 built-in workflows are operational and can execute end-to-end.

## Quick Test

### 1. Start the Application

```bash
# Make sure database and Redis are running
docker ps

# Start the FastAPI application
poetry run uvicorn src.dotmac.platform.api.gateway:app --reload
```

### 2. Test a Workflow via API

**Create and Execute Lead-to-Customer Workflow:**

```bash
# Get auth token
TOKEN=$(curl -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@example.com", "password": "password"}' | jq -r '.access_token')

# Execute lead-to-customer workflow
curl -X POST http://localhost:8000/workflows/execute/lead_to_customer_onboarding \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "lead_id": "550e8400-e29b-41d4-a716-446655440000",
    "tenant_id": "tenant-1"
  }'
```

**Response:**
```json
{
  "execution_id": 1,
  "workflow_id": 1,
  "status": "completed",
  "trigger_type": "api",
  "context": {...},
  "result": {...}
}
```

### 3. Check Workflow Execution Status

```bash
# Get execution details
curl -X GET http://localhost:8000/workflows/executions/1 \
  -H "Authorization: Bearer $TOKEN"
```

### 4. View All Available Workflows

```bash
# List all workflows
curl -X GET http://localhost:8000/workflows \
  -H "Authorization: Bearer $TOKEN"
```

---

## Available Workflows

### 1. Lead to Customer Onboarding
**Workflow Name:** `lead_to_customer_onboarding`
**Trigger:** API, Event (`lead.qualified`)

**What It Does:**
1. Creates customer from lead
2. Creates subscription
3. Issues license
4. Provisions tenant
5. Sends welcome email
6. Creates onboarding ticket

**Usage:**
```bash
curl -X POST http://localhost:8000/workflows/execute/lead_to_customer_onboarding \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "lead_id": "uuid-here",
    "tenant_id": "tenant-1",
    "plan_id": "basic-plan",
    "license_template_id": "standard-license"
  }'
```

### 2. Quote Accepted to Order
**Workflow Name:** `quote_accepted_to_order`
**Trigger:** Event (`quote.accepted`)

**What It Does:**
1. Accepts quote
2. Creates order
3. Processes payment
4. Schedules deployment
5. Sends order confirmation
6. Notifies sales team

**Automatic Trigger:**
- Fires automatically when a quote is accepted

### 3. Partner Customer Provisioning
**Workflow Name:** `partner_customer_provisioning`
**Trigger:** API

**What It Does:**
1. Creates partner customer
2. Checks license quota
3. Allocates licenses from partner pool
4. Provisions white-labeled tenant
5. Records commission
6. Sends provisioning notification

**Usage:**
```bash
curl -X POST http://localhost:8000/workflows/execute/partner_customer_provisioning \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "partner_id": "partner-123",
    "customer_data": {
      "name": "Customer Name",
      "email": "customer@example.com"
    },
    "license_count": 5,
    "white_label_config": {"branding": "partner"}
  }'
```

### 4. Customer Renewal Process
**Workflow Name:** `customer_renewal_process`
**Trigger:** Event (`subscription.expiring_soon`)

**What It Does:**
1. Checks renewal eligibility
2. Creates renewal quote
3. Processes renewal payment
4. Extends subscription
5. Sends renewal confirmation

**Automatic Trigger:**
- Fires 30 days before subscription expiration

### 5. ISP Ticket to Deployment
**Workflow Name:** `isp_ticket_to_deployment`
**Trigger:** Event (`ticket.installation_approved`)

**What It Does:**
1. Retrieves site survey data
2. Schedules installation
3. Allocates network resources (IP, VLAN)
4. Creates RADIUS subscriber account
5. Provisions CPE device
6. Activates service
7. Sends activation notification

**Automatic Trigger:**
- Fires when installation ticket is approved

---

## Workflow Execution Modes

### 1. Manual API Execution
```bash
POST /workflows/execute/{workflow_name}
```

### 2. Event-Driven Execution
Workflows automatically trigger on domain events:
- `lead.qualified` → Lead to Customer
- `quote.accepted` → Quote to Order
- `subscription.expiring_soon` → Renewal
- `ticket.installation_approved` → ISP Deployment

### 3. Scheduled Execution
Coming soon - workflows can be scheduled via cron expressions.

---

## Checking Logs

### Application Logs
```bash
# Watch for workflow execution logs
tail -f logs/app.log | grep -E "WORKFLOW|STUB"
```

### Stub Service Calls
All stub calls are logged with `[STUB]` prefix:
```
INFO [STUB] Creating subscription for customer 123, plan 456
INFO [STUB] Processing payment for order order-789, amount 499.00
INFO [STUB] Sending template email 'customer_welcome' to customer@example.com
```

---

## Workflow Status Monitoring

### Get All Executions
```bash
curl -X GET http://localhost:8000/workflows/executions \
  -H "Authorization: Bearer $TOKEN"
```

### Get Workflow Statistics
```bash
curl -X GET http://localhost:8000/workflows/1/stats \
  -H "Authorization: Bearer $TOKEN"
```

**Response:**
```json
{
  "workflow_id": 1,
  "total_executions": 42,
  "successful_executions": 40,
  "failed_executions": 2,
  "average_duration_seconds": 3.5,
  "success_rate": 0.952
}
```

---

## Creating Custom Workflows

### Via API
```bash
curl -X POST http://localhost:8000/workflows \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "my_custom_workflow",
    "description": "Custom workflow",
    "definition": {
      "steps": [
        {
          "name": "step1",
          "type": "service_call",
          "service": "customer_service",
          "method": "create_from_lead",
          "params": {
            "lead_id": "${context.lead_id}",
            "tenant_id": "${context.tenant_id}"
          }
        }
      ]
    },
    "version": "1.0.0"
  }'
```

### Via Admin UI
1. Navigate to `/dashboard/workflows`
2. Click "Create Workflow"
3. Use visual workflow builder
4. Save and activate

---

## Troubleshooting

### Workflow Fails with "Service not found"
**Solution:** Check service registry registration in `src/dotmac/platform/workflows/service_registry.py`

### Workflow Hangs on a Step
**Solution:** Check logs for errors. Stubs should never hang - if they do, there's an exception.

### Workflow Execution Not Found
**Solution:** Make sure workflow is seeded:
```bash
# Re-seed workflows
poetry run python -c "
from src.dotmac.platform.workflows.startup import seed_builtin_workflows
from src.dotmac.platform.db import get_session
import asyncio

async def seed():
    async for db in get_session():
        await seed_builtin_workflows(db)

asyncio.run(seed())
"
```

### Stub Data in Production
**Solution:** Replace stubs incrementally - see `WORKFLOW_SERVICE_ADAPTERS_COMPLETE.md`

---

## Performance

### Expected Performance
- Workflow execution: **< 5 seconds** (with stubs)
- Step execution: **< 500ms per step** (with stubs)
- Database queries: **< 100ms**

### Monitoring
```bash
# Check workflow execution times
curl -X GET http://localhost:8000/workflows/executions?include_duration=true \
  -H "Authorization: Bearer $TOKEN" | jq '.[] | {id, duration_seconds, status}'
```

---

## Security

### RBAC Permissions Required
- **Execute workflow**: `workflow:execute`
- **View executions**: `workflow:view`
- **Create workflow**: `workflow:create`
- **Delete workflow**: `workflow:delete`

### Tenant Isolation
All workflows are automatically tenant-isolated. Users can only execute workflows and view executions for their own tenant.

---

## Next Steps

1. **Test all workflows** - Execute each workflow via API
2. **Monitor logs** - Watch for `[STUB]` calls to understand workflow execution
3. **Implement real services** - Replace stubs based on priority (see `WORKFLOW_SERVICE_ADAPTERS_COMPLETE.md`)
4. **Create custom workflows** - Build workflows for your specific business processes
5. **Set up event triggers** - Configure domain events to automatically trigger workflows

---

## API Reference

Full API documentation available at:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

**Workflow Endpoints:**
- `GET /workflows` - List all workflows
- `POST /workflows` - Create workflow
- `GET /workflows/{id}` - Get workflow details
- `PUT /workflows/{id}` - Update workflow
- `DELETE /workflows/{id}` - Delete workflow
- `POST /workflows/execute/{name}` - Execute workflow
- `GET /workflows/executions` - List executions
- `GET /workflows/executions/{id}` - Get execution details
- `GET /workflows/{id}/stats` - Get workflow statistics

---

## Support

For issues or questions:
1. Check logs for `[STUB]` or error messages
2. Review `WORKFLOW_SERVICE_ADAPTERS_COMPLETE.md`
3. See API documentation at `/docs`
4. Review Phase 1 summary in `WORKFLOW_PHASE1_COMPLETE.md`
