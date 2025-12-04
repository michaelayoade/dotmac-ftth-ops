import pytest

from dotmac.platform.workflows.service_registry import ServiceRegistry

pytestmark = pytest.mark.integration


class DummyService:
    def __init__(self, db):
        self.db = db
        self.created = True


def test_register_and_get_service(async_db_session):
    registry = ServiceRegistry(async_db_session)
    service = DummyService(async_db_session)

    registry.register_service("dummy", service)

    retrieved = registry.get_service("dummy")
    assert retrieved is service
    assert registry.has_service("dummy") is True


def test_factory_registration_creates_instance_once(async_db_session):
    registry = ServiceRegistry(async_db_session)
    created = []

    def factory(db):
        created.append(db)
        return DummyService(db)

    registry.register_factory("factory_service", factory)

    first = registry.get_service("factory_service")
    second = registry.get_service("factory_service")

    assert isinstance(first, DummyService)
    assert first is second  # cached instance reused
    assert created == [async_db_session]  # factory invoked once
    assert registry.has_service("factory_service")


def test_missing_service_raises(async_db_session):
    registry = ServiceRegistry(async_db_session)

    with pytest.raises(ValueError):
        registry.get_service("nonexistent")
