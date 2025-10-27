"""
Orchestration Service.

Coordinates complex multi-system workflows for subscriber lifecycle management.
Handles end-to-end provisioning across CRM, BSS, OSS, and network systems.
"""

from collections.abc import Callable
from datetime import datetime
from typing import Any
from uuid import UUID

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.core.exceptions import NotFoundError, ValidationError
from dotmac.platform.crm.models import LeadStatus, QuoteStatus
from dotmac.platform.crm.service import LeadService, QuoteService
from dotmac.platform.customer_management.models import Customer, CustomerStatus
from dotmac.platform.customer_management.service import CustomerService
from dotmac.platform.genieacs.service import GenieACSService
from dotmac.platform.netbox.service import NetBoxService
from dotmac.platform.notifications.models import NotificationPriority, NotificationType
from dotmac.platform.notifications.service import NotificationService
from dotmac.platform.radius.models import RadCheck
from dotmac.platform.radius.schemas import RADIUSSubscriberCreate
from dotmac.platform.radius.service import RADIUSService
from dotmac.platform.subscribers.models import Subscriber, SubscriberStatus
from dotmac.platform.voltha.service import VOLTHAService

logger = structlog.get_logger(__name__)


class OrchestrationService:
    """
    Orchestrates complex workflows across multiple systems.

    Handles:
    - Lead to Customer conversion
    - Customer to Subscriber provisioning
    - Network resource allocation (IP, VLAN, etc.)
    - Device provisioning (ONU, CPE)
    - RADIUS authentication setup
    - Service activation
    """

    def __init__(
        self,
        db: AsyncSession,
        customer_service: CustomerService | None = None,
        lead_service: LeadService | None = None,
        quote_service: QuoteService | None = None,
        radius_service: RADIUSService | Callable[[AsyncSession, str], RADIUSService] | None = None,
        netbox_service: NetBoxService | None = None,
        voltha_service: VOLTHAService | None = None,
        genieacs_service: GenieACSService | None = None,
        notification_service: NotificationService | None = None,
    ) -> None:
        self.db = db
        self.customer_service = customer_service or CustomerService(db)
        self.lead_service = lead_service or LeadService(db)
        self.quote_service = quote_service or QuoteService(db)
        if callable(radius_service):
            self._radius_service_factory: Callable[[AsyncSession, str], RADIUSService] = (
                radius_service
            )
        elif radius_service is not None:
            self._radius_service_factory = lambda _db, _tenant_id: radius_service
        else:
            self._radius_service_factory = lambda session, tenant: RADIUSService(session, tenant)
        self.netbox_service = netbox_service or NetBoxService()
        self.voltha_service = voltha_service or VOLTHAService()
        self.genieacs_service = genieacs_service or GenieACSService()
        self.notification_service = notification_service or NotificationService(db)

    def _get_radius_service(self, tenant_id: str) -> RADIUSService:
        """Return a tenant-scoped RADIUS service instance."""
        return self._radius_service_factory(self.db, tenant_id)

    async def convert_lead_to_customer(
        self,
        tenant_id: str,
        lead_id: UUID,
        accepted_quote_id: UUID,
        user_id: UUID | None = None,
    ) -> dict[str, Any]:
        """
        Convert an accepted lead to a customer with billing setup.

        Workflow:
        1. Verify lead and accepted quote exist
        2. Create customer record from lead data
        3. Update lead status to WON
        4. Create initial subscription from quote
        5. Return customer and subscription details

        Args:
            tenant_id: Tenant identifier
            lead_id: Lead to convert
            accepted_quote_id: Accepted quote to use for subscription
            user_id: User performing the conversion

        Returns:
            Dictionary with customer, subscription, and quote info
        """
        logger.info(
            "Starting lead to customer conversion",
            tenant_id=tenant_id,
            lead_id=str(lead_id),
            quote_id=str(accepted_quote_id),
        )

        # 1. Verify lead exists and is qualified
        lead = await self.lead_service.get_lead(tenant_id, lead_id)

        if lead.status not in [LeadStatus.NEGOTIATING, LeadStatus.QUOTE_SENT]:
            raise ValidationError(
                f"Lead must be in negotiating or quote_sent status, not {lead.status}"
            )

        # 2. Verify quote exists and is accepted
        quote = await self.quote_service.get_quote(tenant_id, accepted_quote_id)

        if quote.lead_id != lead_id:
            raise ValidationError(f"Quote {accepted_quote_id} does not belong to lead {lead_id}")

        if quote.status != QuoteStatus.ACCEPTED:
            raise ValidationError(f"Quote {accepted_quote_id} must be accepted, not {quote.status}")

        # 3. Create customer from lead data
        customer = await self.customer_service.create_customer(
            tenant_id=tenant_id,
            first_name=lead.first_name,
            last_name=lead.last_name,
            email=lead.email,
            phone=lead.phone,
            company_name=lead.company_name,
            customer_type="individual" if not lead.company_name else "business",
            status=CustomerStatus.ACTIVE,
            billing_address_line1=lead.service_address_line1,
            billing_address_line2=lead.service_address_line2,
            billing_city=lead.service_city,
            billing_state_province=lead.service_state_province,
            billing_postal_code=lead.service_postal_code,
            billing_country=lead.service_country,
            service_address_line1=lead.service_address_line1,
            service_address_line2=lead.service_address_line2,
            service_city=lead.service_city,
            service_state_province=lead.service_state_province,
            service_postal_code=lead.service_postal_code,
            service_country=lead.service_country,
            metadata={
                "converted_from_lead_id": str(lead_id),
                "accepted_quote_id": str(accepted_quote_id),
                "source": lead.source.value,
                "partner_id": str(lead.partner_id) if lead.partner_id else None,
            },
        )

        # 4. Update lead as converted
        lead = await self.lead_service.convert_to_customer(
            tenant_id=tenant_id,
            lead_id=lead_id,
            customer=customer,
            updated_by_id=user_id,
        )

        await self.db.commit()

        logger.info(
            "Successfully converted lead to customer",
            tenant_id=tenant_id,
            lead_id=str(lead_id),
            customer_id=str(customer.id),
        )

        return {
            "customer": customer,
            "lead": lead,
            "quote": quote,
            "conversion_date": datetime.utcnow(),
        }

    async def provision_subscriber(
        self,
        tenant_id: str,
        customer_id: UUID,
        username: str,
        password: str,
        service_plan: str,
        download_speed_kbps: int,
        upload_speed_kbps: int,
        onu_serial: str | None = None,
        cpe_mac_address: str | None = None,
        site_id: str | None = None,
        user_id: UUID | None = None,
    ) -> dict[str, Any]:
        """
        Provision a new subscriber across all systems.

        Complete workflow:
        1. Create subscriber record
        2. Allocate IP address from NetBox
        3. Create RADIUS authentication (radcheck/radreply)
        4. Provision ONU in VOLTHA (if ONU serial provided)
        5. Provision CPE in GenieACS (if MAC provided)
        6. Activate subscriber

        Args:
            tenant_id: Tenant identifier
            customer_id: Customer to provision for
            username: RADIUS username
            password: RADIUS password
            service_plan: Service plan name
            download_speed_kbps: Download bandwidth in Kbps
            upload_speed_kbps: Upload bandwidth in Kbps
            onu_serial: ONU serial number (optional)
            cpe_mac_address: CPE MAC address (optional)
            site_id: Site identifier (optional)
            user_id: User performing provisioning

        Returns:
            Dictionary with subscriber and provisioning status
        """
        logger.info(
            "Starting subscriber provisioning",
            tenant_id=tenant_id,
            customer_id=str(customer_id),
            username=username,
        )

        # 1. Verify customer exists
        stmt = select(Customer).where(Customer.tenant_id == tenant_id, Customer.id == customer_id)
        result = await self.db.execute(stmt)
        customer = result.scalar_one_or_none()

        if not customer:
            raise NotFoundError(f"Customer {customer_id} not found")

        # Generate subscriber ID
        subscriber_id = f"{tenant_id}_{username}"

        # 2. Check if username already exists
        existing_stmt = select(Subscriber).where(
            Subscriber.tenant_id == tenant_id, Subscriber.username == username
        )
        existing_result = await self.db.execute(existing_stmt)
        existing_subscriber = existing_result.scalar_one_or_none()

        if existing_subscriber:
            raise ValidationError(f"Subscriber with username {username} already exists")

        radius_service = self._get_radius_service(tenant_id)

        # 3. Allocate IP address from NetBox
        ip_allocation = None
        try:
            ip_allocation = await self.netbox_service.allocate_subscriber_ip(
                tenant_id=tenant_id,
                subscriber_id=subscriber_id,
                site_id=site_id,
            )
            logger.info("IP allocated", ip=ip_allocation.get("address") if ip_allocation else None)
        except Exception as e:
            logger.warning("IP allocation failed", error=str(e))

        # 4. Create subscriber record
        subscriber = Subscriber(
            id=subscriber_id,
            tenant_id=tenant_id,
            customer_id=customer_id,
            username=username,
            password=password,  # Note: Should be hashed in production
            status=SubscriberStatus.PENDING,
            service_type=service_plan,
            download_speed_kbps=download_speed_kbps,
            upload_speed_kbps=upload_speed_kbps,
            onu_serial=onu_serial,
            cpe_mac_address=cpe_mac_address,
            site_id=site_id,
            static_ipv4=ip_allocation.get("address") if ip_allocation else None,
            netbox_ip_id=ip_allocation.get("id") if ip_allocation else None,
            service_address=f"{customer.service_address_line1}, {customer.service_city}",
            metadata={
                "service_plan": service_plan,
                "provisioned_by": str(user_id) if user_id else None,
            },
        )

        self.db.add(subscriber)
        await self.db.flush()

        # 5. Create RADIUS authentication entries
        try:
            radius_payload = RADIUSSubscriberCreate(
                subscriber_id=subscriber_id,
                username=username,
                password=password,
                framed_ipv4_address=ip_allocation.get("address") if ip_allocation else None,
            )
            await radius_service.create_subscriber(radius_payload)
            logger.info("RADIUS authentication created", username=username)
        except Exception as e:
            logger.error("RADIUS creation failed", error=str(e))
            raise ValidationError(f"Failed to create RADIUS authentication: {e}")

        # 6. Provision ONU in VOLTHA (if ONU serial provided)
        voltha_status = None
        if onu_serial:
            try:
                voltha_status = await self.voltha_service.provision_onu(
                    onu_serial=onu_serial,
                    subscriber_id=subscriber_id,
                )
                subscriber.voltha_onu_id = voltha_status.get("onu_id")
                logger.info("ONU provisioned in VOLTHA", onu_serial=onu_serial)
            except Exception as e:
                logger.warning("VOLTHA ONU provisioning failed", error=str(e))

        # 7. Provision CPE in GenieACS (if MAC provided)
        genieacs_status = None
        if cpe_mac_address:
            try:
                genieacs_status = await self.genieacs_service.provision_cpe(
                    mac_address=cpe_mac_address,
                    subscriber_id=subscriber_id,
                    config={
                        "username": username,
                        "password": password,
                        "service_plan": service_plan,
                    },
                )
                subscriber.genieacs_device_id = genieacs_status.get("device_id")
                logger.info("CPE provisioned in GenieACS", mac=cpe_mac_address)
            except Exception as e:
                logger.warning("GenieACS CPE provisioning failed", error=str(e))

        # 8. Activate subscriber
        subscriber.status = SubscriberStatus.ACTIVE
        subscriber.activation_date = datetime.utcnow()

        await self.db.commit()
        await self.db.refresh(subscriber)

        # 9. Send notification to customer (if customer has user account)
        if customer.user_id:
            try:
                await self.notification_service.create_notification(
                    tenant_id=tenant_id,
                    user_id=customer.user_id,
                    notification_type=NotificationType.SUBSCRIBER_PROVISIONED,
                    title=f"Service Activated: {service_plan}",
                    message=f"Your internet service ({username}) has been successfully provisioned and activated. "
                    f"Your connection speed is {download_speed_kbps // 1000} Mbps down / {upload_speed_kbps // 1000} Mbps up."
                    + (f"\nIP Address: {ip_allocation.get('address')}" if ip_allocation else ""),
                    priority=NotificationPriority.HIGH,
                    action_url=f"/dashboard/services/{subscriber_id}",
                    action_label="View Service Details",
                    related_entity_type="subscriber",
                    related_entity_id=subscriber_id,
                    metadata={
                        "subscriber_id": subscriber_id,
                        "service_plan": service_plan,
                        "ip_address": ip_allocation.get("address") if ip_allocation else None,
                    },
                )
                logger.info("Provisioning notification sent", customer_id=str(customer_id))
            except Exception as e:
                logger.warning("Failed to send provisioning notification", error=str(e))

        logger.info(
            "Subscriber provisioning completed",
            tenant_id=tenant_id,
            subscriber_id=subscriber_id,
            customer_id=str(customer_id),
        )

        return {
            "subscriber": subscriber,
            "customer": customer,
            "ip_allocation": ip_allocation,
            "voltha_status": voltha_status,
            "genieacs_status": genieacs_status,
            "provisioning_date": datetime.utcnow(),
        }

    async def deprovision_subscriber(
        self,
        tenant_id: str,
        subscriber_id: str,
        reason: str,
        user_id: UUID | None = None,
    ) -> dict[str, Any]:
        """
        Deprovision a subscriber across all systems.

        Workflow:
        1. Terminate active RADIUS sessions
        2. Remove CPE from GenieACS
        3. Remove ONU from VOLTHA
        4. Release IP address in NetBox
        5. Remove RADIUS authentication
        6. Mark subscriber as terminated

        Args:
            tenant_id: Tenant identifier
            subscriber_id: Subscriber to deprovision
            reason: Reason for deprovisioning
            user_id: User performing deprovisioning

        Returns:
            Dictionary with deprovisioning status
        """
        logger.info(
            "Starting subscriber deprovisioning",
            tenant_id=tenant_id,
            subscriber_id=subscriber_id,
            reason=reason,
        )

        # 1. Get subscriber
        stmt = select(Subscriber).where(
            Subscriber.tenant_id == tenant_id, Subscriber.id == subscriber_id
        )
        result = await self.db.execute(stmt)
        subscriber = result.scalar_one_or_none()

        if not subscriber:
            raise NotFoundError(f"Subscriber {subscriber_id} not found")

        radius_service = self._get_radius_service(tenant_id)

        # 2. Terminate active RADIUS sessions
        session_termination = None
        try:
            session_termination = await radius_service.disconnect_session(
                username=subscriber.username
            )
            logger.info("RADIUS session terminated", username=subscriber.username)
        except Exception as e:
            logger.warning("RADIUS session termination failed", error=str(e))

        # 3. Remove CPE from GenieACS
        cpe_removal = None
        if subscriber.genieacs_device_id:
            try:
                cpe_removal = await self.genieacs_service.delete_device(
                    subscriber.genieacs_device_id
                )
                logger.info("CPE removed from GenieACS", device_id=subscriber.genieacs_device_id)
            except Exception as e:
                logger.warning("GenieACS CPE removal failed", error=str(e))

        # 4. Remove ONU from VOLTHA
        onu_removal = None
        if subscriber.voltha_onu_id:
            try:
                onu_removal = await self.voltha_service.delete_onu(subscriber.voltha_onu_id)
                logger.info("ONU removed from VOLTHA", onu_id=subscriber.voltha_onu_id)
            except Exception as e:
                logger.warning("VOLTHA ONU removal failed", error=str(e))

        # 5. Release IP address in NetBox
        ip_release = None
        if subscriber.netbox_ip_id:
            try:
                ip_release = await self.netbox_service.release_ip(subscriber.netbox_ip_id)
                logger.info("IP released in NetBox", ip_id=subscriber.netbox_ip_id)
            except Exception as e:
                logger.warning("NetBox IP release failed", error=str(e))

        # 6. Remove RADIUS authentication
        radius_deletion = None
        try:
            radius_deletion = await radius_service.delete_subscriber(subscriber.username)
            logger.info("RADIUS authentication removed", subscriber_id=subscriber_id)
        except Exception as e:
            logger.warning("RADIUS deletion failed", error=str(e))

        # 7. Mark subscriber as terminated
        subscriber.status = SubscriberStatus.TERMINATED
        subscriber.termination_date = datetime.utcnow()
        if subscriber.metadata_ is None:
            subscriber.metadata_ = {}
        subscriber.metadata_["termination_reason"] = reason
        subscriber.metadata_["deprovisioned_by"] = str(user_id) if user_id else None

        await self.db.commit()

        logger.info(
            "Subscriber deprovisioning completed",
            tenant_id=tenant_id,
            subscriber_id=subscriber_id,
        )

        return {
            "subscriber": subscriber,
            "session_termination": session_termination,
            "cpe_removal": cpe_removal,
            "onu_removal": onu_removal,
            "ip_release": ip_release,
            "radius_deletion": radius_deletion,
            "deprovisioning_date": datetime.utcnow(),
        }

    async def suspend_subscriber(
        self,
        tenant_id: str,
        subscriber_id: str,
        reason: str,
        user_id: UUID | None = None,
    ) -> dict[str, Any]:
        """
        Suspend a subscriber (temporary service interruption).

        Workflow:
        1. Disconnect active sessions
        2. Update RADIUS to deny authentication
        3. Mark subscriber as suspended

        Args:
            tenant_id: Tenant identifier
            subscriber_id: Subscriber to suspend
            reason: Reason for suspension
            user_id: User performing suspension

        Returns:
            Dictionary with suspension status
        """
        logger.info(
            "Starting subscriber suspension",
            tenant_id=tenant_id,
            subscriber_id=subscriber_id,
            reason=reason,
        )

        stmt = select(Subscriber).where(
            Subscriber.tenant_id == tenant_id, Subscriber.id == subscriber_id
        )
        result = await self.db.execute(stmt)
        subscriber = result.scalar_one_or_none()

        if not subscriber:
            raise NotFoundError(f"Subscriber {subscriber_id} not found")

        # Disconnect active sessions
        radius_service = self._get_radius_service(tenant_id)
        await radius_service.disconnect_session(username=subscriber.username)

        # Update RADIUS to deny authentication
        stmt = select(RadCheck).where(
            RadCheck.tenant_id == tenant_id,
            RadCheck.subscriber_id == subscriber_id,
            RadCheck.attribute == "Cleartext-Password",
        )
        result = await self.db.execute(stmt)
        radcheck = result.scalar_one_or_none()

        if radcheck:
            radcheck.attribute = "Auth-Type"
            radcheck.value = "Reject"

        # Mark as suspended
        subscriber.status = SubscriberStatus.SUSPENDED
        subscriber.suspension_date = datetime.utcnow()
        if subscriber.metadata_ is None:
            subscriber.metadata_ = {}
        subscriber.metadata_["suspension_reason"] = reason

        await self.db.commit()

        logger.info("Subscriber suspended", tenant_id=tenant_id, subscriber_id=subscriber_id)

        return {
            "subscriber": subscriber,
            "suspension_date": datetime.utcnow(),
            "reason": reason,
        }

    async def reactivate_subscriber(
        self,
        tenant_id: str,
        subscriber_id: str,
        user_id: UUID | None = None,
    ) -> dict[str, Any]:
        """
        Reactivate a suspended subscriber.

        Workflow:
        1. Restore RADIUS authentication
        2. Mark subscriber as active
        3. Clear suspension metadata

        Args:
            tenant_id: Tenant identifier
            subscriber_id: Subscriber to reactivate
            user_id: User performing reactivation

        Returns:
            Dictionary with reactivation status
        """
        logger.info(
            "Starting subscriber reactivation", tenant_id=tenant_id, subscriber_id=subscriber_id
        )

        stmt = select(Subscriber).where(
            Subscriber.tenant_id == tenant_id, Subscriber.id == subscriber_id
        )
        result = await self.db.execute(stmt)
        subscriber = result.scalar_one_or_none()

        if not subscriber:
            raise NotFoundError(f"Subscriber {subscriber_id} not found")

        if subscriber.status != SubscriberStatus.SUSPENDED:
            raise ValidationError(
                f"Subscriber must be suspended to reactivate, not {subscriber.status}"
            )

        # Restore RADIUS authentication
        stmt = select(RadCheck).where(
            RadCheck.tenant_id == tenant_id,
            RadCheck.subscriber_id == subscriber_id,
            RadCheck.attribute == "Auth-Type",
        )
        result = await self.db.execute(stmt)
        radcheck = result.scalar_one_or_none()

        if radcheck:
            radcheck.attribute = "Cleartext-Password"
            radcheck.value = subscriber.password

        # Mark as active
        subscriber.status = SubscriberStatus.ACTIVE
        subscriber.suspension_date = None
        if subscriber.metadata_ and "suspension_reason" in subscriber.metadata_:
            del subscriber.metadata_["suspension_reason"]
        if subscriber.metadata_ is None:
            subscriber.metadata_ = {}
        subscriber.metadata_["reactivated_at"] = datetime.utcnow().isoformat()

        await self.db.commit()

        logger.info("Subscriber reactivated", tenant_id=tenant_id, subscriber_id=subscriber_id)

        return {
            "subscriber": subscriber,
            "reactivation_date": datetime.utcnow(),
        }
