"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@dotmac/ui";
import { Gauge, Database, Zap, Users, Loader2 } from "lucide-react";
import { useUsageMetrics } from "@/hooks/useTenantPortal";

export default function UsagePage() {
  const { data: usage, isLoading } = useUsageMetrics();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading usage metrics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Usage & Limits</h1>
        <p className="text-muted-foreground">
          Monitor your consumption and quota thresholds
        </p>
      </div>

      {usage && (
        <p className="text-sm text-muted-foreground">
          Period: {new Date(usage.period_start).toLocaleDateString()} -{" "}
          {new Date(usage.period_end).toLocaleDateString()}
        </p>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <UsageCard
          title="API Calls"
          icon={Zap}
          current={usage?.api_calls?.current ?? 0}
          limit={usage?.api_calls?.limit ?? 100000}
          unit="calls"
        />
        <UsageCard
          title="Storage"
          icon={Database}
          current={usage?.storage?.current ?? 0}
          limit={usage?.storage?.limit ?? 100}
          unit="GB"
        />
        <UsageCard
          title="Users"
          icon={Users}
          current={usage?.users?.current ?? 0}
          limit={usage?.users?.limit ?? 25}
          unit="seats"
        />
        {usage?.bandwidth && (
          <UsageCard
            title="Bandwidth"
            icon={Gauge}
            current={usage.bandwidth.current}
            limit={usage.bandwidth.limit}
            unit="GB"
          />
        )}
      </div>
    </div>
  );
}

interface UsageCardProps {
  title: string;
  icon: React.ElementType;
  current: number;
  limit: number;
  unit: string;
}

function UsageCard({ title, icon: Icon, current, limit, unit }: UsageCardProps) {
  const percentage = limit > 0 ? Math.round((current / limit) * 100) : 0;
  const isWarning = percentage >= 80;
  const isCritical = percentage >= 95;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="h-5 w-5" />
          {title}
        </CardTitle>
        <CardDescription>
          {current.toLocaleString()} / {limit.toLocaleString()} {unit}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Usage</span>
            <span
              className={
                isCritical
                  ? "text-red-500 font-medium"
                  : isWarning
                    ? "text-amber-500 font-medium"
                    : "text-foreground"
              }
            >
              {percentage}%
            </span>
          </div>
          <div className="h-2 bg-secondary rounded-full overflow-hidden">
            <div
              className={`h-full transition-all ${
                isCritical
                  ? "bg-red-500"
                  : isWarning
                    ? "bg-amber-500"
                    : "bg-primary"
              }`}
              style={{ width: `${Math.min(percentage, 100)}%` }}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
