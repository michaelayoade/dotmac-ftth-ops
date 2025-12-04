"""
Docker Infrastructure Fixtures for Integration Tests

Automatically starts and manages Docker Compose services when running integration tests.
Services are started once per test session and cleaned up afterward.
"""

import os
import subprocess
import time
from pathlib import Path

import pytest


# Determine if we should start Docker services
def should_start_docker_services(config):
    """Check if we should start Docker services for integration tests."""
    # Check environment variable override first
    skip_docker = os.getenv("SKIP_DOCKER_SERVICES", "").lower() in ("1", "true", "yes")
    force_docker = os.getenv("FORCE_DOCKER_SERVICES", "").lower() in ("1", "true", "yes")

    if skip_docker:
        return False

    if force_docker:
        return True

    # Check if integration marker is selected
    selected_markers = config.option.markexpr if hasattr(config.option, "markexpr") else ""
    has_integration_marker = "integration" in selected_markers

    # Check if running integration tests via file path
    test_paths = [str(arg) for arg in config.args if not arg.startswith("-")]
    running_integration_dir = any("tests/integration" in str(path) for path in test_paths)

    # Also check if any collected items are integration tests
    has_integration_tests = False
    if hasattr(config, "hook") and hasattr(config.hook, "pytest_collection_finish"):
        # This will be set during collection
        has_integration_tests = getattr(config, "_has_integration_tests", False)

    return has_integration_marker or running_integration_dir or has_integration_tests


