# Paystack Integration with Vault - Setup Guide

## Overview

This guide explains how to securely store and manage Paystack payment gateway credentials using HashiCorp Vault or OpenBao for the Payment Methods Service.

---

## Quick Setup Summary

✅ **Pypaystack2 SDK installed** - Version 2.1.1
✅ **Settings configured** - Paystack keys added to BillingSettings
✅ **Vault mapping configured** - Secrets loader updated for Paystack
✅ **Production validation** - Key format validation added

---

## 1. Vault Paths for Paystack Secrets

The following Vault paths are configured in `src/dotmac/platform/secrets/secrets_loader.py`:

```python
SECRETS_MAPPING = {
    # Paystack (Primary payment gateway)
    "billing.paystack_secret_key": "billing/paystack/secret_key",
    "billing.paystack_public_key": "billing/paystack/public_key",
}
```

### Path Structure

- **Mount Path:** `secret/` (KV v2 secrets engine)
- **Secret Paths:**
  - `secret/billing/paystack/secret_key` - Paystack Secret Key (sk_live_* or sk_test_*)
  - `secret/billing/paystack/public_key` - Paystack Public Key (pk_live_* or pk_test_*)

---

## 2. Storing Paystack Secrets in Vault

### Prerequisites

1. **Vault/OpenBao server running** (default: http://localhost:8200)
2. **Vault token** with write permissions to `secret/billing/*`
3. **Paystack account** with API keys

### Option A: Using Vault CLI

```bash
# Set Vault address and token
export VAULT_ADDR="http://localhost:8200"
export VAULT_TOKEN="your-vault-root-token"

# Store Paystack secret key
vault kv put secret/billing/paystack/secret_key value="sk_test_xxxxxxxxxxxxxxxxxxxx"

# Store Paystack public key
vault kv put secret/billing/paystack/public_key value="pk_test_xxxxxxxxxxxxxxxxxxxx"

# Verify secrets are stored
vault kv get secret/billing/paystack/secret_key
vault kv get secret/billing/paystack/public_key
```

### Option B: Using Python Script

```python
#!/usr/bin/env python3
"""Store Paystack secrets in Vault."""

from dotmac.platform.secrets.vault_client import VaultClient

# Initialize Vault client
vault = VaultClient(
    url="http://localhost:8200",
    token="your-vault-root-token",
    mount_path="secret",
    kv_version=2,
)

# Store Paystack secrets
vault.set_secret("billing/paystack/secret_key", {
    "value": "sk_test_xxxxxxxxxxxxxxxxxxxx"
})

vault.set_secret("billing/paystack/public_key", {
    "value": "pk_test_xxxxxxxxxxxxxxxxxxxx"
})

print("✅ Paystack secrets stored in Vault successfully")

vault.close()
```

### Option C: Using HTTP API

```bash
# Set Vault token
export VAULT_TOKEN="your-vault-root-token"

# Store Paystack secret key
curl -X POST http://localhost:8200/v1/secret/data/billing/paystack/secret_key \
  -H "X-Vault-Token: $VAULT_TOKEN" \
  -d '{
    "data": {
      "value": "sk_test_xxxxxxxxxxxxxxxxxxxx"
    }
  }'

# Store Paystack public key
curl -X POST http://localhost:8200/v1/secret/data/billing/paystack/public_key \
  -H "X-Vault-Token: $VAULT_TOKEN" \
  -d '{
    "data": {
      "value": "pk_test_xxxxxxxxxxxxxxxxxxxx"
    }
  }'
```

---

## 3. Environment Configuration

### Development (.env)

For development, you can use environment variables directly:

```bash
# Vault configuration
VAULT_ENABLED=false
VAULT_URL=http://localhost:8200
VAULT_TOKEN=your-dev-vault-token

# Paystack (for development without Vault)
PAYSTACK_SECRET_KEY=sk_test_xxxxxxxxxxxxxxxxxxxx
PAYSTACK_PUBLIC_KEY=pk_test_xxxxxxxxxxxxxxxxxxxx
```

### Production (.env.production)

For production, **always use Vault**:

```bash
# Vault configuration (REQUIRED in production)
VAULT_ENABLED=true
VAULT_URL=https://vault.yourdomain.com
VAULT_TOKEN=your-production-vault-token
VAULT_NAMESPACE=production  # Optional, for Vault Enterprise

# DO NOT set Paystack keys directly in production
# They will be loaded from Vault automatically
```

---

## 4. Application Startup with Vault

### Automatic Secret Loading

The application automatically loads Paystack secrets from Vault during startup if `VAULT_ENABLED=true`.

**Startup Sequence:**

1. **Application starts** → Settings initialized
2. **Vault enabled** → Check `VAULT_ENABLED` setting
3. **Health check** → Verify Vault is accessible
4. **Fetch secrets** → Load all secrets from Vault paths
5. **Update settings** → Inject secrets into `settings.billing.paystack_*`
6. **Validate** → Verify production secrets (format, presence)
7. **Ready** → Application ready to process payments

### Code Flow

```python
# In main.py or application startup
from dotmac.platform.secrets.secrets_loader import load_secrets_from_vault

# Load secrets from Vault (async)
await load_secrets_from_vault()

# Now settings.billing.paystack_secret_key and
# settings.billing.paystack_public_key are populated from Vault
```

---

## 5. Accessing Paystack Secrets in Code

### In Payment Methods Service

The `PaymentMethodService` automatically retrieves Paystack credentials from settings:

```python
# src/dotmac/platform/billing/payment_methods/service.py

def _get_paystack_client(self) -> Paystack:
    """Get Paystack client instance."""
    from dotmac.platform.settings import get_settings
    from pypaystack2 import Paystack

    settings = get_settings()

    # Secret key is loaded from Vault automatically
    secret_key = settings.billing.paystack_secret_key

    if not secret_key:
        raise PaymentMethodError(
            "Paystack secret key not configured. "
            "Ensure VAULT_ENABLED=true and secrets are stored in Vault."
        )

    return Paystack(secret_key=secret_key)
```

### Verification

```python
# Verify Paystack secrets are loaded
from dotmac.platform.settings import get_settings

settings = get_settings()

print(f"Paystack Secret Key: {settings.billing.paystack_secret_key[:10]}...")
print(f"Paystack Public Key: {settings.billing.paystack_public_key[:10]}...")
```

---

## 6. Production Validation

The application validates Paystack secrets in production:

### Validation Rules

1. **Secret Key Required** - Must be set in Vault
2. **Public Key Required** - Must be set in Vault
3. **Format Validation:**
   - Secret keys must start with `sk_live_` or `sk_test_`
   - Public keys must start with `pk_live_` or `pk_test_`
4. **Live Keys in Production** - Warning if using test keys

### Validation Errors

If validation fails, the application will raise errors at startup:

```
Production secrets validation failed:
  - Paystack secret key is not set (required for payment processing)
  - Paystack public key is not set (required for payment processing)
```

---

## 7. Testing the Setup

### Step 1: Start Vault (Development)

```bash
# Start Vault in dev mode
vault server -dev

# In another terminal, set environment
export VAULT_ADDR='http://localhost:8200'
export VAULT_TOKEN='your-dev-root-token'
```

### Step 2: Store Test Secrets

```bash
# Store Paystack test keys
vault kv put secret/billing/paystack/secret_key value="sk_test_your_test_secret_key"
vault kv put secret/billing/paystack/public_key value="pk_test_your_test_public_key"
```

### Step 3: Configure Application

```bash
# .env
VAULT_ENABLED=true
VAULT_URL=http://localhost:8200
VAULT_TOKEN=your-dev-root-token
```

### Step 4: Start Application

```bash
poetry run uvicorn dotmac.platform.main:app --reload
```

### Step 5: Verify Secrets Loaded

Check application logs:

```
INFO: Fetching 25 secrets from Vault
INFO: Successfully loaded 25 secrets from Vault
INFO: Updated billing.paystack_secret_key from Vault
INFO: Updated billing.paystack_public_key from Vault
```

### Step 6: Test Payment Method API

```bash
# Add a test payment method
curl -X POST http://localhost:8000/api/billing/payment-methods \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-jwt-token" \
  -d '{
    "method_type": "card",
    "token": "test_card_token_from_paystack",
    "billing_details": {
      "billing_name": "John Doe",
      "billing_email": "john@example.com",
      "billing_country": "NG"
    },
    "set_as_default": true
  }'
```

---

## 8. Security Best Practices

### ✅ DO

1. **Always use Vault in production** - Never store secrets in environment variables
2. **Rotate secrets regularly** - Update Paystack keys every 90 days
3. **Use separate keys per environment** - Test keys for dev/staging, live keys for production
4. **Audit Vault access** - Monitor who accesses payment gateway secrets
5. **Use Vault namespaces** - Isolate production secrets from other environments
6. **Enable Vault audit logging** - Track all secret accesses
7. **Use AppRole authentication** - For production deployments
8. **Encrypt Vault storage backend** - Use encrypted storage (Consul, etcd with encryption)

### ❌ DON'T

1. **Never commit secrets to git** - Always use Vault or environment variables
2. **Never log secret values** - Mask secrets in application logs
3. **Never share Vault tokens** - Each service should have its own token
4. **Never use test keys in production** - Always use `sk_live_*` keys for production
5. **Never disable Vault in production** - Always require `VAULT_ENABLED=true`
6. **Never use root token in production** - Use scoped tokens with minimal permissions
7. **Never expose Vault externally** - Use VPN or private network access only
8. **Never reuse secrets across environments** - Each environment gets unique credentials

---

## 9. Vault Access Control (Production)

### Recommended Vault Policy

Create a policy for the payment service:

```hcl
# paystack-payment-service-policy.hcl
path "secret/data/billing/paystack/*" {
  capabilities = ["read"]
}

path "secret/metadata/billing/paystack/*" {
  capabilities = ["list"]
}
```

Apply the policy:

```bash
vault policy write paystack-payment-service paystack-payment-service-policy.hcl
```

### AppRole Authentication (Recommended for Production)

```bash
# Enable AppRole auth
vault auth enable approle

# Create AppRole for payment service
vault write auth/approle/role/payment-service \
    token_policies="paystack-payment-service" \
    token_ttl=1h \
    token_max_ttl=4h

# Get Role ID and Secret ID
vault read auth/approle/role/payment-service/role-id
vault write -f auth/approle/role/payment-service/secret-id
```

Use in production:

```python
# Authenticate with AppRole
import hvac

client = hvac.Client(url='https://vault.yourdomain.com')
client.auth.approle.login(
    role_id='your-role-id',
    secret_id='your-secret-id'
)

# Now use client to fetch secrets
```

---

## 10. Troubleshooting

### Issue: "Paystack secret key not configured"

**Cause:** Vault is not enabled or secrets not loaded

**Solution:**
```bash
# Check Vault is enabled
grep VAULT_ENABLED .env

# Verify Vault is accessible
vault status

# Check secrets exist
vault kv get secret/billing/paystack/secret_key
```

### Issue: "Failed to load secrets from Vault"

**Cause:** Vault is unreachable or authentication failed

**Solution:**
```bash
# Check Vault health
curl http://localhost:8200/v1/sys/health

# Verify token is valid
vault token lookup

# Check network connectivity
ping vault.yourdomain.com
```

### Issue: "Paystack secret key has invalid format"

**Cause:** Secret key doesn't start with `sk_live_` or `sk_test_`

**Solution:**
```bash
# Verify key format from Paystack dashboard
# Update Vault with correct key
vault kv put secret/billing/paystack/secret_key value="sk_live_correct_key_format"
```

### Issue: Secrets not updating after Vault change

**Cause:** Application caches settings at startup

**Solution:**
```bash
# Restart the application to reload secrets
systemctl restart dotmac-platform

# Or in development
# Stop and restart uvicorn
```

---

## 11. Paystack Test Keys

For development and testing, use Paystack test mode keys:

### Getting Test Keys

1. **Sign up at Paystack** - https://paystack.com/
2. **Go to Settings → API Keys & Webhooks**
3. **Copy test keys:**
   - Test Secret Key: `sk_test_xxxxxxxxxx`
   - Test Public Key: `pk_test_xxxxxxxxxx`

### Test Cards (Nigeria)

```
Card Number: 4084084084084081
CVV: 408
Expiry: 01/99
PIN: 0000
OTP: 123456
```

```
Card Number: 5060666666666666666 (Verve)
CVV: 123
Expiry: 12/99
PIN: 0000
OTP: 123456
```

### Store Test Keys in Vault

```bash
vault kv put secret/billing/paystack/secret_key value="sk_test_your_actual_test_key"
vault kv put secret/billing/paystack/public_key value="pk_test_your_actual_test_key"
```

---

## 12. Production Deployment Checklist

### Pre-Deployment

- [ ] Paystack live keys obtained from Paystack dashboard
- [ ] Vault server configured with TLS/SSL
- [ ] Vault initialized and unsealed
- [ ] AppRole authentication configured
- [ ] Vault policy created for payment service
- [ ] Secrets stored in Vault production namespace
- [ ] Vault audit logging enabled
- [ ] Vault backup configured

### Deployment

- [ ] `VAULT_ENABLED=true` in production environment
- [ ] Vault URL points to production Vault server (HTTPS)
- [ ] Vault token has minimal required permissions
- [ ] Application successfully connects to Vault
- [ ] Secrets loaded and validated at startup
- [ ] Payment method API endpoints tested
- [ ] Paystack webhooks configured
- [ ] Error monitoring configured (Sentry, etc.)

### Post-Deployment

- [ ] Verify payment processing works end-to-end
- [ ] Test payment method creation with live card
- [ ] Monitor Vault access logs
- [ ] Set up secret rotation schedule
- [ ] Document secret rotation procedure
- [ ] Configure alerts for Vault failures
- [ ] Train team on Vault access procedures

---

## 13. Summary

### ✅ Completed Setup

1. **SDK Installed** - `pypaystack2` version 2.1.1
2. **Settings Configured** - Paystack keys in `BillingSettings`
3. **Vault Mapping** - Secrets loader updated with Paystack paths
4. **Validation** - Production secret validation with format checks
5. **Documentation** - Complete setup guide created

### 🔐 Vault Configuration

- **Paths Configured:**
  - `secret/billing/paystack/secret_key`
  - `secret/billing/paystack/public_key`

- **Automatic Loading:** Secrets loaded at application startup
- **Format Validation:** Keys validated for `sk_*` and `pk_*` prefixes
- **Production Enforcement:** Vault required in production mode

### 🚀 Next Steps

1. **Store secrets in Vault** (development or production)
2. **Enable Vault** - Set `VAULT_ENABLED=true`
3. **Restart application** - Secrets loaded automatically
4. **Test payment methods** - Create test payment method via API
5. **Monitor logs** - Verify secrets loaded successfully

---

## 14. References

- **Paystack API Documentation:** https://paystack.com/docs/api/
- **Pypaystack2 SDK:** https://github.com/gray-adeyi/pypaystack2
- **HashiCorp Vault:** https://www.vaultproject.io/docs
- **OpenBao (Open Source Vault):** https://openbao.org/docs

---

**Status:** ✅ READY FOR PRODUCTION

**Last Updated:** 2025-10-17
