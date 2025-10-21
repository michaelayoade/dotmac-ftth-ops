/**
 * FieldOpsApiClient Tests
 * Critical test suite for technician dispatch and field service management
 */

import { FieldOpsApiClient } from "../FieldOpsApiClient";
import type {
  Technician,
  FieldWorkOrder,
  Route,
  TimeEntry,
  ServiceCall,
  TechnicianSkill,
  Certification,
  GeoLocation,
  TechnicianAssignment,
  WorkOrderPhoto,
  AddressData,
} from "../FieldOpsApiClient";

// Mock fetch
global.fetch = jest.fn();
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

describe("FieldOpsApiClient", () => {
  let client: FieldOpsApiClient;
  const baseURL = "https://api.test.com";
  const defaultHeaders = { Authorization: "Bearer test-token" };

  beforeEach(() => {
    client = new FieldOpsApiClient(baseURL, defaultHeaders);
    jest.clearAllMocks();
  });

  const mockResponse = <T>(data: T, status = 200) => {
    mockFetch.mockResolvedValueOnce({
      ok: status >= 200 && status < 300,
      status,
      json: async () => data,
    } as Response);
  };

  describe("Technician Management", () => {
    const mockSkills: TechnicianSkill[] = [
      {
        skill_id: "fiber_install",
        skill_name: "Fiber Installation",
        proficiency_level: "ADVANCED",
        certified: true,
        certification_date: "2023-06-15T00:00:00Z",
      },
      {
        skill_id: "network_troubleshooting",
        skill_name: "Network Troubleshooting",
        proficiency_level: "EXPERT",
        certified: true,
        certification_date: "2023-08-20T00:00:00Z",
      },
    ];

    const mockCertifications: Certification[] = [
      {
        id: "cert_fiber_001",
        name: "Fiber Optic Installation Certification",
        issuing_authority: "TechCorp Training",
        issue_date: "2023-06-15T00:00:00Z",
        expiry_date: "2026-06-15T00:00:00Z",
        status: "VALID",
      },
    ];

    const mockLocation: GeoLocation = {
      latitude: 40.7128,
      longitude: -74.006,
      accuracy: 10,
      timestamp: "2024-01-17T10:30:00Z",
      address: "123 Main St, City, ST 12345",
    };

    const mockTechnician: Technician = {
      id: "tech_123",
      employee_id: "EMP-789",
      name: "John Doe",
      email: "john.doe@company.com",
      phone: "+1-555-0123",
      status: "AVAILABLE",
      skills: mockSkills,
      certifications: mockCertifications,
      territories: ["north_zone", "downtown"],
      current_location: mockLocation,
      truck_inventory: ["item_001", "item_002", "item_003"],
      shift_start: "08:00",
      shift_end: "17:00",
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-17T10:30:00Z",
    };

    it("should get technicians with filtering", async () => {
      mockResponse({
        data: [mockTechnician],
        pagination: {
          page: 1,
          limit: 20,
          total: 1,
          total_pages: 1,
        },
      });

      const result = await client.getTechnicians({
        status: "AVAILABLE",
        territory: "north_zone",
        skills: "fiber_install",
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/field-ops/technicians?status=AVAILABLE&territory=north_zone&skills=fiber_install",
        expect.any(Object),
      );

      expect(result.data).toHaveLength(1);
      expect(result.data[0].status).toBe("AVAILABLE");
    });

    it("should create technician with skills and certifications", async () => {
      const technicianData = {
        employee_id: "EMP-890",
        name: "Jane Smith",
        email: "jane.smith@company.com",
        phone: "+1-555-0456",
        status: "AVAILABLE" as const,
        skills: [
          {
            skill_id: "cable_install",
            skill_name: "Cable Installation",
            proficiency_level: "INTERMEDIATE" as const,
            certified: false,
          },
        ],
        certifications: [],
        territories: ["south_zone"],
        shift_start: "09:00",
        shift_end: "18:00",
      };

      mockResponse({
        data: {
          ...technicianData,
          id: "tech_124",
          current_location: undefined,
          truck_inventory: [],
          created_at: "2024-01-17T11:00:00Z",
          updated_at: "2024-01-17T11:00:00Z",
        },
      });

      const result = await client.createTechnician(technicianData);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/field-ops/technicians",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify(technicianData),
        }),
      );

      expect(result.data.id).toBe("tech_124");
      expect(result.data.name).toBe("Jane Smith");
    });

    it("should update technician status", async () => {
      mockResponse({
        data: {
          ...mockTechnician,
          status: "BUSY",
          updated_at: "2024-01-17T11:15:00Z",
        },
      });

      const result = await client.updateTechnicianStatus("tech_123", "BUSY");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/field-ops/technicians/tech_123/status",
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify({ status: "BUSY" }),
        }),
      );

      expect(result.data.status).toBe("BUSY");
    });

    it("should update technician location", async () => {
      const newLocation: GeoLocation = {
        latitude: 40.7589,
        longitude: -73.9851,
        accuracy: 15,
        timestamp: "2024-01-17T11:30:00Z",
        address: "456 Oak Ave, City, ST 12345",
      };

      mockResponse({
        data: {
          ...mockTechnician,
          current_location: newLocation,
          updated_at: "2024-01-17T11:30:00Z",
        },
      });

      const result = await client.updateTechnicianLocation("tech_123", newLocation);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/field-ops/technicians/tech_123/location",
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify(newLocation),
        }),
      );

      expect(result.data.current_location?.latitude).toBe(40.7589);
    });

    it("should get available technicians with skill filtering", async () => {
      mockResponse({
        data: [mockTechnician],
      });

      const result = await client.getAvailableTechnicians({
        skills: ["fiber_install", "network_troubleshooting"],
        territory: "north_zone",
        date: "2024-01-17",
        time_range: {
          start: "10:00",
          end: "12:00",
        },
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/field-ops/technicians/available",
        expect.objectContaining({
          params: {
            skills: ["fiber_install", "network_troubleshooting"],
            territory: "north_zone",
            date: "2024-01-17",
            time_range: { start: "10:00", end: "12:00" },
          },
        }),
      );

      expect(result.data).toHaveLength(1);
      expect(result.data[0].status).toBe("AVAILABLE");
    });
  });

  describe("Work Order Management", () => {
    const mockServiceAddress: AddressData = {
      street: "789 Pine Street",
      city: "Springfield",
      state: "ST",
      zip: "12345",
      country: "US",
    };

    const mockTechnicianAssignment: TechnicianAssignment = {
      technician_id: "tech_123",
      technician_name: "John Doe",
      assigned_at: "2024-01-17T08:00:00Z",
      accepted_at: "2024-01-17T08:05:00Z",
      started_at: "2024-01-17T09:15:00Z",
      travel_time: 15,
      on_site_time: 120,
    };

    const mockWorkOrder: FieldWorkOrder = {
      id: "wo_123",
      work_order_number: "WO-2024-5678",
      type: "INSTALLATION",
      priority: "HIGH",
      status: "IN_PROGRESS",
      customer_id: "cust_456",
      customer_name: "Alice Johnson",
      customer_phone: "+1-555-0789",
      service_address: mockServiceAddress,
      description: "Gigabit fiber installation with router setup",
      special_instructions: "Customer has small children, minimize noise",
      estimated_duration: 180,
      scheduled_start: "2024-01-17T09:00:00Z",
      scheduled_end: "2024-01-17T12:00:00Z",
      assigned_technician: mockTechnicianAssignment,
      required_skills: ["fiber_install", "router_config"],
      required_equipment: [
        {
          item_sku: "ONT-G240G-001",
          quantity: 1,
          required: true,
          assigned_items: ["item_001"],
        },
        {
          item_sku: "FIBER-CABLE-50M",
          quantity: 1,
          required: true,
          assigned_items: ["item_002"],
        },
      ],
      photos: [],
      created_at: "2024-01-16T14:00:00Z",
      updated_at: "2024-01-17T09:15:00Z",
    };

    it("should create work order with requirements", async () => {
      const workOrderData = {
        type: "MAINTENANCE" as const,
        priority: "MEDIUM" as const,
        customer_id: "cust_789",
        customer_name: "Bob Smith",
        customer_phone: "+1-555-0321",
        service_address: {
          street: "321 Elm Drive",
          city: "Springfield",
          state: "ST",
          zip: "12345",
          country: "US",
        },
        description: "Router firmware update and performance check",
        estimated_duration: 90,
        scheduled_start: "2024-01-18T10:00:00Z",
        scheduled_end: "2024-01-18T11:30:00Z",
        required_skills: ["router_config", "firmware_update"],
        required_equipment: [
          {
            item_sku: "TOOL-LAPTOP-001",
            quantity: 1,
            required: true,
          },
        ],
      };

      mockResponse({
        data: {
          ...workOrderData,
          id: "wo_124",
          work_order_number: "WO-2024-5679",
          status: "CREATED",
          photos: [],
          created_at: "2024-01-17T12:00:00Z",
          updated_at: "2024-01-17T12:00:00Z",
        },
      });

      const result = await client.createWorkOrder(workOrderData);

      expect(result.data.id).toBe("wo_124");
      expect(result.data.type).toBe("MAINTENANCE");
      expect(result.data.status).toBe("CREATED");
    });

    it("should assign work order to technician", async () => {
      mockResponse({
        data: {
          ...mockWorkOrder,
          status: "ASSIGNED",
          assigned_technician: {
            technician_id: "tech_456",
            technician_name: "Jane Smith",
            assigned_at: "2024-01-17T12:30:00Z",
          },
          updated_at: "2024-01-17T12:30:00Z",
        },
      });

      const result = await client.assignWorkOrder(
        "wo_123",
        "tech_456",
        "High priority installation",
      );

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/field-ops/work-orders/wo_123/assign",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            technician_id: "tech_456",
            notes: "High priority installation",
          }),
        }),
      );

      expect(result.data.status).toBe("ASSIGNED");
      expect(result.data.assigned_technician?.technician_id).toBe("tech_456");
    });

    it("should accept work order", async () => {
      mockResponse({
        data: {
          ...mockWorkOrder,
          assigned_technician: {
            ...mockTechnicianAssignment,
            accepted_at: "2024-01-17T12:45:00Z",
          },
        },
      });

      const result = await client.acceptWorkOrder("wo_123", "tech_123");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/field-ops/work-orders/wo_123/accept",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ technician_id: "tech_123" }),
        }),
      );

      expect(result.data.assigned_technician?.accepted_at).toBe("2024-01-17T12:45:00Z");
    });

    it("should start work order with location tracking", async () => {
      const startLocation: GeoLocation = {
        latitude: 40.724,
        longitude: -74.0028,
        accuracy: 5,
        timestamp: "2024-01-17T09:15:00Z",
        address: "789 Pine Street, Springfield, ST 12345",
      };

      mockResponse({
        data: {
          ...mockWorkOrder,
          status: "IN_PROGRESS",
          assigned_technician: {
            ...mockTechnicianAssignment,
            started_at: "2024-01-17T09:15:00Z",
          },
        },
      });

      const result = await client.startWorkOrder("wo_123", startLocation);

      expect(result.data.status).toBe("IN_PROGRESS");
      expect(result.data.assigned_technician?.started_at).toBe("2024-01-17T09:15:00Z");
    });

    it("should complete work order with details", async () => {
      const completionData = {
        completion_notes:
          "Installation completed successfully. Customer trained on equipment usage.",
        customer_signature:
          "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
        equipment_used: ["item_001", "item_002"],
        time_spent: 135,
        location: {
          latitude: 40.724,
          longitude: -74.0028,
          accuracy: 5,
          timestamp: "2024-01-17T11:30:00Z",
        },
      };

      mockResponse({
        data: {
          ...mockWorkOrder,
          status: "COMPLETED",
          completion_notes: completionData.completion_notes,
          assigned_technician: {
            ...mockTechnicianAssignment,
            completed_at: "2024-01-17T11:30:00Z",
            on_site_time: 135,
          },
        },
      });

      const result = await client.completeWorkOrder("wo_123", completionData);

      expect(result.data.status).toBe("COMPLETED");
      expect(result.data.completion_notes).toBe(completionData.completion_notes);
      expect(result.data.assigned_technician?.completed_at).toBe("2024-01-17T11:30:00Z");
    });

    it("should cancel work order with reason", async () => {
      mockResponse({
        data: {
          ...mockWorkOrder,
          status: "CANCELLED",
          completion_notes: "Customer not available at scheduled time",
          updated_at: "2024-01-17T09:30:00Z",
        },
      });

      const result = await client.cancelWorkOrder(
        "wo_123",
        "Customer not available at scheduled time",
      );

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/field-ops/work-orders/wo_123/cancel",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            reason: "Customer not available at scheduled time",
          }),
        }),
      );

      expect(result.data.status).toBe("CANCELLED");
    });
  });

  describe("Work Order Photos", () => {
    // Mock File for testing
    const createMockFile = (name: string, type: string) => {
      const file = new File(["mock content"], name, { type });
      return file;
    };

    const mockPhoto: WorkOrderPhoto = {
      id: "photo_123",
      url: "https://storage.example.com/photos/photo_123.jpg",
      caption: "Installation completed - customer premises",
      photo_type: "AFTER",
      uploaded_at: "2024-01-17T11:45:00Z",
    };

    it("should upload work order photo", async () => {
      const mockFile = createMockFile("installation_after.jpg", "image/jpeg");

      // Mock the direct fetch call in uploadWorkOrderPhoto
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: mockPhoto }),
      } as Response);

      const result = await client.uploadWorkOrderPhoto(
        "wo_123",
        mockFile,
        "AFTER",
        "Installation completed",
      );

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/field-ops/work-orders/wo_123/photos",
        expect.objectContaining({
          method: "POST",
          headers: defaultHeaders,
          body: expect.any(FormData),
        }),
      );

      expect(result.data.photo_type).toBe("AFTER");
      expect(result.data.caption).toBe("Installation completed - customer premises");
    });

    it("should handle photo upload failure", async () => {
      const mockFile = createMockFile("problem.jpg", "image/jpeg");

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 413,
        statusText: "Payload Too Large",
      } as Response);

      await expect(client.uploadWorkOrderPhoto("wo_123", mockFile, "PROBLEM")).rejects.toThrow(
        "Photo upload failed: Payload Too Large",
      );
    });

    it("should delete work order photo", async () => {
      mockResponse({ success: true });

      const result = await client.deleteWorkOrderPhoto("wo_123", "photo_123");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/field-ops/work-orders/wo_123/photos/photo_123",
        expect.objectContaining({
          method: "DELETE",
        }),
      );

      expect(result.success).toBe(true);
    });
  });

  describe("Routing and Scheduling", () => {
    const mockRoute: Route = {
      id: "route_123",
      technician_id: "tech_123",
      date: "2024-01-17",
      work_orders: [
        {
          work_order_id: "wo_123",
          sequence: 1,
          estimated_arrival: "2024-01-17T09:00:00Z",
          estimated_departure: "2024-01-17T12:00:00Z",
          travel_time_to_next: 15,
          distance_to_next: 8.5,
        },
        {
          work_order_id: "wo_124",
          sequence: 2,
          estimated_arrival: "2024-01-17T12:15:00Z",
          estimated_departure: "2024-01-17T14:00:00Z",
          travel_time_to_next: 20,
          distance_to_next: 12.3,
        },
      ],
      optimized: true,
      total_distance: 20.8,
      estimated_duration: 360,
      status: "ACTIVE",
      created_at: "2024-01-17T07:00:00Z",
    };

    it("should create route for technician", async () => {
      mockResponse({ data: mockRoute });

      const result = await client.createRoute("tech_123", "2024-01-17", ["wo_123", "wo_124"]);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/field-ops/routes",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            technician_id: "tech_123",
            date: "2024-01-17",
            work_order_ids: ["wo_123", "wo_124"],
          }),
        }),
      );

      expect(result.data.work_orders).toHaveLength(2);
      expect(result.data.total_distance).toBe(20.8);
    });

    it("should optimize route", async () => {
      mockResponse({
        data: {
          ...mockRoute,
          optimized: true,
          total_distance: 18.2,
          estimated_duration: 340,
        },
      });

      const result = await client.optimizeRoute("route_123");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/field-ops/routes/route_123/optimize",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({}),
        }),
      );

      expect(result.data.optimized).toBe(true);
      expect(result.data.total_distance).toBe(18.2);
    });

    it("should get technician route for specific date", async () => {
      mockResponse({ data: mockRoute });

      const result = await client.getTechnicianRoute("tech_123", "2024-01-17");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/field-ops/technicians/tech_123/route",
        expect.objectContaining({
          params: { date: "2024-01-17" },
        }),
      );

      expect(result.data?.technician_id).toBe("tech_123");
      expect(result.data?.date).toBe("2024-01-17");
    });

    it("should update route stop with actual times", async () => {
      const stopUpdate = {
        actual_arrival: "2024-01-17T09:05:00Z",
        actual_departure: "2024-01-17T12:10:00Z",
      };

      mockResponse({
        data: {
          ...mockRoute.work_orders[0],
          actual_arrival: stopUpdate.actual_arrival,
          actual_departure: stopUpdate.actual_departure,
        },
      });

      const result = await client.updateRouteStop("route_123", "stop_456", stopUpdate);

      expect(result.data.actual_arrival).toBe("2024-01-17T09:05:00Z");
      expect(result.data.actual_departure).toBe("2024-01-17T12:10:00Z");
    });
  });

  describe("Time Tracking", () => {
    const mockTimeEntry: TimeEntry = {
      id: "time_123",
      technician_id: "tech_123",
      work_order_id: "wo_123",
      entry_type: "WORK",
      start_time: "2024-01-17T09:00:00Z",
      end_time: "2024-01-17T12:00:00Z",
      duration: 180,
      description: "Fiber installation at customer site",
      location: {
        latitude: 40.724,
        longitude: -74.0028,
        accuracy: 5,
        timestamp: "2024-01-17T09:00:00Z",
      },
      billable: true,
      approved: false,
    };

    it("should start time entry", async () => {
      const timeEntryData = {
        technician_id: "tech_123",
        work_order_id: "wo_123",
        entry_type: "WORK" as const,
        start_time: "2024-01-17T09:00:00Z",
        description: "Starting fiber installation",
        location: mockTimeEntry.location!,
        billable: true,
        approved: false,
      };

      mockResponse({
        data: {
          ...timeEntryData,
          id: "time_124",
        },
      });

      const result = await client.startTimeEntry(timeEntryData);

      expect(result.data.id).toBe("time_124");
      expect(result.data.entry_type).toBe("WORK");
    });

    it("should end time entry with location", async () => {
      const endLocation: GeoLocation = {
        latitude: 40.724,
        longitude: -74.0028,
        accuracy: 8,
        timestamp: "2024-01-17T12:00:00Z",
      };

      mockResponse({
        data: {
          ...mockTimeEntry,
          end_time: "2024-01-17T12:00:00Z",
          duration: 180,
        },
      });

      const result = await client.endTimeEntry("time_123", "2024-01-17T12:00:00Z", endLocation);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/field-ops/time-entries/time_123/end",
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify({
            end_time: "2024-01-17T12:00:00Z",
            location: endLocation,
          }),
        }),
      );

      expect(result.data.duration).toBe(180);
    });

    it("should get technician time entries", async () => {
      mockResponse({
        data: [mockTimeEntry],
        pagination: {
          page: 1,
          limit: 50,
          total: 1,
          total_pages: 1,
        },
      });

      const result = await client.getTechnicianTimeEntries("tech_123", {
        start_date: "2024-01-01",
        end_date: "2024-01-31",
        entry_type: "WORK",
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/field-ops/technicians/tech_123/time-entries",
        expect.objectContaining({
          params: {
            start_date: "2024-01-01",
            end_date: "2024-01-31",
            entry_type: "WORK",
          },
        }),
      );

      expect(result.data).toHaveLength(1);
      expect(result.data[0].billable).toBe(true);
    });

    it("should approve time entries in bulk", async () => {
      mockResponse({
        data: {
          approved: 5,
          rejected: 0,
        },
      });

      const result = await client.approveTimeEntries([
        "time_123",
        "time_124",
        "time_125",
        "time_126",
        "time_127",
      ]);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/field-ops/time-entries/approve",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            time_entry_ids: ["time_123", "time_124", "time_125", "time_126", "time_127"],
          }),
        }),
      );

      expect(result.data.approved).toBe(5);
      expect(result.data.rejected).toBe(0);
    });
  });

  describe("Service Calls", () => {
    const mockServiceCall: ServiceCall = {
      id: "call_123",
      call_number: "SC-2024-0789",
      customer_id: "cust_456",
      customer_name: "Alice Johnson",
      call_type: "TECHNICAL_SUPPORT",
      urgency: "HIGH",
      description: "Internet connection completely down since this morning",
      resolution_required: true,
      estimated_resolution_time: 120,
      assigned_technician: "tech_123",
      status: "ASSIGNED",
      created_at: "2024-01-17T08:30:00Z",
    };

    it("should create service call", async () => {
      const callData = {
        customer_id: "cust_789",
        customer_name: "Bob Smith",
        call_type: "SERVICE_REQUEST" as const,
        urgency: "MEDIUM" as const,
        description: "Request for speed upgrade consultation",
        resolution_required: false,
      };

      mockResponse({
        data: {
          ...callData,
          id: "call_124",
          call_number: "SC-2024-0790",
          status: "OPEN",
          created_at: "2024-01-17T13:00:00Z",
        },
      });

      const result = await client.createServiceCall(callData);

      expect(result.data.id).toBe("call_124");
      expect(result.data.call_type).toBe("SERVICE_REQUEST");
      expect(result.data.status).toBe("OPEN");
    });

    it("should assign service call to technician", async () => {
      mockResponse({
        data: {
          ...mockServiceCall,
          assigned_technician: "tech_456",
          status: "ASSIGNED",
        },
      });

      const result = await client.assignServiceCall("call_123", "tech_456");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/field-ops/service-calls/call_123/assign",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ technician_id: "tech_456" }),
        }),
      );

      expect(result.data.assigned_technician).toBe("tech_456");
      expect(result.data.status).toBe("ASSIGNED");
    });

    it("should escalate service call", async () => {
      mockResponse({
        data: {
          ...mockServiceCall,
          urgency: "CRITICAL",
          assigned_technician: "senior_tech_001",
        },
      });

      const result = await client.escalateServiceCall(
        "call_123",
        "Customer escalation - service critical",
        "senior_tech_001",
      );

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/field-ops/service-calls/call_123/escalate",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            reason: "Customer escalation - service critical",
            escalate_to: "senior_tech_001",
          }),
        }),
      );

      expect(result.data.urgency).toBe("CRITICAL");
    });

    it("should resolve service call", async () => {
      mockResponse({
        data: {
          ...mockServiceCall,
          status: "RESOLVED",
          resolved_at: "2024-01-17T10:45:00Z",
        },
      });

      const result = await client.resolveServiceCall(
        "call_123",
        "Replaced faulty ONT unit. Service restored.",
      );

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/field-ops/service-calls/call_123/resolve",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            resolution: "Replaced faulty ONT unit. Service restored.",
          }),
        }),
      );

      expect(result.data.status).toBe("RESOLVED");
      expect(result.data.resolved_at).toBe("2024-01-17T10:45:00Z");
    });
  });

  describe("Analytics and Performance", () => {
    it("should get technician performance metrics", async () => {
      const performanceData = {
        work_orders_completed: 45,
        average_completion_time: 135,
        customer_satisfaction: 4.7,
        efficiency_rating: 92.5,
        on_time_percentage: 89.0,
      };

      mockResponse({ data: performanceData });

      const result = await client.getTechnicianPerformance("tech_123", {
        start_date: "2024-01-01",
        end_date: "2024-01-31",
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/field-ops/technicians/tech_123/performance",
        expect.objectContaining({
          params: {
            start_date: "2024-01-01",
            end_date: "2024-01-31",
          },
        }),
      );

      expect(result.data.customer_satisfaction).toBe(4.7);
      expect(result.data.efficiency_rating).toBe(92.5);
    });

    it("should get field operations metrics", async () => {
      const fieldOpsMetrics = {
        total_work_orders: 234,
        completed_work_orders: 195,
        average_resolution_time: 142,
        first_time_fix_rate: 87.5,
        technician_utilization: 78.2,
        customer_satisfaction: 4.5,
      };

      mockResponse({ data: fieldOpsMetrics });

      const result = await client.getFieldOpsMetrics({
        start_date: "2024-01-01",
        end_date: "2024-01-31",
        territory: "north_zone",
      });

      expect(result.data.first_time_fix_rate).toBe(87.5);
      expect(result.data.technician_utilization).toBe(78.2);
    });

    it("should get dispatch metrics for specific date", async () => {
      const dispatchMetrics = {
        scheduled_appointments: 56,
        completed_appointments: 48,
        cancelled_appointments: 3,
        emergency_calls: 5,
        technicians_active: 12,
        average_travel_time: 18.5,
      };

      mockResponse({ data: dispatchMetrics });

      const result = await client.getDispatchMetrics("2024-01-17");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/field-ops/dispatch/metrics",
        expect.objectContaining({
          params: { date: "2024-01-17" },
        }),
      );

      expect(result.data.scheduled_appointments).toBe(56);
      expect(result.data.emergency_calls).toBe(5);
    });
  });

  describe("Emergency and Priority Services", () => {
    const mockEmergencyLocation: AddressData = {
      street: "456 Emergency Ave",
      city: "Springfield",
      state: "ST",
      zip: "12345",
      country: "US",
    };

    it("should create emergency work order", async () => {
      const emergencyData = {
        customer_id: "cust_emergency",
        description: "Complete service outage affecting business operations",
        location: mockEmergencyLocation,
        contact_phone: "+1-555-URGENT",
        severity: "CRITICAL" as const,
      };

      mockResponse({
        data: {
          ...mockWorkOrder,
          id: "wo_emergency_123",
          type: "EMERGENCY",
          priority: "EMERGENCY",
          description: emergencyData.description,
          service_address: emergencyData.location,
          customer_phone: emergencyData.contact_phone,
        },
      });

      const result = await client.createEmergencyWorkOrder(emergencyData);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/field-ops/emergency/work-order",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify(emergencyData),
        }),
      );

      expect(result.data.type).toBe("EMERGENCY");
      expect(result.data.priority).toBe("EMERGENCY");
    });

    it("should dispatch nearest technician", async () => {
      const emergencyLocation: GeoLocation = {
        latitude: 40.73,
        longitude: -74.0,
        accuracy: 5,
        timestamp: "2024-01-17T15:30:00Z",
      };

      const dispatchResponse = {
        technician: mockTechnician,
        estimated_arrival: "2024-01-17T15:45:00Z",
        distance: 2.8,
      };

      mockResponse({ data: dispatchResponse });

      const result = await client.dispatchNearestTechnician(emergencyLocation, [
        "emergency_repair",
        "fiber_troubleshoot",
      ]);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/field-ops/dispatch/nearest",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            location: emergencyLocation,
            skills: ["emergency_repair", "fiber_troubleshoot"],
          }),
        }),
      );

      expect(result.data.distance).toBe(2.8);
      expect(result.data.technician.id).toBe("tech_123");
    });

    it("should broadcast urgent call to nearby technicians", async () => {
      const broadcastData = {
        message: "URGENT: Major fiber cut affecting 200+ customers in downtown area",
        location: {
          latitude: 40.715,
          longitude: -74.01,
          accuracy: 10,
          timestamp: "2024-01-17T16:00:00Z",
        },
        skills_required: ["fiber_repair", "emergency_response"],
        max_distance: 15,
      };

      mockResponse({
        data: {
          technicians_notified: 8,
        },
      });

      const result = await client.broadcastUrgentCall(broadcastData);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/field-ops/broadcast/urgent",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify(broadcastData),
        }),
      );

      expect(result.data.technicians_notified).toBe(8);
    });
  });

  describe("Error Handling and Edge Cases", () => {
    it("should handle technician not found errors", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
        json: async () => ({
          error: {
            code: "TECHNICIAN_NOT_FOUND",
            message: "Technician not found",
          },
        }),
      } as Response);

      await expect(client.getTechnician("invalid_tech")).rejects.toThrow("Not Found");
    });

    it("should handle work order assignment conflicts", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 409,
        statusText: "Conflict",
        json: async () => ({
          error: {
            code: "ASSIGNMENT_CONFLICT",
            message: "Technician already has conflicting assignment",
            details: { conflicting_work_order: "wo_456" },
          },
        }),
      } as Response);

      await expect(client.assignWorkOrder("wo_123", "tech_busy")).rejects.toThrow("Conflict");
    });

    it("should handle invalid location updates", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: "Bad Request",
        json: async () => ({
          error: {
            code: "INVALID_LOCATION",
            message: "Location coordinates are invalid",
          },
        }),
      } as Response);

      await expect(
        client.updateTechnicianLocation("tech_123", {
          latitude: 999,
          longitude: 999,
          accuracy: 5,
          timestamp: "2024-01-17T10:00:00Z",
        }),
      ).rejects.toThrow("Bad Request");
    });

    it("should handle network connectivity errors", async () => {
      mockFetch.mockRejectedValue(new Error("Network connection failed"));

      await expect(client.getTechnicians()).rejects.toThrow("Network connection failed");
    });
  });

  describe("Performance and Scalability", () => {
    it("should handle large technician lists efficiently", async () => {
      const largeTechnicianList = Array.from({ length: 200 }, (_, i) => ({
        ...mockTechnician,
        id: `tech_${i}`,
        name: `Technician ${i}`,
        employee_id: `EMP-${String(i).padStart(3, "0")}`,
      }));

      mockResponse({
        data: largeTechnicianList,
        pagination: {
          page: 1,
          limit: 200,
          total: 200,
          total_pages: 1,
        },
      });

      const startTime = performance.now();
      const result = await client.getTechnicians({ limit: 200 });
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(100);
      expect(result.data).toHaveLength(200);
    });

    it("should handle complex route optimization", async () => {
      const complexRoute = {
        ...mockRoute,
        work_orders: Array.from({ length: 20 }, (_, i) => ({
          work_order_id: `wo_${i}`,
          sequence: i + 1,
          estimated_arrival: new Date(Date.now() + i * 3600000).toISOString(),
          estimated_departure: new Date(Date.now() + (i + 1) * 3600000).toISOString(),
          travel_time_to_next: Math.floor(Math.random() * 30) + 10,
          distance_to_next: Math.random() * 15 + 5,
        })),
      };

      mockResponse({ data: complexRoute });

      const result = await client.optimizeRoute("complex_route");

      expect(result.data.work_orders).toHaveLength(20);
    });
  });
});
