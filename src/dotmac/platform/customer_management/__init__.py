"""
Customer Management Module for DotMac Platform Services.

This module provides comprehensive customer relationship management capabilities including:
- Customer profile management with rich metadata
- Customer segmentation and categorization
- Activity tracking and timeline
- Communication preferences
- Customer lifecycle management
- Integration with auth and billing systems
"""

from dotmac.platform.customer_management.models import (
    Customer,
    CustomerActivity,
    CustomerNote,
    CustomerSegment,
    CustomerTag,
)
from dotmac.platform.customer_management.router import router as customer_router
from dotmac.platform.customer_management.service import CustomerService

__all__ = [
    "Customer",
    "CustomerSegment",
    "CustomerActivity",
    "CustomerNote",
    "CustomerTag",
    "CustomerService",
    "customer_router",
]
