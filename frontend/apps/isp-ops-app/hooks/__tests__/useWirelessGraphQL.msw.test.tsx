/**
 * MSW Tests for useWirelessGraphQL hooks
 * Tests wireless network management with realistic GraphQL API mocking
 */

// Mock platformConfig to provide GraphQL endpoint
jest.mock('@/lib/config', () => ({
  platformConfig: {
    api: {
      baseUrl: 'http://localhost:3000',
      prefix: '/api/v1',
      timeout: 30000,
      buildUrl: (path: string) => `http://localhost:3000/api/v1${path}`,
      graphqlEndpoint: 'http://localhost:3000/api/v1/graphql',
    },
  },
}));

import { renderHook, waitFor } from '@testing-library/react';
import { graphql, HttpResponse } from 'msw';
import { createApolloWrapper } from '@/__tests__/test-utils';
import { server } from '@/__tests__/msw/server';
import {
  useAccessPointListGraphQL,
  useAccessPointDetailGraphQL,
  useAccessPointsBySiteGraphQL,
  useWirelessClientListGraphQL,
  useWirelessClientDetailGraphQL,
  useWirelessClientsByAccessPointGraphQL,
  useWirelessClientsByCustomerGraphQL,
  useCoverageZoneListGraphQL,
  useCoverageZoneDetailGraphQL,
  useCoverageZonesBySiteGraphQL,
  useRfAnalyticsGraphQL,
  useChannelUtilizationGraphQL,
  useWirelessSiteMetricsGraphQL,
  useWirelessDashboardGraphQL,
  calculateSignalQuality,
  getSignalQualityLabel,
  getFrequencyBandLabel,
} from '../useWirelessGraphQL';
import {
  seedAccessPoints,
  seedWirelessClients,
  seedCoverageZones,
  clearWirelessData,
} from '@/__tests__/msw/handlers/graphql-wireless';
import { AccessPointStatus, FrequencyBand } from '@/lib/graphql/generated';

