"use client";

/**
 * Create New Internet Service Plan Page
 *
 * Allows ISP operators to design new internet plans with full FUP configuration.
 */

import { useRouter } from "next/navigation";
import { InternetPlanForm } from "@/components/plans/InternetPlanForm";
import { useCreateInternetPlan } from "@/hooks/useInternetPlans";
import type { InternetServicePlanCreate } from "@/types/internet-plans";
import { Card } from "@dotmac/ui";
import { CheckCircle } from "lucide-react";

export default function NewPlanPage() {
  const router = useRouter();
  const { mutate: createPlan, isPending, isSuccess, isError, error } = useCreateInternetPlan();

  const handleSubmit = (data: InternetServicePlanCreate) => {
    createPlan(data, {
      onSuccess: (createdPlan: { id: string }) => {
        // Show success message briefly, then redirect to the plan detail page
        setTimeout(() => {
          router.push(`/dashboard/services/internet-plans/${createdPlan.id}`);
        }, 1500);
      },
    });
  };

  const handleCancel = () => {
    router.back();
  };

  if (isSuccess) {
    return (
      <div className="p-6">
        <Card className="p-8 text-center max-w-md mx-auto">
          <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Plan Created Successfully!</h2>
          <p className="text-muted-foreground">Redirecting to plan details...</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      {isError && (
        <div className="mx-6 mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700 font-semibold">Failed to create plan</p>
          <p className="text-sm text-red-600">{error?.message || "Unknown error occurred"}</p>
        </div>
      )}

      <InternetPlanForm onSubmit={handleSubmit} onCancel={handleCancel} isSubmitting={isPending} />
    </div>
  );
}
