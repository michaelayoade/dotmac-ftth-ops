# Redis Client Management

**Date**: 2025-10-15
**Status**: ✅ **IMPLEMENTED**

---

## Overview

Implemented centralized Redis client management with dependency injection across all platform services. This replaces hardcoded Redis connections with a production-grade singleton client manager.

---

## Problem Statement

### Before Implementation

Multiple routers were creating Redis connections with hardcoded credentials:

```python
# ❌ Old approach - hardcoded credentials
redis = Redis(
    host="localhost",
    port=6379,
    password="change-me-in-production",
    decode_responses=False,
)
```

**Issues**:
- Hardcoded credentials in source code
- No connection pooling
- No centralized configuration
- Inconsistent Redis clients across services
- No graceful error handling
- Manual connection lifecycle management

---

## Solution

### Architecture

Created a centralized `RedisClientManager` with:

1. **Singleton Pattern**: Single Redis client instance across the application
2. **Connection Pooling**: Efficient connection reuse with configurable pool size
3. **Configuration Management**: Integrated with existing settings
4. **Dependency Injection**: FastAPI-native dependency injection
5. **Lifecycle Management**: Automatic initialization and cleanup
6. **Health Monitoring**: Built-in health check capabilities

---

## Implementation Details

### 1. Redis Client Manager (`src/dotmac/platform/redis_client.py`)

```python
class RedisClientManager:
    """
    Singleton Redis client manager with connection pooling.

    Features:
    - Connection pooling for performance
    - Automatic reconnection
    - Health checking
    - Graceful shutdown
    """

    _instance: "RedisClientManager | None" = None
    _pool: ConnectionPool | None = None
    _client: Redis | None = None

    async def initialize(
        self,
        host: str | None = None,
        port: int | None = None,
        password: str | None = None,
        db: int = 0,
        decode_responses: bool = True,
        max_connections: int = 50,
        socket_timeout: int = 5,
        socket_connect_timeout: int = 5,
        **kwargs: Any,
    ) -> None:
        """Initialize Redis connection pool using settings."""
        # Uses settings.redis.* for configuration

    def get_client(self) -> Redis:
        """Get Redis client instance."""

    async def health_check(self) -> dict[str, Any]:
        """Perform Redis health check."""
```

#### Key Features

**Singleton Instance**:
```python
# Global instance
redis_manager = RedisClientManager()
```

**FastAPI Dependency**:
```python
async def get_redis_client() -> AsyncGenerator[Redis, None]:
    """
    FastAPI dependency for Redis client.

    Example:
        @router.get("/endpoint")
        async def endpoint(redis: Redis = Depends(get_redis_client)):
            await redis.set("key", "value")
    """
    client = redis_manager.get_client()
    try:
        yield client
    except Exception as e:
        logger.error("redis.operation_failed", error=str(e))
        raise
```

**Lifecycle Functions**:
```python
async def init_redis() -> None:
    """Initialize Redis on application startup."""
    await redis_manager.initialize()

async def shutdown_redis() -> None:
    """Close Redis connections on shutdown."""
    await redis_manager.close()
```

---

### 2. Settings Configuration

Redis configuration already exists in `src/dotmac/platform/settings.py`:

```python
class RedisSettings(BaseModel):
    """Redis configuration."""
    url: RedisDsn | None = Field(None, description="Full Redis URL")
    host: str = Field("localhost", description="Redis host")
    port: int = Field(6379, description="Redis port")
    password: str = Field("", description="Redis password")
    db: int = Field(0, description="Redis database number")
    max_connections: int = Field(50, description="Max connections in pool")
    decode_responses: bool = Field(True, description="Decode responses to strings")
    cache_db: int = Field(1, description="Cache database number")
    session_db: int = Field(2, description="Session database number")
    pubsub_db: int = Field(3, description="Pub/sub database number")

redis: RedisSettings = RedisSettings()
```

---

### 3. Application Lifecycle Integration

Updated `src/dotmac/platform/main.py` to manage Redis lifecycle:

```python
from dotmac.platform.redis_client import init_redis, shutdown_redis

@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Manage application lifecycle events."""

    # ... existing startup code ...

    # Initialize Redis
    try:
        await init_redis()
        logger.info("redis.init.success", emoji="✅")
    except Exception as e:
        logger.error("redis.init.failed", error=str(e), emoji="❌")
        # Allow graceful degradation for features that can work without Redis
        if settings.environment == "production":
            logger.warning("redis.production.unavailable", emoji="⚠️")

    # ... existing startup code ...

    yield

    # Shutdown with structured logging
    logger.info("service.shutdown.begin", emoji="👋")

    # Cleanup Redis connections
    try:
        await shutdown_redis()
        logger.info("redis.shutdown.success", emoji="✅")
    except Exception as e:
        logger.error("redis.shutdown.failed", error=str(e), emoji="❌")

    logger.info("service.shutdown.complete", emoji="✅")
```

