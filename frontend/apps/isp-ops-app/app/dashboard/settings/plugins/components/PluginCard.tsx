"use client";

import { useState } from "react";
import {
  Puzzle,
  Plus,
  Settings,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ExternalLink,
  Tag,
  Users,
  Clock,
  Activity,
  Shield,
  Zap,
  Search,
  TrendingUp,
} from "lucide-react";

import type { PluginConfig, PluginInstance, PluginStatus, PluginType } from "@/hooks/usePlugins";

interface PluginCardProps {
  plugin: PluginConfig;
  instances: PluginInstance[];
  onInstall: (plugin: PluginConfig) => void;
}

const getTypeIcon = (type: PluginType) => {
  switch (type) {
    case "notification":
      return <Activity className="h-5 w-5 text-sky-400" />;
    case "integration":
      return <Zap className="h-5 w-5 text-amber-400" />;
    case "payment":
      return <Shield className="h-5 w-5 text-emerald-400" />;
    case "storage":
      return <Settings className="h-5 w-5 text-purple-400" />;
    case "search":
      return <Search className="h-5 w-5 text-teal-400" />;
    case "analytics":
      return <TrendingUp className="h-5 w-5 text-emerald-400" />;
    case "authentication":
      return <Users className="h-5 w-5 text-indigo-400" />;
    case "workflow":
      return <Clock className="h-5 w-5 text-orange-400" />;
    default:
      return <Puzzle className="h-5 w-5 text-muted-foreground" />;
  }
};

const getTypeColor = (type: PluginType) => {
  switch (type) {
    case "notification":
      return "bg-sky-500/10 text-sky-400 border-sky-500/20";
    case "integration":
      return "bg-amber-500/10 text-amber-400 border-amber-500/20";
    case "payment":
      return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
    case "storage":
      return "bg-purple-500/10 text-purple-400 border-purple-500/20";
    case "search":
      return "bg-teal-500/10 text-teal-400 border-teal-500/20";
    case "analytics":
      return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
    case "authentication":
      return "bg-indigo-500/10 text-indigo-400 border-indigo-500/20";
    case "workflow":
      return "bg-orange-500/10 text-orange-400 border-orange-500/20";
    default:
      return "bg-muted/10 text-muted-foreground border-border";
  }
};

const getStatusColor = (status: PluginStatus) => {
  switch (status) {
    case "active":
      return "bg-emerald-500/10 text-emerald-400";
    case "inactive":
      return "bg-card0/10 text-muted-foreground";
    case "error":
      return "bg-rose-500/10 text-rose-400";
    case "configured":
      return "bg-sky-500/10 text-sky-400";
    case "registered":
      return "bg-muted/10 text-muted-foreground";
    default:
      return "bg-card0/10 text-muted-foreground";
  }
};

