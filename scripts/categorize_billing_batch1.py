#!/usr/bin/env python3
"""
Categorize strategic batch of billing test files (Batch 1: Core functionality).

Focus on: invoices, payments, subscriptions, money, models
"""

from pathlib import Path


def categorize_file(filename: str) -> tuple[str, str]:
    """Categorize based on filename patterns."""
    name_lower = filename.lower()

    # E2E: Router and full integration tests
    if any(x in name_lower for x in ["router", "e2e"]):
        return "e2e", "high"

    # Unit: Models, utils, unit in name
    if any(x in name_lower for x in ["_unit", "models", "utils", "exceptions", "events", "mappers", "config"]):
        return "unit", "high"

    # Integration: service, integration in name
    if any(x in name_lower for x in ["integration", "service"]) and "_unit" not in name_lower:
        return "integration", "high"

    # Default to integration
    return "integration", "medium"


def main():
    # Strategic batch 1: Core billing functionality
    batch1_files = [
        "test_invoice_service_unit.py",
        "test_invoice_integration.py",
        "test_payment_service_unit.py",
        "test_payment_integration.py",
        "test_subscription_service_unit.py",
        "test_subscription_e2e.py",
        "test_money_models.py",
        "test_money_utils.py",
        "test_pricing_models.py",
        "test_currency_utils.py",
        "test_billing_router_integration.py",
        "test_events.py",
        "test_credit_notes_service.py",
        "test_config_comprehensive.py",
        "test_exceptions_comprehensive.py",
        "test_mappers.py",
    ]

    unit_files = []
    integration_files = []
    e2e_files = []

    for filename in batch1_files:
        category, confidence = categorize_file(filename)

        if category == "unit":
            unit_files.append((filename, confidence))
        elif category == "integration":
            integration_files.append((filename, confidence))
        elif category == "e2e":
            e2e_files.append((filename, confidence))

    print("=" * 70)
    print("BILLING MODULE - BATCH 1 CATEGORIZATION (Core Functionality)")
    print("=" * 70)

    print(f"\n📊 UNIT TESTS ({len(unit_files)} files):")
    print("-" * 70)
    for filename, confidence in unit_files:
        print(f"  • {filename:<50} [{confidence} confidence]")

    print(f"\n🔗 INTEGRATION TESTS ({len(integration_files)} files):")
    print("-" * 70)
    for filename, confidence in integration_files:
        print(f"  • {filename:<50} [{confidence} confidence]")

    print(f"\n🌐 E2E TESTS ({len(e2e_files)} files):")
    print("-" * 70)
    for filename, confidence in e2e_files:
        print(f"  • {filename:<50} [{confidence} confidence]")

    print("\n" + "=" * 70)
    print(f"BATCH 1 SUMMARY: {len(unit_files)} unit, {len(integration_files)} integration, {len(e2e_files)} e2e")
    print(f"TOTAL FILES: {len(batch1_files)}")
    print("=" * 70)

    # Generate commands
    print("\n📋 COMMANDS TO APPLY MARKERS:")
    print("-" * 70)

    if unit_files:
        print("\n# Unit tests:")
        files_str = " ".join([f"tests/billing/{f}" for f, _ in unit_files])
        print(f"python scripts/batch_add_markers.py --marker unit {files_str}")

    if integration_files:
        print("\n# Integration tests:")
        files_str = " ".join([f"tests/billing/{f}" for f, _ in integration_files])
        print(f"python scripts/batch_add_markers.py --marker integration {files_str}")

    if e2e_files:
        print("\n# E2E tests:")
        files_str = " ".join([f"tests/billing/{f}" for f, _ in e2e_files])
        print(f"python scripts/batch_add_markers.py --marker e2e {files_str}")


if __name__ == "__main__":
    main()
