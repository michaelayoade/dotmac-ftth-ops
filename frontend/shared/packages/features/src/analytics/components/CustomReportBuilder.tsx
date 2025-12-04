/**
 * Custom Report Builder Component
 *
 * Interactive report builder for creating custom analytics reports with selected metrics and filters.
 * Shared between ISP Ops and Platform Admin applications.
 */

"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Input } from "@dotmac/ui";
import { Label } from "@dotmac/ui";
import { Checkbox } from "@dotmac/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@dotmac/ui";
import { FileText, Download, Save, Eye } from "lucide-react";
import { useState } from "react";

export interface ReportConfig {
  name: string;
  description: string;
  dateRange: string;
  metrics: string[];
  groupBy: string;
  filters: Record<string, string>;
}

const availableMetrics = [
  { id: "revenue", label: "Total Revenue", category: "Billing" },
  { id: "mrr", label: "Monthly Recurring Revenue", category: "Billing" },
  { id: "arr", label: "Annual Recurring Revenue", category: "Billing" },
  { id: "new_customers", label: "New Customers", category: "Customers" },
  {
    id: "churned_customers",
    label: "Churned Customers",
    category: "Customers",
  },
  { id: "active_customers", label: "Active Customers", category: "Customers" },
  { id: "churn_rate", label: "Churn Rate", category: "Customers" },
  {
    id: "avg_customer_value",
    label: "Average Customer Value",
    category: "Billing",
  },
  { id: "ltv", label: "Customer Lifetime Value", category: "Billing" },
  { id: "cac", label: "Customer Acquisition Cost", category: "Marketing" },
  { id: "open_tickets", label: "Open Tickets", category: "Support" },
  { id: "resolved_tickets", label: "Resolved Tickets", category: "Support" },
  {
    id: "avg_resolution_time",
    label: "Avg Resolution Time",
    category: "Support",
  },
  { id: "network_uptime", label: "Network Uptime %", category: "Operations" },
  {
    id: "bandwidth_usage",
    label: "Total Bandwidth Usage",
    category: "Operations",
  },
];

const groupByOptions = [
  { value: "day", label: "Daily" },
  { value: "week", label: "Weekly" },
  { value: "month", label: "Monthly" },
  { value: "quarter", label: "Quarterly" },
  { value: "year", label: "Yearly" },
  { value: "plan", label: "By Plan" },
  { value: "region", label: "By Region" },
];

interface ApiClient {
  post: (url: string, data?: any) => Promise<{ status: number; data?: any }>;
}

interface Toast {
  title: string;
  description: string;
  variant?: "default" | "destructive";
}

interface ToastHook {
  toast: (options: Toast) => void;
}

interface Logger {
  error: (message: string, error: Error) => void;
  debug: (message: string, context?: any) => void;
}

export interface CustomReportBuilderProps {
  apiClient: ApiClient;
  useToast: () => ToastHook;
  logger: Logger;
}

