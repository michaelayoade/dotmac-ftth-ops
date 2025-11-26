# Frontend Observability Integration

This document describes how frontend errors and metrics are integrated with the DotMac Platform observability stack.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Frontend Application                          │
│                                                                   │
│  ┌──────────────────┐         ┌──────────────────┐              │
│  │ useErrorHandler  │────────▶│ reportErrorTo    │              │
│  │                  │         │ Observability    │              │
│  └──────────────────┘         └────────┬─────────┘              │
│                                         │                         │
└─────────────────────────────────────────┼─────────────────────────┘
                                          │
                    HTTP POST (OpenTelemetry Protocol)
                                          │
                                          ▼
┌─────────────────────────────────────────────────────────────────┐
│               OpenTelemetry Collector                            │
│                  (localhost:4318)                                │
│                                                                   │
│  Receives:                                                        │
│  - Logs (errors, events)                                         │
│  - Metrics (counters, gauges)                                    │
│  - Traces (distributed tracing)                                  │
└───┬─────────────────────┬─────────────────────┬──────────────────┘
    │                     │                     │
    │                     │                     │
    ▼                     ▼                     ▼
┌─────────┐         ┌──────────┐         ┌──────────┐
│ Grafana │         │Prometheus│         │  Tempo   │
│  Loki   │         │          │         │          │
│         │         │          │         │          │
│ (Logs)  │         │ (Metrics)│         │ (Traces) │
└─────────┘         └──────────┘         └──────────┘
```

## Configuration

### Environment Variables

```bash
# .env.local (Development)
NEXT_PUBLIC_OTEL_ENDPOINT=http://localhost:4318
OBSERVABILITY__OTEL_ENDPOINT=http://localhost:4318

# .env.production (Production)
NEXT_PUBLIC_OTEL_ENDPOINT=https://otel-collector.yourdomain.com
OBSERVABILITY__OTEL_ENDPOINT=https://otel-collector.yourdomain.com

# Optional: Skip error reporting in development
NEXT_PUBLIC_SKIP_ERROR_REPORTING=false
```

### Backend Configuration

Your backend is already configured with OpenTelemetry:

```python
# From your .env.local
OBSERVABILITY__OTEL_ENDPOINT=http://localhost:4318
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317
OBSERVABILITY__ALERTMANAGER_BASE_URL=http://localhost:9093
```

## Error Reporting

### Automatic Error Reporting

When using `useErrorHandler`, errors are automatically sent to OpenTelemetry:

```typescript
import { useErrorHandler } from '@dotmac/hooks';

function MyComponent() {
  const { handleError } = useErrorHandler({
    reportError: true,  // ✅ Default: true
  });

  const fetchData = async () => {
    try {
      await api.getData();
    } catch (err) {
      // Automatically reported to observability stack
      handleError(err, {
        component: 'MyComponent',
        action: 'fetchData',
        userId: user?.id,
      });
    }
  };
}
```

### Error Data Structure

```json
{
  "resourceLogs": [
    {
      "resource": {
        "attributes": [
          { "key": "service.name", "value": { "stringValue": "dotmac-frontend" } },
          { "key": "deployment.environment", "value": { "stringValue": "production" } }
        ]
      },
      "scopeLogs": [
        {
          "scope": { "name": "error-handler" },
          "logRecords": [
            {
              "timeUnixNano": "1732545600000000000",
              "severityNumber": 17,
              "severityText": "ERROR",
              "body": { "stringValue": "Failed to fetch customer data" },
              "attributes": [
                { "key": "error.id", "value": { "stringValue": "550e8400-..." } },
                { "key": "error.category", "value": { "stringValue": "network" } },
                { "key": "error.severity", "value": { "stringValue": "error" } },
                { "key": "http.status_code", "value": { "stringValue": "500" } },
                { "key": "component.name", "value": { "stringValue": "CustomerList" } },
                { "key": "action.name", "value": { "stringValue": "fetchData" } }
              ]
            }
          ]
        }
      ]
    }
  ]
}
```

## Metrics

### Error Metrics

Automatically tracked:

```
frontend.errors.total{
  error.category="network",
  error.severity="error",
  http.status_code="500"
}
```

### Custom Metrics

```typescript
import { recordMetric } from '@dotmac/utils/observability';

// Record custom metric
recordMetric('frontend.page.load_time', 1234, {
  page: '/dashboard',
  user_type: 'admin',
});

// Record performance
import { recordPerformance } from '@dotmac/utils/observability';

const start = performance.now();
await someOperation();
const duration = performance.now() - start;

recordPerformance('api.customer.fetch', duration, {
  count: 100,
  cached: false,
});
```

## Session Tracking

Each browser session gets a unique ID for error correlation:

```typescript
// Automatically created and stored in sessionStorage
observability_session_id: "550e8400-e29b-41d4-a716-446655440000"
```

This allows you to:
- Correlate multiple errors from the same session
- Track user journey when errors occur
- Identify patterns in error sequences

## Grafana Dashboards

### Recommended Dashboards

1. **Frontend Errors Overview**
   - Total error count
   - Error rate (errors/minute)
   - Top error categories
   - Error severity distribution

2. **Error Details**
   - Recent errors timeline
   - Errors by component
   - Errors by HTTP status code
   - Error messages frequency

3. **Performance Monitoring**
   - API call durations
   - Page load times
   - Component render times

### Example Prometheus Queries

```promql
# Error rate (last 5 minutes)
rate(frontend_errors_total[5m])

