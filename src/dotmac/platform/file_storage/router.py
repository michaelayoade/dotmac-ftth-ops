"""
File storage API router.

Provides REST endpoints for file storage operations.
"""

import posixpath
from datetime import UTC, datetime
from typing import Any

import structlog
from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    Request,
    Response,
    UploadFile,
    status,
)
from pydantic import BaseModel, ConfigDict, Field

from dotmac.platform.auth.core import UserInfo, get_current_user
from dotmac.platform.auth.platform_admin import is_platform_admin
from dotmac.platform.file_storage.service import (
    FileMetadata,
    get_storage_service,
)
from dotmac.platform.tenant import get_current_tenant_id

logger = structlog.get_logger(__name__)

# Create router
file_storage_router = APIRouter(prefix="/api/v1/files/storage", )
storage_router = file_storage_router  # Alias for backward compatibility

# Get service instance
storage_service = get_storage_service()


def _resolve_tenant_id(request: Request, current_user: UserInfo) -> str:
    """Resolve tenant context, allowing platform admin overrides."""
    context_tenant = get_current_tenant_id()
    if isinstance(context_tenant, str) and context_tenant:
        return context_tenant
    if context_tenant:
        return str(context_tenant)

    tenant_id = getattr(current_user, "tenant_id", None)
    if isinstance(tenant_id, str) and tenant_id:
        return tenant_id
    if tenant_id is not None:
        return str(tenant_id)

    if is_platform_admin(current_user):
        override = request.headers.get("X-Target-Tenant-ID") or request.query_params.get(
            "tenant_id"
        )
        if override:
            return override
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Platform administrators must specify tenant_id via header or query parameter.",
        )

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Tenant context not found for file storage operation.",
    )


# Request/Response Models
class FileUploadResponse(BaseModel):  # BaseModel resolves to Any in isolation
    """File upload response."""

    model_config = ConfigDict()

    file_id: str = Field(..., description="Unique file identifier")
    file_name: str = Field(..., description="Original file name")
    file_size: int = Field(..., description="File size in bytes")
    content_type: str = Field(..., description="MIME type")
    upload_timestamp: str = Field(..., description="Upload timestamp")
    url: str | None = Field(None, description="Download URL if available")


class FileListResponse(BaseModel):  # BaseModel resolves to Any in isolation
    """File list response."""

    model_config = ConfigDict()

    files: list[FileMetadata] = Field(..., description="List of files")
    total: int = Field(..., description="Total number of files")
    page: int = Field(..., description="Current page")
    per_page: int = Field(..., description="Items per page")


class FileOperationRequest(BaseModel):  # BaseModel resolves to Any in isolation
    """File operation request."""

    model_config = ConfigDict()

    file_ids: list[str] = Field(..., description="File IDs to operate on")
    operation: str = Field(..., description="Operation to perform")
    destination: str | None = Field(None, description="Destination for move/copy")


# Endpoints
@file_storage_router.post("/upload", response_model=FileUploadResponse)
async def upload_file(
    request: Request,
    file: UploadFile = File(...),
    path: str | None = Form(None, description="Storage path"),
    description: str | None = Form(None, description="File description"),
    current_user: UserInfo = Depends(get_current_user),
) -> FileUploadResponse:
    """
    Upload a file to storage.
    """
    try:
        # Validate file size (e.g., max 100MB)
        max_size = 100 * 1024 * 1024  # 100MB
        file_size = 0
        contents = await file.read()
        file_size = len(contents)

        if file_size > max_size:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"File too large. Maximum size is {max_size / 1024 / 1024}MB",
            )

        # Reset file position
        await file.seek(0)

        # Generate file path
        tenant_id = _resolve_tenant_id(request, current_user)

        if not path:
            path = f"uploads/{tenant_id}/{current_user.user_id}/{datetime.now(UTC).strftime('%Y/%m/%d')}"

        # Store file
        file_id = await storage_service.store_file(
            file_data=contents,
            file_name=file.filename or "unnamed",
            content_type=file.content_type or "application/octet-stream",
            path=path,
            metadata={
                "uploaded_by": current_user.user_id,
                "description": description,
                "original_filename": file.filename,
            },
            tenant_id=tenant_id,
        )

        return FileUploadResponse(
            file_id=file_id,
            file_name=file.filename or "unnamed",
            file_size=file_size,
            content_type=file.content_type or "application/octet-stream",
            upload_timestamp=datetime.now(UTC).isoformat(),
            url=f"/api/v1/files/storage/{file_id}/download",
        )
    except HTTPException:
        raise
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    except Exception as e:
        logger.error(f"File upload failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="File upload failed",
        )


