# Tenant Provisioning Automation

This directory contains the Ansible control-plane assets invoked by the DotMac
platform when onboarding a per-tenant ISP stack.

## Entry Point & Current Capabilities

- **`playbooks/provision_tenant.yml`** is the AWX entry point. It imports the full
  deployment playbook based on `deployment_mode`:
  - `dotmac_hosted`: Imports `deployment/provision-docker.yml` for Docker Compose deployment
  - `customer_hosted`: Imports `deployment/provision-tenant.yml` for systemd deployment
  - Provisions complete infrastructure: PostgreSQL, Redis, FreeRADIUS, backend API, Celery workers, Next.js frontend, Nginx reverse proxy, SSL certificates

- **`playbooks/decommission_tenant.yml`** completely removes a tenant deployment:
  - Backs up database and configuration before deletion
  - Stops all services (Docker Compose or systemd)
  - Removes systemd service files, nginx configs, SSL certificates
  - Drops database and database user
  - Removes RADIUS and Redis configurations
  - Deletes Vault secrets
  - Cleans up all directories, users, and logs

- **`playbooks/upgrade_tenant.yml`** upgrades existing tenant deployments:
  - Supports both Docker Compose (dotmac_hosted) and systemd (customer_hosted) modes
  - Backs up database and configuration before upgrade
  - Pulls new Docker images or upgrades Python packages
  - Rebuilds frontend if needed
  - Runs database migrations
  - Verifies health after upgrade
  - Provides rollback instructions if upgrade fails

## Deployment Playbooks

| Playbook | Purpose | Infrastructure Provisioned |
| -------- | ------- | ------------------------- |
| `deployment/provision-tenant.yml` | Full systemd deployment (customer_hosted) | PostgreSQL database, Redis instance, FreeRADIUS server, Backend API (uvicorn), Celery workers, Next.js frontend, Nginx reverse proxy, SSL certificates (Let's Encrypt) |
| `deployment/provision-docker.yml` | Docker Compose deployment (dotmac_hosted) | All services containerized: postgres, redis, radius, api, celery-worker, frontend. Includes systemd wrapper for auto-start on boot. |

## Roles

| Role | Purpose | Notes |
| ---- | ------- | ------ |
| `tenant_common` | Shared bootstrap actions (packages, workspace, metadata). | Creates `/opt/dotmac/<tenant>` and provisioning metadata. |
| `tenant_post_provision` | Calls back into the platform and records summary artifacts. | Persists `SUMMARY.md` and status callbacks. |

## Configuration Templates

The `playbooks/deployment/templates/` directory contains Jinja2 templates for all service configurations:

### Systemd Services
- `tenant-service.service.j2` - Backend API service
- `celery-worker.service.j2` - Celery worker service
- `frontend.service.j2` - Next.js frontend service
- `redis-tenant.service.j2` - Redis instance service
- `freeradius-tenant.service.j2` - FreeRADIUS server service
- `docker-compose-tenant.service.j2` - Docker Compose systemd wrapper

### Application Configuration
- `config.env.j2` - Environment variables for all services (131 lines)
- `nginx-site.conf.j2` - Nginx reverse proxy with SSL/WebSocket support

### RADIUS Configuration
- `radiusd-tenant.conf.j2` - FreeRADIUS server configuration
- `radius-clients.conf.j2` - NAS device definitions
- `radius-sql.conf.j2` - PostgreSQL integration for RADIUS
- `radius-site.conf.j2` - Virtual server configuration
- `radius-schema.sql.j2` - Database schema for RADIUS tables

### Infrastructure Configuration
- `redis-tenant.conf.j2` - Redis instance configuration
- `docker-compose-tenant.yml.j2` - Complete Docker Compose stack definition

## Architecture

### Per-Tenant Isolation

Each tenant receives:
- **Dedicated database**: `tenant_<id>` with user `tenant_<id>_user`
- **Dedicated Redis instance**: Running on unique port with password auth
- **Dedicated RADIUS server**: Listening on unique ports (auth, acct, CoA)
- **Dedicated services**: API, Celery workers, frontend all tenant-scoped
- **Unique SSL certificate**: Per-tenant subdomain or custom domain
- **Isolated configuration**: All secrets and configs tenant-specific

### Deployment Modes

**DotMac Hosted (Docker Compose)**
- All services run as containers on DotMac infrastructure
- Managed by systemd for auto-start on boot
- Resource limits enforced via Docker deploy config
- Easier to scale and maintain centrally

**Customer Hosted (Systemd)**
- Services run directly on customer-provided server
- Python virtualenv for backend
- Node.js process for frontend
- Native systemd services for each component
- Customer has full control over infrastructure

### Port Allocation Strategy

- Provide `tenant_port_offset` explicitly if you need deterministic values.
- Otherwise the playbooks derive a numeric seed by parsing any digits in `tenant_id`; if none exist, they hash the tenant slug and use the first 4 hex characters.
- The seed drives default ports:
  - **API** = `8000 + ((seed % 400) * 10)`
  - **Frontend** = `API + 1000`
  - **Redis** = `15000 + (seed % 400)`
  - **RADIUS Auth/Acct/CoA** = `1812/1813/3799 + (seed % 200)`

Pass explicit `app_port`, `frontend_port`, `redis_port`, or `radius_*` values if you need to override the derived defaults.

### SSL/TLS Automation

- Automatic Let's Encrypt certificate provisioning via certbot
- Nginx integration with `--nginx` flag
- Support for custom domains in addition to subdomains
- Automatic renewal cron job (weekly checks)
- Certificate revocation on decommissioning

## Inventory Management

Inventories under `inventories/` are generated dynamically by the provisioning
service using connection metadata stored in the `tenant_provisioning_jobs` table.

AWX job templates reference these inventories and pass tenant-specific variables:
- `tenant_id`, `tenant_subdomain`, `domain`
- `db_password`, `redis_password`, `radius_secret`, `jwt_secret_key`
- `app_port`, `frontend_port`, `redis_port`, `radius_port`
- `resources` (CPU/memory limits, worker counts)
- `features` (enabled/disabled feature flags)

## Usage Examples

### Provision a new tenant
```bash
ansible-playbook playbooks/provision_tenant.yml \
  -e tenant_id=isp-001 \
  -e deployment_mode=customer_hosted \
  -e version=1.0.0 \
  -e tenant_subdomain=isp001 \
  -e domain=dotmac.io
```

### Upgrade an existing tenant
```bash
ansible-playbook playbooks/upgrade_tenant.yml \
  -e tenant_id=isp-001 \
  -e deployment_mode=customer_hosted \
  -e version=1.1.0
```

### Decommission a tenant
```bash
ansible-playbook playbooks/decommission_tenant.yml \
  -e tenant_id=isp-001 \
  -e deployment_mode=customer_hosted \
  -e backup_before_delete=true
```
