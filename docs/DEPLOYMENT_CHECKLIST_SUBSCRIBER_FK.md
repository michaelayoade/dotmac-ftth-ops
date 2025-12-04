# Deployment Checklist: Subscriber FK Migration

**Priority**: BLOCKER - Must follow exact sequence
**Estimated Time**: 15-20 minutes
**Risk**: HIGH if not done in order

---

## ⚠️ CRITICAL: Deployment Order

The code changes and database migration MUST be deployed in this exact order:

```
1. Run Database Migration  →  2. Run Backfill Script  →  3. Deploy Code Changes
```

**DO NOT deploy code before migration** - this will cause `ProgrammingError: column "subscriber_id" does not exist`

---

## Pre-Deployment Checklist

- [ ] **Backup database** (full backup recommended)
- [ ] **Schedule maintenance window** (15-20 minutes)
- [ ] **Verify no long-running transactions** on `plan_subscriptions` table
- [ ] **Test migration + backfill on staging** environment
- [ ] **Review ambiguous cases** from staging backfill
- [ ] **Notify operations team** of deployment window
- [ ] **Prepare rollback plan** (see below)

---

## Deployment Steps

### Step 1: Run Database Migration (5 seconds)

```bash
# Connect to production database server
ssh production-db-server

# Navigate to application directory
cd /path/to/dotmac-ftth-ops

# Activate virtual environment
source .venv/bin/activate

# Run migration
poetry run alembic upgrade head
```

**Expected Output**:
```
INFO  [alembic.runtime.migration] Running upgrade c64d9a16fa9d -> ee4f9c4fb5b3, add_subscriber_id_to_plan_subscriptions
INFO  [alembic.runtime.migration] Running upgrade ee4f9c4fb5b3, c6b208ba7659 -> fdf1b7f6bbe1, merge_subscriber_id_and_audit_columns
```

**Verification**:
```sql
-- Check column exists
SELECT column_name, is_nullable, data_type
FROM information_schema.columns
WHERE table_name = 'plan_subscriptions' AND column_name = 'subscriber_id';
-- Expected: subscriber_id | YES | character varying

-- Check FK constraint exists
SELECT constraint_name, constraint_type
FROM information_schema.table_constraints
WHERE table_name = 'plan_subscriptions' AND constraint_name = 'fk_plan_subscriptions_subscriber_id';
-- Expected: fk_plan_subscriptions_subscriber_id | FOREIGN KEY
```

**If Migration Fails**: See Rollback Plan below

---

### Step 2: Run Backfill Script (2-10 minutes)

```bash
# Dry run first to verify
poetry run python scripts/backfill_plan_subscription_subscriber_id.py --dry-run

# Review output, then commit
poetry run python scripts/backfill_plan_subscription_subscriber_id.py --commit
```

**Expected Output**:
```
✅ COMMIT MODE - Changes will be persisted

Are you sure you want to proceed? (yes/no): yes

[INFO] Starting backfill for plan_subscriptions.subscriber_id
[INFO] Found 1,234 subscriptions needing backfill
[INFO] Processing batch 1/13...
[WARNING] Subscription abc-123: Customer has 2 subscribers, using first active one
[INFO] Batch 1: 100 updated, 0 skipped, 0 errors
...
[SUCCESS] Backfill complete: 1,234 updated, 12 ambiguous (logged), 0 errors

Backfill Summary:
================
Total subscriptions checked: 1,234
Updated successfully:        1,234
Skipped (already set):       0
Skipped (no subscriber):     0
Ambiguous cases:             12
Errors:                      0

Success Rate: 100.0%
```

**Verification**:
```sql
-- Check all rows have subscriber_id
SELECT COUNT(*) FROM plan_subscriptions WHERE subscriber_id IS NULL;
-- Expected: 0 (or small number if some legitimately have no subscriber)

-- Check FK integrity
SELECT COUNT(*)
FROM plan_subscriptions ps
LEFT JOIN subscribers s ON ps.subscriber_id = s.id
WHERE ps.subscriber_id IS NOT NULL AND s.id IS NULL;
-- Expected: 0 (no orphaned FKs)
```

**If Backfill Has Errors**: Review `backfill_ambiguous_cases.log` and manually verify affected subscriptions

---

