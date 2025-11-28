/**
 * Customers List Component
 *
 * Comprehensive customer list with actions, filtering, and impersonation support.
 * Shared between ISP Ops and Platform Admin applications.
 */

"use client";

import { useToast } from "@dotmac/ui";
import {
  Mail,
  Phone,
  MapPin,
  Calendar,
  DollarSign,
  Eye,
  Edit,
  Trash2,
  MoreHorizontal,
  Building,
  User,
  LogIn,
  UserX,
  UserCheck,
  Key,
  ExternalLink,
} from "lucide-react";
import { useState } from "react";

export interface CustomersListProps<TCustomer = any> {
  customers: TCustomer[];
  loading: boolean;
  onCustomerSelect: (customer: TCustomer) => void;
  onEditCustomer?: (customer: TCustomer) => void;
  onDeleteCustomer?: (customer: TCustomer) => void;
  apiBaseUrl: string;
  buildAuthHeaders: () => Record<string, string>;
  impersonateCustomer?: (customerId: string) => Promise<void>;
  updateCustomerStatus?: (customerId: string, status: string) => Promise<void>;
  resetCustomerPassword?: (customerId: string) => Promise<void>;
  portalPath?: string;
}

interface StatusBadgeProps {
  status: string;
}

function StatusBadge({ status }: StatusBadgeProps) {
  const normalizedStatus = status?.toUpperCase();

  const statusConfig = {
    PROSPECT: {
      label: "Prospect",
      className: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    },
    ACTIVE: {
      label: "Active",
      className: "bg-green-500/20 text-green-400 border-green-500/30",
    },
    INACTIVE: {
      label: "Inactive",
      className: "bg-gray-500/20 text-gray-400 border-gray-500/30",
    },
    SUSPENDED: {
      label: "Suspended",
      className: "bg-orange-500/20 text-orange-400 border-orange-500/30",
    },
    CHURNED: {
      label: "Churned",
      className: "bg-red-500/20 text-red-400 border-red-500/30",
    },
    ARCHIVED: {
      label: "Archived",
      className: "bg-slate-500/20 text-slate-400 border-slate-500/30",
    },
  } as const satisfies Record<
    string,
    {
      label: string;
      className: string;
    }
  >;

  const config =
    statusConfig[normalizedStatus as keyof typeof statusConfig] ?? statusConfig["PROSPECT"];

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${config.className}`}
    >
      {config.label}
    </span>
  );
}

interface TierBadgeProps {
  tier: string;
}

function TierBadge({ tier }: TierBadgeProps) {
  const normalizedTier = tier?.toUpperCase();

  const tierConfig = {
    FREE: {
      label: "Free",
      className: "bg-slate-500/20 text-slate-400 border-slate-500/30",
    },
    BASIC: {
      label: "Basic",
      className: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    },
    STANDARD: {
      label: "Standard",
      className: "bg-purple-500/20 text-purple-400 border-purple-500/30",
    },
    PREMIUM: {
      label: "Premium",
      className: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    },
    ENTERPRISE: {
      label: "Enterprise",
      className: "bg-green-500/20 text-green-400 border-green-500/30",
    },
  } as const satisfies Record<string, { label: string; className: string }>;

  const config = tierConfig[normalizedTier as keyof typeof tierConfig] ?? tierConfig["FREE"];

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${config.className}`}
    >
      {config.label}
    </span>
  );
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

interface CustomerRowProps<TCustomer = any> {
  customer: TCustomer;
  onSelect: (customer: TCustomer) => void;
  onEdit?: (customer: TCustomer) => void;
  onDelete?: (customer: TCustomer) => void;
  apiBaseUrl: string;
  buildAuthHeaders: () => Record<string, string>;
  impersonateCustomer?: (customerId: string) => Promise<void>;
  updateCustomerStatus?: (customerId: string, status: string) => Promise<void>;
  resetCustomerPassword?: (customerId: string) => Promise<void>;
  portalPath?: string;
}

