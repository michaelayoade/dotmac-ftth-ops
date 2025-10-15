#!/usr/bin/env python3
"""
Migrate Environment Variables to Vault/OpenBao

This script helps migrate sensitive environment variables from .env files
or environment to Vault/OpenBao for secure storage.

Usage:
    # Dry run (preview what will be migrated)
    python scripts/migrate_secrets_to_vault.py --dry-run

    # Migrate from .env file
    python scripts/migrate_secrets_to_vault.py --env-file .env

    # Migrate from current environment
    python scripts/migrate_secrets_to_vault.py

    # Migrate specific secrets only
    python scripts/migrate_secrets_to_vault.py --secrets database redis stripe

    # Force overwrite existing secrets in Vault
    python scripts/migrate_secrets_to_vault.py --force
"""

import argparse
import asyncio
import logging
import os
import sys
from pathlib import Path
from typing import Any

# Add project root to path
project_root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(project_root / "src"))

from dotenv import dotenv_values

from dotmac.platform.secrets.vault_client import AsyncVaultClient, VaultError

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


# Environment variable to Vault path mapping
ENV_VAR_TO_VAULT_PATH = {
    # Core application
    "SECRET_KEY": "app/secret_key",
    "DOTMAC_ENCRYPTION_KEY": "app/encryption_key",

    # Database
    "DATABASE_PASSWORD": "database/password",
    "DB_PASSWORD": "database/password",
    "DATABASE_USERNAME": "database/username",
    "DB_USER": "database/username",

    # Redis
    "REDIS_PASSWORD": "redis/password",

    # JWT/Auth
    "JWT_SECRET_KEY": "auth/jwt_secret",
    "DOTMAC_JWT_SECRET_KEY": "auth/jwt_secret_key",
    "PLATFORM_ADMIN_EMAIL": "auth/platform_admin/email",
    "PLATFORM_ADMIN_PASSWORD": "auth/platform_admin/password",

    # Email/SMTP
    "SMTP_PASSWORD": "smtp/password",
    "SMTP_USER": "smtp/username",

    # Object Storage (S3/MinIO)
    "STORAGE_ACCESS_KEY": "storage/access_key",
    "MINIO_ACCESS_KEY": "storage/access_key",
    "STORAGE_SECRET_KEY": "storage/secret_key",
    "MINIO_SECRET_KEY": "storage/secret_key",

    # Payment Gateways
    "STRIPE_API_KEY": "billing/stripe/api_key",
    "STRIPE_WEBHOOK_SECRET": "billing/stripe/webhook_secret",
    "STRIPE_PUBLISHABLE_KEY": "billing/stripe/publishable_key",
    "PAYPAL_CLIENT_ID": "billing/paypal/client_id",
    "PAYPAL_CLIENT_SECRET": "billing/paypal/client_secret",
    "PAYPAL_WEBHOOK_ID": "billing/paypal/webhook_id",

    # Tax Services
    "AVALARA_API_KEY": "billing/avalara/api_key",
    "TAXJAR_API_TOKEN": "billing/taxjar/api_token",

    # OSS Integrations
    "VOLTHA_PASSWORD": "oss/voltha/password",
    "VOLTHA_TOKEN": "oss/voltha/token",
    "GENIEACS_PASSWORD": "oss/genieacs/password",
    "GENIEACS_API_TOKEN": "oss/genieacs/token",
    "NETBOX_API_TOKEN": "oss/netbox/token",
    "NETBOX_PASSWORD": "oss/netbox/password",
    "AWX_PASSWORD": "oss/awx/password",
    "AWX_TOKEN": "oss/awx/token",

    # Network Services
    "RADIUS_SECRET": "radius/secret",

    # Webhooks
    "WEBHOOK_SIGNING_SECRET": "webhooks/signing_secret",

    # Search/Indexing
    "MEILISEARCH_API_KEY": "search/meilisearch/api_key",

    # WireGuard
    "WIREGUARD_ENCRYPTION_KEY": "wireguard/encryption_key",

    # Observability
    "SENTRY_DSN": "observability/sentry_dsn",

    # Vault AppRole (for initial auth)
    "VAULT_SECRET_ID": "vault/secret_id",
    "VAULT_ROLE_ID": "vault/role_id",
}

