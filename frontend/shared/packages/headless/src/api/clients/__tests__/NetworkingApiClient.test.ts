/**
 * NetworkingApiClient Tests
 * Critical test suite for network device management and monitoring
 */

import { NetworkingApiClient } from "../NetworkingApiClient";
import type { NetworkDevice, NetworkTopology } from "../NetworkingApiClient";

// Mock fetch
global.fetch = jest.fn();
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

describe("NetworkingApiClient", () => {
  let client: NetworkingApiClient;
  const baseURL = "https://api.test.com";
  const defaultHeaders = { Authorization: "Bearer test-token" };

  beforeEach(() => {
    client = new NetworkingApiClient(baseURL, defaultHeaders);
    jest.clearAllMocks();
  });

  const mockResponse = <T>(data: T, status = 200) => {
    mockFetch.mockResolvedValueOnce({
      ok: status >= 200 && status < 300,
      status,
      json: async () => data,
    } as Response);
  };

  describe("Network Device Operations", () => {
    const mockDevice: NetworkDevice = {
      id: "device_123",
      name: "Main Router",
      type: "router",
      status: "online",
      ip_address: "192.168.1.1",
      mac_address: "00:11:22:33:44:55",
      location: "Network Closet A",
      last_seen: "2024-01-15T10:30:00Z",
      uptime: 2592000,
      firmware_version: "1.2.3",
    };

    it("should get network devices with filters", async () => {
      mockResponse({
        data: [mockDevice],
        pagination: {
          page: 1,
          limit: 10,
          total: 1,
          total_pages: 1,
        },
      });

      const result = await client.getNetworkDevices({
        type: "router",
        status: "online",
        location: "Network Closet A",
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/networking/devices?type=router&status=online&location=Network+Closet+A",
        expect.any(Object),
      );

      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe("device_123");
    });

    it("should get single network device", async () => {
      mockResponse({ data: mockDevice });

      const result = await client.getNetworkDevice("device_123");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/networking/devices/device_123",
        expect.any(Object),
      );

      expect(result.data.name).toBe("Main Router");
      expect(result.data.status).toBe("online");
    });

    it("should update network device", async () => {
      const updateData = {
        name: "Updated Router",
        location: "Network Closet B",
      };

      mockResponse({
        data: { ...mockDevice, ...updateData },
      });

      const result = await client.updateNetworkDevice("device_123", updateData);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/networking/devices/device_123",
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify(updateData),
        }),
      );

      expect(result.data.name).toBe("Updated Router");
      expect(result.data.location).toBe("Network Closet B");
    });

    it("should reboot device", async () => {
      mockResponse({ success: true });

      const result = await client.rebootDevice("device_123");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/networking/devices/device_123/reboot",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({}),
        }),
      );

      expect(result.success).toBe(true);
    });

    it("should handle device not found error", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
        json: async () => ({
          error: {
            code: "DEVICE_NOT_FOUND",
            message: "Network device not found",
          },
        }),
      } as Response);

      await expect(client.getNetworkDevice("invalid_device")).rejects.toThrow("Not Found");
    });
  });

  describe("Network Topology Operations", () => {
    const mockTopology: NetworkTopology = {
      nodes: [
        {
          id: "device_1",
          name: "Core Router",
          type: "router",
          status: "online",
          ip_address: "192.168.1.1",
          mac_address: "00:11:22:33:44:55",
          location: "Core",
          last_seen: "2024-01-15T10:30:00Z",
          uptime: 2592000,
          firmware_version: "1.2.3",
        },
        {
          id: "device_2",
          name: "Switch A",
          type: "switch",
          status: "online",
          ip_address: "192.168.1.10",
          mac_address: "00:11:22:33:44:66",
          location: "Building A",
          last_seen: "2024-01-15T10:30:00Z",
          uptime: 1296000,
          firmware_version: "2.1.0",
        },
      ],
      connections: [
        {
          source: "device_1",
          target: "device_2",
          type: "physical",
          status: "active",
        },
      ],
    };

    it("should get network topology", async () => {
      mockResponse({ data: mockTopology });

      const result = await client.getNetworkTopology({
        depth: 3,
        filter: "routers_and_switches",
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/networking/topology?depth=3&filter=routers_and_switches",
        expect.any(Object),
      );

      expect(result.data.nodes).toHaveLength(2);
      expect(result.data.connections).toHaveLength(1);
      expect(result.data.connections[0].status).toBe("active");
    });

    it("should discover network devices", async () => {
      const discoveredDevices = [
        {
          id: "discovered_1",
          name: "Unknown Device",
          type: "unknown",
          ip_address: "192.168.1.100",
          mac_address: "00:11:22:33:44:77",
        },
      ];

      mockResponse({ data: discoveredDevices });

      const result = await client.discoverDevices({
        subnet: "192.168.1.0/24",
        timeout: 30,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/networking/discover",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            subnet: "192.168.1.0/24",
            timeout: 30,
          }),
        }),
      );

      expect(result.data).toHaveLength(1);
      expect(result.data[0].ip_address).toBe("192.168.1.100");
    });

    it("should handle empty topology", async () => {
      mockResponse({
        data: {
          nodes: [],
          connections: [],
        },
      });

      const result = await client.getNetworkTopology();

      expect(result.data.nodes).toHaveLength(0);
      expect(result.data.connections).toHaveLength(0);
    });
  });

  describe("Monitoring Operations", () => {
    it("should get device metrics", async () => {
      const mockMetrics = {
        cpu_usage: [
          { timestamp: "2024-01-15T10:00:00Z", value: 45.2 },
          { timestamp: "2024-01-15T10:05:00Z", value: 52.8 },
        ],
        memory_usage: [
          { timestamp: "2024-01-15T10:00:00Z", value: 68.5 },
          { timestamp: "2024-01-15T10:05:00Z", value: 71.2 },
        ],
        interface_stats: {
          eth0: {
            bytes_in: 1048576000,
            bytes_out: 524288000,
            packets_in: 1000000,
            packets_out: 750000,
          },
        },
      };

      mockResponse({ data: mockMetrics });

      const result = await client.getDeviceMetrics("device_123", {
        start_time: "2024-01-15T10:00:00Z",
        end_time: "2024-01-15T11:00:00Z",
        metrics: ["cpu_usage", "memory_usage", "interface_stats"],
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/networking/devices/device_123/metrics?start_time=2024-01-15T10%3A00%3A00Z&end_time=2024-01-15T11%3A00%3A00Z&metrics=cpu_usage%2Cmemory_usage%2Cinterface_stats",
        expect.any(Object),
      );

      expect(result.data.cpu_usage).toHaveLength(2);
      expect(result.data.interface_stats.eth0.bytes_in).toBe(1048576000);
    });

    it("should get network health overview", async () => {
      const mockHealth = {
        overall_status: "healthy",
        total_devices: 156,
        online_devices: 148,
        offline_devices: 5,
        warning_devices: 3,
        error_devices: 0,
        network_utilization: 34.2,
        average_latency: 12.5,
        packet_loss: 0.1,
        uptime_percentage: 99.9,
        critical_alerts: 0,
        active_incidents: 1,
      };

      mockResponse({ data: mockHealth });

      const result = await client.getNetworkHealth();

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/networking/health",
        expect.any(Object),
      );

      expect(result.data.overall_status).toBe("healthy");
      expect(result.data.uptime_percentage).toBe(99.9);
      expect(result.data.online_devices).toBe(148);
    });

    it("should get device alerts with filters", async () => {
      const mockAlerts = [
        {
          id: "alert_123",
          device_id: "device_123",
          device_name: "Main Router",
          severity: "high",
          status: "active",
          message: "High CPU usage detected",
          created_at: "2024-01-15T10:30:00Z",
          acknowledged: false,
          metrics: {
            cpu_usage: 85.2,
            threshold: 80.0,
          },
        },
        {
          id: "alert_124",
          device_id: "device_124",
          device_name: "Switch A",
          severity: "medium",
          status: "resolved",
          message: "Interface flapping detected",
          created_at: "2024-01-15T09:15:00Z",
          resolved_at: "2024-01-15T09:30:00Z",
          acknowledged: true,
        },
      ];

      mockResponse({
        data: mockAlerts,
        pagination: {
          page: 1,
          limit: 20,
          total: 2,
          total_pages: 1,
        },
      });

      const result = await client.getDeviceAlerts({
        severity: "high",
        status: "active",
        limit: 20,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/networking/alerts?severity=high&status=active&limit=20",
        expect.any(Object),
      );

      expect(result.data).toHaveLength(2);
      expect(result.data[0].severity).toBe("high");
      expect(result.data[0].status).toBe("active");
    });
  });

  describe("Real-time Operations", () => {
    it("should handle device status changes", async () => {
      // Test device going offline
      const offlineDevice = { ...mockDevice, status: "offline" as const };
      mockResponse({ data: offlineDevice });

      const result = await client.updateNetworkDevice("device_123", {
        status: "offline",
      });

      expect(result.data.status).toBe("offline");
    });

    it("should handle device discovery timeout", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 408,
        statusText: "Request Timeout",
        json: async () => ({
          error: {
            code: "DISCOVERY_TIMEOUT",
            message: "Device discovery timed out",
          },
        }),
      } as Response);

      await expect(
        client.discoverDevices({
          subnet: "10.0.0.0/24",
          timeout: 5,
        }),
      ).rejects.toThrow("Request Timeout");
    });

    it("should handle reboot operation failure", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
        statusText: "Service Unavailable",
        json: async () => ({
          error: {
            code: "DEVICE_UNREACHABLE",
            message: "Device is unreachable for reboot",
          },
        }),
      } as Response);

      await expect(client.rebootDevice("device_offline")).rejects.toThrow("Service Unavailable");
    });
  });

  describe("Error Handling", () => {
    it("should handle network connectivity errors", async () => {
      mockFetch.mockRejectedValue(new Error("Network error"));

      await expect(client.getNetworkDevices()).rejects.toThrow("Network error");
    });

    it("should handle invalid device parameters", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: "Bad Request",
        json: async () => ({
          error: {
            code: "INVALID_DEVICE_TYPE",
            message: "Invalid device type specified",
          },
        }),
      } as Response);

      await expect(
        client.getNetworkDevices({
          type: "invalid_type" as any,
        }),
      ).rejects.toThrow("Bad Request");
    });

    it("should handle topology complexity limits", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 413,
        statusText: "Payload Too Large",
        json: async () => ({
          error: {
            code: "TOPOLOGY_TOO_COMPLEX",
            message: "Network topology is too large to process",
          },
        }),
      } as Response);

      await expect(
        client.getNetworkTopology({
          depth: 100,
        }),
      ).rejects.toThrow("Payload Too Large");
    });
  });

  describe("Performance and Scalability", () => {
    it("should handle large device lists efficiently", async () => {
      const largeDeviceList = Array.from({ length: 1000 }, (_, i) => ({
        ...mockDevice,
        id: `device_${i}`,
        name: `Device ${i}`,
        ip_address: `192.168.${Math.floor(i / 254)}.${(i % 254) + 1}`,
      }));

      mockResponse({
        data: largeDeviceList,
        pagination: {
          page: 1,
          limit: 1000,
          total: 1000,
          total_pages: 1,
        },
      });

      const startTime = performance.now();
      const result = await client.getNetworkDevices({ limit: 1000 });
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(100);
      expect(result.data).toHaveLength(1000);
    });

    it("should handle high-frequency metric requests", async () => {
      const highFrequencyMetrics = Array.from({ length: 1440 }, (_, i) => ({
        timestamp: new Date(Date.now() - (1440 - i) * 60000).toISOString(),
        cpu_usage: Math.random() * 100,
        memory_usage: Math.random() * 100,
      }));

      mockResponse({
        data: {
          cpu_usage: highFrequencyMetrics,
          memory_usage: highFrequencyMetrics,
        },
      });

      const result = await client.getDeviceMetrics("device_123", {
        start_time: new Date(Date.now() - 86400000).toISOString(),
        end_time: new Date().toISOString(),
      });

      expect(result.data.cpu_usage).toHaveLength(1440);
    });
  });

  describe("Security Validation", () => {
    it("should validate device access permissions", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: "Forbidden",
        json: async () => ({
          error: {
            code: "INSUFFICIENT_PERMISSIONS",
            message: "Insufficient permissions to access device",
          },
        }),
      } as Response);

      await expect(client.getNetworkDevice("restricted_device")).rejects.toThrow("Forbidden");
    });

    it("should handle unauthorized topology access", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
        json: async () => ({
          error: {
            code: "INVALID_TOKEN",
            message: "Authentication token is invalid",
          },
        }),
      } as Response);

      await expect(client.getNetworkTopology()).rejects.toThrow("Unauthorized");
    });

    it("should validate IP address ranges for discovery", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: "Bad Request",
        json: async () => ({
          error: {
            code: "INVALID_SUBNET",
            message: "Invalid subnet range for discovery",
          },
        }),
      } as Response);

      await expect(
        client.discoverDevices({
          subnet: "invalid-subnet",
        }),
      ).rejects.toThrow("Bad Request");
    });
  });
});
