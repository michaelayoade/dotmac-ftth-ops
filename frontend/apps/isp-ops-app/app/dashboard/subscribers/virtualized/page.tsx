"use client";

/**
 * Virtualized Subscribers List
 * Demonstrates VirtualizedTable for handling large datasets efficiently
 */

import { useMemo } from "react";
import { VirtualizedTable } from "@dotmac/primitives";
import { Badge } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { useRADIUSSubscribers, type RADIUSSubscriber } from "@/hooks/useRADIUS";
import { Eye, Edit, Trash2, Wifi } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export default function VirtualizedSubscribersPage() {
  const { data: subscribersData, isLoading } = useRADIUSSubscribers(0, 10000); // Fetch large dataset

  const subscribers = subscribersData?.data ?? [];

  const columns = useMemo(
    () => [
      {
        key: "subscriber_id",
        label: "Subscriber ID",
        width: 200,
        render: (row: RADIUSSubscriber) => (
          <span className="font-mono text-sm">{row.subscriber_id}</span>
        ),
      },
      {
        key: "username",
        label: "Username",
        width: 250,
        render: (row: RADIUSSubscriber) => (
          <div>
            <div className="font-medium">{row.username || "—"}</div>
            <div className="text-sm text-muted-foreground">ID: {row.id}</div>
          </div>
        ),
      },
      {
        key: "enabled",
        label: "Status",
        width: 120,
        render: (row: RADIUSSubscriber) => (
          <Badge variant={row.enabled ? "default" : "destructive"}>
            {row.enabled ? "Enabled" : "Disabled"}
          </Badge>
        ),
      },
      {
        key: "connection",
        label: "Connection",
        width: 100,
        render: (row: RADIUSSubscriber) => {
          const isEnabled = row.enabled;
          return (
            <div className="flex items-center gap-2">
              {isEnabled ? (
                <Wifi className="h-4 w-4 text-green-500" />
              ) : (
                <Wifi className="h-4 w-4 text-gray-400" />
              )}
              <span className="text-sm">{isEnabled ? "Active" : "Inactive"}</span>
            </div>
          );
        },
      },
      {
        key: "bandwidth_profile_id",
        label: "Bandwidth Profile",
        width: 150,
        render: (row: RADIUSSubscriber) => row.bandwidth_profile_id || "—",
      },
      {
        key: "framed_ipv4_address",
        label: "IPv4 Address",
        width: 150,
        render: (row: RADIUSSubscriber) => (
          <span className="font-mono text-sm">{row.framed_ipv4_address || "Dynamic"}</span>
        ),
      },
      {
        key: "created_at",
        label: "Created",
        width: 180,
        render: (row: RADIUSSubscriber) => {
          if (!row.created_at) return <span className="text-muted-foreground">—</span>;
          try {
            return (
              <span className="text-sm">
                {formatDistanceToNow(new Date(row.created_at), { addSuffix: true })}
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
        render: (row: RADIUSSubscriber) => (
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
    ],
    [],
  );

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
          columns={columns as any}
          rowHeight={64}
          height={600}
          loading={isLoading}
          onRowClick={(row: RADIUSSubscriber) => console.log("Clicked:", row)}
          className="border rounded-md"
        />

        <div className="mt-4 text-sm text-muted-foreground">
          ⚡ Rendering {subscribers.length.toLocaleString()} rows efficiently with virtualization
        </div>
      </div>
    </div>
  );
}
