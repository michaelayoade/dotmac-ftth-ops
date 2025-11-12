"""
Secrets loader for fetching sensitive configuration from Vault/OpenBao.

This module provides functionality to load secrets from Vault/OpenBao
and update the application settings with secure values at runtime.
"""

import inspect
import logging
from typing import Any

from dotmac.platform.secrets.vault_client import AsyncVaultClient, VaultClient, VaultError
from dotmac.platform.settings import Settings, settings

try:
    from .vault_config import get_async_vault_client

    HAS_VAULT_CONFIG = True
except ImportError:
    HAS_VAULT_CONFIG = False

logger = logging.getLogger(__name__)


# Mapping of settings fields to Vault paths
# This mapping defines how application settings are loaded from Vault/OpenBao
# Format: "settings.path": "vault/path"
SECRETS_MAPPING = {
    # ============================================================
    # Core Application Secrets (RESTRICTED)
    # ============================================================
    "secret_key": "app/secret_key",
    # ============================================================
    # Database Credentials (RESTRICTED)
    # ============================================================
    "database.password": "database/password",
    "database.username": "database/username",
    # ============================================================
    # Redis Credentials (CONFIDENTIAL)
    # ============================================================
    "redis.password": "redis/password",
    # ============================================================
    # Authentication & JWT (RESTRICTED)
    # ============================================================
    "jwt.secret_key": "auth/jwt_secret",
    # ============================================================
    # Email/SMTP Credentials (CONFIDENTIAL)
    # ============================================================
    "email.smtp_password": "smtp/password",
    "email.smtp_user": "smtp/username",
    # ============================================================
    # Object Storage Credentials (S3/MinIO) (RESTRICTED)
    # ============================================================
    "storage.access_key": "storage/access_key",
    "storage.secret_key": "storage/secret_key",
    # ============================================================
    # Payment Gateway Credentials (RESTRICTED)
    # ============================================================
    # Paystack (Primary payment gateway)
    "billing.paystack_secret_key": "billing/paystack/secret_key",
    "billing.paystack_public_key": "billing/paystack/public_key",
    # Stripe (Alternative payment gateway)
    "billing.stripe_api_key": "billing/stripe/api_key",
    "billing.stripe_webhook_secret": "billing/stripe/webhook_secret",
    "billing.stripe_publishable_key": "billing/stripe/publishable_key",
    # PayPal (Alternative payment gateway)
    "billing.paypal_client_id": "billing/paypal/client_id",
    "billing.paypal_client_secret": "billing/paypal/client_secret",
    "billing.paypal_webhook_id": "billing/paypal/webhook_id",
    # ============================================================
    # Tax Service API Keys (CONFIDENTIAL)
    # ============================================================
    "billing.avalara_api_key": "billing/avalara/api_key",
    "billing.taxjar_api_token": "billing/taxjar/api_token",
    # ============================================================
    # OSS Integration Credentials (CONFIDENTIAL)
    # ============================================================
    # VOLTHA (PON Controller)
    "oss.voltha.password": "oss/voltha/password",
    "oss.voltha.api_token": "oss/voltha/token",
    # GenieACS (TR-069 ACS)
    "oss.genieacs.password": "oss/genieacs/password",
    "oss.genieacs.api_token": "oss/genieacs/token",
    # NetBox (IPAM/DCIM)
    "oss.netbox.api_token": "oss/netbox/token",
    "oss.netbox.password": "oss/netbox/password",
    # Ansible AWX (Automation)
    "oss.ansible.password": "oss/awx/password",
    "oss.ansible.api_token": "oss/awx/token",
    # ============================================================
    # Network Service Credentials (RESTRICTED)
    # ============================================================
    "radius.secret": "radius/secret",
    # ============================================================
    # Webhook Security (CONFIDENTIAL)
    # ============================================================
    "webhooks.signing_secret": "webhooks/signing_secret",
    # Alertmanager webhook shared secret
    "observability.alertmanager_webhook_secret": "observability/alertmanager/webhook_secret",
    # ============================================================
    # Search/Indexing (CONFIDENTIAL)
    # ============================================================
    "search.meilisearch_api_key": "search/meilisearch/api_key",
    # ============================================================
    # Vault Management (RESTRICTED)
    # ============================================================
    # Vault token (for token renewal)
    "vault.token": "vault/token",
}

# Additional Vault paths for secrets not directly mapped to settings
# These are used by specific services and loaded on-demand
ADDITIONAL_VAULT_PATHS = {
    # Platform admin credentials (loaded during bootstrap)
    "platform_admin_email": "auth/platform_admin/email",
    "platform_admin_password": "auth/platform_admin/password",
    # Encryption keys (loaded by encryption services)
    "wireguard_encryption_key": "wireguard/encryption_key",
    "dotmac_encryption_key": "app/encryption_key",
    "dotmac_jwt_secret_key": "auth/jwt_secret_key",
    # Vault AppRole authentication (for initial auth)
    "vault_secret_id": "vault/secret_id",
    "vault_role_id": "vault/role_id",
    # WireGuard server private keys are stored dynamically at:
    # wireguard/servers/{public_key}/private-key
}


