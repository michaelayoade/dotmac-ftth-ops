"""Miscellaneous fixtures shared across the test suite."""

from __future__ import annotations

import copy
import logging
import threading
from collections.abc import Callable, Iterable, Mapping, Sequence
from typing import TYPE_CHECKING, Any

import pytest

from tests.fixtures.environment import HAS_FAKEREDIS, HAS_FASTAPI, HAS_SQLALCHEMY

logger = logging.getLogger(__name__)
CONFIG_LOCK = threading.RLock()

DEFAULT_TEST_USER_PERMISSIONS: Sequence[str] = (
    "read",
    "write",
    "admin",
    "access:read",
    "access:write",
    "billing:read",
    "billing:write",
    "billing:subscriptions:read",
    "billing:subscriptions:write",
    "billing:invoices:read",
    "billing:invoices:write",
    "billing:payments:read",
    "billing:payments:write",
    "customer:read",
    "customer:write",
)

if TYPE_CHECKING:
    from dotmac.platform.auth.core import UserInfo


def _clone_platform_config(config: Any) -> Any:
    """Attempt to copy platform config so tests can mutate safely."""
    try:
        clone = copy.deepcopy(config)
    except Exception:
        logger.debug("Deep copy of platform config failed; attempting shallow copy.", exc_info=True)
        try:
            clone = copy.copy(config)
        except Exception:
            logger.debug(
                "Shallow copy of platform config failed; falling back to shared instance.",
                exc_info=True,
            )
            clone = config
    return clone


@pytest.fixture
def communications_config() -> dict[str, Any]:
    """Mock communications configuration for notification tests."""
    return {
        "notifications": {
            "email": {
                "enabled": True,
                "smtp_host": "localhost",
                "smtp_port": 1025,
                "from_address": "test@example.com",
            },
            "sms": {"enabled": False},
            "push": {"enabled": False},
        },
        "webhooks": {
            "enabled": True,
            "timeout": 30,
            "retry_attempts": 3,
        },
        "rate_limits": {
            "email": 100,
            "sms": 10,
            "push": 1000,
        },
    }


def pytest_collection_modifyitems(config, items):
    """Skip tests that require optional dependencies when unavailable."""
    skip_no_redis = pytest.mark.skip(reason="fakeredis not available")
    skip_no_db = pytest.mark.skip(reason="sqlalchemy not available")
    skip_no_fastapi = pytest.mark.skip(reason="fastapi not available")

    for item in items:
        if "redis" in item.keywords and not HAS_FAKEREDIS:
            item.add_marker(skip_no_redis)

        if "database" in item.keywords and not HAS_SQLALCHEMY:
            item.add_marker(skip_no_db)

        if "fastapi" in item.keywords and not HAS_FASTAPI:
            item.add_marker(skip_no_fastapi)


@pytest.fixture(autouse=True, scope="session")
def configure_celery_for_tests():
    """Force Celery to execute tasks eagerly during tests."""
    try:
        from dotmac.platform.celery_app import celery_app

        original_always_eager = celery_app.conf.get("task_always_eager", False)
        original_eager_propagates = celery_app.conf.get("task_eager_propagates", True)

        celery_app.conf.update(task_always_eager=True, task_eager_propagates=True)
        yield
        celery_app.conf.update(
            task_always_eager=original_always_eager,
            task_eager_propagates=original_eager_propagates,
        )
    except ImportError:
        yield


# ---------------------------------------------------------------------------
# Authenticated client helpers
# ---------------------------------------------------------------------------


@pytest.fixture
def test_user_factory() -> Callable[..., UserInfo]:
    """Factory for creating configurable tenant users for API authentication."""
    from uuid import uuid4

    from dotmac.platform.auth.core import UserInfo

    def factory(
        *,
        user_id: str | None = None,
        tenant_id: str | None = None,
        email: str = "test@example.com",
        is_platform_admin: bool = True,
        username: str = "testuser",
        roles: Iterable[str] | None = None,
        permissions: Iterable[str] | None = None,
    ) -> UserInfo:
        return UserInfo(
            user_id=user_id or str(uuid4()),
            tenant_id=tenant_id or f"test_tenant_{uuid4()}",
            email=email,
            is_platform_admin=is_platform_admin,
            username=username,
            roles=list(roles) if roles is not None else ["admin"],
            permissions=list(permissions)
            if permissions is not None
            else list(DEFAULT_TEST_USER_PERMISSIONS),
        )

    return factory


