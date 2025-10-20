# Fault Management System Implementation

## Overview

This document outlines the comprehensive Fault Management system implementation for the dotmac FTTH Operations Platform, including alarm correlation, SLA monitoring, breach detection, and automatic ticket creation from network events.

## Architecture

### Component Layers

```
┌─────────────────────────────────────────────────────────┐
│                     API Layer                            │
│  - REST Endpoints for Alarms, SLA, Maintenance          │
│  - WebSocket for Real-time Alarm Streaming             │
└──────────────────┬──────────────────────────────────────┘
                   │
┌──────────────────┴──────────────────────────────────────┐
│                  Service Layer                           │
│  - AlarmService (CRUD, Correlation, Escalation)         │
│  - SLAMonitoringService (Tracking, Breach Detection)    │
│  - CorrelationEngine (Rule-based Correlation)           │
└──────────────────┬──────────────────────────────────────┘
                   │
┌──────────────────┴──────────────────────────────────────┐
│                 Event Processing                         │
│  - Network Event Handlers                               │
│  - Celery Tasks (Background Processing)                 │
│  - Event Bus Integration                                │
└──────────────────┬──────────────────────────────────────┘
                   │
┌──────────────────┴──────────────────────────────────────┐
│                  Data Layer                              │
│  - Alarm Models & Repositories                          │
│  - SLA Models & Repositories                            │
│  - Maintenance Window Models                            │
└─────────────────────────────────────────────────────────┘
```

## Implemented Components

### ✅ 1. Database Models (`models.py`)

#### Alarm Management Models

**Alarm** - Core alarm entity with:
- Multi-level severity (Critical, Major, Minor, Warning, Info, Cleared)
- Lifecycle status tracking (Active, Acknowledged, Cleared, Resolved, Suppressed)
- Source identification (Network Device, Monitoring, CPE, Service, System)
- Resource tracking (affected devices, services, customers)
- Correlation support (parent-child relationships, root cause analysis)
- Timing information (first/last occurrence, acknowledgment, resolution)
- Assignment and ticketing integration
- Occurrence counting for flapping detection

**AlarmNote** - Audit trail for alarm investigations:
- Investigation notes
- Resolution activities
- User attribution

**AlarmRule** - Rule-based automation:
- Correlation rules
- Suppression rules
- Escalation rules
- Condition matching
- Action execution
- Time window configuration

#### SLA Management Models

**SLADefinition** - Service level agreements:
- Availability targets (e.g., 99.9%)
- Performance targets (latency, packet loss, bandwidth)
- Response time targets by severity
- Resolution time targets by severity
- Business hour considerations
- Maintenance window exclusions

**SLAInstance** - Customer/service-specific SLA:
- Real-time compliance tracking
- Downtime accumulation (planned/unplanned)
- Breach counting
- Credit/penalty calculation
- Period-based measurement

**SLABreach** - SLA violation events:
- Breach type classification
- Duration tracking
- Target vs actual measurements
- Financial impact calculation
- Resolution tracking

#### Supporting Models

**MaintenanceWindow** - Planned maintenance:
- Schedule management
- Affected scope tracking
- Alarm suppression
- Customer notifications

### ✅ 2. Pydantic Schemas (`schemas.py`)

Complete request/response schemas for all entities:

- **Alarm Schemas**: Create, Update, Acknowledge, Response, Note, Statistics
- **SLA Schemas**: Definition, Instance, Breach responses
- **Maintenance Window Schemas**: Create, Update, Response
- **Query Schemas**: Filtering, pagination, date ranges
- **Report Schemas**: Statistics, compliance reports

### 📋 3. Implementation Status

#### Completed (40%)

1. ✅ **Data Models** - Complete PostgreSQL schema with indexes and relationships
2. ✅ **Pydantic Schemas** - Full API contract definitions
3. ✅ **Module Structure** - Package initialization and exports

