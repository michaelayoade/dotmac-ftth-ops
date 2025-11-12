# Workflow Integration Implementation Summary

## ✅ **Completed: Critical Event Handler Integrations**

### **Phase 1: Order → Installation Ticket** (COMPLETED)

**File:** `src/dotmac/platform/ticketing/handlers.py`

**Implementation:**
- Created event handler: `handle_order_completed_create_installation_ticket()`
- Subscribes to: `order.completed` event
- Automatically creates `INSTALLATION_REQUEST` ticket when order completes

**Key Features:**
- Captures order details (order_number, customer, company)
- Maps order priority to ticket priority
- Includes order metadata (order_id, deployment_instance_id, total_amount)
- Creates audit log for tracking
- Uses system user for automated ticket creation

**Event Flow:**
```
Order.completed →
  Event: order.completed {order_id, tenant_id, deployment_instance_id} →
  Handler: handle_order_completed_create_installation_ticket() →
  Create Ticket {type: INSTALLATION_REQUEST, metadata: {...}} →
  Audit Log
```

---

### **Phase 2: Installation Ticket → Field Job** (COMPLETED)

**File:** `src/dotmac/platform/jobs/handlers.py` (NEW FILE)

**Implementation:**
- Created event handler: `handle_installation_ticket_create_job()`
- Subscribes to: `ticket.created` event
- Filters for `ticket_type == INSTALLATION_REQUEST`
- Automatically creates field service job

**Key Features:**
- Creates job with type: `field_installation`
- Captures all ticket details in job parameters
- Includes service address, customer_id, priority
- Links to original order if available
- Extracts equipment/device information
- Creates audit log for job creation

**Event Flow:**
```
Ticket.created {type: INSTALLATION_REQUEST} →
  Event: ticket.created {ticket_id, ticket_number, ticket_type} →
  Handler: handle_installation_ticket_create_job() →
  Filter: ticket_type == INSTALLATION_REQUEST →
  Create Job {type: field_installation, parameters: {...}} →
  Audit Log
```

---

## 🔄 **Complete Workflow (Current State)**

```
┌─────────────┐
│   SALES     │
│   ORDER     │
└──────┬──────┘
       │ order.completed
       ↓
┌─────────────────────────────────┐
│  Event Handler (Ticketing)      │
│  handle_order_completed_        │
│  create_installation_ticket()   │
└──────┬──────────────────────────┘
       │ Creates INSTALLATION_REQUEST ticket
       ↓
┌─────────────┐
│   TICKET    │
│  CREATED    │
└──────┬──────┘
       │ ticket.created (type=INSTALLATION)
       ↓
┌─────────────────────────────────┐
│  Event Handler (Jobs)           │
│  handle_installation_ticket_    │
│  create_job()                   │
└──────┬──────────────────────────┘
       │ Creates field_installation job
       ↓
┌─────────────┐
│  FIELD JOB  │
│  CREATED    │
└─────────────┘
```

---

## 📊 **Database Changes**

No database migrations required for event handlers.

**Existing Tables Used:**
- `orders` (sales module)
- `tickets` (ticketing module)
- `jobs` (jobs module)

**New Job Type:**
- `field_installation` - Field service installation jobs

---

## 🔌 **Integration Points**

### **Event Bus Subscriptions:**
```python
# Ticketing module
@subscribe("order.completed")
async def handle_order_completed_create_installation_ticket(event: Event)

# Jobs module
@subscribe("ticket.created")
async def handle_installation_ticket_create_job(event: Event)
```

### **Service Dependencies:**
```python
# Ticketing handler uses:
- TicketService.create_ticket()
- AuditService.log_activity()
- Order model (sales)

# Jobs handler uses:
- JobService.create_job()
- AuditService.log_activity()
- Ticket model (ticketing)
```

---

## ⚙️ **Configuration & Setup**

### **Handlers Are Auto-Loaded:**

**Ticketing:** Already loaded via `ticketing/__init__.py`
```python
from . import handlers  # noqa: F401
```

**Jobs:** Added to `jobs/__init__.py`
```python
# Import handlers to register event subscriptions
from dotmac.platform.jobs import handlers  # noqa: F401
```

### **No Additional Configuration Required**

The event handlers automatically register when the modules are imported during application startup.

---

## 📝 **Job Parameters Schema**

When a field installation job is created, it includes:

```json
{
  "ticket_id": "uuid",
  "ticket_number": "TKT-12345",
  "service_address": "123 Main St, Lagos, Nigeria",
  "customer_id": "uuid",
  "priority": "normal|high|urgent",
  "affected_services": ["service1", "service2"],
  "device_serial_numbers": ["SN123", "SN456"],
  "order_id": "uuid",  // If from order
  "order_number": "ORD-12345",  // If from order
  "metadata": {
    // Additional ticket metadata
  }
}
```

