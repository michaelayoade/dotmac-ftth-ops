"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  Plus,
  Filter,
  Download,
  CheckCircle,
  Clock,
  AlertCircle,
  Loader2,
  Search,
  Calendar,
  DollarSign,
  FileText,
  Eye,
  Check,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useRouter } from "next/navigation";

import { RouteGuard } from "@/components/auth/PermissionGuard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@dotmac/ui";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@dotmac/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@dotmac/ui";
import { Input } from "@dotmac/ui";
import { Label } from "@dotmac/ui";
import { Textarea } from "@dotmac/ui";
import { useAppConfig } from "@/providers/AppConfigContext";
import { useToast } from "@dotmac/ui";
import { useConfirmDialog } from "@dotmac/ui";

// Types
interface ReconciliationSession {
  id: number;
  tenant_id: string;
  reconciliation_date: string;
  period_start: string;
  period_end: string;
  bank_account_id: number;
  opening_balance: number;
  closing_balance: number;
  statement_balance: number;
  total_deposits: number;
  total_withdrawals: number;
  unreconciled_count: number;
  discrepancy_amount: number;
  status: "in_progress" | "completed" | "approved";
  completed_by?: string;
  completed_at?: string;
  approved_by?: string;
  approved_at?: string;
  notes?: string;
  statement_file_url?: string;
  reconciled_items: Array<{
    payment_id: number;
    payment_reference: string;
    amount: number;
    reconciled_at: string;
    reconciled_by: string;
    notes?: string;
  }>;
  meta_data: Record<string, any>;
  created_at: string;
  updated_at: string;
}

interface ReconciliationSummary {
  period_days: number;
  total_sessions: number;
  approved_sessions: number;
  pending_sessions: number;
  total_discrepancies: number;
  total_reconciled_items: number;
  average_discrepancy: number;
}

interface ReconciliationStart {
  bank_account_id: number;
  period_start: string;
  period_end: string;
  opening_balance: number;
  statement_balance: number;
  statement_file_url?: string;
  notes?: string;
}

