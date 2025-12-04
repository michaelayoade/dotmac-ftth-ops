"use client";

import { Badge } from "@dotmac/ui";
import { cn } from "@dotmac/ui";
import { ChevronDown, Building2, Check, Loader2 } from "lucide-react";
import React, { useState } from "react";

export interface Tenant {
  id: string;
  name: string;
  slug?: string;
  status?: string;
  plan?: string;
}

export interface TenantSelectorProps {
  currentTenant: Tenant | null;
  availableTenants: Tenant[];
  setTenant: (tenant: Tenant | null) => void;
  isLoading: boolean;
}

export function TenantSelector({
  currentTenant,
  availableTenants,
  setTenant,
  isLoading,
}: TenantSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleTenantChange = async (tenant: Tenant) => {
    setTenant(tenant);
    setIsOpen(false);
  };

  const getStatusColor = (status: string | undefined) => {
    switch (status) {
      case "active":
        return "bg-green-500/10 text-green-500 dark:bg-green-500/20";
      case "trial":
        return "bg-blue-500/10 text-blue-500 dark:bg-blue-500/20";
      case "suspended":
        return "bg-orange-500/10 text-orange-500 dark:bg-orange-500/20";
      case "cancelled":
      case "expired":
        return "bg-red-500/10 text-red-500 dark:bg-red-500/20";
      default:
        return "bg-slate-500/10 text-slate-500 dark:bg-slate-500/20";
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={isLoading}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={cn(
          "flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors",
          "bg-card text-foreground border-border hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          "disabled:cursor-not-allowed disabled:opacity-50",
        )}
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Building2 className="h-4 w-4" />
        )}
        <span className="max-w-[150px] truncate">{currentTenant?.name || "All tenants"}</span>
        <ChevronDown className="h-4 w-4" />
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />

          {/* Dropdown */}
          <div
            className="absolute z-20 mt-2 w-72 rounded-md border border-border bg-card shadow-lg shadow-primary/10"
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                setIsOpen(false);
              }
            }}
            tabIndex={-1}
          >
            <div className="py-1" role="listbox" aria-label="Select tenant">
              {availableTenants.length === 0 ? (
                <div className="px-4 py-3 text-sm text-muted-foreground text-center">
                  No tenants available
                </div>
              ) : (
                availableTenants.map((tenant) => (
                  <button
                    key={tenant.id}
                    onClick={() => handleTenantChange(tenant)}
                    className="flex w-full items-start justify-between px-4 py-3 text-left text-sm text-foreground transition-colors hover:bg-accent"
                    role="option"
                    aria-selected={currentTenant?.id === tenant.id}
                  >
                    <div className="flex-1 text-left">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{tenant.name}</span>
                        {currentTenant?.id === tenant.id && (
                          <Check className="h-4 w-4 text-sky-500" />
                        )}
                      </div>
                      {tenant.slug && (
                        <div className="mt-0.5 text-xs text-muted-foreground">@{tenant.slug}</div>
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        <Badge className={`text-xs px-1.5 py-0.5 ${getStatusColor(tenant.status)}`}>
                          {tenant.status}
                        </Badge>
                        <Badge variant="outline" className="text-xs px-1.5 py-0.5">
                          {tenant.plan}
                        </Badge>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export function TenantBadge({ currentTenant }: { currentTenant: Tenant | null }) {
  return (
    <div className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
      <Building2 className="h-3 w-3" />
      <span>{currentTenant?.name ?? "All tenants"}</span>
    </div>
  );
}
