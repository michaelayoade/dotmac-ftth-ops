# Subscriber Management System

## Overview

The Subscriber Management system provides comprehensive ISP subscriber lifecycle management, including service provisioning, network configuration, billing integration, and support workflows. Built with React, TypeScript, and the shadcn/ui component library.

## Architecture

### Directory Structure

```
frontend/apps/base-app/
├── hooks/
│   └── useSubscribers.ts              # Subscriber data hooks
├── components/subscribers/
│   ├── SubscriberList.tsx             # Data table component
│   ├── SubscriberDetailModal.tsx      # Detail view modal
│   └── AddSubscriberModal.tsx         # Creation form modal
└── app/dashboard/subscribers/
    └── page.tsx                       # Main subscribers page
```

## Core Features

### 1. Subscriber Lifecycle Management

**Statuses:**
- `active` - Service is active and operational
- `suspended` - Temporarily suspended (non-payment, abuse, etc.)
- `pending` - Awaiting activation/provisioning
- `inactive` - Service not yet activated
- `terminated` - Service permanently terminated

**Operations:**
- Create new subscriber accounts
- Activate/suspend/terminate services
- Update subscriber information
- Delete subscriber records (with confirmation)

### 2. Connection Types

- **FTTH** (Fiber to the Home) - Direct fiber connection
- **FTTB** (Fiber to the Building) - Fiber to building with distribution
- **Wireless** - Wireless broadband connection
- **Hybrid** - Mixed connection types

### 3. Data Management

**Personal Information:**
- Name, email, phone numbers
- Service address (street, city, state, postal code, country)
- Billing address (optional, defaults to service address)

**Service Configuration:**
- Connection type
- Service plan
- Bandwidth allocation (Mbps)
- Installation details and notes

**Network Details:**
- ONT serial number and MAC address
- Router configuration
- VLAN ID assignment
- IPv4/IPv6 addresses
- Signal strength and quality metrics

**Business Information:**
- Subscription dates (start, end)
- Billing cycle
- Payment method
- Service quality metrics (uptime, last online)

## Components

### useSubscribers Hook

Location: `frontend/apps/base-app/hooks/useSubscribers.ts`

**Exports:**

```typescript
// Types
export type SubscriberStatus = 'active' | 'suspended' | 'pending' | 'inactive' | 'terminated';
export type ConnectionType = 'ftth' | 'fttb' | 'wireless' | 'hybrid';
export interface Subscriber { /* ... */ }
export interface SubscriberService { /* ... */ }
export interface SubscriberStatistics { /* ... */ }

// Hooks
useSubscribers(params?: SubscriberQueryParams)
useSubscriber(subscriberId: string | null)
useSubscriberStatistics()
useSubscriberOperations()
useSubscriberServices(subscriberId: string | null)
```

**useSubscribers Example:**

```typescript
const { subscribers, total, isLoading, error, refetch } = useSubscribers({
  status: ['active', 'pending'],
  connection_type: ['ftth'],
  search: 'john',
  limit: 50,
  sort_by: 'created_at',
  sort_order: 'desc',
});
```

**useSubscriberOperations Example:**

```typescript
const {
  createSubscriber,
  updateSubscriber,
  deleteSubscriber,
  suspendSubscriber,
  activateSubscriber,
  terminateSubscriber,
  isLoading,
  error,
} = useSubscriberOperations();

// Create subscriber
const newSubscriber = await createSubscriber({
  first_name: 'John',
  last_name: 'Doe',
  email: 'john.doe@example.com',
  phone: '+1-555-123-4567',
  service_address: '123 Main St',
  service_city: 'New York',
  service_state: 'NY',
  service_postal_code: '10001',
  connection_type: 'ftth',
  bandwidth_mbps: 1000,
});

// Suspend subscriber
await suspendSubscriber(subscriberId, 'Non-payment');
```

### SubscriberList Component

Location: `frontend/apps/base-app/components/subscribers/SubscriberList.tsx`

A data table component for displaying subscribers with sorting, filtering, and actions.

**Props:**

```typescript
interface SubscriberListProps {
  subscribers: Subscriber[];
  isLoading?: boolean;
  onView?: (subscriber: Subscriber) => void;
  onEdit?: (subscriber: Subscriber) => void;
  onDelete?: (subscriber: Subscriber) => void;
  onSuspend?: (subscriber: Subscriber) => void;
  onActivate?: (subscriber: Subscriber) => void;
  onRowClick?: (subscriber: Subscriber) => void;
}
```