---

## 🔍 **Testing the Integration**

### **Test Scenario 1: New Order Completion**
```bash
# 1. Create and complete an order
POST /api/v1/sales/orders
# ... complete provisioning workflow ...

# Expected:
# - order.completed event published
# - Installation ticket auto-created
# - Field job auto-created
# - 2 audit logs created
```

### **Test Scenario 2: Manual Installation Ticket**
```bash
# 1. Create installation ticket manually
POST /api/v1/ticketing/tickets
{
  "ticket_type": "installation_request",
  "subject": "Manual Installation",
  ...
}

# Expected:
# - ticket.created event published
# - Field job auto-created
# - 1 audit log created
```

### **Verification Queries:**
```sql
-- Check ticket was created from order
SELECT * FROM tickets
WHERE metadata->>'order_id' = '<order-uuid>';

-- Check job was created from ticket
SELECT * FROM jobs
WHERE parameters->>'ticket_id' = '<ticket-uuid>';

-- Check audit trail
SELECT * FROM audit_logs
WHERE action IN ('installation_ticket.auto_created', 'field_job.auto_created')
ORDER BY created_at DESC;
```

---

## 🚧 **Next Steps (Still Needed)**

### **Immediate (Next 2-3 Days):**
1. ✅ Order → Ticket (DONE)
2. ✅ Ticket → Job (DONE)
3. **Technician Models** - Create database models for technicians/staff
4. **Technician Assignment** - Build service to assign jobs to available technicians

### **Short-term (Next Week):**
5. **Job Location Tracking** - Add GPS coordinates to jobs
6. **Fiber Map Integration** - Display active jobs on fiber maps
7. **WebSocket Updates** - Real-time job status updates

### **Medium-term (Next 2 Weeks):**
8. **Mobile App Integration** - Technician mobile interface
9. **Route Optimization** - Google Maps integration for routing
10. **Calendar Integration** - Google Calendar sync for appointments

---

## 📌 **Important Notes**

### **Event Handler Execution:**
- All handlers are `async` and non-blocking
- Handlers run in background after event is published
- Failures are logged but don't block the main workflow
- Each handler has try/catch for resilience

### **Tenant Isolation:**
- All event handlers respect tenant_id
- Jobs and tickets are tenant-scoped
- Audit logs include tenant context

### **System User:**
- Automated actions use system user (user_id=0)
- Identifiable in audit logs via `auto_created: true`
- No permissions required for system user

### **Error Handling:**
- Database errors are logged with full stack trace
- Event processing continues even if one handler fails
- All failures are visible in application logs

---

## 🐛 **Debugging**

### **View Event Handler Logs:**
```bash
# Check if handlers were registered
grep "Handler subscribed" logs/app.log

# Check event processing
grep "Handling.*event" logs/app.log

# Check for errors
grep "Failed to" logs/app.log | grep -E "ticket|job"
```

### **Common Issues:**

**Q: Events not triggering handlers?**
- Verify handlers module is imported in `__init__.py`
- Check event_bus is initialized
- Verify event name matches subscription

**Q: Job/Ticket not created?**
- Check database logs for constraint violations
- Verify tenant_id is present in event payload
- Check if ticket_type filter is working

**Q: Missing order/ticket data in job parameters?**
- Verify order model has required fields
- Check ticket metadata structure
- Review payload extraction logic

---

## 📚 **Related Documentation**

- Event Bus: `platform/events/bus.py`
- Job Service: `platform/jobs/service.py`
- Ticket Service: `platform/ticketing/service.py`
- Audit Service: `platform/audit/service.py`

---

## ✏️ **Code Locations**

**New Event Handlers:**
- `src/dotmac/platform/ticketing/handlers.py:577-708` - Order → Ticket handler
- `src/dotmac/platform/jobs/handlers.py` - Ticket → Job handler (NEW FILE)

**Module Initialization:**
- `src/dotmac/platform/jobs/__init__.py:16` - Handlers import added

**Event Publishers:**
- `src/dotmac/platform/sales/service.py:471` - Publishes `order.completed`
- `src/dotmac/platform/ticketing/service.py` - Publishes `ticket.created`

---

## 🎯 **Success Metrics**

✅ **Integration Complete When:**
- Order completion automatically creates installation ticket
- Installation ticket automatically creates field job
- All events are logged in audit trail
- No manual intervention required
- Technicians see jobs in queue

**Current Status: 2/7 Complete (28%)**
- ✅ Order → Ticket integration
- ✅ Ticket → Job integration
- ⏳ Job → Technician assignment (next)
- ⏳ Job → Map visualization (next)
- ⏳ Real-time updates (next)
- ⏳ Mobile interface (future)
- ⏳ Route optimization (future)
