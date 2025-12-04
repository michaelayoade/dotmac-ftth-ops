/* eslint-disable */
import type { TypedDocumentNode as DocumentNode } from "@graphql-typed-document-node/core";
export type Maybe<T> = T | null | undefined;
export type InputMaybe<T> = Maybe<T>;
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
      lifetimeValue: string;
      totalPurchases: number;
      averageOrderValue: string;
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
    lifetimeValue: string;
    totalPurchases: number;
    averageOrderValue: string;
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
      lifetimeValue: string;
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
  customerNetworkInfo: Record<string, any>;
};

export type CustomerDevicesQueryVariables = Exact<{
  customerId: Scalars["ID"]["input"];
  deviceType?: InputMaybe<Scalars["String"]["input"]>;
  activeOnly?: InputMaybe<Scalars["Boolean"]["input"]>;
}>;

export type CustomerDevicesQuery = { __typename?: "Query"; customerDevices: Record<string, any> };

export type CustomerTicketsQueryVariables = Exact<{
  customerId: Scalars["ID"]["input"];
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  status?: InputMaybe<Scalars["String"]["input"]>;
}>;

export type CustomerTicketsQuery = { __typename?: "Query"; customerTickets: Record<string, any> };

export type CustomerBillingQueryVariables = Exact<{
  customerId: Scalars["ID"]["input"];
  includeInvoices?: InputMaybe<Scalars["Boolean"]["input"]>;
  invoiceLimit?: InputMaybe<Scalars["Int"]["input"]>;
}>;

export type CustomerBillingQuery = { __typename?: "Query"; customerBilling: Record<string, any> };

export type Customer360ViewQueryVariables = Exact<{
  customerId: Scalars["ID"]["input"];
}>;

export type Customer360ViewQuery = {
  __typename?: "Query";
  customerNetworkInfo: Record<string, any>;
  customerDevices: Record<string, any>;
  customerTickets: Record<string, any>;
  customerBilling: Record<string, any>;
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
    lifetimeValue: string;
    totalPurchases: number;
    averageOrderValue: string;
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
    uptimePercentage?: string | null;
    bandwidthUsageMbps?: string | null;
    downloadSpeedMbps?: string | null;
    uploadSpeedMbps?: string | null;
    packetLoss?: string | null;
    latencyMs?: number | null;
    jitter?: string | null;
    ontRxPower?: string | null;
    ontTxPower?: string | null;
    oltRxPower?: string | null;
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

export type FiberNetworkAnalyticsQueryVariables = Exact<{ [key: string]: never }>;

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
    warningAlerts: number;
    totalBandwidthGbps: number;
    uptimePercentage: number;
    dataSourceStatus: Array<{ __typename?: "DataSourceStatus"; name: string; status: string }>;
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
    warningAlerts: number;
    totalBandwidthGbps: number;
    uptimePercentage: number;
    dataSourceStatus: Array<{ __typename?: "DataSourceStatus"; name: string; status: string }>;
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
    createdAt?: string | null;
    updatedAt?: string | null;
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
    createdAt?: string | null;
    updatedAt?: string | null;
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
      customPrice?: string | null;
      usageRecords: Record<string, any>;
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
        price: string;
        currency: string;
        setupFee?: string | null;
        trialDays?: number | null;
        isActive: boolean;
        hasTrial: boolean;
        hasSetupFee: boolean;
        includedUsage: Record<string, any>;
        overageRates: Record<string, any>;
        createdAt: string;
        updatedAt: string;
      } | null;
      recentInvoices?: Array<{
        __typename?: "SubscriptionInvoice";
        id: string;
        invoiceId: string;
        invoiceNumber: string;
        amount: string;
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
    customPrice?: string | null;
    usageRecords: Record<string, any>;
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
      price: string;
      currency: string;
      setupFee?: string | null;
      trialDays?: number | null;
      isActive: boolean;
      hasTrial: boolean;
      hasSetupFee: boolean;
      includedUsage: Record<string, any>;
      overageRates: Record<string, any>;
      createdAt: string;
      updatedAt: string;
    } | null;
    recentInvoices: Array<{
      __typename?: "SubscriptionInvoice";
      id: string;
      invoiceId: string;
      invoiceNumber: string;
      amount: string;
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
      price: string;
      currency: string;
      setupFee?: string | null;
      trialDays?: number | null;
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
        price: string;
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
      tenantId?: string | null;
      primaryRole: string;
      createdAt: string;
      updatedAt: string;
      metadata?: Record<string, any> | null;
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
    tenantId?: string | null;
    primaryRole: string;
    createdAt: string;
    updatedAt: string;
    metadata?: Record<string, any> | null;
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
      performance?: { __typename?: "APPerformanceMetrics"; connectedClients: number } | null;
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

export const CustomerListDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "CustomerList" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "limit" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "Int" } },
          defaultValue: { kind: "IntValue", value: "50" },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "offset" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "Int" } },
          defaultValue: { kind: "IntValue", value: "0" },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "status" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "CustomerStatusEnum" } },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "search" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "String" } },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "includeActivities" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "Boolean" } },
          defaultValue: { kind: "BooleanValue", value: false },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "includeNotes" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "Boolean" } },
          defaultValue: { kind: "BooleanValue", value: false },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "customers" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "limit" },
                value: { kind: "Variable", name: { kind: "Name", value: "limit" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "offset" },
                value: { kind: "Variable", name: { kind: "Name", value: "offset" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "status" },
                value: { kind: "Variable", name: { kind: "Name", value: "status" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "search" },
                value: { kind: "Variable", name: { kind: "Name", value: "search" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "includeActivities" },
                value: { kind: "Variable", name: { kind: "Name", value: "includeActivities" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "includeNotes" },
                value: { kind: "Variable", name: { kind: "Name", value: "includeNotes" } },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                {
                  kind: "Field",
                  name: { kind: "Name", value: "customers" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "id" } },
                      { kind: "Field", name: { kind: "Name", value: "customerNumber" } },
                      { kind: "Field", name: { kind: "Name", value: "firstName" } },
                      { kind: "Field", name: { kind: "Name", value: "lastName" } },
                      { kind: "Field", name: { kind: "Name", value: "middleName" } },
                      { kind: "Field", name: { kind: "Name", value: "displayName" } },
                      { kind: "Field", name: { kind: "Name", value: "companyName" } },
                      { kind: "Field", name: { kind: "Name", value: "status" } },
                      { kind: "Field", name: { kind: "Name", value: "customerType" } },
                      { kind: "Field", name: { kind: "Name", value: "tier" } },
                      { kind: "Field", name: { kind: "Name", value: "email" } },
                      { kind: "Field", name: { kind: "Name", value: "emailVerified" } },
                      { kind: "Field", name: { kind: "Name", value: "phone" } },
                      { kind: "Field", name: { kind: "Name", value: "phoneVerified" } },
                      { kind: "Field", name: { kind: "Name", value: "mobile" } },
                      { kind: "Field", name: { kind: "Name", value: "addressLine1" } },
                      { kind: "Field", name: { kind: "Name", value: "addressLine2" } },
                      { kind: "Field", name: { kind: "Name", value: "city" } },
                      { kind: "Field", name: { kind: "Name", value: "stateProvince" } },
                      { kind: "Field", name: { kind: "Name", value: "postalCode" } },
                      { kind: "Field", name: { kind: "Name", value: "country" } },
                      { kind: "Field", name: { kind: "Name", value: "taxId" } },
                      { kind: "Field", name: { kind: "Name", value: "industry" } },
                      { kind: "Field", name: { kind: "Name", value: "employeeCount" } },
                      { kind: "Field", name: { kind: "Name", value: "lifetimeValue" } },
                      { kind: "Field", name: { kind: "Name", value: "totalPurchases" } },
                      { kind: "Field", name: { kind: "Name", value: "averageOrderValue" } },
                      { kind: "Field", name: { kind: "Name", value: "lastPurchaseDate" } },
                      { kind: "Field", name: { kind: "Name", value: "createdAt" } },
                      { kind: "Field", name: { kind: "Name", value: "updatedAt" } },
                      { kind: "Field", name: { kind: "Name", value: "acquisitionDate" } },
                      { kind: "Field", name: { kind: "Name", value: "lastContactDate" } },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "activities" },
                        directives: [
                          {
                            kind: "Directive",
                            name: { kind: "Name", value: "include" },
                            arguments: [
                              {
                                kind: "Argument",
                                name: { kind: "Name", value: "if" },
                                value: {
                                  kind: "Variable",
                                  name: { kind: "Name", value: "includeActivities" },
                                },
                              },
                            ],
                          },
                        ],
                        selectionSet: {
                          kind: "SelectionSet",
                          selections: [
                            { kind: "Field", name: { kind: "Name", value: "id" } },
                            { kind: "Field", name: { kind: "Name", value: "customerId" } },
                            { kind: "Field", name: { kind: "Name", value: "activityType" } },
                            { kind: "Field", name: { kind: "Name", value: "title" } },
                            { kind: "Field", name: { kind: "Name", value: "description" } },
                            { kind: "Field", name: { kind: "Name", value: "performedBy" } },
                            { kind: "Field", name: { kind: "Name", value: "createdAt" } },
                          ],
                        },
                      },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "notes" },
                        directives: [
                          {
                            kind: "Directive",
                            name: { kind: "Name", value: "include" },
                            arguments: [
                              {
                                kind: "Argument",
                                name: { kind: "Name", value: "if" },
                                value: {
                                  kind: "Variable",
                                  name: { kind: "Name", value: "includeNotes" },
                                },
                              },
                            ],
                          },
                        ],
                        selectionSet: {
                          kind: "SelectionSet",
                          selections: [
                            { kind: "Field", name: { kind: "Name", value: "id" } },
                            { kind: "Field", name: { kind: "Name", value: "customerId" } },
                            { kind: "Field", name: { kind: "Name", value: "subject" } },
                            { kind: "Field", name: { kind: "Name", value: "content" } },
                            { kind: "Field", name: { kind: "Name", value: "isInternal" } },
                            { kind: "Field", name: { kind: "Name", value: "createdById" } },
                            { kind: "Field", name: { kind: "Name", value: "createdAt" } },
                            { kind: "Field", name: { kind: "Name", value: "updatedAt" } },
                          ],
                        },
                      },
                    ],
                  },
                },
                { kind: "Field", name: { kind: "Name", value: "totalCount" } },
                { kind: "Field", name: { kind: "Name", value: "hasNextPage" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<CustomerListQuery, CustomerListQueryVariables>;
export const CustomerDetailDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "CustomerDetail" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "id" } },
          type: {
            kind: "NonNullType",
            type: { kind: "NamedType", name: { kind: "Name", value: "ID" } },
          },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "customer" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "id" },
                value: { kind: "Variable", name: { kind: "Name", value: "id" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "includeActivities" },
                value: { kind: "BooleanValue", value: true },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "includeNotes" },
                value: { kind: "BooleanValue", value: true },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "id" } },
                { kind: "Field", name: { kind: "Name", value: "customerNumber" } },
                { kind: "Field", name: { kind: "Name", value: "firstName" } },
                { kind: "Field", name: { kind: "Name", value: "lastName" } },
                { kind: "Field", name: { kind: "Name", value: "middleName" } },
                { kind: "Field", name: { kind: "Name", value: "displayName" } },
                { kind: "Field", name: { kind: "Name", value: "companyName" } },
                { kind: "Field", name: { kind: "Name", value: "status" } },
                { kind: "Field", name: { kind: "Name", value: "customerType" } },
                { kind: "Field", name: { kind: "Name", value: "tier" } },
                { kind: "Field", name: { kind: "Name", value: "email" } },
                { kind: "Field", name: { kind: "Name", value: "emailVerified" } },
                { kind: "Field", name: { kind: "Name", value: "phone" } },
                { kind: "Field", name: { kind: "Name", value: "phoneVerified" } },
                { kind: "Field", name: { kind: "Name", value: "mobile" } },
                { kind: "Field", name: { kind: "Name", value: "addressLine1" } },
                { kind: "Field", name: { kind: "Name", value: "addressLine2" } },
                { kind: "Field", name: { kind: "Name", value: "city" } },
                { kind: "Field", name: { kind: "Name", value: "stateProvince" } },
                { kind: "Field", name: { kind: "Name", value: "postalCode" } },
                { kind: "Field", name: { kind: "Name", value: "country" } },
                { kind: "Field", name: { kind: "Name", value: "taxId" } },
                { kind: "Field", name: { kind: "Name", value: "industry" } },
                { kind: "Field", name: { kind: "Name", value: "employeeCount" } },
                { kind: "Field", name: { kind: "Name", value: "lifetimeValue" } },
                { kind: "Field", name: { kind: "Name", value: "totalPurchases" } },
                { kind: "Field", name: { kind: "Name", value: "averageOrderValue" } },
                { kind: "Field", name: { kind: "Name", value: "lastPurchaseDate" } },
                { kind: "Field", name: { kind: "Name", value: "createdAt" } },
                { kind: "Field", name: { kind: "Name", value: "updatedAt" } },
                { kind: "Field", name: { kind: "Name", value: "acquisitionDate" } },
                { kind: "Field", name: { kind: "Name", value: "lastContactDate" } },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "activities" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "id" } },
                      { kind: "Field", name: { kind: "Name", value: "customerId" } },
                      { kind: "Field", name: { kind: "Name", value: "activityType" } },
                      { kind: "Field", name: { kind: "Name", value: "title" } },
                      { kind: "Field", name: { kind: "Name", value: "description" } },
                      { kind: "Field", name: { kind: "Name", value: "performedBy" } },
                      { kind: "Field", name: { kind: "Name", value: "createdAt" } },
                    ],
                  },
                },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "notes" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "id" } },
                      { kind: "Field", name: { kind: "Name", value: "customerId" } },
                      { kind: "Field", name: { kind: "Name", value: "subject" } },
                      { kind: "Field", name: { kind: "Name", value: "content" } },
                      { kind: "Field", name: { kind: "Name", value: "isInternal" } },
                      { kind: "Field", name: { kind: "Name", value: "createdById" } },
                      { kind: "Field", name: { kind: "Name", value: "createdAt" } },
                      { kind: "Field", name: { kind: "Name", value: "updatedAt" } },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<CustomerDetailQuery, CustomerDetailQueryVariables>;
export const CustomerMetricsDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "CustomerMetrics" },
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "customerMetrics" },
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "totalCustomers" } },
                { kind: "Field", name: { kind: "Name", value: "activeCustomers" } },
                { kind: "Field", name: { kind: "Name", value: "newCustomers" } },
                { kind: "Field", name: { kind: "Name", value: "churnedCustomers" } },
                { kind: "Field", name: { kind: "Name", value: "totalCustomerValue" } },
                { kind: "Field", name: { kind: "Name", value: "averageCustomerValue" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<CustomerMetricsQuery, CustomerMetricsQueryVariables>;
export const CustomerActivitiesDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "CustomerActivities" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "id" } },
          type: {
            kind: "NonNullType",
            type: { kind: "NamedType", name: { kind: "Name", value: "ID" } },
          },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "customer" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "id" },
                value: { kind: "Variable", name: { kind: "Name", value: "id" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "includeActivities" },
                value: { kind: "BooleanValue", value: true },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "includeNotes" },
                value: { kind: "BooleanValue", value: false },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "id" } },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "activities" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "id" } },
                      { kind: "Field", name: { kind: "Name", value: "customerId" } },
                      { kind: "Field", name: { kind: "Name", value: "activityType" } },
                      { kind: "Field", name: { kind: "Name", value: "title" } },
                      { kind: "Field", name: { kind: "Name", value: "description" } },
                      { kind: "Field", name: { kind: "Name", value: "performedBy" } },
                      { kind: "Field", name: { kind: "Name", value: "createdAt" } },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<CustomerActivitiesQuery, CustomerActivitiesQueryVariables>;
export const CustomerNotesDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "CustomerNotes" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "id" } },
          type: {
            kind: "NonNullType",
            type: { kind: "NamedType", name: { kind: "Name", value: "ID" } },
          },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "customer" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "id" },
                value: { kind: "Variable", name: { kind: "Name", value: "id" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "includeActivities" },
                value: { kind: "BooleanValue", value: false },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "includeNotes" },
                value: { kind: "BooleanValue", value: true },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "id" } },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "notes" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "id" } },
                      { kind: "Field", name: { kind: "Name", value: "customerId" } },
                      { kind: "Field", name: { kind: "Name", value: "subject" } },
                      { kind: "Field", name: { kind: "Name", value: "content" } },
                      { kind: "Field", name: { kind: "Name", value: "isInternal" } },
                      { kind: "Field", name: { kind: "Name", value: "createdById" } },
                      { kind: "Field", name: { kind: "Name", value: "createdAt" } },
                      { kind: "Field", name: { kind: "Name", value: "updatedAt" } },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<CustomerNotesQuery, CustomerNotesQueryVariables>;
