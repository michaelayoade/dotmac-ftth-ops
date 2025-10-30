"""
Product catalog API router.

Provides REST endpoints for managing products and categories.
"""

import inspect
import string
from uuid import UUID

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import JSONResponse, Response
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform import tenant as tenant_ctx
from dotmac.platform.auth import dependencies as auth_dependencies
from dotmac.platform.auth.core import (
    HTTPAuthorizationCredentials,
    UserInfo,
    api_key_header,
    bearer_scheme,
    oauth2_scheme,
)
from dotmac.platform.auth.rbac_dependencies import (
    require_permission,
)
from dotmac.platform.billing.catalog.models import (
    ProductCategoryCreateRequest,
    ProductCategoryResponse,
    ProductCreateRequest,
    ProductFilters,
    ProductPriceUpdateRequest,
    ProductResponse,
    ProductType,
    ProductUpdateRequest,
    UsageType,
)
from dotmac.platform.billing.catalog.service import ProductService
from dotmac.platform.billing.exceptions import (
    CategoryNotFoundError,
    ProductError,
    ProductNotFoundError,
)
from dotmac.platform.db import get_async_session

logger = structlog.get_logger(__name__)


async def _get_current_user_dependency(
    request: Request,
    token: str | None = Depends(oauth2_scheme),
    api_key: str | None = Depends(api_key_header),
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> UserInfo:
    """Resolve current user while respecting runtime overrides and patches."""

    # FastAPI supports overriding dependencies via app.dependency_overrides.
    # Honor those overrides first to keep tests simple.
    override = request.app.dependency_overrides.get(auth_dependencies.get_current_user)
    if override is not None:
        value = override(request)
        if inspect.isawaitable(value):
            value = await value
        return value

    dependency = auth_dependencies.get_current_user
    return await dependency(
        request=request,
        token=token,
        api_key=api_key,
        credentials=credentials,
    )


async def _get_current_tenant_dependency(request: Request) -> str:
    """Resolve tenant from context while allowing runtime overrides."""

    override = request.app.dependency_overrides.get(tenant_ctx.get_current_tenant_id)
    if override is not None:
        tenant_id = override()
        if inspect.isawaitable(tenant_id):
            tenant_id = await tenant_id
    else:
        # Access attribute dynamically so that monkeypatching works.
        tenant_id = tenant_ctx.get_current_tenant_id()

    if tenant_id:
        return tenant_id

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Tenant context missing",
    )


def _validate_product_identifier(product_id: str) -> None:
    """Validate product identifier format (generated prod_ IDs or UUID strings)."""

    if product_id.startswith("prod_"):
        suffix = product_id[5:]
        if len(suffix) == 12 and all(ch in string.hexdigits for ch in suffix):
            return
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Invalid product_id format",
        )

    try:
        UUID(product_id)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Invalid product_id format",
        ) from exc


router = APIRouter(
    tags=["Billing - Catalog"],
    dependencies=[Depends(_get_current_user_dependency)],  # All endpoints require authentication
)


@router.post(
    "/categories",
    response_model=ProductCategoryResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission("billing:catalog:write"))],
)
async def create_product_category(
    category_data: ProductCategoryCreateRequest,
    tenant_id: str = Depends(_get_current_tenant_dependency),
    db_session: AsyncSession = Depends(get_async_session),
    current_user: UserInfo = Depends(_get_current_user_dependency),
) -> ProductCategoryResponse:
    """
    Create a new product category.

    Requires authentication and billing:catalog:write permission.
    Categories are tenant-isolated.
    """

    service = ProductService(db_session)

    try:
        category = await service.create_category(category_data, tenant_id)

        logger.info(
            "Product category created",
            category_id=category.category_id,
            name=category.name,
            user_id=current_user.user_id,
            tenant_id=tenant_id,
        )

        return ProductCategoryResponse(
            category_id=category.category_id,
            tenant_id=category.tenant_id,
            name=category.name,
            description=category.description,
            default_tax_class=category.default_tax_class,
            sort_order=category.sort_order,
            created_at=category.created_at,
            updated_at=category.updated_at,
        )

    except ProductError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/categories", response_model=list[ProductCategoryResponse])
async def list_product_categories(
    tenant_id: str = Depends(_get_current_tenant_dependency),
    db_session: AsyncSession = Depends(get_async_session),
) -> list[ProductCategoryResponse]:
    """
    List all product categories for the current tenant.

    Categories are returned sorted by sort_order, then by name.
    """

    service = ProductService(db_session)
    categories = await service.list_categories(tenant_id)

    return [
        ProductCategoryResponse(
            category_id=cat.category_id,
            tenant_id=cat.tenant_id,
            name=cat.name,
            description=cat.description,
            default_tax_class=cat.default_tax_class,
            sort_order=cat.sort_order,
            created_at=cat.created_at,
            updated_at=cat.updated_at,
        )
        for cat in categories
    ]


