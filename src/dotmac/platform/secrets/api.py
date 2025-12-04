"""
Secrets API endpoints using Vault/OpenBao.

Provides REST endpoints for secrets management operations.

SECURITY: All endpoints require platform admin authentication.
"""

import logging
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, ConfigDict, Field

from dotmac.platform.auth.core import UserInfo
from dotmac.platform.auth.platform_admin import require_platform_admin
from dotmac.platform.secrets.vault_client import AsyncVaultClient, VaultError
from dotmac.platform.settings import settings

from ..audit import ActivitySeverity, ActivityType, log_api_activity

logger = logging.getLogger(__name__)

# Create router
router = APIRouter()

# ========================================
# Dependency Injection
# ========================================


async def get_vault_client() -> AsyncVaultClient:
    """Get Vault client instance."""
    if not settings.vault.enabled:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Vault/OpenBao is not enabled",
        )

    return AsyncVaultClient(
        url=settings.vault.url,
        token=settings.vault.token,
        namespace=settings.vault.namespace,
        mount_path=settings.vault.mount_path,
        kv_version=settings.vault.kv_version,
    )


# ========================================
# Request/Response Models
# ========================================


class SecretData(BaseModel):
    """Secret data model."""

    model_config = ConfigDict()

    data: dict[str, Any] = Field(..., description="Secret key-value pairs")
    metadata: dict[str, Any] | None = Field(None, description="Optional metadata")


class SecretResponse(BaseModel):
    """Secret response model."""

    model_config = ConfigDict()

    path: str = Field(..., description="Secret path")
    data: dict[str, Any] = Field(..., description="Secret data")
    metadata: dict[str, Any] | None = Field(None, description="Secret metadata")


class SecretInfo(BaseModel):
    """Secret information with metadata."""

    model_config = ConfigDict()

    path: str = Field(..., description="Secret path")
    created_time: str | None = Field(None, description="When the secret was created")
    updated_time: str | None = Field(None, description="When the secret was last updated")
    version: int | None = Field(None, description="Current version (KV v2)")
    metadata: dict[str, Any] = Field(default_factory=dict, description="Additional metadata")


class SecretListResponse(BaseModel):
    """List secrets response."""

    model_config = ConfigDict()

    secrets: list[SecretInfo] = Field(..., description="List of secrets with metadata")


class HealthResponse(BaseModel):
    """Vault health response."""

    model_config = ConfigDict()

    healthy: bool = Field(..., description="Health status")
    vault_url: str = Field(..., description="Vault URL")
    mount_path: str = Field(..., description="Mount path")


# ========================================
# API Endpoints
# ========================================


@router.get("/health", response_model=HealthResponse, tags=["Secrets Management"])
async def check_vault_health(
    vault: Annotated[AsyncVaultClient, Depends(get_vault_client)],
) -> HealthResponse:
    """Check Vault/OpenBao health status."""
    try:
        healthy = await vault.health_check()
        return HealthResponse(
            healthy=healthy,
            vault_url=settings.vault.url,
            mount_path=settings.vault.mount_path,
        )
    except Exception as e:
        logger.error(f"Vault health check failed: {e}")
        return HealthResponse(
            healthy=False,
            vault_url=settings.vault.url,
            mount_path=settings.vault.mount_path,
        )


@router.get("/secrets/{path:path}", response_model=SecretResponse, tags=["Secrets Management"])
async def get_secret(
    path: str,
    request: Request,
    vault: Annotated[AsyncVaultClient, Depends(get_vault_client)],
    current_user: Annotated[UserInfo, Depends(require_platform_admin)],
) -> SecretResponse:
    """
    Get a secret from Vault.

    SECURITY: Requires platform admin permission. Secrets contain sensitive
    credentials and should only be accessed by platform administrators.

    Args:
        path: Secret path (e.g., "app/database/credentials")
        current_user: Platform admin user (automatically injected)
    """
    try:
        async with vault:
            data = await vault.get_secret(path)

        if not data:
            # Log secret access attempt that failed
            await log_api_activity(
                request=request,
                action="secret_access_failed",
                description=f"Failed to access secret at path: {path}",
                severity=ActivitySeverity.MEDIUM,
                resource_type="secret",
                resource_id=path,
                details={"path": path, "reason": "secret_not_found"},
            )
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Secret not found at path: {path}",
            )

        # Log successful secret access
        await log_api_activity(
            request=request,
            activity_type=ActivityType.SECRET_ACCESSED,
            action="secret_access_success",
            description=f"Successfully accessed secret at path: {path}",
            severity=ActivitySeverity.LOW,
            resource_type="secret",
            resource_id=path,
            details={"path": path, "keys": list(data.keys())},
        )

        return SecretResponse(
            path=path,
            data=data,
            metadata=None,  # Vault doesn't separate metadata in KV v2
        )

    except VaultError as e:
        logger.error(f"Failed to retrieve secret: {e}")
        # Log vault error
        await log_api_activity(
            request=request,
            action="secret_access_error",
            description=f"Vault error accessing secret at path: {path}",
            severity=ActivitySeverity.HIGH,
            resource_type="secret",
            resource_id=path,
            details={"path": path, "error": str(e)},
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve secret: {str(e)}",
        )


