# Real-Time Frontend Implementation Guide

## Overview

This document describes the complete frontend implementation for real-time event streaming using Server-Sent Events (SSE) and WebSocket connections to the `/api/v1/realtime` backend endpoints.

## Architecture

### Components

```
frontend/apps/base-app/
├── types/
│   └── realtime.ts                    # TypeScript definitions for events
├── lib/
│   └── realtime/
│       ├── sse-client.ts              # SSE client implementation
│       └── websocket-client.ts        # WebSocket client implementation
├── hooks/
│   └── useRealtime.ts                 # React hooks for realtime events
└── components/
    └── realtime/
        └── ConnectionStatusIndicator.tsx  # Connection status UI
```

### Technology Stack

- **SSE (Server-Sent Events)**: One-way streaming for events (server → client)
- **WebSocket**: Bidirectional communication with control commands
- **React Hooks**: Declarative event subscription with automatic cleanup
- **TypeScript**: Full type safety from backend to frontend

## File Descriptions

### 1. Types (`types/realtime.ts`)

**Purpose**: Type definitions matching backend Pydantic schemas

**Key Types**:
- `EventType` - Enum of all 24 event types
- `ConnectionStatus` - Connection state enum
- `BaseEvent<T>` - Base interface for all events
- Event-specific interfaces: `ONUStatusEvent`, `RADIUSSessionEvent`, `JobProgressEvent`, etc.
- Configuration interfaces: `SSEConfig`, `WebSocketConfig`
- Hook return types: `SSEConnection`, `WebSocketConnection`

**Usage**:
```typescript
import type { ONUStatusEvent, EventType } from '@/types/realtime';

const handleONUEvent = (event: ONUStatusEvent) => {
  if (event.event_type === EventType.ONU_ONLINE) {
    console.log('ONU came online:', event.onu_serial);
  }
};
```

### 2. SSE Client (`lib/realtime/sse-client.ts`)

**Purpose**: Low-level SSE connection management

**Classes**:
- `SSEClient` - Main SSE client with reconnection
- `SSEEndpoints` - Factory for creating endpoint-specific clients

**Features**:
- JWT authentication via query parameter
- Automatic reconnection with exponential backoff
- Event subscription system
- Connection status tracking
- Type-safe event handlers

**Usage**:
```typescript
import { createSSEClient } from '@/lib/realtime/sse-client';

const client = createSSEClient({
  endpoint: '/api/v1/realtime/onu-status',
  token: 'your-jwt-token',
  onOpen: () => console.log('Connected'),
  onError: (err) => console.error('Error:', err),
});

const unsubscribe = client.subscribe('onu.online', (event) => {
  console.log('Event:', event);
});

// Later: unsubscribe();
// client.close();
```

### 3. WebSocket Client (`lib/realtime/websocket-client.ts`)

**Purpose**: Low-level WebSocket connection management with control commands

**Classes**:
- `WebSocketClient` - Main WebSocket client with heartbeat
- `WebSocketEndpoints` - Factory for creating endpoint-specific clients
- `JobControl` - Job control commands (cancel, pause, resume)
- `CampaignControl` - Campaign control commands

**Features**:
- JWT authentication (query param, header, cookie)
- Automatic reconnection
- Heartbeat/ping-pong for connection health
- Event subscription system
- Control commands support
- Connection latency measurement

**Usage**:
```typescript
import { createWebSocketClient } from '@/lib/realtime/websocket-client';

const client = createWebSocketClient({
  endpoint: '/api/v1/realtime/ws/sessions',
  token: 'your-jwt-token',
  heartbeatInterval: 30000,
});

const unsubscribe = client.subscribe('session.started', (event) => {
  console.log('Session started:', event);
});

// Send ping
client.send({ type: 'ping' });
```

### 4. React Hooks (`hooks/useRealtime.ts`)

**Purpose**: High-level React hooks for declarative event subscriptions

**Hooks Available**:

#### SSE Hooks
- `useONUStatusEvents(handler, enabled)` - Subscribe to ONU status changes
- `useAlertEvents(handler, enabled)` - Subscribe to alerts
- `useTicketEvents(handler, enabled)` - Subscribe to ticket updates
- `useSubscriberEvents(handler, enabled)` - Subscribe to subscriber events
- `useRADIUSSessionEvents(handler, enabled)` - Subscribe to RADIUS sessions

