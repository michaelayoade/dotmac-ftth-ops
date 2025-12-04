import types
from typing import Any

import pytest

from dotmac.platform.search.models_elasticsearch import (
    INDEX_MAPPINGS,
    SearchableEntity,
)
from dotmac.platform.search.service_elasticsearch import SearchService

pytestmark = pytest.mark.unit


class StubIndices:
    def __init__(self) -> None:
        self.exists_result = False
        self.created: dict[str, Any] = {}
        self.deleted: list[str] = []
        self.refreshed: list[str] = []

    async def exists(self, index: str) -> bool:
        return self.exists_result

    async def create(self, index: str, body: dict[str, Any]) -> None:
        self.exists_result = True
        self.created[index] = body

    async def delete(self, index: str) -> None:
        if not self.exists_result:
            from elasticsearch import NotFoundError

            raise NotFoundError(message="missing", meta=None, body=None)
        self.exists_result = False
        self.deleted.append(index)

    async def refresh(self, index: str) -> None:
        self.refreshed.append(index)


class StubClient:
    def __init__(self) -> None:
        self.indices = StubIndices()
        self.index_calls: list[tuple[str, str, dict[str, Any]]] = []
        self.bulk_calls: list[list[dict[str, Any]]] = []
        self.update_calls: list[tuple[str, str, dict[str, Any]]] = []
        self.delete_calls: list[tuple[str, str]] = []
        self.search_calls: list[dict[str, Any]] = []
        self.close_called = False

    async def close(self) -> None:
        self.close_called = True

    async def index(self, index: str, id: str, document: dict[str, Any], refresh: str) -> None:
        self.index_calls.append((index, id, document))

    async def bulk(self, operations: list[dict[str, Any]], refresh: str) -> dict[str, Any]:
        self.bulk_calls.append(operations)
        # Simulate success status for every index operation
        items = []
        for _entry in operations[::2]:
            items.append({"index": {"status": 201}})
        return {"items": items}

    async def update(self, index: str, id: str, doc: dict[str, Any], refresh: str) -> None:
        self.update_calls.append((index, id, doc))

    async def delete(self, index: str, id: str, refresh: str) -> None:
        self.delete_calls.append((index, id))

    async def search(
        self,
        *,
        index: str,
        query: dict[str, Any],
        from_: int,
        size: int,
        sort: list[dict[str, Any]] | None = None,
        highlight: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        self.search_calls.append(
            {"index": index, "query": query, "from": from_, "size": size, "sort": sort}
        )
        return {
            "hits": {"hits": [], "total": {"value": 0}},
            "took": 1,
        }


@pytest.fixture
def service(monkeypatch: pytest.MonkeyPatch) -> tuple[SearchService, StubClient]:
    stub_client = StubClient()
    monkeypatch.setattr(
        "dotmac.platform.search.service_elasticsearch.settings",
        types.SimpleNamespace(elasticsearch_url="http://es"),
    )
    svc = SearchService(es_client=stub_client)
    return svc, stub_client


@pytest.mark.asyncio
async def test_create_index_uses_mapping(service: tuple[SearchService, StubClient]) -> None:
    svc, client = service
    created = await svc.create_index(SearchableEntity.CUSTOMER, tenant_id="tenant-1")
    assert created is True
    assert client.indices.created
    index_name = svc._get_index_name(SearchableEntity.CUSTOMER, "tenant-1")
    assert (
        client.indices.created[index_name]["mappings"] == INDEX_MAPPINGS[SearchableEntity.CUSTOMER]
    )


@pytest.mark.asyncio
async def test_create_index_returns_false_when_exists(
    service: tuple[SearchService, StubClient],
) -> None:
    svc, client = service
    client.indices.exists_result = True
    created = await svc.create_index(SearchableEntity.CUSTOMER, tenant_id="tenant-1")
    assert created is False


@pytest.mark.asyncio
async def test_index_document_sets_tenant(service: tuple[SearchService, StubClient]) -> None:
    svc, client = service
    await svc.index_document(
        SearchableEntity.CUSTOMER,
        tenant_id="tenant-1",
        entity_id="cust-1",
        document={"name": "Test"},
    )
    assert client.index_calls
    index, entity_id, document = client.index_calls[0]
    assert entity_id == "cust-1"
    assert document["tenant_id"] == "tenant-1"
    assert index.endswith("tenant-1")


@pytest.mark.asyncio
async def test_bulk_index_documents_returns_counts(
    service: tuple[SearchService, StubClient],
) -> None:
    svc, client = service
    success, failed = await svc.bulk_index_documents(
        SearchableEntity.CUSTOMER,
        tenant_id="tenant-1",
        documents=[{"id": "1", "name": "One"}, {"id": "2", "name": "Two"}],
    )
    assert success == 2
    assert failed == 0
    assert client.bulk_calls


@pytest.mark.asyncio
async def test_refresh_and_delete(service: tuple[SearchService, StubClient]) -> None:
    svc, client = service
    # Refresh should trigger indices.refresh
    await svc.refresh_index(SearchableEntity.CUSTOMER, "tenant-1")
    assert client.indices.refreshed

    # Delete when index absent should log and return False
    removed = await svc.delete_index(SearchableEntity.CUSTOMER, "tenant-1")
    assert removed is False


@pytest.mark.asyncio
async def test_close_closes_client(service: tuple[SearchService, StubClient]) -> None:
    svc, client = service
    await svc.close()
    assert client.close_called is True
