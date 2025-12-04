"""
Project Management Module

Comprehensive project and task management for field service operations.
"""

import os

# Import models to ensure they're registered with SQLAlchemy
# Import models first (contains Task, Project, Team tables)
# Then import scheduling models (contains TechnicianSchedule, TaskAssignment)
from . import (
    models,  # noqa: F401
    scheduling_models,  # noqa: F401
)

# Import event handlers to ensure they're registered with @subscribe decorator
# Skip during migrations to avoid side effects
if os.environ.get("DOTMAC_MIGRATIONS") != "1":
    from . import event_handlers  # noqa: F401