#### WebSocket Hooks
- `useSessionsWebSocket(handler, enabled)` - RADIUS sessions WebSocket
- `useJobWebSocket(jobId, enabled)` - Job progress with control commands
- `useCampaignWebSocket(campaignId, enabled)` - Campaign progress with controls

#### Composite Hooks
- `useRealtimeConnections()` - All SSE connections with event history
- `useRealtimeHealth()` - Connection health monitoring

**Usage Examples**:

```typescript
// ONU Status Events
import { useONUStatusEvents } from '@/hooks/useRealtime';

function MyComponent() {
  const { status, error } = useONUStatusEvents((event) => {
    console.log('ONU event:', event);
    if (event.event_type === 'onu.online') {
      toast.success(`ONU ${event.onu_serial} is now online`);
    }
  });

  return <div>Connection: {status}</div>;
}

// Job Progress with Controls
import { useJobWebSocket } from '@/hooks/useRealtime';

function JobMonitor({ jobId }) {
  const {
    isConnected,
    jobProgress,
    cancelJob,
    pauseJob,
  } = useJobWebSocket(jobId);

  return (
    <div>
      <p>Progress: {jobProgress?.progress_percent}%</p>
      <button onClick={cancelJob}>Cancel</button>
      <button onClick={pauseJob}>Pause</button>
    </div>
  );
}

// All Connections
import { useRealtimeConnections } from '@/hooks/useRealtime';

function RealtimeDashboard() {
  const {
    onuEvents,
    alerts,
    tickets,
    statuses,
    clearEvents,
  } = useRealtimeConnections();

  return (
    <div>
      <p>ONU Events: {onuEvents.length}</p>
      <p>Alerts: {alerts.length}</p>
      <p>Status: {statuses.onu}</p>
      <button onClick={clearEvents}>Clear</button>
    </div>
  );
}
```

### 5. Connection Status Indicator (`components/realtime/ConnectionStatusIndicator.tsx`)

**Purpose**: Visual indicator for connection status

**Components**:
- `ConnectionStatusIndicator` - Full status display with details
- `CompactConnectionStatus` - Minimal inline indicator

**Features**:
- Real-time connection status for all endpoints
- Expandable details panel
- Color-coded status badges
- Connection error messages
- Floating or inline positioning

**Usage**:
```typescript
import { ConnectionStatusIndicator } from '@/components/realtime/ConnectionStatusIndicator';

function App() {
  return (
    <div>
      {/* Floating indicator in bottom-right */}
      <ConnectionStatusIndicator position="bottom-right" />

      {/* Inline compact status */}
      <CompactConnectionStatus />
    </div>
  );
}
```

## Event Types Reference

### ONU Events
- `onu.online` - ONU came online
- `onu.offline` - ONU went offline
- `onu.signal_degraded` - Signal quality degraded
- `onu.provisioned` - ONU provisioned
- `onu.deprovisioned` - ONU deprovisioned

### RADIUS Session Events
- `session.started` - User authenticated
- `session.updated` - Interim accounting update
- `session.stopped` - User disconnected

### Job Events
- `job.created` - Job started
- `job.progress` - Progress update
- `job.completed` - Job finished successfully
- `job.failed` - Job failed
- `job.cancelled` - Job cancelled

### Ticket Events
- `ticket.created` - New ticket
- `ticket.updated` - Ticket updated
- `ticket.assigned` - Ticket assigned
- `ticket.resolved` - Ticket resolved

### Alert Events
- `alert.raised` - New alert
- `alert.cleared` - Alert cleared

### Subscriber Events
- `subscriber.created` - New subscriber
- `subscriber.activated` - Subscriber activated
- `subscriber.suspended` - Subscriber suspended
- `subscriber.terminated` - Subscriber terminated

## Integration Examples

### 1. Live ONU Status Dashboard