export const CustomerDashboardDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "CustomerDashboard" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "limit" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "Int" } },
          defaultValue: { kind: "IntValue", value: "20" },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "offset" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "Int" } },
          defaultValue: { kind: "IntValue", value: "0" },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "status" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "CustomerStatusEnum" } },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "search" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "String" } },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "customers" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "limit" },
                value: { kind: "Variable", name: { kind: "Name", value: "limit" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "offset" },
                value: { kind: "Variable", name: { kind: "Name", value: "offset" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "status" },
                value: { kind: "Variable", name: { kind: "Name", value: "status" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "search" },
                value: { kind: "Variable", name: { kind: "Name", value: "search" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "includeActivities" },
                value: { kind: "BooleanValue", value: false },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "includeNotes" },
                value: { kind: "BooleanValue", value: false },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                {
                  kind: "Field",
                  name: { kind: "Name", value: "customers" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "id" } },
                      { kind: "Field", name: { kind: "Name", value: "customerNumber" } },
                      { kind: "Field", name: { kind: "Name", value: "firstName" } },
                      { kind: "Field", name: { kind: "Name", value: "lastName" } },
                      { kind: "Field", name: { kind: "Name", value: "companyName" } },
                      { kind: "Field", name: { kind: "Name", value: "email" } },
                      { kind: "Field", name: { kind: "Name", value: "phone" } },
                      { kind: "Field", name: { kind: "Name", value: "status" } },
                      { kind: "Field", name: { kind: "Name", value: "customerType" } },
                      { kind: "Field", name: { kind: "Name", value: "tier" } },
                      { kind: "Field", name: { kind: "Name", value: "lifetimeValue" } },
                      { kind: "Field", name: { kind: "Name", value: "totalPurchases" } },
                      { kind: "Field", name: { kind: "Name", value: "lastContactDate" } },
                      { kind: "Field", name: { kind: "Name", value: "createdAt" } },
                    ],
                  },
                },
                { kind: "Field", name: { kind: "Name", value: "totalCount" } },
                { kind: "Field", name: { kind: "Name", value: "hasNextPage" } },
              ],
            },
          },
          {
            kind: "Field",
            name: { kind: "Name", value: "customerMetrics" },
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "totalCustomers" } },
                { kind: "Field", name: { kind: "Name", value: "activeCustomers" } },
                { kind: "Field", name: { kind: "Name", value: "newCustomers" } },
                { kind: "Field", name: { kind: "Name", value: "churnedCustomers" } },
                { kind: "Field", name: { kind: "Name", value: "totalCustomerValue" } },
                { kind: "Field", name: { kind: "Name", value: "averageCustomerValue" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<CustomerDashboardQuery, CustomerDashboardQueryVariables>;
export const CustomerSubscriptionsDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "CustomerSubscriptions" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "customerId" } },
          type: {
            kind: "NonNullType",
            type: { kind: "NamedType", name: { kind: "Name", value: "ID" } },
          },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "status" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "String" } },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "limit" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "Int" } },
          defaultValue: { kind: "IntValue", value: "50" },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "customerSubscriptions" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "customerId" },
                value: { kind: "Variable", name: { kind: "Name", value: "customerId" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "status" },
                value: { kind: "Variable", name: { kind: "Name", value: "status" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "limit" },
                value: { kind: "Variable", name: { kind: "Name", value: "limit" } },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "id" } },
                { kind: "Field", name: { kind: "Name", value: "subscriptionId" } },
                { kind: "Field", name: { kind: "Name", value: "customerId" } },
                { kind: "Field", name: { kind: "Name", value: "planId" } },
                { kind: "Field", name: { kind: "Name", value: "tenantId" } },
                { kind: "Field", name: { kind: "Name", value: "currentPeriodStart" } },
                { kind: "Field", name: { kind: "Name", value: "currentPeriodEnd" } },
                { kind: "Field", name: { kind: "Name", value: "status" } },
                { kind: "Field", name: { kind: "Name", value: "trialEnd" } },
                { kind: "Field", name: { kind: "Name", value: "isInTrial" } },
                { kind: "Field", name: { kind: "Name", value: "cancelAtPeriodEnd" } },
                { kind: "Field", name: { kind: "Name", value: "canceledAt" } },
                { kind: "Field", name: { kind: "Name", value: "endedAt" } },
                { kind: "Field", name: { kind: "Name", value: "createdAt" } },
                { kind: "Field", name: { kind: "Name", value: "updatedAt" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<CustomerSubscriptionsQuery, CustomerSubscriptionsQueryVariables>;
export const CustomerNetworkInfoDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "CustomerNetworkInfo" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "customerId" } },
          type: {
            kind: "NonNullType",
            type: { kind: "NamedType", name: { kind: "Name", value: "ID" } },
          },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "customerNetworkInfo" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "customerId" },
                value: { kind: "Variable", name: { kind: "Name", value: "customerId" } },
              },
            ],
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<CustomerNetworkInfoQuery, CustomerNetworkInfoQueryVariables>;
export const CustomerDevicesDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "CustomerDevices" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "customerId" } },
          type: {
            kind: "NonNullType",
            type: { kind: "NamedType", name: { kind: "Name", value: "ID" } },
          },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "deviceType" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "String" } },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "activeOnly" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "Boolean" } },
          defaultValue: { kind: "BooleanValue", value: true },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "customerDevices" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "customerId" },
                value: { kind: "Variable", name: { kind: "Name", value: "customerId" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "deviceType" },
                value: { kind: "Variable", name: { kind: "Name", value: "deviceType" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "activeOnly" },
                value: { kind: "Variable", name: { kind: "Name", value: "activeOnly" } },
              },
            ],
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<CustomerDevicesQuery, CustomerDevicesQueryVariables>;
export const CustomerTicketsDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "CustomerTickets" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "customerId" } },
          type: {
            kind: "NonNullType",
            type: { kind: "NamedType", name: { kind: "Name", value: "ID" } },
          },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "limit" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "Int" } },
          defaultValue: { kind: "IntValue", value: "50" },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "status" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "String" } },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "customerTickets" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "customerId" },
                value: { kind: "Variable", name: { kind: "Name", value: "customerId" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "limit" },
                value: { kind: "Variable", name: { kind: "Name", value: "limit" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "status" },
                value: { kind: "Variable", name: { kind: "Name", value: "status" } },
              },
            ],
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<CustomerTicketsQuery, CustomerTicketsQueryVariables>;
export const CustomerBillingDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "CustomerBilling" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "customerId" } },
          type: {
            kind: "NonNullType",
            type: { kind: "NamedType", name: { kind: "Name", value: "ID" } },
          },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "includeInvoices" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "Boolean" } },
          defaultValue: { kind: "BooleanValue", value: true },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "invoiceLimit" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "Int" } },
          defaultValue: { kind: "IntValue", value: "50" },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "customerBilling" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "customerId" },
                value: { kind: "Variable", name: { kind: "Name", value: "customerId" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "includeInvoices" },
                value: { kind: "Variable", name: { kind: "Name", value: "includeInvoices" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "invoiceLimit" },
                value: { kind: "Variable", name: { kind: "Name", value: "invoiceLimit" } },
              },
            ],
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<CustomerBillingQuery, CustomerBillingQueryVariables>;
export const Customer360ViewDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "Customer360View" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "customerId" } },
          type: {
            kind: "NonNullType",
            type: { kind: "NamedType", name: { kind: "Name", value: "ID" } },
          },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "customer" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "id" },
                value: { kind: "Variable", name: { kind: "Name", value: "customerId" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "includeActivities" },
                value: { kind: "BooleanValue", value: true },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "includeNotes" },
                value: { kind: "BooleanValue", value: true },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "id" } },
                { kind: "Field", name: { kind: "Name", value: "customerNumber" } },
                { kind: "Field", name: { kind: "Name", value: "firstName" } },
                { kind: "Field", name: { kind: "Name", value: "lastName" } },
                { kind: "Field", name: { kind: "Name", value: "middleName" } },
                { kind: "Field", name: { kind: "Name", value: "displayName" } },
                { kind: "Field", name: { kind: "Name", value: "companyName" } },
                { kind: "Field", name: { kind: "Name", value: "status" } },
                { kind: "Field", name: { kind: "Name", value: "customerType" } },
                { kind: "Field", name: { kind: "Name", value: "tier" } },
                { kind: "Field", name: { kind: "Name", value: "email" } },
                { kind: "Field", name: { kind: "Name", value: "emailVerified" } },
                { kind: "Field", name: { kind: "Name", value: "phone" } },
                { kind: "Field", name: { kind: "Name", value: "phoneVerified" } },
                { kind: "Field", name: { kind: "Name", value: "mobile" } },
                { kind: "Field", name: { kind: "Name", value: "addressLine1" } },
                { kind: "Field", name: { kind: "Name", value: "addressLine2" } },
                { kind: "Field", name: { kind: "Name", value: "city" } },
                { kind: "Field", name: { kind: "Name", value: "stateProvince" } },
                { kind: "Field", name: { kind: "Name", value: "postalCode" } },
                { kind: "Field", name: { kind: "Name", value: "country" } },
                { kind: "Field", name: { kind: "Name", value: "taxId" } },
                { kind: "Field", name: { kind: "Name", value: "industry" } },
                { kind: "Field", name: { kind: "Name", value: "employeeCount" } },
                { kind: "Field", name: { kind: "Name", value: "lifetimeValue" } },
                { kind: "Field", name: { kind: "Name", value: "totalPurchases" } },
                { kind: "Field", name: { kind: "Name", value: "averageOrderValue" } },
                { kind: "Field", name: { kind: "Name", value: "lastPurchaseDate" } },
                { kind: "Field", name: { kind: "Name", value: "createdAt" } },
                { kind: "Field", name: { kind: "Name", value: "updatedAt" } },
                { kind: "Field", name: { kind: "Name", value: "acquisitionDate" } },
                { kind: "Field", name: { kind: "Name", value: "lastContactDate" } },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "activities" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "id" } },
                      { kind: "Field", name: { kind: "Name", value: "customerId" } },
                      { kind: "Field", name: { kind: "Name", value: "activityType" } },
                      { kind: "Field", name: { kind: "Name", value: "title" } },
                      { kind: "Field", name: { kind: "Name", value: "description" } },
                      { kind: "Field", name: { kind: "Name", value: "performedBy" } },
                      { kind: "Field", name: { kind: "Name", value: "createdAt" } },
                    ],
                  },
                },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "notes" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "id" } },
                      { kind: "Field", name: { kind: "Name", value: "customerId" } },
                      { kind: "Field", name: { kind: "Name", value: "subject" } },
                      { kind: "Field", name: { kind: "Name", value: "content" } },
                      { kind: "Field", name: { kind: "Name", value: "isInternal" } },
                      { kind: "Field", name: { kind: "Name", value: "createdById" } },
                      { kind: "Field", name: { kind: "Name", value: "createdAt" } },
                      { kind: "Field", name: { kind: "Name", value: "updatedAt" } },
                    ],
                  },
                },
              ],
            },
          },
          {
            kind: "Field",
            name: { kind: "Name", value: "customerSubscriptions" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "customerId" },
                value: { kind: "Variable", name: { kind: "Name", value: "customerId" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "limit" },
                value: { kind: "IntValue", value: "10" },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "id" } },
                { kind: "Field", name: { kind: "Name", value: "subscriptionId" } },
                { kind: "Field", name: { kind: "Name", value: "customerId" } },
                { kind: "Field", name: { kind: "Name", value: "planId" } },
                { kind: "Field", name: { kind: "Name", value: "status" } },
                { kind: "Field", name: { kind: "Name", value: "currentPeriodStart" } },
                { kind: "Field", name: { kind: "Name", value: "currentPeriodEnd" } },
                { kind: "Field", name: { kind: "Name", value: "isInTrial" } },
                { kind: "Field", name: { kind: "Name", value: "cancelAtPeriodEnd" } },
                { kind: "Field", name: { kind: "Name", value: "createdAt" } },
              ],
            },
          },
          {
            kind: "Field",
            name: { kind: "Name", value: "customerNetworkInfo" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "customerId" },
                value: { kind: "Variable", name: { kind: "Name", value: "customerId" } },
              },
            ],
          },
          {
            kind: "Field",
            name: { kind: "Name", value: "customerDevices" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "customerId" },
                value: { kind: "Variable", name: { kind: "Name", value: "customerId" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "activeOnly" },
                value: { kind: "BooleanValue", value: true },
              },
            ],
          },
          {
            kind: "Field",
            name: { kind: "Name", value: "customerTickets" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "customerId" },
                value: { kind: "Variable", name: { kind: "Name", value: "customerId" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "limit" },
                value: { kind: "IntValue", value: "10" },
              },
            ],
          },
          {
            kind: "Field",
            name: { kind: "Name", value: "customerBilling" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "customerId" },
                value: { kind: "Variable", name: { kind: "Name", value: "customerId" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "includeInvoices" },
                value: { kind: "BooleanValue", value: true },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "invoiceLimit" },
                value: { kind: "IntValue", value: "10" },
              },
            ],
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<Customer360ViewQuery, Customer360ViewQueryVariables>;
export const CustomerNetworkStatusUpdatedDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "subscription",
      name: { kind: "Name", value: "CustomerNetworkStatusUpdated" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "customerId" } },
          type: {
            kind: "NonNullType",
            type: { kind: "NamedType", name: { kind: "Name", value: "ID" } },
          },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "customerNetworkStatusUpdated" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "customerId" },
                value: { kind: "Variable", name: { kind: "Name", value: "customerId" } },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "customerId" } },
                { kind: "Field", name: { kind: "Name", value: "connectionStatus" } },
                { kind: "Field", name: { kind: "Name", value: "lastSeenAt" } },
                { kind: "Field", name: { kind: "Name", value: "ipv4Address" } },
                { kind: "Field", name: { kind: "Name", value: "ipv6Address" } },
                { kind: "Field", name: { kind: "Name", value: "macAddress" } },
                { kind: "Field", name: { kind: "Name", value: "vlanId" } },
                { kind: "Field", name: { kind: "Name", value: "signalStrength" } },
                { kind: "Field", name: { kind: "Name", value: "signalQuality" } },
                { kind: "Field", name: { kind: "Name", value: "uptimeSeconds" } },
                { kind: "Field", name: { kind: "Name", value: "uptimePercentage" } },
                { kind: "Field", name: { kind: "Name", value: "bandwidthUsageMbps" } },
                { kind: "Field", name: { kind: "Name", value: "downloadSpeedMbps" } },
                { kind: "Field", name: { kind: "Name", value: "uploadSpeedMbps" } },
                { kind: "Field", name: { kind: "Name", value: "packetLoss" } },
                { kind: "Field", name: { kind: "Name", value: "latencyMs" } },
                { kind: "Field", name: { kind: "Name", value: "jitter" } },
                { kind: "Field", name: { kind: "Name", value: "ontRxPower" } },
                { kind: "Field", name: { kind: "Name", value: "ontTxPower" } },
                { kind: "Field", name: { kind: "Name", value: "oltRxPower" } },
                { kind: "Field", name: { kind: "Name", value: "serviceStatus" } },
                { kind: "Field", name: { kind: "Name", value: "updatedAt" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  CustomerNetworkStatusUpdatedSubscription,
  CustomerNetworkStatusUpdatedSubscriptionVariables
>;
export const CustomerDevicesUpdatedDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "subscription",
      name: { kind: "Name", value: "CustomerDevicesUpdated" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "customerId" } },
          type: {
            kind: "NonNullType",
            type: { kind: "NamedType", name: { kind: "Name", value: "ID" } },
          },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "customerDevicesUpdated" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "customerId" },
                value: { kind: "Variable", name: { kind: "Name", value: "customerId" } },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "customerId" } },
                { kind: "Field", name: { kind: "Name", value: "deviceId" } },
                { kind: "Field", name: { kind: "Name", value: "deviceType" } },
                { kind: "Field", name: { kind: "Name", value: "deviceName" } },
                { kind: "Field", name: { kind: "Name", value: "status" } },
                { kind: "Field", name: { kind: "Name", value: "healthStatus" } },
                { kind: "Field", name: { kind: "Name", value: "isOnline" } },
                { kind: "Field", name: { kind: "Name", value: "lastSeenAt" } },
                { kind: "Field", name: { kind: "Name", value: "signalStrength" } },
                { kind: "Field", name: { kind: "Name", value: "temperature" } },
                { kind: "Field", name: { kind: "Name", value: "cpuUsage" } },
                { kind: "Field", name: { kind: "Name", value: "memoryUsage" } },
                { kind: "Field", name: { kind: "Name", value: "uptimeSeconds" } },
                { kind: "Field", name: { kind: "Name", value: "firmwareVersion" } },
                { kind: "Field", name: { kind: "Name", value: "needsFirmwareUpdate" } },
                { kind: "Field", name: { kind: "Name", value: "changeType" } },
                { kind: "Field", name: { kind: "Name", value: "previousValue" } },
                { kind: "Field", name: { kind: "Name", value: "newValue" } },
                { kind: "Field", name: { kind: "Name", value: "updatedAt" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  CustomerDevicesUpdatedSubscription,
  CustomerDevicesUpdatedSubscriptionVariables
>;
export const CustomerTicketUpdatedDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "subscription",
      name: { kind: "Name", value: "CustomerTicketUpdated" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "customerId" } },
          type: {
            kind: "NonNullType",
            type: { kind: "NamedType", name: { kind: "Name", value: "ID" } },
          },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "customerTicketUpdated" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "customerId" },
                value: { kind: "Variable", name: { kind: "Name", value: "customerId" } },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "customerId" } },
                { kind: "Field", name: { kind: "Name", value: "action" } },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "ticket" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "id" } },
                      { kind: "Field", name: { kind: "Name", value: "ticketNumber" } },
                      { kind: "Field", name: { kind: "Name", value: "title" } },
                      { kind: "Field", name: { kind: "Name", value: "description" } },
                      { kind: "Field", name: { kind: "Name", value: "status" } },
                      { kind: "Field", name: { kind: "Name", value: "priority" } },
                      { kind: "Field", name: { kind: "Name", value: "category" } },
                      { kind: "Field", name: { kind: "Name", value: "subCategory" } },
                      { kind: "Field", name: { kind: "Name", value: "assignedTo" } },
                      { kind: "Field", name: { kind: "Name", value: "assignedToName" } },
                      { kind: "Field", name: { kind: "Name", value: "assignedTeam" } },
                      { kind: "Field", name: { kind: "Name", value: "createdAt" } },
                      { kind: "Field", name: { kind: "Name", value: "updatedAt" } },
                      { kind: "Field", name: { kind: "Name", value: "resolvedAt" } },
                      { kind: "Field", name: { kind: "Name", value: "closedAt" } },
                      { kind: "Field", name: { kind: "Name", value: "customerId" } },
                      { kind: "Field", name: { kind: "Name", value: "customerName" } },
                    ],
                  },
                },
                { kind: "Field", name: { kind: "Name", value: "changedBy" } },
                { kind: "Field", name: { kind: "Name", value: "changedByName" } },
                { kind: "Field", name: { kind: "Name", value: "changes" } },
                { kind: "Field", name: { kind: "Name", value: "comment" } },
                { kind: "Field", name: { kind: "Name", value: "updatedAt" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  CustomerTicketUpdatedSubscription,
  CustomerTicketUpdatedSubscriptionVariables
>;
export const CustomerActivityAddedDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "subscription",
      name: { kind: "Name", value: "CustomerActivityAdded" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "customerId" } },
          type: {
            kind: "NonNullType",
            type: { kind: "NamedType", name: { kind: "Name", value: "ID" } },
          },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "customerActivityAdded" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "customerId" },
                value: { kind: "Variable", name: { kind: "Name", value: "customerId" } },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "id" } },
                { kind: "Field", name: { kind: "Name", value: "customerId" } },
                { kind: "Field", name: { kind: "Name", value: "activityType" } },
                { kind: "Field", name: { kind: "Name", value: "title" } },
                { kind: "Field", name: { kind: "Name", value: "description" } },
                { kind: "Field", name: { kind: "Name", value: "performedBy" } },
                { kind: "Field", name: { kind: "Name", value: "performedByName" } },
                { kind: "Field", name: { kind: "Name", value: "createdAt" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  CustomerActivityAddedSubscription,
  CustomerActivityAddedSubscriptionVariables
>;
export const CustomerNoteUpdatedDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "subscription",
      name: { kind: "Name", value: "CustomerNoteUpdated" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "customerId" } },
          type: {
            kind: "NonNullType",
            type: { kind: "NamedType", name: { kind: "Name", value: "ID" } },
          },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "customerNoteUpdated" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "customerId" },
                value: { kind: "Variable", name: { kind: "Name", value: "customerId" } },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "customerId" } },
                { kind: "Field", name: { kind: "Name", value: "action" } },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "note" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "id" } },
                      { kind: "Field", name: { kind: "Name", value: "customerId" } },
                      { kind: "Field", name: { kind: "Name", value: "subject" } },
                      { kind: "Field", name: { kind: "Name", value: "content" } },
                      { kind: "Field", name: { kind: "Name", value: "isInternal" } },
                      { kind: "Field", name: { kind: "Name", value: "createdById" } },
                      { kind: "Field", name: { kind: "Name", value: "createdByName" } },
                      { kind: "Field", name: { kind: "Name", value: "createdAt" } },
                      { kind: "Field", name: { kind: "Name", value: "updatedAt" } },
                    ],
                  },
                },
                { kind: "Field", name: { kind: "Name", value: "changedBy" } },
                { kind: "Field", name: { kind: "Name", value: "changedByName" } },
                { kind: "Field", name: { kind: "Name", value: "updatedAt" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  CustomerNoteUpdatedSubscription,
  CustomerNoteUpdatedSubscriptionVariables
>;
export const FiberCableListDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "FiberCableList" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "limit" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "Int" } },
          defaultValue: { kind: "IntValue", value: "50" },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "offset" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "Int" } },
          defaultValue: { kind: "IntValue", value: "0" },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "status" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "FiberCableStatus" } },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "fiberType" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "FiberType" } },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "installationType" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "CableInstallationType" } },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "siteId" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "String" } },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "search" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "String" } },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "fiberCables" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "limit" },
                value: { kind: "Variable", name: { kind: "Name", value: "limit" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "offset" },
                value: { kind: "Variable", name: { kind: "Name", value: "offset" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "status" },
                value: { kind: "Variable", name: { kind: "Name", value: "status" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "fiberType" },
                value: { kind: "Variable", name: { kind: "Name", value: "fiberType" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "installationType" },
                value: { kind: "Variable", name: { kind: "Name", value: "installationType" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "siteId" },
                value: { kind: "Variable", name: { kind: "Name", value: "siteId" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "search" },
                value: { kind: "Variable", name: { kind: "Name", value: "search" } },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                {
                  kind: "Field",
                  name: { kind: "Name", value: "cables" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "id" } },
                      { kind: "Field", name: { kind: "Name", value: "cableId" } },
                      { kind: "Field", name: { kind: "Name", value: "name" } },
                      { kind: "Field", name: { kind: "Name", value: "description" } },
                      { kind: "Field", name: { kind: "Name", value: "status" } },
                      { kind: "Field", name: { kind: "Name", value: "isActive" } },
                      { kind: "Field", name: { kind: "Name", value: "fiberType" } },
                      { kind: "Field", name: { kind: "Name", value: "totalStrands" } },
                      { kind: "Field", name: { kind: "Name", value: "availableStrands" } },
                      { kind: "Field", name: { kind: "Name", value: "usedStrands" } },
                      { kind: "Field", name: { kind: "Name", value: "manufacturer" } },
                      { kind: "Field", name: { kind: "Name", value: "model" } },
                      { kind: "Field", name: { kind: "Name", value: "installationType" } },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "route" },
                        selectionSet: {
                          kind: "SelectionSet",
                          selections: [
                            { kind: "Field", name: { kind: "Name", value: "totalDistanceMeters" } },
                            {
                              kind: "Field",
                              name: { kind: "Name", value: "startPoint" },
                              selectionSet: {
                                kind: "SelectionSet",
                                selections: [
                                  { kind: "Field", name: { kind: "Name", value: "latitude" } },
                                  { kind: "Field", name: { kind: "Name", value: "longitude" } },
                                  { kind: "Field", name: { kind: "Name", value: "altitude" } },
                                ],
                              },
                            },
                            {
                              kind: "Field",
                              name: { kind: "Name", value: "endPoint" },
                              selectionSet: {
                                kind: "SelectionSet",
                                selections: [
                                  { kind: "Field", name: { kind: "Name", value: "latitude" } },
                                  { kind: "Field", name: { kind: "Name", value: "longitude" } },
                                  { kind: "Field", name: { kind: "Name", value: "altitude" } },
                                ],
                              },
                            },
                          ],
                        },
                      },
                      { kind: "Field", name: { kind: "Name", value: "lengthMeters" } },
                      { kind: "Field", name: { kind: "Name", value: "startDistributionPointId" } },
                      { kind: "Field", name: { kind: "Name", value: "endDistributionPointId" } },
                      { kind: "Field", name: { kind: "Name", value: "startPointName" } },
                      { kind: "Field", name: { kind: "Name", value: "endPointName" } },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "capacityUtilizationPercent" },
                      },
                      { kind: "Field", name: { kind: "Name", value: "bandwidthCapacityGbps" } },
                      { kind: "Field", name: { kind: "Name", value: "spliceCount" } },
                      { kind: "Field", name: { kind: "Name", value: "totalLossDb" } },
                      { kind: "Field", name: { kind: "Name", value: "averageAttenuationDbPerKm" } },
                      { kind: "Field", name: { kind: "Name", value: "maxAttenuationDbPerKm" } },
                      { kind: "Field", name: { kind: "Name", value: "isLeased" } },
                      { kind: "Field", name: { kind: "Name", value: "installedAt" } },
                      { kind: "Field", name: { kind: "Name", value: "createdAt" } },
                      { kind: "Field", name: { kind: "Name", value: "updatedAt" } },
                    ],
                  },
                },
                { kind: "Field", name: { kind: "Name", value: "totalCount" } },
                { kind: "Field", name: { kind: "Name", value: "hasNextPage" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<FiberCableListQuery, FiberCableListQueryVariables>;
export const FiberCableDetailDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "FiberCableDetail" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "id" } },
          type: {
            kind: "NonNullType",
            type: { kind: "NamedType", name: { kind: "Name", value: "ID" } },
          },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "fiberCable" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "id" },
                value: { kind: "Variable", name: { kind: "Name", value: "id" } },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "id" } },
                { kind: "Field", name: { kind: "Name", value: "cableId" } },
                { kind: "Field", name: { kind: "Name", value: "name" } },
                { kind: "Field", name: { kind: "Name", value: "description" } },
                { kind: "Field", name: { kind: "Name", value: "status" } },
                { kind: "Field", name: { kind: "Name", value: "isActive" } },
                { kind: "Field", name: { kind: "Name", value: "fiberType" } },
                { kind: "Field", name: { kind: "Name", value: "totalStrands" } },
                { kind: "Field", name: { kind: "Name", value: "availableStrands" } },
                { kind: "Field", name: { kind: "Name", value: "usedStrands" } },
                { kind: "Field", name: { kind: "Name", value: "manufacturer" } },
                { kind: "Field", name: { kind: "Name", value: "model" } },
                { kind: "Field", name: { kind: "Name", value: "installationType" } },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "route" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "pathGeojson" } },
                      { kind: "Field", name: { kind: "Name", value: "totalDistanceMeters" } },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "startPoint" },
                        selectionSet: {
                          kind: "SelectionSet",
                          selections: [
                            { kind: "Field", name: { kind: "Name", value: "latitude" } },
                            { kind: "Field", name: { kind: "Name", value: "longitude" } },
                            { kind: "Field", name: { kind: "Name", value: "altitude" } },
                          ],
                        },
                      },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "endPoint" },
                        selectionSet: {
                          kind: "SelectionSet",
                          selections: [
                            { kind: "Field", name: { kind: "Name", value: "latitude" } },
                            { kind: "Field", name: { kind: "Name", value: "longitude" } },
                            { kind: "Field", name: { kind: "Name", value: "altitude" } },
                          ],
                        },
                      },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "intermediatePoints" },
                        selectionSet: {
                          kind: "SelectionSet",
                          selections: [
                            { kind: "Field", name: { kind: "Name", value: "latitude" } },
                            { kind: "Field", name: { kind: "Name", value: "longitude" } },
                            { kind: "Field", name: { kind: "Name", value: "altitude" } },
                          ],
                        },
                      },
                      { kind: "Field", name: { kind: "Name", value: "elevationChangeMeters" } },
                      { kind: "Field", name: { kind: "Name", value: "undergroundDistanceMeters" } },
                      { kind: "Field", name: { kind: "Name", value: "aerialDistanceMeters" } },
                    ],
                  },
                },
                { kind: "Field", name: { kind: "Name", value: "lengthMeters" } },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "strands" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "strandId" } },
                      { kind: "Field", name: { kind: "Name", value: "colorCode" } },
                      { kind: "Field", name: { kind: "Name", value: "isActive" } },
                      { kind: "Field", name: { kind: "Name", value: "isAvailable" } },
                      { kind: "Field", name: { kind: "Name", value: "customerId" } },
                      { kind: "Field", name: { kind: "Name", value: "customerName" } },
                      { kind: "Field", name: { kind: "Name", value: "serviceId" } },
                      { kind: "Field", name: { kind: "Name", value: "attenuationDb" } },
                      { kind: "Field", name: { kind: "Name", value: "lossDb" } },
                      { kind: "Field", name: { kind: "Name", value: "spliceCount" } },
                    ],
                  },
                },
                { kind: "Field", name: { kind: "Name", value: "startDistributionPointId" } },
                { kind: "Field", name: { kind: "Name", value: "endDistributionPointId" } },
                { kind: "Field", name: { kind: "Name", value: "startPointName" } },
                { kind: "Field", name: { kind: "Name", value: "endPointName" } },
                { kind: "Field", name: { kind: "Name", value: "capacityUtilizationPercent" } },
                { kind: "Field", name: { kind: "Name", value: "bandwidthCapacityGbps" } },
                { kind: "Field", name: { kind: "Name", value: "splicePointIds" } },
                { kind: "Field", name: { kind: "Name", value: "spliceCount" } },
                { kind: "Field", name: { kind: "Name", value: "totalLossDb" } },
                { kind: "Field", name: { kind: "Name", value: "averageAttenuationDbPerKm" } },
                { kind: "Field", name: { kind: "Name", value: "maxAttenuationDbPerKm" } },
                { kind: "Field", name: { kind: "Name", value: "conduitId" } },
                { kind: "Field", name: { kind: "Name", value: "ductNumber" } },
                { kind: "Field", name: { kind: "Name", value: "armored" } },
                { kind: "Field", name: { kind: "Name", value: "fireRated" } },
                { kind: "Field", name: { kind: "Name", value: "ownerId" } },
                { kind: "Field", name: { kind: "Name", value: "ownerName" } },
                { kind: "Field", name: { kind: "Name", value: "isLeased" } },
                { kind: "Field", name: { kind: "Name", value: "installedAt" } },
                { kind: "Field", name: { kind: "Name", value: "testedAt" } },
                { kind: "Field", name: { kind: "Name", value: "createdAt" } },
                { kind: "Field", name: { kind: "Name", value: "updatedAt" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<FiberCableDetailQuery, FiberCableDetailQueryVariables>;
export const FiberCablesByRouteDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "FiberCablesByRoute" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "startPointId" } },
          type: {
            kind: "NonNullType",
            type: { kind: "NamedType", name: { kind: "Name", value: "String" } },
          },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "endPointId" } },
          type: {
            kind: "NonNullType",
            type: { kind: "NamedType", name: { kind: "Name", value: "String" } },
          },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "fiberCablesByRoute" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "startPointId" },
                value: { kind: "Variable", name: { kind: "Name", value: "startPointId" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "endPointId" },
                value: { kind: "Variable", name: { kind: "Name", value: "endPointId" } },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "id" } },
                { kind: "Field", name: { kind: "Name", value: "cableId" } },
                { kind: "Field", name: { kind: "Name", value: "name" } },
                { kind: "Field", name: { kind: "Name", value: "status" } },
                { kind: "Field", name: { kind: "Name", value: "totalStrands" } },
                { kind: "Field", name: { kind: "Name", value: "availableStrands" } },
                { kind: "Field", name: { kind: "Name", value: "lengthMeters" } },
                { kind: "Field", name: { kind: "Name", value: "capacityUtilizationPercent" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<FiberCablesByRouteQuery, FiberCablesByRouteQueryVariables>;
export const FiberCablesByDistributionPointDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "FiberCablesByDistributionPoint" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "distributionPointId" } },
          type: {
            kind: "NonNullType",
            type: { kind: "NamedType", name: { kind: "Name", value: "String" } },
          },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "fiberCablesByDistributionPoint" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "distributionPointId" },
                value: { kind: "Variable", name: { kind: "Name", value: "distributionPointId" } },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "id" } },
                { kind: "Field", name: { kind: "Name", value: "cableId" } },
                { kind: "Field", name: { kind: "Name", value: "name" } },
                { kind: "Field", name: { kind: "Name", value: "status" } },
                { kind: "Field", name: { kind: "Name", value: "totalStrands" } },
                { kind: "Field", name: { kind: "Name", value: "availableStrands" } },
                { kind: "Field", name: { kind: "Name", value: "lengthMeters" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  FiberCablesByDistributionPointQuery,
  FiberCablesByDistributionPointQueryVariables
>;
export const SplicePointListDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "SplicePointList" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "limit" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "Int" } },
          defaultValue: { kind: "IntValue", value: "50" },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "offset" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "Int" } },
          defaultValue: { kind: "IntValue", value: "0" },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "status" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "SpliceStatus" } },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "cableId" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "String" } },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "distributionPointId" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "String" } },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "splicePoints" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "limit" },
                value: { kind: "Variable", name: { kind: "Name", value: "limit" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "offset" },
                value: { kind: "Variable", name: { kind: "Name", value: "offset" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "status" },
                value: { kind: "Variable", name: { kind: "Name", value: "status" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "cableId" },
                value: { kind: "Variable", name: { kind: "Name", value: "cableId" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "distributionPointId" },
                value: { kind: "Variable", name: { kind: "Name", value: "distributionPointId" } },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                {
                  kind: "Field",
                  name: { kind: "Name", value: "splicePoints" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "id" } },
                      { kind: "Field", name: { kind: "Name", value: "spliceId" } },
                      { kind: "Field", name: { kind: "Name", value: "name" } },
                      { kind: "Field", name: { kind: "Name", value: "description" } },
                      { kind: "Field", name: { kind: "Name", value: "status" } },
                      { kind: "Field", name: { kind: "Name", value: "isActive" } },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "location" },
                        selectionSet: {
                          kind: "SelectionSet",
                          selections: [
                            { kind: "Field", name: { kind: "Name", value: "latitude" } },
                            { kind: "Field", name: { kind: "Name", value: "longitude" } },
                            { kind: "Field", name: { kind: "Name", value: "altitude" } },
                          ],
                        },
                      },
                      { kind: "Field", name: { kind: "Name", value: "closureType" } },
                      { kind: "Field", name: { kind: "Name", value: "manufacturer" } },
                      { kind: "Field", name: { kind: "Name", value: "model" } },
                      { kind: "Field", name: { kind: "Name", value: "trayCount" } },
                      { kind: "Field", name: { kind: "Name", value: "trayCapacity" } },
                      { kind: "Field", name: { kind: "Name", value: "cablesConnected" } },
                      { kind: "Field", name: { kind: "Name", value: "cableCount" } },
                      { kind: "Field", name: { kind: "Name", value: "totalSplices" } },
                      { kind: "Field", name: { kind: "Name", value: "activeSplices" } },
                      { kind: "Field", name: { kind: "Name", value: "averageSpliceLossDb" } },
                      { kind: "Field", name: { kind: "Name", value: "maxSpliceLossDb" } },
                      { kind: "Field", name: { kind: "Name", value: "passingSplices" } },
                      { kind: "Field", name: { kind: "Name", value: "failingSplices" } },
                      { kind: "Field", name: { kind: "Name", value: "accessType" } },
                      { kind: "Field", name: { kind: "Name", value: "requiresSpecialAccess" } },
                      { kind: "Field", name: { kind: "Name", value: "installedAt" } },
                      { kind: "Field", name: { kind: "Name", value: "lastTestedAt" } },
                      { kind: "Field", name: { kind: "Name", value: "lastMaintainedAt" } },
                      { kind: "Field", name: { kind: "Name", value: "createdAt" } },
                      { kind: "Field", name: { kind: "Name", value: "updatedAt" } },
                    ],
                  },
                },
                { kind: "Field", name: { kind: "Name", value: "totalCount" } },
                { kind: "Field", name: { kind: "Name", value: "hasNextPage" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<SplicePointListQuery, SplicePointListQueryVariables>;
export const SplicePointDetailDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "SplicePointDetail" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "id" } },
          type: {
            kind: "NonNullType",
            type: { kind: "NamedType", name: { kind: "Name", value: "ID" } },
          },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "splicePoint" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "id" },
                value: { kind: "Variable", name: { kind: "Name", value: "id" } },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "id" } },
                { kind: "Field", name: { kind: "Name", value: "spliceId" } },
                { kind: "Field", name: { kind: "Name", value: "name" } },
                { kind: "Field", name: { kind: "Name", value: "description" } },
                { kind: "Field", name: { kind: "Name", value: "status" } },
                { kind: "Field", name: { kind: "Name", value: "isActive" } },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "location" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "latitude" } },
                      { kind: "Field", name: { kind: "Name", value: "longitude" } },
                      { kind: "Field", name: { kind: "Name", value: "altitude" } },
                    ],
                  },
                },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "address" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "streetAddress" } },
                      { kind: "Field", name: { kind: "Name", value: "city" } },
                      { kind: "Field", name: { kind: "Name", value: "stateProvince" } },
                      { kind: "Field", name: { kind: "Name", value: "postalCode" } },
                      { kind: "Field", name: { kind: "Name", value: "country" } },
                    ],
                  },
                },
                { kind: "Field", name: { kind: "Name", value: "distributionPointId" } },
                { kind: "Field", name: { kind: "Name", value: "closureType" } },
                { kind: "Field", name: { kind: "Name", value: "manufacturer" } },
                { kind: "Field", name: { kind: "Name", value: "model" } },
                { kind: "Field", name: { kind: "Name", value: "trayCount" } },
                { kind: "Field", name: { kind: "Name", value: "trayCapacity" } },
                { kind: "Field", name: { kind: "Name", value: "cablesConnected" } },
                { kind: "Field", name: { kind: "Name", value: "cableCount" } },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "spliceConnections" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "cableAId" } },
                      { kind: "Field", name: { kind: "Name", value: "cableAStrand" } },
                      { kind: "Field", name: { kind: "Name", value: "cableBId" } },
                      { kind: "Field", name: { kind: "Name", value: "cableBStrand" } },
                      { kind: "Field", name: { kind: "Name", value: "spliceType" } },
                      { kind: "Field", name: { kind: "Name", value: "lossDb" } },
                      { kind: "Field", name: { kind: "Name", value: "reflectanceDb" } },
                      { kind: "Field", name: { kind: "Name", value: "isPassing" } },
                      { kind: "Field", name: { kind: "Name", value: "testResult" } },
                      { kind: "Field", name: { kind: "Name", value: "testedAt" } },
                      { kind: "Field", name: { kind: "Name", value: "testedBy" } },
                    ],
                  },
                },
                { kind: "Field", name: { kind: "Name", value: "totalSplices" } },
                { kind: "Field", name: { kind: "Name", value: "activeSplices" } },
                { kind: "Field", name: { kind: "Name", value: "averageSpliceLossDb" } },
                { kind: "Field", name: { kind: "Name", value: "maxSpliceLossDb" } },
                { kind: "Field", name: { kind: "Name", value: "passingSplices" } },
                { kind: "Field", name: { kind: "Name", value: "failingSplices" } },
                { kind: "Field", name: { kind: "Name", value: "accessType" } },
                { kind: "Field", name: { kind: "Name", value: "requiresSpecialAccess" } },
                { kind: "Field", name: { kind: "Name", value: "accessNotes" } },
                { kind: "Field", name: { kind: "Name", value: "installedAt" } },
                { kind: "Field", name: { kind: "Name", value: "lastTestedAt" } },
                { kind: "Field", name: { kind: "Name", value: "lastMaintainedAt" } },
                { kind: "Field", name: { kind: "Name", value: "createdAt" } },
                { kind: "Field", name: { kind: "Name", value: "updatedAt" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<SplicePointDetailQuery, SplicePointDetailQueryVariables>;
export const SplicePointsByCableDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "SplicePointsByCable" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "cableId" } },
          type: {
            kind: "NonNullType",
            type: { kind: "NamedType", name: { kind: "Name", value: "String" } },
          },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "splicePointsByCable" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "cableId" },
                value: { kind: "Variable", name: { kind: "Name", value: "cableId" } },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "id" } },
                { kind: "Field", name: { kind: "Name", value: "spliceId" } },
                { kind: "Field", name: { kind: "Name", value: "name" } },
                { kind: "Field", name: { kind: "Name", value: "status" } },
                { kind: "Field", name: { kind: "Name", value: "totalSplices" } },
                { kind: "Field", name: { kind: "Name", value: "activeSplices" } },
                { kind: "Field", name: { kind: "Name", value: "averageSpliceLossDb" } },
                { kind: "Field", name: { kind: "Name", value: "passingSplices" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<SplicePointsByCableQuery, SplicePointsByCableQueryVariables>;
export const DistributionPointListDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "DistributionPointList" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "limit" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "Int" } },
          defaultValue: { kind: "IntValue", value: "50" },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "offset" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "Int" } },
          defaultValue: { kind: "IntValue", value: "0" },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "pointType" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "DistributionPointType" } },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "status" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "FiberCableStatus" } },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "siteId" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "String" } },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "nearCapacity" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "Boolean" } },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "distributionPoints" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "limit" },
                value: { kind: "Variable", name: { kind: "Name", value: "limit" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "offset" },
                value: { kind: "Variable", name: { kind: "Name", value: "offset" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "pointType" },
                value: { kind: "Variable", name: { kind: "Name", value: "pointType" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "status" },
                value: { kind: "Variable", name: { kind: "Name", value: "status" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "siteId" },
                value: { kind: "Variable", name: { kind: "Name", value: "siteId" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "nearCapacity" },
                value: { kind: "Variable", name: { kind: "Name", value: "nearCapacity" } },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                {
                  kind: "Field",
                  name: { kind: "Name", value: "distributionPoints" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "id" } },
                      { kind: "Field", name: { kind: "Name", value: "siteId" } },
                      { kind: "Field", name: { kind: "Name", value: "name" } },
                      { kind: "Field", name: { kind: "Name", value: "description" } },
                      { kind: "Field", name: { kind: "Name", value: "pointType" } },
                      { kind: "Field", name: { kind: "Name", value: "status" } },
                      { kind: "Field", name: { kind: "Name", value: "isActive" } },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "location" },
                        selectionSet: {
                          kind: "SelectionSet",
                          selections: [
                            { kind: "Field", name: { kind: "Name", value: "latitude" } },
                            { kind: "Field", name: { kind: "Name", value: "longitude" } },
                            { kind: "Field", name: { kind: "Name", value: "altitude" } },
                          ],
                        },
                      },
                      { kind: "Field", name: { kind: "Name", value: "manufacturer" } },
                      { kind: "Field", name: { kind: "Name", value: "model" } },
                      { kind: "Field", name: { kind: "Name", value: "totalCapacity" } },
                      { kind: "Field", name: { kind: "Name", value: "availableCapacity" } },
                      { kind: "Field", name: { kind: "Name", value: "usedCapacity" } },
                      { kind: "Field", name: { kind: "Name", value: "portCount" } },
                      { kind: "Field", name: { kind: "Name", value: "incomingCables" } },
                      { kind: "Field", name: { kind: "Name", value: "outgoingCables" } },
                      { kind: "Field", name: { kind: "Name", value: "totalCablesConnected" } },
                      { kind: "Field", name: { kind: "Name", value: "splicePointCount" } },
                      { kind: "Field", name: { kind: "Name", value: "hasPower" } },
                      { kind: "Field", name: { kind: "Name", value: "batteryBackup" } },
                      { kind: "Field", name: { kind: "Name", value: "environmentalMonitoring" } },
                      { kind: "Field", name: { kind: "Name", value: "temperatureCelsius" } },
                      { kind: "Field", name: { kind: "Name", value: "humidityPercent" } },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "capacityUtilizationPercent" },
                      },
                      { kind: "Field", name: { kind: "Name", value: "fiberStrandCount" } },
                      { kind: "Field", name: { kind: "Name", value: "availableStrandCount" } },
                      { kind: "Field", name: { kind: "Name", value: "servesCustomerCount" } },
                      { kind: "Field", name: { kind: "Name", value: "accessType" } },
                      { kind: "Field", name: { kind: "Name", value: "requiresKey" } },
                      { kind: "Field", name: { kind: "Name", value: "installedAt" } },
                      { kind: "Field", name: { kind: "Name", value: "lastInspectedAt" } },
                      { kind: "Field", name: { kind: "Name", value: "lastMaintainedAt" } },
                      { kind: "Field", name: { kind: "Name", value: "createdAt" } },
                      { kind: "Field", name: { kind: "Name", value: "updatedAt" } },
                    ],
                  },
                },
                { kind: "Field", name: { kind: "Name", value: "totalCount" } },
                { kind: "Field", name: { kind: "Name", value: "hasNextPage" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<DistributionPointListQuery, DistributionPointListQueryVariables>;
export const DistributionPointDetailDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "DistributionPointDetail" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "id" } },
          type: {
            kind: "NonNullType",
            type: { kind: "NamedType", name: { kind: "Name", value: "ID" } },
          },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "distributionPoint" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "id" },
                value: { kind: "Variable", name: { kind: "Name", value: "id" } },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "id" } },
                { kind: "Field", name: { kind: "Name", value: "siteId" } },
                { kind: "Field", name: { kind: "Name", value: "name" } },
                { kind: "Field", name: { kind: "Name", value: "description" } },
                { kind: "Field", name: { kind: "Name", value: "pointType" } },
                { kind: "Field", name: { kind: "Name", value: "status" } },
                { kind: "Field", name: { kind: "Name", value: "isActive" } },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "location" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "latitude" } },
                      { kind: "Field", name: { kind: "Name", value: "longitude" } },
                      { kind: "Field", name: { kind: "Name", value: "altitude" } },
                    ],
                  },
                },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "address" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "streetAddress" } },
                      { kind: "Field", name: { kind: "Name", value: "city" } },
                      { kind: "Field", name: { kind: "Name", value: "stateProvince" } },
                      { kind: "Field", name: { kind: "Name", value: "postalCode" } },
                      { kind: "Field", name: { kind: "Name", value: "country" } },
                    ],
                  },
                },
                { kind: "Field", name: { kind: "Name", value: "siteName" } },
                { kind: "Field", name: { kind: "Name", value: "manufacturer" } },
                { kind: "Field", name: { kind: "Name", value: "model" } },
                { kind: "Field", name: { kind: "Name", value: "totalCapacity" } },
                { kind: "Field", name: { kind: "Name", value: "availableCapacity" } },
                { kind: "Field", name: { kind: "Name", value: "usedCapacity" } },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "ports" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "portNumber" } },
                      { kind: "Field", name: { kind: "Name", value: "isAllocated" } },
                      { kind: "Field", name: { kind: "Name", value: "isActive" } },
                      { kind: "Field", name: { kind: "Name", value: "cableId" } },
                      { kind: "Field", name: { kind: "Name", value: "strandId" } },
                      { kind: "Field", name: { kind: "Name", value: "customerId" } },
                      { kind: "Field", name: { kind: "Name", value: "customerName" } },
                      { kind: "Field", name: { kind: "Name", value: "serviceId" } },
                    ],
                  },
                },
                { kind: "Field", name: { kind: "Name", value: "portCount" } },
                { kind: "Field", name: { kind: "Name", value: "incomingCables" } },
                { kind: "Field", name: { kind: "Name", value: "outgoingCables" } },
                { kind: "Field", name: { kind: "Name", value: "totalCablesConnected" } },
                { kind: "Field", name: { kind: "Name", value: "splicePoints" } },
                { kind: "Field", name: { kind: "Name", value: "splicePointCount" } },
                { kind: "Field", name: { kind: "Name", value: "hasPower" } },
                { kind: "Field", name: { kind: "Name", value: "batteryBackup" } },
                { kind: "Field", name: { kind: "Name", value: "environmentalMonitoring" } },
                { kind: "Field", name: { kind: "Name", value: "temperatureCelsius" } },
                { kind: "Field", name: { kind: "Name", value: "humidityPercent" } },
                { kind: "Field", name: { kind: "Name", value: "capacityUtilizationPercent" } },
                { kind: "Field", name: { kind: "Name", value: "fiberStrandCount" } },
                { kind: "Field", name: { kind: "Name", value: "availableStrandCount" } },
                { kind: "Field", name: { kind: "Name", value: "serviceAreaIds" } },
                { kind: "Field", name: { kind: "Name", value: "servesCustomerCount" } },
                { kind: "Field", name: { kind: "Name", value: "accessType" } },
                { kind: "Field", name: { kind: "Name", value: "requiresKey" } },
                { kind: "Field", name: { kind: "Name", value: "securityLevel" } },
                { kind: "Field", name: { kind: "Name", value: "accessNotes" } },
                { kind: "Field", name: { kind: "Name", value: "installedAt" } },
                { kind: "Field", name: { kind: "Name", value: "lastInspectedAt" } },
                { kind: "Field", name: { kind: "Name", value: "lastMaintainedAt" } },
                { kind: "Field", name: { kind: "Name", value: "createdAt" } },
                { kind: "Field", name: { kind: "Name", value: "updatedAt" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<DistributionPointDetailQuery, DistributionPointDetailQueryVariables>;
export const DistributionPointsBySiteDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "DistributionPointsBySite" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "siteId" } },
          type: {
            kind: "NonNullType",
            type: { kind: "NamedType", name: { kind: "Name", value: "String" } },
          },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "distributionPointsBySite" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "siteId" },
                value: { kind: "Variable", name: { kind: "Name", value: "siteId" } },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "id" } },
                { kind: "Field", name: { kind: "Name", value: "name" } },
                { kind: "Field", name: { kind: "Name", value: "pointType" } },
                { kind: "Field", name: { kind: "Name", value: "status" } },
                { kind: "Field", name: { kind: "Name", value: "totalCapacity" } },
                { kind: "Field", name: { kind: "Name", value: "availableCapacity" } },
                { kind: "Field", name: { kind: "Name", value: "capacityUtilizationPercent" } },
                { kind: "Field", name: { kind: "Name", value: "totalCablesConnected" } },
                { kind: "Field", name: { kind: "Name", value: "servesCustomerCount" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<DistributionPointsBySiteQuery, DistributionPointsBySiteQueryVariables>;
export const ServiceAreaListDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "ServiceAreaList" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "limit" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "Int" } },
          defaultValue: { kind: "IntValue", value: "50" },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "offset" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "Int" } },
          defaultValue: { kind: "IntValue", value: "0" },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "areaType" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "ServiceAreaType" } },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "isServiceable" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "Boolean" } },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "constructionStatus" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "String" } },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "serviceAreas" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "limit" },
                value: { kind: "Variable", name: { kind: "Name", value: "limit" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "offset" },
                value: { kind: "Variable", name: { kind: "Name", value: "offset" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "areaType" },
                value: { kind: "Variable", name: { kind: "Name", value: "areaType" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "isServiceable" },
                value: { kind: "Variable", name: { kind: "Name", value: "isServiceable" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "constructionStatus" },
                value: { kind: "Variable", name: { kind: "Name", value: "constructionStatus" } },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                {
                  kind: "Field",
                  name: { kind: "Name", value: "serviceAreas" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "id" } },
                      { kind: "Field", name: { kind: "Name", value: "areaId" } },
                      { kind: "Field", name: { kind: "Name", value: "name" } },
                      { kind: "Field", name: { kind: "Name", value: "description" } },
                      { kind: "Field", name: { kind: "Name", value: "areaType" } },
                      { kind: "Field", name: { kind: "Name", value: "isActive" } },
                      { kind: "Field", name: { kind: "Name", value: "isServiceable" } },
                      { kind: "Field", name: { kind: "Name", value: "boundaryGeojson" } },
                      { kind: "Field", name: { kind: "Name", value: "areaSqkm" } },
                      { kind: "Field", name: { kind: "Name", value: "city" } },
                      { kind: "Field", name: { kind: "Name", value: "stateProvince" } },
                      { kind: "Field", name: { kind: "Name", value: "postalCodes" } },
                      { kind: "Field", name: { kind: "Name", value: "streetCount" } },
                      { kind: "Field", name: { kind: "Name", value: "homesPassed" } },
                      { kind: "Field", name: { kind: "Name", value: "homesConnected" } },
                      { kind: "Field", name: { kind: "Name", value: "businessesPassed" } },
                      { kind: "Field", name: { kind: "Name", value: "businessesConnected" } },
                      { kind: "Field", name: { kind: "Name", value: "penetrationRatePercent" } },
                      { kind: "Field", name: { kind: "Name", value: "distributionPointCount" } },
                      { kind: "Field", name: { kind: "Name", value: "totalFiberKm" } },
                      { kind: "Field", name: { kind: "Name", value: "totalCapacity" } },
                      { kind: "Field", name: { kind: "Name", value: "usedCapacity" } },
                      { kind: "Field", name: { kind: "Name", value: "availableCapacity" } },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "capacityUtilizationPercent" },
                      },
                      { kind: "Field", name: { kind: "Name", value: "maxBandwidthGbps" } },
                      { kind: "Field", name: { kind: "Name", value: "estimatedPopulation" } },
                      { kind: "Field", name: { kind: "Name", value: "householdDensityPerSqkm" } },
                      { kind: "Field", name: { kind: "Name", value: "constructionStatus" } },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "constructionCompletePercent" },
                      },
                      { kind: "Field", name: { kind: "Name", value: "targetCompletionDate" } },
                      { kind: "Field", name: { kind: "Name", value: "plannedAt" } },
                      { kind: "Field", name: { kind: "Name", value: "constructionStartedAt" } },
                      { kind: "Field", name: { kind: "Name", value: "activatedAt" } },
                      { kind: "Field", name: { kind: "Name", value: "createdAt" } },
                      { kind: "Field", name: { kind: "Name", value: "updatedAt" } },
                    ],
                  },
                },
                { kind: "Field", name: { kind: "Name", value: "totalCount" } },
                { kind: "Field", name: { kind: "Name", value: "hasNextPage" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<ServiceAreaListQuery, ServiceAreaListQueryVariables>;
export const ServiceAreaDetailDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "ServiceAreaDetail" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "id" } },
          type: {
            kind: "NonNullType",
            type: { kind: "NamedType", name: { kind: "Name", value: "ID" } },
          },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "serviceArea" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "id" },
                value: { kind: "Variable", name: { kind: "Name", value: "id" } },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "id" } },
                { kind: "Field", name: { kind: "Name", value: "areaId" } },
                { kind: "Field", name: { kind: "Name", value: "name" } },
                { kind: "Field", name: { kind: "Name", value: "description" } },
                { kind: "Field", name: { kind: "Name", value: "areaType" } },
                { kind: "Field", name: { kind: "Name", value: "isActive" } },
                { kind: "Field", name: { kind: "Name", value: "isServiceable" } },
                { kind: "Field", name: { kind: "Name", value: "boundaryGeojson" } },
                { kind: "Field", name: { kind: "Name", value: "areaSqkm" } },
                { kind: "Field", name: { kind: "Name", value: "city" } },
                { kind: "Field", name: { kind: "Name", value: "stateProvince" } },
                { kind: "Field", name: { kind: "Name", value: "postalCodes" } },
                { kind: "Field", name: { kind: "Name", value: "streetCount" } },
                { kind: "Field", name: { kind: "Name", value: "homesPassed" } },
                { kind: "Field", name: { kind: "Name", value: "homesConnected" } },
                { kind: "Field", name: { kind: "Name", value: "businessesPassed" } },
                { kind: "Field", name: { kind: "Name", value: "businessesConnected" } },
                { kind: "Field", name: { kind: "Name", value: "penetrationRatePercent" } },
                { kind: "Field", name: { kind: "Name", value: "distributionPointIds" } },
                { kind: "Field", name: { kind: "Name", value: "distributionPointCount" } },
                { kind: "Field", name: { kind: "Name", value: "totalFiberKm" } },
                { kind: "Field", name: { kind: "Name", value: "totalCapacity" } },
                { kind: "Field", name: { kind: "Name", value: "usedCapacity" } },
                { kind: "Field", name: { kind: "Name", value: "availableCapacity" } },
                { kind: "Field", name: { kind: "Name", value: "capacityUtilizationPercent" } },
                { kind: "Field", name: { kind: "Name", value: "maxBandwidthGbps" } },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "averageDistanceToDistributionMeters" },
                },
                { kind: "Field", name: { kind: "Name", value: "estimatedPopulation" } },
                { kind: "Field", name: { kind: "Name", value: "householdDensityPerSqkm" } },
                { kind: "Field", name: { kind: "Name", value: "constructionStatus" } },
                { kind: "Field", name: { kind: "Name", value: "constructionCompletePercent" } },
                { kind: "Field", name: { kind: "Name", value: "targetCompletionDate" } },
                { kind: "Field", name: { kind: "Name", value: "plannedAt" } },
                { kind: "Field", name: { kind: "Name", value: "constructionStartedAt" } },
                { kind: "Field", name: { kind: "Name", value: "activatedAt" } },
                { kind: "Field", name: { kind: "Name", value: "createdAt" } },
                { kind: "Field", name: { kind: "Name", value: "updatedAt" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<ServiceAreaDetailQuery, ServiceAreaDetailQueryVariables>;
export const ServiceAreasByPostalCodeDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "ServiceAreasByPostalCode" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "postalCode" } },
          type: {
            kind: "NonNullType",
            type: { kind: "NamedType", name: { kind: "Name", value: "String" } },
          },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "serviceAreasByPostalCode" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "postalCode" },
                value: { kind: "Variable", name: { kind: "Name", value: "postalCode" } },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "id" } },
                { kind: "Field", name: { kind: "Name", value: "areaId" } },
                { kind: "Field", name: { kind: "Name", value: "name" } },
                { kind: "Field", name: { kind: "Name", value: "city" } },
                { kind: "Field", name: { kind: "Name", value: "stateProvince" } },
                { kind: "Field", name: { kind: "Name", value: "isServiceable" } },
                { kind: "Field", name: { kind: "Name", value: "homesPassed" } },
                { kind: "Field", name: { kind: "Name", value: "homesConnected" } },
                { kind: "Field", name: { kind: "Name", value: "penetrationRatePercent" } },
                { kind: "Field", name: { kind: "Name", value: "maxBandwidthGbps" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<ServiceAreasByPostalCodeQuery, ServiceAreasByPostalCodeQueryVariables>;
export const FiberHealthMetricsDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "FiberHealthMetrics" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "cableId" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "String" } },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "healthStatus" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "FiberHealthStatus" } },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "fiberHealthMetrics" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "cableId" },
                value: { kind: "Variable", name: { kind: "Name", value: "cableId" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "healthStatus" },
                value: { kind: "Variable", name: { kind: "Name", value: "healthStatus" } },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "cableId" } },
                { kind: "Field", name: { kind: "Name", value: "cableName" } },
                { kind: "Field", name: { kind: "Name", value: "healthStatus" } },
                { kind: "Field", name: { kind: "Name", value: "healthScore" } },
                { kind: "Field", name: { kind: "Name", value: "totalLossDb" } },
                { kind: "Field", name: { kind: "Name", value: "averageLossPerKmDb" } },
                { kind: "Field", name: { kind: "Name", value: "maxLossPerKmDb" } },
                { kind: "Field", name: { kind: "Name", value: "reflectanceDb" } },
                { kind: "Field", name: { kind: "Name", value: "averageSpliceLossDb" } },
                { kind: "Field", name: { kind: "Name", value: "maxSpliceLossDb" } },
                { kind: "Field", name: { kind: "Name", value: "failingSplicesCount" } },
                { kind: "Field", name: { kind: "Name", value: "totalStrands" } },
                { kind: "Field", name: { kind: "Name", value: "activeStrands" } },
                { kind: "Field", name: { kind: "Name", value: "degradedStrands" } },
                { kind: "Field", name: { kind: "Name", value: "failedStrands" } },
                { kind: "Field", name: { kind: "Name", value: "lastTestedAt" } },
                { kind: "Field", name: { kind: "Name", value: "testPassRatePercent" } },
                { kind: "Field", name: { kind: "Name", value: "daysSinceLastTest" } },
                { kind: "Field", name: { kind: "Name", value: "activeAlarms" } },
                { kind: "Field", name: { kind: "Name", value: "warningCount" } },
                { kind: "Field", name: { kind: "Name", value: "requiresMaintenance" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<FiberHealthMetricsQuery, FiberHealthMetricsQueryVariables>;
export const OtdrTestResultsDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "OTDRTestResults" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "cableId" } },
          type: {
            kind: "NonNullType",
            type: { kind: "NamedType", name: { kind: "Name", value: "String" } },
          },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "strandId" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "Int" } },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "limit" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "Int" } },
          defaultValue: { kind: "IntValue", value: "10" },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "otdrTestResults" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "cableId" },
                value: { kind: "Variable", name: { kind: "Name", value: "cableId" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "strandId" },
                value: { kind: "Variable", name: { kind: "Name", value: "strandId" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "limit" },
                value: { kind: "Variable", name: { kind: "Name", value: "limit" } },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "testId" } },
                { kind: "Field", name: { kind: "Name", value: "cableId" } },
                { kind: "Field", name: { kind: "Name", value: "strandId" } },
                { kind: "Field", name: { kind: "Name", value: "testedAt" } },
                { kind: "Field", name: { kind: "Name", value: "testedBy" } },
                { kind: "Field", name: { kind: "Name", value: "wavelengthNm" } },
                { kind: "Field", name: { kind: "Name", value: "pulseWidthNs" } },
                { kind: "Field", name: { kind: "Name", value: "totalLossDb" } },
                { kind: "Field", name: { kind: "Name", value: "totalLengthMeters" } },
                { kind: "Field", name: { kind: "Name", value: "averageAttenuationDbPerKm" } },
                { kind: "Field", name: { kind: "Name", value: "spliceCount" } },
                { kind: "Field", name: { kind: "Name", value: "connectorCount" } },
                { kind: "Field", name: { kind: "Name", value: "bendCount" } },
                { kind: "Field", name: { kind: "Name", value: "breakCount" } },
                { kind: "Field", name: { kind: "Name", value: "isPassing" } },
                { kind: "Field", name: { kind: "Name", value: "passThresholdDb" } },
                { kind: "Field", name: { kind: "Name", value: "marginDb" } },
                { kind: "Field", name: { kind: "Name", value: "traceFileUrl" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<OtdrTestResultsQuery, OtdrTestResultsQueryVariables>;
export const FiberNetworkAnalyticsDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "FiberNetworkAnalytics" },
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "fiberNetworkAnalytics" },
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "totalFiberKm" } },
                { kind: "Field", name: { kind: "Name", value: "totalCables" } },
                { kind: "Field", name: { kind: "Name", value: "totalStrands" } },
                { kind: "Field", name: { kind: "Name", value: "totalDistributionPoints" } },
                { kind: "Field", name: { kind: "Name", value: "totalSplicePoints" } },
                { kind: "Field", name: { kind: "Name", value: "totalCapacity" } },
                { kind: "Field", name: { kind: "Name", value: "usedCapacity" } },
                { kind: "Field", name: { kind: "Name", value: "availableCapacity" } },
                { kind: "Field", name: { kind: "Name", value: "capacityUtilizationPercent" } },
                { kind: "Field", name: { kind: "Name", value: "healthyCables" } },
                { kind: "Field", name: { kind: "Name", value: "degradedCables" } },
                { kind: "Field", name: { kind: "Name", value: "failedCables" } },
                { kind: "Field", name: { kind: "Name", value: "networkHealthScore" } },
                { kind: "Field", name: { kind: "Name", value: "totalServiceAreas" } },
                { kind: "Field", name: { kind: "Name", value: "activeServiceAreas" } },
                { kind: "Field", name: { kind: "Name", value: "homesPassed" } },
                { kind: "Field", name: { kind: "Name", value: "homesConnected" } },
                { kind: "Field", name: { kind: "Name", value: "penetrationRatePercent" } },
                { kind: "Field", name: { kind: "Name", value: "averageCableLossDbPerKm" } },
                { kind: "Field", name: { kind: "Name", value: "averageSpliceLossDb" } },
                { kind: "Field", name: { kind: "Name", value: "cablesDueForTesting" } },
                { kind: "Field", name: { kind: "Name", value: "cablesActive" } },
                { kind: "Field", name: { kind: "Name", value: "cablesInactive" } },
                { kind: "Field", name: { kind: "Name", value: "cablesUnderConstruction" } },
                { kind: "Field", name: { kind: "Name", value: "cablesMaintenance" } },
                { kind: "Field", name: { kind: "Name", value: "cablesWithHighLoss" } },
                { kind: "Field", name: { kind: "Name", value: "distributionPointsNearCapacity" } },
                { kind: "Field", name: { kind: "Name", value: "serviceAreasNeedsExpansion" } },
                { kind: "Field", name: { kind: "Name", value: "generatedAt" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<FiberNetworkAnalyticsQuery, FiberNetworkAnalyticsQueryVariables>;
export const FiberDashboardDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "FiberDashboard" },
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "fiberDashboard" },
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                {
                  kind: "Field",
                  name: { kind: "Name", value: "analytics" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "totalFiberKm" } },
                      { kind: "Field", name: { kind: "Name", value: "totalCables" } },
                      { kind: "Field", name: { kind: "Name", value: "totalStrands" } },
                      { kind: "Field", name: { kind: "Name", value: "totalDistributionPoints" } },
                      { kind: "Field", name: { kind: "Name", value: "totalSplicePoints" } },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "capacityUtilizationPercent" },
                      },
                      { kind: "Field", name: { kind: "Name", value: "networkHealthScore" } },
                      { kind: "Field", name: { kind: "Name", value: "homesPassed" } },
                      { kind: "Field", name: { kind: "Name", value: "homesConnected" } },
                      { kind: "Field", name: { kind: "Name", value: "penetrationRatePercent" } },
                    ],
                  },
                },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "topCablesByUtilization" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "id" } },
                      { kind: "Field", name: { kind: "Name", value: "cableId" } },
                      { kind: "Field", name: { kind: "Name", value: "name" } },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "capacityUtilizationPercent" },
                      },
                      { kind: "Field", name: { kind: "Name", value: "totalStrands" } },
                      { kind: "Field", name: { kind: "Name", value: "usedStrands" } },
                    ],
                  },
                },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "topDistributionPointsByCapacity" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "id" } },
                      { kind: "Field", name: { kind: "Name", value: "name" } },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "capacityUtilizationPercent" },
                      },
                      { kind: "Field", name: { kind: "Name", value: "totalCapacity" } },
                      { kind: "Field", name: { kind: "Name", value: "usedCapacity" } },
                    ],
                  },
                },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "topServiceAreasByPenetration" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "id" } },
                      { kind: "Field", name: { kind: "Name", value: "name" } },
                      { kind: "Field", name: { kind: "Name", value: "city" } },
                      { kind: "Field", name: { kind: "Name", value: "penetrationRatePercent" } },
                      { kind: "Field", name: { kind: "Name", value: "homesPassed" } },
                      { kind: "Field", name: { kind: "Name", value: "homesConnected" } },
                    ],
                  },
                },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "cablesRequiringAttention" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "cableId" } },
                      { kind: "Field", name: { kind: "Name", value: "cableName" } },
                      { kind: "Field", name: { kind: "Name", value: "healthStatus" } },
                      { kind: "Field", name: { kind: "Name", value: "healthScore" } },
                      { kind: "Field", name: { kind: "Name", value: "requiresMaintenance" } },
                    ],
                  },
                },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "recentTestResults" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "testId" } },
                      { kind: "Field", name: { kind: "Name", value: "cableId" } },
                      { kind: "Field", name: { kind: "Name", value: "strandId" } },
                      { kind: "Field", name: { kind: "Name", value: "testedAt" } },
                      { kind: "Field", name: { kind: "Name", value: "isPassing" } },
                      { kind: "Field", name: { kind: "Name", value: "totalLossDb" } },
                    ],
                  },
                },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "distributionPointsNearCapacity" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "id" } },
                      { kind: "Field", name: { kind: "Name", value: "name" } },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "capacityUtilizationPercent" },
                      },
                    ],
                  },
                },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "serviceAreasExpansionCandidates" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "id" } },
                      { kind: "Field", name: { kind: "Name", value: "name" } },
                      { kind: "Field", name: { kind: "Name", value: "penetrationRatePercent" } },
                      { kind: "Field", name: { kind: "Name", value: "homesPassed" } },
                    ],
                  },
                },
                { kind: "Field", name: { kind: "Name", value: "newConnectionsTrend" } },
                { kind: "Field", name: { kind: "Name", value: "capacityUtilizationTrend" } },
                { kind: "Field", name: { kind: "Name", value: "networkHealthTrend" } },
                { kind: "Field", name: { kind: "Name", value: "generatedAt" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<FiberDashboardQuery, FiberDashboardQueryVariables>;
export const NetworkOverviewDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "NetworkOverview" },
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "networkOverview" },
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "totalDevices" } },
                { kind: "Field", name: { kind: "Name", value: "onlineDevices" } },
                { kind: "Field", name: { kind: "Name", value: "offlineDevices" } },
                { kind: "Field", name: { kind: "Name", value: "activeAlerts" } },
                { kind: "Field", name: { kind: "Name", value: "criticalAlerts" } },
                { kind: "Field", name: { kind: "Name", value: "warningAlerts" } },
                { kind: "Field", name: { kind: "Name", value: "totalBandwidthGbps" } },
                { kind: "Field", name: { kind: "Name", value: "uptimePercentage" } },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "dataSourceStatus" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "name" } },
                      { kind: "Field", name: { kind: "Name", value: "status" } },
                    ],
                  },
                },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "deviceTypeSummary" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "deviceType" } },
                      { kind: "Field", name: { kind: "Name", value: "totalCount" } },
                      { kind: "Field", name: { kind: "Name", value: "onlineCount" } },
                      { kind: "Field", name: { kind: "Name", value: "avgCpuUsage" } },
                      { kind: "Field", name: { kind: "Name", value: "avgMemoryUsage" } },
                    ],
                  },
                },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "recentAlerts" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "alertId" } },
                      { kind: "Field", name: { kind: "Name", value: "severity" } },
                      { kind: "Field", name: { kind: "Name", value: "title" } },
                      { kind: "Field", name: { kind: "Name", value: "description" } },
                      { kind: "Field", name: { kind: "Name", value: "deviceName" } },
                      { kind: "Field", name: { kind: "Name", value: "deviceId" } },
                      { kind: "Field", name: { kind: "Name", value: "deviceType" } },
                      { kind: "Field", name: { kind: "Name", value: "triggeredAt" } },
                      { kind: "Field", name: { kind: "Name", value: "acknowledgedAt" } },
                      { kind: "Field", name: { kind: "Name", value: "resolvedAt" } },
                      { kind: "Field", name: { kind: "Name", value: "isActive" } },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<NetworkOverviewQuery, NetworkOverviewQueryVariables>;
