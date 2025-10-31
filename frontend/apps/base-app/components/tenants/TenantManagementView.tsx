"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Users,
  Building2,
  Calendar,
  CheckCircle,
  XCircle,
  Search,
  ChevronRight,
  TrendingUp,
  Activity,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { platformConfig } from "@/lib/config";

const API_BASE = platformConfig.api.baseUrl;

interface Tenant {
  id: string;
  name: string;
  slug: string;
  status: string;
  created_at: string;
  subscription_tier?: string;
  user_count?: number;
  is_active: boolean;
}

interface TenantListResponse {
  items: Tenant[];
  total: number;
  page: number;
  size: number;
}

async function fetchTenants(page: number = 1, search?: string): Promise<TenantListResponse> {
  const params = new URLSearchParams({
    skip: String((page - 1) * 20),
    limit: "20",
  });

  if (search) {
    params.append("search", search);
  }

  const response = await fetch(`${API_BASE}/api/v1/tenants?${params}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch tenants");
  }

  return response.json();
}

export function TenantManagementView() {
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["partner-tenants", page, debouncedSearch],
    queryFn: () => fetchTenants(page, debouncedSearch),
  });

  const handleSearch = (value: string) => {
    setSearchQuery(value);
    const timer = setTimeout(() => {
      setDebouncedSearch(value);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "active":
        return "text-green-600 bg-green-100 dark:bg-green-950/20";
      case "suspended":
        return "text-yellow-600 bg-yellow-100 dark:bg-yellow-950/20";
      case "inactive":
      case "deleted":
        return "text-red-600 bg-red-100 dark:bg-red-950/20";
      default:
        return "text-gray-600 bg-gray-100 dark:bg-gray-950/20";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case "active":
        return <CheckCircle className="w-4 h-4" />;
      case "suspended":
      case "inactive":
      case "deleted":
        return <XCircle className="w-4 h-4" />;
      default:
        return <Activity className="w-4 h-4" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="space-y-2">
        <h1 className="text-3xl font-bold text-foreground">Managed Tenants</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          View and manage the ISP tenants in your partner network
        </p>
      </header>

      {/* Summary Stats */}
      {data && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Tenants</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.total}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Tenants</CardTitle>
              <Activity className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {data.items.filter((t) => t.is_active).length}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {data.items.reduce((acc, t) => acc + (t.user_count || 0), 0)}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Search */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search tenants by name or slug..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Tenant List */}
      <Card>
        <CardHeader>
          <CardTitle>Tenant Accounts</CardTitle>
          <CardDescription>
            {data?.total || 0} tenant{data?.total !== 1 ? "s" : ""} in your network
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">Loading tenants...</div>
          ) : error ? (
            <div className="text-center py-12">
              <div className="text-red-400">Failed to load tenants</div>
              <div className="text-sm text-muted-foreground mt-2">
                {error instanceof Error ? error.message : "Please try again"}
              </div>
            </div>
          ) : !data || data.items.length === 0 ? (
            <div className="text-center py-12">
              <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-50" />
              <div className="text-muted-foreground">No tenants found</div>
              {debouncedSearch && (
                <div className="text-sm text-muted-foreground mt-1">
                  Try a different search query
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {data.items.map((tenant) => (
                <Link
                  key={tenant.id}
                  href={`/partner/tenants/${tenant.id}`}
                  className="block group"
                >
                  <div className="flex items-center justify-between p-4 rounded-lg border border-border hover:border-primary/40 hover:bg-accent/50 transition-all">
                    <div className="flex items-start gap-4 flex-1">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Building2 className="w-5 h-5 text-primary" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-foreground truncate">
                            {tenant.name}
                          </h3>
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-medium ${getStatusColor(tenant.status)}`}
                          >
                            {getStatusIcon(tenant.status)}
                            {tenant.status}
                          </span>
                        </div>

                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span className="font-mono">@{tenant.slug}</span>
                          {tenant.subscription_tier && (
                            <span className="flex items-center gap-1">
                              <TrendingUp className="w-3 h-3" />
                              {tenant.subscription_tier}
                            </span>
                          )}
                          {tenant.user_count !== undefined && (
                            <span className="flex items-center gap-1">
                              <Users className="w-3 h-3" />
                              {tenant.user_count} users
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(tenant.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>

                    <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
                  </div>
                </Link>
              ))}
            </div>
          )}

          {/* Pagination */}
          {data && data.total > 20 && (
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-border">
              <div className="text-sm text-muted-foreground">
                Showing {(page - 1) * 20 + 1} to {Math.min(page * 20, data.total)} of {data.total}{" "}
                tenants
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page * 20 >= data.total}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
