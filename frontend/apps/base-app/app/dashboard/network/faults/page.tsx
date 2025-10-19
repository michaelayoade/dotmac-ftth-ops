'use client';

import { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EnhancedDataTable, BulkAction } from '@/components/ui/EnhancedDataTable';
import { createSortableHeader } from '@/components/ui/data-table';
import { UniversalChart } from '@dotmac/primitives';
import { AlarmDetailModal } from '@/components/faults/AlarmDetailModal';
import {
  CheckCircle,
  X,
  AlertTriangle,
  Clock,
  Info,
  RefreshCw,
  FileText,
  Bell
} from 'lucide-react';
import { ColumnDef } from '@tanstack/react-table';
import { useRBAC } from '@/contexts/RBACContext';
import {
  useAlarms,
  useAlarmStatistics,
  useAlarmOperations,
  Alarm as AlarmType,
  AlarmSeverity,
  AlarmStatus
} from '@/hooks/useFaults';

// ============================================================================
// Types
// ============================================================================

type Alarm = AlarmType;

interface AlarmFrequencyData {
  hour: string;
  critical: number;
  major: number;
  minor: number;
  warning: number;
  info: number;
}

interface SLAComplianceData {
  date: string;
  compliance: number;
  target: number;
}

// ============================================================================
// Mock Data (Replace with API calls)
// ============================================================================

const mockAlarms: Alarm[] = [
  {
    id: '1',
    alarm_id: 'ALM-001',
    severity: 'critical',
    status: 'active',
    source: 'genieacs',
    alarm_type: 'DEVICE_OFFLINE',
    title: 'ONU Device Offline',
    description: 'ONU device has not communicated in 15 minutes',
    resource_type: 'onu',
    resource_name: 'ONU-001-ABC',
    customer_name: 'John Doe',
    subscriber_count: 1,
    first_occurrence: new Date(Date.now() - 3600000).toISOString(),
    last_occurrence: new Date().toISOString(),
    occurrence_count: 3,
    is_root_cause: true,
  },
  {
    id: '2',
    alarm_id: 'ALM-002',
    severity: 'major',
    status: 'acknowledged',
    source: 'voltha',
    alarm_type: 'HIGH_LATENCY',
    title: 'High Network Latency Detected',
    resource_type: 'olt',
    resource_name: 'OLT-CORE-01',
    subscriber_count: 45,
    first_occurrence: new Date(Date.now() - 7200000).toISOString(),
    last_occurrence: new Date(Date.now() - 1800000).toISOString(),
    occurrence_count: 12,
    acknowledged_at: new Date(Date.now() - 3000000).toISOString(),
    is_root_cause: false,
  },
  {
    id: '3',
    alarm_id: 'ALM-003',
    severity: 'minor',
    status: 'active',
    source: 'netbox',
    alarm_type: 'CONFIG_DRIFT',
    title: 'Configuration Drift Detected',
    resource_type: 'device',
    resource_name: 'SW-DIST-02',
    subscriber_count: 0,
    first_occurrence: new Date(Date.now() - 86400000).toISOString(),
    last_occurrence: new Date(Date.now() - 86400000).toISOString(),
    occurrence_count: 1,
    is_root_cause: true,
  },
];

const mockFrequencyData: AlarmFrequencyData[] = Array.from({ length: 24 }, (_, i) => ({
  hour: `${i}:00`,
  critical: Math.floor(Math.random() * 5),
  major: Math.floor(Math.random() * 10),
  minor: Math.floor(Math.random() * 15),
  warning: Math.floor(Math.random() * 20),
  info: Math.floor(Math.random() * 25),
}));

const mockSLAData: SLAComplianceData[] = Array.from({ length: 30 }, (_, i) => ({
  date: new Date(Date.now() - (29 - i) * 86400000).toLocaleDateString(),
  compliance: 95 + Math.random() * 5,
  target: 99.9,
}));

// ============================================================================
// Component
// ============================================================================

