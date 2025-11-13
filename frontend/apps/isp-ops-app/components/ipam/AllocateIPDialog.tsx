"use client";

/**
 * Allocate IP Dialog Component
 *
 * Dialog for allocating IP addresses from prefixes (single or dual-stack)
 */

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Label } from "@dotmac/ui";
import { Input } from "@dotmac/ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { Alert, AlertDescription } from "@dotmac/ui";
import { IPAddressInput } from "@/components/forms/IPAddressInput";
import { Loader2, AlertCircle } from "lucide-react";

export interface AllocateIPDialogProps {
  open: boolean;
  onClose: () => void;
  onAllocate: (data: IPAllocationData) => Promise<void>;
  prefixId?: number;
  prefixCIDR?: string;
  ipv6PrefixId?: number;
  ipv6PrefixCIDR?: string;
  mode?: "single" | "dual-stack" | "bulk";
}

export interface IPAllocationData {
  mode: "single" | "dual-stack" | "bulk";
  prefixId?: number | undefined;
  ipv6PrefixId?: number | undefined;
  description?: string | undefined;
  dnsName?: string | undefined;
  count?: number | undefined;
  descriptionPrefix?: string | undefined;
}

export function AllocateIPDialog({
  open,
  onClose,
  onAllocate,
  prefixId,
  prefixCIDR,
  ipv6PrefixId,
  ipv6PrefixCIDR,
  mode = "single",
}: AllocateIPDialogProps) {
  const [activeTab, setActiveTab] = useState<"single" | "dual-stack" | "bulk">(mode);
  const [description, setDescription] = useState("");
  const [dnsName, setDnsName] = useState("");
  const [bulkCount, setBulkCount] = useState("10");
  const [descriptionPrefix, setDescriptionPrefix] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);
    setIsSubmitting(true);

    try {
      const data: IPAllocationData = {
        mode: activeTab,
        description,
        dnsName: dnsName || undefined,
      };

      if (activeTab === "single") {
        data.prefixId = prefixId;
      } else if (activeTab === "dual-stack") {
        data.prefixId = prefixId;
        data.ipv6PrefixId = ipv6PrefixId;
      } else if (activeTab === "bulk") {
        data.prefixId = prefixId;
        data.count = parseInt(bulkCount, 10);
        data.descriptionPrefix = descriptionPrefix;
      }

      await onAllocate(data);
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to allocate IP");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setDescription("");
    setDnsName("");
    setBulkCount("10");
    setDescriptionPrefix("");
    setError(null);
    onClose();
  };

  const canSubmit =
    (activeTab === "bulk" && parseInt(bulkCount, 10) > 0 && parseInt(bulkCount, 10) <= 100) ||
    activeTab !== "bulk";

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Allocate IP Address</DialogTitle>
          <DialogDescription>Allocate IP addresses from your prefixes</DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="single">Single IP</TabsTrigger>
            <TabsTrigger value="dual-stack" disabled={!ipv6PrefixId}>
              Dual-Stack
            </TabsTrigger>
            <TabsTrigger value="bulk">Bulk</TabsTrigger>
          </TabsList>

          <TabsContent value="single" className="space-y-4">
            {prefixCIDR && (
              <div className="flex items-center gap-2">
                <Label>Prefix:</Label>
                <Badge variant="outline" className="font-mono">
                  {prefixCIDR}
                </Badge>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                placeholder="e.g., Web Server"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dns-name">DNS Name (Optional)</Label>
              <Input
                id="dns-name"
                placeholder="e.g., web01.example.com"
                value={dnsName}
                onChange={(e) => setDnsName(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">FQDN for reverse DNS lookup</p>
            </div>
          </TabsContent>

          <TabsContent value="dual-stack" className="space-y-4">
            <div className="space-y-2">
              <Label>Prefixes:</Label>
              <div className="grid grid-cols-2 gap-2">
                {prefixCIDR && (
                  <div className="flex items-center gap-2">
                    <Badge variant="default">IPv4</Badge>
                    <span className="font-mono text-sm">{prefixCIDR}</span>
                  </div>
                )}
                {ipv6PrefixCIDR && (
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">IPv6</Badge>
                    <span className="font-mono text-sm">{ipv6PrefixCIDR}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ds-description">Description</Label>
              <Input
                id="ds-description"
                placeholder="e.g., Database Server"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ds-dns-name">DNS Name (Optional)</Label>
              <Input
                id="ds-dns-name"
                placeholder="e.g., db01.example.com"
                value={dnsName}
                onChange={(e) => setDnsName(e.target.value)}
              />
            </div>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Both IPv4 and IPv6 addresses will be allocated and assigned the same DNS name
              </AlertDescription>
            </Alert>
          </TabsContent>

          <TabsContent value="bulk" className="space-y-4">
            {prefixCIDR && (
              <div className="flex items-center gap-2">
                <Label>Prefix:</Label>
                <Badge variant="outline" className="font-mono">
                  {prefixCIDR}
                </Badge>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="count">Number of IPs</Label>
              <Input
                id="count"
                type="number"
                min="1"
                max="100"
                placeholder="10"
                value={bulkCount}
                onChange={(e) => setBulkCount(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Maximum 100 IPs per allocation</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="prefix">Description Prefix</Label>
              <Input
                id="prefix"
                placeholder="e.g., Server"
                value={descriptionPrefix}
                onChange={(e) => setDescriptionPrefix(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Will be numbered: {descriptionPrefix || "Server"}-1, {descriptionPrefix || "Server"}
                -2, etc.
              </p>
            </div>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {parseInt(bulkCount, 10) || 0} IP addresses will be allocated
              </AlertDescription>
            </Alert>
          </TabsContent>
        </Tabs>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit || isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Allocate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
