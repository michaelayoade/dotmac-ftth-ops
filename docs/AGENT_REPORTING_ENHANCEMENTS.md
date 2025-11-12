# Agent & Reporting System Enhancements

**Created:** November 8, 2025
**Status:** Implementation Complete
**Priority:** P2 - Medium

---

## Overview

This document outlines 6 major enhancements to the ticketing agent management and reporting systems, providing comprehensive support agent performance tracking, availability management, intelligent assignment, skills-based routing, and automated reporting capabilities.

---

## Enhancement 1: Agent Performance Dashboard ✅

### Implementation

**Backend API:**
- **Endpoint:** `GET /api/v1/tickets/agents/performance`
- **Query Parameters:** `start_date`, `end_date` (ISO format, optional)
- **Location:** `src/dotmac/platform/ticketing/router.py:171-196`
- **Service Method:** `TicketService.get_agent_performance()` in `service.py:620-712`

**Frontend UI:**
- **Page:** `/app/dashboard/operations/tickets/agents/page.tsx`
- **Features:**
  - Time range selector (Today, 7d, 30d, 90d, All time)
  - Summary cards: Active Agents, Total Assigned, Total Resolved, Avg SLA Compliance
  - Performance table with per-agent metrics
  - Auto-refresh every 30 seconds

**Metrics Tracked:**
```typescript
interface AgentPerformanceMetrics {
  agent_id: UUID;
  agent_name: string | null;
  agent_email: string | null;
  total_assigned: number;
  total_resolved: number;
  total_open: number;
  total_in_progress: number;
  avg_resolution_time_minutes: float | null;
  avg_first_response_time_minutes: float | null;
  sla_compliance_rate: float | null;  // Percentage 0-100
  escalation_rate: float | null;       // Percentage 0-100
}
```

**Database Queries:**
- Aggregates ticket data grouped by `assigned_to_user_id`
- Calculates resolution times using `resolution_time_minutes` field
- Computes SLA compliance from `sla_breached` boolean
- Joins with `User` table for agent name and email

**Usage Example:**
```bash
# Get agent performance for last 30 days
GET /api/v1/tickets/agents/performance?start_date=2025-10-08T00:00:00Z&end_date=2025-11-08T23:59:59Z

# Frontend access
Navigate to: /dashboard/operations/tickets/agents
```

---

## Enhancement 2: Agent Availability System ✅

### Implementation

**Database Model:**
- **Table:** `agent_availability`
- **Location:** `src/dotmac/platform/ticketing/availability_models.py`
- **Migration:** `alembic/versions/2025_11_08_1600-add_agent_availability_table.py`

**Schema:**
```python
class AgentAvailability(Base):
    id: UUID (primary key)
    user_id: UUID (unique, indexed)
    tenant_id: str | None (indexed)
    status: AgentStatus  # Enum: available, busy, offline, away
    status_message: str | None
    last_activity_at: datetime
    created_at: datetime
    updated_at: datetime
```

**Backend API:**
- **Router:** `src/dotmac/platform/ticketing/availability_router.py`
- **Registered:** `src/dotmac/platform/routers.py:556-563`

**Endpoints:**
```python
GET  /api/v1/tickets/agents/availability       # List all agents availability
GET  /api/v1/tickets/agents/availability/me    # Get current user's status
PATCH /api/v1/tickets/agents/availability/me   # Update current user's status
GET  /api/v1/tickets/agents/availability/{user_id}  # Get specific agent status
```

**Frontend Widget:**
- **Component:** `frontend/apps/isp-ops-app/components/tickets/AgentStatusWidget.tsx`
- **Features:**
  - Real-time status selector (Available, Busy, Away, Offline)
  - Optional status message input
  - Color-coded status indicators
  - Auto-refresh every 30 seconds
  - Visual status icons

**Status Colors:**
- `available` → Green (CheckCircle2 icon)
- `busy` → Red (XCircle icon)
- `away` → Yellow (Coffee icon)
- `offline` → Gray (Clock icon)

**Usage Example:**
```typescript
import { AgentStatusWidget, AgentStatusBadge } from '@/components/tickets/AgentStatusWidget';

// Use in dashboard
<AgentStatusWidget />

// Display badge
<AgentStatusBadge status="available" />
```

