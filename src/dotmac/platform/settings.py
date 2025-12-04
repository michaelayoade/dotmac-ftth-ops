"""Centralized configuration using pydantic-settings.

All configuration is loaded from environment variables and .env files.
This is the single source of truth for all platform configuration.
"""

# mypy: ignore-errors

from __future__ import annotations

import os
from enum import Enum
from typing import Any, cast

from pydantic import (
    AliasChoices,
    BaseModel,
    ConfigDict,
    Field,
    PostgresDsn,
    RedisDsn,
    field_validator,
)
from pydantic_settings import BaseSettings, SettingsConfigDict


def _default_storage_path() -> str:
    """Derive a persistent storage path from env vars with a safe fallback."""

    return (
        os.getenv("STORAGE__LOCAL_PATH")
        or os.getenv("DOTMAC_STORAGE_LOCAL_PATH")
        or "/var/lib/dotmac/storage"
    )


def _adaptive_pool_size() -> int:
    """
    Derive a safe default DB pool size from CPU/worker hints when no explicit value is set.

    Uses WORKERS/UVICORN_WORKERS/GUNICORN_WORKERS if provided; otherwise scales with CPU cores.
    """
    cpu_count = os.cpu_count() or 2

    def _parse_int(name: str) -> int | None:
        raw = os.getenv(name)
        if raw is None:
            return None
        try:
            return int(raw)
        except ValueError:
            return None

    workers = (
        _parse_int("WORKERS")
        or _parse_int("UVICORN_WORKERS")
        or _parse_int("GUNICORN_WORKERS")
        or 0
    )

    baseline = max(cpu_count, workers if workers > 0 else cpu_count)
    return min(32, max(5, baseline * 2))


class Environment(str, Enum):
    """Application environment."""

    DEVELOPMENT = "development"
    STAGING = "staging"
    PRODUCTION = "production"
    TEST = "test"


class ServiceEndpointSettings(BaseModel):  # BaseModel resolves to Any in isolation
    """External OSS/automation service endpoint configuration."""

    model_config = ConfigDict()

    url: str | None = Field(None, description="Base URL for the service endpoint")
    username: str | None = Field(None, description="Optional username for basic auth")
    password: str | None = Field(None, description="Optional password for basic auth")
    api_token: str | None = Field(None, description="Optional API token")
    verify_ssl: bool = Field(True, description="Verify SSL certificates")
    timeout_seconds: float = Field(30.0, ge=1.0, description="HTTP timeout in seconds")
    max_retries: int = Field(2, ge=0, description="Number of automatic retries for requests")
    extras: dict[str, Any] = Field(
        default_factory=dict,
        description="Additional integration-specific configuration values",
    )


class ObservabilitySettings(BaseModel):  # BaseModel resolves to Any in isolation
    """Observability settings for logging, tracing, and metrics."""

    model_config = ConfigDict()

    # Logging configuration
    log_level: str = Field("INFO", description="Log level")
    log_format: str = Field(
        "json",
        description="Log format (json or text)",
    )
    enable_structured_logging: bool = Field(True, description="Enable structured logging")
    enable_correlation_ids: bool = Field(True, description="Enable correlation IDs")
    correlation_id_header: str = Field(
        "X-Correlation-ID", description="Header name for correlation IDs"
    )

    # Tracing configuration
    enable_tracing: bool = Field(True, description="Enable distributed tracing")
    tracing_sample_rate: float = Field(1.0, description="Tracing sample rate (0.0-1.0)")

    # Metrics configuration
    enable_metrics: bool = Field(True, description="Enable metrics collection")
    metrics_port: int = Field(9090, description="Metrics port")

    # OpenTelemetry configuration
    otel_enabled: bool = Field(True, description="Enable OpenTelemetry")
    otel_endpoint: str | None = Field(
        "http://localhost:4318/v1/traces",
        description="OTLP endpoint (default: local OTEL collector)",
    )
    otel_service_name: str = Field("dotmac-platform", description="Service name")
    otel_resource_attributes: dict[str, str] = Field(
        default_factory=dict, description="Resource attributes"
    )
    otel_instrument_celery: bool = Field(
        True, description="Enable Celery instrumentation when OTEL is enabled"
    )
    otel_instrument_fastapi: bool = Field(
        True, description="Enable FastAPI instrumentation when OTEL is enabled"
    )
    otel_instrument_sqlalchemy: bool = Field(
        True, description="Enable SQLAlchemy instrumentation when OTEL is enabled"
    )
    otel_instrument_requests: bool = Field(
        True, description="Enable Requests instrumentation when OTEL is enabled"
    )

    # Prometheus metrics endpoint
    prometheus_enabled: bool = Field(True, description="Enable Prometheus metrics")
    prometheus_port: int = Field(8001, description="Prometheus metrics port")
    alertmanager_webhook_secret: str | None = Field(
        default=None,
        description="Shared secret/token required for Alertmanager webhook requests",
    )
    alertmanager_rate_limit: str = Field(
        default="120/minute",
        description="Rate limit applied to the Alertmanager webhook endpoint",
    )
    alertmanager_base_url: str | None = Field(
        default="http://localhost:9093",
        description="Base URL for Alertmanager readiness checks",
    )
    prometheus_base_url: str | None = Field(
        default="http://localhost:9090",
        description="Base URL for Prometheus readiness checks",
    )
    grafana_base_url: str | None = Field(
        default="http://localhost:3400",
        description="Base URL for Grafana health checks",
    )
    grafana_api_token: str | None = Field(
        default=None,
        description="Optional Grafana API token used for health checks",
    )


def _default_observability_settings() -> ObservabilitySettings:
    return cast(ObservabilitySettings, ObservabilitySettings.model_validate({}))


