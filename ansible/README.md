# Tenant Provisioning Automation

This directory contains the Ansible control-plane assets invoked by the DotMac
platform when onboarding a new ISP tenant.

- `playbooks/provision_tenant.yml` – entry point that selects the appropriate
  role based on `deployment_mode` (`dotmac_hosted` or `customer_hosted`) and
  executes post-provision callbacks.
- `playbooks/decommission_tenant.yml` – removes tenant resources when a
  subscription is cancelled.
- `playbooks/upgrade_tenant.yml` – performs an in-place upgrade of tenant
  services (images, compose stack, etc.).

Roles are split by responsibility:

| Role | Purpose |
| ---- | ------- |
| `tenant_common` | Shared bootstrap actions (packages, workspace, metadata). |
| `tenant_dotmac_hosted` | Deploys the standard DotMac-managed stack (Docker/AWX). |
| `tenant_customer_hosted` | Configures a customer-supplied server and launches services. |
| `tenant_post_provision` | Calls back into the platform and records summary artifacts. |

Inventories under `inventories/` are placeholders for AWX job templates and can
be generated dynamically by the provisioning service using connection metadata
stored in the `tenant_provisioning_jobs` table.
