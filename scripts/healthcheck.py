#!/usr/bin/env python3
"""
Health check script for Docker containers.
Returns exit code 0 if healthy, 1 if unhealthy.
"""

import asyncio
import json
import os
import sys
from pathlib import Path

import aiohttp

# Add src to Python path
sys.path.insert(0, "/app/src")


async def check_api_health():
    """Check API health endpoint."""
    try:
        timeout = aiohttp.ClientTimeout(total=5)
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.get("http://localhost:8000/health") as response:
                if response.status == 200:
                    data = await response.json()
                    return data.get("status") == "healthy"
                return False
    except Exception as e:
        print(f"API health check failed: {e}")
        return False


async def check_database_health():
    """Check database connectivity."""
    try:
        from dotmac.platform.database.session import get_engine

        engine = get_engine()
        async with engine.begin() as conn:
            await conn.execute("SELECT 1")
        return True
    except Exception as e:
        print(f"Database health check failed: {e}")
        return False


async def check_redis_health():
    """Check Redis connectivity."""
    try:
        import redis.asyncio as aioredis

        redis_url = os.getenv("REDIS__HOST", "localhost")
        redis_port = int(os.getenv("REDIS__PORT", "6379"))

        redis_client = aioredis.Redis(host=redis_url, port=redis_port)
        await redis_client.ping()
        await redis_client.aclose()
        return True
    except Exception as e:
        print(f"Redis health check failed: {e}")
        return False


async def check_vault_health():
    """Check Vault/OpenBao connectivity."""
    try:
        vault_url = os.getenv("VAULT__URL")
        if not vault_url:
            return True  # Skip if not configured

        timeout = aiohttp.ClientTimeout(total=5)
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.get(f"{vault_url}/v1/sys/health") as response:
                return response.status in [200, 429, 472, 473]  # Various healthy states
    except Exception as e:
        print(f"Vault health check failed: {e}")
        return False


async def check_disk_space():
    """Check available disk space."""
    try:
        import shutil

        # Check main app directory
        total, used, free = shutil.disk_usage("/app")
        free_percent = (free / total) * 100

        if free_percent < 10:  # Less than 10% free space
            print(f"Low disk space: {free_percent:.1f}% free")
            return False

        return True
    except Exception as e:
        print(f"Disk space check failed: {e}")
        return False


async def check_memory_usage():
    """Check memory usage."""
    try:
        import psutil

        memory = psutil.virtual_memory()
        if memory.percent > 90:  # More than 90% memory used
            print(f"High memory usage: {memory.percent:.1f}%")
            return False

        return True
    except Exception as e:
        print(f"Memory check failed: {e}")
        return True  # Not critical


async def main():
    """Run all health checks."""
    health_checks = [
        ("API", check_api_health()),
        ("Database", check_database_health()),
        ("Redis", check_redis_health()),
        ("Vault", check_vault_health()),
        ("Disk Space", check_disk_space()),
        ("Memory", check_memory_usage()),
    ]

    results = {}
    overall_healthy = True

    for name, check in health_checks:
        try:
            result = await check
            results[name] = result
            if not result:
                overall_healthy = False
                print(f"❌ {name} health check failed")
            else:
                print(f"✅ {name} is healthy")
        except Exception as e:
            results[name] = False
            overall_healthy = False
            print(f"❌ {name} health check error: {e}")

    # Write health status to file
    health_status = {
        "status": "healthy" if overall_healthy else "unhealthy",
        "checks": results,
        "timestamp": asyncio.get_event_loop().time(),
    }

    try:
        health_file = Path("/app/tmp/health.json")
        health_file.parent.mkdir(exist_ok=True)
        health_file.write_text(json.dumps(health_status, indent=2))
    except Exception:
        pass  # Don't fail health check due to file write error

    if overall_healthy:
        print("🎉 All health checks passed!")
        sys.exit(0)
    else:
        print("💥 Some health checks failed!")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
