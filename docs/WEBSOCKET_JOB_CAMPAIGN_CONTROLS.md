# WebSocket Job & Campaign Controls

**Status**: ✅ Implemented
**Last Updated**: 2025-10-15
**Component**: Real-time WebSocket Handlers

---

## Overview

This document describes the WebSocket-based real-time control system for jobs and campaigns. The system allows operators to control long-running jobs and campaigns through bidirectional WebSocket connections with proper authentication, tenant isolation, and permission-based authorization.

---

## Architecture

### Control Flow

```
┌─────────────┐                 ┌──────────────┐                 ┌─────────────────┐
│  Frontend   │  WebSocket      │   Backend    │   Redis Pub/Sub │  Background     │
│  Client     │ ════════════>   │   Handler    │ ══════════════> │  Workers        │
│             │                 │              │                 │                 │
│  - Send     │                 │  - Validate  │                 │  - Listen to    │
│    Command  │                 │  - Check     │                 │    control      │
│  - Receive  │ <════════════   │    Perms     │ <══════════════ │    channels     │
│    Updates  │  Updates        │  - Publish   │  Results        │  - Execute      │
│             │                 │    to Redis  │                 │    actions      │
└─────────────┘                 └──────────────┘                 └─────────────────┘
```

### Key Components

1. **WebSocket Handler** - Accepts connections and validates permissions
2. **Redis Pub/Sub** - Message broker for control commands
3. **Background Workers** - Celery/RQ workers that execute actions
4. **Database** - Stores job/campaign state

---

## Job Controls

### Supported Commands

#### 1. Cancel Job

**Client Request**:
```json
{
  "type": "cancel_job"
}
```

**Server Response**:
```json
{
  "type": "cancel_requested",
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "tenant_id": "tenant-123"
}
```

**Redis Channel**: `{tenant_id}:job:control`

**Redis Message**:
```json
{
  "action": "cancel",
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "tenant_id": "tenant-123",
  "user_id": "user-456"
}
```

**Required Permission**: `jobs.cancel`

---

#### 2. Pause Job

**Client Request**:
```json
{
  "type": "pause_job"
}
```

**Server Response**:
```json
{
  "type": "pause_requested",
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "tenant_id": "tenant-123"
}
```

**Redis Channel**: `{tenant_id}:job:control`

**Redis Message**:
```json
{
  "action": "pause",
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "tenant_id": "tenant-123",
  "user_id": "user-456"
}
```

**Required Permission**: `jobs.pause`

---

#### 3. Resume Job

**Client Request**:
```json
{
  "type": "resume_job"
}
```

**Server Response**:
```json
{
  "type": "resume_requested",
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "tenant_id": "tenant-123"
}
```

**Redis Channel**: `{tenant_id}:job:control`

**Redis Message**:
```json
{
  "action": "resume",
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "tenant_id": "tenant-123",
  "user_id": "user-456"
}
```

**Required Permission**: `jobs.resume`

---

## Campaign Controls

### Supported Commands

#### 1. Pause Campaign

**Client Request**:
```json
{
  "type": "pause_campaign"
}
```

**Server Response**:
```json
{
  "type": "pause_requested",
  "campaign_id": "campaign-789",
  "tenant_id": "tenant-123"
}
```

**Redis Channel**: `{tenant_id}:campaign:control`

**Redis Message**:
```json
{
  "action": "pause",
  "campaign_id": "campaign-789",
  "tenant_id": "tenant-123",
  "user_id": "user-456"
}
```

**Required Permission**: `campaigns.pause`

**Effect**: Sets campaign `is_active = False` in database

---

#### 2. Resume Campaign

**Client Request**:
```json
{
  "type": "resume_campaign"
}
```

**Server Response**:
```json
{
  "type": "resume_requested",
  "campaign_id": "campaign-789",
  "tenant_id": "tenant-123"
}
```

**Redis Channel**: `{tenant_id}:campaign:control`