---

## Enhancement 3: Round-robin Assignment Logic ✅

### Implementation

**Assignment Service:**
- **Location:** `src/dotmac/platform/ticketing/assignment_service.py`
- **Class:** `TicketAssignmentService`

**Algorithm:**
```python
async def assign_ticket_automatically(ticket_id, tenant_id):
    # 1. Find all agents with status = 'available'
    # 2. Calculate current workload for each agent:
    #    workload = COUNT(tickets WHERE status IN (open, in_progress, waiting))
    # 3. Sort agents by:
    #    - workload (ascending) - lowest first
    #    - last_activity_at (ascending) - ensure rotation
    # 4. Assign to agent with lowest workload
    # 5. Update agent's last_activity_at to rotate
```

**Backend API:**
- **Endpoint:** `POST /api/v1/tickets/{ticket_id}/assign/auto`
- **Location:** `src/dotmac/platform/ticketing/router.py:199-238`
- **Response:** Returns updated `TicketDetail` with assignment

**Service Methods:**
```python
class TicketAssignmentService:
    assign_ticket_automatically(ticket_id, tenant_id) -> UUID | None
    get_agent_workload(agent_id, tenant_id) -> int
    get_available_agent_count(tenant_id) -> int
```

**Load Balancing:**
- Considers only agents with `status = 'available'`
- Balances by active ticket count (open + in_progress + waiting)
- Uses `last_activity_at` for tie-breaking to ensure fair rotation
- Updates `last_activity_at` after each assignment

**Usage Example:**
```bash
# Auto-assign a ticket
POST /api/v1/tickets/550e8400-e29b-41d4-a716-446655440000/assign/auto

# Response: 200 OK
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "assigned_to_user_id": "agent-uuid-here",
  ...
}

# Error if no agents available: 503 Service Unavailable
{
  "detail": "No available agents to assign ticket"
}
```

**Integration Points:**
- Can be called manually via API
- Can be triggered automatically on ticket creation via webhook
- Integrates with existing `ticket.assigned` event system

---

## Enhancement 4: Agent Skills Matrix System ✅

### Implementation

**Database Model:**
- **Table:** `agent_skills`
- **Location:** `src/dotmac/platform/ticketing/skills_models.py`
- **Migration:** `alembic/versions/2025_11_08_1700-add_agent_skills_table.py`

**Schema:**
```python
class AgentSkill(Base):
    id: UUID (primary key)
    user_id: UUID (indexed)
    tenant_id: str | None (indexed)
    skill_category: str (indexed)  # e.g., 'network', 'billing', 'technical'
    skill_level: int               # 1=Beginner, 2=Intermediate, 3=Advanced, 4=Expert
    can_handle_escalations: bool
    created_at: datetime
    updated_at: datetime
```

**Skill Categories (Examples):**
- `network` - Network infrastructure issues
- `billing` - Billing and payment problems
- `technical` - General technical support
- `fiber` - Fiber optic installations
- `wireless` - Wireless connectivity issues
- `account` - Account management
- `hardware` - Hardware troubleshooting

**Skill Levels:**
```
1 - Beginner: Can handle basic tickets with supervision
2 - Intermediate: Can handle most standard tickets independently
3 - Advanced: Can handle complex tickets and provide guidance
4 - Expert: Can handle all tickets including critical escalations
```

**Future Enhancement - Smart Assignment:**
```python
# Extend TicketAssignmentService to include skill-based routing
async def assign_by_skill(ticket_id, required_skill, tenant_id):
    # 1. Get ticket's required skill category
    # 2. Find available agents with matching skill
    # 3. Filter by minimum skill level
    # 4. Sort by skill level (descending) and workload (ascending)
    # 5. Assign to best-matched agent
```

**API Endpoints (To Be Implemented):**
```python
GET    /api/v1/tickets/agents/{user_id}/skills        # List agent skills
POST   /api/v1/tickets/agents/{user_id}/skills        # Add skill
PATCH  /api/v1/tickets/agents/{user_id}/skills/{id}   # Update skill level
DELETE /api/v1/tickets/agents/{user_id}/skills/{id}   # Remove skill
```

---

## Enhancement 5: Report Scheduling System

### Planned Implementation

