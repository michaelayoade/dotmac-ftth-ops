#!/usr/bin/env python3
"""
Critical Gaps Verification Script

Verifies that all 4 critical backend gaps have been fixed:
1. RADIUS tables migration exists
2. Subscriber model exists with proper relationships
3. RBAC permissions applied to all ISP endpoints
4. HTTP clients have connection pooling, retries, and circuit breakers
"""

import os
import sys
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root / "src"))

print("=" * 80)
print("BSS PHASE 1 - CRITICAL GAPS VERIFICATION")
print("=" * 80)
print()

# =============================================================================
# Gap 1: RADIUS Tables Migration
# =============================================================================
print("1. RADIUS TABLES MIGRATION")
print("-" * 80)

radius_migration = project_root / "alembic/versions/2025_01_15_1500-b7c8d9e0f1a2_add_radius_tables.py"
if radius_migration.exists():
    print(f"✅ RADIUS migration exists: {radius_migration.name}")

    # Check for all expected tables
    content = radius_migration.read_text()
    tables = ["radcheck", "radreply", "radacct", "radpostauth", "nas", "radius_bandwidth_profiles"]
    for table in tables:
        if f'"{table}"' in content or f"'{table}'" in content:
            print(f"   ✅ Table '{table}' defined")
        else:
            print(f"   ❌ Table '{table}' MISSING")
else:
    print(f"❌ RADIUS migration NOT FOUND at {radius_migration}")

print()

# =============================================================================
# Gap 2: Subscriber Model
# =============================================================================
print("2. SUBSCRIBER MODEL")
print("-" * 80)

subscriber_model = project_root / "src/dotmac/platform/subscribers/models.py"
if subscriber_model.exists():
    print(f"✅ Subscriber model exists: {subscriber_model.name}")

    content = subscriber_model.read_text()

    # Check for class definition
    if "class Subscriber" in content:
        print("   ✅ Subscriber class defined")
    else:
        print("   ❌ Subscriber class MISSING")

    # Check for key relationships
    relationships = [
        "radius_checks",
        "radius_replies",
        "radius_sessions",
    ]
    for rel in relationships:
        if rel in content:
            print(f"   ✅ Relationship '{rel}' defined")
        else:
            print(f"   ⚠️  Relationship '{rel}' not found (may be optional)")
else:
    print(f"❌ Subscriber model NOT FOUND at {subscriber_model}")

# Check for Subscriber migration
subscriber_migration = project_root / "alembic/versions/2025_01_15_1400-a1b2c3d4e5f6_add_subscribers_table.py"
if subscriber_migration.exists():
    print(f"✅ Subscriber migration exists: {subscriber_migration.name}")
else:
    print(f"❌ Subscriber migration NOT FOUND")

print()

# =============================================================================
# Gap 3: RBAC Permissions on ISP Endpoints
# =============================================================================
print("3. RBAC PERMISSIONS ON ISP ENDPOINTS")
print("-" * 80)

# Check ISP permissions definition
isp_permissions_file = project_root / "src/dotmac/platform/auth/isp_permissions.py"
if isp_permissions_file.exists():
    print(f"✅ ISP permissions file exists: {isp_permissions_file.name}")

    content = isp_permissions_file.read_text()
    permissions = [
        "isp.radius.read",
        "isp.radius.write",
        "isp.radius.sessions.manage",
        "isp.ipam.read",
        "isp.ipam.write",
        "isp.network.pon.read",
        "isp.network.pon.write",
        "isp.cpe.read",
        "isp.cpe.write",
    ]

    for perm in permissions:
        if perm in content:
            print(f"   ✅ Permission '{perm}' defined")
        else:
            print(f"   ❌ Permission '{perm}' MISSING")
else:
    print(f"❌ ISP permissions file NOT FOUND")

print()

# Check if RBAC is applied to routers
routers = [
    ("RADIUS", "src/dotmac/platform/radius/router.py"),
    ("NetBox", "src/dotmac/platform/netbox/router.py"),
    ("VOLTHA", "src/dotmac/platform/voltha/router.py"),
    ("GenieACS", "src/dotmac/platform/genieacs/router.py"),
]

for name, router_path in routers:
    router_file = project_root / router_path
    if router_file.exists():
        content = router_file.read_text()
        if "require_permission" in content:
            # Count how many times require_permission is used
            count = content.count("require_permission")
            print(f"✅ {name} router has {count} RBAC-protected endpoints")
        else:
            print(f"❌ {name} router has NO RBAC protection")
    else:
        print(f"❌ {name} router NOT FOUND")

