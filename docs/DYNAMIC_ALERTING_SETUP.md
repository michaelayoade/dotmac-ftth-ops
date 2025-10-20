# Dynamic Alerting System - Implementation Guide

## Overview

The DotMac platform now includes a comprehensive dynamic alerting system that allows you to configure alert channels (Slack, Discord, Teams, webhooks) via API without restarting services. This system integrates with Prometheus and Alertmanager for error tracking and monitoring.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Error/Alert Flow                            │
└─────────────────────────────────────────────────────────────────┘

1. Application Error/Metric
   ↓
2. Prometheus Metrics (via /metrics endpoint)
   ↓
3. Prometheus Evaluates Alert Rules
   ↓
4. Alertmanager (receives firing alerts)
   ↓
5. DotMac Webhook Receiver (/api/v1/monitoring/alerts/webhook)
   ↓
6. Dynamic Alert Router (filters by tenant, severity, etc.)
   ↓
7. Notification Channels (Slack, Discord, Teams, etc.)
```

## Components

### 1. Error Tracking Metrics
- **File**: `src/dotmac/platform/monitoring/error_tracking.py`
- **Purpose**: Prometheus metrics for HTTP errors, exceptions, database errors, auth failures
- **Metrics Exposed**:
  - `dotmac_http_errors_total` - Total HTTP errors (4xx, 5xx)
  - `dotmac_http_4xx_errors_total` - Client errors
  - `dotmac_http_5xx_errors_total` - Server errors
  - `dotmac_exceptions_total` - Application exceptions
  - `dotmac_database_errors_total` - Database errors
  - `dotmac_auth_failures_total` - Authentication failures
  - `dotmac_rate_limit_exceeded_total` - Rate limit violations
  - And many more...

### 2. Error Tracking Middleware
- **File**: `src/dotmac/platform/monitoring/error_middleware.py`
- **Purpose**: Automatically track all HTTP errors and exceptions
- **Features**:
  - `ErrorTrackingMiddleware` - Tracks 4xx/5xx errors and exceptions
  - `RequestMetricsMiddleware` - Tracks request latency and throughput
  - Tenant-aware metrics

### 3. Alert Webhook Router
- **File**: `src/dotmac/platform/monitoring/alert_webhook_router.py`
- **Purpose**: Dynamic routing of alerts to configured channels
- **Features**:
  - Route alerts by tenant, severity, alert name, category
  - Support for Slack, Discord, Teams, generic webhooks
  - Platform-specific message formatting
  - Concurrent webhook delivery
  - Filtering and inhibition

### 4. Alert Management API
- **File**: `src/dotmac/platform/monitoring/alert_router.py`
- **Purpose**: REST API for managing alert channels
- **Endpoints**:
  - `POST /api/v1/monitoring/alerts/webhook` - Receive from Alertmanager (no auth)
  - `POST /api/v1/monitoring/alerts/channels` - Create channel
  - `GET /api/v1/monitoring/alerts/channels` - List channels
  - `GET /api/v1/monitoring/alerts/channels/{id}` - Get channel
  - `PATCH /api/v1/monitoring/alerts/channels/{id}` - Update channel
  - `DELETE /api/v1/monitoring/alerts/channels/{id}` - Delete channel
  - `POST /api/v1/monitoring/alerts/test` - Send test alert

### 5. Configuration Files
- **prometheus/prometheus.yml** - Prometheus scrape config and alert rules
- **prometheus/alertmanager.yml** - Alertmanager webhook routing
- **prometheus/alerts/error-alerts.yml** - Error alerting rules
- **grafana/dashboards/error-tracking-dashboard.json** - Grafana dashboard

### 6. Deployment
- **docker-compose.monitoring.yml** - Complete monitoring stack
- **scripts/configure_alert_channels.py** - CLI tool for channel management

## Quick Start

### 1. Start the Monitoring Stack

```bash
# Start Prometheus, Alertmanager, Grafana, and Node Exporter
docker-compose -f docker-compose.monitoring.yml up -d

# Verify all services are running
docker-compose -f docker-compose.monitoring.yml ps
```

Services will be available at:
- Prometheus: http://localhost:9090
- Alertmanager: http://localhost:9093
- Grafana: http://localhost:3001 (admin/admin)
- Node Exporter: http://localhost:9100

### 2. Verify Metrics Collection

```bash
# Check that DotMac is exposing metrics
curl http://localhost:8000/metrics

# Verify Prometheus is scraping
curl http://localhost:9090/api/v1/targets
```

### 3. Configure Your First Alert Channel

#### Option A: Using the CLI Script

```bash
# Create a Slack channel for critical alerts
python scripts/configure_alert_channels.py create slack \
  --name "Critical Alerts" \
  --webhook-url "https://hooks.slack.com/services/YOUR/WEBHOOK/URL" \
  --slack-channel "#alerts-critical" \
  --severities critical