export function CustomReportBuilder({ apiClient, useToast, logger }: CustomReportBuilderProps) {
  const { toast } = useToast();
  const [config, setConfig] = useState<ReportConfig>({
    name: "",
    description: "",
    dateRange: "30d",
    metrics: [],
    groupBy: "month",
    filters: {},
  });

  const handleMetricToggle = (metricId: string) => {
    setConfig((prev) => ({
      ...prev,
      metrics: prev.metrics.includes(metricId)
        ? prev.metrics.filter((m) => m !== metricId)
        : [...prev.metrics, metricId],
    }));
  };

  const handleSaveReport = async () => {
    if (!config.name.trim()) {
      toast({
        title: "Validation Error",
        description: "Please provide a report name",
        variant: "destructive",
      });
      return;
    }

    if (config.metrics.length === 0) {
      toast({
        title: "Validation Error",
        description: "Please select at least one metric",
        variant: "destructive",
      });
      return;
    }

    try {
      // Save report configuration to backend
      await apiClient.post("/analytics/reports", {
        name: config.name,
        description: config.description,
        date_range: config.dateRange,
        metrics: config.metrics,
        group_by: config.groupBy,
        filters: config.filters,
      });

      toast({
        title: "Report Saved",
        description: `Custom report "${config.name}" has been saved successfully.`,
      });
    } catch (error) {
      logger.error(
        "Failed to save custom report",
        error instanceof Error ? error : new Error(String(error)),
      );
      toast({
        title: "Save Failed",
        description:
          error instanceof Error ? error.message : "Failed to save report. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleGenerateReport = async () => {
    if (config.metrics.length === 0) {
      toast({
        title: "Validation Error",
        description: "Please select at least one metric",
        variant: "destructive",
      });
      return;
    }

    try {
      // Generate report data from backend
      const response = await apiClient.post("/analytics/reports/generate", {
        date_range: config.dateRange,
        metrics: config.metrics,
        group_by: config.groupBy,
        filters: config.filters,
      });

      const reportData = response.data;

      // Display the generated report
      // Note: In a real implementation, this would open a modal or navigate to a report view
      logger.debug("Generated report data", {
        reportName: config.name || undefined,
        metricCount: config.metrics.length,
      });

      toast({
        title: "Report Generated",
        description: `Your custom report is ready with ${reportData.dataPoints || 0} data points.`,
      });

      // Optional: Store report data in state for display
      // setGeneratedReport(reportData);
    } catch (error) {
      logger.error(
        "Failed to generate custom report",
        error instanceof Error ? error : new Error(String(error)),
      );
      toast({
        title: "Generation Failed",
        description:
          error instanceof Error ? error.message : "Failed to generate report. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleExportReport = () => {
    if (config.metrics.length === 0) {
      toast({
        title: "Validation Error",
        description: "Please select at least one metric",
        variant: "destructive",
      });
      return;
    }

    // Generate sample CSV
    const headers = [
      "Date",
      ...config.metrics.map((m) => {
        const metric = availableMetrics.find((am) => am.id === m);
        return metric?.label || m;
      }),
    ];

    const csvContent = headers.join(",");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${config.name || "custom-report"}-${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "Report Exported",
      description: "Your report has been downloaded as CSV.",
    });
  };

  // Group metrics by category
  const metricsByCategory = availableMetrics.reduce(
    (acc, metric) => {
      if (!acc[metric.category]) {
        acc[metric.category] = [];
      }
      acc[metric.category]?.push(metric);
      return acc;
    },
    {} as Record<string, typeof availableMetrics>,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Custom Report Builder
        </CardTitle>
        <CardDescription>
          Create custom analytics reports with selected metrics and filters
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Report Details */}
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="reportName">Report Name *</Label>
              <Input
                id="reportName"
                placeholder="e.g., Monthly Revenue Analysis"
                value={config.name}
                onChange={(e) => setConfig({ ...config, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dateRange">Date Range</Label>
              <Select
                value={config.dateRange}
                onValueChange={(v) => setConfig({ ...config, dateRange: v })}
              >
                <SelectTrigger id="dateRange">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7d">Last 7 days</SelectItem>
                  <SelectItem value="30d">Last 30 days</SelectItem>
                  <SelectItem value="90d">Last 90 days</SelectItem>
                  <SelectItem value="12m">Last 12 months</SelectItem>
                  <SelectItem value="ytd">Year to date</SelectItem>
                  <SelectItem value="all">All time</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (Optional)</Label>
            <Input
              id="description"
              placeholder="Brief description of this report"
              value={config.description}
              onChange={(e) => setConfig({ ...config, description: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="groupBy">Group By</Label>
            <Select
              value={config.groupBy}
              onValueChange={(v) => setConfig({ ...config, groupBy: v })}
            >
              <SelectTrigger id="groupBy">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {groupByOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Metrics Selection */}
        <div className="space-y-3">
          <Label>Select Metrics *</Label>
          <p className="text-sm text-muted-foreground">
            Choose the metrics you want to include in your report
          </p>

          <div className="border rounded-lg p-4 space-y-4 max-h-[400px] overflow-y-auto">
            {Object.entries(metricsByCategory).map(([category, metrics]) => (
              <div key={category} className="space-y-2">
                <h4 className="font-semibold text-sm">{category}</h4>
                <div className="grid gap-2 md:grid-cols-2">
                  {metrics.map((metric) => (
                    <div key={metric.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={metric.id}
                        checked={config.metrics.includes(metric.id)}
                        onChange={() => handleMetricToggle(metric.id)}
                      />
                      <label
                        htmlFor={metric.id}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        {metric.label}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {config.metrics.length > 0 && (
            <p className="text-sm text-muted-foreground">
              {config.metrics.length} metric
              {config.metrics.length !== 1 ? "s" : ""} selected
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2 pt-4 border-t">
          <Button onClick={handleGenerateReport}>
            <Eye className="h-4 w-4 mr-2" />
            Preview Report
          </Button>
          <Button variant="outline" onClick={handleSaveReport}>
            <Save className="h-4 w-4 mr-2" />
            Save Template
          </Button>
          <Button variant="outline" onClick={handleExportReport}>
            <Download className="h-4 w-4 mr-2" />
            Export to CSV
          </Button>
        </div>

        {/* Saved Reports (Placeholder) */}
        <div className="border-t pt-4">
          <h4 className="font-semibold mb-3">Saved Report Templates</h4>
          <div className="text-sm text-muted-foreground text-center py-8 border rounded-lg bg-muted/30">
            No saved reports yet. Create and save your first custom report above.
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
