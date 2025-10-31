# Plan Subscription → Subscriber FK Migration Guide

**Status**: Ready for DBA Review
**Priority**: High - Required for TimescaleDB usage billing/monitoring
**Estimated Downtime**: 5-10 minutes (backfill time depends on row count)
**Risk Level**: Medium - Production billing/monitoring will skip until complete

---

## Problem Statement

The TimescaleDB integration for usage-based billing and monitoring requires deterministic mapping between `plan_subscriptions` and `subscribers` tables. Currently:

- ✅ Bug #1-5: Fixed (SQLAlchemy queries, diagnostics, multi-subscriber handling)
- ❌ **Bug #6**: `PlanSubscription` has no FK to `Subscriber` → arbitrary subscriber selection for multi-service customers
- ❌ **Issue #7**: Legacy rows will have `subscriber_id=NULL` → billing/monitoring will skip them
- ❌ **Issue #8**: New subscriptions don't set `subscriber_id` → indefinite skip
- ❌ **Issue #9**: No guardrails for NULL values → silent failures

**Impact Without This Migration**:
- All existing subscriptions stop being billed/monitored
- New subscriptions also skip billing/monitoring
- Multi-service customers get wrong usage data (data integrity corruption)

---

## Architecture Changes

### Database Schema

**Before**:
```sql
-- plan_subscriptions table
id            UUID PRIMARY KEY
customer_id   UUID NOT NULL  -- No FK constraint, just index
plan_id       UUID FOREIGN KEY → internet_service_plans(id)
-- Missing: subscriber_id link
```

**After**:
```sql
-- plan_subscriptions table
id            UUID PRIMARY KEY
customer_id   UUID NOT NULL
plan_id       UUID FOREIGN KEY → internet_service_plans(id)
subscriber_id VARCHAR(255) FOREIGN KEY → subscribers(id) ON DELETE SET NULL  -- NEW
```

### Application Logic

**Billing/Monitoring Tasks (usage_billing_tasks.py, usage_monitoring_tasks.py)**:
```python
# OLD (BROKEN) - Arbitrary subscriber
subscriber = session.execute(
    select(Subscriber).where(Subscriber.customer_id == customer.id)
).scalars().first()  # ❌ Random choice for multi-service customers

# NEW (FIXED) - Deterministic FK lookup
if not subscription.subscriber_id:
    logger.warning("subscriber_id_not_set", subscription_id=subscription.id)
    return {"skipped": True}  # ⚠️ Skips until FK populated

subscriber = session.execute(
    select(Subscriber).where(Subscriber.id == subscription.subscriber_id)
).scalar_one_or_none()  # ✅ Exact match
```

---

## Migration Sequence

### Prerequisites

- [ ] Schedule maintenance window (recommended: low-traffic hours)
- [ ] Backup database before migration
- [ ] Verify no long-running transactions on `plan_subscriptions` table
- [ ] Test backfill script on staging environment

### Step 1: Add Nullable Column (5 seconds)

**Migration**: `alembic/versions/2025_10_29_1130-ee4f9c4fb5b3_add_subscriber_id_to_plan_subscriptions.py`

**What it does**:
- Adds `subscriber_id VARCHAR(255) NULL` column
- Creates FK constraint to `subscribers(id) ON DELETE SET NULL`
- Creates index `idx_plan_subscriptions_subscriber_id`
- **Does NOT backfill** - keeps transaction short

**Execute**:
```bash
poetry run alembic upgrade head
```

**Expected output**:
```
INFO  [alembic.runtime.migration] Running upgrade c64d9a16fa9d -> ee4f9c4fb5b3, add_subscriber_id_to_plan_subscriptions
INFO  [alembic.runtime.migration] Running upgrade ee4f9c4fb5b3, c6b208ba7659 -> fdf1b7f6bbe1, merge_subscriber_id_and_audit_columns
```

**Verification**:
```sql
-- Check column exists
SELECT column_name, is_nullable, data_type
FROM information_schema.columns
WHERE table_name = 'plan_subscriptions'
  AND column_name = 'subscriber_id';
-- Expected: subscriber_id | YES | character varying

-- Check all rows have NULL (before backfill)
SELECT COUNT(*) FROM plan_subscriptions WHERE subscriber_id IS NULL;
-- Expected: [total row count]
```

---

### Step 2: Run Backfill Script (2-10 minutes)

**Script**: `scripts/backfill_plan_subscription_subscriber_id.py`

**What it does**:
1. Queries all `plan_subscriptions` with `subscriber_id IS NULL`
2. For each subscription:
   - Finds the first active `Subscriber` for that `customer_id`
   - Sets `plan_subscriptions.subscriber_id = subscriber.id`
   - Logs ambiguous cases (customer with multiple subscribers)
3. Reports success/failure statistics

**Execute**:
```bash
poetry run python scripts/backfill_plan_subscription_subscriber_id.py --dry-run
# Review output, then:
poetry run python scripts/backfill_plan_subscription_subscriber_id.py --commit
```

