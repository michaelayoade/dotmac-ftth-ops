# Network Module

VOLTHA-based PON network management components for ONU and OLT operations.

## Overview

The network module provides components for managing Passive Optical Network (PON) infrastructure using VOLTHA (Virtual OLT Hardware Abstraction). It includes components for ONU inventory, ONU diagnostics, and OLT management.

## Components

### ONUListView

**Purpose**: Display ONU inventory with status and management actions

**Props**:

```typescript
interface ONUListViewProps {
  apiClient: ONUListViewApiClient;
  useToast: () => { toast: (options: any) => void };
  onONUSelect?: (onu: VOLTHATypes.ONU) => void;
}
```

**Features**:

- ONU list with real-time status
- Filter by OLT and PON port
- Search by serial number or device ID
- Status indicators (online, offline, LOS, dying gasp)
- Signal level display (OLT RX power)
- Quick actions (reboot, delete, diagnostics)
- Pagination and sorting
- Auto-refresh

**Dependencies**: apiClient, useToast

**Usage**:

```typescript
import { ONUListView } from "@/components/network/ONUListView";

<ONUListView
  onONUSelect={(onu) => router.push(`/network/onus/${onu.id}`)}
/>
```

**Status Indicators**:

- 🟢 Online: ONU is active and communicating
- 🔴 Offline: ONU is not responding
- 🟡 LOS (Loss of Signal): Fiber issue detected
- ⚫ Dying Gasp: ONU sent alarm before power loss

---

### ONUDetailView

**Purpose**: Detailed ONU information and diagnostics

**Props**:

```typescript
interface ONUDetailViewProps {
  onuId: string;
  apiClient: ONUDetailViewApiClient;
  useToast: () => { toast: (options: any) => void };
}
```

**Features**:

- ONU information (serial, model, vendor, firmware)
- Connection details (OLT, PON port, ONU ID)
- Signal levels:
  - OLT RX power (dBm)
  - ONU TX power (dBm)
  - ONU RX power (dBm)
  - Temperature
- UNI port status (Ethernet ports)
- OMCI diagnostics
- Performance metrics (throughput, errors)
- Configuration management
- Reboot/reset actions
- Alarm history

**Dependencies**: apiClient, useToast

**Usage**:

```typescript
import { ONUDetailView } from "@/components/network/ONUDetailView";

<ONUDetailView onuId="onu_123" />
```

**Signal Level Interpretation**:

- Good: > -25 dBm
- Fair: -25 to -28 dBm
- Poor: < -28 dBm

---

### OLTManagement

**Purpose**: OLT configuration and PON port monitoring

**Props**:

```typescript
interface OLTManagementProps {
  apiClient: OLTManagementApiClient;
  useToast: () => { toast: (options: any) => void };
}
```

**Features**:

- OLT list with status
- PON port overview (utilization, ONU count)
- Per-PON metrics:
  - Total ONUs
  - Online ONUs
  - Average signal level
  - Bandwidth utilization
- OLT configuration:
  - PON port enable/disable
  - Profile assignment
  - Bandwidth limits
- Alarms and events
- Performance graphs

**Dependencies**: apiClient, useToast

**Usage**:

```typescript
import { OLTManagement } from "@/components/network/OLTManagement";

<OLTManagement />
```

---

## Types

### VOLTHA Types

All VOLTHA-related types are exported under the `VOLTHATypes` namespace to avoid conflicts:

```typescript
import { VOLTHATypes } from "@dotmac/features/network";

const onu: VOLTHATypes.ONU = { ... };
```

### ONU

```typescript
namespace VOLTHATypes {
  interface ONU {
    id: string;
    serial_number: string;
    device_id: string;
    olt_id: string;
    olt_name: string;
    pon_port: number;
    onu_id: number;
    status: "online" | "offline" | "los" | "dying_gasp";
    vendor: string;
    model: string;
    firmware_version?: string;
    olt_rx_power?: number; // dBm
    onu_tx_power?: number; // dBm
    onu_rx_power?: number; // dBm
    temperature?: number; // Celsius
    last_seen: string;
    subscriber_id?: string;
  }
}
```

