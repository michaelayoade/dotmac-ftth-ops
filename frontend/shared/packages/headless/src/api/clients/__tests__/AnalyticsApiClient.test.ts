/**
 * AnalyticsApiClient Tests
 * Critical test suite for business intelligence and reporting functionality
 */

import { AnalyticsApiClient } from "../AnalyticsApiClient";
import type {
  AnalyticsReport,
  ReportExecution,
  Dashboard,
  DashboardWidget,
  MetricDefinition,
} from "../AnalyticsApiClient";

// Mock fetch
global.fetch = jest.fn();
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

describe("AnalyticsApiClient", () => {
  let client: AnalyticsApiClient;
  const baseURL = "https://api.test.com";
  const defaultHeaders = { Authorization: "Bearer test-token" };
  const mockReport: AnalyticsReport = {
    id: "report_123",
    name: "Monthly Revenue Report",
    description: "Comprehensive monthly revenue analysis",
    category: "FINANCIAL",
    report_type: "SCHEDULED",
    data_sources: ["billing", "subscriptions", "payments"],
    parameters: [
      {
        name: "month",
        type: "DATE",
        required: true,
        description: "Report month",
      },
      {
        name: "include_tax",
        type: "BOOLEAN",
        required: false,
        default_value: true,
        description: "Include tax in calculations",
      },
    ],
    output_formats: ["PDF", "EXCEL", "CSV"],
    schedule: {
      frequency: "MONTHLY",
      time: "08:00",
      recipients: ["admin@example.com", "finance@example.com"],
      enabled: true,
    },
    created_by: "user_456",
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-15T10:30:00Z",
  };

  const mockDashboard: Dashboard = {
    id: "dash_123",
    name: "Executive Dashboard",
    description: "High-level business metrics overview",
    category: "EXECUTIVE",
    widgets: [],
    shared_with: ["exec_team", "board_members"],
    is_public: false,
    created_by: "admin_user",
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-15T10:30:00Z",
  };

  const mockWidget: DashboardWidget = {
    id: "widget_123",
    dashboard_id: "dash_123",
    title: "Monthly Revenue",
    type: "CHART",
    position: { x: 0, y: 0, width: 6, height: 4 },
    config: {
      chart_type: "LINE",
      metrics: ["revenue"],
      time_range: "12M",
      aggregation: "SUM",
    },
    data_source: "billing",
    refresh_interval: 300,
  };

  beforeEach(() => {
    client = new AnalyticsApiClient(baseURL, defaultHeaders);
    jest.clearAllMocks();
  });

  const mockResponse = <T>(data: T, status = 200) => {
    mockFetch.mockResolvedValueOnce({
      ok: status >= 200 && status < 300,
      status,
      json: async () => data,
    } as Response);
  };

  describe("Reports Management", () => {
    it("should get reports with filters", async () => {
      mockResponse({
        data: [mockReport],
        pagination: {
          page: 1,
          limit: 10,
          total: 1,
          total_pages: 1,
        },
      });

      const result = await client.getReports({
        category: "FINANCIAL",
        report_type: "SCHEDULED",
        created_by: "user_456",
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/analytics/reports?category=FINANCIAL&report_type=SCHEDULED&created_by=user_456",
        expect.any(Object),
      );

      expect(result.data).toHaveLength(1);
      expect(result.data[0].name).toBe("Monthly Revenue Report");
    });

    it("should create a new report", async () => {
      const reportData = {
        name: "Customer Churn Analysis",
        description: "Analysis of customer retention patterns",
        category: "CUSTOMER" as const,
        report_type: "CUSTOM" as const,
        data_sources: ["customers", "subscriptions", "support_tickets"],
        parameters: [
          {
            name: "period",
            type: "SELECT" as const,
            required: true,
            options: ["3M", "6M", "12M"],
            description: "Analysis period",
          },
        ],
        output_formats: ["PDF", "JSON"] as const,
        created_by: "analyst_789",
      };

      mockResponse({
        data: {
          ...reportData,
          id: "report_124",
          created_at: "2024-01-16T10:00:00Z",
          updated_at: "2024-01-16T10:00:00Z",
        },
      });

      const result = await client.createReport(reportData);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/analytics/reports",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify(reportData),
        }),
      );

      expect(result.data.id).toBe("report_124");
      expect(result.data.name).toBe("Customer Churn Analysis");
    });

    it("should execute report with parameters", async () => {
      const mockExecution: ReportExecution = {
        id: "exec_123",
        report_id: "report_123",
        status: "RUNNING",
        parameters: {
          month: "2024-01",
          include_tax: true,
        },
        output_format: "PDF",
        started_at: "2024-01-16T10:30:00Z",
      };

      mockResponse({ data: mockExecution });

      const result = await client.executeReport(
        "report_123",
        {
          month: "2024-01",
          include_tax: true,
        },
        "PDF",
      );

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/analytics/reports/report_123/execute",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            parameters: { month: "2024-01", include_tax: true },
            format: "PDF",
          }),
        }),
      );

      expect(result.data.status).toBe("RUNNING");
      expect(result.data.parameters.month).toBe("2024-01");
    });

    it("should get report execution status", async () => {
      const completedExecution: ReportExecution = {
        id: "exec_123",
        report_id: "report_123",
        status: "COMPLETED",
        parameters: { month: "2024-01" },
        output_format: "PDF",
        file_url: "https://storage.example.com/reports/exec_123.pdf",
        execution_time: 45000,
        started_at: "2024-01-16T10:30:00Z",
        completed_at: "2024-01-16T10:30:45Z",
      };

      mockResponse({ data: completedExecution });

      const result = await client.getReportExecution("exec_123");

      expect(result.data.status).toBe("COMPLETED");
      expect(result.data.file_url).toBe("https://storage.example.com/reports/exec_123.pdf");
      expect(result.data.execution_time).toBe(45000);
    });

    it("should handle report execution failures", async () => {
      const failedExecution: ReportExecution = {
        id: "exec_124",
        report_id: "report_123",
        status: "FAILED",
        parameters: { month: "invalid-date" },
        output_format: "PDF",
        error_message: "Invalid date parameter format",
        started_at: "2024-01-16T10:30:00Z",
        completed_at: "2024-01-16T10:30:05Z",
      };

      mockResponse({ data: failedExecution });

      const result = await client.getReportExecution("exec_124");

      expect(result.data.status).toBe("FAILED");
      expect(result.data.error_message).toBe("Invalid date parameter format");
    });
  });

  describe("Dashboard Management", () => {
    it("should create dashboard", async () => {
      const dashboardData = {
        name: "Customer Success Dashboard",
        description: "Customer health and satisfaction metrics",
        category: "CUSTOMER",
        shared_with: ["cs_team"],
        is_public: false,
        created_by: "cs_manager",
      };

      mockResponse({
        data: {
          ...dashboardData,
          id: "dash_124",
          widgets: [],
          created_at: "2024-01-16T10:00:00Z",
          updated_at: "2024-01-16T10:00:00Z",
        },
      });

      const result = await client.createDashboard(dashboardData);

      expect(result.data.id).toBe("dash_124");
      expect(result.data.name).toBe("Customer Success Dashboard");
      expect(result.data.widgets).toEqual([]);
    });

    it("should add widget to dashboard", async () => {
      const widgetData = {
        title: "Active Customers",
        type: "METRIC" as const,
        position: { x: 6, y: 0, width: 3, height: 2 },
        config: {
          metrics: ["active_customers"],
          time_range: "1M",
          aggregation: "COUNT" as const,
        },
        data_source: "customers",
        refresh_interval: 600,
      };

      mockResponse({
        data: {
          ...widgetData,
          id: "widget_124",
          dashboard_id: "dash_123",
        },
      });

      const result = await client.addWidget("dash_123", widgetData);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/analytics/dashboards/dash_123/widgets",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify(widgetData),
        }),
      );

      expect(result.data.id).toBe("widget_124");
      expect(result.data.title).toBe("Active Customers");
    });

    it("should get widget data", async () => {
      const widgetData = {
        labels: ["Jan", "Feb", "Mar", "Apr"],
        datasets: [
          {
            label: "Monthly Revenue",
            data: [125000, 135000, 128000, 142000],
            borderColor: "#3B82F6",
            backgroundColor: "rgba(59, 130, 246, 0.1)",
          },
        ],
        metadata: {
          total: 530000,
          growth_rate: 3.2,
          period: "4M",
        },
      };

      mockResponse({ data: widgetData });

      const result = await client.getWidgetData("dash_123", "widget_123", {
        time_range: "4M",
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/analytics/dashboards/dash_123/widgets/widget_123/data?time_range=4M",
        expect.any(Object),
      );

      expect(result.data.datasets[0].data).toEqual([125000, 135000, 128000, 142000]);
      expect(result.data.metadata.total).toBe(530000);
    });

    it("should handle dashboard sharing permissions", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: "Forbidden",
        json: async () => ({
          error: {
            code: "INSUFFICIENT_PERMISSIONS",
            message: "Cannot access private dashboard",
          },
        }),
      } as Response);

      await expect(client.getDashboard("private_dash")).rejects.toThrow("Forbidden");
    });
  });

  describe("Metrics and Data Analysis", () => {
    const mockMetric: MetricDefinition = {
      id: "metric_revenue",
      name: "revenue",
      display_name: "Monthly Revenue",
      description: "Total revenue generated per month",
      unit: "USD",
      data_type: "CURRENCY",
      aggregation_method: "SUM",
      dimensions: ["month", "service_type", "region"],
    };

    it("should get available metrics", async () => {
      mockResponse({
        data: [mockMetric],
        pagination: {
          page: 1,
          limit: 50,
          total: 1,
          total_pages: 1,
        },
      });

      const result = await client.getMetrics({
        category: "financial",
        data_type: "CURRENCY",
      });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].name).toBe("revenue");
      expect(result.data[0].data_type).toBe("CURRENCY");
    });

    it("should get metric data with time series", async () => {
      const timeSeriesData = {
        metric: "revenue",
        data_points: [
          { timestamp: "2024-01-01T00:00:00Z", value: 125000 },
          { timestamp: "2024-02-01T00:00:00Z", value: 135000 },
          { timestamp: "2024-03-01T00:00:00Z", value: 128000 },
        ],
        aggregation: "SUM",
        granularity: "MONTHLY",
        total: 388000,
        avg: 129333.33,
      };

      mockResponse({ data: timeSeriesData });

      const result = await client.getMetricData("revenue", {
        start_date: "2024-01-01",
        end_date: "2024-03-31",
        granularity: "MONTHLY",
        filters: { service_type: "fiber" },
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/analytics/metrics/revenue/data?start_date=2024-01-01&end_date=2024-03-31&granularity=MONTHLY&filters=%7B%22service_type%22%3A%22fiber%22%7D",
        expect.any(Object),
      );

      expect(result.data.data_points).toHaveLength(3);
      expect(result.data.total).toBe(388000);
    });

    it("should get multi-metric data efficiently", async () => {
      const multiMetricData = {
        revenue: {
          current_period: 142000,
          previous_period: 128000,
          growth_rate: 10.9,
          trend: "up",
        },
        customer_count: {
          current_period: 3450,
          previous_period: 3380,
          growth_rate: 2.1,
          trend: "up",
        },
        churn_rate: {
          current_period: 2.3,
          previous_period: 2.8,
          growth_rate: -17.9,
          trend: "down",
        },
      };

      mockResponse({ data: multiMetricData });

      const result = await client.getMultiMetricData(["revenue", "customer_count", "churn_rate"], {
        start_date: "2024-01-01",
        end_date: "2024-01-31",
        granularity: "MONTHLY",
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/analytics/metrics/bulk",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            metrics: ["revenue", "customer_count", "churn_rate"],
            start_date: "2024-01-01",
            end_date: "2024-01-31",
            granularity: "MONTHLY",
          }),
        }),
      );

      expect(result.data.revenue.growth_rate).toBe(10.9);
      expect(result.data.churn_rate.trend).toBe("down");
    });
  });

  describe("Business Intelligence Analytics", () => {
    it("should get revenue trends analysis", async () => {
      const revenueTrends = {
        total_revenue: 1680000,
        growth_rate: 12.5,
        trend_direction: "upward",
        seasonal_patterns: {
          q1: 380000,
          q2: 420000,
          q3: 410000,
          q4: 470000,
        },
        forecasts: {
          next_month: 145000,
          next_quarter: 435000,
          confidence_level: 85,
        },
        key_drivers: [
          { factor: "new_customers", impact: 8.2 },
          { factor: "service_upgrades", impact: 4.3 },
        ],
      };

      mockResponse({ data: revenueTrends });

      const result = await client.getRevenueTrends({
        period: "12M",
        granularity: "QUARTERLY",
      });

      expect(result.data.total_revenue).toBe(1680000);
      expect(result.data.forecasts.confidence_level).toBe(85);
    });

    it("should analyze customer segments", async () => {
      const customerAnalytics = {
        total_customers: 4250,
        segments: [
          {
            name: "high_value",
            count: 520,
            avg_revenue: 180,
            satisfaction_score: 4.7,
            churn_risk: "low",
          },
          {
            name: "standard",
            count: 3100,
            avg_revenue: 85,
            satisfaction_score: 4.2,
            churn_risk: "medium",
          },
          {
            name: "price_sensitive",
            count: 630,
            avg_revenue: 45,
            satisfaction_score: 3.8,
            churn_risk: "high",
          },
        ],
        lifetime_value: {
          avg_ltv: 2340,
          high_value_ltv: 5680,
          churn_impact: 156000,
        },
      };

      mockResponse({ data: customerAnalytics });

      const result = await client.getCustomerAnalytics({
        segment: "all",
        period: "12M",
      });

      expect(result.data.segments).toHaveLength(3);
      expect(result.data.segments[0].churn_risk).toBe("low");
    });

    it("should perform churn analysis", async () => {
      const churnAnalysis = {
        overall_churn_rate: 3.2,
        monthly_churn_trend: [2.8, 3.1, 3.4, 3.2, 2.9],
        cohort_analysis: {
          month_0: 100,
          month_1: 94.2,
          month_3: 88.5,
          month_6: 82.1,
          month_12: 74.8,
        },
        risk_factors: [
          { factor: "support_tickets", correlation: 0.72 },
          { factor: "payment_failures", correlation: 0.65 },
          { factor: "service_downtime", correlation: 0.58 },
        ],
        predicted_churn: {
          next_month: 138,
          confidence: 0.84,
          at_risk_customers: ["cust_123", "cust_456", "cust_789"],
        },
      };

      mockResponse({ data: churnAnalysis });

      const result = await client.getChurnAnalysis({
        period: "12M",
        cohort: "monthly",
      });

      expect(result.data.overall_churn_rate).toBe(3.2);
      expect(result.data.predicted_churn.at_risk_customers).toHaveLength(3);
    });
  });

  describe("Data Export and Real-time Features", () => {
    it("should export data in multiple formats", async () => {
      const exportResponse = {
        export_id: "export_123",
        download_url: "https://storage.example.com/exports/export_123.csv",
      };

      mockResponse({ data: exportResponse });

      const result = await client.exportData({
        data_type: "customer_data",
        format: "CSV",
        filters: { active: true, region: "north" },
        date_range: {
          start: "2024-01-01",
          end: "2024-01-31",
        },
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/analytics/export",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            data_type: "customer_data",
            format: "CSV",
            filters: { active: true, region: "north" },
            date_range: { start: "2024-01-01", end: "2024-01-31" },
          }),
        }),
      );

      expect(result.data.export_id).toBe("export_123");
      expect(result.data.download_url).toContain(".csv");
    });

    it("should track export progress", async () => {
      const exportStatus = {
        status: "PROCESSING",
        progress: 65,
        estimated_completion: "2024-01-16T10:35:00Z",
      };

      mockResponse({ data: exportStatus });

      const result = await client.getExportStatus("export_123");

      expect(result.data.status).toBe("PROCESSING");
      expect(result.data.progress).toBe(65);
    });

    it("should get real-time metrics", async () => {
      const realTimeData = {
        active_users: 1247,
        current_revenue_today: 12450,
        network_utilization: 67.3,
        support_queue_length: 23,
        system_health_score: 98.2,
        timestamp: "2024-01-16T10:45:32Z",
      };

      mockResponse({ data: realTimeData });

      const result = await client.getRealTimeMetrics([
        "active_users",
        "current_revenue_today",
        "network_utilization",
        "support_queue_length",
        "system_health_score",
      ]);

      expect(result.data.active_users).toBe(1247);
      expect(result.data.system_health_score).toBe(98.2);
    });

    it("should handle subscription to real-time metrics", async () => {
      const subscriptionResponse = {
        subscription_id: "sub_123",
      };

      mockResponse(subscriptionResponse);

      const result = await client.subscribeToMetrics(["revenue", "active_users"], (data) =>
        console.log("Real-time update:", data),
      );

      expect(result.subscription_id).toBe("sub_123");
    });
  });

  describe("Error Handling and Edge Cases", () => {
    it("should handle report parameter validation errors", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: "Bad Request",
        json: async () => ({
          error: {
            code: "INVALID_PARAMETERS",
            message: 'Required parameter "month" is missing',
            details: { missing_parameters: ["month"] },
          },
        }),
      } as Response);

      await expect(
        client.executeReport("report_123", {
          include_tax: true,
        }),
      ).rejects.toThrow("Bad Request");
    });

    it("should handle large dataset export timeouts", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 408,
        statusText: "Request Timeout",
        json: async () => ({
          error: {
            code: "EXPORT_TIMEOUT",
            message: "Data export request timed out",
          },
        }),
      } as Response);

      await expect(
        client.exportData({
          data_type: "all_customer_data",
          format: "EXCEL",
        }),
      ).rejects.toThrow("Request Timeout");
    });

    it("should handle dashboard quota limits", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: "Too Many Requests",
        json: async () => ({
          error: {
            code: "DASHBOARD_LIMIT_EXCEEDED",
            message: "Maximum number of dashboards reached",
          },
        }),
      } as Response);

      await expect(
        client.createDashboard({
          name: "New Dashboard",
          description: "Test dashboard",
          category: "TEST",
          shared_with: [],
          is_public: false,
          created_by: "test_user",
        }),
      ).rejects.toThrow("Too Many Requests");
    });

    it("should handle network errors gracefully", async () => {
      mockFetch.mockRejectedValue(new Error("Network connection failed"));

      await expect(client.getReports()).rejects.toThrow("Network connection failed");
    });
  });

  describe("Performance and Scalability", () => {
    it("should handle large report lists efficiently", async () => {
      const largeReportList = Array.from({ length: 500 }, (_, i) => ({
        ...mockReport,
        id: `report_${i}`,
        name: `Report ${i}`,
      }));

      mockResponse({
        data: largeReportList,
        pagination: {
          page: 1,
          limit: 500,
          total: 500,
          total_pages: 1,
        },
      });

      const startTime = performance.now();
      const result = await client.getReports({ limit: 500 });
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(100);
      expect(result.data).toHaveLength(500);
    });

    it("should handle complex dashboard configurations", async () => {
      const complexDashboard = {
        ...mockDashboard,
        widgets: Array.from({ length: 20 }, (_, i) => ({
          ...mockWidget,
          id: `widget_${i}`,
          title: `Widget ${i}`,
          position: {
            x: (i % 4) * 3,
            y: Math.floor(i / 4) * 2,
            width: 3,
            height: 2,
          },
        })),
      };

      mockResponse({ data: complexDashboard });

      const result = await client.getDashboard("complex_dash");

      expect(result.data.widgets).toHaveLength(20);
    });
  });
});
