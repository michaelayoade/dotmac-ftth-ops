"""
Bank account and manual payment API endpoints
"""

import logging
from typing import Any

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.auth.dependencies import UserInfo, get_current_user
from dotmac.platform.billing.bank_accounts.cash_register_service import (
    CashRegisterService,
)
from dotmac.platform.billing.bank_accounts.models import (
    BankAccountSummary,
    BankTransferCreate,
    CashPaymentCreate,
    CashRegisterCreate,
    CashRegisterReconciliationCreate,
    CashRegisterReconciliationResponse,
    CashRegisterResponse,
    CheckPaymentCreate,
    CompanyBankAccountCreate,
    CompanyBankAccountResponse,
    CompanyBankAccountUpdate,
    ManualPaymentResponse,
    MobileMoneyCreate,
    PaymentSearchFilters,
    ReconcilePaymentRequest,
)
from dotmac.platform.billing.bank_accounts.service import (
    BankAccountService,
    ManualPaymentService,
)
from dotmac.platform.db import get_session_dependency
from dotmac.platform.file_storage.service import FileStorageService

logger = logging.getLogger(__name__)

# Note: The parent billing router already applies the /billing prefix.
# Keep this router unprefixed so explicit paths below map to:
#   /api/v1/billing/bank-accounts/*
#   /api/v1/billing/payments/* (manual payments recorded against bank accounts)
router = APIRouter(prefix="", tags=["Billing - Bank Accounts"])

# ============================================================================
# Company Bank Account Endpoints
# ============================================================================


@router.post("/bank-accounts", response_model=CompanyBankAccountResponse)
async def create_bank_account(
    account_data: CompanyBankAccountCreate,
    current_user: UserInfo = Depends(get_current_user),
    db: AsyncSession = Depends(get_session_dependency),
) -> CompanyBankAccountResponse:
    """Create a new company bank account"""
    service = BankAccountService(db)
    tenant_id = current_user.tenant_id or "default"
    user_id = current_user.user_id

    try:
        account = await service.create_bank_account(
            tenant_id=tenant_id, data=account_data, created_by=user_id
        )
        return account
    except Exception as e:
        logger.error(f"Error creating bank account: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create bank account",
        )


@router.get("/bank-accounts", response_model=list[CompanyBankAccountResponse])
async def list_bank_accounts(
    include_inactive: bool = Query(False, description="Include inactive accounts"),
    current_user: UserInfo = Depends(get_current_user),
    db: AsyncSession = Depends(get_session_dependency),
) -> list[CompanyBankAccountResponse]:
    """List all company bank accounts"""
    service = BankAccountService(db)
    tenant_id = current_user.tenant_id or "default"

    try:
        accounts: list[CompanyBankAccountResponse] = await service.get_bank_accounts(
            tenant_id=tenant_id, include_inactive=include_inactive
        )
        return accounts
    except Exception as e:
        logger.error(f"Error listing bank accounts: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to list bank accounts"
        )


@router.get("/bank-accounts/{account_id}", response_model=CompanyBankAccountResponse)
async def get_bank_account(
    account_id: int,
    current_user: UserInfo = Depends(get_current_user),
    db: AsyncSession = Depends(get_session_dependency),
) -> CompanyBankAccountResponse:
    """Get a specific bank account"""
    service = BankAccountService(db)
    tenant_id = current_user.tenant_id or "default"

    account = await service.get_bank_account(tenant_id, account_id)
    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=f"Bank account {account_id} not found"
        )

    return account


@router.get("/bank-accounts/{account_id}/summary", response_model=BankAccountSummary)
async def get_bank_account_summary(
    account_id: int,
    current_user: UserInfo = Depends(get_current_user),
    db: AsyncSession = Depends(get_session_dependency),
) -> BankAccountSummary:
    """Get bank account with summary statistics"""
    service = BankAccountService(db)
    tenant_id = current_user.tenant_id or "default"

    try:
        summary = await service.get_bank_account_summary(tenant_id, account_id)
        return summary
    except Exception as e:
        logger.error(f"Error getting bank account summary: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get bank account summary",
        )


@router.put("/bank-accounts/{account_id}", response_model=CompanyBankAccountResponse)
async def update_bank_account(
    account_id: int,
    update_data: CompanyBankAccountUpdate,
    current_user: UserInfo = Depends(get_current_user),
    db: AsyncSession = Depends(get_session_dependency),
) -> CompanyBankAccountResponse:
    """Update a bank account"""
    service = BankAccountService(db)
    tenant_id = current_user.tenant_id or "default"
    user_id = current_user.user_id

    try:
        account = await service.update_bank_account(
            tenant_id=tenant_id, account_id=account_id, data=update_data, updated_by=user_id
        )
        return account
    except Exception as e:
        logger.error(f"Error updating bank account: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update bank account",
        )


