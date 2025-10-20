# Alarm Detail Modal Implementation

## Overview

The Alarm Detail Modal provides a comprehensive, production-ready interface for viewing and managing network alarms in the fault management system. It includes detailed alarm information, history tracking, notes management, related tickets, and action capabilities.

## Features

### 1. Alarm Header
- **Severity Badge**: Visual indicator with color-coded severity levels
- **Status Badge**: Current alarm status (Active, Acknowledged, Cleared, Resolved)
- **Source Badge**: Alarm source system (GenieACS, VOLTHA, NetBox, Manual)
- **Quick Actions**: Prominent action buttons for common operations
- **Export Button**: Download alarm data as JSON

### 2. Tabbed Interface

#### Details Tab
- **Key Metrics Cards**:
  - First Occurrence
  - Last Occurrence
  - Duration (calculated)
  - Occurrence Count

- **Alarm Information**:
  - Description and detailed message
  - Alarm type and severity
  - Source system information

- **Resource Information**:
  - Resource type and name
  - Resource ID
  - Associated customer
  - Affected subscriber count

- **Root Cause Analysis**:
  - Root cause indicator
  - Probable cause description
  - Recommended actions
  - Correlation ID

- **Metadata Display**:
  - JSON formatted metadata viewer
  - Additional alarm attributes

#### History Tab
- **Timeline View**:
  - Chronological event history
  - User attribution
  - Action details
  - Status transitions
  - Visual timeline with icons

#### Notes Tab
- **Add Note Form**:
  - Rich text input
  - Save/cancel actions
  - Real-time validation

- **Notes List**:
  - User attribution
  - Timestamps
  - Full note content
  - Chronological order

#### Related Tab
- **Related Tickets**:
  - Ticket number and title
  - Status and priority badges
  - Assignment information
  - Quick link to ticket details

- **Correlated Alarms**:
  - Correlation ID display
  - Link to related alarms
  - Impact analysis

### 3. Quick Actions

#### Acknowledge
- Mark alarm as acknowledged
- Add acknowledgment note
- Update history
- Available for: Active alarms

#### Clear
- Mark alarm as cleared
- Record clearance time
- Update status
- Available for: Active and Acknowledged alarms

#### Create Ticket
- Create associated ticket
- Set priority based on severity
- Link ticket to alarm
- Available for: Alarms without tickets

#### Refresh
- Reload alarm details
- Fetch latest history
- Update notes
- Available: Always

### 4. Export Functionality
- Export alarm data as JSON
- Includes:
  - Full alarm details
  - Complete history
  - All notes
  - Export timestamp

## Component Architecture

### File Structure
```
frontend/apps/base-app/
├── components/faults/
│   └── AlarmDetailModal.tsx     # Main modal component
├── hooks/
│   └── useFaults.ts              # Alarm management hooks
└── app/dashboard/network/faults/
    └── page.tsx                  # Integration in faults page
```

### Component Props

```typescript
interface AlarmDetailModalProps {
  alarm: Alarm | null;           // Alarm to display
  open: boolean;                 // Modal visibility state
  onClose: () => void;          // Close handler
  onUpdate?: () => void;        // Callback after updates
}
```

### Key Types

```typescript
interface AlarmHistory {
  id: string;
  timestamp: string;
  action: string;
  user?: string;
  details?: string;
  previous_status?: AlarmStatus;
  new_status?: AlarmStatus;
}

interface AlarmNote {
  id: string;
  alarm_id: string;
  user_id: string;
  user_name: string;
  content: string;
  created_at: string;
  updated_at?: string;
}

interface RelatedTicket {
  id: string;
  ticket_number: string;
  title: string;
  status: string;
  priority: string;
  created_at: string;
  assigned_to?: string;
}
```

## API Integration

### Endpoints Used

1. **Get Alarm History**
   ```
   GET /api/v1/faults/alarms/{alarm_id}/history
   ```

2. **Get Alarm Notes**
   ```
   GET /api/v1/faults/alarms/{alarm_id}/notes
   ```

3. **Add Alarm Note**
   ```
   POST /api/v1/faults/alarms/{alarm_id}/notes
   Body: { content: string }
   ```

4. **Acknowledge Alarm**
   ```
   POST /api/v1/faults/alarms/{alarm_id}/acknowledge
   Body: { note?: string }
   ```

5. **Clear Alarm**
   ```
   POST /api/v1/faults/alarms/{alarm_id}/clear
   ```

6. **Create Ticket**
   ```
   POST /api/v1/faults/alarms/{alarm_id}/create-ticket
   Body: { priority: string }
   ```

7. **Get Related Ticket**
   ```
   GET /api/v1/tickets/{ticket_id}
   ```

