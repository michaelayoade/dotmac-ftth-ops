"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FileText,
  Search,
  RefreshCw,
  AlertTriangle,
  Info,
  CheckCircle,
  XCircle,
  Clock,
  User,
  Activity,
  Eye,
  Shield,
} from "lucide-react";
import { platformConfig } from "@/lib/config";
import { useToast } from "@/components/ui/use-toast";
import { RouteGuard } from "@/components/auth/PermissionGuard";
import { formatDistanceToNow, format } from "date-fns";

type ActivityType =
  | "login"
  | "logout"
  | "create"
  | "update"
  | "delete"
  | "read"
  | "export"
  | "import"
  | "api_call"
  | "system"
  | "security"
  | "other";

type ActivitySeverity = "low" | "medium" | "high" | "critical";

interface AuditActivity {
  id: string;
  user_id: string;
  username?: string;
  tenant_id: string;
  activity_type: ActivityType;
  action: string;
  description: string;
  severity: ActivitySeverity;
  resource_type?: string;
  resource_id?: string;
  ip_address?: string;
  user_agent?: string;
  details?: any;
  created_at: string;
}

interface AuditStats {
  total_activities: number;
  low_severity: number;
  medium_severity: number;
  high_severity: number;
  critical_severity: number;
  recent_24h: number;
}

