"""Test tenant isolation for logs endpoints.

This test suite verifies that:
1. Regular users can only see logs from their own tenant
2. Platform admins can see logs from all tenants
3. Users without tenant_id are properly handled
4. All three endpoints (logs, stats, services) enforce tenant isolation
"""

from datetime import UTC, datetime
from uuid import uuid4

import pytest
import pytest_asyncio
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.audit.models import ActivitySeverity, AuditActivity
from dotmac.platform.auth.core import UserInfo, get_current_user
from dotmac.platform.db import get_session_dependency
from dotmac.platform.monitoring.logs_router import logs_router


@pytest.fixture
def app():
    """Create FastAPI app with logs router."""
    app = FastAPI()
    app.include_router(logs_router, prefix="/api/v1")
    return app


@pytest_asyncio.fixture
async def multi_tenant_audit_logs(async_db_session: AsyncSession):
    """Create audit activities for multiple tenants."""
    tenant_a_id = str(uuid4())
    tenant_b_id = str(uuid4())
    tenant_c_id = str(uuid4())

    activities = [
        # Tenant A logs
        AuditActivity(
            id=uuid4(),
            activity_type="user.login",
            description="Tenant A user login",
            severity=ActivitySeverity.LOW.value,
            user_id=str(uuid4()),
            tenant_id=tenant_a_id,
            action="login",
            ip_address="192.168.1.1",
            created_at=datetime.now(UTC),
        ),
        AuditActivity(
            id=uuid4(),
            activity_type="billing.payment",
            description="Tenant A payment",
            severity=ActivitySeverity.MEDIUM.value,
            user_id=str(uuid4()),
            tenant_id=tenant_a_id,
            action="payment_process",
            ip_address="192.168.1.2",
            created_at=datetime.now(UTC),
        ),
        AuditActivity(
            id=uuid4(),
            activity_type="api.request",
            description="Tenant A API request",
            severity=ActivitySeverity.LOW.value,
            user_id=str(uuid4()),
            tenant_id=tenant_a_id,
            action="api_request",
            ip_address="192.168.1.3",
            created_at=datetime.now(UTC),
        ),
        # Tenant B logs
        AuditActivity(
            id=uuid4(),
            activity_type="user.logout",
            description="Tenant B user logout",
            severity=ActivitySeverity.LOW.value,
            user_id=str(uuid4()),
            tenant_id=tenant_b_id,
            action="logout",
            ip_address="10.0.0.1",
            created_at=datetime.now(UTC),
        ),
        AuditActivity(
            id=uuid4(),
            activity_type="billing.invoice",
            description="Tenant B invoice created",
            severity=ActivitySeverity.LOW.value,
            user_id=str(uuid4()),
            tenant_id=tenant_b_id,
            action="invoice_create",
            ip_address="10.0.0.2",
            created_at=datetime.now(UTC),
        ),
        # Tenant C logs
        AuditActivity(
            id=uuid4(),
            activity_type="api.error",
            description="Tenant C API error",
            severity=ActivitySeverity.HIGH.value,
            user_id=str(uuid4()),
            tenant_id=tenant_c_id,
            action="api_request",
            ip_address="172.16.0.1",
            created_at=datetime.now(UTC),
        ),
    ]

    for activity in activities:
        async_db_session.add(activity)
    await async_db_session.commit()

    return {
        "tenant_a_id": tenant_a_id,
        "tenant_b_id": tenant_b_id,
        "tenant_c_id": tenant_c_id,
        "activities": activities,
    }


