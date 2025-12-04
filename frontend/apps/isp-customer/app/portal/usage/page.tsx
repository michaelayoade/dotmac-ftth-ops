"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@dotmac/ui";
import { Progress } from "@dotmac/ui";
import { BarChart3, Download, Upload, Loader2 } from "lucide-react";
import { useCustomerUsage } from "@/hooks/useCustomerPortal";

export default function UsagePage() {
  const { usage, loading } = useCustomerUsage();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading usage data...</p>
        </div>
      </div>
    );
  }

  const totalUsage = usage ? usage.upload_gb + usage.download_gb : 0;
  const usageLimit = usage?.limit_gb ?? 0;
  const usagePercentage = usageLimit > 0 ? (totalUsage / usageLimit) * 100 : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Data Usage</h1>
        <p className="text-muted-foreground">Monitor your internet usage</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Current Billing Period
          </CardTitle>
          <CardDescription>
            {usage?.period_start && usage?.period_end
              ? `${new Date(usage.period_start).toLocaleDateString()} - ${new Date(usage.period_end).toLocaleDateString()}`
              : "Current period"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="font-medium">
                {totalUsage.toFixed(1)} GB used
                {usageLimit > 0 ? ` of ${usageLimit} GB` : ""}
              </span>
              <span className="text-muted-foreground">{usagePercentage.toFixed(1)}%</span>
            </div>
            <Progress value={usagePercentage} className="h-3" />
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="p-4 border rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Download className="h-5 w-5 text-blue-500" />
                <span className="font-medium">Download</span>
              </div>
              <p className="text-3xl font-bold text-blue-500">
                {usage?.download_gb.toFixed(1) ?? "0"} GB
              </p>
            </div>
            <div className="p-4 border rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Upload className="h-5 w-5 text-green-500" />
                <span className="font-medium">Upload</span>
              </div>
              <p className="text-3xl font-bold text-green-500">
                {usage?.upload_gb.toFixed(1) ?? "0"} GB
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
