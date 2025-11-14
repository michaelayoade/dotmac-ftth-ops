/**
 * MSW Handlers for Dunning API Endpoints
 */

import { rest } from 'msw';
import type {
  DunningCampaign,
  DunningExecution,
  DunningStatistics,
  DunningCampaignStats,
  DunningRecoveryChartData,
} from '../../../hooks/useDunning';

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
    tenant_id: 'tenant-123',
    name: 'Test Campaign',
    description: 'A test dunning campaign',
    status: 'active',
    stages: [],
    total_executions: 0,
    successful_executions: 0,
    failed_executions: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

// Helper to create a mock execution
export function createMockDunningExecution(overrides?: Partial<DunningExecution>): DunningExecution {
  const id = `execution-${nextExecutionId++}`;
  return {
    id,
    tenant_id: 'tenant-123',
    campaign_id: 'campaign-1',
    subscription_id: 'sub-123',
    subscriber_email: 'test@example.com',
    status: 'active',
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
  executionsData: DunningExecution[]
) {
  campaigns = [...campaignsData];
  executions = [...executionsData];
}

export const dunningHandlers = [
  // GET /api/v1/billing/dunning/campaigns - List campaigns
  rest.get('*/api/v1/billing/dunning/campaigns', (req, res, ctx) => {
    const url = new URL(req.url);
    const activeOnly = url.searchParams.get('active_only');
    const search = url.searchParams.get('search');
    const page = parseInt(url.searchParams.get('page') || '1');
    const pageSize = parseInt(url.searchParams.get('page_size') || '20');

    let filtered = campaigns;

    // Filter by active_only parameter
    if (activeOnly === 'true') {
      filtered = filtered.filter((c) => c.status === 'active');
    }

    if (search) {
      filtered = filtered.filter((c) =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        (c.description && c.description.toLowerCase().includes(search.toLowerCase()))
      );
    }

    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const paginated = filtered.slice(start, end);

    return res(ctx.json(paginated));
  }),

  // GET /api/v1/billing/dunning/campaigns/:id - Get campaign
  rest.get('*/api/v1/billing/dunning/campaigns/:id', (req, res, ctx) => {
    const { id } = req.params;
    const campaign = campaigns.find((c) => c.id === id);

    if (!campaign) {
      return res(
        ctx.status(404),
        ctx.json({ error: 'Campaign not found' })
      );
    }

    return res(ctx.json(campaign));
  }),

  // POST /api/v1/billing/dunning/campaigns - Create campaign
  rest.post('*/api/v1/billing/dunning/campaigns', async (req, res, ctx) => {
    const data = await req.json();

    const newCampaign = createMockDunningCampaign({
      ...data,
    });

    campaigns.push(newCampaign);

    return res(ctx.status(201), ctx.json(newCampaign));
  }),

  // PATCH /dunning/campaigns/:id - Update campaign
  rest.patch('*/api/v1/billing/dunning/campaigns/:id', async (req, res, ctx) => {
    const { id } = req.params;
    const updates = await req.json();

    const index = campaigns.findIndex((c) => c.id === id);

    if (index === -1) {
      return res(
        ctx.status(404),
        ctx.json({ error: 'Campaign not found' })
      );
    }

    campaigns[index] = {
      ...campaigns[index],
      ...updates,
      updated_at: new Date().toISOString(),
    };

    return res(ctx.json(campaigns[index]));
  }),

  // DELETE /dunning/campaigns/:id - Delete campaign
  rest.delete('*/api/v1/billing/dunning/campaigns/:id', (req, res, ctx) => {
    const { id } = req.params;
    const index = campaigns.findIndex((c) => c.id === id);

    if (index === -1) {
      return res(
        ctx.status(404),
        ctx.json({ error: 'Campaign not found' })
      );
    }

    campaigns.splice(index, 1);
    return res(ctx.status(204));
  }),

  // POST /dunning/campaigns/:id/pause - Pause campaign
  rest.post('*/api/v1/billing/dunning/campaigns/:id/pause', (req, res, ctx) => {
    const { id } = req.params;
    const campaign = campaigns.find((c) => c.id === id);

    if (!campaign) {
      return res(
        ctx.status(404),
        ctx.json({ error: 'Campaign not found' })
      );
    }

    campaign.status = 'paused';
    campaign.updated_at = new Date().toISOString();

    return res(ctx.json(campaign));
  }),

  // POST /dunning/campaigns/:id/resume - Resume campaign
  rest.post('*/api/v1/billing/dunning/campaigns/:id/resume', (req, res, ctx) => {
    const { id } = req.params;
    const campaign = campaigns.find((c) => c.id === id);

    if (!campaign) {
      return res(
        ctx.status(404),
        ctx.json({ error: 'Campaign not found' })
      );
    }

    campaign.status = 'active';
    campaign.updated_at = new Date().toISOString();

    return res(ctx.json(campaign));
  }),

  // GET /dunning/executions - List executions
  rest.get('*/api/v1/billing/dunning/executions', (req, res, ctx) => {
    const url = new URL(req.url);
    const campaignId = url.searchParams.get('campaign_id');
    const status = url.searchParams.get('status');
    const page = parseInt(url.searchParams.get('page') || '1');
    const pageSize = parseInt(url.searchParams.get('page_size') || '20');

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

    return res(ctx.json(paginated));
  }),

  // GET /dunning/executions/:id - Get execution
  rest.get('*/api/v1/billing/dunning/executions/:id', (req, res, ctx) => {
    const { id } = req.params;
    const execution = executions.find((e) => e.id === id);

    if (!execution) {
      return res(
        ctx.status(404),
        ctx.json({ error: 'Execution not found' })
      );
    }

    return res(ctx.json(execution));
  }),

  // POST /dunning/executions - Start execution
  rest.post('*/api/v1/billing/dunning/executions', async (req, res, ctx) => {
    const data = await req.json();

    const newExecution = createMockDunningExecution({
      ...data,
    });

    executions.push(newExecution);

    return res(ctx.status(201), ctx.json(newExecution));
  }),

  // POST /dunning/executions/:id/cancel - Cancel execution
  rest.post('*/api/v1/billing/dunning/executions/:id/cancel', async (req, res, ctx) => {
    const { id } = req.params;
    const { reason } = await req.json();

    const execution = executions.find((e) => e.id === id);

    if (!execution) {
      return res(
        ctx.status(404),
        ctx.json({ error: 'Execution not found' })
      );
    }

    execution.status = 'cancelled';
    execution.cancellation_reason = reason;
    execution.updated_at = new Date().toISOString();

    return res(ctx.json(execution));
  }),

  // GET /api/v1/billing/dunning/stats - Get statistics
  rest.get('*/api/v1/billing/dunning/stats', (req, res, ctx) => {
    const stats: DunningStatistics = {
      total_campaigns: campaigns.length,
      active_campaigns: campaigns.filter((c) => c.status === 'active').length,
      paused_campaigns: campaigns.filter((c) => c.status === 'paused').length,
      total_executions: executions.length,
      active_executions: executions.filter((e) => e.status === 'active').length,
      completed_executions: executions.filter((e) => e.status === 'completed').length,
      cancelled_executions: executions.filter((e) => e.status === 'cancelled').length,
      total_amount_recovered: executions.reduce((sum, e) => sum + (e.amount_recovered || 0), 0),
      total_amount_outstanding: executions.reduce((sum, e) => sum + e.amount_overdue, 0),
      recovery_rate: 70.5,
      average_days_to_recovery: 15,
    };

    return res(ctx.json(stats));
  }),

  // GET /api/v1/billing/dunning/stats/campaigns/:id - Get campaign statistics
  rest.get('*/api/v1/billing/dunning/stats/campaigns/:id', (req, res, ctx) => {
    const { id } = req.params;
    const campaign = campaigns.find((c) => c.id === id);

    if (!campaign) {
      return res(
        ctx.status(404),
        ctx.json({ error: 'Campaign not found' })
      );
    }

    const campaignExecutions = executions.filter((e) => e.campaign_id === id);

    const stats: DunningCampaignStats = {
      campaign_id: id as string,
      total_executions: campaignExecutions.length,
      active_executions: campaignExecutions.filter((e) => e.status === 'active').length,
      completed_executions: campaignExecutions.filter((e) => e.status === 'completed').length,
      cancelled_executions: campaignExecutions.filter((e) => e.status === 'cancelled').length,
      total_amount_recovered: campaignExecutions.reduce((sum, e) => sum + (e.amount_recovered || 0), 0),
      total_amount_outstanding: campaignExecutions.reduce((sum, e) => sum + e.amount_overdue, 0),
      recovery_rate: 70.5,
      average_days_to_recovery: 12,
      success_by_stage: {
        '1': 30,
        '2': 5,
        '3': 0,
      },
    };

    return res(ctx.json(stats));
  }),

  // GET /api/v1/billing/dunning/analytics/recovery - Get recovery chart data
  rest.get('*/api/v1/billing/dunning/analytics/recovery', (req, res, ctx) => {
    const url = new URL(req.url);
    const days = parseInt(url.searchParams.get('days') || '30');

    const chartData: DunningRecoveryChartData[] = [];
    const now = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);

      chartData.push({
        date: date.toISOString().split('T')[0],
        amount_recovered: Math.random() * 1000,
        executions_completed: Math.floor(Math.random() * 20),
        recovery_rate: 70 + Math.random() * 20,
      });
    }

    return res(ctx.json(chartData));
  }),
];
