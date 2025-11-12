# Network Profile UI & API Integration Guide

This document explains how to integrate the network profile management UI and API into your subscriber pages and admin dashboards.

## 📋 Overview

The network profile management system provides:

- **GraphQL API** for querying and mutating network profiles
- **REST API** for CRUD operations on network profiles
- **React Components** for viewing and editing network profiles
- **Alert System** for Option 82 mismatches

## 🎯 Architecture

### Backend Components

1. **GraphQL Types** (`src/dotmac/platform/graphql/types/network_profile.py`)
   - `NetworkProfile` - Main profile type
   - `NetworkProfileInput` - Input for mutations
   - `NetworkProfileStats` - Aggregated statistics
   - `Option82Alert` - Alert type for mismatches

2. **GraphQL Queries & Mutations** (`src/dotmac/platform/graphql/queries/network_profile.py`)
   - `networkProfile(subscriberId)` - Get profile for subscriber
   - `networkProfileStats()` - Get tenant statistics
   - `option82Alerts()` - Get active alerts
   - `upsertNetworkProfile()` - Create/update profile
   - `deleteNetworkProfile()` - Delete profile

3. **REST API** (`src/dotmac/platform/network/router.py`)
   - `GET /api/v1/network/subscribers/{subscriber_id}/profile`
   - `PUT /api/v1/network/subscribers/{subscriber_id}/profile`
   - `DELETE /api/v1/network/subscribers/{subscriber_id}/profile`

### Frontend Components

1. **NetworkProfileCard.tsx** - Display network profile information
2. **NetworkProfileEditDialog.tsx** - Edit/create network profiles
3. **Option82AlertBanner.tsx** - Display Option 82 mismatch alerts

## 🚀 Quick Start

### 1. Add Network Profile to Subscriber Detail Page

Update your subscriber detail page (e.g., `app/dashboard/subscribers/[id]/page.tsx`):

```tsx
import { NetworkProfileCard } from "@/components/subscribers/NetworkProfileCard";
import { SubscriberAlertsBanner } from "@/components/subscribers/SubscriberAlertsBanner";

export default function SubscriberDetailPage({ params }: { params: { id: string } }) {
  // Fetch network profile using GraphQL or REST
  const { data: profileData } = useQuery({
    queryKey: ["networkProfile", params.id],
    queryFn: async () => {
      const response = await fetch(
        `/api/v1/network/subscribers/${params.id}/profile`
      );
      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error("Failed to fetch network profile");
      }
      return response.json();
    },
  });

  // Fetch Option 82 alerts
  const { data: alertsData } = useQuery({
    queryKey: ["option82Alerts", params.id],
    queryFn: async () => {
      // Implement GraphQL query or REST endpoint for alerts
      return [];
    },
  });

  return (
    <div className="space-y-6">
      {/* Show alerts at the top */}
      <SubscriberAlertsBanner alerts={alertsData?.subscriberAlerts || []} />

      {/* Subscriber basic info */}
      <SubscriberInfoCard subscriber={subscriber} />

      {/* Network Profile Card */}
      <NetworkProfileCard
        profile={profileData}
        subscriberId={params.id}
        onUpdate={() => {
          // Refetch data after update
          queryClient.invalidateQueries(["networkProfile", params.id]);
        }}
      />

      {/* Other subscriber information... */}
    </div>
  );
}
```

### 2. Using GraphQL (Recommended)

First, generate TypeScript types from the GraphQL schema:

```bash
pnpm graphql:codegen
```

Then use the generated hooks:

```tsx
import { useGetNetworkProfileQuery, useUpsertNetworkProfileMutation } from "@/lib/graphql/generated";

function SubscriberNetworkSection({ subscriberId }: { subscriberId: string }) {
  const { data, loading, refetch } = useGetNetworkProfileQuery({
    variables: { subscriberId },
  });

  const [upsertProfile] = useUpsertNetworkProfileMutation();

  const handleUpdate = async (profileInput: NetworkProfileInput) => {
    await upsertProfile({
      variables: {
        subscriberId,
        profile: profileInput,
      },
    });
    await refetch();
  };

  return (
    <NetworkProfileCard
      profile={data?.networkProfile}
      subscriberId={subscriberId}
      onUpdate={refetch}
      isLoading={loading}
    />
  );
}
```

### 3. Add to Admin Dashboard

Create a network profiles overview page:

```tsx
// app/dashboard/network/profiles/page.tsx
import { useGetNetworkProfileStatsQuery } from "@/lib/graphql/generated";

export default function NetworkProfilesPage() {
  const { data } = useGetNetworkProfileStatsQuery();

  return (
    <div className="space-y-6">
      <h1>Network Profiles Overview</h1>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-4">
        <StatCard title="Total Profiles" value={stats.totalProfiles} />
        <StatCard title="Static IPv4" value={stats.profilesWithStaticIpv4} />
        <StatCard title="Static IPv6" value={stats.profilesWithStaticIpv6} />
        <StatCard title="Dual Stack" value={stats.dualStackProfiles} />
        <StatCard title="VLAN Enabled" value={stats.profilesWithVlans} />
        <StatCard title="QinQ Enabled" value={stats.profilesWithQinq} />
        <StatCard title="Option 82 Bindings" value={stats.profilesWithOption82} />
        <StatCard title="NetBox Tracked" value={stats.netboxTrackedProfiles} />
      </div>

      <IPv6LifecyclePanel data={ipv6LifecycleStats} />
    </div>
  );
}
```

The `IPv6LifecyclePanel` can show allocated/active/suspended/revoked counts along with activation/utilization/NetBox percentages sourced from `GET /api/v1/network/ipv6/stats`.

