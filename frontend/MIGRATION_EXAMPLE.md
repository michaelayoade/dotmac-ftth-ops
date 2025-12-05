# Migration Example: Applying New Standards

This document shows a real-world example of migrating an existing component to use the new shared constants and error handling utilities.

## Before: Component with Magic Strings & Inconsistent Error Handling

```typescript
// ❌ OLD: jobs/JobsList.tsx (BEFORE)
import { useState, useEffect } from 'react';
import { Badge } from '@dotmac/ui';
import { useToast } from '@dotmac/hooks';

interface Job {
  id: string;
  name: string;
  status: string;
  type: string;
}

export function JobsList() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchJobs();
  }, []);

  async function fetchJobs() {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/isp/v1/jobs');

      if (!response.ok) {
        throw new Error('Failed to fetch jobs');
      }

      const data = await response.json();
      setJobs(data.jobs);
    } catch (err) {
      // Inconsistent error handling
      console.error('Error fetching jobs:', err);
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  function getStatusBadgeColor(status: string) {
    // Magic strings
    switch (status) {
      case 'running':
        return 'default';
      case 'completed':
        return 'success';
      case 'failed':
        return 'destructive';
      case 'pending':
        return 'secondary';
      default:
        return 'default';
    }
  }

  function getStatusLabel(status: string) {
    // More magic strings
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
    return <div>Loading...</div>;
  }

  if (error) {
    return (
      <div className="border border-red-500 p-4 rounded">
        <p className="text-red-500">{error}</p>
        <button onClick={fetchJobs}>Try Again</button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {jobs.map((job) => (
        <div key={job.id} className="border p-4 rounded">
          <div className="flex items-center justify-between">
            <h3>{job.name}</h3>
            <Badge variant={getStatusBadgeColor(job.status)}>
              {getStatusLabel(job.status)}
            </Badge>
          </div>
          <p className="text-sm text-gray-600">
            Type: {job.type}
          </p>
        </div>
      ))}
    </div>
  );
}
```

## After: Component with Shared Constants & Standardized Error Handling

```typescript
// ✅ NEW: jobs/JobsList.tsx (AFTER)
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@dotmac/ui';
import { ErrorAlert } from '@dotmac/ui';
import { useErrorHandler } from '@dotmac/hooks';
import {
  JobStatus,
  JobStatusLabels,
  JobStatusVariants,
  JobType,
  JobTypeLabels,
} from '@dotmac/types';

interface Job {
  id: string;
  name: string;
  status: JobStatus;  // ✅ Typed enum instead of string
  type: JobType;      // ✅ Typed enum instead of string
}

interface JobsResponse {
  jobs: Job[];
}

async function fetchJobs(): Promise<JobsResponse> {
  const response = await fetch('/api/isp/v1/jobs');

  if (!response.ok) {
    throw new Error('Failed to fetch jobs');
  }

  return response.json();
}

export function JobsList() {
  // ✅ Standardized error handling with retry support
  const { error, handleError, clearError, setRetry } = useErrorHandler({
    showToast: true,
  });

  // ✅ Using React Query for better data fetching
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['jobs'],
    queryFn: fetchJobs,
    onError: (err) => {
      handleError(err, { component: 'JobsList', action: 'fetchJobs' });
      setRetry(() => refetch);  // ✅ Enable retry on error
    },
  });

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-4">
      {/* ✅ Standardized error display with retry */}
      {error && (
        <ErrorAlert
          error={error}
          onClose={clearError}
          onRetry={() => refetch()}
          showRetry
        />
      )}

      {data?.jobs.map((job) => (
        <div key={job.id} className="border p-4 rounded">
          <div className="flex items-center justify-between">
            <h3>{job.name}</h3>

            {/* ✅ Type-safe status check */}
            {job.status === JobStatus.RUNNING && (
              <Badge variant={JobStatusVariants[job.status]}>
                {JobStatusLabels[job.status]}
              </Badge>
            )}

            {/* ✅ Using shared constants for labels and variants */}
            {job.status !== JobStatus.RUNNING && (
              <Badge variant={JobStatusVariants[job.status]}>
                {JobStatusLabels[job.status]}
              </Badge>
            )}
          </div>

          {/* ✅ Using JobTypeLabels */}
          <p className="text-sm text-gray-600">
            Type: {JobTypeLabels?.[job.type] || job.type}
          </p>
        </div>
      ))}
    </div>
  );
}
```

## Form Example: Before & After

### Before: Form with Inconsistent Validation Error Display

