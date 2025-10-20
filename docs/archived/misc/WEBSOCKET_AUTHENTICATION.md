# WebSocket Authentication and Tenant Isolation

Complete guide to secure WebSocket authentication with multi-tenant isolation in the DotMac FTTH Operations Platform.

## Table of Contents

- [Overview](#overview)
- [Authentication Methods](#authentication-methods)
- [WebSocket Endpoints](#websocket-endpoints)
- [Tenant Isolation](#tenant-isolation)
- [Permission Model](#permission-model)
- [Connection Manager](#connection-manager)
- [Client Examples](#client-examples)
- [Security Best Practices](#security-best-practices)
- [Troubleshooting](#troubleshooting)

## Overview

The WebSocket authentication system provides secure, real-time bidirectional communication with the following features:

- **JWT Token Authentication**: Industry-standard authentication
- **Multi-Tenant Isolation**: Automatic tenant-scoping of all connections
- **Permission-Based Authorization**: Granular permission checks
- **Connection Tracking**: Centralized management of active connections
- **Resource-Specific Channels**: Subscribe to updates for specific resources
- **Automatic Cleanup**: Proper resource management on disconnect

### Architecture

```
┌─────────────────┐
│  WebSocket      │
│  Client         │
└────────┬────────┘
         │ 1. Connect with JWT token
         ▼
┌─────────────────┐
│  Auth Layer     │  ← extract_token_from_websocket()
│  - Extract      │  ← authenticate_websocket()
│  - Verify       │  ← authorize_websocket_resource()
│  - Authorize    │  ← validate_tenant_isolation()
└────────┬────────┘
         │ 2. Register connection
         ▼
┌─────────────────┐
│  Connection     │  ← WebSocketConnectionManager
│  Manager        │  ← Track by tenant, user, resource
└────────┬────────┘
         │ 3. Subscribe to Redis pub/sub
         ▼
┌─────────────────┐
│  Redis Pub/Sub  │  ← Tenant-isolated channels
│  - sessions:    │
│    {tenant_id}  │
│  - job:         │
│    {tenant}:{id}│
└─────────────────┘
```

## Authentication Methods

WebSocket connections can be authenticated using three methods (in order of precedence):

### 1. Query Parameter (Recommended for Browsers)

```
ws://localhost:8000/api/v1/realtime/ws/sessions?token=<jwt_token>
```

**Pros:**
- Simple for browser clients
- No additional headers required
- Works with EventSource API

**Cons:**
- Token visible in URL
- May be logged in access logs

### 2. Authorization Header (Recommended for APIs)

```javascript
const ws = new WebSocket('ws://localhost:8000/api/v1/realtime/ws/sessions');
ws.setRequestHeader('Authorization', 'Bearer <jwt_token>');
```

**Pros:**
- Standard HTTP authentication
- Token not in URL
- Better security posture

**Cons:**
- Not supported by all WebSocket clients
- Requires custom header support

### 3. Cookie

Cookies are automatically sent by the browser if available.

```
Cookie: access_token=<jwt_token>
```

**Pros:**
- Automatic for browser clients
- HttpOnly cookies protect against XSS

**Cons:**
- Requires CORS configuration
- CSRF considerations

## WebSocket Endpoints

### RADIUS Session Updates

Stream real-time RADIUS session events.

```
ws://localhost:8000/api/v1/realtime/ws/sessions?token=<jwt_token>
```

**Required Permissions:**
- `sessions.read` OR `radius.sessions.read`

**Events Received:**
- `session_start` - User authenticated and started session
- `session_update` - Interim accounting update
- `session_stop` - User disconnected

**Client Commands:**
- `{"type": "ping"}` - Keep-alive ping (responds with `pong`)
- `{"type": "query_session", "session_id": "abc123"}` - Query session details

**Example:**

```javascript
const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
const ws = new WebSocket(`ws://localhost:8000/api/v1/realtime/ws/sessions?token=${token}`);

ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    console.log('Event type:', data.type);

    switch (data.type) {
        case 'subscribed':
            console.log('Subscribed to channel:', data.channel);
            break;
        case 'session_start':
            console.log('Session started:', data);
            break;
        case 'session_stop':
            console.log('Session stopped:', data);
            break;
    }
};

// Send ping to keep connection alive
ws.send(JSON.stringify({type: 'ping'}));
```

### Job Progress Monitoring

Monitor real-time progress updates for background jobs.

```
ws://localhost:8000/api/v1/realtime/ws/jobs/{job_id}?token=<jwt_token>
```

**Required Permissions:**
- `jobs.read` (for monitoring)
- `jobs.pause` (for pausing)
- `jobs.cancel` (for cancelling)

**Events Received:**
- `job_created` - Job has been created
- `job_progress` - Progress update (includes percentage)
- `job_completed` - Job finished successfully
- `job_failed` - Job failed with error

**Client Commands:**
- `{"type": "ping"}` - Keep-alive ping
- `{"type": "pause_job"}` - Pause job execution (requires `jobs.pause`)
- `{"type": "cancel_job"}` - Cancel job execution (requires `jobs.cancel`)

**Example:**

```javascript
const ws = new WebSocket(`ws://localhost:8000/api/v1/realtime/ws/jobs/123?token=${token}`);

ws.onmessage = (event) => {
    const data = JSON.parse(event.data);

    if (data.type === 'job_progress') {
        updateProgressBar(data.percentage);
    }
};

// Cancel job if needed
function cancelJob() {
    ws.send(JSON.stringify({type: 'cancel_job'}));
}
```

### Firmware Campaign Progress

Monitor firmware upgrade campaigns.

```
ws://localhost:8000/api/v1/realtime/ws/campaigns/{campaign_id}?token=<jwt_token>
```

**Required Permissions:**
- `campaigns.read` OR `firmware.campaigns.read` (for monitoring)
- `campaigns.pause` (for pausing)
- `campaigns.resume` (for resuming)
- `campaigns.cancel` (for cancelling)

**Events Received:**
- `campaign_started` - Campaign initiated
- `device_upgrading` - Individual device upgrade started
- `device_upgraded` - Device upgrade completed
- `campaign_completed` - All devices upgraded

**Client Commands:**
- `{"type": "ping"}` - Keep-alive ping
- `{"type": "pause_campaign"}` - Pause campaign
- `{"type": "resume_campaign"}` - Resume paused campaign
- `{"type": "cancel_campaign"}` - Cancel campaign

## Tenant Isolation

All WebSocket connections are automatically isolated by tenant. This ensures that:

1. **Users only see their tenant's data**
2. **Redis channels are tenant-prefixed**
3. **Cross-tenant access is prevented**
4. **Events include tenant_id for verification**

### How It Works

1. **Token Verification**: JWT token contains `tenant_id` claim
2. **User Info Extraction**: `UserInfo` object includes tenant_id
3. **Channel Prefixing**: All Redis channels prefixed with tenant ID

   ```python
   # Sessions channel for tenant123
   channel = "tenant123:sessions"

   # Job channel for tenant123
   channel = "tenant123:job:job456"
   ```

4. **Event Validation**: Published events include tenant_id for verification

   ```json
   {
       "type": "session_start",
       "tenant_id": "tenant123",
       "session_id": "abc123",
       ...
   }
   ```

5. **Isolation Checks**: Server validates event tenant_id matches connection tenant_id

### Tenant Isolation Violation Detection

The system actively monitors for tenant isolation violations:

```python
# Example: Server detects mismatch
if event_tenant_id != connection.tenant_id:
    logger.error(
        "websocket.tenant_isolation.violated_in_pubsub",
        connection_tenant_id=connection.tenant_id,
        event_tenant_id=event_tenant_id,
    )
    # Event is dropped, not forwarded to client
    continue
```

## Permission Model

WebSocket endpoints use the same permission model as REST APIs.

### Permission Format

Permissions follow the pattern: `{resource}.{action}`

Examples:
- `sessions.read` - Read RADIUS sessions
- `jobs.read` - Read job status
- `jobs.pause` - Pause jobs
- `jobs.cancel` - Cancel jobs
- `campaigns.read` - Read campaigns
- `campaigns.pause` - Pause campaigns

### Permission Checks

Permissions are checked at two points:

1. **Connection Acceptance**

   ```python
   user_info = await accept_websocket_with_auth(
       websocket,
       required_permissions=["jobs.read"]
   )
   ```

2. **Command Execution**

   ```python
   if data.get("type") == "cancel_job":
       if "jobs.cancel" in user_info.permissions:
           # Allow cancellation
       else:
           # Send error response
   ```

### Multiple Permission Options

Some endpoints accept multiple permissions (OR logic):

```python
required_permissions=["sessions.read", "radius.sessions.read"]
# User needs EITHER sessions.read OR radius.sessions.read
```

## Connection Manager

The `WebSocketConnectionManager` provides centralized tracking and management of all active connections.

### Features

- **Tenant Grouping**: Track all connections by tenant
- **User Grouping**: Track all connections by user (multi-tab support)
- **Resource Grouping**: Track connections watching specific resources
- **Broadcasting**: Send messages to groups of connections
- **Statistics**: Monitor connection counts and resource usage

### Usage

```python
from dotmac.platform.realtime.connection_manager import connection_manager

# Register connection
conn_id = connection_manager.register(
    websocket=websocket,
    user_info=user_info,
    resource_type="job",
    resource_id="job123"
)

# Broadcast to all tenant connections
await connection_manager.broadcast_to_tenant(
    "tenant123",
    {"type": "alert", "message": "System maintenance in 5 minutes"}
)

# Broadcast to specific resource watchers
await connection_manager.broadcast_to_resource(
    "job",
    "job123",
    {"type": "job_completed", "status": "success"}
)

# Get statistics
stats = connection_manager.get_stats()
print(f"Active connections: {stats['total_connections']}")

# Unregister on disconnect
connection_manager.unregister(conn_id)
```

### Broadcasting Patterns

#### 1. Tenant-Wide Broadcast

Send to all connections in a tenant:

```python
# System alerts, maintenance notices
await connection_manager.broadcast_to_tenant(
    tenant_id="tenant123",
    message={"type": "alert", "severity": "warning", "text": "..."}
)
```

#### 2. Resource-Specific Broadcast

Send to all connections watching a resource:

```python
# Job updates
await connection_manager.broadcast_to_resource(
    resource_type="job",
    resource_id="job456",
    message={"type": "job_progress", "percentage": 75}
)
```

#### 3. User-Specific Broadcast

Send to all connections of a user (multi-tab):

```python
# User notifications
await connection_manager.broadcast_to_user(
    user_id="user789",
    message={"type": "notification", "text": "Password changed successfully"}
)
```

## Client Examples

### JavaScript/Browser

```javascript
class WebSocketClient {
    constructor(url, token) {
        this.url = url;
        this.token = token;
        this.ws = null;
        this.reconnectDelay = 1000;
        this.maxReconnectDelay = 30000;
    }

    connect() {
        const wsUrl = `${this.url}?token=${this.token}`;
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
            console.log('Connected');
            this.reconnectDelay = 1000;
            this.startPingInterval();
        };

        this.ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            this.handleMessage(data);
        };

        this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
        };

        this.ws.onclose = () => {
            console.log('Disconnected, reconnecting...');
            this.stopPingInterval();
            this.reconnect();
        };
    }

    reconnect() {
        setTimeout(() => {
            this.connect();
            this.reconnectDelay = Math.min(
                this.reconnectDelay * 2,
                this.maxReconnectDelay
            );
        }, this.reconnectDelay);
    }

    startPingInterval() {
        this.pingInterval = setInterval(() => {
            this.send({type: 'ping'});
        }, 30000); // Ping every 30 seconds
    }

    stopPingInterval() {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
        }
    }

    send(data) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(data));
        }
    }

    handleMessage(data) {
        console.log('Received:', data);
        // Implement your message handling logic
    }

    close() {
        this.stopPingInterval();
        if (this.ws) {
            this.ws.close();
        }
    }
}

// Usage
const client = new WebSocketClient(
    'ws://localhost:8000/api/v1/realtime/ws/sessions',
    'your_jwt_token_here'
);
client.connect();
```

### Python Client

```python
import asyncio
import json
import websockets

async def connect_websocket(url: str, token: str):
    """Connect to authenticated WebSocket."""
    headers = {"Authorization": f"Bearer {token}"}

    async with websockets.connect(url, extra_headers=headers) as websocket:
        print("Connected")

        # Start ping task
        ping_task = asyncio.create_task(send_pings(websocket))

        try:
            async for message in websocket:
                data = json.loads(message)
                print(f"Received: {data}")

                # Handle specific message types
                if data.get("type") == "session_start":
                    print(f"Session started: {data['session_id']}")
                elif data.get("type") == "pong":
                    print("Pong received")
        finally:
            ping_task.cancel()

async def send_pings(websocket):
    """Send periodic ping messages."""
    while True:
        await asyncio.sleep(30)
        await websocket.send(json.dumps({"type": "ping"}))

# Run
asyncio.run(connect_websocket(
    "ws://localhost:8000/api/v1/realtime/ws/sessions",
    "your_jwt_token_here"
))
```

### React Hook

```typescript
import { useEffect, useState, useRef } from 'react';

interface WebSocketMessage {
    type: string;
    [key: string]: any;
}

export function useWebSocket(url: string, token: string) {
    const [messages, setMessages] = useState<WebSocketMessage[]>([]);
    const [isConnected, setIsConnected] = useState(false);
    const wsRef = useRef<WebSocket | null>(null);
    const reconnectTimeoutRef = useRef<number>();

    useEffect(() => {
        let reconnectDelay = 1000;
        const maxReconnectDelay = 30000;

        function connect() {
            const ws = new WebSocket(`${url}?token=${token}`);
            wsRef.current = ws;

            ws.onopen = () => {
                console.log('WebSocket connected');
                setIsConnected(true);
                reconnectDelay = 1000;

                // Start ping interval
                const pingInterval = setInterval(() => {
                    if (ws.readyState === WebSocket.OPEN) {
                        ws.send(JSON.stringify({type: 'ping'}));
                    }
                }, 30000);

                // Clean up ping on close
                ws.addEventListener('close', () => {
                    clearInterval(pingInterval);
                });
            };

            ws.onmessage = (event) => {
                const data = JSON.parse(event.data);
                setMessages(prev => [...prev, data]);
            };

            ws.onerror = (error) => {
                console.error('WebSocket error:', error);
            };

            ws.onclose = () => {
                console.log('WebSocket disconnected');
                setIsConnected(false);

                // Reconnect with exponential backoff
                reconnectTimeoutRef.current = window.setTimeout(() => {
                    reconnectDelay = Math.min(reconnectDelay * 2, maxReconnectDelay);
                    connect();
                }, reconnectDelay);
            };
        }

        connect();

        return () => {
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
            }
            if (wsRef.current) {
                wsRef.current.close();
            }
        };
    }, [url, token]);

    const sendMessage = (message: any) => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify(message));
        }
    };

    return { messages, isConnected, sendMessage };
}

