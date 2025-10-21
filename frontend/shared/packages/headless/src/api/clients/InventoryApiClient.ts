/**
 * Inventory & Asset Management API Client
 * Handles equipment tracking, asset lifecycle, and stock management
 */

import { BaseApiClient } from "./BaseApiClient";
import type { PaginatedResponse, QueryParams } from "../types/api";

export interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  description: string;
  category: "MODEM" | "ROUTER" | "ONT" | "CABLE" | "ANTENNA" | "SWITCH" | "ACCESSORY" | "OTHER";
  manufacturer: string;
  model: string;
  serial_number?: string;
  mac_address?: string;
  status: "IN_STOCK" | "DEPLOYED" | "RESERVED" | "MAINTENANCE" | "DEFECTIVE" | "RETIRED";
  condition: "NEW" | "REFURBISHED" | "USED" | "DAMAGED";
  location: InventoryLocation;
  purchase_info?: PurchaseInfo;
  warranty_info?: WarrantyInfo;
  specifications: Record<string, any>;
  cost: number;
  retail_price?: number;
  assigned_to?: string;
  deployment_date?: string;
  created_at: string;
  updated_at: string;
}

export interface InventoryLocation {
  type: "WAREHOUSE" | "TRUCK" | "CUSTOMER" | "TECHNICIAN" | "REPAIR_CENTER";
  location_id: string;
  location_name: string;
  address?: string;
  coordinates?: { latitude: number; longitude: number };
  zone?: string;
  bin_location?: string;
}

export interface PurchaseInfo {
  vendor: string;
  purchase_order: string;
  purchase_date: string;
  purchase_price: number;
  invoice_number?: string;
}

export interface WarrantyInfo {
  warranty_period: number;
  warranty_start: string;
  warranty_end: string;
  warranty_provider: string;
  warranty_terms: string;
}

export interface StockMovement {
  id: string;
  item_id: string;
  movement_type: "RECEIVE" | "ISSUE" | "TRANSFER" | "RETURN" | "ADJUSTMENT" | "WRITE_OFF";
  quantity: number;
  from_location?: InventoryLocation;
  to_location?: InventoryLocation;
  reason: string;
  reference_number?: string;
  performed_by: string;
  notes?: string;
  created_at: string;
}

export interface StockLevel {
  sku: string;
  item_name: string;
  location_id: string;
  location_name: string;
  current_stock: number;
  reserved_stock: number;
  available_stock: number;
  reorder_level: number;
  max_stock_level: number;
  last_movement: string;
}

export interface WorkOrder {
  id: string;
  work_order_number: string;
  type: "INSTALLATION" | "MAINTENANCE" | "REPAIR" | "UPGRADE" | "REMOVAL";
  customer_id: string;
  customer_name: string;
  address: string;
  scheduled_date: string;
  technician_id?: string;
  technician_name?: string;
  status: "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  required_equipment: EquipmentRequirement[];
  assigned_equipment: AssignedEquipment[];
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface EquipmentRequirement {
  sku: string;
  quantity: number;
  required: boolean;
  alternatives?: string[];
}

export interface AssignedEquipment {
  item_id: string;
  sku: string;
  serial_number?: string;
  quantity: number;
  status: "ASSIGNED" | "DEPLOYED" | "RETURNED";
}

export interface Vendor {
  id: string;
  name: string;
  contact_info: {
    email: string;
    phone: string;
    address: string;
  };
  payment_terms: string;
  lead_time_days: number;
  preferred: boolean;
  active: boolean;
}

export class InventoryApiClient extends BaseApiClient {
  constructor(baseURL: string, defaultHeaders: Record<string, string> = {}) {
    super(baseURL, defaultHeaders);
  }

  // Inventory Items
  async getInventoryItems(params?: QueryParams): Promise<PaginatedResponse<InventoryItem>> {
    return this.get("/api/inventory/items", { params });
  }