def set_nested_attr(obj: Any, path: str, value: Any) -> None:
    """
    Set a nested attribute on an object using dot notation.

    Args:
        obj: The object to set the attribute on
        path: Dot-separated path to the attribute (e.g., "database.password")
        value: The value to set
    """
    parts = path.split(".")
    for part in parts[:-1]:
        obj = getattr(obj, part)
    setattr(obj, parts[-1], value)


def get_nested_attr(obj: Any, path: str, default: Any | None = None) -> Any:
    """
    Get a nested attribute from an object using dot notation.

    Args:
        obj: The object to get the attribute from
        path: Dot-separated path to the attribute
        default: Default value if attribute doesn't exist

    Returns:
        The attribute value or default
    """
    try:
        parts = path.split(".")
        for part in parts:
            obj = getattr(obj, part)
        return obj
    except AttributeError:
        return default


def _extract_secret_value(secret_data: Any) -> str | None:
    """
    Extract secret value from various Vault data formats.

    Args:
        secret_data: Secret data from Vault (dict, string, or other)

    Returns:
        Extracted secret value or None
    """
    if isinstance(secret_data, dict):
        if "value" in secret_data:
            value = secret_data["value"]
            return str(value) if value is not None else None

        if secret_data:
            first_value = next(iter(secret_data.values()))
            return str(first_value) if first_value is not None else None

    if isinstance(secret_data, str):
        return secret_data

    if secret_data is not None:
        return str(secret_data)

    return None


def _update_settings_with_secrets(settings_obj: Settings, secrets: dict[str, Any]) -> int:
    """
    Update settings object with fetched secrets.

    Args:
        settings_obj: Settings object to update
        secrets: Dictionary of secrets fetched from Vault

    Returns:
        Number of settings updated
    """
    updated_count = 0
    for setting_path, vault_path in SECRETS_MAPPING.items():
        secret_data = secrets.get(vault_path, {})
        secret_value = _extract_secret_value(secret_data)

        if secret_value:
            try:
                set_nested_attr(settings_obj, setting_path, secret_value)
                updated_count += 1
                logger.debug(f"Updated {setting_path} from Vault")
            except Exception as e:
                logger.error(f"Failed to set {setting_path}: {e}")

    return updated_count


async def _cleanup_vault_client_async(vault_client: Any) -> None:
    """
    Clean up async vault client if needed.

    Args:
        vault_client: Vault client to clean up
    """
    if vault_client and hasattr(vault_client, "close"):
        if inspect.iscoroutinefunction(vault_client.close):
            await vault_client.close()
        else:
            vault_client.close()


def _cleanup_vault_client_sync(vault_client: Any) -> None:
    """
    Clean up sync vault client if needed.

    Args:
        vault_client: Vault client to clean up
    """
    if vault_client and hasattr(vault_client, "close"):
        vault_client.close()


async def load_secrets_from_vault(
    settings_obj: Settings | None = None,
    vault_client: AsyncVaultClient | None = None,
) -> None:
    """
    Load secrets from Vault/OpenBao and update settings.

    This function fetches all sensitive configuration values from Vault
    and updates the settings object with these secure values.

    Args:
        settings_obj: Settings object to update (defaults to global settings)
        vault_client: Optional Vault client to use
    """
    if settings_obj is None:
        settings_obj = settings

    # Skip if Vault is not enabled
    if not settings_obj.vault.enabled:
        logger.info("Vault is disabled, using default settings values")
        return

    # Create Vault client if not provided
    if vault_client is None:
        if HAS_VAULT_CONFIG:
            # Use configured client from vault_config
            vault_client = get_async_vault_client()
        else:
            # Fallback to creating client directly
            vault_client = AsyncVaultClient(
                url=settings_obj.vault.url,
                token=settings_obj.vault.token,
                namespace=settings_obj.vault.namespace,
                mount_path=settings_obj.vault.mount_path,
                kv_version=settings_obj.vault.kv_version,
            )

    try:
        # Check Vault health
        if not await vault_client.health_check():
            logger.error("Vault health check failed, using default settings")
            return

        # Collect all Vault paths to fetch
        vault_paths = list(set(SECRETS_MAPPING.values()))
        logger.info(f"Fetching {len(vault_paths)} secrets from Vault")

        # Fetch all secrets in parallel
        secrets = await vault_client.get_secrets(vault_paths)

        # Update settings with fetched secrets
        updated_count = _update_settings_with_secrets(settings_obj, secrets)
        logger.info(f"Successfully loaded {updated_count} secrets from Vault")

        # Validate critical secrets in production
        if settings_obj.environment == "production":
            validate_production_secrets(settings_obj)

    except VaultError as e:
        logger.error(f"Failed to load secrets from Vault: {e}")
        # In production, we might want to fail fast here
        if settings_obj.environment == "production":
            raise
    finally:
        # Always attempt to clean up the client when provided
        if vault_client is not None:
            await _cleanup_vault_client_async(vault_client)


