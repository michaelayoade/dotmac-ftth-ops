"""
Phase 3: RADIUS Option 82 & VLAN Enforcement Tests

Tests for:
- Option 82 parsing (circuit-id, remote-id)
- Option 82 validation with policies (ENFORCE, LOG, IGNORE)
- RADIUS authorization endpoint
- QinQ VLAN support
"""

import uuid

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.network.models import (
    IPv6AssignmentMode,
    Option82Policy,
    SubscriberNetworkProfile,
)
from dotmac.platform.radius.schemas import (
    RADIUSAuthorizationRequest,
    RADIUSSubscriberCreate,
)
from dotmac.platform.radius.service import RADIUSService

pytestmark = pytest.mark.asyncio


class TestOption82Parsing:
    """Test DHCP Option 82 parsing from RADIUS Access-Request"""

    def test_parse_option82_standard_attributes(self):
        """Test parsing standard Option 82 attributes"""
        access_request = {
            "Agent-Circuit-Id": "OLT1/1/1/1:1",
            "Agent-Remote-Id": "ALCL12345678",
        }

        result = RADIUSService.parse_option82(access_request)

        assert result["circuit_id"] == "OLT1/1/1/1:1"
        assert result["remote_id"] == "ALCL12345678"

    def test_parse_option82_vendor_specific(self):
        """Test parsing vendor-specific Option 82 attributes (Alcatel-Lucent)"""
        access_request = {
            "Alcatel-Lucent-Agent-Circuit-Id": "ge-0/0/1.100",
            "Alcatel-Lucent-Agent-Remote-Id": "00:11:22:33:44:55",
        }

        result = RADIUSService.parse_option82(access_request)

        assert result["circuit_id"] == "ge-0/0/1.100"
        assert result["remote_id"] == "00:11:22:33:44:55"

    def test_parse_option82_mixed_attributes(self):
        """Test parsing with both standard and vendor-specific attributes"""
        # Vendor-specific should not override standard
        access_request = {
            "Agent-Circuit-Id": "OLT1/1/1/1:1",
            "Alcatel-Lucent-Agent-Circuit-Id": "ge-0/0/1.100",
            "Agent-Remote-Id": "ALCL12345678",
        }

        result = RADIUSService.parse_option82(access_request)

        # Standard attributes take priority
        assert result["circuit_id"] == "OLT1/1/1/1:1"
        assert result["remote_id"] == "ALCL12345678"

    def test_parse_option82_empty(self):
        """Test parsing with no Option 82 attributes"""
        access_request = {
            "User-Name": "test@example.com",
            "NAS-IP-Address": "10.0.0.1",
        }

        result = RADIUSService.parse_option82(access_request)

        assert result["circuit_id"] is None
        assert result["remote_id"] is None


