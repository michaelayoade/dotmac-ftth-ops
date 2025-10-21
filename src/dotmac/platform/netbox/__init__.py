"""
NetBox Integration Module

This module provides integration with NetBox for IPAM (IP Address Management)
and DCIM (Data Center Infrastructure Management).

Components:
- client: NetBox API client wrapper
- schemas: Pydantic schemas for NetBox entities
- service: Business logic for NetBox operations
- router: FastAPI endpoints for NetBox management
"""

from dotmac.platform.netbox.router import router

__all__ = ["router"]
