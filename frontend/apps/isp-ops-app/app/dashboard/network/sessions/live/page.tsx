"use client";

/**
 * Live RADIUS Sessions Monitoring Page
 *
 * Real-time monitoring of active authentication sessions with WebSocket updates.
 */

import { LiveRadiusSessions } from "@/components/realtime/LiveRadiusSessions";

export default function LiveSessionsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Live RADIUS Sessions</h1>
        <p className="text-muted-foreground mt-1">
          Monitor active authentication sessions in real-time
        </p>
      </div>

      <LiveRadiusSessions maxSessions={100} enabled={true} />
    </div>
  );
}