@router.get("/categories/{category_id}", response_model=ProductCategoryResponse)
async def get_product_category(
    category_id: str,
    tenant_id: str = Depends(_get_current_tenant_dependency),
    db_session: AsyncSession = Depends(get_async_session),
) -> ProductCategoryResponse:
    """Get a specific product category by ID."""

    service = ProductService(db_session)

    try:
        category = await service.get_category(category_id, tenant_id)

        return ProductCategoryResponse(
            category_id=category.category_id,
            tenant_id=category.tenant_id,
            name=category.name,
            description=category.description,
            default_tax_class=category.default_tax_class,
            sort_order=category.sort_order,
            created_at=category.created_at,
            updated_at=category.updated_at,
        )

    except CategoryNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.post(
    "/products",
    response_model=ProductResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission("billing:catalog:write"))],
)
async def create_product(
    product_data: ProductCreateRequest,
    tenant_id: str = Depends(_get_current_tenant_dependency),
    db_session: AsyncSession = Depends(get_async_session),
    current_user: UserInfo = Depends(_get_current_user_dependency),
) -> ProductResponse:
    """
    Create a new product.

    Requires authentication and billing:catalog:write permission.
    SKUs must be unique within the tenant. Usage-based products require usage_type.
    """

    service = ProductService(db_session)

    try:
        product = await service.create_product(product_data, tenant_id)

        logger.info(
            "Product created",
            product_id=product.product_id,
            sku=product.sku,
            name=product.name,
            product_type=product.product_type.value,
            user_id=current_user.user_id,
            tenant_id=tenant_id,
        )

        return ProductResponse(
            product_id=product.product_id,
            tenant_id=product.tenant_id,
            sku=product.sku,
            name=product.name,
            description=product.description,
            category=product.category,
            product_type=product.product_type,
            base_price=product.base_price,
            currency=product.currency,
            tax_class=product.tax_class,
            usage_type=product.usage_type,
            usage_unit_name=product.usage_unit_name,
            is_active=product.is_active,
            metadata=product.metadata,
            created_at=product.created_at,
            updated_at=product.updated_at,
        )

    except ProductError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/products", response_model=list[ProductResponse])
async def list_products(
    category: str | None = Query(None, description="Filter by category"),
    product_type: ProductType | None = Query(None, description="Filter by product type"),
    usage_type: UsageType | None = Query(None, description="Filter by usage type"),
    is_active: bool = Query(True, description="Filter by active status"),
    search: str | None = Query(None, description="Search in name, description, or SKU"),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(50, ge=1, le=100, description="Items per page"),
    tenant_id: str = Depends(_get_current_tenant_dependency),
    db_session: AsyncSession = Depends(get_async_session),
) -> list[ProductResponse]:
    """
    List products with filtering and pagination.

    Supports filtering by category, product type, usage type, and active status.
    Also supports text search across name, description, and SKU.
    """

    service = ProductService(db_session)

    filters = ProductFilters(
        category=category,
        product_type=product_type,
        usage_type=usage_type,
        is_active=is_active,
        search=search,
    )

    products = await service.list_products(tenant_id, filters=filters, page=page, limit=limit)

    return [
        ProductResponse(
            product_id=product.product_id,
            tenant_id=product.tenant_id,
            sku=product.sku,
            name=product.name,
            description=product.description,
            category=product.category,
            product_type=product.product_type,
            base_price=product.base_price,
            currency=product.currency,
            tax_class=product.tax_class,
            usage_type=product.usage_type,
            usage_unit_name=product.usage_unit_name,
            is_active=product.is_active,
            metadata=product.metadata,
            created_at=product.created_at,
            updated_at=product.updated_at,
        )
        for product in products
    ]


@router.get("/products/usage-based", response_model=list[ProductResponse])
async def list_usage_products(
    tenant_id: str = Depends(_get_current_tenant_dependency),
    db_session: AsyncSession = Depends(get_async_session),
) -> list[ProductResponse]:
    """
    Get products configured for usage-based billing.

    Returns products with product_type 'usage_based' or 'hybrid'.
    Useful for usage tracking and billing integrations.
    """

    service = ProductService(db_session)
    products = await service.get_usage_products(tenant_id)

    return [
        ProductResponse(
            product_id=product.product_id,
            tenant_id=product.tenant_id,
            sku=product.sku,
            name=product.name,
            description=product.description,
            category=product.category,
            product_type=product.product_type,
            base_price=product.base_price,
            currency=product.currency,
            tax_class=product.tax_class,
            usage_type=product.usage_type,
            usage_unit_name=product.usage_unit_name,
            is_active=product.is_active,
            metadata=product.metadata,
            created_at=product.created_at,
            updated_at=product.updated_at,
        )
        for product in products
    ]


