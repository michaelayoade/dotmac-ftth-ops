import json

import pytest

from dotmac.platform.realtime.sse import CombinedEventStream


class FakePubSub:
    def __init__(self):
        self.subscribed_channels: tuple[str, ...] | None = None
        self.unsubscribed_channels: tuple[str, ...] | None = None
        self._messages = [
            {
                "type": "message",
                "channel": "alerts:tenant1",
                "data": json.dumps({"event_type": "alert"}),
            },
            {"type": "unsubscribe", "channel": "alerts:tenant1"},
        ]

    async def subscribe(self, *channels: str) -> None:
        self.subscribed_channels = channels

    async def unsubscribe(self, *channels: str) -> None:
        self.unsubscribed_channels = channels or self.subscribed_channels

    async def close(self) -> None:
        return None

    async def get_message(self, ignore_subscribe_messages: bool = False, timeout: float = 1.0):
        if not self._messages:
            return None
        return self._messages.pop(0)


class FakeRedis:
    def __init__(self):
        self.pubsub_instance = FakePubSub()

    def pubsub(self) -> FakePubSub:
        return self.pubsub_instance


@pytest.mark.asyncio
async def test_combined_stream_multiplexes_channels() -> None:
    redis = FakeRedis()
    stream = CombinedEventStream(redis, "tenant1")
    generator = stream.stream()

    connected = await anext(generator)
    assert connected["event"] == "connected"
    assert json.loads(connected["data"])["channels"] == [
        "alerts:tenant1",
        "onu_status:tenant1",
        "tickets:tenant1",
        "subscribers:tenant1",
        "radius_sessions:tenant1",
    ]

    payload = await anext(generator)
    parsed = json.loads(payload["data"])
    assert parsed["source"] == "alerts:tenant1"
    assert parsed["event_type"] == "alert"

    with pytest.raises(StopAsyncIteration):
        await anext(generator)
