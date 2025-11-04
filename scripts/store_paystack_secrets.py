#!/usr/bin/env python3
"""
Store Paystack API credentials in Vault.

This script helps you securely store Paystack API keys in HashiCorp Vault
or OpenBao for the Payment Methods Service.

Usage:
    python scripts/store_paystack_secrets.py

Environment Variables (optional):
    VAULT_ADDR - Vault server URL (default: http://localhost:8200)
    VAULT_TOKEN - Vault authentication token (required)
    PAYSTACK_SECRET_KEY - Paystack secret key (or will prompt)
    PAYSTACK_PUBLIC_KEY - Paystack public key (or will prompt)
"""

import os
import sys
from getpass import getpass

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotmac.platform.secrets.vault_client import VaultClient, VaultError


def validate_paystack_key(key: str, key_type: str) -> bool:
    """
    Validate Paystack key format.

    Args:
        key: The API key to validate
        key_type: Either 'secret' or 'public'

    Returns:
        True if valid, False otherwise
    """
    if key_type == "secret":
        return key.startswith(("sk_live_", "sk_test_"))
    elif key_type == "public":
        return key.startswith(("pk_live_", "pk_test_"))
    return False


def main() -> None:
    """Store Paystack secrets in Vault."""
    print("=" * 60)
    print("Paystack Secrets → Vault Storage")
    print("=" * 60)
    print()

    # Get Vault configuration
    vault_url = os.getenv("VAULT_ADDR", "http://localhost:8200")
    vault_token = os.getenv("VAULT_TOKEN")

    if not vault_token:
        print("❌ Error: VAULT_TOKEN environment variable not set")
        print()
        print("Please set your Vault token:")
        print("  export VAULT_TOKEN='your-vault-token'")
        print()
        print("Or for Vault dev mode:")
        print("  vault server -dev")
        print("  export VAULT_TOKEN='<root-token-from-output>'")
        sys.exit(1)

    print(f"📍 Vault Server: {vault_url}")
    print()

    # Get Paystack keys
    secret_key = os.getenv("PAYSTACK_SECRET_KEY")
    public_key = os.getenv("PAYSTACK_PUBLIC_KEY")

    # Prompt for keys if not in environment
    if not secret_key:
        print("🔑 Paystack Secret Key")
        print("   (starts with sk_test_ or sk_live_)")
        secret_key = getpass("   Enter secret key: ").strip()
        print()

    if not public_key:
        print("🔑 Paystack Public Key")
        print("   (starts with pk_test_ or pk_live_)")
        public_key = getpass("   Enter public key: ").strip()
        print()

    # Validate keys
    print("✓ Validating key formats...")

    if not validate_paystack_key(secret_key, "secret"):
        print("❌ Invalid secret key format!")
        print("   Secret key must start with 'sk_test_' or 'sk_live_'")
        sys.exit(1)

    if not validate_paystack_key(public_key, "public"):
        print("❌ Invalid public key format!")
        print("   Public key must start with 'pk_test_' or 'pk_live_'")
        sys.exit(1)

    # Determine environment from key prefix
    is_live = secret_key.startswith("sk_live_")
    environment = "LIVE" if is_live else "TEST"

    print(f"✓ Keys validated ({environment} mode)")
    print()

    # Warn if using live keys
    if is_live:
        print("⚠️  WARNING: You are storing LIVE production keys!")
        print("   Make sure you're connected to the production Vault instance.")
        print()
        confirm = input("   Continue? (yes/no): ").strip().lower()
        if confirm not in ("yes", "y"):
            print("❌ Aborted")
            sys.exit(0)
        print()

    # Connect to Vault
    print("🔗 Connecting to Vault...")
    try:
        vault = VaultClient(
            url=vault_url,
            token=vault_token,
            mount_path="secret",
            kv_version=2,
        )

        # Health check
        if not vault.health_check():
            print("❌ Vault health check failed!")
            print("   Is Vault running and accessible?")
            sys.exit(1)

        print("✓ Connected to Vault")
        print()

    except VaultError as e:
        print(f"❌ Failed to connect to Vault: {e}")
        sys.exit(1)

    # Store secrets
    print("💾 Storing secrets in Vault...")
    print()

    try:
        # Store secret key
        print("   → storing secret key at: billing/paystack/secret_key")
        vault.set_secret("billing/paystack/secret_key", {"value": secret_key})
        print("   ✓ Secret key stored")

        # Store public key
        print("   → storing public key at: billing/paystack/public_key")
        vault.set_secret("billing/paystack/public_key", {"value": public_key})
        print("   ✓ Public key stored")

        print()
        print("=" * 60)
        print("✅ SUCCESS - Paystack secrets stored in Vault")
        print("=" * 60)
        print()

        # Verify secrets
        print("🔍 Verifying secrets...")
        secret_data = vault.get_secret("billing/paystack/secret_key")
        public_data = vault.get_secret("billing/paystack/public_key")

        if secret_data.get("value") == secret_key:
            print(f"   ✓ Secret key verified (starts with {secret_key[:8]}...)")
        else:
            print("   ⚠️  Secret key verification failed")

        if public_data.get("value") == public_key:
            print(f"   ✓ Public key verified (starts with {public_key[:8]}...)")
        else:
            print("   ⚠️  Public key verification failed")

        print()
        print("📋 Next Steps:")
        print()
        print("1. Enable Vault in your application:")
        print("   export VAULT_ENABLED=true")
        print()
        print("2. Set Vault connection details:")
        print(f"   export VAULT_URL={vault_url}")
        print(f"   export VAULT_TOKEN={vault_token[:10]}...")
        print()
        print("3. Start your application (Docker recommended):")
        print("   make dev")
        print("   # For host debugging: make dev-host (ensure observability checks are disabled)")
        print()
        print("4. Verify secrets are loaded:")
        print("   Check application logs for:")
        print("   'Successfully loaded secrets from Vault'")
        print()

    except VaultError as e:
        print(f"❌ Failed to store secrets: {e}")
        sys.exit(1)

    finally:
        vault.close()


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print()
        print("❌ Aborted by user")
        sys.exit(1)
