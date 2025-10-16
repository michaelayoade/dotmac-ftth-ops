# Celery Lifecycle + Frontend Real-Time Integration

**Date:** 2025-10-16
**Status:** 📋 Design Complete - Ready for Implementation

## Overview

This document outlines the integration between Celery background workflows and frontend real-time updates for service lifecycle operations (provisioning, suspension, termination).

---

## Current State

### Backend Lifecycle Workflows

**File:** `src/dotmac/platform/services/lifecycle/tasks.py:36`

```python
async def _execute_provisioning_workflow(
    service_instance_id: str,
    tenant_id: str
) -> dict[str, Any]:
    """
    Execute multi-step provisioning workflow.

    Steps:
    1. Validate service configuration
    2. Allocate network resources (IP, VLAN)
    3. Configure network equipment (ONT, router)
    4. Activate service in provisioning systems (RADIUS)
    5. Test connectivity and performance
    6. Complete provisioning
    """
    async with get_async_session_context() as session:
        service = LifecycleOrchestrationService(session)

        # Step 1: Validation
        service_instance.provisioning_status = ProvisioningStatus.VALIDATING
        await session.commit()

        # ... workflow steps
```

**Issue:** Status updates only saved to database, no real-time events emitted

### Frontend Service Hooks

**File:** `frontend/apps/base-app/hooks/useServiceLifecycle.ts:36`

```typescript
export function useServiceStatistics(): UseQueryResult<ServiceStatistics, Error> {
  return useQuery({
    queryKey: ['services', 'statistics'],
    queryFn: async () => {
      const response = await apiClient.get<ServiceStatistics>(
        '/api/v1/services/lifecycle/statistics'
      );
      return extractDataOrThrow(response);
    },
    staleTime: 60_000, // 60 seconds
  });
}
```

**Issue:** Polling-based (60s interval), no real-time updates

---

## Proposed Architecture

### Event-Driven Real-Time Updates

```
┌─────────────────────────────────────────────────────────────┐
│                    Celery Worker                             │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Provisioning Workflow Task                            │ │
│  │                                                        │ │
│  │  1. Update status → VALIDATING                        │ │
│  │  2. Emit event → service.provisioning.progress        │ │
│  │  3. Update status → PROVISIONING                      │ │
│  │  4. Emit event → service.provisioning.progress        │ │
│  │  5. Update status → TESTING                           │ │
│  │  6. Emit event → service.provisioning.progress        │ │
│  │  7. Update status → COMPLETED                         │ │
│  │  8. Emit event → service.provisioning.completed       │ │
│  └────────────────────────────────────────────────────────┘ │
│                            │                                 │
└────────────────────────────┼─────────────────────────────────┘
                             │
                             ▼
                    ┌────────────────────┐
                    │   EventBus/Redis   │
                    │                    │
                    │  - Publish events  │
                    │  - Fan out to SSE  │
                    └────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                    SSE Real-Time Router                      │
│                                                              │
│  GET /api/v1/realtime/service-lifecycle/{service_id}        │
│                                                              │
│  - Subscribe to service.provisioning.progress events        │
│  - Filter by service_id and tenant_id                       │
│  - Stream to connected clients                              │
└─────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                    Frontend React Hook                       │
│                                                              │
│  useServiceWorkflowProgress(serviceId)                      │
│                                                              │
│  - Create SSE connection                                    │
│  - Subscribe to progress events                             │
│  - Update UI in real-time                                   │
└─────────────────────────────────────────────────────────────┘
```

---

## Implementation Plan

### Phase 1: Backend Event Publishing

#### 1.1 Update Lifecycle Workflow to Emit Events

**File:** `src/dotmac/platform/services/lifecycle/tasks.py`

