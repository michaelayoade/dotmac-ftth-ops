#!/usr/bin/env python3
"""
NAS Vendor Detection Helper Script

Analyzes existing NAS devices and suggests vendor classifications
based on names, types, and SNMP information.

Usage:
    python scripts/radius/detect_nas_vendors.py
    python scripts/radius/detect_nas_vendors.py --tenant tenant-123
    python scripts/radius/detect_nas_vendors.py --output report.json
"""

import argparse
import asyncio
import json
import re
import sys
from pathlib import Path
from typing import Any

# Add project root to path
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine

from dotmac.platform.radius.models import NAS
from dotmac.platform.radius.vendors import NASVendor
from dotmac.platform.settings import settings

logger = structlog.get_logger(__name__)


# Vendor detection patterns
VENDOR_PATTERNS = {
    NASVendor.MIKROTIK: {
        "shortname": [r"mikrotik", r"mtk", r"rb\d+", r"ccr\d+", r"hap", r"hex"],
        "type": [r"mikrotik"],
        "nasname": [r"mikrotik"],
        "models": {
            r"ccr": "CCR Series",
            r"rb\d+": "RouterBoard",
            r"hap": "hAP Series",
            r"hex": "hEX Series",
        },
    },
    NASVendor.CISCO: {
        "shortname": [r"cisco", r"asr\d+", r"isr\d+", r"ncs", r"cat\d+", r"me\d+"],
        "type": [r"cisco"],
        "nasname": [r"cisco"],
        "models": {
            r"asr9": "ASR9000",
            r"asr1": "ASR1000",
            r"isr4": "ISR4000",
            r"ncs": "NCS Series",
            r"cat": "Catalyst",
            r"me": "ME Series",
        },
    },
    NASVendor.HUAWEI: {
        "shortname": [r"huawei", r"ma\d+", r"ne\d+", r"cx\d+", r"s\d+"],
        "type": [r"huawei"],
        "nasname": [r"huawei"],
        "description": [r"huawei"],
        "models": {
            r"ma5800": "MA5800-X Series",
            r"ma5600": "MA5600T",
            r"ne40": "NE40E",
            r"ne5": "NE5000E",
            r"cx600": "CX600",
        },
    },
    NASVendor.JUNIPER: {
        "shortname": [r"juniper", r"mx\d+", r"ex\d+", r"qfx\d+", r"srx\d+"],
        "type": [r"juniper", r"junos"],
        "nasname": [r"juniper"],
        "models": {
            r"mx960": "MX960",
            r"mx480": "MX480",
            r"mx240": "MX240",
            r"mx": "MX Series",
            r"ex": "EX Series",
            r"qfx": "QFX Series",
            r"srx": "SRX Series",
        },
    },
}


def detect_vendor(nas: NAS) -> tuple[str, float, str]:
    """
    Detect vendor for a NAS device.

    Args:
        nas: NAS model instance

    Returns:
        Tuple of (vendor, confidence, reason)
    """
    # Check each vendor pattern
    best_match = (NASVendor.GENERIC, 0.0, "No pattern matched")

    for vendor, patterns in VENDOR_PATTERNS.items():
        confidence = 0.0
        reasons = []

        # Check shortname patterns
        if "shortname" in patterns and nas.shortname:
            for pattern in patterns["shortname"]:
                if re.search(pattern, nas.shortname.lower()):
                    confidence += 0.4
                    reasons.append(f"shortname matches '{pattern}'")
                    break

        # Check type patterns
        if "type" in patterns and nas.type:
            for pattern in patterns["type"]:
                if re.search(pattern, nas.type.lower()):
                    confidence += 0.3
                    reasons.append(f"type matches '{pattern}'")
                    break

        # Check nasname patterns
        if "nasname" in patterns and nas.nasname:
            for pattern in patterns["nasname"]:
                if re.search(pattern, nas.nasname.lower()):
                    confidence += 0.2
                    reasons.append(f"nasname matches '{pattern}'")
                    break

        # Check description patterns
        if "description" in patterns and nas.description:
            for pattern in patterns["description"]:
                if re.search(pattern, nas.description.lower()):
                    confidence += 0.1
                    reasons.append(f"description matches '{pattern}'")
                    break

        # Update best match
        if confidence > best_match[1]:
            reason = " | ".join(reasons) if reasons else "Pattern match"
            best_match = (vendor, confidence, reason)

    return best_match


def detect_model(nas: NAS, vendor: NASVendor) -> str | None:
    """
    Detect model for a NAS device.

    Args:
        nas: NAS model instance
        vendor: Detected vendor

    Returns:
        Model string or None
    """
    if vendor not in VENDOR_PATTERNS:
        return None

    patterns = VENDOR_PATTERNS[vendor]
    if "models" not in patterns:
        return None

    # Check shortname for model patterns
    if nas.shortname:
        for pattern, model_name in patterns["models"].items():
            if re.search(pattern, nas.shortname.lower()):
                return model_name

    return None


