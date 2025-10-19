# Operational Scripts

This document describes the operational scripts available for managing the DotMac Platform infrastructure and testing.

---

## Overview

The `scripts/` directory contains automation scripts for common operational tasks:

| Script | Purpose | Makefile Target |
|--------|---------|-----------------|
| `check_infra.sh` | Manage Docker infrastructure | `make infra-up/down/status` |
| `run_integration_tests.sh` | Run integration tests | `make test-integration` |
| `seed_data.py` | Seed database with test data | `make seed-db` |
| `docker-entrypoint.sh` | API container entrypoint | (Docker only) |
| `celery-entrypoint.sh` | Celery worker entrypoint | (Docker only) |

---

## Infrastructure Management

### check_infra.sh

Manages Docker infrastructure for local development.

**Location**: `scripts/check_infra.sh`

**Usage**:
```bash
# Start required services (postgres, redis)
./scripts/check_infra.sh up
make infra-up

# Stop all services
./scripts/check_infra.sh down
make infra-down

# Check service status
./scripts/check_infra.sh status
make infra-status

# Restart infrastructure
./scripts/check_infra.sh restart

# View logs
./scripts/check_infra.sh logs              # All services
./scripts/check_infra.sh logs postgres     # Specific service

# Show container status
./scripts/check_infra.sh ps
```

**Features**:
- ✅ Checks Docker availability
- ✅ Starts required services (postgres, redis)
- ✅ Waits for services to be healthy
- ✅ Color-coded status output
- ✅ Connection details display

**Required Services**:
- PostgreSQL (port 5432)
- Redis (port 6379)

**Optional Services**:
- MinIO (ports 9000, 9001)
- MailHog (port 8025)
- OpenBao/Vault (port 8200)

**Example Output**:
```
========================================
  DotMac Platform - Infrastructure
========================================

Required Services:
  ✓ postgres           Running         (required)
  ✓ redis              Running         (required)

Optional Services:
  ○ minio              Not Created     (optional)
  ○ mailhog            Not Created     (optional)
  ○ openbao            Not Created     (optional)

========================================
✓ All required services are running
========================================

Connection details:
  PostgreSQL: localhost:5432
  Redis:      localhost:6379
```

---

## Integration Testing

### run_integration_tests.sh

Runs integration tests with infrastructure checks and setup.

**Location**: `scripts/run_integration_tests.sh`

**Usage**:
```bash
# Run all integration tests
./scripts/run_integration_tests.sh
make test-integration

# Run with coverage
COVERAGE=true ./scripts/run_integration_tests.sh

# Run in parallel
PARALLEL=true ./scripts/run_integration_tests.sh

# Run specific test pattern
./scripts/run_integration_tests.sh -k test_customer

# Get help
./scripts/run_integration_tests.sh --help
```

**Features**:
- ✅ Checks infrastructure status
- ✅ Waits for services to be healthy
- ✅ Runs database migrations
- ✅ Executes pytest with integration markers
- ✅ Optional coverage reporting
- ✅ Optional parallel execution

**Environment Variables**:
```bash
COVERAGE=true     # Enable coverage reporting (generates htmlcov/)
PARALLEL=true     # Run tests in parallel with pytest-xdist
CI=true           # Run in CI mode (no interactive prompts)
```

**Prerequisites**:
- Docker services running (`make infra-up`)
- PostgreSQL available on localhost:5432
- Redis available on localhost:6379

**Test Database**:
Uses `dotmac_test` database by default. Set via `DATABASE_URL`:
```bash
export DATABASE_URL="postgresql://dotmac_user:password@localhost:5432/dotmac_test"
```

---

## Database Seeding

### seed_data.py

Seeds database with test data for different environments.

**Location**: `scripts/seed_data.py`

**Usage**:
```bash
# Seed development database
poetry run python scripts/seed_data.py --env=development
make seed-db

# Clear and reseed
poetry run python scripts/seed_data.py --env=development --clear
make seed-db-clean

# Seed staging
poetry run python scripts/seed_data.py --env=staging

# Seed demo environment
poetry run python scripts/seed_data.py --env=demo

# Verbose output
poetry run python scripts/seed_data.py --env=development --verbose
```

