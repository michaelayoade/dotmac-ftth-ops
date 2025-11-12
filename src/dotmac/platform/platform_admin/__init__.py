"""
Platform Admin Module

Cross-tenant administration endpoints for platform administrators.
All endpoints in this module require platform.admin permission.
"""

__all__ = ["router"]

from .router import router
