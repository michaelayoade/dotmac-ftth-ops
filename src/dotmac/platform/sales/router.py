"""
Sales Order API Router

Public and internal APIs for order processing and service activation.
"""
# mypy: disable-error-code="arg-type"

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from ..auth.core import UserInfo
from ..auth.rbac_dependencies import require_permissions
from ..communications.email_service import EmailService
from ..db import get_db
from ..dependencies import (
    get_deployment_service,
    get_email_service,
    get_event_bus,
    get_notification_service,
    get_tenant_service,
)
from ..deployment.service import DeploymentService
from ..events.bus import EventBus
from ..notifications.service import NotificationService
from ..tenant.service import TenantService
from .models import OrderStatus
from .schemas import (
    ActivationProgress,
    OrderCreate,
    OrderResponse,
    OrderStatusResponse,
    OrderStatusUpdate,
    OrderSubmit,
    QuickOrderRequest,
    ServiceActivationResponse,
)
from .service import ActivationOrchestrator, OrderProcessingService

# Public router (no authentication required)
public_router = APIRouter(
    prefix="/api/public/orders",
)

# Internal router (authentication required)
router = APIRouter(
    prefix="/orders",
)


def get_order_service(
    db: Session = Depends(get_db),
    tenant_service: TenantService = Depends(get_tenant_service),
    deployment_service: DeploymentService = Depends(get_deployment_service),
    notification_service: NotificationService = Depends(get_notification_service),
    email_service: EmailService = Depends(get_email_service),
    event_bus: EventBus = Depends(get_event_bus),
) -> OrderProcessingService:
    """Get order processing service instance"""
    return OrderProcessingService(
        db=db,
        tenant_service=tenant_service,
        deployment_service=deployment_service,
        notification_service=notification_service,
        email_service=email_service,
        event_bus=event_bus,
    )


def get_activation_orchestrator(
    db: Session = Depends(get_db),
    notification_service: NotificationService = Depends(get_notification_service),
    event_bus: EventBus = Depends(get_event_bus),
) -> ActivationOrchestrator:
    """Get activation orchestrator instance"""
    return ActivationOrchestrator(
        db=db,
        notification_service=notification_service,
        event_bus=event_bus,
    )


# ============================================================================
# Public API Endpoints
# ============================================================================


@public_router.post("", response_model=OrderResponse, status_code=status.HTTP_201_CREATED)
def create_public_order(
    request: OrderCreate,
    service: OrderProcessingService = Depends(get_order_service),
) -> OrderResponse:
    """
    Create new order (Public API)

    This endpoint allows customers to place orders for platform services
    without authentication. The order will be created in DRAFT state.

    **Usage**:
    - Select deployment template or let system auto-select based on region
    - Specify services to activate
    - Provide customer and billing information
    - Submit payment separately and reference order number

    **Next Steps**:
    - Complete payment
    - Call `/orders/{order_number}/submit` to begin provisioning
    """
    order = service.create_order(request)
    return OrderResponse.model_validate(order)


