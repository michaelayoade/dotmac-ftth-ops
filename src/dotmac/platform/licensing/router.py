"""
Licensing API Router.

REST API endpoints for software licensing, activation, and compliance.
"""

from datetime import UTC
from typing import Annotated, Any

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth.core import UserInfo
from ..auth.dependencies import get_current_user
from ..db import get_async_session
from .models import (
    Activation,
    License,
    LicenseOrder,
    LicenseTemplate,
)
from .schemas import (
    ActivationCreate,
    ActivationHeartbeat,
    ActivationResponse,
    ActivationValidation,
    ActivationValidationResponse,
    DeviceBlacklist,
    EmergencyCodeRequest,
    EmergencyCodeResponse,
    IntegrityCheckRequest,
    IntegrityCheckResponse,
    LicenseCreate,
    LicenseOrderCreate,
    LicenseOrderResponse,
    LicenseRenewal,
    LicenseResponse,
    LicenseTemplateCreate,
    LicenseTemplateResponse,
    LicenseTemplateUpdate,
    LicenseTransfer,
    LicenseUpdate,
    LicenseValidationRequest,
    LicenseValidationResponse,
    OfflineActivationProcess,
    OfflineActivationRequest,
    OfflineActivationResponse,
    OrderApproval,
    OrderCancellation,
    SuspiciousActivityReport,
    SuspiciousActivityResponse,
)
from .service import LicensingService

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/api/licensing", tags=["Licensing"])


def _serialize_template(template: LicenseTemplate) -> LicenseTemplateResponse:
    features_raw = getattr(template, "features", None)
    if isinstance(features_raw, dict):
        features_raw = features_raw.get("features", [])
    if features_raw is None:
        features_raw = []

    restrictions_raw = getattr(template, "restrictions", None)
    if isinstance(restrictions_raw, dict):
        restrictions_raw = restrictions_raw.get("restrictions", [])
    if restrictions_raw is None:
        restrictions_raw = []

    pricing_raw = getattr(template, "pricing", None)
    if pricing_raw is None:
        pricing_raw = {}
    elif not isinstance(pricing_raw, dict):
        pricing_raw = pricing_raw.model_dump()

    auto_renewal = getattr(template, "auto_renewal_enabled", False)
    trial_allowed = getattr(template, "trial_allowed", False)
    active_value = getattr(template, "active", None)
    if active_value is None:
        active_value = True

    payload = {
        "id": template.id,
        "template_name": template.template_name,
        "product_id": template.product_id,
        "description": getattr(template, "description", None),
        "license_type": template.license_type,
        "license_model": template.license_model,
        "default_duration": getattr(template, "default_duration", 0),
        "max_activations": getattr(template, "max_activations", 0),
        "features": features_raw,
        "restrictions": restrictions_raw,
        "pricing": pricing_raw,
        "auto_renewal_enabled": bool(auto_renewal),
        "trial_allowed": bool(trial_allowed),
        "trial_duration_days": getattr(template, "trial_duration_days", 0),
        "grace_period_days": getattr(template, "grace_period_days", 0),
        "active": bool(active_value),
        "created_at": getattr(template, "created_at", None),
        "updated_at": getattr(template, "updated_at", None),
    }

    return LicenseTemplateResponse.model_validate(payload)


