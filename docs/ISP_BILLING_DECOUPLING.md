# ISP Billing Decoupling from Platform

## Overview

The ISP billing module currently has 283 imports from `dotmac.platform.*` across 80 files. This document outlines the strategy to fully decouple ISP from Platform to enable standalone ISP deployments.

## Current State

### Import Analysis

| Platform Module | Import Count | Migration Target |
|-----------------|--------------|------------------|
| `billing.models` | 21 | ISP local copy |
| `billing.core.enums` | 20 | Shared (exists) |
| `billing.core.models` | 16 | ISP local copy |
| `billing.core.entities` | 14 | Shared + ISP |
| `billing.exceptions` | 14 | Shared (exists) |
| `billing.subscriptions.models` | 8 | ISP local copy |
| `tenant` | 8 | Shared (exists) |
| `billing.bank_accounts.entities` | 7 | Shared DTOs |
| `billing._typing_helpers` | 7 | Shared |
| `billing.money_utils` | 7 | Shared |
| `customer_management.models` | 6 | ISP local |
| Other billing submodules | ~155 | ISP local reimpl |

### Key Dependencies

```
dotmac.platform.billing
├── core/
│   ├── enums.py          → Already in Shared
│   ├── exceptions.py     → Already in Shared
│   ├── entities.py       → Extract DTOs to Shared
│   └── models.py         → Copy to ISP (SQLAlchemy)
├── models.py             → Copy to ISP
├── money_utils.py        → Move to Shared
├── money_models.py       → Move to Shared
├── _typing_helpers.py    → Move to Shared
├── subscriptions/        → Reimplement in ISP
├── invoicing/            → Reimplement in ISP
├── payments/             → Reimplement in ISP
└── [other services]      → Reimplement in ISP
```

## Migration Strategy

### Phase 1: Extract Neutral Types to Shared

**Already done:**
- `dotmac.shared.billing.core.enums`
- `dotmac.shared.billing.core.exceptions`

**To add:**
1. `dotmac.shared.billing.money` - Money utilities
   - `MoneyHandler` class
   - `create_money()`, `format_money()`, `add_money()` functions
   - `MoneyField` Pydantic model

2. `dotmac.shared.billing.entities` - Domain DTOs
   - `InvoiceEntity`, `PaymentEntity`, etc. (dataclasses, not ORM)

3. `dotmac.shared.billing.typing` - Type helpers
   - `DecimalLike`, `MoneyLike`, etc.

### Phase 2: Copy Models to ISP

ISP needs its own SQLAlchemy models because:
1. Different database schema
2. Different tenant structure
3. No runtime dependency on Platform

Files to copy/adapt:
```
src/dotmac/isp/billing/
├── models/
│   ├── __init__.py
│   ├── invoice.py        # Adapted from platform
│   ├── payment.py
│   ├── subscription.py
│   ├── credit_note.py
│   └── payment_method.py
```

### Phase 3: Reimplement Services

Services that need ISP-local implementation:

| Service | Complexity | Notes |
|---------|------------|-------|
| InvoiceService | High | Core billing logic |
| PaymentService | High | Payment processing |
| SubscriptionService | High | Subscription lifecycle |
| CatalogService | Medium | Product catalog |
| PricingService | Medium | Price calculation |
| DunningService | Medium | Collection workflow |
| TaxService | Low | Tax calculation |
| MetricsService | Low | Billing metrics |

### Phase 4: Update Imports

Use the refactoring script to batch-update imports:

```bash
# Dry run
python scripts/refactor-isp-billing-imports.py --dry-run

# Apply changes
python scripts/refactor-isp-billing-imports.py --apply
```

### Phase 5: Verify Decoupling

```bash
# Should return zero matches
grep -r "dotmac\.platform" split-staging/dotmac-isp/src --include="*.py" | wc -l
```

## Implementation Checklist

### Shared Package Updates

- [ ] Add `dotmac.shared.billing.money` module
  - [ ] `MoneyHandler` class
  - [ ] `MoneyField` Pydantic model
  - [ ] Helper functions

- [ ] Add `dotmac.shared.billing.entities` module
  - [ ] Base entity dataclasses
  - [ ] Invoice/Payment/Subscription DTOs

- [ ] Add `dotmac.shared.billing.typing` module
  - [ ] Type aliases
  - [ ] Protocol definitions

### ISP Package Implementation

- [ ] Create `dotmac.isp.billing.models`
  - [ ] Invoice model
  - [ ] InvoiceLineItem model
  - [ ] Payment model
  - [ ] PaymentMethod model
  - [ ] Subscription model
  - [ ] Transaction model
  - [ ] CreditNote model

- [ ] Create `dotmac.isp.billing.config`
  - [ ] Billing settings
  - [ ] Currency configuration

- [ ] Implement core services
  - [ ] InvoiceService
  - [ ] PaymentService
  - [ ] SubscriptionService

- [ ] Update all imports
  - [ ] Run refactoring script
  - [ ] Fix any remaining manual imports

### Testing

- [ ] Unit tests pass without Platform installed
- [ ] Integration tests for billing workflows
- [ ] Test ISP standalone startup

## File Changes Summary

### Files to Create in Shared

```
split-staging/dotmac-shared/src/dotmac/shared/billing/
├── money/
│   ├── __init__.py
│   ├── handler.py      # MoneyHandler
│   └── models.py       # MoneyField, MoneyDTO
├── entities/
│   ├── __init__.py
│   └── billing.py      # InvoiceEntity, PaymentEntity, etc.
└── typing.py           # Type helpers
```

### Files to Create in ISP

```
split-staging/dotmac-isp/src/dotmac/isp/billing/
├── core/
│   ├── __init__.py     # Re-export from shared
│   ├── models.py       # SQLAlchemy models
│   └── entities.py     # Local entity extensions
├── config.py           # ISP billing config
├── services/
│   ├── invoice.py
│   ├── payment.py
│   └── subscription.py
└── [existing files updated]
```

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Breaking existing billing | Run full test suite after each phase |
| Missing model fields | Careful diffing of Platform vs ISP models |
| Service behavior differences | Document and test all business logic |
| Database migration | ISP uses same schema, just different DB |

## Timeline Estimate

| Phase | Effort |
|-------|--------|
| Phase 1 (Shared types) | 2-3 days |
| Phase 2 (Copy models) | 1-2 days |
| Phase 3 (Reimplement services) | 5-7 days |
| Phase 4 (Update imports) | 1 day |
| Phase 5 (Verify + test) | 2-3 days |
| **Total** | **11-16 days** |

## Next Steps

1. Start with Phase 1 - extract `money_utils` to Shared
2. Run tests to ensure nothing breaks
3. Proceed to Phase 2 - copy models
4. Incrementally reimplement services
5. Final verification