@pytest.mark.integration
class TestLogsTenantIsolation:
    """Test tenant isolation for logs endpoint."""

    @pytest.mark.asyncio
    async def test_regular_user_sees_only_own_tenant_logs(
        self, app, async_db_session, multi_tenant_audit_logs
    ):
        """Regular users should only see logs from their own tenant."""
        tenant_a_id = multi_tenant_audit_logs["tenant_a_id"]

        # Create a regular user for Tenant A
        tenant_a_user = UserInfo(
            user_id=str(uuid4()),
            username="tenant_a_user",
            email="user@tenant-a.com",
            tenant_id=tenant_a_id,
            roles=["user"],
            permissions=[],
            is_platform_admin=False,
        )

        app.dependency_overrides[get_session_dependency] = lambda: async_db_session
        app.dependency_overrides[get_current_user] = lambda: tenant_a_user

        client = TestClient(app)
        response = client.get("/api/v1/monitoring/logs")

        assert response.status_code == 200
        data = response.json()

        # Should only see 3 logs from Tenant A
        assert data["total"] == 3
        assert len(data["logs"]) == 3

        # Verify all logs belong to Tenant A
        for log in data["logs"]:
            assert log["metadata"]["tenant_id"] == tenant_a_id

    @pytest.mark.asyncio
    async def test_different_tenant_user_sees_different_logs(
        self, app, async_db_session, multi_tenant_audit_logs
    ):
        """Users from different tenants should see different logs."""
        tenant_b_id = multi_tenant_audit_logs["tenant_b_id"]

        # Create a regular user for Tenant B
        tenant_b_user = UserInfo(
            user_id=str(uuid4()),
            username="tenant_b_user",
            email="user@tenant-b.com",
            tenant_id=tenant_b_id,
            roles=["user"],
            permissions=[],
            is_platform_admin=False,
        )

        app.dependency_overrides[get_session_dependency] = lambda: async_db_session
        app.dependency_overrides[get_current_user] = lambda: tenant_b_user

        client = TestClient(app)
        response = client.get("/api/v1/monitoring/logs")

        assert response.status_code == 200
        data = response.json()

        # Should only see 2 logs from Tenant B
        assert data["total"] == 2
        assert len(data["logs"]) == 2

        # Verify all logs belong to Tenant B
        for log in data["logs"]:
            assert log["metadata"]["tenant_id"] == tenant_b_id

    @pytest.mark.asyncio
    async def test_platform_admin_sees_all_tenant_logs(
        self, app, async_db_session, multi_tenant_audit_logs
    ):
        """Platform admins should see logs from all tenants."""
        # Create a platform admin user (no tenant_id)
        platform_admin = UserInfo(
            user_id=str(uuid4()),
            username="platform_admin",
            email="admin@platform.com",
            tenant_id=None,  # Platform admins have no tenant
            roles=["platform_admin"],
            permissions=["*"],
            is_platform_admin=True,
        )

        app.dependency_overrides[get_session_dependency] = lambda: async_db_session
        app.dependency_overrides[get_current_user] = lambda: platform_admin

        client = TestClient(app)
        response = client.get("/api/v1/monitoring/logs")

        assert response.status_code == 200
        data = response.json()

        # Should see all 6 logs from all tenants
        assert data["total"] == 6
        assert len(data["logs"]) == 6

        # Verify logs from all three tenants are present
        tenant_ids = {log["metadata"]["tenant_id"] for log in data["logs"]}
        assert len(tenant_ids) == 3

    @pytest.mark.asyncio
    async def test_user_without_tenant_id_sees_no_logs(
        self, app, async_db_session, multi_tenant_audit_logs
    ):
        """Non-admin users without tenant_id should see no logs."""
        # Create a user without tenant_id (but not a platform admin)
        user_no_tenant = UserInfo(
            user_id=str(uuid4()),
            username="no_tenant_user",
            email="user@example.com",
            tenant_id=None,
            roles=["user"],
            permissions=[],
            is_platform_admin=False,
        )

        app.dependency_overrides[get_session_dependency] = lambda: async_db_session
        app.dependency_overrides[get_current_user] = lambda: user_no_tenant

        client = TestClient(app)
        response = client.get("/api/v1/monitoring/logs")

        assert response.status_code == 200
        data = response.json()

        # Should see no logs
        assert data["total"] == 0
        assert len(data["logs"]) == 0


