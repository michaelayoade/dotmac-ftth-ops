"""Search API router."""

from __future__ import annotations

import asyncio
from collections.abc import Iterable
from typing import Any
from uuid import uuid4

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, Field

from dotmac.platform.auth.core import UserInfo
from dotmac.platform.auth.dependencies import get_current_user
from dotmac.platform.search.interfaces import SearchQuery as InternalSearchQuery
from dotmac.platform.search.interfaces import SearchType
from dotmac.platform.search.service import InMemorySearchBackend, SearchBackend

from .factory import get_default_search_backend

try:  # pragma: no cover - optional dependency
    from meilisearch.errors import MeilisearchCommunicationError

    _COMMUNICATION_ERRORS: tuple[type[Exception], ...] = (MeilisearchCommunicationError,)
except ImportError:  # pragma: no cover
    _COMMUNICATION_ERRORS = ()

logger = structlog.get_logger(__name__)
search_router = APIRouter()

# Default entity types searched when no type filter provided
_DEFAULT_ENTITY_TYPES = {"customer", "subscriber", "invoice", "ticket", "user"}


class _SearchBackendState:
    """Singleton wrapper that lazily initialises and caches the search backend."""

    def __init__(self) -> None:
        self._backend: SearchBackend | None = None
        self._lock = asyncio.Lock()
        self.known_types: set[str] = set(_DEFAULT_ENTITY_TYPES)

    async def get_backend(self) -> SearchBackend:
        if self._backend is not None:
            return self._backend
        async with self._lock:
            if self._backend is None:
                try:
                    backend = get_default_search_backend()
                except Exception as exc:  # pragma: no cover - defensive
                    logger.warning(
                        "search.backend.init_failed",
                        error=str(exc),
                        message="Falling back to in-memory search backend",
                    )
                    backend = InMemorySearchBackend()
                self._backend = backend
        return self._backend

    def register_type(self, entity_type: str) -> None:
        if entity_type:
            self.known_types.add(entity_type.strip().lower())

    def iter_indices(self, tenant_id: str, type_filter: str | None) -> Iterable[str]:
        if type_filter:
            yield _build_index_name(type_filter, tenant_id)
            return
        for entity_type in sorted(self.known_types):
            yield _build_index_name(entity_type, tenant_id)

    async def fallback_to_memory(self, reason: str | None = None) -> SearchBackend:
        async with self._lock:
            backend = InMemorySearchBackend()
            self._backend = backend
        logger.warning(
            "search.backend.fallback_to_memory",
            reason=reason,
            backend="memory",
        )
        return backend


_backend_state = _SearchBackendState()


def _require_tenant_id(user: UserInfo) -> str:
    tenant_id = user.tenant_id
    if tenant_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tenant context is required for search operations.",
        )
    return tenant_id


def _build_index_name(entity_type: str, tenant_id: str) -> str:
    sanitized_type = entity_type.strip().lower() or "document"
    return f"dotmac_{sanitized_type}_{tenant_id}"


def _extract_entity_type(index_name: str, tenant_id: str) -> str:
    prefix = "dotmac_"
    suffix = f"_{tenant_id}"
    if index_name.startswith(prefix):
        candidate = index_name[len(prefix) :]
        if candidate.endswith(suffix):
            candidate = candidate[: -len(suffix)]
        return (candidate or "document").strip().lower()
    return index_name.strip().lower()


async def _handle_backend_failure(exc: Exception, operation: str) -> bool:
    """Determine whether to fall back to in-memory backend and perform the switch."""
    if not _COMMUNICATION_ERRORS:
        return False
    if isinstance(exc, _COMMUNICATION_ERRORS):
        await _backend_state.fallback_to_memory(str(exc))
        logger.warning(
            "search.backend.communication_error",
            operation=operation,
            error=str(exc),
            fallback="memory",
        )
        return True
    return False


# Response Models
class SearchResult(BaseModel):  # BaseModel resolves to Any in isolation
    model_config = ConfigDict()
    id: str = Field(..., description="Result ID")
    type: str = Field(..., description="Result type")
    title: str = Field(..., description="Title")
    content: str = Field(..., description="Content snippet")
    score: float = Field(..., description="Relevance score")
    metadata: dict[str, Any] = Field(default_factory=lambda: {})


class SearchResponse(BaseModel):  # BaseModel resolves to Any in isolation
    model_config = ConfigDict()
    query: str = Field(..., description="Search query")
    results: list[SearchResult] = Field(..., description="Search results")
    total: int = Field(..., description="Total results")
    page: int = Field(..., description="Current page")
    facets: dict[str, Any] = Field(default_factory=lambda: {})


