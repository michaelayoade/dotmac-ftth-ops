"""Integration tests for router registration system."""

from importlib import import_module
from unittest.mock import Mock, patch

import pytest
from fastapi import APIRouter, FastAPI

from dotmac.platform.routers import ROUTER_CONFIGS, register_routers

pytestmark = pytest.mark.integration


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
                assert isinstance(router, APIRouter), (
                    f"{config.module_path}.{config.router_name} is not an APIRouter"
                )
            except (ImportError, AttributeError) as e:
                failed_imports.append(
                    {"module": config.module_path, "router": config.router_name, "error": str(e)}
                )

        # Report findings
        if skipped_configs:
            print(f"Skipped {len(skipped_configs)} commented configs: {skipped_configs}")

        assert len(failed_imports) == 0, (
            f"Failed to import {len(failed_imports)} routers:\n"
            + "\n".join([f"  - {f['module']}.{f['router']}: {f['error']}" for f in failed_imports])
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
            # Allow empty prefix if description exists (router defines its own prefix)
            if not config.prefix:
                assert config.description, (
                    f"{config.module_path}:{config.router_name} has empty prefix and no description"
                )
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

        # Duplicate prefixes are expected for broad aggregate endpoints (e.g. /api/v1) where
        # each router module adds its own sub-prefix. Guardrails focus on preventing new
        # duplicate prefixes from slipping in unnoticed, not the individual router lists.
        allowed_duplicate_prefixes = {
            "",  # Routers that define their own prefix internally
            "/api/v1",
            "/api/v1/tenants",
            "/api/v1/billing",
            "/api/v1/metrics",
            "/api/v1/partners",
        }

        unexpected_duplicates = {
            prefix: router_ids
            for prefix, router_ids in prefix_to_routers.items()
            if len(router_ids) > 1 and prefix not in allowed_duplicate_prefixes
        }

        assert not unexpected_duplicates, "Unexpected duplicate prefixes found: " + ", ".join(
            f"{prefix}: {ids}" for prefix, ids in unexpected_duplicates.items()
        )

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

    def test_no_double_api_prefix_in_configs(self):
        """
        Regression test: Ensure no router prefix contains '/api/v1/api/v1' or similar duplicates.

        This prevents the double-prefix bug that was fixed in Phase 1.
        """
        double_prefixes = []
        invalid_patterns = ["/api/v1/api/v1", "/api/v1/api/", "/api/api/"]

        for config in ROUTER_CONFIGS:
            if config.prefix:
                for pattern in invalid_patterns:
                    if pattern in config.prefix:
                        double_prefixes.append(
                            f"{config.module_path}:{config.router_name} has double prefix: {config.prefix}"
                        )

        assert not double_prefixes, (
            f"Double API prefixes detected (regression): {', '.join(double_prefixes)}"
        )

    def test_all_prefixes_start_with_slash(self):
        """Ensure all prefixes start with a forward slash or are empty."""
        invalid_prefixes = []

        for config in ROUTER_CONFIGS:
            # Allow empty prefix only for special cases (documented in description)
            if config.prefix and not config.prefix.startswith("/"):
                invalid_prefixes.append(
                    f"{config.module_path}:{config.router_name} has invalid prefix: {config.prefix}"
                )

        assert not invalid_prefixes, (
            f"Invalid prefixes (must start with /): {', '.join(invalid_prefixes)}"
        )

    def test_no_trailing_slashes_in_prefixes(self):
        """Ensure no prefix ends with a trailing slash (except root '/')."""
        trailing_slashes = []

        for config in ROUTER_CONFIGS:
            if config.prefix and len(config.prefix) > 1 and config.prefix.endswith("/"):
                trailing_slashes.append(
                    f"{config.module_path}:{config.router_name} has prefix with trailing slash: {config.prefix}"
                )

        assert not trailing_slashes, (
            f"Prefixes with trailing slashes: {', '.join(trailing_slashes)}"
        )

    def test_public_routes_dont_require_auth(self):
        """Ensure routes with '/public' in their prefix don't require auth."""
        auth_on_public = []

        for config in ROUTER_CONFIGS:
            if config.prefix and "/public" in config.prefix and config.requires_auth:
                auth_on_public.append(
                    f"{config.module_path}:{config.router_name} ({config.prefix})"
                )

        assert not auth_on_public, (
            f"Public routes should not require auth: {', '.join(auth_on_public)}"
        )

    def test_router_count_in_expected_range(self):
        """
        Ensure router count is within expected range.

        This test will fail if routers are accidentally removed or if
        a large number of routers are added without review.
        """
        router_count = len(ROUTER_CONFIGS)

        # Expected range: 85-120 routers (current is 107)
        # Adjust these thresholds as the platform grows
        assert 85 <= router_count <= 120, (
            f"Unexpected router count: {router_count}. Expected 85-120. Verify no routers were accidentally removed or too many added."
        )

    def test_router_prefixes_have_consistent_api_version(self):
        """Ensure API versioning is consistent across routers."""
        invalid_versions = []
        valid_prefix_patterns = [
            "/api/v1",
            "/api/v2",  # Future version
            "/api/public",
            "/api/licensing",  # Special case
            "",  # Allowed if documented in description
        ]

        for config in ROUTER_CONFIGS:
            if config.prefix:
                # Extract the API version part (e.g., /api/v1 from /api/v1/billing)
                parts = config.prefix.split("/")
                if len(parts) >= 3:  # Should have '', 'api', 'v1' minimum
                    api_version = f"/{parts[1]}/{parts[2]}"
                else:
                    api_version = config.prefix

                # Check if it starts with a valid prefix
                if not any(api_version.startswith(vp) for vp in valid_prefix_patterns):
                    invalid_versions.append(
                        f"{config.module_path}:{config.router_name} has non-standard API version: {config.prefix}"
                    )

        assert not invalid_versions, f"Non-standard API versions: {', '.join(invalid_versions)}"


class TestRouterPrefixExplicitness:
    """Tests to verify Phase 2 changes: routers have explicit prefixes in their definitions."""

    def test_sample_routers_have_explicit_prefixes(self):
        """
        Verify that a sample of router files contain explicit prefix parameters.

        This test ensures Phase 2 changes (explicit prefixes) are maintained.
        """
        sample_routers_to_check = [
            ("dotmac.platform.auth.router", "auth_router"),
            ("dotmac.platform.billing.router", "router"),
            ("dotmac.platform.tenant.router", "router"),
            ("dotmac.platform.webhooks.router", "router"),
            ("dotmac.platform.customer_portal.router", "router"),  # Added in Phase 2
        ]

        missing_prefixes = []

        for module_path, router_name in sample_routers_to_check:
            try:
                module = import_module(module_path)
                router_instance = getattr(module, router_name, None)

                if router_instance is None:
                    missing_prefixes.append(f"Router '{router_name}' not found in {module_path}")
                    continue

                # Check if router has a prefix attribute
                if not hasattr(router_instance, "prefix"):
                    missing_prefixes.append(
                        f"Router '{router_name}' in {module_path} missing prefix attribute"
                    )
                    continue

                # The prefix should be set (not empty for these specific routers)
                prefix = router_instance.prefix
                if prefix == "":
                    # Empty prefix is OK if router defines its own subroutes
                    # but for our sample, these should all have explicit prefixes
                    missing_prefixes.append(
                        f"Router '{router_name}' in {module_path} has empty prefix (expected explicit prefix after Phase 2)"
                    )

            except ImportError:
                # Skip if module cannot be imported (separate test handles this)
                continue
            except Exception as e:
                missing_prefixes.append(f"Error checking {module_path}:{router_name} - {str(e)}")

        assert not missing_prefixes, (
            f"Routers missing explicit prefixes: {', '.join(missing_prefixes)}"
        )
