# i18n Migration: Real Component Example

Complete before/after example showing how to migrate an actual component from hardcoded strings to i18n.

## Example: Jobs List Component

### BEFORE: Hardcoded Strings ❌

```typescript
// ❌ BAD: Hardcoded strings throughout
'use client';

import { useState, useEffect } from 'react';
import { Badge } from '@dotmac/ui';

interface Job {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  type: string;
  progress: number;
  startedAt?: string;
}

export function JobsList() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchJobs();
  }, []);

  async function fetchJobs() {
    try {
      setLoading(true);
      const response = await fetch('/api/v1/jobs');
      const data = await response.json();
      setJobs(data.jobs);
    } catch (err) {
      setError('Failed to fetch jobs. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function getStatusBadgeVariant(status: string) {
    switch (status) {
      case 'running':
        return 'default';
      case 'completed':
        return 'success';
      case 'failed':
        return 'destructive';
      default:
        return 'secondary';
    }
  }

  function getStatusLabel(status: string) {
    switch (status) {
      case 'running':
        return 'Running';
      case 'completed':
        return 'Completed';
      case 'failed':
        return 'Failed';
      case 'pending':
        return 'Pending';
      default:
        return status;
    }
  }

  if (loading) {
    return <div className="p-4">Loading...</div>;
  }

  if (error) {
    return (
      <div className="p-4 border border-red-500 rounded">
        <p className="text-red-500">{error}</p>
        <button onClick={fetchJobs} className="mt-2 px-4 py-2 bg-blue-500 text-white rounded">
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Jobs</h1>
        <button className="px-4 py-2 bg-blue-500 text-white rounded">
          Refresh
        </button>
      </div>

      {jobs.length === 0 && (
        <div className="p-8 text-center text-gray-500">
          No jobs found
        </div>
      )}

      {jobs.map((job) => (
        <div key={job.id} className="border p-4 rounded">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold">{job.name}</h3>
              <p className="text-sm text-gray-600">
                Type: {job.type}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Badge variant={getStatusBadgeVariant(job.status)}>
                {getStatusLabel(job.status)}
              </Badge>
            </div>
          </div>

          {job.status === 'running' && (
            <div className="mt-2">
              <div className="flex items-center justify-between text-sm">
                <span>Progress</span>
                <span>{job.progress}%</span>
              </div>
              <div className="mt-1 h-2 bg-gray-200 rounded">
                <div
                  className="h-full bg-blue-500 rounded"
                  style={{ width: `${job.progress}%` }}
                />
              </div>
            </div>
          )}

          <div className="mt-4 flex gap-2">
            <button className="px-3 py-1 text-sm bg-gray-100 rounded">
              View Details
            </button>
            {job.status === 'running' && (
              <button className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded">
                Cancel Job
              </button>
            )}
            {job.status === 'failed' && (
              <button className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded">
                Retry Job
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
```

### AFTER: Fully i18n Compliant ✅

