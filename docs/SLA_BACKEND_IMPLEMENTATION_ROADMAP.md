# SLA Backend Implementation Roadmap

## Phase Timeline Summary

| Phase | Duration | Complexity | Value |
|-------|----------|------------|-------|
| Phase 1: Mock Endpoint | 30 min | Low | Unblocks frontend testing |
| Phase 2: Sample Data | 1 hour | Low | Validates chart rendering |
| Phase 3: Real Data | 4-8 hours | Medium-High | Production ready |
| Phase 4: Optimization | 2-4 hours | Medium | Performance tuning |

**Total**: 1-2 development days for production-ready implementation

---

## Phase 1: Mock Endpoint (30 minutes) ⚡

**Goal**: Return empty array to unblock frontend testing

### Implementation

**File**: `src/dotmac/platform/faults/router.py`

```python
from fastapi import APIRouter, Depends
from typing import List
from ..auth.dependencies import get_current_user, get_tenant_id

router = APIRouter(prefix="/faults", tags=["faults"])

@router.get("/sla/compliance")
async def get_sla_compliance(
    from_date: str,
    to_date: str | None = None,
    current_user = Depends(get_current_user),
    tenant_id: str = Depends(get_tenant_id),
) -> List[dict]:
    """
    Get SLA compliance data (Phase 1: Returns empty array)

    Query params:
    - from_date: ISO 8601 datetime
    - to_date: Optional ISO 8601 datetime (defaults to now)
    """
    # Phase 1: Return empty array
    # Frontend will show "waiting for telemetry data" message
    return []
```

**Test**:
```bash
curl -X GET "http://localhost:8000/api/v1/faults/sla/compliance?from_date=2025-10-08T00:00:00Z" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: $TENANT_ID"
```

**Expected**: `[]`

**Frontend Result**: ✅ Shows "SLA analytics will appear once the telemetry backend publishes historical availability data."

---

## Phase 2: Sample Data (1 hour) 🧪

**Goal**: Return test data to validate chart rendering

### Implementation

**File**: `src/dotmac/platform/faults/schemas.py`

```python
from pydantic import BaseModel
from datetime import datetime

class SLAComplianceRecord(BaseModel):
    date: datetime
    compliance_percentage: float
    target_percentage: float
    uptime_minutes: int
    downtime_minutes: int
    sla_breaches: int

    class Config:
        json_schema_extra = {
            "example": {
                "date": "2025-10-08T00:00:00Z",
                "compliance_percentage": 99.95,
                "target_percentage": 99.9,
                "uptime_minutes": 1438,
                "downtime_minutes": 2,
                "sla_breaches": 0,
            }
        }
```

**File**: `src/dotmac/platform/faults/router.py`

```python
from datetime import datetime, timedelta
from .schemas import SLAComplianceRecord

@router.get("/sla/compliance", response_model=List[SLAComplianceRecord])
async def get_sla_compliance(
    from_date: str,
    to_date: str | None = None,
    current_user = Depends(get_current_user),
    tenant_id: str = Depends(get_tenant_id),
) -> List[SLAComplianceRecord]:
    """Get SLA compliance data (Phase 2: Sample data)"""

    # Parse date
    start = datetime.fromisoformat(from_date.replace("Z", "+00:00"))
    end = datetime.now() if not to_date else datetime.fromisoformat(to_date.replace("Z", "+00:00"))

    # Generate sample data
    data = []
    current = start
    while current <= end:
        # Simulate varying compliance
        compliance = 99.5 + (hash(current.isoformat()) % 50) / 100  # 99.5-100%

        data.append(SLAComplianceRecord(
            date=current,
            compliance_percentage=round(compliance, 2),
            target_percentage=99.9,
            uptime_minutes=1438,  # ~24h - 2min
            downtime_minutes=2,
            sla_breaches=1 if compliance < 99.9 else 0,
        ))
        current += timedelta(days=1)

    return data
```

**Test**: Same curl command as Phase 1

**Expected**: Array of 30+ daily records

**Frontend Result**: ✅ Chart displays with green area and dashed target line

---

## Phase 3: Real Data (4-8 hours) 🔧

**Goal**: Connect to actual telemetry/monitoring system

### Option A: Using Alarms Table

**File**: `src/dotmac/platform/faults/service.py`

