#!/usr/bin/env python3
"""
Demo: Clean Secrets Management vs Confusing Aliases

This demonstrates why the factory pattern with protocols is better
than backward compatibility aliases.
"""


def demonstrate_old_confusing_approach():
    """Show the problems with the alias approach."""
    print("❌ OLD CONFUSING APPROACH (with aliases)")
    print("=" * 50)

    # This was confusing because:
    print("from dotmac.platform import SecretsManager")
    print("manager = SecretsManager()  # What is this really?")
    print("")
    print("Problems:")
    print("1. 🤔 User doesn't know it's actually a VaultClient")
    print("2. 📚 Documentation confusion - two names for same thing")
    print("3. 🔧 Constructor takes Vault-specific params but name suggests generic")
    print("4. 🧪 Type hints lie about what the object actually is")
    print("5. 🚨 Hidden dependency on Vault libraries")


def demonstrate_new_clean_approach():
    """Show the clean factory pattern approach."""
    print("\n✅ NEW CLEAN APPROACH (with factory pattern)")
    print("=" * 50)

    try:
        from dotmac.platform.secrets.factory import (
            SecretsManager,  # Protocol interface
            create_local_secrets_manager,
            create_secrets_manager,
            create_vault_secrets_manager,
        )

        print("🎯 Clear, explicit API:")
        print("from dotmac.platform.secrets.factory import create_secrets_manager")
        print("")

        print("💡 Usage Examples:")
        print("# Auto-select best backend")
        print("manager = create_secrets_manager()")
        print("")
        print("# Explicit Vault backend")
        print("manager = create_secrets_manager('vault', vault_url='...', vault_token='...')")
        print("")
        print("# Local development backend")
        print("manager = create_secrets_manager('local')")
        print("")

        # Test the actual implementations
        print("🧪 Testing Implementations:")
        print("-" * 30)

        # Test local backend (always available)
        local_manager = create_local_secrets_manager()
        print(f"✅ Local manager: {type(local_manager).__name__}")
        print(f"   Protocol check: {isinstance(local_manager, SecretsManager)}")

        # Test auto-selection
        auto_manager = create_secrets_manager()
        print(f"✅ Auto-selected: {type(auto_manager).__name__}")

        # Test explicit backend with clear error
        try:
            vault_manager = create_vault_secrets_manager()
            print(f"✅ Vault manager: {type(vault_manager).__name__}")
        except Exception as e:
            print(f"⚠️  Vault error (expected): {e}")

        print("\n🎯 Benefits:")
        print("1. ✅ Clear intent - you know you're creating a secrets manager")
        print("2. ✅ Explicit backend selection")
        print("3. ✅ Protocol-based interface - consistent API")
        print("4. ✅ Feature flag integration")
        print("5. ✅ Clear error messages with installation instructions")
        print("6. ✅ No hidden dependencies or confusing aliases")

    except ImportError as e:
        print(f"❌ Import error: {e}")


def demonstrate_api_consistency():
    """Show how the protocol ensures API consistency."""
    print("\n🔄 API CONSISTENCY DEMO")
    print("=" * 50)

    try:
        from dotmac.platform.secrets.factory import create_secrets_manager

        # All backends implement the same protocol
        backends_to_test = ["local"]

        for backend in backends_to_test:
            try:
                manager = create_secrets_manager(backend)
                print(f"✅ {backend.title()} Backend:")
                print(f"   Type: {type(manager).__name__}")
                print(f"   Has get_secret: {hasattr(manager, 'get_secret')}")
                print(f"   Has set_secret: {hasattr(manager, 'set_secret')}")
                print(f"   Has health_check: {hasattr(manager, 'health_check')}")
                print(f"   Health: {manager.health_check()}")
                print()
            except Exception as e:
                print(f"❌ {backend} error: {e}")

    except ImportError as e:
        print(f"❌ Import error: {e}")


def main():
    """Run the complete demo."""
    print("🧹 CLEAN API DESIGN vs BACKWARD COMPATIBILITY ALIASES")
    print("=" * 60)

    demonstrate_old_confusing_approach()
    demonstrate_new_clean_approach()
    demonstrate_api_consistency()

    print("\n" + "=" * 60)
    print("📋 SUMMARY")
    print("=" * 60)
    print("❌ Aliases (VaultClient as SecretsManager):")
    print("   - Confusing and misleading")
    print("   - Creates technical debt")
    print("   - Harder to maintain and document")
    print("")
    print("✅ Factory Pattern with Protocols:")
    print("   - Clear, explicit API")
    print("   - Consistent interface across backends")
    print("   - Feature flag integration")
    print("   - Easy to test and maintain")
    print("   - Better user experience")


if __name__ == "__main__":
    main()
