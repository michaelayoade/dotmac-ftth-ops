"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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

interface RADIUSSubscriber {
  subscriber_id: string;
  username: string;
  bandwidth_profile_id?: string | null;
  framed_ipv4_address?: string | null;
  framed_ipv6_address?: string | null;
  delegated_ipv6_prefix?: string | null;
  session_timeout?: number | null;
  idle_timeout?: number | null;
}

export default function EditRADIUSSubscriberPage() {
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const subscriberId = decodeURIComponent(params["subscriberId"] as string);

  const [formData, setFormData] = useState({
    password: "",
    bandwidth_profile_id: "",
    framed_ipv4_address: "",
    framed_ipv6_address: "",
    delegated_ipv6_prefix: "",
    session_timeout: "",
    idle_timeout: "",
  });

  // Fetch subscriber details
  const { data: subscriber, isLoading: subscriberLoading } = useQuery<RADIUSSubscriber>({
    queryKey: ["radius-subscriber", subscriberId],
    queryFn: async () => {
      try {
        const response = await apiClient.get(`/radius/subscribers/${subscriberId}`);
        return response.data;
      } catch (error) {
        logger.error("Failed to fetch subscriber", { error });
        throw error;
      }
    },
    enabled: !!subscriberId,
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

  // Populate form with existing data
  useEffect(() => {
    if (subscriber) {
      setFormData({
        password: "", // Don't populate password
        bandwidth_profile_id: subscriber.bandwidth_profile_id || "",
        framed_ipv4_address: subscriber.framed_ipv4_address || "",
        framed_ipv6_address: subscriber.framed_ipv6_address || "",
        delegated_ipv6_prefix: subscriber.delegated_ipv6_prefix || "",
        session_timeout: subscriber.session_timeout ? String(subscriber.session_timeout) : "",
        idle_timeout: subscriber.idle_timeout ? String(subscriber.idle_timeout) : "",
      });
    }
  }, [subscriber]);

  // Update subscriber mutation
  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiClient.patch(`/radius/subscribers/${subscriberId}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["radius-subscribers"] });
      queryClient.invalidateQueries({ queryKey: ["radius-subscriber", subscriberId] });
      toast({
        title: "Subscriber updated",
        description: "RADIUS subscriber has been updated successfully.",
      });
      router.push("/dashboard/radius/subscribers");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.response?.data?.detail || "Failed to update subscriber",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Prepare data for API (only send changed fields)
    const apiData: any = {};

    // Only include password if it was changed
    if (formData.password) {
      apiData.password = formData.password;
    }

    if (formData.bandwidth_profile_id !== (subscriber?.bandwidth_profile_id || "")) {
      apiData.bandwidth_profile_id = formData.bandwidth_profile_id || null;
    }

    if (formData.framed_ipv4_address !== (subscriber?.framed_ipv4_address || "")) {
      apiData.framed_ipv4_address = formData.framed_ipv4_address || null;
    }

    if (formData.framed_ipv6_address !== (subscriber?.framed_ipv6_address || "")) {
      apiData.framed_ipv6_address = formData.framed_ipv6_address || null;
    }

    if (formData.delegated_ipv6_prefix !== (subscriber?.delegated_ipv6_prefix || "")) {
      apiData.delegated_ipv6_prefix = formData.delegated_ipv6_prefix || null;
    }

    const newSessionTimeout = formData.session_timeout
      ? parseInt(formData.session_timeout, 10)
      : null;
    if (newSessionTimeout !== (subscriber?.session_timeout || null)) {
      apiData.session_timeout = newSessionTimeout;
    }

    const newIdleTimeout = formData.idle_timeout ? parseInt(formData.idle_timeout, 10) : null;
    if (newIdleTimeout !== (subscriber?.idle_timeout || null)) {
      apiData.idle_timeout = newIdleTimeout;
    }

    // Check if anything changed
    if (Object.keys(apiData).length === 0) {
      toast({
        title: "No changes",
        description: "No fields were modified.",
        variant: "default",
      });
      return;
    }

    updateMutation.mutate(apiData);
  };

  if (subscriberLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Loading subscriber...</p>
      </div>
    );
  }

  if (!subscriber) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <p className="text-muted-foreground mb-4">Subscriber not found</p>
        <Link href="/dashboard/radius/subscribers">
          <Button variant="outline">Back to Subscribers</Button>
        </Link>
      </div>
    );
  }

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
          <h1 className="text-3xl font-bold">Edit RADIUS Subscriber</h1>
          <p className="text-muted-foreground">
            Update credentials and settings for {subscriber?.username || subscriberId}
          </p>
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
                  <Label>Subscriber ID</Label>
                  <Input value={subscriber.subscriber_id} disabled />
                  <p className="text-xs text-muted-foreground">Cannot be changed</p>
                </div>

                <div className="space-y-2">
                  <Label>Username</Label>
                  <Input value={subscriber?.username || ""} disabled />
                  <p className="text-xs text-muted-foreground">Cannot be changed</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">New Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="Leave empty to keep current password"
                    minLength={8}
                  />
                  <p className="text-xs text-muted-foreground">
                    Leave empty to keep current password
                  </p>
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
                          {profile.name} ({profile.download_rate}/{profile.upload_rate} Kbps)
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
            <Button type="submit" disabled={updateMutation.isPending}>
              <Save className="mr-2 h-4 w-4" />
              {updateMutation.isPending ? "Updating..." : "Update Subscriber"}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