// Usage in component
function SessionMonitor() {
    const { messages, isConnected, sendMessage } = useWebSocket(
        'ws://localhost:8000/api/v1/realtime/ws/sessions',
        getAuthToken()
    );

    return (
        <div>
            <div>Status: {isConnected ? 'Connected' : 'Disconnected'}</div>
            {messages.map((msg, i) => (
                <div key={i}>{msg.type}: {JSON.stringify(msg)}</div>
            ))}
        </div>
    );
}
```

## Security Best Practices

### 1. Token Management

```javascript
// ✅ DO: Store tokens securely
const token = localStorage.getItem('access_token');

// ❌ DON'T: Hardcode tokens
const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
```

### 2. Token Refresh

```javascript
// Refresh token before it expires
async function getValidToken() {
    const token = getStoredToken();
    const expiresAt = parseJWT(token).exp * 1000;

    if (Date.now() >= expiresAt - 60000) { // Refresh 1 min before expiry
        return await refreshToken();
    }

    return token;
}
```

### 3. Connection Limits

Implement client-side connection limits:

```javascript
const MAX_RECONNECT_ATTEMPTS = 5;
let reconnectAttempts = 0;

function reconnect() {
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        console.error('Max reconnection attempts reached');
        return;
    }

    reconnectAttempts++;
    setTimeout(connect, 1000 * reconnectAttempts);
}
```

### 4. Message Validation

Always validate received messages:

```javascript
ws.onmessage = (event) => {
    let data;
    try {
        data = JSON.parse(event.data);
    } catch (e) {
        console.error('Invalid JSON received');
        return;
    }

    if (!data.type) {
        console.error('Message missing type field');
        return;
    }

    handleMessage(data);
};
```

### 5. HTTPS/WSS in Production

```javascript
// ✅ DO: Use WSS in production
const wsUrl = process.env.NODE_ENV === 'production'
    ? 'wss://api.example.com/api/v1/realtime/ws/sessions'
    : 'ws://localhost:8000/api/v1/realtime/ws/sessions';

