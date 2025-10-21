import { useState, useEffect } from "react";
import { logger } from "@/lib/logger";
import {
  X,
  Edit,
  Trash2,
  Mail,
  Phone,
  MapPin,
  Calendar,
  DollarSign,
  Activity,
  MessageSquare,
  Plus,
  Building,
  User,
  Clock,
  Tag,
  Wifi,
  Globe,
  Router,
  Ticket,
  FileText,
} from "lucide-react";
import { Customer } from "@/types";
import { useCustomer, useCustomerActivities, useCustomerNotes } from "@/hooks/useCustomers";
import { CustomerActivities } from "./CustomerActivities";
import { CustomerNotes } from "./CustomerNotes";
import { CustomerSubscriptions } from "./CustomerSubscriptions";
import { CustomerNetwork } from "./CustomerNetwork";
import { CustomerDevices } from "./CustomerDevices";
import { CustomerTickets } from "./CustomerTickets";
import { CustomerBilling } from "./CustomerBilling";

interface CustomerDetailModalProps {
  customer: Customer;
  onClose: () => void;
  onEdit: (customer: Customer) => void;
  onDelete: (customer: Customer) => void;
}

interface TabProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

function StatusBadge({ status }: { status: Customer["status"] }) {
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
      className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${config.className}`}
    >
      {config.label}
    </span>
  );
}

function TierBadge({ tier }: { tier: Customer["tier"] }) {
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
      className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${config.className}`}
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
    month: "long",
    day: "numeric",
  });
}