## Usage

### Basic Usage

```typescript
import { AlarmDetailModal } from '@/components/faults/AlarmDetailModal';

function MyComponent() {
  const [selectedAlarm, setSelectedAlarm] = useState<Alarm | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleAlarmClick = (alarm: Alarm) => {
    setSelectedAlarm(alarm);
    setIsModalOpen(true);
  };

  return (
    <>
      {/* Your alarm list/table */}

      <AlarmDetailModal
        alarm={selectedAlarm}
        open={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedAlarm(null);
        }}
        onUpdate={() => {
          // Refresh alarm list
          refetchAlarms();
        }}
      />
    </>
  );
}
```

### Integration with Data Table

```typescript
<EnhancedDataTable
  data={alarms}
  columns={columns}
  onRowClick={(alarm) => {
    setSelectedAlarm(alarm);
    setIsModalOpen(true);
  }}
/>
```

## Styling and Theming

### Color Coding

**Severity Colors:**
- Critical: Red (`bg-red-500`)
- Major: Orange (`bg-orange-500`)
- Minor: Yellow (`bg-yellow-500`)
- Warning: Blue (`bg-blue-500`)
- Info: Gray (`bg-gray-500`)

**Status Colors:**
- Active: Red background
- Acknowledged: Yellow background
- Cleared: Blue background
- Resolved: Green background

### Icons

- Critical: AlertTriangle
- Major: AlertCircle
- Minor/Info: Info
- Warning: Bell
- History: Activity
- Notes: MessageSquare
- Tickets: FileText
- User: User

## Accessibility Features

1. **Keyboard Navigation**:
   - Tab through interactive elements
   - Escape to close modal
   - Enter to submit forms

2. **Screen Reader Support**:
   - ARIA labels on all interactive elements
   - Proper heading hierarchy
   - Descriptive button text

3. **Visual Indicators**:
   - High contrast colors
   - Clear focus states
   - Loading states

## Performance Considerations

1. **Lazy Loading**:
   - Details loaded only when modal opens
   - Separate API calls for history and notes

2. **Caching**:
   - Local state management
   - Refresh on explicit user action

3. **Optimistic Updates**:
   - Immediate UI feedback
   - Background API calls
   - Error handling with rollback

## Error Handling

### Network Errors
- Graceful degradation
- Retry functionality
- User-friendly error messages

### Validation
- Required field validation
- Content length limits
- Format validation

### Loading States
- Skeleton screens
- Loading indicators
- Disabled states during operations

## Testing Considerations

### Unit Tests
```typescript
describe('AlarmDetailModal', () => {
  it('should display alarm details correctly');
  it('should handle acknowledge action');
  it('should add notes successfully');
  it('should export alarm data');
});
```

### Integration Tests
```typescript
describe('Alarm Detail Flow', () => {
  it('should open modal from alarm list');
  it('should update alarm and refresh list');
  it('should handle error states');
});
```

## Future Enhancements

### Phase 2
- [ ] Real-time updates via WebSocket
- [ ] Inline editing of alarm fields
- [ ] Attachment support for notes
- [ ] Rich text formatting for notes

### Phase 3
- [ ] Advanced correlation visualization
- [ ] Impact analysis dashboard
- [ ] SLA tracking per alarm
- [ ] Automated action suggestions

### Phase 4
- [ ] ML-powered root cause analysis
- [ ] Predictive alarm detection
- [ ] Automated remediation workflows
- [ ] Advanced analytics integration

## Troubleshooting

### Modal Not Opening
1. Check `open` prop is true
2. Verify `alarm` prop is not null
3. Check for JavaScript errors in console

### Data Not Loading
1. Verify API endpoints are accessible
2. Check authentication tokens
3. Review network tab for failed requests
4. Verify alarm ID is valid

### Actions Not Working
1. Check user permissions
2. Verify API endpoints
3. Review request payload
4. Check for validation errors

## Best Practices

1. **Always handle errors gracefully**
2. **Provide user feedback for all actions**
3. **Keep modal responsive and performant**
4. **Use semantic HTML for accessibility**
5. **Follow consistent naming conventions**
6. **Document any customizations**

## Related Documentation

- [Fault Management Overview](./ALARM_NOTIFICATION_TESTS.md)
- [API Documentation](../src/dotmac/platform/fault_management/router.py)
- [Component Library](../frontend/apps/base-app/components/README.md)
- [Testing Guide](../tests/fault_management/README.md)

## Support

For questions or issues:
1. Check this documentation
2. Review the component source code
3. Check related test files
4. Contact the development team

---

**Last Updated**: 2025-10-15
**Version**: 1.0.0
**Author**: Development Team
