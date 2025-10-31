"use client";

import { useCallback, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { useCustomerListGraphQL } from "@/hooks/useCustomersGraphQL";
import { apiClient } from "@/lib/api/client";
import { formatCurrency } from "@/lib/utils/currency";
import { Plus, Trash2 } from "lucide-react";

interface CreateInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  tenantId?: string | null;
  onSuccess?: () => void;
}

interface LineItemForm {
  description: string;
  quantity: string;
  unit_price: string;
}

interface AddressForm {
  line1: string;
  line2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

interface InvoiceFormData {
  customerId: string;
  billingEmail: string;
  dueDate: string;
  currency: string;
  notes: string;
  address: AddressForm;
  lineItems: LineItemForm[];
}

const defaultAddress: AddressForm = {
  line1: "",
  line2: "",
  city: "",
  state: "",
  postalCode: "",
  country: "",
};

const defaultLineItem: LineItemForm = {
  description: "",
  quantity: "1",
  unit_price: "0",
};

const getDefaultDueDate = (): string => {
  const date = new Date();
  date.setDate(date.getDate() + 30);
  return date.toISOString().split("T")[0] ?? "";
};

export function CreateInvoiceModal({
  isOpen,
  onClose,
  tenantId,
  onSuccess,
}: CreateInvoiceModalProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<InvoiceFormData>({
    customerId: "",
    billingEmail: "",
    dueDate: getDefaultDueDate(),
    currency: "USD",
    notes: "",
    address: defaultAddress,
    lineItems: [defaultLineItem],
  });

  const { customers, isLoading: loadingCustomers } = useCustomerListGraphQL({
    limit: 100,
    offset: 0,
    enabled: isOpen,
  });

  const customerOptions = useMemo(
    () =>
      customers.map((customer) => ({
        id: customer.id,
        name: customer.displayName ?? `${customer.firstName} ${customer.lastName}`,
        email: customer.email,
        address: {
          line1: customer.addressLine1 ?? "",
          line2: customer.addressLine2 ?? "",
          city: customer.city ?? "",
          state: customer.stateProvince ?? "",
          postalCode: customer.postalCode ?? "",
          country: customer.country ?? "",
        },
      })),
    [customers],
  );

  const selectedCustomer = useMemo(
    () => customerOptions.find((customer) => customer.id === formData.customerId),
    [customerOptions, formData.customerId],
  );

  const handleCustomerChange = useCallback(
    (customerId: string) => {
      const customer = customerOptions.find((item) => item.id === customerId);
      setFormData((prev) => ({
        ...prev,
        customerId,
        billingEmail: customer?.email ?? prev.billingEmail,
        address: customer
          ? {
              line1: customer.address.line1,
              line2: customer.address.line2,
              city: customer.address.city,
              state: customer.address.state,
              postalCode: customer.address.postalCode,
              country: customer.address.country,
            }
          : prev.address,
      }));
    },
    [customerOptions],
  );

  const handleLineItemChange = useCallback((index: number, key: keyof LineItemForm, value: string) => {
    setFormData((prev) => {
      const updated = [...prev.lineItems];
      updated[index] = { ...updated[index], [key]: value };
      return { ...prev, lineItems: updated };
    });
  }, []);

  const addLineItem = useCallback(() => {
    setFormData((prev) => ({
      ...prev,
      lineItems: [...prev.lineItems, { ...defaultLineItem }],
    }));
  }, []);

  const removeLineItem = useCallback((index: number) => {
    setFormData((prev) => {
      if (prev.lineItems.length === 1) {
        return prev;
      }
      return {
        ...prev,
        lineItems: prev.lineItems.filter((_, idx) => idx !== index),
      };
    });
  }, []);

  const resetForm = useCallback(() => {
    setFormData({
      customerId: "",
      billingEmail: "",
      dueDate: getDefaultDueDate(),
      currency: "USD",
      notes: "",
      address: defaultAddress,
      lineItems: [defaultLineItem],
    });
  }, []);

  const handleClose = useCallback(() => {
    if (isSubmitting) return;
    resetForm();
    onClose();
  }, [isSubmitting, onClose, resetForm]);

  const invoiceTotal = useMemo(() => {
    return formData.lineItems.reduce((sum, item) => {
      const quantity = Number(item.quantity) || 0;
      const unitPrice = Number(item.unit_price) || 0;
      return sum + quantity * unitPrice;
    }, 0);
  }, [formData.lineItems]);

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (isSubmitting) return;

      if (!formData.customerId) {
        toast({
          title: "Customer Required",
          description: "Please select a customer before creating an invoice.",
          variant: "destructive",
        });
        return;
      }

      if (!formData.billingEmail) {
        toast({
          title: "Billing Email Required",
          description: "Billing email is required for delivering the invoice.",
          variant: "destructive",
        });
        return;
      }

      const preparedLineItems = formData.lineItems.map((item) => ({
        description: item.description.trim(),
        quantity: Number(item.quantity) || 0,
        unit_price: Number(item.unit_price) || 0,
      }));

      const invalidLine = preparedLineItems.find(
        (item) => !item.description || item.quantity <= 0 || item.unit_price < 0,
      );

      if (invalidLine) {
        toast({
          title: "Invalid Line Item",
          description: "Each line item needs a description, quantity greater than 0, and a non-negative price.",
          variant: "destructive",
        });
        return;
      }

      const payload = {
        customer_id: formData.customerId,
        billing_email: formData.billingEmail,
        billing_address: {
          line1: formData.address.line1,
          line2: formData.address.line2,
          city: formData.address.city,
          state: formData.address.state,
          postal_code: formData.address.postalCode,
          country: formData.address.country,
        },
        line_items: preparedLineItems.map((item) => ({
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
        })),
        currency: formData.currency,
        due_date: formData.dueDate ? new Date(formData.dueDate).toISOString() : null,
        notes: formData.notes || undefined,
        extra_data: {},
      };

      setIsSubmitting(true);
      try {
        await apiClient.post("/billing/invoices", payload, {
          headers: tenantId ? { "X-Tenant-ID": tenantId } : undefined,
        });

        toast({
          title: "Invoice Created",
          description: `Invoice total ${formatCurrency(invoiceTotal, formData.currency)} created successfully.`,
        });

        onSuccess?.();
        resetForm();
        onClose();
      } catch (error: any) {
        const message =
          error?.response?.data?.detail ||
          error?.message ||
          "Failed to create invoice. Please try again.";
        toast({
          title: "Creation Failed",
          description: message,
          variant: "destructive",
        });
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      formData,
      invoiceTotal,
      isSubmitting,
      onClose,
      onSuccess,
      resetForm,
      tenantId,
      toast,
    ],
  );

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create Invoice</DialogTitle>
            <DialogDescription>
              Generate a new invoice for a customer. Fill out the customer details, line items, and billing information.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-6 space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="customer">Customer *</Label>
                <Select
                  value={formData.customerId}
                  onValueChange={handleCustomerChange}
                  disabled={loadingCustomers}
                >
                  <SelectTrigger id="customer">
                    <SelectValue placeholder={loadingCustomers ? "Loading customers..." : "Select a customer"} />
                  </SelectTrigger>
                  <SelectContent>
                    {customerOptions.map((customer) => (
                      <SelectItem key={customer.id} value={customer.id}>
                        <div className="flex flex-col gap-0.5">
                          <span>{customer.name}</span>
                          <span className="text-xs text-muted-foreground">{customer.email}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="billingEmail">Billing Email *</Label>
                <Input
                  id="billingEmail"
                  type="email"
                  value={formData.billingEmail}
                  onChange={(event) =>
                    setFormData((prev) => ({ ...prev, billingEmail: event.target.value }))
                  }
                  required
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="dueDate">Due Date</Label>
                <Input
                  id="dueDate"
                  type="date"
                  value={formData.dueDate}
                  onChange={(event) =>
                    setFormData((prev) => ({ ...prev, dueDate: event.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="currency">Currency</Label>
                <Input
                  id="currency"
                  value={formData.currency}
                  onChange={(event) =>
                    setFormData((prev) => ({ ...prev, currency: event.target.value.toUpperCase() }))
                  }
                  maxLength={3}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Billing Address</Label>
              <div className="grid gap-3 md:grid-cols-2">
                <Input
                  placeholder="Address line 1"
                  value={formData.address.line1}
                  onChange={(event) =>
                    setFormData((prev) => ({
                      ...prev,
                      address: { ...prev.address, line1: event.target.value },
                    }))
                  }
                />
                <Input
                  placeholder="Address line 2"
                  value={formData.address.line2}
                  onChange={(event) =>
                    setFormData((prev) => ({
                      ...prev,
                      address: { ...prev.address, line2: event.target.value },
                    }))
                  }
                />
                <Input
                  placeholder="City"
                  value={formData.address.city}
                  onChange={(event) =>
                    setFormData((prev) => ({
                      ...prev,
                      address: { ...prev.address, city: event.target.value },
                    }))
                  }
                />
                <Input
                  placeholder="State / Province"
                  value={formData.address.state}
                  onChange={(event) =>
                    setFormData((prev) => ({
                      ...prev,
                      address: { ...prev.address, state: event.target.value },
                    }))
                  }
                />
                <Input
                  placeholder="Postal code"
                  value={formData.address.postalCode}
                  onChange={(event) =>
                    setFormData((prev) => ({
                      ...prev,
                      address: { ...prev.address, postalCode: event.target.value },
                    }))
                  }
                />
                <Input
                  placeholder="Country"
                  value={formData.address.country}
                  onChange={(event) =>
                    setFormData((prev) => ({
                      ...prev,
                      address: { ...prev.address, country: event.target.value },
                    }))
                  }
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Line Items</Label>
                <Button type="button" variant="outline" size="sm" onClick={addLineItem}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Line Item
                </Button>
              </div>

              <div className="space-y-4">
                {formData.lineItems.map((item, index) => (
                  <div
                    key={`line-item-${index}`}
                    className="grid gap-3 md:grid-cols-12 border border-border rounded-lg p-4"
                  >
                    <div className="md:col-span-6 space-y-2">
                      <Label htmlFor={`description-${index}`}>Description</Label>
                      <Textarea
                        id={`description-${index}`}
                        value={item.description}
                        onChange={(event) => handleLineItemChange(index, "description", event.target.value)}
                        placeholder="Service description"
                        rows={2}
                      />
                    </div>
                    <div className="md:col-span-3 space-y-2">
                      <Label htmlFor={`quantity-${index}`}>Quantity</Label>
                      <Input
                        id={`quantity-${index}`}
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(event) => handleLineItemChange(index, "quantity", event.target.value)}
                      />
                    </div>
                    <div className="md:col-span-3 space-y-2">
                      <Label htmlFor={`unit-price-${index}`}>Unit Price</Label>
                      <Input
                        id={`unit-price-${index}`}
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.unit_price}
                        onChange={(event) => handleLineItemChange(index, "unit_price", event.target.value)}
                      />
                    </div>
                    {formData.lineItems.length > 1 && (
                      <div className="md:col-span-12 flex justify-end">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeLineItem(index)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Remove
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="text-right text-sm text-muted-foreground">
                Estimated total: {formatCurrency(invoiceTotal, formData.currency)}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(event) => setFormData((prev) => ({ ...prev, notes: event.target.value }))}
                placeholder="Optional notes included on the invoice"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={handleClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Creating..." : "Create Invoice"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
