# Wireless GraphQL Documentation - Navigation Guide

**Quick Links:** [Quick Start](#quick-start) | [For Developers](#for-developers) | [For Product Teams](#for-product-teams) | [Testing](#testing) | [Troubleshooting](#troubleshooting)

---

## 📖 Documentation Overview

This index helps you navigate the complete wireless GraphQL documentation set. Choose the right guide for your needs.

---

## 🚀 Quick Start

### New to Wireless GraphQL?

**Start here:** [`WIRELESS_GRAPHQL_COMPLETE.md`](./WIRELESS_GRAPHQL_COMPLETE.md)
- ✅ Executive summary
- ✅ What was built and why
- ✅ Key benefits
- ✅ Getting started in 5 minutes

**Then read:** [`WIRELESS_GRAPHQL_README.md`](./WIRELESS_GRAPHQL_README.md)
- ✅ Quick start code examples
- ✅ All 14 queries documented
- ✅ API reference
- ✅ Best practices

---

## 👨‍💻 For Developers

### Using GraphQL Hooks

**Primary Reference:** [`WIRELESS_GRAPHQL_README.md`](./WIRELESS_GRAPHQL_README.md)

**Sections to read:**
1. Quick Start (5 minutes)
2. Available Queries (comprehensive reference)
3. Frontend Hooks (API documentation)
4. Examples (5 detailed examples)
5. Best Practices
6. Troubleshooting

**Code Examples:**
```typescript
// Basic usage
import { useAccessPointListGraphQL } from '@/hooks/useWirelessGraphQL';

const { accessPoints, loading, error } = useAccessPointListGraphQL({
  limit: 50,
  status: AccessPointStatus.Online,
  pollInterval: 30000,
});
```

### Migrating from REST

**Primary Guide:** [`WIRELESS_GRAPHQL_MIGRATION_GUIDE.md`](./WIRELESS_GRAPHQL_MIGRATION_GUIDE.md)

**Sections to read:**
1. Migration Strategy (3-phase approach)
2. Before/After Examples (4 detailed examples)
3. Migration Checklist
4. Testing During Migration
5. Rollback Plan

**What you'll learn:**
- How to replace REST hooks with GraphQL hooks
- How to test during migration
- How to handle edge cases
- How to roll back if needed

### Writing Tests

**Primary Guide:** [`WIRELESS_GRAPHQL_TESTING_SUMMARY.md`](./WIRELESS_GRAPHQL_TESTING_SUMMARY.md)

**Sections to read:**
1. Test Suite Overview
2. Running Tests
3. Test Patterns
4. Writing New Tests

**Test Examples:**
- Frontend hook testing with MockedProvider
- Backend resolver integration testing
- Error scenario testing
- Pagination and filtering tests

### Backend Development

**Primary Guide:** [`WIRELESS_FIBER_GRAPHQL_IMPLEMENTATION_GUIDE.md`](./WIRELESS_FIBER_GRAPHQL_IMPLEMENTATION_GUIDE.md)

**Sections to read:**
1. GraphQL Type Definitions
2. Query Resolver Implementation
3. Database Model Mapping
4. Mapper Functions
5. Testing Resolvers

**What you'll learn:**
- How to create new GraphQL types
- How to implement query resolvers
- How to map database models to GraphQL types
- How to test backend queries

---

## 📊 For Product Teams

### Understanding the Implementation

**Primary Document:** [`WIRELESS_GRAPHQL_COMPLETE.md`](./WIRELESS_GRAPHQL_COMPLETE.md)

**Sections to read:**
1. Executive Summary
2. Implementation Statistics
3. Key Features
4. Benefits Over REST
5. Production Readiness Checklist

**What you'll learn:**
- What was built and why
- Benefits for users and developers
- Production readiness status
- Migration timeline and effort

### Planning Migration

**Primary Guide:** [`WIRELESS_GRAPHQL_MIGRATION_GUIDE.md`](./WIRELESS_GRAPHQL_MIGRATION_GUIDE.md)

**Sections to read:**
1. Migration Strategy
2. Timeline Estimates
3. Risk Assessment
4. Success Metrics

**Timeline Estimates:**
- Small component: 15-30 minutes
- Medium component: 1-2 hours
- Large dashboard: 3-4 hours

### Tracking Progress

**Primary Document:** [`WIRELESS_FIBER_GRAPHQL_STATUS.md`](./WIRELESS_FIBER_GRAPHQL_STATUS.md)

**Sections to read:**
1. Executive Summary
2. Completed Tasks
3. Progress Metrics
4. Recommended Next Steps

**What you'll find:**
- Current implementation status
- What's complete vs. pending
- Known issues and resolutions
- Next steps and roadmap

---

## 🧪 Testing

### Running Tests

**Primary Guide:** [`WIRELESS_GRAPHQL_TESTING_SUMMARY.md`](./WIRELESS_GRAPHQL_TESTING_SUMMARY.md)

**Quick Commands:**
```bash
# Frontend tests
cd frontend/apps/base-app
pnpm test useWirelessGraphQL

# Backend tests
poetry run pytest tests/graphql/test_wireless_queries.py -v

# All tests with coverage
pnpm test --coverage
poetry run pytest tests/graphql/ --cov
```

**Test Coverage:**
- 30+ frontend hook tests
- 25+ backend resolver tests
- 100% query coverage
- 100% hook coverage

### Writing Tests

**Reference:** [`WIRELESS_GRAPHQL_TESTING_SUMMARY.md`](./WIRELESS_GRAPHQL_TESTING_SUMMARY.md) - Section "Test Patterns"

**Test Patterns:**
1. Frontend: Apollo MockedProvider
2. Backend: Pytest fixtures with database
3. Error scenarios
4. Edge cases

---

## 🔧 Troubleshooting

### Common Issues

**Quick Reference:** [`WIRELESS_GRAPHQL_README.md`](./WIRELESS_GRAPHQL_README.md) - Section "Troubleshooting"

**Common Problems:**
1. GraphQL endpoint 404
2. Type errors in frontend
3. Empty query results
4. Polling not working
5. Permission errors

**Solutions:**
- Check backend server status
- Regenerate GraphQL types
- Verify tenant context
- Check polling configuration
- Validate permissions

### Getting Help

**Resources:**
1. GraphQL Playground: `http://localhost:8000/api/v1/graphql`
2. Test files for usage examples
3. Server logs for backend errors
4. Apollo DevTools for query debugging

---

## 📚 Complete Documentation Set

### Essential Documents (Start Here)

| Document | Purpose | When to Read |
|----------|---------|--------------|
| [`WIRELESS_GRAPHQL_COMPLETE.md`](./WIRELESS_GRAPHQL_COMPLETE.md) | Executive summary | First time setup |
| [`WIRELESS_GRAPHQL_README.md`](./WIRELESS_GRAPHQL_README.md) | API reference & examples | Daily reference |
| [`WIRELESS_GRAPHQL_MIGRATION_GUIDE.md`](./WIRELESS_GRAPHQL_MIGRATION_GUIDE.md) | REST to GraphQL migration | During migration |

### Detailed Guides

| Document | Purpose | When to Read |
|----------|---------|--------------|
| [`WIRELESS_GRAPHQL_TESTING_SUMMARY.md`](./WIRELESS_GRAPHQL_TESTING_SUMMARY.md) | Testing guide | Writing/running tests |
| [`WIRELESS_FIBER_GRAPHQL_IMPLEMENTATION_GUIDE.md`](./WIRELESS_FIBER_GRAPHQL_IMPLEMENTATION_GUIDE.md) | Backend implementation | Backend development |
| [`WIRELESS_FIBER_GRAPHQL_STATUS.md`](./WIRELESS_FIBER_GRAPHQL_STATUS.md) | Status tracking | Checking progress |

### Supporting Documents

| Document | Purpose |
|----------|---------|
| [`WIRELESS_FIBER_GRAPHQL_MIGRATION_PLAN.md`](./WIRELESS_FIBER_GRAPHQL_MIGRATION_PLAN.md) | Original planning document |
| [`GRAPHQL_SUBSCRIPTIONS_SETUP_COMPLETE.md`](./GRAPHQL_SUBSCRIPTIONS_SETUP_COMPLETE.md) | Real-time subscriptions setup |

---

## 🎯 Reading Paths by Role

### Frontend Developer

**Path 1: Quick Start**
1. Read: `WIRELESS_GRAPHQL_COMPLETE.md` (15 min)
2. Read: `WIRELESS_GRAPHQL_README.md` - Quick Start section (10 min)
3. Try: Copy/paste a hook example (5 min)
4. Reference: Bookmark `WIRELESS_GRAPHQL_README.md` for daily use

**Path 2: Deep Dive**
1. Read: Complete `WIRELESS_GRAPHQL_README.md` (30 min)
2. Read: `WIRELESS_GRAPHQL_TESTING_SUMMARY.md` (20 min)
3. Practice: Write a test for a new component (30 min)

### Backend Developer

**Path 1: Understanding**
1. Read: `WIRELESS_GRAPHQL_COMPLETE.md` (15 min)
2. Read: `WIRELESS_FIBER_GRAPHQL_IMPLEMENTATION_GUIDE.md` (30 min)
3. Review: Backend test files (20 min)

**Path 2: Adding Features**
1. Read: Implementation Guide - Type Definitions section
2. Read: Implementation Guide - Query Resolvers section
3. Read: Implementation Guide - Mapper Functions section
4. Reference: Existing resolvers in `wireless.py`

### Product Manager

**Path 1: Overview**
1. Read: `WIRELESS_GRAPHQL_COMPLETE.md` - Executive Summary (10 min)
2. Read: `WIRELESS_GRAPHQL_COMPLETE.md` - Benefits Over REST (5 min)
3. Read: `WIRELESS_GRAPHQL_STATUS.md` - Progress Metrics (5 min)

**Path 2: Planning Migration**
1. Read: `WIRELESS_GRAPHQL_MIGRATION_GUIDE.md` - Strategy section (15 min)
2. Read: `WIRELESS_GRAPHQL_MIGRATION_GUIDE.md` - Timeline section (10 min)
3. Review: Success criteria in `WIRELESS_GRAPHQL_STATUS.md` (5 min)

### QA Engineer

**Path 1: Testing**
1. Read: `WIRELESS_GRAPHQL_TESTING_SUMMARY.md` (30 min)
2. Run: Frontend tests (`pnpm test`) (10 min)
3. Run: Backend tests (`pytest`) (10 min)
4. Review: Test coverage reports (10 min)

**Path 2: Test Planning**
1. Read: Testing Summary - Test Coverage section
2. Read: Testing Summary - Test Patterns section
3. Identify: Gaps in test coverage
4. Plan: Additional test scenarios

---

## 🔍 Finding Information

### By Topic

**GraphQL Queries:**
- List of all queries → `WIRELESS_GRAPHQL_README.md` - "Available Queries"
- Query examples → `WIRELESS_GRAPHQL_README.md` - "Examples"
- Query syntax → `frontend/apps/base-app/lib/graphql/queries/wireless.graphql`

**React Hooks:**
- Hook reference → `WIRELESS_GRAPHQL_README.md` - "Frontend Hooks"
- Hook examples → `WIRELESS_GRAPHQL_README.md` - "Examples"
- Hook API → `frontend/apps/base-app/hooks/useWirelessGraphQL.ts`

**Testing:**
- Running tests → `WIRELESS_GRAPHQL_TESTING_SUMMARY.md` - "Running Tests"
- Writing tests → `WIRELESS_GRAPHQL_TESTING_SUMMARY.md` - "Test Patterns"
- Test examples → `hooks/__tests__/useWirelessGraphQL.test.tsx`

**Migration:**
- Strategy → `WIRELESS_GRAPHQL_MIGRATION_GUIDE.md` - "Migration Strategy"
- Examples → `WIRELESS_GRAPHQL_MIGRATION_GUIDE.md` - "Examples"
- Checklist → `WIRELESS_GRAPHQL_MIGRATION_GUIDE.md` - "Checklist"

**Troubleshooting:**
- Common issues → `WIRELESS_GRAPHQL_README.md` - "Troubleshooting"
- Known issues → `WIRELESS_FIBER_GRAPHQL_STATUS.md` - "Known Issues"
- Debug tips → `WIRELESS_GRAPHQL_README.md` - "Debug Mode"

---

## 📞 Quick Reference

### Code Locations

```
Backend:
  Types:       src/dotmac/platform/graphql/types/wireless.py
  Resolvers:   src/dotmac/platform/graphql/queries/wireless.py
  Models:      src/dotmac/platform/wireless/models.py
  Tests:       tests/graphql/test_wireless_queries.py

Frontend:
  Queries:     frontend/apps/base-app/lib/graphql/queries/wireless.graphql
  Generated:   frontend/apps/base-app/lib/graphql/generated.ts
  Hooks:       frontend/apps/base-app/hooks/useWirelessGraphQL.ts
  Tests:       frontend/apps/base-app/hooks/__tests__/useWirelessGraphQL.test.tsx

Docs:
  Index:       docs/WIRELESS_GRAPHQL_INDEX.md (this file)
  Complete:    docs/WIRELESS_GRAPHQL_COMPLETE.md
  README:      docs/WIRELESS_GRAPHQL_README.md
  Migration:   docs/WIRELESS_GRAPHQL_MIGRATION_GUIDE.md
  Testing:     docs/WIRELESS_GRAPHQL_TESTING_SUMMARY.md
  Status:      docs/WIRELESS_FIBER_GRAPHQL_STATUS.md
```

### Endpoints

```
GraphQL API:       http://localhost:8000/api/v1/graphql
GraphQL Playground: http://localhost:8000/api/v1/graphql (interactive)
```

### Key Commands

```bash
# Frontend
pnpm run generate:graphql          # Regenerate types
pnpm test useWirelessGraphQL       # Run tests

# Backend
poetry run pytest tests/graphql/   # Run tests
poetry run uvicorn ...             # Start server
```

---

## 🎉 Summary

This documentation set provides complete coverage of the wireless GraphQL implementation:

✅ **5 comprehensive guides** covering all aspects
✅ **20+ code examples** for common use cases
✅ **55+ test cases** fully documented
✅ **Complete API reference** for all 14 queries
✅ **Step-by-step migration guide** from REST
✅ **Troubleshooting guide** for common issues

### Recommended Reading Order

1. **First Time:** `WIRELESS_GRAPHQL_COMPLETE.md` (15 min)
2. **Daily Use:** `WIRELESS_GRAPHQL_README.md` (bookmark this!)
3. **Migration:** `WIRELESS_GRAPHQL_MIGRATION_GUIDE.md`
4. **Testing:** `WIRELESS_GRAPHQL_TESTING_SUMMARY.md`
5. **Reference:** This index for navigation

---

**Happy coding with GraphQL! 🚀**

---

**Last Updated:** 2025-10-16
**Version:** 1.0.0
**Status:** ✅ Complete
