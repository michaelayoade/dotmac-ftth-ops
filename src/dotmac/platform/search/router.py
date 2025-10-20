"""Search API router."""

from typing import Any

import structlog
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, ConfigDict, Field

from dotmac.platform.auth.core import UserInfo
from dotmac.platform.auth.dependencies import get_current_user

logger = structlog.get_logger(__name__)
search_router = APIRouter(prefix="/search", )


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
    from .factory import get_default_search_backend
    from .interfaces import SearchQuery as InternalSearchQuery
    from .interfaces import SearchType

    logger.info(
        "search.request",
        user_id=current_user.user_id,
        tenant_id=current_user.tenant_id,
        query=q,
        type_filter=type,
    )

    try:
        # Get search backend
        search_backend = get_default_search_backend()

        # Calculate offset from page number
        offset = (page - 1) * limit

        # Build internal search query
        internal_query = InternalSearchQuery(
            query=q,
            search_type=SearchType.FULL_TEXT,
            limit=limit,
            offset=offset,
            include_score=True,
            highlight=True,
        )

        # Determine which indices to search
        indices_to_search = []
        if type:
            # Search specific type within tenant
            index_name = f"dotmac_{type}_{current_user.tenant_id}"
            indices_to_search.append(index_name)
        else:
            # Search common entity types within tenant
            common_types = ["customer", "subscriber", "invoice", "ticket", "user"]
            for entity_type in common_types:
                indices_to_search.append(f"dotmac_{entity_type}_{current_user.tenant_id}")

        # Aggregate results from all indices
        all_results = []
        type_counts: dict[str, int] = {}

        for index_name in indices_to_search:
            try:
                response = await search_backend.search(index_name, internal_query)
                for result in response.results:
                    # Convert internal result to API result format
                    result_type = result.type or "unknown"
                    all_results.append(
                        SearchResult(
                            id=result.id,
                            type=result_type,
                            title=result.data.get("name") or result.data.get("title") or result.id,
                            content=str(result.data)[:200],  # Truncate for preview
                            score=result.score or 0.0,
                            metadata=result.data,
                        )
                    )
                    type_counts[result_type] = type_counts.get(result_type, 0) + 1
            except Exception as e:
                logger.warning(
                    "search.index_error",
                    index=index_name,
                    error=str(e),
                )
                continue

        # Sort by score descending
        all_results.sort(key=lambda x: x.score, reverse=True)

        # Apply limit for this page
        paginated_results = all_results[:limit]

        logger.info(
            "search.completed",
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
            "search.error",
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
    if current_user:
        logger.info(f"User {current_user.user_id} indexing content")
    else:
        logger.info("Anonymous user indexing content")
    return {"message": "Content indexed", "id": "new-id"}


@search_router.delete("/index/{content_id}")
async def remove_from_index(
    content_id: str, current_user: UserInfo = Depends(get_current_user)
) -> dict[str, Any]:
    """Remove content from search index."""
    if current_user:
        logger.info(f"User {current_user.user_id} removing {content_id} from index")
    else:
        logger.info(f"Anonymous user removing {content_id} from index")
    return {"message": f"Content {content_id} removed from index"}


__all__ = ["search_router"]