@router.get("/products/{product_id}", response_model=ProductResponse)
async def get_product(
    product_id: str,
    tenant_id: str = Depends(_get_current_tenant_dependency),
    db_session: AsyncSession = Depends(get_async_session),
) -> ProductResponse:
    """Get a specific product by ID."""

    _validate_product_identifier(product_id)

    service = ProductService(db_session)

    try:
        product = await service.get_product(product_id, tenant_id)

        return ProductResponse(
            product_id=product.product_id,
            tenant_id=product.tenant_id,
            sku=product.sku,
            name=product.name,
            description=product.description,
            category=product.category,
            product_type=product.product_type,
            base_price=product.base_price,
            currency=product.currency,
            tax_class=product.tax_class,
            usage_type=product.usage_type,
            usage_unit_name=product.usage_unit_name,
            is_active=product.is_active,
            metadata=product.metadata,
            created_at=product.created_at,
            updated_at=product.updated_at,
        )

    except ProductNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put(
    "/products/{product_id}",
    response_model=ProductResponse,
    dependencies=[Depends(require_permission("billing:catalog:write"))],
)
async def update_product(
    product_id: str,
    updates: ProductUpdateRequest,
    tenant_id: str = Depends(_get_current_tenant_dependency),
    db_session: AsyncSession = Depends(get_async_session),
    current_user: UserInfo = Depends(_get_current_user_dependency),
) -> ProductResponse:
    """
    Update a product.

    Requires authentication and billing:catalog:write permission.
    Only provided fields will be updated. Product type and usage type cannot be changed.
    """

    _validate_product_identifier(product_id)

    service = ProductService(db_session)

    try:
        product = await service.update_product(product_id, updates, tenant_id)

        logger.info(
            "Product updated",
            product_id=product.product_id,
            sku=product.sku,
            user_id=current_user.user_id,
            tenant_id=tenant_id,
        )

        return ProductResponse(
            product_id=product.product_id,
            tenant_id=product.tenant_id,
            sku=product.sku,
            name=product.name,
            description=product.description,
            category=product.category,
            product_type=product.product_type,
            base_price=product.base_price,
            currency=product.currency,
            tax_class=product.tax_class,
            usage_type=product.usage_type,
            usage_unit_name=product.usage_unit_name,
            is_active=product.is_active,
            metadata=product.metadata,
            created_at=product.created_at,
            updated_at=product.updated_at,
        )

    except ProductNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ProductError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.patch(
    "/products/{product_id}/price",
    dependencies=[Depends(require_permission("billing:catalog:write"))],
)
async def update_product_price(
    product_id: str,
    payload: ProductPriceUpdateRequest,
    tenant_id: str = Depends(_get_current_tenant_dependency),
    db_session: AsyncSession = Depends(get_async_session),
    current_user: UserInfo = Depends(_get_current_user_dependency),
) -> JSONResponse:
    """
    Update product price.

    Requires authentication and billing:catalog:write permission.
    Simple price update endpoint for quick price changes.
    Price should be provided in major currency units (e.g., dollars, not cents).
    """

    _validate_product_identifier(product_id)

    service = ProductService(db_session)

    try:
        product = await service.update_price(product_id, payload.new_price, tenant_id)

        logger.info(
            "Product price updated",
            product_id=product.product_id,
            sku=product.sku,
            new_price=str(payload.new_price),
            user_id=current_user.user_id,
            tenant_id=tenant_id,
        )

        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content={
                "message": "Price updated successfully",
                "product_id": product.product_id,
                "sku": product.sku,
                "new_price": float(payload.new_price),
                "currency": product.currency,
            },
        )

    except ProductNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except (ValueError, TypeError) as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid price value: {e}"
        )


@router.delete(
    "/products/{product_id}",
    dependencies=[Depends(require_permission("billing:catalog:write"))],
)
async def deactivate_product(
    product_id: str,
    tenant_id: str = Depends(_get_current_tenant_dependency),
    db_session: AsyncSession = Depends(get_async_session),
    current_user: UserInfo = Depends(_get_current_user_dependency),
) -> Response:
    """
    Deactivate a product (soft delete).

    Requires authentication and billing:catalog:write permission.
    Products are not physically deleted but marked as inactive.
    This preserves data integrity for existing invoices and subscriptions.
    """

    _validate_product_identifier(product_id)

    service = ProductService(db_session)

    try:
        product = await service.deactivate_product(product_id, tenant_id)

        logger.info(
            "Product deactivated",
            product_id=product.product_id,
            sku=product.sku,
            user_id=current_user.user_id,
            tenant_id=tenant_id,
        )

        return Response(status_code=status.HTTP_204_NO_CONTENT)

    except ProductNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.get("/categories/{category}/products", response_model=list[ProductResponse])
async def list_products_by_category(
    category: str,
    active_only: bool = Query(True, description="Only return active products"),
    tenant_id: str = Depends(_get_current_tenant_dependency),
    db_session: AsyncSession = Depends(get_async_session),
) -> list[ProductResponse]:
    """Get all products in a specific category."""

    service = ProductService(db_session)
    products = await service.get_products_by_category(category, tenant_id, active_only)

    return [
        ProductResponse(
            product_id=product.product_id,
            tenant_id=product.tenant_id,
            sku=product.sku,
            name=product.name,
            description=product.description,
            category=product.category,
            product_type=product.product_type,
            base_price=product.base_price,
            currency=product.currency,
            tax_class=product.tax_class,
            usage_type=product.usage_type,
            usage_unit_name=product.usage_unit_name,
            is_active=product.is_active,
            metadata=product.metadata,
            created_at=product.created_at,
            updated_at=product.updated_at,
        )
        for product in products
    ]
