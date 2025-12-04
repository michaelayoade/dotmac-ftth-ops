#!/usr/bin/env python3
"""
Demonstration of the new feature flag-based dependency management system.

This script shows how to:
1. Check available vs enabled features
2. Get clear error messages for missing dependencies
3. Use factory patterns for creating backends
4. Enable features via environment variables

Run with different feature flags to see different behaviors:

    # Default (minimal features)
    python examples/dependency_management_demo.py

    # Enable search
    FEATURES__SEARCH_MEILISEARCH_ENABLED=true python examples/dependency_management_demo.py

    # Enable storage
    FEATURES__STORAGE_ENABLED=true python examples/dependency_management_demo.py

    # Enable everything
    FEATURES__SEARCH_MEILISEARCH_ENABLED=true FEATURES__STORAGE_ENABLED=true \
    FEATURES__TRACING_OPENTELEMETRY=true python examples/dependency_management_demo.py
"""

import os

from dotmac.platform.dependencies import DependencyChecker
from dotmac.platform.settings import settings


def demonstrate_dependency_checking():
    """Show dependency checking and clear error messages."""
    print("=" * 60)
    print("🔍 DEPENDENCY CHECKING DEMO")
    print("=" * 60)

    print("\n📋 Current Feature Flag Status:")
    print("-" * 40)

    # Check core features that are typically enabled
    core_features = ["encryption_fernet", "db_postgresql", "db_sqlite"]

    for feature in core_features:
        enabled = getattr(settings.features, feature, False)
        available = DependencyChecker.check_feature_dependency(feature)
        status = "✅" if enabled and available else "❌"
        print(f"{status} {feature}: enabled={enabled}, deps_available={available}")

    # Check optional features
    optional_features = [
        "search_meilisearch_enabled",
        "storage_enabled",
        "tracing_opentelemetry",
        "graphql_enabled",
    ]

    print("\n🔧 Optional Features:")
    print("-" * 40)

    for feature in optional_features:
        enabled = getattr(settings.features, feature, False)
        if enabled:
            available = DependencyChecker.check_feature_dependency(feature)
            status = "✅" if available else "⚠️"
        else:
            status = "⭕"
            available = "N/A (disabled)"

        print(f"{status} {feature}: enabled={enabled}, deps_available={available}")


def demonstrate_storage_backends():
    """Show storage backend factory usage."""
    print("\n" + "=" * 60)
    print("🗄️  STORAGE BACKEND DEMO")
    print("=" * 60)

    try:
        from dotmac.platform.file_storage.factory import StorageBackendFactory

        available = StorageBackendFactory.list_available_providers()
        enabled = StorageBackendFactory.list_enabled_providers()

        print(f"\n📦 Available providers: {available}")
        print(f"✅ Enabled providers: {enabled}")

        # Always try local (should work)
        print("\n🔄 Creating local storage backend...")
        local_backend = StorageBackendFactory.create_backend("local")
        print(f"✅ Success: {type(local_backend).__name__}")

        # Try MinIO if enabled
        if settings.features.storage_enabled:
            print("\n🔄 Creating MinIO storage backend...")
            try:
                minio_backend = StorageBackendFactory.create_backend("minio")
                print(f"✅ Success: {type(minio_backend).__name__}")
            except Exception as e:
                print(f"❌ Failed: {e}")
        else:
            print("\n⭕ MinIO storage disabled (set FEATURES__STORAGE_ENABLED=true to enable)")

    except Exception as e:
        print(f"❌ Storage factory error: {e}")


def demonstrate_search_backends():
    """Show search backend factory usage."""
    print("\n" + "=" * 60)
    print("🔍 SEARCH BACKEND DEMO")
    print("=" * 60)

    try:
        from dotmac.platform.search.factory import SearchBackendFactory

        available = SearchBackendFactory.list_available_backends()
        enabled = SearchBackendFactory.list_enabled_backends()

        print(f"\n📦 Available backends: {available}")
        print(f"✅ Enabled backends: {enabled}")

        # Always try memory (should work)
        print("\n🔄 Creating in-memory search backend...")
        memory_backend = SearchBackendFactory.create_backend("memory")
        print(f"✅ Success: {type(memory_backend).__name__}")

        # Try MeiliSearch if enabled
        if settings.features.search_meilisearch_enabled:
            print("\n🔄 Creating MeiliSearch backend...")
            try:
                meilisearch_backend = SearchBackendFactory.create_backend("meilisearch")
                print(f"✅ Success: {type(meilisearch_backend).__name__}")
            except Exception as e:
                print(f"❌ Failed: {e}")
        else:
            print(
                "\n⭕ MeiliSearch disabled (set FEATURES__SEARCH_MEILISEARCH_ENABLED=true to enable)"
            )

    except Exception as e:
        print(f"❌ Search factory error: {e}")


def demonstrate_error_messages():
    """Show helpful error messages for missing dependencies."""
    print("\n" + "=" * 60)
    print("💥 ERROR MESSAGE DEMO")
    print("=" * 60)

    # Try to require disabled features to show error messages
    print("\n🧪 Testing error messages for disabled features...")

    # Test MeiliSearch (unless enabled)
    if not settings.features.search_meilisearch_enabled:
        print("\n🔄 Trying to require MeiliSearch when disabled...")
        try:
            from dotmac.platform.dependencies import require_meilisearch

            require_meilisearch()
        except Exception as e:
            print(f"❌ Expected error: {e}")

    # Test MinIO (unless enabled)
    if not settings.features.storage_enabled:
        print("\n🔄 Trying to require MinIO when disabled...")
        try:
            from dotmac.platform.dependencies import require_minio

            require_minio()
        except Exception as e:
            print(f"❌ Expected error: {e}")


def main():
    """Run the complete demo."""
    print("🚀 DotMac Platform Services - Dependency Management Demo")
    print(f"Python path: {os.path.dirname(__file__)}")

    # Show environment variables being used
    relevant_env_vars = [k for k in os.environ.keys() if k.startswith("FEATURES__")]
    if relevant_env_vars:
        print("\n🌍 Environment variables:")
        for var in relevant_env_vars:
            print(f"   {var}={os.environ[var]}")
    else:
        print("\n🌍 No FEATURES__ environment variables set (using defaults)")

    demonstrate_dependency_checking()
    demonstrate_storage_backends()
    demonstrate_search_backends()
    demonstrate_error_messages()

    print("\n" + "=" * 60)
    print("✨ Demo completed!")
    print("💡 Try setting different FEATURES__* environment variables to see different behaviors")
    print("📚 See dotmac/platform/dependencies.py for available feature flags")
    print("=" * 60)


if __name__ == "__main__":
    main()
