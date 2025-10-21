"""Business search service implementation."""

import asyncio
import contextlib
import os
import re
import time
from typing import Any

import structlog

from ..dependencies import require_meilisearch, safe_import
from ..settings import settings
from .interfaces import (
    SearchBackend,
    SearchFilter,
    SearchQuery,
    SearchResponse,
    SearchResult,
    SearchType,
)

# Only import MeiliSearch if enabled and available
meilisearch = None
if settings.features.search_enabled:
    meilisearch = safe_import(
        "meilisearch",
        "search_enabled",
        error_if_missing=False,
    )

logger = structlog.get_logger(__name__)
if settings.features.search_enabled and meilisearch is None:
    logger.debug(
        "search.meilisearch.dependency_missing",
        message="MeiliSearch client not installed; using in-memory search backend",
    )

# OpenTelemetry is optional for tracing
search_tracer = None
if settings.observability.otel_enabled:
    ot_trace = safe_import(
        "opentelemetry.trace",
        "otel_enabled",
        error_if_missing=False,
    )
    if ot_trace:
        search_tracer = ot_trace.get_tracer(__name__)


class InMemorySearchBackend(SearchBackend):
    """Simple in-memory search backend for development/testing."""

    def __init__(self) -> None:
        self.indices: dict[str, dict[str, dict[str, Any]]] = {}

    async def index(self, index_name: str, doc_id: str, document: dict[str, Any]) -> bool:
        """Index a document."""
        if index_name not in self.indices:
            self.indices[index_name] = {}
        self.indices[index_name][doc_id] = document
        return True

    async def search(self, index_name: str, query: SearchQuery) -> SearchResponse:
        """Search documents."""
        start = time.time()

        if index_name not in self.indices:
            return SearchResponse(results=[], total=0, query=query, took_ms=0)

        results = []
        for doc_id, doc in self.indices[index_name].items():
            if self._matches(doc, query):
                results.append(
                    SearchResult(
                        id=doc_id,
                        type=index_name,
                        data=doc,
                        score=self._calculate_score(doc, query),
                    )
                )

        # Apply sorting
        if query.sort_by:
            reverse = query.sort_order.value == "desc"
            sort_field = query.sort_by
            results.sort(key=lambda x: x.data.get(sort_field, ""), reverse=reverse)
        elif query.include_score:
            results.sort(key=lambda x: x.score or 0, reverse=True)

        # Apply pagination
        total = len(results)
        results = results[query.offset : query.offset + query.limit]

        took_ms = int((time.time() - start) * 1000)
        return SearchResponse(results=results, total=total, query=query, took_ms=took_ms)

    async def delete(self, index_name: str, doc_id: str) -> bool:
        """Delete a document."""
        if index_name in self.indices and doc_id in self.indices[index_name]:
            del self.indices[index_name][doc_id]
            return True
        return False

    async def update(self, index_name: str, doc_id: str, document: dict[str, Any]) -> bool:
        """Update a document."""
        if index_name in self.indices and doc_id in self.indices[index_name]:
            self.indices[index_name][doc_id].update(document)
            return True
        return False

    async def bulk_index(self, index_name: str, documents: list[dict[str, Any]]) -> int:
        """Bulk index documents."""
        if index_name not in self.indices:
            self.indices[index_name] = {}

        count = 0
        for doc in documents:
            if "id" in doc:
                doc_id = doc.pop("id")
                self.indices[index_name][doc_id] = doc
                count += 1
        return count

    async def create_index(self, index_name: str, mappings: dict[str, Any] | None = None) -> bool:
        """Create an index."""
        if index_name not in self.indices:
            self.indices[index_name] = {}
        return True

    async def delete_index(self, index_name: str) -> bool:
        """Delete an index."""
        if index_name in self.indices:
            del self.indices[index_name]
            return True
        return False

    def _matches(self, doc: dict[str, Any], query: SearchQuery) -> bool:
        """Check if document matches query."""
        # Apply filters first
        for filter in query.filters:
            if not self._apply_filter(doc, filter):
                return False

        # Apply text search
        if query.query:
            search_text = query.query.lower()
            doc_text = self._extract_text(doc, query.fields)

            if query.search_type == SearchType.EXACT:
                return search_text in doc_text
            elif query.search_type == SearchType.PREFIX:
                return any(word.startswith(search_text) for word in doc_text.split())
            elif query.search_type == SearchType.REGEX:
                return bool(re.search(query.query, doc_text, re.IGNORECASE))
            else:  # FULL_TEXT or FUZZY
                return search_text in doc_text

        return True

    def _apply_filter(self, doc: dict[str, Any], filter: SearchFilter) -> bool:
        """Apply a filter to a document."""
        value = doc.get(filter.field)
        operator = filter.operator.lower()
        filter_value = filter.value

        if operator == "eq":
            return bool(value == filter_value)
        if operator == "ne":
            return bool(value != filter_value)

        if operator in {"gt", "lt", "gte", "lte"}:
            if value is None or filter_value is None:
                return False
            try:
                if operator == "gt":
                    return bool(value > filter_value)
                if operator == "lt":
                    return bool(value < filter_value)
                if operator == "gte":
                    return bool(value >= filter_value)
                return bool(value <= filter_value)
            except TypeError:
                return False

        if operator == "in":
            if isinstance(filter_value, (list, tuple, set, frozenset)):
                return value in filter_value
            return False

        if operator == "contains":
            if value is None:
                return False
            return str(filter_value) in str(value)

        return False

    def _extract_text(self, doc: dict[str, Any], fields: list[str] | None) -> str:
        """Extract searchable text from document."""
        if fields:
            text_parts = [str(doc.get(field, "")) for field in fields]
        else:
            text_parts = [str(v) for v in doc.values() if v]
        return " ".join(text_parts).lower()

    def _calculate_score(self, doc: dict[str, Any], query: SearchQuery) -> float:
        """Calculate relevance score."""
        if not query.query:
            return 1.0

        doc_text = self._extract_text(doc, query.fields)
        query_text = query.query.lower()

        # Simple scoring based on occurrence count
        count = doc_text.count(query_text)
        return min(count / 10.0, 1.0)


