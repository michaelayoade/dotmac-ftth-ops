/**
 * InventoryApiClient Tests
 * Critical test suite for equipment tracking and asset lifecycle management
 */

import { InventoryApiClient } from "../InventoryApiClient";
import type {
  InventoryItem,
  StockMovement,
  WorkOrder,
  StockLevel,
  Vendor,
  InventoryLocation,
  PurchaseInfo,
  WarrantyInfo,
} from "../InventoryApiClient";

// Mock fetch
global.fetch = jest.fn();
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

describe("InventoryApiClient", () => {
  let client: InventoryApiClient;
  const baseURL = "https://api.test.com";
  const defaultHeaders = { Authorization: "Bearer test-token" };

  beforeEach(() => {
    client = new InventoryApiClient(baseURL, defaultHeaders);
    jest.clearAllMocks();
  });

  const mockResponse = <T>(data: T, status = 200) => {
    mockFetch.mockResolvedValueOnce({
      ok: status >= 200 && status < 300,
      status,
      json: async () => data,
    } as Response);
  };

  describe("Inventory Items Management", () => {
    const mockLocation: InventoryLocation = {
      type: "WAREHOUSE",
      location_id: "wh_main",
      location_name: "Main Warehouse",
      address: "123 Storage Ave, City, State",
      coordinates: { latitude: 40.7128, longitude: -74.006 },
      zone: "A",
      bin_location: "A-15-C",
    };

    const mockPurchaseInfo: PurchaseInfo = {
      vendor: "TechSupply Inc",
      purchase_order: "PO-2024-0156",
      purchase_date: "2024-01-10T00:00:00Z",
      purchase_price: 125.0,
      invoice_number: "INV-TS-2024-0234",
    };

    const mockWarranty: WarrantyInfo = {
      warranty_period: 36,
      warranty_start: "2024-01-15T00:00:00Z",
      warranty_end: "2027-01-15T00:00:00Z",
      warranty_provider: "Manufacturer",
      warranty_terms: "3-year limited hardware warranty",
    };

    const mockInventoryItem: InventoryItem = {
      id: "item_123",
      sku: "RT-AC68U-001",
      name: "ASUS RT-AC68U Wireless Router",
      description: "Dual-band AC1900 wireless router",
      category: "ROUTER",
      manufacturer: "ASUS",
      model: "RT-AC68U",
      serial_number: "ASN123456789",
      mac_address: "00:1A:2B:3C:4D:5E",
      status: "IN_STOCK",
      condition: "NEW",
      location: mockLocation,
      purchase_info: mockPurchaseInfo,
      warranty_info: mockWarranty,
      specifications: {
        wireless_standard: "802.11ac",
        max_speed: "1900 Mbps",
        ports: 4,
        frequency_bands: ["2.4GHz", "5GHz"],
      },
      cost: 125.0,
      retail_price: 179.99,
      created_at: "2024-01-15T08:00:00Z",
      updated_at: "2024-01-15T08:00:00Z",
    };

    it("should get inventory items with filtering", async () => {
      mockResponse({
        data: [mockInventoryItem],
        pagination: {
          page: 1,
          limit: 50,
          total: 1,
          total_pages: 1,
        },
      });

      const result = await client.getInventoryItems({
        category: "ROUTER",
        status: "IN_STOCK",
        location_id: "wh_main",
        manufacturer: "ASUS",
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/inventory/items?category=ROUTER&status=IN_STOCK&location_id=wh_main&manufacturer=ASUS",
        expect.any(Object),
      );

      expect(result.data).toHaveLength(1);
      expect(result.data[0].sku).toBe("RT-AC68U-001");
    });

    it("should create inventory item with complete specifications", async () => {
      const newItemData = {
        sku: "ONT-G240G-001",
        name: "Gigabit ONT G240G",
        description: "Gigabit optical network terminal",
        category: "ONT" as const,
        manufacturer: "ZyXEL",
        model: "G240G",
        serial_number: "ZYX987654321",
        status: "IN_STOCK" as const,
        condition: "NEW" as const,
        location: {
          type: "WAREHOUSE" as const,
          location_id: "wh_main",
          location_name: "Main Warehouse",
          zone: "B",
          bin_location: "B-08-A",
        },
        specifications: {
          ports: { ethernet: 4, usb: 2, phone: 2 },
          power_consumption: "12W",
          operating_temp: "-40 to 65°C",
        },
        cost: 89.5,
        retail_price: 129.99,
      };

      mockResponse({
        data: {
          ...newItemData,
          id: "item_124",
          created_at: "2024-01-16T10:00:00Z",
          updated_at: "2024-01-16T10:00:00Z",
        },
      });

      const result = await client.createInventoryItem(newItemData);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/inventory/items",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify(newItemData),
        }),
      );

      expect(result.data.id).toBe("item_124");
      expect(result.data.category).toBe("ONT");
    });

    it("should search inventory by SKU", async () => {
      mockResponse({
        data: [mockInventoryItem],
      });

      const result = await client.searchInventoryBySku("RT-AC68U-001");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/inventory/items/search?sku=RT-AC68U-001",
        expect.any(Object),
      );

      expect(result.data).toHaveLength(1);
      expect(result.data[0].sku).toBe("RT-AC68U-001");
    });

    it("should search inventory by serial number", async () => {
      mockResponse({
        data: [mockInventoryItem],
      });

      const result = await client.searchInventoryBySerial("ASN123456789");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/inventory/items/search?serial_number=ASN123456789",
        expect.any(Object),
      );

      expect(result.data[0].serial_number).toBe("ASN123456789");
    });
  });

  describe("Stock Management Operations", () => {
    const mockStockLevel: StockLevel = {
      sku: "RT-AC68U-001",
      item_name: "ASUS RT-AC68U Wireless Router",
      location_id: "wh_main",
      location_name: "Main Warehouse",
      current_stock: 25,
      reserved_stock: 5,
      available_stock: 20,
      reorder_level: 10,
      max_stock_level: 50,
      last_movement: "2024-01-15T14:30:00Z",
    };

    const mockStockMovement: StockMovement = {
      id: "mov_123",
      item_id: "item_123",
      movement_type: "RECEIVE",
      quantity: 10,
      to_location: {
        type: "WAREHOUSE",
        location_id: "wh_main",
        location_name: "Main Warehouse",
      },
      reason: "Vendor delivery",
      reference_number: "PO-2024-0156",
      performed_by: "warehouse_staff_456",
      notes: "Delivery from TechSupply Inc, all items inspected",
      created_at: "2024-01-15T14:30:00Z",
    };

    it("should get stock levels with low stock filtering", async () => {
      mockResponse({
        data: [{ ...mockStockLevel, current_stock: 8, available_stock: 5 }],
        pagination: {
          page: 1,
          limit: 100,
          total: 1,
          total_pages: 1,
        },
      });

      const result = await client.getStockLevels({
        location_id: "wh_main",
        low_stock: true,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/inventory/stock-levels?location_id=wh_main&low_stock=true",
        expect.any(Object),
      );

      expect(result.data[0].current_stock).toBe(8);
      expect(result.data[0].available_stock).toBe(5);
    });

    it("should record stock movement", async () => {
      const movementData = {
        item_id: "item_123",
        movement_type: "ISSUE" as const,
        quantity: 2,
        from_location: {
          type: "WAREHOUSE" as const,
          location_id: "wh_main",
          location_name: "Main Warehouse",
        },
        to_location: {
          type: "TECHNICIAN" as const,
          location_id: "tech_789",
          location_name: "Technician John Doe",
        },
        reason: "Work order assignment",
        reference_number: "WO-2024-1234",
        performed_by: "dispatch_456",
        notes: "Assigned to installation work order",
      };

      mockResponse({
        data: {
          ...movementData,
          id: "mov_124",
          created_at: "2024-01-16T09:15:00Z",
        },
      });

      const result = await client.recordStockMovement(movementData);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/inventory/movements",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify(movementData),
        }),
      );

      expect(result.data.movement_type).toBe("ISSUE");
      expect(result.data.quantity).toBe(2);
    });

    it("should receive stock with purchase information", async () => {
      const receiveData = {
        items: [
          {
            sku: "RT-AC68U-001",
            quantity: 15,
            serial_numbers: ["ASN001", "ASN002", "ASN003"],
            location_id: "wh_main",
            purchase_info: {
              vendor: "TechSupply Inc",
              purchase_order: "PO-2024-0180",
              purchase_date: "2024-01-16T00:00:00Z",
              purchase_price: 125.0,
            },
          },
        ],
        reference_number: "RECV-2024-0045",
        notes: "Weekly restocking delivery",
      };

      mockResponse({
        data: [
          {
            id: "mov_125",
            item_id: "item_123",
            movement_type: "RECEIVE",
            quantity: 15,
            to_location: {
              type: "WAREHOUSE",
              location_id: "wh_main",
              location_name: "Main Warehouse",
            },
            reason: "Stock receiving",
            reference_number: "RECV-2024-0045",
            performed_by: "system",
            created_at: "2024-01-16T11:00:00Z",
          },
        ],
      });

      const result = await client.receiveStock(receiveData);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/inventory/receive",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify(receiveData),
        }),
      );

      expect(result.data).toHaveLength(1);
      expect(result.data[0].movement_type).toBe("RECEIVE");
    });

    it("should issue stock to technician", async () => {
      const issueData = {
        items: [
          {
            sku: "RT-AC68U-001",
            quantity: 1,
            serial_numbers: ["ASN123456789"],
          },
          {
            sku: "CBL-CAT6-100",
            quantity: 2,
          },
        ],
        issued_to: "tech_789",
        work_order_id: "wo_456",
        purpose: "Customer installation",
        notes: "Installation at 456 Oak Street",
      };

      mockResponse({
        data: [
          {
            id: "mov_126",
            item_id: "item_123",
            movement_type: "ISSUE",
            quantity: 1,
            from_location: {
              type: "WAREHOUSE",
              location_id: "wh_main",
              location_name: "Main Warehouse",
            },
            to_location: {
              type: "TECHNICIAN",
              location_id: "tech_789",
              location_name: "Technician John Doe",
            },
            reason: "Customer installation",
            reference_number: "wo_456",
            performed_by: "system",
            created_at: "2024-01-16T08:30:00Z",
          },
        ],
      });

      const result = await client.issueStock(issueData);

      expect(result.data[0].movement_type).toBe("ISSUE");
      expect(result.data[0].reference_number).toBe("wo_456");
    });

    it("should transfer stock between locations", async () => {
      const transferData = {
        items: [
          {
            item_id: "item_123",
            quantity: 3,
          },
        ],
        from_location_id: "wh_main",
        to_location_id: "wh_branch",
        reason: "Branch restocking",
        notes: "Monthly inventory redistribution",
      };

      mockResponse({
        data: [
          {
            id: "mov_127",
            item_id: "item_123",
            movement_type: "TRANSFER",
            quantity: 3,
            from_location: {
              type: "WAREHOUSE",
              location_id: "wh_main",
              location_name: "Main Warehouse",
            },
            to_location: {
              type: "WAREHOUSE",
              location_id: "wh_branch",
              location_name: "Branch Warehouse",
            },
            reason: "Branch restocking",
            performed_by: "warehouse_manager",
            created_at: "2024-01-16T13:45:00Z",
          },
        ],
      });

      const result = await client.transferStock(transferData);

      expect(result.data[0].movement_type).toBe("TRANSFER");
      expect(result.data[0].from_location?.location_id).toBe("wh_main");
      expect(result.data[0].to_location?.location_id).toBe("wh_branch");
    });
  });

  describe("Work Order Management", () => {
    const mockWorkOrder: WorkOrder = {
      id: "wo_123",
      work_order_number: "WO-2024-1234",
      type: "INSTALLATION",
      customer_id: "cust_456",
      customer_name: "Alice Johnson",
      address: "456 Oak Street, Springfield, ST 12345",
      scheduled_date: "2024-01-17T09:00:00Z",
      technician_id: "tech_789",
      technician_name: "John Doe",
      status: "SCHEDULED",
      required_equipment: [
        {
          sku: "RT-AC68U-001",
          quantity: 1,
          required: true,
          alternatives: ["RT-AC66U-001"],
        },
        {
          sku: "CBL-CAT6-100",
          quantity: 2,
          required: true,
        },
      ],
      assigned_equipment: [],
      notes: "Fiber installation with router setup",
      created_at: "2024-01-15T10:00:00Z",
      updated_at: "2024-01-16T08:00:00Z",
    };

    it("should create work order with equipment requirements", async () => {
      const workOrderData = {
        type: "INSTALLATION" as const,
        customer_id: "cust_789",
        customer_name: "Bob Smith",
        address: "789 Pine Avenue, Springfield, ST 12345",
        scheduled_date: "2024-01-18T14:00:00Z",
        technician_id: "tech_456",
        technician_name: "Jane Smith",
        status: "SCHEDULED" as const,
        required_equipment: [
          {
            sku: "ONT-G240G-001",
            quantity: 1,
            required: true,
          },
          {
            sku: "CBL-FIBER-50",
            quantity: 1,
            required: true,
          },
        ],
        assigned_equipment: [],
        notes: "Gigabit fiber installation",
      };

      mockResponse({
        data: {
          ...workOrderData,
          id: "wo_124",
          work_order_number: "WO-2024-1235",
          created_at: "2024-01-16T12:00:00Z",
          updated_at: "2024-01-16T12:00:00Z",
        },
      });

      const result = await client.createWorkOrder(workOrderData);

      expect(result.data.id).toBe("wo_124");
      expect(result.data.type).toBe("INSTALLATION");
      expect(result.data.required_equipment).toHaveLength(2);
    });

    it("should assign equipment to work order", async () => {
      const assignedEquipment = [
        {
          item_id: "item_123",
          sku: "RT-AC68U-001",
          serial_number: "ASN123456789",
          quantity: 1,
          status: "ASSIGNED" as const,
        },
        {
          item_id: "item_456",
          sku: "CBL-CAT6-100",
          quantity: 2,
          status: "ASSIGNED" as const,
        },
      ];

      mockResponse({
        data: {
          ...mockWorkOrder,
          assigned_equipment: assignedEquipment,
          updated_at: "2024-01-16T14:00:00Z",
        },
      });

      const result = await client.assignEquipmentToWorkOrder("wo_123", assignedEquipment);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/inventory/work-orders/wo_123/assign-equipment",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ equipment: assignedEquipment }),
        }),
      );

      expect(result.data.assigned_equipment).toHaveLength(2);
      expect(result.data.assigned_equipment[0].status).toBe("ASSIGNED");
    });

    it("should complete work order with equipment usage", async () => {
      const completionData = {
        equipment_used: [
          {
            item_id: "item_123",
            sku: "RT-AC68U-001",
            serial_number: "ASN123456789",
            quantity: 1,
            status: "DEPLOYED" as const,
          },
        ],
        equipment_returned: [
          {
            item_id: "item_456",
            sku: "CBL-CAT6-100",
            quantity: 1,
            status: "RETURNED" as const,
          },
        ],
        notes: "Installation completed successfully. Customer trained on router usage.",
      };

      mockResponse({
        data: {
          ...mockWorkOrder,
          status: "COMPLETED",
          assigned_equipment: [
            {
              item_id: "item_123",
              sku: "RT-AC68U-001",
              serial_number: "ASN123456789",
              quantity: 1,
              status: "DEPLOYED",
            },
          ],
          updated_at: "2024-01-17T11:30:00Z",
        },
      });

      const result = await client.completeWorkOrder("wo_123", completionData);

      expect(result.data.status).toBe("COMPLETED");
      expect(result.data.assigned_equipment[0].status).toBe("DEPLOYED");
    });

    it("should get work orders with status filtering", async () => {
      mockResponse({
        data: [mockWorkOrder],
        pagination: {
          page: 1,
          limit: 20,
          total: 1,
          total_pages: 1,
        },
      });

      const result = await client.getWorkOrders({
        status: "SCHEDULED",
        technician_id: "tech_789",
        date: "2024-01-17",
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/inventory/work-orders?status=SCHEDULED&technician_id=tech_789&date=2024-01-17",
        expect.any(Object),
      );

      expect(result.data[0].status).toBe("SCHEDULED");
    });
  });

  describe("Asset Lifecycle Management", () => {
    it("should deploy asset to customer", async () => {
      const deploymentData = {
        customer_id: "cust_456",
        installation_address: "456 Oak Street, Springfield, ST 12345",
        technician_id: "tech_789",
        work_order_id: "wo_123",
        notes: "Router installed in home office",
      };

      mockResponse({
        data: {
          ...mockInventoryItem,
          status: "DEPLOYED",
          assigned_to: "cust_456",
          deployment_date: "2024-01-17T10:30:00Z",
          location: {
            type: "CUSTOMER",
            location_id: "cust_456",
            location_name: "Customer: Alice Johnson",
            address: "456 Oak Street, Springfield, ST 12345",
          },
          updated_at: "2024-01-17T10:30:00Z",
        },
      });

      const result = await client.deployAsset("item_123", deploymentData);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/inventory/items/item_123/deploy",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify(deploymentData),
        }),
      );

      expect(result.data.status).toBe("DEPLOYED");
      expect(result.data.location.type).toBe("CUSTOMER");
    });

    it("should return asset from customer", async () => {
      const returnData = {
        reason: "Service cancellation",
        condition: "USED" as const,
        return_location_id: "wh_main",
        notes: "Customer moved, equipment returned in good condition",
      };

      mockResponse({
        data: {
          ...mockInventoryItem,
          status: "IN_STOCK",
          condition: "USED",
          assigned_to: undefined,
          deployment_date: undefined,
          location: {
            type: "WAREHOUSE",
            location_id: "wh_main",
            location_name: "Main Warehouse",
            zone: "RETURNS",
            bin_location: "R-05-B",
          },
          updated_at: "2024-01-17T15:45:00Z",
        },
      });

      const result = await client.returnAsset("item_123", returnData);

      expect(result.data.status).toBe("IN_STOCK");
      expect(result.data.condition).toBe("USED");
      expect(result.data.location.zone).toBe("RETURNS");
    });

    it("should mark asset for maintenance", async () => {
      const maintenanceData = {
        issue_description: "Overheating during heavy load",
        maintenance_type: "CORRECTIVE" as const,
        estimated_repair_date: "2024-01-20T10:00:00Z",
      };

      mockResponse({
        data: {
          ...mockInventoryItem,
          status: "MAINTENANCE",
          location: {
            type: "REPAIR_CENTER",
            location_id: "repair_main",
            location_name: "Main Repair Center",
          },
          updated_at: "2024-01-17T16:00:00Z",
        },
      });

      const result = await client.markAssetForMaintenance("item_123", maintenanceData);

      expect(result.data.status).toBe("MAINTENANCE");
      expect(result.data.location.type).toBe("REPAIR_CENTER");
    });

    it("should retire asset", async () => {
      mockResponse({
        data: {
          ...mockInventoryItem,
          status: "RETIRED",
          updated_at: "2024-01-17T17:00:00Z",
        },
      });

      const result = await client.retireAsset("item_123", "End of useful life");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/inventory/items/item_123/retire",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ reason: "End of useful life" }),
        }),
      );

      expect(result.data.status).toBe("RETIRED");
    });
  });

  describe("Vendors and Procurement", () => {
    const mockVendor: Vendor = {
      id: "vendor_123",
      name: "TechSupply Inc",
      contact_info: {
        email: "orders@techsupply.com",
        phone: "+1-555-0123",
        address: "123 Industrial Blvd, Tech City, TC 12345",
      },
      payment_terms: "Net 30",
      lead_time_days: 7,
      preferred: true,
      active: true,
    };

    it("should get active vendors", async () => {
      mockResponse({
        data: [mockVendor],
        pagination: {
          page: 1,
          limit: 50,
          total: 1,
          total_pages: 1,
        },
      });

      const result = await client.getVendors({ active: true });

      expect(result.data[0].name).toBe("TechSupply Inc");
      expect(result.data[0].active).toBe(true);
    });

    it("should create purchase order", async () => {
      const poData = {
        vendor_id: "vendor_123",
        items: [
          {
            sku: "RT-AC68U-001",
            quantity: 20,
            unit_price: 125.0,
          },
          {
            sku: "ONT-G240G-001",
            quantity: 15,
            unit_price: 89.5,
          },
        ],
        delivery_date: "2024-01-25T00:00:00Z",
        notes: "Quarterly restocking order",
      };

      mockResponse({
        data: {
          purchase_order_id: "po_789",
          po_number: "PO-2024-0189",
        },
      });

      const result = await client.createPurchaseOrder(poData);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/inventory/purchase-orders",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify(poData),
        }),
      );

      expect(result.data.po_number).toBe("PO-2024-0189");
    });
  });

  describe("Reports and Analytics", () => {
    it("should get stock levels report", async () => {
      const stockReport = {
        report_date: "2024-01-17T00:00:00Z",
        locations: [
          {
            location_id: "wh_main",
            location_name: "Main Warehouse",
            items: [
              {
                sku: "RT-AC68U-001",
                item_name: "ASUS RT-AC68U Wireless Router",
                current_stock: 25,
                value: 3125.0,
              },
              {
                sku: "ONT-G240G-001",
                item_name: "Gigabit ONT G240G",
                current_stock: 18,
                value: 1611.0,
              },
            ],
            total_value: 4736.0,
          },
        ],
        grand_total_value: 4736.0,
      };

      mockResponse({ data: stockReport });

      const result = await client.getInventoryReport("STOCK_LEVELS", {
        location_id: "wh_main",
        start_date: "2024-01-01",
        end_date: "2024-01-17",
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/inventory/reports/stock_levels?location_id=wh_main&start_date=2024-01-01&end_date=2024-01-17",
        expect.any(Object),
      );

      expect(result.data.grand_total_value).toBe(4736.0);
    });

    it("should get asset utilization analytics", async () => {
      const utilizationData = {
        period: "2024-Q1",
        categories: [
          {
            category: "ROUTER",
            total_assets: 150,
            deployed_assets: 125,
            utilization_rate: 83.3,
            avg_deployment_duration: 18.5,
          },
          {
            category: "ONT",
            total_assets: 200,
            deployed_assets: 180,
            utilization_rate: 90.0,
            avg_deployment_duration: 24.2,
          },
        ],
        overall_utilization: 86.7,
      };

      mockResponse({ data: utilizationData });

      const result = await client.getAssetUtilization({
        start_date: "2024-01-01",
        end_date: "2024-03-31",
      });

      expect(result.data.overall_utilization).toBe(86.7);
      expect(result.data.categories).toHaveLength(2);
    });

    it("should get low stock alerts", async () => {
      const lowStockAlerts = [
        {
          sku: "CBL-CAT6-100",
          current_stock: 8,
          reorder_level: 15,
          location: "Main Warehouse",
        },
        {
          sku: "ANT-5GHZ-001",
          current_stock: 3,
          reorder_level: 10,
          location: "Branch Warehouse",
        },
      ];

      mockResponse({ data: lowStockAlerts });

      const result = await client.getLowStockAlerts();

      expect(result.data).toHaveLength(2);
      expect(result.data[0].current_stock).toBeLessThan(result.data[0].reorder_level);
    });

    it("should get warranty expiration alerts", async () => {
      const warrantyAlerts = [
        {
          item_id: "item_123",
          warranty_end: "2024-02-15T00:00:00Z",
          days_remaining: 29,
        },
        {
          item_id: "item_456",
          warranty_end: "2024-01-25T00:00:00Z",
          days_remaining: 8,
        },
      ];

      mockResponse({ data: warrantyAlerts });

      const result = await client.getWarrantyExpirations({ days_ahead: 30 });

      expect(result.data).toHaveLength(2);
      expect(result.data[1].days_remaining).toBe(8);
    });
  });

  describe("Barcode and RFID Operations", () => {
    it("should generate barcode for item", async () => {
      const barcodeData = {
        barcode: "123456789012",
        barcode_image_url: "https://storage.example.com/barcodes/item_123.png",
      };

      mockResponse({ data: barcodeData });

      const result = await client.generateBarcode("item_123");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/inventory/items/item_123/barcode",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({}),
        }),
      );

      expect(result.data.barcode).toBe("123456789012");
      expect(result.data.barcode_image_url).toContain(".png");
    });

    it("should scan barcode and return item", async () => {
      mockResponse({ data: mockInventoryItem });

      const result = await client.scanBarcode("123456789012");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/inventory/scan/123456789012",
        expect.any(Object),
      );

      expect(result.data.id).toBe("item_123");
    });

    it("should perform bulk updates by barcode", async () => {
      const bulkUpdates = [
        {
          barcode: "123456789012",
          updates: {
            location: {
              type: "TRUCK" as const,
              location_id: "truck_456",
              location_name: "Service Truck 456",
            },
          },
        },
        {
          barcode: "123456789013",
          updates: {
            status: "MAINTENANCE" as const,
          },
        },
      ];

      mockResponse({
        data: {
          updated: 2,
          errors: [],
        },
      });

      const result = await client.bulkUpdateByBarcode(bulkUpdates);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/inventory/bulk-update",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ updates: bulkUpdates }),
        }),
      );

      expect(result.data.updated).toBe(2);
      expect(result.data.errors).toHaveLength(0);
    });
  });

  describe("Error Handling and Edge Cases", () => {
    it("should handle item not found errors", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
        json: async () => ({
          error: {
            code: "ITEM_NOT_FOUND",
            message: "Inventory item not found",
          },
        }),
      } as Response);

      await expect(client.getInventoryItem("invalid_item")).rejects.toThrow("Not Found");
    });

    it("should handle insufficient stock errors", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: "Bad Request",
        json: async () => ({
          error: {
            code: "INSUFFICIENT_STOCK",
            message: "Not enough stock available",
            details: { requested: 10, available: 5 },
          },
        }),
      } as Response);

      await expect(
        client.issueStock({
          items: [{ sku: "RT-AC68U-001", quantity: 10 }],
          issued_to: "tech_789",
          purpose: "Installation",
        }),
      ).rejects.toThrow("Bad Request");
    });

    it("should handle network connectivity errors", async () => {
      mockFetch.mockRejectedValue(new Error("Network connection failed"));

      await expect(client.getInventoryItems()).rejects.toThrow("Network connection failed");
    });
  });

  describe("Performance and Scalability", () => {
    it("should handle large inventory lists efficiently", async () => {
      const largeInventoryList = Array.from({ length: 1000 }, (_, i) => ({
        ...mockInventoryItem,
        id: `item_${i}`,
        sku: `SKU-${String(i).padStart(4, "0")}`,
      }));

      mockResponse({
        data: largeInventoryList,
        pagination: {
          page: 1,
          limit: 1000,
          total: 1000,
          total_pages: 1,
        },
      });

      const startTime = performance.now();
      const result = await client.getInventoryItems({ limit: 1000 });
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(100);
      expect(result.data).toHaveLength(1000);
    });

    it("should handle complex work orders with many equipment items", async () => {
      const complexWorkOrder = {
        ...mockWorkOrder,
        required_equipment: Array.from({ length: 50 }, (_, i) => ({
          sku: `ITEM-${String(i).padStart(3, "0")}`,
          quantity: Math.floor(Math.random() * 5) + 1,
          required: i < 25, // First 25 are required
        })),
      };

      mockResponse({ data: complexWorkOrder });

      const result = await client.getWorkOrder("complex_wo");

      expect(result.data.required_equipment).toHaveLength(50);
    });
  });
});
