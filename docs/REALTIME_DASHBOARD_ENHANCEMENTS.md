# Real-Time Dashboard Enhancement Plan

**Created:** November 8, 2025
**Status:** Implementation Guide
**Priority:** P2 - Medium

---

## Overview

This document outlines the expansion of Server-Sent Events (SSE) and WebSocket functionality across Network and RADIUS dashboards for live data streaming and real-time updates.

## Current Real-Time Infrastructure

### Existing Implementation

1. **WebSocket Hook** (`useWebSocket` from `@dotmac/headless`)
   - Location: `frontend/shared/packages/headless/src/hooks/useWebSocket.ts`
   - Features: Auto-reconnect, heartbeat, message handling

2. **Real-Time Hooks** (`useRealtime`)
   - Location: `frontend/apps/isp-ops-app/hooks/useRealtime.ts`
   - Current usage: LiveBandwidthChart, LiveSessionMonitor

3. **Existing Components with Real-Time**:
   - `LiveBandwidthChart.tsx` - Real-time bandwidth monitoring
   - `LiveSessionMonitor.tsx` - Active session tracking

---

## Expansion Targets

### 1. Network Dashboard Enhancements

**Location:** `/dashboard/network/`

#### A. Live Network Topology View
```typescript
// Add to /dashboard/network/topology/page.tsx
const { data: topology, isConnected } = useWebSocket({
  endpoint: "/ws/network/topology",
  onMessage: (data) => {
    // Update node positions, link states, bandwidth utilization
    updateTopologyGraph(data);
  },
  reconnectInterval: 5000,
});
```

**Data Streamed:**
- Device status changes (up/down)
- Link utilization percentages
- Interface errors/discards
- New device discoveries
- Topology changes

#### B. Real-Time Interface Statistics
```typescript
// Add to /dashboard/network/interfaces/page.tsx
const { subscribe } = useRealtime();

useEffect(() => {
  const unsubscribe = subscribe("interface-stats", (stats) => {
    // Update interface throughput, errors, packet rates
    setInterfaceMetrics(stats);
  });
  return unsubscribe;
}, []);
```

**Metrics:**
- Ingress/egress bandwidth (bps)
- Packet rates (pps)
- Error counters
- Utilization percentage
- Queue depths

#### C. Live Fault Stream
```typescript
// Add to /dashboard/network/faults/page.tsx
const { events } = useSSE("/events/network/faults", {
  onFault: (fault) => {
    // Prepend to fault list with animation
    addFaultToList(fault);
    showToast(`New ${fault.severity} fault: ${fault.description}`);
  },
});
```

**Events:**
- Critical alarms
- Interface down events
- High utilization alerts
- Device unreachable notifications

---

### 2. RADIUS Dashboard Enhancements

**Location:** `/dashboard/radius/`

#### A. Live Authentication Stream
```typescript
// Add to /dashboard/radius/sessions/page.tsx
const { data: authEvents } = useWebSocket({
  endpoint: "/ws/radius/auth-stream",
  onMessage: (event) => {
    if (event.type === "auth-success") {
      incrementActiveUsers();
      addSessionToGrid(event.session);
    } else if (event.type === "auth-failure") {
      incrementAuthFailures();
      addToFailureLog(event);
    }
  },
});
```

**Event Types:**
- `auth-success` - Successful authentication
- `auth-failure` - Failed login attempts
- `session-start` - New session established
- `session-end` - Session terminated
- `coa-sent` - Change of Authorization sent
- `disconnect-sent` - Disconnect request sent

#### B. Real-Time Session Monitor
```typescript
// Enhance /dashboard/radius/sessions/page.tsx
const { sessions, stats } = useRealtimeRADIUS({
  updateInterval: 2000, // 2-second updates
  filters: {
    nas_id: selectedNAS,
    username: searchQuery,
  },
});

// Display:
// - Active sessions count
// - Sessions per NAS
// - Bandwidth per user
// - Average session duration
// - Auth success rate (live)
```

#### C. Live CoA Activity Monitor
```typescript
// Add to /dashboard/radius/coa/page.tsx
const { data: coaEvents } = useSSE("/events/radius/coa", {
  onEvent: (coa) => {
    // Show live CoA operations with status
    updateCoATimeline(coa);
    if (coa.status === "ack") {
      showSuccess(coa);
    } else if (coa.status === "nak") {
      showError(coa);
    }
  },
});
```

---

## Implementation Steps

### Phase 1: Backend SSE Endpoints (3-4 days)

1. **Create SSE routers**:
   ```python
   # src/dotmac/platform/network/sse_router.py
   @router.get("/events/network/topology")
   async def stream_topology_updates(request: Request):
       async def event_generator():
           while True:
               topology = await get_current_topology()
               yield f"data: {json.dumps(topology)}\n\n"
               await asyncio.sleep(5)
       return EventSourceResponse(event_generator())
   ```

2. **Add Redis pub/sub for event distribution**:
   ```python
   # Publish events from network monitoring
   await redis.publish("network:topology", json.dumps(event))
   await redis.publish("radius:auth", json.dumps(auth_event))
   ```

3. **Create WebSocket endpoints**:
   ```python
   # src/dotmac/platform/radius/ws_router.py
   @router.websocket("/ws/radius/auth-stream")
   async def radius_auth_stream(websocket: WebSocket):
       await websocket.accept()
       # Stream RADIUS auth events
   ```

