/**
 * CPE (Customer Premises Equipment) Management Module
 *
 * Provides shared components and types for GenieACS TR-069/CWMP device management
 * across platform-admin-app and isp-ops-app.
 */

export { CPEConfigTemplates } from "./components/CPEConfigTemplates";
export { DeviceManagement } from "./components/DeviceManagement";

export type {
  DeviceInfo,
  DeviceResponse,
  DeviceListResponse,
  DeviceStatsResponse,
  TaskResponse,
  WiFiConfig,
  LANConfig,
  WANConfig,
  MassConfigFilter,
  MassConfigRequest,
  MassConfigResult,
  MassConfigJob,
  MassConfigResponse,
  ConfigTemplate,
} from "./types";