class TestOption82Validation:
    """Test Option 82 validation with different policies"""

    async def test_validate_option82_match_success(
        self, async_session: AsyncSession, test_tenant, test_subscriber
    ):
        """Test successful validation when Option 82 matches"""
        # Create network profile with Option 82 settings
        profile = SubscriberNetworkProfile(
            id=str(uuid.uuid4()),
            subscriber_id=test_subscriber.id,  # Use actual subscriber
            tenant_id=test_tenant.id,
            circuit_id="OLT1/1/1/1:1",
            remote_id="ALCL12345678",
            option82_policy=Option82Policy.ENFORCE,
            service_vlan=100,
            ipv6_assignment_mode=IPv6AssignmentMode.SLAAC,
        )
        async_session.add(profile)
        await async_session.commit()

        # Validate matching Option 82
        service = RADIUSService(async_session, test_tenant.id)
        access_request = {
            "Agent-Circuit-Id": "OLT1/1/1/1:1",
            "Agent-Remote-Id": "ALCL12345678",
        }

        result = await service.validate_option82(test_subscriber.id, access_request)

        assert result["valid"] is True
        assert result["policy"] == "enforce"
        assert len(result["mismatches"]) == 0

    async def test_validate_option82_mismatch_enforce_policy(
        self, async_session: AsyncSession, test_tenant, test_subscriber
    ):
        """Test ENFORCE policy rejects access on Option 82 mismatch"""
        # Create network profile with ENFORCE policy
        profile = SubscriberNetworkProfile(
            id=str(uuid.uuid4()),
            subscriber_id=test_subscriber.id,
            tenant_id=test_tenant.id,
            circuit_id="OLT1/1/1/1:1",
            remote_id="ALCL12345678",
            option82_policy=Option82Policy.ENFORCE,
            service_vlan=100,
            ipv6_assignment_mode=IPv6AssignmentMode.SLAAC,
        )
        async_session.add(profile)
        await async_session.commit()

        # Validate mismatching Option 82
        service = RADIUSService(async_session, test_tenant.id)
        access_request = {
            "Agent-Circuit-Id": "OLT2/1/1/1:1",  # Different circuit
            "Agent-Remote-Id": "ALCL99999999",  # Different remote
        }

        result = await service.validate_option82(test_subscriber.id, access_request)

        assert result["valid"] is False
        assert result["policy"] == "enforce"
        assert len(result["mismatches"]) == 2
        assert "circuit_id mismatch" in result["mismatches"][0]
        assert "remote_id mismatch" in result["mismatches"][1]

    async def test_validate_option82_mismatch_log_policy(
        self, async_session: AsyncSession, test_tenant, test_subscriber
    ):
        """Test LOG policy allows access despite Option 82 mismatch"""
        # Create network profile with LOG policy
        profile = SubscriberNetworkProfile(
            id=str(uuid.uuid4()),
            subscriber_id=test_subscriber.id,
            tenant_id=test_tenant.id,
            circuit_id="OLT1/1/1/1:1",
            remote_id="ALCL12345678",
            option82_policy=Option82Policy.LOG,
            service_vlan=100,
            ipv6_assignment_mode=IPv6AssignmentMode.SLAAC,
        )
        async_session.add(profile)
        await async_session.commit()

        # Validate mismatching Option 82
        service = RADIUSService(async_session, test_tenant.id)
        access_request = {
            "Agent-Circuit-Id": "OLT2/1/1/1:1",  # Different circuit
            "Agent-Remote-Id": "ALCL99999999",  # Different remote
        }

        result = await service.validate_option82(test_subscriber.id, access_request)

        # Should still be invalid but policy is LOG
        assert result["valid"] is False
        assert result["policy"] == "log"
        assert len(result["mismatches"]) == 2

    async def test_validate_option82_ignore_policy(
        self, async_session: AsyncSession, test_tenant, test_subscriber
    ):
        """Test IGNORE policy skips validation entirely"""
        # Create network profile with IGNORE policy
        profile = SubscriberNetworkProfile(
            id=str(uuid.uuid4()),
            subscriber_id=test_subscriber.id,
            tenant_id=test_tenant.id,
            circuit_id="OLT1/1/1/1:1",
            remote_id="ALCL12345678",
            option82_policy=Option82Policy.IGNORE,
            service_vlan=100,
            ipv6_assignment_mode=IPv6AssignmentMode.SLAAC,
        )
        async_session.add(profile)
        await async_session.commit()

        # Validate with completely different Option 82
        service = RADIUSService(async_session, test_tenant.id)
        access_request = {
            "Agent-Circuit-Id": "OLT2/1/1/1:1",
            "Agent-Remote-Id": "ALCL99999999",
        }

        result = await service.validate_option82(test_subscriber.id, access_request)

        # IGNORE policy should always return valid
        assert result["valid"] is True
        assert result["policy"] == "ignore"
        assert len(result["mismatches"]) == 0

    async def test_validate_option82_partial_match(
        self, async_session: AsyncSession, test_tenant, test_subscriber
    ):
        """Test validation with partial Option 82 match"""
        # Create network profile with only circuit_id
        profile = SubscriberNetworkProfile(
            id=str(uuid.uuid4()),
            subscriber_id=test_subscriber.id,
            tenant_id=test_tenant.id,
            circuit_id="OLT1/1/1/1:1",
            remote_id=None,  # No remote_id configured
            option82_policy=Option82Policy.ENFORCE,
            service_vlan=100,
            ipv6_assignment_mode=IPv6AssignmentMode.SLAAC,
        )
        async_session.add(profile)
        await async_session.commit()

        # Validate with matching circuit_id
        service = RADIUSService(async_session, test_tenant.id)
        access_request = {
            "Agent-Circuit-Id": "OLT1/1/1/1:1",
            "Agent-Remote-Id": "ALCL12345678",  # This should not cause mismatch
        }

        result = await service.validate_option82(test_subscriber.id, access_request)

        # Should be valid since remote_id is not configured
        assert result["valid"] is True
        assert result["policy"] == "enforce"
        assert len(result["mismatches"]) == 0

    async def test_validate_option82_no_profile(self, async_session: AsyncSession, test_tenant):
        """Test validation when no network profile exists"""
        service = RADIUSService(async_session, test_tenant.id)
        access_request = {
            "Agent-Circuit-Id": "OLT1/1/1/1:1",
            "Agent-Remote-Id": "ALCL12345678",
        }

        result = await service.validate_option82("nonexistent-sub", access_request)

        # Should return valid with ignore policy when no profile
        assert result["valid"] is True
        assert result["policy"] == "ignore"


