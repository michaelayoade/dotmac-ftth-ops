/**
 * Universal Activity Feed Component
 * Real-time activity streams with timestamps, user actions, and status indicators
 */

"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Clock,
  User,
  AlertCircle,
  CheckCircle,
  Info,
  MoreHorizontal,
  Filter,
  RefreshCw,
} from "lucide-react";
import { cn } from "../utils/cn";

export interface ActivityItem {
  id: string;
  type: "user_action" | "system_event" | "error" | "success" | "info" | "warning";
  title: string;
  description?: string;
  timestamp: Date | string;

  // User Information
  user?: {
    id: string;
    name: string;
    avatar?: string;
    role?: string;
  };

  // Visual
  icon?: React.ComponentType<{ className?: string }>;
  color?: string;

  // Metadata
  metadata?: Record<string, any>;
  category?: string;
  priority?: "low" | "medium" | "high" | "urgent";

  // Interaction
  onClick?: () => void;
  href?: string;
  actions?: ActivityAction[];
}

export interface ActivityAction {
  id: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  onClick: () => void;
  variant?: "primary" | "secondary" | "danger";
}

export interface UniversalActivityFeedProps {
  activities: ActivityItem[];
  title?: string;

  // Display Options
  maxItems?: number;
  showTimestamps?: boolean;
  showAvatars?: boolean;
  showCategories?: boolean;
  groupByDate?: boolean;

  // Filtering
  allowFiltering?: boolean;
  categories?: string[];
  priorityFilter?: ActivityItem["priority"][];
  typeFilter?: ActivityItem["type"][];

  // Real-time
  isLive?: boolean;
  onRefresh?: () => void;
  refreshInterval?: number; // seconds

  // Layout
  variant?: "default" | "compact" | "detailed";
  className?: string;
  itemClassName?: string;

  // Loading & Empty States
  loading?: boolean;
  emptyMessage?: string;

  // Interaction
  onItemClick?: (item: ActivityItem) => void;
}

const typeConfig = {
  user_action: {
    icon: User,
    color: "text-blue-600",
    bg: "bg-blue-100",
    dot: "bg-blue-600",
  },
  system_event: {
    icon: Info,
    color: "text-gray-600",
    bg: "bg-gray-100",
    dot: "bg-gray-600",
  },
  error: {
    icon: AlertCircle,
    color: "text-red-600",
    bg: "bg-red-100",
    dot: "bg-red-600",
  },
  success: {
    icon: CheckCircle,
    color: "text-green-600",
    bg: "bg-green-100",
    dot: "bg-green-600",
  },
  info: {
    icon: Info,
    color: "text-blue-600",
    bg: "bg-blue-100",
    dot: "bg-blue-600",
  },
  warning: {
    icon: AlertCircle,
    color: "text-yellow-600",
    bg: "bg-yellow-100",
    dot: "bg-yellow-600",
  },
};

const priorityConfig = {
  low: "border-l-gray-300",
  medium: "border-l-blue-500",
  high: "border-l-yellow-500",
  urgent: "border-l-red-500",
};

