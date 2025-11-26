"use client";

import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { X, Save, User, Building } from "lucide-react";
import { useToast } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@dotmac/ui";
import { Customer } from "@/types";
import { apiClient } from "@/lib/api/client";
import { queryKeys } from "@/lib/query-client";
import { logger } from "@/lib/logger";
import { useQueryClient, type QueryKey } from "@tanstack/react-query";
import { useFormMutation, invalidateQueries } from "@dotmac/graphql";

interface CustomerEditModalProps {
  customer: Customer;
  onClose: () => void;
  onCustomerUpdated: (customer: Customer) => void;
  /**
   * Optional override for updating a customer (legacy REST integration).
   * If omitted, the component falls back to the shared apiClient.
   */
  updateCustomer?: (id: string, data: Partial<Customer>) => Promise<Customer>;
  loading?: boolean;
}

const customerSchema = z
  .object({
    customer_type: z.enum(["individual", "business"]),
    first_name: z.string().optional(),
    middle_name: z.string().optional(),
    last_name: z.string().optional(),
    display_name: z.string().optional(),
    company_name: z.string().optional(),
    email: z.string().email("Please enter a valid email"),
    phone: z.string().optional(),
    website: z.string().url("Please enter a valid URL").or(z.literal("")).optional(),
    status: z.enum(["prospect", "active", "inactive", "suspended", "churned", "archived"]),
    tier: z.enum(["free", "basic", "standard", "premium", "enterprise"]),
    tax_id: z.string().optional(),
    vat_number: z.string().optional(),
    address_line_1: z.string().optional(),
    address_line_2: z.string().optional(),
    city: z.string().optional(),
    state_province: z.string().optional(),
    postal_code: z.string().optional(),
    country: z.string().optional(),
    credit_limit: z.coerce.number().min(0, "Must be zero or greater").optional(),
    payment_terms: z.coerce
      .number()
      .int("Must be an integer")
      .min(0, "Must be zero or greater")
      .optional(),
    notes: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.customer_type === "individual") {
      if (!data.first_name?.trim()) {
        ctx.addIssue({
          path: ["first_name"],
          code: z.ZodIssueCode.custom,
          message: "First name is required",
        });
      }
      if (!data.last_name?.trim()) {
        ctx.addIssue({
          path: ["last_name"],
          code: z.ZodIssueCode.custom,
          message: "Last name is required",
        });
      }
    } else {
      if (!data.company_name?.trim()) {
        ctx.addIssue({
          path: ["company_name"],
          code: z.ZodIssueCode.custom,
          message: "Company name is required",
        });
      }
    }
  });

type CustomerFormData = z.infer<typeof customerSchema>;

const assignIfDefined = <T extends keyof Customer>(
  target: Partial<Customer>,
  key: T,
  value: Customer[T] | undefined,
) => {
  if (value !== undefined) {
    target[key] = value;
  }
};

function buildPayload(values: CustomerFormData): Partial<Customer> {
  const payload: Partial<Customer> = {
    customer_type: values.customer_type,
    status: values.status,
    tier: values.tier,
  };

  assignIfDefined(payload, "first_name", values.first_name);
  assignIfDefined(payload, "middle_name", values.middle_name);
  assignIfDefined(payload, "last_name", values.last_name);
  assignIfDefined(payload, "display_name", values.display_name);
  assignIfDefined(payload, "company_name", values.company_name);
  assignIfDefined(payload, "email", values.email);
  assignIfDefined(payload, "phone", values.phone);
  assignIfDefined(payload, "website", values.website);
  assignIfDefined(payload, "tax_id", values.tax_id);
  assignIfDefined(payload, "vat_number", values.vat_number);
  assignIfDefined(payload, "address_line_1", values.address_line_1);
  assignIfDefined(payload, "address_line_2", values.address_line_2);
  assignIfDefined(payload, "city", values.city);
  assignIfDefined(payload, "state_province", values.state_province);
  assignIfDefined(payload, "postal_code", values.postal_code);
  assignIfDefined(payload, "country", values.country);
  assignIfDefined(payload, "notes", values.notes);

  if (values.credit_limit !== undefined && Number.isFinite(values.credit_limit)) {
    payload.credit_limit = Number(values.credit_limit);
  }

  if (values.payment_terms !== undefined && Number.isFinite(values.payment_terms)) {
    payload.payment_terms = Number(values.payment_terms);
  }

  return payload;
}