class OSSSettings(BaseModel):  # BaseModel resolves to Any in isolation
    """Operational support system integrations per service."""

    model_config = ConfigDict()

    voltha: ServiceEndpointSettings = Field(
        default_factory=lambda: ServiceEndpointSettings(
            url=os.getenv("VOLTHA_URL", "http://localhost:8881"),
            username=os.getenv("VOLTHA_USERNAME"),
            password=os.getenv("VOLTHA_PASSWORD"),
            api_token=os.getenv("VOLTHA_TOKEN"),
            verify_ssl=os.getenv("VOLTHA_VERIFY_SSL", "true").lower() not in {"false", "0"},
            timeout_seconds=float(os.getenv("VOLTHA_TIMEOUT_SECONDS", "30")),
            max_retries=int(os.getenv("VOLTHA_MAX_RETRIES", "3")),
        ),
        description="VOLTHA PON controller configuration",
    )
    genieacs: ServiceEndpointSettings = Field(
        default_factory=lambda: ServiceEndpointSettings(
            url=os.getenv("GENIEACS_URL", "http://localhost:7557"),
            username=os.getenv("GENIEACS_USERNAME"),
            password=os.getenv("GENIEACS_PASSWORD"),
            api_token=os.getenv("GENIEACS_API_TOKEN"),
            verify_ssl=os.getenv("GENIEACS_VERIFY_SSL", "true").lower() not in {"false", "0"},
            timeout_seconds=float(os.getenv("GENIEACS_TIMEOUT_SECONDS", "30")),
            max_retries=int(os.getenv("GENIEACS_MAX_RETRIES", "3")),
        ),
        description="GenieACS TR-069 controller configuration",
    )
    netbox: ServiceEndpointSettings = Field(
        default_factory=lambda: ServiceEndpointSettings(
            url=os.getenv("NETBOX_URL", "http://localhost:8080"),
            api_token=os.getenv("NETBOX_API_TOKEN"),
            username=os.getenv("NETBOX_USERNAME"),
            password=os.getenv("NETBOX_PASSWORD"),
            verify_ssl=os.getenv("NETBOX_VERIFY_SSL", "true").lower() not in {"false", "0"},
            timeout_seconds=float(os.getenv("NETBOX_TIMEOUT_SECONDS", "30")),
            max_retries=int(os.getenv("NETBOX_MAX_RETRIES", "3")),
        ),
        description="NetBox IPAM/DCIM configuration",
    )
    ansible: ServiceEndpointSettings = Field(
        default_factory=lambda: ServiceEndpointSettings(
            url=os.getenv("AWX_URL", "http://localhost:80"),
            username=os.getenv("AWX_USERNAME"),
            password=os.getenv("AWX_PASSWORD"),
            api_token=os.getenv("AWX_TOKEN"),
            verify_ssl=os.getenv("AWX_VERIFY_SSL", "true").lower() not in {"false", "0"},
            timeout_seconds=float(os.getenv("AWX_TIMEOUT_SECONDS", "30")),
            max_retries=int(os.getenv("AWX_MAX_RETRIES", "2")),
        ),
        description="Ansible AWX automation configuration",
    )
    prometheus: ServiceEndpointSettings = Field(
        default_factory=lambda: ServiceEndpointSettings(
            url=os.getenv("PROMETHEUS_URL", "http://localhost:9090"),
            api_token=os.getenv("PROMETHEUS_API_TOKEN"),
            username=os.getenv("PROMETHEUS_USERNAME"),
            password=os.getenv("PROMETHEUS_PASSWORD"),
            verify_ssl=os.getenv("PROMETHEUS_VERIFY_SSL", "true").lower() not in {"false", "0"},
            timeout_seconds=float(os.getenv("PROMETHEUS_TIMEOUT_SECONDS", "15")),
            max_retries=int(os.getenv("PROMETHEUS_MAX_RETRIES", "2")),
            extras={
                "traffic_queries": {
                    "rx_rate": os.getenv(
                        "PROMETHEUS_RX_RATE_QUERY",
                        'sum(rate(node_network_receive_bytes_total{instance="<<device_id>>"}[5m]))',
                    ),
                    "tx_rate": os.getenv(
                        "PROMETHEUS_TX_RATE_QUERY",
                        'sum(rate(node_network_transmit_bytes_total{instance="<<device_id>>"}[5m]))',
                    ),
                    "rx_bytes": os.getenv(
                        "PROMETHEUS_RX_BYTES_QUERY",
                        'sum(increase(node_network_receive_bytes_total{instance="<<device_id>>"}[1h]))',
                    ),
                    "tx_bytes": os.getenv(
                        "PROMETHEUS_TX_BYTES_QUERY",
                        'sum(increase(node_network_transmit_bytes_total{instance="<<device_id>>"}[1h]))',
                    ),
                    "rx_packets": os.getenv(
                        "PROMETHEUS_RX_PACKETS_QUERY",
                        'sum(increase(node_network_receive_packets_total{instance="<<device_id>>"}[1h]))',
                    ),
                    "tx_packets": os.getenv(
                        "PROMETHEUS_TX_PACKETS_QUERY",
                        'sum(increase(node_network_transmit_packets_total{instance="<<device_id>>"}[1h]))',
                    ),
                },
                "device_placeholder": os.getenv(
                    "PROMETHEUS_DEVICE_PLACEHOLDER",
                    "<<device_id>>",
                ),
            },
        ),
        description="Prometheus metrics API configuration",
    )


class RADIUSSettings(BaseModel):  # BaseModel resolves to Any in isolation
    """RADIUS server configuration for CoA/DM operations."""

    model_config = ConfigDict()

    # Server connection
    server_host: str = Field("localhost", description="RADIUS server hostname or IP address")
    coa_port: int = Field(3799, description="CoA port (RFC 5176 default: 3799)")

    # Authentication (LOAD FROM VAULT IN PRODUCTION)
    shared_secret: str = Field(
        "", description="RADIUS shared secret (MUST load from Vault in production)"
    )

    # Dictionary files (NOT secrets - static configuration)
    dictionary_path: str = Field(
        "/etc/raddb/dictionary",
        description="Path to RADIUS dictionary file",
    )
    dictionary_coa_path: str | None = Field(
        "/etc/raddb/dictionary.rfc5176",
        description="Path to CoA dictionary file (RFC 5176)",
    )

    # Connection settings
    timeout_seconds: int = Field(5, description="RADIUS request timeout in seconds")
    max_retries: int = Field(2, description="Maximum retry attempts for failed requests")

    # HTTP API fallback (optional alternative to native RADIUS)
    use_http_api: bool = Field(False, description="Use HTTP API instead of native RADIUS protocol")
    http_api_url: str | None = Field(None, description="HTTP API endpoint URL for CoA operations")
    http_api_key: str = Field(
        "", description="HTTP API authentication key (load from Vault in production)"
    )

    # Multi-vendor support
    default_vendor: str = Field(
        "mikrotik",
        description="Default NAS vendor for new deployments (mikrotik, cisco, huawei, juniper, generic)",
    )
    vendor_aware: bool = Field(
        True, description="Enable vendor-specific attribute generation and CoA handling"
    )

    def __init__(self, **data: Any):
        """Initialize with environment variable overrides."""
        # Load from environment if not explicitly provided
        if "server_host" not in data:
            data["server_host"] = os.getenv("RADIUS_SERVER_HOST", "localhost")
        if "coa_port" not in data:
            data["coa_port"] = int(os.getenv("RADIUS_COA_PORT", "3799"))
        if "shared_secret" not in data:
            data["shared_secret"] = os.getenv("RADIUS_SECRET", "")
        if "timeout_seconds" not in data:
            data["timeout_seconds"] = int(os.getenv("RADIUS_TIMEOUT", "5"))
        if "max_retries" not in data:
            data["max_retries"] = int(os.getenv("RADIUS_MAX_RETRIES", "2"))
        if "use_http_api" not in data:
            data["use_http_api"] = os.getenv("RADIUS_USE_HTTP_API", "false").lower() in {
                "true",
                "1",
            }
        if "http_api_url" not in data:
            data["http_api_url"] = os.getenv("RADIUS_HTTP_API_URL")
        if "http_api_key" not in data:
            data["http_api_key"] = os.getenv("RADIUS_HTTP_API_KEY", "")
        if "default_vendor" not in data:
            data["default_vendor"] = os.getenv("RADIUS_DEFAULT_VENDOR", "mikrotik")
        if "vendor_aware" not in data:
            data["vendor_aware"] = os.getenv("RADIUS_VENDOR_AWARE", "true").lower() in {
                "true",
                "1",
            }

        # Dictionary paths - try bundled first, then environment, then system
        if "dictionary_path" not in data:
            bundled_dict = os.path.join(
                os.path.dirname(__file__), "../../../config/radius/dictionary"
            )
            data["dictionary_path"] = (
                bundled_dict
                if os.path.exists(bundled_dict)
                else os.getenv("RADIUS_DICTIONARY_PATH", "/etc/raddb/dictionary")
            )
        if "dictionary_coa_path" not in data:
            bundled_coa = os.path.join(
                os.path.dirname(__file__), "../../../config/radius/dictionary.rfc5176"
            )
            data["dictionary_coa_path"] = (
                bundled_coa
                if os.path.exists(bundled_coa)
                else os.getenv("RADIUS_DICTIONARY_COA_PATH", "/etc/raddb/dictionary.rfc5176")
            )

        super().__init__(**data)

    @property
    def dictionary_paths(self) -> list[str]:
        """Return list of dictionary paths for pyrad initialization."""
        paths = [self.dictionary_path]
        if self.dictionary_coa_path:
            paths.append(self.dictionary_coa_path)
        return paths


def _default_session_redis_url() -> str:
    """Build session Redis URL with password support."""
    env_value = os.getenv("SESSION_REDIS_URL")
    if env_value:
        return env_value

    # Fall back to REDIS_URL if fully specified (includes password if provided)
    legacy_value = os.getenv("REDIS_URL")
    if legacy_value:
        return legacy_value

    host = os.getenv("REDIS_HOST", "localhost")
    port = os.getenv("REDIS_PORT", "6379")
    password = os.getenv("REDIS_PASSWORD", "")

    # Allow overriding the DB index specifically for sessions while keeping backwards compatibility
    session_db = (
        os.getenv("SESSION_REDIS_DB")
        or os.getenv("REDIS_SESSION_DB")
        or os.getenv("SESSION_REDIS_DATABASE")
        or "1"
    )

    auth_segment = f":{password}@" if password else ""
    return f"redis://{auth_segment}{host}:{port}/{session_db}"


