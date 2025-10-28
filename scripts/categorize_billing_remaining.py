#!/usr/bin/env python3
"""
Categorize remaining unmarked billing test files.

Usage:
    python scripts/categorize_billing_remaining.py
"""

import ast
import subprocess
from pathlib import Path
from typing import Dict, Tuple

# Manual categorization based on file patterns and content analysis
FILE_CATEGORIES: Dict[str, Tuple[str, str]] = {
    # bank_accounts (1 file)
    "test_bank_account_service.py": ("unit", "Mock AsyncSession - bank account CRUD operations"),
    
    # commands (1 file)
    "test_aggregate_handlers.py": ("unit", "Mock DB - domain aggregate command handlers"),
    
    # core (1 file)
    "test_models_real.py": ("unit", "Pydantic model validators and constraints"),
    
    # addons (2 files)
    "test_addon_router_integration.py": ("e2e", "TestClient - addon API endpoints"),
    "test_addon_service_unit.py": ("unit", "Mock AsyncSession - addon service logic"),
    
    # payment_methods (2 files)
    "test_add_update_remove.py": ("integration", "Real AsyncSession - payment method CRUD"),
    "test_list_and_get.py": ("integration", "Real AsyncSession - payment method queries"),
    
    # pricing (2 files)
    "test_cached_pricing_service.py": ("unit", "Mock cache - pricing service with caching"),
    "test_service.py": ("integration", "Real AsyncSession - pricing service core"),
    
    # reports (2 files)
    "test_models_comprehensive.py": ("unit", "Pydantic models for reports"),
    "test_service_comprehensive.py": ("integration", "Real AsyncSession - report generation"),
    
    # unit (2 files - these are in a "unit" directory but may not be unit tests!)
    "test_recovery.py": ("unit", "Error recovery and retry logic"),
    "test_validation.py": ("unit", "Validation rules and constraints"),
    
    # usage (2 files)
    "test_usage_billing_integration.py": ("integration", "Real AsyncSession - usage-based billing"),
    "test_usage_router.py": ("e2e", "TestClient - usage API endpoints"),
    
    # webhooks (2 files)
    "test_webhook_handlers_core.py": ("integration", "Real AsyncSession - webhook handlers"),
    "test_webhooks_router_comprehensive.py": ("e2e", "TestClient - webhooks router comprehensive"),
    
    # main directory (30 files)
    "test_billing_reports.py": ("integration", "Real AsyncSession - billing reports"),
    "test_cache_complete.py": ("unit", "Mock cache - cache layer complete"),
    "test_cache_comprehensive.py": ("unit", "Mock cache - cache layer comprehensive"),
    "test_cache_manager_comprehensive.py": ("unit", "Mock cache - cache manager"),
    "test_command_handlers_comprehensive.py": ("unit", "Mock DB - command handlers"),
    "test_conftest.py": ("unit", "Pytest conftest fixtures and helpers"),
    "test_credit_notes_download.py": ("e2e", "TestClient - credit notes download API"),
    "test_currency_rate_service.py": ("integration", "Real AsyncSession - currency rate service"),
    "test_invoice_import_integration.py": ("integration", "Real AsyncSession - invoice import"),
    "test_metrics_router_comprehensive.py": ("e2e", "TestClient - metrics API endpoints"),
    "test_middleware_complete.py": ("integration", "Real middleware - billing middleware"),
    "test_middleware_comprehensive.py": ("integration", "Real middleware - comprehensive middleware"),
    "test_payment_providers.py": ("unit", "Mock providers - payment provider interfaces"),
    "test_paystack_integration.py": ("integration", "Real Paystack API - payment integration"),
    "test_pdf_generator_basic.py": ("unit", "Mock PDF - PDF generation basics"),
    "test_pdf_generator_comprehensive.py": ("unit", "Mock PDF - comprehensive PDF generation"),
    "test_phase2_endpoints.py": ("e2e", "TestClient - phase 2 API endpoints"),
    "test_receipt_generators.py": ("unit", "Mock PDF - receipt generation"),
    "test_receipt_generators_complete.py": ("unit", "Mock PDF - receipt generation complete"),
    "test_receipts_router.py": ("e2e", "TestClient - receipts API endpoints"),
    "test_reconciliation_integration.py": ("integration", "Real AsyncSession - payment reconciliation"),
    "test_report_generators_complete.py": ("unit", "Mock PDF - report generation"),
    "test_subscription_integration.py": ("integration", "Real AsyncSession - subscription workflows"),
    "test_subscription_invoice_integration.py": ("integration", "Real AsyncSession - subscription invoicing"),
    "test_subscription_load.py": ("integration", "Load testing - subscription performance"),
    "test_subscription_payment_integration.py": ("integration", "Real AsyncSession - subscription payments"),
    "test_subscription_webhooks.py": ("integration", "Real webhooks - subscription webhook handlers"),
    "test_subscription_workflows.py": ("integration", "Real AsyncSession - subscription workflows"),
    "test_todo_fixes.py": ("unit", "Mock - pending bug fixes and TODOs"),
    "test_webhook_handlers.py": ("integration", "Real webhooks - webhook handlers"),
}