```python
from ..events.bus import event_bus

async def _execute_provisioning_workflow(
    service_instance_id: str,
    tenant_id: str
) -> dict[str, Any]:
    """Execute provisioning workflow with real-time events."""

    async with get_async_session_context() as session:
        service = LifecycleOrchestrationService(session)
        service_id = UUID(service_instance_id)

        # Helper to emit progress
        async def emit_progress(step: int, total: int, status: str, message: str):
            await event_bus.publish(
                event_type="service.provisioning.progress",
                data={
                    "service_instance_id": service_instance_id,
                    "tenant_id": tenant_id,
                    "step": step,
                    "total_steps": total,
                    "status": status,
                    "message": message,
                    "timestamp": datetime.now(UTC).isoformat(),
                },
                tenant_id=tenant_id,
            )

        total_steps = 6

        # Step 1: Validation
        await emit_progress(1, total_steps, "validating", "Validating service configuration")
        service_instance.provisioning_status = ProvisioningStatus.VALIDATING
        await session.commit()

        validation_result = await _validate_service_config(service_instance, session)
        if not validation_result["success"]:
            await emit_progress(1, total_steps, "failed", f"Validation failed: {validation_result['error']}")
            return validation_result

        # Step 2: Network allocation
        await emit_progress(2, total_steps, "allocating", "Allocating network resources")
        service_instance.provisioning_status = ProvisioningStatus.PROVISIONING
        await session.commit()

        # ... continue for all steps

        # Final step: Complete
        await emit_progress(6, total_steps, "completed", "Provisioning completed successfully")
        service_instance.provisioning_status = ProvisioningStatus.COMPLETED
        await session.commit()

        # Emit completion event
        await event_bus.publish(
            event_type="service.provisioning.completed",
            data={
                "service_instance_id": service_instance_id,
                "tenant_id": tenant_id,
                "completed_at": datetime.now(UTC).isoformat(),
            },
            tenant_id=tenant_id,
        )

        return {"success": True, "service_instance_id": service_instance_id}
```

#### 1.2 Create Real-Time SSE Endpoint

**File:** `src/dotmac/platform/realtime/lifecycle_router.py` (NEW)

```python
"""Real-time SSE endpoints for service lifecycle events."""

from typing import Annotated

from fastapi import APIRouter, Depends
from sse_starlette import EventSourceResponse

from ..auth.dependencies import get_current_user
from ..events.bus import event_bus
from ..models import User

router = APIRouter(prefix="/realtime", tags=["Real-Time - Lifecycle"])


@router.get("/service-lifecycle/{service_id}")
async def service_lifecycle_stream(
    service_id: str,
    current_user: Annotated[User, Depends(get_current_user)],
):
    """
    Stream service lifecycle events via Server-Sent Events.

    Emits:
    - service.provisioning.progress
    - service.provisioning.completed
    - service.suspension.progress
    - service.termination.progress
    """

    async def event_generator():
        """Generate SSE events for service lifecycle."""

        # Subscribe to lifecycle events
        event_types = [
            "service.provisioning.progress",
            "service.provisioning.completed",
            "service.suspension.progress",
            "service.suspension.completed",
            "service.termination.progress",
            "service.termination.completed",
        ]

        async for event in event_bus.subscribe(
            event_types=event_types,
            tenant_id=current_user.tenant_id,
        ):
            # Filter events for this service_id
            if event.data.get("service_instance_id") == service_id:
                yield {
                    "event": event.event_type,
                    "data": event.data,
                }

    return EventSourceResponse(event_generator())
```

#### 1.3 Register Real-Time Router

**File:** `src/dotmac/platform/routers.py`

```python
ROUTER_CONFIGS = [
    # ... existing routers
    RouterConfig(
        module_path="dotmac.platform.realtime.lifecycle_router",
        router_name="router",
        prefix="/api/v1",
        tags=["Real-Time - Lifecycle"],
        requires_auth=True,
        description="Real-time service lifecycle events",
    ),
]
```

---

### Phase 2: Frontend Real-Time Hook

#### 2.1 Create Service Workflow Progress Hook

**File:** `frontend/apps/base-app/hooks/useServiceWorkflowProgress.ts` (NEW)

```typescript
import { useEffect, useState } from 'react';
import { SSEClient, createSSEClient } from '@/lib/realtime/sse-client';

interface WorkflowProgress {
  service_instance_id: string;
  tenant_id: string;
  step: number;
  total_steps: number;
  status: string;
  message: string;
  timestamp: string;
}

interface UseServiceWorkflowProgressOptions {
  serviceId: string;
  enabled?: boolean;
  onProgress?: (progress: WorkflowProgress) => void;
  onCompleted?: () => void;
  onError?: (error: Error) => void;
}

export function useServiceWorkflowProgress({
  serviceId,
  enabled = true,
  onProgress,
  onCompleted,
  onError,
}: UseServiceWorkflowProgressOptions) {
  const [progress, setProgress] = useState<WorkflowProgress | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [client, setClient] = useState<SSEClient | null>(null);

  useEffect(() => {
    if (!enabled || !serviceId) return;

    // Create SSE client
    const sseClient = createSSEClient({
      endpoint: `/api/v1/realtime/service-lifecycle/${serviceId}`,
      token: '', // Uses cookies automatically
      onOpen: () => {
        setIsConnected(true);
        console.log(`Connected to service lifecycle stream: ${serviceId}`);
      },
      onError: (error) => {
        setIsConnected(false);
        console.error('SSE connection error:', error);
        onError?.(error);
      },
    });

    // Subscribe to progress events
    const unsubscribeProgress = sseClient.subscribe(
      'service.provisioning.progress',
      (event) => {
        const progressData = event.data as WorkflowProgress;
        setProgress(progressData);
        onProgress?.(progressData);
      }
    );

    // Subscribe to completion events
    const unsubscribeCompleted = sseClient.subscribe(
      'service.provisioning.completed',
      () => {
        onCompleted?.();
      }
    );

    setClient(sseClient);

    // Cleanup
    return () => {
      unsubscribeProgress();
      unsubscribeCompleted();
      sseClient.close();
    };
  }, [serviceId, enabled]);

  return {
    progress,
    isConnected,
    disconnect: () => client?.close(),
  };
}
```

