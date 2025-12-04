"""
Ansible/AWX Integration Module

This module provides integration with Ansible AWX for infrastructure automation.

AWX (Ansible Tower) provides:
- Job template execution
- Inventory management
- Playbook orchestration
- Automation workflows

Components:
- client: AWX REST API client wrapper
- schemas: Pydantic schemas for AWX entities
- service: Business logic for automation operations
- router: FastAPI endpoints for AWX management
"""

from dotmac.platform.ansible.router import router

__all__ = ["router"]