---

### 4. Router Updates

Updated all routers to use dependency injection:

#### Realtime Router (`src/dotmac/platform/realtime/router.py`)

```python
from dotmac.platform.redis_client import get_redis_client

# ✅ New approach - dependency injection
@router.get("/onu-status")
async def stream_onu_status(
    redis: Redis = Depends(get_redis_client),
    current_user: UserInfo = Depends(get_current_user),
) -> EventSourceResponse:
    response = await create_onu_status_stream(redis, current_user.tenant_id)
    return response
```

#### Metrics Router (`src/dotmac/platform/metrics/router.py`)

```python
from redis.asyncio import Redis
from dotmac.platform.redis_client import get_redis_client

async def get_metrics_service(
    session: AsyncSession = Depends(get_session_dependency),
    redis: Redis = Depends(get_redis_client),
) -> MetricsService:
    """Get metrics service instance with Redis caching."""
    return MetricsService(session, redis_client=redis)
```

#### Jobs Router (`src/dotmac/platform/jobs/router.py`)

```python
from redis.asyncio import Redis
from dotmac.platform.redis_client import get_redis_client

async def get_job_service(
    session: AsyncSession = Depends(get_session_dependency),
    redis: Redis = Depends(get_redis_client),
) -> JobService:
    """Get job service instance."""
    return JobService(session, redis_client=redis)
```

#### Scheduler Router (`src/dotmac/platform/jobs/scheduler_router.py`)

```python
from redis.asyncio import Redis
from dotmac.platform.redis_client import get_redis_client

async def get_scheduler_service(
    session: AsyncSession = Depends(get_session_dependency),
    redis: Redis = Depends(get_redis_client),
) -> SchedulerService:
    """Get scheduler service instance."""
    return SchedulerService(session, redis_client=redis)
```

---

## Configuration

### Environment Variables

```bash
# Redis connection
REDIS__HOST=redis.example.com          # Default: localhost
REDIS__PORT=6379                        # Default: 6379
REDIS__PASSWORD=secure-password         # Default: empty string
REDIS__DB=0                             # Default: 0

# Connection pool
REDIS__MAX_CONNECTIONS=50               # Default: 50
REDIS__DECODE_RESPONSES=true           # Default: true

# Database assignments
REDIS__CACHE_DB=1                       # For caching
REDIS__SESSION_DB=2                     # For sessions
REDIS__PUBSUB_DB=3                      # For pub/sub
```

### Production Configuration

```bash
# Required for production
ENVIRONMENT=production
REDIS__HOST=redis.production.example.com
REDIS__PORT=6379
REDIS__PASSWORD=<secure-password>
```

See `docs/REDIS_MANDATORY_PRODUCTION.md` for production requirements.

---

## Usage Examples

### Basic Usage in a Router

```python
from fastapi import APIRouter, Depends
from redis.asyncio import Redis
from dotmac.platform.redis_client import get_redis_client

router = APIRouter()

@router.get("/example")
async def example_endpoint(
    redis: Redis = Depends(get_redis_client),
):
    # Use Redis client
    await redis.set("key", "value", ex=300)
    value = await redis.get("key")
    return {"value": value}
```

### Using in a Service

```python
class MyService:
    def __init__(self, session: AsyncSession, redis_client: Redis):
        self.session = session
        self.redis = redis_client

    async def cache_data(self, key: str, data: dict):
        """Cache data with 5-minute TTL."""
        await self.redis.setex(
            f"cache:{key}",
            300,
            json.dumps(data)
        )

    async def get_cached_data(self, key: str) -> dict | None:
        """Get cached data."""
        data = await self.redis.get(f"cache:{key}")
        return json.loads(data) if data else None
```

### Health Check

```python
from dotmac.platform.redis_client import redis_manager

# Get health status
health = await redis_manager.health_check()

# Returns:
{
    "status": "healthy",
    "redis_version": "7.0.11",
    "connected_clients": 5,
    "used_memory_human": "1.23M",
    "uptime_in_seconds": 3600
}
```

---

## Benefits

### Before vs After

| Aspect | Before | After |
|--------|--------|-------|
| **Configuration** | Hardcoded | Centralized settings |
| **Connection Management** | Manual | Automatic pooling |
| **Lifecycle** | Manual | Automatic |
| **Error Handling** | Inconsistent | Standardized |
| **Testing** | Difficult | Easy to mock |
| **Security** | Credentials in code | Environment variables |

### Performance Improvements

1. **Connection Pooling**: 50 pooled connections (configurable)
2. **Connection Reuse**: Eliminates overhead of creating new connections
3. **Timeout Management**: Configurable socket timeouts (5s default)
4. **Graceful Degradation**: Services can handle Redis unavailability

### Code Quality Improvements

