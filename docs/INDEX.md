# Documentation Index

**Last Updated**: October 5, 2025

## 📚 Quick Navigation

### Essential Documentation (Root)
- **[README.md](../README.md)** - Project overview and getting started
- **[CONTRIBUTING.md](../CONTRIBUTING.md)** - Contribution guidelines
- **[CLAUDE_OLD.md](../CLAUDE_OLD.md)** - Legacy Claude AI development guidelines (archived)

---

## 📂 Documentation Structure

### 1. [Sessions](./sessions/) - Development History (90 files)
Development session summaries, progress reports, and completion records from parallel development work.

**Key Sessions**:
- `DEV1_*` - Core platform & API development
- `DEV2_COVERAGE_SESSION_SUMMARY.md` - User Management & Webhooks coverage
- `DEV3_*` - Analytics & Monitoring
- `DEV4_*` - Plugins & Integrations
- `PHASE*` - Multi-phase implementation summaries
- `WEEK*` - Weekly progress reports

### 2. [Coverage Reports](./coverage-reports/) - Test Coverage (52 files)
Historical test coverage improvements and module-specific coverage reports.

**Categories**:
- **Module Coverage**: `BILLING_*`, `AUTH_*`, `CUSTOMER_*`, `COMMUNICATIONS_*`
- **Overall Status**: `OVERALL_TESTING_STATUS.md`
- **Strategies**: Pattern application reports and fake implementation guides

**Key Reports**:
- `FAKE_PATTERN_COMPLETE_SUMMARY.md` - Fake implementation pattern results
- Module-specific coverage improvements (90%+ achieved)

### 3. [Architecture](./architecture/) - System Design (14 files)
System architecture, design patterns, and implementation guides.

**Topics**:
- **Domain-Driven Design**: `DDD_*` files
- **CQRS**: `CQRS_*` implementation patterns
- **Event-Driven**: `DOMAIN_EVENTS_*` architecture
- **API Design**: `API_GATEWAY_*` patterns
- **Metrics**: `COMPLETE_METRICS_IMPLEMENTATION.md`
- **Frontend**: `FRONTEND_SITEMAP.md`

### 4. [Guides](./guides/) - Developer Resources (9 files)
Setup guides, testing strategies, and development workflows.

**Available Guides**:
- `DEV_SETUP_GUIDE.md` - Development environment setup
- `DEPLOYMENT*.md` - Deployment procedures
- `QUICK_REFERENCE_TEST_HELPERS.md` - Testing utilities
- `QUICK_START_NEW_TESTS.md` - Test writing quickstart
- `REFACTORED_TESTS_README.md` - Test refactoring guide
- `SHARED_TEST_HELPERS_IMPLEMENTATION.md` - Shared test infrastructure
- `GRAPHQL_TESTS_REFINED.md` - GraphQL testing guide
- `MAKEFILE_ENHANCEMENT.md` - Build system improvements

### 5. [Archived](./archived/) - Historical Documents (60 files)
Outdated or superseded documentation kept for historical reference.

**Categories**:
- Analysis reports (`*_ANALYSIS*.md`)
- Failure investigations (`*_FAILURE*.md`, `BUG_*`)
- Implementation records (`IMPLEMENTATION_*`, `MIGRATION_*`)
- Assessment documents (`*_ASSESSMENT*.md`)
- Various module-specific archived docs

---

## 🔍 Finding Documentation

### By Topic

**Authentication & Authorization**:
- Coverage: `coverage-reports/AUTH_*`
- Architecture: `architecture/DOMAIN_EVENTS_*` (auth events)

**Billing & Payments**:
- Coverage: `coverage-reports/BILLING_*`
- Architecture: `architecture/BILLING_DOMAIN_*`, `architecture/BILLING_CQRS_*`

**Testing & Coverage**:
- Guides: `guides/QUICK_START_NEW_TESTS.md`
- Reports: `coverage-reports/OVERALL_TESTING_STATUS.md`
- Patterns: `coverage-reports/FAKE_*`

**Deployment & Operations**:
- Guides: `guides/DEPLOYMENT*.md`
- Setup: `guides/DEV_SETUP_GUIDE.md`

**Frontend**:
- Architecture: `architecture/FRONTEND_SITEMAP.md`
- Sessions: Various frontend-related session summaries

### By Development Phase