# Secrets grouped by category for selective migration
SECRET_CATEGORIES = {
    "database": ["DATABASE_PASSWORD", "DB_PASSWORD", "DATABASE_USERNAME", "DB_USER"],
    "redis": ["REDIS_PASSWORD"],
    "auth": ["JWT_SECRET_KEY", "DOTMAC_JWT_SECRET_KEY", "PLATFORM_ADMIN_EMAIL", "PLATFORM_ADMIN_PASSWORD"],
    "smtp": ["SMTP_PASSWORD", "SMTP_USER"],
    "storage": ["STORAGE_ACCESS_KEY", "MINIO_ACCESS_KEY", "STORAGE_SECRET_KEY", "MINIO_SECRET_KEY"],
    "stripe": ["STRIPE_API_KEY", "STRIPE_WEBHOOK_SECRET", "STRIPE_PUBLISHABLE_KEY"],
    "paypal": ["PAYPAL_CLIENT_ID", "PAYPAL_CLIENT_SECRET", "PAYPAL_WEBHOOK_ID"],
    "tax": ["AVALARA_API_KEY", "TAXJAR_API_TOKEN"],
    "voltha": ["VOLTHA_PASSWORD", "VOLTHA_TOKEN"],
    "genieacs": ["GENIEACS_PASSWORD", "GENIEACS_API_TOKEN"],
    "netbox": ["NETBOX_API_TOKEN", "NETBOX_PASSWORD"],
    "awx": ["AWX_PASSWORD", "AWX_TOKEN"],
    "radius": ["RADIUS_SECRET"],
    "webhooks": ["WEBHOOK_SIGNING_SECRET"],
    "search": ["MEILISEARCH_API_KEY"],
    "wireguard": ["WIREGUARD_ENCRYPTION_KEY"],
    "observability": ["SENTRY_DSN"],
}


def load_secrets_from_env(env_file: str | None = None) -> dict[str, str]:
    """
    Load secrets from environment or .env file.

    Args:
        env_file: Path to .env file (optional)

    Returns:
        Dictionary of environment variables
    """
    if env_file:
        logger.info(f"Loading secrets from {env_file}")
        return dict(dotenv_values(env_file))
    else:
        logger.info("Loading secrets from current environment")
        return dict(os.environ)


def filter_secrets_to_migrate(
    env_vars: dict[str, str],
    categories: list[str] | None = None,
) -> dict[str, tuple[str, str]]:
    """
    Filter environment variables to only include secrets that should be migrated.

    Args:
        env_vars: Dictionary of environment variables
        categories: List of secret categories to include (None = all)

    Returns:
        Dictionary mapping env var name to (vault_path, value)
    """
    secrets_to_migrate: dict[str, tuple[str, str]] = {}

    # Determine which env vars to include
    if categories:
        env_vars_to_check = set()
        for category in categories:
            if category in SECRET_CATEGORIES:
                env_vars_to_check.update(SECRET_CATEGORIES[category])
            else:
                logger.warning(f"Unknown category: {category}")
    else:
        env_vars_to_check = set(ENV_VAR_TO_VAULT_PATH.keys())

    # Filter secrets
    for env_var, vault_path in ENV_VAR_TO_VAULT_PATH.items():
        if env_var in env_vars_to_check and env_var in env_vars:
            value = env_vars[env_var]
            if value:  # Only include non-empty values
                secrets_to_migrate[env_var] = (vault_path, value)

    return secrets_to_migrate


async def migrate_secrets_to_vault(
    secrets: dict[str, tuple[str, str]],
    vault_client: AsyncVaultClient,
    dry_run: bool = False,
    force: bool = False,
) -> tuple[int, int, int]:
    """
    Migrate secrets to Vault.

    Args:
        secrets: Dictionary mapping env var name to (vault_path, value)
        vault_client: Vault client
        dry_run: If True, only preview changes without writing
        force: If True, overwrite existing secrets

    Returns:
        Tuple of (migrated_count, skipped_count, error_count)
    """
    migrated = 0
    skipped = 0
    errors = 0

    for env_var, (vault_path, value) in secrets.items():
        try:
            # Check if secret already exists
            existing_secret = None
            try:
                existing_secret = await vault_client.get_secret(vault_path)
            except VaultError:
                pass  # Secret doesn't exist

            if existing_secret and not force:
                logger.info(f"⏭️  SKIP: {env_var} → {vault_path} (already exists, use --force to overwrite)")
                skipped += 1
                continue

            if dry_run:
                logger.info(f"🔍 DRY RUN: Would migrate {env_var} → {vault_path}")
                logger.debug(f"   Value: {value[:10]}..." if len(value) > 10 else f"   Value: {value}")
                migrated += 1
            else:
                # Store secret in Vault
                await vault_client.set_secret(
                    vault_path,
                    {
                        "value": value,
                        "source": env_var,
                        "migrated_at": asyncio.get_event_loop().time(),
                    }
                )
                logger.info(f"✅ MIGRATED: {env_var} → {vault_path}")
                migrated += 1

        except Exception as e:
            logger.error(f"❌ ERROR: Failed to migrate {env_var} to {vault_path}: {e}")
            errors += 1

    return migrated, skipped, errors


