"""
Tenant configuration for single/multi-tenant deployments.

This module provides configuration for running the platform in either:
- Single-tenant mode: One organization using the entire platform
- Multi-tenant mode: Multiple isolated organizations (SaaS)
"""

import os
from enum import Enum


class TenantMode(str, Enum):
    """Deployment mode for tenant isolation."""

    SINGLE = "single"  # Single organization deployment
    MULTI = "multi"  # Multi-tenant SaaS deployment


class TenantConfiguration:
    """
    Configuration for tenant behavior.

    Controls how the platform handles tenant isolation and identification.
    Can be configured via environment variables or direct instantiation.
    """

    def __init__(
        self,
        mode: TenantMode | None = None,
        default_tenant_id: str | None = None,
        require_tenant_header: bool | None = None,
        tenant_header_name: str = "X-Tenant-ID",
        tenant_query_param: str = "tenant_id",
    ):
        """
        Initialize tenant configuration.

        Args:
            mode: Tenant mode (single or multi). Defaults to settings.DEPLOYMENT_MODE.
            default_tenant_id: Default tenant ID for single-tenant mode.
            require_tenant_header: Whether to require tenant identification in multi-tenant mode.
            tenant_header_name: HTTP header name for tenant ID.
            tenant_query_param: Query parameter name for tenant ID.
        """
        # Determine mode from settings or parameter
        if mode is None:
            # Import here to avoid circular dependency
            from dotmac.platform.settings import settings

            deployment_mode = settings.DEPLOYMENT_MODE.lower()

            # Legacy TENANT_MODE env var check - warn if it conflicts with DEPLOYMENT_MODE
            legacy_tenant_mode = os.getenv("TENANT_MODE")
            if legacy_tenant_mode is not None:
                expected_mode = "multi" if "multi" in deployment_mode else "single"
                if legacy_tenant_mode.lower() != expected_mode:
                    import structlog

                    logger = structlog.get_logger(__name__)
                    logger.error(
                        "TENANT_MODE env var conflicts with DEPLOYMENT_MODE setting - "
                        "this can cause tenant isolation failure. Remove TENANT_MODE and use "
                        "DEPLOYMENT_MODE only.",
                        tenant_mode=legacy_tenant_mode,
                        deployment_mode=deployment_mode,
                    )
                    raise ValueError(
                        f"TENANT_MODE ({legacy_tenant_mode}) conflicts with DEPLOYMENT_MODE "
                        f"({deployment_mode}). Use DEPLOYMENT_MODE only to prevent tenant "
                        "isolation collapse."
                    )

            # Set mode based on DEPLOYMENT_MODE
            self.mode = TenantMode.MULTI if "multi" in deployment_mode else TenantMode.SINGLE
        else:
            self.mode = mode

        # Set default tenant ID
        if default_tenant_id is None:
            self.default_tenant_id = os.getenv("DEFAULT_TENANT_ID", "default")
        else:
            self.default_tenant_id = default_tenant_id

        # Determine if tenant header is required
        if require_tenant_header is None:
            # In multi-tenant mode, require header by default
            # Can be overridden by REQUIRE_TENANT_HEADER env var
            env_require = os.getenv("REQUIRE_TENANT_HEADER")
            if env_require is not None:
                self.require_tenant_header = env_require.lower() in ("true", "1", "yes")
            else:
                self.require_tenant_header = self.mode == TenantMode.MULTI
        else:
            self.require_tenant_header = require_tenant_header

        # Header and query param names
        self.tenant_header_name = os.getenv("TENANT_HEADER_NAME", tenant_header_name)
        self.tenant_query_param = os.getenv("TENANT_QUERY_PARAM", tenant_query_param)

        # Additional settings from environment
        self.enable_tenant_switching = os.getenv("ENABLE_TENANT_SWITCHING", "false").lower() in (
            "true",
            "1",
            "yes",
        )

        self.enable_cross_tenant_queries = os.getenv(
            "ENABLE_CROSS_TENANT_QUERIES", "false"
        ).lower() in ("true", "1", "yes")

    @property
    def is_single_tenant(self) -> bool:
        """Check if running in single-tenant mode."""
        return self.mode == TenantMode.SINGLE

    @property
    def is_multi_tenant(self) -> bool:
        """Check if running in multi-tenant mode."""
        return self.mode == TenantMode.MULTI

    def get_tenant_id_for_request(self, resolved_id: str | None = None) -> str | None:
        """
        Get the tenant ID to use for a request.

        Args:
            resolved_id: Tenant ID resolved from request (header/query/state)

        Returns:
            The tenant ID to use, or None when a tenant identifier is
            required but not provided.
        """
        if self.is_single_tenant:
            # Always use default tenant in single-tenant mode
            return self.default_tenant_id

        # Multi-tenant mode
        if resolved_id:
            return resolved_id
        elif not self.require_tenant_header:
            # Fall back to default if not required
            return self.default_tenant_id
        else:
            # Will need to handle as error in middleware
            return None

    def __repr__(self) -> str:
        return (
            f"TenantConfiguration(mode={self.mode.value}, "
            f"default_tenant_id='{self.default_tenant_id}', "
            f"require_tenant_header={self.require_tenant_header})"
        )


# Global configuration instance
# Can be replaced at startup based on deployment needs
_global_config = TenantConfiguration()


def get_tenant_config() -> TenantConfiguration:
    """Get the global tenant configuration."""
    return _global_config


def set_tenant_config(config: TenantConfiguration) -> None:
    """Set the global tenant configuration."""
    global _global_config
    _global_config = config
