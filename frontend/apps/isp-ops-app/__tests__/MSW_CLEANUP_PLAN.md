# MSW Migration Cleanup & Future Migration Plan

**Created**: 2025-11-14
**Status**: Ready for Execution

## Executive Summary

With 100% of migrated MSW tests now passing (23/23 hooks, 495/495 tests), we can safely remove old `jest.mock` test files and plan future migrations.

### Quick Stats
- **Old test files to remove**: 27 files (~631KB)
- **Hooks ready for migration**: 27 hooks
- **Disk space savings**: ~631KB
- **Maintenance reduction**: 27 fewer duplicate test files

---

## Part 1: Old Test Files Ready for Removal

### ✅ Safe to Remove (MSW versions passing 100%)

All hooks below have fully passing MSW test suites and their old test files can be safely removed:

| Hook | Old Test Files | Size | MSW Tests Status |
|------|---------------|------|------------------|
| useApiKeys | useApiKeys.test.ts<br>useApiKeys.test.tsx | 567B<br>19KB | ✅ 15/15 passing |
| useBillingPlans | useBillingPlans.test.tsx | 43KB | ✅ 23/23 passing |
| useCreditNotes | useCreditNotes.test.tsx | 9.1KB | ✅ 8/8 passing |
| useDunning | useDunning.test.tsx | 49KB | ✅ 31/31 passing |
| useFaults | useFaults.test.tsx | 36KB | ✅ 15/15 passing |
| useFeatureFlags | useFeatureFlags.test.ts<br>useFeatureFlags.test.tsx | 749B<br>37KB | ✅ 17/17 passing |
| useHealth | useHealth.test.ts<br>useHealth.test.tsx | 701B<br>8.5KB | ✅ 12/12 passing |
| useIntegrations | useIntegrations.test.tsx | 29KB | ✅ 13/13 passing |
| useInvoiceActions | useInvoiceActions.test.tsx | 25KB | ✅ 17/17 passing |
| useJobs | useJobs.test.tsx | 30KB | ✅ 23/23 passing |
| useLogs | useLogs.test.ts<br>useLogs.test.tsx | 507B<br>15KB | ✅ 24/24 passing |
| useNotifications | useNotifications.test.ts | 614B | ✅ 26/26 passing |
| useOperations | useOperations.test.tsx | 37KB | ✅ 30/30 passing |
| useOrchestration | useOrchestration.test.ts<br>useOrchestration.test.tsx | 638B<br>39KB | ✅ 37/37 passing |
| useRADIUS | useRADIUS.test.tsx | 13KB | ✅ 14/14 passing |
| useScheduler | useScheduler.test.tsx | 48KB | ✅ 31/31 passing |
| useServiceLifecycle | useServiceLifecycle.test.tsx | 40KB | ✅ 32/32 passing |
| useSubscribers | useSubscribers.test.tsx | 17KB | ✅ 26/26 passing |
| useTechnicians | useTechnicians.test.tsx | 40KB | ✅ 34/34 passing |
| useUsers | useUsers.test.tsx | 38KB | ✅ 12/12 passing |
| useWebhooks | useWebhooks.test.ts<br>useWebhooks.test.tsx | 559B<br>35KB | ✅ 12/12 passing |

**Total**: 27 files, ~631KB

### Removal Command

```bash
# Navigate to project root
cd /Users/michaelayoade/Downloads/Projects/dotmac-ftth-ops/frontend/apps/isp-ops-app

# Remove old test files (dry run first to verify)
rm -v hooks/__tests__/useApiKeys.test.{ts,tsx} \
     hooks/__tests__/useBillingPlans.test.tsx \
     hooks/__tests__/useCreditNotes.test.tsx \
     hooks/__tests__/useDunning.test.tsx \
     hooks/__tests__/useFaults.test.tsx \
     hooks/__tests__/useFeatureFlags.test.{ts,tsx} \
     hooks/__tests__/useHealth.test.{ts,tsx} \
     hooks/__tests__/useIntegrations.test.tsx \
     hooks/__tests__/useInvoiceActions.test.tsx \
     hooks/__tests__/useJobs.test.tsx \
     hooks/__tests__/useLogs.test.{ts,tsx} \
     hooks/__tests__/useNotifications.test.ts \
     hooks/__tests__/useOperations.test.tsx \
     hooks/__tests__/useOrchestration.test.{ts,tsx} \
     hooks/__tests__/useRADIUS.test.tsx \
     hooks/__tests__/useScheduler.test.tsx \
     hooks/__tests__/useServiceLifecycle.test.tsx \
     hooks/__tests__/useSubscribers.test.tsx \
     hooks/__tests__/useTechnicians.test.tsx \
     hooks/__tests__/useUsers.test.tsx \
     hooks/__tests__/useWebhooks.test.{ts,tsx}
```

