"""
GenieACS Integration Module

This module provides integration with GenieACS for CPE (Customer Premises Equipment)
management using TR-069/CWMP protocol.

Stack Placement: ISP-ONLY
-------------------------
This module is deployed ONLY in the ISP tenant stack (docker-compose.isp.yml).
It should NOT be included in the platform admin stack. Each ISP tenant gets
their own GenieACS instance for managing customer routers/ONTs via TR-069.

Maturity: Production (~85%)
---------------------------
- Device discovery and parameter management: Complete
- Firmware upgrades and mass configuration: Complete
- Scheduled jobs and job tracking: Database-backed (PostgreSQL)
- Celery workers for async execution with progress updates
- Redis pub/sub for real-time progress notifications

Components:
- client: GenieACS NBI (Northbound Interface) API client
- schemas: Pydantic schemas for GenieACS entities
- models: SQLAlchemy models for firmware schedules and mass config jobs
- service: In-memory service (for testing/fallback)
- service_db: Production database-backed service layer (ACTIVE)
- router: FastAPI endpoints using GenieACSServiceDB
- tasks: Celery tasks for background firmware upgrades and mass config
- metrics: Prometheus metrics for monitoring job status

Database Tables:
- firmware_upgrade_schedules: Scheduled firmware upgrade jobs
- firmware_upgrade_results: Per-device results for firmware upgrades
- mass_config_jobs: Mass configuration jobs
- mass_config_results: Per-device results for mass config

Migration: alembic/versions/2025_10_14_2227-add_genieacs_schedules_jobs.py
"""

from dotmac.platform.genieacs.router import router

__all__ = ["router"]