def load_secrets_from_vault_sync(
    settings_obj: Settings | None = None,
    vault_client: VaultClient | None = None,
) -> None:
    """
    Synchronous version of load_secrets_from_vault.

    Use this for non-async contexts.
    """
    if settings_obj is None:
        settings_obj = settings

    if not settings_obj.vault.enabled:
        logger.info("Vault is disabled, using default settings values")
        return

    if vault_client is None:
        vault_client = VaultClient(
            url=settings_obj.vault.url,
            token=settings_obj.vault.token,
            namespace=settings_obj.vault.namespace,
            mount_path=settings_obj.vault.mount_path,
            kv_version=settings_obj.vault.kv_version,
        )

    try:
        if not vault_client.health_check():
            logger.error("Vault health check failed, using default settings")
            return

        vault_paths = list(set(SECRETS_MAPPING.values()))
        logger.info(f"Fetching {len(vault_paths)} secrets from Vault")

        secrets = vault_client.get_secrets(vault_paths)

        # Update settings with fetched secrets
        updated_count = _update_settings_with_secrets(settings_obj, secrets)
        logger.info(f"Successfully loaded {updated_count} secrets from Vault")

        if settings_obj.environment == "production":
            validate_production_secrets(settings_obj)

    except VaultError as e:
        logger.error(f"Failed to load secrets from Vault: {e}")
        if settings_obj.environment == "production":
            raise
    finally:
        _cleanup_vault_client_sync(vault_client)


def validate_production_secrets(settings_obj: Settings) -> None:
    """
    Validate that critical secrets are properly set for production.

    Args:
        settings_obj: Settings object to validate

    Raises:
        ValueError: If critical secrets are missing or invalid
    """
    errors = []

    # Check critical secrets
    if settings_obj.secret_key == "change-me-in-production":
        errors.append("Application secret_key must be changed from default")

    if settings_obj.jwt.secret_key == "change-me":
        errors.append("JWT secret_key must be changed from default")

    if not settings_obj.database.password:
        errors.append("Database password is not set")

    # Check for weak passwords (basic check)
    if settings_obj.database.password and len(settings_obj.database.password) < 12:
        errors.append("Database password is too short (minimum 12 characters)")

    # Check payment gateway configuration (Paystack is primary)
    if not settings_obj.billing.paystack_secret_key:
        errors.append("Paystack secret key is not set (required for payment processing)")

    if not settings_obj.billing.paystack_public_key:
        errors.append("Paystack public key is not set (required for payment processing)")

    # Validate Paystack key format (should start with sk_ or pk_)
    if settings_obj.billing.paystack_secret_key:
        if not settings_obj.billing.paystack_secret_key.startswith(("sk_live_", "sk_test_")):
            errors.append(
                "Paystack secret key has invalid format (should start with sk_live_ or sk_test_)"
            )

    if settings_obj.billing.paystack_public_key:
        if not settings_obj.billing.paystack_public_key.startswith(("pk_live_", "pk_test_")):
            errors.append(
                "Paystack public key has invalid format (should start with pk_live_ or pk_test_)"
            )

    webhook_secret = getattr(settings_obj.observability, "alertmanager_webhook_secret", None)
    if not webhook_secret:
        errors.append("Alertmanager webhook secret must be set")

    if errors:
        error_msg = "Production secrets validation failed:\n" + "\n".join(
            f"  - {e}" for e in errors
        )
        logger.error(error_msg)
        raise ValueError(error_msg)


def get_vault_secret(path: str) -> dict[str, Any] | None:
    """
    Convenience function to fetch a single secret from Vault.

    Args:
        path: Vault path to the secret

    Returns:
        Secret data or None if not found
    """
    if not settings.vault.enabled:
        return None

    try:
        client = VaultClient(
            url=settings.vault.url,
            token=settings.vault.token,
            namespace=settings.vault.namespace,
            mount_path=settings.vault.mount_path,
            kv_version=settings.vault.kv_version,
        )

        with client:
            secret: dict[str, Any] = client.get_secret(path)
            return secret
    except VaultError as e:
        logger.error(f"Failed to fetch secret from {path}: {e}")
        return None


async def get_vault_secret_async(path: str) -> dict[str, Any] | None:
    """
    Async convenience function to fetch a single secret from Vault.

    Args:
        path: Vault path to the secret

    Returns:
        Secret data or None if not found
    """
    if not settings.vault.enabled:
        return None

    try:
        client = AsyncVaultClient(
            url=settings.vault.url,
            token=settings.vault.token,
            namespace=settings.vault.namespace,
            mount_path=settings.vault.mount_path,
            kv_version=settings.vault.kv_version,
        )

        async with client:
            secret = await client.get_secret(path)
            return secret
    except VaultError as e:
        logger.error(f"Failed to fetch secret from {path}: {e}")
        return None