  async getInventoryItem(itemId: string): Promise<{ data: InventoryItem }> {
    return this.get(`/api/inventory/items/${itemId}`);
  }

  async createInventoryItem(
    data: Omit<InventoryItem, "id" | "created_at" | "updated_at">,
  ): Promise<{ data: InventoryItem }> {
    return this.post("/api/inventory/items", data);
  }

  async updateInventoryItem(
    itemId: string,
    data: Partial<InventoryItem>,
  ): Promise<{ data: InventoryItem }> {
    return this.put(`/api/inventory/items/${itemId}`, data);
  }

  async deleteInventoryItem(itemId: string): Promise<{ success: boolean }> {
    return this.delete(`/api/inventory/items/${itemId}`);
  }

  async searchInventoryBySku(sku: string): Promise<{ data: InventoryItem[] }> {
    return this.get(`/api/inventory/items/search`, { params: { sku } });
  }

  async searchInventoryBySerial(serialNumber: string): Promise<{ data: InventoryItem[] }> {
    return this.get(`/api/inventory/items/search`, {
      params: { serial_number: serialNumber },
    });
  }

  // Stock Management
  async getStockLevels(params?: {
    location_id?: string;
    sku?: string;
    low_stock?: boolean;
  }): Promise<PaginatedResponse<StockLevel>> {
    return this.get("/api/inventory/stock-levels", { params });
  }

  async getStockMovements(
    itemId?: string,
    params?: QueryParams,
  ): Promise<PaginatedResponse<StockMovement>> {
    const endpoint = itemId
      ? `/api/inventory/items/${itemId}/movements`
      : "/api/inventory/movements";
    return this.get(endpoint, { params });
  }

  async recordStockMovement(
    data: Omit<StockMovement, "id" | "created_at">,
  ): Promise<{ data: StockMovement }> {
    return this.post("/api/inventory/movements", data);
  }

  async receiveStock(data: {
    items: Array<{
      sku: string;
      quantity: number;
      serial_numbers?: string[];
      location_id: string;
      purchase_info?: PurchaseInfo;
    }>;
    reference_number?: string;
    notes?: string;
  }): Promise<{ data: StockMovement[] }> {
    return this.post("/api/inventory/receive", data);
  }

  async issueStock(data: {
    items: Array<{
      item_id?: string;
      sku: string;
      quantity: number;
      serial_numbers?: string[];
    }>;
    issued_to: string;
    work_order_id?: string;
    purpose: string;
    notes?: string;
  }): Promise<{ data: StockMovement[] }> {
    return this.post("/api/inventory/issue", data);
  }

  async transferStock(data: {
    items: Array<{
      item_id: string;
      quantity: number;
    }>;
    from_location_id: string;
    to_location_id: string;
    reason: string;
    notes?: string;
  }): Promise<{ data: StockMovement[] }> {
    return this.post("/api/inventory/transfer", data);
  }

  // Work Orders
  async getWorkOrders(params?: QueryParams): Promise<PaginatedResponse<WorkOrder>> {
    return this.get("/api/inventory/work-orders", { params });
  }

  async getWorkOrder(workOrderId: string): Promise<{ data: WorkOrder }> {
    return this.get(`/api/inventory/work-orders/${workOrderId}`);
  }

  async createWorkOrder(
    data: Omit<WorkOrder, "id" | "work_order_number" | "created_at" | "updated_at">,
  ): Promise<{ data: WorkOrder }> {
    return this.post("/api/inventory/work-orders", data);
  }

  async updateWorkOrder(
    workOrderId: string,
    data: Partial<WorkOrder>,
  ): Promise<{ data: WorkOrder }> {
    return this.put(`/api/inventory/work-orders/${workOrderId}`, data);
  }

  async assignEquipmentToWorkOrder(
    workOrderId: string,
    equipment: AssignedEquipment[],
  ): Promise<{ data: WorkOrder }> {
    return this.post(`/api/inventory/work-orders/${workOrderId}/assign-equipment`, { equipment });
  }

