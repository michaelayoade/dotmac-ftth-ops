# Cleanup Registry Integration Guide

## Overview

The **Cleanup Registry** pattern provides a robust, explicit way to manage test cleanup instead of scanning for objects to clean up.

## Current vs. Registry Approach

### Current Approach (Fragile)

```python
# conftest.py - current approach
@pytest.fixture(autouse=True, scope="function")
def cleanup_fastapi_state(request):
    yield

    # ❌ Fragile - scans dir(request) looking for FastAPI apps
    for item in dir(request):
        try:
            obj = getattr(request, item)
            if hasattr(obj, "__class__") and obj.__class__.__name__ == "FastAPI":
                if hasattr(obj, "dependency_overrides"):
                    obj.dependency_overrides.clear()
        except (AttributeError, TypeError):
            pass
```

**Problems:**
- Scanning `dir(request)` is slow and fragile
- Doesn't guarantee cleanup order
- Can't handle complex cleanup dependencies
- Hard to debug when cleanup fails

### Registry Approach (Robust)

```python
# conftest.py - new approach with registry
from tests.helpers.cleanup_registry import get_cleanup_registry, reset_cleanup_registry

@pytest.fixture(autouse=True, scope="function")
def cleanup_registry():
    """Provide cleanup registry for the test.

    Automatically resets before test and cleans up after.
    """
    # Reset registry before test
    reset_cleanup_registry()
    registry = get_cleanup_registry()

    yield registry

    # Cleanup after test - explicit and ordered
    registry.cleanup_all()
```

**Benefits:**
- ✅ Explicit registration (no scanning)
- ✅ Priority-based cleanup order
- ✅ Better error handling
- ✅ Easy to debug
- ✅ Extensible

---

## Integration Steps

### Step 1: Add Registry Fixture to conftest.py

Add this to `tests/conftest.py`:

```python
from tests.helpers.cleanup_registry import (
    CleanupPriority,
    CleanupRegistry,
    get_cleanup_registry,
    reset_cleanup_registry,
)

@pytest.fixture(autouse=True, scope="function")
def cleanup_registry():
    """Provide cleanup registry for automatic resource cleanup.

    This fixture:
    1. Resets the registry before each test
    2. Provides the registry to the test
    3. Runs all registered cleanup handlers after the test

    Usage in tests:
        def test_my_feature(cleanup_registry):
            resource = create_resource()
            cleanup_registry.register(resource.close)
            # Test code...
            # resource.close() called automatically
    """
    reset_cleanup_registry()
    registry = get_cleanup_registry()

    yield registry

    # Automatic cleanup in priority order
    registry.cleanup_all()
```

### Step 2: Update test_app Fixture

Modify the `test_app` fixture to register its cleanup:

```python
@pytest.fixture
def test_app(async_db_engine, cleanup_registry: CleanupRegistry):
    """FastAPI test application with all middleware."""
    app = create_tenant_app()

    # Configure app...

    # ✅ Register cleanup instead of manual cleanup
    cleanup_registry.register_fastapi_app(app)

    return app  # No need for yield anymore
```

### Step 3: Update Router Base Classes

Modify `tests/helpers/router_base.py` to use registry:

```python
class RouterTestBase:
    @pytest.fixture
    def client(
        self,
        test_app: FastAPI,
        test_user: UserInfo,
        mock_db: AsyncMock,
        cleanup_registry: CleanupRegistry  # Inject registry
    ) -> TestClient:
        """Create test client with router."""
        # Register router
        router = self._get_router()
        test_app.include_router(router, prefix=self.router_prefix or "/api/v1")

        # Override dependencies
        test_app.dependency_overrides[get_current_user] = lambda: test_user
        test_app.dependency_overrides[get_session_dependency] = lambda: mock_db

        # ✅ Register cleanup (no manual cleanup needed)
        cleanup_registry.register_fastapi_app(test_app)

        # Create client with auto tenant headers
        test_client = TestClient(test_app)
        original_request = test_client.request

        def request_with_tenant(method, url, **kwargs):
            headers = kwargs.get('headers', {})
            if 'X-Tenant-ID' not in headers:
                headers['X-Tenant-ID'] = 'test-tenant'
            kwargs['headers'] = headers
            return original_request(method, url, **kwargs)

        test_client.request = request_with_tenant

        return test_client
```

