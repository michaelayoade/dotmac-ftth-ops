/**
 * Subscribers Management Page
 *
 * Main page for viewing and managing ISP subscribers
 */

'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useRBAC } from '@/contexts/RBACContext';
import {
  useSubscribers,
  useSubscriberStatistics,
  useSubscriberOperations,
  type Subscriber,
  type SubscriberStatus,
  type ConnectionType,
} from '@/hooks/useSubscribers';
import { SubscriberList } from '@/components/subscribers/SubscriberList';
import { SubscriberDetailModal } from '@/components/subscribers/SubscriberDetailModal';
import { AddSubscriberModal } from '@/components/subscribers/AddSubscriberModal';
import {
  Users,
  UserCheck,
  UserX,
  UserPlus as UserClock,
  TrendingUp,
  TrendingDown,
  Plus,
  Download,
  Filter,
  X,
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { logger } from '@/lib/logger';

// ============================================================================
// Main Component
// ============================================================================

export default function SubscribersPage() {
  const { hasPermission } = useRBAC();
  const { toast } = useToast();

  // Permissions
  const canView = hasPermission('customers.read');
  const canCreate = hasPermission('customers.create');
  const canUpdate = hasPermission('customers.update');
  const canDelete = hasPermission('customers.delete');

  // State
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<SubscriberStatus | 'all'>('all');
  const [connectionTypeFilter, setConnectionTypeFilter] = useState<ConnectionType | 'all'>('all');
  const [selectedSubscriber, setSelectedSubscriber] = useState<Subscriber | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Build query params
  const queryParams = useMemo(() => {
    const params: any = {
      search: search || undefined,
      status: statusFilter !== 'all' ? [statusFilter] : undefined,
      connection_type: connectionTypeFilter !== 'all' ? [connectionTypeFilter] : undefined,
      limit: 100,
      sort_by: 'created_at',
      sort_order: 'desc' as const,
    };
    return params;
  }, [search, statusFilter, connectionTypeFilter]);

  // Data fetching
  const { subscribers, total, isLoading, error, refetch } = useSubscribers(queryParams);
  const { statistics, isLoading: statsLoading } = useSubscriberStatistics();
  const {
    suspendSubscriber,
    activateSubscriber,
    terminateSubscriber,
    deleteSubscriber,
    isLoading: operationLoading,
  } = useSubscriberOperations();

  // Handlers
  const handleViewSubscriber = (subscriber: Subscriber) => {
    setSelectedSubscriber(subscriber);
    setIsDetailModalOpen(true);
  };

  const handleCloseDetail = () => {
    setIsDetailModalOpen(false);
    setSelectedSubscriber(null);
  };

  const handleSuspend = async (subscriber: Subscriber) => {
    try {
      const success = await suspendSubscriber(subscriber.id, 'Suspended by operator');
      if (success) {
        toast({
          title: 'Subscriber Suspended',
          description: `${subscriber.first_name} ${subscriber.last_name} has been suspended.`,
        });
        refetch();
        if (selectedSubscriber?.id === subscriber.id) {
          setIsDetailModalOpen(false);
          setSelectedSubscriber(null);
        }
      }
    } catch (error) {
      logger.error('Failed to suspend subscriber', error instanceof Error ? error : new Error(String(error)));
      toast({
        title: 'Suspension Failed',
        description: 'Unable to suspend subscriber. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleActivate = async (subscriber: Subscriber) => {
    try {
      const success = await activateSubscriber(subscriber.id);
      if (success) {
        toast({
          title: 'Subscriber Activated',
          description: `${subscriber.first_name} ${subscriber.last_name} has been activated.`,
        });
        refetch();
        if (selectedSubscriber?.id === subscriber.id) {
          setIsDetailModalOpen(false);
          setSelectedSubscriber(null);
        }
      }
    } catch (error) {
      logger.error('Failed to activate subscriber', error instanceof Error ? error : new Error(String(error)));
      toast({
        title: 'Activation Failed',
        description: 'Unable to activate subscriber. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleTerminate = async (subscriber: Subscriber) => {
    try {
      const success = await terminateSubscriber(subscriber.id, 'Terminated by operator');
      if (success) {
        toast({
          title: 'Subscriber Terminated',
          description: `${subscriber.first_name} ${subscriber.last_name} has been terminated.`,
        });
        refetch();
        if (selectedSubscriber?.id === subscriber.id) {
          setIsDetailModalOpen(false);
          setSelectedSubscriber(null);
        }
      }
    } catch (error) {
      logger.error('Failed to terminate subscriber', error instanceof Error ? error : new Error(String(error)));
      toast({
        title: 'Termination Failed',
        description: 'Unable to terminate subscriber. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (subscriber: Subscriber) => {
    if (!confirm(`Are you sure you want to delete ${subscriber.first_name} ${subscriber.last_name}? This action cannot be undone.`)) {
      return;
    }

    try {
      const success = await deleteSubscriber(subscriber.id);
      if (success) {
        toast({
          title: 'Subscriber Deleted',
          description: `${subscriber.first_name} ${subscriber.last_name} has been deleted.`,
        });
        refetch();
        if (selectedSubscriber?.id === subscriber.id) {
          setIsDetailModalOpen(false);
          setSelectedSubscriber(null);
        }
      }
    } catch (error) {
      logger.error('Failed to delete subscriber', error instanceof Error ? error : new Error(String(error)));
      toast({
        title: 'Deletion Failed',
        description: 'Unable to delete subscriber. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleExport = () => {
    try {
      const dataStr = JSON.stringify(subscribers, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `subscribers-${new Date().toISOString()}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: 'Export Complete',
        description: `Exported ${subscribers.length} subscribers.`,
      });
    } catch (error) {
      logger.error('Failed to export subscribers', error instanceof Error ? error : new Error(String(error)));
      toast({
        title: 'Export Failed',
        description: 'Unable to export subscribers.',
        variant: 'destructive',
      });
    }
  };

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('all');
    setConnectionTypeFilter('all');
  };

  const hasActiveFilters = search || statusFilter !== 'all' || connectionTypeFilter !== 'all';

  // Permission check
  if (!canView) {
    return (
      <main className="max-w-7xl mx-auto px-6 py-12 space-y-8">
        <Card>
          <CardHeader>
            <CardTitle>Subscribers</CardTitle>
            <CardDescription>
              You don't have permission to view subscribers. Contact your administrator for access.
            </CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  return (
    <main className="max-w-7xl mx-auto px-6 py-12 space-y-8">
      {/* Header */}
      <header className="flex items-start justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">Subscribers</h1>
          <p className="text-muted-foreground">
            Manage ISP subscribers, service plans, and network connectivity
          </p>
        </div>
        <div className="flex gap-2">
          {canCreate && (
            <Button onClick={() => setIsAddModalOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Subscriber
            </Button>
          )}
          <Button variant="outline" onClick={handleExport} disabled={subscribers.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </header>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Subscribers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statsLoading ? '...' : statistics?.total_subscribers.toLocaleString() || '0'}
            </div>
            <p className="text-xs text-muted-foreground">
              All subscriber accounts
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
            <UserCheck className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statsLoading ? '...' : statistics?.active_subscribers.toLocaleString() || '0'}
            </div>
            <p className="text-xs text-muted-foreground">
              Currently active services
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Suspended</CardTitle>
            <UserX className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statsLoading ? '...' : statistics?.suspended_subscribers.toLocaleString() || '0'}
            </div>
            <p className="text-xs text-muted-foreground">
              Temporarily suspended
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">New This Month</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statsLoading ? '...' : statistics?.new_this_month.toLocaleString() || '0'}
            </div>
            <p className="text-xs text-muted-foreground">
              Recent sign-ups
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Additional Stats Row */}
      {statistics && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Activation</CardTitle>
              <UserClock className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {statistics.pending_subscribers.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">
                Awaiting service activation
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Churn This Month</CardTitle>
              <TrendingDown className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {statistics.churn_this_month.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">
                Subscriber cancellations
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Average Uptime</CardTitle>
              <UserCheck className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {statistics.average_uptime.toFixed(1)}%
              </div>
              <p className="text-xs text-muted-foreground">
                Network availability
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Subscriber List</CardTitle>
              <CardDescription>
                Search and filter subscribers by status, connection type, or location
              </CardDescription>
            </div>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="h-4 w-4 mr-2" />
                Clear Filters
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 mb-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <Input
                  placeholder="Search by name, email, phone, or address..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full"
                />
              </div>
              <div className="flex gap-2">
                <Select
                  value={statusFilter}
                  onValueChange={(value) => setStatusFilter(value as SubscriberStatus | 'all')}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="terminated">Terminated</SelectItem>
                  </SelectContent>
                </Select>

                <Select
                  value={connectionTypeFilter}
                  onValueChange={(value) => setConnectionTypeFilter(value as ConnectionType | 'all')}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="All Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="ftth">FTTH</SelectItem>
                    <SelectItem value="fttb">FTTB</SelectItem>
                    <SelectItem value="wireless">Wireless</SelectItem>
                    <SelectItem value="hybrid">Hybrid</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {hasActiveFilters && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Filter className="h-4 w-4" />
                <span>
                  Showing {subscribers.length} of {total} subscribers
                </span>
              </div>
            )}
          </div>

          {/* Subscriber List */}
          {error ? (
            <div className="text-center py-12">
              <p className="text-destructive mb-2">Failed to load subscribers</p>
              <Button variant="outline" onClick={() => refetch()}>
                Retry
              </Button>
            </div>
          ) : (
            <SubscriberList
              subscribers={subscribers}
              isLoading={isLoading}
              onView={handleViewSubscriber}
              onEdit={canUpdate ? handleViewSubscriber : undefined}
              onDelete={canDelete ? handleDelete : undefined}
              onSuspend={canUpdate ? handleSuspend : undefined}
              onActivate={canUpdate ? handleActivate : undefined}
              onRowClick={handleViewSubscriber}
            />
          )}
        </CardContent>
      </Card>

      {/* Modals */}
      <SubscriberDetailModal
        subscriber={selectedSubscriber}
        open={isDetailModalOpen}
        onClose={handleCloseDetail}
        onUpdate={() => {
          refetch();
          handleCloseDetail();
        }}
        onSuspend={canUpdate ? handleSuspend : undefined}
        onActivate={canUpdate ? handleActivate : undefined}
        onTerminate={canUpdate ? handleTerminate : undefined}
      />

      <AddSubscriberModal
        open={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={(subscriberId) => {
          setIsAddModalOpen(false);
          refetch();
          toast({
            title: 'Subscriber Created',
            description: 'New subscriber has been added successfully.',
          });
        }}
      />
    </main>
  );
}
