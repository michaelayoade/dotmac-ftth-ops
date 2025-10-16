/**
 * Test Suite for Wireless GraphQL Wrapper Hooks
 *
 * Tests all 14 wireless GraphQL wrapper hooks with:
 * - Loading states
 * - Error handling
 * - Data transformation
 * - Polling behavior
 * - Pagination
 * - Filtering and search
 */

import { renderHook, waitFor } from '@testing-library/react';
import { MockedProvider, MockedResponse } from '@apollo/client/testing';
import { ReactNode } from 'react';
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
  AccessPointListDocument,
  AccessPointDetailDocument,
  AccessPointsBySiteDocument,
  WirelessClientListDocument,
  WirelessClientDetailDocument,
  WirelessClientsByAccessPointDocument,
  WirelessClientsByCustomerDocument,
  CoverageZoneListDocument,
  CoverageZoneDetailDocument,
  CoverageZonesBySiteDocument,
  RfAnalyticsDocument,
  ChannelUtilizationDocument,
  WirelessSiteMetricsDocument,
  WirelessDashboardDocument,
  AccessPointStatus,
  FrequencyBand,
} from '@/lib/graphql/generated';

// ============================================================================
// Test Helpers
// ============================================================================

const createWrapper = (mocks: MockedResponse[]) => {
  return ({ children }: { children: ReactNode }) => (
    <MockedProvider mocks={mocks} addTypename={false}>
      {children}
    </MockedProvider>
  );
};

// ============================================================================
// Mock Data
// ============================================================================

const mockAccessPoint = {
  id: 'ap-1',
  name: 'AP-Building-A-1F',
  macAddress: '00:11:22:33:44:55',
  ipAddress: '192.168.1.100',
  serialNumber: 'SN123456',
  status: AccessPointStatus.Online,
  isOnline: true,
  lastSeenAt: '2025-10-16T10:00:00Z',
  model: 'UniFi AP AC Pro',
  manufacturer: 'Ubiquiti',
  firmwareVersion: '5.60.0',
  ssid: 'Corporate-WiFi',
  frequencyBand: FrequencyBand.Band_5Ghz,
  channel: 36,
  channelWidth: 80,
  transmitPower: 20,
  maxClients: 100,
  securityType: 'WPA2-Enterprise',
  location: {
    siteName: 'Building A',
    building: 'Main Office',
    floor: '1',
    room: 'Lobby',
    mountingType: 'Ceiling',
    coordinates: {
      latitude: 40.7128,
      longitude: -74.0060,
      altitude: 10.0,
    },
  },
  rfMetrics: {
    signalStrengthDbm: -45.0,
    noiseFloorDbm: -90.0,
    signalToNoiseRatio: 45.0,
    channelUtilizationPercent: 35.0,
    interferenceLevel: 'low',
    txPowerDbm: 20.0,
    rxPowerDbm: -45.0,
  },
  performance: {
    txBytes: 1000000000,
    rxBytes: 2000000000,
    txPackets: 500000,
    rxPackets: 600000,
    txRateMbps: 450.0,
    rxRateMbps: 500.0,
    txErrors: 10,
    rxErrors: 5,
    connectedClients: 25,
    cpuUsagePercent: 15.0,
    memoryUsagePercent: 40.0,
    uptimeSeconds: 86400,
  },
  controllerName: 'UniFi Controller',
  siteName: 'Building A',
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-10-16T10:00:00Z',
  lastRebootAt: '2025-10-15T00:00:00Z',
};

