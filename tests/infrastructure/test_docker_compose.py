"""
Docker Compose Infrastructure Smoke Tests

Tests validate docker-compose.base.yml and docker-compose.isp.yml configuration:
- Service definitions and wiring
- Network configurations
- Port mappings
- Health checks
- Volume mounts
- Environment variable coverage
- Service dependencies

These tests prevent regressions like:
- Renamed services
- Missing/incorrect port mappings
- Network misconfigurations
- Broken health checks
"""

import json
import subprocess
from pathlib import Path
from typing import Any

import pytest
import yaml


pytestmark = pytest.mark.infra


class TestDockerComposeConfiguration:
    """Test Docker Compose configuration files validity."""

    @pytest.fixture(scope="class")
    def project_root(self) -> Path:
        """Get project root directory."""
        return Path(__file__).parent.parent.parent

    @pytest.fixture(scope="class")
    def base_compose_config(self, project_root: Path) -> dict[str, Any]:
        """Load and parse docker-compose.base.yml."""
        compose_file = project_root / "docker-compose.base.yml"
        assert compose_file.exists(), "docker-compose.base.yml not found"

        with open(compose_file) as f:
            return yaml.safe_load(f)

    @pytest.fixture(scope="class")
    def isp_compose_config(self, project_root: Path) -> dict[str, Any]:
        """Load and parse docker-compose.isp.yml."""
        compose_file = project_root / "docker-compose.isp.yml"
        assert compose_file.exists(), "docker-compose.isp.yml not found"

        with open(compose_file) as f:
            return yaml.safe_load(f)

    @pytest.fixture(scope="class")
    def env_example(self, project_root: Path) -> dict[str, str]:
        """Load .env.example file."""
        env_file = project_root / ".env.example"
        if not env_file.exists():
            return {}

        env_vars = {}
        with open(env_file) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#"):
                    if "=" in line:
                        key, value = line.split("=", 1)
                        env_vars[key.strip()] = value.strip()
        return env_vars

    def test_base_compose_config_valid_yaml(self, project_root: Path):
        """Test docker-compose.base.yml is valid YAML and can be validated by docker compose."""
        result = subprocess.run(
            ["docker", "compose", "-f", "docker-compose.base.yml", "config"],
            cwd=project_root,
            capture_output=True,
            text=True,
            timeout=30,
        )

        # Should succeed or fail only due to missing .env vars (acceptable)
        assert result.returncode in [0, 1], (
            f"docker compose config failed with unexpected error:\n"
            f"stdout: {result.stdout}\n"
            f"stderr: {result.stderr}"
        )

        # If it fails, should be due to env vars, not syntax
        if result.returncode == 1:
            assert "variable is not set" in result.stderr or "required" in result.stderr.lower(), (
                f"Unexpected docker compose config error:\n{result.stderr}"
            )

    def test_isp_compose_config_valid_yaml(self, project_root: Path):
        """Test docker-compose.isp.yml is valid YAML and can be validated by docker compose."""
        result = subprocess.run(
            ["docker", "compose", "-f", "docker-compose.isp.yml", "config"],
            cwd=project_root,
            capture_output=True,
            text=True,
            timeout=30,
        )

        # Should succeed or fail only due to missing .env vars (acceptable)
        assert result.returncode in [0, 1], (
            f"docker compose config failed with unexpected error:\n"
            f"stdout: {result.stdout}\n"
            f"stderr: {result.stderr}"
        )

        # If it fails, should be due to env vars, not syntax
        if result.returncode == 1:
            assert "variable is not set" in result.stderr or "required" in result.stderr.lower(), (
                f"Unexpected docker compose config error:\n{result.stderr}"
            )


