"""
Jobs Module

Generic job tracking and management for async operations.
Enhanced with scheduling and job chain capabilities.
"""

# Import handlers to register event subscriptions
from dotmac.platform.jobs import handlers  # noqa: F401
from dotmac.platform.jobs.decorators import (
    background_job,
    job_chain,
    retry_on_failure,
    scheduled_job,
)
from dotmac.platform.jobs.models import (
    Job,
    JobChain,
    JobExecutionMode,
    JobPriority,
    JobStatus,
    JobType,
    ScheduledJob,
)
from dotmac.platform.jobs.scheduler_service import SchedulerService
from dotmac.platform.jobs.schemas import (
    JobCancelResponse,
    JobCreate,
    JobListResponse,
    JobResponse,
    JobRetryResponse,
    JobStatistics,
    JobSummary,
    JobUpdate,
)
from dotmac.platform.jobs.service import JobService

__all__ = [
    # Models
    "Job",
    "JobStatus",
    "JobType",
    "JobPriority",
    "JobExecutionMode",
    "ScheduledJob",
    "JobChain",
    # Schemas
    "JobCreate",
    "JobUpdate",
    "JobResponse",
    "JobSummary",
    "JobListResponse",
    "JobCancelResponse",
    "JobRetryResponse",
    "JobStatistics",
    # Services
    "JobService",
    "SchedulerService",
    # Decorators
    "background_job",
    "scheduled_job",
    "job_chain",
    "retry_on_failure",
]
