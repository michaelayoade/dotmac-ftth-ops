/**
 * Customer Detail Modal
 *
 * Comprehensive modal for viewing all customer details across multiple tabs.
 * Shared between ISP Ops and Platform Admin applications.
 */

"use client";

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
  Building,
  User,
  Tag,
  Wifi,
  Globe,
  Router,
  Ticket,
  FileText,
} from "lucide-react";
import { useState, useEffect, ReactNode } from "react";

export interface CustomerDetailModalProps<TCustomer = any> {
  customer: TCustomer;
  onClose: () => void;
  onEdit: (customer: TCustomer) => void;
  onDelete: (customer: TCustomer) => void;
  getCustomer: (
    id: string,
    includeRelations?: boolean,
    includeMetrics?: boolean,
  ) => Promise<TCustomer>;
  CustomerActivities?: React.ComponentType<{ customerId: string }>;
  CustomerNotes?: React.ComponentType<{ customerId: string }>;
  CustomerSubscriptions?: React.ComponentType<{ customerId: string }>;
  CustomerNetwork?: React.ComponentType<{ customerId: string }>;
  CustomerDevices?: React.ComponentType<{ customerId: string }>;
  CustomerTickets?: React.ComponentType<{ customerId: string }>;
  CustomerBilling?: React.ComponentType<{ customerId: string }>;
}

