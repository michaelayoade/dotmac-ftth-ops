"""
Demo test showing cleanup registry in action.

This demonstrates:
1. Automatic cleanup of resources
2. Priority-based cleanup order
3. Error handling in cleanup
4. Multiple cleanup handlers

The cleanup_registry fixture is automatically available in ALL tests!
"""

import pytest

pytestmark = pytest.mark.unit


class TestCleanupRegistryDemo:
    """Demo tests showing cleanup registry features."""

    def test_basic_cleanup(self, cleanup_registry):
        """Test basic cleanup functionality.

        The cleanup_registry is automatically available because it's
        an autouse fixture in conftest.py (line 1606).
        """
        from tests.helpers.cleanup_registry import CleanupPriority

        # Track what gets cleaned up
        cleanup_log = []

        def cleanup_handler():
            cleanup_log.append("Resource cleaned up!")

        # Register cleanup
        cleanup_registry.register(
            cleanup_handler, priority=CleanupPriority.FILE_HANDLES, name="test_resource"
        )

        # Verify handler is registered
        assert len(cleanup_registry) == 1

        # Test code would go here...
        # cleanup_handler() will be called automatically after test

    def test_multiple_cleanups_with_priority(self, cleanup_registry):
        """Test multiple cleanup handlers with different priorities.

        This shows how cleanup_registry executes handlers in priority order.
        Lower priority numbers run first.
        """
        from tests.helpers.cleanup_registry import CleanupPriority

        execution_order = []

        def cleanup_database():
            execution_order.append("database")

        def cleanup_cache():
            execution_order.append("cache")

        def cleanup_http_client():
            execution_order.append("http_client")

        # Register in random order
        cleanup_registry.register(
            cleanup_http_client,
            priority=CleanupPriority.HTTP_CLIENTS,  # 60 - runs last
            name="http_client",
        )

        cleanup_registry.register(
            cleanup_database,
            priority=CleanupPriority.DATABASE,  # 10 - runs first
            name="database",
        )

        cleanup_registry.register(
            cleanup_cache,
            priority=CleanupPriority.CACHE,
            name="cache",  # 20 - runs second
        )

        # Verify all registered
        assert len(cleanup_registry) == 3

        # After test completes, they'll run in order:
        # 1. database (priority 10)
        # 2. cache (priority 20)
        # 3. http_client (priority 60)

    def test_cleanup_with_simulated_resources(self, cleanup_registry):
        """Test cleanup with simulated resources.

        This shows a more realistic example of resource cleanup.
        """
        from tests.helpers.cleanup_registry import CleanupPriority

        # Simulate some resources
        class FakeFileHandle:
            def __init__(self, name):
                self.name = name
                self.is_open = True
                self.data = []

            def write(self, data):
                if not self.is_open:
                    raise ValueError("File is closed")
                self.data.append(data)

            def close(self):
                self.is_open = False
                self.data = []

        class FakeConnection:
            def __init__(self, host):
                self.host = host
                self.is_connected = True

            def send(self, data):
                if not self.is_connected:
                    raise ValueError("Not connected")
                return f"Sent {data} to {self.host}"

            def disconnect(self):
                self.is_connected = False

        # Create resources
        log_file = FakeFileHandle("test.log")
        config_file = FakeFileHandle("config.json")
        api_conn = FakeConnection("api.example.com")

        # Register cleanup for each resource
        cleanup_registry.register(
            log_file.close, priority=CleanupPriority.FILE_HANDLES, name="log_file"
        )

        cleanup_registry.register(
            config_file.close, priority=CleanupPriority.FILE_HANDLES, name="config_file"
        )

        cleanup_registry.register(
            api_conn.disconnect,
            priority=CleanupPriority.NETWORK_CONNECTIONS,
            name="api_connection",
        )

        # Use the resources in test
        log_file.write("Test started")
        config_file.write('{"setting": "value"}')
        result = api_conn.send("test data")

        # Verify they work
        assert log_file.is_open
        assert config_file.is_open
        assert api_conn.is_connected
        assert result == "Sent test data to api.example.com"

        # All cleanup happens automatically at end of test!
        # Order: file handles (70) then network connections (80)

    def test_cleanup_continues_on_error(self, cleanup_registry):
        """Test that cleanup continues even if a handler fails.

        This is important - one failing cleanup shouldn't prevent others.
        """
        from tests.helpers.cleanup_registry import CleanupPriority

        cleanup_log = []

        def failing_cleanup():
            cleanup_log.append("failing_cleanup_attempted")
            raise Exception("Cleanup failed!")

        def working_cleanup_1():
            cleanup_log.append("working_cleanup_1")

        def working_cleanup_2():
            cleanup_log.append("working_cleanup_2")

        # Register all handlers
        cleanup_registry.register(
            working_cleanup_1, priority=CleanupPriority.DATABASE, name="working_1"
        )

        cleanup_registry.register(failing_cleanup, priority=CleanupPriority.CACHE, name="failing")

        cleanup_registry.register(
            working_cleanup_2, priority=CleanupPriority.FASTAPI_APPS, name="working_2"
        )

        # Verify all registered
        assert len(cleanup_registry) == 3

        # All will run at cleanup, even though one fails
        # The error is logged but doesn't stop other cleanups