function AuditPageContent() {
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [daysFilter, setDaysFilter] = useState<number>(30);
  const { toast } = useToast();

  // Fetch audit activities
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["audit-activities", typeFilter, severityFilter, daysFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (typeFilter !== "all") params.append("activity_type", typeFilter);
      if (severityFilter !== "all") params.append("severity", severityFilter);
      params.append("days", daysFilter.toString());
      params.append("per_page", "100");

      const response = await fetch(
        `${platformConfig.api.baseUrl}/api/v1/audit/activities?${params.toString()}`,
        { credentials: "include" }
      );
      if (!response.ok) throw new Error("Failed to fetch audit activities");
      return response.json();
    },
  });

  const activities: AuditActivity[] = data?.activities || [];
  const total = data?.total || 0;

  // Calculate statistics
  const stats: AuditStats = {
    total_activities: activities.length,
    low_severity: activities.filter(a => a.severity === "low").length,
    medium_severity: activities.filter(a => a.severity === "medium").length,
    high_severity: activities.filter(a => a.severity === "high").length,
    critical_severity: activities.filter(a => a.severity === "critical").length,
    recent_24h: activities.filter(a => {
      const activityDate = new Date(a.created_at);
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      return activityDate >= yesterday;
    }).length,
  };

  const filteredActivities = activities.filter((activity) => {
    const matchesSearch =
      !searchQuery ||
      activity.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      activity.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (activity.username && activity.username.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (activity.resource_type && activity.resource_type.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchesSearch;
  });

  const getSeverityBadge = (severity: ActivitySeverity) => {
    const severityConfig: Record<ActivitySeverity, { icon: any; color: string; label: string }> = {
      low: { icon: Info, color: "bg-blue-100 text-blue-800", label: "Low" },
      medium: { icon: AlertTriangle, color: "bg-yellow-100 text-yellow-800", label: "Medium" },
      high: { icon: XCircle, color: "bg-orange-100 text-orange-800", label: "High" },
      critical: { icon: Shield, color: "bg-red-100 text-red-800", label: "Critical" },
    };

    const config = severityConfig[severity] || severityConfig.low;
    const Icon = config.icon;

    return (
      <Badge className={config.color}>
        <Icon className="h-3 w-3 mr-1" />
        {config.label}
      </Badge>
    );
  };

  const getActivityTypeIcon = (type: ActivityType) => {
    const icons: Record<ActivityType, any> = {
      login: User,
      logout: User,
      create: CheckCircle,
      update: Activity,
      delete: XCircle,
      read: Eye,
      export: FileText,
      import: FileText,
      api_call: Activity,
      system: Shield,
      security: Shield,
      other: FileText,
    };
    return icons[type] || FileText;
  };

  const getActivityTypeLabel = (type: ActivityType) => {
    return type.charAt(0).toUpperCase() + type.slice(1).replace(/_/g, " ");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Audit Logs</h1>
          <p className="text-sm text-muted-foreground">
            View and monitor system activity and security events
          </p>
        </div>
        <Button variant="outline" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total_activities}</div>
            <p className="text-xs text-muted-foreground">All activities</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Low</CardTitle>
            <Info className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.low_severity}</div>
            <p className="text-xs text-muted-foreground">Severity</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Medium</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.medium_severity}</div>
            <p className="text-xs text-muted-foreground">Severity</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">High</CardTitle>
            <XCircle className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.high_severity}</div>
            <p className="text-xs text-muted-foreground">Severity</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Critical</CardTitle>
            <Shield className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.critical_severity}</div>
            <p className="text-xs text-muted-foreground">Severity</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Last 24h</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.recent_24h}</div>
            <p className="text-xs text-muted-foreground">Recent</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-4 md:grid-cols-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search activities..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="login">Login</SelectItem>
                <SelectItem value="logout">Logout</SelectItem>
                <SelectItem value="create">Create</SelectItem>
                <SelectItem value="update">Update</SelectItem>
                <SelectItem value="delete">Delete</SelectItem>
                <SelectItem value="read">Read</SelectItem>
                <SelectItem value="api_call">API Call</SelectItem>
                <SelectItem value="security">Security</SelectItem>
              </SelectContent>
            </Select>

            <Select value={severityFilter} onValueChange={setSeverityFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Severities" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Severities</SelectItem>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
              </SelectContent>
            </Select>

            <Select value={daysFilter.toString()} onValueChange={(v) => setDaysFilter(parseInt(v))}>
              <SelectTrigger>
                <SelectValue placeholder="Time Range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Last 24 hours</SelectItem>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
                <SelectItem value="365">Last year</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Activities List */}
      <div className="grid gap-4">
        {isLoading ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              Loading audit activities...
            </CardContent>
          </Card>
        ) : filteredActivities.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              {searchQuery ? "No activities match your search" : "No activities found"}
            </CardContent>
          </Card>
        ) : (
          filteredActivities.map((activity) => {
            const TypeIcon = getActivityTypeIcon(activity.activity_type);
            return (
              <Card key={activity.id} className="hover:border-primary transition-colors">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      <TypeIcon className="h-6 w-6 text-primary mt-1" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <CardTitle className="text-base">{activity.action}</CardTitle>
                          {getSeverityBadge(activity.severity)}
                          <Badge variant="outline" className="text-xs">
                            {getActivityTypeLabel(activity.activity_type)}
                          </Badge>
                        </div>
                        <CardDescription className="mt-1">
                          {activity.description}
                        </CardDescription>
                      </div>
                    </div>
                    <div className="text-right text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3 md:grid-cols-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">User</p>
                      <p className="font-medium">{activity.username || activity.user_id}</p>
                    </div>
                    {activity.resource_type && (
                      <div>
                        <p className="text-muted-foreground">Resource Type</p>
                        <p className="font-medium">{activity.resource_type}</p>
                      </div>
                    )}
                    {activity.resource_id && (
                      <div>
                        <p className="text-muted-foreground">Resource ID</p>
                        <p className="font-medium font-mono text-xs truncate">{activity.resource_id}</p>
                      </div>
                    )}
                    {activity.ip_address && (
                      <div>
                        <p className="text-muted-foreground">IP Address</p>
                        <p className="font-medium font-mono">{activity.ip_address}</p>
                      </div>
                    )}
                  </div>

                  {activity.details && Object.keys(activity.details).length > 0 && (
                    <div className="mt-3 pt-3 border-t">
                      <p className="text-sm text-muted-foreground mb-2">Details</p>
                      <pre className="p-3 bg-accent rounded-lg overflow-x-auto text-xs">
                        {JSON.stringify(activity.details, null, 2)}
                      </pre>
                    </div>
                  )}

                  <div className="mt-3 pt-3 border-t text-xs text-muted-foreground">
                    <span>Timestamp: {format(new Date(activity.created_at), "PPpp")}</span>
                    {activity.user_agent && (
                      <span className="ml-4">User Agent: {activity.user_agent}</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {filteredActivities.length > 0 && (
        <div className="text-center text-sm text-muted-foreground">
          Showing {filteredActivities.length} of {total} activities
        </div>
      )}
    </div>
  );
}

export default function AuditPage() {
  return (
    <RouteGuard permission="security.audit.read">
      <AuditPageContent />
    </RouteGuard>
  );
}
