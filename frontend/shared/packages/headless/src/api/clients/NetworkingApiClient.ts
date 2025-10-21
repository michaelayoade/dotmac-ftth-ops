/**
 * Networking Management API Client
 * Handles network devices, topology, and monitoring
 */

import { BaseApiClient } from "./BaseApiClient";
import type { PaginatedResponse, QueryParams } from "../types/api";

export interface NetworkDevice {
  id: string;
  name: string;
  type: "router" | "switch" | "access_point" | "modem" | "ont";
  status: "online" | "offline" | "warning" | "error";
  ip_address: string;
  mac_address: string;
  location: string;
  last_seen: string;
  uptime: number;
  firmware_version: string;
}

export interface NetworkTopology {
  nodes: NetworkDevice[];
  connections: Array<{
    source: string;
    target: string;
    type: "physical" | "logical";
    status: "active" | "inactive";
  }>;
}

export class NetworkingApiClient extends BaseApiClient {
  constructor(baseURL: string, defaultHeaders: Record<string, string> = {}) {
    super(baseURL, defaultHeaders);
  }

  // Network device operations
  async getNetworkDevices(params?: QueryParams): Promise<PaginatedResponse<NetworkDevice>> {
    return this.get("/api/networking/devices", { params });
  }

  async getNetworkDevice(deviceId: string): Promise<{ data: NetworkDevice }> {
    return this.get(`/api/networking/devices/${deviceId}`);
  }

  async updateNetworkDevice(
    deviceId: string,
    data: Partial<NetworkDevice>,
  ): Promise<{ data: NetworkDevice }> {
    return this.put(`/api/networking/devices/${deviceId}`, data);
  }

  async rebootDevice(deviceId: string): Promise<{ success: boolean }> {
    return this.post(`/api/networking/devices/${deviceId}/reboot`, {});
  }

  // Network topology operations
  async getNetworkTopology(params?: {
    depth?: number;
    filter?: string;
  }): Promise<{ data: NetworkTopology }> {
    return this.get("/api/networking/topology", { params });
  }

  async discoverDevices(params?: {
    subnet?: string;
    timeout?: number;
  }): Promise<{ data: NetworkDevice[] }> {
    return this.post("/api/networking/discover", params);
  }

  // Monitoring operations
  async getDeviceMetrics(
    deviceId: string,
    params?: {
      start_time?: string;
      end_time?: string;
      metrics?: string[];
    },
  ): Promise<{ data: any }> {
    return this.get(`/api/networking/devices/${deviceId}/metrics`, { params });
  }

  async getNetworkHealth(): Promise<{ data: any }> {
    return this.get("/api/networking/health");
  }

  async getDeviceAlerts(params?: {
    severity?: "low" | "medium" | "high" | "critical";
    status?: "active" | "resolved";
    limit?: number;
  }): Promise<PaginatedResponse<any>> {
    return this.get("/api/networking/alerts", { params });
  }
}