#### 2.2 Create Progress UI Component

**File:** `frontend/apps/base-app/components/services/ServiceProvisioningProgress.tsx` (NEW)

```typescript
import { Progress } from '@/components/ui/progress';
import { useServiceWorkflowProgress } from '@/hooks/useServiceWorkflowProgress';

interface ServiceProvisioningProgressProps {
  serviceId: string;
  onComplete?: () => void;
}

export function ServiceProvisioningProgress({
  serviceId,
  onComplete,
}: ServiceProvisioningProgressProps) {
  const { progress, isConnected } = useServiceWorkflowProgress({
    serviceId,
    enabled: true,
    onProgress: (p) => {
      console.log('Progress update:', p);
    },
    onCompleted: () => {
      console.log('Provisioning completed!');
      onComplete?.();
    },
  });

  if (!isConnected) {
    return (
      <div className="flex items-center gap-2">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <span className="text-sm text-muted-foreground">Connecting...</span>
      </div>
    );
  }

  if (!progress) {
    return (
      <div className="text-sm text-muted-foreground">
        Waiting for provisioning to start...
      </div>
    );
  }

  const progressPercent = (progress.step / progress.total_steps) * 100;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">
            Step {progress.step} of {progress.total_steps}
          </span>
          <span className="text-muted-foreground">
            {Math.round(progressPercent)}%
          </span>
        </div>
        <Progress value={progressPercent} />
      </div>

      <div className="rounded-lg bg-muted p-3">
        <p className="text-sm font-medium capitalize">{progress.status}</p>
        <p className="text-sm text-muted-foreground">{progress.message}</p>
      </div>

      <div className="text-xs text-muted-foreground">
        Last updated: {new Date(progress.timestamp).toLocaleTimeString()}
      </div>
    </div>
  );
}
```

#### 2.3 Integrate into Service Pages

**File:** `frontend/apps/base-app/app/dashboard/services/[id]/page.tsx`

```typescript
import { ServiceProvisioningProgress } from '@/components/services/ServiceProvisioningProgress';

export default function ServiceDetailPage({ params }: { params: { id: string } }) {
  const { data: service } = useServiceInstance(params.id);

  return (
    <div>
      <h1>Service Details</h1>

      {service?.provisioning_status === 'provisioning' && (
        <Card>
          <CardHeader>
            <CardTitle>Provisioning Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <ServiceProvisioningProgress
              serviceId={params.id}
              onComplete={() => {
                // Refetch service data
                queryClient.invalidateQueries(['services', params.id]);
              }}
            />
          </CardContent>
        </Card>
      )}

      {/* Rest of service details */}
    </div>
  );
}
```

---

## Event Schemas

### Service Provisioning Progress

```typescript
{
  "event_type": "service.provisioning.progress",
  "data": {
    "service_instance_id": "uuid",
    "tenant_id": "uuid",
    "step": 3,
    "total_steps": 6,
    "status": "configuring",
    "message": "Configuring network equipment",
    "timestamp": "2025-10-16T12:00:00Z"
  }
}
```

### Service Provisioning Completed

```typescript
{
  "event_type": "service.provisioning.completed",
  "data": {
    "service_instance_id": "uuid",
    "tenant_id": "uuid",
    "completed_at": "2025-10-16T12:05:00Z"
  }
}
```

### Service Provisioning Failed

```typescript
{
  "event_type": "service.provisioning.failed",
  "data": {
    "service_instance_id": "uuid",
    "tenant_id": "uuid",
    "step": 4,
    "error": "Network equipment unreachable",
    "failed_at": "2025-10-16T12:03:00Z"
  }
}
```

---

## Testing Strategy

### Unit Tests