**Phase 1** - Core Platform: `sessions/PHASE1_*`
**Phase 2** - Authentication & Security: `sessions/PHASE2_*`
**Phase 3** - Advanced Features: `sessions/PHASE3_*`
**Phase 4** - Polish & Optimization: `sessions/PHASE4_*`

### By Week

**Week 1**: `sessions/WEEK1_*`
**Week 2**: `sessions/WEEK2_*`
**Week 3**: `sessions/WEEK3_*`
**Week 4**: `sessions/WEEK4_*`

---

## 📊 Coverage Achievement Summary

### Current Status (October 2025)
- **Overall Coverage**: 90%+ achieved
- **Critical Modules**: All at 90%+
- **CI/CD Threshold**: Increased from 80% to 90%
- **Diff Coverage**: 95% for PR changes

### Key Achievements
1. ✅ User Management: 88.27% → 94.14%
2. ✅ Webhooks Delivery: 86.18% → 100%
3. ✅ File Storage: 30.49% → 90.24%
4. ✅ Analytics: Multiple modules to 90%+
5. ✅ Billing: Comprehensive coverage across all submodules

See `coverage-reports/` for detailed module-specific reports.

---

## 🛠️ Development Workflow

### For New Contributors
1. Read `../README.md` - Project overview
2. Read `../CONTRIBUTING.md` - Contribution guidelines
3. Follow `guides/DEV_SETUP_GUIDE.md` - Environment setup
4. Reference `guides/QUICK_START_NEW_TESTS.md` - Write tests

### For Test Development
1. Check `coverage-reports/OVERALL_TESTING_STATUS.md` - Current status
2. Use `guides/QUICK_REFERENCE_TEST_HELPERS.md` - Test utilities
3. Apply `coverage-reports/FAKE_PATTERN_*` - Testing patterns
4. Follow `guides/SHARED_TEST_HELPERS_IMPLEMENTATION.md` - Shared infrastructure

### For Architecture Understanding
1. Review `architecture/COMPLETE_METRICS_IMPLEMENTATION.md` - Metrics system
2. Study `architecture/DOMAIN_EVENTS_*` - Event-driven patterns
3. Explore `architecture/CQRS_*` - CQRS implementation
4. Check `architecture/FRONTEND_SITEMAP.md` - Frontend structure

---

## 🔄 Recent Updates (Last 7 Days)

### October 5, 2025
- ✅ Organized 225+ documentation files into structured directories
- ✅ Increased CI/CD coverage threshold from 80% to 90%
- ✅ Enhanced .gitignore to exclude session summaries and temp files
- ✅ Created comprehensive documentation index
- ✅ Cleaned up root directory (3 essential files only)

### Coverage Milestones
- Dev 2 completed: User Management & Webhooks to 90%+
- All 7 assigned modules achieved 90%+ coverage
- 23 new tests created with 100% pass rate

---

## 📝 Documentation Guidelines

### Creating New Documentation

**Session Summaries** → `sessions/`
- Format: `DEV{N}_SESSION_NAME.md` or `PHASE{N}_*.md`
- Include: Date, objectives, achievements, metrics

**Coverage Reports** → `coverage-reports/`
- Format: `{MODULE}_COVERAGE_*.md`
- Include: Baseline, final coverage, improvements, test details

**Architecture Docs** → `architecture/`
- Format: `{PATTERN}_{DESCRIPTION}.md`
- Include: Diagrams, code examples, implementation guides

**Developer Guides** → `guides/`
- Format: `{TOPIC}_GUIDE.md` or `QUICK_*.md`
- Include: Step-by-step instructions, examples, troubleshooting

### Archiving Old Documentation
- Move superseded docs to `archived/`
- Keep original filenames for traceability
- Update this index when archiving

---

## 🔗 External Resources

### CI/CD
- **GitHub Actions**: `.github/workflows/ci.yml`
- **Coverage Threshold**: 90% (COV_FAIL_UNDER)
- **Diff Coverage**: 95% (DIFF_COV_FAIL_UNDER)

### Code Quality
- **Makefile**: Root `Makefile` - `make format`, `make lint`, `make test`
- **Pyright Config**: `pyrightconfig.json`
- **Package Config**: `package.json` (frontend tools)

---

## 📞 Support

For questions or clarifications about documentation:
1. Check this index for relevant documents
2. Review `CONTRIBUTING.md` for contribution process
3. See `guides/` for development workflows
4. Refer to `architecture/` for design decisions

---

*This index is automatically updated when documentation is reorganized. Last major reorganization: October 5, 2025*
