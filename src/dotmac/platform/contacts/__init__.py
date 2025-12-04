"""
Contact Management System

A flexible contact system supporting multiple contact methods,
configurable labels, and custom fields.
"""

from .models import (
    Contact,
    ContactFieldDefinition,
    ContactFieldType,
    ContactLabelDefinition,
    ContactMethod,
    ContactMethodType,
    ContactStage,
    ContactStatus,
)

__all__ = [
    "Contact",
    "ContactMethod",
    "ContactMethodType",
    "ContactLabelDefinition",
    "ContactFieldDefinition",
    "ContactFieldType",
    "ContactStage",
    "ContactStatus",
]
