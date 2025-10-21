"""
Distributed locks using Redis SET NX EX.

"""

import asyncio
import uuid
from collections.abc import AsyncGenerator, Awaitable, Callable
from contextlib import asynccontextmanager
from typing import Any, cast

import redis.asyncio as redis
import structlog

from dotmac.platform.settings import settings

logger = structlog.get_logger(__name__)

# Global Redis client
_redis_client: Any = None  # redis.Redis - generic syntax incompatible with Python 3.13


async def get_redis_client() -> Any:
    """Get Redis client for locks."""
    global _redis_client
    if _redis_client is None:
        _redis_client = redis.from_url(settings.redis.redis_url)
    return _redis_client


@asynccontextmanager
async def distributed_lock(
    key: str, timeout: int = 30, retry_delay: float = 0.1
) -> AsyncGenerator[None]:
    """
    Simple distributed lock using Redis SET NX EX.

    Usage:
        async with distributed_lock("my_resource", timeout=60):
            # Critical section - only one instance can execute this
            await do_work()
    """
    client = await get_redis_client()
    lock_key = f"lock:{key}"
    lock_value = str(uuid.uuid4())

    # Try to acquire lock
    acquired = False
    try:
        # SET key value NX EX timeout
        acquired = bool(await client.set(lock_key, lock_value, nx=True, ex=timeout))

        if not acquired:
            # Simple retry with backoff
            for _ in range(int(timeout / retry_delay)):
                await asyncio.sleep(retry_delay)
                acquired = bool(await client.set(lock_key, lock_value, nx=True, ex=timeout))
                if acquired:
                    break

        if not acquired:
            raise TimeoutError(f"Could not acquire lock {key} within {timeout}s")

        logger.debug("Lock acquired", key=key, value=lock_value)
        yield

    finally:
        if acquired:
            # Release lock only if we own it (check value)
            lua_script = """
            if redis.call("get", KEYS[1]) == ARGV[1] then
                return redis.call("del", KEYS[1])
            else
                return 0
            end
            """
            eval_fn = cast(
                Callable[[str, int, str, str], Awaitable[Any]],
                client.eval,
            )
            await eval_fn(lua_script, 1, lock_key, lock_value)
            logger.debug("Lock released", key=key, value=lock_value)


# For simple cases without context manager:
async def try_lock(key: str, timeout: int = 30) -> str | None:
    """Try to acquire lock, return lock value if successful."""
    client = await get_redis_client()
    lock_key = f"lock:{key}"
    lock_value = str(uuid.uuid4())

    acquired = bool(await client.set(lock_key, lock_value, nx=True, ex=timeout))
    return lock_value if acquired else None


async def release_lock(key: str, lock_value: str) -> bool:
    """Release lock if we own it."""
    client = await get_redis_client()
    lock_key = f"lock:{key}"

    lua_script = """
    if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
    else
        return 0
    end
    """
    eval_fn = cast(
        Callable[[str, int, str, str], Awaitable[Any]],
        client.eval,
    )
    result = await eval_fn(lua_script, 1, lock_key, lock_value)
    return bool(result)


class DistributedLock:
    """Simple distributed lock class for those who prefer OOP interface."""

    def __init__(self, key: str, timeout: int = 30) -> None:
        self.key = key
        self.timeout = timeout
        self.lock_value: str | None = None

    async def acquire(self, retry_delay: float = 0.1) -> bool:
        """Acquire the lock."""
        if self.lock_value:
            return False  # Already holding lock

        client = await get_redis_client()
        lock_key = f"lock:{self.key}"
        self.lock_value = str(uuid.uuid4())

        # Try to acquire lock
        acquired = bool(await client.set(lock_key, self.lock_value, nx=True, ex=self.timeout))

        if not acquired:
            # Simple retry with backoff
            for _ in range(int(self.timeout / retry_delay)):
                await asyncio.sleep(retry_delay)
                acquired = bool(
                    await client.set(lock_key, self.lock_value, nx=True, ex=self.timeout)
                )
                if acquired:
                    break

        if not acquired:
            self.lock_value = None

        return bool(acquired)

    async def release(self) -> bool:
        """Release the lock if we own it."""
        if not self.lock_value:
            return False

        result = await release_lock(self.key, self.lock_value)
        self.lock_value = None
        return result

    async def __aenter__(self) -> "DistributedLock":
        """Async context manager entry."""
        if not await self.acquire():
            raise TimeoutError(f"Could not acquire lock {self.key}")
        return self

    async def __aexit__(self, exc_type: Any, exc_val: Any, exc_tb: Any) -> None:
        """Async context manager exit."""
        await self.release()


# For even simpler use cases, use Redis  # type: ignore[misc] directly:
#
# import redis.asyncio as redis
# client = redis.from_url("redis://localhost")
#
# # Acquire lock
# acquired = await client.set("my_lock", "unique_id", nx=True, ex=30)
#
# # Release lock (with ownership check)
# script = "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end"
# await client.eval(script, 1, "my_lock", "unique_id")
