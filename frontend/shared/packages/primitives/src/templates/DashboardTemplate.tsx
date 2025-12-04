"use client";

import React from "react";

interface MetricCard {
  id: string;
  title: string;
  value: string | number;
  change?: {
    value: number;
    type: "increase" | "decrease" | "neutral";
    period: string;
  };
  icon?: React.ComponentType<any>;
  color?: "blue" | "green" | "yellow" | "red" | "gray";
}

interface ChartWidget {
  id: string;
  title: string;
  component: React.ComponentType<any>;
  size: "small" | "medium" | "large" | "full";
  data?: any;
}

interface QuickAction {
  id: string;
  label: string;
  onClick: () => void;
  icon?: React.ComponentType<any>;
  disabled?: boolean;
}

interface DashboardTemplateProps {
  title: string;
  subtitle?: string;
  metrics: MetricCard[];
  charts: ChartWidget[];
  quickActions?: QuickAction[];
  customContent?: React.ReactNode;
  refreshData?: () => void;
  loading?: boolean;
  className?: string;
}

const getSizeClasses = (size: ChartWidget["size"]) => {
  switch (size) {
    case "small":
      return "col-span-1 row-span-1";
    case "medium":
      return "col-span-2 row-span-1";
    case "large":
      return "col-span-2 row-span-2";
    case "full":
      return "col-span-full row-span-2";
    default:
      return "col-span-1 row-span-1";
  }
};

const getColorClasses = (color: MetricCard["color"] = "blue") => {
  switch (color) {
    case "green":
      return "bg-green-50 text-green-800 border-green-200";
    case "yellow":
      return "bg-yellow-50 text-yellow-800 border-yellow-200";
    case "red":
      return "bg-red-50 text-red-800 border-red-200";
    case "gray":
      return "bg-gray-50 text-gray-800 border-gray-200";
    default:
      return "bg-blue-50 text-blue-800 border-blue-200";
  }
};

export const DashboardTemplate: React.FC<DashboardTemplateProps> = ({
  title,
  subtitle,
  metrics,
  charts,
  quickActions = [],
  customContent,
  refreshData,
  loading = false,
  className = "",
}) => {
  return (
    <div className={`dashboard-template ${className}`}>
      <div className="dashboard-header bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
            {subtitle && <p className="text-gray-600 mt-1">{subtitle}</p>}
          </div>

          <div className="flex items-center space-x-3">
            {refreshData && (
              <button
                onClick={refreshData}
                disabled={loading}
                className="
                  px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300
                  rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500
                  disabled:opacity-50 disabled:cursor-not-allowed
                "
              >
                {loading ? "Refreshing..." : "Refresh"}
              </button>
            )}

            {quickActions.map((action) => (
              <button
                key={action.id}
                onClick={action.onClick}
                disabled={action.disabled}
                className="
                  flex items-center px-4 py-2 text-sm font-medium text-white
                  bg-blue-600 border border-transparent rounded-md shadow-sm
                  hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500
                  disabled:opacity-50 disabled:cursor-not-allowed
                "
              >
                {action.icon && <action.icon className="w-4 h-4 mr-2" />}
                {action.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="dashboard-content flex-1 overflow-auto bg-gray-50 p-6">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Metrics Grid */}
            {metrics.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {metrics.map((metric) => (
                  <div
                    key={metric.id}
                    className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">{metric.title}</p>
                        <p className="text-3xl font-bold text-gray-900 mt-2">{metric.value}</p>

                        {metric.change && (
                          <div className="mt-2 flex items-center">
                            <span
                              className={`
                                inline-flex items-center px-2 py-1 text-xs font-medium rounded-full
                                ${
                                  metric.change.type === "increase"
                                    ? "bg-green-100 text-green-800"
                                    : metric.change.type === "decrease"
                                      ? "bg-red-100 text-red-800"
                                      : "bg-gray-100 text-gray-800"
                                }
                              `}
                            >
                              {metric.change.type === "increase" && "↑"}
                              {metric.change.type === "decrease" && "↓"}
                              {metric.change.value}%
                            </span>
                            <span className="text-sm text-gray-500 ml-2">
                              vs {metric.change.period}
                            </span>
                          </div>
                        )}
                      </div>

                      {metric.icon && (
                        <div className={`p-3 rounded-lg ${getColorClasses(metric.color)}`}>
                          <metric.icon className="w-6 h-6" />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Charts Grid */}
            {charts.length > 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 auto-rows-fr">
                {charts.map((chart) => (
                  <div
                    key={chart.id}
                    className={`
                      bg-white rounded-lg shadow-sm border border-gray-200 p-6
                      ${getSizeClasses(chart.size)}
                    `}
                  >
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">{chart.title}</h3>
                    <div className="chart-container h-full">
                      <chart.component data={chart.data} />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Custom Content */}
            {customContent && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                {customContent}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
