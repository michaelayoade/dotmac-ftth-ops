/**
 * Analytics & Business Intelligence API Client
 * Handles data visualization, reporting, and business metrics
 */

import { BaseApiClient } from "./BaseApiClient";
import type { PaginatedResponse, QueryParams } from "../types/api";

export interface AnalyticsReport {
  id: string;
  name: string;
  description: string;
  category: "FINANCIAL" | "OPERATIONAL" | "CUSTOMER" | "TECHNICAL" | "COMPLIANCE";
  report_type: "STANDARD" | "CUSTOM" | "SCHEDULED" | "REAL_TIME";
  data_sources: string[];
  parameters: ReportParameter[];
  output_formats: ("PDF" | "CSV" | "EXCEL" | "JSON")[];
  schedule?: ReportSchedule;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ReportParameter {
  name: string;
  type: "STRING" | "NUMBER" | "DATE" | "BOOLEAN" | "SELECT";
  required: boolean;
  default_value?: any;
  options?: string[];
  description: string;
}

export interface ReportSchedule {
  frequency: "DAILY" | "WEEKLY" | "MONTHLY" | "QUARTERLY";
  time: string;
  recipients: string[];
  enabled: boolean;
}

export interface ReportExecution {
  id: string;
  report_id: string;
  status: "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED";
  parameters: Record<string, any>;
  output_format: string;
  file_url?: string;
  error_message?: string;
  execution_time?: number;
  started_at: string;
  completed_at?: string;
}

export interface DashboardWidget {
  id: string;
  dashboard_id: string;
  title: string;
  type: "CHART" | "TABLE" | "METRIC" | "MAP" | "TEXT";
  position: { x: number; y: number; width: number; height: number };
  config: WidgetConfig;
  data_source: string;
  refresh_interval?: number;
}

export interface WidgetConfig {
  chart_type?: "LINE" | "BAR" | "PIE" | "AREA" | "SCATTER";
  metrics: string[];
  dimensions?: string[];
  filters?: Record<string, any>;
  time_range?: string;
  aggregation?: "SUM" | "AVG" | "COUNT" | "MIN" | "MAX";
}

export interface Dashboard {
  id: string;
  name: string;
  description: string;
  category: string;
  widgets: DashboardWidget[];
  shared_with: string[];
  is_public: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface MetricDefinition {
  id: string;
  name: string;
  display_name: string;
  description: string;
  unit: string;
  data_type: "NUMBER" | "PERCENTAGE" | "CURRENCY" | "DURATION";
  aggregation_method: "SUM" | "AVG" | "COUNT" | "MIN" | "MAX";
  formula?: string;
  dimensions: string[];
}

export class AnalyticsApiClient extends BaseApiClient {
  constructor(baseURL: string, defaultHeaders: Record<string, string> = {}) {
    super(baseURL, defaultHeaders);
  }

  // Reports
  async getReports(params?: QueryParams): Promise<PaginatedResponse<AnalyticsReport>> {
    return this.get("/api/analytics/reports", { params });
  }

  async getReport(reportId: string): Promise<{ data: AnalyticsReport }> {
    return this.get(`/api/analytics/reports/${reportId}`);
  }

  async createReport(
    data: Omit<AnalyticsReport, "id" | "created_at" | "updated_at">,
  ): Promise<{ data: AnalyticsReport }> {
    return this.post("/api/analytics/reports", data);
  }

  async updateReport(
    reportId: string,
    data: Partial<AnalyticsReport>,
  ): Promise<{ data: AnalyticsReport }> {
    return this.put(`/api/analytics/reports/${reportId}`, data);
  }

  async deleteReport(reportId: string): Promise<{ success: boolean }> {
    return this.delete(`/api/analytics/reports/${reportId}`);
  }

  async executeReport(
    reportId: string,
    parameters: Record<string, any>,
    format: string = "JSON",
  ): Promise<{ data: ReportExecution }> {
    return this.post(`/api/analytics/reports/${reportId}/execute`, {
      parameters,
      format,
    });
  }

  async getReportExecution(executionId: string): Promise<{ data: ReportExecution }> {
    return this.get(`/api/analytics/executions/${executionId}`);
  }

  async getReportExecutions(
    reportId: string,
    params?: QueryParams,
  ): Promise<PaginatedResponse<ReportExecution>> {
    return this.get(`/api/analytics/reports/${reportId}/executions`, {
      params,
    });
  }

  // Dashboards
  async getDashboards(params?: QueryParams): Promise<PaginatedResponse<Dashboard>> {
    return this.get("/api/analytics/dashboards", { params });
  }

