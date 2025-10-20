# Development Environment Warnings Guide

This document explains common warnings you'll see during development and how to handle them.

## Overview

The DotMac Platform Services uses graceful degradation patterns for optional services. This means the application continues to work even when some services are unavailable, falling back to simpler alternatives.

---

## ⚠️ MinIO Signature Mismatch

### What You'll See
```
WARNING: MinIO connection failed: SignatureDoesNotMatch
INFO: Falling back to local storage: /tmp/storage
INFO: FileStorageService initialized with local backend
```

### What It Means
The application couldn't connect to MinIO (S3-compatible object storage) and automatically fell back to local filesystem storage.

### Should You Fix It?
**Not necessary for most development work.** Local storage fallback works fine for:
- User uploads
- File processing
- General file operations

### When to Fix It
Fix this if you're specifically working on:
- S3/MinIO-specific features
- Multi-node deployment testing
- Object storage performance testing

### How to Fix It

**Option 1: Use docker-compose MinIO service**
```bash
# Check if MinIO is running
docker ps | grep minio

# If not running, start it
docker-compose up -d minio

# Restart backend to reconnect
# It should auto-reconnect on next storage operation
```

**Option 2: Verify MinIO credentials**
Check your `.env` file:
```bash
MINIO_ENDPOINT=localhost:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=dotmac-dev
MINIO_USE_SSL=false
```

**Option 3: Explicitly use local storage**
In your `.env`:
```bash
STORAGE_PROVIDER=local
STORAGE_PATH=/tmp/storage
```

---

## ⚠️ Database Index Already Exists

### What You'll See
```
WARNING: relation "ix_cash_registers_tenant_id" already exists
WARNING: relation "ix_billing_products_tenant_id" already exists
```

### What It Means
The database already has indexes from a previous migration run. The ORM is trying to create them again.

### Should You Fix It?
**No - completely harmless.** This is a dev-only cosmetic warning. The application continues normally with "🎉 Startup complete - service ready".

### When to Fix It
Only fix if:
- Warnings clutter your logs and bother you
- You're specifically working on database migrations
- You want a "clean" dev environment

### How to Fix It

**Option 1: Start with fresh database**
```bash
# Stop services
docker-compose down

# Remove volumes (WARNING: deletes all data)
docker-compose down -v

# Start fresh
docker-compose up -d postgres
poetry run alembic upgrade head
```

**Option 2: Suppress warnings (not recommended)**
Add to `.env`:
```bash
SQLALCHEMY_WARN_20=false
```

**Option 3: Use IF NOT EXISTS in future migrations**
When creating new migrations:
```python
# In alembic migration file
op.create_index(
    'ix_table_field',
    'table_name',
    ['field_name'],
    unique=False,
    if_not_exists=True  # Add this
)
```

---

## ⚠️ Vault Secrets Failing

### What You'll See
```
ERROR: Permission denied accessing secret at auth/jwt/secret_key
ERROR: Permission denied accessing secret at auth/session/secret_key
INFO: Using default from environment variable
```

### What It Means
The application tried to fetch secrets from HashiCorp Vault but Vault is not configured. It's using values from `.env` instead.

### Should You Fix It?
**Not necessary for development.** The `.env` file provides all required secrets:
- JWT secret keys
- Database credentials
- API keys
- Session secrets

### When to Fix It
Fix this if you're working on:
- Secrets management features
- Vault integration
- Production deployment preparation
- Security-sensitive features

### How to Fix It

**Option 1: Disable Vault in dev (recommended)**
In your `.env`:
```bash
VAULT__ENABLED=false
```

This suppresses the warnings entirely. The application will use `.env` values without attempting Vault connections.

**Option 2: Run local Vault container**
```bash
# Start Vault in dev mode
docker-compose up -d vault

# Initialize Vault (dev mode - not production safe)
docker exec -it dotmac-vault vault operator init -key-shares=1 -key-threshold=1

# Enable secrets engine
docker exec -it dotmac-vault vault secrets enable -path=secret kv-v2

# Write test secrets
docker exec -it dotmac-vault vault kv put secret/auth/jwt/secret_key value="dev-jwt-secret"
docker exec -it dotmac-vault vault kv put secret/database/password value="dotmac"

# Update .env
VAULT__ENABLED=true
VAULT_URL=http://localhost:8200
VAULT_TOKEN=<your-root-token>
```

**Option 3: Mock Vault for tests**
```python
# In tests/conftest.py (already implemented)
@pytest.fixture
def mock_vault():
    """Mock Vault for testing."""
    with patch('dotmac.platform.secrets.vault_provider.VaultProvider') as mock:
        mock.return_value.get_secret.return_value = {"value": "test-secret"}
        yield mock
```

---

## 🔍 OpenTelemetry Collector Unavailable

### What You'll See
```
WARNING: Failed to export traces to http://localhost:4318
WARNING: Retrying in 30 seconds...
```

### What It Means
OpenTelemetry is trying to send telemetry data (traces, metrics) to a collector that isn't running.

### Should You Fix It?
**Not necessary unless you need observability.**

### How to Fix It

**Option 1: Disable OTEL in dev**
In your `.env`:
```bash
OTEL_ENABLED=false
```

**Option 2: Run OTEL collector**
```bash
docker-compose -f docker-compose.observability.yml up -d
```

---

## Summary: What to Fix vs Ignore

| Warning | Ignore in Dev? | When to Fix |
|---------|----------------|-------------|
| MinIO signature mismatch | ✅ Yes | Working on S3 features |
| Database index exists | ✅ Yes | Never (harmless) |
| Vault secrets failing | ✅ Yes | Working on secrets mgmt |
| OTEL collector unavailable | ✅ Yes | Need distributed tracing |

---

## Quick Fix Commands

```bash
# Completely suppress all warnings (not recommended)
LOG_LEVEL=ERROR  # In .env

# Disable optional services
VAULT__ENABLED=false
OTEL_ENABLED=false
STORAGE_PROVIDER=local

# Fresh start with clean database
docker-compose down -v
docker-compose up -d postgres redis
poetry run alembic upgrade head

# Start with all services (no warnings)
docker-compose up -d  # Starts postgres, redis, minio, vault
sleep 10
poetry run uvicorn dotmac.platform.main:app --reload
```

---

## Development Workflow Recommendations

### Minimal Setup (fastest)
```bash
# Start only required services
docker-compose up -d postgres redis

# Disable optional services
echo "VAULT__ENABLED=false" >> .env
echo "OTEL_ENABLED=false" >> .env

# Start application
npm run dev:all  # from frontend/ directory
```

### Full Setup (production-like)
```bash
# Start all services
docker-compose up -d
docker-compose -f docker-compose.observability.yml up -d

# Configure everything
echo "VAULT__ENABLED=true" >> .env
echo "OTEL_ENABLED=true" >> .env

# Initialize Vault (first time only)
./scripts/setup-vault-dev.sh  # Create this if needed

# Start application
npm run dev:all
```

### Recommended for Most Developers
```bash
# Required services only + local storage
docker-compose up -d postgres redis

# Optional: disable warnings
echo "VAULT__ENABLED=false" >> .env

# Start
cd frontend && npm run dev:all
```

---

**Last Updated**: 2025-09-30
**Related Files**:
- `config/development.yaml` - Dev configuration
- `.env.example` - Environment template
- `README_IMPLEMENTATION.md` - Implementation details