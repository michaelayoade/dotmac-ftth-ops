"use client";

/**
 * Virtualized Subscribers List
 * Demonstrates VirtualizedTable for handling large datasets efficiently
 */

import { useMemo } from "react";
import { VirtualizedTable } from "@dotmac/primitives";
import { Badge } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { useRADIUSSubscribers } from "@/hooks/useRADIUS";
import { Eye, Edit, Trash2, Wifi } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { Subscriber } from "@/hooks/useSubscribers";

export default function VirtualizedSubscribersPage() {
  const { data: subscribersData, isLoading } = useRADIUSSubscribers(0, 10000); // Fetch large dataset

  const subscribers = subscribersData?.data ?? [];

  const columns = useMemo(() => [
    {
      key: "subscriber_id",
      label: "Subscriber ID",
      width: 200,
      render: (row: Subscriber) => (
        <span className="font-mono text-sm">{row.subscriber_id}</span>
      ),
    },
    {
      key: "name",
      label: "Name",
      width: 250,
      render: (row: Subscriber) => (
        <div>
          <div className="font-medium">{row.name || "—"}</div>
          {row.email && (
            <div className="text-sm text-muted-foreground">{row.email}</div>
          )}
        </div>
      ),
    },
    {
      key: "status",
      label: "Status",
      width: 120,
      render: (row: Subscriber) => {
        const statusConfig = {
          active: { variant: "default" as const, label: "Active" },
          suspended: { variant: "destructive" as const, label: "Suspended" },
          pending: { variant: "secondary" as const, label: "Pending" },
          inactive: { variant: "outline" as const, label: "Inactive" },
        };
        const config = statusConfig[row.status] || statusConfig.inactive;
        return <Badge variant={config.variant}>{config.label}</Badge>;
      },
    },
    {
      key: "enabled",
      label: "Enabled",
      width: 100,
      render: (row: Subscriber) => (
        <div className="flex items-center gap-2">
          {row.enabled ? (
            <Wifi className="h-4 w-4 text-green-500" />
          ) : (
            <Wifi className="h-4 w-4 text-gray-400" />
          )}
          <span className="text-sm">{row.enabled ? "Yes" : "No"}</span>
        </div>
      ),
    },
    {
      key: "bandwidth_profile",
      label: "Bandwidth",
      width: 150,
      render: (row: Subscriber) => row.bandwidth_profile_name || "—",
    },
    {
      key: "ip_address",
      label: "IP Address",
      width: 150,
      render: (row: Subscriber) => (
        <span className="font-mono text-sm">{row.ip_address || "Dynamic"}</span>
      ),
    },
    {
      key: "last_seen",
      label: "Last Seen",
      width: 180,
      render: (row: Subscriber) => {
        if (!row.last_seen) return <span className="text-muted-foreground">Never</span>;
        try {
          return (
            <span className="text-sm">
              {formatDistanceToNow(new Date(row.last_seen), { addSuffix: true })}
            </span>
          );
        } catch {
          return <span className="text-muted-foreground">—</span>;
        }
      },
    },
    {
      key: "actions",
      label: "Actions",
      width: 150,
      render: (row: Subscriber) => (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <Eye className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <Edit className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <Trash2 className="h-4 w-4 text-red-500" />
          </Button>
        </div>
      ),
    },
  ], []);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Virtualized Subscribers</h1>
        <p className="text-muted-foreground">
          High-performance table handling 10,000+ subscribers with smooth scrolling
        </p>
      </div>

      <div className="bg-card rounded-lg border p-4">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">All Subscribers</h2>
            <p className="text-sm text-muted-foreground">
              {subscribers.length.toLocaleString()} subscribers loaded
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              Export CSV
            </Button>
            <Button variant="default" size="sm">
              Add Subscriber
            </Button>
          </div>
        </div>

        <VirtualizedTable
          data={subscribers}
          columns={columns}
          rowHeight={64}
          height={600}
          loading={isLoading}
          onRowClick={(row) => console.log("Clicked:", row)}
          className="border rounded-md"
        />

        <div className="mt-4 text-sm text-muted-foreground">
          ⚡ Rendering {subscribers.length.toLocaleString()} rows efficiently with virtualization
        </div>
      </div>
    </div>
  );
}
