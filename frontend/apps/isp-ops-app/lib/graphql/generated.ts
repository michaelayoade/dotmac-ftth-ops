import { gql } from "@apollo/client";
import * as Apollo from "@apollo/client";
export type Maybe<T> = T | null | undefined;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = {
  [K in keyof T]: T[K];
};
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & {
  [SubKey in K]?: Maybe<T[SubKey]>;
};
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & {
  [SubKey in K]: Maybe<T[SubKey]>;
};
export type MakeEmpty<T extends { [key: string]: unknown }, K extends keyof T> = {
  [_ in K]?: never;
};
export type Incremental<T> =
  | T
  | {
      [P in keyof T]?: P extends " $fragmentName" | "__typename" ? T[P] : never;
    };
const defaultOptions = {} as const;
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string };
  String: { input: string; output: string };
  Boolean: { input: boolean; output: boolean };
  Int: { input: number; output: number };
  Float: { input: number; output: number };
  DateTime: { input: string; output: string };
  Decimal: { input: number; output: number };
  JSON: { input: any; output: any };
};

export type ApiKeyMetrics = {
  __typename?: "APIKeyMetrics";
  /** Active keys */
  activeKeys: Scalars["Int"]["output"];
  /** Average requests per key */
  avgRequestsPerKey: Scalars["Float"]["output"];
  /** Expired keys */
  expiredKeys: Scalars["Int"]["output"];
  /** Inactive keys */
  inactiveKeys: Scalars["Int"]["output"];
  /** Keys created in last 30 days */
  keysCreatedLast30d: Scalars["Int"]["output"];
  /** Keys expiring within 30 days */
  keysExpiringSoon: Scalars["Int"]["output"];
  /** Keys used in last 7 days */
  keysUsedLast7d: Scalars["Int"]["output"];
  /** Keys without expiration date */
  keysWithoutExpiry: Scalars["Int"]["output"];
  /** Keys never used */
  neverUsedKeys: Scalars["Int"]["output"];
  /** Metrics period */
  period: Scalars["String"]["output"];
  /** Metrics generation timestamp */
  timestamp: Scalars["DateTime"]["output"];
  /** Top scopes by usage */
  topScopes: Array<ApiKeyScopeUsage>;
  /** Total API requests made with keys */
  totalApiRequests: Scalars["Int"]["output"];
  /** Total number of API keys */
  totalKeys: Scalars["Int"]["output"];
};

export type ApiKeyScopeUsage = {
  __typename?: "APIKeyScopeUsage";
  /** Usage count for the scope */
  count: Scalars["Int"]["output"];
  /** Scope name */
  scope: Scalars["String"]["output"];
};

export type ApPerformanceMetrics = {
  __typename?: "APPerformanceMetrics";
  authenticatedClients: Scalars["Int"]["output"];
  authorizedClients: Scalars["Int"]["output"];
  connectedClients: Scalars["Int"]["output"];
  cpuUsagePercent?: Maybe<Scalars["Float"]["output"]>;
  memoryUsagePercent?: Maybe<Scalars["Float"]["output"]>;
  retries: Scalars["Int"]["output"];
  retryRatePercent?: Maybe<Scalars["Float"]["output"]>;
  rxBytes: Scalars["Int"]["output"];
  rxDropped: Scalars["Int"]["output"];
  rxErrors: Scalars["Int"]["output"];
  rxPackets: Scalars["Int"]["output"];
  rxRateMbps?: Maybe<Scalars["Float"]["output"]>;
  txBytes: Scalars["Int"]["output"];
  txDropped: Scalars["Int"]["output"];
  txErrors: Scalars["Int"]["output"];
  txPackets: Scalars["Int"]["output"];
  txRateMbps?: Maybe<Scalars["Float"]["output"]>;
  uptimeSeconds?: Maybe<Scalars["Int"]["output"]>;
};

export type AccessPoint = {
  __typename?: "AccessPoint";
  channel: Scalars["Int"]["output"];
  channelWidth: Scalars["Int"]["output"];
  controllerId?: Maybe<Scalars["String"]["output"]>;
  controllerName?: Maybe<Scalars["String"]["output"]>;
  createdAt: Scalars["DateTime"]["output"];
  firmwareVersion?: Maybe<Scalars["String"]["output"]>;
  frequencyBand: FrequencyBand;
  hardwareRevision?: Maybe<Scalars["String"]["output"]>;
  id: Scalars["ID"]["output"];
  ipAddress?: Maybe<Scalars["String"]["output"]>;
  isBandSteeringEnabled: Scalars["Boolean"]["output"];
  isLoadBalancingEnabled: Scalars["Boolean"]["output"];
  isMeshEnabled: Scalars["Boolean"]["output"];
  isOnline: Scalars["Boolean"]["output"];
  lastRebootAt?: Maybe<Scalars["DateTime"]["output"]>;
  lastSeenAt?: Maybe<Scalars["DateTime"]["output"]>;
  location?: Maybe<InstallationLocation>;
  macAddress: Scalars["String"]["output"];
  manufacturer?: Maybe<Scalars["String"]["output"]>;
  maxClients?: Maybe<Scalars["Int"]["output"]>;
  model?: Maybe<Scalars["String"]["output"]>;
  name: Scalars["String"]["output"];
  performance?: Maybe<ApPerformanceMetrics>;
  rfMetrics?: Maybe<RfMetrics>;
  securityType: WirelessSecurityType;
  serialNumber?: Maybe<Scalars["String"]["output"]>;
  siteId?: Maybe<Scalars["String"]["output"]>;
  siteName?: Maybe<Scalars["String"]["output"]>;
  ssid: Scalars["String"]["output"];
  status: AccessPointStatus;
  transmitPower: Scalars["Int"]["output"];
  updatedAt: Scalars["DateTime"]["output"];
};

export type AccessPointConnection = {
  __typename?: "AccessPointConnection";
  accessPoints: Array<AccessPoint>;
  hasNextPage: Scalars["Boolean"]["output"];
  totalCount: Scalars["Int"]["output"];
};

export enum AccessPointStatus {
  Degraded = "DEGRADED",
  Maintenance = "MAINTENANCE",
  Offline = "OFFLINE",
  Online = "ONLINE",
  Provisioning = "PROVISIONING",
  Rebooting = "REBOOTING",
}

export enum ActivityTypeEnum {
  ContactMade = "CONTACT_MADE",
  Created = "CREATED",
  Export = "EXPORT",
  Import = "IMPORT",
  Login = "LOGIN",
  NoteAdded = "NOTE_ADDED",
  Purchase = "PURCHASE",
  StatusChanged = "STATUS_CHANGED",
  SupportTicket = "SUPPORT_TICKET",
  TagAdded = "TAG_ADDED",
  TagRemoved = "TAG_REMOVED",
  Updated = "UPDATED",
}

export type Address = {
  __typename?: "Address";
  city: Scalars["String"]["output"];
  country: Scalars["String"]["output"];
  postalCode: Scalars["String"]["output"];
  stateProvince: Scalars["String"]["output"];
  streetAddress: Scalars["String"]["output"];
};

export type AlertConnection = {
  __typename?: "AlertConnection";
  alerts: Array<NetworkAlert>;
  hasNextPage: Scalars["Boolean"]["output"];
  hasPrevPage: Scalars["Boolean"]["output"];
  page: Scalars["Int"]["output"];
  pageSize: Scalars["Int"]["output"];
  totalCount: Scalars["Int"]["output"];
};

export enum AlertSeverityEnum {
  Critical = "CRITICAL",
  Info = "INFO",
  Warning = "WARNING",
}

export type AnalyticsMetrics = {
  __typename?: "AnalyticsMetrics";
  /** Conversion events */
  conversionEvents: Scalars["Int"]["output"];
  /** Page view events */
  pageViews: Scalars["Int"]["output"];
  /** Metrics calculation period */
  period: Scalars["String"]["output"];
  /** System events */
  systemEvents: Scalars["Int"]["output"];
  /** Metrics generation timestamp */
  timestamp: Scalars["DateTime"]["output"];
  /** Most frequent event names */
  topEvents: Array<Scalars["String"]["output"]>;
  /** Total events tracked */
  totalEvents: Scalars["Int"]["output"];
  /** Unique sessions */
  uniqueSessions: Scalars["Int"]["output"];
  /** Unique users */
  uniqueUsers: Scalars["Int"]["output"];
  /** User action events */
  userActions: Scalars["Int"]["output"];
};

export type AuthMetrics = {
  __typename?: "AuthMetrics";
  /** Active users this period */
  activeUsers: Scalars["Int"]["output"];
  /** Failed login attempts */
  failedLogins: Scalars["Int"]["output"];
  /** Login success rate (%) */
  loginSuccessRate: Scalars["Float"]["output"];
  /** MFA adoption rate (%) */
  mfaAdoptionRate: Scalars["Float"]["output"];
  /** Users with MFA enabled */
  mfaEnabledUsers: Scalars["Int"]["output"];
  /** New user registrations */
  newUsers: Scalars["Int"]["output"];
  /** Password reset requests */
  passwordResets: Scalars["Int"]["output"];
  /** Metrics calculation period */
  period: Scalars["String"]["output"];
  /** Successful logins */
  successfulLogins: Scalars["Int"]["output"];
  /** Suspicious activity count */
  suspiciousActivities: Scalars["Int"]["output"];
  /** Metrics generation timestamp */
  timestamp: Scalars["DateTime"]["output"];
  /** Total login attempts */
  totalLogins: Scalars["Int"]["output"];
};

export enum BillingCycleEnum {
  Annual = "ANNUAL",
  Custom = "CUSTOM",
  Monthly = "MONTHLY",
  Quarterly = "QUARTERLY",
  Yearly = "YEARLY",
}

export type BillingMetrics = {
  __typename?: "BillingMetrics";
  /** Number of active subscriptions */
  activeSubscriptions: Scalars["Int"]["output"];
  /** Annual Recurring Revenue */
  arr: Scalars["Float"]["output"];
  /** Failed payments */
  failedPayments: Scalars["Int"]["output"];
  /** Monthly Recurring Revenue */
  mrr: Scalars["Float"]["output"];
  /** Overdue invoices */
  overdueInvoices: Scalars["Int"]["output"];
  /** Paid invoices this period */
  paidInvoices: Scalars["Int"]["output"];
  /** Metrics calculation period */
  period: Scalars["String"]["output"];
  /** Successful payments */
  successfulPayments: Scalars["Int"]["output"];
  /** Metrics generation timestamp */
  timestamp: Scalars["DateTime"]["output"];
  /** Total invoices this period */
  totalInvoices: Scalars["Int"]["output"];
  /** Total payment amount in major units */
  totalPaymentAmount: Scalars["Float"]["output"];
  /** Total payments this period */
  totalPayments: Scalars["Int"]["output"];
};

export type CpeMetrics = {
  __typename?: "CPEMetrics";
  connectedClients?: Maybe<Scalars["Int"]["output"]>;
  lastInform?: Maybe<Scalars["DateTime"]["output"]>;
  macAddress: Scalars["String"]["output"];
  wanIp?: Maybe<Scalars["String"]["output"]>;
  wifi2ghzClients?: Maybe<Scalars["Int"]["output"]>;
  wifi5ghzClients?: Maybe<Scalars["Int"]["output"]>;
  wifiEnabled?: Maybe<Scalars["Boolean"]["output"]>;
};

export enum CableInstallationType {
  Aerial = "AERIAL",
  Building = "BUILDING",
  Buried = "BURIED",
  Duct = "DUCT",
  Submarine = "SUBMARINE",
  Underground = "UNDERGROUND",
}

export type CableRoute = {
  __typename?: "CableRoute";
  aerialDistanceMeters?: Maybe<Scalars["Float"]["output"]>;
  elevationChangeMeters?: Maybe<Scalars["Float"]["output"]>;
  endPoint: GeoCoordinate;
  intermediatePoints: Array<GeoCoordinate>;
  pathGeojson: Scalars["String"]["output"];
  startPoint: GeoCoordinate;
  totalDistanceMeters: Scalars["Float"]["output"];
  undergroundDistanceMeters?: Maybe<Scalars["Float"]["output"]>;
};

export type ChannelUtilization = {
  __typename?: "ChannelUtilization";
  accessPointsCount: Scalars["Int"]["output"];
  band: FrequencyBand;
  channel: Scalars["Int"]["output"];
  frequencyMhz: Scalars["Int"]["output"];
  interferenceLevel: Scalars["Float"]["output"];
  utilizationPercent: Scalars["Float"]["output"];
};

export enum ClientConnectionType {
  Wifi_2_4 = "WIFI_2_4",
  Wifi_5 = "WIFI_5",
  Wifi_6 = "WIFI_6",
  Wifi_6E = "WIFI_6E",
}

export type CommunicationsMetrics = {
  __typename?: "CommunicationsMetrics";
  /** Bounced messages */
  bounced: Scalars["Int"]["output"];
  /** Click rate (%) */
  clickRate: Scalars["Float"]["output"];
  /** Links clicked */
  clicked: Scalars["Int"]["output"];
  /** Successfully delivered */
  delivered: Scalars["Int"]["output"];
  /** Delivery rate (%) */
  deliveryRate: Scalars["Float"]["output"];
  /** Emails sent */
  emailSent: Scalars["Int"]["output"];
  /** Failed deliveries */
  failed: Scalars["Int"]["output"];
  /** Open rate (%) */
  openRate: Scalars["Float"]["output"];
  /** Messages opened */
  opened: Scalars["Int"]["output"];
  /** Metrics calculation period */
  period: Scalars["String"]["output"];
  /** SMS sent */
  smsSent: Scalars["Int"]["output"];
  /** Metrics generation timestamp */
  timestamp: Scalars["DateTime"]["output"];
  /** Total messages sent */
  totalSent: Scalars["Int"]["output"];
};

export type CoverageZone = {
  __typename?: "CoverageZone";
  accessPointCount: Scalars["Int"]["output"];
  accessPointIds: Array<Scalars["String"]["output"]>;
  areaType: Scalars["String"]["output"];
  channelUtilizationAvg?: Maybe<Scalars["Float"]["output"]>;
  clientDensityPerAp?: Maybe<Scalars["Float"]["output"]>;
  connectedClients: Scalars["Int"]["output"];
  coverageAreaSqm?: Maybe<Scalars["Float"]["output"]>;
  coveragePolygon?: Maybe<Scalars["String"]["output"]>;
  createdAt: Scalars["DateTime"]["output"];
  description?: Maybe<Scalars["String"]["output"]>;
  floor?: Maybe<Scalars["String"]["output"]>;
  id: Scalars["ID"]["output"];
  interferenceLevel?: Maybe<Scalars["Float"]["output"]>;
  lastSurveyedAt?: Maybe<Scalars["DateTime"]["output"]>;
  maxClientCapacity: Scalars["Int"]["output"];
  name: Scalars["String"]["output"];
  noiseFloorAvgDbm?: Maybe<Scalars["Float"]["output"]>;
  signalStrengthAvgDbm?: Maybe<Scalars["Float"]["output"]>;
  signalStrengthMaxDbm?: Maybe<Scalars["Float"]["output"]>;
  signalStrengthMinDbm?: Maybe<Scalars["Float"]["output"]>;
  siteId: Scalars["String"]["output"];
  siteName: Scalars["String"]["output"];
  updatedAt: Scalars["DateTime"]["output"];
};

export type CoverageZoneConnection = {
  __typename?: "CoverageZoneConnection";
  hasNextPage: Scalars["Boolean"]["output"];
  totalCount: Scalars["Int"]["output"];
  zones: Array<CoverageZone>;
};

export type Customer = {
  __typename?: "Customer";
  acquisitionDate: Scalars["DateTime"]["output"];
  activities: Array<CustomerActivity>;
  addressLine1?: Maybe<Scalars["String"]["output"]>;
  addressLine2?: Maybe<Scalars["String"]["output"]>;
  averageOrderValue: Scalars["Decimal"]["output"];
  city?: Maybe<Scalars["String"]["output"]>;
  companyName?: Maybe<Scalars["String"]["output"]>;
  country?: Maybe<Scalars["String"]["output"]>;
  createdAt: Scalars["DateTime"]["output"];
  customerNumber: Scalars["String"]["output"];
  customerType: CustomerTypeEnum;
  displayName?: Maybe<Scalars["String"]["output"]>;
  email: Scalars["String"]["output"];
  emailVerified: Scalars["Boolean"]["output"];
  employeeCount?: Maybe<Scalars["Int"]["output"]>;
  firstName: Scalars["String"]["output"];
  id: Scalars["ID"]["output"];
  industry?: Maybe<Scalars["String"]["output"]>;
  lastContactDate?: Maybe<Scalars["DateTime"]["output"]>;
  lastName: Scalars["String"]["output"];
  lastPurchaseDate?: Maybe<Scalars["DateTime"]["output"]>;
  lifetimeValue: Scalars["Decimal"]["output"];
  middleName?: Maybe<Scalars["String"]["output"]>;
  mobile?: Maybe<Scalars["String"]["output"]>;
  notes: Array<CustomerNote>;
  phone?: Maybe<Scalars["String"]["output"]>;
  phoneVerified: Scalars["Boolean"]["output"];
  postalCode?: Maybe<Scalars["String"]["output"]>;
  stateProvince?: Maybe<Scalars["String"]["output"]>;
  status: CustomerStatusEnum;
  taxId?: Maybe<Scalars["String"]["output"]>;
  tier: CustomerTierEnum;
  totalPurchases: Scalars["Int"]["output"];
  updatedAt: Scalars["DateTime"]["output"];
};

export type CustomerActivity = {
  __typename?: "CustomerActivity";
  activityType: ActivityTypeEnum;
  createdAt: Scalars["DateTime"]["output"];
  customerId: Scalars["ID"]["output"];
  description?: Maybe<Scalars["String"]["output"]>;
  id: Scalars["ID"]["output"];
  performedBy?: Maybe<Scalars["ID"]["output"]>;
  title: Scalars["String"]["output"];
};

export type CustomerActivityUpdate = {
  __typename?: "CustomerActivityUpdate";
  activityType: Scalars["String"]["output"];
  createdAt: Scalars["DateTime"]["output"];
  customerId: Scalars["String"]["output"];
  description?: Maybe<Scalars["String"]["output"]>;
  id: Scalars["String"]["output"];
  performedBy?: Maybe<Scalars["String"]["output"]>;
  performedByName?: Maybe<Scalars["String"]["output"]>;
  title: Scalars["String"]["output"];
};

export type CustomerConnection = {
  __typename?: "CustomerConnection";
  customers: Array<Customer>;
  hasNextPage: Scalars["Boolean"]["output"];
  totalCount: Scalars["Int"]["output"];
};

export type CustomerDeviceUpdate = {
  __typename?: "CustomerDeviceUpdate";
  changeType: Scalars["String"]["output"];
  cpuUsage?: Maybe<Scalars["Int"]["output"]>;
  customerId: Scalars["String"]["output"];
  deviceId: Scalars["String"]["output"];
  deviceName: Scalars["String"]["output"];
  deviceType: Scalars["String"]["output"];
  firmwareVersion?: Maybe<Scalars["String"]["output"]>;
  healthStatus: Scalars["String"]["output"];
  isOnline: Scalars["Boolean"]["output"];
  lastSeenAt?: Maybe<Scalars["DateTime"]["output"]>;
  memoryUsage?: Maybe<Scalars["Int"]["output"]>;
  needsFirmwareUpdate: Scalars["Boolean"]["output"];
  newValue?: Maybe<Scalars["String"]["output"]>;
  previousValue?: Maybe<Scalars["String"]["output"]>;
  signalStrength?: Maybe<Scalars["Int"]["output"]>;
  status: Scalars["String"]["output"];
  temperature?: Maybe<Scalars["Int"]["output"]>;
  updatedAt: Scalars["DateTime"]["output"];
  uptimeSeconds?: Maybe<Scalars["Int"]["output"]>;
};

export type CustomerMetrics = {
  __typename?: "CustomerMetrics";
  /** Active customers */
  activeCustomers: Scalars["Int"]["output"];
  /** Average customer LTV */
  averageCustomerValue: Scalars["Float"]["output"];
  /** Churn rate (%) */
  churnRate: Scalars["Float"]["output"];
  /** Churned customers this period */
  churnedCustomers: Scalars["Int"]["output"];
  /** Customer growth rate (%) */
  customerGrowthRate: Scalars["Float"]["output"];
  /** New customers this period */
  newCustomers: Scalars["Int"]["output"];
  /** Metrics calculation period */
  period: Scalars["String"]["output"];
  /** Retention rate (%) */
  retentionRate: Scalars["Float"]["output"];
  /** Metrics generation timestamp */
  timestamp: Scalars["DateTime"]["output"];
  /** Total customer value */
  totalCustomerValue: Scalars["Float"]["output"];
  /** Total number of customers */
  totalCustomers: Scalars["Int"]["output"];
};

export type CustomerNetworkStatusUpdate = {
  __typename?: "CustomerNetworkStatusUpdate";
  bandwidthUsageMbps?: Maybe<Scalars["Decimal"]["output"]>;
  connectionStatus: Scalars["String"]["output"];
  customerId: Scalars["String"]["output"];
  downloadSpeedMbps?: Maybe<Scalars["Decimal"]["output"]>;
  ipv4Address?: Maybe<Scalars["String"]["output"]>;
  ipv6Address?: Maybe<Scalars["String"]["output"]>;
  jitter?: Maybe<Scalars["Decimal"]["output"]>;
  lastSeenAt: Scalars["DateTime"]["output"];
  latencyMs?: Maybe<Scalars["Int"]["output"]>;
  macAddress?: Maybe<Scalars["String"]["output"]>;
  oltRxPower?: Maybe<Scalars["Decimal"]["output"]>;
  ontRxPower?: Maybe<Scalars["Decimal"]["output"]>;
  ontTxPower?: Maybe<Scalars["Decimal"]["output"]>;
  packetLoss?: Maybe<Scalars["Decimal"]["output"]>;
  serviceStatus?: Maybe<Scalars["String"]["output"]>;
  signalQuality?: Maybe<Scalars["Int"]["output"]>;
  signalStrength?: Maybe<Scalars["Int"]["output"]>;
  updatedAt: Scalars["DateTime"]["output"];
  uploadSpeedMbps?: Maybe<Scalars["Decimal"]["output"]>;
  uptimePercentage?: Maybe<Scalars["Decimal"]["output"]>;
  uptimeSeconds?: Maybe<Scalars["Int"]["output"]>;
  vlanId?: Maybe<Scalars["Int"]["output"]>;
};

export type CustomerNote = {
  __typename?: "CustomerNote";
  content: Scalars["String"]["output"];
  createdAt: Scalars["DateTime"]["output"];
  createdById?: Maybe<Scalars["ID"]["output"]>;
  customerId: Scalars["ID"]["output"];
  id: Scalars["ID"]["output"];
  isInternal: Scalars["Boolean"]["output"];
  subject: Scalars["String"]["output"];
  updatedAt: Scalars["DateTime"]["output"];
};

export type CustomerNoteData = {
  __typename?: "CustomerNoteData";
  content: Scalars["String"]["output"];
  createdAt: Scalars["DateTime"]["output"];
  createdById: Scalars["String"]["output"];
  createdByName?: Maybe<Scalars["String"]["output"]>;
  customerId: Scalars["String"]["output"];
  id: Scalars["String"]["output"];
  isInternal: Scalars["Boolean"]["output"];
  subject: Scalars["String"]["output"];
  updatedAt: Scalars["DateTime"]["output"];
};

export type CustomerNoteUpdate = {
  __typename?: "CustomerNoteUpdate";
  action: Scalars["String"]["output"];
  changedBy: Scalars["String"]["output"];
  changedByName?: Maybe<Scalars["String"]["output"]>;
  customerId: Scalars["String"]["output"];
  note?: Maybe<CustomerNoteData>;
  updatedAt: Scalars["DateTime"]["output"];
};

export enum CustomerStatusEnum {
  Active = "ACTIVE",
  Archived = "ARCHIVED",
  Churned = "CHURNED",
  Inactive = "INACTIVE",
  Prospect = "PROSPECT",
  Suspended = "SUSPENDED",
}

export type CustomerTicketUpdate = {
  __typename?: "CustomerTicketUpdate";
  action: Scalars["String"]["output"];
  changedBy?: Maybe<Scalars["String"]["output"]>;
  changedByName?: Maybe<Scalars["String"]["output"]>;
  changes?: Maybe<Array<Scalars["String"]["output"]>>;
  comment?: Maybe<Scalars["String"]["output"]>;
  customerId: Scalars["String"]["output"];
  ticket: CustomerTicketUpdateData;
  updatedAt: Scalars["DateTime"]["output"];
};

export type CustomerTicketUpdateData = {
  __typename?: "CustomerTicketUpdateData";
  assignedTeam?: Maybe<Scalars["String"]["output"]>;
  assignedTo?: Maybe<Scalars["String"]["output"]>;
  assignedToName?: Maybe<Scalars["String"]["output"]>;
  category?: Maybe<Scalars["String"]["output"]>;
  closedAt?: Maybe<Scalars["DateTime"]["output"]>;
  createdAt: Scalars["DateTime"]["output"];
  customerId: Scalars["String"]["output"];
  customerName?: Maybe<Scalars["String"]["output"]>;
  description?: Maybe<Scalars["String"]["output"]>;
  id: Scalars["String"]["output"];
  priority: Scalars["String"]["output"];
  resolvedAt?: Maybe<Scalars["DateTime"]["output"]>;
  status: Scalars["String"]["output"];
  subCategory?: Maybe<Scalars["String"]["output"]>;
  ticketNumber: Scalars["String"]["output"];
  title: Scalars["String"]["output"];
  updatedAt: Scalars["DateTime"]["output"];
};

export enum CustomerTierEnum {
  Basic = "BASIC",
  Enterprise = "ENTERPRISE",
  Free = "FREE",
  Premium = "PREMIUM",
  Standard = "STANDARD",
}

export enum CustomerTypeEnum {
  Business = "BUSINESS",
  Enterprise = "ENTERPRISE",
  Individual = "INDIVIDUAL",
  Partner = "PARTNER",
  Vendor = "VENDOR",
}

export type DashboardOverview = {
  __typename?: "DashboardOverview";
  /** Analytics metrics */
  analytics?: Maybe<AnalyticsMetrics>;
  /** Authentication metrics */
  auth?: Maybe<AuthMetrics>;
  /** Billing metrics */
  billing: BillingMetrics;
  /** Communications metrics */
  communications?: Maybe<CommunicationsMetrics>;
  /** Customer metrics */
  customers: CustomerMetrics;
  /** File storage metrics */
  fileStorage?: Maybe<FileStorageMetrics>;
  /** System monitoring metrics */
  monitoring: MonitoringMetrics;
};

export type DeviceConnection = {
  __typename?: "DeviceConnection";
  devices: Array<DeviceHealth>;
  hasNextPage: Scalars["Boolean"]["output"];
  hasPrevPage: Scalars["Boolean"]["output"];
  page: Scalars["Int"]["output"];
  pageSize: Scalars["Int"]["output"];
  totalCount: Scalars["Int"]["output"];
};

export type DeviceHealth = {
  __typename?: "DeviceHealth";
  cpuUsagePercent?: Maybe<Scalars["Float"]["output"]>;
  deviceId: Scalars["String"]["output"];
  deviceName: Scalars["String"]["output"];
  deviceType: DeviceTypeEnum;
  firmwareVersion?: Maybe<Scalars["String"]["output"]>;
  ipAddress?: Maybe<Scalars["String"]["output"]>;
  isHealthy: Scalars["Boolean"]["output"];
  lastSeen?: Maybe<Scalars["DateTime"]["output"]>;
  location?: Maybe<Scalars["String"]["output"]>;
  memoryUsagePercent?: Maybe<Scalars["Float"]["output"]>;
  model?: Maybe<Scalars["String"]["output"]>;
  packetLossPercent?: Maybe<Scalars["Float"]["output"]>;
  pingLatencyMs?: Maybe<Scalars["Float"]["output"]>;
  powerStatus?: Maybe<Scalars["String"]["output"]>;
  status: DeviceStatusEnum;
  temperatureCelsius?: Maybe<Scalars["Float"]["output"]>;
  tenantId: Scalars["String"]["output"];
  uptimeDays?: Maybe<Scalars["Int"]["output"]>;
  uptimeSeconds?: Maybe<Scalars["Int"]["output"]>;
};

export type DeviceMetrics = {
  __typename?: "DeviceMetrics";
  cpeMetrics?: Maybe<CpeMetrics>;
  deviceId: Scalars["String"]["output"];
  deviceName: Scalars["String"]["output"];
  deviceType: DeviceTypeEnum;
  health: DeviceHealth;
  onuMetrics?: Maybe<OnuMetrics>;
  timestamp: Scalars["DateTime"]["output"];
  traffic?: Maybe<TrafficStats>;
};

export enum DeviceStatusEnum {
  Degraded = "DEGRADED",
  Offline = "OFFLINE",
  Online = "ONLINE",
  Unknown = "UNKNOWN",
}

export enum DeviceTypeEnum {
  Cpe = "CPE",
  Firewall = "FIREWALL",
  Olt = "OLT",
  Onu = "ONU",
  Other = "OTHER",
  Router = "ROUTER",
  Switch = "SWITCH",
}

export type DeviceTypeSummary = {
  __typename?: "DeviceTypeSummary";
  avgCpuUsage?: Maybe<Scalars["Float"]["output"]>;
  avgMemoryUsage?: Maybe<Scalars["Float"]["output"]>;
  degradedCount: Scalars["Int"]["output"];
  deviceType: DeviceTypeEnum;
  offlineCount: Scalars["Int"]["output"];
  onlineCount: Scalars["Int"]["output"];
  totalCount: Scalars["Int"]["output"];
};

export type DeviceUpdate = {
  __typename?: "DeviceUpdate";
  changeType: Scalars["String"]["output"];
  cpuUsagePercent?: Maybe<Scalars["Float"]["output"]>;
  deviceId: Scalars["String"]["output"];
  deviceName: Scalars["String"]["output"];
  deviceType: DeviceTypeEnum;
  firmwareVersion?: Maybe<Scalars["String"]["output"]>;
  ipAddress?: Maybe<Scalars["String"]["output"]>;
  isHealthy: Scalars["Boolean"]["output"];
  lastSeen?: Maybe<Scalars["DateTime"]["output"]>;
  location?: Maybe<Scalars["String"]["output"]>;
  memoryUsagePercent?: Maybe<Scalars["Float"]["output"]>;
  model?: Maybe<Scalars["String"]["output"]>;
  newValue?: Maybe<Scalars["String"]["output"]>;
  packetLossPercent?: Maybe<Scalars["Float"]["output"]>;
  pingLatencyMs?: Maybe<Scalars["Float"]["output"]>;
  powerStatus?: Maybe<Scalars["String"]["output"]>;
  previousValue?: Maybe<Scalars["String"]["output"]>;
  status: DeviceStatusEnum;
  temperatureCelsius?: Maybe<Scalars["Float"]["output"]>;
  tenantId: Scalars["String"]["output"];
  updatedAt: Scalars["DateTime"]["output"];
  uptimeDays?: Maybe<Scalars["Int"]["output"]>;
  uptimeSeconds?: Maybe<Scalars["Int"]["output"]>;
};

export type DistributionPoint = {
  __typename?: "DistributionPoint";
  accessNotes?: Maybe<Scalars["String"]["output"]>;
  accessType: Scalars["String"]["output"];
  address?: Maybe<Address>;
  availableCapacity: Scalars["Int"]["output"];
  availableStrandCount: Scalars["Int"]["output"];
  batteryBackup: Scalars["Boolean"]["output"];
  capacityUtilizationPercent: Scalars["Float"]["output"];
  createdAt: Scalars["DateTime"]["output"];
  description?: Maybe<Scalars["String"]["output"]>;
  environmentalMonitoring: Scalars["Boolean"]["output"];
  fiberStrandCount: Scalars["Int"]["output"];
  hasPower: Scalars["Boolean"]["output"];
  humidityPercent?: Maybe<Scalars["Float"]["output"]>;
  id: Scalars["ID"]["output"];
  incomingCables: Array<Scalars["String"]["output"]>;
  installedAt?: Maybe<Scalars["DateTime"]["output"]>;
  isActive: Scalars["Boolean"]["output"];
  lastInspectedAt?: Maybe<Scalars["DateTime"]["output"]>;
  lastMaintainedAt?: Maybe<Scalars["DateTime"]["output"]>;
  location: GeoCoordinate;
  manufacturer?: Maybe<Scalars["String"]["output"]>;
  model?: Maybe<Scalars["String"]["output"]>;
  name: Scalars["String"]["output"];
  outgoingCables: Array<Scalars["String"]["output"]>;
  pointType: DistributionPointType;
  portCount: Scalars["Int"]["output"];
  ports: Array<PortAllocation>;
  requiresKey: Scalars["Boolean"]["output"];
  securityLevel?: Maybe<Scalars["String"]["output"]>;
  servesCustomerCount: Scalars["Int"]["output"];
  serviceAreaIds: Array<Scalars["String"]["output"]>;
  siteId: Scalars["String"]["output"];
  siteName?: Maybe<Scalars["String"]["output"]>;
  splicePointCount: Scalars["Int"]["output"];
  splicePoints: Array<Scalars["String"]["output"]>;
  status: FiberCableStatus;
  temperatureCelsius?: Maybe<Scalars["Float"]["output"]>;
  totalCablesConnected: Scalars["Int"]["output"];
  totalCapacity: Scalars["Int"]["output"];
  updatedAt: Scalars["DateTime"]["output"];
  usedCapacity: Scalars["Int"]["output"];
};

export type DistributionPointConnection = {
  __typename?: "DistributionPointConnection";
  distributionPoints: Array<DistributionPoint>;
  hasNextPage: Scalars["Boolean"]["output"];
  totalCount: Scalars["Int"]["output"];
};

export enum DistributionPointType {
  BuildingEntry = "BUILDING_ENTRY",
  Cabinet = "CABINET",
  Closure = "CLOSURE",
  Handhole = "HANDHOLE",
  Manhole = "MANHOLE",
  Pedestal = "PEDESTAL",
  Pole = "POLE",
}

export type FiberCable = {
  __typename?: "FiberCable";
  armored: Scalars["Boolean"]["output"];
  availableStrands: Scalars["Int"]["output"];
  averageAttenuationDbPerKm?: Maybe<Scalars["Float"]["output"]>;
  bandwidthCapacityGbps?: Maybe<Scalars["Float"]["output"]>;
  cableId: Scalars["String"]["output"];
  capacityUtilizationPercent: Scalars["Float"]["output"];
  conduitId?: Maybe<Scalars["String"]["output"]>;
  createdAt: Scalars["DateTime"]["output"];
  description?: Maybe<Scalars["String"]["output"]>;
  ductNumber?: Maybe<Scalars["Int"]["output"]>;
  endDistributionPointId: Scalars["String"]["output"];
  endPointName?: Maybe<Scalars["String"]["output"]>;
  fiberType: FiberType;
  fireRated: Scalars["Boolean"]["output"];
  id: Scalars["ID"]["output"];
  installationType: CableInstallationType;
  installedAt?: Maybe<Scalars["DateTime"]["output"]>;
  isActive: Scalars["Boolean"]["output"];
  isLeased: Scalars["Boolean"]["output"];
  lengthMeters: Scalars["Float"]["output"];
  manufacturer?: Maybe<Scalars["String"]["output"]>;
  maxAttenuationDbPerKm?: Maybe<Scalars["Float"]["output"]>;
  model?: Maybe<Scalars["String"]["output"]>;
  name: Scalars["String"]["output"];
  ownerId?: Maybe<Scalars["String"]["output"]>;
  ownerName?: Maybe<Scalars["String"]["output"]>;
  route: CableRoute;
  spliceCount: Scalars["Int"]["output"];
  splicePointIds: Array<Scalars["String"]["output"]>;
  startDistributionPointId: Scalars["String"]["output"];
  startPointName?: Maybe<Scalars["String"]["output"]>;
  status: FiberCableStatus;
  strands: Array<FiberStrand>;
  testedAt?: Maybe<Scalars["DateTime"]["output"]>;
  totalLossDb?: Maybe<Scalars["Float"]["output"]>;
  totalStrands: Scalars["Int"]["output"];
  updatedAt: Scalars["DateTime"]["output"];
  usedStrands: Scalars["Int"]["output"];
};

export type FiberCableConnection = {
  __typename?: "FiberCableConnection";
  cables: Array<FiberCable>;
  hasNextPage: Scalars["Boolean"]["output"];
  totalCount: Scalars["Int"]["output"];
};

export enum FiberCableStatus {
  Active = "ACTIVE",
  Damaged = "DAMAGED",
  Decommissioned = "DECOMMISSIONED",
  Inactive = "INACTIVE",
  Maintenance = "MAINTENANCE",
  UnderConstruction = "UNDER_CONSTRUCTION",
}

export type FiberDashboard = {
  __typename?: "FiberDashboard";
  analytics: FiberNetworkAnalytics;
  cablesRequiringAttention: Array<FiberHealthMetrics>;
  capacityUtilizationTrend: Array<Scalars["Float"]["output"]>;
  distributionPointsNearCapacity: Array<DistributionPoint>;
  generatedAt: Scalars["DateTime"]["output"];
  networkHealthTrend: Array<Scalars["Float"]["output"]>;
  newConnectionsTrend: Array<Scalars["Int"]["output"]>;
  recentTestResults: Array<OtdrTestResult>;
  serviceAreasExpansionCandidates: Array<ServiceArea>;
  topCablesByUtilization: Array<FiberCable>;
  topDistributionPointsByCapacity: Array<DistributionPoint>;
  topServiceAreasByPenetration: Array<ServiceArea>;
};

export type FiberHealthMetrics = {
  __typename?: "FiberHealthMetrics";
  activeAlarms: Scalars["Int"]["output"];
  activeStrands: Scalars["Int"]["output"];
  averageLossPerKmDb: Scalars["Float"]["output"];
  averageSpliceLossDb?: Maybe<Scalars["Float"]["output"]>;
  cableId: Scalars["String"]["output"];
  cableName: Scalars["String"]["output"];
  daysSinceLastTest?: Maybe<Scalars["Int"]["output"]>;
  degradedStrands: Scalars["Int"]["output"];
  failedStrands: Scalars["Int"]["output"];
  failingSplicesCount: Scalars["Int"]["output"];
  healthScore: Scalars["Float"]["output"];
  healthStatus: FiberHealthStatus;
  lastTestedAt?: Maybe<Scalars["DateTime"]["output"]>;
  maxLossPerKmDb: Scalars["Float"]["output"];
  maxSpliceLossDb?: Maybe<Scalars["Float"]["output"]>;
  reflectanceDb?: Maybe<Scalars["Float"]["output"]>;
  requiresMaintenance: Scalars["Boolean"]["output"];
  testPassRatePercent?: Maybe<Scalars["Float"]["output"]>;
  totalLossDb: Scalars["Float"]["output"];
  totalStrands: Scalars["Int"]["output"];
  warningCount: Scalars["Int"]["output"];
};

export enum FiberHealthStatus {
  Critical = "CRITICAL",
  Excellent = "EXCELLENT",
  Fair = "FAIR",
  Good = "GOOD",
  Poor = "POOR",
}

export type FiberNetworkAnalytics = {
  __typename?: "FiberNetworkAnalytics";
  activeServiceAreas: Scalars["Int"]["output"];
  availableCapacity: Scalars["Int"]["output"];
  averageCableLossDbPerKm: Scalars["Float"]["output"];
  averageSpliceLossDb: Scalars["Float"]["output"];
  cablesActive: Scalars["Int"]["output"];
  cablesDueForTesting: Scalars["Int"]["output"];
  cablesInactive: Scalars["Int"]["output"];
  cablesMaintenance: Scalars["Int"]["output"];
  cablesUnderConstruction: Scalars["Int"]["output"];
  cablesWithHighLoss: Array<Scalars["String"]["output"]>;
  capacityUtilizationPercent: Scalars["Float"]["output"];
  cablesByStatus?: Maybe<Scalars["JSON"]["output"]>;
  cablesByType?: Maybe<Scalars["JSON"]["output"]>;
  degradedCables: Scalars["Int"]["output"];
  distributionPointsNearCapacity: Array<Scalars["String"]["output"]>;
  failedCables: Scalars["Int"]["output"];
  generatedAt: Scalars["DateTime"]["output"];
  healthyCables: Scalars["Int"]["output"];
  homesConnected: Scalars["Int"]["output"];
  homesPassed: Scalars["Int"]["output"];
  networkHealthScore: Scalars["Float"]["output"];
  penetrationRatePercent: Scalars["Float"]["output"];
  serviceAreasNeedsExpansion: Array<Scalars["String"]["output"]>;
  totalCables: Scalars["Int"]["output"];
  totalCapacity: Scalars["Int"]["output"];
  totalDistributionPoints: Scalars["Int"]["output"];
  totalFiberKm: Scalars["Float"]["output"];
  totalServiceAreas: Scalars["Int"]["output"];
  totalSplicePoints: Scalars["Int"]["output"];
  totalStrands: Scalars["Int"]["output"];
  usedCapacity: Scalars["Int"]["output"];
};

export type FiberStrand = {
  __typename?: "FiberStrand";
  attenuationDb?: Maybe<Scalars["Float"]["output"]>;
  colorCode?: Maybe<Scalars["String"]["output"]>;
  customerId?: Maybe<Scalars["String"]["output"]>;
  customerName?: Maybe<Scalars["String"]["output"]>;
  isActive: Scalars["Boolean"]["output"];
  isAvailable: Scalars["Boolean"]["output"];
  lossDb?: Maybe<Scalars["Float"]["output"]>;
  serviceId?: Maybe<Scalars["String"]["output"]>;
  spliceCount: Scalars["Int"]["output"];
  strandId: Scalars["Int"]["output"];
};

export enum FiberType {
  Hybrid = "HYBRID",
  MultiMode = "MULTI_MODE",
  SingleMode = "SINGLE_MODE",
}

export type FileStorageMetrics = {
  __typename?: "FileStorageMetrics";
  /** File deletions this period */
  deletesCount: Scalars["Int"]["output"];
  /** File downloads this period */
  downloadsCount: Scalars["Int"]["output"];
  /** Metrics calculation period */
  period: Scalars["String"]["output"];
  /** Metrics generation timestamp */
  timestamp: Scalars["DateTime"]["output"];
  /** Most common file types */
  topFileTypes: Array<Scalars["String"]["output"]>;
  /** Total files stored */
  totalFiles: Scalars["Int"]["output"];
  /** Total storage used (bytes) */
  totalSizeBytes: Scalars["Int"]["output"];
  /** Total storage used (MB) */
  totalSizeMb: Scalars["Float"]["output"];
  /** File uploads this period */
  uploadsCount: Scalars["Int"]["output"];
};

export enum FrequencyBand {
  Band_2_4Ghz = "BAND_2_4_GHZ",
  Band_5Ghz = "BAND_5_GHZ",
  Band_6Ghz = "BAND_6_GHZ",
}

export type GeoCoordinate = {
  __typename?: "GeoCoordinate";
  altitude?: Maybe<Scalars["Float"]["output"]>;
  latitude: Scalars["Float"]["output"];
  longitude: Scalars["Float"]["output"];
};

export type GeoLocation = {
  __typename?: "GeoLocation";
  accuracy?: Maybe<Scalars["Float"]["output"]>;
  altitude?: Maybe<Scalars["Float"]["output"]>;
  latitude: Scalars["Float"]["output"];
  longitude: Scalars["Float"]["output"];
};

export type HighFrequencyUser = {
  __typename?: "HighFrequencyUser";
  /** Number of accesses by the user */
  accessCount: Scalars["Int"]["output"];
  /** User identifier */
  userId: Scalars["String"]["output"];
};

export type InfrastructureHealth = {
  __typename?: "InfrastructureHealth";
  /** Individual service health statuses */
  services: Array<InfrastructureServiceStatus>;
  /** Overall health status */
  status: Scalars["String"]["output"];
  /** Overall system uptime percentage */
  uptime: Scalars["Float"]["output"];
};

export type InfrastructureMetrics = {
  __typename?: "InfrastructureMetrics";
  /** Overall health summary */
  health: InfrastructureHealth;
  /** Log summary metrics */
  logs: LogMetricsSummary;
  /** Performance statistics */
  performance: PerformanceMetricsDetail;
  /** Metrics period */
  period: Scalars["String"]["output"];
  /** Resource usage metrics */
  resources: ResourceUsageMetrics;
  /** Metrics generation timestamp */
  timestamp: Scalars["DateTime"]["output"];
};

export type InfrastructureServiceStatus = {
  __typename?: "InfrastructureServiceStatus";
  /** Optional diagnostic message for the service */
  message?: Maybe<Scalars["String"]["output"]>;
  /** Service name */
  name: Scalars["String"]["output"];
  /** Service status (healthy/degraded/unhealthy) */
  status: Scalars["String"]["output"];
};

export type InstallationLocation = {
  __typename?: "InstallationLocation";
  building?: Maybe<Scalars["String"]["output"]>;
  coordinates?: Maybe<GeoLocation>;
  floor?: Maybe<Scalars["String"]["output"]>;
  mountingType?: Maybe<Scalars["String"]["output"]>;
  room?: Maybe<Scalars["String"]["output"]>;
  siteName: Scalars["String"]["output"];
};

export type InterfaceStats = {
  __typename?: "InterfaceStats";
  bytesIn: Scalars["Int"]["output"];
  bytesOut: Scalars["Int"]["output"];
  dropsIn: Scalars["Int"]["output"];
  dropsOut: Scalars["Int"]["output"];
  errorsIn: Scalars["Int"]["output"];
  errorsOut: Scalars["Int"]["output"];
  interfaceName: Scalars["String"]["output"];
  packetsIn: Scalars["Int"]["output"];
  packetsOut: Scalars["Int"]["output"];
  rateInBps?: Maybe<Scalars["Float"]["output"]>;
  rateOutBps?: Maybe<Scalars["Float"]["output"]>;
  speedMbps?: Maybe<Scalars["Int"]["output"]>;
  status: Scalars["String"]["output"];
  utilizationPercent?: Maybe<Scalars["Float"]["output"]>;
};

export type InterferenceSource = {
  __typename?: "InterferenceSource";
  affectedChannels: Array<Scalars["Int"]["output"]>;
  frequencyMhz: Scalars["Int"]["output"];
  sourceType: Scalars["String"]["output"];
  strengthDbm: Scalars["Float"]["output"];
};

export type LogMetricsSummary = {
  __typename?: "LogMetricsSummary";
  /** Critical severity logs */
  criticalLogs: Scalars["Int"]["output"];
  /** Error rate based on logs (%) */
  errorRate: Scalars["Float"]["output"];
  /** Informational logs */
  infoLogs: Scalars["Int"]["output"];
  /** Total logs in period */
  totalLogs: Scalars["Int"]["output"];
  /** Warning severity logs */
  warningLogs: Scalars["Int"]["output"];
};

export type MonitoringMetrics = {
  __typename?: "MonitoringMetrics";
  /** API request count */
  apiRequests: Scalars["Int"]["output"];
  /** Average response time (ms) */
  avgResponseTimeMs: Scalars["Float"]["output"];
  /** Number of critical errors */
  criticalErrors: Scalars["Int"]["output"];
  /** Current error rate (%) */
  errorRate: Scalars["Float"]["output"];
  /** Failed requests */
  failedRequests: Scalars["Int"]["output"];
  /** Requests with >1s latency */
  highLatencyRequests: Scalars["Int"]["output"];
  /** P95 response time (ms) */
  p95ResponseTimeMs: Scalars["Float"]["output"];
  /** P99 response time (ms) */
  p99ResponseTimeMs: Scalars["Float"]["output"];
  /** Metrics calculation period */
  period: Scalars["String"]["output"];
  /** Successful requests */
  successfulRequests: Scalars["Int"]["output"];
  /** System activity count */
  systemActivities: Scalars["Int"]["output"];
  /** Request timeouts */
  timeoutCount: Scalars["Int"]["output"];
  /** Metrics generation timestamp */
  timestamp: Scalars["DateTime"]["output"];
  /** Total requests processed */
  totalRequests: Scalars["Int"]["output"];
  /** User activity count */
  userActivities: Scalars["Int"]["output"];
  /** Number of warnings */
  warningCount: Scalars["Int"]["output"];
};

export type Mutation = {
  __typename?: "Mutation";
  /** Cancel a running workflow */
  cancelWorkflow: Workflow;
  /** Health check mutation */
  ping: Scalars["String"]["output"];
  /** Provision new subscriber atomically */
  provisionSubscriber: ProvisionSubscriberResult;
  /** Retry a failed workflow */
  retryWorkflow: Workflow;
};

export type MutationCancelWorkflowArgs = {
  workflowId: Scalars["String"]["input"];
};

export type MutationProvisionSubscriberArgs = {
  input: ProvisionSubscriberInput;
};

export type MutationRetryWorkflowArgs = {
  workflowId: Scalars["String"]["input"];
};

export type NetworkAlert = {
  __typename?: "NetworkAlert";
  acknowledgedAt?: Maybe<Scalars["DateTime"]["output"]>;
  alertId: Scalars["String"]["output"];
  alertRuleId?: Maybe<Scalars["String"]["output"]>;
  currentValue?: Maybe<Scalars["Float"]["output"]>;
  description: Scalars["String"]["output"];
  deviceId?: Maybe<Scalars["String"]["output"]>;
  deviceName?: Maybe<Scalars["String"]["output"]>;
  deviceType?: Maybe<DeviceTypeEnum>;
  isAcknowledged: Scalars["Boolean"]["output"];
  isActive: Scalars["Boolean"]["output"];
  metricName?: Maybe<Scalars["String"]["output"]>;
  resolvedAt?: Maybe<Scalars["DateTime"]["output"]>;
  severity: AlertSeverityEnum;
  tenantId: Scalars["String"]["output"];
  thresholdValue?: Maybe<Scalars["Float"]["output"]>;
  title: Scalars["String"]["output"];
  triggeredAt: Scalars["DateTime"]["output"];
};

export type NetworkAlertUpdate = {
  __typename?: "NetworkAlertUpdate";
  action: Scalars["String"]["output"];
  alert: NetworkAlert;
  updatedAt: Scalars["DateTime"]["output"];
};

export type NetworkOverview = {
  __typename?: "NetworkOverview";
  activeAlerts: Scalars["Int"]["output"];
  criticalAlerts: Scalars["Int"]["output"];
  degradedDevices: Scalars["Int"]["output"];
  deviceTypeSummary: Array<DeviceTypeSummary>;
  offlineDevices: Scalars["Int"]["output"];
  onlineDevices: Scalars["Int"]["output"];
  peakBandwidthInBps?: Maybe<Scalars["Float"]["output"]>;
  peakBandwidthOutBps?: Maybe<Scalars["Float"]["output"]>;
  recentAlerts: Array<NetworkAlert>;
  recentOfflineDevices: Array<Scalars["String"]["output"]>;
  tenantId: Scalars["String"]["output"];
  timestamp: Scalars["DateTime"]["output"];
  totalBandwidthGbps: Scalars["Float"]["output"];
  totalBandwidthInBps: Scalars["Float"]["output"];
  totalBandwidthOutBps: Scalars["Float"]["output"];
  totalDevices: Scalars["Int"]["output"];
  uptimePercentage: Scalars["Float"]["output"];
  warningAlerts: Scalars["Int"]["output"];
};

export type OnuMetrics = {
  __typename?: "ONUMetrics";
  distanceMeters?: Maybe<Scalars["Int"]["output"]>;
  oltRxPowerDbm?: Maybe<Scalars["Float"]["output"]>;
  opticalPowerRxDbm?: Maybe<Scalars["Float"]["output"]>;
  opticalPowerTxDbm?: Maybe<Scalars["Float"]["output"]>;
  serialNumber: Scalars["String"]["output"];
  state?: Maybe<Scalars["String"]["output"]>;
};

export type OtdrTestResult = {
  __typename?: "OTDRTestResult";
  averageAttenuationDbPerKm: Scalars["Float"]["output"];
  bendCount: Scalars["Int"]["output"];
  breakCount: Scalars["Int"]["output"];
  cableId: Scalars["String"]["output"];
  connectorCount: Scalars["Int"]["output"];
  isPassing: Scalars["Boolean"]["output"];
  marginDb?: Maybe<Scalars["Float"]["output"]>;
  passThresholdDb: Scalars["Float"]["output"];
  pulseWidthNs: Scalars["Int"]["output"];
  spliceCount: Scalars["Int"]["output"];
  strandId: Scalars["Int"]["output"];
  testId: Scalars["String"]["output"];
  testedAt: Scalars["DateTime"]["output"];
  testedBy: Scalars["String"]["output"];
  totalLengthMeters: Scalars["Float"]["output"];
  totalLossDb: Scalars["Float"]["output"];
  traceFileUrl?: Maybe<Scalars["String"]["output"]>;
  wavelengthNm: Scalars["Int"]["output"];
};

export type Payment = {
  __typename?: "Payment";
  amount: Scalars["Decimal"]["output"];
  createdAt: Scalars["DateTime"]["output"];
  currency: Scalars["String"]["output"];
  customer?: Maybe<PaymentCustomer>;
  customerId: Scalars["ID"]["output"];
  description?: Maybe<Scalars["String"]["output"]>;
  failureCode?: Maybe<Scalars["String"]["output"]>;
  failureReason?: Maybe<Scalars["String"]["output"]>;
  feeAmount?: Maybe<Scalars["Decimal"]["output"]>;
  id: Scalars["ID"]["output"];
  invoice?: Maybe<PaymentInvoice>;
  invoiceId?: Maybe<Scalars["ID"]["output"]>;
  metadata?: Maybe<Scalars["JSON"]["output"]>;
  netAmount?: Maybe<Scalars["Decimal"]["output"]>;
  paymentMethod?: Maybe<PaymentMethod>;
  paymentMethodType: PaymentMethodTypeEnum;
  paymentNumber?: Maybe<Scalars["String"]["output"]>;
  processedAt?: Maybe<Scalars["DateTime"]["output"]>;
  provider: Scalars["String"]["output"];
  refundAmount?: Maybe<Scalars["Decimal"]["output"]>;
  refundedAt?: Maybe<Scalars["DateTime"]["output"]>;
  status: PaymentStatusEnum;
  subscriptionId?: Maybe<Scalars["ID"]["output"]>;
};

export type PaymentConnection = {
  __typename?: "PaymentConnection";
  hasNextPage: Scalars["Boolean"]["output"];
  payments: Array<Payment>;
  totalAmount: Scalars["Decimal"]["output"];
  totalCount: Scalars["Int"]["output"];
  totalFailed: Scalars["Decimal"]["output"];
  totalPending: Scalars["Decimal"]["output"];
  totalSucceeded: Scalars["Decimal"]["output"];
};

export type PaymentCustomer = {
  __typename?: "PaymentCustomer";
  customerNumber?: Maybe<Scalars["String"]["output"]>;
  email: Scalars["String"]["output"];
  id: Scalars["ID"]["output"];
  name: Scalars["String"]["output"];
};

export type PaymentInvoice = {
  __typename?: "PaymentInvoice";
  id: Scalars["ID"]["output"];
  invoiceNumber: Scalars["String"]["output"];
  status: Scalars["String"]["output"];
  totalAmount: Scalars["Decimal"]["output"];
};

export type PaymentMethod = {
  __typename?: "PaymentMethod";
  brand?: Maybe<Scalars["String"]["output"]>;
  expiryMonth?: Maybe<Scalars["Int"]["output"]>;
  expiryYear?: Maybe<Scalars["Int"]["output"]>;
  last4?: Maybe<Scalars["String"]["output"]>;
  provider: Scalars["String"]["output"];
  type: PaymentMethodTypeEnum;
};

export enum PaymentMethodTypeEnum {
  Ach = "ACH",
  BankAccount = "BANK_ACCOUNT",
  Card = "CARD",
  Cash = "CASH",
  Check = "CHECK",
  Crypto = "CRYPTO",
  DigitalWallet = "DIGITAL_WALLET",
  Other = "OTHER",
  WireTransfer = "WIRE_TRANSFER",
}

export type PaymentMetrics = {
  __typename?: "PaymentMetrics";
  averagePaymentSize: Scalars["Decimal"]["output"];
  failedAmount: Scalars["Decimal"]["output"];
  failedCount: Scalars["Int"]["output"];
  monthRevenue: Scalars["Decimal"]["output"];
  pendingAmount: Scalars["Decimal"]["output"];
  pendingCount: Scalars["Int"]["output"];
  refundedAmount: Scalars["Decimal"]["output"];
  refundedCount: Scalars["Int"]["output"];
  succeededCount: Scalars["Int"]["output"];
  successRate: Scalars["Float"]["output"];
  todayRevenue: Scalars["Decimal"]["output"];
  totalPayments: Scalars["Int"]["output"];
  totalRevenue: Scalars["Decimal"]["output"];
  weekRevenue: Scalars["Decimal"]["output"];
};

export enum PaymentStatusEnum {
  Cancelled = "CANCELLED",
  Failed = "FAILED",
  Pending = "PENDING",
  Processing = "PROCESSING",
  Refunded = "REFUNDED",
  RequiresAction = "REQUIRES_ACTION",
  RequiresCapture = "REQUIRES_CAPTURE",
  RequiresConfirmation = "REQUIRES_CONFIRMATION",
  Succeeded = "SUCCEEDED",
}

export type PerformanceMetricsDetail = {
  __typename?: "PerformanceMetricsDetail";
  /** Average response time (ms) */
  avgResponseTimeMs: Scalars["Float"]["output"];
  /** Error rate (%) */
  errorRate: Scalars["Float"]["output"];
  /** Failed requests */
  failedRequests: Scalars["Int"]["output"];
  /** Requests over 1s latency */
  highLatencyRequests: Scalars["Int"]["output"];
  /** P95 response time (ms) */
  p95ResponseTimeMs: Scalars["Float"]["output"];
  /** P99 response time (ms) */
  p99ResponseTimeMs: Scalars["Float"]["output"];
  /** Requests per second */
  requestsPerSecond: Scalars["Float"]["output"];
  /** Successful requests */
  successfulRequests: Scalars["Int"]["output"];
  /** Request timeouts */
  timeoutCount: Scalars["Int"]["output"];
  /** Total requests processed */
  totalRequests: Scalars["Int"]["output"];
};

export type Permission = {
  __typename?: "Permission";
  category: PermissionCategoryEnum;
  createdAt: Scalars["DateTime"]["output"];
  description?: Maybe<Scalars["String"]["output"]>;
  displayName: Scalars["String"]["output"];
  id: Scalars["ID"]["output"];
  isActive: Scalars["Boolean"]["output"];
  isSystem: Scalars["Boolean"]["output"];
  name: Scalars["String"]["output"];
  updatedAt: Scalars["DateTime"]["output"];
};

export enum PermissionCategoryEnum {
  Admin = "ADMIN",
  Analytics = "ANALYTICS",
  Automation = "AUTOMATION",
  Billing = "BILLING",
  Communication = "COMMUNICATION",
  Cpe = "CPE",
  Customer = "CUSTOMER",
  Ipam = "IPAM",
  Network = "NETWORK",
  Security = "SECURITY",
  Ticket = "TICKET",
  User = "USER",
  Workflow = "WORKFLOW",
}

export type PermissionsByCategory = {
  __typename?: "PermissionsByCategory";
  category: PermissionCategoryEnum;
  count: Scalars["Int"]["output"];
  permissions: Array<Permission>;
};

export type PlanConnection = {
  __typename?: "PlanConnection";
  hasNextPage: Scalars["Boolean"]["output"];
  hasPrevPage: Scalars["Boolean"]["output"];
  page: Scalars["Int"]["output"];
  pageSize: Scalars["Int"]["output"];
  plans: Array<SubscriptionPlan>;
  totalCount: Scalars["Int"]["output"];
};

export type PortAllocation = {
  __typename?: "PortAllocation";
  cableId?: Maybe<Scalars["String"]["output"]>;
  customerId?: Maybe<Scalars["String"]["output"]>;
  customerName?: Maybe<Scalars["String"]["output"]>;
  isActive: Scalars["Boolean"]["output"];
  isAllocated: Scalars["Boolean"]["output"];
  portNumber: Scalars["Int"]["output"];
  serviceId?: Maybe<Scalars["String"]["output"]>;
  strandId?: Maybe<Scalars["Int"]["output"]>;
};

export type Product = {
  __typename?: "Product";
  basePrice: Scalars["Decimal"]["output"];
  category: Scalars["String"]["output"];
  createdAt: Scalars["DateTime"]["output"];
  currency: Scalars["String"]["output"];
  description?: Maybe<Scalars["String"]["output"]>;
  id: Scalars["ID"]["output"];
  isActive: Scalars["Boolean"]["output"];
  name: Scalars["String"]["output"];
  productId: Scalars["String"]["output"];
  productType: ProductTypeEnum;
  sku: Scalars["String"]["output"];
  updatedAt: Scalars["DateTime"]["output"];
};

export type ProductConnection = {
  __typename?: "ProductConnection";
  hasNextPage: Scalars["Boolean"]["output"];
  hasPrevPage: Scalars["Boolean"]["output"];
  page: Scalars["Int"]["output"];
  pageSize: Scalars["Int"]["output"];
  products: Array<Product>;
  totalCount: Scalars["Int"]["output"];
};

export enum ProductTypeEnum {
  Hybrid = "HYBRID",
  OneTime = "ONE_TIME",
  Subscription = "SUBSCRIPTION",
  UsageBased = "USAGE_BASED",
}

export type ProfileChangeRecord = {
  __typename?: "ProfileChangeRecord";
  changeReason?: Maybe<Scalars["String"]["output"]>;
  changedByUserId: Scalars["ID"]["output"];
  changedByUsername?: Maybe<Scalars["String"]["output"]>;
  createdAt: Scalars["DateTime"]["output"];
  fieldName: Scalars["String"]["output"];
  id: Scalars["ID"]["output"];
  ipAddress?: Maybe<Scalars["String"]["output"]>;
  newValue?: Maybe<Scalars["String"]["output"]>;
  oldValue?: Maybe<Scalars["String"]["output"]>;
};

/** Subscriber provisioning input */
export type ProvisionSubscriberInput = {
  allocateIpFromNetbox?: Scalars["Boolean"]["input"];
  autoActivate?: Scalars["Boolean"]["input"];
  bandwidthMbps: Scalars["Int"]["input"];
  configureGenieacs?: Scalars["Boolean"]["input"];
  configureVoltha?: Scalars["Boolean"]["input"];
  connectionType: Scalars["String"]["input"];
  cpeMac?: InputMaybe<Scalars["String"]["input"]>;
  createRadiusAccount?: Scalars["Boolean"]["input"];
  customerId?: InputMaybe<Scalars["String"]["input"]>;
  email: Scalars["String"]["input"];
  firstName: Scalars["String"]["input"];
  installationDate?: InputMaybe<Scalars["DateTime"]["input"]>;
  installationNotes?: InputMaybe<Scalars["String"]["input"]>;
  ipv4Address?: InputMaybe<Scalars["String"]["input"]>;
  ipv6Prefix?: InputMaybe<Scalars["String"]["input"]>;
  lastName: Scalars["String"]["input"];
  notes?: InputMaybe<Scalars["String"]["input"]>;
  onuMac?: InputMaybe<Scalars["String"]["input"]>;
  onuSerial?: InputMaybe<Scalars["String"]["input"]>;
  phone: Scalars["String"]["input"];
  secondaryPhone?: InputMaybe<Scalars["String"]["input"]>;
  sendWelcomeEmail?: Scalars["Boolean"]["input"];
  serviceAddress: Scalars["String"]["input"];
  serviceCity: Scalars["String"]["input"];
  serviceCountry?: Scalars["String"]["input"];
  servicePlanId: Scalars["String"]["input"];
  servicePostalCode: Scalars["String"]["input"];
  serviceState: Scalars["String"]["input"];
  vlanId?: InputMaybe<Scalars["Int"]["input"]>;
};

/** Subscriber provisioning result */
export type ProvisionSubscriberResult = {
  __typename?: "ProvisionSubscriberResult";
  completedAt?: Maybe<Scalars["DateTime"]["output"]>;
  cpeId?: Maybe<Scalars["String"]["output"]>;
  createdAt: Scalars["DateTime"]["output"];
  customerId: Scalars["String"]["output"];
  errorMessage?: Maybe<Scalars["String"]["output"]>;
  ipv4Address?: Maybe<Scalars["String"]["output"]>;
  /** Is provisioning successful */
  isSuccessful: Scalars["Boolean"]["output"];
  onuId?: Maybe<Scalars["String"]["output"]>;
  radiusUsername?: Maybe<Scalars["String"]["output"]>;
  serviceId?: Maybe<Scalars["String"]["output"]>;
  status: WorkflowStatus;
  stepsCompleted: Scalars["Int"]["output"];
  subscriberId: Scalars["String"]["output"];
  totalSteps: Scalars["Int"]["output"];
  vlanId?: Maybe<Scalars["Int"]["output"]>;
  /** Full workflow details */
  workflow?: Maybe<Workflow>;
  workflowId: Scalars["String"]["output"];
};

export type Query = {
  __typename?: "Query";
  accessPoint?: Maybe<AccessPoint>;
  accessPoints: AccessPointConnection;
  accessPointsBySite: Array<AccessPoint>;
  /** Get billing overview metrics */
  billingMetrics: BillingMetrics;
  channelUtilization: Array<ChannelUtilization>;
  coverageZone?: Maybe<CoverageZone>;
  coverageZones: CoverageZoneConnection;
  coverageZonesBySite: Array<CoverageZone>;
  /** Get customer by ID with activities and notes */
  customer?: Maybe<Customer>;
  /** Get customer billing information */
  customerBilling: Scalars["JSON"]["output"];
  /** Get customer devices */
  customerDevices: Scalars["JSON"]["output"];
  /** Get customer analytics metrics */
  customerMetrics: CustomerMetrics;
  /** Get customer network information */
  customerNetworkInfo: Scalars["JSON"]["output"];
  /** Get customer subscriptions */
  customerSubscriptions: Array<Subscription>;
  /** Get customer tickets */
  customerTickets: Scalars["JSON"]["output"];
  /** Get list of customers with optional filters */
  customers: CustomerConnection;
  /** Get complete dashboard overview in one query */
  dashboardOverview: DashboardOverview;
  /** Get device health status by ID */
  deviceHealth?: Maybe<DeviceHealth>;
  /** Get comprehensive device metrics (health + traffic + device-specific) */
  deviceMetrics?: Maybe<DeviceMetrics>;
  /** Get device traffic and bandwidth statistics */
  deviceTraffic?: Maybe<TrafficStats>;
  distributionPoint?: Maybe<DistributionPoint>;
  distributionPoints: DistributionPointConnection;
  distributionPointsBySite: Array<DistributionPoint>;
  fiberCable?: Maybe<FiberCable>;
  fiberCables: FiberCableConnection;
  fiberCablesByDistributionPoint: Array<FiberCable>;
  fiberCablesByRoute: Array<FiberCable>;
  fiberDashboard: FiberDashboard;
  fiberHealthMetrics: Array<FiberHealthMetrics>;
  fiberNetworkAnalytics: FiberNetworkAnalytics;
  /** Check if a workflow is running for a specific customer */
  hasRunningWorkflowForCustomer: Scalars["Boolean"]["output"];
  /** Get infrastructure metrics overview */
  infrastructureMetrics: InfrastructureMetrics;
  /** Get system monitoring metrics */
  monitoringMetrics: MonitoringMetrics;
  /** Get alert by ID */
  networkAlert?: Maybe<NetworkAlert>;
  /** List network alerts with filtering */
  networkAlerts: AlertConnection;
  /** List network devices with optional filters */
  networkDevices: DeviceConnection;
  /** Get comprehensive network overview dashboard */
  networkOverview: NetworkOverview;
  otdrTestResults: Array<OtdrTestResult>;
  /** Get payment by ID with customer and invoice data */
  payment?: Maybe<Payment>;
  /** Get payment metrics and statistics */
  paymentMetrics: PaymentMetrics;
  /** Get list of payments with optional filters */
  payments: PaymentConnection;
  /** Get permissions grouped by category */
  permissionsByCategory: Array<PermissionsByCategory>;
  /** Get list of subscription plans */
  plans: PlanConnection;
  /** Get list of products */
  products: ProductConnection;
  rfAnalytics: RfAnalytics;
  /** Get list of roles with optional filters */
  roles: RoleConnection;
  /** Get running workflows count */
  runningWorkflowsCount: Scalars["Int"]["output"];
  /** Get security metrics overview */
  securityMetrics: SecurityOverview;
  serviceArea?: Maybe<ServiceArea>;
  serviceAreas: ServiceAreaConnection;
  serviceAreasByPostalCode: Array<ServiceArea>;
  /** Get active RADIUS sessions */
  sessions: Array<Session>;
  splicePoint?: Maybe<SplicePoint>;
  splicePoints: SplicePointConnection;
  splicePointsByCable: Array<SplicePoint>;
  /** Get subscriber metrics summary */
  subscriberMetrics: SubscriberMetrics;
  /** Get RADIUS subscribers with optional filtering */
  subscribers: Array<Subscriber>;
  /** Get subscription by ID with conditional loading */
  subscription?: Maybe<Subscription>;
  /** Get subscription metrics and statistics */
  subscriptionMetrics: SubscriptionMetrics;
  /** Get list of subscriptions with filters and conditional loading */
  subscriptions: SubscriptionConnection;
  /** Get tenant by ID with conditional field loading */
  tenant?: Maybe<Tenant>;
  /** Get tenant overview metrics and statistics */
  tenantMetrics: TenantOverviewMetrics;
  /** Get list of tenants with optional filters and conditional loading */
  tenants: TenantConnection;
  /** Get user by ID with conditional field loading */
  user?: Maybe<User>;
  /** Get user overview metrics and statistics */
  userMetrics: UserOverviewMetrics;
  /** Get list of users with optional filters and conditional loading */
  users: UserConnection;
  /** API version and info */
  version: Scalars["String"]["output"];
  wirelessClient?: Maybe<WirelessClient>;
  wirelessClients: WirelessClientConnection;
  wirelessClientsByAccessPoint: Array<WirelessClient>;
  wirelessClientsByCustomer: Array<WirelessClient>;
  wirelessDashboard: WirelessDashboard;
  wirelessSiteMetrics?: Maybe<WirelessSiteMetrics>;
  /** Get workflow by ID */
  workflow?: Maybe<Workflow>;
  /** Get workflow statistics */
  workflowStatistics: WorkflowStatistics;
  /** List workflows with filtering */
  workflows: WorkflowConnection;
};

export type QueryAccessPointArgs = {
  id: Scalars["ID"]["input"];
};

export type QueryAccessPointsArgs = {
  frequencyBand?: InputMaybe<FrequencyBand>;
  limit?: Scalars["Int"]["input"];
  offset?: Scalars["Int"]["input"];
  search?: InputMaybe<Scalars["String"]["input"]>;
  siteId?: InputMaybe<Scalars["String"]["input"]>;
  status?: InputMaybe<AccessPointStatus>;
};

export type QueryAccessPointsBySiteArgs = {
  siteId: Scalars["String"]["input"];
};

export type QueryBillingMetricsArgs = {
  period?: Scalars["String"]["input"];
};

export type QueryChannelUtilizationArgs = {
  frequencyBand: FrequencyBand;
  siteId: Scalars["String"]["input"];
};

export type QueryCoverageZoneArgs = {
  id: Scalars["ID"]["input"];
};

export type QueryCoverageZonesArgs = {
  areaType?: InputMaybe<Scalars["String"]["input"]>;
  limit?: Scalars["Int"]["input"];
  offset?: Scalars["Int"]["input"];
  siteId?: InputMaybe<Scalars["String"]["input"]>;
};

export type QueryCoverageZonesBySiteArgs = {
  siteId: Scalars["String"]["input"];
};

export type QueryCustomerArgs = {
  id: Scalars["ID"]["input"];
  includeActivities?: Scalars["Boolean"]["input"];
  includeNotes?: Scalars["Boolean"]["input"];
};

export type QueryCustomerBillingArgs = {
  customerId: Scalars["ID"]["input"];
  includeInvoices?: Scalars["Boolean"]["input"];
  invoiceLimit?: Scalars["Int"]["input"];
};

export type QueryCustomerDevicesArgs = {
  activeOnly?: Scalars["Boolean"]["input"];
  customerId: Scalars["ID"]["input"];
  deviceType?: InputMaybe<Scalars["String"]["input"]>;
};

export type QueryCustomerMetricsArgs = {
  period?: Scalars["String"]["input"];
};

export type QueryCustomerNetworkInfoArgs = {
  customerId: Scalars["ID"]["input"];
};

export type QueryCustomerSubscriptionsArgs = {
  customerId: Scalars["ID"]["input"];
  limit?: Scalars["Int"]["input"];
  status?: InputMaybe<Scalars["String"]["input"]>;
};

export type QueryCustomerTicketsArgs = {
  customerId: Scalars["ID"]["input"];
  limit?: Scalars["Int"]["input"];
  status?: InputMaybe<Scalars["String"]["input"]>;
};

export type QueryCustomersArgs = {
  includeActivities?: Scalars["Boolean"]["input"];
  includeNotes?: Scalars["Boolean"]["input"];
  limit?: Scalars["Int"]["input"];
  offset?: Scalars["Int"]["input"];
  search?: InputMaybe<Scalars["String"]["input"]>;
  status?: InputMaybe<CustomerStatusEnum>;
};

export type QueryDashboardOverviewArgs = {
  period?: Scalars["String"]["input"];
};

export type QueryDeviceHealthArgs = {
  deviceId: Scalars["String"]["input"];
  deviceType: DeviceTypeEnum;
};

export type QueryDeviceMetricsArgs = {
  deviceId: Scalars["String"]["input"];
  deviceType: DeviceTypeEnum;
  includeInterfaces?: Scalars["Boolean"]["input"];
};

export type QueryDeviceTrafficArgs = {
  deviceId: Scalars["String"]["input"];
  deviceType: DeviceTypeEnum;
  includeInterfaces?: Scalars["Boolean"]["input"];
};

export type QueryDistributionPointArgs = {
  id: Scalars["ID"]["input"];
};

export type QueryDistributionPointsArgs = {
  limit?: Scalars["Int"]["input"];
  nearCapacity?: InputMaybe<Scalars["Boolean"]["input"]>;
  offset?: Scalars["Int"]["input"];
  pointType?: InputMaybe<DistributionPointType>;
  siteId?: InputMaybe<Scalars["String"]["input"]>;
  status?: InputMaybe<FiberCableStatus>;
};

export type QueryDistributionPointsBySiteArgs = {
  siteId: Scalars["String"]["input"];
};

export type QueryFiberCableArgs = {
  id: Scalars["ID"]["input"];
};

export type QueryFiberCablesArgs = {
  fiberType?: InputMaybe<FiberType>;
  installationType?: InputMaybe<CableInstallationType>;
  limit?: Scalars["Int"]["input"];
  offset?: Scalars["Int"]["input"];
  search?: InputMaybe<Scalars["String"]["input"]>;
  siteId?: InputMaybe<Scalars["String"]["input"]>;
  status?: InputMaybe<FiberCableStatus>;
};

export type QueryFiberCablesByDistributionPointArgs = {
  distributionPointId: Scalars["String"]["input"];
};

export type QueryFiberCablesByRouteArgs = {
  endPointId: Scalars["String"]["input"];
  startPointId: Scalars["String"]["input"];
};

export type QueryFiberHealthMetricsArgs = {
  cableId?: InputMaybe<Scalars["String"]["input"]>;
  healthStatus?: InputMaybe<FiberHealthStatus>;
};

export type QueryHasRunningWorkflowForCustomerArgs = {
  customerId: Scalars["String"]["input"];
};

export type QueryInfrastructureMetricsArgs = {
  period?: Scalars["String"]["input"];
};

export type QueryMonitoringMetricsArgs = {
  period?: Scalars["String"]["input"];
};

export type QueryNetworkAlertArgs = {
  alertId: Scalars["String"]["input"];
};

export type QueryNetworkAlertsArgs = {
  activeOnly?: Scalars["Boolean"]["input"];
  deviceId?: InputMaybe<Scalars["String"]["input"]>;
  deviceType?: InputMaybe<DeviceTypeEnum>;
  page?: Scalars["Int"]["input"];
  pageSize?: Scalars["Int"]["input"];
  severity?: InputMaybe<AlertSeverityEnum>;
};

export type QueryNetworkDevicesArgs = {
  deviceType?: InputMaybe<DeviceTypeEnum>;
  includeAlerts?: Scalars["Boolean"]["input"];
  includeTraffic?: Scalars["Boolean"]["input"];
  page?: Scalars["Int"]["input"];
  pageSize?: Scalars["Int"]["input"];
  search?: InputMaybe<Scalars["String"]["input"]>;
  status?: InputMaybe<DeviceStatusEnum>;
};

export type QueryOtdrTestResultsArgs = {
  cableId: Scalars["String"]["input"];
  limit?: Scalars["Int"]["input"];
  strandId?: InputMaybe<Scalars["Int"]["input"]>;
};

export type QueryPaymentArgs = {
  id: Scalars["ID"]["input"];
  includeCustomer?: Scalars["Boolean"]["input"];
  includeInvoice?: Scalars["Boolean"]["input"];
};

export type QueryPaymentMetricsArgs = {
  dateFrom?: InputMaybe<Scalars["DateTime"]["input"]>;
  dateTo?: InputMaybe<Scalars["DateTime"]["input"]>;
};

export type QueryPaymentsArgs = {
  customerId?: InputMaybe<Scalars["ID"]["input"]>;
  dateFrom?: InputMaybe<Scalars["DateTime"]["input"]>;
  dateTo?: InputMaybe<Scalars["DateTime"]["input"]>;
  includeCustomer?: Scalars["Boolean"]["input"];
  includeInvoice?: Scalars["Boolean"]["input"];
  limit?: Scalars["Int"]["input"];
  offset?: Scalars["Int"]["input"];
  status?: InputMaybe<PaymentStatusEnum>;
};

export type QueryPermissionsByCategoryArgs = {
  category?: InputMaybe<PermissionCategoryEnum>;
};

export type QueryPlansArgs = {
  billingCycle?: InputMaybe<BillingCycleEnum>;
  isActive?: InputMaybe<Scalars["Boolean"]["input"]>;
  page?: Scalars["Int"]["input"];
  pageSize?: Scalars["Int"]["input"];
};

export type QueryProductsArgs = {
  category?: InputMaybe<Scalars["String"]["input"]>;
  isActive?: InputMaybe<Scalars["Boolean"]["input"]>;
  page?: Scalars["Int"]["input"];
  pageSize?: Scalars["Int"]["input"];
};

export type QueryRfAnalyticsArgs = {
  siteId: Scalars["String"]["input"];
};

export type QueryRolesArgs = {
  isActive?: InputMaybe<Scalars["Boolean"]["input"]>;
  isSystem?: InputMaybe<Scalars["Boolean"]["input"]>;
  page?: Scalars["Int"]["input"];
  pageSize?: Scalars["Int"]["input"];
  search?: InputMaybe<Scalars["String"]["input"]>;
};

export type QuerySecurityMetricsArgs = {
  period?: Scalars["String"]["input"];
};

export type QueryServiceAreaArgs = {
  id: Scalars["ID"]["input"];
};

export type QueryServiceAreasArgs = {
  areaType?: InputMaybe<ServiceAreaType>;
  constructionStatus?: InputMaybe<Scalars["String"]["input"]>;
  isServiceable?: InputMaybe<Scalars["Boolean"]["input"]>;
  limit?: Scalars["Int"]["input"];
  offset?: Scalars["Int"]["input"];
};

export type QueryServiceAreasByPostalCodeArgs = {
  postalCode: Scalars["String"]["input"];
};

export type QuerySessionsArgs = {
  limit?: Scalars["Int"]["input"];
  username?: InputMaybe<Scalars["String"]["input"]>;
};

export type QuerySplicePointArgs = {
  id: Scalars["ID"]["input"];
};

export type QuerySplicePointsArgs = {
  cableId?: InputMaybe<Scalars["String"]["input"]>;
  distributionPointId?: InputMaybe<Scalars["String"]["input"]>;
  limit?: Scalars["Int"]["input"];
  offset?: Scalars["Int"]["input"];
  status?: InputMaybe<SpliceStatus>;
};

export type QuerySplicePointsByCableArgs = {
  cableId: Scalars["String"]["input"];
};

export type QuerySubscribersArgs = {
  enabled?: InputMaybe<Scalars["Boolean"]["input"]>;
  limit?: Scalars["Int"]["input"];
  search?: InputMaybe<Scalars["String"]["input"]>;
};

export type QuerySubscriptionArgs = {
  id: Scalars["ID"]["input"];
  includeCustomer?: Scalars["Boolean"]["input"];
  includeInvoices?: Scalars["Boolean"]["input"];
  includePlan?: Scalars["Boolean"]["input"];
};

export type QuerySubscriptionsArgs = {
  billingCycle?: InputMaybe<BillingCycleEnum>;
  includeCustomer?: Scalars["Boolean"]["input"];
  includeInvoices?: Scalars["Boolean"]["input"];
  includePlan?: Scalars["Boolean"]["input"];
  page?: Scalars["Int"]["input"];
  pageSize?: Scalars["Int"]["input"];
  search?: InputMaybe<Scalars["String"]["input"]>;
  status?: InputMaybe<SubscriptionStatusEnum>;
};

export type QueryTenantArgs = {
  id: Scalars["ID"]["input"];
  includeInvitations?: Scalars["Boolean"]["input"];
  includeMetadata?: Scalars["Boolean"]["input"];
  includeSettings?: Scalars["Boolean"]["input"];
  includeUsage?: Scalars["Boolean"]["input"];
};

export type QueryTenantsArgs = {
  includeInvitations?: Scalars["Boolean"]["input"];
  includeMetadata?: Scalars["Boolean"]["input"];
  includeSettings?: Scalars["Boolean"]["input"];
  includeUsage?: Scalars["Boolean"]["input"];
  page?: Scalars["Int"]["input"];
  pageSize?: Scalars["Int"]["input"];
  plan?: InputMaybe<Scalars["String"]["input"]>;
  search?: InputMaybe<Scalars["String"]["input"]>;
  status?: InputMaybe<TenantStatusEnum>;
};

export type QueryUserArgs = {
  id: Scalars["ID"]["input"];
  includeMetadata?: Scalars["Boolean"]["input"];
  includePermissions?: Scalars["Boolean"]["input"];
  includeProfileChanges?: Scalars["Boolean"]["input"];
  includeRoles?: Scalars["Boolean"]["input"];
  includeTeams?: Scalars["Boolean"]["input"];
};

export type QueryUsersArgs = {
  includeMetadata?: Scalars["Boolean"]["input"];
  includePermissions?: Scalars["Boolean"]["input"];
  includeRoles?: Scalars["Boolean"]["input"];
  includeTeams?: Scalars["Boolean"]["input"];
  isActive?: InputMaybe<Scalars["Boolean"]["input"]>;
  isPlatformAdmin?: InputMaybe<Scalars["Boolean"]["input"]>;
  isSuperuser?: InputMaybe<Scalars["Boolean"]["input"]>;
  isVerified?: InputMaybe<Scalars["Boolean"]["input"]>;
  page?: Scalars["Int"]["input"];
  pageSize?: Scalars["Int"]["input"];
  search?: InputMaybe<Scalars["String"]["input"]>;
};

export type QueryWirelessClientArgs = {
  id: Scalars["ID"]["input"];
};

export type QueryWirelessClientsArgs = {
  accessPointId?: InputMaybe<Scalars["String"]["input"]>;
  customerId?: InputMaybe<Scalars["String"]["input"]>;
  frequencyBand?: InputMaybe<FrequencyBand>;
  limit?: Scalars["Int"]["input"];
  offset?: Scalars["Int"]["input"];
  search?: InputMaybe<Scalars["String"]["input"]>;
};

export type QueryWirelessClientsByAccessPointArgs = {
  accessPointId: Scalars["String"]["input"];
};

export type QueryWirelessClientsByCustomerArgs = {
  customerId: Scalars["String"]["input"];
};

export type QueryWirelessSiteMetricsArgs = {
  siteId: Scalars["String"]["input"];
};

export type QueryWorkflowArgs = {
  workflowId: Scalars["String"]["input"];
};

export type QueryWorkflowsArgs = {
  filter?: InputMaybe<WorkflowFilterInput>;
};

export type RfAnalytics = {
  __typename?: "RFAnalytics";
  analysisTimestamp: Scalars["DateTime"]["output"];
  averageSignalStrengthDbm: Scalars["Float"]["output"];
  averageSnr: Scalars["Float"]["output"];
  bandUtilizationBalanceScore: Scalars["Float"]["output"];
  channelUtilization5ghz: Array<ChannelUtilization>;
  channelUtilization6ghz: Array<ChannelUtilization>;
  channelUtilization24ghz: Array<ChannelUtilization>;
  clientsPerBand5ghz: Scalars["Int"]["output"];
  clientsPerBand6ghz: Scalars["Int"]["output"];
  clientsPerBand24ghz: Scalars["Int"]["output"];
  coverageQualityScore: Scalars["Float"]["output"];
  interferenceSources: Array<InterferenceSource>;
  recommendedChannels5ghz: Array<Scalars["Int"]["output"]>;
  recommendedChannels6ghz: Array<Scalars["Int"]["output"]>;
  recommendedChannels24ghz: Array<Scalars["Int"]["output"]>;
  siteId: Scalars["String"]["output"];
  siteName: Scalars["String"]["output"];
  totalInterferenceScore: Scalars["Float"]["output"];
};

export type RfMetrics = {
  __typename?: "RFMetrics";
  channelUtilizationPercent?: Maybe<Scalars["Float"]["output"]>;
  interferenceLevel?: Maybe<Scalars["Float"]["output"]>;
  noiseFloorDbm?: Maybe<Scalars["Float"]["output"]>;
  rxPowerDbm?: Maybe<Scalars["Float"]["output"]>;
  signalStrengthDbm?: Maybe<Scalars["Float"]["output"]>;
  signalToNoiseRatio?: Maybe<Scalars["Float"]["output"]>;
  txPowerDbm?: Maybe<Scalars["Float"]["output"]>;
};

export type RealtimeSubscription = {
  __typename?: "RealtimeSubscription";
  /** Subscribe to customer activity updates */
  customerActivityAdded: CustomerActivityUpdate;
  /** Subscribe to customer device updates */
  customerDevicesUpdated: CustomerDeviceUpdate;
  /** Subscribe to customer network status updates */
  customerNetworkStatusUpdated: CustomerNetworkStatusUpdate;
  /** Subscribe to customer note updates */
  customerNoteUpdated: CustomerNoteUpdate;
  /** Subscribe to customer ticket updates */
  customerTicketUpdated: CustomerTicketUpdate;
  /** Subscribe to device status and metrics updates */
  deviceUpdated: DeviceUpdate;
  /** Subscribe to network alert updates */
  networkAlertUpdated: NetworkAlertUpdate;
};

export type RealtimeSubscriptionCustomerActivityAddedArgs = {
  customerId: Scalars["ID"]["input"];
};

export type RealtimeSubscriptionCustomerDevicesUpdatedArgs = {
  customerId: Scalars["ID"]["input"];
};

export type RealtimeSubscriptionCustomerNetworkStatusUpdatedArgs = {
  customerId: Scalars["ID"]["input"];
};

export type RealtimeSubscriptionCustomerNoteUpdatedArgs = {
  customerId: Scalars["ID"]["input"];
};

export type RealtimeSubscriptionCustomerTicketUpdatedArgs = {
  customerId: Scalars["ID"]["input"];
};

export type RealtimeSubscriptionDeviceUpdatedArgs = {
  deviceType?: InputMaybe<DeviceTypeEnum>;
  status?: InputMaybe<DeviceStatusEnum>;
};

export type RealtimeSubscriptionNetworkAlertUpdatedArgs = {
  deviceId?: InputMaybe<Scalars["String"]["input"]>;
  severity?: InputMaybe<AlertSeverityEnum>;
};

export type ResourceUsageMetrics = {
  __typename?: "ResourceUsageMetrics";
  /** CPU usage percentage */
  cpuUsage: Scalars["Float"]["output"];
  /** Disk usage percentage */
  diskUsage: Scalars["Float"]["output"];
  /** Memory usage percentage */
  memoryUsage: Scalars["Float"]["output"];
  /** Network ingress (MB) */
  networkInMb: Scalars["Float"]["output"];
  /** Network egress (MB) */
  networkOutMb: Scalars["Float"]["output"];
};

export type Role = {
  __typename?: "Role";
  createdAt: Scalars["DateTime"]["output"];
  description?: Maybe<Scalars["String"]["output"]>;
  displayName: Scalars["String"]["output"];
  id: Scalars["ID"]["output"];
  isActive: Scalars["Boolean"]["output"];
  isDefault: Scalars["Boolean"]["output"];
  isSystem: Scalars["Boolean"]["output"];
  name: Scalars["String"]["output"];
  permissions: Array<Permission>;
  priority: Scalars["Int"]["output"];
  updatedAt: Scalars["DateTime"]["output"];
};

export type RoleConnection = {
  __typename?: "RoleConnection";
  hasNextPage: Scalars["Boolean"]["output"];
  hasPrevPage: Scalars["Boolean"]["output"];
  page: Scalars["Int"]["output"];
  pageSize: Scalars["Int"]["output"];
  roles: Array<Role>;
  totalCount: Scalars["Int"]["output"];
};

export type SecretAccessSummary = {
  __typename?: "SecretAccessSummary";
  /** Access count for the secret */
  accessCount: Scalars["Int"]["output"];
  /** Secret path/name */
  secretPath: Scalars["String"]["output"];
};

export type SecretsMetrics = {
  __typename?: "SecretsMetrics";
  /** After-hours accesses */
  afterHoursAccesses: Scalars["Int"]["output"];
  /** Average accesses per secret */
  avgAccessesPerSecret: Scalars["Float"]["output"];
  /** Failed access attempts */
  failedAccessAttempts: Scalars["Int"]["output"];
  /** Top users by access count */
  highFrequencyUsers: Array<HighFrequencyUser>;
  /** Top accessed secrets */
  mostAccessedSecrets: Array<SecretAccessSummary>;
  /** Metrics period */
  period: Scalars["String"]["output"];
  /** Secrets created in last 7 days */
  secretsCreatedLast7d: Scalars["Int"]["output"];
  /** Secrets deleted in last 7 days */
  secretsDeletedLast7d: Scalars["Int"]["output"];
  /** Metrics generation timestamp */
  timestamp: Scalars["DateTime"]["output"];
  /** Secrets accessed count */
  totalSecretsAccessed: Scalars["Int"]["output"];
  /** Secrets created count */
  totalSecretsCreated: Scalars["Int"]["output"];
  /** Secrets deleted count */
  totalSecretsDeleted: Scalars["Int"]["output"];
  /** Secrets updated count */
  totalSecretsUpdated: Scalars["Int"]["output"];
  /** Unique secrets accessed */
  uniqueSecretsAccessed: Scalars["Int"]["output"];
  /** Unique users accessing secrets */
  uniqueUsersAccessing: Scalars["Int"]["output"];
};

export type SecurityOverview = {
  __typename?: "SecurityOverview";
  /** API key metrics */
  apiKeys: ApiKeyMetrics;
  /** Authentication metrics */
  auth: AuthMetrics;
  /** Secrets management metrics */
  secrets: SecretsMetrics;
};

export type ServiceArea = {
  __typename?: "ServiceArea";
  activatedAt?: Maybe<Scalars["DateTime"]["output"]>;
  areaId: Scalars["String"]["output"];
  areaSqkm: Scalars["Float"]["output"];
  areaType: ServiceAreaType;
  availableCapacity: Scalars["Int"]["output"];
  averageDistanceToDistributionMeters?: Maybe<Scalars["Float"]["output"]>;
  boundaryGeojson: Scalars["String"]["output"];
  businessesConnected: Scalars["Int"]["output"];
  businessesPassed: Scalars["Int"]["output"];
  capacityUtilizationPercent: Scalars["Float"]["output"];
  city: Scalars["String"]["output"];
  constructionCompletePercent?: Maybe<Scalars["Float"]["output"]>;
  constructionStartedAt?: Maybe<Scalars["DateTime"]["output"]>;
  constructionStatus: Scalars["String"]["output"];
  createdAt: Scalars["DateTime"]["output"];
  description?: Maybe<Scalars["String"]["output"]>;
  distributionPointCount: Scalars["Int"]["output"];
  distributionPointIds: Array<Scalars["String"]["output"]>;
  estimatedPopulation?: Maybe<Scalars["Int"]["output"]>;
  homesConnected: Scalars["Int"]["output"];
  homesPassed: Scalars["Int"]["output"];
  householdDensityPerSqkm?: Maybe<Scalars["Float"]["output"]>;
  id: Scalars["ID"]["output"];
  isActive: Scalars["Boolean"]["output"];
  isServiceable: Scalars["Boolean"]["output"];
  maxBandwidthGbps: Scalars["Float"]["output"];
  name: Scalars["String"]["output"];
  penetrationRatePercent?: Maybe<Scalars["Float"]["output"]>;
  plannedAt?: Maybe<Scalars["DateTime"]["output"]>;
  postalCodes: Array<Scalars["String"]["output"]>;
  stateProvince: Scalars["String"]["output"];
  streetCount: Scalars["Int"]["output"];
  targetCompletionDate?: Maybe<Scalars["DateTime"]["output"]>;
  totalCapacity: Scalars["Int"]["output"];
  totalFiberKm: Scalars["Float"]["output"];
  updatedAt: Scalars["DateTime"]["output"];
  usedCapacity: Scalars["Int"]["output"];
};

export type ServiceAreaConnection = {
  __typename?: "ServiceAreaConnection";
  hasNextPage: Scalars["Boolean"]["output"];
  serviceAreas: Array<ServiceArea>;
  totalCount: Scalars["Int"]["output"];
};

export enum ServiceAreaType {
  Commercial = "COMMERCIAL",
  Industrial = "INDUSTRIAL",
  Mixed = "MIXED",
  Residential = "RESIDENTIAL",
}

export type Session = {
  __typename?: "Session";
  acctinputoctets?: Maybe<Scalars["Int"]["output"]>;
  acctoutputoctets?: Maybe<Scalars["Int"]["output"]>;
  acctsessionid: Scalars["String"]["output"];
  acctsessiontime?: Maybe<Scalars["Int"]["output"]>;
  acctstarttime?: Maybe<Scalars["DateTime"]["output"]>;
  acctstoptime?: Maybe<Scalars["DateTime"]["output"]>;
  nasipaddress: Scalars["String"]["output"];
  radacctid: Scalars["Int"]["output"];
  username: Scalars["String"]["output"];
};

export type SignalQuality = {
  __typename?: "SignalQuality";
  linkQualityPercent?: Maybe<Scalars["Float"]["output"]>;
  noiseFloorDbm?: Maybe<Scalars["Float"]["output"]>;
  rssiDbm?: Maybe<Scalars["Float"]["output"]>;
  signalStrengthPercent?: Maybe<Scalars["Float"]["output"]>;
  snrDb?: Maybe<Scalars["Float"]["output"]>;
};

export type SpliceConnection = {
  __typename?: "SpliceConnection";
  cableAId: Scalars["String"]["output"];
  cableAStrand: Scalars["Int"]["output"];
  cableBId: Scalars["String"]["output"];
  cableBStrand: Scalars["Int"]["output"];
  isPassing: Scalars["Boolean"]["output"];
  lossDb?: Maybe<Scalars["Float"]["output"]>;
  reflectanceDb?: Maybe<Scalars["Float"]["output"]>;
  spliceType: SpliceType;
  testResult?: Maybe<Scalars["String"]["output"]>;
  testedAt?: Maybe<Scalars["DateTime"]["output"]>;
  testedBy?: Maybe<Scalars["String"]["output"]>;
};

export type SplicePoint = {
  __typename?: "SplicePoint";
  accessNotes?: Maybe<Scalars["String"]["output"]>;
  accessType: Scalars["String"]["output"];
  activeSplices: Scalars["Int"]["output"];
  address?: Maybe<Address>;
  averageSpliceLossDb?: Maybe<Scalars["Float"]["output"]>;
  cableCount: Scalars["Int"]["output"];
  cablesConnected: Array<Scalars["String"]["output"]>;
  closureType?: Maybe<Scalars["String"]["output"]>;
  createdAt: Scalars["DateTime"]["output"];
  description?: Maybe<Scalars["String"]["output"]>;
  distributionPointId?: Maybe<Scalars["String"]["output"]>;
  failingSplices: Scalars["Int"]["output"];
  id: Scalars["ID"]["output"];
  installedAt?: Maybe<Scalars["DateTime"]["output"]>;
  isActive: Scalars["Boolean"]["output"];
  lastMaintainedAt?: Maybe<Scalars["DateTime"]["output"]>;
  lastTestedAt?: Maybe<Scalars["DateTime"]["output"]>;
  location: GeoCoordinate;
  manufacturer?: Maybe<Scalars["String"]["output"]>;
  maxSpliceLossDb?: Maybe<Scalars["Float"]["output"]>;
  model?: Maybe<Scalars["String"]["output"]>;
  name: Scalars["String"]["output"];
  passingSplices: Scalars["Int"]["output"];
  requiresSpecialAccess: Scalars["Boolean"]["output"];
  spliceConnections: Array<SpliceConnection>;
  spliceId: Scalars["String"]["output"];
  status: SpliceStatus;
  totalSplices: Scalars["Int"]["output"];
  trayCapacity: Scalars["Int"]["output"];
  trayCount: Scalars["Int"]["output"];
  updatedAt: Scalars["DateTime"]["output"];
};

export type SplicePointConnection = {
  __typename?: "SplicePointConnection";
  hasNextPage: Scalars["Boolean"]["output"];
  splicePoints: Array<SplicePoint>;
  totalCount: Scalars["Int"]["output"];
};

export enum SpliceStatus {
  Active = "ACTIVE",
  Degraded = "DEGRADED",
  Failed = "FAILED",
  Inactive = "INACTIVE",
}

export enum SpliceType {
  Fusion = "FUSION",
  Mechanical = "MECHANICAL",
}

export type Subscriber = {
  __typename?: "Subscriber";
  bandwidthProfileId?: Maybe<Scalars["String"]["output"]>;
  createdAt: Scalars["DateTime"]["output"];
  enabled: Scalars["Boolean"]["output"];
  framedIpAddress?: Maybe<Scalars["String"]["output"]>;
  id: Scalars["Int"]["output"];
  sessions: Array<Session>;
  subscriberId: Scalars["String"]["output"];
  updatedAt: Scalars["DateTime"]["output"];
  username: Scalars["String"]["output"];
};

export type SubscriberMetrics = {
  __typename?: "SubscriberMetrics";
  activeSessionsCount: Scalars["Int"]["output"];
  disabledCount: Scalars["Int"]["output"];
  enabledCount: Scalars["Int"]["output"];
  totalCount: Scalars["Int"]["output"];
  totalDataUsageMb: Scalars["Float"]["output"];
};

export type Subscription = {
  __typename?: "Subscription";
  cancelAtPeriodEnd: Scalars["Boolean"]["output"];
  canceledAt?: Maybe<Scalars["DateTime"]["output"]>;
  createdAt: Scalars["DateTime"]["output"];
  currentPeriodEnd: Scalars["DateTime"]["output"];
  currentPeriodStart: Scalars["DateTime"]["output"];
  customPrice?: Maybe<Scalars["Decimal"]["output"]>;
  customer?: Maybe<SubscriptionCustomer>;
  customerId: Scalars["String"]["output"];
  daysUntilRenewal: Scalars["Int"]["output"];
  endedAt?: Maybe<Scalars["DateTime"]["output"]>;
  id: Scalars["ID"]["output"];
  isActive: Scalars["Boolean"]["output"];
  isInTrial: Scalars["Boolean"]["output"];
  isPastDue: Scalars["Boolean"]["output"];
  plan?: Maybe<SubscriptionPlan>;
  planId: Scalars["String"]["output"];
  recentInvoices: Array<SubscriptionInvoice>;
  status: SubscriptionStatusEnum;
  subscriptionId: Scalars["String"]["output"];
  tenantId: Scalars["String"]["output"];
  trialEnd?: Maybe<Scalars["DateTime"]["output"]>;
  updatedAt: Scalars["DateTime"]["output"];
  usageRecords: Scalars["JSON"]["output"];
};

export type SubscriptionConnection = {
  __typename?: "SubscriptionConnection";
  hasNextPage: Scalars["Boolean"]["output"];
  hasPrevPage: Scalars["Boolean"]["output"];
  page: Scalars["Int"]["output"];
  pageSize: Scalars["Int"]["output"];
  subscriptions: Array<Subscription>;
  totalCount: Scalars["Int"]["output"];
};

export type SubscriptionCustomer = {
  __typename?: "SubscriptionCustomer";
  createdAt: Scalars["DateTime"]["output"];
  customerId: Scalars["String"]["output"];
  email: Scalars["String"]["output"];
  id: Scalars["ID"]["output"];
  name?: Maybe<Scalars["String"]["output"]>;
  phone?: Maybe<Scalars["String"]["output"]>;
};

export type SubscriptionInvoice = {
  __typename?: "SubscriptionInvoice";
  amount: Scalars["Decimal"]["output"];
  createdAt: Scalars["DateTime"]["output"];
  currency: Scalars["String"]["output"];
  dueDate: Scalars["DateTime"]["output"];
  id: Scalars["ID"]["output"];
  invoiceId: Scalars["String"]["output"];
  invoiceNumber: Scalars["String"]["output"];
  paidAt?: Maybe<Scalars["DateTime"]["output"]>;
  status: Scalars["String"]["output"];
};

export type SubscriptionMetrics = {
  __typename?: "SubscriptionMetrics";
  activeSubscriptions: Scalars["Int"]["output"];
  activeTrials: Scalars["Int"]["output"];
  annualRecurringRevenue: Scalars["Decimal"]["output"];
  annualSubscriptions: Scalars["Int"]["output"];
  averageRevenuePerUser: Scalars["Decimal"]["output"];
  canceledSubscriptions: Scalars["Int"]["output"];
  churnRate: Scalars["Decimal"]["output"];
  growthRate: Scalars["Decimal"]["output"];
  monthlyRecurringRevenue: Scalars["Decimal"]["output"];
  monthlySubscriptions: Scalars["Int"]["output"];
  newSubscriptionsLastMonth: Scalars["Int"]["output"];
  newSubscriptionsThisMonth: Scalars["Int"]["output"];
  pastDueSubscriptions: Scalars["Int"]["output"];
  pausedSubscriptions: Scalars["Int"]["output"];
  quarterlySubscriptions: Scalars["Int"]["output"];
  totalSubscriptions: Scalars["Int"]["output"];
  trialConversionRate: Scalars["Decimal"]["output"];
  trialingSubscriptions: Scalars["Int"]["output"];
};

export type SubscriptionPlan = {
  __typename?: "SubscriptionPlan";
  billingCycle: BillingCycleEnum;
  createdAt: Scalars["DateTime"]["output"];
  currency: Scalars["String"]["output"];
  description?: Maybe<Scalars["String"]["output"]>;
  hasSetupFee: Scalars["Boolean"]["output"];
  hasTrial: Scalars["Boolean"]["output"];
  id: Scalars["ID"]["output"];
  includedUsage: Scalars["JSON"]["output"];
  isActive: Scalars["Boolean"]["output"];
  name: Scalars["String"]["output"];
  overageRates: Scalars["JSON"]["output"];
  planId: Scalars["String"]["output"];
  price: Scalars["Decimal"]["output"];
  productId: Scalars["String"]["output"];
  setupFee?: Maybe<Scalars["Decimal"]["output"]>;
  trialDays?: Maybe<Scalars["Int"]["output"]>;
  updatedAt: Scalars["DateTime"]["output"];
};

export enum SubscriptionStatusEnum {
  Active = "ACTIVE",
  Canceled = "CANCELED",
  Ended = "ENDED",
  Incomplete = "INCOMPLETE",
  PastDue = "PAST_DUE",
  Paused = "PAUSED",
  Trialing = "TRIALING",
}

export type TeamMembership = {
  __typename?: "TeamMembership";
  id: Scalars["ID"]["output"];
  isActive: Scalars["Boolean"]["output"];
  joinedAt?: Maybe<Scalars["DateTime"]["output"]>;
  leftAt?: Maybe<Scalars["DateTime"]["output"]>;
  role: Scalars["String"]["output"];
  teamId: Scalars["ID"]["output"];
  teamName: Scalars["String"]["output"];
};

export type Tenant = {
  __typename?: "Tenant";
  billingCycle: BillingCycleEnum;
  billingEmail?: Maybe<Scalars["String"]["output"]>;
  companySize?: Maybe<Scalars["String"]["output"]>;
  country?: Maybe<Scalars["String"]["output"]>;
  createdAt: Scalars["DateTime"]["output"];
  customMetadata?: Maybe<Scalars["JSON"]["output"]>;
  deletedAt?: Maybe<Scalars["DateTime"]["output"]>;
  domain?: Maybe<Scalars["String"]["output"]>;
  email?: Maybe<Scalars["String"]["output"]>;
  features?: Maybe<Scalars["JSON"]["output"]>;
  id: Scalars["ID"]["output"];
  industry?: Maybe<Scalars["String"]["output"]>;
  invitations: Array<TenantInvitation>;
  isActive: Scalars["Boolean"]["output"];
  isTrial: Scalars["Boolean"]["output"];
  logoUrl?: Maybe<Scalars["String"]["output"]>;
  name: Scalars["String"]["output"];
  phone?: Maybe<Scalars["String"]["output"]>;
  planType: TenantPlanTypeEnum;
  primaryColor?: Maybe<Scalars["String"]["output"]>;
  settings: Array<TenantSetting>;
  settingsJson?: Maybe<Scalars["JSON"]["output"]>;
  slug: Scalars["String"]["output"];
  status: TenantStatusEnum;
  subscriptionEndsAt?: Maybe<Scalars["DateTime"]["output"]>;
  subscriptionStartsAt?: Maybe<Scalars["DateTime"]["output"]>;
  timezone: Scalars["String"]["output"];
  trialEndsAt?: Maybe<Scalars["DateTime"]["output"]>;
  trialExpired: Scalars["Boolean"]["output"];
  updatedAt: Scalars["DateTime"]["output"];
  usageMetrics: TenantUsageMetrics;
  usageRecords: Array<TenantUsageRecord>;
};

export type TenantConnection = {
  __typename?: "TenantConnection";
  hasNextPage: Scalars["Boolean"]["output"];
  hasPrevPage: Scalars["Boolean"]["output"];
  page: Scalars["Int"]["output"];
  pageSize: Scalars["Int"]["output"];
  tenants: Array<Tenant>;
  totalCount: Scalars["Int"]["output"];
};

export type TenantInvitation = {
  __typename?: "TenantInvitation";
  acceptedAt?: Maybe<Scalars["DateTime"]["output"]>;
  createdAt: Scalars["DateTime"]["output"];
  email: Scalars["String"]["output"];
  expiresAt: Scalars["DateTime"]["output"];
  id: Scalars["ID"]["output"];
  invitedBy: Scalars["ID"]["output"];
  isExpired: Scalars["Boolean"]["output"];
  isPending: Scalars["Boolean"]["output"];
  role: Scalars["String"]["output"];
  status: Scalars["String"]["output"];
  tenantId: Scalars["ID"]["output"];
};

export type TenantOverviewMetrics = {
  __typename?: "TenantOverviewMetrics";
  activeTenants: Scalars["Int"]["output"];
  cancelledTenants: Scalars["Int"]["output"];
  churnedTenantsThisMonth: Scalars["Int"]["output"];
  customPlanCount: Scalars["Int"]["output"];
  enterprisePlanCount: Scalars["Int"]["output"];
  freePlanCount: Scalars["Int"]["output"];
  newTenantsThisMonth: Scalars["Int"]["output"];
  professionalPlanCount: Scalars["Int"]["output"];
  starterPlanCount: Scalars["Int"]["output"];
  suspendedTenants: Scalars["Int"]["output"];
  totalApiCalls: Scalars["Int"]["output"];
  totalStorageGb: Scalars["Decimal"]["output"];
  totalTenants: Scalars["Int"]["output"];
  totalUsers: Scalars["Int"]["output"];
  trialTenants: Scalars["Int"]["output"];
};

export enum TenantPlanTypeEnum {
  Custom = "CUSTOM",
  Enterprise = "ENTERPRISE",
  Free = "FREE",
  Professional = "PROFESSIONAL",
  Starter = "STARTER",
}

export type TenantSetting = {
  __typename?: "TenantSetting";
  createdAt: Scalars["DateTime"]["output"];
  description?: Maybe<Scalars["String"]["output"]>;
  id: Scalars["Int"]["output"];
  isEncrypted: Scalars["Boolean"]["output"];
  key: Scalars["String"]["output"];
  tenantId: Scalars["ID"]["output"];
  updatedAt: Scalars["DateTime"]["output"];
  value: Scalars["String"]["output"];
  valueType: Scalars["String"]["output"];
};

export enum TenantStatusEnum {
  Active = "ACTIVE",
  Cancelled = "CANCELLED",
  Inactive = "INACTIVE",
  Pending = "PENDING",
  Suspended = "SUSPENDED",
  Trial = "TRIAL",
}

export type TenantUsageMetrics = {
  __typename?: "TenantUsageMetrics";
  currentApiCalls: Scalars["Int"]["output"];
  currentStorageGb: Scalars["Decimal"]["output"];
  currentUsers: Scalars["Int"]["output"];
  hasExceededApiLimit: Scalars["Boolean"]["output"];
  hasExceededStorageLimit: Scalars["Boolean"]["output"];
  hasExceededUserLimit: Scalars["Boolean"]["output"];
  maxApiCallsPerMonth: Scalars["Int"]["output"];
  maxStorageGb: Scalars["Int"]["output"];
  maxUsers: Scalars["Int"]["output"];
};

export type TenantUsageRecord = {
  __typename?: "TenantUsageRecord";
  activeUsers: Scalars["Int"]["output"];
  apiCalls: Scalars["Int"]["output"];
  bandwidthGb: Scalars["Decimal"]["output"];
  id: Scalars["Int"]["output"];
  metrics: Scalars["JSON"]["output"];
  periodEnd: Scalars["DateTime"]["output"];
  periodStart: Scalars["DateTime"]["output"];
  storageGb: Scalars["Decimal"]["output"];
  tenantId: Scalars["ID"]["output"];
};

export type TrafficStats = {
  __typename?: "TrafficStats";
  currentRateInBps: Scalars["Float"]["output"];
  currentRateInMbps: Scalars["Float"]["output"];
  currentRateOutBps: Scalars["Float"]["output"];
  currentRateOutMbps: Scalars["Float"]["output"];
  deviceId: Scalars["String"]["output"];
  deviceName: Scalars["String"]["output"];
  interfaces: Array<InterfaceStats>;
  peakRateInBps?: Maybe<Scalars["Float"]["output"]>;
  peakRateOutBps?: Maybe<Scalars["Float"]["output"]>;
  peakTimestamp?: Maybe<Scalars["DateTime"]["output"]>;
  timestamp: Scalars["DateTime"]["output"];
  totalBandwidthGbps: Scalars["Float"]["output"];
  totalBytesIn: Scalars["Int"]["output"];
  totalBytesOut: Scalars["Int"]["output"];
  totalPacketsIn: Scalars["Int"]["output"];
  totalPacketsOut: Scalars["Int"]["output"];
};

export type User = {
  __typename?: "User";
  avatarUrl?: Maybe<Scalars["String"]["output"]>;
  bio?: Maybe<Scalars["String"]["output"]>;
  createdAt: Scalars["DateTime"]["output"];
  displayName: Scalars["String"]["output"];
  email: Scalars["String"]["output"];
  failedLoginAttempts: Scalars["Int"]["output"];
  firstName?: Maybe<Scalars["String"]["output"]>;
  fullName?: Maybe<Scalars["String"]["output"]>;
  id: Scalars["ID"]["output"];
  isActive: Scalars["Boolean"]["output"];
  isPlatformAdmin: Scalars["Boolean"]["output"];
  isSuperuser: Scalars["Boolean"]["output"];
  isVerified: Scalars["Boolean"]["output"];
  language?: Maybe<Scalars["String"]["output"]>;
  lastLogin?: Maybe<Scalars["DateTime"]["output"]>;
  lastLoginIp?: Maybe<Scalars["String"]["output"]>;
  lastName?: Maybe<Scalars["String"]["output"]>;
  location?: Maybe<Scalars["String"]["output"]>;
  lockedUntil?: Maybe<Scalars["DateTime"]["output"]>;
  metadata?: Maybe<Scalars["JSON"]["output"]>;
  mfaEnabled: Scalars["Boolean"]["output"];
  permissions: Array<Permission>;
  permissionsLegacy: Array<Scalars["String"]["output"]>;
  phone?: Maybe<Scalars["String"]["output"]>;
  phoneNumber?: Maybe<Scalars["String"]["output"]>;
  phoneVerified: Scalars["Boolean"]["output"];
  primaryRole: Scalars["String"]["output"];
  profileChanges: Array<ProfileChangeRecord>;
  roles: Array<Role>;
  rolesLegacy: Array<Scalars["String"]["output"]>;
  status: UserStatusEnum;
  teams: Array<TeamMembership>;
  tenantId: Scalars["String"]["output"];
  timezone?: Maybe<Scalars["String"]["output"]>;
  updatedAt: Scalars["DateTime"]["output"];
  username: Scalars["String"]["output"];
  website?: Maybe<Scalars["String"]["output"]>;
};

export type UserConnection = {
  __typename?: "UserConnection";
  hasNextPage: Scalars["Boolean"]["output"];
  hasPrevPage: Scalars["Boolean"]["output"];
  page: Scalars["Int"]["output"];
  pageSize: Scalars["Int"]["output"];
  totalCount: Scalars["Int"]["output"];
  users: Array<User>;
};

export type UserOverviewMetrics = {
  __typename?: "UserOverviewMetrics";
  activeUsers: Scalars["Int"]["output"];
  invitedUsers: Scalars["Int"]["output"];
  mfaEnabledUsers: Scalars["Int"]["output"];
  neverLoggedIn: Scalars["Int"]["output"];
  newUsersLastMonth: Scalars["Int"]["output"];
  newUsersThisMonth: Scalars["Int"]["output"];
  platformAdmins: Scalars["Int"]["output"];
  regularUsers: Scalars["Int"]["output"];
  superusers: Scalars["Int"]["output"];
  suspendedUsers: Scalars["Int"]["output"];
  totalUsers: Scalars["Int"]["output"];
  usersLoggedInLast7d: Scalars["Int"]["output"];
  usersLoggedInLast24h: Scalars["Int"]["output"];
  usersLoggedInLast30d: Scalars["Int"]["output"];
  verifiedUsers: Scalars["Int"]["output"];
};

export enum UserStatusEnum {
  Active = "ACTIVE",
  Invited = "INVITED",
  Suspended = "SUSPENDED",
}

export type WirelessClient = {
  __typename?: "WirelessClient";
  accessPointId: Scalars["String"]["output"];
  accessPointName: Scalars["String"]["output"];
  authMethod?: Maybe<Scalars["String"]["output"]>;
  channel: Scalars["Int"]["output"];
  connectedAt: Scalars["DateTime"]["output"];
  connectionType: ClientConnectionType;
  customerId?: Maybe<Scalars["String"]["output"]>;
  customerName?: Maybe<Scalars["String"]["output"]>;
  frequencyBand: FrequencyBand;
  hostname?: Maybe<Scalars["String"]["output"]>;
  id: Scalars["ID"]["output"];
  idleTimeSeconds?: Maybe<Scalars["Int"]["output"]>;
  ipAddress?: Maybe<Scalars["String"]["output"]>;
  isAuthenticated: Scalars["Boolean"]["output"];
  isAuthorized: Scalars["Boolean"]["output"];
  lastSeenAt: Scalars["DateTime"]["output"];
  macAddress: Scalars["String"]["output"];
  manufacturer?: Maybe<Scalars["String"]["output"]>;
  maxPhyRateMbps?: Maybe<Scalars["Float"]["output"]>;
  noiseFloorDbm?: Maybe<Scalars["Float"]["output"]>;
  rxBytes: Scalars["Int"]["output"];
  rxPackets: Scalars["Int"]["output"];
  rxRateMbps?: Maybe<Scalars["Float"]["output"]>;
  rxRetries: Scalars["Int"]["output"];
  signalQuality?: Maybe<SignalQuality>;
  signalStrengthDbm?: Maybe<Scalars["Float"]["output"]>;
  snr?: Maybe<Scalars["Float"]["output"]>;
  ssid: Scalars["String"]["output"];
  supports80211k: Scalars["Boolean"]["output"];
  supports80211r: Scalars["Boolean"]["output"];
  supports80211v: Scalars["Boolean"]["output"];
  txBytes: Scalars["Int"]["output"];
  txPackets: Scalars["Int"]["output"];
  txRateMbps?: Maybe<Scalars["Float"]["output"]>;
  txRetries: Scalars["Int"]["output"];
  uptimeSeconds: Scalars["Int"]["output"];
};

export type WirelessClientConnection = {
  __typename?: "WirelessClientConnection";
  clients: Array<WirelessClient>;
  hasNextPage: Scalars["Boolean"]["output"];
  totalCount: Scalars["Int"]["output"];
};

export type WirelessDashboard = {
  __typename?: "WirelessDashboard";
  averageClientExperienceScore: Scalars["Float"]["output"];
  averageSignalStrengthDbm: Scalars["Float"]["output"];
  clientCountTrend: Array<Scalars["Int"]["output"]>;
  clientsByBand5ghz: Scalars["Int"]["output"];
  clientsByBand6ghz: Scalars["Int"]["output"];
  clientsByBand24ghz: Scalars["Int"]["output"];
  degradedAps: Scalars["Int"]["output"];
  generatedAt: Scalars["DateTime"]["output"];
  offlineAps: Scalars["Int"]["output"];
  offlineEventsCount: Scalars["Int"]["output"];
  onlineAps: Scalars["Int"]["output"];
  sitesWithIssues: Array<WirelessSiteMetrics>;
  throughputTrendMbps: Array<Scalars["Float"]["output"]>;
  topApsByClients: Array<AccessPoint>;
  topApsByThroughput: Array<AccessPoint>;
  totalAccessPoints: Scalars["Int"]["output"];
  totalClients: Scalars["Int"]["output"];
  totalCoverageZones: Scalars["Int"]["output"];
  totalSites: Scalars["Int"]["output"];
  totalThroughputMbps: Scalars["Float"]["output"];
};

export enum WirelessSecurityType {
  Open = "OPEN",
  Wep = "WEP",
  Wpa = "WPA",
  Wpa2 = "WPA2",
  Wpa2Wpa3 = "WPA2_WPA3",
  Wpa3 = "WPA3",
}

export type WirelessSiteMetrics = {
  __typename?: "WirelessSiteMetrics";
  averageSignalStrengthDbm?: Maybe<Scalars["Float"]["output"]>;
  averageSnr?: Maybe<Scalars["Float"]["output"]>;
  capacityUtilizationPercent?: Maybe<Scalars["Float"]["output"]>;
  clientExperienceScore: Scalars["Float"]["output"];
  clients5ghz: Scalars["Int"]["output"];
  clients6ghz: Scalars["Int"]["output"];
  clients24ghz: Scalars["Int"]["output"];
  degradedAps: Scalars["Int"]["output"];
  offlineAps: Scalars["Int"]["output"];
  onlineAps: Scalars["Int"]["output"];
  overallHealthScore: Scalars["Float"]["output"];
  rfHealthScore: Scalars["Float"]["output"];
  siteId: Scalars["String"]["output"];
  siteName: Scalars["String"]["output"];
  totalAps: Scalars["Int"]["output"];
  totalCapacity: Scalars["Int"]["output"];
  totalClients: Scalars["Int"]["output"];
  totalThroughputMbps?: Maybe<Scalars["Float"]["output"]>;
};

/** Workflow execution details */
export type Workflow = {
  __typename?: "Workflow";
  completedAt?: Maybe<Scalars["DateTime"]["output"]>;
  /** Number of completed steps */
  completedStepsCount: Scalars["Int"]["output"];
  /** Workflow duration in seconds */
  durationSeconds?: Maybe<Scalars["Float"]["output"]>;
  errorMessage?: Maybe<Scalars["String"]["output"]>;
  failedAt?: Maybe<Scalars["DateTime"]["output"]>;
  /** Is workflow in terminal state */
  isTerminal: Scalars["Boolean"]["output"];
  retryCount: Scalars["Int"]["output"];
  startedAt?: Maybe<Scalars["DateTime"]["output"]>;
  status: WorkflowStatus;
  steps: Array<WorkflowStep>;
  /** Total number of steps */
  totalStepsCount: Scalars["Int"]["output"];
  workflowId: Scalars["String"]["output"];
  workflowType: WorkflowType;
};

/** Workflow list with pagination */
export type WorkflowConnection = {
  __typename?: "WorkflowConnection";
  hasNextPage: Scalars["Boolean"]["output"];
  totalCount: Scalars["Int"]["output"];
  workflows: Array<Workflow>;
};

/** Workflow filter input */
export type WorkflowFilterInput = {
  limit?: Scalars["Int"]["input"];
  offset?: Scalars["Int"]["input"];
  status?: InputMaybe<WorkflowStatus>;
  workflowType?: InputMaybe<WorkflowType>;
};

/** Workflow statistics */
export type WorkflowStatistics = {
  __typename?: "WorkflowStatistics";
  averageDurationSeconds: Scalars["Float"]["output"];
  /** Workflows by status */
  byStatus: Scalars["String"]["output"];
  /** Workflows by type */
  byType: Scalars["String"]["output"];
  completedWorkflows: Scalars["Int"]["output"];
  failedWorkflows: Scalars["Int"]["output"];
  pendingWorkflows: Scalars["Int"]["output"];
  rolledBackWorkflows: Scalars["Int"]["output"];
  runningWorkflows: Scalars["Int"]["output"];
  successRate: Scalars["Float"]["output"];
  totalCompensations: Scalars["Int"]["output"];
  totalWorkflows: Scalars["Int"]["output"];
};

/** Workflow execution status */
export enum WorkflowStatus {
  Compensated = "COMPENSATED",
  Completed = "COMPLETED",
  Failed = "FAILED",
  Pending = "PENDING",
  RolledBack = "ROLLED_BACK",
  RollingBack = "ROLLING_BACK",
  Running = "RUNNING",
}

/** Workflow step details */
export type WorkflowStep = {
  __typename?: "WorkflowStep";
  completedAt?: Maybe<Scalars["DateTime"]["output"]>;
  errorMessage?: Maybe<Scalars["String"]["output"]>;
  failedAt?: Maybe<Scalars["DateTime"]["output"]>;
  outputData?: Maybe<Scalars["String"]["output"]>;
  retryCount: Scalars["Int"]["output"];
  startedAt?: Maybe<Scalars["DateTime"]["output"]>;
  status: WorkflowStepStatus;
  stepId: Scalars["String"]["output"];
  stepName: Scalars["String"]["output"];
  stepOrder: Scalars["Int"]["output"];
  targetSystem: Scalars["String"]["output"];
};

/** Workflow step status */
export enum WorkflowStepStatus {
  Compensated = "COMPENSATED",
  Compensating = "COMPENSATING",
  CompensationFailed = "COMPENSATION_FAILED",
  Completed = "COMPLETED",
  Failed = "FAILED",
  Pending = "PENDING",
  Running = "RUNNING",
  Skipped = "SKIPPED",
}

/** Workflow type */
export enum WorkflowType {
  ActivateService = "ACTIVATE_SERVICE",
  ChangeServicePlan = "CHANGE_SERVICE_PLAN",
  DeprovisionSubscriber = "DEPROVISION_SUBSCRIBER",
  MigrateSubscriber = "MIGRATE_SUBSCRIBER",
  ProvisionSubscriber = "PROVISION_SUBSCRIBER",
  SuspendService = "SUSPEND_SERVICE",
  TerminateService = "TERMINATE_SERVICE",
  UpdateNetworkConfig = "UPDATE_NETWORK_CONFIG",
}

export type CustomerListQueryVariables = Exact<{
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  offset?: InputMaybe<Scalars["Int"]["input"]>;
  status?: InputMaybe<CustomerStatusEnum>;
  search?: InputMaybe<Scalars["String"]["input"]>;
  includeActivities?: InputMaybe<Scalars["Boolean"]["input"]>;
  includeNotes?: InputMaybe<Scalars["Boolean"]["input"]>;
}>;

export type CustomerListQuery = {
  __typename?: "Query";
  customers: {
    __typename?: "CustomerConnection";
    totalCount: number;
    hasNextPage: boolean;
    customers: Array<{
      __typename?: "Customer";
      id: string;
      customerNumber: string;
      firstName: string;
      lastName: string;
      middleName?: string | null;
      displayName?: string | null;
      companyName?: string | null;
      status: CustomerStatusEnum;
      customerType: CustomerTypeEnum;
      tier: CustomerTierEnum;
      email: string;
      emailVerified: boolean;
      phone?: string | null;
      phoneVerified: boolean;
      mobile?: string | null;
      addressLine1?: string | null;
      addressLine2?: string | null;
      city?: string | null;
      stateProvince?: string | null;
      postalCode?: string | null;
      country?: string | null;
      taxId?: string | null;
      industry?: string | null;
      employeeCount?: number | null;
      lifetimeValue: number;
      totalPurchases: number;
      averageOrderValue: number;
      lastPurchaseDate?: string | null;
      createdAt: string;
      updatedAt: string;
      acquisitionDate: string;
      lastContactDate?: string | null;
      activities?: Array<{
        __typename?: "CustomerActivity";
        id: string;
        customerId: string;
        activityType: ActivityTypeEnum;
        title: string;
        description?: string | null;
        performedBy?: string | null;
        createdAt: string;
      }>;
      notes?: Array<{
        __typename?: "CustomerNote";
        id: string;
        customerId: string;
        subject: string;
        content: string;
        isInternal: boolean;
        createdById?: string | null;
        createdAt: string;
        updatedAt: string;
      }>;
    }>;
  };
};

export type CustomerDetailQueryVariables = Exact<{
  id: Scalars["ID"]["input"];
}>;

export type CustomerDetailQuery = {
  __typename?: "Query";
  customer?: {
    __typename?: "Customer";
    id: string;
    customerNumber: string;
    firstName: string;
    lastName: string;
    middleName?: string | null;
    displayName?: string | null;
    companyName?: string | null;
    status: CustomerStatusEnum;
    customerType: CustomerTypeEnum;
    tier: CustomerTierEnum;
    email: string;
    emailVerified: boolean;
    phone?: string | null;
    phoneVerified: boolean;
    mobile?: string | null;
    addressLine1?: string | null;
    addressLine2?: string | null;
    city?: string | null;
    stateProvince?: string | null;
    postalCode?: string | null;
    country?: string | null;
    taxId?: string | null;
    industry?: string | null;
    employeeCount?: number | null;
    lifetimeValue: number;
    totalPurchases: number;
    averageOrderValue: number;
    lastPurchaseDate?: string | null;
    createdAt: string;
    updatedAt: string;
    acquisitionDate: string;
    lastContactDate?: string | null;
    activities: Array<{
      __typename?: "CustomerActivity";
      id: string;
      customerId: string;
      activityType: ActivityTypeEnum;
      title: string;
      description?: string | null;
      performedBy?: string | null;
      createdAt: string;
    }>;
    notes: Array<{
      __typename?: "CustomerNote";
      id: string;
      customerId: string;
      subject: string;
      content: string;
      isInternal: boolean;
      createdById?: string | null;
      createdAt: string;
      updatedAt: string;
    }>;
  } | null;
};

export type CustomerMetricsQueryVariables = Exact<{ [key: string]: never }>;

export type CustomerMetricsQuery = {
  __typename?: "Query";
  customerMetrics: {
    __typename?: "CustomerMetrics";
    totalCustomers: number;
    activeCustomers: number;
    newCustomers: number;
    churnedCustomers: number;
    totalCustomerValue: number;
    averageCustomerValue: number;
  };
};

export type CustomerActivitiesQueryVariables = Exact<{
  id: Scalars["ID"]["input"];
}>;

export type CustomerActivitiesQuery = {
  __typename?: "Query";
  customer?: {
    __typename?: "Customer";
    id: string;
    activities: Array<{
      __typename?: "CustomerActivity";
      id: string;
      customerId: string;
      activityType: ActivityTypeEnum;
      title: string;
      description?: string | null;
      performedBy?: string | null;
      createdAt: string;
    }>;
  } | null;
};

export type CustomerNotesQueryVariables = Exact<{
  id: Scalars["ID"]["input"];
}>;

export type CustomerNotesQuery = {
  __typename?: "Query";
  customer?: {
    __typename?: "Customer";
    id: string;
    notes: Array<{
      __typename?: "CustomerNote";
      id: string;
      customerId: string;
      subject: string;
      content: string;
      isInternal: boolean;
      createdById?: string | null;
      createdAt: string;
      updatedAt: string;
    }>;
  } | null;
};

export type CustomerDashboardQueryVariables = Exact<{
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  offset?: InputMaybe<Scalars["Int"]["input"]>;
  status?: InputMaybe<CustomerStatusEnum>;
  search?: InputMaybe<Scalars["String"]["input"]>;
}>;

export type CustomerDashboardQuery = {
  __typename?: "Query";
  customers: {
    __typename?: "CustomerConnection";
    totalCount: number;
    hasNextPage: boolean;
    customers: Array<{
      __typename?: "Customer";
      id: string;
      customerNumber: string;
      firstName: string;
      lastName: string;
      companyName?: string | null;
      email: string;
      phone?: string | null;
      status: CustomerStatusEnum;
      customerType: CustomerTypeEnum;
      tier: CustomerTierEnum;
      lifetimeValue: number;
      totalPurchases: number;
      lastContactDate?: string | null;
      createdAt: string;
    }>;
  };
  customerMetrics: {
    __typename?: "CustomerMetrics";
    totalCustomers: number;
    activeCustomers: number;
    newCustomers: number;
    churnedCustomers: number;
    totalCustomerValue: number;
    averageCustomerValue: number;
  };
};

export type CustomerSubscriptionsQueryVariables = Exact<{
  customerId: Scalars["ID"]["input"];
  status?: InputMaybe<Scalars["String"]["input"]>;
  limit?: InputMaybe<Scalars["Int"]["input"]>;
}>;

export type CustomerSubscriptionsQuery = {
  __typename?: "Query";
  customerSubscriptions: Array<{
    __typename?: "Subscription";
    id: string;
    subscriptionId: string;
    customerId: string;
    planId: string;
    tenantId: string;
    currentPeriodStart: string;
    currentPeriodEnd: string;
    status: SubscriptionStatusEnum;
    trialEnd?: string | null;
    isInTrial: boolean;
    cancelAtPeriodEnd: boolean;
    canceledAt?: string | null;
    endedAt?: string | null;
    createdAt: string;
    updatedAt: string;
  }>;
};

export type CustomerNetworkInfoQueryVariables = Exact<{
  customerId: Scalars["ID"]["input"];
}>;

export type CustomerNetworkInfoQuery = {
  __typename?: "Query";
  customerNetworkInfo: any;
};

export type CustomerDevicesQueryVariables = Exact<{
  customerId: Scalars["ID"]["input"];
  deviceType?: InputMaybe<Scalars["String"]["input"]>;
  activeOnly?: InputMaybe<Scalars["Boolean"]["input"]>;
}>;

export type CustomerDevicesQuery = {
  __typename?: "Query";
  customerDevices: any;
};

export type CustomerTicketsQueryVariables = Exact<{
  customerId: Scalars["ID"]["input"];
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  status?: InputMaybe<Scalars["String"]["input"]>;
}>;

export type CustomerTicketsQuery = {
  __typename?: "Query";
  customerTickets: any;
};

export type CustomerBillingQueryVariables = Exact<{
  customerId: Scalars["ID"]["input"];
  includeInvoices?: InputMaybe<Scalars["Boolean"]["input"]>;
  invoiceLimit?: InputMaybe<Scalars["Int"]["input"]>;
}>;

export type CustomerBillingQuery = {
  __typename?: "Query";
  customerBilling: any;
};

export type Customer360ViewQueryVariables = Exact<{
  customerId: Scalars["ID"]["input"];
}>;

export type Customer360ViewQuery = {
  __typename?: "Query";
  customerNetworkInfo: any;
  customerDevices: any;
  customerTickets: any;
  customerBilling: any;
  customer?: {
    __typename?: "Customer";
    id: string;
    customerNumber: string;
    firstName: string;
    lastName: string;
    middleName?: string | null;
    displayName?: string | null;
    companyName?: string | null;
    status: CustomerStatusEnum;
    customerType: CustomerTypeEnum;
    tier: CustomerTierEnum;
    email: string;
    emailVerified: boolean;
    phone?: string | null;
    phoneVerified: boolean;
    mobile?: string | null;
    addressLine1?: string | null;
    addressLine2?: string | null;
    city?: string | null;
    stateProvince?: string | null;
    postalCode?: string | null;
    country?: string | null;
    taxId?: string | null;
    industry?: string | null;
    employeeCount?: number | null;
    lifetimeValue: number;
    totalPurchases: number;
    averageOrderValue: number;
    lastPurchaseDate?: string | null;
    createdAt: string;
    updatedAt: string;
    acquisitionDate: string;
    lastContactDate?: string | null;
    activities: Array<{
      __typename?: "CustomerActivity";
      id: string;
      customerId: string;
      activityType: ActivityTypeEnum;
      title: string;
      description?: string | null;
      performedBy?: string | null;
      createdAt: string;
    }>;
    notes: Array<{
      __typename?: "CustomerNote";
      id: string;
      customerId: string;
      subject: string;
      content: string;
      isInternal: boolean;
      createdById?: string | null;
      createdAt: string;
      updatedAt: string;
    }>;
  } | null;
  customerSubscriptions: Array<{
    __typename?: "Subscription";
    id: string;
    subscriptionId: string;
    customerId: string;
    planId: string;
    status: SubscriptionStatusEnum;
    currentPeriodStart: string;
    currentPeriodEnd: string;
    isInTrial: boolean;
    cancelAtPeriodEnd: boolean;
    createdAt: string;
  }>;
};

export type CustomerNetworkStatusUpdatedSubscriptionVariables = Exact<{
  customerId: Scalars["ID"]["input"];
}>;

export type CustomerNetworkStatusUpdatedSubscription = {
  __typename?: "RealtimeSubscription";
  customerNetworkStatusUpdated: {
    __typename?: "CustomerNetworkStatusUpdate";
    customerId: string;
    connectionStatus: string;
    lastSeenAt: string;
    ipv4Address?: string | null;
    ipv6Address?: string | null;
    macAddress?: string | null;
    vlanId?: number | null;
    signalStrength?: number | null;
    signalQuality?: number | null;
    uptimeSeconds?: number | null;
    uptimePercentage?: number | null;
    bandwidthUsageMbps?: number | null;
    downloadSpeedMbps?: number | null;
    uploadSpeedMbps?: number | null;
    packetLoss?: number | null;
    latencyMs?: number | null;
    jitter?: number | null;
    ontRxPower?: number | null;
    ontTxPower?: number | null;
    oltRxPower?: number | null;
    serviceStatus?: string | null;
    updatedAt: string;
  };
};

export type CustomerDevicesUpdatedSubscriptionVariables = Exact<{
  customerId: Scalars["ID"]["input"];
}>;

export type CustomerDevicesUpdatedSubscription = {
  __typename?: "RealtimeSubscription";
  customerDevicesUpdated: {
    __typename?: "CustomerDeviceUpdate";
    customerId: string;
    deviceId: string;
    deviceType: string;
    deviceName: string;
    status: string;
    healthStatus: string;
    isOnline: boolean;
    lastSeenAt?: string | null;
    signalStrength?: number | null;
    temperature?: number | null;
    cpuUsage?: number | null;
    memoryUsage?: number | null;
    uptimeSeconds?: number | null;
    firmwareVersion?: string | null;
    needsFirmwareUpdate: boolean;
    changeType: string;
    previousValue?: string | null;
    newValue?: string | null;
    updatedAt: string;
  };
};

export type CustomerTicketUpdatedSubscriptionVariables = Exact<{
  customerId: Scalars["ID"]["input"];
}>;

export type CustomerTicketUpdatedSubscription = {
  __typename?: "RealtimeSubscription";
  customerTicketUpdated: {
    __typename?: "CustomerTicketUpdate";
    customerId: string;
    action: string;
    changedBy?: string | null;
    changedByName?: string | null;
    changes?: Array<string> | null;
    comment?: string | null;
    updatedAt: string;
    ticket: {
      __typename?: "CustomerTicketUpdateData";
      id: string;
      ticketNumber: string;
      title: string;
      description?: string | null;
      status: string;
      priority: string;
      category?: string | null;
      subCategory?: string | null;
      assignedTo?: string | null;
      assignedToName?: string | null;
      assignedTeam?: string | null;
      createdAt: string;
      updatedAt: string;
      resolvedAt?: string | null;
      closedAt?: string | null;
      customerId: string;
      customerName?: string | null;
    };
  };
};

export type CustomerActivityAddedSubscriptionVariables = Exact<{
  customerId: Scalars["ID"]["input"];
}>;

export type CustomerActivityAddedSubscription = {
  __typename?: "RealtimeSubscription";
  customerActivityAdded: {
    __typename?: "CustomerActivityUpdate";
    id: string;
    customerId: string;
    activityType: string;
    title: string;
    description?: string | null;
    performedBy?: string | null;
    performedByName?: string | null;
    createdAt: string;
  };
};

export type CustomerNoteUpdatedSubscriptionVariables = Exact<{
  customerId: Scalars["ID"]["input"];
}>;

export type CustomerNoteUpdatedSubscription = {
  __typename?: "RealtimeSubscription";
  customerNoteUpdated: {
    __typename?: "CustomerNoteUpdate";
    customerId: string;
    action: string;
    changedBy: string;
    changedByName?: string | null;
    updatedAt: string;
    note?: {
      __typename?: "CustomerNoteData";
      id: string;
      customerId: string;
      subject: string;
      content: string;
      isInternal: boolean;
      createdById: string;
      createdByName?: string | null;
      createdAt: string;
      updatedAt: string;
    } | null;
  };
};

export type FiberCableListQueryVariables = Exact<{
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  offset?: InputMaybe<Scalars["Int"]["input"]>;
  status?: InputMaybe<FiberCableStatus>;
  fiberType?: InputMaybe<FiberType>;
  installationType?: InputMaybe<CableInstallationType>;
  siteId?: InputMaybe<Scalars["String"]["input"]>;
  search?: InputMaybe<Scalars["String"]["input"]>;
}>;

export type FiberCableListQuery = {
  __typename?: "Query";
  fiberCables: {
    __typename?: "FiberCableConnection";
    totalCount: number;
    hasNextPage: boolean;
    cables: Array<{
      __typename?: "FiberCable";
      id: string;
      cableId: string;
      name: string;
      description?: string | null;
      status: FiberCableStatus;
      isActive: boolean;
      fiberType: FiberType;
      totalStrands: number;
      availableStrands: number;
      usedStrands: number;
      manufacturer?: string | null;
      model?: string | null;
      installationType: CableInstallationType;
      lengthMeters: number;
      startDistributionPointId: string;
      endDistributionPointId: string;
      startPointName?: string | null;
      endPointName?: string | null;
      capacityUtilizationPercent: number;
      bandwidthCapacityGbps?: number | null;
      spliceCount: number;
      totalLossDb?: number | null;
      averageAttenuationDbPerKm?: number | null;
      maxAttenuationDbPerKm?: number | null;
      isLeased: boolean;
      installedAt?: string | null;
      createdAt: string;
      updatedAt: string;
      route: {
        __typename?: "CableRoute";
        totalDistanceMeters: number;
        startPoint: {
          __typename?: "GeoCoordinate";
          latitude: number;
          longitude: number;
          altitude?: number | null;
        };
        endPoint: {
          __typename?: "GeoCoordinate";
          latitude: number;
          longitude: number;
          altitude?: number | null;
        };
      };
    }>;
  };
};

export type FiberCableDetailQueryVariables = Exact<{
  id: Scalars["ID"]["input"];
}>;

export type FiberCableDetailQuery = {
  __typename?: "Query";
  fiberCable?: {
    __typename?: "FiberCable";
    id: string;
    cableId: string;
    name: string;
    description?: string | null;
    status: FiberCableStatus;
    isActive: boolean;
    fiberType: FiberType;
    totalStrands: number;
    availableStrands: number;
    usedStrands: number;
    manufacturer?: string | null;
    model?: string | null;
    installationType: CableInstallationType;
    lengthMeters: number;
    startDistributionPointId: string;
    endDistributionPointId: string;
    startPointName?: string | null;
    endPointName?: string | null;
    capacityUtilizationPercent: number;
    bandwidthCapacityGbps?: number | null;
    splicePointIds: Array<string>;
    spliceCount: number;
    totalLossDb?: number | null;
    averageAttenuationDbPerKm?: number | null;
    maxAttenuationDbPerKm?: number | null;
    conduitId?: string | null;
    ductNumber?: number | null;
    armored: boolean;
    fireRated: boolean;
    ownerId?: string | null;
    ownerName?: string | null;
    isLeased: boolean;
    installedAt?: string | null;
    testedAt?: string | null;
    createdAt: string;
    updatedAt: string;
    route: {
      __typename?: "CableRoute";
      pathGeojson: string;
      totalDistanceMeters: number;
      elevationChangeMeters?: number | null;
      undergroundDistanceMeters?: number | null;
      aerialDistanceMeters?: number | null;
      startPoint: {
        __typename?: "GeoCoordinate";
        latitude: number;
        longitude: number;
        altitude?: number | null;
      };
      endPoint: {
        __typename?: "GeoCoordinate";
        latitude: number;
        longitude: number;
        altitude?: number | null;
      };
      intermediatePoints: Array<{
        __typename?: "GeoCoordinate";
        latitude: number;
        longitude: number;
        altitude?: number | null;
      }>;
    };
    strands: Array<{
      __typename?: "FiberStrand";
      strandId: number;
      colorCode?: string | null;
      isActive: boolean;
      isAvailable: boolean;
      customerId?: string | null;
      customerName?: string | null;
      serviceId?: string | null;
      attenuationDb?: number | null;
      lossDb?: number | null;
      spliceCount: number;
    }>;
  } | null;
};

export type FiberCablesByRouteQueryVariables = Exact<{
  startPointId: Scalars["String"]["input"];
  endPointId: Scalars["String"]["input"];
}>;

export type FiberCablesByRouteQuery = {
  __typename?: "Query";
  fiberCablesByRoute: Array<{
    __typename?: "FiberCable";
    id: string;
    cableId: string;
    name: string;
    status: FiberCableStatus;
    totalStrands: number;
    availableStrands: number;
    lengthMeters: number;
    capacityUtilizationPercent: number;
  }>;
};

export type FiberCablesByDistributionPointQueryVariables = Exact<{
  distributionPointId: Scalars["String"]["input"];
}>;

export type FiberCablesByDistributionPointQuery = {
  __typename?: "Query";
  fiberCablesByDistributionPoint: Array<{
    __typename?: "FiberCable";
    id: string;
    cableId: string;
    name: string;
    status: FiberCableStatus;
    totalStrands: number;
    availableStrands: number;
    lengthMeters: number;
  }>;
};

export type SplicePointListQueryVariables = Exact<{
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  offset?: InputMaybe<Scalars["Int"]["input"]>;
  status?: InputMaybe<SpliceStatus>;
  cableId?: InputMaybe<Scalars["String"]["input"]>;
  distributionPointId?: InputMaybe<Scalars["String"]["input"]>;
}>;

export type SplicePointListQuery = {
  __typename?: "Query";
  splicePoints: {
    __typename?: "SplicePointConnection";
    totalCount: number;
    hasNextPage: boolean;
    splicePoints: Array<{
      __typename?: "SplicePoint";
      id: string;
      spliceId: string;
      cableId: string;
      name: string;
      description?: string | null;
      status: SpliceStatus;
      isActive: boolean;
      closureType?: string | null;
      manufacturer?: string | null;
      model?: string | null;
      trayCount: number;
      trayCapacity: number;
      cablesConnected: Array<string>;
      cableCount: number;
      totalSplices: number;
      activeSplices: number;
      averageSpliceLossDb?: number | null;
      maxSpliceLossDb?: number | null;
      passingSplices: number;
      failingSplices: number;
      accessType: string;
      requiresSpecialAccess: boolean;
      installedAt?: string | null;
      lastTestedAt?: string | null;
      lastMaintainedAt?: string | null;
      createdAt: string;
      updatedAt: string;
      location: {
        __typename?: "GeoCoordinate";
        latitude: number;
        longitude: number;
        altitude?: number | null;
      };
    }>;
  };
};

export type SplicePointDetailQueryVariables = Exact<{
  id: Scalars["ID"]["input"];
}>;

export type SplicePointDetailQuery = {
  __typename?: "Query";
  splicePoint?: {
    __typename?: "SplicePoint";
    id: string;
    spliceId: string;
    name: string;
    description?: string | null;
    status: SpliceStatus;
    isActive: boolean;
    distributionPointId?: string | null;
    closureType?: string | null;
    manufacturer?: string | null;
    model?: string | null;
    trayCount: number;
    trayCapacity: number;
    cablesConnected: Array<string>;
    cableCount: number;
    totalSplices: number;
    activeSplices: number;
    averageSpliceLossDb?: number | null;
    maxSpliceLossDb?: number | null;
    passingSplices: number;
    failingSplices: number;
    accessType: string;
    requiresSpecialAccess: boolean;
    accessNotes?: string | null;
    installedAt?: string | null;
    lastTestedAt?: string | null;
    lastMaintainedAt?: string | null;
    createdAt: string;
    updatedAt: string;
    location: {
      __typename?: "GeoCoordinate";
      latitude: number;
      longitude: number;
      altitude?: number | null;
    };
    address?: {
      __typename?: "Address";
      streetAddress: string;
      city: string;
      stateProvince: string;
      postalCode: string;
      country: string;
    } | null;
    spliceConnections: Array<{
      __typename?: "SpliceConnection";
      cableAId: string;
      cableAStrand: number;
      cableBId: string;
      cableBStrand: number;
      spliceType: SpliceType;
      lossDb?: number | null;
      reflectanceDb?: number | null;
      isPassing: boolean;
      testResult?: string | null;
      testedAt?: string | null;
      testedBy?: string | null;
    }>;
  } | null;
};

export type SplicePointsByCableQueryVariables = Exact<{
  cableId: Scalars["String"]["input"];
}>;

export type SplicePointsByCableQuery = {
  __typename?: "Query";
  splicePointsByCable: Array<{
    __typename?: "SplicePoint";
    id: string;
    spliceId: string;
    cableId: string;
    name: string;
    status: SpliceStatus;
    totalSplices: number;
    activeSplices: number;
    averageSpliceLossDb?: number | null;
    passingSplices: number;
  }>;
};

export type DistributionPointListQueryVariables = Exact<{
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  offset?: InputMaybe<Scalars["Int"]["input"]>;
  pointType?: InputMaybe<DistributionPointType>;
  status?: InputMaybe<FiberCableStatus>;
  siteId?: InputMaybe<Scalars["String"]["input"]>;
  nearCapacity?: InputMaybe<Scalars["Boolean"]["input"]>;
}>;

export type DistributionPointListQuery = {
  __typename?: "Query";
  distributionPoints: {
    __typename?: "DistributionPointConnection";
    totalCount: number;
    hasNextPage: boolean;
    distributionPoints: Array<{
      __typename?: "DistributionPoint";
      id: string;
      siteId: string;
      name: string;
      description?: string | null;
      pointType: DistributionPointType;
      status: FiberCableStatus;
      isActive: boolean;
      manufacturer?: string | null;
      model?: string | null;
      totalCapacity: number;
      availableCapacity: number;
      usedCapacity: number;
      portCount: number;
      incomingCables: Array<string>;
      outgoingCables: Array<string>;
      totalCablesConnected: number;
      splicePointCount: number;
      hasPower: boolean;
      batteryBackup: boolean;
      environmentalMonitoring: boolean;
      temperatureCelsius?: number | null;
      humidityPercent?: number | null;
      capacityUtilizationPercent: number;
      fiberStrandCount: number;
      availableStrandCount: number;
      servesCustomerCount: number;
      accessType: string;
      requiresKey: boolean;
      installedAt?: string | null;
      lastInspectedAt?: string | null;
      lastMaintainedAt?: string | null;
      createdAt: string;
      updatedAt: string;
      location: {
        __typename?: "GeoCoordinate";
        latitude: number;
        longitude: number;
        altitude?: number | null;
      };
    }>;
  };
};

export type DistributionPointDetailQueryVariables = Exact<{
  id: Scalars["ID"]["input"];
}>;

export type DistributionPointDetailQuery = {
  __typename?: "Query";
  distributionPoint?: {
    __typename?: "DistributionPoint";
    id: string;
    siteId: string;
    name: string;
    description?: string | null;
    pointType: DistributionPointType;
    status: FiberCableStatus;
    isActive: boolean;
    siteName?: string | null;
    manufacturer?: string | null;
    model?: string | null;
    totalCapacity: number;
    availableCapacity: number;
    usedCapacity: number;
    portCount: number;
    incomingCables: Array<string>;
    outgoingCables: Array<string>;
    totalCablesConnected: number;
    splicePoints: Array<string>;
    splicePointCount: number;
    hasPower: boolean;
    batteryBackup: boolean;
    environmentalMonitoring: boolean;
    temperatureCelsius?: number | null;
    humidityPercent?: number | null;
    capacityUtilizationPercent: number;
    fiberStrandCount: number;
    availableStrandCount: number;
    serviceAreaIds: Array<string>;
    servesCustomerCount: number;
    accessType: string;
    requiresKey: boolean;
    securityLevel?: string | null;
    accessNotes?: string | null;
    installedAt?: string | null;
    lastInspectedAt?: string | null;
    lastMaintainedAt?: string | null;
    createdAt: string;
    updatedAt: string;
    location: {
      __typename?: "GeoCoordinate";
      latitude: number;
      longitude: number;
      altitude?: number | null;
    };
    address?: {
      __typename?: "Address";
      streetAddress: string;
      city: string;
      stateProvince: string;
      postalCode: string;
      country: string;
    } | null;
    ports: Array<{
      __typename?: "PortAllocation";
      portNumber: number;
      isAllocated: boolean;
      isActive: boolean;
      cableId?: string | null;
      strandId?: number | null;
      customerId?: string | null;
      customerName?: string | null;
      serviceId?: string | null;
    }>;
  } | null;
};

export type DistributionPointsBySiteQueryVariables = Exact<{
  siteId: Scalars["String"]["input"];
}>;

export type DistributionPointsBySiteQuery = {
  __typename?: "Query";
  distributionPointsBySite: Array<{
    __typename?: "DistributionPoint";
    id: string;
    siteId?: string | null;
    name: string;
    pointType: DistributionPointType;
    status: FiberCableStatus;
    totalCapacity: number;
    availableCapacity: number;
    capacityUtilizationPercent: number;
    totalCablesConnected: number;
    servesCustomerCount: number;
  }>;
};

export type ServiceAreaListQueryVariables = Exact<{
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  offset?: InputMaybe<Scalars["Int"]["input"]>;
  areaType?: InputMaybe<ServiceAreaType>;
  isServiceable?: InputMaybe<Scalars["Boolean"]["input"]>;
  constructionStatus?: InputMaybe<Scalars["String"]["input"]>;
}>;

export type ServiceAreaListQuery = {
  __typename?: "Query";
  serviceAreas: {
    __typename?: "ServiceAreaConnection";
    totalCount: number;
    hasNextPage: boolean;
    serviceAreas: Array<{
      __typename?: "ServiceArea";
      id: string;
      areaId: string;
      name: string;
      description?: string | null;
      areaType: ServiceAreaType;
      isActive: boolean;
      isServiceable: boolean;
      boundaryGeojson: string;
      areaSqkm: number;
      city: string;
      stateProvince: string;
      postalCodes: Array<string>;
      streetCount: number;
      homesPassed: number;
      homesConnected: number;
      businessesPassed: number;
      businessesConnected: number;
      penetrationRatePercent?: number | null;
      distributionPointCount: number;
      totalFiberKm: number;
      totalCapacity: number;
      usedCapacity: number;
      availableCapacity: number;
      capacityUtilizationPercent: number;
      maxBandwidthGbps: number;
      estimatedPopulation?: number | null;
      householdDensityPerSqkm?: number | null;
      constructionStatus: string;
      constructionCompletePercent?: number | null;
      targetCompletionDate?: string | null;
      plannedAt?: string | null;
      constructionStartedAt?: string | null;
      activatedAt?: string | null;
      createdAt: string;
      updatedAt: string;
    }>;
  };
};

export type ServiceAreaDetailQueryVariables = Exact<{
  id: Scalars["ID"]["input"];
}>;

export type ServiceAreaDetailQuery = {
  __typename?: "Query";
  serviceArea?: {
    __typename?: "ServiceArea";
    id: string;
    areaId: string;
    name: string;
    description?: string | null;
    areaType: ServiceAreaType;
    isActive: boolean;
    isServiceable: boolean;
    boundaryGeojson: string;
    areaSqkm: number;
    city: string;
    stateProvince: string;
    postalCodes: Array<string>;
    streetCount: number;
    homesPassed: number;
    homesConnected: number;
    businessesPassed: number;
    businessesConnected: number;
    penetrationRatePercent?: number | null;
    distributionPointIds: Array<string>;
    distributionPointCount: number;
    totalFiberKm: number;
    totalCapacity: number;
    usedCapacity: number;
    availableCapacity: number;
    capacityUtilizationPercent: number;
    maxBandwidthGbps: number;
    averageDistanceToDistributionMeters?: number | null;
    estimatedPopulation?: number | null;
    householdDensityPerSqkm?: number | null;
    constructionStatus: string;
    constructionCompletePercent?: number | null;
    targetCompletionDate?: string | null;
    plannedAt?: string | null;
    constructionStartedAt?: string | null;
    activatedAt?: string | null;
    createdAt: string;
    updatedAt: string;
  } | null;
};

export type ServiceAreasByPostalCodeQueryVariables = Exact<{
  postalCode: Scalars["String"]["input"];
}>;

export type ServiceAreasByPostalCodeQuery = {
  __typename?: "Query";
  serviceAreasByPostalCode: Array<{
    __typename?: "ServiceArea";
    id: string;
    areaId: string;
    name: string;
    city: string;
    stateProvince: string;
    isServiceable: boolean;
    postalCodes?: Array<string> | null;
    homesPassed: number;
    homesConnected: number;
    penetrationRatePercent?: number | null;
    maxBandwidthGbps: number;
  }>;
};

export type FiberHealthMetricsQueryVariables = Exact<{
  cableId?: InputMaybe<Scalars["String"]["input"]>;
  healthStatus?: InputMaybe<FiberHealthStatus>;
}>;

export type FiberHealthMetricsQuery = {
  __typename?: "Query";
  fiberHealthMetrics: Array<{
    __typename?: "FiberHealthMetrics";
    cableId: string;
    cableName: string;
    healthStatus: FiberHealthStatus;
    healthScore: number;
    totalLossDb: number;
    averageLossPerKmDb: number;
    maxLossPerKmDb: number;
    reflectanceDb?: number | null;
    averageSpliceLossDb?: number | null;
    maxSpliceLossDb?: number | null;
    failingSplicesCount: number;
    totalStrands: number;
    activeStrands: number;
    degradedStrands: number;
    failedStrands: number;
    lastTestedAt?: string | null;
    testPassRatePercent?: number | null;
    daysSinceLastTest?: number | null;
    activeAlarms: number;
    warningCount: number;
    requiresMaintenance: boolean;
  }>;
};

export type OtdrTestResultsQueryVariables = Exact<{
  cableId: Scalars["String"]["input"];
  strandId?: InputMaybe<Scalars["Int"]["input"]>;
  limit?: InputMaybe<Scalars["Int"]["input"]>;
}>;

export type OtdrTestResultsQuery = {
  __typename?: "Query";
  otdrTestResults: Array<{
    __typename?: "OTDRTestResult";
    testId: string;
    cableId: string;
    strandId: number;
    testedAt: string;
    testedBy: string;
    wavelengthNm: number;
    pulseWidthNs: number;
    totalLossDb: number;
    totalLengthMeters: number;
    averageAttenuationDbPerKm: number;
    spliceCount: number;
    connectorCount: number;
    bendCount: number;
    breakCount: number;
    isPassing: boolean;
    passThresholdDb: number;
    marginDb?: number | null;
    traceFileUrl?: string | null;
  }>;
};

export type FiberNetworkAnalyticsQueryVariables = Exact<{
  [key: string]: never;
}>;

export type FiberNetworkAnalyticsQuery = {
  __typename?: "Query";
  fiberNetworkAnalytics: {
    __typename?: "FiberNetworkAnalytics";
    totalFiberKm: number;
    totalCables: number;
    totalStrands: number;
    totalDistributionPoints: number;
    totalSplicePoints: number;
    totalCapacity: number;
    usedCapacity: number;
    availableCapacity: number;
    capacityUtilizationPercent: number;
    cablesByStatus?: Record<string, any> | null;
    cablesByType?: Record<string, any> | null;
    healthyCables: number;
    degradedCables: number;
    failedCables: number;
    networkHealthScore: number;
    totalServiceAreas: number;
    activeServiceAreas: number;
    homesPassed: number;
    homesConnected: number;
    penetrationRatePercent: number;
    averageCableLossDbPerKm: number;
    averageSpliceLossDb: number;
    cablesDueForTesting: number;
    cablesActive: number;
    cablesInactive: number;
    cablesUnderConstruction: number;
    cablesMaintenance: number;
    cablesWithHighLoss: Array<string>;
    distributionPointsNearCapacity: Array<string>;
    serviceAreasNeedsExpansion: Array<string>;
    generatedAt: string;
  };
};

export type FiberDashboardQueryVariables = Exact<{ [key: string]: never }>;

export type FiberDashboardQuery = {
  __typename?: "Query";
  fiberDashboard: {
    __typename?: "FiberDashboard";
    newConnectionsTrend: Array<number>;
    capacityUtilizationTrend: Array<number>;
    networkHealthTrend: Array<number>;
    generatedAt: string;
    analytics: {
      __typename?: "FiberNetworkAnalytics";
      totalFiberKm: number;
      totalCables: number;
      totalStrands: number;
      totalDistributionPoints: number;
      totalSplicePoints: number;
      capacityUtilizationPercent: number;
      networkHealthScore: number;
      homesPassed: number;
      homesConnected: number;
      penetrationRatePercent: number;
    };
    topCablesByUtilization: Array<{
      __typename?: "FiberCable";
      id: string;
      cableId: string;
      name: string;
      capacityUtilizationPercent: number;
      totalStrands: number;
      usedStrands: number;
    }>;
    topDistributionPointsByCapacity: Array<{
      __typename?: "DistributionPoint";
      id: string;
      name: string;
      capacityUtilizationPercent: number;
      totalCapacity: number;
      usedCapacity: number;
    }>;
    topServiceAreasByPenetration: Array<{
      __typename?: "ServiceArea";
      id: string;
      name: string;
      city: string;
      penetrationRatePercent?: number | null;
      homesPassed: number;
      homesConnected: number;
    }>;
    cablesRequiringAttention: Array<{
      __typename?: "FiberHealthMetrics";
      id: string;
      cableId: string;
      cableName: string;
      healthStatus: FiberHealthStatus;
      healthScore: number;
      requiresMaintenance: boolean;
    }>;
    recentTestResults: Array<{
      __typename?: "OTDRTestResult";
      testId: string;
      cableId: string;
      strandId: number;
      testedAt: string;
      isPassing: boolean;
      totalLossDb: number;
    }>;
    distributionPointsNearCapacity: Array<{
      __typename?: "DistributionPoint";
      id: string;
      name: string;
      capacityUtilizationPercent: number;
    }>;
    serviceAreasExpansionCandidates: Array<{
      __typename?: "ServiceArea";
      id: string;
      name: string;
      penetrationRatePercent?: number | null;
      homesPassed: number;
    }>;
  };
};

export type NetworkOverviewQueryVariables = Exact<{ [key: string]: never }>;

export type NetworkOverviewQuery = {
  __typename?: "Query";
  networkOverview: {
    __typename?: "NetworkOverview";
    totalDevices: number;
    onlineDevices: number;
    offlineDevices: number;
    activeAlerts: number;
    criticalAlerts: number;
    totalBandwidthGbps: number;
    uptimePercentage: number;
    deviceTypeSummary: Array<{
      __typename?: "DeviceTypeSummary";
      deviceType: DeviceTypeEnum;
      totalCount: number;
      onlineCount: number;
      avgCpuUsage?: number | null;
      avgMemoryUsage?: number | null;
    }>;
    recentAlerts: Array<{
      __typename?: "NetworkAlert";
      alertId: string;
      severity: AlertSeverityEnum;
      title: string;
      description: string;
      deviceName?: string | null;
      deviceId?: string | null;
      deviceType?: DeviceTypeEnum | null;
      triggeredAt: string;
      acknowledgedAt?: string | null;
      resolvedAt?: string | null;
      isActive: boolean;
    }>;
  };
};

export type NetworkDeviceListQueryVariables = Exact<{
  page?: InputMaybe<Scalars["Int"]["input"]>;
  pageSize?: InputMaybe<Scalars["Int"]["input"]>;
  deviceType?: InputMaybe<DeviceTypeEnum>;
  status?: InputMaybe<DeviceStatusEnum>;
  search?: InputMaybe<Scalars["String"]["input"]>;
}>;

export type NetworkDeviceListQuery = {
  __typename?: "Query";
  networkDevices: {
    __typename?: "DeviceConnection";
    totalCount: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
    page: number;
    pageSize: number;
    devices: Array<{
      __typename?: "DeviceHealth";
      deviceId: string;
      deviceName: string;
      deviceType: DeviceTypeEnum;
      status: DeviceStatusEnum;
      ipAddress?: string | null;
      firmwareVersion?: string | null;
      model?: string | null;
      location?: string | null;
      tenantId: string;
      cpuUsagePercent?: number | null;
      memoryUsagePercent?: number | null;
      temperatureCelsius?: number | null;
      powerStatus?: string | null;
      pingLatencyMs?: number | null;
      packetLossPercent?: number | null;
      uptimeSeconds?: number | null;
      uptimeDays?: number | null;
      lastSeen?: string | null;
      isHealthy: boolean;
    }>;
  };
};

export type DeviceDetailQueryVariables = Exact<{
  deviceId: Scalars["String"]["input"];
  deviceType: DeviceTypeEnum;
}>;

export type DeviceDetailQuery = {
  __typename?: "Query";
  deviceHealth?: {
    __typename?: "DeviceHealth";
    deviceId: string;
    deviceName: string;
    deviceType: DeviceTypeEnum;
    status: DeviceStatusEnum;
    ipAddress?: string | null;
    firmwareVersion?: string | null;
    model?: string | null;
    location?: string | null;
    tenantId: string;
    cpuUsagePercent?: number | null;
    memoryUsagePercent?: number | null;
    temperatureCelsius?: number | null;
    powerStatus?: string | null;
    pingLatencyMs?: number | null;
    packetLossPercent?: number | null;
    uptimeSeconds?: number | null;
    uptimeDays?: number | null;
    lastSeen?: string | null;
    isHealthy: boolean;
  } | null;
  deviceTraffic?: {
    __typename?: "TrafficStats";
    deviceId: string;
    deviceName: string;
    totalBandwidthGbps: number;
    currentRateInMbps: number;
    currentRateOutMbps: number;
    totalBytesIn: number;
    totalBytesOut: number;
    totalPacketsIn: number;
    totalPacketsOut: number;
    peakRateInBps?: number | null;
    peakRateOutBps?: number | null;
    peakTimestamp?: string | null;
    timestamp: string;
  } | null;
};

export type DeviceTrafficQueryVariables = Exact<{
  deviceId: Scalars["String"]["input"];
  deviceType: DeviceTypeEnum;
  includeInterfaces?: InputMaybe<Scalars["Boolean"]["input"]>;
}>;

export type DeviceTrafficQuery = {
  __typename?: "Query";
  deviceTraffic?: {
    __typename?: "TrafficStats";
    deviceId: string;
    deviceName: string;
    totalBandwidthGbps: number;
    currentRateInMbps: number;
    currentRateOutMbps: number;
    totalBytesIn: number;
    totalBytesOut: number;
    totalPacketsIn: number;
    totalPacketsOut: number;
    peakRateInBps?: number | null;
    peakRateOutBps?: number | null;
    peakTimestamp?: string | null;
    timestamp: string;
    interfaces?: Array<{
      __typename?: "InterfaceStats";
      interfaceName: string;
      status: string;
      rateInBps?: number | null;
      rateOutBps?: number | null;
      bytesIn: number;
      bytesOut: number;
      errorsIn: number;
      errorsOut: number;
      dropsIn: number;
      dropsOut: number;
    }>;
  } | null;
};

export type NetworkAlertListQueryVariables = Exact<{
  page?: InputMaybe<Scalars["Int"]["input"]>;
  pageSize?: InputMaybe<Scalars["Int"]["input"]>;
  severity?: InputMaybe<AlertSeverityEnum>;
  activeOnly?: InputMaybe<Scalars["Boolean"]["input"]>;
  deviceId?: InputMaybe<Scalars["String"]["input"]>;
  deviceType?: InputMaybe<DeviceTypeEnum>;
}>;

export type NetworkAlertListQuery = {
  __typename?: "Query";
  networkAlerts: {
    __typename?: "AlertConnection";
    totalCount: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
    page: number;
    pageSize: number;
    alerts: Array<{
      __typename?: "NetworkAlert";
      alertId: string;
      alertRuleId?: string | null;
      severity: AlertSeverityEnum;
      title: string;
      description: string;
      deviceName?: string | null;
      deviceId?: string | null;
      deviceType?: DeviceTypeEnum | null;
      metricName?: string | null;
      currentValue?: number | null;
      thresholdValue?: number | null;
      triggeredAt: string;
      acknowledgedAt?: string | null;
      resolvedAt?: string | null;
      isActive: boolean;
      isAcknowledged: boolean;
      tenantId: string;
    }>;
  };
};

export type NetworkAlertDetailQueryVariables = Exact<{
  alertId: Scalars["String"]["input"];
}>;

export type NetworkAlertDetailQuery = {
  __typename?: "Query";
  networkAlert?: {
    __typename?: "NetworkAlert";
    alertId: string;
    alertRuleId?: string | null;
    severity: AlertSeverityEnum;
    title: string;
    description: string;
    deviceName?: string | null;
    deviceId?: string | null;
    deviceType?: DeviceTypeEnum | null;
    metricName?: string | null;
    currentValue?: number | null;
    thresholdValue?: number | null;
    triggeredAt: string;
    acknowledgedAt?: string | null;
    resolvedAt?: string | null;
    isActive: boolean;
    isAcknowledged: boolean;
    tenantId: string;
  } | null;
};

export type NetworkDashboardQueryVariables = Exact<{
  devicePage?: InputMaybe<Scalars["Int"]["input"]>;
  devicePageSize?: InputMaybe<Scalars["Int"]["input"]>;
  deviceType?: InputMaybe<DeviceTypeEnum>;
  deviceStatus?: InputMaybe<DeviceStatusEnum>;
  alertPage?: InputMaybe<Scalars["Int"]["input"]>;
  alertPageSize?: InputMaybe<Scalars["Int"]["input"]>;
  alertSeverity?: InputMaybe<AlertSeverityEnum>;
}>;

export type NetworkDashboardQuery = {
  __typename?: "Query";
  networkOverview: {
    __typename?: "NetworkOverview";
    totalDevices: number;
    onlineDevices: number;
    offlineDevices: number;
    activeAlerts: number;
    criticalAlerts: number;
    totalBandwidthGbps: number;
    uptimePercentage: number;
    deviceTypeSummary: Array<{
      __typename?: "DeviceTypeSummary";
      deviceType: DeviceTypeEnum;
      totalCount: number;
      onlineCount: number;
      avgCpuUsage?: number | null;
      avgMemoryUsage?: number | null;
    }>;
    recentAlerts: Array<{
      __typename?: "NetworkAlert";
      alertId: string;
      severity: AlertSeverityEnum;
      title: string;
      deviceName?: string | null;
      triggeredAt: string;
      isActive: boolean;
    }>;
  };
  networkDevices: {
    __typename?: "DeviceConnection";
    totalCount: number;
    hasNextPage: boolean;
    devices: Array<{
      __typename?: "DeviceHealth";
      deviceId: string;
      deviceName: string;
      deviceType: DeviceTypeEnum;
      status: DeviceStatusEnum;
      ipAddress?: string | null;
      cpuUsagePercent?: number | null;
      memoryUsagePercent?: number | null;
      uptimeSeconds?: number | null;
      isHealthy: boolean;
      lastSeen?: string | null;
    }>;
  };
  networkAlerts: {
    __typename?: "AlertConnection";
    totalCount: number;
    hasNextPage: boolean;
    alerts: Array<{
      __typename?: "NetworkAlert";
      alertId: string;
      severity: AlertSeverityEnum;
      title: string;
      description: string;
      deviceName?: string | null;
      deviceType?: DeviceTypeEnum | null;
      triggeredAt: string;
      isActive: boolean;
    }>;
  };
};

export type DeviceUpdatesSubscriptionVariables = Exact<{
  deviceType?: InputMaybe<DeviceTypeEnum>;
  status?: InputMaybe<DeviceStatusEnum>;
}>;

export type DeviceUpdatesSubscription = {
  __typename?: "RealtimeSubscription";
  deviceUpdated: {
    __typename?: "DeviceUpdate";
    deviceId: string;
    deviceName: string;
    deviceType: DeviceTypeEnum;
    status: DeviceStatusEnum;
    ipAddress?: string | null;
    firmwareVersion?: string | null;
    model?: string | null;
    location?: string | null;
    tenantId: string;
    cpuUsagePercent?: number | null;
    memoryUsagePercent?: number | null;
    temperatureCelsius?: number | null;
    powerStatus?: string | null;
    pingLatencyMs?: number | null;
    packetLossPercent?: number | null;
    uptimeSeconds?: number | null;
    uptimeDays?: number | null;
    lastSeen?: string | null;
    isHealthy: boolean;
    changeType: string;
    previousValue?: string | null;
    newValue?: string | null;
    updatedAt: string;
  };
};

export type NetworkAlertUpdatesSubscriptionVariables = Exact<{
  severity?: InputMaybe<AlertSeverityEnum>;
  deviceId?: InputMaybe<Scalars["String"]["input"]>;
}>;

export type NetworkAlertUpdatesSubscription = {
  __typename?: "RealtimeSubscription";
  networkAlertUpdated: {
    __typename?: "NetworkAlertUpdate";
    action: string;
    updatedAt: string;
    alert: {
      __typename?: "NetworkAlert";
      alertId: string;
      alertRuleId?: string | null;
      severity: AlertSeverityEnum;
      title: string;
      description: string;
      deviceName?: string | null;
      deviceId?: string | null;
      deviceType?: DeviceTypeEnum | null;
      metricName?: string | null;
      currentValue?: number | null;
      thresholdValue?: number | null;
      triggeredAt: string;
      acknowledgedAt?: string | null;
      resolvedAt?: string | null;
      isActive: boolean;
      isAcknowledged: boolean;
      tenantId: string;
    };
  };
};

export type SubscriberDashboardQueryVariables = Exact<{
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  search?: InputMaybe<Scalars["String"]["input"]>;
}>;

export type SubscriberDashboardQuery = {
  __typename?: "Query";
  subscribers: Array<{
    __typename?: "Subscriber";
    id: number;
    subscriberId: string;
    username: string;
    enabled: boolean;
    framedIpAddress?: string | null;
    bandwidthProfileId?: string | null;
    createdAt: string;
    updatedAt: string;
    sessions: Array<{
      __typename?: "Session";
      radacctid: number;
      username: string;
      nasipaddress: string;
      acctsessionid: string;
      acctsessiontime?: number | null;
      acctinputoctets?: number | null;
      acctoutputoctets?: number | null;
      acctstarttime?: string | null;
    }>;
  }>;
  subscriberMetrics: {
    __typename?: "SubscriberMetrics";
    totalCount: number;
    enabledCount: number;
    disabledCount: number;
    activeSessionsCount: number;
    totalDataUsageMb: number;
  };
};

export type SubscriberQueryVariables = Exact<{
  username: Scalars["String"]["input"];
}>;

export type SubscriberQuery = {
  __typename?: "Query";
  subscribers: Array<{
    __typename?: "Subscriber";
    id: number;
    subscriberId: string;
    username: string;
    enabled: boolean;
    framedIpAddress?: string | null;
    bandwidthProfileId?: string | null;
    createdAt: string;
    updatedAt: string;
    sessions: Array<{
      __typename?: "Session";
      radacctid: number;
      username: string;
      nasipaddress: string;
      acctsessionid: string;
      acctsessiontime?: number | null;
      acctinputoctets?: number | null;
      acctoutputoctets?: number | null;
      acctstarttime?: string | null;
      acctstoptime?: string | null;
    }>;
  }>;
};

export type ActiveSessionsQueryVariables = Exact<{
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  username?: InputMaybe<Scalars["String"]["input"]>;
}>;

export type ActiveSessionsQuery = {
  __typename?: "Query";
  sessions: Array<{
    __typename?: "Session";
    radacctid: number;
    username: string;
    nasipaddress: string;
    acctsessionid: string;
    acctsessiontime?: number | null;
    acctinputoctets?: number | null;
    acctoutputoctets?: number | null;
    acctstarttime?: string | null;
  }>;
};

export type SubscriberMetricsQueryVariables = Exact<{ [key: string]: never }>;

export type SubscriberMetricsQuery = {
  __typename?: "Query";
  subscriberMetrics: {
    __typename?: "SubscriberMetrics";
    totalCount: number;
    enabledCount: number;
    disabledCount: number;
    activeSessionsCount: number;
    totalDataUsageMb: number;
  };
};

export type SubscriptionListQueryVariables = Exact<{
  page?: InputMaybe<Scalars["Int"]["input"]>;
  pageSize?: InputMaybe<Scalars["Int"]["input"]>;
  status?: InputMaybe<SubscriptionStatusEnum>;
  billingCycle?: InputMaybe<BillingCycleEnum>;
  search?: InputMaybe<Scalars["String"]["input"]>;
  includeCustomer?: InputMaybe<Scalars["Boolean"]["input"]>;
  includePlan?: InputMaybe<Scalars["Boolean"]["input"]>;
  includeInvoices?: InputMaybe<Scalars["Boolean"]["input"]>;
}>;

export type SubscriptionListQuery = {
  __typename?: "Query";
  subscriptions: {
    __typename?: "SubscriptionConnection";
    totalCount: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
    page: number;
    pageSize: number;
    subscriptions: Array<{
      __typename?: "Subscription";
      id: string;
      subscriptionId: string;
      customerId: string;
      planId: string;
      tenantId: string;
      currentPeriodStart: string;
      currentPeriodEnd: string;
      status: SubscriptionStatusEnum;
      trialEnd?: string | null;
      isInTrial: boolean;
      cancelAtPeriodEnd: boolean;
      canceledAt?: string | null;
      endedAt?: string | null;
      customPrice?: number | null;
      usageRecords: any;
      createdAt: string;
      updatedAt: string;
      isActive: boolean;
      daysUntilRenewal: number;
      isPastDue: boolean;
      customer?: {
        __typename?: "SubscriptionCustomer";
        id: string;
        customerId: string;
        name?: string | null;
        email: string;
        phone?: string | null;
        createdAt: string;
      } | null;
      plan?: {
        __typename?: "SubscriptionPlan";
        id: string;
        planId: string;
        productId: string;
        name: string;
        description?: string | null;
        billingCycle: BillingCycleEnum;
        price: number;
        currency: string;
        setupFee?: number | null;
        trialDays?: number | null;
        isActive: boolean;
        hasTrial: boolean;
        hasSetupFee: boolean;
        includedUsage: any;
        overageRates: any;
        createdAt: string;
        updatedAt: string;
      } | null;
      recentInvoices?: Array<{
        __typename?: "SubscriptionInvoice";
        id: string;
        invoiceId: string;
        invoiceNumber: string;
        amount: number;
        currency: string;
        status: string;
        dueDate: string;
        paidAt?: string | null;
        createdAt: string;
      }>;
    }>;
  };
};

export type SubscriptionDetailQueryVariables = Exact<{
  id: Scalars["ID"]["input"];
}>;

export type SubscriptionDetailQuery = {
  __typename?: "Query";
  subscription?: {
    __typename?: "Subscription";
    id: string;
    subscriptionId: string;
    customerId: string;
    planId: string;
    tenantId: string;
    currentPeriodStart: string;
    currentPeriodEnd: string;
    status: SubscriptionStatusEnum;
    trialEnd?: string | null;
    isInTrial: boolean;
    cancelAtPeriodEnd: boolean;
    canceledAt?: string | null;
    endedAt?: string | null;
    customPrice?: number | null;
    usageRecords: any;
    createdAt: string;
    updatedAt: string;
    isActive: boolean;
    daysUntilRenewal: number;
    isPastDue: boolean;
    customer?: {
      __typename?: "SubscriptionCustomer";
      id: string;
      customerId: string;
      name?: string | null;
      email: string;
      phone?: string | null;
      createdAt: string;
    } | null;
    plan?: {
      __typename?: "SubscriptionPlan";
      id: string;
      planId: string;
      productId: string;
      name: string;
      description?: string | null;
      billingCycle: BillingCycleEnum;
      price: number;
      currency: string;
      setupFee?: number | null;
      trialDays?: number | null;
      isActive: boolean;
      hasTrial: boolean;
      hasSetupFee: boolean;
      includedUsage: any;
      overageRates: any;
      createdAt: string;
      updatedAt: string;
    } | null;
    recentInvoices: Array<{
      __typename?: "SubscriptionInvoice";
      id: string;
      invoiceId: string;
      invoiceNumber: string;
      amount: number;
      currency: string;
      status: string;
      dueDate: string;
      paidAt?: string | null;
      createdAt: string;
    }>;
  } | null;
};

export type SubscriptionMetricsQueryVariables = Exact<{ [key: string]: never }>;

export type SubscriptionMetricsQuery = {
  __typename?: "Query";
  subscriptionMetrics: {
    __typename?: "SubscriptionMetrics";
    totalSubscriptions: number;
    activeSubscriptions: number;
    trialingSubscriptions: number;
    pastDueSubscriptions: number;
    canceledSubscriptions: number;
    pausedSubscriptions: number;
    monthlyRecurringRevenue: number;
    annualRecurringRevenue: number;
    averageRevenuePerUser: number;
    newSubscriptionsThisMonth: number;
    newSubscriptionsLastMonth: number;
    churnRate: number;
    growthRate: number;
    monthlySubscriptions: number;
    quarterlySubscriptions: number;
    annualSubscriptions: number;
    trialConversionRate: number;
    activeTrials: number;
  };
};

export type PlanListQueryVariables = Exact<{
  page?: InputMaybe<Scalars["Int"]["input"]>;
  pageSize?: InputMaybe<Scalars["Int"]["input"]>;
  isActive?: InputMaybe<Scalars["Boolean"]["input"]>;
  billingCycle?: InputMaybe<BillingCycleEnum>;
}>;

export type PlanListQuery = {
  __typename?: "Query";
  plans: {
    __typename?: "PlanConnection";
    totalCount: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
    page: number;
    pageSize: number;
    plans: Array<{
      __typename?: "SubscriptionPlan";
      id: string;
      planId: string;
      productId: string;
      name: string;
      description?: string | null;
      billingCycle: BillingCycleEnum;
      price: number;
      currency: string;
      setupFee?: number | null;
      trialDays?: number | null;
      isActive: boolean;
      createdAt: string;
      updatedAt: string;
      hasTrial: boolean;
      hasSetupFee: boolean;
      includedUsage: any;
      overageRates: any;
    }>;
  };
};

export type ProductListQueryVariables = Exact<{
  page?: InputMaybe<Scalars["Int"]["input"]>;
  pageSize?: InputMaybe<Scalars["Int"]["input"]>;
  isActive?: InputMaybe<Scalars["Boolean"]["input"]>;
  category?: InputMaybe<Scalars["String"]["input"]>;
}>;

export type ProductListQuery = {
  __typename?: "Query";
  products: {
    __typename?: "ProductConnection";
    totalCount: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
    page: number;
    pageSize: number;
    products: Array<{
      __typename?: "Product";
      id: string;
      productId: string;
      sku: string;
      name: string;
      description?: string | null;
      category: string;
      productType: ProductTypeEnum;
      basePrice: number;
      currency: string;
      isActive: boolean;
      createdAt: string;
      updatedAt: string;
    }>;
  };
};

export type SubscriptionDashboardQueryVariables = Exact<{
  page?: InputMaybe<Scalars["Int"]["input"]>;
  pageSize?: InputMaybe<Scalars["Int"]["input"]>;
  status?: InputMaybe<SubscriptionStatusEnum>;
  search?: InputMaybe<Scalars["String"]["input"]>;
}>;

export type SubscriptionDashboardQuery = {
  __typename?: "Query";
  subscriptions: {
    __typename?: "SubscriptionConnection";
    totalCount: number;
    hasNextPage: boolean;
    subscriptions: Array<{
      __typename?: "Subscription";
      id: string;
      subscriptionId: string;
      status: SubscriptionStatusEnum;
      currentPeriodStart: string;
      currentPeriodEnd: string;
      isActive: boolean;
      isInTrial: boolean;
      cancelAtPeriodEnd: boolean;
      createdAt: string;
      customer?: {
        __typename?: "SubscriptionCustomer";
        id: string;
        name?: string | null;
        email: string;
      } | null;
      plan?: {
        __typename?: "SubscriptionPlan";
        id: string;
        name: string;
        price: number;
        currency: string;
        billingCycle: BillingCycleEnum;
      } | null;
    }>;
  };
  subscriptionMetrics: {
    __typename?: "SubscriptionMetrics";
    totalSubscriptions: number;
    activeSubscriptions: number;
    trialingSubscriptions: number;
    pastDueSubscriptions: number;
    monthlyRecurringRevenue: number;
    annualRecurringRevenue: number;
    averageRevenuePerUser: number;
    newSubscriptionsThisMonth: number;
    churnRate: number;
    growthRate: number;
  };
};

export type UserListQueryVariables = Exact<{
  page?: InputMaybe<Scalars["Int"]["input"]>;
  pageSize?: InputMaybe<Scalars["Int"]["input"]>;
  isActive?: InputMaybe<Scalars["Boolean"]["input"]>;
  isVerified?: InputMaybe<Scalars["Boolean"]["input"]>;
  isSuperuser?: InputMaybe<Scalars["Boolean"]["input"]>;
  isPlatformAdmin?: InputMaybe<Scalars["Boolean"]["input"]>;
  search?: InputMaybe<Scalars["String"]["input"]>;
  includeMetadata?: InputMaybe<Scalars["Boolean"]["input"]>;
  includeRoles?: InputMaybe<Scalars["Boolean"]["input"]>;
  includePermissions?: InputMaybe<Scalars["Boolean"]["input"]>;
  includeTeams?: InputMaybe<Scalars["Boolean"]["input"]>;
}>;

export type UserListQuery = {
  __typename?: "Query";
  users: {
    __typename?: "UserConnection";
    totalCount: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
    page: number;
    pageSize: number;
    users: Array<{
      __typename?: "User";
      id: string;
      username: string;
      email: string;
      fullName?: string | null;
      firstName?: string | null;
      lastName?: string | null;
      displayName: string;
      isActive: boolean;
      isVerified: boolean;
      isSuperuser: boolean;
      isPlatformAdmin: boolean;
      status: UserStatusEnum;
      phoneNumber?: string | null;
      phone?: string | null;
      phoneVerified: boolean;
      avatarUrl?: string | null;
      timezone?: string | null;
      location?: string | null;
      bio?: string | null;
      website?: string | null;
      mfaEnabled: boolean;
      lastLogin?: string | null;
      lastLoginIp?: string | null;
      failedLoginAttempts: number;
      lockedUntil?: string | null;
      language?: string | null;
      tenantId: string;
      primaryRole: string;
      createdAt: string;
      updatedAt: string;
      metadata?: any | null;
      roles?: Array<{
        __typename?: "Role";
        id: string;
        name: string;
        displayName: string;
        description?: string | null;
        priority: number;
        isSystem: boolean;
        isActive: boolean;
        isDefault: boolean;
        createdAt: string;
        updatedAt: string;
      }>;
      permissions?: Array<{
        __typename?: "Permission";
        id: string;
        name: string;
        displayName: string;
        description?: string | null;
        category: PermissionCategoryEnum;
        isActive: boolean;
        isSystem: boolean;
        createdAt: string;
        updatedAt: string;
      }>;
      teams?: Array<{
        __typename?: "TeamMembership";
        teamId: string;
        teamName: string;
        role: string;
        joinedAt?: string | null;
      }>;
    }>;
  };
};

export type UserDetailQueryVariables = Exact<{
  id: Scalars["ID"]["input"];
}>;

export type UserDetailQuery = {
  __typename?: "Query";
  user?: {
    __typename?: "User";
    id: string;
    username: string;
    email: string;
    fullName?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    displayName: string;
    isActive: boolean;
    isVerified: boolean;
    isSuperuser: boolean;
    isPlatformAdmin: boolean;
    status: UserStatusEnum;
    phoneNumber?: string | null;
    phone?: string | null;
    phoneVerified: boolean;
    avatarUrl?: string | null;
    timezone?: string | null;
    location?: string | null;
    bio?: string | null;
    website?: string | null;
    mfaEnabled: boolean;
    lastLogin?: string | null;
    lastLoginIp?: string | null;
    failedLoginAttempts: number;
    lockedUntil?: string | null;
    language?: string | null;
    tenantId: string;
    primaryRole: string;
    createdAt: string;
    updatedAt: string;
    metadata?: any | null;
    roles: Array<{
      __typename?: "Role";
      id: string;
      name: string;
      displayName: string;
      description?: string | null;
      priority: number;
      isSystem: boolean;
      isActive: boolean;
      isDefault: boolean;
      createdAt: string;
      updatedAt: string;
    }>;
    permissions: Array<{
      __typename?: "Permission";
      id: string;
      name: string;
      displayName: string;
      description?: string | null;
      category: PermissionCategoryEnum;
      isActive: boolean;
      isSystem: boolean;
      createdAt: string;
      updatedAt: string;
    }>;
    teams: Array<{
      __typename?: "TeamMembership";
      teamId: string;
      teamName: string;
      role: string;
      joinedAt?: string | null;
    }>;
    profileChanges: Array<{
      __typename?: "ProfileChangeRecord";
      id: string;
      fieldName: string;
      oldValue?: string | null;
      newValue?: string | null;
      createdAt: string;
      changedByUsername?: string | null;
    }>;
  } | null;
};

export type UserMetricsQueryVariables = Exact<{ [key: string]: never }>;

export type UserMetricsQuery = {
  __typename?: "Query";
  userMetrics: {
    __typename?: "UserOverviewMetrics";
    totalUsers: number;
    activeUsers: number;
    suspendedUsers: number;
    invitedUsers: number;
    verifiedUsers: number;
    mfaEnabledUsers: number;
    platformAdmins: number;
    superusers: number;
    regularUsers: number;
    usersLoggedInLast24h: number;
    usersLoggedInLast7d: number;
    usersLoggedInLast30d: number;
    neverLoggedIn: number;
    newUsersThisMonth: number;
    newUsersLastMonth: number;
  };
};

export type RoleListQueryVariables = Exact<{
  page?: InputMaybe<Scalars["Int"]["input"]>;
  pageSize?: InputMaybe<Scalars["Int"]["input"]>;
  isActive?: InputMaybe<Scalars["Boolean"]["input"]>;
  isSystem?: InputMaybe<Scalars["Boolean"]["input"]>;
  search?: InputMaybe<Scalars["String"]["input"]>;
}>;

export type RoleListQuery = {
  __typename?: "Query";
  roles: {
    __typename?: "RoleConnection";
    totalCount: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
    page: number;
    pageSize: number;
    roles: Array<{
      __typename?: "Role";
      id: string;
      name: string;
      displayName: string;
      description?: string | null;
      priority: number;
      isSystem: boolean;
      isActive: boolean;
      isDefault: boolean;
      createdAt: string;
      updatedAt: string;
    }>;
  };
};

export type PermissionsByCategoryQueryVariables = Exact<{
  category?: InputMaybe<PermissionCategoryEnum>;
}>;

export type PermissionsByCategoryQuery = {
  __typename?: "Query";
  permissionsByCategory: Array<{
    __typename?: "PermissionsByCategory";
    category: PermissionCategoryEnum;
    count: number;
    permissions: Array<{
      __typename?: "Permission";
      id: string;
      name: string;
      displayName: string;
      description?: string | null;
      category: PermissionCategoryEnum;
      isActive: boolean;
      isSystem: boolean;
      createdAt: string;
      updatedAt: string;
    }>;
  }>;
};

export type UserDashboardQueryVariables = Exact<{
  page?: InputMaybe<Scalars["Int"]["input"]>;
  pageSize?: InputMaybe<Scalars["Int"]["input"]>;
  isActive?: InputMaybe<Scalars["Boolean"]["input"]>;
  search?: InputMaybe<Scalars["String"]["input"]>;
}>;

export type UserDashboardQuery = {
  __typename?: "Query";
  users: {
    __typename?: "UserConnection";
    totalCount: number;
    hasNextPage: boolean;
    users: Array<{
      __typename?: "User";
      id: string;
      username: string;
      email: string;
      fullName?: string | null;
      isActive: boolean;
      isVerified: boolean;
      isSuperuser: boolean;
      lastLogin?: string | null;
      createdAt: string;
      roles: Array<{
        __typename?: "Role";
        id: string;
        name: string;
        displayName: string;
      }>;
    }>;
  };
  userMetrics: {
    __typename?: "UserOverviewMetrics";
    totalUsers: number;
    activeUsers: number;
    suspendedUsers: number;
    verifiedUsers: number;
    mfaEnabledUsers: number;
    platformAdmins: number;
    superusers: number;
    regularUsers: number;
    usersLoggedInLast24h: number;
    usersLoggedInLast7d: number;
    newUsersThisMonth: number;
  };
};

export type UserRolesQueryVariables = Exact<{
  id: Scalars["ID"]["input"];
}>;

export type UserRolesQuery = {
  __typename?: "Query";
  user?: {
    __typename?: "User";
    id: string;
    username: string;
    roles: Array<{
      __typename?: "Role";
      id: string;
      name: string;
      displayName: string;
      description?: string | null;
      priority: number;
      isSystem: boolean;
      isActive: boolean;
      createdAt: string;
    }>;
  } | null;
};

export type UserPermissionsQueryVariables = Exact<{
  id: Scalars["ID"]["input"];
}>;

export type UserPermissionsQuery = {
  __typename?: "Query";
  user?: {
    __typename?: "User";
    id: string;
    username: string;
    permissions: Array<{
      __typename?: "Permission";
      id: string;
      name: string;
      displayName: string;
      description?: string | null;
      category: PermissionCategoryEnum;
      isActive: boolean;
    }>;
  } | null;
};

export type UserTeamsQueryVariables = Exact<{
  id: Scalars["ID"]["input"];
}>;

export type UserTeamsQuery = {
  __typename?: "Query";
  user?: {
    __typename?: "User";
    id: string;
    username: string;
    teams: Array<{
      __typename?: "TeamMembership";
      teamId: string;
      teamName: string;
      role: string;
      joinedAt?: string | null;
    }>;
  } | null;
};

export type AccessPointListQueryVariables = Exact<{
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  offset?: InputMaybe<Scalars["Int"]["input"]>;
  siteId?: InputMaybe<Scalars["String"]["input"]>;
  status?: InputMaybe<AccessPointStatus>;
  frequencyBand?: InputMaybe<FrequencyBand>;
  search?: InputMaybe<Scalars["String"]["input"]>;
}>;

export type AccessPointListQuery = {
  __typename?: "Query";
  accessPoints: {
    __typename?: "AccessPointConnection";
    totalCount: number;
    hasNextPage: boolean;
    accessPoints: Array<{
      __typename?: "AccessPoint";
      id: string;
      name: string;
      macAddress: string;
      ipAddress?: string | null;
      serialNumber?: string | null;
      status: AccessPointStatus;
      isOnline: boolean;
      lastSeenAt?: string | null;
      model?: string | null;
      manufacturer?: string | null;
      firmwareVersion?: string | null;
      ssid: string;
      frequencyBand: FrequencyBand;
      channel: number;
      channelWidth: number;
      transmitPower: number;
      maxClients?: number | null;
      securityType: WirelessSecurityType;
      siteId?: string | null;
      controllerName?: string | null;
      siteName?: string | null;
      createdAt: string;
      updatedAt: string;
      lastRebootAt?: string | null;
      location?: {
        __typename?: "InstallationLocation";
        siteName: string;
        building?: string | null;
        floor?: string | null;
        room?: string | null;
        mountingType?: string | null;
        coordinates?: {
          __typename?: "GeoLocation";
          latitude: number;
          longitude: number;
          altitude?: number | null;
        } | null;
      } | null;
      rfMetrics?: {
        __typename?: "RFMetrics";
        signalStrengthDbm?: number | null;
        noiseFloorDbm?: number | null;
        signalToNoiseRatio?: number | null;
        channelUtilizationPercent?: number | null;
        interferenceLevel?: number | null;
        txPowerDbm?: number | null;
        rxPowerDbm?: number | null;
      } | null;
      performance?: {
        __typename?: "APPerformanceMetrics";
        txBytes: number;
        rxBytes: number;
        txPackets: number;
        rxPackets: number;
        txRateMbps?: number | null;
        rxRateMbps?: number | null;
        txErrors: number;
        rxErrors: number;
        connectedClients: number;
        cpuUsagePercent?: number | null;
        memoryUsagePercent?: number | null;
        uptimeSeconds?: number | null;
      } | null;
    }>;
  };
};

export type AccessPointDetailQueryVariables = Exact<{
  id: Scalars["ID"]["input"];
}>;

export type AccessPointDetailQuery = {
  __typename?: "Query";
  accessPoint?: {
    __typename?: "AccessPoint";
    id: string;
    name: string;
    macAddress: string;
    ipAddress?: string | null;
    serialNumber?: string | null;
    status: AccessPointStatus;
    isOnline: boolean;
    lastSeenAt?: string | null;
    model?: string | null;
    manufacturer?: string | null;
    firmwareVersion?: string | null;
    hardwareRevision?: string | null;
    ssid: string;
    frequencyBand: FrequencyBand;
    channel: number;
    channelWidth: number;
    transmitPower: number;
    maxClients?: number | null;
    securityType: WirelessSecurityType;
    controllerId?: string | null;
    controllerName?: string | null;
    siteId?: string | null;
    siteName?: string | null;
    createdAt: string;
    updatedAt: string;
    lastRebootAt?: string | null;
    isMeshEnabled: boolean;
    isBandSteeringEnabled: boolean;
    isLoadBalancingEnabled: boolean;
    location?: {
      __typename?: "InstallationLocation";
      siteName: string;
      building?: string | null;
      floor?: string | null;
      room?: string | null;
      mountingType?: string | null;
      coordinates?: {
        __typename?: "GeoLocation";
        latitude: number;
        longitude: number;
        altitude?: number | null;
        accuracy?: number | null;
      } | null;
    } | null;
    rfMetrics?: {
      __typename?: "RFMetrics";
      signalStrengthDbm?: number | null;
      noiseFloorDbm?: number | null;
      signalToNoiseRatio?: number | null;
      channelUtilizationPercent?: number | null;
      interferenceLevel?: number | null;
      txPowerDbm?: number | null;
      rxPowerDbm?: number | null;
    } | null;
    performance?: {
      __typename?: "APPerformanceMetrics";
      txBytes: number;
      rxBytes: number;
      txPackets: number;
      rxPackets: number;
      txRateMbps?: number | null;
      rxRateMbps?: number | null;
      txErrors: number;
      rxErrors: number;
      txDropped: number;
      rxDropped: number;
      retries: number;
      retryRatePercent?: number | null;
      connectedClients: number;
      authenticatedClients: number;
      authorizedClients: number;
      cpuUsagePercent?: number | null;
      memoryUsagePercent?: number | null;
      uptimeSeconds?: number | null;
    } | null;
  } | null;
};

export type AccessPointsBySiteQueryVariables = Exact<{
  siteId: Scalars["String"]["input"];
}>;

export type AccessPointsBySiteQuery = {
  __typename?: "Query";
  accessPointsBySite: Array<{
    __typename?: "AccessPoint";
    id: string;
    name: string;
    macAddress: string;
    ipAddress?: string | null;
    status: AccessPointStatus;
    isOnline: boolean;
    ssid: string;
    frequencyBand: FrequencyBand;
    channel: number;
    siteId?: string | null;
    siteName?: string | null;
    performance?: {
      __typename?: "APPerformanceMetrics";
      connectedClients: number;
      cpuUsagePercent?: number | null;
      memoryUsagePercent?: number | null;
    } | null;
    rfMetrics?: {
      __typename?: "RFMetrics";
      signalStrengthDbm?: number | null;
      channelUtilizationPercent?: number | null;
    } | null;
  }>;
};

export type WirelessClientListQueryVariables = Exact<{
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  offset?: InputMaybe<Scalars["Int"]["input"]>;
  accessPointId?: InputMaybe<Scalars["String"]["input"]>;
  customerId?: InputMaybe<Scalars["String"]["input"]>;
  frequencyBand?: InputMaybe<FrequencyBand>;
  search?: InputMaybe<Scalars["String"]["input"]>;
}>;

export type WirelessClientListQuery = {
  __typename?: "Query";
  wirelessClients: {
    __typename?: "WirelessClientConnection";
    totalCount: number;
    hasNextPage: boolean;
    clients: Array<{
      __typename?: "WirelessClient";
      id: string;
      macAddress: string;
      hostname?: string | null;
      ipAddress?: string | null;
      manufacturer?: string | null;
      accessPointId: string;
      accessPointName: string;
      ssid: string;
      connectionType: ClientConnectionType;
      frequencyBand: FrequencyBand;
      channel: number;
      isAuthenticated: boolean;
      isAuthorized: boolean;
      signalStrengthDbm?: number | null;
      noiseFloorDbm?: number | null;
      snr?: number | null;
      txRateMbps?: number | null;
      rxRateMbps?: number | null;
      txBytes: number;
      rxBytes: number;
      connectedAt: string;
      lastSeenAt: string;
      uptimeSeconds: number;
      customerId?: string | null;
      customerName?: string | null;
      signalQuality?: {
        __typename?: "SignalQuality";
        rssiDbm?: number | null;
        snrDb?: number | null;
        noiseFloorDbm?: number | null;
        signalStrengthPercent?: number | null;
        linkQualityPercent?: number | null;
      } | null;
    }>;
  };
};

export type WirelessClientDetailQueryVariables = Exact<{
  id: Scalars["ID"]["input"];
}>;

export type WirelessClientDetailQuery = {
  __typename?: "Query";
  wirelessClient?: {
    __typename?: "WirelessClient";
    id: string;
    macAddress: string;
    hostname?: string | null;
    ipAddress?: string | null;
    manufacturer?: string | null;
    accessPointId: string;
    accessPointName: string;
    ssid: string;
    connectionType: ClientConnectionType;
    frequencyBand: FrequencyBand;
    channel: number;
    isAuthenticated: boolean;
    isAuthorized: boolean;
    authMethod?: string | null;
    signalStrengthDbm?: number | null;
    noiseFloorDbm?: number | null;
    snr?: number | null;
    txRateMbps?: number | null;
    rxRateMbps?: number | null;
    txBytes: number;
    rxBytes: number;
    txPackets: number;
    rxPackets: number;
    txRetries: number;
    rxRetries: number;
    connectedAt: string;
    lastSeenAt: string;
    uptimeSeconds: number;
    idleTimeSeconds?: number | null;
    supports80211k: boolean;
    supports80211r: boolean;
    supports80211v: boolean;
    maxPhyRateMbps?: number | null;
    customerId?: string | null;
    customerName?: string | null;
    signalQuality?: {
      __typename?: "SignalQuality";
      rssiDbm?: number | null;
      snrDb?: number | null;
      noiseFloorDbm?: number | null;
      signalStrengthPercent?: number | null;
      linkQualityPercent?: number | null;
    } | null;
  } | null;
};

export type WirelessClientsByAccessPointQueryVariables = Exact<{
  accessPointId: Scalars["String"]["input"];
}>;

export type WirelessClientsByAccessPointQuery = {
  __typename?: "Query";
  wirelessClientsByAccessPoint: Array<{
    __typename?: "WirelessClient";
    id: string;
    macAddress: string;
    hostname?: string | null;
    ipAddress?: string | null;
    accessPointId?: string | null;
    ssid: string;
    signalStrengthDbm?: number | null;
    txRateMbps?: number | null;
    rxRateMbps?: number | null;
    connectedAt: string;
    customerId?: string | null;
    customerName?: string | null;
    signalQuality?: {
      __typename?: "SignalQuality";
      rssiDbm?: number | null;
      snrDb?: number | null;
      noiseFloorDbm?: number | null;
      signalStrengthPercent?: number | null;
      linkQualityPercent?: number | null;
    } | null;
  }>;
};

export type WirelessClientsByCustomerQueryVariables = Exact<{
  customerId: Scalars["String"]["input"];
}>;

export type WirelessClientsByCustomerQuery = {
  __typename?: "Query";
  wirelessClientsByCustomer: Array<{
    __typename?: "WirelessClient";
    id: string;
    macAddress: string;
    hostname?: string | null;
    ipAddress?: string | null;
    customerId?: string | null;
    accessPointName: string;
    ssid: string;
    frequencyBand: FrequencyBand;
    signalStrengthDbm?: number | null;
    isAuthenticated: boolean;
    connectedAt: string;
    lastSeenAt: string;
    signalQuality?: {
      __typename?: "SignalQuality";
      rssiDbm?: number | null;
      snrDb?: number | null;
      noiseFloorDbm?: number | null;
      signalStrengthPercent?: number | null;
      linkQualityPercent?: number | null;
    } | null;
  }>;
};

export type CoverageZoneListQueryVariables = Exact<{
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  offset?: InputMaybe<Scalars["Int"]["input"]>;
  siteId?: InputMaybe<Scalars["String"]["input"]>;
  areaType?: InputMaybe<Scalars["String"]["input"]>;
}>;

export type CoverageZoneListQuery = {
  __typename?: "Query";
  coverageZones: {
    __typename?: "CoverageZoneConnection";
    totalCount: number;
    hasNextPage: boolean;
    zones: Array<{
      __typename?: "CoverageZone";
      id: string;
      name: string;
      description?: string | null;
      siteId: string;
      siteName: string;
      floor?: string | null;
      areaType: string;
      coverageAreaSqm?: number | null;
      signalStrengthMinDbm?: number | null;
      signalStrengthMaxDbm?: number | null;
      signalStrengthAvgDbm?: number | null;
      accessPointIds: Array<string>;
      accessPointCount: number;
      interferenceLevel?: number | null;
      channelUtilizationAvg?: number | null;
      noiseFloorAvgDbm?: number | null;
      connectedClients: number;
      maxClientCapacity: number;
      clientDensityPerAp?: number | null;
      coveragePolygon?: string | null;
      createdAt: string;
      updatedAt: string;
      lastSurveyedAt?: string | null;
    }>;
  };
};

export type CoverageZoneDetailQueryVariables = Exact<{
  id: Scalars["ID"]["input"];
}>;

export type CoverageZoneDetailQuery = {
  __typename?: "Query";
  coverageZone?: {
    __typename?: "CoverageZone";
    id: string;
    name: string;
    description?: string | null;
    siteId: string;
    siteName: string;
    floor?: string | null;
    areaType: string;
    coverageAreaSqm?: number | null;
    signalStrengthMinDbm?: number | null;
    signalStrengthMaxDbm?: number | null;
    signalStrengthAvgDbm?: number | null;
    accessPointIds: Array<string>;
    accessPointCount: number;
    interferenceLevel?: number | null;
    channelUtilizationAvg?: number | null;
    noiseFloorAvgDbm?: number | null;
    connectedClients: number;
    maxClientCapacity: number;
    clientDensityPerAp?: number | null;
    coveragePolygon?: string | null;
    createdAt: string;
    updatedAt: string;
    lastSurveyedAt?: string | null;
  } | null;
};

export type CoverageZonesBySiteQueryVariables = Exact<{
  siteId: Scalars["String"]["input"];
}>;

export type CoverageZonesBySiteQuery = {
  __typename?: "Query";
  coverageZonesBySite: Array<{
    __typename?: "CoverageZone";
    id: string;
    name: string;
    siteId: string;
    siteName: string;
    floor?: string | null;
    areaType: string;
    coverageAreaSqm?: number | null;
    accessPointCount: number;
    connectedClients: number;
    maxClientCapacity: number;
    signalStrengthAvgDbm?: number | null;
  }>;
};

export type RfAnalyticsQueryVariables = Exact<{
  siteId: Scalars["String"]["input"];
}>;

export type RfAnalyticsQuery = {
  __typename?: "Query";
  rfAnalytics: {
    __typename?: "RFAnalytics";
    siteId: string;
    siteName: string;
    analysisTimestamp: string;
    recommendedChannels24ghz: Array<number>;
    recommendedChannels5ghz: Array<number>;
    recommendedChannels6ghz: Array<number>;
    totalInterferenceScore: number;
    averageSignalStrengthDbm: number;
    averageSnr: number;
    coverageQualityScore: number;
    clientsPerBand24ghz: number;
    clientsPerBand5ghz: number;
    clientsPerBand6ghz: number;
    bandUtilizationBalanceScore: number;
    channelUtilization24ghz: Array<{
      __typename?: "ChannelUtilization";
      channel: number;
      frequencyMhz: number;
      band: FrequencyBand;
      utilizationPercent: number;
      interferenceLevel: number;
      accessPointsCount: number;
    }>;
    channelUtilization5ghz: Array<{
      __typename?: "ChannelUtilization";
      channel: number;
      frequencyMhz: number;
      band: FrequencyBand;
      utilizationPercent: number;
      interferenceLevel: number;
      accessPointsCount: number;
    }>;
    channelUtilization6ghz: Array<{
      __typename?: "ChannelUtilization";
      channel: number;
      frequencyMhz: number;
      band: FrequencyBand;
      utilizationPercent: number;
      interferenceLevel: number;
      accessPointsCount: number;
    }>;
    interferenceSources: Array<{
      __typename?: "InterferenceSource";
      sourceType: string;
      frequencyMhz: number;
      strengthDbm: number;
      affectedChannels: Array<number>;
    }>;
  };
};

export type ChannelUtilizationQueryVariables = Exact<{
  siteId: Scalars["String"]["input"];
  frequencyBand: FrequencyBand;
}>;

export type ChannelUtilizationQuery = {
  __typename?: "Query";
  channelUtilization: Array<{
    __typename?: "ChannelUtilization";
    channel: number;
    frequencyMhz: number;
    band: FrequencyBand;
    utilizationPercent: number;
    interferenceLevel: number;
    accessPointsCount: number;
  }>;
};

export type WirelessSiteMetricsQueryVariables = Exact<{
  siteId: Scalars["String"]["input"];
}>;

export type WirelessSiteMetricsQuery = {
  __typename?: "Query";
  wirelessSiteMetrics?: {
    __typename?: "WirelessSiteMetrics";
    siteId: string;
    siteName: string;
    totalAps: number;
    onlineAps: number;
    offlineAps: number;
    degradedAps: number;
    totalClients: number;
    clients24ghz: number;
    clients5ghz: number;
    clients6ghz: number;
    averageSignalStrengthDbm?: number | null;
    averageSnr?: number | null;
    totalThroughputMbps?: number | null;
    totalCapacity: number;
    capacityUtilizationPercent?: number | null;
    overallHealthScore: number;
    rfHealthScore: number;
    clientExperienceScore: number;
  } | null;
};

export type WirelessDashboardQueryVariables = Exact<{ [key: string]: never }>;

export type WirelessDashboardQuery = {
  __typename?: "Query";
  wirelessDashboard: {
    __typename?: "WirelessDashboard";
    totalSites: number;
    totalAccessPoints: number;
    totalClients: number;
    totalCoverageZones: number;
    onlineAps: number;
    offlineAps: number;
    degradedAps: number;
    clientsByBand24ghz: number;
    clientsByBand5ghz: number;
    clientsByBand6ghz: number;
    totalThroughputMbps: number;
    averageSignalStrengthDbm: number;
    averageClientExperienceScore: number;
    clientCountTrend: Array<number>;
    throughputTrendMbps: Array<number>;
    offlineEventsCount: number;
    generatedAt: string;
    topApsByClients: Array<{
      __typename?: "AccessPoint";
      id: string;
      name: string;
      siteName?: string | null;
      performance?: {
        __typename?: "APPerformanceMetrics";
        connectedClients: number;
      } | null;
    }>;
    topApsByThroughput: Array<{
      __typename?: "AccessPoint";
      id: string;
      name: string;
      siteName?: string | null;
      performance?: {
        __typename?: "APPerformanceMetrics";
        txRateMbps?: number | null;
        rxRateMbps?: number | null;
      } | null;
    }>;
    sitesWithIssues: Array<{
      __typename?: "WirelessSiteMetrics";
      siteId: string;
      siteName: string;
      offlineAps: number;
      degradedAps: number;
      overallHealthScore: number;
    }>;
  };
};

export const CustomerListDocument = gql`
  query CustomerList(
    $limit: Int = 50
    $offset: Int = 0
    $status: CustomerStatusEnum
    $search: String
    $includeActivities: Boolean = false
    $includeNotes: Boolean = false
  ) {
    customers(
      limit: $limit
      offset: $offset
      status: $status
      search: $search
      includeActivities: $includeActivities
      includeNotes: $includeNotes
    ) {
      customers {
        id
        customerNumber
        firstName
        lastName
        middleName
        displayName
        companyName
        status
        customerType
        tier
        email
        emailVerified
        phone
        phoneVerified
        mobile
        addressLine1
        addressLine2
        city
        stateProvince
        postalCode
        country
        taxId
        industry
        employeeCount
        lifetimeValue
        totalPurchases
        averageOrderValue
        lastPurchaseDate
        createdAt
        updatedAt
        acquisitionDate
        lastContactDate
        activities @include(if: $includeActivities) {
          id
          customerId
          activityType
          title
          description
          performedBy
          createdAt
        }
        notes @include(if: $includeNotes) {
          id
          customerId
          subject
          content
          isInternal
          createdById
          createdAt
          updatedAt
        }
      }
      totalCount
      hasNextPage
    }
  }
`;
export function useCustomerListQuery(
  baseOptions?: Apollo.QueryHookOptions<CustomerListQuery, CustomerListQueryVariables>,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useQuery<CustomerListQuery, CustomerListQueryVariables>(
    CustomerListDocument,
    options,
  );
}
export function useCustomerListLazyQuery(
  baseOptions?: Apollo.LazyQueryHookOptions<CustomerListQuery, CustomerListQueryVariables>,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useLazyQuery<CustomerListQuery, CustomerListQueryVariables>(
    CustomerListDocument,
    options,
  );
}
export function useCustomerListSuspenseQuery(
  baseOptions?:
    | Apollo.SkipToken
    | Apollo.SuspenseQueryHookOptions<CustomerListQuery, CustomerListQueryVariables>,
) {
  const options =
    baseOptions === Apollo.skipToken ? baseOptions : { ...defaultOptions, ...baseOptions };
  return Apollo.useSuspenseQuery<CustomerListQuery, CustomerListQueryVariables>(
    CustomerListDocument,
    options,
  );
}
export type CustomerListQueryHookResult = ReturnType<typeof useCustomerListQuery>;
export type CustomerListLazyQueryHookResult = ReturnType<typeof useCustomerListLazyQuery>;
export type CustomerListSuspenseQueryHookResult = ReturnType<typeof useCustomerListSuspenseQuery>;
export type CustomerListQueryResult = Apollo.QueryResult<
  CustomerListQuery,
  CustomerListQueryVariables
>;
export const CustomerDetailDocument = gql`
  query CustomerDetail($id: ID!) {
    customer(id: $id, includeActivities: true, includeNotes: true) {
      id
      customerNumber
      firstName
      lastName
      middleName
      displayName
      companyName
      status
      customerType
      tier
      email
      emailVerified
      phone
      phoneVerified
      mobile
      addressLine1
      addressLine2
      city
      stateProvince
      postalCode
      country
      taxId
      industry
      employeeCount
      lifetimeValue
      totalPurchases
      averageOrderValue
      lastPurchaseDate
      createdAt
      updatedAt
      acquisitionDate
      lastContactDate
      activities {
        id
        customerId
        activityType
        title
        description
        performedBy
        createdAt
      }
      notes {
        id
        customerId
        subject
        content
        isInternal
        createdById
        createdAt
        updatedAt
      }
    }
  }
`;
export function useCustomerDetailQuery(
  baseOptions: Apollo.QueryHookOptions<CustomerDetailQuery, CustomerDetailQueryVariables> &
    ({ variables: CustomerDetailQueryVariables; skip?: boolean } | { skip: boolean }),
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useQuery<CustomerDetailQuery, CustomerDetailQueryVariables>(
    CustomerDetailDocument,
    options,
  );
}
export function useCustomerDetailLazyQuery(
  baseOptions?: Apollo.LazyQueryHookOptions<CustomerDetailQuery, CustomerDetailQueryVariables>,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useLazyQuery<CustomerDetailQuery, CustomerDetailQueryVariables>(
    CustomerDetailDocument,
    options,
  );
}
export function useCustomerDetailSuspenseQuery(
  baseOptions?:
    | Apollo.SkipToken
    | Apollo.SuspenseQueryHookOptions<CustomerDetailQuery, CustomerDetailQueryVariables>,
) {
  const options =
    baseOptions === Apollo.skipToken ? baseOptions : { ...defaultOptions, ...baseOptions };
  return Apollo.useSuspenseQuery<CustomerDetailQuery, CustomerDetailQueryVariables>(
    CustomerDetailDocument,
    options,
  );
}
export type CustomerDetailQueryHookResult = ReturnType<typeof useCustomerDetailQuery>;
export type CustomerDetailLazyQueryHookResult = ReturnType<typeof useCustomerDetailLazyQuery>;
export type CustomerDetailSuspenseQueryHookResult = ReturnType<
  typeof useCustomerDetailSuspenseQuery
>;
export type CustomerDetailQueryResult = Apollo.QueryResult<
  CustomerDetailQuery,
  CustomerDetailQueryVariables
>;
export const CustomerMetricsDocument = gql`
  query CustomerMetrics {
    customerMetrics {
      totalCustomers
      activeCustomers
      newCustomers
      churnedCustomers
      totalCustomerValue
      averageCustomerValue
    }
  }
`;
export function useCustomerMetricsQuery(
  baseOptions?: Apollo.QueryHookOptions<CustomerMetricsQuery, CustomerMetricsQueryVariables>,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useQuery<CustomerMetricsQuery, CustomerMetricsQueryVariables>(
    CustomerMetricsDocument,
    options,
  );
}
export function useCustomerMetricsLazyQuery(
  baseOptions?: Apollo.LazyQueryHookOptions<CustomerMetricsQuery, CustomerMetricsQueryVariables>,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useLazyQuery<CustomerMetricsQuery, CustomerMetricsQueryVariables>(
    CustomerMetricsDocument,
    options,
  );
}
export function useCustomerMetricsSuspenseQuery(
  baseOptions?:
    | Apollo.SkipToken
    | Apollo.SuspenseQueryHookOptions<CustomerMetricsQuery, CustomerMetricsQueryVariables>,
) {
  const options =
    baseOptions === Apollo.skipToken ? baseOptions : { ...defaultOptions, ...baseOptions };
  return Apollo.useSuspenseQuery<CustomerMetricsQuery, CustomerMetricsQueryVariables>(
    CustomerMetricsDocument,
    options,
  );
}
export type CustomerMetricsQueryHookResult = ReturnType<typeof useCustomerMetricsQuery>;
export type CustomerMetricsLazyQueryHookResult = ReturnType<typeof useCustomerMetricsLazyQuery>;
export type CustomerMetricsSuspenseQueryHookResult = ReturnType<
  typeof useCustomerMetricsSuspenseQuery
>;
export type CustomerMetricsQueryResult = Apollo.QueryResult<
  CustomerMetricsQuery,
  CustomerMetricsQueryVariables
>;
export const CustomerActivitiesDocument = gql`
  query CustomerActivities($id: ID!) {
    customer(id: $id, includeActivities: true, includeNotes: false) {
      id
      activities {
        id
        customerId
        activityType
        title
        description
        performedBy
        createdAt
      }
    }
  }
`;
export function useCustomerActivitiesQuery(
  baseOptions: Apollo.QueryHookOptions<CustomerActivitiesQuery, CustomerActivitiesQueryVariables> &
    ({ variables: CustomerActivitiesQueryVariables; skip?: boolean } | { skip: boolean }),
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useQuery<CustomerActivitiesQuery, CustomerActivitiesQueryVariables>(
    CustomerActivitiesDocument,
    options,
  );
}
export function useCustomerActivitiesLazyQuery(
  baseOptions?: Apollo.LazyQueryHookOptions<
    CustomerActivitiesQuery,
    CustomerActivitiesQueryVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useLazyQuery<CustomerActivitiesQuery, CustomerActivitiesQueryVariables>(
    CustomerActivitiesDocument,
    options,
  );
}
export function useCustomerActivitiesSuspenseQuery(
  baseOptions?:
    | Apollo.SkipToken
    | Apollo.SuspenseQueryHookOptions<CustomerActivitiesQuery, CustomerActivitiesQueryVariables>,
) {
  const options =
    baseOptions === Apollo.skipToken ? baseOptions : { ...defaultOptions, ...baseOptions };
  return Apollo.useSuspenseQuery<CustomerActivitiesQuery, CustomerActivitiesQueryVariables>(
    CustomerActivitiesDocument,
    options,
  );
}
export type CustomerActivitiesQueryHookResult = ReturnType<typeof useCustomerActivitiesQuery>;
export type CustomerActivitiesLazyQueryHookResult = ReturnType<
  typeof useCustomerActivitiesLazyQuery
>;
export type CustomerActivitiesSuspenseQueryHookResult = ReturnType<
  typeof useCustomerActivitiesSuspenseQuery
>;
export type CustomerActivitiesQueryResult = Apollo.QueryResult<
  CustomerActivitiesQuery,
  CustomerActivitiesQueryVariables
>;
export const CustomerNotesDocument = gql`
  query CustomerNotes($id: ID!) {
    customer(id: $id, includeActivities: false, includeNotes: true) {
      id
      notes {
        id
        customerId
        subject
        content
        isInternal
        createdById
        createdAt
        updatedAt
      }
    }
  }
`;
export function useCustomerNotesQuery(
  baseOptions: Apollo.QueryHookOptions<CustomerNotesQuery, CustomerNotesQueryVariables> &
    ({ variables: CustomerNotesQueryVariables; skip?: boolean } | { skip: boolean }),
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useQuery<CustomerNotesQuery, CustomerNotesQueryVariables>(
    CustomerNotesDocument,
    options,
  );
}
export function useCustomerNotesLazyQuery(
  baseOptions?: Apollo.LazyQueryHookOptions<CustomerNotesQuery, CustomerNotesQueryVariables>,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useLazyQuery<CustomerNotesQuery, CustomerNotesQueryVariables>(
    CustomerNotesDocument,
    options,
  );
}
export function useCustomerNotesSuspenseQuery(
  baseOptions?:
    | Apollo.SkipToken
    | Apollo.SuspenseQueryHookOptions<CustomerNotesQuery, CustomerNotesQueryVariables>,
) {
  const options =
    baseOptions === Apollo.skipToken ? baseOptions : { ...defaultOptions, ...baseOptions };
  return Apollo.useSuspenseQuery<CustomerNotesQuery, CustomerNotesQueryVariables>(
    CustomerNotesDocument,
    options,
  );
}
export type CustomerNotesQueryHookResult = ReturnType<typeof useCustomerNotesQuery>;
export type CustomerNotesLazyQueryHookResult = ReturnType<typeof useCustomerNotesLazyQuery>;
export type CustomerNotesSuspenseQueryHookResult = ReturnType<typeof useCustomerNotesSuspenseQuery>;
export type CustomerNotesQueryResult = Apollo.QueryResult<
  CustomerNotesQuery,
  CustomerNotesQueryVariables
>;
export const CustomerDashboardDocument = gql`
  query CustomerDashboard(
    $limit: Int = 20
    $offset: Int = 0
    $status: CustomerStatusEnum
    $search: String
  ) {
    customers(
      limit: $limit
      offset: $offset
      status: $status
      search: $search
      includeActivities: false
      includeNotes: false
    ) {
      customers {
        id
        customerNumber
        firstName
        lastName
        companyName
        email
        phone
        status
        customerType
        tier
        lifetimeValue
        totalPurchases
        lastContactDate
        createdAt
      }
      totalCount
      hasNextPage
    }
    customerMetrics {
      totalCustomers
      activeCustomers
      newCustomers
      churnedCustomers
      totalCustomerValue
      averageCustomerValue
    }
  }
`;
export function useCustomerDashboardQuery(
  baseOptions?: Apollo.QueryHookOptions<CustomerDashboardQuery, CustomerDashboardQueryVariables>,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useQuery<CustomerDashboardQuery, CustomerDashboardQueryVariables>(
    CustomerDashboardDocument,
    options,
  );
}
export function useCustomerDashboardLazyQuery(
  baseOptions?: Apollo.LazyQueryHookOptions<
    CustomerDashboardQuery,
    CustomerDashboardQueryVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useLazyQuery<CustomerDashboardQuery, CustomerDashboardQueryVariables>(
    CustomerDashboardDocument,
    options,
  );
}
export function useCustomerDashboardSuspenseQuery(
  baseOptions?:
    | Apollo.SkipToken
    | Apollo.SuspenseQueryHookOptions<CustomerDashboardQuery, CustomerDashboardQueryVariables>,
) {
  const options =
    baseOptions === Apollo.skipToken ? baseOptions : { ...defaultOptions, ...baseOptions };
  return Apollo.useSuspenseQuery<CustomerDashboardQuery, CustomerDashboardQueryVariables>(
    CustomerDashboardDocument,
    options,
  );
}
export type CustomerDashboardQueryHookResult = ReturnType<typeof useCustomerDashboardQuery>;
export type CustomerDashboardLazyQueryHookResult = ReturnType<typeof useCustomerDashboardLazyQuery>;
export type CustomerDashboardSuspenseQueryHookResult = ReturnType<
  typeof useCustomerDashboardSuspenseQuery
>;
export type CustomerDashboardQueryResult = Apollo.QueryResult<
  CustomerDashboardQuery,
  CustomerDashboardQueryVariables
>;
export const CustomerSubscriptionsDocument = gql`
  query CustomerSubscriptions($customerId: ID!, $status: String, $limit: Int = 50) {
    customerSubscriptions(customerId: $customerId, status: $status, limit: $limit) {
      id
      subscriptionId
      customerId
      planId
      tenantId
      currentPeriodStart
      currentPeriodEnd
      status
      trialEnd
      isInTrial
      cancelAtPeriodEnd
      canceledAt
      endedAt
      createdAt
      updatedAt
    }
  }
`;
export function useCustomerSubscriptionsQuery(
  baseOptions: Apollo.QueryHookOptions<
    CustomerSubscriptionsQuery,
    CustomerSubscriptionsQueryVariables
  > &
    ({ variables: CustomerSubscriptionsQueryVariables; skip?: boolean } | { skip: boolean }),
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useQuery<CustomerSubscriptionsQuery, CustomerSubscriptionsQueryVariables>(
    CustomerSubscriptionsDocument,
    options,
  );
}
export function useCustomerSubscriptionsLazyQuery(
  baseOptions?: Apollo.LazyQueryHookOptions<
    CustomerSubscriptionsQuery,
    CustomerSubscriptionsQueryVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useLazyQuery<CustomerSubscriptionsQuery, CustomerSubscriptionsQueryVariables>(
    CustomerSubscriptionsDocument,
    options,
  );
}
export function useCustomerSubscriptionsSuspenseQuery(
  baseOptions?:
    | Apollo.SkipToken
    | Apollo.SuspenseQueryHookOptions<
        CustomerSubscriptionsQuery,
        CustomerSubscriptionsQueryVariables
      >,
) {
  const options =
    baseOptions === Apollo.skipToken ? baseOptions : { ...defaultOptions, ...baseOptions };
  return Apollo.useSuspenseQuery<CustomerSubscriptionsQuery, CustomerSubscriptionsQueryVariables>(
    CustomerSubscriptionsDocument,
    options,
  );
}
export type CustomerSubscriptionsQueryHookResult = ReturnType<typeof useCustomerSubscriptionsQuery>;
export type CustomerSubscriptionsLazyQueryHookResult = ReturnType<
  typeof useCustomerSubscriptionsLazyQuery
>;
export type CustomerSubscriptionsSuspenseQueryHookResult = ReturnType<
  typeof useCustomerSubscriptionsSuspenseQuery
>;
export type CustomerSubscriptionsQueryResult = Apollo.QueryResult<
  CustomerSubscriptionsQuery,
  CustomerSubscriptionsQueryVariables
>;
export const CustomerNetworkInfoDocument = gql`
  query CustomerNetworkInfo($customerId: ID!) {
    customerNetworkInfo(customerId: $customerId)
  }
`;
export function useCustomerNetworkInfoQuery(
  baseOptions: Apollo.QueryHookOptions<
    CustomerNetworkInfoQuery,
    CustomerNetworkInfoQueryVariables
  > &
    ({ variables: CustomerNetworkInfoQueryVariables; skip?: boolean } | { skip: boolean }),
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useQuery<CustomerNetworkInfoQuery, CustomerNetworkInfoQueryVariables>(
    CustomerNetworkInfoDocument,
    options,
  );
}
export function useCustomerNetworkInfoLazyQuery(
  baseOptions?: Apollo.LazyQueryHookOptions<
    CustomerNetworkInfoQuery,
    CustomerNetworkInfoQueryVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useLazyQuery<CustomerNetworkInfoQuery, CustomerNetworkInfoQueryVariables>(
    CustomerNetworkInfoDocument,
    options,
  );
}
export function useCustomerNetworkInfoSuspenseQuery(
  baseOptions?:
    | Apollo.SkipToken
    | Apollo.SuspenseQueryHookOptions<CustomerNetworkInfoQuery, CustomerNetworkInfoQueryVariables>,
) {
  const options =
    baseOptions === Apollo.skipToken ? baseOptions : { ...defaultOptions, ...baseOptions };
  return Apollo.useSuspenseQuery<CustomerNetworkInfoQuery, CustomerNetworkInfoQueryVariables>(
    CustomerNetworkInfoDocument,
    options,
  );
}
export type CustomerNetworkInfoQueryHookResult = ReturnType<typeof useCustomerNetworkInfoQuery>;
export type CustomerNetworkInfoLazyQueryHookResult = ReturnType<
  typeof useCustomerNetworkInfoLazyQuery
>;
export type CustomerNetworkInfoSuspenseQueryHookResult = ReturnType<
  typeof useCustomerNetworkInfoSuspenseQuery
>;
export type CustomerNetworkInfoQueryResult = Apollo.QueryResult<
  CustomerNetworkInfoQuery,
  CustomerNetworkInfoQueryVariables
>;
export const CustomerDevicesDocument = gql`
  query CustomerDevices($customerId: ID!, $deviceType: String, $activeOnly: Boolean = true) {
    customerDevices(customerId: $customerId, deviceType: $deviceType, activeOnly: $activeOnly)
  }
`;
export function useCustomerDevicesQuery(
  baseOptions: Apollo.QueryHookOptions<CustomerDevicesQuery, CustomerDevicesQueryVariables> &
    ({ variables: CustomerDevicesQueryVariables; skip?: boolean } | { skip: boolean }),
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useQuery<CustomerDevicesQuery, CustomerDevicesQueryVariables>(
    CustomerDevicesDocument,
    options,
  );
}
export function useCustomerDevicesLazyQuery(
  baseOptions?: Apollo.LazyQueryHookOptions<CustomerDevicesQuery, CustomerDevicesQueryVariables>,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useLazyQuery<CustomerDevicesQuery, CustomerDevicesQueryVariables>(
    CustomerDevicesDocument,
    options,
  );
}
export function useCustomerDevicesSuspenseQuery(
  baseOptions?:
    | Apollo.SkipToken
    | Apollo.SuspenseQueryHookOptions<CustomerDevicesQuery, CustomerDevicesQueryVariables>,
) {
  const options =
    baseOptions === Apollo.skipToken ? baseOptions : { ...defaultOptions, ...baseOptions };
  return Apollo.useSuspenseQuery<CustomerDevicesQuery, CustomerDevicesQueryVariables>(
    CustomerDevicesDocument,
    options,
  );
}
export type CustomerDevicesQueryHookResult = ReturnType<typeof useCustomerDevicesQuery>;
export type CustomerDevicesLazyQueryHookResult = ReturnType<typeof useCustomerDevicesLazyQuery>;
export type CustomerDevicesSuspenseQueryHookResult = ReturnType<
  typeof useCustomerDevicesSuspenseQuery
>;
export type CustomerDevicesQueryResult = Apollo.QueryResult<
  CustomerDevicesQuery,
  CustomerDevicesQueryVariables
>;
export const CustomerTicketsDocument = gql`
  query CustomerTickets($customerId: ID!, $limit: Int = 50, $status: String) {
    customerTickets(customerId: $customerId, limit: $limit, status: $status)
  }
`;
export function useCustomerTicketsQuery(
  baseOptions: Apollo.QueryHookOptions<CustomerTicketsQuery, CustomerTicketsQueryVariables> &
    ({ variables: CustomerTicketsQueryVariables; skip?: boolean } | { skip: boolean }),
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useQuery<CustomerTicketsQuery, CustomerTicketsQueryVariables>(
    CustomerTicketsDocument,
    options,
  );
}
export function useCustomerTicketsLazyQuery(
  baseOptions?: Apollo.LazyQueryHookOptions<CustomerTicketsQuery, CustomerTicketsQueryVariables>,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useLazyQuery<CustomerTicketsQuery, CustomerTicketsQueryVariables>(
    CustomerTicketsDocument,
    options,
  );
}
export function useCustomerTicketsSuspenseQuery(
  baseOptions?:
    | Apollo.SkipToken
    | Apollo.SuspenseQueryHookOptions<CustomerTicketsQuery, CustomerTicketsQueryVariables>,
) {
  const options =
    baseOptions === Apollo.skipToken ? baseOptions : { ...defaultOptions, ...baseOptions };
  return Apollo.useSuspenseQuery<CustomerTicketsQuery, CustomerTicketsQueryVariables>(
    CustomerTicketsDocument,
    options,
  );
}
export type CustomerTicketsQueryHookResult = ReturnType<typeof useCustomerTicketsQuery>;
export type CustomerTicketsLazyQueryHookResult = ReturnType<typeof useCustomerTicketsLazyQuery>;
export type CustomerTicketsSuspenseQueryHookResult = ReturnType<
  typeof useCustomerTicketsSuspenseQuery
>;
export type CustomerTicketsQueryResult = Apollo.QueryResult<
  CustomerTicketsQuery,
  CustomerTicketsQueryVariables
>;
export const CustomerBillingDocument = gql`
  query CustomerBilling(
    $customerId: ID!
    $includeInvoices: Boolean = true
    $invoiceLimit: Int = 50
  ) {
    customerBilling(
      customerId: $customerId
      includeInvoices: $includeInvoices
      invoiceLimit: $invoiceLimit
    )
  }
`;
export function useCustomerBillingQuery(
  baseOptions: Apollo.QueryHookOptions<CustomerBillingQuery, CustomerBillingQueryVariables> &
    ({ variables: CustomerBillingQueryVariables; skip?: boolean } | { skip: boolean }),
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useQuery<CustomerBillingQuery, CustomerBillingQueryVariables>(
    CustomerBillingDocument,
    options,
  );
}
export function useCustomerBillingLazyQuery(
  baseOptions?: Apollo.LazyQueryHookOptions<CustomerBillingQuery, CustomerBillingQueryVariables>,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useLazyQuery<CustomerBillingQuery, CustomerBillingQueryVariables>(
    CustomerBillingDocument,
    options,
  );
}
export function useCustomerBillingSuspenseQuery(
  baseOptions?:
    | Apollo.SkipToken
    | Apollo.SuspenseQueryHookOptions<CustomerBillingQuery, CustomerBillingQueryVariables>,
) {
  const options =
    baseOptions === Apollo.skipToken ? baseOptions : { ...defaultOptions, ...baseOptions };
  return Apollo.useSuspenseQuery<CustomerBillingQuery, CustomerBillingQueryVariables>(
    CustomerBillingDocument,
    options,
  );
}
export type CustomerBillingQueryHookResult = ReturnType<typeof useCustomerBillingQuery>;
export type CustomerBillingLazyQueryHookResult = ReturnType<typeof useCustomerBillingLazyQuery>;
export type CustomerBillingSuspenseQueryHookResult = ReturnType<
  typeof useCustomerBillingSuspenseQuery
>;
export type CustomerBillingQueryResult = Apollo.QueryResult<
  CustomerBillingQuery,
  CustomerBillingQueryVariables
>;
export const Customer360ViewDocument = gql`
  query Customer360View($customerId: ID!) {
    customer(id: $customerId, includeActivities: true, includeNotes: true) {
      id
      customerNumber
      firstName
      lastName
      middleName
      displayName
      companyName
      status
      customerType
      tier
      email
      emailVerified
      phone
      phoneVerified
      mobile
      addressLine1
      addressLine2
      city
      stateProvince
      postalCode
      country
      taxId
      industry
      employeeCount
      lifetimeValue
      totalPurchases
      averageOrderValue
      lastPurchaseDate
      createdAt
      updatedAt
      acquisitionDate
      lastContactDate
      activities {
        id
        customerId
        activityType
        title
        description
        performedBy
        createdAt
      }
      notes {
        id
        customerId
        subject
        content
        isInternal
        createdById
        createdAt
        updatedAt
      }
    }
    customerSubscriptions(customerId: $customerId, limit: 10) {
      id
      subscriptionId
      customerId
      planId
      status
      currentPeriodStart
      currentPeriodEnd
      isInTrial
      cancelAtPeriodEnd
      createdAt
    }
    customerNetworkInfo(customerId: $customerId)
    customerDevices(customerId: $customerId, activeOnly: true)
    customerTickets(customerId: $customerId, limit: 10)
    customerBilling(customerId: $customerId, includeInvoices: true, invoiceLimit: 10)
  }
`;
export function useCustomer360ViewQuery(
  baseOptions: Apollo.QueryHookOptions<Customer360ViewQuery, Customer360ViewQueryVariables> &
    ({ variables: Customer360ViewQueryVariables; skip?: boolean } | { skip: boolean }),
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useQuery<Customer360ViewQuery, Customer360ViewQueryVariables>(
    Customer360ViewDocument,
    options,
  );
}
export function useCustomer360ViewLazyQuery(
  baseOptions?: Apollo.LazyQueryHookOptions<Customer360ViewQuery, Customer360ViewQueryVariables>,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useLazyQuery<Customer360ViewQuery, Customer360ViewQueryVariables>(
    Customer360ViewDocument,
    options,
  );
}
export function useCustomer360ViewSuspenseQuery(
  baseOptions?:
    | Apollo.SkipToken
    | Apollo.SuspenseQueryHookOptions<Customer360ViewQuery, Customer360ViewQueryVariables>,
) {
  const options =
    baseOptions === Apollo.skipToken ? baseOptions : { ...defaultOptions, ...baseOptions };
  return Apollo.useSuspenseQuery<Customer360ViewQuery, Customer360ViewQueryVariables>(
    Customer360ViewDocument,
    options,
  );
}
export type Customer360ViewQueryHookResult = ReturnType<typeof useCustomer360ViewQuery>;
export type Customer360ViewLazyQueryHookResult = ReturnType<typeof useCustomer360ViewLazyQuery>;
export type Customer360ViewSuspenseQueryHookResult = ReturnType<
  typeof useCustomer360ViewSuspenseQuery
>;
export type Customer360ViewQueryResult = Apollo.QueryResult<
  Customer360ViewQuery,
  Customer360ViewQueryVariables
>;
export const CustomerNetworkStatusUpdatedDocument = gql`
  subscription CustomerNetworkStatusUpdated($customerId: ID!) {
    customerNetworkStatusUpdated(customerId: $customerId) {
      customerId
      connectionStatus
      lastSeenAt
      ipv4Address
      ipv6Address
      macAddress
      vlanId
      signalStrength
      signalQuality
      uptimeSeconds
      uptimePercentage
      bandwidthUsageMbps
      downloadSpeedMbps
      uploadSpeedMbps
      packetLoss
      latencyMs
      jitter
      ontRxPower
      ontTxPower
      oltRxPower
      serviceStatus
      updatedAt
    }
  }
`;
export function useCustomerNetworkStatusUpdatedSubscription(
  baseOptions: Apollo.SubscriptionHookOptions<
    CustomerNetworkStatusUpdatedSubscription,
    CustomerNetworkStatusUpdatedSubscriptionVariables
  > &
    (
      | {
          variables: CustomerNetworkStatusUpdatedSubscriptionVariables;
          skip?: boolean;
        }
      | { skip: boolean }
    ),
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useSubscription<
    CustomerNetworkStatusUpdatedSubscription,
    CustomerNetworkStatusUpdatedSubscriptionVariables
  >(CustomerNetworkStatusUpdatedDocument, options);
}
export type CustomerNetworkStatusUpdatedSubscriptionHookResult = ReturnType<
  typeof useCustomerNetworkStatusUpdatedSubscription
>;
export type CustomerNetworkStatusUpdatedSubscriptionResult =
  Apollo.SubscriptionResult<CustomerNetworkStatusUpdatedSubscription>;
export const CustomerDevicesUpdatedDocument = gql`
  subscription CustomerDevicesUpdated($customerId: ID!) {
    customerDevicesUpdated(customerId: $customerId) {
      customerId
      deviceId
      deviceType
      deviceName
      status
      healthStatus
      isOnline
      lastSeenAt
      signalStrength
      temperature
      cpuUsage
      memoryUsage
      uptimeSeconds
      firmwareVersion
      needsFirmwareUpdate
      changeType
      previousValue
      newValue
      updatedAt
    }
  }
`;
export function useCustomerDevicesUpdatedSubscription(
  baseOptions: Apollo.SubscriptionHookOptions<
    CustomerDevicesUpdatedSubscription,
    CustomerDevicesUpdatedSubscriptionVariables
  > &
    (
      | {
          variables: CustomerDevicesUpdatedSubscriptionVariables;
          skip?: boolean;
        }
      | { skip: boolean }
    ),
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useSubscription<
    CustomerDevicesUpdatedSubscription,
    CustomerDevicesUpdatedSubscriptionVariables
  >(CustomerDevicesUpdatedDocument, options);
}
export type CustomerDevicesUpdatedSubscriptionHookResult = ReturnType<
  typeof useCustomerDevicesUpdatedSubscription
>;
export type CustomerDevicesUpdatedSubscriptionResult =
  Apollo.SubscriptionResult<CustomerDevicesUpdatedSubscription>;
export const CustomerTicketUpdatedDocument = gql`
  subscription CustomerTicketUpdated($customerId: ID!) {
    customerTicketUpdated(customerId: $customerId) {
      customerId
      action
      ticket {
        id
        ticketNumber
        title
        description
        status
        priority
        category
        subCategory
        assignedTo
        assignedToName
        assignedTeam
        createdAt
        updatedAt
        resolvedAt
        closedAt
        customerId
        customerName
      }
      changedBy
      changedByName
      changes
      comment
      updatedAt
    }
  }
`;
export function useCustomerTicketUpdatedSubscription(
  baseOptions: Apollo.SubscriptionHookOptions<
    CustomerTicketUpdatedSubscription,
    CustomerTicketUpdatedSubscriptionVariables
  > &
    (
      | {
          variables: CustomerTicketUpdatedSubscriptionVariables;
          skip?: boolean;
        }
      | { skip: boolean }
    ),
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useSubscription<
    CustomerTicketUpdatedSubscription,
    CustomerTicketUpdatedSubscriptionVariables
  >(CustomerTicketUpdatedDocument, options);
}
export type CustomerTicketUpdatedSubscriptionHookResult = ReturnType<
  typeof useCustomerTicketUpdatedSubscription
>;
export type CustomerTicketUpdatedSubscriptionResult =
  Apollo.SubscriptionResult<CustomerTicketUpdatedSubscription>;
export const CustomerActivityAddedDocument = gql`
  subscription CustomerActivityAdded($customerId: ID!) {
    customerActivityAdded(customerId: $customerId) {
      id
      customerId
      activityType
      title
      description
      performedBy
      performedByName
      createdAt
    }
  }
`;
export function useCustomerActivityAddedSubscription(
  baseOptions: Apollo.SubscriptionHookOptions<
    CustomerActivityAddedSubscription,
    CustomerActivityAddedSubscriptionVariables
  > &
    (
      | {
          variables: CustomerActivityAddedSubscriptionVariables;
          skip?: boolean;
        }
      | { skip: boolean }
    ),
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useSubscription<
    CustomerActivityAddedSubscription,
    CustomerActivityAddedSubscriptionVariables
  >(CustomerActivityAddedDocument, options);
}
export type CustomerActivityAddedSubscriptionHookResult = ReturnType<
  typeof useCustomerActivityAddedSubscription
>;
export type CustomerActivityAddedSubscriptionResult =
  Apollo.SubscriptionResult<CustomerActivityAddedSubscription>;
export const CustomerNoteUpdatedDocument = gql`
  subscription CustomerNoteUpdated($customerId: ID!) {
    customerNoteUpdated(customerId: $customerId) {
      customerId
      action
      note {
        id
        customerId
        subject
        content
        isInternal
        createdById
        createdByName
        createdAt
        updatedAt
      }
      changedBy
      changedByName
      updatedAt
    }
  }
`;
export function useCustomerNoteUpdatedSubscription(
  baseOptions: Apollo.SubscriptionHookOptions<
    CustomerNoteUpdatedSubscription,
    CustomerNoteUpdatedSubscriptionVariables
  > &
    ({ variables: CustomerNoteUpdatedSubscriptionVariables; skip?: boolean } | { skip: boolean }),
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useSubscription<
    CustomerNoteUpdatedSubscription,
    CustomerNoteUpdatedSubscriptionVariables
  >(CustomerNoteUpdatedDocument, options);
}
export type CustomerNoteUpdatedSubscriptionHookResult = ReturnType<
  typeof useCustomerNoteUpdatedSubscription
>;
export type CustomerNoteUpdatedSubscriptionResult =
  Apollo.SubscriptionResult<CustomerNoteUpdatedSubscription>;
export const FiberCableListDocument = gql`
  query FiberCableList(
    $limit: Int = 50
    $offset: Int = 0
    $status: FiberCableStatus
    $fiberType: FiberType
    $installationType: CableInstallationType
    $siteId: String
    $search: String
  ) {
    fiberCables(
      limit: $limit
      offset: $offset
      status: $status
      fiberType: $fiberType
      installationType: $installationType
      siteId: $siteId
      search: $search
    ) {
      cables {
        id
        cableId
        name
        description
        status
        isActive
        fiberType
        totalStrands
        availableStrands
        usedStrands
        manufacturer
        model
        installationType
        route {
          totalDistanceMeters
          startPoint {
            latitude
            longitude
            altitude
          }
          endPoint {
            latitude
            longitude
            altitude
          }
        }
        lengthMeters
        startDistributionPointId
        endDistributionPointId
        startPointName
        endPointName
        capacityUtilizationPercent
        bandwidthCapacityGbps
        spliceCount
        totalLossDb
        averageAttenuationDbPerKm
        maxAttenuationDbPerKm
        isLeased
        installedAt
        createdAt
        updatedAt
      }
      totalCount
      hasNextPage
    }
  }
`;
export function useFiberCableListQuery(
  baseOptions?: Apollo.QueryHookOptions<FiberCableListQuery, FiberCableListQueryVariables>,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useQuery<FiberCableListQuery, FiberCableListQueryVariables>(
    FiberCableListDocument,
    options,
  );
}
export function useFiberCableListLazyQuery(
  baseOptions?: Apollo.LazyQueryHookOptions<FiberCableListQuery, FiberCableListQueryVariables>,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useLazyQuery<FiberCableListQuery, FiberCableListQueryVariables>(
    FiberCableListDocument,
    options,
  );
}
export function useFiberCableListSuspenseQuery(
  baseOptions?:
    | Apollo.SkipToken
    | Apollo.SuspenseQueryHookOptions<FiberCableListQuery, FiberCableListQueryVariables>,
) {
  const options =
    baseOptions === Apollo.skipToken ? baseOptions : { ...defaultOptions, ...baseOptions };
  return Apollo.useSuspenseQuery<FiberCableListQuery, FiberCableListQueryVariables>(
    FiberCableListDocument,
    options,
  );
}
export type FiberCableListQueryHookResult = ReturnType<typeof useFiberCableListQuery>;
export type FiberCableListLazyQueryHookResult = ReturnType<typeof useFiberCableListLazyQuery>;
export type FiberCableListSuspenseQueryHookResult = ReturnType<
  typeof useFiberCableListSuspenseQuery
>;
export type FiberCableListQueryResult = Apollo.QueryResult<
  FiberCableListQuery,
  FiberCableListQueryVariables
>;
export const FiberCableDetailDocument = gql`
  query FiberCableDetail($id: ID!) {
    fiberCable(id: $id) {
      id
      cableId
      name
      description
      status
      isActive
      fiberType
      totalStrands
      availableStrands
      usedStrands
      manufacturer
      model
      installationType
      route {
        pathGeojson
        totalDistanceMeters
        startPoint {
          latitude
          longitude
          altitude
        }
        endPoint {
          latitude
          longitude
          altitude
        }
        intermediatePoints {
          latitude
          longitude
          altitude
        }
        elevationChangeMeters
        undergroundDistanceMeters
        aerialDistanceMeters
      }
      lengthMeters
      strands {
        strandId
        colorCode
        isActive
        isAvailable
        customerId
        customerName
        serviceId
        attenuationDb
        lossDb
        spliceCount
      }
      startDistributionPointId
      endDistributionPointId
      startPointName
      endPointName
      capacityUtilizationPercent
      bandwidthCapacityGbps
      splicePointIds
      spliceCount
      totalLossDb
      averageAttenuationDbPerKm
      maxAttenuationDbPerKm
      conduitId
      ductNumber
      armored
      fireRated
      ownerId
      ownerName
      isLeased
      installedAt
      testedAt
      createdAt
      updatedAt
    }
  }
`;
export function useFiberCableDetailQuery(
  baseOptions: Apollo.QueryHookOptions<FiberCableDetailQuery, FiberCableDetailQueryVariables> &
    ({ variables: FiberCableDetailQueryVariables; skip?: boolean } | { skip: boolean }),
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useQuery<FiberCableDetailQuery, FiberCableDetailQueryVariables>(
    FiberCableDetailDocument,
    options,
  );
}
export function useFiberCableDetailLazyQuery(
  baseOptions?: Apollo.LazyQueryHookOptions<FiberCableDetailQuery, FiberCableDetailQueryVariables>,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useLazyQuery<FiberCableDetailQuery, FiberCableDetailQueryVariables>(
    FiberCableDetailDocument,
    options,
  );
}
export function useFiberCableDetailSuspenseQuery(
  baseOptions?:
    | Apollo.SkipToken
    | Apollo.SuspenseQueryHookOptions<FiberCableDetailQuery, FiberCableDetailQueryVariables>,
) {
  const options =
    baseOptions === Apollo.skipToken ? baseOptions : { ...defaultOptions, ...baseOptions };
  return Apollo.useSuspenseQuery<FiberCableDetailQuery, FiberCableDetailQueryVariables>(
    FiberCableDetailDocument,
    options,
  );
}
export type FiberCableDetailQueryHookResult = ReturnType<typeof useFiberCableDetailQuery>;
export type FiberCableDetailLazyQueryHookResult = ReturnType<typeof useFiberCableDetailLazyQuery>;
export type FiberCableDetailSuspenseQueryHookResult = ReturnType<
  typeof useFiberCableDetailSuspenseQuery
>;
export type FiberCableDetailQueryResult = Apollo.QueryResult<
  FiberCableDetailQuery,
  FiberCableDetailQueryVariables
>;
export const FiberCablesByRouteDocument = gql`
  query FiberCablesByRoute($startPointId: String!, $endPointId: String!) {
    fiberCablesByRoute(startPointId: $startPointId, endPointId: $endPointId) {
      id
      cableId
      name
      status
      totalStrands
      availableStrands
      lengthMeters
      capacityUtilizationPercent
    }
  }
`;
export function useFiberCablesByRouteQuery(
  baseOptions: Apollo.QueryHookOptions<FiberCablesByRouteQuery, FiberCablesByRouteQueryVariables> &
    ({ variables: FiberCablesByRouteQueryVariables; skip?: boolean } | { skip: boolean }),
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useQuery<FiberCablesByRouteQuery, FiberCablesByRouteQueryVariables>(
    FiberCablesByRouteDocument,
    options,
  );
}
export function useFiberCablesByRouteLazyQuery(
  baseOptions?: Apollo.LazyQueryHookOptions<
    FiberCablesByRouteQuery,
    FiberCablesByRouteQueryVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useLazyQuery<FiberCablesByRouteQuery, FiberCablesByRouteQueryVariables>(
    FiberCablesByRouteDocument,
    options,
  );
}
export function useFiberCablesByRouteSuspenseQuery(
  baseOptions?:
    | Apollo.SkipToken
    | Apollo.SuspenseQueryHookOptions<FiberCablesByRouteQuery, FiberCablesByRouteQueryVariables>,
) {
  const options =
    baseOptions === Apollo.skipToken ? baseOptions : { ...defaultOptions, ...baseOptions };
  return Apollo.useSuspenseQuery<FiberCablesByRouteQuery, FiberCablesByRouteQueryVariables>(
    FiberCablesByRouteDocument,
    options,
  );
}
export type FiberCablesByRouteQueryHookResult = ReturnType<typeof useFiberCablesByRouteQuery>;
export type FiberCablesByRouteLazyQueryHookResult = ReturnType<
  typeof useFiberCablesByRouteLazyQuery
>;
export type FiberCablesByRouteSuspenseQueryHookResult = ReturnType<
  typeof useFiberCablesByRouteSuspenseQuery
>;
export type FiberCablesByRouteQueryResult = Apollo.QueryResult<
  FiberCablesByRouteQuery,
  FiberCablesByRouteQueryVariables
>;
export const FiberCablesByDistributionPointDocument = gql`
  query FiberCablesByDistributionPoint($distributionPointId: String!) {
    fiberCablesByDistributionPoint(distributionPointId: $distributionPointId) {
      id
      cableId
      name
      status
      totalStrands
      availableStrands
      lengthMeters
    }
  }
`;
export function useFiberCablesByDistributionPointQuery(
  baseOptions: Apollo.QueryHookOptions<
    FiberCablesByDistributionPointQuery,
    FiberCablesByDistributionPointQueryVariables
  > &
    (
      | {
          variables: FiberCablesByDistributionPointQueryVariables;
          skip?: boolean;
        }
      | { skip: boolean }
    ),
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useQuery<
    FiberCablesByDistributionPointQuery,
    FiberCablesByDistributionPointQueryVariables
  >(FiberCablesByDistributionPointDocument, options);
}
export function useFiberCablesByDistributionPointLazyQuery(
  baseOptions?: Apollo.LazyQueryHookOptions<
    FiberCablesByDistributionPointQuery,
    FiberCablesByDistributionPointQueryVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useLazyQuery<
    FiberCablesByDistributionPointQuery,
    FiberCablesByDistributionPointQueryVariables
  >(FiberCablesByDistributionPointDocument, options);
}
export function useFiberCablesByDistributionPointSuspenseQuery(
  baseOptions?:
    | Apollo.SkipToken
    | Apollo.SuspenseQueryHookOptions<
        FiberCablesByDistributionPointQuery,
        FiberCablesByDistributionPointQueryVariables
      >,
) {
  const options =
    baseOptions === Apollo.skipToken ? baseOptions : { ...defaultOptions, ...baseOptions };
  return Apollo.useSuspenseQuery<
    FiberCablesByDistributionPointQuery,
    FiberCablesByDistributionPointQueryVariables
  >(FiberCablesByDistributionPointDocument, options);
}
export type FiberCablesByDistributionPointQueryHookResult = ReturnType<
  typeof useFiberCablesByDistributionPointQuery
>;
export type FiberCablesByDistributionPointLazyQueryHookResult = ReturnType<
  typeof useFiberCablesByDistributionPointLazyQuery
>;
export type FiberCablesByDistributionPointSuspenseQueryHookResult = ReturnType<
  typeof useFiberCablesByDistributionPointSuspenseQuery
>;
export type FiberCablesByDistributionPointQueryResult = Apollo.QueryResult<
  FiberCablesByDistributionPointQuery,
  FiberCablesByDistributionPointQueryVariables
>;
export const SplicePointListDocument = gql`
  query SplicePointList(
    $limit: Int = 50
    $offset: Int = 0
    $status: SpliceStatus
    $cableId: String
    $distributionPointId: String
  ) {
    splicePoints(
      limit: $limit
      offset: $offset
      status: $status
      cableId: $cableId
      distributionPointId: $distributionPointId
    ) {
      splicePoints {
        id
        spliceId
        cableId
        name
        description
        status
        isActive
        location {
          latitude
          longitude
          altitude
        }
        closureType
        manufacturer
        model
        trayCount
        trayCapacity
        cablesConnected
        cableCount
        totalSplices
        activeSplices
        averageSpliceLossDb
        maxSpliceLossDb
        passingSplices
        failingSplices
        accessType
        requiresSpecialAccess
        installedAt
        lastTestedAt
        lastMaintainedAt
        createdAt
        updatedAt
      }
      totalCount
      hasNextPage
    }
  }
`;
export function useSplicePointListQuery(
  baseOptions?: Apollo.QueryHookOptions<SplicePointListQuery, SplicePointListQueryVariables>,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useQuery<SplicePointListQuery, SplicePointListQueryVariables>(
    SplicePointListDocument,
    options,
  );
}
export function useSplicePointListLazyQuery(
  baseOptions?: Apollo.LazyQueryHookOptions<SplicePointListQuery, SplicePointListQueryVariables>,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useLazyQuery<SplicePointListQuery, SplicePointListQueryVariables>(
    SplicePointListDocument,
    options,
  );
}
export function useSplicePointListSuspenseQuery(
  baseOptions?:
    | Apollo.SkipToken
    | Apollo.SuspenseQueryHookOptions<SplicePointListQuery, SplicePointListQueryVariables>,
) {
  const options =
    baseOptions === Apollo.skipToken ? baseOptions : { ...defaultOptions, ...baseOptions };
  return Apollo.useSuspenseQuery<SplicePointListQuery, SplicePointListQueryVariables>(
    SplicePointListDocument,
    options,
  );
}
export type SplicePointListQueryHookResult = ReturnType<typeof useSplicePointListQuery>;
export type SplicePointListLazyQueryHookResult = ReturnType<typeof useSplicePointListLazyQuery>;
export type SplicePointListSuspenseQueryHookResult = ReturnType<
  typeof useSplicePointListSuspenseQuery
>;
export type SplicePointListQueryResult = Apollo.QueryResult<
  SplicePointListQuery,
  SplicePointListQueryVariables
>;
export const SplicePointDetailDocument = gql`
  query SplicePointDetail($id: ID!) {
    splicePoint(id: $id) {
      id
      spliceId
      name
      description
      status
      isActive
      location {
        latitude
        longitude
        altitude
      }
      address {
        streetAddress
        city
        stateProvince
        postalCode
        country
      }
      distributionPointId
      closureType
      manufacturer
      model
      trayCount
      trayCapacity
      cablesConnected
      cableCount
      spliceConnections {
        cableAId
        cableAStrand
        cableBId
        cableBStrand
        spliceType
        lossDb
        reflectanceDb
        isPassing
        testResult
        testedAt
        testedBy
      }
      totalSplices
      activeSplices
      averageSpliceLossDb
      maxSpliceLossDb
      passingSplices
      failingSplices
      accessType
      requiresSpecialAccess
      accessNotes
      installedAt
      lastTestedAt
      lastMaintainedAt
      createdAt
      updatedAt
    }
  }
`;
export function useSplicePointDetailQuery(
  baseOptions: Apollo.QueryHookOptions<SplicePointDetailQuery, SplicePointDetailQueryVariables> &
    ({ variables: SplicePointDetailQueryVariables; skip?: boolean } | { skip: boolean }),
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useQuery<SplicePointDetailQuery, SplicePointDetailQueryVariables>(
    SplicePointDetailDocument,
    options,
  );
}
export function useSplicePointDetailLazyQuery(
  baseOptions?: Apollo.LazyQueryHookOptions<
    SplicePointDetailQuery,
    SplicePointDetailQueryVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useLazyQuery<SplicePointDetailQuery, SplicePointDetailQueryVariables>(
    SplicePointDetailDocument,
    options,
  );
}
export function useSplicePointDetailSuspenseQuery(
  baseOptions?:
    | Apollo.SkipToken
    | Apollo.SuspenseQueryHookOptions<SplicePointDetailQuery, SplicePointDetailQueryVariables>,
) {
  const options =
    baseOptions === Apollo.skipToken ? baseOptions : { ...defaultOptions, ...baseOptions };
  return Apollo.useSuspenseQuery<SplicePointDetailQuery, SplicePointDetailQueryVariables>(
    SplicePointDetailDocument,
    options,
  );
}
export type SplicePointDetailQueryHookResult = ReturnType<typeof useSplicePointDetailQuery>;
export type SplicePointDetailLazyQueryHookResult = ReturnType<typeof useSplicePointDetailLazyQuery>;
export type SplicePointDetailSuspenseQueryHookResult = ReturnType<
  typeof useSplicePointDetailSuspenseQuery
>;
export type SplicePointDetailQueryResult = Apollo.QueryResult<
  SplicePointDetailQuery,
  SplicePointDetailQueryVariables
>;
export const SplicePointsByCableDocument = gql`
  query SplicePointsByCable($cableId: String!) {
    splicePointsByCable(cableId: $cableId) {
      id
      spliceId
      cableId
      name
      status
      totalSplices
      activeSplices
      averageSpliceLossDb
      passingSplices
    }
  }
`;
export function useSplicePointsByCableQuery(
  baseOptions: Apollo.QueryHookOptions<
    SplicePointsByCableQuery,
    SplicePointsByCableQueryVariables
  > &
    ({ variables: SplicePointsByCableQueryVariables; skip?: boolean } | { skip: boolean }),
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useQuery<SplicePointsByCableQuery, SplicePointsByCableQueryVariables>(
    SplicePointsByCableDocument,
    options,
  );
}
export function useSplicePointsByCableLazyQuery(
  baseOptions?: Apollo.LazyQueryHookOptions<
    SplicePointsByCableQuery,
    SplicePointsByCableQueryVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useLazyQuery<SplicePointsByCableQuery, SplicePointsByCableQueryVariables>(
    SplicePointsByCableDocument,
    options,
  );
}
export function useSplicePointsByCableSuspenseQuery(
  baseOptions?:
    | Apollo.SkipToken
    | Apollo.SuspenseQueryHookOptions<SplicePointsByCableQuery, SplicePointsByCableQueryVariables>,
) {
  const options =
    baseOptions === Apollo.skipToken ? baseOptions : { ...defaultOptions, ...baseOptions };
  return Apollo.useSuspenseQuery<SplicePointsByCableQuery, SplicePointsByCableQueryVariables>(
    SplicePointsByCableDocument,
    options,
  );
}
export type SplicePointsByCableQueryHookResult = ReturnType<typeof useSplicePointsByCableQuery>;
export type SplicePointsByCableLazyQueryHookResult = ReturnType<
  typeof useSplicePointsByCableLazyQuery
>;
export type SplicePointsByCableSuspenseQueryHookResult = ReturnType<
  typeof useSplicePointsByCableSuspenseQuery
>;
export type SplicePointsByCableQueryResult = Apollo.QueryResult<
  SplicePointsByCableQuery,
  SplicePointsByCableQueryVariables
>;
export const DistributionPointListDocument = gql`
  query DistributionPointList(
    $limit: Int = 50
    $offset: Int = 0
    $pointType: DistributionPointType
    $status: FiberCableStatus
    $siteId: String
    $nearCapacity: Boolean
  ) {
    distributionPoints(
      limit: $limit
      offset: $offset
      pointType: $pointType
      status: $status
      siteId: $siteId
      nearCapacity: $nearCapacity
    ) {
      distributionPoints {
        id
        siteId
        name
        description
        pointType
        status
        isActive
        location {
          latitude
          longitude
          altitude
        }
        manufacturer
        model
        totalCapacity
        availableCapacity
        usedCapacity
        portCount
        incomingCables
        outgoingCables
        totalCablesConnected
        splicePointCount
        hasPower
        batteryBackup
        environmentalMonitoring
        temperatureCelsius
        humidityPercent
        capacityUtilizationPercent
        fiberStrandCount
        availableStrandCount
        servesCustomerCount
        accessType
        requiresKey
        installedAt
        lastInspectedAt
        lastMaintainedAt
        createdAt
        updatedAt
      }
      totalCount
      hasNextPage
    }
  }
`;
export function useDistributionPointListQuery(
  baseOptions?: Apollo.QueryHookOptions<
    DistributionPointListQuery,
    DistributionPointListQueryVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useQuery<DistributionPointListQuery, DistributionPointListQueryVariables>(
    DistributionPointListDocument,
    options,
  );
}
export function useDistributionPointListLazyQuery(
  baseOptions?: Apollo.LazyQueryHookOptions<
    DistributionPointListQuery,
    DistributionPointListQueryVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useLazyQuery<DistributionPointListQuery, DistributionPointListQueryVariables>(
    DistributionPointListDocument,
    options,
  );
}
export function useDistributionPointListSuspenseQuery(
  baseOptions?:
    | Apollo.SkipToken
    | Apollo.SuspenseQueryHookOptions<
        DistributionPointListQuery,
        DistributionPointListQueryVariables
      >,
) {
  const options =
    baseOptions === Apollo.skipToken ? baseOptions : { ...defaultOptions, ...baseOptions };
  return Apollo.useSuspenseQuery<DistributionPointListQuery, DistributionPointListQueryVariables>(
    DistributionPointListDocument,
    options,
  );
}
export type DistributionPointListQueryHookResult = ReturnType<typeof useDistributionPointListQuery>;
export type DistributionPointListLazyQueryHookResult = ReturnType<
  typeof useDistributionPointListLazyQuery
>;
export type DistributionPointListSuspenseQueryHookResult = ReturnType<
  typeof useDistributionPointListSuspenseQuery
>;
export type DistributionPointListQueryResult = Apollo.QueryResult<
  DistributionPointListQuery,
  DistributionPointListQueryVariables
>;
export const DistributionPointDetailDocument = gql`
  query DistributionPointDetail($id: ID!) {
    distributionPoint(id: $id) {
      id
      siteId
      name
      description
      pointType
      status
      isActive
      location {
        latitude
        longitude
        altitude
      }
      address {
        streetAddress
        city
        stateProvince
        postalCode
        country
      }
      siteName
      manufacturer
      model
      totalCapacity
      availableCapacity
      usedCapacity
      ports {
        portNumber
        isAllocated
        isActive
        cableId
        strandId
        customerId
        customerName
        serviceId
      }
      portCount
      incomingCables
      outgoingCables
      totalCablesConnected
      splicePoints
      splicePointCount
      hasPower
      batteryBackup
      environmentalMonitoring
      temperatureCelsius
      humidityPercent
      capacityUtilizationPercent
      fiberStrandCount
      availableStrandCount
      serviceAreaIds
      servesCustomerCount
      accessType
      requiresKey
      securityLevel
      accessNotes
      installedAt
      lastInspectedAt
      lastMaintainedAt
      createdAt
      updatedAt
    }
  }
`;
export function useDistributionPointDetailQuery(
  baseOptions: Apollo.QueryHookOptions<
    DistributionPointDetailQuery,
    DistributionPointDetailQueryVariables
  > &
    ({ variables: DistributionPointDetailQueryVariables; skip?: boolean } | { skip: boolean }),
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useQuery<DistributionPointDetailQuery, DistributionPointDetailQueryVariables>(
    DistributionPointDetailDocument,
    options,
  );
}
export function useDistributionPointDetailLazyQuery(
  baseOptions?: Apollo.LazyQueryHookOptions<
    DistributionPointDetailQuery,
    DistributionPointDetailQueryVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useLazyQuery<DistributionPointDetailQuery, DistributionPointDetailQueryVariables>(
    DistributionPointDetailDocument,
    options,
  );
}
export function useDistributionPointDetailSuspenseQuery(
  baseOptions?:
    | Apollo.SkipToken
    | Apollo.SuspenseQueryHookOptions<
        DistributionPointDetailQuery,
        DistributionPointDetailQueryVariables
      >,
) {
  const options =
    baseOptions === Apollo.skipToken ? baseOptions : { ...defaultOptions, ...baseOptions };
  return Apollo.useSuspenseQuery<
    DistributionPointDetailQuery,
    DistributionPointDetailQueryVariables
  >(DistributionPointDetailDocument, options);
}
export type DistributionPointDetailQueryHookResult = ReturnType<
  typeof useDistributionPointDetailQuery
>;
export type DistributionPointDetailLazyQueryHookResult = ReturnType<
  typeof useDistributionPointDetailLazyQuery
>;
export type DistributionPointDetailSuspenseQueryHookResult = ReturnType<
  typeof useDistributionPointDetailSuspenseQuery
>;
export type DistributionPointDetailQueryResult = Apollo.QueryResult<
  DistributionPointDetailQuery,
  DistributionPointDetailQueryVariables
>;
export const DistributionPointsBySiteDocument = gql`
  query DistributionPointsBySite($siteId: String!) {
    distributionPointsBySite(siteId: $siteId) {
      id
      siteId
      name
      pointType
      status
      totalCapacity
      availableCapacity
      capacityUtilizationPercent
      totalCablesConnected
      servesCustomerCount
    }
  }
`;
export function useDistributionPointsBySiteQuery(
  baseOptions: Apollo.QueryHookOptions<
    DistributionPointsBySiteQuery,
    DistributionPointsBySiteQueryVariables
  > &
    ({ variables: DistributionPointsBySiteQueryVariables; skip?: boolean } | { skip: boolean }),
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useQuery<DistributionPointsBySiteQuery, DistributionPointsBySiteQueryVariables>(
    DistributionPointsBySiteDocument,
    options,
  );
}
export function useDistributionPointsBySiteLazyQuery(
  baseOptions?: Apollo.LazyQueryHookOptions<
    DistributionPointsBySiteQuery,
    DistributionPointsBySiteQueryVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useLazyQuery<DistributionPointsBySiteQuery, DistributionPointsBySiteQueryVariables>(
    DistributionPointsBySiteDocument,
    options,
  );
}
export function useDistributionPointsBySiteSuspenseQuery(
  baseOptions?:
    | Apollo.SkipToken
    | Apollo.SuspenseQueryHookOptions<
        DistributionPointsBySiteQuery,
        DistributionPointsBySiteQueryVariables
      >,
) {
  const options =
    baseOptions === Apollo.skipToken ? baseOptions : { ...defaultOptions, ...baseOptions };
  return Apollo.useSuspenseQuery<
    DistributionPointsBySiteQuery,
    DistributionPointsBySiteQueryVariables
  >(DistributionPointsBySiteDocument, options);
}
export type DistributionPointsBySiteQueryHookResult = ReturnType<
  typeof useDistributionPointsBySiteQuery
>;
export type DistributionPointsBySiteLazyQueryHookResult = ReturnType<
  typeof useDistributionPointsBySiteLazyQuery
>;
export type DistributionPointsBySiteSuspenseQueryHookResult = ReturnType<
  typeof useDistributionPointsBySiteSuspenseQuery
>;
export type DistributionPointsBySiteQueryResult = Apollo.QueryResult<
  DistributionPointsBySiteQuery,
  DistributionPointsBySiteQueryVariables
>;
export const ServiceAreaListDocument = gql`
  query ServiceAreaList(
    $limit: Int = 50
    $offset: Int = 0
    $areaType: ServiceAreaType
    $isServiceable: Boolean
    $constructionStatus: String
  ) {
    serviceAreas(
      limit: $limit
      offset: $offset
      areaType: $areaType
      isServiceable: $isServiceable
      constructionStatus: $constructionStatus
    ) {
      serviceAreas {
        id
        areaId
        name
        description
        areaType
        isActive
        isServiceable
        boundaryGeojson
        areaSqkm
        city
        stateProvince
        postalCodes
        streetCount
        homesPassed
        homesConnected
        businessesPassed
        businessesConnected
        penetrationRatePercent
        distributionPointCount
        totalFiberKm
        totalCapacity
        usedCapacity
        availableCapacity
        capacityUtilizationPercent
        maxBandwidthGbps
        estimatedPopulation
        householdDensityPerSqkm
        constructionStatus
        constructionCompletePercent
        targetCompletionDate
        plannedAt
        constructionStartedAt
        activatedAt
        createdAt
        updatedAt
      }
      totalCount
      hasNextPage
    }
  }
`;
export function useServiceAreaListQuery(
  baseOptions?: Apollo.QueryHookOptions<ServiceAreaListQuery, ServiceAreaListQueryVariables>,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useQuery<ServiceAreaListQuery, ServiceAreaListQueryVariables>(
    ServiceAreaListDocument,
    options,
  );
}
export function useServiceAreaListLazyQuery(
  baseOptions?: Apollo.LazyQueryHookOptions<ServiceAreaListQuery, ServiceAreaListQueryVariables>,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useLazyQuery<ServiceAreaListQuery, ServiceAreaListQueryVariables>(
    ServiceAreaListDocument,
    options,
  );
}
export function useServiceAreaListSuspenseQuery(
  baseOptions?:
    | Apollo.SkipToken
    | Apollo.SuspenseQueryHookOptions<ServiceAreaListQuery, ServiceAreaListQueryVariables>,
) {
  const options =
    baseOptions === Apollo.skipToken ? baseOptions : { ...defaultOptions, ...baseOptions };
  return Apollo.useSuspenseQuery<ServiceAreaListQuery, ServiceAreaListQueryVariables>(
    ServiceAreaListDocument,
    options,
  );
}
export type ServiceAreaListQueryHookResult = ReturnType<typeof useServiceAreaListQuery>;
export type ServiceAreaListLazyQueryHookResult = ReturnType<typeof useServiceAreaListLazyQuery>;
export type ServiceAreaListSuspenseQueryHookResult = ReturnType<
  typeof useServiceAreaListSuspenseQuery
>;
export type ServiceAreaListQueryResult = Apollo.QueryResult<
  ServiceAreaListQuery,
  ServiceAreaListQueryVariables
>;
export const ServiceAreaDetailDocument = gql`
  query ServiceAreaDetail($id: ID!) {
    serviceArea(id: $id) {
      id
      areaId
      name
      description
      areaType
      isActive
      isServiceable
      boundaryGeojson
      areaSqkm
      city
      stateProvince
      postalCodes
      streetCount
      homesPassed
      homesConnected
      businessesPassed
      businessesConnected
      penetrationRatePercent
      distributionPointIds
      distributionPointCount
      totalFiberKm
      totalCapacity
      usedCapacity
      availableCapacity
      capacityUtilizationPercent
      maxBandwidthGbps
      averageDistanceToDistributionMeters
      estimatedPopulation
      householdDensityPerSqkm
      constructionStatus
      constructionCompletePercent
      targetCompletionDate
      plannedAt
      constructionStartedAt
      activatedAt
      createdAt
      updatedAt
    }
  }
`;
export function useServiceAreaDetailQuery(
  baseOptions: Apollo.QueryHookOptions<ServiceAreaDetailQuery, ServiceAreaDetailQueryVariables> &
    ({ variables: ServiceAreaDetailQueryVariables; skip?: boolean } | { skip: boolean }),
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useQuery<ServiceAreaDetailQuery, ServiceAreaDetailQueryVariables>(
    ServiceAreaDetailDocument,
    options,
  );
}
export function useServiceAreaDetailLazyQuery(
  baseOptions?: Apollo.LazyQueryHookOptions<
    ServiceAreaDetailQuery,
    ServiceAreaDetailQueryVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useLazyQuery<ServiceAreaDetailQuery, ServiceAreaDetailQueryVariables>(
    ServiceAreaDetailDocument,
    options,
  );
}
export function useServiceAreaDetailSuspenseQuery(
  baseOptions?:
    | Apollo.SkipToken
    | Apollo.SuspenseQueryHookOptions<ServiceAreaDetailQuery, ServiceAreaDetailQueryVariables>,
) {
  const options =
    baseOptions === Apollo.skipToken ? baseOptions : { ...defaultOptions, ...baseOptions };
  return Apollo.useSuspenseQuery<ServiceAreaDetailQuery, ServiceAreaDetailQueryVariables>(
    ServiceAreaDetailDocument,
    options,
  );
}
export type ServiceAreaDetailQueryHookResult = ReturnType<typeof useServiceAreaDetailQuery>;
export type ServiceAreaDetailLazyQueryHookResult = ReturnType<typeof useServiceAreaDetailLazyQuery>;
export type ServiceAreaDetailSuspenseQueryHookResult = ReturnType<
  typeof useServiceAreaDetailSuspenseQuery
>;
export type ServiceAreaDetailQueryResult = Apollo.QueryResult<
  ServiceAreaDetailQuery,
  ServiceAreaDetailQueryVariables
>;
export const ServiceAreasByPostalCodeDocument = gql`
  query ServiceAreasByPostalCode($postalCode: String!) {
    serviceAreasByPostalCode(postalCode: $postalCode) {
      id
      areaId
      name
      city
      stateProvince
      isServiceable
      postalCodes
      homesPassed
      homesConnected
      penetrationRatePercent
      maxBandwidthGbps
    }
  }
`;
export function useServiceAreasByPostalCodeQuery(
  baseOptions: Apollo.QueryHookOptions<
    ServiceAreasByPostalCodeQuery,
    ServiceAreasByPostalCodeQueryVariables
  > &
    ({ variables: ServiceAreasByPostalCodeQueryVariables; skip?: boolean } | { skip: boolean }),
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useQuery<ServiceAreasByPostalCodeQuery, ServiceAreasByPostalCodeQueryVariables>(
    ServiceAreasByPostalCodeDocument,
    options,
  );
}
export function useServiceAreasByPostalCodeLazyQuery(
  baseOptions?: Apollo.LazyQueryHookOptions<
    ServiceAreasByPostalCodeQuery,
    ServiceAreasByPostalCodeQueryVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useLazyQuery<ServiceAreasByPostalCodeQuery, ServiceAreasByPostalCodeQueryVariables>(
    ServiceAreasByPostalCodeDocument,
    options,
  );
}
export function useServiceAreasByPostalCodeSuspenseQuery(
  baseOptions?:
    | Apollo.SkipToken
    | Apollo.SuspenseQueryHookOptions<
        ServiceAreasByPostalCodeQuery,
        ServiceAreasByPostalCodeQueryVariables
      >,
) {
  const options =
    baseOptions === Apollo.skipToken ? baseOptions : { ...defaultOptions, ...baseOptions };
  return Apollo.useSuspenseQuery<
    ServiceAreasByPostalCodeQuery,
    ServiceAreasByPostalCodeQueryVariables
  >(ServiceAreasByPostalCodeDocument, options);
}
export type ServiceAreasByPostalCodeQueryHookResult = ReturnType<
  typeof useServiceAreasByPostalCodeQuery
>;
export type ServiceAreasByPostalCodeLazyQueryHookResult = ReturnType<
  typeof useServiceAreasByPostalCodeLazyQuery
>;
export type ServiceAreasByPostalCodeSuspenseQueryHookResult = ReturnType<
  typeof useServiceAreasByPostalCodeSuspenseQuery
>;
export type ServiceAreasByPostalCodeQueryResult = Apollo.QueryResult<
  ServiceAreasByPostalCodeQuery,
  ServiceAreasByPostalCodeQueryVariables
>;
export const FiberHealthMetricsDocument = gql`
  query FiberHealthMetrics($cableId: String, $healthStatus: FiberHealthStatus) {
    fiberHealthMetrics(cableId: $cableId, healthStatus: $healthStatus) {
      cableId
      cableName
      healthStatus
      healthScore
      totalLossDb
      averageLossPerKmDb
      maxLossPerKmDb
      reflectanceDb
      averageSpliceLossDb
      maxSpliceLossDb
      failingSplicesCount
      totalStrands
      activeStrands
      degradedStrands
      failedStrands
      lastTestedAt
      testPassRatePercent
      daysSinceLastTest
      activeAlarms
      warningCount
      requiresMaintenance
    }
  }
`;
export function useFiberHealthMetricsQuery(
  baseOptions?: Apollo.QueryHookOptions<FiberHealthMetricsQuery, FiberHealthMetricsQueryVariables>,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useQuery<FiberHealthMetricsQuery, FiberHealthMetricsQueryVariables>(
    FiberHealthMetricsDocument,
    options,
  );
}
export function useFiberHealthMetricsLazyQuery(
  baseOptions?: Apollo.LazyQueryHookOptions<
    FiberHealthMetricsQuery,
    FiberHealthMetricsQueryVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useLazyQuery<FiberHealthMetricsQuery, FiberHealthMetricsQueryVariables>(
    FiberHealthMetricsDocument,
    options,
  );
}
export function useFiberHealthMetricsSuspenseQuery(
  baseOptions?:
    | Apollo.SkipToken
    | Apollo.SuspenseQueryHookOptions<FiberHealthMetricsQuery, FiberHealthMetricsQueryVariables>,
) {
  const options =
    baseOptions === Apollo.skipToken ? baseOptions : { ...defaultOptions, ...baseOptions };
  return Apollo.useSuspenseQuery<FiberHealthMetricsQuery, FiberHealthMetricsQueryVariables>(
    FiberHealthMetricsDocument,
    options,
  );
}
export type FiberHealthMetricsQueryHookResult = ReturnType<typeof useFiberHealthMetricsQuery>;
export type FiberHealthMetricsLazyQueryHookResult = ReturnType<
  typeof useFiberHealthMetricsLazyQuery
>;
export type FiberHealthMetricsSuspenseQueryHookResult = ReturnType<
  typeof useFiberHealthMetricsSuspenseQuery
>;
export type FiberHealthMetricsQueryResult = Apollo.QueryResult<
  FiberHealthMetricsQuery,
  FiberHealthMetricsQueryVariables
>;
export const OtdrTestResultsDocument = gql`
  query OTDRTestResults($cableId: String!, $strandId: Int, $limit: Int = 10) {
    otdrTestResults(cableId: $cableId, strandId: $strandId, limit: $limit) {
      testId
      cableId
      strandId
      testedAt
      testedBy
      wavelengthNm
      pulseWidthNs
      totalLossDb
      totalLengthMeters
      averageAttenuationDbPerKm
      spliceCount
      connectorCount
      bendCount
      breakCount
      isPassing
      passThresholdDb
      marginDb
      traceFileUrl
    }
  }
`;
export function useOtdrTestResultsQuery(
  baseOptions: Apollo.QueryHookOptions<OtdrTestResultsQuery, OtdrTestResultsQueryVariables> &
    ({ variables: OtdrTestResultsQueryVariables; skip?: boolean } | { skip: boolean }),
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useQuery<OtdrTestResultsQuery, OtdrTestResultsQueryVariables>(
    OtdrTestResultsDocument,
    options,
  );
}
export function useOtdrTestResultsLazyQuery(
  baseOptions?: Apollo.LazyQueryHookOptions<OtdrTestResultsQuery, OtdrTestResultsQueryVariables>,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useLazyQuery<OtdrTestResultsQuery, OtdrTestResultsQueryVariables>(
    OtdrTestResultsDocument,
    options,
  );
}
export function useOtdrTestResultsSuspenseQuery(
  baseOptions?:
    | Apollo.SkipToken
    | Apollo.SuspenseQueryHookOptions<OtdrTestResultsQuery, OtdrTestResultsQueryVariables>,
) {
  const options =
    baseOptions === Apollo.skipToken ? baseOptions : { ...defaultOptions, ...baseOptions };
  return Apollo.useSuspenseQuery<OtdrTestResultsQuery, OtdrTestResultsQueryVariables>(
    OtdrTestResultsDocument,
    options,
  );
}
export type OtdrTestResultsQueryHookResult = ReturnType<typeof useOtdrTestResultsQuery>;
export type OtdrTestResultsLazyQueryHookResult = ReturnType<typeof useOtdrTestResultsLazyQuery>;
export type OtdrTestResultsSuspenseQueryHookResult = ReturnType<
  typeof useOtdrTestResultsSuspenseQuery
>;
export type OtdrTestResultsQueryResult = Apollo.QueryResult<
  OtdrTestResultsQuery,
  OtdrTestResultsQueryVariables
>;
export const FiberNetworkAnalyticsDocument = gql`
  query FiberNetworkAnalytics {
    fiberNetworkAnalytics {
      totalFiberKm
      totalCables
      totalStrands
      totalDistributionPoints
      totalSplicePoints
      totalCapacity
      usedCapacity
      availableCapacity
      capacityUtilizationPercent
      cablesByStatus
      cablesByType
      healthyCables
      degradedCables
      failedCables
      networkHealthScore
      totalServiceAreas
      activeServiceAreas
      homesPassed
      homesConnected
      penetrationRatePercent
      averageCableLossDbPerKm
      averageSpliceLossDb
      cablesDueForTesting
      cablesActive
      cablesInactive
      cablesUnderConstruction
      cablesMaintenance
      cablesWithHighLoss
      distributionPointsNearCapacity
      serviceAreasNeedsExpansion
      generatedAt
    }
  }
`;
export function useFiberNetworkAnalyticsQuery(
  baseOptions?: Apollo.QueryHookOptions<
    FiberNetworkAnalyticsQuery,
    FiberNetworkAnalyticsQueryVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useQuery<FiberNetworkAnalyticsQuery, FiberNetworkAnalyticsQueryVariables>(
    FiberNetworkAnalyticsDocument,
    options,
  );
}
export function useFiberNetworkAnalyticsLazyQuery(
  baseOptions?: Apollo.LazyQueryHookOptions<
    FiberNetworkAnalyticsQuery,
    FiberNetworkAnalyticsQueryVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useLazyQuery<FiberNetworkAnalyticsQuery, FiberNetworkAnalyticsQueryVariables>(
    FiberNetworkAnalyticsDocument,
    options,
  );
}
export function useFiberNetworkAnalyticsSuspenseQuery(
  baseOptions?:
    | Apollo.SkipToken
    | Apollo.SuspenseQueryHookOptions<
        FiberNetworkAnalyticsQuery,
        FiberNetworkAnalyticsQueryVariables
      >,
) {
  const options =
    baseOptions === Apollo.skipToken ? baseOptions : { ...defaultOptions, ...baseOptions };
  return Apollo.useSuspenseQuery<FiberNetworkAnalyticsQuery, FiberNetworkAnalyticsQueryVariables>(
    FiberNetworkAnalyticsDocument,
    options,
  );
}
export type FiberNetworkAnalyticsQueryHookResult = ReturnType<typeof useFiberNetworkAnalyticsQuery>;
export type FiberNetworkAnalyticsLazyQueryHookResult = ReturnType<
  typeof useFiberNetworkAnalyticsLazyQuery
>;
export type FiberNetworkAnalyticsSuspenseQueryHookResult = ReturnType<
  typeof useFiberNetworkAnalyticsSuspenseQuery
>;
export type FiberNetworkAnalyticsQueryResult = Apollo.QueryResult<
  FiberNetworkAnalyticsQuery,
  FiberNetworkAnalyticsQueryVariables
>;
export const FiberDashboardDocument = gql`
  query FiberDashboard {
    fiberDashboard {
      analytics {
        totalFiberKm
        totalCables
        totalStrands
        totalDistributionPoints
        totalSplicePoints
        capacityUtilizationPercent
        networkHealthScore
        homesPassed
        homesConnected
        penetrationRatePercent
      }
      topCablesByUtilization {
        id
        cableId
        name
        capacityUtilizationPercent
        totalStrands
        usedStrands
      }
      topDistributionPointsByCapacity {
        id
        name
        capacityUtilizationPercent
        totalCapacity
        usedCapacity
      }
      topServiceAreasByPenetration {
        id
        name
        city
        penetrationRatePercent
        homesPassed
        homesConnected
      }
      cablesRequiringAttention {
        id
        cableId
        cableName
        healthStatus
        healthScore
        requiresMaintenance
      }
      recentTestResults {
        testId
        cableId
        strandId
        testedAt
        isPassing
        totalLossDb
      }
      distributionPointsNearCapacity {
        id
        name
        capacityUtilizationPercent
      }
      serviceAreasExpansionCandidates {
        id
        name
        penetrationRatePercent
        homesPassed
      }
      newConnectionsTrend
      capacityUtilizationTrend
      networkHealthTrend
      generatedAt
    }
  }
`;
export function useFiberDashboardQuery(
  baseOptions?: Apollo.QueryHookOptions<FiberDashboardQuery, FiberDashboardQueryVariables>,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useQuery<FiberDashboardQuery, FiberDashboardQueryVariables>(
    FiberDashboardDocument,
    options,
  );
}
export function useFiberDashboardLazyQuery(
  baseOptions?: Apollo.LazyQueryHookOptions<FiberDashboardQuery, FiberDashboardQueryVariables>,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useLazyQuery<FiberDashboardQuery, FiberDashboardQueryVariables>(
    FiberDashboardDocument,
    options,
  );
}
export function useFiberDashboardSuspenseQuery(
  baseOptions?:
    | Apollo.SkipToken
    | Apollo.SuspenseQueryHookOptions<FiberDashboardQuery, FiberDashboardQueryVariables>,
) {
  const options =
    baseOptions === Apollo.skipToken ? baseOptions : { ...defaultOptions, ...baseOptions };
  return Apollo.useSuspenseQuery<FiberDashboardQuery, FiberDashboardQueryVariables>(
    FiberDashboardDocument,
    options,
  );
}
export type FiberDashboardQueryHookResult = ReturnType<typeof useFiberDashboardQuery>;
export type FiberDashboardLazyQueryHookResult = ReturnType<typeof useFiberDashboardLazyQuery>;
export type FiberDashboardSuspenseQueryHookResult = ReturnType<
  typeof useFiberDashboardSuspenseQuery
>;
export type FiberDashboardQueryResult = Apollo.QueryResult<
  FiberDashboardQuery,
  FiberDashboardQueryVariables
>;
export const NetworkOverviewDocument = gql`
  query NetworkOverview {
    networkOverview {
      totalDevices
      onlineDevices
      offlineDevices
      activeAlerts
      criticalAlerts
      totalBandwidthGbps
      uptimePercentage
      deviceTypeSummary {
        deviceType
        totalCount
        onlineCount
        avgCpuUsage
        avgMemoryUsage
      }
      recentAlerts {
        alertId
        severity
        title
        description
        deviceName
        deviceId
        deviceType
        triggeredAt
        acknowledgedAt
        resolvedAt
        isActive
      }
    }
  }
`;
export function useNetworkOverviewQuery(
  baseOptions?: Apollo.QueryHookOptions<NetworkOverviewQuery, NetworkOverviewQueryVariables>,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useQuery<NetworkOverviewQuery, NetworkOverviewQueryVariables>(
    NetworkOverviewDocument,
    options,
  );
}
export function useNetworkOverviewLazyQuery(
  baseOptions?: Apollo.LazyQueryHookOptions<NetworkOverviewQuery, NetworkOverviewQueryVariables>,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useLazyQuery<NetworkOverviewQuery, NetworkOverviewQueryVariables>(
    NetworkOverviewDocument,
    options,
  );
}
export function useNetworkOverviewSuspenseQuery(
  baseOptions?:
    | Apollo.SkipToken
    | Apollo.SuspenseQueryHookOptions<NetworkOverviewQuery, NetworkOverviewQueryVariables>,
) {
  const options =
    baseOptions === Apollo.skipToken ? baseOptions : { ...defaultOptions, ...baseOptions };
  return Apollo.useSuspenseQuery<NetworkOverviewQuery, NetworkOverviewQueryVariables>(
    NetworkOverviewDocument,
    options,
  );
}
export type NetworkOverviewQueryHookResult = ReturnType<typeof useNetworkOverviewQuery>;
export type NetworkOverviewLazyQueryHookResult = ReturnType<typeof useNetworkOverviewLazyQuery>;
export type NetworkOverviewSuspenseQueryHookResult = ReturnType<
  typeof useNetworkOverviewSuspenseQuery
>;
export type NetworkOverviewQueryResult = Apollo.QueryResult<
  NetworkOverviewQuery,
  NetworkOverviewQueryVariables
>;
export const NetworkDeviceListDocument = gql`
  query NetworkDeviceList(
    $page: Int = 1
    $pageSize: Int = 20
    $deviceType: DeviceTypeEnum
    $status: DeviceStatusEnum
    $search: String
  ) {
    networkDevices(
      page: $page
      pageSize: $pageSize
      deviceType: $deviceType
      status: $status
      search: $search
    ) {
      devices {
        deviceId
        deviceName
        deviceType
        status
        ipAddress
        firmwareVersion
        model
        location
        tenantId
        cpuUsagePercent
        memoryUsagePercent
        temperatureCelsius
        powerStatus
        pingLatencyMs
        packetLossPercent
        uptimeSeconds
        uptimeDays
        lastSeen
        isHealthy
      }
      totalCount
      hasNextPage
      hasPrevPage
      page
      pageSize
    }
  }
`;
export function useNetworkDeviceListQuery(
  baseOptions?: Apollo.QueryHookOptions<NetworkDeviceListQuery, NetworkDeviceListQueryVariables>,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useQuery<NetworkDeviceListQuery, NetworkDeviceListQueryVariables>(
    NetworkDeviceListDocument,
    options,
  );
}
export function useNetworkDeviceListLazyQuery(
  baseOptions?: Apollo.LazyQueryHookOptions<
    NetworkDeviceListQuery,
    NetworkDeviceListQueryVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useLazyQuery<NetworkDeviceListQuery, NetworkDeviceListQueryVariables>(
    NetworkDeviceListDocument,
    options,
  );
}
export function useNetworkDeviceListSuspenseQuery(
  baseOptions?:
    | Apollo.SkipToken
    | Apollo.SuspenseQueryHookOptions<NetworkDeviceListQuery, NetworkDeviceListQueryVariables>,
) {
  const options =
    baseOptions === Apollo.skipToken ? baseOptions : { ...defaultOptions, ...baseOptions };
  return Apollo.useSuspenseQuery<NetworkDeviceListQuery, NetworkDeviceListQueryVariables>(
    NetworkDeviceListDocument,
    options,
  );
}
export type NetworkDeviceListQueryHookResult = ReturnType<typeof useNetworkDeviceListQuery>;
export type NetworkDeviceListLazyQueryHookResult = ReturnType<typeof useNetworkDeviceListLazyQuery>;
export type NetworkDeviceListSuspenseQueryHookResult = ReturnType<
  typeof useNetworkDeviceListSuspenseQuery
>;
export type NetworkDeviceListQueryResult = Apollo.QueryResult<
  NetworkDeviceListQuery,
  NetworkDeviceListQueryVariables
>;
export const DeviceDetailDocument = gql`
  query DeviceDetail($deviceId: String!, $deviceType: DeviceTypeEnum!) {
    deviceHealth(deviceId: $deviceId, deviceType: $deviceType) {
      deviceId
      deviceName
      deviceType
      status
      ipAddress
      firmwareVersion
      model
      location
      tenantId
      cpuUsagePercent
      memoryUsagePercent
      temperatureCelsius
      powerStatus
      pingLatencyMs
      packetLossPercent
      uptimeSeconds
      uptimeDays
      lastSeen
      isHealthy
    }
    deviceTraffic(deviceId: $deviceId, deviceType: $deviceType) {
      deviceId
      deviceName
      totalBandwidthGbps
      currentRateInMbps
      currentRateOutMbps
      totalBytesIn
      totalBytesOut
      totalPacketsIn
      totalPacketsOut
      peakRateInBps
      peakRateOutBps
      peakTimestamp
      timestamp
    }
  }
`;
export function useDeviceDetailQuery(
  baseOptions: Apollo.QueryHookOptions<DeviceDetailQuery, DeviceDetailQueryVariables> &
    ({ variables: DeviceDetailQueryVariables; skip?: boolean } | { skip: boolean }),
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useQuery<DeviceDetailQuery, DeviceDetailQueryVariables>(
    DeviceDetailDocument,
    options,
  );
}
export function useDeviceDetailLazyQuery(
  baseOptions?: Apollo.LazyQueryHookOptions<DeviceDetailQuery, DeviceDetailQueryVariables>,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useLazyQuery<DeviceDetailQuery, DeviceDetailQueryVariables>(
    DeviceDetailDocument,
    options,
  );
}
export function useDeviceDetailSuspenseQuery(
  baseOptions?:
    | Apollo.SkipToken
    | Apollo.SuspenseQueryHookOptions<DeviceDetailQuery, DeviceDetailQueryVariables>,
) {
  const options =
    baseOptions === Apollo.skipToken ? baseOptions : { ...defaultOptions, ...baseOptions };
  return Apollo.useSuspenseQuery<DeviceDetailQuery, DeviceDetailQueryVariables>(
    DeviceDetailDocument,
    options,
  );
}
export type DeviceDetailQueryHookResult = ReturnType<typeof useDeviceDetailQuery>;
export type DeviceDetailLazyQueryHookResult = ReturnType<typeof useDeviceDetailLazyQuery>;
export type DeviceDetailSuspenseQueryHookResult = ReturnType<typeof useDeviceDetailSuspenseQuery>;
export type DeviceDetailQueryResult = Apollo.QueryResult<
  DeviceDetailQuery,
  DeviceDetailQueryVariables
>;
export const DeviceTrafficDocument = gql`
  query DeviceTraffic(
    $deviceId: String!
    $deviceType: DeviceTypeEnum!
    $includeInterfaces: Boolean = false
  ) {
    deviceTraffic(
      deviceId: $deviceId
      deviceType: $deviceType
      includeInterfaces: $includeInterfaces
    ) {
      deviceId
      deviceName
      totalBandwidthGbps
      currentRateInMbps
      currentRateOutMbps
      totalBytesIn
      totalBytesOut
      totalPacketsIn
      totalPacketsOut
      peakRateInBps
      peakRateOutBps
      peakTimestamp
      timestamp
      interfaces @include(if: $includeInterfaces) {
        interfaceName
        status
        rateInBps
        rateOutBps
        bytesIn
        bytesOut
        errorsIn
        errorsOut
        dropsIn
        dropsOut
      }
    }
  }
`;
export function useDeviceTrafficQuery(
  baseOptions: Apollo.QueryHookOptions<DeviceTrafficQuery, DeviceTrafficQueryVariables> &
    ({ variables: DeviceTrafficQueryVariables; skip?: boolean } | { skip: boolean }),
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useQuery<DeviceTrafficQuery, DeviceTrafficQueryVariables>(
    DeviceTrafficDocument,
    options,
  );
}
export function useDeviceTrafficLazyQuery(
  baseOptions?: Apollo.LazyQueryHookOptions<DeviceTrafficQuery, DeviceTrafficQueryVariables>,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useLazyQuery<DeviceTrafficQuery, DeviceTrafficQueryVariables>(
    DeviceTrafficDocument,
    options,
  );
}
export function useDeviceTrafficSuspenseQuery(
  baseOptions?:
    | Apollo.SkipToken
    | Apollo.SuspenseQueryHookOptions<DeviceTrafficQuery, DeviceTrafficQueryVariables>,
) {
  const options =
    baseOptions === Apollo.skipToken ? baseOptions : { ...defaultOptions, ...baseOptions };
  return Apollo.useSuspenseQuery<DeviceTrafficQuery, DeviceTrafficQueryVariables>(
    DeviceTrafficDocument,
    options,
  );
}
export type DeviceTrafficQueryHookResult = ReturnType<typeof useDeviceTrafficQuery>;
export type DeviceTrafficLazyQueryHookResult = ReturnType<typeof useDeviceTrafficLazyQuery>;
export type DeviceTrafficSuspenseQueryHookResult = ReturnType<typeof useDeviceTrafficSuspenseQuery>;
export type DeviceTrafficQueryResult = Apollo.QueryResult<
  DeviceTrafficQuery,
  DeviceTrafficQueryVariables
>;
export const NetworkAlertListDocument = gql`
  query NetworkAlertList(
    $page: Int = 1
    $pageSize: Int = 50
    $severity: AlertSeverityEnum
    $activeOnly: Boolean = true
    $deviceId: String
    $deviceType: DeviceTypeEnum
  ) {
    networkAlerts(
      page: $page
      pageSize: $pageSize
      severity: $severity
      activeOnly: $activeOnly
      deviceId: $deviceId
      deviceType: $deviceType
    ) {
      alerts {
        alertId
        alertRuleId
        severity
        title
        description
        deviceName
        deviceId
        deviceType
        metricName
        currentValue
        thresholdValue
        triggeredAt
        acknowledgedAt
        resolvedAt
        isActive
        isAcknowledged
        tenantId
      }
      totalCount
      hasNextPage
      hasPrevPage
      page
      pageSize
    }
  }
`;
export function useNetworkAlertListQuery(
  baseOptions?: Apollo.QueryHookOptions<NetworkAlertListQuery, NetworkAlertListQueryVariables>,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useQuery<NetworkAlertListQuery, NetworkAlertListQueryVariables>(
    NetworkAlertListDocument,
    options,
  );
}
export function useNetworkAlertListLazyQuery(
  baseOptions?: Apollo.LazyQueryHookOptions<NetworkAlertListQuery, NetworkAlertListQueryVariables>,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useLazyQuery<NetworkAlertListQuery, NetworkAlertListQueryVariables>(
    NetworkAlertListDocument,
    options,
  );
}
export function useNetworkAlertListSuspenseQuery(
  baseOptions?:
    | Apollo.SkipToken
    | Apollo.SuspenseQueryHookOptions<NetworkAlertListQuery, NetworkAlertListQueryVariables>,
) {
  const options =
    baseOptions === Apollo.skipToken ? baseOptions : { ...defaultOptions, ...baseOptions };
  return Apollo.useSuspenseQuery<NetworkAlertListQuery, NetworkAlertListQueryVariables>(
    NetworkAlertListDocument,
    options,
  );
}
export type NetworkAlertListQueryHookResult = ReturnType<typeof useNetworkAlertListQuery>;
export type NetworkAlertListLazyQueryHookResult = ReturnType<typeof useNetworkAlertListLazyQuery>;
export type NetworkAlertListSuspenseQueryHookResult = ReturnType<
  typeof useNetworkAlertListSuspenseQuery
>;
export type NetworkAlertListQueryResult = Apollo.QueryResult<
  NetworkAlertListQuery,
  NetworkAlertListQueryVariables
>;
export const NetworkAlertDetailDocument = gql`
  query NetworkAlertDetail($alertId: String!) {
    networkAlert(alertId: $alertId) {
      alertId
      alertRuleId
      severity
      title
      description
      deviceName
      deviceId
      deviceType
      metricName
      currentValue
      thresholdValue
      triggeredAt
      acknowledgedAt
      resolvedAt
      isActive
      isAcknowledged
      tenantId
    }
  }
`;
export function useNetworkAlertDetailQuery(
  baseOptions: Apollo.QueryHookOptions<NetworkAlertDetailQuery, NetworkAlertDetailQueryVariables> &
    ({ variables: NetworkAlertDetailQueryVariables; skip?: boolean } | { skip: boolean }),
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useQuery<NetworkAlertDetailQuery, NetworkAlertDetailQueryVariables>(
    NetworkAlertDetailDocument,
    options,
  );
}
export function useNetworkAlertDetailLazyQuery(
  baseOptions?: Apollo.LazyQueryHookOptions<
    NetworkAlertDetailQuery,
    NetworkAlertDetailQueryVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useLazyQuery<NetworkAlertDetailQuery, NetworkAlertDetailQueryVariables>(
    NetworkAlertDetailDocument,
    options,
  );
}
export function useNetworkAlertDetailSuspenseQuery(
  baseOptions?:
    | Apollo.SkipToken
    | Apollo.SuspenseQueryHookOptions<NetworkAlertDetailQuery, NetworkAlertDetailQueryVariables>,
) {
  const options =
    baseOptions === Apollo.skipToken ? baseOptions : { ...defaultOptions, ...baseOptions };
  return Apollo.useSuspenseQuery<NetworkAlertDetailQuery, NetworkAlertDetailQueryVariables>(
    NetworkAlertDetailDocument,
    options,
  );
}
export type NetworkAlertDetailQueryHookResult = ReturnType<typeof useNetworkAlertDetailQuery>;
export type NetworkAlertDetailLazyQueryHookResult = ReturnType<
  typeof useNetworkAlertDetailLazyQuery
>;
export type NetworkAlertDetailSuspenseQueryHookResult = ReturnType<
  typeof useNetworkAlertDetailSuspenseQuery
>;
export type NetworkAlertDetailQueryResult = Apollo.QueryResult<
  NetworkAlertDetailQuery,
  NetworkAlertDetailQueryVariables
>;
export const NetworkDashboardDocument = gql`
  query NetworkDashboard(
    $devicePage: Int = 1
    $devicePageSize: Int = 10
    $deviceType: DeviceTypeEnum
    $deviceStatus: DeviceStatusEnum
    $alertPage: Int = 1
    $alertPageSize: Int = 20
    $alertSeverity: AlertSeverityEnum
  ) {
    networkOverview {
      totalDevices
      onlineDevices
      offlineDevices
      activeAlerts
      criticalAlerts
      totalBandwidthGbps
      uptimePercentage
      deviceTypeSummary {
        deviceType
        totalCount
        onlineCount
        avgCpuUsage
        avgMemoryUsage
      }
      recentAlerts {
        alertId
        severity
        title
        deviceName
        triggeredAt
        isActive
      }
    }
    networkDevices(
      page: $devicePage
      pageSize: $devicePageSize
      deviceType: $deviceType
      status: $deviceStatus
    ) {
      devices {
        deviceId
        deviceName
        deviceType
        status
        ipAddress
        cpuUsagePercent
        memoryUsagePercent
        uptimeSeconds
        isHealthy
        lastSeen
      }
      totalCount
      hasNextPage
    }
    networkAlerts(
      page: $alertPage
      pageSize: $alertPageSize
      severity: $alertSeverity
      activeOnly: true
    ) {
      alerts {
        alertId
        severity
        title
        description
        deviceName
        deviceType
        triggeredAt
        isActive
      }
      totalCount
      hasNextPage
    }
  }
`;
export function useNetworkDashboardQuery(
  baseOptions?: Apollo.QueryHookOptions<NetworkDashboardQuery, NetworkDashboardQueryVariables>,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useQuery<NetworkDashboardQuery, NetworkDashboardQueryVariables>(
    NetworkDashboardDocument,
    options,
  );
}
export function useNetworkDashboardLazyQuery(
  baseOptions?: Apollo.LazyQueryHookOptions<NetworkDashboardQuery, NetworkDashboardQueryVariables>,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useLazyQuery<NetworkDashboardQuery, NetworkDashboardQueryVariables>(
    NetworkDashboardDocument,
    options,
  );
}
export function useNetworkDashboardSuspenseQuery(
  baseOptions?:
    | Apollo.SkipToken
    | Apollo.SuspenseQueryHookOptions<NetworkDashboardQuery, NetworkDashboardQueryVariables>,
) {
  const options =
    baseOptions === Apollo.skipToken ? baseOptions : { ...defaultOptions, ...baseOptions };
  return Apollo.useSuspenseQuery<NetworkDashboardQuery, NetworkDashboardQueryVariables>(
    NetworkDashboardDocument,
    options,
  );
}
export type NetworkDashboardQueryHookResult = ReturnType<typeof useNetworkDashboardQuery>;
export type NetworkDashboardLazyQueryHookResult = ReturnType<typeof useNetworkDashboardLazyQuery>;
export type NetworkDashboardSuspenseQueryHookResult = ReturnType<
  typeof useNetworkDashboardSuspenseQuery
>;
export type NetworkDashboardQueryResult = Apollo.QueryResult<
  NetworkDashboardQuery,
  NetworkDashboardQueryVariables
>;
export const DeviceUpdatesDocument = gql`
  subscription DeviceUpdates($deviceType: DeviceTypeEnum, $status: DeviceStatusEnum) {
    deviceUpdated(deviceType: $deviceType, status: $status) {
      deviceId
      deviceName
      deviceType
      status
      ipAddress
      firmwareVersion
      model
      location
      tenantId
      cpuUsagePercent
      memoryUsagePercent
      temperatureCelsius
      powerStatus
      pingLatencyMs
      packetLossPercent
      uptimeSeconds
      uptimeDays
      lastSeen
      isHealthy
      changeType
      previousValue
      newValue
      updatedAt
    }
  }
`;
export function useDeviceUpdatesSubscription(
  baseOptions?: Apollo.SubscriptionHookOptions<
    DeviceUpdatesSubscription,
    DeviceUpdatesSubscriptionVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useSubscription<DeviceUpdatesSubscription, DeviceUpdatesSubscriptionVariables>(
    DeviceUpdatesDocument,
    options,
  );
}
export type DeviceUpdatesSubscriptionHookResult = ReturnType<typeof useDeviceUpdatesSubscription>;
export type DeviceUpdatesSubscriptionResult = Apollo.SubscriptionResult<DeviceUpdatesSubscription>;
export const NetworkAlertUpdatesDocument = gql`
  subscription NetworkAlertUpdates($severity: AlertSeverityEnum, $deviceId: String) {
    networkAlertUpdated(severity: $severity, deviceId: $deviceId) {
      action
      alert {
        alertId
        alertRuleId
        severity
        title
        description
        deviceName
        deviceId
        deviceType
        metricName
        currentValue
        thresholdValue
        triggeredAt
        acknowledgedAt
        resolvedAt
        isActive
        isAcknowledged
        tenantId
      }
      updatedAt
    }
  }
`;
export function useNetworkAlertUpdatesSubscription(
  baseOptions?: Apollo.SubscriptionHookOptions<
    NetworkAlertUpdatesSubscription,
    NetworkAlertUpdatesSubscriptionVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useSubscription<
    NetworkAlertUpdatesSubscription,
    NetworkAlertUpdatesSubscriptionVariables
  >(NetworkAlertUpdatesDocument, options);
}
export type NetworkAlertUpdatesSubscriptionHookResult = ReturnType<
  typeof useNetworkAlertUpdatesSubscription
>;
export type NetworkAlertUpdatesSubscriptionResult =
  Apollo.SubscriptionResult<NetworkAlertUpdatesSubscription>;
export const SubscriberDashboardDocument = gql`
  query SubscriberDashboard($limit: Int = 50, $search: String) {
    subscribers(limit: $limit, search: $search) {
      id
      subscriberId
      username
      enabled
      framedIpAddress
      bandwidthProfileId
      createdAt
      updatedAt
      sessions {
        radacctid
        username
        nasipaddress
        acctsessionid
        acctsessiontime
        acctinputoctets
        acctoutputoctets
        acctstarttime
      }
    }
    subscriberMetrics {
      totalCount
      enabledCount
      disabledCount
      activeSessionsCount
      totalDataUsageMb
    }
  }
`;
export function useSubscriberDashboardQuery(
  baseOptions?: Apollo.QueryHookOptions<
    SubscriberDashboardQuery,
    SubscriberDashboardQueryVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useQuery<SubscriberDashboardQuery, SubscriberDashboardQueryVariables>(
    SubscriberDashboardDocument,
    options,
  );
}
export function useSubscriberDashboardLazyQuery(
  baseOptions?: Apollo.LazyQueryHookOptions<
    SubscriberDashboardQuery,
    SubscriberDashboardQueryVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useLazyQuery<SubscriberDashboardQuery, SubscriberDashboardQueryVariables>(
    SubscriberDashboardDocument,
    options,
  );
}
export function useSubscriberDashboardSuspenseQuery(
  baseOptions?:
    | Apollo.SkipToken
    | Apollo.SuspenseQueryHookOptions<SubscriberDashboardQuery, SubscriberDashboardQueryVariables>,
) {
  const options =
    baseOptions === Apollo.skipToken ? baseOptions : { ...defaultOptions, ...baseOptions };
  return Apollo.useSuspenseQuery<SubscriberDashboardQuery, SubscriberDashboardQueryVariables>(
    SubscriberDashboardDocument,
    options,
  );
}
export type SubscriberDashboardQueryHookResult = ReturnType<typeof useSubscriberDashboardQuery>;
export type SubscriberDashboardLazyQueryHookResult = ReturnType<
  typeof useSubscriberDashboardLazyQuery
>;
export type SubscriberDashboardSuspenseQueryHookResult = ReturnType<
  typeof useSubscriberDashboardSuspenseQuery
>;
export type SubscriberDashboardQueryResult = Apollo.QueryResult<
  SubscriberDashboardQuery,
  SubscriberDashboardQueryVariables
>;
export const SubscriberDocument = gql`
  query Subscriber($username: String!) {
    subscribers(limit: 1, search: $username) {
      id
      subscriberId
      username
      enabled
      framedIpAddress
      bandwidthProfileId
      createdAt
      updatedAt
      sessions {
        radacctid
        username
        nasipaddress
        acctsessionid
        acctsessiontime
        acctinputoctets
        acctoutputoctets
        acctstarttime
        acctstoptime
      }
    }
  }
`;
export function useSubscriberQuery(
  baseOptions: Apollo.QueryHookOptions<SubscriberQuery, SubscriberQueryVariables> &
    ({ variables: SubscriberQueryVariables; skip?: boolean } | { skip: boolean }),
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useQuery<SubscriberQuery, SubscriberQueryVariables>(SubscriberDocument, options);
}
export function useSubscriberLazyQuery(
  baseOptions?: Apollo.LazyQueryHookOptions<SubscriberQuery, SubscriberQueryVariables>,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useLazyQuery<SubscriberQuery, SubscriberQueryVariables>(
    SubscriberDocument,
    options,
  );
}
export function useSubscriberSuspenseQuery(
  baseOptions?:
    | Apollo.SkipToken
    | Apollo.SuspenseQueryHookOptions<SubscriberQuery, SubscriberQueryVariables>,
) {
  const options =
    baseOptions === Apollo.skipToken ? baseOptions : { ...defaultOptions, ...baseOptions };
  return Apollo.useSuspenseQuery<SubscriberQuery, SubscriberQueryVariables>(
    SubscriberDocument,
    options,
  );
}
export type SubscriberQueryHookResult = ReturnType<typeof useSubscriberQuery>;
export type SubscriberLazyQueryHookResult = ReturnType<typeof useSubscriberLazyQuery>;
export type SubscriberSuspenseQueryHookResult = ReturnType<typeof useSubscriberSuspenseQuery>;
export type SubscriberQueryResult = Apollo.QueryResult<SubscriberQuery, SubscriberQueryVariables>;
export const ActiveSessionsDocument = gql`
  query ActiveSessions($limit: Int = 100, $username: String) {
    sessions(limit: $limit, username: $username) {
      radacctid
      username
      nasipaddress
      acctsessionid
      acctsessiontime
      acctinputoctets
      acctoutputoctets
      acctstarttime
    }
  }
`;
export function useActiveSessionsQuery(
  baseOptions?: Apollo.QueryHookOptions<ActiveSessionsQuery, ActiveSessionsQueryVariables>,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useQuery<ActiveSessionsQuery, ActiveSessionsQueryVariables>(
    ActiveSessionsDocument,
    options,
  );
}
export function useActiveSessionsLazyQuery(
  baseOptions?: Apollo.LazyQueryHookOptions<ActiveSessionsQuery, ActiveSessionsQueryVariables>,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useLazyQuery<ActiveSessionsQuery, ActiveSessionsQueryVariables>(
    ActiveSessionsDocument,
    options,
  );
}
export function useActiveSessionsSuspenseQuery(
  baseOptions?:
    | Apollo.SkipToken
    | Apollo.SuspenseQueryHookOptions<ActiveSessionsQuery, ActiveSessionsQueryVariables>,
) {
  const options =
    baseOptions === Apollo.skipToken ? baseOptions : { ...defaultOptions, ...baseOptions };
  return Apollo.useSuspenseQuery<ActiveSessionsQuery, ActiveSessionsQueryVariables>(
    ActiveSessionsDocument,
    options,
  );
}
export type ActiveSessionsQueryHookResult = ReturnType<typeof useActiveSessionsQuery>;
export type ActiveSessionsLazyQueryHookResult = ReturnType<typeof useActiveSessionsLazyQuery>;
export type ActiveSessionsSuspenseQueryHookResult = ReturnType<
  typeof useActiveSessionsSuspenseQuery
>;
export type ActiveSessionsQueryResult = Apollo.QueryResult<
  ActiveSessionsQuery,
  ActiveSessionsQueryVariables
>;
export const SubscriberMetricsDocument = gql`
  query SubscriberMetrics {
    subscriberMetrics {
      totalCount
      enabledCount
      disabledCount
      activeSessionsCount
      totalDataUsageMb
    }
  }
`;
export function useSubscriberMetricsQuery(
  baseOptions?: Apollo.QueryHookOptions<SubscriberMetricsQuery, SubscriberMetricsQueryVariables>,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useQuery<SubscriberMetricsQuery, SubscriberMetricsQueryVariables>(
    SubscriberMetricsDocument,
    options,
  );
}
export function useSubscriberMetricsLazyQuery(
  baseOptions?: Apollo.LazyQueryHookOptions<
    SubscriberMetricsQuery,
    SubscriberMetricsQueryVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useLazyQuery<SubscriberMetricsQuery, SubscriberMetricsQueryVariables>(
    SubscriberMetricsDocument,
    options,
  );
}
export function useSubscriberMetricsSuspenseQuery(
  baseOptions?:
    | Apollo.SkipToken
    | Apollo.SuspenseQueryHookOptions<SubscriberMetricsQuery, SubscriberMetricsQueryVariables>,
) {
  const options =
    baseOptions === Apollo.skipToken ? baseOptions : { ...defaultOptions, ...baseOptions };
  return Apollo.useSuspenseQuery<SubscriberMetricsQuery, SubscriberMetricsQueryVariables>(
    SubscriberMetricsDocument,
    options,
  );
}
export type SubscriberMetricsQueryHookResult = ReturnType<typeof useSubscriberMetricsQuery>;
export type SubscriberMetricsLazyQueryHookResult = ReturnType<typeof useSubscriberMetricsLazyQuery>;
export type SubscriberMetricsSuspenseQueryHookResult = ReturnType<
  typeof useSubscriberMetricsSuspenseQuery
>;
export type SubscriberMetricsQueryResult = Apollo.QueryResult<
  SubscriberMetricsQuery,
  SubscriberMetricsQueryVariables
>;
export const SubscriptionListDocument = gql`
  query SubscriptionList(
    $page: Int = 1
    $pageSize: Int = 10
    $status: SubscriptionStatusEnum
    $billingCycle: BillingCycleEnum
    $search: String
    $includeCustomer: Boolean = true
    $includePlan: Boolean = true
    $includeInvoices: Boolean = false
  ) {
    subscriptions(
      page: $page
      pageSize: $pageSize
      status: $status
      billingCycle: $billingCycle
      search: $search
      includeCustomer: $includeCustomer
      includePlan: $includePlan
      includeInvoices: $includeInvoices
    ) {
      subscriptions {
        id
        subscriptionId
        customerId
        planId
        tenantId
        currentPeriodStart
        currentPeriodEnd
        status
        trialEnd
        isInTrial
        cancelAtPeriodEnd
        canceledAt
        endedAt
        customPrice
        usageRecords
        createdAt
        updatedAt
        isActive
        daysUntilRenewal
        isPastDue
        customer @include(if: $includeCustomer) {
          id
          customerId
          name
          email
          phone
          createdAt
        }
        plan @include(if: $includePlan) {
          id
          planId
          productId
          name
          description
          billingCycle
          price
          currency
          setupFee
          trialDays
          isActive
          hasTrial
          hasSetupFee
          includedUsage
          overageRates
          createdAt
          updatedAt
        }
        recentInvoices @include(if: $includeInvoices) {
          id
          invoiceId
          invoiceNumber
          amount
          currency
          status
          dueDate
          paidAt
          createdAt
        }
      }
      totalCount
      hasNextPage
      hasPrevPage
      page
      pageSize
    }
  }
`;
export function useSubscriptionListQuery(
  baseOptions?: Apollo.QueryHookOptions<SubscriptionListQuery, SubscriptionListQueryVariables>,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useQuery<SubscriptionListQuery, SubscriptionListQueryVariables>(
    SubscriptionListDocument,
    options,
  );
}
export function useSubscriptionListLazyQuery(
  baseOptions?: Apollo.LazyQueryHookOptions<SubscriptionListQuery, SubscriptionListQueryVariables>,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useLazyQuery<SubscriptionListQuery, SubscriptionListQueryVariables>(
    SubscriptionListDocument,
    options,
  );
}
export function useSubscriptionListSuspenseQuery(
  baseOptions?:
    | Apollo.SkipToken
    | Apollo.SuspenseQueryHookOptions<SubscriptionListQuery, SubscriptionListQueryVariables>,
) {
  const options =
    baseOptions === Apollo.skipToken ? baseOptions : { ...defaultOptions, ...baseOptions };
  return Apollo.useSuspenseQuery<SubscriptionListQuery, SubscriptionListQueryVariables>(
    SubscriptionListDocument,
    options,
  );
}
export type SubscriptionListQueryHookResult = ReturnType<typeof useSubscriptionListQuery>;
export type SubscriptionListLazyQueryHookResult = ReturnType<typeof useSubscriptionListLazyQuery>;
export type SubscriptionListSuspenseQueryHookResult = ReturnType<
  typeof useSubscriptionListSuspenseQuery
>;
export type SubscriptionListQueryResult = Apollo.QueryResult<
  SubscriptionListQuery,
  SubscriptionListQueryVariables
>;
export const SubscriptionDetailDocument = gql`
  query SubscriptionDetail($id: ID!) {
    subscription(id: $id, includeCustomer: true, includePlan: true, includeInvoices: true) {
      id
      subscriptionId
      customerId
      planId
      tenantId
      currentPeriodStart
      currentPeriodEnd
      status
      trialEnd
      isInTrial
      cancelAtPeriodEnd
      canceledAt
      endedAt
      customPrice
      usageRecords
      createdAt
      updatedAt
      isActive
      daysUntilRenewal
      isPastDue
      customer {
        id
        customerId
        name
        email
        phone
        createdAt
      }
      plan {
        id
        planId
        productId
        name
        description
        billingCycle
        price
        currency
        setupFee
        trialDays
        isActive
        hasTrial
        hasSetupFee
        includedUsage
        overageRates
        createdAt
        updatedAt
      }
      recentInvoices {
        id
        invoiceId
        invoiceNumber
        amount
        currency
        status
        dueDate
        paidAt
        createdAt
      }
    }
  }
`;
export function useSubscriptionDetailQuery(
  baseOptions: Apollo.QueryHookOptions<SubscriptionDetailQuery, SubscriptionDetailQueryVariables> &
    ({ variables: SubscriptionDetailQueryVariables; skip?: boolean } | { skip: boolean }),
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useQuery<SubscriptionDetailQuery, SubscriptionDetailQueryVariables>(
    SubscriptionDetailDocument,
    options,
  );
}
export function useSubscriptionDetailLazyQuery(
  baseOptions?: Apollo.LazyQueryHookOptions<
    SubscriptionDetailQuery,
    SubscriptionDetailQueryVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useLazyQuery<SubscriptionDetailQuery, SubscriptionDetailQueryVariables>(
    SubscriptionDetailDocument,
    options,
  );
}
export function useSubscriptionDetailSuspenseQuery(
  baseOptions?:
    | Apollo.SkipToken
    | Apollo.SuspenseQueryHookOptions<SubscriptionDetailQuery, SubscriptionDetailQueryVariables>,
) {
  const options =
    baseOptions === Apollo.skipToken ? baseOptions : { ...defaultOptions, ...baseOptions };
  return Apollo.useSuspenseQuery<SubscriptionDetailQuery, SubscriptionDetailQueryVariables>(
    SubscriptionDetailDocument,
    options,
  );
}
export type SubscriptionDetailQueryHookResult = ReturnType<typeof useSubscriptionDetailQuery>;
export type SubscriptionDetailLazyQueryHookResult = ReturnType<
  typeof useSubscriptionDetailLazyQuery
>;
export type SubscriptionDetailSuspenseQueryHookResult = ReturnType<
  typeof useSubscriptionDetailSuspenseQuery
>;
export type SubscriptionDetailQueryResult = Apollo.QueryResult<
  SubscriptionDetailQuery,
  SubscriptionDetailQueryVariables
>;
export const SubscriptionMetricsDocument = gql`
  query SubscriptionMetrics {
    subscriptionMetrics {
      totalSubscriptions
      activeSubscriptions
      trialingSubscriptions
      pastDueSubscriptions
      canceledSubscriptions
      pausedSubscriptions
      monthlyRecurringRevenue
      annualRecurringRevenue
      averageRevenuePerUser
      newSubscriptionsThisMonth
      newSubscriptionsLastMonth
      churnRate
      growthRate
      monthlySubscriptions
      quarterlySubscriptions
      annualSubscriptions
      trialConversionRate
      activeTrials
    }
  }
`;
export function useSubscriptionMetricsQuery(
  baseOptions?: Apollo.QueryHookOptions<
    SubscriptionMetricsQuery,
    SubscriptionMetricsQueryVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useQuery<SubscriptionMetricsQuery, SubscriptionMetricsQueryVariables>(
    SubscriptionMetricsDocument,
    options,
  );
}
export function useSubscriptionMetricsLazyQuery(
  baseOptions?: Apollo.LazyQueryHookOptions<
    SubscriptionMetricsQuery,
    SubscriptionMetricsQueryVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useLazyQuery<SubscriptionMetricsQuery, SubscriptionMetricsQueryVariables>(
    SubscriptionMetricsDocument,
    options,
  );
}
export function useSubscriptionMetricsSuspenseQuery(
  baseOptions?:
    | Apollo.SkipToken
    | Apollo.SuspenseQueryHookOptions<SubscriptionMetricsQuery, SubscriptionMetricsQueryVariables>,
) {
  const options =
    baseOptions === Apollo.skipToken ? baseOptions : { ...defaultOptions, ...baseOptions };
  return Apollo.useSuspenseQuery<SubscriptionMetricsQuery, SubscriptionMetricsQueryVariables>(
    SubscriptionMetricsDocument,
    options,
  );
}
export type SubscriptionMetricsQueryHookResult = ReturnType<typeof useSubscriptionMetricsQuery>;
export type SubscriptionMetricsLazyQueryHookResult = ReturnType<
  typeof useSubscriptionMetricsLazyQuery
>;
export type SubscriptionMetricsSuspenseQueryHookResult = ReturnType<
  typeof useSubscriptionMetricsSuspenseQuery
>;
export type SubscriptionMetricsQueryResult = Apollo.QueryResult<
  SubscriptionMetricsQuery,
  SubscriptionMetricsQueryVariables
>;
export const PlanListDocument = gql`
  query PlanList(
    $page: Int = 1
    $pageSize: Int = 20
    $isActive: Boolean
    $billingCycle: BillingCycleEnum
  ) {
    plans(page: $page, pageSize: $pageSize, isActive: $isActive, billingCycle: $billingCycle) {
      plans {
        id
        planId
        productId
        name
        description
        billingCycle
        price
        currency
        setupFee
        trialDays
        isActive
        createdAt
        updatedAt
        hasTrial
        hasSetupFee
        includedUsage
        overageRates
      }
      totalCount
      hasNextPage
      hasPrevPage
      page
      pageSize
    }
  }
`;
export function usePlanListQuery(
  baseOptions?: Apollo.QueryHookOptions<PlanListQuery, PlanListQueryVariables>,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useQuery<PlanListQuery, PlanListQueryVariables>(PlanListDocument, options);
}
export function usePlanListLazyQuery(
  baseOptions?: Apollo.LazyQueryHookOptions<PlanListQuery, PlanListQueryVariables>,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useLazyQuery<PlanListQuery, PlanListQueryVariables>(PlanListDocument, options);
}
export function usePlanListSuspenseQuery(
  baseOptions?:
    | Apollo.SkipToken
    | Apollo.SuspenseQueryHookOptions<PlanListQuery, PlanListQueryVariables>,
) {
  const options =
    baseOptions === Apollo.skipToken ? baseOptions : { ...defaultOptions, ...baseOptions };
  return Apollo.useSuspenseQuery<PlanListQuery, PlanListQueryVariables>(PlanListDocument, options);
}
export type PlanListQueryHookResult = ReturnType<typeof usePlanListQuery>;
export type PlanListLazyQueryHookResult = ReturnType<typeof usePlanListLazyQuery>;
export type PlanListSuspenseQueryHookResult = ReturnType<typeof usePlanListSuspenseQuery>;
export type PlanListQueryResult = Apollo.QueryResult<PlanListQuery, PlanListQueryVariables>;
export const ProductListDocument = gql`
  query ProductList($page: Int = 1, $pageSize: Int = 20, $isActive: Boolean, $category: String) {
    products(page: $page, pageSize: $pageSize, isActive: $isActive, category: $category) {
      products {
        id
        productId
        sku
        name
        description
        category
        productType
        basePrice
        currency
        isActive
        createdAt
        updatedAt
      }
      totalCount
      hasNextPage
      hasPrevPage
      page
      pageSize
    }
  }
`;
export function useProductListQuery(
  baseOptions?: Apollo.QueryHookOptions<ProductListQuery, ProductListQueryVariables>,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useQuery<ProductListQuery, ProductListQueryVariables>(ProductListDocument, options);
}
export function useProductListLazyQuery(
  baseOptions?: Apollo.LazyQueryHookOptions<ProductListQuery, ProductListQueryVariables>,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useLazyQuery<ProductListQuery, ProductListQueryVariables>(
    ProductListDocument,
    options,
  );
}
export function useProductListSuspenseQuery(
  baseOptions?:
    | Apollo.SkipToken
    | Apollo.SuspenseQueryHookOptions<ProductListQuery, ProductListQueryVariables>,
) {
  const options =
    baseOptions === Apollo.skipToken ? baseOptions : { ...defaultOptions, ...baseOptions };
  return Apollo.useSuspenseQuery<ProductListQuery, ProductListQueryVariables>(
    ProductListDocument,
    options,
  );
}
export type ProductListQueryHookResult = ReturnType<typeof useProductListQuery>;
export type ProductListLazyQueryHookResult = ReturnType<typeof useProductListLazyQuery>;
export type ProductListSuspenseQueryHookResult = ReturnType<typeof useProductListSuspenseQuery>;
export type ProductListQueryResult = Apollo.QueryResult<
  ProductListQuery,
  ProductListQueryVariables
>;
export const SubscriptionDashboardDocument = gql`
  query SubscriptionDashboard(
    $page: Int = 1
    $pageSize: Int = 10
    $status: SubscriptionStatusEnum
    $search: String
  ) {
    subscriptions(
      page: $page
      pageSize: $pageSize
      status: $status
      search: $search
      includeCustomer: true
      includePlan: true
      includeInvoices: false
    ) {
      subscriptions {
        id
        subscriptionId
        status
        currentPeriodStart
        currentPeriodEnd
        isActive
        isInTrial
        cancelAtPeriodEnd
        createdAt
        customer {
          id
          name
          email
        }
        plan {
          id
          name
          price
          currency
          billingCycle
        }
      }
      totalCount
      hasNextPage
    }
    subscriptionMetrics {
      totalSubscriptions
      activeSubscriptions
      trialingSubscriptions
      pastDueSubscriptions
      monthlyRecurringRevenue
      annualRecurringRevenue
      averageRevenuePerUser
      newSubscriptionsThisMonth
      churnRate
      growthRate
    }
  }
`;
export function useSubscriptionDashboardQuery(
  baseOptions?: Apollo.QueryHookOptions<
    SubscriptionDashboardQuery,
    SubscriptionDashboardQueryVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useQuery<SubscriptionDashboardQuery, SubscriptionDashboardQueryVariables>(
    SubscriptionDashboardDocument,
    options,
  );
}
export function useSubscriptionDashboardLazyQuery(
  baseOptions?: Apollo.LazyQueryHookOptions<
    SubscriptionDashboardQuery,
    SubscriptionDashboardQueryVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useLazyQuery<SubscriptionDashboardQuery, SubscriptionDashboardQueryVariables>(
    SubscriptionDashboardDocument,
    options,
  );
}
export function useSubscriptionDashboardSuspenseQuery(
  baseOptions?:
    | Apollo.SkipToken
    | Apollo.SuspenseQueryHookOptions<
        SubscriptionDashboardQuery,
        SubscriptionDashboardQueryVariables
      >,
) {
  const options =
    baseOptions === Apollo.skipToken ? baseOptions : { ...defaultOptions, ...baseOptions };
  return Apollo.useSuspenseQuery<SubscriptionDashboardQuery, SubscriptionDashboardQueryVariables>(
    SubscriptionDashboardDocument,
    options,
  );
}
export type SubscriptionDashboardQueryHookResult = ReturnType<typeof useSubscriptionDashboardQuery>;
export type SubscriptionDashboardLazyQueryHookResult = ReturnType<
  typeof useSubscriptionDashboardLazyQuery
>;
export type SubscriptionDashboardSuspenseQueryHookResult = ReturnType<
  typeof useSubscriptionDashboardSuspenseQuery
>;
export type SubscriptionDashboardQueryResult = Apollo.QueryResult<
  SubscriptionDashboardQuery,
  SubscriptionDashboardQueryVariables
>;
export const UserListDocument = gql`
  query UserList(
    $page: Int = 1
    $pageSize: Int = 10
    $isActive: Boolean
    $isVerified: Boolean
    $isSuperuser: Boolean
    $isPlatformAdmin: Boolean
    $search: String
    $includeMetadata: Boolean = false
    $includeRoles: Boolean = false
    $includePermissions: Boolean = false
    $includeTeams: Boolean = false
  ) {
    users(
      page: $page
      pageSize: $pageSize
      isActive: $isActive
      isVerified: $isVerified
      isSuperuser: $isSuperuser
      isPlatformAdmin: $isPlatformAdmin
      search: $search
      includeMetadata: $includeMetadata
      includeRoles: $includeRoles
      includePermissions: $includePermissions
      includeTeams: $includeTeams
    ) {
      users {
        id
        username
        email
        fullName
        firstName
        lastName
        displayName
        isActive
        isVerified
        isSuperuser
        isPlatformAdmin
        status
        phoneNumber
        phone
        phoneVerified
        avatarUrl
        timezone
        location
        bio
        website
        mfaEnabled
        lastLogin
        lastLoginIp
        failedLoginAttempts
        lockedUntil
        language
        tenantId
        primaryRole
        createdAt
        updatedAt
        metadata @include(if: $includeMetadata)
        roles @include(if: $includeRoles) {
          id
          name
          displayName
          description
          priority
          isSystem
          isActive
          isDefault
          createdAt
          updatedAt
        }
        permissions @include(if: $includePermissions) {
          id
          name
          displayName
          description
          category
          isActive
          isSystem
          createdAt
          updatedAt
        }
        teams @include(if: $includeTeams) {
          teamId
          teamName
          role
          joinedAt
        }
      }
      totalCount
      hasNextPage
      hasPrevPage
      page
      pageSize
    }
  }
`;
export function useUserListQuery(
  baseOptions?: Apollo.QueryHookOptions<UserListQuery, UserListQueryVariables>,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useQuery<UserListQuery, UserListQueryVariables>(UserListDocument, options);
}
export function useUserListLazyQuery(
  baseOptions?: Apollo.LazyQueryHookOptions<UserListQuery, UserListQueryVariables>,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useLazyQuery<UserListQuery, UserListQueryVariables>(UserListDocument, options);
}
export function useUserListSuspenseQuery(
  baseOptions?:
    | Apollo.SkipToken
    | Apollo.SuspenseQueryHookOptions<UserListQuery, UserListQueryVariables>,
) {
  const options =
    baseOptions === Apollo.skipToken ? baseOptions : { ...defaultOptions, ...baseOptions };
  return Apollo.useSuspenseQuery<UserListQuery, UserListQueryVariables>(UserListDocument, options);
}
export type UserListQueryHookResult = ReturnType<typeof useUserListQuery>;
export type UserListLazyQueryHookResult = ReturnType<typeof useUserListLazyQuery>;
export type UserListSuspenseQueryHookResult = ReturnType<typeof useUserListSuspenseQuery>;
export type UserListQueryResult = Apollo.QueryResult<UserListQuery, UserListQueryVariables>;
export const UserDetailDocument = gql`
  query UserDetail($id: ID!) {
    user(
      id: $id
      includeMetadata: true
      includeRoles: true
      includePermissions: true
      includeTeams: true
      includeProfileChanges: true
    ) {
      id
      username
      email
      fullName
      firstName
      lastName
      displayName
      isActive
      isVerified
      isSuperuser
      isPlatformAdmin
      status
      phoneNumber
      phone
      phoneVerified
      avatarUrl
      timezone
      location
      bio
      website
      mfaEnabled
      lastLogin
      lastLoginIp
      failedLoginAttempts
      lockedUntil
      language
      tenantId
      primaryRole
      createdAt
      updatedAt
      metadata
      roles {
        id
        name
        displayName
        description
        priority
        isSystem
        isActive
        isDefault
        createdAt
        updatedAt
      }
      permissions {
        id
        name
        displayName
        description
        category
        isActive
        isSystem
        createdAt
        updatedAt
      }
      teams {
        teamId
        teamName
        role
        joinedAt
      }
      profileChanges {
        id
        fieldName
        oldValue
        newValue
        createdAt
        changedByUsername
      }
    }
  }
`;
export function useUserDetailQuery(
  baseOptions: Apollo.QueryHookOptions<UserDetailQuery, UserDetailQueryVariables> &
    ({ variables: UserDetailQueryVariables; skip?: boolean } | { skip: boolean }),
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useQuery<UserDetailQuery, UserDetailQueryVariables>(UserDetailDocument, options);
}
export function useUserDetailLazyQuery(
  baseOptions?: Apollo.LazyQueryHookOptions<UserDetailQuery, UserDetailQueryVariables>,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useLazyQuery<UserDetailQuery, UserDetailQueryVariables>(
    UserDetailDocument,
    options,
  );
}
export function useUserDetailSuspenseQuery(
  baseOptions?:
    | Apollo.SkipToken
    | Apollo.SuspenseQueryHookOptions<UserDetailQuery, UserDetailQueryVariables>,
) {
  const options =
    baseOptions === Apollo.skipToken ? baseOptions : { ...defaultOptions, ...baseOptions };
  return Apollo.useSuspenseQuery<UserDetailQuery, UserDetailQueryVariables>(
    UserDetailDocument,
    options,
  );
}
export type UserDetailQueryHookResult = ReturnType<typeof useUserDetailQuery>;
export type UserDetailLazyQueryHookResult = ReturnType<typeof useUserDetailLazyQuery>;
export type UserDetailSuspenseQueryHookResult = ReturnType<typeof useUserDetailSuspenseQuery>;
export type UserDetailQueryResult = Apollo.QueryResult<UserDetailQuery, UserDetailQueryVariables>;
export const UserMetricsDocument = gql`
  query UserMetrics {
    userMetrics {
      totalUsers
      activeUsers
      suspendedUsers
      invitedUsers
      verifiedUsers
      mfaEnabledUsers
      platformAdmins
      superusers
      regularUsers
      usersLoggedInLast24h
      usersLoggedInLast7d
      usersLoggedInLast30d
      neverLoggedIn
      newUsersThisMonth
      newUsersLastMonth
    }
  }
`;
export function useUserMetricsQuery(
  baseOptions?: Apollo.QueryHookOptions<UserMetricsQuery, UserMetricsQueryVariables>,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useQuery<UserMetricsQuery, UserMetricsQueryVariables>(UserMetricsDocument, options);
}
export function useUserMetricsLazyQuery(
  baseOptions?: Apollo.LazyQueryHookOptions<UserMetricsQuery, UserMetricsQueryVariables>,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useLazyQuery<UserMetricsQuery, UserMetricsQueryVariables>(
    UserMetricsDocument,
    options,
  );
}
export function useUserMetricsSuspenseQuery(
  baseOptions?:
    | Apollo.SkipToken
    | Apollo.SuspenseQueryHookOptions<UserMetricsQuery, UserMetricsQueryVariables>,
) {
  const options =
    baseOptions === Apollo.skipToken ? baseOptions : { ...defaultOptions, ...baseOptions };
  return Apollo.useSuspenseQuery<UserMetricsQuery, UserMetricsQueryVariables>(
    UserMetricsDocument,
    options,
  );
}
export type UserMetricsQueryHookResult = ReturnType<typeof useUserMetricsQuery>;
export type UserMetricsLazyQueryHookResult = ReturnType<typeof useUserMetricsLazyQuery>;
export type UserMetricsSuspenseQueryHookResult = ReturnType<typeof useUserMetricsSuspenseQuery>;
export type UserMetricsQueryResult = Apollo.QueryResult<
  UserMetricsQuery,
  UserMetricsQueryVariables
>;
export const RoleListDocument = gql`
  query RoleList(
    $page: Int = 1
    $pageSize: Int = 20
    $isActive: Boolean
    $isSystem: Boolean
    $search: String
  ) {
    roles(
      page: $page
      pageSize: $pageSize
      isActive: $isActive
      isSystem: $isSystem
      search: $search
    ) {
      roles {
        id
        name
        displayName
        description
        priority
        isSystem
        isActive
        isDefault
        createdAt
        updatedAt
      }
      totalCount
      hasNextPage
      hasPrevPage
      page
      pageSize
    }
  }
`;
export function useRoleListQuery(
  baseOptions?: Apollo.QueryHookOptions<RoleListQuery, RoleListQueryVariables>,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useQuery<RoleListQuery, RoleListQueryVariables>(RoleListDocument, options);
}
export function useRoleListLazyQuery(
  baseOptions?: Apollo.LazyQueryHookOptions<RoleListQuery, RoleListQueryVariables>,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useLazyQuery<RoleListQuery, RoleListQueryVariables>(RoleListDocument, options);
}
export function useRoleListSuspenseQuery(
  baseOptions?:
    | Apollo.SkipToken
    | Apollo.SuspenseQueryHookOptions<RoleListQuery, RoleListQueryVariables>,
) {
  const options =
    baseOptions === Apollo.skipToken ? baseOptions : { ...defaultOptions, ...baseOptions };
  return Apollo.useSuspenseQuery<RoleListQuery, RoleListQueryVariables>(RoleListDocument, options);
}
export type RoleListQueryHookResult = ReturnType<typeof useRoleListQuery>;
export type RoleListLazyQueryHookResult = ReturnType<typeof useRoleListLazyQuery>;
export type RoleListSuspenseQueryHookResult = ReturnType<typeof useRoleListSuspenseQuery>;
export type RoleListQueryResult = Apollo.QueryResult<RoleListQuery, RoleListQueryVariables>;
export const PermissionsByCategoryDocument = gql`
  query PermissionsByCategory($category: PermissionCategoryEnum) {
    permissionsByCategory(category: $category) {
      category
      count
      permissions {
        id
        name
        displayName
        description
        category
        isActive
        isSystem
        createdAt
        updatedAt
      }
    }
  }
`;
export function usePermissionsByCategoryQuery(
  baseOptions?: Apollo.QueryHookOptions<
    PermissionsByCategoryQuery,
    PermissionsByCategoryQueryVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useQuery<PermissionsByCategoryQuery, PermissionsByCategoryQueryVariables>(
    PermissionsByCategoryDocument,
    options,
  );
}
export function usePermissionsByCategoryLazyQuery(
  baseOptions?: Apollo.LazyQueryHookOptions<
    PermissionsByCategoryQuery,
    PermissionsByCategoryQueryVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useLazyQuery<PermissionsByCategoryQuery, PermissionsByCategoryQueryVariables>(
    PermissionsByCategoryDocument,
    options,
  );
}
export function usePermissionsByCategorySuspenseQuery(
  baseOptions?:
    | Apollo.SkipToken
    | Apollo.SuspenseQueryHookOptions<
        PermissionsByCategoryQuery,
        PermissionsByCategoryQueryVariables
      >,
) {
  const options =
    baseOptions === Apollo.skipToken ? baseOptions : { ...defaultOptions, ...baseOptions };
  return Apollo.useSuspenseQuery<PermissionsByCategoryQuery, PermissionsByCategoryQueryVariables>(
    PermissionsByCategoryDocument,
    options,
  );
}
export type PermissionsByCategoryQueryHookResult = ReturnType<typeof usePermissionsByCategoryQuery>;
export type PermissionsByCategoryLazyQueryHookResult = ReturnType<
  typeof usePermissionsByCategoryLazyQuery
>;
export type PermissionsByCategorySuspenseQueryHookResult = ReturnType<
  typeof usePermissionsByCategorySuspenseQuery
>;
export type PermissionsByCategoryQueryResult = Apollo.QueryResult<
  PermissionsByCategoryQuery,
  PermissionsByCategoryQueryVariables
>;
export const UserDashboardDocument = gql`
  query UserDashboard($page: Int = 1, $pageSize: Int = 10, $isActive: Boolean, $search: String) {
    users(
      page: $page
      pageSize: $pageSize
      isActive: $isActive
      search: $search
      includeMetadata: false
      includeRoles: true
      includePermissions: false
      includeTeams: false
    ) {
      users {
        id
        username
        email
        fullName
        isActive
        isVerified
        isSuperuser
        lastLogin
        createdAt
        roles {
          id
          name
          displayName
        }
      }
      totalCount
      hasNextPage
    }
    userMetrics {
      totalUsers
      activeUsers
      suspendedUsers
      verifiedUsers
      mfaEnabledUsers
      platformAdmins
      superusers
      regularUsers
      usersLoggedInLast24h
      usersLoggedInLast7d
      newUsersThisMonth
    }
  }
`;
export function useUserDashboardQuery(
  baseOptions?: Apollo.QueryHookOptions<UserDashboardQuery, UserDashboardQueryVariables>,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useQuery<UserDashboardQuery, UserDashboardQueryVariables>(
    UserDashboardDocument,
    options,
  );
}
export function useUserDashboardLazyQuery(
  baseOptions?: Apollo.LazyQueryHookOptions<UserDashboardQuery, UserDashboardQueryVariables>,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useLazyQuery<UserDashboardQuery, UserDashboardQueryVariables>(
    UserDashboardDocument,
    options,
  );
}
export function useUserDashboardSuspenseQuery(
  baseOptions?:
    | Apollo.SkipToken
    | Apollo.SuspenseQueryHookOptions<UserDashboardQuery, UserDashboardQueryVariables>,
) {
  const options =
    baseOptions === Apollo.skipToken ? baseOptions : { ...defaultOptions, ...baseOptions };
  return Apollo.useSuspenseQuery<UserDashboardQuery, UserDashboardQueryVariables>(
    UserDashboardDocument,
    options,
  );
}
export type UserDashboardQueryHookResult = ReturnType<typeof useUserDashboardQuery>;
export type UserDashboardLazyQueryHookResult = ReturnType<typeof useUserDashboardLazyQuery>;
export type UserDashboardSuspenseQueryHookResult = ReturnType<typeof useUserDashboardSuspenseQuery>;
export type UserDashboardQueryResult = Apollo.QueryResult<
  UserDashboardQuery,
  UserDashboardQueryVariables
>;
export const UserRolesDocument = gql`
  query UserRoles($id: ID!) {
    user(id: $id, includeRoles: true) {
      id
      username
      roles {
        id
        name
        displayName
        description
        priority
        isSystem
        isActive
        createdAt
      }
    }
  }
`;
export function useUserRolesQuery(
  baseOptions: Apollo.QueryHookOptions<UserRolesQuery, UserRolesQueryVariables> &
    ({ variables: UserRolesQueryVariables; skip?: boolean } | { skip: boolean }),
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useQuery<UserRolesQuery, UserRolesQueryVariables>(UserRolesDocument, options);
}
export function useUserRolesLazyQuery(
  baseOptions?: Apollo.LazyQueryHookOptions<UserRolesQuery, UserRolesQueryVariables>,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useLazyQuery<UserRolesQuery, UserRolesQueryVariables>(UserRolesDocument, options);
}
export function useUserRolesSuspenseQuery(
  baseOptions?:
    | Apollo.SkipToken
    | Apollo.SuspenseQueryHookOptions<UserRolesQuery, UserRolesQueryVariables>,
) {
  const options =
    baseOptions === Apollo.skipToken ? baseOptions : { ...defaultOptions, ...baseOptions };
  return Apollo.useSuspenseQuery<UserRolesQuery, UserRolesQueryVariables>(
    UserRolesDocument,
    options,
  );
}
export type UserRolesQueryHookResult = ReturnType<typeof useUserRolesQuery>;
export type UserRolesLazyQueryHookResult = ReturnType<typeof useUserRolesLazyQuery>;
export type UserRolesSuspenseQueryHookResult = ReturnType<typeof useUserRolesSuspenseQuery>;
export type UserRolesQueryResult = Apollo.QueryResult<UserRolesQuery, UserRolesQueryVariables>;
export const UserPermissionsDocument = gql`
  query UserPermissions($id: ID!) {
    user(id: $id, includePermissions: true) {
      id
      username
      permissions {
        id
        name
        displayName
        description
        category
        isActive
      }
    }
  }
`;
export function useUserPermissionsQuery(
  baseOptions: Apollo.QueryHookOptions<UserPermissionsQuery, UserPermissionsQueryVariables> &
    ({ variables: UserPermissionsQueryVariables; skip?: boolean } | { skip: boolean }),
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useQuery<UserPermissionsQuery, UserPermissionsQueryVariables>(
    UserPermissionsDocument,
    options,
  );
}
export function useUserPermissionsLazyQuery(
  baseOptions?: Apollo.LazyQueryHookOptions<UserPermissionsQuery, UserPermissionsQueryVariables>,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useLazyQuery<UserPermissionsQuery, UserPermissionsQueryVariables>(
    UserPermissionsDocument,
    options,
  );
}
export function useUserPermissionsSuspenseQuery(
  baseOptions?:
    | Apollo.SkipToken
    | Apollo.SuspenseQueryHookOptions<UserPermissionsQuery, UserPermissionsQueryVariables>,
) {
  const options =
    baseOptions === Apollo.skipToken ? baseOptions : { ...defaultOptions, ...baseOptions };
  return Apollo.useSuspenseQuery<UserPermissionsQuery, UserPermissionsQueryVariables>(
    UserPermissionsDocument,
    options,
  );
}
export type UserPermissionsQueryHookResult = ReturnType<typeof useUserPermissionsQuery>;
export type UserPermissionsLazyQueryHookResult = ReturnType<typeof useUserPermissionsLazyQuery>;
export type UserPermissionsSuspenseQueryHookResult = ReturnType<
  typeof useUserPermissionsSuspenseQuery
>;
export type UserPermissionsQueryResult = Apollo.QueryResult<
  UserPermissionsQuery,
  UserPermissionsQueryVariables
>;
export const UserTeamsDocument = gql`
  query UserTeams($id: ID!) {
    user(id: $id, includeTeams: true) {
      id
      username
      teams {
        teamId
        teamName
        role
        joinedAt
      }
    }
  }
`;
export function useUserTeamsQuery(
  baseOptions: Apollo.QueryHookOptions<UserTeamsQuery, UserTeamsQueryVariables> &
    ({ variables: UserTeamsQueryVariables; skip?: boolean } | { skip: boolean }),
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useQuery<UserTeamsQuery, UserTeamsQueryVariables>(UserTeamsDocument, options);
}
export function useUserTeamsLazyQuery(
  baseOptions?: Apollo.LazyQueryHookOptions<UserTeamsQuery, UserTeamsQueryVariables>,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useLazyQuery<UserTeamsQuery, UserTeamsQueryVariables>(UserTeamsDocument, options);
}
export function useUserTeamsSuspenseQuery(
  baseOptions?:
    | Apollo.SkipToken
    | Apollo.SuspenseQueryHookOptions<UserTeamsQuery, UserTeamsQueryVariables>,
) {
  const options =
    baseOptions === Apollo.skipToken ? baseOptions : { ...defaultOptions, ...baseOptions };
  return Apollo.useSuspenseQuery<UserTeamsQuery, UserTeamsQueryVariables>(
    UserTeamsDocument,
    options,
  );
}
export type UserTeamsQueryHookResult = ReturnType<typeof useUserTeamsQuery>;
export type UserTeamsLazyQueryHookResult = ReturnType<typeof useUserTeamsLazyQuery>;
export type UserTeamsSuspenseQueryHookResult = ReturnType<typeof useUserTeamsSuspenseQuery>;
export type UserTeamsQueryResult = Apollo.QueryResult<UserTeamsQuery, UserTeamsQueryVariables>;
export const AccessPointListDocument = gql`
  query AccessPointList(
    $limit: Int = 50
    $offset: Int = 0
    $siteId: String
    $status: AccessPointStatus
    $frequencyBand: FrequencyBand
    $search: String
  ) {
    accessPoints(
      limit: $limit
      offset: $offset
      siteId: $siteId
      status: $status
      frequencyBand: $frequencyBand
      search: $search
    ) {
      accessPoints {
        id
        name
        macAddress
        ipAddress
        serialNumber
        status
        isOnline
        lastSeenAt
        model
        manufacturer
        firmwareVersion
        ssid
        frequencyBand
        channel
        channelWidth
        transmitPower
        maxClients
        securityType
        location {
          siteName
          building
          floor
          room
          mountingType
          coordinates {
            latitude
            longitude
            altitude
          }
        }
        rfMetrics {
          signalStrengthDbm
          noiseFloorDbm
          signalToNoiseRatio
          channelUtilizationPercent
          interferenceLevel
          txPowerDbm
          rxPowerDbm
        }
        performance {
          txBytes
          rxBytes
          txPackets
          rxPackets
          txRateMbps
          rxRateMbps
          txErrors
          rxErrors
          connectedClients
          cpuUsagePercent
          memoryUsagePercent
          uptimeSeconds
        }
        siteId
        controllerName
        siteName
        createdAt
        updatedAt
        lastRebootAt
      }
      totalCount
      hasNextPage
    }
  }
`;
export function useAccessPointListQuery(
  baseOptions?: Apollo.QueryHookOptions<AccessPointListQuery, AccessPointListQueryVariables>,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useQuery<AccessPointListQuery, AccessPointListQueryVariables>(
    AccessPointListDocument,
    options,
  );
}
export function useAccessPointListLazyQuery(
  baseOptions?: Apollo.LazyQueryHookOptions<AccessPointListQuery, AccessPointListQueryVariables>,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useLazyQuery<AccessPointListQuery, AccessPointListQueryVariables>(
    AccessPointListDocument,
    options,
  );
}
export function useAccessPointListSuspenseQuery(
  baseOptions?:
    | Apollo.SkipToken
    | Apollo.SuspenseQueryHookOptions<AccessPointListQuery, AccessPointListQueryVariables>,
) {
  const options =
    baseOptions === Apollo.skipToken ? baseOptions : { ...defaultOptions, ...baseOptions };
  return Apollo.useSuspenseQuery<AccessPointListQuery, AccessPointListQueryVariables>(
    AccessPointListDocument,
    options,
  );
}
export type AccessPointListQueryHookResult = ReturnType<typeof useAccessPointListQuery>;
export type AccessPointListLazyQueryHookResult = ReturnType<typeof useAccessPointListLazyQuery>;
export type AccessPointListSuspenseQueryHookResult = ReturnType<
  typeof useAccessPointListSuspenseQuery
>;
export type AccessPointListQueryResult = Apollo.QueryResult<
  AccessPointListQuery,
  AccessPointListQueryVariables
>;
export const AccessPointDetailDocument = gql`
  query AccessPointDetail($id: ID!) {
    accessPoint(id: $id) {
      id
      name
      macAddress
      ipAddress
      serialNumber
      status
      isOnline
      lastSeenAt
      model
      manufacturer
      firmwareVersion
      hardwareRevision
      ssid
      frequencyBand
      channel
      channelWidth
      transmitPower
      maxClients
      securityType
      location {
        siteName
        building
        floor
        room
        mountingType
        coordinates {
          latitude
          longitude
          altitude
          accuracy
        }
      }
      rfMetrics {
        signalStrengthDbm
        noiseFloorDbm
        signalToNoiseRatio
        channelUtilizationPercent
        interferenceLevel
        txPowerDbm
        rxPowerDbm
      }
      performance {
        txBytes
        rxBytes
        txPackets
        rxPackets
        txRateMbps
        rxRateMbps
        txErrors
        rxErrors
        txDropped
        rxDropped
        retries
        retryRatePercent
        connectedClients
        authenticatedClients
        authorizedClients
        cpuUsagePercent
        memoryUsagePercent
        uptimeSeconds
      }
      controllerId
      controllerName
      siteId
      siteName
      createdAt
      updatedAt
      lastRebootAt
      isMeshEnabled
      isBandSteeringEnabled
      isLoadBalancingEnabled
    }
  }
`;
export function useAccessPointDetailQuery(
  baseOptions: Apollo.QueryHookOptions<AccessPointDetailQuery, AccessPointDetailQueryVariables> &
    ({ variables: AccessPointDetailQueryVariables; skip?: boolean } | { skip: boolean }),
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useQuery<AccessPointDetailQuery, AccessPointDetailQueryVariables>(
    AccessPointDetailDocument,
    options,
  );
}
export function useAccessPointDetailLazyQuery(
  baseOptions?: Apollo.LazyQueryHookOptions<
    AccessPointDetailQuery,
    AccessPointDetailQueryVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useLazyQuery<AccessPointDetailQuery, AccessPointDetailQueryVariables>(
    AccessPointDetailDocument,
    options,
  );
}
export function useAccessPointDetailSuspenseQuery(
  baseOptions?:
    | Apollo.SkipToken
    | Apollo.SuspenseQueryHookOptions<AccessPointDetailQuery, AccessPointDetailQueryVariables>,
) {
  const options =
    baseOptions === Apollo.skipToken ? baseOptions : { ...defaultOptions, ...baseOptions };
  return Apollo.useSuspenseQuery<AccessPointDetailQuery, AccessPointDetailQueryVariables>(
    AccessPointDetailDocument,
    options,
  );
}
export type AccessPointDetailQueryHookResult = ReturnType<typeof useAccessPointDetailQuery>;
export type AccessPointDetailLazyQueryHookResult = ReturnType<typeof useAccessPointDetailLazyQuery>;
export type AccessPointDetailSuspenseQueryHookResult = ReturnType<
  typeof useAccessPointDetailSuspenseQuery
>;
export type AccessPointDetailQueryResult = Apollo.QueryResult<
  AccessPointDetailQuery,
  AccessPointDetailQueryVariables
>;
export const AccessPointsBySiteDocument = gql`
  query AccessPointsBySite($siteId: String!) {
    accessPointsBySite(siteId: $siteId) {
      id
      name
      macAddress
      ipAddress
      status
      isOnline
      ssid
      frequencyBand
      channel
      siteId
      siteName
      performance {
        connectedClients
        cpuUsagePercent
        memoryUsagePercent
      }
      rfMetrics {
        signalStrengthDbm
        channelUtilizationPercent
      }
    }
  }
`;
export function useAccessPointsBySiteQuery(
  baseOptions: Apollo.QueryHookOptions<AccessPointsBySiteQuery, AccessPointsBySiteQueryVariables> &
    ({ variables: AccessPointsBySiteQueryVariables; skip?: boolean } | { skip: boolean }),
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useQuery<AccessPointsBySiteQuery, AccessPointsBySiteQueryVariables>(
    AccessPointsBySiteDocument,
    options,
  );
}
export function useAccessPointsBySiteLazyQuery(
  baseOptions?: Apollo.LazyQueryHookOptions<
    AccessPointsBySiteQuery,
    AccessPointsBySiteQueryVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useLazyQuery<AccessPointsBySiteQuery, AccessPointsBySiteQueryVariables>(
    AccessPointsBySiteDocument,
    options,
  );
}
export function useAccessPointsBySiteSuspenseQuery(
  baseOptions?:
    | Apollo.SkipToken
    | Apollo.SuspenseQueryHookOptions<AccessPointsBySiteQuery, AccessPointsBySiteQueryVariables>,
) {
  const options =
    baseOptions === Apollo.skipToken ? baseOptions : { ...defaultOptions, ...baseOptions };
  return Apollo.useSuspenseQuery<AccessPointsBySiteQuery, AccessPointsBySiteQueryVariables>(
    AccessPointsBySiteDocument,
    options,
  );
}
export type AccessPointsBySiteQueryHookResult = ReturnType<typeof useAccessPointsBySiteQuery>;
export type AccessPointsBySiteLazyQueryHookResult = ReturnType<
  typeof useAccessPointsBySiteLazyQuery
>;
export type AccessPointsBySiteSuspenseQueryHookResult = ReturnType<
  typeof useAccessPointsBySiteSuspenseQuery
>;
export type AccessPointsBySiteQueryResult = Apollo.QueryResult<
  AccessPointsBySiteQuery,
  AccessPointsBySiteQueryVariables
>;
export const WirelessClientListDocument = gql`
  query WirelessClientList(
    $limit: Int = 50
    $offset: Int = 0
    $accessPointId: String
    $customerId: String
    $frequencyBand: FrequencyBand
    $search: String
  ) {
    wirelessClients(
      limit: $limit
      offset: $offset
      accessPointId: $accessPointId
      customerId: $customerId
      frequencyBand: $frequencyBand
      search: $search
    ) {
      clients {
        id
        macAddress
        hostname
        ipAddress
        manufacturer
        accessPointId
        accessPointName
        ssid
        connectionType
        frequencyBand
        channel
        isAuthenticated
        isAuthorized
        signalStrengthDbm
        signalQuality {
          rssiDbm
          snrDb
          noiseFloorDbm
          signalStrengthPercent
          linkQualityPercent
        }
        noiseFloorDbm
        snr
        txRateMbps
        rxRateMbps
        txBytes
        rxBytes
        connectedAt
        lastSeenAt
        uptimeSeconds
        customerId
        customerName
      }
      totalCount
      hasNextPage
    }
  }
`;
export function useWirelessClientListQuery(
  baseOptions?: Apollo.QueryHookOptions<WirelessClientListQuery, WirelessClientListQueryVariables>,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useQuery<WirelessClientListQuery, WirelessClientListQueryVariables>(
    WirelessClientListDocument,
    options,
  );
}
export function useWirelessClientListLazyQuery(
  baseOptions?: Apollo.LazyQueryHookOptions<
    WirelessClientListQuery,
    WirelessClientListQueryVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useLazyQuery<WirelessClientListQuery, WirelessClientListQueryVariables>(
    WirelessClientListDocument,
    options,
  );
}
export function useWirelessClientListSuspenseQuery(
  baseOptions?:
    | Apollo.SkipToken
    | Apollo.SuspenseQueryHookOptions<WirelessClientListQuery, WirelessClientListQueryVariables>,
) {
  const options =
    baseOptions === Apollo.skipToken ? baseOptions : { ...defaultOptions, ...baseOptions };
  return Apollo.useSuspenseQuery<WirelessClientListQuery, WirelessClientListQueryVariables>(
    WirelessClientListDocument,
    options,
  );
}
export type WirelessClientListQueryHookResult = ReturnType<typeof useWirelessClientListQuery>;
export type WirelessClientListLazyQueryHookResult = ReturnType<
  typeof useWirelessClientListLazyQuery
>;
export type WirelessClientListSuspenseQueryHookResult = ReturnType<
  typeof useWirelessClientListSuspenseQuery
>;
export type WirelessClientListQueryResult = Apollo.QueryResult<
  WirelessClientListQuery,
  WirelessClientListQueryVariables
>;
export const WirelessClientDetailDocument = gql`
  query WirelessClientDetail($id: ID!) {
    wirelessClient(id: $id) {
      id
      macAddress
      hostname
      ipAddress
      manufacturer
      accessPointId
      accessPointName
      ssid
      connectionType
      frequencyBand
      channel
      isAuthenticated
      isAuthorized
      authMethod
      signalStrengthDbm
      signalQuality {
        rssiDbm
        snrDb
        noiseFloorDbm
        signalStrengthPercent
        linkQualityPercent
      }
      noiseFloorDbm
      snr
      txRateMbps
      rxRateMbps
      txBytes
      rxBytes
      txPackets
      rxPackets
      txRetries
      rxRetries
      connectedAt
      lastSeenAt
      uptimeSeconds
      idleTimeSeconds
      supports80211k
      supports80211r
      supports80211v
      maxPhyRateMbps
      customerId
      customerName
    }
  }
`;
export function useWirelessClientDetailQuery(
  baseOptions: Apollo.QueryHookOptions<
    WirelessClientDetailQuery,
    WirelessClientDetailQueryVariables
  > &
    ({ variables: WirelessClientDetailQueryVariables; skip?: boolean } | { skip: boolean }),
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useQuery<WirelessClientDetailQuery, WirelessClientDetailQueryVariables>(
    WirelessClientDetailDocument,
    options,
  );
}
export function useWirelessClientDetailLazyQuery(
  baseOptions?: Apollo.LazyQueryHookOptions<
    WirelessClientDetailQuery,
    WirelessClientDetailQueryVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useLazyQuery<WirelessClientDetailQuery, WirelessClientDetailQueryVariables>(
    WirelessClientDetailDocument,
    options,
  );
}
export function useWirelessClientDetailSuspenseQuery(
  baseOptions?:
    | Apollo.SkipToken
    | Apollo.SuspenseQueryHookOptions<
        WirelessClientDetailQuery,
        WirelessClientDetailQueryVariables
      >,
) {
  const options =
    baseOptions === Apollo.skipToken ? baseOptions : { ...defaultOptions, ...baseOptions };
  return Apollo.useSuspenseQuery<WirelessClientDetailQuery, WirelessClientDetailQueryVariables>(
    WirelessClientDetailDocument,
    options,
  );
}
export type WirelessClientDetailQueryHookResult = ReturnType<typeof useWirelessClientDetailQuery>;
export type WirelessClientDetailLazyQueryHookResult = ReturnType<
  typeof useWirelessClientDetailLazyQuery
>;
export type WirelessClientDetailSuspenseQueryHookResult = ReturnType<
  typeof useWirelessClientDetailSuspenseQuery
>;
export type WirelessClientDetailQueryResult = Apollo.QueryResult<
  WirelessClientDetailQuery,
  WirelessClientDetailQueryVariables
>;
export const WirelessClientsByAccessPointDocument = gql`
  query WirelessClientsByAccessPoint($accessPointId: String!) {
    wirelessClientsByAccessPoint(accessPointId: $accessPointId) {
      id
      macAddress
      hostname
      ipAddress
      accessPointId
      ssid
      signalStrengthDbm
      signalQuality {
        rssiDbm
        snrDb
        noiseFloorDbm
        signalStrengthPercent
        linkQualityPercent
      }
      txRateMbps
      rxRateMbps
      connectedAt
      customerId
      customerName
    }
  }
`;
export function useWirelessClientsByAccessPointQuery(
  baseOptions: Apollo.QueryHookOptions<
    WirelessClientsByAccessPointQuery,
    WirelessClientsByAccessPointQueryVariables
  > &
    (
      | {
          variables: WirelessClientsByAccessPointQueryVariables;
          skip?: boolean;
        }
      | { skip: boolean }
    ),
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useQuery<
    WirelessClientsByAccessPointQuery,
    WirelessClientsByAccessPointQueryVariables
  >(WirelessClientsByAccessPointDocument, options);
}
export function useWirelessClientsByAccessPointLazyQuery(
  baseOptions?: Apollo.LazyQueryHookOptions<
    WirelessClientsByAccessPointQuery,
    WirelessClientsByAccessPointQueryVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useLazyQuery<
    WirelessClientsByAccessPointQuery,
    WirelessClientsByAccessPointQueryVariables
  >(WirelessClientsByAccessPointDocument, options);
}
export function useWirelessClientsByAccessPointSuspenseQuery(
  baseOptions?:
    | Apollo.SkipToken
    | Apollo.SuspenseQueryHookOptions<
        WirelessClientsByAccessPointQuery,
        WirelessClientsByAccessPointQueryVariables
      >,
) {
  const options =
    baseOptions === Apollo.skipToken ? baseOptions : { ...defaultOptions, ...baseOptions };
  return Apollo.useSuspenseQuery<
    WirelessClientsByAccessPointQuery,
    WirelessClientsByAccessPointQueryVariables
  >(WirelessClientsByAccessPointDocument, options);
}
export type WirelessClientsByAccessPointQueryHookResult = ReturnType<
  typeof useWirelessClientsByAccessPointQuery
>;
export type WirelessClientsByAccessPointLazyQueryHookResult = ReturnType<
  typeof useWirelessClientsByAccessPointLazyQuery
>;
export type WirelessClientsByAccessPointSuspenseQueryHookResult = ReturnType<
  typeof useWirelessClientsByAccessPointSuspenseQuery
>;
export type WirelessClientsByAccessPointQueryResult = Apollo.QueryResult<
  WirelessClientsByAccessPointQuery,
  WirelessClientsByAccessPointQueryVariables
>;
export const WirelessClientsByCustomerDocument = gql`
  query WirelessClientsByCustomer($customerId: String!) {
    wirelessClientsByCustomer(customerId: $customerId) {
      id
      macAddress
      hostname
      ipAddress
      customerId
      accessPointName
      ssid
      frequencyBand
      signalStrengthDbm
      signalQuality {
        rssiDbm
        snrDb
        noiseFloorDbm
        signalStrengthPercent
        linkQualityPercent
      }
      isAuthenticated
      connectedAt
      lastSeenAt
    }
  }
`;
export function useWirelessClientsByCustomerQuery(
  baseOptions: Apollo.QueryHookOptions<
    WirelessClientsByCustomerQuery,
    WirelessClientsByCustomerQueryVariables
  > &
    ({ variables: WirelessClientsByCustomerQueryVariables; skip?: boolean } | { skip: boolean }),
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useQuery<WirelessClientsByCustomerQuery, WirelessClientsByCustomerQueryVariables>(
    WirelessClientsByCustomerDocument,
    options,
  );
}
export function useWirelessClientsByCustomerLazyQuery(
  baseOptions?: Apollo.LazyQueryHookOptions<
    WirelessClientsByCustomerQuery,
    WirelessClientsByCustomerQueryVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useLazyQuery<
    WirelessClientsByCustomerQuery,
    WirelessClientsByCustomerQueryVariables
  >(WirelessClientsByCustomerDocument, options);
}
export function useWirelessClientsByCustomerSuspenseQuery(
  baseOptions?:
    | Apollo.SkipToken
    | Apollo.SuspenseQueryHookOptions<
        WirelessClientsByCustomerQuery,
        WirelessClientsByCustomerQueryVariables
      >,
) {
  const options =
    baseOptions === Apollo.skipToken ? baseOptions : { ...defaultOptions, ...baseOptions };
  return Apollo.useSuspenseQuery<
    WirelessClientsByCustomerQuery,
    WirelessClientsByCustomerQueryVariables
  >(WirelessClientsByCustomerDocument, options);
}
export type WirelessClientsByCustomerQueryHookResult = ReturnType<
  typeof useWirelessClientsByCustomerQuery
>;
export type WirelessClientsByCustomerLazyQueryHookResult = ReturnType<
  typeof useWirelessClientsByCustomerLazyQuery
>;
export type WirelessClientsByCustomerSuspenseQueryHookResult = ReturnType<
  typeof useWirelessClientsByCustomerSuspenseQuery
>;
export type WirelessClientsByCustomerQueryResult = Apollo.QueryResult<
  WirelessClientsByCustomerQuery,
  WirelessClientsByCustomerQueryVariables
>;
export const CoverageZoneListDocument = gql`
  query CoverageZoneList($limit: Int = 50, $offset: Int = 0, $siteId: String, $areaType: String) {
    coverageZones(limit: $limit, offset: $offset, siteId: $siteId, areaType: $areaType) {
      zones {
        id
        name
        description
        siteId
        siteName
        floor
        areaType
        coverageAreaSqm
        signalStrengthMinDbm
        signalStrengthMaxDbm
        signalStrengthAvgDbm
        accessPointIds
        accessPointCount
        interferenceLevel
        channelUtilizationAvg
        noiseFloorAvgDbm
        connectedClients
        maxClientCapacity
        clientDensityPerAp
        coveragePolygon
        createdAt
        updatedAt
        lastSurveyedAt
      }
      totalCount
      hasNextPage
    }
  }
`;
export function useCoverageZoneListQuery(
  baseOptions?: Apollo.QueryHookOptions<CoverageZoneListQuery, CoverageZoneListQueryVariables>,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useQuery<CoverageZoneListQuery, CoverageZoneListQueryVariables>(
    CoverageZoneListDocument,
    options,
  );
}
export function useCoverageZoneListLazyQuery(
  baseOptions?: Apollo.LazyQueryHookOptions<CoverageZoneListQuery, CoverageZoneListQueryVariables>,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useLazyQuery<CoverageZoneListQuery, CoverageZoneListQueryVariables>(
    CoverageZoneListDocument,
    options,
  );
}
export function useCoverageZoneListSuspenseQuery(
  baseOptions?:
    | Apollo.SkipToken
    | Apollo.SuspenseQueryHookOptions<CoverageZoneListQuery, CoverageZoneListQueryVariables>,
) {
  const options =
    baseOptions === Apollo.skipToken ? baseOptions : { ...defaultOptions, ...baseOptions };
  return Apollo.useSuspenseQuery<CoverageZoneListQuery, CoverageZoneListQueryVariables>(
    CoverageZoneListDocument,
    options,
  );
}
export type CoverageZoneListQueryHookResult = ReturnType<typeof useCoverageZoneListQuery>;
export type CoverageZoneListLazyQueryHookResult = ReturnType<typeof useCoverageZoneListLazyQuery>;
export type CoverageZoneListSuspenseQueryHookResult = ReturnType<
  typeof useCoverageZoneListSuspenseQuery
>;
export type CoverageZoneListQueryResult = Apollo.QueryResult<
  CoverageZoneListQuery,
  CoverageZoneListQueryVariables
>;
export const CoverageZoneDetailDocument = gql`
  query CoverageZoneDetail($id: ID!) {
    coverageZone(id: $id) {
      id
      name
      description
      siteId
      siteName
      floor
      areaType
      coverageAreaSqm
      signalStrengthMinDbm
      signalStrengthMaxDbm
      signalStrengthAvgDbm
      accessPointIds
      accessPointCount
      interferenceLevel
      channelUtilizationAvg
      noiseFloorAvgDbm
      connectedClients
      maxClientCapacity
      clientDensityPerAp
      coveragePolygon
      createdAt
      updatedAt
      lastSurveyedAt
    }
  }
`;
export function useCoverageZoneDetailQuery(
  baseOptions: Apollo.QueryHookOptions<CoverageZoneDetailQuery, CoverageZoneDetailQueryVariables> &
    ({ variables: CoverageZoneDetailQueryVariables; skip?: boolean } | { skip: boolean }),
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useQuery<CoverageZoneDetailQuery, CoverageZoneDetailQueryVariables>(
    CoverageZoneDetailDocument,
    options,
  );
}
export function useCoverageZoneDetailLazyQuery(
  baseOptions?: Apollo.LazyQueryHookOptions<
    CoverageZoneDetailQuery,
    CoverageZoneDetailQueryVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useLazyQuery<CoverageZoneDetailQuery, CoverageZoneDetailQueryVariables>(
    CoverageZoneDetailDocument,
    options,
  );
}
export function useCoverageZoneDetailSuspenseQuery(
  baseOptions?:
    | Apollo.SkipToken
    | Apollo.SuspenseQueryHookOptions<CoverageZoneDetailQuery, CoverageZoneDetailQueryVariables>,
) {
  const options =
    baseOptions === Apollo.skipToken ? baseOptions : { ...defaultOptions, ...baseOptions };
  return Apollo.useSuspenseQuery<CoverageZoneDetailQuery, CoverageZoneDetailQueryVariables>(
    CoverageZoneDetailDocument,
    options,
  );
}
export type CoverageZoneDetailQueryHookResult = ReturnType<typeof useCoverageZoneDetailQuery>;
export type CoverageZoneDetailLazyQueryHookResult = ReturnType<
  typeof useCoverageZoneDetailLazyQuery
>;
export type CoverageZoneDetailSuspenseQueryHookResult = ReturnType<
  typeof useCoverageZoneDetailSuspenseQuery
>;
export type CoverageZoneDetailQueryResult = Apollo.QueryResult<
  CoverageZoneDetailQuery,
  CoverageZoneDetailQueryVariables
>;
export const CoverageZonesBySiteDocument = gql`
  query CoverageZonesBySite($siteId: String!) {
    coverageZonesBySite(siteId: $siteId) {
      id
      name
      siteId
      siteName
      floor
      areaType
      coverageAreaSqm
      accessPointCount
      connectedClients
      maxClientCapacity
      signalStrengthAvgDbm
    }
  }
`;
export function useCoverageZonesBySiteQuery(
  baseOptions: Apollo.QueryHookOptions<
    CoverageZonesBySiteQuery,
    CoverageZonesBySiteQueryVariables
  > &
    ({ variables: CoverageZonesBySiteQueryVariables; skip?: boolean } | { skip: boolean }),
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useQuery<CoverageZonesBySiteQuery, CoverageZonesBySiteQueryVariables>(
    CoverageZonesBySiteDocument,
    options,
  );
}
export function useCoverageZonesBySiteLazyQuery(
  baseOptions?: Apollo.LazyQueryHookOptions<
    CoverageZonesBySiteQuery,
    CoverageZonesBySiteQueryVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useLazyQuery<CoverageZonesBySiteQuery, CoverageZonesBySiteQueryVariables>(
    CoverageZonesBySiteDocument,
    options,
  );
}
export function useCoverageZonesBySiteSuspenseQuery(
  baseOptions?:
    | Apollo.SkipToken
    | Apollo.SuspenseQueryHookOptions<CoverageZonesBySiteQuery, CoverageZonesBySiteQueryVariables>,
) {
  const options =
    baseOptions === Apollo.skipToken ? baseOptions : { ...defaultOptions, ...baseOptions };
  return Apollo.useSuspenseQuery<CoverageZonesBySiteQuery, CoverageZonesBySiteQueryVariables>(
    CoverageZonesBySiteDocument,
    options,
  );
}
export type CoverageZonesBySiteQueryHookResult = ReturnType<typeof useCoverageZonesBySiteQuery>;
export type CoverageZonesBySiteLazyQueryHookResult = ReturnType<
  typeof useCoverageZonesBySiteLazyQuery
>;
export type CoverageZonesBySiteSuspenseQueryHookResult = ReturnType<
  typeof useCoverageZonesBySiteSuspenseQuery
>;
export type CoverageZonesBySiteQueryResult = Apollo.QueryResult<
  CoverageZonesBySiteQuery,
  CoverageZonesBySiteQueryVariables
>;
export const RfAnalyticsDocument = gql`
  query RFAnalytics($siteId: String!) {
    rfAnalytics(siteId: $siteId) {
      siteId
      siteName
      analysisTimestamp
      channelUtilization24ghz {
        channel
        frequencyMhz
        band
        utilizationPercent
        interferenceLevel
        accessPointsCount
      }
      channelUtilization5ghz {
        channel
        frequencyMhz
        band
        utilizationPercent
        interferenceLevel
        accessPointsCount
      }
      channelUtilization6ghz {
        channel
        frequencyMhz
        band
        utilizationPercent
        interferenceLevel
        accessPointsCount
      }
      recommendedChannels24ghz
      recommendedChannels5ghz
      recommendedChannels6ghz
      interferenceSources {
        sourceType
        frequencyMhz
        strengthDbm
        affectedChannels
      }
      totalInterferenceScore
      averageSignalStrengthDbm
      averageSnr
      coverageQualityScore
      clientsPerBand24ghz
      clientsPerBand5ghz
      clientsPerBand6ghz
      bandUtilizationBalanceScore
    }
  }
`;
export function useRfAnalyticsQuery(
  baseOptions: Apollo.QueryHookOptions<RfAnalyticsQuery, RfAnalyticsQueryVariables> &
    ({ variables: RfAnalyticsQueryVariables; skip?: boolean } | { skip: boolean }),
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useQuery<RfAnalyticsQuery, RfAnalyticsQueryVariables>(RfAnalyticsDocument, options);
}
export function useRfAnalyticsLazyQuery(
  baseOptions?: Apollo.LazyQueryHookOptions<RfAnalyticsQuery, RfAnalyticsQueryVariables>,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useLazyQuery<RfAnalyticsQuery, RfAnalyticsQueryVariables>(
    RfAnalyticsDocument,
    options,
  );
}
export function useRfAnalyticsSuspenseQuery(
  baseOptions?:
    | Apollo.SkipToken
    | Apollo.SuspenseQueryHookOptions<RfAnalyticsQuery, RfAnalyticsQueryVariables>,
) {
  const options =
    baseOptions === Apollo.skipToken ? baseOptions : { ...defaultOptions, ...baseOptions };
  return Apollo.useSuspenseQuery<RfAnalyticsQuery, RfAnalyticsQueryVariables>(
    RfAnalyticsDocument,
    options,
  );
}
export type RfAnalyticsQueryHookResult = ReturnType<typeof useRfAnalyticsQuery>;
export type RfAnalyticsLazyQueryHookResult = ReturnType<typeof useRfAnalyticsLazyQuery>;
export type RfAnalyticsSuspenseQueryHookResult = ReturnType<typeof useRfAnalyticsSuspenseQuery>;
export type RfAnalyticsQueryResult = Apollo.QueryResult<
  RfAnalyticsQuery,
  RfAnalyticsQueryVariables
>;
export const ChannelUtilizationDocument = gql`
  query ChannelUtilization($siteId: String!, $frequencyBand: FrequencyBand!) {
    channelUtilization(siteId: $siteId, frequencyBand: $frequencyBand) {
      channel
      frequencyMhz
      band
      utilizationPercent
      interferenceLevel
      accessPointsCount
    }
  }
`;
export function useChannelUtilizationQuery(
  baseOptions: Apollo.QueryHookOptions<ChannelUtilizationQuery, ChannelUtilizationQueryVariables> &
    ({ variables: ChannelUtilizationQueryVariables; skip?: boolean } | { skip: boolean }),
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useQuery<ChannelUtilizationQuery, ChannelUtilizationQueryVariables>(
    ChannelUtilizationDocument,
    options,
  );
}
export function useChannelUtilizationLazyQuery(
  baseOptions?: Apollo.LazyQueryHookOptions<
    ChannelUtilizationQuery,
    ChannelUtilizationQueryVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useLazyQuery<ChannelUtilizationQuery, ChannelUtilizationQueryVariables>(
    ChannelUtilizationDocument,
    options,
  );
}
export function useChannelUtilizationSuspenseQuery(
  baseOptions?:
    | Apollo.SkipToken
    | Apollo.SuspenseQueryHookOptions<ChannelUtilizationQuery, ChannelUtilizationQueryVariables>,
) {
  const options =
    baseOptions === Apollo.skipToken ? baseOptions : { ...defaultOptions, ...baseOptions };
  return Apollo.useSuspenseQuery<ChannelUtilizationQuery, ChannelUtilizationQueryVariables>(
    ChannelUtilizationDocument,
    options,
  );
}
export type ChannelUtilizationQueryHookResult = ReturnType<typeof useChannelUtilizationQuery>;
export type ChannelUtilizationLazyQueryHookResult = ReturnType<
  typeof useChannelUtilizationLazyQuery
>;
export type ChannelUtilizationSuspenseQueryHookResult = ReturnType<
  typeof useChannelUtilizationSuspenseQuery
>;
export type ChannelUtilizationQueryResult = Apollo.QueryResult<
  ChannelUtilizationQuery,
  ChannelUtilizationQueryVariables
>;
export const WirelessSiteMetricsDocument = gql`
  query WirelessSiteMetrics($siteId: String!) {
    wirelessSiteMetrics(siteId: $siteId) {
      siteId
      siteName
      totalAps
      onlineAps
      offlineAps
      degradedAps
      totalClients
      clients24ghz
      clients5ghz
      clients6ghz
      averageSignalStrengthDbm
      averageSnr
      totalThroughputMbps
      totalCapacity
      capacityUtilizationPercent
      overallHealthScore
      rfHealthScore
      clientExperienceScore
    }
  }
`;
export function useWirelessSiteMetricsQuery(
  baseOptions: Apollo.QueryHookOptions<
    WirelessSiteMetricsQuery,
    WirelessSiteMetricsQueryVariables
  > &
    ({ variables: WirelessSiteMetricsQueryVariables; skip?: boolean } | { skip: boolean }),
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useQuery<WirelessSiteMetricsQuery, WirelessSiteMetricsQueryVariables>(
    WirelessSiteMetricsDocument,
    options,
  );
}
export function useWirelessSiteMetricsLazyQuery(
  baseOptions?: Apollo.LazyQueryHookOptions<
    WirelessSiteMetricsQuery,
    WirelessSiteMetricsQueryVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useLazyQuery<WirelessSiteMetricsQuery, WirelessSiteMetricsQueryVariables>(
    WirelessSiteMetricsDocument,
    options,
  );
}
export function useWirelessSiteMetricsSuspenseQuery(
  baseOptions?:
    | Apollo.SkipToken
    | Apollo.SuspenseQueryHookOptions<WirelessSiteMetricsQuery, WirelessSiteMetricsQueryVariables>,
) {
  const options =
    baseOptions === Apollo.skipToken ? baseOptions : { ...defaultOptions, ...baseOptions };
  return Apollo.useSuspenseQuery<WirelessSiteMetricsQuery, WirelessSiteMetricsQueryVariables>(
    WirelessSiteMetricsDocument,
    options,
  );
}
export type WirelessSiteMetricsQueryHookResult = ReturnType<typeof useWirelessSiteMetricsQuery>;
export type WirelessSiteMetricsLazyQueryHookResult = ReturnType<
  typeof useWirelessSiteMetricsLazyQuery
>;
export type WirelessSiteMetricsSuspenseQueryHookResult = ReturnType<
  typeof useWirelessSiteMetricsSuspenseQuery
>;
export type WirelessSiteMetricsQueryResult = Apollo.QueryResult<
  WirelessSiteMetricsQuery,
  WirelessSiteMetricsQueryVariables
>;
export const WirelessDashboardDocument = gql`
  query WirelessDashboard {
    wirelessDashboard {
      totalSites
      totalAccessPoints
      totalClients
      totalCoverageZones
      onlineAps
      offlineAps
      degradedAps
      clientsByBand24ghz
      clientsByBand5ghz
      clientsByBand6ghz
      topApsByClients {
        id
        name
        siteName
        performance {
          connectedClients
        }
      }
      topApsByThroughput {
        id
        name
        siteName
        performance {
          txRateMbps
          rxRateMbps
        }
      }
      sitesWithIssues {
        siteId
        siteName
        offlineAps
        degradedAps
        overallHealthScore
      }
      totalThroughputMbps
      averageSignalStrengthDbm
      averageClientExperienceScore
      clientCountTrend
      throughputTrendMbps
      offlineEventsCount
      generatedAt
    }
  }
`;
export function useWirelessDashboardQuery(
  baseOptions?: Apollo.QueryHookOptions<WirelessDashboardQuery, WirelessDashboardQueryVariables>,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useQuery<WirelessDashboardQuery, WirelessDashboardQueryVariables>(
    WirelessDashboardDocument,
    options,
  );
}
export function useWirelessDashboardLazyQuery(
  baseOptions?: Apollo.LazyQueryHookOptions<
    WirelessDashboardQuery,
    WirelessDashboardQueryVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return Apollo.useLazyQuery<WirelessDashboardQuery, WirelessDashboardQueryVariables>(
    WirelessDashboardDocument,
    options,
  );
}
export function useWirelessDashboardSuspenseQuery(
  baseOptions?:
    | Apollo.SkipToken
    | Apollo.SuspenseQueryHookOptions<WirelessDashboardQuery, WirelessDashboardQueryVariables>,
) {
  const options =
    baseOptions === Apollo.skipToken ? baseOptions : { ...defaultOptions, ...baseOptions };
  return Apollo.useSuspenseQuery<WirelessDashboardQuery, WirelessDashboardQueryVariables>(
    WirelessDashboardDocument,
    options,
  );
}
export type WirelessDashboardQueryHookResult = ReturnType<typeof useWirelessDashboardQuery>;
export type WirelessDashboardLazyQueryHookResult = ReturnType<typeof useWirelessDashboardLazyQuery>;
export type WirelessDashboardSuspenseQueryHookResult = ReturnType<
  typeof useWirelessDashboardSuspenseQuery
>;
export type WirelessDashboardQueryResult = Apollo.QueryResult<
  WirelessDashboardQuery,
  WirelessDashboardQueryVariables
>;