@router.post("/secrets/{path:path}", response_model=SecretResponse, tags=["Secrets Management"])
async def create_or_update_secret(
    path: str,
    secret_data: SecretData,
    request: Request,
    vault: Annotated[AsyncVaultClient, Depends(get_vault_client)],
    current_user: Annotated[UserInfo, Depends(require_platform_admin)],
) -> SecretResponse:
    """
    Create or update a secret in Vault.

    SECURITY: Requires platform admin permission.

    Args:
        path: Secret path
        secret_data: Secret data to store
        current_user: Platform admin user (automatically injected)
    """
    try:
        async with vault:
            existing_secret = await vault.get_secret(path)
            await vault.set_secret(path, secret_data.data)

        is_update = bool(existing_secret)
        activity_type = ActivityType.SECRET_UPDATED if is_update else ActivityType.SECRET_CREATED
        action = "secret_create_or_update"
        description = (
            f"Successfully updated secret at path: {path}"
            if is_update
            else f"Successfully created secret at path: {path}"
        )
        severity = ActivitySeverity.LOW if is_update else ActivitySeverity.MEDIUM

        # Log successful secret creation/update
        await log_api_activity(
            request=request,
            activity_type=activity_type,
            action=action,
            description=description,
            severity=severity,
            resource_type="secret",
            resource_id=path,
            details={
                "path": path,
                "keys": list(secret_data.data.keys()),
                "metadata": secret_data.metadata,
                "operation": "update" if is_update else "create",
            },
        )

        return SecretResponse(
            path=path,
            data=secret_data.data,
            metadata=secret_data.metadata,
        )

    except VaultError as e:
        logger.error(f"Failed to store secret: {e}")
        # Log vault error
        await log_api_activity(
            request=request,
            action="secret_create_error",
            description=f"Vault error creating/updating secret at path: {path}",
            severity=ActivitySeverity.HIGH,
            resource_type="secret",
            resource_id=path,
            details={"path": path, "error": str(e)},
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to store secret: {str(e)}",
        )


@router.delete(
    "/secrets/{path:path}", status_code=status.HTTP_204_NO_CONTENT, tags=["Secrets Management"]
)
async def delete_secret(
    path: str,
    request: Request,
    vault: Annotated[AsyncVaultClient, Depends(get_vault_client)],
    current_user: Annotated[UserInfo, Depends(require_platform_admin)],
) -> None:
    """
    Delete a secret from Vault.

    SECURITY: Requires platform admin permission.

    Note: This marks the secret as deleted in Vault KV v2.
    The secret can be undeleted or permanently destroyed using Vault CLI.

    Args:
        path: Secret path to delete
        current_user: Platform admin user (automatically injected)
    """
    try:
        async with vault:
            # For KV v2, delete the latest version
            await vault.delete_secret(path)

            # Log successful secret deletion
            await log_api_activity(
                request=request,
                activity_type=ActivityType.SECRET_DELETED,
                action="secret_delete",
                description=f"Successfully deleted secret at path: {path}",
                severity=ActivitySeverity.HIGH,
                resource_type="secret",
                resource_id=path,
                details={"path": path},
            )

            logger.info(f"Deleted secret at path: {path}")
            return None

    except VaultError as e:
        logger.error(f"Failed to delete secret: {e}")
        # Log vault error
        await log_api_activity(
            request=request,
            action="secret_delete_error",
            description=f"Vault error deleting secret at path: {path}",
            severity=ActivitySeverity.HIGH,
            resource_type="secret",
            resource_id=path,
            details={"path": path, "error": str(e)},
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete secret: {str(e)}",
        )


@router.get("/secrets", response_model=SecretListResponse, tags=["Secrets Management"])
async def list_secrets(
    vault: Annotated[AsyncVaultClient, Depends(get_vault_client)],
    current_user: Annotated[UserInfo, Depends(require_platform_admin)],
    prefix: str = Query("", description="Optional path prefix to filter secrets"),
) -> SecretListResponse:
    """
    List secrets in Vault.

    SECURITY: Requires platform admin permission.

    Args:
        prefix: Optional prefix to filter secret paths
        current_user: Platform admin user (automatically injected)
    """
    try:
        if not vault:
            logger.error("Vault client not available")
            return SecretListResponse(secrets=[])

        # Use the vault client to list secrets with metadata
        secrets_with_metadata = await vault.list_secrets_with_metadata(prefix)

        # Convert to SecretInfo objects
        secrets = []
        for secret_data in secrets_with_metadata:
            try:
                secret_info = SecretInfo(
                    path=secret_data["path"],
                    created_time=secret_data.get("created_time"),
                    updated_time=secret_data.get("updated_time"),
                    version=secret_data.get("version"),
                    metadata=secret_data.get("metadata", {"source": "vault"}),
                )
                secrets.append(secret_info)
            except Exception as e:
                logger.warning(
                    f"Failed to parse secret metadata for {secret_data.get('path', 'unknown')}: {e}"
                )
                # Still include the secret even if parsing fails
                secret_info = SecretInfo(
                    path=secret_data.get("path", "unknown"),
                    created_time=None,
                    updated_time=None,
                    version=None,
                    metadata={"source": "vault", "parsing_error": str(e)},
                )
                secrets.append(secret_info)

        logger.info(f"Listed {len(secrets)} secrets with prefix '{prefix}'")
        return SecretListResponse(secrets=secrets)

    except VaultError as e:
        logger.error(f"Failed to list secrets: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list secrets: {str(e)}",
        )
    except Exception as e:
        logger.error(f"Unexpected error listing secrets: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to list secrets"
        )


# ========================================
# Export
# ========================================

__all__ = ["router"]