@router.post("/bank-accounts/{account_id}/verify", response_model=CompanyBankAccountResponse)
async def verify_bank_account(
    account_id: int,
    notes: str | None = None,
    current_user: UserInfo = Depends(get_current_user),
    db: AsyncSession = Depends(get_session_dependency),
) -> CompanyBankAccountResponse:
    """Verify a bank account"""
    service = BankAccountService(db)
    tenant_id = current_user.tenant_id or "default"
    user_id = current_user.user_id

    try:
        account = await service.verify_bank_account(
            tenant_id=tenant_id, account_id=account_id, verified_by=user_id, notes=notes
        )
        return account
    except Exception as e:
        logger.error(f"Error verifying bank account: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to verify bank account",
        )


@router.delete("/bank-accounts/{account_id}", response_model=CompanyBankAccountResponse)
async def deactivate_bank_account(
    account_id: int,
    current_user: UserInfo = Depends(get_current_user),
    db: AsyncSession = Depends(get_session_dependency),
) -> CompanyBankAccountResponse:
    """Deactivate a bank account"""
    service = BankAccountService(db)
    tenant_id = current_user.tenant_id or "default"
    user_id = current_user.user_id

    try:
        account = await service.deactivate_bank_account(
            tenant_id=tenant_id, account_id=account_id, updated_by=user_id
        )
        return account
    except Exception as e:
        logger.error(f"Error deactivating bank account: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to deactivate bank account",
        )


# ============================================================================
# Manual Payment Recording Endpoints
# ============================================================================


@router.post("/payments/cash", response_model=ManualPaymentResponse)
async def record_cash_payment(
    payment_data: CashPaymentCreate,
    current_user: UserInfo = Depends(get_current_user),
    db: AsyncSession = Depends(get_session_dependency),
) -> ManualPaymentResponse:
    """Record a cash payment"""
    service = ManualPaymentService(db)
    tenant_id = current_user.tenant_id or "default"
    user_id = current_user.user_id

    try:
        payment = await service.record_cash_payment(
            tenant_id=tenant_id, data=payment_data, recorded_by=user_id
        )
        return payment
    except Exception as e:
        logger.error(f"Error recording cash payment: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to record cash payment",
        )


@router.post("/payments/check", response_model=ManualPaymentResponse)
async def record_check_payment(
    payment_data: CheckPaymentCreate,
    current_user: UserInfo = Depends(get_current_user),
    db: AsyncSession = Depends(get_session_dependency),
) -> ManualPaymentResponse:
    """Record a check payment"""
    service = ManualPaymentService(db)
    tenant_id = current_user.tenant_id or "default"
    user_id = current_user.user_id

    try:
        payment = await service.record_check_payment(
            tenant_id=tenant_id, data=payment_data, recorded_by=user_id
        )
        return payment
    except Exception as e:
        logger.error(f"Error recording check payment: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to record check payment",
        )


@router.post("/payments/bank-transfer", response_model=ManualPaymentResponse)
async def record_bank_transfer(
    payment_data: BankTransferCreate,
    current_user: UserInfo = Depends(get_current_user),
    db: AsyncSession = Depends(get_session_dependency),
) -> ManualPaymentResponse:
    """Record a bank transfer"""
    service = ManualPaymentService(db)
    tenant_id = current_user.tenant_id or "default"
    user_id = current_user.user_id

    try:
        payment = await service.record_bank_transfer(
            tenant_id=tenant_id, data=payment_data, recorded_by=user_id
        )
        return payment
    except Exception as e:
        logger.error(f"Error recording bank transfer: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to record bank transfer",
        )


@router.post("/payments/mobile-money", response_model=ManualPaymentResponse)
async def record_mobile_money(
    payment_data: MobileMoneyCreate,
    current_user: UserInfo = Depends(get_current_user),
    db: AsyncSession = Depends(get_session_dependency),
) -> ManualPaymentResponse:
    """Record a mobile money payment"""
    service = ManualPaymentService(db)
    tenant_id = current_user.tenant_id or "default"
    user_id = current_user.user_id

    try:
        payment = await service.record_mobile_money(
            tenant_id=tenant_id, data=payment_data, recorded_by=user_id
        )
        return payment
    except Exception as e:
        logger.error(f"Error recording mobile money payment: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to record mobile money payment",
        )


