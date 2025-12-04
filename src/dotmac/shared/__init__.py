"""
DotMac Shared Library.

This package contains shared code used by all DotMac services:
- controlplane: Platform administration service
- isp: ISP operations service
- bootstrap: One-time bootstrap job
- worker: Celery background workers

Modules:
- routers: Declarative router registry
- db: Database primitives and tenant base
- auth: Authentication models and dependencies
- settings: Base settings and role profiles
- tasks: Celery task utilities with tenant context
"""

__version__ = "1.0.0"
