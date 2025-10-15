'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Users,
  Mail,
  FileText,
  Activity,
  TrendingUp,
  ArrowUpRight,
  AlertCircle,
  Clock,
  Package
} from 'lucide-react';
import { useCustomers } from '@/hooks/useCustomers';
import { metricsService, type OperationsMetrics } from '@/lib/services/metrics-service';
import { AlertBanner } from '@/components/alerts/AlertBanner';
import { MetricCardEnhanced } from '@/components/ui/metric-card-enhanced';

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  href?: string;
}

function MetricCard({ title, value, subtitle, icon: Icon, trend, href }: MetricCardProps) {
  const content = (
    <div className="rounded-lg border border-border bg-card p-6 hover:border-border transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="mt-2 text-3xl font-bold text-foreground">{value}</p>
          {subtitle && (
            <p className="mt-1 text-sm text-foreground0">{subtitle}</p>
          )}
          {trend && (
            <div className={`mt-2 flex items-center text-sm ${trend.isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              <TrendingUp className={`h-4 w-4 mr-1 ${!trend.isPositive ? 'rotate-180' : ''}`} />
              {Math.abs(trend.value)}% from last month
            </div>
          )}
        </div>
        <div className="p-3 bg-muted rounded-lg">
          <Icon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
        </div>
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block group relative">
        {content}
        <ArrowUpRight className="absolute top-4 right-4 h-4 w-4 text-foreground0 opacity-0 group-hover:opacity-100 transition-opacity" />
      </Link>
    );
  }

  return content;
}

interface QuickActionProps {
  title: string;
  description: string;
  href: string;
  icon: React.ElementType;
}

function QuickAction({ title, description, href, icon: Icon }: QuickActionProps) {
  return (
    <Link
      href={href}
      className="flex items-start gap-4 rounded-lg border border-border bg-card p-4 hover:border-border transition-colors"
    >
      <div className="p-2 bg-muted rounded-lg">
        <Icon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
      </div>
      <div className="flex-1">
        <p className="font-medium text-foreground">{title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      <ArrowUpRight className="h-4 w-4 text-foreground0" />
    </Link>
  );
}

interface RecentActivityItem {
  id: string;
  type: 'customer' | 'communication' | 'file';
  title: string;
  description: string;
  timestamp: string;
  icon: React.ElementType;
}

function RecentActivity({ items }: { items: RecentActivityItem[] }) {
  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="p-6 border-b border-border">
        <h3 className="text-lg font-semibold text-foreground">Recent Activity</h3>
      </div>
      <div className="divide-y divide-border">
        {items.length === 0 ? (
          <div className="p-6 text-center text-foreground0">
            No recent activity
          </div>
        ) : (
          items.map((item) => (
            <div key={item.id} className="p-4 hover:bg-muted transition-colors">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-muted rounded-lg">
                  <item.icon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground truncate">{item.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground truncate">{item.description}</p>
                </div>
                <span className="text-xs text-foreground0 whitespace-nowrap">
                  {item.timestamp}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default function OperationsPage() {
  const [metrics, setMetrics] = useState<OperationsMetrics | null>(null);
  const [recentActivity, setRecentActivity] = useState<RecentActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOperationsData();
    // Refresh metrics every 60 seconds
    const interval = setInterval(fetchOperationsData, 60000);
    return () => clearInterval(interval);
  }, []);

  const fetchOperationsData = async () => {
    try {
      setLoading(true);

      // Fetch operations metrics from the metrics service
      const operationsMetrics = await metricsService.getOperationsMetrics();
      setMetrics(operationsMetrics);

      // Transform activity data into recent activity items
      const activities: RecentActivityItem[] = [];

      // Add customer activity
      if (operationsMetrics.customers.newThisMonth > 0) {
        activities.push({
          id: 'cust-new',
          type: 'customer',
          title: `${operationsMetrics.customers.newThisMonth} new customers`,
          description: 'Registered this month',
          timestamp: 'This month',
          icon: Users
        });
      }

      // Add communication activity
      if (operationsMetrics.communications.sentToday > 0) {
        activities.push({
          id: 'comm-sent',
          type: 'communication',
          title: `${operationsMetrics.communications.sentToday} messages sent`,
          description: `${operationsMetrics.communications.deliveryRate}% delivery rate`,
          timestamp: 'Today',
          icon: Mail
        });
      }

      // Add file activity
      if (operationsMetrics.files.uploadsToday > 0) {
        activities.push({
          id: 'file-upload',
          type: 'file',
          title: `${operationsMetrics.files.uploadsToday} files uploaded`,
          description: `${operationsMetrics.files.downloadsToday} downloads today`,
          timestamp: 'Today',
          icon: FileText
        });
      }

      // Add system activity
      if (operationsMetrics.activity.eventsPerHour > 0) {
        activities.push({
          id: 'sys-activity',
          type: 'customer',
          title: `${operationsMetrics.activity.eventsPerHour} events/hour`,
          description: `${operationsMetrics.activity.activeUsers} active users`,
          timestamp: 'Current',
          icon: Activity
        });
      }

      setRecentActivity(activities);
    } catch (error) {
      console.error('Failed to fetch operations data:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Operations</h1>
        <p className="mt-2 text-muted-foreground">
          Manage customer lifecycle, communications, and file distribution
        </p>
      </div>

      {/* Alert Banner - Shows operations-related alerts */}
      <AlertBanner category="system" maxAlerts={3} />

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCardEnhanced
          title="Total Customers"
          value={metrics?.customers.total || 0}
          subtitle="Active accounts"
          icon={Users}
          trend={{
            value: metrics?.customers.growthRate || 0,
            isPositive: (metrics?.customers.growthRate || 0) > 0
          }}
          href="/dashboard/operations/customers"
          emptyStateMessage="No customers registered yet"
        />
        <MetricCardEnhanced
          title="Communications Sent"
          value={metrics?.communications.totalSent || 0}
          subtitle={`${metrics?.communications.sentToday || 0} sent today`}
          icon={Mail}
          trend={{
            value: metrics?.communications.deliveryRate || 0,
            isPositive: true
          }}
          href="/dashboard/operations/communications"
          emptyStateMessage="No communications sent"
        />
        <MetricCardEnhanced
          title="Files Distributed"
          value={metrics?.files.totalFiles || 0}
          subtitle={`${((metrics?.files.totalSize || 0) / (1024 * 1024 * 1024)).toFixed(2)} GB total`}
          icon={FileText}
          href="/dashboard/operations/files"
          emptyStateMessage="No files uploaded"
        />
        <MetricCardEnhanced
          title="System Activity"
          value={`${metrics?.activity.eventsPerHour || 0}/hr`}
          subtitle={`${metrics?.activity.activeUsers || 0} active users`}
          icon={Activity}
          emptyStateMessage="No activity tracked"
        />
      </div>

      {/* Churn Risk Alert */}
      {metrics?.customers.churnRisk && metrics.customers.churnRisk > 0 && (
        <div className="rounded-lg border border-orange-900/20 bg-orange-950/20 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-orange-400 mt-0.5" />
            <div className="flex-1">
              <p className="font-medium text-orange-400">Attention Required</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {metrics.customers.churnRisk} customers at risk of churning.
                <Link href="/dashboard/operations/customers?filter=at-risk" className="ml-2 text-orange-400 hover:text-orange-300">
                  View customers →
                </Link>
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Quick Actions */}
        <div className="lg:col-span-2 space-y-6">
          <div>
            <h2 className="text-xl font-semibold text-foreground mb-4">Quick Actions</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <QuickAction
                title="Add New Customer"
                description="Register a new customer account"
                href="/dashboard/operations/customers?action=new"
                icon={Users}
              />
              <QuickAction
                title="Send Communication"
                description="Create email or notification"
                href="/dashboard/operations/communications?action=new"
                icon={Mail}
              />
              <QuickAction
                title="Upload Files"
                description="Distribute files to customers"
                href="/dashboard/operations/files?action=upload"
                icon={FileText}
              />
              <QuickAction
                title="View Reports"
                description="Analytics and insights"
                href="/dashboard/operations/reports"
                icon={Activity}
              />
            </div>
          </div>

          {/* Domain Overview */}
          <div>
            <h2 className="text-xl font-semibold text-foreground mb-4">Domain Overview</h2>
            <div className="space-y-4">
              <Link
                href="/dashboard/operations/customers"
                className="block rounded-lg border border-border bg-card p-6 hover:border-border transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-muted rounded-lg">
                      <Users className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">Customer Management</h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {metrics?.customers.total || 0} total customers • {metrics?.customers.newThisMonth || 0} new this month
                      </p>
                    </div>
                  </div>
                  <ArrowUpRight className="h-5 w-5 text-foreground0" />
                </div>
              </Link>

              <Link
                href="/dashboard/operations/communications"
                className="block rounded-lg border border-border bg-card p-6 hover:border-border transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-muted rounded-lg">
                      <Mail className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">Communications</h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Email, SMS, and notification management
                      </p>
                    </div>
                  </div>
                  <ArrowUpRight className="h-5 w-5 text-foreground0" />
                </div>
              </Link>

              <Link
                href="/dashboard/operations/files"
                className="block rounded-lg border border-border bg-card p-6 hover:border-border transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-muted rounded-lg">
                      <FileText className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">File Distribution</h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Manage and distribute files to customers
                      </p>
                    </div>
                  </div>
                  <ArrowUpRight className="h-5 w-5 text-foreground0" />
                </div>
              </Link>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="lg:col-span-1">
          <RecentActivity items={recentActivity} />
        </div>
      </div>
    </div>
  );
}
