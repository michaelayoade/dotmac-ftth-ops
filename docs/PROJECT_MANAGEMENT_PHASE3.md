# Phase 3: Advanced Project Management Features

## Overview

Phase 3 builds on the foundation from Phase 1 (Projects, Tasks, Teams) and Phase 2 (Template Builder, Sales Automation) to create a complete field service management system with real-time capabilities, scheduling, and mobile support.

## Goals

1. **Field Service Scheduling** - Optimize technician schedules and assignments
2. **Real-time Updates** - WebSocket notifications for status changes
3. **Resource Management** - Track equipment, vehicles, inventory
4. **Time Tracking** - Actual vs estimated time, labor cost tracking
5. **Mobile-First APIs** - Support for field technician mobile apps
6. **Location Tracking** - GPS check-in/out, route optimization

---

## Feature Breakdown

### 1. Field Service Scheduling

**Components:**
- **Schedule Model** - Daily/weekly technician schedules
- **Appointment Slots** - Time blocks for customer appointments
- **Assignment Algorithm** - Smart task assignment based on:
  - Technician skills & certifications
  - Current location & travel time
  - Workload balancing
  - Priority & SLA deadlines
- **Calendar View** - Visual schedule management

**Database Models:**
```python
class TechnicianSchedule:
    - id (UUID)
    - technician_id (FK → Technician)
    - date (Date)
    - shift_start (Time)
    - shift_end (Time)
    - break_start (Time)
    - break_end (Time)
    - status (available, on_leave, sick, busy)
    - location (Point) - Starting location

class TaskAssignment:
    - id (UUID)
    - task_id (FK → Task)
    - technician_id (FK → Technician)
    - scheduled_start (DateTime)
    - scheduled_end (DateTime)
    - actual_start (DateTime, nullable)
    - actual_end (DateTime, nullable)
    - status (scheduled, in_progress, completed, cancelled)
    - travel_time_minutes (Integer)
    - customer_confirmation_required (Boolean)
```

**APIs:**
```
GET  /api/v1/scheduling/technicians/{id}/schedule?date={date}
POST /api/v1/scheduling/assignments
PUT  /api/v1/scheduling/assignments/{id}/reschedule
GET  /api/v1/scheduling/availability?skills={skills}&date={date}
POST /api/v1/scheduling/optimize - AI-powered schedule optimization
```

---

### 2. Real-time Updates (WebSocket)

**Use Cases:**
- Task status changes → Notify project manager
- Team member added → Update all team members
- Equipment assigned → Notify warehouse & technician
- Customer appointment confirmed → Update technician schedule

**Implementation:**
- FastAPI WebSocket endpoints
- Redis pub/sub for multi-instance support
- Channel subscriptions:
  - `project:{project_id}` - Project updates
  - `task:{task_id}` - Task updates
  - `technician:{tech_id}` - Assignment updates
  - `team:{team_id}` - Team updates

**Database Models:**
```python
class ProjectActivity:
    - id (UUID)
    - project_id (FK → Project)
    - task_id (FK → Task, nullable)
    - activity_type (status_change, comment, assignment, etc.)
    - actor_id (User ID)
    - metadata (JSONB)
    - timestamp (DateTime)
```

**WebSocket Events:**
```json
{
  "event": "task.status_changed",
  "task_id": "uuid",
  "old_status": "scheduled",
  "new_status": "in_progress",
  "technician": {...},
  "timestamp": "2025-11-08T12:00:00Z"
}
```

---

### 3. Resource & Equipment Management

**Components:**
- Equipment inventory tracking
- Equipment assignment to tasks/technicians
- Vehicle tracking & maintenance
- Tool checkout system
- Stock level monitoring

**Database Models:**
```python
class Equipment:
    - id (UUID)
    - tenant_id (String)
    - equipment_type (fiber_splicer, otdr, ladder, etc.)
    - serial_number (String)
    - status (available, in_use, maintenance, broken)
    - location (warehouse, vehicle, field)
    - assigned_to (FK → Technician, nullable)
    - last_maintenance (DateTime)
    - next_maintenance (DateTime)

class EquipmentAssignment:
    - id (UUID)
    - equipment_id (FK → Equipment)
    - task_id (FK → Task, nullable)
    - technician_id (FK → Technician, nullable)
    - assigned_at (DateTime)
    - returned_at (DateTime, nullable)
    - condition_out (String)
    - condition_in (String, nullable)

class Vehicle:
    - id (UUID)
    - tenant_id (String)
    - vehicle_number (String)
    - make_model (String)
    - license_plate (String)
    - status (available, in_use, maintenance)
    - assigned_to (FK → Technician, nullable)
    - current_location (Point, nullable)
    - last_location_update (DateTime, nullable)
    - mileage (Integer)
```

**APIs:**
```
GET  /api/v1/resources/equipment?status=available&type={type}
POST /api/v1/resources/equipment/{id}/assign
POST /api/v1/resources/equipment/{id}/return
GET  /api/v1/resources/vehicles/{id}/location
POST /api/v1/resources/vehicles/{id}/update-location
```