class TestRADIUSAuthorization:
    """Test RADIUS authorization endpoint with Option 82"""

    async def test_authorize_success_with_option82_match(
        self, async_session: AsyncSession, test_tenant, test_subscriber
    ):
        """Test successful authorization with matching Option 82"""
        # Create network profile
        profile = SubscriberNetworkProfile(
            id=str(uuid.uuid4()),
            subscriber_id=test_subscriber.id,
            tenant_id=test_tenant.id,
            circuit_id="OLT1/1/1/1:1",
            remote_id="ALCL12345678",
            option82_policy=Option82Policy.ENFORCE,
            service_vlan=100,
            ipv6_assignment_mode=IPv6AssignmentMode.SLAAC,
        )
        async_session.add(profile)
        await async_session.commit()

        # Create RADIUS subscriber
        service = RADIUSService(async_session, test_tenant.id)
        radius_data = RADIUSSubscriberCreate(
            subscriber_id=test_subscriber.id,
            username="test@example.com",
            password="testpass123",
        )
        await service.create_subscriber(radius_data)

        # Authorize with matching Option 82
        auth_request = RADIUSAuthorizationRequest(
            username="test@example.com",
            password="testpass123",
            agent_circuit_id="OLT1/1/1/1:1",
            agent_remote_id="ALCL12345678",
        )

        result = await service.authorize_subscriber(auth_request)

        assert result.accept is True
        assert result.reason == "Access granted"
        assert result.option82_validation is not None
        assert result.option82_validation["valid"] is True

    async def test_authorize_reject_option82_mismatch(
        self, async_session: AsyncSession, test_tenant, test_subscriber
    ):
        """Test authorization rejection on Option 82 mismatch with ENFORCE policy"""
        # Create network profile with ENFORCE policy
        profile = SubscriberNetworkProfile(
            id=str(uuid.uuid4()),
            subscriber_id=test_subscriber.id,
            tenant_id=test_tenant.id,
            circuit_id="OLT1/1/1/1:1",
            remote_id="ALCL12345678",
            option82_policy=Option82Policy.ENFORCE,
            service_vlan=100,
            ipv6_assignment_mode=IPv6AssignmentMode.SLAAC,
        )
        async_session.add(profile)
        await async_session.commit()

        # Create RADIUS subscriber
        service = RADIUSService(async_session, test_tenant.id)
        radius_data = RADIUSSubscriberCreate(
            subscriber_id=test_subscriber.id,
            username="test2@example.com",
            password="testpass123",
        )
        await service.create_subscriber(radius_data)

        # Authorize with mismatching Option 82
        auth_request = RADIUSAuthorizationRequest(
            username="test2@example.com",
            password="testpass123",
            agent_circuit_id="OLT2/1/1/1:1",  # Wrong circuit
            agent_remote_id="ALCL99999999",  # Wrong remote
        )

        result = await service.authorize_subscriber(auth_request)

        assert result.accept is False
        assert "Option 82 validation failed" in result.reason
        assert result.option82_validation is not None
        assert result.option82_validation["valid"] is False
        assert result.option82_validation["policy"] == "enforce"

    async def test_authorize_allow_option82_mismatch_log_policy(
        self, async_session: AsyncSession, test_tenant, test_subscriber
    ):
        """Test authorization allows access on Option 82 mismatch with LOG policy"""
        # Create network profile with LOG policy
        profile = SubscriberNetworkProfile(
            id=str(uuid.uuid4()),
            subscriber_id=test_subscriber.id,
            tenant_id=test_tenant.id,
            circuit_id="OLT1/1/1/1:1",
            remote_id="ALCL12345678",
            option82_policy=Option82Policy.LOG,
            service_vlan=100,
            ipv6_assignment_mode=IPv6AssignmentMode.SLAAC,
        )
        async_session.add(profile)
        await async_session.commit()

        # Create RADIUS subscriber
        service = RADIUSService(async_session, test_tenant.id)
        radius_data = RADIUSSubscriberCreate(
            subscriber_id=test_subscriber.id,
            username="test3@example.com",
            password="testpass123",
        )
        await service.create_subscriber(radius_data)

        # Authorize with mismatching Option 82
        auth_request = RADIUSAuthorizationRequest(
            username="test3@example.com",
            password="testpass123",
            agent_circuit_id="OLT2/1/1/1:1",
            agent_remote_id="ALCL99999999",
        )

        result = await service.authorize_subscriber(auth_request)

        # Should accept despite mismatch (LOG policy)
        assert result.accept is True
        assert result.reason == "Access granted"
        assert result.option82_validation is not None
        assert result.option82_validation["valid"] is False
        assert result.option82_validation["policy"] == "log"

    async def test_authorize_invalid_password(
        self, async_session: AsyncSession, test_tenant, test_subscriber
    ):
        """Test authorization rejection on invalid password"""
        # Create RADIUS subscriber
        service = RADIUSService(async_session, test_tenant.id)
        radius_data = RADIUSSubscriberCreate(
            subscriber_id=test_subscriber.id,
            username="test4@example.com",
            password="correctpass123",
        )
        await service.create_subscriber(radius_data)

        # Authorize with wrong password
        auth_request = RADIUSAuthorizationRequest(
            username="test4@example.com",
            password="wrongpass",
        )

        result = await service.authorize_subscriber(auth_request)

        assert result.accept is False
        assert result.reason == "Invalid password"

    async def test_authorize_nonexistent_user(self, async_session: AsyncSession, test_tenant):
        """Test authorization rejection for nonexistent user"""
        service = RADIUSService(async_session, test_tenant.id)

        auth_request = RADIUSAuthorizationRequest(
            username="nonexistent@example.com",
            password="somepass",
        )

        result = await service.authorize_subscriber(auth_request)

        assert result.accept is False
        assert "not found" in result.reason