class AuthSettings(BaseModel):  # BaseModel resolves to Any in isolation
    """Authentication and authorization configuration.

    Centralizes all auth-related settings including JWT, sessions, and user defaults.
    """

    model_config = ConfigDict()

    # JWT Configuration
    jwt_secret_key: str = Field(
        default_factory=lambda: os.getenv("JWT_SECRET_KEY", ""),
        description="JWT signing secret (MUST load from Vault in production)",
    )
    jwt_algorithm: str = Field(
        default_factory=lambda: os.getenv("JWT_ALGORITHM", "HS256"),
        description="JWT signing algorithm",
    )
    access_token_expire_minutes: int = Field(
        default_factory=lambda: int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "15")),
        ge=1,
        le=1440,
        description="Access token TTL in minutes",
    )
    refresh_token_expire_days: int = Field(
        default_factory=lambda: int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "7")),
        ge=1,
        le=90,
        description="Refresh token TTL in days",
    )

    # Session Management
    session_redis_url: str = Field(
        default_factory=_default_session_redis_url,
        description="Redis URL for session storage (separate DB from cache)",
    )

    # User Defaults
    default_user_role: str = Field(
        default_factory=lambda: os.getenv("DEFAULT_USER_ROLE", "user"),
        description="Default role assigned to new users",
    )
    default_admin_username: str = Field(
        default_factory=lambda: os.getenv("DEFAULT_ADMIN_USERNAME", "admin"),
        description="Default administrator username for development environments",
    )
    default_admin_email: str = Field(
        default_factory=lambda: os.getenv("DEFAULT_ADMIN_EMAIL", "admin@example.com"),
        description="Default administrator email for development environments",
    )
    default_admin_password: str = Field(
        default_factory=lambda: os.getenv("DEFAULT_ADMIN_PASSWORD", "admin"),
        description="Default administrator password for development/testing",
    )

    # Upload Limits
    max_avatar_size_mb: int = Field(
        default_factory=lambda: int(os.getenv("MAX_AVATAR_SIZE_MB", "5")),
        ge=1,
        le=50,
        description="Maximum avatar upload size in MB",
    )

    # Session / Auth Hardening
    session_idle_timeout_minutes: int = Field(
        default_factory=lambda: int(os.getenv("SESSION_IDLE_TIMEOUT_MINUTES", "60")),
        ge=5,
        le=24 * 60,
        description="Maximum idle time for sessions before expiration (minutes)",
    )
    token_expiry_leeway_seconds: int = Field(
        default_factory=lambda: int(os.getenv("TOKEN_EXPIRY_LEEWAY_SECONDS", "60")),
        ge=0,
        le=300,
        description="Leeway window to accept recently expired tokens (seconds)",
    )
    max_sessions_per_user: int = Field(
        default_factory=lambda: int(os.getenv("MAX_SESSIONS_PER_USER", "5")),
        ge=1,
        description="Maximum concurrent sessions allowed per user",
    )

    def __init__(self, **data: Any):
        """Initialize with environment variable overrides."""
        super().__init__(**data)

    @property
    def jwt_secret_key_bytes(self) -> bytes:
        """Return JWT secret as bytes for cryptographic operations."""
        return self.jwt_secret_key.encode()


class ExternalServicesSettings(BaseModel):  # BaseModel resolves to Any in isolation
    """External service endpoint configuration (Phase 2).

    Centralizes all OSS/BSS and third-party service URLs for easy management
    across environments (development, staging, production).
    """

    model_config = ConfigDict()

    # ============================================================
    # OSS/BSS Service URLs
    # ============================================================

    # GenieACS (TR-069 ACS)
    genieacs_url: str = Field(
        default_factory=lambda: os.getenv("GENIEACS_URL", "http://localhost:7557"),
        description="GenieACS TR-069 ACS server URL",
    )

    # NetBox (IPAM/DCIM)
    netbox_url: str = Field(
        default_factory=lambda: os.getenv("NETBOX_URL", "http://localhost:8080"),
        description="NetBox IPAM/DCIM server URL",
    )

    # VOLTHA (OLT Management)
    voltha_url: str = Field(
        default_factory=lambda: os.getenv("VOLTHA_URL", "http://localhost:8881"),
        description="VOLTHA OLT management server URL",
    )

    # Ansible/AWX (Automation)
    awx_url: str = Field(
        default_factory=lambda: os.getenv("AWX_URL", "http://localhost:80"),
        description="Ansible AWX automation server URL",
    )

    # ============================================================
    # Search & Indexing Services
    # ============================================================

    # Meilisearch
    meilisearch_url: str = Field(
        default_factory=lambda: os.getenv("MEILISEARCH_URL", "http://localhost:7700"),
        description="Meilisearch search engine URL",
    )

    # Elasticsearch
    elasticsearch_url: str = Field(
        default_factory=lambda: os.getenv("ELASTICSEARCH_URL", "http://localhost:9200"),
        description="Elasticsearch cluster URL",
    )

    # ============================================================
    # Frontend Application URLs
    # ============================================================

    # Main frontend (customer-facing)
    frontend_url: str = Field(
        default_factory=lambda: os.getenv("FRONTEND_URL", "http://localhost:3000"),
        description="Frontend application URL for user-facing features",
    )

    # Admin portal
    frontend_admin_url: str = Field(
        default_factory=lambda: os.getenv("FRONTEND_ADMIN_URL", "http://localhost:3001"),
        description="Admin portal URL for internal users",
    )

    # ============================================================
    # RADIUS CoA
    # ============================================================

    # RADIUS CoA API (if different from RADIUS server)
    radius_coa_api_url: str = Field(
        default_factory=lambda: os.getenv("RADIUS_COA_API_URL", "http://localhost:8080/coa"),
        description="RADIUS CoA API endpoint (if using HTTP API instead of UDP)",
    )

    def __init__(self, **data: Any):
        """Initialize with environment variable overrides."""
        super().__init__(**data)


class LogLevel(str, Enum):
    """Log levels."""

    DEBUG = "DEBUG"
    INFO = "INFO"
    WARNING = "WARNING"
    ERROR = "ERROR"
    CRITICAL = "CRITICAL"


