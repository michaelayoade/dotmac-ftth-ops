"""
GenieACS Integration Module

This module provides integration with GenieACS for CPE (Customer Premises Equipment)
management using TR-069/CWMP protocol.

Components:
- client: GenieACS NBI (Northbound Interface) API client
- schemas: Pydantic schemas for GenieACS entities
- service: Business logic for CPE management
- router: FastAPI endpoints for GenieACS operations
"""

from dotmac.platform.genieacs.router import router

__all__ = ["router"]