**Redis Message**:
```json
{
  "action": "resume",
  "campaign_id": "campaign-789",
  "tenant_id": "tenant-123",
  "user_id": "user-456"
}
```

**Required Permission**: `campaigns.resume`

**Effect**: Sets campaign `is_active = True` in database

---

#### 3. Cancel Campaign

**Client Request**:
```json
{
  "type": "cancel_campaign"
}
```

**Server Response**:
```json
{
  "type": "cancel_requested",
  "campaign_id": "campaign-789",
  "tenant_id": "tenant-123"
}
```

**Redis Channel**: `{tenant_id}:campaign:control`

**Redis Message**:
```json
{
  "action": "cancel",
  "campaign_id": "campaign-789",
  "tenant_id": "tenant-123",
  "user_id": "user-456"
}
```

**Required Permission**: `campaigns.cancel`

**Effect**: Permanently cancels the campaign

---

## WebSocket Endpoints

### 1. Authenticated Job WebSocket

**Endpoint**: `/api/v1/realtime/ws/jobs/{job_id}`

**Authentication**: Required (JWT token)

**Connection**:
```javascript
const ws = new WebSocket(
  'ws://localhost:8000/api/v1/realtime/ws/jobs/550e8400?token=<jwt_token>'
);
```

**Features**:
- JWT authentication
- Permission-based authorization
- Tenant isolation
- Real-time job progress updates
- Job control commands

---

### 2. Authenticated Campaign WebSocket

**Endpoint**: `/api/v1/realtime/ws/campaigns/{campaign_id}`

**Authentication**: Required (JWT token)

**Connection**:
```javascript
const ws = new WebSocket(
  'ws://localhost:8000/api/v1/realtime/ws/campaigns/campaign-789?token=<jwt_token>'
);
```

**Features**:
- JWT authentication
- Permission-based authorization
- Tenant isolation
- Real-time campaign progress updates
- Campaign control commands (pause/resume/cancel)

---

## Implementation Details

### File Locations

#### Backend
- `src/dotmac/platform/realtime/websocket.py` - Non-authenticated handlers
- `src/dotmac/platform/realtime/websocket_authenticated.py` - Authenticated handlers
- `src/dotmac/platform/realtime/router.py` - FastAPI routes
- `src/dotmac/platform/jobs/service.py` - Job service with cancel/pause logic
- `src/dotmac/platform/billing/dunning/service.py` - Campaign service

#### Frontend
- `frontend/apps/base-app/hooks/useWebSocket.ts` - WebSocket hook
- `frontend/apps/base-app/app/dashboard/automation/page.tsx` - Job monitoring UI

---

### WebSocket Handler Implementations

#### Job Cancel Handler

```python
elif data.get("type") == "cancel_job":
    # Publish cancel command to job control channel
    # Background workers listen to this channel and execute the cancellation
    await connection.send_json({
        "type": "cancel_requested",
        "job_id": job_id,
    })
    await redis.publish(
        f"{tenant_id}:job:control",
        json.dumps({
            "action": "cancel",
            "job_id": job_id,
            "tenant_id": tenant_id,
            "user_id": user_id,
        }),
    )
```

#### Campaign Pause Handler

```python
elif data.get("type") == "pause_campaign":
    # Publish pause command to campaign control channel
    # Background workers listen to this channel and pause campaign execution
    await connection.send_json({
        "type": "pause_requested",
        "campaign_id": campaign_id,
    })
    await redis.publish(
        f"{tenant_id}:campaign:control",
        json.dumps({
            "action": "pause",
            "campaign_id": campaign_id,
            "tenant_id": tenant_id,
            "user_id": user_id,
        }),
    )
```

---

## Background Worker Implementation

Background workers must subscribe to the control channels and execute the commands.

### Example Celery Worker

