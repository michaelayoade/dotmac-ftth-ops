/**
 * Create Customer Modal - Shared Component
 *
 * Multi-tab form for creating and editing customers.
 * Parent components handle API calls and types via callbacks.
 */

import { X, Save, Loader2 } from "lucide-react";
import { useState } from "react";

export interface CreateCustomerModalProps<T = any, CreateInput = any, UpdateInput = any> {
  onClose: () => void;
  onCustomerCreated: (customer: T) => void;
  editingCustomer?: T | null;
  createCustomer: (payload: CreateInput) => Promise<T>;
  updateCustomer: (id: string, payload: UpdateInput) => Promise<T>;
  loading?: boolean;
}

interface FormData {
  first_name: string;
  last_name: string;
  middle_name: string;
  display_name: string;
  company_name: string;
  email: string;
  phone: string;
  mobile: string;
  customer_type: "individual" | "business" | "enterprise" | "partner" | "vendor";
  tier: "free" | "basic" | "standard" | "premium" | "enterprise";
  address_line1: string;
  address_line2: string;
  city: string;
  state_province: string;
  postal_code: string;
  country: string;
  preferred_language: string;
  timezone: string;
  opt_in_marketing: boolean;
  opt_in_updates: boolean;
  tags: string;
  notes: string;
}

const initialFormData: FormData = {
  first_name: "",
  last_name: "",
  middle_name: "",
  display_name: "",
  company_name: "",
  email: "",
  phone: "",
  mobile: "",
  customer_type: "individual",
  tier: "free",
  address_line1: "",
  address_line2: "",
  city: "",
  state_province: "",
  postal_code: "",
  country: "US",
  preferred_language: "en",
  timezone: "UTC",
  opt_in_marketing: false,
  opt_in_updates: true,
  tags: "",
  notes: "",
};