class SearchService:
    """Business search service."""

    def __init__(self, backend: SearchBackend | str | None = None) -> None:
        if isinstance(backend, str):
            from .factory import create_search_backend_from_env

            self.backend = create_search_backend_from_env(backend)
        elif backend is None:
            from .factory import create_search_backend_from_env

            self.backend = create_search_backend_from_env()
        else:
            self.backend = backend
        self.index_mappings: dict[str, dict[str, Any]] = {}

    async def index_business_entity(
        self, entity_type: str, entity_id: str, entity_data: dict[str, Any]
    ) -> bool:
        """Index a business entity."""
        index_name = f"business_{entity_type}"
        return await self.backend.index(index_name, entity_id, entity_data)

    async def search_business_entities(
        self, entity_type: str, query: SearchQuery
    ) -> SearchResponse:
        """Search business entities."""
        index_name = f"business_{entity_type}"
        return await self.backend.search(index_name, query)

    async def delete_business_entity(self, entity_type: str, entity_id: str) -> bool:
        """Delete a business entity from search index."""
        index_name = f"business_{entity_type}"
        return await self.backend.delete(index_name, entity_id)

    async def update_business_entity(
        self, entity_type: str, entity_id: str, entity_data: dict[str, Any]
    ) -> bool:
        """Update a business entity in search index."""
        index_name = f"business_{entity_type}"
        return await self.backend.update(index_name, entity_id, entity_data)

    async def reindex_entity_type(self, entity_type: str, entities: list[dict[str, Any]]) -> int:
        """Reindex all entities of a type."""
        index_name = f"business_{entity_type}"

        # Delete and recreate index
        await self.backend.delete_index(index_name)
        await self.backend.create_index(index_name, self.index_mappings.get(entity_type))

        # Bulk index
        return await self.backend.bulk_index(index_name, entities)

    async def setup_indices(self) -> None:
        """Setup search indices for business entities."""
        # Define index mappings for different entity types
        entity_types = [
            "customer",
            "invoice",
            "subscription",
            "payment",
            "workflow",
            "task",
            "notification",
            "audit",
        ]

        for entity_type in entity_types:
            index_name = f"business_{entity_type}"
            await self.backend.create_index(index_name, self.index_mappings.get(entity_type))


