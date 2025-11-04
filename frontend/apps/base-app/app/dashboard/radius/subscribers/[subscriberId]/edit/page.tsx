"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Save } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiClient } from "@/lib/api/client";
import { useToast } from "@/components/ui/use-toast";
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

export default function RadiusSubscriberEditPage(): JSX.Element {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const subscriberKey = useMemo(() => {
    const value = params?.subscriberId;
    if (!value) {
      return "";
    }
    return decodeURIComponent(Array.isArray(value) ? value[0] : value);
  }, [params]);

  const [formData, setFormData] = useState({
    password: "",
    bandwidth_profile_id: "",
    framed_ipv4_address: "",
    framed_ipv6_address: "",
    delegated_ipv6_prefix: "",
    session_timeout: "",
    idle_timeout: "",
  });

  const {
    data: subscriber,
    isLoading: subscriberLoading,
    isError: subscriberError,
  } = useQuery<RADIUSSubscriber>({
    queryKey: ["radius-subscriber", subscriberKey],
    queryFn: async () => {
      const response = await apiClient.get(`/radius/subscribers/${subscriberKey}`);
      return response.data;
    },
    enabled: Boolean(subscriberKey),
    retry: false,
  });

  const { data: profiles = [] } = useQuery<BandwidthProfile[]>({
    queryKey: ["radius-bandwidth-profiles"],
    queryFn: async () => {
      const response = await apiClient.get("/radius/bandwidth-profiles", {
        params: { skip: 0, limit: 100 },
      });
      return response.data;
    },
  });

  useEffect(() => {
    if (subscriber) {
      setFormData({
        password: "",
        bandwidth_profile_id: subscriber.bandwidth_profile_id ?? "",
        framed_ipv4_address: subscriber.framed_ipv4_address ?? "",
        framed_ipv6_address: subscriber.framed_ipv6_address ?? "",
        delegated_ipv6_prefix: subscriber.delegated_ipv6_prefix ?? "",
        session_timeout: subscriber.session_timeout ? String(subscriber.session_timeout) : "",
        idle_timeout: subscriber.idle_timeout ? String(subscriber.idle_timeout) : "",
      });
    }
  }, [subscriber]);

  const updateMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const response = await apiClient.patch(`/radius/subscribers/${subscriberKey}`, payload);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["radius-subscribers"] });
      queryClient.invalidateQueries({ queryKey: ["radius-subscriber", subscriberKey] });
      toast({
        title: "Subscriber updated",
        description: "RADIUS subscriber details saved successfully.",
      });
      router.push("/dashboard/radius/subscribers");
    },
    onError: (error: any) => {
      logger.error("Failed to update subscriber", { error });
      toast({
        title: "Error",
        description: error?.response?.data?.detail || "Unable to update subscriber.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!subscriber) {
      toast({
        title: "Subscriber not loaded",
        description: "Unable to update before data is loaded.",
        variant: "destructive",
      });
      return;
    }

    const payload: Record<string, unknown> = {};

    if (formData.password) {
      payload.password = formData.password;
    }

    if ((subscriber.bandwidth_profile_id ?? "") !== formData.bandwidth_profile_id) {
      payload.bandwidth_profile_id = formData.bandwidth_profile_id || null;
    }

    if ((subscriber.framed_ipv4_address ?? "") !== formData.framed_ipv4_address) {
      payload.framed_ipv4_address = formData.framed_ipv4_address || null;
    }

    if ((subscriber.framed_ipv6_address ?? "") !== formData.framed_ipv6_address) {
      payload.framed_ipv6_address = formData.framed_ipv6_address || null;
    }

    if ((subscriber.delegated_ipv6_prefix ?? "") !== formData.delegated_ipv6_prefix) {
      payload.delegated_ipv6_prefix = formData.delegated_ipv6_prefix || null;
    }

    const parsedSessionTimeout = formData.session_timeout
      ? parseInt(formData.session_timeout, 10)
      : null;
    if ((subscriber.session_timeout ?? null) !== parsedSessionTimeout) {
      payload.session_timeout = parsedSessionTimeout;
    }

    const parsedIdleTimeout = formData.idle_timeout ? parseInt(formData.idle_timeout, 10) : null;
    if ((subscriber.idle_timeout ?? null) !== parsedIdleTimeout) {
      payload.idle_timeout = parsedIdleTimeout;
    }

    if (Object.keys(payload).length === 0) {
      toast({
        title: "No changes detected",
        description: "Update fields before submitting.",
      });
      return;
    }

    updateMutation.mutate(payload);
  };

  if (!subscriberKey) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Invalid subscriber identifier.</p>
      </div>
    );
  }

  if (subscriberLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading subscriber...</p>
      </div>
    );
  }

  if (subscriberError || !subscriber) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Unable to load subscriber details.</p>
        <Button variant="outline" onClick={() => router.push("/dashboard/radius/subscribers")}>
          Back to Subscribers
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/radius/subscribers">
          <Button variant="outline" size="icon" aria-label="Back to subscribers">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">Edit Subscriber</h1>
          <p className="text-muted-foreground">
            Update authentication details for{" "}
            <span className="font-semibold">{subscriber.username}</span>
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Subscriber Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Leave blank to keep current password"
                  value={formData.password}
                  onChange={(event) =>
                    setFormData((prev) => ({ ...prev, password: event.target.value }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="bandwidth_profile">Bandwidth Profile</Label>
                <Select
                  value={formData.bandwidth_profile_id}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, bandwidth_profile_id: value }))
                  }
                >
                  <SelectTrigger id="bandwidth_profile">
                    <SelectValue placeholder="Select bandwidth profile" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {profiles.map((profile) => (
                      <SelectItem key={profile.id} value={profile.id}>
                        {profile.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="framed_ipv4">Static IPv4 Address</Label>
                <Input
                  id="framed_ipv4"
                  value={formData.framed_ipv4_address}
                  onChange={(event) =>
                    setFormData((prev) => ({ ...prev, framed_ipv4_address: event.target.value }))
                  }
                  placeholder="Optional static IPv4"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="framed_ipv6">Static IPv6 Address</Label>
                <Input
                  id="framed_ipv6"
                  value={formData.framed_ipv6_address}
                  onChange={(event) =>
                    setFormData((prev) => ({ ...prev, framed_ipv6_address: event.target.value }))
                  }
                  placeholder="Optional static IPv6"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="delegated_ipv6">Delegated IPv6 Prefix</Label>
                <Input
                  id="delegated_ipv6"
                  value={formData.delegated_ipv6_prefix}
                  onChange={(event) =>
                    setFormData((prev) => ({
                      ...prev,
                      delegated_ipv6_prefix: event.target.value,
                    }))
                  }
                  placeholder="2001:db8::/56"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="session_timeout">Session Timeout (seconds)</Label>
                <Input
                  id="session_timeout"
                  type="number"
                  min={0}
                  value={formData.session_timeout}
                  onChange={(event) =>
                    setFormData((prev) => ({ ...prev, session_timeout: event.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="idle_timeout">Idle Timeout (seconds)</Label>
                <Input
                  id="idle_timeout"
                  type="number"
                  min={0}
                  value={formData.idle_timeout}
                  onChange={(event) =>
                    setFormData((prev) => ({ ...prev, idle_timeout: event.target.value }))
                  }
                />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push("/dashboard/radius/subscribers")}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                <Save className="mr-2 h-4 w-4" />
                Save Changes
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
