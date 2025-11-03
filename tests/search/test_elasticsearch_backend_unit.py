import types
from typing import Any

import pytest

from dotmac.platform.search.elasticsearch_backend import (
    ElasticsearchBackend,
    NotFoundError,
    SearchQuery,
    SearchType,
)
from dotmac.platform.search.interfaces import SearchFilter

pytestmark = pytest.mark.unit


class StubIndices:
    def __init__(self) -> None:
        self.exists_result = False
        self.created: dict[str, Any] = {}
        self.deleted: list[str] = []
        self.delete_should_raise: Exception | None = None

    async def exists(self, index: str) -> bool:
        return self.exists_result

    async def create(self, index: str, body: dict[str, Any]) -> None:
        self.exists_result = True
        self.created[index] = body

    async def delete(self, index: str) -> bool:
        if self.delete_should_raise:
            raise self.delete_should_raise
        self.exists_result = False
        self.deleted.append(index)
        return True


class StubClient:
    def __init__(self) -> None:
        self.indices = StubIndices()
        self.index_calls: list[tuple[str, str, dict[str, Any], str]] = []
        self.update_calls: list[tuple[str, str, dict[str, Any], str]] = []
        self.delete_calls: list[tuple[str, str, str]] = []
        self.bulk_calls: list[dict[str, Any]] = []
        self.search_payloads: list[dict[str, Any]] = []
        self.search_result: dict[str, Any] | None = None
        self.closed = False

    async def close(self) -> None:
        self.closed = True

    async def index(self, index: str, id: str, document: dict[str, Any], refresh: str) -> None:
        self.index_calls.append((index, id, document, refresh))

    async def update(self, index: str, id: str, doc: dict[str, Any], refresh: str) -> None:
        self.update_calls.append((index, id, doc, refresh))

    async def delete(self, index: str, id: str, refresh: str) -> None:
        self.delete_calls.append((index, id, refresh))

    async def bulk(self, operations: list[dict[str, Any]], refresh: str) -> dict[str, Any]:
        self.bulk_calls.append({"operations": operations, "refresh": refresh})
        # Simulate every second entry being a document
        items = [{"index": {"status": 201}} for _ in range(len(operations) // 2)]
        return {"items": items}

    async def search(
        self,
        *,
        index: str,
        query: dict[str, Any],
        sort: list[dict[str, Any]] | None,
        from_: int,
        size: int,
        highlight: dict[str, Any] | None,
    ) -> dict[str, Any]:
        payload = {
            "index": index,
            "query": query,
            "sort": sort,
            "from": from_,
            "size": size,
            "highlight": highlight,
        }
        self.search_payloads.append(payload)
        if self.search_result is None:
            return {
                "hits": {"hits": [], "total": {"value": 0}},
                "took": 1,
            }
        return self.search_result


@pytest.fixture
def backend(monkeypatch: pytest.MonkeyPatch) -> tuple[ElasticsearchBackend, StubClient]:
    stub_client = StubClient()
    monkeypatch.setattr(
        "dotmac.platform.search.elasticsearch_backend.AsyncElasticsearch",
        lambda hosts=None: stub_client,
    )
    monkeypatch.setattr(
        "dotmac.platform.search.elasticsearch_backend.settings",
        types.SimpleNamespace(
            external_services=types.SimpleNamespace(elasticsearch_url="http://es")
        ),
    )
    backend = ElasticsearchBackend()
    return backend, stub_client


@pytest.mark.asyncio
async def test_create_index_creates_when_missing(
    backend: tuple[ElasticsearchBackend, StubClient],
) -> None:
    instance, client = backend
    created = await instance.create_index(
        "docs", mappings={"properties": {"field": {"type": "text"}}}
    )
    assert created is True
    assert client.indices.exists_result is True
    assert "docs" in client.indices.created


@pytest.mark.asyncio
async def test_create_index_returns_false_when_exists(
    backend: tuple[ElasticsearchBackend, StubClient],
) -> None:
    instance, client = backend
    client.indices.exists_result = True
    created = await instance.create_index("docs", mappings=None)
    assert created is False


@pytest.mark.asyncio
async def test_delete_index_handles_not_found(
    backend: tuple[ElasticsearchBackend, StubClient],
) -> None:
    instance, client = backend
    client.indices.delete_should_raise = NotFoundError(
        message="missing",
        meta=None,
        body={"error": "missing"},
    )
    deleted = await instance.delete_index("docs")
    assert deleted is False


@pytest.mark.asyncio
async def test_index_adds_search_text(backend: tuple[ElasticsearchBackend, StubClient]) -> None:
    instance, client = backend
    await instance.index("docs", "1", {"title": "Hello", "count": 5})
    assert client.index_calls
    _, _, document, _ = client.index_calls[0]
    assert "search_text" in document
    assert "Hello" in document["search_text"]


@pytest.mark.asyncio
async def test_bulk_index_counts_successful(
    backend: tuple[ElasticsearchBackend, StubClient],
) -> None:
    instance, client = backend
    count = await instance.bulk_index(
        "docs",
        [{"id": "1", "title": "One"}, {"id": "2", "title": "Two"}],
    )
    assert count == 2
    assert client.bulk_calls


@pytest.mark.asyncio
async def test_search_returns_results(backend: tuple[ElasticsearchBackend, StubClient]) -> None:
    instance, client = backend
    client.search_result = {
        "hits": {
            "hits": [
                {
                    "_id": "1",
                    "_score": 1.5,
                    "_source": {"type": "doc", "title": "Match"},
                    "highlight": {"title": ["Match"]},
                }
            ],
            "total": {"value": 1},
        },
        "took": 7,
    }

    query = SearchQuery(query="match", limit=5, include_score=True)
    response = await instance.search("docs", query)
    assert response.total == 1
    assert response.results[0].id == "1"
    assert response.results[0].score == 1.5
    assert client.search_payloads[0]["highlight"] is None


def test_build_query_handles_multiple_modes(
    backend: tuple[ElasticsearchBackend, StubClient],
) -> None:
    instance, _ = backend

    full_text = instance._build_query(SearchQuery(query="hello", limit=10))
    assert full_text["bool"]["must"]

    exact = instance._build_query(
        SearchQuery(query="hello", limit=10, search_type=SearchType.EXACT, fields=["name"])
    )
    assert exact["bool"]["must"][0]["term"]["name.keyword"] == "hello"

    prefix = instance._build_query(
        SearchQuery(query="he", limit=10, search_type=SearchType.PREFIX, filters=[])
    )
    assert "prefix" in prefix["bool"]["must"][0]

    fuzzy = instance._build_query(SearchQuery(query="helo", limit=10, search_type=SearchType.FUZZY))
    assert fuzzy["bool"]["must"][0]["fuzzy"]["search_text"]["value"] == "helo"

    with_filters = instance._build_query(
        SearchQuery(
            query="",
            limit=10,
            filters=[
                SearchFilter(field="status", value="active"),
                SearchFilter(field="tags", value=["a", "b"], operator="in"),
            ],
        )
    )
    must = with_filters["bool"]["must"]
    assert {"term": {"status": "active"}} in must
    assert {"terms": {"tags": ["a", "b"]}} in must