```python
from sqlalchemy import select, func
from sqlalchemy.orm import Session
from datetime import datetime, timedelta, date
from typing import List
from .models import Alarm
from .schemas import SLAComplianceRecord

class SLAComplianceService:
    def __init__(self, db: Session, tenant_id: str):
        self.db = db
        self.tenant_id = tenant_id

    async def calculate_daily_compliance(
        self,
        from_date: datetime,
        to_date: datetime | None = None,
    ) -> List[SLAComplianceRecord]:
        """
        Calculate SLA compliance from alarm downtime data

        Logic:
        - Each day has 1440 minutes (24 hours)
        - Sum downtime from critical alarms
        - Compliance = (1440 - downtime) / 1440 * 100
        """
        if not to_date:
            to_date = datetime.now()

        results = []
        current_date = from_date.date()
        end_date = to_date.date()

        while current_date <= end_date:
            # Calculate downtime for this date
            day_start = datetime.combine(current_date, datetime.min.time())
            day_end = datetime.combine(current_date, datetime.max.time())

            # Query critical alarms for this day
            stmt = (
                select(
                    func.sum(
                        func.extract(
                            'epoch',
                            func.least(Alarm.cleared_at, day_end) -
                            func.greatest(Alarm.first_occurrence, day_start)
                        ) / 60  # Convert to minutes
                    ).label('downtime_minutes')
                )
                .where(Alarm.tenant_id == self.tenant_id)
                .where(Alarm.severity.in_(['critical', 'major']))
                .where(Alarm.first_occurrence <= day_end)
                .where(
                    (Alarm.cleared_at >= day_start) |
                    (Alarm.cleared_at.is_(None))  # Still active
                )
            )

            result = await self.db.execute(stmt)
            downtime = result.scalar() or 0.0
            downtime = min(downtime, 1440)  # Cap at 24h

            uptime = 1440 - downtime
            compliance = (uptime / 1440) * 100

            # Count SLA breaches (compliance < target)
            breaches = 1 if compliance < 99.9 else 0

            results.append(SLAComplianceRecord(
                date=datetime.combine(current_date, datetime.min.time()),
                compliance_percentage=round(compliance, 2),
                target_percentage=99.9,
                uptime_minutes=int(uptime),
                downtime_minutes=int(downtime),
                sla_breaches=breaches,
            ))

            current_date += timedelta(days=1)

        return results
```

**File**: `src/dotmac/platform/faults/router.py`

```python
from .service import SLAComplianceService

@router.get("/sla/compliance", response_model=List[SLAComplianceRecord])
async def get_sla_compliance(
    from_date: str,
    to_date: str | None = None,
    current_user = Depends(get_current_user),
    tenant_id: str = Depends(get_tenant_id),
    db: Session = Depends(get_db),
) -> List[SLAComplianceRecord]:
    """Get SLA compliance data from alarm history"""

    # Parse dates
    start = datetime.fromisoformat(from_date.replace("Z", "+00:00"))
    end = datetime.now() if not to_date else datetime.fromisoformat(to_date.replace("Z", "+00:00"))

    # Validate date range
    if (end - start).days > 90:
        raise HTTPException(status_code=400, detail="Date range cannot exceed 90 days")

    # Calculate compliance
    service = SLAComplianceService(db, tenant_id)
    data = await service.calculate_daily_compliance(start, end)

    return data
```

### Option B: Using TimescaleDB Metrics

If you have a separate telemetry/metrics table:

```python
class SLAComplianceService:
    async def calculate_from_metrics(
        self,
        from_date: datetime,
        to_date: datetime | None = None,
    ) -> List[SLAComplianceRecord]:
        """Calculate from TimescaleDB metrics table"""

        # Query daily aggregated uptime metrics
        stmt = """
            SELECT
                time_bucket('1 day', timestamp) as day,
                100 - AVG(downtime_percentage) as compliance,
                SUM(uptime_minutes) as uptime,
                SUM(downtime_minutes) as downtime
            FROM network_metrics
            WHERE tenant_id = :tenant_id
              AND timestamp BETWEEN :start AND :end
            GROUP BY day
            ORDER BY day
        """

        result = await self.db.execute(
            text(stmt),
            {"tenant_id": self.tenant_id, "start": from_date, "end": to_date}
        )

        return [
            SLAComplianceRecord(
                date=row.day,
                compliance_percentage=round(row.compliance, 2),
                target_percentage=99.9,
                uptime_minutes=row.uptime,
                downtime_minutes=row.downtime,
                sla_breaches=1 if row.compliance < 99.9 else 0,
            )
            for row in result
        ]
```

### Testing Phase 3