## 🔔 Subscriber Alert System

IPv6, Option 82, and authentication alerts now share a single banner component:

```tsx
<SubscriberAlertsBanner alerts={alerts} />
```

`SubscriberAlertsBanner` automatically groups alerts by severity, shows per-type badges (e.g., `OPTION_82`, `AUTH_FAILURE`), and works with the `/api/v1/radius/subscribers/{id}/alerts` payload that includes `severity`, `title`, `message`, and `count`.

Backend alert generation still follows the option-82 mismatch workflow, but the alert schema now supports multiple categories. Update any custom integrations to populate the `severity` and `type` fields so the UI can color-code correctly.

## 📊 Network Profile Fields

### VLAN Configuration

| Field | Type | Description |
|-------|------|-------------|
| `serviceVlan` | `int` | Primary service VLAN (S-VLAN), range 1-4094 |
| `innerVlan` | `int` | Inner VLAN for QinQ (C-VLAN), range 1-4094 |
| `vlanPool` | `string` | Named VLAN pool identifier |
| `qinqEnabled` | `boolean` | Enable 802.1ad QinQ tagging |

### IP Addressing

| Field | Type | Description |
|-------|------|-------------|
| `staticIpv4` | `string` | Static IPv4 address (e.g., "10.0.0.100") |
| `staticIpv6` | `string` | Static IPv6 address (e.g., "2001:db8::1") |
| `delegatedIpv6Prefix` | `string` | IPv6 prefix in CIDR notation (e.g., "2001:db8::/56") |
| `ipv6PdSize` | `int` | Prefix delegation size (0-128) |
| `ipv6AssignmentMode` | `enum` | IPv6 assignment mode: `none`, `slaac`, `stateful`, `pd`, `dual_stack` |

### Option 82 Configuration

| Field | Type | Description |
|-------|------|-------------|
| `circuitId` | `string` | DHCP Option 82 circuit-id (e.g., "OLT1:1/1/1") |
| `remoteId` | `string` | DHCP Option 82 remote-id (e.g., "OLT1") |
| `option82Policy` | `enum` | Enforcement policy: `enforce`, `log`, `ignore` |

## 🔒 Option 82 Policies

### Enforce
- **Behavior**: Block DHCP sessions if Option 82 doesn't match
- **Use Case**: Strict security requirements, prevent unauthorized connections
- **Alert**: Creates critical alerts on mismatch

### Log
- **Behavior**: Allow sessions but log mismatches
- **Use Case**: Monitoring and auditing, gradual enforcement
- **Alert**: Creates warning alerts on mismatch

### Ignore
- **Behavior**: No validation of Option 82 values
- **Use Case**: Open networks, legacy equipment
- **Alert**: No alerts generated

## 🧪 Testing

Run the network profile tests:

```bash
# Backend tests
poetry run pytest tests/network -v

# Frontend component tests (if using testing-library)
pnpm test NetworkProfileCard
pnpm test NetworkProfileEditDialog
```

## 📝 Example Use Cases

### 1. Fiber Subscriber with GPON OLT

```tsx
const fiberProfile = {
  circuitId: "OLT-FIBER-01:1/1/8",
  remoteId: "OLT-FIBER-01",
  serviceVlan: 1000,
  innerVlan: 100,
  qinqEnabled: true,
  staticIpv4: "10.20.30.100",
  delegatedIpv6Prefix: "2001:db8:1000::/56",
  ipv6AssignmentMode: "pd",
  option82Policy: "enforce",
};
```

### 2. Business Customer with Static IPs

```tsx
const businessProfile = {
  serviceVlan: 2000,
  staticIpv4: "203.0.113.50",
  staticIpv6: "2001:db8:2000::50",
  ipv6AssignmentMode: "dual_stack",
  option82Policy: "log",
};
```

### 3. Residential Customer with Dynamic Assignment

```tsx
const residentialProfile = {
  serviceVlan: 3000,
  ipv6AssignmentMode: "slaac",
  option82Policy: "ignore",
};
```

## 🚨 Troubleshooting

### Profile Not Appearing

1. Check that the subscriber exists in the database
2. Verify tenant_id matches
3. Check browser console for API errors
4. Verify GraphQL schema is up to date: `pnpm graphql:codegen`

### Option 82 Alerts Not Showing

1. Ensure alerts are being created in the backend
2. Check alert query is fetching for the correct subscriber
3. Verify WebSocket connection for real-time updates
4. Check alert filtering (activeOnly parameter)

### VLAN Validation Errors

1. Ensure VLAN IDs are in range 1-4094
2. Check that S-VLAN and C-VLAN are different if QinQ is enabled
3. Verify VLAN pool exists if specified

## 📚 Additional Resources

- [GraphQL Schema Documentation](./graphql-schema.md)
- [RADIUS Integration Guide](./RADIUS_INTEGRATION.md)
- [Network Monitoring Setup](./NETWORK_MONITORING.md)
- [Multi-Vendor RADIUS Support](./MULTI_VENDOR_RADIUS.md)

## 🤝 Contributing

When adding new network profile features:

1. Add fields to the database model in `src/dotmac/platform/network/models.py`
2. Create migration with Alembic
3. Update GraphQL types in `types/network_profile.py`
4. Update REST schemas in `network/schemas.py`
5. Add UI fields to `NetworkProfileEditDialog.tsx`
6. Update this documentation

## 📞 Support

For issues or questions:
- File an issue in the repository
- Contact the platform team
- Check existing documentation in `docs/`
