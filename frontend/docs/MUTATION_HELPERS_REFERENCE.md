# Mutation Helpers Reference

Complete reference for GraphQL mutation helpers that provide consistent patterns for forms, updates, and deletes.

## Overview

The mutation helpers wrap TanStack Query mutations with:
- ✅ Automatic toast notifications (success/error)
- ✅ Consistent error handling via `handleGraphQLError`
- ✅ Loading state management
- ✅ Optimistic updates
- ✅ Form integration (react-hook-form)
- ✅ Query invalidation helpers

---

## Core Helper: `useMutationWithToast`

Wraps a TanStack Query mutation with automatic toast notifications.

### Basic Usage

```tsx
import { useMutationWithToast } from '@dotmac/graphql';
import { useToast } from '@dotmac/ui/use-toast';
import { logger } from '@/lib/logger';

function CustomerForm({ customerId, onSuccess }) {
  const { toast } = useToast();

  const updateCustomer = useMutationWithToast(
    {
      mutationFn: async (data) => {
        const result = await graphqlClient.request(UpdateCustomerDocument, {
          id: customerId,
          input: data,
        });
        return result.updateCustomer;
      },
    },
    {
      toast,
      logger,
      successMessage: (data) => `Customer ${data.displayName} updated!`,
      errorMessage: "Failed to update customer",
      operationName: "UpdateCustomer",
      onSuccess: () => {
        onSuccess();
      },
    }
  );

  return (
    <Button
      onClick={() => updateCustomer.mutate(formData)}
      disabled={updateCustomer.isPending}
    >
      {updateCustomer.isPending ? "Saving..." : "Save"}
    </Button>
  );
}
```

### API Reference

```typescript
useMutationWithToast<TData, TError, TVariables, TContext>(
  mutationOptions: UseMutationOptions<TData, TError, TVariables, TContext>,
  toastOptions: MutationWithToastOptions<TData, TError, TVariables, TContext>
): UseMutationResult<TData, TError, TVariables, TContext>
```

**Toast Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `toast` | `GraphQLToastFn` | *required* | Toast function from `useToast()` |
| `successMessage` | `string \| ((data, variables) => string)` | `undefined` | Success toast message |
| `errorMessage` | `string \| ((error, variables) => string)` | `undefined` | Custom error message |
| `showSuccessToast` | `boolean` | `true` | Show success toast |
| `showErrorToast` | `boolean` | `true` | Show error toast |
| `onSuccess` | `(data, variables, context) => void` | `undefined` | Success callback |
| `onError` | `(error, variables, context) => void` | `undefined` | Error callback |
| `onSettled` | `(data, error, variables, context) => void` | `undefined` | Settled callback |
| `logger` | `Logger` | `undefined` | Logger instance |
| `operationName` | `string` | `'Mutation'` | Operation name for logging |

---

## Form Integration: `useFormMutation`

Helper specifically designed for form submissions with react-hook-form.

### Usage with react-hook-form

```tsx
import { useForm } from 'react-hook-form';
import { useFormMutation } from '@dotmac/graphql';
import { useToast } from '@dotmac/ui/use-toast';
import { logger } from '@/lib/logger';

interface CustomerFormData {
  firstName: string;
  lastName: string;
  email: string;
}

function CustomerEditForm({ customerId, onClose }) {
  const { toast } = useToast();
  const form = useForm<CustomerFormData>();

  const updateMutation = useFormMutation(
    form,
    {
      mutationFn: async (data: CustomerFormData) => {
        const result = await graphqlClient.request(UpdateCustomerDocument, {
          id: customerId,
          input: data,
        });
        return result.updateCustomer;
      },
    },
    {
      toast,
      logger,
      successMessage: "Customer updated successfully!",
      errorMessage: "Failed to update customer",
      operationName: "UpdateCustomer",
      resetOnSuccess: true, // Reset form after successful submission
      onSuccess: () => {
        onClose();
      },
    }
  );

  return (
    <form onSubmit={form.handleSubmit((data) => updateMutation.mutate(data))}>
      <Input {...form.register('firstName', { required: true })} />
      <Input {...form.register('lastName', { required: true })} />
      <Input {...form.register('email', { required: true })} />

      {form.formState.errors.firstName && (
        <span className="text-red-500">First name is required</span>
      )}

      <Button type="submit" disabled={updateMutation.isPending}>
        {updateMutation.isPending ? "Saving..." : "Save"}
      </Button>
    </form>
  );
}
```