### Step 3: Deploy Code Changes

```bash
# Deploy application code (method depends on your deployment process)
git pull origin feature/bss-phase1-isp-enhancements
docker compose build api-server
docker compose up -d api-server celery-worker

# Or via CI/CD
git push origin feature/bss-phase1-isp-enhancements
# Wait for CI/CD pipeline to complete
```

**Files Changed**:
- `src/dotmac/platform/services/internet_plans/models.py` - Added `subscriber_id` FK
- `src/dotmac/platform/services/internet_plans/schemas.py` - Added `subscriber_id` required field
- `src/dotmac/platform/services/internet_plans/service.py` - Validate subscriber on creation
- `src/dotmac/platform/services/internet_plans/usage_billing_tasks.py` - Use FK for lookups
- `src/dotmac/platform/services/internet_plans/usage_monitoring_tasks.py` - Use FK for lookups
- `src/dotmac/platform/diagnostics/service.py` - Pass `subscriber_id` instead of username

---

### Step 4: Post-Deployment Verification

#### 4.1 Check Logs for Errors

```bash
# Check for subscriber_id_not_set warnings (should be zero)
grep "subscriber_id_not_set" /var/log/celery-worker.log
# Expected: No matches

# Check for ProgrammingError (column does not exist)
grep "ProgrammingError.*subscriber_id" /var/log/api-server.log
# Expected: No matches

# Check for ValueError (subscriber validation)
grep "Subscriber .* not found for customer" /var/log/api-server.log
# Expected: Only if invalid API requests
```

#### 4.2 Test Creating New Subscription

```bash
# Via API
curl -X POST https://api.production.com/api/v1/services/internet-plans/subscriptions \
  -H "Authorization: Bearer $PRODUCTION_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "plan_id": "plan-uuid-here",
    "customer_id": "customer-uuid-here",
    "subscriber_id": "subscriber-id-here",
    "start_date": "2025-10-29T00:00:00Z"
  }'

# Expected: 201 Created with subscription object
```

```sql
-- Verify subscriber_id was set
SELECT id, customer_id, subscriber_id, created_at
FROM plan_subscriptions
WHERE created_at > NOW() - INTERVAL '5 minutes'
ORDER BY created_at DESC
LIMIT 5;
-- Expected: All new subscriptions have subscriber_id populated
```

#### 4.3 Trigger Billing Task Manually

```bash
# Run billing task for small batch
poetry run celery -A dotmac.platform.celery_app call services.process_usage_billing --args='[10]'

# Check logs for success
tail -f /var/log/celery-worker.log | grep "usage_billing"
# Expected: "processed": 10, "skipped": 0, "failed": 0
```

#### 4.4 Trigger Monitoring Task Manually

```bash
# Run monitoring task for small batch
poetry run celery -A dotmac.platform.celery_app call services.monitor_data_cap_usage --args='[10]'

# Check logs for success
tail -f /var/log/celery-worker.log | grep "usage_monitoring"
# Expected: "processed": 10, "alerts_created": N (if any thresholds crossed)
```

---

## Rollback Plan

### Option 1: Revert Migration (Fast - Use if migration itself failed)

```bash
# Roll back database to previous revision
poetry run alembic downgrade c6b208ba7659

# This will:
# - Drop subscriber_id column
# - Drop FK constraint
# - Drop index
```

**After Rollback**:
- Code will still expect `subscriber_id` column → will crash
- Must also rollback code deployment to previous version

### Option 2: Revert Code Only (Safer - Use if code has issues)

```bash
# Revert code to previous version
git revert HEAD
git push origin feature/bss-phase1-isp-enhancements

# Or rollback deployment
docker compose pull api-server:previous-tag
docker compose up -d api-server celery-worker
```

**After Rollback**:
- Database still has `subscriber_id` column (harmless)
- Old code will use old logic (arbitrary `.first()` for multi-subscriber customers)
- Can debug issues and redeploy later

### Option 3: Fix Data Issues (Use if specific subscriptions broken)

```sql
-- If specific subscriptions have wrong subscriber_id
UPDATE plan_subscriptions
SET subscriber_id = (
    SELECT s.id
    FROM subscribers s
    WHERE s.customer_id = plan_subscriptions.customer_id
      AND s.deleted_at IS NULL
    ORDER BY s.created_at  -- Deterministic: oldest first
    LIMIT 1
)
WHERE id IN ('subscription-id-1', 'subscription-id-2');
```

