"""Tests for project management models."""

from datetime import UTC, datetime
from uuid import uuid4

import pytest

from dotmac.platform.project_management.models import (
    Project,
    ProjectStatus,
    ProjectType,
    Task,
    TaskPriority,
    TaskStatus,
    TaskType,
)

pytestmark = pytest.mark.unit


def test_project_model_creation():
    """Test basic Project model instantiation."""
    project = Project(
        id=uuid4(),
        tenant_id=str(uuid4()),
        project_number="PRJ-001",
        name="Network Expansion Project",
        description="Expand fiber network to new area",
        project_type=ProjectType.INSTALLATION,
        status=ProjectStatus.PLANNED,
        scheduled_start=datetime.now(UTC),
    )

    assert project.name == "Network Expansion Project"
    assert project.status == ProjectStatus.PLANNED


def test_task_model_creation():
    """Test basic Task model instantiation."""
    task = Task(
        id=uuid4(),
        tenant_id=str(uuid4()),
        project_id=uuid4(),
        task_number="TSK-001",
        name="Design network topology",
        description="Create detailed network design",
        task_type=TaskType.PLANNING,
        status=TaskStatus.PENDING,
        priority=TaskPriority.HIGH,
    )

    assert task.name == "Design network topology"
    assert task.priority == TaskPriority.HIGH
    assert task.status == TaskStatus.PENDING
