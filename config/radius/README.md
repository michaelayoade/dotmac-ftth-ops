# FreeRADIUS Configuration Files

## Security Model

### Production Configuration

**Files committed to Git:**
- `radiusd.conf` - Server settings (NO secrets)
- `clients.conf` - NAS client template (secrets via environment variables)
- `authorize` - EMPTY or SQL fallback only (NO test users)
- `dictionary*` - RADIUS attribute definitions

**Secrets managed separately:**
- NAS shared secrets → HashiCorp Vault
- TLS private keys → Vault + mounted at runtime
- Test credentials → Local override files (NOT committed)

### Local Development Configuration

**For local testing only:**

> Note: The legacy `docker-compose.override.yml.example` file has been removed along with the bundled FreeRADIUS service. If you run FreeRADIUS via Docker, create your own override file (or compose stack) that mounts the development-only files described below.

1. **Create a Compose override** that mounts the test artifacts (example snippet):
   ```yaml
   services:
     freeradius:
       volumes:
         - ./config/radius/authorize.test:/etc/raddb/mods-config/files/authorize:ro
         - ./config/radius/clients.test.conf:/etc/raddb/clients.d/localhost.conf:ro
   ```

2. **This enables:**
   - Test user `test/test` for healthchecks
   - Localhost client with `testing123` secret
   - FreeRADIUS healthcheck passes

3. **Files used:**
   - `authorize.test` - Contains test user (mounted via override)
   - Environment variable `RADIUS_LOCALHOST_SECRET=testing123`

## File Descriptions

### `clients.conf`
Defines NAS devices that can communicate with RADIUS.

**Production:**
- NAS devices are added via API (`POST /api/v1/radius/nas`)
- Secrets stored in Vault, referenced via environment variables
- Example entries are removed or use `${VAR}` placeholders

**Local Dev:**
- Override file adds localhost with `testing123`
- Test NAS devices can be added manually

### `authorize`
Controls user authentication methods.

**Production (THIS FILE):**
```
# All authentication via SQL database (enforces tenant isolation)
DEFAULT Auth-Type := SQL
        Fall-Through = Yes
```

**Local Dev (`authorize.test`):**
```
# Test user (bypasses database)
test    Cleartext-Password := "test"

# All other users via SQL
DEFAULT Auth-Type := SQL
```

**⚠️ NEVER mount `authorize.test` in production!**

### `dictionary*`
RADIUS attribute definitions (RFC 2865, 2866, vendor-specific).

These are safe to commit - they contain no secrets, only attribute definitions.

### `radiusd.conf`
Main server configuration.

**Settings:**
- Listen ports (1812, 1813, 3799)
- Performance tuning (max_requests, timeouts)
- Logging configuration
- Module loading

**NO secrets in this file.** Use environment variables for anything sensitive.

## Environment Variables

### Production
```bash
# Vault-backed secrets
RADIUS_LOCALHOST_SECRET=<from-vault>
POSTGRES_PASSWORD=<from-vault>
REDIS_PASSWORD=<from-vault>
```

### Local Development
```bash
# .env file (NOT committed to Git)
RADIUS_LOCALHOST_SECRET=testing123
POSTGRES_PASSWORD=changeme
```

## Adding New NAS Devices

### Via API (Recommended)
```bash
POST /api/v1/radius/nas
{
  "nasname": "10.0.1.1",
  "shortname": "router01",
  "type": "router",
  "vendor": "mikrotik",
  "secret": "strong-random-secret-32-chars"
}
```

The API will:
- Generate strong secret if not provided
- Store secret in Vault
- Update `clients.conf` dynamically
- Reload FreeRADIUS

### Manual (For Infrastructure)
If adding infrastructure NAS devices that should be in Git:

1. **Edit `clients.conf`:**
   ```
   client router01 {
       ipaddr = 10.0.1.1
       secret = ${ROUTER01_RADIUS_SECRET}
       shortname = router01
   }
   ```

2. **Store secret in Vault:**
   ```bash
   vault kv put secret/radius/nas/router01 shared_secret="..."
   ```

3. **Update environment/compose:**
   ```yaml
   environment:
     - ROUTER01_RADIUS_SECRET=${ROUTER01_RADIUS_SECRET}
   ```

4. **Commit to Git** (no secrets in files)

## Secret Rotation

Use the provided script:
```bash
# Rotate all NAS secrets
make -f Makefile.radius rotate-secrets

# Rotate single NAS
make -f Makefile.radius rotate-secret-single NAS=router01
```

The script will:
1. Generate new strong secret
2. Store in Vault with timestamp
3. Update `clients.conf`
4. Reload FreeRADIUS gracefully
5. Create backup before changes

## Testing Authentication

### Local Development
```bash
# Using test user (only works with override file)
docker exec isp-freeradius radtest test test localhost 0 testing123

# Using database user (via API)
docker exec isp-freeradius radtest user@example.com password localhost 0 testing123
```

### Production
```bash
# Only database authentication works
docker exec isp-freeradius radtest user@example.com password localhost 0 "${RADIUS_LOCALHOST_SECRET}"
```

## Security Checklist

Before deploying to production:

- [ ] Remove `docker-compose.override.yml` (or ensure it's in `.gitignore`)
- [ ] Verify `authorize` file has NO test users
- [ ] Verify `clients.conf` has NO hardcoded secrets (use `${VAR}`)
- [ ] All secrets in Vault
- [ ] Environment variables configured
- [ ] Test that `test/test` user does NOT authenticate
- [ ] Verify only database users can authenticate
- [ ] Healthcheck uses real database user or is adjusted for SQL-only auth

## References

- [FreeRADIUS Documentation](https://wiki.freeradius.org/)
- [RADIUS RFC 2865](https://datatracker.ietf.org/doc/html/rfc2865)
- [GitOps Workflow](../docs/RADIUS_GITOPS_WORKFLOW.md)