---

## Success Criteria

After deployment, ALL of these must be true:

- [ ] Database migration applied successfully (`alembic current` shows `fdf1b7f6bbe1`)
- [ ] Backfill completed with 100% success (or only expected skips)
- [ ] Zero `"subscriber_id_not_set"` warnings in logs
- [ ] New subscriptions have `subscriber_id` populated
- [ ] Billing task runs without errors
- [ ] Monitoring task runs without errors
- [ ] No `ProgrammingError` in application logs
- [ ] All tests pass in production smoke tests

---

## Known Issues & Troubleshooting

### Issue: "ProgrammingError: column subscriber_id does not exist"

**Cause**: Code deployed before migration ran
**Fix**:
1. Immediately run Step 1 (migration)
2. Run Step 2 (backfill)
3. Restart application servers

### Issue: "ValueError: Subscriber X not found for customer Y"

**Cause**: API request provided invalid subscriber_id or subscriber doesn't belong to customer
**Fix**: This is expected behavior - validate API request payload

### Issue: Billing/Monitoring tasks showing "skipped": true

**Cause**: Backfill didn't populate subscriber_id for some rows
**Fix**:
```bash
# Re-run backfill
poetry run python scripts/backfill_plan_subscription_subscriber_id.py --commit
```

### Issue: Customer has multiple subscribers, wrong one chosen

**Cause**: Ambiguous case - customer has multiple services
**Fix**:
```sql
-- Review ambiguous cases
SELECT ps.id, ps.customer_id, ps.subscriber_id, s.username, s.service_type
FROM plan_subscriptions ps
JOIN subscribers s ON ps.subscriber_id = s.id
WHERE ps.customer_id IN (
    SELECT customer_id
    FROM plan_subscriptions
    GROUP BY customer_id
    HAVING COUNT(DISTINCT subscriber_id) > 1
);

-- Manually update if wrong
UPDATE plan_subscriptions
SET subscriber_id = 'correct-subscriber-id'
WHERE id = 'subscription-id';
```

---

## Timeline

| Step | Duration | Can Parallelize? |
|------|----------|------------------|
| 0. Pre-deployment checks | 5 min | No |
| 1. Run migration | 5 sec | No |
| 2. Run backfill | 2-10 min | No |
| 3. Deploy code | 3-5 min | Yes (if using blue/green) |
| 4. Post-deployment verification | 5 min | No |
| **Total** | **15-20 min** | |

---

## Communication Template

**Pre-Deployment Announcement** (30 minutes before):
```
🚨 MAINTENANCE WINDOW: 15-20 minutes starting at [TIME]

We will be deploying critical TimescaleDB integration fixes.

Expected impact:
- API may be briefly unavailable during deployment
- Billing/monitoring tasks will be paused

Timeline:
- [TIME]: Start maintenance
- [TIME+15]: End maintenance (expected)

We will notify when complete.
```

**Post-Deployment Announcement**:
```
✅ MAINTENANCE COMPLETE

TimescaleDB subscriber FK migration deployed successfully.

All systems operational:
- ✅ Database migration applied
- ✅ 1,234 subscriptions updated
- ✅ Billing/monitoring tasks running normally
- ✅ New subscriptions require subscriber_id

Please report any issues to #ops-alerts.
```

---

## Contact & Escalation

- **DBA Lead**: [Name] - [Contact]
- **Backend Lead**: [Name] - [Contact]
- **On-Call Engineer**: [Contact]
- **Escalation**: If tasks still showing `"skipped": true` 24h after deployment

---

## Related Documentation

- **Migration Guide**: `docs/PLAN_SUBSCRIPTION_SUBSCRIBER_FK_MIGRATION.md` (comprehensive technical details)
- **Bug Fixes Summary**: `docs/TIMESCALEDB_BUGS_FIXED_SUMMARY.md` (what was fixed)
- **TimescaleDB Integration**: `TIMESCALEDB_INTEGRATION.md` (architecture)
- **Backfill Script**: `scripts/backfill_plan_subscription_subscriber_id.py` (source code)
