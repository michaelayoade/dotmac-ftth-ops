#!/usr/bin/env python
"""
Test API endpoints without authentication.
"""

import json

import requests

BASE_URL = "http://localhost:8000"


def test_endpoint(method, path, description, data=None, headers=None):
    """Test an endpoint and print results."""
    url = f"{BASE_URL}{path}"
    print(f"\n{'=' * 60}")
    print(f"Testing: {description}")
    print(f"Method: {method.upper()} {path}")

    try:
        if method == "get":
            response = requests.get(url, headers=headers)
        elif method == "post":
            response = requests.post(url, json=data, headers=headers)
        else:
            response = requests.request(method.upper(), url, json=data, headers=headers)

        print(f"Status: {response.status_code}")

        if response.headers.get("content-type", "").startswith("application/json"):
            print(f"Response: {json.dumps(response.json(), indent=2)}")
        else:
            print(f"Response: {response.text[:200]}")
    except Exception as e:
        print(f"Error: {e}")


def main():
    print("DotMac Platform Services API Testing")
    print("=" * 60)

    # Test public endpoints
    test_endpoint("get", "/health", "Health Check")
    test_endpoint("get", "/ready", "Readiness Check")
    test_endpoint("get", "/api", "API Information")

    # Since auth is not available, let's test endpoints that might work without it
    # or create a mock token for testing

    # Create a mock JWT token (this won't work for real auth but helps test the structure)
    mock_token = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0LXVzZXIiLCJleHAiOjE3MzU5MTEwMDAsInNjb3BlcyI6WyJyZWFkIiwid3JpdGUiXX0.test"
    headers = {"Authorization": mock_token}

    # Test authenticated endpoints with mock token
    test_endpoint("get", "/api/v1/data-transfer/formats", "Data Transfer Formats", headers=headers)
    test_endpoint("get", "/api/v1/secrets/health", "Secrets Health", headers=headers)
    test_endpoint("get", "/api/v1/search/", "Search", headers=headers)

    # Test data transfer with sample data
    export_data = {"data": [{"id": 1, "name": "Test Item"}], "format": "json", "options": {}}
    test_endpoint(
        "post", "/api/v1/data-transfer/export", "Export Data", data=export_data, headers=headers
    )


if __name__ == "__main__":
    main()
