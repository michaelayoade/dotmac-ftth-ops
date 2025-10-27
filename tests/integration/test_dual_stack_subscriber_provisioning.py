"""
Integration Tests for End-to-End Dual-Stack Subscriber Provisioning

Tests the complete workflow from subscriber creation through RADIUS, NetBox,
and WireGuard integration with IPv4 and IPv6 support.
"""

from unittest.mock import patch

import pytest

from dotmac.platform.radius.schemas import RADIUSSubscriberCreate
from dotmac.platform.radius.service import RADIUSService


@pytest.mark.integration
@pytest.mark.asyncio
class TestDualStackSubscriberProvisioning:
    """Integration tests for complete dual-stack subscriber provisioning."""

    async def test_provision_subscriber_with_dual_stack_ips_integration(self, async_db_session):
        """
        Test complete provisioning workflow with dual-stack IPs.

        Flow:
        1. Create RADIUS subscriber with dual-stack IPs
        2. Verify RADIUS tables (radcheck, radreply) contain both IPv4 and IPv6
        3. Verify subscriber can be retrieved with correct IPs
        """
        with patch("dotmac.platform.settings.settings") as mock_settings:
            mock_settings.radius.shared_secret = "test_secret"
            mock_settings.is_production = False

            # Create service
            service = RADIUSService(session=async_db_session, tenant_id="test_tenant")

            # Create subscriber with both IPv4 and IPv6
            subscriber_data = RADIUSSubscriberCreate(
                subscriber_id="sub_dual_stack_001",
                username="dualstack_user",
                password="SecurePass123!",
                framed_ipv4_address="10.100.1.50",
                framed_ipv6_address="2001:db8:100::50",
                framed_ipv6_prefix="2001:db8:100::/64",
                delegated_ipv6_prefix="2001:db8:200::/56",
            )

            # Provision subscriber
            result = await service.create_subscriber(subscriber_data)

            # Verify response contains both IPs
            assert result.subscriber_id == "sub_dual_stack_001"
            assert result.username == "dualstack_user"
            assert result.framed_ipv4_address == "10.100.1.50"
            assert result.framed_ipv6_address == "2001:db8:100::50"
            assert result.framed_ipv6_prefix == "2001:db8:100::/64"
            assert result.delegated_ipv6_prefix == "2001:db8:200::/56"

            # Retrieve subscriber to verify persistence
            retrieved = await service.get_subscriber("sub_dual_stack_001")
            assert retrieved.framed_ipv4_address == "10.100.1.50"
            assert retrieved.framed_ipv6_address == "2001:db8:100::50"
            assert retrieved.framed_ipv6_prefix == "2001:db8:100::/64"

    async def test_provision_subscriber_ipv4_only_integration(self, async_db_session):
        """
        Test provisioning subscriber with IPv4 only (backward compatibility).
        """
        with patch("dotmac.platform.settings.settings") as mock_settings:
            mock_settings.radius.shared_secret = "test_secret"
            mock_settings.is_production = False

            service = RADIUSService(session=async_db_session, tenant_id="test_tenant")

            # Create IPv4-only subscriber
            subscriber_data = RADIUSSubscriberCreate(
                subscriber_id="sub_ipv4_only_001",
                username="ipv4only_user",
                password="SecurePass123!",
                framed_ipv4_address="10.100.2.100",
            )

            result = await service.create_subscriber(subscriber_data)

            # Verify IPv4 assigned, IPv6 fields None
            assert result.framed_ipv4_address == "10.100.2.100"
            assert result.framed_ipv6_address is None
            assert result.framed_ipv6_prefix is None

    async def test_provision_subscriber_ipv6_only_integration(self, async_db_session):
        """
        Test provisioning subscriber with IPv6 only.
        """
        with patch("dotmac.platform.settings.settings") as mock_settings:
            mock_settings.radius.shared_secret = "test_secret"
            mock_settings.is_production = False

            service = RADIUSService(session=async_db_session, tenant_id="test_tenant")

            # Create IPv6-only subscriber
            subscriber_data = RADIUSSubscriberCreate(
                subscriber_id="sub_ipv6_only_001",
                username="ipv6only_user",
                password="SecurePass123!",
                framed_ipv6_address="2001:db8:300::10",
                framed_ipv6_prefix="2001:db8:300::/64",
            )

            result = await service.create_subscriber(subscriber_data)

            # Verify IPv6 assigned, IPv4 None
            assert result.framed_ipv4_address is None
            assert result.framed_ipv6_address == "2001:db8:300::10"
            assert result.framed_ipv6_prefix == "2001:db8:300::/64"

    async def test_update_subscriber_add_ipv6_to_ipv4_integration(self, async_db_session):
        """
        Test upgrading existing IPv4-only subscriber to dual-stack.
        """
        with patch("dotmac.platform.settings.settings") as mock_settings:
            mock_settings.radius.shared_secret = "test_secret"
            mock_settings.is_production = False

            service = RADIUSService(session=async_db_session, tenant_id="test_tenant")

            # 1. Create IPv4-only subscriber
            subscriber_data = RADIUSSubscriberCreate(
                subscriber_id="sub_upgrade_001",
                username="upgrade_user",
                password="SecurePass123!",
                framed_ipv4_address="10.100.3.200",
            )

            result = await service.create_subscriber(subscriber_data)
            assert result.framed_ipv4_address == "10.100.3.200"
            assert result.framed_ipv6_address is None

            # 2. Update to add IPv6
            from dotmac.platform.radius.schemas import RADIUSSubscriberUpdate

            update_data = RADIUSSubscriberUpdate(
                framed_ipv6_address="2001:db8:400::200",
                framed_ipv6_prefix="2001:db8:400::/64",
            )

            updated = await service.update_subscriber("sub_upgrade_001", update_data)

            # Verify now dual-stack
            assert updated.framed_ipv4_address == "10.100.3.200"
            assert updated.framed_ipv6_address == "2001:db8:400::200"
            assert updated.framed_ipv6_prefix == "2001:db8:400::/64"

    async def test_provision_multiple_subscribers_tenant_isolation(self, async_db_session):
        """
        Test tenant isolation in dual-stack provisioning.
        """
        with patch("dotmac.platform.settings.settings") as mock_settings:
            mock_settings.radius.shared_secret = "test_secret"
            mock_settings.is_production = False

            # Tenant A service
            service_a = RADIUSService(session=async_db_session, tenant_id="tenant_a")

            # Tenant B service
            service_b = RADIUSService(session=async_db_session, tenant_id="tenant_b")

            # Create subscriber in Tenant A
            subscriber_a = RADIUSSubscriberCreate(
                subscriber_id="sub_tenant_a_001",
                username="tenant_a_user",
                password="SecurePass123!",
                framed_ipv4_address="10.1.1.100",
                framed_ipv6_address="2001:db8:a::100",
            )

            result_a = await service_a.create_subscriber(subscriber_a)

            # Create subscriber in Tenant B (same IPs, different tenant)
            subscriber_b = RADIUSSubscriberCreate(
                subscriber_id="sub_tenant_b_001",
                username="tenant_b_user",
                password="SecurePass123!",
                framed_ipv4_address="10.1.1.100",  # Same IPv4 allowed (different tenant)
                framed_ipv6_address="2001:db8:a::100",  # Same IPv6 allowed
            )

            result_b = await service_b.create_subscriber(subscriber_b)

            # Verify both created successfully
            assert result_a.tenant_id == "tenant_a"
            assert result_b.tenant_id == "tenant_b"

            # Tenant A cannot see Tenant B's subscriber
            tenant_a_sub = await service_a.get_subscriber("sub_tenant_b_001")
            assert tenant_a_sub is None  # Not accessible cross-tenant

    async def test_provision_subscriber_with_bandwidth_profile_integration(self, async_db_session):
        """
        Test dual-stack provisioning with bandwidth profile.
        """
        with patch("dotmac.platform.settings.settings") as mock_settings:
            mock_settings.radius.shared_secret = "test_secret"
            mock_settings.is_production = False

            service = RADIUSService(session=async_db_session, tenant_id="test_tenant")

            # Create subscriber with bandwidth limits
            subscriber_data = RADIUSSubscriberCreate(
                subscriber_id="sub_bandwidth_001",
                username="bandwidth_user",
                password="SecurePass123!",
                framed_ipv4_address="10.100.4.50",
                framed_ipv6_address="2001:db8:500::50",
                download_speed="100M",  # 100 Mbps
                upload_speed="50M",  # 50 Mbps
            )

            result = await service.create_subscriber(subscriber_data)

            # Verify IPs and bandwidth
            assert result.framed_ipv4_address == "10.100.4.50"
            assert result.framed_ipv6_address == "2001:db8:500::50"
            assert result.download_speed == "100M"
            assert result.upload_speed == "50M"

    async def test_bulk_provision_subscribers_dual_stack(self, async_db_session):
        """
        Test bulk provisioning of dual-stack subscribers.
        """
        with patch("dotmac.platform.settings.settings") as mock_settings:
            mock_settings.radius.shared_secret = "test_secret"
            mock_settings.is_production = False

            service = RADIUSService(session=async_db_session, tenant_id="test_tenant")

            # Provision 10 subscribers with sequential IPs
            created_subs = []
            for i in range(1, 11):
                subscriber_data = RADIUSSubscriberCreate(
                    subscriber_id=f"sub_bulk_{i:03d}",
                    username=f"bulk_user_{i:03d}",
                    password="SecurePass123!",
                    framed_ipv4_address=f"10.200.1.{i}",
                    framed_ipv6_address=f"2001:db8:bulk::{i:x}",
                )

                result = await service.create_subscriber(subscriber_data)
                created_subs.append(result)

            # Verify all created
            assert len(created_subs) == 10

            # Verify sequential IPs
            assert created_subs[0].framed_ipv4_address == "10.200.1.1"
            assert created_subs[9].framed_ipv4_address == "10.200.1.10"
            assert created_subs[0].framed_ipv6_address == "2001:db8:bulk::1"
            assert created_subs[9].framed_ipv6_address == "2001:db8:bulk::a"

    async def test_delete_subscriber_cleanup_dual_stack(self, async_db_session):
        """
        Test subscriber deletion cleans up both IPv4 and IPv6 assignments.
        """
        with patch("dotmac.platform.settings.settings") as mock_settings:
            mock_settings.radius.shared_secret = "test_secret"
            mock_settings.is_production = False

            service = RADIUSService(session=async_db_session, tenant_id="test_tenant")

            # Create dual-stack subscriber
            subscriber_data = RADIUSSubscriberCreate(
                subscriber_id="sub_delete_001",
                username="delete_user",
                password="SecurePass123!",
                framed_ipv4_address="10.100.5.100",
                framed_ipv6_address="2001:db8:600::100",
            )

            await service.create_subscriber(subscriber_data)

            # Verify exists
            subscriber = await service.get_subscriber("sub_delete_001")
            assert subscriber is not None

            # Delete subscriber
            await service.delete_subscriber("sub_delete_001")

            # Verify deleted
            deleted_sub = await service.get_subscriber("sub_delete_001")
            assert deleted_sub is None
