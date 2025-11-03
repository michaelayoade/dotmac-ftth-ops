"""
Adapter Factory

Factory for creating deployment adapters based on backend type.
"""

from collections.abc import Mapping
from typing import Any

from ..models import DeploymentBackend
from .awx import AWXAdapter
from .base import DeploymentAdapter
from .docker_compose import DockerComposeAdapter
from .kubernetes import KubernetesAdapter

AdapterMapping = Mapping[DeploymentBackend, type[DeploymentAdapter]]


class AdapterFactory:
    """Factory for creating deployment adapters"""

    _ADAPTERS: AdapterMapping = {
        DeploymentBackend.KUBERNETES: KubernetesAdapter,
        DeploymentBackend.AWX_ANSIBLE: AWXAdapter,
        DeploymentBackend.DOCKER_COMPOSE: DockerComposeAdapter,
    }

    @staticmethod
    def create_adapter(
        backend: DeploymentBackend,
        config: dict[str, Any] | None = None,
    ) -> DeploymentAdapter:
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
        adapter_class = AdapterFactory._ADAPTERS.get(backend)
        if not adapter_class:
            raise ValueError(f"Unsupported deployment backend: {backend}")

        return adapter_class(config)
