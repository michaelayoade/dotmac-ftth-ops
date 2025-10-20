# SMTP Credentials Management with Vault

## Overview

The communications service is configured to use **HashiCorp Vault** for secure SMTP credential storage by default. This ensures sensitive email credentials are never stored in environment variables or configuration files.

---

## ✅ Vault Integration Enabled

**Default Configuration**: `use_vault=True`

The email service automatically:
1. Connects to Vault using the platform's Vault client
2. Reads SMTP credentials from `secret/smtp` path
3. Falls back to environment variables if Vault is unavailable
4. Never logs passwords or credentials

---

## Setting Up SMTP Credentials in Vault

### Step 1: Ensure Vault is Running

```bash
# Check if Vault is accessible
docker ps | grep vault

# Or check Vault status
vault status
```

### Step 2: Store SMTP Credentials

#### Option A: Using Vault CLI

```bash
# Set Vault address and token
export VAULT_ADDR='http://localhost:8200'
export VAULT_TOKEN='your-vault-token'

# Store SMTP credentials
vault kv put secret/smtp \
    host="smtp.gmail.com" \
    port="587" \
    username="your-email@gmail.com" \
    password="your-app-password" \
    use_tls="true" \
    default_from="noreply@yourdomain.com"

# Verify credentials were stored
vault kv get secret/smtp
```

#### Option B: Using Python Script

Create `scripts/setup_smtp_vault.py`:

```python
"""Setup SMTP credentials in Vault."""
import hvac
import os

# Initialize Vault client
client = hvac.Client(
    url=os.getenv("VAULT_ADDR", "http://localhost:8200"),
    token=os.getenv("VAULT_TOKEN")
)

# SMTP configuration
smtp_config = {
    "host": "smtp.gmail.com",
    "port": "587",
    "username": "your-email@gmail.com",
    "password": "your-app-password",  # Use app-specific password for Gmail
    "use_tls": "true",
    "default_from": "noreply@yourdomain.com"
}

# Store in Vault
client.secrets.kv.v2.create_or_update_secret(
    path="smtp",
    secret=smtp_config,
)

print("✅ SMTP credentials stored in Vault at secret/smtp")

# Verify
secret = client.secrets.kv.v2.read_secret_version(path="smtp")
print(f"✅ Verified: Found {len(secret['data']['data'])} credential fields")
```

Run the script:
```bash
export VAULT_ADDR='http://localhost:8200'
export VAULT_TOKEN='your-vault-token'
python scripts/setup_smtp_vault.py
```

#### Option C: Using Vault HTTP API

```bash
# Store credentials
curl \
    --header "X-Vault-Token: $VAULT_TOKEN" \
    --request POST \
    --data @smtp-credentials.json \
    http://localhost:8200/v1/secret/data/smtp

# Where smtp-credentials.json contains:
{
  "data": {
    "host": "smtp.gmail.com",
    "port": "587",
    "username": "your-email@gmail.com",
    "password": "your-app-password",
    "use_tls": "true",
    "default_from": "noreply@yourdomain.com"
  }
}
```

---

## SMTP Provider Configurations

### Gmail (Recommended for Development)

**Vault Configuration**:
```json
{
  "host": "smtp.gmail.com",
  "port": "587",
  "username": "your-email@gmail.com",
  "password": "your-16-char-app-password",
  "use_tls": "true",
  "default_from": "noreply@yourdomain.com"
}
```

**Setup Steps**:
1. Enable 2-factor authentication on your Google account
2. Go to https://myaccount.google.com/apppasswords
3. Create an "App Password" for "Mail"
4. Copy the 16-character password
5. Store in Vault (use this as the `password` field)

### SendGrid (Recommended for Production)

**Vault Configuration**:
```json
{
  "host": "smtp.sendgrid.net",
  "port": "587",
  "username": "apikey",
  "password": "SG.your-sendgrid-api-key",
  "use_tls": "true",
  "default_from": "noreply@yourdomain.com"
}
```

**Setup Steps**:
1. Sign up at https://sendgrid.com
2. Create an API key with "Mail Send" permissions
3. Use `apikey` as username
4. Use API key as password
5. Store in Vault

### AWS SES (Recommended for Production)

**Vault Configuration**:
```json
{
  "host": "email-smtp.us-east-1.amazonaws.com",
  "port": "587",
  "username": "your-ses-smtp-username",
  "password": "your-ses-smtp-password",
  "use_tls": "true",
  "default_from": "verified@yourdomain.com"
}
```

**Setup Steps**:
1. Set up SES in AWS Console
2. Verify your domain/email
3. Create SMTP credentials in SES settings
4. Use generated SMTP username and password
5. Store in Vault

### Mailgun

**Vault Configuration**:
```json
{
  "host": "smtp.mailgun.org",
  "port": "587",
  "username": "postmaster@your-domain.mailgun.org",
  "password": "your-mailgun-smtp-password",
  "use_tls": "true",
  "default_from": "noreply@yourdomain.com"
}
```

---

## Environment Variables

The service checks these environment variables (in order):

```bash
# Vault configuration (recommended)
VAULT_ADDR=http://localhost:8200
VAULT_TOKEN=your-vault-token
SMTP_USE_VAULT=true  # Default: true
SMTP_VAULT_PATH=secret/smtp  # Default path

# Fallback to environment variables (if Vault unavailable)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_USE_TLS=true
SMTP_DEFAULT_FROM=noreply@yourdomain.com
```

---

## How It Works

### 1. Service Initialization

