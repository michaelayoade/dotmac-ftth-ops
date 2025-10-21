# Alarm Archival to MinIO Cold Storage

**Status**: Implementation Complete
**Last Updated**: 2025-10-15
**Component**: Fault Management

---

## Overview

The alarm archival system automatically archives old cleared alarms to MinIO (S3-compatible) cold storage before deletion. This ensures compliance with data retention policies, enables historical analysis, and maintains a complete audit trail while keeping the operational database lean.

---

## Architecture

### System Components

```
┌─────────────────┐
│  Celery Task    │
│  (Daily)        │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────┐
│  cleanup_old_cleared_alarms()   │
│  - Query cleared alarms > 90d   │
│  - Group by tenant              │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│  AlarmArchivalService           │
│  - Serialize alarms             │
│  - Compress with gzip           │
│  - Upload to MinIO              │
│  - Generate manifest            │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│  MinIO Storage                  │
│  Bucket: dotmac-archives        │
│  Path: alarms/{tenant}/year=... │
└─────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│  Database Cleanup               │
│  - Delete archived alarms       │
│  - Commit transaction           │
└─────────────────────────────────┘
```

### Storage Structure

```
dotmac-archives/
└── alarms/
    └── {tenant_id}/
        └── year={YYYY}/
            └── month={MM}/
                └── day={DD}/
                    ├── alarms_{timestamp}.json.gz      # Compressed alarm data
                    └── alarms_{timestamp}_manifest.json # Archive metadata
```

---

## Features

### ✅ Implemented Features

1. **Automatic Daily Archival**
   - Scheduled Celery task runs daily
   - Configurable retention period (default: 90 days)
   - Archives cleared alarms older than retention period

2. **Compression**
   - gzip compression (level 9) for storage efficiency
   - Typical compression ratio: 60-70% savings
   - Automatic decompression on retrieval

3. **Tenant Isolation**
   - Archives stored per-tenant
   - Access control enforced by MinIO
   - Independent archival per tenant

4. **Archive Manifests**
   - Metadata for each archive batch
   - Severity and source breakdowns
   - Compression statistics
   - Archive validation data

5. **Fault Tolerance**
   - Continues on tenant failures
   - Detailed error logging
   - Rollback on database errors

6. **Partitioning**
   - Partitioned by date (year/month/day)
   - Easy navigation and cleanup
   - Supports lifecycle policies

---

## Configuration

### Environment Variables

```bash
# MinIO Configuration (in .env)
STORAGE__ENDPOINT=localhost:9000
STORAGE__ACCESS_KEY=minioadmin
STORAGE__SECRET_KEY=minioadmin123
STORAGE__BUCKET=dotmac-archives
STORAGE__USE_SSL=false

# Fault Management & Archival Configuration
FAULT_MANAGEMENT__ALARM_RETENTION_DAYS=90           # Days before archival (default: 90)
FAULT_MANAGEMENT__ARCHIVE_TIME_HOUR=2               # Hour to run archival (default: 2 AM)
FAULT_MANAGEMENT__ARCHIVE_TIME_MINUTE=0             # Minute to run archival (default: 0)
FAULT_MANAGEMENT__ARCHIVE_BATCH_SIZE=1000           # Max alarms per batch (default: 1000)
FAULT_MANAGEMENT__ARCHIVE_COMPRESSION_LEVEL=9       # Gzip level 1-9 (default: 9)
FAULT_MANAGEMENT__CORRELATION_WINDOW_SECONDS=300    # Correlation window (default: 5 min)
FAULT_MANAGEMENT__ESCALATION_TIMEOUT_MINUTES=30     # Escalation timeout (default: 30 min)
```

### Configuration Details

#### Archival Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `alarm_retention_days` | 90 | Number of days to retain cleared alarms before archival |
| `archive_time_hour` | 2 | Hour of day (0-23) to run daily archival |
| `archive_time_minute` | 0 | Minute of hour to run archival |
| `archive_batch_size` | 1000 | Maximum number of alarms to archive in one batch |
| `archive_compression_level` | 9 | Gzip compression level (1=fastest, 9=best compression) |

#### Tuning Guidelines

**Retention Period** (`alarm_retention_days`):
- **Short (30 days)**: Less storage, faster queries, good for high-volume systems
- **Standard (90 days)**: Recommended default, balances storage and accessibility
- **Long (180+ days)**: Better for compliance, requires more storage