export const NetworkDeviceListDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "NetworkDeviceList" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "page" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "Int" } },
          defaultValue: { kind: "IntValue", value: "1" },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "pageSize" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "Int" } },
          defaultValue: { kind: "IntValue", value: "20" },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "deviceType" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "DeviceTypeEnum" } },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "status" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "DeviceStatusEnum" } },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "search" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "String" } },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "networkDevices" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "page" },
                value: { kind: "Variable", name: { kind: "Name", value: "page" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "pageSize" },
                value: { kind: "Variable", name: { kind: "Name", value: "pageSize" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "deviceType" },
                value: { kind: "Variable", name: { kind: "Name", value: "deviceType" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "status" },
                value: { kind: "Variable", name: { kind: "Name", value: "status" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "search" },
                value: { kind: "Variable", name: { kind: "Name", value: "search" } },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                {
                  kind: "Field",
                  name: { kind: "Name", value: "devices" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "deviceId" } },
                      { kind: "Field", name: { kind: "Name", value: "deviceName" } },
                      { kind: "Field", name: { kind: "Name", value: "deviceType" } },
                      { kind: "Field", name: { kind: "Name", value: "status" } },
                      { kind: "Field", name: { kind: "Name", value: "ipAddress" } },
                      { kind: "Field", name: { kind: "Name", value: "firmwareVersion" } },
                      { kind: "Field", name: { kind: "Name", value: "model" } },
                      { kind: "Field", name: { kind: "Name", value: "location" } },
                      { kind: "Field", name: { kind: "Name", value: "tenantId" } },
                      { kind: "Field", name: { kind: "Name", value: "cpuUsagePercent" } },
                      { kind: "Field", name: { kind: "Name", value: "memoryUsagePercent" } },
                      { kind: "Field", name: { kind: "Name", value: "temperatureCelsius" } },
                      { kind: "Field", name: { kind: "Name", value: "powerStatus" } },
                      { kind: "Field", name: { kind: "Name", value: "pingLatencyMs" } },
                      { kind: "Field", name: { kind: "Name", value: "packetLossPercent" } },
                      { kind: "Field", name: { kind: "Name", value: "uptimeSeconds" } },
                      { kind: "Field", name: { kind: "Name", value: "uptimeDays" } },
                      { kind: "Field", name: { kind: "Name", value: "lastSeen" } },
                      { kind: "Field", name: { kind: "Name", value: "isHealthy" } },
                    ],
                  },
                },
                { kind: "Field", name: { kind: "Name", value: "totalCount" } },
                { kind: "Field", name: { kind: "Name", value: "hasNextPage" } },
                { kind: "Field", name: { kind: "Name", value: "hasPrevPage" } },
                { kind: "Field", name: { kind: "Name", value: "page" } },
                { kind: "Field", name: { kind: "Name", value: "pageSize" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<NetworkDeviceListQuery, NetworkDeviceListQueryVariables>;
export const DeviceDetailDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "DeviceDetail" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "deviceId" } },
          type: {
            kind: "NonNullType",
            type: { kind: "NamedType", name: { kind: "Name", value: "String" } },
          },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "deviceType" } },
          type: {
            kind: "NonNullType",
            type: { kind: "NamedType", name: { kind: "Name", value: "DeviceTypeEnum" } },
          },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "deviceHealth" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "deviceId" },
                value: { kind: "Variable", name: { kind: "Name", value: "deviceId" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "deviceType" },
                value: { kind: "Variable", name: { kind: "Name", value: "deviceType" } },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "deviceId" } },
                { kind: "Field", name: { kind: "Name", value: "deviceName" } },
                { kind: "Field", name: { kind: "Name", value: "deviceType" } },
                { kind: "Field", name: { kind: "Name", value: "status" } },
                { kind: "Field", name: { kind: "Name", value: "ipAddress" } },
                { kind: "Field", name: { kind: "Name", value: "firmwareVersion" } },
                { kind: "Field", name: { kind: "Name", value: "model" } },
                { kind: "Field", name: { kind: "Name", value: "location" } },
                { kind: "Field", name: { kind: "Name", value: "tenantId" } },
                { kind: "Field", name: { kind: "Name", value: "cpuUsagePercent" } },
                { kind: "Field", name: { kind: "Name", value: "memoryUsagePercent" } },
                { kind: "Field", name: { kind: "Name", value: "temperatureCelsius" } },
                { kind: "Field", name: { kind: "Name", value: "powerStatus" } },
                { kind: "Field", name: { kind: "Name", value: "pingLatencyMs" } },
                { kind: "Field", name: { kind: "Name", value: "packetLossPercent" } },
                { kind: "Field", name: { kind: "Name", value: "uptimeSeconds" } },
                { kind: "Field", name: { kind: "Name", value: "uptimeDays" } },
                { kind: "Field", name: { kind: "Name", value: "lastSeen" } },
                { kind: "Field", name: { kind: "Name", value: "isHealthy" } },
              ],
            },
          },
          {
            kind: "Field",
            name: { kind: "Name", value: "deviceTraffic" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "deviceId" },
                value: { kind: "Variable", name: { kind: "Name", value: "deviceId" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "deviceType" },
                value: { kind: "Variable", name: { kind: "Name", value: "deviceType" } },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "deviceId" } },
                { kind: "Field", name: { kind: "Name", value: "deviceName" } },
                { kind: "Field", name: { kind: "Name", value: "totalBandwidthGbps" } },
                { kind: "Field", name: { kind: "Name", value: "currentRateInMbps" } },
                { kind: "Field", name: { kind: "Name", value: "currentRateOutMbps" } },
                { kind: "Field", name: { kind: "Name", value: "totalBytesIn" } },
                { kind: "Field", name: { kind: "Name", value: "totalBytesOut" } },
                { kind: "Field", name: { kind: "Name", value: "totalPacketsIn" } },
                { kind: "Field", name: { kind: "Name", value: "totalPacketsOut" } },
                { kind: "Field", name: { kind: "Name", value: "peakRateInBps" } },
                { kind: "Field", name: { kind: "Name", value: "peakRateOutBps" } },
                { kind: "Field", name: { kind: "Name", value: "peakTimestamp" } },
                { kind: "Field", name: { kind: "Name", value: "timestamp" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<DeviceDetailQuery, DeviceDetailQueryVariables>;
export const DeviceTrafficDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "DeviceTraffic" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "deviceId" } },
          type: {
            kind: "NonNullType",
            type: { kind: "NamedType", name: { kind: "Name", value: "String" } },
          },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "deviceType" } },
          type: {
            kind: "NonNullType",
            type: { kind: "NamedType", name: { kind: "Name", value: "DeviceTypeEnum" } },
          },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "includeInterfaces" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "Boolean" } },
          defaultValue: { kind: "BooleanValue", value: false },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "deviceTraffic" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "deviceId" },
                value: { kind: "Variable", name: { kind: "Name", value: "deviceId" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "deviceType" },
                value: { kind: "Variable", name: { kind: "Name", value: "deviceType" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "includeInterfaces" },
                value: { kind: "Variable", name: { kind: "Name", value: "includeInterfaces" } },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "deviceId" } },
                { kind: "Field", name: { kind: "Name", value: "deviceName" } },
                { kind: "Field", name: { kind: "Name", value: "totalBandwidthGbps" } },
                { kind: "Field", name: { kind: "Name", value: "currentRateInMbps" } },
                { kind: "Field", name: { kind: "Name", value: "currentRateOutMbps" } },
                { kind: "Field", name: { kind: "Name", value: "totalBytesIn" } },
                { kind: "Field", name: { kind: "Name", value: "totalBytesOut" } },
                { kind: "Field", name: { kind: "Name", value: "totalPacketsIn" } },
                { kind: "Field", name: { kind: "Name", value: "totalPacketsOut" } },
                { kind: "Field", name: { kind: "Name", value: "peakRateInBps" } },
                { kind: "Field", name: { kind: "Name", value: "peakRateOutBps" } },
                { kind: "Field", name: { kind: "Name", value: "peakTimestamp" } },
                { kind: "Field", name: { kind: "Name", value: "timestamp" } },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "interfaces" },
                  directives: [
                    {
                      kind: "Directive",
                      name: { kind: "Name", value: "include" },
                      arguments: [
                        {
                          kind: "Argument",
                          name: { kind: "Name", value: "if" },
                          value: {
                            kind: "Variable",
                            name: { kind: "Name", value: "includeInterfaces" },
                          },
                        },
                      ],
                    },
                  ],
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "interfaceName" } },
                      { kind: "Field", name: { kind: "Name", value: "status" } },
                      { kind: "Field", name: { kind: "Name", value: "rateInBps" } },
                      { kind: "Field", name: { kind: "Name", value: "rateOutBps" } },
                      { kind: "Field", name: { kind: "Name", value: "bytesIn" } },
                      { kind: "Field", name: { kind: "Name", value: "bytesOut" } },
                      { kind: "Field", name: { kind: "Name", value: "errorsIn" } },
                      { kind: "Field", name: { kind: "Name", value: "errorsOut" } },
                      { kind: "Field", name: { kind: "Name", value: "dropsIn" } },
                      { kind: "Field", name: { kind: "Name", value: "dropsOut" } },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<DeviceTrafficQuery, DeviceTrafficQueryVariables>;
