# Prometheus Monitoring Configuration

This directory contains comprehensive Prometheus configurations for production deployments.

## Configuration Files

### 1. `prometheus.yml` (This File)
**Status**: ⚠️ **FOR REFERENCE ONLY - NOT PRODUCTION READY**

This is a comprehensive configuration template that shows what a **full production monitoring stack** would look like. However, **most of the services referenced here are NOT included** in the current `docker-compose` files.

**Missing Services** (will cause `ServiceDown` alerts if used as-is):
- `node-exporter:9100` - System metrics exporter
- `cadvisor:8080` - Container metrics exporter
- `postgres-exporter:9187` - PostgreSQL metrics exporter
- `redis-exporter:9121` - Redis metrics exporter
- `statsd-exporter:9102` - StatsD metrics exporter
- `alertmanager:9093` - Alert routing and management
- `traefik:8080` - Load balancer for blue/green deployments
- `flower:5555` - Celery monitoring UI
- `app-blue`/`app-green` - Blue/green deployment variants
- `frontend`, `frontend-blue`, `frontend-green` - Frontend service variants

**When to Use This**:
- Production deployments with full observability stack
- When you've added all the missing exporters to your infrastructure
- Reference for building out comprehensive monitoring

### 2. `/prometheus.yml` (Root Config) - **CURRENT DEFAULT**
**Status**: ✅ **READY TO USE**

This is a **minimal working configuration** that can be pointed at the active backend service (`platform-backend`) when you run the simplified Compose stack. If you host Prometheus separately, update the scrape target to match where the backend is exposed.

**Services Monitored** (default targets):
- `platform-backend:8000` - FastAPI application metrics endpoint
- `otel-collector:8888` - OpenTelemetry collector (if deployed alongside your own observability stack)

**When to Use This**:
- Development environments
- Quick local testing
- CI/CD pipelines
- When you don't need comprehensive infrastructure monitoring

## Deployment Scenarios

### Scenario 1: Development (Current Setup)
```bash
# Use root prometheus.yml
docker-compose up -d

# Prometheus uses: /prometheus.yml
# Monitors: app, otel-collector (if observability profile active)
```

### Scenario 2: Production with Full Monitoring Stack

**Step 1**: Add missing services to `docker-compose` or Kubernetes:

```yaml
# Add to docker-compose.yml or equivalent
services:
  node-exporter:
    image: prom/node-exporter:latest
    ports:
      - "9100:9100"

  cadvisor:
    image: gcr.io/cadvisor/cadvisor:latest
    ports:
      - "8080:8080"

  postgres-exporter:
    image: prometheuscommunity/postgres-exporter:latest
    environment:
      DATA_SOURCE_NAME: "postgresql://user:pass@postgres:5432/db"
    ports:
      - "9187:9187"

  redis-exporter:
    image: oliver006/redis_exporter:latest
    environment:
      REDIS_ADDR: "redis:6379"
    ports:
      - "9121:9121"

  alertmanager:
    image: prom/alertmanager:latest
    ports:
      - "9093:9093"
    volumes:
      - ./monitoring/alertmanager/config.yml:/etc/alertmanager/config.yml
```

**Step 2**: Update Prometheus to use comprehensive config:

```yaml
# In docker-compose.base.yml, change:
prometheus:
  volumes:
    - ./monitoring/prometheus/prometheus.yml:/etc/prometheus/prometheus.yml:ro  # Use comprehensive config
    - ./monitoring/prometheus/alerts.yml:/etc/prometheus/alerts.yml:ro
```

**Step 3**: Verify all targets are reachable:

```bash
# Check Prometheus targets page
open http://localhost:9090/targets

# All targets should show "UP" status
```

## Alert Rules (`alerts.yml`)

The alert rules in `monitoring/prometheus/alerts.yml` are designed for the **comprehensive monitoring setup**. They will trigger `ServiceDown` alerts for missing services.

**If using root `/prometheus.yml`**: The alerting rules won't work correctly since `alerts.yml` is not loaded.

**If using this directory's config**: Ensure all exporters are deployed first, or comment out rules for missing services.

## Recommendation

**For most users**: Stick with the root `/prometheus.yml` until you're ready to deploy a full production monitoring stack with all exporters.

**For production deployments**: Follow the "Scenario 2" guide above to add all required services, then switch to this comprehensive configuration.

## Source of Truth

| File | Status | Use Case |
|------|--------|----------|
| `/prometheus.yml` | ✅ **Active Default** | Development, CI/CD, minimal monitoring |
| `/monitoring/prometheus/prometheus.yml` | ⚠️ Reference Only | Production template (requires additional services) |
| `/monitoring/prometheus/alerts.yml` | ⚠️ Reference Only | Production alerting (requires alertmanager + all exporters) |

## Next Steps

To enable comprehensive monitoring:

1. **Add Missing Exporters** to `docker-compose.base.yml`
2. **Deploy Alertmanager** with proper routing configuration
3. **Test All Targets** before enabling alerts
4. **Update Grafana Dashboards** to use new metrics
5. **Switch Prometheus Config** to use `/monitoring/prometheus/prometheus.yml`

## Questions?

See the [DotMac Platform Monitoring Documentation](../../docs/MONITORING.md) for more details.