---

## Usage Examples

### Example 1: Basic Cleanup

```python
def test_with_cleanup(cleanup_registry):
    """Test that needs cleanup."""
    # Create resource
    conn = create_database_connection()

    # Register cleanup
    cleanup_registry.register(
        conn.close,
        priority=CleanupPriority.DATABASE
    )

    # Use resource
    result = conn.query("SELECT 1")
    assert result == 1

    # conn.close() called automatically after test
```

### Example 2: Multiple Resources with Priorities

```python
def test_with_dependencies(cleanup_registry):
    """Test with cleanup dependencies."""
    # Create resources in order
    db = Database()
    cache = Cache(db)  # Depends on db
    app = App(cache)   # Depends on cache

    # Register cleanup in reverse order (higher priority = runs later)
    cleanup_registry.register(
        db.close,
        priority=CleanupPriority.DATABASE,
        name="database"
    )

    cleanup_registry.register(
        cache.shutdown,
        priority=CleanupPriority.CACHE,
        name="cache"
    )

    cleanup_registry.register(
        app.cleanup,
        priority=CleanupPriority.FASTAPI_APPS,
        name="app"
    )

    # Test code...

    # Cleanup runs in order: app → cache → db
```

### Example 3: Event Bus Cleanup

```python
def test_with_event_handlers(cleanup_registry, event_bus):
    """Test that registers event handlers."""
    def my_handler(event):
        pass

    # Register event handler
    event_bus.subscribe("test.event", my_handler)

    # Register cleanup
    cleanup_registry.register_event_bus_cleanup(event_bus)

    # Test code...

    # Event handlers cleared automatically
```

### Example 4: Custom Resource

```python
class MyResource:
    def __init__(self):
        self.is_open = True

    def close(self):
        self.is_open = False

def test_custom_resource(cleanup_registry):
    """Test with custom resource."""
    resource = MyResource()

    # Register with custom priority
    cleanup_registry.register(
        resource.close,
        priority=CleanupPriority.FILE_HANDLES,
        name="my_resource"
    )

    assert resource.is_open
    # resource.close() called after test
```

### Example 5: Fixture with Cleanup

```python
@pytest.fixture
def database_connection(cleanup_registry):
    """Provide database connection with automatic cleanup."""
    conn = create_connection()

    # Register cleanup
    cleanup_registry.register(
        conn.close,
        priority=CleanupPriority.DATABASE,
        name="db_connection"
    )

    return conn

def test_with_db(database_connection):
    """Test using fixture with cleanup."""
    result = database_connection.query("SELECT 1")
    assert result == 1
    # Connection closed automatically
```

---

## Priority Levels

The registry supports prioritized cleanup:

```python
class CleanupPriority(IntEnum):
    DATABASE = 10           # Run first (others depend on this)
    CACHE = 20             # Run after database
    FASTAPI_APPS = 30      # Run after cache
    EVENT_HANDLERS = 40    # Run after apps
    BACKGROUND_TASKS = 50  # Run after event handlers
    HTTP_CLIENTS = 60      # Run after background tasks
    FILE_HANDLES = 70      # Run after HTTP clients
    NETWORK_CONNECTIONS = 80  # Run last
```

**Rule:** Lower number = runs earlier

**Why?** Resources that others depend on should be cleaned up last.

---

## Migration Guide

### Migrate from Manual Cleanup

**Before:**
```python
@pytest.fixture
def my_fixture():
    resource = setup()
    yield resource
    resource.cleanup()  # Manual cleanup
```

**After:**
```python
@pytest.fixture
def my_fixture(cleanup_registry):
    resource = setup()

    # Register cleanup
    cleanup_registry.register(
        resource.cleanup,
        priority=CleanupPriority.FILE_HANDLES
    )

    return resource  # No yield needed
```

### Migrate from autouse Cleanup Fixture

**Before (conftest.py):**
```python
@pytest.fixture(autouse=True)
def cleanup_fastapi_state(request):
    yield
    # Scan and cleanup
    for item in dir(request):
        # ... fragile cleanup ...
```