**Archive Time** (`archive_time_hour`/`minute`):
- Schedule during off-peak hours (typically 2-4 AM)
- Avoid overlapping with backup windows
- Consider timezone (UTC by default)

**Compression Level** (`archive_compression_level`):
- **Level 1-3**: Faster compression, larger files
- **Level 6**: Balanced (good for real-time)
- **Level 9**: Maximum compression, slower (recommended for cold storage)

**Batch Size** (`archive_batch_size`):
- **Small (500)**: Lower memory usage, more API calls
- **Medium (1000)**: Recommended default
- **Large (5000+)**: Fewer API calls, higher memory usage
```

### Docker Compose Setup

```yaml
# MinIO service (already in docker-compose.yml)
minio:
  image: minio/minio:latest
  container_name: dotmac-minio
  command: server /data --console-address ":9001"
  environment:
    MINIO_ROOT_USER: minioadmin
    MINIO_ROOT_PASSWORD: minioadmin123
  ports:
    - "9000:9000"  # API
    - "9001:9001"  # Console
  volumes:
    - minio_data:/data
  profiles:
    - storage
```

### Start MinIO

```bash
# Start MinIO with storage profile
docker compose --profile storage up -d minio

# Access MinIO Console
open http://localhost:9001
# Login: minioadmin / minioadmin123
```

---

## Usage

### Automatic Archival (Celery Task)

The archival task runs automatically via Celery Beat:

```python
# Scheduled in celery beat configuration
from celery.schedules import crontab

beat_schedule = {
    'cleanup-old-cleared-alarms': {
        'task': 'faults.cleanup_old_cleared_alarms',
        'schedule': crontab(hour=2, minute=0),  # Daily at 2 AM
        'kwargs': {'days': 90},  # Archive alarms > 90 days old
    },
}
```

### Manual Archival

```python
from dotmac.platform.fault_management.tasks import cleanup_old_cleared_alarms

# Archive alarms older than 90 days (default)
result = cleanup_old_cleared_alarms(days=90)

# Archive alarms older than 30 days
result = cleanup_old_cleared_alarms(days=30)

# Result structure
{
    "alarms_cleaned": 150,       # Number deleted from database
    "alarms_archived": 150,      # Number archived to MinIO
    "cutoff_days": 90,
    "tenant_count": 3,           # Number of tenants processed
    "archive_manifests": [
        {
            "tenant_id": "tenant-123",
            "alarm_count": 75,
            "archive_path": "alarms/tenant-123/year=2025/month=01/day=15/alarms_20250115_020000.json.gz",
            "compression_ratio": 0.35
        },
        # ... more tenants
    ]
}
```

### Programmatic Archival

```python
from dotmac.platform.fault_management.archival import AlarmArchivalService
from dotmac.platform.db import get_async_session
from datetime import datetime, timedelta, UTC

# Create archival service
archival_service = AlarmArchivalService()

# Archive alarms
async with get_async_session() as session:
    # Fetch alarms to archive
    cutoff_date = datetime.now(UTC) - timedelta(days=90)
    alarms = await fetch_old_cleared_alarms(session, cutoff_date)

    # Archive to MinIO
    manifest = await archival_service.archive_alarms(
        alarms=alarms,
        tenant_id="tenant-123",
        cutoff_date=cutoff_date,
        session=session,
    )

    print(f"Archived {manifest.alarm_count} alarms")
    print(f"Archive path: {manifest.archive_path}")
    print(f"Compression ratio: {manifest.compression_ratio}")
```

### Retrieving Archived Alarms

```python
from dotmac.platform.fault_management.archival import AlarmArchivalService

archival_service = AlarmArchivalService()

# List available archives for tenant
archives = await archival_service.list_archives(
    tenant_id="tenant-123",
)

print(f"Found {len(archives)} archives")
for archive_path in archives:
    print(f"  - {archive_path}")

# Retrieve specific archive
alarms = await archival_service.retrieve_archived_alarms(
    tenant_id="tenant-123",
    archive_path="alarms/tenant-123/year=2025/month=01/day=15/alarms_20250115_020000.json.gz",
)

print(f"Retrieved {len(alarms)} alarms")
for alarm in alarms:
    print(f"  - {alarm['alarm_id']}: {alarm['title']}")