const mockWirelessClient = {
  id: 'client-1',
  macAddress: '00:AA:BB:CC:DD:EE',
  hostname: 'laptop-john-doe',
  ipAddress: '192.168.1.200',
  manufacturer: 'Apple',
  accessPointId: 'ap-1',
  accessPointName: 'AP-Building-A-1F',
  ssid: 'Corporate-WiFi',
  connectionType: '802.11ac',
  frequencyBand: FrequencyBand.Band_5Ghz,
  channel: 36,
  isAuthenticated: true,
  isAuthorized: true,
  signalStrengthDbm: -55.0,
  signalQuality: {
    rssiDbm: -55.0,
    snrDb: 35.0,
    noiseFloorDbm: -90.0,
    signalStrengthPercent: 75.0,
    linkQualityPercent: 85.0,
  },
  noiseFloorDbm: -90.0,
  snr: 35.0,
  txRateMbps: 450.0,
  rxRateMbps: 500.0,
  txBytes: 500000000,
  rxBytes: 1000000000,
  connectedAt: '2025-10-16T09:00:00Z',
  lastSeenAt: '2025-10-16T10:00:00Z',
  uptimeSeconds: 3600,
  customerId: 'customer-1',
  customerName: 'Acme Corp',
};

const mockCoverageZone = {
  id: 'zone-1',
  name: 'Building A - Floor 1',
  description: 'First floor coverage zone',
  siteId: 'site-1',
  siteName: 'Building A',
  floor: '1',
  areaType: 'office',
  coverageAreaSqm: 500.0,
  signalStrengthMinDbm: -70.0,
  signalStrengthMaxDbm: -30.0,
  signalStrengthAvgDbm: -50.0,
  accessPointIds: ['ap-1', 'ap-2'],
  accessPointCount: 2,
  interferenceLevel: 'low',
  channelUtilizationAvg: 35.0,
  noiseFloorAvgDbm: -90.0,
  connectedClients: 50,
  maxClientCapacity: 200,
  clientDensityPerAp: 25.0,
  coveragePolygon: '{"type":"Polygon","coordinates":[[[0,0],[0,10],[10,10],[10,0],[0,0]]]}',
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-10-16T10:00:00Z',
  lastSurveyedAt: '2025-10-01T00:00:00Z',
};

// ============================================================================
// Access Point Tests
// ============================================================================

describe('useAccessPointListGraphQL', () => {
  it('should fetch access points successfully', async () => {
    const mocks: MockedResponse[] = [
      {
        request: {
          query: AccessPointListDocument,
          variables: {
            limit: 50,
            offset: 0,
            status: undefined,
            siteId: undefined,
            search: undefined,
          },
        },
        result: {
          data: {
            accessPoints: {
              accessPoints: [mockAccessPoint],
              totalCount: 1,
              hasNextPage: false,
            },
          },
        },
      },
    ];

    const { result } = renderHook(() => useAccessPointListGraphQL(), {
      wrapper: createWrapper(mocks),
    });

    expect(result.current.loading).toBe(true);
    expect(result.current.accessPoints).toEqual([]);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.accessPoints).toHaveLength(1);
    expect(result.current.accessPoints[0].id).toBe('ap-1');
    expect(result.current.total).toBe(1);
    expect(result.current.hasNextPage).toBe(false);
  });

  it('should handle pagination', async () => {
    const mocks: MockedResponse[] = [
      {
        request: {
          query: AccessPointListDocument,
          variables: {
            limit: 10,
            offset: 20,
            status: undefined,
            siteId: undefined,
            search: undefined,
          },
        },
        result: {
          data: {
            accessPoints: {
              accessPoints: [mockAccessPoint],
              totalCount: 100,
              hasNextPage: true,
            },
          },
        },
      },
    ];

    const { result } = renderHook(
      () => useAccessPointListGraphQL({ limit: 10, offset: 20 }),
      {
        wrapper: createWrapper(mocks),
      }
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.limit).toBe(10);
    expect(result.current.offset).toBe(20);
    expect(result.current.total).toBe(100);
    expect(result.current.hasNextPage).toBe(true);
  });

  it('should handle filtering by status', async () => {
    const mocks: MockedResponse[] = [
      {
        request: {
          query: AccessPointListDocument,
          variables: {
            limit: 50,
            offset: 0,
            status: AccessPointStatus.Online,
            siteId: undefined,
            search: undefined,
          },
        },
        result: {
          data: {
            accessPoints: {
              accessPoints: [mockAccessPoint],
              totalCount: 1,
              hasNextPage: false,
            },
          },
        },
      },
    ];

    const { result } = renderHook(
      () => useAccessPointListGraphQL({ status: AccessPointStatus.Online }),
      {
        wrapper: createWrapper(mocks),
      }
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.accessPoints).toHaveLength(1);
  });

  it('should handle search', async () => {
    const mocks: MockedResponse[] = [
      {
        request: {
          query: AccessPointListDocument,
          variables: {
            limit: 50,
            offset: 0,
            status: undefined,
            siteId: undefined,
            search: 'Building A',
          },
        },
        result: {
          data: {
            accessPoints: {
              accessPoints: [mockAccessPoint],
              totalCount: 1,
              hasNextPage: false,
            },
          },
        },
      },
    ];

    const { result } = renderHook(
      () => useAccessPointListGraphQL({ search: 'Building A' }),
      {
        wrapper: createWrapper(mocks),
      }
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.accessPoints).toHaveLength(1);
  });

  it('should handle errors', async () => {
    const mocks: MockedResponse[] = [
      {
        request: {
          query: AccessPointListDocument,
          variables: {
            limit: 50,
            offset: 0,
            status: undefined,
            siteId: undefined,
            search: undefined,
          },
        },
        error: new Error('Network error'),
      },
    ];

    const { result } = renderHook(() => useAccessPointListGraphQL(), {
      wrapper: createWrapper(mocks),
    });

    await waitFor(() => {
      expect(result.current.error).toBe('Network error');
    });

    expect(result.current.accessPoints).toEqual([]);
  });

  it('should support disabling the query', () => {
    const mocks: MockedResponse[] = [];

    const { result } = renderHook(
      () => useAccessPointListGraphQL({ enabled: false }),
      {
        wrapper: createWrapper(mocks),
      }
    );

    expect(result.current.loading).toBe(false);
    expect(result.current.accessPoints).toEqual([]);
  });
});