@pytest.fixture
def test_user(test_user_factory) -> UserInfo:
    """Create a privileged tenant user for API authentication."""
    return test_user_factory()


@pytest.fixture
def authenticated_sync_client(test_app, test_user):
    """Create a synchronous TestClient with authentication overrides."""
    from starlette.testclient import TestClient

    from dotmac.platform.auth.dependencies import get_current_user

    test_app.dependency_overrides[get_current_user] = lambda: test_user
    client = TestClient(test_app)
    try:
        yield client
    finally:
        test_app.dependency_overrides.clear()


@pytest.fixture
def authenticated_client_with_tenant(test_app, test_user):
    """Wrap TestClient to automatically inject tenant headers."""
    from starlette.testclient import TestClient

    from dotmac.platform.auth.dependencies import get_current_user

    test_app.dependency_overrides[get_current_user] = lambda: test_user
    base_client = TestClient(test_app)

    class TenantAwareClient:
        def __init__(self, client: TestClient, tenant_id: str) -> None:
            self._client = client
            self._tenant_id = tenant_id

        def _with_header(self, kwargs: dict) -> dict:
            headers = kwargs.get("headers")
            if headers is None:
                kwargs["headers"] = {"X-Tenant-ID": self._tenant_id}
            elif isinstance(headers, Mapping):
                updated = dict(headers)
                updated["X-Tenant-ID"] = self._tenant_id
                kwargs["headers"] = updated
            else:
                header_items = list(headers)
                header_items.append(("X-Tenant-ID", self._tenant_id))
                kwargs["headers"] = header_items
            return kwargs

        def get(self, *args, **kwargs):
            return self._client.get(*args, **self._with_header(kwargs))

        def post(self, *args, **kwargs):
            return self._client.post(*args, **self._with_header(kwargs))

        def put(self, *args, **kwargs):
            return self._client.put(*args, **self._with_header(kwargs))

        def patch(self, *args, **kwargs):
            return self._client.patch(*args, **self._with_header(kwargs))

        def delete(self, *args, **kwargs):
            return self._client.delete(*args, **self._with_header(kwargs))

        def __getattr__(self, name):
            return getattr(self._client, name)

    wrapped_client = TenantAwareClient(base_client, test_user.tenant_id)
    try:
        yield wrapped_client
    finally:
        test_app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# Fake services used in multiple test suites
# ---------------------------------------------------------------------------

try:
    from tests.helpers.fakes import (
        FakeCache,
        FakeEmailService,
        FakePaymentGateway,
        FakeSMSService,
        FakeStorageClient,
    )

    HAS_FAKES = True
except ImportError as exc:
    HAS_FAKES = False
    logger.warning(
        "tests.helpers.fakes unavailable; fake service fixtures disabled. (%s)",
        exc,
        exc_info=True,
    )


if HAS_FAKES:

    @pytest.fixture
    def payment_gateway_fake():
        return FakePaymentGateway()

    @pytest.fixture
    def email_service_fake():
        return FakeEmailService()

    @pytest.fixture
    def sms_service_fake():
        return FakeSMSService()

    @pytest.fixture
    def storage_client_fake():
        return FakeStorageClient()

    @pytest.fixture
    def cache_fake():
        return FakeCache()


@pytest.fixture(autouse=True)
def reset_platform_config():
    """Ensure global platform config is restored between tests."""
    import dotmac.platform as platform_module

    with CONFIG_LOCK:
        original_config = platform_module.config
        cloned_config = _clone_platform_config(platform_module.config)
        if cloned_config is original_config:
            logger.warning(
                "Platform config fixture is reusing the global config instance; "
                "mutations may leak between tests."
            )
        platform_module.config = cloned_config

    try:
        yield
    finally:
        with CONFIG_LOCK:
            platform_module.config = original_config
            if not hasattr(platform_module.config, "get"):
                from dotmac.platform import PlatformConfig

                platform_module.config = PlatformConfig()


__all__ = [
    "authenticated_client_with_tenant",
    "authenticated_sync_client",
    "communications_config",
    "configure_celery_for_tests",
    "reset_platform_config",
    "test_user",
    "test_user_factory",
]

if HAS_FAKES:
    __all__.extend(
        [
            "cache_fake",
            "email_service_fake",
            "payment_gateway_fake",
            "sms_service_fake",
            "storage_client_fake",
        ]
    )
