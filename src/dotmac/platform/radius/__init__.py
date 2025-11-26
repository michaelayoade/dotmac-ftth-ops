"""
RADIUS Management Module

This module provides integration with FreeRADIUS for ISP subscriber authentication,
authorization, and accounting (AAA).

Stack Placement: ISP-ONLY
-------------------------
This module is deployed ONLY in the ISP tenant stack (docker-compose.isp.yml).
It should NOT be included in the platform admin stack. Each ISP tenant gets
their own isolated RADIUS instance for subscriber authentication.

Maturity: Production (~85%)
---------------------------
- Multi-vendor support (Mikrotik, Cisco, Huawei, Juniper)
- CoA (Change of Authorization) for session management
- Bandwidth profiles and usage analytics
- Ready for production ISP deployments

Components:
- models: SQLAlchemy models for RADIUS tables (radcheck, radreply, radacct, nas)
- schemas: Pydantic schemas for API request/response
- repository: Database operations for RADIUS entities
- service: Business logic for RADIUS operations
- router: FastAPI endpoints for RADIUS management
- vendors/: Multi-vendor strategy pattern for NAS-specific attributes
"""

from dotmac.platform.radius.router import router

__all__ = ["router"]
