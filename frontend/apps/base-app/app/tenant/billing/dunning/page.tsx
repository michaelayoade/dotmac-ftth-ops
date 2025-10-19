"use client";

export const dynamic = 'force-dynamic';
export const dynamicParams = true;

import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  DollarSign,
  PauseCircle,
  PlayCircle,
  RefreshCw,
  TrendingUp,
  XCircle,
} from "lucide-react";
import { EnhancedDataTable, type ColumnDef, type BulkAction, type QuickFilter } from "@/components/ui/EnhancedDataTable";
import { UniversalChart } from "@dotmac/primitives";
import { formatCurrency } from "@/lib/utils/currency";
import { useRBAC } from "@/contexts/RBACContext";
import {
  useDunningCampaigns,
  useDunningExecutions,
  useDunningStatistics,
  useDunningOperations,
  useDunningRecoveryChart,
  type DunningCampaign,
  type DunningExecution,
} from "@/hooks/useDunning";

export default function DunningDashboardPage() {
  const { hasPermission } = useRBAC();
  const hasBillingAccess = hasPermission('billing.read');

  // API Hooks
  const { data: campaigns = [], isLoading: campaignsLoading, error: campaignsError, refetch: refetchCampaigns } = useDunningCampaigns({ activeOnly: false, limit: 100 });
  const { data: executions = [], isLoading: executionsLoading, error: executionsError, refetch: refetchExecutions } = useDunningExecutions({ limit: 100 });
  const { data: statistics, isLoading: statsLoading } = useDunningStatistics();
  const { data: chartData = [], isLoading: chartLoading } = useDunningRecoveryChart(30);
  const { pauseCampaign, resumeCampaign, cancelExecution, isLoading: operationsLoading } = useDunningOperations();

  const [selectedView, setSelectedView] = useState<'campaigns' | 'executions'>('campaigns');

  const isLoading = campaignsLoading || executionsLoading || operationsLoading;

  // Campaign columns
  const campaignColumns: ColumnDef<DunningCampaign>[] = useMemo(() => [
    {
      id: 'name',
      header: 'Campaign',
      accessorKey: 'name',
      cell: (campaign) => (
        <div>
          <div className="font-medium">{campaign.name}</div>
          <div className="text-xs text-muted-foreground">{campaign.description || 'No description'}</div>
        </div>
      ),
    },
    {
      id: 'trigger',
      header: 'Trigger',
      cell: (campaign) => (
        <div className="text-sm">
          After {campaign.trigger_after_days} day{campaign.trigger_after_days !== 1 ? 's' : ''} overdue
        </div>
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: (campaign) => (
        <div className="text-sm">
          {campaign.actions.length} step{campaign.actions.length !== 1 ? 's' : ''}
        </div>
      ),
    },
    {
      id: 'executions',
      header: 'Executions',
      cell: (campaign) => (
        <div>
          <div className="text-sm font-medium">{campaign.total_executions}</div>
          <div className="text-xs text-muted-foreground">
            {campaign.successful_executions} successful
          </div>
        </div>
      ),
    },
    {
      id: 'recovered',
      header: 'Recovered',
      cell: (campaign) => (
        <div className="text-sm font-medium text-green-600">
          {formatCurrency(campaign.total_recovered_amount, 'USD')}
        </div>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      accessorKey: 'is_active',
      cell: (campaign) => (
        <Badge variant={campaign.is_active ? 'success' : 'secondary'}>
          {campaign.is_active ? 'Active' : 'Paused'}
        </Badge>
      ),
    },
    {
      id: 'priority',
      header: 'Priority',
      accessorKey: 'priority',
      cell: (campaign) => (
        <div className="text-sm">{campaign.priority}</div>
      ),
    },
  ], []);

  // Execution columns
  const executionColumns: ColumnDef<DunningExecution>[] = useMemo(() => [
    {
      id: 'customer',
      header: 'Customer',
      cell: (execution) => (
        <div>
          <div className="text-sm font-medium">{execution.subscription_id}</div>
          <div className="text-xs text-muted-foreground">{execution.customer_id.slice(0, 8)}...</div>
        </div>
      ),
    },
    {
      id: 'campaign',
      header: 'Campaign',
      cell: (execution) => {
        const campaign = campaigns.find(c => c.id === execution.campaign_id);
        return <div className="text-sm">{campaign?.name || execution.campaign_id.slice(0, 8)}</div>;
      },
    },
    {
      id: 'progress',
      header: 'Progress',
      cell: (execution) => (
        <div>
          <div className="text-sm">
            Step {execution.current_step + 1} of {execution.total_steps}
          </div>
          <div className="w-full bg-secondary rounded-full h-1.5 mt-1">
            <div
              className="bg-primary h-1.5 rounded-full"
              style={{ width: `${((execution.current_step + 1) / execution.total_steps) * 100}%` }}
            />
          </div>
        </div>
      ),
    },
    {
      id: 'amount',
      header: 'Amount',
      cell: (execution) => (
        <div>
          <div className="text-sm font-medium">
            {formatCurrency(execution.outstanding_amount, 'USD')}
          </div>
          {execution.recovered_amount > 0 && (
            <div className="text-xs text-green-600">
              {formatCurrency(execution.recovered_amount, 'USD')} recovered
            </div>
          )}
        </div>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      accessorKey: 'status',
      cell: (execution) => (
        <Badge variant={
          execution.status === 'completed' ? 'success' :
          execution.status === 'failed' ? 'destructive' :
          execution.status === 'canceled' ? 'secondary' :
          execution.status === 'in_progress' ? 'default' :
          'secondary'
        }>
          {execution.status}
        </Badge>
      ),
    },
    {
      id: 'started',
      header: 'Started',
      cell: (execution) => (
        <div className="text-sm">
          {new Date(execution.started_at).toLocaleDateString()}
        </div>
      ),
    },
    {
      id: 'next_action',
      header: 'Next Action',
      cell: (execution) => (
        <div className="text-xs text-muted-foreground">
          {execution.next_action_at
            ? new Date(execution.next_action_at).toLocaleString()
            : execution.completed_at
            ? 'Completed'
            : 'N/A'}
        </div>
      ),
    },
  ], [campaigns]);

  // Bulk actions for campaigns
  const campaignBulkActions: BulkAction<DunningCampaign>[] = useMemo(() => [
    {
      label: 'Pause Campaigns',
      icon: PauseCircle,
      action: async (selected) => {
        for (const campaign of selected) {
          await pauseCampaign(campaign.id);
        }
        await refetchCampaigns();
      },
      disabled: (selected) => selected.every(c => !c.is_active),
    },
    {
      label: 'Resume Campaigns',
      icon: PlayCircle,
      action: async (selected) => {
        for (const campaign of selected) {
          await resumeCampaign(campaign.id);
        }
        await refetchCampaigns();
      },
      disabled: (selected) => selected.every(c => c.is_active),
    },
  ], [pauseCampaign, resumeCampaign, refetchCampaigns]);

  // Bulk actions for executions
  const executionBulkActions: BulkAction<DunningExecution>[] = useMemo(() => [
    {
      label: 'Cancel Executions',
      icon: XCircle,
      action: async (selected) => {
        const reason = prompt('Enter cancellation reason:');
        if (!reason) return;

        for (const execution of selected) {
          await cancelExecution(execution.id, reason);
        }
        await refetchExecutions();
      },
      disabled: (selected) => selected.every(e => e.status === 'completed' || e.status === 'canceled'),
    },
  ], [cancelExecution, refetchExecutions]);

  // Quick filters for campaigns
  const campaignQuickFilters: QuickFilter<DunningCampaign>[] = useMemo(() => [
    {
      label: 'Active',
      filter: (campaign) => campaign.is_active,
    },
    {
      label: 'Paused',
      filter: (campaign) => !campaign.is_active,
    },
    {
      label: 'High Priority',
      filter: (campaign) => campaign.priority >= 50,
    },
  ], []);

  // Quick filters for executions
  const executionQuickFilters: QuickFilter<DunningExecution>[] = useMemo(() => [
    {
      label: 'In Progress',
      filter: (execution) => execution.status === 'in_progress',
    },
    {
      label: 'Pending',
      filter: (execution) => execution.status === 'pending',
    },
    {
      label: 'Failed',
      filter: (execution) => execution.status === 'failed',
    },
    {
      label: 'Completed',
      filter: (execution) => execution.status === 'completed',
    },
  ], []);

  // Search configs
  const campaignSearchConfig = {
    placeholder: 'Search campaigns by name or description...',
    searchableFields: ['name', 'description'] as (keyof DunningCampaign)[],
  };

  const executionSearchConfig = {
    placeholder: 'Search executions by subscription or customer ID...',
    searchableFields: ['subscription_id', 'customer_id'] as (keyof DunningExecution)[],
  };

  // Chart data for recovery trend
  const recoveryChartSeries = useMemo(() => [
    {
      name: 'Recovered',
      data: chartData.map(d => d.recovered),
      color: '#10b981', // green
    },
    {
      name: 'Outstanding',
      data: chartData.map(d => d.outstanding),
      color: '#ef4444', // red
    },
  ], [chartData]);

  const recoveryChartCategories = useMemo(() =>
    chartData.map(d => new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })),
    [chartData]
  );

  if (!hasBillingAccess) {
    return (
      <main className="max-w-7xl mx-auto px-6 py-12">
        <Card>
          <CardHeader>
            <CardTitle>Dunning & Collections</CardTitle>
            <CardDescription className="text-destructive">
              You don&apos;t have permission to access dunning management.
            </CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  if (campaignsError || executionsError) {
    return (
      <main className="max-w-7xl mx-auto px-6 py-12">
        <Card>
          <CardHeader>
            <CardTitle>Dunning & Collections</CardTitle>
            <CardDescription className="text-red-600">
              Failed to load dunning data. Please try again.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Error: {campaignsError?.message || executionsError?.message}
            </p>
            <Button onClick={() => {
              refetchCampaigns();
              refetchExecutions();
            }}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="max-w-7xl mx-auto px-6 py-12 space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-foreground">Dunning & Collections</h1>
        <p className="text-muted-foreground">
          Automated collection workflows for past-due accounts
        </p>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Campaigns</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statsLoading ? '...' : statistics?.total_campaigns || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {statistics?.active_campaigns || 0} active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Executions</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statsLoading ? '...' : statistics?.active_executions || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {statistics?.total_executions || 0} total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Recovered</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {statsLoading ? '...' : formatCurrency(statistics?.total_recovered_amount || 0, 'USD')}
            </div>
            <p className="text-xs text-muted-foreground">
              {statistics?.average_recovery_rate?.toFixed(1) || 0}% recovery rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statsLoading ? '...' : (
                statistics
                  ? `${((statistics.completed_executions / (statistics.total_executions || 1)) * 100).toFixed(1)}%`
                  : '0%'
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {statistics?.completed_executions || 0} completed
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recovery Trend Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Recovery Trend (Last 30 Days)</CardTitle>
          <CardDescription>
            Track recovered amounts and outstanding balances over time
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            {chartLoading ? (
              <div className="flex items-center justify-center h-full">
                <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <UniversalChart
                type="line"
                data={chartData}
                series={recoveryChartSeries}
                categories={recoveryChartCategories}
                height={300}
                yAxisFormatter={(value) => `$${value.toFixed(0)}`}
              />
            )}
          </div>
        </CardContent>
      </Card>

      {/* View Selector */}
      <div className="flex gap-2">
        <Button
          variant={selectedView === 'campaigns' ? 'default' : 'outline'}
          onClick={() => setSelectedView('campaigns')}
        >
          Campaigns ({campaigns.length})
        </Button>
        <Button
          variant={selectedView === 'executions' ? 'default' : 'outline'}
          onClick={() => setSelectedView('executions')}
        >
          Executions ({executions.length})
        </Button>
      </div>

      {/* Data Tables */}
      {selectedView === 'campaigns' ? (
        <Card>
          <CardHeader>
            <CardTitle>Dunning Campaigns</CardTitle>
            <CardDescription>
              Manage automated collection workflows
            </CardDescription>
          </CardHeader>
          <CardContent>
            <EnhancedDataTable
              data={campaigns}
              columns={campaignColumns}
              bulkActions={campaignBulkActions}
              quickFilters={campaignQuickFilters}
              searchConfig={campaignSearchConfig}
              isLoading={isLoading}
              emptyMessage="No campaigns found"
              getRowId={(campaign) => campaign.id}
            />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Dunning Executions</CardTitle>
            <CardDescription>
              Track collection attempts for past-due accounts
            </CardDescription>
          </CardHeader>
          <CardContent>
            <EnhancedDataTable
              data={executions}
              columns={executionColumns}
              bulkActions={executionBulkActions}
              quickFilters={executionQuickFilters}
              searchConfig={executionSearchConfig}
              isLoading={isLoading}
              emptyMessage="No executions found"
              getRowId={(execution) => execution.id}
            />
          </CardContent>
        </Card>
      )}
    </main>
  );
}
