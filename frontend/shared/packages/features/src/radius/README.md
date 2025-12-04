# RADIUS Module

AAA (Authentication, Authorization, Accounting) and bandwidth management components.

## Overview

The RADIUS module provides components for managing RADIUS-based network access control, monitoring active sessions, managing bandwidth profiles, and configuring NAS devices.

## Components

### RadiusSessionMonitor

**Purpose**: Monitor active RADIUS sessions in real-time

**Props**:

```typescript
interface RadiusSessionMonitorProps {
  apiClient: RadiusSessionMonitorApiClient;
  useToast: () => { toast: (options: any) => void };
  refreshInterval?: number; // Default: 10000ms (10 seconds)
}
```

**Features**:

- Real-time session list with auto-refresh
- Session details:
  - Username/subscriber
  - IP address (IPv4/IPv6)
  - Session duration
  - Upload/download bytes
  - Upload/download rate (real-time)
  - NAS identifier
  - NAS port
  - MAC address
- Filter by subscriber, IP, or NAS
- Sort by any column
- Disconnect action (CoA)
- Export session data

**Dependencies**: apiClient, useToast

**Usage**:

```typescript
import { RadiusSessionMonitor } from "@/components/radius/RadiusSessionMonitor";

<RadiusSessionMonitor
  refreshInterval={5000} // 5 seconds
/>
```

**Session States**:

- 🟢 Active: Session is active and passing traffic
- 🟡 Idle: Session connected but no traffic
- 🔴 Stale: Session hasn't updated in >5 minutes (may be zombie)

---

### BandwidthProfileDialog

**Purpose**: Create and edit bandwidth profiles

**Props**:

```typescript
interface BandwidthProfileDialogProps {
  open: boolean;
  profileId?: string; // For editing
  onClose: () => void;
  onProfileSaved?: (profile: BandwidthProfile) => void;
  apiClient: BandwidthProfileDialogApiClient;
  useToast: () => { toast: (options: any) => void };
}
```

**Features**:

- Profile name and description
- Download/upload rate limits (Mbps or Kbps)
- Burst settings:
  - Burst size (MB)
  - Burst time (seconds)
  - Burst threshold (percentage)
- Priority/QoS settings
- Time-based profiles (day/night rates)
- Fair usage policy (FUP):
  - Monthly quota (GB)
  - Throttled speed after quota
  - Reset day
- Profile preview
- Validation

**Dependencies**: apiClient, useToast

**Usage**:

```typescript
import { BandwidthProfileDialog } from "@/components/radius/BandwidthProfileDialog";

<BandwidthProfileDialog
  open={showDialog}
  profileId={editingProfileId}
  onClose={() => setShowDialog(false)}
  onProfileSaved={(profile) => {
    setShowDialog(false);
    refetchProfiles();
  }}
/>
```

**Profile Examples**:

Basic Profile:

```typescript
{
  name: "50/10 Mbps",
  download_rate: 50000, // Kbps
  upload_rate: 10000,
}
```

Profile with Burst:

```typescript
{
  name: "100/20 with Burst",
  download_rate: 100000,
  upload_rate: 20000,
  burst_download: 150000, // 150 Mbps burst
  burst_upload: 30000,
  burst_threshold: 80, // Burst when utilization > 80%
  burst_time: 30, // Burst for max 30 seconds
}
```

Profile with FUP:

```typescript
{
  name: "Unlimited with FUP",
  download_rate: 100000,
  upload_rate: 20000,
  fup_quota: 500, // 500 GB/month
  fup_throttle_download: 10000, // 10 Mbps after quota
  fup_throttle_upload: 2000,
  fup_reset_day: 1, // Reset on 1st of month
}
```

Time-based Profile:

```typescript
{
  name: "Day/Night Rates",
  schedules: [
    {
      name: "Day Rate",
      days: ["mon", "tue", "wed", "thu", "fri"],
      start_time: "08:00",
      end_time: "22:00",
      download_rate: 50000,
      upload_rate: 10000,
    },
    {
      name: "Night Rate",
      days: ["mon", "tue", "wed", "thu", "fri"],
      start_time: "22:00",
      end_time: "08:00",
      download_rate: 100000, // Faster at night
      upload_rate: 20000,
    },
  ],
}
```

---

### NASDeviceDialog

**Purpose**: Manage NAS (Network Access Server) devices

**Props**:

