# Network Feature Implementation Plan

**Scope:** Close the MVP gaps around DHCP Option 82/VLAN enforcement, IPv6 lifecycle management, and static IP assignment.
**References:** `docs/TODO_GAP_CLOSEOUT.md:17-24`, `src/dotmac/platform/netbox`, `src/dotmac/platform/network`, `src/dotmac/platform/radius`, `src/dotmac/platform/subscribers`, `src/dotmac/platform/access`.

---

## 1. DHCP Option 82 & VLAN Handling

### Objectives
1. Inspect DHCP relay/PPPoE metadata (Circuit-ID, Remote-ID) and bind subscribers to per-port VLANs.
2. Support VLAN pools, Q-in-Q tagging, and per-subscriber overrides that propagate through provisioning (OLT/ACS + RADIUS).

### Components
- **Database:** Extend subscriber/network models (`src/dotmac/platform/subscribers/models.py`, `src/dotmac/platform/network/models.py`) with circuit identifiers, VLAN IDs, and QinQ flags.
- **API/UI:** Add CRUD + validation endpoints/pages for VLAN pools and bindings.
- **Provisioning:** Update orchestration pipelines (`src/dotmac/platform/services/lifecycle/tasks.py`, `src/dotmac/platform/access/router.py`) to push VLAN info into NetBox and RADIUS attributes.
- **RADIUS:** Enhance request parsing to read Option 82 attributes and enforce VLAN assignments (`src/dotmac/platform/radius/server.py`, vendor builders).

### Phases
1. **Data Modeling:** migrations, Pydantic schemas, admin forms for VLAN pools/bindings.
2. **RADIUS Enforcement:** parse Option 82, look up subscriber→VLAN, inject `Tunnel-Private-Group-ID` / vendor VSAs, log mismatches.
3. **Provisioning Integration:** ensure OLT/ACS workflows receive VLAN/QinQ data and NetBox stays authoritative.
4. **Validation & Telemetry:** dashboards/alerts when Option 82 mismatch occurs, unit/e2e tests for VLAN assignment.

---

## 2. IPv6 Lifecycle Support

### Objectives
1. Manage dual-stack subscriber addressing (DHCPv6-PD, static IPv6, SLAAC).
2. Track IPv6 pools in NetBox and propagate assignments through provisioning and RADIUS/AAA.

### Components
- **IPAM:** Extend NetBox integration layer to request IPv6 prefixes/addresses (`src/dotmac/platform/netbox/service.py`).
- **Subscriber Models:** add IPv6 allocation metadata (prefix length, delegated prefixes, assigned addresses).
- **Provisioning Pipelines:** update VOLTHA/ACS provisioning inputs to include IPv6 CPE WAN parameters.
- **RADIUS/AAA:** ensure `Framed-IPv6-Prefix`, `Delegated-IPv6-Prefix`, and vendor-specific attributes are supported in builders and accounting logs.
- **UI/API:** expose IPv6 status in subscriber views and allow manual overrides.

### Phases
1. **IPAM Plumbing:** implement NetBox client methods for IPv6 pools/prefix delegation; add migrations and services to persist assignments.
2. **AAA Updates:** extend RADIUS schema/builders/tests to support IPv6 attributes and session accounting.
3. **Provisioning Integration:** pass IPv6 config into VOLTHA/GenieACS workflows + ACS templates.
4. **UX & Reporting:** show IPv6 allocations in ops dashboard, export data for auditing.

---

## 3. Static IP Assignment Workflow

### Objectives
1. Provide deterministic static IPv4/IPv6 assignment per subscriber/service plan.
2. Ensure allocations stay consistent across orchestration, NetBox, and RADIUS.

### Components
- **Allocation Service:** create a static IP assignment service that reserves addresses from NetBox pools and persists binding (`src/dotmac/platform/network/static_ip_service.py`).
- **API/UI:** admin tooling for assigning/releasing static IPs, viewing conflicts, and searching allocations.
- **Provisioning:** update lifecycle tasks to fetch static IP data and program RADIUS (Framed-IP-Address) plus device configs.
- **Auditing:** log assignment history and provide reports/export for compliance.

### Phases
1. **Service Layer:** build dedicated static IP manager with conflict detection, retries, and NetBox transaction support.
2. **Workflow Integration:** hook service into subscriber activation, suspend/terminate flows, and manual overrides.
3. **Surface in UI:** add static IP tab in subscriber/tenant portals with assignment status and actions.

---

## Sequencing & Dependencies
1. **Foundations:** Ship migrations + data models for VLAN/Option 82, IPv6 metadata, static IP bindings.
2. **IPAM/RADIUS Enhancements:** parallel efforts to update NetBox adapters and RADIUS vendor builders for new attributes.
3. **Provisioning Orchestration:** once data/RADIUS support is ready, wire into VOLTHA/ACS + lifecycle tasks.
4. **UX Hardening:** final pass for dashboards, forms, validations, and documentation updates.

Testing strategy should include unit tests for services, integration tests for NetBox/RADIUS flows, and staged lab validation with sample NAS/OLT gear.
