# Staging Deployment Guide

Comprehensive guide for automating deployments to your staging/demo environment.

> **Compose overlay update**
> Use `docker-compose.staging.yml` together with the shared `docker-compose.base.yml`. Any historical references to other staging compose files should be swapped to the new overlay.

---

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Initial Server Setup](#initial-server-setup)
4. [GitHub Configuration](#github-configuration)
5. [First Deployment](#first-deployment)
6. [Ongoing Deployments](#ongoing-deployments)
7. [Monitoring & Troubleshooting](#monitoring--troubleshooting)
8. [Demo Environment Management](#demo-environment-management)

---

## Overview

### Deployment Architecture

```
┌──────────────┐
│              │
│    GitHub    │  Push to main/develop
│  Repository  │
│              │
└──────┬───────┘
       │
       │ Webhook Trigger
       │
       ▼
┌──────────────────────────────┐
│                              │
│   GitHub Actions CI/CD       │
│   - Build & Test             │
│   - Build Docker Images      │
│   - Push to Registry         │
│                              │
└──────────┬───────────────────┘
           │
           │ SSH Deployment
           │
           ▼
┌──────────────────────────────┐
│                              │
│   Staging Server             │
│   - Pull latest images       │
│   - Run migrations           │
│   - Restart services         │
│   - Health checks            │
│                              │
└──────────────────────────────┘
```

### What Gets Automated

✅ **Continuous Integration**:
- Linting and type checking
- Unit and integration tests
- Security scanning
- Docker image builds

✅ **Continuous Deployment**:
- Zero-downtime deployments
- Database migrations
- Demo data seeding
- E2E testing on staging
- Slack/email notifications

✅ **Monitoring**:
- Health check verification
- Performance testing (Lighthouse)
- Error tracking
- Metrics collection

---

## Prerequisites

### Required Tools

Install these on your **local machine**:

```bash
# GitHub CLI (for secrets management)
brew install gh  # macOS
# or
sudo apt install gh  # Ubuntu

# SSH (should be pre-installed)
ssh -V

# Docker (for local testing)
brew install docker  # macOS
# or
sudo apt install docker.io docker-compose  # Ubuntu
```

### Staging Server Requirements

**Minimum Specifications**:
- **OS**: Ubuntu 22.04 LTS or newer
- **CPU**: 4 cores
- **RAM**: 8 GB
- **Storage**: 50 GB SSD
- **Network**: Public IP address with ports 80, 443 open

**Recommended Providers**:
- DigitalOcean: $48/month (4 vCPU, 8 GB RAM)
- AWS EC2: t3.large ($0.0832/hour)
- Hetzner: €17/month (4 vCPU, 8 GB RAM)
- Azure: B4ms ($140/month)

---

## Initial Server Setup

### Step 1: Create Staging Server

**Option A: DigitalOcean** (Recommended for simplicity):

```bash
# Create a droplet via the web interface or CLI
doctl compute droplet create dotmac-staging \
  --region nyc3 \
  --image ubuntu-22-04-x64 \
  --size s-4vcpu-8gb \
  --ssh-keys YOUR_SSH_KEY_ID
```

**Option B: AWS EC2**:

```bash
# Launch via AWS Console or CLI
aws ec2 run-instances \
  --image-id ami-0c55b159cbfafe1f0 \
  --instance-type t3.large \
  --key-name your-key-pair \
  --security-groups dotmac-staging-sg \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=dotmac-staging}]'
```

### Step 2: Configure Server

SSH into your server and run the setup script:

```bash
# SSH into server
ssh root@YOUR_SERVER_IP

# Update system
apt update && apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Install Docker Compose V2
apt install docker-compose-plugin -y

# Create deployment user
useradd -m -s /bin/bash deployer
usermod -aG docker deployer
mkdir -p /home/deployer/.ssh
chmod 700 /home/deployer/.ssh

# Create application directory
mkdir -p /opt/dotmac-ftth-ops
chown deployer:deployer /opt/dotmac-ftth-ops

# Switch to deployer user
su - deployer
```

### Step 3: Generate SSH Key for GitHub Actions

```bash
# On your LOCAL machine
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/dotmac_deploy_key

# Copy public key to server
ssh-copy-id -i ~/.ssh/dotmac_deploy_key.pub deployer@YOUR_SERVER_IP

# Test connection
ssh -i ~/.ssh/dotmac_deploy_key deployer@YOUR_SERVER_IP
```

### Step 4: Install Docker Login Credentials

```bash
# On staging server as deployer user
mkdir -p ~/.docker

# This will be configured by GitHub Actions during first deploy
# GitHub Actions will use GITHUB_TOKEN to authenticate
```

---

## GitHub Configuration

### Step 1: Set Repository Secrets

```bash
# Authenticate with GitHub
gh auth login

# Navigate to your repository
cd /path/to/dotmac-ftth-ops

# Add staging secrets
gh secret set STAGING_SSH_KEY < ~/.ssh/dotmac_deploy_key
gh secret set STAGING_HOST --body "YOUR_SERVER_IP"
gh secret set STAGING_USER --body "deployer"

# Add demo/test credentials
gh secret set STAGING_TEST_USER --body "demo@dotmac.com"
gh secret set STAGING_TEST_PASSWORD --body "DemoPassword123!"

# Add Slack webhook (optional)
gh secret set SLACK_WEBHOOK --body "https://hooks.slack.com/services/YOUR/WEBHOOK/URL"
```

**Verify secrets**:
```bash
gh secret list
```

### Step 2: Enable GitHub Actions

1. Go to your repository on GitHub
2. Navigate to **Settings** → **Actions** → **General**
3. Under **Workflow permissions**, select:
   - ✅ **Read and write permissions**
   - ✅ **Allow GitHub Actions to create and approve pull requests**

### Step 3: Enable GitHub Container Registry

```bash
# Create a Personal Access Token (PAT) with packages:write scope
# Go to: Settings → Developer settings → Personal access tokens → Tokens (classic)
# Create new token with:
# - repo (all)
# - write:packages
# - read:packages

# Authenticate Docker on your local machine (for testing)
echo "YOUR_GITHUB_PAT" | docker login ghcr.io -u YOUR_GITHUB_USERNAME --password-stdin
```

---

## First Deployment

### Step 1: Deploy Infrastructure Files to Server

```bash
# On your LOCAL machine
cd /path/to/dotmac-ftth-ops

# Copy docker-compose and configuration to server
scp -i ~/.ssh/dotmac_deploy_key \
  docker-compose.staging.yml \
  deployer@YOUR_SERVER_IP:/opt/dotmac-ftth-ops/

scp -i ~/.ssh/dotmac_deploy_key \
  .env.staging \
  deployer@YOUR_SERVER_IP:/opt/dotmac-ftth-ops/.env

# Copy nginx configuration (we'll create this next)
scp -r -i ~/.ssh/dotmac_deploy_key \
  nginx/ \
  deployer@YOUR_SERVER_IP:/opt/dotmac-ftth-ops/
```

### Step 2: Configure Environment Variables

SSH into server and edit `.env`:

```bash
ssh -i ~/.ssh/dotmac_deploy_key deployer@YOUR_SERVER_IP
cd /opt/dotmac-ftth-ops

# Generate secure secrets
python3 -c "import secrets; print(secrets.token_urlsafe(32))"

# Edit .env file
nano .env

# Update these values:
# SECRET_KEY=<generated-secret>
# JWT_SECRET_KEY=<generated-secret>
# NEXTAUTH_SECRET=<generated-secret>
# DATABASE_PASSWORD=<strong-password>
# REDIS_PASSWORD=<strong-password>
```

### Step 3: Trigger First Deployment

```bash
# On your LOCAL machine
cd /path/to/dotmac-ftth-ops

# Commit and push to trigger deployment
git add .
git commit -m "chore: configure staging deployment"
git push origin main
```

**Monitor deployment**:
1. Go to your repository on GitHub
2. Click **Actions** tab
3. Watch the **Deploy to Staging** workflow

### Step 4: Verify Deployment

```bash
# SSH into staging server
ssh -i ~/.ssh/dotmac_deploy_key deployer@YOUR_SERVER_IP
cd /opt/dotmac-ftth-ops

# Check container status
docker compose -f docker-compose.staging.yml ps

# Check logs
docker compose -f docker-compose.staging.yml logs -f backend

# Check health
curl http://localhost:8000/health

# Check frontend
curl http://localhost:3000
```

Expected output:
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "environment": "staging",
  "services": {
    "database": "healthy",
    "redis": "healthy",
    "storage": "healthy"
  }
}
```

---

## Ongoing Deployments

### Automatic Deployments

Every push to `main` or `develop` branch automatically triggers:

1. ✅ Build & test
2. ✅ Docker image build
3. ✅ Deploy to staging
4. ✅ Run E2E tests
5. ✅ Send notification

**Timeline** (typical):
```
0:00 - Push to GitHub
0:30 - Tests complete
2:00 - Docker images built
3:00 - Deployed to staging
4:00 - E2E tests complete
4:05 - Slack notification sent
```

### Manual Deployments

Trigger deployment without code changes:

```bash
# Using GitHub CLI
gh workflow run staging-deploy.yml

# Or via GitHub web interface:
# Actions → Deploy to Staging → Run workflow
```

### Rollback Procedure

If deployment fails or introduces bugs:

```bash
# SSH into staging server
ssh -i ~/.ssh/dotmac_deploy_key deployer@YOUR_SERVER_IP
cd /opt/dotmac-ftth-ops

# Find previous working image tag
docker images | grep dotmac

# Edit docker-compose.staging.yml to use previous tag
nano docker-compose.staging.yml

# Example: Change from :staging to :main-abc123
# BACKEND_IMAGE=ghcr.io/yourorg/dotmac-ftth-ops/backend:main-abc123

# Restart with previous version
docker compose -f docker-compose.staging.yml down
docker compose -f docker-compose.staging.yml up -d

# Verify rollback
curl http://localhost:8000/health
```

### Database Migrations

Migrations run automatically during deployment. To run manually:

```bash
# SSH into staging server
docker compose -f docker-compose.staging.yml exec backend \
  poetry run alembic upgrade head

# To rollback migration
docker compose -f docker-compose.staging.yml exec backend \
  poetry run alembic downgrade -1
```

---

## Monitoring & Troubleshooting

### Access Monitoring Tools

**Grafana** (Metrics & Dashboards):
```
URL: http://YOUR_SERVER_IP:3001
Username: admin
Password: <from .env GRAFANA_PASSWORD>
```

**Jaeger** (Distributed Tracing):
```
URL: http://YOUR_SERVER_IP:16686
```

**Prometheus** (Metrics):
```
URL: http://YOUR_SERVER_IP:9090
```

### Check Logs

```bash
# All services
docker compose -f docker-compose.staging.yml logs -f

# Specific service
docker compose -f docker-compose.staging.yml logs -f backend
docker compose -f docker-compose.staging.yml logs -f frontend
docker compose -f docker-compose.staging.yml logs -f postgres

# Last 100 lines
docker compose -f docker-compose.staging.yml logs --tail=100 backend
```

### Common Issues

**Issue 1: Database Connection Failed**

```bash
# Check if postgres is running
docker compose -f docker-compose.staging.yml ps postgres

# Check postgres logs
docker compose -f docker-compose.staging.yml logs postgres

# Verify credentials
docker compose -f docker-compose.staging.yml exec postgres \
  psql -U dotmac_user -d dotmac_staging -c "SELECT 1"
```

**Issue 2: Redis Connection Failed**

```bash
# Check redis
docker compose -f docker-compose.staging.yml ps redis

# Test connection
docker compose -f docker-compose.staging.yml exec redis redis-cli ping
```

**Issue 3: Backend Health Check Failing**

```bash
# Check backend logs
docker compose -f docker-compose.staging.yml logs backend

# Enter backend container
docker compose -f docker-compose.staging.yml exec backend bash

# Run health check manually
curl http://localhost:8000/health
```

**Issue 4: Deployment Stuck**

```bash
# Check GitHub Actions logs in browser
# Go to repository → Actions → Latest run

# Or check on server
ssh deployer@YOUR_SERVER_IP
docker compose -f /opt/dotmac-ftth-ops/docker-compose.staging.yml ps
```

---

## Demo Environment Management

### Resetting Demo Data

```bash
# SSH into staging server
ssh -i ~/.ssh/dotmac_deploy_key deployer@YOUR_SERVER_IP
cd /opt/dotmac-ftth-ops

# Stop services
docker compose -f docker-compose.staging.yml down

# Clear database
docker volume rm dotmac-ftth-ops_postgres-data-staging

# Clear Redis
docker volume rm dotmac-ftth-ops_redis-data-staging

# Restart and reseed
docker compose -f docker-compose.staging.yml up -d
sleep 10

# Run migrations
docker compose -f docker-compose.staging.yml exec backend \
  poetry run alembic upgrade head

# Seed demo data
docker compose -f docker-compose.staging.yml exec backend \
  poetry run python scripts/seed_demo_data.py
```

### Demo User Accounts

After seeding, these accounts are available:

```
Platform Admin:
  Email: admin@dotmac.com
  Password: Admin123!
  Role: Platform Administrator

ISP Admin:
  Email: isp-admin@demo.com
  Password: IspAdmin123!
  Role: ISP Administrator

Billing Manager:
  Email: billing@demo.com
  Password: Billing123!
  Role: Billing Manager

Support Agent:
  Email: support@demo.com
  Password: Support123!
  Role: Support Agent

Customer (Demo):
  Email: customer@demo.com
  Password: Customer123!
  Role: Customer
```

### Scheduled Maintenance

Set up a cron job to automatically reset demo data weekly:

```bash
# On staging server
crontab -e

# Add this line (runs every Sunday at 2 AM):
0 2 * * 0 cd /opt/dotmac-ftth-ops && ./scripts/reset-demo-data.sh
```

Create the reset script:

```bash
nano /opt/dotmac-ftth-ops/scripts/reset-demo-data.sh
```

```bash
#!/bin/bash
set -e

cd /opt/dotmac-ftth-ops

# Stop services
docker compose -f docker-compose.staging.yml down

# Clear volumes
docker volume rm dotmac-ftth-ops_postgres-data-staging || true
docker volume rm dotmac-ftth-ops_redis-data-staging || true

# Restart
docker compose -f docker-compose.staging.yml up -d

# Wait for services
sleep 15

# Migrations
docker compose -f docker-compose.staging.yml exec -T backend \
  poetry run alembic upgrade head

# Seed data
docker compose -f docker-compose.staging.yml exec -T backend \
  poetry run python scripts/seed_demo_data.py

echo "Demo data reset complete!"
```

```bash
chmod +x /opt/dotmac-ftth-ops/scripts/reset-demo-data.sh
```

---

## Security Considerations

### SSL/TLS Setup

For production-like staging with HTTPS:

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d staging.yourdomain.com

# Auto-renewal is configured automatically
```

### Firewall Configuration

```bash
# On staging server
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable
```

### Secret Rotation

Rotate secrets quarterly:

```bash
# Generate new secrets
python3 -c "import secrets; print(secrets.token_urlsafe(32))"

# Update .env on server
ssh deployer@YOUR_SERVER_IP
nano /opt/dotmac-ftth-ops/.env

# Update GitHub secrets
gh secret set SECRET_KEY --body "new-secret-value"

# Restart services
docker compose -f docker-compose.staging.yml restart
```

---

## Next Steps

- [ ] Set up domain name (staging.yourdomain.com)
- [ ] Configure SSL certificates
- [ ] Set up monitoring alerts
- [ ] Configure backup automation
- [ ] Test disaster recovery procedures
- [ ] Document custom workflows

---

## Support

For issues or questions:
- GitHub Issues: https://github.com/yourorg/dotmac-ftth-ops/issues
- Documentation: https://docs.yourdomain.com
- Slack: #dotmac-platform

---

**Last Updated**: 2025-01-17
**Maintained By**: Platform Team