function CustomerRow<TCustomer = any>({
  customer,
  onSelect,
  onEdit,
  onDelete,
  apiBaseUrl,
  buildAuthHeaders,
  impersonateCustomer,
  updateCustomerStatus,
  resetCustomerPassword,
  portalPath = "/customer-portal",
}: CustomerRowProps<TCustomer>) {
  const [showActions, setShowActions] = useState(false);
  const { toast } = useToast();

  // Normalize property access for both camelCase and snake_case
  const customerData = customer as any;
  const customerName =
    customerData.displayName ||
    customerData.display_name ||
    `${customerData.firstName || customerData.first_name || ""}${customerData.middleName || customerData.middle_name ? ` ${customerData.middleName || customerData.middle_name}` : ""} ${customerData.lastName || customerData.last_name || ""}`;

  const customerId = customerData.id;
  const customerEmail = customerData.email;
  const customerPhone = customerData.phone;
  const customerCity = customerData.city;
  const customerStateProvince = customerData.stateProvince || customerData.state_province;
  const customerCountry = customerData.country;
  const customerStatus = customerData.status;
  const customerTier = customerData.tier;
  const customerType = (
    customerData.customerType ||
    customerData.customer_type ||
    ""
  ).toUpperCase();
  const companyName = customerData.companyName || customerData.company_name;
  const customerNumber = customerData.customerNumber || customerData.customer_number;
  const lifetimeValue = parseFloat(customerData.lifetimeValue || customerData.lifetime_value || 0);
  const totalPurchases = customerData.totalPurchases || customerData.total_purchases || 0;
  const createdAt = customerData.createdAt || customerData.created_at;

  const customerIcon = customerType === "INDIVIDUAL" ? User : Building;
  const IconComponent = customerIcon;

  const handleLoginAsCustomer = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowActions(false);

    if (!impersonateCustomer) {
      console.error("Impersonation not available");
      toast({
        title: "Feature Not Available",
        description: "Customer impersonation is not available",
        variant: "destructive",
      });
      return;
    }

    try {
      await impersonateCustomer(customerId);

      // Open customer portal in new tab
      window.open(portalPath, "_blank");

      toast({
        title: "Logged in as Customer",
        description: `You are now viewing the portal as ${customerName}`,
      });
    } catch (error) {
      console.error("Customer impersonation failed", error);
      toast({
        title: "Login Failed",
        description: error instanceof Error ? error.message : "Failed to login as customer",
        variant: "destructive",
      });
    }
  };

  const handleSuspendCustomer = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowActions(false);

    const normalizedStatus = customerStatus?.toUpperCase();
    const newStatus = normalizedStatus === "SUSPENDED" ? "ACTIVE" : "SUSPENDED";

    if (updateCustomerStatus) {
      try {
        await updateCustomerStatus(customerId, newStatus);

        toast({
          title: newStatus === "SUSPENDED" ? "Customer Suspended" : "Customer Reactivated",
          description: `${customerName} has been ${newStatus === "SUSPENDED" ? "suspended" : "reactivated"} successfully`,
        });

        // Refresh the customer list
        window.location.reload();
      } catch (error) {
        toast({
          title: "Action Failed",
          description: error instanceof Error ? error.message : "Failed to update customer status",
          variant: "destructive",
        });
      }
    } else {
      // Fallback to direct API call
      try {
        const response = await fetch(`${apiBaseUrl}/api/isp/v1/admin/customers/${customerId}/status`, {
          method: "PATCH",
          credentials: "include",
          headers: buildAuthHeaders(),
          body: JSON.stringify({ status: newStatus }),
        });

        if (!response.ok) throw new Error("Failed to update customer status");

        toast({
          title: newStatus === "SUSPENDED" ? "Customer Suspended" : "Customer Reactivated",
          description: `${customerName} has been ${newStatus === "SUSPENDED" ? "suspended" : "reactivated"} successfully`,
        });

        // Refresh the customer list
        window.location.reload();
      } catch (error) {
        toast({
          title: "Action Failed",
          description: error instanceof Error ? error.message : "Failed to update customer status",
          variant: "destructive",
        });
      }
    }
  };

  const handleResetPassword = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowActions(false);

    if (resetCustomerPassword) {
      try {
        await resetCustomerPassword(customerId);

        toast({
          title: "Password Reset Email Sent",
          description: `A password reset link has been sent to ${customerEmail}`,
        });
      } catch (error) {
        toast({
          title: "Reset Failed",
          description:
            error instanceof Error ? error.message : "Failed to send password reset email",
          variant: "destructive",
        });
      }
    } else {
      // Fallback to direct API call
      try {
        const response = await fetch(
          `${apiBaseUrl}/api/isp/v1/admin/customers/${customerId}/reset-password`,
          {
            method: "POST",
            credentials: "include",
            headers: buildAuthHeaders(),
          },
        );

        if (!response.ok) throw new Error("Failed to send reset password email");

        toast({
          title: "Password Reset Email Sent",
          description: `A password reset link has been sent to ${customerEmail}`,
        });
      } catch (error) {
        toast({
          title: "Reset Failed",
          description:
            error instanceof Error ? error.message : "Failed to send password reset email",
          variant: "destructive",
        });
      }
    }
  };

  const handleViewPortal = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowActions(false);

    // Open customer portal directly (without impersonation, just for viewing the UI)
    window.open(portalPath, "_blank");

    toast({
      title: "Customer Portal Opened",
      description: "Viewing customer portal interface in new tab",
    });
  };

  const normalizedStatus = customerStatus?.toUpperCase();

  return (
    <tr
      className="hover:bg-slate-800/50 transition-colors cursor-pointer"
      onClick={() => onSelect(customer)}
    >
      {/* Customer Info */}
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex items-center">
          <div className="flex-shrink-0 h-10 w-10">
            <div className="h-10 w-10 rounded-full bg-slate-700 flex items-center justify-center">
              <IconComponent className="h-5 w-5 text-slate-400" />
            </div>
          </div>
          <div className="ml-4">
            <div className="text-sm font-medium text-white">{customerName}</div>
            {companyName && <div className="text-sm text-slate-400">{companyName}</div>}
            <div className="text-xs text-slate-500">#{customerNumber}</div>
          </div>
        </div>
      </td>

      {/* Contact */}
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="space-y-1">
          <div className="flex items-center text-sm text-slate-300">
            <Mail className="h-3 w-3 mr-2" />
            {customerEmail}
          </div>
          {customerPhone && (
            <div className="flex items-center text-sm text-slate-400">
              <Phone className="h-3 w-3 mr-2" />
              {customerPhone}
            </div>
          )}
        </div>
      </td>

      {/* Location */}
      <td className="px-6 py-4 whitespace-nowrap">
        {customerCity || customerCountry ? (
          <div className="flex items-center text-sm text-slate-300">
            <MapPin className="h-3 w-3 mr-2" />
            {[customerCity, customerStateProvince, customerCountry].filter(Boolean).join(", ")}
          </div>
        ) : (
          <span className="text-slate-500">-</span>
        )}
      </td>

      {/* Status & Tier */}
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="space-y-1">
          <StatusBadge status={customerStatus} />
          <div>
            <TierBadge tier={customerTier} />
          </div>
        </div>
      </td>

      {/* Metrics */}
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="space-y-1">
          <div className="flex items-center text-sm text-slate-300">
            <DollarSign className="h-3 w-3 mr-1" />
            {formatCurrency(lifetimeValue)}
          </div>
          <div className="text-xs text-slate-400">{totalPurchases} purchases</div>
        </div>
      </td>

      {/* Created Date */}
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex items-center text-sm text-slate-400">
          <Calendar className="h-3 w-3 mr-2" />
          {formatDate(createdAt)}
        </div>
      </td>

      {/* Actions */}
      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowActions(!showActions);
            }}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>

          {showActions && (
            <div className="absolute right-0 mt-2 w-56 bg-slate-800 rounded-md shadow-lg ring-1 ring-black ring-opacity-5 z-10 max-h-96 overflow-y-auto">
              <div className="py-1">
                {/* Quick Actions Section */}
                <div className="px-3 py-1 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Quick Actions
                </div>
                {impersonateCustomer && (
                  <button
                    onClick={handleLoginAsCustomer}
                    className="flex items-center gap-2 px-4 py-2 text-sm text-blue-400 hover:bg-slate-700 w-full text-left"
                  >
                    <LogIn className="h-4 w-4" />
                    Login as Customer
                  </button>
                )}
                <button
                  onClick={handleViewPortal}
                  className="flex items-center gap-2 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 w-full text-left"
                >
                  <ExternalLink className="h-4 w-4" />
                  View Customer Portal
                </button>
                <button
                  onClick={handleSuspendCustomer}
                  className={`flex items-center gap-2 px-4 py-2 text-sm hover:bg-slate-700 w-full text-left ${
                    normalizedStatus === "SUSPENDED" ? "text-green-400" : "text-orange-400"
                  }`}
                >
                  {normalizedStatus === "SUSPENDED" ? (
                    <>
                      <UserCheck className="h-4 w-4" />
                      Reactivate Customer
                    </>
                  ) : (
                    <>
                      <UserX className="h-4 w-4" />
                      Suspend Customer
                    </>
                  )}
                </button>
                <button
                  onClick={handleResetPassword}
                  className="flex items-center gap-2 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 w-full text-left"
                >
                  <Key className="h-4 w-4" />
                  Reset Password
                </button>

                {/* Divider */}
                <div className="border-t border-slate-700 my-1" />

                {/* Standard Actions */}
                <div className="px-3 py-1 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Manage
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect(customer);
                    setShowActions(false);
                  }}
                  className="flex items-center gap-2 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 w-full text-left"
                >
                  <Eye className="h-4 w-4" />
                  View Details
                </button>
                {onEdit && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit(customer);
                      setShowActions(false);
                    }}
                    className="flex items-center gap-2 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 w-full text-left"
                  >
                    <Edit className="h-4 w-4" />
                    Edit Customer
                  </button>
                )}
                {onDelete && (
                  <>
                    <div className="border-t border-slate-700 my-1" />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(customer);
                        setShowActions(false);
                      }}
                      className="flex items-center gap-2 px-4 py-2 text-sm text-red-400 hover:bg-slate-700 w-full text-left"
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete Customer
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}