export function CreateCustomerModal<T = any, CreateInput = any, UpdateInput = any>({
  onClose,
  onCustomerCreated,
  editingCustomer,
  createCustomer,
  updateCustomer,
  loading = false,
}: CreateCustomerModalProps<T, CreateInput, UpdateInput>) {
  const [formData, setFormData] = useState<FormData>(() => {
    if (editingCustomer) {
      const customer = editingCustomer as any;
      return {
        first_name: customer.first_name || "",
        last_name: customer.last_name || "",
        middle_name: customer.middle_name || "",
        display_name: customer.display_name || "",
        company_name: customer.company_name || "",
        email: customer.email || "",
        phone: customer.phone || "",
        mobile: customer.mobile || "",
        customer_type: customer.customer_type || "individual",
        tier: customer.tier || "free",
        address_line1: customer.address_line_1 || "",
        address_line2: customer.address_line_2 || "",
        city: customer.city || "",
        state_province: customer.state_province || "",
        postal_code: customer.postal_code || "",
        country: customer.country || "US",
        preferred_language: "en",
        timezone: "UTC",
        opt_in_marketing: false,
        opt_in_updates: true,
        tags: (customer.tags ?? []).join(", "),
        notes: "",
      };
    }
    return initialFormData;
  });

  const [errors, setErrors] = useState<Partial<FormData>>({});
  const [activeTab, setActiveTab] = useState<"basic" | "contact" | "preferences">("basic");

  const validateForm = (): boolean => {
    const newErrors: Partial<FormData> = {};

    if (!formData.first_name.trim()) {
      newErrors.first_name = "First name is required";
    }
    if (!formData.last_name.trim()) {
      newErrors.last_name = "Last name is required";
    }
    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Invalid email format";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      const customerData = {
        ...formData,
        tags: formData.tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
        metadata: formData.notes ? { initial_notes: formData.notes } : {},
        custom_fields: {},
      };

      let result;
      if (editingCustomer) {
        result = await updateCustomer((editingCustomer as any).id, customerData as any);
      } else {
        result = await createCustomer(customerData as any);
      }

      onCustomerCreated(result);
    } catch (error) {
      console.error("Failed to save customer:", error);
      throw error;
    }
  };

  const handleInputChange = (field: keyof FormData, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-black/50 flex items-center justify-center p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-slate-900 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <h2 className="text-xl font-semibold text-white">
            {editingCustomer ? "Edit Customer" : "Create New Customer"}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Tabs */}
          <div className="border-b border-slate-700">
            <nav className="flex px-6">
              {[
                { id: "basic", label: "Basic Info" },
                { id: "contact", label: "Contact & Address" },
                { id: "preferences", label: "Preferences & Tags" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`py-4 px-6 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? "border-sky-500 text-sky-400"
                      : "border-transparent text-slate-400 hover:text-slate-300"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Form Content */}
          <div className="p-6">
            {/* Basic Info Tab */}
            {activeTab === "basic" && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      First Name *
                    </label>
                    <input
                      type="text"
                      value={formData.first_name}
                      onChange={(e) => handleInputChange("first_name", e.target.value)}
                      className={`w-full px-3 py-2 bg-slate-800 border rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 ${
                        errors.first_name ? "border-red-500" : "border-slate-700"
                      }`}
                      placeholder="Enter first name"
                    />
                    {errors.first_name && (
                      <p className="mt-1 text-sm text-red-400">{errors.first_name}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Last Name *
                    </label>
                    <input
                      type="text"
                      value={formData.last_name}
                      onChange={(e) => handleInputChange("last_name", e.target.value)}
                      className={`w-full px-3 py-2 bg-slate-800 border rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 ${
                        errors.last_name ? "border-red-500" : "border-slate-700"
                      }`}
                      placeholder="Enter last name"
                    />
                    {errors.last_name && (
                      <p className="mt-1 text-sm text-red-400">{errors.last_name}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Middle Name
                    </label>
                    <input
                      type="text"
                      value={formData.middle_name}
                      onChange={(e) => handleInputChange("middle_name", e.target.value)}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
                      placeholder="Enter middle name"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Display Name
                    </label>
                    <input
                      type="text"
                      value={formData.display_name}
                      onChange={(e) => handleInputChange("display_name", e.target.value)}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
                      placeholder="Preferred display name"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Company Name
                    </label>
                    <input
                      type="text"
                      value={formData.company_name}
                      onChange={(e) => handleInputChange("company_name", e.target.value)}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
                      placeholder="Enter company name"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Email Address *
                    </label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleInputChange("email", e.target.value)}
                      className={`w-full px-3 py-2 bg-slate-800 border rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 ${
                        errors.email ? "border-red-500" : "border-slate-700"
                      }`}
                      placeholder="Enter email address"
                    />
                    {errors.email && <p className="mt-1 text-sm text-red-400">{errors.email}</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Customer Type
                    </label>
                    <select
                      value={formData.customer_type}
                      onChange={(e) => handleInputChange("customer_type", e.target.value)}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                    >
                      <option value="individual">Individual</option>
                      <option value="business">Business</option>
                      <option value="enterprise">Enterprise</option>
                      <option value="partner">Partner</option>
                      <option value="vendor">Vendor</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Tier</label>
                    <select
                      value={formData.tier}
                      onChange={(e) => handleInputChange("tier", e.target.value)}
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
              </div>
            )}

            {/* Contact & Address Tab */}
            {activeTab === "contact" && (
              <div className="space-y-6">
                {/* Contact Information */}
                <div>
                  <h3 className="text-lg font-medium text-white mb-4">Contact Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Phone Number
                      </label>
                      <input
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => handleInputChange("phone", e.target.value)}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
                        placeholder="+1 (555) 123-4567"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Mobile Number
                      </label>
                      <input
                        type="tel"
                        value={formData.mobile}
                        onChange={(e) => handleInputChange("mobile", e.target.value)}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
                        placeholder="+1 (555) 123-4567"
                      />
                    </div>
                  </div>
                </div>

                {/* Address Information */}
                <div>
                  <h3 className="text-lg font-medium text-white mb-4">Address Information</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Address Line 1
                      </label>
                      <input
                        type="text"
                        value={formData.address_line1}
                        onChange={(e) => handleInputChange("address_line1", e.target.value)}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
                        placeholder="123 Main Street"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Address Line 2
                      </label>
                      <input
                        type="text"
                        value={formData.address_line2}
                        onChange={(e) => handleInputChange("address_line2", e.target.value)}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
                        placeholder="Suite 100"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                          City
                        </label>
                        <input
                          type="text"
                          value={formData.city}
                          onChange={(e) => handleInputChange("city", e.target.value)}
                          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
                          placeholder="New York"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                          State/Province
                        </label>
                        <input
                          type="text"
                          value={formData.state_province}
                          onChange={(e) => handleInputChange("state_province", e.target.value)}
                          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
                          placeholder="NY"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                          Postal Code
                        </label>
                        <input
                          type="text"
                          value={formData.postal_code}
                          onChange={(e) => handleInputChange("postal_code", e.target.value)}
                          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
                          placeholder="10001"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Country
                      </label>
                      <select
                        value={formData.country}
                        onChange={(e) => handleInputChange("country", e.target.value)}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                      >
                        <option value="US">United States</option>
                        <option value="CA">Canada</option>
                        <option value="GB">United Kingdom</option>
                        <option value="DE">Germany</option>
                        <option value="FR">France</option>
                        <option value="AU">Australia</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Preferences & Tags Tab */}
            {activeTab === "preferences" && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Preferred Language
                    </label>
                    <select
                      value={formData.preferred_language}
                      onChange={(e) => handleInputChange("preferred_language", e.target.value)}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                    >
                      <option value="en">English</option>
                      <option value="es">Spanish</option>
                      <option value="fr">French</option>
                      <option value="de">German</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Timezone
                    </label>
                    <select
                      value={formData.timezone}
                      onChange={(e) => handleInputChange("timezone", e.target.value)}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                    >
                      <option value="UTC">UTC</option>
                      <option value="America/New_York">Eastern Time</option>
                      <option value="America/Chicago">Central Time</option>
                      <option value="America/Denver">Mountain Time</option>
                      <option value="America/Los_Angeles">Pacific Time</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="opt_in_marketing"
                      checked={formData.opt_in_marketing}
                      onChange={(e) => handleInputChange("opt_in_marketing", e.target.checked)}
                      className="h-4 w-4 text-sky-600 focus:ring-sky-500 border-slate-700 rounded bg-slate-800"
                    />
                    <label htmlFor="opt_in_marketing" className="ml-2 text-sm text-slate-300">
                      Opt in to marketing communications
                    </label>
                  </div>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="opt_in_updates"
                      checked={formData.opt_in_updates}
                      onChange={(e) => handleInputChange("opt_in_updates", e.target.checked)}
                      className="h-4 w-4 text-sky-600 focus:ring-sky-500 border-slate-700 rounded bg-slate-800"
                    />
                    <label htmlFor="opt_in_updates" className="ml-2 text-sm text-slate-300">
                      Receive product updates and announcements
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Tags</label>
                  <input
                    type="text"
                    value={formData.tags}
                    onChange={(e) => handleInputChange("tags", e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
                    placeholder="vip, priority, enterprise (comma separated)"
                  />
                  <p className="mt-1 text-xs text-slate-400">Enter tags separated by commas</p>
                </div>

                {!editingCustomer && (
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Initial Notes
                    </label>
                    <textarea
                      value={formData.notes}
                      onChange={(e) => handleInputChange("notes", e.target.value)}
                      rows={4}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
                      placeholder="Any initial notes about this customer..."
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-4 p-6 border-t border-slate-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-sky-500 hover:bg-sky-600 disabled:bg-sky-500/50 text-white rounded-lg font-medium transition-colors"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {editingCustomer ? "Updating..." : "Creating..."}
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  {editingCustomer ? "Update Customer" : "Create Customer"}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
