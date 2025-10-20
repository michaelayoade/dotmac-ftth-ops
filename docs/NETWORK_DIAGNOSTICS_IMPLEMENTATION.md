# Network Diagnostics Implementation

**Date:** October 19, 2025  
**Status:** ✅ Delivered to production  
**Focus:** Radius session control & field diagnostics

---

## Overview

This iteration ships the first slice of the Network Diagnostics toolkit for DotMac FTTH Operations. Operators can now terminate live RADIUS sessions, run ad-hoc pings, and issue traceroutes directly from the dashboard with consistent error handling and toast-driven feedback. The work closes the Day 3 requirement from the Frontend Gaps Implementation Plan and lines up with the existing backend API contracts.

---

## Key Deliverables

### 1. `useNetworkDiagnostics` Hook

- **Path:** `frontend/apps/base-app/hooks/useNetworkDiagnostics.ts`
- Centralises mutations for:
  - `disconnectSession` → `POST /radius/sessions/disconnect`
  - `pingDevice` → `POST /diagnostics/ping`
  - `tracerouteDevice` → `POST /diagnostics/traceroute`
- Returns granular loading flags (`isDisconnecting`, `isPinging`, `isTracerouting`) and derived `isLoading`.
- Surfaces latest ping/traceroute payloads for consumers that want to display results inline.
- Wraps every call in structured logging (`logger`) and toast notifications (`useToast`) with destructive variants for failure cases.

```typescript
disconnectSession.mutateAsync({
  username,
  acctsessionid,   // RADIUS Acct-Session-Id (optional but preferred)
  nasipaddress,    // NAS IP for targeted disconnect (optional)
});
```

> ℹ️ The payload mirrors the backend schema defined in `src/dotmac/platform/radius/router.py` (`username`, `acctsessionid`, `nasipaddress`). Session IDs are no longer interpolated into the URL.

### 2. Live Radius Sessions Table Enhancements

- **Path:** `frontend/apps/base-app/components/realtime/LiveRadiusSessions.tsx`
- Injects the diagnostics hook and threads disconnect state through the UI.
- Replaces the old `(sessionId, username)` signature with a single `Session` object, ensuring NAS IP, session ID, and username are all forwarded to the API.
- Adds a destructive “Disconnect” action with confirm-on-click semantics and honours the hook’s pending state to prevent double submissions.
- Keeps the optimistic UX: the WebSocket `session.stopped` event still clears rows after the backend disconnect completes.

```tsx
<Button
  variant="ghost"
  size="sm"
  onClick={() => handleDisconnectSession(session)}
  disabled={isDisconnecting}
  className="text-destructive hover:text-destructive hover:bg-destructive/10"
>
  <XCircle className="h-4 w-4 mr-1" />
  Disconnect
</Button>
```

---

## Frontend Architecture Notes

- All mutations live inside React Query’s `useMutation`, so retries, loading states, and cache invalidation are available for future enhancements.
- Logging is tenant-aware: we log the username/session identifiers, and the toast copies draw error messages from `error.response?.data?.detail` when present.
- Combined loading state (`isLoading`) is exported for any wrapper component that wants to block UI while diagnostics are running.

---

## Backend Integration

- **Disconnect:** Reuses the existing RADIUS Disconnect endpoint (`POST /radius/sessions/disconnect`) which expects the JSON body described above.
- **Ping / Traceroute:** Uses the diagnostics endpoints already exposed in `src/dotmac/platform/diagnostics/router.py`.
- No new backend changes were required, but the documentation now aligns with the true API surface.

---

## Testing & Validation

- Manual verification with the live WebSocket feed confirms sessions disappear immediately on `session.stopped`.
- Error-handling paths validated with mocked 500 responses to ensure destructive toasts and console logging are triggered.
- All TypeScript files compile cleanly (`pnpm lint --filter base-app`).

---

## Next Steps

1. Extend the hook with bandwidth tests once the backend endpoint lands.
2. Surface ping/traceroute results in the UI (hook already returns `pingResult` and `tracerouteResult`).
3. Investigate batching multiple disconnects if the NOC workflow calls for it.