@public_router.post("/quick", response_model=OrderResponse, status_code=status.HTTP_201_CREATED)
def create_quick_order(
    request: QuickOrderRequest,
    service: OrderProcessingService = Depends(get_order_service),
) -> OrderResponse:
    """
    Create quick order from pre-configured package (Public API)

    Simplified order creation for common service packages:
    - **starter**: Basic ISP operations (subscriber management, billing)
    - **professional**: Enhanced with RADIUS, network monitoring
    - **enterprise**: Full platform with analytics, automation, multi-site

    **Example**:
    ```json
    {
      "email": "admin@example.com",
      "name": "John Doe",
      "company": "Example ISP",
      "package_code": "professional",
      "billing_cycle": "monthly",
      "region": "us-east-1"
    }
    ```
    """
    # Map quick order to full order request
    from .schemas import ServiceSelection

    # Package service mappings
    package_services = {
        "starter": [
            ServiceSelection(
                service_code="subscriber-provisioning", name="Subscriber Management", quantity=1
            ),
            ServiceSelection(
                service_code="billing-invoicing", name="Billing & Invoicing", quantity=1
            ),
        ],
        "professional": [
            ServiceSelection(
                service_code="subscriber-provisioning", name="Subscriber Management", quantity=1
            ),
            ServiceSelection(
                service_code="billing-invoicing", name="Billing & Invoicing", quantity=1
            ),
            ServiceSelection(service_code="radius-aaa", name="RADIUS AAA", quantity=1),
            ServiceSelection(
                service_code="network-monitoring", name="Network Monitoring", quantity=1
            ),
        ],
        "enterprise": [
            ServiceSelection(
                service_code="subscriber-provisioning", name="Subscriber Management", quantity=1
            ),
            ServiceSelection(
                service_code="billing-invoicing", name="Billing & Invoicing", quantity=1
            ),
            ServiceSelection(service_code="radius-aaa", name="RADIUS AAA", quantity=1),
            ServiceSelection(
                service_code="network-monitoring", name="Network Monitoring", quantity=1
            ),
            ServiceSelection(
                service_code="analytics-reporting", name="Analytics & Reporting", quantity=1
            ),
            ServiceSelection(
                service_code="automation-workflows", name="Automation Workflows", quantity=1
            ),
        ],
    }

    base_services = package_services.get(request.package_code, package_services["starter"])
    services = list(base_services)

    # Add any additional services
    if request.additional_services:
        for service_code in request.additional_services:
            services.append(
                ServiceSelection(
                    service_code=service_code,
                    name=service_code.replace("-", " ").title(),
                    quantity=1,
                )
            )

    order_request = OrderCreate(
        customer_email=request.email,
        customer_name=request.name,
        customer_phone=request.phone,
        company_name=request.company,
        organization_slug=request.organization_slug,
        deployment_region=request.region,
        selected_services=services,
        billing_cycle=request.billing_cycle,
        source="public_api",
        utm_source=request.utm_source,
        utm_campaign=request.utm_campaign,
        service_configuration={
            "package": request.package_code,
            "user_count": request.user_count,
        },
    )

    order = service.create_order(order_request)
    return OrderResponse.model_validate(order)


@public_router.get("/{order_number}/status", response_model=OrderStatusResponse)
def get_public_order_status(
    order_number: str,
    service: OrderProcessingService = Depends(get_order_service),
) -> OrderStatusResponse:
    """
    Get order status by order number (Public API)

    Check the processing status of your order. Use this endpoint to:
    - Monitor provisioning progress
    - Get activation URL when ready
    - Estimate completion time

    **Order Status Flow**:
    1. `draft` - Order created, awaiting submission
    2. `submitted` - Order received, payment pending
    3. `validating` - Validating order details
    4. `approved` - Payment approved, ready to provision
    5. `provisioning` - Creating tenant infrastructure
    6. `activating` - Activating services
    7. `active` - Complete! Services ready to use
    """
    order = service.get_order_by_number(order_number)
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=f"Order {order_number} not found"
        )

    # Calculate progress
    progress_percent = 0
    status_map = {
        OrderStatus.DRAFT: 0,
        OrderStatus.SUBMITTED: 10,
        OrderStatus.VALIDATING: 20,
        OrderStatus.APPROVED: 30,
        OrderStatus.PROVISIONING: 50,
        OrderStatus.ACTIVATING: 75,
        OrderStatus.ACTIVE: 100,
        OrderStatus.FAILED: 0,
        OrderStatus.CANCELLED: 0,
    }
    progress_percent = status_map.get(order.status, 0)

    # Build activation URL if ready
    activation_url = None
    if order.status == OrderStatus.ACTIVE and order.organization_slug:
        activation_url = f"https://{order.organization_slug}.dotmac.io"

    return OrderStatusResponse(
        order_number=order.order_number,
        status=order.status,
        status_message=order.status_message,
        progress_percent=progress_percent,
        tenant_subdomain=order.organization_slug,
        activation_url=activation_url,
        estimated_completion=None,  # Could calculate based on historical data
        created_at=order.created_at,
    )


# ============================================================================
# Internal API Endpoints (Authenticated)
# ============================================================================