export function CustomerEditModalRefactored({
  customer,
  onClose,
  onCustomerUpdated,
  updateCustomer,
  loading = false,
}: CustomerEditModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const defaultValues = useMemo<CustomerFormData>(
    () => ({
      customer_type: (customer.customer_type === "individual" ||
      customer.customer_type === "business"
        ? customer.customer_type
        : "individual") as "individual" | "business",
      first_name: customer.first_name ?? "",
      middle_name: customer.middle_name ?? "",
      last_name: customer.last_name ?? "",
      display_name: customer.display_name ?? "",
      company_name: customer.company_name ?? "",
      email: customer.email ?? "",
      phone: customer.phone ?? "",
      website: customer.website ?? "",
      status: customer.status ?? "active",
      tier: customer.tier ?? "basic",
      tax_id: customer.tax_id ?? "",
      vat_number: customer.vat_number ?? "",
      address_line_1: customer.address_line_1 ?? "",
      address_line_2: customer.address_line_2 ?? "",
      city: customer.city ?? "",
      state_province: customer.state_province ?? "",
      postal_code: customer.postal_code ?? "",
      country: customer.country ?? "",
      credit_limit: customer.credit_limit ?? undefined,
      payment_terms: customer.payment_terms ?? undefined,
      notes: customer.notes ?? "",
    }),
    [customer],
  );

  const form = useForm<CustomerFormData>({
    resolver: zodResolver(customerSchema),
    defaultValues,
    mode: "onSubmit",
  });

  const invalidateTargets = useMemo<QueryKey[]>(() => {
    const keys: QueryKey[] = [queryKeys.customers.lists()];
    if (customer) {
      keys.push(queryKeys.customers.detail(customer.id));
    }
    return keys;
  }, [customer]);

  const mutationFn = async (values: CustomerFormData) => {
    const payload = buildPayload(values);

    if (updateCustomer) {
      return updateCustomer(customer.id, payload);
    }

    const response = await apiClient.put(`/customers/${customer.id}`, payload);
    return response.data as Customer;
  };

  const mutationOptions = {
    toast,
    logger,
    successMessage: (data: Customer) =>
      `Customer ${data.display_name || data.email || data.customer_number} updated`,
    errorMessage: "Failed to update customer",
    operationName: "UpdateCustomer",
    onSuccess: (data: Customer) => {
      onCustomerUpdated(data);
      onClose();
    },
  };

  const mutation = useFormMutation(
    {
      reset: form.reset,
      setError: (field, errorDetails) => form.setError(field as never, errorDetails),
    },
    {
      mutationFn,
      ...invalidateQueries(queryClient, invalidateTargets),
    },
    {
      ...mutationOptions,
      resetOnSuccess: false,
    },
  );

  const { mutate, isPending } = mutation;
  const submitting = isPending || loading;
  const { errors } = form.formState;
  const isIndividual = form.watch("customer_type") === "individual";

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-slate-900 border border-slate-700">
        <DialogHeader className="">
          <DialogTitle className="flex items-center justify-between">
            <span>{customer ? "Edit Customer" : "Create Customer"}</span>
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-white transition-colors"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </DialogTitle>
          <DialogDescription>
            Update customer profile details, contact information, and billing preferences.
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-6"
          onSubmit={form.handleSubmit((data) => {
            mutate(data);
          })}
          noValidate
        >
          {errors.root?.message && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg text-sm">
              {errors.root.message}
            </div>
          )}

          {/* Customer type */}
          <section>
            <label className="block text-sm font-medium text-slate-300 mb-2">Customer Type</label>
            <div className="flex gap-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  value="individual"
                  className="mr-2"
                  disabled={submitting}
                  {...form.register("customer_type")}
                />
                <User className="h-4 w-4 mr-1" />
                Individual
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  value="business"
                  className="mr-2"
                  disabled={submitting}
                  {...form.register("customer_type")}
                />
                <Building className="h-4 w-4 mr-1" />
                Business
              </label>
            </div>
          </section>

          {/* Primary name fields */}
          <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {isIndividual ? (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    First Name *
                  </label>
                  <input
                    type="text"
                    className={`w-full px-3 py-2 bg-slate-800 border ${
                      errors.first_name ? "border-red-500" : "border-slate-700"
                    } rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500`}
                    disabled={submitting}
                    {...form.register("first_name")}
                  />
                  {errors.first_name && (
                    <p className="mt-1 text-xs text-red-400">{errors.first_name.message}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Middle Name
                  </label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
                    disabled={submitting}
                    {...form.register("middle_name")}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Last Name *
                  </label>
                  <input
                    type="text"
                    className={`w-full px-3 py-2 bg-slate-800 border ${
                      errors.last_name ? "border-red-500" : "border-slate-700"
                    } rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500`}
                    disabled={submitting}
                    {...form.register("last_name")}
                  />
                  {errors.last_name && (
                    <p className="mt-1 text-xs text-red-400">{errors.last_name.message}</p>
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
                  className={`w-full px-3 py-2 bg-slate-800 border ${
                    errors.company_name ? "border-red-500" : "border-slate-700"
                  } rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500`}
                  disabled={submitting}
                  {...form.register("company_name")}
                />
                {errors.company_name && (
                  <p className="mt-1 text-xs text-red-400">{errors.company_name.message}</p>
                )}
              </div>
            )}
          </section>

          {/* Display name */}
          <section>
            <label className="block text-sm font-medium text-slate-300 mb-2">Display Name</label>
            <input
              type="text"
              placeholder={
                isIndividual ? "Leave empty to use full name" : "Leave empty to use company name"
              }
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
              disabled={submitting}
              {...form.register("display_name")}
            />
          </section>

          {/* Contact */}
          <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Email *</label>
              <input
                type="email"
                className={`w-full px-3 py-2 bg-slate-800 border ${
                  errors.email ? "border-red-500" : "border-slate-700"
                } rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500`}
                disabled={submitting}
                {...form.register("email")}
              />
              {errors.email && <p className="mt-1 text-xs text-red-400">{errors.email.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Phone</label>
              <input
                type="tel"
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
                disabled={submitting}
                {...form.register("phone")}
              />
            </div>
          </section>

          <section>
            <label className="block text-sm font-medium text-slate-300 mb-2">Website</label>
            <input
              type="url"
              placeholder="https://example.com"
              className={`w-full px-3 py-2 bg-slate-800 border ${
                errors.website ? "border-red-500" : "border-slate-700"
              } rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500`}
              disabled={submitting}
              {...form.register("website")}
            />
            {errors.website && (
              <p className="mt-1 text-xs text-red-400">{errors.website.message}</p>
            )}
          </section>

          {/* Status & Tier */}
          <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Status</label>
              <select
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                disabled={submitting}
                {...form.register("status")}
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
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                disabled={submitting}
                {...form.register("tier")}
              >
                <option value="free">Free</option>
                <option value="basic">Basic</option>
                <option value="standard">Standard</option>
                <option value="premium">Premium</option>
                <option value="enterprise">Enterprise</option>
              </select>
            </div>
          </section>

          {/* Business identifiers */}
          <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Tax ID</label>
              <input
                type="text"
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
                disabled={submitting}
                {...form.register("tax_id")}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">VAT Number</label>
              <input
                type="text"
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
                disabled={submitting}
                {...form.register("vat_number")}
              />
            </div>
          </section>

          {/* Address */}
          <section className="space-y-4">
            <h3 className="text-sm font-medium text-slate-300">Address</h3>
            <input
              type="text"
              placeholder="Address Line 1"
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
              disabled={submitting}
              {...form.register("address_line_1")}
            />
            <input
              type="text"
              placeholder="Address Line 2"
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
              disabled={submitting}
              {...form.register("address_line_2")}
            />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <input
                type="text"
                placeholder="City"
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
                disabled={submitting}
                {...form.register("city")}
              />
              <input
                type="text"
                placeholder="State/Province"
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
                disabled={submitting}
                {...form.register("state_province")}
              />
              <input
                type="text"
                placeholder="Postal Code"
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
                disabled={submitting}
                {...form.register("postal_code")}
              />
              <input
                type="text"
                placeholder="Country"
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
                disabled={submitting}
                {...form.register("country")}
              />
            </div>
          </section>

          {/* Financial */}
          <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Credit Limit</label>
              <input
                type="number"
                min={0}
                step={1}
                className={`w-full px-3 py-2 bg-slate-800 border ${
                  errors.credit_limit ? "border-red-500" : "border-slate-700"
                } rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500`}
                disabled={submitting}
                {...form.register("credit_limit")}
              />
              {errors.credit_limit && (
                <p className="mt-1 text-xs text-red-400">{errors.credit_limit.message}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Payment Terms (days)
              </label>
              <input
                type="number"
                min={0}
                step={1}
                className={`w-full px-3 py-2 bg-slate-800 border ${
                  errors.payment_terms ? "border-red-500" : "border-slate-700"
                } rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500`}
                disabled={submitting}
                {...form.register("payment_terms")}
              />
              {errors.payment_terms && (
                <p className="mt-1 text-xs text-red-400">{errors.payment_terms.message}</p>
              )}
            </div>
          </section>

          {/* Notes */}
          <section>
            <label className="block text-sm font-medium text-slate-300 mb-2">Notes</label>
            <textarea
              rows={4}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
              disabled={submitting}
              {...form.register("notes")}
            />
          </section>

          <DialogFooter className="border-t border-slate-800 pt-4 flex justify-between items-center">
            <div className="text-xs text-slate-400">
              Fields marked with * are required. Changes are saved immediately after clicking
              &ldquo;Save changes&rdquo;.
            </div>
            <div className="flex gap-3">
              <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? (
                  <>
                    <Save className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save changes
                  </>
                )}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