function LoadingSkeleton() {
  return (
    <tr className="animate-pulse">
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex items-center">
          <div className="h-10 w-10 bg-slate-700 rounded-full" />
          <div className="ml-4 space-y-2">
            <div className="h-4 bg-slate-700 rounded w-32" />
            <div className="h-3 bg-slate-700 rounded w-24" />
          </div>
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="space-y-2">
          <div className="h-4 bg-slate-700 rounded w-40" />
          <div className="h-3 bg-slate-700 rounded w-32" />
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="h-4 bg-slate-700 rounded w-24" />
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="space-y-2">
          <div className="h-6 bg-slate-700 rounded-full w-16" />
          <div className="h-6 bg-slate-700 rounded-full w-12" />
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="space-y-2">
          <div className="h-4 bg-slate-700 rounded w-20" />
          <div className="h-3 bg-slate-700 rounded w-16" />
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="h-4 bg-slate-700 rounded w-20" />
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="h-4 bg-slate-700 rounded w-4" />
      </td>
    </tr>
  );
}

export function CustomersList<TCustomer = any>({
  customers,
  loading,
  onCustomerSelect,
  onEditCustomer,
  onDeleteCustomer,
  apiBaseUrl,
  buildAuthHeaders,
  impersonateCustomer,
  updateCustomerStatus,
  resetCustomerPassword,
  portalPath,
}: CustomersListProps<TCustomer>) {
  if (loading) {
    return (
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-700">
          <thead className="bg-slate-800">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                Customer
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                Contact
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                Location
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                Status & Tier
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                Value
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                Joined
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-slate-900 divide-y divide-slate-700">
            {[...Array(5)].map((_, i) => (
              <LoadingSkeleton key={i} />
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (!customers.length) {
    return (
      <div className="text-center py-12">
        <User className="mx-auto h-12 w-12 text-slate-400 mb-4" />
        <h3 className="text-lg font-medium text-white mb-2">No customers found</h3>
        <p className="text-slate-400 mb-4">No customers match your search criteria.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-700">
        <thead className="bg-slate-800">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
              Customer
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
              Contact
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
              Location
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
              Status & Tier
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
              Value
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
              Joined
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="bg-slate-900 divide-y divide-slate-700">
          {customers.map((customer: any) => {
            const rowProps: CustomerRowProps<any> = {
              customer,
              onSelect: onCustomerSelect,
              apiBaseUrl,
              buildAuthHeaders,
            };

            if (onEditCustomer) {
              rowProps.onEdit = onEditCustomer;
            }
            if (onDeleteCustomer) {
              rowProps.onDelete = onDeleteCustomer;
            }
            if (impersonateCustomer) {
              rowProps.impersonateCustomer = impersonateCustomer;
            }
            if (updateCustomerStatus) {
              rowProps.updateCustomerStatus = updateCustomerStatus;
            }
            if (resetCustomerPassword) {
              rowProps.resetCustomerPassword = resetCustomerPassword;
            }
            if (portalPath) {
              rowProps.portalPath = portalPath;
            }

            return <CustomerRow key={customer.id} {...rowProps} />;
          })}
        </tbody>
      </table>
    </div>
  );
}
