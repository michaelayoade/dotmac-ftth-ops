"use client";

import { DeviceManagement as SharedDeviceManagement } from "@dotmac/features/cpe";
import { apiClient } from "@/lib/api/client";

/**
 * ISP Ops App wrapper for DeviceManagement
 *
 * Uses /genieacs/* endpoints
 */
export function DeviceManagement() {
  return (
    <SharedDeviceManagement
      apiClient={apiClient}
      devicesEndpoint="/genieacs/devices"
      statsEndpoint="/genieacs/devices/stats/summary"
      tasksEndpoint="/genieacs/tasks"
    />
  );
}