### OLT

```typescript
namespace VOLTHATypes {
  interface OLT {
    id: string;
    device_id: string;
    name: string;
    vendor: string;
    model: string;
    ip_address: string;
    status: "online" | "offline" | "maintenance";
    total_pon_ports: number;
    active_pon_ports: number;
    total_onus: number;
    online_onus: number;
    firmware_version?: string;
  }
}
```

### PON Port

```typescript
namespace VOLTHATypes {
  interface PONPort {
    olt_id: string;
    port_number: number;
    status: "enabled" | "disabled";
    total_onus: number;
    online_onus: number;
    average_signal_level?: number;
    bandwidth_utilization?: number; // percentage
    profile?: string;
  }
}
```

### UNI Port

```typescript
namespace VOLTHATypes {
  interface UNIPort {
    port_number: number;
    status: "up" | "down";
    speed: "10M" | "100M" | "1G" | "10G";
    duplex: "half" | "full";
    vlan_id?: number;
  }
}
```

## API Endpoints

### ONU Management

- `GET /api/v1/voltha/onus` - List ONUs
- `GET /api/v1/voltha/onus/{id}` - Get ONU details
- `POST /api/v1/voltha/onus/{id}/reboot` - Reboot ONU
- `DELETE /api/v1/voltha/onus/{id}` - Delete ONU
- `GET /api/v1/voltha/onus/{id}/metrics` - Get ONU metrics
- `GET /api/v1/voltha/onus/{id}/alarms` - Get ONU alarms

### OLT Management

- `GET /api/v1/voltha/olts` - List OLTs
- `GET /api/v1/voltha/olts/{id}` - Get OLT details
- `GET /api/v1/voltha/olts/{id}/ports` - Get PON ports
- `PUT /api/v1/voltha/olts/{id}/ports/{port}` - Update PON port config

### Diagnostics

- `POST /api/v1/voltha/onus/{id}/omci` - Run OMCI diagnostics
- `GET /api/v1/voltha/onus/{id}/stats` - Get performance stats

## Common Workflows

### ONU Troubleshooting

```typescript
// 1. Find ONU in list
<ONUListView
  onONUSelect={(onu) => {
    if (onu.status === "offline" || onu.status === "los") {
      setSelectedOnu(onu);
      setShowDiagnostics(true);
    }
  }}
/>

// 2. View detailed diagnostics
<ONUDetailView onuId={selectedOnu.id} />

// 3. Actions
// - Check signal levels
// - View alarm history
// - Reboot ONU
// - Check subscriber association
```

### PON Port Monitoring

```typescript
<OLTManagement />

// Monitor:
// - ONU count per PON
// - Signal levels
// - Bandwidth utilization
// - Identify overloaded PONs
```

### ONU Discovery

```typescript
// 1. List ONUs without subscriber
const unusedOnus = onus.filter(onu => !onu.subscriber_id);

// 2. Display in ONUListView
<ONUListView
  onONUSelect={(onu) => {
    // Provision subscriber to this ONU
    openProvisionModal(onu);
  }}
/>
```

## Signal Level Guidelines

### OLT RX Power (at OLT)

- Excellent: -15 to -20 dBm
- Good: -20 to -25 dBm
- Fair: -25 to -28 dBm
- Poor: < -28 dBm (investigate fiber quality)

### ONU TX Power (from ONU)

- Normal: 0 to +4 dBm
- Laser on: ~2 dBm typical

### ONU RX Power (at ONU)

- Good: -8 to -25 dBm
- Fair: -25 to -27 dBm
- Poor: < -27 dBm

### Temperature

- Normal: 20-50°C
- Warning: 50-70°C
- Critical: > 70°C

## Troubleshooting

### Issue: ONU showing offline but should be online

**Check**:

1. Signal levels (should be > -28 dBm)
2. Last seen timestamp
3. Fiber connection physical status
4. PON port enabled on OLT
5. ONU power supply

