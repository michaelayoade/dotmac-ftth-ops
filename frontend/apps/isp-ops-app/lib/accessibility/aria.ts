/**
 * ARIA Utilities
 *
 * Helpers for creating accessible ARIA labels and descriptions
 * Integrated with i18n for multi-language support
 */

import type { JobStatus, TicketStatus, CustomerStatus } from "@dotmac/types";

/**
 * ARIA label generators for common patterns
 */

/**
 * Get ARIA label for status badge
 *
 * @example
 * ```tsx
 * const t = useTranslations();
 * <Badge aria-label={getStatusAriaLabel(t, job.status, 'jobs')}>
 *   {getStatusLabel(t, job.status, 'jobs')}
 * </Badge>
 * ```
 */
export function getStatusAriaLabel(
  t: (key: string, values?: Record<string, unknown>) => string,
  status: JobStatus | TicketStatus | CustomerStatus,
  namespace: "jobs" | "tickets" | "customers",
): string {
  const statusLabel = t(`${namespace}.status.${status}`);
  return t("accessibility.statusLabel", { status: statusLabel });
}

/**
 * Get ARIA label for action buttons
 *
 * @example
 * ```tsx
 * <button aria-label={getActionAriaLabel(t, 'delete', customer.name)}>
 *   <TrashIcon />
 * </button>
 * ```
 */
export function getActionAriaLabel(
  t: (key: string, values?: Record<string, unknown>) => string,
  action: "edit" | "delete" | "view" | "cancel" | "retry",
  itemName: string,
): string {
  return t(`accessibility.${action}Item`, { item: itemName });
}

/**
 * Get ARIA label for pagination
 *
 * @example
 * ```tsx
 * <button aria-label={getPaginationAriaLabel(t, 'next', 2)}>
 *   Next
 * </button>
 * ```
 */
export function getPaginationAriaLabel(
  t: (key: string, values?: Record<string, unknown>) => string,
  type: "first" | "previous" | "next" | "last" | "page",
  page?: number,
): string {
  if (type === "page" && page !== undefined) {
    return t("accessibility.goToPage", { page });
  }
  return t(`accessibility.${type}Page`);
}

/**
 * Get ARIA label for sortable table headers
 *
 * @example
 * ```tsx
 * <th
 *   aria-label={getSortAriaLabel(t, 'Name', sortOrder)}
 *   onClick={() => handleSort('name')}
 * >
 *   Name
 * </th>
 * ```
 */
export function getSortAriaLabel(
  t: (key: string, values?: Record<string, unknown>) => string,
  columnName: string,
  sortOrder: "asc" | "desc" | null,
): string {
  if (sortOrder === null) {
    return t("accessibility.sortBy", { column: columnName });
  }
  const direction =
    sortOrder === "asc" ? t("accessibility.ascending") : t("accessibility.descending");
  return t("accessibility.sortedBy", { column: columnName, direction });
}

/**
 * Get ARIA label for search inputs
 *
 * @example
 * ```tsx
 * <input
 *   type="search"
 *   aria-label={getSearchAriaLabel(t, 'customers')}
 *   placeholder={t('customers.searchCustomers')}
 * />
 * ```
 */
export function getSearchAriaLabel(
  t: (key: string, values?: Record<string, unknown>) => string,
  entity: string,
): string {
  return t("accessibility.searchEntity", { entity });
}

/**
 * Get ARIA label for filter controls
 *
 * @example
 * ```tsx
 * <select aria-label={getFilterAriaLabel(t, 'status', 3)}>
 *   <option>All</option>
 * </select>
 * ```
 */
export function getFilterAriaLabel(
  t: (key: string, values?: Record<string, unknown>) => string,
  filterName: string,
  activeCount?: number,
): string {
  if (activeCount !== undefined && activeCount > 0) {
    return t("accessibility.filterByWithCount", {
      filter: filterName,
      count: activeCount,
    });
  }
  return t("accessibility.filterBy", { filter: filterName });
}

/**
 * Get ARIA description for form fields
 *
 * @example
 * ```tsx
 * <input
 *   aria-describedby="email-description"
 * />
 * <span id="email-description">
 *   {getFieldDescription(t, 'email', { required: true, format: 'email' })}
 * </span>
 * ```
 */
export function getFieldDescription(
  t: (key: string, values?: Record<string, unknown>) => string,
  fieldName: string,
  constraints?: {
    required?: boolean;
    minLength?: number;
    maxLength?: number;
    format?: string;
  },
): string {
  const parts: string[] = [];

  if (constraints?.required) {
    parts.push(t("accessibility.requiredField"));
  }

  if (constraints?.minLength) {
    parts.push(t("accessibility.minLength", { min: constraints.minLength }));
  }

  if (constraints?.maxLength) {
    parts.push(t("accessibility.maxLength", { max: constraints.maxLength }));
  }

  if (constraints?.format) {
    parts.push(t(`accessibility.format.${constraints.format}`));
  }

  return parts.join(". ");
}

/**
 * Get ARIA label for progress indicators
 *
 * @example
 * ```tsx
 * <div
 *   role="progressbar"
 *   aria-valuenow={progress}
 *   aria-valuemin={0}
 *   aria-valuemax={100}
 *   aria-label={getProgressAriaLabel(t, 'upload', progress)}
 * />
 * ```
 */
export function getProgressAriaLabel(
  t: (key: string, values?: Record<string, unknown>) => string,
  action: string,
  progress: number,
): string {
  return t("accessibility.progressLabel", { action, progress });
}

/**
 * Get ARIA label for loading states
 *
 * @example
 * ```tsx
 * {isLoading && (
 *   <div role="status" aria-label={getLoadingAriaLabel(t, 'customers')}>
 *     <Spinner />
 *   </div>
 * )}
 * ```
 */
export function getLoadingAriaLabel(
  t: (key: string, values?: Record<string, unknown>) => string,
  entity?: string,
): string {
  if (entity) {
    return t("accessibility.loadingEntity", { entity });
  }
  return t("common.loading");
}

/**
 * Get ARIA label for modal/dialog close buttons
 *
 * @example
 * ```tsx
 * <button
 *   onClick={closeModal}
 *   aria-label={getCloseAriaLabel(t, 'Edit Customer')}
 * >
 *   <XIcon />
 * </button>
 * ```
 */
export function getCloseAriaLabel(
  t: (key: string, values?: Record<string, unknown>) => string,
  dialogTitle?: string,
): string {
  if (dialogTitle) {
    return t("accessibility.closeDialog", { title: dialogTitle });
  }
  return t("accessibility.close");
}

/**
 * Get ARIA label for expand/collapse buttons
 *
 * @example
 * ```tsx
 * <button
 *   aria-expanded={isExpanded}
 *   aria-label={getExpandAriaLabel(t, isExpanded, 'Details')}
 * >
 *   {isExpanded ? <ChevronUp /> : <ChevronDown />}
 * </button>
 * ```
 */
export function getExpandAriaLabel(
  t: (key: string, values?: Record<string, unknown>) => string,
  isExpanded: boolean,
  section?: string,
): string {
  const action = isExpanded ? t("accessibility.collapse") : t("accessibility.expand");

  if (section) {
    return `${action} ${section}`;
  }

  return action;
}
