"""
Tenant-facing payment methods API router.

Provides self-service endpoints for tenant admins to manage payment methods.
"""

import structlog
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.auth.core import UserInfo
from dotmac.platform.auth.dependencies import require_scopes
from dotmac.platform.billing._typing_helpers import rate_limit
from dotmac.platform.billing.exceptions import PaymentMethodError
from dotmac.platform.db import get_async_session
from dotmac.platform.tenant import get_current_tenant_id

from .models import (
    AddPaymentMethodRequest,
    PaymentMethodResponse,
    UpdatePaymentMethodRequest,
    VerifyPaymentMethodRequest,
)
from .service import PaymentMethodService

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/tenant/payment-methods", tags=["Tenant - Payment Methods"])


# ============================================================================
# List Payment Methods
# ============================================================================


@router.get("", response_model=list[PaymentMethodResponse])
async def list_payment_methods(
    tenant_id: str = Depends(get_current_tenant_id),
    db_session: AsyncSession = Depends(get_async_session),
    current_user: UserInfo = Depends(require_scopes("billing.payment_methods.view")),
) -> list[PaymentMethodResponse]:
    """
    List all payment methods for the tenant.

    Returns all active and pending verification payment methods.
    Expired and inactive methods are excluded.

    **Card Details**: Only last 4 digits and expiration are shown
    **Bank Details**: Only last 4 digits and bank name are shown

    **Permissions**: Requires billing.payment_methods.view permission
    """
    service = PaymentMethodService(db_session)

    try:
        payment_methods = await service.list_payment_methods(tenant_id)

        logger.info(
            "Payment methods retrieved",
            tenant_id=tenant_id,
            count=len(payment_methods),
            user_id=current_user.user_id,
        )

        return payment_methods

    except Exception as e:
        logger.error(
            "Failed to retrieve payment methods",
            tenant_id=tenant_id,
            error=str(e),
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve payment methods",
        )


# ============================================================================
# Add Payment Method
# ============================================================================


@router.post("", response_model=PaymentMethodResponse, status_code=status.HTTP_201_CREATED)
@rate_limit("10/minute")  # type: ignore[misc]
async def add_payment_method(
    request: AddPaymentMethodRequest,
    tenant_id: str = Depends(get_current_tenant_id),
    db_session: AsyncSession = Depends(get_async_session),
    current_user: UserInfo = Depends(require_scopes("billing.payment_methods.manage")),
) -> PaymentMethodResponse:
    """
    Add a new payment method for the tenant.

    **Supported Types**:
    - **Card**: Credit/debit card via Stripe token
    - **Bank Account**: ACH bank account via Stripe token (requires verification)
    - **Wallet**: Digital wallet (Apple Pay, Google Pay)

    **Process**:
    1. Client creates token with Stripe.js or Stripe mobile SDK
    2. Submit token to this endpoint
    3. Payment method is saved securely (PCI compliant)
    4. For bank accounts, microdeposits are initiated for verification

    **Important**:
    - Never send raw card numbers to this endpoint
    - Always use payment gateway tokens (e.g., Stripe tokens)
    - Bank accounts require verification before use

    **Permissions**: Requires billing.payment_methods.manage permission (TENANT_ADMIN or TENANT_BILLING_MANAGER)
    **Rate Limit**: 10 additions per minute
    """
    service = PaymentMethodService(db_session)

    try:
        # Get appropriate token based on method type
        token = None
        if request.method_type.value == "card":
            token = request.card_token
        elif request.method_type.value == "bank_account":
            token = request.bank_token
        elif request.method_type.value == "wallet":
            token = request.wallet_token

        if not token:
            raise ValueError(f"Token required for {request.method_type.value} payment method")

        # Billing details
        billing_details = {
            "billing_name": request.billing_name,
            "billing_email": request.billing_email,
            "billing_phone": request.billing_phone,
            "billing_address_line1": request.billing_address_line1,
            "billing_address_line2": request.billing_address_line2,
            "billing_city": request.billing_city,
            "billing_state": request.billing_state,
            "billing_postal_code": request.billing_postal_code,
            "billing_country": request.billing_country,
        }

        # Backward-compatible keys for legacy consumers inside the service layer.
        billing_details["name"] = request.billing_name
        billing_details["email"] = request.billing_email
        billing_details["phone"] = request.billing_phone
        billing_details["address_line1"] = request.billing_address_line1
        billing_details["address_line2"] = request.billing_address_line2
        billing_details["city"] = request.billing_city
        billing_details["state"] = request.billing_state
        billing_details["postal_code"] = request.billing_postal_code
        billing_details["country"] = request.billing_country

        payment_method = await service.add_payment_method(
            tenant_id=tenant_id,
            method_type=request.method_type,
            token=token,
            billing_details=billing_details,
            set_as_default=request.set_as_default,
            added_by_user_id=current_user.user_id,
        )

        logger.info(
            "Payment method added",
            tenant_id=tenant_id,
            payment_method_id=payment_method.payment_method_id,
            method_type=request.method_type,
            user_id=current_user.user_id,
        )

        return payment_method

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except NotImplementedError as e:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail=str(e),
        )
    except Exception as e:
        logger.error(
            "Failed to add payment method",
            tenant_id=tenant_id,
            error=str(e),
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to add payment method",
        )


