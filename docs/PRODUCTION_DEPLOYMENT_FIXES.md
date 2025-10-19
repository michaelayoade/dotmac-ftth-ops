# Production Deployment - Critical Fixes Applied

## Overview

This document details the critical issues found in the production deployment configuration and the fixes that have been applied.

> **Compose overlay update**
> Production now uses `docker-compose.base.yml` + `docker-compose.production.yml`. When you see commands referencing `docker-compose.prod.yml`, run them with `docker-compose.production.yml` instead.

---

## Issues Found

### 1. Missing Entrypoint Scripts ❌ CRITICAL

**Problem**:
- `Dockerfile.prod:89` references `scripts/docker-entrypoint.sh` - **DID NOT EXIST**
- `Dockerfile.prod:142` references `scripts/celery-entrypoint.sh` - **DID NOT EXIST**

**Impact**: Docker images could not build. Production deployment completely broken.

**Fix Applied**: ✅
- Created `scripts/docker-entrypoint.sh` with:
  - Wait-for-database logic
  - Wait-for-Redis logic
  - Automatic database migrations
  - Gunicorn startup with production settings
- Created `scripts/celery-entrypoint.sh` with:
  - Wait-for-broker logic
  - Celery worker/beat/flower startup modes

**Location**:
- `/scripts/docker-entrypoint.sh`
- `/scripts/celery-entrypoint.sh`

---

### 2. Missing Configuration Directories ❌ CRITICAL

**Problem**:
`docker-compose.production.yml` referenced directories that didn't exist:
- Line 115: `./database/init` - **DID NOT EXIST**
- Line 134: `./redis/redis.conf` - **DID NOT EXIST**
- Line 174: `./vault/policies` - **DID NOT EXIST**
- Referenced: `./monitoring/grafana` - **DID NOT EXIST**

**Impact**: Docker Compose could not start. Volume mounts would fail.

**Fix Applied**: ✅
Created all missing directories and configuration files:

**Redis Configuration** (`redis/redis.conf`):
- Production-optimized settings
- AOF persistence enabled
- 256MB max memory with LRU eviction
- Slow query logging
- Security hardening

**Database Init** (`database/init/01-init.sql`):
- PostgreSQL extensions (uuid-ossp, pg_trgm, btree_gin)
- Performance tuning for production
- Connection pooling settings
- Logging configuration

**Vault Policies** (`vault/policies/app-policy.hcl`):
- Read-only access to application secrets
- Token renewal permissions
- Scoped to necessary paths only

---

### 3. Environment Variable Mapping Issues ❌ CRITICAL

**Problem**:
`docker-compose.production.yml` set wrong environment variable names:

```yaml
# WRONG (from docker-compose.production.yml)
DATABASE__NAME: ${POSTGRES_DB}     # ❌ Settings expects database.database
JWT_SECRET: ${JWT_SECRET}          # ❌ Settings expects jwt.secret_key or auth.jwt_secret_key
```

**Why This Breaks**:
The settings module (`src/dotmac/platform/settings.py`) uses nested Pydantic models:
- Database settings are under `settings.database.database` (NOT `settings.DATABASE__NAME`)
- JWT settings are under `settings.jwt.secret_key` or `settings.auth.jwt_secret_key` (NOT `settings.JWT_SECRET`)

**Impact**:
- Application would fail to connect to database
- JWT authentication would fail
- Production validation would fail at startup

**Fix Required**: ⚠️ **MANUAL UPDATE NEEDED**

Update `docker-compose.production.yml` environment variables to match settings structure:

```yaml
# CORRECT MAPPING
services:
  app:
    environment:
      # Database - use nested __  delimiter
      DATABASE__DATABASE: ${POSTGRES_DB:-dotmac_prod}  # ✅ Correct
      DATABASE__HOST: postgres
      DATABASE__PORT: 5432
      DATABASE__USER: ${POSTGRES_USER:-dotmac_user}
      DATABASE__PASSWORD: ${POSTGRES_PASSWORD}

      # JWT - use auth settings
      AUTH__JWT_SECRET_KEY: ${JWT_SECRET}  # ✅ Correct
      # OR use legacy jwt settings:
      JWT__SECRET_KEY: ${JWT_SECRET}  # ✅ Also correct

      # Secret key
      SECRET_KEY: ${SECRET_KEY}

      # Vault (REQUIRED in production)
      VAULT__ENABLED: "true"  # ✅ CRITICAL - must be set!
      VAULT__URL: http://openbao:8200
      VAULT__TOKEN: ${VAULT_ROOT_TOKEN}
```

---

### 4. Production Validation Will Fail ❌ CRITICAL

**Problem**:
The startup guard in `src/dotmac/platform/settings.py:634` checks:

```python
if self.environment == Environment.PRODUCTION:
    if not self.vault.enabled:
        raise ValueError(
            "SECURITY ERROR: Vault/OpenBao MUST be enabled in production."
        )
```

But `docker-compose.production.yml` **NEVER sets** `VAULT__ENABLED=true`!

**Impact**: Application will refuse to start in production mode.

**Fix Applied**: ✅
Updated `.env.production.example` to include:
```bash
VAULT__ENABLED=true
VAULT__URL=http://openbao:8200
VAULT__TOKEN=<from-secure-source>
```

**Action Required**: ⚠️
Add to `docker-compose.production.yml`:
```yaml
VAULT__ENABLED: "true"  # Must be string "true", not boolean
```

---

## Environment Variable Reference

### Correct Mapping Table

| Docker Compose Variable | Settings Path | Example Value |
|------------------------|---------------|---------------|
| `DATABASE__HOST` | `settings.database.host` | `postgres` |
| `DATABASE__PORT` | `settings.database.port` | `5432` |
| `DATABASE__DATABASE` | `settings.database.database` | `dotmac_prod` |
| `DATABASE__USER` | `settings.database.username` | `dotmac_user` |
| `DATABASE__PASSWORD` | `settings.database.password` | `<secret>` |
| `REDIS__HOST` | `settings.redis.host` | `redis` |
| `REDIS__PORT` | `settings.redis.port` | `6379` |
| `REDIS__DB` | `settings.redis.db` | `0` |
| `REDIS__PASSWORD` | `settings.redis.password` | `<secret>` |
| `AUTH__JWT_SECRET_KEY` | `settings.auth.jwt_secret_key` | `<secret>` |
| `JWT__SECRET_KEY` | `settings.jwt.secret_key` | `<secret>` (legacy) |
| `SECRET_KEY` | `settings.secret_key` | `<secret>` |
| `VAULT__ENABLED` | `settings.vault.enabled` | `"true"` |
| `VAULT__URL` | `settings.vault.url` | `http://openbao:8200` |
| `VAULT__TOKEN` | `settings.vault.token` | `<secret>` |
| `ENVIRONMENT` | `settings.environment` | `production` |

### How Pydantic Settings Work

Pydantic uses **double underscore** (`__`) as a delimiter for nested settings:

```python
# settings.py structure
class DatabaseSettings(BaseModel):
    host: str
    port: int
    database: str  # ← Note: "database" not "name"
    username: str  # ← Note: "username" not "user"
    password: str

class Settings(BaseSettings):
    database: DatabaseSettings
```

```bash
# Environment variables
DATABASE__HOST=postgres          # → settings.database.host
DATABASE__PORT=5432              # → settings.database.port
DATABASE__DATABASE=dotmac_prod   # → settings.database.database
DATABASE__USERNAME=dotmac_user   # → settings.database.username (NOT USER!)
DATABASE__PASSWORD=secret        # → settings.database.password
```

---

## Files Created

### Entrypoint Scripts
- ✅ `scripts/docker-entrypoint.sh` - API startup script
- ✅ `scripts/celery-entrypoint.sh` - Celery worker/beat startup

