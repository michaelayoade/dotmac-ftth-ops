"""
Docker Compose configuration smoke tests for the simplified stacks.

The project now maintains two Compose files only:
  * docker-compose.base.yml – platform backend + admin frontend
  * docker-compose.isp.yml  – ISP backend + ISP operations frontend

These tests ensure the files stay minimal, valid, and correctly wired.
"""

from __future__ import annotations

import shutil
import subprocess
from pathlib import Path
from typing import Any

import pytest
import yaml

pytestmark = pytest.mark.integration

pytestmark = pytest.mark.infra


def get_docker_compose_command() -> list[str] | None:
    """
    Detect available Docker Compose command.

    Returns:
        ['docker', 'compose'] or ['docker-compose'] if available, otherwise None.
    """
    if shutil.which("docker"):
        try:
            result = subprocess.run(
                ["docker", "compose", "version"],
                capture_output=True,
                text=True,
                timeout=5,
            )
            if result.returncode == 0:
                return ["docker", "compose"]
        except (subprocess.TimeoutExpired, FileNotFoundError):
            pass

    if shutil.which("docker-compose"):
        return ["docker-compose"]

    return None


def run_compose_config(compose_file: str, project_root: Path) -> subprocess.CompletedProcess | None:
    """
    Run `docker compose config` for the given file if Docker is available.
    """
    compose_cmd = get_docker_compose_command()
    if not compose_cmd:
        pytest.skip("Docker or docker-compose not available")

    try:
        result = subprocess.run(
            [*compose_cmd, "-f", compose_file, "config"],
            cwd=project_root,
            capture_output=True,
            text=True,
            timeout=30,
        )
        return result
    except FileNotFoundError:
        pytest.skip(f"Docker command not found: {' '.join(compose_cmd)}")
    except subprocess.TimeoutExpired:
        pytest.skip("docker compose config command timed out")

    return None


@pytest.fixture(scope="module")
def project_root() -> Path:
    return Path(__file__).parents[2]


@pytest.fixture(scope="module")
def platform_compose(project_root: Path) -> dict[str, Any]:
    path = project_root / "docker-compose.base.yml"
    assert path.exists(), "docker-compose.base.yml not found"
    with path.open() as fh:
        return yaml.safe_load(fh)


@pytest.fixture(scope="module")
def isp_compose(project_root: Path) -> dict[str, Any]:
    path = project_root / "docker-compose.isp.yml"
    assert path.exists(), "docker-compose.isp.yml not found"
    with path.open() as fh:
        return yaml.safe_load(fh)


class TestPlatformCompose:
    def test_only_backend_and_frontend_defined(self, platform_compose: dict[str, Any]):
        services = set(platform_compose.get("services", {}))
        assert services == {"platform-backend", "platform-frontend"}, (
            "Platform compose should only define backend and frontend services"
        )

    def test_platform_backend_configuration(self, platform_compose: dict[str, Any]):
        backend = platform_compose["services"]["platform-backend"]

        assert "build" in backend or "image" in backend, "Backend must be buildable or use an image"
        ports = backend.get("ports", [])
        assert any("8001" in str(port) for port in ports), "Backend must expose port 8001 to host"
        assert backend.get("restart") == "unless-stopped", "Backend should restart automatically"

        env = backend.get("environment", {})
        if isinstance(env, dict):
            env_keys = set(env)
        else:
            env_keys = {
                item.split("=", 1)[0] for item in env if isinstance(item, str) and "=" in item
            }

        required_keys = {
            "ENVIRONMENT",
            "DATABASE__HOST",
            "DATABASE__PORT",
            "SECRET_KEY",
            "AUTH__JWT_SECRET_KEY",
        }
        missing = required_keys - env_keys
        assert not missing, f"Backend missing required environment variables: {missing}"

        healthcheck = backend.get("healthcheck", {})
        assert "test" in healthcheck, "Backend must define a healthcheck"

    def test_platform_frontend_configuration(self, platform_compose: dict[str, Any]):
        frontend = platform_compose["services"]["platform-frontend"]

        assert "build" in frontend or "image" in frontend, (
            "Frontend must be buildable or use an image"
        )
        ports = frontend.get("ports", [])
        assert any("3002" in str(port) for port in ports), "Frontend must expose port 3002"

        depends_on = frontend.get("depends_on", [])
        if isinstance(depends_on, dict):
            depends_on = list(depends_on.keys())
        assert "platform-backend" in depends_on, "Frontend should depend on the backend service"

    def test_platform_network_defined(self, platform_compose: dict[str, Any]):
        networks = platform_compose.get("networks", {})
        assert "default" in networks, "Platform compose must declare a default network"