```typescript
'use client';

import { useState } from 'react';
import { useONUStatusEvents } from '@/hooks/useRealtime';
import type { ONUStatusEvent } from '@/types/realtime';

export function LiveONUDashboard() {
  const [events, setEvents] = useState<ONUStatusEvent[]>([]);

  const { status } = useONUStatusEvents((event) => {
    setEvents((prev) => [event, ...prev.slice(0, 99)]);
  });

  return (
    <div>
      <h2>Live ONU Status ({status})</h2>
      <div className="space-y-2">
        {events.map((event, idx) => (
          <div key={idx} className="border p-2">
            <p>{event.onu_serial}: {event.status}</p>
            <p className="text-xs">{event.timestamp}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
```

### 2. Real-Time Alerts

```typescript
'use client';

import { toast } from 'sonner';
import { useAlertEvents } from '@/hooks/useRealtime';

export function AlertNotifications() {
  useAlertEvents((event) => {
    if (event.event_type === 'alert.raised') {
      const severity = event.severity;
      const message = event.message;

      if (severity === 'critical') {
        toast.error(message);
      } else if (severity === 'warning') {
        toast.warning(message);
      } else {
        toast.info(message);
      }
    }
  });

  return null; // Background component
}
```

### 3. Job Progress Monitor

```typescript
'use client';

import { useJobWebSocket } from '@/hooks/useRealtime';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';

export function JobProgressMonitor({ jobId }: { jobId: string }) {
  const {
    isConnected,
    jobProgress,
    cancelJob,
    pauseJob,
    resumeJob,
  } = useJobWebSocket(jobId);

  if (!isConnected) {
    return <div>Connecting to job monitor...</div>;
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="font-bold">{jobProgress?.job_type}</p>
        <p className="text-sm text-muted-foreground">
          {jobProgress?.status}
        </p>
      </div>

      <Progress value={jobProgress?.progress_percent || 0} />

      <div className="flex gap-2">
        <p>
          {jobProgress?.items_processed} / {jobProgress?.items_total}
        </p>
        <p>
          ({jobProgress?.items_succeeded} succeeded,{' '}
          {jobProgress?.items_failed} failed)
        </p>
      </div>

      <div className="flex gap-2">
        {jobProgress?.status === 'running' && (
          <>
            <Button onClick={pauseJob}>Pause</Button>
            <Button onClick={cancelJob} variant="destructive">
              Cancel
            </Button>
          </>
        )}
        {jobProgress?.status === 'paused' && (
          <Button onClick={resumeJob}>Resume</Button>
        )}
      </div>
    </div>
  );
}
```

### 4. RADIUS Sessions Live Table

```typescript
'use client';

import { useState } from 'react';
import { useSessionsWebSocket } from '@/hooks/useRealtime';
import type { RADIUSSessionEvent } from '@/types/realtime';

interface Session {
  username: string;
  session_id: string;
  ip: string;
  bytes_in: number;
  bytes_out: number;
}

export function LiveSessionsTable() {
  const [sessions, setSessions] = useState<Map<string, Session>>(new Map());

  useSessionsWebSocket((event) => {
    const sessionId = event.session_id;

    if (event.event_type === 'session.started') {
      setSessions((prev) => new Map(prev).set(sessionId, {
        username: event.username,
        session_id: sessionId,
        ip: event.framed_ip_address || '',
        bytes_in: event.bytes_in,
        bytes_out: event.bytes_out,
      }));
    } else if (event.event_type === 'session.updated') {
      setSessions((prev) => {
        const newMap = new Map(prev);
        const existing = newMap.get(sessionId);
        if (existing) {
          newMap.set(sessionId, {
            ...existing,
            bytes_in: event.bytes_in,
            bytes_out: event.bytes_out,
          });
        }
        return newMap;
      });
    } else if (event.event_type === 'session.stopped') {
      setSessions((prev) => {
        const newMap = new Map(prev);
        newMap.delete(sessionId);
        return newMap;
      });
    }
  });

  return (
    <table>
      <thead>
        <tr>
          <th>Username</th>
          <th>IP Address</th>
          <th>Bytes In</th>
          <th>Bytes Out</th>
        </tr>
      </thead>
      <tbody>
        {Array.from(sessions.values()).map((session) => (
          <tr key={session.session_id}>
            <td>{session.username}</td>
            <td>{session.ip}</td>
            <td>{formatBytes(session.bytes_in)}</td>
            <td>{formatBytes(session.bytes_out)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

## Environment Configuration

Add these to your `.env.local`:

```bash
# Backend API base URL
NEXT_PUBLIC_API_URL=http://localhost:8000

