"""
Performance and load tests for GenieACS Client

Tests client performance with large numbers of devices,
connection pooling efficiency, and scalability.
"""

import asyncio
import time

import pytest
import pytest_asyncio
from aiohttp import web

from dotmac.platform.genieacs.client import GenieACSClient

pytestmark = pytest.mark.unit


@pytest_asyncio.fixture
async def performance_genieacs_server(aiohttp_server):
    """
    Mock GenieACS server with 1000+ devices for performance testing.
    """
    # Generate 1000 mock devices
    mock_devices = [
        {
            "_id": f"device-{i:04d}",
            "_lastInform": 1234567890000 + i,
            "InternetGatewayDevice.DeviceInfo.SerialNumber": f"SN{i:06d}",
            "InternetGatewayDevice.DeviceInfo.ModelName": "HG8245H",
            "InternetGatewayDevice.DeviceInfo.SoftwareVersion": "V5R021C00S125",
        }
        for i in range(1000)
    ]

    # Track request counts
    request_stats = {
        "total_requests": 0,
        "get_devices": 0,
        "get_device": 0,
        "create_task": 0,
        "start_time": None,
    }

    async def get_devices(request):
        """GET /devices - List devices with pagination"""
        request_stats["total_requests"] += 1
        request_stats["get_devices"] += 1

        # Parse query params
        limit = int(request.query.get("limit", 100))
        skip = int(request.query.get("skip", 0))

        # Apply pagination
        paginated = mock_devices[skip : skip + limit]
        return web.json_response(paginated)

    async def get_device(request):
        """GET /devices/{device_id} - Get single device"""
        request_stats["total_requests"] += 1
        request_stats["get_device"] += 1

        device_id = request.match_info["device_id"]
        device = next((d for d in mock_devices if d["_id"] == device_id), None)

        if device is None:
            return web.json_response({"error": "Device not found"}, status=404)

        return web.json_response(device)

    async def create_task(request):
        """POST /devices/{device_id}/tasks - Create task"""
        request_stats["total_requests"] += 1
        request_stats["create_task"] += 1

        device_id = request.match_info["device_id"]
        task_data = await request.json()

        return web.json_response(
            {
                "_id": f"task-{request_stats['create_task']}",
                "device": device_id,
                "name": task_data.get("name"),
                "timestamp": int(time.time() * 1000),
            },
            status=200,
        )

    # Create app with routes
    app = web.Application()
    app.router.add_get("/devices", get_devices)
    app.router.add_get("/devices/{device_id}", get_device)
    app.router.add_post("/devices/{device_id}/tasks", create_task)

    # Store stats on app for test access
    app["request_stats"] = request_stats
    app["mock_devices"] = mock_devices

    server = await aiohttp_server(app)
    request_stats["start_time"] = time.time()
    return server


@pytest.fixture
def reset_circuit_breaker():
    """Reset circuit breaker state before each test"""
    from dotmac.platform.core.http_client import RobustHTTPClient

    RobustHTTPClient._circuit_breakers.clear()
    yield
    RobustHTTPClient._circuit_breakers.clear()


