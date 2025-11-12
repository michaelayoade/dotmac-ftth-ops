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
import {
  useCustomerActivities,
  type CustomerActivity as AppCustomerActivity,
} from "@/hooks/useCustomers";
import { logger } from "@/lib/logger";

interface CustomerActivitiesProps {
  customerId: string;
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
  const hook = useCustomerActivities(customerId);

  return {
    activities: hook.activities.map(mapActivityToShared),
    loading: hook.loading,
    error: hook.error ?? undefined,
    addActivity: async (activity) => {
      const activityData: Omit<AppCustomerActivity, "id" | "customer_id" | "created_at"> = {
        activity_type: activity.activity_type,
        title: activity.title,
        description: activity.description,
        metadata: activity.metadata !== undefined ? activity.metadata : {},
        performed_by: undefined,
      };
      await hook.addActivity(activityData);
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