# ============================================================================
# Update Payment Method
# ============================================================================


@router.patch("/{payment_method_id}", response_model=PaymentMethodResponse)
@rate_limit("10/minute")  # type: ignore[misc]
async def update_payment_method(
    payment_method_id: str,
    request: UpdatePaymentMethodRequest,
    tenant_id: str = Depends(get_current_tenant_id),
    db_session: AsyncSession = Depends(get_async_session),
    current_user: UserInfo = Depends(require_scopes("billing.payment_methods.manage")),
) -> PaymentMethodResponse:
    """
    Update payment method billing details.

    **What Can Be Updated**:
    - Billing name
    - Billing email and phone
    - Billing/shipping address

    **What Cannot Be Updated**:
    - Card/bank account numbers
    - Card expiration (must add new card)
    - Payment method type

    **Note**: To update card/bank details, add a new payment method and remove the old one.

    **Permissions**: Requires billing.payment_methods.manage permission (TENANT_ADMIN or TENANT_BILLING_MANAGER)
    **Rate Limit**: 10 updates per minute
    """
    service = PaymentMethodService(db_session)

    try:
        billing_details = request.model_dump(exclude_unset=True)

        payment_method = await service.update_payment_method(
            payment_method_id=payment_method_id,
            tenant_id=tenant_id,
            billing_details=billing_details,
            updated_by_user_id=current_user.user_id,
        )

        logger.info(
            "Payment method updated",
            tenant_id=tenant_id,
            payment_method_id=payment_method_id,
            user_id=current_user.user_id,
        )

        return payment_method

    except PaymentMethodError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )
    except NotImplementedError as e:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail=str(e),
        )
    except Exception as e:
        logger.error(
            "Failed to update payment method",
            tenant_id=tenant_id,
            payment_method_id=payment_method_id,
            error=str(e),
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update payment method",
        )


# ============================================================================
# Set Default Payment Method
# ============================================================================


@router.post("/{payment_method_id}/set-default", response_model=PaymentMethodResponse)
@rate_limit("10/minute")  # type: ignore[misc]
async def set_default_payment_method(
    payment_method_id: str,
    tenant_id: str = Depends(get_current_tenant_id),
    db_session: AsyncSession = Depends(get_async_session),
    current_user: UserInfo = Depends(require_scopes("billing.payment_methods.manage")),
) -> PaymentMethodResponse:
    """
    Set a payment method as the default for the tenant.

    **What Happens**:
    - Previous default is automatically unset
    - New default is used for all future invoices
    - Existing scheduled invoices are updated

    **Requirements**:
    - Payment method must be ACTIVE
    - Bank accounts must be verified first

    **Permissions**: Requires billing.payment_methods.manage permission (TENANT_ADMIN or TENANT_BILLING_MANAGER)
    **Rate Limit**: 10 requests per minute
    """
    service = PaymentMethodService(db_session)

    try:
        payment_method = await service.set_default_payment_method(
            payment_method_id=payment_method_id,
            tenant_id=tenant_id,
            set_by_user_id=current_user.user_id,
        )

        logger.info(
            "Default payment method set",
            tenant_id=tenant_id,
            payment_method_id=payment_method_id,
            user_id=current_user.user_id,
        )

        return payment_method

    except PaymentMethodError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except NotImplementedError as e:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail=str(e),
        )
    except Exception as e:
        logger.error(
            "Failed to set default payment method",
            tenant_id=tenant_id,
            payment_method_id=payment_method_id,
            error=str(e),
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to set default payment method",
        )


