"""
Pricing engine API router.

Provides REST endpoints for managing pricing rules and calculating prices.
"""

from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, Body, Depends, HTTPException, Query, status
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.auth.core import UserInfo
from dotmac.platform.auth.dependencies import get_current_user
from dotmac.platform.db import get_async_session
from dotmac.platform.tenant import get_current_tenant_id

from .models import (
    PriceCalculationRequest,
    PriceCalculationResult,
    PricingRuleCreateRequest,
    PricingRuleResponse,
    PricingRuleUpdateRequest,
)
from .service import PricingEngine as PricingService

router = APIRouter(prefix="/billing/pricing", tags=["Billing - Pricing"])


# Pricing Rules Management


@router.post(
    "/rules",
    response_model=PricingRuleResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_pricing_rule(
    rule_data: PricingRuleCreateRequest,
    current_user: UserInfo = Depends(get_current_user),
    tenant_id: str = Depends(get_current_tenant_id),
    db_session: AsyncSession = Depends(get_async_session),
) -> PricingRuleResponse:
    """Create a new pricing rule."""
    service = PricingService(db_session)
    try:
        rule = await service.create_pricing_rule(rule_data, tenant_id)
        rule_response: PricingRuleResponse = PricingRuleResponse.model_validate(rule.model_dump())
        return rule_response
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/rules", response_model=list[PricingRuleResponse])
async def list_pricing_rules(
    current_user: UserInfo = Depends(get_current_user),
    tenant_id: str = Depends(get_current_tenant_id),
    db_session: AsyncSession = Depends(get_async_session),
    product_id: str | None = Query(None, description="Filter by product ID"),
    active_only: bool = Query(True, description="Show only active rules"),
    category: str | None = Query(None, description="Filter by product category"),
) -> list[PricingRuleResponse]:
    """List pricing rules."""
    service = PricingService(db_session)
    rules = await service.list_pricing_rules(
        tenant_id,
        product_id=product_id,
        active_only=active_only,
        category=category,
    )
    return [PricingRuleResponse.model_validate(rule.model_dump()) for rule in rules]


@router.get("/rules/{rule_id}", response_model=PricingRuleResponse)
async def get_pricing_rule(
    rule_id: str,
    current_user: UserInfo = Depends(get_current_user),
    tenant_id: str = Depends(get_current_tenant_id),
    db_session: AsyncSession = Depends(get_async_session),
) -> PricingRuleResponse:
    """Get a specific pricing rule."""
    service = PricingService(db_session)
    rule = await service.get_pricing_rule(rule_id, tenant_id)
    if not rule:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pricing rule not found")
    rule_response: PricingRuleResponse = PricingRuleResponse.model_validate(rule.model_dump())
    return rule_response


@router.patch("/rules/{rule_id}", response_model=PricingRuleResponse)
async def update_pricing_rule(
    rule_id: str,
    rule_data: PricingRuleUpdateRequest,
    current_user: UserInfo = Depends(get_current_user),
    tenant_id: str = Depends(get_current_tenant_id),
    db_session: AsyncSession = Depends(get_async_session),
) -> PricingRuleResponse:
    """Update a pricing rule."""
    service = PricingService(db_session)
    try:
        rule = await service.update_pricing_rule(rule_id, rule_data, tenant_id)
        if not rule:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Pricing rule not found"
            )
        rule_response: PricingRuleResponse = PricingRuleResponse.model_validate(rule.model_dump())
        return rule_response
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/rules/{rule_id}")
async def delete_pricing_rule(
    rule_id: str,
    current_user: UserInfo = Depends(get_current_user),
    tenant_id: str = Depends(get_current_tenant_id),
    db_session: AsyncSession = Depends(get_async_session),
) -> JSONResponse:
    """Delete a pricing rule (deactivates it)."""
    service = PricingService(db_session)
    success = await service.deactivate_rule(rule_id, tenant_id)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pricing rule not found")
    return JSONResponse(
        content={"message": "Pricing rule deleted successfully"}, status_code=status.HTTP_200_OK
    )


@router.post("/rules/{rule_id}/activate")
async def activate_pricing_rule(
    rule_id: str,
    current_user: UserInfo = Depends(get_current_user),
    tenant_id: str = Depends(get_current_tenant_id),
    db_session: AsyncSession = Depends(get_async_session),
) -> JSONResponse:
    """Activate a pricing rule."""
    service = PricingService(db_session)
    success = await service.activate_rule(rule_id, tenant_id)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pricing rule not found")
    return JSONResponse(
        content={"message": "Pricing rule activated successfully"}, status_code=status.HTTP_200_OK
    )


@router.post("/rules/{rule_id}/deactivate")
async def deactivate_pricing_rule(
    rule_id: str,
    current_user: UserInfo = Depends(get_current_user),
    tenant_id: str = Depends(get_current_tenant_id),
    db_session: AsyncSession = Depends(get_async_session),
) -> JSONResponse:
    """Deactivate a pricing rule."""
    service = PricingService(db_session)
    success = await service.deactivate_rule(rule_id, tenant_id)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pricing rule not found")
    return JSONResponse(
        content={"message": "Pricing rule deactivated successfully"}, status_code=status.HTTP_200_OK
    )


# Price Calculation


