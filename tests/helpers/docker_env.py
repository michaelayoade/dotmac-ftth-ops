"""
Docker Environment Detection Utilities

Helper functions to detect if tests are running inside a Docker container
and provide appropriate connection parameters for Docker services.
"""

import os
from pathlib import Path


def is_running_in_docker() -> bool:
    """
    Detect if the current process is running inside a Docker container.

    Checks multiple indicators:
    - /.dockerenv file (created by Docker)
    - /proc/1/cgroup contains 'docker'
    - DOCKER_CONTAINER environment variable

    Returns:
        bool: True if running inside Docker, False otherwise
    """
    # Check for /.dockerenv file (most reliable indicator)
    if Path("/.dockerenv").exists():
        return True

    # Check environment variable (can be set in docker-compose)
    if os.getenv("DOCKER_CONTAINER") == "true":
        return True

    # Check cgroup (works on Linux)
    try:
        with open("/proc/1/cgroup") as f:
            content = f.read()
            if "docker" in content or "containerd" in content:
                return True
    except (FileNotFoundError, PermissionError):
        pass

    return False


def get_service_host(service_name: str, default_host: str = "localhost") -> str:
    """
    Get the appropriate host for a Docker service.

    If running inside Docker, use the Docker service name.
    Otherwise, use localhost or the provided default.

    Args:
        service_name: Docker service name (e.g., 'freeradius', 'netbox')
        default_host: Host to use when not in Docker (default: 'localhost')

    Returns:
        str: Host address to use for connecting to the service

    Examples:
        >>> get_service_host('freeradius')  # Outside Docker
        'localhost'
        >>> get_service_host('freeradius')  # Inside Docker
        'freeradius'
    """
    if is_running_in_docker():
        return service_name
    return default_host


def get_docker_network_url(
    service_name: str, port: int, default_host: str = "localhost", scheme: str = "http"
) -> str:
    """
    Build a URL for a Docker service that works both inside and outside Docker.

    Args:
        service_name: Docker service name
        port: Service port
        default_host: Host when not in Docker (default: 'localhost')
        scheme: URL scheme (default: 'http')

    Returns:
        str: Complete URL for the service

    Examples:
        >>> get_docker_network_url('netbox', 8080)  # Outside Docker
        'http://localhost:8080'
        >>> get_docker_network_url('netbox', 8080)  # Inside Docker
        'http://netbox:8080'
    """
    host = get_service_host(service_name, default_host)
    return f"{scheme}://{host}:{port}"


def should_skip_docker_test(test_name: str) -> tuple[bool, str]:
    """
    Determine if a Docker-dependent test should be skipped.

    Tests should only be skipped if Docker services are genuinely unreachable,
    not just because of host platform limitations.

    Args:
        test_name: Name of the test for informative skip messages

    Returns:
        tuple: (should_skip: bool, skip_reason: str)
    """
    # If running in Docker, never skip Docker tests
    if is_running_in_docker():
        return False, ""

    # Outside Docker, tests should attempt connection and fail gracefully
    # Don't pre-emptively skip based on OS
    return False, ""