1. **Single Responsibility**: Centralized client management
2. **Dependency Injection**: FastAPI-native pattern
3. **Type Safety**: Full type annotations, MyPy compliant
4. **Testability**: Easy to mock in unit tests
5. **Observability**: Structured logging for all operations

---

## Testing

### Unit Testing with Mocked Redis

```python
from unittest.mock import AsyncMock
import pytest

@pytest.fixture
def mock_redis():
    """Mock Redis client for testing."""
    mock = AsyncMock()
    mock.get.return_value = "test_value"
    mock.set.return_value = True
    return mock

async def test_service_with_redis(mock_redis):
    """Test service with mocked Redis."""
    service = MyService(session, redis_client=mock_redis)

    await service.cache_data("key", {"data": "value"})

    mock_redis.setex.assert_called_once()
```

### Integration Testing

```python
@pytest.mark.asyncio
async def test_redis_integration():
    """Test actual Redis integration."""
    from dotmac.platform.redis_client import redis_manager

    # Initialize
    await redis_manager.initialize()

    # Get client
    redis = redis_manager.get_client()

    # Test operations
    await redis.set("test_key", "test_value")
    value = await redis.get("test_key")
    assert value == "test_value"

    # Cleanup
    await redis_manager.close()
```

---

## Monitoring

### Structured Logging

All Redis operations log structured events:

```json
{
  "event": "redis.initialized",
  "host": "redis.example.com",
  "port": 6379,
  "db": 0,
  "max_connections": 50
}

{
  "event": "redis.operation_failed",
  "error": "Connection timeout",
  "operation": "get"
}
```

### Health Monitoring

Use the health check endpoint to monitor Redis:

```bash
curl http://api.example.com/health/ready

# Response includes Redis status
{
  "status": "ready",
  "healthy": true,
  "services": [
    {
      "name": "redis",
      "status": "healthy",
      "message": "Redis connection successful",
      "required": true
    }
  ]
}
```

---

## Troubleshooting

### Connection Failures

**Symptom**: `RuntimeError: Redis client not initialized`

**Solution**:
1. Verify Redis is running: `redis-cli ping`
2. Check configuration: `REDIS__HOST`, `REDIS__PORT`
3. Verify network connectivity
4. Check application logs for initialization errors

### Performance Issues

**Symptom**: Slow Redis operations

**Solution**:
1. Increase connection pool size: `REDIS__MAX_CONNECTIONS=100`
2. Check Redis server load: `redis-cli INFO stats`
3. Monitor connection usage: `redis-cli CLIENT LIST`
4. Consider Redis clustering for high load

### Memory Leaks

**Symptom**: Growing memory usage

**Solution**:
1. Verify TTLs are set on cached data
2. Check for keys without expiration: `redis-cli KEYS *`
3. Use `redis-cli MEMORY DOCTOR` for diagnostics
4. Set maxmemory policy in Redis config

---

## Migration Guide

### For Existing Services

If you have existing code using Redis:

1. **Remove hardcoded Redis connections**:
   ```python
   # ❌ Remove this
   redis = Redis(host="localhost", port=6379)
   ```

2. **Add dependency injection**:
   ```python
   # ✅ Add this
   from redis.asyncio import Redis
   from dotmac.platform.redis_client import get_redis_client

   async def my_dependency(
       redis: Redis = Depends(get_redis_client),
   ):
       # Use redis client
   ```

3. **Update service constructors**:
   ```python
   # Before
   service = MyService(session)

   # After
   service = MyService(session, redis_client=redis)
   ```

---

## Files Modified

### Created
- `src/dotmac/platform/redis_client.py` (240 lines)

### Updated
- `src/dotmac/platform/main.py` - Added Redis lifecycle management
- `src/dotmac/platform/realtime/router.py` - Added Redis dependency
- `src/dotmac/platform/metrics/router.py` - Added Redis dependency
- `src/dotmac/platform/jobs/router.py` - Added Redis dependency
- `src/dotmac/platform/jobs/scheduler_router.py` - Added Redis dependency
- `docs/TODO_SUMMARY.md` - Marked Redis injection task as completed

---

## Related Documentation

- **Production Requirements**: `docs/REDIS_MANDATORY_PRODUCTION.md`
- **Session Management**: `docs/SESSION_MANAGEMENT.md`
- **Health Checks**: `src/dotmac/platform/monitoring/health_checks.py`
- **Settings**: `src/dotmac/platform/settings.py`

---

## Summary

✅ **Centralized Redis Management**: Single point of configuration
✅ **Connection Pooling**: Efficient resource utilization
✅ **Dependency Injection**: FastAPI-native pattern
✅ **Lifecycle Management**: Automatic initialization and cleanup
✅ **Health Monitoring**: Built-in health checks
✅ **Type Safety**: Full MyPy compliance
✅ **Production Ready**: Graceful error handling and logging

**Status**: Redis client management is now production-grade and fully integrated across all platform services.
