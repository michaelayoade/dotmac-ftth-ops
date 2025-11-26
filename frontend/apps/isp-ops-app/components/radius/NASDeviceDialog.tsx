"use client";

import React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { NASDeviceDialog as SharedNASDeviceDialog } from "@dotmac/features/radius";
import type { NASDevice, NASDeviceFormData } from "@dotmac/features/radius";
import { apiClient } from "@/lib/api/client";
import { useToast } from "@dotmac/ui";
import { logger } from "@/lib/logger";

interface NASDeviceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nasDevice?: NASDevice | null;
}

export function NASDeviceDialog({ open, onOpenChange, nasDevice }: NASDeviceDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Create/Update mutation
  const mutation = useMutation({
    mutationFn: async ({
      data,
      isEdit,
      deviceId,
    }: {
      data: NASDeviceFormData;
      isEdit: boolean;
      deviceId?: number | undefined;
    }) => {
      if (isEdit && deviceId) {
        const response = await apiClient.patch(`/radius/nas/${deviceId}`, data);
        return response.data;
      } else {
        const response = await apiClient.post("/radius/nas", data);
        return response.data;
      }
    },
    onSuccess: (_, { isEdit }) => {
      queryClient.invalidateQueries({ queryKey: ["radius-nas"] });
      toast({
        title: isEdit ? "NAS device updated" : "NAS device created",
        description: `NAS device has been ${isEdit ? "updated" : "created"} successfully.`,
      });
      onOpenChange(false);
    },
    onError: (error: any) => {
      logger.error("Failed to save NAS device", { error });
      toast({
        title: "Error",
        description: error.response?.data?.detail || "Failed to save NAS device",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = async (
    data: NASDeviceFormData,
    isEdit: boolean,
    deviceId?: number | undefined,
  ) => {
    await mutation.mutateAsync({ data, isEdit, deviceId: deviceId ?? undefined });
  };

  return (
    <SharedNASDeviceDialog
      open={open}
      onOpenChange={onOpenChange}
      nasDevice={nasDevice}
      onSubmit={handleSubmit}
      isPending={mutation.isPending}
    />
  );
}
