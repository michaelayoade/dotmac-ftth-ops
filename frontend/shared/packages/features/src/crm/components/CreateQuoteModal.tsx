/**
 * Shared Create Quote Modal
 *
 * Pure UI component for creating and editing quotes.
 * Apps provide data and action handlers via props.
 */

"use client";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Input } from "@dotmac/ui";
import { Label } from "@dotmac/ui";
import { Textarea } from "@dotmac/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@dotmac/ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@dotmac/ui";
import { useToast } from "@dotmac/ui";
import { Plus, X, Calculator, DollarSign, Trash2 } from "lucide-react";
import { useState, useEffect, useMemo } from "react";

import { type Quote, type Lead } from "../types";

export interface QuoteCreateRequest {
  lead_id: string;
  service_plan_name: string;
  bandwidth: string;
  monthly_recurring_charge: number;
  installation_fee: number;
  equipment_fee: number;
  activation_fee: number;
  contract_term_months: number;
  early_termination_fee: number | undefined;
  promo_discount_months: number | undefined;
  promo_monthly_discount: number | undefined;
  line_items: Array<{
    description: string;
    quantity: number;
    unit_price: number;
    total: number;
  }>;
  valid_until: string;
  notes: string | undefined;
}

export interface CreateQuoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (() => void) | undefined;
  onCreate: (data: QuoteCreateRequest) => Promise<any>;
  quote: Quote | null | undefined; // For edit mode
  leadId: string | undefined; // Pre-filled lead
  leads: Lead[] | undefined; // Available leads
  isSubmitting: boolean | undefined;
}

interface LineItem {
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
}