# Errors by category
sum(frontend_errors_total) by (error_category)

# Critical errors only
frontend_errors_total{error_severity="critical"}

# Errors by component
sum(frontend_errors_total) by (component_name)
```

### Example Loki Queries

```logql
# All frontend errors
{service_name="dotmac-frontend"} |= "ERROR"

# Errors from specific component
{service_name="dotmac-frontend", component_name="CustomerList"} |= "ERROR"

# Network errors only
{service_name="dotmac-frontend", error_category="network"}

# Errors with status code 500
{service_name="dotmac-frontend"} | json | http_status_code="500"
```

## Alerting

### Recommended Alerts

Configure in Grafana Alertmanager:

```yaml
# High error rate
- alert: HighFrontendErrorRate
  expr: rate(frontend_errors_total[5m]) > 10
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: "High frontend error rate detected"

# Critical errors
- alert: FrontendCriticalError
  expr: increase(frontend_errors_total{error_severity="critical"}[5m]) > 0
  for: 1m
  labels:
    severity: critical
  annotations:
    summary: "Critical frontend error occurred"

# Authentication errors
- alert: HighAuthErrors
  expr: rate(frontend_errors_total{error_category="authentication"}[5m]) > 5
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: "High authentication error rate"
```

## Debugging with OpenTelemetry

### View Error Context

In development, errors log detailed context:

```javascript
// Console output
[Error Trace] network
  Message: Failed to fetch customer data
  Severity: error
  Category: network
  Status Code: 500
  Context: {
    component: 'CustomerList',
    action: 'fetchData',
    userId: '123',
    url: 'http://localhost:3000/customers',
    sessionId: '550e8400-...'
  }
  Original Error: Error: Failed to fetch...
```

### Trace Correlation

Errors are linked to distributed traces, allowing you to:
1. Find the error in Grafana Loki
2. Get the trace ID from error attributes
3. View the full request trace in Tempo
4. See backend logs correlated with frontend error

## Performance Impact

Error reporting is designed to be lightweight:

- **Async**: Uses `fetch` with `keepalive: true`
- **Non-blocking**: Errors in reporting are silently caught
- **Batched**: Multiple metrics can be sent together
- **Minimal payload**: ~2-5KB per error report

## Testing

### Test Error Reporting Locally

```bash
# Start OpenTelemetry collector
docker-compose up otel-collector

# In your app, trigger an error
const { handleError } = useErrorHandler();
handleError(new Error('Test error'), { test: true });

# Check Grafana Loki for the log
http://localhost:3000/explore
```

### Verify Metrics

```bash
# Check Prometheus targets
http://localhost:9090/targets

# Query frontend errors
http://localhost:9090/graph?g0.expr=frontend_errors_total
```

## Best Practices

1. **Always include context**
   ```typescript
   handleError(error, {
     component: 'ComponentName',
     action: 'actionName',
     userId: user?.id,
     customData: 'any relevant context',
   });
   ```

2. **Use meaningful component names**
   ```typescript
   // ✅ Good
   { component: 'CustomerList', action: 'fetchCustomers' }

   // ❌ Bad
   { component: 'comp1', action: 'fetch' }
   ```

3. **Don't report expected errors**
   ```typescript
   // User cancelled action - don't report
   if (error.code === 'USER_CANCELLED') {
     return;
   }

   handleError(error);
   ```

4. **Include relevant user context** (without PII)
   ```typescript
   handleError(error, {
     component: 'PaymentForm',
     userRole: user.role,        // ✅ OK
     planTier: subscription.tier, // ✅ OK
     // email: user.email,        // ❌ Don't include PII
   });
   ```

## Troubleshooting

### Errors not appearing in Grafana

1. **Check OpenTelemetry endpoint**
   ```typescript
   console.log(process.env.NEXT_PUBLIC_OTEL_ENDPOINT);
   ```

2. **Verify collector is running**
   ```bash
   curl http://localhost:4318/v1/logs
   ```

3. **Check browser console**
   - Look for "Failed to report error to observability" warnings

4. **Test with development logs**
   ```bash
   NODE_ENV=development npm run dev
   # Trigger an error and check console for [Error Trace] output
   ```

### High cardinality warnings

If Prometheus warns about high cardinality:

- Remove dynamic labels (user IDs, session IDs) from metrics
- Use fixed categories/types only
- Store dynamic data in log attributes instead

## References

- [OpenTelemetry Documentation](https://opentelemetry.io/docs/)
- [Grafana Loki Query Language](https://grafana.com/docs/loki/latest/logql/)
- [Prometheus Query Language](https://prometheus.io/docs/prometheus/latest/querying/basics/)
- Backend observability: `/Users/michaelayoade/Downloads/Projects/dotmac-ftth-ops/src/dotmac/platform/monitoring/`
