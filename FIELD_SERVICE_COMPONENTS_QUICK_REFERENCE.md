# Field Service Components - Quick Reference Guide

## Existing Components to Leverage

### Backend Models You Can Use

| Component | Location | Purpose | Extension Needed |
|-----------|----------|---------|------------------|
| `Job` | `src/dotmac/platform/jobs/models.py` | Track field service jobs | Add technician_id, location_id, appointment_datetime |
| `ScheduledJob` | `src/dotmac/platform/jobs/models.py` | Recurring appointments | Use as-is for maintenance visits |
| `JobChain` | `src/dotmac/platform/jobs/models.py` | Multi-step installations | Use for complex service workflows |
| `Ticket` | `src/dotmac/platform/ticketing/models.py` | Installation/service requests | Already has INSTALLATION_REQUEST type |
| `Workflow` | `src/dotmac/platform/workflows/models.py` | Service workflow templates | Define for standard installations |
| `Notification` | `src/dotmac/platform/notifications/models.py` | Tech notifications | Supports SMS/email/push |

### Backend Services You Can Use

| Service | Location | Use For |
|---------|----------|---------|
| `JobService` | `src/dotmac/platform/jobs/service.py` | Create, track, update field jobs |
| `SchedulerService` | `src/dotmac/platform/jobs/scheduler_service.py` | Schedule appointments |
| `NotificationService` | `src/dotmac/platform/communications/` | Send SMS/email to technicians |
| `TicketService` | `src/dotmac/platform/ticketing/service.py` | Assignment & routing |
| `WorkflowService` | `src/dotmac/platform/workflows/service.py` | Execute installation workflows |

### Frontend Hooks You Can Use

| Hook | Location | Purpose |
|------|----------|---------|
| `useJobs()` | `frontend/apps/isp-ops-app/hooks/useJobs.ts` | List & track jobs |
| `useCancelJob()` | `frontend/apps/isp-ops-app/hooks/useJobs.ts` | Cancel job assignment |
| `useTicketing()` | `frontend/apps/isp-ops-app/hooks/useTicketing.ts` | Ticket operations |
| `useCommunications()` | `frontend/apps/isp-ops-app/hooks/useCommunications.ts` | Send notifications |
| `useRealtime()` | `frontend/apps/isp-ops-app/hooks/useRealtime.ts` | WebSocket updates |
| `useScheduledJobs()` | `frontend/apps/isp-ops-app/hooks/useScheduler.ts` | Scheduled appointments |

---

## Key Connections to Existing Systems

### Real-Time Updates
- **WebSocket:** `src/dotmac/platform/realtime/websocket_authenticated.py`
- **Publisher:** Use `publish_job_update()` from realtime module
- **Use Case:** Dispatch updates, location tracking, status changes

### Event System
- **Domain Events:** `src/dotmac/platform/core/domain_event_dispatcher.py`
- **Event Handlers:** `src/dotmac/platform/workflows/event_handlers.py`
- **Use Case:** Job assigned → Send SMS; Tech arrived → Update customer; Job completed → Close ticket

### Async Tasks
- **Celery:** `src/dotmac/platform/celery_app.py`
- **Queues:** default, high_priority, low_priority
- **Use Case:** Dispatch optimization, route calculation, reminder emails

### File Storage
- **MinIO:** `src/dotmac/platform/file_storage/service.py`
- **Use Case:** Site survey photos, before/after images, service reports

### Multi-Tenancy
- **Tenant Context:** Available throughout all models
- **Isolation:** All queries filter by tenant_id
- **Perfect for:** Each ISP tenant has their own technicians, service areas, jobs

---

## What You Need to Build

### 1. Database Tables (Priority: CRITICAL)
```python
# Models to create:
- TechnicianProfile (technician details, skills, availability)
- ServiceArea (geographic boundaries, tech assignments)
- Appointment (customer appointments, not system scheduled jobs)
- WorkOrder (extends Job with field service specifics)
- LocationHistory (GPS tracking of technicians)
- WorkOrderAttachment (photos, documents)

# Fields to add to Job model:
- technician_id (FK to TechnicianProfile)
- location_id (FK to ServiceArea)
- appointment_datetime (when job is scheduled)
- estimated_duration_minutes (how long job should take)
- work_order_template_id (reference to predefined work order)
```

### 2. Backend Services (Priority: CRITICAL)
```python
# New services to create:
- DispatchService (assign jobs to available technicians)
- TechnicianService (manage technician profiles, availability, skills)
- RouteOptimizationService (geographic routing, cluster assignments)
- AppointmentService (customer booking, confirmation)
- LocationService (GPS tracking, service area validation)
- WorkOrderService (generate work orders from jobs)

# Extend existing services:
- JobService.dispatch(technician_id) 
- SchedulerService.create_appointment() for customer-facing bookings
- NotificationService for SMS to techs
```

