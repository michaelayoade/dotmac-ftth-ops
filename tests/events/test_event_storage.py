"""Tests for Redis-backed EventStorage indexing behaviour."""

from __future__ import annotations

from collections import defaultdict

import pytest

from dotmac.platform.events.models import Event, EventStatus
from dotmac.platform.events.storage import EventStorage

pytestmark = pytest.mark.unit


class FakeRedis:
    """Minimal Redis client shim for testing indexing logic."""

    def __init__(self) -> None:
        self.store: dict[str, str] = {}
        self.sorted_sets: dict[str, dict[str, float]] = defaultdict(dict)

    # Key-value operations -------------------------------------------------
    def setex(self, key: str, ttl: int, value: str) -> None:
        self.store[key] = value

    def get(self, key: str) -> str | None:
        return self.store.get(key)

    def publish(self, channel: str, message: str) -> None:  # pragma: no cover - noop
        return None

    # Sorted-set operations ------------------------------------------------
    def zadd(self, key: str, mapping: dict[str, float]) -> int:
        zset = self.sorted_sets.setdefault(key, {})
        new_members = 0
        for member, score in mapping.items():
            if member not in zset:
                new_members += 1
            zset[member] = score
        return new_members

    def expire(self, key: str, ttl: int) -> bool:  # pragma: no cover - noop
        return True

    def zrem(self, key: str, member: str) -> int:
        zset = self.sorted_sets.get(key)
        if not zset or member not in zset:
            return 0
        del zset[member]
        return 1

    def zrevrange(self, key: str, start: int, end: int) -> list[bytes]:
        zset = self.sorted_sets.get(key, {})
        if not zset:
            return []

        members_sorted = sorted(zset.items(), key=lambda item: item[1], reverse=True)
        # Redis treats end as inclusive; adjust Python slicing accordingly
        inclusive_end = None if end == -1 else end + 1
        slice_members = [member for member, _ in members_sorted][start:inclusive_end]
        return [member.encode() for member in slice_members]


@pytest.mark.asyncio
async def test_redis_indices_clean_up_on_status_change(monkeypatch):
    fake_redis = FakeRedis()
    monkeypatch.setattr("dotmac.platform.events.storage.get_redis", lambda: fake_redis)

    storage = EventStorage(use_redis=True)
    event = Event(
        event_type="billing.invoice.created", payload={}, metadata={"tenant_id": "tenant-1"}
    )

    await storage.save_event(event)

    assert event.event_id in fake_redis.sorted_sets["events:status:pending"]
    assert event.event_id in fake_redis.sorted_sets["events:type:billing.invoice.created"]
    assert event.event_id in fake_redis.sorted_sets["events:tenant:tenant-1"]
    assert event.event_id in fake_redis.sorted_sets["events:all"]

    event.status = EventStatus.COMPLETED
    await storage.update_event(event)

    assert event.event_id not in fake_redis.sorted_sets["events:status:pending"]
    assert event.event_id in fake_redis.sorted_sets["events:status:completed"]
    # Type and tenant indices should be re-populated for the updated record
    assert event.event_id in fake_redis.sorted_sets["events:type:billing.invoice.created"]
    assert event.event_id in fake_redis.sorted_sets["events:tenant:tenant-1"]
    assert event.event_id in fake_redis.sorted_sets["events:all"]


@pytest.mark.asyncio
async def test_query_without_filters_reads_all_index(monkeypatch):
    fake_redis = FakeRedis()
    monkeypatch.setattr("dotmac.platform.events.storage.get_redis", lambda: fake_redis)

    storage = EventStorage(use_redis=True)

    event_a = Event(event_type="alpha.event", payload={})
    event_b = Event(event_type="beta.event", payload={})

    await storage.save_event(event_a)
    await storage.save_event(event_b)

    results = await storage.query_events()

    assert {e.event_id for e in results} == {event_a.event_id, event_b.event_id}
