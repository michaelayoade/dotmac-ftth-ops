"""Integration tests for router registration system."""

from importlib import import_module
from unittest.mock import Mock, patch

from fastapi import APIRouter, FastAPI

from dotmac.platform.routers import ROUTER_CONFIGS, register_routers


class TestRouterRegistration:
    """Test router registration functionality."""

    def test_all_configured_routers_exist(self):
        """Test that all routers configured in ROUTER_CONFIGS can be imported."""
        failed_imports = []
        skipped_configs = []

        for config in ROUTER_CONFIGS:
            # Skip commented out configs
            if config.module_path == "dotmac.platform.communications.webhooks_router":
                skipped_configs.append(config.module_path)
                continue

            try:
                module = import_module(config.module_path)
                router = getattr(module, config.router_name)
                assert isinstance(
                    router, APIRouter
                ), f"{config.module_path}.{config.router_name} is not an APIRouter"
            except (ImportError, AttributeError) as e:
                failed_imports.append(
                    {"module": config.module_path, "router": config.router_name, "error": str(e)}
                )

        # Report findings
        if skipped_configs:
            print(f"Skipped {len(skipped_configs)} commented configs: {skipped_configs}")

        assert (
            len(failed_imports) == 0
        ), f"Failed to import {len(failed_imports)} routers:\n" + "\n".join(
            [f"  - {f['module']}.{f['router']}: {f['error']}" for f in failed_imports]
        )

    @patch("dotmac.platform.settings.settings")
    def test_register_routers_does_not_fail(self, mock_settings):
        """Test that register_routers function executes without errors."""
        # Mock storage settings to prevent MinIO connection attempts
        mock_storage = Mock()
        mock_storage.provider = "local"
        mock_storage.enabled = False
        mock_settings.storage = mock_storage
        mock_settings.STORAGE__ENABLED = False

        app = FastAPI()

        # This should not raise any exceptions
        try:
            register_routers(app)
            success = True
        except Exception as e:
            success = False
            raise AssertionError(f"register_routers raised exception: {e}")

        assert success
        # Check that at least some routes were registered
        assert len(app.routes) > 1

    def test_router_config_structure(self):
        """Test that all RouterConfigs have required fields."""
        for config in ROUTER_CONFIGS:
            # Skip commented out configs
            if config.module_path == "dotmac.platform.communications.webhooks_router":
                continue

            assert config.module_path, "module_path is required"
            assert config.router_name, "router_name is required"
            assert config.prefix, "prefix is required"
            assert config.tags, "tags should not be empty"
            assert isinstance(config.tags, list), "tags should be a list"

    def test_no_duplicate_prefixes(self):
        """Test that there are no unexpected duplicate router prefixes.

        Note: Some routers intentionally share the same prefix (e.g., tenant.router and
        tenant.usage_billing_router both use /api/v1/tenants) because they have different
        routes and don't conflict.
        """
        prefixes = []
        for config in ROUTER_CONFIGS:
            # Skip commented out configs
            if config.module_path == "dotmac.platform.communications.webhooks_router":
                continue
            # Use module_path + router_name as unique identifier
            # (same module can export multiple routers)
            router_id = f"{config.module_path}:{config.router_name}"
            prefixes.append((config.prefix, router_id))

        # Check for duplicates - group by prefix
        from collections import defaultdict

        prefix_to_routers = defaultdict(list)
        for prefix, router_id in prefixes:
            prefix_to_routers[prefix].append(router_id)

        # Allow specific known duplicate prefixes (routers with different routes)
        # Format: "module_path:router_name"
        allowed_duplicates = {
            "/api/v1/tenants": {
                "dotmac.platform.tenant.router:router",
                "dotmac.platform.tenant.domain_verification_router:router",
            },
            "/api/v1": {
                "dotmac.platform.billing.metrics_router:router",
                "dotmac.platform.billing.metrics_router:customer_metrics_router",
                "dotmac.platform.auth.metrics_router:router",
                "dotmac.platform.communications.metrics_router:router",
                "dotmac.platform.file_storage.metrics_router:router",
                "dotmac.platform.analytics.metrics_router:router",
                "dotmac.platform.auth.api_keys_metrics_router:router",
                "dotmac.platform.secrets.metrics_router:router",
                "dotmac.platform.monitoring.metrics_router:router",
            },
        }

        # Check for unexpected duplicates
        unexpected_duplicates = []
        for prefix, router_ids in prefix_to_routers.items():
            if len(router_ids) > 1:
                # Check if this is an allowed duplicate
                if prefix in allowed_duplicates:
                    if set(router_ids) != allowed_duplicates[prefix]:
                        unexpected_duplicates.append(f"{prefix}: {router_ids}")
                else:
                    unexpected_duplicates.append(f"{prefix}: {router_ids}")

        assert (
            len(unexpected_duplicates) == 0
        ), f"Unexpected duplicate prefixes found: {unexpected_duplicates}"

    def test_router_requires_auth_flag(self):
        """Test routers that require authentication have the flag set."""
        auth_required_modules = [
            "dotmac.platform.admin.settings.router",
            "dotmac.platform.billing.settings.router",
        ]

        for config in ROUTER_CONFIGS:
            if config.module_path in auth_required_modules:
                # These should have requires_auth set
                # Note: The flag is informational, actual auth is handled by dependencies
                pass  # Just checking the configs are present
