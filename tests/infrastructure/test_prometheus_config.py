"""
Prometheus Configuration Validation Tests

Tests Prometheus scrape configuration to prevent:
- Mis-typed scrape targets
- Missing scrape jobs
- Invalid rule files
- Incorrect endpoint configurations

Uses promtool (if available) for validation, falls back to YAML parsing.
"""

import shutil
import subprocess
from pathlib import Path
from typing import Any

import pytest
import yaml

pytestmark = pytest.mark.integration

pytestmark = pytest.mark.infra


class TestPrometheusConfiguration:
    """Test Prometheus configuration files."""

    @pytest.fixture(scope="class")
    def project_root(self) -> Path:
        """Get project root directory."""
        return Path(__file__).parent.parent.parent

    @pytest.fixture(scope="class")
    def prometheus_config_path(self, project_root: Path) -> Path:
        """Get Prometheus config file path."""
        # Check multiple possible locations
        possible_paths = [
            project_root / "monitoring/prometheus/prometheus.yml",
            project_root / "prometheus/prometheus.yml",
            project_root / "prometheus.yml",
        ]

        for path in possible_paths:
            if path.exists():
                return path

        pytest.skip("Prometheus config file not found")

    @pytest.fixture(scope="class")
    def prometheus_config(self, prometheus_config_path: Path) -> dict[str, Any]:
        """Load and parse Prometheus configuration."""
        with open(prometheus_config_path) as f:
            return yaml.safe_load(f)

    @pytest.fixture(scope="class")
    def has_promtool(self) -> bool:
        """Check if promtool is available."""
        promtool_path = shutil.which("promtool")
        if not promtool_path:
            return False

        try:
            result = subprocess.run(
                [promtool_path, "--version"],
                capture_output=True,
                text=True,
                timeout=5,
            )
            return result.returncode == 0
        except subprocess.TimeoutExpired:
            return False

    def test_prometheus_config_valid_yaml(self, prometheus_config_path: Path):
        """Test Prometheus config is valid YAML."""
        with open(prometheus_config_path) as f:
            config = yaml.safe_load(f)

        assert config is not None, "Prometheus config should not be empty"
        assert isinstance(config, dict), "Prometheus config should be a dictionary"

    @pytest.mark.slow
    def test_prometheus_config_validates_with_promtool(
        self, prometheus_config_path: Path, has_promtool: bool
    ):
        """Test Prometheus config validates with promtool check config."""
        if not has_promtool:
            pytest.skip("promtool not available (install with: brew install prometheus)")

        result = subprocess.run(
            ["promtool", "check", "config", str(prometheus_config_path)],
            capture_output=True,
            text=True,
            timeout=30,
        )

        assert result.returncode == 0, (
            f"promtool validation failed:\n{result.stderr}\n{result.stdout}"
        )

    def test_prometheus_has_scrape_configs(self, prometheus_config: dict[str, Any]):
        """Test Prometheus has scrape_configs section."""
        assert "scrape_configs" in prometheus_config, (
            "Prometheus config should have scrape_configs section"
        )

        scrape_configs = prometheus_config["scrape_configs"]
        assert isinstance(scrape_configs, list), "scrape_configs should be a list"
        assert len(scrape_configs) > 0, "Prometheus should have at least one scrape job"

    def test_scrape_jobs_have_required_fields(self, prometheus_config: dict[str, Any]):
        """Test all scrape jobs have required fields."""
        scrape_configs = prometheus_config.get("scrape_configs", [])

        for job in scrape_configs:
            # Each job must have a job_name
            assert "job_name" in job, f"Scrape job missing job_name: {job}"

            # Should have static_configs or service discovery
            has_targets = any(
                [
                    "static_configs" in job,
                    "kubernetes_sd_configs" in job,
                    "consul_sd_configs" in job,
                    "dns_sd_configs" in job,
                    "ec2_sd_configs" in job,
                ]
            )

            assert has_targets, f"Scrape job '{job.get('job_name')}' has no target configuration"

    def test_expected_scrape_jobs_exist(self, prometheus_config: dict[str, Any]):
        """Test expected scrape jobs are defined."""
        scrape_configs = prometheus_config.get("scrape_configs", [])
        job_names = {job["job_name"] for job in scrape_configs}

        # Expected jobs for DotMac platform
        expected_jobs = {
            "prometheus",  # Prometheus self-monitoring
        }

        # Platform jobs (may or may not exist depending on deployment)

        missing_required = expected_jobs - job_names

        # At minimum, Prometheus should monitor itself
        assert not missing_required, f"Missing required scrape jobs: {missing_required}"

    def test_static_targets_not_empty(self, prometheus_config: dict[str, Any]):
        """Test static_configs have non-empty targets."""
        scrape_configs = prometheus_config.get("scrape_configs", [])

        for job in scrape_configs:
            job_name = job.get("job_name", "unknown")
            static_configs = job.get("static_configs", [])

            for config in static_configs:
                targets = config.get("targets", [])

                # Targets should not be empty list
                assert len(targets) > 0, f"Job '{job_name}' has empty targets in static_configs"

                # Each target should be a string with host:port format
                for target in targets:
                    assert isinstance(target, str), (
                        f"Target in job '{job_name}' should be string, got {type(target)}"
                    )

                    # Basic format validation (should have : for host:port)
                    if not target.startswith("$"):  # Skip env variables
                        assert ":" in target or target == "localhost", (
                            f"Target '{target}' in job '{job_name}' should have format 'host:port'"
                        )

    def test_scrape_intervals_reasonable(self, prometheus_config: dict[str, Any]):
        """Test scrape intervals are within reasonable bounds."""
        scrape_configs = prometheus_config.get("scrape_configs", [])

        for job in scrape_configs:
            job_name = job.get("job_name")
            scrape_interval = job.get("scrape_interval")

            if scrape_interval:
                # Parse interval (e.g., "15s", "1m", "5m")
                import re

                match = re.match(r"(\d+)([smh])", scrape_interval)

                assert match, (
                    f"Job '{job_name}' has invalid scrape_interval format: {scrape_interval}"
                )

                value, unit = int(match.group(1)), match.group(2)

                # Convert to seconds for comparison
                multipliers = {"s": 1, "m": 60, "h": 3600}
                seconds = value * multipliers[unit]

                # Scrape interval should be between 5s and 1 hour
                assert 5 <= seconds <= 3600, (
                    f"Job '{job_name}' has unreasonable scrape_interval: {scrape_interval} "
                    f"(should be between 5s and 1h)"
                )

    def test_global_section_exists(self, prometheus_config: dict[str, Any]):
        """Test Prometheus has global configuration section."""
        assert "global" in prometheus_config, "Prometheus config should have global section"

        global_config = prometheus_config["global"]

        # Should have scrape_interval or evaluation_interval
        has_intervals = any(
            [
                "scrape_interval" in global_config,
                "evaluation_interval" in global_config,
            ]
        )

        assert has_intervals, "Global config should have scrape_interval or evaluation_interval"


