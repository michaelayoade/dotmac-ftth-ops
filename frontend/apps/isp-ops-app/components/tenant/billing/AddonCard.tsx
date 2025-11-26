"use client";

import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { Input } from "@dotmac/ui";
import { Label } from "@dotmac/ui";
import { Addon } from "@/hooks/useTenantAddons";
import { Check, Star } from "lucide-react";

interface AddonCardProps {
  addon: Addon;
  onPurchase: (addonId: string, quantity: number) => void;
  isPurchasing?: boolean;
}

const addonTypeColors: Record<string, string> = {
  feature: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  resource: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  service: "bg-green-500/10 text-green-500 border-green-500/20",
  user_seats: "bg-orange-500/10 text-orange-500 border-orange-500/20",
  integration: "bg-pink-500/10 text-pink-500 border-pink-500/20",
};

const billingTypeLabels: Record<string, string> = {
  one_time: "One-time",
  recurring: "Recurring",
  metered: "Pay-as-you-go",
};

export const AddonCard: React.FC<AddonCardProps> = ({
  addon,
  onPurchase,
  isPurchasing = false,
}) => {
  const [quantity, setQuantity] = useState(addon["min_quantity"]);

  const formatCurrency = (amount: number, currency: string = "USD") => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).format(amount);
  };

  const calculateTotal = () => {
    let total = addon["price"] * (addon["is_quantity_based"] ? quantity : 1);
    if (addon["setup_fee"]) {
      total += addon["setup_fee"];
    }
    return total;
  };

  const handlePurchase = () => {
    onPurchase(addon["addon_id"], addon["is_quantity_based"] ? quantity : 1);
  };

  return (
    <Card variant={addon["is_featured"] ? "elevated" : "default"} className="relative">
      {/* Featured Badge */}
      {addon["is_featured"] && (
        <div className="absolute -top-2 -right-2 z-10">
          <Badge className="bg-yellow-500/20 text-yellow-600 border-yellow-500/30">
            <Star className="w-3 h-3 mr-1 fill-current" />
            Featured
          </Badge>
        </div>
      )}

      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            {/* Addon Icon */}
            {addon["icon"] && (
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                <span className="text-2xl">{addon["icon"]}</span>
              </div>
            )}

            <CardTitle className="text-lg">{addon["name"]}</CardTitle>
            <CardDescription className="text-sm mt-1">{addon["description"]}</CardDescription>
          </div>

          {/* Type Badge */}
          <Badge className={addonTypeColors[addon["addon_type"]] || addonTypeColors["feature"]}>
            {addon["addon_type"].replace("_", " ")}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Pricing */}
        <div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold">
              {formatCurrency(addon["price"], addon["currency"])}
            </span>
            <span className="text-sm text-muted-foreground">
              {addon.billing_type === "recurring" ? "/ month" : ""}
              {addon.billing_type === "metered" && addon["metered_unit"]
                ? `/ ${addon["metered_unit"]}`
                : ""}
            </span>
          </div>

          {addon["setup_fee"] && addon["setup_fee"] > 0 && (
            <p className="text-sm text-muted-foreground mt-1">
              + {formatCurrency(addon["setup_fee"], addon["currency"])} setup fee
            </p>
          )}

          {/* Billing Type Badge */}
          <Badge variant="outline" className="mt-2">
            {billingTypeLabels[addon["billing_type"]]}
          </Badge>
        </div>

        {/* Metered Info */}
        {addon.billing_type === "metered" &&
          addon["included_quantity"] &&
          addon["included_quantity"] > 0 && (
            <div className="text-sm">
              <p className="text-muted-foreground">
                Includes {addon["included_quantity"]} {addon["metered_unit"]} per month
              </p>
            </div>
          )}

        {/* Quantity Selector */}
        {addon["is_quantity_based"] && (
          <div className="space-y-2">
            <Label htmlFor={`quantity-${addon["addon_id"]}`}>Quantity</Label>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setQuantity(Math.max(addon["min_quantity"], quantity - 1))}
                disabled={quantity <= addon["min_quantity"]}
              >
                -
              </Button>
              <Input
                id={`quantity-${addon["addon_id"]}`}
                type="number"
                min={addon["min_quantity"]}
                max={addon["max_quantity"] || undefined}
                value={quantity}
                onChange={(e) => {
                  const val = parseInt(e.target.value) || addon["min_quantity"];
                  const bounded = Math.max(
                    addon["min_quantity"],
                    addon["max_quantity"] ? Math.min(val, addon["max_quantity"]) : val,
                  );
                  setQuantity(bounded);
                }}
                className="w-20 text-center"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setQuantity(
                    addon["max_quantity"]
                      ? Math.min(addon["max_quantity"], quantity + 1)
                      : quantity + 1,
                  )
                }
                disabled={addon["max_quantity"] ? quantity >= addon["max_quantity"] : false}
              >
                +
              </Button>
            </div>
            {addon["max_quantity"] && (
              <p className="text-xs text-muted-foreground">Max: {addon["max_quantity"]}</p>
            )}
          </div>
        )}

        {/* Features */}
        {addon["features"] && addon["features"].length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Includes:</p>
            <ul className="space-y-1">
              {addon["features"].slice(0, 4).map((feature, index) => (
                <li key={index} className="flex items-start gap-2 text-sm">
                  <Check className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                  <span>{feature}</span>
                </li>
              ))}
              {addon["features"].length > 4 && (
                <li className="text-sm text-muted-foreground ml-6">
                  +{addon["features"].length - 4} more features
                </li>
              )}
            </ul>
          </div>
        )}
      </CardContent>

      <CardFooter className="flex flex-col gap-2">
        {/* Total Price (for quantity-based) */}
        {addon["is_quantity_based"] && quantity > 1 && (
          <div className="w-full flex justify-between text-sm mb-2">
            <span className="text-muted-foreground">Total:</span>
            <span className="font-medium">
              {formatCurrency(calculateTotal(), addon["currency"])}
            </span>
          </div>
        )}

        <Button
          onClick={handlePurchase}
          disabled={isPurchasing}
          className="w-full"
          variant={addon["is_featured"] ? "default" : "outline"}
        >
          {isPurchasing ? "Adding..." : "Add to Subscription"}
        </Button>
      </CardFooter>
    </Card>
  );
};
