/**
 * SubscriberDetailModal Component
 *
 * Wrapper that connects the shared SubscriberDetailModal to app-specific hooks and types.
 */

"use client";

import { SubscriberDetailModal as SharedSubscriberDetailModal } from "@dotmac/features/subscribers";
import type { Subscriber } from "@/hooks/useSubscribers";
import { useSubscriberServices } from "@/hooks/useSubscribers";

interface SubscriberDetailModalProps {
  subscriber: Subscriber | null;
  open: boolean;
  onClose: () => void;
  onUpdate?: () => void;
  onSuspend?: (subscriber: Subscriber) => void;
  onActivate?: (subscriber: Subscriber) => void;
  onTerminate?: (subscriber: Subscriber) => void;
}

export function SubscriberDetailModal(props: SubscriberDetailModalProps) {
  const { subscriber } = props;

  // Use app-specific hook to fetch services
  const {
    data: services = [],
    isLoading: servicesLoading,
    refetch: refetchServices,
  } = useSubscriberServices(subscriber?.id || null);

  return (
    <SharedSubscriberDetailModal
      {...props}
      services={services}
      servicesLoading={servicesLoading}
      onRefreshServices={refetchServices}
    />
  );
}