export const NetworkAlertListDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "NetworkAlertList" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "page" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "Int" } },
          defaultValue: { kind: "IntValue", value: "1" },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "pageSize" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "Int" } },
          defaultValue: { kind: "IntValue", value: "50" },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "severity" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "AlertSeverityEnum" } },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "activeOnly" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "Boolean" } },
          defaultValue: { kind: "BooleanValue", value: true },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "deviceId" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "String" } },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "deviceType" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "DeviceTypeEnum" } },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "networkAlerts" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "page" },
                value: { kind: "Variable", name: { kind: "Name", value: "page" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "pageSize" },
                value: { kind: "Variable", name: { kind: "Name", value: "pageSize" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "severity" },
                value: { kind: "Variable", name: { kind: "Name", value: "severity" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "activeOnly" },
                value: { kind: "Variable", name: { kind: "Name", value: "activeOnly" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "deviceId" },
                value: { kind: "Variable", name: { kind: "Name", value: "deviceId" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "deviceType" },
                value: { kind: "Variable", name: { kind: "Name", value: "deviceType" } },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                {
                  kind: "Field",
                  name: { kind: "Name", value: "alerts" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "alertId" } },
                      { kind: "Field", name: { kind: "Name", value: "alertRuleId" } },
                      { kind: "Field", name: { kind: "Name", value: "severity" } },
                      { kind: "Field", name: { kind: "Name", value: "title" } },
                      { kind: "Field", name: { kind: "Name", value: "description" } },
                      { kind: "Field", name: { kind: "Name", value: "deviceName" } },
                      { kind: "Field", name: { kind: "Name", value: "deviceId" } },
                      { kind: "Field", name: { kind: "Name", value: "deviceType" } },
                      { kind: "Field", name: { kind: "Name", value: "metricName" } },
                      { kind: "Field", name: { kind: "Name", value: "currentValue" } },
                      { kind: "Field", name: { kind: "Name", value: "thresholdValue" } },
                      { kind: "Field", name: { kind: "Name", value: "triggeredAt" } },
                      { kind: "Field", name: { kind: "Name", value: "acknowledgedAt" } },
                      { kind: "Field", name: { kind: "Name", value: "resolvedAt" } },
                      { kind: "Field", name: { kind: "Name", value: "isActive" } },
                      { kind: "Field", name: { kind: "Name", value: "isAcknowledged" } },
                      { kind: "Field", name: { kind: "Name", value: "tenantId" } },
                    ],
                  },
                },
                { kind: "Field", name: { kind: "Name", value: "totalCount" } },
                { kind: "Field", name: { kind: "Name", value: "hasNextPage" } },
                { kind: "Field", name: { kind: "Name", value: "hasPrevPage" } },
                { kind: "Field", name: { kind: "Name", value: "page" } },
                { kind: "Field", name: { kind: "Name", value: "pageSize" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<NetworkAlertListQuery, NetworkAlertListQueryVariables>;
export const NetworkAlertDetailDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "NetworkAlertDetail" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "alertId" } },
          type: {
            kind: "NonNullType",
            type: { kind: "NamedType", name: { kind: "Name", value: "String" } },
          },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "networkAlert" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "alertId" },
                value: { kind: "Variable", name: { kind: "Name", value: "alertId" } },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "alertId" } },
                { kind: "Field", name: { kind: "Name", value: "alertRuleId" } },
                { kind: "Field", name: { kind: "Name", value: "severity" } },
                { kind: "Field", name: { kind: "Name", value: "title" } },
                { kind: "Field", name: { kind: "Name", value: "description" } },
                { kind: "Field", name: { kind: "Name", value: "deviceName" } },
                { kind: "Field", name: { kind: "Name", value: "deviceId" } },
                { kind: "Field", name: { kind: "Name", value: "deviceType" } },
                { kind: "Field", name: { kind: "Name", value: "metricName" } },
                { kind: "Field", name: { kind: "Name", value: "currentValue" } },
                { kind: "Field", name: { kind: "Name", value: "thresholdValue" } },
                { kind: "Field", name: { kind: "Name", value: "triggeredAt" } },
                { kind: "Field", name: { kind: "Name", value: "acknowledgedAt" } },
                { kind: "Field", name: { kind: "Name", value: "resolvedAt" } },
                { kind: "Field", name: { kind: "Name", value: "isActive" } },
                { kind: "Field", name: { kind: "Name", value: "isAcknowledged" } },
                { kind: "Field", name: { kind: "Name", value: "tenantId" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<NetworkAlertDetailQuery, NetworkAlertDetailQueryVariables>;
export const NetworkDashboardDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "NetworkDashboard" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "devicePage" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "Int" } },
          defaultValue: { kind: "IntValue", value: "1" },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "devicePageSize" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "Int" } },
          defaultValue: { kind: "IntValue", value: "10" },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "deviceType" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "DeviceTypeEnum" } },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "deviceStatus" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "DeviceStatusEnum" } },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "alertPage" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "Int" } },
          defaultValue: { kind: "IntValue", value: "1" },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "alertPageSize" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "Int" } },
          defaultValue: { kind: "IntValue", value: "20" },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "alertSeverity" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "AlertSeverityEnum" } },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "networkOverview" },
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "totalDevices" } },
                { kind: "Field", name: { kind: "Name", value: "onlineDevices" } },
                { kind: "Field", name: { kind: "Name", value: "offlineDevices" } },
                { kind: "Field", name: { kind: "Name", value: "activeAlerts" } },
                { kind: "Field", name: { kind: "Name", value: "criticalAlerts" } },
                { kind: "Field", name: { kind: "Name", value: "warningAlerts" } },
                { kind: "Field", name: { kind: "Name", value: "totalBandwidthGbps" } },
                { kind: "Field", name: { kind: "Name", value: "uptimePercentage" } },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "dataSourceStatus" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "name" } },
                      { kind: "Field", name: { kind: "Name", value: "status" } },
                    ],
                  },
                },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "deviceTypeSummary" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "deviceType" } },
                      { kind: "Field", name: { kind: "Name", value: "totalCount" } },
                      { kind: "Field", name: { kind: "Name", value: "onlineCount" } },
                      { kind: "Field", name: { kind: "Name", value: "avgCpuUsage" } },
                      { kind: "Field", name: { kind: "Name", value: "avgMemoryUsage" } },
                    ],
                  },
                },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "recentAlerts" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "alertId" } },
                      { kind: "Field", name: { kind: "Name", value: "severity" } },
                      { kind: "Field", name: { kind: "Name", value: "title" } },
                      { kind: "Field", name: { kind: "Name", value: "deviceName" } },
                      { kind: "Field", name: { kind: "Name", value: "triggeredAt" } },
                      { kind: "Field", name: { kind: "Name", value: "isActive" } },
                    ],
                  },
                },
              ],
            },
          },
          {
            kind: "Field",
            name: { kind: "Name", value: "networkDevices" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "page" },
                value: { kind: "Variable", name: { kind: "Name", value: "devicePage" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "pageSize" },
                value: { kind: "Variable", name: { kind: "Name", value: "devicePageSize" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "deviceType" },
                value: { kind: "Variable", name: { kind: "Name", value: "deviceType" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "status" },
                value: { kind: "Variable", name: { kind: "Name", value: "deviceStatus" } },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                {
                  kind: "Field",
                  name: { kind: "Name", value: "devices" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "deviceId" } },
                      { kind: "Field", name: { kind: "Name", value: "deviceName" } },
                      { kind: "Field", name: { kind: "Name", value: "deviceType" } },
                      { kind: "Field", name: { kind: "Name", value: "status" } },
                      { kind: "Field", name: { kind: "Name", value: "ipAddress" } },
                      { kind: "Field", name: { kind: "Name", value: "cpuUsagePercent" } },
                      { kind: "Field", name: { kind: "Name", value: "memoryUsagePercent" } },
                      { kind: "Field", name: { kind: "Name", value: "uptimeSeconds" } },
                      { kind: "Field", name: { kind: "Name", value: "isHealthy" } },
                      { kind: "Field", name: { kind: "Name", value: "lastSeen" } },
                    ],
                  },
                },
                { kind: "Field", name: { kind: "Name", value: "totalCount" } },
                { kind: "Field", name: { kind: "Name", value: "hasNextPage" } },
              ],
            },
          },
          {
            kind: "Field",
            name: { kind: "Name", value: "networkAlerts" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "page" },
                value: { kind: "Variable", name: { kind: "Name", value: "alertPage" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "pageSize" },
                value: { kind: "Variable", name: { kind: "Name", value: "alertPageSize" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "severity" },
                value: { kind: "Variable", name: { kind: "Name", value: "alertSeverity" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "activeOnly" },
                value: { kind: "BooleanValue", value: true },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                {
                  kind: "Field",
                  name: { kind: "Name", value: "alerts" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "alertId" } },
                      { kind: "Field", name: { kind: "Name", value: "severity" } },
                      { kind: "Field", name: { kind: "Name", value: "title" } },
                      { kind: "Field", name: { kind: "Name", value: "description" } },
                      { kind: "Field", name: { kind: "Name", value: "deviceName" } },
                      { kind: "Field", name: { kind: "Name", value: "deviceType" } },
                      { kind: "Field", name: { kind: "Name", value: "triggeredAt" } },
                      { kind: "Field", name: { kind: "Name", value: "isActive" } },
                    ],
                  },
                },
                { kind: "Field", name: { kind: "Name", value: "totalCount" } },
                { kind: "Field", name: { kind: "Name", value: "hasNextPage" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<NetworkDashboardQuery, NetworkDashboardQueryVariables>;
export const DeviceUpdatesDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "subscription",
      name: { kind: "Name", value: "DeviceUpdates" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "deviceType" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "DeviceTypeEnum" } },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "status" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "DeviceStatusEnum" } },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "deviceUpdated" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "deviceType" },
                value: { kind: "Variable", name: { kind: "Name", value: "deviceType" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "status" },
                value: { kind: "Variable", name: { kind: "Name", value: "status" } },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "deviceId" } },
                { kind: "Field", name: { kind: "Name", value: "deviceName" } },
                { kind: "Field", name: { kind: "Name", value: "deviceType" } },
                { kind: "Field", name: { kind: "Name", value: "status" } },
                { kind: "Field", name: { kind: "Name", value: "ipAddress" } },
                { kind: "Field", name: { kind: "Name", value: "firmwareVersion" } },
                { kind: "Field", name: { kind: "Name", value: "model" } },
                { kind: "Field", name: { kind: "Name", value: "location" } },
                { kind: "Field", name: { kind: "Name", value: "tenantId" } },
                { kind: "Field", name: { kind: "Name", value: "cpuUsagePercent" } },
                { kind: "Field", name: { kind: "Name", value: "memoryUsagePercent" } },
                { kind: "Field", name: { kind: "Name", value: "temperatureCelsius" } },
                { kind: "Field", name: { kind: "Name", value: "powerStatus" } },
                { kind: "Field", name: { kind: "Name", value: "pingLatencyMs" } },
                { kind: "Field", name: { kind: "Name", value: "packetLossPercent" } },
                { kind: "Field", name: { kind: "Name", value: "uptimeSeconds" } },
                { kind: "Field", name: { kind: "Name", value: "uptimeDays" } },
                { kind: "Field", name: { kind: "Name", value: "lastSeen" } },
                { kind: "Field", name: { kind: "Name", value: "isHealthy" } },
                { kind: "Field", name: { kind: "Name", value: "changeType" } },
                { kind: "Field", name: { kind: "Name", value: "previousValue" } },
                { kind: "Field", name: { kind: "Name", value: "newValue" } },
                { kind: "Field", name: { kind: "Name", value: "updatedAt" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<DeviceUpdatesSubscription, DeviceUpdatesSubscriptionVariables>;
export const NetworkAlertUpdatesDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "subscription",
      name: { kind: "Name", value: "NetworkAlertUpdates" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "severity" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "AlertSeverityEnum" } },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "deviceId" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "String" } },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "networkAlertUpdated" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "severity" },
                value: { kind: "Variable", name: { kind: "Name", value: "severity" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "deviceId" },
                value: { kind: "Variable", name: { kind: "Name", value: "deviceId" } },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "action" } },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "alert" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "alertId" } },
                      { kind: "Field", name: { kind: "Name", value: "alertRuleId" } },
                      { kind: "Field", name: { kind: "Name", value: "severity" } },
                      { kind: "Field", name: { kind: "Name", value: "title" } },
                      { kind: "Field", name: { kind: "Name", value: "description" } },
                      { kind: "Field", name: { kind: "Name", value: "deviceName" } },
                      { kind: "Field", name: { kind: "Name", value: "deviceId" } },
                      { kind: "Field", name: { kind: "Name", value: "deviceType" } },
                      { kind: "Field", name: { kind: "Name", value: "metricName" } },
                      { kind: "Field", name: { kind: "Name", value: "currentValue" } },
                      { kind: "Field", name: { kind: "Name", value: "thresholdValue" } },
                      { kind: "Field", name: { kind: "Name", value: "triggeredAt" } },
                      { kind: "Field", name: { kind: "Name", value: "acknowledgedAt" } },
                      { kind: "Field", name: { kind: "Name", value: "resolvedAt" } },
                      { kind: "Field", name: { kind: "Name", value: "isActive" } },
                      { kind: "Field", name: { kind: "Name", value: "isAcknowledged" } },
                      { kind: "Field", name: { kind: "Name", value: "tenantId" } },
                    ],
                  },
                },
                { kind: "Field", name: { kind: "Name", value: "updatedAt" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  NetworkAlertUpdatesSubscription,
  NetworkAlertUpdatesSubscriptionVariables
>;
export const SubscriberDashboardDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "SubscriberDashboard" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "limit" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "Int" } },
          defaultValue: { kind: "IntValue", value: "50" },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "search" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "String" } },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "subscribers" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "limit" },
                value: { kind: "Variable", name: { kind: "Name", value: "limit" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "search" },
                value: { kind: "Variable", name: { kind: "Name", value: "search" } },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "id" } },
                { kind: "Field", name: { kind: "Name", value: "subscriberId" } },
                { kind: "Field", name: { kind: "Name", value: "username" } },
                { kind: "Field", name: { kind: "Name", value: "enabled" } },
                { kind: "Field", name: { kind: "Name", value: "framedIpAddress" } },
                { kind: "Field", name: { kind: "Name", value: "bandwidthProfileId" } },
                { kind: "Field", name: { kind: "Name", value: "createdAt" } },
                { kind: "Field", name: { kind: "Name", value: "updatedAt" } },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "sessions" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "radacctid" } },
                      { kind: "Field", name: { kind: "Name", value: "username" } },
                      { kind: "Field", name: { kind: "Name", value: "nasipaddress" } },
                      { kind: "Field", name: { kind: "Name", value: "acctsessionid" } },
                      { kind: "Field", name: { kind: "Name", value: "acctsessiontime" } },
                      { kind: "Field", name: { kind: "Name", value: "acctinputoctets" } },
                      { kind: "Field", name: { kind: "Name", value: "acctoutputoctets" } },
                      { kind: "Field", name: { kind: "Name", value: "acctstarttime" } },
                    ],
                  },
                },
              ],
            },
          },
          {
            kind: "Field",
            name: { kind: "Name", value: "subscriberMetrics" },
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "totalCount" } },
                { kind: "Field", name: { kind: "Name", value: "enabledCount" } },
                { kind: "Field", name: { kind: "Name", value: "disabledCount" } },
                { kind: "Field", name: { kind: "Name", value: "activeSessionsCount" } },
                { kind: "Field", name: { kind: "Name", value: "totalDataUsageMb" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<SubscriberDashboardQuery, SubscriberDashboardQueryVariables>;
export const SubscriberDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "Subscriber" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "username" } },
          type: {
            kind: "NonNullType",
            type: { kind: "NamedType", name: { kind: "Name", value: "String" } },
          },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "subscribers" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "limit" },
                value: { kind: "IntValue", value: "1" },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "search" },
                value: { kind: "Variable", name: { kind: "Name", value: "username" } },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "id" } },
                { kind: "Field", name: { kind: "Name", value: "subscriberId" } },
                { kind: "Field", name: { kind: "Name", value: "username" } },
                { kind: "Field", name: { kind: "Name", value: "enabled" } },
                { kind: "Field", name: { kind: "Name", value: "framedIpAddress" } },
                { kind: "Field", name: { kind: "Name", value: "bandwidthProfileId" } },
                { kind: "Field", name: { kind: "Name", value: "createdAt" } },
                { kind: "Field", name: { kind: "Name", value: "updatedAt" } },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "sessions" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "radacctid" } },
                      { kind: "Field", name: { kind: "Name", value: "username" } },
                      { kind: "Field", name: { kind: "Name", value: "nasipaddress" } },
                      { kind: "Field", name: { kind: "Name", value: "acctsessionid" } },
                      { kind: "Field", name: { kind: "Name", value: "acctsessiontime" } },
                      { kind: "Field", name: { kind: "Name", value: "acctinputoctets" } },
                      { kind: "Field", name: { kind: "Name", value: "acctoutputoctets" } },
                      { kind: "Field", name: { kind: "Name", value: "acctstarttime" } },
                      { kind: "Field", name: { kind: "Name", value: "acctstoptime" } },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<SubscriberQuery, SubscriberQueryVariables>;
