# Mock Reduction Migration Guide

**Date:** 2025-10-30
**Baseline:** 7,670 mock lines
**Target:** <3,000 mock lines (60% reduction)
**Timeline:** 2-3 weeks

---

## Table of Contents

1. [Current State](#current-state)
2. [Phase 1: Quick Wins (Week 1)](#phase-1-quick-wins-week-1)
3. [Phase 2: Database Refactoring (Week 2)](#phase-2-database-refactoring-week-2)
4. [Phase 3: Service Refactoring (Week 3)](#phase-3-service-refactoring-week-3)
5. [Verification](#verification)
6. [Rollback Plan](#rollback-plan)

---

## Current State

### Baseline Metrics (2025-10-30)

```bash
./scripts/count_mocks.sh
```

**Results:**
- **Total Mock Lines:** 7,670
- **Auth Mocks:** 69 (target: 0)
- **Database Mocks:** 2,592 (target: <50)
- **Service Mocks:** 2,762 (target: <500)

**Top Modules by Mock Usage:**
1. **billing** - 1,581 lines (20.6%)
2. **auth** - 359 lines (4.7%)
3. **secrets** - 247 lines (3.2%)
4. **workflows** - 237 lines (3.1%)
5. **tenant** - 234 lines (3.0%)

### Infrastructure Ready

✅ **Mock tracking script:** `scripts/count_mocks.sh`
✅ **Fake implementations:** `tests/helpers/fakes.py`
✅ **Fake fixtures:** Available in `tests/conftest.py`
✅ **Documentation:**
  - `/docs/MOCK_REDUCTION_EXAMPLES.md`
  - `/docs/FAKES_GUIDE.md`
  - This migration guide

---

## Phase 1: Quick Wins (Week 1)

**Goal:** Reduce by 500-1,000 mock lines
**Target:** 7,000-7,200 mock lines
**Effort:** Low
**Risk:** Low

### Day 1-2: Auth Mock Cleanup

**Current:** 69 auth mocks
**Target:** 30 auth mocks
**Strategy:** Remove redundant auth mocking in tests using `test_app` fixture

#### Files to Check (16 files identified)

```bash
# Find files with auth mocking
grep -r "patch.*get_current_user\|patch.*get_current_tenant_id" tests/ --include="*.py" -l
```

**Review Each File:**
1. If using `test_app` or `authenticated_client` fixture → Remove auth mocking
2. If using custom test app → May be legitimate, review case-by-case
3. If testing auth functionality → Keep mocking

**Example Fix:**

```python
# BEFORE
from unittest.mock import patch

async def test_endpoint(test_client):
    with patch("dotmac.platform.auth.dependencies.get_current_user"):
        response = await test_client.get("/api/v1/resource")
    ...

# AFTER
async def test_endpoint(authenticated_client):
    # Auth already provided by fixture!
    response = await authenticated_client.get("/api/v1/resource")
    ...
```

**Action Items:**
```bash
# 1. Review each file
for file in $(grep -r "patch.*get_current" tests/ --include="*.py" -l); do
    echo "Review: $file"
    # Open in editor and assess
done

# 2. Track progress
./scripts/count_mocks.sh | grep "Auth mocking"
```

### Day 3-5: Replace Simple Mock Objects

**Strategy:** Replace MagicMock for simple value objects with real objects

#### Find Candidates

```bash
# Find tests mocking simple objects
grep -r "MagicMock()\|Mock()" tests/billing/ --include="*.py" -A 3 | less
```

**Example Fix:**

```python
# BEFORE
mock_customer = MagicMock()
mock_customer.id = "cust_123"
mock_customer.email = "test@example.com"

# AFTER
from dotmac.platform.customer_management.models import Customer
customer = Customer(
    id="cust_123",
    email="test@example.com",
    tenant_id="tenant_123",
    first_name="Test",
    last_name="User"
)
```

**Action Items:**
```bash
# 1. Start with billing module (highest impact)
cd tests/billing/
git checkout -b refactor/billing-mock-reduction

# 2. Pick 2-3 small test files
# 3. Replace simple mocks with real objects
# 4. Run tests
pytest tests/billing/test_currency_rate_service.py -v

# 5. Commit progress
git add tests/billing/test_currency_rate_service.py
git commit -m "test(billing): Replace MagicMock with real objects in currency tests"
```

**Expected Reduction:** ~200-400 lines

---

## Phase 2: Database Refactoring (Week 2)

**Goal:** Reduce by 2,000-2,500 mock lines
**Target:** ~5,000 mock lines
**Effort:** Medium
**Risk:** Medium

### Overview

**Current:** 2,592 database mock lines
**Target:** <500 database mock lines
**Strategy:** Replace all database mocks with real database using existing fixtures

### Priority Modules

| Module | DB Mock Lines | Priority | Effort |
|--------|---------------|----------|--------|
| billing | ~800 | High | 3 days |
| services | ~400 | High | 2 days |
| customer_management | ~350 | Medium | 2 days |
| workflows | ~300 | High | 1 day |
| tenant | ~250 | Medium | 1 day |

### Step-by-Step Process

#### 1. Identify Database-Mocking Tests

```bash
# Find files mocking database sessions
grep -r "mock.*session\|AsyncMock.*execute\|mock_db" tests/billing/ --include="*.py" -l > db_mock_files.txt

# Review files
cat db_mock_files.txt
```

#### 2. Refactor One Module at a Time

**Example: `tests/billing/payments/test_payment_helpers_service.py`**

**Before:**
```python
@pytest.fixture
def mock_payment_db_session():
    session = AsyncMock()
    return session

async def test_get_payment(payment_service, mock_payment_db_session):
    mock_payment_db_session.execute.return_value.scalar.return_value = sample_payment
    result = await payment_service.get_payment("pay_123")
    assert result == sample_payment
```

**After:**
```python
@pytest_asyncio.fixture
async def payment_factory(async_db_session, tenant_id):
    """Factory for creating real payments in database."""
    created_payments = []

    async def _create(payment_id="pay_123", **kwargs):
        payment = PaymentEntity(
            id=payment_id,
            tenant_id=tenant_id,
            amount=Decimal("100.00"),
            **kwargs
        )
        async_db_session.add(payment)
        await async_db_session.commit()
        await async_db_session.refresh(payment)
        created_payments.append(payment)
        return payment

    yield _create

    # Cleanup
    for payment in created_payments:
        await async_db_session.delete(payment)
    await async_db_session.commit()

async def test_get_payment(payment_service, payment_factory):
    # Create real payment in database
    payment = await payment_factory(payment_id="pay_123")

    # Query real database
    result = await payment_service.get_payment("pay_123")

    # Verify real object
    assert result.id == "pay_123"
    assert result.amount == Decimal("100.00")
```

#### 3. Create Reusable Factories

**Create: `tests/billing/factories.py`**

```python
"""
Reusable test data factories for billing tests.
"""

import pytest_asyncio
from decimal import Decimal
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.billing.core.entities import (
    PaymentEntity,
    InvoiceEntity,
    SubscriptionEntity,
)


@pytest_asyncio.fixture
async def payment_factory(async_db_session: AsyncSession, tenant_id: str):
    """Factory for creating test payments."""
    created = []

    async def _create(payment_id: str = None, **kwargs):
        payment = PaymentEntity(
            id=payment_id or f"pay_{len(created)}",
            tenant_id=tenant_id,
            amount=kwargs.pop("amount", Decimal("100.00")),
            currency=kwargs.pop("currency", "USD"),
            **kwargs
        )
        async_db_session.add(payment)
        await async_db_session.commit()
        await async_db_session.refresh(payment)
        created.append(payment)
        return payment

    yield _create

    for item in created:
        await async_db_session.delete(item)
    await async_db_session.commit()


@pytest_asyncio.fixture
async def invoice_factory(async_db_session: AsyncSession, tenant_id: str):
    """Factory for creating test invoices."""
    created = []

    async def _create(invoice_id: str = None, **kwargs):
        invoice = InvoiceEntity(
            id=invoice_id or f"inv_{len(created)}",
            tenant_id=tenant_id,
            customer_id=kwargs.pop("customer_id", "cust_123"),
            amount=kwargs.pop("amount", Decimal("100.00")),
            **kwargs
        )
        async_db_session.add(invoice)
        await async_db_session.commit()
        await async_db_session.refresh(invoice)
        created.append(invoice)
        return invoice

    yield _create

    for item in created:
        await async_db_session.delete(item)
    await async_db_session.commit()


@pytest_asyncio.fixture
async def subscription_factory(async_db_session: AsyncSession, tenant_id: str):
    """Factory for creating test subscriptions."""
    created = []

    async def _create(subscription_id: str = None, **kwargs):
        subscription = SubscriptionEntity(
            id=subscription_id or f"sub_{len(created)}",
            tenant_id=tenant_id,
            customer_id=kwargs.pop("customer_id", "cust_123"),
            plan_id=kwargs.pop("plan_id", "plan_basic"),
            **kwargs
        )
        async_db_session.add(subscription)
        await async_db_session.commit()
        await async_db_session.refresh(subscription)
        created.append(subscription)
        return subscription

    yield _create

    for item in created:
        await async_db_session.delete(item)
    await async_db_session.commit()
```

#### 4. Update Tests to Use Factories

**Pattern:**
```python
# Import factories in conftest.py
pytest_plugins = [
    "tests.billing.factories",  # Add this
]

# Use in tests
async def test_payment_flow(
    payment_service,
    payment_factory,
    invoice_factory,
    customer_factory
):
    # Create real test data
    customer = await customer_factory()
    invoice = await invoice_factory(customer_id=customer.id)

    # Test with real database
    payment = await payment_service.create_payment(
        invoice_id=invoice.id,
        amount=invoice.amount
    )

    # Verify real database state
    assert payment.invoice_id == invoice.id
    assert payment.status == "success"
```

#### 5. Action Items

```bash
# Day 1-3: Billing module
cd tests/billing/

# Create factories
touch factories.py
# Implement payment_factory, invoice_factory, subscription_factory

# Refactor test files (start with smallest)
pytest tests/billing/test_currency_rate_service.py -v
pytest tests/billing/test_pdf_generator_basic.py -v

# Track progress
../scripts/count_mocks.sh | grep "Database mocking"

# Day 4-5: Services module
cd tests/services/

# Similar process...

# Day 6-7: Other high-priority modules
```

**Expected Reduction:** ~2,000-2,500 lines

---

## Phase 3: Service Refactoring (Week 3)

**Goal:** Reduce by 1,500-2,000 mock lines
**Target:** <3,000 mock lines
**Effort:** High
**Risk:** Medium

### Overview

**Current:** 2,762 service mock lines
**Target:** <500 service mock lines
**Strategy:** Replace internal service mocks with real services + external fakes

### Pattern: Stop Mocking Your Own Services

```python
# ❌ BEFORE - Mocking internal services
mock_invoice_service = AsyncMock()
mock_invoice_service.create_invoice.return_value = {"id": "inv_123"}

mock_payment_service = AsyncMock()
mock_payment_service.process_payment.return_value = {"status": "success"}

workflow = BillingWorkflow(
    invoice_service=mock_invoice_service,
    payment_service=mock_payment_service
)

# ✅ AFTER - Real services + fake gateway
invoice_service = InvoiceService(async_db_session)
payment_service = PaymentService(async_db_session, payment_gateway_fake)

workflow = BillingWorkflow(
    invoice_service=invoice_service,
    payment_service=payment_service
)
```

### Priority Modules

| Module | Service Mock Lines | Focus |
|--------|--------------------|-------|
| billing | ~1,000 | Workflows, integrations |
| workflows | ~400 | Orchestration |
| customer_management | ~350 | Service integrations |
| orchestration | ~250 | Multi-service workflows |

### Step-by-Step Process

#### 1. Identify Service-Mocking Tests

```bash
# Find files mocking services
grep -r "mock.*service\|mock.*Service\|AsyncMock.*Service" tests/billing/ --include="*.py" -l > service_mock_files.txt
```

#### 2. Categorize Mocked Services

For each test, identify mocked services:
- **Internal services** (your code) → Replace with real services
- **External services** (payment, email, SMS) → Use fakes from `tests/helpers/fakes.py`
- **Third-party libraries** → Consider if mock is needed

#### 3. Refactor Integration Tests

**Example: `tests/billing/test_billing_workflow.py`**

```python
# BEFORE
async def test_billing_workflow():
    mock_invoice_svc = AsyncMock()
    mock_payment_svc = AsyncMock()
    # ... 50 lines of mock configuration ...
    workflow = BillingWorkflow(mock_invoice_svc, mock_payment_svc)
    result = await workflow.execute()
    # ... verify mock calls ...

# AFTER
async def test_billing_workflow(
    async_db_session,
    customer_factory,
    payment_gateway_fake  # Only external service is faked
):
    # Real services with real database
    customer = await customer_factory()

    invoice_service = InvoiceService(async_db_session)
    payment_service = PaymentService(async_db_session, payment_gateway_fake)
    workflow = BillingWorkflow(invoice_service, payment_service)

    # Execute with real services
    result = await workflow.bill_customer(customer.id, Decimal("100.00"))

    # Verify real database state
    invoice = await invoice_service.get_latest_invoice(customer.id)
    assert invoice.amount == Decimal("100.00")
    assert invoice.status == "paid"

    # Verify external service call
    charges = payment_gateway_fake.get_charges()
    assert len(charges) == 1
```

#### 4. Create Missing Fakes

If a fake doesn't exist yet, create it:

```bash
# 1. Add to tests/helpers/fakes.py
# 2. Add fixture to tests/conftest.py
# 3. Use in tests
```

**Example: NetBox Fake**

```python
# tests/helpers/fakes.py
class FakeNetBoxClient:
    """Fake NetBox API client"""
    def __init__(self):
        self.devices = {}

    async def create_device(self, name, **kwargs):
        device_id = f"dev_{len(self.devices)}"
        device = {"id": device_id, "name": name, **kwargs}
        self.devices[device_id] = device
        return device

    # ... more methods ...

# tests/conftest.py
@pytest.fixture
def netbox_client_fake():
    return FakeNetBoxClient()
```

#### 5. Action Items

```bash
# Day 1-2: Billing workflows
cd tests/billing/
git checkout -b refactor/billing-service-reduction

# Identify workflow tests
grep -r "BillingWorkflow\|SubscriptionWorkflow" tests/billing/ -l

# Refactor each workflow test
# Replace internal service mocks with real services
# Use payment_gateway_fake for external services

# Day 3-4: Customer management
cd tests/customer_management/
# Similar process...

# Day 5: Workflows module
cd tests/workflows/
# Refactor orchestration tests

# Track progress
./scripts/count_mocks.sh | grep "Service mocking"
```

**Expected Reduction:** ~1,500-2,000 lines

---

## Verification

### After Each Phase

```bash
# 1. Run mock counter
./scripts/count_mocks.sh

# 2. Run affected tests
pytest tests/billing/ -v

# 3. Check test pass rate
pytest tests/billing/ --tb=short | grep "passed"

# 4. Compare with baseline
git diff main scripts/mock_report*.txt

# 5. Update tracking
./scripts/count_mocks.sh > mock_report_$(date +%Y%m%d).txt
```

### Success Metrics

| Phase | Mock Lines | Reduction | Tests Passing |
|-------|-----------|-----------|---------------|
| Baseline | 7,670 | - | 90%+ |
| Phase 1 | 7,000 | 670 (9%) | 90%+ |
| Phase 2 | 5,000 | 2,670 (35%) | 90%+ |
| Phase 3 | 3,000 | 4,670 (61%) | 90%+ |

### Quality Checks

```bash
# 1. Test coverage
pytest tests/billing/ --cov=dotmac.platform.billing --cov-report=term

# 2. Test performance
time pytest tests/billing/

# 3. Integration test health
pytest tests/ -m integration -v

# 4. Parallel test safety
pytest tests/billing/ -n auto
```

---

## Rollback Plan

If issues arise:

### Per-Module Rollback

```bash
# Rollback a specific module
cd tests/billing/
git checkout main -- test_problematic_file.py

# Run tests
pytest test_problematic_file.py -v

# Commit rollback
git add test_problematic_file.py
git commit -m "Revert: rollback billing test refactoring due to instability"
```

### Full Rollback

```bash
# Revert entire branch
git checkout main
git branch -D refactor/mock-reduction

# Or revert specific commits
git revert <commit-hash>
```

### Fallback Strategy

If refactoring causes instability:

1. **Keep infrastructure** (fakes, factories) - they're valuable
2. **Revert specific tests** causing issues
3. **Document why** reverting (in commit message)
4. **Create issue** to revisit later
5. **Continue with other modules** - don't block entire effort

---

## Progress Tracking

### Daily Checklist

- [ ] Run `./scripts/count_mocks.sh` before starting
- [ ] Work on one module at a time
- [ ] Run tests after each file refactored
- [ ] Commit working changes frequently
- [ ] Run `./scripts/count_mocks.sh` at end of day
- [ ] Document any blockers

### Weekly Report Template

```markdown
## Mock Reduction - Week X Report

**Date:** YYYY-MM-DD
**Phase:** [1/2/3]

### Metrics
- Starting Mock Lines: X,XXX
- Ending Mock Lines: X,XXX
- Reduction: XXX lines (XX%)

### Modules Completed
- [ ] Module 1 (XX files, XXX lines reduced)
- [ ] Module 2 (XX files, XXX lines reduced)

### Challenges
- Challenge 1: Description and resolution
- Challenge 2: Description and resolution

### Next Week Plan
- [ ] Task 1
- [ ] Task 2
- [ ] Task 3
```

---

## Tips & Best Practices

### During Refactoring

1. **Start small** - Pick smallest test files first
2. **One module at a time** - Don't refactor entire codebase at once
3. **Run tests frequently** - After each file or small change
4. **Commit working code** - Don't wait for perfect
5. **Document patterns** - Add comments for complex refactorings

### When Stuck

1. **Check examples** - `/docs/MOCK_REDUCTION_EXAMPLES.md`
2. **Use fakes guide** - `/docs/FAKES_GUIDE.md`
3. **Ask for review** - Get second opinion on approach
4. **Skip and return** - If test is too complex, move on
5. **Document blocker** - Create issue for future reference

### Code Review Checklist

When reviewing refactored tests:

- [ ] Mocks replaced with real objects or fakes
- [ ] Tests still pass
- [ ] Test coverage maintained or improved
- [ ] No performance degradation
- [ ] Fixtures properly cleaned up
- [ ] Test intentions clear
- [ ] Real database state verified (not mock calls)

---

## Success Criteria

### Quantitative

- ✅ **<3,000 total mock lines** (from 7,670)
- ✅ **<50 database mock lines** (from 2,592)
- ✅ **<500 service mock lines** (from 2,762)
- ✅ **90%+ test pass rate** (maintained)

### Qualitative

- ✅ Tests catch more real bugs
- ✅ Tests easier to maintain
- ✅ Tests easier to understand
- ✅ Refactoring is safer
- ✅ New tests use patterns (not mocks)

---

## Resources

- **Mock Counter:** `./scripts/count_mocks.sh`
- **Fake Implementations:** `tests/helpers/fakes.py`
- **Examples:** `/docs/MOCK_REDUCTION_EXAMPLES.md`
- **Fakes Guide:** `/docs/FAKES_GUIDE.md`
- **Test Review:** `/docs/TEST_REVIEW_SUMMARY.md` (this document from earlier)

---

## Questions & Support

**Where to start?**
→ Phase 1, Day 1: Auth mock cleanup (quick wins)

**How to create a fake?**
→ See `/docs/FAKES_GUIDE.md` section "Creating Custom Fakes"

**Test failing after refactoring?**
→ Check if test was actually testing mocks instead of behavior

**Need help?**
→ Review examples in `/docs/MOCK_REDUCTION_EXAMPLES.md`

---

**Ready to start?** Begin with Phase 1, Day 1! 🚀
