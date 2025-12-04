"""
Project Management Module

Comprehensive project and task management for field service operations.
"""

# Import models to ensure they're registered with SQLAlchemy
# Import models first (contains Task, Project, Team tables)
# Then import scheduling models (contains TechnicianSchedule, TaskAssignment)
# Import event handlers to ensure they're registered with @subscribe decorator
from . import (
    event_handlers,  # noqa: F401
    models,  # noqa: F401
    scheduling_models,  # noqa: F401
)