### Verification After Removal

```bash
# Run all MSW tests to ensure nothing breaks
pnpm test -- "hooks/__tests__/*.msw.test.tsx" --no-coverage

# Expected result:
# Test Suites: 23 passed, 23 total
# Tests:       495 passed, 495 total
```

---

## Part 2: Hooks Ready for Future Migration

### High Priority (API-heavy hooks)

These hooks make extensive API calls and would benefit most from MSW migration:

#### 1. **useAudit**
- **Current**: jest.mock-based
- **API calls**: Audit log retrieval, filtering, export
- **Complexity**: Medium
- **Estimated tests**: ~20
- **Priority**: HIGH - Heavy API usage, good MSW candidate

#### 2. **useFieldService**
- **Current**: jest.mock-based
- **API calls**: Field service scheduling, technician assignment, job management
- **Complexity**: High
- **Estimated tests**: ~30
- **Priority**: HIGH - Complex workflows, multiple endpoints

#### 3. **useCampaigns**
- **Current**: jest.mock-based
- **API calls**: Campaign CRUD, targeting, analytics
- **Complexity**: Medium
- **Estimated tests**: ~25
- **Priority**: HIGH - Marketing-critical, needs realistic testing

### Medium Priority (Complex hooks)

#### 4. **useReconciliation**
- **Current**: jest.mock-based
- **API calls**: Payment reconciliation, matching, reporting
- **Complexity**: High
- **Estimated tests**: ~25
- **Priority**: MEDIUM - Complex but less frequently used

#### 5. **useCommissionRules**
- **Current**: jest.mock-based
- **API calls**: Commission rule management, calculations
- **Complexity**: Medium
- **Estimated tests**: ~20
- **Priority**: MEDIUM - Business logic heavy

#### 6. **usePartners**
- **Current**: jest.mock-based
- **API calls**: Partner management, contracts, revenue sharing
- **Complexity**: Medium
- **Estimated tests**: ~20
- **Priority**: MEDIUM - B2B features

#### 7. **usePartnerPortal**
- **Current**: jest.mock-based
- **API calls**: Partner portal access, reporting
- **Complexity**: Medium
- **Estimated tests**: ~15
- **Priority**: MEDIUM - Portal features

#### 8. **useCustomerPortal**
- **Current**: jest.mock-based
- **API calls**: Customer portal access, self-service
- **Complexity**: Medium
- **Estimated tests**: ~20
- **Priority**: MEDIUM - Customer-facing

#### 9. **usePlatformTenants**
- **Current**: jest.mock-based
- **API calls**: Tenant management, configuration
- **Complexity**: Medium
- **Estimated tests**: ~20
- **Priority**: MEDIUM - Platform management

#### 10. **useTenantOnboarding**
- **Current**: jest.mock-based
- **API calls**: Tenant onboarding workflows
- **Complexity**: Medium
- **Estimated tests**: ~15
- **Priority**: MEDIUM - Onboarding critical

### Lower Priority (Specialized hooks)

#### 11. **useLicensing**
- **Current**: jest.mock-based
- **API calls**: License validation, management
- **Complexity**: Low
- **Estimated tests**: ~10
- **Priority**: LOW - Less frequently used

#### 12. **useDataTransfer**
- **Current**: jest.mock-based
- **API calls**: Data import/export operations
- **Complexity**: Medium
- **Estimated tests**: ~15
- **Priority**: LOW - Utility feature

#### 13. **useVersioning**
- **Current**: jest.mock-based
- **API calls**: API version management
- **Complexity**: Low
- **Estimated tests**: ~10
- **Priority**: LOW - Infrastructure

#### 14. **useSettings**
- **Current**: jest.mock-based
- **API calls**: Application settings CRUD
- **Complexity**: Low
- **Estimated tests**: ~10
- **Priority**: LOW - Simple CRUD

#### 15. **useSearch**
- **Current**: jest.mock-based
- **API calls**: Global search functionality
- **Complexity**: Medium
- **Estimated tests**: ~15
- **Priority**: LOW - Search features

#### 16. **useProfile**
- **Current**: jest.mock-based
- **API calls**: User profile management
- **Complexity**: Low
- **Estimated tests**: ~10
- **Priority**: LOW - Simple CRUD

