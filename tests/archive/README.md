# Test Archive

This directory contains deprecated, backup, and disabled test files that are no longer actively used in the test suite.

## Contents

### Backup Files (*.bak)
Test files that were replaced or refactored. Kept temporarily for reference during migration.

### Disabled Files (*.disabled)
Tests that are temporarily disabled due to:
- External service dependencies not available in CI
- Performance issues (too slow for regular CI runs)
- Work-in-progress refactoring

### Old Files (*.old)
Legacy test files superseded by newer implementations.

## Policy

- **Retention**: Files are kept for 90 days after archival
- **Deletion**: After 90 days, files may be permanently deleted if no longer needed
- **Restoration**: If a test needs to be restored, check git history or move from archive

## Archived Files

Last updated: 2025-10-10

Files moved from active test suite to archive during test consolidation project.
See `docs/TEST_ORGANIZATION.md` for details on the consolidation strategy.
