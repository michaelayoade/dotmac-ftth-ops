/**
 * Customer View Modal (Shared)
 *
 * Read-only modal for viewing customer details at a glance.
 * Shared between ISP Ops and Platform Admin applications.
 */

"use client";

import {
  X,
  User,
  Building,
  Mail,
  Phone,
  MapPin,
  Calendar,
  DollarSign,
  Hash,
  Globe,
} from "lucide-react";

export interface CustomerViewModalCustomer {
  id: string;
  customer_number?: string;
  customer_type?: string;
  display_name?: string;
  first_name?: string;
  middle_name?: string;
  last_name?: string;
  company_name?: string;
  email: string;
  phone?: string;
  website?: string;
  address_line_1?: string;
  address_line_2?: string;
  city?: string;
  state_province?: string;
  postal_code?: string;
  country?: string;
  status: "prospect" | "active" | "inactive" | "suspended" | "churned" | "archived";
  tier: "free" | "basic" | "standard" | "premium" | "enterprise";
  tax_id?: string;
  vat_number?: string;
  lifetime_value: number;
  total_purchases: number;
  credit_limit?: number;
  created_at: string;
  updated_at: string;
  last_interaction?: string;
  notes?: string;
  custom_fields?: Record<string, any>;
}

export interface CustomerViewModalProps {
  customer: CustomerViewModalCustomer;
  onClose: () => void;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function CustomerViewModal({ customer, onClose }: CustomerViewModalProps) {
  const customerName =
    customer.display_name ||
    `${customer.first_name}${customer.middle_name ? ` ${customer.middle_name}` : ""} ${customer.last_name}`;

  const customerIcon = customer.customer_type === "individual" ? User : Building;
  const IconComponent = customerIcon;

  const statusColors = {
    prospect: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    active: "bg-green-500/20 text-green-400 border-green-500/30",
    inactive: "bg-gray-500/20 text-gray-400 border-gray-500/30",
    suspended: "bg-orange-500/20 text-orange-400 border-orange-500/30",
    churned: "bg-red-500/20 text-red-400 border-red-500/30",
    archived: "bg-slate-500/20 text-slate-400 border-slate-500/30",
  };

  const tierColors = {
    free: "bg-slate-500/20 text-slate-400 border-slate-500/30",
    basic: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    standard: "bg-purple-500/20 text-purple-400 border-purple-500/30",
    premium: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    enterprise: "bg-green-500/20 text-green-400 border-green-500/30",
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-slate-900 rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-slate-900 border-b border-slate-700 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-slate-800 flex items-center justify-center">
                <IconComponent className="h-6 w-6 text-slate-400" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-white">{customerName}</h2>
                {customer.company_name && (
                  <p className="text-sm text-slate-400">{customer.company_name}</p>
                )}
              </div>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Status and Tier */}
          <div className="flex items-center gap-4">
            <span
              className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${statusColors[customer.status]}`}
            >
              {customer.status.charAt(0).toUpperCase() + customer.status.slice(1)}
            </span>
            <span
              className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${tierColors[customer.tier]}`}
            >
              {customer.tier.charAt(0).toUpperCase() + customer.tier.slice(1)} Tier
            </span>
          </div>

          {/* Basic Information */}
          <div>
            <h3 className="text-sm font-medium text-slate-400 mb-3">Basic Information</h3>
            <div className="bg-slate-800/50 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-3">
                <Hash className="h-4 w-4 text-slate-500" />
                <span className="text-sm text-slate-300">
                  Customer #: {customer.customer_number}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <User className="h-4 w-4 text-slate-500" />
                <span className="text-sm text-slate-300">
                  Type: {customer.customer_type === "individual" ? "Individual" : "Business"}
                </span>
              </div>
              {customer.tax_id && (
                <div className="flex items-center gap-3">
                  <Hash className="h-4 w-4 text-slate-500" />
                  <span className="text-sm text-slate-300">Tax ID: {customer.tax_id}</span>
                </div>
              )}
              {customer.vat_number && (
                <div className="flex items-center gap-3">
                  <Hash className="h-4 w-4 text-slate-500" />
                  <span className="text-sm text-slate-300">VAT: {customer.vat_number}</span>
                </div>
              )}
            </div>
          </div>

