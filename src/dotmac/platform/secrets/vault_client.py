"""Vault/OpenBao client for secure secrets management."""

from __future__ import annotations

import asyncio
import logging
from collections.abc import Mapping, Sequence
from typing import Any, cast

import httpx

logger = logging.getLogger(__name__)


class VaultError(Exception):
    """Base exception for Vault operations."""

    pass


class VaultAuthenticationError(VaultError):
    """Raised when Vault authentication fails."""

    pass


def _as_dict(value: Any) -> dict[str, Any]:
    """Return value as a plain dict[str, Any] when possible."""

    if isinstance(value, Mapping):
        return {str(key): val for key, val in value.items()}
    return {}


def _as_str_list(value: Any) -> list[str]:
    """Return value as a list of strings when possible."""

    if isinstance(value, Sequence) and not isinstance(value, (str, bytes)):
        return [str(item) for item in value]
    return []


def _extract_secret_data(kv_version: int, payload: Any) -> dict[str, Any]:
    """Extract the secret data section from a Vault response payload."""

    root = _as_dict(payload)
    data_section = _as_dict(root.get("data"))
    if kv_version == 2:
        return _as_dict(data_section.get("data"))
    return data_section


class VaultClient:
    """
    Client for interacting with HashiCorp Vault or OpenBao.

    Supports KV v2 secrets engine for secure secret storage and retrieval.
    """

    def __init__(
        self,
        url: str,
        token: str | None = None,
        namespace: str | None = None,
        mount_path: str = "secret",
        kv_version: int = 2,
        timeout: float = 30.0,
    ):
        """
        Initialize Vault client.

        Args:
            url: Vault/OpenBao server URL
            token: Authentication token
            namespace: Vault namespace (enterprise feature)
            mount_path: KV secrets engine mount path
            kv_version: KV secrets engine version (1 or 2)
            timeout: Request timeout in seconds
        """
        self.url = url.rstrip("/")
        self.token = token
        self.namespace = namespace
        self.mount_path = mount_path
        self.kv_version = kv_version
        self.timeout = timeout

        # Create HTTP client with headers
        headers = {}
        if token:
            headers["X-Vault-Token"] = token
        if namespace:
            headers["X-Vault-Namespace"] = namespace

        self.client = httpx.Client(
            base_url=self.url,
            headers=headers,
            timeout=httpx.Timeout(timeout),
        )

    def _get_secret_path(self, path: str) -> str:
        """Build the full API path for a secret."""
        # Remove leading/trailing slashes from path
        path = path.strip("/")

        if self.kv_version == 2:
            # KV v2 uses /data/ in the path
            return f"/v1/{self.mount_path}/data/{path}"
        else:
            # KV v1 uses direct path
            return f"/v1/{self.mount_path}/{path}"

    def get_secret(self, path: str) -> dict[str, Any]:
        """
        Retrieve a secret from Vault.

        Args:
            path: Secret path (e.g., "database/credentials")

        Returns:
            Dictionary containing secret data

        Raises:
            VaultError: If secret retrieval fails
        """
        try:
            secret_path = self._get_secret_path(path)
            response = self.client.get(secret_path)

            if response.status_code == 403:
                raise VaultAuthenticationError(f"Permission denied accessing secret at {path}")
            elif response.status_code == 404:
                logger.warning(f"Secret not found at path: {path}")
                return {}

            response.raise_for_status()
            data = response.json()

            return _extract_secret_data(self.kv_version, data)

        except httpx.HTTPError as e:
            raise VaultError(f"Failed to retrieve secret from {path}: {e}")

    def get_secrets(self, paths: list[str]) -> dict[str, dict[str, Any]]:
        """
        Retrieve multiple secrets from Vault.

        Args:
            paths: List of secret paths

        Returns:
            Dictionary mapping paths to their secret data
        """
        secrets: dict[str, dict[str, Any]] = {}
        for path in paths:
            try:
                secrets[path] = self.get_secret(path)
            except VaultError as e:
                logger.error(f"Failed to fetch secret at {path}: {e}")
                secrets[path] = {}
        return secrets

    def set_secret(self, path: str, data: dict[str, Any]) -> None:
        """
        Store a secret in Vault.

        Args:
            path: Secret path
            data: Secret data to store

        Raises:
            VaultError: If secret storage fails
        """
        try:
            secret_path = self._get_secret_path(path)

            # Wrap data for KV v2
            if self.kv_version == 2:
                payload = {"data": data}
            else:
                payload = data

            response = self.client.post(secret_path, json=payload)

            if response.status_code == 403:
                raise VaultAuthenticationError(f"Permission denied writing secret to {path}")

            response.raise_for_status()

        except httpx.HTTPError as e:
            raise VaultError(f"Failed to store secret at {path}: {e}")

    def list_secrets(self, path: str = "") -> list[str]:
        """
        List secrets at a given path.

        Args:
            path: Path to list (empty string for root)

        Returns:
            List of secret keys at the path

        Raises:
            VaultError: If listing fails
        """
        try:
            # Build the list path
            path = path.strip("/")
            if self.kv_version == 2:
                list_path = f"/v1/{self.mount_path}/metadata/{path}"
            else:
                list_path = f"/v1/{self.mount_path}/{path}"

            # Append ?list=true to get listing
            response = self.client.get(f"{list_path}?list=true")

            if response.status_code == 404:
                return []

            response.raise_for_status()
            data = response.json()

            data_dict = _as_dict(data)
            data_section = _as_dict(data_dict.get("data"))
            keys = _as_str_list(data_section.get("keys"))
            return keys

        except httpx.HTTPError as e:
            raise VaultError(f"Failed to list secrets at {path}: {e}")

    def delete_secret(self, path: str) -> None:
        """
        Delete a secret from Vault.

        Args:
            path: Secret path to delete

        Raises:
            VaultError: If deletion fails
        """
        try:
            # Build the delete path
            path = path.strip("/")
            if self.kv_version == 2:
                # KV v2 delete uses /data/ endpoint for soft deletes
                delete_path = f"/v1/{self.mount_path}/data/{path}"
            else:
                delete_path = f"/v1/{self.mount_path}/{path}"

            response = self.client.delete(delete_path)

            if response.status_code == 403:
                raise VaultAuthenticationError(f"Permission denied deleting secret at {path}")

            # 204 No Content is success for delete
            if response.status_code not in (200, 204, 404):
                response.raise_for_status()

        except httpx.HTTPError as e:
            raise VaultError(f"Failed to delete secret at {path}: {e}")

    def health_check(self) -> bool:
        """
        Check if Vault is healthy and accessible.

        Returns:
            True if Vault is healthy, False otherwise
        """
        try:
            response = self.client.get("/v1/sys/health")
            return response.status_code in (200, 429, 473, 501, 503)
        except Exception as e:
            logger.error(f"Vault health check failed: {e}")
            return False

    def close(self) -> None:
        """Close the HTTP client connection."""
        self.client.close()

    def __enter__(self) -> VaultClient:
        """Context manager entry."""
        return self

    def __exit__(self, exc_type: Any, exc_val: Any, exc_tb: Any) -> None:
        """Context manager exit."""
        self.close()


