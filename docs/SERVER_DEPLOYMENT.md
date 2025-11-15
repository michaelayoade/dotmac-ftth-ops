# Server Deployment Guide

This guide covers deploying the DotMac Platform to a production server using Docker Compose.

## Prerequisites

- Docker Engine 20.10+ and Docker Compose v2+
- 4GB+ RAM recommended
- Git (to clone the repository)
- Ports available: 3001, 3002, 8000, 8001, 5432, 6379, 9000

## Quick Start

### 1. Clone and Configure

```bash
# Clone the repository
git clone <repository-url> dotmac-ftth-ops
cd dotmac-ftth-ops

# Copy the server environment configuration
cp .env.server .env

# IMPORTANT: Review and update passwords in .env
# Change all SECRET_KEY values before production use!
nano .env
```

### 2. Deploy Everything

```bash
# This single command will:
# 1. Run pre-flight checks
# 2. Start infrastructure services (PostgreSQL, Redis, MinIO, etc.)
# 3. Start platform backend + admin frontend
# 4. Start ISP backend + operations frontend
# 5. Run database migrations automatically
# 6. Verify all services are healthy
# 7. Display access URLs
make start-all
```

### 3. Access the Platform

After successful deployment, access:

- **Platform Admin UI**: http://your-server:3002
- **ISP Operations UI**: http://your-server:3001
- **Platform API**: http://your-server:8001/docs
- **ISP API**: http://your-server:8000/docs

## Detailed Deployment Steps

### Pre-Flight Validation

Before deploying, verify your environment:

```bash
# Check Docker and dependencies
make check-deps

# Validate environment configuration
make env-validate
```

### Infrastructure Services

The infrastructure includes:
- PostgreSQL (database)
- Redis (cache/sessions)
- MinIO (object storage)
- FreeRADIUS (authentication)
- Jaeger (distributed tracing)
- Prometheus + Grafana (monitoring)
- And more...

Start infrastructure separately if needed:

```bash
# Start only infrastructure
./scripts/infra.sh all start

# Check infrastructure status
./scripts/infra.sh all status
```

### Application Services

**Platform Services** (Multi-tenant control plane):
```bash
# Start platform backend + admin frontend
make start-platform

# View logs
make logs-platform
```

**ISP Services** (ISP operations):
```bash
# Start ISP backend + operations frontend
make start-isp

# View logs
make logs-isp
```

### Database Migrations

Migrations run automatically during `make start-all`. To run manually:

```bash
# Run migrations for both backends
make post-deploy

# Or run for specific backend
make post-deploy-platform
make post-deploy-isp
```

## Configuration

### Environment Variables

The `.env` file uses **double-underscore notation** for nested configs:

```bash
# Correct (Docker Compose format)
DATABASE__HOST=dotmac-postgres
DATABASE__PORT=5432
DATABASE__PASSWORD=dev_local_pg_password_123

# Wrong (won't work)
DATABASE_HOST=dotmac-postgres
```

### Critical Configuration Items

1. **Database Connection**:
   - `DATABASE__HOST=dotmac-postgres` (container name, not localhost!)
   - `DATABASE__PASSWORD` must match `docker-compose.infra.yml`

2. **Redis Connection**:
   - `REDIS__HOST=dotmac-redis` (container name, not localhost!)
   - Password is set in infrastructure file

3. **Storage (MinIO)**:
   - `STORAGE__ENDPOINT=http://dotmac-minio:9000` (container name!)
   - `STORAGE__SECRET_KEY` must match `docker-compose.infra.yml`

4. **Telemetry (Jaeger)**:
   - `OTEL_EXPORTER_OTLP_ENDPOINT=http://dotmac-jaeger:4317` (container name!)

5. **Security**:
   - `SECRET_KEY` - Change this for production!
   - `AUTH__JWT_SECRET_KEY` - Change this for production!

### Port Configuration

Default ports (can be changed in `.env`):

```bash
PLATFORM_BACKEND_PORT=8001
PLATFORM_FRONTEND_PORT=3002
ISP_BACKEND_PORT=8000
ISP_FRONTEND_PORT=3001
```

## Common Issues and Troubleshooting

### Issue: Backend health check timeout

**Symptoms**:
```
✗ Platform backend did not become healthy within 120 seconds
```

**Causes**:
1. Database password mismatch
2. Redis connection failure
3. Missing SECRET_KEY
4. Using `localhost` instead of container names

**Fix**:
```bash
# 1. Check logs
docker logs dotmac-ftth-ops-platform-backend-1

# 2. Verify .env file uses container names (not localhost)
grep "DATABASE__HOST" .env
# Should show: DATABASE__HOST=dotmac-postgres

# 3. Verify passwords match docker-compose.infra.yml
grep "POSTGRES_PASSWORD" docker-compose.infra.yml
grep "DATABASE__PASSWORD" .env
# These must match!

# 4. Restart services
make stop-all
make start-all
```

### Issue: Database authentication failure

**Error**: `password authentication failed for user "dotmac_user"`

**Fix**:
```bash
# Verify password matches infrastructure
grep "POSTGRES_PASSWORD" docker-compose.infra.yml
# Shows: POSTGRES_PASSWORD: dev_local_pg_password_123

# Update .env
DATABASE__PASSWORD=dev_local_pg_password_123

# Restart
make restart-all
```