def _serialize_order(order: LicenseOrder) -> LicenseOrderResponse:
    features_raw = order.custom_features
    if isinstance(features_raw, dict):
        features_raw = features_raw.get("features", [])

    restrictions_raw = order.custom_restrictions
    if isinstance(restrictions_raw, dict):
        restrictions_raw = restrictions_raw.get("restrictions", [])

    pricing_override = order.pricing_override
    if pricing_override and not isinstance(pricing_override, dict):
        pricing_override = pricing_override.model_dump()

    payload = {
        "id": order.id,
        "order_number": order.order_number,
        "template_id": order.template_id,
        "quantity": order.quantity,
        "customer_id": str(order.customer_id) if order.customer_id else None,
        "reseller_id": order.reseller_id,
        "custom_features": features_raw,
        "custom_restrictions": restrictions_raw,
        "duration_override": order.duration_override,
        "pricing_override": pricing_override,
        "special_instructions": order.special_instructions,
        "fulfillment_method": order.fulfillment_method,
        "status": order.status,
        "total_amount": float(order.total_amount or 0),
        "discount_applied": (
            float(order.discount_applied) if order.discount_applied is not None else None
        ),
        "payment_status": order.payment_status,
        "invoice_id": str(order.invoice_id) if order.invoice_id else None,
        "subscription_id": order.subscription_id,
        "generated_licenses": order.generated_licenses,
        "created_at": order.created_at,
        "fulfilled_at": order.fulfilled_at,
        "updated_at": order.updated_at,
    }

    return LicenseOrderResponse.model_validate(payload)


def get_licensing_service(
    session: Annotated[AsyncSession, Depends(get_async_session)],
    current_user: Annotated[UserInfo, Depends(get_current_user)],
) -> LicensingService:
    """Dependency for licensing service."""
    return LicensingService(
        session=session,
        tenant_id=current_user.tenant_id or "",  # type: ignore[arg-type]
        user_id=current_user.user_id,
    )


# ==================== License Management ====================