@search_router.get("/", response_model=SearchResponse)
async def search(
    q: str = Query(..., description="Search query"),
    type: str | None = Query(None, description="Filter by type"),
    limit: int = Query(10, ge=1, le=100),
    page: int = Query(1, ge=1),
    current_user: UserInfo = Depends(get_current_user),
) -> SearchResponse:
    """Search across tenant content.

    Searches within the current tenant's data using the configured search backend.
    Uses in-memory search for development; configure Elasticsearch/MeiliSearch for production.
    """
    tenant_id = _require_tenant_id(current_user)
    logger.info(
        f"search.request user={current_user.user_id} query={q}",
        user_id=current_user.user_id,
        tenant_id=tenant_id,
        query=q,
        type_filter=type,
    )

    try:
        # Get search backend
        search_backend = await _backend_state.get_backend()

        # Calculate offset from page number
        offset = (page - 1) * limit

        # Build internal search query
        internal_query = InternalSearchQuery(
            query=q,
            search_type=SearchType.FULL_TEXT,
            limit=limit + offset,
            offset=0,  # Apply offset after aggregating all results
            include_score=True,
            highlight=True,
        )

        # Determine which indices to search
        if type:
            _backend_state.register_type(type)
        indices_to_search = list(_backend_state.iter_indices(tenant_id, type))

        # Aggregate results from all indices
        all_results: list[SearchResult] = []
        type_counts: dict[str, int] = {}

        for index_name in indices_to_search:
            try:
                response = await search_backend.search(index_name, internal_query)
            except Exception as exc:
                if await _handle_backend_failure(exc, "search"):
                    search_backend = await _backend_state.get_backend()
                    try:
                        response = await search_backend.search(index_name, internal_query)
                    except Exception as retry_exc:
                        logger.warning(
                            "search.index_error",
                            index=index_name,
                            error=str(retry_exc),
                        )
                        continue
                else:
                    logger.warning(
                        "search.index_error",
                        index=index_name,
                        error=str(exc),
                    )
                    continue

            for result in response.results:
                # Convert internal result to API result format
                entity_type = _extract_entity_type(index_name, tenant_id)
                _backend_state.register_type(entity_type)
                all_results.append(
                    SearchResult(
                        id=result.id,
                        type=entity_type,
                        title=result.data.get("name") or result.data.get("title") or result.id,
                        content=str(result.data)[:200],  # Truncate for preview
                        score=result.score or 0.0,
                        metadata=result.data,
                    )
                )
                type_counts[entity_type] = type_counts.get(entity_type, 0) + 1

        # Sort by score descending
        all_results.sort(key=lambda x: x.score, reverse=True)

        # Apply pagination across all indices
        paginated_results = all_results[offset : offset + limit]

        logger.debug(
            f"search.completed user={current_user.user_id} query={q} "
            f"page={page} total={len(all_results)}",
            user_id=current_user.user_id,
            query=q,
            total_results=len(all_results),
            page=page,
        )

        return SearchResponse(
            query=q,
            results=paginated_results,
            total=len(all_results),
            page=page,
            facets={"types": type_counts},
        )

    except Exception as e:
        logger.error(
            f"search.error user={current_user.user_id} query={q} error={e}",
            user_id=current_user.user_id,
            query=q,
            error=str(e),
        )
        # Return empty results on error
        return SearchResponse(
            query=q,
            results=[],
            total=0,
            page=page,
            facets={"types": {}},
        )


@search_router.post("/index")
async def index_content(
    content: dict[str, Any], current_user: UserInfo = Depends(get_current_user)
) -> dict[str, Any]:
    """Index new content for search."""
    tenant_id = _require_tenant_id(current_user)
    if not isinstance(content, dict):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Content payload must be a JSON object.",
        )

    search_backend = await _backend_state.get_backend()

    doc_type = str(content.get("type", "document")).strip().lower() or "document"
    doc_id = str(content.get("id") or uuid4())
    index_name = _build_index_name(doc_type, tenant_id)

    _backend_state.register_type(doc_type)

    try:
        await search_backend.create_index(index_name)
    except NotImplementedError:
        pass
    except Exception as exc:  # pragma: no cover - defensive
        if await _handle_backend_failure(exc, "create_index"):
            search_backend = await _backend_state.get_backend()
            try:
                await search_backend.create_index(index_name)
            except Exception as retry_exc:  # pragma: no cover - defensive
                logger.warning(
                    "search.index.create_failed",
                    index=index_name,
                    error=str(retry_exc),
                )
        else:
            logger.warning(
                "search.index.create_failed",
                index=index_name,
                error=str(exc),
            )

    document = dict(content)
    document["tenant_id"] = tenant_id
    document.setdefault("type", doc_type)

    logger.info(
        "search.index.request",
        user_id=current_user.user_id,
        tenant_id=tenant_id,
        index=index_name,
        doc_id=doc_id,
    )

    try:
        await search_backend.index(index_name, doc_id, document)
    except Exception as exc:
        if await _handle_backend_failure(exc, "index"):
            search_backend = await _backend_state.get_backend()
            await search_backend.create_index(index_name)
            await search_backend.index(index_name, doc_id, document)
        else:
            raise
    return {"message": "Content indexed", "id": doc_id, "type": doc_type}


@search_router.delete("/index/{content_id}")
async def remove_from_index(
    content_id: str,
    current_user: UserInfo = Depends(get_current_user),
    type: str | None = Query(None, description="Optional type hint to speed up deletion"),
) -> dict[str, Any]:
    """Remove content from search index."""
    tenant_id = _require_tenant_id(current_user)
    search_backend = await _backend_state.get_backend()

    indices_to_check = list(_backend_state.iter_indices(tenant_id, type))
    removed_from: list[str] = []

    for index_name in indices_to_check:
        try:
            deleted = await search_backend.delete(index_name, content_id)
        except NotImplementedError:
            deleted = False
        except Exception as exc:
            if await _handle_backend_failure(exc, "delete"):
                search_backend = await _backend_state.get_backend()
                try:
                    deleted = await search_backend.delete(index_name, content_id)
                except Exception:
                    deleted = False
            else:
                raise
        if deleted:
            removed_from.append(index_name)
            logger.info(
                "search.index.remove",
                user_id=current_user.user_id,
                tenant_id=tenant_id,
                doc_id=content_id,
                index=index_name,
            )

    if not removed_from:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Content {content_id} not found in search indices.",
        )

    return {
        "message": f"Content {content_id} removed from index",
        "removed_from": removed_from,
    }


__all__ = ["search_router"]
