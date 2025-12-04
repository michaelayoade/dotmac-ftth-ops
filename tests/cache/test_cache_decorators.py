from types import SimpleNamespace

import pytest

from dotmac.platform.cache.decorators import cache_aside, cached

pytestmark = pytest.mark.unit


class StubCacheService:
    def __init__(self) -> None:
        self.data: dict[str, object] = {}
        self.recorded_keys: list[str] = []

    async def get(self, key: str, namespace, tenant_id):
        self.recorded_keys.append(key)
        return self.data.get(key)

    async def set(self, key: str, value, namespace, tenant_id, ttl):
        self.data[key] = value
        return True

    async def delete(self, key: str, namespace, tenant_id):
        self.data.pop(key, None)
        return True

    async def invalidate_pattern(self, pattern: str, namespace, tenant_id):
        return 0


@pytest.mark.asyncio
async def test_cached_includes_user_attribute(monkeypatch):
    cache = StubCacheService()
    monkeypatch.setattr(
        "dotmac.platform.cache.decorators.get_cache_service",
        lambda: cache,
    )

    calls = {"count": 0}

    @cached(include_tenant=False, include_user=True)
    async def load_dashboard(user_obj):
        calls["count"] += 1
        return {"user": user_obj.user_id}

    user = SimpleNamespace(user_id="user-123")

    result1 = await load_dashboard(user)
    result2 = await load_dashboard(user)

    assert result1 == {"user": "user-123"}
    assert result2 == {"user": "user-123"}
    assert calls["count"] == 1
    stored_key = next(iter(cache.data.keys()))
    assert "user:user-123" in stored_key


@pytest.mark.asyncio
async def test_cache_aside_uses_key_builder(monkeypatch):
    cache = StubCacheService()
    monkeypatch.setattr(
        "dotmac.platform.cache.decorators.get_cache_service",
        lambda: cache,
    )

    @cache_aside(ttl=120, key_builder=lambda product_id: f"product:{product_id}")
    async def load_product(product_id: str):
        return {"id": product_id}

    await load_product("abc")
    stored_key = next(iter(cache.data.keys()))
    assert stored_key.endswith("product:abc")


def test_get_cache_service_singleton_respected():
    from dotmac.platform.cache.service import get_cache_service

    svc1 = get_cache_service()
    svc2 = get_cache_service()
    assert svc1 is svc2