```typescript
interface NASDeviceDialogProps {
  open: boolean;
  deviceId?: string; // For editing
  onClose: () => void;
  onDeviceSaved?: (device: NASDevice) => void;
  apiClient: NASDeviceDialogApiClient;
  useToast: () => { toast: (options: any) => void };
}
```

**Features**:

- Device name and shortname
- IP address (with validation)
- RADIUS shared secret
- NAS type (BNG, CPE, WiFi, etc.)
- Ports configuration:
  - Authentication port (default: 1812)
  - Accounting port (default: 1813)
  - CoA port (default: 3799)
- CoA support enable/disable
- Description/notes
- Status (active/inactive)

**Dependencies**: apiClient, useToast

**Usage**:

```typescript
import { NASDeviceDialog } from "@/components/radius/NASDeviceDialog";

<NASDeviceDialog
  open={showDialog}
  deviceId={editingDeviceId}
  onClose={() => setShowDialog(false)}
  onDeviceSaved={(device) => {
    setShowDialog(false);
    toast({
      title: "Success",
      description: "NAS device saved successfully",
    });
  }}
/>
```

**NAS Types**:

- `bng`: Broadband Network Gateway
- `cpe`: Customer Premises Equipment
- `wifi`: WiFi Access Point/Controller
- `switch`: Managed Switch
- `router`: Router
- `other`: Other device type

---

## Types

### RadiusSession

```typescript
interface RadiusSession {
  id: string;
  username: string;
  subscriber_id?: string;
  nas_identifier: string;
  nas_port: string;
  nas_port_type: string;
  service_type: string;
  framed_ip_address?: string;
  framed_ipv6_address?: string;
  calling_station_id: string; // MAC address
  called_station_id: string;
  acct_session_id: string;
  acct_session_time: number; // seconds
  acct_input_octets: number; // bytes uploaded
  acct_output_octets: number; // bytes downloaded
  acct_input_gigawords?: number;
  acct_output_gigawords?: number;
  acct_input_packets: number;
  acct_output_packets: number;
  upload_rate?: number; // Kbps
  download_rate?: number; // Kbps
  started_at: string;
  last_updated: string;
}
```

### BandwidthProfile

```typescript
interface BandwidthProfile {
  id: string;
  name: string;
  description?: string;
  download_rate: number; // Kbps
  upload_rate: number; // Kbps

  // Burst settings
  burst_download?: number; // Kbps
  burst_upload?: number; // Kbps
  burst_threshold?: number; // Percentage (0-100)
  burst_time?: number; // Seconds

  // Priority/QoS
  priority?: number; // 1-10 (1 = highest)

  // Fair Usage Policy
  fup_enabled?: boolean;
  fup_quota?: number; // GB per month
  fup_throttle_download?: number; // Kbps after quota
  fup_throttle_upload?: number; // Kbps after quota
  fup_reset_day?: number; // Day of month (1-31)

  // Time-based rates
  schedules?: BandwidthSchedule[];

  // Metadata
  subscriber_count?: number;
  created_at: string;
  updated_at: string;
}

interface BandwidthSchedule {
  name: string;
  days: ("mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun")[];
  start_time: string; // HH:MM
  end_time: string; // HH:MM
  download_rate: number;
  upload_rate: number;
}
```

### NASDevice

```typescript
interface NASDevice {
  id: string;
  name: string;
  shortname: string;
  ip_address: string;
  secret: string; // RADIUS shared secret
  type: "bng" | "cpe" | "wifi" | "switch" | "router" | "other";
  description?: string;

  // Ports
  auth_port: number; // Default: 1812
  acct_port: number; // Default: 1813
  coa_port: number; // Default: 3799

  // Features
  coa_enabled: boolean;

  // Status
  status: "active" | "inactive";

  // Metadata
  last_seen?: string;
  created_at: string;
  updated_at: string;
}
```

### CoARequest

```typescript
interface CoARequest {
  session_id: string;
  action: "disconnect" | "change_bandwidth" | "reauthenticate";
  attributes?: Record<string, any>;
}
```

## API Endpoints

### Sessions

- `GET /api/isp/v1/admin/radius/sessions` - List active sessions
- `GET /api/isp/v1/admin/radius/sessions/{id}` - Get session details
- `POST /api/isp/v1/admin/radius/sessions/{id}/disconnect` - Disconnect session (CoA)
- `POST /api/isp/v1/admin/radius/sessions/{id}/coa` - Send CoA request

### Bandwidth Profiles