export const PluginCard = ({ plugin, instances, onInstall }: PluginCardProps) => {
  const [showDetails, setShowDetails] = useState(false);

  const activeInstances = instances.filter((i) => i.status === "active");
  const errorInstances = instances.filter((i) => i.status === "error");
  const totalInstances = instances.length;

  const fieldGroups = plugin.fields.reduce(
    (groups, field) => {
      const group = field.group || "Configuration";
      groups[group] = (groups[group] || 0) + 1;
      return groups;
    },
    {} as Record<string, number>,
  );

  const requiredFields = plugin.fields.filter((f) => f.required).length;
  const secretFields = plugin.fields.filter((f) => f.is_secret).length;

  return (
    <div
      className="bg-card/50 border border-border rounded-lg hover:border-border transition-colors"
      data-testid="plugin-card"
    >
      {/* Card Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0">{getTypeIcon(plugin.type)}</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-medium text-foreground truncate" data-testid="plugin-name">
                  {plugin.name}
                </h3>
                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                  {plugin.description}
                </p>
              </div>
              <div
                className={`px-2 py-1 rounded-full text-xs font-medium border ${getTypeColor(plugin.type)}`}
              >
                {plugin.type}
              </div>
            </div>
          </div>
        </div>

        {/* Plugin Metadata */}
        <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
          <span>v{plugin.version}</span>
          {plugin.author && <span>by {plugin.author}</span>}
          <span>{plugin.fields.length} fields</span>
        </div>

        {/* Tags */}
        {plugin.tags && plugin.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {plugin.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="px-2 py-0.5 bg-accent text-xs rounded-full text-muted-foreground"
              >
                {tag}
              </span>
            ))}
            {plugin.tags.length > 3 && (
              <span className="px-2 py-0.5 bg-accent text-xs rounded-full text-muted-foreground">
                +{plugin.tags.length - 3} more
              </span>
            )}
          </div>
        )}
      </div>

      {/* Instances Status */}
      {totalInstances > 0 && (
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Instances</span>
            <div className="flex items-center gap-2">
              {activeInstances.length > 0 && (
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                  <span className="text-emerald-400">{activeInstances.length}</span>
                </div>
              )}
              {errorInstances.length > 0 && (
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-rose-500 rounded-full"></div>
                  <span className="text-rose-400">{errorInstances.length}</span>
                </div>
              )}
              <span className="text-muted-foreground">of {totalInstances}</span>
            </div>
          </div>

          {/* Recent Instances */}
          <div className="mt-2 space-y-1">
            {instances.slice(0, 2).map((instance) => (
              <div key={instance.id} className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground truncate">{instance.instance_name}</span>
                <span className={`px-2 py-0.5 rounded-full ${getStatusColor(instance.status)}`}>
                  {instance.status}
                </span>
              </div>
            ))}
            {instances.length > 2 && (
              <div className="text-xs text-muted-foreground text-center">
                +{instances.length - 2} more instances
              </div>
            )}
          </div>
        </div>
      )}

      {/* Plugin Details (Expandable) */}
      {showDetails && (
        <div className="p-4 border-b border-border space-y-3">
          {/* Configuration Overview */}
          <div>
            <h4 className="text-sm font-medium text-foreground mb-2">Configuration</h4>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Total Fields</span>
                <span className="text-foreground">{plugin.fields.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Required</span>
                <span className="text-foreground">{requiredFields}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Secrets</span>
                <span className="text-foreground">{secretFields}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Groups</span>
                <span className="text-foreground">{Object.keys(fieldGroups).length}</span>
              </div>
            </div>
          </div>

          {/* Field Groups */}
          {Object.keys(fieldGroups).length > 1 && (
            <div>
              <h4 className="text-sm font-medium text-foreground mb-2">Field Groups</h4>
              <div className="space-y-1">
                {Object.entries(fieldGroups).map(([group, count]) => (
                  <div key={group} className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{group}</span>
                    <span className="text-foreground">{count} fields</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Features */}
          <div>
            <h4 className="text-sm font-medium text-foreground mb-2">Features</h4>
            <div className="flex flex-wrap gap-2">
              {plugin.supports_health_check && (
                <div className="flex items-center gap-1 px-2 py-1 bg-emerald-500/10 text-emerald-400 rounded-full text-xs">
                  <Activity className="h-3 w-3" />
                  Health Check
                </div>
              )}
              {plugin.supports_test_connection && (
                <div className="flex items-center gap-1 px-2 py-1 bg-sky-500/10 text-sky-400 rounded-full text-xs">
                  <Zap className="h-3 w-3" />
                  Test Connection
                </div>
              )}
              {secretFields > 0 && (
                <div className="flex items-center gap-1 px-2 py-1 bg-amber-500/10 text-amber-400 rounded-full text-xs">
                  <Shield className="h-3 w-3" />
                  Secure Config
                </div>
              )}
            </div>
          </div>

          {/* Dependencies */}
          {plugin.dependencies && plugin.dependencies.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-foreground mb-2">Dependencies</h4>
              <div className="flex flex-wrap gap-1">
                {plugin.dependencies.slice(0, 4).map((dep) => (
                  <span
                    key={dep}
                    className="px-2 py-0.5 bg-accent text-xs rounded text-muted-foreground"
                  >
                    {dep}
                  </span>
                ))}
                {plugin.dependencies.length > 4 && (
                  <span className="px-2 py-0.5 bg-accent text-xs rounded text-muted-foreground">
                    +{plugin.dependencies.length - 4} more
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Card Footer */}
      <div className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {showDetails ? "Hide Details" : "Show Details"}
            </button>
            {plugin.homepage && (
              <a
                href={plugin.homepage}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
              >
                <ExternalLink className="h-3 w-3" />
                Docs
              </a>
            )}
          </div>

          <button
            onClick={() => onInstall(plugin)}
            className="px-3 py-1.5 bg-sky-500 hover:bg-sky-600 text-white text-sm rounded-lg transition-colors flex items-center gap-1.5"
            data-testid="install-plugin-button"
          >
            <Plus className="h-4 w-4" />
            Add Instance
          </button>
        </div>
      </div>
    </div>
  );
};