class TestQinQVLANSupport:
    """Test QinQ (802.1ad) double VLAN tagging support"""

    async def test_single_vlan_mode(
        self, async_session: AsyncSession, test_tenant, test_subscriber
    ):
        """Test single VLAN tagging (backward compatible)"""
        # Create network profile with single VLAN
        profile = SubscriberNetworkProfile(
            id=str(uuid.uuid4()),
            subscriber_id=test_subscriber.id,
            tenant_id=test_tenant.id,
            service_vlan=100,
            inner_vlan=None,
            qinq_enabled=False,
            ipv6_assignment_mode=IPv6AssignmentMode.SLAAC,
        )
        async_session.add(profile)
        await async_session.commit()

        # Create RADIUS subscriber
        service = RADIUSService(async_session, test_tenant.id)
        radius_data = RADIUSSubscriberCreate(
            subscriber_id=test_subscriber.id,
            username="vlan-test@example.com",
            password="testpass123",
        )
        await service.create_subscriber(radius_data)

        # Get reply attributes
        replies = await service.repository.get_radreplies_by_username(
            test_tenant.id, "vlan-test@example.com"
        )
        reply_dict = {r.attribute: r.value for r in replies}

        # Should have single VLAN attributes (no tags)
        assert reply_dict.get("Tunnel-Type") == "VLAN"
        assert reply_dict.get("Tunnel-Medium-Type") == "IEEE-802"
        assert reply_dict.get("Tunnel-Private-Group-ID") == "100"

        # Should NOT have tagged attributes
        assert "Tunnel-Type:1" not in reply_dict
        assert "Tunnel-Type:2" not in reply_dict

    async def test_qinq_double_vlan_mode(
        self, async_session: AsyncSession, test_tenant, test_subscriber
    ):
        """Test QinQ double VLAN tagging"""
        # Create network profile with QinQ
        profile = SubscriberNetworkProfile(
            id=str(uuid.uuid4()),
            subscriber_id=test_subscriber.id,
            tenant_id=test_tenant.id,
            service_vlan=200,  # S-VLAN (outer)
            inner_vlan=300,  # C-VLAN (inner)
            qinq_enabled=True,
            ipv6_assignment_mode=IPv6AssignmentMode.SLAAC,
        )
        async_session.add(profile)
        await async_session.commit()

        # Create RADIUS subscriber
        service = RADIUSService(async_session, test_tenant.id)
        radius_data = RADIUSSubscriberCreate(
            subscriber_id=test_subscriber.id,
            username="qinq-test@example.com",
            password="testpass123",
        )
        await service.create_subscriber(radius_data)

        # Get reply attributes
        replies = await service.repository.get_radreplies_by_username(
            test_tenant.id, "qinq-test@example.com"
        )
        reply_dict = {r.attribute: r.value for r in replies}

        # Should have outer VLAN (S-VLAN) with tag 1
        assert reply_dict.get("Tunnel-Type:1") == "VLAN"
        assert reply_dict.get("Tunnel-Medium-Type:1") == "IEEE-802"
        assert reply_dict.get("Tunnel-Private-Group-ID:1") == "200"

        # Should have inner VLAN (C-VLAN) with tag 2
        assert reply_dict.get("Tunnel-Type:2") == "VLAN"
        assert reply_dict.get("Tunnel-Medium-Type:2") == "IEEE-802"
        assert reply_dict.get("Tunnel-Private-Group-ID:2") == "300"

    async def test_qinq_missing_inner_vlan_fallback(
        self, async_session: AsyncSession, test_tenant, test_subscriber
    ):
        """Test QinQ fallback to single VLAN when inner_vlan is missing"""
        # Create network profile with QinQ enabled but no inner_vlan
        profile = SubscriberNetworkProfile(
            id=str(uuid.uuid4()),
            subscriber_id=test_subscriber.id,
            tenant_id=test_tenant.id,
            service_vlan=100,
            inner_vlan=None,  # Missing inner VLAN
            qinq_enabled=True,  # QinQ enabled
            ipv6_assignment_mode=IPv6AssignmentMode.SLAAC,
        )
        async_session.add(profile)
        await async_session.commit()

        # Create RADIUS subscriber
        service = RADIUSService(async_session, test_tenant.id)
        radius_data = RADIUSSubscriberCreate(
            subscriber_id=test_subscriber.id,
            username="qinq-fallback@example.com",
            password="testpass123",
        )
        await service.create_subscriber(radius_data)

        # Get reply attributes
        replies = await service.repository.get_radreplies_by_username(
            test_tenant.id, "qinq-fallback@example.com"
        )
        reply_dict = {r.attribute: r.value for r in replies}

        # Should fallback to single VLAN mode
        assert reply_dict.get("Tunnel-Type") == "VLAN"
        assert reply_dict.get("Tunnel-Private-Group-ID") == "100"
        assert "Tunnel-Type:1" not in reply_dict
        assert "Tunnel-Type:2" not in reply_dict