@router.get("", response_model=list[OrderResponse])
def list_orders(
    status_filter: OrderStatus | None = Query(
        None, alias="status", description="Filter by status"
    ),
    customer_email: str | None = Query(None, description="Filter by customer email"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    current_user: UserInfo = Depends(require_permissions("order.read")),
    service: OrderProcessingService = Depends(get_order_service),
) -> list[OrderResponse]:
    """
    List orders (Internal API)

    Query and filter orders. Requires `order.read` permission.
    """
    try:
        orders = service.list_orders(
            status=status_filter,
            customer_email=customer_email,
            skip=skip,
            limit=limit,
            tenant_id=current_user.tenant_id,
            is_platform_admin=current_user.is_platform_admin,
            enforce_scope=True,
        )
    except PermissionError as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(exc),
        ) from exc
    return [OrderResponse.model_validate(o) for o in orders]


@router.get("/{order_id}", response_model=OrderResponse)
def get_order(
    order_id: int,
    current_user: UserInfo = Depends(require_permissions("order.read")),
    service: OrderProcessingService = Depends(get_order_service),
) -> OrderResponse:
    """Get order by ID (Internal API)"""
    try:
        order = service.get_order(
            order_id,
            tenant_id=current_user.tenant_id,
            is_platform_admin=current_user.is_platform_admin,
            enforce_scope=True,
        )
    except PermissionError as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(exc),
        ) from exc
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=f"Order {order_id} not found"
        )

    return OrderResponse.model_validate(order)


@router.post("/{order_id}/submit", response_model=OrderResponse)
async def submit_order(
    order_id: int,
    submit_request: OrderSubmit,
    current_user: UserInfo = Depends(require_permissions("order.submit")),
    service: OrderProcessingService = Depends(get_order_service),
) -> OrderResponse:
    """
    Submit order for processing (Internal API)

    Transitions order from DRAFT to SUBMITTED and triggers the provisioning
    workflow if `auto_activate` is True.

    Requires `order.submit` permission.
    """
    try:
        order = await service.submit_order(
            order_id=order_id,
            submit_request=submit_request,
            user_id=current_user.user_id,
            tenant_id=current_user.tenant_id,
            is_platform_admin=current_user.is_platform_admin,
            enforce_scope=True,
        )
    except PermissionError as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(exc),
        ) from exc
    return OrderResponse.model_validate(order)


@router.post("/{order_id}/process", response_model=OrderResponse)
async def process_order(
    order_id: int,
    current_user: UserInfo = Depends(require_permissions("order.process")),
    service: OrderProcessingService = Depends(get_order_service),
) -> OrderResponse:
    """
    Manually process order (Internal API)

    Triggers the complete provisioning workflow:
    1. Validate order
    2. Create tenant
    3. Provision deployment
    4. Activate services
    5. Send notifications

    Requires `order.process` permission.
    """
    try:
        order = await service.process_order(
            order_id=order_id,
            user_id=current_user.user_id,
            tenant_id=current_user.tenant_id,
            is_platform_admin=current_user.is_platform_admin,
            enforce_scope=True,
        )
    except PermissionError as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(exc),
        ) from exc
    return OrderResponse.model_validate(order)


@router.patch("/{order_id}/status", response_model=OrderResponse)
def update_order_status(
    order_id: int,
    status_update: OrderStatusUpdate,
    current_user: UserInfo = Depends(require_permissions("order.update")),
    service: OrderProcessingService = Depends(get_order_service),
) -> OrderResponse:
    """
    Update order status (Internal API)

    Manually update order status. Use with caution.

    Requires `order.update` permission.
    """
    try:
        order = service.update_order_status(
            order_id=order_id,
            status=status_update.status,
            status_message=status_update.status_message,
            tenant_id=current_user.tenant_id,
            is_platform_admin=current_user.is_platform_admin,
            enforce_scope=True,
        )
        return OrderResponse.model_validate(order)
    except PermissionError as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(exc),
        ) from exc
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.delete("/{order_id}")
def cancel_order(
    order_id: int,
    current_user: UserInfo = Depends(require_permissions("order.delete")),
    service: OrderProcessingService = Depends(get_order_service),
) -> dict[str, Any]:
    """
    Cancel order (Internal API)

    Cancels an order. Only allowed for orders in DRAFT or SUBMITTED state.

    Requires `order.delete` permission.
    """
    try:
        order = service.cancel_order(
            order_id,
            tenant_id=current_user.tenant_id,
            is_platform_admin=current_user.is_platform_admin,
            enforce_scope=True,
        )
        return {"success": True, "message": f"Order {order.order_number} cancelled"}
    except PermissionError as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(exc),
        ) from exc
    except ValueError as e:
        error_msg = str(e)
        if "not found" in error_msg:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=error_msg)
        else:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error_msg)


