"""
Test real services connectivity.
"""

import os

import hvac
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text

import redis
from dotmac.platform.observability.manager import ObservabilityManager

# Mark all tests in this module as integration tests


pytestmark = [
    pytest.mark.asyncio,
    pytest.mark.integration,
    pytest.mark.skipif(
        os.getenv("DOTMAC_LIVE") != "1", reason="Live integration disabled (set DOTMAC_LIVE=1)"
    ),
]


def test_postgres_connection():
    """Test PostgreSQL connection."""
    engine = create_engine("postgresql://dotmac:dotmac_password@localhost:5432/dotmac")

    with engine.connect() as conn:
        result = conn.execute(text("SELECT 1")).scalar()
        assert result == 1

        # Check schemas exist
        schemas = conn.execute(
            text(
                """
            SELECT schema_name 
            FROM information_schema.schemata 
            WHERE schema_name IN ('auth', 'secrets', 'tenant')
            ORDER BY schema_name
        """
            )
        ).fetchall()

        schema_names = [s[0] for s in schemas]
        assert "auth" in schema_names
        assert "secrets" in schema_names
        assert "tenant" in schema_names


@pytest.mark.asyncio
async def test_redis_connection():
    """Test Redis connection."""
    client = redis.from_url("redis://localhost:6379/0", decode_responses=True)

    # Test basic operations
    client.set("test:key", "test_value")
    assert client.get("test:key") == "test_value"

    # Clean up
    client.delete("test:key")
    # client.close() may not be awaitable depending on the client type
    if hasattr(client, "close"):
        close_method = client.close
        if hasattr(close_method, "__await__"):
            await close_method()
        else:
            close_method()


def test_openbao_connection():
    """Test OpenBao connection."""
    client = hvac.Client(url="http://localhost:8200", token="root-token")

    # Check authentication
    assert client.is_authenticated()

    # Test basic secret operations
    mount_point = "secret"

    # Write a secret
    client.secrets.kv.v2.create_or_update_secret(
        path="test/secret", secret={"key": "value"}, mount_point=mount_point
    )

    # Read it back
    response = client.secrets.kv.v2.read_secret_version(path="test/secret", mount_point=mount_point)
    assert response["data"]["data"]["key"] == "value"

    # Clean up
    client.secrets.kv.v2.delete_metadata_and_all_versions(
        path="test/secret", mount_point=mount_point
    )


def test_observability_with_otlp():
    """Test ObservabilityManager with OTLP endpoint."""
    manager = ObservabilityManager(
        service_name="test-service",
        environment="development",  # Use valid environment
        otlp_endpoint="http://localhost:4317",
        enable_tracing=True,
        enable_metrics=True,
    )

    # Initialize should not raise
    manager.initialize()

    # Create a test app
    app = FastAPI(title="Test App")

    @app.get("/test")
    def test_endpoint():
        return {"status": "ok"}

    # Apply middleware
    manager.apply_middleware(app)

    # Test that the app works with middleware
    client = TestClient(app)
    response = client.get("/test")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}

    # Shutdown
    manager.shutdown()


def test_seeded_data():
    """Test that seeded data exists in database."""
    engine = create_engine("postgresql://dotmac:dotmac_password@localhost:5432/dotmac")

    with engine.connect() as conn:
        # Check test tenant exists
        tenant = conn.execute(
            text(
                """
            SELECT id, name, domain 
            FROM tenant.tenants 
            WHERE name = 'Test Tenant'
        """
            )
        ).fetchone()

        assert tenant is not None
        assert tenant[1] == "Test Tenant"
        assert tenant[2] == "test.localhost"

        # Check test users exist
        users = conn.execute(
            text(
                """
            SELECT email, username 
            FROM auth.users 
            WHERE email IN ('admin@test.local', 'user@test.local')
            ORDER BY email
        """
            )
        ).fetchall()

        assert len(users) == 2
        assert users[0][0] == "admin@test.local"
        assert users[1][0] == "user@test.local"


if __name__ == "__main__":
    # Run tests
    test_postgres_connection()
    print("✓ PostgreSQL connection successful")

    test_redis_connection()
    print("✓ Redis connection successful")

    test_openbao_connection()
    print("✓ OpenBao connection successful")

    test_observability_with_otlp()
    print("✓ Observability with OTLP successful")

    test_seeded_data()
    print("✓ Seeded data verified")

    print("\nAll real service tests passed!")
