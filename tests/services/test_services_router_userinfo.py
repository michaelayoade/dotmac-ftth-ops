from datetime import datetime
from types import SimpleNamespace
from uuid import UUID, uuid4

import pytest

from dotmac.platform.auth.core import UserInfo
from dotmac.platform.services import router as services_router
from dotmac.platform.services.router import ConvertLeadRequest








pytestmark = pytest.mark.integration

class DummySession:
    async def commit(self) -> None:  # pragma: no cover - simple stub
        return None

    async def rollback(self) -> None:  # pragma: no cover - simple stub
        return None


@pytest.mark.asyncio
async def test_convert_lead_to_customer_uses_userinfo_uuid(monkeypatch):
    called = {}

    class DummyService:
        def __init__(self, db):
            self.db = db

        async def convert_lead_to_customer(self, *, tenant_id, lead_id, accepted_quote_id, user_id):
            called["tenant_id"] = tenant_id
            called["lead_id"] = lead_id
            called["accepted_quote_id"] = accepted_quote_id
            called["user_id"] = user_id
            customer_identifier = uuid4()
            called["customer_id"] = customer_identifier
            return {
                "customer": SimpleNamespace(id=customer_identifier),
                "lead": SimpleNamespace(id=lead_id),
                "quote": SimpleNamespace(id=accepted_quote_id),
                "conversion_date": datetime.utcnow(),
            }

    monkeypatch.setattr(services_router, "OrchestrationService", DummyService)

    request = ConvertLeadRequest(lead_id=uuid4(), accepted_quote_id=uuid4())
    user = UserInfo(
        user_id=str(uuid4()),
        email="user@example.com",
        username="user",
        roles=[],
        permissions=[],
        tenant_id="tenant-001",
        is_platform_admin=False,
    )

    response = await services_router.convert_lead_to_customer(request, DummySession(), user)

    assert response.customer_id == called["customer_id"]
    assert called["tenant_id"] == user.tenant_id
    assert called["lead_id"] == request.lead_id
    assert called["accepted_quote_id"] == request.accepted_quote_id
    assert called["user_id"] == UUID(user.user_id)