class TestISPCompose:
    def test_only_backend_and_frontend_defined(self, isp_compose: dict[str, Any]):
        services = set(isp_compose.get("services", {}))
        assert services == {"isp-backend", "isp-frontend"}, (
            "ISP compose should only define backend and frontend services"
        )

    def test_isp_backend_configuration(self, isp_compose: dict[str, Any]):
        backend = isp_compose["services"]["isp-backend"]

        assert "build" in backend or "image" in backend, "Backend must be buildable or use an image"
        ports = backend.get("ports", [])
        assert any("8000" in str(port) for port in ports), "Backend must expose port 8000"
        assert backend.get("restart") == "unless-stopped", "Backend should restart automatically"

        env = backend.get("environment", {})
        if isinstance(env, dict):
            env_keys = set(env)
        else:
            env_keys = {
                item.split("=", 1)[0] for item in env if isinstance(item, str) and "=" in item
            }

        required_keys = {
            "ENVIRONMENT",
            "DATABASE__HOST",
            "DATABASE__PORT",
            "SECRET_KEY",
            "AUTH__JWT_SECRET_KEY",
        }
        missing = required_keys - env_keys
        assert not missing, f"ISP backend missing required environment variables: {missing}"

        healthcheck = backend.get("healthcheck", {})
        assert "test" in healthcheck, "Backend must define a healthcheck"

    def test_isp_frontend_configuration(self, isp_compose: dict[str, Any]):
        frontend = isp_compose["services"]["isp-frontend"]

        assert "build" in frontend or "image" in frontend, (
            "Frontend must be buildable or use an image"
        )
        ports = frontend.get("ports", [])
        assert any("3001" in str(port) for port in ports), "Frontend must expose port 3001"

        depends_on = frontend.get("depends_on", [])
        if isinstance(depends_on, dict):
            depends_on = list(depends_on.keys())
        assert "isp-backend" in depends_on, "Frontend should depend on the backend service"

    def test_isp_network_defined(self, isp_compose: dict[str, Any]):
        networks = isp_compose.get("networks", {})
        assert "default" in networks, "ISP compose must declare a default network"


class TestComposeValidation:
    def test_platform_compose_is_valid(self, project_root: Path):
        result = run_compose_config("docker-compose.base.yml", project_root)
        if result is None:
            pytest.skip("Docker not available for config validation")

        assert result.returncode in (0, 1), (
            f"docker compose config returned unexpected code {result.returncode}\n"
            f"stdout: {result.stdout}\n"
            f"stderr: {result.stderr}"
        )

        if result.returncode == 1:
            acceptable_errors = [
                "variable is not set",
                "is not set",
                "variable is required",
            ]
            assert any(msg in result.stderr.lower() for msg in acceptable_errors), (
                f"Unexpected docker compose config error:\n{result.stderr}"
            )

    def test_isp_compose_is_valid(self, project_root: Path):
        result = run_compose_config("docker-compose.isp.yml", project_root)
        if result is None:
            pytest.skip("Docker not available for config validation")

        assert result.returncode in (0, 1), (
            f"docker compose config returned unexpected code {result.returncode}\n"
            f"stdout: {result.stdout}\n"
            f"stderr: {result.stderr}"
        )

        if result.returncode == 1:
            acceptable_errors = [
                "variable is not set",
                "is not set",
                "variable is required",
            ]
            assert any(msg in result.stderr.lower() for msg in acceptable_errors), (
                f"Unexpected docker compose config error:\n{result.stderr}"
            )
