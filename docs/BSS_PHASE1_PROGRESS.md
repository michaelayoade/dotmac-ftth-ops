# BSS Phase 1 Implementation Progress

**Branch:** `feature/bss-phase1-isp-enhancements`
**Date:** 2025-10-14
**Status:** In Progress

## Overview

This document tracks the implementation progress of BSS Phase 1 features for ISP operations.

---

## ✅ Completed Tasks

### 1. ISP-Specific Customer Fields ✅ COMPLETE
**Status:** 100% Complete
**Files Modified:**
- `src/dotmac/platform/customer_management/models.py`
- `src/dotmac/platform/customer_management/schemas.py`
- `alembic/versions/2025_10_14_1200-d3f4e8a1b2c5_add_isp_specific_customer_fields.py` (NEW)

**Changes Made:**

#### Customer Model Enhancements
Added 26 new ISP-specific fields to the `Customer` model:

**Service Address Fields (7 fields):**
- `service_address_line1` - Installation/service address
- `service_address_line2`
- `service_city`
- `service_state_province`
- `service_postal_code`
- `service_country` - ISO 3166-1 alpha-2
- `service_coordinates` - JSON: {lat, lon}

**Installation Tracking (5 fields):**
- `installation_status` - pending/scheduled/in_progress/completed/failed/canceled
- `installation_date` - Actual completion date
- `scheduled_installation_date` - Scheduled date
- `installation_technician_id` - FK to users table
- `installation_notes` - Text field

**Service Details (3 fields):**
- `connection_type` - ftth/wireless/dsl/cable/fiber/hybrid
- `last_mile_technology` - gpon/xgs-pon/docsis3.1/lte/5g
- `service_plan_speed` - e.g., "100/100 Mbps"

**Network Assignments (4 fields):**
- `assigned_devices` - JSON: {onu_serial, cpe_mac, router_id}
- `current_bandwidth_profile` - QoS profile
- `static_ip_assigned` - IPv4 address
- `ipv6_prefix` - IPv6 prefix

**Service Quality Metrics (4 fields):**
- `avg_uptime_percent` - Numeric(5,2)
- `last_outage_date` - DateTime
- `total_outages` - Integer counter
- `total_downtime_minutes` - Integer counter

**Indexes Created:**
- `ix_customer_service_location` - Composite: country, state, city
- `ix_customer_installation_status` - tenant_id + installation_status
- `ix_customer_connection_type` - tenant_id + connection_type

**Foreign Keys:**
- `fk_customers_installation_technician` - users.id with SET NULL

#### Schema Updates
Created new schemas:
- `ISPServiceInfo` - Dedicated schema for ISP service fields
- Extended `CustomerCreate` with all ISP fields
- Extended `CustomerUpdate` with all ISP fields
- Extended `CustomerResponse` with all ISP fields
- Extended `CustomerSearchParams` with ISP filters:
  - `installation_status`
  - `connection_type`
  - `service_city`, `service_state_province`, `service_country`

#### Database Migration
Created full upgrade/downgrade migration:
- File: `2025_10_14_1200-d3f4e8a1b2c5_add_isp_specific_customer_fields.py`
- Adds all 26 columns with appropriate constraints
- Creates indexes for performance
- Includes complete downgrade path

**Testing Required:**
- [ ] Run migration: `alembic upgrade head`
- [ ] Test customer creation with ISP fields
- [ ] Test customer updates with ISP fields
- [ ] Test search/filter by ISP fields
- [ ] Verify index performance

---

### 2. Dunning & Collections Management 🟡 MODELS COMPLETE
**Status:** 40% Complete (Models + Schemas Done)
**Files Created:**
- `src/dotmac/platform/billing/dunning/__init__.py` (NEW)
- `src/dotmac/platform/billing/dunning/models.py` (NEW)
- `src/dotmac/platform/billing/dunning/schemas.py` (NEW)

**Changes Made:**

#### Models Created

**DunningCampaign Model:**
- Campaign configuration for automated collection workflows
- Fields:
  - `name`, `description`
  - `trigger_after_days` - Days past due before triggering
  - `max_retries`, `retry_interval_days`
  - `actions` - JSON array of action sequence
  - `exclusion_rules` - JSON rules for exclusions
  - `is_active`, `priority`
  - Statistics: `total_executions`, `successful_executions`, `total_recovered_amount`
- Indexes:
  - `ix_dunning_campaigns_tenant_active`
  - `ix_dunning_campaigns_tenant_priority`

**DunningExecution Model:**
- Individual campaign execution for a subscription
- Fields:
  - References: `campaign_id`, `subscription_id`, `customer_id`, `invoice_id`
  - Status tracking: `status`, `current_step`, `total_steps`, `retry_count`
  - Timing: `started_at`, `next_action_at`, `completed_at`
  - Amounts: `outstanding_amount`, `recovered_amount` (in cents)
  - `execution_log` - JSON array of action results
  - Cancellation: `canceled_reason`, `canceled_by_user_id`
- Indexes:
  - `ix_dunning_executions_tenant_status`
  - `ix_dunning_executions_next_action` - for scheduled processing
  - `ix_dunning_executions_subscription`

**DunningActionLog Model:**
- Detailed audit log of each action executed
- Fields:
  - `execution_id`, `action_type`, `action_config`
  - `step_number`, `executed_at`, `status`
  - `result` - JSON execution details
  - `error_message`, `external_id`