**Report Types:**
```python
class ReportType(str, Enum):
    AGENT_PERFORMANCE = "agent_performance"
    SLA_BREACHES = "sla_breaches"
    TICKET_AGING = "ticket_aging"
    REVENUE_SUMMARY = "revenue_summary"
    SESSION_HISTORY = "session_history"
    BLOCKED_CUSTOMERS = "blocked_customers"
```

**Database Model:**
```python
class ScheduledReport(Base):
    id: UUID
    tenant_id: str
    report_type: ReportType
    schedule_cron: str  # e.g., "0 9 * * MON" for Monday 9am
    parameters: dict    # Report-specific filters
    recipients: list[str]  # Email addresses
    format: str         # "pdf", "csv", "xlsx"
    last_run_at: datetime | None
    next_run_at: datetime
    is_active: bool
    created_by: UUID
    created_at: datetime
    updated_at: datetime
```

**Cron Schedule Examples:**
```
"0 9 * * MON"     # Every Monday at 9 AM
"0 0 1 * *"       # First day of month at midnight
"0 */6 * * *"     # Every 6 hours
"0 9 * * 1-5"     # Weekdays at 9 AM
```

**Celery Task:**
```python
@celery_app.task
async def execute_scheduled_reports():
    # 1. Query reports with next_run_at <= now() and is_active = True
    # 2. For each report:
    #    - Generate report based on report_type
    #    - Export to specified format
    #    - Send via email to recipients
    #    - Update last_run_at and next_run_at
```

**API Endpoints:**
```python
GET    /api/v1/reports/schedules           # List scheduled reports
POST   /api/v1/reports/schedules           # Create schedule
GET    /api/v1/reports/schedules/{id}      # Get schedule details
PATCH  /api/v1/reports/schedules/{id}      # Update schedule
DELETE /api/v1/reports/schedules/{id}      # Delete schedule
POST   /api/v1/reports/schedules/{id}/run  # Trigger manual run
```

---

## Enhancement 6: Report Export to Email

### Planned Implementation

**Email Service Integration:**
```python
class ReportEmailService:
    async def send_report(
        self,
        report_type: str,
        recipients: list[str],
        format: str,
        data: Any,
        filters: dict | None = None,
    ):
        # 1. Generate report based on type
        if report_type == "agent_performance":
            file_data = await generate_agent_performance_report(data, format)
        elif report_type == "sla_breaches":
            file_data = await generate_sla_breach_report(data, format)
        # ... other report types

        # 2. Format email
        subject = f"{report_type.replace('_', ' ').title()} Report - {date.today()}"
        body = self._generate_email_body(report_type, filters)

        # 3. Attach report file
        attachment = {
            "filename": f"{report_type}_{date.today()}.{format}",
            "content": file_data,
            "content_type": MIME_TYPES[format],
        }

        # 4. Send via existing email service
        await email_service.send_email(
            to=recipients,
            subject=subject,
            body=body,
            attachments=[attachment],
        )
```

**Export Formats:**
```python
# PDF - Formatted report with charts
async def export_to_pdf(data: dict) -> bytes:
    # Use reportlab or weasyprint
    return pdf_bytes

# CSV - Raw data export
async def export_to_csv(data: list[dict]) -> bytes:
    # Use pandas DataFrame.to_csv()
    return csv_bytes

# Excel - Multi-sheet workbooks
async def export_to_xlsx(data: dict) -> bytes:
    # Use openpyxl or xlsxwriter
    # Multiple sheets: Summary, Details, Charts
    return xlsx_bytes
```

**Email Template:**
```html
<html>
  <body>
    <h2>{Report Type} - {Date Range}</h2>
    <p>This automated report was generated on {timestamp}.</p>

    <h3>Summary</h3>
    <ul>
      <li>Total Records: {count}</li>
      <li>Filters Applied: {filters}</li>
    </ul>

    <p>Please find the detailed report attached.</p>

    <p>
      <small>
        This is an automated email from DotMac Platform.
        To manage report subscriptions, visit the Reports Dashboard.
      </small>
    </p>
  </body>
</html>
```