```python
# From communications/workflow_service.py
email_service = EmailService(
    smtp_host=getattr(settings, "SMTP_HOST", "localhost"),
    smtp_port=getattr(settings, "SMTP_PORT", 587),
    smtp_user=getattr(settings, "SMTP_USER", None),
    smtp_password=getattr(settings, "SMTP_PASSWORD", None),
    use_tls=getattr(settings, "SMTP_USE_TLS", True),
    default_from=getattr(settings, "SMTP_DEFAULT_FROM", "noreply@dotmac.com"),
    db=self.db,
    use_vault=getattr(settings, "SMTP_USE_VAULT", True),  # ✅ Vault enabled
    vault_path=getattr(settings, "SMTP_VAULT_PATH", "secret/smtp"),
)
```

### 2. Credential Retrieval

The `EmailService` (from `email_service.py`):
1. Checks if `use_vault=True`
2. Connects to Vault using platform's Vault client
3. Reads credentials from `vault_path`
4. Overrides `smtp_user` and `smtp_password` with Vault values
5. Falls back to environment variables if Vault fails
6. Logs connection (without credentials)

### 3. Security Features

✅ **No credentials in logs** - All logging masks passwords
✅ **No credentials in code** - Read from Vault at runtime
✅ **Vault token rotation** - Supports token renewal
✅ **Fallback to env vars** - Graceful degradation
✅ **TLS encryption** - Secure SMTP connection

---

## Testing Vault Integration

### Verify Vault Access

```bash
# Test Vault connection
vault kv get secret/smtp

# Should output:
# ====== Data ======
# Key            Value
# ---            -----
# host           smtp.gmail.com
# password       ****************
# port           587
# username       your-email@gmail.com
# ...
```

### Test Email Sending

```python
# Test email with Vault credentials
from src.dotmac.platform.communications.workflow_service import CommunicationsService
from src.dotmac.platform.db import get_session
import asyncio

async def test_vault_email():
    async for db in get_session():
        comm_service = CommunicationsService(db)

        result = await comm_service.send_template_email(
            template="customer_welcome",
            recipient="test@example.com",
            variables={
                "customer_name": "Test User",
                "customer_email": "test@example.com",
                "license_key": "TEST-123",
                "tenant_url": "https://test.dotmac.com",
                "company_name": "DotMac",
            }
        )

        print(f"Email sent: {result}")
        break

asyncio.run(test_vault_email())
```

### Check Logs

```bash
# Email service should log Vault usage
tail -f logs/app.log | grep -i "vault\|email"

# Expected output:
# Email service initialized ... use_vault=True
# Email sent successfully: template='customer_welcome', recipient=test@example.com
```

---

## Troubleshooting

### Issue: "Vault connection failed"

**Solution**:
1. Check Vault is running: `docker ps | grep vault`
2. Verify `VAULT_ADDR` and `VAULT_TOKEN` are set
3. Test Vault access: `vault status`
4. Check Vault logs: `docker logs vault`

### Issue: "SMTP authentication failed"

**Solution**:
1. Verify credentials in Vault: `vault kv get secret/smtp`
2. For Gmail: Ensure you're using an App Password, not your regular password
3. Check SMTP host and port are correct
4. Verify TLS settings match provider requirements

### Issue: "Fallback to environment variables"

**Meaning**: Vault unavailable, using env vars
**Solution**:
- This is expected behavior for graceful degradation
- Fix Vault connection if you want to use Vault
- Or continue using env vars as fallback

### Issue: "Template not found"

**Solution**:
1. Create email templates (see `EMAIL_TEMPLATES_SETUP.md`)
2. Service will send fallback email automatically
3. Workflow continues even if template missing

---

## Production Checklist

### Before Deploying to Production

- [ ] Vault is running and accessible
- [ ] SMTP credentials stored in Vault at `secret/smtp`
- [ ] Vault token has read access to `secret/smtp`
- [ ] SMTP provider supports production volume (SendGrid/SES recommended)
- [ ] Domain verified with email provider (for SPF/DKIM)
- [ ] Email templates created in database
- [ ] Test emails sent successfully
- [ ] Logs monitored for email delivery

### Vault Security

- [ ] Vault token rotation configured
- [ ] Vault audit logging enabled
- [ ] Access policies restrict SMTP secret to email service only
- [ ] Vault sealed/unsealed properly
- [ ] Backup of Vault data configured

### Email Security

- [ ] SPF records configured for domain
- [ ] DKIM keys set up
- [ ] DMARC policy configured
- [ ] TLS encryption enabled
- [ ] Rate limiting configured with provider

---

## Vault Secret Rotation

To rotate SMTP credentials:

```bash
# 1. Generate new app password/API key from provider

# 2. Update Vault
vault kv put secret/smtp \
    host="smtp.gmail.com" \
    port="587" \
    username="your-email@gmail.com" \
    password="new-app-password" \
    use_tls="true" \
    default_from="noreply@yourdomain.com"

# 3. Restart application to reload credentials
# (Or wait for next email send - credentials fetched on each use)

# 4. Verify new credentials work
# Send test email via workflow
```

---

## Summary

✅ **Vault integration enabled by default** for SMTP credentials
✅ **Secure credential storage** - No passwords in code or env files
✅ **Automatic fallback** to environment variables if Vault unavailable
✅ **Production-ready** with proper secret management
✅ **Multiple providers supported** (Gmail, SendGrid, SES, Mailgun)

The communications service is now **production-ready** with enterprise-grade security!
