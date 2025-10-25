"""
Product catalog service - simple CRUD operations with business logic.
"""

from datetime import UTC, datetime
from decimal import Decimal
from typing import Any
from uuid import uuid4

import structlog
from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.billing.catalog.models import (
    Product,
    ProductCategory,
    ProductCategoryCreateRequest,
    ProductCreateRequest,
    ProductFilters,
    ProductType,
    ProductUpdateRequest,
    TaxClass,
    UsageType,
)
from dotmac.platform.billing.exceptions import (
    BillingConfigurationError,
    CategoryNotFoundError,
    DuplicateProductError,
    ProductError,
    ProductNotFoundError,
)
from dotmac.platform.billing.models import (
    BillingProductCategoryTable,
    BillingProductTable,
)

logger = structlog.get_logger(__name__)


def generate_product_id() -> str:
    """Generate unique product ID."""
    return f"prod_{uuid4().hex[:12]}"


def generate_category_id() -> str:
    """Generate unique category ID."""
    return f"cat_{uuid4().hex[:8]}"


class ProductService:
    """Simple product management service with basic CRUD operations."""

    def __init__(self, db_session: AsyncSession) -> None:
        self.db = db_session

    async def create_category(
        self, category_data: ProductCategoryCreateRequest, tenant_id: str
    ) -> ProductCategory:
        """Create a new product category."""

        # Check for duplicate category name within tenant
        existing = await self._get_category_by_name(category_data.name, tenant_id)
        if existing:
            raise ProductError(f"Category '{category_data.name}' already exists")

        # Create database record
        db_category = BillingProductCategoryTable(
            category_id=generate_category_id(),
            tenant_id=tenant_id,
            name=category_data.name,
            description=category_data.description,
            default_tax_class=category_data.default_tax_class.value,
            sort_order=category_data.sort_order,
        )

        self.db.add(db_category)
        await self.db.commit()
        await self.db.refresh(db_category)

        # Convert to Pydantic model using helper method
        category = self._db_to_pydantic_category(db_category)

        logger.info(
            "Product category created",
            category_id=category.category_id,
            name=category.name,
            tenant_id=tenant_id,
        )

        return category

    async def create_product(self, product_data: ProductCreateRequest, tenant_id: str) -> Product:
        """
        Create a new product with SKU uniqueness validation.

        Args:
            product_data: Product creation request with validated data
            tenant_id: Tenant identifier for isolation

        Returns:
            Created product instance

        Raises:
            DuplicateProductError: If SKU already exists
            BillingConfigurationError: If product configuration is invalid
            ProductError: For other product-related errors
        """
        normalized_sku = product_data.sku.strip().upper()
        try:
            # Validate SKU uniqueness within tenant
            existing = await self.get_product_by_sku(normalized_sku, tenant_id)
            if existing:
                raise DuplicateProductError(
                    f"Product with SKU '{normalized_sku}' already exists in tenant {tenant_id}",
                    sku=normalized_sku,
                )

            # Validate usage configuration
            if product_data.product_type in [ProductType.USAGE_BASED, ProductType.HYBRID]:
                if not product_data.usage_type:
                    raise BillingConfigurationError(
                        f"Usage type is required for {product_data.product_type} products",
                        config_key="usage_type",
                        recovery_hint=f"Specify a usage_type when creating {product_data.product_type} products",
                    )
                if not product_data.usage_unit_name:
                    raise BillingConfigurationError(
                        f"Usage unit name is required for {product_data.product_type} products",
                        config_key="usage_unit_name",
                        recovery_hint="Specify the unit name for usage measurement (e.g., 'requests', 'GB', 'hours')",
                    )

        except (DuplicateProductError, BillingConfigurationError):
            raise
        except Exception as e:
            logger.error(
                "Unexpected error during product validation",
                sku=product_data.sku,
                tenant_id=tenant_id,
                error=str(e),
            )
            raise ProductError(
                f"Failed to validate product: {str(e)}",
                context={"sku": product_data.sku},
                recovery_hint="Check product data and retry",
            )

        # Create database record
        db_product = BillingProductTable(
            product_id=generate_product_id(),
            tenant_id=tenant_id,
            sku=normalized_sku,
            name=product_data.name,
            description=product_data.description,
            category=product_data.category,
            product_type=product_data.product_type.value,
            base_price=product_data.base_price,
            currency=product_data.currency,
            tax_class=product_data.tax_class.value,
            usage_type=product_data.usage_type.value if product_data.usage_type else None,
            usage_unit_name=product_data.usage_unit_name,
            metadata_json=product_data.metadata,
            is_active=True if product_data.is_active is None else product_data.is_active,
        )

        try:
            self.db.add(db_product)
            await self.db.commit()
            await self.db.refresh(db_product)
        except Exception as e:
            await self.db.rollback()
            logger.error(
                "Database error creating product",
                sku=product_data.sku,
                tenant_id=tenant_id,
                error=str(e),
            )
            raise ProductError(
                f"Failed to create product in database: {str(e)}",
                context={"sku": product_data.sku, "name": product_data.name},
                recovery_hint="Check database connectivity and retry",
            )

        # Convert to Pydantic model using helper method
        product = self._db_to_pydantic_product(db_product)

        logger.info(
            "Product created",
            product_id=product.product_id,
            sku=product.sku,
            name=product.name,
            product_type=product.product_type,
            tenant_id=tenant_id,
        )

        return product

    async def get_product(self, product_id: str, tenant_id: str) -> Product:
        """
        Get product by ID with tenant validation.

        Args:
            product_id: Unique product identifier
            tenant_id: Tenant identifier for isolation

        Returns:
            Product instance if found

        Raises:
            ProductNotFoundError: If product doesn't exist or isn't accessible
        """
        try:
            stmt = select(BillingProductTable).where(
                and_(
                    BillingProductTable.product_id == product_id,
                    BillingProductTable.tenant_id == tenant_id,
                )
            )
            result = await self.db.execute(stmt)
            db_product = result.scalar_one_or_none()
        except Exception as e:
            logger.error(
                "Database error fetching product",
                product_id=product_id,
                tenant_id=tenant_id,
                error=str(e),
            )
            raise ProductError(
                f"Failed to fetch product: {str(e)}",
                context={"product_id": product_id},
                recovery_hint="Check database connectivity and retry",
            )

        if not db_product:
            raise ProductNotFoundError(
                f"Product {product_id} not found in tenant {tenant_id}", product_id=product_id
            )

        return self._db_to_pydantic_product(db_product)

    async def get_product_by_sku(self, sku: str, tenant_id: str) -> Product | None:
        """Get product by SKU within tenant."""

        normalized_sku = sku.strip().upper()
        stmt = select(BillingProductTable).where(
            and_(
                BillingProductTable.tenant_id == tenant_id,
                or_(
                    BillingProductTable.sku == normalized_sku,
                    BillingProductTable.sku == sku.strip(),
                ),
            )
        )
        result = await self.db.execute(stmt)
        db_product = result.scalar_one_or_none()

        if not db_product:
            return None

        return self._db_to_pydantic_product(db_product)

    async def list_products(
        self,
        tenant_id: str,
        filters: ProductFilters | None = None,
        page: int = 1,
        limit: int = 50,
    ) -> list[Product]:
        """List products with filtering and pagination."""

        if filters is None:
            filters = ProductFilters(
                category=None,
                product_type=None,
                is_active=True,
                usage_type=None,
                search=None,
            )

        stmt = select(BillingProductTable).where(BillingProductTable.tenant_id == tenant_id)

        # Apply filters
        if filters.category:
            stmt = stmt.where(BillingProductTable.category == filters.category)

        if filters.product_type:
            stmt = stmt.where(BillingProductTable.product_type == filters.product_type.value)

        if filters.usage_type:
            stmt = stmt.where(BillingProductTable.usage_type == filters.usage_type.value)

        stmt = stmt.where(BillingProductTable.is_active == filters.is_active)

        if filters.search:
            search_term = f"%{filters.search}%"
            stmt = stmt.where(
                or_(
                    BillingProductTable.name.ilike(search_term),
                    BillingProductTable.description.ilike(search_term),
                    BillingProductTable.sku.ilike(search_term),
                )
            )

        # Apply pagination
        offset = (page - 1) * limit
        stmt = stmt.offset(offset).limit(limit)

        # Order by name for consistent results
        stmt = stmt.order_by(BillingProductTable.name)

        result = await self.db.execute(stmt)
        db_products = result.scalars().all()

        return [self._db_to_pydantic_product(db_product) for db_product in db_products]

    async def update_product(
        self, product_id: str, updates: ProductUpdateRequest, tenant_id: str
    ) -> Product:
        """Update product with validation."""

        # Get existing product
        stmt = select(BillingProductTable).where(
            and_(
                BillingProductTable.product_id == product_id,
                BillingProductTable.tenant_id == tenant_id,
            )
        )
        result = await self.db.execute(stmt)
        db_product = result.scalar_one_or_none()

        if not db_product:
            raise ProductNotFoundError(f"Product {product_id} not found")

        # Update only provided fields
        update_data = updates.model_dump(exclude_unset=True)

        for field, value in update_data.items():
            if field == "metadata":
                if value is None:
                    logger.debug(
                        "Skipping metadata update because value is None",
                        product_id=product_id,
                        tenant_id=tenant_id,
                    )
                    continue
                db_product.metadata_json = value
            elif field == "tax_class" and value:
                setattr(db_product, field, value.value)
            else:
                setattr(db_product, field, value)

        await self.db.commit()
        await self.db.refresh(db_product)

        logger.info(
            "Product updated",
            product_id=product_id,
            updates=list(update_data.keys()),
            tenant_id=tenant_id,
        )

        return self._db_to_pydantic_product(db_product)

    async def update_price(self, product_id: str, new_price: Decimal, tenant_id: str) -> Product:
        """Simple price update - no versioning."""

        # Get existing product
        stmt = select(BillingProductTable).where(
            and_(
                BillingProductTable.product_id == product_id,
                BillingProductTable.tenant_id == tenant_id,
            )
        )
        result = await self.db.execute(stmt)
        db_product = result.scalar_one_or_none()

        if not db_product:
            raise ProductNotFoundError(f"Product {product_id} not found")

        old_price = db_product.base_price
        db_product.base_price = new_price

        await self.db.commit()
        await self.db.refresh(db_product)

        logger.info(
            "Product price updated",
            product_id=product_id,
            old_price=str(old_price),
            new_price=str(new_price),
            tenant_id=tenant_id,
        )

        return self._db_to_pydantic_product(db_product)

    async def deactivate_product(self, product_id: str, tenant_id: str) -> Product:
        """Deactivate product (soft delete)."""

        # Get existing product
        stmt = select(BillingProductTable).where(
            and_(
                BillingProductTable.product_id == product_id,
                BillingProductTable.tenant_id == tenant_id,
            )
        )
        result = await self.db.execute(stmt)
        db_product = result.scalar_one_or_none()

        if not db_product:
            raise ProductNotFoundError(f"Product {product_id} not found")

        db_product.is_active = False

        await self.db.commit()
        await self.db.refresh(db_product)

        logger.info(
            "Product deactivated",
            product_id=product_id,
            tenant_id=tenant_id,
        )

        return self._db_to_pydantic_product(db_product)

    async def list_categories(
        self, tenant_id: str, active_only: bool = True
    ) -> list[ProductCategory]:
        """List product categories, ordered by sort_order."""

        stmt = select(BillingProductCategoryTable).where(
            BillingProductCategoryTable.tenant_id == tenant_id
        )
        stmt = stmt.order_by(
            BillingProductCategoryTable.sort_order, BillingProductCategoryTable.name
        )

        result = await self.db.execute(stmt)
        db_categories = result.scalars().all()

        return [self._db_to_pydantic_category(db_cat) for db_cat in db_categories]

    async def get_category(self, category_id: str, tenant_id: str) -> ProductCategory:
        """Get category by ID."""

        stmt = select(BillingProductCategoryTable).where(
            and_(
                BillingProductCategoryTable.category_id == category_id,
                BillingProductCategoryTable.tenant_id == tenant_id,
            )
        )
        result = await self.db.execute(stmt)
        db_category = result.scalar_one_or_none()

        if not db_category:
            raise CategoryNotFoundError(f"Category {category_id} not found")

        return self._db_to_pydantic_category(db_category)

    async def get_usage_products(self, tenant_id: str) -> list[Product]:
        """Get products configured for usage-based billing."""

        stmt = select(BillingProductTable).where(
            and_(
                BillingProductTable.tenant_id == tenant_id,
                BillingProductTable.product_type.in_(
                    [ProductType.USAGE_BASED.value, ProductType.HYBRID.value]
                ),
                BillingProductTable.is_active,
            )
        )

        result = await self.db.execute(stmt)
        db_products = result.scalars().all()

        return [self._db_to_pydantic_product(db_product) for db_product in db_products]

    async def get_products_by_category(
        self, category: str, tenant_id: str, active_only: bool = True
    ) -> list[Product]:
        """Get all products in a specific category."""

        stmt = select(BillingProductTable).where(
            and_(
                BillingProductTable.tenant_id == tenant_id, BillingProductTable.category == category
            )
        )

        if active_only:
            stmt = stmt.where(BillingProductTable.is_active)

        stmt = stmt.order_by(BillingProductTable.name)

        result = await self.db.execute(stmt)
        db_products = result.scalars().all()

        return [self._db_to_pydantic_product(db_product) for db_product in db_products]

    # Private helper methods

    async def _get_category_by_name(self, name: str, tenant_id: str) -> ProductCategory | None:
        """Get category by name within tenant."""

        stmt = select(BillingProductCategoryTable).where(
            and_(
                BillingProductCategoryTable.name == name,
                BillingProductCategoryTable.tenant_id == tenant_id,
            )
        )
        result = await self.db.execute(stmt)
        db_category = result.scalar_one_or_none()

        if not db_category:
            return None

        return self._db_to_pydantic_category(db_category)

    def _db_to_pydantic_product(self, db_product: BillingProductTable) -> Product:
        """Convert database product to Pydantic model."""
        from decimal import Decimal

        # Extract values from SQLAlchemy columns
        product_id: str = str(db_product.product_id)
        tenant_id: str = str(db_product.tenant_id)
        sku: str = str(db_product.sku)
        name: str = str(db_product.name)
        description: str | None = (
            str(db_product.description) if getattr(db_product, "description", None) else None
        )
        category: str = str(db_product.category)
        product_type_value: str = str(db_product.product_type)
        base_price: Decimal = Decimal(str(db_product.base_price))
        currency: str = str(db_product.currency)
        tax_class_value = str(db_product.tax_class)
        try:
            tax_class_enum = TaxClass(tax_class_value)
        except ValueError:
            logger.warning(
                "Unknown tax class value; defaulting",
                tax_class=tax_class_value,
                product_id=product_id,
            )
            tax_class_enum = TaxClass.STANDARD
        usage_unit_name: str | None = (
            str(db_product.usage_unit_name)
            if getattr(db_product, "usage_unit_name", None)
            else None
        )
        is_active: bool = bool(db_product.is_active)

        usage_type_raw = getattr(db_product, "usage_type", None)
        usage_type = UsageType(usage_type_raw) if usage_type_raw else None

        metadata: dict[str, Any] = getattr(db_product, "metadata_json", None) or {}
        created_at: datetime = getattr(db_product, "created_at", datetime.now(UTC))
        updated_at: datetime = getattr(db_product, "updated_at", datetime.now(UTC))

        return Product(
            product_id=product_id,
            tenant_id=tenant_id,
            sku=sku,
            name=name,
            description=description,
            category=category,
            product_type=ProductType(product_type_value),
            base_price=base_price,
            currency=currency,
            tax_class=tax_class_enum,
            usage_type=usage_type,
            usage_unit_name=usage_unit_name,
            is_active=is_active,
            metadata=metadata,
            created_at=created_at,
            updated_at=updated_at,
        )

    def _db_to_pydantic_category(self, db_category: BillingProductCategoryTable) -> ProductCategory:
        """Convert database category to Pydantic model."""

        # Extract values from SQLAlchemy columns
        category_id: str = str(db_category.category_id)
        tenant_id: str = str(db_category.tenant_id)
        name: str = str(db_category.name)
        description: str | None = (
            str(db_category.description) if getattr(db_category, "description", None) else None
        )
        default_tax_class_value: str = str(db_category.default_tax_class)
        try:
            default_tax_class = TaxClass(default_tax_class_value)
        except ValueError:
            logger.warning(
                "Unknown default tax class; defaulting",
                tax_class=default_tax_class_value,
                category_id=category_id,
            )
            default_tax_class = TaxClass.STANDARD
        sort_order: int = int(getattr(db_category, "sort_order", 0))
        created_at: datetime = getattr(db_category, "created_at", datetime.now(UTC))
        updated_at: datetime = getattr(db_category, "updated_at", datetime.now(UTC))

        return ProductCategory(
            category_id=category_id,
            tenant_id=tenant_id,
            name=name,
            description=description,
            default_tax_class=default_tax_class,
            sort_order=sort_order,
            created_at=created_at,
            updated_at=updated_at,
        )
