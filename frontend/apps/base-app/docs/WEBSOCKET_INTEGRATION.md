# WebSocket Real-Time Updates Integration Guide

## Overview

The WebSocket integration provides real-time updates across the platform with the following features:

- **Automatic reconnection** with exponential backoff
- **Channel-based subscriptions** for targeted updates
- **Connection status tracking**
- **Message broadcasting** to multiple subscribers
- **Graceful fallback** with simulated data when disconnected

## Setup Instructions

### 1. Configure WebSocket Endpoint

Add to `.env.local`:

```bash
NEXT_PUBLIC_WEBSOCKET_URL=ws://your-backend-host:8000/ws
# For production: wss://your-domain.com/ws
```

### 2. Add Provider to Layout

Wrap your application with `WebSocketProvider` in the root layout:

```typescript
// app/layout.tsx or app/dashboard/layout.tsx
import { WebSocketProvider } from "@/lib/websocket/WebSocketProvider";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body>
        <WebSocketProvider autoConnect={true}>
          {children}
        </WebSocketProvider>
      </body>
    </html>
  );
}
```

### 3. Use Hooks in Components

```typescript
import { useWebSocket, useWebSocketSubscription } from "@/lib/websocket/WebSocketProvider";

function MyComponent() {
  // Get connection status
  const { isConnected, connectionStatus } = useWebSocket();

  // Subscribe to specific channel
  const [data] = useWebSocketSubscription<YourDataType>("your_channel");

  return (
    <div>
      Status: {connectionStatus}
      Data: {JSON.stringify(data)}
    </div>
  );
}
```

## Available Hooks

### `useWebSocket(channel?, callback?)`

Subscribe to WebSocket updates with custom callback:

```typescript
const { isConnected, sendMessage, connectionStatus } = useWebSocket("subscriber_update", (data) => {
  console.log("Subscriber updated:", data);
  // Handle update
});
```

### `useWebSocketSubscription<T>(channel)`

Subscribe with automatic state management:

```typescript
const [bandwidthData, setBandwidthData] =
  useWebSocketSubscription<BandwidthData>("bandwidth_update");

// bandwidthData automatically updates when new messages arrive
```

## Message Channels

Standard channels implemented in the platform:

| Channel             | Description                    | Data Type          |
| ------------------- | ------------------------------ | ------------------ |
| `bandwidth_update`  | Real-time bandwidth statistics | `BandwidthData`    |
| `session_update`    | Active session changes         | `SessionUpdate`    |
| `subscriber_update` | Subscriber status changes      | `SubscriberUpdate` |
| `ticket_update`     | Support ticket updates         | `TicketUpdate`     |
| `invoice_update`    | Invoice status changes         | `InvoiceUpdate`    |
| `network_status`    | Network health updates         | `NetworkStatus`    |
| `*`                 | All messages (wildcard)        | `WebSocketMessage` |

## Example Components

### Live Bandwidth Chart

```typescript
import { LiveBandwidthChart } from "@/components/realtime/LiveBandwidthChart";

function NetworkDashboard() {
  return (
    <div>
      <LiveBandwidthChart />
    </div>
  );
}
```

Features:

- Real-time bandwidth graph
- Upload/download metrics
- Latency monitoring
- Auto-updates every 2 seconds
- Simulated data when disconnected

### Live Session Monitor

```typescript
import { LiveSessionMonitor } from "@/components/realtime/LiveSessionMonitor";

function SessionsDashboard() {
  return (
    <div>
      <LiveSessionMonitor />
    </div>
  );
}
```

Features:

- Active user sessions table
- Real-time session updates
- Bandwidth usage per session
- Session duration tracking
- Add/remove session animations

## Backend Integration

### Expected Message Format

WebSocket messages should follow this format:

```json
{
  "type": "channel_name",
  "data": {
    // Your data here
  },
  "timestamp": "2025-10-16T12:00:00Z"
}
```

### Authentication

The provider automatically sends authentication on connection:

```json
{
  "type": "auth",
  "token": "jwt_token_from_localStorage"
}
```

Backend should validate this token and associate the connection with the user.

### Bandwidth Update Example

```json
{
  "type": "bandwidth_update",
  "data": {
    "timestamp": "2025-10-16T12:00:00Z",
    "upload_mbps": 75.5,
    "download_mbps": 150.2,
    "latency_ms": 15
  },
  "timestamp": "2025-10-16T12:00:00Z"
}
```

### Session Update Example

```json
{
  "type": "session_update",
  "data": {
    "action": "new",
    "session": {
      "session_id": "sess_abc123",
      "username": "user@example.com",
      "ip_address": "10.0.0.101",
      "nas_ip_address": "10.1.1.1",
      "upload_bytes": 1048576,
      "download_bytes": 5242880,
      "session_time_seconds": 3600,
      "last_update": "2025-10-16T12:00:00Z"
    }
  },
  "timestamp": "2025-10-16T12:00:00Z"
}
```

Action types:

- `new`: New session started
- `update`: Session data updated
- `terminate`: Session ended

## Connection Management

### Automatic Reconnection

The provider automatically attempts to reconnect with exponential backoff:

