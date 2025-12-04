# DotMac-Hosted Inventory

This inventory is referenced by the AWX job template that provisions tenants on
DotMac-managed infrastructure. The provisioning service can render a tenant-
specific inventory dynamically by substituting host groups, regions, or cluster
identifiers before kicking off the playbook.

In most deployments the inventory will be generated at runtime via the AWX API.
This file serves as a sample schema for operators and the provisioning code.
