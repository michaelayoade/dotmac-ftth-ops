'use client';

/**
 * Live RADIUS Sessions Monitor
 *
 * Real-time table displaying active RADIUS authentication sessions
 * with automatic updates via WebSocket.
 */

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Activity,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Users,
  Wifi,
  Clock,
} from 'lucide-react';
import { useSessionsWebSocket } from '../../hooks/useRealtime';
import type { RADIUSSessionEvent } from '../../types/realtime';
import { CompactConnectionStatus } from './ConnectionStatusIndicator';

interface Session {
  session_id: string;
  username: string;
  nas_ip_address: string;
  framed_ip_address: string;
  bytes_in: number;
  bytes_out: number;
  session_time: number;
  started_at: string;
  last_updated: string;
}

export interface LiveRadiusSessionsProps {
  /**
   * Maximum number of sessions to display
   */
  maxSessions?: number;
  /**
   * Enable live updates
   */
  enabled?: boolean;
  /**
   * Compact mode (minimal UI)
   */
  compact?: boolean;
}

export function LiveRadiusSessions({
  maxSessions = 100,
  enabled = true,
  compact = false,
}: LiveRadiusSessionsProps) {
  const [sessions, setSessions] = useState<Map<string, Session>>(new Map());
  const { status, isConnected } = useSessionsWebSocket((event) => {
    handleSessionEvent(event);
  }, enabled);

  const handleSessionEvent = (event: RADIUSSessionEvent) => {
    const sessionId = event.session_id;

    if (event.event_type === 'session.started') {
      setSessions((prev) => {
        const next = new Map(prev);
        next.set(sessionId, {
          session_id: sessionId,
          username: event.username,
          nas_ip_address: event.nas_ip_address,
          framed_ip_address: event.framed_ip_address || '',
          bytes_in: event.bytes_in,
          bytes_out: event.bytes_out,
          session_time: event.session_time,
          started_at: event.timestamp,
          last_updated: event.timestamp,
        });

        // Limit to maxSessions
        if (next.size > maxSessions) {
          const firstKey = next.keys().next().value;
          if (firstKey) next.delete(firstKey);
        }

        return next;
      });
    } else if (event.event_type === 'session.updated') {
      setSessions((prev) => {
        const next = new Map(prev);
        const existing = next.get(sessionId);
        if (existing) {
          next.set(sessionId, {
            ...existing,
            bytes_in: event.bytes_in,
            bytes_out: event.bytes_out,
            session_time: event.session_time,
            last_updated: event.timestamp,
          });
        }
        return next;
      });
    } else if (event.event_type === 'session.stopped') {
      setSessions((prev) => {
        const next = new Map(prev);
        next.delete(sessionId);
        return next;
      });
    }
  };

  const sessionList = Array.from(sessions.values());
  const totalBytesIn = sessionList.reduce((sum, s) => sum + s.bytes_in, 0);
  const totalBytesOut = sessionList.reduce((sum, s) => sum + s.bytes_out, 0);

  if (compact) {
    return (
      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            <h3 className="font-bold">Active Sessions</h3>
            <Badge variant="outline">{sessionList.length}</Badge>
          </div>
          <CompactConnectionStatus />
        </div>

        <div className="grid gap-2 md:grid-cols-3">
          <div className="p-3 bg-gray-50 rounded">
            <p className="text-xs text-muted-foreground">Active Users</p>
            <p className="text-2xl font-bold">{sessionList.length}</p>
          </div>
          <div className="p-3 bg-green-50 rounded">
            <p className="text-xs text-green-900">Total RX</p>
            <p className="text-xl font-bold text-green-900">
              {formatBytes(totalBytesIn)}
            </p>
          </div>
          <div className="p-3 bg-blue-50 rounded">
            <p className="text-xs text-blue-900">Total TX</p>
            <p className="text-xl font-bold text-blue-900">
              {formatBytes(totalBytesOut)}
            </p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2">
            <Wifi className="h-6 w-6 text-primary" />
            <h2 className="text-2xl font-bold">Live RADIUS Sessions</h2>
            <Badge
              variant={isConnected ? 'default' : 'secondary'}
              className="ml-2"
            >
              {isConnected ? 'Live' : 'Disconnected'}
            </Badge>
          </div>
          <p className="text-muted-foreground mt-1">
            Real-time authentication session monitoring
          </p>
        </div>
        <CompactConnectionStatus />
      </div>

      {/* Statistics Summary */}
      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <div className="p-4 bg-primary/10 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Active Sessions</p>
              <p className="text-3xl font-bold">{sessionList.length}</p>
            </div>
            <Users className="h-10 w-10 text-primary" />
          </div>
        </div>

        <div className="p-4 bg-green-50 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-green-900">Total RX</p>
              <p className="text-2xl font-bold text-green-900">
                {formatBytes(totalBytesIn)}
              </p>
            </div>
            <TrendingDown className="h-10 w-10 text-green-600" />
          </div>
        </div>

        <div className="p-4 bg-blue-50 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-blue-900">Total TX</p>
              <p className="text-2xl font-bold text-blue-900">
                {formatBytes(totalBytesOut)}
              </p>
            </div>
            <TrendingUp className="h-10 w-10 text-blue-600" />
          </div>
        </div>

        <div className="p-4 bg-purple-50 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-purple-900">Total Traffic</p>
              <p className="text-2xl font-bold text-purple-900">
                {formatBytes(totalBytesIn + totalBytesOut)}
              </p>
            </div>
            <Activity className="h-10 w-10 text-purple-600" />
          </div>
        </div>
      </div>

      {/* Sessions Table */}
      {sessionList.length === 0 ? (
        <div className="text-center py-12 border rounded-lg">
          <Users className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">
            {isConnected
              ? 'No active sessions. Waiting for connections...'
              : 'Connect to view live sessions'}
          </p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                    Username
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                    NAS IP
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                    User IP
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase">
                    RX
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase">
                    TX
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase">
                    Duration
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase">
                    Last Update
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {sessionList.map((session) => (
                  <tr key={session.session_id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
                        {session.username}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm font-mono text-muted-foreground">
                      {session.nas_ip_address}
                    </td>
                    <td className="px-4 py-3 text-sm font-mono text-muted-foreground">
                      {session.framed_ip_address || 'N/A'}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-semibold text-green-600">
                      {formatBytes(session.bytes_in)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-semibold text-blue-600">
                      {formatBytes(session.bytes_out)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDuration(session.session_time)}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-muted-foreground">
                      {getTimeAgo(session.last_updated)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {sessionList.length >= maxSessions && (
        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-900">
          <p>
            Showing most recent {maxSessions} sessions. Some older sessions may
            not be displayed.
          </p>
        </div>
      )}
    </Card>
  );
}

// Helper functions
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
}

function getTimeAgo(dateString: string): string {
  const now = new Date().getTime();
  const then = new Date(dateString).getTime();
  const diffSeconds = Math.floor((now - then) / 1000);

  if (diffSeconds < 60) return `${diffSeconds}s ago`;
  if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ago`;
  if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)}h ago`;
  return `${Math.floor(diffSeconds / 86400)}d ago`;
}