# ============================================================================
# Service Activation Endpoints
# ============================================================================


@router.get("/{order_id}/activations", response_model=list[ServiceActivationResponse])
def list_order_activations(
    order_id: int,
    current_user: UserInfo = Depends(require_permissions("order.read")),
    order_service: OrderProcessingService = Depends(get_order_service),
    orchestrator: ActivationOrchestrator = Depends(get_activation_orchestrator),
) -> list[ServiceActivationResponse]:
    """
    List service activations for order (Internal API)

    Returns all service activation records for the order, showing the
    status of each service activation.
    """
    # Verify order exists
    try:
        order = order_service.get_order(
            order_id,
            tenant_id=current_user.tenant_id,
            is_platform_admin=current_user.is_platform_admin,
            enforce_scope=True,
        )
    except PermissionError as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(exc),
        ) from exc
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=f"Order {order_id} not found"
        )

    activations = orchestrator.get_service_activations(order_id)
    return [ServiceActivationResponse.model_validate(a) for a in activations]


@router.get("/{order_id}/activations/progress", response_model=ActivationProgress)
def get_activation_progress(
    order_id: int,
    current_user: UserInfo = Depends(require_permissions("order.read")),
    order_service: OrderProcessingService = Depends(get_order_service),
    orchestrator: ActivationOrchestrator = Depends(get_activation_orchestrator),
) -> ActivationProgress:
    """
    Get activation progress for order (Internal API)

    Returns aggregated progress information showing how many services
    have been activated, are in progress, or failed.
    """
    # Verify order exists
    try:
        order = order_service.get_order(
            order_id,
            tenant_id=current_user.tenant_id,
            is_platform_admin=current_user.is_platform_admin,
            enforce_scope=True,
        )
    except PermissionError as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(exc),
        ) from exc
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=f"Order {order_id} not found"
        )

    progress_data = orchestrator.get_activation_progress(order_id)

    return ActivationProgress(
        order_id=order.id,
        order_number=order.order_number,
        total_services=progress_data["total_services"],
        completed=progress_data["completed"],
        failed=progress_data["failed"],
        in_progress=progress_data["in_progress"],
        pending=progress_data["pending"],
        overall_status=progress_data["overall_status"],
        progress_percent=progress_data["progress_percent"],
        activations=[
            ServiceActivationResponse.model_validate(a) for a in progress_data["activations"]
        ],
    )


@router.post("/{order_id}/activations/retry")
def retry_failed_activations(
    order_id: int,
    current_user: UserInfo = Depends(require_permissions("order.process")),
    order_service: OrderProcessingService = Depends(get_order_service),
    orchestrator: ActivationOrchestrator = Depends(get_activation_orchestrator),
) -> dict[str, Any]:
    """
    Retry failed service activations (Internal API)

    Retries any failed service activations for the order.

    Requires `order.process` permission.
    """
    # Verify order exists
    try:
        order = order_service.get_order(
            order_id,
            tenant_id=current_user.tenant_id,
            is_platform_admin=current_user.is_platform_admin,
            enforce_scope=True,
        )
    except PermissionError as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(exc),
        ) from exc
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=f"Order {order_id} not found"
        )

    return orchestrator.retry_failed_activations(order_id)


# ============================================================================
# Statistics Endpoints
# ============================================================================


@router.get("/stats/summary")
def get_order_statistics(
    current_user: UserInfo = Depends(require_permissions("order.read")),
    service: OrderProcessingService = Depends(get_order_service),
) -> dict[str, Any]:
    """
    Get order statistics (Internal API)

    Returns aggregated statistics about orders:
    - Total orders by status
    - Revenue totals
    - Average processing time
    - Success rate
    """
    try:
        return service.get_order_statistics(
            tenant_id=current_user.tenant_id,
            is_platform_admin=current_user.is_platform_admin,
            enforce_scope=True,
        )
    except PermissionError as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(exc),
        ) from exc