**Features:**
- EnhancedDataTable integration
- Column sorting and filtering
- Status badges with color coding
- Connection type icons
- Actions dropdown menu
- Row selection support
- Click-through to detail view

**Usage:**

```typescript
<SubscriberList
  subscribers={subscribers}
  isLoading={isLoading}
  onView={handleView}
  onSuspend={handleSuspend}
  onActivate={handleActivate}
  onRowClick={handleRowClick}
/>
```

### SubscriberDetailModal Component

Location: `frontend/apps/base-app/components/subscribers/SubscriberDetailModal.tsx`

A comprehensive modal dialog for viewing and managing subscriber details.

**Props:**

```typescript
interface SubscriberDetailModalProps {
  subscriber: Subscriber | null;
  open: boolean;
  onClose: () => void;
  onUpdate?: () => void;
  onSuspend?: (subscriber: Subscriber) => void;
  onActivate?: (subscriber: Subscriber) => void;
  onTerminate?: (subscriber: Subscriber) => void;
}
```

**Features:**

**4 Tabs:**
1. **Details** - Contact info, service address, installation details
2. **Services** - Active services, bandwidth, pricing
3. **Network** - ONT configuration, IP addresses, signal quality
4. **Billing** - Subscription dates, payment method, billing cycle

**Quick Actions:**
- Suspend - Temporarily suspend service
- Activate - Restore suspended service
- Terminate - Permanently end service
- Refresh - Reload subscriber data
- Export - Download subscriber data as JSON

**Usage:**

```typescript
<SubscriberDetailModal
  subscriber={selectedSubscriber}
  open={isModalOpen}
  onClose={() => setIsModalOpen(false)}
  onUpdate={() => refetchSubscribers()}
  onSuspend={handleSuspend}
  onActivate={handleActivate}
  onTerminate={handleTerminate}
/>
```

### AddSubscriberModal Component

Location: `frontend/apps/base-app/components/subscribers/AddSubscriberModal.tsx`

A comprehensive form for creating new subscriber accounts.

**Props:**

```typescript
interface AddSubscriberModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: (subscriberId: string) => void;
}
```

**Form Sections:**
1. **Personal Information** - Name, email, phone
2. **Service Address** - Street, city, state, postal code
3. **Service Configuration** - Connection type, plan, bandwidth
4. **Installation Details** - ONT serial, MAC address, notes
5. **Additional Notes** - General notes field

**Validation:**
- Required fields: first name, last name, email, phone, service address, city, state, postal code, connection type
- Email format validation
- Phone number format (flexible)

**Usage:**

```typescript
<AddSubscriberModal
  open={isAddModalOpen}
  onClose={() => setIsAddModalOpen(false)}
  onSuccess={(id) => {
    console.log('Created subscriber:', id);
    refetchSubscribers();
  }}
/>
```

### Subscribers Page

Location: `frontend/apps/base-app/app/dashboard/subscribers/page.tsx`

The main subscribers management page with statistics, filtering, and actions.

**Features:**

**Statistics Dashboard:**
- Total Subscribers
- Active Subscribers
- Suspended Subscribers
- New This Month
- Pending Activation
- Churn This Month
- Average Uptime

**Filtering:**
- Search by name, email, phone, or address
- Filter by status (active, suspended, pending, etc.)
- Filter by connection type (FTTH, FTTB, wireless, hybrid)
- Clear all filters button

**Actions:**
- Add Subscriber (with permission check)
- Export to JSON
- Bulk operations (future enhancement)

**RBAC Integration:**
- `customers.read` - View subscribers
- `customers.create` - Create subscribers
- `customers.update` - Update/suspend/activate subscribers
- `customers.delete` - Delete subscribers

## API Endpoints

### Subscriber Endpoints

```
GET    /api/v1/subscribers                    # List subscribers
GET    /api/v1/subscribers/:id                # Get subscriber details
POST   /api/v1/subscribers                    # Create subscriber
PATCH  /api/v1/subscribers/:id                # Update subscriber
DELETE /api/v1/subscribers/:id                # Delete subscriber

POST   /api/v1/subscribers/:id/suspend        # Suspend subscriber
POST   /api/v1/subscribers/:id/activate       # Activate subscriber
POST   /api/v1/subscribers/:id/terminate      # Terminate subscriber

GET    /api/v1/subscribers/statistics         # Get statistics
GET    /api/v1/subscribers/:id/services       # Get subscriber services
```

