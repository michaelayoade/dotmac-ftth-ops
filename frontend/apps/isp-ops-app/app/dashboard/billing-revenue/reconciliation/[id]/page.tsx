"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";
import {
  ArrowLeft,
  CheckCircle,
  Clock,
  AlertTriangle,
  Loader2,
  Download,
  Plus,
  FileText,
  DollarSign,
  Calendar,
  TrendingUp,
  Check,
  X,
  Info,
} from "lucide-react";
import { useRouter, useParams } from "next/navigation";

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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@dotmac/ui";
import { Input } from "@dotmac/ui";
import { Label } from "@dotmac/ui";
import { Textarea } from "@dotmac/ui";
import { Alert, AlertDescription, AlertTitle } from "@dotmac/ui";
import { Separator } from "@dotmac/ui";
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

interface ReconcilePaymentRequest {
  payment_id: number;
  notes?: string;
}

// API Functions
const buildApiBase = (apiBaseUrl: string) => `${apiBaseUrl}/api/v1/billing/reconciliations`;

const fetchReconciliation = async (
  apiBaseUrl: string,
  id: string,
): Promise<ReconciliationSession> => {
  const response = await fetch(`${buildApiBase(apiBaseUrl)}/${id}`, {
    credentials: "include",
  });
  if (!response.ok) throw new Error("Failed to fetch reconciliation");
  return response.json();
};