**API Endpoints:**
```python
POST /api/v1/reports/export/agent-performance  # Export agent performance
POST /api/v1/reports/export/sla-breaches       # Export SLA breaches
POST /api/v1/reports/export/ticket-aging       # Export aging report

# Request body
{
  "format": "pdf",  # or "csv", "xlsx"
  "email_to": ["manager@example.com"],
  "filters": {
    "start_date": "2025-10-01",
    "end_date": "2025-11-01"
  }
}
```

---

## Database Migrations

### Migration Order

Run migrations in this order:

```bash
# 1. Agent Availability
alembic upgrade agent_availability_001

# 2. Agent Skills
alembic upgrade agent_skills_001

# 3. Scheduled Reports (when implemented)
alembic upgrade scheduled_reports_001
```

### Full Migration Script

```bash
cd /Users/michaelayoade/Downloads/Projects/dotmac-ftth-ops
source .venv/bin/activate
poetry run alembic upgrade head
```

---

## Testing Strategy

### Unit Tests

**Agent Performance:**
```python
# tests/ticketing/test_agent_performance.py
async def test_agent_performance_metrics():
    # Create test tickets assigned to agents
    # Verify metrics calculation
    # Test date range filtering
    # Test SLA compliance calculation

async def test_agent_performance_no_data():
    # Verify returns empty list for new agents
```

**Availability System:**
```python
# tests/ticketing/test_agent_availability.py
async def test_update_agent_status():
    # Update status to 'busy'
    # Verify status changed
    # Verify last_activity_at updated

async def test_auto_create_availability():
    # GET /me without existing record
    # Verify creates default 'available' status
```

**Round-robin Assignment:**
```python
# tests/ticketing/test_assignment_service.py
async def test_assign_to_available_agent():
    # Create 3 agents: 2 available, 1 offline
    # Auto-assign ticket
    # Verify assigned to available agent

async def test_load_balancing():
    # Agent A: 5 tickets, Agent B: 2 tickets
    # Auto-assign new ticket
    # Verify assigned to Agent B (lower workload)

async def test_no_available_agents():
    # All agents offline
    # Attempt auto-assign
    # Verify returns None
```

### Integration Tests

```python
# tests/integration/test_agent_workflow.py
async def test_complete_agent_workflow():
    # 1. Agent sets status to 'available'
    # 2. Ticket created
    # 3. Auto-assign ticket to agent
    # 4. Verify agent's workload increased
    # 5. Agent resolves ticket
    # 6. Verify performance metrics updated
```

---

## Frontend Integration

### Dashboard Layout Recommendations

**Agent Dashboard (`/dashboard/operations/tickets/agents`):**
```
┌─────────────────────────────────────────────────────────┐
│  Agent Performance Dashboard             [Time Range ▾] │
├─────────────────────────────────────────────────────────┤
│  [Active Agents] [Total Assigned] [Resolved] [SLA %]   │
├─────────────────────────────────────────────────────────┤
│  Agent Performance Metrics Table                        │
│  ┌───────────┬──────────┬──────────┬─────────┬────────┐│
│  │ Agent     │ Assigned │ Resolved │ Avg Time│ SLA %  ││
│  ├───────────┼──────────┼──────────┼─────────┼────────┤│
│  │ John Doe  │ 45       │ 42       │ 2h 15m  │ 95.5%  ││
│  │ Jane Smith│ 38       │ 35       │ 1h 45m  │ 92.1%  ││
│  └───────────┴──────────┴──────────┴─────────┴────────┘│
└─────────────────────────────────────────────────────────┘
```

**Agent Status Widget (Sidebar):**
```
┌──────────────────────────────┐
│ 🟢 Your Availability Status  │
├──────────────────────────────┤
│ Current Status:              │
│ [Available        ▾]         │
│                              │
│ Status Message:              │
│ [Available for tickets___]   │
│                     [Save]   │
│                              │
│ Last updated: 2m ago         │
└──────────────────────────────┘
```

---

## API Documentation

### Postman Collection

Import these endpoints into Postman:

