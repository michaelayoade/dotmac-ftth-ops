"""
RADIUS Management Module

This module provides integration with FreeRADIUS for ISP subscriber authentication,
authorization, and accounting (AAA).

Components:
- models: SQLAlchemy models for RADIUS tables (radcheck, radreply, radacct, nas)
- schemas: Pydantic schemas for API request/response
- repository: Database operations for RADIUS entities
- service: Business logic for RADIUS operations
- router: FastAPI endpoints for RADIUS management
"""

from dotmac.platform.radius.router import router

__all__ = ["router"]