export const ActiveSessionsDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "ActiveSessions" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "limit" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "Int" } },
          defaultValue: { kind: "IntValue", value: "100" },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "username" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "String" } },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "sessions" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "limit" },
                value: { kind: "Variable", name: { kind: "Name", value: "limit" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "username" },
                value: { kind: "Variable", name: { kind: "Name", value: "username" } },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "radacctid" } },
                { kind: "Field", name: { kind: "Name", value: "username" } },
                { kind: "Field", name: { kind: "Name", value: "nasipaddress" } },
                { kind: "Field", name: { kind: "Name", value: "acctsessionid" } },
                { kind: "Field", name: { kind: "Name", value: "acctsessiontime" } },
                { kind: "Field", name: { kind: "Name", value: "acctinputoctets" } },
                { kind: "Field", name: { kind: "Name", value: "acctoutputoctets" } },
                { kind: "Field", name: { kind: "Name", value: "acctstarttime" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<ActiveSessionsQuery, ActiveSessionsQueryVariables>;
export const SubscriberMetricsDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "SubscriberMetrics" },
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "subscriberMetrics" },
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "totalCount" } },
                { kind: "Field", name: { kind: "Name", value: "enabledCount" } },
                { kind: "Field", name: { kind: "Name", value: "disabledCount" } },
                { kind: "Field", name: { kind: "Name", value: "activeSessionsCount" } },
                { kind: "Field", name: { kind: "Name", value: "totalDataUsageMb" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<SubscriberMetricsQuery, SubscriberMetricsQueryVariables>;
export const SubscriptionListDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "SubscriptionList" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "page" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "Int" } },
          defaultValue: { kind: "IntValue", value: "1" },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "pageSize" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "Int" } },
          defaultValue: { kind: "IntValue", value: "10" },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "status" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "SubscriptionStatusEnum" } },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "billingCycle" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "BillingCycleEnum" } },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "search" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "String" } },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "includeCustomer" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "Boolean" } },
          defaultValue: { kind: "BooleanValue", value: true },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "includePlan" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "Boolean" } },
          defaultValue: { kind: "BooleanValue", value: true },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "includeInvoices" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "Boolean" } },
          defaultValue: { kind: "BooleanValue", value: false },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "subscriptions" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "page" },
                value: { kind: "Variable", name: { kind: "Name", value: "page" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "pageSize" },
                value: { kind: "Variable", name: { kind: "Name", value: "pageSize" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "status" },
                value: { kind: "Variable", name: { kind: "Name", value: "status" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "billingCycle" },
                value: { kind: "Variable", name: { kind: "Name", value: "billingCycle" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "search" },
                value: { kind: "Variable", name: { kind: "Name", value: "search" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "includeCustomer" },
                value: { kind: "Variable", name: { kind: "Name", value: "includeCustomer" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "includePlan" },
                value: { kind: "Variable", name: { kind: "Name", value: "includePlan" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "includeInvoices" },
                value: { kind: "Variable", name: { kind: "Name", value: "includeInvoices" } },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                {
                  kind: "Field",
                  name: { kind: "Name", value: "subscriptions" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "id" } },
                      { kind: "Field", name: { kind: "Name", value: "subscriptionId" } },
                      { kind: "Field", name: { kind: "Name", value: "customerId" } },
                      { kind: "Field", name: { kind: "Name", value: "planId" } },
                      { kind: "Field", name: { kind: "Name", value: "tenantId" } },
                      { kind: "Field", name: { kind: "Name", value: "currentPeriodStart" } },
                      { kind: "Field", name: { kind: "Name", value: "currentPeriodEnd" } },
                      { kind: "Field", name: { kind: "Name", value: "status" } },
                      { kind: "Field", name: { kind: "Name", value: "trialEnd" } },
                      { kind: "Field", name: { kind: "Name", value: "isInTrial" } },
                      { kind: "Field", name: { kind: "Name", value: "cancelAtPeriodEnd" } },
                      { kind: "Field", name: { kind: "Name", value: "canceledAt" } },
                      { kind: "Field", name: { kind: "Name", value: "endedAt" } },
                      { kind: "Field", name: { kind: "Name", value: "customPrice" } },
                      { kind: "Field", name: { kind: "Name", value: "usageRecords" } },
                      { kind: "Field", name: { kind: "Name", value: "createdAt" } },
                      { kind: "Field", name: { kind: "Name", value: "updatedAt" } },
                      { kind: "Field", name: { kind: "Name", value: "isActive" } },
                      { kind: "Field", name: { kind: "Name", value: "daysUntilRenewal" } },
                      { kind: "Field", name: { kind: "Name", value: "isPastDue" } },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "customer" },
                        directives: [
                          {
                            kind: "Directive",
                            name: { kind: "Name", value: "include" },
                            arguments: [
                              {
                                kind: "Argument",
                                name: { kind: "Name", value: "if" },
                                value: {
                                  kind: "Variable",
                                  name: { kind: "Name", value: "includeCustomer" },
                                },
                              },
                            ],
                          },
                        ],
                        selectionSet: {
                          kind: "SelectionSet",
                          selections: [
                            { kind: "Field", name: { kind: "Name", value: "id" } },
                            { kind: "Field", name: { kind: "Name", value: "customerId" } },
                            { kind: "Field", name: { kind: "Name", value: "name" } },
                            { kind: "Field", name: { kind: "Name", value: "email" } },
                            { kind: "Field", name: { kind: "Name", value: "phone" } },
                            { kind: "Field", name: { kind: "Name", value: "createdAt" } },
                          ],
                        },
                      },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "plan" },
                        directives: [
                          {
                            kind: "Directive",
                            name: { kind: "Name", value: "include" },
                            arguments: [
                              {
                                kind: "Argument",
                                name: { kind: "Name", value: "if" },
                                value: {
                                  kind: "Variable",
                                  name: { kind: "Name", value: "includePlan" },
                                },
                              },
                            ],
                          },
                        ],
                        selectionSet: {
                          kind: "SelectionSet",
                          selections: [
                            { kind: "Field", name: { kind: "Name", value: "id" } },
                            { kind: "Field", name: { kind: "Name", value: "planId" } },
                            { kind: "Field", name: { kind: "Name", value: "productId" } },
                            { kind: "Field", name: { kind: "Name", value: "name" } },
                            { kind: "Field", name: { kind: "Name", value: "description" } },
                            { kind: "Field", name: { kind: "Name", value: "billingCycle" } },
                            { kind: "Field", name: { kind: "Name", value: "price" } },
                            { kind: "Field", name: { kind: "Name", value: "currency" } },
                            { kind: "Field", name: { kind: "Name", value: "setupFee" } },
                            { kind: "Field", name: { kind: "Name", value: "trialDays" } },
                            { kind: "Field", name: { kind: "Name", value: "isActive" } },
                            { kind: "Field", name: { kind: "Name", value: "hasTrial" } },
                            { kind: "Field", name: { kind: "Name", value: "hasSetupFee" } },
                            { kind: "Field", name: { kind: "Name", value: "includedUsage" } },
                            { kind: "Field", name: { kind: "Name", value: "overageRates" } },
                            { kind: "Field", name: { kind: "Name", value: "createdAt" } },
                            { kind: "Field", name: { kind: "Name", value: "updatedAt" } },
                          ],
                        },
                      },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "recentInvoices" },
                        directives: [
                          {
                            kind: "Directive",
                            name: { kind: "Name", value: "include" },
                            arguments: [
                              {
                                kind: "Argument",
                                name: { kind: "Name", value: "if" },
                                value: {
                                  kind: "Variable",
                                  name: { kind: "Name", value: "includeInvoices" },
                                },
                              },
                            ],
                          },
                        ],
                        selectionSet: {
                          kind: "SelectionSet",
                          selections: [
                            { kind: "Field", name: { kind: "Name", value: "id" } },
                            { kind: "Field", name: { kind: "Name", value: "invoiceId" } },
                            { kind: "Field", name: { kind: "Name", value: "invoiceNumber" } },
                            { kind: "Field", name: { kind: "Name", value: "amount" } },
                            { kind: "Field", name: { kind: "Name", value: "currency" } },
                            { kind: "Field", name: { kind: "Name", value: "status" } },
                            { kind: "Field", name: { kind: "Name", value: "dueDate" } },
                            { kind: "Field", name: { kind: "Name", value: "paidAt" } },
                            { kind: "Field", name: { kind: "Name", value: "createdAt" } },
                          ],
                        },
                      },
                    ],
                  },
                },
                { kind: "Field", name: { kind: "Name", value: "totalCount" } },
                { kind: "Field", name: { kind: "Name", value: "hasNextPage" } },
                { kind: "Field", name: { kind: "Name", value: "hasPrevPage" } },
                { kind: "Field", name: { kind: "Name", value: "page" } },
                { kind: "Field", name: { kind: "Name", value: "pageSize" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<SubscriptionListQuery, SubscriptionListQueryVariables>;
export const SubscriptionDetailDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "SubscriptionDetail" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "id" } },
          type: {
            kind: "NonNullType",
            type: { kind: "NamedType", name: { kind: "Name", value: "ID" } },
          },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "subscription" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "id" },
                value: { kind: "Variable", name: { kind: "Name", value: "id" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "includeCustomer" },
                value: { kind: "BooleanValue", value: true },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "includePlan" },
                value: { kind: "BooleanValue", value: true },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "includeInvoices" },
                value: { kind: "BooleanValue", value: true },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "id" } },
                { kind: "Field", name: { kind: "Name", value: "subscriptionId" } },
                { kind: "Field", name: { kind: "Name", value: "customerId" } },
                { kind: "Field", name: { kind: "Name", value: "planId" } },
                { kind: "Field", name: { kind: "Name", value: "tenantId" } },
                { kind: "Field", name: { kind: "Name", value: "currentPeriodStart" } },
                { kind: "Field", name: { kind: "Name", value: "currentPeriodEnd" } },
                { kind: "Field", name: { kind: "Name", value: "status" } },
                { kind: "Field", name: { kind: "Name", value: "trialEnd" } },
                { kind: "Field", name: { kind: "Name", value: "isInTrial" } },
                { kind: "Field", name: { kind: "Name", value: "cancelAtPeriodEnd" } },
                { kind: "Field", name: { kind: "Name", value: "canceledAt" } },
                { kind: "Field", name: { kind: "Name", value: "endedAt" } },
                { kind: "Field", name: { kind: "Name", value: "customPrice" } },
                { kind: "Field", name: { kind: "Name", value: "usageRecords" } },
                { kind: "Field", name: { kind: "Name", value: "createdAt" } },
                { kind: "Field", name: { kind: "Name", value: "updatedAt" } },
                { kind: "Field", name: { kind: "Name", value: "isActive" } },
                { kind: "Field", name: { kind: "Name", value: "daysUntilRenewal" } },
                { kind: "Field", name: { kind: "Name", value: "isPastDue" } },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "customer" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "id" } },
                      { kind: "Field", name: { kind: "Name", value: "customerId" } },
                      { kind: "Field", name: { kind: "Name", value: "name" } },
                      { kind: "Field", name: { kind: "Name", value: "email" } },
                      { kind: "Field", name: { kind: "Name", value: "phone" } },
                      { kind: "Field", name: { kind: "Name", value: "createdAt" } },
                    ],
                  },
                },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "plan" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "id" } },
                      { kind: "Field", name: { kind: "Name", value: "planId" } },
                      { kind: "Field", name: { kind: "Name", value: "productId" } },
                      { kind: "Field", name: { kind: "Name", value: "name" } },
                      { kind: "Field", name: { kind: "Name", value: "description" } },
                      { kind: "Field", name: { kind: "Name", value: "billingCycle" } },
                      { kind: "Field", name: { kind: "Name", value: "price" } },
                      { kind: "Field", name: { kind: "Name", value: "currency" } },
                      { kind: "Field", name: { kind: "Name", value: "setupFee" } },
                      { kind: "Field", name: { kind: "Name", value: "trialDays" } },
                      { kind: "Field", name: { kind: "Name", value: "isActive" } },
                      { kind: "Field", name: { kind: "Name", value: "hasTrial" } },
                      { kind: "Field", name: { kind: "Name", value: "hasSetupFee" } },
                      { kind: "Field", name: { kind: "Name", value: "includedUsage" } },
                      { kind: "Field", name: { kind: "Name", value: "overageRates" } },
                      { kind: "Field", name: { kind: "Name", value: "createdAt" } },
                      { kind: "Field", name: { kind: "Name", value: "updatedAt" } },
                    ],
                  },
                },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "recentInvoices" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "id" } },
                      { kind: "Field", name: { kind: "Name", value: "invoiceId" } },
                      { kind: "Field", name: { kind: "Name", value: "invoiceNumber" } },
                      { kind: "Field", name: { kind: "Name", value: "amount" } },
                      { kind: "Field", name: { kind: "Name", value: "currency" } },
                      { kind: "Field", name: { kind: "Name", value: "status" } },
                      { kind: "Field", name: { kind: "Name", value: "dueDate" } },
                      { kind: "Field", name: { kind: "Name", value: "paidAt" } },
                      { kind: "Field", name: { kind: "Name", value: "createdAt" } },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<SubscriptionDetailQuery, SubscriptionDetailQueryVariables>;
