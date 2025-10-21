"""
Elasticsearch Service.

Service for indexing and searching documents in Elasticsearch.
"""

from typing import Any

import structlog
from elasticsearch import AsyncElasticsearch, NotFoundError

from dotmac.platform.search.models_elasticsearch import (
    INDEX_MAPPINGS,
    AggregationResult,
    SearchableEntity,
    SearchOperator,
    SearchQuery,
    SearchResponse,
    SearchResult,
    SearchSuggestion,
)
from dotmac.platform.settings import settings

logger = structlog.get_logger(__name__)


class SearchService:
    """Service for Elasticsearch operations."""

    def __init__(self, es_client: AsyncElasticsearch | None = None):
        """
        Initialize search service.

        Args:
            es_client: Elasticsearch client (optional, will create if not provided)
        """
        self.es = es_client
        self._index_prefix = "dotmac"

    async def _get_client(self) -> AsyncElasticsearch:
        """Get or create Elasticsearch client."""
        if self.es is None:
            # Get Elasticsearch URL from settings
            es_url = getattr(settings, "elasticsearch_url", "http://localhost:9200")
            self.es = AsyncElasticsearch([es_url])
        return self.es

    def _get_index_name(self, entity_type: SearchableEntity, tenant_id: str) -> str:
        """
        Generate index name with tenant isolation.

        Format: dotmac_<entity_type>_<tenant_id>
        """
        return f"{self._index_prefix}_{entity_type.value}_{tenant_id}"

    async def close(self) -> None:
        """Close Elasticsearch client."""
        if self.es:
            await self.es.close()

    # =========================================================================
    # Index Management
    # =========================================================================

    async def create_index(self, entity_type: SearchableEntity, tenant_id: str) -> bool:
        """
        Create an index for an entity type.

        Args:
            entity_type: Type of entity to index
            tenant_id: Tenant ID for isolation

        Returns:
            True if index was created
        """
        es = await self._get_client()
        index_name = self._get_index_name(entity_type, tenant_id)

        # Check if index exists
        exists = await es.indices.exists(index=index_name)
        if exists:
            logger.info("Index already exists", index=index_name)
            return False

        # Get mapping for entity type
        mapping = INDEX_MAPPINGS.get(entity_type)
        if not mapping:
            raise ValueError(f"No mapping defined for {entity_type}")

        # Create index with mapping
        await es.indices.create(
            index=index_name,
            body={
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
                "mappings": mapping,
            },
        )

        logger.info("Index created", index=index_name, entity_type=entity_type)
        return True

    async def delete_index(self, entity_type: SearchableEntity, tenant_id: str) -> bool:
        """Delete an index."""
        es = await self._get_client()
        index_name = self._get_index_name(entity_type, tenant_id)

        try:
            await es.indices.delete(index=index_name)
            logger.info("Index deleted", index=index_name)
            return True
        except NotFoundError:
            logger.warning("Index not found", index=index_name)
            return False

    async def refresh_index(self, entity_type: SearchableEntity, tenant_id: str) -> None:
        """Refresh an index to make recent changes searchable."""
        es = await self._get_client()
        index_name = self._get_index_name(entity_type, tenant_id)
        await es.indices.refresh(index=index_name)

    # =========================================================================
    # Document Indexing
    # =========================================================================

    async def index_document(
        self,
        entity_type: SearchableEntity,
        tenant_id: str,
        entity_id: str,
        document: dict[str, Any],
    ) -> bool:
        """
        Index a document.

        Args:
            entity_type: Type of entity
            tenant_id: Tenant ID
            entity_id: Entity ID
            document: Document data to index

        Returns:
            True if indexed successfully
        """
        es = await self._get_client()
        index_name = self._get_index_name(entity_type, tenant_id)

        # Ensure tenant_id is in document
        document["tenant_id"] = tenant_id

        try:
            await es.index(
                index=index_name,
                id=entity_id,
                document=document,
                refresh="wait_for",  # Make immediately searchable
            )

            logger.debug(
                "Document indexed",
                entity_type=entity_type,
                entity_id=entity_id,
                tenant_id=tenant_id,
            )
            return True

        except Exception as e:
            logger.error(
                "Failed to index document",
                error=str(e),
                entity_type=entity_type,
                entity_id=entity_id,
            )
            return False

    async def bulk_index_documents(
        self,
        entity_type: SearchableEntity,
        tenant_id: str,
        documents: list[dict[str, Any]],
    ) -> tuple[int, int]:
        """
        Bulk index multiple documents.

        Args:
            entity_type: Type of entity
            tenant_id: Tenant ID
            documents: List of documents with 'id' field

        Returns:
            Tuple of (successful_count, failed_count)
        """
        es = await self._get_client()
        index_name = self._get_index_name(entity_type, tenant_id)

        operations = []
        for doc in documents:
            entity_id = doc.pop("id")
            doc["tenant_id"] = tenant_id

            operations.append({"index": {"_index": index_name, "_id": entity_id}})
            operations.append(doc)

        try:
            response = await es.bulk(operations=operations, refresh="wait_for")

            successful = sum(1 for item in response["items"] if item["index"]["status"] < 300)
            failed = len(documents) - successful

            logger.info(
                "Bulk index completed",
                entity_type=entity_type,
                total=len(documents),
                successful=successful,
                failed=failed,
            )

            return successful, failed

        except Exception as e:
            logger.error("Bulk index failed", error=str(e), entity_type=entity_type)
            return 0, len(documents)

    async def update_document(
        self,
        entity_type: SearchableEntity,
        tenant_id: str,
        entity_id: str,
        partial_document: dict[str, Any],
    ) -> bool:
        """Update a document partially."""
        es = await self._get_client()
        index_name = self._get_index_name(entity_type, tenant_id)

        try:
            await es.update(
                index=index_name,
                id=entity_id,
                doc=partial_document,
                refresh="wait_for",
            )
            return True
        except NotFoundError:
            logger.warning(
                "Document not found for update",
                entity_type=entity_type,
                entity_id=entity_id,
            )
            return False

    async def delete_document(
        self,
        entity_type: SearchableEntity,
        tenant_id: str,
        entity_id: str,
    ) -> bool:
        """Delete a document."""
        es = await self._get_client()
        index_name = self._get_index_name(entity_type, tenant_id)

        try:
            await es.delete(index=index_name, id=entity_id, refresh="wait_for")
            return True
        except NotFoundError:
            logger.warning(
                "Document not found for deletion",
                entity_type=entity_type,
                entity_id=entity_id,
            )
            return False

    # =========================================================================
    # Search Operations
    # =========================================================================

    async def search(
        self,
        entity_type: SearchableEntity,
        tenant_id: str,
        search_query: SearchQuery,
    ) -> SearchResponse:
        """
        Search documents.

        Args:
            entity_type: Type of entity to search
            tenant_id: Tenant ID for isolation
            search_query: Search query specification

        Returns:
            Search results with metadata
        """
        es = await self._get_client()
        index_name = self._get_index_name(entity_type, tenant_id)

        # Build Elasticsearch query
        es_query = self._build_query(search_query, tenant_id)

        # Build sort
        es_sort = self._build_sort(search_query.sort)

        # Calculate pagination
        from_offset = (search_query.page - 1) * search_query.page_size

        # Build highlight
        es_highlight = None
        if search_query.highlight and search_query.query:
            es_highlight = {"fields": {"*": {"fragment_size": 150, "number_of_fragments": 3}}}

        try:
            response = await es.search(
                index=index_name,
                query=es_query,
                sort=es_sort if es_sort else None,
                from_=from_offset,
                size=search_query.page_size,
                highlight=es_highlight,
            )

            # Parse results
            results = []
            for hit in response["hits"]["hits"]:
                results.append(
                    SearchResult(
                        entity_type=entity_type,
                        entity_id=hit["_id"],
                        score=hit["_score"],
                        data=hit["_source"],
                        highlights=hit.get("highlight"),
                    )
                )

            total = response["hits"]["total"]["value"]
            took_ms = response["took"]

            return SearchResponse(
                results=results,
                total=total,
                page=search_query.page,
                page_size=search_query.page_size,
                took_ms=took_ms,
                has_more=(from_offset + len(results)) < total,
            )

        except NotFoundError:
            logger.warning("Index not found", index=index_name)
            return SearchResponse(
                results=[],
                total=0,
                page=search_query.page,
                page_size=search_query.page_size,
                took_ms=0,
                has_more=False,
            )

    def _build_query(self, search_query: SearchQuery, tenant_id: str) -> dict[str, Any]:
        """Build Elasticsearch query from SearchQuery."""
        must_clauses: list[dict[str, Any]] = [{"term": {"tenant_id": tenant_id}}]
        must_not_clauses: list[dict[str, Any]] = []

        # Full-text search
        if search_query.query:
            must_clauses.append(
                {
                    "multi_match": {
                        "query": search_query.query,
                        "fields": ["search_text", "name^2", "email", "description"],
                        "type": "best_fields",
                        "fuzziness": "AUTO",
                    }
                }
            )

        # Field filters
        for filter_spec in search_query.filters:
            if filter_spec.operator == SearchOperator.NOT:
                must_not_clauses.append({"term": {filter_spec.field: filter_spec.value}})
            else:
                must_clauses.append({"term": {filter_spec.field: filter_spec.value}})

        query = {"bool": {"must": must_clauses}}

        if must_not_clauses:
            query["bool"]["must_not"] = must_not_clauses

        return query

    def _build_sort(self, sort_specs: list[Any]) -> list[dict[str, Any]] | None:
        """Build Elasticsearch sort from sort specifications."""
        if not sort_specs:
            return None

        es_sort = []
        for sort_spec in sort_specs:
            es_sort.append({sort_spec.field: {"order": sort_spec.order.value}})

        return es_sort

    # =========================================================================
    # Advanced Search Features
    # =========================================================================

    async def suggest(
        self,
        entity_type: SearchableEntity,
        tenant_id: str,
        prefix: str,
        field: str = "name",
        size: int = 10,
    ) -> list[SearchSuggestion]:
        """
        Get search suggestions (autocomplete).

        Args:
            entity_type: Type of entity
            tenant_id: Tenant ID
            prefix: Text prefix to match
            field: Field to search on
            size: Maximum suggestions to return

        Returns:
            List of search suggestions
        """
        es = await self._get_client()
        index_name = self._get_index_name(entity_type, tenant_id)

        try:
            response = await es.search(
                index=index_name,
                query={
                    "bool": {
                        "must": [
                            {"term": {"tenant_id": tenant_id}},
                            {"prefix": {f"{field}.keyword": prefix}},
                        ]
                    }
                },
                size=size,
                source={"includes": [field]},
            )

            suggestions: list[SearchSuggestion] = []
            for hit in response["hits"]["hits"]:
                suggestions.append(
                    SearchSuggestion(
                        text=hit["_source"].get(field, ""),
                        score=hit["_score"],
                        entity_type=entity_type,
                    )
                )

            return suggestions

        except NotFoundError:
            return []

    async def aggregate(
        self,
        entity_type: SearchableEntity,
        tenant_id: str,
        field: str,
        size: int = 10,
    ) -> AggregationResult:
        """
        Get aggregation results for a field.

        Args:
            entity_type: Type of entity
            tenant_id: Tenant ID
            field: Field to aggregate on
            size: Maximum buckets to return

        Returns:
            Aggregation results
        """
        es = await self._get_client()
        index_name = self._get_index_name(entity_type, tenant_id)

        try:
            response = await es.search(
                index=index_name,
                query={"term": {"tenant_id": tenant_id}},
                aggs={"field_agg": {"terms": {"field": field, "size": size}}},
                size=0,  # We only want aggregations
            )

            buckets = response["aggregations"]["field_agg"]["buckets"]

            return AggregationResult(field=field, buckets=buckets)

        except NotFoundError:
            return AggregationResult(field=field, buckets=[])
