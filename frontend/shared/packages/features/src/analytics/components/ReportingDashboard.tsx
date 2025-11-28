/**
 * ReportingDashboard Component
 *
 * Analytics and reporting dashboard for generating and scheduling reports.
 * Shared between ISP Ops and Platform Admin applications.
 */

"use client";

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@dotmac/ui";
import { Label } from "@dotmac/ui";
import {
  FileText,
  Download,
  Calendar,
  BarChart3,
  TrendingUp,
  Users,
  Activity,
  DollarSign,
  Filter,
} from "lucide-react";
import { useState } from "react";

export interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  icon: any;
  category: "network" | "business" | "operations" | "diagnostics";
  formats: string[];
  parameters: ReportParameter[];
}

export interface ReportParameter {
  name: string;
  label: string;
  type: "date_range" | "select" | "multi_select";
  options?: string[];
  default?: any;
}

interface ApiClient {
  post: <T = any>(url: string, data?: any, config?: any) => Promise<{ data: T }>;
}

interface Toast {
  title: string;
  description: string;
  variant?: "default" | "destructive";
}

interface ToastHook {
  toast: (options: Toast) => void;
}

export interface ReportingDashboardProps {
  apiClient: ApiClient;
  useToast: () => ToastHook;
}

const REPORT_TEMPLATES: ReportTemplate[] = [
  {
    id: "network_health_summary",
    name: "Network Health Summary",
    description: "Daily/weekly/monthly network performance and device health metrics",
    icon: Activity,
    category: "network",
    formats: ["pdf", "csv", "excel"],
    parameters: [
      {
        name: "date_range",
        label: "Date Range",
        type: "select",
        options: ["last_7_days", "last_30_days", "last_90_days", "custom"],
        default: "last_30_days",
      },
      {
        name: "include_devices",
        label: "Device Types",
        type: "multi_select",
        options: ["ONU", "CPE", "OLT", "Router"],
      },
    ],
  },
  {
    id: "subscriber_performance",
    name: "Subscriber Performance Report",
    description: "Bandwidth utilization, latency, and QoS metrics per subscriber",
    icon: Users,
    category: "operations",
    formats: ["pdf", "excel"],
    parameters: [
      {
        name: "date_range",
        label: "Date Range",
        type: "select",
        options: ["last_7_days", "last_30_days", "last_90_days"],
        default: "last_30_days",
      },
      {
        name: "service_plan",
        label: "Service Plan",
        type: "select",
        options: ["all", "residential", "business", "enterprise"],
        default: "all",
      },
    ],
  },
  {
    id: "diagnostics_summary",
    name: "Diagnostics & Troubleshooting Report",
    description: "Summary of diagnostic runs, issues found, and remediation actions",
    icon: BarChart3,
    category: "diagnostics",
    formats: ["pdf", "csv"],
    parameters: [
      {
        name: "date_range",
        label: "Date Range",
        type: "select",
        options: ["last_7_days", "last_30_days", "last_90_days"],
        default: "last_30_days",
      },
      {
        name: "diagnostic_type",
        label: "Diagnostic Type",
        type: "select",
        options: ["all", "connectivity", "performance", "device_health"],
        default: "all",
      },
    ],
  },
  {
    id: "revenue_analytics",
    name: "Revenue Analytics Report",
    description: "MRR, churn, customer acquisition, and revenue trends",
    icon: DollarSign,
    category: "business",
    formats: ["pdf", "excel"],
    parameters: [
      {
        name: "date_range",
        label: "Date Range",
        type: "select",
        options: ["last_month", "last_quarter", "last_year", "custom"],
        default: "last_month",
      },
      {
        name: "breakdown",
        label: "Breakdown By",
        type: "select",
        options: ["service_plan", "region", "customer_type"],
        default: "service_plan",
      },
    ],
  },
  {
    id: "sla_compliance",
    name: "SLA Compliance Report",
    description: "Uptime, latency SLA compliance, and violation details",
    icon: TrendingUp,
    category: "operations",
    formats: ["pdf", "excel"],
    parameters: [
      {
        name: "date_range",
        label: "Date Range",
        type: "select",
        options: ["last_month", "last_quarter", "last_year"],
        default: "last_month",
      },
    ],
  },
  {
    id: "incident_summary",
    name: "Incident & Alert Summary",
    description: "Network incidents, alerts, mean time to resolution",
    icon: Activity,
    category: "operations",
    formats: ["pdf", "csv", "excel"],
    parameters: [
      {
        name: "date_range",
        label: "Date Range",
        type: "select",
        options: ["last_7_days", "last_30_days", "last_90_days"],
        default: "last_30_days",
      },
      {
        name: "severity",
        label: "Severity",
        type: "select",
        options: ["all", "critical", "high", "medium", "low"],
        default: "all",
      },
    ],
  },
];

