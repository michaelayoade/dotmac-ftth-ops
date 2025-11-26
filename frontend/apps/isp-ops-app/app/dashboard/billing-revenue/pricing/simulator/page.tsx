"use client";

import React, { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Input } from "@dotmac/ui";
import { Label } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@dotmac/ui";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@dotmac/ui";
import { useToast } from "@dotmac/ui";
import {
  ArrowLeft,
  Calculator,
  Loader2,
  TrendingDown,
  DollarSign,
  Tag,
  Percent,
  RotateCcw,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api/client";
import { useAppConfig } from "@/providers/AppConfigContext";

type DiscountType = "percentage" | "fixed_amount" | "fixed_price";

interface PriceAdjustment {
  rule_id: string;
  rule_name: string;
  discount_type: DiscountType;
  discount_value: number;
  original_price: number;
  discount_amount: number;
  adjusted_price: number;
}

interface PriceCalculationResult {
  product_id: string;
  quantity: number;
  customer_id: string;
  base_price: number;
  subtotal: number;
  total_discount_amount: number;
  final_price: number;
  currency: string;
  applied_adjustments: PriceAdjustment[];
  calculation_timestamp: string;
}

interface PriceCalculationRequest {
  product_id: string;
  quantity: number;
  customer_id: string;
  customer_segments?: string[];
  calculation_date?: string;
  metadata?: Record<string, any>;
  currency?: string;
}

export default function PriceSimulatorPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [calculationResult, setCalculationResult] = useState<PriceCalculationResult | null>(null);
  const { api } = useAppConfig();
  const apiBaseUrl = api.baseUrl;

  const [formData, setFormData] = useState({
    product_id: "",
    customer_id: "",
    quantity: "1",
    customer_segments: "",
    currency: "USD",
  });

  // Calculate price mutation
  const calculatePriceMutation = useMutation({
    mutationFn: async (data: PriceCalculationRequest) => {
      const response = await apiClient.post<PriceCalculationResult>(
        `${apiBaseUrl}/api/v1/billing/pricing/calculate`,
        data,
      );
      return response.data;
    },
    onSuccess: (data) => {
      setCalculationResult(data);
      toast({
        title: "Success",
        description: "Price calculated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to calculate price",
        variant: "destructive",
      });
    },
  });

  const handleCalculate = () => {
    if (!formData.product_id || !formData["customer_id"] || !formData.quantity) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    const quantity = parseInt(formData.quantity);
    if (isNaN(quantity) || quantity < 1) {
      toast({
        title: "Validation Error",
        description: "Quantity must be a positive number",
        variant: "destructive",
      });
      return;
    }

    const segments = formData.customer_segments
      ? formData.customer_segments.split(",").map((s) => s.trim())
      : undefined;

    const requestData: PriceCalculationRequest = {
      product_id: formData.product_id,
      customer_id: formData["customer_id"],
      quantity,
      currency: formData.currency,
      ...(segments && { customer_segments: segments }),
    };

    calculatePriceMutation.mutate(requestData);
  };

  const handleClear = () => {
    setFormData({
      product_id: "",
      customer_id: "",
      quantity: "1",
      customer_segments: "",
      currency: "USD",
    });
    setCalculationResult(null);
  };

  const formatMoney = (amount: number, currency: string = "USD") => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const getDiscountTypeBadge = (type: DiscountType) => {
    const config = {
      percentage: { label: "Percentage", className: "bg-blue-500" },
      fixed_amount: { label: "Fixed Amount", className: "bg-green-500" },
      fixed_price: { label: "Fixed Price", className: "bg-purple-500" },
    };
    const { label, className } = config[type];
    return <Badge className={className}>{label}</Badge>;
  };

  const savingsPercentage =
    calculationResult && calculationResult.subtotal > 0
      ? (calculationResult.total_discount_amount / calculationResult.subtotal) * 100
      : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Price Simulator</h1>
            <p className="text-muted-foreground">
              Test pricing rules and see how discounts are applied
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleClear}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Clear
          </Button>
          <Button onClick={handleCalculate} disabled={calculatePriceMutation.isPending}>
            {calculatePriceMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Calculating...
              </>
            ) : (
              <>
                <Calculator className="mr-2 h-4 w-4" />
                Run Simulation
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Tag className="h-5 w-5" />
              Simulation Parameters
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="product_id">
                Product ID <span className="text-destructive">*</span>
              </Label>
              <Input
                id="product_id"
                value={formData.product_id}
                onChange={(e) => setFormData({ ...formData, product_id: e.target.value })}
                placeholder="e.g., prod_123456"
              />
              <p className="text-xs text-muted-foreground mt-1">
                The unique identifier of the product to price
              </p>
            </div>

            <div>
              <Label htmlFor="customer_id">
                Customer ID <span className="text-destructive">*</span>
              </Label>
              <Input
                id="customer_id"
                value={formData["customer_id"]}
                onChange={(e) => setFormData({ ...formData, customer_id: e.target.value })}
                placeholder="e.g., cust_123456"
              />
              <p className="text-xs text-muted-foreground mt-1">
                The customer who will purchase this product
              </p>
            </div>

            <div>
              <Label htmlFor="quantity">
                Quantity <span className="text-destructive">*</span>
              </Label>
              <Input
                id="quantity"
                type="number"
                min="1"
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                placeholder="1"
              />
              <p className="text-xs text-muted-foreground mt-1">Number of units to purchase</p>
            </div>

            <div>
              <Label htmlFor="customer_segments">Customer Segments</Label>
              <Input
                id="customer_segments"
                value={formData.customer_segments}
                onChange={(e) => setFormData({ ...formData, customer_segments: e.target.value })}
                placeholder="e.g., vip, enterprise"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Comma-separated list of customer segments (optional)
              </p>
            </div>

            <div>
              <Label htmlFor="currency">Currency</Label>
              <Select
                value={formData.currency}
                onValueChange={(value) => setFormData({ ...formData, currency: value })}
              >
                <SelectTrigger id="currency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD - US Dollar</SelectItem>
                  <SelectItem value="EUR">EUR - Euro</SelectItem>
                  <SelectItem value="GBP">GBP - British Pound</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="pt-4 border-t">
              <Button
                className="w-full"
                onClick={handleCalculate}
                disabled={calculatePriceMutation.isPending}
              >
                {calculatePriceMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Calculating...
                  </>
                ) : (
                  <>
                    <Calculator className="mr-2 h-4 w-4" />
                    Calculate Price
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        {calculationResult ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Calculation Results
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Price Summary */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Base Price</span>
                  <span className="font-medium">
                    {formatMoney(calculationResult.base_price, calculationResult.currency)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Quantity</span>
                  <span className="font-medium">× {calculationResult.quantity}</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-semibold">
                    {formatMoney(calculationResult.subtotal, calculationResult.currency)}
                  </span>
                </div>
                {calculationResult.total_discount_amount > 0 && (
                  <div className="flex justify-between items-center text-green-600">
                    <span className="flex items-center gap-1">
                      <TrendingDown className="h-4 w-4" />
                      Total Discount
                    </span>
                    <span className="font-semibold">
                      -
                      {formatMoney(
                        calculationResult.total_discount_amount,
                        calculationResult.currency,
                      )}
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-center pt-3 border-t">
                  <span className="text-lg font-semibold">Final Price</span>
                  <span className="text-2xl font-bold text-primary">
                    {formatMoney(calculationResult.final_price, calculationResult.currency)}
                  </span>
                </div>
              </div>

              {/* Savings Badge */}
              {calculationResult.total_discount_amount > 0 && (
                <div className="p-4 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-green-900 dark:text-green-100">
                        Total Savings
                      </div>
                      <div className="text-xs text-green-700 dark:text-green-300 mt-1">
                        {savingsPercentage.toFixed(1)}% discount applied
                      </div>
                    </div>
                    <div className="text-2xl font-bold text-green-900 dark:text-green-100">
                      {formatMoney(
                        calculationResult.total_discount_amount,
                        calculationResult.currency,
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Metadata */}
              <div className="pt-4 border-t space-y-2 text-sm text-muted-foreground">
                <div className="flex justify-between">
                  <span>Product ID:</span>
                  <span className="font-mono">{calculationResult.product_id}</span>
                </div>
                <div className="flex justify-between">
                  <span>Customer ID:</span>
                  <span className="font-mono">{calculationResult.customer_id}</span>
                </div>
                <div className="flex justify-between">
                  <span>Currency:</span>
                  <span>{calculationResult.currency}</span>
                </div>
                <div className="flex justify-between">
                  <span>Calculated at:</span>
                  <span>{new Date(calculationResult.calculation_timestamp).toLocaleString()}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="flex items-center justify-center h-full min-h-[400px]">
              <div className="text-center text-muted-foreground">
                <Calculator className="h-16 w-16 mx-auto mb-4 opacity-20" />
                <p className="text-lg font-medium">No Calculation Yet</p>
                <p className="text-sm mt-2">
                  Fill in the parameters and click &quot;Calculate Price&quot; to see results
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Applied Rules Table */}
      {calculationResult && calculationResult.applied_adjustments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Percent className="h-5 w-5" />
              Applied Pricing Rules
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rule Name</TableHead>
                  <TableHead>Discount Type</TableHead>
                  <TableHead>Discount Value</TableHead>
                  <TableHead>Original Price</TableHead>
                  <TableHead>Discount Amount</TableHead>
                  <TableHead>Adjusted Price</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {calculationResult.applied_adjustments.map((adjustment, index) => (
                  <TableRow key={`${adjustment.rule_id}-${index}`}>
                    <TableCell>
                      <div className="font-medium">{adjustment.rule_name}</div>
                      <div className="text-xs text-muted-foreground font-mono">
                        {adjustment.rule_id}
                      </div>
                    </TableCell>
                    <TableCell>{getDiscountTypeBadge(adjustment.discount_type)}</TableCell>
                    <TableCell>
                      <div className="font-medium">
                        {adjustment.discount_type === "percentage"
                          ? `${adjustment.discount_value}%`
                          : formatMoney(adjustment.discount_value, calculationResult.currency)}
                      </div>
                    </TableCell>
                    <TableCell>
                      {formatMoney(adjustment.original_price, calculationResult.currency)}
                    </TableCell>
                    <TableCell>
                      <span className="text-green-600 font-medium">
                        -{formatMoney(adjustment.discount_amount, calculationResult.currency)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="font-semibold">
                        {formatMoney(adjustment.adjusted_price, calculationResult.currency)}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Price Breakdown Visualization */}
      {calculationResult && calculationResult.total_discount_amount > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Price Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {/* Original Price Bar */}
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Original Subtotal</span>
                  <span className="font-medium">
                    {formatMoney(calculationResult.subtotal, calculationResult.currency)} (100%)
                  </span>
                </div>
                <div className="w-full h-8 bg-gray-300 dark:bg-gray-700 rounded-md"></div>
              </div>

              {/* Discount Bar */}
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-green-600">Discount Applied</span>
                  <span className="font-medium text-green-600">
                    -
                    {formatMoney(
                      calculationResult.total_discount_amount,
                      calculationResult.currency,
                    )}{" "}
                    ({savingsPercentage.toFixed(1)}%)
                  </span>
                </div>
                <div
                  className="w-full h-8 bg-green-500 dark:bg-green-600 rounded-md"
                  style={{
                    width: `${savingsPercentage}%`,
                  }}
                ></div>
              </div>

              {/* Final Price Bar */}
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-semibold">Final Price</span>
                  <span className="font-bold text-primary">
                    {formatMoney(calculationResult.final_price, calculationResult.currency)} (
                    {(100 - savingsPercentage).toFixed(1)}%)
                  </span>
                </div>
                <div
                  className="w-full h-8 bg-blue-500 dark:bg-blue-600 rounded-md"
                  style={{
                    width: `${100 - savingsPercentage}%`,
                  }}
                ></div>
              </div>
            </div>

            <div className="mt-6 p-4 bg-accent rounded-lg">
              <div className="text-sm font-medium mb-2">Summary</div>
              <div className="text-sm text-muted-foreground">
                {calculationResult.applied_adjustments.length} pricing rule(s) were applied,
                resulting in a total discount of{" "}
                {formatMoney(calculationResult.total_discount_amount, calculationResult.currency)} (
                {savingsPercentage.toFixed(1)}% off). The customer saves money while you maintain
                competitive pricing.
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* No Rules Applied Message */}
      {calculationResult && calculationResult.applied_adjustments.length === 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <Tag className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-20" />
              <p className="text-lg font-medium">No Pricing Rules Applied</p>
              <p className="text-sm text-muted-foreground mt-2">
                The calculated price is the base price with no discounts. This may be because:
              </p>
              <ul className="text-sm text-muted-foreground mt-4 space-y-1 inline-block text-left">
                <li>• No active pricing rules match this product</li>
                <li>• The customer doesn&apos;t meet the eligibility criteria</li>
                <li>• Quantity requirements weren&apos;t met</li>
                <li>• Pricing rules have reached their usage limits</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