describe('useWirelessGraphQL', () => {
  beforeEach(() => {
    clearWirelessData();
  });

  // ============================================================================
  // Access Point Tests
  // ============================================================================

  describe('Access Point Hooks', () => {
    describe('useAccessPointListGraphQL', () => {
      it('should fetch access points successfully', async () => {
        seedAccessPoints([
          { id: 'ap-1', name: 'AP One', status: AccessPointStatus.Online },
          { id: 'ap-2', name: 'AP Two', status: AccessPointStatus.Online },
        ]);

        const { result } = renderHook(() => useAccessPointListGraphQL(), {
          wrapper: createApolloWrapper(),
        });

        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.accessPoints).toHaveLength(2);
        expect(result.current.total).toBe(2);
        expect(result.current.hasNextPage).toBe(false);
      });

      it('should filter access points by status', async () => {
        seedAccessPoints([
          { id: 'ap-1', status: AccessPointStatus.Online },
          { id: 'ap-2', status: AccessPointStatus.Offline },
          { id: 'ap-3', status: AccessPointStatus.Online },
        ]);

        const { result } = renderHook(
          () => useAccessPointListGraphQL({ status: AccessPointStatus.Online }),
          { wrapper: createApolloWrapper() }
        );

        await waitFor(() => expect(result.current.loading).toBe(false));

        expect(result.current.accessPoints).toHaveLength(2);
        expect(result.current.accessPoints.every(ap => ap.status === AccessPointStatus.Online)).toBe(true);
      });

      it('should filter access points by site', async () => {
        seedAccessPoints([
          { id: 'ap-1', siteId: 'site-1' },
          { id: 'ap-2', siteId: 'site-2' },
          { id: 'ap-3', siteId: 'site-1' },
        ]);

        const { result } = renderHook(
          () => useAccessPointListGraphQL({ siteId: 'site-1' }),
          { wrapper: createApolloWrapper() }
        );

        await waitFor(() => expect(result.current.loading).toBe(false));

        expect(result.current.accessPoints).toHaveLength(2);
        expect(result.current.accessPoints.every(ap => ap.siteId === 'site-1')).toBe(true);
      });

      it('should support pagination', async () => {
        seedAccessPoints(
          Array.from({ length: 25 }, (_, i) => ({
            id: `ap-${i + 1}`,
            name: `AP ${i + 1}`,
          }))
        );

        const { result } = renderHook(
          () => useAccessPointListGraphQL({ limit: 10, offset: 0 }),
          { wrapper: createApolloWrapper() }
        );

        await waitFor(() => expect(result.current.loading).toBe(false));

        expect(result.current.accessPoints).toHaveLength(10);
        expect(result.current.total).toBe(25);
        expect(result.current.hasNextPage).toBe(true);
      });

      it('should support search filtering', async () => {
        seedAccessPoints([
          { id: 'ap-1', name: 'Main Office AP', macAddress: 'AA:BB:CC:DD:EE:01' },
          { id: 'ap-2', name: 'Branch Office AP', macAddress: 'AA:BB:CC:DD:EE:02' },
          { id: 'ap-3', name: 'Data Center AP', macAddress: 'AA:BB:CC:DD:EE:03' },
        ]);

        const { result } = renderHook(
          () => useAccessPointListGraphQL({ search: 'Office' }),
          { wrapper: createApolloWrapper() }
        );

        await waitFor(() => expect(result.current.loading).toBe(false));

        expect(result.current.accessPoints).toHaveLength(2);
      });

      it('should respect enabled flag', () => {
        const { result } = renderHook(
          () => useAccessPointListGraphQL({ enabled: false }),
          { wrapper: createApolloWrapper() }
        );

        expect(result.current.loading).toBe(false);
      });
    });

    describe('useAccessPointDetailGraphQL', () => {
      it('should fetch single access point successfully', async () => {
        seedAccessPoints([
          {
            id: 'ap-123',
            name: 'Test AP',
            macAddress: 'AA:BB:CC:DD:EE:FF',
            status: AccessPointStatus.Online,
          },
        ]);

        const { result } = renderHook(
          () => useAccessPointDetailGraphQL({ id: 'ap-123' }),
          { wrapper: createApolloWrapper() }
        );

        await waitFor(() => expect(result.current.loading).toBe(false));

        expect(result.current.accessPoint).not.toBeNull();
        expect(result.current.accessPoint?.id).toBe('ap-123');
        expect(result.current.accessPoint?.name).toBe('Test AP');
      });

      it('should return null for non-existent access point', async () => {
        seedAccessPoints([{ id: 'ap-1' }]);

        const { result } = renderHook(
          () => useAccessPointDetailGraphQL({ id: 'ap-999' }),
          { wrapper: createApolloWrapper() }
        );

        await waitFor(() => expect(result.current.loading).toBe(false));

        expect(result.current.accessPoint).toBeNull();
      });

      it('should not fetch when enabled is false', () => {
        const { result } = renderHook(
          () => useAccessPointDetailGraphQL({ id: 'ap-123', enabled: false }),
          { wrapper: createApolloWrapper() }
        );

        expect(result.current.loading).toBe(false);
      });
    });

    describe('useAccessPointsBySiteGraphQL', () => {
      it('should fetch access points for a specific site', async () => {
        seedAccessPoints([
          { id: 'ap-1', siteId: 'site-1', siteName: 'Main Site' },
          { id: 'ap-2', siteId: 'site-1', siteName: 'Main Site' },
          { id: 'ap-3', siteId: 'site-2', siteName: 'Branch Site' },
        ]);

        const { result } = renderHook(
          () => useAccessPointsBySiteGraphQL({ siteId: 'site-1' }),
          { wrapper: createApolloWrapper() }
        );

        await waitFor(() => expect(result.current.loading).toBe(false));

        expect(result.current.accessPoints).toHaveLength(2);
        expect(result.current.accessPoints.every(ap => ap.siteId === 'site-1')).toBe(true);
      });
    });
  });

  // ============================================================================
  // Wireless Client Tests
  // ============================================================================

  describe('Wireless Client Hooks', () => {
    describe('useWirelessClientListGraphQL', () => {
      it('should fetch wireless clients successfully', async () => {
        seedWirelessClients([
          { id: 'client-1', hostname: 'laptop-1' },
          { id: 'client-2', hostname: 'laptop-2' },
        ]);

        const { result } = renderHook(() => useWirelessClientListGraphQL(), {
          wrapper: createApolloWrapper(),
        });

        await waitFor(() => expect(result.current.loading).toBe(false));

        expect(result.current.clients).toHaveLength(2);
        expect(result.current.total).toBe(2);
        expect(result.current.hasNextPage).toBe(false);
      });

      it('should filter clients by access point', async () => {
        seedWirelessClients([
          { id: 'client-1', accessPointId: 'ap-1' },
          { id: 'client-2', accessPointId: 'ap-2' },
          { id: 'client-3', accessPointId: 'ap-1' },
        ]);

        const { result } = renderHook(
          () => useWirelessClientListGraphQL({ accessPointId: 'ap-1' }),
          { wrapper: createApolloWrapper() }
        );

        await waitFor(() => expect(result.current.loading).toBe(false));

        expect(result.current.clients).toHaveLength(2);
        expect(result.current.clients.every(c => c.accessPointId === 'ap-1')).toBe(true);
      });

      it('should filter clients by customer', async () => {
        seedWirelessClients([
          { id: 'client-1', customerId: 'customer-1' },
          { id: 'client-2', customerId: 'customer-2' },
          { id: 'client-3', customerId: 'customer-1' },
        ]);

        const { result } = renderHook(
          () => useWirelessClientListGraphQL({ customerId: 'customer-1' }),
          { wrapper: createApolloWrapper() }
        );

        await waitFor(() => expect(result.current.loading).toBe(false));

        expect(result.current.clients).toHaveLength(2);
        expect(result.current.clients.every(c => c.customerId === 'customer-1')).toBe(true);
      });

      it('should filter clients by frequency band', async () => {
        seedWirelessClients([
          { id: 'client-1', frequencyBand: FrequencyBand.Band_5Ghz },
          { id: 'client-2', frequencyBand: FrequencyBand.Band_2_4Ghz },
          { id: 'client-3', frequencyBand: FrequencyBand.Band_5Ghz },
        ]);

        const { result } = renderHook(
          () => useWirelessClientListGraphQL({ frequencyBand: FrequencyBand.Band_5Ghz }),
          { wrapper: createApolloWrapper() }
        );

        await waitFor(() => expect(result.current.loading).toBe(false));

        expect(result.current.clients).toHaveLength(2);
        expect(result.current.clients.every(c => c.frequencyBand === FrequencyBand.Band_5Ghz)).toBe(true);
      });

      it('should support pagination', async () => {
        seedWirelessClients(
          Array.from({ length: 30 }, (_, i) => ({
            id: `client-${i + 1}`,
            hostname: `device-${i + 1}`,
          }))
        );

        const { result } = renderHook(
          () => useWirelessClientListGraphQL({ limit: 10, offset: 0 }),
          { wrapper: createApolloWrapper() }
        );

        await waitFor(() => expect(result.current.loading).toBe(false));

        expect(result.current.clients).toHaveLength(10);
        expect(result.current.total).toBe(30);
        expect(result.current.hasNextPage).toBe(true);
      });

      it('should support search filtering', async () => {
        seedWirelessClients([
          { id: 'client-1', hostname: 'johns-laptop', macAddress: 'AA:BB:CC:DD:EE:01' },
          { id: 'client-2', hostname: 'janes-phone', macAddress: 'AA:BB:CC:DD:EE:02' },
          { id: 'client-3', hostname: 'johns-phone', macAddress: 'AA:BB:CC:DD:EE:03' },
        ]);

        const { result } = renderHook(
          () => useWirelessClientListGraphQL({ search: 'john' }),
          { wrapper: createApolloWrapper() }
        );

        await waitFor(() => expect(result.current.loading).toBe(false));

        expect(result.current.clients).toHaveLength(2);
      });
    });

    describe('useWirelessClientDetailGraphQL', () => {
      it('should fetch single wireless client successfully', async () => {
        seedWirelessClients([
          {
            id: 'client-123',
            hostname: 'test-device',
            macAddress: 'AA:BB:CC:DD:EE:FF',
            signalStrengthDbm: -55,
          },
        ]);

        const { result } = renderHook(
          () => useWirelessClientDetailGraphQL({ id: 'client-123' }),
          { wrapper: createApolloWrapper() }
        );

        await waitFor(() => expect(result.current.loading).toBe(false));

        expect(result.current.client).not.toBeNull();
        expect(result.current.client?.id).toBe('client-123');
        expect(result.current.client?.hostname).toBe('test-device');
      });

      it('should return null for non-existent client', async () => {
        seedWirelessClients([{ id: 'client-1' }]);

        const { result } = renderHook(
          () => useWirelessClientDetailGraphQL({ id: 'client-999' }),
          { wrapper: createApolloWrapper() }
        );

        await waitFor(() => expect(result.current.loading).toBe(false));

        expect(result.current.client).toBeNull();
      });
    });

    describe('useWirelessClientsByAccessPointGraphQL', () => {
      it('should fetch clients for a specific access point', async () => {
        seedWirelessClients([
          { id: 'client-1', accessPointId: 'ap-1' },
          { id: 'client-2', accessPointId: 'ap-1' },
          { id: 'client-3', accessPointId: 'ap-2' },
        ]);

        const { result } = renderHook(
          () => useWirelessClientsByAccessPointGraphQL({ accessPointId: 'ap-1' }),
          { wrapper: createApolloWrapper() }
        );

        await waitFor(() => expect(result.current.loading).toBe(false));

        expect(result.current.clients).toHaveLength(2);
        expect(result.current.clients.every(c => c.accessPointId === 'ap-1')).toBe(true);
      });
    });

    describe('useWirelessClientsByCustomerGraphQL', () => {
      it('should fetch clients for a specific customer', async () => {
        seedWirelessClients([
          { id: 'client-1', customerId: 'customer-1' },
          { id: 'client-2', customerId: 'customer-1' },
          { id: 'client-3', customerId: 'customer-2' },
        ]);

        const { result } = renderHook(
          () => useWirelessClientsByCustomerGraphQL({ customerId: 'customer-1' }),
          { wrapper: createApolloWrapper() }
        );

        await waitFor(() => expect(result.current.loading).toBe(false));

        expect(result.current.clients).toHaveLength(2);
        expect(result.current.clients.every(c => c.customerId === 'customer-1')).toBe(true);
      });
    });
  });

  // ============================================================================
  // Coverage Zone Tests
  // ============================================================================

  describe('Coverage Zone Hooks', () => {
    describe('useCoverageZoneListGraphQL', () => {
      it('should fetch coverage zones successfully', async () => {
        seedCoverageZones([
          { id: 'zone-1', name: 'Zone One' },
          { id: 'zone-2', name: 'Zone Two' },
        ]);

        const { result } = renderHook(() => useCoverageZoneListGraphQL(), {
          wrapper: createApolloWrapper(),
        });

        await waitFor(() => expect(result.current.loading).toBe(false));

        expect(result.current.zones).toHaveLength(2);
        expect(result.current.total).toBe(2);
        expect(result.current.hasNextPage).toBe(false);
      });

      it('should filter zones by site', async () => {
        seedCoverageZones([
          { id: 'zone-1', siteId: 'site-1' },
          { id: 'zone-2', siteId: 'site-2' },
          { id: 'zone-3', siteId: 'site-1' },
        ]);

        const { result } = renderHook(
          () => useCoverageZoneListGraphQL({ siteId: 'site-1' }),
          { wrapper: createApolloWrapper() }
        );

        await waitFor(() => expect(result.current.loading).toBe(false));

        expect(result.current.zones).toHaveLength(2);
        expect(result.current.zones.every(z => z.siteId === 'site-1')).toBe(true);
      });

      it('should support pagination', async () => {
        seedCoverageZones(
          Array.from({ length: 20 }, (_, i) => ({
            id: `zone-${i + 1}`,
            name: `Zone ${i + 1}`,
          }))
        );

        const { result } = renderHook(
          () => useCoverageZoneListGraphQL({ limit: 10, offset: 0 }),
          { wrapper: createApolloWrapper() }
        );

        await waitFor(() => expect(result.current.loading).toBe(false));

        expect(result.current.zones).toHaveLength(10);
        expect(result.current.total).toBe(20);
        expect(result.current.hasNextPage).toBe(true);
      });
    });

    describe('useCoverageZoneDetailGraphQL', () => {
      it('should fetch single coverage zone successfully', async () => {
        seedCoverageZones([
          {
            id: 'zone-123',
            name: 'Test Zone',
            coverageAreaSqm: 500,
          },
        ]);

        const { result } = renderHook(
          () => useCoverageZoneDetailGraphQL({ id: 'zone-123' }),
          { wrapper: createApolloWrapper() }
        );

        await waitFor(() => expect(result.current.loading).toBe(false));

        expect(result.current.zone).not.toBeNull();
        expect(result.current.zone?.id).toBe('zone-123');
        expect(result.current.zone?.name).toBe('Test Zone');
      });

      it('should return null for non-existent zone', async () => {
        seedCoverageZones([{ id: 'zone-1' }]);

        const { result } = renderHook(
          () => useCoverageZoneDetailGraphQL({ id: 'zone-999' }),
          { wrapper: createApolloWrapper() }
        );

        await waitFor(() => expect(result.current.loading).toBe(false));

        expect(result.current.zone).toBeNull();
      });
    });

    describe('useCoverageZonesBySiteGraphQL', () => {
      it('should fetch zones for a specific site', async () => {
        seedCoverageZones([
          { id: 'zone-1', siteId: 'site-1' },
          { id: 'zone-2', siteId: 'site-1' },
          { id: 'zone-3', siteId: 'site-2' },
        ]);

        const { result } = renderHook(
          () => useCoverageZonesBySiteGraphQL({ siteId: 'site-1' }),
          { wrapper: createApolloWrapper() }
        );

        await waitFor(() => expect(result.current.loading).toBe(false));

        expect(result.current.zones).toHaveLength(2);
        expect(result.current.zones.every(z => z.siteId === 'site-1')).toBe(true);
      });
    });
  });

  // ============================================================================
  // Analytics & Metrics Tests
  // ============================================================================

  describe('Analytics and Metrics Hooks', () => {
    describe('useRfAnalyticsGraphQL', () => {
      it('should fetch RF analytics for a site', async () => {
        const { result } = renderHook(
          () => useRfAnalyticsGraphQL({ siteId: 'site-1' }),
          { wrapper: createApolloWrapper() }
        );

        await waitFor(() => expect(result.current.loading).toBe(false));

        expect(result.current.analytics).not.toBeNull();
        expect(result.current.analytics?.siteId).toBe('site-1');
        expect(result.current.analytics?.recommendedChannels24ghz).toBeDefined();
        expect(result.current.analytics?.recommendedChannels5ghz).toBeDefined();
        expect(result.current.analytics?.recommendedChannels6ghz).toBeDefined();
      });

      it('should not fetch when enabled is false', () => {
        const { result } = renderHook(
          () => useRfAnalyticsGraphQL({ siteId: 'site-1', enabled: false }),
          { wrapper: createApolloWrapper() }
        );

        expect(result.current.loading).toBe(false);
      });
    });

    describe('useChannelUtilizationGraphQL', () => {
      it('should fetch channel utilization for 2.4 GHz band', async () => {
        const { result } = renderHook(
          () =>
            useChannelUtilizationGraphQL({
              siteId: 'site-1',
              band: FrequencyBand.Band_2_4Ghz,
            }),
          { wrapper: createApolloWrapper() }
        );

        await waitFor(() => expect(result.current.loading).toBe(false));

        expect(result.current.channelUtilization).toBeDefined();
        expect(result.current.channelUtilization.length).toBeGreaterThan(0);
        expect(result.current.channelUtilization[0].band).toBe(FrequencyBand.Band_2_4Ghz);
      });

      it('should fetch channel utilization for 5 GHz band', async () => {
        const { result } = renderHook(
          () =>
            useChannelUtilizationGraphQL({
              siteId: 'site-1',
              band: FrequencyBand.Band_5Ghz,
            }),
          { wrapper: createApolloWrapper() }
        );

        await waitFor(() => expect(result.current.loading).toBe(false));

        expect(result.current.channelUtilization).toBeDefined();
        expect(result.current.channelUtilization.length).toBeGreaterThan(0);
        expect(result.current.channelUtilization[0].band).toBe(FrequencyBand.Band_5Ghz);
      });

      it('should fetch channel utilization for 6 GHz band', async () => {
        const { result } = renderHook(
          () =>
            useChannelUtilizationGraphQL({
              siteId: 'site-1',
              band: FrequencyBand.Band_6Ghz,
            }),
          { wrapper: createApolloWrapper() }
        );

        await waitFor(() => expect(result.current.loading).toBe(false));

        expect(result.current.channelUtilization).toBeDefined();
        expect(result.current.channelUtilization.length).toBeGreaterThan(0);
        expect(result.current.channelUtilization[0].band).toBe(FrequencyBand.Band_6Ghz);
      });

      it('should not fetch when band is not provided', () => {
        const { result } = renderHook(
          () =>
            useChannelUtilizationGraphQL({
              siteId: 'site-1',
              band: undefined,
            }),
          { wrapper: createApolloWrapper() }
        );

        expect(result.current.loading).toBe(false);
      });
    });

    describe('useWirelessSiteMetricsGraphQL', () => {
      it('should fetch site metrics successfully', async () => {
        const { result } = renderHook(
          () => useWirelessSiteMetricsGraphQL({ siteId: 'site-1' }),
          { wrapper: createApolloWrapper() }
        );

        await waitFor(() => expect(result.current.loading).toBe(false));

        expect(result.current.metrics).not.toBeNull();
        expect(result.current.metrics?.siteId).toBe('site-1');
        expect(result.current.metrics?.totalAps).toBeDefined();
        expect(result.current.metrics?.totalClients).toBeDefined();
      });
    });

    describe('useWirelessDashboardGraphQL', () => {
      it('should fetch wireless dashboard successfully', async () => {
        // Seed some access points for the dashboard
        seedAccessPoints([
          { id: 'ap-1', status: AccessPointStatus.Online },
          { id: 'ap-2', status: AccessPointStatus.Online },
          { id: 'ap-3', status: AccessPointStatus.Offline },
        ]);

        const { result } = renderHook(() => useWirelessDashboardGraphQL(), {
          wrapper: createApolloWrapper(),
        });

        await waitFor(() => expect(result.current.loading).toBe(false));

        expect(result.current.dashboard).not.toBeNull();
        expect(result.current.dashboard?.totalAccessPoints).toBeDefined();
        expect(result.current.dashboard?.totalClients).toBeDefined();
        expect(result.current.dashboard?.totalSites).toBeDefined();
        expect(result.current.dashboard?.onlineAps).toBeDefined();
        expect(result.current.dashboard?.offlineAps).toBeDefined();
      });

      it('should not fetch when enabled is false', () => {
        const { result } = renderHook(
          () => useWirelessDashboardGraphQL({ enabled: false }),
          { wrapper: createApolloWrapper() }
        );

        expect(result.current.loading).toBe(false);
      });
    });
  });

  // ============================================================================
  // Utility Function Tests
  // ============================================================================

  describe('Utility Functions', () => {
    describe('calculateSignalQuality', () => {
      it('should return 100 for excellent signal (-30 dBm or better)', () => {
        expect(calculateSignalQuality(-30)).toBe(100);
        expect(calculateSignalQuality(-25)).toBe(100);
        expect(calculateSignalQuality(-20)).toBe(100);
      });

      it('should return 0 for poor signal (-90 dBm or worse)', () => {
        expect(calculateSignalQuality(-90)).toBe(0);
        expect(calculateSignalQuality(-95)).toBe(0);
        expect(calculateSignalQuality(-100)).toBe(0);
      });

      it('should calculate percentage for mid-range signals', () => {
        expect(calculateSignalQuality(-50)).toBe(67); // Good signal
        expect(calculateSignalQuality(-60)).toBe(50); // Fair signal
        expect(calculateSignalQuality(-70)).toBe(33); // Weak signal
      });

      it('should return 0 for null or undefined', () => {
        expect(calculateSignalQuality(null)).toBe(0);
        expect(calculateSignalQuality(undefined)).toBe(0);
      });
    });

    describe('getSignalQualityLabel', () => {
      it('should return "Excellent" for strong signals', () => {
        expect(getSignalQualityLabel(-40)).toBe('Excellent');
        expect(getSignalQualityLabel(-45)).toBe('Excellent');
        expect(getSignalQualityLabel(-50)).toBe('Excellent');
      });

      it('should return "Good" for good signals', () => {
        expect(getSignalQualityLabel(-55)).toBe('Good');
        expect(getSignalQualityLabel(-60)).toBe('Good');
      });

      it('should return "Fair" for fair signals', () => {
        expect(getSignalQualityLabel(-65)).toBe('Fair');
        expect(getSignalQualityLabel(-70)).toBe('Fair');
      });

      it('should return "Poor" for weak signals', () => {
        expect(getSignalQualityLabel(-75)).toBe('Poor');
        expect(getSignalQualityLabel(-80)).toBe('Poor');
        expect(getSignalQualityLabel(-90)).toBe('Poor');
      });

      it('should return "Unknown" for null or undefined', () => {
        expect(getSignalQualityLabel(null)).toBe('Unknown');
        expect(getSignalQualityLabel(undefined)).toBe('Unknown');
      });
    });

    describe('getFrequencyBandLabel', () => {
      it('should return "2.4 GHz" for 2.4 GHz band', () => {
        expect(getFrequencyBandLabel(FrequencyBand.Band_2_4Ghz)).toBe('2.4 GHz');
      });

      it('should return "5 GHz" for 5 GHz band', () => {
        expect(getFrequencyBandLabel(FrequencyBand.Band_5Ghz)).toBe('5 GHz');
      });

      it('should return "6 GHz" for 6 GHz band', () => {
        expect(getFrequencyBandLabel(FrequencyBand.Band_6Ghz)).toBe('6 GHz');
      });

      it('should return "Unknown" for null or undefined', () => {
        expect(getFrequencyBandLabel(null)).toBe('Unknown');
        expect(getFrequencyBandLabel(undefined)).toBe('Unknown');
      });
    });
  });

  // ============================================================================
  // Real-World Scenario Tests
  // ============================================================================

  describe('Real-World Scenarios', () => {
    it('should handle dashboard to site drill-down workflow', async () => {
      // Seed data for a realistic scenario
      seedAccessPoints([
        { id: 'ap-1', siteId: 'site-1', status: AccessPointStatus.Online },
        { id: 'ap-2', siteId: 'site-1', status: AccessPointStatus.Online },
        { id: 'ap-3', siteId: 'site-2', status: AccessPointStatus.Degraded },
      ]);

      // Step 1: View dashboard
      const { result: dashboardResult } = renderHook(
        () => useWirelessDashboardGraphQL(),
        { wrapper: createApolloWrapper() }
      );

      await waitFor(() => expect(dashboardResult.current.loading).toBe(false));
      expect(dashboardResult.current.dashboard).not.toBeNull();

      // Step 2: Drill into site metrics
      const { result: siteMetricsResult } = renderHook(
        () => useWirelessSiteMetricsGraphQL({ siteId: 'site-1' }),
        { wrapper: createApolloWrapper() }
      );

      await waitFor(() => expect(siteMetricsResult.current.loading).toBe(false));
      expect(siteMetricsResult.current.metrics?.siteId).toBe('site-1');

      // Step 3: View site access points
      const { result: siteApsResult } = renderHook(
        () => useAccessPointsBySiteGraphQL({ siteId: 'site-1' }),
        { wrapper: createApolloWrapper() }
      );

      await waitFor(() => expect(siteApsResult.current.loading).toBe(false));
      expect(siteApsResult.current.accessPoints).toHaveLength(2);
    });

    it('should handle access point to clients workflow', async () => {
      // Seed data
      seedAccessPoints([
        { id: 'ap-1', name: 'Main Office AP' },
      ]);

      seedWirelessClients([
        { id: 'client-1', accessPointId: 'ap-1', hostname: 'laptop-1' },
        { id: 'client-2', accessPointId: 'ap-1', hostname: 'phone-1' },
        { id: 'client-3', accessPointId: 'ap-1', hostname: 'tablet-1' },
      ]);

      // Step 1: View AP details
      const { result: apResult } = renderHook(
        () => useAccessPointDetailGraphQL({ id: 'ap-1' }),
        { wrapper: createApolloWrapper() }
      );

      await waitFor(() => expect(apResult.current.loading).toBe(false));
      expect(apResult.current.accessPoint?.id).toBe('ap-1');

      // Step 2: View clients on this AP
      const { result: clientsResult } = renderHook(
        () => useWirelessClientsByAccessPointGraphQL({ accessPointId: 'ap-1' }),
        { wrapper: createApolloWrapper() }
      );

      await waitFor(() => expect(clientsResult.current.loading).toBe(false));
      expect(clientsResult.current.clients).toHaveLength(3);
      expect(clientsResult.current.clients.every(c => c.accessPointId === 'ap-1')).toBe(true);
    });

    it('should handle site RF optimization workflow', async () => {
      const siteId = 'site-optimization';

      // Step 1: View RF analytics
      const { result: analyticsResult } = renderHook(
        () => useRfAnalyticsGraphQL({ siteId }),
        { wrapper: createApolloWrapper() }
      );

      await waitFor(() => expect(analyticsResult.current.loading).toBe(false));
      expect(analyticsResult.current.analytics).not.toBeNull();
      expect(analyticsResult.current.analytics?.recommendedChannels5ghz).toBeDefined();

      // Step 2: Check channel utilization for 5 GHz
      const { result: channelResult } = renderHook(
        () =>
          useChannelUtilizationGraphQL({
            siteId,
            band: FrequencyBand.Band_5Ghz,
          }),
        { wrapper: createApolloWrapper() }
      );

      await waitFor(() => expect(channelResult.current.loading).toBe(false));
      expect(channelResult.current.channelUtilization).toBeDefined();
      expect(channelResult.current.channelUtilization.length).toBeGreaterThan(0);
    });

    it('should handle customer device management workflow', async () => {
      const customerId = 'customer-123';

      // Seed data
      seedWirelessClients([
        {
          id: 'client-1',
          customerId,
          hostname: 'home-laptop',
          frequencyBand: FrequencyBand.Band_5Ghz,
          signalStrengthDbm: -55,
        },
        {
          id: 'client-2',
          customerId,
          hostname: 'home-phone',
          frequencyBand: FrequencyBand.Band_2_4Ghz,
          signalStrengthDbm: -65,
        },
        {
          id: 'client-3',
          customerId: 'other-customer',
          hostname: 'other-device',
        },
      ]);

      // Step 1: View all customer devices
      const { result: customerClientsResult } = renderHook(
        () => useWirelessClientsByCustomerGraphQL({ customerId }),
        { wrapper: createApolloWrapper() }
      );

      await waitFor(() => expect(customerClientsResult.current.loading).toBe(false));
      expect(customerClientsResult.current.clients).toHaveLength(2);
      expect(customerClientsResult.current.clients.every(c => c.customerId === customerId)).toBe(true);

      // Step 2: View specific device details
      const { result: clientDetailResult } = renderHook(
        () => useWirelessClientDetailGraphQL({ id: 'client-1' }),
        { wrapper: createApolloWrapper() }
      );

      await waitFor(() => expect(clientDetailResult.current.loading).toBe(false));
      expect(clientDetailResult.current.client?.hostname).toBe('home-laptop');
      expect(clientDetailResult.current.client?.signalStrengthDbm).toBe(-55);
    });

    it('should handle coverage planning workflow', async () => {
      const siteId = 'site-coverage';

      // Seed data
      seedCoverageZones([
        {
          id: 'zone-1',
          siteId,
          name: 'Floor 1',
          connectedClients: 25,
          maxClientCapacity: 200,
        },
        {
          id: 'zone-2',
          siteId,
          name: 'Floor 2',
          connectedClients: 30,
          maxClientCapacity: 200,
        },
      ]);

      seedAccessPoints([
        { id: 'ap-1', siteId },
        { id: 'ap-2', siteId },
      ]);

      // Step 1: View all coverage zones for site
      const { result: zonesResult } = renderHook(
        () => useCoverageZonesBySiteGraphQL({ siteId }),
        { wrapper: createApolloWrapper() }
      );

      await waitFor(() => expect(zonesResult.current.loading).toBe(false));
      expect(zonesResult.current.zones).toHaveLength(2);

      // Step 2: View zone details
      const { result: zoneDetailResult } = renderHook(
        () => useCoverageZoneDetailGraphQL({ id: 'zone-1' }),
        { wrapper: createApolloWrapper() }
      );

      await waitFor(() => expect(zoneDetailResult.current.loading).toBe(false));
      expect(zoneDetailResult.current.zone?.name).toBe('Floor 1');

      // Step 3: View APs in this site
      const { result: apsResult } = renderHook(
        () => useAccessPointsBySiteGraphQL({ siteId }),
        { wrapper: createApolloWrapper() }
      );

      await waitFor(() => expect(apsResult.current.loading).toBe(false));
      expect(apsResult.current.accessPoints).toHaveLength(2);
    });

    it('should handle multi-band client analysis', async () => {
      // Seed clients on different bands
      seedWirelessClients([
        { id: 'client-1', frequencyBand: FrequencyBand.Band_2_4Ghz, signalStrengthDbm: -60 },
        { id: 'client-2', frequencyBand: FrequencyBand.Band_2_4Ghz, signalStrengthDbm: -65 },
        { id: 'client-3', frequencyBand: FrequencyBand.Band_5Ghz, signalStrengthDbm: -50 },
        { id: 'client-4', frequencyBand: FrequencyBand.Band_5Ghz, signalStrengthDbm: -55 },
        { id: 'client-5', frequencyBand: FrequencyBand.Band_6Ghz, signalStrengthDbm: -45 },
      ]);

      // Analyze 2.4 GHz clients
      const { result: clients24 } = renderHook(
        () => useWirelessClientListGraphQL({ frequencyBand: FrequencyBand.Band_2_4Ghz }),
        { wrapper: createApolloWrapper() }
      );

      await waitFor(() => expect(clients24.current.loading).toBe(false));
      expect(clients24.current.clients).toHaveLength(2);

      // Analyze 5 GHz clients
      const { result: clients5 } = renderHook(
        () => useWirelessClientListGraphQL({ frequencyBand: FrequencyBand.Band_5Ghz }),
        { wrapper: createApolloWrapper() }
      );

      await waitFor(() => expect(clients5.current.loading).toBe(false));
      expect(clients5.current.clients).toHaveLength(2);

      // Analyze 6 GHz clients
      const { result: clients6 } = renderHook(
        () => useWirelessClientListGraphQL({ frequencyBand: FrequencyBand.Band_6Ghz }),
        { wrapper: createApolloWrapper() }
      );

      await waitFor(() => expect(clients6.current.loading).toBe(false));
      expect(clients6.current.clients).toHaveLength(1);
    });
  });
});

describe('useWirelessGraphQL - Error Handling', () => {
  it('should surface GraphQL errors for access point list hook', async () => {
    const errorMessage = 'AccessPointList query failed';
    server.use(
      graphql.query('AccessPointList', () => {
        return HttpResponse.json(
          {
            errors: [
              {
                message: errorMessage,
              },
            ],
          },
          { status: 200 },
        );
      }),
    );

    const { result } = renderHook(() => useAccessPointListGraphQL(), {
      wrapper: createApolloWrapper(),
    });

    await waitFor(() => expect(result.current.error).toBeDefined());

    expect(result.current.error).toContain(errorMessage);
    expect(result.current.accessPoints).toHaveLength(0);
    expect(result.current.total).toBe(0);
  });
});