**Features**:
- ✅ Environment-specific seeding (development, staging, demo, test)
- ✅ Optional database clearing
- ✅ RBAC roles and permissions
- ✅ Demo tenant, users, customers
- ✅ Sample subscriptions with pricing
- ✅ Safety checks for production

**Demo Users Created**:
```
Admin:        admin@dotmac.com       / Admin123!
ISP Admin:    isp-admin@demo.com     / IspAdmin123!
Billing:      billing@demo.com       / Billing123!
Support:      support@demo.com       / Support123!
Customer:     customer@demo.com      / Customer123!
```

**Demo Data Includes**:
- 1 demo tenant ("Demo ISP")
- 5 user accounts (admin, ISP admin, billing, support, customer)
- 5 sample customers with service addresses
- Active subscriptions ($49.99 - $99.99/month)
- RBAC roles and permissions

**Safety Features**:
- Production seeding requires `ALLOW_DESTRUCTIVE_OPERATIONS=true`
- Clear operation requires confirmation ("yes")
- Transaction-based (rollback on error)

**Arguments**:
```
--env           Environment (development|staging|demo|test)
--clear         Clear all data before seeding
--verbose, -v   Enable verbose logging
```

---

## Docker Entrypoint Scripts

### docker-entrypoint.sh

API container entrypoint for production deployment.

**Location**: `scripts/docker-entrypoint.sh`

**Usage**: (Automatically used by Docker)
```bash
# In Dockerfile
ENTRYPOINT ["/app/scripts/docker-entrypoint.sh"]
CMD ["api"]
```

**Supported Commands**:
```bash
api         # Start API server with Gunicorn (default)
migrate     # Run database migrations only
shell       # Python interactive shell
```

**Features**:
- ✅ Waits for PostgreSQL availability
- ✅ Waits for Redis availability
- ✅ Runs migrations automatically (if `AUTO_MIGRATE=true`)
- ✅ Starts Gunicorn with production settings
- ✅ Configurable via environment variables

**Environment Variables**:
```bash
# Database
DATABASE__HOST=postgres
DATABASE__PORT=5432

# Redis
REDIS__HOST=redis
REDIS__PORT=6379

# Gunicorn
GUNICORN_WORKERS=4                          # Number of workers
GUNICORN_BIND=0.0.0.0:8000                  # Bind address
GUNICORN_TIMEOUT=120                        # Request timeout
GUNICORN_WORKER_CLASS=uvicorn.workers.UvicornWorker

# Migrations
AUTO_MIGRATE=true                           # Run migrations on startup
```

### celery-entrypoint.sh

Celery worker/beat/flower entrypoint for production.

**Location**: `scripts/celery-entrypoint.sh`

**Usage**: (Automatically used by Docker)
```bash
# In Dockerfile
ENTRYPOINT ["/app/scripts/celery-entrypoint.sh"]
CMD ["worker"]
```

**Supported Commands**:
```bash
worker      # Start Celery worker (default)
beat        # Start Celery beat (scheduler)
flower      # Start Flower (monitoring UI)
```

**Features**:
- ✅ Waits for Redis broker availability
- ✅ Waits for PostgreSQL availability
- ✅ Configurable concurrency and queues
- ✅ Graceful shutdown handling

**Environment Variables**:
```bash
# Celery
CELERY_APP=dotmac.platform.celery_app       # Celery app module
CELERY_BROKER_URL=redis://redis:6379/0      # Broker URL
CELERY_LOGLEVEL=info                        # Log level
CELERY_CONCURRENCY=4                        # Worker concurrency
CELERY_QUEUES=default,high_priority         # Queues to process

# Redis
REDIS__HOST=redis
REDIS__PORT=6379

# Database
DATABASE__HOST=postgres
DATABASE__PORT=5432
```

---

## Makefile Integration

All operational scripts are integrated with the Makefile for convenience:

```makefile
# Infrastructure
make infra-up           # Start infrastructure
make infra-down         # Stop infrastructure
make infra-status       # Check status

# Testing
make test-integration   # Run integration tests

# Database
make seed-db            # Seed development database
make seed-db-clean      # Clear and reseed database

# Development
make dev-backend        # Start backend only
make dev-frontend       # Start frontend only
make dev-all            # Start backend + frontend
```

---

## Workflow Examples

### Local Development Setup

```bash
# 1. Start infrastructure
make infra-up

# 2. Run migrations
make migrate

# 3. Seed database
make seed-db

# 4. Start development servers
make dev-all
```

### Running Tests

```bash
# 1. Ensure infrastructure is running
make infra-status

# 2. Run integration tests
make test-integration

# 3. Run with coverage
COVERAGE=true make test-integration
```

### Resetting Database

```bash
# 1. Clear and reseed database
make seed-db-clean

# 2. Or manually
poetry run python scripts/seed_data.py --env=development --clear
```

### Checking Infrastructure Status

```bash
# Quick status check
make infra-status

# Detailed logs
./scripts/check_infra.sh logs

# Specific service logs
./scripts/check_infra.sh logs postgres
```

---

## Troubleshooting

### Infrastructure won't start

```bash
# Check Docker is running
docker info

# Check for port conflicts
lsof -i :5432  # PostgreSQL
lsof -i :6379  # Redis

# View detailed logs
./scripts/check_infra.sh logs

# Restart infrastructure
make infra-down
make infra-up
```

### Integration tests fail

```bash
# Check infrastructure
make infra-status

# Wait for services to be healthy
./scripts/check_infra.sh up

# Check database connection
psql -h localhost -U dotmac_user -d dotmac_test

# Check test database exists
createdb -h localhost -U dotmac_user dotmac_test
```

### Seeding fails

```bash
# Check database connection
psql -h localhost -U dotmac_user -d dotmac

# Run migrations first
make migrate

# Try verbose mode
poetry run python scripts/seed_data.py --env=development --verbose

# Check for data conflicts (clear first)
poetry run python scripts/seed_data.py --env=development --clear
```

### Docker entrypoint issues

```bash
# Check container logs
docker compose logs backend
docker compose logs celery-worker

# Check database connectivity from container
docker compose exec backend nc -zv postgres 5432

# Check Redis connectivity from container
docker compose exec backend nc -zv redis 6379

# Manual migration
docker compose exec backend python -m alembic upgrade head
```

---

## CI/CD Integration

These scripts are designed for CI/CD pipelines:

**GitHub Actions Example**:
```yaml
- name: Start infrastructure
  run: ./scripts/check_infra.sh up

- name: Run integration tests
  run: |
    export CI=true
    export COVERAGE=true
    ./scripts/run_integration_tests.sh

- name: Seed staging database
  run: |
    poetry run python scripts/seed_data.py --env=staging --clear
```

**GitLab CI Example**:
```yaml
test:integration:
  script:
    - make infra-up
    - make test-integration
  artifacts:
    reports:
      coverage_report:
        coverage_format: cobertura
        path: coverage.xml
```

---

## Script Maintenance

### Adding New Scripts

1. Create script in `scripts/` directory
2. Make executable: `chmod +x scripts/your_script.sh`
3. Add to Makefile with appropriate target
4. Document in this file
5. Add to CI/CD workflows if needed

### Script Standards

All scripts should follow these conventions:
- ✅ Use `set -euo pipefail` for bash scripts
- ✅ Include help message (`--help` flag)
- ✅ Use color-coded output (GREEN=success, RED=error, YELLOW=warning)
- ✅ Check prerequisites (Docker, database, etc.)
- ✅ Provide clear error messages
- ✅ Support CI mode (no interactive prompts)
- ✅ Exit with appropriate status codes (0=success, 1=error)

---

## Related Documentation

- [Quick Start Guide](../QUICK_START_STAGING.md) - First-time setup
- [Staging Deployment](STAGING_DEPLOYMENT.md) - Staging environment
- [Production Fixes](PRODUCTION_DEPLOYMENT_FIXES.md) - Production deployment
- [Testing Guide](../tests/README.md) - Testing documentation

---

**Last Updated**: 2025-10-17
**Maintained By**: DotMac Platform Team