export const SubscriptionMetricsDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "SubscriptionMetrics" },
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "subscriptionMetrics" },
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "totalSubscriptions" } },
                { kind: "Field", name: { kind: "Name", value: "activeSubscriptions" } },
                { kind: "Field", name: { kind: "Name", value: "trialingSubscriptions" } },
                { kind: "Field", name: { kind: "Name", value: "pastDueSubscriptions" } },
                { kind: "Field", name: { kind: "Name", value: "canceledSubscriptions" } },
                { kind: "Field", name: { kind: "Name", value: "pausedSubscriptions" } },
                { kind: "Field", name: { kind: "Name", value: "monthlyRecurringRevenue" } },
                { kind: "Field", name: { kind: "Name", value: "annualRecurringRevenue" } },
                { kind: "Field", name: { kind: "Name", value: "averageRevenuePerUser" } },
                { kind: "Field", name: { kind: "Name", value: "newSubscriptionsThisMonth" } },
                { kind: "Field", name: { kind: "Name", value: "newSubscriptionsLastMonth" } },
                { kind: "Field", name: { kind: "Name", value: "churnRate" } },
                { kind: "Field", name: { kind: "Name", value: "growthRate" } },
                { kind: "Field", name: { kind: "Name", value: "monthlySubscriptions" } },
                { kind: "Field", name: { kind: "Name", value: "quarterlySubscriptions" } },
                { kind: "Field", name: { kind: "Name", value: "annualSubscriptions" } },
                { kind: "Field", name: { kind: "Name", value: "trialConversionRate" } },
                { kind: "Field", name: { kind: "Name", value: "activeTrials" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<SubscriptionMetricsQuery, SubscriptionMetricsQueryVariables>;
export const PlanListDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "PlanList" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "page" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "Int" } },
          defaultValue: { kind: "IntValue", value: "1" },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "pageSize" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "Int" } },
          defaultValue: { kind: "IntValue", value: "20" },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "isActive" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "Boolean" } },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "billingCycle" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "BillingCycleEnum" } },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "plans" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "page" },
                value: { kind: "Variable", name: { kind: "Name", value: "page" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "pageSize" },
                value: { kind: "Variable", name: { kind: "Name", value: "pageSize" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "isActive" },
                value: { kind: "Variable", name: { kind: "Name", value: "isActive" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "billingCycle" },
                value: { kind: "Variable", name: { kind: "Name", value: "billingCycle" } },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                {
                  kind: "Field",
                  name: { kind: "Name", value: "plans" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "id" } },
                      { kind: "Field", name: { kind: "Name", value: "planId" } },
                      { kind: "Field", name: { kind: "Name", value: "productId" } },
                      { kind: "Field", name: { kind: "Name", value: "name" } },
                      { kind: "Field", name: { kind: "Name", value: "description" } },
                      { kind: "Field", name: { kind: "Name", value: "billingCycle" } },
                      { kind: "Field", name: { kind: "Name", value: "price" } },
                      { kind: "Field", name: { kind: "Name", value: "currency" } },
                      { kind: "Field", name: { kind: "Name", value: "setupFee" } },
                      { kind: "Field", name: { kind: "Name", value: "trialDays" } },
                      { kind: "Field", name: { kind: "Name", value: "isActive" } },
                      { kind: "Field", name: { kind: "Name", value: "createdAt" } },
                      { kind: "Field", name: { kind: "Name", value: "updatedAt" } },
                      { kind: "Field", name: { kind: "Name", value: "hasTrial" } },
                      { kind: "Field", name: { kind: "Name", value: "hasSetupFee" } },
                      { kind: "Field", name: { kind: "Name", value: "includedUsage" } },
                      { kind: "Field", name: { kind: "Name", value: "overageRates" } },
                    ],
                  },
                },
                { kind: "Field", name: { kind: "Name", value: "totalCount" } },
                { kind: "Field", name: { kind: "Name", value: "hasNextPage" } },
                { kind: "Field", name: { kind: "Name", value: "hasPrevPage" } },
                { kind: "Field", name: { kind: "Name", value: "page" } },
                { kind: "Field", name: { kind: "Name", value: "pageSize" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<PlanListQuery, PlanListQueryVariables>;
export const ProductListDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "ProductList" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "page" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "Int" } },
          defaultValue: { kind: "IntValue", value: "1" },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "pageSize" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "Int" } },
          defaultValue: { kind: "IntValue", value: "20" },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "isActive" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "Boolean" } },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "category" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "String" } },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "products" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "page" },
                value: { kind: "Variable", name: { kind: "Name", value: "page" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "pageSize" },
                value: { kind: "Variable", name: { kind: "Name", value: "pageSize" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "isActive" },
                value: { kind: "Variable", name: { kind: "Name", value: "isActive" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "category" },
                value: { kind: "Variable", name: { kind: "Name", value: "category" } },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                {
                  kind: "Field",
                  name: { kind: "Name", value: "products" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "id" } },
                      { kind: "Field", name: { kind: "Name", value: "productId" } },
                      { kind: "Field", name: { kind: "Name", value: "sku" } },
                      { kind: "Field", name: { kind: "Name", value: "name" } },
                      { kind: "Field", name: { kind: "Name", value: "description" } },
                      { kind: "Field", name: { kind: "Name", value: "category" } },
                      { kind: "Field", name: { kind: "Name", value: "productType" } },
                      { kind: "Field", name: { kind: "Name", value: "basePrice" } },
                      { kind: "Field", name: { kind: "Name", value: "currency" } },
                      { kind: "Field", name: { kind: "Name", value: "isActive" } },
                      { kind: "Field", name: { kind: "Name", value: "createdAt" } },
                      { kind: "Field", name: { kind: "Name", value: "updatedAt" } },
                    ],
                  },
                },
                { kind: "Field", name: { kind: "Name", value: "totalCount" } },
                { kind: "Field", name: { kind: "Name", value: "hasNextPage" } },
                { kind: "Field", name: { kind: "Name", value: "hasPrevPage" } },
                { kind: "Field", name: { kind: "Name", value: "page" } },
                { kind: "Field", name: { kind: "Name", value: "pageSize" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<ProductListQuery, ProductListQueryVariables>;
export const SubscriptionDashboardDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "SubscriptionDashboard" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "page" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "Int" } },
          defaultValue: { kind: "IntValue", value: "1" },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "pageSize" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "Int" } },
          defaultValue: { kind: "IntValue", value: "10" },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "status" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "SubscriptionStatusEnum" } },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "search" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "String" } },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "subscriptions" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "page" },
                value: { kind: "Variable", name: { kind: "Name", value: "page" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "pageSize" },
                value: { kind: "Variable", name: { kind: "Name", value: "pageSize" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "status" },
                value: { kind: "Variable", name: { kind: "Name", value: "status" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "search" },
                value: { kind: "Variable", name: { kind: "Name", value: "search" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "includeCustomer" },
                value: { kind: "BooleanValue", value: true },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "includePlan" },
                value: { kind: "BooleanValue", value: true },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "includeInvoices" },
                value: { kind: "BooleanValue", value: false },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                {
                  kind: "Field",
                  name: { kind: "Name", value: "subscriptions" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "id" } },
                      { kind: "Field", name: { kind: "Name", value: "subscriptionId" } },
                      { kind: "Field", name: { kind: "Name", value: "status" } },
                      { kind: "Field", name: { kind: "Name", value: "currentPeriodStart" } },
                      { kind: "Field", name: { kind: "Name", value: "currentPeriodEnd" } },
                      { kind: "Field", name: { kind: "Name", value: "isActive" } },
                      { kind: "Field", name: { kind: "Name", value: "isInTrial" } },
                      { kind: "Field", name: { kind: "Name", value: "cancelAtPeriodEnd" } },
                      { kind: "Field", name: { kind: "Name", value: "createdAt" } },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "customer" },
                        selectionSet: {
                          kind: "SelectionSet",
                          selections: [
                            { kind: "Field", name: { kind: "Name", value: "id" } },
                            { kind: "Field", name: { kind: "Name", value: "name" } },
                            { kind: "Field", name: { kind: "Name", value: "email" } },
                          ],
                        },
                      },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "plan" },
                        selectionSet: {
                          kind: "SelectionSet",
                          selections: [
                            { kind: "Field", name: { kind: "Name", value: "id" } },
                            { kind: "Field", name: { kind: "Name", value: "name" } },
                            { kind: "Field", name: { kind: "Name", value: "price" } },
                            { kind: "Field", name: { kind: "Name", value: "currency" } },
                            { kind: "Field", name: { kind: "Name", value: "billingCycle" } },
                          ],
                        },
                      },
                    ],
                  },
                },
                { kind: "Field", name: { kind: "Name", value: "totalCount" } },
                { kind: "Field", name: { kind: "Name", value: "hasNextPage" } },
              ],
            },
          },
          {
            kind: "Field",
            name: { kind: "Name", value: "subscriptionMetrics" },
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "totalSubscriptions" } },
                { kind: "Field", name: { kind: "Name", value: "activeSubscriptions" } },
                { kind: "Field", name: { kind: "Name", value: "trialingSubscriptions" } },
                { kind: "Field", name: { kind: "Name", value: "pastDueSubscriptions" } },
                { kind: "Field", name: { kind: "Name", value: "monthlyRecurringRevenue" } },
                { kind: "Field", name: { kind: "Name", value: "annualRecurringRevenue" } },
                { kind: "Field", name: { kind: "Name", value: "averageRevenuePerUser" } },
                { kind: "Field", name: { kind: "Name", value: "newSubscriptionsThisMonth" } },
                { kind: "Field", name: { kind: "Name", value: "churnRate" } },
                { kind: "Field", name: { kind: "Name", value: "growthRate" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<SubscriptionDashboardQuery, SubscriptionDashboardQueryVariables>;
export const UserListDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "UserList" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "page" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "Int" } },
          defaultValue: { kind: "IntValue", value: "1" },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "pageSize" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "Int" } },
          defaultValue: { kind: "IntValue", value: "10" },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "isActive" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "Boolean" } },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "isVerified" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "Boolean" } },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "isSuperuser" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "Boolean" } },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "isPlatformAdmin" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "Boolean" } },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "search" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "String" } },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "includeMetadata" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "Boolean" } },
          defaultValue: { kind: "BooleanValue", value: false },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "includeRoles" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "Boolean" } },
          defaultValue: { kind: "BooleanValue", value: false },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "includePermissions" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "Boolean" } },
          defaultValue: { kind: "BooleanValue", value: false },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "includeTeams" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "Boolean" } },
          defaultValue: { kind: "BooleanValue", value: false },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "users" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "page" },
                value: { kind: "Variable", name: { kind: "Name", value: "page" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "pageSize" },
                value: { kind: "Variable", name: { kind: "Name", value: "pageSize" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "isActive" },
                value: { kind: "Variable", name: { kind: "Name", value: "isActive" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "isVerified" },
                value: { kind: "Variable", name: { kind: "Name", value: "isVerified" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "isSuperuser" },
                value: { kind: "Variable", name: { kind: "Name", value: "isSuperuser" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "isPlatformAdmin" },
                value: { kind: "Variable", name: { kind: "Name", value: "isPlatformAdmin" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "search" },
                value: { kind: "Variable", name: { kind: "Name", value: "search" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "includeMetadata" },
                value: { kind: "Variable", name: { kind: "Name", value: "includeMetadata" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "includeRoles" },
                value: { kind: "Variable", name: { kind: "Name", value: "includeRoles" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "includePermissions" },
                value: { kind: "Variable", name: { kind: "Name", value: "includePermissions" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "includeTeams" },
                value: { kind: "Variable", name: { kind: "Name", value: "includeTeams" } },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                {
                  kind: "Field",
                  name: { kind: "Name", value: "users" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "id" } },
                      { kind: "Field", name: { kind: "Name", value: "username" } },
                      { kind: "Field", name: { kind: "Name", value: "email" } },
                      { kind: "Field", name: { kind: "Name", value: "fullName" } },
                      { kind: "Field", name: { kind: "Name", value: "firstName" } },
                      { kind: "Field", name: { kind: "Name", value: "lastName" } },
                      { kind: "Field", name: { kind: "Name", value: "displayName" } },
                      { kind: "Field", name: { kind: "Name", value: "isActive" } },
                      { kind: "Field", name: { kind: "Name", value: "isVerified" } },
                      { kind: "Field", name: { kind: "Name", value: "isSuperuser" } },
                      { kind: "Field", name: { kind: "Name", value: "isPlatformAdmin" } },
                      { kind: "Field", name: { kind: "Name", value: "status" } },
                      { kind: "Field", name: { kind: "Name", value: "phoneNumber" } },
                      { kind: "Field", name: { kind: "Name", value: "phone" } },
                      { kind: "Field", name: { kind: "Name", value: "phoneVerified" } },
                      { kind: "Field", name: { kind: "Name", value: "avatarUrl" } },
                      { kind: "Field", name: { kind: "Name", value: "timezone" } },
                      { kind: "Field", name: { kind: "Name", value: "location" } },
                      { kind: "Field", name: { kind: "Name", value: "bio" } },
                      { kind: "Field", name: { kind: "Name", value: "website" } },
                      { kind: "Field", name: { kind: "Name", value: "mfaEnabled" } },
                      { kind: "Field", name: { kind: "Name", value: "lastLogin" } },
                      { kind: "Field", name: { kind: "Name", value: "lastLoginIp" } },
                      { kind: "Field", name: { kind: "Name", value: "failedLoginAttempts" } },
                      { kind: "Field", name: { kind: "Name", value: "lockedUntil" } },
                      { kind: "Field", name: { kind: "Name", value: "language" } },
                      { kind: "Field", name: { kind: "Name", value: "tenantId" } },
                      { kind: "Field", name: { kind: "Name", value: "primaryRole" } },
                      { kind: "Field", name: { kind: "Name", value: "createdAt" } },
                      { kind: "Field", name: { kind: "Name", value: "updatedAt" } },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "metadata" },
                        directives: [
                          {
                            kind: "Directive",
                            name: { kind: "Name", value: "include" },
                            arguments: [
                              {
                                kind: "Argument",
                                name: { kind: "Name", value: "if" },
                                value: {
                                  kind: "Variable",
                                  name: { kind: "Name", value: "includeMetadata" },
                                },
                              },
                            ],
                          },
                        ],
                      },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "roles" },
                        directives: [
                          {
                            kind: "Directive",
                            name: { kind: "Name", value: "include" },
                            arguments: [
                              {
                                kind: "Argument",
                                name: { kind: "Name", value: "if" },
                                value: {
                                  kind: "Variable",
                                  name: { kind: "Name", value: "includeRoles" },
                                },
                              },
                            ],
                          },
                        ],
                        selectionSet: {
                          kind: "SelectionSet",
                          selections: [
                            { kind: "Field", name: { kind: "Name", value: "id" } },
                            { kind: "Field", name: { kind: "Name", value: "name" } },
                            { kind: "Field", name: { kind: "Name", value: "displayName" } },
                            { kind: "Field", name: { kind: "Name", value: "description" } },
                            { kind: "Field", name: { kind: "Name", value: "priority" } },
                            { kind: "Field", name: { kind: "Name", value: "isSystem" } },
                            { kind: "Field", name: { kind: "Name", value: "isActive" } },
                            { kind: "Field", name: { kind: "Name", value: "isDefault" } },
                            { kind: "Field", name: { kind: "Name", value: "createdAt" } },
                            { kind: "Field", name: { kind: "Name", value: "updatedAt" } },
                          ],
                        },
                      },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "permissions" },
                        directives: [
                          {
                            kind: "Directive",
                            name: { kind: "Name", value: "include" },
                            arguments: [
                              {
                                kind: "Argument",
                                name: { kind: "Name", value: "if" },
                                value: {
                                  kind: "Variable",
                                  name: { kind: "Name", value: "includePermissions" },
                                },
                              },
                            ],
                          },
                        ],
                        selectionSet: {
                          kind: "SelectionSet",
                          selections: [
                            { kind: "Field", name: { kind: "Name", value: "id" } },
                            { kind: "Field", name: { kind: "Name", value: "name" } },
                            { kind: "Field", name: { kind: "Name", value: "displayName" } },
                            { kind: "Field", name: { kind: "Name", value: "description" } },
                            { kind: "Field", name: { kind: "Name", value: "category" } },
                            { kind: "Field", name: { kind: "Name", value: "isActive" } },
                            { kind: "Field", name: { kind: "Name", value: "isSystem" } },
                            { kind: "Field", name: { kind: "Name", value: "createdAt" } },
                            { kind: "Field", name: { kind: "Name", value: "updatedAt" } },
                          ],
                        },
                      },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "teams" },
                        directives: [
                          {
                            kind: "Directive",
                            name: { kind: "Name", value: "include" },
                            arguments: [
                              {
                                kind: "Argument",
                                name: { kind: "Name", value: "if" },
                                value: {
                                  kind: "Variable",
                                  name: { kind: "Name", value: "includeTeams" },
                                },
                              },
                            ],
                          },
                        ],
                        selectionSet: {
                          kind: "SelectionSet",
                          selections: [
                            { kind: "Field", name: { kind: "Name", value: "teamId" } },
                            { kind: "Field", name: { kind: "Name", value: "teamName" } },
                            { kind: "Field", name: { kind: "Name", value: "role" } },
                            { kind: "Field", name: { kind: "Name", value: "joinedAt" } },
                          ],
                        },
                      },
                    ],
                  },
                },
                { kind: "Field", name: { kind: "Name", value: "totalCount" } },
                { kind: "Field", name: { kind: "Name", value: "hasNextPage" } },
                { kind: "Field", name: { kind: "Name", value: "hasPrevPage" } },
                { kind: "Field", name: { kind: "Name", value: "page" } },
                { kind: "Field", name: { kind: "Name", value: "pageSize" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<UserListQuery, UserListQueryVariables>;
export const UserDetailDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "UserDetail" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "id" } },
          type: {
            kind: "NonNullType",
            type: { kind: "NamedType", name: { kind: "Name", value: "ID" } },
          },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "user" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "id" },
                value: { kind: "Variable", name: { kind: "Name", value: "id" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "includeMetadata" },
                value: { kind: "BooleanValue", value: true },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "includeRoles" },
                value: { kind: "BooleanValue", value: true },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "includePermissions" },
                value: { kind: "BooleanValue", value: true },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "includeTeams" },
                value: { kind: "BooleanValue", value: true },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "includeProfileChanges" },
                value: { kind: "BooleanValue", value: true },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "id" } },
                { kind: "Field", name: { kind: "Name", value: "username" } },
                { kind: "Field", name: { kind: "Name", value: "email" } },
                { kind: "Field", name: { kind: "Name", value: "fullName" } },
                { kind: "Field", name: { kind: "Name", value: "firstName" } },
                { kind: "Field", name: { kind: "Name", value: "lastName" } },
                { kind: "Field", name: { kind: "Name", value: "displayName" } },
                { kind: "Field", name: { kind: "Name", value: "isActive" } },
                { kind: "Field", name: { kind: "Name", value: "isVerified" } },
                { kind: "Field", name: { kind: "Name", value: "isSuperuser" } },
                { kind: "Field", name: { kind: "Name", value: "isPlatformAdmin" } },
                { kind: "Field", name: { kind: "Name", value: "status" } },
                { kind: "Field", name: { kind: "Name", value: "phoneNumber" } },
                { kind: "Field", name: { kind: "Name", value: "phone" } },
                { kind: "Field", name: { kind: "Name", value: "phoneVerified" } },
                { kind: "Field", name: { kind: "Name", value: "avatarUrl" } },
                { kind: "Field", name: { kind: "Name", value: "timezone" } },
                { kind: "Field", name: { kind: "Name", value: "location" } },
                { kind: "Field", name: { kind: "Name", value: "bio" } },
                { kind: "Field", name: { kind: "Name", value: "website" } },
                { kind: "Field", name: { kind: "Name", value: "mfaEnabled" } },
                { kind: "Field", name: { kind: "Name", value: "lastLogin" } },
                { kind: "Field", name: { kind: "Name", value: "lastLoginIp" } },
                { kind: "Field", name: { kind: "Name", value: "failedLoginAttempts" } },
                { kind: "Field", name: { kind: "Name", value: "lockedUntil" } },
                { kind: "Field", name: { kind: "Name", value: "language" } },
                { kind: "Field", name: { kind: "Name", value: "tenantId" } },
                { kind: "Field", name: { kind: "Name", value: "primaryRole" } },
                { kind: "Field", name: { kind: "Name", value: "createdAt" } },
                { kind: "Field", name: { kind: "Name", value: "updatedAt" } },
                { kind: "Field", name: { kind: "Name", value: "metadata" } },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "roles" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "id" } },
                      { kind: "Field", name: { kind: "Name", value: "name" } },
                      { kind: "Field", name: { kind: "Name", value: "displayName" } },
                      { kind: "Field", name: { kind: "Name", value: "description" } },
                      { kind: "Field", name: { kind: "Name", value: "priority" } },
                      { kind: "Field", name: { kind: "Name", value: "isSystem" } },
                      { kind: "Field", name: { kind: "Name", value: "isActive" } },
                      { kind: "Field", name: { kind: "Name", value: "isDefault" } },
                      { kind: "Field", name: { kind: "Name", value: "createdAt" } },
                      { kind: "Field", name: { kind: "Name", value: "updatedAt" } },
                    ],
                  },
                },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "permissions" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "id" } },
                      { kind: "Field", name: { kind: "Name", value: "name" } },
                      { kind: "Field", name: { kind: "Name", value: "displayName" } },
                      { kind: "Field", name: { kind: "Name", value: "description" } },
                      { kind: "Field", name: { kind: "Name", value: "category" } },
                      { kind: "Field", name: { kind: "Name", value: "isActive" } },
                      { kind: "Field", name: { kind: "Name", value: "isSystem" } },
                      { kind: "Field", name: { kind: "Name", value: "createdAt" } },
                      { kind: "Field", name: { kind: "Name", value: "updatedAt" } },
                    ],
                  },
                },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "teams" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "teamId" } },
                      { kind: "Field", name: { kind: "Name", value: "teamName" } },
                      { kind: "Field", name: { kind: "Name", value: "role" } },
                      { kind: "Field", name: { kind: "Name", value: "joinedAt" } },
                    ],
                  },
                },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "profileChanges" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "id" } },
                      { kind: "Field", name: { kind: "Name", value: "fieldName" } },
                      { kind: "Field", name: { kind: "Name", value: "oldValue" } },
                      { kind: "Field", name: { kind: "Name", value: "newValue" } },
                      { kind: "Field", name: { kind: "Name", value: "createdAt" } },
                      { kind: "Field", name: { kind: "Name", value: "changedByUsername" } },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<UserDetailQuery, UserDetailQueryVariables>;