#### 17. **useBranding**
- **Current**: jest.mock-based
- **API calls**: Branding customization
- **Complexity**: Low
- **Estimated tests**: ~10
- **Priority**: LOW - UI customization

#### 18. **useTenantBranding**
- **Current**: jest.mock-based
- **API calls**: Tenant-specific branding
- **Complexity**: Low
- **Estimated tests**: ~10
- **Priority**: LOW - Tenant customization

#### 19. **useDomainVerification**
- **Current**: jest.mock-based
- **API calls**: Domain ownership verification
- **Complexity**: Medium
- **Estimated tests**: ~12
- **Priority**: LOW - Setup feature

#### 20. **usePlugins**
- **Current**: jest.mock-based
- **API calls**: Plugin management, configuration
- **Complexity**: Medium
- **Estimated tests**: ~15
- **Priority**: LOW - Extensibility

### GraphQL Hooks (Different approach needed)

These hooks use GraphQL instead of REST and may need different MSW setup:

#### 21. **useFiberGraphQL**
- **Current**: jest.mock-based (GraphQL)
- **API**: Fiber infrastructure GraphQL queries
- **Complexity**: High
- **Estimated tests**: ~20
- **Priority**: MEDIUM - Needs GraphQL MSW setup
- **Note**: Requires `graphql` package and MSW GraphQL handlers

#### 22. **useWirelessGraphQL**
- **Current**: jest.mock-based (GraphQL)
- **API**: Wireless infrastructure GraphQL queries
- **Complexity**: High
- **Estimated tests**: ~20
- **Priority**: MEDIUM - Needs GraphQL MSW setup

#### 23. **useSubscriberDashboardGraphQL**
- **Current**: jest.mock-based (GraphQL)
- **API**: Subscriber dashboard GraphQL queries
- **Complexity**: Medium
- **Estimated tests**: ~15
- **Priority**: MEDIUM - Needs GraphQL MSW setup

### Browser/UI Hooks (May not need MSW)

These hooks don't make API calls or are UI-focused:

#### 24. **useBrowserNotifications**
- **Current**: jest.mock-based
- **API**: Browser Notification API (not HTTP)
- **Complexity**: Low
- **Priority**: LOW - Browser API, not network
- **Note**: May not benefit from MSW

#### 25. **useAlerts**
- **Current**: jest.mock-based
- **API**: In-app alerts (likely state management)
- **Complexity**: Low
- **Priority**: LOW - State management, not network
- **Note**: May not benefit from MSW

#### 26. **useAIChat**
- **Current**: jest.mock-based
- **API**: AI chat functionality (likely WebSocket + REST)
- **Complexity**: High
- **Priority**: MEDIUM - Mixed protocols
- **Note**: May need WebSocket MSW support

#### 27. **useCommunications**
- **Current**: jest.mock-based
- **API**: Communication channels
- **Complexity**: Medium
- **Priority**: MEDIUM - Depends on implementation

---

## Part 3: Migration Estimation

### Effort by Priority

| Priority | Hooks | Est. Tests | Est. Effort | Timeline |
|----------|-------|------------|-------------|----------|
| **HIGH** | 3 | ~75 tests | 6-8 hours | Week 1 |
| **MEDIUM** | 14 | ~245 tests | 20-25 hours | Weeks 2-4 |
| **LOW** | 10 | ~125 tests | 12-15 hours | Weeks 5-6 |

**Total**: 27 hooks, ~445 tests, ~40-50 hours

### Recommended Phased Approach

#### Phase 6: High-Priority API Hooks (Week 1)
- [ ] useAudit (~20 tests)
- [ ] useFieldService (~30 tests)
- [ ] useCampaigns (~25 tests)

**Goal**: Cover most critical API-heavy hooks

#### Phase 7: Business Logic Hooks (Weeks 2-3)
- [ ] useReconciliation (~25 tests)
- [ ] useCommissionRules (~20 tests)
- [ ] usePartners (~20 tests)
- [ ] usePartnerPortal (~15 tests)
- [ ] useCustomerPortal (~20 tests)

**Goal**: Complete business-critical functionality

#### Phase 8: Platform Management (Week 4)
- [ ] usePlatformTenants (~20 tests)
- [ ] useTenantOnboarding (~15 tests)
- [ ] useDomainVerification (~12 tests)
- [ ] usePlugins (~15 tests)

**Goal**: Platform and tenant management coverage

#### Phase 9: GraphQL Hooks (Week 5)
- [ ] Setup GraphQL MSW support
- [ ] useFiberGraphQL (~20 tests)
- [ ] useWirelessGraphQL (~20 tests)
- [ ] useSubscriberDashboardGraphQL (~15 tests)