```bash
# 1. Check with real date range
curl -X GET "http://localhost:8000/api/v1/faults/sla/compliance?from_date=$(date -u -d '30 days ago' +%Y-%m-%dT%H:%M:%SZ)" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: $TENANT_ID"

# 2. Verify tenant isolation
curl -X GET "http://localhost:8000/api/v1/faults/sla/compliance?from_date=2025-10-08T00:00:00Z" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: different_tenant"
# Should return different/empty data

# 3. Test invalid date range (should fail)
curl -X GET "http://localhost:8000/api/v1/faults/sla/compliance?from_date=2020-01-01T00:00:00Z" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: $TENANT_ID"
# Should return 400 Bad Request (>90 days)
```

---

## Phase 4: Optimization (2-4 hours) ⚡

**Goal**: Add caching and performance improvements

### 4.1: Database Indexes

```sql
-- Index for alarm-based queries
CREATE INDEX IF NOT EXISTS idx_alarms_sla_lookup
ON alarms(tenant_id, severity, first_occurrence, cleared_at)
WHERE severity IN ('critical', 'major');

-- Index for metrics-based queries
CREATE INDEX IF NOT EXISTS idx_network_metrics_daily
ON network_metrics(tenant_id, time_bucket('1 day', timestamp))
WHERE metric_type = 'availability';
```

### 4.2: Redis Caching

**File**: `src/dotmac/platform/faults/service.py`

```python
from redis import Redis
import json
from datetime import timedelta

class SLAComplianceService:
    def __init__(self, db: Session, tenant_id: str, redis: Redis = None):
        self.db = db
        self.tenant_id = tenant_id
        self.redis = redis

    async def get_compliance_cached(
        self,
        from_date: datetime,
        to_date: datetime | None = None,
    ) -> List[SLAComplianceRecord]:
        """Get compliance with Redis caching"""

        # Generate cache key
        end = to_date or datetime.now()
        cache_key = f"sla:compliance:{self.tenant_id}:{from_date.date()}:{end.date()}"

        # Try cache first
        if self.redis:
            cached = self.redis.get(cache_key)
            if cached:
                data = json.loads(cached)
                return [SLAComplianceRecord(**item) for item in data]

        # Calculate from database
        data = await self.calculate_daily_compliance(from_date, end)

        # Cache result (TTL: 5 minutes for recent data, 24h for historical)
        if self.redis and data:
            ttl = 300 if end.date() >= datetime.now().date() else 86400
            self.redis.setex(
                cache_key,
                ttl,
                json.dumps([item.dict() for item in data], default=str)
            )

        return data
```

### 4.3: Materialized View (PostgreSQL)

For high-volume systems, pre-compute daily:

```sql
-- Create materialized view
CREATE MATERIALIZED VIEW sla_compliance_daily AS
SELECT
    tenant_id,
    DATE(first_occurrence) as date,
    COUNT(*) FILTER (WHERE severity IN ('critical', 'major')) as incidents,
    SUM(
        EXTRACT(epoch FROM (
            COALESCE(cleared_at, NOW()) - first_occurrence
        )) / 60
    ) as total_downtime_minutes,
    1440 - COALESCE(
        SUM(
            EXTRACT(epoch FROM (
                COALESCE(cleared_at, NOW()) - first_occurrence
            )) / 60
        ), 0
    ) as uptime_minutes,
    (1 - COALESCE(
        SUM(
            EXTRACT(epoch FROM (
                COALESCE(cleared_at, NOW()) - first_occurrence
            )) / 60
        ), 0
    ) / 1440) * 100 as compliance_percentage
FROM alarms
WHERE severity IN ('critical', 'major')
GROUP BY tenant_id, DATE(first_occurrence);

-- Refresh daily via cron
CREATE INDEX idx_sla_compliance_daily ON sla_compliance_daily(tenant_id, date DESC);

-- Query becomes simple
SELECT * FROM sla_compliance_daily
WHERE tenant_id = :tenant_id
  AND date BETWEEN :start AND :end
ORDER BY date;
```

### 4.4: Background Job (Celery)

Pre-compute and cache SLA data nightly:

