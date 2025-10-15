# Manual Ticket Creation from Alarms

## Overview

The DotMac FTTH Operations Platform supports **manual** ticket creation from alarms. Operators can review alarms and decide which ones require escalation to support tickets, providing full control over the ticket creation process.

## Change Summary

**Previous Behavior (Automatic):**
- Unacknowledged critical/major alarms older than 15 minutes would automatically create tickets
- This was implemented as a periodic Celery task running every 10 minutes
- Operators had limited control over which alarms became tickets

**Current Behavior (Manual):**
- Operators must explicitly create tickets from alarms using the API
- Full control over ticket priority, assignment, and additional context
- Automatic ticket creation task now only logs warnings for attention
- Prevents ticket spam and allows for human judgment

## API Endpoint

### Create Ticket from Alarm

**Endpoint:** `POST /api/v1/faults/alarms/{alarm_id}/create-ticket`

**Permission Required:** `faults.alarms.write`

**Request Body:**

```json
{
  "priority": "high",
  "additional_notes": "Customer reporting intermittent service. High priority business customer.",
  "assign_to_user_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Request Schema:**

```python
{
  "priority": str | None,           # Ticket priority: "low", "normal", "high", "critical"
                                     # If not provided, mapped from alarm severity
  "additional_notes": str | None,   # Extra context for the ticket
  "assign_to_user_id": UUID | None  # Optionally assign to specific user
}
```

**Response (Success - 201):**

```json
{
  "alarm_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "ticket_id": "7b3c1d89-4f23-4a91-8e6f-9c8d7e6f5a4b",
  "ticket_number": "TKT-2024-001234",
  "message": "Ticket TKT-2024-001234 created successfully from alarm"
}
```

**Response (Error - 400):**

```json
{
  "detail": "Alarm 3fa85f64-5717-4562-b3fc-2c963f66afa6 already has ticket 7b3c1d89-4f23-4a91-8e6f-9c8d7e6f5a4b. Please update the existing ticket instead."
}
```

## Ticket Content

When a ticket is created from an alarm, the following information is automatically included:

### Ticket Subject
```
[ALARM] {alarm.title}
```

### Ticket Body (Markdown)
The ticket body includes:
- **Alarm Details:** ID, Severity, Source, Type, Status
- **Description:** Full alarm description
- **Affected Resource:** Type, ID, Name (if applicable)
- **Customer Impact:** Customer name, affected subscriber count (if applicable)
- **Probable Cause:** Root cause analysis (if available)
- **Recommended Action:** Suggested remediation steps (if available)
- **Additional Notes:** Operator-provided context
- **Timing:** First occurrence, last occurrence, occurrence count

### Ticket Metadata
The ticket metadata includes:
```json
{
  "alarm_id": "internal-alarm-uuid",
  "external_alarm_id": "external-system-id",
  "alarm_severity": "critical",
  "alarm_source": "network_device",
  "alarm_type": "port_down",
  "resource_type": "device",
  "resource_id": "router-001",
  "created_from_alarm": true
}
```

### Ticket Type Mapping
- **Outage:** If alarm type contains "outage"
- **Maintenance:** If alarm type contains "maintenance"
- **Fault:** Default for all other alarms

### Priority Mapping
If priority is not explicitly provided, it's mapped from alarm severity:

| Alarm Severity | Ticket Priority |
|----------------|----------------|
| Critical       | Critical       |
| Major          | High           |
| Minor          | Normal         |
| Warning        | Low            |
| Info           | Low            |

## Usage Examples

### Example 1: Create Ticket with Default Priority

```bash
curl -X POST "https://api.example.com/api/v1/faults/alarms/3fa85f64-5717-4562-b3fc-2c963f66afa6/create-ticket" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Result:** Ticket created with priority mapped from alarm severity.

### Example 2: Create High Priority Ticket with Notes

```bash
curl -X POST "https://api.example.com/api/v1/faults/alarms/3fa85f64-5717-4562-b3fc-2c963f66afa6/create-ticket" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "priority": "high",
    "additional_notes": "VIP customer affected. Dispatch technician immediately."
  }'
```

