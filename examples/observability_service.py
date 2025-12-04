#!/usr/bin/env python3
"""
Test service to demonstrate ObservabilityManager functionality.

This service includes:
- Full observability setup with ObservabilityManager
- Sample endpoints to test tracing, metrics, and logging
- Health check endpoint
- Metrics endpoint
"""

import asyncio
import random
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse, PlainTextResponse
from pydantic import BaseModel

from dotmac.platform.observability import ObservabilityManager


# Request/Response models
class ItemCreate(BaseModel):
    name: str
    description: str | None = None
    price: float
    quantity: int = 1


class ItemResponse(BaseModel):
    id: int
    name: str
    description: str | None
    price: float
    quantity: int
    created_at: float


# Global ObservabilityManager instance
observability_mgr: ObservabilityManager | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager."""
    global observability_mgr

    # Initialize ObservabilityManager
    observability_mgr = ObservabilityManager(
        service_name="test-observability-service",
        environment="development",
        otlp_endpoint="http://localhost:4317",  # Default OTLP endpoint
        log_level="INFO",
        enable_tracing=True,
        enable_metrics=True,
        enable_logging=True,
        enable_performance=True,
        enable_security=True,
        trace_sampler_ratio=1.0,  # Sample all traces in dev
        slow_request_threshold=500.0,  # 500ms threshold
    )

    # Initialize all components
    observability_mgr.initialize()

    # Get logger
    logger = observability_mgr.get_logger()
    logger.info("Service starting up", version="1.0.0", environment="development")

    # Apply middleware to the app
    observability_mgr.apply_middleware(app)

    yield

    # Shutdown
    logger.info("Service shutting down")
    observability_mgr.shutdown()


# Create FastAPI app
app = FastAPI(
    title="Test Observability Service",
    description="Service to test ObservabilityManager functionality",
    version="1.0.0",
    lifespan=lifespan,
)


# In-memory storage for demo
items_db = {}
next_id = 1


@app.get("/")
async def root():
    """Root endpoint."""
    return {"message": "Test Observability Service", "status": "running"}


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "service": "test-observability-service", "timestamp": time.time()}


@app.get("/metrics", response_class=PlainTextResponse)
async def metrics():
    """Metrics endpoint (OTLP export)."""
    if observability_mgr:
        metrics_registry = observability_mgr.get_metrics_registry()
        if metrics_registry:
            return "# Metrics are exported via OTLP\n# Check your OTLP collector for data"
    return "# Metrics not available"


@app.post("/items", response_model=ItemResponse)
async def create_item(item: ItemCreate, request: Request):
    """Create a new item."""
    global next_id

    # Get logger from ObservabilityManager
    logger = observability_mgr.get_logger() if observability_mgr else None

    # Simulate some processing time
    await asyncio.sleep(random.uniform(0.01, 0.1))

    # Random failure for testing error handling
    if random.random() < 0.1:  # 10% failure rate
        if logger:
            logger.error("Failed to create item", item_name=item.name, error="Random failure")
        raise HTTPException(status_code=500, detail="Random failure occurred")

    # Create item
    item_id = next_id
    next_id += 1

    new_item = ItemResponse(
        id=item_id,
        name=item.name,
        description=item.description,
        price=item.price,
        quantity=item.quantity,
        created_at=time.time(),
    )

    items_db[item_id] = new_item

    if logger:
        logger.info("Item created", item_id=item_id, item_name=item.name, price=item.price)

    return new_item


@app.get("/items/{item_id}", response_model=ItemResponse)
async def get_item(item_id: int, request: Request):
    """Get an item by ID."""
    logger = observability_mgr.get_logger() if observability_mgr else None

    # Simulate some processing time
    await asyncio.sleep(random.uniform(0.01, 0.05))

    if item_id not in items_db:
        if logger:
            logger.warning("Item not found", item_id=item_id)
        raise HTTPException(status_code=404, detail="Item not found")

    if logger:
        logger.info("Item retrieved", item_id=item_id)

    return items_db[item_id]


@app.get("/items")
async def list_items(request: Request):
    """List all items."""
    logger = observability_mgr.get_logger() if observability_mgr else None

    # Simulate some processing time
    await asyncio.sleep(random.uniform(0.01, 0.05))

    if logger:
        logger.info("Items listed", count=len(items_db))

    return {"items": list(items_db.values()), "total": len(items_db)}


@app.get("/slow")
async def slow_endpoint(request: Request):
    """Intentionally slow endpoint for testing performance monitoring."""
    logger = observability_mgr.get_logger() if observability_mgr else None

    # Simulate slow processing
    delay = random.uniform(0.8, 1.5)  # 800-1500ms

    if logger:
        logger.info("Starting slow operation", expected_delay=delay)

    await asyncio.sleep(delay)

    return {"message": "Slow operation completed", "delay": delay}


@app.get("/error")
async def error_endpoint(request: Request):
    """Endpoint that always fails for testing error handling."""
    logger = observability_mgr.get_logger() if observability_mgr else None

    if logger:
        logger.error("Intentional error triggered")

    raise HTTPException(status_code=500, detail="This endpoint always fails")


@app.get("/trace-test")
async def trace_test(request: Request):
    """Test distributed tracing with nested operations."""
    logger = observability_mgr.get_logger() if observability_mgr else None
    observability_mgr.get_tracing_manager() if observability_mgr else None

    if logger:
        logger.info("Starting trace test")

    # Simulate nested operations
    result = {"operations": []}

    # Operation 1: Database query simulation
    start = time.time()
    await asyncio.sleep(0.05)
    result["operations"].append(
        {"name": "database_query", "duration_ms": (time.time() - start) * 1000}
    )

    # Operation 2: External API call simulation
    start = time.time()
    await asyncio.sleep(0.1)
    result["operations"].append(
        {"name": "external_api_call", "duration_ms": (time.time() - start) * 1000}
    )

    # Operation 3: Cache lookup simulation
    start = time.time()
    await asyncio.sleep(0.02)
    result["operations"].append(
        {"name": "cache_lookup", "duration_ms": (time.time() - start) * 1000}
    )

    if logger:
        logger.info("Trace test completed", operations=len(result["operations"]))

    return result


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Global exception handler with observability."""
    logger = observability_mgr.get_logger() if observability_mgr else None

    if logger:
        logger.error(
            "Unhandled exception",
            error=str(exc),
            error_type=type(exc).__name__,
            path=request.url.path,
            method=request.method,
        )

    return JSONResponse(
        status_code=500, content={"detail": "Internal server error", "type": type(exc).__name__}
    )


if __name__ == "__main__":
    import uvicorn

    print("=" * 60)
    print("Starting Test Observability Service")
    print("=" * 60)
    print("\nService will be available at: http://localhost:8000")
    print("\nAvailable endpoints:")
    print("  GET  /          - Root endpoint")
    print("  GET  /health    - Health check")
    print("  GET  /metrics   - Metrics endpoint")
    print("  POST /items     - Create an item")
    print("  GET  /items     - List all items")
    print("  GET  /items/{id}- Get item by ID")
    print("  GET  /slow      - Slow endpoint (tests performance monitoring)")
    print("  GET  /error     - Error endpoint (always fails)")
    print("  GET  /trace-test- Test distributed tracing")
    print("\nPress Ctrl+C to stop the service")
    print("=" * 60)

    # Run the service
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info", access_log=True)
