# Alertmanager Webhook Authentication Setup Guide

This guide documents how to configure and deploy the Alertmanager webhook integration with secure authentication using Vault/OpenBao.

## Overview

The DotMac Platform provides a secure Alertmanager webhook endpoint that:
- ✅ Authenticates incoming alerts using shared secrets from Vault
- ✅ Supports multiple authentication methods (header, bearer token, query parameter)
- ✅ Includes rate limiting to prevent abuse
- ✅ Routes alerts to tenant-specific notification channels
- ✅ Provides structured logging for monitoring and debugging

**Implementation Status**: ✅ **FULLY IMPLEMENTED** (as of Phase 1 BSS enhancements)

## Architecture

```
┌─────────────────┐        ┌──────────────────┐        ┌─────────────────────┐
│  Prometheus     │───────▶│  Alertmanager    │───────▶│  DotMac Platform    │
│  (Alert Rules)  │        │  (Webhook Config)│        │  (Webhook Endpoint) │
└─────────────────┘        └──────────────────┘        └─────────────────────┘
                                     │                            │
                                     │                            ▼
                           ┌─────────▼──────────┐      ┌─────────────────────┐
                           │  Vault/OpenBao     │◀─────│  Secrets Loader     │
                           │  (Shared Secret)   │      │  (Startup)          │
                           └────────────────────┘      └─────────────────────┘
```

### Key Components

1. **Webhook Endpoint**: `/api/v1/alerts/webhook` (authenticated)
2. **Authentication Function**: `_authenticate_alertmanager_webhook()` in `src/dotmac/platform/monitoring/alert_router.py:251-292`
3. **Vault Secret Path**: `observability/alertmanager/webhook_secret`
4. **Settings Key**: `settings.observability.alertmanager_webhook_secret`
5. **Rate Limit**: Configurable via `settings.observability.alertmanager_rate_limit`

## Prerequisites

Before configuring the webhook, ensure:

1. **Vault/OpenBao is running** and accessible from the DotMac Platform
2. **Vault authentication** is configured (AppRole, token, etc.)
3. **Alertmanager** is deployed and can reach the DotMac Platform API
4. **Network connectivity** exists between Alertmanager and the platform

## Step 1: Generate Webhook Secret

Generate a strong random token for webhook authentication:

```bash
# Generate a 32-byte random token (recommended)
openssl rand -base64 32

# Example output:
# 8fJ3kL9mN2pQ5rS7tU1vW3xY6zA4bC8dE0fG2hI5jK8
```

**Security Recommendations**:
- ✅ Use at least 32 bytes of entropy (256 bits)
- ✅ Store only in Vault (never in environment variables or config files)
- ✅ Rotate regularly (every 90 days recommended)
- ✅ Use different secrets for different environments (dev/staging/prod)

## Step 2: Store Secret in Vault

Store the generated token in Vault at the expected path:

### For Vault KV v2 (default):

```bash
# Set the secret in Vault
vault kv put secret/observability/alertmanager/webhook_secret \
  value="8fJ3kL9mN2pQ5rS7tU1vW3xY6zA4bC8dE0fG2hI5jK8"

# Verify the secret was stored
vault kv get secret/observability/alertmanager/webhook_secret
```

### For Vault KV v1:

```bash
# Set the secret in Vault
vault kv put secret/observability/alertmanager/webhook_secret \
  value="8fJ3kL9mN2pQ5rS7tU1vW3xY6zA4bC8dE0fG2hI5jK8"
```

### Verify Vault Mapping

The platform automatically loads this secret on startup via the mapping in `src/dotmac/platform/secrets/secrets_loader.py:99`:

```python
SECRETS_MAPPING = {
    # ...
    "observability.alertmanager_webhook_secret": "observability/alertmanager/webhook_secret",
    # ...
}
```

## Step 3: Configure DotMac Platform

### Environment Variables

Ensure the following environment variables are set:

```bash
# Vault Configuration (required for secret loading)
VAULT_ENABLED=true
VAULT_ADDR=https://vault.example.com:8200
VAULT_TOKEN=<vault-token>
VAULT_NAMESPACE=<vault-namespace>  # Optional
VAULT_MOUNT_PATH=secret  # KV mount path

# Environment (affects validation behavior)
DOTMAC_ENVIRONMENT=production  # production|staging|development

# Optional: Rate limiting (defaults to 10/minute)
ALERTMANAGER_RATE_LIMIT=10/minute
```

### Startup Validation

On startup, the platform:

1. ✅ Validates production security settings (`main.py:72`)
2. ✅ Loads secrets from Vault (`main.py:172`)
3. ✅ Validates critical secrets in production (`secrets_loader.py:410`)

**Production Validation** includes checking that the Alertmanager webhook secret is set:

```python
webhook_secret = getattr(settings.observability, "alertmanager_webhook_secret", None)
if not webhook_secret:
    errors.append("Alertmanager webhook secret must be set")
```

If the secret is missing in production, the application **will fail to start** with a clear error message.

### Verify Secret Loading

Check application logs on startup for:

```
✅ secrets.load.success source=vault emoji=✅
```

If secret loading fails:

```
⚠️ secrets.load.failed source=vault error="..." emoji=⚠️
```

## Step 4: Configure Alertmanager

Update your Alertmanager configuration to send alerts to the DotMac Platform webhook:

### Option A: X-Alertmanager-Token Header (Recommended)

```yaml
# alertmanager.yml
receivers:
  - name: 'dotmac-webhook'
    webhook_configs:
      - url: 'https://platform.example.com/api/v1/alerts/webhook'
        send_resolved: true
        http_config:
          headers:
            X-Alertmanager-Token: "8fJ3kL9mN2pQ5rS7tU1vW3xY6zA4bC8dE0fG2hI5jK8"
        max_alerts: 0  # No limit on alerts per notification

route:
  receiver: 'dotmac-webhook'
  group_by: ['alertname', 'severity']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 12h
```

### Option B: Bearer Token Authentication

```yaml
# alertmanager.yml
receivers:
  - name: 'dotmac-webhook'
    webhook_configs:
      - url: 'https://platform.example.com/api/v1/alerts/webhook'
        send_resolved: true
        http_config:
          authorization:
            credentials: "8fJ3kL9mN2pQ5rS7tU1vW3xY6zA4bC8dE0fG2hI5jK8"
```

### Option C: Query Parameter (Less Secure)

```yaml
# alertmanager.yml
receivers:
  - name: 'dotmac-webhook'
    webhook_configs:
      - url: 'https://platform.example.com/api/v1/alerts/webhook?token=8fJ3kL9mN2pQ5rS7tU1vW3xY6zA4bC8dE0fG2hI5jK8'
        send_resolved: true
```

**⚠️ Warning**: Query parameter authentication is less secure as tokens may appear in logs. Use header or bearer token authentication in production.

### Multi-Tenant Configuration

For multi-tenant deployments, configure different webhook URLs or routes per tenant:

```yaml
# alertmanager.yml
route:
  receiver: 'default'
  routes:
    # Tenant-specific routes
    - match:
        tenant_id: 'tenant-alpha'
      receiver: 'dotmac-tenant-alpha'
    - match:
        tenant_id: 'tenant-beta'
      receiver: 'dotmac-tenant-beta'

receivers:
  - name: 'dotmac-tenant-alpha'
    webhook_configs:
      - url: 'https://platform.example.com/api/v1/alerts/webhook'
        http_config:
          headers:
            X-Alertmanager-Token: "8fJ3kL9mN2pQ5rS7tU1vW3xY6zA4bC8dE0fG2hI5jK8"
            X-Tenant-ID: "tenant-alpha"

  - name: 'dotmac-tenant-beta'
    webhook_configs:
      - url: 'https://platform.example.com/api/v1/alerts/webhook'
        http_config:
          headers:
            X-Alertmanager-Token: "8fJ3kL9mN2pQ5rS7tU1vW3xY6zA4bC8dE0fG2hI5jK8"
            X-Tenant-ID: "tenant-beta"
```