### Query Parameters

**List Subscribers:**
```
?status=active,pending              # Filter by status
&connection_type=ftth,fttb          # Filter by connection type
&search=john                        # Search query
&city=New York                      # Filter by city
&from_date=2025-01-01              # Created after date
&to_date=2025-12-31                # Created before date
&limit=50                           # Page size
&offset=0                           # Pagination offset
&sort_by=created_at                # Sort field
&sort_order=desc                    # Sort direction
```

### Request/Response Examples

**Create Subscriber:**

```json
POST /api/v1/subscribers
{
  "first_name": "John",
  "last_name": "Doe",
  "email": "john.doe@example.com",
  "phone": "+1-555-123-4567",
  "secondary_phone": "+1-555-987-6543",
  "service_address": "123 Main Street, Apt 4B",
  "service_city": "New York",
  "service_state": "NY",
  "service_postal_code": "10001",
  "service_country": "USA",
  "connection_type": "ftth",
  "service_plan": "Premium 1000 Mbps",
  "bandwidth_mbps": 1000,
  "installation_date": "2025-11-01",
  "ont_serial_number": "ONT123456789",
  "ont_mac_address": "00:11:22:33:44:55",
  "installation_notes": "Install in basement utility room"
}

Response: 201 Created
{
  "id": "sub_abc123",
  "subscriber_id": "SUB-2025-001234",
  "tenant_id": "tenant_xyz",
  "status": "pending",
  "created_at": "2025-10-15T12:00:00Z",
  "updated_at": "2025-10-15T12:00:00Z",
  ...
}
```

**Suspend Subscriber:**

```json
POST /api/v1/subscribers/sub_abc123/suspend
{
  "reason": "Non-payment - 60 days overdue"
}

Response: 200 OK
{
  "success": true,
  "message": "Subscriber suspended successfully"
}
```

**Get Statistics:**

```json
GET /api/v1/subscribers/statistics

Response: 200 OK
{
  "total_subscribers": 1523,
  "active_subscribers": 1245,
  "suspended_subscribers": 178,
  "pending_subscribers": 45,
  "new_this_month": 67,
  "churn_this_month": 12,
  "average_uptime": 99.7,
  "total_bandwidth_gbps": 1245.5,
  "by_connection_type": {
    "ftth": 1100,
    "fttb": 200,
    "wireless": 150,
    "hybrid": 73
  },
  "by_status": {
    "active": 1245,
    "suspended": 178,
    "pending": 45,
    "inactive": 35,
    "terminated": 20
  }
}
```

## UI Components

### Color Coding

