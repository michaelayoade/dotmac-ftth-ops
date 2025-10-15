#!/usr/bin/env python
"""
Detailed API endpoint testing for DotMac Platform Services.
"""

import json
import os
import tempfile

import requests

BASE_URL = "http://localhost:8000"


def print_response(response, description):
    """Pretty print API response."""
    print(f"\n{'=' * 60}")
    print(f"📍 {description}")
    print(f"🔗 {response.request.method} {response.url}")
    print(f"📊 Status: {response.status_code}")

    if response.headers.get("content-type", "").startswith("application/json"):
        try:
            data = response.json()
            print("📦 Response:")
            print(json.dumps(data, indent=2))
        except:
            print(f"📦 Response: {response.text[:200]}")
    else:
        print(f"📦 Response: {response.text[:200]}")
    print("=" * 60)


def test_public_endpoints():
    """Test all public endpoints."""
    print("\n🔓 TESTING PUBLIC ENDPOINTS")

    # Health check
    response = requests.get(f"{BASE_URL}/health")
    print_response(response, "Health Check")

    # Readiness
    response = requests.get(f"{BASE_URL}/ready")
    print_response(response, "Readiness Check")

    # API info
    response = requests.get(f"{BASE_URL}/api")
    print_response(response, "API Information")


def test_data_transfer():
    """Test data transfer endpoints without auth."""
    print("\n📤 TESTING DATA TRANSFER ENDPOINTS")

    # Get supported formats
    response = requests.get(f"{BASE_URL}/api/v1/data-transfer/formats")
    print_response(response, "Data Transfer Formats")

    # Test export with CSV data
    export_request = {
        "data": [
            {"id": 1, "name": "Product A", "price": 19.99},
            {"id": 2, "name": "Product B", "price": 29.99},
        ],
        "format": "csv",
    }

    response = requests.post(
        f"{BASE_URL}/api/v1/data-transfer/export", json={"request": export_request}
    )
    print_response(response, "Export to CSV")

    # Test import
    csv_content = "id,name,price\n1,Product A,19.99\n2,Product B,29.99"

    # Create temporary file
    with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False) as f:
        f.write(csv_content)
        temp_file = f.name

    try:
        import_request = {"file_path": temp_file, "format": "csv"}

        response = requests.post(
            f"{BASE_URL}/api/v1/data-transfer/import", json={"request": import_request}
        )
        print_response(response, "Import from CSV")
    finally:
        os.unlink(temp_file)

    # List jobs
    response = requests.get(f"{BASE_URL}/api/v1/data-transfer/jobs")
    print_response(response, "List Transfer Jobs")


def test_search():
    """Test search endpoints."""
    print("\n🔍 TESTING SEARCH ENDPOINTS")

    # Index content
    index_request = {
        "content_id": "doc-1",
        "content": "This is a sample document for testing search functionality.",
        "metadata": {"type": "document", "author": "test"},
    }

    response = requests.post(f"{BASE_URL}/api/v1/search/index", json=index_request)
    print_response(response, "Index Document")

    # Search
    search_params = {"q": "sample document"}

    response = requests.get(f"{BASE_URL}/api/v1/search/", params=search_params)
    print_response(response, "Search Documents")


def test_secrets():
    """Test secrets management endpoints."""
    print("\n🔐 TESTING SECRETS ENDPOINTS")

    # Health check
    response = requests.get(f"{BASE_URL}/api/v1/secrets/health")
    print_response(response, "Secrets Health Check")

    # Try to store a secret (will fail without Vault)
    secret_data = {
        "path": "test/my-secret",
        "data": {"api_key": "test-key-123", "api_secret": "test-secret-456"},
    }

    response = requests.post(f"{BASE_URL}/api/v1/secrets/secrets", json=secret_data)
    print_response(response, "Store Secret")


def test_users():
    """Test user management endpoints."""
    print("\n👥 TESTING USER MANAGEMENT ENDPOINTS")

    # Get current user (requires auth)
    response = requests.get(f"{BASE_URL}/api/v1/users/me")
    print_response(response, "Get Current User Profile")

    # List users (requires admin)
    response = requests.get(f"{BASE_URL}/api/v1/users")
    print_response(response, "List All Users")


def main():
    """Run all tests."""
    print("🚀 DotMac Platform Services - Comprehensive API Testing")
    print("=" * 60)

    test_public_endpoints()
    test_data_transfer()
    test_search()
    test_secrets()
    test_users()

    print("\n✅ Testing complete!")


if __name__ == "__main__":
    main()