### Issue: Redis initialization failed

**Error**: `RuntimeError: Redis initialization failed`

**Fix**:
```bash
# Verify Redis host is correct
grep "REDIS__HOST" .env
# Should show: REDIS__HOST=dotmac-redis (NOT localhost)

# Restart
make restart-all
```

### Issue: OTLP connection errors (non-critical)

**Error**: `HTTPConnectionPool(host='localhost', port=4318): Max retries exceeded`

**Fix** (if you want tracing):
```bash
# Update OTLP endpoint to use container name
OTEL_EXPORTER_OTLP_ENDPOINT=http://dotmac-jaeger:4317

# Or disable telemetry
OTEL_ENABLED=false
```

## Management Commands

### Status and Monitoring

```bash
# Check all services
make status-all

# Check specific stack
make status-platform
make status-isp

# View logs (all services)
make logs-all

# View logs (specific service)
./scripts/infra.sh platform logs platform-backend
./scripts/infra.sh isp logs isp-backend
```

### Starting and Stopping

```bash
# Stop all services
make stop-all

# Stop specific stack
make stop-platform
make stop-isp

# Restart all services
make restart-all

# Restart specific stack
make restart-platform
make restart-isp
```

### Database Management

```bash
# Run migrations
make db-migrate

# Create new migration
make db-migrate-create

# Seed database with test data
make db-seed

# Reset database (DESTRUCTIVE!)
make db-reset
```

### Cleanup (DESTRUCTIVE!)

```bash
# Remove all containers and volumes
make clean-all

# Remove specific stack
make clean-platform
make clean-isp
```

## Production Recommendations

### Security

1. **Change all default passwords**:
   ```bash
   # Generate secure secrets
   openssl rand -hex 32

   # Update in .env:
   SECRET_KEY=<generated-secret>
   AUTH__JWT_SECRET_KEY=<generated-secret>
   ```

2. **Update infrastructure passwords** in `docker-compose.infra.yml`:
   - PostgreSQL password
   - Redis password
   - MinIO root password
   - MongoDB password

3. **Enable Vault** for secrets management:
   ```bash
   VAULT__ENABLED=true
   VAULT__URL=http://dotmac-vault:8200
   VAULT__TOKEN=<your-vault-token>
   ```

4. **Enable HTTPS**:
   - Set up reverse proxy (Nginx/Traefik)
   - Configure SSL certificates
   - Update CORS origins in `.env`

### Performance

1. **Increase container resources** (in docker-compose files):
   ```yaml
   platform-backend:
     deploy:
       resources:
         limits:
           cpus: '2'
           memory: 4G
   ```

2. **Configure connection pooling**:
   ```bash
   DATABASE_POOL_SIZE=10
   DATABASE_MAX_OVERFLOW=20
   ```

3. **Enable Redis sessions**:
   ```bash
   REQUIRE_REDIS_SESSIONS=true
   ```

### Monitoring

1. **Access monitoring tools**:
   - Grafana: http://your-server:3000 (admin/admin)
   - Prometheus: http://your-server:9090
   - Jaeger: http://your-server:16686

2. **Configure alerts**:
   - Edit `config/prometheus/alerts.yml`
   - Set up Alertmanager webhook

### Backup

1. **Database backups**:
   ```bash
   # Manual backup
   docker exec dotmac-postgres pg_dump -U dotmac_user dotmac > backup.sql

   # Automated backups (add to crontab)
   0 2 * * * docker exec dotmac-postgres pg_dump -U dotmac_user dotmac | gzip > /backups/dotmac-$(date +%Y%m%d).sql.gz
   ```

2. **Volume backups**:
   ```bash
   # Backup all Docker volumes
   docker run --rm -v dotmac-ftth-ops_postgres_data:/data -v /backups:/backup alpine tar czf /backup/postgres-data.tar.gz /data
   ```

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   Infrastructure Layer                   │
│  (PostgreSQL, Redis, MinIO, FreeRADIUS, Monitoring)    │
└─────────────────────────────────────────────────────────┘
                           │
          ┌────────────────┴────────────────┐
          │                                  │
┌─────────▼─────────┐              ┌────────▼────────┐
│  Platform Stack   │              │   ISP Stack     │
│  ┌──────────────┐ │              │ ┌──────────────┐│
│  │   Backend    │ │              │ │   Backend    ││
│  │  (Port 8001) │ │              │ │  (Port 8000) ││
│  └──────────────┘ │              │ └──────────────┘│
│  ┌──────────────┐ │              │ ┌──────────────┐│
│  │   Frontend   │ │              │ │   Frontend   ││
│  │  (Port 3002) │ │              │ │  (Port 3001) ││
│  └──────────────┘ │              │ └──────────────┘│
└───────────────────┘              └─────────────────┘
```

## Support

For issues or questions:

1. Check logs: `make logs-all`
2. Verify configuration: `make env-validate`
3. Review this guide's troubleshooting section
4. Check GitHub issues

## Next Steps

After successful deployment:

1. Create admin user via API
2. Configure tenants (multi-tenant mode)
3. Set up monitoring alerts
4. Configure external integrations (GenieACS, NetBox, etc.)
5. Import network inventory
6. Configure RADIUS NAS devices