```

---

## Archive Data Structure

### Archived Alarm Format

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "tenant_id": "tenant-123",
  "alarm_id": "ALM-2025-001234",
  "severity": "critical",
  "status": "cleared",
  "source": "network_device",
  "alarm_type": "LINK_DOWN",
  "title": "Link Down on Port 1",
  "description": "Network link down detected on critical uplink",
  "message": "Interface GigabitEthernet0/1 is down",
  "resource_type": "device",
  "resource_id": "device-olt-core-01",
  "resource_name": "OLT-CORE-01",
  "customer_id": "c1234567-e89b-12d3-a456-426614174000",
  "customer_name": "Acme Corporation",
  "subscriber_count": 150,
  "correlation_id": "corr-550e8400",
  "correlation_action": "root_cause",
  "parent_alarm_id": null,
  "is_root_cause": true,
  "first_occurrence": "2024-10-15T10:30:00Z",
  "last_occurrence": "2024-10-15T10:35:00Z",
  "occurrence_count": 3,
  "acknowledged_at": "2024-10-15T10:36:00Z",
  "cleared_at": "2024-10-15T11:00:00Z",
  "resolved_at": "2024-10-15T11:05:00Z",
  "assigned_to": "user-noc-operator",
  "assigned_by": "user-noc-manager",
  "archived_at": "2025-01-15T02:00:00Z",
  "archived_by": "system"
}
```

### Archive Manifest Format

```json
{
  "tenant_id": "tenant-123",
  "archive_date": "2025-01-15T02:00:00Z",
  "alarm_count": 75,
  "cutoff_date": "2024-10-17T00:00:00Z",
  "severity_breakdown": {
    "critical": 15,
    "major": 25,
    "minor": 30,
    "warning": 5
  },
  "source_breakdown": {
    "network_device": 40,
    "cpe": 20,
    "monitoring": 10,
    "service": 5
  },
  "total_size_bytes": 45678,
  "compression_ratio": 0.35,
  "archive_path": "alarms/tenant-123/year=2025/month=01/day=15/alarms_20250115_020000.json.gz",
  "manifest_version": "1.0"
}
```

---

## Retention Policies

### Database Retention

- **Active Alarms**: Retained indefinitely
- **Acknowledged Alarms**: Retained until cleared
- **Cleared Alarms**: Retained for 90 days (configurable)

### Archive Retention

Configure MinIO lifecycle policies for long-term retention:

```xml
<!-- MinIO Lifecycle Policy Example -->
<LifecycleConfiguration>
  <Rule>
    <ID>archive-transition</ID>
    <Status>Enabled</Status>
    <Prefix>alarms/</Prefix>

    <!-- Transition to cheaper storage after 1 year -->
    <Transition>
      <Days>365</Days>
      <StorageClass>GLACIER</StorageClass>
    </Transition>

    <!-- Delete after 7 years (compliance requirement) -->
    <Expiration>
      <Days>2555</Days>
    </Expiration>
  </Rule>
</LifecycleConfiguration>
```

---

## Monitoring

### Metrics to Track

1. **Archival Success Rate**
   - Monitor successful vs. failed archival operations
   - Track per-tenant success rates

2. **Archive Size**
   - Monitor total archive storage usage
   - Track compression ratios

3. **Processing Time**
   - Time to archive alarms
   - Time to compress data
   - Time to upload to MinIO

4. **Database Cleanup**
   - Number of alarms cleaned per run
   - Database size reduction

### Log Queries

```python
# Successful archival
logger.info(
    "alarm_archival.complete",
    tenant_id=tenant_id,
    alarm_count=len(alarms),
    archive_path=archive_path,
    compression_ratio=0.35,
)

# Failed archival
logger.error(
    "alarm_archival.upload_failed",
    tenant_id=tenant_id,
    alarm_count=len(alarms),
    error=str(e),
)
```

### Grafana Dashboards

Create dashboards to monitor:
- Daily archival volume
- Archive storage growth
- Compression efficiency
- Failure rates by tenant

---

## Troubleshooting

### Archive Upload Failed

**Symptoms**: Alarms not archived, error in logs

**Possible Causes**:
1. MinIO not running
2. Incorrect credentials
3. Network connectivity issues
4. Bucket doesn't exist

**Resolution**:
```bash
# Check MinIO is running
docker ps | grep minio

# Verify MinIO is accessible
curl http://localhost:9000/minio/health/live

# Check MinIO logs
docker logs dotmac-minio

# Verify bucket exists
mc ls myminio/dotmac-archives  # Using mc (MinIO Client)

# Create bucket if missing
mc mb myminio/dotmac-archives
```

### Compression Ratio Too Low

**Symptoms**: Archive files larger than expected