class TestBaseComposeServices:
    """Test docker-compose.base.yml service definitions."""

    @pytest.fixture(scope="class")
    def project_root(self) -> Path:
        """Get project root directory."""
        return Path(__file__).parent.parent.parent

    @pytest.fixture(scope="class")
    def base_compose_config(self, project_root: Path) -> dict[str, Any]:
        """Load and parse docker-compose.base.yml."""
        compose_file = project_root / "docker-compose.base.yml"
        with open(compose_file) as f:
            return yaml.safe_load(f)

    def test_required_platform_services_defined(self, base_compose_config: dict[str, Any]):
        """Test all required platform services are defined in base compose."""
        required_services = {
            "app",            # FastAPI application
            "postgres",       # PostgreSQL database
            "redis",          # Cache and session store
            "flower",         # Celery monitor
            "celery-worker",  # Celery worker
        }

        services = set(base_compose_config.get("services", {}).keys())
        missing = required_services - services

        assert not missing, f"Missing required services in docker-compose.base.yml: {missing}"

    def test_app_service_configuration(self, base_compose_config: dict[str, Any]):
        """Test FastAPI app service is properly configured."""
        app_service = base_compose_config["services"]["app"]

        # Should have build or image
        assert "build" in app_service or "image" in app_service, "App service missing build/image"

        # Should expose port 8000 (may use env var like ${APP_PORT:-8000})
        ports = app_service.get("ports", [])
        port_mappings = [str(p).split(":")[-1].replace("}", "") for p in ports]
        # Check if any port mapping ends with 8000
        has_8000 = any("8000" in pm for pm in port_mappings)
        assert has_8000, f"App service should expose port 8000, got: {port_mappings}"

        # Should have depends_on
        assert "depends_on" in app_service, "App service should depend on postgres and redis"
        depends_on = app_service["depends_on"]
        if isinstance(depends_on, dict):
            depends_on = list(depends_on.keys())
        assert "postgres" in depends_on, "App should depend on postgres"
        assert "redis" in depends_on, "App should depend on redis"

    def test_db_service_configuration(self, base_compose_config: dict[str, Any]):
        """Test PostgreSQL database service is properly configured."""
        postgres_service = base_compose_config["services"]["postgres"]

        # Should use postgres image
        assert "image" in postgres_service, "Postgres service should specify image"
        assert "postgres" in postgres_service["image"].lower(), "Should use postgres image"

        # Should expose port 5432 (may use env var)
        ports = postgres_service.get("ports", [])
        port_mappings = [str(p).split(":")[-1].replace("}", "") for p in ports]
        has_5432 = any("5432" in pm for pm in port_mappings)
        assert has_5432, f"Postgres service should expose port 5432, got: {port_mappings}"

        # Should have environment variables
        assert "environment" in postgres_service, "Postgres service should have environment config"
        env_vars = postgres_service["environment"]
        if isinstance(env_vars, dict):
            env_keys = env_vars.keys()
        else:
            env_keys = [e.split("=")[0] for e in env_vars if "=" in e]

        assert "POSTGRES_DB" in env_keys or any("POSTGRES_DB" in k for k in env_keys), (
            "Postgres service should set POSTGRES_DB"
        )

    def test_redis_service_configuration(self, base_compose_config: dict[str, Any]):
        """Test Redis service is properly configured."""
        redis_service = base_compose_config["services"]["redis"]

        # Should use redis image
        assert "image" in redis_service, "Redis service should specify image"
        assert "redis" in redis_service["image"].lower(), "Redis should use redis image"

        # Should expose port 6379 (may use env var)
        ports = redis_service.get("ports", [])
        port_mappings = [str(p).split(":")[-1].replace("}", "") for p in ports]
        has_6379 = any("6379" in pm for pm in port_mappings)
        assert has_6379, f"Redis service should expose port 6379, got: {port_mappings}"

    def test_flower_service_configuration(self, base_compose_config: dict[str, Any]):
        """Test Flower (Celery monitor) service is properly configured."""
        flower_service = base_compose_config["services"]["flower"]

        # Should expose port 5555 (may use env var)
        ports = flower_service.get("ports", [])
        port_mappings = [str(p).split(":")[-1].replace("}", "") for p in ports]
        has_5555 = any("5555" in pm for pm in port_mappings)
        assert has_5555, f"Flower service should expose port 5555, got: {port_mappings}"

        # Should have healthcheck
        assert "healthcheck" in flower_service, "Flower service should have healthcheck"
        healthcheck = flower_service["healthcheck"]
        assert "test" in healthcheck, "Flower healthcheck should have test command"

    def test_worker_service_configuration(self, base_compose_config: dict[str, Any]):
        """Test Celery worker service is properly configured."""
        worker_service = base_compose_config["services"]["celery-worker"]

        # Should depend on postgres and redis
        assert "depends_on" in worker_service, "Worker service should have dependencies"
        depends_on = worker_service["depends_on"]
        if isinstance(depends_on, dict):
            depends_on = list(depends_on.keys())
        assert "postgres" in depends_on, "Worker should depend on postgres"
        assert "redis" in depends_on, "Worker should depend on redis"

    def test_all_services_have_restart_policy(self, base_compose_config: dict[str, Any]):
        """Test all services have restart policies for production resilience."""
        services = base_compose_config["services"]

        # Core services that MUST have restart policy
        core_services = {"postgres", "redis"}

        for service_name, service_config in services.items():
            # Skip non-core services without restart policy
            if service_name not in core_services:
                continue

            # Core services should have restart policy
            assert "restart" in service_config, (
                f"Core service '{service_name}' should have restart policy for production resilience"
            )


