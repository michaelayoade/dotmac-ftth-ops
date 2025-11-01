# RADIUS GitOps Workflow

## Philosophy

FreeRADIUS server configuration is **infrastructure-as-code** and should be managed through GitOps workflows, not through direct UI mutation. This ensures:

- ✅ **Auditability** - All changes are tracked in Git
- ✅ **Reproducibility** - Same config across dev/stage/prod
- ✅ **Safety** - Changes go through review (PR) and CI validation
- ✅ **Rollback** - Easy to revert bad changes

## What Goes Through GitOps vs. API

### ✅ **Managed via API (Tenant-Facing)**
These are tenant-scoped operations that happen frequently:
- Creating/editing RADIUS subscribers
- Assigning bandwidth profiles
- Managing NAS devices (routers/OLTs per tenant)
- Disconnecting sessions (CoA/DM)
- Viewing usage statistics

### 🔒 **Managed via GitOps (Server-Level)**
These are global server configurations that change infrequently:
- `radiusd.conf` settings (ports, performance tuning)
- Module enable/disable (`mods-enabled/*`)
- Site/virtual server configuration
- Dictionary files
- EAP/TLS configuration
- Shared secret rotation (scripted + Vault)

## Directory Structure

```
config/radius/
├── radiusd.conf          # Main server config (GitOps)
├── clients.conf          # NAS clients (API-managed for tenants)
├── authorize             # Test users (GitOps)
├── dictionary            # Main dictionary (GitOps)
├── dictionary.rfc5176    # CoA dictionary (GitOps)
├── dictionaries.d/       # Custom dictionaries (GitOps)
│   ├── dictionary.mikrotik
│   └── dictionary.cisco
├── mods-enabled/         # Enabled modules (GitOps - symlinks)
│   ├── sql -> ../mods-available/sql
│   └── eap -> ../mods-available/eap
├── sites-enabled/        # Enabled sites (GitOps - symlinks)
│   └── default -> ../sites-available/default
└── certs/                # TLS certificates (Vault + GitOps)
    ├── server.pem
    ├── server.key
    └── ca.pem
```

## GitOps Workflow

### Making Configuration Changes

1. **Create a branch**
   ```bash
   git checkout -b radius/enable-ldap-module
   ```

2. **Make changes**
   ```bash
   # Example: Enable LDAP module
   cd config/radius/mods-enabled
   ln -s ../mods-available/ldap ldap

   # Or edit radiusd.conf
   vim ../radiusd.conf
   ```

3. **Validate locally**
   ```bash
   make -f Makefile.radius validate
   ```

4. **Commit and push**
   ```bash
   git add config/radius/
   git commit -m "feat(radius): enable LDAP authentication module"
   git push origin radius/enable-ldap-module
   ```

5. **Create Pull Request**
   - PR description explains the change
   - CI pipeline runs validation (`radiusd -XC`)
   - Peer review
   - Merge to main

6. **CI/CD deploys automatically**
   - Pipeline applies config to staging
   - Runs smoke tests
   - Promotes to production after approval
   - Reloads FreeRADIUS gracefully

### Rolling Back

```bash
# Revert to previous commit
git revert HEAD
git push

# Or restore from backup
make -f Makefile.radius restore BACKUP=radius-backup-20251101-100000.tar.gz
```

## Operational Tooling

### Makefile Commands

```bash
# Health & Status
make -f Makefile.radius status          # Quick status check
make -f Makefile.radius health          # Comprehensive health check
make -f Makefile.radius metrics         # Performance metrics

# Configuration
make -f Makefile.radius validate        # Validate config without applying
make -f Makefile.radius reload          # Graceful reload (SIGHUP)
make -f Makefile.radius restart         # Full restart (disconnects sessions)

# Backup & Restore
make -f Makefile.radius backup          # Create backup
make -f Makefile.radius restore BACKUP=file.tar.gz

# Secrets
make -f Makefile.radius rotate-secrets  # Rotate all NAS secrets
make -f Makefile.radius rotate-secret-single NAS=router01

# Monitoring
make -f Makefile.radius logs            # Tail logs
make -f Makefile.radius show-sessions   # Active sessions
make -f Makefile.radius show-auth-failures

# GitOps
make -f Makefile.radius gitops-sync     # Pull from Git and reload
```

### Secret Rotation Script

```bash
# Rotate a single NAS secret
./scripts/radius/rotate-nas-secrets.sh --nas-name=router01

# Rotate all secrets
./scripts/radius/rotate-nas-secrets.sh --all

# Dry-run (show what would happen)
./scripts/radius/rotate-nas-secrets.sh --all --dry-run

# Uses Vault for storage
export VAULT_TOKEN=hvs.xxx
export VAULT_ADDR=https://vault.example.com
./scripts/radius/rotate-nas-secrets.sh --all
```

## Observability API

Instead of mutation endpoints, we provide **read-only observability endpoints** for monitoring:

### Health & Status
```bash
GET /api/v1/radius/observability/health
GET /api/v1/radius/observability/modules
GET /api/v1/radius/observability/config-files
```