          {/* Contact Information */}
          <div>
            <h3 className="text-sm font-medium text-slate-400 mb-3">Contact Information</h3>
            <div className="bg-slate-800/50 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-slate-500" />
                <span className="text-sm text-slate-300">{customer.email}</span>
              </div>
              {customer.phone && (
                <div className="flex items-center gap-3">
                  <Phone className="h-4 w-4 text-slate-500" />
                  <span className="text-sm text-slate-300">{customer.phone}</span>
                </div>
              )}
              {customer.website && (
                <div className="flex items-center gap-3">
                  <Globe className="h-4 w-4 text-slate-500" />
                  <a
                    href={customer.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-sky-400 hover:text-sky-300"
                  >
                    {customer.website}
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Address */}
          {(customer.address_line_1 || customer.city || customer.country) && (
            <div>
              <h3 className="text-sm font-medium text-slate-400 mb-3">Address</h3>
              <div className="bg-slate-800/50 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <MapPin className="h-4 w-4 text-slate-500 mt-0.5" />
                  <div className="text-sm text-slate-300 space-y-1">
                    {customer.address_line_1 && <div>{customer.address_line_1}</div>}
                    {customer.address_line_2 && <div>{customer.address_line_2}</div>}
                    <div>
                      {[customer.city, customer.state_province, customer.postal_code]
                        .filter(Boolean)
                        .join(", ")}
                    </div>
                    {customer.country && <div>{customer.country}</div>}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Metrics */}
          <div>
            <h3 className="text-sm font-medium text-slate-400 mb-3">Customer Metrics</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-slate-800/50 rounded-lg p-4">
                <div className="text-xs text-slate-400 mb-1">Lifetime Value</div>
                <div className="text-lg font-semibold text-white">
                  {formatCurrency(customer.lifetime_value)}
                </div>
              </div>
              <div className="bg-slate-800/50 rounded-lg p-4">
                <div className="text-xs text-slate-400 mb-1">Total Purchases</div>
                <div className="text-lg font-semibold text-white">{customer.total_purchases}</div>
              </div>
              <div className="bg-slate-800/50 rounded-lg p-4">
                <div className="text-xs text-slate-400 mb-1">Credit Limit</div>
                <div className="text-lg font-semibold text-white">
                  {customer.credit_limit ? formatCurrency(customer.credit_limit) : "N/A"}
                </div>
              </div>
            </div>
          </div>

          {/* Account Details */}
          <div>
            <h3 className="text-sm font-medium text-slate-400 mb-3">Account Details</h3>
            <div className="bg-slate-800/50 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-3">
                <Calendar className="h-4 w-4 text-slate-500" />
                <span className="text-sm text-slate-300">
                  Created: {formatDate(customer.created_at)}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <Calendar className="h-4 w-4 text-slate-500" />
                <span className="text-sm text-slate-300">
                  Last Modified: {formatDate(customer.updated_at)}
                </span>
              </div>
              {customer.last_interaction && (
                <div className="flex items-center gap-3">
                  <Calendar className="h-4 w-4 text-slate-500" />
                  <span className="text-sm text-slate-300">
                    Last Interaction: {formatDate(customer.last_interaction)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Notes */}
          {customer.notes && (
            <div>
              <h3 className="text-sm font-medium text-slate-400 mb-3">Notes</h3>
              <div className="bg-slate-800/50 rounded-lg p-4">
                <p className="text-sm text-slate-300 whitespace-pre-wrap">{customer.notes}</p>
              </div>
            </div>
          )}

          {/* Custom Fields */}
          {customer.custom_fields && Object.keys(customer.custom_fields).length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-slate-400 mb-3">Custom Fields</h3>
              <div className="bg-slate-800/50 rounded-lg p-4 space-y-2">
                {Object.entries(customer.custom_fields).map(([key, value]) => (
                  <div key={key} className="flex justify-between">
                    <span className="text-sm text-slate-400">{key}:</span>
                    <span className="text-sm text-slate-300">{String(value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-slate-900 border-t border-slate-700 p-6">
          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