# Optional: Separate WebSocket URL if different
# NEXT_PUBLIC_WS_URL=ws://localhost:8000
```

## Authentication

All realtime connections require JWT authentication. The hooks automatically extract the token from the `useAuth()` context.

**Token Sources (in order of priority)**:
1. Query parameter: `?token=<JWT>`
2. Authorization header: `Authorization: Bearer <JWT>`
3. Cookie: `access_token=<JWT>`

## Connection Management

### Auto-Reconnection

Both SSE and WebSocket clients implement exponential backoff:
- Initial delay: 1 second
- Exponential multiplier: 2x
- Max delay: 30 seconds
- Max attempts: 10

### Connection Health

WebSocket connections include heartbeat (ping-pong):
- Interval: 30 seconds
- Automatic detection of stale connections
- Latency measurement

### Cleanup

All hooks automatically clean up connections when components unmount:
```typescript
useEffect(() => {
  // Connection setup
  return () => {
    // Automatic cleanup
  };
}, [dependencies]);
```

## Performance Considerations

1. **Event History Limits**: Keep only last 100 events in memory
2. **Selective Subscriptions**: Only enable hooks for needed events
3. **Connection Pooling**: Reuse connections across components
4. **Throttling**: Backend implements rate limiting
5. **Automatic Cleanup**: Hooks clean up on unmount

## Troubleshooting

### Connection Fails
1. Check `NEXT_PUBLIC_API_URL` is set correctly
2. Verify JWT token is valid and not expired
3. Check network connectivity
4. Inspect browser console for errors
5. Verify backend endpoints are running

### Events Not Received
1. Check event type spelling matches backend
2. Verify handler function is stable (use `useCallback`)
3. Check connection status is 'connected'
4. Verify tenant_id matches user's tenant

### Memory Leaks
1. Ensure hooks are used inside functional components
2. Check for missing dependency arrays
3. Verify cleanup functions are called
4. Limit event history size

## Next Steps

1. **Integration**: Add `ConnectionStatusIndicator` to main layout
2. **Notifications**: Create toast notifications for critical alerts
3. **Dashboard**: Build real-time dashboard with `useRealtimeConnections()`
4. **Job Monitoring**: Add job progress monitors to bulk operation pages
5. **Session Monitoring**: Create live RADIUS sessions table

## Testing

### Manual Testing
```typescript
// Test SSE connection
import { createSSEClient } from '@/lib/realtime/sse-client';

const client = createSSEClient({
  endpoint: 'http://localhost:8000/api/v1/realtime/alerts',
  token: 'your-token',
  onOpen: () => console.log('Connected'),
  onError: (err) => console.error(err),
});

client.subscribe('*', (event) => {
  console.log('Event received:', event);
});
```

### Backend Event Publishing
Trigger test events from backend:
```python
from dotmac.platform.realtime.publishers import publish_alert

await publish_alert(
    tenant_id="test-tenant",
    alert_id="test-123",
    alert_type="test",
    severity="info",
    source="manual-test",
    message="Test alert message",
)
```

## Complete Implementation Checklist

- [x] TypeScript type definitions
- [x] SSE client implementation
- [x] WebSocket client implementation
- [x] React hooks for all event types
- [x] Connection status indicator component
- [x] Documentation with examples
- [ ] Integration into main layout
- [ ] Real-time dashboard page
- [ ] Job progress integration
- [ ] Campaign monitoring integration
- [ ] Alert toast notifications
- [ ] RADIUS sessions live table
- [ ] Environment variable setup
- [ ] Production testing

## Support

For issues or questions:
- Backend API: `/src/dotmac/platform/realtime/`
- Frontend Implementation: `/frontend/apps/base-app/`
- Documentation: `/docs/REALTIME_FRONTEND_IMPLEMENTATION.md`
