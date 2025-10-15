"""Ansible/AWX Pydantic Schemas"""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class JobTemplate(BaseModel):  # BaseModel resolves to Any in isolation
    """Job template information"""

    id: int
    name: str
    description: str | None = None
    job_type: str | None = None
    inventory: int | None = None
    project: int | None = None
    playbook: str | None = None

    model_config = ConfigDict(from_attributes=True)


class Job(BaseModel):  # BaseModel resolves to Any in isolation
    """Job execution information"""

    id: int
    name: str
    status: str
    created: datetime
    started: datetime | None = None
    finished: datetime | None = None
    elapsed: float | None = None

    model_config = ConfigDict(from_attributes=True)


class JobLaunchRequest(BaseModel):  # BaseModel resolves to Any in isolation
    """Launch job template request"""

    model_config = ConfigDict()

    template_id: int = Field(..., description="Job template ID")
    extra_vars: dict[str, Any] | None = Field(None, description="Extra variables")


class JobLaunchResponse(BaseModel):  # BaseModel resolves to Any in isolation
    """Job launch response"""

    model_config = ConfigDict()

    job_id: int
    status: str
    message: str


class AWXHealthResponse(BaseModel):  # BaseModel resolves to Any in isolation
    """AWX health check response"""

    model_config = ConfigDict()

    healthy: bool
    message: str
    total_templates: int | None = None