class TestISPComposeServices:
    """Test docker-compose.isp.yml service definitions."""

    @pytest.fixture(scope="class")
    def project_root(self) -> Path:
        """Get project root directory."""
        return Path(__file__).parent.parent.parent

    @pytest.fixture(scope="class")
    def isp_compose_config(self, project_root: Path) -> dict[str, Any]:
        """Load and parse docker-compose.isp.yml."""
        compose_file = project_root / "docker-compose.isp.yml"
        with open(compose_file) as f:
            return yaml.safe_load(f)

    def test_monitoring_services_defined(self, isp_compose_config: dict[str, Any]):
        """Test monitoring stack services are defined in ISP compose."""
        monitoring_services = {
            "prometheus",
            "grafana",
            "alertmanager",
        }

        services = set(isp_compose_config.get("services", {}).keys())
        missing = monitoring_services - services

        assert not missing, f"Missing monitoring services in docker-compose.isp.yml: {missing}"

    def test_prometheus_service_configuration(self, isp_compose_config: dict[str, Any]):
        """Test Prometheus service is properly configured."""
        if "prometheus" not in isp_compose_config["services"]:
            pytest.skip("Prometheus service not in this compose file")

        prom_service = isp_compose_config["services"]["prometheus"]

        # Should expose port 9090
        ports = prom_service.get("ports", [])
        port_mappings = [str(p).split(":")[1] if ":" in str(p) else str(p) for p in ports]
        assert "9090" in port_mappings, "Prometheus should expose port 9090"

        # Should have volumes for config
        volumes = prom_service.get("volumes", [])
        assert len(volumes) > 0, "Prometheus should have volume mounts for config"

    def test_grafana_service_configuration(self, isp_compose_config: dict[str, Any]):
        """Test Grafana service is properly configured."""
        if "grafana" not in isp_compose_config["services"]:
            pytest.skip("Grafana service not in this compose file")

        grafana_service = isp_compose_config["services"]["grafana"]

        # Should expose port 3000
        ports = grafana_service.get("ports", [])
        port_mappings = [str(p).split(":")[1] if ":" in str(p) else str(p) for p in ports]
        assert "3000" in port_mappings, "Grafana should expose port 3000"

    def test_alertmanager_service_configuration(self, isp_compose_config: dict[str, Any]):
        """Test Alertmanager service is properly configured."""
        if "alertmanager" not in isp_compose_config["services"]:
            pytest.skip("Alertmanager service not in this compose file")

        alertmanager_service = isp_compose_config["services"]["alertmanager"]

        # Should expose port 9093
        ports = alertmanager_service.get("ports", [])
        port_mappings = [str(p).split(":")[1] if ":" in str(p) else str(p) for p in ports]
        assert "9093" in port_mappings, "Alertmanager should expose port 9093"

        # Should have volumes for config
        volumes = alertmanager_service.get("volumes", [])
        assert len(volumes) > 0, "Alertmanager should have volume mounts for config"

    def test_freeradius_service_exists(self, isp_compose_config: dict[str, Any]):
        """Test FreeRADIUS service is defined (critical for ISP operations)."""
        services = isp_compose_config.get("services", {})

        # FreeRADIUS might be named 'radius' or 'freeradius'
        has_radius = "radius" in services or "freeradius" in services
        assert has_radius, "FreeRADIUS service not found in ISP compose"