# Create a Slack channel for all engineering alerts
python scripts/configure_alert_channels.py create slack \
  --name "Engineering Alerts" \
  --webhook-url "https://hooks.slack.com/services/YOUR/WEBHOOK/URL" \
  --slack-channel "#engineering-alerts" \
  --severities warning critical

# List all configured channels
python scripts/configure_alert_channels.py list

# Test a channel
python scripts/configure_alert_channels.py test critical-alerts
```

#### Option B: Using the API Directly

```bash
# Get your auth token
TOKEN=$(curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"testpass123"}' \
  | jq -r '.access_token')

# Create a Slack channel
curl -X POST http://localhost:8000/api/v1/monitoring/alerts/channels \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "slack-critical",
    "name": "Critical Alerts",
    "channel_type": "slack",
    "webhook_url": "https://hooks.slack.com/services/YOUR/WEBHOOK/URL",
    "enabled": true,
    "severities": ["critical"],
    "slack_channel": "#alerts-critical"
  }'

# List all channels
curl http://localhost:8000/api/v1/monitoring/alerts/channels \
  -H "Authorization: Bearer $TOKEN"

# Send test alert
curl -X POST http://localhost:8000/api/v1/monitoring/alerts/test \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "channel_id": "slack-critical",
    "severity": "critical",
    "message": "Test alert from DotMac"
  }'
```

### 4. View Alerts in Grafana

1. Open Grafana: http://localhost:3001
2. Login with admin/admin
3. Navigate to Dashboards → Error Tracking & Monitoring
4. View real-time error metrics, top error endpoints, exception types, etc.

## Advanced Configuration

### Multi-Tenant Alert Routing

Route alerts to different channels based on tenant:

```python
# Tenant A - Route to their Slack
python scripts/configure_alert_channels.py create slack \
  --name "Tenant A Alerts" \
  --webhook-url "https://hooks.slack.com/services/TENANT_A/WEBHOOK" \
  --tenant-id "tenant-a" \
  --severities warning critical

# Tenant B - Route to their Discord
python scripts/configure_alert_channels.py create discord \
  --name "Tenant B Alerts" \
  --webhook-url "https://discord.com/api/webhooks/TENANT_B/WEBHOOK" \
  --tenant-id "tenant-b" \
  --severities warning critical
```

### Category-Based Routing

Route specific types of alerts to specific channels:

```json
{
  "id": "database-alerts",
  "name": "Database Team",
  "channel_type": "slack",
  "webhook_url": "https://hooks.slack.com/services/DB_TEAM/WEBHOOK",
  "alert_categories": ["database", "infrastructure"],
  "severities": ["warning", "critical"]
}
```

### Alert Name Filtering

Route specific alerts to specific channels:

```json
{
  "id": "payment-alerts",
  "name": "Payment Team",
  "channel_type": "teams",
  "webhook_url": "https://outlook.office.com/webhook/...",
  "alert_names": [
    "PaymentProcessingFailure",
    "HighPaymentErrorRate",
    "CriticalPaymentGatewayDown"
  ]
}
```

## Alert Rules

The system includes comprehensive alert rules in `prometheus/alerts/error-alerts.yml`:

### Error Rate Alerts
- **HighErrorRate** - Warning when error rate > 10/sec
- **CriticalErrorRate** - Critical when error rate > 50/sec
- **High5xxErrors** - Warning when 5xx rate > 5/sec
- **Critical5xxErrors** - Critical when 5xx rate > 20/sec

### Database Alerts
- **DatabaseConnectionFailures** - Critical when connection failures detected
- **HighDatabaseQueryTimeouts** - Warning when query timeouts > 5/sec

### Security Alerts
- **AuthenticationFailureSpike** - Warning when auth failures > 10/sec
- **CriticalAuthFailures** - Critical when auth failures > 50/sec (possible attack)
- **HighRateLimitViolations** - Warning when rate limits exceeded

### Recovery Alerts
- **ErrorRateRecovered** - Info when error rate returns to normal
- **DatabaseErrorsResolved** - Info when database errors cleared

### Anomaly Detection
- **ErrorRateAnomaly** - Warning when error rate is 3x higher than 1 hour ago

## Testing

### 1. Generate Test Errors

```bash
# Test 404 errors
for i in {1..10}; do
  curl http://localhost:8000/api/v1/nonexistent
done

# Test 500 errors (will trigger exception tracking)
curl -X POST http://localhost:8000/api/v1/test-error
```

### 2. Check Prometheus

```bash
# View current error rate
curl 'http://localhost:9090/api/v1/query?query=rate(dotmac_http_errors_total[1m])'

# View firing alerts
curl http://localhost:9090/api/v1/alerts
```

### 3. Check Alertmanager

```bash
# View active alerts
curl http://localhost:9093/api/v2/alerts
```

### 4. Verify Webhook Delivery

Check your Slack/Discord/Teams channel for alert notifications.

## Monitoring Stack Management

### View Logs

```bash
# Prometheus logs
docker-compose -f docker-compose.monitoring.yml logs -f prometheus

# Alertmanager logs
docker-compose -f docker-compose.monitoring.yml logs -f alertmanager