**Status Badges:**
- Active: Green background (#10b981)
- Suspended: Orange background (#f97316)
- Pending: Yellow background (#eab308)
- Inactive: Gray background (#6b7280)
- Terminated: Red background (#dc2626)

**Connection Type Icons:**
- FTTH: Green wifi icon
- FTTB: Blue wifi icon
- Wireless: Purple wifi icon
- Hybrid: Orange wifi icon

### Responsive Design

**Desktop (> 1024px):**
- Full-width layout with 4-column statistics grid
- Multi-column data table
- Side-by-side form fields

**Tablet (768px - 1024px):**
- 2-column statistics grid
- Adjusted table columns
- Stacked form sections

**Mobile (< 768px):**
- Single column layout
- Vertical card stacking
- Touch-optimized buttons
- Simplified table view

## Accessibility

### Keyboard Navigation
- Tab through interactive elements
- Enter to submit forms
- Escape to close modals
- Arrow keys for dropdown navigation

### Screen Reader Support
- ARIA labels on all buttons and inputs
- Role attributes for semantic structure
- Live regions for status updates
- Descriptive text for icons

### Focus Management
- Auto-focus on modal open
- Focus trap within modals
- Visible focus indicators
- Logical tab order

## Performance Optimization

### Data Loading
- Lazy loading of subscriber details
- Pagination for large datasets
- Query parameter memoization
- Debounced search input

### Component Optimization
- React.memo for expensive components
- useMemo for computed values
- useCallback for stable function references
- Conditional rendering for tabs

### Caching Strategy
- React Query for server state management
- Automatic cache invalidation
- Background refetching
- Optimistic updates

## Testing

### Unit Tests

```typescript
// Test subscriber hook
describe('useSubscribers', () => {
  it('should fetch subscribers with filters', async () => {
    const { result } = renderHook(() =>
      useSubscribers({ status: ['active'], limit: 10 })
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.subscribers).toHaveLength(10);
  });
});

// Test component rendering
describe('SubscriberList', () => {
  it('should render subscriber table', () => {
    render(<SubscriberList subscribers={mockSubscribers} />);
    expect(screen.getByText('John Doe')).toBeInTheDocument();
  });
});
```

### Integration Tests

```typescript
// Test create subscriber flow
describe('Create Subscriber Flow', () => {
  it('should create new subscriber', async () => {
    render(<SubscribersPage />);

    // Open modal
    fireEvent.click(screen.getByText('Add Subscriber'));

    // Fill form
    fireEvent.change(screen.getByLabelText('First Name'), {
      target: { value: 'John' }
    });
    // ... fill other fields

    // Submit
    fireEvent.click(screen.getByText('Create Subscriber'));

    // Verify
    await waitFor(() => {
      expect(screen.getByText('Subscriber Created')).toBeInTheDocument();
    });
  });
});
```

## Error Handling

### API Errors
- Display user-friendly error messages
- Log detailed errors for debugging
- Retry mechanisms for transient failures
- Graceful degradation

### Validation Errors
- Inline field validation
- Form-level validation summary
- Clear error messages
- Field focus on error

### Network Errors
- Connection timeout handling
- Offline state detection
- Retry with exponential backoff
- User notification

## Security

### Permission Checks
- RBAC integration for all operations
- Feature-level permission enforcement
- UI element hiding based on permissions
- API-level permission validation

### Data Protection
- Input sanitization
- XSS prevention
- CSRF token validation
- Secure data transmission (HTTPS)

### Audit Trail
- Log all subscriber modifications
- Track user actions
- Maintain change history
- Compliance reporting

## Future Enhancements

### Phase 2 (Q1 2026)
- [ ] Real-time subscriber status updates
- [ ] Bulk operations (suspend/activate multiple)
- [ ] Advanced filtering (date ranges, custom fields)
- [ ] Export to CSV/PDF
- [ ] Import from CSV/Excel

### Phase 3 (Q2 2026)
- [ ] Service quality trending charts
- [ ] Predictive churn analytics
- [ ] Automated provisioning workflows
- [ ] Integration with external CRM systems
- [ ] Mobile app support

### Phase 4 (Q3 2026)
- [ ] AI-powered customer insights
- [ ] Automated support ticket creation
- [ ] Self-service portal for subscribers
- [ ] Advanced reporting and dashboards
- [ ] Integration with billing systems

## Troubleshooting

### Common Issues

**Subscribers not loading:**
1. Check API endpoint configuration
2. Verify authentication token
3. Check RBAC permissions
4. Review network console for errors

**Modal not opening:**
1. Check state management
2. Verify modal prop passing
3. Check for JavaScript errors
3. Ensure Dialog component is rendered

**Form validation errors:**
1. Check required field values
2. Verify email/phone formats
3. Review validation logic
4. Check console for errors

**Performance issues:**
1. Enable pagination for large datasets
2. Optimize query parameters
3. Check for memory leaks
4. Profile component rendering

## Best Practices

### Code Organization
- Keep components focused and single-purpose
- Extract reusable logic into hooks
- Use TypeScript for type safety
- Follow consistent naming conventions

### State Management
- Use appropriate hook for data type
- Minimize state duplication
- Lift state when needed
- Use context for global state

### API Integration
- Centralize API client configuration
- Use consistent error handling
- Implement retry logic
- Cache responses appropriately

### UI/UX
- Provide immediate feedback
- Show loading states
- Display clear error messages
- Maintain consistent styling

## Support

For issues or questions:
- Technical documentation: `docs/`
- Component examples: `components/*/examples.tsx`
- API documentation: Backend team
- RBAC setup: Platform admin team

---

**Last Updated:** 2025-10-15
**Version:** 1.0.0
**Maintainer:** Frontend Team
