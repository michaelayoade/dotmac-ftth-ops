'use client';

import { useState, useEffect } from 'react';
import { Search, Download, RefreshCw, X, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ActivityType, ActivitySeverity, ACTIVITY_CATEGORIES } from '@/types/audit';

interface AuditLogFiltersProps {
  onFilterChange: (filters: AuditFilters) => void;
  onExport: (format: 'csv' | 'json') => void;
  onRefresh: () => void;
  isRefreshing?: boolean;
}

export interface AuditFilters {
  userId?: string;
  tenantId?: string;
  activityType?: string;
  resourceType?: string;
  resourceId?: string;
  severity?: string;
  days?: number;
  search?: string;
}

export function AuditLogFilters({
  onFilterChange,
  onExport,
  onRefresh,
  isRefreshing = false,
}: AuditLogFiltersProps) {
  const [filters, setFilters] = useState<AuditFilters>({});
  const [searchInput, setSearchInput] = useState('');

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      onFilterChange({
        ...filters,
        search: searchInput || undefined,
      });
    }, 500);

    return () => clearTimeout(debounceTimer);
  }, [filters, searchInput, onFilterChange]);

  const handleFilterChange = (key: keyof AuditFilters, value: string | number | undefined) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const clearFilters = () => {
    setFilters({});
    setSearchInput('');
    onFilterChange({});
  };

  const hasActiveFilters =
    Object.keys(filters).some((key) => filters[key as keyof AuditFilters]) || searchInput;

  return (
    <div className="space-y-4">
      {/* Primary Filters Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Search */}
        <div className="md:col-span-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search audit logs..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Days Filter */}
        <Select
          value={filters.days?.toString()}
          onValueChange={(value) => handleFilterChange('days', value === 'all' ? undefined : parseInt(value))}
        >
          <SelectTrigger>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              <SelectValue placeholder="Last 30 days" />
            </div>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">Last 24 hours</SelectItem>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
            <SelectItem value="180">Last 6 months</SelectItem>
            <SelectItem value="365">Last year</SelectItem>
          </SelectContent>
        </Select>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="flex-1"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onExport('csv')}
            className="flex-1"
          >
            <Download className="h-4 w-4 mr-2" />
            CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onExport('json')}
            className="flex-1"
          >
            <Download className="h-4 w-4 mr-2" />
            JSON
          </Button>
        </div>
      </div>

      {/* Secondary Filters Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Severity Filter */}
        <Select
          value={filters.severity}
          onValueChange={(value) => handleFilterChange('severity', value === 'all' ? undefined : value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="All Severities" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Severities</SelectItem>
            <SelectItem value={ActivitySeverity.LOW}>Low</SelectItem>
            <SelectItem value={ActivitySeverity.MEDIUM}>Medium</SelectItem>
            <SelectItem value={ActivitySeverity.HIGH}>High</SelectItem>
            <SelectItem value={ActivitySeverity.CRITICAL}>Critical</SelectItem>
          </SelectContent>
        </Select>

        {/* User ID Filter */}
        <Input
          placeholder="User ID"
          value={filters.userId || ''}
          onChange={(e) => handleFilterChange('userId', e.target.value || undefined)}
        />

        {/* Resource Type Filter */}
        <Input
          placeholder="Resource Type"
          value={filters.resourceType || ''}
          onChange={(e) => handleFilterChange('resourceType', e.target.value || undefined)}
        />

        {/* Resource ID Filter */}
        <Input
          placeholder="Resource ID"
          value={filters.resourceId || ''}
          onChange={(e) => handleFilterChange('resourceId', e.target.value || undefined)}
        />
      </div>

      {/* Activity Type Categories */}
      <div className="space-y-3">
        <label className="text-sm font-medium">Activity Categories</label>
        <div className="space-y-2">
          {Object.entries(ACTIVITY_CATEGORIES).map(([category, activityTypes]) => (
            <div key={category}>
              <label className="text-xs text-muted-foreground mb-1 block">{category}</label>
              <div className="flex flex-wrap gap-2">
                {activityTypes.map((activityType) => {
                  const isSelected = filters.activityType === activityType;
                  return (
                    <Badge
                      key={activityType}
                      variant={isSelected ? 'default' : 'outline'}
                      className="cursor-pointer hover:bg-accent transition-colors"
                      onClick={() =>
                        handleFilterChange('activityType', isSelected ? undefined : activityType)
                      }
                    >
                      {formatActivityTypeLabel(activityType)}
                      {isSelected && <X className="ml-1 h-3 w-3" />}
                    </Badge>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Clear Filters */}
      {hasActiveFilters && (
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X className="h-4 w-4 mr-2" />
            Clear All Filters
          </Button>
        </div>
      )}
    </div>
  );
}

// Helper function to format activity type labels
function formatActivityTypeLabel(activityType: ActivityType): string {
  const parts = activityType.split('.');
  const lastPart = parts[parts.length - 1] ?? '';
  return lastPart
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
