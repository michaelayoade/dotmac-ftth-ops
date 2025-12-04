# Fault Management Components

This directory contains React components for the Fault Management system, providing interfaces for monitoring, managing, and analyzing network alarms.

## Components

### AlarmDetailModal

A comprehensive modal dialog for viewing and managing detailed alarm information.

**File**: `AlarmDetailModal.tsx`

**Features**:

- Complete alarm information display
- Interactive history timeline
- Notes and comments management
- Related tickets view
- Quick actions (acknowledge, clear, create ticket)
- Export functionality
- Responsive design with tabbed interface

**Props**:

```typescript
interface AlarmDetailModalProps {
  alarm: Alarm | null; // The alarm to display
  open: boolean; // Control visibility
  onClose: () => void; // Close handler
  onUpdate?: () => void; // Optional update callback
}
```

**Usage**:

```tsx
import { AlarmDetailModal } from "@/components/faults/AlarmDetailModal";

<AlarmDetailModal
  alarm={selectedAlarm}
  open={isModalOpen}
  onClose={() => setIsModalOpen(false)}
  onUpdate={() => refetchAlarms()}
/>;
```

**See**: `AlarmDetailModal.examples.tsx` for more usage examples.

## Directory Structure

```
components/faults/
├── README.md                           # This file
├── AlarmDetailModal.tsx               # Main detail modal component
├── AlarmDetailModal.examples.tsx      # Usage examples and demos
└── (future components)
```

## Related Files

### Hooks

- `hooks/useFaults.ts` - Custom hooks for alarm operations
  - `useAlarms()` - Fetch and filter alarms
  - `useAlarmStatistics()` - Get alarm statistics
  - `useAlarmOperations()` - Perform actions (acknowledge, clear, etc.)
  - `useAlarmDetails()` - Fetch history and notes
  - `useSLACompliance()` - Get SLA metrics

### Pages

- `app/dashboard/network/faults/page.tsx` - Main fault management page

### Documentation

- `frontend/PRODUCTION_GUIDE.md` – Fault management expectations for production deploys

## Component Guidelines

### Styling

- Use Tailwind CSS classes for styling
- Follow the design system color palette
- Use semantic color variables (e.g., `bg-red-500` for critical)
- Maintain consistent spacing with the grid system

### Accessibility

- Ensure keyboard navigation works properly
- Add ARIA labels to interactive elements
- Use semantic HTML elements
- Maintain proper heading hierarchy
- Provide loading and error states

### Performance

- Lazy load modal content
- Use React.memo for expensive components
- Implement proper cleanup in useEffect
- Avoid unnecessary re-renders

### Error Handling

- Display user-friendly error messages
- Provide retry mechanisms
- Log errors for debugging
- Gracefully degrade functionality

## Development

### Adding New Components

1. Create component file in this directory
2. Follow naming convention: `ComponentName.tsx`
3. Add TypeScript types/interfaces
4. Include JSDoc comments
5. Create examples file: `ComponentName.examples.tsx`
6. Update this README
7. Add tests if applicable

### Testing

Components should include:

- Unit tests for logic
- Integration tests for API calls
- Accessibility tests
- Visual regression tests

Example test structure:

```typescript
describe("ComponentName", () => {
  it("should render correctly", () => {});
  it("should handle user interactions", () => {});
  it("should handle errors gracefully", () => {});
});
```

## Future Components

Planned components for this directory:

- [ ] `AlarmListWidget` - Compact alarm list for dashboards
- [ ] `AlarmTimeline` - Visual timeline of alarm events
- [ ] `AlarmCorrelationView` - Correlation visualization
- [ ] `AlarmImpactAnalysis` - Impact analysis dashboard
- [ ] `AlarmFiltersPanel` - Advanced filtering sidebar
- [ ] `AlarmBulkActions` - Bulk operation interface
- [ ] `AlarmNotificationSettings` - User notification preferences
- [ ] `AlarmRuleBuilder` - Create custom alarm rules

## Best Practices

1. **Component Composition**: Break large components into smaller, reusable pieces
2. **Props Validation**: Use TypeScript interfaces for all props
3. **State Management**: Use local state when possible, context for shared state
4. **Side Effects**: Properly cleanup side effects in useEffect
5. **Error Boundaries**: Wrap components in error boundaries
6. **Documentation**: Keep JSDoc comments up to date
7. **Examples**: Provide usage examples for complex components

## Contributing

When adding or modifying components:

1. Follow the established patterns and conventions
2. Write clear, descriptive commit messages
3. Update documentation and examples
4. Add or update tests
5. Request code review from team members

## Support

For questions or issues:

- Check component documentation
- Review example implementations
- Consult the team's technical lead
- Create an issue in the project tracker

---

**Last Updated**: 2025-10-15
**Maintained By**: Frontend Development Team