- `GET /api/isp/v1/admin/radius/bandwidth-profiles` - List profiles
- `POST /api/isp/v1/admin/radius/bandwidth-profiles` - Create profile
- `GET /api/isp/v1/admin/radius/bandwidth-profiles/{id}` - Get profile
- `PUT /api/isp/v1/admin/radius/bandwidth-profiles/{id}` - Update profile
- `DELETE /api/isp/v1/admin/radius/bandwidth-profiles/{id}` - Delete profile

### NAS Devices

- `GET /api/isp/v1/admin/radius/nas-devices` - List devices
- `POST /api/isp/v1/admin/radius/nas-devices` - Create device
- `GET /api/isp/v1/admin/radius/nas-devices/{id}` - Get device
- `PUT /api/isp/v1/admin/radius/nas-devices/{id}` - Update device
- `DELETE /api/isp/v1/admin/radius/nas-devices/{id}` - Delete device
- `POST /api/isp/v1/admin/radius/nas-devices/{id}/test` - Test connection

## Common Workflows

### Monitor Active Sessions

```typescript
<RadiusSessionMonitor
  refreshInterval={5000}
  onSessionSelect={(session) => {
    // Show session details or disconnect
    setSelectedSession(session);
  }}
/>
```

### Disconnect Session

```typescript
const handleDisconnect = async (sessionId: string) => {
  try {
    await apiClient.post(`/api/isp/v1/admin/radius/sessions/${sessionId}/disconnect`);
    toast({
      title: "Success",
      description: "Session disconnected",
    });
    refetchSessions();
  } catch (error) {
    toast({
      title: "Error",
      description: "Failed to disconnect session",
      variant: "destructive",
    });
  }
};
```

### Create Bandwidth Profile

```typescript
// 1. Open dialog
<Button onClick={() => setShowCreateProfile(true)}>
  Create Profile
</Button>

// 2. Create profile
<BandwidthProfileDialog
  open={showCreateProfile}
  onClose={() => setShowCreateProfile(false)}
  onProfileSaved={(profile) => {
    setShowCreateProfile(false);
    toast({
      title: "Success",
      description: `Profile "${profile.name}" created`,
    });
  }}
/>
```

### Assign Profile to Subscriber

```typescript
// In subscriber provisioning
<Select
  label="Bandwidth Profile"
  value={selectedProfileId}
  onChange={(e) => setSelectedProfileId(e.target.value)}
>
  {bandwidthProfiles.map((profile) => (
    <option key={profile.id} value={profile.id}>
      {profile.name} ({profile.download_rate / 1000} / {profile.upload_rate / 1000} Mbps)
    </option>
  ))}
</Select>
```

### Change Bandwidth via CoA

```typescript
const changeBandwidth = async (sessionId: string, profileId: string) => {
  try {
    await apiClient.post(`/api/isp/v1/admin/radius/sessions/${sessionId}/coa`, {
      action: "change_bandwidth",
      profile_id: profileId,
    });
    toast({
      title: "Success",
      description: "Bandwidth updated",
    });
  } catch (error) {
    toast({
      title: "Error",
      description: "Failed to update bandwidth",
      variant: "destructive",
    });
  }
};
```

## Bandwidth Rate Limits

### Units

- **Kbps**: Kilobits per second (1000 bits/sec)
- **Mbps**: Megabits per second (1000 Kbps)
- **Gbps**: Gigabits per second (1000 Mbps)

### Conversion

```typescript
// Display conversion
function formatBandwidth(kbps: number): string {
  if (kbps >= 1000000) {
    return `${(kbps / 1000000).toFixed(2)} Gbps`;
  } else if (kbps >= 1000) {
    return `${(kbps / 1000).toFixed(2)} Mbps`;
  } else {
    return `${kbps} Kbps`;
  }
}

// Input conversion
function parseBandwidth(value: number, unit: "Kbps" | "Mbps" | "Gbps"): number {
  switch (unit) {
    case "Gbps":
      return value * 1000000;
    case "Mbps":
      return value * 1000;
    case "Kbps":
    default:
      return value;
  }
}
```

### Typical Profiles

- Residential Basic: 10/2 Mbps
- Residential Standard: 50/10 Mbps
- Residential Premium: 100/20 Mbps
- Residential Ultra: 500/100 Mbps or 1000/1000 Mbps
- Business: 100/100 Mbps or higher (symmetric)

## CoA (Change of Authorization)

CoA allows real-time session updates without reconnection.

### Supported Actions

1. **Disconnect**: Terminate session immediately
2. **Change Bandwidth**: Update rate limits
3. **Reauthenticate**: Force re-auth without disconnect
4. **Update Attributes**: Change other RADIUS attributes