@router.get("/licenses", response_model=dict[str, Any])
async def get_licenses(
    service: Annotated[LicensingService, Depends(get_licensing_service)],
    customer_id: str | None = None,
    product_id: str | None = None,
    status: str | None = None,
    license_type: str | None = None,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
) -> Any:
    """Get paginated list of licenses."""
    query = select(License).where(License.tenant_id == service.tenant_id)

    if customer_id:
        query = query.where(License.customer_id == customer_id)
    if product_id:
        query = query.where(License.product_id == product_id)
    if status:
        query = query.where(License.status == status)
    if license_type:
        query = query.where(License.license_type == license_type)

    # Get total count
    count_query = select(License).where(License.tenant_id == service.tenant_id)
    total = len((await service.session.execute(count_query)).scalars().all())

    # Apply pagination
    query = query.limit(limit).offset(offset)
    result = await service.session.execute(query)
    licenses = result.scalars().all()

    return {
        "data": [LicenseResponse.model_validate(lic) for lic in licenses],
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@router.get("/licenses/{license_id}", response_model=dict[str, LicenseResponse])
async def get_license(
    license_id: str,
    service: Annotated[LicensingService, Depends(get_licensing_service)],
) -> Any:
    """Get license by ID."""
    license_obj = await service.get_license(license_id)
    if not license_obj:
        raise HTTPException(status_code=404, detail="License not found")

    return {"data": LicenseResponse.model_validate(license_obj)}


@router.get("/licenses/by-key/{license_key}", response_model=dict[str, LicenseResponse])
async def get_license_by_key(
    license_key: str,
    service: Annotated[LicensingService, Depends(get_licensing_service)],
) -> Any:
    """Get license by license key."""
    license_obj = await service.get_license_by_key(license_key)
    if not license_obj:
        raise HTTPException(status_code=404, detail="License not found")

    return {"data": LicenseResponse.model_validate(license_obj)}


@router.post(
    "/licenses", response_model=dict[str, LicenseResponse], status_code=status.HTTP_201_CREATED
)
async def create_license(
    data: LicenseCreate,
    service: Annotated[LicensingService, Depends(get_licensing_service)],
) -> Any:
    """Create a new license."""
    try:
        license_obj = await service.create_license(data)
        await service.session.commit()
        return {"data": LicenseResponse.model_validate(license_obj)}
    except Exception as e:
        await service.session.rollback()
        logger.error("Failed to create license", error=str(e))
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/licenses/{license_id}", response_model=dict[str, LicenseResponse])
async def update_license(
    license_id: str,
    data: LicenseUpdate,
    service: Annotated[LicensingService, Depends(get_licensing_service)],
) -> Any:
    """Update license details."""
    try:
        license_obj = await service.update_license(license_id, data)
        await service.session.commit()
        return {"data": LicenseResponse.model_validate(license_obj)}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        await service.session.rollback()
        logger.error("Failed to update license", error=str(e))
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/licenses/{license_id}/renew", response_model=dict[str, LicenseResponse])
async def renew_license(
    license_id: str,
    data: LicenseRenewal,
    service: Annotated[LicensingService, Depends(get_licensing_service)],
) -> Any:
    """Renew a license."""
    try:
        license_obj = await service.renew_license(license_id, data)
        await service.session.commit()
        return {"data": LicenseResponse.model_validate(license_obj)}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        await service.session.rollback()
        logger.error("Failed to renew license", error=str(e))
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/licenses/{license_id}/suspend", response_model=dict[str, LicenseResponse])
async def suspend_license(
    license_id: str,
    data: dict[str, str],
    service: Annotated[LicensingService, Depends(get_licensing_service)],
) -> Any:
    """Suspend a license."""
    try:
        license_obj = await service.suspend_license(
            license_id, data.get("reason", "No reason provided")
        )
        await service.session.commit()
        return {"data": LicenseResponse.model_validate(license_obj)}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        await service.session.rollback()
        logger.error("Failed to suspend license", error=str(e))
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/licenses/{license_id}/revoke", response_model=dict[str, LicenseResponse])
async def revoke_license(
    license_id: str,
    data: dict[str, str],
    service: Annotated[LicensingService, Depends(get_licensing_service)],
) -> Any:
    """Revoke a license permanently."""
    try:
        license_obj = await service.revoke_license(
            license_id, data.get("reason", "No reason provided")
        )
        await service.session.commit()
        return {"data": LicenseResponse.model_validate(license_obj)}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        await service.session.rollback()
        logger.error("Failed to revoke license", error=str(e))
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/licenses/{license_id}/transfer", response_model=dict[str, LicenseResponse])
async def transfer_license(
    license_id: str,
    data: LicenseTransfer,
    service: Annotated[LicensingService, Depends(get_licensing_service)],
) -> Any:
    """Transfer a license to another customer."""
    try:
        license_obj = await service.transfer_license(license_id, data)
        await service.session.commit()
        return {"data": LicenseResponse.model_validate(license_obj)}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        await service.session.rollback()
        logger.error("Failed to transfer license", error=str(e))
        raise HTTPException(status_code=400, detail=str(e))


# ==================== Activation Management ====================


@router.post(
    "/activations",
    response_model=dict[str, ActivationResponse],
    status_code=status.HTTP_201_CREATED,
)
async def activate_license(
    data: ActivationCreate,
    service: Annotated[LicensingService, Depends(get_licensing_service)],
) -> Any:
    """Activate a license on a device."""
    try:
        activation = await service.activate_license(data)
        await service.session.commit()
        return {"data": ActivationResponse.model_validate(activation)}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        await service.session.rollback()
        logger.error("Failed to activate license", error=str(e))
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/activations", response_model=dict[str, Any])
async def get_activations(
    service: Annotated[LicensingService, Depends(get_licensing_service)],
    license_id: str | None = None,
    status_filter: str | None = Query(None, alias="status"),
    device_fingerprint: str | None = None,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
) -> Any:
    """Get paginated list of activations."""
    query = select(Activation).where(Activation.tenant_id == service.tenant_id)

    if license_id:
        query = query.where(Activation.license_id == license_id)
    if status_filter:
        query = query.where(Activation.status == status_filter)
    if device_fingerprint:
        query = query.where(Activation.device_fingerprint == device_fingerprint)

    # Apply pagination
    query = query.limit(limit).offset(offset)
    result = await service.session.execute(query)
    activations = result.scalars().all()

    return {
        "data": [ActivationResponse.model_validate(act) for act in activations],
        "total": len(activations),
        "limit": limit,
        "offset": offset,
    }


@router.get("/activations/{activation_id}", response_model=dict[str, ActivationResponse])
async def get_activation(
    activation_id: str,
    service: Annotated[LicensingService, Depends(get_licensing_service)],
) -> Any:
    """Get activation by ID."""
    result = await service.session.execute(
        select(Activation).where(
            Activation.id == activation_id,
            Activation.tenant_id == service.tenant_id,
        )
    )
    activation = result.scalar_one_or_none()

    if not activation:
        raise HTTPException(status_code=404, detail="Activation not found")

    return {"data": ActivationResponse.model_validate(activation)}


@router.post("/activations/validate", response_model=dict[str, ActivationValidationResponse])
async def validate_activation(
    data: ActivationValidation,
    service: Annotated[LicensingService, Depends(get_licensing_service)],
) -> Any:
    """Validate an activation token."""
    valid, activation, license_obj = await service.validate_activation(data.activation_token)

    response = ActivationValidationResponse(
        valid=valid,
        activation=ActivationResponse.model_validate(activation) if activation else None,
        license=LicenseResponse.model_validate(license_obj) if license_obj else None,
    )

    return {"data": response}


@router.post(
    "/activations/{activation_id}/deactivate", response_model=dict[str, ActivationResponse]
)
async def deactivate_license(
    activation_id: str,
    service: Annotated[LicensingService, Depends(get_licensing_service)],
    data: dict[str, str] | None = None,
) -> Any:
    """Deactivate a license activation."""
    try:
        reason = data.get("reason") if data else None
        activation = await service.deactivate_license(activation_id, reason)
        await service.session.commit()
        return {"data": ActivationResponse.model_validate(activation)}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        await service.session.rollback()
        logger.error("Failed to deactivate license", error=str(e))
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/activations/heartbeat", response_model=dict[str, dict[str, str]])
async def send_heartbeat(
    data: ActivationHeartbeat,
    service: Annotated[LicensingService, Depends(get_licensing_service)],
) -> Any:
    """Send activation heartbeat with usage metrics."""
    try:
        result = await service.update_heartbeat(data.activation_token, data.metrics)
        await service.session.commit()
        return {"data": result}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        await service.session.rollback()
        logger.error("Failed to update heartbeat", error=str(e))
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/activations/offline-request", response_model=dict[str, OfflineActivationResponse])
async def get_offline_activation_request(
    data: OfflineActivationRequest,
    service: Annotated[LicensingService, Depends(get_licensing_service)],
) -> Any:
    """Generate offline activation request code."""
    try:
        result = await service.generate_offline_activation_request(data)
        return {"data": OfflineActivationResponse(**result)}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error("Failed to generate offline request", error=str(e))
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/activations/offline-activate", response_model=dict[str, ActivationResponse])
async def process_offline_activation(
    data: OfflineActivationProcess,
    service: Annotated[LicensingService, Depends(get_licensing_service)],
) -> Any:
    """Process offline activation with response code."""
    try:
        activation = await service.process_offline_activation(data.request_code, data.response_code)
        await service.session.commit()
        return {"data": ActivationResponse.model_validate(activation)}
    except NotImplementedError:
        raise HTTPException(
            status_code=501,
            detail="Offline activation requires cryptographic implementation",
        )
    except Exception as e:
        await service.session.rollback()
        logger.error("Failed to process offline activation", error=str(e))
        raise HTTPException(status_code=400, detail=str(e))


# ==================== License Templates ====================


@router.get("/templates", response_model=dict[str, Any])
async def get_templates(
    service: Annotated[LicensingService, Depends(get_licensing_service)],
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
) -> Any:
    """Get paginated list of license templates."""
    query = select(LicenseTemplate).where(LicenseTemplate.tenant_id == service.tenant_id)
    query = query.limit(limit).offset(offset)
    result = await service.session.execute(query)
    templates = result.scalars().all()

    return {
        "data": [_serialize_template(tpl) for tpl in templates],
        "total": len(templates),
        "limit": limit,
        "offset": offset,
    }


@router.get("/templates/{template_id}", response_model=dict[str, LicenseTemplateResponse])
async def get_template(
    template_id: str,
    service: Annotated[LicensingService, Depends(get_licensing_service)],
) -> Any:
    """Get license template by ID."""
    result = await service.session.execute(
        select(LicenseTemplate).where(
            LicenseTemplate.id == template_id,
            LicenseTemplate.tenant_id == service.tenant_id,
        )
    )
    template = result.scalar_one_or_none()

    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    return {"data": _serialize_template(template)}


@router.post(
    "/templates",
    response_model=dict[str, LicenseTemplateResponse],
    status_code=status.HTTP_201_CREATED,
)
async def create_template(
    data: LicenseTemplateCreate,
    service: Annotated[LicensingService, Depends(get_licensing_service)],
) -> Any:
    """Create a new license template."""
    try:
        template = await service.create_template(data)
        await service.session.commit()
        return {"data": _serialize_template(template)}
    except Exception as e:
        await service.session.rollback()
        logger.error("Failed to create template", error=str(e))
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/templates/{template_id}", response_model=dict[str, LicenseTemplateResponse])
async def update_template(
    template_id: str,
    data: LicenseTemplateUpdate,
    service: Annotated[LicensingService, Depends(get_licensing_service)],
) -> Any:
    """Update a license template."""
    try:
        template = await service.update_template(template_id, data)
        await service.session.commit()
        return {"data": _serialize_template(template)}
    except ValueError as e:
        await service.session.rollback()
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        await service.session.rollback()
        logger.error("Failed to update template", error=str(e))
        raise HTTPException(status_code=400, detail=str(e))


# ==================== License Orders ====================


@router.get("/orders", response_model=dict[str, Any])
async def get_orders(
    service: Annotated[LicensingService, Depends(get_licensing_service)],
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
) -> Any:
    """Get paginated list of license orders."""
    query = select(LicenseOrder).where(LicenseOrder.tenant_id == service.tenant_id)
    query = query.limit(limit).offset(offset)
    result = await service.session.execute(query)
    orders = result.scalars().all()

    return {
        "data": [_serialize_order(order) for order in orders],
        "total": len(orders),
        "limit": limit,
        "offset": offset,
    }


@router.get("/orders/{order_id}", response_model=dict[str, LicenseOrderResponse])
async def get_order(
    order_id: str,
    service: Annotated[LicensingService, Depends(get_licensing_service)],
) -> Any:
    """Get license order by ID."""
    result = await service.session.execute(
        select(LicenseOrder).where(
            LicenseOrder.id == order_id,
            LicenseOrder.tenant_id == service.tenant_id,
        )
    )
    order = result.scalar_one_or_none()

    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    return {"data": _serialize_order(order)}


@router.post(
    "/orders", response_model=dict[str, LicenseOrderResponse], status_code=status.HTTP_201_CREATED
)
async def create_order(
    data: LicenseOrderCreate,
    service: Annotated[LicensingService, Depends(get_licensing_service)],
) -> Any:
    """Create a new license order."""
    try:
        order = await service.create_order(data)
        await service.session.commit()
        return {"data": LicenseOrderResponse.model_validate(order)}
    except ValueError as e:
        await service.session.rollback()
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        await service.session.rollback()
        logger.error("Failed to create order", error=str(e))
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/orders/{order_id}/approve", response_model=dict[str, LicenseOrderResponse])
async def approve_order(
    order_id: str,
    data: OrderApproval,
    service: Annotated[LicensingService, Depends(get_licensing_service)],
) -> Any:
    """Approve a license order."""
    try:
        order = await service.approve_order(order_id, data)
        await service.session.commit()
        return {"data": _serialize_order(order)}
    except ValueError as e:
        await service.session.rollback()
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        await service.session.rollback()
        logger.error("Failed to approve order", error=str(e))
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/orders/{order_id}/fulfill", response_model=dict[str, LicenseOrderResponse])
async def fulfill_order(
    order_id: str,
    service: Annotated[LicensingService, Depends(get_licensing_service)],
) -> Any:
    """Fulfill a license order (generate licenses)."""
    try:
        order = await service.fulfill_order(order_id)
        await service.session.commit()
        return {"data": _serialize_order(order)}
    except ValueError as e:
        await service.session.rollback()
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        await service.session.rollback()
        logger.error("Failed to fulfill order", error=str(e))
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/orders/{order_id}/cancel", response_model=dict[str, LicenseOrderResponse])
async def cancel_order(
    order_id: str,
    data: OrderCancellation,
    service: Annotated[LicensingService, Depends(get_licensing_service)],
) -> Any:
    """Cancel a license order."""
    try:
        order = await service.cancel_order(order_id, data)
        await service.session.commit()
        return {"data": _serialize_order(order)}
    except ValueError as e:
        await service.session.rollback()
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        await service.session.rollback()
        logger.error("Failed to cancel order", error=str(e))
        raise HTTPException(status_code=400, detail=str(e))


# ==================== Validation & Security ====================


@router.post("/validate", response_model=dict[str, LicenseValidationResponse])
async def validate_license_key(
    data: LicenseValidationRequest,
    service: Annotated[LicensingService, Depends(get_licensing_service)],
) -> Any:
    """Validate a license key."""
    license_obj = await service.get_license_by_key(data.license_key)

    if not license_obj:
        return {
            "data": LicenseValidationResponse(
                valid=False,
                license=None,
                validation_details={"error": "Invalid license key"},
            )
        }

    is_valid = license_obj.status == "ACTIVE"

    return {
        "data": LicenseValidationResponse(
            valid=is_valid,
            license=LicenseResponse.model_validate(license_obj) if is_valid else None,
            validation_details={"status": license_obj.status.value},
        )
    }


@router.post("/integrity-check", response_model=dict[str, IntegrityCheckResponse])
async def check_license_integrity(
    data: IntegrityCheckRequest,
    service: Annotated[LicensingService, Depends(get_licensing_service)],
) -> Any:
    """Check license integrity and tampering."""
    # Placeholder for cryptographic integrity check
    return {
        "data": IntegrityCheckResponse(
            integrity_check=True,
            tampering_detected=False,
        )
    }


@router.post("/emergency-code", response_model=dict[str, EmergencyCodeResponse])
async def generate_emergency_code(
    data: EmergencyCodeRequest,
    service: Annotated[LicensingService, Depends(get_licensing_service)],
) -> Any:
    """Generate emergency override code."""
    import secrets
    from datetime import datetime, timedelta

    emergency_code = secrets.token_hex(8).upper()
    valid_until = datetime.now(UTC) + timedelta(hours=24)

    return {
        "data": EmergencyCodeResponse(
            emergency_code=emergency_code,
            valid_until=valid_until,
        )
    }


@router.post("/security/blacklist-device", response_model=dict[str, dict[str, bool]])
async def blacklist_device(
    data: DeviceBlacklist,
    service: Annotated[LicensingService, Depends(get_licensing_service)],
) -> Any:
    """Blacklist a device from activating licenses."""
    # Placeholder for device blacklist implementation
    return {"data": {"success": True}}


@router.post("/security/report-activity", response_model=dict[str, SuspiciousActivityResponse])
async def report_suspicious_activity(
    data: SuspiciousActivityReport,
    service: Annotated[LicensingService, Depends(get_licensing_service)],
) -> Any:
    """Report suspicious licensing activity."""
    from uuid import uuid4

    incident_id = str(uuid4())

    # Log suspicious activity
    logger.warn(
        "Suspicious activity reported",
        incident_id=incident_id,
        activity_type=data.activity_type,
        license_key=data.license_key,
        tenant_id=service.tenant_id,
    )

    return {"data": SuspiciousActivityResponse(incident_id=incident_id)}
