/**
 * VOLTHA Component Constants
 *
 * Configuration values and magic numbers for VOLTHA PON management
 */

// ============================================================================
// Display Limits
// ============================================================================

export const DISPLAY_LIMITS = {
  /** Maximum number of ONUs to display in the dashboard list */
  ONUS_PER_PAGE: 20,
  /** Maximum number of critical alarms to display */
  CRITICAL_ALARMS: 5,
  /** Maximum number of PON ports to display per page */
  PON_PORTS_PER_PAGE: 10,
  /** Maximum number of discovered ONUs to show */
  DISCOVERED_ONUS: 50,
} as const;

// ============================================================================
// Optical Power Thresholds (dBm)
// ============================================================================

export const OPTICAL_POWER_THRESHOLDS = {
  /** Excellent signal quality threshold */
  EXCELLENT: -20,
  /** Good signal quality threshold */
  GOOD: -25,
  /** Fair signal quality threshold */
  FAIR: -28,
  /** Anything below FAIR is considered Poor */
} as const;

// ============================================================================
// Port Health Score Deductions
// ============================================================================

export const HEALTH_SCORE_DEDUCTIONS = {
  /** Base health score */
  BASE_SCORE: 100,
  /** Deduction for high utilization (>80%) */
  HIGH_UTILIZATION: 20,
  /** Deduction for medium utilization (>60%) */
  MEDIUM_UTILIZATION: 10,
  /** Deduction for low online ratio (<90%) */
  LOW_ONLINE_RATIO: 15,
  /** Deduction for medium online ratio (<95%) */
  MEDIUM_ONLINE_RATIO: 5,
  /** Deduction for poor optical power (<-28 dBm) */
  POOR_OPTICAL_POWER: 15,
  /** Deduction for fair optical power (<-25 dBm) */
  FAIR_OPTICAL_POWER: 5,
} as const;

// ============================================================================
// Utilization Thresholds (%)
// ============================================================================

export const UTILIZATION_THRESHOLDS = {
  /** Critical utilization level */
  CRITICAL: 80,
  /** Warning utilization level */
  WARNING: 60,
  /** Normal utilization level */
  NORMAL: 40,
} as const;

// ============================================================================
// Health Score Thresholds
// ============================================================================

export const HEALTH_SCORE_THRESHOLDS = {
  /** Healthy port threshold */
  HEALTHY: 90,
  /** Fair port threshold */
  FAIR: 70,
  /** Degraded port threshold */
  DEGRADED: 50,
  /** Anything below DEGRADED is Critical */
} as const;

// ============================================================================
// Online Ratio Thresholds
// ============================================================================

export const ONLINE_RATIO_THRESHOLDS = {
  /** Good online ratio */
  GOOD: 0.95,
  /** Acceptable online ratio */
  ACCEPTABLE: 0.9,
  /** Anything below ACCEPTABLE is problematic */
} as const;

// ============================================================================
// VLAN Configuration
// ============================================================================

export const VLAN_CONFIG = {
  /** Minimum valid VLAN ID */
  MIN_VLAN: 1,
  /** Maximum valid VLAN ID */
  MAX_VLAN: 4094,
} as const;

// ============================================================================
// PON Port Configuration
// ============================================================================

export const PON_PORT_CONFIG = {
  /** Typical number of PON ports on an OLT */
  TYPICAL_PORT_COUNT: 16,
  /** Minimum PON port number */
  MIN_PORT: 0,
  /** Maximum PON port number (typical) */
  MAX_PORT: 15,
} as const;

// ============================================================================
// Refresh Intervals (milliseconds)
// ============================================================================

export const REFRESH_INTERVALS = {
  /** Health status refresh interval */
  HEALTH: 60000, // 1 minute
  /** Alarms refresh interval */
  ALARMS: 30000, // 30 seconds
  /** Port statistics refresh interval */
  PORT_STATISTICS: 5000, // 5 seconds
  /** ONU list refresh interval */
  ONUS: 15000, // 15 seconds
  /** OLT list refresh interval */
  OLTS: 30000, // 30 seconds
} as const;

// ============================================================================
// Stale Time (milliseconds)
// ============================================================================

export const STALE_TIME = {
  /** Health status stale time */
  HEALTH: 30000, // 30 seconds
  /** OLT data stale time */
  OLTS: 30000, // 30 seconds
  /** ONU data stale time */
  ONUS: 15000, // 15 seconds
  /** OLT overview stale time */
  OLT_OVERVIEW: 15000, // 15 seconds
  /** Alarms stale time */
  ALARMS: 10000, // 10 seconds
  /** Port statistics stale time */
  PORT_STATISTICS: 5000, // 5 seconds
  /** Discovered ONUs stale time */
  DISCOVERED_ONUS: 0, // Always fetch fresh
} as const;

// ============================================================================
// Input Validation
// ============================================================================

export const VALIDATION = {
  /** Minimum ONU serial number length */
  MIN_SERIAL_LENGTH: 8,
  /** Maximum ONU serial number length */
  MAX_SERIAL_LENGTH: 16,
  /** Serial number pattern (alphanumeric) */
  SERIAL_PATTERN: /^[A-Z0-9]+$/,
} as const;

// ============================================================================
// Color Codes (Tailwind classes)
// ============================================================================

export const STATUS_COLORS = {
  /** Active/Healthy status */
  ACTIVE: "bg-green-500",
  /** Warning status */
  WARNING: "bg-yellow-500",
  /** Critical/Error status */
  CRITICAL: "bg-red-500",
  /** Degraded status */
  DEGRADED: "bg-orange-500",
  /** Normal status */
  NORMAL: "bg-blue-500",
  /** Unknown/Inactive status */
  INACTIVE: "bg-gray-200",
} as const;

// ============================================================================
// Debounce Delays (milliseconds)
// ============================================================================

export const DEBOUNCE_DELAYS = {
  /** Search input debounce */
  SEARCH: 300,
  /** Filter change debounce */
  FILTER: 200,
  /** Resize event debounce */
  RESIZE: 150,
} as const;
