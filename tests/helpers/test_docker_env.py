"""
Tests for Docker environment detection utilities.
"""

import os

import pytest

pytestmark = pytest.mark.unit
from pathlib import Path
from unittest.mock import mock_open, patch

from tests.helpers.docker_env import (
    get_docker_network_url,
    get_service_host,
    is_running_in_docker,
)


class TestDockerDetection:
    """Test Docker environment detection."""

    def test_is_running_in_docker_with_dockerenv(self):
        """Test detection via /.dockerenv file."""
        with patch.object(Path, "exists", return_value=True):
            assert is_running_in_docker() is True

    def test_is_running_in_docker_with_env_var(self):
        """Test detection via DOCKER_CONTAINER env var."""
        with patch.object(Path, "exists", return_value=False):
            with patch.dict(os.environ, {"DOCKER_CONTAINER": "true"}):
                assert is_running_in_docker() is True

    def test_is_running_in_docker_with_cgroup(self):
        """Test detection via /proc/1/cgroup."""
        cgroup_content = "12:cpuset:/docker/abc123"
        with patch.object(Path, "exists", return_value=False):
            with patch("builtins.open", mock_open(read_data=cgroup_content)):
                assert is_running_in_docker() is True

    def test_is_running_in_docker_false(self):
        """Test returns False when not in Docker."""
        with patch.object(Path, "exists", return_value=False):
            with patch("builtins.open", side_effect=FileNotFoundError):
                assert is_running_in_docker() is False

    def test_get_service_host_outside_docker(self):
        """Test service host returns localhost outside Docker."""
        with patch("tests.helpers.docker_env.is_running_in_docker", return_value=False):
            assert get_service_host("freeradius") == "localhost"
            assert get_service_host("netbox", "127.0.0.1") == "127.0.0.1"

    def test_get_service_host_inside_docker(self):
        """Test service host returns service name inside Docker."""
        with patch("tests.helpers.docker_env.is_running_in_docker", return_value=True):
            assert get_service_host("freeradius") == "freeradius"
            assert get_service_host("netbox") == "netbox"
            assert get_service_host("vault") == "vault"

    def test_get_docker_network_url_outside_docker(self):
        """Test URL generation outside Docker uses localhost."""
        with patch("tests.helpers.docker_env.is_running_in_docker", return_value=False):
            assert get_docker_network_url("netbox", 8080) == "http://localhost:8080"
            assert get_docker_network_url("vault", 8200, scheme="https") == "https://localhost:8200"

    def test_get_docker_network_url_inside_docker(self):
        """Test URL generation inside Docker uses service name."""
        with patch("tests.helpers.docker_env.is_running_in_docker", return_value=True):
            assert get_docker_network_url("netbox", 8080) == "http://netbox:8080"
            assert get_docker_network_url("vault", 8200, scheme="https") == "https://vault:8200"

    def test_get_docker_network_url_custom_host(self):
        """Test URL generation with custom default host."""
        with patch("tests.helpers.docker_env.is_running_in_docker", return_value=False):
            url = get_docker_network_url("service", 3000, default_host="192.168.1.100")
            assert url == "http://192.168.1.100:3000"