export default function FaultManagementPage() {
  const { hasPermission } = useRBAC();
  const [selectedTimeRange, setSelectedTimeRange] = useState<'24h' | '7d' | '30d'>('24h');
  const [selectedAlarm, setSelectedAlarm] = useState<Alarm | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  const hasFaultAccess = hasPermission('faults.alarms.read');

  // Fetch alarms from API
  const { alarms: apiAlarms, isLoading: alarmsLoading, refetch: refetchAlarms } = useAlarms({
    limit: 100,
    offset: 0,
  });

  // Fetch alarm statistics
  const { statistics: apiStatistics } = useAlarmStatistics();

  // Alarm operations
  const { acknowledgeAlarms, clearAlarms, createTickets, isLoading: operationsLoading } = useAlarmOperations();

  // Only use mock data in development mode with explicit flag
  const isDevelopment = process.env.NODE_ENV === 'development';
  const useMockData = isDevelopment && process.env.NEXT_PUBLIC_USE_MOCK_DATA === 'true';

  // In production, never fall back to mock data
  const alarms = useMockData && apiAlarms.length === 0 ? mockAlarms : apiAlarms;
  const isLoading = alarmsLoading || operationsLoading;

  // Production safety: log warning if using mock data
  if (useMockData && apiAlarms.length === 0) {
    console.warn('⚠️ DEVELOPMENT MODE: Using mock alarm data. Set NEXT_PUBLIC_USE_MOCK_DATA=false to test real API.');
  }

  // Calculate statistics (prefer API statistics, fallback to calculated)
  const statistics = useMemo(() => {
    if (apiStatistics) {
      return {
        active: apiStatistics.active_alarms,
        critical: apiStatistics.critical_alarms,
        acknowledged: apiStatistics.acknowledged_alarms,
        totalImpacted: 0, // TODO: Add to API statistics
      };
    }

    // Fallback to calculated statistics
    const active = alarms.filter(a => a.status === 'active').length;
    const critical = alarms.filter(a => a.severity === 'critical' && a.status === 'active').length;
    const acknowledged = alarms.filter(a => a.status === 'acknowledged').length;
    const totalImpacted = alarms
      .filter(a => a.status === 'active')
      .reduce((sum, a) => sum + a.subscriber_count, 0);

    return { active, critical, acknowledged, totalImpacted };
  }, [alarms, apiStatistics]);

  // ============================================================================
  // Table Configuration
  // ============================================================================

  const columns: ColumnDef<Alarm>[] = [
    {
      accessorKey: 'severity',
      header: 'Severity',
      cell: ({ row }) => {
        const severity = row.getValue('severity') as AlarmSeverity;
        const config = {
          critical: { color: 'bg-red-600 text-white', icon: AlertTriangle },
          major: { color: 'bg-orange-500 text-white', icon: AlertTriangle },
          minor: { color: 'bg-yellow-500 text-black', icon: Clock },
          warning: { color: 'bg-yellow-400 text-black', icon: AlertTriangle },
          info: { color: 'bg-blue-500 text-white', icon: Info },
        };
        const { color, icon: Icon } = config[severity];
        return (
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4" />
            <Badge className={color}>{severity}</Badge>
          </div>
        );
      },
    },
    {
      accessorKey: 'alarm_type',
      header: createSortableHeader('Type'),
      cell: ({ row }) => (
        <div className="font-mono text-xs">{row.getValue('alarm_type')}</div>
      ),
    },
    {
      accessorKey: 'title',
      header: createSortableHeader('Title'),
      cell: ({ row }) => (
        <div className="max-w-md">
          <div className="font-medium">{row.getValue('title')}</div>
          {row.original.resource_name && (
            <div className="text-xs text-muted-foreground mt-1">
              {row.original.resource_name}
            </div>
          )}
        </div>
      ),
    },
    {
      accessorKey: 'customer_name',
      header: 'Customer',
      cell: ({ row }) => {
        const customerName = row.getValue('customer_name') as string | undefined;
        const subscriberCount = row.original.subscriber_count;
        return customerName || subscriberCount > 0 ? (
          <div>
            <div>{customerName || 'Multiple'}</div>
            {subscriberCount > 0 && (
              <div className="text-xs text-muted-foreground">
                {subscriberCount} subscriber{subscriberCount !== 1 ? 's' : ''}
              </div>
            )}
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        );
      },
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const status = row.getValue('status') as AlarmStatus;
        const statusConfig = {
          active: { color: 'bg-red-500 text-white', label: 'Active' },
          acknowledged: { color: 'bg-yellow-500 text-black', label: 'Acknowledged' },
          cleared: { color: 'bg-blue-500 text-white', label: 'Cleared' },
          resolved: { color: 'bg-green-500 text-white', label: 'Resolved' },
        };
        const { color, label } = statusConfig[status];
        return <Badge className={color}>{label}</Badge>;
      },
    },
    {
      accessorKey: 'occurrence_count',
      header: createSortableHeader('Count'),
      cell: ({ row }) => (
        <div className="text-center">
          <Badge variant="outline">{row.getValue('occurrence_count')}</Badge>
        </div>
      ),
    },
    {
      accessorKey: 'last_occurrence',
      header: createSortableHeader('Last Seen'),
      cell: ({ row }) => {
        const date = new Date(row.getValue('last_occurrence'));
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(minutes / 60);

        let timeAgo = '';
        if (hours > 24) {
          timeAgo = `${Math.floor(hours / 24)}d ago`;
        } else if (hours > 0) {
          timeAgo = `${hours}h ago`;
        } else {
          timeAgo = `${minutes}m ago`;
        }

        return (
          <div>
            <div className="text-sm">{timeAgo}</div>
            <div className="text-xs text-muted-foreground">
              {date.toLocaleTimeString()}
            </div>
          </div>
        );
      },
    },
  ];

  // ============================================================================
  // Bulk Actions
  // ============================================================================

  const bulkActions: BulkAction<Alarm>[] = [
    {
      label: 'Acknowledge',
      icon: CheckCircle,
      action: async (selected) => {
        const alarmIds = selected.map(a => a.id);
        const success = await acknowledgeAlarms(alarmIds, 'Bulk acknowledged via dashboard');

        if (success) {
          await refetchAlarms();
        }
      },
      disabled: (selected) => selected.every(a => a.status !== 'active'),
    },
    {
      label: 'Clear Alarms',
      icon: X,
      action: async (selected) => {
        const alarmIds = selected.map(a => a.id);
        const success = await clearAlarms(alarmIds);

        if (success) {
          await refetchAlarms();
        }
      },
    },
    {
      label: 'Create Ticket',
      icon: FileText,
      action: async (selected) => {
        const alarmIds = selected.map(a => a.id);
        const success = await createTickets(alarmIds, 'normal');

        if (success) {
          alert(`Successfully created tickets for ${selected.length} alarm(s)`);
          await refetchAlarms();
        }
      },
    },
  ];

  if (!hasFaultAccess) {
    return (
      <main className="max-w-7xl mx-auto px-6 py-12">
        <Card>
          <CardHeader>
            <CardTitle>Fault Management</CardTitle>
            <CardDescription>
              Access requires <code>faults.alarms.read</code> permission.
            </CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  return (
    <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Fault Management</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Monitor and manage network alarms and SLA compliance
          </p>
        </div>
        <Button onClick={() => refetchAlarms()} variant="outline" disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </header>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Active Alarms</CardDescription>
            <CardTitle className="text-3xl">{statistics.active}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-muted-foreground">
              Currently active in the system
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Critical Alarms</CardDescription>
            <CardTitle className="text-3xl text-red-600">{statistics.critical}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-muted-foreground">
              Requiring immediate attention
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Acknowledged</CardDescription>
            <CardTitle className="text-3xl">{statistics.acknowledged}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-muted-foreground">
              Being handled by operators
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Impacted Subscribers</CardDescription>
            <CardTitle className="text-3xl">{statistics.totalImpacted}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-muted-foreground">
              Affected by active alarms
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alarm Frequency Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Alarm Frequency (Last 24 Hours)</CardTitle>
          <CardDescription>
            Alarms by severity over time
          </CardDescription>
        </CardHeader>
        <CardContent>
          <UniversalChart
            type="bar"
            data={mockFrequencyData}
            series={[
              { key: 'critical', name: 'Critical', color: '#dc2626' },
              { key: 'major', name: 'Major', color: '#f97316' },
              { key: 'minor', name: 'Minor', color: '#eab308' },
              { key: 'warning', name: 'Warning', color: '#facc15' },
              { key: 'info', name: 'Info', color: '#3b82f6' },
            ]}
            xAxis={{ dataKey: 'hour' }}
            height={300}
            stacked
          />
        </CardContent>
      </Card>

      {/* SLA Compliance Chart */}
      <Card>
        <CardHeader>
          <CardTitle>SLA Compliance Trends</CardTitle>
          <CardDescription>
            Network availability compliance over the last 30 days
          </CardDescription>
        </CardHeader>
        <CardContent>
          <UniversalChart
            type="line"
            data={mockSLAData}
            series={[
              { key: 'compliance', name: 'Actual Compliance', type: 'area', color: '#10b981' },
              { key: 'target', name: 'Target (99.9%)', strokeDashArray: '5 5', color: '#6b7280' },
            ]}
            xAxis={{ dataKey: 'date' }}
            yAxis={{
              left: {
                format: (v) => `${v.toFixed(1)}%`,
                domain: [95, 100]
              }
            }}
            height={300}
            smooth
          />
        </CardContent>
      </Card>

      {/* Alarm List */}
      <Card>
        <CardHeader>
          <CardTitle>Active Alarms</CardTitle>
          <CardDescription>
            All alarms in the system with filtering and bulk actions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EnhancedDataTable
            data={alarms}
            columns={columns}
            searchColumn="title"
            searchPlaceholder="Search alarms by title..."
            isLoading={isLoading}
            selectable
            bulkActions={bulkActions}
            exportable
            exportFilename="alarms"
            exportColumns={['alarm_id', 'severity', 'status', 'alarm_type', 'title', 'resource_name', 'customer_name']}
            filterable
            filters={[
              {
                column: 'severity',
                label: 'Severity',
                type: 'select',
                options: [
                  { label: 'Critical', value: 'critical' },
                  { label: 'Major', value: 'major' },
                  { label: 'Minor', value: 'minor' },
                  { label: 'Warning', value: 'warning' },
                  { label: 'Info', value: 'info' },
                ],
              },
              {
                column: 'status',
                label: 'Status',
                type: 'select',
                options: [
                  { label: 'Active', value: 'active' },
                  { label: 'Acknowledged', value: 'acknowledged' },
                  { label: 'Cleared', value: 'cleared' },
                  { label: 'Resolved', value: 'resolved' },
                ],
              },
              {
                column: 'source',
                label: 'Source',
                type: 'select',
                options: [
                  { label: 'GenieACS', value: 'genieacs' },
                  { label: 'VOLTHA', value: 'voltha' },
                  { label: 'NetBox', value: 'netbox' },
                  { label: 'Manual', value: 'manual' },
                ],
              },
            ]}
            onRowClick={(alarm) => {
              setSelectedAlarm(alarm);
              setIsDetailModalOpen(true);
            }}
          />
        </CardContent>
      </Card>

      {/* Alarm Detail Modal */}
      <AlarmDetailModal
        alarm={selectedAlarm}
        open={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false);
          setSelectedAlarm(null);
        }}
        onUpdate={() => {
          refetchAlarms();
        }}
      />
    </main>
  );
}