@router.post("/payments/search", response_model=list[ManualPaymentResponse])
async def search_manual_payments(
    filters: PaymentSearchFilters,
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    current_user: UserInfo = Depends(get_current_user),
    db: AsyncSession = Depends(get_session_dependency),
) -> list[ManualPaymentResponse]:
    """Search manual payments with filters"""
    service = ManualPaymentService(db)
    tenant_id = current_user.tenant_id or "default"

    try:
        payments: list[ManualPaymentResponse] = await service.search_payments(
            tenant_id=tenant_id, filters=filters, limit=limit, offset=offset
        )
        return payments
    except Exception as e:
        logger.error(f"Error searching payments: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to search payments"
        )


@router.post("/payments/{payment_id}/verify", response_model=ManualPaymentResponse)
async def verify_payment(
    payment_id: int,
    notes: str | None = None,
    current_user: UserInfo = Depends(get_current_user),
    db: AsyncSession = Depends(get_session_dependency),
) -> ManualPaymentResponse:
    """Verify a manual payment"""
    service = ManualPaymentService(db)
    tenant_id = current_user.tenant_id or "default"
    user_id = current_user.user_id

    try:
        payment = await service.verify_payment(
            tenant_id=tenant_id, payment_id=payment_id, verified_by=user_id, notes=notes
        )
        return payment
    except Exception as e:
        logger.error(f"Error verifying payment: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to verify payment"
        )


@router.post("/payments/reconcile", response_model=list[ManualPaymentResponse])
async def reconcile_payments(
    request: ReconcilePaymentRequest,
    current_user: UserInfo = Depends(get_current_user),
    db: AsyncSession = Depends(get_session_dependency),
) -> list[ManualPaymentResponse]:
    """Reconcile multiple payments"""
    service = ManualPaymentService(db)
    tenant_id = current_user.tenant_id or "default"
    user_id = current_user.user_id

    try:
        payments: list[ManualPaymentResponse] = await service.reconcile_payments(
            tenant_id=tenant_id,
            payment_ids=request.payment_ids,
            reconciled_by=user_id,
            notes=request.reconciliation_notes,
        )
        return payments
    except Exception as e:
        logger.error(f"Error reconciling payments: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to reconcile payments"
        )


@router.post("/payments/{payment_id}/attachments")
async def upload_payment_attachment(
    payment_id: int,
    file: UploadFile = File(...),
    current_user: UserInfo = Depends(get_current_user),
    db: AsyncSession = Depends(get_session_dependency),
) -> dict[str, Any]:
    """Upload an attachment for a payment (receipt, check image, etc.)"""
    tenant_id = current_user.tenant_id or "default"
    user_id = current_user.user_id

    try:
        # Verify payment exists
        service = ManualPaymentService(db)
        payment = await service.get_payment(tenant_id, payment_id)
        if not payment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail=f"Payment {payment_id} not found"
            )

        # Upload file to storage service
        storage_service = FileStorageService()

        # Read file content
        content = await file.read()

        # Create unique filename
        import uuid

        # Handle optional filename with None check
        filename = file.filename if file.filename is not None else "unknown.pdf"
        file_extension = filename.split(".")[-1] if "." in filename else "pdf"
        unique_filename = f"payment_{payment_id}_{uuid.uuid4()}.{file_extension}"

        # Store file with metadata
        file_metadata_result = await storage_service.store_file(
            file_data=content,
            file_name=unique_filename,
            content_type=file.content_type or "application/octet-stream",
            tenant_id=tenant_id,
            metadata={
                "payment_id": payment_id,
                "original_filename": filename,
                "uploaded_by": user_id,
                "payment_reference": payment.payment_reference,
                "payment_method": payment.payment_method,
            },
        )

        # Extract file_id and file_size from result
        file_id = (
            file_metadata_result.file_id
            if hasattr(file_metadata_result, "file_id")
            else str(file_metadata_result)
        )
        file_size = (
            file_metadata_result.file_size if hasattr(file_metadata_result, "file_size") else 0
        )

        # Update payment with attachment URL
        attachment_url = f"/api/v1/billing/payments/{payment_id}/attachments/{file_id}"
        await service.add_attachment(tenant_id, payment_id, attachment_url)

        logger.info(
            f"Payment attachment uploaded: payment_id={payment_id}, file_id={file_id}, tenant_id={tenant_id}"
        )

        return {
            "message": "Attachment uploaded successfully",
            "payment_id": payment_id,
            "file_id": file_id,
            "filename": filename,
            "url": attachment_url,
            "size": file_size,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error uploading payment attachment: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to upload attachment"
        )