```json
{
  "info": { "name": "Agent & Reporting APIs" },
  "item": [
    {
      "name": "Get Agent Performance",
      "request": {
        "method": "GET",
        "url": "{{base_url}}/api/v1/tickets/agents/performance?start_date={{start}}&end_date={{end}}",
        "header": [{ "key": "Authorization", "value": "Bearer {{token}}" }]
      }
    },
    {
      "name": "Get My Availability",
      "request": {
        "method": "GET",
        "url": "{{base_url}}/api/v1/tickets/agents/availability/me",
        "header": [{ "key": "Authorization", "value": "Bearer {{token}}" }]
      }
    },
    {
      "name": "Update My Availability",
      "request": {
        "method": "PATCH",
        "url": "{{base_url}}/api/v1/tickets/agents/availability/me",
        "header": [{ "key": "Authorization", "value": "Bearer {{token}}" }],
        "body": {
          "mode": "raw",
          "raw": "{\"status\": \"busy\", \"status_message\": \"In a meeting\"}"
        }
      }
    },
    {
      "name": "Auto-Assign Ticket",
      "request": {
        "method": "POST",
        "url": "{{base_url}}/api/v1/tickets/{{ticket_id}}/assign/auto",
        "header": [{ "key": "Authorization", "value": "Bearer {{token}}" }]
      }
    }
  ]
}
```

---

## Monitoring & Observability

### Metrics to Track

**Agent Performance Metrics:**
- Average tickets per agent per day
- Average resolution time trend over time
- SLA compliance rate by agent and team
- Escalation rate by agent

**Availability Metrics:**
- Average available agents count
- Status change frequency
- Time spent in each status (available, busy, away, offline)

**Assignment Metrics:**
- Auto-assignment success rate
- Average time to assignment
- Workload distribution variance (standard deviation)
- Failed assignment attempts (no agents available)

**Report Metrics:**
- Scheduled reports execution success rate
- Report generation time
- Email delivery success rate
- Report size (bytes)

### Prometheus Queries

```promql
# Average active tickets per agent
avg(dotmac_agent_active_tickets) by (agent_id)

# Available agents count
count(dotmac_agent_availability{status="available"})

# Auto-assignment success rate
rate(dotmac_assignment_success_total[5m]) / rate(dotmac_assignment_attempts_total[5m])

# Report generation duration
histogram_quantile(0.95, rate(dotmac_report_generation_duration_seconds_bucket[5m]))
```

---

## Performance Considerations

### Database Optimization

**Indexes Created:**
```sql
-- Agent availability
CREATE INDEX ix_agent_availability_user_id ON agent_availability(user_id);
CREATE INDEX ix_agent_availability_tenant_id ON agent_availability(tenant_id);
CREATE INDEX ix_agent_availability_status ON agent_availability(status);

-- Agent skills
CREATE INDEX ix_agent_skills_user_id ON agent_skills(user_id);
CREATE INDEX ix_agent_skills_tenant_id ON agent_skills(tenant_id);
CREATE INDEX ix_agent_skills_skill_category ON agent_skills(skill_category);
```

**Query Optimization:**
```python
# Use select_in_loading for N+1 prevention
agents = await session.execute(
    select(AgentAvailability)
    .options(selectinload(AgentAvailability.user))
    .where(AgentAvailability.status == AgentStatus.AVAILABLE)
)

# Batch workload queries instead of per-agent
workloads = await session.execute(
    select(
        Ticket.assigned_to_user_id,
        func.count(Ticket.id).label('workload')
    )
    .where(Ticket.status.in_([TicketStatus.OPEN, TicketStatus.IN_PROGRESS]))
    .group_by(Ticket.assigned_to_user_id)
)
```

### Caching Strategy

```python
# Cache agent performance for 5 minutes
@cache.memoize(timeout=300)
async def get_agent_performance(tenant_id, start_date, end_date):
    return await service.get_agent_performance(...)

# Cache available agent count for 30 seconds
@cache.memoize(timeout=30)
async def get_available_agent_count(tenant_id):
    return await assignment_service.get_available_agent_count(tenant_id)
```

---

## Security Considerations

### Access Control

**Agent Performance:**
- Only accessible by tenant admins and managers
- Agents can view their own performance only

**Availability Management:**
- Agents can update their own status
- Admins can view all agents' availability
- No cross-tenant access

**Assignment:**
- Auto-assignment respects tenant boundaries
- Only assigns to agents within same tenant

**Reports:**
- Scheduled reports respect tenant data isolation
- Email recipients must be within tenant domain

