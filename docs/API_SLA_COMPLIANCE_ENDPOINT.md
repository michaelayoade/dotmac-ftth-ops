# SLA Compliance API Endpoint Documentation

## Overview
This document describes the required backend API endpoint for SLA compliance data that powers the SLA Compliance Trends chart in the Fault Management dashboard.

## Endpoint Specification

### GET `/api/v1/faults/sla/compliance`

Returns historical SLA compliance data for network availability monitoring.

#### Request

**Headers:**
```http
Authorization: Bearer <token>
X-Tenant-ID: <tenant_id>
```

**Query Parameters:**
| Parameter   | Type   | Required | Description                                           |
|-------------|--------|----------|-------------------------------------------------------|
| from_date   | string | Yes      | ISO 8601 datetime for the start of the data range    |
| to_date     | string | No       | ISO 8601 datetime for the end of the data range (defaults to now) |

**Example Request:**
```http
GET /api/v1/faults/sla/compliance?from_date=2025-10-08T00:00:00Z
Authorization: Bearer eyJhbGc...
X-Tenant-ID: tenant_123
```

#### Response

**Success Response (200 OK):**
```json
[
  {
    "date": "2025-10-08T00:00:00Z",
    "compliance_percentage": 99.95,
    "target_percentage": 99.9,
    "uptime_minutes": 1438,
    "downtime_minutes": 2,
    "sla_breaches": 0
  },
  {
    "date": "2025-10-09T00:00:00Z",
    "compliance_percentage": 99.87,
    "target_percentage": 99.9,
    "uptime_minutes": 1437,
    "downtime_minutes": 3,
    "sla_breaches": 1
  }
]
```

**Response Fields:**
| Field                   | Type   | Description                                           |
|-------------------------|--------|-------------------------------------------------------|
| date                    | string | ISO 8601 date for this data point                    |
| compliance_percentage   | number | Actual availability percentage for this date          |
| target_percentage       | number | Target/SLA availability percentage                    |
| uptime_minutes          | number | Total minutes of uptime for the date                  |
| downtime_minutes        | number | Total minutes of downtime for the date                |
| sla_breaches            | number | Number of SLA breaches on this date                  |

**Error Responses:**

```json
{
  "status": 401,
  "message": "Unauthorized",
  "detail": "Missing or invalid authentication token"
}
```

```json
{
  "status": 403,
  "message": "Forbidden",
  "detail": "Insufficient permissions to access SLA compliance data"
}
```

```json
{
  "status": 400,
  "message": "Bad Request",
  "detail": "Invalid from_date format. Expected ISO 8601 datetime"
}
```

## Implementation Requirements

### 1. Tenant Scoping
- **MUST** enforce tenant isolation using the `X-Tenant-ID` header
- Only return SLA data for the authenticated tenant
- Return 403 if attempting to access another tenant's data

### 2. Authentication & Authorization
- Require valid JWT token in Authorization header
- Check user has permission: `faults.sla.read` or `faults.alarms.read`
- Return 401 for invalid/missing tokens
- Return 403 for insufficient permissions

### 3. Data Aggregation
- Calculate compliance percentage as: `(uptime_minutes / (uptime_minutes + downtime_minutes)) * 100`
- Aggregate data by date (daily granularity)
- Support date ranges up to 90 days
- Return empty array `[]` if no data exists for the requested period

### 4. Performance
- Response time should be < 500ms for 30-day queries
- Consider caching aggregated daily results
- Use database indexes on `tenant_id`, `date`, and `created_at`

### 5. Data Source
The endpoint should pull data from:
- Telemetry/monitoring system (e.g., Prometheus, TimescaleDB)
- Alarm/incident records with timestamps
- Network uptime monitoring service
- Service availability metrics

## Frontend Integration

The frontend hook is already implemented in `/frontend/apps/isp-ops-app/hooks/useFaults.ts`:

```typescript
export function useSLACompliance(days: number = 30) {
  const [data, setData] = useState<SLACompliance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchCompliance = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - days);

      const response = await apiClient.get(
        `/faults/sla/compliance?from_date=${fromDate.toISOString()}`,
      );

      if (response.data) {
        setData(response.data as SLACompliance[]);
      }
    } catch (err) {
      setError(err as Error);
      console.error("Failed to fetch SLA compliance:", err);
    } finally {
      setIsLoading(false);
    }
  }, [days]);

  useEffect(() => {
    fetchCompliance();
  }, [fetchCompliance]);

  return {
    data,
    isLoading,
    error,
    refetch: fetchCompliance,
  };
}
```

## Chart Display

The chart displays:
- **Green area chart**: Actual compliance percentage
- **Dashed gray line**: Target SLA percentage
- **X-axis**: Date labels (format: "MMM d", e.g., "Oct 8")
- **Y-axis**: Percentage (95-100% range)
- **Height**: 300px

## Testing

### Test Cases

1. **Happy Path**
   - Request 30 days of data
   - Should return daily data points
   - All percentages should be between 0-100

2. **Empty Data**
   - Request data for future dates
   - Should return empty array `[]`
   - Frontend will show: "SLA analytics will appear once the telemetry backend publishes historical availability data."

3. **Authentication**
   - Request without token → 401
   - Request with invalid token → 401
   - Request with valid token but wrong tenant → 403

4. **Date Range**
   - Request with invalid date format → 400
   - Request with very old from_date → Should return available data or empty array

### Example cURL Test

```bash
curl -X GET "http://localhost:8000/api/v1/faults/sla/compliance?from_date=2025-10-08T00:00:00Z" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "X-Tenant-ID: tenant_123" \
  -H "Content-Type: application/json"
```

## Database Schema Suggestion

If using a dedicated table for SLA compliance:

```sql
CREATE TABLE sla_compliance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    date DATE NOT NULL,
    compliance_percentage DECIMAL(5,2) NOT NULL,
    target_percentage DECIMAL(5,2) NOT NULL DEFAULT 99.90,
    uptime_minutes INTEGER NOT NULL,
    downtime_minutes INTEGER NOT NULL,
    sla_breaches INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    UNIQUE(tenant_id, date)
);

CREATE INDEX idx_sla_compliance_tenant_date ON sla_compliance(tenant_id, date DESC);
```

## Migration Plan

1. **Phase 1: Mock Endpoint**
   - Create endpoint that returns empty array
   - Verify frontend handles empty state correctly

2. **Phase 2: Sample Data**
   - Return hardcoded sample data for testing
   - Verify chart renders correctly

3. **Phase 3: Real Data Integration**
   - Connect to actual telemetry/monitoring system
   - Implement data aggregation logic
   - Add caching if needed

4. **Phase 4: Optimization**
   - Add database indexes
   - Implement caching strategy
   - Monitor performance metrics

## Related Files

**Frontend:**
- `/frontend/apps/isp-ops-app/hooks/useFaults.ts` - Hook implementation
- `/frontend/apps/isp-ops-app/app/dashboard/network/faults/page.tsx` - Chart usage

**Backend (to be implemented):**
- `src/dotmac/platform/faults/router.py` - Add endpoint
- `src/dotmac/platform/faults/service.py` - Business logic
- `src/dotmac/platform/faults/models.py` - Data models
- `src/dotmac/platform/faults/schemas.py` - Pydantic schemas

## Notes

- The frontend is **already implemented** and waiting for the backend endpoint
- Empty array response is handled gracefully (shows informational message)
- Error states include retry button for user convenience
- Loading states show skeleton placeholders for better UX
