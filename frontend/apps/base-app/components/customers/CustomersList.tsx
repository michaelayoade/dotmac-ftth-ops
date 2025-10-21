import { useState } from "react";
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
  Zap,
} from "lucide-react";
import { Customer } from "@/types";
import { useToast } from "@/components/ui/use-toast";
import { platformConfig } from "@/lib/config";

interface CustomersListProps {
  customers: Customer[];
  loading: boolean;
  onCustomerSelect: (customer: Customer) => void;
  onEditCustomer?: (customer: Customer) => void;
  onDeleteCustomer?: (customer: Customer) => void;
}

interface StatusBadgeProps {
  status: Customer["status"];
}

function StatusBadge({ status }: StatusBadgeProps) {
  const statusConfig = {
    prospect: {
      label: "Prospect",
      className: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    },
    active: {
      label: "Active",
      className: "bg-green-500/20 text-green-400 border-green-500/30",
    },
    inactive: {
      label: "Inactive",
      className: "bg-gray-500/20 text-gray-400 border-gray-500/30",
    },
    suspended: {
      label: "Suspended",
      className: "bg-orange-500/20 text-orange-400 border-orange-500/30",
    },
    churned: {
      label: "Churned",
      className: "bg-red-500/20 text-red-400 border-red-500/30",
    },
    archived: {
      label: "Archived",
      className: "bg-slate-500/20 text-slate-400 border-slate-500/30",
    },
  };

  const config = statusConfig[status] || statusConfig.prospect;

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${config.className}`}
    >
      {config.label}
    </span>
  );
}

interface TierBadgeProps {
  tier: Customer["tier"];
}

function TierBadge({ tier }: TierBadgeProps) {
  const tierConfig = {
    free: {
      label: "Free",
      className: "bg-slate-500/20 text-slate-400 border-slate-500/30",
    },
    basic: {
      label: "Basic",
      className: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    },
    standard: {
      label: "Standard",
      className: "bg-purple-500/20 text-purple-400 border-purple-500/30",
    },
    premium: {
      label: "Premium",
      className: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    },
    enterprise: {
      label: "Enterprise",
      className: "bg-green-500/20 text-green-400 border-green-500/30",
    },
  };

  const config = tierConfig[tier] || tierConfig.free;

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

interface CustomerRowProps {
  customer: Customer;
  onSelect: (customer: Customer) => void;
  onEdit?: (customer: Customer) => void;
  onDelete?: (customer: Customer) => void;
}

function CustomerRow({ customer, onSelect, onEdit, onDelete }: CustomerRowProps) {
  const [showActions, setShowActions] = useState(false);
  const { toast } = useToast();

  const customerName =
    customer.display_name ||
    `${customer.first_name}${customer.middle_name ? ` ${customer.middle_name}` : ""} ${customer.last_name}`;

  const customerIcon = customer.customer_type === "individual" ? User : Building;
  const IconComponent = customerIcon;

  const handleLoginAsCustomer = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowActions(false);

    try {
      const response = await fetch(
        `${platformConfig.api.baseUrl}/api/v1/customers/${customer.id}/impersonate`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${localStorage.getItem("access_token")}`,
            "Content-Type": "application/json",
          },
        },
      );

      if (!response.ok) throw new Error("Failed to generate login token");

      const data = await response.json();

      // Store the impersonation token
      localStorage.setItem("customer_access_token", data.access_token);

      // Open customer portal in new tab
      window.open("/customer-portal", "_blank");

      toast({
        title: "Logged in as Customer",
        description: `You are now viewing the portal as ${customerName}`,
      });
    } catch (error) {
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

    const newStatus = customer.status === "suspended" ? "active" : "suspended";

    try {
      const response = await fetch(
        `${platformConfig.api.baseUrl}/api/v1/customers/${customer.id}/status`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${localStorage.getItem("access_token")}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ status: newStatus }),
        },
      );

      if (!response.ok) throw new Error("Failed to update customer status");

      toast({
        title: newStatus === "suspended" ? "Customer Suspended" : "Customer Reactivated",
        description: `${customerName} has been ${newStatus === "suspended" ? "suspended" : "reactivated"} successfully`,
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
  };

  const handleResetPassword = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowActions(false);

    try {
      const response = await fetch(
        `${platformConfig.api.baseUrl}/api/v1/customers/${customer.id}/reset-password`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${localStorage.getItem("access_token")}`,
            "Content-Type": "application/json",
          },
        },
      );

      if (!response.ok) throw new Error("Failed to send reset password email");

      toast({
        title: "Password Reset Email Sent",
        description: `A password reset link has been sent to ${customer.email}`,
      });
    } catch (error) {
      toast({
        title: "Reset Failed",
        description: error instanceof Error ? error.message : "Failed to send password reset email",
        variant: "destructive",
      });
    }
  };

  const handleViewPortal = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowActions(false);

    // Open customer portal directly (without impersonation, just for viewing the UI)
    window.open("/customer-portal", "_blank");

    toast({
      title: "Customer Portal Opened",
      description: "Viewing customer portal interface in new tab",
    });
  };

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
            {customer.company_name && (
              <div className="text-sm text-slate-400">{customer.company_name}</div>
            )}
            <div className="text-xs text-slate-500">#{customer.customer_number}</div>
          </div>
        </div>
      </td>

      {/* Contact */}
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="space-y-1">
          <div className="flex items-center text-sm text-slate-300">
            <Mail className="h-3 w-3 mr-2" />
            {customer.email}
          </div>
          {customer.phone && (
            <div className="flex items-center text-sm text-slate-400">
              <Phone className="h-3 w-3 mr-2" />
              {customer.phone}
            </div>
          )}
        </div>
      </td>

      {/* Location */}
      <td className="px-6 py-4 whitespace-nowrap">
        {customer.city || customer.country ? (
          <div className="flex items-center text-sm text-slate-300">
            <MapPin className="h-3 w-3 mr-2" />
            {[customer.city, customer.state_province, customer.country].filter(Boolean).join(", ")}
          </div>
        ) : (
          <span className="text-slate-500">-</span>
        )}
      </td>

      {/* Status & Tier */}
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="space-y-1">
          <StatusBadge status={customer.status} />
          <div>
            <TierBadge tier={customer.tier} />
          </div>
        </div>
      </td>

      {/* Metrics */}
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="space-y-1">
          <div className="flex items-center text-sm text-slate-300">
            <DollarSign className="h-3 w-3 mr-1" />
            {formatCurrency(customer.lifetime_value)}
          </div>
          <div className="text-xs text-slate-400">{customer.total_purchases} purchases</div>
        </div>
      </td>

      {/* Created Date */}
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex items-center text-sm text-slate-400">
          <Calendar className="h-3 w-3 mr-2" />
          {formatDate(customer.created_at)}
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
                <button
                  onClick={handleLoginAsCustomer}
                  className="flex items-center gap-2 px-4 py-2 text-sm text-blue-400 hover:bg-slate-700 w-full text-left"
                >
                  <LogIn className="h-4 w-4" />
                  Login as Customer
                </button>
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
                    customer.status === "suspended" ? "text-green-400" : "text-orange-400"
                  }`}
                >
                  {customer.status === "suspended" ? (
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
                <div className="border-t border-slate-700 my-1"></div>

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
                    <div className="border-t border-slate-700 my-1"></div>
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
          <div className="h-10 w-10 bg-slate-700 rounded-full"></div>
          <div className="ml-4 space-y-2">
            <div className="h-4 bg-slate-700 rounded w-32"></div>
            <div className="h-3 bg-slate-700 rounded w-24"></div>
          </div>
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="space-y-2">
          <div className="h-4 bg-slate-700 rounded w-40"></div>
          <div className="h-3 bg-slate-700 rounded w-32"></div>
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="h-4 bg-slate-700 rounded w-24"></div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="space-y-2">
          <div className="h-6 bg-slate-700 rounded-full w-16"></div>
          <div className="h-6 bg-slate-700 rounded-full w-12"></div>
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="space-y-2">
          <div className="h-4 bg-slate-700 rounded w-20"></div>
          <div className="h-3 bg-slate-700 rounded w-16"></div>
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="h-4 bg-slate-700 rounded w-20"></div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="h-4 bg-slate-700 rounded w-4"></div>
      </td>
    </tr>
  );
}

export function CustomersList({
  customers,
  loading,
  onCustomerSelect,
  onEditCustomer,
  onDeleteCustomer,
}: CustomersListProps) {
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
          {customers.map((customer) => (
            <CustomerRow
              key={customer.id}
              customer={customer}
              onSelect={onCustomerSelect}
              onEdit={onEditCustomer}
              onDelete={onDeleteCustomer}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
