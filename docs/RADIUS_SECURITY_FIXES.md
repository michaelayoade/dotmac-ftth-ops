# RADIUS Security Fixes

## Issues Identified & Fixed

### 1. ❌ Mock Observability API (REMOVED)

**Issue:** `src/dotmac/platform/radius/observability_router.py` returned hardcoded "happy path" values:
- Always reported "healthy" status
- Fake certificate expiry data
- Mock performance metrics
- All endpoints had `# TODO: Implement` comments

**Problem:** Integrating this into monitoring would give false positives, hiding real issues.

**Fix:** ✅ **File removed entirely**
- Will only add observability endpoints when properly implemented
- Any monitoring integration must use real checks

---

### 2. ❌ Static Test User in Production Config (FIXED)

**Issue:** `config/radius/authorize` contained:
```
test    Cleartext-Password := "test"
```

**Problem:**
- Bypasses SQL database authentication
- Ignores tenant isolation and RBAC
- Works in ANY environment (dev, staging, prod)
- Security hole - anyone knowing `test/test` can authenticate

**Fix:** ✅ **Separated test and production configs**

**Production (`config/radius/authorize`):**
```
# All authentication via SQL database
DEFAULT Auth-Type := SQL
        Fall-Through = Yes
```

**Local Dev Only (`config/radius/authorize.test`):**
```
# WARNING: NEVER mount this in production!
test    Cleartext-Password := "test"

DEFAULT Auth-Type := SQL
```

**Usage:**
```yaml
# docker-compose.override.yml (local dev only)
volumes:
  - ./config/radius/authorize.test:/etc/raddb/mods-config/files/authorize
```

---

### 3. ❌ Hardcoded Secrets in Committed Config (FIXED)

**Issue:** `config/radius/clients.conf` contained multiple insecure entries:
```
# Hardcoded weak secrets
client router01 {
    secret = changeme_router_secret  # COMMITTED TO GIT!
}

# Wide CIDR ranges
client dynamic_devices {
    ipaddr = 10.0.0.0/16  # ENTIRE /16 SUBNET!
    secret = changeme_dynamic_secret
}

client docker_network {
    ipaddr = 172.16.0.0/12  # ENTIRE DOCKER NETWORK!
    secret = testing123
}
```

**Problems:**
- Weak secrets committed to Git (public if repo is public)
- Wide CIDR ranges (`10.0.0.0/16`, `172.16.0.0/12`) allow thousands of IPs
- Example entries would work in production if not removed
- Anyone on these networks with the known secret can authenticate

**Fix:** ✅ **Completely cleaned production config**

**Production (`config/radius/clients.conf`):**
```
# ONLY localhost for healthcheck
client localhost {
    ipaddr = 127.0.0.1
    secret = ${RADIUS_LOCALHOST_SECRET}  # From environment/Vault
}

# All other NAS devices added via API or with environment variables
# NO hardcoded secrets
# NO wide CIDR ranges
# NO example entries
```

**Local Dev (`config/radius/clients.test.conf`):**
```
# Contains example NAS devices with weak secrets
# Only mounted via docker-compose.override.yml
# NEVER deployed to production
```

**Mounting test config (local only):**
```yaml
# docker-compose.override.yml
volumes:
  - ./config/radius/clients.test.conf:/etc/freeradius/clients.conf
```

---

## Security Model (After Fixes)

### Production Deployment

1. **No test users** - All auth via SQL database
2. **No hardcoded secrets** - Everything from Vault or environment
3. **Restricted client IPs** - Only known NAS devices, no wide CIDRs
4. **Override file not deployed** - `.gitignore` blocks it

### Local Development

1. **Copy override file** - Explicitly opt-in to test mode
   ```bash
   cp docker-compose.override.yml.example docker-compose.override.yml
   ```

2. **Test user enabled** - Only when override file present
3. **Healthcheck works** - Uses test user locally
4. **Clear separation** - Different files for prod vs. dev

---

## File Structure (Secure)

```
config/radius/
├── authorize                  # PRODUCTION: SQL only, no test users ✅
├── authorize.test             # LOCAL DEV ONLY: Contains test user ⚠️
├── clients.conf               # PRODUCTION: Env vars, no secrets ✅
├── dictionary                 # Safe (no secrets) ✅
└── README.md                  # Security documentation ✅

# NOT committed to Git:
docker-compose.override.yml    # .gitignore ✅
.env                          # .gitignore ✅
```

---

## Checklist Before Production

### ✅ Configuration
- [ ] `config/radius/authorize` has NO test users
- [ ] `config/radius/clients.conf` has NO hardcoded secrets
- [ ] All secrets use `${ENVIRONMENT_VARIABLES}`
- [ ] No wide CIDR ranges (like `172.16.0.0/12`)

### ✅ Environment
- [ ] All secrets stored in Vault
- [ ] Environment variables set from Vault
- [ ] `RADIUS_LOCALHOST_SECRET` is strong (not `testing123`)

### ✅ Files
- [ ] `docker-compose.override.yml` is in `.gitignore`
- [ ] `authorize.test` is NOT mounted in production
- [ ] `.env` is in `.gitignore` (if used)

### ✅ Testing
- [ ] Test user `test/test` does NOT authenticate in prod
- [ ] Only database users can authenticate
- [ ] Healthcheck works with real user or is process-based

### ✅ Deployment
- [ ] CI/CD uses Vault for secrets
- [ ] No secrets in environment variable logs
- [ ] Config validated before deployment
- [ ] Rollback plan tested

---

## How to Test Locally

1. **Copy override file:**
   ```bash
   cp docker-compose.override.yml.example docker-compose.override.yml
   ```

2. **Start services:**
   ```bash
   docker compose up -d
   ```

3. **Verify test user works:**
   ```bash
   docker exec isp-freeradius radtest test test localhost 0 testing123
   # Should see: Access-Accept
   ```

4. **Verify database auth works:**
   ```bash
   # Create a subscriber via API first
   docker exec isp-freeradius radtest user@example.com password localhost 0 testing123
   ```

---

## Production Deployment Example

### 1. Vault Setup
```bash
# Store NAS secrets
vault kv put secret/radius/nas/1 \
  shared_secret="$(openssl rand -base64 32)"

# Store localhost secret
vault kv put secret/radius/localhost \
  shared_secret="$(openssl rand -base64 32)"
```

### 2. Environment Variables (from Vault)
```yaml
# docker-compose.prod.yml or systemd service
environment:
  - RADIUS_LOCALHOST_SECRET=${vault:secret/radius/localhost#shared_secret}
```

### 3. No Override File
```bash
# Ensure override is not deployed
rm docker-compose.override.yml
```

### 4. Verify Security
```bash
# This should FAIL in production:
docker exec isp-freeradius radtest test test localhost 0 any-secret
# Should see: Access-Reject

# This should work (if user exists in DB):
docker exec isp-freeradius radtest real-user password localhost 0 "${RADIUS_LOCALHOST_SECRET}"
```

---

## References

- [FreeRADIUS Security](https://wiki.freeradius.org/guide/Security)
- [HashiCorp Vault](https://www.vaultproject.io/)
- [OWASP Secrets Management](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)