### Example 3: Create and Assign Ticket

```bash
curl -X POST "https://api.example.com/api/v1/faults/alarms/3fa85f64-5717-4562-b3fc-2c963f66afa6/create-ticket" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "priority": "critical",
    "additional_notes": "Core router failure affecting 500+ subscribers",
    "assign_to_user_id": "550e8400-e29b-41d4-a716-446655440000"
  }'
```

## Python Client Example

```python
from dotmac.platform.fault_management.service import AlarmService
from uuid import UUID

async def create_ticket_for_alarm(alarm_id: str, user_id: str):
    """Create a ticket from an alarm."""

    alarm_service = AlarmService(session, tenant_id)

    result = await alarm_service.create_ticket_from_alarm(
        alarm_id=UUID(alarm_id),
        priority="high",
        additional_notes="Escalating to field operations team",
        assign_to_user_id=UUID(user_id),
        user_id=UUID(user_id),
    )

    print(f"Created ticket {result['ticket_number']}")
    print(f"Ticket ID: {result['ticket_id']}")
```

## Workflow Integration

### Recommended Workflow

1. **Monitor Alarms Dashboard**
   - Review active alarms via `GET /api/v1/faults/alarms`
   - Filter by severity, status, customer impact

2. **Investigate Alarm**
   - Review alarm details
   - Check correlation (parent/child alarms)
   - Review probable cause and recommended actions
   - Add notes if needed

3. **Decision Point: Create Ticket?**
   - **Yes:** Alarm requires escalation to support/field ops
     - Use `POST /api/v1/faults/alarms/{id}/create-ticket`
     - Set appropriate priority
     - Add operational context
     - Assign to appropriate team/user

   - **No:** Alarm can be handled without ticket
     - Acknowledge the alarm
     - Add resolution notes
     - Clear or resolve the alarm

4. **Ticket Lifecycle**
   - Ticket service handles assignment, SLA tracking, escalation
   - Updates can be added via ticket API
   - Alarm retains reference to ticket via `ticket_id`

### Monitoring Unacknowledged Alarms

The `faults.check_unacknowledged_alarms` Celery task runs every 10 minutes and logs warnings for:
- Critical or major alarms
- Active status
- Older than 15 minutes
- No associated ticket

**Log Message:**
```json
{
  "event": "alarm.unacknowledged.manual_action_required",
  "alarm_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "external_alarm_id": "ALM-2024-001234",
  "severity": "critical",
  "age_minutes": 23.5,
  "message": "Alarm ALM-2024-001234 requires manual ticket creation"
}
```

Operators should:
1. Review these warnings in logs/monitoring dashboards
2. Investigate the alarms
3. Create tickets manually if escalation is required

## Error Handling

### Alarm Not Found
**HTTP 400**
```json
{
  "detail": "Alarm 3fa85f64-5717-4562-b3fc-2c963f66afa6 not found"
}
```

### Ticket Already Exists
**HTTP 400**
```json
{
  "detail": "Alarm 3fa85f64-5717-4562-b3fc-2c963f66afa6 already has ticket 7b3c1d89-4f23-4a91-8e6f-9c8d7e6f5a4b. Please update the existing ticket instead."
}
```

**Solution:** Check the alarm's `ticket_id` field and update the existing ticket instead.

### Permission Denied
**HTTP 403**
```json
{
  "detail": "Permission denied. Required permission: faults.alarms.write"
}
```

**Solution:** Request `faults.alarms.write` permission from your administrator.

## Best Practices

### 1. Review Before Escalation
- Not all alarms require tickets
- Check for duplicate/correlated alarms
- Verify alarm is not in maintenance window
- Consider customer impact and SLA requirements

### 2. Add Meaningful Context
- Use `additional_notes` to provide operational context
- Include customer communications, site conditions, etc.
- Reference related incidents or tickets

### 3. Set Appropriate Priority
- Override automatic priority mapping when needed
- Consider business impact, not just technical severity
- Critical = immediate response required
- High = same-day response
- Normal = standard SLA
- Low = best-effort

