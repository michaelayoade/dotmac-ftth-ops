/**
 * Complete Survey Modal
 *
 * Wrapper that connects the shared CompleteSurveyModal to app-specific hooks.
 */

"use client";

import { useState } from "react";
import {
  CompleteSurveyModal as SharedCompleteSurveyModal,
  type PhotoUpload,
  type SurveyCompletionData,
} from "@dotmac/features/crm";
import type { SiteSurvey } from "@/hooks/useCRM";
import { useCompleteSurvey } from "@/hooks/useCRM";
import { apiClient } from "@/lib/api/client";
import { useToast } from "@dotmac/ui";

interface CompleteSurveyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  survey: SiteSurvey | null;
  onSuccess?: () => void;
}

export function CompleteSurveyModal({
  open,
  onOpenChange,
  survey,
  onSuccess,
}: CompleteSurveyModalProps) {
  const { toast } = useToast();
  const completeSurveyMutation = useCompleteSurvey();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleUploadPhoto = async (photo: PhotoUpload): Promise<string> => {
    const formData = new FormData();
    formData.append("file", photo.file);
    formData.append("description", photo.description);
    formData.append("category", "site_survey");

    try {
      const response = await apiClient.post("/storage/upload", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      return response.data?.url || response.data?.file_url || "";
    } catch (error) {
      console.error("Failed to upload photo:", error);
      throw error;
    }
  };

  const handleCompleteSurvey = async (
    surveyId: string,
    data: SurveyCompletionData,
  ): Promise<boolean> => {
    setIsSubmitting(true);

    try {
      // Show photo upload toast if photos exist
      if (data.photos && data.photos.length > 0) {
        toast({
          title: "Uploading Photos",
          description: `Uploading ${data.photos.length} photo(s)...`,
        });
      }

      // Transform data to match SiteSurveyCompleteRequest (remove undefined values)
      const requestData = {
        serviceability: data.serviceability,
        ...(data.nearest_fiber_distance_meters !== undefined && {
          nearest_fiber_distance_meters: data.nearest_fiber_distance_meters,
        }),
        ...(data.requires_fiber_extension !== undefined && {
          requires_fiber_extension: data.requires_fiber_extension,
        }),
        ...(data.fiber_extension_cost !== undefined && {
          fiber_extension_cost: data.fiber_extension_cost,
        }),
        ...(data.nearest_olt_id !== undefined && { nearest_olt_id: data.nearest_olt_id }),
        ...(data.available_pon_ports !== undefined && {
          available_pon_ports: data.available_pon_ports,
        }),
        ...(data.estimated_installation_time_hours !== undefined && {
          estimated_installation_time_hours: data.estimated_installation_time_hours,
        }),
        ...(data.special_equipment_required &&
          data.special_equipment_required.length > 0 && {
            special_equipment_required: data.special_equipment_required,
          }),
        ...(data.installation_complexity !== undefined && {
          installation_complexity: data.installation_complexity,
        }),
        ...(data.photos && data.photos.length > 0 && { photos: data.photos }),
        ...(data.recommendations !== undefined && { recommendations: data.recommendations }),
        ...(data.obstacles !== undefined && { obstacles: data.obstacles }),
      };

      const result = await completeSurveyMutation.mutateAsync({
        id: surveyId,
        data: requestData,
      });

      toast({
        title: "Survey Completed",
        description: `Survey ${survey?.survey_number} has been completed successfully`,
      });
      return Boolean(result ?? true);
    } catch (error: any) {
      console.error("Failed to complete survey:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to complete survey",
        variant: "destructive",
      });
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SharedCompleteSurveyModal
      open={open}
      onOpenChange={onOpenChange}
      survey={survey as any}
      onSuccess={onSuccess ?? (() => undefined)}
      onCompleteSurvey={handleCompleteSurvey}
      onUploadPhoto={handleUploadPhoto}
      isSubmitting={isSubmitting}
    />
  );
}
