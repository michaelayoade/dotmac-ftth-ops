"use client";

import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { Progress } from "@dotmac/ui";
import { Input } from "@dotmac/ui";
import { Label } from "@dotmac/ui";
import { TenantAddon } from "@/hooks/useTenantAddons";
import { format } from "date-fns";

interface ActiveAddonCardProps {
  addon: TenantAddon;
  onUpdateQuantity?: (tenantAddonId: string, quantity: number) => void;
  onCancel?: (tenantAddonId: string) => void;
  onReactivate?: (tenantAddonId: string) => void;
  isUpdating?: boolean;
}

const statusColors: Record<string, string> = {
  active: "bg-green-500/10 text-green-500 border-green-500/20",
  canceled: "bg-red-500/10 text-red-500 border-red-500/20",
  ended: "bg-gray-500/10 text-gray-500 border-gray-500/20",
  suspended: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
};

export const ActiveAddonCard: React.FC<ActiveAddonCardProps> = ({
  addon,
  onUpdateQuantity,
  onCancel,
  onReactivate,
  isUpdating = false,
}) => {
  const [editMode, setEditMode] = useState(false);
  const [newQuantity, setNewQuantity] = useState(addon["quantity"]);

  const formatCurrency = (amount: number, currency: string = "USD") => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).format(amount);
  };

  const handleSaveQuantity = () => {
    if (onUpdateQuantity && newQuantity !== addon["quantity"]) {
      onUpdateQuantity(addon["tenant_addon_id"], newQuantity);
    }
    setEditMode(false);
  };

  const calculateTotal = () => {
    return addon["price"] * addon["quantity"];
  };

  return (
    <Card variant="default" className={addon["status"] !== "active" ? "opacity-75" : ""}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg">{addon["addon_name"]}</CardTitle>
            <CardDescription className="text-sm">
              Started {format(new Date(addon["started_at"]), "MMM d, yyyy")}
            </CardDescription>
          </div>
          <Badge className={statusColors[addon["status"]] || statusColors["active"]}>
            {addon["status"].toUpperCase()}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Pricing */}
        <div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold">
              {formatCurrency(addon["price"], addon["currency"])}
            </span>
            <span className="text-sm text-muted-foreground">/ month</span>
          </div>
          {addon["quantity"] > 1 && (
            <p className="text-sm text-muted-foreground mt-1">
              Total: {formatCurrency(calculateTotal(), addon["currency"])} / month
            </p>
          )}
        </div>

        {/* Billing Period */}
        {addon["current_period_start"] && addon["current_period_end"] && (
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-1">Current Period</p>
            <p className="text-sm">
              {format(new Date(addon["current_period_start"]), "MMM d")} -{" "}
              {format(new Date(addon["current_period_end"]), "MMM d, yyyy")}
            </p>
          </div>
        )}

        {/* Quantity Management */}
        {addon.status === "active" && addon["quantity"] >= 1 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Quantity</Label>
              {!editMode && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditMode(true)}
                  disabled={isUpdating}
                >
                  Edit
                </Button>
              )}
            </div>

            {editMode ? (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setNewQuantity(Math.max(1, newQuantity - 1))}
                  disabled={newQuantity <= 1}
                >
                  -
                </Button>
                <Input
                  type="number"
                  min={1}
                  value={newQuantity}
                  onChange={(e) => setNewQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-20 text-center"
                />
                <Button variant="outline" size="sm" onClick={() => setNewQuantity(newQuantity + 1)}>
                  +
                </Button>
                <Button
                  size="sm"
                  onClick={handleSaveQuantity}
                  disabled={isUpdating || newQuantity === addon["quantity"]}
                >
                  {isUpdating ? "Saving..." : "Save"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setNewQuantity(addon["quantity"]);
                    setEditMode(false);
                  }}
                  disabled={isUpdating}
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold">{addon["quantity"]}</span>
                <span className="text-sm text-muted-foreground">
                  {addon.quantity === 1 ? "unit" : "units"}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Usage Tracking (for metered add-ons) */}
        {addon["current_usage"] > 0 && (
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-muted-foreground">Current Usage</span>
              <span>{addon["current_usage"].toLocaleString()}</span>
            </div>
            <Progress value={Math.min((addon["current_usage"] / 1000) * 100, 100)} />
          </div>
        )}

        {/* Cancellation Notice */}
        {addon.status === "canceled" && addon["canceled_at"] && (
          <div className="rounded-md bg-yellow-500/10 border border-yellow-500/20 p-3">
            <p className="text-sm text-yellow-600 dark:text-yellow-500">
              Canceled on {format(new Date(addon["canceled_at"]), "MMM d, yyyy")}
              {addon["current_period_end"] && (
                <> - Access until {format(new Date(addon["current_period_end"]), "MMM d, yyyy")}</>
              )}
            </p>
          </div>
        )}
      </CardContent>

      <CardFooter className="flex gap-2">
        {addon.status === "active" && onCancel && (
          <Button
            variant="outline"
            onClick={() => onCancel(addon["tenant_addon_id"])}
            disabled={isUpdating}
            className="flex-1"
          >
            Cancel Add-on
          </Button>
        )}

        {addon.status === "canceled" && onReactivate && (
          <Button
            variant="default"
            onClick={() => onReactivate(addon["tenant_addon_id"])}
            disabled={isUpdating}
            className="flex-1"
          >
            Reactivate Add-on
          </Button>
        )}

        {addon.status === "suspended" && (
          <Button variant="outline" disabled className="flex-1">
            Contact Support
          </Button>
        )}
      </CardFooter>
    </Card>
  );
};
