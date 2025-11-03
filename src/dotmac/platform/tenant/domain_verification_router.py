"""
Domain verification API router.

Provides endpoints for tenant domain ownership verification.
"""

from typing import Annotated

import structlog
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.auth.core import UserInfo
from dotmac.platform.auth.rbac_dependencies import require_permission
from dotmac.platform.db import get_async_session
from dotmac.platform.tenant.domain_verification import (
    DomainVerificationService,
    VerificationMethod,
)
from dotmac.platform.tenant.domain_verification_schemas import (
    DomainRemovalResponse,
    DomainVerificationCheck,
    DomainVerificationErrorResponse,
    DomainVerificationInitiate,
    DomainVerificationResponse,
    DomainVerificationStatusResponse,
)

logger = structlog.get_logger(__name__)

router = APIRouter(
    prefix="/tenants",
)


def get_domain_verification_service(
    db: Annotated[AsyncSession, Depends(get_async_session)],
) -> DomainVerificationService:
    """Dependency to get DomainVerificationService instance."""
    return DomainVerificationService(db)


@router.post(
    "/{tenant_id}/domains/verify",
    response_model=DomainVerificationResponse,
    status_code=status.HTTP_200_OK,
    summary="Initiate domain verification",
    description="Generate verification token and instructions for domain ownership verification",
    responses={
        400: {
            "model": DomainVerificationErrorResponse,
            "description": "Invalid domain or already verified",
        },
        403: {"description": "Insufficient permissions"},
        404: {"description": "Tenant not found"},
    },
)
async def initiate_domain_verification(
    tenant_id: str,
    request: DomainVerificationInitiate,
    current_user: Annotated[UserInfo, Depends(require_permission("tenant.domain.verify"))],
    service: Annotated[DomainVerificationService, Depends(get_domain_verification_service)],
) -> DomainVerificationResponse:
    """
    Initiate domain verification for a tenant.

    **Required Permission**: `tenant.domain.verify`

    **Process**:
    1. Validates domain format and availability
    2. Generates unique verification token (32 chars, SHA-256)
    3. Returns verification instructions based on method
    4. Token expires in 72 hours

    **Verification Methods**:
    - `dns_txt`: Add TXT record with verification token
    - `dns_cname`: Add CNAME record pointing to verification subdomain
    - `meta_tag`: Add HTML meta tag to homepage (future)
    - `file_upload`: Upload verification file to domain (future)

    **Example DNS TXT**:
    ```
    Type: TXT
    Name: @
    Value: dotmac-verify=abc123...
    TTL: 3600
    ```

    **Example DNS CNAME**:
    ```
    Type: CNAME
    Name: _dotmac-verify.example.com
    Target: abc123.verify.dotmac-platform.com
    TTL: 3600
    ```
    """
    # Ensure user is verifying their own tenant's domain
    if current_user.tenant_id != tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot verify domain for another tenant",
        )

    try:
        # Convert string method to enum
        verification_method = VerificationMethod(request.method)

        result = await service.initiate_verification(
            tenant_id=tenant_id,
            domain=request.domain,
            method=verification_method,
            user_id=current_user.user_id,
        )

        return DomainVerificationResponse(**result)

    except ValueError as e:
        logger.warning(
            "Domain verification initiation failed",
            tenant_id=tenant_id,
            domain=request.domain,
            error=str(e),
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception as e:
        logger.error(
            "Unexpected error during domain verification initiation",
            tenant_id=tenant_id,
            domain=request.domain,
            error=str(e),
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to initiate domain verification",
        )


@router.post(
    "/{tenant_id}/domains/check",
    response_model=DomainVerificationResponse,
    status_code=status.HTTP_200_OK,
    summary="Check domain verification",
    description="Verify domain ownership by checking DNS records or other verification methods",
    responses={
        400: {
            "model": DomainVerificationErrorResponse,
            "description": "Verification failed or token expired",
        },
        403: {"description": "Insufficient permissions"},
        404: {"description": "Tenant not found"},
    },
)
async def check_domain_verification(
    tenant_id: str,
    request: DomainVerificationCheck,
    current_user: Annotated[UserInfo, Depends(require_permission("tenant.domain.verify"))],
    service: Annotated[DomainVerificationService, Depends(get_domain_verification_service)],
) -> DomainVerificationResponse:
    """
    Check and complete domain verification.

    **Required Permission**: `tenant.domain.verify`

    **Process**:
    1. Queries DNS records for verification token
    2. Validates token matches expected value
    3. Updates tenant with verified domain
    4. Logs audit event

    **DNS Propagation**:
    - Allow 5-10 minutes for DNS changes to propagate
    - Check propagation: `dig example.com TXT +short`
    - Or: `dig _dotmac-verify.example.com CNAME +short`

    **On Success**:
    - Tenant's `domain` field is updated
    - Domain becomes exclusively associated with tenant
    - Verification status changes to `verified`

    **On Failure**:
    - Returns error with specific reason
    - Token remains valid until expiration
    - Can retry verification multiple times
    """
    # Ensure user is verifying their own tenant's domain
    if current_user.tenant_id != tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot verify domain for another tenant",
        )

    try:
        # Convert string method to enum
        verification_method = VerificationMethod(request.method)

        result = await service.verify_domain(
            tenant_id=tenant_id,
            domain=request.domain,
            token=request.token,
            method=verification_method,
            user_id=current_user.user_id,
        )

        return DomainVerificationResponse(**result)

    except ValueError as e:
        logger.warning(
            "Domain verification check failed",
            tenant_id=tenant_id,
            domain=request.domain,
            error=str(e),
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception as e:
        logger.error(
            "Unexpected error during domain verification check",
            tenant_id=tenant_id,
            domain=request.domain,
            error=str(e),
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to verify domain",
        )


@router.get(
    "/{tenant_id}/domains/status",
    response_model=DomainVerificationStatusResponse,
    status_code=status.HTTP_200_OK,
    summary="Get domain verification status",
    description="Get current domain verification status for a tenant",
    responses={
        403: {"description": "Insufficient permissions"},
        404: {"description": "Tenant not found"},
    },
)
async def get_domain_verification_status(
    tenant_id: str,
    current_user: Annotated[UserInfo, Depends(require_permission("tenant.domain.read"))],
    service: Annotated[DomainVerificationService, Depends(get_domain_verification_service)],
) -> DomainVerificationStatusResponse:
    """
    Get domain verification status for a tenant.

    **Required Permission**: `tenant.domain.read`

    **Returns**:
    - Current verified domain (if any)
    - Verification status
    - Verification timestamp

    **Use Cases**:
    - Check if domain verification is required
    - Display verified domain in tenant settings
    - Validate domain before custom branding operations
    """
    # Ensure user is checking their own tenant
    if current_user.tenant_id != tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot access domain status for another tenant",
        )

    try:
        tenant = await service._get_tenant(tenant_id)

        if not tenant:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Tenant {tenant_id} not found",
            )

        return DomainVerificationStatusResponse(
            tenant_id=tenant_id,
            domain=tenant.domain,
            is_verified=tenant.domain is not None,
            verified_at=tenant.updated_at if tenant.domain else None,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "Unexpected error getting domain status",
            tenant_id=tenant_id,
            error=str(e),
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get domain status",
        )