class MeilisearchBackend(SearchBackend):
    """Meilisearch implementation of the search backend protocol."""

    def __init__(
        self,
        host: str | None = None,
        api_key: str | None = None,
        primary_key: str = "id",
        default_timeout: int | None = None,
    ) -> None:
        # Use dependency checker for clear error messages
        meilisearch_module = require_meilisearch()

        # Load from centralized settings with environment overrides
        if host is not None:
            self.host = host
        else:
            env_host = os.getenv("MEILISEARCH_HOST")
            if env_host:
                self.host = env_host
            else:
                try:
                    self.host = settings.external_services.meilisearch_url
                except AttributeError:
                    self.host = "http://localhost:7700"

        self.api_key = api_key or os.getenv("MEILISEARCH_API_KEY")
        self.primary_key = primary_key
        self.client = meilisearch_module.Client(self.host, self.api_key)
        self.meilisearch = meilisearch_module  # Store reference for error handling
        if default_timeout is not None:
            # Some meilisearch versions don't expose http_client attribute
            try:
                http_client = getattr(self.client, "http_client", None)
                if http_client is not None:
                    http_client.timeout = default_timeout
            except (AttributeError, TypeError):
                pass  # Ignore if timeout setting is not available

    async def _run(self, func: Any) -> Any:
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, func)

    def _get_index(self, index_name: str) -> Any:
        try:
            return self.client.get_index(index_name)
        except Exception:  # MeilisearchError path may vary by version
            return self.client.index(index_name)

    def _filters_to_expression(self, filters: list[SearchFilter]) -> str | None:
        if not filters:
            return None
        expressions = []
        for search_filter in filters:
            field = search_filter.field
            value = search_filter.value
            operator = search_filter.operator.lower()
            if operator == "eq":
                expressions.append(f'{field} = "{value}"')
            elif operator == "ne":
                expressions.append(f'{field} != "{value}"')
            elif operator == "in" and isinstance(value, (list, tuple, set)):
                formatted = ", ".join(f'"{v}"' for v in value)
                expressions.append(f"{field} IN [{formatted}]")
            elif operator == "contains":
                expressions.append(f'{field} CONTAINS "{value}"')
        return " AND ".join(expressions) if expressions else None

    async def index(self, index_name: str, doc_id: str, document: dict[str, Any]) -> bool:
        payload = {self.primary_key: doc_id, **document}

        def _op() -> Any:
            index = self._get_index(index_name)
            return index.add_documents([payload], primary_key=self.primary_key)

        with _search_span("search.meilisearch.index", index=index_name):
            await self._run(_op)
        return True

    async def search(self, index_name: str, query: SearchQuery) -> SearchResponse:
        def _op() -> Any:
            index = self._get_index(index_name)
            params: dict[str, Any] = {
                "offset": query.offset,
                "limit": query.limit,
            }
            if query.fields:
                params["attributesToSearchOn"] = query.fields
            if query.include_score:
                params["showMatchesPosition"] = True
            filter_expr = self._filters_to_expression(query.filters)
            if filter_expr:
                params["filter"] = filter_expr
            if query.sort_by:
                order = query.sort_order.value
                params["sort"] = [f"{query.sort_by}:{order}"]
            search_term = query.query or ""
            return index.search(search_term, params)

        with _search_span("search.meilisearch.query", index=index_name, query=query.query or ""):
            response = await self._run(_op)

        hits = response.get("hits", [])
        results: list[SearchResult] = []
        for hit in hits:
            doc_id = str(hit.pop(self.primary_key, hit.get("id")))
            score = hit.pop("_rankingScore", None)
            if score is None:
                score = hit.get("_score")
            highlights = hit.pop("_formatted", None)
            results.append(
                SearchResult(
                    id=doc_id,
                    type=index_name,
                    data=hit,
                    score=score,
                    highlights=highlights,
                )
            )

        total = response.get("estimatedTotalHits", len(results))
        took_ms = response.get("processingTimeMs")
        return SearchResponse(results=results, total=total, query=query, took_ms=took_ms)

    async def delete(self, index_name: str, doc_id: str) -> bool:
        def _op() -> Any:
            index = self._get_index(index_name)
            return index.delete_document(doc_id)

        with _search_span("search.meilisearch.delete", index=index_name):
            await self._run(_op)
        return True

    async def update(self, index_name: str, doc_id: str, document: dict[str, Any]) -> bool:
        payload = {self.primary_key: doc_id, **document}

        def _op() -> Any:
            index = self._get_index(index_name)
            return index.update_documents([payload], primary_key=self.primary_key)

        with _search_span("search.meilisearch.update", index=index_name):
            await self._run(_op)
        return True

    async def bulk_index(self, index_name: str, documents: list[dict[str, Any]]) -> int:
        payloads: list[dict[str, Any]] = []
        for doc in documents:
            payload = dict(doc)
            if self.primary_key in payload:
                payloads.append(payload)
            elif "id" in payload:
                payload[self.primary_key] = payload.pop("id")
                payloads.append(payload)

        if not payloads:
            return 0

        def _op() -> None:
            index = self._get_index(index_name)
            index.add_documents(payloads, primary_key=self.primary_key)

        with _search_span("search.meilisearch.bulk_index", index=index_name, count=len(payloads)):
            await self._run(_op)
        return len(payloads)

    async def create_index(self, index_name: str, mappings: dict[str, Any] | None = None) -> bool:
        def _op() -> Any:
            try:
                self.client.create_index(index_name, {"primaryKey": self.primary_key})
            except Exception as exc:  # MeilisearchError path may vary by version
                if "already exists" not in str(exc):
                    raise
            if mappings:
                index = self._get_index(index_name)
                searchable = mappings.get("searchableAttributes")
                if searchable:
                    index.update_searchable_attributes(searchable)
            return True

        with _search_span("search.meilisearch.create_index", index=index_name):
            await self._run(_op)
        return True

    async def delete_index(self, index_name: str) -> bool:
        def _op() -> Any:
            self.client.delete_index(index_name)
            return True

        with _search_span("search.meilisearch.delete_index", index=index_name):
            await self._run(_op)
        return True


def _search_span(name: str, **attributes: Any) -> Any:
    """Create tracing span if OpenTelemetry is available."""
    if search_tracer:
        return search_tracer.start_as_current_span(name, attributes=attributes)
    return contextlib.nullcontext()