class TestPhase3Integration:
    """Integration tests for Phase 3 complete flow"""

    async def test_full_provisioning_with_option82_and_qinq(
        self, async_session: AsyncSession, test_tenant, test_subscriber
    ):
        """Test complete flow: network profile + RADIUS + Option 82 + QinQ"""
        # Create network profile with all Phase 3 features
        profile = SubscriberNetworkProfile(
            id=str(uuid.uuid4()),
            subscriber_id=test_subscriber.id,
            tenant_id=test_tenant.id,
            # Option 82
            circuit_id="OLT1/1/1/1:1",
            remote_id="ALCL12345678",
            option82_policy=Option82Policy.ENFORCE,
            # QinQ VLANs
            service_vlan=200,
            inner_vlan=300,
            qinq_enabled=True,
            # IPv6
            ipv6_assignment_mode=IPv6AssignmentMode.SLAAC,
        )
        async_session.add(profile)
        await async_session.commit()

        # Create RADIUS subscriber
        service = RADIUSService(async_session, test_tenant.id)
        radius_data = RADIUSSubscriberCreate(
            subscriber_id=test_subscriber.id,
            username="full-test@example.com",
            password="testpass123",
        )
        await service.create_subscriber(radius_data)

        # Test 1: Verify QinQ VLANs in reply attributes
        replies = await service.repository.get_radreplies_by_username(
            test_tenant.id, "full-test@example.com"
        )
        reply_dict = {r.attribute: r.value for r in replies}

        assert reply_dict.get("Tunnel-Private-Group-ID:1") == "200"  # S-VLAN
        assert reply_dict.get("Tunnel-Private-Group-ID:2") == "300"  # C-VLAN

        # Test 2: Authorize with matching Option 82
        auth_request = RADIUSAuthorizationRequest(
            username="full-test@example.com",
            password="testpass123",
            agent_circuit_id="OLT1/1/1/1:1",
            agent_remote_id="ALCL12345678",
        )
        result = await service.authorize_subscriber(auth_request)

        assert result.accept is True
        assert result.option82_validation["valid"] is True

        # Test 3: Authorize with mismatching Option 82 (should reject)
        auth_request_bad = RADIUSAuthorizationRequest(
            username="full-test@example.com",
            password="testpass123",
            agent_circuit_id="OLT2/1/1/1:1",  # Wrong circuit
            agent_remote_id="ALCL12345678",
        )
        result_bad = await service.authorize_subscriber(auth_request_bad)

        assert result_bad.accept is False
        assert result_bad.option82_validation["valid"] is False
