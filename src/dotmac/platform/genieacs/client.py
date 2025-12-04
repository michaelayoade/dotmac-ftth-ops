"""
GenieACS NBI (Northbound Interface) Client

Provides interface to GenieACS REST API for TR-069/CWMP device management.
"""

import asyncio
import os
from typing import Any, cast
from urllib.parse import quote

import httpx
import structlog

from dotmac.platform.core.http_client import RobustHTTPClient

logger = structlog.get_logger(__name__)


def _snake_to_camel(name: str) -> str:
    """Convert snake_case to camelCase to match GenieACS field names."""
    if "_" not in name:
        return name
    parts = name.split("_")
    return parts[0] + "".join(part.capitalize() for part in parts[1:])


class GenieACSClient(RobustHTTPClient):  # type: ignore[misc]
    """
    GenieACS NBI Client

    Interacts with GenieACS Northbound Interface (NBI) for CPE management.
    """

    # Configurable timeouts for different operations
    TIMEOUTS = {
        "health_check": 5.0,
        "list": 15.0,
        "get": 10.0,
        "create": 30.0,
        "update": 30.0,
        "delete": 30.0,
        "task": 60.0,
        "provision": 60.0,
    }

    PREFETCH_THRESHOLD = 50  # Concurrent requests before triggering cache prefetch
    PREFETCH_LIMIT = 1000

    def __init__(
        self,
        base_url: str | None = None,
        username: str | None = None,
        password: str | None = None,
        tenant_id: str | None = None,
        verify_ssl: bool = True,
        timeout_seconds: float = 30.0,
        max_retries: int = 3,
        max_connections: int | None = None,
        max_keepalive_connections: int | None = None,
    ):
        """
        Initialize GenieACS client with robust HTTP capabilities.

        Args:
            base_url: GenieACS NBI URL (defaults to settings.external_services.genieacs_url)
            username: Basic auth username (defaults to GENIEACS_USERNAME env var)
            password: Basic auth password (defaults to GENIEACS_PASSWORD env var)
            tenant_id: Tenant ID for multi-tenancy support
            verify_ssl: Verify SSL certificates (default True)
            timeout_seconds: Default timeout in seconds
            max_retries: Maximum retry attempts
            max_connections: Maximum concurrent connections in pool (None for unlimited)
            max_keepalive_connections: Maximum keep-alive connections to retain (None for unlimited)
        """
        # Load from centralized settings (Phase 2 implementation)
        if base_url is None:
            try:
                from dotmac.platform.settings import settings

                base_url = settings.external_services.genieacs_url
            except (ImportError, AttributeError):
                # Fallback to environment variable if settings not available
                base_url = os.getenv("GENIEACS_URL", "http://localhost:7557")

        username = username or os.getenv("GENIEACS_USERNAME", "")
        password = password or os.getenv("GENIEACS_PASSWORD", "")

        # Initialize robust HTTP client
        max_connections_value = max_connections if max_connections is not None else 20
        max_keepalive_value = (
            max_keepalive_connections if max_keepalive_connections is not None else 10
        )

        super().__init__(
            service_name="genieacs",
            base_url=base_url,
            tenant_id=tenant_id,
            username=username,
            password=password,
            verify_ssl=verify_ssl,
            default_timeout=timeout_seconds,
            max_retries=max_retries,
            max_connections=max_connections_value,
            max_keepalive_connections=max_keepalive_value,
        )

        # Prefetch/cache state (lazily initialised inside async context)
        self._prefetch_lock: asyncio.Lock | None = None
        self._prefetch_task: asyncio.Task[None] | None = None
        self._device_cache: dict[str, dict[str, Any]] | None = None
        self._active_requests = 0

    async def _genieacs_request(
        self,
        method: str,
        endpoint: str,
        params: dict[str, Any] | None = None,
        json: dict[str, Any] | None = None,
        timeout: float | None = None,
    ) -> Any:
        """
        Make HTTP request to GenieACS NBI using robust base client.

        Args:
            method: HTTP method (GET, POST, PUT, PATCH, DELETE)
            endpoint: API endpoint
            params: Query parameters
            json: JSON body
            timeout: Request timeout (overrides default)

        Returns:
            Response JSON data or empty dict
        """
        return await self.request(
            method=method,
            endpoint=endpoint,
            params=params,
            json=json,
            timeout=timeout,
        )

    # =========================================================================
    # Device Operations
    # =========================================================================

    async def get_devices(
        self,
        query: dict[str, Any] | None = None,
        projection: str | None = None,
        skip: int = 0,
        limit: int = 100,
    ) -> list[dict[str, Any]]:
        """
        Get devices from GenieACS

        Args:
            query: MongoDB-style query filter
            projection: Comma-separated list of fields to return
            skip: Number of records to skip
            limit: Maximum records to return

        Returns:
            List of device objects
        """
        params: dict[str, Any] = {"skip": skip, "limit": limit}

        if query:
            import json

            params["query"] = json.dumps(query)

        if projection:
            params["projection"] = projection

        response = await self._genieacs_request("GET", "devices", params=params)
        return response if isinstance(response, list) else []

    async def _ensure_prefetch_lock(self) -> None:
        if self._prefetch_lock is None:
            self._prefetch_lock = asyncio.Lock()

    async def _invalidate_device_cache(self) -> None:
        await self._ensure_prefetch_lock()
        assert self._prefetch_lock is not None
        async with self._prefetch_lock:
            self._device_cache = None
            self._prefetch_task = None

    async def _cache_devices(self, devices: list[dict[str, Any]]) -> None:
        cache: dict[str, dict[str, Any]] = {}
        for device in devices:
            if isinstance(device, dict) and "_id" in device:
                cache[str(device["_id"])] = device

        await self._ensure_prefetch_lock()
        assert self._prefetch_lock is not None
        async with self._prefetch_lock:
            self._device_cache = cache
            self._prefetch_task = None

    async def _cache_device_object(self, device: dict[str, Any]) -> None:
        device_id = device.get("_id")
        if device_id is None:
            return
        await self._ensure_prefetch_lock()
        assert self._prefetch_lock is not None
        async with self._prefetch_lock:
            if self._device_cache is not None:
                self._device_cache[str(device_id)] = device

    async def _prefetch_all_devices(self) -> None:
        try:
            response = await self._genieacs_request(
                "GET",
                "devices",
                params={"limit": self.PREFETCH_LIMIT},
            )
            devices = response if isinstance(response, list) else []
            await self._cache_devices(devices)
        except Exception as exc:  # pragma: no cover - diagnostic aide
            logger.warning("genieacs.prefetch.failed", error=str(exc))
            await self._invalidate_device_cache()

    async def _maybe_prefetch_devices(self) -> None:
        if self._device_cache is not None:
            return

        if self._active_requests < self.PREFETCH_THRESHOLD:
            return

        await self._ensure_prefetch_lock()
        assert self._prefetch_lock is not None
        async with self._prefetch_lock:
            if self._device_cache is not None:
                return

            if self._prefetch_task is None:
                self._prefetch_task = asyncio.create_task(self._prefetch_all_devices())

            task = self._prefetch_task

        if task is not None:
            await task

    async def _get_cached_device(self, device_id: str) -> dict[str, Any] | None:
        await self._maybe_prefetch_devices()
        if self._device_cache is not None:
            return self._device_cache.get(device_id)
        return None

    async def get_device(self, device_id: str) -> dict[str, Any] | None:
        """
        Get single device by ID

        Args:
            device_id: Device ID (typically serial number)

        Returns:
            Device object or None
        """
        self._active_requests += 1
        try:
            cached = await self._get_cached_device(device_id)
            if cached is not None:
                return cached

            # URL encode device ID
            encoded_id = quote(device_id, safe="")
            response = await self._genieacs_request("GET", f"devices/{encoded_id}")
            device = cast(dict[str, Any], response)
            await self._cache_device_object(device)
            return device
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                return None
            raise
        finally:
            self._active_requests = max(0, self._active_requests - 1)

    async def delete_device(self, device_id: str) -> bool:
        """
        Delete device from GenieACS

        Args:
            device_id: Device ID

        Returns:
            True if deleted successfully
        """
        try:
            encoded_id = quote(device_id, safe="")
            await self._genieacs_request("DELETE", f"devices/{encoded_id}")
            await self._invalidate_device_cache()
            return True
        except Exception as e:
            logger.error("genieacs.delete_device.failed", device_id=device_id, error=str(e))
            return False

    async def update_device(self, device_id: str, data: dict[str, Any]) -> dict[str, Any]:
        """
        Update device metadata (e.g., tags) in GenieACS.

        Args:
            device_id: Device identifier
            data: Partial device payload (e.g., {"_tags": [...]})

        Returns:
            Updated device document
        """
        encoded_id = quote(device_id, safe="")
        response = await self._genieacs_request("PATCH", f"devices/{encoded_id}", json=data)
        await self._invalidate_device_cache()
        return cast(dict[str, Any], response)

    async def get_device_count(self, query: dict[str, Any] | None = None) -> int:
        """
        Get count of devices matching query

        Args:
            query: MongoDB-style query filter

        Returns:
            Number of matching devices
        """
        devices = await self.get_devices(query=query, projection="_id", limit=10000)
        return len(devices)

    # =========================================================================
    # Task Operations
    # =========================================================================

    async def create_task(
        self,
        device_id: str,
        task_name: str,
        task_data: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """
        Create task for device

        Common tasks:
        - refreshObject: Refresh device parameters
        - setParameterValues: Set parameter values
        - getParameterValues: Get parameter values
        - addObject: Add object instance
        - deleteObject: Delete object instance
        - download: Initiate file download
        - reboot: Reboot device

        Args:
            device_id: Device ID
            task_name: Task name
            task_data: Task-specific data

        Returns:
            Task creation response
        """
        encoded_id = quote(device_id, safe="")
        endpoint = f"devices/{encoded_id}/tasks"

        payload = {"name": task_name}
        if task_data:
            payload.update(task_data)

        response = await self._genieacs_request("POST", endpoint, json=payload)
        return cast(dict[str, Any], response)

    async def add_task(self, device_id: str, task_name: str, **task_kwargs: Any) -> dict[str, Any]:
        """
        Convenience wrapper mirroring GenieACS API naming for task creation.

        Args:
            device_id: Device identifier
            task_name: Task name (download, refreshObject, etc.)
            task_kwargs: Additional task-specific parameters

        Returns:
            Task creation response
        """
        task_data = None
        if task_kwargs:
            task_data = {
                _snake_to_camel(key): value
                for key, value in task_kwargs.items()
                if value is not None
            }
        return await self.create_task(device_id=device_id, task_name=task_name, task_data=task_data)

    async def refresh_device(
        self,
        device_id: str,
        object_path: str = "InternetGatewayDevice",
    ) -> dict[str, Any]:
        """
        Refresh device parameters

        Args:
            device_id: Device ID
            object_path: TR-069 object path to refresh

        Returns:
            Task response
        """
        return await self.create_task(
            device_id,
            "refreshObject",
            {"objectName": object_path},
        )

    async def set_parameter_values(
        self,
        device_id: str,
        parameters: dict[str, Any],
    ) -> dict[str, Any]:
        """
        Set parameter values on device

        Args:
            device_id: Device ID
            parameters: Dict of parameter paths and values

        Returns:
            Task response
        """
        parameter_values = [
            [param_path, param_value] for param_path, param_value in parameters.items()
        ]

        return await self.create_task(
            device_id,
            "setParameterValues",
            {"parameterValues": parameter_values},
        )

    async def get_parameter_values(
        self,
        device_id: str,
        parameter_names: list[str],
    ) -> dict[str, Any]:
        """
        Get parameter values from device

        Args:
            device_id: Device ID
            parameter_names: List of parameter paths

        Returns:
            Task response
        """
        return await self.create_task(
            device_id,
            "getParameterValues",
            {"parameterNames": parameter_names},
        )

    async def reboot_device(self, device_id: str) -> dict[str, Any]:
        """
        Reboot device

        Args:
            device_id: Device ID

        Returns:
            Task response
        """
        return await self.create_task(device_id, "reboot")

    async def factory_reset(self, device_id: str) -> dict[str, Any]:
        """
        Factory reset device

        Args:
            device_id: Device ID

        Returns:
            Task response
        """
        return await self.create_task(device_id, "factoryReset")

    async def download_firmware(
        self,
        device_id: str,
        file_type: str,
        file_name: str,
        target_file_name: str = "",
    ) -> dict[str, Any]:
        """
        Initiate firmware download to device

        Args:
            device_id: Device ID
            file_type: File type (e.g., "1 Firmware Upgrade Image")
            file_name: File name on GenieACS file server
            target_file_name: Target filename on device

        Returns:
            Task response
        """
        return await self.create_task(
            device_id,
            "download",
            {
                "fileType": file_type,
                "fileName": file_name,
                "targetFileName": target_file_name or file_name,
            },
        )

    # =========================================================================
    # Preset Operations
    # =========================================================================

    async def get_presets(self) -> list[dict[str, Any]]:
        """Get all presets"""
        response = await self._genieacs_request("GET", "presets")
        return response if isinstance(response, list) else []

    async def get_preset(self, preset_id: str) -> dict[str, Any] | None:
        """Get preset by ID"""
        try:
            encoded_id = quote(preset_id, safe="")
            response = await self._genieacs_request("GET", f"presets/{encoded_id}")
            return cast(dict[str, Any], response)
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                return None
            raise

    async def create_preset(self, preset_data: dict[str, Any]) -> dict[str, Any]:
        """Create preset"""
        response = await self._genieacs_request("POST", "presets", json=preset_data)
        return cast(dict[str, Any], response)

    async def update_preset(self, preset_id: str, preset_data: dict[str, Any]) -> dict[str, Any]:
        """Update preset"""
        encoded_id = quote(preset_id, safe="")
        response = await self._genieacs_request("PUT", f"presets/{encoded_id}", json=preset_data)
        return cast(dict[str, Any], response)

    async def delete_preset(self, preset_id: str) -> bool:
        """Delete preset"""
        try:
            encoded_id = quote(preset_id, safe="")
            await self._genieacs_request("DELETE", f"presets/{encoded_id}")
            return True
        except Exception as e:
            logger.error("genieacs.delete_preset.failed", preset_id=preset_id, error=str(e))
            return False

    # =========================================================================
    # Provision Operations
    # =========================================================================

    async def get_provisions(self) -> list[dict[str, Any]]:
        """Get all provisions"""
        response = await self._genieacs_request("GET", "provisions")
        return response if isinstance(response, list) else []

    async def get_provision(self, provision_id: str) -> dict[str, Any] | None:
        """Get provision by ID"""
        try:
            encoded_id = quote(provision_id, safe="")
            response = await self._genieacs_request("GET", f"provisions/{encoded_id}")
            return cast(dict[str, Any], response)
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                return None
            raise

    # =========================================================================
    # File Operations
    # =========================================================================

    async def get_files(self) -> list[dict[str, Any]]:
        """Get all files"""
        response = await self._genieacs_request("GET", "files")
        return response if isinstance(response, list) else []

    async def get_file(self, file_id: str) -> dict[str, Any] | None:
        """Get file by ID"""
        try:
            encoded_id = quote(file_id, safe="")
            response = await self._genieacs_request("GET", f"files/{encoded_id}")
            return cast(dict[str, Any], response)
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                return None
            raise

    async def delete_file(self, file_id: str) -> bool:
        """Delete file"""
        try:
            encoded_id = quote(file_id, safe="")
            await self._genieacs_request("DELETE", f"files/{encoded_id}")
            return True
        except Exception as e:
            logger.error("genieacs.delete_file.failed", file_id=file_id, error=str(e))
            return False

    # =========================================================================
    # Fault Operations
    # =========================================================================

    async def get_faults(
        self,
        device_id: str | None = None,
        skip: int = 0,
        limit: int = 100,
    ) -> list[dict[str, Any]]:
        """
        Get faults

        Args:
            device_id: Filter by device ID
            skip: Skip records
            limit: Limit records

        Returns:
            List of faults
        """
        params: dict[str, Any] = {"skip": skip, "limit": limit}

        if device_id:
            import json

            params["query"] = json.dumps({"device": device_id})

        response = await self._genieacs_request("GET", "faults", params=params)
        return response if isinstance(response, list) else []

    async def delete_fault(self, fault_id: str) -> bool:
        """Delete fault"""
        try:
            encoded_id = quote(fault_id, safe="")
            await self._genieacs_request("DELETE", f"faults/{encoded_id}")
            return True
        except Exception as e:
            logger.error("genieacs.delete_fault.failed", fault_id=fault_id, error=str(e))
            return False

    # =========================================================================
    # Utility Methods
    # =========================================================================

    async def ping(self) -> bool:
        """Check if GenieACS is accessible"""
        try:
            await self.get_devices(limit=1)
            return True
        except Exception as e:
            logger.warning("genieacs.ping.failed", error=str(e))
            return False