// ❌ DON'T: Use WS in production
const wsUrl = 'ws://api.example.com/api/v1/realtime/ws/sessions';
```

## Troubleshooting

### Connection Refused

**Problem**: WebSocket connection immediately closes with 1006 error.

**Solutions**:
1. Verify token is valid: `curl -H "Authorization: Bearer $TOKEN" http://localhost:8000/api/v1/auth/me`
2. Check server is running
3. Verify WebSocket endpoint path is correct
4. Check firewall/proxy settings

### Authentication Failed

**Problem**: Connection closes with 1008 (Policy Violation).

**Solutions**:
1. Verify token includes required claims (`tenant_id`, `sub`, `permissions`)
2. Check token hasn't expired
3. Verify user has required permissions
4. Check server logs for detailed error

### No Events Received

**Problem**: Connection established but no events received.

**Solutions**:
1. Verify events are being published to Redis
2. Check Redis channel name matches tenant ID
3. Verify tenant isolation isn't filtering events
4. Send ping to verify connection is alive

### Tenant Isolation Violations

**Problem**: Events from other tenants appearing in logs.

**Solutions**:
1. Check event publishing includes correct tenant_id
2. Verify Redis channels are tenant-prefixed
3. Review tenant_id in JWT token claims
4. Check connection manager tenant grouping

