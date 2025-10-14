#!/usr/bin/env python
"""Seed per-tenant OSS configuration values.

Usage examples:

    # Apply overrides from JSON file
    ./scripts/seed_tenant_oss.py --tenant-slug default-org --config-file tenant_oss.json

    # Set individual values via CLI flags
    ./scripts/seed_tenant_oss.py --tenant-id <uuid> --service netbox \
        --set url=https://netbox.example.com --set api_token=TOKEN123

    # Clear overrides for a tenant
    ./scripts/seed_tenant_oss.py --tenant-slug default-org --service genieacs --clear
"""

from __future__ import annotations

import argparse
import asyncio
import json
from pathlib import Path
from typing import Any

from sqlalchemy import select

from dotmac.platform.db import AsyncSessionLocal
from dotmac.platform.tenant.models import Tenant
from dotmac.platform.tenant.oss_config import (
    OSSService,
    update_service_config,
    reset_service_config,
)


def _parse_value(raw: str) -> Any:
    """Parse CLI key=value entries into native types."""
    lowered = raw.lower()
    if lowered in {"none", "null", ""}:
        return None
    if lowered in {"true", "false"}:
        return lowered == "true"
    try:
        # Attempt JSON parsing (covers numbers, floats, quoted strings, objects)
        return json.loads(raw)
    except json.JSONDecodeError:
        return raw


async def _load_tenant(session, *, tenant_id: str | None, tenant_slug: str | None) -> Tenant:
    if tenant_id:
        tenant = await session.get(Tenant, tenant_id)
    else:
        stmt = select(Tenant).where(Tenant.slug == tenant_slug)
        result = await session.execute(stmt)
        tenant = result.scalars().first()

    if not tenant:
        identifier = tenant_id or tenant_slug
        raise SystemExit(f"❌ Tenant '{identifier}' not found")

    return tenant


async def main() -> None:
    parser = argparse.ArgumentParser(description="Seed tenant OSS configuration")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--tenant-id", help="Tenant UUID")
    group.add_argument("--tenant-slug", help="Tenant slug")

    parser.add_argument(
        "--config-file",
        type=Path,
        help="JSON file containing per-service overrides",
    )
    parser.add_argument(
        "--service",
        choices=[service.value for service in OSSService],
        help="Target service for inline overrides or clearing",
    )
    parser.add_argument(
        "--set",
        action="append",
        metavar="key=value",
        help="Inline override(s) when --service is specified",
    )
    parser.add_argument(
        "--clear",
        action="store_true",
        help="Clear overrides for the specified service (or all services when used with --config-file only)",
    )

    args = parser.parse_args()

    if args.config_file and not args.config_file.exists():
        raise SystemExit(f"❌ Config file '{args.config_file}' does not exist")

    if args.set and not args.service:
        raise SystemExit("❌ --set requires --service")

    async with AsyncSessionLocal() as session:
        tenant = await _load_tenant(session, tenant_id=args.tenant_id, tenant_slug=args.tenant_slug)

        if args.config_file:
            with args.config_file.open("r", encoding="utf-8") as fh:
                file_overrides = json.load(fh)

            for service_name, payload in file_overrides.items():
                try:
                    service = OSSService(service_name)
                except ValueError:
                    raise SystemExit(f"❌ Unknown service '{service_name}' in config file")

                if args.clear:
                    await reset_service_config(session, tenant.id, service)
                    print(f"🧹 Cleared overrides for {tenant.slug} -> {service.value}")
                    continue

                if not isinstance(payload, dict):
                    raise SystemExit(
                        f"❌ Override for service '{service_name}' must be a JSON object"
                    )

                await update_service_config(session, tenant.id, service, payload)
                print(f"✅ Applied overrides for {tenant.slug} -> {service.value}")

        if args.service:
            service = OSSService(args.service)

            if args.clear:
                await reset_service_config(session, tenant.id, service)
                print(f"🧹 Cleared overrides for {tenant.slug} -> {service.value}")
            elif args.set:
                overrides: dict[str, Any] = {}
                for entry in args.set:
                    if "=" not in entry:
                        raise SystemExit("❌ --set entries must be in key=value format")
                    key, value = entry.split("=", 1)
                    overrides[key.strip()] = _parse_value(value.strip())

                await update_service_config(session, tenant.id, service, overrides)
                print(f"✅ Applied overrides for {tenant.slug} -> {service.value}")
            elif not args.config_file:
                raise SystemExit("❌ Provide --set or --clear when using --service without --config-file")

    print("🎉 Done")


if __name__ == "__main__":
    asyncio.run(main())