  async completeWorkOrder(
    workOrderId: string,
    data: {
      equipment_used: AssignedEquipment[];
      equipment_returned?: AssignedEquipment[];
      notes?: string;
    },
  ): Promise<{ data: WorkOrder }> {
    return this.post(`/api/inventory/work-orders/${workOrderId}/complete`, data);
  }

  // Asset Lifecycle
  async deployAsset(
    itemId: string,
    data: {
      customer_id: string;
      installation_address: string;
      technician_id: string;
      work_order_id?: string;
      notes?: string;
    },
  ): Promise<{ data: InventoryItem }> {
    return this.post(`/api/inventory/items/${itemId}/deploy`, data);
  }

  async returnAsset(
    itemId: string,
    data: {
      reason: string;
      condition: InventoryItem["condition"];
      return_location_id: string;
      notes?: string;
    },
  ): Promise<{ data: InventoryItem }> {
    return this.post(`/api/inventory/items/${itemId}/return`, data);
  }

  async markAssetForMaintenance(
    itemId: string,
    data: {
      issue_description: string;
      maintenance_type: "PREVENTIVE" | "CORRECTIVE" | "EMERGENCY";
      estimated_repair_date?: string;
    },
  ): Promise<{ data: InventoryItem }> {
    return this.post(`/api/inventory/items/${itemId}/maintenance`, data);
  }

  async retireAsset(itemId: string, reason: string): Promise<{ data: InventoryItem }> {
    return this.post(`/api/inventory/items/${itemId}/retire`, { reason });
  }

  // Vendors & Procurement
  async getVendors(params?: QueryParams): Promise<PaginatedResponse<Vendor>> {
    return this.get("/api/inventory/vendors", { params });
  }

  async createPurchaseOrder(data: {
    vendor_id: string;
    items: Array<{
      sku: string;
      quantity: number;
      unit_price: number;
    }>;
    delivery_date?: string;
    notes?: string;
  }): Promise<{ data: { purchase_order_id: string; po_number: string } }> {
    return this.post("/api/inventory/purchase-orders", data);
  }

  // Reports & Analytics
  async getInventoryReport(
    reportType: "STOCK_LEVELS" | "MOVEMENTS" | "AGING" | "VALUATION",
    params?: {
      start_date?: string;
      end_date?: string;
      location_id?: string;
      category?: string;
    },
  ): Promise<{ data: any }> {
    return this.get(`/api/inventory/reports/${reportType.toLowerCase()}`, {
      params,
    });
  }

  async getAssetUtilization(params?: {
    start_date?: string;
    end_date?: string;
    asset_category?: string;
  }): Promise<{ data: any }> {
    return this.get("/api/inventory/analytics/utilization", { params });
  }

  async getLowStockAlerts(): Promise<{
    data: Array<{
      sku: string;
      current_stock: number;
      reorder_level: number;
      location: string;
    }>;
  }> {
    return this.get("/api/inventory/alerts/low-stock");
  }

  async getWarrantyExpirations(params?: { days_ahead?: number }): Promise<{
    data: Array<{
      item_id: string;
      warranty_end: string;
      days_remaining: number;
    }>;
  }> {
    return this.get("/api/inventory/alerts/warranty-expiring", { params });
  }

  // Barcode & RFID
  async generateBarcode(
    itemId: string,
  ): Promise<{ data: { barcode: string; barcode_image_url: string } }> {
    return this.post(`/api/inventory/items/${itemId}/barcode`, {});
  }

  async scanBarcode(barcode: string): Promise<{ data: InventoryItem }> {
    return this.get(`/api/inventory/scan/${barcode}`);
  }

  async bulkUpdateByBarcode(
    updates: Array<{
      barcode: string;
      updates: Partial<InventoryItem>;
    }>,
  ): Promise<{ data: { updated: number; errors: any[] } }> {
    return this.post("/api/inventory/bulk-update", { updates });
  }
}
