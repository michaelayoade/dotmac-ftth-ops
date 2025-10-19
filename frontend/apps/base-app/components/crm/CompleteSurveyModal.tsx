"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import {
  CheckCircle2,
  Upload,
  X,
  Loader2,
  Radio,
  Ruler,
  DollarSign,
  Clock,
  Wrench,
  FileText,
  AlertTriangle,
} from "lucide-react";
import { useSiteSurveys } from "@/hooks/useCRM";
import type { SiteSurvey, Serviceability } from "@/hooks/useCRM";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

interface CompleteSurveyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  survey: SiteSurvey | null;
  onSuccess?: () => void;
}

interface PhotoUpload {
  id: string;
  file: File;
  preview: string;
  description: string;
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
  const [photos, setPhotos] = useState<PhotoUpload[]>([]);
  const [formData, setFormData] = useState({
    // Serviceability Assessment
    serviceability: "" as Serviceability | "",

    // Technical Details
    nearest_fiber_distance_meters: "",
    requires_fiber_extension: false,
    fiber_extension_cost: "",
    nearest_olt_id: "",
    available_pon_ports: "",

    // Installation Requirements
    estimated_installation_time_hours: "",
    installation_complexity: "" as "simple" | "moderate" | "complex" | "",
    special_equipment_required: "",

    // Documentation
    recommendations: "",
    obstacles: "",

    // Auto-update lead
    update_lead_serviceability: true,
  });

  // Reset form when survey changes
  useEffect(() => {
    if (survey) {
      setFormData({
        serviceability: survey.serviceability || "",
        nearest_fiber_distance_meters: survey.nearest_fiber_distance_meters?.toString() || "",
        requires_fiber_extension: survey.requires_fiber_extension || false,
        fiber_extension_cost: survey.fiber_extension_cost?.toString() || "",
        nearest_olt_id: survey.nearest_olt_id || "",
        available_pon_ports: survey.available_pon_ports?.toString() || "",
        estimated_installation_time_hours: survey.estimated_installation_time_hours?.toString() || "",
        installation_complexity: survey.installation_complexity || "",
        special_equipment_required: survey.special_equipment_required.join(", ") || "",
        recommendations: "",
        obstacles: "",
        update_lead_serviceability: true,
      });
      setPhotos([]);
    }
  }, [survey]);