- Indexes:
  - `ix_dunning_action_logs_execution`
  - `ix_dunning_action_logs_action_type`

**Enums:**
- `DunningActionType`: EMAIL, SMS, SUSPEND_SERVICE, TERMINATE_SERVICE, WEBHOOK, CUSTOM
- `DunningExecutionStatus`: PENDING, IN_PROGRESS, COMPLETED, FAILED, CANCELED

#### Schemas Created
- `DunningActionConfig` - Action configuration
- `DunningExclusionRules` - Exclusion rules
- `DunningCampaignCreate/Update/Response`
- `DunningExecutionResponse`, `DunningExecutionListResponse`
- `DunningCancelRequest`
- `DunningActionLogResponse`
- `DunningStats` - Analytics schema

**Still TODO:**
- [ ] Create dunning service layer (`service.py`)
- [ ] Create dunning API router (`router.py`)
- [ ] Create dunning Celery tasks (`tasks.py`)
- [ ] Integration with billing module
- [ ] Integration with communications module
- [ ] Integration with service lifecycle (suspension)
- [ ] Create database migration for dunning tables
- [ ] Write unit tests
- [ ] Write integration tests

---

## 🚧 In Progress / Pending Tasks

### 3. Enhanced Ticketing for ISP ⏳ PENDING
**Status:** 0% Complete
**Estimated Effort:** 2 days

**Required Changes:**
- Extend `Ticket` model with ISP fields:
  - `ticket_type` enum (installation_request, outage_report, speed_issue, etc.)
  - `service_address`
  - `affected_services` JSON array
  - `device_serial_numbers` JSON array
  - `sla_due_date`, `sla_breached`
  - `first_response_at`, `resolution_time_minutes`
- Update schemas
- Update router with ISP ticket endpoints
- Create database migration

### 4. Usage Billing Enhancements ⏳ PENDING
**Status:** 0% Complete
**Estimated Effort:** 3 days

**Required Changes:**
- Create new models:
  - `UsageRecord` - Granular usage tracking
  - `UsageAggregation` - Aggregated usage for billing
- Create usage billing service
- Create API endpoints
- Integration with RADIUS accounting (future)
- Create database migration
- Write tests

---

## Integration Points

### Completed Integrations:
None yet (models only)

### Pending Integrations:
1. **Dunning → Billing**: Query overdue subscriptions
2. **Dunning → Communications**: Send email/SMS notifications
3. **Dunning → Service Lifecycle**: Suspend/terminate services
4. **Dunning → Customer Management**: Access customer data
5. **Usage Billing → RADIUS**: Sync usage from radacct table
6. **Enhanced Ticketing → Customer Management**: Link tickets to customers

---

## Database Migrations

### Created:
1. ✅ `2025_10_14_1200-d3f4e8a1b2c5_add_isp_specific_customer_fields.py`

### Pending:
2. ⏳ `add_dunning_tables.py` - Dunning campaign, execution, action log
3. ⏳ `add_enhanced_ticketing_fields.py` - ISP ticket fields
4. ⏳ `add_usage_billing_tables.py` - Usage records and aggregations

---

## Testing Status

### Unit Tests:
- [ ] Customer model with ISP fields
- [ ] Customer schemas validation
- [ ] Dunning campaign creation
- [ ] Dunning execution workflow
- [ ] Dunning action execution

### Integration Tests:
- [ ] Customer CRUD with ISP fields
- [ ] Customer search by ISP fields
- [ ] Dunning campaign end-to-end
- [ ] Dunning payment received (cancel workflow)

### E2E Tests:
- [ ] New ISP subscriber onboarding flow
- [ ] Past-due account dunning workflow

---

## Next Steps (Priority Order)

### Immediate (Today):
1. ✅ Commit current progress
2. Create dunning service layer
3. Create dunning router
4. Create dunning Celery tasks
5. Create dunning database migration
6. Test dunning workflow

### Tomorrow:
1. Enhanced ticketing implementation
2. Usage billing implementation
3. Integration testing
4. Documentation updates

### This Week:
1. Complete Phase 1 features
2. Run full test suite
3. Update API documentation
4. Code review
5. Merge to main

---

## Breaking Changes

None - All changes are additive (new fields, new tables, new endpoints).
Existing functionality remains unchanged.

---

## Performance Considerations

### Indexes Added:
- Customer service location composite index
- Customer installation status
- Customer connection type
- Dunning execution next_action_at (for scheduled job queries)

### Potential Performance Impacts:
- Customer table increased by 26 columns (nullable, minimal impact)
- New queries on service location may benefit from additional GiST index for coordinates

---

## Documentation Updates Required

- [ ] Update API documentation with new customer fields
- [ ] Document dunning campaign configuration
- [ ] Document dunning action types and templates
- [ ] Update ERD diagram
- [ ] Update architecture document with dunning flow

---

## Questions / Decisions Needed

1. **Dunning Templates**: Where should email/SMS templates be stored?
   - Option A: In communications module (recommended)
   - Option B: Separate dunning_templates table

2. **RADIUS Integration**: Should usage billing be Phase 1 or deferred?
   - Currently: Phase 1 (pending)
   - Recommendation: Keep in Phase 1 for completeness

3. **Service Suspension**: Should dunning directly call service lifecycle or emit events?
   - Recommendation: Use events for loose coupling

---

**Last Updated:** 2025-10-14
**Next Review:** After dunning service implementation