class Settings(BaseSettings):
    """Main application settings.

    All settings can be overridden via environment variables.
    For nested settings, use double underscore: DATABASE__POOL_SIZE=20
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        env_nested_delimiter="__",
        extra="ignore",
    )

    # ============================================================
    # Core Application Settings
    # ============================================================

    # Application metadata
    app_name: str = Field("dotmac-platform", description="Application name")
    app_version: str = Field("1.0.0", description="Application version")
    environment: Environment = Field(Environment.DEVELOPMENT, description="Deployment environment")
    debug: bool = Field(False, description="Debug mode")
    testing: bool = Field(False, description="Testing mode")

    # Deployment mode configuration
    DEPLOYMENT_MODE: str = Field(
        "multi_tenant",
        description="Deployment mode: multi_tenant, single_tenant, or hybrid",
        pattern="^(multi_tenant|single_tenant|hybrid)$",
    )
    TENANT_ID: str | None = Field(
        None,
        description="Fixed tenant ID for single-tenant deployments (None for multi-tenant)",
    )
    tenant_slug: str | None = Field(
        default=None,
        validation_alias=AliasChoices("TENANT_SLUG"),
        description="Tenant slug used for routing/branding overrides",
    )
    tenant_display_name: str | None = Field(
        default=None,
        validation_alias=AliasChoices("TENANT_DISPLAY_NAME", "NEXT_PUBLIC_TENANT_NAME"),
        description="Human-readable tenant/brand name for runtime config",
    )
    tenant_graphql_url: str | None = Field(
        default=None,
        validation_alias=AliasChoices("TENANT_GRAPHQL_URL", "NEXT_PUBLIC_GRAPHQL_URL"),
        description="Absolute GraphQL endpoint exposed to frontends",
    )
    frontend_api_base_url: str | None = Field(
        default=None,
        validation_alias=AliasChoices(
            "FRONTEND_API_BASE_URL",
            "NEXT_PUBLIC_API_BASE_URL",
            "API_BASE_URL",
        ),
        description="Absolute REST API base URL exposed to frontends",
    )
    ENABLE_PLATFORM_ROUTES: bool = Field(
        True,
        description="Enable platform administration routes (disable in single-tenant mode)",
    )

    # Server configuration
    host: str = Field("0.0.0.0", description="Server host")  # nosec B104 - Production deployments use proxy
    port: int = Field(8000, description="Server port")
    workers: int = Field(4, description="Number of worker processes")
    reload: bool = Field(False, description="Auto-reload on changes")

    # Security
    secret_key: str = Field(
        "", description="Secret key for signing (MUST load from Vault in production)"
    )
    # SECURITY: Changed default from ["*"] to empty list
    # Production MUST set TRUSTED_HOSTS explicitly or startup will fail
    # Development: empty list means "trust all" for convenience
    trusted_hosts: list[str] = Field(
        default_factory=list, description="Trusted hosts (required in production, empty=all in dev)"
    )

    # Trusted proxy IPs/networks for rate limiting and IP extraction
    # Only requests from these IPs can set X-Forwarded-For/X-Real-IP
    # Production MUST configure this to prevent rate limit bypass via IP spoofing
    # Common values: ["127.0.0.1", "10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16"]
    trusted_proxies: list[str] = Field(
        default_factory=lambda: ["127.0.0.1", "::1"],  # localhost only by default
        description="Trusted proxy IPs/networks (CIDR notation) for X-Forwarded-For validation",
    )

    # ============================================================
    # Branding & Experience
    # ============================================================

    class BrandSettings(BaseModel):  # BaseModel resolves to Any in isolation
        """Branding and contact defaults."""

        model_config = ConfigDict()

        product_name: str = Field("DotMac Platform", description="Customer-facing product name")
        product_tagline: str = Field(
            "Reusable SaaS backend and APIs to launch faster.", description="Marketing tagline"
        )
        company_name: str = Field("DotMac Platform", description="Legal/company name")
        support_email: str = Field(
            "support@example.com", description="Primary support contact email"
        )
        success_email: str = Field(
            "success@example.com", description="Customer success contact email"
        )
        operations_email: str = Field(
            "ops@example.com", description="Operations/NOC contact email (fallback)"
        )
        partner_support_email: str = Field(
            "partner@example.com", description="Partner escalation contact email"
        )
        notification_domain: str = Field(
            "dotmac.com",
            description="Domain used for message IDs and transactional communications",
        )
        logo_url: str | None = Field(
            default=None,
            description="Absolute or relative URL to the product logo",
            validation_alias=AliasChoices("BRAND_LOGO_URL", "NEXT_PUBLIC_LOGO_URL", "LOGO_URL"),
        )
        favicon_url: str | None = Field(
            default=None,
            description="Absolute or relative URL to the favicon",
            validation_alias=AliasChoices(
                "BRAND_FAVICON_URL",
                "NEXT_PUBLIC_FAVICON",
                "FAVICON_URL",
            ),
        )

    brand: BrandSettings = Field(  # type: ignore[call-arg]
        default_factory=BrandSettings,
        description="Branding defaults for communications and UI copy",
    )

    # ============================================================
    # URL Templates & External Links
    # ============================================================

    class URLSettings(BaseModel):  # BaseModel resolves to Any in isolation
        """URL templates used when endpoints are not provided externally."""

        model_config = ConfigDict()

        tenant_url_template: str = Field(
            "https://tenant-{tenant_id}.example.com",
            description="Format string for fallback tenant URLs (expects tenant_id)",
        )
        partner_subdomain_template: str = Field(
            "https://{subdomain}.platform.example.com",
            description="Format string for partner white-label subdomains",
        )
        activation_domain_template: str = Field(
            "https://{slug}.dotmac.io",
            description="Format string for tenant activation URLs (expects slug)",
        )
        billing_portal_base_url: str = Field(
            "https://platform.dotmac.com",
            description="Base URL for invoice/billing portal links",
        )
        customer_billing_dashboard_url: str = Field(
            "https://app.example.com/tenant/billing/subscription",
            description="Default dashboard URL embedded in billing emails",
        )
        payment_method_update_url: str = Field(
            "https://app.example.com/tenant/billing/payment-methods",
            description="Default payment method update URL embedded in billing emails",
        )
        exit_survey_base_url: str = Field(
            "https://survey.dotmac.com/exit",
            description="Base URL for customer feedback/exit surveys",
        )

    urls: URLSettings = Field(  # type: ignore[call-arg]
        default_factory=URLSettings,
        description="URL templates and external links used across communications",
    )

    # ============================================================
    # Authentication & Authorization
    # ============================================================

    # Default role for new user registrations (after first user)
    # First user in a tenant always gets "admin" role
    # Subsequent users get this role by default
    default_user_role: str = Field(
        "user",
        description="Default role for new registrations (first user gets 'admin', others get this)",
    )

    # ============================================================
    # Database Configuration
    # ============================================================

    class DatabaseSettings(BaseModel):  # BaseModel resolves to Any in isolation
        """Database configuration."""

        model_config = ConfigDict()

        url: PostgresDsn | None = Field(None, description="Full database URL")
        host: str = Field("localhost", description="Database host")
        port: int = Field(5432, description="Database port")
        database: str = Field("dotmac", description="Database name")
        username: str = Field("dotmac", description="Database username")
        password: str = Field("", description="Database password")

        # Connection pool (environment variable overrides for test tuning)
        pool_size: int = Field(
            default_factory=_adaptive_pool_size,
            description="Connection pool size (override with PG_POOL_SIZE env var)",
            validation_alias="PG_POOL_SIZE",
        )
        max_overflow: int = Field(
            20,
            description="Max overflow connections (override with PG_MAX_OVERFLOW env var)",
            validation_alias="PG_MAX_OVERFLOW",
        )
        pool_timeout: int = Field(
            30,
            description="Pool timeout in seconds (override with PG_POOL_TIMEOUT env var)",
            validation_alias="PG_POOL_TIMEOUT",
        )
        pool_recycle: int = Field(3600, description="Recycle connections after seconds")
        pool_pre_ping: bool = Field(True, description="Test connections before use")

        # Options
        echo: bool = Field(False, description="Echo SQL statements")
        echo_pool: bool = Field(False, description="Echo pool events")

        @property
        def sqlalchemy_url(self) -> str:
            """Build SQLAlchemy database URL."""
            override_async = os.getenv("DOTMAC_DATABASE_URL_ASYNC")
            if override_async:
                return override_async

            override_sync = os.getenv("DOTMAC_DATABASE_URL") or os.getenv("DATABASE_URL")
            if override_sync:
                if override_sync.startswith("sqlite+"):
                    return override_sync
                if override_sync.startswith("sqlite://"):
                    return override_sync.replace("sqlite://", "sqlite+aiosqlite://", 1)
                if override_sync.startswith("postgresql+"):
                    return override_sync
                if override_sync.startswith("postgresql://"):
                    return override_sync.replace("postgresql://", "postgresql+asyncpg://", 1)
                return override_sync

            if self.url:
                url = str(self.url)
                if url.startswith("postgresql://"):
                    return url.replace("postgresql://", "postgresql+asyncpg://", 1)
                return url

            return f"postgresql+asyncpg://{self.username}:{self.password}@{self.host}:{self.port}/{self.database}"

    database: DatabaseSettings = DatabaseSettings()  # type: ignore[call-arg]

    # ============================================================
    # Redis Configuration
    # ============================================================

    class RedisSettings(BaseModel):  # BaseModel resolves to Any in isolation
        """Redis configuration."""

        model_config = ConfigDict()

        url: RedisDsn | None = Field(None, description="Full Redis URL")
        host: str = Field("localhost", description="Redis host")
        port: int = Field(6379, description="Redis port")
        password: str = Field("", description="Redis password")
        db: int = Field(0, description="Redis database number")

        # Connection pool
        max_connections: int = Field(50, description="Max connections in pool")
        decode_responses: bool = Field(True, description="Decode responses to strings")

        # Separate URLs for different purposes
        cache_db: int = Field(1, description="Cache database number")
        session_db: int = Field(2, description="Session database number")
        pubsub_db: int = Field(3, description="Pub/sub database number")

        @property
        def redis_url(self) -> str:
            """Build Redis URL."""
            if self.url:
                return str(self.url)
            if self.password:
                return f"redis://:{self.password}@{self.host}:{self.port}/{self.db}"
            return f"redis://{self.host}:{self.port}/{self.db}"

        @property
        def cache_url(self) -> str:
            """Build cache Redis URL."""
            if self.password:
                return f"redis://:{self.password}@{self.host}:{self.port}/{self.cache_db}"
            return f"redis://{self.host}:{self.port}/{self.cache_db}"

        @property
        def session_url(self) -> str:
            """Build session Redis URL."""
            if self.password:
                return f"redis://:{self.password}@{self.host}:{self.port}/{self.session_db}"
            return f"redis://{self.host}:{self.port}/{self.session_db}"

    redis: RedisSettings = RedisSettings()  # type: ignore[call-arg]

    # ============================================================
    # TimescaleDB Configuration (Time-Series Metrics)
    # ============================================================

    class TimescaleDBSettings(BaseModel):  # BaseModel resolves to Any in isolation
        """TimescaleDB configuration for time-series data."""

        model_config = ConfigDict()

        enabled: bool = Field(False, description="Enable TimescaleDB integration")
        host: str = Field("timescaledb", description="TimescaleDB host")
        port: int = Field(5432, description="TimescaleDB port")
        database: str = Field("metrics", description="TimescaleDB database name")
        username: str = Field("timescale_user", description="TimescaleDB username")
        password: str = Field("", description="TimescaleDB password")

        # Connection pool
        pool_size: int = Field(5, description="Connection pool size")
        max_overflow: int = Field(10, description="Max overflow connections")
        pool_timeout: int = Field(30, description="Pool timeout in seconds")
        pool_recycle: int = Field(3600, description="Recycle connections after seconds")
        pool_pre_ping: bool = Field(True, description="Test connections before use")

        # Time-series specific settings
        chunk_time_interval: str = Field("1 day", description="Hypertable chunk interval")
        retention_days: int = Field(730, description="Data retention period (days)")
        compression_after_days: int = Field(90, description="Compress data older than N days")

        @property
        def sqlalchemy_url(self) -> str:
            """Build SQLAlchemy database URL for TimescaleDB."""
            return f"postgresql+asyncpg://{self.username}:{self.password}@{self.host}:{self.port}/{self.database}"

        @property
        def is_configured(self) -> bool:
            """Check if TimescaleDB is properly configured."""
            return self.enabled and bool(self.password)

    timescaledb: TimescaleDBSettings = TimescaleDBSettings()  # type: ignore[call-arg]

    # ============================================================
    # JWT & Authentication
    # ============================================================

    class JWTSettings(BaseModel):  # BaseModel resolves to Any in isolation
        """JWT configuration."""

        model_config = ConfigDict()

        secret_key: str = Field("", description="JWT secret key (load from Vault in production)")
        algorithm: str = Field("HS256", description="JWT algorithm")
        access_token_expire_minutes: int = Field(30, description="Access token expiration")
        refresh_token_expire_days: int = Field(30, description="Refresh token expiration")
        issuer: str = Field("dotmac-platform", description="JWT issuer")
        audience: str = Field("dotmac-api", description="JWT audience")

        @property
        def is_secure(self) -> bool:
            """Check if JWT secret is secure (not the default)."""
            return (
                self.secret_key != ""
                and self.secret_key != "change-me"
                and len(self.secret_key) >= 32
            )

    jwt: JWTSettings = JWTSettings()  # type: ignore[call-arg]

    # ============================================================
    # Security & Authentication
    # ============================================================

    class SecuritySettings(BaseModel):  # BaseModel resolves to Any in isolation
        """Security and authentication configuration."""

        model_config = ConfigDict()

        # Account lockout settings
        max_failed_login_attempts: int = Field(
            5,
            ge=1,
            description="Maximum failed login attempts before account lockout",
        )
        account_lockout_duration_hours: int = Field(
            1,
            ge=1,
            description="Account lockout duration in hours after max failed attempts",
        )
        failed_login_reset_minutes: int = Field(
            30,
            ge=1,
            description="Minutes to reset failed login counter if no failures",
        )

        # Password policy
        password_min_length: int = Field(8, ge=6, description="Minimum password length")
        password_require_uppercase: bool = Field(
            True, description="Require at least one uppercase letter"
        )
        password_require_lowercase: bool = Field(
            True, description="Require at least one lowercase letter"
        )
        password_require_digits: bool = Field(True, description="Require at least one digit")
        password_require_special: bool = Field(
            False, description="Require at least one special character"
        )

        # Session security
        session_timeout_minutes: int = Field(
            60, ge=1, description="Inactive session timeout in minutes"
        )
        session_absolute_timeout_hours: int = Field(
            24, ge=1, description="Absolute session timeout in hours"
        )
        concurrent_sessions_allowed: bool = Field(
            True, description="Allow concurrent sessions for same user"
        )
        max_concurrent_sessions: int = Field(
            5, ge=1, description="Maximum concurrent sessions per user"
        )

        # Security headers
        enable_hsts: bool = Field(False, description="Enable HTTP Strict Transport Security")
        hsts_max_age_seconds: int = Field(
            31536000, ge=1, description="HSTS max-age in seconds (default: 1 year)"
        )
        enable_csp: bool = Field(False, description="Enable Content Security Policy headers")
        enable_xss_protection: bool = Field(True, description="Enable XSS protection header")

    security: SecuritySettings = SecuritySettings()  # type: ignore[call-arg]

    def validate_production_security(self) -> None:
        """
        Validate that production security requirements are met.

        SECURITY: This ensures production deployments don't use insecure defaults.
        Call this during application startup in production environments.

        Checks:
        - JWT secret is secure (not default)
        - Trusted hosts are explicitly configured
        - Redis is configured (not localhost) - REQUIRED for session management
        - Vault is enabled for secrets management
        - All critical secrets are loaded from Vault
        """
        if self.environment == Environment.PRODUCTION:
            # Vault must be enabled in production
            if not self.vault.enabled:
                raise ValueError(
                    "SECURITY ERROR: Vault/OpenBao MUST be enabled in production. "
                    "Set VAULT__ENABLED=true and configure VAULT__ADDR, VAULT__TOKEN. "
                    "See docs/VAULT_SECRETS_MIGRATION.md for setup instructions."
                )

            # JWT secret must be loaded and secure
            if not self.jwt.is_secure:
                raise ValueError(
                    "SECURITY ERROR: JWT_SECRET_KEY must be loaded from Vault in production. "
                    "Path: auth/jwt_secret. Run migration script to populate Vault."
                )

            # Application secret key must be loaded
            if not self.secret_key or len(self.secret_key) < 32:
                raise ValueError(
                    "SECURITY ERROR: SECRET_KEY must be loaded from Vault in production. "
                    "Path: app/secret_key. Run migration script to populate Vault."
                )

            # Database password must be loaded
            if not self.database.password:
                raise ValueError(
                    "SECURITY ERROR: DATABASE_PASSWORD must be loaded from Vault in production. "
                    "Path: database/password. Run migration script to populate Vault."
                )

            # Storage credentials must be loaded (if storage enabled)
            if self.storage.enabled and self.storage.provider != "local":
                if not self.storage.secret_key:
                    raise ValueError(
                        "SECURITY ERROR: STORAGE_SECRET_KEY must be loaded from Vault in production. "
                        "Path: storage/secret_key. Run migration script to populate Vault."
                    )

            # RADIUS secret must be loaded (if RADIUS is used)
            # Note: Only validate if RADIUS service is actually initialized
            # This is checked in radius/service.py to avoid false positives

            # Trusted hosts must be configured
            if not self.trusted_hosts or self.trusted_hosts == ["*"]:
                raise ValueError(
                    "SECURITY ERROR: TRUSTED_HOSTS must be explicitly configured in production. "
                    "Wildcard '*' or empty list is not allowed. "
                    "Set specific hostnames (e.g., TRUSTED_HOSTS=api.example.com,www.example.com)"
                )

            # SECURITY: Redis must be configured for multi-worker session management
            if not self.redis.host or self.redis.host == "localhost":
                raise ValueError(
                    "SECURITY ERROR: Redis must be configured with production host in production. "
                    "localhost is not suitable for multi-worker/multi-server deployments. "
                    "Redis is MANDATORY for session revocation to work correctly across workers. "
                    "Set REDIS__HOST to your production Redis server."
                )

    # ============================================================
    # CORS Configuration
    # ============================================================

    class CORSSettings(BaseModel):  # BaseModel resolves to Any in isolation
        """CORS configuration."""

        model_config = ConfigDict()

        enabled: bool = Field(True, description="Enable CORS")
        origins: list[str] = Field(default_factory=list, description="Allowed origins for CORS")
        methods: list[str] = Field(default_factory=lambda: ["*"], description="Allowed methods")
        headers: list[str] = Field(default_factory=lambda: ["*"], description="Allowed headers")
        credentials: bool = Field(True, description="Allow credentials")
        max_age: int = Field(3600, description="Max age for preflight")

    cors: CORSSettings = Field(
        default_factory=lambda: Settings.CORSSettings(
            origins=[
                "http://localhost:3000",
                "http://localhost:3001",
                "http://localhost:3002",
                "http://localhost:8000",
                "http://127.0.0.1:3000",
                "http://127.0.0.1:8000",
            ]
        ),
        description="CORS settings",
    )

    # ============================================================
    # Email & SMTP Settings
    # ============================================================

    class EmailSettings(BaseModel):  # BaseModel resolves to Any in isolation
        """Email and SMTP configuration."""

        model_config = ConfigDict()

        # SMTP Configuration
        smtp_host: str = Field("localhost", description="SMTP server host")
        smtp_port: int = Field(587, description="SMTP server port")
        smtp_username: str = Field("", description="SMTP username")
        smtp_password: str = Field("", description="SMTP password")
        use_tls: bool = Field(True, description="Use TLS for SMTP")
        use_ssl: bool = Field(False, description="Use SSL for SMTP")

        # Email defaults
        from_address: str = Field("noreply@example.com", description="Default from email")
        from_name: str = Field("DotMac Platform", description="Default from name")
        reply_to: str = Field("", description="Reply-to address")

        # Email behavior
        enabled: bool = Field(True, description="Enable email sending")
        max_retries: int = Field(3, description="Max send retries")
        timeout: int = Field(30, description="SMTP timeout in seconds")

        # Template settings
        template_path: str = Field("templates/emails", description="Email template path")
        use_html: bool = Field(True, description="Send HTML emails")

    email: EmailSettings = EmailSettings()  # type: ignore[call-arg]

    # ============================================================
    # Tenant Settings
    # ============================================================

    class TenantSettings(BaseModel):  # BaseModel resolves to Any in isolation
        """Multi-tenant configuration."""

        model_config = ConfigDict()

        # Tenant mode
        mode: str = Field("single", description="Tenant mode: single or multi")
        default_tenant_id: str = Field("default", description="Default tenant ID")

        # Request handling
        require_tenant_header: bool = Field(False, description="Require tenant header")
        tenant_header_name: str = Field("X-Tenant-ID", description="Tenant header name")
        tenant_query_param: str = Field("tenant_id", description="Tenant query parameter")

        # Tenant isolation
        strict_isolation: bool = Field(True, description="Enforce strict tenant isolation")
        allow_cross_tenant_access: bool = Field(
            False, description="Allow cross-tenant access for admins"
        )

        # Tenant limits
        max_users_per_tenant: int = Field(1000, description="Max users per tenant")
        max_storage_per_tenant_gb: int = Field(100, description="Max storage per tenant in GB")

    tenant: TenantSettings = TenantSettings()  # type: ignore[call-arg]

    # ============================================================
    # Celery & Task Queue
    # ============================================================

    class CelerySettings(BaseModel):  # BaseModel resolves to Any in isolation
        """Celery configuration."""

        model_config = ConfigDict()

        broker_url: str = Field("redis://localhost:6379/0", description="Broker URL")
        result_backend: str = Field("redis://localhost:6379/1", description="Result backend")
        task_serializer: str = Field("json", description="Task serializer")
        result_serializer: str = Field("json", description="Result serializer")
        accept_content: list[str] = Field(
            default_factory=lambda: ["json"], description="Accept content types"
        )
        timezone: str = Field("UTC", description="Timezone")
        enable_utc: bool = Field(True, description="Enable UTC")

        # Worker settings
        worker_concurrency: int = Field(4, description="Worker concurrency")
        worker_prefetch_multiplier: int = Field(4, description="Prefetch multiplier")
        worker_max_tasks_per_child: int = Field(1000, description="Max tasks per child")
        task_soft_time_limit: int = Field(300, description="Soft time limit")
        task_time_limit: int = Field(600, description="Hard time limit")

    celery: CelerySettings = CelerySettings()  # type: ignore[call-arg]

    # ============================================================
    # Observability & Monitoring
    # ============================================================

    observability: ObservabilitySettings = Field(default_factory=_default_observability_settings)

    # ============================================================
    # OSS / External Integrations
    # ============================================================

    oss: OSSSettings = Field(default_factory=OSSSettings)

    # ============================================================
    # RADIUS Configuration
    # ============================================================

    radius: RADIUSSettings = Field(
        default_factory=RADIUSSettings,
        description="RADIUS server configuration for CoA/DM operations",
    )

    # ============================================================
    # Authentication & Authorization (Centralized)
    # ============================================================

    auth: AuthSettings = Field(
        default_factory=AuthSettings,
        description="Authentication and authorization configuration (JWT, sessions, user defaults)",
    )

    # ============================================================
    # External Services (Phase 2 - Centralized)
    # ============================================================

    external_services: ExternalServicesSettings = Field(
        default_factory=ExternalServicesSettings,
        description="External service endpoint configuration (OSS/BSS, search, frontend URLs)",
    )

    # ============================================================
    # Billing Configuration
    # ============================================================

    class BillingSettings(
        BaseModel
    ):  # BaseModel resolves to Any in isolation # BaseModel resolves to Any in isolation
        """Billing system configuration."""

        model_config = ConfigDict()

        # Product settings
        default_currency: str = Field("USD", description="Default currency for products")
        auto_generate_skus: bool = Field(True, description="Auto-generate SKUs for products")
        sku_prefix: str = Field("PROD", description="Prefix for auto-generated SKUs")
        sku_auto_increment: bool = Field(True, description="Use auto-incrementing SKU numbers")

        # Subscription settings
        default_trial_days: int = Field(14, description="Default trial period in days")
        allow_plan_changes: bool = Field(True, description="Allow subscription plan changes")
        proration_enabled: bool = Field(True, description="Enable mid-cycle proration")
        cancel_at_period_end_default: bool = Field(
            True, description="Default cancellation behavior"
        )

        # Pricing settings
        pricing_rules_enabled: bool = Field(True, description="Enable pricing rules system")
        max_discount_percentage: int = Field(50, description="Maximum discount percentage allowed")
        customer_specific_pricing_enabled: bool = Field(
            True, description="Enable customer-specific pricing"
        )
        volume_discounts_enabled: bool = Field(True, description="Enable volume discount rules")

        # Usage billing settings
        usage_billing_enabled: bool = Field(True, description="Enable usage-based billing")
        usage_calculation_precision: int = Field(
            2, description="Decimal places for usage calculations"
        )
        usage_aggregation_period: str = Field("monthly", description="Usage aggregation period")
        overage_billing_enabled: bool = Field(
            True, description="Enable overage billing for hybrid plans"
        )

        # Processing settings
        auto_invoice_subscriptions: bool = Field(
            True, description="Automatically create subscription invoices"
        )
        auto_process_renewals: bool = Field(
            False, description="Automatically process subscription renewals"
        )
        invoice_due_days: int = Field(30, description="Default invoice due period in days")
        grace_period_days: int = Field(3, description="Grace period for failed payments")
        payment_retry_attempts: int = Field(3, description="Number of payment retry attempts")
        payment_retry_interval_hours: int = Field(24, description="Hours between payment retries")
        payment_retry_exponential_base_hours: int = Field(
            2,
            ge=1,
            description="Base hours for exponential backoff retry strategy (retry_at = base^retry_count)",
        )

        # Notification settings
        send_renewal_reminders: bool = Field(
            True, description="Send subscription renewal reminders"
        )
        renewal_reminder_days: int = Field(7, description="Days before renewal to send reminder")
        send_payment_failure_notifications: bool = Field(
            True, description="Send payment failure notifications"
        )
        send_cancellation_confirmations: bool = Field(
            True, description="Send cancellation confirmations"
        )

        # Tax and compliance
        tax_inclusive_pricing: bool = Field(False, description="Display tax-inclusive prices")
        require_tax_id_for_business: bool = Field(
            False, description="Require tax ID for business customers"
        )
        enable_tax_exemptions: bool = Field(True, description="Allow tax exemptions")

        # Feature flags
        enable_promotional_codes: bool = Field(
            True, description="Enable promotional discount codes"
        )
        enable_referral_discounts: bool = Field(
            False, description="Enable referral discount system"
        )
        enable_multi_currency: bool = Field(False, description="Enable multi-currency support")
        enable_dunning_management: bool = Field(
            True, description="Enable dunning management for failed payments"
        )
        exchange_rate_provider: str = Field(
            "openexchangerates", description="Currency exchange rate provider identifier"
        )
        exchange_rate_refresh_minutes: int = Field(
            60, description="How often to refresh exchange rates (minutes)"
        )
        exchange_rate_endpoint: str | None = Field(
            None, description="Override endpoint for exchange rate provider"
        )
        supported_currencies: list[str] = Field(
            default_factory=lambda: ["USD", "EUR", "GBP"],
            description="Global list of supported currencies",
        )

        # Payment processing
        require_payment_plugin: bool = Field(
            True,
            description="Require payment plugin (fail if unavailable). MUST be True in production to prevent mock payments. Set False ONLY in development/testing.",
        )

        # Payment gateway credentials (load from Vault in production)
        paystack_secret_key: str = Field("", description="Paystack secret key")
        paystack_public_key: str = Field("", description="Paystack public key")

        stripe_api_key: str = Field("", description="Stripe API key (secret)")
        stripe_webhook_secret: str = Field("", description="Stripe webhook secret")
        stripe_publishable_key: str = Field("", description="Stripe publishable key")

        paypal_client_id: str = Field("", description="PayPal client ID")
        paypal_client_secret: str = Field("", description="PayPal client secret")
        paypal_webhook_id: str = Field("", description="PayPal webhook ID")

        avalara_api_key: str = Field("", description="Avalara API key")
        taxjar_api_token: str = Field("", description="TaxJar API token")

    billing: BillingSettings = BillingSettings()  # type: ignore[call-arg]

    # ============================================================
    # Rate Limiting
    # ============================================================

    class RateLimitSettings(BaseModel):  # BaseModel resolves to Any in isolation
        """Rate limiting configuration."""

        model_config = ConfigDict()

        enabled: bool = Field(True, description="Enable rate limiting")
        default_limit: str = Field("100/hour", description="Default rate limit")
        storage_url: str | None = Field(
            None, description="Storage URL for distributed rate limiting"
        )
        key_prefix: str = Field("rate_limit", description="Key prefix for storage")

        # Per-endpoint limits
        endpoint_limits: dict[str, str] = Field(
            default_factory=dict, description="Per-endpoint limits"
        )

    rate_limit: RateLimitSettings = RateLimitSettings()  # type: ignore[call-arg]

    # ============================================================
    # Vault/Secrets Management
    # ============================================================

    class VaultSettings(BaseModel):  # BaseModel resolves to Any in isolation
        """Vault/OpenBao configuration (API-compatible)."""

        model_config = ConfigDict()

        enabled: bool = Field(False, description="Enable Vault/OpenBao")
        url: str = Field("http://localhost:8200", description="Vault/OpenBao URL")
        token: str | None = Field(None, description="Vault token")
        namespace: str | None = Field(None, description="Vault namespace")
        mount_path: str = Field("secret", description="Mount path")
        kv_version: int = Field(2, description="KV version (1 or 2)")

    vault: VaultSettings = VaultSettings()  # type: ignore[call-arg]

    # ============================================================
    # Object Storage (S3/MinIO)
    # ============================================================

    class StorageSettings(BaseModel):  # BaseModel resolves to Any in isolation
        """MinIO object storage configuration."""

        model_config = ConfigDict()

        provider: str = Field("minio", description="Storage provider: 'minio' or 'local'")
        enabled: bool = Field(True, description="Enable MinIO storage")
        endpoint: str = Field("localhost:9000", description="MinIO endpoint")
        region: str = Field("us-east-1", description="MinIO region")
        access_key: str = Field("", description="MinIO access key (load from Vault in production)")
        secret_key: str = Field("", description="MinIO secret key (load from Vault in production)")
        bucket: str = Field("dotmac", description="Default bucket")
        use_ssl: bool = Field(False, description="Use SSL")

        # Local fallback for development
        local_path: str = Field(
            default_factory=_default_storage_path,  # resolved via env when available
            description="Local storage path for dev/persistent volumes",
        )

    storage: StorageSettings = StorageSettings()  # type: ignore[call-arg]

    # ============================================================
    # Billing & Payment Integration
    # ============================================================

    # ============================================================
    # Webhooks
    # ============================================================

    class WebhookSettings(BaseModel):  # BaseModel resolves to Any in isolation
        """Webhook configuration."""

        model_config = ConfigDict()

        signing_secret: str = Field("", description="Webhook signing secret for verification")
        retry_attempts: int = Field(3, description="Number of retry attempts for failed webhooks")
        timeout_seconds: int = Field(30, description="Webhook request timeout")

    webhooks: WebhookSettings = WebhookSettings()  # type: ignore[call-arg]

    # ============================================================
    # RADIUS Server
    # ============================================================

    # RADIUS configuration moved to top-level RADIUSSettings class (line 152)
    # Old minimal configuration removed - use settings.radius.* instead

    # ============================================================
    # Search & Indexing
    # ============================================================

    class SearchSettings(BaseModel):  # BaseModel resolves to Any in isolation
        """Search and indexing configuration."""

        model_config = ConfigDict()

        meilisearch_api_key: str = Field("", description="MeiliSearch API key")
        meilisearch_url: str = Field("http://localhost:7700", description="MeiliSearch URL")
        meilisearch_index_prefix: str = Field("dotmac_", description="Index name prefix")

    search: SearchSettings = SearchSettings()  # type: ignore[call-arg]

    # ============================================================
    # Fault Management & Archival
    # ============================================================

    class FaultManagementSettings(BaseModel):  # BaseModel resolves to Any in isolation
        """Fault management and alarm archival configuration."""

        model_config = ConfigDict()

        # Alarm archival settings
        alarm_retention_days: int = Field(
            90,
            ge=1,
            description="Number of days to retain cleared alarms before archival (default: 90)",
        )
        archive_time_hour: int = Field(
            2,
            ge=0,
            le=23,
            description="Hour of day (0-23) to run alarm archival (default: 2 AM)",
        )
        archive_time_minute: int = Field(
            0,
            ge=0,
            le=59,
            description="Minute of hour to run alarm archival (default: 0)",
        )
        archive_batch_size: int = Field(
            1000,
            ge=1,
            description="Maximum number of alarms to archive in one batch",
        )
        archive_compression_level: int = Field(
            9,
            ge=1,
            le=9,
            description="Gzip compression level (1-9, where 9 is maximum compression)",
        )

        # Alarm correlation settings
        correlation_window_seconds: int = Field(
            300,
            ge=1,
            description="Time window for alarm correlation (default: 5 minutes)",
        )
        max_occurrence_count: int = Field(
            100,
            ge=1,
            description="Maximum occurrence count before marking as flapping",
        )

        # SLA tracking settings
        sla_check_interval_seconds: int = Field(
            60,
            ge=1,
            description="Interval for checking SLA compliance (default: 1 minute)",
        )

        # Notification settings
        critical_alarm_auto_notify: bool = Field(
            True,
            description="Automatically send notifications for critical alarms",
        )
        escalation_timeout_minutes: int = Field(
            30,
            ge=1,
            description="Minutes before escalating unacknowledged critical alarms",
        )

    fault_management: FaultManagementSettings = FaultManagementSettings()  # type: ignore[call-arg]

    # ============================================================
    # Notifications & Channels
    # ============================================================

    class NotificationSettings(BaseModel):  # BaseModel resolves to Any in isolation
        """Notification channel providers configuration."""

        model_config = ConfigDict()

        # Email channel
        email_enabled: bool = Field(True, description="Enable email notifications")

        # SMS channel
        sms_enabled: bool = Field(False, description="Enable SMS notifications")
        sms_provider: str = Field("twilio", description="SMS provider: twilio, aws_sns, http")
        # Twilio
        twilio_account_sid: str | None = Field(None, description="Twilio account SID")
        twilio_auth_token: str | None = Field(None, description="Twilio auth token")
        twilio_from_number: str | None = Field(
            None, description="Twilio sender phone number (E.164 format)"
        )
        # SMS HTTP API
        sms_http_api_url: str | None = Field(None, description="Custom SMS API URL")
        sms_http_api_key: str | None = Field(None, description="Custom SMS API key")
        # SMS settings
        sms_max_length: int = Field(160, ge=70, description="Max SMS message length")
        sms_min_priority: str = Field(
            "HIGH", description="Minimum priority for SMS (LOW, MEDIUM, HIGH, URGENT)"
        )
        sms_max_retries: int = Field(2, ge=0, description="Max SMS retry attempts")

        # Push channel
        push_enabled: bool = Field(False, description="Enable push notifications")
        push_provider: str = Field(
            "fcm", description="Push provider: fcm, onesignal, aws_sns, http"
        )
        # Firebase
        fcm_credentials_path: str | None = Field(
            None, description="Path to Firebase service account JSON"
        )
        # OneSignal
        onesignal_app_id: str | None = Field(None, description="OneSignal app ID")
        onesignal_api_key: str | None = Field(None, description="OneSignal API key")
        # Push HTTP API
        push_http_api_url: str | None = Field(None, description="Custom push API URL")
        push_http_api_key: str | None = Field(None, description="Custom push API key")
        # Push settings
        push_min_priority: str = Field(
            "MEDIUM", description="Minimum priority for push (LOW, MEDIUM, HIGH, URGENT)"
        )
        push_max_retries: int = Field(3, ge=0, description="Max push retry attempts")

        # Webhook channel
        webhook_enabled: bool = Field(False, description="Enable webhook notifications")
        webhook_urls: list[str] = Field(default_factory=list, description="List of webhook URLs")
        webhook_format: str = Field(
            "standard",
            description="Webhook payload format: standard, slack, teams, discord",
        )
        webhook_secret: str | None = Field(None, description="Shared secret for webhook signature")
        webhook_headers: dict[str, str] = Field(
            default_factory=dict, description="Custom webhook headers"
        )
        webhook_timeout: float = Field(10.0, ge=1.0, description="Webhook HTTP timeout in seconds")
        webhook_max_retries: int = Field(3, ge=0, description="Max webhook retry attempts")

        # AWS (shared for SNS)
        aws_region: str = Field("us-east-1", description="AWS region for SNS")

    notifications: NotificationSettings = NotificationSettings()  # type: ignore[call-arg]

    # ============================================================
    # Audit & Logging
    # ============================================================

    class AuditSettings(BaseModel):  # BaseModel resolves to Any in isolation
        """Audit and logging configuration."""

        model_config = ConfigDict()

        # Frontend log ingestion security
        frontend_log_secret: str | None = Field(
            default=None,
            description="Shared secret for frontend log ingestion. Required in production to prevent audit log forgery.",
        )
        frontend_log_allowed_origins: list[str] = Field(
            default_factory=lambda: ["*"],
            description=(
                "Allowed origins for frontend log ingestion. "
                "Format: Full canonical URLs with scheme, host, and optional port. "
                "Examples: ['https://app.example.com', 'https://app.example.com:8443'] "
                "Use '*' to allow all origins (NOT recommended for production). "
                "HTTPS is enforced for security unless explicitly using http://localhost or http://127.0.0.1 for development."
            ),
        )
        frontend_log_require_auth: bool = Field(
            default=False,
            description="Require authentication for frontend log ingestion (recommended for production)",
        )

        # Audit retention
        audit_retention_days: int = Field(
            default=90,
            ge=1,
            description="Number of days to retain audit logs before archiving",
        )
        audit_archive_enabled: bool = Field(
            default=True,
            description="Enable audit log archiving",
        )
        audit_archive_location: str = Field(
            default="/var/audit/archive",
            description="Directory path for audit log archives (use absolute path)",
        )

    audit: AuditSettings = AuditSettings()  # type: ignore[call-arg]

    # ============================================================
    # Feature Flags
    # ============================================================

    class FeatureFlags(BaseModel):  # BaseModel resolves to Any in isolation
        """Feature flags for core platform features."""

        model_config = ConfigDict()

        # Core features
        mfa_enabled: bool = Field(False, description="Enable multi-factor authentication")
        audit_logging: bool = Field(True, description="Enable audit logging")
        # Communications
        email_enabled: bool = Field(True, description="Enable email integrations")
        communications_enabled: bool = Field(
            True, description="Enable core communications functionality"
        )
        sms_enabled: bool = Field(False, description="Enable SMS integrations")

        # Storage - MinIO only
        storage_enabled: bool = Field(True, description="Enable MinIO storage")

        # Search functionality (MeiliSearch)
        search_enabled: bool = Field(True, description="Enable search functionality")

        # Data handling
        data_transfer_enabled: bool = Field(True, description="Enable data import/export")
        data_transfer_excel: bool = Field(True, description="Enable Excel import/export support")
        data_transfer_compression: bool = Field(True, description="Enable compression support")
        data_transfer_streaming: bool = Field(True, description="Enable streaming data transfer")

        # File processing
        file_processing_enabled: bool = Field(True, description="Enable file processing")
        file_processing_pdf: bool = Field(True, description="Enable PDF processing")
        file_processing_images: bool = Field(True, description="Enable image processing")
        file_processing_office: bool = Field(True, description="Enable Office document processing")

        # Background tasks
        celery_enabled: bool = Field(True, description="Enable Celery task queue")
        celery_redis: bool = Field(True, description="Use Redis as Celery broker")

        # Encryption and secrets
        encryption_fernet: bool = Field(True, description="Enable Fernet encryption")
        secrets_vault: bool = Field(False, description="Enable Vault/OpenBao secrets backend")

        # Database
        db_migrations: bool = Field(True, description="Enable database migrations")
        db_postgresql: bool = Field(True, description="Enable PostgreSQL support")
        db_sqlite: bool = Field(True, description="Enable SQLite support for dev/test")

        # OSS/BSS Domain Features
        graphql_enabled: bool = Field(True, description="Enable GraphQL API")
        analytics_enabled: bool = Field(True, description="Enable analytics features")
        banking_enabled: bool = Field(True, description="Enable banking integrations")
        payments_enabled: bool = Field(True, description="Enable payment processing")
        radius_enabled: bool = Field(True, description="Enable RADIUS AAA")
        network_enabled: bool = Field(True, description="Enable network management")
        automation_enabled: bool = Field(True, description="Enable automation workflows")
        wireless_enabled: bool = Field(True, description="Enable wireless infrastructure")
        fiber_enabled: bool = Field(True, description="Enable fiber infrastructure")
        orchestration_enabled: bool = Field(True, description="Enable service orchestration")
        dunning_enabled: bool = Field(True, description="Enable dunning workflows")
        ticketing_enabled: bool = Field(True, description="Enable ticketing system")
        crm_enabled: bool = Field(True, description="Enable CRM features")
        notification_enabled: bool = Field(True, description="Enable notification center")
        pon_alarm_actions_enabled: bool = Field(
            True, description="Enable alarm acknowledge/clear actions for PON/VOLTHA views"
        )

    features: FeatureFlags = FeatureFlags()  # type: ignore[call-arg]

    # ============================================================
    # SMS / Communications
    # ============================================================

    sms_from_number: str | None = Field(
        None,
        description="Default SMS sender/phone number (E.164 format)",
    )

    # ============================================================
    # Validation & Helpers
    # ============================================================

    @field_validator("environment")
    def validate_environment(cls, v: str | Environment) -> Environment:
        """Validate environment."""
        if isinstance(v, Environment):
            return v
        return Environment(v.lower())

    @field_validator("secret_key")
    def validate_secret_key(cls, v: str, info: Any) -> str:
        """Validate secret key."""
        if info.data.get("environment") == Environment.PRODUCTION:
            if not v or v in ("", "change-me-in-production", "change-me"):
                raise ValueError(
                    "SECRET_KEY must be loaded from Vault in production. "
                    "Ensure VAULT_ENABLED=true and secrets are migrated."
                )
            if len(v) < 32:
                raise ValueError("SECRET_KEY must be at least 32 characters in production")
        return v

    @property
    def is_production(self) -> bool:
        """Check if running in production."""
        return self.environment == Environment.PRODUCTION

    @property
    def is_development(self) -> bool:
        """Check if running in development."""
        return self.environment == Environment.DEVELOPMENT

    @property
    def is_testing(self) -> bool:
        """Check if running in test mode."""
        return self.testing or self.environment == Environment.TEST


# Global settings instance
_settings: Settings | None = None


def get_settings() -> Settings:
    """Get global settings instance (singleton)."""
    global _settings
    if _settings is None:
        _settings = Settings()  # type: ignore
    return _settings


def reset_settings() -> None:
    """Reset settings (mainly for testing)."""
    global _settings
    _settings = None


# Convenience export
settings = get_settings()

# Resolve forward references introduced by nested OSS settings
Settings.model_rebuild()