@pytest.mark.integration
class TestLogStatsTenantIsolation:
    """Test tenant isolation for log stats endpoint."""

    @pytest.mark.asyncio
    async def test_regular_user_stats_only_own_tenant(
        self, app, async_db_session, multi_tenant_audit_logs
    ):
        """Regular users should only see stats from their own tenant."""
        tenant_a_id = multi_tenant_audit_logs["tenant_a_id"]

        tenant_a_user = UserInfo(
            user_id=str(uuid4()),
            username="tenant_a_user",
            email="user@tenant-a.com",
            tenant_id=tenant_a_id,
            roles=["user"],
            permissions=[],
            is_platform_admin=False,
        )

        app.dependency_overrides[get_session_dependency] = lambda: async_db_session
        app.dependency_overrides[get_current_user] = lambda: tenant_a_user

        client = TestClient(app)
        response = client.get("/api/v1/monitoring/logs/stats")

        assert response.status_code == 200
        data = response.json()

        # Should only see stats for 3 Tenant A logs
        assert data["total"] == 3

        # Tenant A has 2 INFO (LOW) + 1 WARNING (MEDIUM)
        assert data["by_level"]["INFO"] == 2
        assert data["by_level"]["WARNING"] == 1
        assert data["by_level"].get("ERROR", 0) == 0

        # Should have user, billing, and api services
        assert "user" in data["by_service"]
        assert "billing" in data["by_service"]
        assert "api" in data["by_service"]

    @pytest.mark.asyncio
    async def test_platform_admin_stats_all_tenants(
        self, app, async_db_session, multi_tenant_audit_logs
    ):
        """Platform admins should see stats from all tenants."""
        platform_admin = UserInfo(
            user_id=str(uuid4()),
            username="platform_admin",
            email="admin@platform.com",
            tenant_id=None,
            roles=["platform_admin"],
            permissions=["*"],
            is_platform_admin=True,
        )

        app.dependency_overrides[get_session_dependency] = lambda: async_db_session
        app.dependency_overrides[get_current_user] = lambda: platform_admin

        client = TestClient(app)
        response = client.get("/api/v1/monitoring/logs/stats")

        assert response.status_code == 200
        data = response.json()

        # Should see stats for all 6 logs
        assert data["total"] == 6

        # Verify counts across all tenants
        # Tenant A: 2 INFO, 1 WARNING
        # Tenant B: 2 INFO
        # Tenant C: 1 ERROR
        assert data["by_level"]["INFO"] == 4
        assert data["by_level"]["WARNING"] == 1
        assert data["by_level"]["ERROR"] == 1

    @pytest.mark.asyncio
    async def test_user_without_tenant_id_gets_empty_stats(
        self, app, async_db_session, multi_tenant_audit_logs
    ):
        """Non-admin users without tenant_id should get empty stats."""
        user_no_tenant = UserInfo(
            user_id=str(uuid4()),
            username="no_tenant_user",
            email="user@example.com",
            tenant_id=None,
            roles=["user"],
            permissions=[],
            is_platform_admin=False,
        )

        app.dependency_overrides[get_session_dependency] = lambda: async_db_session
        app.dependency_overrides[get_current_user] = lambda: user_no_tenant

        client = TestClient(app)
        response = client.get("/api/v1/monitoring/logs/stats")

        assert response.status_code == 200
        data = response.json()

        # Should see no stats
        assert data["total"] == 0
        assert data["by_level"] == {}
        assert data["by_service"] == {}


@pytest.mark.integration
class TestAvailableServicesTenantIsolation:
    """Test tenant isolation for available services endpoint."""

    @pytest.mark.asyncio
    async def test_regular_user_sees_only_own_tenant_services(
        self, app, async_db_session, multi_tenant_audit_logs
    ):
        """Regular users should only see services from their own tenant."""
        tenant_a_id = multi_tenant_audit_logs["tenant_a_id"]

        tenant_a_user = UserInfo(
            user_id=str(uuid4()),
            username="tenant_a_user",
            email="user@tenant-a.com",
            tenant_id=tenant_a_id,
            roles=["user"],
            permissions=[],
            is_platform_admin=False,
        )

        app.dependency_overrides[get_session_dependency] = lambda: async_db_session
        app.dependency_overrides[get_current_user] = lambda: tenant_a_user

        client = TestClient(app)
        response = client.get("/api/v1/monitoring/logs/services")

        assert response.status_code == 200
        services = response.json()

        # Tenant A has user, billing, and api services
        assert isinstance(services, list)
        assert "user" in services
        assert "billing" in services
        assert "api" in services
        assert len(services) == 3

    @pytest.mark.asyncio
    async def test_different_tenant_sees_different_services(
        self, app, async_db_session, multi_tenant_audit_logs
    ):
        """Users from different tenants should see different services."""
        tenant_b_id = multi_tenant_audit_logs["tenant_b_id"]

        tenant_b_user = UserInfo(
            user_id=str(uuid4()),
            username="tenant_b_user",
            email="user@tenant-b.com",
            tenant_id=tenant_b_id,
            roles=["user"],
            permissions=[],
            is_platform_admin=False,
        )

        app.dependency_overrides[get_session_dependency] = lambda: async_db_session
        app.dependency_overrides[get_current_user] = lambda: tenant_b_user

        client = TestClient(app)
        response = client.get("/api/v1/monitoring/logs/services")

        assert response.status_code == 200
        services = response.json()

        # Tenant B has user and billing services (no api)
        assert isinstance(services, list)
        assert "user" in services
        assert "billing" in services
        assert "api" not in services  # Tenant B has no api logs
        assert len(services) == 2

    @pytest.mark.asyncio
    async def test_platform_admin_sees_all_services(
        self, app, async_db_session, multi_tenant_audit_logs
    ):
        """Platform admins should see services from all tenants."""
        platform_admin = UserInfo(
            user_id=str(uuid4()),
            username="platform_admin",
            email="admin@platform.com",
            tenant_id=None,
            roles=["platform_admin"],
            permissions=["*"],
            is_platform_admin=True,
        )

        app.dependency_overrides[get_session_dependency] = lambda: async_db_session
        app.dependency_overrides[get_current_user] = lambda: platform_admin

        client = TestClient(app)
        response = client.get("/api/v1/monitoring/logs/services")

        assert response.status_code == 200
        services = response.json()

        # Should see all services from all tenants
        assert isinstance(services, list)
        assert "user" in services
        assert "billing" in services
        assert "api" in services
        # Total unique services: user, billing, api
        assert len(services) == 3

    @pytest.mark.asyncio
    async def test_user_without_tenant_id_sees_no_services(
        self, app, async_db_session, multi_tenant_audit_logs
    ):
        """Non-admin users without tenant_id should see no services."""
        user_no_tenant = UserInfo(
            user_id=str(uuid4()),
            username="no_tenant_user",
            email="user@example.com",
            tenant_id=None,
            roles=["user"],
            permissions=[],
            is_platform_admin=False,
        )

        app.dependency_overrides[get_session_dependency] = lambda: async_db_session
        app.dependency_overrides[get_current_user] = lambda: user_no_tenant

        client = TestClient(app)
        response = client.get("/api/v1/monitoring/logs/services")

        assert response.status_code == 200
        services = response.json()

        # Should see no services
        assert services == []