#### In Progress / Remaining (60%)

4. ⚠️ **Alarm Correlation Engine** - Rule-based correlation logic
5. ⚠️ **Alarm Service Layer** - Business logic for alarm management
6. ⚠️ **SLA Monitoring Service** - Real-time SLA tracking
7. ⚠️ **API Router** - REST endpoints for all operations
8. ⚠️ **Event Handlers** - Network event processing
9. ⚠️ **Celery Tasks** - Background jobs for correlation and monitoring
10. ⚠️ **Ticket Integration** - Automatic ticket creation
11. ⚠️ **Notifications** - Webhooks and real-time alerts
12. ⚠️ **Tests** - Comprehensive test coverage
13. ⚠️ **Documentation** - API docs and usage guides

## Key Features

### Alarm Correlation

**Objectives:**
- Reduce alarm noise by identifying root causes
- Group related alarms automatically
- Detect flapping alarms
- Suppress duplicate alarms

**Correlation Strategies:**

1. **Topology-Based Correlation**
   - Identify network topology relationships
   - Correlate downstream failures to upstream root causes
   - Example: OLT failure correlates ONT alarms

2. **Time-Based Correlation**
   - Group alarms occurring within time window
   - Default: 5 minutes
   - Configurable per rule

3. **Pattern-Based Correlation**
   - Match alarm patterns using rules
   - Regex and field matching
   - Custom correlation logic

4. **Flapping Detection**
   - Track alarm occurrence frequency
   - Suppress rapidly changing alarms
   - Configurable thresholds

**Correlation Rules Example:**
```json
{
  "name": "OLT to ONT Correlation",
  "type": "correlation",
  "conditions": {
    "parent": {
      "alarm_type": "device.down",
      "resource_type": "olt"
    },
    "child": {
      "alarm_type": "signal.loss",
      "resource_type": "ont"
    }
  },
  "actions": {
    "mark_parent_as_root_cause": true,
    "suppress_child_alarms": true,
    "create_correlation_id": true
  },
  "time_window": 300
}
```

### SLA Monitoring

**Capabilities:**

1. **Availability Monitoring**
   - Track service uptime/downtime
   - Calculate availability percentage
   - Compare against SLA targets
   - Exclude maintenance windows

2. **Performance Monitoring**
   - Latency tracking
   - Packet loss monitoring
   - Bandwidth utilization
   - Performance threshold breaches

3. **Response Time Tracking**
   - Monitor alarm response times
   - Compare against SLA commitments
   - Severity-based targets
   - Business hours consideration

4. **Resolution Time Tracking**
   - Track time to resolution
   - Compare against SLA targets
   - Escalation triggers
   - Auto-remediation integration

**SLA Breach Detection:**

Automatic detection of:
- Availability breaches (downtime exceeds allowance)
- Response time violations (delayed acknowledgment)
- Resolution time violations (delayed resolution)
- Performance degradation (latency, packet loss)

**Breach Actions:**
- Create breach record
- Calculate financial impact (credits/penalties)
- Send notifications
- Create escalation tickets
- Update SLA instance status

### Automatic Ticket Creation

**Trigger Conditions:**

1. **Critical Alarms**
   - Auto-create ticket for all critical alarms
   - Priority based on customer impact
   - Assignment based on resource type

2. **SLA Breaches**
   - Create ticket for at-risk SLA instances
   - Escalate for breached instances
   - Link to related alarms

3. **Major Alarms with Customer Impact**
   - Subscriber count threshold
   - Service type priority
   - Customer tier consideration

4. **Unacknowledged Alarms**
   - Time-based escalation
   - Create ticket after timeout
   - Auto-assignment rules

