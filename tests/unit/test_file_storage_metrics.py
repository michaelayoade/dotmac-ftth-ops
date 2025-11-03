from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest

from dotmac.platform.file_storage.metrics_router import _get_file_stats_cached
from dotmac.platform.file_storage.service import FileMetadata

pytestmark = pytest.mark.unit


class StubStorageService:
    """Stub storage service that returns batches of files based on offset."""

    def __init__(self, batches):
        self._batches = batches
        self.calls: list[tuple[int, int]] = []

    async def list_files(self, *, tenant_id=None, limit=500, offset=0, path=None):
        self.calls.append((limit, offset))
        index = 0
        if limit:
            index = offset // limit
        return self._batches[index] if index < len(self._batches) else []


@pytest.mark.asyncio
async def test_metrics_iterates_all_batches():
    now = datetime.now(UTC)
    recent = now - timedelta(days=1)
    batches = [
        [
            FileMetadata(
                file_id=str(uuid4()),
                file_name="file0.txt",
                file_size=100,
                content_type="text/plain",
                created_at=recent,
            )
            for _ in range(500)
        ],
        [
            FileMetadata(
                file_id=str(uuid4()),
                file_name="file1.txt",
                file_size=200,
                content_type="image/png",
                created_at=recent,
            )
            for _ in range(500)
        ],
        [
            FileMetadata(
                file_id=str(uuid4()),
                file_name="file2.txt",
                file_size=300,
                content_type="application/pdf",
                created_at=recent,
            )
            for _ in range(100)
        ],
    ]

    storage = StubStorageService(batches)

    result = await _get_file_stats_cached.__wrapped__(
        period_days=30,
        tenant_id="tenant",
        storage_service=storage,
    )

    assert result["total_files"] == 1100
    assert result["total_size_bytes"] == (500 * 100) + (500 * 200) + (100 * 300)
    assert storage.calls == [(500, 0), (500, 500), (500, 1000)]