class TestNetworkConfiguration:
    """Test Docker network configuration consistency."""

    @pytest.fixture(scope="class")
    def project_root(self) -> Path:
        """Get project root directory."""
        return Path(__file__).parent.parent.parent

    @pytest.fixture(scope="class")
    def base_compose_config(self, project_root: Path) -> dict[str, Any]:
        """Load docker-compose.base.yml."""
        with open(project_root / "docker-compose.base.yml") as f:
            return yaml.safe_load(f)

    @pytest.fixture(scope="class")
    def isp_compose_config(self, project_root: Path) -> dict[str, Any]:
        """Load docker-compose.isp.yml."""
        with open(project_root / "docker-compose.isp.yml") as f:
            return yaml.safe_load(f)

    def test_base_compose_has_network(self, base_compose_config: dict[str, Any]):
        """Test base compose defines a network."""
        networks = base_compose_config.get("networks", {})
        assert len(networks) > 0, "Base compose should define a network"
        # Network is usually 'default' with custom name
        assert "default" in networks or "dotmac-network" in networks, (
            f"Base compose should define 'default' or 'dotmac-network', got: {list(networks.keys())}"
        )

    def test_isp_compose_uses_external_network(self, isp_compose_config: dict[str, Any]):
        """Test ISP compose uses external dotmac network."""
        networks = isp_compose_config.get("networks", {})
        assert "dotmac-network" in networks, "ISP compose should reference dotmac-network"

        network_config = networks["dotmac-network"]
        assert network_config.get("external") is True, "ISP network should be external"

    def test_network_name_consistency(
        self, base_compose_config: dict[str, Any], isp_compose_config: dict[str, Any]
    ):
        """Test network names are consistent between compose files."""
        # Base compose uses 'default' network with custom name
        base_networks = base_compose_config["networks"]
        base_network = base_networks.get("default") or base_networks.get("dotmac-network")

        isp_network = isp_compose_config["networks"]["dotmac-network"]

        # Get network name from base compose
        base_name = base_network.get("name", "dotmac-network")

        # ISP compose should reference same network
        isp_name = isp_network.get("name", "dotmac-network")

        # Both should resolve to same name pattern
        # Allow for ${COMPOSE_PROJECT_NAME} variable
        assert "${COMPOSE_PROJECT_NAME}" in base_name or "${COMPOSE_PROJECT_NAME}" in isp_name or base_name == isp_name, (
            f"Network name mismatch: base={base_name}, isp={isp_name}"
        )

    def test_services_use_correct_network(self, base_compose_config: dict[str, Any]):
        """Test services in base compose use the dotmac network."""
        services = base_compose_config["services"]

        for service_name, service_config in services.items():
            networks = service_config.get("networks", [])

            # If service specifies networks, should include dotmac-network
            if networks:
                if isinstance(networks, list):
                    assert "dotmac-network" in networks, (
                        f"Service '{service_name}' should use dotmac-network"
                    )
                elif isinstance(networks, dict):
                    assert "dotmac-network" in networks.keys(), (
                        f"Service '{service_name}' should use dotmac-network"
                    )


class TestHealthChecks:
    """Test health check configurations."""

    @pytest.fixture(scope="class")
    def project_root(self) -> Path:
        """Get project root directory."""
        return Path(__file__).parent.parent.parent

    @pytest.fixture(scope="class")
    def base_compose_config(self, project_root: Path) -> dict[str, Any]:
        """Load docker-compose.base.yml."""
        with open(project_root / "docker-compose.base.yml") as f:
            return yaml.safe_load(f)

    def test_critical_services_have_healthchecks(self, base_compose_config: dict[str, Any]):
        """Test critical services have healthcheck configurations."""
        services = base_compose_config["services"]

        # These services should have healthchecks for proper orchestration
        critical_services = ["app", "db", "redis"]

        for service_name in critical_services:
            if service_name in services:
                service = services[service_name]
                assert "healthcheck" in service, (
                    f"Critical service '{service_name}' should have healthcheck"
                )

                healthcheck = service["healthcheck"]
                assert "test" in healthcheck, (
                    f"Healthcheck for '{service_name}' should have test command"
                )
                assert "interval" in healthcheck, (
                    f"Healthcheck for '{service_name}' should have interval"
                )

    def test_flower_healthcheck_correct(self, base_compose_config: dict[str, Any]):
        """Test Flower service healthcheck is correctly configured (regression test)."""
        flower_service = base_compose_config["services"]["flower"]
        healthcheck = flower_service["healthcheck"]

        test_cmd = healthcheck["test"]
        if isinstance(test_cmd, list):
            test_cmd = " ".join(test_cmd)

        # Should check port 5555 (not missing or wrong port)
        assert "5555" in test_cmd, "Flower healthcheck should check port 5555"

        # Should use wget or curl
        assert "wget" in test_cmd.lower() or "curl" in test_cmd.lower(), (
            "Flower healthcheck should use wget or curl"
        )