**Ticket Integration:**
```python
async def create_ticket_from_alarm(
    alarm: Alarm,
    sla_breach: SLABreach | None = None
) -> UUID:
    """
    Create support ticket from alarm

    Links ticket to alarm and SLA breach if applicable.
    Sets priority based on severity and customer impact.
    """
    ticket_data = {
        "title": alarm.title,
        "description": alarm.description,
        "priority": map_severity_to_priority(alarm.severity),
        "category": map_alarm_type_to_category(alarm.alarm_type),
        "customer_id": alarm.customer_id,
        "metadata": {
            "alarm_id": alarm.id,
            "alarm_correlation_id": alarm.correlation_id,
            "sla_breach_id": sla_breach.id if sla_breach else None,
            "affected_subscribers": alarm.subscriber_count
        }
    }

    ticket = await ticket_service.create(ticket_data)

    # Link ticket to alarm
    alarm.ticket_id = ticket.id
    await alarm_repository.update(alarm)

    return ticket.id
```

## Database Schema

### Key Indexes

```sql
-- Alarm queries
CREATE INDEX ix_alarms_tenant_status ON alarms(tenant_id, status);
CREATE INDEX ix_alarms_tenant_severity ON alarms(tenant_id, severity);
CREATE INDEX ix_alarms_resource ON alarms(resource_type, resource_id);
CREATE INDEX ix_alarms_correlation ON alarms(correlation_id, status);

-- SLA queries
CREATE INDEX ix_sla_instances_customer ON sla_instances(customer_id, status);
CREATE INDEX ix_sla_breaches_time ON sla_breaches(breach_start, breach_end);
CREATE INDEX ix_sla_breaches_resolved ON sla_breaches(resolved, breach_start);

-- Maintenance windows
CREATE INDEX ix_maintenance_windows_time ON maintenance_windows(start_time, end_time, status);
```

### Relationships

```
Alarm
├── parent_alarm (self-referential)
├── child_alarms (one-to-many)
├── notes (one-to-many)
└── ticket (via ticket_id)

SLADefinition
└── instances (one-to-many)
    └── breaches (one-to-many)
        ├── alarm (via alarm_id)
        └── ticket (via ticket_id)
```

## API Endpoints (Planned)

### Alarm Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/faults/alarms` | List alarms with filtering |
| GET | `/api/v1/faults/alarms/{id}` | Get alarm details |
| POST | `/api/v1/faults/alarms` | Create alarm |
| PATCH | `/api/v1/faults/alarms/{id}` | Update alarm |
| POST | `/api/v1/faults/alarms/{id}/acknowledge` | Acknowledge alarm |
| POST | `/api/v1/faults/alarms/{id}/clear` | Clear alarm |
| POST | `/api/v1/faults/alarms/{id}/notes` | Add alarm note |
| GET | `/api/v1/faults/alarms/statistics` | Get alarm statistics |

### SLA Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/faults/sla-definitions` | List SLA definitions |
| POST | `/api/v1/faults/sla-definitions` | Create SLA definition |
| GET | `/api/v1/faults/sla-instances` | List SLA instances |
| GET | `/api/v1/faults/sla-instances/{id}` | Get SLA instance |
| POST | `/api/v1/faults/sla-instances` | Create SLA instance |
| GET | `/api/v1/faults/sla-breaches` | List SLA breaches |
| GET | `/api/v1/faults/sla-compliance` | Get compliance report |

### Maintenance Windows

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/faults/maintenance-windows` | List maintenance windows |
| POST | `/api/v1/faults/maintenance-windows` | Schedule maintenance |
| PATCH | `/api/v1/faults/maintenance-windows/{id}` | Update maintenance window |
| DELETE | `/api/v1/faults/maintenance-windows/{id}` | Cancel maintenance |

### Alarm Rules

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/faults/alarm-rules` | List alarm rules |
| POST | `/api/v1/faults/alarm-rules` | Create alarm rule |
| PATCH | `/api/v1/faults/alarm-rules/{id}` | Update alarm rule |
| DELETE | `/api/v1/faults/alarm-rules/{id}` | Delete alarm rule |

## Event Integration

