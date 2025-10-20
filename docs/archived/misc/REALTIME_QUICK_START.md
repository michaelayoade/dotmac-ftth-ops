# Real-Time Features - Quick Start

## 🎯 What's Already Working

### 1. ✅ Main Dashboard Layout
**File**: `frontend/apps/base-app/app/dashboard/layout.tsx`

**Visible on ALL dashboard pages:**
- **Bottom-right corner**: Floating connection status indicator
  - Click to see all 5 SSE connection statuses
  - Shows green dot when connected
  - Shows detailed connection info when clicked

- **Background (invisible)**: Alert toast notifications
  - Automatically shows toasts for critical alerts
  - Warning severity and above
  - 4-10 second duration based on severity

**Access**: Navigate to ANY page under `/dashboard/*`

---

### 2. ✅ Live RADIUS Sessions Page
**File**: `frontend/apps/base-app/app/dashboard/network/sessions/live/page.tsx`

**URL**: `/dashboard/network/sessions/live`

**Features:**
- Real-time table of active authentication sessions
- Auto-updates when sessions start/stop/update
- Shows RX/TX traffic
- Session duration tracking
- Connection status

**To Access**:
```
Navigate to: http://localhost:3000/dashboard/network/sessions/live
```

---

## 🚀 How to Use It Right Now

### Step 1: Start Your Application
```bash
cd frontend/apps/base-app
pnpm dev
```

### Step 2: Login to Dashboard
```
http://localhost:3000/login
```

### Step 3: See Real-Time Features

#### Option A: Check Connection Status
1. Go to any dashboard page
2. Look at **bottom-right corner**
3. You'll see a small green indicator
4. **Click it** to expand and see all connection statuses

#### Option B: View Live Sessions
1. Navigate to: `/dashboard/network/sessions/live`
2. You'll see the live sessions table
3. When RADIUS sessions start, they appear automatically

#### Option C: Test Alert Notifications
From Python backend, run:
```python
from dotmac.platform.realtime.publishers import EventPublisher
import asyncio

async def test_alert():
    from dotmac.platform.redis_client import get_redis_client
    redis = await get_redis_client()
    publisher = EventPublisher(redis)

    await publisher.publish_alert(
        tenant_id="your-tenant-id",
        alert_id="test-001",
        alert_type="test",
        severity="warning",
        source="manual-test",
        message="This is a test alert!",
    )

asyncio.run(test_alert())
```

You'll see a toast notification appear in your browser!

---

## 📍 Integration Points Map

```
frontend/apps/base-app/
│
├── app/
│   └── dashboard/
│       ├── layout.tsx ✅ INTEGRATED
│       │   ├── Line 51-52: Imports
│       │   ├── Line 584: <ConnectionStatusIndicator />
│       │   └── Line 587: <RealtimeAlerts />
│       │
│       └── network/
│           └── sessions/
│               └── live/
│                   └── page.tsx ✅ NEW PAGE
│
├── components/
│   └── realtime/
│       ├── ConnectionStatusIndicator.tsx ✅ READY
│       ├── RealtimeAlerts.tsx ✅ READY
│       └── LiveRadiusSessions.tsx ✅ READY
│
├── hooks/
│   └── useRealtime.ts ✅ READY
│       ├── useONUStatusEvents
│       ├── useAlertEvents
│       ├── useTicketEvents
│       ├── useSubscriberEvents
│       ├── useRADIUSSessionEvents
│       ├── useSessionsWebSocket
│       ├── useJobWebSocket
│       └── useCampaignWebSocket
│
├── lib/
│   └── realtime/
│       ├── sse-client.ts ✅ READY
│       └── websocket-client.ts ✅ READY
│
└── types/
    └── realtime.ts ✅ READY
```

---

## 🎨 Where You'll See It

### In Your Browser

```
┌─────────────────────────────────────────────────────────┐
│  Dashboard Header (any /dashboard/* page)               │
├─────────────────────────────────────────────────────────┤
│                                                         │
│                                                         │
│                  Your Page Content                      │
│                                                         │
│                                                         │
│                                             ┌─────────┐ │
│                                             │  ●  🟢  │ │ <- Connection Status
│                                             └─────────┘ │    (bottom-right)
│                                                         │
└─────────────────────────────────────────────────────────┘

Toast Notifications appear here when alerts occur:
┌────────────────────────────────┐
│ ⚠️  Signal Degradation         │
│ OLT-01 PON Port 3              │
│ [View Details]                 │
└────────────────────────────────┘
```

### Connection Indicator (Expanded)

