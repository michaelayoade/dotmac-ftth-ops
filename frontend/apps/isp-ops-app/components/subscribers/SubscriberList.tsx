/**
 * SubscriberList Component
 *
 * Data table component for displaying and managing subscribers
 */

"use client";

import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { EnhancedDataTable, BulkAction } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@dotmac/ui";
import { MoreHorizontal, Wifi, WifiOff, Eye, Edit, Trash2, Ban, Play } from "lucide-react";
import type { Subscriber, SubscriberStatus, ConnectionType } from "@/hooks/useSubscribers";
import { formatDistanceToNow } from "date-fns";
import { FadeInWhenVisible } from "@dotmac/primitives";

// ============================================================================
// Types
// ============================================================================

interface SubscriberListProps {
  subscribers: Subscriber[];
  isLoading?: boolean;
  onView?: (subscriber: Subscriber) => void | Promise<void>;
  onEdit?: (subscriber: Subscriber) => void | Promise<void>;
  onDelete?: (subscriber: Subscriber) => void | Promise<void>;
  onSuspend?: (subscriber: Subscriber) => void | Promise<void>;
  onActivate?: (subscriber: Subscriber) => void | Promise<void>;
  onRowClick?: (subscriber: Subscriber) => void | Promise<void>;
  bulkActions?: BulkAction<Subscriber>[];
  enableBulkActions?: boolean;
}

// ============================================================================
// Utility Functions
// ============================================================================

const getStatusBadgeVariant = (
  status: SubscriberStatus,
): "default" | "secondary" | "destructive" | "outline" => {
  switch (status) {
    case "active":
      return "default";
    case "suspended":
      return "destructive";
    case "pending":
      return "secondary";
    case "inactive":
      return "outline";
    case "terminated":
      return "outline";
    default:
      return "outline";
  }
};

const getConnectionTypeIcon = (type: ConnectionType) => {
  switch (type) {
    case "ftth":
      return <Wifi className="h-4 w-4 text-green-500" />;
    case "fttb":
      return <Wifi className="h-4 w-4 text-blue-500" />;
    case "wireless":
      return <Wifi className="h-4 w-4 text-purple-500" />;
    case "hybrid":
      return <Wifi className="h-4 w-4 text-orange-500" />;
    default:
      return <WifiOff className="h-4 w-4 text-gray-400" />;
  }
};

const getConnectionTypeLabel = (type: ConnectionType): string => {
  switch (type) {
    case "ftth":
      return "FTTH";
    case "fttb":
      return "FTTB";
    case "wireless":
      return "Wireless";
    case "hybrid":
      return "Hybrid";
    default:
      return (type as string).toUpperCase();
  }
};

// ============================================================================
// Component
// ============================================================================

export function SubscriberList({
  subscribers,
  isLoading = false,
  onView,
  onEdit,
  onDelete,
  onSuspend,
  onActivate,
  onRowClick,
  bulkActions = [],
  enableBulkActions = false,
}: SubscriberListProps) {
  const columns = useMemo<ColumnDef<Subscriber>[]>(
    () => [
      {
        accessorKey: "subscriber_id",
        header: "Subscriber ID",
        cell: ({ row }) => <div className="font-mono text-sm">{row.original.subscriber_id}</div>,
      },
      {
        accessorKey: "name",
        header: "Name",
        cell: ({ row }) => (
          <div>
            <div className="font-medium">
              {row.original.first_name} {row.original.last_name}
            </div>
            <div className="text-sm text-muted-foreground">{row.original.email}</div>
          </div>
        ),
      },
      {
        accessorKey: "phone",
        header: "Phone",
        cell: ({ row }) => <div className="text-sm">{row.original.phone}</div>,
      },
      {
        accessorKey: "service_address",
        header: "Service Address",
        cell: ({ row }) => (
          <div>
            <div className="text-sm">{row.original.service_address}</div>
            <div className="text-xs text-muted-foreground">
              {row.original.service_city}, {row.original.service_state}{" "}
              {row.original.service_postal_code}
            </div>
          </div>
        ),
      },
      {
        accessorKey: "connection_type",
        header: "Connection",
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            {getConnectionTypeIcon(row.original.connection_type)}
            <span className="text-sm">{getConnectionTypeLabel(row.original.connection_type)}</span>
          </div>
        ),
      },
      {
        accessorKey: "service_plan",
        header: "Plan",
        cell: ({ row }) => (
          <div>
            {row.original.service_plan && (
              <div className="text-sm">{row.original.service_plan}</div>
            )}
            {row.original.bandwidth_mbps && (
              <div className="text-xs text-muted-foreground">
                {row.original.bandwidth_mbps} Mbps
              </div>
            )}
          </div>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <Badge variant={getStatusBadgeVariant(row.original.status)}>
            {row.original.status.toUpperCase()}
          </Badge>
        ),
      },
      {
        accessorKey: "last_online",
        header: "Last Online",
        cell: ({ row }) => (
          <div className="text-sm text-muted-foreground">
            {row.original.last_online
              ? formatDistanceToNow(new Date(row.original.last_online), {
                  addSuffix: true,
                })
              : "Never"}
          </div>
        ),
      },
      {
        accessorKey: "uptime_percentage",
        header: "Uptime",
        cell: ({ row }) => (
          <div className="text-sm">
            {row.original.uptime_percentage !== undefined
              ? `${row.original.uptime_percentage.toFixed(1)}%`
              : "-"}
          </div>
        ),
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => {
          const subscriber = row.original;
          const canSuspend = subscriber.status === "active";
          const canActivate = subscriber.status === "suspended" || subscriber.status === "pending";

          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 p-0">
                  <span className="sr-only">Open menu</span>
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {onView && (
                  <DropdownMenuItem onClick={() => onView(subscriber)}>
                    <Eye className="mr-2 h-4 w-4" />
                    View Details
                  </DropdownMenuItem>
                )}
                {onEdit && (
                  <DropdownMenuItem onClick={() => onEdit(subscriber)}>
                    <Edit className="mr-2 h-4 w-4" />
                    Edit
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                {canActivate && onActivate && (
                  <DropdownMenuItem onClick={() => onActivate(subscriber)}>
                    <Play className="mr-2 h-4 w-4" />
                    Activate
                  </DropdownMenuItem>
                )}
                {canSuspend && onSuspend && (
                  <DropdownMenuItem onClick={() => onSuspend(subscriber)}>
                    <Ban className="mr-2 h-4 w-4" />
                    Suspend
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                {onDelete && (
                  <DropdownMenuItem
                    onClick={() => onDelete(subscriber)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      },
    ],
    [onView, onEdit, onDelete, onSuspend, onActivate],
  );

  return (
    <FadeInWhenVisible>
      <EnhancedDataTable
        columns={columns}
        data={subscribers}
        isLoading={isLoading}
        selectable={enableBulkActions}
        bulkActions={bulkActions}
        searchable={true}
        searchPlaceholder="Search subscribers..."
        searchColumn="name"
        paginated={true}
        {...(onRowClick
          ? {
              onRowClick: (subscriber: Subscriber) => {
                void onRowClick(subscriber);
              },
            }
          : {})}
        emptyMessage="No subscribers found"
        className="w-full"
      />
    </FadeInWhenVisible>
  );
}