### 3. API Endpoints (Priority: HIGH)
```python
# Job-based endpoints:
POST   /jobs/{job_id}/assign/{technician_id}
GET    /jobs?technician_id=X&status=pending
PUT    /jobs/{job_id}/location (GPS update)
PUT    /jobs/{job_id}/signature (work completion)

# Technician endpoints:
GET    /technicians (available for dispatch)
GET    /technicians/{id}/availability
GET    /technicians/{id}/location (real-time)

# Appointment endpoints:
POST   /appointments (customer booking)
GET    /appointments/availability (open slots)
PUT    /appointments/{id}/confirm

# Work order endpoints:
POST   /work-orders (create from job)
GET    /work-orders/{id}/status
POST   /work-orders/{id}/complete
```

### 4. Frontend Pages (Priority: HIGH)
```typescript
// Pages to build:
/dashboard/field-service/dispatcher      // Dispatcher dashboard
/dashboard/field-service/technicians     // Tech availability
/dashboard/field-service/appointments    // Appointment calendar
/dashboard/field-service/work-orders     // Work order detail

// Mobile-specific:
/mobile/technician/jobs                  // Jobs for signed-in tech
/mobile/technician/navigation            // Maps & directions
/mobile/customer/book-appointment        // Self-service booking

// Hooks to create:
useDispatch()              // Get unassigned jobs
useTechnicians()           // Get available techs
useAppointments()          // Manage appointments
useWorkOrder()             // Work order detail
useLocationTracking()      // Real-time location
useRouteOptimization()     // Smart routing
```

### 5. Integrations (Priority: MEDIUM)
```python
# External APIs:
- Maps (Google Maps / Mapbox) for routing & location
- SMS Gateway (Twilio / Vonage) for tech notifications
- Authentication (existing) for mobile app
- Push Notifications (Firebase) for assignment alerts
```

---

## Implementation Sequence

### Week 1: Database & Models
1. Create migration files for new tables
2. Create SQLAlchemy models
3. Add fields to existing Job model
4. Test model relationships

### Week 2: Backend Services
1. Implement TechnicianService
2. Implement DispatchService (basic version)
3. Implement AppointmentService
4. Add event handlers for job assignments

### Week 3: API Layer
1. Create routers for new endpoints
2. Add authentication/authorization
3. Add GraphQL types & queries
4. Write integration tests

### Week 4: Frontend - Admin/Dispatch
1. Build dispatcher dashboard
2. Build technician availability view
3. Build work order list
4. Add real-time updates via WebSocket

### Week 5: Frontend - Customer
1. Build appointment booking UI
2. Build availability calendar
3. Add confirmation flow
4. Integrate notifications

### Week 6: Mobile & Advanced Features
1. Mobile-responsive design
2. Real-time location tracking
3. Route optimization
4. Site survey photo capture

### Week 7: Integration & Testing
1. Maps integration
2. SMS notifications
3. End-to-end testing
4. Performance optimization

### Week 8: Deployment & Polish
1. Documentation
2. Bug fixes
3. Performance tuning
4. Final QA

---

## File Locations Reference

### Backend
- Job system: `/src/dotmac/platform/jobs/`
- Workflows: `/src/dotmac/platform/workflows/`
- Orchestration: `/src/dotmac/platform/orchestration/`
- Ticketing: `/src/dotmac/platform/ticketing/`
- Notifications: `/src/dotmac/platform/notifications/`
- Communications: `/src/dotmac/platform/communications/`
- Real-time: `/src/dotmac/platform/realtime/`
- File Storage: `/src/dotmac/platform/file_storage/`

### Frontend
- ISP App: `/frontend/apps/isp-ops-app/`
- Hooks: `/frontend/apps/isp-ops-app/hooks/`
- Types: `/frontend/apps/isp-ops-app/types/`
- Components: `/frontend/apps/isp-ops-app/components/`
- Pages: `/frontend/apps/isp-ops-app/app/dashboard/`

### Database
- Migrations: `/alembic/versions/`
- GraphQL: `/src/dotmac/platform/graphql/`

---

## Critical Success Factors

1. **Dispatch Engine** - The most important custom component. This is what differentiates your field service solution.

2. **Real-Time Updates** - Technicians need live job assignments and customers need live status.

3. **Geographic System** - Service areas and routing are central to field service operations.

4. **Mobile Experience** - Technicians work in the field. Mobile must be excellent.

5. **Multi-Tenancy** - Ensure every new table and service properly isolates by tenant_id.

6. **Notification Integration** - SMS to techs for assignments and confirmations is essential.

---

## Testing Strategy

### Unit Tests
- Dispatch algorithm correctness
- Technician availability calculation
- Route optimization logic

### Integration Tests
- Job → Assignment → Notification flow
- Appointment → Confirmation → SMS flow
- Work order → Completion → Invoice flow

### End-to-End Tests
- Dispatcher creates job → assigns tech → tech accepts → customer notified
- Customer books appointment → receives confirmation → reminder
- Tech completes job → photos uploaded → work order closed

---

## Performance Considerations

1. **Real-time location updates** - Use WebSocket with batching, not individual updates
2. **Dispatch algorithm** - Cache technician availability, precompute service areas
3. **Database indexes** - Add indexes on technician_id, status, appointment_datetime
4. **Maps API calls** - Cache service area boundaries, batch geocoding requests
5. **File uploads** - Stream directly to MinIO, don't buffer in memory

