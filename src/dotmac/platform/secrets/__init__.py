"""Secrets management utilities including Vault/OpenBao integration."""

from .encryption import DataClassification, EncryptedField, SymmetricEncryptionService
from .secrets_loader import (
    SECRETS_MAPPING,
    get_vault_secret,
    get_vault_secret_async,
    load_secrets_from_vault,
    load_secrets_from_vault_sync,
)
from .vault_client import AsyncVaultClient, VaultAuthenticationError, VaultClient, VaultError

try:
    from .vault_config import (  # noqa: F401
        VaultConnectionConfig,
        VaultConnectionManager,
        check_vault_health,
        get_async_vault_client,
        get_vault_client,
        get_vault_config,
        get_vault_config_from_env,
        get_vault_config_from_settings,
        get_vault_connection_manager,
    )

    HAS_VAULT_CONFIG = True
except ImportError:
    HAS_VAULT_CONFIG = False

__all__ = [
    # Encryption utilities
    "DataClassification",
    "EncryptedField",
    "SymmetricEncryptionService",
    # Vault client
    "VaultClient",
    "AsyncVaultClient",
    "VaultError",
    "VaultAuthenticationError",
    # Secrets loading
    "load_secrets_from_vault",
    "load_secrets_from_vault_sync",
    "get_vault_secret",
    "get_vault_secret_async",
    "SECRETS_MAPPING",
]

# Add vault_config exports if available
if HAS_VAULT_CONFIG:
    __all__.extend(
        [
            "VaultConnectionConfig",
            "VaultConnectionManager",
            "check_vault_health",
            "get_vault_client",
            "get_async_vault_client",
            "get_vault_config",
            "get_vault_config_from_env",
            "get_vault_config_from_settings",
            "get_vault_connection_manager",
        ]
    )
