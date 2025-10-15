"""Centralized configuration using pydantic-settings.

All configuration is loaded from environment variables and .env files.
This is the single source of truth for all platform configuration.
"""

from __future__ import annotations

import os
from enum import Enum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, PostgresDsn, RedisDsn, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Environment(str, Enum):
    """Application environment."""

    DEVELOPMENT = "development"
    STAGING = "staging"
    PRODUCTION = "production"
    TEST = "test"


class ServiceEndpointSettings(BaseModel):
    """External OSS/automation service endpoint configuration."""

    model_config = ConfigDict()

    url: str | None = Field(None, description="Base URL for the service endpoint")
    username: str | None = Field(None, description="Optional username for basic auth")
    password: str | None = Field(None, description="Optional password for basic auth")
    api_token: str | None = Field(None, description="Optional API token")
    verify_ssl: bool = Field(True, description="Verify SSL certificates")
    timeout_seconds: float = Field(30.0, ge=1.0, description="HTTP timeout in seconds")
    max_retries: int = Field(2, ge=0, description="Number of automatic retries for requests")


class ObservabilitySettings(BaseModel):
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


def _default_observability_settings() -> ObservabilitySettings:
    return ObservabilitySettings.model_validate({})


class OSSSettings(BaseModel):
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

    class DatabaseSettings(BaseModel):
        """Database configuration."""

        model_config = ConfigDict()

        url: PostgresDsn | None = Field(None, description="Full database URL")
        host: str = Field("localhost", description="Database host")
        port: int = Field(5432, description="Database port")
        database: str = Field("dotmac", description="Database name")
        username: str = Field("dotmac", description="Database username")
        password: str = Field("", description="Database password")

        # Connection pool
        pool_size: int = Field(10, description="Connection pool size")
        max_overflow: int = Field(20, description="Max overflow connections")
        pool_timeout: int = Field(30, description="Pool timeout in seconds")
        pool_recycle: int = Field(3600, description="Recycle connections after seconds")
        pool_pre_ping: bool = Field(True, description="Test connections before use")

        # Options
        echo: bool = Field(False, description="Echo SQL statements")
        echo_pool: bool = Field(False, description="Echo pool events")

        @property
        def sqlalchemy_url(self) -> str:
            """Build SQLAlchemy database URL."""
            if self.url:
                return str(self.url)
            return f"postgresql+asyncpg://{self.username}:{self.password}@{self.host}:{self.port}/{self.database}"

    database: DatabaseSettings = DatabaseSettings()  # type: ignore[call-arg]

    # ============================================================
    # Redis Configuration
    # ============================================================

    class RedisSettings(BaseModel):
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
    # JWT & Authentication
    # ============================================================

    class JWTSettings(BaseModel):
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
            return self.secret_key != "" and self.secret_key != "change-me" and len(self.secret_key) >= 32

    jwt: JWTSettings = JWTSettings()  # type: ignore[call-arg]

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

    class CORSSettings(BaseModel):
        """CORS configuration."""

        model_config = ConfigDict()

        enabled: bool = Field(True, description="Enable CORS")
        origins: list[str] = Field(
            default_factory=lambda: [
                "http://localhost:3000",  # Frontend dev server
                "http://localhost:3001",  # Alternative frontend port
                "http://localhost:8000",  # Backend (for Swagger UI)
                "http://127.0.0.1:3000",
                "http://127.0.0.1:8000",
            ],
            description="Allowed origins for CORS",
        )
        methods: list[str] = Field(default_factory=lambda: ["*"], description="Allowed methods")
        headers: list[str] = Field(default_factory=lambda: ["*"], description="Allowed headers")
        credentials: bool = Field(True, description="Allow credentials")
        max_age: int = Field(3600, description="Max age for preflight")

    cors: CORSSettings = CORSSettings()  # type: ignore[call-arg]

    # ============================================================
    # Email & SMTP Settings
    # ============================================================

    class EmailSettings(BaseModel):
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

    class TenantSettings(BaseModel):
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

    class CelerySettings(BaseModel):
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
    # Billing Configuration
    # ============================================================

    class BillingSettings(BaseModel):
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

    billing: BillingSettings = BillingSettings()  # type: ignore[call-arg]

    # ============================================================
    # Rate Limiting
    # ============================================================

    class RateLimitSettings(BaseModel):
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

    class VaultSettings(BaseModel):
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

    class StorageSettings(BaseModel):
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
            "/tmp/storage",  # nosec B108 - Configurable via env var, dev default only
            description="Local storage path for dev",
        )

    storage: StorageSettings = StorageSettings()  # type: ignore[call-arg]

    # ============================================================
    # Billing & Payment Integration
    # ============================================================

    class BillingSettings(BaseModel):
        """Billing and payment gateway configuration."""

        model_config = ConfigDict()

        # Stripe configuration
        stripe_api_key: str = Field("", description="Stripe API key (secret)")
        stripe_webhook_secret: str = Field("", description="Stripe webhook secret")
        stripe_publishable_key: str = Field("", description="Stripe publishable key")

        # PayPal configuration
        paypal_client_id: str = Field("", description="PayPal client ID")
        paypal_client_secret: str = Field("", description="PayPal client secret")
        paypal_webhook_id: str = Field("", description="PayPal webhook ID")

        # Tax service configuration
        avalara_api_key: str = Field("", description="Avalara API key")
        taxjar_api_token: str = Field("", description="TaxJar API token")

    billing: BillingSettings = BillingSettings()  # type: ignore[call-arg]

    # ============================================================
    # Webhooks
    # ============================================================

    class WebhookSettings(BaseModel):
        """Webhook configuration."""

        model_config = ConfigDict()

        signing_secret: str = Field("", description="Webhook signing secret for verification")
        retry_attempts: int = Field(3, description="Number of retry attempts for failed webhooks")
        timeout_seconds: int = Field(30, description="Webhook request timeout")

    webhooks: WebhookSettings = WebhookSettings()  # type: ignore[call-arg]

    # ============================================================
    # RADIUS Server
    # ============================================================

    class RADIUSSettings(BaseModel):
        """RADIUS server configuration."""

        model_config = ConfigDict()

        secret: str = Field("", description="RADIUS shared secret (load from Vault in production)")
        auth_port: int = Field(1812, description="RADIUS authentication port")
        acct_port: int = Field(1813, description="RADIUS accounting port")
        nas_identifier: str = Field("dotmac-platform", description="NAS identifier")

    radius: RADIUSSettings = RADIUSSettings()  # type: ignore[call-arg]

    # ============================================================
    # Search & Indexing
    # ============================================================

    class SearchSettings(BaseModel):
        """Search and indexing configuration."""

        model_config = ConfigDict()

        meilisearch_api_key: str = Field("", description="MeiliSearch API key")
        meilisearch_url: str = Field("http://localhost:7700", description="MeiliSearch URL")
        meilisearch_index_prefix: str = Field("dotmac_", description="Index name prefix")

    search: SearchSettings = SearchSettings()  # type: ignore[call-arg]

    # ============================================================
    # Feature Flags
    # ============================================================

    class FeatureFlags(BaseModel):
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
    def validate_environment(cls, v: str) -> str:
        """Validate environment."""
        if isinstance(v, str):
            return Environment(v.lower())
        return v

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
