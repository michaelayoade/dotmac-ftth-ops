"""Smoke tests for platform feature flag exposure to frontends."""

from __future__ import annotations

import pytest
import pytest_asyncio
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

pytestmark = pytest.mark.integration

from dotmac.platform.config.router import router as config_router, health_router, PUBLIC_FEATURE_FLAGS
from dotmac.platform.settings import Settings, Environment, get_settings


@pytest.fixture
def config_app():
    app = FastAPI()
    app.include_router(config_router, prefix="/api/v1")
    app.include_router(health_router, prefix="/api/v1")

    # Provide deterministic settings with all feature flags enabled for the public list
    features = Settings.FeatureFlags(**{flag: True for flag in Settings.FeatureFlags.model_fields})
    brand = Settings.BrandSettings(
        product_name="Runtime Product",
        product_tagline="Runtime Tagline",
        company_name="Runtime Co",
        support_email="support@runtime.test",
        success_email="success@runtime.test",
        operations_email="ops@runtime.test",
        partner_support_email="partners@runtime.test",
        notification_domain="runtime.test",
    )
    settings = Settings(
        features=features,
        environment=Environment.DEVELOPMENT,
        app_name="TestApp",
        app_version="1.0.0",
        TENANT_ID="tenant-public",
        brand=brand,
    )

    app.dependency_overrides[get_settings] = lambda: settings
    return app


@pytest_asyncio.fixture
async def config_client(config_app):
    transport = ASGITransport(app=config_app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        yield client


@pytest.mark.asyncio
async def test_public_config_features(config_client: AsyncClient):
    resp = await config_client.get("/api/v1/platform/config")
    assert resp.status_code == 200
    body = resp.json()
    assert "features" in body
    # Ensure all public flags are present
    for flag in PUBLIC_FEATURE_FLAGS:
        assert flag in body["features"]


@pytest.mark.asyncio
async def test_runtime_config_cache_and_paths(config_client: AsyncClient):
    resp = await config_client.get("/api/v1/platform/runtime-config")
    assert resp.status_code == 200
    assert "Cache-Control" in resp.headers
    data = resp.json()
    assert data["api"]["rest_path"] == "/api/v1"
    assert "features" in data and all(flag in data["features"] for flag in PUBLIC_FEATURE_FLAGS)


@pytest.mark.asyncio
async def test_public_branding_endpoint(config_client: AsyncClient):
    resp = await config_client.get("/api/v1/branding")
    assert resp.status_code == 200
    data = resp.json()

    assert data["tenant_id"] == "tenant-public"
    assert data["branding"]["product_name"] == "Runtime Product"
    assert data["branding"]["company_name"] == "Runtime Co"
    assert data["branding"]["support_email"] == "support@runtime.test"
    assert data["branding"]["success_email"] == "success@runtime.test"
    assert data["branding"]["operations_email"] == "ops@runtime.test"
