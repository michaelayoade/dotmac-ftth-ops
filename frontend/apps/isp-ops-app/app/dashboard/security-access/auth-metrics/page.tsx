"use client";

import React, { useEffect, useState } from "react";
import { Activity } from "lucide-react";
import { RouteGuard } from "@/components/auth/PermissionGuard";
import { apiClient } from "@/lib/api/client";
import { Card, CardHeader, CardTitle, CardContent, Badge } from "@dotmac/ui";

type AuthMetrics = Record<string, any>;

export default function AuthMetricsPage() {
  const [metrics, setMetrics] = useState<AuthMetrics | null>(null);
  const [apiKeyMetrics, setApiKeyMetrics] = useState<AuthMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const authRes = await apiClient.get("/auth/metrics");
        const keyRes = await apiClient.get("/auth/api-keys/metrics").catch(() => ({ data: null }));

        setMetrics(authRes.data || {});
        setApiKeyMetrics(keyRes.data || null);
      } catch (err: any) {
        setError("Failed to load auth metrics");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const renderKV = (obj: AuthMetrics | null) => {
    if (!obj) return <p className="text-muted-foreground text-sm">No data.</p>;
    if (Object.keys(obj).length === 0) {
      return <p className="text-muted-foreground text-sm">No data.</p>;
    }
    return (
      <div className="grid gap-2">
        {Object.entries(obj).map(([key, value]) => (
          <div key={key} className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{key}</span>
            <span className="font-medium">
              {typeof value === "object" ? JSON.stringify(value) : String(value)}
            </span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <RouteGuard permission="security.manage">
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-2">
          <Activity className="h-6 w-6 text-blue-500" />
          <div>
            <h1 className="text-2xl font-semibold">Auth Metrics</h1>
            <p className="text-sm text-muted-foreground">
              Login activity, MFA status, and API key usage.
            </p>
          </div>
        </div>

        {error && <div className="text-destructive">{error}</div>}

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Authentication Metrics</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-sm text-muted-foreground">Loading...</p>
              ) : (
                renderKV(metrics)
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex items-center justify-between">
              <CardTitle>API Key Metrics</CardTitle>
              <Badge variant="outline">Tenant</Badge>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-sm text-muted-foreground">Loading...</p>
              ) : (
                renderKV(apiKeyMetrics)
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </RouteGuard>
  );
}