function CustomerOverview({ customer }: { customer: Customer }) {
  const customerName =
    customer.display_name ||
    `${customer.first_name}${customer.middle_name ? ` ${customer.middle_name}` : ""} ${customer.last_name}`;

  const customerIcon = customer.customer_type === "individual" ? User : Building;
  const IconComponent = customerIcon;

  return (
    <div className="space-y-6">
      {/* Basic Info Card */}
      <div className="bg-slate-800 rounded-lg p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center">
            <div className="flex-shrink-0 h-16 w-16">
              <div className="h-16 w-16 rounded-full bg-slate-700 flex items-center justify-center">
                <IconComponent className="h-8 w-8 text-slate-400" />
              </div>
            </div>
            <div className="ml-4">
              <h3 className="text-xl font-semibold text-white">{customerName}</h3>
              {customer.company_name && <p className="text-slate-400">{customer.company_name}</p>}
              <p className="text-sm text-slate-500">#{customer.customer_number}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <StatusBadge status={customer.status} />
            <TierBadge tier={customer.tier} />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center text-slate-300">
            <Mail className="h-4 w-4 mr-3" />
            <div>
              <div>{customer.email}</div>
              {!customer.email && <span className="text-xs text-slate-500">Not verified</span>}
            </div>
          </div>

          {customer.phone && (
            <div className="flex items-center text-slate-300">
              <Phone className="h-4 w-4 mr-3" />
              {customer.phone}
            </div>
          )}

          {(customer.city || customer.country) && (
            <div className="flex items-center text-slate-300">
              <MapPin className="h-4 w-4 mr-3" />
              {[customer.city, customer.state_province, customer.country]
                .filter(Boolean)
                .join(", ")}
            </div>
          )}

          <div className="flex items-center text-slate-300">
            <Calendar className="h-4 w-4 mr-3" />
            Joined {formatDate(customer.created_at)}
          </div>
        </div>

        {customer.tags && customer.tags.length > 0 && (
          <div className="mt-4">
            <div className="flex items-center gap-2 mb-2">
              <Tag className="h-4 w-4 text-slate-400" />
              <span className="text-sm font-medium text-slate-400">Tags</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {customer.tags.map((tag, index) => (
                <span
                  key={index}
                  className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-sky-500/20 text-sky-400 border border-sky-500/30"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-800 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-400">Lifetime Value</p>
              <p className="text-2xl font-bold text-white">
                {formatCurrency(customer.lifetime_value)}
              </p>
            </div>
            <DollarSign className="h-8 w-8 text-green-400" />
          </div>
        </div>

        <div className="bg-slate-800 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-400">Total Purchases</p>
              <p className="text-2xl font-bold text-white">{customer.total_purchases}</p>
            </div>
            <Activity className="h-8 w-8 text-blue-400" />
          </div>
        </div>

        <div className="bg-slate-800 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-400">Avg Order Value</p>
              <p className="text-2xl font-bold text-white">
                {formatCurrency(customer.average_order_value)}
              </p>
            </div>
            <DollarSign className="h-8 w-8 text-purple-400" />
          </div>
        </div>
      </div>

      {/* Additional Details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Contact Details */}
        <div className="bg-slate-800 rounded-lg p-6">
          <h4 className="text-lg font-semibold text-white mb-4">Contact Details</h4>
          <div className="space-y-3">
            <div>
              <label className="text-sm text-slate-400">Email</label>
              <p className="text-white">{customer.email}</p>
            </div>
            {customer.phone && (
              <div>
                <label className="text-sm text-slate-400">Phone</label>
                <p className="text-white">{customer.phone}</p>
              </div>
            )}
            {customer.mobile && (
              <div>
                <label className="text-sm text-slate-400">Mobile</label>
                <p className="text-white">{customer.mobile}</p>
              </div>
            )}
          </div>
        </div>

        {/* Address */}
        {(customer.address_line_1 || customer.city) && (
          <div className="bg-slate-800 rounded-lg p-6">
            <h4 className="text-lg font-semibold text-white mb-4">Address</h4>
            <div className="space-y-1 text-slate-300">
              {customer.address_line_1 && <p>{customer.address_line_1}</p>}
              {customer.address_line_2 && <p>{customer.address_line_2}</p>}
              {(customer.city || customer.state_province || customer.postal_code) && (
                <p>
                  {[customer.city, customer.state_province, customer.postal_code]
                    .filter(Boolean)
                    .join(", ")}
                </p>
              )}
              {customer.country && <p>{customer.country}</p>}
            </div>
          </div>
        )}

        {/* Purchase History */}
        {(customer.first_purchase_date || customer.last_purchase_date) && (
          <div className="bg-slate-800 rounded-lg p-6">
            <h4 className="text-lg font-semibold text-white mb-4">Purchase History</h4>
            <div className="space-y-3">
              {customer.first_purchase_date && (
                <div>
                  <label className="text-sm text-slate-400">First Purchase</label>
                  <p className="text-white">{formatDate(customer.first_purchase_date)}</p>
                </div>
              )}
              {customer.last_purchase_date && (
                <div>
                  <label className="text-sm text-slate-400">Last Purchase</label>
                  <p className="text-white">{formatDate(customer.last_purchase_date)}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Metadata */}
        {customer.metadata && Object.keys(customer.metadata).length > 0 && (
          <div className="bg-slate-800 rounded-lg p-6">
            <h4 className="text-lg font-semibold text-white mb-4">Additional Information</h4>
            <div className="space-y-3">
              {Object.entries(customer.metadata).map(([key, value]) => (
                <div key={key}>
                  <label className="text-sm text-slate-400 capitalize">
                    {key.replace(/_/g, " ")}
                  </label>
                  <p className="text-white">{String(value)}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function CustomerDetailModal({
  customer,
  onClose,
  onEdit,
  onDelete,
}: CustomerDetailModalProps) {
  const [activeTab, setActiveTab] = useState("overview");
  const { getCustomer, loading } = useCustomer();
  const [detailedCustomer, setDetailedCustomer] = useState<Customer>(customer);

  // Load detailed customer data
  useEffect(() => {
    const loadDetailedCustomer = async () => {
      try {
        const detailed = await getCustomer(customer.id, true, true);
        setDetailedCustomer(detailed as Customer);
      } catch (error) {
        logger.error(
          "Failed to load detailed customer",
          error instanceof Error ? error : new Error(String(error)),
        );
      }
    };

    loadDetailedCustomer();
  }, [customer.id, getCustomer]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const tabs = [
    { id: "overview", label: "Overview", icon: User },
    { id: "subscriptions", label: "Subscriptions", icon: Wifi },
    { id: "network", label: "Network", icon: Globe },
    { id: "devices", label: "Devices", icon: Router },
    { id: "tickets", label: "Tickets", icon: Ticket },
    { id: "billing", label: "Billing", icon: FileText },
    { id: "activities", label: "Activities", icon: Activity },
    { id: "notes", label: "Notes", icon: MessageSquare },
  ];

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-black/50 flex items-start justify-center p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-slate-900 rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-hidden mt-8">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-semibold text-white">Customer Details</h2>
            <div className="flex gap-2">
              <StatusBadge status={detailedCustomer.status} />
              <TierBadge tier={detailedCustomer.tier} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onEdit(detailedCustomer)}
              className="flex items-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-colors"
            >
              <Edit className="h-4 w-4" />
              Edit
            </button>
            <button
              onClick={() => onDelete(detailedCustomer)}
              className="flex items-center gap-2 px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </button>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white transition-colors p-2"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-slate-700">
          <nav className="flex px-6">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 py-4 px-6 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? "border-sky-500 text-sky-400"
                      : "border-transparent text-slate-400 hover:text-slate-300"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {activeTab === "overview" && <CustomerOverview customer={detailedCustomer} />}
          {activeTab === "subscriptions" && (
            <CustomerSubscriptions customerId={detailedCustomer.id} />
          )}
          {activeTab === "network" && <CustomerNetwork customerId={detailedCustomer.id} />}
          {activeTab === "devices" && <CustomerDevices customerId={detailedCustomer.id} />}
          {activeTab === "tickets" && <CustomerTickets customerId={detailedCustomer.id} />}
          {activeTab === "billing" && <CustomerBilling customerId={detailedCustomer.id} />}
          {activeTab === "activities" && <CustomerActivities customerId={detailedCustomer.id} />}
          {activeTab === "notes" && <CustomerNotes customerId={detailedCustomer.id} />}
        </div>
      </div>
    </div>
  );
}