### Data Privacy

```python
# Redact sensitive fields in logs
logger.info(
    "agent.performance.fetched",
    agent_count=len(metrics),
    tenant_id=tenant_id,
    # Do NOT log: agent emails, ticket content
)

# Anonymize exported data if requested
if anonymize:
    for metric in metrics:
        metric.agent_email = f"agent_{hash(metric.agent_id)[:8]}@redacted.com"
        metric.agent_name = f"Agent {hash(metric.agent_id)[:4]}"
```

---

## Rollout Plan

### Phase 1: Core Features (Week 1) ✅
- ✅ Agent Performance Dashboard
- ✅ Agent Availability System
- ✅ Round-robin Assignment Logic

### Phase 2: Advanced Features (Week 2)
- Skills Matrix API and UI
- Skill-based assignment integration
- Skills management dashboard

### Phase 3: Reporting (Week 3)
- Report scheduling backend
- Cron job configuration
- Schedule management UI

### Phase 4: Email Integration (Week 4)
- Report export service
- Email template system
- Report delivery testing
- User documentation

---

## Success Metrics

**Operational Efficiency:**
- 30% reduction in average ticket assignment time
- 20% improvement in workload distribution (lower variance)
- 90%+ agent availability during business hours

**Agent Satisfaction:**
- Agents can manage their own availability
- Fair ticket distribution perceived by agents
- Reduced manual assignment overhead

**Management Visibility:**
- Real-time agent performance visibility
- Automated weekly/monthly performance reports
- Data-driven agent skill development

---

## References

**Implementation Files:**
- Agent Performance: `src/dotmac/platform/ticketing/service.py:620`
- Availability Models: `src/dotmac/platform/ticketing/availability_models.py`
- Assignment Service: `src/dotmac/platform/ticketing/assignment_service.py`
- Skills Models: `src/dotmac/platform/ticketing/skills_models.py`

**Frontend Components:**
- Performance Dashboard: `frontend/apps/isp-ops-app/app/dashboard/operations/tickets/agents/page.tsx`
- Status Widget: `frontend/apps/isp-ops-app/components/tickets/AgentStatusWidget.tsx`

**Migrations:**
- `alembic/versions/2025_11_08_1600-add_agent_availability_table.py`
- `alembic/versions/2025_11_08_1700-add_agent_skills_table.py`

---

## Appendix: Database Schema

### Entity Relationship Diagram

```
┌──────────────────┐         ┌─────────────────────┐
│ User             │         │ Ticket              │
├──────────────────┤         ├─────────────────────┤
│ id (PK)          │────────<│ assigned_to_user_id │
│ email            │         │ id (PK)             │
│ first_name       │         │ status              │
│ last_name        │         │ priority            │
└──────────────────┘         │ created_at          │
        │                    │ resolved_at         │
        │                    │ sla_breached        │
        │                    └─────────────────────┘
        │
        ├──────────────────┐
        │                  │
        v                  v
┌─────────────────────┐  ┌─────────────────────┐
│ AgentAvailability   │  │ AgentSkill          │
├─────────────────────┤  ├─────────────────────┤
│ id (PK)             │  │ id (PK)             │
│ user_id (FK, UQ)    │  │ user_id (FK)        │
│ status              │  │ skill_category      │
│ status_message      │  │ skill_level         │
│ last_activity_at    │  │ can_handle_escalate │
└─────────────────────┘  └─────────────────────┘
```

### Sample Data

```sql
-- Agent availability
INSERT INTO agent_availability (id, user_id, tenant_id, status, last_activity_at, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  'agent-uuid-1',
  'tenant-123',
  'available',
  NOW(),
  NOW(),
  NOW()
);

-- Agent skills
INSERT INTO agent_skills (id, user_id, tenant_id, skill_category, skill_level, can_handle_escalations, created_at, updated_at)
VALUES
  (gen_random_uuid(), 'agent-uuid-1', 'tenant-123', 'network', 4, true, NOW(), NOW()),
  (gen_random_uuid(), 'agent-uuid-1', 'tenant-123', 'billing', 2, false, NOW(), NOW());
```

---

**Document Version:** 1.0
**Last Updated:** November 8, 2025
**Maintained By:** Platform Team