export function ReportingDashboard({ apiClient, useToast }: ReportingDashboardProps) {
  const { toast } = useToast();

  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [generatingReport, setGeneratingReport] = useState<string | null>(null);

  const generateReport = async (reportId: string, format: string) => {
    setGeneratingReport(`${reportId}-${format}`);

    try {
      const response = await apiClient.post(
        `/api/platform/v1/admin/analytics/reports/generate`,
        {
          report_id: reportId,
          format,
          parameters: {}, // Would be filled from form inputs
        },
        {
          responseType: "blob",
        },
      );

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute(
        "download",
        `${reportId}-${new Date().toISOString().split("T")[0]}.${format}`,
      );
      document.body.appendChild(link);
      link.click();
      link.remove();

      toast({
        title: "Report generated",
        description: `Your ${format.toUpperCase()} report has been downloaded`,
      });
    } catch (err: any) {
      toast({
        title: "Report generation failed",
        description: err?.response?.data?.detail || "Could not generate report",
        variant: "destructive",
      });
    } finally {
      setGeneratingReport(null);
    }
  };

  const scheduleReport = async (reportId: string) => {
    try {
      await apiClient.post(`/api/platform/v1/admin/analytics/reports/schedule`, {
        report_id: reportId,
        frequency: "weekly",
        recipients: [],
      });

      toast({
        title: "Report scheduled",
        description: "You will receive this report weekly via email",
      });
    } catch (err: any) {
      toast({
        title: "Failed to schedule report",
        description: err?.response?.data?.detail || "Could not schedule report",
        variant: "destructive",
      });
    }
  };

  const filteredReports =
    selectedCategory === "all"
      ? REPORT_TEMPLATES
      : REPORT_TEMPLATES.filter((r) => r.category === selectedCategory);

  const getCategoryBadge = (category: string) => {
    const colors: Record<string, string> = {
      network: "bg-blue-100 text-blue-700",
      business: "bg-green-100 text-green-700",
      operations: "bg-purple-100 text-purple-700",
      diagnostics: "bg-orange-100 text-orange-700",
    };

    return (
      <Badge variant="outline" className={colors[category]}>
        {category}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Reporting & Analytics</h2>
          <p className="text-sm text-muted-foreground">
            Generate and export detailed reports for your platform
          </p>
        </div>
        <Button variant="outline">
          <Calendar className="w-4 h-4 mr-2" />
          Scheduled Reports
        </Button>
      </div>

      {/* Category Filter */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Report Category</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 flex-wrap">
            <Button
              variant={selectedCategory === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory("all")}
            >
              All Reports
            </Button>
            <Button
              variant={selectedCategory === "network" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory("network")}
            >
              <Activity className="w-4 h-4 mr-2" />
              Network
            </Button>
            <Button
              variant={selectedCategory === "business" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory("business")}
            >
              <DollarSign className="w-4 h-4 mr-2" />
              Business
            </Button>
            <Button
              variant={selectedCategory === "operations" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory("operations")}
            >
              <Users className="w-4 h-4 mr-2" />
              Operations
            </Button>
            <Button
              variant={selectedCategory === "diagnostics" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory("diagnostics")}
            >
              <BarChart3 className="w-4 h-4 mr-2" />
              Diagnostics
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Report Templates */}
      <div className="grid gap-4 md:grid-cols-2">
        {filteredReports.map((report) => {
          const Icon = report.icon;
          return (
            <Card key={report.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className="w-5 h-5" />
                    <CardTitle className="text-base">{report.name}</CardTitle>
                  </div>
                  {getCategoryBadge(report.category)}
                </div>
                <CardDescription>{report.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Parameters */}
                {report.parameters.length > 0 && (
                  <div className="space-y-2">
                    {report.parameters.map((param) => (
                      <div key={param.name} className="space-y-1">
                        <Label className="text-xs">{param.label}</Label>
                        {param.type === "select" && (
                          <Select defaultValue={param.default}>
                            <SelectTrigger className="h-8 text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {param.options?.map((option) => (
                                <SelectItem key={option} value={option}>
                                  {option
                                    .replace(/_/g, " ")
                                    .replace(/\b\w/g, (l) => l.toUpperCase())}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Export Options */}
                <div className="pt-3 border-t">
                  <div className="text-xs font-medium text-muted-foreground mb-2">Export as:</div>
                  <div className="flex gap-2 flex-wrap">
                    {report.formats.map((format) => (
                      <Button
                        key={format}
                        size="sm"
                        variant="outline"
                        onClick={() => generateReport(report.id, format)}
                        disabled={generatingReport === `${report.id}-${format}`}
                      >
                        <Download className="w-3 h-3 mr-1" />
                        {format.toUpperCase()}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Schedule */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => scheduleReport(report.id)}
                  className="w-full"
                >
                  <Calendar className="w-4 h-4 mr-2" />
                  Schedule Regular Delivery
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
