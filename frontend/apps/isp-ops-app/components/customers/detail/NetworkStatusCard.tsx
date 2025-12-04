"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { Wifi, Globe, Activity } from "lucide-react";
import Link from "next/link";

interface NetworkStatusCardProps {
  network: {
    ipv4Address?: string;
    ipv6Prefix?: string;
    sessionStatus?: string;
    bandwidth?: string;
    online?: boolean;
  };
  customerId: string;
}

export function NetworkStatusCard({ network, customerId }: NetworkStatusCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wifi className="h-5 w-5" />
          Network Status
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground flex items-center gap-1">
            <Activity className="h-3 w-3" />
            Connection
          </span>
          <Badge variant={network?.online ? "default" : "destructive"}>
            {network?.online ? "Online" : "Offline"}
          </Badge>
        </div>
        {network?.ipv4Address && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground flex items-center gap-1">
              <Globe className="h-3 w-3" />
              IPv4
            </span>
            <span className="font-mono text-sm">{network.ipv4Address}</span>
          </div>
        )}
        {network?.ipv6Prefix && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground flex items-center gap-1">
              <Globe className="h-3 w-3" />
              IPv6
            </span>
            <span className="font-mono text-sm truncate max-w-[150px]">{network.ipv6Prefix}</span>
          </div>
        )}
        {network?.bandwidth && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Bandwidth</span>
            <span className="font-medium">{network.bandwidth}</span>
          </div>
        )}
        <div className="pt-2 border-t">
          <Link
            href={`/dashboard/operations/customers/${customerId}/network`}
            className="text-sm text-primary hover:underline"
          >
            View Details →
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