### Features

- ✅ Automatically resets form on success (if `resetOnSuccess: true`)
- ✅ Extracts field-level validation errors from GraphQL errors
- ✅ Sets form errors using `form.setError()`
- ✅ Shows toast notifications
- ✅ Handles loading states

---

## Optimistic Updates: `createOptimisticUpdate`

For immediate UI updates (like toggles, favorites, likes) with automatic rollback on error.

### Usage

```tsx
import { useMutationWithToast, createOptimisticUpdate } from '@dotmac/graphql';
import { useToast } from '@dotmac/ui/use-toast';
import { useQueryClient } from '@tanstack/react-query';

function FavoriteButton({ customerId, isFavorite }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const toggleFavorite = useMutationWithToast(
    {
      mutationFn: async (newValue: boolean) => {
        const result = await graphqlClient.request(ToggleFavoriteDocument, {
          customerId,
          isFavorite: newValue,
        });
        return result.toggleFavorite;
      },
      // Apply optimistic update
      ...createOptimisticUpdate(
        queryClient,
        ['customer', customerId], // Query key to update
        (oldData: Customer, newValue: boolean) => ({
          ...oldData,
          isFavorite: newValue,
        })
      ),
    },
    {
      toast,
      successMessage: (data) => data.isFavorite ? "Added to favorites" : "Removed from favorites",
      showSuccessToast: false, // Don't show toast for quick actions
    }
  );

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => toggleFavorite.mutate(!isFavorite)}
      disabled={toggleFavorite.isPending}
    >
      {isFavorite ? <HeartFilled /> : <Heart />}
    </Button>
  );
}
```

### How It Works

1. **onMutate**: Cancels in-flight queries, snapshots current data, applies optimistic update
2. **onError**: Rolls back to snapshot if mutation fails
3. **onSettled**: Refetches to ensure data is in sync

---

## Query Invalidation: `invalidateQueries`

Helper to invalidate multiple query keys after a successful mutation.

### Usage

```tsx
import { useMutationWithToast, invalidateQueries } from '@dotmac/graphql';
import { useQueryClient } from '@tanstack/react-query';

function CreateCustomerForm({ onClose }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const createCustomer = useMutationWithToast(
    {
      mutationFn: async (data) => {
        const result = await graphqlClient.request(CreateCustomerDocument, {
          input: data,
        });
        return result.createCustomer;
      },
      // Invalidate multiple queries after creation
      ...invalidateQueries(queryClient, [
        ['customers'],           // Customer list
        ['customer-metrics'],    // Dashboard metrics
        ['recent-customers'],    // Recent customers widget
      ]),
    },
    {
      toast,
      successMessage: (data) => `Customer ${data.displayName} created!`,
      onSuccess: () => {
        onClose();
      },
    }
  );

  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      createCustomer.mutate(formData);
    }}>
      {/* Form fields */}
      <Button type="submit" disabled={createCustomer.isPending}>
        {createCustomer.isPending ? "Creating..." : "Create Customer"}
      </Button>
    </form>
  );
}
```

---

## Common Patterns

### Pattern 1: Simple Update with Toast

```tsx
const updateStatus = useMutationWithToast(
  {
    mutationFn: async (status: string) => {
      return await apiClient.patch(`/customers/${id}`, { status });
    },
  },
  {
    toast,
    successMessage: `Status updated to ${status}`,
    errorMessage: "Failed to update status",
  }
);

// Usage
<Button onClick={() => updateStatus.mutate('active')}>
  Activate
</Button>
```

