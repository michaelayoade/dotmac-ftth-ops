"""
VOLTHA Integration Module

This module provides integration with VOLTHA (Virtual OLT Hardware Abstraction)
for managing PON (Passive Optical Network) infrastructure.

Stack Placement: ISP-ONLY
-------------------------
This module is deployed ONLY in the ISP tenant stack (docker-compose.isp.yml).
It should NOT be included in the platform admin stack. Each ISP tenant manages
their own PON infrastructure through VOLTHA.

Maturity: Beta (~80%)
---------------------
- ONU discovery and provisioning: Complete
- OLT management (enable/disable/reboot): Complete
- VLAN flow configuration (802.1q and QinQ): Complete
- Bandwidth profiles and meters: Complete
- Alarm management: Complete
- Config backup/restore: Complete
- Needs real-world VOLTHA cluster testing

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
