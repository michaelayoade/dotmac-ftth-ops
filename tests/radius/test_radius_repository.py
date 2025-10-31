
"""
Tests for RADIUS Repository Layer

Tests database operations for RADIUS entities.
"""

import pytest

from dotmac.platform.radius.repository import RADIUSRepository







pytestmark = pytest.mark.integration

@pytest.mark.asyncio
class TestRADIUSRepository:
    """Test RADIUS repository operations"""

    async def test_create_radcheck(self, async_db_session, test_tenant):
        """Test creating RADIUS check entry"""
        repo = RADIUSRepository(async_db_session)

        radcheck = await repo.create_radcheck(
            tenant_id=test_tenant.id,
            subscriber_id="sub-001",
            username="testuser@isp",
            password="securepass123",
        )

        assert radcheck.id is not None
        assert radcheck.tenant_id == test_tenant.id
        assert radcheck.subscriber_id == "sub-001"
        assert radcheck.username == "testuser@isp"
        assert radcheck.attribute == "Cleartext-Password"
        assert radcheck.op == ":="
        # Password is now bcrypt-hashed, verify it's a valid bcrypt hash
        assert radcheck.value.startswith("bcrypt:$2b$")
        # Verify we can validate the password
        from dotmac.platform.auth.core import pwd_context
        stored_hash = radcheck.value.replace("bcrypt:", "")
        assert pwd_context.verify("securepass123", stored_hash)

    async def test_get_radcheck_by_username(self, async_db_session, test_tenant):
        """Test retrieving radcheck by username"""
        repo = RADIUSRepository(async_db_session)

        # Create entry
        await repo.create_radcheck(
            tenant_id=test_tenant.id,
            subscriber_id="sub-001",
            username="testuser@isp",
            password="securepass123",
        )

        # Retrieve
        radcheck = await repo.get_radcheck_by_username(test_tenant.id, "testuser@isp")

        assert radcheck is not None
        assert radcheck.username == "testuser@isp"
        # Verify password is bcrypt-hashed
        assert radcheck.value.startswith("bcrypt:$2b$")
        from dotmac.platform.auth.core import pwd_context
        stored_hash = radcheck.value.replace("bcrypt:", "")
        assert pwd_context.verify("securepass123", stored_hash)

    async def test_get_radcheck_by_subscriber(self, async_db_session, test_tenant):
        """Test retrieving radcheck by subscriber ID"""
        repo = RADIUSRepository(async_db_session)

        # Create entry
        await repo.create_radcheck(
            tenant_id=test_tenant.id,
            subscriber_id="sub-001",
            username="testuser@isp",
            password="securepass123",
        )

        # Retrieve
        radcheck = await repo.get_radcheck_by_subscriber(test_tenant.id, "sub-001")

        assert radcheck is not None
        assert radcheck.subscriber_id == "sub-001"
        assert radcheck.username == "testuser@isp"

    async def test_update_radcheck_password(self, async_db_session, test_tenant):
        """Test updating RADIUS password"""
        repo = RADIUSRepository(async_db_session)

        # Create entry
        await repo.create_radcheck(
            tenant_id=test_tenant.id,
            subscriber_id="sub-001",
            username="testuser@isp",
            password="oldpassword",
        )

        # Update password
        updated = await repo.update_radcheck_password(
            test_tenant.id, "testuser@isp", "newpassword123"
        )

        assert updated is not None
        # Verify new password is bcrypt-hashed
        assert updated.value.startswith("bcrypt:$2b$")
        from dotmac.platform.auth.core import pwd_context
        stored_hash = updated.value.replace("bcrypt:", "")
        assert pwd_context.verify("newpassword123", stored_hash)

    async def test_delete_radcheck(self, async_db_session, test_tenant):
        """Test deleting radcheck entry"""
        repo = RADIUSRepository(async_db_session)

        # Create entry
        await repo.create_radcheck(
            tenant_id=test_tenant.id,
            subscriber_id="sub-001",
            username="testuser@isp",
            password="securepass123",
        )

        # Delete
        deleted = await repo.delete_radcheck(test_tenant.id, "testuser@isp")
        assert deleted is True

        # Verify deleted
        radcheck = await repo.get_radcheck_by_username(test_tenant.id, "testuser@isp")
        assert radcheck is None

    async def test_list_radchecks(self, async_db_session, test_tenant):
        """Test listing radcheck entries"""
        repo = RADIUSRepository(async_db_session)

        # Create multiple entries
        for i in range(5):
            await repo.create_radcheck(
                tenant_id=test_tenant.id,
                subscriber_id=f"sub-{i:03d}",
                username=f"user{i}@isp",
                password=f"pass{i}",
            )

        # List with pagination
        radchecks = await repo.list_radchecks(test_tenant.id, skip=0, limit=3)
        assert len(radchecks) == 3

    async def test_create_radreply(self, async_db_session, test_tenant):
        """Test creating RADIUS reply entry"""
        repo = RADIUSRepository(async_db_session)

        radreply = await repo.create_radreply(
            tenant_id=test_tenant.id,
            subscriber_id="sub-001",
            username="testuser@isp",
            attribute="Framed-IP-Address",
            value="10.0.0.100",
            op="=",
        )

        assert radreply.id is not None
        assert radreply.username == "testuser@isp"
        assert radreply.attribute == "Framed-IP-Address"
        assert radreply.value == "10.0.0.100"

    async def test_get_radreplies_by_username(self, async_db_session, test_tenant):
        """Test retrieving all reply attributes for username"""
        repo = RADIUSRepository(async_db_session)

        # Create multiple attributes
        await repo.create_radreply(
            test_tenant.id, "sub-001", "testuser@isp", "Framed-IP-Address", "10.0.0.100"
        )
        await repo.create_radreply(
            test_tenant.id, "sub-001", "testuser@isp", "Session-Timeout", "3600"
        )

        # Retrieve all
        radreplies = await repo.get_radreplies_by_username(test_tenant.id, "testuser@isp")

        assert len(radreplies) == 2
        attributes = {r.attribute for r in radreplies}
        assert "Framed-IP-Address" in attributes
        assert "Session-Timeout" in attributes

    async def test_delete_radreply(self, async_db_session, test_tenant):
        """Test deleting specific reply attribute"""
        repo = RADIUSRepository(async_db_session)

        # Create attribute
        await repo.create_radreply(
            test_tenant.id, "sub-001", "testuser@isp", "Framed-IP-Address", "10.0.0.100"
        )

        # Delete
        deleted = await repo.delete_radreply(test_tenant.id, "testuser@isp", "Framed-IP-Address")
        assert deleted == 1  # Returns number of rows deleted

    async def test_delete_all_radreplies(self, async_db_session, test_tenant):
        """Test deleting all reply attributes for username"""
        repo = RADIUSRepository(async_db_session)

        # Create multiple attributes
        await repo.create_radreply(
            test_tenant.id, "sub-001", "testuser@isp", "Framed-IP-Address", "10.0.0.100"
        )
        await repo.create_radreply(
            test_tenant.id, "sub-001", "testuser@isp", "Session-Timeout", "3600"
        )

        # Delete all
        count = await repo.delete_all_radreplies(test_tenant.id, "testuser@isp")
        assert count == 2

        # Verify deleted
        radreplies = await repo.get_radreplies_by_username(test_tenant.id, "testuser@isp")
        assert len(radreplies) == 0

    async def test_create_nas(self, async_db_session, test_tenant):
        """Test creating NAS device"""
        repo = RADIUSRepository(async_db_session)

        nas = await repo.create_nas(
            tenant_id=test_tenant.id,
            nasname="192.168.1.1",
            shortname="router01",
            type="mikrotik",
            secret="sharedsecret123",
            ports=1024,
            description="Main Router",
        )

        assert nas.id is not None
        assert nas.nasname == "192.168.1.1"
        assert nas.shortname == "router01"
        assert nas.type == "mikrotik"
        assert nas.secret == "sharedsecret123"

    async def test_get_nas_by_id(self, async_db_session, test_tenant):
        """Test retrieving NAS by ID"""
        repo = RADIUSRepository(async_db_session)

        # Create NAS
        created = await repo.create_nas(
            test_tenant.id, "192.168.1.1", "router01", "mikrotik", "secret"
        )

        # Retrieve
        nas = await repo.get_nas_by_id(test_tenant.id, created.id)
        assert nas is not None
        assert nas.id == created.id

    async def test_get_nas_by_name(self, async_db_session, test_tenant):
        """Test retrieving NAS by name"""
        repo = RADIUSRepository(async_db_session)

        # Create NAS
        await repo.create_nas(test_tenant.id, "192.168.1.1", "router01", "mikrotik", "secret")

        # Retrieve
        nas = await repo.get_nas_by_name(test_tenant.id, "192.168.1.1")
        assert nas is not None
        assert nas.nasname == "192.168.1.1"

    async def test_create_bandwidth_profile(self, async_db_session, test_tenant):
        """Test creating bandwidth profile"""
        repo = RADIUSRepository(async_db_session)

        profile = await repo.create_bandwidth_profile(
            tenant_id=test_tenant.id,
            profile_id="profile-10mbps",
            name="10 Mbps Plan",
            download_rate_kbps=10000,
            upload_rate_kbps=2000,
            description="Standard 10 Mbps plan",
        )

        assert profile.id == "profile-10mbps"
        assert profile.name == "10 Mbps Plan"
        assert profile.download_rate_kbps == 10000
        assert profile.upload_rate_kbps == 2000

    async def test_get_bandwidth_profile(self, async_db_session, test_tenant):
        """Test retrieving bandwidth profile"""
        repo = RADIUSRepository(async_db_session)

        # Create profile
        await repo.create_bandwidth_profile(
            test_tenant.id, "profile-10mbps", "10 Mbps", 10000, 2000
        )

        # Retrieve
        profile = await repo.get_bandwidth_profile(test_tenant.id, "profile-10mbps")
        assert profile is not None
        assert profile.id == "profile-10mbps"

    async def test_tenant_isolation_radcheck(self, async_db_session, test_tenant, test_tenant_2):
        """Test that radcheck entries are tenant-isolated"""
        repo = RADIUSRepository(async_db_session)

        # Create entry for tenant 1
        await repo.create_radcheck(test_tenant.id, "sub-001", "user1@isp", "password1")

        # Try to retrieve from tenant 2
        radcheck = await repo.get_radcheck_by_username(test_tenant_2.id, "user1@isp")
        assert radcheck is None

    async def test_tenant_isolation_nas(self, async_db_session, test_tenant, test_tenant_2):
        """Test that NAS devices are tenant-isolated"""
        repo = RADIUSRepository(async_db_session)

        # Create NAS for tenant 1
        nas1 = await repo.create_nas(
            test_tenant.id, "192.168.1.1", "router01", "mikrotik", "secret"
        )

        # Try to retrieve from tenant 2
        nas = await repo.get_nas_by_id(test_tenant_2.id, nas1.id)
        assert nas is None

    async def test_list_nas_devices(self, async_db_session, test_tenant):
        """Test listing NAS devices with pagination"""
        repo = RADIUSRepository(async_db_session)

        # Create multiple NAS devices
        for i in range(5):
            await repo.create_nas(
                test_tenant.id, f"192.168.1.{i + 1}", f"router{i:02d}", "mikrotik", "secret"
            )

        # List with pagination
        nas_devices = await repo.list_nas_devices(test_tenant.id, skip=0, limit=3)
        assert len(nas_devices) == 3

    async def test_update_nas(self, async_db_session, test_tenant):
        """Test updating NAS device"""
        repo = RADIUSRepository(async_db_session)

        # Create NAS
        nas = await repo.create_nas(
            test_tenant.id, "192.168.1.1", "router01", "mikrotik", "oldsecret"
        )

        # Update
        updated = await repo.update_nas(nas, secret="newsecret", description="Updated router")
        assert updated.secret == "newsecret"
        assert updated.description == "Updated router"

    async def test_delete_nas(self, async_db_session, test_tenant):
        """Test deleting NAS device"""
        repo = RADIUSRepository(async_db_session)

        # Create NAS
        nas = await repo.create_nas(test_tenant.id, "192.168.1.1", "router01", "mikrotik", "secret")

        # Delete
        deleted = await repo.delete_nas(test_tenant.id, nas.id)
        assert deleted is True

        # Verify deleted
        nas_check = await repo.get_nas_by_id(test_tenant.id, nas.id)
        assert nas_check is None

    async def test_list_bandwidth_profiles(self, async_db_session, test_tenant):
        """Test listing bandwidth profiles"""
        repo = RADIUSRepository(async_db_session)

        # Create multiple profiles
        for i in range(3):
            await repo.create_bandwidth_profile(
                test_tenant.id,
                f"profile-{i}mbps",
                f"{i} Mbps Plan",
                i * 1000,
                i * 500,
            )

        # List
        profiles = await repo.list_bandwidth_profiles(test_tenant.id)
        assert len(profiles) >= 3

    async def test_update_bandwidth_profile(self, async_db_session, test_tenant):
        """Test updating bandwidth profile"""
        repo = RADIUSRepository(async_db_session)

        # Create profile
        profile = await repo.create_bandwidth_profile(
            test_tenant.id, "profile-10mbps", "10 Mbps", 10000, 2000
        )

        # Update
        updated = await repo.update_bandwidth_profile(
            profile, download_rate_kbps=20000, name="20 Mbps Plan"
        )
        assert updated.download_rate_kbps == 20000
        assert updated.name == "20 Mbps Plan"

    async def test_delete_bandwidth_profile(self, async_db_session, test_tenant):
        """Test deleting bandwidth profile"""
        repo = RADIUSRepository(async_db_session)

        # Create profile
        await repo.create_bandwidth_profile(
            test_tenant.id, "profile-10mbps", "10 Mbps", 10000, 2000
        )

        # Delete
        deleted = await repo.delete_bandwidth_profile(test_tenant.id, "profile-10mbps")
        assert deleted is True

        # Verify deleted
        profile = await repo.get_bandwidth_profile(test_tenant.id, "profile-10mbps")
        assert profile is None
