"use client";

/**
 * Device List Component with Dual-Stack Support
 *
 * Displays monitored devices with their IPv4 and IPv6 addresses
 */

import React, { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@dotmac/ui";
import { Input } from "@dotmac/ui";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@dotmac/ui";
import { IPAddressDisplay, DualStackBadge } from "@/components/forms/IPAddressDisplay";
import { MoreHorizontal, Plus, Search, Activity } from "lucide-react";

export interface MonitoredDevice {
  id: string;
  name: string;
  type: string;
  status: "online" | "offline" | "warning" | "unknown";
  ipv4_address?: string | null;
  ipv6_address?: string | null;
  management_ip: string;
  location?: string | null;
  last_seen?: string | null;
  uptime_percent?: number;
  snmp_enabled?: boolean;
}

export interface DeviceListProps {
  devices: MonitoredDevice[];
  onAddDevice?: () => void;
  onEditDevice?: (device: MonitoredDevice) => void;
  onDeleteDevice?: (deviceId: string) => void;
  onViewMetrics?: (deviceId: string) => void;
  isLoading?: boolean;
}

export function DeviceList({
  devices,
  onAddDevice,
  onEditDevice,
  onDeleteDevice,
  onViewMetrics,
  isLoading = false,
}: DeviceListProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "online" | "offline" | "warning">("all");

  const filteredDevices = devices.filter((device) => {
    const matchesSearch =
      device.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      device.type?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      device.ipv4_address?.includes(searchTerm) ||
      device.ipv6_address?.includes(searchTerm) ||
      device.location?.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    if (statusFilter !== "all" && device.status !== statusFilter) return false;

    return true;
  });

  const statusCounts = {
    online: devices.filter((d) => d.status === "online").length,
    offline: devices.filter((d) => d.status === "offline").length,
    warning: devices.filter((d) => d.status === "warning").length,
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Monitored Devices</CardTitle>
            <CardDescription>
              {devices.length} devices • {statusCounts.online} online • {statusCounts.offline}{" "}
              offline
            </CardDescription>
          </div>
          {onAddDevice && (
            <Button onClick={onAddDevice}>
              <Plus className="mr-2 h-4 w-4" />
              Add Device
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search devices..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant={statusFilter === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter("all")}
            >
              All
            </Button>
            <Button
              variant={statusFilter === "online" ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter("online")}
            >
              Online ({statusCounts.online})
            </Button>
            <Button
              variant={statusFilter === "offline" ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter("offline")}
            >
              Offline ({statusCounts.offline})
            </Button>
            <Button
              variant={statusFilter === "warning" ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter("warning")}
            >
              Warning ({statusCounts.warning})
            </Button>
          </div>
        </div>

        {/* Table */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Device</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>IP Addresses</TableHead>
                <TableHead>Management IP</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Uptime</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    Loading devices...
                  </TableCell>
                </TableRow>
              ) : filteredDevices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    No devices found
                  </TableCell>
                </TableRow>
              ) : (
                filteredDevices.map((device) => (
                  <DeviceRow
                    key={device.id}
                    device={device}
                    {...(onEditDevice ? { onEdit: onEditDevice } : {})}
                    {...(onDeleteDevice ? { onDelete: onDeleteDevice } : {})}
                    {...(onViewMetrics ? { onViewMetrics } : {})}
                  />
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

interface DeviceRowProps {
  device: MonitoredDevice;
  onEdit?: (device: MonitoredDevice) => void;
  onDelete?: (deviceId: string) => void;
  onViewMetrics?: (deviceId: string) => void;
}

function DeviceRow({ device, onEdit, onDelete, onViewMetrics }: DeviceRowProps) {
  const getStatusBadge = (status: MonitoredDevice["status"]) => {
    const variants = {
      online: "default" as const,
      offline: "destructive" as const,
      warning: "secondary" as const,
      unknown: "outline" as const,
    };

    return (
      <Badge variant={variants[status]}>
        <Activity className="mr-1 h-3 w-3" />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  return (
    <TableRow>
      <TableCell>
        <div className="space-y-1">
          <div className="font-medium">{device.name}</div>
          <div className="text-sm text-muted-foreground">{device.type}</div>
        </div>
      </TableCell>
      <TableCell>{getStatusBadge(device.status)}</TableCell>
      <TableCell>
        <div className="space-y-1">
          <IPAddressDisplay
            ipv4={device.ipv4_address}
            ipv6={device.ipv6_address}
            layout="stacked"
            showBadges={true}
            compress={true}
          />
          {!device.ipv4_address && !device.ipv6_address && (
            <span className="text-sm text-muted-foreground italic">Not configured</span>
          )}
        </div>
      </TableCell>
      <TableCell>
        <span className="font-mono text-sm">{device.management_ip}</span>
      </TableCell>
      <TableCell>
        {device.location ? (
          <span className="text-sm">{device.location}</span>
        ) : (
          <span className="text-muted-foreground">-</span>
        )}
      </TableCell>
      <TableCell>
        {device.uptime_percent !== undefined ? (
          <div className="flex items-center gap-2">
            <span className="text-sm">{device.uptime_percent.toFixed(1)}%</span>
            <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary" style={{ width: `${device.uptime_percent}%` }} />
            </div>
          </div>
        ) : (
          <span className="text-muted-foreground">-</span>
        )}
      </TableCell>
      <TableCell>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            {onViewMetrics && (
              <>
                <DropdownMenuItem onClick={() => onViewMetrics(device.id)}>
                  View Metrics
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
            {onEdit && <DropdownMenuItem onClick={() => onEdit(device)}>Edit</DropdownMenuItem>}
            {onDelete && (
              <DropdownMenuItem onClick={() => onDelete(device.id)} className="text-red-600">
                Delete
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}
