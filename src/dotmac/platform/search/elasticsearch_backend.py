"""
Elasticsearch Backend.

Elasticsearch implementation of the SearchBackend interface.
"""

from collections.abc import Sequence
from typing import Any

import structlog
from elasticsearch import AsyncElasticsearch, NotFoundError

from dotmac.platform.search.interfaces import (
    SearchBackend,
    SearchQuery,
    SearchResponse,
    SearchResult,
    SearchType,
)
from dotmac.platform.settings import settings

logger = structlog.get_logger(__name__)


class ElasticsearchBackend(SearchBackend):
    """Elasticsearch search backend."""

    def __init__(self, es_url: str | None = None):
        """
        Initialize Elasticsearch backend.

        Args:
            es_url: Elasticsearch URL (defaults to settings.external_services.elasticsearch_url)
        """
        # Load from centralized settings (Phase 2 implementation)
        try:
            default_url = settings.external_services.elasticsearch_url
        except AttributeError:
            # Fallback for backwards compatibility
            default_url = getattr(settings, "elasticsearch_url", "http://localhost:9200")

        self.es_url: str = str(es_url or default_url)
        self.client: AsyncElasticsearch | None = None

    async def _get_client(self) -> AsyncElasticsearch:
        """Get or create Elasticsearch client."""
        if self.client is None:
            self.client = AsyncElasticsearch(hosts=[self.es_url])
        return self.client

    async def close(self) -> None:
        """Close Elasticsearch client."""
        if self.client:
            await self.client.close()
            self.client = None

    async def create_index(self, index_name: str, mappings: dict[str, Any] | None = None) -> bool:
        """Create an index."""
        client = await self._get_client()

        try:
            # Check if index exists
            exists = await client.indices.exists(index=index_name)
            if exists:
                logger.info("Index already exists", index=index_name)
                return False

            # Create index
            body = {
                "settings": {
                    "number_of_shards": 1,
                    "number_of_replicas": 1,
                    "analysis": {
                        "analyzer": {
                            "default": {
                                "type": "standard",
                                "stopwords": "_english_",
                            }
                        }
                    },
                },
            }

            if mappings:
                body["mappings"] = mappings

            await client.indices.create(index=index_name, body=body)
            logger.info("Index created", index=index_name)
            return True

        except Exception as e:
            logger.error("Failed to create index", error=str(e), index=index_name)
            return False

    async def delete_index(self, index_name: str) -> bool:
        """Delete an index."""
        client = await self._get_client()

        try:
            await client.indices.delete(index=index_name)
            logger.info("Index deleted", index=index_name)
            return True
        except NotFoundError:
            logger.warning("Index not found", index=index_name)
            return False
        except Exception as e:
            logger.error("Failed to delete index", error=str(e), index=index_name)
            return False

    async def index(self, index_name: str, doc_id: str, document: dict[str, Any]) -> bool:
        """Index a document."""
        client = await self._get_client()

        try:
            # Add search_text field combining searchable fields
            search_text_parts = []
            for _key, value in document.items():
                if isinstance(value, str):
                    search_text_parts.append(value)
            document["search_text"] = " ".join(search_text_parts)

            await client.index(
                index=index_name,
                id=doc_id,
                document=document,
                refresh="wait_for",
            )

            logger.debug(
                "Document indexed",
                index=index_name,
                doc_id=doc_id,
            )
            return True

        except Exception as e:
            logger.error(
                "Failed to index document",
                error=str(e),
                index=index_name,
                doc_id=doc_id,
            )
            return False

    async def update(self, index_name: str, doc_id: str, document: dict[str, Any]) -> bool:
        """Update a document."""
        client = await self._get_client()

        try:
            await client.update(
                index=index_name,
                id=doc_id,
                doc=document,
                refresh="wait_for",
            )
            return True
        except NotFoundError:
            logger.warning(
                "Document not found for update",
                index=index_name,
                doc_id=doc_id,
            )
            return False
        except Exception as e:
            logger.error(
                "Failed to update document",
                error=str(e),
                index=index_name,
                doc_id=doc_id,
            )
            return False

    async def delete(self, index_name: str, doc_id: str) -> bool:
        """Delete a document."""
        client = await self._get_client()

        try:
            await client.delete(index=index_name, id=doc_id, refresh="wait_for")
            return True
        except NotFoundError:
            logger.warning(
                "Document not found for deletion",
                index=index_name,
                doc_id=doc_id,
            )
            return False
        except Exception as e:
            logger.error(
                "Failed to delete document",
                error=str(e),
                index=index_name,
                doc_id=doc_id,
            )
            return False

    async def bulk_index(self, index_name: str, documents: list[dict[str, Any]]) -> int:
        """Bulk index documents."""
        client = await self._get_client()

        operations = []
        for doc in documents:
            doc_id = doc.pop("id")

            # Add search_text
            search_text_parts = []
            for _key, value in doc.items():
                if isinstance(value, str):
                    search_text_parts.append(value)
            doc["search_text"] = " ".join(search_text_parts)

            operations.append({"index": {"_index": index_name, "_id": doc_id}})
            operations.append(doc)

        try:
            response = await client.bulk(operations=operations, refresh="wait_for")
            successful = sum(1 for item in response["items"] if item["index"]["status"] < 300)

            logger.info(
                "Bulk index completed",
                index=index_name,
                total=len(documents),
                successful=successful,
            )
            return successful

        except Exception as e:
            logger.error("Bulk index failed", error=str(e), index=index_name)
            return 0

    async def search(self, index_name: str, query: SearchQuery) -> SearchResponse:
        """Search documents."""
        client = await self._get_client()

        try:
            # Build Elasticsearch query
            es_query = self._build_query(query)

            # Build sort
            es_sort = []
            if query.sort_by:
                es_sort.append({query.sort_by: {"order": query.sort_order.value}})

            # Build highlight
            es_highlight = None
            if query.highlight:
                es_highlight = {
                    "fields": {
                        "search_text": {"fragment_size": 150, "number_of_fragments": 3},
                        "*": {"fragment_size": 150, "number_of_fragments": 3},
                    }
                }

            # Execute search
            response = await client.search(
                index=index_name,
                query=es_query,
                sort=es_sort if es_sort else None,
                from_=query.offset,
                size=query.limit,
                highlight=es_highlight,
            )

            # Parse results
            results = []
            for hit in response["hits"]["hits"]:
                results.append(
                    SearchResult(
                        id=hit["_id"],
                        type=hit["_source"].get("type", "document"),
                        data=hit["_source"],
                        score=hit["_score"] if query.include_score else None,
                        highlights=hit.get("highlight"),
                    )
                )

            return SearchResponse(
                results=results,
                total=response["hits"]["total"]["value"],
                query=query,
                took_ms=response["took"],
            )

        except NotFoundError:
            logger.warning("Index not found", index=index_name)
            return SearchResponse(results=[], total=0, query=query, took_ms=0)
        except Exception as e:
            logger.error("Search failed", error=str(e), index=index_name)
            return SearchResponse(results=[], total=0, query=query, took_ms=0)

    def _build_query(self, query: SearchQuery) -> dict[str, Any]:
        """Build Elasticsearch query from SearchQuery."""
        must_clauses: list[dict[str, Any]] = []

        # Search type specific query
        if query.search_type == SearchType.FULL_TEXT:
            if query.fields:
                must_clauses.append(
                    {
                        "multi_match": {
                            "query": query.query,
                            "fields": query.fields,
                            "type": "best_fields",
                            "fuzziness": "AUTO",
                        }
                    }
                )
            else:
                must_clauses.append(
                    {
                        "multi_match": {
                            "query": query.query,
                            "fields": ["search_text", "name^2", "title^2", "description"],
                            "type": "best_fields",
                            "fuzziness": "AUTO",
                        }
                    }
                )

        elif query.search_type == SearchType.EXACT:
            if query.fields:
                for field in query.fields:
                    must_clauses.append({"term": {f"{field}.keyword": query.query}})
            else:
                must_clauses.append({"term": {"search_text.keyword": query.query}})

        elif query.search_type == SearchType.PREFIX:
            if query.fields:
                for field in query.fields:
                    must_clauses.append({"prefix": {f"{field}.keyword": query.query}})
            else:
                must_clauses.append({"prefix": {"search_text": query.query}})

        elif query.search_type == SearchType.FUZZY:
            must_clauses.append(
                {
                    "fuzzy": {
                        "search_text": {
                            "value": query.query,
                            "fuzziness": "AUTO",
                        }
                    }
                }
            )

        # Add filters
        for filter_spec in query.filters:
            if filter_spec.operator == "eq":
                must_clauses.append({"term": {filter_spec.field: filter_spec.value}})
            elif filter_spec.operator == "ne":
                must_clauses.append(
                    {"bool": {"must_not": [{"term": {filter_spec.field: filter_spec.value}}]}}
                )
            elif filter_spec.operator == "in":
                values = filter_spec.value
                if isinstance(values, Sequence) and not isinstance(values, (str, bytes)):
                    terms = list(values)
                else:
                    terms = [values]
                must_clauses.append({"terms": {filter_spec.field: terms}})
            elif filter_spec.operator == "gt":
                must_clauses.append({"range": {filter_spec.field: {"gt": filter_spec.value}}})
            elif filter_spec.operator == "gte":
                must_clauses.append({"range": {filter_spec.field: {"gte": filter_spec.value}}})
            elif filter_spec.operator == "lt":
                must_clauses.append({"range": {filter_spec.field: {"lt": filter_spec.value}}})
            elif filter_spec.operator == "lte":
                must_clauses.append({"range": {filter_spec.field: {"lte": filter_spec.value}}})
            elif filter_spec.operator == "contains":
                must_clauses.append({"wildcard": {filter_spec.field: f"*{filter_spec.value}*"}})

        return {"bool": {"must": must_clauses}} if must_clauses else {"match_all": {}}
