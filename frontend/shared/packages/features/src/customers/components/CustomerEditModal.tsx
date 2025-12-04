"use client";

import { X, Save, User, Building } from "lucide-react";
import { useState } from "react";

export interface CustomerEditModalProps<TCustomer = any> {
  customer?: TCustomer | null;
  onClose: () => void;
  onCustomerUpdated: (customer: TCustomer) => void;
  updateCustomer?: (id: string, data: any) => Promise<TCustomer>;
  loading?: boolean;
}

export function CustomerEditModal<TCustomer = any>({
  customer,
  onClose,
  onCustomerUpdated,
  updateCustomer,
  loading = false,
}: CustomerEditModalProps<TCustomer>) {
  const customerData = customer as any;
  const [formData, setFormData] = useState({
    customer_type: customerData?.customer_type || "individual",
    first_name: customerData?.first_name || "",
    middle_name: customerData?.middle_name || "",
    last_name: customerData?.last_name || "",
    display_name: customerData?.display_name || "",
    company_name: customerData?.company_name || "",
    email: customerData?.email || "",
    phone: customerData?.phone || "",
    website: customerData?.website || "",
    status: customerData?.status || "active",
    tier: customerData?.tier || "basic",
    tax_id: customerData?.tax_id || "",
    vat_number: customerData?.vat_number || "",
    address_line_1: customerData?.address_line_1 || "",
    address_line_2: customerData?.address_line_2 || "",
    city: customerData?.city || "",
    state_province: customerData?.state_province || "",
    postal_code: customerData?.postal_code || "",
    country: customerData?.country || "",
    credit_limit: customerData?.credit_limit || 0,
    payment_terms: customerData?.payment_terms || 30,
    notes: customerData?.notes || "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate required fields
    const newErrors: Record<string, string> = {};
    if (!formData["email"]) {
      newErrors["email"] = "Email is required";
    }
    if (formData["customer_type"] === "individual") {
      if (!formData["first_name"]) {
        newErrors["first_name"] = "First name is required";
      }
      if (!formData["last_name"]) {
        newErrors["last_name"] = "Last name is required";
      }
    } else {
      if (!formData["company_name"]) {
        newErrors["company_name"] = "Company name is required";
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      if (updateCustomer && customer) {
        const updatedCustomer = await updateCustomer(customerData.id, formData);
        onCustomerUpdated(updatedCustomer);
      }
    } catch (error) {
      console.error(
        "Failed to update customer",
        error instanceof Error ? error : new Error(String(error)),
      );
      setErrors({ submit: "Failed to update customer. Please try again." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear error for this field when user starts typing
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const isIndividual = formData.customer_type === "individual";

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-slate-900 rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          {/* Header */}
          <div className="sticky top-0 bg-slate-900 border-b border-slate-700 p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-white">
                {customer ? "Edit Customer" : "Create Customer"}
              </h2>
              <button
                type="button"
                onClick={onClose}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {errors["submit"] && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg text-sm">
                {errors["submit"]}
              </div>
            )}

            {/* Customer Type */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Customer Type</label>
              <div className="flex gap-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="customer_type"
                    value="individual"
                    checked={formData.customer_type === "individual"}
                    onChange={handleChange}
                    className="mr-2"
                  />
                  <User className="h-4 w-4 mr-1" />
                  Individual
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="customer_type"
                    value="business"
                    checked={formData.customer_type === "business"}
                    onChange={handleChange}
                    className="mr-2"
                  />
                  <Building className="h-4 w-4 mr-1" />
                  Business
                </label>
              </div>
            </div>

            {/* Name Fields */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {isIndividual ? (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      First Name *
                    </label>
                    <input
                      type="text"
                      name="first_name"
                      value={formData.first_name}
                      onChange={handleChange}
                      className={`w-full px-3 py-2 bg-slate-800 border ${
                        errors["first_name"] ? "border-red-500" : "border-slate-700"
                      } rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500`}
                    />
                    {errors["first_name"] && (
                      <p className="mt-1 text-xs text-red-400">{errors["first_name"]}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Middle Name
                    </label>
                    <input
                      type="text"
                      name="middle_name"
                      value={formData.middle_name}
                      onChange={handleChange}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Last Name *
                    </label>
                    <input
                      type="text"
                      name="last_name"
                      value={formData.last_name}
                      onChange={handleChange}
                      className={`w-full px-3 py-2 bg-slate-800 border ${
                        errors["last_name"] ? "border-red-500" : "border-slate-700"
                      } rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500`}
                    />
                    {errors["last_name"] && (
                      <p className="mt-1 text-xs text-red-400">{errors["last_name"]}</p>
                    )}
                  </div>
                </>
              ) : (
                <div className="md:col-span-3">
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Company Name *
                  </label>
                  <input
                    type="text"
                    name="company_name"
                    value={formData.company_name}
                    onChange={handleChange}
                    className={`w-full px-3 py-2 bg-slate-800 border ${
                      errors["company_name"] ? "border-red-500" : "border-slate-700"
                    } rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500`}
                  />
                  {errors["company_name"] && (
                    <p className="mt-1 text-xs text-red-400">{errors["company_name"]}</p>
                  )}
                </div>
              )}
            </div>

            {/* Display Name */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Display Name</label>
              <input
                type="text"
                name="display_name"
                value={formData.display_name}
                onChange={handleChange}
                placeholder={
                  isIndividual ? "Leave empty to use full name" : "Leave empty to use company name"
                }
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>

            {/* Contact Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Email *</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className={`w-full px-3 py-2 bg-slate-800 border ${
                    errors["email"] ? "border-red-500" : "border-slate-700"
                  } rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500`}
                />
                {errors["email"] && <p className="mt-1 text-xs text-red-400">{errors["email"]}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Phone</label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
            </div>

            {/* Website */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Website</label>
              <input
                type="url"
                name="website"
                value={formData.website}
                onChange={handleChange}
                placeholder="https://example.com"
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>

            {/* Status and Tier */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Status</label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                >
                  <option value="prospect">Prospect</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="suspended">Suspended</option>
                  <option value="churned">Churned</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Tier</label>
                <select
                  name="tier"
                  value={formData.tier}
                  onChange={handleChange}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                >
                  <option value="free">Free</option>
                  <option value="basic">Basic</option>
                  <option value="standard">Standard</option>
                  <option value="premium">Premium</option>
                  <option value="enterprise">Enterprise</option>
                </select>
              </div>
            </div>

            {/* Tax Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Tax ID</label>
                <input
                  type="text"
                  name="tax_id"
                  value={formData.tax_id}
                  onChange={handleChange}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">VAT Number</label>
                <input
                  type="text"
                  name="vat_number"
                  value={formData.vat_number}
                  onChange={handleChange}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
            </div>

            {/* Address */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-slate-300">Address</h3>
              <div>
                <input
                  type="text"
                  name="address_line_1"
                  value={formData.address_line_1}
                  onChange={handleChange}
                  placeholder="Address Line 1"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
              <div>
                <input
                  type="text"
                  name="address_line_2"
                  value={formData.address_line_2}
                  onChange={handleChange}
                  placeholder="Address Line 2"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <input
                  type="text"
                  name="city"
                  value={formData.city}
                  onChange={handleChange}
                  placeholder="City"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
                <input
                  type="text"
                  name="state_province"
                  value={formData.state_province}
                  onChange={handleChange}
                  placeholder="State/Province"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
                <input
                  type="text"
                  name="postal_code"
                  value={formData.postal_code}
                  onChange={handleChange}
                  placeholder="Postal Code"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
                <input
                  type="text"
                  name="country"
                  value={formData.country}
                  onChange={handleChange}
                  placeholder="Country"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
            </div>

            {/* Billing */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Credit Limit
                </label>
                <input
                  type="number"
                  name="credit_limit"
                  value={formData.credit_limit}
                  onChange={handleChange}
                  min="0"
                  step="0.01"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Payment Terms (Days)
                </label>
                <input
                  type="number"
                  name="payment_terms"
                  value={formData.payment_terms}
                  onChange={handleChange}
                  min="0"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Notes</label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                rows={4}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
                placeholder="Internal notes about this customer..."
              />
            </div>
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 bg-slate-900 border-t border-slate-700 p-6">
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || loading}
                className="flex items-center gap-2 px-4 py-2 bg-sky-500 hover:bg-sky-600 disabled:bg-slate-700 text-white rounded-lg transition-colors"
              >
                <Save className="h-4 w-4" />
                {isSubmitting ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