async def main(args: argparse.Namespace) -> int:
    """Main migration function."""

    # Load Vault configuration
    vault_url = os.getenv("VAULT_ADDR", "http://localhost:8200")
    vault_token = os.getenv("VAULT_TOKEN")
    vault_mount = os.getenv("VAULT_MOUNT_PATH", "secret")
    vault_kv_version = int(os.getenv("VAULT_KV_VERSION", "2"))

    if not vault_token:
        logger.error("VAULT_TOKEN environment variable is required")
        return 1

    logger.info(f"Vault URL: {vault_url}")
    logger.info(f"Vault Mount: {vault_mount}")
    logger.info(f"KV Version: {vault_kv_version}")

    # Load secrets from environment or .env file
    env_vars = load_secrets_from_env(args.env_file)
    logger.info(f"Loaded {len(env_vars)} environment variables")

    # Filter secrets to migrate
    secrets = filter_secrets_to_migrate(env_vars, args.secrets)
    logger.info(f"Found {len(secrets)} secrets to migrate")

    if not secrets:
        logger.warning("No secrets found to migrate")
        return 0

    # Create Vault client
    vault_client = AsyncVaultClient(
        url=vault_url,
        token=vault_token,
        mount_path=vault_mount,
        kv_version=vault_kv_version,
    )

    try:
        # Check Vault health
        if not await vault_client.health_check():
            logger.error("Vault health check failed")
            return 1

        logger.info("✅ Vault connection successful")

        if args.dry_run:
            logger.info("\n🔍 DRY RUN MODE - No changes will be made\n")

        # Migrate secrets
        migrated, skipped, errors = await migrate_secrets_to_vault(
            secrets,
            vault_client,
            dry_run=args.dry_run,
            force=args.force,
        )

        # Print summary
        logger.info("\n" + "=" * 60)
        logger.info("MIGRATION SUMMARY")
        logger.info("=" * 60)
        logger.info(f"✅ Migrated: {migrated}")
        logger.info(f"⏭️  Skipped:  {skipped}")
        logger.info(f"❌ Errors:   {errors}")
        logger.info("=" * 60)

        if args.dry_run:
            logger.info("\nThis was a DRY RUN. Run without --dry-run to apply changes.")

        return 0 if errors == 0 else 1

    finally:
        await vault_client.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Migrate environment variables to Vault/OpenBao",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Preview migration (dry run)
  python scripts/migrate_secrets_to_vault.py --dry-run

  # Migrate from .env file
  python scripts/migrate_secrets_to_vault.py --env-file .env

  # Migrate only database and redis secrets
  python scripts/migrate_secrets_to_vault.py --secrets database redis

  # Force overwrite existing secrets
  python scripts/migrate_secrets_to_vault.py --force

Available secret categories:
  database, redis, auth, smtp, storage, stripe, paypal, tax,
  voltha, genieacs, netbox, awx, radius, webhooks, search,
  wireguard, observability
        """,
    )

    parser.add_argument(
        "--env-file",
        type=str,
        help="Path to .env file (default: use current environment)",
    )

    parser.add_argument(
        "--secrets",
        nargs="+",
        help="Specific secret categories to migrate (default: all)",
    )

    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Preview what would be migrated without making changes",
    )

    parser.add_argument(
        "--force",
        action="store_true",
        help="Overwrite existing secrets in Vault",
    )

    parser.add_argument(
        "--verbose",
        "-v",
        action="store_true",
        help="Enable verbose logging",
    )

    args = parser.parse_args()

    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    sys.exit(asyncio.run(main(args)))
