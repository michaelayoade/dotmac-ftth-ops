# Production Deployment Guide

## Overview

This guide covers deploying the DotMac Platform Services to production using Docker Compose and best practices for security, performance, and reliability.

## Prerequisites

- Docker Engine 24.0+ and Docker Compose 2.20+
- Valid SSL certificates for HTTPS
- Domain name with DNS configured
- Access to a Docker registry (optional, for CI/CD)
- Production secrets and credentials

## Environment Setup

### 1. Create Production Environment File

```bash
# Copy the example environment file
cp .env.prod.example .env.prod

# Edit with your production values
nano .env.prod
```

**Critical configurations to update:**
- All passwords and secrets (use strong, unique values)
- Database credentials
- JWT secret keys
- API keys for external services
- Domain names and URLs
- Email/SMTP configuration (if needed)

### 2. Generate Secure Secrets

```bash
# Generate secure random passwords
openssl rand -base64 32  # For passwords
openssl rand -hex 32      # For API keys
```

### 3. SSL Certificate Setup

Place your SSL certificates in the nginx directory:

```bash
mkdir -p nginx/ssl
cp /path/to/cert.pem nginx/ssl/
cp /path/to/key.pem nginx/ssl/
cp /path/to/chain.pem nginx/ssl/  # For OCSP stapling
```

> **Compose overlay update**
> The production stack now builds on `docker-compose.base.yml`. Use it together with the environment overlay:
> ```bash
> docker compose -f docker-compose.production.yml up -d
> ```
> Optional components (Celery, observability, storage) are enabled automatically by the overlay, so you no longer need separate compose files. Any legacy references to `docker-compose.prod.yml` in this document refer to `docker-compose.production.yml`.

## Deployment Steps

### 1. Build Production Images

```bash
# Build with specific version tag
export APP_VERSION=1.0.0
docker compose -f docker-compose.production.yml build

# Or build and tag for registry
docker build -f Dockerfile.prod \
  --target api \
  --build-arg APP_VERSION=$APP_VERSION \
  -t registry.example.com/dotmac-api:$APP_VERSION .
```

### 2. Initialize Services

```bash
# Start infrastructure services first
docker compose -f docker-compose.production.yml up -d postgres redis vault minio

# Wait for services to be healthy
docker compose -f docker-compose.production.yml ps

# Initialize Vault/OpenBao
docker compose -f docker-compose.production.yml exec vault vault operator init
# Save the unseal keys and root token securely!

# Unseal Vault
docker compose -f docker-compose.production.yml exec vault vault operator unseal <key1>
docker compose -f docker-compose.production.yml exec vault vault operator unseal <key2>
docker compose -f docker-compose.production.yml exec vault vault operator unseal <key3>
```

### 3. Run Database Migrations

```bash
# Run migrations before starting API
docker compose -f docker-compose.production.yml run --rm app migrate
```

### 4. Start Application Services

```bash
# Start all services
docker compose -f docker-compose.production.yml up -d

# Or start with specific scale
docker compose -f docker-compose.production.yml up -d --scale app=3 --scale celery-worker=2
```

### 5. Verify Deployment

```bash
# Check service health
docker compose -f docker-compose.production.yml ps

# Check API health endpoint
curl https://api.example.com/health

# View logs
docker compose -f docker-compose.production.yml logs -f app

# Monitor resource usage
docker stats
```

## Security Hardening

### 1. Docker Security

```bash
# Use Docker secrets for sensitive data
echo "your-secret-password" | docker secret create postgres_password -
echo "your-redis-password" | docker secret create redis_password -

# Update docker-compose.prod.yml to use secrets
# See the secrets section in the compose file
```

### 2. Network Security

- Backend network is internal-only
- Only Nginx exposed to internet
- Use firewall rules (iptables/ufw)

```bash
# Example UFW rules
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 22/tcp  # SSH
ufw enable
```

### 3. File Permissions

```bash
# Secure environment file
chmod 600 .env.prod
chown root:root .env.prod

# Secure SSL certificates
chmod 600 nginx/ssl/*.pem
```

## Monitoring & Observability

### 1. Enable Monitoring Stack

```bash
# Deploy monitoring services (optional)
docker compose -f docker-compose.monitoring.yml up -d
```

### 2. Access Monitoring Dashboards

- Prometheus: http://localhost:9090
- Grafana: http://localhost:3000
- OpenTelemetry Collector metrics

### 3. Set Up Alerts

Configure alerts in Grafana or use external services like PagerDuty.

## Backup & Recovery

### 1. Database Backup

```bash
# Manual backup
docker compose -f docker-compose.prod.yml exec postgres \
  pg_dump -U $POSTGRES_USER $POSTGRES_DB | gzip > backup_$(date +%Y%m%d).sql.gz

# Automated backup (add to cron)
0 2 * * * /path/to/backup-script.sh
```

