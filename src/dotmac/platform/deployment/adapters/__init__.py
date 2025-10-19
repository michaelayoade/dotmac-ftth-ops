"""
Deployment Execution Adapters

Pluggable adapters for different deployment backends:
- Kubernetes/Helm
- AWX/Ansible
- Docker Compose
- Terraform
"""

from .awx import AWXAdapter
from .base import DeploymentAdapter, DeploymentResult, ExecutionContext
from .docker_compose import DockerComposeAdapter
from .factory import AdapterFactory
from .kubernetes import KubernetesAdapter

__all__ = [
    "DeploymentAdapter",
    "DeploymentResult",
    "ExecutionContext",
    "KubernetesAdapter",
    "AWXAdapter",
    "DockerComposeAdapter",
    "AdapterFactory",
]
