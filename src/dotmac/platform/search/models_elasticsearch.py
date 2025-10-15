"""
Search Models.

Elasticsearch index mappings and search models.
"""

from enum import Enum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class SearchableEntity(str, Enum):
    """Entities that can be indexed for search."""

    CUSTOMER = "customer"
    SUBSCRIBER = "subscriber"
    INVOICE = "invoice"
    TICKET = "ticket"
    ORDER = "order"
    PRODUCT = "product"
    SERVICE_PLAN = "service_plan"
    USER = "user"
    CONTACT = "contact"
    AUDIT_LOG = "audit_log"


class SearchOperator(str, Enum):
    """Search query operators."""

    AND = "and"
    OR = "or"
    NOT = "not"


class SortOrder(str, Enum):
    """Sort order."""

    ASC = "asc"
    DESC = "desc"


# =============================================================================
# Index Mappings
# =============================================================================

CUSTOMER_INDEX_MAPPING = {
    "properties": {
        "tenant_id": {"type": "keyword"},
        "customer_id": {"type": "keyword"},
        "email": {"type": "keyword"},
        "name": {
            "type": "text",
            "fields": {"keyword": {"type": "keyword"}},
            "analyzer": "standard",
        },
        "phone": {"type": "keyword"},
        "company": {
            "type": "text",
            "fields": {"keyword": {"type": "keyword"}},
        },
        "status": {"type": "keyword"},
        "account_number": {"type": "keyword"},
        "service_address": {"type": "text"},
        "tags": {"type": "keyword"},
        "created_at": {"type": "date"},
        "updated_at": {"type": "date"},
        # Full-text search fields
        "search_text": {"type": "text", "analyzer": "standard"},
    }
}

SUBSCRIBER_INDEX_MAPPING = {
    "properties": {
        "tenant_id": {"type": "keyword"},
        "subscriber_id": {"type": "keyword"},
        "customer_id": {"type": "keyword"},
        "username": {"type": "keyword"},
        "email": {"type": "keyword"},
        "phone": {"type": "keyword"},
        "status": {"type": "keyword"},
        "service_type": {"type": "keyword"},
        "ip_address": {"type": "ip"},
        "mac_address": {"type": "keyword"},
        "installed_at": {"type": "date"},
        "created_at": {"type": "date"},
        "search_text": {"type": "text", "analyzer": "standard"},
    }
}

INVOICE_INDEX_MAPPING = {
    "properties": {
        "tenant_id": {"type": "keyword"},
        "invoice_id": {"type": "keyword"},
        "customer_id": {"type": "keyword"},
        "invoice_number": {"type": "keyword"},
        "amount": {"type": "scaled_float", "scaling_factor": 100},
        "currency": {"type": "keyword"},
        "status": {"type": "keyword"},
        "due_date": {"type": "date"},
        "paid_at": {"type": "date"},
        "created_at": {"type": "date"},
        "items": {
            "type": "nested",
            "properties": {
                "description": {"type": "text"},
                "amount": {"type": "scaled_float", "scaling_factor": 100},
            },
        },
        "search_text": {"type": "text", "analyzer": "standard"},
    }
}

TICKET_INDEX_MAPPING = {
    "properties": {
        "tenant_id": {"type": "keyword"},
        "ticket_id": {"type": "keyword"},
        "customer_id": {"type": "keyword"},
        "ticket_number": {"type": "keyword"},
        "title": {
            "type": "text",
            "fields": {"keyword": {"type": "keyword"}},
        },
        "description": {"type": "text"},
        "status": {"type": "keyword"},
        "priority": {"type": "keyword"},
        "category": {"type": "keyword"},
        "assigned_to": {"type": "keyword"},
        "created_by": {"type": "keyword"},
        "created_at": {"type": "date"},
        "updated_at": {"type": "date"},
        "resolved_at": {"type": "date"},
        "search_text": {"type": "text", "analyzer": "standard"},
    }
}

PRODUCT_INDEX_MAPPING = {
    "properties": {
        "tenant_id": {"type": "keyword"},
        "product_id": {"type": "keyword"},
        "name": {
            "type": "text",
            "fields": {"keyword": {"type": "keyword"}},
        },
        "description": {"type": "text"},
        "sku": {"type": "keyword"},
        "category": {"type": "keyword"},
        "price": {"type": "scaled_float", "scaling_factor": 100},
        "currency": {"type": "keyword"},
        "is_active": {"type": "boolean"},
        "tags": {"type": "keyword"},
        "created_at": {"type": "date"},
        "search_text": {"type": "text", "analyzer": "standard"},
    }
}

