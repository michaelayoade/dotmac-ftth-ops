"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@dotmac/ui";
import { Cpu, Circle } from "lucide-react";
import Link from "next/link";

interface DevicesSummaryCardProps {
  devices: {
    total: number;
    online: number;
    offline: number;
  };
  customerId: string;
}

export function DevicesSummaryCard({ devices, customerId }: DevicesSummaryCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Cpu className="h-5 w-5" />
          Devices
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Total Devices</span>
          <span className="text-2xl font-bold">{devices.total}</span>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground flex items-center gap-1">
              <Circle className="h-3 w-3 fill-green-500 text-green-500" />
              Online
            </span>
            <span className="font-medium">{devices.online}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground flex items-center gap-1">
              <Circle className="h-3 w-3 fill-gray-400 text-gray-400" />
              Offline
            </span>
            <span className="font-medium">{devices.offline}</span>
          </div>
        </div>
        <div className="pt-2 border-t">
          <Link
            href={`/dashboard/operations/customers/${customerId}/devices`}
            className="text-sm text-primary hover:underline"
          >
            View All Devices →
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
