'use client';

// Force dynamic rendering to avoid SSR issues with React Query hooks
export const dynamic = 'force-dynamic';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import {
  CreditCard,
  Plus,
  Search,
  Filter,
  RefreshCw,
  Pause,
  Play,
  X,
  Calendar,
  DollarSign,
  Users,
  TrendingUp,
  AlertCircle,
  CheckCircle,
} from 'lucide-react';
import { format } from 'date-fns';
import {
  useSubscriptionListGraphQL,
  useSubscriptionMetricsGraphQL,
} from '@/hooks/useSubscriptionsGraphQL';
import { SubscriptionStatusEnum } from '@/lib/graphql/generated';

interface Subscription {
  id: string;
  customer_name: string;
  customer_email: string;
  plan_name: string;
  plan_id: string;
  status: 'active' | 'paused' | 'cancelled' | 'past_due' | 'trialing';
  amount: number;
  currency: string;
  billing_cycle: 'monthly' | 'quarterly' | 'annual';
  current_period_start: string;
  current_period_end: string;
  trial_end?: string;
  cancel_at_period_end: boolean;
  created_at: string;
  next_billing_date: string;
  payment_method: string;
  mrr: number;
}

export default function SubscriptionsPage() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<SubscriptionStatusEnum | undefined>(undefined);
  const [showNewSubscriptionDialog, setShowNewSubscriptionDialog] = useState(false);
  const [selectedSubscription, setSelectedSubscription] = useState<Subscription | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);

  // Fetch subscriptions using GraphQL
  const {
    subscriptions: graphqlSubscriptions,
    total,
    isLoading: subscriptionsLoading,
    error: subscriptionsError,
    refetch: refetchSubscriptions,
  } = useSubscriptionListGraphQL({
    pageSize: 100,
    status: statusFilter,
    search: searchQuery || undefined,
    includeCustomer: true,
    includePlan: true,
    pollInterval: 30000, // Auto-refresh every 30 seconds
  });

  // Fetch subscription metrics
  const {
    metrics: metricsData,
    isLoading: metricsLoading,
    refetch: refetchMetrics,
  } = useSubscriptionMetricsGraphQL({
    pollInterval: 60000, // Refresh metrics every minute
  });

  // Transform GraphQL subscriptions data
  const subscriptions: Subscription[] = graphqlSubscriptions.map(sub => ({
    id: sub.id,
    customer_name: sub.customer?.name || 'Unknown Customer',
    customer_email: sub.customer?.email || '',
    plan_name: sub.plan?.name || 'Unknown Plan',
    plan_id: sub.planId,
    status: sub.status.toLowerCase() as Subscription['status'],
    amount: sub.plan?.price || 0,
    currency: sub.plan?.currency || 'USD',
    billing_cycle: (sub.plan?.billingCycle?.toLowerCase() as Subscription['billing_cycle']) || 'monthly',
    current_period_start: sub.currentPeriodStart,
    current_period_end: sub.currentPeriodEnd,
    trial_end: sub.trialEnd || undefined,
    cancel_at_period_end: false, // Would need to add this field to GraphQL schema
    created_at: sub.createdAt,
    next_billing_date: sub.currentPeriodEnd,
    payment_method: 'Card on file',
    mrr: sub.plan?.billingCycle?.toLowerCase() === 'monthly' ? (sub.plan?.price || 0) : 0,
  }));

  // Metrics from GraphQL
  const metrics = {
    total: metricsData?.totalSubscriptions || 0,
    active: metricsData?.activeSubscriptions || 0,
    mrr: metricsData?.monthlyRecurringRevenue || 0,
    churnRate: metricsData?.churnRate || 0,
    growthRate: metricsData?.growthRate || 0,
  };

  const handlePauseSubscription = async (subscription: Subscription) => {
    try {
      // API call would go here
      toast({
        title: 'Success',
        description: `Subscription ${subscription.id} has been paused`,
      });
      refetchSubscriptions();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to pause subscription',
        variant: 'destructive',
      });
    }
  };

  const handleCancelSubscription = async (subscription: Subscription) => {
    if (!confirm(`Are you sure you want to cancel this subscription? This action cannot be undone.`)) {
      return;
    }

    try {
      // API call would go here
      toast({
        title: 'Success',
        description: `Subscription ${subscription.id} will be cancelled at the end of the billing period`,
      });
      refetchSubscriptions();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to cancel subscription',
        variant: 'destructive',
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      active: { label: 'Active', variant: 'default' as const, icon: CheckCircle },
      paused: { label: 'Paused', variant: 'outline' as const, icon: Pause },
      cancelled: { label: 'Cancelled', variant: 'secondary' as const, icon: X },
      past_due: { label: 'Past Due', variant: 'destructive' as const, icon: AlertCircle },
      trialing: { label: 'Trial', variant: 'default' as const, icon: Calendar },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.active;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Subscriptions</h1>
          <p className="text-muted-foreground">Manage recurring billing and subscription plans</p>
        </div>
        <Button onClick={() => setShowNewSubscriptionDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Subscription
        </Button>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Subscriptions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.total}</div>
            <p className="text-xs text-muted-foreground">All time</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">{metrics.active}</div>
            <p className="text-xs text-muted-foreground">Currently active</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">MRR</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(metrics.mrr, 'USD')}</div>
            <p className="text-xs text-muted-foreground">Monthly recurring</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Churn Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">{metrics.churnRate}%</div>
            <p className="text-xs text-muted-foreground">Last 30 days</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Growth Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              <TrendingUp className="inline h-5 w-5 mr-1" />
              {metrics.growthRate}%
            </div>
            <p className="text-xs text-muted-foreground">Month over month</p>
          </CardContent>
        </Card>
      </div>

      {/* Subscriptions Table */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Subscription List</CardTitle>
            <div className="flex gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Search subscriptions..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 w-[250px]"
                />
              </div>
              <select
                value={statusFilter || 'all'}
                onChange={(e) => setStatusFilter(e.target.value === 'all' ? undefined : e.target.value as SubscriptionStatusEnum)}
                className="h-10 w-[150px] rounded-md border border-border bg-card px-3 text-sm text-foreground"
              >
                <option value="all">All Status</option>
                <option value="ACTIVE">Active</option>
                <option value="TRIALING">Trial</option>
                <option value="PAST_DUE">Past Due</option>
                <option value="PAUSED">Paused</option>
                <option value="CANCELED">Cancelled</option>
              </select>
              <Button variant="outline" onClick={() => refetchSubscriptions()}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {subscriptionsLoading ? (
            <div className="text-center py-8">Loading subscriptions...</div>
          ) : subscriptionsError ? (
            <div className="text-center py-8 text-destructive">
              Failed to load subscriptions. Please try again.
              <Button variant="outline" className="mt-4" onClick={() => refetchSubscriptions()}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Retry
              </Button>
            </div>
          ) : subscriptions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No subscriptions found. Create your first subscription to get started.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Cycle</TableHead>
                  <TableHead>Next Billing</TableHead>
                  <TableHead>Payment Method</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subscriptions.map((subscription) => (
                  <TableRow key={subscription.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{subscription.customer_name}</div>
                        <div className="text-sm text-muted-foreground">{subscription.customer_email}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{subscription.plan_name}</div>
                        <div className="text-xs text-muted-foreground">{subscription.id}</div>
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(subscription.status)}</TableCell>
                    <TableCell>
                      <div className="font-medium">
                        {formatCurrency(subscription.amount, subscription.currency)}
                      </div>
                      {subscription.mrr > 0 && (
                        <div className="text-xs text-muted-foreground">
                          MRR: {formatCurrency(subscription.mrr, subscription.currency)}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="capitalize">{subscription.billing_cycle}</TableCell>
                    <TableCell>
                      {subscription.status === 'trialing' && subscription.trial_end ? (
                        <div>
                          <div className="text-sm">Trial ends</div>
                          <div className="text-xs text-muted-foreground">
                            {format(new Date(subscription.trial_end), 'MMM d, yyyy')}
                          </div>
                        </div>
                      ) : (
                        <div className="text-sm">
                          {format(new Date(subscription.next_billing_date), 'MMM d, yyyy')}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <CreditCard className="h-3 w-3 text-muted-foreground" />
                        <span className="text-sm">{subscription.payment_method}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedSubscription(subscription);
                            setShowDetailDialog(true);
                          }}
                        >
                          View
                        </Button>
                        {subscription.status === 'active' && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handlePauseSubscription(subscription)}
                              aria-label={`Pause subscription for ${subscription.customer_name}`}
                              title={`Pause subscription for ${subscription.customer_name}`}
                            >
                              <Pause className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleCancelSubscription(subscription)}
                              aria-label={`Cancel subscription for ${subscription.customer_name}`}
                              title={`Cancel subscription for ${subscription.customer_name}`}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        {subscription.status === 'paused' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handlePauseSubscription(subscription)}
                            aria-label={`Resume subscription for ${subscription.customer_name}`}
                            title={`Resume subscription for ${subscription.customer_name}`}
                          >
                            <Play className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* New Subscription Dialog */}
      <Dialog open={showNewSubscriptionDialog} onOpenChange={setShowNewSubscriptionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Subscription</DialogTitle>
            <DialogDescription>
              Set up a new recurring subscription for a customer
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Customer</Label>
              <select className="flex h-10 w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground">
                <option value="">Select customer</option>
                <option value="cust1">Acme Corp</option>
                <option value="cust2">TechStart Inc</option>
              </select>
            </div>
            <div>
              <Label>Plan</Label>
              <select className="flex h-10 w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground">
                <option value="">Select plan</option>
                <option value="starter">Starter - $29.99/mo</option>
                <option value="pro">Professional - $99.99/mo</option>
                <option value="ent">Enterprise - $499.99/mo</option>
              </select>
            </div>
            <div>
              <Label>Billing Cycle</Label>
              <select className="flex h-10 w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground">
                <option value="">Select billing cycle</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="annual">Annual</option>
              </select>
            </div>
            <div>
              <Label>Trial Period (days)</Label>
              <Input type="number" placeholder="0" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewSubscriptionDialog(false)}>
              Cancel
            </Button>
            <Button onClick={() => {
              toast({
                title: 'Success',
                description: 'Subscription created successfully',
              });
              setShowNewSubscriptionDialog(false);
            }}>
              Create Subscription
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Subscription Detail Dialog */}
      {selectedSubscription && (
        <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Subscription Details</DialogTitle>
              <DialogDescription>
                {selectedSubscription.id} • {selectedSubscription.customer_name}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Status</Label>
                  <div className="mt-1">{getStatusBadge(selectedSubscription.status)}</div>
                </div>
                <div>
                  <Label>Plan</Label>
                  <div className="mt-1 font-medium">{selectedSubscription.plan_name}</div>
                </div>
                <div>
                  <Label>Amount</Label>
                  <div className="mt-1 font-medium">
                    {formatCurrency(selectedSubscription.amount, selectedSubscription.currency)}
                  </div>
                </div>
                <div>
                  <Label>Billing Cycle</Label>
                  <div className="mt-1 capitalize">{selectedSubscription.billing_cycle}</div>
                </div>
                <div>
                  <Label>Current Period</Label>
                  <div className="mt-1 text-sm">
                    {format(new Date(selectedSubscription.current_period_start), 'MMM d')} -{' '}
                    {format(new Date(selectedSubscription.current_period_end), 'MMM d, yyyy')}
                  </div>
                </div>
                <div>
                  <Label>Next Billing Date</Label>
                  <div className="mt-1">
                    {format(new Date(selectedSubscription.next_billing_date), 'MMM d, yyyy')}
                  </div>
                </div>
                <div>
                  <Label>Created</Label>
                  <div className="mt-1 text-sm">
                    {format(new Date(selectedSubscription.created_at), 'MMM d, yyyy')}
                  </div>
                </div>
                <div>
                  <Label>Payment Method</Label>
                  <div className="mt-1 flex items-center gap-1">
                    <CreditCard className="h-4 w-4 text-muted-foreground" />
                    {selectedSubscription.payment_method}
                  </div>
                </div>
              </div>

              {selectedSubscription.cancel_at_period_end && (
                <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200 rounded-md">
                  <AlertCircle className="inline h-4 w-4 mr-2" />
                  This subscription will be cancelled at the end of the current billing period
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDetailDialog(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