```
Click the green dot to see:

┌──────────────────────────────────┐
│ ⚡ Real-Time Connections    ✕   │
├──────────────────────────────────┤
│ 📡 ONU Status          ✅ Connected│
│    Device status updates         │
│                                  │
│ 🚨 Alerts              ✅ Connected│
│    System and network alerts     │
│                                  │
│ 🎫 Tickets             ✅ Connected│
│    Support ticket updates        │
│                                  │
│ 👥 Subscribers         ✅ Connected│
│    Subscriber lifecycle events   │
│                                  │
│ 🔐 RADIUS Sessions     ✅ Connected│
│    Authentication sessions       │
├──────────────────────────────────┤
│ Overall Status     ✅ Connected   │
└──────────────────────────────────┘
```

### Live Sessions Page

```
/dashboard/network/sessions/live

┌─────────────────────────────────────────────────────────┐
│ 📡 Live RADIUS Sessions                      [Live 🟢]  │
├─────────────────────────────────────────────────────────┤
│  ┌──────────────┬──────────────┬──────────────┐         │
│  │ Active: 15   │ Total RX    │ Total TX     │         │
│  │              │ 2.5 GB      │ 1.8 GB       │         │
│  └──────────────┴──────────────┴──────────────┘         │
│                                                         │
│  Username        NAS IP        User IP     RX     TX   │
│  ────────────────────────────────────────────────────  │
│  🟢 user1@isp    10.0.0.1     100.64.1.5   45MB  32MB │
│  🟢 user2@isp    10.0.0.1     100.64.1.6   78MB  56MB │
│  🟢 user3@isp    10.0.0.2     100.64.1.7   12MB  8MB  │
│                                                         │
│  ← New sessions appear automatically here →            │
└─────────────────────────────────────────────────────────┘
```

---

## 🔧 Environment Setup

**Required**: Add to `.env.local`

```bash
NEXT_PUBLIC_API_URL=http://localhost:8000
```

That's it! The hooks automatically:
- Extract JWT token from auth context
- Connect to backend endpoints
- Handle reconnection
- Clean up on unmount

---

## 📝 Add More Real-Time Features

### Example 1: Add to Network Monitoring Page

Edit: `frontend/apps/base-app/app/dashboard/network-monitoring/page.tsx`

```typescript
'use client';

import { useONUStatusEvents } from '@/hooks/useRealtime';
import { toast } from 'sonner';

export default function NetworkMonitoring() {
  // Add this hook
  useONUStatusEvents((event) => {
    if (event.event_type === 'onu.offline') {
      toast.error(`ONU Offline: ${event.onu_serial}`);
    }
  });

  // ... rest of your existing code
}
```

**Result**: Toast notification when any ONU goes offline!

### Example 2: Add to Tickets Page

Edit: `frontend/apps/base-app/app/dashboard/support/page.tsx`

```typescript
'use client';

import { useTicketEvents } from '@/hooks/useRealtime';
import { useQueryClient } from '@tanstack/react-query';

export default function TicketsPage() {
  const queryClient = useQueryClient();

  // Add this hook
  useTicketEvents((event) => {
    // Auto-refresh ticket list
    queryClient.invalidateQueries({ queryKey: ['tickets'] });

    // Show notification
    if (event.event_type === 'ticket.created') {
      toast.info(`New ticket: ${event.ticket_number}`);
    }
  });

  // ... rest of your existing code
}
```

**Result**: Ticket list refreshes automatically + notification on new tickets!

---

## 🧪 Quick Test

### Test 1: Connection Status
1. Go to `/dashboard`
2. Look at bottom-right corner
3. Click the green dot
4. Should see 5 connections as "Connected"

### Test 2: Alert Notification
Run from backend:
```python
# See "How to Use It Right Now" → Option C above
```

Should see toast notification appear!

### Test 3: Live Sessions
1. Go to `/dashboard/network/sessions/live`
2. Start a RADIUS authentication
3. Session should appear in table immediately

---

## 📚 Full Documentation

- **This Quick Start**: `docs/REALTIME_QUICK_START.md` (you are here)
- **Integration Examples**: `docs/REALTIME_INTEGRATION_GUIDE.md`
- **Complete Reference**: `docs/REALTIME_FRONTEND_IMPLEMENTATION.md`

---

## ✅ Summary

**Already Working:**
1. ✅ Connection status indicator (all dashboard pages)
2. ✅ Alert toast notifications (automatic, site-wide)
3. ✅ Live RADIUS sessions page

**Available Hooks to Use:**
- `useONUStatusEvents` - ONU device status
- `useAlertEvents` - Network alerts
- `useTicketEvents` - Support tickets
- `useSubscriberEvents` - Subscriber lifecycle
- `useRADIUSSessionEvents` - Auth sessions
- `useJobWebSocket` - Job progress (with pause/cancel)
- `useCampaignWebSocket` - Campaign progress

**Next Steps:**
1. Check environment variable is set
2. Run `pnpm dev`
3. Login to dashboard
4. Click connection indicator (bottom-right)
5. Navigate to `/dashboard/network/sessions/live`
6. Add hooks to your pages (copy examples above)

That's it! 🎉
