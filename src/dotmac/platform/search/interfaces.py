"""Search service interfaces."""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from enum import Enum
from typing import Any


class SearchType(str, Enum):
    """Search types."""

    FULL_TEXT = "full_text"
    EXACT = "exact"
    PREFIX = "prefix"
    FUZZY = "fuzzy"
    REGEX = "regex"


class SortOrder(str, Enum):
    """Sort order."""

    ASC = "asc"
    DESC = "desc"


@dataclass
class SearchFilter:
    """Search filter criteria."""

    field: str
    value: Any
    operator: str = "eq"  # eq, ne, gt, lt, gte, lte, in, contains


@dataclass
class SearchQuery:
    """Search query parameters."""

    query: str
    search_type: SearchType = SearchType.FULL_TEXT
    filters: list[SearchFilter] = field(default_factory=lambda: [])
    fields: list[str] | None = None  # Fields to search in
    limit: int = 10
    offset: int = 0
    sort_by: str | None = None
    sort_order: SortOrder = SortOrder.DESC
    include_score: bool = False
    highlight: bool = False


@dataclass
class SearchResult:
    """Search result item."""

    id: str
    type: str
    data: dict[str, Any]
    score: float | None = None
    highlights: dict[str, list[str]] | None = None


@dataclass
class SearchResponse:
    """Search response with results and metadata."""

    results: list[SearchResult]
    total: int
    query: SearchQuery
    took_ms: int | None = None


class SearchBackend(ABC):
    """Abstract base class for search backends."""

    @abstractmethod
    async def index(self, index_name: str, doc_id: str, document: dict[str, Any]) -> bool:
        """Index a document."""

    @abstractmethod
    async def search(self, index_name: str, query: SearchQuery) -> SearchResponse:
        """Search documents."""

    @abstractmethod
    async def delete(self, index_name: str, doc_id: str) -> bool:
        """Delete a document."""

    @abstractmethod
    async def update(self, index_name: str, doc_id: str, document: dict[str, Any]) -> bool:
        """Update a document."""

    @abstractmethod
    async def bulk_index(self, index_name: str, documents: list[dict[str, Any]]) -> int:
        """Bulk index documents."""

    @abstractmethod
    async def create_index(self, index_name: str, mappings: dict[str, Any] | None = None) -> bool:
        """Create an index."""

    @abstractmethod
    async def delete_index(self, index_name: str) -> bool:
        """Delete an index."""


__all__ = [
    "SearchType",
    "SortOrder",
    "SearchFilter",
    "SearchQuery",
    "SearchResult",
    "SearchResponse",
    "SearchBackend",
]