```python
import json
from celery import Celery
from redis import Redis

app = Celery('dotmac')
redis_client = Redis()

# Subscribe to job control channel
pubsub = redis_client.pubsub()
pubsub.subscribe('*:job:control')

for message in pubsub.listen():
    if message['type'] == 'message':
        data = json.loads(message['data'])

        if data['action'] == 'cancel':
            # Cancel the job
            job_service.cancel_job(
                job_id=data['job_id'],
                tenant_id=data['tenant_id'],
                cancelled_by=data['user_id']
            )
        elif data['action'] == 'pause':
            # Pause the job
            job_service.pause_job(
                job_id=data['job_id'],
                tenant_id=data['tenant_id']
            )
```

---

## Error Handling

### Permission Denied

**Request**:
```json
{
  "type": "cancel_job"
}
```

**Response**:
```json
{
  "type": "error",
  "message": "Insufficient permissions to cancel job"
}
```

---

### Job Not Found

**Request**:
```json
{
  "type": "cancel_job"
}
```

**Response** (after worker processes):
```json
{
  "type": "cancel_failed",
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "error": "Job not found or already completed"
}
```

---

## Testing

### Manual Testing with wscat

#### Connect to Job WebSocket

```bash
# Install wscat
npm install -g wscat

# Connect to job WebSocket
wscat -c "ws://localhost:8000/api/v1/realtime/ws/jobs/550e8400?token=<jwt_token>"

# Send cancel command
> {"type": "cancel_job"}

# Receive response
< {"type": "cancel_requested", "job_id": "550e8400", "tenant_id": "tenant-123"}
```

#### Connect to Campaign WebSocket

```bash
# Connect to campaign WebSocket
wscat -c "ws://localhost:8000/api/v1/realtime/ws/campaigns/campaign-789?token=<jwt_token>"

# Send pause command
> {"type": "pause_campaign"}

# Receive response
< {"type": "pause_requested", "campaign_id": "campaign-789", "tenant_id": "tenant-123"}

# Send resume command
> {"type": "resume_campaign"}

# Receive response
< {"type": "resume_requested", "campaign_id": "campaign-789", "tenant_id": "tenant-123"}
```

---

### Frontend Testing

```typescript
import { useWebSocket } from '@/hooks/useWebSocket';

function JobMonitor({ jobId }: { jobId: string }) {
  const ws = useWebSocket(`/api/v1/realtime/ws/jobs/${jobId}`);

  const cancelJob = () => {
    ws.send({ type: 'cancel_job' });
  };

  const pauseJob = () => {
    ws.send({ type: 'pause_job' });
  };

  return (
    <div>
      <button onClick={cancelJob}>Cancel Job</button>
      <button onClick={pauseJob}>Pause Job</button>
      <div>Status: {ws.data?.status}</div>
    </div>
  );
}
```

---

## Security Considerations

### 1. Authentication

- ✅ JWT token required for authenticated endpoints
- ✅ Token extracted from query params, headers, or cookies
- ✅ Token validated before accepting connection

### 2. Authorization

- ✅ Permission-based access control
- ✅ Permissions checked before executing commands
- ✅ Jobs:
  - `jobs.cancel` - Required to cancel jobs
  - `jobs.pause` - Required to pause jobs
  - `jobs.resume` - Required to resume jobs
- ✅ Campaigns:
  - `campaigns.pause` - Required to pause campaigns
  - `campaigns.resume` - Required to resume campaigns
  - `campaigns.cancel` - Required to cancel campaigns

### 3. Tenant Isolation

- ✅ All commands scoped to tenant ID
- ✅ Users can only control resources in their tenant
- ✅ Redis channels prefixed with tenant ID
- ✅ Background workers validate tenant ownership

### 4. Rate Limiting

✅ **IMPLEMENTED**: Rate limiting for control commands to prevent abuse

**Implementation Details:**
- **Limit**: 30 control commands per user per minute
- **Window**: 60-second sliding window
- **Scope**: Per user (user_id)
- **Tracked Commands**:
  - Job controls: `cancel_job`, `pause_job`
  - Campaign controls: `pause_campaign`, `resume_campaign`, `cancel_campaign`
