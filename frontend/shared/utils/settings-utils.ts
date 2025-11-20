/**
 * Shared utility functions for admin settings
 */

import { SettingsCategory } from './settings-schemas';

/**
 * Category display names mapping
 */
const CATEGORY_DISPLAY_NAMES: Record<SettingsCategory, string> = {
  database: 'Database Configuration',
  jwt: 'JWT & Authentication',
  redis: 'Redis Cache',
  vault: 'Vault/Secrets Management',
  storage: 'Object Storage (MinIO/S3)',
  email: 'Email & SMTP',
  tenant: 'Multi-tenancy',
  cors: 'CORS Configuration',
  rate_limit: 'Rate Limiting',
  observability: 'Logging & Monitoring',
  celery: 'Background Tasks',
  features: 'Feature Flags',
  billing: 'Billing & Subscriptions',
  branding: 'Branding & Identity',
  urls: 'External Links & Templates',
};

/**
 * Get category display name
 * @param category - The settings category
 * @returns Human-readable display name
 */
export function getCategoryDisplayName(category: SettingsCategory): string {
  return CATEGORY_DISPLAY_NAMES[category] ?? category;
}

/**
 * Format last updated timestamp as relative time
 * @param timestamp - ISO timestamp string or null/undefined
 * @returns Formatted relative time string
 */
export function formatLastUpdated(timestamp: string | null | undefined): string {
  if (!timestamp) return 'Never';

  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;

  return date.toLocaleDateString();
}

/**
 * Mask sensitive field value for display
 * @param value - The value to mask
 * @param sensitive - Whether the value is sensitive
 * @returns Masked value or original value
 */
export function maskSensitiveValue(value: any, sensitive: boolean): string {
  if (!sensitive) return String(value);
  if (!value) return '';

  const str = String(value);
  if (str.length <= 4) return '***';
  return str.substring(0, 4) + '***';
}

/**
 * Validate that a category is supported
 * @param category - Category to validate
 * @returns True if category is valid
 */
export function isValidCategory(category: string): category is SettingsCategory {
  return Object.keys(CATEGORY_DISPLAY_NAMES).includes(category);
}

/**
 * Get all available categories
 * @returns Array of all settings categories
 */
export function getAllCategories(): SettingsCategory[] {
  return Object.keys(CATEGORY_DISPLAY_NAMES) as SettingsCategory[];
}

/**
 * Format setting field value for display
 * @param value - The field value
 * @param type - The field type
 * @returns Formatted value string
 */
export function formatSettingValue(value: any, type: string): string {
  if (value === null || value === undefined) return '—';

  switch (type) {
    case 'boolean':
      return value ? 'Enabled' : 'Disabled';
    case 'number':
    case 'integer':
      return String(value);
    case 'array':
      return Array.isArray(value) ? value.join(', ') : String(value);
    case 'json':
    case 'object':
      return JSON.stringify(value, null, 2);
    default:
      return String(value);
  }
}