export const UserMetricsDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "UserMetrics" },
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "userMetrics" },
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "totalUsers" } },
                { kind: "Field", name: { kind: "Name", value: "activeUsers" } },
                { kind: "Field", name: { kind: "Name", value: "suspendedUsers" } },
                { kind: "Field", name: { kind: "Name", value: "invitedUsers" } },
                { kind: "Field", name: { kind: "Name", value: "verifiedUsers" } },
                { kind: "Field", name: { kind: "Name", value: "mfaEnabledUsers" } },
                { kind: "Field", name: { kind: "Name", value: "platformAdmins" } },
                { kind: "Field", name: { kind: "Name", value: "superusers" } },
                { kind: "Field", name: { kind: "Name", value: "regularUsers" } },
                { kind: "Field", name: { kind: "Name", value: "usersLoggedInLast24h" } },
                { kind: "Field", name: { kind: "Name", value: "usersLoggedInLast7d" } },
                { kind: "Field", name: { kind: "Name", value: "usersLoggedInLast30d" } },
                { kind: "Field", name: { kind: "Name", value: "neverLoggedIn" } },
                { kind: "Field", name: { kind: "Name", value: "newUsersThisMonth" } },
                { kind: "Field", name: { kind: "Name", value: "newUsersLastMonth" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<UserMetricsQuery, UserMetricsQueryVariables>;
export const RoleListDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "RoleList" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "page" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "Int" } },
          defaultValue: { kind: "IntValue", value: "1" },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "pageSize" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "Int" } },
          defaultValue: { kind: "IntValue", value: "20" },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "isActive" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "Boolean" } },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "isSystem" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "Boolean" } },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "search" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "String" } },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "roles" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "page" },
                value: { kind: "Variable", name: { kind: "Name", value: "page" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "pageSize" },
                value: { kind: "Variable", name: { kind: "Name", value: "pageSize" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "isActive" },
                value: { kind: "Variable", name: { kind: "Name", value: "isActive" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "isSystem" },
                value: { kind: "Variable", name: { kind: "Name", value: "isSystem" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "search" },
                value: { kind: "Variable", name: { kind: "Name", value: "search" } },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                {
                  kind: "Field",
                  name: { kind: "Name", value: "roles" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "id" } },
                      { kind: "Field", name: { kind: "Name", value: "name" } },
                      { kind: "Field", name: { kind: "Name", value: "displayName" } },
                      { kind: "Field", name: { kind: "Name", value: "description" } },
                      { kind: "Field", name: { kind: "Name", value: "priority" } },
                      { kind: "Field", name: { kind: "Name", value: "isSystem" } },
                      { kind: "Field", name: { kind: "Name", value: "isActive" } },
                      { kind: "Field", name: { kind: "Name", value: "isDefault" } },
                      { kind: "Field", name: { kind: "Name", value: "createdAt" } },
                      { kind: "Field", name: { kind: "Name", value: "updatedAt" } },
                    ],
                  },
                },
                { kind: "Field", name: { kind: "Name", value: "totalCount" } },
                { kind: "Field", name: { kind: "Name", value: "hasNextPage" } },
                { kind: "Field", name: { kind: "Name", value: "hasPrevPage" } },
                { kind: "Field", name: { kind: "Name", value: "page" } },
                { kind: "Field", name: { kind: "Name", value: "pageSize" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<RoleListQuery, RoleListQueryVariables>;
export const PermissionsByCategoryDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "PermissionsByCategory" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "category" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "PermissionCategoryEnum" } },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "permissionsByCategory" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "category" },
                value: { kind: "Variable", name: { kind: "Name", value: "category" } },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "category" } },
                { kind: "Field", name: { kind: "Name", value: "count" } },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "permissions" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "id" } },
                      { kind: "Field", name: { kind: "Name", value: "name" } },
                      { kind: "Field", name: { kind: "Name", value: "displayName" } },
                      { kind: "Field", name: { kind: "Name", value: "description" } },
                      { kind: "Field", name: { kind: "Name", value: "category" } },
                      { kind: "Field", name: { kind: "Name", value: "isActive" } },
                      { kind: "Field", name: { kind: "Name", value: "isSystem" } },
                      { kind: "Field", name: { kind: "Name", value: "createdAt" } },
                      { kind: "Field", name: { kind: "Name", value: "updatedAt" } },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<PermissionsByCategoryQuery, PermissionsByCategoryQueryVariables>;
export const UserDashboardDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "UserDashboard" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "page" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "Int" } },
          defaultValue: { kind: "IntValue", value: "1" },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "pageSize" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "Int" } },
          defaultValue: { kind: "IntValue", value: "10" },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "isActive" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "Boolean" } },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "search" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "String" } },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "users" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "page" },
                value: { kind: "Variable", name: { kind: "Name", value: "page" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "pageSize" },
                value: { kind: "Variable", name: { kind: "Name", value: "pageSize" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "isActive" },
                value: { kind: "Variable", name: { kind: "Name", value: "isActive" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "search" },
                value: { kind: "Variable", name: { kind: "Name", value: "search" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "includeMetadata" },
                value: { kind: "BooleanValue", value: false },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "includeRoles" },
                value: { kind: "BooleanValue", value: true },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "includePermissions" },
                value: { kind: "BooleanValue", value: false },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "includeTeams" },
                value: { kind: "BooleanValue", value: false },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                {
                  kind: "Field",
                  name: { kind: "Name", value: "users" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "id" } },
                      { kind: "Field", name: { kind: "Name", value: "username" } },
                      { kind: "Field", name: { kind: "Name", value: "email" } },
                      { kind: "Field", name: { kind: "Name", value: "fullName" } },
                      { kind: "Field", name: { kind: "Name", value: "isActive" } },
                      { kind: "Field", name: { kind: "Name", value: "isVerified" } },
                      { kind: "Field", name: { kind: "Name", value: "isSuperuser" } },
                      { kind: "Field", name: { kind: "Name", value: "lastLogin" } },
                      { kind: "Field", name: { kind: "Name", value: "createdAt" } },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "roles" },
                        selectionSet: {
                          kind: "SelectionSet",
                          selections: [
                            { kind: "Field", name: { kind: "Name", value: "id" } },
                            { kind: "Field", name: { kind: "Name", value: "name" } },
                            { kind: "Field", name: { kind: "Name", value: "displayName" } },
                          ],
                        },
                      },
                    ],
                  },
                },
                { kind: "Field", name: { kind: "Name", value: "totalCount" } },
                { kind: "Field", name: { kind: "Name", value: "hasNextPage" } },
              ],
            },
          },
          {
            kind: "Field",
            name: { kind: "Name", value: "userMetrics" },
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "totalUsers" } },
                { kind: "Field", name: { kind: "Name", value: "activeUsers" } },
                { kind: "Field", name: { kind: "Name", value: "suspendedUsers" } },
                { kind: "Field", name: { kind: "Name", value: "verifiedUsers" } },
                { kind: "Field", name: { kind: "Name", value: "mfaEnabledUsers" } },
                { kind: "Field", name: { kind: "Name", value: "platformAdmins" } },
                { kind: "Field", name: { kind: "Name", value: "superusers" } },
                { kind: "Field", name: { kind: "Name", value: "regularUsers" } },
                { kind: "Field", name: { kind: "Name", value: "usersLoggedInLast24h" } },
                { kind: "Field", name: { kind: "Name", value: "usersLoggedInLast7d" } },
                { kind: "Field", name: { kind: "Name", value: "newUsersThisMonth" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<UserDashboardQuery, UserDashboardQueryVariables>;
export const UserRolesDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "UserRoles" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "id" } },
          type: {
            kind: "NonNullType",
            type: { kind: "NamedType", name: { kind: "Name", value: "ID" } },
          },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "user" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "id" },
                value: { kind: "Variable", name: { kind: "Name", value: "id" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "includeRoles" },
                value: { kind: "BooleanValue", value: true },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "id" } },
                { kind: "Field", name: { kind: "Name", value: "username" } },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "roles" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "id" } },
                      { kind: "Field", name: { kind: "Name", value: "name" } },
                      { kind: "Field", name: { kind: "Name", value: "displayName" } },
                      { kind: "Field", name: { kind: "Name", value: "description" } },
                      { kind: "Field", name: { kind: "Name", value: "priority" } },
                      { kind: "Field", name: { kind: "Name", value: "isSystem" } },
                      { kind: "Field", name: { kind: "Name", value: "isActive" } },
                      { kind: "Field", name: { kind: "Name", value: "createdAt" } },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<UserRolesQuery, UserRolesQueryVariables>;
export const UserPermissionsDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "UserPermissions" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "id" } },
          type: {
            kind: "NonNullType",
            type: { kind: "NamedType", name: { kind: "Name", value: "ID" } },
          },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "user" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "id" },
                value: { kind: "Variable", name: { kind: "Name", value: "id" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "includePermissions" },
                value: { kind: "BooleanValue", value: true },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "id" } },
                { kind: "Field", name: { kind: "Name", value: "username" } },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "permissions" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "id" } },
                      { kind: "Field", name: { kind: "Name", value: "name" } },
                      { kind: "Field", name: { kind: "Name", value: "displayName" } },
                      { kind: "Field", name: { kind: "Name", value: "description" } },
                      { kind: "Field", name: { kind: "Name", value: "category" } },
                      { kind: "Field", name: { kind: "Name", value: "isActive" } },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<UserPermissionsQuery, UserPermissionsQueryVariables>;
export const UserTeamsDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "UserTeams" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "id" } },
          type: {
            kind: "NonNullType",
            type: { kind: "NamedType", name: { kind: "Name", value: "ID" } },
          },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "user" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "id" },
                value: { kind: "Variable", name: { kind: "Name", value: "id" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "includeTeams" },
                value: { kind: "BooleanValue", value: true },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "id" } },
                { kind: "Field", name: { kind: "Name", value: "username" } },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "teams" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "teamId" } },
                      { kind: "Field", name: { kind: "Name", value: "teamName" } },
                      { kind: "Field", name: { kind: "Name", value: "role" } },
                      { kind: "Field", name: { kind: "Name", value: "joinedAt" } },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<UserTeamsQuery, UserTeamsQueryVariables>;
export const AccessPointListDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "AccessPointList" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "limit" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "Int" } },
          defaultValue: { kind: "IntValue", value: "50" },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "offset" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "Int" } },
          defaultValue: { kind: "IntValue", value: "0" },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "siteId" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "String" } },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "status" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "AccessPointStatus" } },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "frequencyBand" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "FrequencyBand" } },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "search" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "String" } },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "accessPoints" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "limit" },
                value: { kind: "Variable", name: { kind: "Name", value: "limit" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "offset" },
                value: { kind: "Variable", name: { kind: "Name", value: "offset" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "siteId" },
                value: { kind: "Variable", name: { kind: "Name", value: "siteId" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "status" },
                value: { kind: "Variable", name: { kind: "Name", value: "status" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "frequencyBand" },
                value: { kind: "Variable", name: { kind: "Name", value: "frequencyBand" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "search" },
                value: { kind: "Variable", name: { kind: "Name", value: "search" } },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                {
                  kind: "Field",
                  name: { kind: "Name", value: "accessPoints" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "id" } },
                      { kind: "Field", name: { kind: "Name", value: "name" } },
                      { kind: "Field", name: { kind: "Name", value: "macAddress" } },
                      { kind: "Field", name: { kind: "Name", value: "ipAddress" } },
                      { kind: "Field", name: { kind: "Name", value: "serialNumber" } },
                      { kind: "Field", name: { kind: "Name", value: "status" } },
                      { kind: "Field", name: { kind: "Name", value: "isOnline" } },
                      { kind: "Field", name: { kind: "Name", value: "lastSeenAt" } },
                      { kind: "Field", name: { kind: "Name", value: "model" } },
                      { kind: "Field", name: { kind: "Name", value: "manufacturer" } },
                      { kind: "Field", name: { kind: "Name", value: "firmwareVersion" } },
                      { kind: "Field", name: { kind: "Name", value: "ssid" } },
                      { kind: "Field", name: { kind: "Name", value: "frequencyBand" } },
                      { kind: "Field", name: { kind: "Name", value: "channel" } },
                      { kind: "Field", name: { kind: "Name", value: "channelWidth" } },
                      { kind: "Field", name: { kind: "Name", value: "transmitPower" } },
                      { kind: "Field", name: { kind: "Name", value: "maxClients" } },
                      { kind: "Field", name: { kind: "Name", value: "securityType" } },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "location" },
                        selectionSet: {
                          kind: "SelectionSet",
                          selections: [
                            { kind: "Field", name: { kind: "Name", value: "siteName" } },
                            { kind: "Field", name: { kind: "Name", value: "building" } },
                            { kind: "Field", name: { kind: "Name", value: "floor" } },
                            { kind: "Field", name: { kind: "Name", value: "room" } },
                            { kind: "Field", name: { kind: "Name", value: "mountingType" } },
                            {
                              kind: "Field",
                              name: { kind: "Name", value: "coordinates" },
                              selectionSet: {
                                kind: "SelectionSet",
                                selections: [
                                  { kind: "Field", name: { kind: "Name", value: "latitude" } },
                                  { kind: "Field", name: { kind: "Name", value: "longitude" } },
                                  { kind: "Field", name: { kind: "Name", value: "altitude" } },
                                ],
                              },
                            },
                          ],
                        },
                      },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "rfMetrics" },
                        selectionSet: {
                          kind: "SelectionSet",
                          selections: [
                            { kind: "Field", name: { kind: "Name", value: "signalStrengthDbm" } },
                            { kind: "Field", name: { kind: "Name", value: "noiseFloorDbm" } },
                            { kind: "Field", name: { kind: "Name", value: "signalToNoiseRatio" } },
                            {
                              kind: "Field",
                              name: { kind: "Name", value: "channelUtilizationPercent" },
                            },
                            { kind: "Field", name: { kind: "Name", value: "interferenceLevel" } },
                            { kind: "Field", name: { kind: "Name", value: "txPowerDbm" } },
                            { kind: "Field", name: { kind: "Name", value: "rxPowerDbm" } },
                          ],
                        },
                      },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "performance" },
                        selectionSet: {
                          kind: "SelectionSet",
                          selections: [
                            { kind: "Field", name: { kind: "Name", value: "txBytes" } },
                            { kind: "Field", name: { kind: "Name", value: "rxBytes" } },
                            { kind: "Field", name: { kind: "Name", value: "txPackets" } },
                            { kind: "Field", name: { kind: "Name", value: "rxPackets" } },
                            { kind: "Field", name: { kind: "Name", value: "txRateMbps" } },
                            { kind: "Field", name: { kind: "Name", value: "rxRateMbps" } },
                            { kind: "Field", name: { kind: "Name", value: "txErrors" } },
                            { kind: "Field", name: { kind: "Name", value: "rxErrors" } },
                            { kind: "Field", name: { kind: "Name", value: "connectedClients" } },
                            { kind: "Field", name: { kind: "Name", value: "cpuUsagePercent" } },
                            { kind: "Field", name: { kind: "Name", value: "memoryUsagePercent" } },
                            { kind: "Field", name: { kind: "Name", value: "uptimeSeconds" } },
                          ],
                        },
                      },
                      { kind: "Field", name: { kind: "Name", value: "controllerName" } },
                      { kind: "Field", name: { kind: "Name", value: "siteName" } },
                      { kind: "Field", name: { kind: "Name", value: "createdAt" } },
                      { kind: "Field", name: { kind: "Name", value: "updatedAt" } },
                      { kind: "Field", name: { kind: "Name", value: "lastRebootAt" } },
                    ],
                  },
                },
                { kind: "Field", name: { kind: "Name", value: "totalCount" } },
                { kind: "Field", name: { kind: "Name", value: "hasNextPage" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<AccessPointListQuery, AccessPointListQueryVariables>;
export const AccessPointDetailDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "AccessPointDetail" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "id" } },
          type: {
            kind: "NonNullType",
            type: { kind: "NamedType", name: { kind: "Name", value: "ID" } },
          },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "accessPoint" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "id" },
                value: { kind: "Variable", name: { kind: "Name", value: "id" } },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "id" } },
                { kind: "Field", name: { kind: "Name", value: "name" } },
                { kind: "Field", name: { kind: "Name", value: "macAddress" } },
                { kind: "Field", name: { kind: "Name", value: "ipAddress" } },
                { kind: "Field", name: { kind: "Name", value: "serialNumber" } },
                { kind: "Field", name: { kind: "Name", value: "status" } },
                { kind: "Field", name: { kind: "Name", value: "isOnline" } },
                { kind: "Field", name: { kind: "Name", value: "lastSeenAt" } },
                { kind: "Field", name: { kind: "Name", value: "model" } },
                { kind: "Field", name: { kind: "Name", value: "manufacturer" } },
                { kind: "Field", name: { kind: "Name", value: "firmwareVersion" } },
                { kind: "Field", name: { kind: "Name", value: "hardwareRevision" } },
                { kind: "Field", name: { kind: "Name", value: "ssid" } },
                { kind: "Field", name: { kind: "Name", value: "frequencyBand" } },
                { kind: "Field", name: { kind: "Name", value: "channel" } },
                { kind: "Field", name: { kind: "Name", value: "channelWidth" } },
                { kind: "Field", name: { kind: "Name", value: "transmitPower" } },
                { kind: "Field", name: { kind: "Name", value: "maxClients" } },
                { kind: "Field", name: { kind: "Name", value: "securityType" } },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "location" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "siteName" } },
                      { kind: "Field", name: { kind: "Name", value: "building" } },
                      { kind: "Field", name: { kind: "Name", value: "floor" } },
                      { kind: "Field", name: { kind: "Name", value: "room" } },
                      { kind: "Field", name: { kind: "Name", value: "mountingType" } },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "coordinates" },
                        selectionSet: {
                          kind: "SelectionSet",
                          selections: [
                            { kind: "Field", name: { kind: "Name", value: "latitude" } },
                            { kind: "Field", name: { kind: "Name", value: "longitude" } },
                            { kind: "Field", name: { kind: "Name", value: "altitude" } },
                            { kind: "Field", name: { kind: "Name", value: "accuracy" } },
                          ],
                        },
                      },
                    ],
                  },
                },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "rfMetrics" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "signalStrengthDbm" } },
                      { kind: "Field", name: { kind: "Name", value: "noiseFloorDbm" } },
                      { kind: "Field", name: { kind: "Name", value: "signalToNoiseRatio" } },
                      { kind: "Field", name: { kind: "Name", value: "channelUtilizationPercent" } },
                      { kind: "Field", name: { kind: "Name", value: "interferenceLevel" } },
                      { kind: "Field", name: { kind: "Name", value: "txPowerDbm" } },
                      { kind: "Field", name: { kind: "Name", value: "rxPowerDbm" } },
                    ],
                  },
                },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "performance" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "txBytes" } },
                      { kind: "Field", name: { kind: "Name", value: "rxBytes" } },
                      { kind: "Field", name: { kind: "Name", value: "txPackets" } },
                      { kind: "Field", name: { kind: "Name", value: "rxPackets" } },
                      { kind: "Field", name: { kind: "Name", value: "txRateMbps" } },
                      { kind: "Field", name: { kind: "Name", value: "rxRateMbps" } },
                      { kind: "Field", name: { kind: "Name", value: "txErrors" } },
                      { kind: "Field", name: { kind: "Name", value: "rxErrors" } },
                      { kind: "Field", name: { kind: "Name", value: "txDropped" } },
                      { kind: "Field", name: { kind: "Name", value: "rxDropped" } },
                      { kind: "Field", name: { kind: "Name", value: "retries" } },
                      { kind: "Field", name: { kind: "Name", value: "retryRatePercent" } },
                      { kind: "Field", name: { kind: "Name", value: "connectedClients" } },
                      { kind: "Field", name: { kind: "Name", value: "authenticatedClients" } },
                      { kind: "Field", name: { kind: "Name", value: "authorizedClients" } },
                      { kind: "Field", name: { kind: "Name", value: "cpuUsagePercent" } },
                      { kind: "Field", name: { kind: "Name", value: "memoryUsagePercent" } },
                      { kind: "Field", name: { kind: "Name", value: "uptimeSeconds" } },
                    ],
                  },
                },
                { kind: "Field", name: { kind: "Name", value: "controllerId" } },
                { kind: "Field", name: { kind: "Name", value: "controllerName" } },
                { kind: "Field", name: { kind: "Name", value: "siteId" } },
                { kind: "Field", name: { kind: "Name", value: "siteName" } },
                { kind: "Field", name: { kind: "Name", value: "createdAt" } },
                { kind: "Field", name: { kind: "Name", value: "updatedAt" } },
                { kind: "Field", name: { kind: "Name", value: "lastRebootAt" } },
                { kind: "Field", name: { kind: "Name", value: "isMeshEnabled" } },
                { kind: "Field", name: { kind: "Name", value: "isBandSteeringEnabled" } },
                { kind: "Field", name: { kind: "Name", value: "isLoadBalancingEnabled" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<AccessPointDetailQuery, AccessPointDetailQueryVariables>;
export const AccessPointsBySiteDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "AccessPointsBySite" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "siteId" } },
          type: {
            kind: "NonNullType",
            type: { kind: "NamedType", name: { kind: "Name", value: "String" } },
          },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "accessPointsBySite" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "siteId" },
                value: { kind: "Variable", name: { kind: "Name", value: "siteId" } },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "id" } },
                { kind: "Field", name: { kind: "Name", value: "name" } },
                { kind: "Field", name: { kind: "Name", value: "macAddress" } },
                { kind: "Field", name: { kind: "Name", value: "ipAddress" } },
                { kind: "Field", name: { kind: "Name", value: "status" } },
                { kind: "Field", name: { kind: "Name", value: "isOnline" } },
                { kind: "Field", name: { kind: "Name", value: "ssid" } },
                { kind: "Field", name: { kind: "Name", value: "frequencyBand" } },
                { kind: "Field", name: { kind: "Name", value: "channel" } },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "performance" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "connectedClients" } },
                      { kind: "Field", name: { kind: "Name", value: "cpuUsagePercent" } },
                      { kind: "Field", name: { kind: "Name", value: "memoryUsagePercent" } },
                    ],
                  },
                },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "rfMetrics" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "signalStrengthDbm" } },
                      { kind: "Field", name: { kind: "Name", value: "channelUtilizationPercent" } },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<AccessPointsBySiteQuery, AccessPointsBySiteQueryVariables>;