### 2. Volume Backup

```bash
# Backup all volumes
docker run --rm -v dotmac-platform-services_postgres_data:/data \
  -v $(pwd)/backups:/backup \
  alpine tar czf /backup/postgres_data_$(date +%Y%m%d).tar.gz /data
```

### 3. Restore Procedures

```bash
# Restore database
gunzip < backup_20240101.sql.gz | docker compose -f docker-compose.prod.yml exec -T postgres \
  psql -U $POSTGRES_USER $POSTGRES_DB

# Restore volumes
docker run --rm -v dotmac-platform-services_postgres_data:/data \
  -v $(pwd)/backups:/backup \
  alpine tar xzf /backup/postgres_data_20240101.tar.gz
```

## Scaling & Performance

### 1. Horizontal Scaling

```bash
# Scale API instances
docker compose -f docker-compose.prod.yml up -d --scale api=5

# Scale workers
docker compose -f docker-compose.prod.yml up -d --scale celery-worker=4
```

### 2. Resource Limits

Resource limits are configured in docker-compose.prod.yml:
- API: 2 CPU, 2GB memory
- Celery Worker: 1 CPU, 1GB memory
- Database: 2GB memory
- Redis: 1GB memory

Adjust based on your workload.

### 3. Performance Tuning

- Nginx caching enabled for GET requests
- PostgreSQL connection pooling configured
- Redis memory policy set to LRU
- Gunicorn workers optimized

## Maintenance

### 1. Rolling Updates

```bash
# Build new version
export NEW_VERSION=1.0.1
docker compose -f docker-compose.prod.yml build

# Rolling update for API
docker compose -f docker-compose.prod.yml up -d --no-deps --scale api=6 api
# Wait for new instances to be healthy
docker compose -f docker-compose.prod.yml up -d --no-deps --scale api=3 api
```

### 2. Health Checks

All services have health checks configured:
- API: `/health` endpoint
- Celery: `celery inspect ping`
- Database: `pg_isready`
- Redis: `redis-cli ping`

### 3. Log Management

```bash
# Configure log rotation
cat > /etc/docker/daemon.json <<EOF
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "100m",
    "max-file": "10"
  }
}
EOF

# Restart Docker daemon
systemctl restart docker
```

## Troubleshooting

### Common Issues

1. **Service won't start**
   ```bash
   docker compose -f docker-compose.prod.yml logs service-name
   docker compose -f docker-compose.prod.yml exec service-name sh
   ```

2. **Database connection errors**
   ```bash
   # Check connectivity
   docker compose -f docker-compose.prod.yml exec api nc -zv postgres 5432
   ```

3. **Memory issues**
   ```bash
   # Check memory usage
   docker stats
   # Increase limits in docker-compose.prod.yml
   ```

4. **SSL certificate errors**
   ```bash
   # Verify certificates
   openssl x509 -in nginx/ssl/cert.pem -text -noout
   ```

### Debug Mode

```bash
# Run in debug mode
LOG_LEVEL=debug docker compose -f docker-compose.prod.yml up api
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Deploy to Production

on:
  push:
    tags:
      - 'v*'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2

      - name: Build and push
        run: |
          docker build -f Dockerfile.prod \
            --target api \
            --build-arg APP_VERSION=${{ github.ref_name }} \
            -t ${{ secrets.REGISTRY }}/dotmac-api:${{ github.ref_name }} .
          docker push ${{ secrets.REGISTRY }}/dotmac-api:${{ github.ref_name }}

      - name: Deploy
        run: |
          ssh ${{ secrets.PROD_HOST }} "cd /opt/dotmac && \
            docker compose -f docker-compose.prod.yml pull && \
            docker compose -f docker-compose.prod.yml up -d"
```

## Production Checklist

Before going live:

- [ ] All secrets changed from defaults
- [ ] SSL certificates installed and valid
- [ ] Firewall rules configured
- [ ] Backup strategy implemented
- [ ] Monitoring and alerts configured
- [ ] Log rotation set up
- [ ] Resource limits appropriate for load
- [ ] Health checks passing
- [ ] Database migrations completed
- [ ] Vault/secrets management initialized
- [ ] Rate limiting configured
- [ ] CORS settings appropriate
- [ ] Security headers enabled
- [ ] Error tracking configured (Sentry)
- [ ] Documentation updated

## Support

For issues or questions:
- Check logs: `docker compose -f docker-compose.prod.yml logs`
- Review health status: `curl https://api.example.com/health`
- Monitor metrics: Access Grafana dashboards
- Contact: support@example.com