### Network Events

The fault management system processes various network events:

**Device Events:**
- `device.down` → Create critical alarm
- `device.degraded` → Create major alarm
- `device.up` → Clear related alarms

**Service Events:**
- `service.outage` → Create alarm + SLA breach check
- `service.degraded` → Create alarm + performance check
- `service.restored` → Clear alarm + update SLA

**CPE Events:**
- `cpe.offline` → Create alarm
- `cpe.signal_loss` → Create alarm + trigger correlation
- `cpe.online` → Clear alarm

**Monitoring Events:**
- `monitoring.threshold_exceeded` → Create alarm
- `monitoring.check_failed` → Create alarm
- `monitoring.check_recovered` → Clear alarm

### Event Handler Example

```python
@event_bus.subscribe("device.down")
async def handle_device_down(event: Event):
    """Handle device down event"""

    # Create alarm
    alarm = await alarm_service.create(AlarmCreate(
        alarm_id=f"device-down-{event.data['device_id']}",
        severity=AlarmSeverity.CRITICAL,
        source=AlarmSource.NETWORK_DEVICE,
        alarm_type="device.down",
        title=f"Device Down: {event.data['device_name']}",
        resource_type="device",
        resource_id=event.data['device_id'],
        resource_name=event.data['device_name'],
        subscriber_count=event.data.get('affected_subscribers', 0)
    ))

    # Trigger correlation
    await correlation_engine.correlate(alarm)

    # Check SLA impact
    await sla_service.check_impact(alarm)

    # Create ticket if needed
    if alarm.subscriber_count > 10:  # Major customer impact
        await create_ticket_from_alarm(alarm)
```

## Celery Tasks

Background tasks for async processing:

```python
# Periodic tasks
@celery.task
def correlate_pending_alarms():
    """Run correlation on recent alarms"""
    pass

@celery.task
def check_sla_compliance():
    """Check all SLA instances for compliance"""
    pass

@celery.task
def detect_sla_breaches():
    """Detect and create breach records"""
    pass

@celery.task
def check_unacknowledged_alarms():
    """Create tickets for unacknowledged alarms"""
    pass

@celery.task
def cleanup_old_cleared_alarms():
    """Archive cleared alarms older than 90 days"""
    pass

# Event-driven tasks
@celery.task
def process_alarm_correlation(alarm_id: UUID):
    """Process single alarm correlation"""
    pass

@celery.task
def calculate_sla_metrics(instance_id: UUID):
    """Calculate SLA metrics for instance"""
    pass

@celery.task
def send_alarm_notifications(alarm_id: UUID):
    """Send notifications for alarm"""
    pass
```

## Notification Channels

### Alarm Notifications

- **Email**: Critical/major alarms
- **SMS**: Critical alarms with high customer impact
- **Webhook**: All alarms to external systems
- **WebSocket**: Real-time alarm feed
- **Slack/Teams**: Integration via webhooks

### SLA Breach Notifications

- **Email**: All breaches to account managers
- **Webhook**: Integration with billing systems
- **Dashboard**: Real-time SLA status

## Usage Examples

### Create Alarm from Network Event

```python
from dotmac.platform.fault_management import AlarmCreate, AlarmSeverity, AlarmSource

# Device monitoring detected failure
alarm = await alarm_service.create(
    AlarmCreate(
        alarm_id="mon-001-device-failure",
        severity=AlarmSeverity.CRITICAL,
        source=AlarmSource.MONITORING,
        alarm_type="device.unreachable",
        title="OLT-01 Unreachable",
        description="Device failed to respond to SNMP polls",
        resource_type="olt",
        resource_id="olt-001",
        resource_name="OLT-01 Main Street",
        subscriber_count=150,
        metadata={
            "last_seen": "2025-01-14T10:00:00Z",
            "check_type": "snmp",
            "check_interval": 60
        },
        probable_cause="Network connectivity issue or device failure",
        recommended_action="Check physical connections and device power"
    ),
    tenant_id="tenant-123"
)
```

