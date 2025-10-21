"""
CRM (Customer Relationship Management) Module.

Manages leads, quotes, and site surveys for the sales pipeline.
"""

from dotmac.platform.crm.models import (
    Lead,
    LeadSource,
    LeadStatus,
    Quote,
    QuoteStatus,
    Serviceability,
    SiteSurvey,
    SiteSurveyStatus,
)
from dotmac.platform.crm.service import LeadService, QuoteService, SiteSurveyService

__all__ = [
    # Models
    "Lead",
    "LeadStatus",
    "LeadSource",
    "Quote",
    "QuoteStatus",
    "SiteSurvey",
    "SiteSurveyStatus",
    "Serviceability",
    # Services
    "LeadService",
    "QuoteService",
    "SiteSurveyService",
]