## Step 5: Test Webhook Authentication

### Test 1: Manual Authentication Test

Test authentication without a full alert payload:

```bash
# Test with X-Alertmanager-Token header
curl -X POST https://platform.example.com/api/v1/alerts/webhook \
  -H "X-Alertmanager-Token: 8fJ3kL9mN2pQ5rS7tU1vW3xY6zA4bC8dE0fG2hI5jK8" \
  -H "Content-Type: application/json" \
  -d '{
    "version": "4",
    "groupKey": "{}:{severity=\"critical\"}",
    "status": "firing",
    "receiver": "test",
    "groupLabels": {"severity": "critical"},
    "commonLabels": {"alertname": "TestAlert"},
    "commonAnnotations": {},
    "externalURL": "http://alertmanager.local",
    "alerts": []
  }'

# Expected: HTTP 202 Accepted
```

### Test 2: Invalid Token (Should Fail)

```bash
# Test with invalid token
curl -X POST https://platform.example.com/api/v1/alerts/webhook \
  -H "X-Alertmanager-Token: invalid-token" \
  -H "Content-Type: application/json" \
  -d '{"alerts": []}'

# Expected: HTTP 401 Unauthorized
# Response: {"detail": "Invalid or missing Alertmanager webhook token"}
```

### Test 3: No Token (Should Fail)

```bash
# Test without token
curl -X POST https://platform.example.com/api/v1/alerts/webhook \
  -H "Content-Type: application/json" \
  -d '{"alerts": []}'

# Expected: HTTP 401 Unauthorized
```

### Test 4: Full Alert Payload

```bash
# Send a test alert with full payload
curl -X POST https://platform.example.com/api/v1/alerts/webhook \
  -H "X-Alertmanager-Token: 8fJ3kL9mN2pQ5rS7tU1vW3xY6zA4bC8dE0fG2hI5jK8" \
  -H "Content-Type: application/json" \
  -d '{
    "version": "4",
    "groupKey": "{}:{severity=\"critical\"}",
    "status": "firing",
    "receiver": "dotmac-webhook",
    "groupLabels": {"severity": "critical"},
    "commonLabels": {
      "alertname": "HighMemoryUsage",
      "severity": "critical",
      "instance": "node-01"
    },
    "commonAnnotations": {
      "summary": "High memory usage detected",
      "description": "Memory usage is above 90% on node-01"
    },
    "externalURL": "http://alertmanager.example.com",
    "alerts": [
      {
        "status": "firing",
        "labels": {
          "alertname": "HighMemoryUsage",
          "severity": "critical",
          "instance": "node-01"
        },
        "annotations": {
          "summary": "High memory usage detected",
          "description": "Memory usage is above 90% on node-01"
        },
        "startsAt": "2025-10-28T10:00:00Z",
        "endsAt": "0001-01-01T00:00:00Z",
        "generatorURL": "http://prometheus.example.com/graph?g0.expr=...",
        "fingerprint": "a1b2c3d4e5f6g7h8"
      }
    ]
  }'

# Expected: HTTP 202 Accepted
```

### Test 5: Rate Limiting Test

```bash
# Rapidly send multiple requests to test rate limiting
for i in {1..15}; do
  curl -X POST https://platform.example.com/api/v1/alerts/webhook \
    -H "X-Alertmanager-Token: 8fJ3kL9mN2pQ5rS7tU1vW3xY6zA4bC8dE0fG2hI5jK8" \
    -H "Content-Type: application/json" \
    -d '{"alerts": []}' &
done
wait

# Expected: First 10 succeed (HTTP 202), remaining return HTTP 429 Too Many Requests
```

## Step 6: Monitor and Verify

### Check Application Logs

Monitor structured logs for webhook activity:

#### Successful Authentication:

```json
{
  "event": "alertmanager.webhook.received",
  "status": "firing",
  "alert_count": 1,
  "group_key": "{}:{severity=\"critical\"}"
}
```

#### Failed Authentication:

```json
{
  "event": "alertmanager.webhook.auth_failed",
  "reason": "invalid_token",
  "client_ip": "192.168.1.100"
}
```