```typescript
// ✅ GOOD: Using i18n with type-safe constants
'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Badge } from '@dotmac/ui';
import { ErrorAlert } from '@dotmac/ui';
import { useErrorHandler } from '@dotmac/hooks';
import { JobStatus, JobStatusVariants } from '@dotmac/types';
import { getStatusLabel } from '@/lib/i18n/utils';

interface Job {
  id: string;
  name: string;
  status: JobStatus;  // ✅ Type-safe enum
  type: string;
  progress: number;
  startedAt?: string;
}

export function JobsList() {
  const t = useTranslations();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  // ✅ Standardized error handling with i18n
  const { error, handleError, clearError, setRetry } = useErrorHandler({
    showToast: true,
  });

  useEffect(() => {
    fetchJobs();
  }, []);

  async function fetchJobs() {
    try {
      setLoading(false);
      clearError();

      const response = await fetch('/api/v1/jobs');
      if (!response.ok) throw new Error('Failed to fetch');

      const data = await response.json();
      setJobs(data.jobs);
    } catch (err) {
      handleError(err, { component: 'JobsList', action: 'fetchJobs' });
      setRetry(() => fetchJobs);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="p-4">
        {/* ✅ Translated loading message */}
        {t('common.loading')}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ✅ Translated error display */}
      {error && (
        <ErrorAlert
          error={error}
          onClose={clearError}
          onRetry={() => fetchJobs()}
        />
      )}

      <div className="flex items-center justify-between">
        {/* ✅ Translated page title */}
        <h1 className="text-2xl font-bold">
          {t('jobs.title')}
        </h1>

        {/* ✅ Translated button */}
        <button
          onClick={fetchJobs}
          className="px-4 py-2 bg-blue-500 text-white rounded"
        >
          {t('common.refresh')}
        </button>
      </div>

      {/* ✅ Translated empty state */}
      {jobs.length === 0 && (
        <div className="p-8 text-center text-gray-500">
          {t('common.noResults')}
        </div>
      )}

      {jobs.map((job) => (
        <div key={job.id} className="border p-4 rounded">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold">{job.name}</h3>
              <p className="text-sm text-gray-600">
                {/* ✅ Translated field label */}
                {t('jobs.fields.jobType')}: {job.type}
              </p>
            </div>

            <div className="flex items-center gap-2">
              {/* ✅ Type-safe status with translated label */}
              <Badge variant={JobStatusVariants[job.status]}>
                {getStatusLabel(t, job.status, 'jobs')}
              </Badge>
            </div>
          </div>

          {/* ✅ Type-safe status check */}
          {job.status === JobStatus.RUNNING && (
            <div className="mt-2">
              <div className="flex items-center justify-between text-sm">
                {/* ✅ Translated progress label */}
                <span>{t('jobs.fields.progress')}</span>
                <span>{job.progress}%</span>
              </div>
              <div className="mt-1 h-2 bg-gray-200 rounded">
                <div
                  className="h-full bg-blue-500 rounded"
                  style={{ width: `${job.progress}%` }}
                />
              </div>
            </div>
          )}

          <div className="mt-4 flex gap-2">
            {/* ✅ Translated action buttons */}
            <button className="px-3 py-1 text-sm bg-gray-100 rounded">
              {t('common.viewDetails')}
            </button>

            {job.status === JobStatus.RUNNING && (
              <button className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded">
                {t('jobs.cancelJob')}
              </button>
            )}

            {job.status === JobStatus.FAILED && (
              <button className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded">
                {t('jobs.retryJob')}
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
```

---

## Key Improvements

### 1. **Type Safety** ✅

- Used `JobStatus` enum instead of string literals
- `JobStatusVariants` for badge colors
- No magic strings anywhere

### 2. **Internationalization** ✅

- All user-facing text comes from translation files
- Supports multiple languages (EN, ES, FR, DE, PT)
- Uses `getStatusLabel()` utility for type-safe status translations

### 3. **Standardized Error Handling** ✅

- Uses `useErrorHandler` hook
- Consistent error display with `ErrorAlert`
- Automatic retry functionality

### 4. **Maintainability** ✅

- Single source of truth for all text content
- Easy to add new languages
- Changes to labels only require updating JSON files

---

## Translation Keys Used

```json
{
  "common": {
    "loading": "Loading...",
    "refresh": "Refresh",
    "noResults": "No results found",
    "viewDetails": "View Details"
  },

  "jobs": {
    "title": "Jobs",
    "cancelJob": "Cancel Job",
    "retryJob": "Retry Job",
    "fields": {
      "jobType": "Job Type",
      "progress": "Progress"
    },
    "status": {
      "pending": "Pending",
      "running": "Running",
      "completed": "Completed",
      "failed": "Failed"
    }
  }
}
```

---

## Language Support

With this implementation, the component automatically supports:

### English (EN)

- Title: "Jobs"
- Button: "Refresh"
- Empty state: "No results found"
- Status: "Running", "Completed", etc.

### Spanish (ES)

- Title: "Trabajos"
- Button: "Actualizar"
- Empty state: "No se encontraron resultados"
- Status: "En Ejecución", "Completado", etc.

### French (FR) - TODO

- Title: "Travaux"
- Button: "Actualiser"
- Empty state: "Aucun résultat trouvé"
- Status: "En cours", "Terminé", etc.

---

## Testing Different Locales

```typescript
// Navigate to different locales
http://localhost:3000/en/jobs  // English
http://localhost:3000/es/jobs  // Spanish
http://localhost:3000/fr/jobs  // French (when available)
```

---

## Benefits Summary

| Aspect              | Before               | After                  |
| ------------------- | -------------------- | ---------------------- |
| **Strings**         | Hardcoded            | From translation files |
| **Type Safety**     | String literals      | Enums                  |
| **Languages**       | English only         | 5+ languages supported |
| **Maintainability** | Change in 50+ places | Change in 1 JSON file  |
| **Error Handling**  | Custom               | Standardized           |
| **Status Labels**   | Custom function      | Type-safe utility      |
| **Badge Variants**  | Custom function      | Shared constants       |

---

## Next Steps

1. Apply this pattern to all components
2. Complete translations for FR, DE, PT locales
3. Add `LanguageSwitcher` component to navigation
4. Set up automated translation validation
5. Create linting rules to prevent hardcoded strings
