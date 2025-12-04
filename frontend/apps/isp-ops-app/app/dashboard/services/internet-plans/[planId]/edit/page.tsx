"use client";

/**
 * Edit Internet Service Plan Page
 *
 * Allows ISP operators to modify existing internet plans including FUP settings.
 */

import { useParams, useRouter } from "next/navigation";
import { InternetPlanForm } from "@/components/plans/InternetPlanForm";
import { useInternetPlan, useUpdateInternetPlan } from "@/hooks/useInternetPlans";
import type { InternetServicePlanCreate } from "@/types/internet-plans";
import { Card } from "@dotmac/ui";
import { CheckCircle } from "lucide-react";

export default function EditPlanPage() {
  const params = useParams();
  const router = useRouter();
  const planId = params["planId"] as string;

  const { data: plan, isLoading, isError, error } = useInternetPlan(planId);
  const { mutate: updatePlan, isPending, isSuccess, error: updateError } = useUpdateInternetPlan();

  const handleSubmit = (data: InternetServicePlanCreate) => {
    updatePlan(
      { planId, data },
      {
        onSuccess: () => {
          // Show success message briefly, then redirect back to plan detail
          setTimeout(() => {
            router.push(`/dashboard/services/internet-plans/${planId}`);
          }, 1500);
        },
      },
    );
  };

  const handleCancel = () => {
    router.push(`/dashboard/services/internet-plans/${planId}`);
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">Loading plan...</p>
        </Card>
      </div>
    );
  }

  if (isError || !plan) {
    return (
      <div className="p-6">
        <Card className="p-8 text-center">
          <p className="text-red-500 font-semibold">Failed to load plan</p>
          <p className="text-sm text-muted-foreground">{error?.message || "Plan not found"}</p>
        </Card>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="p-6">
        <Card className="p-8 text-center max-w-md mx-auto">
          <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Plan Updated Successfully!</h2>
          <p className="text-muted-foreground">Redirecting to plan details...</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      {updateError && (
        <div className="mx-6 mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700 font-semibold">Failed to update plan</p>
          <p className="text-sm text-red-600">{updateError?.message || "Unknown error occurred"}</p>
        </div>
      )}

      <InternetPlanForm
        plan={plan}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        isSubmitting={isPending}
      />
    </div>
  );
}