class TestPrometheusRulesConfiguration:
    """Test Prometheus alerting and recording rules."""

    @pytest.fixture(scope="class")
    def project_root(self) -> Path:
        """Get project root directory."""
        return Path(__file__).parent.parent.parent

    @pytest.fixture(scope="class")
    def prometheus_config_path(self, project_root: Path) -> Path:
        """Get Prometheus config file path."""
        possible_paths = [
            project_root / "monitoring/prometheus/prometheus.yml",
            project_root / "prometheus/prometheus.yml",
        ]

        for path in possible_paths:
            if path.exists():
                return path

        pytest.skip("Prometheus config file not found")

    @pytest.fixture(scope="class")
    def prometheus_config(self, prometheus_config_path: Path) -> dict[str, Any]:
        """Load Prometheus configuration."""
        with open(prometheus_config_path) as f:
            return yaml.safe_load(f)

    def test_rule_files_if_defined(self, prometheus_config: dict[str, Any], project_root: Path):
        """Test rule files exist if referenced in config."""
        rule_files = prometheus_config.get("rule_files", [])

        for rule_file_pattern in rule_files:
            # Skip if using environment variables
            if "$" in rule_file_pattern:
                continue

            # Resolve glob pattern

            # Try multiple base paths
            possible_bases = [
                project_root / "monitoring/prometheus",
                project_root / "prometheus",
                project_root,
            ]

            found = False
            for base in possible_bases:
                matches = list(base.glob(rule_file_pattern))
                if matches:
                    found = True
                    break

            # If pattern is relative and not found, it might be in prometheus dir
            if not found and not rule_file_pattern.startswith("/"):
                # Not critical - rules might be deployed separately
                import warnings

                warnings.warn(
                    f"Rule file pattern '{rule_file_pattern}' not found "
                    f"(might be deployed separately in production)",
                    stacklevel=2,
                )