describe('useAccessPointDetailGraphQL', () => {
  it('should fetch access point detail successfully', async () => {
    const mocks: MockedResponse[] = [
      {
        request: {
          query: AccessPointDetailDocument,
          variables: { id: 'ap-1' },
        },
        result: {
          data: {
            accessPoint: {
              ...mockAccessPoint,
              hardwareRevision: 'v2',
              controllerId: 'controller-1',
              siteId: 'site-1',
              isMeshEnabled: false,
              isBandSteeringEnabled: true,
              isLoadBalancingEnabled: true,
              performance: {
                ...mockAccessPoint.performance,
                txDropped: 2,
                rxDropped: 1,
                retries: 50,
                retryRatePercent: 1.0,
                authenticatedClients: 25,
                authorizedClients: 25,
              },
              location: {
                ...mockAccessPoint.location,
                coordinates: {
                  ...mockAccessPoint.location.coordinates,
                  accuracy: 5.0,
                },
              },
            },
          },
        },
      },
    ];

    const { result } = renderHook(() => useAccessPointDetailGraphQL({ id: 'ap-1' }), {
      wrapper: createWrapper(mocks),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.accessPoint).toBeDefined();
    expect(result.current.accessPoint?.id).toBe('ap-1');
    expect(result.current.accessPoint?.hardwareRevision).toBe('v2');
  });
});

describe('useAccessPointsBySiteGraphQL', () => {
  it('should fetch access points by site', async () => {
    const mocks: MockedResponse[] = [
      {
        request: {
          query: AccessPointsBySiteDocument,
          variables: { siteId: 'site-1' },
        },
        result: {
          data: {
            accessPointsBySite: [
              {
                id: 'ap-1',
                name: 'AP-Building-A-1F',
                macAddress: '00:11:22:33:44:55',
                ipAddress: '192.168.1.100',
                status: AccessPointStatus.Online,
                isOnline: true,
                ssid: 'Corporate-WiFi',
                frequencyBand: FrequencyBand.Band_5Ghz,
                channel: 36,
                performance: {
                  connectedClients: 25,
                  cpuUsagePercent: 15.0,
                  memoryUsagePercent: 40.0,
                },
                rfMetrics: {
                  signalStrengthDbm: -45.0,
                  channelUtilizationPercent: 35.0,
                },
              },
            ],
          },
        },
      },
    ];

    const { result } = renderHook(
      () => useAccessPointsBySiteGraphQL({ siteId: 'site-1' }),
      {
        wrapper: createWrapper(mocks),
      }
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.accessPoints).toHaveLength(1);
    expect(result.current.accessPoints[0].id).toBe('ap-1');
  });
});

// ============================================================================
// Wireless Client Tests
// ============================================================================

describe('useWirelessClientListGraphQL', () => {
  it('should fetch wireless clients successfully', async () => {
    const mocks: MockedResponse[] = [
      {
        request: {
          query: WirelessClientListDocument,
          variables: {
            limit: 50,
            offset: 0,
            accessPointId: undefined,
            customerId: undefined,
            frequencyBand: undefined,
            search: undefined,
          },
        },
        result: {
          data: {
            wirelessClients: {
              clients: [mockWirelessClient],
              totalCount: 1,
              hasNextPage: false,
            },
          },
        },
      },
    ];

    const { result } = renderHook(() => useWirelessClientListGraphQL(), {
      wrapper: createWrapper(mocks),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.clients).toHaveLength(1);
    expect(result.current.clients[0].id).toBe('client-1');
    expect(result.current.total).toBe(1);
  });

  it('should filter by frequency band', async () => {
    const mocks: MockedResponse[] = [
      {
        request: {
          query: WirelessClientListDocument,
          variables: {
            limit: 50,
            offset: 0,
            accessPointId: undefined,
            customerId: undefined,
            frequencyBand: FrequencyBand.Band_5Ghz,
            search: undefined,
          },
        },
        result: {
          data: {
            wirelessClients: {
              clients: [mockWirelessClient],
              totalCount: 1,
              hasNextPage: false,
            },
          },
        },
      },
    ];

    const { result } = renderHook(
      () => useWirelessClientListGraphQL({ frequencyBand: FrequencyBand.Band_5Ghz }),
      {
        wrapper: createWrapper(mocks),
      }
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.clients).toHaveLength(1);
  });
});

describe('useWirelessClientDetailGraphQL', () => {
  it('should fetch client detail successfully', async () => {
    const mocks: MockedResponse[] = [
      {
        request: {
          query: WirelessClientDetailDocument,
          variables: { id: 'client-1' },
        },
        result: {
          data: {
            wirelessClient: {
              ...mockWirelessClient,
              authMethod: '802.1X',
              txPackets: 250000,
              rxPackets: 300000,
              txRetries: 1000,
              rxRetries: 500,
              idleTimeSeconds: 0,
              supports80211k: true,
              supports80211r: true,
              supports80211v: true,
              maxPhyRateMbps: 867.0,
            },
          },
        },
      },
    ];

    const { result } = renderHook(
      () => useWirelessClientDetailGraphQL({ id: 'client-1' }),
      {
        wrapper: createWrapper(mocks),
      }
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.client).toBeDefined();
    expect(result.current.client?.id).toBe('client-1');
    expect(result.current.client?.authMethod).toBe('802.1X');
  });
});

describe('useWirelessClientsByAccessPointGraphQL', () => {
  it('should fetch clients by access point', async () => {
    const mocks: MockedResponse[] = [
      {
        request: {
          query: WirelessClientsByAccessPointDocument,
          variables: { accessPointId: 'ap-1' },
        },
        result: {
          data: {
            wirelessClientsByAccessPoint: [
              {
                id: 'client-1',
                macAddress: '00:AA:BB:CC:DD:EE',
                hostname: 'laptop-john-doe',
                ipAddress: '192.168.1.200',
                signalStrengthDbm: -55.0,
                signalQuality: {
                  rssiDbm: -55.0,
                  snrDb: 35.0,
                  noiseFloorDbm: -90.0,
                  signalStrengthPercent: 75.0,
                  linkQualityPercent: 85.0,
                },
                txRateMbps: 450.0,
                rxRateMbps: 500.0,
                connectedAt: '2025-10-16T09:00:00Z',
                customerId: 'customer-1',
                customerName: 'Acme Corp',
              },
            ],
          },
        },
      },
    ];

    const { result } = renderHook(
      () => useWirelessClientsByAccessPointGraphQL({ accessPointId: 'ap-1' }),
      {
        wrapper: createWrapper(mocks),
      }
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.clients).toHaveLength(1);
  });
});

describe('useWirelessClientsByCustomerGraphQL', () => {
  it('should fetch clients by customer', async () => {
    const mocks: MockedResponse[] = [
      {
        request: {
          query: WirelessClientsByCustomerDocument,
          variables: { customerId: 'customer-1' },
        },
        result: {
          data: {
            wirelessClientsByCustomer: [
              {
                id: 'client-1',
                macAddress: '00:AA:BB:CC:DD:EE',
                hostname: 'laptop-john-doe',
                ipAddress: '192.168.1.200',
                accessPointName: 'AP-Building-A-1F',
                ssid: 'Corporate-WiFi',
                frequencyBand: FrequencyBand.Band_5Ghz,
                signalStrengthDbm: -55.0,
                signalQuality: {
                  rssiDbm: -55.0,
                  snrDb: 35.0,
                  noiseFloorDbm: -90.0,
                  signalStrengthPercent: 75.0,
                  linkQualityPercent: 85.0,
                },
                isAuthenticated: true,
                connectedAt: '2025-10-16T09:00:00Z',
                lastSeenAt: '2025-10-16T10:00:00Z',
              },
            ],
          },
        },
      },
    ];

    const { result } = renderHook(
      () => useWirelessClientsByCustomerGraphQL({ customerId: 'customer-1' }),
      {
        wrapper: createWrapper(mocks),
      }
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.clients).toHaveLength(1);
  });
});

// ============================================================================
// Coverage Zone Tests
// ============================================================================

describe('useCoverageZoneListGraphQL', () => {
  it('should fetch coverage zones successfully', async () => {
    const mocks: MockedResponse[] = [
      {
        request: {
          query: CoverageZoneListDocument,
          variables: {
            limit: 50,
            offset: 0,
            siteId: undefined,
            areaType: undefined,
          },
        },
        result: {
          data: {
            coverageZones: {
              zones: [mockCoverageZone],
              totalCount: 1,
              hasNextPage: false,
            },
          },
        },
      },
    ];

    const { result } = renderHook(() => useCoverageZoneListGraphQL(), {
      wrapper: createWrapper(mocks),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.zones).toHaveLength(1);
    expect(result.current.zones[0].id).toBe('zone-1');
  });
});

describe('useCoverageZoneDetailGraphQL', () => {
  it('should fetch coverage zone detail', async () => {
    const mocks: MockedResponse[] = [
      {
        request: {
          query: CoverageZoneDetailDocument,
          variables: { id: 'zone-1' },
        },
        result: {
          data: {
            coverageZone: mockCoverageZone,
          },
        },
      },
    ];

    const { result } = renderHook(
      () => useCoverageZoneDetailGraphQL({ id: 'zone-1' }),
      {
        wrapper: createWrapper(mocks),
      }
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.zone).toBeDefined();
    expect(result.current.zone?.id).toBe('zone-1');
  });
});

describe('useCoverageZonesBySiteGraphQL', () => {
  it('should fetch coverage zones by site', async () => {
    const mocks: MockedResponse[] = [
      {
        request: {
          query: CoverageZonesBySiteDocument,
          variables: { siteId: 'site-1' },
        },
        result: {
          data: {
            coverageZonesBySite: [
              {
                id: 'zone-1',
                name: 'Building A - Floor 1',
                floor: '1',
                areaType: 'office',
                coverageAreaSqm: 500.0,
                accessPointCount: 2,
                connectedClients: 50,
                maxClientCapacity: 200,
                signalStrengthAvgDbm: -50.0,
              },
            ],
          },
        },
      },
    ];

    const { result } = renderHook(
      () => useCoverageZonesBySiteGraphQL({ siteId: 'site-1' }),
      {
        wrapper: createWrapper(mocks),
      }
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.zones).toHaveLength(1);
  });
});

// ============================================================================
// RF Analytics Tests
// ============================================================================

describe('useRfAnalyticsGraphQL', () => {
  it('should fetch RF analytics', async () => {
    const mocks: MockedResponse[] = [
      {
        request: {
          query: RfAnalyticsDocument,
          variables: { siteId: 'site-1' },
        },
        result: {
          data: {
            rfAnalytics: {
              siteId: 'site-1',
              siteName: 'Building A',
              analysisTimestamp: '2025-10-16T10:00:00Z',
              channelUtilization24ghz: [],
              channelUtilization5ghz: [
                {
                  channel: 36,
                  frequencyMhz: 5180,
                  band: FrequencyBand.Band_5Ghz,
                  utilizationPercent: 35.0,
                  interferenceLevel: 'low',
                  accessPointsCount: 2,
                },
              ],
              channelUtilization6ghz: [],
              recommendedChannels24ghz: [1, 6, 11],
              recommendedChannels5ghz: [36, 40, 44],
              recommendedChannels6ghz: [],
              interferenceSources: [],
              totalInterferenceScore: 5.0,
              averageSignalStrengthDbm: -50.0,
              averageSnr: 40.0,
              coverageQualityScore: 85.0,
              clientsPerBand24ghz: 0,
              clientsPerBand5ghz: 50,
              clientsPerBand6ghz: 0,
              bandUtilizationBalanceScore: 75.0,
            },
          },
        },
      },
    ];

    const { result } = renderHook(
      () => useRfAnalyticsGraphQL({ siteId: 'site-1' }),
      {
        wrapper: createWrapper(mocks),
      }
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.analytics).toBeDefined();
    expect(result.current.analytics?.siteId).toBe('site-1');
  });
});

describe('useChannelUtilizationGraphQL', () => {
  it('should fetch channel utilization', async () => {
    const mocks: MockedResponse[] = [
      {
        request: {
          query: ChannelUtilizationDocument,
          variables: {
            siteId: 'site-1',
            frequencyBand: FrequencyBand.Band_5Ghz,
          },
        },
        result: {
          data: {
            channelUtilization: [
              {
                channel: 36,
                frequencyMhz: 5180,
                band: FrequencyBand.Band_5Ghz,
                utilizationPercent: 35.0,
                interferenceLevel: 'low',
                accessPointsCount: 2,
              },
            ],
          },
        },
      },
    ];

    const { result } = renderHook(
      () => useChannelUtilizationGraphQL({ siteId: 'site-1', band: FrequencyBand.Band_5Ghz }),
      {
        wrapper: createWrapper(mocks),
      }
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.channelUtilization).toHaveLength(1);
  });
});

// ============================================================================
// Dashboard and Metrics Tests
// ============================================================================

describe('useWirelessSiteMetricsGraphQL', () => {
  it('should fetch wireless site metrics', async () => {
    const mocks: MockedResponse[] = [
      {
        request: {
          query: WirelessSiteMetricsDocument,
          variables: { siteId: 'site-1' },
        },
        result: {
          data: {
            wirelessSiteMetrics: {
              siteId: 'site-1',
              siteName: 'Building A',
              totalAps: 10,
              onlineAps: 9,
              offlineAps: 1,
              degradedAps: 0,
              totalClients: 150,
              clients24ghz: 30,
              clients5ghz: 120,
              clients6ghz: 0,
              averageSignalStrengthDbm: -55.0,
              averageSnr: 35.0,
              totalThroughputMbps: 5000.0,
              totalCapacity: 1000,
              capacityUtilizationPercent: 15.0,
              overallHealthScore: 95.0,
              rfHealthScore: 90.0,
              clientExperienceScore: 92.0,
            },
          },
        },
      },
    ];

    const { result } = renderHook(
      () => useWirelessSiteMetricsGraphQL({ siteId: 'site-1' }),
      {
        wrapper: createWrapper(mocks),
      }
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.metrics).toBeDefined();
    expect(result.current.metrics?.totalAps).toBe(10);
  });
});

describe('useWirelessDashboardGraphQL', () => {
  it('should fetch wireless dashboard', async () => {
    const mocks: MockedResponse[] = [
      {
        request: {
          query: WirelessDashboardDocument,
        },
        result: {
          data: {
            wirelessDashboard: {
              totalSites: 5,
              totalAccessPoints: 50,
              totalClients: 500,
              totalCoverageZones: 25,
              onlineAps: 48,
              offlineAps: 2,
              degradedAps: 0,
              clientsByBand24ghz: 100,
              clientsByBand5ghz: 400,
              clientsByBand6ghz: 0,
              topApsByClients: [
                {
                  id: 'ap-1',
                  name: 'AP-Building-A-1F',
                  siteName: 'Building A',
                  performance: {
                    connectedClients: 50,
                  },
                },
              ],
              topApsByThroughput: [
                {
                  id: 'ap-1',
                  name: 'AP-Building-A-1F',
                  siteName: 'Building A',
                  performance: {
                    txRateMbps: 450.0,
                    rxRateMbps: 500.0,
                  },
                },
              ],
              sitesWithIssues: [],
              totalThroughputMbps: 25000.0,
              averageSignalStrengthDbm: -55.0,
              averageClientExperienceScore: 90.0,
              clientCountTrend: [450, 470, 480, 490, 500],
              throughputTrendMbps: [20000, 22000, 23000, 24000, 25000],
              offlineEventsCount: 3,
              generatedAt: '2025-10-16T10:00:00Z',
            },
          },
        },
      },
    ];

    const { result } = renderHook(() => useWirelessDashboardGraphQL(), {
      wrapper: createWrapper(mocks),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.dashboard).toBeDefined();
    expect(result.current.dashboard?.totalAccessPoints).toBe(50);
    expect(result.current.dashboard?.totalClients).toBe(500);
  });
});

// ============================================================================
// Utility Function Tests
// ============================================================================

describe('Utility Functions', () => {
  describe('calculateSignalQuality', () => {
    it('should return 100 for excellent signal', () => {
      expect(calculateSignalQuality(-30)).toBe(100);
      expect(calculateSignalQuality(-25)).toBe(100);
    });

    it('should return 0 for poor signal', () => {
      expect(calculateSignalQuality(-90)).toBe(0);
      expect(calculateSignalQuality(-95)).toBe(0);
    });

    it('should calculate percentage for mid-range signal', () => {
      expect(calculateSignalQuality(-60)).toBe(50);
      expect(calculateSignalQuality(-45)).toBe(75);
      expect(calculateSignalQuality(-75)).toBe(25);
    });

    it('should return 0 for null/undefined', () => {
      expect(calculateSignalQuality(null)).toBe(0);
      expect(calculateSignalQuality(undefined)).toBe(0);
    });
  });

  describe('getSignalQualityLabel', () => {
    it('should return correct labels', () => {
      expect(getSignalQualityLabel(-40)).toBe('Excellent');
      expect(getSignalQualityLabel(-55)).toBe('Good');
      expect(getSignalQualityLabel(-65)).toBe('Fair');
      expect(getSignalQualityLabel(-80)).toBe('Poor');
    });

    it('should return Unknown for null/undefined', () => {
      expect(getSignalQualityLabel(null)).toBe('Unknown');
      expect(getSignalQualityLabel(undefined)).toBe('Unknown');
    });
  });

  describe('getFrequencyBandLabel', () => {
    it('should return correct band labels', () => {
      expect(getFrequencyBandLabel(FrequencyBand.Band_2_4Ghz)).toBe('2.4 GHz');
      expect(getFrequencyBandLabel(FrequencyBand.Band_5Ghz)).toBe('5 GHz');
      expect(getFrequencyBandLabel(FrequencyBand.Band_6Ghz)).toBe('6 GHz');
    });

    it('should return Unknown for null/undefined', () => {
      expect(getFrequencyBandLabel(null)).toBe('Unknown');
      expect(getFrequencyBandLabel(undefined)).toBe('Unknown');
    });
  });
});