```python
from celery import shared_task

@shared_task
def calculate_sla_for_all_tenants():
    """Background job to pre-calculate SLA compliance"""
    from datetime import datetime, timedelta
    from .service import SLAComplianceService

    # Get all active tenants
    tenants = get_active_tenants()

    # Calculate last 90 days for each tenant
    end = datetime.now()
    start = end - timedelta(days=90)

    for tenant in tenants:
        service = SLAComplianceService(db, tenant.id, redis)
        try:
            data = await service.calculate_daily_compliance(start, end)
            # Store in cache
            cache_key = f"sla:compliance:{tenant.id}:90d"
            redis.setex(
                cache_key,
                86400,  # 24h TTL
                json.dumps([item.dict() for item in data], default=str)
            )
        except Exception as e:
            logger.error(f"Failed to calculate SLA for {tenant.id}: {e}")
```

**Schedule in Celery Beat**:
```python
# celery_config.py
CELERYBEAT_SCHEDULE = {
    'calculate-sla-nightly': {
        'task': 'calculate_sla_for_all_tenants',
        'schedule': crontab(hour=2, minute=0),  # 2 AM daily
    },
}
```

---

## Performance Targets

| Metric | Target | Phase 3 | Phase 4 |
|--------|--------|---------|---------|
| Response time (30d) | < 500ms | 800-1200ms | < 300ms |
| Response time (90d) | < 1s | 2-3s | < 600ms |
| Cache hit rate | > 80% | 0% | 85-95% |
| DB queries per request | Minimize | 30-90 | 0-1 |

---

## Migration Checklist

### Pre-Implementation
- [ ] Review alarm data structure
- [ ] Verify tenant_id is present on all alarms
- [ ] Check if cleared_at timestamps are accurate
- [ ] Identify telemetry/metrics data source
- [ ] Set up Redis if not already available

### Phase 1
- [ ] Add endpoint to router
- [ ] Test with frontend (should show "waiting for data")
- [ ] Verify authentication works
- [ ] Verify tenant isolation works

### Phase 2
- [ ] Create Pydantic schemas
- [ ] Add sample data generator
- [ ] Test chart rendering in frontend
- [ ] Validate date parsing

### Phase 3
- [ ] Implement service layer
- [ ] Choose data source (alarms vs metrics)
- [ ] Add error handling
- [ ] Test with real data
- [ ] Verify calculations are accurate
- [ ] Load test with 90-day queries

### Phase 4
- [ ] Add database indexes
- [ ] Implement Redis caching
- [ ] Consider materialized views
- [ ] Set up background jobs
- [ ] Monitor performance metrics
- [ ] Tune cache TTLs

---

## Troubleshooting

### Issue: Compliance > 100%
**Cause**: Downtime calculation error or negative values
**Fix**: Add validation: `compliance = min(max(compliance, 0), 100)`

### Issue: Slow queries
**Cause**: Missing indexes or large date ranges
**Fix**:
- Add indexes on `tenant_id`, `first_occurrence`, `cleared_at`
- Limit date range to 90 days
- Use materialized views

### Issue: Cache stampede
**Cause**: Multiple concurrent requests after cache expiry
**Fix**: Use cache locking or stale-while-revalidate pattern

### Issue: Timezone problems
**Cause**: Date boundaries not aligned to tenant timezone
**Fix**: Store tenant timezone and adjust calculations

---

## Monitoring

Add these metrics to track SLA endpoint health:

```python
from prometheus_client import Histogram, Counter

sla_request_duration = Histogram(
    'sla_compliance_request_duration_seconds',
    'SLA compliance request duration',
    ['tenant_id', 'cached']
)

sla_cache_hits = Counter(
    'sla_compliance_cache_hits_total',
    'SLA compliance cache hits',
    ['tenant_id']
)

sla_cache_misses = Counter(
    'sla_compliance_cache_misses_total',
    'SLA compliance cache misses',
    ['tenant_id']
)
```

---

## Success Criteria

✅ **Phase 1**: Frontend shows "waiting for data" message
✅ **Phase 2**: Chart renders with test data
✅ **Phase 3**:
  - Real data displays correctly
  - Tenant isolation verified
  - 30-day queries < 1s response time
✅ **Phase 4**:
  - 30-day queries < 500ms
  - Cache hit rate > 80%
  - No performance degradation under load

---

## Next Steps After Implementation

1. **User Testing**: Gather feedback on chart usefulness
2. **Alerts**: Add alerts for SLA breaches
3. **Reports**: Generate monthly SLA reports
4. **Trends**: Add week-over-week / month-over-month comparison
5. **Drilldown**: Click chart to see detailed incidents for that day
6. **Export**: Add CSV/PDF export of SLA data

---

**Total Estimated Effort**: 1-2 days for production-ready implementation with all optimizations
