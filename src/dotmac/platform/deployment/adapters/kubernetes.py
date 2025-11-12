"""
Kubernetes/Helm Deployment Adapter

Handles deployment to Kubernetes clusters using Helm charts.
"""

import asyncio
import json
from collections.abc import Sequence
from datetime import datetime
from typing import Any

from .base import DeploymentAdapter, DeploymentResult, ExecutionContext, ExecutionStatus


class KubernetesAdapter(DeploymentAdapter):
    """
    Kubernetes/Helm deployment adapter

    Manages deployments using Helm charts and kubectl for Kubernetes operations.
    Suitable for cloud-native multi-tenant deployments in shared clusters.
    """

    def __init__(self, config: dict[str, Any] | None = None):
        """
        Initialize Kubernetes adapter

        Config options:
            - kubeconfig_path: Path to kubeconfig file
            - default_cluster: Default cluster name
            - helm_repo_url: Helm repository URL
            - helm_repo_name: Helm repository name
            - default_storage_class: Storage class for PVCs
            - network_policy_enabled: Enable network policies
            - resource_quotas_enabled: Enable resource quotas
        """
        super().__init__(config)
        self.kubeconfig_path = self.config.get("kubeconfig_path")
        self.default_cluster = self.config.get("default_cluster", "default")
        self.helm_repo_url = self.config.get("helm_repo_url")
        self.helm_repo_name = self.config.get("helm_repo_name", "dotmac")
        self.storage_class = self.config.get("default_storage_class", "standard")
        self.network_policy_enabled = self.config.get("network_policy_enabled", True)
        self.resource_quotas_enabled = self.config.get("resource_quotas_enabled", True)

    async def provision(self, context: ExecutionContext) -> DeploymentResult:
        """Provision new Kubernetes deployment"""
        self._log_operation("provision", context, "Starting provisioning")
        started_at = datetime.utcnow()

        try:
            # Create namespace
            await self._create_namespace(context)

            # Apply network policies
            if self.network_policy_enabled:
                await self._apply_network_policies(context)

            # Apply resource quotas
            if self.resource_quotas_enabled:
                await self._apply_resource_quotas(context)

            # Install Helm chart
            release_name = f"{context.namespace}-platform"
            helm_values = self._build_helm_values(context)

            result = await self._helm_install(
                release_name=release_name,
                chart=f"{self.helm_repo_name}/{context.template_name}",
                namespace=context.namespace,
                values=helm_values,
                version=context.template_version,
            )

            # Wait for deployment to be ready
            await self._wait_for_ready(context, timeout_seconds=600)

            # Get service endpoints
            endpoints = await self._get_service_endpoints(context)

            completed_at = datetime.utcnow()
            duration = (completed_at - started_at).total_seconds()

            self._log_operation("provision", context, f"Completed successfully in {duration}s")

            return DeploymentResult(
                status=ExecutionStatus.SUCCEEDED,
                message=f"Successfully provisioned deployment in namespace {context.namespace}",
                backend_job_id=release_name,
                logs=result.get("logs"),
                endpoints=endpoints,
                metadata={
                    "namespace": context.namespace,
                    "release_name": release_name,
                    "cluster": context.cluster_name or self.default_cluster,
                },
                started_at=started_at,
                completed_at=completed_at,
                duration_seconds=duration,
            )

        except Exception as e:
            self._log_error("provision", context, e)
            completed_at = datetime.utcnow()
            return DeploymentResult(
                status=ExecutionStatus.FAILED,
                message=f"Provisioning failed: {str(e)}",
                error_code="PROVISION_FAILED",
                error_details={"exception": str(e), "type": type(e).__name__},
                started_at=started_at,
                completed_at=completed_at,
                duration_seconds=(completed_at - started_at).total_seconds(),
                rollback_required=True,
            )

    async def upgrade(self, context: ExecutionContext) -> DeploymentResult:
        """Upgrade Kubernetes deployment"""
        self._log_operation(
            "upgrade", context, f"Upgrading from {context.from_version} to {context.to_version}"
        )
        started_at = datetime.utcnow()

        try:
            release_name = f"{context.namespace}-platform"
            helm_values = self._build_helm_values(context)

            # Perform Helm upgrade
            result = await self._helm_upgrade(
                release_name=release_name,
                chart=f"{self.helm_repo_name}/{context.template_name}",
                namespace=context.namespace,
                values=helm_values,
                version=context.to_version,
            )

            # Wait for rollout to complete
            await self._wait_for_rollout(context, timeout_seconds=600)

            # Verify health
            status = await self.get_status(context)
            if not status.get("ready", False):
                raise Exception("Deployment not healthy after upgrade")

            completed_at = datetime.utcnow()
            duration = (completed_at - started_at).total_seconds()

            self._log_operation("upgrade", context, f"Completed successfully in {duration}s")

            return DeploymentResult(
                status=ExecutionStatus.SUCCEEDED,
                message=f"Successfully upgraded to version {context.to_version}",
                backend_job_id=release_name,
                logs=result.get("logs"),
                metadata={
                    "from_version": context.from_version,
                    "to_version": context.to_version,
                    "release_name": release_name,
                },
                started_at=started_at,
                completed_at=completed_at,
                duration_seconds=duration,
            )

        except Exception as e:
            self._log_error("upgrade", context, e)
            completed_at = datetime.utcnow()
            return DeploymentResult(
                status=ExecutionStatus.FAILED,
                message=f"Upgrade failed: {str(e)}",
                error_code="UPGRADE_FAILED",
                error_details={"exception": str(e), "type": type(e).__name__},
                started_at=started_at,
                completed_at=completed_at,
                duration_seconds=(completed_at - started_at).total_seconds(),
                rollback_required=True,
            )

    async def suspend(self, context: ExecutionContext) -> DeploymentResult:
        """Suspend Kubernetes deployment by scaling to zero"""
        self._log_operation("suspend", context, "Suspending deployment")
        started_at = datetime.utcnow()

        try:
            # Scale deployments to zero replicas
            await self._scale_deployments(context, replicas=0)

            completed_at = datetime.utcnow()
            self._log_operation("suspend", context, "Suspended successfully")

            return DeploymentResult(
                status=ExecutionStatus.SUCCEEDED,
                message="Deployment suspended (scaled to zero)",
                metadata={"namespace": context.namespace},
                started_at=started_at,
                completed_at=completed_at,
                duration_seconds=(completed_at - started_at).total_seconds(),
            )

        except Exception as e:
            self._log_error("suspend", context, e)
            return DeploymentResult(
                status=ExecutionStatus.FAILED,
                message=f"Suspend failed: {str(e)}",
                error_code="SUSPEND_FAILED",
            )

    async def resume(self, context: ExecutionContext) -> DeploymentResult:
        """Resume suspended Kubernetes deployment"""
        self._log_operation("resume", context, "Resuming deployment")
        started_at = datetime.utcnow()

        try:
            # Scale deployments back to original replicas
            original_replicas = context.config.get("replicas", 1)
            await self._scale_deployments(context, replicas=original_replicas)

            # Wait for pods to be ready
            await self._wait_for_ready(context, timeout_seconds=300)

            completed_at = datetime.utcnow()
            self._log_operation("resume", context, "Resumed successfully")

            return DeploymentResult(
                status=ExecutionStatus.SUCCEEDED,
                message="Deployment resumed",
                metadata={"namespace": context.namespace, "replicas": original_replicas},
                started_at=started_at,
                completed_at=completed_at,
                duration_seconds=(completed_at - started_at).total_seconds(),
            )

        except Exception as e:
            self._log_error("resume", context, e)
            return DeploymentResult(
                status=ExecutionStatus.FAILED,
                message=f"Resume failed: {str(e)}",
                error_code="RESUME_FAILED",
            )

    async def destroy(self, context: ExecutionContext) -> DeploymentResult:
        """Destroy Kubernetes deployment"""
        self._log_operation("destroy", context, "Destroying deployment")
        started_at = datetime.utcnow()

        try:
            release_name = f"{context.namespace}-platform"

            # Uninstall Helm release
            await self._helm_uninstall(release_name=release_name, namespace=context.namespace)

            # Delete namespace (this removes all resources)
            await self._delete_namespace(context)

            completed_at = datetime.utcnow()
            self._log_operation("destroy", context, "Destroyed successfully")

            return DeploymentResult(
                status=ExecutionStatus.SUCCEEDED,
                message=f"Deployment destroyed (namespace {context.namespace} deleted)",
                metadata={"namespace": context.namespace},
                started_at=started_at,
                completed_at=completed_at,
                duration_seconds=(completed_at - started_at).total_seconds(),
            )

        except Exception as e:
            self._log_error("destroy", context, e)
            return DeploymentResult(
                status=ExecutionStatus.FAILED,
                message=f"Destroy failed: {str(e)}",
                error_code="DESTROY_FAILED",
            )

    async def scale(self, context: ExecutionContext) -> DeploymentResult:
        """Scale Kubernetes deployment resources"""
        self._log_operation("scale", context, "Scaling deployment")
        started_at = datetime.utcnow()

        try:
            # Update resource quotas if enabled
            if self.resource_quotas_enabled:
                await self._apply_resource_quotas(context)

            # Update Helm release with new resource limits
            release_name = f"{context.namespace}-platform"
            helm_values = self._build_helm_values(context)

            await self._helm_upgrade(
                release_name=release_name,
                chart=f"{self.helm_repo_name}/{context.template_name}",
                namespace=context.namespace,
                values=helm_values,
                version=context.template_version,
            )

            await self._wait_for_rollout(context, timeout_seconds=300)

            completed_at = datetime.utcnow()
            self._log_operation("scale", context, "Scaled successfully")

            return DeploymentResult(
                status=ExecutionStatus.SUCCEEDED,
                message="Deployment scaled successfully",
                metadata={
                    "cpu_cores": context.cpu_cores,
                    "memory_gb": context.memory_gb,
                },
                started_at=started_at,
                completed_at=completed_at,
                duration_seconds=(completed_at - started_at).total_seconds(),
            )

        except Exception as e:
            self._log_error("scale", context, e)
            return DeploymentResult(
                status=ExecutionStatus.FAILED,
                message=f"Scale failed: {str(e)}",
                error_code="SCALE_FAILED",
            )

    async def get_status(self, context: ExecutionContext) -> dict[str, Any]:
        """Get Kubernetes deployment status"""
        try:
            namespace = self._ensure_namespace(context)

            # Get namespace status
            namespace_info = await self._kubectl_json(["get", "namespace", namespace])

            # Get pod status
            pods_info = await self._kubectl_json(["get", "pods", "-n", namespace])

            # Get service status
            services_info = await self._kubectl_json(["get", "services", "-n", namespace])

            pods = pods_info.get("items", [])
            total_pods = len(pods)
            ready_pods = sum(1 for pod in pods if self._is_pod_ready(pod))

            return {
                "ready": ready_pods == total_pods and total_pods > 0,
                "namespace": namespace,
                "total_pods": total_pods,
                "ready_pods": ready_pods,
                "services": len(services_info.get("items", [])),
                "phase": namespace_info.get("status", {}).get("phase", "Unknown"),
            }

        except Exception as e:
            self.logger.error(f"Failed to get status: {e}")
            return {"ready": False, "error": str(e)}

    async def get_logs(self, context: ExecutionContext, lines: int = 100) -> str:
        """Get Kubernetes pod logs"""
        try:
            namespace = self._ensure_namespace(context)

            # Get first pod in namespace
            pods_info = await self._kubectl_json(["get", "pods", "-n", namespace])
            pods = pods_info.get("items", [])

            if not pods:
                return "No pods found"

            pod_name = pods[0]["metadata"]["name"]
            logs = await self._kubectl(["logs", pod_name, "-n", namespace, f"--tail={lines}"])

            return logs

        except Exception as e:
            return f"Failed to get logs: {e}"

    async def validate_config(self, context: ExecutionContext) -> tuple[bool, list[str]]:
        """Validate Kubernetes configuration"""
        errors = []

        # Validate namespace name
        if not context.namespace or len(context.namespace) > 63:
            errors.append("Invalid namespace name (must be 1-63 characters)")

        # Validate resource limits
        if context.cpu_cores and context.cpu_cores > 128:
            errors.append("CPU cores exceed maximum (128)")

        if context.memory_gb and context.memory_gb > 512:
            errors.append("Memory exceeds maximum (512GB)")

        # Validate Helm chart exists
        if not await self._helm_chart_exists(context.template_name, context.template_version):
            errors.append(
                f"Helm chart {context.template_name}:{context.template_version} not found"
            )

        return len(errors) == 0, errors

    # Helper methods

    def _ensure_namespace(self, context: ExecutionContext) -> str:
        """Return a namespace string or raise if missing."""
        if not context.namespace:
            raise ValueError("Execution context namespace is required")
        return context.namespace

    def _build_helm_values(self, context: ExecutionContext) -> dict[str, Any]:
        """Build Helm values from context"""
        values = {
            "tenant": {
                "id": context.tenant_id,
                "namespace": context.namespace,
                "environment": context.environment,
            },
            "resources": {
                "limits": {
                    "cpu": f"{context.cpu_cores or 2}",
                    "memory": f"{context.memory_gb or 4}Gi",
                },
                "requests": {
                    "cpu": f"{(context.cpu_cores or 2) // 2}",
                    "memory": f"{(context.memory_gb or 4) // 2}Gi",
                },
            },
            "persistence": {
                "enabled": True,
                "storageClass": self.storage_class,
                "size": f"{context.storage_gb or 20}Gi",
            },
        }

        # Merge with context config
        values.update(context.config)

        return values

    async def _create_namespace(self, context: ExecutionContext) -> None:
        """Create Kubernetes namespace"""
        namespace_yaml = {
            "apiVersion": "v1",
            "kind": "Namespace",
            "metadata": {
                "name": context.namespace,
                "labels": {
                    "tenant-id": str(context.tenant_id),
                    "environment": context.environment,
                    "managed-by": "dotmac-platform",
                },
            },
        }

        await self._kubectl_apply(namespace_yaml)

    async def _delete_namespace(self, context: ExecutionContext) -> None:
        """Delete Kubernetes namespace"""
        namespace = self._ensure_namespace(context)
        await self._kubectl(["delete", "namespace", namespace, "--wait=true"])

    async def _apply_network_policies(self, context: ExecutionContext) -> None:
        """Apply network policies for tenant isolation"""
        # Default deny all ingress
        policy = {
            "apiVersion": "networking.k8s.io/v1",
            "kind": "NetworkPolicy",
            "metadata": {"name": "deny-all-ingress", "namespace": context.namespace},
            "spec": {
                "podSelector": {},
                "policyTypes": ["Ingress"],
            },
        }

        await self._kubectl_apply(policy)

    async def _apply_resource_quotas(self, context: ExecutionContext) -> None:
        """Apply resource quotas to namespace"""
        quota = {
            "apiVersion": "v1",
            "kind": "ResourceQuota",
            "metadata": {"name": "tenant-quota", "namespace": context.namespace},
            "spec": {
                "hard": {
                    "requests.cpu": f"{context.cpu_cores or 2}",
                    "requests.memory": f"{context.memory_gb or 4}Gi",
                    "limits.cpu": f"{context.cpu_cores or 4}",
                    "limits.memory": f"{context.memory_gb or 8}Gi",
                    "persistentvolumeclaims": "10",
                }
            },
        }

        await self._kubectl_apply(quota)

    async def _helm_install(
        self, release_name: str, chart: str, namespace: str, values: dict[str, Any], version: str
    ) -> dict[str, Any]:
        """Install Helm chart"""
        cmd = [
            "helm",
            "install",
            release_name,
            chart,
            "--namespace",
            namespace,
            "--create-namespace",
            "--version",
            version,
            "--values",
            "-",  # Read from stdin
        ]

        values_yaml = json.dumps(values)
        result = await self._run_command(cmd, input_data=values_yaml)

        return {"logs": result}

    async def _helm_upgrade(
        self, release_name: str, chart: str, namespace: str, values: dict[str, Any], version: str
    ) -> dict[str, Any]:
        """Upgrade Helm release"""
        cmd = [
            "helm",
            "upgrade",
            release_name,
            chart,
            "--namespace",
            namespace,
            "--version",
            version,
            "--values",
            "-",
            "--wait",
        ]

        values_yaml = json.dumps(values)
        result = await self._run_command(cmd, input_data=values_yaml)

        return {"logs": result}

    async def _helm_uninstall(self, release_name: str, namespace: str) -> None:
        """Uninstall Helm release"""
        cmd = ["helm", "uninstall", release_name, "--namespace", namespace]
        await self._run_command(cmd)

    async def _helm_chart_exists(self, chart_name: str, version: str) -> bool:
        """Check if Helm chart exists"""
        try:
            cmd = [
                "helm",
                "search",
                "repo",
                f"{self.helm_repo_name}/{chart_name}",
                "--version",
                version,
            ]
            result = await self._run_command(cmd)
            return bool(result.strip())
        except Exception:
            return False

    async def _kubectl(
        self,
        args: Sequence[str],
        *,
        input_data: str | None = None,
    ) -> str:
        """Run kubectl command and return raw stdout."""
        cmd = ["kubectl"]
        if self.kubeconfig_path:
            cmd.extend(["--kubeconfig", self.kubeconfig_path])
        cmd.extend(args)

        return await self._run_command(cmd, input_data=input_data)

    async def _kubectl_json(self, args: Sequence[str]) -> dict[str, Any]:
        """Run kubectl command and parse JSON output."""
        output = await self._kubectl([*args, "-o", "json"])
        return json.loads(output) if output else {}

    async def _kubectl_apply(self, resource: dict[str, Any]) -> None:
        """Apply Kubernetes resource"""
        resource_yaml = json.dumps(resource)
        await self._kubectl(["apply", "-f", "-"], input_data=resource_yaml)

    async def _scale_deployments(self, context: ExecutionContext, replicas: int) -> None:
        """Scale all deployments in namespace"""
        namespace = self._ensure_namespace(context)
        deployments = await self._kubectl(
            [
                "get",
                "deployments",
                "-n",
                namespace,
                "-o",
                "jsonpath={.items[*].metadata.name}",
            ],
        )

        for deployment in deployments.split():
            await self._kubectl(
                [
                    "scale",
                    "deployment",
                    deployment,
                    "-n",
                    namespace,
                    f"--replicas={replicas}",
                ]
            )

    async def _wait_for_ready(self, context: ExecutionContext, timeout_seconds: int = 600) -> None:
        """Wait for deployment to be ready"""
        start_time = datetime.utcnow()
        while (datetime.utcnow() - start_time).total_seconds() < timeout_seconds:
            status = await self.get_status(context)
            if status.get("ready", False):
                return
            await asyncio.sleep(5)

        raise TimeoutError("Deployment did not become ready within timeout")

    async def _wait_for_rollout(
        self, context: ExecutionContext, timeout_seconds: int = 600
    ) -> None:
        """Wait for rollout to complete"""
        namespace = self._ensure_namespace(context)
        deployments = await self._kubectl(
            [
                "get",
                "deployments",
                "-n",
                namespace,
                "-o",
                "jsonpath={.items[*].metadata.name}",
            ],
        )

        for deployment in deployments.split():
            await self._kubectl(
                [
                    "rollout",
                    "status",
                    f"deployment/{deployment}",
                    "-n",
                    namespace,
                    f"--timeout={timeout_seconds}s",
                ]
            )

    async def _get_service_endpoints(self, context: ExecutionContext) -> dict[str, str]:
        """Get service endpoints"""
        namespace = self._ensure_namespace(context)
        services = await self._kubectl_json(["get", "services", "-n", namespace])

        endpoints = {}
        for service in services.get("items", []):
            service_name = service["metadata"]["name"]
            service_type = service["spec"].get("type", "ClusterIP")

            if service_type == "LoadBalancer":
                ingress = service.get("status", {}).get("loadBalancer", {}).get("ingress", [])
                if ingress:
                    ip = ingress[0].get("ip") or ingress[0].get("hostname")
                    port = service["spec"]["ports"][0]["port"]
                    endpoints[service_name] = f"http://{ip}:{port}"

        return endpoints

    def _is_pod_ready(self, pod: dict[str, Any]) -> bool:
        """Check if pod is ready"""
        conditions = pod.get("status", {}).get("conditions", [])
        for condition in conditions:
            if condition.get("type") == "Ready":
                return condition.get("status") == "True"
        return False

    async def _run_command(self, cmd: list[str], input_data: str | None = None) -> str:
        """Run shell command asynchronously"""
        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdin=asyncio.subprocess.PIPE if input_data else None,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )

        stdout, stderr = await process.communicate(
            input=input_data.encode() if input_data else None
        )

        if process.returncode != 0:
            raise Exception(f"Command failed: {' '.join(cmd)}\n{stderr.decode()}")

        return stdout.decode()
