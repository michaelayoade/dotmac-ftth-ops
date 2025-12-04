"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { X } from "lucide-react";
import { Button } from "@dotmac/ui";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@dotmac/ui";
import { Input } from "@dotmac/ui";
import { Label } from "@dotmac/ui";
import { Alert, AlertDescription } from "@dotmac/ui";
import { apiClient } from "@/lib/api/client";

interface CreateIPPoolModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function CreateIPPoolModal({ isOpen, onClose, onSuccess }: CreateIPPoolModalProps) {
  const [formData, setFormData] = useState({
    pool_name: "",
    pool_type: "ipv4" as "ipv4" | "ipv6" | "dual_stack",
    network_cidr: "",
    gateway: "",
    dns_servers: "",
    vlan_id: "",
    description: "",
    auto_assign_enabled: true,
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const payload = {
        pool_name: data.pool_name,
        pool_type: data.pool_type,
        network_cidr: data.network_cidr,
        gateway: data.gateway || null,
        dns_servers: data.dns_servers
          ? data.dns_servers
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
          : null,
        vlan_id: data.vlan_id ? parseInt(data.vlan_id) : null,
        description: data.description || null,
        auto_assign_enabled: data.auto_assign_enabled,
      };

      await apiClient.post("/ip-management/pools", payload);
    },
    onSuccess: () => {
      onSuccess();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Create IP Pool</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {createMutation.error && (
            <Alert variant="destructive">
              <AlertDescription>
                {createMutation.error instanceof Error
                  ? createMutation.error.message
                  : "Failed to create pool"}
              </AlertDescription>
            </Alert>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="pool_name">Pool Name *</Label>
              <Input
                id="pool_name"
                value={formData.pool_name}
                onChange={(e) => setFormData({ ...formData, pool_name: e.target.value })}
                placeholder="e.g., Residential Pool 1"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="pool_type">Pool Type *</Label>
              <select
                id="pool_type"
                value={formData.pool_type}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    pool_type: e.target.value as "ipv4" | "ipv6" | "dual_stack",
                  })
                }
                className="w-full px-3 py-2 border rounded-md bg-background"
                required
              >
                <option value="ipv4">IPv4</option>
                <option value="ipv6">IPv6</option>
                <option value="dual_stack">Dual Stack</option>
              </select>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="network_cidr">Network CIDR *</Label>
              <Input
                id="network_cidr"
                value={formData.network_cidr}
                onChange={(e) => setFormData({ ...formData, network_cidr: e.target.value })}
                placeholder="e.g., 10.0.0.0/24"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="gateway">Gateway</Label>
              <Input
                id="gateway"
                value={formData.gateway}
                onChange={(e) => setFormData({ ...formData, gateway: e.target.value })}
                placeholder="e.g., 10.0.0.1"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="dns_servers">DNS Servers (comma-separated)</Label>
              <Input
                id="dns_servers"
                value={formData.dns_servers}
                onChange={(e) => setFormData({ ...formData, dns_servers: e.target.value })}
                placeholder="e.g., 8.8.8.8, 8.8.4.4"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="vlan_id">VLAN ID</Label>
              <Input
                id="vlan_id"
                type="number"
                value={formData.vlan_id}
                onChange={(e) => setFormData({ ...formData, vlan_id: e.target.value })}
                placeholder="e.g., 100"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Optional description"
            />
          </div>

          <div className="flex items-center space-x-2">
            <input
              id="auto_assign_enabled"
              type="checkbox"
              checked={formData.auto_assign_enabled}
              onChange={(e) => setFormData({ ...formData, auto_assign_enabled: e.target.checked })}
              className="h-4 w-4 rounded border-gray-300"
            />
            <Label htmlFor="auto_assign_enabled" className="cursor-pointer">
              Enable auto-assign for new subscribers
            </Label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Creating..." : "Create Pool"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