class AsyncVaultClient:
    """
    Async client for interacting with Vault/OpenBao.
    """

    def __init__(
        self,
        url: str,
        token: str | None = None,
        namespace: str | None = None,
        mount_path: str = "secret",
        kv_version: int = 2,
        timeout: float = 30.0,
    ):
        """Initialize async Vault client with same parameters as sync version."""
        self.url = url.rstrip("/")
        self.token = token
        self.namespace = namespace
        self.mount_path = mount_path
        self.kv_version = kv_version
        self.timeout = timeout

        # Create async HTTP client
        headers = {}
        if token:
            headers["X-Vault-Token"] = token
        if namespace:
            headers["X-Vault-Namespace"] = namespace

        self.client = httpx.AsyncClient(
            base_url=self.url,
            headers=headers,
            timeout=httpx.Timeout(timeout),
        )

    def update_token(self, token: str | None) -> None:
        """Update the authentication token for the underlying HTTP client."""
        self.token = token
        if token:
            self.client.headers["X-Vault-Token"] = token
        else:
            self.client.headers.pop("X-Vault-Token", None)

    def _get_secret_path(self, path: str) -> str:
        """Build the full API path for a secret."""
        path = path.strip("/")

        if self.kv_version == 2:
            return f"/v1/{self.mount_path}/data/{path}"
        else:
            return f"/v1/{self.mount_path}/{path}"

    async def get_secret(self, path: str) -> dict[str, Any]:
        """Async version of get_secret."""
        try:
            secret_path = self._get_secret_path(path)
            response = await self.client.get(secret_path)

            if response.status_code == 403:
                raise VaultAuthenticationError(f"Permission denied accessing secret at {path}")
            elif response.status_code == 404:
                logger.warning(f"Secret not found at path: {path}")
                return {}

            response.raise_for_status()
            data = response.json()

            return _extract_secret_data(self.kv_version, data)

        except httpx.HTTPError as e:
            raise VaultError(f"Failed to retrieve secret from {path}: {e}")

    async def get_secrets(self, paths: list[str]) -> dict[str, dict[str, Any]]:
        """Async version of get_secrets."""
        import asyncio

        tasks = [self.get_secret(path) for path in paths]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        secrets: dict[str, dict[str, Any]] = {}
        for path, result in zip(paths, results, strict=False):
            if isinstance(result, Exception):
                logger.error(f"Failed to fetch secret at {path}: {result}")
                secrets[path] = {}
            else:
                secrets[path] = cast(dict[str, Any], result)

        return secrets

    async def set_secret(self, path: str, data: dict[str, Any]) -> None:
        """Async version of set_secret."""
        try:
            secret_path = self._get_secret_path(path)

            if self.kv_version == 2:
                payload = {"data": data}
            else:
                payload = data

            response = await self.client.post(secret_path, json=payload)

            if response.status_code == 403:
                raise VaultAuthenticationError(f"Permission denied writing secret to {path}")

            response.raise_for_status()

        except httpx.HTTPError as e:
            raise VaultError(f"Failed to store secret at {path}: {e}")

    async def list_secrets(self, path: str = "") -> list[str]:
        """
        Async version of list_secrets.

        Args:
            path: Path to list (empty string for root)

        Returns:
            List of secret keys at the path

        Raises:
            VaultError: If listing fails
        """
        try:
            # Build the list path
            path = path.strip("/")
            if self.kv_version == 2:
                list_path = f"/v1/{self.mount_path}/metadata/{path}"
            else:
                list_path = f"/v1/{self.mount_path}/{path}"

            # Append ?list=true to get listing
            response = await self.client.get(f"{list_path}?list=true")

            if response.status_code == 404:
                return []

            response.raise_for_status()
            data = response.json()

            data_dict = _as_dict(data)
            data_section = _as_dict(data_dict.get("data"))
            keys = _as_str_list(data_section.get("keys"))
            return keys

        except httpx.HTTPError as e:
            raise VaultError(f"Failed to list secrets at {path}: {e}")

    async def get_secret_metadata(self, path: str) -> dict[str, Any]:
        """
        Get metadata for a specific secret (KV v2 only).

        Args:
            path: Secret path

        Returns:
            Metadata dictionary with creation/update times, versions, etc.

        Raises:
            VaultError: If metadata retrieval fails
        """
        if self.kv_version != 2:
            return {"error": "Metadata only available in KV v2"}

        try:
            path = path.strip("/")
            metadata_path = f"/v1/{self.mount_path}/metadata/{path}"
            response = await self.client.get(metadata_path)

            if response.status_code == 404:
                return {"error": "Secret not found"}

            response.raise_for_status()
            data = response.json()
            return _as_dict(_as_dict(data).get("data"))

        except httpx.HTTPError as e:
            raise VaultError(f"Failed to get metadata for {path}: {e}")

    async def list_secrets_with_metadata(self, path: str = "") -> list[dict[str, Any]]:
        """
        List secrets with their metadata.

        Args:
            path: Path to list (empty string for root)

        Returns:
            List of dictionaries with secret info and metadata

        Raises:
            VaultError: If listing fails
        """
        try:
            secrets = await self.list_secrets(path)
            secrets_with_metadata: list[dict[str, Any]] = []

            for secret_key in secrets:
                full_path = f"{path.rstrip('/')}/{secret_key}".lstrip("/")

                metadata_info: dict[str, Any] = {"source": "vault"}
                secret_info: dict[str, Any] = {
                    "path": full_path,
                    "created_time": None,
                    "updated_time": None,
                    "version": None,
                    "metadata": metadata_info,
                }

                # Try to get metadata for each secret
                try:
                    if self.kv_version == 2:
                        metadata = await self.get_secret_metadata(full_path)
                        if "error" not in metadata:
                            metadata_info.update(
                                {
                                    "source": "vault",
                                    "versions": metadata.get("versions", {}),
                                    "cas_required": metadata.get("cas_required", False),
                                    "delete_version_after": metadata.get("delete_version_after"),
                                }
                            )
                            secret_info.update(
                                {
                                    "created_time": metadata.get("created_time"),
                                    "updated_time": metadata.get("updated_time"),
                                    "version": metadata.get("current_version"),
                                }
                            )
                except Exception as e:
                    metadata_info["metadata_error"] = str(e)

                secrets_with_metadata.append(secret_info)

            return secrets_with_metadata

        except Exception as e:
            raise VaultError(f"Failed to list secrets with metadata at {path}: {e}")

    async def delete_secret(self, path: str) -> None:
        """
        Async version of delete_secret.

        Args:
            path: Secret path to delete

        Raises:
            VaultError: If deletion fails
        """
        try:
            # Build the delete path
            path = path.strip("/")
            if self.kv_version == 2:
                delete_path = f"/v1/{self.mount_path}/data/{path}"
            else:
                delete_path = f"/v1/{self.mount_path}/{path}"

            response = await self.client.delete(delete_path)

            if response.status_code == 403:
                raise VaultAuthenticationError(f"Permission denied deleting secret at {path}")

            # 204 No Content is success for delete
            if response.status_code not in (200, 204, 404):
                response.raise_for_status()

        except httpx.HTTPError as e:
            raise VaultError(f"Failed to delete secret at {path}: {e}")

    async def health_check(self) -> bool:
        """Async version of health_check."""
        try:
            response = await self.client.get("/v1/sys/health")
            return response.status_code in (200, 429, 473, 501, 503)
        except Exception as e:
            logger.error(f"Vault health check failed: {e}")
            return False

    async def close(self) -> None:
        """Close the async HTTP client."""
        await self.client.aclose()

    def close_sync(self) -> None:
        """Close the async HTTP client from synchronous code."""
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            asyncio.run(self.close())
        else:
            loop.create_task(self.close())

    async def __aenter__(self) -> AsyncVaultClient:
        """Async context manager entry."""
        return self

    async def __aexit__(self, exc_type: Any, exc_val: Any, exc_tb: Any) -> None:
        """Async context manager exit."""
        await self.close()