### Security Monitoring
```bash
GET /api/v1/radius/observability/secrets/audit
GET /api/v1/radius/observability/certificates
GET /api/v1/radius/observability/auth-failures
```

### Performance
```bash
GET /api/v1/radius/observability/performance
GET /api/v1/radius/observability/logs/tail
```

### GitOps Integration
```bash
GET /api/v1/radius/observability/config-drift
GET /api/v1/radius/observability/backup-status
```

## Monitoring & Alerting

### Prometheus Metrics (Future)
```yaml
# /metrics endpoint
radius_uptime_seconds
radius_active_sessions
radius_auth_requests_total{result="accept|reject"}
radius_certificate_expiry_days{cert="server|ca"}
radius_config_drift_detected{file="radiusd.conf"}
radius_secret_rotation_days{nas_id="1"}
```

### Alert Rules

```yaml
# Prometheus AlertManager rules
groups:
  - name: radius
    rules:
      - alert: RADIUSDown
        expr: up{job="radius"} == 0
        for: 1m

      - alert: RADIUSCertificateExpiring
        expr: radius_certificate_expiry_days < 30
        annotations:
          summary: "TLS certificate expires in {{ $value }} days"

      - alert: RADIUSSecretRotationOverdue
        expr: radius_secret_rotation_days > 90
        annotations:
          summary: "NAS {{ $labels.nas_id }} secret not rotated in {{ $value }} days"

      - alert: RADIUSConfigDrift
        expr: radius_config_drift_detected == 1
        annotations:
          summary: "Config file {{ $labels.file }} has drifted from Git"

      - alert: RADIUSHighAuthFailures
        expr: rate(radius_auth_requests_total{result="reject"}[5m]) > 10
        annotations:
          summary: "High authentication failure rate"
```

### Slack/PagerDuty Integration

```python
# Slack webhook for alerts
async def send_radius_alert(alert_type: str, details: dict):
    if alert_type == "certificate_expiring":
        message = f"⚠️ RADIUS TLS certificate expires in {details['days']} days!"
    elif alert_type == "secret_rotation_due":
        message = f"🔑 NAS {details['nas_name']} secret hasn't been rotated in {details['days']} days"
    elif alert_type == "config_drift":
        message = f"⚙️ Config file {details['file']} has drifted from Git"

    await slack_webhook.send(message)
```

## CI/CD Pipeline

### GitHub Actions Example

```yaml
name: RADIUS Config CI/CD

on:
  pull_request:
    paths:
      - 'config/radius/**'
  push:
    branches: [main]
    paths:
      - 'config/radius/**'

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Validate FreeRADIUS Config
        run: |
          docker run --rm \
            -v $(pwd)/config/radius:/etc/freeradius \
            freeradius/freeradius-server:latest \
            radiusd -XC

      - name: Check for secrets in config
        run: |
          # Ensure no secrets are committed
          ! grep -r "secret = " config/radius/ | grep -v "testing123"

  deploy-staging:
    needs: validate
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to Staging
        run: |
          # rsync config to staging server
          # reload FreeRADIUS

      - name: Smoke Tests
        run: |
          # Run radtest against staging

  deploy-production:
    needs: deploy-staging
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    environment: production
    steps:
      - name: Create Backup
        run: make -f Makefile.radius backup

      - name: Deploy to Production
        run: |
          # rsync config to production
          make -f Makefile.radius reload

      - name: Verify Health
        run: make -f Makefile.radius health
```

## Security Best Practices

1. **Never commit secrets** - Use Vault or environment variables
2. **Review all PRs** - Peer review before merging
3. **Test in staging first** - Always test changes before prod
4. **Backup before changes** - Automated backups before each deployment
5. **Audit all changes** - Git history provides audit trail
6. **Limit who can approve** - Use branch protection and CODEOWNERS
7. **Monitor for drift** - Alert if manual changes are made
8. **Rotate secrets regularly** - Automated reminders for rotation

## Troubleshooting

### Config validation fails
```bash
# See detailed errors
make -f Makefile.radius validate

# Test manually
docker exec isp-freeradius radiusd -XC
```

### Reload doesn't apply changes
```bash
# Full restart may be needed for some changes
make -f Makefile.radius restart
```

### Auth still using old secret after rotation
```bash
# Check if secret was updated in clients.conf
docker exec isp-freeradius cat /etc/freeradius/clients.conf | grep -A 5 "client router01"

# Verify container picked up changes
make -f Makefile.radius reload
```

### Config drifted from Git
```bash
# Check for local changes
make -f Makefile.radius gitops-status

# Sync from Git (will overwrite local changes)
make -f Makefile.radius gitops-sync
```

## References

- [FreeRADIUS Configuration](https://wiki.freeradius.org/config)
- [GitOps Principles](https://www.gitops.tech/)
- [HashiCorp Vault](https://www.vaultproject.io/)
- [Infrastructure as Code](https://infrastructure-as-code.com/)
