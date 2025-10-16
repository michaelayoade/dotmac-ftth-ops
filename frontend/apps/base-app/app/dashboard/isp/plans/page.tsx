'use client';

/**
 * ISP Internet Service Plans Management Page
 *
 * Main dashboard for managing internet service plans with CRUD operations.
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Plus, Search, Filter, TrendingUp, Users, DollarSign } from 'lucide-react';
import { useInternetPlans, usePlanStatistics } from '../../../../hooks/useInternetPlans';
import type {
  InternetServicePlan,
  ListPlansParams,
  PlanStatus,
  PlanType,
} from '../../../../types/internet-plans';
import Link from 'next/link';

export default function InternetPlansPage() {
  const [filters, setFilters] = useState<ListPlansParams>({
    limit: 50,
    offset: 0,
  });
  const [searchTerm, setSearchTerm] = useState('');

  const { data: plans = [], isLoading, error } = useInternetPlans(filters);

  const handleSearch = () => {
    setFilters((prev) => ({
      ...prev,
      search: searchTerm,
      offset: 0,
    }));
  };

  const handleFilterChange = (key: keyof ListPlansParams, value: unknown) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
      offset: 0,
    }));
  };

  const clearFilters = () => {
    setFilters({ limit: 50, offset: 0 });
    setSearchTerm('');
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Internet Service Plans</h1>
          <p className="text-muted-foreground mt-1">
            Manage ISP internet plans with speeds, data caps, and validation testing
          </p>
        </div>
        <Link href="/dashboard/isp/plans/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Create Plan
          </Button>
        </Link>
      </div>

      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Plans</p>
              <p className="text-2xl font-bold">{plans.length}</p>
            </div>
            <TrendingUp className="h-8 w-8 text-blue-500" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Active Plans</p>
              <p className="text-2xl font-bold">
                {plans.filter((p) => p.status === 'active').length}
              </p>
            </div>
            <TrendingUp className="h-8 w-8 text-green-500" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Promotional</p>
              <p className="text-2xl font-bold">
                {plans.filter((p) => p.is_promotional).length}
              </p>
            </div>
            <DollarSign className="h-8 w-8 text-purple-500" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Business Plans</p>
              <p className="text-2xl font-bold">
                {plans.filter((p) => p.plan_type === 'business').length}
              </p>
            </div>
            <Users className="h-8 w-8 text-orange-500" />
          </div>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card className="p-4">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-4">
            {/* Search */}
            <div className="flex flex-1 items-center gap-2">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search plans by name, code, or description..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="pl-10 pr-4 py-2 w-full border rounded-md"
                />
              </div>
              <Button onClick={handleSearch} variant="secondary">
                Search
              </Button>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <select
                value={filters.plan_type || ''}
                onChange={(e) =>
                  handleFilterChange('plan_type', e.target.value || undefined)
                }
                className="border rounded-md px-3 py-2"
              >
                <option value="">All Types</option>
                <option value="residential">Residential</option>
                <option value="business">Business</option>
                <option value="enterprise">Enterprise</option>
                <option value="promotional">Promotional</option>
              </select>

              <select
                value={filters.status || ''}
                onChange={(e) => handleFilterChange('status', e.target.value || undefined)}
                className="border rounded-md px-3 py-2"
              >
                <option value="">All Status</option>
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="archived">Archived</option>
              </select>

              <select
                value={
                  filters.is_public === undefined
                    ? ''
                    : filters.is_public
                      ? 'true'
                      : 'false'
                }
                onChange={(e) =>
                  handleFilterChange(
                    'is_public',
                    e.target.value === '' ? undefined : e.target.value === 'true'
                  )
                }
                className="border rounded-md px-3 py-2"
              >
                <option value="">All Visibility</option>
                <option value="true">Public</option>
                <option value="false">Private</option>
              </select>

              <Button onClick={clearFilters} variant="ghost" size="sm">
                Clear
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Plans List */}
      {isLoading ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading plans...</p>
        </div>
      ) : error ? (
        <Card className="p-6">
          <p className="text-red-500">Error loading plans: {String(error)}</p>
        </Card>
      ) : plans.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-muted-foreground mb-4">
            No internet service plans found. Create your first plan to get started.
          </p>
          <Link href="/dashboard/isp/plans/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create First Plan
            </Button>
          </Link>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan) => (
            <PlanCard key={plan.id} plan={plan} />
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Plan Card Component
// ============================================================================

function PlanCard({ plan }: { plan: InternetServicePlan }) {
  const { data: stats } = usePlanStatistics(plan.id);

  const getStatusColor = (status: PlanStatus): string => {
    switch (status) {
      case 'active':
        return 'bg-green-500';
      case 'draft':
        return 'bg-gray-500';
      case 'inactive':
        return 'bg-yellow-500';
      case 'archived':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getTypeColor = (type: PlanType): string => {
    switch (type) {
      case 'residential':
        return 'bg-blue-500';
      case 'business':
        return 'bg-purple-500';
      case 'enterprise':
        return 'bg-orange-500';
      case 'promotional':
        return 'bg-pink-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <Card className="p-6 hover:shadow-lg transition-shadow">
      <Link href={`/dashboard/isp/plans/${plan.id}`}>
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="font-bold text-lg">{plan.name}</h3>
              <p className="text-sm text-muted-foreground">{plan.plan_code}</p>
            </div>
            <div className="flex flex-col gap-1 items-end">
              <Badge className={getStatusColor(plan.status)}>{plan.status}</Badge>
              <Badge className={getTypeColor(plan.plan_type)}>{plan.plan_type}</Badge>
            </div>
          </div>

          {/* Description */}
          {plan.description && (
            <p className="text-sm text-muted-foreground line-clamp-2">
              {plan.description}
            </p>
          )}

          {/* Speed Info */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Download</span>
              <span className="font-semibold">
                {plan.download_speed} {plan.speed_unit}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Upload</span>
              <span className="font-semibold">
                {plan.upload_speed} {plan.speed_unit}
              </span>
            </div>
            {plan.has_data_cap && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Data Cap</span>
                <span className="font-semibold">
                  {plan.data_cap_amount} {plan.data_cap_unit}
                </span>
              </div>
            )}
          </div>

          {/* Pricing */}
          <div className="border-t pt-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Monthly Price</span>
              <span className="text-xl font-bold">
                {plan.currency} {plan.monthly_price.toFixed(2)}
              </span>
            </div>
            {plan.setup_fee > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Setup Fee</span>
                <span>
                  {plan.currency} {plan.setup_fee.toFixed(2)}
                </span>
              </div>
            )}
          </div>

          {/* Statistics */}
          {stats && (
            <div className="border-t pt-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Users className="h-4 w-4" />
                  Subscriptions
                </span>
                <span className="font-semibold">{stats.active_subscriptions}</span>
              </div>
              <div className="flex items-center justify-between text-sm mt-1">
                <span className="text-muted-foreground flex items-center gap-1">
                  <DollarSign className="h-4 w-4" />
                  MRR
                </span>
                <span className="font-semibold">
                  {plan.currency} {stats.monthly_recurring_revenue.toFixed(2)}
                </span>
              </div>
            </div>
          )}

          {/* Badges */}
          <div className="flex flex-wrap gap-2">
            {plan.is_promotional && (
              <Badge variant="secondary" className="text-xs">
                Promotional
              </Badge>
            )}
            {plan.has_fup && (
              <Badge variant="secondary" className="text-xs">
                FUP
              </Badge>
            )}
            {plan.has_time_restrictions && (
              <Badge variant="secondary" className="text-xs">
                Time Restrictions
              </Badge>
            )}
            {plan.static_ip_included && (
              <Badge variant="secondary" className="text-xs">
                Static IP
              </Badge>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Link href={`/dashboard/isp/plans/${plan.id}/validate`} className="flex-1">
              <Button variant="outline" size="sm" className="w-full">
                Validate
              </Button>
            </Link>
            <Link href={`/dashboard/isp/plans/${plan.id}/edit`} className="flex-1">
              <Button variant="secondary" size="sm" className="w-full">
                Edit
              </Button>
            </Link>
          </div>
        </div>
      </Link>
    </Card>
  );
}