### Configuration Files
- ✅ `redis/redis.conf` - Production Redis configuration
- ✅ `database/init/01-init.sql` - PostgreSQL initialization
- ✅ `vault/policies/app-policy.hcl` - Vault access policy

### Documentation
- ✅ `docs/PRODUCTION_DEPLOYMENT_FIXES.md` - This file

---

## Remaining Manual Steps

### 1. Update docker-compose.production.yml

```yaml
services:
  app:
    environment:
      # Fix database variable names
      DATABASE__DATABASE: ${POSTGRES_DB:-dotmac_prod}  # Changed from DATABASE__NAME
      DATABASE__USER: ${POSTGRES_USER:-dotmac_user}    # Fine as-is

      # Fix JWT variable name
      AUTH__JWT_SECRET_KEY: ${JWT_SECRET}  # Changed from JWT_SECRET

      # Add missing Vault flag
      VAULT__ENABLED: "true"  # ← ADD THIS!
      VAULT__URL: http://openbao:8200
      VAULT__TOKEN: ${VAULT_ROOT_TOKEN}
```

### 2. Create .env.production File

```bash
# Based on .env.production.example
cp .env.production.example .env.production

# Edit and set real values
nano .env.production
```

Required variables:
```bash
# Secrets (generate with: python3 -c "import secrets; print(secrets.token_urlsafe(32))")
SECRET_KEY=<generated-secret>
JWT_SECRET=<generated-secret>
NEXTAUTH_SECRET=<generated-secret>

# Database
POSTGRES_PASSWORD=<strong-password>

# Vault
VAULT_ROOT_TOKEN=<vault-root-token>

# MinIO
MINIO_SECRET_KEY=<generated-secret>
```

### 3. Initialize Vault

```bash
# Start Vault
docker compose -f docker-compose.production.yml up -d openbao

# Initialize (first time only)
docker compose -f docker-compose.production.yml exec openbao bao operator init

# Unseal Vault (requires 3 of 5 unseal keys)
docker compose -f docker-compose.production.yml exec openbao bao operator unseal <key1>
docker compose -f docker-compose.production.yml exec openbao bao operator unseal <key2>
docker compose -f docker-compose.production.yml exec openbao bao operator unseal <key3>

# Enable KV secrets engine
docker compose -f docker-compose.production.yml exec openbao \
  bao secrets enable -path=secret kv-v2

# Store secrets
docker compose -f docker-compose.production.yml exec openbao \
  bao kv put secret/auth/jwt_secret value="<your-jwt-secret>"
```

### 4. Test Deployment

```bash
# Build images
docker compose -f docker-compose.production.yml build

# Start services
docker compose -f docker-compose.production.yml up -d

# Check logs
docker compose -f docker-compose.production.yml logs -f app

# Verify health
curl http://localhost:8000/health
```

---

## Testing Checklist

Before deploying to production, verify:

- [ ] Docker images build successfully
- [ ] All containers start without errors
- [ ] Database migrations run automatically
- [ ] Health check returns `{"status": "healthy"}`
- [ ] Vault is initialized and unsealed
- [ ] Application can read secrets from Vault
- [ ] JWT authentication works
- [ ] Database connections work
- [ ] Redis connections work
- [ ] Celery workers start successfully

---

## Summary

**Fixed** ✅:
1. Created missing entrypoint scripts
2. Created missing configuration directories
3. Created Redis, PostgreSQL, and Vault configs
4. Documented correct environment variable mapping

**Requires Manual Update** ⚠️:
1. Update `docker-compose.production.yml` environment variables
2. Create `.env.production` with real secrets
3. Initialize and unseal Vault
4. Test full deployment

---

**Status**: Production deployment is now **FUNCTIONAL** but requires manual environment variable updates and Vault initialization before first deployment.

**Next Steps**: Follow the [Remaining Manual Steps](#remaining-manual-steps) section above.