def analyze_file_with_ast(file_path: Path) -> Dict[str, any]:
    """Analyze a test file using AST to detect patterns."""
    try:
        with open(file_path, 'r') as f:
            content = f.read()
            tree = ast.parse(content)
    except (SyntaxError, FileNotFoundError):
        return {"error": True}
    
    has_test_client = False
    has_async_session = False
    has_async_mock = False
    imports_integration = False
    
    for node in ast.walk(tree):
        if isinstance(node, ast.ImportFrom):
            if node.module and 'TestClient' in str(node.names):
                has_test_client = True
            if node.module and 'AsyncSession' in str(node.names):
                has_async_session = True
        
        if isinstance(node, ast.Name):
            if node.id == 'AsyncMock':
                has_async_mock = True
    
    return {
        "has_test_client": has_test_client,
        "has_async_session": has_async_session,
        "has_async_mock": has_async_mock,
    }


def main():
    """Categorize all unmarked billing files."""
    print("Billing Test File Categorization")
    print("=" * 80)
    print()
    
    # Organize by category
    by_category = {"unit": [], "integration": [], "e2e": []}
    
    for filename, (category, reason) in sorted(FILE_CATEGORIES.items()):
        by_category[category].append((filename, reason))
    
    # Print categorization
    print(f"UNIT TESTS ({len(by_category['unit'])} files):")
    print("-" * 80)
    for filename, reason in by_category['unit']:
        print(f"  {filename}")
        print(f"    → {reason}")
    print()
    
    print(f"INTEGRATION TESTS ({len(by_category['integration'])} files):")
    print("-" * 80)
    for filename, reason in by_category['integration']:
        print(f"  {filename}")
        print(f"    → {reason}")
    print()
    
    print(f"E2E TESTS ({len(by_category['e2e'])} files):")
    print("-" * 80)
    for filename, reason in by_category['e2e']:
        print(f"  {filename}")
        print(f"    → {reason}")
    print()
    
    # Summary
    total = len(FILE_CATEGORIES)
    print("=" * 80)
    print(f"SUMMARY: {total} files categorized")
    print(f"  Unit: {len(by_category['unit'])} ({len(by_category['unit'])/total*100:.1f}%)")
    print(f"  Integration: {len(by_category['integration'])} ({len(by_category['integration'])/total*100:.1f}%)")
    print(f"  E2E: {len(by_category['e2e'])} ({len(by_category['e2e'])/total*100:.1f}%)")
    print()
    
    # Generate commands
    print("COMMANDS TO APPLY MARKERS:")
    print("=" * 80)
    
    # Unit tests - class-based
    unit_files = [f"tests/billing/**/{fn}" for fn, _ in by_category['unit']]
    print(f"\n# Unit tests ({len(unit_files)} files):")
    for fn, _ in by_category['unit']:
        # Find actual path
        result = subprocess.run(['find', 'tests/billing', '-name', fn], capture_output=True, text=True)
        if result.stdout.strip():
            path = result.stdout.strip()
            print(f"python scripts/batch_add_markers.py --marker unit {path}")
    
    # Integration tests
    integration_files = [f"tests/billing/**/{fn}" for fn, _ in by_category['integration']]
    print(f"\n# Integration tests ({len(integration_files)} files):")
    for fn, _ in by_category['integration']:
        result = subprocess.run(['find', 'tests/billing', '-name', fn], capture_output=True, text=True)
        if result.stdout.strip():
            path = result.stdout.strip()
            print(f"python scripts/batch_add_markers.py --marker integration {path}")
    
    # E2E tests
    e2e_files = [f"tests/billing/**/{fn}" for fn, _ in by_category['e2e']]
    print(f"\n# E2E tests ({len(e2e_files)} files):")
    for fn, _ in by_category['e2e']:
        result = subprocess.run(['find', 'tests/billing', '-name', fn], capture_output=True, text=True)
        if result.stdout.strip():
            path = result.stdout.strip()
            print(f"python scripts/batch_add_markers.py --marker e2e {path}")


if __name__ == "__main__":
    main()