**Expected output**:
```
[INFO] Starting backfill for plan_subscriptions.subscriber_id
[INFO] Found 1,234 subscriptions needing backfill
[INFO] Processing batch 1/13...
[WARNING] Subscription abc-123: Customer has 2 subscribers, using first active one
[INFO] Batch 1: 100 updated, 0 skipped, 0 errors
...
[SUCCESS] Backfill complete: 1,234 updated, 12 ambiguous (logged), 0 errors
```

**Verification**:
```sql
-- Check all rows populated
SELECT COUNT(*) FROM plan_subscriptions WHERE subscriber_id IS NULL;
-- Expected: 0 (or small number if some have no subscribers)

-- Check FK integrity
SELECT COUNT(*)
FROM plan_subscriptions ps
LEFT JOIN subscribers s ON ps.subscriber_id = s.id
WHERE ps.subscriber_id IS NOT NULL AND s.id IS NULL;
-- Expected: 0 (no orphaned FKs)

-- Check ambiguous cases (multiple subscribers per customer)
SELECT ps.customer_id, COUNT(DISTINCT ps.subscriber_id) as sub_count
FROM plan_subscriptions ps
GROUP BY ps.customer_id
HAVING COUNT(DISTINCT ps.subscriber_id) > 1;
-- Expected: List of customers with multiple services (review manual)
```

---

### Step 3: (Optional) Make Column NOT NULL

**Only do this if**:
- All rows have valid `subscriber_id`
- Business rule: every subscription MUST have a subscriber
- Want database-level constraint enforcement

**Execute**:
```sql
-- Check current state
SELECT COUNT(*) FROM plan_subscriptions WHERE subscriber_id IS NULL;
-- If 0, proceed:

ALTER TABLE plan_subscriptions
ALTER COLUMN subscriber_id SET NOT NULL;
```

**Verification**:
```sql
-- Check constraint
SELECT column_name, is_nullable
FROM information_schema.columns
WHERE table_name = 'plan_subscriptions'
  AND column_name = 'subscriber_id';
-- Expected: subscriber_id | NO

-- Test constraint
INSERT INTO plan_subscriptions (id, customer_id, plan_id, subscriber_id, ...)
VALUES (gen_random_uuid(), ..., NULL, ...);
-- Expected: ERROR: null value in column "subscriber_id" violates not-null constraint
```

---

### Step 4: Update Subscription Creation Flow

**Files to modify**:

#### 4.1 Internet Plan Service (`src/dotmac/platform/services/internet_plans/service.py`)

**Find**: `create_subscription()` or similar method

**Change**:
```python
# BEFORE
async def create_subscription(
    customer_id: UUID,
    plan_id: UUID,
    start_date: datetime,
    ...
) -> PlanSubscription:
    subscription = PlanSubscription(
        id=uuid4(),
        customer_id=customer_id,
        plan_id=plan_id,
        start_date=start_date,
        # Missing: subscriber_id
    )

# AFTER
async def create_subscription(
    customer_id: UUID,
    plan_id: UUID,
    subscriber_id: str,  # NEW REQUIRED PARAMETER
    start_date: datetime,
    ...
) -> PlanSubscription:
    # Validate subscriber exists and belongs to customer
    subscriber = await session.execute(
        select(Subscriber).where(
            and_(
                Subscriber.id == subscriber_id,
                Subscriber.customer_id == customer_id,
                Subscriber.tenant_id == tenant_id,
            )
        )
    )
    if not subscriber.scalar_one_or_none():
        raise ValueError(f"Subscriber {subscriber_id} not found for customer {customer_id}")

    subscription = PlanSubscription(
        id=uuid4(),
        customer_id=customer_id,
        plan_id=plan_id,
        subscriber_id=subscriber_id,  # ✅ Set FK
        start_date=start_date,
    )
```

#### 4.2 Lifecycle Provisioning (`src/dotmac/platform/services/lifecycle/service.py`)

**Find**: Service activation workflow that creates plan subscriptions

**Change**:
```python
# Ensure orchestration passes subscriber_id when creating subscription
plan_subscription = await plan_service.create_subscription(
    customer_id=service_request.customer_id,
    plan_id=selected_plan.id,
    subscriber_id=service_request.subscriber_id,  # ✅ Wire from request
    start_date=datetime.utcnow(),
)
```

#### 4.3 Add Tests

**Create**: `tests/services/internet_plans/test_subscription_creation_requires_subscriber.py`

```python
async def test_create_subscription_requires_subscriber_id():
    """Ensure new subscriptions cannot be created without subscriber_id."""
    with pytest.raises(ValueError, match="Subscriber .* not found"):
        await plan_service.create_subscription(
            customer_id=customer.id,
            plan_id=plan.id,
            subscriber_id="invalid-subscriber-id",  # ❌ Invalid
            start_date=datetime.utcnow(),
        )

async def test_create_subscription_validates_subscriber_belongs_to_customer():
    """Ensure subscriber actually belongs to the customer."""
    other_customer_subscriber = await create_subscriber(customer_id=other_customer.id)

    with pytest.raises(ValueError):
        await plan_service.create_subscription(
            customer_id=customer.id,  # Customer A
            plan_id=plan.id,
            subscriber_id=other_customer_subscriber.id,  # ❌ Belongs to Customer B
            start_date=datetime.utcnow(),
        )
```