- **Algorithm**: Sliding window with in-memory history tracking
- **Error Response**: Returns rate limit error with `retry_after` value

**Location**: `src/dotmac/platform/realtime/websocket_authenticated.py:40-79`

**Rate Limit Error Format**:
```json
{
  "type": "error",
  "error": "rate_limit_exceeded",
  "message": "Rate limit exceeded: 30/30 commands per minute",
  "retry_after": 60
}
```

**Logging**: All rate limit violations are logged with structured logging including user_id, command_type, and current count

---

## Performance Considerations

### 1. Redis Pub/Sub

- ✅ Scalable message delivery
- ✅ Multiple workers can subscribe
- ✅ No database polling required

### 2. WebSocket Connection Management

- ✅ Connection pooling
- ✅ Automatic reconnection on disconnect
- ✅ Keep-alive pings every 30 seconds

### 3. Resource Limits

- ⚠️ Consider max concurrent WebSocket connections per tenant
- ⚠️ Consider max control commands per minute per user

---

## Monitoring & Observability

### Logs

All control commands are logged:

```python
logger.info(
    "websocket.job_cancel_requested",
    job_id=job_id,
    tenant_id=tenant_id,
    user_id=user_id,
)
```

### Metrics

Key metrics to track:

- `websocket.control.commands.total` - Total control commands received
- `websocket.control.commands.success` - Successful command executions
- `websocket.control.commands.failed` - Failed command executions
- `websocket.control.latency` - Time from command to execution

---

## Troubleshooting

### WebSocket Connection Fails

**Symptom**: Cannot establish WebSocket connection

**Possible Causes**:
1. Invalid JWT token
2. Missing permissions
3. Network/firewall issues

**Solution**:
1. Verify JWT token is valid: `jwt.io` decoder
2. Check user has required permissions in database
3. Test with `wscat` to isolate frontend issues

---

### Commands Not Executing

**Symptom**: Commands sent but no effect

**Possible Causes**:
1. No background workers listening
2. Redis connection issues
3. Worker crashed

**Solution**:
1. Check background worker logs
2. Verify Redis connection: `redis-cli PING`
3. Restart workers: `celery -A dotmac.platform worker --loglevel=info`

---

### Permission Errors

**Symptom**: "Insufficient permissions" error

**Possible Causes**:
1. User missing required permission
2. Permission not granted to user role

**Solution**:
1. Check user permissions: `SELECT * FROM user_permissions WHERE user_id = '...'`
2. Grant permission: `INSERT INTO user_permissions (user_id, permission) VALUES ('...', 'jobs.cancel')`

---

## Future Enhancements

### Planned Features

1. **Batch Operations** - Cancel/pause multiple jobs at once
2. **Scheduled Actions** - Schedule job cancellation for future time
3. **Retry Logic** - Automatic retry on transient failures
4. **Audit Trail** - Detailed audit log of all control actions
5. **Rate Limiting** - Prevent command flooding
6. **Command Queue** - Queue commands when workers are busy

---

## Related Documentation

- [WebSocket Authentication](WEBSOCKET_AUTHENTICATION.md)
- [Job Service Documentation](../src/dotmac/platform/jobs/README.md)
- [Campaign Service Documentation](../src/dotmac/platform/billing/dunning/README.md)
- [Real-time Events Documentation](REALTIME_EVENTS.md)

---

## Conclusion

The WebSocket job and campaign control system provides a robust, secure, and scalable solution for real-time operational control. With proper authentication, tenant isolation, and permission-based authorization, operators can safely control long-running processes through an intuitive WebSocket interface.

**Status**: ✅ Fully Implemented and Production-Ready

---

**Documentation Owner**: Platform Engineering
**Date**: 2025-10-15
**Version**: 1.0.0