---

### 4. Time Tracking & Labor Cost

**Components:**
- Clock in/out for tasks
- Automatic time calculation
- Labor cost calculation
- Overtime tracking
- Break time management

**Database Models:**
```python
class TimeEntry:
    - id (UUID)
    - task_id (FK → Task)
    - technician_id (FK → Technician)
    - start_time (DateTime)
    - end_time (DateTime, nullable)
    - break_minutes (Integer)
    - total_minutes (Integer, computed)
    - is_overtime (Boolean)
    - labor_cost (Decimal, computed)
    - notes (Text)
    - location_in (Point) - GPS location at clock-in
    - location_out (Point, nullable) - GPS location at clock-out

class LaborRate:
    - id (UUID)
    - tenant_id (String)
    - technician_id (FK → Technician, nullable) - Specific tech or null for default
    - skill_level (junior, mid, senior, expert)
    - hourly_rate (Decimal)
    - overtime_multiplier (Decimal) - e.g., 1.5x
    - effective_from (Date)
    - effective_to (Date, nullable)
```

**APIs:**
```
POST /api/v1/time/clock-in
POST /api/v1/time/clock-out
GET  /api/v1/time/entries?task_id={id}
GET  /api/v1/time/summary?technician_id={id}&start_date={date}&end_date={date}
GET  /api/v1/time/labor-costs?project_id={id}
```

---

### 5. Mobile-First APIs

**Requirements:**
- Offline-first support
- GPS location tracking
- Photo/document upload
- Signature capture
- Push notifications

**Mobile Endpoints:**
```
GET  /api/v1/mobile/tasks/assigned - Get today's tasks
POST /api/v1/mobile/tasks/{id}/start
POST /api/v1/mobile/tasks/{id}/complete
POST /api/v1/mobile/tasks/{id}/photos
POST /api/v1/mobile/tasks/{id}/signature
POST /api/v1/mobile/location/update
GET  /api/v1/mobile/sync?last_sync={timestamp} - Sync offline changes
```

**Offline Sync Strategy:**
- Optimistic UI updates
- Local SQLite/IndexedDB storage
- Queue actions when offline
- Sync when connection restored
- Conflict resolution (last-write-wins with timestamp)

---

### 6. Location & GPS Features

**Components:**
- GPS check-in/check-out
- Route optimization
- Travel time calculation
- Geofencing for customer sites
- Location history tracking

**Database Models:**
```python
class LocationHistory:
    - id (UUID)
    - technician_id (FK → Technician)
    - location (Point)
    - timestamp (DateTime)
    - accuracy (Float) - GPS accuracy in meters
    - speed (Float, nullable) - Speed in km/h
    - activity_type (traveling, on_site, break, idle)

class ServiceArea:
    - id (UUID)
    - tenant_id (String)
    - team_id (FK → Team, nullable)
    - name (String)
    - boundary (Polygon/MultiPolygon)
    - priority (Integer) - For overlapping areas
```

**APIs:**
```
POST /api/v1/location/update
GET  /api/v1/location/technicians/nearby?lat={lat}&lng={lng}&radius={km}
POST /api/v1/location/optimize-route - Get optimal route for multiple tasks
GET  /api/v1/location/travel-time?from={lat,lng}&to={lat,lng}
```

---

## Implementation Priority

### Week 1: Scheduling & Assignment
1. Create scheduling models & migrations
2. Implement assignment algorithms
3. Build scheduling APIs
4. Create availability checker

### Week 2: Time Tracking & Resources
1. Create time tracking models
2. Implement clock in/out APIs
3. Create equipment models
4. Build resource management APIs

### Week 3: Real-time & Mobile
1. Implement WebSocket support
2. Create activity stream
3. Build mobile-first APIs
4. Add offline sync support

### Week 4: Location & Optimization
1. Add GPS location tracking
2. Implement route optimization
3. Create geofencing
4. Build travel time calculator

---

## Technical Stack

**Backend:**
- FastAPI WebSocket for real-time
- Redis Pub/Sub for events
- PostGIS for location queries
- Celery for async tasks (route optimization)

**Frontend:**
- React Native for mobile app
- React Leaflet for maps (already installing!)
- TanStack Query for data sync
- WebSocket client for real-time

**Infrastructure:**
- Redis for pub/sub & caching
- PostgreSQL with PostGIS extension
- Firebase/OneSignal for push notifications

---

## Success Metrics

- **Schedule Utilization**: 80%+ technician time utilization
- **On-time Completion**: 90%+ tasks completed within SLA
- **Travel Time**: <20% of total work time
- **Mobile Adoption**: 95%+ field techs using mobile app
- **Real-time Latency**: <500ms for status updates

---

## Next Steps

1. **Start with Scheduling** - Most critical for field ops
2. **Add Time Tracking** - Essential for cost tracking
3. **Implement Real-time** - Improve coordination
4. **Build Mobile APIs** - Enable field work
5. **Add Location** - Optimize routes & travel