### Phase 2: Frontend Hooks Enhancement (2-3 days)

1. **Extend `useRealtime` hook**:
   ```typescript
   // Add subscription management
   export function useRealtime() {
     const subscribers = useRef<Map<string, Set<Function>>>(new Map());

     const subscribe = (channel: string, callback: Function) => {
       if (!subscribers.current.has(channel)) {
         subscribers.current.set(channel, new Set());
       }
       subscribers.current.get(channel)!.add(callback);

       return () => {
         subscribers.current.get(channel)?.delete(callback);
       };
     };

     return { subscribe, publish };
   }
   ```

2. **Create SSE hook**:
   ```typescript
   // hooks/useSSE.ts
   export function useSSE(endpoint: string, options: SSEOptions) {
     const [events, setEvents] = useState<any[]>([]);
     const [isConnected, setIsConnected] = useState(false);

     useEffect(() => {
       const eventSource = new EventSource(endpoint);

       eventSource.onopen = () => setIsConnected(true);
       eventSource.onmessage = (e) => {
         const data = JSON.parse(e.data);
         setEvents(prev => [data, ...prev].slice(0, 100));
         options.onEvent?.(data);
       };
       eventSource.onerror = () => setIsConnected(false);

       return () => eventSource.close();
     }, [endpoint]);

     return { events, isConnected };
   }
   ```

### Phase 3: Component Integration (3-4 days)

1. **Network Topology Dashboard**:
   - Add live graph visualization
   - Auto-update node colors based on status
   - Animate link utilization changes

2. **RADIUS Session Dashboard**:
   - Real-time session counter
   - Live authentication log
   - Auto-refresh session table

3. **Network Fault Dashboard**:
   - Streaming fault notifications
   - Toast notifications for critical events
   - Audio alerts for critical faults

---

## Performance Considerations

### Throttling

```typescript
// Limit update frequency to prevent UI jank
const throttledUpdate = useMemo(
  () => throttle((data) => setMetrics(data), 1000),
  []
);
```

### Pagination for Live Streams

```typescript
// Keep only last 100 events in memory
const [events, setEvents] = useState<Event[]>([]);

useEffect(() => {
  setEvents(prev => [newEvent, ...prev].slice(0, 100));
}, [newEvent]);
```

### Connection Management

```typescript
// Auto-disconnect when component unmounts
useEffect(() => {
  return () => {
    websocket.close();
    eventSource.close();
  };
}, []);
```

---

## Monitoring & Observability

### Metrics to Track

1. **WebSocket Metrics**:
   - Active connections count
   - Messages sent per second
   - Reconnection rate
   - Average message latency

2. **SSE Metrics**:
   - Active subscribers count
   - Events published per second
   - Client disconnect rate

3. **Client-Side Metrics**:
   - Component render time with real-time updates
   - Memory usage growth
   - Event processing latency

---

## Testing Strategy

### Load Testing

```python
# tests/load/test_websocket_capacity.py
async def test_websocket_concurrent_connections():
    # Simulate 1000 concurrent WebSocket connections
    connections = []
    for i in range(1000):
        ws = await create_websocket_connection()
        connections.append(ws)

    # Verify all connections receive updates
    assert all(c.is_connected() for c in connections)
```

### Integration Tests

```typescript
// tests/integration/realtime/test-sse.test.tsx
test("SSE connection handles network faults", async () => {
  const { result } = renderHook(() => useSSE("/events/network/faults"));

  // Simulate backend event
  publishEvent({ type: "link-down", interface: "eth0" });

  await waitFor(() => {
    expect(result.current.events).toHaveLength(1);
    expect(result.current.events[0].type).toBe("link-down");
  });
});
```

---

## Rollout Plan

### Week 1: Backend Infrastructure
- Create SSE endpoints
- Add WebSocket routers
- Implement Redis pub/sub

### Week 2: Frontend Foundation
- Enhance `useRealtime` hook
- Create `useSSE` hook
- Add connection monitoring

### Week 3: Dashboard Integration
- Network Topology live view
- RADIUS session monitor
- Fault stream dashboard

### Week 4: Testing & Optimization
- Load testing
- Performance tuning
- Documentation updates

---

## Success Metrics

1. **User Experience**:
   - Dashboard updates within 2 seconds of backend event
   - No visible UI lag during updates
   - Smooth animations and transitions

2. **Reliability**:
   - 99.9% uptime for WebSocket/SSE endpoints
   - Auto-reconnect success rate > 95%
   - Zero message loss for critical events

3. **Performance**:
   - Support 500+ concurrent WebSocket connections
   - < 100ms event processing latency
   - < 50MB memory growth per hour

---

## Future Enhancements

1. **Historical Playback**: Replay events from specific time ranges
2. **Custom Alerts**: User-defined filters and notifications
3. **Mobile Push**: Push notifications for critical events
4. **Real-Time Analytics**: Live aggregations and calculations

---

## References

- Backend SSE Router: `src/dotmac/platform/network/sse_router.py` (to be created)
- WebSocket Hook: `frontend/shared/packages/headless/src/hooks/useWebSocket.ts`
- Real-Time Components: `frontend/apps/isp-ops-app/components/realtime/`
