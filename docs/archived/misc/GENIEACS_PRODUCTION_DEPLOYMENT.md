# GenieACS Production Deployment Guide

## Overview

This guide covers the deployment of production-ready GenieACS CPE management features including:
- Database-backed firmware upgrade scheduling
- Mass configuration management
- Background task processing with Celery
- Real-time progress tracking via Redis
- Prometheus metrics and monitoring

## Architecture

```
┌─────────────────┐
│   FastAPI App   │ ─── HTTP API Endpoints
└────────┬────────┘
         │
         ├─ GenieACSServiceDB (service_db.py)
         │  └─ PostgreSQL (models.py)
         │
         ├─ Celery Tasks (tasks.py)
         │  ├─ execute_firmware_upgrade
         │  ├─ execute_mass_config
         │  └─ check_scheduled_upgrades (periodic)
         │
         ├─ Redis Pub/Sub
         │  └─ Real-time progress events
         │
         └─ Prometheus Metrics (metrics.py)
            └─ Success/failure tracking
```

## Prerequisites

1. **PostgreSQL Database**: Running and accessible
2. **Redis**: For Celery broker and pub/sub
3. **Celery Workers**: For background task execution
4. **GenieACS Server**: Running TR-069 ACS

## Step 1: Database Migration

Run the Alembic migration to create required tables:

```bash
# Review the migration
alembic history

# Apply migration
alembic upgrade head

# Verify tables created
psql $DATABASE_URL -c "\dt firmware_*"
psql $DATABASE_URL -c "\dt mass_config_*"
```

### Created Tables

**firmware_upgrade_schedules**:
- `schedule_id` (PK): UUID for schedule
- `tenant_id` (FK): Multi-tenant isolation
- `name`, `description`: Human-readable metadata
- `firmware_file`: Filename on GenieACS
- `device_filter`: JSON query for target devices
- `scheduled_at`: When to execute (timezone-aware)
- `max_concurrent`: Concurrent device limit
- `status`: pending/running/completed/failed

**firmware_upgrade_results**:
- Per-device upgrade results
- Tracks status, error messages, timestamps
- CASCADE delete with schedule

**mass_config_jobs**:
- `job_id` (PK): UUID for job
- `config_changes`: JSON with wifi/lan/wan/custom params
- `dry_run`: Preview mode (string: "true"/"false")
- Device counters: total/completed/failed/pending

**mass_config_results**:
- Per-device configuration results
- Stores `parameters_changed` (JSON)
- CASCADE delete with job

### Indexes

Performance indexes created:
- `ix_firmware_schedules_tenant_status` - Multi-tenant queries
- `ix_firmware_schedules_scheduled_at` - Periodic task lookups
- `ix_firmware_results_schedule_status` - Progress tracking
- `ix_mass_config_jobs_tenant_status` - Job filtering
- `ix_mass_config_results_job_status` - Result aggregation

## Step 2: Configure Celery

### Start Celery Worker

```bash
# Production worker with concurrency
celery -A dotmac.platform.celery_app worker \
  --loglevel=info \
  --concurrency=4 \
  --max-tasks-per-child=100

# Development (single worker)
celery -A dotmac.platform.celery_app worker --loglevel=debug
```

### Start Celery Beat (Scheduler)

Required for periodic task `check_scheduled_upgrades` (runs every minute):

```bash
# Production
celery -A dotmac.platform.celery_app beat \
  --loglevel=info \
  --pidfile=/var/run/celery/beat.pid

# Development
celery -A dotmac.platform.celery_app beat --loglevel=debug
```

### Celery Configuration

The following tasks are registered:

1. **genieacs.execute_firmware_upgrade** (on-demand)
   - Triggered by API or scheduler
   - Max retries: 3
   - Retry delay: 60 seconds

2. **genieacs.execute_mass_config** (on-demand)
   - Triggered by API
   - Max retries: 3
   - Retry delay: 60 seconds

3. **genieacs.check_scheduled_upgrades** (periodic)
   - Runs every 60 seconds
   - Finds schedules where `scheduled_at <= now()` and `status = 'pending'`
   - Triggers `execute_firmware_upgrade` for each

## Step 3: Verify Installation

### 1. Check Database Tables

```bash
psql $DATABASE_URL -c "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE '%firmware%' OR tablename LIKE '%mass_config%';"
```

Expected output:
```
firmware_upgrade_schedules
firmware_upgrade_results
mass_config_jobs
mass_config_results
```

### 2. Verify Celery Tasks

```bash
celery -A dotmac.platform.celery_app inspect registered | grep genieacs
```

Expected output:
```
genieacs.execute_firmware_upgrade
genieacs.execute_mass_config
genieacs.check_scheduled_upgrades
```

### 3. Test API Endpoints