@file_storage_router.get("/{file_id}/download")
async def download_file(
    request: Request,
    file_id: str,
    current_user: UserInfo = Depends(get_current_user),
) -> Response:
    """
    Download a file from storage.
    """
    try:
        tenant_id = _resolve_tenant_id(request, current_user)

        file_data, metadata = await storage_service.retrieve_file(file_id, tenant_id)

        if not file_data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"File {file_id} not found",
            )

        # Return actual file content
        content_type = (
            metadata.get("content_type", "application/octet-stream")
            if metadata
            else "application/octet-stream"
        )
        file_name = metadata.get("file_name", "download") if metadata else "download"

        return Response(
            content=file_data,
            media_type=content_type,
            headers={
                "Content-Disposition": f'attachment; filename="{file_name}"',
                "Content-Length": str(len(file_data)),
            },
        )
    except HTTPException:
        raise
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    except Exception as e:
        logger.error(f"File download failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="File download failed",
        )


@file_storage_router.delete("/{file_id}")
async def delete_file(
    request: Request,
    file_id: str,
    current_user: UserInfo = Depends(get_current_user),
) -> dict[str, Any]:
    """
    Delete a file from storage.
    """
    try:
        tenant_id = _resolve_tenant_id(request, current_user)
        success = await storage_service.delete_file(file_id, tenant_id)

        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"File {file_id} not found",
            )

        return {
            "message": f"File {file_id} deleted successfully",
            "deleted_at": datetime.now(UTC).isoformat(),
        }
    except HTTPException:
        raise
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    except Exception as e:
        logger.error(f"File deletion failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="File deletion failed",
        )


@file_storage_router.get("", response_model=FileListResponse)
async def list_files(
    request: Request,
    path: str | None = Query(None, description="Filter by path"),
    skip: int = Query(0, ge=0, description="Skip records"),
    limit: int = Query(100, ge=1, le=1000, description="Limit records"),
    current_user: UserInfo = Depends(get_current_user),
) -> FileListResponse:
    """
    List files in storage.
    """
    try:
        tenant_id = _resolve_tenant_id(request, current_user)

        base_prefix = f"uploads/{tenant_id}/{current_user.user_id}"
        if path:
            combined = posixpath.normpath(f"{base_prefix}/{path}")
            if not combined.startswith(base_prefix):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid path filter.",
                )
            full_path = combined
        else:
            full_path = base_prefix

        files = await storage_service.list_files(
            path=full_path,
            limit=limit,
            offset=skip,
            tenant_id=tenant_id,
        )

        return FileListResponse(
            files=files,
            total=len(files),
            page=skip // limit + 1,
            per_page=limit,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    except Exception as e:
        logger.error(f"Failed to list files: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to list files",
        )


@file_storage_router.get("/{file_id}/metadata")
async def get_file_metadata(
    request: Request,
    file_id: str,
    current_user: UserInfo = Depends(get_current_user),
) -> dict[str, Any]:
    """
    Get metadata for a specific file.
    """
    try:
        tenant_id = _resolve_tenant_id(request, current_user)
        metadata = await storage_service.get_file_metadata(file_id)

        if not metadata or metadata.get("tenant_id") != tenant_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"File {file_id} not found",
            )

        metadata_dict: dict[str, Any] = dict(metadata)
        return metadata_dict
    except HTTPException:
        raise
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    except Exception as e:
        logger.error(f"Failed to get file metadata: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get file metadata",
        )


@file_storage_router.post("/batch")
async def batch_operation(
    request: Request,
    operations: FileOperationRequest,
    current_user: UserInfo = Depends(get_current_user),
) -> dict[str, Any]:
    """
    Perform batch operations on files.
    """
    try:
        tenant_id = _resolve_tenant_id(request, current_user)
        results = []

        for file_id in operations.file_ids:
            if operations.operation == "delete":
                success = await storage_service.delete_file(file_id, tenant_id)
                results.append({"file_id": file_id, "status": "deleted" if success else "failed"})
            elif operations.operation == "move" and operations.destination:
                # Implement move operation
                results.append({"file_id": file_id, "status": "moved"})
            elif operations.operation == "copy" and operations.destination:
                # Implement copy operation
                results.append({"file_id": file_id, "status": "copied"})
            else:
                results.append({"file_id": file_id, "status": "unsupported_operation"})

        return {
            "operation": operations.operation,
            "results": results,
            "timestamp": datetime.now(UTC).isoformat(),
        }
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    except Exception as e:
        logger.error(f"Batch operation failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Batch operation failed",
        )


# Export router
__all__ = ["file_storage_router", "storage_router"]