function StatusBadge({ status }: { status: string }) {
  const normalizedStatus = status?.toLowerCase();

  const statusConfig: Record<string, { label: string; className: string }> = {
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

  const config = (statusConfig[normalizedStatus] || statusConfig["prospect"])!;

  return (
    <span
      className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${config["className"]}`}
    >
      {config["label"]}
    </span>
  );
}

function TierBadge({ tier }: { tier: string }) {
  const normalizedTier = tier?.toLowerCase();

  const tierConfig: Record<string, { label: string; className: string }> = {
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

  const config = (tierConfig[normalizedTier] || tierConfig["free"])!;

  return (
    <span
      className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${config["className"]}`}
    >
      {config["label"]}
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

function CustomerOverview<TCustomer = any>({ customer }: { customer: TCustomer }) {
  const customerData = customer as any;

  const customerName =
    customerData.display_name ||
    customerData.displayName ||
    `${customerData.first_name || customerData.firstName || ""}${customerData.middle_name || customerData.middleName ? ` ${customerData.middle_name || customerData.middleName}` : ""} ${customerData.last_name || customerData.lastName || ""}`;

  const customerType = (
    customerData.customer_type ||
    customerData.customerType ||
    ""
  ).toLowerCase();
  const customerIcon = customerType === "individual" ? User : Building;
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
              {(customerData.company_name || customerData.companyName) && (
                <p className="text-slate-400">
                  {customerData.company_name || customerData.companyName}
                </p>
              )}
              <p className="text-sm text-slate-500">
                #{customerData.customer_number || customerData.customerNumber}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <StatusBadge status={customerData.status} />
            <TierBadge tier={customerData.tier} />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center text-slate-300">
            <Mail className="h-4 w-4 mr-3" />
            <div>
              <div>{customerData.email}</div>
              {!customerData.email && <span className="text-xs text-slate-500">Not verified</span>}
            </div>
          </div>

          {customerData.phone && (
            <div className="flex items-center text-slate-300">
              <Phone className="h-4 w-4 mr-3" />
              {customerData.phone}
            </div>
          )}

          {(customerData.city || customerData.country) && (
            <div className="flex items-center text-slate-300">
              <MapPin className="h-4 w-4 mr-3" />
              {[
                customerData.city,
                customerData.state_province || customerData.stateProvince,
                customerData.country,
              ]
                .filter(Boolean)
                .join(", ")}
            </div>
          )}

          <div className="flex items-center text-slate-300">
            <Calendar className="h-4 w-4 mr-3" />
            Joined {formatDate(customerData.created_at || customerData.createdAt)}
          </div>
        </div>

        {customerData.tags && customerData.tags.length > 0 && (
          <div className="mt-4">
            <div className="flex items-center gap-2 mb-2">
              <Tag className="h-4 w-4 text-slate-400" />
              <span className="text-sm font-medium text-slate-400">Tags</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {customerData.tags.map((tag: string, index: number) => (
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
                {formatCurrency(customerData.lifetime_value || customerData.lifetimeValue || 0)}
              </p>
            </div>
            <DollarSign className="h-8 w-8 text-green-400" />
          </div>
        </div>

        <div className="bg-slate-800 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-400">Total Purchases</p>
              <p className="text-2xl font-bold text-white">
                {customerData.total_purchases || customerData.totalPurchases || 0}
              </p>
            </div>
            <Activity className="h-8 w-8 text-blue-400" />
          </div>
        </div>

        <div className="bg-slate-800 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-400">Avg Order Value</p>
              <p className="text-2xl font-bold text-white">
                {formatCurrency(
                  customerData.average_order_value || customerData.averageOrderValue || 0,
                )}
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
              <p className="text-white">{customerData.email}</p>
            </div>
            {customerData.phone && (
              <div>
                <label className="text-sm text-slate-400">Phone</label>
                <p className="text-white">{customerData.phone}</p>
              </div>
            )}
            {customerData.mobile && (
              <div>
                <label className="text-sm text-slate-400">Mobile</label>
                <p className="text-white">{customerData.mobile}</p>
              </div>
            )}
          </div>
        </div>

        {/* Address */}
        {(customerData.address_line_1 || customerData.addressLine1 || customerData.city) && (
          <div className="bg-slate-800 rounded-lg p-6">
            <h4 className="text-lg font-semibold text-white mb-4">Address</h4>
            <div className="space-y-1 text-slate-300">
              {(customerData.address_line_1 || customerData.addressLine1) && (
                <p>{customerData.address_line_1 || customerData.addressLine1}</p>
              )}
              {(customerData.address_line_2 || customerData.addressLine2) && (
                <p>{customerData.address_line_2 || customerData.addressLine2}</p>
              )}
              {(customerData.city ||
                customerData.state_province ||
                customerData.stateProvince ||
                customerData.postal_code ||
                customerData.postalCode) && (
                <p>
                  {[
                    customerData.city,
                    customerData.state_province || customerData.stateProvince,
                    customerData.postal_code || customerData.postalCode,
                  ]
                    .filter(Boolean)
                    .join(", ")}
                </p>
              )}
              {customerData.country && <p>{customerData.country}</p>}
            </div>
          </div>
        )}

        {/* Purchase History */}
        {(customerData.first_purchase_date ||
          customerData.firstPurchaseDate ||
          customerData.last_purchase_date ||
          customerData.lastPurchaseDate) && (
          <div className="bg-slate-800 rounded-lg p-6">
            <h4 className="text-lg font-semibold text-white mb-4">Purchase History</h4>
            <div className="space-y-3">
              {(customerData.first_purchase_date || customerData.firstPurchaseDate) && (
                <div>
                  <label className="text-sm text-slate-400">First Purchase</label>
                  <p className="text-white">
                    {formatDate(customerData.first_purchase_date || customerData.firstPurchaseDate)}
                  </p>
                </div>
              )}
              {(customerData.last_purchase_date || customerData.lastPurchaseDate) && (
                <div>
                  <label className="text-sm text-slate-400">Last Purchase</label>
                  <p className="text-white">
                    {formatDate(customerData.last_purchase_date || customerData.lastPurchaseDate)}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Metadata */}
        {customerData.metadata && Object.keys(customerData.metadata).length > 0 && (
          <div className="bg-slate-800 rounded-lg p-6">
            <h4 className="text-lg font-semibold text-white mb-4">Additional Information</h4>
            <div className="space-y-3">
              {Object.entries(customerData.metadata).map(([key, value]) => (
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

export function CustomerDetailModal<TCustomer = any>({
  customer,
  onClose,
  onEdit,
  onDelete,
  getCustomer,
  CustomerActivities,
  CustomerNotes,
  CustomerSubscriptions,
  CustomerNetwork,
  CustomerDevices,
  CustomerTickets,
  CustomerBilling,
}: CustomerDetailModalProps<TCustomer>) {
  const [activeTab, setActiveTab] = useState("overview");
  const [detailedCustomer, setDetailedCustomer] = useState<TCustomer>(customer);
  const [loading, setLoading] = useState(false);

  const customerData = customer as any;

  // Load detailed customer data
  useEffect(() => {
    const loadDetailedCustomer = async () => {
      try {
        setLoading(true);
        const detailed = await getCustomer(customerData.id, true, true);
        setDetailedCustomer(detailed);
      } catch (error) {
        console.error("Failed to load detailed customer", error);
      } finally {
        setLoading(false);
      }
    };

    loadDetailedCustomer();
  }, [customerData.id, getCustomer]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const tabs = [
    { id: "overview", label: "Overview", icon: User, component: CustomerOverview },
    ...(CustomerSubscriptions
      ? [
          {
            id: "subscriptions",
            label: "Subscriptions",
            icon: Wifi,
            component: CustomerSubscriptions,
          },
        ]
      : []),
    ...(CustomerNetwork
      ? [{ id: "network", label: "Network", icon: Globe, component: CustomerNetwork }]
      : []),
    ...(CustomerDevices
      ? [{ id: "devices", label: "Devices", icon: Router, component: CustomerDevices }]
      : []),
    ...(CustomerTickets
      ? [{ id: "tickets", label: "Tickets", icon: Ticket, component: CustomerTickets }]
      : []),
    ...(CustomerBilling
      ? [{ id: "billing", label: "Billing", icon: FileText, component: CustomerBilling }]
      : []),
    ...(CustomerActivities
      ? [{ id: "activities", label: "Activities", icon: Activity, component: CustomerActivities }]
      : []),
    ...(CustomerNotes
      ? [{ id: "notes", label: "Notes", icon: MessageSquare, component: CustomerNotes }]
      : []),
  ];

  const detailedCustomerData = detailedCustomer as any;

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
              <StatusBadge status={detailedCustomerData.status} />
              <TierBadge tier={detailedCustomerData.tier} />
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
          {activeTab === "subscriptions" && CustomerSubscriptions && (
            <CustomerSubscriptions customerId={detailedCustomerData.id} />
          )}
          {activeTab === "network" && CustomerNetwork && (
            <CustomerNetwork customerId={detailedCustomerData.id} />
          )}
          {activeTab === "devices" && CustomerDevices && (
            <CustomerDevices customerId={detailedCustomerData.id} />
          )}
          {activeTab === "tickets" && CustomerTickets && (
            <CustomerTickets customerId={detailedCustomerData.id} />
          )}
          {activeTab === "billing" && CustomerBilling && (
            <CustomerBilling customerId={detailedCustomerData.id} />
          )}
          {activeTab === "activities" && CustomerActivities && (
            <CustomerActivities customerId={detailedCustomerData.id} />
          )}
          {activeTab === "notes" && CustomerNotes && (
            <CustomerNotes customerId={detailedCustomerData.id} />
          )}
        </div>
      </div>
    </div>
  );
}
