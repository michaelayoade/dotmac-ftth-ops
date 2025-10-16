'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Shield,
  Clock,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  Download,
  Calendar,
  Activity,
  TrendingUp,
  AlertTriangle,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { platformAdminService } from '@/lib/services/platform-admin-service';
import { useToast } from '@/components/ui/use-toast';
import Link from 'next/link';

interface AuditAction {
  id: string;
  action: string;
  resourceType: string;
  timestamp: string;
  userId: string;
  tenantId?: string;
  status: 'success' | 'failure';
  details?: Record<string, unknown>;
}

interface ActivityStats {
  totalActions: number;
  successfulActions: number;
  failedActions: number;
  uniqueResourceTypes: number;
  mostCommonAction: string;
  lastActivityDate: string;
}

const ITEMS_PER_PAGE = 15;

export default function UserActivityLogPage() {
  const params = useParams();
  const router = useRouter();
  const userId = params.userId as string;
  const { toast } = useToast();

  const [allActions, setAllActions] = useState<AuditAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [resourceFilter, setResourceFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');

  useEffect(() => {
    loadUserAuditLog();
  }, [userId]);

  const loadUserAuditLog = async () => {
    setLoading(true);
    try {
      const data = await platformAdminService.getAuditLogs();
      const mappedActions: AuditAction[] = (data.entries ?? [])
        .filter((entry) => entry.user_id === userId)
        .map((entry) => ({
          id: entry.id,
          action: entry.action,
          resourceType: entry.resource_type,
          timestamp: entry.timestamp,
          userId: entry.user_id,
          tenantId: entry.tenant_id,
          status: entry.status,
          details: entry.changes ?? undefined,
        }));
      setAllActions(mappedActions);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch user audit log';
      toast({ title: 'Unable to load user activity', description: message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  // Calculate activity stats
  const activityStats: ActivityStats = useMemo(() => {
    const successfulActions = allActions.filter((a) => a.status === 'success').length;
    const failedActions = allActions.filter((a) => a.status === 'failure').length;
    const uniqueResourceTypes = new Set(allActions.map((a) => a.resourceType)).size;

    // Find most common action
    const actionCounts = allActions.reduce((acc, action) => {
      acc[action.action] = (acc[action.action] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    const mostCommonAction =
      Object.keys(actionCounts).length > 0
        ? Object.entries(actionCounts).sort((a, b) => b[1] - a[1])[0][0]
        : 'N/A';

    const lastActivityDate =
      allActions.length > 0
        ? new Date(
            Math.max(...allActions.map((a) => new Date(a.timestamp).getTime()))
          ).toLocaleString()
        : 'N/A';

    return {
      totalActions: allActions.length,
      successfulActions,
      failedActions,
      uniqueResourceTypes,
      mostCommonAction,
      lastActivityDate,
    };
  }, [allActions]);

  // Filter actions
  const filteredActions = useMemo(() => {
    let filtered = [...allActions];

    if (actionFilter !== 'all') {
      filtered = filtered.filter((a) => a.action === actionFilter);
    }
    if (resourceFilter !== 'all') {
      filtered = filtered.filter((a) => a.resourceType === resourceFilter);
    }
    if (statusFilter !== 'all') {
      filtered = filtered.filter((a) => a.status === statusFilter);
    }
    if (dateFrom) {
      const fromDate = new Date(dateFrom);
      filtered = filtered.filter((a) => new Date(a.timestamp) >= fromDate);
    }
    if (dateTo) {
      const toDate = new Date(dateTo);
      filtered = filtered.filter((a) => new Date(a.timestamp) <= toDate);
    }
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (a) =>
          a.action.toLowerCase().includes(searchLower) ||
          a.resourceType.toLowerCase().includes(searchLower) ||
          JSON.stringify(a.details).toLowerCase().includes(searchLower)
      );
    }

    return filtered;
  }, [allActions, actionFilter, resourceFilter, statusFilter, dateFrom, dateTo, searchTerm]);

  // Pagination
  const totalPages = Math.ceil(filteredActions.length / ITEMS_PER_PAGE);
  const paginatedActions = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredActions.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredActions, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [actionFilter, resourceFilter, statusFilter, dateFrom, dateTo, searchTerm]);

  const uniqueActions = useMemo(
    () => Array.from(new Set(allActions.map((a) => a.action))),
    [allActions]
  );
  const uniqueResourceTypes = useMemo(
    () => Array.from(new Set(allActions.map((a) => a.resourceType))),
    [allActions]
  );

  const handleExport = useCallback(
    (format: 'csv' | 'json') => {
      const dataToExport = filteredActions;

      if (format === 'json') {
        const blob = new Blob([JSON.stringify(dataToExport, null, 2)], {
          type: 'application/json',
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `user-activity-${userId}-${new Date().toISOString()}.json`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const headers = ['Timestamp', 'Action', 'Resource Type', 'Status', 'Tenant ID', 'Details'];
        const rows = dataToExport.map((action) => [
          action.timestamp,
          action.action,
          action.resourceType,
          action.status,
          action.tenantId || '',
          JSON.stringify(action.details || {}),
        ]);
        const csvContent = [
          headers.join(','),
          ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `user-activity-${userId}-${new Date().toISOString()}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      }

      toast({
        title: 'Export Successful',
        description: `Exported ${dataToExport.length} activity log entries as ${format.toUpperCase()}`,
      });
    },
    [filteredActions, userId, toast]
  );

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-2">
              <Shield className="h-8 w-8" />
              User Activity Log
            </h1>
            <p className="text-slate-400 mt-1">
              Activity history for user: <span className="font-mono text-white">{userId}</span>
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => handleExport('csv')}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleExport('json')}>
            <Download className="h-4 w-4 mr-2" />
            Export JSON
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Total Actions</p>
                <p className="text-2xl font-bold text-white">{activityStats.totalActions}</p>
              </div>
              <Activity className="h-8 w-8 text-blue-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Successful</p>
                <p className="text-2xl font-bold text-green-400">
                  {activityStats.successfulActions}
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Failed</p>
                <p className="text-2xl font-bold text-red-400">{activityStats.failedActions}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Resource Types</p>
                <p className="text-2xl font-bold text-white">
                  {activityStats.uniqueResourceTypes}
                </p>
              </div>
              <Shield className="h-8 w-8 text-purple-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800 border-slate-700 md:col-span-2">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Most Common Action</p>
                <p className="text-lg font-bold text-white capitalize">
                  {activityStats.mostCommonAction}
                </p>
              </div>
              <Calendar className="h-8 w-8 text-orange-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-lg">Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Input
              placeholder="Search activities..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-slate-700 border-slate-600 text-white"
            />

            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                <SelectValue placeholder="All Actions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                {uniqueActions.map((action) => (
                  <SelectItem key={action} value={action}>
                    {action}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={resourceFilter} onValueChange={setResourceFilter}>
              <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                <SelectValue placeholder="All Resources" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Resources</SelectItem>
                {uniqueResourceTypes.map((resource) => (
                  <SelectItem key={resource} value={resource}>
                    {resource}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="success">Success</SelectItem>
                <SelectItem value="failure">Failure</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              type="datetime-local"
              placeholder="From Date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="bg-slate-700 border-slate-600 text-white"
            />
            <Input
              type="datetime-local"
              placeholder="To Date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="bg-slate-700 border-slate-600 text-white"
            />
          </div>

          {(actionFilter !== 'all' ||
            resourceFilter !== 'all' ||
            statusFilter !== 'all' ||
            dateFrom ||
            dateTo ||
            searchTerm) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setActionFilter('all');
                setResourceFilter('all');
                setStatusFilter('all');
                setDateFrom('');
                setDateTo('');
                setSearchTerm('');
              }}
            >
              Clear Filters
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Activity Log */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Activity Log</CardTitle>
              <CardDescription>
                Showing {filteredActions.length} of {allActions.length} activities
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[600px] pr-4">
            {loading ? (
              <div className="text-center py-8 text-slate-400">Loading activity log...</div>
            ) : paginatedActions.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <Activity className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No activities found</p>
                <p className="text-sm mt-1">
                  {filteredActions.length === 0 && allActions.length > 0
                    ? 'Try adjusting your filters'
                    : 'This user has no recorded activities'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {paginatedActions.map((action) => (
                  <div
                    key={action.id}
                    className="border border-slate-700 rounded-lg p-4 hover:bg-slate-700/50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline">{action.action}</Badge>
                          <Badge
                            variant={action.status === 'success' ? 'default' : 'destructive'}
                            className="text-xs uppercase"
                          >
                            {action.status}
                          </Badge>
                          {action.tenantId && (
                            <Badge variant="secondary" className="font-mono text-xs">
                              Tenant: {action.tenantId}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-slate-300 mt-1">
                          Resource: <span className="font-mono">{action.resourceType}</span>
                        </p>
                        {action.details && Object.keys(action.details).length > 0 && (
                          <details className="mt-2">
                            <summary className="text-xs text-slate-400 cursor-pointer hover:text-slate-300">
                              View Details
                            </summary>
                            <pre className="mt-2 text-xs bg-slate-900 p-2 rounded overflow-auto max-h-40">
                              {JSON.stringify(action.details, null, 2)}
                            </pre>
                          </details>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-slate-400">
                        <Clock className="h-3 w-3" />
                        {new Date(action.timestamp).toLocaleString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t border-slate-700 mt-4">
              <p className="text-sm text-slate-400">
                Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to{' '}
                {Math.min(currentPage * ITEMS_PER_PAGE, filteredActions.length)} of{' '}
                {filteredActions.length} entries
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <span className="text-sm text-white">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
