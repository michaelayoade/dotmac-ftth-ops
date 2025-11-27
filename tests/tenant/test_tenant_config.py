"""
Test tenant configuration for single and multi-tenant modes.
"""

import os
from unittest.mock import patch

import pytest

from dotmac.platform.tenant import (
    TenantConfiguration,
    TenantMode,
    get_tenant_config,
    set_tenant_config,
)


@pytest.mark.unit
class TestTenantConfiguration:
    """Test tenant configuration behavior."""

    @patch.dict(os.environ, {}, clear=True)
    def test_default_configuration(self):
        """Test explicit single-tenant configuration (default depends on settings.DEPLOYMENT_MODE)."""
        # Explicitly set mode to test the configuration behavior
        config = TenantConfiguration(mode=TenantMode.SINGLE)
        assert config.mode == TenantMode.SINGLE
        assert config.default_tenant_id == "default"
        assert not config.require_tenant_header
        assert config.is_single_tenant
        assert not config.is_multi_tenant

    @patch.dict(os.environ, {}, clear=True)
    def test_single_tenant_configuration(self):
        """Test explicit single-tenant configuration."""
        config = TenantConfiguration(mode=TenantMode.SINGLE)
        assert config.is_single_tenant
        assert not config.is_multi_tenant
        assert not config.require_tenant_header
        assert config.get_tenant_id_for_request(None) == "default"
        assert config.get_tenant_id_for_request("custom") == "default"  # Always default

    @patch.dict(os.environ, {}, clear=True)
    def test_multi_tenant_configuration(self):
        """Test explicit multi-tenant configuration."""
        config = TenantConfiguration(mode=TenantMode.MULTI)
        assert not config.is_single_tenant
        assert config.is_multi_tenant
        assert config.require_tenant_header
        assert config.get_tenant_id_for_request("tenant123") == "tenant123"
        assert config.get_tenant_id_for_request(None) is None  # No fallback by default

    def test_multi_tenant_with_fallback(self):
        """Test multi-tenant with fallback to default."""
        config = TenantConfiguration(mode=TenantMode.MULTI, require_tenant_header=False)
        assert config.is_multi_tenant
        assert not config.require_tenant_header
        assert config.get_tenant_id_for_request("tenant123") == "tenant123"
        assert config.get_tenant_id_for_request(None) == "default"  # Falls back

    def test_custom_default_tenant_id(self):
        """Test custom default tenant ID."""
        config = TenantConfiguration(mode=TenantMode.SINGLE, default_tenant_id="my-company")
        assert config.default_tenant_id == "my-company"
        assert config.get_tenant_id_for_request(None) == "my-company"

    @patch.dict(os.environ, {"TENANT_MODE": "multi"}, clear=True)
    def test_environment_multi_tenant(self):
        """Test configuration from environment variables."""
        config = TenantConfiguration()
        assert config.mode == TenantMode.MULTI
        assert config.require_tenant_header

    @patch.dict(os.environ, {"DEFAULT_TENANT_ID": "acme-corp"}, clear=True)
    def test_environment_single_tenant(self):
        """Test single-tenant configuration with custom default tenant ID."""
        # Use explicit mode since DEPLOYMENT_MODE may vary; test DEFAULT_TENANT_ID env var
        config = TenantConfiguration(mode=TenantMode.SINGLE)
        assert config.mode == TenantMode.SINGLE
        assert config.default_tenant_id == "acme-corp"
        assert not config.require_tenant_header

    @patch.dict(
        os.environ,
        {
            "TENANT_MODE": "multi",
            "REQUIRE_TENANT_HEADER": "false",
            "TENANT_HEADER_NAME": "X-Organization-ID",
            "TENANT_QUERY_PARAM": "org_id",
        },
    )
    def test_environment_custom_settings(self):
        """Test custom settings from environment."""
        config = TenantConfiguration()
        assert config.mode == TenantMode.MULTI
        assert not config.require_tenant_header
        assert config.tenant_header_name == "X-Organization-ID"
        assert config.tenant_query_param == "org_id"

    @patch.dict(
        os.environ,
        {
            "ENABLE_TENANT_SWITCHING": "true",
            "ENABLE_CROSS_TENANT_QUERIES": "true",
        },
    )
    def test_advanced_features(self):
        """Test advanced feature flags."""
        config = TenantConfiguration()
        assert config.enable_tenant_switching
        assert config.enable_cross_tenant_queries

    def test_global_configuration(self):
        """Test global configuration getter/setter."""
        original_config = get_tenant_config()

        # Set new configuration
        new_config = TenantConfiguration(mode=TenantMode.MULTI, default_tenant_id="global-test")
        set_tenant_config(new_config)

        # Verify it was set
        retrieved = get_tenant_config()
        assert retrieved.mode == TenantMode.MULTI
        assert retrieved.default_tenant_id == "global-test"

        # Restore original
        set_tenant_config(original_config)

    @patch.dict(os.environ, {}, clear=True)
    def test_configuration_repr(self):
        """Test configuration string representation."""
        config = TenantConfiguration(mode=TenantMode.MULTI)
        repr_str = repr(config)
        assert "TenantConfiguration" in repr_str
        assert "mode=multi" in repr_str
        assert "require_tenant_header=True" in repr_str