#### Rate Limit Exceeded:

```json
{
  "event": "alertmanager.webhook.rate_limit_exceeded",
  "client_ip": "192.168.1.100",
  "retry_after": 60
}
```

### Prometheus Metrics

Monitor webhook performance via Prometheus metrics (if enabled):

```promql
# Webhook request rate
rate(http_requests_total{path="/api/v1/alerts/webhook"}[5m])

# Authentication failures
rate(http_requests_total{path="/api/v1/alerts/webhook", status="401"}[5m])

# Rate limit hits
rate(http_requests_total{path="/api/v1/alerts/webhook", status="429"}[5m])

# Webhook processing latency
histogram_quantile(0.95,
  rate(http_request_duration_seconds_bucket{path="/api/v1/alerts/webhook"}[5m])
)
```

### Health Checks

Verify webhook endpoint health:

```bash
# Platform health check
curl https://platform.example.com/health

# Expected:
{
  "status": "healthy",
  "version": "1.0.0",
  "environment": "production"
}
```

## Troubleshooting

### Issue 1: Authentication Always Fails (401)

**Symptoms**:
- All webhook requests return 401 Unauthorized
- Logs show: `alertmanager.webhook.auth_failed`

**Possible Causes**:
1. Secret not loaded from Vault on startup
2. Token mismatch (whitespace, encoding issues)
3. Vault connection failure

**Solutions**:

```bash
# 1. Check if secret is set in Vault
vault kv get secret/observability/alertmanager/webhook_secret

# 2. Verify secret value matches Alertmanager config (no extra whitespace)
# In Python, check: settings.observability.alertmanager_webhook_secret

# 3. Check startup logs for secret loading
grep "secrets.load" /var/log/dotmac-platform/startup.log

# 4. Restart application to reload secrets
systemctl restart dotmac-platform
```

### Issue 2: Rate Limiting Too Aggressive

**Symptoms**:
- Legitimate alerts receive 429 Too Many Requests
- High volume of rate limit errors in logs

**Solutions**:

```bash
# 1. Increase rate limit in environment
export ALERTMANAGER_RATE_LIMIT="100/minute"

# 2. Use grouped alerts in Alertmanager to reduce request volume
# In alertmanager.yml:
route:
  group_by: ['alertname', 'severity', 'instance']
  group_wait: 30s  # Wait to group more alerts
  group_interval: 5m  # Don't send grouped alerts more often than this

# 3. Restart application
systemctl restart dotmac-platform
```

### Issue 3: Webhook Never Receives Alerts

**Symptoms**:
- No webhook requests appear in logs
- Alertmanager shows webhook as configured

**Solutions**:

```bash
# 1. Check network connectivity from Alertmanager to Platform
curl -v https://platform.example.com/health

# 2. Check Alertmanager logs for webhook errors
kubectl logs -n monitoring alertmanager-0

# 3. Verify alertmanager.yml configuration
amtool config show --alertmanager.url=http://localhost:9093

# 4. Test with manual alert
amtool alert add test_alert --alertmanager.url=http://localhost:9093
```

### Issue 4: Secret Not Loaded from Vault

**Symptoms**:
- Startup logs show: `secrets.load.failed`
- Application uses default/empty secret

**Solutions**:

```bash
# 1. Verify Vault is accessible
vault status

# 2. Check Vault token is valid
vault token lookup

# 3. Verify secret path exists
vault kv list secret/observability/

# 4. Check application Vault configuration
env | grep VAULT

# 5. Test secret read with application credentials
vault kv get secret/observability/alertmanager/webhook_secret

# 6. Check Vault policies allow reading this path
vault policy read dotmac-platform-policy
```

### Issue 5: Production Startup Fails

**Symptoms**:
- Application fails to start in production
- Error: "Alertmanager webhook secret must be set"

**Solution**:

This is **expected behavior** in production. The platform enforces that critical secrets are properly configured.

