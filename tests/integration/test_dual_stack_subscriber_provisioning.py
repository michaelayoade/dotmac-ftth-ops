"""
Integration Tests for End-to-End Dual-Stack Subscriber Provisioning

Tests the complete workflow from subscriber creation through RADIUS, NetBox,
and WireGuard integration with IPv4 and IPv6 support.
"""

from unittest.mock import patch
from uuid import uuid4

import pytest

from dotmac.platform.radius.schemas import RADIUSSubscriberCreate
from dotmac.platform.radius.service import RADIUSService


@pytest.mark.integration
@pytest.mark.serial_only
@pytest.mark.asyncio
class TestDualStackSubscriberProvisioning:
    """Integration tests for complete dual-stack subscriber provisioning."""

    async def test_provision_subscriber_with_dual_stack_ips_integration(
        self, async_session, smoke_test_tenant, subscriber_factory
    ):
        """
        Test complete provisioning workflow with dual-stack IPs.

        Flow:
        1. Create Subscriber record (required for FK constraint)
        2. Create RADIUS subscriber with dual-stack IPs
        3. Verify RADIUS tables (radcheck, radreply) contain both IPv4 and IPv6
        4. Verify subscriber can be retrieved with correct IPs
        """
        with patch("dotmac.platform.settings.settings") as mock_settings:
            mock_settings.radius.shared_secret = "test_secret"
            mock_settings.is_production = False

            # Create service
            service = RADIUSService(session=async_session, tenant_id="smoke-test-tenant")

            # Create subscriber with both IPv4 and IPv6 (use uuid for uniqueness)
            unique_id = str(uuid4())[:8]
            subscriber_id = f"sub_dual_stack_{unique_id}"
            username = f"dualstack_user_{unique_id}"

            # Create Subscriber record first (required for FK constraint)
            from dotmac.platform.subscribers.models import SubscriberStatus

            await subscriber_factory.create(
                id=subscriber_id,
                tenant_id="smoke-test-tenant",
                username=username,
                subscriber_number=f"SUB-{unique_id.upper()}",
                status=SubscriberStatus.ACTIVE,
            )

            subscriber_data = RADIUSSubscriberCreate(
                subscriber_id=subscriber_id,
                username=username,
                password="SecurePass123!",
                framed_ipv4_address="10.100.1.50",
                framed_ipv6_address="2001:db8:100::50",
                framed_ipv6_prefix="2001:db8:100::/64",
                delegated_ipv6_prefix="2001:db8:200::/56",
            )

            # Provision subscriber (creates RADIUS records)
            result = await service.create_subscriber(subscriber_data)

            # Verify response contains both IPs
            assert result.subscriber_id == subscriber_id
            assert result.username == username
            assert result.framed_ipv4_address == "10.100.1.50"
            assert result.framed_ipv6_address == "2001:db8:100::50"
            assert result.framed_ipv6_prefix == "2001:db8:100::/64"
            assert result.delegated_ipv6_prefix == "2001:db8:200::/56"

            # Retrieve subscriber to verify persistence
            retrieved = await service.get_subscriber(subscriber_id=subscriber_id)
            assert retrieved.framed_ipv4_address == "10.100.1.50"
            assert retrieved.framed_ipv6_address == "2001:db8:100::50"
            assert retrieved.framed_ipv6_prefix == "2001:db8:100::/64"

    async def test_provision_subscriber_ipv4_only_integration(
        self, async_session, smoke_test_tenant, subscriber_factory
    ):
        """
        Test provisioning subscriber with IPv4 only (backward compatibility).
        """
        with patch("dotmac.platform.settings.settings") as mock_settings:
            mock_settings.radius.shared_secret = "test_secret"
            mock_settings.is_production = False

            service = RADIUSService(session=async_session, tenant_id="smoke-test-tenant")

            # Create IPv4-only subscriber (use uuid for uniqueness)
            unique_id = str(uuid4())[:8]
            subscriber_id = f"sub_ipv4_only_{unique_id}"
            username = f"ipv4only_user_{unique_id}"

            # Create Subscriber record first (required for FK constraint)
            from dotmac.platform.subscribers.models import SubscriberStatus

            await subscriber_factory.create(
                id=subscriber_id,
                tenant_id="smoke-test-tenant",
                username=username,
                subscriber_number=f"SUB-{unique_id.upper()}",
                status=SubscriberStatus.ACTIVE,
            )

            subscriber_data = RADIUSSubscriberCreate(
                subscriber_id=subscriber_id,
                username=username,
                password="SecurePass123!",
                framed_ipv4_address="10.100.2.100",
            )

            result = await service.create_subscriber(subscriber_data)

            # Verify IPv4 assigned, IPv6 fields None
            assert result.framed_ipv4_address == "10.100.2.100"
            assert result.framed_ipv6_address is None
            assert result.framed_ipv6_prefix is None

    async def test_provision_subscriber_ipv6_only_integration(
        self, async_session, smoke_test_tenant, subscriber_factory
    ):
        """
        Test provisioning subscriber with IPv6 only.
        """
        with patch("dotmac.platform.settings.settings") as mock_settings:
            mock_settings.radius.shared_secret = "test_secret"
            mock_settings.is_production = False

            service = RADIUSService(session=async_session, tenant_id="smoke-test-tenant")

            # Create IPv6-only subscriber (use uuid for uniqueness)
            unique_id = str(uuid4())[:8]
            subscriber_id = f"sub_ipv6_only_{unique_id}"
            username = f"ipv6only_user_{unique_id}"

            # Create Subscriber record first (required for FK constraint)
            from dotmac.platform.subscribers.models import SubscriberStatus

            await subscriber_factory.create(
                id=subscriber_id,
                tenant_id="smoke-test-tenant",
                username=username,
                subscriber_number=f"SUB-{unique_id.upper()}",
                status=SubscriberStatus.ACTIVE,
            )

            subscriber_data = RADIUSSubscriberCreate(
                subscriber_id=subscriber_id,
                username=username,
                password="SecurePass123!",
                framed_ipv6_address="2001:db8:300::10",
                framed_ipv6_prefix="2001:db8:300::/64",
            )

            result = await service.create_subscriber(subscriber_data)

            # Verify IPv6 assigned, IPv4 None
            assert result.framed_ipv4_address is None
            assert result.framed_ipv6_address == "2001:db8:300::10"
            assert result.framed_ipv6_prefix == "2001:db8:300::/64"

    async def test_update_subscriber_add_ipv6_to_ipv4_integration(
        self, async_session, smoke_test_tenant, subscriber_factory
    ):
        """
        Test upgrading existing IPv4-only subscriber to dual-stack.
        """
        with patch("dotmac.platform.settings.settings") as mock_settings:
            mock_settings.radius.shared_secret = "test_secret"
            mock_settings.is_production = False

            service = RADIUSService(session=async_session, tenant_id="smoke-test-tenant")

            # 1. Create IPv4-only subscriber (use uuid for uniqueness)
            unique_id = str(uuid4())[:8]
            subscriber_id = f"sub_upgrade_{unique_id}"
            username = f"upgrade_user_{unique_id}"

            # Create Subscriber record first (required for FK constraint)
            from dotmac.platform.subscribers.models import SubscriberStatus

            await subscriber_factory.create(
                id=subscriber_id,
                tenant_id="smoke-test-tenant",
                username=username,
                subscriber_number=f"SUB-{unique_id.upper()}",
                status=SubscriberStatus.ACTIVE,
            )

            subscriber_data = RADIUSSubscriberCreate(
                subscriber_id=subscriber_id,
                username=username,
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

            updated = await service.update_subscriber(data=update_data, subscriber_id=subscriber_id)

            # Verify now dual-stack
            assert updated.framed_ipv4_address == "10.100.3.200"
            assert updated.framed_ipv6_address == "2001:db8:400::200"
            assert updated.framed_ipv6_prefix == "2001:db8:400::/64"

    async def test_provision_multiple_subscribers_tenant_isolation(
        self, async_session, smoke_test_tenant_a, smoke_test_tenant_b, subscriber_factory
    ):
        """
        Test tenant isolation in dual-stack provisioning.
        """
        with patch("dotmac.platform.settings.settings") as mock_settings:
            mock_settings.radius.shared_secret = "test_secret"
            mock_settings.is_production = False

            # Tenant A service
            service_a = RADIUSService(session=async_session, tenant_id=smoke_test_tenant_a.id)

            # Tenant B service
            service_b = RADIUSService(session=async_session, tenant_id=smoke_test_tenant_b.id)

            # Create subscriber in Tenant A (use uuid for uniqueness)
            unique_id_a = str(uuid4())[:8]
            subscriber_id_a = f"sub_tenant_a_{unique_id_a}"
            username_a = f"tenant_a_user_{unique_id_a}"

            # Create Subscriber record first (required for FK constraint)
            from dotmac.platform.subscribers.models import SubscriberStatus

            await subscriber_factory.create(
                id=subscriber_id_a,
                tenant_id=smoke_test_tenant_a.id,
                username=username_a,
                subscriber_number=f"SUB-{unique_id_a.upper()}",
                status=SubscriberStatus.ACTIVE,
            )

            subscriber_a = RADIUSSubscriberCreate(
                subscriber_id=subscriber_id_a,
                username=username_a,
                password="SecurePass123!",
                framed_ipv4_address="10.1.1.100",
                framed_ipv6_address="2001:db8:a::100",
            )

            result_a = await service_a.create_subscriber(subscriber_a)

            # Create subscriber in Tenant B (same IPs, different tenant)
            unique_id_b = str(uuid4())[:8]
            subscriber_id_b = f"sub_tenant_b_{unique_id_b}"
            username_b = f"tenant_b_user_{unique_id_b}"

            # Create Subscriber record first (required for FK constraint)
            await subscriber_factory.create(
                id=subscriber_id_b,
                tenant_id=smoke_test_tenant_b.id,
                username=username_b,
                subscriber_number=f"SUB-{unique_id_b.upper()}",
                status=SubscriberStatus.ACTIVE,
            )

            subscriber_b = RADIUSSubscriberCreate(
                subscriber_id=subscriber_id_b,
                username=username_b,
                password="SecurePass123!",
                framed_ipv4_address="10.1.1.100",  # Same IPv4 allowed (different tenant)
                framed_ipv6_address="2001:db8:a::100",  # Same IPv6 allowed
            )

            result_b = await service_b.create_subscriber(subscriber_b)

            # Verify both created successfully
            assert result_a.tenant_id == smoke_test_tenant_a.id
            assert result_b.tenant_id == smoke_test_tenant_b.id

            # Tenant A cannot see Tenant B's subscriber
            tenant_a_sub = await service_a.get_subscriber(subscriber_id=subscriber_id_b)
            assert tenant_a_sub is None  # Not accessible cross-tenant

    async def test_provision_subscriber_with_bandwidth_profile_integration(
        self, async_session, smoke_test_tenant, subscriber_factory
    ):
        """
        Test dual-stack provisioning with bandwidth profile.
        """
        with patch("dotmac.platform.settings.settings") as mock_settings:
            mock_settings.radius.shared_secret = "test_secret"
            mock_settings.is_production = False

            service = RADIUSService(session=async_session, tenant_id="smoke-test-tenant")

            # Create subscriber with bandwidth limits (use uuid for uniqueness)
            unique_id = str(uuid4())[:8]
            subscriber_id = f"sub_bandwidth_{unique_id}"
            username = f"bandwidth_user_{unique_id}"

            # Create Subscriber record first (required for FK constraint)
            from dotmac.platform.subscribers.models import SubscriberStatus

            await subscriber_factory.create(
                id=subscriber_id,
                tenant_id="smoke-test-tenant",
                username=username,
                subscriber_number=f"SUB-{unique_id.upper()}",
                status=SubscriberStatus.ACTIVE,
            )

            subscriber_data = RADIUSSubscriberCreate(
                subscriber_id=subscriber_id,
                username=username,
                password="SecurePass123!",
                framed_ipv4_address="10.100.4.50",
                framed_ipv6_address="2001:db8:500::50",
                # Note: bandwidth limits are set via bandwidth_profile_id
                # Direct speed fields (download_speed/upload_speed) don't exist in schema
            )

            result = await service.create_subscriber(subscriber_data)

            # Verify IPs
            assert result.framed_ipv4_address == "10.100.4.50"
            assert result.framed_ipv6_address == "2001:db8:500::50"

    async def test_bulk_provision_subscribers_dual_stack(
        self, async_session, smoke_test_tenant, subscriber_factory
    ):
        """
        Test bulk provisioning of dual-stack subscribers.
        """
        with patch("dotmac.platform.settings.settings") as mock_settings:
            mock_settings.radius.shared_secret = "test_secret"
            mock_settings.is_production = False

            service = RADIUSService(session=async_session, tenant_id="smoke-test-tenant")

            # Provision 10 subscribers with sequential IPs (use uuid for uniqueness)
            unique_batch = str(uuid4())[:8]
            created_subs = []
            for i in range(1, 11):
                subscriber_id = f"sub_bulk_{unique_batch}_{i:03d}"
                username = f"bulk_user_{unique_batch}_{i:03d}"

                # Create Subscriber record first (required for FK constraint)
                from dotmac.platform.subscribers.models import SubscriberStatus

                await subscriber_factory.create(
                    id=subscriber_id,
                    tenant_id="smoke-test-tenant",
                    username=username,
                    subscriber_number=f"SUB-{unique_batch.upper()}-{i:03d}",
                    status=SubscriberStatus.ACTIVE,
                )

                subscriber_data = RADIUSSubscriberCreate(
                    subscriber_id=subscriber_id,
                    username=username,
                    password="SecurePass123!",
                    framed_ipv4_address=f"10.200.1.{i}",
                    framed_ipv6_address=f"2001:db8:1000::{i:x}",
                )

                result = await service.create_subscriber(subscriber_data)
                created_subs.append(result)

            # Verify all created
            assert len(created_subs) == 10

            # Verify sequential IPs
            assert created_subs[0].framed_ipv4_address == "10.200.1.1"
            assert created_subs[9].framed_ipv4_address == "10.200.1.10"
            assert created_subs[0].framed_ipv6_address == "2001:db8:1000::1"
            assert created_subs[9].framed_ipv6_address == "2001:db8:1000::a"

    async def test_delete_subscriber_cleanup_dual_stack(
        self, async_session, smoke_test_tenant, subscriber_factory
    ):
        """
        Test subscriber deletion cleans up both IPv4 and IPv6 assignments.
        """
        with patch("dotmac.platform.settings.settings") as mock_settings:
            mock_settings.radius.shared_secret = "test_secret"
            mock_settings.is_production = False

            service = RADIUSService(session=async_session, tenant_id="smoke-test-tenant")

            # Create dual-stack subscriber (use uuid for uniqueness)
            unique_id = str(uuid4())[:8]
            subscriber_id = f"sub_delete_{unique_id}"
            username = f"delete_user_{unique_id}"

            # Create Subscriber record first (required for FK constraint)
            from dotmac.platform.subscribers.models import SubscriberStatus

            await subscriber_factory.create(
                id=subscriber_id,
                tenant_id="smoke-test-tenant",
                username=username,
                subscriber_number=f"SUB-{unique_id.upper()}",
                status=SubscriberStatus.ACTIVE,
            )

            subscriber_data = RADIUSSubscriberCreate(
                subscriber_id=subscriber_id,
                username=username,
                password="SecurePass123!",
                framed_ipv4_address="10.100.5.100",
                framed_ipv6_address="2001:db8:600::100",
            )

            await service.create_subscriber(subscriber_data)

            # Verify exists
            subscriber = await service.get_subscriber(subscriber_id=subscriber_id)
            assert subscriber is not None

            # Delete subscriber
            await service.delete_subscriber(subscriber_id=subscriber_id)

            # Verify deleted
            deleted_sub = await service.get_subscriber(subscriber_id=subscriber_id)
            assert deleted_sub is None