  async getDashboard(dashboardId: string): Promise<{ data: Dashboard }> {
    return this.get(`/api/analytics/dashboards/${dashboardId}`);
  }

  async createDashboard(
    data: Omit<Dashboard, "id" | "widgets" | "created_at" | "updated_at">,
  ): Promise<{ data: Dashboard }> {
    return this.post("/api/analytics/dashboards", data);
  }

  async updateDashboard(
    dashboardId: string,
    data: Partial<Dashboard>,
  ): Promise<{ data: Dashboard }> {
    return this.put(`/api/analytics/dashboards/${dashboardId}`, data);
  }

  async deleteDashboard(dashboardId: string): Promise<{ success: boolean }> {
    return this.delete(`/api/analytics/dashboards/${dashboardId}`);
  }

  // Dashboard Widgets
  async addWidget(
    dashboardId: string,
    widget: Omit<DashboardWidget, "id" | "dashboard_id">,
  ): Promise<{ data: DashboardWidget }> {
    return this.post(`/api/analytics/dashboards/${dashboardId}/widgets`, widget);
  }

  async updateWidget(
    dashboardId: string,
    widgetId: string,
    data: Partial<DashboardWidget>,
  ): Promise<{ data: DashboardWidget }> {
    return this.put(`/api/analytics/dashboards/${dashboardId}/widgets/${widgetId}`, data);
  }

  async deleteWidget(dashboardId: string, widgetId: string): Promise<{ success: boolean }> {
    return this.delete(`/api/analytics/dashboards/${dashboardId}/widgets/${widgetId}`);
  }

  async getWidgetData(
    dashboardId: string,
    widgetId: string,
    params?: { time_range?: string },
  ): Promise<{ data: any }> {
    return this.get(`/api/analytics/dashboards/${dashboardId}/widgets/${widgetId}/data`, {
      params,
    });
  }

  // Metrics
  async getMetrics(params?: QueryParams): Promise<PaginatedResponse<MetricDefinition>> {
    return this.get("/api/analytics/metrics", { params });
  }

  async getMetricData(
    metricName: string,
    params?: {
      start_date?: string;
      end_date?: string;
      granularity?: string;
      filters?: Record<string, any>;
    },
  ): Promise<{ data: any }> {
    return this.get(`/api/analytics/metrics/${metricName}/data`, { params });
  }

  async getMultiMetricData(
    metrics: string[],
    params?: {
      start_date?: string;
      end_date?: string;
      granularity?: string;
      filters?: Record<string, any>;
    },
  ): Promise<{ data: Record<string, any> }> {
    return this.post("/api/analytics/metrics/bulk", { metrics, ...params });
  }

  // Business Intelligence
  async getRevenueTrends(params?: {
    period?: string;
    granularity?: string;
  }): Promise<{ data: any }> {
    return this.get("/api/analytics/bi/revenue-trends", { params });
  }

  async getCustomerAnalytics(params?: {
    segment?: string;
    period?: string;
  }): Promise<{ data: any }> {
    return this.get("/api/analytics/bi/customer-analytics", { params });
  }

  async getChurnAnalysis(params?: { period?: string; cohort?: string }): Promise<{ data: any }> {
    return this.get("/api/analytics/bi/churn-analysis", { params });
  }

  async getServicePerformance(params?: {
    service_type?: string;
    period?: string;
  }): Promise<{ data: any }> {
    return this.get("/api/analytics/bi/service-performance", { params });
  }

  async getOperationalMetrics(params?: {
    department?: string;
    period?: string;
  }): Promise<{ data: any }> {
    return this.get("/api/analytics/bi/operational-metrics", { params });
  }

  // Data Export
  async exportData(params: {
    data_type: string;
    format: "CSV" | "EXCEL" | "JSON";
    filters?: Record<string, any>;
    date_range?: { start: string; end: string };
  }): Promise<{ data: { export_id: string; download_url: string } }> {
    return this.post("/api/analytics/export", params);
  }

  async getExportStatus(exportId: string): Promise<{
    data: { status: string; progress: number; download_url?: string };
  }> {
    return this.get(`/api/analytics/export/${exportId}/status`);
  }

  // Real-time Analytics
  async getRealTimeMetrics(metrics: string[]): Promise<{ data: Record<string, any> }> {
    return this.post("/api/analytics/realtime", { metrics });
  }

  async subscribeToMetrics(
    metrics: string[],
    callback: (data: any) => void,
  ): Promise<{ subscription_id: string }> {
    const response = await this.post("/api/analytics/realtime/subscribe", {
      metrics,
    });
    // Note: Actual WebSocket implementation would be handled by the real-time system
    return response;
  }
}