  const handlePhotoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);

    const newPhotos: PhotoUpload[] = files.map((file) => ({
      id: Math.random().toString(36).substr(2, 9),
      file,
      preview: URL.createObjectURL(file),
      description: "",
    }));

    setPhotos([...photos, ...newPhotos]);
  };

  const removePhoto = (photoId: string) => {
    const photo = photos.find((p) => p.id === photoId);
    if (photo) {
      URL.revokeObjectURL(photo.preview);
    }
    setPhotos(photos.filter((p) => p.id !== photoId));
  };

  const updatePhotoDescription = (photoId: string, description: string) => {
    setPhotos(
      photos.map((p) =>
        p.id === photoId ? { ...p, description } : p
      )
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!survey) return;

    if (!formData.serviceability) {
      toast({
        title: "Validation Error",
        description: "Please select serviceability assessment",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const completionData = {
        serviceability: formData.serviceability as Serviceability,
        nearest_fiber_distance_meters: formData.nearest_fiber_distance_meters
          ? parseInt(formData.nearest_fiber_distance_meters)
          : undefined,
        requires_fiber_extension: formData.requires_fiber_extension,
        fiber_extension_cost: formData.fiber_extension_cost
          ? parseFloat(formData.fiber_extension_cost)
          : undefined,
        nearest_olt_id: formData.nearest_olt_id || undefined,
        available_pon_ports: formData.available_pon_ports
          ? parseInt(formData.available_pon_ports)
          : undefined,
        estimated_installation_time_hours: formData.estimated_installation_time_hours
          ? parseFloat(formData.estimated_installation_time_hours)
          : undefined,
        installation_complexity: formData.installation_complexity || undefined,
        special_equipment_required: formData.special_equipment_required
          ? formData.special_equipment_required.split(",").map((s) => s.trim()).filter(Boolean)
          : [],
        recommendations: formData.recommendations || undefined,
        obstacles: formData.obstacles || undefined,
        // TODO: In a real implementation, upload photos to storage and include URLs
        photos: photos.map((p) => ({
          url: p.preview, // This would be replaced with actual uploaded URL
          description: p.description,
          timestamp: new Date().toISOString(),
        })),
      };

      const success = await completeSurvey(survey.id, completionData);

      if (success) {
        toast({
          title: "Survey Completed",
          description: `Survey ${survey.survey_number} has been completed successfully`,
        });

        // Reset form
        setFormData({
          serviceability: "",
          nearest_fiber_distance_meters: "",
          requires_fiber_extension: false,
          fiber_extension_cost: "",
          nearest_olt_id: "",
          available_pon_ports: "",
          estimated_installation_time_hours: "",
          installation_complexity: "",
          special_equipment_required: "",
          recommendations: "",
          obstacles: "",
          update_lead_serviceability: true,
        });
        setPhotos([]);

        onSuccess?.();
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to complete survey",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!survey) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Complete Site Survey</DialogTitle>
          <DialogDescription>
            Record technical assessment and installation requirements for{" "}
            {survey.survey_number}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Tabs defaultValue="assessment" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="assessment">Assessment</TabsTrigger>
              <TabsTrigger value="technical">Technical</TabsTrigger>
              <TabsTrigger value="installation">Installation</TabsTrigger>
              <TabsTrigger value="documentation">Documentation</TabsTrigger>
            </TabsList>

            {/* Assessment Tab */}
            <TabsContent value="assessment" className="space-y-4">
              <Alert>
                <Radio className="h-4 w-4" />
                <AlertTitle>Serviceability Assessment</AlertTitle>
                <AlertDescription className="text-xs mt-2">
                  Determine if the location can be served and any construction requirements
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label htmlFor="serviceability">
                  Serviceability Result <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={formData.serviceability}
                  onValueChange={(value: Serviceability) =>
                    setFormData({ ...formData, serviceability: value })
                  }
                >
                  <SelectTrigger id="serviceability">
                    <SelectValue placeholder="Select serviceability" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="serviceable">
                      ✅ Serviceable - Can serve immediately
                    </SelectItem>
                    <SelectItem value="not_serviceable">
                      ❌ Not Serviceable - Cannot serve
                    </SelectItem>
                    <SelectItem value="pending_expansion">
                      ⏳ Pending Expansion - Coming soon
                    </SelectItem>
                    <SelectItem value="requires_construction">
                      🔧 Requires Construction - Fiber extension needed
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formData.serviceability && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Impact on Lead</AlertTitle>
                  <AlertDescription className="text-xs mt-2">
                    {formData.update_lead_serviceability && (
                      <p>
                        Lead serviceability will be automatically updated to:{" "}
                        <strong>{formData.serviceability}</strong>
                      </p>
                    )}
                    {formData.serviceability === "serviceable" && (
                      <p className="mt-1">
                        Lead can proceed to quote generation
                      </p>
                    )}
                    {formData.serviceability === "not_serviceable" && (
                      <p className="mt-1 text-red-600">
                        Lead should be disqualified
                      </p>
                    )}
                    {formData.serviceability === "requires_construction" && (
                      <p className="mt-1">
                        Quote should include fiber extension costs
                      </p>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex items-center space-x-2">
                <Switch
                  id="update_lead"
                  checked={formData.update_lead_serviceability}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, update_lead_serviceability: checked })
                  }
                />
                <Label htmlFor="update_lead">
                  Automatically update lead serviceability
                </Label>
              </div>
            </TabsContent>

            {/* Technical Details Tab */}
            <TabsContent value="technical" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="fiber_distance">
                    <Ruler className="w-4 h-4 inline mr-1" />
                    Nearest Fiber Distance (meters)
                  </Label>
                  <Input
                    id="fiber_distance"
                    type="number"
                    value={formData.nearest_fiber_distance_meters}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        nearest_fiber_distance_meters: e.target.value,
                      })
                    }
                    placeholder="e.g., 85"
                  />
                </div>

                <div className="flex items-center space-x-2 pt-8">
                  <Switch
                    id="requires_extension"
                    checked={formData.requires_fiber_extension}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, requires_fiber_extension: checked })
                    }
                  />
                  <Label htmlFor="requires_extension">
                    Requires Fiber Extension
                  </Label>
                </div>
              </div>

              {formData.requires_fiber_extension && (
                <div className="space-y-2">
                  <Label htmlFor="extension_cost">
                    <DollarSign className="w-4 h-4 inline mr-1" />
                    Fiber Extension Cost (USD)
                  </Label>
                  <Input
                    id="extension_cost"
                    type="number"
                    step="0.01"
                    value={formData.fiber_extension_cost}
                    onChange={(e) =>
                      setFormData({ ...formData, fiber_extension_cost: e.target.value })
                    }
                    placeholder="e.g., 2500.00"
                  />
                  <p className="text-xs text-muted-foreground">
                    Estimated cost for fiber extension to reach the property
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="olt_id">Nearest OLT ID</Label>
                  <Input
                    id="olt_id"
                    value={formData.nearest_olt_id}
                    onChange={(e) =>
                      setFormData({ ...formData, nearest_olt_id: e.target.value })
                    }
                    placeholder="e.g., OLT-DOWNTOWN-03"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="pon_ports">Available PON Ports</Label>
                  <Input
                    id="pon_ports"
                    type="number"
                    value={formData.available_pon_ports}
                    onChange={(e) =>
                      setFormData({ ...formData, available_pon_ports: e.target.value })
                    }
                    placeholder="e.g., 12"
                  />
                </div>
              </div>
            </TabsContent>

            {/* Installation Tab */}
            <TabsContent value="installation" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="install_time">
                    <Clock className="w-4 h-4 inline mr-1" />
                    Estimated Installation Time (hours)
                  </Label>
                  <Input
                    id="install_time"
                    type="number"
                    step="0.5"
                    value={formData.estimated_installation_time_hours}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        estimated_installation_time_hours: e.target.value,
                      })
                    }
                    placeholder="e.g., 3.5"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="complexity">
                    <Wrench className="w-4 h-4 inline mr-1" />
                    Installation Complexity
                  </Label>
                  <Select
                    value={formData.installation_complexity}
                    onValueChange={(value: any) =>
                      setFormData({ ...formData, installation_complexity: value })
                    }
                  >
                    <SelectTrigger id="complexity">
                      <SelectValue placeholder="Select complexity" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="simple">
                        Simple - Standard aerial/underground drop
                      </SelectItem>
                      <SelectItem value="moderate">
                        Moderate - Minor obstacles, some additional work
                      </SelectItem>
                      <SelectItem value="complex">
                        Complex - Significant challenges, custom solutions
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="equipment">Special Equipment Required</Label>
                <Input
                  id="equipment"
                  value={formData.special_equipment_required}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      special_equipment_required: e.target.value,
                    })
                  }
                  placeholder="e.g., Long-range fiber finder, Pole climbing equipment"
                />
                <p className="text-xs text-muted-foreground">
                  Comma-separated list of special equipment needed
                </p>
              </div>
            </TabsContent>

            {/* Documentation Tab */}
            <TabsContent value="documentation" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="recommendations">
                  <FileText className="w-4 h-4 inline mr-1" />
                  Recommendations
                </Label>
                <Textarea
                  id="recommendations"
                  value={formData.recommendations}
                  onChange={(e) =>
                    setFormData({ ...formData, recommendations: e.target.value })
                  }
                  placeholder="Recommended service plan, installation approach, upsell opportunities, etc."
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="obstacles">
                  <AlertTriangle className="w-4 h-4 inline mr-1" />
                  Obstacles or Concerns
                </Label>
                <Textarea
                  id="obstacles"
                  value={formData.obstacles}
                  onChange={(e) =>
                    setFormData({ ...formData, obstacles: e.target.value })
                  }
                  placeholder="Permitting requirements, property owner approvals, utility coordination, access challenges, etc."
                  rows={4}
                />
              </div>

              {/* Photo Upload */}
              <div className="space-y-2">
                <Label htmlFor="photos">
                  <Upload className="w-4 h-4 inline mr-1" />
                  Site Photos
                </Label>
                <div className="border-2 border-dashed rounded-lg p-4">
                  <Input
                    id="photos"
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handlePhotoUpload}
                    className="hidden"
                  />
                  <label
                    htmlFor="photos"
                    className="cursor-pointer flex flex-col items-center justify-center space-y-2"
                  >
                    <Upload className="w-8 h-8 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      Click to upload photos or drag and drop
                    </p>
                    <p className="text-xs text-muted-foreground">
                      PNG, JPG up to 10MB each
                    </p>
                  </label>
                </div>

                {/* Photo Previews */}
                {photos.length > 0 && (
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    {photos.map((photo) => (
                      <div
                        key={photo.id}
                        className="relative border rounded-lg p-2 space-y-2"
                      >
                        <div className="relative aspect-video">
                          <Image
                            src={photo.preview}
                            alt="Preview"
                            fill
                            unoptimized
                            className="rounded object-cover"
                            sizes="(max-width: 768px) 100vw, 50vw"
                          />
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            className="absolute top-2 right-2"
                            onClick={() => removePhoto(photo.id)}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                        <Input
                          placeholder="Photo description..."
                          value={photo.description}
                          onChange={(e) =>
                            updatePhotoDescription(photo.id, e.target.value)
                          }
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Completing...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Complete Survey
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
