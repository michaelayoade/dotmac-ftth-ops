"""
VOLTHA Integration Module

This module provides integration with VOLTHA (Virtual OLT Hardware Abstraction)
for managing PON (Passive Optical Network) infrastructure.

VOLTHA abstracts OLT hardware and provides unified APIs for:
- Device management (OLTs, ONUs)
- Flow management
- Port management
- Alarm monitoring

Components:
- client: VOLTHA gRPC/REST client wrapper
- schemas: Pydantic schemas for VOLTHA entities
- service: Business logic for PON management
- router: FastAPI endpoints for VOLTHA operations
"""

from dotmac.platform.voltha.router import router

__all__ = ["router"]