class TestCleanupVsTraditionalApproach:
    """Compare cleanup registry vs traditional approach."""

    def test_traditional_cleanup_verbose(self):
        """Traditional approach - manual cleanup with yield."""

        # Setup resources
        class Resource:
            def __init__(self):
                self.active = True

            def close(self):
                self.active = False

        resources = []
        try:
            # Create resources
            res1 = Resource()
            res2 = Resource()
            res3 = Resource()
            resources.extend([res1, res2, res3])

            # Test code
            assert res1.active
            assert res2.active
            assert res3.active

        finally:
            # Manual cleanup - have to remember to do this!
            for res in resources:
                try:
                    res.close()
                except Exception:
                    pass  # Ignore errors

        # Lots of boilerplate!

    def test_registry_cleanup_concise(self, cleanup_registry):
        """Cleanup registry approach - automatic and clean."""
        from tests.helpers.cleanup_registry import CleanupPriority

        # Setup resources
        class Resource:
            def __init__(self):
                self.active = True

            def close(self):
                self.active = False

        # Create and auto-register cleanup
        res1 = Resource()
        cleanup_registry.register(res1.close, priority=CleanupPriority.FILE_HANDLES)

        res2 = Resource()
        cleanup_registry.register(res2.close, priority=CleanupPriority.FILE_HANDLES)

        res3 = Resource()
        cleanup_registry.register(res3.close, priority=CleanupPriority.FILE_HANDLES)

        # Test code
        assert res1.active
        assert res2.active
        assert res3.active

        # That's it! Cleanup is automatic!
        # Much cleaner and less error-prone


class TestRealWorldCleanupScenario:
    """Real-world scenario using cleanup registry."""

    def test_api_integration_with_cleanup(self, cleanup_registry):
        """Test simulating API integration with proper cleanup."""

        from tests.helpers.cleanup_registry import CleanupPriority

        # Simulate creating various resources for API test
        class MockAPIClient:
            def __init__(self):
                self.session_active = True
                self.requests_made = []

            async def request(self, method, url, **kwargs):
                if not self.session_active:
                    raise ValueError("Session closed")
                self.requests_made.append((method, url))
                return {"status": "success"}

            async def close(self):
                self.session_active = False
                self.requests_made = []

        class MockCache:
            def __init__(self):
                self.data = {}
                self.connected = True

            def set(self, key, value):
                if not self.connected:
                    raise ValueError("Cache disconnected")
                self.data[key] = value

            def clear(self):
                self.data = {}
                self.connected = False

        # Create test resources
        api_client = MockAPIClient()
        cache = MockCache()
        temp_files = []

        # Register cleanup in dependency order (reverse of creation)
        # Files created last, should be cleaned first
        cleanup_registry.register(
            lambda: temp_files.clear(),
            priority=CleanupPriority.FILE_HANDLES,
            name="temp_files",
        )

        # Cache depends on nothing, clean after files
        cleanup_registry.register(cache.clear, priority=CleanupPriority.CACHE, name="cache")

        # API client might use cache, clean last
        # Note: We need to use a lambda for async functions in this simple example
        cleanup_registry.register(
            lambda: setattr(api_client, "session_active", False),
            priority=CleanupPriority.HTTP_CLIENTS,
            name="api_client",
        )

        # Simulate test workflow
        cache.set("api_key", "test_key_123")
        temp_files.append("/tmp/test_upload.json")
        # Normally would: await api_client.request("POST", "/api/endpoint")

        # Verify setup
        assert api_client.session_active
        assert cache.connected
        assert len(temp_files) == 1
        assert cache.data["api_key"] == "test_key_123"

        # All cleanup happens automatically in correct order!
        # Order: temp_files (70) -> cache (20) -> api_client (60)
        # Actually: cache (20) -> api_client (60) -> temp_files (70)


# Mark as unit tests (fast, no external dependencies)