### CoA Requirements

1. NAS device must support CoA (RFC 5176)
2. NAS device configured with CoA port (default 3799)
3. Shared secret must match

### CoA Testing

```typescript
// Test CoA connectivity
const testCoA = async (nasDeviceId: string) => {
  try {
    const response = await apiClient.post(`/api/isp/v1/admin/radius/nas-devices/${nasDeviceId}/test-coa`);
    if (response.data.success) {
      toast({
        title: "Success",
        description: "CoA is working",
      });
    }
  } catch (error) {
    toast({
      title: "Error",
      description: "CoA test failed",
      variant: "destructive",
    });
  }
};
```

## Troubleshooting

### Issue: Session not appearing in monitor

**Check**:

1. RADIUS server receiving accounting packets
2. NAS device properly configured
3. Accounting port correct (1813)
4. Shared secret matches
5. Database connection working

**Debug**:

```bash
# Check RADIUS logs
tail -f /var/log/radius/radius.log

# Verify accounting packets
tcpdump -i any port 1813

# Check database
SELECT * FROM radacct WHERE acctstoptime IS NULL;
```

### Issue: CoA disconnect not working

**Check**:

1. NAS device supports CoA
2. CoA port enabled (3799)
3. Firewall allows UDP 3799
4. Shared secret correct
5. Session still active

**Test**:

```bash
# Test CoA manually
echo "User-Name=testuser,Acct-Session-Id=12345" | \
  radclient -x nas.example.com:3799 disconnect testing123
```

### Issue: Bandwidth not applying

**Check**:

1. NAS device supports rate limiting
2. RADIUS attributes correct:
   - `Mikrotik-Rate-Limit` (MikroTik)
   - `Filter-Id` (Cisco)
   - `WISPr-Bandwidth-Max-Down/Up` (Generic)
3. Profile assigned to subscriber
4. Session authenticated after profile assignment

## Integration with Other Modules

### With Subscribers Module

```typescript
// Assign bandwidth profile during provisioning
import { SubscriberProvisionForm } from "@dotmac/features/provisioning";

<SubscriberProvisionForm
  bandwidthProfiles={profiles}
  onProvision={(data) => {
    // data includes bandwidth_profile_id
  }}
/>
```

### With Monitoring Module

```typescript
// Monitor bandwidth usage
import { NetworkMonitoringDashboard } from "@dotmac/features/monitoring";

<NetworkMonitoringDashboard
  includeSessionStats={true}
/>
```

### With Billing Module

```typescript
// Link usage to billing
const calculateUsage = (session: RadiusSession) => {
  const totalBytes = session.acct_input_octets + session.acct_output_octets;
  const totalGB = totalBytes / (1024 * 1024 * 1024);
  return totalGB;
};
```

## Performance Considerations

### Session Monitoring

- Default refresh: 10 seconds
- Large deployments: increase to 30-60 seconds
- Consider pagination for >1000 sessions

### Database Optimization

- Index on `acctstoptime IS NULL` for active sessions
- Archive old sessions (>30 days)
- Partition accounting table by date

## Testing

```typescript
import { render, screen, waitFor } from "@testing-library/react";
import { RadiusSessionMonitor } from "@dotmac/features/radius";

const mockApiClient = {
  get: jest.fn().mockResolvedValue({
    data: {
      sessions: [
        {
          id: "sess_1",
          username: "user@example.com",
          framed_ip_address: "100.64.0.1",
          acct_session_time: 3600,
          download_rate: 50000,
        },
      ],
    },
  }),
};

test("renders active sessions", async () => {
  render(
    <RadiusSessionMonitor
      apiClient={mockApiClient}
      useToast={() => ({ toast: jest.fn() })}
    />
  );

  await waitFor(() => {
    expect(screen.getByText("user@example.com")).toBeInTheDocument();
    expect(screen.getByText("100.64.0.1")).toBeInTheDocument();
  });
});
```

## Related Modules

- **subscribers**: Subscriber management and profile assignment
- **monitoring**: Real-time bandwidth monitoring
- **billing**: Usage-based billing
- **network**: Network device integration

## Contributing

When adding RADIUS components:

1. Handle large session counts efficiently
2. Support both IPv4 and IPv6
3. Include CoA support
4. Validate bandwidth values
5. Format rates consistently (Mbps display)
6. Test with different NAS vendors
7. Document RADIUS attributes used
