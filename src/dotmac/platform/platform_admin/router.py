"""
Platform Admin Main Router

Aggregates all platform admin endpoints for cross-tenant administration.
All endpoints require platform.admin permission.

Mounted at: /api/v1/platform/*
"""

from fastapi import APIRouter

from .analytics_router import router as analytics_router
from .audit_router import router as audit_router
from .billing_router import router as billing_router

# Create main platform admin router
router = APIRouter(
    prefix="/platform",
    tags=["Platform Administration"],
)

# Include sub-routers
router.include_router(billing_router)
router.include_router(analytics_router)
router.include_router(audit_router)

__all__ = ["router"]