export function UniversalActivityFeed({
  activities,
  title = "Recent Activity",
  maxItems,
  showTimestamps = true,
  showAvatars = true,
  showCategories = false,
  groupByDate = false,
  allowFiltering = false,
  categories = [],
  priorityFilter,
  typeFilter,
  isLive = false,
  onRefresh,
  refreshInterval = 30,
  variant = "default",
  className = "",
  itemClassName = "",
  loading = false,
  emptyMessage = "No recent activity",
  onItemClick,
}: UniversalActivityFeedProps) {
  const [filteredActivities, setFilteredActivities] = useState<ActivityItem[]>(activities);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedPriority, setSelectedPriority] = useState<string>("all");
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Auto-refresh for live feeds
  useEffect(() => {
    if (!isLive || !onRefresh || refreshInterval <= 0) {
      return;
    }

    const interval = setInterval(() => {
      onRefresh();
    }, refreshInterval * 1000);

    return () => clearInterval(interval);
  }, [isLive, onRefresh, refreshInterval]);

  // Filter activities
  useEffect(() => {
    let filtered = activities;

    // Category filter
    if (selectedCategory !== "all") {
      filtered = filtered.filter((item) => item.category === selectedCategory);
    }

    // Priority filter
    if (selectedPriority !== "all") {
      filtered = filtered.filter((item) => item.priority === selectedPriority);
    }

    // Type filter
    if (typeFilter && typeFilter.length > 0) {
      filtered = filtered.filter((item) => typeFilter.includes(item.type));
    }

    // Limit items
    if (maxItems) {
      filtered = filtered.slice(0, maxItems);
    }

    setFilteredActivities(filtered);
  }, [activities, selectedCategory, selectedPriority, typeFilter, maxItems]);

  const formatTimestamp = (timestamp: Date | string): string => {
    const date = typeof timestamp === "string" ? new Date(timestamp) : timestamp;
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString();
  };

  const handleRefresh = async () => {
    if (onRefresh) {
      setIsRefreshing(true);
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
      }
    }
  };

  const groupedActivities = groupByDate
    ? filteredActivities.reduce(
        (groups, activity) => {
          const date =
            typeof activity.timestamp === "string"
              ? new Date(activity.timestamp)
              : activity.timestamp;
          const dateKey = date.toDateString();

          if (!groups[dateKey]) {
            groups[dateKey] = [];
          }
          groups[dateKey].push(activity);
          return groups;
        },
        {} as Record<string, ActivityItem[]>,
      )
    : { all: filteredActivities };

  return (
    <div className={cn("bg-white rounded-xl shadow-sm border border-gray-200", className)}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div className="flex items-center space-x-3">
          <h3 className="font-semibold text-gray-900">{title}</h3>
          {isLive && (
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-xs text-green-600">Live</span>
            </div>
          )}
        </div>

        <div className="flex items-center space-x-2">
          {allowFiltering && (categories.length > 0 || priorityFilter) && (
            <div className="flex items-center space-x-2">
              {categories.length > 0 && (
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="text-sm border border-gray-300 rounded px-2 py-1"
                >
                  <option value="all">All Categories</option>
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {onRefresh && (
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="p-2 text-gray-400 hover:text-gray-600 disabled:opacity-50"
              title="Refresh"
            >
              <RefreshCw className={cn("w-4 h-4", isRefreshing && "animate-spin")} />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="max-h-96 overflow-y-auto">
        {loading ? (
          // Loading State
          <div className="p-4 space-y-4">
            {Array.from({ length: 3 }, (_, index) => (
              <div key={index} className="flex items-start space-x-3 animate-pulse">
                <div className="w-8 h-8 bg-gray-200 rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-3/4" />
                  <div className="h-3 bg-gray-200 rounded w-1/2" />
                </div>
                <div className="w-12 h-3 bg-gray-200 rounded" />
              </div>
            ))}
          </div>
        ) : filteredActivities.length === 0 ? (
          // Empty State
          <div className="p-8 text-center text-gray-500">
            <Clock className="w-8 h-8 mx-auto mb-2 text-gray-400" />
            <p>{emptyMessage}</p>
          </div>
        ) : (
          // Activity List
          <div className="divide-y divide-gray-100">
            <AnimatePresence>
              {Object.entries(groupedActivities).map(([dateGroup, items]) => (
                <div key={dateGroup}>
                  {groupByDate && dateGroup !== "all" && (
                    <div className="px-4 py-2 text-xs font-medium text-gray-500 bg-gray-50">
                      {dateGroup}
                    </div>
                  )}

                  {items.map((activity, index) => {
                    const config = typeConfig[activity.type];
                    const Icon = activity.icon || config.icon;

                    return (
                      <motion.div
                        key={activity.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        transition={{ duration: 0.2, delay: index * 0.05 }}
                        className={cn(
                          "p-4 hover:bg-gray-50 transition-colors",
                          activity.priority && priorityConfig[activity.priority],
                          (activity.onClick || onItemClick || activity.href) && "cursor-pointer",
                          itemClassName,
                        )}
                        onClick={() => {
                          if (activity.onClick) activity.onClick();
                          if (onItemClick) onItemClick(activity);
                        }}
                      >
                        <div className="flex items-start space-x-3">
                          {/* Icon/Avatar */}
                          <div className={cn("p-2 rounded-full flex-shrink-0", config.bg)}>
                            <Icon className={cn("w-4 h-4", config.color)} />
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">
                                  {activity.title}
                                </p>
                                {activity.description && (
                                  <p className="text-sm text-gray-600 mt-1">
                                    {activity.description}
                                  </p>
                                )}

                                {/* User & Category Info */}
                                <div className="flex items-center space-x-4 mt-2">
                                  {showAvatars && activity.user && (
                                    <div className="flex items-center space-x-2">
                                      {activity.user.avatar && (
                                        <img
                                          src={activity.user.avatar}
                                          alt={activity.user.name}
                                          className="w-4 h-4 rounded-full"
                                        />
                                      )}
                                      <span className="text-xs text-gray-500">
                                        {activity.user.name}
                                      </span>
                                    </div>
                                  )}

                                  {showCategories && activity.category && (
                                    <span className="text-xs text-gray-500 capitalize">
                                      {activity.category}
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Timestamp & Actions */}
                              <div className="flex items-center space-x-2 flex-shrink-0">
                                {showTimestamps && (
                                  <span className="text-xs text-gray-500">
                                    {formatTimestamp(activity.timestamp)}
                                  </span>
                                )}

                                {activity.actions && activity.actions.length > 0 && (
                                  <div className="flex items-center space-x-1">
                                    {activity.actions.map((action) => {
                                      const ActionIcon = action.icon;
                                      return (
                                        <button
                                          key={action.id}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            action.onClick();
                                          }}
                                          className={cn(
                                            "p-1 rounded text-xs hover:bg-gray-100",
                                            action.variant === "danger" &&
                                              "text-red-600 hover:bg-red-50",
                                          )}
                                          title={action.label}
                                        >
                                          {ActionIcon && <ActionIcon className="w-3 h-3" />}
                                        </button>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Show More Footer */}
      {maxItems && activities.length > maxItems && (
        <div className="p-3 border-t border-gray-200 text-center">
          <button className="text-sm text-blue-600 hover:text-blue-700">
            Show {activities.length - maxItems} more activities
          </button>
        </div>
      )}
    </div>
  );
}

export default UniversalActivityFeed;
