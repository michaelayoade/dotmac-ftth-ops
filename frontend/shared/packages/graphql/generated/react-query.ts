import {
  useQuery,
  useInfiniteQuery,
  UseQueryOptions,
  UseInfiniteQueryOptions,
  InfiniteData,
} from "@tanstack/react-query";
import { graphqlFetcher } from "../src/client";
export type Maybe<T> = T | null | undefined;
export type InputMaybe<T> = T | null | undefined;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
export type MakeEmpty<T extends { [key: string]: unknown }, K extends keyof T> = {
  [_ in K]?: never;
};
export type Incremental<T> =
  | T
  | { [P in keyof T]?: P extends " $fragmentName" | "__typename" ? T[P] : never };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string };
  String: { input: string; output: string };
  Boolean: { input: boolean; output: boolean };
  Int: { input: number; output: number };
  Float: { input: number; output: number };
  /** Date with time (isoformat) */
  DateTime: { input: string; output: string };
  /** Decimal (fixed-point) */
  Decimal: { input: string; output: string };
  /** The `JSON` scalar type represents JSON values as specified by [ECMA-404](https://ecma-international.org/wp-content/uploads/ECMA-404_2nd_edition_december_2017.pdf). */
  JSON: { input: Record<string, any>; output: Record<string, any> };
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

export type DataSourceStatus = {
  __typename?: "DataSourceStatus";
  name: Scalars["String"]["output"];
  status: Scalars["String"]["output"];
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
  dataSourceStatus: Array<DataSourceStatus>;
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
  createdAt?: Maybe<Scalars["DateTime"]["output"]>;
  customerId?: Maybe<Scalars["String"]["output"]>;
  errorMessage?: Maybe<Scalars["String"]["output"]>;
  ipv4Address?: Maybe<Scalars["String"]["output"]>;
  /** Is provisioning successful */
  isSuccessful: Scalars["Boolean"]["output"];
  onuId?: Maybe<Scalars["String"]["output"]>;
  radiusUsername?: Maybe<Scalars["String"]["output"]>;
  serviceId?: Maybe<Scalars["String"]["output"]>;
  status: WorkflowStatus;
  stepsCompleted?: Maybe<Scalars["Int"]["output"]>;
  subscriberId?: Maybe<Scalars["String"]["output"]>;
  totalSteps?: Maybe<Scalars["Int"]["output"]>;
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
  createdAt?: Maybe<Scalars["DateTime"]["output"]>;
  enabled: Scalars["Boolean"]["output"];
  framedIpAddress?: Maybe<Scalars["String"]["output"]>;
  id: Scalars["Int"]["output"];
  sessions: Array<Session>;
  subscriberId: Scalars["String"]["output"];
  updatedAt?: Maybe<Scalars["DateTime"]["output"]>;
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
  tenantId?: Maybe<Scalars["String"]["output"]>;
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
  targetSystem?: Maybe<Scalars["String"]["output"]>;
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

export type CustomerListQueryResult = {
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
      middleName?: string | null | undefined;
      displayName?: string | null | undefined;
      companyName?: string | null | undefined;
      status: CustomerStatusEnum;
      customerType: CustomerTypeEnum;
      tier: CustomerTierEnum;
      email: string;
      emailVerified: boolean;
      phone?: string | null | undefined;
      phoneVerified: boolean;
      mobile?: string | null | undefined;
      addressLine1?: string | null | undefined;
      addressLine2?: string | null | undefined;
      city?: string | null | undefined;
      stateProvince?: string | null | undefined;
      postalCode?: string | null | undefined;
      country?: string | null | undefined;
      taxId?: string | null | undefined;
      industry?: string | null | undefined;
      employeeCount?: number | null | undefined;
      lifetimeValue: string;
      totalPurchases: number;
      averageOrderValue: string;
      lastPurchaseDate?: string | null | undefined;
      createdAt: string;
      updatedAt: string;
      acquisitionDate: string;
      lastContactDate?: string | null | undefined;
      activities?: Array<{
        __typename?: "CustomerActivity";
        id: string;
        customerId: string;
        activityType: ActivityTypeEnum;
        title: string;
        description?: string | null | undefined;
        performedBy?: string | null | undefined;
        createdAt: string;
      }>;
      notes?: Array<{
        __typename?: "CustomerNote";
        id: string;
        customerId: string;
        subject: string;
        content: string;
        isInternal: boolean;
        createdById?: string | null | undefined;
        createdAt: string;
        updatedAt: string;
      }>;
    }>;
  };
};

export type CustomerDetailQueryVariables = Exact<{
  id: Scalars["ID"]["input"];
}>;

export type CustomerDetailQueryResult = {
  __typename?: "Query";
  customer?:
    | {
        __typename?: "Customer";
        id: string;
        customerNumber: string;
        firstName: string;
        lastName: string;
        middleName?: string | null | undefined;
        displayName?: string | null | undefined;
        companyName?: string | null | undefined;
        status: CustomerStatusEnum;
        customerType: CustomerTypeEnum;
        tier: CustomerTierEnum;
        email: string;
        emailVerified: boolean;
        phone?: string | null | undefined;
        phoneVerified: boolean;
        mobile?: string | null | undefined;
        addressLine1?: string | null | undefined;
        addressLine2?: string | null | undefined;
        city?: string | null | undefined;
        stateProvince?: string | null | undefined;
        postalCode?: string | null | undefined;
        country?: string | null | undefined;
        taxId?: string | null | undefined;
        industry?: string | null | undefined;
        employeeCount?: number | null | undefined;
        lifetimeValue: string;
        totalPurchases: number;
        averageOrderValue: string;
        lastPurchaseDate?: string | null | undefined;
        createdAt: string;
        updatedAt: string;
        acquisitionDate: string;
        lastContactDate?: string | null | undefined;
        activities: Array<{
          __typename?: "CustomerActivity";
          id: string;
          customerId: string;
          activityType: ActivityTypeEnum;
          title: string;
          description?: string | null | undefined;
          performedBy?: string | null | undefined;
          createdAt: string;
        }>;
        notes: Array<{
          __typename?: "CustomerNote";
          id: string;
          customerId: string;
          subject: string;
          content: string;
          isInternal: boolean;
          createdById?: string | null | undefined;
          createdAt: string;
          updatedAt: string;
        }>;
      }
    | null
    | undefined;
};

export type CustomerMetricsQueryVariables = Exact<{ [key: string]: never }>;

