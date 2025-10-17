"""
Adapter Factory

Factory for creating deployment adapters based on backend type.
"""

from typing import Optional

from ..models import DeploymentBackend
from .awx import AWXAdapter
from .base import DeploymentAdapter
from .docker_compose import DockerComposeAdapter
from .kubernetes import KubernetesAdapter


class AdapterFactory:
    """Factory for creating deployment adapters"""

    @staticmethod
    def create_adapter(backend: DeploymentBackend, config: Optional[dict] = None) -> DeploymentAdapter:
        """
        Create deployment adapter for specified backend

        Args:
            backend: Deployment backend type
            config: Backend-specific configuration

        Returns:
            Configured deployment adapter

        Raises:
            ValueError: If backend type is not supported
        """
        adapters = {
            DeploymentBackend.KUBERNETES: KubernetesAdapter,
            DeploymentBackend.AWX_ANSIBLE: AWXAdapter,
            DeploymentBackend.DOCKER_COMPOSE: DockerComposeAdapter,
        }

        adapter_class = adapters.get(backend)
        if not adapter_class:
            raise ValueError(f"Unsupported deployment backend: {backend}")

        return adapter_class(config)
