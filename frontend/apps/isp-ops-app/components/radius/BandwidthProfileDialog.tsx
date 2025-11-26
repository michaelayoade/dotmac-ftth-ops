"use client";

import React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { BandwidthProfileDialog as SharedBandwidthProfileDialog } from "@dotmac/features/radius";
import type { BandwidthProfile } from "@dotmac/features/radius";
import { apiClient } from "@/lib/api/client";
import { useToast } from "@dotmac/ui";
import { logger } from "@/lib/logger";

interface BandwidthProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile?: BandwidthProfile | null;
}

export function BandwidthProfileDialog({
  open,
  onOpenChange,
  profile,
}: BandwidthProfileDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Create/Update mutation
  const mutation = useMutation({
    mutationFn: async ({
      data,
      isEdit,
      profileId,
    }: {
      data: any;
      isEdit: boolean;
      profileId?: string | undefined;
    }) => {
      if (isEdit && profileId) {
        const response = await apiClient.patch(`/radius/bandwidth-profiles/${profileId}`, data);
        return response.data;
      } else {
        const response = await apiClient.post("/radius/bandwidth-profiles", data);
        return response.data;
      }
    },
    onSuccess: (_, { isEdit }) => {
      queryClient.invalidateQueries({ queryKey: ["bandwidth-profiles"] });
      toast({
        title: isEdit ? "Profile updated" : "Profile created",
        description: `Bandwidth profile has been ${isEdit ? "updated" : "created"} successfully.`,
      });
      onOpenChange(false);
    },
    onError: (error: any) => {
      logger.error("Failed to save bandwidth profile", { error });
      toast({
        title: "Error",
        description: error.response?.data?.detail || "Failed to save bandwidth profile",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = async (data: any, isEdit: boolean, profileId?: string | undefined) => {
    await mutation.mutateAsync({ data, isEdit, profileId: profileId ?? undefined });
  };

  return (
    <SharedBandwidthProfileDialog
      open={open}
      onOpenChange={onOpenChange}
      profile={profile}
      onSubmit={handleSubmit}
      isPending={mutation.isPending}
    />
  );
}
