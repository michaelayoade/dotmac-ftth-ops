"use client";

export const dynamic = "force-dynamic";
export const dynamicParams = true;

import { useEffect, useState } from "react";
import { tenantService, TenantStats } from "@/lib/services/tenant-service";
import { useTenant } from "@/lib/contexts/tenant-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";

export default function TenantUsagePage() {
  const { currentTenant } = useTenant();
  const [stats, setStats] = useState<TenantStats | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!currentTenant?.id) return;
    setLoading(true);
    tenantService
      .getStats(currentTenant.id)
      .then(setStats)
      .finally(() => setLoading(false));
  }, [currentTenant?.id]);

  const usageMeter = (value: number, max: number) => Math.min(100, Math.round((value / max) * 100));

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold text-foreground">Usage & Limits</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Monitor consumption across API calls, seats, and storage to stay ahead of plan limits.
        </p>
      </header>

      {loading ? (
        <Skeleton className="h-48 rounded-lg" />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <UsageCard
            title="API calls (30d)"
            value={`${stats?.total_api_calls?.toLocaleString() ?? "0"} / 100,000`}
            progress={usageMeter(stats?.total_api_calls ?? 0, 100000)}
            description="Upgrade to increase throughput or request higher limits."
          />
          <UsageCard
            title="Active users"
            value={`${stats?.active_users ?? 0} / ${(stats?.total_users ?? 0) || 10}`}
            progress={usageMeter(stats?.active_users ?? 0, stats?.total_users ?? 10)}
            description="Add seats or deactivate unused members to stay efficient."
          />
          <UsageCard
            title="Storage used"
            value={`${stats?.storage_used ?? 0} GB / 500 GB`}
            progress={usageMeter(stats?.storage_used ?? 0, 500)}
            description="Archive old data or contact support for dedicated storage tiers."
          />
          <UsageCard
            title="Features enabled"
            value={`${stats?.features_enabled ?? 0}`}
            progress={100}
            description="Feature toggles can be configured per tenant."
          />
        </div>
      )}

      {stats && stats.total_api_calls > 90000 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>You’re approaching API limits</AlertTitle>
          <AlertDescription>
            Requests will be throttled after 100,000 calls in a 30-day window. Consider upgrading
            your plan or contacting support.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

interface UsageCardProps {
  title: string;
  value: string;
  description: string;
  progress: number;
}

function UsageCard({ title, value, description, progress }: UsageCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-xl font-semibold text-foreground">{value}</div>
        <Progress value={progress} className="h-2" />
      </CardContent>
    </Card>
  );
}