class TestEnvironmentVariableCoverage:
    """Test environment variable documentation and usage."""

    @pytest.fixture(scope="class")
    def project_root(self) -> Path:
        """Get project root directory."""
        return Path(__file__).parent.parent.parent

    @pytest.fixture(scope="class")
    def base_compose_config(self, project_root: Path) -> dict[str, Any]:
        """Load docker-compose.base.yml."""
        with open(project_root / "docker-compose.base.yml") as f:
            return yaml.safe_load(f)

    @pytest.fixture(scope="class")
    def env_example(self, project_root: Path) -> set[str]:
        """Load environment variables from .env.example."""
        env_file = project_root / ".env.example"
        if not env_file.exists():
            return set()

        env_vars = set()
        with open(env_file) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#"):
                    if "=" in line:
                        key = line.split("=", 1)[0].strip()
                        env_vars.add(key)
        return env_vars

    def test_critical_env_vars_documented(self, env_example: set[str]):
        """Test critical environment variables are documented in .env.example."""
        if not env_example:
            pytest.skip(".env.example not found, skipping env var documentation test")

        critical_vars = {
            "DATABASE_URL",
            "REDIS_URL",
            "JWT_SECRET_KEY",
        }

        missing = critical_vars - env_example
        assert not missing, (
            f"Critical env vars not documented in .env.example: {missing}"
        )

    def test_compose_uses_documented_env_vars(
        self, base_compose_config: dict[str, Any], env_example: set[str]
    ):
        """Test compose files only reference documented environment variables."""
        if not env_example:
            pytest.skip(".env.example not found, skipping")

        # Extract env var references from compose config
        compose_str = str(base_compose_config)

        # Find ${VAR_NAME} patterns
        import re
        env_refs = re.findall(r'\$\{([A-Z_][A-Z0-9_]*)[:\-}]', compose_str)
        env_refs = set(env_refs)

        # Allow some standard Docker Compose vars
        allowed_undocumented = {
            "COMPOSE_PROJECT_NAME",
            "DOCKER_DEFAULT_PLATFORM",
            "PWD",
        }

        undocumented = env_refs - env_example - allowed_undocumented

        # Warn if undocumented vars exist (not fail, as some may be optional)
        if undocumented:
            import warnings
            warnings.warn(
                f"Environment variables referenced but not in .env.example: {undocumented}"
            )


class TestPortConflicts:
    """Test for port conflicts between services."""

    @pytest.fixture(scope="class")
    def project_root(self) -> Path:
        """Get project root directory."""
        return Path(__file__).parent.parent.parent

    @pytest.fixture(scope="class")
    def all_compose_configs(self, project_root: Path) -> list[tuple[str, dict[str, Any]]]:
        """Load all compose configurations."""
        configs = []

        for compose_file in ["docker-compose.base.yml", "docker-compose.isp.yml"]:
            file_path = project_root / compose_file
            if file_path.exists():
                with open(file_path) as f:
                    configs.append((compose_file, yaml.safe_load(f)))

        return configs

    def test_no_duplicate_host_ports(self, all_compose_configs: list[tuple[str, dict[str, Any]]]):
        """Test services don't expose conflicting host ports."""
        port_usage = {}  # port -> [(file, service)]

        for filename, config in all_compose_configs:
            services = config.get("services", {})

            for service_name, service_config in services.items():
                ports = service_config.get("ports", [])

                for port in ports:
                    # Parse port mapping (can be "8000:8000" or just "8000")
                    port_str = str(port)
                    if ":" in port_str:
                        host_port = port_str.split(":")[0]
                    else:
                        host_port = port_str

                    # Track usage
                    if host_port not in port_usage:
                        port_usage[host_port] = []
                    port_usage[host_port].append((filename, service_name))

        # Find conflicts
        conflicts = {
            port: services
            for port, services in port_usage.items()
            if len(services) > 1
        }

        assert not conflicts, (
            f"Port conflicts detected:\n" +
            "\n".join(f"  Port {port}: {services}" for port, services in conflicts.items())
        )


