/**
 * Shared utility functions for licensing framework
 */

import { logger } from '@/lib/logger';

/**
 * Convert any error to Error instance
 * Helper to reduce repetitive error conversion in catch blocks
 *
 * @param err - Error of unknown type
 * @param fallbackMessage - Message to use if error cannot be converted
 * @returns Error instance
 */
export function toError(err: unknown, fallbackMessage = 'Unknown error'): Error {
  if (err instanceof Error) {
    return err;
  }
  if (typeof err === 'string') {
    return new Error(err);
  }
  if (err && typeof err === 'object' && 'message' in err) {
    return new Error(String(err.message));
  }
  return new Error(fallbackMessage);
}

/**
 * Log and rethrow an error
 * Combines logging and error throwing in one step
 *
 * @param message - Log message
 * @param err - Error to log and throw
 * @throws The original error after logging
 */
export function logAndThrow(message: string, err: unknown): never {
  const error = toError(err);
  logger.error(message, error);
  throw error;
}

/**
 * Log error and return default value
 * Useful for queries that should return fallback values on error
 *
 * @param message - Log message
 * @param err - Error to log
 * @param defaultValue - Value to return
 * @returns The default value
 */
export function logAndReturn<T>(message: string, err: unknown, defaultValue: T): T {
  const error = toError(err);
  logger.error(message, error);
  return defaultValue;
}

/**
 * Format subscription status for display
 *
 * @param status - Subscription status
 * @returns Human-readable status string
 */
export function formatSubscriptionStatus(status: string): string {
  const statusMap: Record<string, string> = {
    TRIAL: 'Trial',
    ACTIVE: 'Active',
    PAST_DUE: 'Past Due',
    CANCELED: 'Canceled',
    EXPIRED: 'Expired',
    SUSPENDED: 'Suspended',
  };
  return statusMap[status] || status;
}

/**
 * Format billing cycle for display
 *
 * @param cycle - Billing cycle
 * @returns Human-readable cycle string
 */
export function formatBillingCycle(cycle: string): string {
  const cycleMap: Record<string, string> = {
    MONTHLY: 'Monthly',
    ANNUAL: 'Annual',
  };
  return cycleMap[cycle] || cycle;
}

/**
 * Calculate annual savings percentage
 *
 * @param monthlyPrice - Monthly price
 * @param annualPrice - Annual price
 * @returns Savings percentage (0-100)
 */
export function calculateAnnualSavings(monthlyPrice: number, annualPrice: number): number {
  const monthlyTotal = monthlyPrice * 12;
  if (monthlyTotal === 0) return 0;
  return Math.round(((monthlyTotal - annualPrice) / monthlyTotal) * 100);
}

/**
 * Format price for display
 *
 * @param price - Price in cents or dollars
 * @param currency - Currency code
 * @param inCents - Whether price is in cents
 * @returns Formatted price string
 */
export function formatPrice(
  price: number,
  currency = 'USD',
  inCents = false
): string {
  const actualPrice = inCents ? price / 100 : price;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(actualPrice);
}

/**
 * Check if subscription is in trial
 *
 * @param subscription - Tenant subscription
 * @returns True if in trial period
 */
export function isInTrial(subscription: any): boolean {
  if (subscription.status === 'TRIAL') return true;
  if (!subscription.trial_end) return false;
  return new Date(subscription.trial_end) > new Date();
}

/**
 * Get days remaining in trial
 *
 * @param trialEnd - Trial end date
 * @returns Days remaining, or 0 if expired
 */
export function getTrialDaysRemaining(trialEnd: string): number {
  const now = new Date();
  const end = new Date(trialEnd);
  const diffTime = end.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
}

/**
 * Calculate quota utilization percentage
 *
 * @param used - Current usage
 * @param allocated - Allocated quantity
 * @returns Utilization percentage (0-100+)
 */
export function calculateQuotaUtilization(used: number, allocated: number): number {
  if (allocated === 0) return 0;
  return Math.round((used / allocated) * 100);
}

/**
 * Check if quota is near limit
 *
 * @param used - Current usage
 * @param allocated - Allocated quantity
 * @param threshold - Warning threshold (0-1)
 * @returns True if usage is above threshold
 */
export function isQuotaNearLimit(
  used: number,
  allocated: number,
  threshold = 0.8
): boolean {
  if (allocated === 0) return false;
  return used / allocated >= threshold;
}