### High Memory Usage

**Problem**: Server memory grows over time.

**Solutions**:
1. Ensure connections are properly unregistered on disconnect
2. Check for Redis pub/sub cleanup
3. Monitor connection count: `GET /api/v1/realtime/stats`
4. Implement connection limits per tenant

### Performance Issues

**Problem**: Slow message delivery or high latency.

**Solutions**:
1. Use Redis Cluster for scalability
2. Implement message batching
3. Reduce ping frequency if needed
4. Monitor Redis pub/sub performance
5. Consider horizontal scaling

## API Reference

See the following modules for detailed API documentation:

- `src/dotmac/platform/realtime/auth.py` - Authentication utilities
- `src/dotmac/platform/realtime/websocket_authenticated.py` - Authenticated handlers
- `src/dotmac/platform/realtime/connection_manager.py` - Connection management
- `src/dotmac/platform/realtime/router.py` - WebSocket endpoints

## Testing

Run the test suite:

```bash
# All WebSocket tests
poetry run pytest tests/realtime/

# Authentication tests only
poetry run pytest tests/realtime/test_websocket_auth.py

# Connection manager tests only
poetry run pytest tests/realtime/test_connection_manager.py
```

## Production Deployment

### Environment Variables

```bash
# Redis Configuration
REDIS_URL=redis://redis:6379/0
REDIS_PASSWORD=your_secure_password

# JWT Configuration
JWT_SECRET_KEY=your_secret_key_here
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=15

# WebSocket Configuration
WEBSOCKET_PING_INTERVAL=30
WEBSOCKET_MAX_CONNECTIONS_PER_TENANT=100
```

### Load Balancing

For horizontal scaling, use sticky sessions:

```nginx
upstream websocket_backend {
    ip_hash;  # Sticky sessions
    server backend1:8000;
    server backend2:8000;
    server backend3:8000;
}

server {
    location /api/v1/realtime/ws/ {
        proxy_pass http://websocket_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
```

### Monitoring

Monitor these metrics:

- Active WebSocket connections per tenant
- Authentication failure rate
- Message throughput
- Redis pub/sub latency
- Reconnection rate
- Memory usage per connection

---

**Version**: 1.0.0
**Last Updated**: 2025-01-15
**Status**: Production Ready