### 4. Assign to Correct Team
- Use `assign_to_user_id` for direct assignment
- Or let ticket service route based on type/priority
- Consider time zones and on-call schedules

### 5. Prevent Ticket Spam
- Don't create tickets for every alarm
- Handle minor issues through alarm workflow
- Use alarm correlation to avoid duplicate tickets
- Acknowledge alarms being worked without tickets

## Database Schema

### Alarm.ticket_id Reference

The `Alarm` model has a `ticket_id` field that stores the UUID of the associated ticket:

```python
class Alarm(BaseModel):
    # ...
    ticket_id: Mapped[UUID] = mapped_column(nullable=True, index=True)
```

**Characteristics:**
- Nullable (not all alarms have tickets)
- Indexed for fast lookups
- One-to-one relationship (one alarm → one ticket)
- Set automatically when ticket is created

**Query Examples:**

```python
# Find alarms with tickets
alarms_with_tickets = await session.execute(
    select(Alarm).where(Alarm.ticket_id.isnot(None))
)

# Find alarms without tickets
alarms_without_tickets = await session.execute(
    select(Alarm).where(Alarm.ticket_id.is_(None))
)

# Get ticket for alarm
alarm = await session.get(Alarm, alarm_id)
if alarm.ticket_id:
    ticket = await session.get(Ticket, alarm.ticket_id)
```

## Migration Notes

### For Existing Deployments

If you have existing code that relied on automatic ticket creation:

1. **Review Alarm Rules**
   - Check `alarm_rules` table for escalation rules
   - Update rules to use new manual process
   - Configure monitoring dashboards

2. **Update Monitoring**
   - Add alerts for `alarm.unacknowledged.manual_action_required` log events
   - Create dashboards for unacknowledged alarms
   - Set up notifications for operators

3. **Train Operators**
   - Document new manual workflow
   - Provide API examples and scripts
   - Update runbooks and procedures

4. **Celery Beat Schedule**
   - The `faults.check_unacknowledged_alarms` task continues to run
   - It now only logs warnings (no automatic tickets)
   - Can be disabled entirely if not needed:

```python
# In celery_config.py - to disable the task completely
beat_schedule = {
    # 'check-unacknowledged-alarms': {  # Commented out
    #     'task': 'faults.check_unacknowledged_alarms',
    #     'schedule': timedelta(minutes=10),
    # },
}
```

## Security Considerations

### RBAC Permissions
- Ticket creation requires `faults.alarms.write` permission
- Ticket service enforces its own permissions
- Cross-tenant access is prevented by tenant isolation

### Audit Trail
- Ticket creation is logged with user ID
- Alarm shows `ticket_id` reference
- Ticket metadata includes alarm references
- All actions are structured-logged for audit

## Related Documentation

- [Fault Management Implementation](./FAULT_MANAGEMENT_IMPLEMENTATION.md)
- [Ticketing System Documentation](./TICKETING_SYSTEM.md)
- [Alarm Correlation Guide](./ALARM_CORRELATION.md)
- [SLA Monitoring](./SLA_MONITORING.md)

## FAQs

**Q: Can I create multiple tickets from one alarm?**
A: No. The system enforces a one-to-one relationship. If you try to create a second ticket, you'll get an error. Update the existing ticket instead.

**Q: What happens to the ticket if the alarm is cleared?**
A: The ticket remains active. Operators should manually resolve the ticket when appropriate. Alarm clearing and ticket resolution are independent workflows.

**Q: Can I create a ticket from a cleared alarm?**
A: Yes, as long as the alarm doesn't already have a ticket. This allows for post-incident documentation.

**Q: How do I find all tickets created from alarms?**
A: Query tickets with `metadata.created_from_alarm = true`:

```python
tickets = await session.execute(
    select(Ticket).where(
        Ticket.metadata["created_from_alarm"].astext == "true"
    )
)
```

**Q: Can I automate ticket creation using alarm rules?**
A: Not directly via rules. However, you can build automation by:
1. Monitoring alarm events
2. Applying your custom logic
3. Calling the manual ticket creation API

This provides flexibility while maintaining control.
