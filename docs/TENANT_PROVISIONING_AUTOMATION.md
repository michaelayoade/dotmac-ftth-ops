# Tenant Provisioning Automation

The platform can now orchestrate dedicated ISP environments per tenant. When a
platform admin requests provisioning via the API, the workflow persists a job
record, launches an AWX/Ansible playbook, and tracks lifecycle events until the
tenant is active or the run fails.

## Workflow Overview

1. **Create Job** – `POST /api/v1/tenants/{tenant_id}/provisioning/jobs` validates
   the tenant, records a `tenant_provisioning_jobs` row, and marks the tenant
   status as `provisioning`.
2. **Launch Automation** – The Celery worker (`tenant_provisioning.execute`) calls
   AWX with the selected job template and extra vars (tenant slug, deployment
   mode, connection profile).
3. **Monitor Progress** – `tenant_provisioning.monitor` polls AWX until the job
   finishes. Success transitions the tenant to `provisioned`; failures move it to
   `failed_provisioning` and store the error message.
4. **Post-Provision Hooks** – Optional playbook tasks invoke `tenant_post_provision`
   to notify the platform callback endpoint and write local artefacts.

## Deployment Modes

The provisioning request accepts a `deployment_mode` specifying the target:

- `dotmac_hosted` – Builds the stack on DotMac-managed infrastructure using the
  `tenant_dotmac_hosted` role.
- `customer_hosted` – Targets customer-supplied servers via the
  `tenant_customer_hosted` role and renders a connection profile for SSH access.

Both paths share `tenant_common` bootstrap tasks and finish with `tenant_post_provision`.

## AWX Playbook Structure

Playbooks live under `ansible/playbooks/`:

- `provision_tenant.yml` – Entry point used by the provisioning job (loads roles
  based on deployment mode).
- `decommission_tenant.yml` – Removes tenant resources when a subscription ends.
- `upgrade_tenant.yml` – Reconciles tenant services to a newer release.

Inventories for DotMac-hosted and customer-hosted deployments are seeded under
`ansible/inventories/` and designed to be rendered dynamically by the
provisioning service before submitting an AWX job.

## Testing

- Service-level coverage lives in `tests/tenant/test_provisioning_service.py`.
- Router behaviour is validated by `tests/tenant/test_provisioning_router.py` with
  mocked provisioning services and Celery enqueue hooks.

Run the targeted suite:

```bash
poetry run pytest tests/tenant/test_provisioning_service.py \
                 tests/tenant/test_provisioning_router.py
```
