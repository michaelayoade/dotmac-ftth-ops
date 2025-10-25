#!/usr/bin/env python3
"""
Test CoA operations for all supported NAS vendors.

This script tests bandwidth change and disconnect operations
for each vendor type to verify vendor-specific packet construction.

Usage:
    python scripts/radius/test_vendor_coa.py --vendor mikrotik --username test@example.com
    python scripts/radius/test_vendor_coa.py --all  # Test all vendors
"""

import argparse
import asyncio
import sys
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

import structlog
from dotmac.platform.radius.coa_client import CoAClient
from dotmac.platform.radius.vendors import NASVendor, get_coa_strategy
from dotmac.platform.settings import settings

logger = structlog.get_logger(__name__)


async def test_bandwidth_change(vendor: str, username: str, nas_ip: str) -> dict:
    """
    Test bandwidth change CoA for a specific vendor.

    Args:
        vendor: NAS vendor type
        username: Test username
        nas_ip: NAS IP address

    Returns:
        Test result dictionary
    """
    logger.info(f"Testing bandwidth change for {vendor}", vendor=vendor, username=username)

    # Get vendor-specific strategy
    strategy = get_coa_strategy(vendor=vendor)

    # Build test packet
    packet = strategy.build_bandwidth_change_packet(
        username=username,
        download_kbps=10000,  # 10 Mbps
        upload_kbps=5000,     # 5 Mbps
        download_burst_kbps=15000,  # 15 Mbps
        upload_burst_kbps=7500,     # 7.5 Mbps
        nas_ip=nas_ip,
    )

    logger.info(
        "Built CoA packet",
        vendor=vendor,
        packet_attributes=list(packet.keys()),
        packet=packet,
    )

    # Initialize CoA client
    coa_client = CoAClient(
        radius_server=settings.radius.server_host,
        coa_port=settings.radius.coa_port,
        radius_secret=settings.radius.shared_secret,
    )

    # Send CoA (if enabled)
    if settings.features.radius_enabled:
        try:
            result = await coa_client.change_bandwidth(
                username=username,
                download_kbps=10000,
                upload_kbps=5000,
                download_burst_kbps=15000,
                upload_burst_kbps=7500,
                nas_ip=nas_ip,
                nas_vendor=vendor,
            )

            logger.info(
                "CoA result",
                vendor=vendor,
                success=result.get("success"),
                message=result.get("message"),
            )

            return {
                "vendor": vendor,
                "operation": "bandwidth_change",
                "success": result.get("success"),
                "message": result.get("message"),
                "packet": packet,
            }
        except Exception as e:
            logger.error(
                "CoA failed",
                vendor=vendor,
                error=str(e),
                exc_info=True,
            )
            return {
                "vendor": vendor,
                "operation": "bandwidth_change",
                "success": False,
                "message": str(e),
                "packet": packet,
            }
    else:
        logger.warning("RADIUS is disabled, showing packet only")
        return {
            "vendor": vendor,
            "operation": "bandwidth_change",
            "success": None,
            "message": "RADIUS disabled - dry run only",
            "packet": packet,
        }


async def test_disconnect(vendor: str, username: str, nas_ip: str) -> dict:
    """
    Test disconnect CoA for a specific vendor.

    Args:
        vendor: NAS vendor type
        username: Test username
        nas_ip: NAS IP address

    Returns:
        Test result dictionary
    """
    logger.info(f"Testing disconnect for {vendor}", vendor=vendor, username=username)

    # Get vendor-specific strategy
    strategy = get_coa_strategy(vendor=vendor)

    # Build test packet
    packet = strategy.build_disconnect_packet(
        username=username,
        nas_ip=nas_ip,
        session_id="test-session-123",
    )

    logger.info(
        "Built disconnect packet",
        vendor=vendor,
        packet_attributes=list(packet.keys()),
        packet=packet,
    )

    # Initialize CoA client
    coa_client = CoAClient(
        radius_server=settings.radius.server_host,
        coa_port=settings.radius.coa_port,
        radius_secret=settings.radius.shared_secret,
    )

    # Send disconnect (if enabled and not dry-run)
    if settings.features.radius_enabled:
        logger.warning(
            "Disconnect test skipped",
            reason="Would terminate live session",
            vendor=vendor,
        )
        return {
            "vendor": vendor,
            "operation": "disconnect",
            "success": None,
            "message": "Skipped - would terminate live session",
            "packet": packet,
        }
    else:
        return {
            "vendor": vendor,
            "operation": "disconnect",
            "success": None,
            "message": "RADIUS disabled - dry run only",
            "packet": packet,
        }