```bash
# Health check
curl -X GET "http://localhost:8000/api/v1/genieacs/health" \
  -H "Authorization: Bearer $TOKEN"

# List firmware schedules
curl -X GET "http://localhost:8000/api/v1/genieacs/firmware-upgrades" \
  -H "Authorization: Bearer $TOKEN"

# List mass config jobs
curl -X GET "http://localhost:8000/api/v1/genieacs/mass-config" \
  -H "Authorization: Bearer $TOKEN"
```

## Step 4: Monitoring Setup

### Prometheus Metrics

The following metrics are exposed at `/metrics`:

**Firmware Upgrade Metrics**:
- `genieacs_firmware_upgrade_schedules_total{tenant_id}` - Total schedules created
- `genieacs_firmware_upgrade_devices_total{tenant_id,status}` - Devices processed
- `genieacs_firmware_upgrade_duration_seconds{tenant_id}` - Execution time histogram
- `genieacs_firmware_upgrade_schedule_status{tenant_id,schedule_id,status}` - Schedule status gauge
- `genieacs_firmware_upgrade_active_schedules{tenant_id}` - Active schedule count

**Mass Config Metrics**:
- `genieacs_mass_config_jobs_total{tenant_id}` - Total jobs created
- `genieacs_mass_config_devices_total{tenant_id,status}` - Devices configured
- `genieacs_mass_config_duration_seconds{tenant_id}` - Execution time histogram
- `genieacs_mass_config_job_status{tenant_id,job_id,status}` - Job status gauge
- `genieacs_mass_config_active_jobs{tenant_id}` - Active job count

**API Metrics**:
- `genieacs_api_requests_total{tenant_id,operation,status}` - API call counter
- `genieacs_api_request_duration_seconds{tenant_id,operation}` - API latency histogram
- `genieacs_task_queue_size{tenant_id,task_type}` - Queue depth gauge

### Prometheus Scrape Configuration

Add to `prometheus.yml`:

```yaml
scrape_configs:
  - job_name: 'dotmac-genieacs'
    static_configs:
      - targets: ['localhost:8000']
    metrics_path: '/metrics'
    scrape_interval: 15s
```

### Example Prometheus Queries

```promql
# Success rate for firmware upgrades
rate(genieacs_firmware_upgrade_devices_total{status="success"}[5m])
/
rate(genieacs_firmware_upgrade_devices_total[5m])

# P95 execution time for mass config jobs
histogram_quantile(0.95, genieacs_mass_config_duration_seconds_bucket)

# Active schedules per tenant
sum by (tenant_id) (genieacs_firmware_upgrade_active_schedules)

# Failed devices in last hour
increase(genieacs_mass_config_devices_total{status="failed"}[1h])
```

### Grafana Dashboard

Example panels:

1. **Firmware Upgrade Success Rate** (Gauge)
   - Query: Success rate formula above
   - Thresholds: 95% green, 90% yellow, <90% red

2. **Active Jobs Timeline** (Time Series)
   - Query: `genieacs_firmware_upgrade_active_schedules`
   - Stacked by tenant_id

3. **Device Processing Rate** (Time Series)
   - Query: `rate(genieacs_firmware_upgrade_devices_total[5m])`
   - Split by status (success/failed)

4. **Execution Duration Heatmap**
   - Query: `genieacs_firmware_upgrade_duration_seconds_bucket`
   - Heatmap visualization

## Step 5: Real-time Progress Tracking

### Redis Pub/Sub Channels

Firmware upgrades publish to: `firmware_upgrade:{schedule_id}`
Mass config publishes to: `mass_config:{job_id}`

### Event Types

**Firmware Upgrade Events**:
```json
{
  "event_type": "upgrade_started",
  "timestamp": "2025-10-14T22:30:00Z",
  "schedule_id": "abc123",
  "total_devices": 50
}

{
  "event_type": "device_completed",
  "timestamp": "2025-10-14T22:31:00Z",
  "device_id": "CPE-001",
  "status": "success",
  "completed": 10,
  "total": 50
}

{
  "event_type": "upgrade_completed",
  "timestamp": "2025-10-14T22:45:00Z",
  "schedule_id": "abc123",
  "total": 50,
  "completed": 48,
  "failed": 2
}
```

**Mass Config Events**:
```json
{
  "event_type": "config_started",
  "timestamp": "2025-10-14T22:30:00Z",
  "job_id": "def456",
  "total_devices": 100
}

{
  "event_type": "device_configured",
  "timestamp": "2025-10-14T22:31:00Z",
  "device_id": "CPE-002",
  "status": "success",
  "parameters_changed": {
    "InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.SSID": "NewNetwork"
  },
  "completed": 20,
  "total": 100
}
```

### Subscribe via Redis CLI

