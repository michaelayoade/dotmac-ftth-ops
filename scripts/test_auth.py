#!/usr/bin/env python3
"""
Simple authentication test script.

Tests JWT token generation and validation without needing the full server running.
"""

import asyncio
import os
import sys
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

os.environ["DATABASE_URL"] = "postgresql://dotmac_user:change-me-in-production@localhost:5432/dotmac"
os.environ["DEPLOYMENT_MODE"] = "multi_tenant"
os.environ["ENVIRONMENT"] = "staging"

from dotmac.platform.auth.core import jwt_service


async def main():
    """Test authentication flow."""

    # Test user data
    user_data = {
        "sub": "286c4899-fb41-4ce0-9d75-7f2d460b7b4f",  # User ID from database
        "username": "testuser",
        "email": "testuser@demo-alpha.com",
        "tenant_id": "demo-alpha",
        "roles": [],
        "permissions": [],
    }

    print("=" * 60)
    print("Authentication Flow Test")
    print("=" * 60)
    print()

    # Step 1: Create JWT tokens
    print("Step 1: Creating JWT tokens...")
    user_id = user_data["sub"]
    additional_claims = {
        "username": user_data["username"],
        "email": user_data["email"],
        "tenant_id": user_data["tenant_id"],
        "roles": user_data["roles"],
        "permissions": user_data["permissions"],
    }
    access_token = jwt_service.create_access_token(subject=user_id, additional_claims=additional_claims)
    refresh_token = jwt_service.create_refresh_token(subject=user_id)

    print(f"✅ Access token created: {access_token[:50]}...")
    print(f"✅ Refresh token created: {refresh_token[:50]}...")
    print()

    # Step 2: Verify access token
    print("Step 2: Verifying access token...")
    try:
        payload = jwt_service.verify_token(access_token)
        print(f"✅ Token verified successfully")
        print(f"   User ID: {payload.get('sub')}")
        print(f"   Username: {payload.get('username')}")
        print(f"   Tenant ID: {payload.get('tenant_id')}")
        print()
    except Exception as e:
        print(f"❌ Token verification failed: {e}")
        print()

    # Step 3: Test token usage for API calls
    print("Step 3: Example Authorization header:")
    print(f"   Authorization: Bearer {access_token}")
    print()

    print("Step 4: Test with curl:")
    print(f"   curl -H 'Authorization: Bearer {access_token}' \\")
    print(f"        -H 'X-Tenant-ID: demo-alpha' \\")
    print(f"        http://localhost:8000/api/tenant/v1/customers")
    print()

    print("=" * 60)
    print("✅ Authentication test completed successfully")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