async def test_vendor(vendor: str, username: str, nas_ip: str) -> list[dict]:
    """
    Test all CoA operations for a vendor.

    Args:
        vendor: NAS vendor type
        username: Test username
        nas_ip: NAS IP address

    Returns:
        List of test results
    """
    results = []

    # Test bandwidth change
    bw_result = await test_bandwidth_change(vendor, username, nas_ip)
    results.append(bw_result)

    # Test disconnect
    disc_result = await test_disconnect(vendor, username, nas_ip)
    results.append(disc_result)

    return results


async def main():
    """Main test runner."""
    parser = argparse.ArgumentParser(description="Test CoA operations for NAS vendors")
    parser.add_argument(
        "--vendor",
        choices=["mikrotik", "cisco", "huawei", "juniper", "all"],
        default="mikrotik",
        help="NAS vendor to test (default: mikrotik)",
    )
    parser.add_argument(
        "--username",
        default="test@example.com",
        help="Test username (default: test@example.com)",
    )
    parser.add_argument(
        "--nas-ip",
        default="127.0.0.1",
        help="NAS IP address (default: 127.0.0.1)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Only show packets without sending",
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

    # Determine which vendors to test
    if args.vendor == "all":
        vendors = ["mikrotik", "cisco", "huawei", "juniper"]
    else:
        vendors = [args.vendor]

    # Run tests
    all_results = []
    for vendor in vendors:
        logger.info(f"\n{'='*60}")
        logger.info(f"Testing vendor: {vendor.upper()}")
        logger.info(f"{'='*60}\n")

        results = await test_vendor(vendor, args.username, args.nas_ip)
        all_results.extend(results)

        # Print summary
        print(f"\n{vendor.upper()} Summary:")
        print("-" * 60)
        for result in results:
            status = "✓" if result["success"] else "✗" if result["success"] is False else "⊘"
            print(f"  {status} {result['operation']}: {result['message']}")
            print(f"    Attributes: {', '.join(result['packet'].keys())}")
        print()

    # Overall summary
    print("\n" + "=" * 60)
    print("OVERALL TEST SUMMARY")
    print("=" * 60)

    vendor_results = {}
    for result in all_results:
        vendor = result["vendor"]
        if vendor not in vendor_results:
            vendor_results[vendor] = {"total": 0, "success": 0, "failed": 0, "skipped": 0}

        vendor_results[vendor]["total"] += 1
        if result["success"] is True:
            vendor_results[vendor]["success"] += 1
        elif result["success"] is False:
            vendor_results[vendor]["failed"] += 1
        else:
            vendor_results[vendor]["skipped"] += 1

    for vendor, stats in vendor_results.items():
        print(f"\n{vendor.upper()}:")
        print(f"  Total tests:   {stats['total']}")
        print(f"  ✓ Success:     {stats['success']}")
        print(f"  ✗ Failed:      {stats['failed']}")
        print(f"  ⊘ Skipped:     {stats['skipped']}")

    print("\n" + "=" * 60)

    # Return exit code based on results
    total_failed = sum(stats["failed"] for stats in vendor_results.values())
    sys.exit(0 if total_failed == 0 else 1)


if __name__ == "__main__":
    asyncio.run(main())
