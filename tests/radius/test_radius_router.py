"""
Tests for RADIUS API Router

Tests FastAPI endpoints for RADIUS management.
"""


import pytest
from fastapi import status


@pytest.mark.asyncio
class TestRADIUSRouter:
    """Test RADIUS API endpoints"""

    async def test_create_subscriber(self, async_client, test_user, test_tenant, auth_headers):
        """Test POST /api/v1/radius/subscribers"""
        payload = {
            "subscriber_id": "sub-001",
            "username": "testuser@isp",
            "password": "SecurePass123!",
        }

        response = await async_client.post(
            "/api/v1/radius/subscribers", json=payload, headers=auth_headers
        )

        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()
        assert data["username"] == "testuser@isp"
        assert data["subscriber_id"] == "sub-001"
        assert data["tenant_id"] == test_tenant.id

    async def test_create_subscriber_with_bandwidth_profile(
        self, async_client, test_user, test_tenant, auth_headers
    ):
        """Test creating subscriber with bandwidth profile"""
        # First create bandwidth profile
        profile_payload = {
            "name": "10 Mbps Plan",
            "download_rate_kbps": 10000,
            "upload_rate_kbps": 2000,
        }

        profile_response = await async_client.post(
            "/api/v1/radius/bandwidth-profiles",
            json=profile_payload,
            headers=auth_headers,
        )
        assert profile_response.status_code == status.HTTP_201_CREATED
        profile_id = profile_response.json()["id"]

        # Create subscriber with profile
        subscriber_payload = {
            "subscriber_id": "sub-001",
            "username": "testuser@isp",
            "password": "SecurePass123!",
            "bandwidth_profile_id": profile_id,
        }

        response = await async_client.post(
            "/api/v1/radius/subscribers",
            json=subscriber_payload,
            headers=auth_headers,
        )

        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()
        assert data["bandwidth_profile_id"] == profile_id

    async def test_get_subscriber(self, async_client, test_user, test_tenant, auth_headers):
        """Test GET /api/v1/radius/subscribers/{username}"""
        # Create subscriber
        payload = {
            "subscriber_id": "sub-001",
            "username": "testuser@isp",
            "password": "SecurePass123!",
        }
        await async_client.post("/api/v1/radius/subscribers", json=payload, headers=auth_headers)

        # Get subscriber
        response = await async_client.get(
            "/api/v1/radius/subscribers/testuser@isp", headers=auth_headers
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["username"] == "testuser@isp"

    async def test_get_nonexistent_subscriber(self, async_client, test_user, auth_headers):
        """Test getting nonexistent subscriber returns 404"""
        response = await async_client.get(
            "/api/v1/radius/subscribers/nonexistent@isp", headers=auth_headers
        )

        assert response.status_code == status.HTTP_404_NOT_FOUND

    async def test_list_subscribers(self, async_client, test_user, test_tenant, auth_headers):
        """Test GET /api/v1/radius/subscribers"""
        # Create multiple subscribers
        for i in range(5):
            payload = {
                "subscriber_id": f"sub-{i:03d}",
                "username": f"user{i}@isp",
                "password": f"Pass{i}123!",
            }
            await async_client.post(
                "/api/v1/radius/subscribers", json=payload, headers=auth_headers
            )

        # List subscribers
        response = await async_client.get(
            "/api/v1/radius/subscribers?skip=0&limit=3", headers=auth_headers
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) == 3

    async def test_update_subscriber(self, async_client, test_user, test_tenant, auth_headers):
        """Test PATCH /api/v1/radius/subscribers/{username}"""
        # Create subscriber
        payload = {
            "subscriber_id": "sub-001",
            "username": "testuser@isp",
            "password": "OldPass123!",
        }
        await async_client.post("/api/v1/radius/subscribers", json=payload, headers=auth_headers)

        # Update password
        update_payload = {"password": "NewPass456!"}
        response = await async_client.patch(
            "/api/v1/radius/subscribers/testuser@isp",
            json=update_payload,
            headers=auth_headers,
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["username"] == "testuser@isp"

    async def test_delete_subscriber(self, async_client, test_user, test_tenant, auth_headers):
        """Test DELETE /api/v1/radius/subscribers/{username}"""
        # Create subscriber
        payload = {
            "subscriber_id": "sub-001",
            "username": "testuser@isp",
            "password": "SecurePass123!",
        }
        await async_client.post("/api/v1/radius/subscribers", json=payload, headers=auth_headers)

        # Delete subscriber
        response = await async_client.delete(
            "/api/v1/radius/subscribers/testuser@isp", headers=auth_headers
        )

        assert response.status_code == status.HTTP_204_NO_CONTENT

        # Verify deleted
        get_response = await async_client.get(
            "/api/v1/radius/subscribers/testuser@isp", headers=auth_headers
        )
        assert get_response.status_code == status.HTTP_404_NOT_FOUND

    async def test_enable_subscriber(self, async_client, test_user, test_tenant, auth_headers):
        """Test POST /api/v1/radius/subscribers/{username}/enable"""
        # Create subscriber
        payload = {
            "subscriber_id": "sub-001",
            "username": "testuser@isp",
            "password": "SecurePass123!",
        }
        await async_client.post("/api/v1/radius/subscribers", json=payload, headers=auth_headers)

        # Disable first
        await async_client.post(
            "/api/v1/radius/subscribers/testuser@isp/disable", headers=auth_headers
        )

        # Enable
        response = await async_client.post(
            "/api/v1/radius/subscribers/testuser@isp/enable", headers=auth_headers
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["enabled"] is True

    async def test_disable_subscriber(self, async_client, test_user, test_tenant, auth_headers):
        """Test POST /api/v1/radius/subscribers/{username}/disable"""
        # Create subscriber
        payload = {
            "subscriber_id": "sub-001",
            "username": "testuser@isp",
            "password": "SecurePass123!",
        }
        await async_client.post("/api/v1/radius/subscribers", json=payload, headers=auth_headers)

        # Disable
        response = await async_client.post(
            "/api/v1/radius/subscribers/testuser@isp/disable", headers=auth_headers
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["enabled"] is False

    async def test_create_nas(self, async_client, test_user, auth_headers):
        """Test POST /api/v1/radius/nas"""
        payload = {
            "nasname": "192.168.1.1",
            "shortname": "router01",
            "type": "mikrotik",
            "secret": "SharedSecret123!",
            "ports": 1024,
            "description": "Main Router",
        }

        response = await async_client.post("/api/v1/radius/nas", json=payload, headers=auth_headers)

        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()
        assert data["nasname"] == "192.168.1.1"
        assert data["shortname"] == "router01"

    async def test_get_nas(self, async_client, test_user, auth_headers):
        """Test GET /api/v1/radius/nas/{nas_id}"""
        # Create NAS
        payload = {
            "nasname": "192.168.1.1",
            "shortname": "router01",
            "type": "mikrotik",
            "secret": "SharedSecret123!",
        }
        create_response = await async_client.post(
            "/api/v1/radius/nas", json=payload, headers=auth_headers
        )
        nas_id = create_response.json()["id"]

        # Get NAS
        response = await async_client.get(f"/api/v1/radius/nas/{nas_id}", headers=auth_headers)

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["id"] == nas_id

    async def test_list_nas_devices(self, async_client, test_user, auth_headers):
        """Test GET /api/v1/radius/nas"""
        # Create multiple NAS devices
        for i in range(3):
            payload = {
                "nasname": f"192.168.1.{i+1}",
                "shortname": f"router{i+1:02d}",
                "type": "mikrotik",
                "secret": f"Secret{i}123!",
            }
            await async_client.post("/api/v1/radius/nas", json=payload, headers=auth_headers)

        # List NAS devices
        response = await async_client.get("/api/v1/radius/nas", headers=auth_headers)

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) >= 3

    async def test_create_bandwidth_profile(self, async_client, test_user, auth_headers):
        """Test POST /api/v1/radius/bandwidth-profiles"""
        payload = {
            "name": "10 Mbps Plan",
            "download_rate_kbps": 10000,
            "upload_rate_kbps": 2000,
            "download_burst_kbps": 15000,
            "upload_burst_kbps": 3000,
            "description": "Standard 10 Mbps plan",
        }

        response = await async_client.post(
            "/api/v1/radius/bandwidth-profiles", json=payload, headers=auth_headers
        )

        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()
        assert data["name"] == "10 Mbps Plan"
        assert data["download_rate_kbps"] == 10000

    async def test_get_bandwidth_profile(self, async_client, test_user, auth_headers):
        """Test GET /api/v1/radius/bandwidth-profiles/{profile_id}"""
        # Create profile
        payload = {
            "name": "10 Mbps Plan",
            "download_rate_kbps": 10000,
            "upload_rate_kbps": 2000,
        }
        create_response = await async_client.post(
            "/api/v1/radius/bandwidth-profiles", json=payload, headers=auth_headers
        )
        profile_id = create_response.json()["id"]

        # Get profile
        response = await async_client.get(
            f"/api/v1/radius/bandwidth-profiles/{profile_id}", headers=auth_headers
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["id"] == profile_id

    async def test_list_bandwidth_profiles(self, async_client, test_user, auth_headers):
        """Test GET /api/v1/radius/bandwidth-profiles"""
        # Create multiple profiles
        for i in range(3):
            payload = {
                "name": f"{(i+1)*10} Mbps Plan",
                "download_rate_kbps": (i + 1) * 10000,
                "upload_rate_kbps": (i + 1) * 2000,
            }
            await async_client.post(
                "/api/v1/radius/bandwidth-profiles", json=payload, headers=auth_headers
            )

        # List profiles
        response = await async_client.get("/api/v1/radius/bandwidth-profiles", headers=auth_headers)

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) >= 3

    async def test_test_authentication(self, async_client, test_user, auth_headers):
        """Test POST /api/v1/radius/test/auth"""
        # Create subscriber
        subscriber_payload = {
            "subscriber_id": "sub-001",
            "username": "testuser@isp",
            "password": "SecurePass123!",
        }
        await async_client.post(
            "/api/v1/radius/subscribers",
            json=subscriber_payload,
            headers=auth_headers,
        )

        # Test auth with correct password
        test_payload = {"username": "testuser@isp", "password": "SecurePass123!"}
        response = await async_client.post(
            "/api/v1/radius/test/auth", json=test_payload, headers=auth_headers
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["success"] is True

    async def test_test_authentication_wrong_password(self, async_client, test_user, auth_headers):
        """Test authentication with wrong password"""
        # Create subscriber
        subscriber_payload = {
            "subscriber_id": "sub-001",
            "username": "testuser@isp",
            "password": "SecurePass123!",
        }
        await async_client.post(
            "/api/v1/radius/subscribers",
            json=subscriber_payload,
            headers=auth_headers,
        )

        # Test auth with wrong password
        test_payload = {"username": "testuser@isp", "password": "WrongPassword!"}
        response = await async_client.post(
            "/api/v1/radius/test/auth", json=test_payload, headers=auth_headers
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["success"] is False

    async def test_unauthorized_access(self, async_client):
        """Test that endpoints require authentication"""
        response = await async_client.get("/api/v1/radius/subscribers")

        assert response.status_code == status.HTTP_401_UNAUTHORIZED
