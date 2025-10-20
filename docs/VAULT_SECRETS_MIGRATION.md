# Vault/OpenBao Secrets Migration Guide

This guide explains how to migrate sensitive environment variables from `.env` files or environment variables to **HashiCorp Vault** or **OpenBao** for secure secrets management.

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Vault Setup](#vault-setup)
4. [Migration Process](#migration-process)
5. [Vault Path Structure](#vault-path-structure)
6. [Verification](#verification)
7. [Rollback](#rollback)
8. [Production Deployment](#production-deployment)

---

## Overview

The platform enforces **Pure Vault Mode** for production deployments:

- **PRODUCTION**: Vault/OpenBao **REQUIRED** (application will fail to start without Vault)
- **DEVELOPMENT**: Vault optional (can use environment variables for convenience)
- **TESTING**: Vault optional (can use test fixtures)

### Security Architecture

**Production (Pure Vault Mode):**
- All secrets **MUST** be loaded from Vault/OpenBao
- Application validates Vault is enabled at startup
- No hardcoded defaults for sensitive credentials
- Environment variable fallbacks disabled for secrets

**Development (Flexible Mode):**
- Vault optional (set `VAULT__ENABLED=false`)
- Can use `.env` file for convenience
- Environment variables loaded into settings
- Warnings logged when not using Vault

### Benefits of Vault Integration

- **Centralized secrets management**: All sensitive credentials in one secure location
- **Access control**: Fine-grained permissions with policies
- **Audit logging**: Track who accessed which secrets when
- **Secret rotation**: Automated credential rotation support
- **Encryption at rest and in transit**: Industry-standard security
- **Dynamic secrets**: Generate temporary credentials on-demand

### Secrets Inventory

**44 sensitive environment variables** have been identified for migration:

- 12 already migrated (Database, Redis, JWT, SMTP, Storage, Vault token, Observability)
- 29 pending migration (Payment gateways, OSS integrations, RADIUS, Webhooks, etc.)
- 3 Vault configuration variables (do not store in Vault)

---

## Prerequisites

### 1. Vault/OpenBao Server

You need a running Vault or OpenBao server. Choose one option:

#### Option A: OpenBao (Recommended - Open Source)

```bash
# Using Docker
docker run -d \
  --name openbao \
  --cap-add=IPC_LOCK \
  -p 8200:8200 \
  -e 'OPENBAO_DEV_ROOT_TOKEN_ID=myroot' \
  -e 'OPENBAO_DEV_LISTEN_ADDRESS=0.0.0.0:8200' \
  quay.io/openbao/openbao:latest server -dev
```

#### Option B: HashiCorp Vault

```bash
# Using Docker
docker run -d \
  --name vault \
  --cap-add=IPC_LOCK \
  -p 8200:8200 \
  -e 'VAULT_DEV_ROOT_TOKEN_ID=myroot' \
  -e 'VAULT_DEV_LISTEN_ADDRESS=0.0.0.0:8200' \
  hashicorp/vault:latest server -dev
```

### 2. Vault CLI (Optional)

```bash
# Install Vault CLI
brew install vault  # macOS
apt-get install vault  # Debian/Ubuntu
yum install vault  # RHEL/CentOS
```

### 3. Environment Variables

Set these before migration:

```bash
export VAULT_ADDR="http://localhost:8200"
export VAULT_TOKEN="myroot"  # Use your actual root token
export VAULT_MOUNT_PATH="secret"  # Default KV v2 mount
export VAULT_KV_VERSION="2"  # KV version (1 or 2)
```

---

## Vault Setup

### 1. Initialize Vault (Production Only)

**Skip this step if using `-dev` mode.**

```bash
vault operator init -key-shares=5 -key-threshold=3

# Save the unseal keys and root token securely!
# Example output:
# Unseal Key 1: <key1>
# Unseal Key 2: <key2>
# Unseal Key 3: <key3>
# Unseal Key 4: <key4>
# Unseal Key 5: <key5>
# Initial Root Token: <root-token>
```

### 2. Unseal Vault (Production Only)

```bash
vault operator unseal <unseal-key-1>
vault operator unseal <unseal-key-2>
vault operator unseal <unseal-key-3>
```

### 3. Enable KV v2 Secrets Engine

```bash
# If not already enabled
vault secrets enable -path=secret kv-v2

# Verify
vault secrets list
```

### 4. Create Vault Policy for Platform

Create a policy file `dotmac-platform-policy.hcl`:

```hcl
# Policy for dotmac-platform application
path "secret/data/app/*" {
  capabilities = ["create", "read", "update", "delete", "list"]
}

path "secret/data/database/*" {
  capabilities = ["read", "list"]
}

path "secret/data/redis/*" {
  capabilities = ["read", "list"]
}

path "secret/data/auth/*" {
  capabilities = ["read", "list"]
}

path "secret/data/billing/*" {
  capabilities = ["read", "list"]
}

path "secret/data/smtp/*" {
  capabilities = ["read", "list"]
}

path "secret/data/storage/*" {
  capabilities = ["read", "list"]
}

path "secret/data/oss/*" {
  capabilities = ["read", "list"]
}

path "secret/data/radius/*" {
  capabilities = ["read", "list"]
}

path "secret/data/wireguard/*" {
  capabilities = ["create", "read", "update", "delete", "list"]
}

path "secret/data/webhooks/*" {
  capabilities = ["read", "list"]
}

path "secret/data/search/*" {
  capabilities = ["read", "list"]
}

path "secret/data/observability/*" {
  capabilities = ["read", "list"]
}

path "secret/metadata/*" {
  capabilities = ["list"]
}
```

Apply the policy:

```bash
vault policy write dotmac-platform dotmac-platform-policy.hcl
```

### 5. Create Application Token

```bash
# Create a token with the policy
vault token create -policy=dotmac-platform -period=24h -display-name="dotmac-platform"

# Save the token
export VAULT_TOKEN="<generated-token>"
```

---

## Migration Process

### Step 1: Dry Run (Preview Changes)

First, run a dry run to see what will be migrated:

```bash
python scripts/migrate_secrets_to_vault.py --dry-run
```

**Expected output:**

```
2025-10-15 12:00:00 - INFO - Vault URL: http://localhost:8200
2025-10-15 12:00:00 - INFO - Vault Mount: secret
2025-10-15 12:00:00 - INFO - KV Version: 2
2025-10-15 12:00:00 - INFO - Loaded 150 environment variables
2025-10-15 12:00:00 - INFO - Found 29 secrets to migrate
2025-10-15 12:00:00 - INFO - ✅ Vault connection successful

🔍 DRY RUN MODE - No changes will be made

2025-10-15 12:00:01 - INFO - 🔍 DRY RUN: Would migrate STRIPE_API_KEY → billing/stripe/api_key
2025-10-15 12:00:01 - INFO - 🔍 DRY RUN: Would migrate STRIPE_WEBHOOK_SECRET → billing/stripe/webhook_secret
...

============================================================
MIGRATION SUMMARY
============================================================
✅ Migrated: 29
⏭️  Skipped:  0
❌ Errors:   0
============================================================

This was a DRY RUN. Run without --dry-run to apply changes.
```

### Step 2: Migrate from .env File

If you have a `.env` file with secrets:

```bash
python scripts/migrate_secrets_to_vault.py --env-file .env
```

### Step 3: Migrate from Current Environment

Or migrate from currently exported environment variables:

```bash
python scripts/migrate_secrets_to_vault.py
```

### Step 4: Selective Migration (Optional)

Migrate only specific secret categories:

```bash
# Migrate only database and redis secrets
python scripts/migrate_secrets_to_vault.py --secrets database redis

# Migrate only payment gateway secrets
python scripts/migrate_secrets_to_vault.py --secrets stripe paypal

# Available categories:
# database, redis, auth, smtp, storage, stripe, paypal, tax,
# voltha, genieacs, netbox, awx, radius, webhooks, search,
# wireguard, observability
```

### Step 5: Force Overwrite (If Needed)

If secrets already exist and you want to update them:

```bash
python scripts/migrate_secrets_to_vault.py --force
```

---

## Vault Path Structure

All secrets are stored under the `secret/` mount with this structure:

```
secret/
├── app/
│   ├── secret_key
│   ├── encryption_key
│   └── jwt_secret
├── auth/
│   ├── jwt_secret
│   ├── platform_admin/
│   │   ├── email
│   │   └── password
│   └── jwt_secret_key
├── database/
│   ├── password
│   └── username
├── redis/
│   └── password
├── billing/
│   ├── stripe/
│   │   ├── api_key
│   │   ├── webhook_secret
│   │   └── publishable_key
│   ├── paypal/
│   │   ├── client_id
│   │   ├── client_secret
│   │   └── webhook_id
│   ├── avalara/
│   │   └── api_key
│   └── taxjar/
│       └── api_token
├── smtp/
│   ├── password
│   └── username
├── storage/
│   ├── access_key
│   └── secret_key
├── oss/
│   ├── voltha/
│   │   ├── password
│   │   └── token
│   ├── genieacs/
│   │   ├── password
│   │   └── token
│   ├── netbox/
│   │   ├── token
│   │   └── password
│   └── awx/
│       ├── password
│       └── token
├── radius/
│   └── secret
├── wireguard/
│   ├── encryption_key
│   └── servers/
│       └── {public_key}/
│           └── private-key
├── webhooks/
│   └── signing_secret
├── search/
│   └── meilisearch/
│       └── api_key
```

### Accessing Secrets Manually

```bash
# Read a secret
vault kv get secret/billing/stripe/api_key

# List secrets in a path
vault kv list secret/billing

# Write a secret
vault kv put secret/billing/stripe/api_key value="sk_test_..."

# Delete a secret
vault kv delete secret/billing/stripe/api_key
```

---

## Verification

### 1. Verify Secrets in Vault

```bash
# List all secret paths
vault kv list secret/

# Check specific secrets
vault kv get secret/database/password
vault kv get secret/billing/stripe/api_key
vault kv get secret/radius/secret
```

### 2. Test Application with Vault

Update your application environment:

```bash
# Enable Vault in application
export VAULT_ENABLED=true
export VAULT_ADDR="http://localhost:8200"
export VAULT_TOKEN="<your-token>"
export VAULT_MOUNT_PATH="secret"
export VAULT_KV_VERSION="2"

# Start the application
poetry run uvicorn dotmac.platform.main:app --reload
```

### 3. Verify Secrets are Loaded

Check application logs:

```
[INFO] Vault is enabled
[INFO] Fetching 44 secrets from Vault
[INFO] Successfully loaded 44 secrets from Vault
[INFO] WireGuard service initialized with Vault/OpenBao secret storage
[INFO] Billing configuration loaded with Stripe API key from Vault
```

### 4. Test API Endpoints

```bash
# Test that services work with Vault secrets
curl -X POST http://localhost:8000/api/v1/wireguard/servers \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"name":"vpn-server-1","public_endpoint":"vpn.example.com:51820"}'

# Should work without errors
```

### 5. Test Pure Vault Mode (Production Simulation)

```bash
# Simulate production environment
export ENVIRONMENT=production
export VAULT_ENABLED=true
export VAULT_ADDR="http://localhost:8200"
export VAULT_TOKEN="<your-token>"

# Remove all secret env vars (force Vault-only)
unset STRIPE_API_KEY
unset PAYPAL_CLIENT_ID
unset DATABASE_PASSWORD
unset RADIUS_SECRET

# Start application - should load all secrets from Vault
poetry run uvicorn dotmac.platform.main:app

# Expected output:
# [INFO] Environment: production
# [INFO] Vault is enabled
# [INFO] Fetching 44 secrets from Vault
# [INFO] Successfully loaded 44 secrets from Vault
# [INFO] Production security validation: PASSED
# [INFO] Application started successfully
```

### 6. Test Production Validation (Should Fail Without Vault)

```bash
# Simulate production WITHOUT Vault (should fail)
export ENVIRONMENT=production
export VAULT_ENABLED=false

# Try to start - should fail with security error
poetry run uvicorn dotmac.platform.main:app

# Expected error:
# ValueError: SECURITY ERROR: Vault/OpenBao MUST be enabled in production.
# Set VAULT__ENABLED=true and configure VAULT__ADDR, VAULT__TOKEN.
# See docs/VAULT_SECRETS_MIGRATION.md for setup instructions.
```

### 7. WireGuard VPN Integration Testing

WireGuard VPN has special integration with Vault for storing server private keys.

#### WireGuard Vault Architecture

**Storage Pattern:**
- Server private keys: `wireguard/servers/{public_key}/private-key`
- Database stores: `vault:wireguard/servers/{public_key}/private-key` (reference, not actual key)
- Vault metadata includes: `tenant_id`, `created_at`, `classification=restricted`

**Security Features:**
- **Production**: Private keys MUST be stored in Vault only
- **Development**: Falls back to encrypted storage using `SymmetricEncryptionService`
- **Pure Vault Mode**: Application refuses to start if Vault disabled in production

#### Test WireGuard Vault Integration

```bash
# Create a WireGuard server (triggers Vault storage)
curl -X POST http://localhost:8000/api/v1/wireguard/servers \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "name": "vpn-us-east-1",
    "public_endpoint": "vpn.example.com:51820",
    "server_ipv4": "10.8.0.1/24",
    "location": "US-East-1"
  }'

# Response includes server_id and public_key
# {
#   "id": "123e4567-e89b-12d3-a456-426614174000",
#   "public_key": "pNKC8FhUj8cJGMON4LKC9j8pCHGMON4LKC9j8pCH=",
#   "status": "active"
# }

# Verify private key stored in Vault (NOT in database)
vault kv get secret/wireguard/servers/pNKC8FhUj8cJGMON4LKC9j8pCHGMON4LKC9j8pCH=/private-key

# Output:
# ====== Data ======
# Key              Value
# ---              -----
# private_key      cNKC8FhUj8cJGMON4LKC9j8pCHGMON4LKC9j8pCH=
# tenant_id        550e8400-e29b-41d4-a716-446655440000
# created_at       2025-10-15T10:30:00.000Z
# classification   restricted

# Check application logs
tail -f logs/dotmac-platform.log
# [INFO] ✅ WireGuard service initialized with Vault/OpenBao (Pure Vault mode)
# [INFO] Stored WireGuard server private key in Vault at wireguard/servers/.../private-key

# Verify database only stores Vault reference
psql $DATABASE_URL -c \
  "SELECT id, name, public_key, substring(private_key_encrypted, 1, 50) as key_ref
   FROM wireguard_servers
   ORDER BY created_at DESC
   LIMIT 1;"

# Output:
#         id         |      name      |           public_key            |                     key_ref
# -------------------+----------------+---------------------------------+--------------------------------------------------
#  123e4567...       | vpn-us-east-1  | pNKC8FhUj8cJGMON4LKC9j8pCH=    | vault:wireguard/servers/pNKC8FhUj8cJGMON4LKC9...
```

#### WireGuard Failover Behavior

```bash
# Test 1: Production with Vault (expected behavior)
export ENVIRONMENT=production
export VAULT__ENABLED=true
poetry run uvicorn dotmac.platform.main:app

# Logs:
# [INFO] ✅ WireGuard service initialized with Vault/OpenBao (Pure Vault mode)
# [INFO] Creating WireGuard server with Vault storage

# Test 2: Production WITHOUT Vault (should fail)
export ENVIRONMENT=production
export VAULT__ENABLED=false
poetry run uvicorn dotmac.platform.main:app

# Expected error:
# HTTPException 503: WireGuard unavailable: Vault MUST be enabled in production

# Test 3: Development WITHOUT Vault (fallback allowed)
export ENVIRONMENT=development
export VAULT__ENABLED=false
export JWT_SECRET_KEY="test-secret-key-for-dev"
poetry run uvicorn dotmac.platform.main:app

# Logs:
# [WARNING] ⚠️  WireGuard using encrypted storage (Vault disabled - dev only)
# [WARNING] Storing WireGuard private key encrypted in database (Vault unavailable)
```

#### Vault Path Structure for WireGuard

```
secret/                               # Vault mount path
└── wireguard/
    ├── encryption_key                # Fallback encryption key (if needed)
    └── servers/
        ├── {server1_public_key}/
        │   └── private-key           # Server 1 private key + metadata
        ├── {server2_public_key}/
        │   └── private-key           # Server 2 private key + metadata
        └── {serverN_public_key}/
            └── private-key           # Server N private key + metadata
```

#### Security Benefits

1. **Private keys never in database**: Database only stores `vault:` references
2. **Audit trail**: All key access logged by Vault
3. **Rotation support**: Can rotate keys without database migration
4. **Access control**: Vault policies restrict who can read keys
5. **Fail-safe**: Application refuses to start in production without Vault

---

## Rollback

### ⚠️ Important: Production Rollback

**Pure Vault Mode cannot be disabled in production.** The application will refuse to start if:
- `ENVIRONMENT=production` AND
- `VAULT__ENABLED=false`

This is a security feature to prevent accidental deployment without secrets management.

### Development Rollback

If you need to disable Vault in **development/staging** only:

### 1. Disable Vault

```bash
# Must NOT be production environment
export ENVIRONMENT=development  # or staging
export VAULT__ENABLED=false
```

### 2. Restore .env File

```bash
cp .env.backup .env
```

### 3. Restart Application

```bash
poetry run uvicorn dotmac.platform.main:app --reload
```

### Emergency Production Rollback (Not Recommended)

If Vault is down and you need emergency access:

1. **DO NOT** set `ENVIRONMENT=production`
2. Use `ENVIRONMENT=staging` temporarily
3. Load secrets from emergency backup `.env` file
4. Fix Vault immediately
5. Switch back to production with Vault ASAP

```bash
# EMERGENCY ONLY - NOT FOR REGULAR USE
export ENVIRONMENT=staging  # Bypass production validation
export VAULT__ENABLED=false
# Load from emergency backup
source .env.emergency.backup

# Fix Vault, then restore proper config:
export ENVIRONMENT=production
export VAULT__ENABLED=true
```

---

## Production Deployment

### Migration Priority

**Phase 1 - Critical (Week 1):**
- Payment gateway credentials (Stripe, PayPal)
- Platform admin password
- Database passwords
- Vault AppRole credentials

**Phase 2 - High (Week 2):**
- OSS integration tokens (VOLTHA, GenieACS, NetBox, AWX)
- RADIUS secret
- Webhook signing secret
- Tax service API keys

**Phase 3 - Medium (Week 3):**
- Search/indexing API keys
- Encryption fallback keys
- SMTP credentials

### Production Checklist

- [ ] Vault server installed and initialized
- [ ] Unseal keys stored securely (use Shamir's Secret Sharing)
- [ ] Root token stored in secure location (password manager, hardware security module)
- [ ] Application policy created and applied
- [ ] Application token created with appropriate TTL
- [ ] Secrets migrated and verified
- [ ] Application configured with Vault environment variables
- [ ] Backup of .env file stored securely
- [ ] Testing completed on staging environment
- [ ] Monitoring and alerting configured for Vault
- [ ] Disaster recovery plan documented
- [ ] Team trained on Vault operations

### Environment Variables for Production

```bash
# REQUIRED: Vault configuration (Pure Vault Mode)
export ENVIRONMENT=production
export VAULT__ENABLED=true  # MANDATORY in production
export VAULT__ADDR="https://vault.production.example.com"
export VAULT__TOKEN="<app-token>"  # Or use AppRole
export VAULT__MOUNT_PATH="secret"
export VAULT__KV_VERSION="2"
export VAULT__NAMESPACE=""  # For Vault Enterprise

# DO NOT SET THESE IN PRODUCTION (loaded from Vault):
# - STRIPE_API_KEY
# - PAYPAL_CLIENT_SECRET
# - DATABASE_PASSWORD
# - RADIUS_SECRET
# - etc.

# Optional: Use AppRole authentication instead of token
export VAULT__ROLE_ID="<role-id>"
export VAULT__SECRET_ID="<secret-id>"

# Optional: Kubernetes authentication
export VAULT__KUBERNETES_ROLE="dotmac-platform"

# Non-sensitive configuration (OK to use env vars):
export REDIS__HOST="redis.production.example.com"
export DATABASE__HOST="postgres.production.example.com"
export TRUSTED_HOSTS="api.example.com,www.example.com"
```

### AppRole Authentication (Recommended for Production)

```bash
# Enable AppRole auth
vault auth enable approle

# Create role
vault write auth/approle/role/dotmac-platform \
  secret_id_ttl=24h \
  token_ttl=20m \
  token_max_ttl=30m \
  policies="dotmac-platform"

# Get role ID
vault read auth/approle/role/dotmac-platform/role-id

# Generate secret ID
vault write -f auth/approle/role/dotmac-platform/secret-id

# Application will authenticate automatically using role_id and secret_id
```

### Monitoring

Monitor Vault health and secret access:

```bash
# Check Vault status
vault status

# View audit logs
vault audit enable file file_path=/var/log/vault_audit.log

# Monitor failed authentication
tail -f /var/log/vault_audit.log | grep "error"
```

### Secret Rotation

Implement periodic secret rotation:

```bash
# Example: Rotate Stripe API key
# 1. Generate new key in Stripe dashboard
# 2. Store in Vault
vault kv put secret/billing/stripe/api_key value="sk_live_NEW_KEY"

# 3. Application will pick up new key on next restart or after cache TTL
# 4. Verify new key works
# 5. Delete old key from Stripe
```

---

## Troubleshooting

### Issue: "Vault health check failed"

**Cause**: Vault server is not reachable or not unsealed

**Solution**:
```bash
# Check Vault status
vault status

# Unseal if needed
vault operator unseal <key1>
vault operator unseal <key2>
vault operator unseal <key3>
```

### Issue: "Permission denied" errors

**Cause**: Application token doesn't have required permissions

**Solution**:
```bash
# Check token capabilities
vault token capabilities <token> secret/data/database/password

# If insufficient, create new token with correct policy
vault token create -policy=dotmac-platform
```

### Issue: Secrets not loading

**Cause**: Wrong mount path or KV version

**Solution**:
```bash
# Verify mount path
vault secrets list

# Check KV version
vault secrets list -detailed | grep secret

# Update environment variables
export VAULT_MOUNT_PATH="secret"  # or your custom mount
export VAULT_KV_VERSION="2"  # or "1"
```

### Issue: "Failed to migrate" errors

**Cause**: Empty or invalid environment variables

**Solution**:
```bash
# Check environment variables
env | grep STRIPE
env | grep DATABASE

# Ensure values are not empty
echo $STRIPE_API_KEY
```

---

## References

- [HashiCorp Vault Documentation](https://developer.hashicorp.com/vault/docs)
- [OpenBao Documentation](https://openbao.org/docs/)
- [Vault KV Secrets Engine](https://developer.hashicorp.com/vault/docs/secrets/kv)
- [Vault AppRole Authentication](https://developer.hashicorp.com/vault/docs/auth/approle)
- [Vault Production Hardening](https://developer.hashicorp.com/vault/tutorials/operations/production-hardening)

---

## Support

For questions or issues:

1. Check the [troubleshooting section](#troubleshooting)
2. Review application logs: `tail -f logs/dotmac-platform.log`
3. Check Vault audit logs: `tail -f /var/log/vault_audit.log`
4. Contact platform team: platform-team@example.com