```python
# Test event emission
@pytest.mark.asyncio
async def test_provisioning_emits_events():
    service_id = "test-service-123"
    tenant_id = "test-tenant-456"

    events_received = []

    async def event_handler(event):
        events_received.append(event)

    # Subscribe to events
    await event_bus.subscribe(
        event_types=["service.provisioning.progress"],
        handler=event_handler,
        tenant_id=tenant_id,
    )

    # Trigger provisioning
    await _execute_provisioning_workflow(service_id, tenant_id)

    # Verify events
    assert len(events_received) >= 6  # One per step
    assert events_received[0].data["step"] == 1
    assert events_received[-1].data["status"] == "completed"
```

### Integration Tests

```typescript
// Test frontend hook
test('useServiceWorkflowProgress receives updates', async () => {
  const { result } = renderHook(() =>
    useServiceWorkflowProgress({
      serviceId: 'test-service-123',
      enabled: true,
    })
  );

  // Simulate SSE event
  const event = new MessageEvent('service.provisioning.progress', {
    data: JSON.stringify({
      service_instance_id: 'test-service-123',
      step: 1,
      total_steps: 6,
      status: 'validating',
      message: 'Validating configuration',
    }),
  });

  // Trigger event
  await act(async () => {
    window.dispatchEvent(event);
  });

  // Verify state
  expect(result.current.progress?.step).toBe(1);
  expect(result.current.progress?.status).toBe('validating');
});
```

### E2E Tests

```python
# Playwright E2E test
async def test_provisioning_progress_ui(page):
    # Navigate to service page
    await page.goto('/dashboard/services/new')

    # Create service
    await page.fill('[name="service_name"]', 'Test Service')
    await page.click('button:has-text("Create")')

    # Wait for provisioning to start
    await page.wait_for_selector('text=Provisioning Progress')

    # Verify progress updates
    progress = page.locator('[role="progressbar"]')
    await expect(progress).to_have_attribute('aria-valuenow', '16')  # Step 1/6

    # Wait for completion
    await page.wait_for_selector('text=Provisioning completed', timeout=30000)

    # Verify service is active
    status = page.locator('[data-testid="service-status"]')
    await expect(status).to_have_text('Active')
```

---

## Performance Considerations

### Backend

- **Event Bus:** Use Redis Pub/Sub for scalability
- **SSE Connections:** Limit concurrent connections per tenant (e.g., 100)
- **Event Retention:** Keep events for 1 hour max in Redis
- **Rate Limiting:** Max 1 event per second per workflow

### Frontend

- **Connection Pooling:** Reuse SSE connections across components
- **Auto-reconnect:** Exponential backoff on connection loss
- **Event Buffering:** Buffer events if UI is not visible
- **Memory Management:** Clear old progress states after completion

---

## Monitoring & Observability

### Metrics

```python
# Backend metrics
metrics.counter("lifecycle.workflow.started", tags={"service_type": "fiber"})
metrics.counter("lifecycle.workflow.completed", tags={"service_type": "fiber"})
metrics.counter("lifecycle.workflow.failed", tags={"service_type": "fiber"})
metrics.histogram("lifecycle.workflow.duration", duration, tags={"service_type": "fiber"})

# SSE metrics
metrics.gauge("realtime.sse.connections", connection_count)
metrics.counter("realtime.sse.events_sent", tags={"event_type": "provisioning.progress"})
```

### Logging

```python
logger.info(
    "Provisioning workflow step completed",
    service_id=service_id,
    tenant_id=tenant_id,
    step=3,
    status="configuring",
    duration_ms=1234,
)
```

---

## Rollout Plan

### Phase 1: Backend Foundation (Week 1)

- [ ] Update lifecycle tasks to emit events
- [ ] Create SSE real-time router
- [ ] Add event schemas
- [ ] Unit tests for event emission

### Phase 2: Frontend Integration (Week 2)

- [ ] Create `useServiceWorkflowProgress` hook
- [ ] Build progress UI component
- [ ] Integrate into service pages
- [ ] E2E tests

### Phase 3: Production Rollout (Week 3)

- [ ] Deploy to staging
- [ ] Load testing (100 concurrent workflows)
- [ ] Monitor metrics
- [ ] Deploy to production

---

## Success Criteria

- ✅ Provisioning workflows emit real-time events
- ✅ Frontend displays step-by-step progress
- ✅ SSE connections maintain <100ms latency
- ✅ No UI polling (100% event-driven)
- ✅ Graceful degradation if SSE fails
- ✅ 95th percentile workflow completion <5 minutes

---

## References

- Backend Lifecycle: `src/dotmac/platform/services/lifecycle/tasks.py`
- Frontend Hooks: `frontend/apps/base-app/hooks/useServiceLifecycle.ts`
- SSE Client: `frontend/apps/base-app/lib/realtime/sse-client.ts`
- Event Bus: `src/dotmac/platform/events/bus.py`
