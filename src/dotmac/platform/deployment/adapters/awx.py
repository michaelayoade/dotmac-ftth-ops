"""
AWX/Ansible Deployment Adapter

Handles deployment to on-premises infrastructure using AWX Tower and Ansible.
"""

import asyncio
import json
from datetime import datetime
from typing import Any, Literal, cast, overload

import aiohttp

from .base import DeploymentAdapter, DeploymentResult, ExecutionContext, ExecutionStatus


class AWXAdapter(DeploymentAdapter):
    """
    AWX/Ansible deployment adapter

    Manages deployments to on-premises infrastructure using AWX Tower
    for automation and Ansible playbooks for configuration.
    """

    def __init__(self, config: dict[str, Any] | None = None):
        """
        Initialize AWX adapter

        Config options:
            - awx_url: AWX Tower base URL
            - awx_token: API token for authentication
            - awx_username: Username for authentication (alternative to token)
            - awx_password: Password for authentication
            - verify_ssl: Verify SSL certificates (default: True)
            - organization_id: AWX organization ID
            - default_inventory_id: Default inventory ID
            - timeout_seconds: Job timeout in seconds
        """
        super().__init__(config)
        self.awx_url = self.config.get("awx_url", "").rstrip("/")
        self.awx_token = self.config.get("awx_token")
        self.awx_username = self.config.get("awx_username")
        self.awx_password = self.config.get("awx_password")
        self.verify_ssl = self.config.get("verify_ssl", True)
        self.organization_id = self.config.get("organization_id")
        self.default_inventory_id = self.config.get("default_inventory_id")
        self.timeout_seconds = self.config.get("timeout_seconds", 3600)

    async def provision(self, context: ExecutionContext) -> DeploymentResult:
        """Provision deployment using Ansible playbook"""
        self._log_operation("provision", context, "Starting AWX provisioning")
        started_at = datetime.utcnow()

        try:
            # Build playbook extra vars
            extra_vars = self._build_extra_vars(context, operation="provision")

            # Launch AWX job template
            job_template_name = f"{context.template_name}-provision"
            job = await self._launch_job_template(
                template_name=job_template_name,
                extra_vars=extra_vars,
                inventory_id=self.default_inventory_id,
            )

            job_id = job["id"]
            job_url = f"{self.awx_url}/#/jobs/playbook/{job_id}"

            # Wait for job completion
            final_status = await self._wait_for_job(job_id, timeout_seconds=self.timeout_seconds)

            # Get job output
            job_output = await self._get_job_output(job_id)

            # Extract endpoints from job output
            endpoints = self._extract_endpoints(final_status)

            completed_at = datetime.utcnow()
            duration = (completed_at - started_at).total_seconds()

            if final_status["status"] == "successful":
                self._log_operation("provision", context, f"Completed successfully in {duration}s")
                return DeploymentResult(
                    status=ExecutionStatus.SUCCEEDED,
                    message=f"Successfully provisioned deployment via AWX job {job_id}",
                    backend_job_id=str(job_id),
                    backend_job_url=job_url,
                    logs=job_output,
                    endpoints=endpoints,
                    metadata={"job_id": job_id, "job_url": job_url},
                    started_at=started_at,
                    completed_at=completed_at,
                    duration_seconds=duration,
                )
            else:
                raise Exception(f"AWX job failed with status: {final_status['status']}")

        except Exception as e:
            self._log_error("provision", context, e)
            completed_at = datetime.utcnow()
            return DeploymentResult(
                status=ExecutionStatus.FAILED,
                message=f"Provisioning failed: {str(e)}",
                error_code="AWX_PROVISION_FAILED",
                error_details={"exception": str(e)},
                started_at=started_at,
                completed_at=completed_at,
                duration_seconds=(completed_at - started_at).total_seconds(),
                rollback_required=True,
            )

    async def upgrade(self, context: ExecutionContext) -> DeploymentResult:
        """Upgrade deployment using Ansible playbook"""
        self._log_operation(
            "upgrade", context, f"Upgrading from {context.from_version} to {context.to_version}"
        )
        started_at = datetime.utcnow()

        try:
            extra_vars = self._build_extra_vars(context, operation="upgrade")
            job_template_name = f"{context.template_name}-upgrade"

            job = await self._launch_job_template(
                template_name=job_template_name,
                extra_vars=extra_vars,
                inventory_id=self.default_inventory_id,
            )

            job_id = job["id"]
            final_status = await self._wait_for_job(job_id, timeout_seconds=self.timeout_seconds)
            job_output = await self._get_job_output(job_id)

            completed_at = datetime.utcnow()
            duration = (completed_at - started_at).total_seconds()

            if final_status["status"] == "successful":
                return DeploymentResult(
                    status=ExecutionStatus.SUCCEEDED,
                    message=f"Successfully upgraded to version {context.to_version}",
                    backend_job_id=str(job_id),
                    backend_job_url=f"{self.awx_url}/#/jobs/playbook/{job_id}",
                    logs=job_output,
                    started_at=started_at,
                    completed_at=completed_at,
                    duration_seconds=duration,
                )
            else:
                raise Exception(f"AWX upgrade job failed: {final_status['status']}")

        except Exception as e:
            self._log_error("upgrade", context, e)
            return DeploymentResult(
                status=ExecutionStatus.FAILED,
                message=f"Upgrade failed: {str(e)}",
                error_code="AWX_UPGRADE_FAILED",
                rollback_required=True,
            )

    async def suspend(self, context: ExecutionContext) -> DeploymentResult:
        """Suspend deployment"""
        return await self._run_operation(context, "suspend", "Deployment suspended")

    async def resume(self, context: ExecutionContext) -> DeploymentResult:
        """Resume deployment"""
        return await self._run_operation(context, "resume", "Deployment resumed")

    async def destroy(self, context: ExecutionContext) -> DeploymentResult:
        """Destroy deployment"""
        return await self._run_operation(context, "destroy", "Deployment destroyed")

    async def scale(self, context: ExecutionContext) -> DeploymentResult:
        """Scale deployment"""
        return await self._run_operation(context, "scale", "Deployment scaled")

    async def get_status(self, context: ExecutionContext) -> dict[str, Any]:
        """Get deployment status via AWX fact gathering"""
        try:
            extra_vars = self._build_extra_vars(context, operation="status")
            job = await self._launch_job_template(
                template_name=f"{context.template_name}-status",
                extra_vars=extra_vars,
                inventory_id=self.default_inventory_id,
            )

            final_status = await self._wait_for_job(job["id"], timeout_seconds=300)
            return final_status.get("extra_vars", {}).get("status", {"ready": False})

        except Exception as e:
            self.logger.error(f"Failed to get status: {e}")
            return {"ready": False, "error": str(e)}

    async def get_logs(self, context: ExecutionContext, lines: int = 100) -> str:
        """Get deployment logs"""
        try:
            # Get most recent job for this instance
            jobs = await self._api_request("GET", "/api/v2/jobs/", params={"order_by": "-created"})
            results = jobs.get("results")
            if isinstance(results, list) and results:
                first_job = cast(dict[str, Any], results[0])
                job_id = int(first_job["id"])
                return await self._get_job_output(job_id)
            return "No jobs found"
        except Exception as e:
            return f"Failed to get logs: {e}"

    async def validate_config(self, context: ExecutionContext) -> tuple[bool, list[str]]:
        """Validate AWX configuration"""
        errors = []

        # Check AWX connectivity
        try:
            await self._api_request("GET", "/api/v2/ping/")
        except Exception as e:
            errors.append(f"Cannot connect to AWX: {e}")

        # Check job template exists
        try:
            template_name = f"{context.template_name}-provision"
            await self._get_job_template(template_name)
        except Exception:
            errors.append(f"Job template '{template_name}' not found in AWX")

        return len(errors) == 0, errors

    # Helper methods

    def _build_extra_vars(self, context: ExecutionContext, operation: str) -> dict[str, Any]:
        """Build Ansible extra vars"""
        extra_vars = {
            "operation": operation,
            "tenant_id": context.tenant_id,
            "instance_id": context.instance_id,
            "environment": context.environment,
            "region": context.region,
            "version": context.to_version or context.template_version,
            "config": context.config,
            "resources": {
                "cpu_cores": context.cpu_cores,
                "memory_gb": context.memory_gb,
                "storage_gb": context.storage_gb,
            },
        }

        if context.secrets:
            extra_vars["secrets"] = context.secrets

        return extra_vars

    async def _run_operation(
        self, context: ExecutionContext, operation: str, success_message: str
    ) -> DeploymentResult:
        """Run generic AWX operation"""
        started_at = datetime.utcnow()
        try:
            extra_vars = self._build_extra_vars(context, operation=operation)
            job = await self._launch_job_template(
                template_name=f"{context.template_name}-{operation}",
                extra_vars=extra_vars,
                inventory_id=self.default_inventory_id,
            )

            final_status = await self._wait_for_job(job["id"], timeout_seconds=self.timeout_seconds)
            completed_at = datetime.utcnow()

            if final_status["status"] == "successful":
                return DeploymentResult(
                    status=ExecutionStatus.SUCCEEDED,
                    message=success_message,
                    backend_job_id=str(job["id"]),
                    started_at=started_at,
                    completed_at=completed_at,
                    duration_seconds=(completed_at - started_at).total_seconds(),
                )
            else:
                raise Exception(f"Job failed: {final_status['status']}")

        except Exception as e:
            return DeploymentResult(
                status=ExecutionStatus.FAILED,
                message=f"{operation.capitalize()} failed: {str(e)}",
                error_code=f"AWX_{operation.upper()}_FAILED",
            )

    async def _launch_job_template(
        self, template_name: str, extra_vars: dict[str, Any], inventory_id: int | None = None
    ) -> dict[str, Any]:
        """Launch AWX job template"""
        template = await self._get_job_template(template_name)
        template_id = template["id"]

        launch_data: dict[str, Any] = {"extra_vars": json.dumps(extra_vars)}
        if inventory_id:
            launch_data["inventory"] = inventory_id

        return await self._api_request(
            "POST", f"/api/v2/job_templates/{template_id}/launch/", json_body=launch_data
        )

    async def _get_job_template(self, template_name: str) -> dict[str, Any]:
        """Get job template by name"""
        response = await self._api_request(
            "GET", "/api/v2/job_templates/", params={"name": template_name}
        )

        results = cast(list[dict[str, Any]], response.get("results", []))
        if not results:
            raise Exception(f"Job template '{template_name}' not found")

        return results[0]

    async def _wait_for_job(self, job_id: int, timeout_seconds: int = 3600) -> dict[str, Any]:
        """Wait for AWX job completion"""
        start_time = datetime.utcnow()
        while (datetime.utcnow() - start_time).total_seconds() < timeout_seconds:
            job = await self._api_request("GET", f"/api/v2/jobs/{job_id}/")

            status = job.get("status")
            if status in ("successful", "failed", "error", "canceled"):
                return job

            await asyncio.sleep(5)

        raise TimeoutError(f"Job {job_id} did not complete within {timeout_seconds} seconds")

    async def _get_job_output(self, job_id: int) -> str:
        """Get job output/logs"""
        try:
            return await self._api_request(
                "GET",
                f"/api/v2/jobs/{job_id}/stdout/",
                params={"format": "txt"},
                expect_text=True,
            )
        except Exception as e:
            return f"Failed to get job output: {e}"

    def _extract_endpoints(self, job_status: dict[str, Any]) -> dict[str, str]:
        """Extract service endpoints from job results"""
        extra_vars = job_status.get("extra_vars", {})
        return extra_vars.get("endpoints", {})

    @overload
    async def _api_request(
        self,
        method: str,
        path: str,
        *,
        json_body: dict[str, Any] | None = ...,
        params: dict[str, Any] | None = ...,
        expect_text: Literal[False] = ...,
    ) -> dict[str, Any]: ...

    @overload
    async def _api_request(
        self,
        method: str,
        path: str,
        *,
        json_body: dict[str, Any] | None = ...,
        params: dict[str, Any] | None = ...,
        expect_text: Literal[True],
    ) -> str: ...

    async def _api_request(
        self,
        method: str,
        path: str,
        *,
        json_body: dict[str, Any] | None = None,
        params: dict[str, Any] | None = None,
        expect_text: bool = False,
    ) -> dict[str, Any] | str:
        """Make AWX API request"""
        url = f"{self.awx_url}{path}"
        headers = {}

        # Authentication
        if self.awx_token:
            headers["Authorization"] = f"Bearer {self.awx_token}"

        auth = None
        if self.awx_username and self.awx_password:
            auth = aiohttp.BasicAuth(self.awx_username, self.awx_password)

        async with aiohttp.ClientSession() as session:
            async with session.request(
                method,
                url,
                json=json_body,
                params=params,
                headers=headers,
                auth=auth,
                ssl=self.verify_ssl,
            ) as response:
                response.raise_for_status()

                if expect_text:
                    return await response.text()

                data = await response.json()
                if isinstance(data, dict):
                    return data
                raise ValueError("Expected JSON object from AWX API response")