**Goal**: GraphQL integration testing

#### Phase 10: Utilities & UI (Week 6)
- [ ] Remaining low-priority hooks (~125 tests)
- [ ] Evaluate non-API hooks for MSW suitability

**Goal**: Complete migration or document why some hooks don't need MSW

---

## Part 4: Benefits Analysis

### Immediate Benefits (After Cleanup)

1. **Reduced Codebase Size**: ~631KB removal
2. **Eliminated Duplication**: 27 fewer test files to maintain
3. **Clearer Testing Strategy**: Single source of truth (MSW)
4. **Easier Onboarding**: New developers learn one testing pattern

### Long-term Benefits (After Full Migration)

1. **Improved Test Reliability**:
   - Tests verify actual HTTP behavior
   - Catches URL/parameter mismatches
   - More realistic error scenarios

2. **Faster Development**:
   - Reusable handlers across test files
   - Less mock setup boilerplate
   - Easier debugging with MSW DevTools

3. **Better Coverage**:
   - Tests network layer properly
   - Type-safe response formats
   - Consistent handler behavior

4. **Maintenance Reduction**:
   - Centralized API mocking logic
   - Single place to update API contracts
   - No duplicate test maintenance

---

## Part 5: Execution Checklist

### Before Removal
- [x] Verify all MSW tests passing (495/495) ✅
- [x] Document which files to remove
- [ ] Get team approval/review
- [ ] Create backup branch
- [ ] Run full test suite

### During Removal
- [ ] Remove old test files in batches
- [ ] Run MSW tests after each batch
- [ ] Verify no imports reference old files
- [ ] Update any documentation referencing old tests

### After Removal
- [ ] Run full test suite
- [ ] Update CI/CD if needed
- [ ] Document cleanup in changelog
- [ ] Celebrate reduced technical debt! 🎉

### For Future Migrations
- [ ] Select next priority hook
- [ ] Follow established MSW patterns (see TESTING_PATTERNS.md)
- [ ] Create handler + test file
- [ ] Verify 100% passing
- [ ] Remove old test file
- [ ] Update MSW_MIGRATION_STATUS.md

---

## Part 6: Risk Mitigation

### Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Removed file still imported somewhere | Low | High | Run `grep -r "oldfile" .` before removal |
| MSW test has edge case bug | Low | Medium | Keep old files for 1 sprint, verify in production |
| Team unfamiliar with MSW | Medium | Low | Training session + documentation |
| CI pipeline issues | Low | Medium | Test CI after removal, rollback if needed |

### Rollback Plan

If issues arise after removal:
1. Restore files from git: `git checkout HEAD~1 hooks/__tests__/<file>`
2. Run old tests: `pnpm test -- <file>`
3. Compare behavior with MSW version
4. Fix MSW test, then remove old file again

---

## Part 7: Success Metrics

### Key Performance Indicators

| Metric | Current | Target | Status |
|--------|---------|--------|--------|
| MSW Test Coverage | 23 hooks | 50 hooks | 46% |
| Total MSW Tests | 495 tests | 940 tests | 53% |
| Test Pass Rate | 100% | 100% | ✅ |
| Old Test Files | 27 files | 0 files | Ready |
| Disk Space (tests) | ~1.2MB | ~600KB | -50% |
| Duplicate Maintenance | 27 files | 0 files | Ready |

### Definition of Done (Per Hook)

✅ MSW handler created and documented
✅ MSW test file created with comprehensive coverage
✅ All tests passing (100%)
✅ Old test file removed
✅ MSW_MIGRATION_STATUS.md updated
✅ No references to old test file in codebase

---

## Part 8: Resources

### Documentation
- Main Guide: `__tests__/README.md`
- Migration Status: `__tests__/MSW_MIGRATION_STATUS.md`
- Testing Patterns: `__tests__/TESTING_PATTERNS.md` (to be created)

### Example References
- **Complete Hook**: `useWebhooks.msw.test.tsx` (12 tests)
- **Complex Hook**: `useDunning.msw.test.tsx` (31 tests)
- **GraphQL Setup**: TBD (Phase 9)

### Team Support
- Questions: See `__tests__/README.md`
- Code Review: Reference MSW best practices
- Blockers: Document in MSW_MIGRATION_STATUS.md

---

## Contact & Feedback

For questions or suggestions about this cleanup plan:
- Review: `__tests__/README.md` for MSW guide
- Reference: Existing .msw.test.tsx files for patterns
- Update: This document as migration progresses

**Last Updated**: 2025-11-14
**Next Review**: After Phase 6 completion