```bash
# Monitor firmware upgrade
redis-cli SUBSCRIBE firmware_upgrade:abc123

# Monitor mass config
redis-cli SUBSCRIBE mass_config:def456
```

### Subscribe via Python

```python
import asyncio
import json
from redis.asyncio import Redis

async def monitor_progress(schedule_id: str):
    redis = Redis.from_url("redis://localhost:6379/0", decode_responses=True)
    pubsub = redis.pubsub()

    await pubsub.subscribe(f"firmware_upgrade:{schedule_id}")

    async for message in pubsub.listen():
        if message["type"] == "message":
            event = json.loads(message["data"])
            print(f"{event['event_type']}: {event}")

            if event["event_type"] in ["upgrade_completed", "upgrade_failed"]:
                break

    await pubsub.unsubscribe()
    await redis.close()

asyncio.run(monitor_progress("abc123"))
```

## Usage Examples

### 1. Schedule Firmware Upgrade

```bash
curl -X POST "http://localhost:8000/api/v1/genieacs/firmware-upgrades" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "ONU Firmware v2.3.1 Rollout",
    "description": "Upgrade all ONUs to latest stable release",
    "firmware_file": "onu_firmware_v2.3.1.bin",
    "file_type": "1 Firmware Upgrade Image",
    "device_filter": {
      "model": "ONU-1000",
      "firmware_version": {"$lt": "2.3.1"}
    },
    "scheduled_at": "2025-10-15T02:00:00Z",
    "timezone": "America/New_York",
    "max_concurrent": 5
  }'
```

Response:
```json
{
  "schedule_id": "abc123-def456-ghi789",
  "name": "ONU Firmware v2.3.1 Rollout",
  "status": "pending",
  "scheduled_at": "2025-10-15T02:00:00Z",
  "created_at": "2025-10-14T22:30:00Z",
  "total_devices": 0
}
```

### 2. Execute Immediate Upgrade

```bash
curl -X POST "http://localhost:8000/api/v1/genieacs/firmware-upgrades/abc123-def456-ghi789/execute" \
  -H "Authorization: Bearer $TOKEN"
```

Response:
```json
{
  "schedule_id": "abc123-def456-ghi789",
  "status": "running",
  "started_at": "2025-10-14T22:31:00Z",
  "message": "Firmware upgrade execution started"
}
```

### 3. Create Mass Configuration Job (Dry Run)

```bash
curl -X POST "http://localhost:8000/api/v1/genieacs/mass-config" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Update WiFi SSID - Preview",
    "device_filter": {
      "tags": ["residential"],
      "model": "CPE-500"
    },
    "wifi": {
      "ssid": "MyISP-Fiber",
      "password": "SecurePass123",
      "channel": 6,
      "encryption": "WPA2-PSK"
    },
    "dry_run": true
  }'
```

Response:
```json
{
  "job_id": "xyz789-abc123",
  "name": "Update WiFi SSID - Preview",
  "status": "pending",
  "dry_run": "true",
  "total_devices": 150,
  "preview": {
    "affected_devices": 150,
    "parameters_to_change": {
      "InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.SSID": "MyISP-Fiber",
      "InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.PreSharedKey.1.KeyPassphrase": "SecurePass123"
    }
  }
}
```

### 4. Execute Mass Configuration

```bash
curl -X POST "http://localhost:8000/api/v1/genieacs/mass-config" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Update WiFi SSID - PRODUCTION",
    "device_filter": {
      "tags": ["residential"],
      "model": "CPE-500"
    },
    "wifi": {
      "ssid": "MyISP-Fiber",
      "password": "SecurePass123",
      "channel": 6
    },
    "dry_run": false
  }'
```

### 5. Monitor Job Progress

```bash
# Get schedule status
curl -X GET "http://localhost:8000/api/v1/genieacs/firmware-upgrades/abc123-def456-ghi789" \
  -H "Authorization: Bearer $TOKEN"

# Get job status
curl -X GET "http://localhost:8000/api/v1/genieacs/mass-config/xyz789-abc123" \
  -H "Authorization: Bearer $TOKEN"
```

Response:
```json
{
  "schedule_id": "abc123-def456-ghi789",
  "name": "ONU Firmware v2.3.1 Rollout",
  "status": "running",
  "scheduled_at": "2025-10-15T02:00:00Z",
  "started_at": "2025-10-14T22:31:00Z",
  "total_devices": 50,
  "completed_devices": 35,
  "failed_devices": 2,
  "pending_devices": 13,
  "results": [
    {
      "device_id": "CPE-001",
      "status": "success",
      "started_at": "2025-10-14T22:31:10Z",
      "completed_at": "2025-10-14T22:33:45Z"
    },
    {
      "device_id": "CPE-002",
      "status": "failed",
      "error_message": "Device offline",
      "started_at": "2025-10-14T22:31:15Z",
      "completed_at": "2025-10-14T22:31:45Z"
    }
  ]
}
```