**Actions**:

```typescript
// Check last seen
if (onu.last_seen > 5 minutes ago) {
  // ONU hasn't communicated recently
  // Likely fiber or power issue
}

// Check signal
if (onu.olt_rx_power < -28) {
  // Poor signal - fiber issue
}

// Reboot ONU
apiClient.post(`/api/v1/voltha/onus/${onu.id}/reboot`);
```

### Issue: Poor signal levels

**Causes**:

1. Fiber connector dirty/damaged
2. Excessive fiber length or splices
3. Bad ONU laser
4. PON splitter ratio too high

**Actions**:

- Clean fiber connectors
- Check fiber path for damage
- Measure optical budget
- Replace ONU if laser failing

### Issue: ONU flapping (online/offline)

**Causes**:

1. Unstable power supply
2. Marginal signal level
3. Temperature issues
4. Firmware bugs

**Actions**:

- Check ONU temperature
- Verify signal levels are stable
- Check for alarms in history
- Update ONU firmware

## Integration with Other Modules

### With Subscribers Module

```typescript
// Link ONU to subscriber
import { ONUListView } from "@dotmac/features/network";

<ONUListView
  onONUSelect={(onu) => {
    if (onu.subscriber_id) {
      router.push(`/subscribers/${onu.subscriber_id}`);
    } else {
      // Provision new subscriber
      openProvisionModal({ onuId: onu.id });
    }
  }}
/>
```

### With Faults Module

```typescript
// Create alarm when signal poor
if (onu.olt_rx_power < -28) {
  createAlarm({
    type: "poor_signal",
    severity: "warning",
    device_id: onu.id,
    message: `ONU ${onu.serial_number} has poor signal: ${onu.olt_rx_power} dBm`,
  });
}
```

### With Diagnostics Module

```typescript
// Run network diagnostics from ONU
import { DiagnosticsDashboard } from "@dotmac/features/diagnostics";

<DiagnosticsDashboard
  targetDevice={selectedOnu}
  diagnosticTypes={["ping", "traceroute", "bandwidth"]}
/>
```

## Performance Considerations

### Auto-Refresh

Components with real-time data (ONUListView, ONUDetailView) poll the backend:

```typescript
// Default refresh interval: 30 seconds
// Configure via props:
<ONUListView refreshInterval={60000} /> // 60 seconds
```

Disable auto-refresh for large deployments:

```typescript
<ONUListView autoRefresh={false} />
```

### Pagination

For large ONU lists, use pagination:

```typescript
// Backend should support
GET /api/v1/voltha/onus?page=1&limit=50&olt_id=olt_123
```

## Testing

### Unit Tests

```typescript
import { render, screen } from "@testing-library/react";
import { ONUListView } from "@dotmac/features/network";

const mockApiClient = {
  get: jest.fn().mockResolvedValue({
    data: {
      onus: [
        {
          id: "onu_1",
          serial_number: "ABCD12345678",
          status: "online",
          olt_rx_power: -22,
        },
      ],
    },
  }),
};

test("renders ONU list", async () => {
  render(
    <ONUListView
      apiClient={mockApiClient}
      useToast={() => ({ toast: jest.fn() })}
    />
  );

  await waitFor(() => {
    expect(screen.getByText("ABCD12345678")).toBeInTheDocument();
    expect(screen.getByText("-22 dBm")).toBeInTheDocument();
  });
});
```

## Related Modules

- **cpe**: CPE/ONT device configuration (TR-069)
- **subscribers**: Link ONUs to subscribers
- **faults**: Alarm management for network issues
- **diagnostics**: Network diagnostics and testing
- **monitoring**: Real-time network monitoring

## Contributing

When adding network components:

1. Use `VOLTHATypes` namespace for types
2. Handle signal levels consistently (dBm)
3. Include status indicators
4. Support auto-refresh for real-time data
5. Add error handling for offline devices
6. Document signal level thresholds
7. Test with large ONU counts