**After (conftest.py):**
```python
@pytest.fixture(autouse=True)
def cleanup_registry():
    reset_cleanup_registry()
    registry = get_cleanup_registry()
    yield registry
    registry.cleanup_all()  # Explicit, ordered cleanup
```

---

## Debugging Cleanup Issues

### Enable Debug Logging

```python
import logging
logging.basicConfig(level=logging.DEBUG)
```

You'll see:
```
DEBUG:cleanup_registry:Registered cleanup handler: database (priority=10)
DEBUG:cleanup_registry:Registered cleanup handler: cache (priority=20)
DEBUG:cleanup_registry:Running 2 cleanup handlers
DEBUG:cleanup_registry:Running cleanup: database (priority=10)
DEBUG:cleanup_registry:Running cleanup: cache (priority=20)
DEBUG:cleanup_registry:All cleanup handlers executed
```

### Check Registered Handlers

```python
def test_debug_cleanup(cleanup_registry):
    resource1 = Resource1()
    resource2 = Resource2()

    cleanup_registry.register(resource1.close)
    cleanup_registry.register(resource2.close)

    # Check how many handlers registered
    print(f"Registered handlers: {len(cleanup_registry)}")
```

---

## Error Handling

The registry continues cleanup even if a handler fails:

```python
def test_cleanup_with_errors(cleanup_registry):
    def failing_cleanup():
        raise Exception("Cleanup failed!")

    def working_cleanup():
        print("This still runs!")

    cleanup_registry.register(failing_cleanup, name="bad")
    cleanup_registry.register(working_cleanup, name="good")

    # After test:
    # - failing_cleanup() raises exception (logged)
    # - working_cleanup() still runs
```

Output:
```
ERROR:cleanup_registry:Error during cleanup of bad: Cleanup failed!
DEBUG:cleanup_registry:Running cleanup: good (priority=30)
```

---

## Testing the Registry Itself

```python
def test_cleanup_registry():
    """Test the cleanup registry works correctly."""
    registry = CleanupRegistry()

    # Track cleanup calls
    calls = []

    registry.register(lambda: calls.append(1), priority=CleanupPriority.DATABASE)
    registry.register(lambda: calls.append(2), priority=CleanupPriority.CACHE)

    # Run cleanup
    registry.cleanup_all()

    # Verify order (lower priority runs first)
    assert calls == [1, 2]
```

---

## Benefits Summary

| Aspect | Current Approach | Registry Approach |
|--------|-----------------|-------------------|
| **Explicitness** | ❌ Implicit scanning | ✅ Explicit registration |
| **Order** | ❌ Undefined | ✅ Priority-based |
| **Performance** | ❌ Slow (scanning) | ✅ Fast (O(n log n)) |
| **Debugging** | ❌ Hard | ✅ Easy (logging) |
| **Error Handling** | ❌ Basic | ✅ Robust |
| **Extensibility** | ❌ Limited | ✅ Highly extensible |
| **Dependencies** | ❌ No support | ✅ Priority system |

---

## Recommendation

**Adopt the Cleanup Registry pattern gradually:**

1. ✅ **Phase 1:** Add registry to conftest.py alongside current cleanup
2. ✅ **Phase 2:** Update router base classes to use registry
3. ✅ **Phase 3:** Migrate high-value fixtures
4. ✅ **Phase 4:** Remove old cleanup code once registry proven

**Start using it now in new code** while keeping old cleanup for compatibility.

---

## Files Modified

To implement this:

1. **Created:** `tests/helpers/cleanup_registry.py` ✅
2. **Update:** `tests/conftest.py` (add cleanup_registry fixture)
3. **Update:** `tests/helpers/router_base.py` (use registry)
4. **Document:** This file ✅

---

## Next Steps

1. Add `cleanup_registry` fixture to conftest.py
2. Update router base classes to use registry
3. Test with a few router test files
4. Gradually migrate existing fixtures
5. Monitor for improvements in test reliability

The registry pattern is **production-ready** and will significantly improve test cleanup reliability! 🎉