### Pattern 2: Delete with Confirmation

```tsx
function DeleteCustomerButton({ customerId }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const deleteCustomer = useMutationWithToast(
    {
      mutationFn: async () => {
        return await graphqlClient.request(DeleteCustomerDocument, { id: customerId });
      },
      ...invalidateQueries(queryClient, [['customers']]),
    },
    {
      toast,
      successMessage: "Customer deleted successfully",
      errorMessage: "Failed to delete customer",
      onSuccess: () => {
        router.push('/customers');
      },
    }
  );

  const handleDelete = () => {
    if (confirm('Are you sure you want to delete this customer?')) {
      deleteCustomer.mutate();
    }
  };

  return (
    <Button
      variant="destructive"
      onClick={handleDelete}
      disabled={deleteCustomer.isPending}
    >
      {deleteCustomer.isPending ? "Deleting..." : "Delete"}
    </Button>
  );
}
```

### Pattern 3: Bulk Operations

```tsx
function BulkActivateCustomers({ customerIds, onSuccess }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const bulkActivate = useMutationWithToast(
    {
      mutationFn: async (ids: string[]) => {
        return await graphqlClient.request(BulkActivateCustomersDocument, { ids });
      },
      ...invalidateQueries(queryClient, [['customers'], ['customer-metrics']]),
    },
    {
      toast,
      successMessage: (data) => `Activated ${data.count} customers`,
      errorMessage: "Failed to activate customers",
      onSuccess,
    }
  );

  return (
    <Button
      onClick={() => bulkActivate.mutate(customerIds)}
      disabled={bulkActivate.isPending || customerIds.length === 0}
    >
      {bulkActivate.isPending ? "Activating..." : `Activate ${customerIds.length} Selected`}
    </Button>
  );
}
```

### Pattern 4: Multi-Step Mutation

```tsx
function ProvisionSubscriber({ subscriberId }) {
  const { toast } = useToast();
  const [step, setStep] = useState(1);

  const provision = useMutationWithToast(
    {
      mutationFn: async () => {
        // Step 1: Validate
        setStep(1);
        await graphqlClient.request(ValidateSubscriberDocument, { id: subscriberId });

        // Step 2: Provision
        setStep(2);
        const result = await graphqlClient.request(ProvisionSubscriberDocument, { id: subscriberId });

        // Step 3: Activate
        setStep(3);
        await graphqlClient.request(ActivateSubscriberDocument, { id: subscriberId });

        return result;
      },
    },
    {
      toast,
      successMessage: "Subscriber provisioned successfully!",
      errorMessage: (error) => `Failed at step ${step}: ${error.message}`,
      onSuccess: () => {
        setStep(1);
      },
    }
  );

  return (
    <div>
      {provision.isPending && (
        <div className="text-sm text-gray-600">
          Step {step}/3: {['Validating', 'Provisioning', 'Activating'][step - 1]}...
        </div>
      )}

      <Button
        onClick={() => provision.mutate()}
        disabled={provision.isPending}
      >
        {provision.isPending ? "Processing..." : "Provision"}
      </Button>
    </div>
  );
}
```

---

## Migration Example: Before/After

### Before (Manual Pattern)

```tsx
function CustomerForm({ customer, onClose }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (data) => {
    setIsSubmitting(true);
    setError(null);

    try {
      const result = await apiClient.patch(`/customers/${customer.id}`, data);
      toast({
        title: "Success",
        description: "Customer updated successfully!",
      });
      onClose();
    } catch (err) {
      const message = err.response?.data?.message || "Failed to update customer";
      setError(message);
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
      logger.error("Failed to update customer", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); handleSubmit(formData); }}>
      {error && <div className="text-red-500">{error}</div>}

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Saving..." : "Save"}
      </Button>
    </form>
  );
}
```

### After (With useMutationWithToast)