@router.delete(
    "/{tenant_id}/domains",
    response_model=DomainRemovalResponse,
    status_code=status.HTTP_200_OK,
    summary="Remove verified domain",
    description="Remove verified domain from tenant (requires admin permission)",
    responses={
        400: {
            "model": DomainVerificationErrorResponse,
            "description": "No domain associated with tenant",
        },
        403: {"description": "Insufficient permissions"},
        404: {"description": "Tenant not found"},
    },
)
async def remove_verified_domain(
    tenant_id: str,
    current_user: Annotated[UserInfo, Depends(require_permission("tenant.domain.delete"))],
    service: Annotated[DomainVerificationService, Depends(get_domain_verification_service)],
) -> DomainRemovalResponse:
    """
    Remove verified domain from tenant.

    **Required Permission**: `tenant.domain.delete`

    **Warning**: This operation:
    - Removes the verified domain from tenant
    - Domain can be claimed by another tenant
    - Custom branding may be affected
    - Audit event is logged

    **Use Cases**:
    - Tenant switching to different domain
    - Domain ownership transfer
    - Deprovisioning tenant resources
    """
    # Ensure user is removing domain from their own tenant (or is admin)
    if current_user.tenant_id != tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot remove domain from another tenant",
        )

    try:
        tenant = await service._get_tenant(tenant_id)

        if not tenant:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Tenant {tenant_id} not found",
            )

        if not tenant.domain:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No domain associated with this tenant",
            )

        result = await service.remove_domain(
            tenant_id=tenant_id,
            domain=tenant.domain,
            user_id=current_user.user_id,
        )

        return DomainRemovalResponse(**result)

    except HTTPException:
        raise
    except ValueError as e:
        logger.warning(
            "Domain removal failed",
            tenant_id=tenant_id,
            error=str(e),
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception as e:
        logger.error(
            "Unexpected error during domain removal",
            tenant_id=tenant_id,
            error=str(e),
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to remove domain",
        )
