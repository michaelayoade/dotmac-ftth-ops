"use client";

import React, { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Save, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Input } from "@dotmac/ui";
import { Label } from "@dotmac/ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@dotmac/ui";
import { apiClient } from "@/lib/api/client";
import { useToast } from "@dotmac/ui";
import { logger } from "@/lib/logger";

interface BandwidthProfile {
  id?: string;
  name: string;
  download_rate: number;
  upload_rate: number;
  download_burst?: number | null;
  upload_burst?: number | null;
}

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
  const isEdit = !!profile;

  const [formData, setFormData] = useState({
    name: "",
    download_rate: "",
    upload_rate: "",
    download_burst: "",
    upload_burst: "",
    rateUnit: "Mbps",
  });

  // Populate form when editing
  useEffect(() => {
    if (profile) {
      setFormData({
        name: profile.name,
        download_rate: String(profile.download_rate),
        upload_rate: String(profile.upload_rate),
        download_burst: profile.download_burst
          ? String(profile.download_burst)
          : "",
        upload_burst: profile.upload_burst ? String(profile.upload_burst) : "",
        rateUnit: "Kbps",
      });
    } else {
      // Reset form when creating new
      setFormData({
        name: "",
        download_rate: "",
        upload_rate: "",
        download_burst: "",
        upload_burst: "",
        rateUnit: "Mbps",
      });
    }
  }, [profile, open]);

  // Create/Update mutation
  const mutation = useMutation({
    mutationFn: async (data: any) => {
      if (isEdit && profile?.id) {
        const response = await apiClient.patch(
          `/radius/bandwidth-profiles/${profile.id}`,
          data
        );
        return response.data;
      } else {
        const response = await apiClient.post(
          "/radius/bandwidth-profiles",
          data
        );
        return response.data;
      }
    },
    onSuccess: () => {
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
        description:
          error.response?.data?.detail || "Failed to save bandwidth profile",
        variant: "destructive",
      });
    },
  });

  const convertToKbps = (value: string, unit: string): number => {
    const numValue = parseFloat(value);
    if (unit === "Mbps") {
      return Math.floor(numValue * 1024);
    } else if (unit === "Gbps") {
      return Math.floor(numValue * 1024 * 1024);
    }
    return Math.floor(numValue); // Kbps
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate required fields
    if (
      !formData.name ||
      !formData.download_rate ||
      !formData.upload_rate
    ) {
      toast({
        title: "Validation Error",
        description:
          "Profile name, download rate, and upload rate are required.",
        variant: "destructive",
      });
      return;
    }

    // Validate rates are positive
    if (
      parseFloat(formData.download_rate) <= 0 ||
      parseFloat(formData.upload_rate) <= 0
    ) {
      toast({
        title: "Validation Error",
        description: "Rates must be positive numbers.",
        variant: "destructive",
      });
      return;
    }

    // Convert all rates to Kbps for API
    const apiData: any = {
      name: formData.name,
      download_rate: convertToKbps(formData.download_rate, formData.rateUnit),
      upload_rate: convertToKbps(formData.upload_rate, formData.rateUnit),
    };

    // Add burst rates if provided
    if (formData.download_burst) {
      apiData.download_burst = convertToKbps(
        formData.download_burst,
        formData.rateUnit
      );
    }

    if (formData.upload_burst) {
      apiData.upload_burst = convertToKbps(
        formData.upload_burst,
        formData.rateUnit
      );
    }

    mutation.mutate(apiData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit Bandwidth Profile" : "Create Bandwidth Profile"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update the bandwidth rate limits for this profile."
              : "Create a new bandwidth profile to assign to RADIUS subscribers."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-6 py-4">
            {/* Profile Name */}
            <div className="space-y-2">
              <Label htmlFor="name">
                Profile Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="e.g., Premium 100Mbps, Business 500Mbps"
                required
              />
              <p className="text-xs text-muted-foreground">
                Descriptive name for this bandwidth profile
              </p>
            </div>

            {/* Rate Unit Selector */}
            <div className="space-y-2">
              <Label htmlFor="rateUnit">Rate Unit</Label>
              <Select
                value={formData.rateUnit}
                onValueChange={(value) =>
                  setFormData({ ...formData, rateUnit: value })
                }
                disabled={isEdit}
              >
                <SelectTrigger id="rateUnit">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Kbps">Kbps (Kilobits per second)</SelectItem>
                  <SelectItem value="Mbps">Mbps (Megabits per second)</SelectItem>
                  <SelectItem value="Gbps">Gbps (Gigabits per second)</SelectItem>
                </SelectContent>
              </Select>
              {isEdit && (
                <p className="text-xs text-muted-foreground">
                  Unit cannot be changed when editing (values shown in Kbps)
                </p>
              )}
            </div>

            {/* Download/Upload Rates */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="download_rate">
                  Download Rate <span className="text-destructive">*</span>
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="download_rate"
                    type="number"
                    step="0.01"
                    value={formData.download_rate}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        download_rate: e.target.value,
                      })
                    }
                    placeholder="e.g., 100"
                    required
                    min="0.01"
                  />
                  <span className="flex items-center px-3 text-sm text-muted-foreground border rounded-md bg-muted">
                    {formData.rateUnit}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="upload_rate">
                  Upload Rate <span className="text-destructive">*</span>
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="upload_rate"
                    type="number"
                    step="0.01"
                    value={formData.upload_rate}
                    onChange={(e) =>
                      setFormData({ ...formData, upload_rate: e.target.value })
                    }
                    placeholder="e.g., 50"
                    required
                    min="0.01"
                  />
                  <span className="flex items-center px-3 text-sm text-muted-foreground border rounded-md bg-muted">
                    {formData.rateUnit}
                  </span>
                </div>
              </div>
            </div>

            {/* Burst Rates (Optional) */}
            <div className="space-y-4">
              <div className="space-y-1">
                <h3 className="text-sm font-medium">
                  Burst Rates (Optional)
                </h3>
                <p className="text-xs text-muted-foreground">
                  Allow temporary speed bursts above the normal rate limits
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="download_burst">Download Burst</Label>
                  <div className="flex gap-2">
                    <Input
                      id="download_burst"
                      type="number"
                      step="0.01"
                      value={formData.download_burst}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          download_burst: e.target.value,
                        })
                      }
                      placeholder="e.g., 200"
                      min="0"
                    />
                    <span className="flex items-center px-3 text-sm text-muted-foreground border rounded-md bg-muted">
                      {formData.rateUnit}
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="upload_burst">Upload Burst</Label>
                  <div className="flex gap-2">
                    <Input
                      id="upload_burst"
                      type="number"
                      step="0.01"
                      value={formData.upload_burst}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          upload_burst: e.target.value,
                        })
                      }
                      placeholder="e.g., 100"
                      min="0"
                    />
                    <span className="flex items-center px-3 text-sm text-muted-foreground border rounded-md bg-muted">
                      {formData.rateUnit}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Preview */}
            {formData.download_rate && formData.upload_rate && (
              <div className="p-4 bg-muted rounded-lg space-y-2">
                <h4 className="text-sm font-medium">Preview (in Kbps)</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Download</p>
                    <p className="font-mono font-medium">
                      {convertToKbps(
                        formData.download_rate,
                        formData.rateUnit
                      ).toLocaleString()}{" "}
                      Kbps
                      {formData.download_burst &&
                        ` (burst: ${convertToKbps(formData.download_burst, formData.rateUnit).toLocaleString()} Kbps)`}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Upload</p>
                    <p className="font-mono font-medium">
                      {convertToKbps(
                        formData.upload_rate,
                        formData.rateUnit
                      ).toLocaleString()}{" "}
                      Kbps
                      {formData.upload_burst &&
                        ` (burst: ${convertToKbps(formData.upload_burst, formData.rateUnit).toLocaleString()} Kbps)`}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={mutation.isPending}
            >
              <X className="mr-2 h-4 w-4" />
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              <Save className="mr-2 h-4 w-4" />
              {mutation.isPending
                ? "Saving..."
                : isEdit
                  ? "Update Profile"
                  : "Create Profile"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
