from unittest.mock import AsyncMock, MagicMock

from dotmac.platform.services.orchestration import OrchestrationService


def test_orchestration_service_init_without_radius_type_error():
    """Ensure default construction no longer raises missing-arg errors."""
    session = AsyncMock()
    service = OrchestrationService(session)
    # the lazy factory should exist and be callable
    assert callable(service._radius_service_factory)  # type: ignore[attr-defined]


def test_orchestration_service_uses_radius_factory(monkeypatch):
    """Verify tenant-aware factory is invoked with session and tenant."""
    session = AsyncMock()
    mock_radius = MagicMock()
    factory = MagicMock(return_value=mock_radius)

    service = OrchestrationService(session, radius_service=factory)

    radius_instance = service._get_radius_service("tenant-123")  # type: ignore[attr-defined]

    assert radius_instance is mock_radius
    factory.assert_called_once_with(session, "tenant-123")
