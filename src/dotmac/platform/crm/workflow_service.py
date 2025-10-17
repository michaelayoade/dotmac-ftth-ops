"""
CRM Workflow Service

Provides workflow-compatible methods for CRM operations.
This wraps the existing LeadService, QuoteService, and SiteSurveyService
to provide methods that match workflow requirements.
"""

from decimal import Decimal
from typing import Any, Dict
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

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
    ) -> Dict[str, Any]:
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
        accepted_by_uuid = UUID(str(accepted_by)) if accepted_by and not isinstance(accepted_by, UUID) else accepted_by

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
    ) -> Dict[str, Any]:
        """
        Create a renewal quote for existing customer.

        Args:
            customer_id: Customer ID
            subscription_id: Subscription ID to renew
            renewal_term: Renewal term in months

        Returns:
            Dict with quote details including quote_id and amount
        """
        import logging
        from datetime import datetime, timedelta

        logger = logging.getLogger(__name__)

        # This is a stub implementation that allows workflows to execute
        # TODO: Implement actual renewal quote logic when needed

        logger.info(
            f"[STUB] Creating renewal quote for customer {customer_id}, "
            f"subscription {subscription_id}, term {renewal_term} months"
        )

        # Return realistic stub data
        return {
            "quote_id": f"stub-quote-{customer_id}-{subscription_id}",
            "amount": Decimal("99.00") * renewal_term,  # Placeholder pricing
            "customer_id": customer_id,
            "subscription_id": subscription_id,
            "renewal_term": renewal_term,
            "valid_until": (datetime.utcnow() + timedelta(days=30)).isoformat(),
            "status": "draft",
        }

    async def get_site_survey(
        self,
        customer_id: int | str,
    ) -> Dict[str, Any]:
        """
        Get completed site survey for customer.

        Args:
            customer_id: Customer ID

        Returns:
            Dict with site survey details
        """
        # Site surveys are associated with leads, not customers directly
        # We need to find the lead associated with this customer

        from sqlalchemy import select
        from .models import SiteSurvey, SiteSurveyStatus, Lead
        from ..customer_management.models import Customer

        # Find customer's associated lead (via email or other identifier)
        customer_stmt = select(Customer).where(Customer.id == int(customer_id))
        customer_result = await self.db.execute(customer_stmt)
        customer = customer_result.scalar_one_or_none()

        if not customer:
            raise ValueError(f"Customer {customer_id} not found")

        # Find lead by email
        lead_stmt = select(Lead).where(Lead.email == customer.email)
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
            .where(
                SiteSurvey.lead_id == lead.id,
                SiteSurvey.status == SiteSurveyStatus.COMPLETED
            )
            .order_by(SiteSurvey.completed_at.desc())
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
            "completed_at": survey.completed_at.isoformat() if survey.completed_at else None,
            "data": survey.survey_data or {},
            "serviceability": survey.serviceability.value if survey.serviceability else None,
            "notes": survey.notes,
        }
