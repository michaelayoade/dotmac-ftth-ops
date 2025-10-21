"""Search service for business entities."""

from typing import cast

from .factory import create_search_backend_from_env
from .interfaces import SearchBackend, SearchQuery, SearchResponse, SearchResult
from .service import (
    InMemorySearchBackend,
    MeilisearchBackend,
    SearchService,
)

# Elasticsearch backend (optional, imported if available)
ElasticsearchBackend: type[SearchBackend] | None = None
_HAS_ELASTICSEARCH = False

try:
    from .elasticsearch_backend import ElasticsearchBackend as _ImportedElasticsearchBackend
except ImportError:
    pass
else:
    ElasticsearchBackend = cast(type[SearchBackend], _ImportedElasticsearchBackend)
    _HAS_ELASTICSEARCH = True

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