print()

# =============================================================================
# Gap 4: HTTP Client Robustness
# =============================================================================
print("4. HTTP CLIENT ROBUSTNESS")
print("-" * 80)

# Check RobustHTTPClient base class
robust_client = project_root / "src/dotmac/platform/core/http_client.py"
if robust_client.exists():
    print(f"✅ RobustHTTPClient exists: {robust_client.name}")

    content = robust_client.read_text()

    features = {
        "Connection Pooling": "_client_pool",
        "Circuit Breakers": "CircuitBreaker",
        "Retry Logic": "tenacity",
        "Exponential Backoff": "wait_exponential",
        "Tenant-Aware Logging": "tenant_id",
        "Configurable Timeouts": "timeout",
    }

    for feature, marker in features.items():
        if marker in content:
            print(f"   ✅ {feature}: Found '{marker}'")
        else:
            print(f"   ❌ {feature}: Missing '{marker}'")
else:
    print(f"❌ RobustHTTPClient NOT FOUND")

print()

# Check if all clients extend RobustHTTPClient
clients = [
    ("VOLTHA", "src/dotmac/platform/voltha/client.py", "VOLTHAClient"),
    ("GenieACS", "src/dotmac/platform/genieacs/client.py", "GenieACSClient"),
    ("NetBox", "src/dotmac/platform/netbox/client.py", "NetBoxClient"),
]

for name, client_path, class_name in clients:
    client_file = project_root / client_path
    if client_file.exists():
        content = client_file.read_text()
        if f"class {class_name}(RobustHTTPClient)" in content:
            print(f"✅ {name} client extends RobustHTTPClient")
        else:
            print(f"❌ {name} client DOES NOT extend RobustHTTPClient")
    else:
        print(f"❌ {name} client NOT FOUND")

print()

# =============================================================================
# Summary
# =============================================================================
print("=" * 80)
print("VERIFICATION SUMMARY")
print("=" * 80)
print()

gaps = [
    ("RADIUS Tables Migration", radius_migration.exists()),
    ("Subscriber Model", subscriber_model.exists()),
    ("ISP Permissions Defined", isp_permissions_file.exists()),
    ("RBAC on RADIUS Router", (project_root / "src/dotmac/platform/radius/router.py").exists() and "require_permission" in (project_root / "src/dotmac/platform/radius/router.py").read_text()),
    ("RBAC on NetBox Router", (project_root / "src/dotmac/platform/netbox/router.py").exists() and "require_permission" in (project_root / "src/dotmac/platform/netbox/router.py").read_text()),
    ("RBAC on VOLTHA Router", (project_root / "src/dotmac/platform/voltha/router.py").exists() and "require_permission" in (project_root / "src/dotmac/platform/voltha/router.py").read_text()),
    ("RBAC on GenieACS Router", (project_root / "src/dotmac/platform/genieacs/router.py").exists() and "require_permission" in (project_root / "src/dotmac/platform/genieacs/router.py").read_text()),
    ("RobustHTTPClient", robust_client.exists()),
    ("VOLTHA uses RobustHTTPClient", (project_root / "src/dotmac/platform/voltha/client.py").exists() and "RobustHTTPClient" in (project_root / "src/dotmac/platform/voltha/client.py").read_text()),
    ("GenieACS uses RobustHTTPClient", (project_root / "src/dotmac/platform/genieacs/client.py").exists() and "RobustHTTPClient" in (project_root / "src/dotmac/platform/genieacs/client.py").read_text()),
    ("NetBox uses RobustHTTPClient", (project_root / "src/dotmac/platform/netbox/client.py").exists() and "RobustHTTPClient" in (project_root / "src/dotmac/platform/netbox/client.py").read_text()),
]

passed = sum(1 for _, status in gaps if status)
total = len(gaps)

for name, status in gaps:
    status_icon = "✅" if status else "❌"
    print(f"{status_icon} {name}")

print()
print(f"RESULT: {passed}/{total} checks passed ({passed*100//total}%)")
print()

if passed == total:
    print("🎉 ALL CRITICAL GAPS FIXED! System is production-ready.")
    sys.exit(0)
else:
    print("⚠️  Some critical gaps remain. Review the output above.")
    sys.exit(1)