- **Initial retry**: 3 seconds
- **Max retry delay**: 30 seconds
- **Max attempts**: 10
- **Backoff formula**: `min(reconnectInterval * 2^attempt, 30000)`

Configure via props:

```typescript
<WebSocketProvider
  reconnectInterval={3000}
  maxReconnectAttempts={10}
>
  {children}
</WebSocketProvider>
```

### Connection Status

Monitor connection status:

```typescript
const { connectionStatus } = useWebSocket();

// connectionStatus values:
// - "connecting"
// - "connected"
// - "disconnected"
// - "error"
```

### Manual Connection Control

```typescript
const { isConnected } = useWebSocket();

// The provider handles connection automatically
// but you can disable autoConnect:
<WebSocketProvider autoConnect={false}>
  {children}
</WebSocketProvider>

// Then connect manually when needed
// (feature to be added if needed)
```

## Sending Messages

Send messages to the WebSocket server:

```typescript
const { sendMessage } = useWebSocket();

// Send a message
sendMessage("action_type", {
  foo: "bar",
  baz: 123,
});
```

This sends:

```json
{
  "type": "action_type",
  "data": {
    "foo": "bar",
    "baz": 123
  },
  "timestamp": "2025-10-16T12:00:00Z"
}
```

## Performance Considerations

### Message Throttling

For high-frequency updates, consider throttling on the backend:

```python
# Backend example (FastAPI)
async def send_bandwidth_updates():
    while True:
        data = get_current_bandwidth()
        await websocket.send_json({
            "type": "bandwidth_update",
            "data": data,
            "timestamp": datetime.utcnow().isoformat()
        })
        await asyncio.sleep(2)  # Throttle to 0.5 Hz
```

### Memory Management

Components automatically clean up subscriptions on unmount:

```typescript
useEffect(() => {
  // Subscription created
  const unsubscribe = context.subscribe(channel, callback);

  // Cleanup on unmount
  return () => unsubscribe();
}, [channel, context]);
```

### Simulated Data

All real-time components include simulated data when WebSocket is disconnected:

```typescript
useEffect(() => {
  if (!isConnected) {
    // Fall back to polling or simulated data
    const interval = setInterval(() => {
      setData(generateMockData());
    }, 2000);

    return () => clearInterval(interval);
  }
}, [isConnected]);
```

## Security

### Token Authentication

Tokens are sent on connection and retrieved via the operator auth helper (which keeps them scoped to the current browser session):

```typescript
// The provider automatically sends this
import { getOperatorAccessToken } from "@dotmac/headless/utils";

const token = getOperatorAccessToken();
ws.send(
  JSON.stringify({
    type: "auth",
    token,
  }),
);
```

### Connection Security

**Production**: Always use `wss://` (WebSocket Secure)
**Development**: Can use `ws://` for local testing

```bash
# Production
NEXT_PUBLIC_WEBSOCKET_URL=wss://api.yourdomain.com/ws

# Development
NEXT_PUBLIC_WEBSOCKET_URL=ws://localhost:8000/ws
```

### Rate Limiting

Implement rate limiting on the backend:

```python
# Backend example
from fastapi import WebSocket
from slowapi import Limiter

@app.websocket("/ws")
@limiter.limit("100/minute")
async def websocket_endpoint(websocket: WebSocket):
    # Handle connection
    pass
```

## Troubleshooting

### Connection fails immediately

**Cause**: Backend WebSocket endpoint not available
**Solutions**:

- Check backend is running
- Verify WebSocket URL in environment variables
- Check browser console for error messages
- Test endpoint with a WebSocket client tool

### "WebSocket is not connected" warning

**Cause**: Trying to send message before connection established
**Solutions**:

- Check `isConnected` before sending
- Wait for `connectionStatus === "connected"`
- Messages sent while disconnected are logged but not sent

### Reconnection not working

**Cause**: Max reconnect attempts reached
**Solutions**:

- Increase `maxReconnectAttempts`
- Check backend logs for rejection reasons
- Verify authentication token is valid

### High memory usage

**Cause**: Too much data in component state
**Solutions**:

- Limit history size (e.g., keep last 50 points)
- Use pagination for large datasets
- Implement data cleanup intervals

## Advanced Usage

### Multiple Subscriptions

```typescript
function Dashboard() {
  const [bandwidth] = useWebSocketSubscription("bandwidth_update");
  const [sessions] = useWebSocketSubscription("session_update");
  const [tickets] = useWebSocketSubscription("ticket_update");

  // All subscriptions active simultaneously
}
```

### Wildcard Subscription

Listen to all messages:

```typescript
useWebSocket("*", (message) => {
  console.log("Received:", message.type, message.data);
});
```

### Custom Provider Per Module

Create isolated WebSocket connections:

```typescript
<WebSocketProvider url="wss://network-monitoring.example.com/ws">
  <NetworkModule />
</WebSocketProvider>
```

## Related Files

- Provider: `lib/websocket/WebSocketProvider.tsx`
- Examples:
  - `components/realtime/LiveBandwidthChart.tsx`
  - `components/realtime/LiveSessionMonitor.tsx`
- Documentation: `docs/WEBSOCKET_INTEGRATION.md` (this file)