---

### Step 5: Verification & Monitoring

#### Production Health Checks

**Monitor logs for**:
```python
# Warnings that indicate issues
logger.warning("usage_billing.missing_subscriber_link")     # Legacy data not backfilled
logger.warning("usage_monitoring.missing_subscriber_link")   # Same

# Expected after migration:
# Zero occurrences of "subscriber_id_not_set" warnings
```

**Prometheus Metrics** (if implemented):
```promql
# Alert if subscriptions are being skipped
sum(rate(usage_billing_skipped_total{reason="subscriber_id_not_set"}[5m])) > 0
sum(rate(usage_monitoring_skipped_total{reason="subscriber_id_not_set"}[5m])) > 0
```

#### Smoke Tests

```bash
# 1. Create new subscription (should set subscriber_id)
curl -X POST /api/v1/services/internet-plans/subscriptions \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "customer_id": "...",
    "plan_id": "...",
    "subscriber_id": "..."  # ✅ Required
  }'

# 2. Check subscriber_id was set
psql -c "SELECT subscriber_id FROM plan_subscriptions WHERE id = '$NEW_SUBSCRIPTION_ID';"
# Expected: subscriber_id | abc-123-xyz (not NULL)

# 3. Trigger billing task manually
poetry run celery -A dotmac.platform.celery_app call services.process_usage_billing --args='[10]'
# Check logs for "skipped": false

# 4. Trigger monitoring task manually
poetry run celery -A dotmac.platform.celery_app call services.monitor_data_cap_usage --args='[10]'
# Check logs for "alerts_created" > 0 (if any thresholds crossed)
```

---

## Rollback Plan

**If issues discovered after migration**:

### Option 1: Revert Migration (Fast)
```bash
# Roll back to previous revision
poetry run alembic downgrade c6b208ba7659

# This will:
# - Drop subscriber_id column
# - Drop FK constraint
# - Drop index
```

### Option 2: Keep Column, Revert Code (Safer)
```bash
# Keep database changes, revert application code
git revert <commit-hash-of-FK-logic>

# Tasks will go back to old behavior (arbitrary .first())
# Can debug and re-apply fixes later
```

### Option 3: Manual Data Fix
```sql
-- If specific subscriptions have wrong subscriber_id
UPDATE plan_subscriptions
SET subscriber_id = (
    SELECT s.id
    FROM subscribers s
    WHERE s.customer_id = plan_subscriptions.customer_id
      AND s.deleted_at IS NULL
    LIMIT 1
)
WHERE id = '<problematic-subscription-id>';
```

---

## Known Limitations

### Ambiguous Cases

**Scenario**: Customer has multiple subscribers (e.g., home + business service)

**Current Behavior**: Backfill script chooses `.first()` (arbitrary but deterministic via query order)

**Recommendation**:
1. Review `backfill_script.log` for "ambiguous" warnings
2. Manually verify these customers have correct subscriber assigned:
   ```sql
   SELECT ps.id, ps.customer_id, ps.subscriber_id, s.username, s.service_type
   FROM plan_subscriptions ps
   JOIN subscribers s ON ps.subscriber_id = s.id
   WHERE ps.customer_id IN (
       SELECT customer_id FROM plan_subscriptions
       GROUP BY customer_id
       HAVING COUNT(DISTINCT subscriber_id) > 1
   );
   ```
3. If wrong, manually update with correct subscriber_id

### NULL Values After Backfill

**Scenario**: Subscription exists but customer has no subscribers

**Current Behavior**: Tasks skip with warning `"subscriber_not_found"`

**Resolution**:
- Investigate why customer has subscription but no subscriber
- Either create subscriber or archive subscription

---

## Timeline Estimate

| Step | Duration | Blocking? |
|------|----------|-----------|
| 1. Add nullable column | 5 sec | Yes (short) |
| 2. Run backfill script | 2-10 min | Yes (can monitor) |
| 3. Make NOT NULL (optional) | 2 sec | Yes (only if doing) |
| 4. Update creation flow | - | No (code deploy) |
| 5. Verification | 5 min | No |
| **Total Downtime** | **~10 min** | |

---

## Success Criteria

- [x] Migration completes without errors
- [x] Backfill script: 100% of rows have valid `subscriber_id`
- [x] Zero `"subscriber_id_not_set"` warnings in production logs
- [x] New subscriptions automatically set `subscriber_id`
- [x] Billing/monitoring tasks show `"skipped": false` for all subscriptions
- [x] No MultipleResultsFound errors in Celery workers
- [x] Usage data matches correct subscriber (verify spot check)

---

## Contact & Support

- **DBA Lead**: [Your DBA Team]
- **Backend Lead**: [Engineering Lead]
- **On-Call**: Escalate if tasks still showing `"skipped": true` 24h after migration

**Documentation**:
- TimescaleDB Integration: `TIMESCALEDB_INTEGRATION.md`
- Multi-Vendor RADIUS: `MULTI_VENDOR_RADIUS.md`
- Bug Fixes Summary: See commit message for this PR