class TestGenieACSPerformance:
    """Performance tests for GenieACS client"""

    @pytest.mark.asyncio
    @pytest.mark.slow
    @pytest.mark.performance
    async def test_list_1000_devices_paginated(
        self, performance_genieacs_server, reset_circuit_breaker
    ):
        """Test listing 1000 devices with pagination"""
        client = GenieACSClient(base_url=str(performance_genieacs_server.make_url("/")))

        all_devices = []
        page_size = 100
        total_pages = 10

        start_time = time.time()

        # Fetch all devices with pagination
        for page_num in range(total_pages):
            devices = await client.get_devices(limit=page_size, skip=page_num * page_size)
            all_devices.extend(devices)

        elapsed_time = time.time() - start_time

        # Assertions
        assert len(all_devices) == 1000
        assert elapsed_time < 5.0  # Should complete in under 5 seconds
        print(
            f"\n✓ Listed 1000 devices in {elapsed_time:.2f}s ({len(all_devices) / elapsed_time:.0f} devices/sec)"
        )

    @pytest.mark.asyncio
    @pytest.mark.slow
    @pytest.mark.performance
    async def test_concurrent_device_fetches(
        self, performance_genieacs_server, reset_circuit_breaker
    ):
        """Test fetching 100 devices concurrently"""
        client = GenieACSClient(base_url=str(performance_genieacs_server.make_url("/")))

        start_time = time.time()

        # Fetch 100 different devices concurrently
        device_ids = [f"device-{i:04d}" for i in range(100)]
        tasks = [client.get_device(device_id) for device_id in device_ids]

        results = await asyncio.gather(*tasks)

        elapsed_time = time.time() - start_time

        # Assertions
        assert len(results) == 100
        assert all(device is not None for device in results)
        assert elapsed_time < 3.0  # Should complete in under 3 seconds
        print(
            f"\n✓ Fetched 100 devices concurrently in {elapsed_time:.2f}s ({100 / elapsed_time:.0f} req/sec)"
        )

    @pytest.mark.asyncio
    @pytest.mark.slow
    @pytest.mark.performance
    async def test_concurrent_task_creation(
        self, performance_genieacs_server, reset_circuit_breaker
    ):
        """Test creating 50 tasks concurrently"""
        client = GenieACSClient(base_url=str(performance_genieacs_server.make_url("/")))

        start_time = time.time()

        # Create 50 tasks concurrently
        device_ids = [f"device-{i:04d}" for i in range(50)]
        tasks = [
            client.create_task(device_id, "refreshObject", {"objectName": "InternetGatewayDevice."})
            for device_id in device_ids
        ]

        results = await asyncio.gather(*tasks)

        elapsed_time = time.time() - start_time

        # Assertions
        assert len(results) == 50
        assert all(task.get("device") == device_ids[i] for i, task in enumerate(results))
        assert elapsed_time < 3.0  # Should complete in under 3 seconds
        print(
            f"\n✓ Created 50 tasks concurrently in {elapsed_time:.2f}s ({50 / elapsed_time:.0f} tasks/sec)"
        )

    @pytest.mark.asyncio
    @pytest.mark.slow
    @pytest.mark.performance
    async def test_connection_pool_efficiency(
        self, performance_genieacs_server, reset_circuit_breaker
    ):
        """Test connection pooling efficiency with sequential requests"""
        client = GenieACSClient(base_url=str(performance_genieacs_server.make_url("/")))

        start_time = time.time()

        # Make 100 sequential requests (should reuse connections)
        for i in range(100):
            device = await client.get_device(f"device-{i:04d}")
            assert device is not None

        elapsed_time = time.time() - start_time

        # With connection pooling, this should be much faster than without
        assert elapsed_time < 5.0  # Should complete in under 5 seconds
        print(
            f"\n✓ Made 100 sequential requests in {elapsed_time:.2f}s ({100 / elapsed_time:.0f} req/sec)"
        )

    @pytest.mark.asyncio
    @pytest.mark.slow
    @pytest.mark.performance
    async def test_mixed_workload(self, performance_genieacs_server, reset_circuit_breaker):
        """Test mixed workload (list, get, create) concurrently"""
        client = GenieACSClient(base_url=str(performance_genieacs_server.make_url("/")))

        start_time = time.time()

        # Create mixed workload
        tasks = []

        # 10 list operations
        for i in range(10):
            tasks.append(client.get_devices(limit=50, skip=i * 50))

        # 20 get device operations
        for i in range(20):
            tasks.append(client.get_device(f"device-{i:04d}"))

        # 10 task creation operations
        for i in range(10):
            tasks.append(
                client.create_task(
                    f"device-{i:04d}", "refreshObject", {"objectName": "InternetGatewayDevice."}
                )
            )

        results = await asyncio.gather(*tasks)

        elapsed_time = time.time() - start_time

        # Assertions
        assert len(results) == 40
        assert elapsed_time < 5.0  # Should complete in under 5 seconds
        print(
            f"\n✓ Executed mixed workload (40 operations) in {elapsed_time:.2f}s ({40 / elapsed_time:.0f} ops/sec)"
        )

    @pytest.mark.asyncio
    @pytest.mark.slow
    @pytest.mark.performance
    async def test_large_page_retrieval(self, performance_genieacs_server, reset_circuit_breaker):
        """Test retrieving large pages of devices"""
        client = GenieACSClient(base_url=str(performance_genieacs_server.make_url("/")))

        start_time = time.time()

        # Fetch 500 devices in a single request
        devices = await client.get_devices(limit=500)

        elapsed_time = time.time() - start_time

        # Assertions
        assert len(devices) == 500
        assert elapsed_time < 2.0  # Should complete in under 2 seconds
        print(f"\n✓ Retrieved 500 devices in single request in {elapsed_time:.2f}s")

    @pytest.mark.asyncio
    @pytest.mark.slow
    @pytest.mark.performance
    async def test_request_throughput(self, performance_genieacs_server, reset_circuit_breaker):
        """Test maximum request throughput"""
        client = GenieACSClient(base_url=str(performance_genieacs_server.make_url("/")))

        num_requests = 200
        start_time = time.time()

        # Make 200 concurrent requests
        tasks = [client.get_devices(limit=1) for _ in range(num_requests)]
        results = await asyncio.gather(*tasks)

        elapsed_time = time.time() - start_time
        throughput = num_requests / elapsed_time

        # Assertions
        assert len(results) == num_requests
        assert throughput > 20  # Should achieve at least 20 req/sec
        print(f"\n✓ Achieved {throughput:.0f} req/sec throughput with {num_requests} requests")

    @pytest.mark.asyncio
    @pytest.mark.slow
    @pytest.mark.performance
    async def test_sustained_load(self, performance_genieacs_server, reset_circuit_breaker):
        """Test sustained load over multiple rounds"""
        client = GenieACSClient(base_url=str(performance_genieacs_server.make_url("/")))

        rounds = 5
        requests_per_round = 20
        rounds * requests_per_round

        start_time = time.time()

        for _round_num in range(rounds):
            tasks = [client.get_device(f"device-{i:04d}") for i in range(requests_per_round)]
            results = await asyncio.gather(*tasks)
            assert len(results) == requests_per_round

        elapsed_time = time.time() - start_time
        avg_time_per_round = elapsed_time / rounds

        # Assertions
        assert avg_time_per_round < 2.0  # Each round should complete in under 2 seconds
        print(
            f"\n✓ Sustained {rounds} rounds of {requests_per_round} requests in {elapsed_time:.2f}s"
        )
        print(f"  Average: {avg_time_per_round:.2f}s per round")