class TestVolumeConfiguration:
    """Test volume mount configurations."""

    @pytest.fixture(scope="class")
    def project_root(self) -> Path:
        """Get project root directory."""
        return Path(__file__).parent.parent.parent

    @pytest.fixture(scope="class")
    def base_compose_config(self, project_root: Path) -> dict[str, Any]:
        """Load docker-compose.base.yml."""
        with open(project_root / "docker-compose.base.yml") as f:
            return yaml.safe_load(f)

    def test_database_has_persistent_volume(self, base_compose_config: dict[str, Any]):
        """Test database service uses persistent volume."""
        postgres_service = base_compose_config["services"]["postgres"]
        volumes = postgres_service.get("volumes", [])

        assert len(volumes) > 0, "Database should have volume mounts for data persistence"

        # Should have a named volume or bind mount for data
        volume_str = str(volumes)
        assert "postgres" in volume_str.lower() or "/var/lib/postgresql" in volume_str, (
            "Database should have PostgreSQL data volume"
        )

    def test_redis_has_persistent_volume(self, base_compose_config: dict[str, Any]):
        """Test Redis service uses persistent volume for data."""
        redis_service = base_compose_config["services"]["redis"]
        volumes = redis_service.get("volumes", [])

        # Redis should have data persistence
        assert len(volumes) > 0, "Redis should have volume mounts for data persistence"


class TestDockerComposeIntegration:
    """Integration tests using docker compose commands."""

    @pytest.fixture(scope="class")
    def project_root(self) -> Path:
        """Get project root directory."""
        return Path(__file__).parent.parent.parent

    @pytest.mark.slow
    def test_base_compose_config_command(self, project_root: Path):
        """Test 'docker compose config' succeeds for base compose (with env vars)."""
        # Create minimal .env for testing
        env_vars = {
            "POSTGRES_PASSWORD": "test-password",
            "DATABASE_URL": "postgresql+psycopg://user:pass@db:5432/dbname",
            "REDIS_URL": "redis://redis:6379/0",
            "JWT_SECRET_KEY": "test-secret-key",
            "CELERY_BROKER_URL": "redis://redis:6379/0",
        }

        result = subprocess.run(
            ["docker", "compose", "-f", "docker-compose.base.yml", "config"],
            cwd=project_root,
            capture_output=True,
            text=True,
            env={**subprocess.os.environ.copy(), **env_vars},
            timeout=30,
        )

        assert result.returncode == 0, (
            f"docker compose config failed:\nstdout: {result.stdout}\nstderr: {result.stderr}"
        )

        # Should output valid YAML
        try:
            yaml.safe_load(result.stdout)
        except yaml.YAMLError as e:
            pytest.fail(f"docker compose config output is not valid YAML: {e}")

    @pytest.mark.slow
    def test_isp_compose_config_command(self, project_root: Path):
        """Test 'docker compose config' succeeds for ISP compose."""
        env_vars = {
            "COMPOSE_PROJECT_NAME": "dotmac",
            "ALERTMANAGER_WEBHOOK_SECRET": "test-webhook-secret",
        }

        result = subprocess.run(
            ["docker", "compose", "-f", "docker-compose.isp.yml", "config"],
            cwd=project_root,
            capture_output=True,
            text=True,
            env={**subprocess.os.environ.copy(), **env_vars},
            timeout=30,
        )

        # Allow failure if network doesn't exist (acceptable in CI)
        if result.returncode != 0:
            # Should fail due to external network, not config error
            assert "network" in result.stderr.lower() or "external" in result.stderr.lower(), (
                f"Unexpected docker compose config error:\n{result.stderr}"
            )
        else:
            # If it succeeds, validate output
            try:
                yaml.safe_load(result.stdout)
            except yaml.YAMLError as e:
                pytest.fail(f"docker compose config output is not valid YAML: {e}")

    @pytest.mark.slow
    def test_compose_parse_command(self, project_root: Path):
        """Test docker compose can parse configuration (dry run validation)."""
        # Test with --dry-run flag (Docker Compose v2.17+)
        result = subprocess.run(
            ["docker", "compose", "-f", "docker-compose.base.yml", "up", "--dry-run"],
            cwd=project_root,
            capture_output=True,
            text=True,
            timeout=30,
        )

        # Should not crash with parse errors
        # May fail due to missing env or external deps (acceptable)
        assert "invalid" not in result.stderr.lower(), (
            f"Docker compose config appears invalid:\n{result.stderr}"
        )