```bash
# 1. Ensure secret is in Vault
vault kv put secret/observability/alertmanager/webhook_secret \
  value="<your-strong-token>"

# 2. Verify Vault configuration is correct
echo $VAULT_ADDR
echo $VAULT_TOKEN

# 3. Test secret loading manually
python3 -c "
from dotmac.platform.secrets import load_secrets_from_vault_sync
from dotmac.platform.settings import settings
load_secrets_from_vault_sync()
print('Secret loaded:', bool(settings.observability.alertmanager_webhook_secret))
"

# 4. Restart application
systemctl restart dotmac-platform
```

## Security Best Practices

### Token Management

1. ✅ **Rotate tokens regularly** (every 90 days minimum)
2. ✅ **Use different tokens per environment** (dev/staging/prod)
3. ✅ **Store tokens only in Vault** (never in code or env files)
4. ✅ **Use long random tokens** (32+ bytes)
5. ✅ **Monitor for authentication failures** (may indicate token compromise)

### Network Security

1. ✅ **Use HTTPS/TLS** for webhook endpoint
2. ✅ **Restrict network access** (firewall rules)
3. ✅ **Use private networking** when possible
4. ✅ **Enable rate limiting** (prevent DoS)
5. ✅ **Monitor webhook traffic** (detect anomalies)

### Audit and Compliance

1. ✅ **Log all authentication attempts** (success and failure)
2. ✅ **Monitor for suspicious patterns** (repeated failures, unusual sources)
3. ✅ **Review access logs regularly**
4. ✅ **Alert on authentication failures**
5. ✅ **Maintain audit trail** (who configured what, when)

## Integration Tests

The platform includes comprehensive tests for webhook authentication in `tests/monitoring/test_alert_router.py`:

### Test Coverage:

```python
# Test 1: Webhook requires shared secret (lines 232-242)
async def test_alertmanager_webhook_requires_shared_secret(app: FastAPI):
    """Verify that webhook rejects requests without valid token."""
    response = await _request(app, admin, "POST", "/api/v1/alerts/webhook", json=payload)
    assert response.status_code == status.HTTP_401_UNAUTHORIZED

# Test 2: Webhook accepts valid secret (lines 246-257)
async def test_alertmanager_webhook_accepts_valid_secret(app: FastAPI):
    """Verify that webhook accepts requests with valid token."""
    response = await _request(
        app, admin, "POST", "/api/v1/alerts/webhook",
        json=payload,
        headers={"X-Alertmanager-Token": "test-secret"}
    )
    assert response.status_code == status.HTTP_202_ACCEPTED
```

### Run Tests:

```bash
# Run all monitoring tests
poetry run pytest tests/monitoring/ -v

# Run only webhook authentication tests
poetry run pytest tests/monitoring/test_alert_router.py::test_alertmanager_webhook_requires_shared_secret -v
poetry run pytest tests/monitoring/test_alert_router.py::test_alertmanager_webhook_accepts_valid_secret -v
```

## References

### Implementation Files:

- **Webhook Router**: `src/dotmac/platform/monitoring/alert_router.py:251-292`
- **Secrets Loader**: `src/dotmac/platform/secrets/secrets_loader.py:99`
- **Application Startup**: `src/dotmac/platform/main.py:172`
- **Settings**: `src/dotmac/platform/settings.py:97-103`
- **Tests**: `tests/monitoring/test_alert_router.py:232,246`

### External Documentation:

- [Prometheus Alertmanager Configuration](https://prometheus.io/docs/alerting/latest/configuration/)
- [Alertmanager Webhook Format](https://prometheus.io/docs/alerting/latest/configuration/#webhook_config)
- [Vault KV Secrets Engine](https://www.vaultproject.io/docs/secrets/kv)
- [OpenBao Documentation](https://openbao.org/docs/)

## Support

For issues or questions:

1. **Check logs**: Review application and Alertmanager logs
2. **Run tests**: Verify authentication tests pass locally
3. **Consult docs**: Review this guide and Alertmanager docs
4. **File issue**: Create detailed issue with logs and configuration

---

**Document Version**: 1.0.0
**Last Updated**: 2025-10-28
**Status**: ✅ Production Ready