class TestGenieACSScalability:
    """Test scalability characteristics"""

    @pytest.mark.asyncio
    @pytest.mark.slow
    @pytest.mark.performance
    async def test_scaling_concurrent_requests(
        self, performance_genieacs_server, reset_circuit_breaker
    ):
        """Test how performance scales with increasing concurrency"""
        client = GenieACSClient(base_url=str(performance_genieacs_server.make_url("/")))

        concurrency_levels = [10, 25, 50, 100]
        results_summary = []

        for concurrency in concurrency_levels:
            start_time = time.time()

            tasks = [client.get_device(f"device-{i:04d}") for i in range(concurrency)]
            results = await asyncio.gather(*tasks)

            elapsed_time = time.time() - start_time
            throughput = concurrency / elapsed_time

            results_summary.append(
                {
                    "concurrency": concurrency,
                    "elapsed_time": elapsed_time,
                    "throughput": throughput,
                }
            )

            assert len(results) == concurrency

        # Print scaling results
        print("\n✓ Concurrency scaling results:")
        for result in results_summary:
            print(
                f"  {result['concurrency']:3d} requests: {result['elapsed_time']:.2f}s ({result['throughput']:.0f} req/sec)"
            )

        # Verify reasonable scaling (throughput should increase with concurrency)
        assert results_summary[-1]["throughput"] > results_summary[0]["throughput"]

    @pytest.mark.asyncio
    @pytest.mark.slow
    @pytest.mark.performance
    async def test_memory_efficiency(self, performance_genieacs_server, reset_circuit_breaker):
        """Test memory efficiency with large result sets"""
        client = GenieACSClient(base_url=str(performance_genieacs_server.make_url("/")))

        # Fetch all 1000 devices in chunks
        all_devices = []
        chunk_size = 250

        for i in range(0, 1000, chunk_size):
            devices = await client.get_devices(limit=chunk_size, skip=i)
            all_devices.extend(devices)

        # Assertions
        assert len(all_devices) == 1000
        # Memory should not grow excessively (this is mainly observational)
        print(f"\n✓ Fetched {len(all_devices)} devices efficiently in chunks")