const addPaymentToReconciliation = async (
  apiBaseUrl: string,
  id: string,
  data: ReconcilePaymentRequest,
): Promise<ReconciliationSession> => {
  const response = await fetch(`${buildApiBase(apiBaseUrl)}/${id}/payments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error("Failed to add payment to reconciliation");
  return response.json();
};

const completeReconciliation = async (
  apiBaseUrl: string,
  id: string,
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
  id: string,
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
          <Clock className="mr-1 h-3 w-3" />
          In Progress
        </Badge>
      );
    case "completed":
      return (
        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300">
          <CheckCircle className="mr-1 h-3 w-3" />
          Completed
        </Badge>
      );
    case "approved":
      return (
        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
          <Check className="mr-1 h-3 w-3" />
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
  if (absAmount > 10000) return "text-red-600"; // > $100
  return "text-orange-600";
};

const getDiscrepancyIcon = (amount: number) => {
  const absAmount = Math.abs(amount);
  if (absAmount === 0) return <CheckCircle className="h-5 w-5 text-green-600" />;
  if (absAmount > 10000) return <AlertTriangle className="h-5 w-5 text-red-600" />;
  return <Info className="h-5 w-5 text-orange-600" />;
};

// Main Component
export default function ReconciliationDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params["id"] as string;
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const confirmDialog = useConfirmDialog();
  const { api } = useAppConfig();
  const apiBaseUrl = api.baseUrl;
  const [activeTab, setActiveTab] = useState("overview");
  const [isAddPaymentDialogOpen, setIsAddPaymentDialogOpen] = useState(false);
  const [addPaymentForm, setAddPaymentForm] = useState<ReconcilePaymentRequest>({
    payment_id: 0,
    notes: "",
  });

  // Query
  const {
    data: reconciliation,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["reconciliation", apiBaseUrl, id],
    queryFn: () => fetchReconciliation(apiBaseUrl, id),
    refetchInterval: (query) => {
      // Refetch every 15 seconds if in_progress
      return query?.state?.data?.status === "in_progress" ? 15000 : false;
    },
  });

  // Mutations
  const addPaymentMutation = useMutation({
    mutationFn: (data: ReconcilePaymentRequest) => addPaymentToReconciliation(apiBaseUrl, id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reconciliation", id] });
      queryClient.invalidateQueries({ queryKey: ["reconciliations"] });
      toast({ title: "Payment added to reconciliation successfully" });
      setIsAddPaymentDialogOpen(false);
      setAddPaymentForm({ payment_id: 0, notes: "" });
    },
    onError: (error: Error) => {
      toast({ title: `Failed to add payment: ${error.message}`, variant: "destructive" });
    },
  });

  const completeMutation = useMutation({
    mutationFn: () => completeReconciliation(apiBaseUrl, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reconciliation", id] });
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
    mutationFn: () => approveReconciliation(apiBaseUrl, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reconciliation", id] });
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

  const handleComplete = async () => {
    const confirmed = await confirmDialog({
      title: "Complete reconciliation",
      description:
        "Are you sure you want to complete this reconciliation? This will lock the reconciled payments.",
      confirmText: "Complete",
    });
    if (confirmed) {
      completeMutation.mutate();
    }
  };

  const handleApprove = async () => {
    const confirmed = await confirmDialog({
      title: "Approve reconciliation",
      description:
        "Are you sure you want to approve this reconciliation? This action requires finance team authority.",
      confirmText: "Approve",
    });
    if (confirmed) {
      approveMutation.mutate();
    }
  };

  const handleAddPayment = () => {
    if (!addPaymentForm.payment_id) {
      toast({ title: "Please enter a valid payment ID", variant: "destructive" });
      return;
    }
    addPaymentMutation.mutate(addPaymentForm);
  };

  if (isLoading) {
    return (
      <RouteGuard permission={["billing:write"]}>
        <div className="flex justify-center items-center h-screen">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </RouteGuard>
    );
  }

  if (!reconciliation) {
    return (
      <RouteGuard permission={["billing:write"]}>
        <div className="container mx-auto p-6">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>Reconciliation session not found</AlertDescription>
          </Alert>
        </div>
      </RouteGuard>
    );
  }

  // Calculate discrepancy percentage
  const discrepancyPercentage = reconciliation.statement_balance
    ? (Math.abs(reconciliation.discrepancy_amount) / reconciliation.statement_balance) * 100
    : 0;

  // Calculate total reconciled amount
  const totalReconciledAmount = reconciliation.reconciled_items.reduce(
    (sum, item) => sum + item.amount,
    0,
  );

  return (
    <RouteGuard permission={["billing:write"]}>
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => router.back()}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold">Reconciliation #{reconciliation.id}</h1>
                {getStatusBadge(reconciliation.status)}
              </div>
              <p className="text-muted-foreground">
                Created {formatDistanceToNow(new Date(reconciliation.created_at))} ago
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {reconciliation.statement_file_url && (
              <Button variant="outline" asChild>
                <a
                  href={reconciliation.statement_file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download Statement
                </a>
              </Button>
            )}
          </div>
        </div>

        {/* Quick Info Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Period Info</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div>
                  <div className="text-xs text-muted-foreground">Period</div>
                  <div className="text-sm font-medium">
                    {format(new Date(reconciliation.period_start), "MMM dd")} -{" "}
                    {format(new Date(reconciliation.period_end), "MMM dd, yyyy")}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Reconciliation Date</div>
                  <div className="text-sm font-medium">
                    {format(new Date(reconciliation.reconciliation_date), "MMM dd, yyyy")}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Balances</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-xs text-muted-foreground">Opening:</span>
                  <span className="text-sm font-mono font-medium">
                    {formatMoney(reconciliation.opening_balance)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-muted-foreground">Closing:</span>
                  <span className="text-sm font-mono font-medium">
                    {formatMoney(reconciliation.closing_balance)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-muted-foreground">Statement:</span>
                  <span className="text-sm font-mono font-medium">
                    {formatMoney(reconciliation.statement_balance)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Discrepancy</CardTitle>
              {getDiscrepancyIcon(reconciliation.discrepancy_amount)}
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div>
                  <div className="text-xs text-muted-foreground">Amount</div>
                  <div
                    className={`text-2xl font-bold font-mono ${getDiscrepancyColor(
                      reconciliation.discrepancy_amount,
                    )}`}
                  >
                    {formatMoney(reconciliation.discrepancy_amount)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Percentage</div>
                  <div className="text-sm font-medium">{discrepancyPercentage.toFixed(2)}%</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Status</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div>
                  <div className="text-xs text-muted-foreground">Current Status</div>
                  <div className="mt-1">{getStatusBadge(reconciliation.status)}</div>
                </div>
                {reconciliation.unreconciled_count > 0 && (
                  <div>
                    <div className="text-xs text-muted-foreground">Unreconciled</div>
                    <Badge variant="destructive" className="mt-1">
                      {reconciliation.unreconciled_count} items
                    </Badge>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Discrepancy Alert */}
        {Math.abs(reconciliation.discrepancy_amount) > 0 && (
          <Alert
            variant={
              Math.abs(reconciliation.discrepancy_amount) > 10000 ? "destructive" : "default"
            }
          >
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Discrepancy Detected</AlertTitle>
            <AlertDescription>
              There is a discrepancy of {formatMoney(Math.abs(reconciliation.discrepancy_amount))}{" "}
              between the calculated closing balance and the statement balance.
              {Math.abs(reconciliation.discrepancy_amount) > 10000 &&
                " This is a significant discrepancy that requires immediate attention."}
            </AlertDescription>
          </Alert>
        )}

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="payments">
              Reconciled Payments
              <Badge variant="secondary" className="ml-2">
                {reconciliation.reconciled_items.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="actions">Actions</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Reconciliation Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label className="text-muted-foreground">Reconciliation ID</Label>
                    <div className="text-lg font-medium">#{reconciliation.id}</div>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Bank Account</Label>
                    <div className="text-lg font-medium">
                      <Badge variant="outline">Account #{reconciliation.bank_account_id}</Badge>
                    </div>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Reconciliation Date</Label>
                    <div className="text-lg font-medium">
                      {format(new Date(reconciliation.reconciliation_date), "MMMM dd, yyyy")}
                    </div>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Period</Label>
                    <div className="text-lg font-medium">
                      {format(new Date(reconciliation.period_start), "MMM dd, yyyy")} -{" "}
                      {format(new Date(reconciliation.period_end), "MMM dd, yyyy")}
                    </div>
                  </div>
                </div>
                <Separator />
                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <Label className="text-muted-foreground">Opening Balance</Label>
                    <div className="text-2xl font-bold font-mono">
                      {formatMoney(reconciliation.opening_balance)}
                    </div>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Closing Balance</Label>
                    <div className="text-2xl font-bold font-mono">
                      {formatMoney(reconciliation.closing_balance)}
                    </div>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Statement Balance</Label>
                    <div className="text-2xl font-bold font-mono">
                      {formatMoney(reconciliation.statement_balance)}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Discrepancy Analysis</CardTitle>
                <CardDescription>
                  Breakdown of the balance calculation and discrepancy
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <Label className="text-muted-foreground">Total Deposits</Label>
                      <div className="text-xl font-bold font-mono text-green-600">
                        +{formatMoney(reconciliation.total_deposits)}
                      </div>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Total Withdrawals</Label>
                      <div className="text-xl font-bold font-mono text-red-600">
                        -{formatMoney(reconciliation.total_withdrawals)}
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div className="bg-muted p-4 rounded-lg space-y-2">
                    <h4 className="font-semibold">Balance Calculation:</h4>
                    <div className="space-y-1 font-mono text-sm">
                      <div className="flex justify-between">
                        <span>Opening Balance:</span>
                        <span>{formatMoney(reconciliation.opening_balance)}</span>
                      </div>
                      <div className="flex justify-between text-green-600">
                        <span>+ Deposits:</span>
                        <span>{formatMoney(reconciliation.total_deposits)}</span>
                      </div>
                      <div className="flex justify-between text-red-600">
                        <span>- Withdrawals:</span>
                        <span>{formatMoney(reconciliation.total_withdrawals)}</span>
                      </div>
                      <Separator />
                      <div className="flex justify-between font-bold">
                        <span>Calculated Closing:</span>
                        <span>{formatMoney(reconciliation.closing_balance)}</span>
                      </div>
                      <div className="flex justify-between font-bold text-blue-600">
                        <span>Statement Balance:</span>
                        <span>{formatMoney(reconciliation.statement_balance)}</span>
                      </div>
                      <Separator />
                      <div
                        className={`flex justify-between font-bold text-lg ${getDiscrepancyColor(
                          reconciliation.discrepancy_amount,
                        )}`}
                      >
                        <span>Discrepancy:</span>
                        <span>{formatMoney(reconciliation.discrepancy_amount)}</span>
                      </div>
                    </div>
                  </div>

                  {Math.abs(reconciliation.discrepancy_amount) === 0 && (
                    <Alert>
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <AlertTitle>Perfect Balance</AlertTitle>
                      <AlertDescription>
                        The calculated closing balance matches the statement balance exactly. No
                        discrepancy detected.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              </CardContent>
            </Card>

            {reconciliation.notes && (
              <Card>
                <CardHeader>
                  <CardTitle>Notes</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm whitespace-pre-wrap">{reconciliation.notes}</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Reconciled Payments Tab */}
          <TabsContent value="payments" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Reconciled Payments</CardTitle>
                  <CardDescription>
                    Payments that have been matched to this reconciliation
                  </CardDescription>
                </div>
                {reconciliation.status === "in_progress" && (
                  <Dialog open={isAddPaymentDialogOpen} onOpenChange={setIsAddPaymentDialogOpen}>
                    <DialogTrigger asChild>
                      <Button>
                        <Plus className="mr-2 h-4 w-4" />
                        Add Payment
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Add Payment to Reconciliation</DialogTitle>
                        <DialogDescription>
                          Link a payment to this reconciliation session
                        </DialogDescription>
                      </DialogHeader>
                      <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                          <Label htmlFor="payment_id">Payment ID</Label>
                          <Input
                            id="payment_id"
                            type="number"
                            placeholder="Enter payment ID"
                            value={addPaymentForm.payment_id || ""}
                            onChange={(e) =>
                              setAddPaymentForm({
                                ...addPaymentForm,
                                payment_id: parseInt(e.target.value) || 0,
                              })
                            }
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="payment_notes">Notes (Optional)</Label>
                          <Textarea
                            id="payment_notes"
                            placeholder="Add any notes about this payment..."
                            value={addPaymentForm.notes}
                            onChange={(e) =>
                              setAddPaymentForm({ ...addPaymentForm, notes: e.target.value })
                            }
                            rows={3}
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setIsAddPaymentDialogOpen(false)}>
                          Cancel
                        </Button>
                        <Button onClick={handleAddPayment} disabled={addPaymentMutation.isPending}>
                          {addPaymentMutation.isPending && (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          )}
                          Add Payment
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                )}
              </CardHeader>
              <CardContent>
                {reconciliation.reconciled_items.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No payments reconciled yet</p>
                    {reconciliation.status === "in_progress" && (
                      <p className="text-sm mt-2">
                        Click &quot;Add Payment&quot; to start reconciling
                      </p>
                    )}
                  </div>
                ) : (
                  <>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Payment ID</TableHead>
                          <TableHead>Reference</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                          <TableHead>Reconciled At</TableHead>
                          <TableHead>Reconciled By</TableHead>
                          <TableHead>Notes</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {reconciliation.reconciled_items.map((item) => (
                          <TableRow key={item.payment_id}>
                            <TableCell className="font-medium">#{item.payment_id}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{item.payment_reference}</Badge>
                            </TableCell>
                            <TableCell className="text-right font-mono font-medium">
                              {formatMoney(item.amount)}
                            </TableCell>
                            <TableCell>
                              {format(new Date(item.reconciled_at), "MMM dd, yyyy HH:mm")}
                            </TableCell>
                            <TableCell>{item.reconciled_by}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {item.notes || "-"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>

                    <Separator className="my-4" />

                    <div className="flex justify-between items-center">
                      <div className="text-sm text-muted-foreground">
                        Total: {reconciliation.reconciled_items.length} payment(s)
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-muted-foreground">Total Amount</div>
                        <div className="text-2xl font-bold font-mono">
                          {formatMoney(totalReconciledAmount)}
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Actions Tab */}
          <TabsContent value="actions" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Available Actions</CardTitle>
                <CardDescription>Perform actions on this reconciliation session</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {reconciliation.status === "in_progress" && (
                  <Alert>
                    <Clock className="h-4 w-4" />
                    <AlertTitle>Complete Reconciliation</AlertTitle>
                    <AlertDescription className="mt-2 space-y-2">
                      <p>
                        This reconciliation is currently in progress. Once you have finished
                        reconciling all payments, you can complete the session.
                      </p>
                      <Button
                        onClick={handleComplete}
                        disabled={completeMutation.isPending}
                        className="mt-2"
                      >
                        {completeMutation.isPending && (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        )}
                        <CheckCircle className="mr-2 h-4 w-4" />
                        Complete Reconciliation
                      </Button>
                    </AlertDescription>
                  </Alert>
                )}

                {reconciliation.status === "completed" && (
                  <Alert>
                    <CheckCircle className="h-4 w-4" />
                    <AlertTitle>Approve Reconciliation</AlertTitle>
                    <AlertDescription className="mt-2 space-y-2">
                      <p>
                        This reconciliation has been completed and is ready for approval. Finance
                        team members can approve this session to finalize it.
                      </p>
                      <Button
                        onClick={handleApprove}
                        disabled={approveMutation.isPending}
                        className="mt-2"
                      >
                        {approveMutation.isPending && (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        )}
                        <Check className="mr-2 h-4 w-4" />
                        Approve Reconciliation
                      </Button>
                    </AlertDescription>
                  </Alert>
                )}

                {reconciliation.status === "approved" && (
                  <Alert>
                    <Check className="h-4 w-4 text-green-600" />
                    <AlertTitle>Approved</AlertTitle>
                    <AlertDescription>
                      This reconciliation has been approved and is now finalized. No further actions
                      are available.
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Action History</CardTitle>
                <CardDescription>
                  Timeline of actions performed on this reconciliation
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                        <Plus className="h-4 w-4 text-blue-600" />
                      </div>
                      <div className="flex-1 w-px bg-border my-2" />
                    </div>
                    <div className="flex-1 pb-4">
                      <div className="font-semibold">Created</div>
                      <div className="text-sm text-muted-foreground">
                        {format(new Date(reconciliation.created_at), "MMM dd, yyyy HH:mm")}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {formatDistanceToNow(new Date(reconciliation.created_at))} ago
                      </div>
                    </div>
                  </div>

                  {reconciliation.completed_at && reconciliation.completed_by && (
                    <div className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                          <CheckCircle className="h-4 w-4 text-blue-600" />
                        </div>
                        {reconciliation.approved_at && (
                          <div className="flex-1 w-px bg-border my-2" />
                        )}
                      </div>
                      <div className="flex-1 pb-4">
                        <div className="font-semibold">Completed</div>
                        <div className="text-sm text-muted-foreground">
                          By {reconciliation.completed_by}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {format(new Date(reconciliation.completed_at), "MMM dd, yyyy HH:mm")}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {formatDistanceToNow(new Date(reconciliation.completed_at))} ago
                        </div>
                      </div>
                    </div>
                  )}

                  {reconciliation.approved_at && reconciliation.approved_by && (
                    <div className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                          <Check className="h-4 w-4 text-green-600" />
                        </div>
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold">Approved</div>
                        <div className="text-sm text-muted-foreground">
                          By {reconciliation.approved_by}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {format(new Date(reconciliation.approved_at), "MMM dd, yyyy HH:mm")}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {formatDistanceToNow(new Date(reconciliation.approved_at))} ago
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {reconciliation.statement_file_url && (
              <Card>
                <CardHeader>
                  <CardTitle>Statement File</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <FileText className="h-8 w-8 text-muted-foreground" />
                      <div>
                        <div className="font-medium">Bank Statement</div>
                        <div className="text-sm text-muted-foreground">
                          {reconciliation.statement_file_url}
                        </div>
                      </div>
                    </div>
                    <Button variant="outline" asChild>
                      <a
                        href={reconciliation.statement_file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Download className="mr-2 h-4 w-4" />
                        Download
                      </a>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </RouteGuard>
  );
}