export const WirelessClientListDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "WirelessClientList" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "limit" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "Int" } },
          defaultValue: { kind: "IntValue", value: "50" },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "offset" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "Int" } },
          defaultValue: { kind: "IntValue", value: "0" },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "accessPointId" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "String" } },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "customerId" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "String" } },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "frequencyBand" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "FrequencyBand" } },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "search" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "String" } },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "wirelessClients" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "limit" },
                value: { kind: "Variable", name: { kind: "Name", value: "limit" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "offset" },
                value: { kind: "Variable", name: { kind: "Name", value: "offset" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "accessPointId" },
                value: { kind: "Variable", name: { kind: "Name", value: "accessPointId" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "customerId" },
                value: { kind: "Variable", name: { kind: "Name", value: "customerId" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "frequencyBand" },
                value: { kind: "Variable", name: { kind: "Name", value: "frequencyBand" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "search" },
                value: { kind: "Variable", name: { kind: "Name", value: "search" } },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                {
                  kind: "Field",
                  name: { kind: "Name", value: "clients" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "id" } },
                      { kind: "Field", name: { kind: "Name", value: "macAddress" } },
                      { kind: "Field", name: { kind: "Name", value: "hostname" } },
                      { kind: "Field", name: { kind: "Name", value: "ipAddress" } },
                      { kind: "Field", name: { kind: "Name", value: "manufacturer" } },
                      { kind: "Field", name: { kind: "Name", value: "accessPointId" } },
                      { kind: "Field", name: { kind: "Name", value: "accessPointName" } },
                      { kind: "Field", name: { kind: "Name", value: "ssid" } },
                      { kind: "Field", name: { kind: "Name", value: "connectionType" } },
                      { kind: "Field", name: { kind: "Name", value: "frequencyBand" } },
                      { kind: "Field", name: { kind: "Name", value: "channel" } },
                      { kind: "Field", name: { kind: "Name", value: "isAuthenticated" } },
                      { kind: "Field", name: { kind: "Name", value: "isAuthorized" } },
                      { kind: "Field", name: { kind: "Name", value: "signalStrengthDbm" } },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "signalQuality" },
                        selectionSet: {
                          kind: "SelectionSet",
                          selections: [
                            { kind: "Field", name: { kind: "Name", value: "rssiDbm" } },
                            { kind: "Field", name: { kind: "Name", value: "snrDb" } },
                            { kind: "Field", name: { kind: "Name", value: "noiseFloorDbm" } },
                            {
                              kind: "Field",
                              name: { kind: "Name", value: "signalStrengthPercent" },
                            },
                            { kind: "Field", name: { kind: "Name", value: "linkQualityPercent" } },
                          ],
                        },
                      },
                      { kind: "Field", name: { kind: "Name", value: "noiseFloorDbm" } },
                      { kind: "Field", name: { kind: "Name", value: "snr" } },
                      { kind: "Field", name: { kind: "Name", value: "txRateMbps" } },
                      { kind: "Field", name: { kind: "Name", value: "rxRateMbps" } },
                      { kind: "Field", name: { kind: "Name", value: "txBytes" } },
                      { kind: "Field", name: { kind: "Name", value: "rxBytes" } },
                      { kind: "Field", name: { kind: "Name", value: "connectedAt" } },
                      { kind: "Field", name: { kind: "Name", value: "lastSeenAt" } },
                      { kind: "Field", name: { kind: "Name", value: "uptimeSeconds" } },
                      { kind: "Field", name: { kind: "Name", value: "customerId" } },
                      { kind: "Field", name: { kind: "Name", value: "customerName" } },
                    ],
                  },
                },
                { kind: "Field", name: { kind: "Name", value: "totalCount" } },
                { kind: "Field", name: { kind: "Name", value: "hasNextPage" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<WirelessClientListQuery, WirelessClientListQueryVariables>;
export const WirelessClientDetailDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "WirelessClientDetail" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "id" } },
          type: {
            kind: "NonNullType",
            type: { kind: "NamedType", name: { kind: "Name", value: "ID" } },
          },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "wirelessClient" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "id" },
                value: { kind: "Variable", name: { kind: "Name", value: "id" } },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "id" } },
                { kind: "Field", name: { kind: "Name", value: "macAddress" } },
                { kind: "Field", name: { kind: "Name", value: "hostname" } },
                { kind: "Field", name: { kind: "Name", value: "ipAddress" } },
                { kind: "Field", name: { kind: "Name", value: "manufacturer" } },
                { kind: "Field", name: { kind: "Name", value: "accessPointId" } },
                { kind: "Field", name: { kind: "Name", value: "accessPointName" } },
                { kind: "Field", name: { kind: "Name", value: "ssid" } },
                { kind: "Field", name: { kind: "Name", value: "connectionType" } },
                { kind: "Field", name: { kind: "Name", value: "frequencyBand" } },
                { kind: "Field", name: { kind: "Name", value: "channel" } },
                { kind: "Field", name: { kind: "Name", value: "isAuthenticated" } },
                { kind: "Field", name: { kind: "Name", value: "isAuthorized" } },
                { kind: "Field", name: { kind: "Name", value: "authMethod" } },
                { kind: "Field", name: { kind: "Name", value: "signalStrengthDbm" } },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "signalQuality" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "rssiDbm" } },
                      { kind: "Field", name: { kind: "Name", value: "snrDb" } },
                      { kind: "Field", name: { kind: "Name", value: "noiseFloorDbm" } },
                      { kind: "Field", name: { kind: "Name", value: "signalStrengthPercent" } },
                      { kind: "Field", name: { kind: "Name", value: "linkQualityPercent" } },
                    ],
                  },
                },
                { kind: "Field", name: { kind: "Name", value: "noiseFloorDbm" } },
                { kind: "Field", name: { kind: "Name", value: "snr" } },
                { kind: "Field", name: { kind: "Name", value: "txRateMbps" } },
                { kind: "Field", name: { kind: "Name", value: "rxRateMbps" } },
                { kind: "Field", name: { kind: "Name", value: "txBytes" } },
                { kind: "Field", name: { kind: "Name", value: "rxBytes" } },
                { kind: "Field", name: { kind: "Name", value: "txPackets" } },
                { kind: "Field", name: { kind: "Name", value: "rxPackets" } },
                { kind: "Field", name: { kind: "Name", value: "txRetries" } },
                { kind: "Field", name: { kind: "Name", value: "rxRetries" } },
                { kind: "Field", name: { kind: "Name", value: "connectedAt" } },
                { kind: "Field", name: { kind: "Name", value: "lastSeenAt" } },
                { kind: "Field", name: { kind: "Name", value: "uptimeSeconds" } },
                { kind: "Field", name: { kind: "Name", value: "idleTimeSeconds" } },
                { kind: "Field", name: { kind: "Name", value: "supports80211k" } },
                { kind: "Field", name: { kind: "Name", value: "supports80211r" } },
                { kind: "Field", name: { kind: "Name", value: "supports80211v" } },
                { kind: "Field", name: { kind: "Name", value: "maxPhyRateMbps" } },
                { kind: "Field", name: { kind: "Name", value: "customerId" } },
                { kind: "Field", name: { kind: "Name", value: "customerName" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<WirelessClientDetailQuery, WirelessClientDetailQueryVariables>;
export const WirelessClientsByAccessPointDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "WirelessClientsByAccessPoint" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "accessPointId" } },
          type: {
            kind: "NonNullType",
            type: { kind: "NamedType", name: { kind: "Name", value: "String" } },
          },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "wirelessClientsByAccessPoint" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "accessPointId" },
                value: { kind: "Variable", name: { kind: "Name", value: "accessPointId" } },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "id" } },
                { kind: "Field", name: { kind: "Name", value: "macAddress" } },
                { kind: "Field", name: { kind: "Name", value: "hostname" } },
                { kind: "Field", name: { kind: "Name", value: "ipAddress" } },
                { kind: "Field", name: { kind: "Name", value: "ssid" } },
                { kind: "Field", name: { kind: "Name", value: "signalStrengthDbm" } },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "signalQuality" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "rssiDbm" } },
                      { kind: "Field", name: { kind: "Name", value: "snrDb" } },
                      { kind: "Field", name: { kind: "Name", value: "noiseFloorDbm" } },
                      { kind: "Field", name: { kind: "Name", value: "signalStrengthPercent" } },
                      { kind: "Field", name: { kind: "Name", value: "linkQualityPercent" } },
                    ],
                  },
                },
                { kind: "Field", name: { kind: "Name", value: "txRateMbps" } },
                { kind: "Field", name: { kind: "Name", value: "rxRateMbps" } },
                { kind: "Field", name: { kind: "Name", value: "connectedAt" } },
                { kind: "Field", name: { kind: "Name", value: "customerId" } },
                { kind: "Field", name: { kind: "Name", value: "customerName" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  WirelessClientsByAccessPointQuery,
  WirelessClientsByAccessPointQueryVariables
>;
export const WirelessClientsByCustomerDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "WirelessClientsByCustomer" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "customerId" } },
          type: {
            kind: "NonNullType",
            type: { kind: "NamedType", name: { kind: "Name", value: "String" } },
          },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "wirelessClientsByCustomer" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "customerId" },
                value: { kind: "Variable", name: { kind: "Name", value: "customerId" } },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "id" } },
                { kind: "Field", name: { kind: "Name", value: "macAddress" } },
                { kind: "Field", name: { kind: "Name", value: "hostname" } },
                { kind: "Field", name: { kind: "Name", value: "ipAddress" } },
                { kind: "Field", name: { kind: "Name", value: "accessPointName" } },
                { kind: "Field", name: { kind: "Name", value: "ssid" } },
                { kind: "Field", name: { kind: "Name", value: "frequencyBand" } },
                { kind: "Field", name: { kind: "Name", value: "signalStrengthDbm" } },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "signalQuality" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "rssiDbm" } },
                      { kind: "Field", name: { kind: "Name", value: "snrDb" } },
                      { kind: "Field", name: { kind: "Name", value: "noiseFloorDbm" } },
                      { kind: "Field", name: { kind: "Name", value: "signalStrengthPercent" } },
                      { kind: "Field", name: { kind: "Name", value: "linkQualityPercent" } },
                    ],
                  },
                },
                { kind: "Field", name: { kind: "Name", value: "isAuthenticated" } },
                { kind: "Field", name: { kind: "Name", value: "connectedAt" } },
                { kind: "Field", name: { kind: "Name", value: "lastSeenAt" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  WirelessClientsByCustomerQuery,
  WirelessClientsByCustomerQueryVariables
>;
export const CoverageZoneListDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "CoverageZoneList" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "limit" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "Int" } },
          defaultValue: { kind: "IntValue", value: "50" },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "offset" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "Int" } },
          defaultValue: { kind: "IntValue", value: "0" },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "siteId" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "String" } },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "areaType" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "String" } },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "coverageZones" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "limit" },
                value: { kind: "Variable", name: { kind: "Name", value: "limit" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "offset" },
                value: { kind: "Variable", name: { kind: "Name", value: "offset" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "siteId" },
                value: { kind: "Variable", name: { kind: "Name", value: "siteId" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "areaType" },
                value: { kind: "Variable", name: { kind: "Name", value: "areaType" } },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                {
                  kind: "Field",
                  name: { kind: "Name", value: "zones" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "id" } },
                      { kind: "Field", name: { kind: "Name", value: "name" } },
                      { kind: "Field", name: { kind: "Name", value: "description" } },
                      { kind: "Field", name: { kind: "Name", value: "siteId" } },
                      { kind: "Field", name: { kind: "Name", value: "siteName" } },
                      { kind: "Field", name: { kind: "Name", value: "floor" } },
                      { kind: "Field", name: { kind: "Name", value: "areaType" } },
                      { kind: "Field", name: { kind: "Name", value: "coverageAreaSqm" } },
                      { kind: "Field", name: { kind: "Name", value: "signalStrengthMinDbm" } },
                      { kind: "Field", name: { kind: "Name", value: "signalStrengthMaxDbm" } },
                      { kind: "Field", name: { kind: "Name", value: "signalStrengthAvgDbm" } },
                      { kind: "Field", name: { kind: "Name", value: "accessPointIds" } },
                      { kind: "Field", name: { kind: "Name", value: "accessPointCount" } },
                      { kind: "Field", name: { kind: "Name", value: "interferenceLevel" } },
                      { kind: "Field", name: { kind: "Name", value: "channelUtilizationAvg" } },
                      { kind: "Field", name: { kind: "Name", value: "noiseFloorAvgDbm" } },
                      { kind: "Field", name: { kind: "Name", value: "connectedClients" } },
                      { kind: "Field", name: { kind: "Name", value: "maxClientCapacity" } },
                      { kind: "Field", name: { kind: "Name", value: "clientDensityPerAp" } },
                      { kind: "Field", name: { kind: "Name", value: "coveragePolygon" } },
                      { kind: "Field", name: { kind: "Name", value: "createdAt" } },
                      { kind: "Field", name: { kind: "Name", value: "updatedAt" } },
                      { kind: "Field", name: { kind: "Name", value: "lastSurveyedAt" } },
                    ],
                  },
                },
                { kind: "Field", name: { kind: "Name", value: "totalCount" } },
                { kind: "Field", name: { kind: "Name", value: "hasNextPage" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<CoverageZoneListQuery, CoverageZoneListQueryVariables>;
export const CoverageZoneDetailDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "CoverageZoneDetail" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "id" } },
          type: {
            kind: "NonNullType",
            type: { kind: "NamedType", name: { kind: "Name", value: "ID" } },
          },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "coverageZone" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "id" },
                value: { kind: "Variable", name: { kind: "Name", value: "id" } },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "id" } },
                { kind: "Field", name: { kind: "Name", value: "name" } },
                { kind: "Field", name: { kind: "Name", value: "description" } },
                { kind: "Field", name: { kind: "Name", value: "siteId" } },
                { kind: "Field", name: { kind: "Name", value: "siteName" } },
                { kind: "Field", name: { kind: "Name", value: "floor" } },
                { kind: "Field", name: { kind: "Name", value: "areaType" } },
                { kind: "Field", name: { kind: "Name", value: "coverageAreaSqm" } },
                { kind: "Field", name: { kind: "Name", value: "signalStrengthMinDbm" } },
                { kind: "Field", name: { kind: "Name", value: "signalStrengthMaxDbm" } },
                { kind: "Field", name: { kind: "Name", value: "signalStrengthAvgDbm" } },
                { kind: "Field", name: { kind: "Name", value: "accessPointIds" } },
                { kind: "Field", name: { kind: "Name", value: "accessPointCount" } },
                { kind: "Field", name: { kind: "Name", value: "interferenceLevel" } },
                { kind: "Field", name: { kind: "Name", value: "channelUtilizationAvg" } },
                { kind: "Field", name: { kind: "Name", value: "noiseFloorAvgDbm" } },
                { kind: "Field", name: { kind: "Name", value: "connectedClients" } },
                { kind: "Field", name: { kind: "Name", value: "maxClientCapacity" } },
                { kind: "Field", name: { kind: "Name", value: "clientDensityPerAp" } },
                { kind: "Field", name: { kind: "Name", value: "coveragePolygon" } },
                { kind: "Field", name: { kind: "Name", value: "createdAt" } },
                { kind: "Field", name: { kind: "Name", value: "updatedAt" } },
                { kind: "Field", name: { kind: "Name", value: "lastSurveyedAt" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<CoverageZoneDetailQuery, CoverageZoneDetailQueryVariables>;
export const CoverageZonesBySiteDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "CoverageZonesBySite" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "siteId" } },
          type: {
            kind: "NonNullType",
            type: { kind: "NamedType", name: { kind: "Name", value: "String" } },
          },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "coverageZonesBySite" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "siteId" },
                value: { kind: "Variable", name: { kind: "Name", value: "siteId" } },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "id" } },
                { kind: "Field", name: { kind: "Name", value: "name" } },
                { kind: "Field", name: { kind: "Name", value: "floor" } },
                { kind: "Field", name: { kind: "Name", value: "areaType" } },
                { kind: "Field", name: { kind: "Name", value: "coverageAreaSqm" } },
                { kind: "Field", name: { kind: "Name", value: "accessPointCount" } },
                { kind: "Field", name: { kind: "Name", value: "connectedClients" } },
                { kind: "Field", name: { kind: "Name", value: "maxClientCapacity" } },
                { kind: "Field", name: { kind: "Name", value: "signalStrengthAvgDbm" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<CoverageZonesBySiteQuery, CoverageZonesBySiteQueryVariables>;
export const RfAnalyticsDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "RFAnalytics" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "siteId" } },
          type: {
            kind: "NonNullType",
            type: { kind: "NamedType", name: { kind: "Name", value: "String" } },
          },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "rfAnalytics" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "siteId" },
                value: { kind: "Variable", name: { kind: "Name", value: "siteId" } },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "siteId" } },
                { kind: "Field", name: { kind: "Name", value: "siteName" } },
                { kind: "Field", name: { kind: "Name", value: "analysisTimestamp" } },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "channelUtilization24ghz" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "channel" } },
                      { kind: "Field", name: { kind: "Name", value: "frequencyMhz" } },
                      { kind: "Field", name: { kind: "Name", value: "band" } },
                      { kind: "Field", name: { kind: "Name", value: "utilizationPercent" } },
                      { kind: "Field", name: { kind: "Name", value: "interferenceLevel" } },
                      { kind: "Field", name: { kind: "Name", value: "accessPointsCount" } },
                    ],
                  },
                },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "channelUtilization5ghz" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "channel" } },
                      { kind: "Field", name: { kind: "Name", value: "frequencyMhz" } },
                      { kind: "Field", name: { kind: "Name", value: "band" } },
                      { kind: "Field", name: { kind: "Name", value: "utilizationPercent" } },
                      { kind: "Field", name: { kind: "Name", value: "interferenceLevel" } },
                      { kind: "Field", name: { kind: "Name", value: "accessPointsCount" } },
                    ],
                  },
                },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "channelUtilization6ghz" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "channel" } },
                      { kind: "Field", name: { kind: "Name", value: "frequencyMhz" } },
                      { kind: "Field", name: { kind: "Name", value: "band" } },
                      { kind: "Field", name: { kind: "Name", value: "utilizationPercent" } },
                      { kind: "Field", name: { kind: "Name", value: "interferenceLevel" } },
                      { kind: "Field", name: { kind: "Name", value: "accessPointsCount" } },
                    ],
                  },
                },
                { kind: "Field", name: { kind: "Name", value: "recommendedChannels24ghz" } },
                { kind: "Field", name: { kind: "Name", value: "recommendedChannels5ghz" } },
                { kind: "Field", name: { kind: "Name", value: "recommendedChannels6ghz" } },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "interferenceSources" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "sourceType" } },
                      { kind: "Field", name: { kind: "Name", value: "frequencyMhz" } },
                      { kind: "Field", name: { kind: "Name", value: "strengthDbm" } },
                      { kind: "Field", name: { kind: "Name", value: "affectedChannels" } },
                    ],
                  },
                },
                { kind: "Field", name: { kind: "Name", value: "totalInterferenceScore" } },
                { kind: "Field", name: { kind: "Name", value: "averageSignalStrengthDbm" } },
                { kind: "Field", name: { kind: "Name", value: "averageSnr" } },
                { kind: "Field", name: { kind: "Name", value: "coverageQualityScore" } },
                { kind: "Field", name: { kind: "Name", value: "clientsPerBand24ghz" } },
                { kind: "Field", name: { kind: "Name", value: "clientsPerBand5ghz" } },
                { kind: "Field", name: { kind: "Name", value: "clientsPerBand6ghz" } },
                { kind: "Field", name: { kind: "Name", value: "bandUtilizationBalanceScore" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<RfAnalyticsQuery, RfAnalyticsQueryVariables>;
export const ChannelUtilizationDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "ChannelUtilization" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "siteId" } },
          type: {
            kind: "NonNullType",
            type: { kind: "NamedType", name: { kind: "Name", value: "String" } },
          },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "frequencyBand" } },
          type: {
            kind: "NonNullType",
            type: { kind: "NamedType", name: { kind: "Name", value: "FrequencyBand" } },
          },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "channelUtilization" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "siteId" },
                value: { kind: "Variable", name: { kind: "Name", value: "siteId" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "frequencyBand" },
                value: { kind: "Variable", name: { kind: "Name", value: "frequencyBand" } },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "channel" } },
                { kind: "Field", name: { kind: "Name", value: "frequencyMhz" } },
                { kind: "Field", name: { kind: "Name", value: "band" } },
                { kind: "Field", name: { kind: "Name", value: "utilizationPercent" } },
                { kind: "Field", name: { kind: "Name", value: "interferenceLevel" } },
                { kind: "Field", name: { kind: "Name", value: "accessPointsCount" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<ChannelUtilizationQuery, ChannelUtilizationQueryVariables>;
export const WirelessSiteMetricsDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "WirelessSiteMetrics" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "siteId" } },
          type: {
            kind: "NonNullType",
            type: { kind: "NamedType", name: { kind: "Name", value: "String" } },
          },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "wirelessSiteMetrics" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "siteId" },
                value: { kind: "Variable", name: { kind: "Name", value: "siteId" } },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "siteId" } },
                { kind: "Field", name: { kind: "Name", value: "siteName" } },
                { kind: "Field", name: { kind: "Name", value: "totalAps" } },
                { kind: "Field", name: { kind: "Name", value: "onlineAps" } },
                { kind: "Field", name: { kind: "Name", value: "offlineAps" } },
                { kind: "Field", name: { kind: "Name", value: "degradedAps" } },
                { kind: "Field", name: { kind: "Name", value: "totalClients" } },
                { kind: "Field", name: { kind: "Name", value: "clients24ghz" } },
                { kind: "Field", name: { kind: "Name", value: "clients5ghz" } },
                { kind: "Field", name: { kind: "Name", value: "clients6ghz" } },
                { kind: "Field", name: { kind: "Name", value: "averageSignalStrengthDbm" } },
                { kind: "Field", name: { kind: "Name", value: "averageSnr" } },
                { kind: "Field", name: { kind: "Name", value: "totalThroughputMbps" } },
                { kind: "Field", name: { kind: "Name", value: "totalCapacity" } },
                { kind: "Field", name: { kind: "Name", value: "capacityUtilizationPercent" } },
                { kind: "Field", name: { kind: "Name", value: "overallHealthScore" } },
                { kind: "Field", name: { kind: "Name", value: "rfHealthScore" } },
                { kind: "Field", name: { kind: "Name", value: "clientExperienceScore" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<WirelessSiteMetricsQuery, WirelessSiteMetricsQueryVariables>;
export const WirelessDashboardDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "WirelessDashboard" },
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "wirelessDashboard" },
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "totalSites" } },
                { kind: "Field", name: { kind: "Name", value: "totalAccessPoints" } },
                { kind: "Field", name: { kind: "Name", value: "totalClients" } },
                { kind: "Field", name: { kind: "Name", value: "totalCoverageZones" } },
                { kind: "Field", name: { kind: "Name", value: "onlineAps" } },
                { kind: "Field", name: { kind: "Name", value: "offlineAps" } },
                { kind: "Field", name: { kind: "Name", value: "degradedAps" } },
                { kind: "Field", name: { kind: "Name", value: "clientsByBand24ghz" } },
                { kind: "Field", name: { kind: "Name", value: "clientsByBand5ghz" } },
                { kind: "Field", name: { kind: "Name", value: "clientsByBand6ghz" } },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "topApsByClients" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "id" } },
                      { kind: "Field", name: { kind: "Name", value: "name" } },
                      { kind: "Field", name: { kind: "Name", value: "siteName" } },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "performance" },
                        selectionSet: {
                          kind: "SelectionSet",
                          selections: [
                            { kind: "Field", name: { kind: "Name", value: "connectedClients" } },
                          ],
                        },
                      },
                    ],
                  },
                },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "topApsByThroughput" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "id" } },
                      { kind: "Field", name: { kind: "Name", value: "name" } },
                      { kind: "Field", name: { kind: "Name", value: "siteName" } },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "performance" },
                        selectionSet: {
                          kind: "SelectionSet",
                          selections: [
                            { kind: "Field", name: { kind: "Name", value: "txRateMbps" } },
                            { kind: "Field", name: { kind: "Name", value: "rxRateMbps" } },
                          ],
                        },
                      },
                    ],
                  },
                },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "sitesWithIssues" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "siteId" } },
                      { kind: "Field", name: { kind: "Name", value: "siteName" } },
                      { kind: "Field", name: { kind: "Name", value: "offlineAps" } },
                      { kind: "Field", name: { kind: "Name", value: "degradedAps" } },
                      { kind: "Field", name: { kind: "Name", value: "overallHealthScore" } },
                    ],
                  },
                },
                { kind: "Field", name: { kind: "Name", value: "totalThroughputMbps" } },
                { kind: "Field", name: { kind: "Name", value: "averageSignalStrengthDbm" } },
                { kind: "Field", name: { kind: "Name", value: "averageClientExperienceScore" } },
                { kind: "Field", name: { kind: "Name", value: "clientCountTrend" } },
                { kind: "Field", name: { kind: "Name", value: "throughputTrendMbps" } },
                { kind: "Field", name: { kind: "Name", value: "offlineEventsCount" } },
                { kind: "Field", name: { kind: "Name", value: "generatedAt" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<WirelessDashboardQuery, WirelessDashboardQueryVariables>;