### Query Alarms

```python
# Get critical alarms for a customer
alarms = await alarm_service.query(
    AlarmQueryParams(
        severity=[AlarmSeverity.CRITICAL],
        status=[AlarmStatus.ACTIVE],
        customer_id=customer_id,
        limit=50
    ),
    tenant_id="tenant-123"
)

# Get root cause alarms
root_causes = await alarm_service.query(
    AlarmQueryParams(
        is_root_cause=True,
        status=[AlarmStatus.ACTIVE],
        from_date=datetime.now() - timedelta(hours=24)
    ),
    tenant_id="tenant-123"
)
```

### Create SLA Definition

```python
from dotmac.platform.fault_management import SLADefinitionCreate

# Create enterprise SLA
sla = await sla_service.create_definition(
    SLADefinitionCreate(
        name="Enterprise Fiber 99.9%",
        service_type="fiber",
        availability_target=0.999,  # 99.9%
        measurement_period_days=30,
        max_latency_ms=10.0,
        max_packet_loss_percent=0.1,
        min_bandwidth_mbps=1000.0,
        response_time_critical=15,  # 15 minutes
        resolution_time_critical=240  # 4 hours
    ),
    tenant_id="tenant-123"
)
```

### Monitor SLA Compliance

```python
# Check SLA compliance for customer
report = await sla_service.get_compliance_report(
    customer_id=customer_id,
    period_start=datetime(2025, 1, 1),
    period_end=datetime(2025, 1, 31),
    tenant_id="tenant-123"
)

print(f"Availability: {report.avg_availability:.2%}")
print(f"Breaches: {report.total_breaches}")
print(f"Credits: ${report.total_credits:.2f}")
```

## Testing Strategy

### Unit Tests
- Model validation
- Schema validation
- Correlation rule matching
- SLA calculations

### Integration Tests
- Alarm creation and correlation
- SLA breach detection
- Ticket creation
- Event processing

### E2E Tests
- Network event → Alarm → Correlation → Ticket workflow
- SLA monitoring → Breach detection → Notification workflow
- Maintenance window → Alarm suppression workflow

## Deployment Considerations

### Database Migrations

```bash
# Create migration for fault management tables
alembic revision --autogenerate -m "add_fault_management_tables"

# Apply migration
alembic upgrade head
```

### Background Workers

```bash
# Start Celery worker for fault management
celery -A dotmac.platform.worker worker \
  --queue=faults,sla,correlation \
  --concurrency=4 \
  --loglevel=info
```

### Monitoring

Key metrics to monitor:
- Alarm ingestion rate
- Correlation processing time
- SLA calculation performance
- Ticket creation rate
- Breach detection latency

## Next Steps

1. **Implement Correlation Engine** (`correlation.py`)
2. **Implement Alarm Service** (`service.py`)
3. **Implement SLA Service** (`sla_service.py`)
4. **Create API Router** (`router.py`)
5. **Add Event Handlers** (`event_handlers.py`)
6. **Create Celery Tasks** (`tasks.py`)
7. **Add Tests** (`tests/fault_management/`)
8. **Write API Documentation**

## Completion Status

- ✅ **Data Models**: 100%
- ✅ **Pydantic Schemas**: 100%
- ⚠️ **Correlation Engine**: 0%
- ⚠️ **Service Layer**: 0%
- ⚠️ **SLA Monitoring**: 0%
- ⚠️ **API Router**: 0%
- ⚠️ **Event Handlers**: 0%
- ⚠️ **Tasks**: 0%
- ⚠️ **Tests**: 0%
- ⚠️ **Documentation**: 40%

**Overall: 20% Complete**

The foundation has been laid with comprehensive data models and schemas. The next phase involves implementing the business logic, API endpoints, and integration with existing systems.