### 6. Cancel Running Job

```bash
# Cancel firmware upgrade
curl -X POST "http://localhost:8000/api/v1/genieacs/firmware-upgrades/abc123/cancel" \
  -H "Authorization: Bearer $TOKEN"

# Cancel mass config
curl -X POST "http://localhost:8000/api/v1/genieacs/mass-config/xyz789/cancel" \
  -H "Authorization: Bearer $TOKEN"
```

## Troubleshooting

### Issue: Schedules not executing

**Check periodic task**:
```bash
celery -A dotmac.platform.celery_app inspect active | grep check_scheduled_upgrades
```

**Verify Celery Beat is running**:
```bash
ps aux | grep "celery.*beat"
```

**Check schedule timestamps**:
```sql
SELECT schedule_id, name, scheduled_at, status
FROM firmware_upgrade_schedules
WHERE status = 'pending' AND scheduled_at <= NOW();
```

### Issue: Tasks stuck in pending

**Check Celery workers**:
```bash
celery -A dotmac.platform.celery_app inspect active_queues
celery -A dotmac.platform.celery_app inspect stats
```

**Check Redis connection**:
```bash
redis-cli PING
redis-cli INFO clients
```

**Check task queue depth**:
```bash
celery -A dotmac.platform.celery_app inspect reserved
```

### Issue: Progress events not received

**Verify Redis pub/sub**:
```bash
redis-cli PUBSUB CHANNELS "firmware_upgrade:*"
redis-cli PUBSUB CHANNELS "mass_config:*"
```

**Check Redis logs**:
```bash
redis-cli MONITOR
```

### Issue: High failure rate

**Check Prometheus metrics**:
```bash
curl http://localhost:8000/metrics | grep genieacs_firmware_upgrade_devices_total
```

**Review error messages**:
```sql
SELECT device_id, error_message, COUNT(*)
FROM firmware_upgrade_results
WHERE status = 'failed'
GROUP BY device_id, error_message
ORDER BY COUNT(*) DESC
LIMIT 10;
```

**Check GenieACS server connectivity**:
```bash
curl -X GET "http://localhost:8000/api/v1/genieacs/health" \
  -H "Authorization: Bearer $TOKEN"
```

## Performance Tuning

### Concurrency Settings

**Low concurrency (conservative)**:
- `max_concurrent: 5` - For large firmware files
- Prevents network saturation
- Slower but safer

**High concurrency (aggressive)**:
- `max_concurrent: 20` - For small config changes
- Faster completion
- Higher GenieACS load

### Celery Worker Tuning

```bash
# More workers for high throughput
celery -A dotmac.platform.celery_app worker --concurrency=8

# Dedicated queues
celery -A dotmac.platform.celery_app worker \
  --queues=genieacs_firmware,genieacs_config \
  --concurrency=4
```

### Database Connection Pool

Update `settings.py`:
```python
SQLALCHEMY_POOL_SIZE = 20  # Default: 5
SQLALCHEMY_MAX_OVERFLOW = 10  # Default: 10
```

### Redis Tuning

Update `redis.conf`:
```
maxclients 10000
maxmemory 2gb
maxmemory-policy allkeys-lru
```

## Security Considerations

1. **Firmware File Validation**
   - Verify file exists on GenieACS before creating schedule
   - Validate file hash/checksum

2. **Device Filter Validation**
   - Sanitize JSON queries to prevent injection
   - Limit query complexity

3. **Rate Limiting**
   - Limit concurrent schedules per tenant
   - Throttle API endpoints

4. **Audit Logging**
   - Log all schedule creation/execution
   - Track who initiated mass config jobs

5. **Rollback Strategy**
   - Keep previous firmware versions available
   - Implement automatic rollback on high failure rate

## Production Checklist

- [ ] Database migration applied (`alembic upgrade head`)
- [ ] Celery worker running with appropriate concurrency
- [ ] Celery beat running for periodic tasks
- [ ] Redis accessible and configured for pub/sub
- [ ] Prometheus scraping `/metrics` endpoint
- [ ] Grafana dashboards created for monitoring
- [ ] Alerting configured for high failure rates
- [ ] Log aggregation configured (e.g., ELK, Loki)
- [ ] Backup strategy for schedules and results
- [ ] Rollback procedures documented
- [ ] Load testing completed
- [ ] Security audit completed
- [ ] Documentation updated

## Support

For issues or questions:
- GitHub: https://github.com/your-org/dotmac-ftth-ops/issues
- Documentation: https://docs.dotmac.com/genieacs
- Slack: #genieacs-support
