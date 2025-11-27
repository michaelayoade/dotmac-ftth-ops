"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { Input } from "@dotmac/ui";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@dotmac/ui";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@dotmac/ui";
import { useToast } from "@dotmac/ui";
import {
  CreditCard,
  Building2,
  Wallet,
  Search,
  Plus,
  MoreVertical,
  Shield,
  Star,
  Trash2,
  RefreshCw,
  Settings,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  Eye,
} from "lucide-react";
import { useTenantPaymentMethods } from "@/hooks/useTenantPaymentMethods";
import { AddPaymentMethodModal } from "@/components/tenant/billing/AddPaymentMethodModal";
import Link from "next/link";
import { format } from "date-fns";

export default function PaymentMethodsPage() {
  const { toast } = useToast();
  const {
    paymentMethods,
    defaultPaymentMethod,
    loading,
    error,
    fetchPaymentMethods,
    setDefaultPaymentMethod,
    removePaymentMethod,
  } = useTenantPaymentMethods();

  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [showAddModal, setShowAddModal] = useState(false);
  const [deletePaymentMethodId, setDeletePaymentMethodId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Filter payment methods
  const filteredPaymentMethods = paymentMethods.filter((method) => {
    // Search filter
    if (searchQuery) {
      const searchLower = searchQuery.toLowerCase();
      const last4 = method.card_last4 || method.bank_account_last4 || "";
      const methodType = method.method_type.toLowerCase();
      const brand = method.card_brand?.toLowerCase() || "";
      const bankName = method.bank_name?.toLowerCase() || "";

      const matchesSearch =
        last4.includes(searchLower) ||
        methodType.includes(searchLower) ||
        brand.includes(searchLower) ||
        bankName.includes(searchLower);

      if (!matchesSearch) return false;
    }

    // Type filter
    if (typeFilter !== "all" && method.method_type !== typeFilter) {
      return false;
    }

    return true;
  });

  // Calculate statistics
  const stats = {
    total: paymentMethods.length,
    cards: paymentMethods.filter((m) => m.method_type === "card").length,
    bankAccounts: paymentMethods.filter((m) => m.method_type === "bank_account").length,
    active: paymentMethods.filter((m) => m.status === "active").length,
  };

  const handleSetDefault = async (paymentMethodId: string) => {
    try {
      await setDefaultPaymentMethod(paymentMethodId);
      toast({
        title: "Success",
        description: "Default payment method updated",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to set default payment method",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    if (!deletePaymentMethodId) return;

    setIsDeleting(true);
    try {
      await removePaymentMethod(deletePaymentMethodId);
      toast({
        title: "Success",
        description: "Payment method removed successfully",
      });
      setDeletePaymentMethodId(null);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to remove payment method",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const getPaymentMethodIcon = (type: string) => {
    switch (type) {
      case "card":
        return <CreditCard className="h-5 w-5 text-blue-500" />;
      case "bank_account":
        return <Building2 className="h-5 w-5 text-green-500" />;
      case "wallet":
        return <Wallet className="h-5 w-5 text-purple-500" />;
      default:
        return <CreditCard className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string, isVerified: boolean) => {
    if (status === "active" && isVerified) {
      return (
        <Badge variant="default" className="flex items-center gap-1 w-fit">
          <CheckCircle className="h-3 w-3" />
          Active
        </Badge>
      );
    }
    if (status === "pending_verification") {
      return (
        <Badge variant="outline" className="flex items-center gap-1 w-fit">
          <Clock className="h-3 w-3" />
          Pending Verification
        </Badge>
      );
    }
    if (status === "verification_failed") {
      return (
        <Badge variant="destructive" className="flex items-center gap-1 w-fit">
          <XCircle className="h-3 w-3" />
          Verification Failed
        </Badge>
      );
    }
    if (status === "expired") {
      return (
        <Badge variant="secondary" className="flex items-center gap-1 w-fit">
          <AlertCircle className="h-3 w-3" />
          Expired
        </Badge>
      );
    }
    return (
      <Badge variant="secondary" className="flex items-center gap-1 w-fit">
        {status}
      </Badge>
    );
  };

  const getCardBrand = (brand?: string) => {
    if (!brand) return "Card";
    return brand.charAt(0).toUpperCase() + brand.slice(1);
  };

  const formatExpiry = (month?: number, year?: number) => {
    if (!month || !year) return "N/A";
    return `${String(month).padStart(2, "0")}/${year}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Payment Methods</h1>
          <p className="text-muted-foreground">Manage cards, bank accounts, and payment options</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/dashboard/billing-revenue/payment-methods/types">
              <Settings className="mr-2 h-4 w-4" />
              Configure Types
            </Link>
          </Button>
          <Button onClick={() => setShowAddModal(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Payment Method
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Methods</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">Payment methods on file</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Active Cards</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.cards}</div>
            <p className="text-xs text-muted-foreground">Credit & debit cards</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Bank Accounts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.bankAccounts}</div>
            <p className="text-xs text-muted-foreground">ACH bank accounts</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Active Methods</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.active}</div>
            <p className="text-xs text-muted-foreground">Ready to use</p>
          </CardContent>
        </Card>
      </div>

      {/* Payment Methods Table */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Your Payment Methods</CardTitle>
            <div className="flex gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Search payment methods..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 w-[250px]"
                />
              </div>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="h-10 w-[150px] rounded-md border border-border bg-accent px-3 text-sm text-white"
              >
                <option value="all">All Types</option>
                <option value="card">Cards</option>
                <option value="bank_account">Bank Accounts</option>
                <option value="wallet">Wallets</option>
              </select>
              <Button variant="outline" onClick={() => fetchPaymentMethods()}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading payment methods...</div>
          ) : error ? (
            <div className="text-center py-8 text-destructive">
              Failed to load payment methods. Please try again.
              <Button variant="outline" className="mt-4" onClick={() => fetchPaymentMethods()}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Retry
              </Button>
            </div>
          ) : filteredPaymentMethods.length === 0 ? (
            <div className="text-center py-8">
              <CreditCard className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium mb-2">No payment methods found</h3>
              <p className="text-muted-foreground mb-4">
                {searchQuery || typeFilter !== "all"
                  ? "Try adjusting your filters"
                  : "Add your first payment method to get started"}
              </p>
              {!searchQuery && typeFilter === "all" && (
                <Button onClick={() => setShowAddModal(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Payment Method
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead>Last 4</TableHead>
                  <TableHead>Expiration</TableHead>
                  <TableHead>Default</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Added</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPaymentMethods.map((method) => (
                  <TableRow key={method.payment_method_id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getPaymentMethodIcon(method.method_type)}
                        <span className="capitalize">{method.method_type.replace("_", " ")}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {method.method_type === "card" && (
                        <div>
                          <div className="font-medium">{getCardBrand(method.card_brand)}</div>
                          <div className="text-sm text-muted-foreground">
                            {method.billing_name || "Card"}
                          </div>
                        </div>
                      )}
                      {method.method_type === "bank_account" && (
                        <div>
                          <div className="font-medium">{method.bank_name || "Bank Account"}</div>
                          <div className="text-sm text-muted-foreground capitalize">
                            {method.bank_account_type || "Checking"}
                          </div>
                        </div>
                      )}
                      {method.method_type === "wallet" && (
                        <div>
                          <div className="font-medium">{method.wallet_type || "Wallet"}</div>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="font-mono">
                        **** {method.card_last4 || method.bank_account_last4 || "****"}
                      </span>
                    </TableCell>
                    <TableCell>
                      {method.method_type === "card"
                        ? formatExpiry(method.card_exp_month, method.card_exp_year)
                        : "N/A"}
                    </TableCell>
                    <TableCell>
                      {method.is_default ? (
                        <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(method.status, method.is_verified)}
                        {method.method_type === "bank_account" && method.is_verified && (
                          <Shield className="h-4 w-4 text-green-500" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {format(new Date(method.created_at), "MMM d, yyyy")}
                      </div>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem asChild>
                            <Link
                              href={`/dashboard/billing-revenue/payment-methods/${method.payment_method_id}`}
                            >
                              <Eye className="mr-2 h-4 w-4" />
                              View Details
                            </Link>
                          </DropdownMenuItem>
                          {!method.is_default && (
                            <DropdownMenuItem
                              onClick={() => handleSetDefault(method.payment_method_id)}
                            >
                              <Star className="mr-2 h-4 w-4" />
                              Set as Default
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => setDeletePaymentMethodId(method.payment_method_id)}
                            className="text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Remove
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add Payment Method Modal */}
      <AddPaymentMethodModal
        open={showAddModal}
        onOpenChange={setShowAddModal}
        onAddPaymentMethod={async (request) => {
          // This is handled by the hook inside the modal
          // The modal will call fetchPaymentMethods after adding
        }}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!deletePaymentMethodId}
        onOpenChange={(open) => !open && setDeletePaymentMethodId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Payment Method</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this payment method? This action cannot be undone.
              {defaultPaymentMethod?.payment_method_id === deletePaymentMethodId && (
                <>
                  <br />
                  <br />
                  <strong className="text-yellow-600">
                    Warning: This is your default payment method. You may want to set another
                    payment method as default before removing this one.
                  </strong>
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Removing..." : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