# ============================================================================
# Remove Payment Method
# ============================================================================


@router.delete("/{payment_method_id}", status_code=status.HTTP_204_NO_CONTENT)
@rate_limit("10/minute")  # type: ignore[misc]
async def remove_payment_method(
    payment_method_id: str,
    tenant_id: str = Depends(get_current_tenant_id),
    db_session: AsyncSession = Depends(get_async_session),
    current_user: UserInfo = Depends(require_scopes("billing.payment_methods.manage")),
) -> None:
    """
    Remove a payment method.

    **Important**:
    - Cannot remove the default payment method if you have active subscriptions
    - Must set a different default first
    - Payment method is detached from payment gateway

    **What Happens**:
    - Payment method is removed from payment gateway
    - Payment method record is soft-deleted
    - Cannot be used for future payments

    **Permissions**: Requires billing.payment_methods.manage permission (TENANT_ADMIN or TENANT_BILLING_MANAGER)
    **Rate Limit**: 10 removals per minute
    """
    service = PaymentMethodService(db_session)

    try:
        await service.remove_payment_method(
            payment_method_id=payment_method_id,
            tenant_id=tenant_id,
            removed_by_user_id=current_user.user_id,
        )

        logger.info(
            "Payment method removed",
            tenant_id=tenant_id,
            payment_method_id=payment_method_id,
            user_id=current_user.user_id,
        )

    except PaymentMethodError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except NotImplementedError as e:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail=str(e),
        )
    except Exception as e:
        logger.error(
            "Failed to remove payment method",
            tenant_id=tenant_id,
            payment_method_id=payment_method_id,
            error=str(e),
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to remove payment method",
        )


# ============================================================================
# Verify Payment Method (Bank Accounts)
# ============================================================================


@router.post("/{payment_method_id}/verify", response_model=PaymentMethodResponse)
@rate_limit("5/minute")  # type: ignore[misc]
async def verify_payment_method(
    payment_method_id: str,
    request: VerifyPaymentMethodRequest,
    tenant_id: str = Depends(get_current_tenant_id),
    db_session: AsyncSession = Depends(get_async_session),
    current_user: UserInfo = Depends(require_scopes("billing.payment_methods.manage")),
) -> PaymentMethodResponse:
    """
    Verify a payment method using microdeposit codes.

    **For Bank Accounts Only**:
    After adding a bank account, we send 2 small deposits (< $1) to verify ownership.

    **Process**:
    1. Check your bank statement for 2 small deposits (usually arrives in 1-3 business days)
    2. Note the exact amounts (e.g., $0.32 and $0.45)
    3. Submit the amounts here to verify

    **After Verification**:
    - Bank account status changes to ACTIVE
    - Can be used for payments
    - Can be set as default

    **Permissions**: Requires billing.payment_methods.manage permission (TENANT_ADMIN or TENANT_BILLING_MANAGER)
    **Rate Limit**: 5 verification attempts per minute
    """
    service = PaymentMethodService(db_session)

    try:
        payment_method = await service.verify_payment_method(
            payment_method_id=payment_method_id,
            tenant_id=tenant_id,
            verification_code1=request.verification_code1,
            verification_code2=request.verification_code2,
            verified_by_user_id=current_user.user_id,
        )

        logger.info(
            "Payment method verified",
            tenant_id=tenant_id,
            payment_method_id=payment_method_id,
            user_id=current_user.user_id,
        )

        return payment_method

    except PaymentMethodError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except NotImplementedError as e:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail=str(e),
        )
    except Exception as e:
        logger.error(
            "Failed to verify payment method",
            tenant_id=tenant_id,
            payment_method_id=payment_method_id,
            error=str(e),
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to verify payment method",
        )
