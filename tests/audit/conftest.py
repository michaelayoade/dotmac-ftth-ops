import pytest
import pytest_asyncio
import redis.asyncio as aioredis
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import async_sessionmaker

from dotmac.platform.audit.models import AuditActivity
from dotmac.platform.settings import settings


@pytest_asyncio.fixture(autouse=True)
async def clean_audit_activities(async_db_engine):
    """Ensure the audit activity table starts empty for every audit test."""
    session_factory = async_sessionmaker(bind=async_db_engine, expire_on_commit=False)

    async def purge() -> None:
        async with session_factory() as session:
            await session.execute(delete(AuditActivity))
            await session.commit()

    await purge()
    yield
    await purge()


@pytest_asyncio.fixture(autouse=True)
async def clean_rate_limit_redis():
    """Clear Redis rate limit keys and reset global connection pool between tests."""
    # Reset the global Redis pool to prevent connection pollution
    import dotmac.platform.rate_limit.decorators as rl_decorators

    # Close existing pool if any
    if rl_decorators._redis_pool is not None:
        try:
            await rl_decorators._redis_pool.aclose()
        except Exception:
            pass
        rl_decorators._redis_pool = None

    # Create a temporary client to clear keys (skip if Redis unavailable in test env)
    try:
        redis_client = await aioredis.from_url(
            settings.redis.redis_url,
            encoding="utf-8",
            decode_responses=True,
        )
    except Exception:
        yield
        return

    try:
        async def _clear_keys() -> None:
            keys = []
            async for key in redis_client.scan_iter(match="ratelimit:*"):
                keys.append(key)
            if keys:
                await redis_client.delete(*keys)

        try:
            await _clear_keys()
            yield
            await _clear_keys()
        except Exception:
            # If Redis is unavailable in the test environment, skip cleanup gracefully
            yield
        finally:
            try:
                await redis_client.aclose()
            except Exception:
                pass
    finally:
        # Reset the global pool again after test
        if rl_decorators._redis_pool is not None:
            try:
                await rl_decorators._redis_pool.aclose()
            except Exception:
                pass
            rl_decorators._redis_pool = None


@pytest.fixture(autouse=True)
def ensure_frontend_log_security(monkeypatch):
    """Guarantee a shared secret/origin for frontend log ingestion during tests."""
    monkeypatch.setattr(settings.audit, "frontend_log_secret", "test-secret", raising=False)
    monkeypatch.setattr(
        settings.audit,
        "frontend_log_allowed_origins",
        ["https://test.local"],
        raising=False,
    )
    monkeypatch.setattr(settings.audit, "frontend_log_require_auth", False, raising=False)
    yield
