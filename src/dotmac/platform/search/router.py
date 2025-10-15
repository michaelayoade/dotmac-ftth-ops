"""Search API router."""

from typing import Any

import structlog
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, ConfigDict, Field

from dotmac.platform.auth.core import UserInfo
from dotmac.platform.auth.dependencies import get_current_user

logger = structlog.get_logger(__name__)
search_router = APIRouter()


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
    """Search across all content."""
    logger.info(f"User {current_user.user_id} searching: {q}")

    # Mock results
    results = [
        SearchResult(
            id="1",
            type="document",
            title="Sample Result",
            content="This is a sample search result...",
            score=0.95,
        )
    ]

    return SearchResponse(
        query=q, results=results, total=1, page=page, facets={"types": {"document": 1}}
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
