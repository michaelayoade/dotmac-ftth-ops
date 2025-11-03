"""
CRM Workflow Service

Provides workflow-compatible methods for CRM operations.
This wraps the existing LeadService, QuoteService, and SiteSurveyService
to provide methods that match workflow requirements.
"""

from decimal import Decimal
from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from ..billing.subscriptions.service import SubscriptionService

from .service import LeadService, QuoteService, SiteSurveyService


class CRMService:
    """
    Unified CRM service for workflow integration.

    Combines LeadService, QuoteService, and SiteSurveyService with
    workflow-compatible method signatures.
    """

    def __init__(self, db: AsyncSession):
        self.db = db
        self.lead_service = LeadService(db)
        self.quote_service = QuoteService(db)
        self.survey_service = SiteSurveyService(db)

    async def accept_quote(
        self,
        quote_id: int | str,
        accepted_by: int | str | None = None,
    ) -> dict[str, Any]:
        """
        Accept a quote (workflow-compatible).

        Args:
            quote_id: Quote ID (can be int or UUID string)
            accepted_by: User ID who accepted (optional)

        Returns:
            Dict with quote details
        """
        # Convert to UUID if needed
        if isinstance(quote_id, int):
            # For workflow compatibility, assume quote_id is actually a UUID string
            # In production, you'd have a mapping or use consistent IDs
            raise ValueError("Quote ID must be UUID string, not int. Check workflow context.")

        quote_uuid = UUID(str(quote_id)) if not isinstance(quote_id, UUID) else quote_id
        if accepted_by is None:
            accepted_by_uuid: UUID | None = None
        elif isinstance(accepted_by, UUID):
            accepted_by_uuid = accepted_by
        else:
            accepted_by_uuid = UUID(str(accepted_by))

        # Get tenant_id from quote (in a real scenario, this would come from context)
        # For now, we'll need to fetch the quote first to get tenant_id
        from sqlalchemy import select

        from .models import Quote

        stmt = select(Quote).where(Quote.id == quote_uuid)
        result = await self.db.execute(stmt)
        existing_quote = result.scalar_one_or_none()

        if not existing_quote:
            raise ValueError(f"Quote {quote_id} not found")

        # Accept the quote
        quote = await self.quote_service.accept_quote(
            tenant_id=existing_quote.tenant_id,
            quote_id=quote_uuid,
            signature_data={"accepted_by": str(accepted_by) if accepted_by else "workflow"},
            updated_by_id=accepted_by_uuid,
        )

        return {
            "quote_id": str(quote.id),
            "status": quote.status.value,
            "lead_id": str(quote.lead_id),
            "accepted_at": quote.accepted_at.isoformat() if quote.accepted_at else None,
        }

    async def create_renewal_quote(
        self,
        customer_id: int | str,
        subscription_id: int | str,
        renewal_term: int,
        tenant_id: str | None = None,
        discount_percentage: Decimal | None = None,
        notes: str | None = None,
    ) -> dict[str, Any]:
        """
        Create a renewal quote for existing customer.

        This method creates a formal quote for subscription renewal using the
        QuoteService. It fetches the subscription details, calculates renewal
        pricing, and generates a quote that can be accepted to process renewal.

        Args:
            customer_id: Customer ID (UUID or integer)
            subscription_id: Subscription ID to renew (UUID or integer)
            renewal_term: Renewal term in months (typically 12, 24, or 36)
            tenant_id: Tenant ID (required if customer_id is not UUID)
            discount_percentage: Optional renewal discount (0-100)
            notes: Additional notes for the quote

        Returns:
            Dict with quote details:
            {
                "quote_id": str,  # Quote UUID
                "quote_number": str,  # Human-readable quote number
                "amount": str,  # Monthly recurring charge (as Decimal string)
                "customer_id": str,  # Customer UUID
                "subscription_id": str,  # Subscription UUID
                "renewal_term": int,  # Contract term in months
                "valid_until": str,  # ISO timestamp
                "status": str,  # Quote status (draft/sent/accepted)
                "total_contract_value": str,  # Total value over contract term
                "discount_percentage": str,  # Applied discount if any
                "line_items": list,  # Quote line items
            }

        Raises:
            ValueError: If customer or subscription not found
            RuntimeError: If quote creation fails
        """
        import logging

        logger = logging.getLogger(__name__)

        logger.info(
            f"Creating renewal quote for customer {customer_id}, "
            f"subscription {subscription_id}, term {renewal_term} months"
        )

        # Convert IDs to UUIDs
        try:
            customer_uuid = (
                UUID(str(customer_id)) if not isinstance(customer_id, UUID) else customer_id
            )
            subscription_uuid = (
                UUID(str(subscription_id))
                if not isinstance(subscription_id, UUID)
                else subscription_id
            )
        except (ValueError, AttributeError) as e:
            raise ValueError(f"Invalid ID format: {e}") from e

        try:
            # Fetch subscription details
            from sqlalchemy import select
            from ..billing.subscriptions.models import Subscription, SubscriptionPlan
            from ..customer_management.models import Customer

            # Get customer to determine tenant_id if not provided
            if not tenant_id:
                customer_stmt = select(Customer).where(Customer.id == customer_uuid)
                customer_result = await self.db.execute(customer_stmt)
                customer = customer_result.scalar_one_or_none()

                if not customer:
                    raise ValueError(f"Customer {customer_id} not found")

                tenant_id = customer.tenant_id

            subscription_service = SubscriptionService(self.db)
            subscription: Subscription = await subscription_service.get_subscription(
                str(subscription_uuid), tenant_id
            )
            plan: SubscriptionPlan = await subscription_service.get_plan(
                subscription.plan_id, tenant_id
            )

            subscription_identifier = subscription.subscription_id

            amount_value: Decimal | None = (
                subscription.custom_price if subscription.custom_price is not None else plan.price
            )

            subscription_metadata = subscription.metadata or {}
            plan_metadata = plan.metadata or {}

            billing_cycle_value = str(plan.billing_cycle.value)

            # Build subscription data for quote
            plan_name = (
                plan.name or subscription_metadata.get("plan_name") or "Service Plan"
            )
            bandwidth = subscription_metadata.get(
                "bandwidth", plan_metadata.get("bandwidth", "N/A")
            )
            service_plan_speed = subscription_metadata.get(
                "service_plan_speed", plan_metadata.get("service_plan_speed")
            )

            subscription_data = {
                "subscription_id": str(subscription_identifier),
                "plan_name": plan_name,
                "bandwidth": bandwidth,
                "amount": float(amount_value) if amount_value is not None else 0.0,
                "renewal_price": float(amount_value) if amount_value is not None else 0.0,
                "billing_cycle": billing_cycle_value,
                "contract_term_months": renewal_term,
                "service_plan_speed": service_plan_speed,
            }

            # Create renewal quote using QuoteService
            quote = await self.quote_service.create_renewal_quote(
                tenant_id=tenant_id,
                customer_id=customer_uuid,
                subscription_data=subscription_data,
                valid_days=30,  # Quote valid for 30 days
                discount_percentage=discount_percentage,
                notes=notes,
                created_by_id=None,  # System-generated
            )

            # Calculate total contract value
            monthly_amount = quote.monthly_recurring_charge
            total_contract_value = monthly_amount * renewal_term

            logger.info(
                f"Renewal quote created successfully: {quote.quote_number} "
                f"(ID: {quote.id}) for customer {customer_id}"
            )

            # Return workflow-compatible response
            return {
                "quote_id": str(quote.id),
                "quote_number": quote.quote_number,
                "amount": str(monthly_amount),
                "customer_id": str(customer_uuid),
                "subscription_id": str(subscription_uuid),
                "renewal_term": renewal_term,
                "valid_until": quote.valid_until.isoformat() if quote.valid_until else None,
                "status": quote.status.value,
                "total_contract_value": str(total_contract_value),
                "discount_percentage": str(discount_percentage) if discount_percentage else None,
                "line_items": quote.line_items or [],
                "service_plan_name": quote.service_plan_name,
                "bandwidth": quote.bandwidth,
                "contract_term_months": quote.contract_term_months,
                "metadata": quote.metadata,
            }

        except ValueError:
            raise
        except Exception as e:
            logger.error(f"Error creating renewal quote: {e}", exc_info=True)
            raise RuntimeError(f"Failed to create renewal quote: {e}") from e

    async def get_site_survey(
        self,
        customer_id: int | str,
    ) -> dict[str, Any]:
        """
        Get completed site survey for customer.

        Args:
            customer_id: Customer ID

        Returns:
            Dict with site survey details
        """
        # Site surveys are associated with leads, not customers directly
        # We need to find the lead associated with this customer

        from uuid import UUID

        from sqlalchemy import select

        from ..customer_management.models import Customer
        from .models import Lead, SiteSurvey, SiteSurveyStatus

        # Find customer's associated lead (via email or other identifier)
        # Convert customer_id to UUID safely
        try:
            customer_uuid = UUID(str(customer_id))
        except (ValueError, AttributeError) as e:
            raise ValueError(f"Invalid customer ID format: {customer_id}") from e

        customer_stmt = select(Customer).where(Customer.id == customer_uuid)
        customer_result = await self.db.execute(customer_stmt)
        customer = customer_result.scalar_one_or_none()

        if not customer:
            raise ValueError(f"Customer {customer_id} not found")

        # Find lead by email with tenant isolation
        lead_stmt = select(Lead).where(
            Lead.email == customer.email, Lead.tenant_id == customer.tenant_id
        )
        lead_result = await self.db.execute(lead_stmt)
        lead = lead_result.scalar_one_or_none()

        if not lead:
            # No lead found, return empty survey data
            return {
                "survey_id": None,
                "status": "not_found",
                "completed": False,
                "data": {},
            }

        # Get the most recent completed survey for this lead
        survey_stmt = (
            select(SiteSurvey)
            .where(SiteSurvey.lead_id == lead.id, SiteSurvey.status == SiteSurveyStatus.COMPLETED)
            .order_by(SiteSurvey.completed_date.desc())
        )
        survey_result = await self.db.execute(survey_stmt)
        survey = survey_result.scalar_one_or_none()

        if not survey:
            return {
                "survey_id": None,
                "status": "not_completed",
                "completed": False,
                "data": {},
            }

        return {
            "survey_id": str(survey.id),
            "status": survey.status.value,
            "completed": True,
            "scheduled_date": survey.scheduled_date.isoformat() if survey.scheduled_date else None,
            "completed_at": survey.completed_date.isoformat() if survey.completed_date else None,
            "data": survey.survey_data or {},
            "serviceability": survey.serviceability.value if survey.serviceability else None,
            "notes": survey.notes,
        }