USER_INDEX_MAPPING = {
    "properties": {
        "tenant_id": {"type": "keyword"},
        "user_id": {"type": "keyword"},
        "email": {"type": "keyword"},
        "name": {
            "type": "text",
            "fields": {"keyword": {"type": "keyword"}},
        },
        "role": {"type": "keyword"},
        "status": {"type": "keyword"},
        "department": {"type": "keyword"},
        "created_at": {"type": "date"},
        "last_login": {"type": "date"},
        "search_text": {"type": "text", "analyzer": "standard"},
    }
}

AUDIT_LOG_INDEX_MAPPING = {
    "properties": {
        "tenant_id": {"type": "keyword"},
        "log_id": {"type": "keyword"},
        "user_id": {"type": "keyword"},
        "action": {"type": "keyword"},
        "resource_type": {"type": "keyword"},
        "resource_id": {"type": "keyword"},
        "ip_address": {"type": "ip"},
        "user_agent": {"type": "text"},
        "timestamp": {"type": "date"},
        "changes": {"type": "object", "enabled": False},
        "search_text": {"type": "text", "analyzer": "standard"},
    }
}

# Index mapping registry
INDEX_MAPPINGS = {
    SearchableEntity.CUSTOMER: CUSTOMER_INDEX_MAPPING,
    SearchableEntity.SUBSCRIBER: SUBSCRIBER_INDEX_MAPPING,
    SearchableEntity.INVOICE: INVOICE_INDEX_MAPPING,
    SearchableEntity.TICKET: TICKET_INDEX_MAPPING,
    SearchableEntity.PRODUCT: PRODUCT_INDEX_MAPPING,
    SearchableEntity.USER: USER_INDEX_MAPPING,
    SearchableEntity.AUDIT_LOG: AUDIT_LOG_INDEX_MAPPING,
}


# =============================================================================
# Search Query Models
# =============================================================================


class SearchFilter(BaseModel):  # BaseModel resolves to Any in isolation
    """Search filter for field-specific queries."""

    model_config = ConfigDict()

    field: str = Field(..., description="Field name to filter on")
    value: Any = Field(..., description="Filter value")
    operator: SearchOperator = Field(SearchOperator.AND, description="Filter operator")


class SearchSort(BaseModel):  # BaseModel resolves to Any in isolation
    """Search sort specification."""

    model_config = ConfigDict()

    field: str = Field(..., description="Field to sort by")
    order: SortOrder = Field(SortOrder.DESC, description="Sort order")


class SearchQuery(BaseModel):  # BaseModel resolves to Any in isolation
    """Search query specification."""

    model_config = ConfigDict()

    query: str | None = Field(None, description="Full-text search query")
    filters: list[SearchFilter] = Field(default_factory=list, description="Field filters")
    sort: list[SearchSort] = Field(default_factory=list, description="Sort specifications")
    page: int = Field(1, ge=1, description="Page number")
    page_size: int = Field(20, ge=1, le=100, description="Results per page")
    highlight: bool = Field(True, description="Enable search term highlighting")


class SearchResult(BaseModel):  # BaseModel resolves to Any in isolation
    """Individual search result."""

    model_config = ConfigDict()

    entity_type: SearchableEntity
    entity_id: str
    score: float
    data: dict[str, Any]
    highlights: dict[str, list[str]] | None = None


class SearchResponse(BaseModel):  # BaseModel resolves to Any in isolation
    """Search response with results and metadata."""

    model_config = ConfigDict()

    results: list[SearchResult]
    total: int
    page: int
    page_size: int
    took_ms: int
    has_more: bool


class AggregationResult(BaseModel):
    """Aggregation result."""

    model_config = ConfigDict()

    field: str
    buckets: list[dict[str, Any]]


class SearchSuggestion(BaseModel):  # BaseModel resolves to Any in isolation
    """Search suggestion for autocomplete."""

    model_config = ConfigDict()

    text: str
    score: float
    entity_type: SearchableEntity | None = None
