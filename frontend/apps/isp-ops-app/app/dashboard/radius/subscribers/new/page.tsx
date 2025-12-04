"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, Save } from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Input } from "@dotmac/ui";
import { Label } from "@dotmac/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@dotmac/ui";
import { apiClient } from "@/lib/api/client";
import { useToast } from "@dotmac/ui";
import { logger } from "@/lib/logger";

interface BandwidthProfile {
  id: string;
  name: string;
  download_rate: number;
  upload_rate: number;
}

export default function NewRADIUSSubscriberPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    subscriber_id: "",
    username: "",
    password: "",
    bandwidth_profile_id: "",
    framed_ipv4_address: "",
    framed_ipv6_address: "",
    delegated_ipv6_prefix: "",
    session_timeout: "",
    idle_timeout: "",
  });

  // Fetch bandwidth profiles
  const { data: profiles } = useQuery<BandwidthProfile[]>({
    queryKey: ["bandwidth-profiles"],
    queryFn: async () => {
      try {
        const response = await apiClient.get("/radius/bandwidth-profiles", {
          params: { skip: 0, limit: 100 },
        });
        return response.data;
      } catch (error) {
        logger.error("Failed to fetch bandwidth profiles", { error });
        return [];
      }
    },
  });

  // Create subscriber mutation
  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiClient.post("/radius/subscribers", data);
      return response.data;
    },
    onSuccess: () => {
      toast({
        title: "Subscriber created",
        description: "RADIUS subscriber has been created successfully.",
      });
      router.push("/dashboard/radius/subscribers");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.response?.data?.detail || "Failed to create subscriber",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate required fields
    if (!formData.subscriber_id || !formData.username || !formData.password) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    // Prepare data for API
    const apiData: any = {
      subscriber_id: formData.subscriber_id,
      username: formData.username,
      password: formData.password,
    };

    if (formData.bandwidth_profile_id) {
      apiData.bandwidth_profile_id = formData.bandwidth_profile_id;
    }

    if (formData.framed_ipv4_address) {
      apiData.framed_ipv4_address = formData.framed_ipv4_address;
    }

    if (formData.framed_ipv6_address) {
      apiData.framed_ipv6_address = formData.framed_ipv6_address;
    }

    if (formData.delegated_ipv6_prefix) {
      apiData.delegated_ipv6_prefix = formData.delegated_ipv6_prefix;
    }

    if (formData.session_timeout) {
      apiData.session_timeout = parseInt(formData.session_timeout, 10);
    }

    if (formData.idle_timeout) {
      apiData.idle_timeout = parseInt(formData.idle_timeout, 10);
    }

    createMutation.mutate(apiData);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard/radius/subscribers">
          <Button variant="outline" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">New RADIUS Subscriber</h1>
          <p className="text-muted-foreground">Create new RADIUS authentication credentials</p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit}>
        <div className="space-y-6">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="subscriber_id">
                    Subscriber ID <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="subscriber_id"
                    value={formData.subscriber_id}
                    onChange={(e) => setFormData({ ...formData, subscriber_id: e.target.value })}
                    placeholder="e.g., SUB001"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="username">
                    Username <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="username"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    placeholder="e.g., user@domain.com"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">
                    Password <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="Minimum 8 characters"
                    minLength={8}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bandwidth_profile_id">Bandwidth Profile</Label>
                  <Select
                    value={formData.bandwidth_profile_id}
                    onValueChange={(value) =>
                      setFormData({ ...formData, bandwidth_profile_id: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select bandwidth profile" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">None</SelectItem>
                      {profiles?.map((profile) => (
                        <SelectItem key={profile.id} value={profile.id}>
                          {profile.name} ({profile.download_rate}/{profile.upload_rate} Mbps)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* IP Configuration */}
          <Card>
            <CardHeader>
              <CardTitle>IP Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="framed_ipv4_address">Framed IPv4 Address</Label>
                  <Input
                    id="framed_ipv4_address"
                    value={formData.framed_ipv4_address}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        framed_ipv4_address: e.target.value,
                      })
                    }
                    placeholder="e.g., 10.0.0.100 (leave empty for dynamic)"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="framed_ipv6_address">Framed IPv6 Address</Label>
                  <Input
                    id="framed_ipv6_address"
                    value={formData.framed_ipv6_address}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        framed_ipv6_address: e.target.value,
                      })
                    }
                    placeholder="e.g., 2001:db8::1 (leave empty for dynamic)"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="delegated_ipv6_prefix">Delegated IPv6 Prefix</Label>
                  <Input
                    id="delegated_ipv6_prefix"
                    value={formData.delegated_ipv6_prefix}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        delegated_ipv6_prefix: e.target.value,
                      })
                    }
                    placeholder="e.g., 2001:db8::/64"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Session Timeouts */}
          <Card>
            <CardHeader>
              <CardTitle>Session Timeouts</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="session_timeout">Session Timeout (seconds)</Label>
                  <Input
                    id="session_timeout"
                    type="number"
                    value={formData.session_timeout}
                    onChange={(e) => setFormData({ ...formData, session_timeout: e.target.value })}
                    placeholder="e.g., 3600 (leave empty for unlimited)"
                    min="1"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="idle_timeout">Idle Timeout (seconds)</Label>
                  <Input
                    id="idle_timeout"
                    type="number"
                    value={formData.idle_timeout}
                    onChange={(e) => setFormData({ ...formData, idle_timeout: e.target.value })}
                    placeholder="e.g., 600 (leave empty for unlimited)"
                    min="1"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex gap-4 justify-end">
            <Link href="/dashboard/radius/subscribers">
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </Link>
            <Button type="submit" disabled={createMutation.isPending}>
              <Save className="mr-2 h-4 w-4" />
              {createMutation.isPending ? "Creating..." : "Create Subscriber"}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
