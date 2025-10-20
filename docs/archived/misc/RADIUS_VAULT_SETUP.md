# RADIUS Configuration with HashiCorp Vault

This document explains how to configure RADIUS secrets using HashiCorp Vault for the dotmac FTTH platform.

## Table of Contents

1. [Overview](#overview)
2. [What Goes in Vault vs Configuration](#what-goes-in-vault-vs-configuration)
3. [Development Setup](#development-setup)
4. [Production Setup](#production-setup)
5. [Multi-Tenant Configuration](#multi-tenant-configuration)
6. [Troubleshooting](#troubleshooting)

---

## Overview

The platform's RADIUS CoA (Change of Authorization) client requires:
- **RADIUS dictionary files**: Public schema definitions (NOT secrets)
- **RADIUS shared secret**: Authentication credential (MUST be in Vault for production)

### Architecture

```
┌─────────────────┐      ┌──────────────┐      ┌──────────────┐
│ CoA Client      │─────>│ Settings     │─────>│ Vault        │
│ (coa_client.py) │      │ (settings.py)│      │ (Secrets)    │
└─────────────────┘      └──────────────┘      └──────────────┘
        │                       │
        │                       └──> Dictionary paths
        │                            (config/radius/)
        │
        └──> RADIUS Server (port 3799)
```

---

## What Goes in Vault vs Configuration

### ❌ NOT Secrets (Do NOT Put in Vault)

These are **public schema definitions** and should be in configuration files:

```bash
# RADIUS dictionary files
config/radius/dictionary
config/radius/dictionary.rfc5176

# Configuration settings
RADIUS_SERVER_HOST=10.100.1.10
RADIUS_COA_PORT=3799
RADIUS_TIMEOUT=5
RADIUS_DICTIONARY_PATH=/etc/raddb/dictionary
```

### ✅ Secrets (MUST Go in Vault for Production)

These are **credentials** and MUST be stored securely:

```bash
# RADIUS shared secret (required)
Vault path: radius/shared-secret

# HTTP API key (if using HTTP API fallback)
Vault path: radius/http-api-key

# Per-tenant secrets (multi-tenant deployments)
Vault path: radius/tenant-{tenant_id}/shared-secret
```

---

## Development Setup

### Option 1: No Vault (Quick Start)

For local development, you can use `.env` file without Vault:

```bash
# .env
VAULT__ENABLED=false
RADIUS_SECRET=testing123
RADIUS_SERVER_HOST=localhost
RADIUS_COA_PORT=3799
```

**Security Warning**: This is for development only. Production MUST use Vault.

### Option 2: Local Vault (Recommended for Development)

1. **Start Vault Container**:
```bash
docker-compose up -d openbao
```

2. **Initialize Vault**:
```bash
# Get Vault token from docker logs
docker logs dotmac-ftth-ops-openbao-1

# Or set a known token in docker-compose.yml
VAULT_TOKEN=dev-only-token
```

3. **Store RADIUS Secret**:
```bash
# Using Vault CLI
export VAULT_ADDR=http://localhost:8200
export VAULT_TOKEN=dev-only-token

vault kv put secret/radius/shared-secret value="testing123"
```

Or using the platform's API:
```bash
curl -X POST http://localhost:8000/api/v1/platform/secrets/radius/shared-secret \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{"data": {"value": "testing123"}}'
```

4. **Update `.env`**:
```bash
VAULT__ENABLED=true
VAULT_URL=http://localhost:8200
VAULT_TOKEN=dev-only-token
VAULT_MOUNT_POINT=secret

# Leave RADIUS_SECRET empty - will fetch from Vault
RADIUS_SECRET=
```

5. **Verify**:
```bash
poetry run python -c "
from dotmac.platform.radius.coa_client import CoAClient
client = CoAClient()
print(f'Loaded secret from Vault: {client.radius_secret[:5]}...')
"
```

---

## Production Setup

### Prerequisites

- HashiCorp Vault or OpenBao deployed and accessible
- Vault authentication method configured (AppRole, Kubernetes, etc.)
- KV secrets engine v2 mounted

### Step 1: Enable Vault in Configuration

```bash
# Production .env or environment variables
ENVIRONMENT=production
VAULT__ENABLED=true
VAULT_URL=https://vault.your-company.com
VAULT_MOUNT_POINT=secret
VAULT_NAMESPACE=dotmac  # If using Vault Enterprise namespaces

# DO NOT set VAULT_TOKEN in .env for production!
# Use AppRole, Kubernetes auth, or other dynamic auth method
```

### Step 2: Configure Vault Authentication

#### Option A: AppRole (Recommended)

```bash
# On Vault server
vault auth enable approle

# Create policy for RADIUS secrets
vault policy write radius-policy - <<EOF
path "secret/data/radius/*" {
  capabilities = ["read"]
}
EOF

# Create AppRole
vault write auth/approle/role/dotmac-platform \
  secret_id_ttl=24h \
  token_ttl=20m \
  token_max_ttl=30m \
  policies="radius-policy"

# Get role_id and secret_id
vault read auth/approle/role/dotmac-platform/role-id
vault write -f auth/approle/role/dotmac-platform/secret-id
```

Configure the platform to use AppRole:
```python
# In your platform startup code
from dotmac.platform.secrets import VaultConnectionManager

vault = VaultConnectionManager(
    url="https://vault.your-company.com",
    auth_method="approle",
    role_id="your-role-id",
    secret_id="your-secret-id",
)
```

#### Option B: Kubernetes Service Account

```bash
# On Vault server
vault auth enable kubernetes

vault write auth/kubernetes/config \
  kubernetes_host="https://kubernetes.default.svc" \
  kubernetes_ca_cert=@/var/run/secrets/kubernetes.io/serviceaccount/ca.crt \
  token_reviewer_jwt=@/var/run/secrets/kubernetes.io/serviceaccount/token

vault write auth/kubernetes/role/dotmac-platform \
  bound_service_account_names=dotmac-platform \
  bound_service_account_namespaces=dotmac \
  policies=radius-policy \
  ttl=1h
```

Platform auto-authenticates using service account token.

### Step 3: Store RADIUS Secrets

```bash
# Single-tenant deployment
vault kv put secret/radius/shared-secret value="$(openssl rand -hex 32)"

# Multi-tenant deployment (per-tenant secrets)
vault kv put secret/radius/tenant-123/shared-secret value="$(openssl rand -hex 32)"
vault kv put secret/radius/tenant-456/shared-secret value="$(openssl rand -hex 32)"

# HTTP API key (if using HTTP API fallback)
vault kv put secret/radius/http-api-key value="Bearer $(openssl rand -hex 32)"
```

### Step 4: Install RADIUS Dictionary Files

Dictionary files are NOT secrets. Install them on the server:

```bash
# Option 1: Use setup script
./scripts/setup_radius_dictionaries.sh /etc/raddb

# Option 2: Include in Docker image
# See Dockerfile example below
```

### Step 5: Configure Environment

```bash
# Production environment variables
VAULT__ENABLED=true
VAULT_URL=https://vault.your-company.com
VAULT_MOUNT_POINT=secret

# RADIUS server configuration (NOT secrets)
RADIUS_SERVER_HOST=10.100.1.10
RADIUS_COA_PORT=3799
RADIUS_DICTIONARY_PATH=/etc/raddb/dictionary
RADIUS_DICTIONARY_COA_PATH=/etc/raddb/dictionary.rfc5176

# DO NOT set RADIUS_SECRET - will be fetched from Vault
# RADIUS_SECRET=  # Empty or omit entirely
```

### Step 6: Docker/Kubernetes Deployment

**Dockerfile**:
```dockerfile
FROM python:3.13-slim

# Install RADIUS dictionaries (public files)
RUN mkdir -p /etc/raddb && \
    curl -sSL https://raw.githubusercontent.com/FreeRADIUS/freeradius-server/v3.2.x/share/dictionary \
         -o /etc/raddb/dictionary && \
    curl -sSL https://raw.githubusercontent.com/FreeRADIUS/freeradius-server/v3.2.x/share/dictionary.rfc5176 \
         -o /etc/raddb/dictionary.rfc5176

# Copy application
COPY . /app
WORKDIR /app

RUN poetry install --no-dev

CMD ["uvicorn", "dotmac.platform.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

**Kubernetes Deployment**:
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: radius-config
data:
  RADIUS_SERVER_HOST: "10.100.1.10"
  RADIUS_COA_PORT: "3799"
  RADIUS_DICTIONARY_PATH: "/etc/raddb/dictionary"
  RADIUS_DICTIONARY_COA_PATH: "/etc/raddb/dictionary.rfc5176"

---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: dotmac-platform
spec:
  template:
    spec:
      serviceAccountName: dotmac-platform  # For Kubernetes auth
      containers:
      - name: api
        image: dotmac-platform:latest
        envFrom:
        - configMapRef:
            name: radius-config
        env:
        - name: VAULT__ENABLED
          value: "true"
        - name: VAULT_URL
          value: "https://vault.your-company.com"
        # Vault token injected via Vault Agent sidecar or Kubernetes auth
```

---

## Multi-Tenant Configuration

### Scenario: Different RADIUS Servers per Tenant

Store per-tenant secrets in Vault with tenant-specific paths:

```bash
# Tenant 123 (ISP A)
vault kv put secret/radius/tenant-123/shared-secret value="secret-for-isp-a"

# Tenant 456 (ISP B)
vault kv put secret/radius/tenant-456/shared-secret value="secret-for-isp-b"
```

Configure per-tenant RADIUS servers:

```python
# In your service layer
from dotmac.platform.radius.coa_client import CoAClient

# Auto-loads secret from Vault based on tenant_id
client = CoAClient(
    radius_server="radius-server-isp-a.com",
    tenant_id="123"  # Fetches from vault path: radius/tenant-123/shared-secret
)

await client.disconnect_session(username="user@isp-a.com")
```

### Vault Path Structure

```
secret/
├── radius/
│   ├── shared-secret              # Global/default secret
│   ├── http-api-key               # HTTP API auth (if used)
│   ├── tenant-123/
│   │   └── shared-secret          # Tenant-specific secret
│   ├── tenant-456/
│   │   └── shared-secret
│   └── tenant-789/
│       └── shared-secret
```

---

## Troubleshooting

### Issue: "RADIUS shared secret not configured"

**Symptom**:
```
RADIUSCoAError: RADIUS shared secret not configured. Set RADIUS_SECRET environment variable or configure Vault.
```

**Solutions**:
1. Check Vault is enabled: `VAULT__ENABLED=true`
2. Verify Vault is accessible: `curl $VAULT_URL/v1/sys/health`
3. Check secret exists: `vault kv get secret/radius/shared-secret`
4. Verify Vault token has permissions
5. For development, set `RADIUS_SECRET=testing123` in `.env`

### Issue: "Failed to load RADIUS secret from Vault"

**Symptom**:
```
WARNING: Failed to load RADIUS secret from Vault, falling back to settings
```

**Solutions**:
1. **Check Vault connection**:
   ```bash
   vault status
   ```

2. **Verify secret path**:
   ```bash
   # Check secret exists
   vault kv get secret/radius/shared-secret

   # Output should include:
   # ====== Data ======
   # Key      Value
   # ---      -----
   # value    your-secret-here
   ```

3. **Check Vault token**:
   ```bash
   vault token lookup
   ```

4. **Verify platform Vault config**:
   ```python
   from dotmac.platform.settings import settings
   print(f"Vault enabled: {settings.vault.enabled}")
   print(f"Vault URL: {settings.vault.url}")
   print(f"Mount path: {settings.vault.mount_path}")
   ```

### Issue: "Dictionary files not found"

**Symptom**:
```
RADIUSCoAError: Unable to locate RADIUS dictionary files
```

**Solutions**:
1. **Check dictionary files exist**:
   ```bash
   ls -la /etc/raddb/dictionary*
   # Or
   ls -la ./config/radius/dictionary*
   ```

2. **Install dictionaries**:
   ```bash
   ./scripts/setup_radius_dictionaries.sh /etc/raddb
   ```

3. **Update environment variables**:
   ```bash
   export RADIUS_DICTIONARY_PATH=/etc/raddb/dictionary
   export RADIUS_DICTIONARY_COA_PATH=/etc/raddb/dictionary.rfc5176
   ```

### Issue: "SECURITY WARNING: Using RADIUS secret from settings in production"

**Symptom**:
```
ERROR: SECURITY WARNING: Using RADIUS secret from settings in production!
Secrets MUST be stored in Vault for production deployments.
```

**This is a critical security issue**. Never use `.env` secrets in production.

**Solution**:
1. Enable Vault: `VAULT__ENABLED=true`
2. Store secret in Vault: `vault kv put secret/radius/shared-secret value="..."`
3. Remove `RADIUS_SECRET` from `.env`
4. Restart platform

### Verifying Configuration

**Test Vault Integration**:
```bash
poetry run python -c "
from dotmac.platform.settings import settings
from dotmac.platform.secrets import get_vault_secret

print(f'Vault enabled: {settings.vault.enabled}')

if settings.vault.enabled:
    try:
        secret = get_vault_secret('radius/shared-secret')
        print(f'✅ RADIUS secret loaded from Vault: {secret[\"value\"][:5]}...')
    except Exception as e:
        print(f'❌ Failed to load secret: {e}')
else:
    print('⚠️  Vault not enabled, using settings fallback')
"
```

**Test CoA Client**:
```bash
poetry run python scripts/validate_priority3_refactoring.py
```

---

## Security Best Practices

### ✅ DO

1. **Always use Vault in production**
2. **Rotate RADIUS secrets regularly** (90 days recommended)
3. **Use different secrets per tenant** in multi-tenant deployments
4. **Audit secret access** using Vault audit logs
5. **Use dynamic authentication** (AppRole, Kubernetes auth) instead of static tokens
6. **Restrict Vault policies** to least-privilege access
7. **Enable Vault TLS** for production
8. **Monitor secret expirations** and set up alerts

### ❌ DON'T

1. **Never commit secrets to git** (.env files with real secrets)
2. **Never use static Vault tokens in production**
3. **Don't share secrets across environments** (dev/staging/prod)
4. **Don't log RADIUS secrets** in application logs
5. **Don't store dictionary files in Vault** (they're public schemas)
6. **Don't hardcode secrets** in application code
7. **Don't use weak secrets** (use `openssl rand -hex 32`)

---

## References

- [HashiCorp Vault Documentation](https://www.vaultproject.io/docs)
- [Vault KV Secrets Engine](https://www.vaultproject.io/docs/secrets/kv/kv-v2)
- [Vault AppRole Auth](https://www.vaultproject.io/docs/auth/approle)
- [Vault Kubernetes Auth](https://www.vaultproject.io/docs/auth/kubernetes)
- [RFC 5176 - RADIUS Dynamic Authorization](https://tools.ietf.org/html/rfc5176)
- [FreeRADIUS Dictionaries](https://github.com/FreeRADIUS/freeradius-server/tree/v3.2.x/share)