```tsx
function CustomerForm({ customer, onClose }) {
  const { toast } = useToast();
  const form = useForm();

  const updateCustomer = useFormMutation(
    form,
    {
      mutationFn: async (data) => {
        return await graphqlClient.request(UpdateCustomerDocument, {
          id: customer.id,
          input: data,
        });
      },
    },
    {
      toast,
      logger,
      successMessage: "Customer updated successfully!",
      resetOnSuccess: false,
      onSuccess: () => onClose(),
    }
  );

  return (
    <form onSubmit={form.handleSubmit((data) => updateCustomer.mutate(data))}>
      <Button type="submit" disabled={updateCustomer.isPending}>
        {updateCustomer.isPending ? "Saving..." : "Save"}
      </Button>
    </form>
  );
}
```

**Benefits:**
- ✅ 50% less code
- ✅ No manual state management
- ✅ Automatic error handling
- ✅ Consistent toast notifications
- ✅ Proper logging
- ✅ Form integration

---

## Type Safety

All helpers maintain full TypeScript type inference:

```typescript
// Mutation function with typed input/output
const updateCustomer = useMutationWithToast<
  UpdateCustomerMutation,        // TData (return type)
  Error,                          // TError
  UpdateCustomerInput             // TVariables (input type)
>(
  {
    mutationFn: async (input: UpdateCustomerInput) => {
      // TypeScript knows input shape
      const result = await graphqlClient.request(UpdateCustomerDocument, { input });
      return result.updateCustomer; // TypeScript knows return shape
    },
  },
  {
    toast,
    // TypeScript knows data type in success message
    successMessage: (data) => `Customer ${data.displayName} updated!`,
    // TypeScript knows error type
    errorMessage: (error) => error.message,
  }
);

// TypeScript knows mutation result types
updateCustomer.mutate(customerInput); // TypeScript validates input shape
updateCustomer.data?.displayName; // TypeScript knows data shape
```

---

## Error Handling

Errors are automatically handled via `handleGraphQLError`:

```tsx
const mutation = useMutationWithToast(
  { mutationFn },
  {
    toast,
    errorMessage: "Custom error message", // Optional custom message
    // Error details are automatically extracted and shown in toast:
    // - GraphQL errors
    // - Network errors
    // - Validation errors
  }
);
```

**Field-Level Validation Errors:**

If your GraphQL errors include field extensions, `useFormMutation` automatically sets them:

```typescript
// Backend returns:
{
  "errors": [{
    "message": "Email is already taken",
    "extensions": { "field": "email" }
  }]
}

// Frontend automatically shows error on email field
// No manual error handling needed!
```

---

## Best Practices

1. **Always provide toast and logger:**
   ```tsx
   const mutation = useMutationWithToast(options, {
     toast,
     logger,
     // ... other options
   });
   ```

2. **Use descriptive operation names:**
   ```tsx
   operationName: "UpdateCustomerProfile" // Shows in logs and error messages
   ```

3. **Invalidate relevant queries:**
   ```tsx
   const queryClient = useQueryClient();

   ...invalidateQueries(queryClient, [
     ['customers'],
     ['customer-metrics'],
   ])
   ```

4. **Use optimistic updates for quick actions:**
   ```tsx
   const queryClient = useQueryClient();

   // For toggles, likes, favorites
   ...createOptimisticUpdate(queryClient, queryKey, updater)
   ```

5. **Hide success toasts for quick actions:**
   ```tsx
   showSuccessToast: false // For toggles that feel instant
   ```

6. **Provide context in error messages:**
   ```tsx
   errorMessage: (error, variables) =>
     `Failed to update customer ${variables.id}: ${error.message}`
   ```

---

## Related Documentation

- [GRAPHQL_MIGRATION_HELPERS.md](./GRAPHQL_MIGRATION_HELPERS.md) - Query helpers reference
- [NORMALIZATION_HELPERS_REFERENCE.md](./NORMALIZATION_HELPERS_REFERENCE.md) - Normalization helpers
- [MIGRATION_EXAMPLE_CUSTOMERS.md](./MIGRATION_EXAMPLE_CUSTOMERS.md) - Complete migration example