export function CreateQuoteModal({
  isOpen,
  onClose,
  onSuccess,
  onCreate,
  quote,
  leadId,
  leads,
  isSubmitting: externalIsSubmitting,
}: CreateQuoteModalProps) {
  const { toast } = useToast();
  const leadsList = leads ?? [];
  const isSubmittingValue = externalIsSubmitting ?? false;
  const [activeTab, setActiveTab] = useState("service");
  const [validUntilDays, setValidUntilDays] = useState(30);

  // Form state
  const [formData, setFormData] = useState<QuoteCreateRequest>({
    lead_id: leadId || "",
    service_plan_name: "",
    bandwidth: "",
    monthly_recurring_charge: 0,
    installation_fee: 0,
    equipment_fee: 0,
    activation_fee: 0,
    contract_term_months: 12,
    early_termination_fee: 0,
    promo_discount_months: 0,
    promo_monthly_discount: 0,
    line_items: [],
    valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    notes: "",
  });

  // Line items state
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [newLineItem, setNewLineItem] = useState<LineItem>({
    description: "",
    quantity: 1,
    unit_price: 0,
    total: 0,
  });

  // Load quote data if editing
  useEffect(() => {
    if (quote) {
      setFormData({
        lead_id: quote.lead_id,
        service_plan_name: quote.service_plan_name,
        bandwidth: quote.bandwidth || "",
        monthly_recurring_charge: quote.monthly_recurring_charge,
        installation_fee: quote.installation_fee,
        equipment_fee: quote.equipment_fee,
        activation_fee: quote.activation_fee,
        contract_term_months: quote.contract_term_months,
        early_termination_fee: quote.early_termination_fee || 0,
        promo_discount_months: quote.promo_discount_months || 0,
        promo_monthly_discount: quote.promo_monthly_discount || 0,
        line_items: [],
        valid_until: quote.valid_until,
        notes: "",
      });

      if (quote.line_items && Array.isArray(quote.line_items)) {
        setLineItems(quote.line_items);
      }
    }
  }, [quote]);

  // Calculate totals
  const calculations = useMemo(() => {
    const installationFee = formData.installation_fee ?? 0;
    const equipmentFee = formData.equipment_fee ?? 0;
    const activationFee = formData.activation_fee ?? 0;
    const upfrontCost = installationFee + equipmentFee + activationFee;

    const lineItemsTotal = lineItems.reduce((sum, item) => sum + item.total, 0);

    const totalUpfront = upfrontCost + lineItemsTotal;

    const promoDiscount = formData.promo_monthly_discount ?? 0;
    const promoMonths = formData.promo_discount_months ?? 0;
    const monthlyWithDiscount =
      promoDiscount > 0 && promoMonths > 0
        ? formData.monthly_recurring_charge - promoDiscount
        : formData.monthly_recurring_charge;

    const firstYearCost =
      totalUpfront +
      (promoMonths > 0
        ? monthlyWithDiscount * promoMonths + formData.monthly_recurring_charge * (12 - promoMonths)
        : formData.monthly_recurring_charge * 12);

    const contractTermMonths = formData.contract_term_months ?? 12;
    const contractTotalCost =
      totalUpfront +
      (promoMonths > 0
        ? monthlyWithDiscount * promoMonths +
          formData.monthly_recurring_charge * (contractTermMonths - promoMonths)
        : formData.monthly_recurring_charge * contractTermMonths);

    return {
      upfrontCost,
      totalUpfront,
      monthlyWithDiscount,
      firstYearCost,
      contractTotalCost,
    };
  }, [formData, lineItems]);

  const handleAddLineItem = () => {
    if (!newLineItem.description.trim()) {
      // toast.error("Invalid Line Item: Please provide a description.");
      return;
    }

    const total = newLineItem.quantity * newLineItem.unit_price;
    const item = { ...newLineItem, total };

    setLineItems([...lineItems, item]);
    setNewLineItem({
      description: "",
      quantity: 1,
      unit_price: 0,
      total: 0,
    });
  };

  const handleRemoveLineItem = (index: number) => {
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent, saveAsDraft: boolean = false) => {
    e.preventDefault();

    try {
      const quoteData: QuoteCreateRequest = {
        ...formData,
        line_items: lineItems,
      };

      await onCreate(quoteData);
      toast({
        title: "Quote saved",
        description: "The quote has been created successfully.",
      });

      // Reset form
      setFormData({
        lead_id: leadId || "",
        service_plan_name: "",
        bandwidth: "",
        monthly_recurring_charge: 0,
        installation_fee: 0,
        equipment_fee: 0,
        activation_fee: 0,
        contract_term_months: 12,
        early_termination_fee: 0,
        promo_monthly_discount: 0,
        promo_discount_months: 0,
        line_items: [],
        valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        notes: "",
      });
      setValidUntilDays(30);
      setLineItems([]);
      setActiveTab("service");

      if (onSuccess) onSuccess();
      onClose();
    } catch (error) {
      toast({
        title: "Failed to save quote",
        description:
          error instanceof Error ? error.message : "An unexpected error occurred while saving.",
        variant: "destructive",
      });
      throw error;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{quote ? "Edit Quote" : "Create New Quote"}</DialogTitle>
          <DialogDescription>
            {quote
              ? "Update the quote details and pricing"
              : "Generate a detailed quote for a qualified lead"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={(e) => handleSubmit(e, false)} className="space-y-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="service">Service Details</TabsTrigger>
              <TabsTrigger value="pricing">Pricing & Fees</TabsTrigger>
              <TabsTrigger value="contract">Contract Terms</TabsTrigger>
              <TabsTrigger value="review">Review & Summary</TabsTrigger>
            </TabsList>

            {/* Tab 1: Service Details */}
            <TabsContent value="service" className="space-y-4 mt-4">
              {!leadId && (
                <div className="space-y-2">
                  <Label htmlFor="lead_id">
                    Lead <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={formData.lead_id}
                    onValueChange={(value) => setFormData({ ...formData, lead_id: value })}
                    disabled={!!quote}
                  >
                    <SelectTrigger id="lead_id">
                      <SelectValue placeholder="Select a lead" />
                    </SelectTrigger>
                    <SelectContent>
                      {leadsList
                        .filter(
                          (lead) =>
                            lead.status === "qualified" ||
                            lead.status === "quote_sent" ||
                            lead.status === "negotiating",
                        )
                        .map((lead) => (
                          <SelectItem key={lead.id} value={lead.id}>
                            {lead.first_name} {lead.last_name} - {lead.lead_number}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="service_plan_name">
                  Service Plan Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="service_plan_name"
                  value={formData.service_plan_name}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      service_plan_name: e.target.value,
                    })
                  }
                  placeholder="e.g., Fiber 500 Business"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="bandwidth">
                  Bandwidth <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="bandwidth"
                  value={formData.bandwidth}
                  onChange={(e) => setFormData({ ...formData, bandwidth: e.target.value })}
                  placeholder="e.g., 500 Mbps / 500 Mbps"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="monthly_recurring_charge">
                  Monthly Recurring Charge <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="monthly_recurring_charge"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.monthly_recurring_charge}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        monthly_recurring_charge: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="pl-9"
                    placeholder="0.00"
                    required
                  />
                </div>
              </div>
            </TabsContent>

            {/* Tab 2: Pricing & Fees */}
            <TabsContent value="pricing" className="space-y-4 mt-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="installation_fee">Installation Fee</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="installation_fee"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.installation_fee ?? 0}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          installation_fee: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="pl-9"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="equipment_fee">Equipment Fee</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="equipment_fee"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.equipment_fee ?? 0}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          equipment_fee: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="pl-9"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="activation_fee">Activation Fee</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="activation_fee"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.activation_fee ?? 0}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          activation_fee: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="pl-9"
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </div>

              {/* Line Items Section */}
              <div className="space-y-3">
                <Label>Additional Line Items (Optional)</Label>

                {lineItems.length > 0 && (
                  <div className="border rounded-lg p-3 space-y-2">
                    {lineItems.map((item, index) => (
                      <div key={index} className="flex items-center justify-between gap-2 text-sm">
                        <div className="flex-1">
                          <p className="font-medium">{item.description}</p>
                          <p className="text-xs text-muted-foreground">
                            {item.quantity} × ${item.unit_price.toFixed(2)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">${item.total.toFixed(2)}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveLineItem(index)}
                          >
                            <Trash2 className="h-4 w-4 text-red-400" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="border rounded-lg p-3 space-y-3">
                  <p className="text-sm font-medium">Add New Line Item</p>
                  <div className="grid grid-cols-12 gap-2">
                    <div className="col-span-5">
                      <Input
                        placeholder="Description"
                        value={newLineItem.description}
                        onChange={(e) =>
                          setNewLineItem({
                            ...newLineItem,
                            description: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="col-span-2">
                      <Input
                        type="number"
                        placeholder="Qty"
                        min="1"
                        value={newLineItem.quantity}
                        onChange={(e) =>
                          setNewLineItem({
                            ...newLineItem,
                            quantity: parseInt(e.target.value) || 1,
                          })
                        }
                      />
                    </div>
                    <div className="col-span-3">
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="Unit Price"
                        min="0"
                        value={newLineItem.unit_price}
                        onChange={(e) =>
                          setNewLineItem({
                            ...newLineItem,
                            unit_price: parseFloat(e.target.value) || 0,
                          })
                        }
                      />
                    </div>
                    <div className="col-span-2">
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleAddLineItem}
                        className="w-full"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Upfront Cost Summary */}
              <div className="border rounded-lg p-4 bg-muted/50">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Total Upfront Cost:</span>
                  <span className="text-lg font-bold">${calculations.totalUpfront.toFixed(2)}</span>
                </div>
                <div className="text-xs text-muted-foreground space-y-1">
                  <div className="flex justify-between">
                    <span>Installation + Equipment + Activation:</span>
                    <span>${calculations.upfrontCost.toFixed(2)}</span>
                  </div>
                  {lineItems.length > 0 && (
                    <div className="flex justify-between">
                      <span>Line Items:</span>
                      <span>
                        ${lineItems.reduce((sum, item) => sum + item.total, 0).toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* Tab 3: Contract Terms */}
            <TabsContent value="contract" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="contract_term_months">
                    Contract Term (Months) <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={(formData.contract_term_months ?? 12).toString()}
                    onValueChange={(value) =>
                      setFormData({
                        ...formData,
                        contract_term_months: parseInt(value),
                      })
                    }
                  >
                    <SelectTrigger id="contract_term_months">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 Month (No Contract)</SelectItem>
                      <SelectItem value="6">6 Months</SelectItem>
                      <SelectItem value="12">12 Months</SelectItem>
                      <SelectItem value="24">24 Months</SelectItem>
                      <SelectItem value="36">36 Months</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="early_termination_fee">Early Termination Fee</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="early_termination_fee"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.early_termination_fee ?? 0}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          early_termination_fee: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="pl-9"
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </div>

              {/* Promotional Discount Section */}
              <div className="border rounded-lg p-4 space-y-3">
                <Label>Promotional Discount (Optional)</Label>

                <div className="space-y-2">
                  <Label htmlFor="notes">Discount Description</Label>
                  <Input
                    id="notes"
                    value={formData.notes}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        notes: e.target.value,
                      })
                    }
                    placeholder="e.g., New Customer Promo, Holiday Special"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="promo_monthly_discount">Discount Amount</Label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="promo_monthly_discount"
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.promo_monthly_discount}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            promo_monthly_discount: parseFloat(e.target.value) || 0,
                          })
                        }
                        className="pl-9"
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="promo_discount_months">Discount Duration (Months)</Label>
                    <Input
                      id="promo_discount_months"
                      type="number"
                      min="0"
                      value={formData.promo_discount_months}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          promo_discount_months: parseInt(e.target.value) || 0,
                        })
                      }
                      placeholder="0"
                    />
                  </div>
                </div>

                {(formData.promo_monthly_discount ?? 0) > 0 &&
                  (formData.promo_discount_months ?? 0) > 0 && (
                    <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded">
                      <p>
                        <strong>Discounted Monthly Rate:</strong> $
                        {calculations.monthlyWithDiscount.toFixed(2)} for the first{" "}
                        {formData.promo_discount_months ?? 0} month(s)
                      </p>
                      <p className="mt-1">
                        <strong>Total Savings:</strong> $
                        {(
                          (formData.promo_monthly_discount ?? 0) *
                          (formData.promo_discount_months ?? 0)
                        ).toFixed(2)}
                      </p>
                    </div>
                  )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="validUntilDays">Quote Valid For (Days)</Label>
                <Select
                  value={validUntilDays?.toString() || "30"}
                  onValueChange={(value) => setValidUntilDays(parseInt(value))}
                >
                  <SelectTrigger id="validUntilDays">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">7 Days</SelectItem>
                    <SelectItem value="14">14 Days</SelectItem>
                    <SelectItem value="30">30 Days</SelectItem>
                    <SelectItem value="60">60 Days</SelectItem>
                    <SelectItem value="90">90 Days</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Any special terms, conditions, or notes for this quote..."
                  rows={4}
                />
              </div>
            </TabsContent>

            {/* Tab 4: Review & Summary */}
            <TabsContent value="review" className="space-y-4 mt-4">
              <div className="border rounded-lg p-6 space-y-6">
                <div>
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Calculator className="h-5 w-5" />
                    Quote Summary
                  </h3>

                  <div className="space-y-4">
                    {/* Service Details */}
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-2">Service</p>
                      <p className="font-medium">{formData.service_plan_name}</p>
                      <p className="text-sm text-muted-foreground">{formData.bandwidth}</p>
                    </div>

                    {/* Monthly Pricing */}
                    <div className="border-t pt-4">
                      <p className="text-sm font-medium text-muted-foreground mb-2">
                        Monthly Recurring Charge
                      </p>
                      <p className="text-2xl font-bold">
                        ${formData.monthly_recurring_charge.toFixed(2)}
                        <span className="text-sm font-normal text-muted-foreground">/month</span>
                      </p>
                      {(formData.promo_monthly_discount ?? 0) > 0 &&
                        (formData.promo_discount_months ?? 0) > 0 && (
                          <p className="text-sm text-emerald-400 mt-1">
                            ${calculations.monthlyWithDiscount.toFixed(2)}/month for first{" "}
                            {formData.promo_discount_months ?? 0} months
                          </p>
                        )}
                    </div>

                    {/* Upfront Costs */}
                    <div className="border-t pt-4">
                      <p className="text-sm font-medium text-muted-foreground mb-2">
                        Total Upfront Cost
                      </p>
                      <p className="text-2xl font-bold">${calculations.totalUpfront.toFixed(2)}</p>
                      <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                        {(formData.installation_fee ?? 0) > 0 && (
                          <div className="flex justify-between">
                            <span>Installation Fee:</span>
                            <span>${(formData.installation_fee ?? 0).toFixed(2)}</span>
                          </div>
                        )}
                        {(formData.equipment_fee ?? 0) > 0 && (
                          <div className="flex justify-between">
                            <span>Equipment Fee:</span>
                            <span>${(formData.equipment_fee ?? 0).toFixed(2)}</span>
                          </div>
                        )}
                        {(formData.activation_fee ?? 0) > 0 && (
                          <div className="flex justify-between">
                            <span>Activation Fee:</span>
                            <span>${(formData.activation_fee ?? 0).toFixed(2)}</span>
                          </div>
                        )}
                        {lineItems.map((item, index) => (
                          <div key={index} className="flex justify-between">
                            <span>{item.description}:</span>
                            <span>${item.total.toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Contract Terms */}
                    <div className="border-t pt-4">
                      <p className="text-sm font-medium text-muted-foreground mb-2">
                        Contract Terms
                      </p>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span>Contract Length:</span>
                          <span className="font-medium">
                            {formData.contract_term_months ?? 12} months
                          </span>
                        </div>
                        {(formData.early_termination_fee ?? 0) > 0 && (
                          <div className="flex justify-between">
                            <span>Early Termination Fee:</span>
                            <span className="font-medium">
                              ${(formData.early_termination_fee ?? 0).toFixed(2)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Cost Projections */}
                    <div className="border-t pt-4">
                      <p className="text-sm font-medium text-muted-foreground mb-2">
                        Cost Projections
                      </p>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span>First Year Total:</span>
                          <span className="font-medium">
                            ${calculations.firstYearCost.toFixed(2)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Full Contract Total:</span>
                          <span className="font-medium">
                            ${calculations.contractTotalCost.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          {/* Actions */}
          <div className="flex justify-between gap-2 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (activeTab === "service") {
                  onClose();
                } else if (activeTab === "pricing") {
                  setActiveTab("service");
                } else if (activeTab === "contract") {
                  setActiveTab("pricing");
                } else {
                  setActiveTab("contract");
                }
              }}
            >
              {activeTab === "service" ? "Cancel" : "Previous"}
            </Button>
            <div className="flex gap-2">
              {activeTab !== "review" ? (
                <Button
                  type="button"
                  onClick={() => {
                    if (activeTab === "service") setActiveTab("pricing");
                    else if (activeTab === "pricing") setActiveTab("contract");
                    else if (activeTab === "contract") setActiveTab("review");
                  }}
                >
                  Next
                </Button>
              ) : (
                <Button type="submit" disabled={isSubmittingValue}>
                  {isSubmittingValue ? "Creating..." : quote ? "Update Quote" : "Create Quote"}
                </Button>
              )}
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