@router.post("/calculate", response_model=PriceCalculationResult)
async def calculate_price(
    calculation_request: PriceCalculationRequest,
    current_user: UserInfo = Depends(get_current_user),
    tenant_id: str = Depends(get_current_tenant_id),
    db_session: AsyncSession = Depends(get_async_session),
) -> PriceCalculationResult:
    """Calculate price for a product with applicable discounts."""
    service = PricingService(db_session)
    try:
        result: PriceCalculationResult = await service.calculate_price(
            calculation_request, tenant_id
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/calculate/{product_id}")
async def calculate_price_simple(
    product_id: str,
    customer_id: str = Query(..., description="Customer ID for pricing"),
    quantity: int = Query(1, description="Quantity", ge=1),
    customer_segments: list[str] = Query([], description="Customer segments for rule matching"),
    current_user: UserInfo = Depends(get_current_user),
    tenant_id: str = Depends(get_current_tenant_id),
    db_session: AsyncSession = Depends(get_async_session),
) -> PriceCalculationResult:
    """Calculate price using query parameters (alternative endpoint)."""
    service = PricingService(db_session)
    try:
        request = PriceCalculationRequest(
            product_id=product_id,
            customer_id=customer_id,
            quantity=quantity,
            customer_segments=customer_segments,
            calculation_date=datetime.now(UTC),
        )
        result: PriceCalculationResult = await service.calculate_price(request, tenant_id)
        return result
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


# Rule Analytics and Statistics


@router.get("/rules/{rule_id}/usage")
async def get_pricing_rule_usage(
    rule_id: str,
    current_user: UserInfo = Depends(get_current_user),
    tenant_id: str = Depends(get_current_tenant_id),
    db_session: AsyncSession = Depends(get_async_session),
) -> dict[str, Any]:
    """Get usage statistics for a pricing rule."""
    service = PricingService(db_session)
    try:
        usage_stats = await service.get_rule_usage_stats(rule_id, tenant_id)
        if not usage_stats:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Pricing rule not found"
            )
        return usage_stats
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/rules/{rule_id}/reset-usage")
async def reset_pricing_rule_usage(
    rule_id: str,
    current_user: UserInfo = Depends(get_current_user),
    tenant_id: str = Depends(get_current_tenant_id),
    db_session: AsyncSession = Depends(get_async_session),
) -> JSONResponse:
    """Reset usage counter for a pricing rule."""
    service = PricingService(db_session)
    success = await service.reset_rule_usage(rule_id, tenant_id)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pricing rule not found")
    return JSONResponse(
        content={"message": "Rule usage counter reset successfully"}, status_code=status.HTTP_200_OK
    )


# Rule Testing and Validation


@router.post("/rules/test")
async def test_pricing_rules(
    test_request: PriceCalculationRequest,
    current_user: UserInfo = Depends(get_current_user),
    tenant_id: str = Depends(get_current_tenant_id),
    db_session: AsyncSession = Depends(get_async_session),
) -> dict[str, Any]:
    """Test which pricing rules would apply for given conditions."""
    service = PricingService(db_session)
    try:
        applicable_rules = await service.get_applicable_rules(test_request, tenant_id)
        return {
            "product_id": test_request.product_id,
            "quantity": test_request.quantity,
            "customer_id": test_request.customer_id,
            "customer_segments": test_request.customer_segments,
            "applicable_rules": [
                {
                    "rule_id": rule.rule_id,
                    "name": rule.name,
                    "discount_type": rule.discount_type,
                    "discount_value": str(rule.discount_value),
                    "priority": rule.priority,
                }
                for rule in applicable_rules
            ],
        }
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/rules/conflicts")
async def detect_rule_conflicts(
    current_user: UserInfo = Depends(get_current_user),
    tenant_id: str = Depends(get_current_tenant_id),
    db_session: AsyncSession = Depends(get_async_session),
) -> dict[str, Any]:
    """Detect potential conflicts between pricing rules."""
    service = PricingService(db_session)
    try:
        conflicts = await service.detect_rule_conflicts(tenant_id)
        return {
            "conflicts_found": len(conflicts) > 0,
            "total_conflicts": len(conflicts),
            "conflicts": conflicts,
        }
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


# Bulk Operations


@router.post("/rules/bulk-activate")
async def bulk_activate_rules(
    rule_ids: list[str] = Body(...),
    current_user: UserInfo = Depends(get_current_user),
    tenant_id: str = Depends(get_current_tenant_id),
    db_session: AsyncSession = Depends(get_async_session),
) -> dict[str, Any]:
    """Activate multiple pricing rules at once."""
    service = PricingService(db_session)
    try:
        results = await service.bulk_activate_rules(rule_ids, tenant_id)
        return {
            "total_rules": len(rule_ids),
            "activated": results["activated"],
            "failed": results["failed"],
            "errors": results.get("errors", []),
        }
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/rules/bulk-deactivate")
async def bulk_deactivate_rules(
    rule_ids: list[str] = Body(...),
    current_user: UserInfo = Depends(get_current_user),
    tenant_id: str = Depends(get_current_tenant_id),
    db_session: AsyncSession = Depends(get_async_session),
) -> dict[str, Any]:
    """Deactivate multiple pricing rules at once."""
    service = PricingService(db_session)
    try:
        results = await service.bulk_deactivate_rules(rule_ids, tenant_id)
        return {
            "total_rules": len(rule_ids),
            "deactivated": results["deactivated"],
            "failed": results["failed"],
            "errors": results.get("errors", []),
        }
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
