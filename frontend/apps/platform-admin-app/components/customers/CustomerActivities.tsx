/**
 * Customer Activities Component
 *
 * Wrapper that connects the shared CustomerActivities to app-specific dependencies.
 */

import {
  CustomerActivities as SharedCustomerActivities,
  type CustomerActivitiesHook as SharedCustomerActivitiesHook,
  type CustomerActivity as SharedCustomerActivity,
} from "@dotmac/features/crm";
import { useCustomerActivities } from "@/hooks/useCustomersQuery";
import { logger } from "@/lib/logger";

interface CustomerActivitiesProps {
  customerId: string;
}

interface AppCustomerActivity {
  id: string;
  customer_id: string;
  activity_type: string;
  title: string;
  description: string | undefined;
  metadata: Record<string, unknown>;
  performed_by: string | undefined;
  created_at: string;
}

const mapActivityToShared = (activity: AppCustomerActivity): SharedCustomerActivity => ({
  id: activity.id,
  customer_id: activity.customer_id,
  activity_type: activity.activity_type,
  title: activity.title,
  description: activity.description ?? undefined,
  metadata: activity.metadata ?? undefined,
  created_at: activity.created_at,
});

const useCustomerActivitiesAdapter = (customerId: string): SharedCustomerActivitiesHook => {
  const activitiesQuery = useCustomerActivities(customerId);

  return {
    activities: (activitiesQuery.data || []).map(mapActivityToShared),
    loading: activitiesQuery.isLoading,
    error: activitiesQuery.error ? String(activitiesQuery.error) : undefined,
    addActivity: async () => {
      // Note: The new hook doesn't expose addActivity mutation
      // This would need to be implemented separately if needed
      throw new Error("Add activity not yet implemented in TanStack Query version");
    },
  };
};

export function CustomerActivities(props: CustomerActivitiesProps) {
  return (
    <SharedCustomerActivities
      {...props}
      useCustomerActivities={useCustomerActivitiesAdapter}
      logger={logger}
    />
  );
}
