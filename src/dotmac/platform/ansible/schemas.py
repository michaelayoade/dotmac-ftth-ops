"""Ansible/AWX Pydantic Schemas"""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class JobTemplate(BaseModel):
    """Job template information"""

    id: int
    name: str
    description: str | None = None
    job_type: str | None = None
    inventory: int | None = None
    project: int | None = None
    playbook: str | None = None

    model_config = {"from_attributes": True}


class Job(BaseModel):
    """Job execution information"""

    id: int
    name: str
    status: str
    created: datetime
    started: datetime | None = None
    finished: datetime | None = None
    elapsed: float | None = None

    model_config = {"from_attributes": True}


class JobLaunchRequest(BaseModel):
    """Launch job template request"""

    template_id: int = Field(..., description="Job template ID")
    extra_vars: dict[str, Any] | None = Field(None, description="Extra variables")


class JobLaunchResponse(BaseModel):
    """Job launch response"""

    job_id: int
    status: str
    message: str


class AWXHealthResponse(BaseModel):
    """AWX health check response"""

    healthy: bool
    message: str
    total_templates: int | None = None
