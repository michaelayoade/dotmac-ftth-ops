"""Tests for project management models."""

from datetime import UTC, datetime
from uuid import uuid4

import pytest

pytestmark = pytest.mark.unit


def test_project_model_creation():
    """Test basic Project model instantiation."""
    from dotmac.platform.project_management.models import Project

    project = Project(
        id=uuid4(),
        tenant_id=uuid4(),
        name="Network Expansion Project",
        description="Expand fiber network to new area",
        status="planning",
        start_date=datetime.now(UTC),
    )

    assert project.name == "Network Expansion Project"
    assert project.status == "planning"


def test_task_model_creation():
    """Test basic Task model instantiation."""
    from dotmac.platform.project_management.models import Task

    task = Task(
        id=uuid4(),
        tenant_id=uuid4(),
        project_id=uuid4(),
        title="Design network topology",
        description="Create detailed network design",
        status="pending",
        priority="high",
    )

    assert task.title == "Design network topology"
    assert task.priority == "high"
    assert task.status == "pending"