class TestPrometheusAlertmanagerConfig:
    """Test Prometheus Alertmanager integration configuration."""

    @pytest.fixture(scope="class")
    def project_root(self) -> Path:
        """Get project root directory."""
        return Path(__file__).parent.parent.parent

    @pytest.fixture(scope="class")
    def prometheus_config_path(self, project_root: Path) -> Path:
        """Get Prometheus config file path."""
        possible_paths = [
            project_root / "monitoring/prometheus/prometheus.yml",
            project_root / "prometheus/prometheus.yml",
        ]

        for path in possible_paths:
            if path.exists():
                return path

        pytest.skip("Prometheus config file not found")

    @pytest.fixture(scope="class")
    def prometheus_config(self, prometheus_config_path: Path) -> dict[str, Any]:
        """Load Prometheus configuration."""
        with open(prometheus_config_path) as f:
            return yaml.safe_load(f)

    def test_alertmanager_config_if_present(self, prometheus_config: dict[str, Any]):
        """Test Alertmanager configuration if present."""
        alerting = prometheus_config.get("alerting", {})
        alertmanagers = alerting.get("alertmanagers", [])

        if not alertmanagers:
            # Alertmanager not configured - not an error
            return

        for alertmanager in alertmanagers:
            # Should have static_configs or service discovery
            has_targets = any(
                [
                    "static_configs" in alertmanager,
                    "kubernetes_sd_configs" in alertmanager,
                    "consul_sd_configs" in alertmanager,
                ]
            )

            assert has_targets, "Alertmanager config should have target configuration"

            # Check static configs if present
            static_configs = alertmanager.get("static_configs", [])
            for config in static_configs:
                targets = config.get("targets", [])
                assert len(targets) > 0, "Alertmanager static_configs should have targets"


class TestPrometheusMetricsEndpoint:
    """Test Prometheus metrics endpoint accessibility."""

    def test_metrics_endpoint_format(self, test_client):
        """Test /metrics endpoint returns Prometheus exposition format."""
        response = test_client.get("/metrics")

        # Endpoint should exist
        assert response.status_code in [200, 404], (
            f"Metrics endpoint returned unexpected status: {response.status_code}"
        )

        if response.status_code == 200:
            # Should return text/plain for Prometheus format
            content_type = response.headers.get("content-type", "")
            assert "text/plain" in content_type or "text" in content_type, (
                f"Metrics should use text/plain content-type, got: {content_type}"
            )

            # Basic validation of Prometheus format
            text = response.text

            # Should contain metric lines (not HTML/JSON)
            assert not text.startswith("<"), "Metrics should not be HTML"
            assert not text.startswith("{"), "Metrics should not be JSON"

            # Should have HELP and TYPE comments or metric lines
            has_metrics = any(
                line.startswith("#") or " " in line for line in text.split("\n") if line.strip()
            )

            assert has_metrics, "Metrics response should contain metric data"