async def analyze_nas_devices(tenant_id: str | None = None) -> list[dict[str, Any]]:
    """
    Analyze NAS devices and suggest vendor classifications.

    Args:
        tenant_id: Optional tenant filter

    Returns:
        List of analysis results
    """
    # Create database engine
    engine = create_async_engine(
        settings.database_url,
        echo=False,
    )

    results = []

    async with engine.begin() as conn:
        # Query NAS devices
        query = select(NAS)
        if tenant_id:
            query = query.where(NAS.tenant_id == tenant_id)

        result = await conn.execute(query)
        nas_devices = result.scalars().all()

        logger.info(f"Analyzing {len(nas_devices)} NAS devices")

        # Analyze each device
        for nas in nas_devices:
            detected_vendor, confidence, reason = detect_vendor(nas)
            detected_model = detect_model(nas, detected_vendor)

            # Check if vendor already set correctly
            current_vendor = getattr(nas, "vendor", None) or "mikrotik"
            vendor_changed = current_vendor != detected_vendor

            analysis = {
                "id": nas.id,
                "tenant_id": nas.tenant_id,
                "shortname": nas.shortname,
                "nasname": nas.nasname,
                "type": nas.type,
                "current_vendor": current_vendor,
                "current_model": getattr(nas, "model", None),
                "detected_vendor": detected_vendor,
                "detected_model": detected_model,
                "confidence": confidence,
                "reason": reason,
                "needs_update": vendor_changed or (
                    detected_model and not getattr(nas, "model", None)
                ),
                "suggested_sql": None,
            }

            # Generate SQL if update needed
            if analysis["needs_update"]:
                sql_parts = [f"UPDATE nas SET vendor = '{detected_vendor}'"]
                if detected_model:
                    sql_parts.append(f", model = '{detected_model}'")
                sql_parts.append(f" WHERE id = {nas.id};")
                analysis["suggested_sql"] = "".join(sql_parts)

            results.append(analysis)

    await engine.dispose()
    return results


def print_analysis_report(results: list[dict[str, Any]]) -> None:
    """
    Print analysis report to console.

    Args:
        results: Analysis results
    """
    print("\n" + "=" * 80)
    print("NAS VENDOR DETECTION REPORT")
    print("=" * 80 + "\n")

    # Summary statistics
    total = len(results)
    needs_update = sum(1 for r in results if r["needs_update"])
    by_vendor = {}

    for result in results:
        vendor = result["detected_vendor"]
        by_vendor[vendor] = by_vendor.get(vendor, 0) + 1

    print("Summary:")
    print(f"  Total NAS devices: {total}")
    print(f"  Devices needing update: {needs_update}")
    print("\nVendor distribution:")
    for vendor, count in sorted(by_vendor.items(), key=lambda x: x[1], reverse=True):
        print(f"  {vendor}: {count}")

    # Detailed results
    print("\n" + "-" * 80)
    print("DETAILED ANALYSIS")
    print("-" * 80 + "\n")

    for result in results:
        if result["needs_update"]:
            status = "⚠ NEEDS UPDATE"
        else:
            status = "✓ OK"

        print(f"{status} | {result['shortname']} ({result['nasname']})")
        print(f"  Current: {result['current_vendor']} / {result['current_model'] or 'N/A'}")
        print(f"  Detected: {result['detected_vendor']} / {result['detected_model'] or 'N/A'}")
        print(f"  Confidence: {result['confidence']:.1%}")
        print(f"  Reason: {result['reason']}")

        if result["suggested_sql"]:
            print(f"  SQL: {result['suggested_sql']}")
        print()

    # Generate update script
    if needs_update > 0:
        print("\n" + "=" * 80)
        print("SUGGESTED UPDATE SCRIPT")
        print("=" * 80 + "\n")
        print("BEGIN;")
        for result in results:
            if result["needs_update"] and result["suggested_sql"]:
                print(result["suggested_sql"])
        print("COMMIT;")


async def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(description="Detect NAS vendor types")
    parser.add_argument(
        "--tenant",
        help="Filter by tenant ID",
    )
    parser.add_argument(
        "--output",
        help="Output JSON file path",
    )
    parser.add_argument(
        "--format",
        choices=["console", "json", "sql"],
        default="console",
        help="Output format (default: console)",
    )

    args = parser.parse_args()

    # Configure logging
    structlog.configure(
        wrapper_class=structlog.BoundLogger,
        processors=[
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.dev.ConsoleRenderer(),
        ],
    )

    # Analyze NAS devices
    results = await analyze_nas_devices(tenant_id=args.tenant)

    # Output results
    if args.format == "console":
        print_analysis_report(results)
    elif args.format == "json":
        output = json.dumps(results, indent=2)
        if args.output:
            Path(args.output).write_text(output)
            logger.info(f"Results written to {args.output}")
        else:
            print(output)
    elif args.format == "sql":
        print("BEGIN;")
        for result in results:
            if result["needs_update"] and result["suggested_sql"]:
                print(result["suggested_sql"])
        print("COMMIT;")


if __name__ == "__main__":
    asyncio.run(main())
