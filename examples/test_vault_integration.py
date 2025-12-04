#!/usr/bin/env python
"""
Test script to demonstrate Vault/OpenBao integration.

This script shows how secrets are loaded from Vault at application startup.
"""

import os
import sys

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.dotmac.platform.secrets import load_secrets_from_vault_sync
from src.dotmac.platform.settings import settings


def main():
    """Test Vault integration."""
    print("=" * 60)
    print("DotMac Platform Services - Vault Integration Test")
    print("=" * 60)

    # Show current settings (before loading from Vault)
    print("\n1. Settings BEFORE loading from Vault:")
    print(
        f"   - Secret Key: {settings.secret_key[:20]}..."
        if len(settings.secret_key) > 20
        else f"   - Secret Key: {settings.secret_key}"
    )
    print(
        f"   - JWT Secret: {settings.jwt.secret_key[:20]}..."
        if len(settings.jwt.secret_key) > 20
        else f"   - JWT Secret: {settings.jwt.secret_key}"
    )
    print(
        f"   - DB Password: {'*' * len(settings.database.password) if settings.database.password else '(empty)'}"
    )
    print(f"   - Vault Enabled: {settings.vault.enabled}")
    print(f"   - Vault URL: {settings.vault.url}")

    # Check if Vault is enabled
    if not settings.vault.enabled:
        print("\n⚠️  Vault is disabled. Set VAULT__ENABLED=true to enable.")
        print("   Secrets will use default values from environment/settings.")
        return

    # Attempt to load secrets from Vault
    print("\n2. Loading secrets from Vault...")
    try:
        load_secrets_from_vault_sync()
        print("   ✅ Successfully loaded secrets from Vault!")

        # Show updated settings
        print("\n3. Settings AFTER loading from Vault:")
        print(
            f"   - Secret Key: {settings.secret_key[:20]}..."
            if len(settings.secret_key) > 20
            else f"   - Secret Key: {settings.secret_key}"
        )
        print(
            f"   - JWT Secret: {settings.jwt.secret_key[:20]}..."
            if len(settings.jwt.secret_key) > 20
            else f"   - JWT Secret: {settings.jwt.secret_key}"
        )
        print(
            f"   - DB Password: {'*' * len(settings.database.password) if settings.database.password else '(empty)'}"
        )

    except Exception as e:
        print(f"   ❌ Failed to load secrets from Vault: {e}")
        print("\n   This is expected if Vault is not running or configured.")
        print("   To test with Vault:")
        print("   1. Start Vault/OpenBao: vault server -dev")
        print("   2. Run: ./examples/vault_setup.sh")
        print("   3. Set environment: export VAULT__ENABLED=true VAULT__TOKEN=your-token")

    print("\n" + "=" * 60)


if __name__ == "__main__":
    main()
