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
import { useSiteSurveys } from "@/hooks/useCRM";
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
  const { completeSurvey } = useSiteSurveys({});
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
      if (data.photos.length > 0) {
        toast({
          title: "Uploading Photos",
          description: `Uploading ${data.photos.length} photo(s)...`,
        });
      }

      const success = await completeSurvey(surveyId, data);

      if (success) {
        toast({
          title: "Survey Completed",
          description: `Survey ${survey?.survey_number} has been completed successfully`,
        });
        return true;
      }

      return false;
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
      onSuccess={onSuccess}
      onCompleteSurvey={handleCompleteSurvey}
      onUploadPhoto={handleUploadPhoto}
      isSubmitting={isSubmitting}
    />
  );
}
