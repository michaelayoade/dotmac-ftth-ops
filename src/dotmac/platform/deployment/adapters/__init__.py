"""
Deployment Execution Adapters

Pluggable adapters for different deployment backends:
- Kubernetes/Helm
- AWX/Ansible
- Docker Compose
- Terraform
"""

from .base import DeploymentAdapter, DeploymentResult, ExecutionContext
from .kubernetes import KubernetesAdapter
from .awx import AWXAdapter
from .docker_compose import DockerComposeAdapter
from .factory import AdapterFactory

__all__ = [
    "DeploymentAdapter",
    "DeploymentResult",
    "ExecutionContext",
    "KubernetesAdapter",
    "AWXAdapter",
    "DockerComposeAdapter",
    "AdapterFactory",
]
