/**
 * MSW Handlers for Dunning API Endpoints
 */

import { http, HttpResponse } from "msw";
import type {
  DunningCampaign,
  DunningExecution,
  DunningStatistics,
  DunningCampaignStats,
  DunningRecoveryChartData,
} from "../../../hooks/useDunning";

// In-memory storage for test data
let campaigns: DunningCampaign[] = [];
let executions: DunningExecution[] = [];
let nextCampaignId = 1;
let nextExecutionId = 1;

// Reset storage between tests
export function resetDunningStorage() {
  campaigns = [];
  executions = [];
  nextCampaignId = 1;
  nextExecutionId = 1;
}

// Helper to create a mock campaign
export function createMockDunningCampaign(overrides?: Partial<DunningCampaign>): DunningCampaign {
  const id = `campaign-${nextCampaignId++}`;
  return {
    id,
    tenant_id: "tenant-123",
    name: "Test Campaign",
    description: "A test dunning campaign",
    trigger_after_days: 30,
    max_retries: 3,
    retry_interval_days: 7,
    actions: [],
    exclusion_rules: {},
    is_active: true,
    status: "active",
    priority: 1,
    stages: [],
    total_executions: 0,
    successful_executions: 0,
    failed_executions: 0,
    total_recovered_amount: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

// Helper to create a mock execution
export function createMockDunningExecution(
  overrides?: Partial<DunningExecution>,
): DunningExecution {
  const id = `execution-${nextExecutionId++}`;
  return {
    id,
    tenant_id: "tenant-123",
    campaign_id: "campaign-1",
    subscription_id: "sub-123",
    subscriber_email: "test@example.com",
    status: "active",
    current_stage: 1,
    days_overdue: 5,
    amount_overdue: 100.0,
    actions_taken: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

// Helper to seed initial data
export function seedDunningData(
  campaignsData: DunningCampaign[],
  executionsData: DunningExecution[],
) {
  campaigns = [...campaignsData];
  executions = [...executionsData];
}

export const dunningHandlers = [
  // GET /api/v1/billing/dunning/campaigns - List campaigns
  http.get("*/api/v1/billing/dunning/campaigns", ({ request, params }) => {
    const url = new URL(request.url);
    const activeOnly = url.searchParams.get("active_only");
    const search = url.searchParams.get("search");
    const page = parseInt(url.searchParams.get("page") || "1");
    const pageSize = parseInt(url.searchParams.get("page_size") || "20");

    let filtered = campaigns;

    if (activeOnly === "true") {
      filtered = filtered.filter((c) => c.status === "active");
    } else if (activeOnly === "false") {
      filtered = filtered.filter((c) => c.status !== "active");
    }

    if (search) {
      filtered = filtered.filter(
        (c) =>
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          (c.description && c.description.toLowerCase().includes(search.toLowerCase())),
      );
    }

    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const paginated = filtered.slice(start, end);

    return HttpResponse.json(paginated);
  }),

  // GET /api/v1/billing/dunning/campaigns/:id - Get campaign
  http.get("*/api/v1/billing/dunning/campaigns/:id", ({ request, params }) => {
    const { id } = params;
    const campaign = campaigns.find((c) => c.id === id);

    if (!campaign) {
      return HttpResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    return HttpResponse.json(campaign);
  }),

  // POST /api/v1/billing/dunning/campaigns - Create campaign
  http.post("*/api/v1/billing/dunning/campaigns", async ({ request, params }) => {
    const data = await request.json();

    const newCampaign = createMockDunningCampaign({
      ...data,
    });

    campaigns.push(newCampaign);

    return HttpResponse.json(newCampaign, { status: 201 });
  }),

  // PATCH /dunning/campaigns/:id - Update campaign
  http.patch("*/api/v1/billing/dunning/campaigns/:id", async ({ request, params }) => {
    const { id } = params;
    const updates = await request.json();

    const index = campaigns.findIndex((c) => c.id === id);

    if (index === -1) {
      return HttpResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    campaigns[index] = {
      ...campaigns[index],
      ...updates,
      updated_at: new Date().toISOString(),
    };

    return HttpResponse.json(campaigns[index]);
  }),

  // DELETE /dunning/campaigns/:id - Delete campaign
  http.delete("*/api/v1/billing/dunning/campaigns/:id", ({ request, params }) => {
    const { id } = params;
    const index = campaigns.findIndex((c) => c.id === id);

    if (index === -1) {
      return HttpResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    campaigns.splice(index, 1);
    return new HttpResponse(null, { status: 204 });
  }),

  // POST /dunning/campaigns/:id/pause - Pause campaign
  http.post("*/api/v1/billing/dunning/campaigns/:id/pause", ({ request, params }) => {
    const { id } = params;
    const campaign = campaigns.find((c) => c.id === id);

    if (!campaign) {
      return HttpResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    campaign.status = "paused";
    campaign.updated_at = new Date().toISOString();

    return HttpResponse.json(campaign);
  }),

  // POST /dunning/campaigns/:id/resume - Resume campaign
  http.post("*/api/v1/billing/dunning/campaigns/:id/resume", ({ request, params }) => {
    const { id } = params;
    const campaign = campaigns.find((c) => c.id === id);

    if (!campaign) {
      return HttpResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    campaign.status = "active";
    campaign.updated_at = new Date().toISOString();

    return HttpResponse.json(campaign);
  }),

  // GET /dunning/executions - List executions
  http.get("*/api/v1/billing/dunning/executions", ({ request, params }) => {
    const url = new URL(request.url);
    const campaignId = url.searchParams.get("campaign_id");
    const status = url.searchParams.get("status");
    const page = parseInt(url.searchParams.get("page") || "1");
    const pageSize = parseInt(url.searchParams.get("page_size") || "20");

    let filtered = executions;

    if (campaignId) {
      filtered = filtered.filter((e) => e.campaign_id === campaignId);
    }

    if (status) {
      filtered = filtered.filter((e) => e.status === status);
    }

    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const paginated = filtered.slice(start, end);

    return HttpResponse.json(paginated);
  }),

  // GET /dunning/executions/:id - Get execution
  http.get("*/api/v1/billing/dunning/executions/:id", ({ request, params }) => {
    const { id } = params;
    const execution = executions.find((e) => e.id === id);

    if (!execution) {
      return HttpResponse.json({ error: "Execution not found" }, { status: 404 });
    }

    return HttpResponse.json(execution);
  }),

  // POST /dunning/executions - Start execution
  http.post("*/api/v1/billing/dunning/executions", async ({ request, params }) => {
    const data = await request.json();

    const newExecution = createMockDunningExecution({
      ...data,
    });

    executions.push(newExecution);

    return HttpResponse.json(newExecution, { status: 201 });
  }),

  // POST /dunning/executions/:id/cancel - Cancel execution
  http.post("*/api/v1/billing/dunning/executions/:id/cancel", async ({ request, params }) => {
    const { id } = params;
    const { reason } = await request.json();

    const execution = executions.find((e) => e.id === id);

    if (!execution) {
      return HttpResponse.json({ error: "Execution not found" }, { status: 404 });
    }

    execution.status = "cancelled";
    execution.cancellation_reason = reason;
    execution.updated_at = new Date().toISOString();

    return HttpResponse.json(execution);
  }),

  // GET /api/v1/billing/dunning/stats - Get statistics
  http.get("*/api/v1/billing/dunning/stats", ({ request, params }) => {
    const stats: DunningStatistics = {
      total_campaigns: campaigns.length,
      active_campaigns: campaigns.filter((c) => c.status === "active").length,
      paused_campaigns: campaigns.filter((c) => c.status === "paused").length,
      total_executions: executions.length,
      active_executions: executions.filter((e) => e.status === "active").length,
      completed_executions: executions.filter((e) => e.status === "completed").length,
      cancelled_executions: executions.filter((e) => e.status === "cancelled").length,
      total_amount_recovered: executions.reduce((sum, e) => sum + (e.amount_recovered || 0), 0),
      total_amount_outstanding: executions.reduce((sum, e) => sum + e.amount_overdue, 0),
      recovery_rate: 70.5,
      average_days_to_recovery: 15,
    };

    return HttpResponse.json(stats);
  }),

  // GET /api/v1/billing/dunning/stats/campaigns/:id - Get campaign statistics
  http.get("*/api/v1/billing/dunning/stats/campaigns/:id", ({ request, params }) => {
    const { id } = params;
    const campaign = campaigns.find((c) => c.id === id);

    if (!campaign) {
      return HttpResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    const campaignExecutions = executions.filter((e) => e.campaign_id === id);

    const stats: DunningCampaignStats = {
      campaign_id: id as string,
      total_executions: campaignExecutions.length,
      active_executions: campaignExecutions.filter((e) => e.status === "active").length,
      completed_executions: campaignExecutions.filter((e) => e.status === "completed").length,
      cancelled_executions: campaignExecutions.filter((e) => e.status === "cancelled").length,
      total_amount_recovered: campaignExecutions.reduce(
        (sum, e) => sum + (e.amount_recovered || 0),
        0,
      ),
      total_amount_outstanding: campaignExecutions.reduce((sum, e) => sum + e.amount_overdue, 0),
      recovery_rate: 70.5,
      average_days_to_recovery: 12,
      success_by_stage: {
        "1": 30,
        "2": 5,
        "3": 0,
      },
    };

    return HttpResponse.json(stats);
  }),

  // GET /api/v1/billing/dunning/analytics/recovery - Get recovery chart data
  http.get("*/api/v1/billing/dunning/analytics/recovery", ({ request, params }) => {
    const url = new URL(request.url);
    const days = parseInt(url.searchParams.get("days") || "30");

    const chartData: DunningRecoveryChartData[] = [];
    const now = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);

      chartData.push({
        date: date.toISOString().split("T")[0],
        amount_recovered: Math.random() * 1000,
        executions_completed: Math.floor(Math.random() * 20),
        recovery_rate: 70 + Math.random() * 20,
      });
    }

    return HttpResponse.json(chartData);
  }),
];
