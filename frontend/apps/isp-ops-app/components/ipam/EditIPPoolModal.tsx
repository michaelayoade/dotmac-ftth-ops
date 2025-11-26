"use client";

import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@dotmac/ui";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@dotmac/ui";
import { Input } from "@dotmac/ui";
import { Label } from "@dotmac/ui";
import { Alert, AlertDescription } from "@dotmac/ui";
import { apiClient } from "@/lib/api/client";

interface IPPool {
  id: string;
  pool_name: string;
  pool_type: "ipv4" | "ipv6" | "dual_stack";
  network_cidr: string;
  gateway: string | null;
  dns_servers: string[] | null;
  vlan_id: number | null;
  status: string;
  description: string | null;
  auto_assign_enabled: boolean;
}

interface EditIPPoolModalProps {
  isOpen: boolean;
  pool: IPPool;
  onClose: () => void;
  onSuccess: () => void;
}

export function EditIPPoolModal({ isOpen, pool, onClose, onSuccess }: EditIPPoolModalProps) {
  const [formData, setFormData] = useState({
    pool_name: pool["pool_name"],
    gateway: pool["gateway"] || "",
    dns_servers: pool["dns_servers"] ? pool["dns_servers"].join(", ") : "",
    vlan_id: pool["vlan_id"]?.toString() || "",
    description: pool["description"] || "",
    auto_assign_enabled: pool["auto_assign_enabled"],
    status: pool["status"],
  });

  useEffect(() => {
    setFormData({
      pool_name: pool["pool_name"],
      gateway: pool["gateway"] || "",
      dns_servers: pool["dns_servers"] ? pool["dns_servers"].join(", ") : "",
      vlan_id: pool["vlan_id"]?.toString() || "",
      description: pool["description"] || "",
      auto_assign_enabled: pool["auto_assign_enabled"],
      status: pool["status"],
    });
  }, [pool]);

  const updateMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const payload: Record<string, any> = {};

      if (data["pool_name"] !== pool["pool_name"]) payload["pool_name"] = data["pool_name"];
      if (data["gateway"] !== (pool["gateway"] || "")) payload["gateway"] = data["gateway"] || null;
      if (data["dns_servers"] !== (pool["dns_servers"] || []).join(", ")) {
        payload["dns_servers"] = data["dns_servers"]
          ? data["dns_servers"]
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
          : null;
      }
      if (data["vlan_id"] !== (pool["vlan_id"]?.toString() || "")) {
        payload["vlan_id"] = data["vlan_id"] ? parseInt(data["vlan_id"]) : null;
      }
      if (data["description"] !== (pool["description"] || ""))
        payload["description"] = data["description"] || null;
      if (data["auto_assign_enabled"] !== pool["auto_assign_enabled"])
        payload["auto_assign_enabled"] = data["auto_assign_enabled"];
      if (data["status"] !== pool["status"]) payload["status"] = data["status"];

      if (Object.keys(payload).length > 0) {
        await apiClient.patch(`/ip-management/pools/${pool["id"]}`, payload);
      }
    },
    onSuccess: () => {
      onSuccess();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate(formData);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Edit IP Pool: {pool["pool_name"]}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {updateMutation.error && (
            <Alert variant="destructive">
              <AlertDescription>
                {updateMutation.error instanceof Error
                  ? updateMutation.error["message"]
                  : "Failed to update pool"}
              </AlertDescription>
            </Alert>
          )}

          {/* Read-only info */}
          <div className="bg-muted p-4 rounded-md space-y-2">
            <div className="text-sm">
              <span className="font-medium">Pool Type:</span> {pool["pool_type"].toUpperCase()}
            </div>
            <div className="text-sm">
              <span className="font-medium">Network CIDR:</span>{" "}
              <code className="font-mono">{pool["network_cidr"]}</code>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="pool_name">Pool Name</Label>
              <Input
                id="pool_name"
                value={formData["pool_name"]}
                onChange={(e) => setFormData({ ...formData, pool_name: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <select
                id="status"
                value={formData["status"]}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full px-3 py-2 border rounded-md bg-background"
              >
                <option value="active">Active</option>
                <option value="reserved">Reserved</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="gateway">Gateway</Label>
              <Input
                id="gateway"
                value={formData["gateway"]}
                onChange={(e) => setFormData({ ...formData, gateway: e.target.value })}
                placeholder="e.g., 10.0.0.1"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="vlan_id">VLAN ID</Label>
              <Input
                id="vlan_id"
                type="number"
                value={formData["vlan_id"]}
                onChange={(e) => setFormData({ ...formData, vlan_id: e.target.value })}
                placeholder="e.g., 100"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="dns_servers">DNS Servers (comma-separated)</Label>
            <Input
              id="dns_servers"
              value={formData["dns_servers"]}
              onChange={(e) => setFormData({ ...formData, dns_servers: e.target.value })}
              placeholder="e.g., 8.8.8.8, 8.8.4.4"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              value={formData["description"]}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Optional description"
            />
          </div>

          <div className="flex items-center space-x-2">
            <input
              id="auto_assign_enabled"
              type="checkbox"
              checked={formData["auto_assign_enabled"]}
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
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Updating..." : "Update Pool"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