```typescript
// ❌ OLD: forms/CreateCustomerForm.tsx (BEFORE)
import { useState } from 'react';
import { Button, Input } from '@dotmac/ui';

export function CreateCustomerForm() {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    setSubmitError(null);

    try {
      const response = await fetch('/api/isp/v1/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name }),
      });

      if (!response.ok) {
        const data = await response.json();

        // Inconsistent error parsing
        if (data.errors) {
          const fieldErrors: Record<string, string> = {};
          data.errors.forEach((err: any) => {
            if (err.field) {
              fieldErrors[err.field] = err.message;
            }
          });
          setErrors(fieldErrors);
        } else {
          setSubmitError(data.detail || 'Failed to create customer');
        }
        return;
      }

      // Success
      alert('Customer created!');
    } catch (err) {
      setSubmitError('Network error occurred');
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {submitError && (
        <div className="bg-red-100 p-2 rounded text-red-800">
          {submitError}
        </div>
      )}

      <div>
        <label>Name</label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        {errors.name && (
          <p className="text-red-500 text-sm">{errors.name}</p>
        )}
      </div>

      <div>
        <label>Email</label>
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        {errors.email && (
          <p className="text-red-500 text-sm">{errors.email}</p>
        )}
      </div>

      <Button type="submit">Create Customer</Button>
    </form>
  );
}
```

### After: Form with Standardized Error Handling

```typescript
// ✅ NEW: forms/CreateCustomerForm.tsx (AFTER)
import { useForm } from 'react-hook-form';
import { Button, Input, Label } from '@dotmac/ui';
import { ErrorAlert, FieldError } from '@dotmac/ui';
import { useErrorHandler } from '@dotmac/hooks';
import { extractFieldErrors } from '@dotmac/types';
import { CustomerType } from '@dotmac/types';

interface CreateCustomerFormData {
  email: string;
  name: string;
  type: CustomerType;
}

export function CreateCustomerForm() {
  const {
    register,
    handleSubmit,
    formState: { errors: formErrors },
    setError,
  } = useForm<CreateCustomerFormData>();

  // ✅ Standardized error handling
  const { error, handleError, clearError } = useErrorHandler({
    showToast: false, // We'll show errors in the form
  });

  async function onSubmit(data: CreateCustomerFormData) {
    try {
      clearError();

      const response = await fetch('/api/isp/v1/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw errorData;
      }

      // Success
      toast({ title: 'Customer created successfully' });
    } catch (err) {
      handleError(err, { component: 'CreateCustomerForm', action: 'submit' });

      // ✅ Automatically extract and set field errors
      const fieldErrors = extractFieldErrors(err);
      if (fieldErrors) {
        Object.entries(fieldErrors).forEach(([field, messages]) => {
          setError(field as keyof CreateCustomerFormData, {
            message: messages[0],
          });
        });
      }
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* ✅ Standardized error display */}
      {error && !extractFieldErrors(error) && (
        <ErrorAlert error={error} onClose={clearError} />
      )}

      <div>
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          {...register('name', { required: 'Name is required' })}
        />
        {/* ✅ Standardized field error */}
        <FieldError error={formErrors.name?.message} />
      </div>

      <div>
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          {...register('email', {
            required: 'Email is required',
            pattern: {
              value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
              message: 'Invalid email address',
            },
          })}
        />
        {/* ✅ Standardized field error */}
        <FieldError error={formErrors.email?.message} />
      </div>

      <Button type="submit">Create Customer</Button>
    </form>
  );
}
```

## Key Improvements

### 1. **Type Safety**

- ✅ `JobStatus` enum instead of `string`
- ✅ Autocomplete and compile-time checking
- ✅ Prevents typos like `'runing'` vs `'running'`

### 2. **Standardized Error Handling**

- ✅ Consistent error display across components
- ✅ Automatic retry functionality
- ✅ Field-level error extraction
- ✅ Proper error categorization and logging

### 3. **DRY Principle**

- ✅ No duplicate status label logic
- ✅ No duplicate badge variant logic
- ✅ Reusable error components

### 4. **Better UX**

- ✅ Consistent error messages
- ✅ Retry button on appropriate errors
- ✅ Field-specific validation errors
- ✅ Proper error context for debugging

### 5. **Maintainability**

- ✅ Single source of truth for constants
- ✅ Easy to update labels/variants globally
- ✅ Standardized patterns across codebase

## Migration Checklist

- [ ] Replace magic strings with enums from `@dotmac/types`
- [ ] Replace ad-hoc error handling with `useErrorHandler`
- [ ] Replace custom error displays with `ErrorAlert`
- [ ] Replace field error displays with `FieldError`
- [ ] Use `extractFieldErrors` for validation errors
- [ ] Add error context for better debugging
- [ ] Test retry functionality
- [ ] Ensure accessibility (labels, ARIA)
- [ ] Update tests to use shared constants
- [ ] Document any component-specific error handling

## Next Steps

1. **Identify high-traffic components** for migration first
2. **Update shared components** in `@dotmac/ui` package
3. **Create migration guide** for team
4. **Add linting rules** to enforce standards
5. **Set up error reporting** (Sentry integration)