interface ReconciliationListResponse {
  items: ReconciliationSession[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

// API Functions
const buildApiBase = (apiBaseUrl: string) => `${apiBaseUrl}/api/v1/billing/reconciliations`;

const fetchReconciliations = async (
  apiBaseUrl: string,
  params: {
    page?: number;
    page_size?: number;
    bank_account_id?: number;
    status?: string;
    start_date?: string;
    end_date?: string;
    search?: string;
  },
): Promise<ReconciliationListResponse> => {
  const queryParams = new URLSearchParams();
  if (params.page) queryParams.append("page", params.page.toString());
  if (params.page_size) queryParams.append("page_size", params.page_size.toString());
  if (params.bank_account_id)
    queryParams.append("bank_account_id", params.bank_account_id.toString());
  if (params["status"] && params["status"] !== "all")
    queryParams.append("status", params["status"]);
  if (params.start_date) queryParams.append("start_date", params.start_date);
  if (params.end_date) queryParams.append("end_date", params.end_date);
  if (params.search) queryParams.append("search", params.search);

  const response = await fetch(`${buildApiBase(apiBaseUrl)}?${queryParams.toString()}`, {
    credentials: "include",
  });
  if (!response.ok) throw new Error("Failed to fetch reconciliations");
  return response.json();
};

const fetchReconciliationSummary = async (apiBaseUrl: string): Promise<ReconciliationSummary> => {
  const response = await fetch(`${buildApiBase(apiBaseUrl)}/summary`, {
    credentials: "include",
  });
  if (!response.ok) throw new Error("Failed to fetch reconciliation summary");
  return response.json();
};

const createReconciliation = async (
  apiBaseUrl: string,
  data: ReconciliationStart,
): Promise<ReconciliationSession> => {
  const response = await fetch(buildApiBase(apiBaseUrl), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error("Failed to create reconciliation");
  return response.json();
};

const completeReconciliation = async (
  apiBaseUrl: string,
  id: number,
): Promise<ReconciliationSession> => {
  const response = await fetch(`${buildApiBase(apiBaseUrl)}/${id}/complete`, {
    method: "POST",
    credentials: "include",
  });
  if (!response.ok) throw new Error("Failed to complete reconciliation");
  return response.json();
};

const approveReconciliation = async (
  apiBaseUrl: string,
  id: number,
): Promise<ReconciliationSession> => {
  const response = await fetch(`${buildApiBase(apiBaseUrl)}/${id}/approve`, {
    method: "POST",
    credentials: "include",
  });
  if (!response.ok) throw new Error("Failed to approve reconciliation");
  return response.json();
};

// Utility Functions
const formatMoney = (amountInCents: number): string => {
  return `$${(amountInCents / 100).toFixed(2)}`;
};

const getStatusBadge = (status: string) => {
  switch (status) {
    case "in_progress":
      return (
        <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300">
          In Progress
        </Badge>
      );
    case "completed":
      return (
        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300">
          Completed
        </Badge>
      );
    case "approved":
      return (
        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
          Approved
        </Badge>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
};

const getDiscrepancyColor = (amount: number): string => {
  const absAmount = Math.abs(amount);
  if (absAmount === 0) return "text-green-600";
  if (absAmount > 10000) return "text-red-600 font-semibold"; // > $100
  return "text-orange-600";
};

// Main Component
export default function ReconciliationPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const confirmDialog = useConfirmDialog();
  const { api } = useAppConfig();
  const apiBaseUrl = api.baseUrl;
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [filters, setFilters] = useState({
    bank_account_id: undefined as number | undefined,
    status: "all",
    start_date: "",
    end_date: "",
    search: "",
  });
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [createFormData, setCreateFormData] = useState<ReconciliationStart>({
    bank_account_id: 1,
    period_start: "",
    period_end: "",
    opening_balance: 0,
    statement_balance: 0,
    statement_file_url: "",
    notes: "",
  });

  // Queries
  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ["reconciliation-summary", apiBaseUrl],
    queryFn: () => fetchReconciliationSummary(apiBaseUrl),
    refetchInterval: 30000, // Auto-refresh every 30 seconds
  });

  const {
    data: reconciliations,
    isLoading: listLoading,
    refetch,
  } = useQuery({
    queryKey: ["reconciliations", apiBaseUrl, page, pageSize, filters],
    queryFn: () =>
      fetchReconciliations(apiBaseUrl, {
        page,
        page_size: pageSize,
        ...(filters.bank_account_id !== undefined && { bank_account_id: filters.bank_account_id }),
        ...(filters.status !== "all" && { status: filters.status }),
        ...(filters.start_date && { start_date: filters.start_date }),
        ...(filters.end_date && { end_date: filters.end_date }),
        ...(filters.search && { search: filters.search }),
      }),
    refetchInterval: 30000, // Auto-refresh every 30 seconds
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: ReconciliationStart) => createReconciliation(apiBaseUrl, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reconciliations"] });
      queryClient.invalidateQueries({ queryKey: ["reconciliation-summary"] });
      toast({ title: "Reconciliation session created successfully" });
      setIsCreateDialogOpen(false);
      resetCreateForm();
    },
    onError: (error: Error) => {
      toast({ title: `Failed to create reconciliation: ${error.message}`, variant: "destructive" });
    },
  });

  const completeMutation = useMutation({
    mutationFn: (id: number) => completeReconciliation(apiBaseUrl, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reconciliations"] });
      queryClient.invalidateQueries({ queryKey: ["reconciliation-summary"] });
      toast({ title: "Reconciliation completed successfully" });
    },
    onError: (error: Error) => {
      toast({
        title: `Failed to complete reconciliation: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const approveMutation = useMutation({
    mutationFn: (id: number) => approveReconciliation(apiBaseUrl, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reconciliations"] });
      queryClient.invalidateQueries({ queryKey: ["reconciliation-summary"] });
      toast({ title: "Reconciliation approved successfully" });
    },
    onError: (error: Error) => {
      toast({
        title: `Failed to approve reconciliation: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const resetCreateForm = () => {
    setCreateFormData({
      bank_account_id: 1,
      period_start: "",
      period_end: "",
      opening_balance: 0,
      statement_balance: 0,
      statement_file_url: "",
      notes: "",
    });
  };

  const handleCreateSubmit = () => {
    createMutation.mutate(createFormData);
  };

  const handleComplete = async (id: number) => {
    const confirmed = await confirmDialog({
      title: "Complete reconciliation",
      description: "Are you sure you want to complete this reconciliation?",
      confirmText: "Complete",
    });
    if (confirmed) {
      completeMutation.mutate(id);
    }
  };

  const handleApprove = async (id: number) => {
    const confirmed = await confirmDialog({
      title: "Approve reconciliation",
      description: "Are you sure you want to approve this reconciliation?",
      confirmText: "Approve",
    });
    if (confirmed) {
      approveMutation.mutate(id);
    }
  };

  return (
    <RouteGuard permission={["billing:write"]}>
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Payment Reconciliation</h1>
            <p className="text-muted-foreground">Manage and track bank statement reconciliations</p>
          </div>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                New Reconciliation
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create New Reconciliation Session</DialogTitle>
                <DialogDescription>
                  Start a new reconciliation session for a specific period and bank account.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="bank_account">Bank Account</Label>
                  <Select
                    value={createFormData.bank_account_id.toString()}
                    onValueChange={(value) =>
                      setCreateFormData({ ...createFormData, bank_account_id: parseInt(value) })
                    }
                  >
                    <SelectTrigger id="bank_account">
                      <SelectValue placeholder="Select bank account" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Main Operating Account</SelectItem>
                      <SelectItem value="2">Collections Account</SelectItem>
                      <SelectItem value="3">Payroll Account</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="period_start">Period Start</Label>
                    <Input
                      id="period_start"
                      type="datetime-local"
                      value={createFormData.period_start}
                      onChange={(e) =>
                        setCreateFormData({ ...createFormData, period_start: e.target.value })
                      }
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="period_end">Period End</Label>
                    <Input
                      id="period_end"
                      type="datetime-local"
                      value={createFormData.period_end}
                      onChange={(e) =>
                        setCreateFormData({ ...createFormData, period_end: e.target.value })
                      }
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="opening_balance">Opening Balance ($)</Label>
                    <Input
                      id="opening_balance"
                      type="number"
                      step="0.01"
                      value={createFormData.opening_balance / 100}
                      onChange={(e) =>
                        setCreateFormData({
                          ...createFormData,
                          opening_balance: Math.round(parseFloat(e.target.value) * 100),
                        })
                      }
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="statement_balance">Statement Balance ($)</Label>
                    <Input
                      id="statement_balance"
                      type="number"
                      step="0.01"
                      value={createFormData.statement_balance / 100}
                      onChange={(e) =>
                        setCreateFormData({
                          ...createFormData,
                          statement_balance: Math.round(parseFloat(e.target.value) * 100),
                        })
                      }
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="statement_file_url">Statement File URL (Optional)</Label>
                  <Input
                    id="statement_file_url"
                    type="url"
                    placeholder="https://..."
                    value={createFormData.statement_file_url}
                    onChange={(e) =>
                      setCreateFormData({ ...createFormData, statement_file_url: e.target.value })
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="notes">Notes (Optional)</Label>
                  <Textarea
                    id="notes"
                    placeholder="Add any relevant notes..."
                    value={createFormData.notes}
                    onChange={(e) =>
                      setCreateFormData({ ...createFormData, notes: e.target.value })
                    }
                    rows={3}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateSubmit} disabled={createMutation.isPending}>
                  {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create Reconciliation
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Summary Statistics */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Sessions</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {summaryLoading ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <>
                  <div className="text-2xl font-bold">{summary?.total_sessions || 0}</div>
                  <p className="text-xs text-muted-foreground">Last 30 days</p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Approved</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              {summaryLoading ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <>
                  <div className="text-2xl font-bold">{summary?.approved_sessions || 0}</div>
                  <p className="text-xs text-muted-foreground">
                    {summary?.total_sessions
                      ? ((summary.approved_sessions / summary.total_sessions) * 100).toFixed(1)
                      : 0}
                    % of total
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending</CardTitle>
              <Clock className="h-4 w-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              {summaryLoading ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <>
                  <div className="text-2xl font-bold">{summary?.pending_sessions || 0}</div>
                  <p className="text-xs text-muted-foreground">Awaiting completion/approval</p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Discrepancies</CardTitle>
              <AlertCircle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              {summaryLoading ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <>
                  <div className="text-2xl font-bold">
                    {formatMoney(summary?.total_discrepancies || 0)}
                  </div>
                  <p className="text-xs text-muted-foreground">Across all sessions</p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Reconciled Items</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {summaryLoading ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <>
                  <div className="text-2xl font-bold">{summary?.total_reconciled_items || 0}</div>
                  <p className="text-xs text-muted-foreground">Total payments matched</p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Discrepancy</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {summaryLoading ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <>
                  <div className="text-2xl font-bold">
                    {formatMoney(summary?.average_discrepancy || 0)}
                  </div>
                  <p className="text-xs text-muted-foreground">Per session</p>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Filters Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Filter className="mr-2 h-4 w-4" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
              <div className="grid gap-2">
                <Label htmlFor="filter_bank_account">Bank Account</Label>
                <Select
                  value={filters.bank_account_id?.toString() || "all"}
                  onValueChange={(value) =>
                    setFilters({
                      ...filters,
                      bank_account_id: value === "all" ? undefined : parseInt(value),
                    })
                  }
                >
                  <SelectTrigger id="filter_bank_account">
                    <SelectValue placeholder="All accounts" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Accounts</SelectItem>
                    <SelectItem value="1">Main Operating Account</SelectItem>
                    <SelectItem value="2">Collections Account</SelectItem>
                    <SelectItem value="3">Payroll Account</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="filter_status">Status</Label>
                <Select
                  value={filters.status}
                  onValueChange={(value) => setFilters({ ...filters, status: value })}
                >
                  <SelectTrigger id="filter_status">
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="filter_start_date">Start Date</Label>
                <Input
                  id="filter_start_date"
                  type="date"
                  value={filters.start_date}
                  onChange={(e) => setFilters({ ...filters, start_date: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="filter_end_date">End Date</Label>
                <Input
                  id="filter_end_date"
                  type="date"
                  value={filters.end_date}
                  onChange={(e) => setFilters({ ...filters, end_date: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="filter_search">Search by ID</Label>
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="filter_search"
                    placeholder="Search..."
                    className="pl-8"
                    value={filters.search}
                    onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Reconciliation Sessions Table */}
        <Card>
          <CardHeader>
            <CardTitle>Reconciliation Sessions</CardTitle>
            <CardDescription>View and manage all reconciliation sessions</CardDescription>
          </CardHeader>
          <CardContent>
            {listLoading ? (
              <div className="flex justify-center items-center py-8">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : reconciliations?.items.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No reconciliation sessions found
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Reconciliation Date</TableHead>
                      <TableHead>Period</TableHead>
                      <TableHead>Bank Account</TableHead>
                      <TableHead className="text-right">Opening Balance</TableHead>
                      <TableHead className="text-right">Closing Balance</TableHead>
                      <TableHead className="text-right">Statement Balance</TableHead>
                      <TableHead className="text-right">Discrepancy</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Unreconciled</TableHead>
                      <TableHead>Completed By/At</TableHead>
                      <TableHead>Approved By/At</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reconciliations?.items.map((session) => (
                      <TableRow key={session.id}>
                        <TableCell className="font-medium">#{session.id}</TableCell>
                        <TableCell>
                          {format(new Date(session.reconciliation_date), "MMM dd, yyyy")}
                        </TableCell>
                        <TableCell className="text-sm">
                          {format(new Date(session.period_start), "MMM dd")} -{" "}
                          {format(new Date(session.period_end), "MMM dd, yyyy")}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">Account #{session.bank_account_id}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatMoney(session.opening_balance)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatMoney(session.closing_balance)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatMoney(session.statement_balance)}
                        </TableCell>
                        <TableCell
                          className={`text-right font-mono ${getDiscrepancyColor(
                            session.discrepancy_amount,
                          )}`}
                        >
                          {formatMoney(session.discrepancy_amount)}
                        </TableCell>
                        <TableCell>{getStatusBadge(session.status)}</TableCell>
                        <TableCell>
                          {session.unreconciled_count > 0 && (
                            <Badge variant="destructive">{session.unreconciled_count}</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          {session.completed_by && session.completed_at ? (
                            <div>
                              <div className="font-medium">{session.completed_by}</div>
                              <div className="text-muted-foreground text-xs">
                                {format(new Date(session.completed_at), "MMM dd, HH:mm")}
                              </div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          {session.approved_by && session.approved_at ? (
                            <div>
                              <div className="font-medium">{session.approved_by}</div>
                              <div className="text-muted-foreground text-xs">
                                {format(new Date(session.approved_at), "MMM dd, HH:mm")}
                              </div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-2 justify-end">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                router.push(
                                  `/dashboard/billing-revenue/reconciliation/${session.id}`,
                                )
                              }
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {session.status === "in_progress" && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleComplete(session.id)}
                                disabled={completeMutation.isPending}
                              >
                                {completeMutation.isPending ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <CheckCircle className="h-4 w-4" />
                                )}
                              </Button>
                            )}
                            {session.status === "completed" && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleApprove(session.id)}
                                disabled={approveMutation.isPending}
                              >
                                {approveMutation.isPending ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Check className="h-4 w-4" />
                                )}
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {/* Pagination */}
                {reconciliations && reconciliations.total_pages > 1 && (
                  <div className="flex items-center justify-between mt-4">
                    <div className="text-sm text-muted-foreground">
                      Showing {(page - 1) * pageSize + 1} to{" "}
                      {Math.min(page * pageSize, reconciliations.total)} of {reconciliations.total}{" "}
                      results
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(page - 1)}
                        disabled={page === 1}
                      >
                        <ChevronLeft className="h-4 w-4" />
                        Previous
                      </Button>
                      <div className="flex items-center gap-1">
                        {Array.from({ length: reconciliations.total_pages }, (_, i) => i + 1)
                          .filter((p) => {
                            return (
                              p === 1 ||
                              p === reconciliations.total_pages ||
                              (p >= page - 1 && p <= page + 1)
                            );
                          })
                          .map((p, idx, arr) => (
                            <React.Fragment key={p}>
                              {idx > 0 && arr[idx - 1] !== p - 1 && (
                                <span className="px-2">...</span>
                              )}
                              <Button
                                variant={p === page ? "default" : "outline"}
                                size="sm"
                                onClick={() => setPage(p)}
                              >
                                {p}
                              </Button>
                            </React.Fragment>
                          ))}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(page + 1)}
                        disabled={page === reconciliations.total_pages}
                      >
                        Next
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </RouteGuard>
  );
}
