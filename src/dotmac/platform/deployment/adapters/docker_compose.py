"""
Docker Compose Deployment Adapter

Handles deployment to standalone hosts using Docker Compose.
"""

import asyncio
from datetime import datetime
from pathlib import Path
from typing import Any

import yaml

from .base import DeploymentAdapter, DeploymentResult, ExecutionContext, ExecutionStatus


class DockerComposeAdapter(DeploymentAdapter):
    """
    Docker Compose deployment adapter

    Manages deployments using docker-compose for standalone or edge deployments.
    Suitable for small-scale on-premises installations.
    """

    def __init__(self, config: dict[str, Any] | None = None):
        """
        Initialize Docker Compose adapter

        Config options:
            - compose_files_path: Base path for compose files
            - docker_host: Docker host URL (default: local)
            - project_name_prefix: Prefix for compose project names
        """
        super().__init__(config)
        self.compose_files_path = Path(self.config.get("compose_files_path", "/opt/dotmac/compose"))
        self.docker_host = self.config.get("docker_host")
        self.project_name_prefix = self.config.get("project_name_prefix", "dotmac")

    async def provision(self, context: ExecutionContext) -> DeploymentResult:
        """Provision deployment with docker-compose"""
        self._log_operation("provision", context, "Starting docker-compose provisioning")
        started_at = datetime.utcnow()

        try:
            # Generate compose file
            compose_file = await self._generate_compose_file(context)

            # Write compose file
            project_name = self._get_project_name(context)
            compose_path = self.compose_files_path / project_name / "docker-compose.yml"
            compose_path.parent.mkdir(parents=True, exist_ok=True)
            compose_path.write_text(yaml.dump(compose_file))

            # Run docker-compose up
            await self._compose_up(project_name, compose_path)

            # Get service endpoints
            endpoints = await self._get_service_urls(project_name)

            completed_at = datetime.utcnow()
            duration = (completed_at - started_at).total_seconds()

            self._log_operation("provision", context, f"Completed successfully in {duration}s")

            return DeploymentResult(
                status=ExecutionStatus.SUCCEEDED,
                message=f"Successfully provisioned deployment with docker-compose (project: {project_name})",
                backend_job_id=project_name,
                logs=f"Compose file created at {compose_path}",
                endpoints=endpoints,
                metadata={"project_name": project_name, "compose_path": str(compose_path)},
                started_at=started_at,
                completed_at=completed_at,
                duration_seconds=duration,
            )

        except Exception as e:
            self._log_error("provision", context, e)
            return DeploymentResult(
                status=ExecutionStatus.FAILED,
                message=f"Provisioning failed: {str(e)}",
                error_code="COMPOSE_PROVISION_FAILED",
                rollback_required=True,
            )

    async def upgrade(self, context: ExecutionContext) -> DeploymentResult:
        """Upgrade deployment"""
        started_at = datetime.utcnow()
        try:
            project_name = self._get_project_name(context)
            compose_file = await self._generate_compose_file(context)
            compose_path = self.compose_files_path / project_name / "docker-compose.yml"
            compose_path.write_text(yaml.dump(compose_file))

            # Pull new images and restart
            await self._compose_pull(project_name, compose_path)
            await self._compose_up(project_name, compose_path, force_recreate=True)

            completed_at = datetime.utcnow()
            return DeploymentResult(
                status=ExecutionStatus.SUCCEEDED,
                message=f"Upgraded to version {context.to_version}",
                backend_job_id=project_name,
                started_at=started_at,
                completed_at=completed_at,
                duration_seconds=(completed_at - started_at).total_seconds(),
            )
        except Exception as e:
            return DeploymentResult(
                status=ExecutionStatus.FAILED, message=str(e), error_code="COMPOSE_UPGRADE_FAILED"
            )

    async def suspend(self, context: ExecutionContext) -> DeploymentResult:
        """Suspend deployment"""
        try:
            project_name = self._get_project_name(context)
            await self._compose_stop(project_name)
            return DeploymentResult(
                status=ExecutionStatus.SUCCEEDED, message="Deployment suspended"
            )
        except Exception as e:
            return DeploymentResult(status=ExecutionStatus.FAILED, message=str(e))

    async def resume(self, context: ExecutionContext) -> DeploymentResult:
        """Resume deployment"""
        try:
            project_name = self._get_project_name(context)
            compose_path = self.compose_files_path / project_name / "docker-compose.yml"
            await self._compose_start(project_name, compose_path)
            return DeploymentResult(status=ExecutionStatus.SUCCEEDED, message="Deployment resumed")
        except Exception as e:
            return DeploymentResult(status=ExecutionStatus.FAILED, message=str(e))

    async def destroy(self, context: ExecutionContext) -> DeploymentResult:
        """Destroy deployment"""
        try:
            project_name = self._get_project_name(context)
            await self._compose_down(project_name, remove_volumes=True)
            return DeploymentResult(
                status=ExecutionStatus.SUCCEEDED, message="Deployment destroyed"
            )
        except Exception as e:
            return DeploymentResult(status=ExecutionStatus.FAILED, message=str(e))

    async def scale(self, context: ExecutionContext) -> DeploymentResult:
        """Scale deployment"""
        try:
            project_name = self._get_project_name(context)
            # Regenerate compose file with new resource limits
            compose_file = await self._generate_compose_file(context)
            compose_path = self.compose_files_path / project_name / "docker-compose.yml"
            compose_path.write_text(yaml.dump(compose_file))
            await self._compose_up(project_name, compose_path, force_recreate=True)
            return DeploymentResult(status=ExecutionStatus.SUCCEEDED, message="Deployment scaled")
        except Exception as e:
            return DeploymentResult(status=ExecutionStatus.FAILED, message=str(e))

    async def get_status(self, context: ExecutionContext) -> dict[str, Any]:
        """Get deployment status"""
        try:
            project_name = self._get_project_name(context)
            output = await self._run_compose_command(project_name, ["ps", "--format", "json"])
            services = yaml.safe_load(output) if output else []
            running = sum(1 for s in services if s.get("State") == "running")
            return {
                "ready": running > 0,
                "running_services": running,
                "total_services": len(services),
            }
        except Exception as e:
            return {"ready": False, "error": str(e)}

    async def get_logs(self, context: ExecutionContext, lines: int = 100) -> str:
        """Get deployment logs"""
        try:
            project_name = self._get_project_name(context)
            return await self._run_compose_command(project_name, ["logs", "--tail", str(lines)])
        except Exception as e:
            return f"Failed to get logs: {e}"

    async def validate_config(self, context: ExecutionContext) -> tuple[bool, list[str]]:
        """Validate configuration"""
        errors = []
        if not self.compose_files_path.exists():
            errors.append(f"Compose files path does not exist: {self.compose_files_path}")
        return len(errors) == 0, errors

    # Helper methods

    def _get_project_name(self, context: ExecutionContext) -> str:
        """Get docker-compose project name"""
        return f"{self.project_name_prefix}-tenant{context.tenant_id}-{context.environment}"

    async def _generate_compose_file(self, context: ExecutionContext) -> dict[str, Any]:
        """Generate docker-compose configuration"""
        cpu_limit = context.cpu_cores or 2
        memory_limit = f"{context.memory_gb or 4}g"

        compose = {
            "version": "3.8",
            "services": {
                "api": {
                    "image": f"dotmac/platform-api:{context.to_version or context.template_version}",
                    "environment": self._build_environment(context),
                    "deploy": {
                        "resources": {"limits": {"cpus": str(cpu_limit), "memory": memory_limit}}
                    },
                    "ports": ["8000:8000"],
                    "depends_on": ["db", "redis"],
                },
                "db": {
                    "image": "postgres:14-alpine",
                    "environment": {
                        "POSTGRES_USER": "dotmac",
                        "POSTGRES_PASSWORD": context.secrets.get("db_password", "changeme"),
                        "POSTGRES_DB": f"tenant_{context.tenant_id}",
                    },
                    "volumes": ["db_data:/var/lib/postgresql/data"],
                },
                "redis": {"image": "redis:7-alpine", "volumes": ["redis_data:/data"]},
            },
            "volumes": {"db_data": {}, "redis_data": {}},
        }

        return compose

    def _build_environment(self, context: ExecutionContext) -> dict[str, str]:
        """Build environment variables"""
        env = {
            "TENANT_ID": str(context.tenant_id),
            "ENVIRONMENT": context.environment,
            "DATABASE_URL": f"postgresql://dotmac:password@db:5432/tenant_{context.tenant_id}",
            "REDIS_URL": "redis://redis:6379/0",
        }
        env.update({k: str(v) for k, v in context.config.items()})
        return env

    async def _compose_up(
        self, project_name: str, compose_path: Path, force_recreate: bool = False
    ) -> None:
        """Run docker-compose up"""
        cmd = ["up", "-d"]
        if force_recreate:
            cmd.append("--force-recreate")
        await self._run_compose_command(project_name, cmd, compose_file=compose_path)

    async def _compose_down(self, project_name: str, remove_volumes: bool = False) -> None:
        """Run docker-compose down"""
        cmd = ["down"]
        if remove_volumes:
            cmd.append("--volumes")
        await self._run_compose_command(project_name, cmd)

    async def _compose_stop(self, project_name: str) -> None:
        """Stop services"""
        await self._run_compose_command(project_name, ["stop"])

    async def _compose_start(self, project_name: str, compose_path: Path) -> None:
        """Start services"""
        await self._run_compose_command(project_name, ["start"], compose_file=compose_path)

    async def _compose_pull(self, project_name: str, compose_path: Path) -> None:
        """Pull images"""
        await self._run_compose_command(project_name, ["pull"], compose_file=compose_path)

    async def _get_service_urls(self, project_name: str) -> dict[str, str]:
        """Get service URLs"""
        # Simplified - in production, would inspect actual ports
        return {"api": "http://localhost:8000"}

    async def _run_compose_command(
        self, project_name: str, args: list[str], compose_file: Path | None = None
    ) -> str:
        """Run docker-compose command"""
        cmd = ["docker-compose", "-p", project_name]
        if compose_file:
            cmd.extend(["-f", str(compose_file)])
        if self.docker_host:
            cmd = ["DOCKER_HOST=" + self.docker_host] + cmd
        cmd.extend(args)

        process = await asyncio.create_subprocess_exec(
            *cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE
        )
        stdout, stderr = await process.communicate()

        if process.returncode != 0:
            raise Exception(f"Command failed: {' '.join(cmd)}\n{stderr.decode()}")

        return stdout.decode()