# Grafana logs
docker-compose -f docker-compose.monitoring.yml logs -f grafana
```

### Reload Configuration

```bash
# Reload Prometheus configuration (without restart)
curl -X POST http://localhost:9090/-/reload

# Reload Alertmanager configuration (without restart)
curl -X POST http://localhost:9093/-/reload
```

### Stop/Start Services

```bash
# Stop all monitoring services
docker-compose -f docker-compose.monitoring.yml down

# Start with clean state
docker-compose -f docker-compose.monitoring.yml down -v  # Remove volumes
docker-compose -f docker-compose.monitoring.yml up -d
```

## Troubleshooting

### Alerts Not Firing

1. Check Prometheus is scraping metrics:
   ```bash
   curl http://localhost:9090/api/v1/targets
   ```

2. Check alert rules are loaded:
   ```bash
   curl http://localhost:9090/api/v1/rules
   ```

3. Verify alert conditions are met:
   ```bash
   curl 'http://localhost:9090/api/v1/query?query=rate(dotmac_http_errors_total[5m])'
   ```

### Webhooks Not Delivered

1. Check Alertmanager configuration:
   ```bash
   docker-compose -f docker-compose.monitoring.yml exec alertmanager \
     cat /etc/alertmanager/alertmanager.yml
   ```

2. Check Alertmanager logs:
   ```bash
   docker-compose -f docker-compose.monitoring.yml logs alertmanager
   ```

3. Verify DotMac API is accessible from Alertmanager:
   ```bash
   docker-compose -f docker-compose.monitoring.yml exec alertmanager \
     wget -O- http://dotmac-api:8000/health
   ```

4. Check alert router logs in DotMac:
   ```bash
   docker logs dotmac-api 2>&1 | grep -i "alert"
   ```

### Channel Not Receiving Alerts

1. List configured channels:
   ```bash
   python scripts/configure_alert_channels.py list
   ```

2. Check channel is enabled:
   ```bash
   python scripts/configure_alert_channels.py get <channel-id>
   ```

3. Test channel directly:
   ```bash
   python scripts/configure_alert_channels.py test <channel-id>
   ```

4. Check channel filters (tenant_id, severities, alert_names):
   - Ensure alert matches channel filters
   - Check alert labels in Prometheus

## Production Deployment

### Security Considerations

1. **Alertmanager → DotMac API**:
   - Currently uses network-level security (Docker network)
   - For production, consider adding authentication:
     ```yaml
     # prometheus/alertmanager.yml
     receivers:
       - name: 'dotmac-webhook'
         webhook_configs:
           - url: 'https://api.dotmac.com/api/v1/monitoring/alerts/webhook'
             http_config:
               bearer_token: 'your-secret-token'
     ```

2. **Channel Management API**:
   - Already requires authentication
   - Use RBAC to restrict channel creation to admins
   - Consider implementing platform admin checks

3. **Webhook URLs**:
   - Store securely (consider using secrets manager)
   - Rotate regularly
   - Use HTTPS for all webhooks

### High Availability

1. **Prometheus**:
   - Run multiple Prometheus instances with shared configuration
   - Use Thanos or Cortex for long-term storage and global view

2. **Alertmanager**:
   - Run in cluster mode for HA
   - Configure gossip protocol for alert deduplication

3. **DotMac API**:
   - Already horizontally scalable
   - Alert router is stateless
   - Channel configuration should be persisted to database (future enhancement)

### Performance Tuning

1. **Scrape Interval**:
   - Default: 15s
   - High-load: Consider 30s to reduce overhead
   - Critical services: 10s for faster detection

2. **Alert Evaluation**:
   - Default: 15s
   - Adjust based on alert sensitivity requirements

3. **Group Wait/Interval**:
   - `group_wait`: 10s (wait before first notification)
   - `group_interval`: 5m (wait before sending updates)
   - `repeat_interval`: 4h (resend if not resolved)

## Next Steps

1. **Persistent Channel Storage**: Move channel configuration from in-memory to database
2. **Channel Templates**: Pre-configured channel templates for common setups
3. **Alert History**: Store and query historical alerts
4. **Silences API**: API to manage alert silences
5. **Alert Analytics**: Dashboard showing alert frequency, MTTR, etc.
6. **Email/SMS Channels**: Add support for email and SMS notifications
7. **Webhook Retry**: Implement exponential backoff for failed webhooks
8. **Channel Health Monitoring**: Track webhook delivery success rates

## Resources

- [Prometheus Documentation](https://prometheus.io/docs/)
- [Alertmanager Documentation](https://prometheus.io/docs/alerting/latest/alertmanager/)
- [Grafana Documentation](https://grafana.com/docs/)
- [Slack Incoming Webhooks](https://api.slack.com/messaging/webhooks)
- [Discord Webhooks](https://discord.com/developers/docs/resources/webhook)
- [Microsoft Teams Webhooks](https://docs.microsoft.com/en-us/microsoftteams/platform/webhooks-and-connectors/how-to/add-incoming-webhook)
