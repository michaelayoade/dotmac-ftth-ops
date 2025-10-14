"""Search service for business entities."""

from .factory import create_search_backend_from_env
from .interfaces import SearchBackend, SearchQuery, SearchResponse, SearchResult
from .service import (
    InMemorySearchBackend,
    MeilisearchBackend,
    SearchService,
)

# Elasticsearch backend (optional, imported if available)
try:
    from .elasticsearch_backend import ElasticsearchBackend

    _HAS_ELASTICSEARCH = True
except ImportError:
    ElasticsearchBackend = None
    _HAS_ELASTICSEARCH = False

__all__ = [
    "SearchService",
    "SearchQuery",
    "SearchResult",
    "SearchResponse",
    "SearchBackend",
    "InMemorySearchBackend",
    "MeilisearchBackend",
    "create_search_backend_from_env",
]

if _HAS_ELASTICSEARCH:
    __all__.append("ElasticsearchBackend")
