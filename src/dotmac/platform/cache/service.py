"""
Cache Service.

Redis-backed caching with multiple strategies and patterns.
"""

import hashlib
import json
import zlib
from dataclasses import asdict, is_dataclass
from datetime import UTC, date, datetime
from enum import Enum
from typing import Any, TypedDict

import structlog

from dotmac.platform.cache.models import CacheNamespace
from dotmac.platform.redis_client import RedisClientType
from dotmac.platform.settings import settings

logger = structlog.get_logger(__name__)

_default_cache_service: "CacheService | None" = None


class CacheService:
    """Service for caching with Redis backend."""

    class NamespaceStats(TypedDict):
        hits: int
        misses: int
        sets: int
        deletes: int
        total_hit_latency: float
        total_miss_latency: float

    def __init__(self, redis: RedisClientType | None = None):
        """Initialize cache service."""
        self.redis = redis
        self._local_stats: dict[str, CacheService.NamespaceStats] = {}

    async def _get_redis(self) -> RedisClientType:
        """Get Redis connection."""
        if self.redis is None:
            import redis.asyncio as aioredis

            redis_url = settings.redis.redis_url
            self.redis = aioredis.from_url(
                redis_url,
                encoding="utf-8",
                decode_responses=False,  # We'll handle encoding
            )
        return self.redis

    def _generate_key(
        self,
        namespace: CacheNamespace | str,
        key: str,
        tenant_id: str | None = None,
    ) -> str:
        """Generate cache key with namespace and tenant isolation."""
        namespace_str = namespace.value if isinstance(namespace, CacheNamespace) else namespace

        if tenant_id:
            return f"cache:{tenant_id}:{namespace_str}:{key}"
        else:
            return f"cache:global:{namespace_str}:{key}"

    def _hash_key(self, key: str) -> str:
        """Hash long keys to keep them reasonable length."""
        if len(key) > 200:
            # MD5 used for cache key generation, not security
            return hashlib.md5(key.encode(), usedforsecurity=False).hexdigest()  # nosec B324
        return key

    async def get(
        self,
        key: str,
        namespace: CacheNamespace | str = CacheNamespace.API_RESPONSE,
        tenant_id: str | None = None,
        default: Any = None,
    ) -> Any:
        """
        Get value from cache.

        Args:
            key: Cache key
            namespace: Cache namespace
            tenant_id: Tenant ID for isolation
            default: Default value if not found

        Returns:
            Cached value or default
        """
        redis = await self._get_redis()
        cache_key = self._generate_key(namespace, self._hash_key(key), tenant_id)

        try:
            start_time = datetime.now(UTC)

            value = await redis.get(cache_key)

            latency = (datetime.now(UTC) - start_time).total_seconds() * 1000

            if value is None:
                self._record_miss(namespace, latency)
                logger.debug("Cache miss", key=cache_key, namespace=namespace)
                return default

            # Deserialize
            deserialized = self._deserialize(value)

            self._record_hit(namespace, latency)
            logger.debug("Cache hit", key=cache_key, namespace=namespace)

            return deserialized

        except Exception as e:
            logger.error("Cache get error", error=str(e), key=cache_key)
            return default

    async def set(
        self,
        key: str,
        value: Any,
        namespace: CacheNamespace | str = CacheNamespace.API_RESPONSE,
        tenant_id: str | None = None,
        ttl: int | None = None,
        compress: bool = False,
    ) -> bool:
        """
        Set value in cache.

        Args:
            key: Cache key
            value: Value to cache
            namespace: Cache namespace
            tenant_id: Tenant ID for isolation
            ttl: Time-to-live in seconds (None = no expiration)
            compress: Whether to compress value

        Returns:
            True if successful
        """
        redis = await self._get_redis()
        cache_key = self._generate_key(namespace, self._hash_key(key), tenant_id)

        try:
            # Serialize
            serialized = self._serialize(value)

            # Compress if requested
            if compress:
                serialized = zlib.compress(serialized)

            # Set with optional TTL
            if ttl:
                await redis.setex(cache_key, ttl, serialized)
            else:
                await redis.set(cache_key, serialized)

            self._record_set(namespace)
            logger.debug("Cache set", key=cache_key, namespace=namespace, ttl=ttl)

            return True

        except Exception as e:
            logger.error("Cache set error", error=str(e), key=cache_key)
            return False

    async def delete(
        self,
        key: str,
        namespace: CacheNamespace | str = CacheNamespace.API_RESPONSE,
        tenant_id: str | None = None,
    ) -> bool:
        """
        Delete value from cache.

        Args:
            key: Cache key
            namespace: Cache namespace
            tenant_id: Tenant ID for isolation

        Returns:
            True if deleted
        """
        redis = await self._get_redis()
        cache_key = self._generate_key(namespace, self._hash_key(key), tenant_id)

        try:
            deleted = await redis.delete(cache_key)
            self._record_delete(namespace)
            logger.debug("Cache delete", key=cache_key, namespace=namespace, deleted=bool(deleted))
            return bool(deleted)

        except Exception as e:
            logger.error("Cache delete error", error=str(e), key=cache_key)
            return False

    async def exists(
        self,
        key: str,
        namespace: CacheNamespace | str = CacheNamespace.API_RESPONSE,
        tenant_id: str | None = None,
    ) -> bool:
        """Check if key exists in cache."""
        redis = await self._get_redis()
        cache_key = self._generate_key(namespace, self._hash_key(key), tenant_id)

        try:
            exists = await redis.exists(cache_key)
            return bool(exists)

        except Exception as e:
            logger.error("Cache exists error", error=str(e), key=cache_key)
            return False

    async def get_ttl(
        self,
        key: str,
        namespace: CacheNamespace | str = CacheNamespace.API_RESPONSE,
        tenant_id: str | None = None,
    ) -> int | None:
        """Get remaining TTL for key in seconds."""
        redis = await self._get_redis()
        cache_key = self._generate_key(namespace, self._hash_key(key), tenant_id)

        try:
            ttl = await redis.ttl(cache_key)
            return ttl if ttl > 0 else None

        except Exception as e:
            logger.error("Cache TTL error", error=str(e), key=cache_key)
            return None

    async def extend_ttl(
        self,
        key: str,
        additional_seconds: int,
        namespace: CacheNamespace | str = CacheNamespace.API_RESPONSE,
        tenant_id: str | None = None,
    ) -> bool:
        """Extend TTL of existing key."""
        redis = await self._get_redis()
        cache_key = self._generate_key(namespace, self._hash_key(key), tenant_id)

        try:
            current_ttl = await redis.ttl(cache_key)
            if current_ttl > 0:
                new_ttl = current_ttl + additional_seconds
                await redis.expire(cache_key, new_ttl)
                return True
            return False

        except Exception as e:
            logger.error("Cache extend TTL error", error=str(e), key=cache_key)
            return False

    async def invalidate_pattern(
        self,
        pattern: str,
        namespace: CacheNamespace | str = CacheNamespace.API_RESPONSE,
        tenant_id: str | None = None,
    ) -> int:
        """
        Invalidate all keys matching pattern.

        Args:
            pattern: Key pattern (supports * and ? wildcards)
            namespace: Cache namespace
            tenant_id: Tenant ID for isolation

        Returns:
            Number of keys deleted
        """
        redis = await self._get_redis()
        cache_pattern = self._generate_key(namespace, pattern, tenant_id)

        try:
            deleted_count = 0

            # Scan for matching keys
            cursor = 0
            while True:
                cursor, keys = await redis.scan(cursor, match=cache_pattern, count=100)

                if keys:
                    deleted = await redis.delete(*keys)
                    deleted_count += deleted

                if cursor == 0:
                    break

            self._record_delete(namespace, deleted_count)
            logger.info(
                "Cache pattern invalidated",
                pattern=cache_pattern,
                namespace=namespace,
                deleted=deleted_count,
            )

            return deleted_count

        except Exception as e:
            logger.error("Cache invalidate pattern error", error=str(e), pattern=cache_pattern)
            return 0

    async def clear_namespace(
        self,
        namespace: CacheNamespace | str,
        tenant_id: str | None = None,
    ) -> int:
        """Clear all keys in namespace."""
        return await self.invalidate_pattern("*", namespace, tenant_id)

    async def get_many(
        self,
        keys: list[str],
        namespace: CacheNamespace | str = CacheNamespace.API_RESPONSE,
        tenant_id: str | None = None,
    ) -> dict[str, Any]:
        """Get multiple values from cache."""
        redis = await self._get_redis()

        try:
            cache_keys = [
                self._generate_key(namespace, self._hash_key(key), tenant_id) for key in keys
            ]

            values = await redis.mget(cache_keys)

            result = {}
            for key, value in zip(keys, values, strict=False):
                if value is not None:
                    result[key] = self._deserialize(value)
                    self._record_hit(namespace, 0)
                else:
                    self._record_miss(namespace, 0)

            return result

        except Exception as e:
            logger.error("Cache get_many error", error=str(e))
            return {}

    async def set_many(
        self,
        items: dict[str, Any],
        namespace: CacheNamespace | str = CacheNamespace.API_RESPONSE,
        tenant_id: str | None = None,
        ttl: int | None = None,
    ) -> bool:
        """Set multiple values in cache."""
        redis = await self._get_redis()

        try:
            # Use pipeline for atomic multi-set
            async with redis.pipeline() as pipe:
                for key, value in items.items():
                    cache_key = self._generate_key(namespace, self._hash_key(key), tenant_id)
                    serialized = self._serialize(value)

                    if ttl:
                        pipe.setex(cache_key, ttl, serialized)
                    else:
                        pipe.set(cache_key, serialized)

                await pipe.execute()

            self._record_set(namespace, len(items))
            logger.debug("Cache set_many", count=len(items), namespace=namespace)

            return True

        except Exception as e:
            logger.error("Cache set_many error", error=str(e))
            return False

    async def increment(
        self,
        key: str,
        amount: int = 1,
        namespace: CacheNamespace | str = CacheNamespace.METRICS,
        tenant_id: str | None = None,
    ) -> int:
        """Increment counter in cache."""
        redis = await self._get_redis()
        cache_key = self._generate_key(namespace, self._hash_key(key), tenant_id)

        try:
            result = await redis.incrby(cache_key, amount)
            return int(result)

        except Exception as e:
            logger.error("Cache increment error", error=str(e), key=cache_key)
            return 0

    async def decrement(
        self,
        key: str,
        amount: int = 1,
        namespace: CacheNamespace | str = CacheNamespace.METRICS,
        tenant_id: str | None = None,
    ) -> int:
        """Decrement counter in cache."""
        return await self.increment(key, -amount, namespace, tenant_id)

    def _serialize(self, value: Any) -> bytes:
        """
        Serialize value for storage using JSON only.

        Raises:
            ValueError: If the value cannot be represented safely as JSON.
        """
        try:
            json_payload = json.dumps(
                value, default=self._json_default_encoder, separators=(",", ":")
            )
        except (TypeError, ValueError) as exc:
            raise ValueError(
                f"Cannot cache non-JSON-serializable value of type {type(value).__name__}. "
                "Use a Pydantic model, dataclass, or convert the value to JSON-safe primitives."
            ) from exc

        return json_payload.encode("utf-8")

    def _deserialize(self, value: bytes) -> Any:
        """Deserialize value from storage."""
        raw_value = value

        if self._is_compressed(raw_value):
            try:
                raw_value = zlib.decompress(raw_value)
            except zlib.error as exc:
                logger.error("Cache decompress error", error=str(exc))
                return None

        try:
            return json.loads(raw_value.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            logger.error("Corrupted cache data", error=str(exc))
            return None

    @staticmethod
    def _is_compressed(value: bytes) -> bool:
        """Detect if a payload looks like zlib-compressed data."""
        return len(value) >= 2 and value[:2] == b"\x78\x9c"

    @staticmethod
    def _json_default_encoder(value: Any) -> Any:
        """
        Provide safe fallbacks for objects commonly cached in the application.

        Raises TypeError for unsupported objects so json.dumps surfaces the issue.
        """
        if hasattr(value, "model_dump") and callable(value.model_dump):
            return value.model_dump()
        if is_dataclass(value) and not isinstance(value, type):
            return asdict(value)
        if isinstance(value, datetime):
            return value.isoformat()
        if isinstance(value, date):
            return value.isoformat()
        if isinstance(value, Enum):
            return value.value

        raise TypeError(f"Object of type {type(value).__name__} is not JSON serializable")

    def _record_hit(self, namespace: CacheNamespace | str, latency_ms: float) -> None:
        """Record cache hit for statistics."""
        ns = namespace.value if isinstance(namespace, CacheNamespace) else namespace

        if ns not in self._local_stats:
            self._local_stats[ns] = CacheService.NamespaceStats(
                hits=0,
                misses=0,
                sets=0,
                deletes=0,
                total_hit_latency=0.0,
                total_miss_latency=0.0,
            )

        self._local_stats[ns]["hits"] += 1
        self._local_stats[ns]["total_hit_latency"] += latency_ms

    def _record_miss(self, namespace: CacheNamespace | str, latency_ms: float) -> None:
        """Record cache miss for statistics."""
        ns = namespace.value if isinstance(namespace, CacheNamespace) else namespace

        if ns not in self._local_stats:
            self._local_stats[ns] = CacheService.NamespaceStats(
                hits=0,
                misses=0,
                sets=0,
                deletes=0,
                total_hit_latency=0.0,
                total_miss_latency=0.0,
            )

        self._local_stats[ns]["misses"] += 1
        self._local_stats[ns]["total_miss_latency"] += latency_ms

    def _record_set(self, namespace: CacheNamespace | str, count: int = 1) -> None:
        """Record cache set operation."""
        ns = namespace.value if isinstance(namespace, CacheNamespace) else namespace

        if ns not in self._local_stats:
            self._local_stats[ns] = CacheService.NamespaceStats(
                hits=0,
                misses=0,
                sets=0,
                deletes=0,
                total_hit_latency=0.0,
                total_miss_latency=0.0,
            )

        self._local_stats[ns]["sets"] += count

    def _record_delete(self, namespace: CacheNamespace | str, count: int = 1) -> None:
        """Record cache delete operation."""
        ns = namespace.value if isinstance(namespace, CacheNamespace) else namespace

        if ns not in self._local_stats:
            self._local_stats[ns] = {
                "hits": 0,
                "misses": 0,
                "sets": 0,
                "deletes": 0,
                "total_hit_latency": 0,
                "total_miss_latency": 0,
            }

        self._local_stats[ns]["deletes"] += count

    def get_stats(self) -> dict[str, dict[str, Any]]:
        """Get accumulated statistics."""
        stats = {}

        for namespace, data in self._local_stats.items():
            total_requests = data["hits"] + data["misses"]
            hit_rate = (data["hits"] / total_requests * 100) if total_requests > 0 else 0

            avg_hit_latency = data["total_hit_latency"] / data["hits"] if data["hits"] > 0 else 0
            avg_miss_latency = (
                data["total_miss_latency"] / data["misses"] if data["misses"] > 0 else 0
            )

            stats[namespace] = {
                "total_requests": total_requests,
                "cache_hits": data["hits"],
                "cache_misses": data["misses"],
                "hit_rate": round(hit_rate, 2),
                "avg_hit_latency_ms": round(avg_hit_latency, 2),
                "avg_miss_latency_ms": round(avg_miss_latency, 2),
                "sets": data["sets"],
                "deletes": data["deletes"],
            }

        return stats

    def reset_stats(self) -> None:
        """Reset accumulated statistics."""
        self._local_stats = {}


def get_cache_service(redis: RedisClientType | None = None) -> CacheService:
    """
    Return a shared CacheService instance.

    Allows dependency overrides in tests by passing a custom Redis client.
    """
    global _default_cache_service

    if redis is not None:
        return CacheService(redis=redis)

    if _default_cache_service is None:
        _default_cache_service = CacheService()

    return _default_cache_service
