# Subscriber Management Components

This directory contains all React components for the Subscriber Management system.

## Components

### SubscriberList.tsx

Data table component for displaying subscribers with filtering, sorting, and actions.

**Usage:**

```typescript
import { SubscriberList } from '@/components/subscribers/SubscriberList';

<SubscriberList
  subscribers={subscribers}
  isLoading={isLoading}
  onView={handleView}
  onSuspend={handleSuspend}
  onActivate={handleActivate}
  onRowClick={handleRowClick}
/>
```

**Features:**

- EnhancedDataTable integration
- Status badges
- Connection type icons
- Actions dropdown
- Row selection
- Sorting and filtering

### SubscriberDetailModal.tsx

Modal dialog for viewing and managing subscriber details with tabbed interface.

**Usage:**

```typescript
import { SubscriberDetailModal } from '@/components/subscribers/SubscriberDetailModal';

<SubscriberDetailModal
  subscriber={selectedSubscriber}
  open={isModalOpen}
  onClose={() => setIsModalOpen(false)}
  onUpdate={refetchSubscribers}
  onSuspend={handleSuspend}
  onActivate={handleActivate}
/>
```

**Tabs:**

- Details - Contact, address, installation
- Services - Active services
- Network - ONT, IP, signal quality
- Billing - Subscription, payment

### AddSubscriberModal.tsx

Form modal for creating new subscriber accounts with validation.

**Usage:**

```typescript
import { AddSubscriberModal } from '@/components/subscribers/AddSubscriberModal';

<AddSubscriberModal
  open={isAddModalOpen}
  onClose={() => setIsAddModalOpen(false)}
  onSuccess={(id) => {
    console.log('Created:', id);
    refetchSubscribers();
  }}
/>
```

**Sections:**

- Personal Information
- Service Address
- Service Configuration
- Installation Details
- Additional Notes

## Dependencies

- `@/hooks/useSubscribers` - Data fetching hooks
- `@dotmac/ui/*` - shadcn/ui components
- `lucide-react` - Icons
- `date-fns` - Date formatting
- `@tanstack/react-table` - Data table

## Related Files

- `hooks/useSubscribers.ts` - Subscriber data hooks
- `app/dashboard/subscribers/page.tsx` - Main page
- `frontend/PRODUCTION_GUIDE.md` - Production-ready subscriber workflow notes

## Type Safety

All components are fully typed with TypeScript. Import types from:

```typescript
import type {
  Subscriber,
  SubscriberStatus,
  ConnectionType,
  CreateSubscriberRequest,
  UpdateSubscriberRequest,
} from "@/hooks/useSubscribers";
```

## Styling

Components use:

- Tailwind CSS for styling
- shadcn/ui design system
- Responsive breakpoints
- Dark mode support (future)

## Accessibility

All components include:

- ARIA labels
- Keyboard navigation
- Focus management
- Screen reader support

## Testing

Test files location: `__tests__/subscribers/`

Run tests:

```bash
pnpm test subscribers
```

## Contributing

When adding new components:

1. Follow existing patterns
2. Add TypeScript types
3. Include JSDoc comments
4. Add usage examples
5. Update this README
6. Write tests

---

**Last Updated:** 2025-10-15
**Version:** 1.0.0