@pytest.fixture(scope="session")
def docker_services(request):
    """
    Start Docker Compose services for integration tests.

    This fixture:
    1. Starts PostgreSQL, Redis, and MinIO services
    2. Waits for health checks to pass
    3. Sets up environment variables
    4. Runs database migrations
    5. Cleans up services after tests complete

    Environment Variables:
    - SKIP_DOCKER_SERVICES=1 - Skip starting Docker services (use existing)
    - FORCE_DOCKER_SERVICES=1 - Force start Docker services
    - KEEP_DOCKER_SERVICES=1 - Don't stop services after tests (for debugging)
    """
    # Check if we should start Docker services
    if not should_start_docker_services(request.config):
        pytest.skip("Docker services not required for this test run")
        return

    # Get project root
    project_root = Path(__file__).parent.parent.parent
    compose_file = project_root / "docker-compose.base.yml"

    if not compose_file.exists():
        pytest.skip(f"Docker Compose file not found: {compose_file}")
        return

    # Services to start
    services = ["postgres", "redis", "minio"]

    # Check if Docker is available
    try:
        subprocess.run(
            ["docker", "compose", "version"],
            check=True,
            capture_output=True,
            text=True,
        )
    except (subprocess.CalledProcessError, FileNotFoundError):
        pytest.skip("Docker Compose not available")
        return

    print("\n🐳 Starting Docker services for integration tests...")
    print(f"   Services: {', '.join(services)}")

    # Start services
    try:
        subprocess.run(
            [
                "docker",
                "compose",
                "-f",
                str(compose_file),
                "up",
                "-d",
                "--wait",
                *services,
            ],
            cwd=project_root,
            check=True,
            capture_output=True,
            text=True,
        )
    except subprocess.CalledProcessError as e:
        pytest.skip(f"Failed to start Docker services: {e.stderr}")
        return

    print("✅ Docker services started successfully")

    # Set up environment variables for tests
    test_env = {
        "DATABASE_URL": "postgresql://dotmac_user:change-me@localhost:5432/dotmac_test",
        "DOTMAC_REDIS_URL": "redis://localhost:6379/0",
        "MINIO_ENDPOINT": "localhost:9000",
        "MINIO_ACCESS_KEY": "minioadmin",
        "MINIO_SECRET_KEY": "minioadmin123",
        "REQUIRE_TENANT_HEADER": "false",
    }

    # Store original values
    original_env = {}
    for key, value in test_env.items():
        original_env[key] = os.environ.get(key)
        os.environ[key] = value

    # Wait for services to be fully ready
    print("⏳ Waiting for services to be healthy...")
    max_wait = 60  # seconds
    start_time = time.time()

    while time.time() - start_time < max_wait:
        try:
            # Check PostgreSQL
            result = subprocess.run(
                [
                    "docker",
                    "compose",
                    "-f",
                    str(compose_file),
                    "exec",
                    "-T",
                    "postgres",
                    "pg_isready",
                    "-U",
                    "dotmac_user",
                ],
                cwd=project_root,
                capture_output=True,
                text=True,
            )
            if result.returncode == 0:
                print("✅ PostgreSQL is ready")
                break
        except subprocess.CalledProcessError:
            pass

        time.sleep(1)
    else:
        print("⚠️  Warning: PostgreSQL may not be fully ready")

    # Create test database
    print("📊 Creating test database...")
    try:
        subprocess.run(
            [
                "docker",
                "compose",
                "-f",
                str(compose_file),
                "exec",
                "-T",
                "postgres",
                "psql",
                "-U",
                "dotmac_user",
                "-d",
                "postgres",
                "-c",
                "DROP DATABASE IF EXISTS dotmac_test;",
            ],
            cwd=project_root,
            check=True,
            capture_output=True,
        )
        subprocess.run(
            [
                "docker",
                "compose",
                "-f",
                str(compose_file),
                "exec",
                "-T",
                "postgres",
                "psql",
                "-U",
                "dotmac_user",
                "-d",
                "postgres",
                "-c",
                "CREATE DATABASE dotmac_test;",
            ],
            cwd=project_root,
            check=True,
            capture_output=True,
        )
        print("✅ Test database created")
    except subprocess.CalledProcessError as e:
        print(f"⚠️  Warning: Could not create test database: {e}")

    # Run migrations
    print("🔄 Running database migrations...")
    try:
        subprocess.run(
            ["poetry", "run", "alembic", "upgrade", "head"],
            cwd=project_root,
            check=True,
            capture_output=True,
            text=True,
            env={**os.environ, **test_env},
        )
        print("✅ Migrations completed successfully")
    except subprocess.CalledProcessError as e:
        print(f"⚠️  Warning: Migration failed: {e.stderr}")

    print("🎯 Integration test infrastructure ready!\n")

    # Yield to run tests
    yield {
        "postgres": "postgresql://dotmac_user:change-me@localhost:5432/dotmac_test",
        "redis": "redis://localhost:6379/0",
        "minio": "localhost:9000",
    }

    # Cleanup
    keep_services = os.getenv("KEEP_DOCKER_SERVICES", "").lower() in ("1", "true", "yes")

    if not keep_services:
        print("\n🧹 Cleaning up Docker services...")
        try:
            subprocess.run(
                ["docker", "compose", "-f", str(compose_file), "stop", *services],
                cwd=project_root,
                check=True,
                capture_output=True,
                text=True,
            )
            print("✅ Docker services stopped")
        except subprocess.CalledProcessError as e:
            print(f"⚠️  Warning: Failed to stop services: {e.stderr}")
    else:
        print("\n🔧 Keeping Docker services running (KEEP_DOCKER_SERVICES=1)")

    # Restore original environment
    for key, value in original_env.items():
        if value is None:
            os.environ.pop(key, None)
        else:
            os.environ[key] = value


@pytest.fixture(scope="session", autouse=True)
def auto_docker_services(request):
    """
    Automatically start Docker services for integration tests.

    This fixture runs automatically when integration tests are detected.
    It's autouse=True but checks if it should actually run based on:
    - Test markers (-m integration)
    - Test paths (tests/integration/)
    - Environment variables
    """
    # Only proceed if running integration tests
    if not should_start_docker_services(request.config):
        return

    # Use the docker_services fixture
    try:
        request.getfixturevalue("docker_services")
    except Exception as e:
        print(f"\n⚠️  Warning: Could not start Docker services: {e}")
        print("   Integration tests will use fallback configuration")


def pytest_configure(config):
    """Register custom markers."""
    config.addinivalue_line("markers", "requires_docker: mark test as requiring Docker services")


def pytest_collection_modifyitems(config, items):
    """
    Auto-mark integration tests that require Docker.

    This helps pytest know which tests need the Docker fixtures.
    """
    has_integration = False

    for item in items:
        # Check if test is in integration directory or has integration marker
        is_integration = "integration" in str(item.fspath) or "integration" in [
            mark.name for mark in item.iter_markers()
        ]

        if is_integration:
            has_integration = True
            # Add docker marker if not already present
            if "requires_docker" not in [mark.name for mark in item.iter_markers()]:
                item.add_marker(pytest.mark.requires_docker)

    # Store this for the should_start_docker_services check
    config._has_integration_tests = has_integration