# ============================================================================
# Cash Register Endpoints (for businesses with physical locations)
# ============================================================================


@router.post("/cash-registers", response_model=CashRegisterResponse)
async def create_cash_register(
    register_data: CashRegisterCreate,
    current_user: UserInfo = Depends(get_current_user),
    db: AsyncSession = Depends(get_session_dependency),
) -> CashRegisterResponse:
    """Create a new cash register/point"""
    service = CashRegisterService(db)
    tenant_id = current_user.tenant_id or "default"
    user_id = current_user.user_id

    try:
        register = await service.create_cash_register(
            tenant_id=tenant_id, data=register_data, created_by=user_id
        )
        return register
    except Exception as e:
        logger.error(f"Error creating cash register: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create cash register",
        )


@router.get("/cash-registers", response_model=list[CashRegisterResponse])
async def list_cash_registers(
    include_inactive: bool = Query(False, description="Include inactive registers"),
    current_user: UserInfo = Depends(get_current_user),
    db: AsyncSession = Depends(get_session_dependency),
) -> list[CashRegisterResponse]:
    """List all cash registers"""
    service = CashRegisterService(db)
    tenant_id = current_user.tenant_id or "default"

    try:
        registers: list[CashRegisterResponse] = await service.get_cash_registers(
            tenant_id=tenant_id, include_inactive=include_inactive
        )
        return registers
    except Exception as e:
        logger.error(f"Error listing cash registers: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to list cash registers",
        )


@router.get("/cash-registers/{register_id}", response_model=CashRegisterResponse)
async def get_cash_register(
    register_id: str,
    current_user: UserInfo = Depends(get_current_user),
    db: AsyncSession = Depends(get_session_dependency),
) -> CashRegisterResponse:
    """Get a specific cash register"""
    service = CashRegisterService(db)
    tenant_id = current_user.tenant_id or "default"

    register = await service.get_cash_register(tenant_id, register_id)
    if not register:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=f"Cash register {register_id} not found"
        )

    return register


@router.post("/cash-registers/{register_id}/reconcile")
async def reconcile_cash_register(
    register_id: str,
    data: CashRegisterReconciliationCreate,
    current_user: UserInfo = Depends(get_current_user),
    db: AsyncSession = Depends(get_session_dependency),
) -> CashRegisterReconciliationResponse:
    """Reconcile a cash register"""
    service = CashRegisterService(db)
    tenant_id = current_user.tenant_id or "default"
    user_id = current_user.user_id

    try:
        reconciliation = await service.reconcile_register(
            tenant_id=tenant_id, register_id=register_id, data=data, reconciled_by=user_id
        )
        return reconciliation
    except Exception as e:
        logger.error(f"Error reconciling cash register: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to reconcile cash register",
        )


@router.put("/cash-registers/{register_id}/float")
async def update_cash_float(
    register_id: str,
    new_float: float = Query(..., description="New float amount"),
    reason: str = Query(..., description="Reason for float change"),
    current_user: UserInfo = Depends(get_current_user),
    db: AsyncSession = Depends(get_session_dependency),
) -> CashRegisterResponse:
    """Update cash register float"""
    service = CashRegisterService(db)
    tenant_id = current_user.tenant_id or "default"
    user_id = current_user.user_id

    try:
        register = await service.update_float(
            tenant_id=tenant_id,
            register_id=register_id,
            new_float=new_float,
            reason=reason,
            updated_by=user_id,
        )
        return register
    except Exception as e:
        logger.error(f"Error updating cash float: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to update cash float"
        )


@router.delete("/cash-registers/{register_id}", response_model=CashRegisterResponse)
async def deactivate_cash_register(
    register_id: str,
    current_user: UserInfo = Depends(get_current_user),
    db: AsyncSession = Depends(get_session_dependency),
) -> CashRegisterResponse:
    """Deactivate a cash register"""
    service = CashRegisterService(db)
    tenant_id = current_user.tenant_id or "default"
    user_id = current_user.user_id

    try:
        register = await service.deactivate_register(
            tenant_id=tenant_id, register_id=register_id, deactivated_by=user_id
        )
        return register
    except Exception as e:
        logger.error(f"Error deactivating cash register: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to deactivate cash register",
        )