@pytest.mark.integration
class TestTenantIsolationWithFilters:
    """Test that tenant isolation works correctly with various filters."""

    @pytest.mark.asyncio
    async def test_search_respects_tenant_isolation(
        self, app, async_db_session, multi_tenant_audit_logs
    ):
        """Search should only return results from user's tenant."""
        tenant_a_id = multi_tenant_audit_logs["tenant_a_id"]

        tenant_a_user = UserInfo(
            user_id=str(uuid4()),
            username="tenant_a_user",
            email="user@tenant-a.com",
            tenant_id=tenant_a_id,
            roles=["user"],
            permissions=[],
            is_platform_admin=False,
        )

        app.dependency_overrides[get_session_dependency] = lambda: async_db_session
        app.dependency_overrides[get_current_user] = lambda: tenant_a_user

        client = TestClient(app)

        # Search for "payment" - exists in Tenant A
        response = client.get("/api/v1/monitoring/logs?search=payment")
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert all(log["metadata"]["tenant_id"] == tenant_a_id for log in data["logs"])

        # Search for "invoice" - exists in Tenant B but should not be visible
        response = client.get("/api/v1/monitoring/logs?search=invoice")
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 0

    @pytest.mark.asyncio
    async def test_level_filter_respects_tenant_isolation(
        self, app, async_db_session, multi_tenant_audit_logs
    ):
        """Level filter should only show user's tenant logs."""
        tenant_c_id = multi_tenant_audit_logs["tenant_c_id"]

        tenant_c_user = UserInfo(
            user_id=str(uuid4()),
            username="tenant_c_user",
            email="user@tenant-c.com",
            tenant_id=tenant_c_id,
            roles=["user"],
            permissions=[],
            is_platform_admin=False,
        )

        app.dependency_overrides[get_session_dependency] = lambda: async_db_session
        app.dependency_overrides[get_current_user] = lambda: tenant_c_user

        client = TestClient(app)

        # Tenant C has 1 ERROR log
        response = client.get("/api/v1/monitoring/logs?level=ERROR")
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert data["logs"][0]["metadata"]["tenant_id"] == tenant_c_id

    @pytest.mark.asyncio
    async def test_pagination_respects_tenant_isolation(
        self, app, async_db_session, multi_tenant_audit_logs
    ):
        """Pagination should only paginate within user's tenant."""
        tenant_a_id = multi_tenant_audit_logs["tenant_a_id"]

        tenant_a_user = UserInfo(
            user_id=str(uuid4()),
            username="tenant_a_user",
            email="user@tenant-a.com",
            tenant_id=tenant_a_id,
            roles=["user"],
            permissions=[],
            is_platform_admin=False,
        )

        app.dependency_overrides[get_session_dependency] = lambda: async_db_session
        app.dependency_overrides[get_current_user] = lambda: tenant_a_user

        client = TestClient(app)

        # Get first page
        response = client.get("/api/v1/monitoring/logs?page=1&page_size=2")
        assert response.status_code == 200
        data = response.json()
        assert len(data["logs"]) == 2
        assert data["total"] == 3
        assert data["has_more"] is True

        # All logs should belong to Tenant A
        assert all(log["metadata"]["tenant_id"] == tenant_a_id for log in data["logs"])