**Possible Causes**:
1. Data already compressed
2. Binary fields in alarms
3. Low redundancy in data

**Resolution**:
- Review alarm data structure
- Consider alternative compression algorithms
- Adjust gzip compression level

### Retrieval Fails

**Symptoms**: Cannot retrieve archived alarms

**Possible Causes**:
1. Archive path incorrect
2. Permissions issue
3. Corrupted archive file

**Resolution**:
```python
# Verify archive exists
archives = await archival_service.list_archives(tenant_id)
print(archives)

# Test decompression manually
import gzip
with gzip.open(archive_file, 'rb') as f:
    data = f.read()
```

### Database Not Cleaned

**Symptoms**: Old alarms still in database after archival

**Possible Causes**:
1. Archival failed
2. Transaction not committed
3. Delete operation failed

**Resolution**:
- Check logs for deletion errors
- Verify transaction commits
- Run manual cleanup if needed

---

## Performance Optimization

### Batch Size

```python
# Process alarms in batches for large datasets
BATCH_SIZE = 1000

for i in range(0, len(alarms), BATCH_SIZE):
    batch = alarms[i:i + BATCH_SIZE]
    await archival_service.archive_alarms(
        alarms=batch,
        tenant_id=tenant_id,
        cutoff_date=cutoff_date,
        session=session,
    )
```

### Parallel Processing

```python
# Archive multiple tenants in parallel
import asyncio

tasks = [
    archival_service.archive_alarms(
        alarms=tenant_alarms,
        tenant_id=tenant_id,
        cutoff_date=cutoff_date,
        session=session,
    )
    for tenant_id, tenant_alarms in alarms_by_tenant.items()
]

manifests = await asyncio.gather(*tasks, return_exceptions=True)
```

---

## Security Considerations

### Access Control

1. **MinIO Bucket Policies**
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Principal": {"AWS": ["arn:aws:iam::*:user/archival-service"]},
         "Action": ["s3:PutObject", "s3:GetObject"],
         "Resource": ["arn:aws:s3:::dotmac-archives/alarms/*"]
       }
     ]
   }
   ```

2. **Encryption at Rest**
   - Enable MinIO server-side encryption
   - Use KMS for key management

3. **Encryption in Transit**
   - Use HTTPS for MinIO connections
   - Enable TLS for production

### Data Privacy

- Archives contain sensitive customer data
- Apply data retention policies per jurisdiction
- Implement data anonymization if required
- Secure access logs

---

## Testing

### Unit Tests

```bash
# Run archival tests
pytest tests/fault_management/test_alarm_archival.py

# Run with coverage
pytest tests/fault_management/test_alarm_archival.py --cov=dotmac.platform.fault_management.archival
```

### Integration Tests

```bash
# Requires MinIO running
docker compose --profile storage up -d minio

# Run integration tests
pytest tests/fault_management/test_alarm_archival.py -m integration
```

### Manual Testing

```python
# Create test alarms
from dotmac.platform.fault_management.tasks import cleanup_old_cleared_alarms

# Run archival with short retention period
result = cleanup_old_cleared_alarms(days=0)

# Verify archives in MinIO Console
# http://localhost:9001
# Navigate to dotmac-archives bucket
```

---

## Migration

### Archiving Existing Old Alarms

```python
# One-time script to archive all existing old alarms
from dotmac.platform.fault_management.tasks import cleanup_old_cleared_alarms

# Archive alarms older than 30 days (more aggressive for migration)
result = cleanup_old_cleared_alarms(days=30)

print(f"Archived {result['alarms_archived']} alarms")
print(f"Freed up database space")
```

---

## Related Documentation

- [Fault Management Overview](FAULT_MANAGEMENT.md)
- [MinIO Setup Guide](MINIO_SETUP.md)
- [Celery Task Configuration](CELERY_TASKS.md)
- [Data Retention Policies](DATA_RETENTION.md)

---

## Conclusion

The alarm archival system provides automatic, reliable archival of old cleared alarms to MinIO cold storage. This ensures:

✅ **Compliance**: Meet data retention requirements
✅ **Performance**: Keep operational database lean
✅ **Audit Trail**: Maintain complete historical records
✅ **Cost Efficiency**: Use cheaper cold storage for old data
✅ **Scalability**: Handle growing alarm volumes

**Status**: ✅ Production Ready

---

**Documentation Owner**: Platform Engineering
**Date**: 2025-10-15
**Version**: 1.0.0