export type CustomerMetricsQueryResult = {
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

export type CustomerActivitiesQueryResult = {
  __typename?: "Query";
  customer?:
    | {
        __typename?: "Customer";
        id: string;
        activities: Array<{
          __typename?: "CustomerActivity";
          id: string;
          customerId: string;
          activityType: ActivityTypeEnum;
          title: string;
          description?: string | null | undefined;
          performedBy?: string | null | undefined;
          createdAt: string;
        }>;
      }
    | null
    | undefined;
};

export type CustomerNotesQueryVariables = Exact<{
  id: Scalars["ID"]["input"];
}>;

export type CustomerNotesQueryResult = {
  __typename?: "Query";
  customer?:
    | {
        __typename?: "Customer";
        id: string;
        notes: Array<{
          __typename?: "CustomerNote";
          id: string;
          customerId: string;
          subject: string;
          content: string;
          isInternal: boolean;
          createdById?: string | null | undefined;
          createdAt: string;
          updatedAt: string;
        }>;
      }
    | null
    | undefined;
};

export type CustomerDashboardQueryVariables = Exact<{
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  offset?: InputMaybe<Scalars["Int"]["input"]>;
  status?: InputMaybe<CustomerStatusEnum>;
  search?: InputMaybe<Scalars["String"]["input"]>;
}>;

export type CustomerDashboardQueryResult = {
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
      companyName?: string | null | undefined;
      email: string;
      phone?: string | null | undefined;
      status: CustomerStatusEnum;
      customerType: CustomerTypeEnum;
      tier: CustomerTierEnum;
      lifetimeValue: string;
      totalPurchases: number;
      lastContactDate?: string | null | undefined;
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

export type CustomerSubscriptionsQueryResult = {
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
    trialEnd?: string | null | undefined;
    isInTrial: boolean;
    cancelAtPeriodEnd: boolean;
    canceledAt?: string | null | undefined;
    endedAt?: string | null | undefined;
    createdAt: string;
    updatedAt: string;
  }>;
};

export type CustomerNetworkInfoQueryVariables = Exact<{
  customerId: Scalars["ID"]["input"];
}>;

export type CustomerNetworkInfoQueryResult = {
  __typename?: "Query";
  customerNetworkInfo: Record<string, any>;
};

export type CustomerDevicesQueryVariables = Exact<{
  customerId: Scalars["ID"]["input"];
  deviceType?: InputMaybe<Scalars["String"]["input"]>;
  activeOnly?: InputMaybe<Scalars["Boolean"]["input"]>;
}>;

export type CustomerDevicesQueryResult = {
  __typename?: "Query";
  customerDevices: Record<string, any>;
};

export type CustomerTicketsQueryVariables = Exact<{
  customerId: Scalars["ID"]["input"];
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  status?: InputMaybe<Scalars["String"]["input"]>;
}>;

export type CustomerTicketsQueryResult = {
  __typename?: "Query";
  customerTickets: Record<string, any>;
};

export type CustomerBillingQueryVariables = Exact<{
  customerId: Scalars["ID"]["input"];
  includeInvoices?: InputMaybe<Scalars["Boolean"]["input"]>;
  invoiceLimit?: InputMaybe<Scalars["Int"]["input"]>;
}>;

export type CustomerBillingQueryResult = {
  __typename?: "Query";
  customerBilling: Record<string, any>;
};

export type Customer360ViewQueryVariables = Exact<{
  customerId: Scalars["ID"]["input"];
}>;

export type Customer360ViewQueryResult = {
  __typename?: "Query";
  customerNetworkInfo: Record<string, any>;
  customerDevices: Record<string, any>;
  customerTickets: Record<string, any>;
  customerBilling: Record<string, any>;
  customer?:
    | {
        __typename?: "Customer";
        id: string;
        customerNumber: string;
        firstName: string;
        lastName: string;
        middleName?: string | null | undefined;
        displayName?: string | null | undefined;
        companyName?: string | null | undefined;
        status: CustomerStatusEnum;
        customerType: CustomerTypeEnum;
        tier: CustomerTierEnum;
        email: string;
        emailVerified: boolean;
        phone?: string | null | undefined;
        phoneVerified: boolean;
        mobile?: string | null | undefined;
        addressLine1?: string | null | undefined;
        addressLine2?: string | null | undefined;
        city?: string | null | undefined;
        stateProvince?: string | null | undefined;
        postalCode?: string | null | undefined;
        country?: string | null | undefined;
        taxId?: string | null | undefined;
        industry?: string | null | undefined;
        employeeCount?: number | null | undefined;
        lifetimeValue: string;
        totalPurchases: number;
        averageOrderValue: string;
        lastPurchaseDate?: string | null | undefined;
        createdAt: string;
        updatedAt: string;
        acquisitionDate: string;
        lastContactDate?: string | null | undefined;
        activities: Array<{
          __typename?: "CustomerActivity";
          id: string;
          customerId: string;
          activityType: ActivityTypeEnum;
          title: string;
          description?: string | null | undefined;
          performedBy?: string | null | undefined;
          createdAt: string;
        }>;
        notes: Array<{
          __typename?: "CustomerNote";
          id: string;
          customerId: string;
          subject: string;
          content: string;
          isInternal: boolean;
          createdById?: string | null | undefined;
          createdAt: string;
          updatedAt: string;
        }>;
      }
    | null
    | undefined;
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

export type CustomerNetworkStatusUpdatedSubscriptionResult = {
  __typename?: "RealtimeSubscription";
  customerNetworkStatusUpdated: {
    __typename?: "CustomerNetworkStatusUpdate";
    customerId: string;
    connectionStatus: string;
    lastSeenAt: string;
    ipv4Address?: string | null | undefined;
    ipv6Address?: string | null | undefined;
    macAddress?: string | null | undefined;
    vlanId?: number | null | undefined;
    signalStrength?: number | null | undefined;
    signalQuality?: number | null | undefined;
    uptimeSeconds?: number | null | undefined;
    uptimePercentage?: string | null | undefined;
    bandwidthUsageMbps?: string | null | undefined;
    downloadSpeedMbps?: string | null | undefined;
    uploadSpeedMbps?: string | null | undefined;
    packetLoss?: string | null | undefined;
    latencyMs?: number | null | undefined;
    jitter?: string | null | undefined;
    ontRxPower?: string | null | undefined;
    ontTxPower?: string | null | undefined;
    oltRxPower?: string | null | undefined;
    serviceStatus?: string | null | undefined;
    updatedAt: string;
  };
};

export type CustomerDevicesUpdatedSubscriptionVariables = Exact<{
  customerId: Scalars["ID"]["input"];
}>;

export type CustomerDevicesUpdatedSubscriptionResult = {
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
    lastSeenAt?: string | null | undefined;
    signalStrength?: number | null | undefined;
    temperature?: number | null | undefined;
    cpuUsage?: number | null | undefined;
    memoryUsage?: number | null | undefined;
    uptimeSeconds?: number | null | undefined;
    firmwareVersion?: string | null | undefined;
    needsFirmwareUpdate: boolean;
    changeType: string;
    previousValue?: string | null | undefined;
    newValue?: string | null | undefined;
    updatedAt: string;
  };
};

export type CustomerTicketUpdatedSubscriptionVariables = Exact<{
  customerId: Scalars["ID"]["input"];
}>;

export type CustomerTicketUpdatedSubscriptionResult = {
  __typename?: "RealtimeSubscription";
  customerTicketUpdated: {
    __typename?: "CustomerTicketUpdate";
    customerId: string;
    action: string;
    changedBy?: string | null | undefined;
    changedByName?: string | null | undefined;
    changes?: Array<string> | null | undefined;
    comment?: string | null | undefined;
    updatedAt: string;
    ticket: {
      __typename?: "CustomerTicketUpdateData";
      id: string;
      ticketNumber: string;
      title: string;
      description?: string | null | undefined;
      status: string;
      priority: string;
      category?: string | null | undefined;
      subCategory?: string | null | undefined;
      assignedTo?: string | null | undefined;
      assignedToName?: string | null | undefined;
      assignedTeam?: string | null | undefined;
      createdAt: string;
      updatedAt: string;
      resolvedAt?: string | null | undefined;
      closedAt?: string | null | undefined;
      customerId: string;
      customerName?: string | null | undefined;
    };
  };
};

export type CustomerActivityAddedSubscriptionVariables = Exact<{
  customerId: Scalars["ID"]["input"];
}>;

export type CustomerActivityAddedSubscriptionResult = {
  __typename?: "RealtimeSubscription";
  customerActivityAdded: {
    __typename?: "CustomerActivityUpdate";
    id: string;
    customerId: string;
    activityType: string;
    title: string;
    description?: string | null | undefined;
    performedBy?: string | null | undefined;
    performedByName?: string | null | undefined;
    createdAt: string;
  };
};

export type CustomerNoteUpdatedSubscriptionVariables = Exact<{
  customerId: Scalars["ID"]["input"];
}>;

export type CustomerNoteUpdatedSubscriptionResult = {
  __typename?: "RealtimeSubscription";
  customerNoteUpdated: {
    __typename?: "CustomerNoteUpdate";
    customerId: string;
    action: string;
    changedBy: string;
    changedByName?: string | null | undefined;
    updatedAt: string;
    note?:
      | {
          __typename?: "CustomerNoteData";
          id: string;
          customerId: string;
          subject: string;
          content: string;
          isInternal: boolean;
          createdById: string;
          createdByName?: string | null | undefined;
          createdAt: string;
          updatedAt: string;
        }
      | null
      | undefined;
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

export type FiberCableListQueryResult = {
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
      description?: string | null | undefined;
      status: FiberCableStatus;
      isActive: boolean;
      fiberType: FiberType;
      totalStrands: number;
      availableStrands: number;
      usedStrands: number;
      manufacturer?: string | null | undefined;
      model?: string | null | undefined;
      installationType: CableInstallationType;
      lengthMeters: number;
      startDistributionPointId: string;
      endDistributionPointId: string;
      startPointName?: string | null | undefined;
      endPointName?: string | null | undefined;
      capacityUtilizationPercent: number;
      bandwidthCapacityGbps?: number | null | undefined;
      spliceCount: number;
      totalLossDb?: number | null | undefined;
      averageAttenuationDbPerKm?: number | null | undefined;
      maxAttenuationDbPerKm?: number | null | undefined;
      isLeased: boolean;
      installedAt?: string | null | undefined;
      createdAt: string;
      updatedAt: string;
      route: {
        __typename?: "CableRoute";
        totalDistanceMeters: number;
        startPoint: {
          __typename?: "GeoCoordinate";
          latitude: number;
          longitude: number;
          altitude?: number | null | undefined;
        };
        endPoint: {
          __typename?: "GeoCoordinate";
          latitude: number;
          longitude: number;
          altitude?: number | null | undefined;
        };
      };
    }>;
  };
};

export type FiberCableDetailQueryVariables = Exact<{
  id: Scalars["ID"]["input"];
}>;

export type FiberCableDetailQueryResult = {
  __typename?: "Query";
  fiberCable?:
    | {
        __typename?: "FiberCable";
        id: string;
        cableId: string;
        name: string;
        description?: string | null | undefined;
        status: FiberCableStatus;
        isActive: boolean;
        fiberType: FiberType;
        totalStrands: number;
        availableStrands: number;
        usedStrands: number;
        manufacturer?: string | null | undefined;
        model?: string | null | undefined;
        installationType: CableInstallationType;
        lengthMeters: number;
        startDistributionPointId: string;
        endDistributionPointId: string;
        startPointName?: string | null | undefined;
        endPointName?: string | null | undefined;
        capacityUtilizationPercent: number;
        bandwidthCapacityGbps?: number | null | undefined;
        splicePointIds: Array<string>;
        spliceCount: number;
        totalLossDb?: number | null | undefined;
        averageAttenuationDbPerKm?: number | null | undefined;
        maxAttenuationDbPerKm?: number | null | undefined;
        conduitId?: string | null | undefined;
        ductNumber?: number | null | undefined;
        armored: boolean;
        fireRated: boolean;
        ownerId?: string | null | undefined;
        ownerName?: string | null | undefined;
        isLeased: boolean;
        installedAt?: string | null | undefined;
        testedAt?: string | null | undefined;
        createdAt: string;
        updatedAt: string;
        route: {
          __typename?: "CableRoute";
          pathGeojson: string;
          totalDistanceMeters: number;
          elevationChangeMeters?: number | null | undefined;
          undergroundDistanceMeters?: number | null | undefined;
          aerialDistanceMeters?: number | null | undefined;
          startPoint: {
            __typename?: "GeoCoordinate";
            latitude: number;
            longitude: number;
            altitude?: number | null | undefined;
          };
          endPoint: {
            __typename?: "GeoCoordinate";
            latitude: number;
            longitude: number;
            altitude?: number | null | undefined;
          };
          intermediatePoints: Array<{
            __typename?: "GeoCoordinate";
            latitude: number;
            longitude: number;
            altitude?: number | null | undefined;
          }>;
        };
        strands: Array<{
          __typename?: "FiberStrand";
          strandId: number;
          colorCode?: string | null | undefined;
          isActive: boolean;
          isAvailable: boolean;
          customerId?: string | null | undefined;
          customerName?: string | null | undefined;
          serviceId?: string | null | undefined;
          attenuationDb?: number | null | undefined;
          lossDb?: number | null | undefined;
          spliceCount: number;
        }>;
      }
    | null
    | undefined;
};

export type FiberCablesByRouteQueryVariables = Exact<{
  startPointId: Scalars["String"]["input"];
  endPointId: Scalars["String"]["input"];
}>;

export type FiberCablesByRouteQueryResult = {
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

export type FiberCablesByDistributionPointQueryResult = {
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

export type SplicePointListQueryResult = {
  __typename?: "Query";
  splicePoints: {
    __typename?: "SplicePointConnection";
    totalCount: number;
    hasNextPage: boolean;
    splicePoints: Array<{
      __typename?: "SplicePoint";
      id: string;
      spliceId: string;
      name: string;
      description?: string | null | undefined;
      status: SpliceStatus;
      isActive: boolean;
      closureType?: string | null | undefined;
      manufacturer?: string | null | undefined;
      model?: string | null | undefined;
      trayCount: number;
      trayCapacity: number;
      cablesConnected: Array<string>;
      cableCount: number;
      totalSplices: number;
      activeSplices: number;
      averageSpliceLossDb?: number | null | undefined;
      maxSpliceLossDb?: number | null | undefined;
      passingSplices: number;
      failingSplices: number;
      accessType: string;
      requiresSpecialAccess: boolean;
      installedAt?: string | null | undefined;
      lastTestedAt?: string | null | undefined;
      lastMaintainedAt?: string | null | undefined;
      createdAt: string;
      updatedAt: string;
      location: {
        __typename?: "GeoCoordinate";
        latitude: number;
        longitude: number;
        altitude?: number | null | undefined;
      };
    }>;
  };
};

export type SplicePointDetailQueryVariables = Exact<{
  id: Scalars["ID"]["input"];
}>;

export type SplicePointDetailQueryResult = {
  __typename?: "Query";
  splicePoint?:
    | {
        __typename?: "SplicePoint";
        id: string;
        spliceId: string;
        name: string;
        description?: string | null | undefined;
        status: SpliceStatus;
        isActive: boolean;
        distributionPointId?: string | null | undefined;
        closureType?: string | null | undefined;
        manufacturer?: string | null | undefined;
        model?: string | null | undefined;
        trayCount: number;
        trayCapacity: number;
        cablesConnected: Array<string>;
        cableCount: number;
        totalSplices: number;
        activeSplices: number;
        averageSpliceLossDb?: number | null | undefined;
        maxSpliceLossDb?: number | null | undefined;
        passingSplices: number;
        failingSplices: number;
        accessType: string;
        requiresSpecialAccess: boolean;
        accessNotes?: string | null | undefined;
        installedAt?: string | null | undefined;
        lastTestedAt?: string | null | undefined;
        lastMaintainedAt?: string | null | undefined;
        createdAt: string;
        updatedAt: string;
        location: {
          __typename?: "GeoCoordinate";
          latitude: number;
          longitude: number;
          altitude?: number | null | undefined;
        };
        address?:
          | {
              __typename?: "Address";
              streetAddress: string;
              city: string;
              stateProvince: string;
              postalCode: string;
              country: string;
            }
          | null
          | undefined;
        spliceConnections: Array<{
          __typename?: "SpliceConnection";
          cableAId: string;
          cableAStrand: number;
          cableBId: string;
          cableBStrand: number;
          spliceType: SpliceType;
          lossDb?: number | null | undefined;
          reflectanceDb?: number | null | undefined;
          isPassing: boolean;
          testResult?: string | null | undefined;
          testedAt?: string | null | undefined;
          testedBy?: string | null | undefined;
        }>;
      }
    | null
    | undefined;
};

export type SplicePointsByCableQueryVariables = Exact<{
  cableId: Scalars["String"]["input"];
}>;

export type SplicePointsByCableQueryResult = {
  __typename?: "Query";
  splicePointsByCable: Array<{
    __typename?: "SplicePoint";
    id: string;
    spliceId: string;
    name: string;
    status: SpliceStatus;
    totalSplices: number;
    activeSplices: number;
    averageSpliceLossDb?: number | null | undefined;
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

export type DistributionPointListQueryResult = {
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
      description?: string | null | undefined;
      pointType: DistributionPointType;
      status: FiberCableStatus;
      isActive: boolean;
      manufacturer?: string | null | undefined;
      model?: string | null | undefined;
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
      temperatureCelsius?: number | null | undefined;
      humidityPercent?: number | null | undefined;
      capacityUtilizationPercent: number;
      fiberStrandCount: number;
      availableStrandCount: number;
      servesCustomerCount: number;
      accessType: string;
      requiresKey: boolean;
      installedAt?: string | null | undefined;
      lastInspectedAt?: string | null | undefined;
      lastMaintainedAt?: string | null | undefined;
      createdAt: string;
      updatedAt: string;
      location: {
        __typename?: "GeoCoordinate";
        latitude: number;
        longitude: number;
        altitude?: number | null | undefined;
      };
    }>;
  };
};

export type DistributionPointDetailQueryVariables = Exact<{
  id: Scalars["ID"]["input"];
}>;

export type DistributionPointDetailQueryResult = {
  __typename?: "Query";
  distributionPoint?:
    | {
        __typename?: "DistributionPoint";
        id: string;
        siteId: string;
        name: string;
        description?: string | null | undefined;
        pointType: DistributionPointType;
        status: FiberCableStatus;
        isActive: boolean;
        siteName?: string | null | undefined;
        manufacturer?: string | null | undefined;
        model?: string | null | undefined;
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
        temperatureCelsius?: number | null | undefined;
        humidityPercent?: number | null | undefined;
        capacityUtilizationPercent: number;
        fiberStrandCount: number;
        availableStrandCount: number;
        serviceAreaIds: Array<string>;
        servesCustomerCount: number;
        accessType: string;
        requiresKey: boolean;
        securityLevel?: string | null | undefined;
        accessNotes?: string | null | undefined;
        installedAt?: string | null | undefined;
        lastInspectedAt?: string | null | undefined;
        lastMaintainedAt?: string | null | undefined;
        createdAt: string;
        updatedAt: string;
        location: {
          __typename?: "GeoCoordinate";
          latitude: number;
          longitude: number;
          altitude?: number | null | undefined;
        };
        address?:
          | {
              __typename?: "Address";
              streetAddress: string;
              city: string;
              stateProvince: string;
              postalCode: string;
              country: string;
            }
          | null
          | undefined;
        ports: Array<{
          __typename?: "PortAllocation";
          portNumber: number;
          isAllocated: boolean;
          isActive: boolean;
          cableId?: string | null | undefined;
          strandId?: number | null | undefined;
          customerId?: string | null | undefined;
          customerName?: string | null | undefined;
          serviceId?: string | null | undefined;
        }>;
      }
    | null
    | undefined;
};

export type DistributionPointsBySiteQueryVariables = Exact<{
  siteId: Scalars["String"]["input"];
}>;

export type DistributionPointsBySiteQueryResult = {
  __typename?: "Query";
  distributionPointsBySite: Array<{
    __typename?: "DistributionPoint";
    id: string;
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

export type ServiceAreaListQueryResult = {
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
      description?: string | null | undefined;
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
      penetrationRatePercent?: number | null | undefined;
      distributionPointCount: number;
      totalFiberKm: number;
      totalCapacity: number;
      usedCapacity: number;
      availableCapacity: number;
      capacityUtilizationPercent: number;
      maxBandwidthGbps: number;
      estimatedPopulation?: number | null | undefined;
      householdDensityPerSqkm?: number | null | undefined;
      constructionStatus: string;
      constructionCompletePercent?: number | null | undefined;
      targetCompletionDate?: string | null | undefined;
      plannedAt?: string | null | undefined;
      constructionStartedAt?: string | null | undefined;
      activatedAt?: string | null | undefined;
      createdAt: string;
      updatedAt: string;
    }>;
  };
};

export type ServiceAreaDetailQueryVariables = Exact<{
  id: Scalars["ID"]["input"];
}>;

export type ServiceAreaDetailQueryResult = {
  __typename?: "Query";
  serviceArea?:
    | {
        __typename?: "ServiceArea";
        id: string;
        areaId: string;
        name: string;
        description?: string | null | undefined;
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
        penetrationRatePercent?: number | null | undefined;
        distributionPointIds: Array<string>;
        distributionPointCount: number;
        totalFiberKm: number;
        totalCapacity: number;
        usedCapacity: number;
        availableCapacity: number;
        capacityUtilizationPercent: number;
        maxBandwidthGbps: number;
        averageDistanceToDistributionMeters?: number | null | undefined;
        estimatedPopulation?: number | null | undefined;
        householdDensityPerSqkm?: number | null | undefined;
        constructionStatus: string;
        constructionCompletePercent?: number | null | undefined;
        targetCompletionDate?: string | null | undefined;
        plannedAt?: string | null | undefined;
        constructionStartedAt?: string | null | undefined;
        activatedAt?: string | null | undefined;
        createdAt: string;
        updatedAt: string;
      }
    | null
    | undefined;
};

export type ServiceAreasByPostalCodeQueryVariables = Exact<{
  postalCode: Scalars["String"]["input"];
}>;

export type ServiceAreasByPostalCodeQueryResult = {
  __typename?: "Query";
  serviceAreasByPostalCode: Array<{
    __typename?: "ServiceArea";
    id: string;
    areaId: string;
    name: string;
    city: string;
    stateProvince: string;
    isServiceable: boolean;
    homesPassed: number;
    homesConnected: number;
    penetrationRatePercent?: number | null | undefined;
    maxBandwidthGbps: number;
  }>;
};

export type FiberHealthMetricsQueryVariables = Exact<{
  cableId?: InputMaybe<Scalars["String"]["input"]>;
  healthStatus?: InputMaybe<FiberHealthStatus>;
}>;

export type FiberHealthMetricsQueryResult = {
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
    reflectanceDb?: number | null | undefined;
    averageSpliceLossDb?: number | null | undefined;
    maxSpliceLossDb?: number | null | undefined;
    failingSplicesCount: number;
    totalStrands: number;
    activeStrands: number;
    degradedStrands: number;
    failedStrands: number;
    lastTestedAt?: string | null | undefined;
    testPassRatePercent?: number | null | undefined;
    daysSinceLastTest?: number | null | undefined;
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

export type OtdrTestResultsQueryResult = {
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
    marginDb?: number | null | undefined;
    traceFileUrl?: string | null | undefined;
  }>;
};

export type FiberNetworkAnalyticsQueryVariables = Exact<{ [key: string]: never }>;

export type FiberNetworkAnalyticsQueryResult = {
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

export type FiberDashboardQueryResult = {
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
      penetrationRatePercent?: number | null | undefined;
      homesPassed: number;
      homesConnected: number;
    }>;
    cablesRequiringAttention: Array<{
      __typename?: "FiberHealthMetrics";
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
      penetrationRatePercent?: number | null | undefined;
      homesPassed: number;
    }>;
  };
};

export type NetworkOverviewQueryVariables = Exact<{ [key: string]: never }>;

export type NetworkOverviewQueryResult = {
  __typename?: "Query";
  networkOverview: {
    __typename?: "NetworkOverview";
    totalDevices: number;
    onlineDevices: number;
    offlineDevices: number;
    activeAlerts: number;
    criticalAlerts: number;
    warningAlerts: number;
    totalBandwidthGbps: number;
    uptimePercentage: number;
    dataSourceStatus: Array<{ __typename?: "DataSourceStatus"; name: string; status: string }>;
    deviceTypeSummary: Array<{
      __typename?: "DeviceTypeSummary";
      deviceType: DeviceTypeEnum;
      totalCount: number;
      onlineCount: number;
      avgCpuUsage?: number | null | undefined;
      avgMemoryUsage?: number | null | undefined;
    }>;
    recentAlerts: Array<{
      __typename?: "NetworkAlert";
      alertId: string;
      severity: AlertSeverityEnum;
      title: string;
      description: string;
      deviceName?: string | null | undefined;
      deviceId?: string | null | undefined;
      deviceType?: DeviceTypeEnum | null | undefined;
      triggeredAt: string;
      acknowledgedAt?: string | null | undefined;
      resolvedAt?: string | null | undefined;
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

export type NetworkDeviceListQueryResult = {
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
      ipAddress?: string | null | undefined;
      firmwareVersion?: string | null | undefined;
      model?: string | null | undefined;
      location?: string | null | undefined;
      tenantId: string;
      cpuUsagePercent?: number | null | undefined;
      memoryUsagePercent?: number | null | undefined;
      temperatureCelsius?: number | null | undefined;
      powerStatus?: string | null | undefined;
      pingLatencyMs?: number | null | undefined;
      packetLossPercent?: number | null | undefined;
      uptimeSeconds?: number | null | undefined;
      uptimeDays?: number | null | undefined;
      lastSeen?: string | null | undefined;
      isHealthy: boolean;
    }>;
  };
};

export type DeviceDetailQueryVariables = Exact<{
  deviceId: Scalars["String"]["input"];
  deviceType: DeviceTypeEnum;
}>;

export type DeviceDetailQueryResult = {
  __typename?: "Query";
  deviceHealth?:
    | {
        __typename?: "DeviceHealth";
        deviceId: string;
        deviceName: string;
        deviceType: DeviceTypeEnum;
        status: DeviceStatusEnum;
        ipAddress?: string | null | undefined;
        firmwareVersion?: string | null | undefined;
        model?: string | null | undefined;
        location?: string | null | undefined;
        tenantId: string;
        cpuUsagePercent?: number | null | undefined;
        memoryUsagePercent?: number | null | undefined;
        temperatureCelsius?: number | null | undefined;
        powerStatus?: string | null | undefined;
        pingLatencyMs?: number | null | undefined;
        packetLossPercent?: number | null | undefined;
        uptimeSeconds?: number | null | undefined;
        uptimeDays?: number | null | undefined;
        lastSeen?: string | null | undefined;
        isHealthy: boolean;
      }
    | null
    | undefined;
  deviceTraffic?:
    | {
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
        peakRateInBps?: number | null | undefined;
        peakRateOutBps?: number | null | undefined;
        peakTimestamp?: string | null | undefined;
        timestamp: string;
      }
    | null
    | undefined;
};

export type DeviceTrafficQueryVariables = Exact<{
  deviceId: Scalars["String"]["input"];
  deviceType: DeviceTypeEnum;
  includeInterfaces?: InputMaybe<Scalars["Boolean"]["input"]>;
}>;

export type DeviceTrafficQueryResult = {
  __typename?: "Query";
  deviceTraffic?:
    | {
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
        peakRateInBps?: number | null | undefined;
        peakRateOutBps?: number | null | undefined;
        peakTimestamp?: string | null | undefined;
        timestamp: string;
        interfaces?: Array<{
          __typename?: "InterfaceStats";
          interfaceName: string;
          status: string;
          rateInBps?: number | null | undefined;
          rateOutBps?: number | null | undefined;
          bytesIn: number;
          bytesOut: number;
          errorsIn: number;
          errorsOut: number;
          dropsIn: number;
          dropsOut: number;
        }>;
      }
    | null
    | undefined;
};

export type NetworkAlertListQueryVariables = Exact<{
  page?: InputMaybe<Scalars["Int"]["input"]>;
  pageSize?: InputMaybe<Scalars["Int"]["input"]>;
  severity?: InputMaybe<AlertSeverityEnum>;
  activeOnly?: InputMaybe<Scalars["Boolean"]["input"]>;
  deviceId?: InputMaybe<Scalars["String"]["input"]>;
  deviceType?: InputMaybe<DeviceTypeEnum>;
}>;

export type NetworkAlertListQueryResult = {
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
      alertRuleId?: string | null | undefined;
      severity: AlertSeverityEnum;
      title: string;
      description: string;
      deviceName?: string | null | undefined;
      deviceId?: string | null | undefined;
      deviceType?: DeviceTypeEnum | null | undefined;
      metricName?: string | null | undefined;
      currentValue?: number | null | undefined;
      thresholdValue?: number | null | undefined;
      triggeredAt: string;
      acknowledgedAt?: string | null | undefined;
      resolvedAt?: string | null | undefined;
      isActive: boolean;
      isAcknowledged: boolean;
      tenantId: string;
    }>;
  };
};

export type NetworkAlertDetailQueryVariables = Exact<{
  alertId: Scalars["String"]["input"];
}>;

export type NetworkAlertDetailQueryResult = {
  __typename?: "Query";
  networkAlert?:
    | {
        __typename?: "NetworkAlert";
        alertId: string;
        alertRuleId?: string | null | undefined;
        severity: AlertSeverityEnum;
        title: string;
        description: string;
        deviceName?: string | null | undefined;
        deviceId?: string | null | undefined;
        deviceType?: DeviceTypeEnum | null | undefined;
        metricName?: string | null | undefined;
        currentValue?: number | null | undefined;
        thresholdValue?: number | null | undefined;
        triggeredAt: string;
        acknowledgedAt?: string | null | undefined;
        resolvedAt?: string | null | undefined;
        isActive: boolean;
        isAcknowledged: boolean;
        tenantId: string;
      }
    | null
    | undefined;
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

export type NetworkDashboardQueryResult = {
  __typename?: "Query";
  networkOverview: {
    __typename?: "NetworkOverview";
    totalDevices: number;
    onlineDevices: number;
    offlineDevices: number;
    activeAlerts: number;
    criticalAlerts: number;
    warningAlerts: number;
    totalBandwidthGbps: number;
    uptimePercentage: number;
    dataSourceStatus: Array<{ __typename?: "DataSourceStatus"; name: string; status: string }>;
    deviceTypeSummary: Array<{
      __typename?: "DeviceTypeSummary";
      deviceType: DeviceTypeEnum;
      totalCount: number;
      onlineCount: number;
      avgCpuUsage?: number | null | undefined;
      avgMemoryUsage?: number | null | undefined;
    }>;
    recentAlerts: Array<{
      __typename?: "NetworkAlert";
      alertId: string;
      severity: AlertSeverityEnum;
      title: string;
      deviceName?: string | null | undefined;
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
      ipAddress?: string | null | undefined;
      cpuUsagePercent?: number | null | undefined;
      memoryUsagePercent?: number | null | undefined;
      uptimeSeconds?: number | null | undefined;
      isHealthy: boolean;
      lastSeen?: string | null | undefined;
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
      deviceName?: string | null | undefined;
      deviceType?: DeviceTypeEnum | null | undefined;
      triggeredAt: string;
      isActive: boolean;
    }>;
  };
};

export type DeviceUpdatesSubscriptionVariables = Exact<{
  deviceType?: InputMaybe<DeviceTypeEnum>;
  status?: InputMaybe<DeviceStatusEnum>;
}>;

export type DeviceUpdatesSubscriptionResult = {
  __typename?: "RealtimeSubscription";
  deviceUpdated: {
    __typename?: "DeviceUpdate";
    deviceId: string;
    deviceName: string;
    deviceType: DeviceTypeEnum;
    status: DeviceStatusEnum;
    ipAddress?: string | null | undefined;
    firmwareVersion?: string | null | undefined;
    model?: string | null | undefined;
    location?: string | null | undefined;
    tenantId: string;
    cpuUsagePercent?: number | null | undefined;
    memoryUsagePercent?: number | null | undefined;
    temperatureCelsius?: number | null | undefined;
    powerStatus?: string | null | undefined;
    pingLatencyMs?: number | null | undefined;
    packetLossPercent?: number | null | undefined;
    uptimeSeconds?: number | null | undefined;
    uptimeDays?: number | null | undefined;
    lastSeen?: string | null | undefined;
    isHealthy: boolean;
    changeType: string;
    previousValue?: string | null | undefined;
    newValue?: string | null | undefined;
    updatedAt: string;
  };
};

export type NetworkAlertUpdatesSubscriptionVariables = Exact<{
  severity?: InputMaybe<AlertSeverityEnum>;
  deviceId?: InputMaybe<Scalars["String"]["input"]>;
}>;

export type NetworkAlertUpdatesSubscriptionResult = {
  __typename?: "RealtimeSubscription";
  networkAlertUpdated: {
    __typename?: "NetworkAlertUpdate";
    action: string;
    updatedAt: string;
    alert: {
      __typename?: "NetworkAlert";
      alertId: string;
      alertRuleId?: string | null | undefined;
      severity: AlertSeverityEnum;
      title: string;
      description: string;
      deviceName?: string | null | undefined;
      deviceId?: string | null | undefined;
      deviceType?: DeviceTypeEnum | null | undefined;
      metricName?: string | null | undefined;
      currentValue?: number | null | undefined;
      thresholdValue?: number | null | undefined;
      triggeredAt: string;
      acknowledgedAt?: string | null | undefined;
      resolvedAt?: string | null | undefined;
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

export type SubscriberDashboardQueryResult = {
  __typename?: "Query";
  subscribers: Array<{
    __typename?: "Subscriber";
    id: number;
    subscriberId: string;
    username: string;
    enabled: boolean;
    framedIpAddress?: string | null | undefined;
    bandwidthProfileId?: string | null | undefined;
    createdAt?: string | null | undefined;
    updatedAt?: string | null | undefined;
    sessions: Array<{
      __typename?: "Session";
      radacctid: number;
      username: string;
      nasipaddress: string;
      acctsessionid: string;
      acctsessiontime?: number | null | undefined;
      acctinputoctets?: number | null | undefined;
      acctoutputoctets?: number | null | undefined;
      acctstarttime?: string | null | undefined;
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

export type SubscriberQueryResult = {
  __typename?: "Query";
  subscribers: Array<{
    __typename?: "Subscriber";
    id: number;
    subscriberId: string;
    username: string;
    enabled: boolean;
    framedIpAddress?: string | null | undefined;
    bandwidthProfileId?: string | null | undefined;
    createdAt?: string | null | undefined;
    updatedAt?: string | null | undefined;
    sessions: Array<{
      __typename?: "Session";
      radacctid: number;
      username: string;
      nasipaddress: string;
      acctsessionid: string;
      acctsessiontime?: number | null | undefined;
      acctinputoctets?: number | null | undefined;
      acctoutputoctets?: number | null | undefined;
      acctstarttime?: string | null | undefined;
      acctstoptime?: string | null | undefined;
    }>;
  }>;
};

export type ActiveSessionsQueryVariables = Exact<{
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  username?: InputMaybe<Scalars["String"]["input"]>;
}>;

export type ActiveSessionsQueryResult = {
  __typename?: "Query";
  sessions: Array<{
    __typename?: "Session";
    radacctid: number;
    username: string;
    nasipaddress: string;
    acctsessionid: string;
    acctsessiontime?: number | null | undefined;
    acctinputoctets?: number | null | undefined;
    acctoutputoctets?: number | null | undefined;
    acctstarttime?: string | null | undefined;
  }>;
};

export type SubscriberMetricsQueryVariables = Exact<{ [key: string]: never }>;

export type SubscriberMetricsQueryResult = {
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

export type SubscriptionListQueryResult = {
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
      trialEnd?: string | null | undefined;
      isInTrial: boolean;
      cancelAtPeriodEnd: boolean;
      canceledAt?: string | null | undefined;
      endedAt?: string | null | undefined;
      customPrice?: string | null | undefined;
      usageRecords: Record<string, any>;
      createdAt: string;
      updatedAt: string;
      isActive: boolean;
      daysUntilRenewal: number;
      isPastDue: boolean;
      customer?:
        | {
            __typename?: "SubscriptionCustomer";
            id: string;
            customerId: string;
            name?: string | null | undefined;
            email: string;
            phone?: string | null | undefined;
            createdAt: string;
          }
        | null
        | undefined;
      plan?:
        | {
            __typename?: "SubscriptionPlan";
            id: string;
            planId: string;
            productId: string;
            name: string;
            description?: string | null | undefined;
            billingCycle: BillingCycleEnum;
            price: string;
            currency: string;
            setupFee?: string | null | undefined;
            trialDays?: number | null | undefined;
            isActive: boolean;
            hasTrial: boolean;
            hasSetupFee: boolean;
            includedUsage: Record<string, any>;
            overageRates: Record<string, any>;
            createdAt: string;
            updatedAt: string;
          }
        | null
        | undefined;
      recentInvoices?: Array<{
        __typename?: "SubscriptionInvoice";
        id: string;
        invoiceId: string;
        invoiceNumber: string;
        amount: string;
        currency: string;
        status: string;
        dueDate: string;
        paidAt?: string | null | undefined;
        createdAt: string;
      }>;
    }>;
  };
};

export type SubscriptionDetailQueryVariables = Exact<{
  id: Scalars["ID"]["input"];
}>;

export type SubscriptionDetailQueryResult = {
  __typename?: "Query";
  subscription?:
    | {
        __typename?: "Subscription";
        id: string;
        subscriptionId: string;
        customerId: string;
        planId: string;
        tenantId: string;
        currentPeriodStart: string;
        currentPeriodEnd: string;
        status: SubscriptionStatusEnum;
        trialEnd?: string | null | undefined;
        isInTrial: boolean;
        cancelAtPeriodEnd: boolean;
        canceledAt?: string | null | undefined;
        endedAt?: string | null | undefined;
        customPrice?: string | null | undefined;
        usageRecords: Record<string, any>;
        createdAt: string;
        updatedAt: string;
        isActive: boolean;
        daysUntilRenewal: number;
        isPastDue: boolean;
        customer?:
          | {
              __typename?: "SubscriptionCustomer";
              id: string;
              customerId: string;
              name?: string | null | undefined;
              email: string;
              phone?: string | null | undefined;
              createdAt: string;
            }
          | null
          | undefined;
        plan?:
          | {
              __typename?: "SubscriptionPlan";
              id: string;
              planId: string;
              productId: string;
              name: string;
              description?: string | null | undefined;
              billingCycle: BillingCycleEnum;
              price: string;
              currency: string;
              setupFee?: string | null | undefined;
              trialDays?: number | null | undefined;
              isActive: boolean;
              hasTrial: boolean;
              hasSetupFee: boolean;
              includedUsage: Record<string, any>;
              overageRates: Record<string, any>;
              createdAt: string;
              updatedAt: string;
            }
          | null
          | undefined;
        recentInvoices: Array<{
          __typename?: "SubscriptionInvoice";
          id: string;
          invoiceId: string;
          invoiceNumber: string;
          amount: string;
          currency: string;
          status: string;
          dueDate: string;
          paidAt?: string | null | undefined;
          createdAt: string;
        }>;
      }
    | null
    | undefined;
};

export type SubscriptionMetricsQueryVariables = Exact<{ [key: string]: never }>;

export type SubscriptionMetricsQueryResult = {
  __typename?: "Query";
  subscriptionMetrics: {
    __typename?: "SubscriptionMetrics";
    totalSubscriptions: number;
    activeSubscriptions: number;
    trialingSubscriptions: number;
    pastDueSubscriptions: number;
    canceledSubscriptions: number;
    pausedSubscriptions: number;
    monthlyRecurringRevenue: string;
    annualRecurringRevenue: string;
    averageRevenuePerUser: string;
    newSubscriptionsThisMonth: number;
    newSubscriptionsLastMonth: number;
    churnRate: string;
    growthRate: string;
    monthlySubscriptions: number;
    quarterlySubscriptions: number;
    annualSubscriptions: number;
    trialConversionRate: string;
    activeTrials: number;
  };
};

export type PlanListQueryVariables = Exact<{
  page?: InputMaybe<Scalars["Int"]["input"]>;
  pageSize?: InputMaybe<Scalars["Int"]["input"]>;
  isActive?: InputMaybe<Scalars["Boolean"]["input"]>;
  billingCycle?: InputMaybe<BillingCycleEnum>;
}>;

export type PlanListQueryResult = {
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
      description?: string | null | undefined;
      billingCycle: BillingCycleEnum;
      price: string;
      currency: string;
      setupFee?: string | null | undefined;
      trialDays?: number | null | undefined;
      isActive: boolean;
      createdAt: string;
      updatedAt: string;
      hasTrial: boolean;
      hasSetupFee: boolean;
      includedUsage: Record<string, any>;
      overageRates: Record<string, any>;
    }>;
  };
};

export type ProductListQueryVariables = Exact<{
  page?: InputMaybe<Scalars["Int"]["input"]>;
  pageSize?: InputMaybe<Scalars["Int"]["input"]>;
  isActive?: InputMaybe<Scalars["Boolean"]["input"]>;
  category?: InputMaybe<Scalars["String"]["input"]>;
}>;

export type ProductListQueryResult = {
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
      description?: string | null | undefined;
      category: string;
      productType: ProductTypeEnum;
      basePrice: string;
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

export type SubscriptionDashboardQueryResult = {
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
      customer?:
        | {
            __typename?: "SubscriptionCustomer";
            id: string;
            name?: string | null | undefined;
            email: string;
          }
        | null
        | undefined;
      plan?:
        | {
            __typename?: "SubscriptionPlan";
            id: string;
            name: string;
            price: string;
            currency: string;
            billingCycle: BillingCycleEnum;
          }
        | null
        | undefined;
    }>;
  };
  subscriptionMetrics: {
    __typename?: "SubscriptionMetrics";
    totalSubscriptions: number;
    activeSubscriptions: number;
    trialingSubscriptions: number;
    pastDueSubscriptions: number;
    monthlyRecurringRevenue: string;
    annualRecurringRevenue: string;
    averageRevenuePerUser: string;
    newSubscriptionsThisMonth: number;
    churnRate: string;
    growthRate: string;
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

export type UserListQueryResult = {
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
      fullName?: string | null | undefined;
      firstName?: string | null | undefined;
      lastName?: string | null | undefined;
      displayName: string;
      isActive: boolean;
      isVerified: boolean;
      isSuperuser: boolean;
      isPlatformAdmin: boolean;
      status: UserStatusEnum;
      phoneNumber?: string | null | undefined;
      phone?: string | null | undefined;
      phoneVerified: boolean;
      avatarUrl?: string | null | undefined;
      timezone?: string | null | undefined;
      location?: string | null | undefined;
      bio?: string | null | undefined;
      website?: string | null | undefined;
      mfaEnabled: boolean;
      lastLogin?: string | null | undefined;
      lastLoginIp?: string | null | undefined;
      failedLoginAttempts: number;
      lockedUntil?: string | null | undefined;
      language?: string | null | undefined;
      tenantId?: string | null | undefined;
      primaryRole: string;
      createdAt: string;
      updatedAt: string;
      metadata?: Record<string, any> | null | undefined;
      roles?: Array<{
        __typename?: "Role";
        id: string;
        name: string;
        displayName: string;
        description?: string | null | undefined;
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
        description?: string | null | undefined;
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
        joinedAt?: string | null | undefined;
      }>;
    }>;
  };
};

export type UserDetailQueryVariables = Exact<{
  id: Scalars["ID"]["input"];
}>;

export type UserDetailQueryResult = {
  __typename?: "Query";
  user?:
    | {
        __typename?: "User";
        id: string;
        username: string;
        email: string;
        fullName?: string | null | undefined;
        firstName?: string | null | undefined;
        lastName?: string | null | undefined;
        displayName: string;
        isActive: boolean;
        isVerified: boolean;
        isSuperuser: boolean;
        isPlatformAdmin: boolean;
        status: UserStatusEnum;
        phoneNumber?: string | null | undefined;
        phone?: string | null | undefined;
        phoneVerified: boolean;
        avatarUrl?: string | null | undefined;
        timezone?: string | null | undefined;
        location?: string | null | undefined;
        bio?: string | null | undefined;
        website?: string | null | undefined;
        mfaEnabled: boolean;
        lastLogin?: string | null | undefined;
        lastLoginIp?: string | null | undefined;
        failedLoginAttempts: number;
        lockedUntil?: string | null | undefined;
        language?: string | null | undefined;
        tenantId?: string | null | undefined;
        primaryRole: string;
        createdAt: string;
        updatedAt: string;
        metadata?: Record<string, any> | null | undefined;
        roles: Array<{
          __typename?: "Role";
          id: string;
          name: string;
          displayName: string;
          description?: string | null | undefined;
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
          description?: string | null | undefined;
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
          joinedAt?: string | null | undefined;
        }>;
        profileChanges: Array<{
          __typename?: "ProfileChangeRecord";
          id: string;
          fieldName: string;
          oldValue?: string | null | undefined;
          newValue?: string | null | undefined;
          createdAt: string;
          changedByUsername?: string | null | undefined;
        }>;
      }
    | null
    | undefined;
};

export type UserMetricsQueryVariables = Exact<{ [key: string]: never }>;

export type UserMetricsQueryResult = {
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

export type RoleListQueryResult = {
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
      description?: string | null | undefined;
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

export type PermissionsByCategoryQueryResult = {
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
      description?: string | null | undefined;
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

export type UserDashboardQueryResult = {
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
      fullName?: string | null | undefined;
      isActive: boolean;
      isVerified: boolean;
      isSuperuser: boolean;
      lastLogin?: string | null | undefined;
      createdAt: string;
      roles: Array<{ __typename?: "Role"; id: string; name: string; displayName: string }>;
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

export type UserRolesQueryResult = {
  __typename?: "Query";
  user?:
    | {
        __typename?: "User";
        id: string;
        username: string;
        roles: Array<{
          __typename?: "Role";
          id: string;
          name: string;
          displayName: string;
          description?: string | null | undefined;
          priority: number;
          isSystem: boolean;
          isActive: boolean;
          createdAt: string;
        }>;
      }
    | null
    | undefined;
};

export type UserPermissionsQueryVariables = Exact<{
  id: Scalars["ID"]["input"];
}>;

export type UserPermissionsQueryResult = {
  __typename?: "Query";
  user?:
    | {
        __typename?: "User";
        id: string;
        username: string;
        permissions: Array<{
          __typename?: "Permission";
          id: string;
          name: string;
          displayName: string;
          description?: string | null | undefined;
          category: PermissionCategoryEnum;
          isActive: boolean;
        }>;
      }
    | null
    | undefined;
};

export type UserTeamsQueryVariables = Exact<{
  id: Scalars["ID"]["input"];
}>;

export type UserTeamsQueryResult = {
  __typename?: "Query";
  user?:
    | {
        __typename?: "User";
        id: string;
        username: string;
        teams: Array<{
          __typename?: "TeamMembership";
          teamId: string;
          teamName: string;
          role: string;
          joinedAt?: string | null | undefined;
        }>;
      }
    | null
    | undefined;
};

export type AccessPointListQueryVariables = Exact<{
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  offset?: InputMaybe<Scalars["Int"]["input"]>;
  siteId?: InputMaybe<Scalars["String"]["input"]>;
  status?: InputMaybe<AccessPointStatus>;
  frequencyBand?: InputMaybe<FrequencyBand>;
  search?: InputMaybe<Scalars["String"]["input"]>;
}>;

export type AccessPointListQueryResult = {
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
      ipAddress?: string | null | undefined;
      serialNumber?: string | null | undefined;
      status: AccessPointStatus;
      isOnline: boolean;
      lastSeenAt?: string | null | undefined;
      model?: string | null | undefined;
      manufacturer?: string | null | undefined;
      firmwareVersion?: string | null | undefined;
      ssid: string;
      frequencyBand: FrequencyBand;
      channel: number;
      channelWidth: number;
      transmitPower: number;
      maxClients?: number | null | undefined;
      securityType: WirelessSecurityType;
      controllerName?: string | null | undefined;
      siteName?: string | null | undefined;
      createdAt: string;
      updatedAt: string;
      lastRebootAt?: string | null | undefined;
      location?:
        | {
            __typename?: "InstallationLocation";
            siteName: string;
            building?: string | null | undefined;
            floor?: string | null | undefined;
            room?: string | null | undefined;
            mountingType?: string | null | undefined;
            coordinates?:
              | {
                  __typename?: "GeoLocation";
                  latitude: number;
                  longitude: number;
                  altitude?: number | null | undefined;
                }
              | null
              | undefined;
          }
        | null
        | undefined;
      rfMetrics?:
        | {
            __typename?: "RFMetrics";
            signalStrengthDbm?: number | null | undefined;
            noiseFloorDbm?: number | null | undefined;
            signalToNoiseRatio?: number | null | undefined;
            channelUtilizationPercent?: number | null | undefined;
            interferenceLevel?: number | null | undefined;
            txPowerDbm?: number | null | undefined;
            rxPowerDbm?: number | null | undefined;
          }
        | null
        | undefined;
      performance?:
        | {
            __typename?: "APPerformanceMetrics";
            txBytes: number;
            rxBytes: number;
            txPackets: number;
            rxPackets: number;
            txRateMbps?: number | null | undefined;
            rxRateMbps?: number | null | undefined;
            txErrors: number;
            rxErrors: number;
            connectedClients: number;
            cpuUsagePercent?: number | null | undefined;
            memoryUsagePercent?: number | null | undefined;
            uptimeSeconds?: number | null | undefined;
          }
        | null
        | undefined;
    }>;
  };
};

export type AccessPointDetailQueryVariables = Exact<{
  id: Scalars["ID"]["input"];
}>;

export type AccessPointDetailQueryResult = {
  __typename?: "Query";
  accessPoint?:
    | {
        __typename?: "AccessPoint";
        id: string;
        name: string;
        macAddress: string;
        ipAddress?: string | null | undefined;
        serialNumber?: string | null | undefined;
        status: AccessPointStatus;
        isOnline: boolean;
        lastSeenAt?: string | null | undefined;
        model?: string | null | undefined;
        manufacturer?: string | null | undefined;
        firmwareVersion?: string | null | undefined;
        hardwareRevision?: string | null | undefined;
        ssid: string;
        frequencyBand: FrequencyBand;
        channel: number;
        channelWidth: number;
        transmitPower: number;
        maxClients?: number | null | undefined;
        securityType: WirelessSecurityType;
        controllerId?: string | null | undefined;
        controllerName?: string | null | undefined;
        siteId?: string | null | undefined;
        siteName?: string | null | undefined;
        createdAt: string;
        updatedAt: string;
        lastRebootAt?: string | null | undefined;
        isMeshEnabled: boolean;
        isBandSteeringEnabled: boolean;
        isLoadBalancingEnabled: boolean;
        location?:
          | {
              __typename?: "InstallationLocation";
              siteName: string;
              building?: string | null | undefined;
              floor?: string | null | undefined;
              room?: string | null | undefined;
              mountingType?: string | null | undefined;
              coordinates?:
                | {
                    __typename?: "GeoLocation";
                    latitude: number;
                    longitude: number;
                    altitude?: number | null | undefined;
                    accuracy?: number | null | undefined;
                  }
                | null
                | undefined;
            }
          | null
          | undefined;
        rfMetrics?:
          | {
              __typename?: "RFMetrics";
              signalStrengthDbm?: number | null | undefined;
              noiseFloorDbm?: number | null | undefined;
              signalToNoiseRatio?: number | null | undefined;
              channelUtilizationPercent?: number | null | undefined;
              interferenceLevel?: number | null | undefined;
              txPowerDbm?: number | null | undefined;
              rxPowerDbm?: number | null | undefined;
            }
          | null
          | undefined;
        performance?:
          | {
              __typename?: "APPerformanceMetrics";
              txBytes: number;
              rxBytes: number;
              txPackets: number;
              rxPackets: number;
              txRateMbps?: number | null | undefined;
              rxRateMbps?: number | null | undefined;
              txErrors: number;
              rxErrors: number;
              txDropped: number;
              rxDropped: number;
              retries: number;
              retryRatePercent?: number | null | undefined;
              connectedClients: number;
              authenticatedClients: number;
              authorizedClients: number;
              cpuUsagePercent?: number | null | undefined;
              memoryUsagePercent?: number | null | undefined;
              uptimeSeconds?: number | null | undefined;
            }
          | null
          | undefined;
      }
    | null
    | undefined;
};

export type AccessPointsBySiteQueryVariables = Exact<{
  siteId: Scalars["String"]["input"];
}>;

export type AccessPointsBySiteQueryResult = {
  __typename?: "Query";
  accessPointsBySite: Array<{
    __typename?: "AccessPoint";
    id: string;
    name: string;
    macAddress: string;
    ipAddress?: string | null | undefined;
    status: AccessPointStatus;
    isOnline: boolean;
    ssid: string;
    frequencyBand: FrequencyBand;
    channel: number;
    performance?:
      | {
          __typename?: "APPerformanceMetrics";
          connectedClients: number;
          cpuUsagePercent?: number | null | undefined;
          memoryUsagePercent?: number | null | undefined;
        }
      | null
      | undefined;
    rfMetrics?:
      | {
          __typename?: "RFMetrics";
          signalStrengthDbm?: number | null | undefined;
          channelUtilizationPercent?: number | null | undefined;
        }
      | null
      | undefined;
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

export type WirelessClientListQueryResult = {
  __typename?: "Query";
  wirelessClients: {
    __typename?: "WirelessClientConnection";
    totalCount: number;
    hasNextPage: boolean;
    clients: Array<{
      __typename?: "WirelessClient";
      id: string;
      macAddress: string;
      hostname?: string | null | undefined;
      ipAddress?: string | null | undefined;
      manufacturer?: string | null | undefined;
      accessPointId: string;
      accessPointName: string;
      ssid: string;
      connectionType: ClientConnectionType;
      frequencyBand: FrequencyBand;
      channel: number;
      isAuthenticated: boolean;
      isAuthorized: boolean;
      signalStrengthDbm?: number | null | undefined;
      noiseFloorDbm?: number | null | undefined;
      snr?: number | null | undefined;
      txRateMbps?: number | null | undefined;
      rxRateMbps?: number | null | undefined;
      txBytes: number;
      rxBytes: number;
      connectedAt: string;
      lastSeenAt: string;
      uptimeSeconds: number;
      customerId?: string | null | undefined;
      customerName?: string | null | undefined;
      signalQuality?:
        | {
            __typename?: "SignalQuality";
            rssiDbm?: number | null | undefined;
            snrDb?: number | null | undefined;
            noiseFloorDbm?: number | null | undefined;
            signalStrengthPercent?: number | null | undefined;
            linkQualityPercent?: number | null | undefined;
          }
        | null
        | undefined;
    }>;
  };
};

export type WirelessClientDetailQueryVariables = Exact<{
  id: Scalars["ID"]["input"];
}>;

export type WirelessClientDetailQueryResult = {
  __typename?: "Query";
  wirelessClient?:
    | {
        __typename?: "WirelessClient";
        id: string;
        macAddress: string;
        hostname?: string | null | undefined;
        ipAddress?: string | null | undefined;
        manufacturer?: string | null | undefined;
        accessPointId: string;
        accessPointName: string;
        ssid: string;
        connectionType: ClientConnectionType;
        frequencyBand: FrequencyBand;
        channel: number;
        isAuthenticated: boolean;
        isAuthorized: boolean;
        authMethod?: string | null | undefined;
        signalStrengthDbm?: number | null | undefined;
        noiseFloorDbm?: number | null | undefined;
        snr?: number | null | undefined;
        txRateMbps?: number | null | undefined;
        rxRateMbps?: number | null | undefined;
        txBytes: number;
        rxBytes: number;
        txPackets: number;
        rxPackets: number;
        txRetries: number;
        rxRetries: number;
        connectedAt: string;
        lastSeenAt: string;
        uptimeSeconds: number;
        idleTimeSeconds?: number | null | undefined;
        supports80211k: boolean;
        supports80211r: boolean;
        supports80211v: boolean;
        maxPhyRateMbps?: number | null | undefined;
        customerId?: string | null | undefined;
        customerName?: string | null | undefined;
        signalQuality?:
          | {
              __typename?: "SignalQuality";
              rssiDbm?: number | null | undefined;
              snrDb?: number | null | undefined;
              noiseFloorDbm?: number | null | undefined;
              signalStrengthPercent?: number | null | undefined;
              linkQualityPercent?: number | null | undefined;
            }
          | null
          | undefined;
      }
    | null
    | undefined;
};

export type WirelessClientsByAccessPointQueryVariables = Exact<{
  accessPointId: Scalars["String"]["input"];
}>;

export type WirelessClientsByAccessPointQueryResult = {
  __typename?: "Query";
  wirelessClientsByAccessPoint: Array<{
    __typename?: "WirelessClient";
    id: string;
    macAddress: string;
    hostname?: string | null | undefined;
    ipAddress?: string | null | undefined;
    ssid: string;
    signalStrengthDbm?: number | null | undefined;
    txRateMbps?: number | null | undefined;
    rxRateMbps?: number | null | undefined;
    connectedAt: string;
    customerId?: string | null | undefined;
    customerName?: string | null | undefined;
    signalQuality?:
      | {
          __typename?: "SignalQuality";
          rssiDbm?: number | null | undefined;
          snrDb?: number | null | undefined;
          noiseFloorDbm?: number | null | undefined;
          signalStrengthPercent?: number | null | undefined;
          linkQualityPercent?: number | null | undefined;
        }
      | null
      | undefined;
  }>;
};

export type WirelessClientsByCustomerQueryVariables = Exact<{
  customerId: Scalars["String"]["input"];
}>;

export type WirelessClientsByCustomerQueryResult = {
  __typename?: "Query";
  wirelessClientsByCustomer: Array<{
    __typename?: "WirelessClient";
    id: string;
    macAddress: string;
    hostname?: string | null | undefined;
    ipAddress?: string | null | undefined;
    accessPointName: string;
    ssid: string;
    frequencyBand: FrequencyBand;
    signalStrengthDbm?: number | null | undefined;
    isAuthenticated: boolean;
    connectedAt: string;
    lastSeenAt: string;
    signalQuality?:
      | {
          __typename?: "SignalQuality";
          rssiDbm?: number | null | undefined;
          snrDb?: number | null | undefined;
          noiseFloorDbm?: number | null | undefined;
          signalStrengthPercent?: number | null | undefined;
          linkQualityPercent?: number | null | undefined;
        }
      | null
      | undefined;
  }>;
};

export type CoverageZoneListQueryVariables = Exact<{
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  offset?: InputMaybe<Scalars["Int"]["input"]>;
  siteId?: InputMaybe<Scalars["String"]["input"]>;
  areaType?: InputMaybe<Scalars["String"]["input"]>;
}>;

export type CoverageZoneListQueryResult = {
  __typename?: "Query";
  coverageZones: {
    __typename?: "CoverageZoneConnection";
    totalCount: number;
    hasNextPage: boolean;
    zones: Array<{
      __typename?: "CoverageZone";
      id: string;
      name: string;
      description?: string | null | undefined;
      siteId: string;
      siteName: string;
      floor?: string | null | undefined;
      areaType: string;
      coverageAreaSqm?: number | null | undefined;
      signalStrengthMinDbm?: number | null | undefined;
      signalStrengthMaxDbm?: number | null | undefined;
      signalStrengthAvgDbm?: number | null | undefined;
      accessPointIds: Array<string>;
      accessPointCount: number;
      interferenceLevel?: number | null | undefined;
      channelUtilizationAvg?: number | null | undefined;
      noiseFloorAvgDbm?: number | null | undefined;
      connectedClients: number;
      maxClientCapacity: number;
      clientDensityPerAp?: number | null | undefined;
      coveragePolygon?: string | null | undefined;
      createdAt: string;
      updatedAt: string;
      lastSurveyedAt?: string | null | undefined;
    }>;
  };
};

export type CoverageZoneDetailQueryVariables = Exact<{
  id: Scalars["ID"]["input"];
}>;

export type CoverageZoneDetailQueryResult = {
  __typename?: "Query";
  coverageZone?:
    | {
        __typename?: "CoverageZone";
        id: string;
        name: string;
        description?: string | null | undefined;
        siteId: string;
        siteName: string;
        floor?: string | null | undefined;
        areaType: string;
        coverageAreaSqm?: number | null | undefined;
        signalStrengthMinDbm?: number | null | undefined;
        signalStrengthMaxDbm?: number | null | undefined;
        signalStrengthAvgDbm?: number | null | undefined;
        accessPointIds: Array<string>;
        accessPointCount: number;
        interferenceLevel?: number | null | undefined;
        channelUtilizationAvg?: number | null | undefined;
        noiseFloorAvgDbm?: number | null | undefined;
        connectedClients: number;
        maxClientCapacity: number;
        clientDensityPerAp?: number | null | undefined;
        coveragePolygon?: string | null | undefined;
        createdAt: string;
        updatedAt: string;
        lastSurveyedAt?: string | null | undefined;
      }
    | null
    | undefined;
};

export type CoverageZonesBySiteQueryVariables = Exact<{
  siteId: Scalars["String"]["input"];
}>;

export type CoverageZonesBySiteQueryResult = {
  __typename?: "Query";
  coverageZonesBySite: Array<{
    __typename?: "CoverageZone";
    id: string;
    name: string;
    floor?: string | null | undefined;
    areaType: string;
    coverageAreaSqm?: number | null | undefined;
    accessPointCount: number;
    connectedClients: number;
    maxClientCapacity: number;
    signalStrengthAvgDbm?: number | null | undefined;
  }>;
};

export type RfAnalyticsQueryVariables = Exact<{
  siteId: Scalars["String"]["input"];
}>;

export type RfAnalyticsQueryResult = {
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

export type ChannelUtilizationQueryResult = {
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

export type WirelessSiteMetricsQueryResult = {
  __typename?: "Query";
  wirelessSiteMetrics?:
    | {
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
        averageSignalStrengthDbm?: number | null | undefined;
        averageSnr?: number | null | undefined;
        totalThroughputMbps?: number | null | undefined;
        totalCapacity: number;
        capacityUtilizationPercent?: number | null | undefined;
        overallHealthScore: number;
        rfHealthScore: number;
        clientExperienceScore: number;
      }
    | null
    | undefined;
};

export type WirelessDashboardQueryVariables = Exact<{ [key: string]: never }>;

export type WirelessDashboardQueryResult = {
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
      siteName?: string | null | undefined;
      performance?:
        | { __typename?: "APPerformanceMetrics"; connectedClients: number }
        | null
        | undefined;
    }>;
    topApsByThroughput: Array<{
      __typename?: "AccessPoint";
      id: string;
      name: string;
      siteName?: string | null | undefined;
      performance?:
        | {
            __typename?: "APPerformanceMetrics";
            txRateMbps?: number | null | undefined;
            rxRateMbps?: number | null | undefined;
          }
        | null
        | undefined;
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

export const CustomerListDocument = `
    query CustomerList($limit: Int = 50, $offset: Int = 0, $status: CustomerStatusEnum, $search: String, $includeActivities: Boolean = false, $includeNotes: Boolean = false) {
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

export const useCustomerListQuery = <TData = CustomerListQueryResult, TError = unknown>(
  variables?: CustomerListQueryVariables,
  options?: Omit<UseQueryOptions<CustomerListQueryResult, TError, TData>, "queryKey"> & {
    queryKey?: UseQueryOptions<CustomerListQueryResult, TError, TData>["queryKey"];
  },
) => {
  return useQuery<CustomerListQueryResult, TError, TData>({
    queryKey: variables === undefined ? ["CustomerList"] : ["CustomerList", variables],
    queryFn: graphqlFetcher<CustomerListQueryResult, CustomerListQueryVariables>(
      CustomerListDocument,
      variables,
    ),
    ...options,
  });
};

useCustomerListQuery.getKey = (variables?: CustomerListQueryVariables) =>
  variables === undefined ? ["CustomerList"] : ["CustomerList", variables];

export const useInfiniteCustomerListQuery = <
  TData = InfiniteData<CustomerListQueryResult>,
  TError = unknown,
>(
  variables: CustomerListQueryVariables,
  options: Omit<UseInfiniteQueryOptions<CustomerListQueryResult, TError, TData>, "queryKey"> & {
    queryKey?: UseInfiniteQueryOptions<CustomerListQueryResult, TError, TData>["queryKey"];
  },
) => {
  return useInfiniteQuery<CustomerListQueryResult, TError, TData>(
    (() => {
      const { queryKey: optionsQueryKey, ...restOptions } = options;
      return {
        queryKey:
          (optionsQueryKey ?? variables === undefined)
            ? ["CustomerList.infinite"]
            : ["CustomerList.infinite", variables],
        queryFn: (metaData) =>
          graphqlFetcher<CustomerListQueryResult, CustomerListQueryVariables>(
            CustomerListDocument,
            { ...variables, ...(metaData.pageParam ?? {}) },
          )(),
        ...restOptions,
      };
    })(),
  );
};

useInfiniteCustomerListQuery.getKey = (variables?: CustomerListQueryVariables) =>
  variables === undefined ? ["CustomerList.infinite"] : ["CustomerList.infinite", variables];

useCustomerListQuery.fetcher = (
  variables?: CustomerListQueryVariables,
  options?: RequestInit["headers"],
) =>
  graphqlFetcher<CustomerListQueryResult, CustomerListQueryVariables>(
    CustomerListDocument,
    variables,
    options,
  );

export const CustomerDetailDocument = `
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

export const useCustomerDetailQuery = <TData = CustomerDetailQueryResult, TError = unknown>(
  variables: CustomerDetailQueryVariables,
  options?: Omit<UseQueryOptions<CustomerDetailQueryResult, TError, TData>, "queryKey"> & {
    queryKey?: UseQueryOptions<CustomerDetailQueryResult, TError, TData>["queryKey"];
  },
) => {
  return useQuery<CustomerDetailQueryResult, TError, TData>({
    queryKey: ["CustomerDetail", variables],
    queryFn: graphqlFetcher<CustomerDetailQueryResult, CustomerDetailQueryVariables>(
      CustomerDetailDocument,
      variables,
    ),
    ...options,
  });
};

useCustomerDetailQuery.getKey = (variables: CustomerDetailQueryVariables) => [
  "CustomerDetail",
  variables,
];

export const useInfiniteCustomerDetailQuery = <
  TData = InfiniteData<CustomerDetailQueryResult>,
  TError = unknown,
>(
  variables: CustomerDetailQueryVariables,
  options: Omit<UseInfiniteQueryOptions<CustomerDetailQueryResult, TError, TData>, "queryKey"> & {
    queryKey?: UseInfiniteQueryOptions<CustomerDetailQueryResult, TError, TData>["queryKey"];
  },
) => {
  return useInfiniteQuery<CustomerDetailQueryResult, TError, TData>(
    (() => {
      const { queryKey: optionsQueryKey, ...restOptions } = options;
      return {
        queryKey: optionsQueryKey ?? ["CustomerDetail.infinite", variables],
        queryFn: (metaData) =>
          graphqlFetcher<CustomerDetailQueryResult, CustomerDetailQueryVariables>(
            CustomerDetailDocument,
            { ...variables, ...(metaData.pageParam ?? {}) },
          )(),
        ...restOptions,
      };
    })(),
  );
};

useInfiniteCustomerDetailQuery.getKey = (variables: CustomerDetailQueryVariables) => [
  "CustomerDetail.infinite",
  variables,
];

useCustomerDetailQuery.fetcher = (
  variables: CustomerDetailQueryVariables,
  options?: RequestInit["headers"],
) =>
  graphqlFetcher<CustomerDetailQueryResult, CustomerDetailQueryVariables>(
    CustomerDetailDocument,
    variables,
    options,
  );

export const CustomerMetricsDocument = `
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

export const useCustomerMetricsQuery = <TData = CustomerMetricsQueryResult, TError = unknown>(
  variables?: CustomerMetricsQueryVariables,
  options?: Omit<UseQueryOptions<CustomerMetricsQueryResult, TError, TData>, "queryKey"> & {
    queryKey?: UseQueryOptions<CustomerMetricsQueryResult, TError, TData>["queryKey"];
  },
) => {
  return useQuery<CustomerMetricsQueryResult, TError, TData>({
    queryKey: variables === undefined ? ["CustomerMetrics"] : ["CustomerMetrics", variables],
    queryFn: graphqlFetcher<CustomerMetricsQueryResult, CustomerMetricsQueryVariables>(
      CustomerMetricsDocument,
      variables,
    ),
    ...options,
  });
};

useCustomerMetricsQuery.getKey = (variables?: CustomerMetricsQueryVariables) =>
  variables === undefined ? ["CustomerMetrics"] : ["CustomerMetrics", variables];

export const useInfiniteCustomerMetricsQuery = <
  TData = InfiniteData<CustomerMetricsQueryResult>,
  TError = unknown,
>(
  variables: CustomerMetricsQueryVariables,
  options: Omit<UseInfiniteQueryOptions<CustomerMetricsQueryResult, TError, TData>, "queryKey"> & {
    queryKey?: UseInfiniteQueryOptions<CustomerMetricsQueryResult, TError, TData>["queryKey"];
  },
) => {
  return useInfiniteQuery<CustomerMetricsQueryResult, TError, TData>(
    (() => {
      const { queryKey: optionsQueryKey, ...restOptions } = options;
      return {
        queryKey:
          (optionsQueryKey ?? variables === undefined)
            ? ["CustomerMetrics.infinite"]
            : ["CustomerMetrics.infinite", variables],
        queryFn: (metaData) =>
          graphqlFetcher<CustomerMetricsQueryResult, CustomerMetricsQueryVariables>(
            CustomerMetricsDocument,
            { ...variables, ...(metaData.pageParam ?? {}) },
          )(),
        ...restOptions,
      };
    })(),
  );
};

useInfiniteCustomerMetricsQuery.getKey = (variables?: CustomerMetricsQueryVariables) =>
  variables === undefined ? ["CustomerMetrics.infinite"] : ["CustomerMetrics.infinite", variables];

useCustomerMetricsQuery.fetcher = (
  variables?: CustomerMetricsQueryVariables,
  options?: RequestInit["headers"],
) =>
  graphqlFetcher<CustomerMetricsQueryResult, CustomerMetricsQueryVariables>(
    CustomerMetricsDocument,
    variables,
    options,
  );

export const CustomerActivitiesDocument = `
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

export const useCustomerActivitiesQuery = <TData = CustomerActivitiesQueryResult, TError = unknown>(
  variables: CustomerActivitiesQueryVariables,
  options?: Omit<UseQueryOptions<CustomerActivitiesQueryResult, TError, TData>, "queryKey"> & {
    queryKey?: UseQueryOptions<CustomerActivitiesQueryResult, TError, TData>["queryKey"];
  },
) => {
  return useQuery<CustomerActivitiesQueryResult, TError, TData>({
    queryKey: ["CustomerActivities", variables],
    queryFn: graphqlFetcher<CustomerActivitiesQueryResult, CustomerActivitiesQueryVariables>(
      CustomerActivitiesDocument,
      variables,
    ),
    ...options,
  });
};

useCustomerActivitiesQuery.getKey = (variables: CustomerActivitiesQueryVariables) => [
  "CustomerActivities",
  variables,
];

export const useInfiniteCustomerActivitiesQuery = <
  TData = InfiniteData<CustomerActivitiesQueryResult>,
  TError = unknown,
>(
  variables: CustomerActivitiesQueryVariables,
  options: Omit<
    UseInfiniteQueryOptions<CustomerActivitiesQueryResult, TError, TData>,
    "queryKey"
  > & {
    queryKey?: UseInfiniteQueryOptions<CustomerActivitiesQueryResult, TError, TData>["queryKey"];
  },
) => {
  return useInfiniteQuery<CustomerActivitiesQueryResult, TError, TData>(
    (() => {
      const { queryKey: optionsQueryKey, ...restOptions } = options;
      return {
        queryKey: optionsQueryKey ?? ["CustomerActivities.infinite", variables],
        queryFn: (metaData) =>
          graphqlFetcher<CustomerActivitiesQueryResult, CustomerActivitiesQueryVariables>(
            CustomerActivitiesDocument,
            { ...variables, ...(metaData.pageParam ?? {}) },
          )(),
        ...restOptions,
      };
    })(),
  );
};

useInfiniteCustomerActivitiesQuery.getKey = (variables: CustomerActivitiesQueryVariables) => [
  "CustomerActivities.infinite",
  variables,
];

useCustomerActivitiesQuery.fetcher = (
  variables: CustomerActivitiesQueryVariables,
  options?: RequestInit["headers"],
) =>
  graphqlFetcher<CustomerActivitiesQueryResult, CustomerActivitiesQueryVariables>(
    CustomerActivitiesDocument,
    variables,
    options,
  );

export const CustomerNotesDocument = `
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

export const useCustomerNotesQuery = <TData = CustomerNotesQueryResult, TError = unknown>(
  variables: CustomerNotesQueryVariables,
  options?: Omit<UseQueryOptions<CustomerNotesQueryResult, TError, TData>, "queryKey"> & {
    queryKey?: UseQueryOptions<CustomerNotesQueryResult, TError, TData>["queryKey"];
  },
) => {
  return useQuery<CustomerNotesQueryResult, TError, TData>({
    queryKey: ["CustomerNotes", variables],
    queryFn: graphqlFetcher<CustomerNotesQueryResult, CustomerNotesQueryVariables>(
      CustomerNotesDocument,
      variables,
    ),
    ...options,
  });
};

useCustomerNotesQuery.getKey = (variables: CustomerNotesQueryVariables) => [
  "CustomerNotes",
  variables,
];

export const useInfiniteCustomerNotesQuery = <
  TData = InfiniteData<CustomerNotesQueryResult>,
  TError = unknown,
>(
  variables: CustomerNotesQueryVariables,
  options: Omit<UseInfiniteQueryOptions<CustomerNotesQueryResult, TError, TData>, "queryKey"> & {
    queryKey?: UseInfiniteQueryOptions<CustomerNotesQueryResult, TError, TData>["queryKey"];
  },
) => {
  return useInfiniteQuery<CustomerNotesQueryResult, TError, TData>(
    (() => {
      const { queryKey: optionsQueryKey, ...restOptions } = options;
      return {
        queryKey: optionsQueryKey ?? ["CustomerNotes.infinite", variables],
        queryFn: (metaData) =>
          graphqlFetcher<CustomerNotesQueryResult, CustomerNotesQueryVariables>(
            CustomerNotesDocument,
            { ...variables, ...(metaData.pageParam ?? {}) },
          )(),
        ...restOptions,
      };
    })(),
  );
};

useInfiniteCustomerNotesQuery.getKey = (variables: CustomerNotesQueryVariables) => [
  "CustomerNotes.infinite",
  variables,
];

useCustomerNotesQuery.fetcher = (
  variables: CustomerNotesQueryVariables,
  options?: RequestInit["headers"],
) =>
  graphqlFetcher<CustomerNotesQueryResult, CustomerNotesQueryVariables>(
    CustomerNotesDocument,
    variables,
    options,
  );

export const CustomerDashboardDocument = `
    query CustomerDashboard($limit: Int = 20, $offset: Int = 0, $status: CustomerStatusEnum, $search: String) {
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

export const useCustomerDashboardQuery = <TData = CustomerDashboardQueryResult, TError = unknown>(
  variables?: CustomerDashboardQueryVariables,
  options?: Omit<UseQueryOptions<CustomerDashboardQueryResult, TError, TData>, "queryKey"> & {
    queryKey?: UseQueryOptions<CustomerDashboardQueryResult, TError, TData>["queryKey"];
  },
) => {
  return useQuery<CustomerDashboardQueryResult, TError, TData>({
    queryKey: variables === undefined ? ["CustomerDashboard"] : ["CustomerDashboard", variables],
    queryFn: graphqlFetcher<CustomerDashboardQueryResult, CustomerDashboardQueryVariables>(
      CustomerDashboardDocument,
      variables,
    ),
    ...options,
  });
};

useCustomerDashboardQuery.getKey = (variables?: CustomerDashboardQueryVariables) =>
  variables === undefined ? ["CustomerDashboard"] : ["CustomerDashboard", variables];

export const useInfiniteCustomerDashboardQuery = <
  TData = InfiniteData<CustomerDashboardQueryResult>,
  TError = unknown,
>(
  variables: CustomerDashboardQueryVariables,
  options: Omit<
    UseInfiniteQueryOptions<CustomerDashboardQueryResult, TError, TData>,
    "queryKey"
  > & {
    queryKey?: UseInfiniteQueryOptions<CustomerDashboardQueryResult, TError, TData>["queryKey"];
  },
) => {
  return useInfiniteQuery<CustomerDashboardQueryResult, TError, TData>(
    (() => {
      const { queryKey: optionsQueryKey, ...restOptions } = options;
      return {
        queryKey:
          (optionsQueryKey ?? variables === undefined)
            ? ["CustomerDashboard.infinite"]
            : ["CustomerDashboard.infinite", variables],
        queryFn: (metaData) =>
          graphqlFetcher<CustomerDashboardQueryResult, CustomerDashboardQueryVariables>(
            CustomerDashboardDocument,
            { ...variables, ...(metaData.pageParam ?? {}) },
          )(),
        ...restOptions,
      };
    })(),
  );
};

useInfiniteCustomerDashboardQuery.getKey = (variables?: CustomerDashboardQueryVariables) =>
  variables === undefined
    ? ["CustomerDashboard.infinite"]
    : ["CustomerDashboard.infinite", variables];

useCustomerDashboardQuery.fetcher = (
  variables?: CustomerDashboardQueryVariables,
  options?: RequestInit["headers"],
) =>
  graphqlFetcher<CustomerDashboardQueryResult, CustomerDashboardQueryVariables>(
    CustomerDashboardDocument,
    variables,
    options,
  );

export const CustomerSubscriptionsDocument = `
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

export const useCustomerSubscriptionsQuery = <
  TData = CustomerSubscriptionsQueryResult,
  TError = unknown,
>(
  variables: CustomerSubscriptionsQueryVariables,
  options?: Omit<UseQueryOptions<CustomerSubscriptionsQueryResult, TError, TData>, "queryKey"> & {
    queryKey?: UseQueryOptions<CustomerSubscriptionsQueryResult, TError, TData>["queryKey"];
  },
) => {
  return useQuery<CustomerSubscriptionsQueryResult, TError, TData>({
    queryKey: ["CustomerSubscriptions", variables],
    queryFn: graphqlFetcher<CustomerSubscriptionsQueryResult, CustomerSubscriptionsQueryVariables>(
      CustomerSubscriptionsDocument,
      variables,
    ),
    ...options,
  });
};

useCustomerSubscriptionsQuery.getKey = (variables: CustomerSubscriptionsQueryVariables) => [
  "CustomerSubscriptions",
  variables,
];

export const useInfiniteCustomerSubscriptionsQuery = <
  TData = InfiniteData<CustomerSubscriptionsQueryResult>,
  TError = unknown,
>(
  variables: CustomerSubscriptionsQueryVariables,
  options: Omit<
    UseInfiniteQueryOptions<CustomerSubscriptionsQueryResult, TError, TData>,
    "queryKey"
  > & {
    queryKey?: UseInfiniteQueryOptions<CustomerSubscriptionsQueryResult, TError, TData>["queryKey"];
  },
) => {
  return useInfiniteQuery<CustomerSubscriptionsQueryResult, TError, TData>(
    (() => {
      const { queryKey: optionsQueryKey, ...restOptions } = options;
      return {
        queryKey: optionsQueryKey ?? ["CustomerSubscriptions.infinite", variables],
        queryFn: (metaData) =>
          graphqlFetcher<CustomerSubscriptionsQueryResult, CustomerSubscriptionsQueryVariables>(
            CustomerSubscriptionsDocument,
            { ...variables, ...(metaData.pageParam ?? {}) },
          )(),
        ...restOptions,
      };
    })(),
  );
};

useInfiniteCustomerSubscriptionsQuery.getKey = (variables: CustomerSubscriptionsQueryVariables) => [
  "CustomerSubscriptions.infinite",
  variables,
];

useCustomerSubscriptionsQuery.fetcher = (
  variables: CustomerSubscriptionsQueryVariables,
  options?: RequestInit["headers"],
) =>
  graphqlFetcher<CustomerSubscriptionsQueryResult, CustomerSubscriptionsQueryVariables>(
    CustomerSubscriptionsDocument,
    variables,
    options,
  );

export const CustomerNetworkInfoDocument = `
    query CustomerNetworkInfo($customerId: ID!) {
  customerNetworkInfo(customerId: $customerId)
}
    `;

export const useCustomerNetworkInfoQuery = <
  TData = CustomerNetworkInfoQueryResult,
  TError = unknown,
>(
  variables: CustomerNetworkInfoQueryVariables,
  options?: Omit<UseQueryOptions<CustomerNetworkInfoQueryResult, TError, TData>, "queryKey"> & {
    queryKey?: UseQueryOptions<CustomerNetworkInfoQueryResult, TError, TData>["queryKey"];
  },
) => {
  return useQuery<CustomerNetworkInfoQueryResult, TError, TData>({
    queryKey: ["CustomerNetworkInfo", variables],
    queryFn: graphqlFetcher<CustomerNetworkInfoQueryResult, CustomerNetworkInfoQueryVariables>(
      CustomerNetworkInfoDocument,
      variables,
    ),
    ...options,
  });
};

useCustomerNetworkInfoQuery.getKey = (variables: CustomerNetworkInfoQueryVariables) => [
  "CustomerNetworkInfo",
  variables,
];

export const useInfiniteCustomerNetworkInfoQuery = <
  TData = InfiniteData<CustomerNetworkInfoQueryResult>,
  TError = unknown,
>(
  variables: CustomerNetworkInfoQueryVariables,
  options: Omit<
    UseInfiniteQueryOptions<CustomerNetworkInfoQueryResult, TError, TData>,
    "queryKey"
  > & {
    queryKey?: UseInfiniteQueryOptions<CustomerNetworkInfoQueryResult, TError, TData>["queryKey"];
  },
) => {
  return useInfiniteQuery<CustomerNetworkInfoQueryResult, TError, TData>(
    (() => {
      const { queryKey: optionsQueryKey, ...restOptions } = options;
      return {
        queryKey: optionsQueryKey ?? ["CustomerNetworkInfo.infinite", variables],
        queryFn: (metaData) =>
          graphqlFetcher<CustomerNetworkInfoQueryResult, CustomerNetworkInfoQueryVariables>(
            CustomerNetworkInfoDocument,
            { ...variables, ...(metaData.pageParam ?? {}) },
          )(),
        ...restOptions,
      };
    })(),
  );
};

useInfiniteCustomerNetworkInfoQuery.getKey = (variables: CustomerNetworkInfoQueryVariables) => [
  "CustomerNetworkInfo.infinite",
  variables,
];

useCustomerNetworkInfoQuery.fetcher = (
  variables: CustomerNetworkInfoQueryVariables,
  options?: RequestInit["headers"],
) =>
  graphqlFetcher<CustomerNetworkInfoQueryResult, CustomerNetworkInfoQueryVariables>(
    CustomerNetworkInfoDocument,
    variables,
    options,
  );

export const CustomerDevicesDocument = `
    query CustomerDevices($customerId: ID!, $deviceType: String, $activeOnly: Boolean = true) {
  customerDevices(
    customerId: $customerId
    deviceType: $deviceType
    activeOnly: $activeOnly
  )
}
    `;

export const useCustomerDevicesQuery = <TData = CustomerDevicesQueryResult, TError = unknown>(
  variables: CustomerDevicesQueryVariables,
  options?: Omit<UseQueryOptions<CustomerDevicesQueryResult, TError, TData>, "queryKey"> & {
    queryKey?: UseQueryOptions<CustomerDevicesQueryResult, TError, TData>["queryKey"];
  },
) => {
  return useQuery<CustomerDevicesQueryResult, TError, TData>({
    queryKey: ["CustomerDevices", variables],
    queryFn: graphqlFetcher<CustomerDevicesQueryResult, CustomerDevicesQueryVariables>(
      CustomerDevicesDocument,
      variables,
    ),
    ...options,
  });
};

useCustomerDevicesQuery.getKey = (variables: CustomerDevicesQueryVariables) => [
  "CustomerDevices",
  variables,
];

export const useInfiniteCustomerDevicesQuery = <
  TData = InfiniteData<CustomerDevicesQueryResult>,
  TError = unknown,
>(
  variables: CustomerDevicesQueryVariables,
  options: Omit<UseInfiniteQueryOptions<CustomerDevicesQueryResult, TError, TData>, "queryKey"> & {
    queryKey?: UseInfiniteQueryOptions<CustomerDevicesQueryResult, TError, TData>["queryKey"];
  },
) => {
  return useInfiniteQuery<CustomerDevicesQueryResult, TError, TData>(
    (() => {
      const { queryKey: optionsQueryKey, ...restOptions } = options;
      return {
        queryKey: optionsQueryKey ?? ["CustomerDevices.infinite", variables],
        queryFn: (metaData) =>
          graphqlFetcher<CustomerDevicesQueryResult, CustomerDevicesQueryVariables>(
            CustomerDevicesDocument,
            { ...variables, ...(metaData.pageParam ?? {}) },
          )(),
        ...restOptions,
      };
    })(),
  );
};

useInfiniteCustomerDevicesQuery.getKey = (variables: CustomerDevicesQueryVariables) => [
  "CustomerDevices.infinite",
  variables,
];

useCustomerDevicesQuery.fetcher = (
  variables: CustomerDevicesQueryVariables,
  options?: RequestInit["headers"],
) =>
  graphqlFetcher<CustomerDevicesQueryResult, CustomerDevicesQueryVariables>(
    CustomerDevicesDocument,
    variables,
    options,
  );

export const CustomerTicketsDocument = `
    query CustomerTickets($customerId: ID!, $limit: Int = 50, $status: String) {
  customerTickets(customerId: $customerId, limit: $limit, status: $status)
}
    `;

export const useCustomerTicketsQuery = <TData = CustomerTicketsQueryResult, TError = unknown>(
  variables: CustomerTicketsQueryVariables,
  options?: Omit<UseQueryOptions<CustomerTicketsQueryResult, TError, TData>, "queryKey"> & {
    queryKey?: UseQueryOptions<CustomerTicketsQueryResult, TError, TData>["queryKey"];
  },
) => {
  return useQuery<CustomerTicketsQueryResult, TError, TData>({
    queryKey: ["CustomerTickets", variables],
    queryFn: graphqlFetcher<CustomerTicketsQueryResult, CustomerTicketsQueryVariables>(
      CustomerTicketsDocument,
      variables,
    ),
    ...options,
  });
};

useCustomerTicketsQuery.getKey = (variables: CustomerTicketsQueryVariables) => [
  "CustomerTickets",
  variables,
];

export const useInfiniteCustomerTicketsQuery = <
  TData = InfiniteData<CustomerTicketsQueryResult>,
  TError = unknown,
>(
  variables: CustomerTicketsQueryVariables,
  options: Omit<UseInfiniteQueryOptions<CustomerTicketsQueryResult, TError, TData>, "queryKey"> & {
    queryKey?: UseInfiniteQueryOptions<CustomerTicketsQueryResult, TError, TData>["queryKey"];
  },
) => {
  return useInfiniteQuery<CustomerTicketsQueryResult, TError, TData>(
    (() => {
      const { queryKey: optionsQueryKey, ...restOptions } = options;
      return {
        queryKey: optionsQueryKey ?? ["CustomerTickets.infinite", variables],
        queryFn: (metaData) =>
          graphqlFetcher<CustomerTicketsQueryResult, CustomerTicketsQueryVariables>(
            CustomerTicketsDocument,
            { ...variables, ...(metaData.pageParam ?? {}) },
          )(),
        ...restOptions,
      };
    })(),
  );
};

useInfiniteCustomerTicketsQuery.getKey = (variables: CustomerTicketsQueryVariables) => [
  "CustomerTickets.infinite",
  variables,
];

useCustomerTicketsQuery.fetcher = (
  variables: CustomerTicketsQueryVariables,
  options?: RequestInit["headers"],
) =>
  graphqlFetcher<CustomerTicketsQueryResult, CustomerTicketsQueryVariables>(
    CustomerTicketsDocument,
    variables,
    options,
  );

export const CustomerBillingDocument = `
    query CustomerBilling($customerId: ID!, $includeInvoices: Boolean = true, $invoiceLimit: Int = 50) {
  customerBilling(
    customerId: $customerId
    includeInvoices: $includeInvoices
    invoiceLimit: $invoiceLimit
  )
}
    `;

export const useCustomerBillingQuery = <TData = CustomerBillingQueryResult, TError = unknown>(
  variables: CustomerBillingQueryVariables,
  options?: Omit<UseQueryOptions<CustomerBillingQueryResult, TError, TData>, "queryKey"> & {
    queryKey?: UseQueryOptions<CustomerBillingQueryResult, TError, TData>["queryKey"];
  },
) => {
  return useQuery<CustomerBillingQueryResult, TError, TData>({
    queryKey: ["CustomerBilling", variables],
    queryFn: graphqlFetcher<CustomerBillingQueryResult, CustomerBillingQueryVariables>(
      CustomerBillingDocument,
      variables,
    ),
    ...options,
  });
};

useCustomerBillingQuery.getKey = (variables: CustomerBillingQueryVariables) => [
  "CustomerBilling",
  variables,
];

export const useInfiniteCustomerBillingQuery = <
  TData = InfiniteData<CustomerBillingQueryResult>,
  TError = unknown,
>(
  variables: CustomerBillingQueryVariables,
  options: Omit<UseInfiniteQueryOptions<CustomerBillingQueryResult, TError, TData>, "queryKey"> & {
    queryKey?: UseInfiniteQueryOptions<CustomerBillingQueryResult, TError, TData>["queryKey"];
  },
) => {
  return useInfiniteQuery<CustomerBillingQueryResult, TError, TData>(
    (() => {
      const { queryKey: optionsQueryKey, ...restOptions } = options;
      return {
        queryKey: optionsQueryKey ?? ["CustomerBilling.infinite", variables],
        queryFn: (metaData) =>
          graphqlFetcher<CustomerBillingQueryResult, CustomerBillingQueryVariables>(
            CustomerBillingDocument,
            { ...variables, ...(metaData.pageParam ?? {}) },
          )(),
        ...restOptions,
      };
    })(),
  );
};

useInfiniteCustomerBillingQuery.getKey = (variables: CustomerBillingQueryVariables) => [
  "CustomerBilling.infinite",
  variables,
];

useCustomerBillingQuery.fetcher = (
  variables: CustomerBillingQueryVariables,
  options?: RequestInit["headers"],
) =>
  graphqlFetcher<CustomerBillingQueryResult, CustomerBillingQueryVariables>(
    CustomerBillingDocument,
    variables,
    options,
  );

export const Customer360ViewDocument = `
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
  customerBilling(
    customerId: $customerId
    includeInvoices: true
    invoiceLimit: 10
  )
}
    `;

export const useCustomer360ViewQuery = <TData = Customer360ViewQueryResult, TError = unknown>(
  variables: Customer360ViewQueryVariables,
  options?: Omit<UseQueryOptions<Customer360ViewQueryResult, TError, TData>, "queryKey"> & {
    queryKey?: UseQueryOptions<Customer360ViewQueryResult, TError, TData>["queryKey"];
  },
) => {
  return useQuery<Customer360ViewQueryResult, TError, TData>({
    queryKey: ["Customer360View", variables],
    queryFn: graphqlFetcher<Customer360ViewQueryResult, Customer360ViewQueryVariables>(
      Customer360ViewDocument,
      variables,
    ),
    ...options,
  });
};

useCustomer360ViewQuery.getKey = (variables: Customer360ViewQueryVariables) => [
  "Customer360View",
  variables,
];

export const useInfiniteCustomer360ViewQuery = <
  TData = InfiniteData<Customer360ViewQueryResult>,
  TError = unknown,
>(
  variables: Customer360ViewQueryVariables,
  options: Omit<UseInfiniteQueryOptions<Customer360ViewQueryResult, TError, TData>, "queryKey"> & {
    queryKey?: UseInfiniteQueryOptions<Customer360ViewQueryResult, TError, TData>["queryKey"];
  },
) => {
  return useInfiniteQuery<Customer360ViewQueryResult, TError, TData>(
    (() => {
      const { queryKey: optionsQueryKey, ...restOptions } = options;
      return {
        queryKey: optionsQueryKey ?? ["Customer360View.infinite", variables],
        queryFn: (metaData) =>
          graphqlFetcher<Customer360ViewQueryResult, Customer360ViewQueryVariables>(
            Customer360ViewDocument,
            { ...variables, ...(metaData.pageParam ?? {}) },
          )(),
        ...restOptions,
      };
    })(),
  );
};

useInfiniteCustomer360ViewQuery.getKey = (variables: Customer360ViewQueryVariables) => [
  "Customer360View.infinite",
  variables,
];

useCustomer360ViewQuery.fetcher = (
  variables: Customer360ViewQueryVariables,
  options?: RequestInit["headers"],
) =>
  graphqlFetcher<Customer360ViewQueryResult, Customer360ViewQueryVariables>(
    Customer360ViewDocument,
    variables,
    options,
  );

export const CustomerNetworkStatusUpdatedDocument = `
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
export const CustomerDevicesUpdatedDocument = `
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
export const CustomerTicketUpdatedDocument = `
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
export const CustomerActivityAddedDocument = `
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
export const CustomerNoteUpdatedDocument = `
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
export const FiberCableListDocument = `
    query FiberCableList($limit: Int = 50, $offset: Int = 0, $status: FiberCableStatus, $fiberType: FiberType, $installationType: CableInstallationType, $siteId: String, $search: String) {
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

export const useFiberCableListQuery = <TData = FiberCableListQueryResult, TError = unknown>(
  variables?: FiberCableListQueryVariables,
  options?: Omit<UseQueryOptions<FiberCableListQueryResult, TError, TData>, "queryKey"> & {
    queryKey?: UseQueryOptions<FiberCableListQueryResult, TError, TData>["queryKey"];
  },
) => {
  return useQuery<FiberCableListQueryResult, TError, TData>({
    queryKey: variables === undefined ? ["FiberCableList"] : ["FiberCableList", variables],
    queryFn: graphqlFetcher<FiberCableListQueryResult, FiberCableListQueryVariables>(
      FiberCableListDocument,
      variables,
    ),
    ...options,
  });
};

useFiberCableListQuery.getKey = (variables?: FiberCableListQueryVariables) =>
  variables === undefined ? ["FiberCableList"] : ["FiberCableList", variables];

export const useInfiniteFiberCableListQuery = <
  TData = InfiniteData<FiberCableListQueryResult>,
  TError = unknown,
>(
  variables: FiberCableListQueryVariables,
  options: Omit<UseInfiniteQueryOptions<FiberCableListQueryResult, TError, TData>, "queryKey"> & {
    queryKey?: UseInfiniteQueryOptions<FiberCableListQueryResult, TError, TData>["queryKey"];
  },
) => {
  return useInfiniteQuery<FiberCableListQueryResult, TError, TData>(
    (() => {
      const { queryKey: optionsQueryKey, ...restOptions } = options;
      return {
        queryKey:
          (optionsQueryKey ?? variables === undefined)
            ? ["FiberCableList.infinite"]
            : ["FiberCableList.infinite", variables],
        queryFn: (metaData) =>
          graphqlFetcher<FiberCableListQueryResult, FiberCableListQueryVariables>(
            FiberCableListDocument,
            { ...variables, ...(metaData.pageParam ?? {}) },
          )(),
        ...restOptions,
      };
    })(),
  );
};

useInfiniteFiberCableListQuery.getKey = (variables?: FiberCableListQueryVariables) =>
  variables === undefined ? ["FiberCableList.infinite"] : ["FiberCableList.infinite", variables];

useFiberCableListQuery.fetcher = (
  variables?: FiberCableListQueryVariables,
  options?: RequestInit["headers"],
) =>
  graphqlFetcher<FiberCableListQueryResult, FiberCableListQueryVariables>(
    FiberCableListDocument,
    variables,
    options,
  );

export const FiberCableDetailDocument = `
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

export const useFiberCableDetailQuery = <TData = FiberCableDetailQueryResult, TError = unknown>(
  variables: FiberCableDetailQueryVariables,
  options?: Omit<UseQueryOptions<FiberCableDetailQueryResult, TError, TData>, "queryKey"> & {
    queryKey?: UseQueryOptions<FiberCableDetailQueryResult, TError, TData>["queryKey"];
  },
) => {
  return useQuery<FiberCableDetailQueryResult, TError, TData>({
    queryKey: ["FiberCableDetail", variables],
    queryFn: graphqlFetcher<FiberCableDetailQueryResult, FiberCableDetailQueryVariables>(
      FiberCableDetailDocument,
      variables,
    ),
    ...options,
  });
};

useFiberCableDetailQuery.getKey = (variables: FiberCableDetailQueryVariables) => [
  "FiberCableDetail",
  variables,
];

export const useInfiniteFiberCableDetailQuery = <
  TData = InfiniteData<FiberCableDetailQueryResult>,
  TError = unknown,
>(
  variables: FiberCableDetailQueryVariables,
  options: Omit<UseInfiniteQueryOptions<FiberCableDetailQueryResult, TError, TData>, "queryKey"> & {
    queryKey?: UseInfiniteQueryOptions<FiberCableDetailQueryResult, TError, TData>["queryKey"];
  },
) => {
  return useInfiniteQuery<FiberCableDetailQueryResult, TError, TData>(
    (() => {
      const { queryKey: optionsQueryKey, ...restOptions } = options;
      return {
        queryKey: optionsQueryKey ?? ["FiberCableDetail.infinite", variables],
        queryFn: (metaData) =>
          graphqlFetcher<FiberCableDetailQueryResult, FiberCableDetailQueryVariables>(
            FiberCableDetailDocument,
            { ...variables, ...(metaData.pageParam ?? {}) },
          )(),
        ...restOptions,
      };
    })(),
  );
};

useInfiniteFiberCableDetailQuery.getKey = (variables: FiberCableDetailQueryVariables) => [
  "FiberCableDetail.infinite",
  variables,
];

useFiberCableDetailQuery.fetcher = (
  variables: FiberCableDetailQueryVariables,
  options?: RequestInit["headers"],
) =>
  graphqlFetcher<FiberCableDetailQueryResult, FiberCableDetailQueryVariables>(
    FiberCableDetailDocument,
    variables,
    options,
  );

export const FiberCablesByRouteDocument = `
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

export const useFiberCablesByRouteQuery = <TData = FiberCablesByRouteQueryResult, TError = unknown>(
  variables: FiberCablesByRouteQueryVariables,
  options?: Omit<UseQueryOptions<FiberCablesByRouteQueryResult, TError, TData>, "queryKey"> & {
    queryKey?: UseQueryOptions<FiberCablesByRouteQueryResult, TError, TData>["queryKey"];
  },
) => {
  return useQuery<FiberCablesByRouteQueryResult, TError, TData>({
    queryKey: ["FiberCablesByRoute", variables],
    queryFn: graphqlFetcher<FiberCablesByRouteQueryResult, FiberCablesByRouteQueryVariables>(
      FiberCablesByRouteDocument,
      variables,
    ),
    ...options,
  });
};

useFiberCablesByRouteQuery.getKey = (variables: FiberCablesByRouteQueryVariables) => [
  "FiberCablesByRoute",
  variables,
];

export const useInfiniteFiberCablesByRouteQuery = <
  TData = InfiniteData<FiberCablesByRouteQueryResult>,
  TError = unknown,
>(
  variables: FiberCablesByRouteQueryVariables,
  options: Omit<
    UseInfiniteQueryOptions<FiberCablesByRouteQueryResult, TError, TData>,
    "queryKey"
  > & {
    queryKey?: UseInfiniteQueryOptions<FiberCablesByRouteQueryResult, TError, TData>["queryKey"];
  },
) => {
  return useInfiniteQuery<FiberCablesByRouteQueryResult, TError, TData>(
    (() => {
      const { queryKey: optionsQueryKey, ...restOptions } = options;
      return {
        queryKey: optionsQueryKey ?? ["FiberCablesByRoute.infinite", variables],
        queryFn: (metaData) =>
          graphqlFetcher<FiberCablesByRouteQueryResult, FiberCablesByRouteQueryVariables>(
            FiberCablesByRouteDocument,
            { ...variables, ...(metaData.pageParam ?? {}) },
          )(),
        ...restOptions,
      };
    })(),
  );
};

useInfiniteFiberCablesByRouteQuery.getKey = (variables: FiberCablesByRouteQueryVariables) => [
  "FiberCablesByRoute.infinite",
  variables,
];

useFiberCablesByRouteQuery.fetcher = (
  variables: FiberCablesByRouteQueryVariables,
  options?: RequestInit["headers"],
) =>
  graphqlFetcher<FiberCablesByRouteQueryResult, FiberCablesByRouteQueryVariables>(
    FiberCablesByRouteDocument,
    variables,
    options,
  );

export const FiberCablesByDistributionPointDocument = `
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

export const useFiberCablesByDistributionPointQuery = <
  TData = FiberCablesByDistributionPointQueryResult,
  TError = unknown,
>(
  variables: FiberCablesByDistributionPointQueryVariables,
  options?: Omit<
    UseQueryOptions<FiberCablesByDistributionPointQueryResult, TError, TData>,
    "queryKey"
  > & {
    queryKey?: UseQueryOptions<
      FiberCablesByDistributionPointQueryResult,
      TError,
      TData
    >["queryKey"];
  },
) => {
  return useQuery<FiberCablesByDistributionPointQueryResult, TError, TData>({
    queryKey: ["FiberCablesByDistributionPoint", variables],
    queryFn: graphqlFetcher<
      FiberCablesByDistributionPointQueryResult,
      FiberCablesByDistributionPointQueryVariables
    >(FiberCablesByDistributionPointDocument, variables),
    ...options,
  });
};

useFiberCablesByDistributionPointQuery.getKey = (
  variables: FiberCablesByDistributionPointQueryVariables,
) => ["FiberCablesByDistributionPoint", variables];

export const useInfiniteFiberCablesByDistributionPointQuery = <
  TData = InfiniteData<FiberCablesByDistributionPointQueryResult>,
  TError = unknown,
>(
  variables: FiberCablesByDistributionPointQueryVariables,
  options: Omit<
    UseInfiniteQueryOptions<FiberCablesByDistributionPointQueryResult, TError, TData>,
    "queryKey"
  > & {
    queryKey?: UseInfiniteQueryOptions<
      FiberCablesByDistributionPointQueryResult,
      TError,
      TData
    >["queryKey"];
  },
) => {
  return useInfiniteQuery<FiberCablesByDistributionPointQueryResult, TError, TData>(
    (() => {
      const { queryKey: optionsQueryKey, ...restOptions } = options;
      return {
        queryKey: optionsQueryKey ?? ["FiberCablesByDistributionPoint.infinite", variables],
        queryFn: (metaData) =>
          graphqlFetcher<
            FiberCablesByDistributionPointQueryResult,
            FiberCablesByDistributionPointQueryVariables
          >(FiberCablesByDistributionPointDocument, {
            ...variables,
            ...(metaData.pageParam ?? {}),
          })(),
        ...restOptions,
      };
    })(),
  );
};

useInfiniteFiberCablesByDistributionPointQuery.getKey = (
  variables: FiberCablesByDistributionPointQueryVariables,
) => ["FiberCablesByDistributionPoint.infinite", variables];

useFiberCablesByDistributionPointQuery.fetcher = (
  variables: FiberCablesByDistributionPointQueryVariables,
  options?: RequestInit["headers"],
) =>
  graphqlFetcher<
    FiberCablesByDistributionPointQueryResult,
    FiberCablesByDistributionPointQueryVariables
  >(FiberCablesByDistributionPointDocument, variables, options);

export const SplicePointListDocument = `
    query SplicePointList($limit: Int = 50, $offset: Int = 0, $status: SpliceStatus, $cableId: String, $distributionPointId: String) {
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

export const useSplicePointListQuery = <TData = SplicePointListQueryResult, TError = unknown>(
  variables?: SplicePointListQueryVariables,
  options?: Omit<UseQueryOptions<SplicePointListQueryResult, TError, TData>, "queryKey"> & {
    queryKey?: UseQueryOptions<SplicePointListQueryResult, TError, TData>["queryKey"];
  },
) => {
  return useQuery<SplicePointListQueryResult, TError, TData>({
    queryKey: variables === undefined ? ["SplicePointList"] : ["SplicePointList", variables],
    queryFn: graphqlFetcher<SplicePointListQueryResult, SplicePointListQueryVariables>(
      SplicePointListDocument,
      variables,
    ),
    ...options,
  });
};

useSplicePointListQuery.getKey = (variables?: SplicePointListQueryVariables) =>
  variables === undefined ? ["SplicePointList"] : ["SplicePointList", variables];

export const useInfiniteSplicePointListQuery = <
  TData = InfiniteData<SplicePointListQueryResult>,
  TError = unknown,
>(
  variables: SplicePointListQueryVariables,
  options: Omit<UseInfiniteQueryOptions<SplicePointListQueryResult, TError, TData>, "queryKey"> & {
    queryKey?: UseInfiniteQueryOptions<SplicePointListQueryResult, TError, TData>["queryKey"];
  },
) => {
  return useInfiniteQuery<SplicePointListQueryResult, TError, TData>(
    (() => {
      const { queryKey: optionsQueryKey, ...restOptions } = options;
      return {
        queryKey:
          (optionsQueryKey ?? variables === undefined)
            ? ["SplicePointList.infinite"]
            : ["SplicePointList.infinite", variables],
        queryFn: (metaData) =>
          graphqlFetcher<SplicePointListQueryResult, SplicePointListQueryVariables>(
            SplicePointListDocument,
            { ...variables, ...(metaData.pageParam ?? {}) },
          )(),
        ...restOptions,
      };
    })(),
  );
};

useInfiniteSplicePointListQuery.getKey = (variables?: SplicePointListQueryVariables) =>
  variables === undefined ? ["SplicePointList.infinite"] : ["SplicePointList.infinite", variables];

useSplicePointListQuery.fetcher = (
  variables?: SplicePointListQueryVariables,
  options?: RequestInit["headers"],
) =>
  graphqlFetcher<SplicePointListQueryResult, SplicePointListQueryVariables>(
    SplicePointListDocument,
    variables,
    options,
  );

export const SplicePointDetailDocument = `
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

export const useSplicePointDetailQuery = <TData = SplicePointDetailQueryResult, TError = unknown>(
  variables: SplicePointDetailQueryVariables,
  options?: Omit<UseQueryOptions<SplicePointDetailQueryResult, TError, TData>, "queryKey"> & {
    queryKey?: UseQueryOptions<SplicePointDetailQueryResult, TError, TData>["queryKey"];
  },
) => {
  return useQuery<SplicePointDetailQueryResult, TError, TData>({
    queryKey: ["SplicePointDetail", variables],
    queryFn: graphqlFetcher<SplicePointDetailQueryResult, SplicePointDetailQueryVariables>(
      SplicePointDetailDocument,
      variables,
    ),
    ...options,
  });
};

useSplicePointDetailQuery.getKey = (variables: SplicePointDetailQueryVariables) => [
  "SplicePointDetail",
  variables,
];

export const useInfiniteSplicePointDetailQuery = <
  TData = InfiniteData<SplicePointDetailQueryResult>,
  TError = unknown,
>(
  variables: SplicePointDetailQueryVariables,
  options: Omit<
    UseInfiniteQueryOptions<SplicePointDetailQueryResult, TError, TData>,
    "queryKey"
  > & {
    queryKey?: UseInfiniteQueryOptions<SplicePointDetailQueryResult, TError, TData>["queryKey"];
  },
) => {
  return useInfiniteQuery<SplicePointDetailQueryResult, TError, TData>(
    (() => {
      const { queryKey: optionsQueryKey, ...restOptions } = options;
      return {
        queryKey: optionsQueryKey ?? ["SplicePointDetail.infinite", variables],
        queryFn: (metaData) =>
          graphqlFetcher<SplicePointDetailQueryResult, SplicePointDetailQueryVariables>(
            SplicePointDetailDocument,
            { ...variables, ...(metaData.pageParam ?? {}) },
          )(),
        ...restOptions,
      };
    })(),
  );
};

useInfiniteSplicePointDetailQuery.getKey = (variables: SplicePointDetailQueryVariables) => [
  "SplicePointDetail.infinite",
  variables,
];

useSplicePointDetailQuery.fetcher = (
  variables: SplicePointDetailQueryVariables,
  options?: RequestInit["headers"],
) =>
  graphqlFetcher<SplicePointDetailQueryResult, SplicePointDetailQueryVariables>(
    SplicePointDetailDocument,
    variables,
    options,
  );

export const SplicePointsByCableDocument = `
    query SplicePointsByCable($cableId: String!) {
  splicePointsByCable(cableId: $cableId) {
    id
    spliceId
    name
    status
    totalSplices
    activeSplices
    averageSpliceLossDb
    passingSplices
  }
}
    `;

export const useSplicePointsByCableQuery = <
  TData = SplicePointsByCableQueryResult,
  TError = unknown,
>(
  variables: SplicePointsByCableQueryVariables,
  options?: Omit<UseQueryOptions<SplicePointsByCableQueryResult, TError, TData>, "queryKey"> & {
    queryKey?: UseQueryOptions<SplicePointsByCableQueryResult, TError, TData>["queryKey"];
  },
) => {
  return useQuery<SplicePointsByCableQueryResult, TError, TData>({
    queryKey: ["SplicePointsByCable", variables],
    queryFn: graphqlFetcher<SplicePointsByCableQueryResult, SplicePointsByCableQueryVariables>(
      SplicePointsByCableDocument,
      variables,
    ),
    ...options,
  });
};

useSplicePointsByCableQuery.getKey = (variables: SplicePointsByCableQueryVariables) => [
  "SplicePointsByCable",
  variables,
];

export const useInfiniteSplicePointsByCableQuery = <
  TData = InfiniteData<SplicePointsByCableQueryResult>,
  TError = unknown,
>(
  variables: SplicePointsByCableQueryVariables,
  options: Omit<
    UseInfiniteQueryOptions<SplicePointsByCableQueryResult, TError, TData>,
    "queryKey"
  > & {
    queryKey?: UseInfiniteQueryOptions<SplicePointsByCableQueryResult, TError, TData>["queryKey"];
  },
) => {
  return useInfiniteQuery<SplicePointsByCableQueryResult, TError, TData>(
    (() => {
      const { queryKey: optionsQueryKey, ...restOptions } = options;
      return {
        queryKey: optionsQueryKey ?? ["SplicePointsByCable.infinite", variables],
        queryFn: (metaData) =>
          graphqlFetcher<SplicePointsByCableQueryResult, SplicePointsByCableQueryVariables>(
            SplicePointsByCableDocument,
            { ...variables, ...(metaData.pageParam ?? {}) },
          )(),
        ...restOptions,
      };
    })(),
  );
};

useInfiniteSplicePointsByCableQuery.getKey = (variables: SplicePointsByCableQueryVariables) => [
  "SplicePointsByCable.infinite",
  variables,
];

useSplicePointsByCableQuery.fetcher = (
  variables: SplicePointsByCableQueryVariables,
  options?: RequestInit["headers"],
) =>
  graphqlFetcher<SplicePointsByCableQueryResult, SplicePointsByCableQueryVariables>(
    SplicePointsByCableDocument,
    variables,
    options,
  );

export const DistributionPointListDocument = `
    query DistributionPointList($limit: Int = 50, $offset: Int = 0, $pointType: DistributionPointType, $status: FiberCableStatus, $siteId: String, $nearCapacity: Boolean) {
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

export const useDistributionPointListQuery = <
  TData = DistributionPointListQueryResult,
  TError = unknown,
>(
  variables?: DistributionPointListQueryVariables,
  options?: Omit<UseQueryOptions<DistributionPointListQueryResult, TError, TData>, "queryKey"> & {
    queryKey?: UseQueryOptions<DistributionPointListQueryResult, TError, TData>["queryKey"];
  },
) => {
  return useQuery<DistributionPointListQueryResult, TError, TData>({
    queryKey:
      variables === undefined ? ["DistributionPointList"] : ["DistributionPointList", variables],
    queryFn: graphqlFetcher<DistributionPointListQueryResult, DistributionPointListQueryVariables>(
      DistributionPointListDocument,
      variables,
    ),
    ...options,
  });
};

useDistributionPointListQuery.getKey = (variables?: DistributionPointListQueryVariables) =>
  variables === undefined ? ["DistributionPointList"] : ["DistributionPointList", variables];

export const useInfiniteDistributionPointListQuery = <
  TData = InfiniteData<DistributionPointListQueryResult>,
  TError = unknown,
>(
  variables: DistributionPointListQueryVariables,
  options: Omit<
    UseInfiniteQueryOptions<DistributionPointListQueryResult, TError, TData>,
    "queryKey"
  > & {
    queryKey?: UseInfiniteQueryOptions<DistributionPointListQueryResult, TError, TData>["queryKey"];
  },
) => {
  return useInfiniteQuery<DistributionPointListQueryResult, TError, TData>(
    (() => {
      const { queryKey: optionsQueryKey, ...restOptions } = options;
      return {
        queryKey:
          (optionsQueryKey ?? variables === undefined)
            ? ["DistributionPointList.infinite"]
            : ["DistributionPointList.infinite", variables],
        queryFn: (metaData) =>
          graphqlFetcher<DistributionPointListQueryResult, DistributionPointListQueryVariables>(
            DistributionPointListDocument,
            { ...variables, ...(metaData.pageParam ?? {}) },
          )(),
        ...restOptions,
      };
    })(),
  );
};

useInfiniteDistributionPointListQuery.getKey = (variables?: DistributionPointListQueryVariables) =>
  variables === undefined
    ? ["DistributionPointList.infinite"]
    : ["DistributionPointList.infinite", variables];

useDistributionPointListQuery.fetcher = (
  variables?: DistributionPointListQueryVariables,
  options?: RequestInit["headers"],
) =>
  graphqlFetcher<DistributionPointListQueryResult, DistributionPointListQueryVariables>(
    DistributionPointListDocument,
    variables,
    options,
  );

export const DistributionPointDetailDocument = `
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

export const useDistributionPointDetailQuery = <
  TData = DistributionPointDetailQueryResult,
  TError = unknown,
>(
  variables: DistributionPointDetailQueryVariables,
  options?: Omit<UseQueryOptions<DistributionPointDetailQueryResult, TError, TData>, "queryKey"> & {
    queryKey?: UseQueryOptions<DistributionPointDetailQueryResult, TError, TData>["queryKey"];
  },
) => {
  return useQuery<DistributionPointDetailQueryResult, TError, TData>({
    queryKey: ["DistributionPointDetail", variables],
    queryFn: graphqlFetcher<
      DistributionPointDetailQueryResult,
      DistributionPointDetailQueryVariables
    >(DistributionPointDetailDocument, variables),
    ...options,
  });
};

useDistributionPointDetailQuery.getKey = (variables: DistributionPointDetailQueryVariables) => [
  "DistributionPointDetail",
  variables,
];

export const useInfiniteDistributionPointDetailQuery = <
  TData = InfiniteData<DistributionPointDetailQueryResult>,
  TError = unknown,
>(
  variables: DistributionPointDetailQueryVariables,
  options: Omit<
    UseInfiniteQueryOptions<DistributionPointDetailQueryResult, TError, TData>,
    "queryKey"
  > & {
    queryKey?: UseInfiniteQueryOptions<
      DistributionPointDetailQueryResult,
      TError,
      TData
    >["queryKey"];
  },
) => {
  return useInfiniteQuery<DistributionPointDetailQueryResult, TError, TData>(
    (() => {
      const { queryKey: optionsQueryKey, ...restOptions } = options;
      return {
        queryKey: optionsQueryKey ?? ["DistributionPointDetail.infinite", variables],
        queryFn: (metaData) =>
          graphqlFetcher<DistributionPointDetailQueryResult, DistributionPointDetailQueryVariables>(
            DistributionPointDetailDocument,
            { ...variables, ...(metaData.pageParam ?? {}) },
          )(),
        ...restOptions,
      };
    })(),
  );
};

useInfiniteDistributionPointDetailQuery.getKey = (
  variables: DistributionPointDetailQueryVariables,
) => ["DistributionPointDetail.infinite", variables];

useDistributionPointDetailQuery.fetcher = (
  variables: DistributionPointDetailQueryVariables,
  options?: RequestInit["headers"],
) =>
  graphqlFetcher<DistributionPointDetailQueryResult, DistributionPointDetailQueryVariables>(
    DistributionPointDetailDocument,
    variables,
    options,
  );

export const DistributionPointsBySiteDocument = `
    query DistributionPointsBySite($siteId: String!) {
  distributionPointsBySite(siteId: $siteId) {
    id
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

export const useDistributionPointsBySiteQuery = <
  TData = DistributionPointsBySiteQueryResult,
  TError = unknown,
>(
  variables: DistributionPointsBySiteQueryVariables,
  options?: Omit<
    UseQueryOptions<DistributionPointsBySiteQueryResult, TError, TData>,
    "queryKey"
  > & {
    queryKey?: UseQueryOptions<DistributionPointsBySiteQueryResult, TError, TData>["queryKey"];
  },
) => {
  return useQuery<DistributionPointsBySiteQueryResult, TError, TData>({
    queryKey: ["DistributionPointsBySite", variables],
    queryFn: graphqlFetcher<
      DistributionPointsBySiteQueryResult,
      DistributionPointsBySiteQueryVariables
    >(DistributionPointsBySiteDocument, variables),
    ...options,
  });
};

useDistributionPointsBySiteQuery.getKey = (variables: DistributionPointsBySiteQueryVariables) => [
  "DistributionPointsBySite",
  variables,
];

export const useInfiniteDistributionPointsBySiteQuery = <
  TData = InfiniteData<DistributionPointsBySiteQueryResult>,
  TError = unknown,
>(
  variables: DistributionPointsBySiteQueryVariables,
  options: Omit<
    UseInfiniteQueryOptions<DistributionPointsBySiteQueryResult, TError, TData>,
    "queryKey"
  > & {
    queryKey?: UseInfiniteQueryOptions<
      DistributionPointsBySiteQueryResult,
      TError,
      TData
    >["queryKey"];
  },
) => {
  return useInfiniteQuery<DistributionPointsBySiteQueryResult, TError, TData>(
    (() => {
      const { queryKey: optionsQueryKey, ...restOptions } = options;
      return {
        queryKey: optionsQueryKey ?? ["DistributionPointsBySite.infinite", variables],
        queryFn: (metaData) =>
          graphqlFetcher<
            DistributionPointsBySiteQueryResult,
            DistributionPointsBySiteQueryVariables
          >(DistributionPointsBySiteDocument, { ...variables, ...(metaData.pageParam ?? {}) })(),
        ...restOptions,
      };
    })(),
  );
};

useInfiniteDistributionPointsBySiteQuery.getKey = (
  variables: DistributionPointsBySiteQueryVariables,
) => ["DistributionPointsBySite.infinite", variables];

useDistributionPointsBySiteQuery.fetcher = (
  variables: DistributionPointsBySiteQueryVariables,
  options?: RequestInit["headers"],
) =>
  graphqlFetcher<DistributionPointsBySiteQueryResult, DistributionPointsBySiteQueryVariables>(
    DistributionPointsBySiteDocument,
    variables,
    options,
  );

export const ServiceAreaListDocument = `
    query ServiceAreaList($limit: Int = 50, $offset: Int = 0, $areaType: ServiceAreaType, $isServiceable: Boolean, $constructionStatus: String) {
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

export const useServiceAreaListQuery = <TData = ServiceAreaListQueryResult, TError = unknown>(
  variables?: ServiceAreaListQueryVariables,
  options?: Omit<UseQueryOptions<ServiceAreaListQueryResult, TError, TData>, "queryKey"> & {
    queryKey?: UseQueryOptions<ServiceAreaListQueryResult, TError, TData>["queryKey"];
  },
) => {
  return useQuery<ServiceAreaListQueryResult, TError, TData>({
    queryKey: variables === undefined ? ["ServiceAreaList"] : ["ServiceAreaList", variables],
    queryFn: graphqlFetcher<ServiceAreaListQueryResult, ServiceAreaListQueryVariables>(
      ServiceAreaListDocument,
      variables,
    ),
    ...options,
  });
};

useServiceAreaListQuery.getKey = (variables?: ServiceAreaListQueryVariables) =>
  variables === undefined ? ["ServiceAreaList"] : ["ServiceAreaList", variables];

export const useInfiniteServiceAreaListQuery = <
  TData = InfiniteData<ServiceAreaListQueryResult>,
  TError = unknown,
>(
  variables: ServiceAreaListQueryVariables,
  options: Omit<UseInfiniteQueryOptions<ServiceAreaListQueryResult, TError, TData>, "queryKey"> & {
    queryKey?: UseInfiniteQueryOptions<ServiceAreaListQueryResult, TError, TData>["queryKey"];
  },
) => {
  return useInfiniteQuery<ServiceAreaListQueryResult, TError, TData>(
    (() => {
      const { queryKey: optionsQueryKey, ...restOptions } = options;
      return {
        queryKey:
          (optionsQueryKey ?? variables === undefined)
            ? ["ServiceAreaList.infinite"]
            : ["ServiceAreaList.infinite", variables],
        queryFn: (metaData) =>
          graphqlFetcher<ServiceAreaListQueryResult, ServiceAreaListQueryVariables>(
            ServiceAreaListDocument,
            { ...variables, ...(metaData.pageParam ?? {}) },
          )(),
        ...restOptions,
      };
    })(),
  );
};

useInfiniteServiceAreaListQuery.getKey = (variables?: ServiceAreaListQueryVariables) =>
  variables === undefined ? ["ServiceAreaList.infinite"] : ["ServiceAreaList.infinite", variables];

useServiceAreaListQuery.fetcher = (
  variables?: ServiceAreaListQueryVariables,
  options?: RequestInit["headers"],
) =>
  graphqlFetcher<ServiceAreaListQueryResult, ServiceAreaListQueryVariables>(
    ServiceAreaListDocument,
    variables,
    options,
  );

export const ServiceAreaDetailDocument = `
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

export const useServiceAreaDetailQuery = <TData = ServiceAreaDetailQueryResult, TError = unknown>(
  variables: ServiceAreaDetailQueryVariables,
  options?: Omit<UseQueryOptions<ServiceAreaDetailQueryResult, TError, TData>, "queryKey"> & {
    queryKey?: UseQueryOptions<ServiceAreaDetailQueryResult, TError, TData>["queryKey"];
  },
) => {
  return useQuery<ServiceAreaDetailQueryResult, TError, TData>({
    queryKey: ["ServiceAreaDetail", variables],
    queryFn: graphqlFetcher<ServiceAreaDetailQueryResult, ServiceAreaDetailQueryVariables>(
      ServiceAreaDetailDocument,
      variables,
    ),
    ...options,
  });
};

useServiceAreaDetailQuery.getKey = (variables: ServiceAreaDetailQueryVariables) => [
  "ServiceAreaDetail",
  variables,
];

export const useInfiniteServiceAreaDetailQuery = <
  TData = InfiniteData<ServiceAreaDetailQueryResult>,
  TError = unknown,
>(
  variables: ServiceAreaDetailQueryVariables,
  options: Omit<
    UseInfiniteQueryOptions<ServiceAreaDetailQueryResult, TError, TData>,
    "queryKey"
  > & {
    queryKey?: UseInfiniteQueryOptions<ServiceAreaDetailQueryResult, TError, TData>["queryKey"];
  },
) => {
  return useInfiniteQuery<ServiceAreaDetailQueryResult, TError, TData>(
    (() => {
      const { queryKey: optionsQueryKey, ...restOptions } = options;
      return {
        queryKey: optionsQueryKey ?? ["ServiceAreaDetail.infinite", variables],
        queryFn: (metaData) =>
          graphqlFetcher<ServiceAreaDetailQueryResult, ServiceAreaDetailQueryVariables>(
            ServiceAreaDetailDocument,
            { ...variables, ...(metaData.pageParam ?? {}) },
          )(),
        ...restOptions,
      };
    })(),
  );
};

useInfiniteServiceAreaDetailQuery.getKey = (variables: ServiceAreaDetailQueryVariables) => [
  "ServiceAreaDetail.infinite",
  variables,
];

useServiceAreaDetailQuery.fetcher = (
  variables: ServiceAreaDetailQueryVariables,
  options?: RequestInit["headers"],
) =>
  graphqlFetcher<ServiceAreaDetailQueryResult, ServiceAreaDetailQueryVariables>(
    ServiceAreaDetailDocument,
    variables,
    options,
  );

export const ServiceAreasByPostalCodeDocument = `
    query ServiceAreasByPostalCode($postalCode: String!) {
  serviceAreasByPostalCode(postalCode: $postalCode) {
    id
    areaId
    name
    city
    stateProvince
    isServiceable
    homesPassed
    homesConnected
    penetrationRatePercent
    maxBandwidthGbps
  }
}
    `;

export const useServiceAreasByPostalCodeQuery = <
  TData = ServiceAreasByPostalCodeQueryResult,
  TError = unknown,
>(
  variables: ServiceAreasByPostalCodeQueryVariables,
  options?: Omit<
    UseQueryOptions<ServiceAreasByPostalCodeQueryResult, TError, TData>,
    "queryKey"
  > & {
    queryKey?: UseQueryOptions<ServiceAreasByPostalCodeQueryResult, TError, TData>["queryKey"];
  },
) => {
  return useQuery<ServiceAreasByPostalCodeQueryResult, TError, TData>({
    queryKey: ["ServiceAreasByPostalCode", variables],
    queryFn: graphqlFetcher<
      ServiceAreasByPostalCodeQueryResult,
      ServiceAreasByPostalCodeQueryVariables
    >(ServiceAreasByPostalCodeDocument, variables),
    ...options,
  });
};

useServiceAreasByPostalCodeQuery.getKey = (variables: ServiceAreasByPostalCodeQueryVariables) => [
  "ServiceAreasByPostalCode",
  variables,
];

export const useInfiniteServiceAreasByPostalCodeQuery = <
  TData = InfiniteData<ServiceAreasByPostalCodeQueryResult>,
  TError = unknown,
>(
  variables: ServiceAreasByPostalCodeQueryVariables,
  options: Omit<
    UseInfiniteQueryOptions<ServiceAreasByPostalCodeQueryResult, TError, TData>,
    "queryKey"
  > & {
    queryKey?: UseInfiniteQueryOptions<
      ServiceAreasByPostalCodeQueryResult,
      TError,
      TData
    >["queryKey"];
  },
) => {
  return useInfiniteQuery<ServiceAreasByPostalCodeQueryResult, TError, TData>(
    (() => {
      const { queryKey: optionsQueryKey, ...restOptions } = options;
      return {
        queryKey: optionsQueryKey ?? ["ServiceAreasByPostalCode.infinite", variables],
        queryFn: (metaData) =>
          graphqlFetcher<
            ServiceAreasByPostalCodeQueryResult,
            ServiceAreasByPostalCodeQueryVariables
          >(ServiceAreasByPostalCodeDocument, { ...variables, ...(metaData.pageParam ?? {}) })(),
        ...restOptions,
      };
    })(),
  );
};

useInfiniteServiceAreasByPostalCodeQuery.getKey = (
  variables: ServiceAreasByPostalCodeQueryVariables,
) => ["ServiceAreasByPostalCode.infinite", variables];

useServiceAreasByPostalCodeQuery.fetcher = (
  variables: ServiceAreasByPostalCodeQueryVariables,
  options?: RequestInit["headers"],
) =>
  graphqlFetcher<ServiceAreasByPostalCodeQueryResult, ServiceAreasByPostalCodeQueryVariables>(
    ServiceAreasByPostalCodeDocument,
    variables,
    options,
  );

export const FiberHealthMetricsDocument = `
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

export const useFiberHealthMetricsQuery = <TData = FiberHealthMetricsQueryResult, TError = unknown>(
  variables?: FiberHealthMetricsQueryVariables,
  options?: Omit<UseQueryOptions<FiberHealthMetricsQueryResult, TError, TData>, "queryKey"> & {
    queryKey?: UseQueryOptions<FiberHealthMetricsQueryResult, TError, TData>["queryKey"];
  },
) => {
  return useQuery<FiberHealthMetricsQueryResult, TError, TData>({
    queryKey: variables === undefined ? ["FiberHealthMetrics"] : ["FiberHealthMetrics", variables],
    queryFn: graphqlFetcher<FiberHealthMetricsQueryResult, FiberHealthMetricsQueryVariables>(
      FiberHealthMetricsDocument,
      variables,
    ),
    ...options,
  });
};

useFiberHealthMetricsQuery.getKey = (variables?: FiberHealthMetricsQueryVariables) =>
  variables === undefined ? ["FiberHealthMetrics"] : ["FiberHealthMetrics", variables];

export const useInfiniteFiberHealthMetricsQuery = <
  TData = InfiniteData<FiberHealthMetricsQueryResult>,
  TError = unknown,
>(
  variables: FiberHealthMetricsQueryVariables,
  options: Omit<
    UseInfiniteQueryOptions<FiberHealthMetricsQueryResult, TError, TData>,
    "queryKey"
  > & {
    queryKey?: UseInfiniteQueryOptions<FiberHealthMetricsQueryResult, TError, TData>["queryKey"];
  },
) => {
  return useInfiniteQuery<FiberHealthMetricsQueryResult, TError, TData>(
    (() => {
      const { queryKey: optionsQueryKey, ...restOptions } = options;
      return {
        queryKey:
          (optionsQueryKey ?? variables === undefined)
            ? ["FiberHealthMetrics.infinite"]
            : ["FiberHealthMetrics.infinite", variables],
        queryFn: (metaData) =>
          graphqlFetcher<FiberHealthMetricsQueryResult, FiberHealthMetricsQueryVariables>(
            FiberHealthMetricsDocument,
            { ...variables, ...(metaData.pageParam ?? {}) },
          )(),
        ...restOptions,
      };
    })(),
  );
};

useInfiniteFiberHealthMetricsQuery.getKey = (variables?: FiberHealthMetricsQueryVariables) =>
  variables === undefined
    ? ["FiberHealthMetrics.infinite"]
    : ["FiberHealthMetrics.infinite", variables];

useFiberHealthMetricsQuery.fetcher = (
  variables?: FiberHealthMetricsQueryVariables,
  options?: RequestInit["headers"],
) =>
  graphqlFetcher<FiberHealthMetricsQueryResult, FiberHealthMetricsQueryVariables>(
    FiberHealthMetricsDocument,
    variables,
    options,
  );

export const OtdrTestResultsDocument = `
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

export const useOtdrTestResultsQuery = <TData = OtdrTestResultsQueryResult, TError = unknown>(
  variables: OtdrTestResultsQueryVariables,
  options?: Omit<UseQueryOptions<OtdrTestResultsQueryResult, TError, TData>, "queryKey"> & {
    queryKey?: UseQueryOptions<OtdrTestResultsQueryResult, TError, TData>["queryKey"];
  },
) => {
  return useQuery<OtdrTestResultsQueryResult, TError, TData>({
    queryKey: ["OTDRTestResults", variables],
    queryFn: graphqlFetcher<OtdrTestResultsQueryResult, OtdrTestResultsQueryVariables>(
      OtdrTestResultsDocument,
      variables,
    ),
    ...options,
  });
};

useOtdrTestResultsQuery.getKey = (variables: OtdrTestResultsQueryVariables) => [
  "OTDRTestResults",
  variables,
];

export const useInfiniteOtdrTestResultsQuery = <
  TData = InfiniteData<OtdrTestResultsQueryResult>,
  TError = unknown,
>(
  variables: OtdrTestResultsQueryVariables,
  options: Omit<UseInfiniteQueryOptions<OtdrTestResultsQueryResult, TError, TData>, "queryKey"> & {
    queryKey?: UseInfiniteQueryOptions<OtdrTestResultsQueryResult, TError, TData>["queryKey"];
  },
) => {
  return useInfiniteQuery<OtdrTestResultsQueryResult, TError, TData>(
    (() => {
      const { queryKey: optionsQueryKey, ...restOptions } = options;
      return {
        queryKey: optionsQueryKey ?? ["OTDRTestResults.infinite", variables],
        queryFn: (metaData) =>
          graphqlFetcher<OtdrTestResultsQueryResult, OtdrTestResultsQueryVariables>(
            OtdrTestResultsDocument,
            { ...variables, ...(metaData.pageParam ?? {}) },
          )(),
        ...restOptions,
      };
    })(),
  );
};

useInfiniteOtdrTestResultsQuery.getKey = (variables: OtdrTestResultsQueryVariables) => [
  "OTDRTestResults.infinite",
  variables,
];

useOtdrTestResultsQuery.fetcher = (
  variables: OtdrTestResultsQueryVariables,
  options?: RequestInit["headers"],
) =>
  graphqlFetcher<OtdrTestResultsQueryResult, OtdrTestResultsQueryVariables>(
    OtdrTestResultsDocument,
    variables,
    options,
  );

export const FiberNetworkAnalyticsDocument = `
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

export const useFiberNetworkAnalyticsQuery = <
  TData = FiberNetworkAnalyticsQueryResult,
  TError = unknown,
>(
  variables?: FiberNetworkAnalyticsQueryVariables,
  options?: Omit<UseQueryOptions<FiberNetworkAnalyticsQueryResult, TError, TData>, "queryKey"> & {
    queryKey?: UseQueryOptions<FiberNetworkAnalyticsQueryResult, TError, TData>["queryKey"];
  },
) => {
  return useQuery<FiberNetworkAnalyticsQueryResult, TError, TData>({
    queryKey:
      variables === undefined ? ["FiberNetworkAnalytics"] : ["FiberNetworkAnalytics", variables],
    queryFn: graphqlFetcher<FiberNetworkAnalyticsQueryResult, FiberNetworkAnalyticsQueryVariables>(
      FiberNetworkAnalyticsDocument,
      variables,
    ),
    ...options,
  });
};

useFiberNetworkAnalyticsQuery.getKey = (variables?: FiberNetworkAnalyticsQueryVariables) =>
  variables === undefined ? ["FiberNetworkAnalytics"] : ["FiberNetworkAnalytics", variables];

export const useInfiniteFiberNetworkAnalyticsQuery = <
  TData = InfiniteData<FiberNetworkAnalyticsQueryResult>,
  TError = unknown,
>(
  variables: FiberNetworkAnalyticsQueryVariables,
  options: Omit<
    UseInfiniteQueryOptions<FiberNetworkAnalyticsQueryResult, TError, TData>,
    "queryKey"
  > & {
    queryKey?: UseInfiniteQueryOptions<FiberNetworkAnalyticsQueryResult, TError, TData>["queryKey"];
  },
) => {
  return useInfiniteQuery<FiberNetworkAnalyticsQueryResult, TError, TData>(
    (() => {
      const { queryKey: optionsQueryKey, ...restOptions } = options;
      return {
        queryKey:
          (optionsQueryKey ?? variables === undefined)
            ? ["FiberNetworkAnalytics.infinite"]
            : ["FiberNetworkAnalytics.infinite", variables],
        queryFn: (metaData) =>
          graphqlFetcher<FiberNetworkAnalyticsQueryResult, FiberNetworkAnalyticsQueryVariables>(
            FiberNetworkAnalyticsDocument,
            { ...variables, ...(metaData.pageParam ?? {}) },
          )(),
        ...restOptions,
      };
    })(),
  );
};

useInfiniteFiberNetworkAnalyticsQuery.getKey = (variables?: FiberNetworkAnalyticsQueryVariables) =>
  variables === undefined
    ? ["FiberNetworkAnalytics.infinite"]
    : ["FiberNetworkAnalytics.infinite", variables];

useFiberNetworkAnalyticsQuery.fetcher = (
  variables?: FiberNetworkAnalyticsQueryVariables,
  options?: RequestInit["headers"],
) =>
  graphqlFetcher<FiberNetworkAnalyticsQueryResult, FiberNetworkAnalyticsQueryVariables>(
    FiberNetworkAnalyticsDocument,
    variables,
    options,
  );

export const FiberDashboardDocument = `
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

export const useFiberDashboardQuery = <TData = FiberDashboardQueryResult, TError = unknown>(
  variables?: FiberDashboardQueryVariables,
  options?: Omit<UseQueryOptions<FiberDashboardQueryResult, TError, TData>, "queryKey"> & {
    queryKey?: UseQueryOptions<FiberDashboardQueryResult, TError, TData>["queryKey"];
  },
) => {
  return useQuery<FiberDashboardQueryResult, TError, TData>({
    queryKey: variables === undefined ? ["FiberDashboard"] : ["FiberDashboard", variables],
    queryFn: graphqlFetcher<FiberDashboardQueryResult, FiberDashboardQueryVariables>(
      FiberDashboardDocument,
      variables,
    ),
    ...options,
  });
};

useFiberDashboardQuery.getKey = (variables?: FiberDashboardQueryVariables) =>
  variables === undefined ? ["FiberDashboard"] : ["FiberDashboard", variables];

export const useInfiniteFiberDashboardQuery = <
  TData = InfiniteData<FiberDashboardQueryResult>,
  TError = unknown,
>(
  variables: FiberDashboardQueryVariables,
  options: Omit<UseInfiniteQueryOptions<FiberDashboardQueryResult, TError, TData>, "queryKey"> & {
    queryKey?: UseInfiniteQueryOptions<FiberDashboardQueryResult, TError, TData>["queryKey"];
  },
) => {
  return useInfiniteQuery<FiberDashboardQueryResult, TError, TData>(
    (() => {
      const { queryKey: optionsQueryKey, ...restOptions } = options;
      return {
        queryKey:
          (optionsQueryKey ?? variables === undefined)
            ? ["FiberDashboard.infinite"]
            : ["FiberDashboard.infinite", variables],
        queryFn: (metaData) =>
          graphqlFetcher<FiberDashboardQueryResult, FiberDashboardQueryVariables>(
            FiberDashboardDocument,
            { ...variables, ...(metaData.pageParam ?? {}) },
          )(),
        ...restOptions,
      };
    })(),
  );
};

useInfiniteFiberDashboardQuery.getKey = (variables?: FiberDashboardQueryVariables) =>
  variables === undefined ? ["FiberDashboard.infinite"] : ["FiberDashboard.infinite", variables];

useFiberDashboardQuery.fetcher = (
  variables?: FiberDashboardQueryVariables,
  options?: RequestInit["headers"],
) =>
  graphqlFetcher<FiberDashboardQueryResult, FiberDashboardQueryVariables>(
    FiberDashboardDocument,
    variables,
    options,
  );

export const NetworkOverviewDocument = `
    query NetworkOverview {
  networkOverview {
    totalDevices
    onlineDevices
    offlineDevices
    activeAlerts
    criticalAlerts
    warningAlerts
    totalBandwidthGbps
    uptimePercentage
    dataSourceStatus {
      name
      status
    }
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

export const useNetworkOverviewQuery = <TData = NetworkOverviewQueryResult, TError = unknown>(
  variables?: NetworkOverviewQueryVariables,
  options?: Omit<UseQueryOptions<NetworkOverviewQueryResult, TError, TData>, "queryKey"> & {
    queryKey?: UseQueryOptions<NetworkOverviewQueryResult, TError, TData>["queryKey"];
  },
) => {
  return useQuery<NetworkOverviewQueryResult, TError, TData>({
    queryKey: variables === undefined ? ["NetworkOverview"] : ["NetworkOverview", variables],
    queryFn: graphqlFetcher<NetworkOverviewQueryResult, NetworkOverviewQueryVariables>(
      NetworkOverviewDocument,
      variables,
    ),
    ...options,
  });
};

useNetworkOverviewQuery.getKey = (variables?: NetworkOverviewQueryVariables) =>
  variables === undefined ? ["NetworkOverview"] : ["NetworkOverview", variables];

export const useInfiniteNetworkOverviewQuery = <
  TData = InfiniteData<NetworkOverviewQueryResult>,
  TError = unknown,
>(
  variables: NetworkOverviewQueryVariables,
  options: Omit<UseInfiniteQueryOptions<NetworkOverviewQueryResult, TError, TData>, "queryKey"> & {
    queryKey?: UseInfiniteQueryOptions<NetworkOverviewQueryResult, TError, TData>["queryKey"];
  },
) => {
  return useInfiniteQuery<NetworkOverviewQueryResult, TError, TData>(
    (() => {
      const { queryKey: optionsQueryKey, ...restOptions } = options;
      return {
        queryKey:
          (optionsQueryKey ?? variables === undefined)
            ? ["NetworkOverview.infinite"]
            : ["NetworkOverview.infinite", variables],
        queryFn: (metaData) =>
          graphqlFetcher<NetworkOverviewQueryResult, NetworkOverviewQueryVariables>(
            NetworkOverviewDocument,
            { ...variables, ...(metaData.pageParam ?? {}) },
          )(),
        ...restOptions,
      };
    })(),
  );
};

useInfiniteNetworkOverviewQuery.getKey = (variables?: NetworkOverviewQueryVariables) =>
  variables === undefined ? ["NetworkOverview.infinite"] : ["NetworkOverview.infinite", variables];

useNetworkOverviewQuery.fetcher = (
  variables?: NetworkOverviewQueryVariables,
  options?: RequestInit["headers"],
) =>
  graphqlFetcher<NetworkOverviewQueryResult, NetworkOverviewQueryVariables>(
    NetworkOverviewDocument,
    variables,
    options,
  );

export const NetworkDeviceListDocument = `
    query NetworkDeviceList($page: Int = 1, $pageSize: Int = 20, $deviceType: DeviceTypeEnum, $status: DeviceStatusEnum, $search: String) {
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

export const useNetworkDeviceListQuery = <TData = NetworkDeviceListQueryResult, TError = unknown>(
  variables?: NetworkDeviceListQueryVariables,
  options?: Omit<UseQueryOptions<NetworkDeviceListQueryResult, TError, TData>, "queryKey"> & {
    queryKey?: UseQueryOptions<NetworkDeviceListQueryResult, TError, TData>["queryKey"];
  },
) => {
  return useQuery<NetworkDeviceListQueryResult, TError, TData>({
    queryKey: variables === undefined ? ["NetworkDeviceList"] : ["NetworkDeviceList", variables],
    queryFn: graphqlFetcher<NetworkDeviceListQueryResult, NetworkDeviceListQueryVariables>(
      NetworkDeviceListDocument,
      variables,
    ),
    ...options,
  });
};

useNetworkDeviceListQuery.getKey = (variables?: NetworkDeviceListQueryVariables) =>
  variables === undefined ? ["NetworkDeviceList"] : ["NetworkDeviceList", variables];

export const useInfiniteNetworkDeviceListQuery = <
  TData = InfiniteData<NetworkDeviceListQueryResult>,
  TError = unknown,
>(
  variables: NetworkDeviceListQueryVariables,
  options: Omit<
    UseInfiniteQueryOptions<NetworkDeviceListQueryResult, TError, TData>,
    "queryKey"
  > & {
    queryKey?: UseInfiniteQueryOptions<NetworkDeviceListQueryResult, TError, TData>["queryKey"];
  },
) => {
  return useInfiniteQuery<NetworkDeviceListQueryResult, TError, TData>(
    (() => {
      const { queryKey: optionsQueryKey, ...restOptions } = options;
      return {
        queryKey:
          (optionsQueryKey ?? variables === undefined)
            ? ["NetworkDeviceList.infinite"]
            : ["NetworkDeviceList.infinite", variables],
        queryFn: (metaData) =>
          graphqlFetcher<NetworkDeviceListQueryResult, NetworkDeviceListQueryVariables>(
            NetworkDeviceListDocument,
            { ...variables, ...(metaData.pageParam ?? {}) },
          )(),
        ...restOptions,
      };
    })(),
  );
};

useInfiniteNetworkDeviceListQuery.getKey = (variables?: NetworkDeviceListQueryVariables) =>
  variables === undefined
    ? ["NetworkDeviceList.infinite"]
    : ["NetworkDeviceList.infinite", variables];

useNetworkDeviceListQuery.fetcher = (
  variables?: NetworkDeviceListQueryVariables,
  options?: RequestInit["headers"],
) =>
  graphqlFetcher<NetworkDeviceListQueryResult, NetworkDeviceListQueryVariables>(
    NetworkDeviceListDocument,
    variables,
    options,
  );

export const DeviceDetailDocument = `
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

export const useDeviceDetailQuery = <TData = DeviceDetailQueryResult, TError = unknown>(
  variables: DeviceDetailQueryVariables,
  options?: Omit<UseQueryOptions<DeviceDetailQueryResult, TError, TData>, "queryKey"> & {
    queryKey?: UseQueryOptions<DeviceDetailQueryResult, TError, TData>["queryKey"];
  },
) => {
  return useQuery<DeviceDetailQueryResult, TError, TData>({
    queryKey: ["DeviceDetail", variables],
    queryFn: graphqlFetcher<DeviceDetailQueryResult, DeviceDetailQueryVariables>(
      DeviceDetailDocument,
      variables,
    ),
    ...options,
  });
};

useDeviceDetailQuery.getKey = (variables: DeviceDetailQueryVariables) => [
  "DeviceDetail",
  variables,
];

export const useInfiniteDeviceDetailQuery = <
  TData = InfiniteData<DeviceDetailQueryResult>,
  TError = unknown,
>(
  variables: DeviceDetailQueryVariables,
  options: Omit<UseInfiniteQueryOptions<DeviceDetailQueryResult, TError, TData>, "queryKey"> & {
    queryKey?: UseInfiniteQueryOptions<DeviceDetailQueryResult, TError, TData>["queryKey"];
  },
) => {
  return useInfiniteQuery<DeviceDetailQueryResult, TError, TData>(
    (() => {
      const { queryKey: optionsQueryKey, ...restOptions } = options;
      return {
        queryKey: optionsQueryKey ?? ["DeviceDetail.infinite", variables],
        queryFn: (metaData) =>
          graphqlFetcher<DeviceDetailQueryResult, DeviceDetailQueryVariables>(
            DeviceDetailDocument,
            { ...variables, ...(metaData.pageParam ?? {}) },
          )(),
        ...restOptions,
      };
    })(),
  );
};

useInfiniteDeviceDetailQuery.getKey = (variables: DeviceDetailQueryVariables) => [
  "DeviceDetail.infinite",
  variables,
];

useDeviceDetailQuery.fetcher = (
  variables: DeviceDetailQueryVariables,
  options?: RequestInit["headers"],
) =>
  graphqlFetcher<DeviceDetailQueryResult, DeviceDetailQueryVariables>(
    DeviceDetailDocument,
    variables,
    options,
  );

export const DeviceTrafficDocument = `
    query DeviceTraffic($deviceId: String!, $deviceType: DeviceTypeEnum!, $includeInterfaces: Boolean = false) {
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

export const useDeviceTrafficQuery = <TData = DeviceTrafficQueryResult, TError = unknown>(
  variables: DeviceTrafficQueryVariables,
  options?: Omit<UseQueryOptions<DeviceTrafficQueryResult, TError, TData>, "queryKey"> & {
    queryKey?: UseQueryOptions<DeviceTrafficQueryResult, TError, TData>["queryKey"];
  },
) => {
  return useQuery<DeviceTrafficQueryResult, TError, TData>({
    queryKey: ["DeviceTraffic", variables],
    queryFn: graphqlFetcher<DeviceTrafficQueryResult, DeviceTrafficQueryVariables>(
      DeviceTrafficDocument,
      variables,
    ),
    ...options,
  });
};

useDeviceTrafficQuery.getKey = (variables: DeviceTrafficQueryVariables) => [
  "DeviceTraffic",
  variables,
];

export const useInfiniteDeviceTrafficQuery = <
  TData = InfiniteData<DeviceTrafficQueryResult>,
  TError = unknown,
>(
  variables: DeviceTrafficQueryVariables,
  options: Omit<UseInfiniteQueryOptions<DeviceTrafficQueryResult, TError, TData>, "queryKey"> & {
    queryKey?: UseInfiniteQueryOptions<DeviceTrafficQueryResult, TError, TData>["queryKey"];
  },
) => {
  return useInfiniteQuery<DeviceTrafficQueryResult, TError, TData>(
    (() => {
      const { queryKey: optionsQueryKey, ...restOptions } = options;
      return {
        queryKey: optionsQueryKey ?? ["DeviceTraffic.infinite", variables],
        queryFn: (metaData) =>
          graphqlFetcher<DeviceTrafficQueryResult, DeviceTrafficQueryVariables>(
            DeviceTrafficDocument,
            { ...variables, ...(metaData.pageParam ?? {}) },
          )(),
        ...restOptions,
      };
    })(),
  );
};

useInfiniteDeviceTrafficQuery.getKey = (variables: DeviceTrafficQueryVariables) => [
  "DeviceTraffic.infinite",
  variables,
];

useDeviceTrafficQuery.fetcher = (
  variables: DeviceTrafficQueryVariables,
  options?: RequestInit["headers"],
) =>
  graphqlFetcher<DeviceTrafficQueryResult, DeviceTrafficQueryVariables>(
    DeviceTrafficDocument,
    variables,
    options,
  );

export const NetworkAlertListDocument = `
    query NetworkAlertList($page: Int = 1, $pageSize: Int = 50, $severity: AlertSeverityEnum, $activeOnly: Boolean = true, $deviceId: String, $deviceType: DeviceTypeEnum) {
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

export const useNetworkAlertListQuery = <TData = NetworkAlertListQueryResult, TError = unknown>(
  variables?: NetworkAlertListQueryVariables,
  options?: Omit<UseQueryOptions<NetworkAlertListQueryResult, TError, TData>, "queryKey"> & {
    queryKey?: UseQueryOptions<NetworkAlertListQueryResult, TError, TData>["queryKey"];
  },
) => {
  return useQuery<NetworkAlertListQueryResult, TError, TData>({
    queryKey: variables === undefined ? ["NetworkAlertList"] : ["NetworkAlertList", variables],
    queryFn: graphqlFetcher<NetworkAlertListQueryResult, NetworkAlertListQueryVariables>(
      NetworkAlertListDocument,
      variables,
    ),
    ...options,
  });
};

useNetworkAlertListQuery.getKey = (variables?: NetworkAlertListQueryVariables) =>
  variables === undefined ? ["NetworkAlertList"] : ["NetworkAlertList", variables];

export const useInfiniteNetworkAlertListQuery = <
  TData = InfiniteData<NetworkAlertListQueryResult>,
  TError = unknown,
>(
  variables: NetworkAlertListQueryVariables,
  options: Omit<UseInfiniteQueryOptions<NetworkAlertListQueryResult, TError, TData>, "queryKey"> & {
    queryKey?: UseInfiniteQueryOptions<NetworkAlertListQueryResult, TError, TData>["queryKey"];
  },
) => {
  return useInfiniteQuery<NetworkAlertListQueryResult, TError, TData>(
    (() => {
      const { queryKey: optionsQueryKey, ...restOptions } = options;
      return {
        queryKey:
          (optionsQueryKey ?? variables === undefined)
            ? ["NetworkAlertList.infinite"]
            : ["NetworkAlertList.infinite", variables],
        queryFn: (metaData) =>
          graphqlFetcher<NetworkAlertListQueryResult, NetworkAlertListQueryVariables>(
            NetworkAlertListDocument,
            { ...variables, ...(metaData.pageParam ?? {}) },
          )(),
        ...restOptions,
      };
    })(),
  );
};

useInfiniteNetworkAlertListQuery.getKey = (variables?: NetworkAlertListQueryVariables) =>
  variables === undefined
    ? ["NetworkAlertList.infinite"]
    : ["NetworkAlertList.infinite", variables];

useNetworkAlertListQuery.fetcher = (
  variables?: NetworkAlertListQueryVariables,
  options?: RequestInit["headers"],
) =>
  graphqlFetcher<NetworkAlertListQueryResult, NetworkAlertListQueryVariables>(
    NetworkAlertListDocument,
    variables,
    options,
  );

export const NetworkAlertDetailDocument = `
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

export const useNetworkAlertDetailQuery = <TData = NetworkAlertDetailQueryResult, TError = unknown>(
  variables: NetworkAlertDetailQueryVariables,
  options?: Omit<UseQueryOptions<NetworkAlertDetailQueryResult, TError, TData>, "queryKey"> & {
    queryKey?: UseQueryOptions<NetworkAlertDetailQueryResult, TError, TData>["queryKey"];
  },
) => {
  return useQuery<NetworkAlertDetailQueryResult, TError, TData>({
    queryKey: ["NetworkAlertDetail", variables],
    queryFn: graphqlFetcher<NetworkAlertDetailQueryResult, NetworkAlertDetailQueryVariables>(
      NetworkAlertDetailDocument,
      variables,
    ),
    ...options,
  });
};

useNetworkAlertDetailQuery.getKey = (variables: NetworkAlertDetailQueryVariables) => [
  "NetworkAlertDetail",
  variables,
];

export const useInfiniteNetworkAlertDetailQuery = <
  TData = InfiniteData<NetworkAlertDetailQueryResult>,
  TError = unknown,
>(
  variables: NetworkAlertDetailQueryVariables,
  options: Omit<
    UseInfiniteQueryOptions<NetworkAlertDetailQueryResult, TError, TData>,
    "queryKey"
  > & {
    queryKey?: UseInfiniteQueryOptions<NetworkAlertDetailQueryResult, TError, TData>["queryKey"];
  },
) => {
  return useInfiniteQuery<NetworkAlertDetailQueryResult, TError, TData>(
    (() => {
      const { queryKey: optionsQueryKey, ...restOptions } = options;
      return {
        queryKey: optionsQueryKey ?? ["NetworkAlertDetail.infinite", variables],
        queryFn: (metaData) =>
          graphqlFetcher<NetworkAlertDetailQueryResult, NetworkAlertDetailQueryVariables>(
            NetworkAlertDetailDocument,
            { ...variables, ...(metaData.pageParam ?? {}) },
          )(),
        ...restOptions,
      };
    })(),
  );
};

useInfiniteNetworkAlertDetailQuery.getKey = (variables: NetworkAlertDetailQueryVariables) => [
  "NetworkAlertDetail.infinite",
  variables,
];

useNetworkAlertDetailQuery.fetcher = (
  variables: NetworkAlertDetailQueryVariables,
  options?: RequestInit["headers"],
) =>
  graphqlFetcher<NetworkAlertDetailQueryResult, NetworkAlertDetailQueryVariables>(
    NetworkAlertDetailDocument,
    variables,
    options,
  );

export const NetworkDashboardDocument = `
    query NetworkDashboard($devicePage: Int = 1, $devicePageSize: Int = 10, $deviceType: DeviceTypeEnum, $deviceStatus: DeviceStatusEnum, $alertPage: Int = 1, $alertPageSize: Int = 20, $alertSeverity: AlertSeverityEnum) {
  networkOverview {
    totalDevices
    onlineDevices
    offlineDevices
    activeAlerts
    criticalAlerts
    warningAlerts
    totalBandwidthGbps
    uptimePercentage
    dataSourceStatus {
      name
      status
    }
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

export const useNetworkDashboardQuery = <TData = NetworkDashboardQueryResult, TError = unknown>(
  variables?: NetworkDashboardQueryVariables,
  options?: Omit<UseQueryOptions<NetworkDashboardQueryResult, TError, TData>, "queryKey"> & {
    queryKey?: UseQueryOptions<NetworkDashboardQueryResult, TError, TData>["queryKey"];
  },
) => {
  return useQuery<NetworkDashboardQueryResult, TError, TData>({
    queryKey: variables === undefined ? ["NetworkDashboard"] : ["NetworkDashboard", variables],
    queryFn: graphqlFetcher<NetworkDashboardQueryResult, NetworkDashboardQueryVariables>(
      NetworkDashboardDocument,
      variables,
    ),
    ...options,
  });
};

useNetworkDashboardQuery.getKey = (variables?: NetworkDashboardQueryVariables) =>
  variables === undefined ? ["NetworkDashboard"] : ["NetworkDashboard", variables];

export const useInfiniteNetworkDashboardQuery = <
  TData = InfiniteData<NetworkDashboardQueryResult>,
  TError = unknown,
>(
  variables: NetworkDashboardQueryVariables,
  options: Omit<UseInfiniteQueryOptions<NetworkDashboardQueryResult, TError, TData>, "queryKey"> & {
    queryKey?: UseInfiniteQueryOptions<NetworkDashboardQueryResult, TError, TData>["queryKey"];
  },
) => {
  return useInfiniteQuery<NetworkDashboardQueryResult, TError, TData>(
    (() => {
      const { queryKey: optionsQueryKey, ...restOptions } = options;
      return {
        queryKey:
          (optionsQueryKey ?? variables === undefined)
            ? ["NetworkDashboard.infinite"]
            : ["NetworkDashboard.infinite", variables],
        queryFn: (metaData) =>
          graphqlFetcher<NetworkDashboardQueryResult, NetworkDashboardQueryVariables>(
            NetworkDashboardDocument,
            { ...variables, ...(metaData.pageParam ?? {}) },
          )(),
        ...restOptions,
      };
    })(),
  );
};

useInfiniteNetworkDashboardQuery.getKey = (variables?: NetworkDashboardQueryVariables) =>
  variables === undefined
    ? ["NetworkDashboard.infinite"]
    : ["NetworkDashboard.infinite", variables];

useNetworkDashboardQuery.fetcher = (
  variables?: NetworkDashboardQueryVariables,
  options?: RequestInit["headers"],
) =>
  graphqlFetcher<NetworkDashboardQueryResult, NetworkDashboardQueryVariables>(
    NetworkDashboardDocument,
    variables,
    options,
  );

export const DeviceUpdatesDocument = `
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
export const NetworkAlertUpdatesDocument = `
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
export const SubscriberDashboardDocument = `
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

export const useSubscriberDashboardQuery = <
  TData = SubscriberDashboardQueryResult,
  TError = unknown,
>(
  variables?: SubscriberDashboardQueryVariables,
  options?: Omit<UseQueryOptions<SubscriberDashboardQueryResult, TError, TData>, "queryKey"> & {
    queryKey?: UseQueryOptions<SubscriberDashboardQueryResult, TError, TData>["queryKey"];
  },
) => {
  return useQuery<SubscriberDashboardQueryResult, TError, TData>({
    queryKey:
      variables === undefined ? ["SubscriberDashboard"] : ["SubscriberDashboard", variables],
    queryFn: graphqlFetcher<SubscriberDashboardQueryResult, SubscriberDashboardQueryVariables>(
      SubscriberDashboardDocument,
      variables,
    ),
    ...options,
  });
};

useSubscriberDashboardQuery.getKey = (variables?: SubscriberDashboardQueryVariables) =>
  variables === undefined ? ["SubscriberDashboard"] : ["SubscriberDashboard", variables];

export const useInfiniteSubscriberDashboardQuery = <
  TData = InfiniteData<SubscriberDashboardQueryResult>,
  TError = unknown,
>(
  variables: SubscriberDashboardQueryVariables,
  options: Omit<
    UseInfiniteQueryOptions<SubscriberDashboardQueryResult, TError, TData>,
    "queryKey"
  > & {
    queryKey?: UseInfiniteQueryOptions<SubscriberDashboardQueryResult, TError, TData>["queryKey"];
  },
) => {
  return useInfiniteQuery<SubscriberDashboardQueryResult, TError, TData>(
    (() => {
      const { queryKey: optionsQueryKey, ...restOptions } = options;
      return {
        queryKey:
          (optionsQueryKey ?? variables === undefined)
            ? ["SubscriberDashboard.infinite"]
            : ["SubscriberDashboard.infinite", variables],
        queryFn: (metaData) =>
          graphqlFetcher<SubscriberDashboardQueryResult, SubscriberDashboardQueryVariables>(
            SubscriberDashboardDocument,
            { ...variables, ...(metaData.pageParam ?? {}) },
          )(),
        ...restOptions,
      };
    })(),
  );
};

useInfiniteSubscriberDashboardQuery.getKey = (variables?: SubscriberDashboardQueryVariables) =>
  variables === undefined
    ? ["SubscriberDashboard.infinite"]
    : ["SubscriberDashboard.infinite", variables];

useSubscriberDashboardQuery.fetcher = (
  variables?: SubscriberDashboardQueryVariables,
  options?: RequestInit["headers"],
) =>
  graphqlFetcher<SubscriberDashboardQueryResult, SubscriberDashboardQueryVariables>(
    SubscriberDashboardDocument,
    variables,
    options,
  );

export const SubscriberDocument = `
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

export const useSubscriberQuery = <TData = SubscriberQueryResult, TError = unknown>(
  variables: SubscriberQueryVariables,
  options?: Omit<UseQueryOptions<SubscriberQueryResult, TError, TData>, "queryKey"> & {
    queryKey?: UseQueryOptions<SubscriberQueryResult, TError, TData>["queryKey"];
  },
) => {
  return useQuery<SubscriberQueryResult, TError, TData>({
    queryKey: ["Subscriber", variables],
    queryFn: graphqlFetcher<SubscriberQueryResult, SubscriberQueryVariables>(
      SubscriberDocument,
      variables,
    ),
    ...options,
  });
};

useSubscriberQuery.getKey = (variables: SubscriberQueryVariables) => ["Subscriber", variables];

export const useInfiniteSubscriberQuery = <
  TData = InfiniteData<SubscriberQueryResult>,
  TError = unknown,
>(
  variables: SubscriberQueryVariables,
  options: Omit<UseInfiniteQueryOptions<SubscriberQueryResult, TError, TData>, "queryKey"> & {
    queryKey?: UseInfiniteQueryOptions<SubscriberQueryResult, TError, TData>["queryKey"];
  },
) => {
  return useInfiniteQuery<SubscriberQueryResult, TError, TData>(
    (() => {
      const { queryKey: optionsQueryKey, ...restOptions } = options;
      return {
        queryKey: optionsQueryKey ?? ["Subscriber.infinite", variables],
        queryFn: (metaData) =>
          graphqlFetcher<SubscriberQueryResult, SubscriberQueryVariables>(SubscriberDocument, {
            ...variables,
            ...(metaData.pageParam ?? {}),
          })(),
        ...restOptions,
      };
    })(),
  );
};

useInfiniteSubscriberQuery.getKey = (variables: SubscriberQueryVariables) => [
  "Subscriber.infinite",
  variables,
];

useSubscriberQuery.fetcher = (
  variables: SubscriberQueryVariables,
  options?: RequestInit["headers"],
) =>
  graphqlFetcher<SubscriberQueryResult, SubscriberQueryVariables>(
    SubscriberDocument,
    variables,
    options,
  );

export const ActiveSessionsDocument = `
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

export const useActiveSessionsQuery = <TData = ActiveSessionsQueryResult, TError = unknown>(
  variables?: ActiveSessionsQueryVariables,
  options?: Omit<UseQueryOptions<ActiveSessionsQueryResult, TError, TData>, "queryKey"> & {
    queryKey?: UseQueryOptions<ActiveSessionsQueryResult, TError, TData>["queryKey"];
  },
) => {
  return useQuery<ActiveSessionsQueryResult, TError, TData>({
    queryKey: variables === undefined ? ["ActiveSessions"] : ["ActiveSessions", variables],
    queryFn: graphqlFetcher<ActiveSessionsQueryResult, ActiveSessionsQueryVariables>(
      ActiveSessionsDocument,
      variables,
    ),
    ...options,
  });
};

useActiveSessionsQuery.getKey = (variables?: ActiveSessionsQueryVariables) =>
  variables === undefined ? ["ActiveSessions"] : ["ActiveSessions", variables];

export const useInfiniteActiveSessionsQuery = <
  TData = InfiniteData<ActiveSessionsQueryResult>,
  TError = unknown,
>(
  variables: ActiveSessionsQueryVariables,
  options: Omit<UseInfiniteQueryOptions<ActiveSessionsQueryResult, TError, TData>, "queryKey"> & {
    queryKey?: UseInfiniteQueryOptions<ActiveSessionsQueryResult, TError, TData>["queryKey"];
  },
) => {
  return useInfiniteQuery<ActiveSessionsQueryResult, TError, TData>(
    (() => {
      const { queryKey: optionsQueryKey, ...restOptions } = options;
      return {
        queryKey:
          (optionsQueryKey ?? variables === undefined)
            ? ["ActiveSessions.infinite"]
            : ["ActiveSessions.infinite", variables],
        queryFn: (metaData) =>
          graphqlFetcher<ActiveSessionsQueryResult, ActiveSessionsQueryVariables>(
            ActiveSessionsDocument,
            { ...variables, ...(metaData.pageParam ?? {}) },
          )(),
        ...restOptions,
      };
    })(),
  );
};

useInfiniteActiveSessionsQuery.getKey = (variables?: ActiveSessionsQueryVariables) =>
  variables === undefined ? ["ActiveSessions.infinite"] : ["ActiveSessions.infinite", variables];

useActiveSessionsQuery.fetcher = (
  variables?: ActiveSessionsQueryVariables,
  options?: RequestInit["headers"],
) =>
  graphqlFetcher<ActiveSessionsQueryResult, ActiveSessionsQueryVariables>(
    ActiveSessionsDocument,
    variables,
    options,
  );

export const SubscriberMetricsDocument = `
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

export const useSubscriberMetricsQuery = <TData = SubscriberMetricsQueryResult, TError = unknown>(
  variables?: SubscriberMetricsQueryVariables,
  options?: Omit<UseQueryOptions<SubscriberMetricsQueryResult, TError, TData>, "queryKey"> & {
    queryKey?: UseQueryOptions<SubscriberMetricsQueryResult, TError, TData>["queryKey"];
  },
) => {
  return useQuery<SubscriberMetricsQueryResult, TError, TData>({
    queryKey: variables === undefined ? ["SubscriberMetrics"] : ["SubscriberMetrics", variables],
    queryFn: graphqlFetcher<SubscriberMetricsQueryResult, SubscriberMetricsQueryVariables>(
      SubscriberMetricsDocument,
      variables,
    ),
    ...options,
  });
};

useSubscriberMetricsQuery.getKey = (variables?: SubscriberMetricsQueryVariables) =>
  variables === undefined ? ["SubscriberMetrics"] : ["SubscriberMetrics", variables];

export const useInfiniteSubscriberMetricsQuery = <
  TData = InfiniteData<SubscriberMetricsQueryResult>,
  TError = unknown,
>(
  variables: SubscriberMetricsQueryVariables,
  options: Omit<
    UseInfiniteQueryOptions<SubscriberMetricsQueryResult, TError, TData>,
    "queryKey"
  > & {
    queryKey?: UseInfiniteQueryOptions<SubscriberMetricsQueryResult, TError, TData>["queryKey"];
  },
) => {
  return useInfiniteQuery<SubscriberMetricsQueryResult, TError, TData>(
    (() => {
      const { queryKey: optionsQueryKey, ...restOptions } = options;
      return {
        queryKey:
          (optionsQueryKey ?? variables === undefined)
            ? ["SubscriberMetrics.infinite"]
            : ["SubscriberMetrics.infinite", variables],
        queryFn: (metaData) =>
          graphqlFetcher<SubscriberMetricsQueryResult, SubscriberMetricsQueryVariables>(
            SubscriberMetricsDocument,
            { ...variables, ...(metaData.pageParam ?? {}) },
          )(),
        ...restOptions,
      };
    })(),
  );
};

useInfiniteSubscriberMetricsQuery.getKey = (variables?: SubscriberMetricsQueryVariables) =>
  variables === undefined
    ? ["SubscriberMetrics.infinite"]
    : ["SubscriberMetrics.infinite", variables];

useSubscriberMetricsQuery.fetcher = (
  variables?: SubscriberMetricsQueryVariables,
  options?: RequestInit["headers"],
) =>
  graphqlFetcher<SubscriberMetricsQueryResult, SubscriberMetricsQueryVariables>(
    SubscriberMetricsDocument,
    variables,
    options,
  );

export const SubscriptionListDocument = `
    query SubscriptionList($page: Int = 1, $pageSize: Int = 10, $status: SubscriptionStatusEnum, $billingCycle: BillingCycleEnum, $search: String, $includeCustomer: Boolean = true, $includePlan: Boolean = true, $includeInvoices: Boolean = false) {
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

export const useSubscriptionListQuery = <TData = SubscriptionListQueryResult, TError = unknown>(
  variables?: SubscriptionListQueryVariables,
  options?: Omit<UseQueryOptions<SubscriptionListQueryResult, TError, TData>, "queryKey"> & {
    queryKey?: UseQueryOptions<SubscriptionListQueryResult, TError, TData>["queryKey"];
  },
) => {
  return useQuery<SubscriptionListQueryResult, TError, TData>({
    queryKey: variables === undefined ? ["SubscriptionList"] : ["SubscriptionList", variables],
    queryFn: graphqlFetcher<SubscriptionListQueryResult, SubscriptionListQueryVariables>(
      SubscriptionListDocument,
      variables,
    ),
    ...options,
  });
};

useSubscriptionListQuery.getKey = (variables?: SubscriptionListQueryVariables) =>
  variables === undefined ? ["SubscriptionList"] : ["SubscriptionList", variables];

export const useInfiniteSubscriptionListQuery = <
  TData = InfiniteData<SubscriptionListQueryResult>,
  TError = unknown,
>(
  variables: SubscriptionListQueryVariables,
  options: Omit<UseInfiniteQueryOptions<SubscriptionListQueryResult, TError, TData>, "queryKey"> & {
    queryKey?: UseInfiniteQueryOptions<SubscriptionListQueryResult, TError, TData>["queryKey"];
  },
) => {
  return useInfiniteQuery<SubscriptionListQueryResult, TError, TData>(
    (() => {
      const { queryKey: optionsQueryKey, ...restOptions } = options;
      return {
        queryKey:
          (optionsQueryKey ?? variables === undefined)
            ? ["SubscriptionList.infinite"]
            : ["SubscriptionList.infinite", variables],
        queryFn: (metaData) =>
          graphqlFetcher<SubscriptionListQueryResult, SubscriptionListQueryVariables>(
            SubscriptionListDocument,
            { ...variables, ...(metaData.pageParam ?? {}) },
          )(),
        ...restOptions,
      };
    })(),
  );
};

useInfiniteSubscriptionListQuery.getKey = (variables?: SubscriptionListQueryVariables) =>
  variables === undefined
    ? ["SubscriptionList.infinite"]
    : ["SubscriptionList.infinite", variables];

useSubscriptionListQuery.fetcher = (
  variables?: SubscriptionListQueryVariables,
  options?: RequestInit["headers"],
) =>
  graphqlFetcher<SubscriptionListQueryResult, SubscriptionListQueryVariables>(
    SubscriptionListDocument,
    variables,
    options,
  );

export const SubscriptionDetailDocument = `
    query SubscriptionDetail($id: ID!) {
  subscription(
    id: $id
    includeCustomer: true
    includePlan: true
    includeInvoices: true
  ) {
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

export const useSubscriptionDetailQuery = <TData = SubscriptionDetailQueryResult, TError = unknown>(
  variables: SubscriptionDetailQueryVariables,
  options?: Omit<UseQueryOptions<SubscriptionDetailQueryResult, TError, TData>, "queryKey"> & {
    queryKey?: UseQueryOptions<SubscriptionDetailQueryResult, TError, TData>["queryKey"];
  },
) => {
  return useQuery<SubscriptionDetailQueryResult, TError, TData>({
    queryKey: ["SubscriptionDetail", variables],
    queryFn: graphqlFetcher<SubscriptionDetailQueryResult, SubscriptionDetailQueryVariables>(
      SubscriptionDetailDocument,
      variables,
    ),
    ...options,
  });
};

useSubscriptionDetailQuery.getKey = (variables: SubscriptionDetailQueryVariables) => [
  "SubscriptionDetail",
  variables,
];

export const useInfiniteSubscriptionDetailQuery = <
  TData = InfiniteData<SubscriptionDetailQueryResult>,
  TError = unknown,
>(
  variables: SubscriptionDetailQueryVariables,
  options: Omit<
    UseInfiniteQueryOptions<SubscriptionDetailQueryResult, TError, TData>,
    "queryKey"
  > & {
    queryKey?: UseInfiniteQueryOptions<SubscriptionDetailQueryResult, TError, TData>["queryKey"];
  },
) => {
  return useInfiniteQuery<SubscriptionDetailQueryResult, TError, TData>(
    (() => {
      const { queryKey: optionsQueryKey, ...restOptions } = options;
      return {
        queryKey: optionsQueryKey ?? ["SubscriptionDetail.infinite", variables],
        queryFn: (metaData) =>
          graphqlFetcher<SubscriptionDetailQueryResult, SubscriptionDetailQueryVariables>(
            SubscriptionDetailDocument,
            { ...variables, ...(metaData.pageParam ?? {}) },
          )(),
        ...restOptions,
      };
    })(),
  );
};

useInfiniteSubscriptionDetailQuery.getKey = (variables: SubscriptionDetailQueryVariables) => [
  "SubscriptionDetail.infinite",
  variables,
];

useSubscriptionDetailQuery.fetcher = (
  variables: SubscriptionDetailQueryVariables,
  options?: RequestInit["headers"],
) =>
  graphqlFetcher<SubscriptionDetailQueryResult, SubscriptionDetailQueryVariables>(
    SubscriptionDetailDocument,
    variables,
    options,
  );

export const SubscriptionMetricsDocument = `
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

export const useSubscriptionMetricsQuery = <
  TData = SubscriptionMetricsQueryResult,
  TError = unknown,
>(
  variables?: SubscriptionMetricsQueryVariables,
  options?: Omit<UseQueryOptions<SubscriptionMetricsQueryResult, TError, TData>, "queryKey"> & {
    queryKey?: UseQueryOptions<SubscriptionMetricsQueryResult, TError, TData>["queryKey"];
  },
) => {
  return useQuery<SubscriptionMetricsQueryResult, TError, TData>({
    queryKey:
      variables === undefined ? ["SubscriptionMetrics"] : ["SubscriptionMetrics", variables],
    queryFn: graphqlFetcher<SubscriptionMetricsQueryResult, SubscriptionMetricsQueryVariables>(
      SubscriptionMetricsDocument,
      variables,
    ),
    ...options,
  });
};

useSubscriptionMetricsQuery.getKey = (variables?: SubscriptionMetricsQueryVariables) =>
  variables === undefined ? ["SubscriptionMetrics"] : ["SubscriptionMetrics", variables];

export const useInfiniteSubscriptionMetricsQuery = <
  TData = InfiniteData<SubscriptionMetricsQueryResult>,
  TError = unknown,
>(
  variables: SubscriptionMetricsQueryVariables,
  options: Omit<
    UseInfiniteQueryOptions<SubscriptionMetricsQueryResult, TError, TData>,
    "queryKey"
  > & {
    queryKey?: UseInfiniteQueryOptions<SubscriptionMetricsQueryResult, TError, TData>["queryKey"];
  },
) => {
  return useInfiniteQuery<SubscriptionMetricsQueryResult, TError, TData>(
    (() => {
      const { queryKey: optionsQueryKey, ...restOptions } = options;
      return {
        queryKey:
          (optionsQueryKey ?? variables === undefined)
            ? ["SubscriptionMetrics.infinite"]
            : ["SubscriptionMetrics.infinite", variables],
        queryFn: (metaData) =>
          graphqlFetcher<SubscriptionMetricsQueryResult, SubscriptionMetricsQueryVariables>(
            SubscriptionMetricsDocument,
            { ...variables, ...(metaData.pageParam ?? {}) },
          )(),
        ...restOptions,
      };
    })(),
  );
};

useInfiniteSubscriptionMetricsQuery.getKey = (variables?: SubscriptionMetricsQueryVariables) =>
  variables === undefined
    ? ["SubscriptionMetrics.infinite"]
    : ["SubscriptionMetrics.infinite", variables];

useSubscriptionMetricsQuery.fetcher = (
  variables?: SubscriptionMetricsQueryVariables,
  options?: RequestInit["headers"],
) =>
  graphqlFetcher<SubscriptionMetricsQueryResult, SubscriptionMetricsQueryVariables>(
    SubscriptionMetricsDocument,
    variables,
    options,
  );

export const PlanListDocument = `
    query PlanList($page: Int = 1, $pageSize: Int = 20, $isActive: Boolean, $billingCycle: BillingCycleEnum) {
  plans(
    page: $page
    pageSize: $pageSize
    isActive: $isActive
    billingCycle: $billingCycle
  ) {
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

export const usePlanListQuery = <TData = PlanListQueryResult, TError = unknown>(
  variables?: PlanListQueryVariables,
  options?: Omit<UseQueryOptions<PlanListQueryResult, TError, TData>, "queryKey"> & {
    queryKey?: UseQueryOptions<PlanListQueryResult, TError, TData>["queryKey"];
  },
) => {
  return useQuery<PlanListQueryResult, TError, TData>({
    queryKey: variables === undefined ? ["PlanList"] : ["PlanList", variables],
    queryFn: graphqlFetcher<PlanListQueryResult, PlanListQueryVariables>(
      PlanListDocument,
      variables,
    ),
    ...options,
  });
};

usePlanListQuery.getKey = (variables?: PlanListQueryVariables) =>
  variables === undefined ? ["PlanList"] : ["PlanList", variables];

export const useInfinitePlanListQuery = <
  TData = InfiniteData<PlanListQueryResult>,
  TError = unknown,
>(
  variables: PlanListQueryVariables,
  options: Omit<UseInfiniteQueryOptions<PlanListQueryResult, TError, TData>, "queryKey"> & {
    queryKey?: UseInfiniteQueryOptions<PlanListQueryResult, TError, TData>["queryKey"];
  },
) => {
  return useInfiniteQuery<PlanListQueryResult, TError, TData>(
    (() => {
      const { queryKey: optionsQueryKey, ...restOptions } = options;
      return {
        queryKey:
          (optionsQueryKey ?? variables === undefined)
            ? ["PlanList.infinite"]
            : ["PlanList.infinite", variables],
        queryFn: (metaData) =>
          graphqlFetcher<PlanListQueryResult, PlanListQueryVariables>(PlanListDocument, {
            ...variables,
            ...(metaData.pageParam ?? {}),
          })(),
        ...restOptions,
      };
    })(),
  );
};

useInfinitePlanListQuery.getKey = (variables?: PlanListQueryVariables) =>
  variables === undefined ? ["PlanList.infinite"] : ["PlanList.infinite", variables];

usePlanListQuery.fetcher = (variables?: PlanListQueryVariables, options?: RequestInit["headers"]) =>
  graphqlFetcher<PlanListQueryResult, PlanListQueryVariables>(PlanListDocument, variables, options);

export const ProductListDocument = `
    query ProductList($page: Int = 1, $pageSize: Int = 20, $isActive: Boolean, $category: String) {
  products(
    page: $page
    pageSize: $pageSize
    isActive: $isActive
    category: $category
  ) {
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

export const useProductListQuery = <TData = ProductListQueryResult, TError = unknown>(
  variables?: ProductListQueryVariables,
  options?: Omit<UseQueryOptions<ProductListQueryResult, TError, TData>, "queryKey"> & {
    queryKey?: UseQueryOptions<ProductListQueryResult, TError, TData>["queryKey"];
  },
) => {
  return useQuery<ProductListQueryResult, TError, TData>({
    queryKey: variables === undefined ? ["ProductList"] : ["ProductList", variables],
    queryFn: graphqlFetcher<ProductListQueryResult, ProductListQueryVariables>(
      ProductListDocument,
      variables,
    ),
    ...options,
  });
};

useProductListQuery.getKey = (variables?: ProductListQueryVariables) =>
  variables === undefined ? ["ProductList"] : ["ProductList", variables];

export const useInfiniteProductListQuery = <
  TData = InfiniteData<ProductListQueryResult>,
  TError = unknown,
>(
  variables: ProductListQueryVariables,
  options: Omit<UseInfiniteQueryOptions<ProductListQueryResult, TError, TData>, "queryKey"> & {
    queryKey?: UseInfiniteQueryOptions<ProductListQueryResult, TError, TData>["queryKey"];
  },
) => {
  return useInfiniteQuery<ProductListQueryResult, TError, TData>(
    (() => {
      const { queryKey: optionsQueryKey, ...restOptions } = options;
      return {
        queryKey:
          (optionsQueryKey ?? variables === undefined)
            ? ["ProductList.infinite"]
            : ["ProductList.infinite", variables],
        queryFn: (metaData) =>
          graphqlFetcher<ProductListQueryResult, ProductListQueryVariables>(ProductListDocument, {
            ...variables,
            ...(metaData.pageParam ?? {}),
          })(),
        ...restOptions,
      };
    })(),
  );
};

useInfiniteProductListQuery.getKey = (variables?: ProductListQueryVariables) =>
  variables === undefined ? ["ProductList.infinite"] : ["ProductList.infinite", variables];

useProductListQuery.fetcher = (
  variables?: ProductListQueryVariables,
  options?: RequestInit["headers"],
) =>
  graphqlFetcher<ProductListQueryResult, ProductListQueryVariables>(
    ProductListDocument,
    variables,
    options,
  );

export const SubscriptionDashboardDocument = `
    query SubscriptionDashboard($page: Int = 1, $pageSize: Int = 10, $status: SubscriptionStatusEnum, $search: String) {
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

export const useSubscriptionDashboardQuery = <
  TData = SubscriptionDashboardQueryResult,
  TError = unknown,
>(
  variables?: SubscriptionDashboardQueryVariables,
  options?: Omit<UseQueryOptions<SubscriptionDashboardQueryResult, TError, TData>, "queryKey"> & {
    queryKey?: UseQueryOptions<SubscriptionDashboardQueryResult, TError, TData>["queryKey"];
  },
) => {
  return useQuery<SubscriptionDashboardQueryResult, TError, TData>({
    queryKey:
      variables === undefined ? ["SubscriptionDashboard"] : ["SubscriptionDashboard", variables],
    queryFn: graphqlFetcher<SubscriptionDashboardQueryResult, SubscriptionDashboardQueryVariables>(
      SubscriptionDashboardDocument,
      variables,
    ),
    ...options,
  });
};

useSubscriptionDashboardQuery.getKey = (variables?: SubscriptionDashboardQueryVariables) =>
  variables === undefined ? ["SubscriptionDashboard"] : ["SubscriptionDashboard", variables];

export const useInfiniteSubscriptionDashboardQuery = <
  TData = InfiniteData<SubscriptionDashboardQueryResult>,
  TError = unknown,
>(
  variables: SubscriptionDashboardQueryVariables,
  options: Omit<
    UseInfiniteQueryOptions<SubscriptionDashboardQueryResult, TError, TData>,
    "queryKey"
  > & {
    queryKey?: UseInfiniteQueryOptions<SubscriptionDashboardQueryResult, TError, TData>["queryKey"];
  },
) => {
  return useInfiniteQuery<SubscriptionDashboardQueryResult, TError, TData>(
    (() => {
      const { queryKey: optionsQueryKey, ...restOptions } = options;
      return {
        queryKey:
          (optionsQueryKey ?? variables === undefined)
            ? ["SubscriptionDashboard.infinite"]
            : ["SubscriptionDashboard.infinite", variables],
        queryFn: (metaData) =>
          graphqlFetcher<SubscriptionDashboardQueryResult, SubscriptionDashboardQueryVariables>(
            SubscriptionDashboardDocument,
            { ...variables, ...(metaData.pageParam ?? {}) },
          )(),
        ...restOptions,
      };
    })(),
  );
};

useInfiniteSubscriptionDashboardQuery.getKey = (variables?: SubscriptionDashboardQueryVariables) =>
  variables === undefined
    ? ["SubscriptionDashboard.infinite"]
    : ["SubscriptionDashboard.infinite", variables];

useSubscriptionDashboardQuery.fetcher = (
  variables?: SubscriptionDashboardQueryVariables,
  options?: RequestInit["headers"],
) =>
  graphqlFetcher<SubscriptionDashboardQueryResult, SubscriptionDashboardQueryVariables>(
    SubscriptionDashboardDocument,
    variables,
    options,
  );

export const UserListDocument = `
    query UserList($page: Int = 1, $pageSize: Int = 10, $isActive: Boolean, $isVerified: Boolean, $isSuperuser: Boolean, $isPlatformAdmin: Boolean, $search: String, $includeMetadata: Boolean = false, $includeRoles: Boolean = false, $includePermissions: Boolean = false, $includeTeams: Boolean = false) {
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

export const useUserListQuery = <TData = UserListQueryResult, TError = unknown>(
  variables?: UserListQueryVariables,
  options?: Omit<UseQueryOptions<UserListQueryResult, TError, TData>, "queryKey"> & {
    queryKey?: UseQueryOptions<UserListQueryResult, TError, TData>["queryKey"];
  },
) => {
  return useQuery<UserListQueryResult, TError, TData>({
    queryKey: variables === undefined ? ["UserList"] : ["UserList", variables],
    queryFn: graphqlFetcher<UserListQueryResult, UserListQueryVariables>(
      UserListDocument,
      variables,
    ),
    ...options,
  });
};

useUserListQuery.getKey = (variables?: UserListQueryVariables) =>
  variables === undefined ? ["UserList"] : ["UserList", variables];

export const useInfiniteUserListQuery = <
  TData = InfiniteData<UserListQueryResult>,
  TError = unknown,
>(
  variables: UserListQueryVariables,
  options: Omit<UseInfiniteQueryOptions<UserListQueryResult, TError, TData>, "queryKey"> & {
    queryKey?: UseInfiniteQueryOptions<UserListQueryResult, TError, TData>["queryKey"];
  },
) => {
  return useInfiniteQuery<UserListQueryResult, TError, TData>(
    (() => {
      const { queryKey: optionsQueryKey, ...restOptions } = options;
      return {
        queryKey:
          (optionsQueryKey ?? variables === undefined)
            ? ["UserList.infinite"]
            : ["UserList.infinite", variables],
        queryFn: (metaData) =>
          graphqlFetcher<UserListQueryResult, UserListQueryVariables>(UserListDocument, {
            ...variables,
            ...(metaData.pageParam ?? {}),
          })(),
        ...restOptions,
      };
    })(),
  );
};

useInfiniteUserListQuery.getKey = (variables?: UserListQueryVariables) =>
  variables === undefined ? ["UserList.infinite"] : ["UserList.infinite", variables];

useUserListQuery.fetcher = (variables?: UserListQueryVariables, options?: RequestInit["headers"]) =>
  graphqlFetcher<UserListQueryResult, UserListQueryVariables>(UserListDocument, variables, options);

export const UserDetailDocument = `
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

export const useUserDetailQuery = <TData = UserDetailQueryResult, TError = unknown>(
  variables: UserDetailQueryVariables,
  options?: Omit<UseQueryOptions<UserDetailQueryResult, TError, TData>, "queryKey"> & {
    queryKey?: UseQueryOptions<UserDetailQueryResult, TError, TData>["queryKey"];
  },
) => {
  return useQuery<UserDetailQueryResult, TError, TData>({
    queryKey: ["UserDetail", variables],
    queryFn: graphqlFetcher<UserDetailQueryResult, UserDetailQueryVariables>(
      UserDetailDocument,
      variables,
    ),
    ...options,
  });
};

useUserDetailQuery.getKey = (variables: UserDetailQueryVariables) => ["UserDetail", variables];

export const useInfiniteUserDetailQuery = <
  TData = InfiniteData<UserDetailQueryResult>,
  TError = unknown,
>(
  variables: UserDetailQueryVariables,
  options: Omit<UseInfiniteQueryOptions<UserDetailQueryResult, TError, TData>, "queryKey"> & {
    queryKey?: UseInfiniteQueryOptions<UserDetailQueryResult, TError, TData>["queryKey"];
  },
) => {
  return useInfiniteQuery<UserDetailQueryResult, TError, TData>(
    (() => {
      const { queryKey: optionsQueryKey, ...restOptions } = options;
      return {
        queryKey: optionsQueryKey ?? ["UserDetail.infinite", variables],
        queryFn: (metaData) =>
          graphqlFetcher<UserDetailQueryResult, UserDetailQueryVariables>(UserDetailDocument, {
            ...variables,
            ...(metaData.pageParam ?? {}),
          })(),
        ...restOptions,
      };
    })(),
  );
};

useInfiniteUserDetailQuery.getKey = (variables: UserDetailQueryVariables) => [
  "UserDetail.infinite",
  variables,
];

useUserDetailQuery.fetcher = (
  variables: UserDetailQueryVariables,
  options?: RequestInit["headers"],
) =>
  graphqlFetcher<UserDetailQueryResult, UserDetailQueryVariables>(
    UserDetailDocument,
    variables,
    options,
  );

export const UserMetricsDocument = `
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

export const useUserMetricsQuery = <TData = UserMetricsQueryResult, TError = unknown>(
  variables?: UserMetricsQueryVariables,
  options?: Omit<UseQueryOptions<UserMetricsQueryResult, TError, TData>, "queryKey"> & {
    queryKey?: UseQueryOptions<UserMetricsQueryResult, TError, TData>["queryKey"];
  },
) => {
  return useQuery<UserMetricsQueryResult, TError, TData>({
    queryKey: variables === undefined ? ["UserMetrics"] : ["UserMetrics", variables],
    queryFn: graphqlFetcher<UserMetricsQueryResult, UserMetricsQueryVariables>(
      UserMetricsDocument,
      variables,
    ),
    ...options,
  });
};

useUserMetricsQuery.getKey = (variables?: UserMetricsQueryVariables) =>
  variables === undefined ? ["UserMetrics"] : ["UserMetrics", variables];

export const useInfiniteUserMetricsQuery = <
  TData = InfiniteData<UserMetricsQueryResult>,
  TError = unknown,
>(
  variables: UserMetricsQueryVariables,
  options: Omit<UseInfiniteQueryOptions<UserMetricsQueryResult, TError, TData>, "queryKey"> & {
    queryKey?: UseInfiniteQueryOptions<UserMetricsQueryResult, TError, TData>["queryKey"];
  },
) => {
  return useInfiniteQuery<UserMetricsQueryResult, TError, TData>(
    (() => {
      const { queryKey: optionsQueryKey, ...restOptions } = options;
      return {
        queryKey:
          (optionsQueryKey ?? variables === undefined)
            ? ["UserMetrics.infinite"]
            : ["UserMetrics.infinite", variables],
        queryFn: (metaData) =>
          graphqlFetcher<UserMetricsQueryResult, UserMetricsQueryVariables>(UserMetricsDocument, {
            ...variables,
            ...(metaData.pageParam ?? {}),
          })(),
        ...restOptions,
      };
    })(),
  );
};

useInfiniteUserMetricsQuery.getKey = (variables?: UserMetricsQueryVariables) =>
  variables === undefined ? ["UserMetrics.infinite"] : ["UserMetrics.infinite", variables];

useUserMetricsQuery.fetcher = (
  variables?: UserMetricsQueryVariables,
  options?: RequestInit["headers"],
) =>
  graphqlFetcher<UserMetricsQueryResult, UserMetricsQueryVariables>(
    UserMetricsDocument,
    variables,
    options,
  );

export const RoleListDocument = `
    query RoleList($page: Int = 1, $pageSize: Int = 20, $isActive: Boolean, $isSystem: Boolean, $search: String) {
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

export const useRoleListQuery = <TData = RoleListQueryResult, TError = unknown>(
  variables?: RoleListQueryVariables,
  options?: Omit<UseQueryOptions<RoleListQueryResult, TError, TData>, "queryKey"> & {
    queryKey?: UseQueryOptions<RoleListQueryResult, TError, TData>["queryKey"];
  },
) => {
  return useQuery<RoleListQueryResult, TError, TData>({
    queryKey: variables === undefined ? ["RoleList"] : ["RoleList", variables],
    queryFn: graphqlFetcher<RoleListQueryResult, RoleListQueryVariables>(
      RoleListDocument,
      variables,
    ),
    ...options,
  });
};

useRoleListQuery.getKey = (variables?: RoleListQueryVariables) =>
  variables === undefined ? ["RoleList"] : ["RoleList", variables];

export const useInfiniteRoleListQuery = <
  TData = InfiniteData<RoleListQueryResult>,
  TError = unknown,
>(
  variables: RoleListQueryVariables,
  options: Omit<UseInfiniteQueryOptions<RoleListQueryResult, TError, TData>, "queryKey"> & {
    queryKey?: UseInfiniteQueryOptions<RoleListQueryResult, TError, TData>["queryKey"];
  },
) => {
  return useInfiniteQuery<RoleListQueryResult, TError, TData>(
    (() => {
      const { queryKey: optionsQueryKey, ...restOptions } = options;
      return {
        queryKey:
          (optionsQueryKey ?? variables === undefined)
            ? ["RoleList.infinite"]
            : ["RoleList.infinite", variables],
        queryFn: (metaData) =>
          graphqlFetcher<RoleListQueryResult, RoleListQueryVariables>(RoleListDocument, {
            ...variables,
            ...(metaData.pageParam ?? {}),
          })(),
        ...restOptions,
      };
    })(),
  );
};

useInfiniteRoleListQuery.getKey = (variables?: RoleListQueryVariables) =>
  variables === undefined ? ["RoleList.infinite"] : ["RoleList.infinite", variables];

useRoleListQuery.fetcher = (variables?: RoleListQueryVariables, options?: RequestInit["headers"]) =>
  graphqlFetcher<RoleListQueryResult, RoleListQueryVariables>(RoleListDocument, variables, options);

export const PermissionsByCategoryDocument = `
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

export const usePermissionsByCategoryQuery = <
  TData = PermissionsByCategoryQueryResult,
  TError = unknown,
>(
  variables?: PermissionsByCategoryQueryVariables,
  options?: Omit<UseQueryOptions<PermissionsByCategoryQueryResult, TError, TData>, "queryKey"> & {
    queryKey?: UseQueryOptions<PermissionsByCategoryQueryResult, TError, TData>["queryKey"];
  },
) => {
  return useQuery<PermissionsByCategoryQueryResult, TError, TData>({
    queryKey:
      variables === undefined ? ["PermissionsByCategory"] : ["PermissionsByCategory", variables],
    queryFn: graphqlFetcher<PermissionsByCategoryQueryResult, PermissionsByCategoryQueryVariables>(
      PermissionsByCategoryDocument,
      variables,
    ),
    ...options,
  });
};

usePermissionsByCategoryQuery.getKey = (variables?: PermissionsByCategoryQueryVariables) =>
  variables === undefined ? ["PermissionsByCategory"] : ["PermissionsByCategory", variables];

export const useInfinitePermissionsByCategoryQuery = <
  TData = InfiniteData<PermissionsByCategoryQueryResult>,
  TError = unknown,
>(
  variables: PermissionsByCategoryQueryVariables,
  options: Omit<
    UseInfiniteQueryOptions<PermissionsByCategoryQueryResult, TError, TData>,
    "queryKey"
  > & {
    queryKey?: UseInfiniteQueryOptions<PermissionsByCategoryQueryResult, TError, TData>["queryKey"];
  },
) => {
  return useInfiniteQuery<PermissionsByCategoryQueryResult, TError, TData>(
    (() => {
      const { queryKey: optionsQueryKey, ...restOptions } = options;
      return {
        queryKey:
          (optionsQueryKey ?? variables === undefined)
            ? ["PermissionsByCategory.infinite"]
            : ["PermissionsByCategory.infinite", variables],
        queryFn: (metaData) =>
          graphqlFetcher<PermissionsByCategoryQueryResult, PermissionsByCategoryQueryVariables>(
            PermissionsByCategoryDocument,
            { ...variables, ...(metaData.pageParam ?? {}) },
          )(),
        ...restOptions,
      };
    })(),
  );
};

useInfinitePermissionsByCategoryQuery.getKey = (variables?: PermissionsByCategoryQueryVariables) =>
  variables === undefined
    ? ["PermissionsByCategory.infinite"]
    : ["PermissionsByCategory.infinite", variables];

usePermissionsByCategoryQuery.fetcher = (
  variables?: PermissionsByCategoryQueryVariables,
  options?: RequestInit["headers"],
) =>
  graphqlFetcher<PermissionsByCategoryQueryResult, PermissionsByCategoryQueryVariables>(
    PermissionsByCategoryDocument,
    variables,
    options,
  );

export const UserDashboardDocument = `
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

export const useUserDashboardQuery = <TData = UserDashboardQueryResult, TError = unknown>(
  variables?: UserDashboardQueryVariables,
  options?: Omit<UseQueryOptions<UserDashboardQueryResult, TError, TData>, "queryKey"> & {
    queryKey?: UseQueryOptions<UserDashboardQueryResult, TError, TData>["queryKey"];
  },
) => {
  return useQuery<UserDashboardQueryResult, TError, TData>({
    queryKey: variables === undefined ? ["UserDashboard"] : ["UserDashboard", variables],
    queryFn: graphqlFetcher<UserDashboardQueryResult, UserDashboardQueryVariables>(
      UserDashboardDocument,
      variables,
    ),
    ...options,
  });
};

useUserDashboardQuery.getKey = (variables?: UserDashboardQueryVariables) =>
  variables === undefined ? ["UserDashboard"] : ["UserDashboard", variables];

export const useInfiniteUserDashboardQuery = <
  TData = InfiniteData<UserDashboardQueryResult>,
  TError = unknown,
>(
  variables: UserDashboardQueryVariables,
  options: Omit<UseInfiniteQueryOptions<UserDashboardQueryResult, TError, TData>, "queryKey"> & {
    queryKey?: UseInfiniteQueryOptions<UserDashboardQueryResult, TError, TData>["queryKey"];
  },
) => {
  return useInfiniteQuery<UserDashboardQueryResult, TError, TData>(
    (() => {
      const { queryKey: optionsQueryKey, ...restOptions } = options;
      return {
        queryKey:
          (optionsQueryKey ?? variables === undefined)
            ? ["UserDashboard.infinite"]
            : ["UserDashboard.infinite", variables],
        queryFn: (metaData) =>
          graphqlFetcher<UserDashboardQueryResult, UserDashboardQueryVariables>(
            UserDashboardDocument,
            { ...variables, ...(metaData.pageParam ?? {}) },
          )(),
        ...restOptions,
      };
    })(),
  );
};

useInfiniteUserDashboardQuery.getKey = (variables?: UserDashboardQueryVariables) =>
  variables === undefined ? ["UserDashboard.infinite"] : ["UserDashboard.infinite", variables];

useUserDashboardQuery.fetcher = (
  variables?: UserDashboardQueryVariables,
  options?: RequestInit["headers"],
) =>
  graphqlFetcher<UserDashboardQueryResult, UserDashboardQueryVariables>(
    UserDashboardDocument,
    variables,
    options,
  );

export const UserRolesDocument = `
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

export const useUserRolesQuery = <TData = UserRolesQueryResult, TError = unknown>(
  variables: UserRolesQueryVariables,
  options?: Omit<UseQueryOptions<UserRolesQueryResult, TError, TData>, "queryKey"> & {
    queryKey?: UseQueryOptions<UserRolesQueryResult, TError, TData>["queryKey"];
  },
) => {
  return useQuery<UserRolesQueryResult, TError, TData>({
    queryKey: ["UserRoles", variables],
    queryFn: graphqlFetcher<UserRolesQueryResult, UserRolesQueryVariables>(
      UserRolesDocument,
      variables,
    ),
    ...options,
  });
};

useUserRolesQuery.getKey = (variables: UserRolesQueryVariables) => ["UserRoles", variables];

export const useInfiniteUserRolesQuery = <
  TData = InfiniteData<UserRolesQueryResult>,
  TError = unknown,
>(
  variables: UserRolesQueryVariables,
  options: Omit<UseInfiniteQueryOptions<UserRolesQueryResult, TError, TData>, "queryKey"> & {
    queryKey?: UseInfiniteQueryOptions<UserRolesQueryResult, TError, TData>["queryKey"];
  },
) => {
  return useInfiniteQuery<UserRolesQueryResult, TError, TData>(
    (() => {
      const { queryKey: optionsQueryKey, ...restOptions } = options;
      return {
        queryKey: optionsQueryKey ?? ["UserRoles.infinite", variables],
        queryFn: (metaData) =>
          graphqlFetcher<UserRolesQueryResult, UserRolesQueryVariables>(UserRolesDocument, {
            ...variables,
            ...(metaData.pageParam ?? {}),
          })(),
        ...restOptions,
      };
    })(),
  );
};

useInfiniteUserRolesQuery.getKey = (variables: UserRolesQueryVariables) => [
  "UserRoles.infinite",
  variables,
];

useUserRolesQuery.fetcher = (
  variables: UserRolesQueryVariables,
  options?: RequestInit["headers"],
) =>
  graphqlFetcher<UserRolesQueryResult, UserRolesQueryVariables>(
    UserRolesDocument,
    variables,
    options,
  );

export const UserPermissionsDocument = `
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

export const useUserPermissionsQuery = <TData = UserPermissionsQueryResult, TError = unknown>(
  variables: UserPermissionsQueryVariables,
  options?: Omit<UseQueryOptions<UserPermissionsQueryResult, TError, TData>, "queryKey"> & {
    queryKey?: UseQueryOptions<UserPermissionsQueryResult, TError, TData>["queryKey"];
  },
) => {
  return useQuery<UserPermissionsQueryResult, TError, TData>({
    queryKey: ["UserPermissions", variables],
    queryFn: graphqlFetcher<UserPermissionsQueryResult, UserPermissionsQueryVariables>(
      UserPermissionsDocument,
      variables,
    ),
    ...options,
  });
};

useUserPermissionsQuery.getKey = (variables: UserPermissionsQueryVariables) => [
  "UserPermissions",
  variables,
];

export const useInfiniteUserPermissionsQuery = <
  TData = InfiniteData<UserPermissionsQueryResult>,
  TError = unknown,
>(
  variables: UserPermissionsQueryVariables,
  options: Omit<UseInfiniteQueryOptions<UserPermissionsQueryResult, TError, TData>, "queryKey"> & {
    queryKey?: UseInfiniteQueryOptions<UserPermissionsQueryResult, TError, TData>["queryKey"];
  },
) => {
  return useInfiniteQuery<UserPermissionsQueryResult, TError, TData>(
    (() => {
      const { queryKey: optionsQueryKey, ...restOptions } = options;
      return {
        queryKey: optionsQueryKey ?? ["UserPermissions.infinite", variables],
        queryFn: (metaData) =>
          graphqlFetcher<UserPermissionsQueryResult, UserPermissionsQueryVariables>(
            UserPermissionsDocument,
            { ...variables, ...(metaData.pageParam ?? {}) },
          )(),
        ...restOptions,
      };
    })(),
  );
};

useInfiniteUserPermissionsQuery.getKey = (variables: UserPermissionsQueryVariables) => [
  "UserPermissions.infinite",
  variables,
];

useUserPermissionsQuery.fetcher = (
  variables: UserPermissionsQueryVariables,
  options?: RequestInit["headers"],
) =>
  graphqlFetcher<UserPermissionsQueryResult, UserPermissionsQueryVariables>(
    UserPermissionsDocument,
    variables,
    options,
  );

export const UserTeamsDocument = `
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

export const useUserTeamsQuery = <TData = UserTeamsQueryResult, TError = unknown>(
  variables: UserTeamsQueryVariables,
  options?: Omit<UseQueryOptions<UserTeamsQueryResult, TError, TData>, "queryKey"> & {
    queryKey?: UseQueryOptions<UserTeamsQueryResult, TError, TData>["queryKey"];
  },
) => {
  return useQuery<UserTeamsQueryResult, TError, TData>({
    queryKey: ["UserTeams", variables],
    queryFn: graphqlFetcher<UserTeamsQueryResult, UserTeamsQueryVariables>(
      UserTeamsDocument,
      variables,
    ),
    ...options,
  });
};

useUserTeamsQuery.getKey = (variables: UserTeamsQueryVariables) => ["UserTeams", variables];

export const useInfiniteUserTeamsQuery = <
  TData = InfiniteData<UserTeamsQueryResult>,
  TError = unknown,
>(
  variables: UserTeamsQueryVariables,
  options: Omit<UseInfiniteQueryOptions<UserTeamsQueryResult, TError, TData>, "queryKey"> & {
    queryKey?: UseInfiniteQueryOptions<UserTeamsQueryResult, TError, TData>["queryKey"];
  },
) => {
  return useInfiniteQuery<UserTeamsQueryResult, TError, TData>(
    (() => {
      const { queryKey: optionsQueryKey, ...restOptions } = options;
      return {
        queryKey: optionsQueryKey ?? ["UserTeams.infinite", variables],
        queryFn: (metaData) =>
          graphqlFetcher<UserTeamsQueryResult, UserTeamsQueryVariables>(UserTeamsDocument, {
            ...variables,
            ...(metaData.pageParam ?? {}),
          })(),
        ...restOptions,
      };
    })(),
  );
};

useInfiniteUserTeamsQuery.getKey = (variables: UserTeamsQueryVariables) => [
  "UserTeams.infinite",
  variables,
];

useUserTeamsQuery.fetcher = (
  variables: UserTeamsQueryVariables,
  options?: RequestInit["headers"],
) =>
  graphqlFetcher<UserTeamsQueryResult, UserTeamsQueryVariables>(
    UserTeamsDocument,
    variables,
    options,
  );

export const AccessPointListDocument = `
    query AccessPointList($limit: Int = 50, $offset: Int = 0, $siteId: String, $status: AccessPointStatus, $frequencyBand: FrequencyBand, $search: String) {
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

export const useAccessPointListQuery = <TData = AccessPointListQueryResult, TError = unknown>(
  variables?: AccessPointListQueryVariables,
  options?: Omit<UseQueryOptions<AccessPointListQueryResult, TError, TData>, "queryKey"> & {
    queryKey?: UseQueryOptions<AccessPointListQueryResult, TError, TData>["queryKey"];
  },
) => {
  return useQuery<AccessPointListQueryResult, TError, TData>({
    queryKey: variables === undefined ? ["AccessPointList"] : ["AccessPointList", variables],
    queryFn: graphqlFetcher<AccessPointListQueryResult, AccessPointListQueryVariables>(
      AccessPointListDocument,
      variables,
    ),
    ...options,
  });
};

useAccessPointListQuery.getKey = (variables?: AccessPointListQueryVariables) =>
  variables === undefined ? ["AccessPointList"] : ["AccessPointList", variables];

export const useInfiniteAccessPointListQuery = <
  TData = InfiniteData<AccessPointListQueryResult>,
  TError = unknown,
>(
  variables: AccessPointListQueryVariables,
  options: Omit<UseInfiniteQueryOptions<AccessPointListQueryResult, TError, TData>, "queryKey"> & {
    queryKey?: UseInfiniteQueryOptions<AccessPointListQueryResult, TError, TData>["queryKey"];
  },
) => {
  return useInfiniteQuery<AccessPointListQueryResult, TError, TData>(
    (() => {
      const { queryKey: optionsQueryKey, ...restOptions } = options;
      return {
        queryKey:
          (optionsQueryKey ?? variables === undefined)
            ? ["AccessPointList.infinite"]
            : ["AccessPointList.infinite", variables],
        queryFn: (metaData) =>
          graphqlFetcher<AccessPointListQueryResult, AccessPointListQueryVariables>(
            AccessPointListDocument,
            { ...variables, ...(metaData.pageParam ?? {}) },
          )(),
        ...restOptions,
      };
    })(),
  );
};

useInfiniteAccessPointListQuery.getKey = (variables?: AccessPointListQueryVariables) =>
  variables === undefined ? ["AccessPointList.infinite"] : ["AccessPointList.infinite", variables];

useAccessPointListQuery.fetcher = (
  variables?: AccessPointListQueryVariables,
  options?: RequestInit["headers"],
) =>
  graphqlFetcher<AccessPointListQueryResult, AccessPointListQueryVariables>(
    AccessPointListDocument,
    variables,
    options,
  );

export const AccessPointDetailDocument = `
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

export const useAccessPointDetailQuery = <TData = AccessPointDetailQueryResult, TError = unknown>(
  variables: AccessPointDetailQueryVariables,
  options?: Omit<UseQueryOptions<AccessPointDetailQueryResult, TError, TData>, "queryKey"> & {
    queryKey?: UseQueryOptions<AccessPointDetailQueryResult, TError, TData>["queryKey"];
  },
) => {
  return useQuery<AccessPointDetailQueryResult, TError, TData>({
    queryKey: ["AccessPointDetail", variables],
    queryFn: graphqlFetcher<AccessPointDetailQueryResult, AccessPointDetailQueryVariables>(
      AccessPointDetailDocument,
      variables,
    ),
    ...options,
  });
};

useAccessPointDetailQuery.getKey = (variables: AccessPointDetailQueryVariables) => [
  "AccessPointDetail",
  variables,
];

export const useInfiniteAccessPointDetailQuery = <
  TData = InfiniteData<AccessPointDetailQueryResult>,
  TError = unknown,
>(
  variables: AccessPointDetailQueryVariables,
  options: Omit<
    UseInfiniteQueryOptions<AccessPointDetailQueryResult, TError, TData>,
    "queryKey"
  > & {
    queryKey?: UseInfiniteQueryOptions<AccessPointDetailQueryResult, TError, TData>["queryKey"];
  },
) => {
  return useInfiniteQuery<AccessPointDetailQueryResult, TError, TData>(
    (() => {
      const { queryKey: optionsQueryKey, ...restOptions } = options;
      return {
        queryKey: optionsQueryKey ?? ["AccessPointDetail.infinite", variables],
        queryFn: (metaData) =>
          graphqlFetcher<AccessPointDetailQueryResult, AccessPointDetailQueryVariables>(
            AccessPointDetailDocument,
            { ...variables, ...(metaData.pageParam ?? {}) },
          )(),
        ...restOptions,
      };
    })(),
  );
};

useInfiniteAccessPointDetailQuery.getKey = (variables: AccessPointDetailQueryVariables) => [
  "AccessPointDetail.infinite",
  variables,
];

useAccessPointDetailQuery.fetcher = (
  variables: AccessPointDetailQueryVariables,
  options?: RequestInit["headers"],
) =>
  graphqlFetcher<AccessPointDetailQueryResult, AccessPointDetailQueryVariables>(
    AccessPointDetailDocument,
    variables,
    options,
  );

export const AccessPointsBySiteDocument = `
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

export const useAccessPointsBySiteQuery = <TData = AccessPointsBySiteQueryResult, TError = unknown>(
  variables: AccessPointsBySiteQueryVariables,
  options?: Omit<UseQueryOptions<AccessPointsBySiteQueryResult, TError, TData>, "queryKey"> & {
    queryKey?: UseQueryOptions<AccessPointsBySiteQueryResult, TError, TData>["queryKey"];
  },
) => {
  return useQuery<AccessPointsBySiteQueryResult, TError, TData>({
    queryKey: ["AccessPointsBySite", variables],
    queryFn: graphqlFetcher<AccessPointsBySiteQueryResult, AccessPointsBySiteQueryVariables>(
      AccessPointsBySiteDocument,
      variables,
    ),
    ...options,
  });
};

useAccessPointsBySiteQuery.getKey = (variables: AccessPointsBySiteQueryVariables) => [
  "AccessPointsBySite",
  variables,
];

export const useInfiniteAccessPointsBySiteQuery = <
  TData = InfiniteData<AccessPointsBySiteQueryResult>,
  TError = unknown,
>(
  variables: AccessPointsBySiteQueryVariables,
  options: Omit<
    UseInfiniteQueryOptions<AccessPointsBySiteQueryResult, TError, TData>,
    "queryKey"
  > & {
    queryKey?: UseInfiniteQueryOptions<AccessPointsBySiteQueryResult, TError, TData>["queryKey"];
  },
) => {
  return useInfiniteQuery<AccessPointsBySiteQueryResult, TError, TData>(
    (() => {
      const { queryKey: optionsQueryKey, ...restOptions } = options;
      return {
        queryKey: optionsQueryKey ?? ["AccessPointsBySite.infinite", variables],
        queryFn: (metaData) =>
          graphqlFetcher<AccessPointsBySiteQueryResult, AccessPointsBySiteQueryVariables>(
            AccessPointsBySiteDocument,
            { ...variables, ...(metaData.pageParam ?? {}) },
          )(),
        ...restOptions,
      };
    })(),
  );
};

useInfiniteAccessPointsBySiteQuery.getKey = (variables: AccessPointsBySiteQueryVariables) => [
  "AccessPointsBySite.infinite",
  variables,
];

useAccessPointsBySiteQuery.fetcher = (
  variables: AccessPointsBySiteQueryVariables,
  options?: RequestInit["headers"],
) =>
  graphqlFetcher<AccessPointsBySiteQueryResult, AccessPointsBySiteQueryVariables>(
    AccessPointsBySiteDocument,
    variables,
    options,
  );

export const WirelessClientListDocument = `
    query WirelessClientList($limit: Int = 50, $offset: Int = 0, $accessPointId: String, $customerId: String, $frequencyBand: FrequencyBand, $search: String) {
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

export const useWirelessClientListQuery = <TData = WirelessClientListQueryResult, TError = unknown>(
  variables?: WirelessClientListQueryVariables,
  options?: Omit<UseQueryOptions<WirelessClientListQueryResult, TError, TData>, "queryKey"> & {
    queryKey?: UseQueryOptions<WirelessClientListQueryResult, TError, TData>["queryKey"];
  },
) => {
  return useQuery<WirelessClientListQueryResult, TError, TData>({
    queryKey: variables === undefined ? ["WirelessClientList"] : ["WirelessClientList", variables],
    queryFn: graphqlFetcher<WirelessClientListQueryResult, WirelessClientListQueryVariables>(
      WirelessClientListDocument,
      variables,
    ),
    ...options,
  });
};

useWirelessClientListQuery.getKey = (variables?: WirelessClientListQueryVariables) =>
  variables === undefined ? ["WirelessClientList"] : ["WirelessClientList", variables];

export const useInfiniteWirelessClientListQuery = <
  TData = InfiniteData<WirelessClientListQueryResult>,
  TError = unknown,
>(
  variables: WirelessClientListQueryVariables,
  options: Omit<
    UseInfiniteQueryOptions<WirelessClientListQueryResult, TError, TData>,
    "queryKey"
  > & {
    queryKey?: UseInfiniteQueryOptions<WirelessClientListQueryResult, TError, TData>["queryKey"];
  },
) => {
  return useInfiniteQuery<WirelessClientListQueryResult, TError, TData>(
    (() => {
      const { queryKey: optionsQueryKey, ...restOptions } = options;
      return {
        queryKey:
          (optionsQueryKey ?? variables === undefined)
            ? ["WirelessClientList.infinite"]
            : ["WirelessClientList.infinite", variables],
        queryFn: (metaData) =>
          graphqlFetcher<WirelessClientListQueryResult, WirelessClientListQueryVariables>(
            WirelessClientListDocument,
            { ...variables, ...(metaData.pageParam ?? {}) },
          )(),
        ...restOptions,
      };
    })(),
  );
};

useInfiniteWirelessClientListQuery.getKey = (variables?: WirelessClientListQueryVariables) =>
  variables === undefined
    ? ["WirelessClientList.infinite"]
    : ["WirelessClientList.infinite", variables];

useWirelessClientListQuery.fetcher = (
  variables?: WirelessClientListQueryVariables,
  options?: RequestInit["headers"],
) =>
  graphqlFetcher<WirelessClientListQueryResult, WirelessClientListQueryVariables>(
    WirelessClientListDocument,
    variables,
    options,
  );

export const WirelessClientDetailDocument = `
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

export const useWirelessClientDetailQuery = <
  TData = WirelessClientDetailQueryResult,
  TError = unknown,
>(
  variables: WirelessClientDetailQueryVariables,
  options?: Omit<UseQueryOptions<WirelessClientDetailQueryResult, TError, TData>, "queryKey"> & {
    queryKey?: UseQueryOptions<WirelessClientDetailQueryResult, TError, TData>["queryKey"];
  },
) => {
  return useQuery<WirelessClientDetailQueryResult, TError, TData>({
    queryKey: ["WirelessClientDetail", variables],
    queryFn: graphqlFetcher<WirelessClientDetailQueryResult, WirelessClientDetailQueryVariables>(
      WirelessClientDetailDocument,
      variables,
    ),
    ...options,
  });
};

useWirelessClientDetailQuery.getKey = (variables: WirelessClientDetailQueryVariables) => [
  "WirelessClientDetail",
  variables,
];

export const useInfiniteWirelessClientDetailQuery = <
  TData = InfiniteData<WirelessClientDetailQueryResult>,
  TError = unknown,
>(
  variables: WirelessClientDetailQueryVariables,
  options: Omit<
    UseInfiniteQueryOptions<WirelessClientDetailQueryResult, TError, TData>,
    "queryKey"
  > & {
    queryKey?: UseInfiniteQueryOptions<WirelessClientDetailQueryResult, TError, TData>["queryKey"];
  },
) => {
  return useInfiniteQuery<WirelessClientDetailQueryResult, TError, TData>(
    (() => {
      const { queryKey: optionsQueryKey, ...restOptions } = options;
      return {
        queryKey: optionsQueryKey ?? ["WirelessClientDetail.infinite", variables],
        queryFn: (metaData) =>
          graphqlFetcher<WirelessClientDetailQueryResult, WirelessClientDetailQueryVariables>(
            WirelessClientDetailDocument,
            { ...variables, ...(metaData.pageParam ?? {}) },
          )(),
        ...restOptions,
      };
    })(),
  );
};

useInfiniteWirelessClientDetailQuery.getKey = (variables: WirelessClientDetailQueryVariables) => [
  "WirelessClientDetail.infinite",
  variables,
];

useWirelessClientDetailQuery.fetcher = (
  variables: WirelessClientDetailQueryVariables,
  options?: RequestInit["headers"],
) =>
  graphqlFetcher<WirelessClientDetailQueryResult, WirelessClientDetailQueryVariables>(
    WirelessClientDetailDocument,
    variables,
    options,
  );

export const WirelessClientsByAccessPointDocument = `
    query WirelessClientsByAccessPoint($accessPointId: String!) {
  wirelessClientsByAccessPoint(accessPointId: $accessPointId) {
    id
    macAddress
    hostname
    ipAddress
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

export const useWirelessClientsByAccessPointQuery = <
  TData = WirelessClientsByAccessPointQueryResult,
  TError = unknown,
>(
  variables: WirelessClientsByAccessPointQueryVariables,
  options?: Omit<
    UseQueryOptions<WirelessClientsByAccessPointQueryResult, TError, TData>,
    "queryKey"
  > & {
    queryKey?: UseQueryOptions<WirelessClientsByAccessPointQueryResult, TError, TData>["queryKey"];
  },
) => {
  return useQuery<WirelessClientsByAccessPointQueryResult, TError, TData>({
    queryKey: ["WirelessClientsByAccessPoint", variables],
    queryFn: graphqlFetcher<
      WirelessClientsByAccessPointQueryResult,
      WirelessClientsByAccessPointQueryVariables
    >(WirelessClientsByAccessPointDocument, variables),
    ...options,
  });
};

useWirelessClientsByAccessPointQuery.getKey = (
  variables: WirelessClientsByAccessPointQueryVariables,
) => ["WirelessClientsByAccessPoint", variables];

export const useInfiniteWirelessClientsByAccessPointQuery = <
  TData = InfiniteData<WirelessClientsByAccessPointQueryResult>,
  TError = unknown,
>(
  variables: WirelessClientsByAccessPointQueryVariables,
  options: Omit<
    UseInfiniteQueryOptions<WirelessClientsByAccessPointQueryResult, TError, TData>,
    "queryKey"
  > & {
    queryKey?: UseInfiniteQueryOptions<
      WirelessClientsByAccessPointQueryResult,
      TError,
      TData
    >["queryKey"];
  },
) => {
  return useInfiniteQuery<WirelessClientsByAccessPointQueryResult, TError, TData>(
    (() => {
      const { queryKey: optionsQueryKey, ...restOptions } = options;
      return {
        queryKey: optionsQueryKey ?? ["WirelessClientsByAccessPoint.infinite", variables],
        queryFn: (metaData) =>
          graphqlFetcher<
            WirelessClientsByAccessPointQueryResult,
            WirelessClientsByAccessPointQueryVariables
          >(WirelessClientsByAccessPointDocument, {
            ...variables,
            ...(metaData.pageParam ?? {}),
          })(),
        ...restOptions,
      };
    })(),
  );
};

useInfiniteWirelessClientsByAccessPointQuery.getKey = (
  variables: WirelessClientsByAccessPointQueryVariables,
) => ["WirelessClientsByAccessPoint.infinite", variables];

useWirelessClientsByAccessPointQuery.fetcher = (
  variables: WirelessClientsByAccessPointQueryVariables,
  options?: RequestInit["headers"],
) =>
  graphqlFetcher<
    WirelessClientsByAccessPointQueryResult,
    WirelessClientsByAccessPointQueryVariables
  >(WirelessClientsByAccessPointDocument, variables, options);

export const WirelessClientsByCustomerDocument = `
    query WirelessClientsByCustomer($customerId: String!) {
  wirelessClientsByCustomer(customerId: $customerId) {
    id
    macAddress
    hostname
    ipAddress
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

export const useWirelessClientsByCustomerQuery = <
  TData = WirelessClientsByCustomerQueryResult,
  TError = unknown,
>(
  variables: WirelessClientsByCustomerQueryVariables,
  options?: Omit<
    UseQueryOptions<WirelessClientsByCustomerQueryResult, TError, TData>,
    "queryKey"
  > & {
    queryKey?: UseQueryOptions<WirelessClientsByCustomerQueryResult, TError, TData>["queryKey"];
  },
) => {
  return useQuery<WirelessClientsByCustomerQueryResult, TError, TData>({
    queryKey: ["WirelessClientsByCustomer", variables],
    queryFn: graphqlFetcher<
      WirelessClientsByCustomerQueryResult,
      WirelessClientsByCustomerQueryVariables
    >(WirelessClientsByCustomerDocument, variables),
    ...options,
  });
};

useWirelessClientsByCustomerQuery.getKey = (variables: WirelessClientsByCustomerQueryVariables) => [
  "WirelessClientsByCustomer",
  variables,
];

export const useInfiniteWirelessClientsByCustomerQuery = <
  TData = InfiniteData<WirelessClientsByCustomerQueryResult>,
  TError = unknown,
>(
  variables: WirelessClientsByCustomerQueryVariables,
  options: Omit<
    UseInfiniteQueryOptions<WirelessClientsByCustomerQueryResult, TError, TData>,
    "queryKey"
  > & {
    queryKey?: UseInfiniteQueryOptions<
      WirelessClientsByCustomerQueryResult,
      TError,
      TData
    >["queryKey"];
  },
) => {
  return useInfiniteQuery<WirelessClientsByCustomerQueryResult, TError, TData>(
    (() => {
      const { queryKey: optionsQueryKey, ...restOptions } = options;
      return {
        queryKey: optionsQueryKey ?? ["WirelessClientsByCustomer.infinite", variables],
        queryFn: (metaData) =>
          graphqlFetcher<
            WirelessClientsByCustomerQueryResult,
            WirelessClientsByCustomerQueryVariables
          >(WirelessClientsByCustomerDocument, { ...variables, ...(metaData.pageParam ?? {}) })(),
        ...restOptions,
      };
    })(),
  );
};

useInfiniteWirelessClientsByCustomerQuery.getKey = (
  variables: WirelessClientsByCustomerQueryVariables,
) => ["WirelessClientsByCustomer.infinite", variables];

useWirelessClientsByCustomerQuery.fetcher = (
  variables: WirelessClientsByCustomerQueryVariables,
  options?: RequestInit["headers"],
) =>
  graphqlFetcher<WirelessClientsByCustomerQueryResult, WirelessClientsByCustomerQueryVariables>(
    WirelessClientsByCustomerDocument,
    variables,
    options,
  );

export const CoverageZoneListDocument = `
    query CoverageZoneList($limit: Int = 50, $offset: Int = 0, $siteId: String, $areaType: String) {
  coverageZones(
    limit: $limit
    offset: $offset
    siteId: $siteId
    areaType: $areaType
  ) {
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

export const useCoverageZoneListQuery = <TData = CoverageZoneListQueryResult, TError = unknown>(
  variables?: CoverageZoneListQueryVariables,
  options?: Omit<UseQueryOptions<CoverageZoneListQueryResult, TError, TData>, "queryKey"> & {
    queryKey?: UseQueryOptions<CoverageZoneListQueryResult, TError, TData>["queryKey"];
  },
) => {
  return useQuery<CoverageZoneListQueryResult, TError, TData>({
    queryKey: variables === undefined ? ["CoverageZoneList"] : ["CoverageZoneList", variables],
    queryFn: graphqlFetcher<CoverageZoneListQueryResult, CoverageZoneListQueryVariables>(
      CoverageZoneListDocument,
      variables,
    ),
    ...options,
  });
};

useCoverageZoneListQuery.getKey = (variables?: CoverageZoneListQueryVariables) =>
  variables === undefined ? ["CoverageZoneList"] : ["CoverageZoneList", variables];

export const useInfiniteCoverageZoneListQuery = <
  TData = InfiniteData<CoverageZoneListQueryResult>,
  TError = unknown,
>(
  variables: CoverageZoneListQueryVariables,
  options: Omit<UseInfiniteQueryOptions<CoverageZoneListQueryResult, TError, TData>, "queryKey"> & {
    queryKey?: UseInfiniteQueryOptions<CoverageZoneListQueryResult, TError, TData>["queryKey"];
  },
) => {
  return useInfiniteQuery<CoverageZoneListQueryResult, TError, TData>(
    (() => {
      const { queryKey: optionsQueryKey, ...restOptions } = options;
      return {
        queryKey:
          (optionsQueryKey ?? variables === undefined)
            ? ["CoverageZoneList.infinite"]
            : ["CoverageZoneList.infinite", variables],
        queryFn: (metaData) =>
          graphqlFetcher<CoverageZoneListQueryResult, CoverageZoneListQueryVariables>(
            CoverageZoneListDocument,
            { ...variables, ...(metaData.pageParam ?? {}) },
          )(),
        ...restOptions,
      };
    })(),
  );
};

useInfiniteCoverageZoneListQuery.getKey = (variables?: CoverageZoneListQueryVariables) =>
  variables === undefined
    ? ["CoverageZoneList.infinite"]
    : ["CoverageZoneList.infinite", variables];

useCoverageZoneListQuery.fetcher = (
  variables?: CoverageZoneListQueryVariables,
  options?: RequestInit["headers"],
) =>
  graphqlFetcher<CoverageZoneListQueryResult, CoverageZoneListQueryVariables>(
    CoverageZoneListDocument,
    variables,
    options,
  );

export const CoverageZoneDetailDocument = `
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

export const useCoverageZoneDetailQuery = <TData = CoverageZoneDetailQueryResult, TError = unknown>(
  variables: CoverageZoneDetailQueryVariables,
  options?: Omit<UseQueryOptions<CoverageZoneDetailQueryResult, TError, TData>, "queryKey"> & {
    queryKey?: UseQueryOptions<CoverageZoneDetailQueryResult, TError, TData>["queryKey"];
  },
) => {
  return useQuery<CoverageZoneDetailQueryResult, TError, TData>({
    queryKey: ["CoverageZoneDetail", variables],
    queryFn: graphqlFetcher<CoverageZoneDetailQueryResult, CoverageZoneDetailQueryVariables>(
      CoverageZoneDetailDocument,
      variables,
    ),
    ...options,
  });
};

useCoverageZoneDetailQuery.getKey = (variables: CoverageZoneDetailQueryVariables) => [
  "CoverageZoneDetail",
  variables,
];

export const useInfiniteCoverageZoneDetailQuery = <
  TData = InfiniteData<CoverageZoneDetailQueryResult>,
  TError = unknown,
>(
  variables: CoverageZoneDetailQueryVariables,
  options: Omit<
    UseInfiniteQueryOptions<CoverageZoneDetailQueryResult, TError, TData>,
    "queryKey"
  > & {
    queryKey?: UseInfiniteQueryOptions<CoverageZoneDetailQueryResult, TError, TData>["queryKey"];
  },
) => {
  return useInfiniteQuery<CoverageZoneDetailQueryResult, TError, TData>(
    (() => {
      const { queryKey: optionsQueryKey, ...restOptions } = options;
      return {
        queryKey: optionsQueryKey ?? ["CoverageZoneDetail.infinite", variables],
        queryFn: (metaData) =>
          graphqlFetcher<CoverageZoneDetailQueryResult, CoverageZoneDetailQueryVariables>(
            CoverageZoneDetailDocument,
            { ...variables, ...(metaData.pageParam ?? {}) },
          )(),
        ...restOptions,
      };
    })(),
  );
};

useInfiniteCoverageZoneDetailQuery.getKey = (variables: CoverageZoneDetailQueryVariables) => [
  "CoverageZoneDetail.infinite",
  variables,
];

useCoverageZoneDetailQuery.fetcher = (
  variables: CoverageZoneDetailQueryVariables,
  options?: RequestInit["headers"],
) =>
  graphqlFetcher<CoverageZoneDetailQueryResult, CoverageZoneDetailQueryVariables>(
    CoverageZoneDetailDocument,
    variables,
    options,
  );

export const CoverageZonesBySiteDocument = `
    query CoverageZonesBySite($siteId: String!) {
  coverageZonesBySite(siteId: $siteId) {
    id
    name
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

export const useCoverageZonesBySiteQuery = <
  TData = CoverageZonesBySiteQueryResult,
  TError = unknown,
>(
  variables: CoverageZonesBySiteQueryVariables,
  options?: Omit<UseQueryOptions<CoverageZonesBySiteQueryResult, TError, TData>, "queryKey"> & {
    queryKey?: UseQueryOptions<CoverageZonesBySiteQueryResult, TError, TData>["queryKey"];
  },
) => {
  return useQuery<CoverageZonesBySiteQueryResult, TError, TData>({
    queryKey: ["CoverageZonesBySite", variables],
    queryFn: graphqlFetcher<CoverageZonesBySiteQueryResult, CoverageZonesBySiteQueryVariables>(
      CoverageZonesBySiteDocument,
      variables,
    ),
    ...options,
  });
};

useCoverageZonesBySiteQuery.getKey = (variables: CoverageZonesBySiteQueryVariables) => [
  "CoverageZonesBySite",
  variables,
];

export const useInfiniteCoverageZonesBySiteQuery = <
  TData = InfiniteData<CoverageZonesBySiteQueryResult>,
  TError = unknown,
>(
  variables: CoverageZonesBySiteQueryVariables,
  options: Omit<
    UseInfiniteQueryOptions<CoverageZonesBySiteQueryResult, TError, TData>,
    "queryKey"
  > & {
    queryKey?: UseInfiniteQueryOptions<CoverageZonesBySiteQueryResult, TError, TData>["queryKey"];
  },
) => {
  return useInfiniteQuery<CoverageZonesBySiteQueryResult, TError, TData>(
    (() => {
      const { queryKey: optionsQueryKey, ...restOptions } = options;
      return {
        queryKey: optionsQueryKey ?? ["CoverageZonesBySite.infinite", variables],
        queryFn: (metaData) =>
          graphqlFetcher<CoverageZonesBySiteQueryResult, CoverageZonesBySiteQueryVariables>(
            CoverageZonesBySiteDocument,
            { ...variables, ...(metaData.pageParam ?? {}) },
          )(),
        ...restOptions,
      };
    })(),
  );
};

useInfiniteCoverageZonesBySiteQuery.getKey = (variables: CoverageZonesBySiteQueryVariables) => [
  "CoverageZonesBySite.infinite",
  variables,
];

useCoverageZonesBySiteQuery.fetcher = (
  variables: CoverageZonesBySiteQueryVariables,
  options?: RequestInit["headers"],
) =>
  graphqlFetcher<CoverageZonesBySiteQueryResult, CoverageZonesBySiteQueryVariables>(
    CoverageZonesBySiteDocument,
    variables,
    options,
  );

export const RfAnalyticsDocument = `
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

export const useRfAnalyticsQuery = <TData = RfAnalyticsQueryResult, TError = unknown>(
  variables: RfAnalyticsQueryVariables,
  options?: Omit<UseQueryOptions<RfAnalyticsQueryResult, TError, TData>, "queryKey"> & {
    queryKey?: UseQueryOptions<RfAnalyticsQueryResult, TError, TData>["queryKey"];
  },
) => {
  return useQuery<RfAnalyticsQueryResult, TError, TData>({
    queryKey: ["RFAnalytics", variables],
    queryFn: graphqlFetcher<RfAnalyticsQueryResult, RfAnalyticsQueryVariables>(
      RfAnalyticsDocument,
      variables,
    ),
    ...options,
  });
};

useRfAnalyticsQuery.getKey = (variables: RfAnalyticsQueryVariables) => ["RFAnalytics", variables];

export const useInfiniteRfAnalyticsQuery = <
  TData = InfiniteData<RfAnalyticsQueryResult>,
  TError = unknown,
>(
  variables: RfAnalyticsQueryVariables,
  options: Omit<UseInfiniteQueryOptions<RfAnalyticsQueryResult, TError, TData>, "queryKey"> & {
    queryKey?: UseInfiniteQueryOptions<RfAnalyticsQueryResult, TError, TData>["queryKey"];
  },
) => {
  return useInfiniteQuery<RfAnalyticsQueryResult, TError, TData>(
    (() => {
      const { queryKey: optionsQueryKey, ...restOptions } = options;
      return {
        queryKey: optionsQueryKey ?? ["RFAnalytics.infinite", variables],
        queryFn: (metaData) =>
          graphqlFetcher<RfAnalyticsQueryResult, RfAnalyticsQueryVariables>(RfAnalyticsDocument, {
            ...variables,
            ...(metaData.pageParam ?? {}),
          })(),
        ...restOptions,
      };
    })(),
  );
};

useInfiniteRfAnalyticsQuery.getKey = (variables: RfAnalyticsQueryVariables) => [
  "RFAnalytics.infinite",
  variables,
];

useRfAnalyticsQuery.fetcher = (
  variables: RfAnalyticsQueryVariables,
  options?: RequestInit["headers"],
) =>
  graphqlFetcher<RfAnalyticsQueryResult, RfAnalyticsQueryVariables>(
    RfAnalyticsDocument,
    variables,
    options,
  );

export const ChannelUtilizationDocument = `
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

export const useChannelUtilizationQuery = <TData = ChannelUtilizationQueryResult, TError = unknown>(
  variables: ChannelUtilizationQueryVariables,
  options?: Omit<UseQueryOptions<ChannelUtilizationQueryResult, TError, TData>, "queryKey"> & {
    queryKey?: UseQueryOptions<ChannelUtilizationQueryResult, TError, TData>["queryKey"];
  },
) => {
  return useQuery<ChannelUtilizationQueryResult, TError, TData>({
    queryKey: ["ChannelUtilization", variables],
    queryFn: graphqlFetcher<ChannelUtilizationQueryResult, ChannelUtilizationQueryVariables>(
      ChannelUtilizationDocument,
      variables,
    ),
    ...options,
  });
};

useChannelUtilizationQuery.getKey = (variables: ChannelUtilizationQueryVariables) => [
  "ChannelUtilization",
  variables,
];

export const useInfiniteChannelUtilizationQuery = <
  TData = InfiniteData<ChannelUtilizationQueryResult>,
  TError = unknown,
>(
  variables: ChannelUtilizationQueryVariables,
  options: Omit<
    UseInfiniteQueryOptions<ChannelUtilizationQueryResult, TError, TData>,
    "queryKey"
  > & {
    queryKey?: UseInfiniteQueryOptions<ChannelUtilizationQueryResult, TError, TData>["queryKey"];
  },
) => {
  return useInfiniteQuery<ChannelUtilizationQueryResult, TError, TData>(
    (() => {
      const { queryKey: optionsQueryKey, ...restOptions } = options;
      return {
        queryKey: optionsQueryKey ?? ["ChannelUtilization.infinite", variables],
        queryFn: (metaData) =>
          graphqlFetcher<ChannelUtilizationQueryResult, ChannelUtilizationQueryVariables>(
            ChannelUtilizationDocument,
            { ...variables, ...(metaData.pageParam ?? {}) },
          )(),
        ...restOptions,
      };
    })(),
  );
};

useInfiniteChannelUtilizationQuery.getKey = (variables: ChannelUtilizationQueryVariables) => [
  "ChannelUtilization.infinite",
  variables,
];

useChannelUtilizationQuery.fetcher = (
  variables: ChannelUtilizationQueryVariables,
  options?: RequestInit["headers"],
) =>
  graphqlFetcher<ChannelUtilizationQueryResult, ChannelUtilizationQueryVariables>(
    ChannelUtilizationDocument,
    variables,
    options,
  );

export const WirelessSiteMetricsDocument = `
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

export const useWirelessSiteMetricsQuery = <
  TData = WirelessSiteMetricsQueryResult,
  TError = unknown,
>(
  variables: WirelessSiteMetricsQueryVariables,
  options?: Omit<UseQueryOptions<WirelessSiteMetricsQueryResult, TError, TData>, "queryKey"> & {
    queryKey?: UseQueryOptions<WirelessSiteMetricsQueryResult, TError, TData>["queryKey"];
  },
) => {
  return useQuery<WirelessSiteMetricsQueryResult, TError, TData>({
    queryKey: ["WirelessSiteMetrics", variables],
    queryFn: graphqlFetcher<WirelessSiteMetricsQueryResult, WirelessSiteMetricsQueryVariables>(
      WirelessSiteMetricsDocument,
      variables,
    ),
    ...options,
  });
};

useWirelessSiteMetricsQuery.getKey = (variables: WirelessSiteMetricsQueryVariables) => [
  "WirelessSiteMetrics",
  variables,
];

export const useInfiniteWirelessSiteMetricsQuery = <
  TData = InfiniteData<WirelessSiteMetricsQueryResult>,
  TError = unknown,
>(
  variables: WirelessSiteMetricsQueryVariables,
  options: Omit<
    UseInfiniteQueryOptions<WirelessSiteMetricsQueryResult, TError, TData>,
    "queryKey"
  > & {
    queryKey?: UseInfiniteQueryOptions<WirelessSiteMetricsQueryResult, TError, TData>["queryKey"];
  },
) => {
  return useInfiniteQuery<WirelessSiteMetricsQueryResult, TError, TData>(
    (() => {
      const { queryKey: optionsQueryKey, ...restOptions } = options;
      return {
        queryKey: optionsQueryKey ?? ["WirelessSiteMetrics.infinite", variables],
        queryFn: (metaData) =>
          graphqlFetcher<WirelessSiteMetricsQueryResult, WirelessSiteMetricsQueryVariables>(
            WirelessSiteMetricsDocument,
            { ...variables, ...(metaData.pageParam ?? {}) },
          )(),
        ...restOptions,
      };
    })(),
  );
};

useInfiniteWirelessSiteMetricsQuery.getKey = (variables: WirelessSiteMetricsQueryVariables) => [
  "WirelessSiteMetrics.infinite",
  variables,
];

useWirelessSiteMetricsQuery.fetcher = (
  variables: WirelessSiteMetricsQueryVariables,
  options?: RequestInit["headers"],
) =>
  graphqlFetcher<WirelessSiteMetricsQueryResult, WirelessSiteMetricsQueryVariables>(
    WirelessSiteMetricsDocument,
    variables,
    options,
  );

export const WirelessDashboardDocument = `
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

export const useWirelessDashboardQuery = <TData = WirelessDashboardQueryResult, TError = unknown>(
  variables?: WirelessDashboardQueryVariables,
  options?: Omit<UseQueryOptions<WirelessDashboardQueryResult, TError, TData>, "queryKey"> & {
    queryKey?: UseQueryOptions<WirelessDashboardQueryResult, TError, TData>["queryKey"];
  },
) => {
  return useQuery<WirelessDashboardQueryResult, TError, TData>({
    queryKey: variables === undefined ? ["WirelessDashboard"] : ["WirelessDashboard", variables],
    queryFn: graphqlFetcher<WirelessDashboardQueryResult, WirelessDashboardQueryVariables>(
      WirelessDashboardDocument,
      variables,
    ),
    ...options,
  });
};

useWirelessDashboardQuery.getKey = (variables?: WirelessDashboardQueryVariables) =>
  variables === undefined ? ["WirelessDashboard"] : ["WirelessDashboard", variables];

export const useInfiniteWirelessDashboardQuery = <
  TData = InfiniteData<WirelessDashboardQueryResult>,
  TError = unknown,
>(
  variables: WirelessDashboardQueryVariables,
  options: Omit<
    UseInfiniteQueryOptions<WirelessDashboardQueryResult, TError, TData>,
    "queryKey"
  > & {
    queryKey?: UseInfiniteQueryOptions<WirelessDashboardQueryResult, TError, TData>["queryKey"];
  },
) => {
  return useInfiniteQuery<WirelessDashboardQueryResult, TError, TData>(
    (() => {
      const { queryKey: optionsQueryKey, ...restOptions } = options;
      return {
        queryKey:
          (optionsQueryKey ?? variables === undefined)
            ? ["WirelessDashboard.infinite"]
            : ["WirelessDashboard.infinite", variables],
        queryFn: (metaData) =>
          graphqlFetcher<WirelessDashboardQueryResult, WirelessDashboardQueryVariables>(
            WirelessDashboardDocument,
            { ...variables, ...(metaData.pageParam ?? {}) },
          )(),
        ...restOptions,
      };
    })(),
  );
};

useInfiniteWirelessDashboardQuery.getKey = (variables?: WirelessDashboardQueryVariables) =>
  variables === undefined
    ? ["WirelessDashboard.infinite"]
    : ["WirelessDashboard.infinite", variables];

useWirelessDashboardQuery.fetcher = (
  variables?: WirelessDashboardQueryVariables,
  options?: RequestInit["headers"],
) =>
  graphqlFetcher<WirelessDashboardQueryResult, WirelessDashboardQueryVariables>(
    WirelessDashboardDocument,
    variables,
    options,
  );
