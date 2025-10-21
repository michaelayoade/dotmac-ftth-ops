/**
 * ResellersApiClient Tests
 * Critical test suite for partner relationship and channel sales management
 */

import { ResellersApiClient } from "../ResellersApiClient";
import type {
  ResellerPartner,
  Sale,
  CommissionPayment,
  PartnerTraining,
  PartnerTrainingRecord,
  Territory,
  PartnerContact,
  BusinessInformation,
  CommissionStructure,
  PartnerMetrics,
  ContractInformation,
  OnboardingStatus,
  SaleProduct,
  ContractDocument,
  AddressData,
} from "../ResellersApiClient";

// Mock fetch
global.fetch = jest.fn();
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

describe("ResellersApiClient", () => {
  let client: ResellersApiClient;
  const baseURL = "https://api.test.com";
  const defaultHeaders = { Authorization: "Bearer test-token" };

  beforeEach(() => {
    client = new ResellersApiClient(baseURL, defaultHeaders);
    jest.clearAllMocks();
  });

  const mockResponse = <T>(data: T, status = 200) => {
    mockFetch.mockResolvedValueOnce({
      ok: status >= 200 && status < 300,
      status,
      json: async () => data,
    } as Response);
  };

  describe("Partner Management", () => {
    const mockAddress: AddressData = {
      street: "123 Business Park Drive",
      city: "Tech City",
      state: "CA",
      zip: "90210",
      country: "US",
    };

    const mockContact: PartnerContact = {
      primary_contact: {
        name: "John Smith",
        title: "CEO",
        email: "john.smith@partner.com",
        phone: "+1-555-0123",
        mobile: "+1-555-0124",
      },
      billing_contact: {
        name: "Jane Doe",
        title: "CFO",
        email: "jane.doe@partner.com",
        phone: "+1-555-0125",
      },
      address: mockAddress,
      phone: "+1-555-0100",
      email: "contact@partner.com",
      website: "https://www.partner.com",
    };

    const mockBusinessInfo: BusinessInformation = {
      tax_id: "12-3456789",
      business_license: "BL-98765432",
      business_type: "LLC",
      years_in_business: 8,
      employee_count: 45,
      annual_revenue: 5000000,
      credit_rating: "A+",
      bank_references: [
        {
          bank_name: "First National Bank",
          account_type: "Business Checking",
          years_with_bank: 5,
          contact_person: "Robert Wilson",
          contact_phone: "+1-555-BANK1",
        },
      ],
      insurance_info: {
        general_liability: {
          provider: "Business Insurance Corp",
          policy_number: "GL-123456789",
          coverage_amount: 2000000,
          expiry_date: "2024-12-31T23:59:59Z",
        },
      },
    };

    const mockCommissionStructure: CommissionStructure = {
      commission_type: "TIERED",
      base_commission_rate: 5.0,
      tiers: [
        {
          tier_name: "Bronze",
          sales_threshold: 10000,
          commission_rate: 5.0,
        },
        {
          tier_name: "Silver",
          sales_threshold: 50000,
          commission_rate: 7.5,
          bonus_multiplier: 1.1,
        },
        {
          tier_name: "Gold",
          sales_threshold: 100000,
          commission_rate: 10.0,
          bonus_multiplier: 1.25,
        },
      ],
      bonus_structures: [
        {
          bonus_type: "NEW_CUSTOMER",
          threshold: 10,
          bonus_amount: 100,
          calculation_period: "MONTHLY",
        },
      ],
      payment_terms: "NET_30",
      minimum_payout: 100,
      effective_date: "2024-01-01T00:00:00Z",
      expiry_date: "2024-12-31T23:59:59Z",
    };

    const mockMetrics: PartnerMetrics = {
      total_sales: 250000,
      monthly_sales: 25000,
      quarterly_sales: 75000,
      annual_sales: 250000,
      customer_count: 150,
      active_customers: 145,
      churned_customers: 5,
      average_deal_size: 1666.67,
      conversion_rate: 15.5,
      customer_satisfaction: 4.7,
      performance_score: 87.5,
      ranking: 12,
      last_sale_date: "2024-01-15T10:30:00Z",
    };

    const mockContract: ContractInformation = {
      contract_number: "PTNR-2024-001",
      contract_type: "STANDARD",
      start_date: "2024-01-01T00:00:00Z",
      end_date: "2024-12-31T23:59:59Z",
      auto_renewal: true,
      renewal_terms: "Automatic 12-month renewal unless terminated",
      termination_notice_days: 30,
      exclusivity_clause: false,
      non_compete_clause: true,
      contract_documents: [
        {
          document_type: "AGREEMENT",
          document_name: "Partnership Agreement 2024",
          file_url: "https://storage.example.com/contracts/ptnr-2024-001.pdf",
          signed_date: "2024-01-01T10:00:00Z",
          effective_date: "2024-01-01T00:00:00Z",
          version: "1.0",
        },
      ],
    };

    const mockOnboarding: OnboardingStatus = {
      stage: "TRAINING",
      progress_percentage: 65,
      completed_steps: ["application_submitted", "background_check_completed", "contract_signed"],
      pending_steps: ["training_completion", "certification_exam", "territory_assignment"],
      assigned_onboarding_manager: "manager_456",
      estimated_completion_date: "2024-02-15T23:59:59Z",
      notes: "Partner progressing well through training modules",
    };

    const mockPartner: ResellerPartner = {
      id: "partner_123",
      partner_code: "PTN-001",
      company_name: "TechSolutions LLC",
      legal_name: "TechSolutions Limited Liability Company",
      partner_type: "DEALER",
      tier: "GOLD",
      status: "ACTIVE",
      contact_info: mockContact,
      business_info: mockBusinessInfo,
      territories: [],
      service_authorizations: [
        {
          service_type: "INTERNET",
          authorized: true,
          training_required: true,
          training_completed: true,
          certification_level: "ADVANCED",
          authorization_date: "2024-01-05T00:00:00Z",
          expiry_date: "2024-12-31T23:59:59Z",
        },
        {
          service_type: "VOICE",
          authorized: true,
          training_required: true,
          training_completed: false,
          certification_level: "BASIC",
        },
      ],
      commission_structure: mockCommissionStructure,
      performance_metrics: mockMetrics,
      contract_info: mockContract,
      onboarding_status: mockOnboarding,
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-15T14:30:00Z",
    };

    it("should get partners with filtering", async () => {
      mockResponse({
        data: [mockPartner],
        pagination: {
          page: 1,
          limit: 20,
          total: 1,
          total_pages: 1,
        },
      });

      const result = await client.getPartners({
        status: "ACTIVE",
        tier: "GOLD",
        partner_type: "DEALER",
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/resellers/partners?status=ACTIVE&tier=GOLD&partner_type=DEALER",
        expect.any(Object),
      );

      expect(result.data).toHaveLength(1);
      expect(result.data[0].tier).toBe("GOLD");
    });

    it("should create comprehensive partner", async () => {
      const partnerData = {
        company_name: "NewTech Partners Inc",
        legal_name: "NewTech Partners Incorporated",
        partner_type: "VAR" as const,
        tier: "BRONZE" as const,
        status: "PENDING_APPROVAL" as const,
        contact_info: {
          primary_contact: {
            name: "Sarah Johnson",
            title: "President",
            email: "sarah@newtech.com",
            phone: "+1-555-0200",
          },
          address: {
            street: "456 Innovation Blvd",
            city: "Silicon Valley",
            state: "CA",
            zip: "94043",
            country: "US",
          },
          phone: "+1-555-0200",
          email: "contact@newtech.com",
        },
        business_info: {
          tax_id: "98-7654321",
          business_license: "BL-11223344",
          business_type: "CORPORATION" as const,
          years_in_business: 3,
          employee_count: 15,
          annual_revenue: 1200000,
        },
        territories: [],
        service_authorizations: [
          {
            service_type: "INTERNET" as const,
            authorized: false,
            training_required: true,
            training_completed: false,
            certification_level: "BASIC" as const,
          },
        ],
        commission_structure: {
          commission_type: "PERCENTAGE" as const,
          base_commission_rate: 3.5,
          payment_terms: "NET_45" as const,
          minimum_payout: 50,
          effective_date: "2024-02-01T00:00:00Z",
        },
        contract_info: {
          contract_number: "PTNR-2024-002",
          contract_type: "STANDARD" as const,
          start_date: "2024-02-01T00:00:00Z",
          auto_renewal: false,
          renewal_terms: "Manual renewal required",
          termination_notice_days: 60,
          exclusivity_clause: true,
          non_compete_clause: false,
          contract_documents: [],
        },
        onboarding_status: {
          stage: "APPLICATION" as const,
          progress_percentage: 10,
          completed_steps: ["application_submitted"],
          pending_steps: ["background_check", "contract_review"],
        },
      };

      mockResponse({
        data: {
          ...partnerData,
          id: "partner_124",
          partner_code: "PTN-002",
          performance_metrics: {
            total_sales: 0,
            monthly_sales: 0,
            quarterly_sales: 0,
            annual_sales: 0,
            customer_count: 0,
            active_customers: 0,
            churned_customers: 0,
            average_deal_size: 0,
            conversion_rate: 0,
            customer_satisfaction: 0,
            performance_score: 0,
            ranking: 0,
          },
          created_at: "2024-01-17T15:00:00Z",
          updated_at: "2024-01-17T15:00:00Z",
        },
      });

      const result = await client.createPartner(partnerData);

      expect(result.data.id).toBe("partner_124");
      expect(result.data.partner_type).toBe("VAR");
      expect(result.data.onboarding_status.stage).toBe("APPLICATION");
    });

    it("should activate partner", async () => {
      mockResponse({
        data: {
          ...mockPartner,
          status: "ACTIVE",
          updated_at: "2024-01-17T16:00:00Z",
        },
      });

      const result = await client.activatePartner("partner_123");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/resellers/partners/partner_123/activate",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({}),
        }),
      );

      expect(result.data.status).toBe("ACTIVE");
    });

    it("should suspend partner with reason", async () => {
      mockResponse({
        data: {
          ...mockPartner,
          status: "SUSPENDED",
        },
      });

      const result = await client.suspendPartner(
        "partner_123",
        "Compliance issues requiring investigation",
      );

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/resellers/partners/partner_123/suspend",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            reason: "Compliance issues requiring investigation",
          }),
        }),
      );

      expect(result.data.status).toBe("SUSPENDED");
    });

    it("should terminate partner with comprehensive details", async () => {
      const terminationData = {
        termination_reason: "Contract violation - non-payment",
        effective_date: "2024-02-01T00:00:00Z",
        final_commission_calculation: true,
        notice_provided: true,
      };

      mockResponse({
        data: {
          ...mockPartner,
          status: "TERMINATED",
          updated_at: "2024-01-17T17:00:00Z",
        },
      });

      const result = await client.terminatePartner("partner_123", terminationData);

      expect(result.data.status).toBe("TERMINATED");
    });
  });

  describe("Territory Management", () => {
    const mockTerritory: Territory = {
      id: "territory_123",
      name: "Silicon Valley Metro",
      type: "GEOGRAPHIC",
      boundaries: [
        {
          type: "POSTAL_CODE",
          values: ["94043", "94041", "94301", "94305"],
        },
        {
          type: "CITY",
          values: ["Palo Alto", "Mountain View", "Sunnyvale"],
        },
      ],
      exclusive: true,
      population: 450000,
      market_potential: 15000000,
    };

    it("should assign territory to partner", async () => {
      const territoryData = {
        name: "Downtown Business District",
        type: "VERTICAL" as const,
        boundaries: [
          {
            type: "COORDINATE" as const,
            values: [],
            coordinates: [
              { latitude: 37.7749, longitude: -122.4194 },
              { latitude: 37.7849, longitude: -122.4094 },
              { latitude: 37.7649, longitude: -122.4294 },
            ],
          },
        ],
        exclusive: false,
        market_potential: 8500000,
      };

      mockResponse({
        data: {
          ...territoryData,
          id: "territory_124",
        },
      });

      const result = await client.assignTerritory("partner_123", territoryData);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/resellers/partners/partner_123/territories",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify(territoryData),
        }),
      );

      expect(result.data.id).toBe("territory_124");
      expect(result.data.type).toBe("VERTICAL");
    });

    it("should check territory conflicts", async () => {
      const conflictResponse = {
        conflicts: [
          {
            partner_id: "partner_456",
            territory_id: "territory_789",
            overlap_percentage: 15.5,
          },
          {
            partner_id: "partner_789",
            territory_id: "territory_012",
            overlap_percentage: 8.2,
          },
        ],
      };

      mockResponse({ data: conflictResponse });

      const result = await client.checkTerritoryConflicts(mockTerritory);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/resellers/territories/check-conflicts",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify(mockTerritory),
        }),
      );

      expect(result.data.conflicts).toHaveLength(2);
      expect(result.data.conflicts[0].overlap_percentage).toBe(15.5);
    });

    it("should remove territory from partner", async () => {
      mockResponse({ success: true });

      const result = await client.removeTerritory("partner_123", "territory_123");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/resellers/partners/partner_123/territories/territory_123",
        expect.objectContaining({
          method: "DELETE",
        }),
      );

      expect(result.success).toBe(true);
    });

    it("should get partner territories", async () => {
      mockResponse({ data: [mockTerritory] });

      const result = await client.getPartnerTerritories("partner_123");

      expect(result.data).toHaveLength(1);
      expect(result.data[0].exclusive).toBe(true);
      expect(result.data[0].market_potential).toBe(15000000);
    });
  });

  describe("Sales Management", () => {
    const mockProducts: SaleProduct[] = [
      {
        product_id: "prod_fiber_100",
        product_name: "Fiber Internet 100 Mbps",
        product_type: "SERVICE",
        quantity: 1,
        unit_price: 79.99,
        total_price: 79.99,
        commission_rate: 10.0,
        commission_amount: 8.0,
        recurring: true,
        billing_cycle: "MONTHLY",
      },
      {
        product_id: "equip_router_001",
        product_name: "Premium Wi-Fi Router",
        product_type: "EQUIPMENT",
        quantity: 1,
        unit_price: 149.99,
        total_price: 149.99,
        commission_rate: 5.0,
        commission_amount: 7.5,
        recurring: false,
      },
      {
        product_id: "serv_install_001",
        product_name: "Professional Installation",
        product_type: "INSTALLATION",
        quantity: 1,
        unit_price: 99.99,
        total_price: 99.99,
        commission_rate: 15.0,
        commission_amount: 15.0,
        recurring: false,
      },
    ];

    const mockSale: Sale = {
      id: "sale_123",
      sale_number: "SALE-2024-00123",
      partner_id: "partner_123",
      customer_id: "customer_456",
      customer_name: "John Customer",
      sale_type: "NEW_CUSTOMER",
      products: mockProducts,
      total_value: 329.97,
      commission_amount: 30.5,
      commission_rate: 9.24,
      sale_date: "2024-01-17T14:00:00Z",
      activation_date: "2024-01-20T10:00:00Z",
      status: "APPROVED",
      payment_status: "PAID",
      notes: "Customer upgrade from DSL to fiber",
      created_at: "2024-01-17T14:00:00Z",
    };

    it("should create sale with multiple products", async () => {
      const saleData = {
        partner_id: "partner_123",
        customer_id: "customer_789",
        customer_name: "Alice Business",
        sale_type: "UPGRADE" as const,
        products: [
          {
            product_id: "prod_fiber_500",
            product_name: "Fiber Internet 500 Mbps Business",
            product_type: "SERVICE" as const,
            quantity: 1,
            unit_price: 199.99,
            total_price: 199.99,
            commission_rate: 12.0,
            commission_amount: 24.0,
            recurring: true,
            billing_cycle: "MONTHLY" as const,
          },
        ],
        total_value: 199.99,
        sale_date: "2024-01-17T15:30:00Z",
        status: "PENDING" as const,
        payment_status: "PENDING" as const,
        notes: "Business customer upgrading for increased bandwidth needs",
      };

      mockResponse({
        data: {
          ...saleData,
          id: "sale_124",
          sale_number: "SALE-2024-00124",
          commission_amount: 24.0,
          commission_rate: 12.0,
          created_at: "2024-01-17T15:30:00Z",
        },
      });

      const result = await client.createSale(saleData);

      expect(result.data.id).toBe("sale_124");
      expect(result.data.sale_type).toBe("UPGRADE");
      expect(result.data.commission_amount).toBe(24.0);
    });

    it("should approve sale with notes", async () => {
      mockResponse({
        data: {
          ...mockSale,
          status: "APPROVED",
        },
      });

      const result = await client.approveSale(
        "sale_123",
        "All documentation verified, customer approved",
      );

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/resellers/sales/sale_123/approve",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            approval_notes: "All documentation verified, customer approved",
          }),
        }),
      );

      expect(result.data.status).toBe("APPROVED");
    });

    it("should cancel sale with reason", async () => {
      mockResponse({
        data: {
          ...mockSale,
          status: "CANCELLED",
          notes: "Customer cancelled order before installation",
        },
      });

      const result = await client.cancelSale(
        "sale_123",
        "Customer cancelled order before installation",
      );

      expect(result.data.status).toBe("CANCELLED");
    });

    it("should get partner sales with date filtering", async () => {
      mockResponse({
        data: [mockSale],
        pagination: {
          page: 1,
          limit: 50,
          total: 1,
          total_pages: 1,
        },
      });

      const result = await client.getPartnerSales("partner_123", {
        start_date: "2024-01-01",
        end_date: "2024-01-31",
        status: "APPROVED",
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/resellers/partners/partner_123/sales?start_date=2024-01-01&end_date=2024-01-31&status=APPROVED",
        expect.any(Object),
      );

      expect(result.data).toHaveLength(1);
      expect(result.data[0].partner_id).toBe("partner_123");
    });

    it("should get sales with comprehensive filtering", async () => {
      mockResponse({
        data: [mockSale],
        pagination: {
          page: 1,
          limit: 20,
          total: 1,
          total_pages: 1,
        },
      });

      const result = await client.getSales({
        partner_id: "partner_123",
        start_date: "2024-01-01",
        end_date: "2024-01-31",
        status: "APPROVED",
      });

      expect(result.data[0].total_value).toBe(329.97);
      expect(result.data[0].products).toHaveLength(3);
    });
  });

  describe("Commission Management", () => {
    const mockCommissionPayment: CommissionPayment = {
      id: "commission_123",
      payment_number: "COMM-2024-001",
      partner_id: "partner_123",
      period_start: "2024-01-01T00:00:00Z",
      period_end: "2024-01-31T23:59:59Z",
      sales_included: ["sale_123", "sale_124", "sale_125"],
      gross_commission: 2500.0,
      deductions: [
        {
          type: "TAX",
          description: "Federal tax withholding",
          amount: 375.0,
        },
        {
          type: "CHARGEBACK",
          description: "Customer refund chargeback",
          amount: 125.0,
          reference: "sale_126",
        },
      ],
      net_commission: 2000.0,
      payment_date: "2024-02-15T10:00:00Z",
      payment_method: "ACH",
      status: "PAID",
      payment_reference: "ACH-20240215-001",
      created_at: "2024-02-01T08:00:00Z",
    };

    it("should calculate commissions for period", async () => {
      const period = {
        start_date: "2024-01-01T00:00:00Z",
        end_date: "2024-01-31T23:59:59Z",
      };

      mockResponse({
        data: {
          ...mockCommissionPayment,
          status: "CALCULATED",
          payment_date: undefined,
        },
      });

      const result = await client.calculateCommissions("partner_123", period);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/resellers/partners/partner_123/calculate-commissions",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify(period),
        }),
      );

      expect(result.data.gross_commission).toBe(2500.0);
      expect(result.data.net_commission).toBe(2000.0);
      expect(result.data.status).toBe("CALCULATED");
    });

    it("should approve commission payment", async () => {
      mockResponse({
        data: {
          ...mockCommissionPayment,
          status: "APPROVED",
        },
      });

      const result = await client.approveCommissionPayment(
        "commission_123",
        "Commission calculation verified",
      );

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/resellers/commissions/commission_123/approve",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            approval_notes: "Commission calculation verified",
          }),
        }),
      );

      expect(result.data.status).toBe("APPROVED");
    });

    it("should process commission payment", async () => {
      const paymentDetails = {
        payment_method: "WIRE" as const,
        payment_reference: "WIRE-20240215-789",
        payment_date: "2024-02-15T14:00:00Z",
      };

      mockResponse({
        data: {
          ...mockCommissionPayment,
          status: "PAID",
          payment_method: "WIRE",
          payment_reference: "WIRE-20240215-789",
          payment_date: "2024-02-15T14:00:00Z",
        },
      });

      const result = await client.processCommissionPayment("commission_123", paymentDetails);

      expect(result.data.status).toBe("PAID");
      expect(result.data.payment_method).toBe("WIRE");
      expect(result.data.payment_reference).toBe("WIRE-20240215-789");
    });

    it("should dispute commission payment", async () => {
      mockResponse({
        data: {
          ...mockCommissionPayment,
          status: "DISPUTED",
        },
      });

      const result = await client.disputeCommissionPayment(
        "commission_123",
        "Incorrect deduction calculation for chargebacks",
      );

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/resellers/commissions/commission_123/dispute",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            dispute_reason: "Incorrect deduction calculation for chargebacks",
          }),
        }),
      );

      expect(result.data.status).toBe("DISPUTED");
    });

    it("should get partner commission statement", async () => {
      mockResponse({
        data: {
          statement_url: "https://storage.example.com/statements/partner_123_2024_01.pdf",
        },
      });

      const result = await client.getPartnerCommissionStatement("partner_123", {
        start_date: "2024-01-01",
        end_date: "2024-01-31",
        format: "PDF",
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/resellers/partners/partner_123/commission-statement?start_date=2024-01-01&end_date=2024-01-31&format=PDF",
        expect.any(Object),
      );

      expect(result.data.statement_url).toContain(".pdf");
    });

    it("should get commission payments with filtering", async () => {
      mockResponse({
        data: [mockCommissionPayment],
        pagination: {
          page: 1,
          limit: 20,
          total: 1,
          total_pages: 1,
        },
      });

      const result = await client.getCommissionPayments({
        partner_id: "partner_123",
        status: "PAID",
        start_date: "2024-01-01",
        end_date: "2024-12-31",
      });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].deductions).toHaveLength(2);
    });
  });

  describe("Training and Certification", () => {
    const mockTraining: PartnerTraining = {
      id: "training_123",
      training_name: "Fiber Internet Sales Certification",
      training_type: "PRODUCT",
      description: "Comprehensive training on fiber internet products and sales techniques",
      required: true,
      duration_hours: 8,
      delivery_method: "ONLINE",
      prerequisites: ["basic_sales_training"],
      certification_provided: true,
      expiry_period: 12,
      materials: [
        {
          type: "VIDEO",
          title: "Fiber Technology Overview",
          description: "Understanding fiber optic technology basics",
          url: "https://training.example.com/videos/fiber-overview",
          duration: 45,
          required: true,
        },
        {
          type: "QUIZ",
          title: "Product Knowledge Assessment",
          description: "Test your understanding of fiber products",
          url: "https://training.example.com/quizzes/fiber-products",
          required: true,
        },
        {
          type: "DOCUMENT",
          title: "Sales Playbook",
          description: "Complete sales guide for fiber products",
          url: "https://training.example.com/docs/fiber-sales-playbook.pdf",
          required: false,
        },
      ],
    };

    const mockTrainingRecord: PartnerTrainingRecord = {
      id: "record_123",
      partner_id: "partner_123",
      training_id: "training_123",
      status: "IN_PROGRESS",
      start_date: "2024-01-17T09:00:00Z",
      score: 85,
      passing_score: 80,
      notes: "Partner showing good progress through materials",
    };

    it("should get training programs with filtering", async () => {
      mockResponse({
        data: [mockTraining],
        pagination: {
          page: 1,
          limit: 10,
          total: 1,
          total_pages: 1,
        },
      });

      const result = await client.getTrainingPrograms({
        training_type: "PRODUCT",
        required: true,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/resellers/training/programs?training_type=PRODUCT&required=true",
        expect.any(Object),
      );

      expect(result.data).toHaveLength(1);
      expect(result.data[0].materials).toHaveLength(3);
    });

    it("should enroll partner in training", async () => {
      mockResponse({
        data: {
          ...mockTrainingRecord,
          status: "NOT_STARTED",
          start_date: undefined,
        },
      });

      const result = await client.enrollPartnerInTraining("partner_123", "training_123");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/resellers/partners/partner_123/training/training_123/enroll",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({}),
        }),
      );

      expect(result.data.status).toBe("NOT_STARTED");
      expect(result.data.training_id).toBe("training_123");
    });

    it("should update training progress", async () => {
      const progressData = {
        progress_percentage: 65,
        completed_materials: ["fiber_overview_video", "sales_techniques_module"],
        quiz_scores: {
          product_knowledge_quiz: 88,
          sales_scenarios_quiz: 92,
        },
      };

      mockResponse({
        data: {
          ...mockTrainingRecord,
          status: "IN_PROGRESS",
          notes: "Partner completed video modules, working on assessments",
        },
      });

      const result = await client.updateTrainingProgress("partner_123", "record_123", progressData);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/resellers/training-records/record_123/progress",
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify(progressData),
        }),
      );

      expect(result.data.status).toBe("IN_PROGRESS");
    });

    it("should complete training with final score", async () => {
      mockResponse({
        data: {
          ...mockTrainingRecord,
          status: "COMPLETED",
          completion_date: "2024-01-20T16:00:00Z",
          score: 92,
          certificate_url: "https://certificates.example.com/cert_partner_123_training_123.pdf",
          expiry_date: "2025-01-20T16:00:00Z",
        },
      });

      const result = await client.completeTraining("partner_123", "record_123", 92);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/resellers/training-records/record_123/complete",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ final_score: 92 }),
        }),
      );

      expect(result.data.status).toBe("COMPLETED");
      expect(result.data.score).toBe(92);
      expect(result.data.certificate_url).toContain(".pdf");
    });

    it("should get partner training records", async () => {
      mockResponse({
        data: [mockTrainingRecord],
        pagination: {
          page: 1,
          limit: 20,
          total: 1,
          total_pages: 1,
        },
      });

      const result = await client.getPartnerTrainingRecords("partner_123", {
        status: "IN_PROGRESS",
      });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].passing_score).toBe(80);
    });
  });

  describe("Performance Analytics", () => {
    it("should get partner performance with trends", async () => {
      const performanceData = {
        total_sales: 350000,
        monthly_sales: 28500,
        quarterly_sales: 87500,
        annual_sales: 350000,
        customer_count: 210,
        active_customers: 198,
        churned_customers: 12,
        average_deal_size: 1666.67,
        conversion_rate: 18.2,
        customer_satisfaction: 4.8,
        performance_score: 92.3,
        ranking: 8,
        last_sale_date: "2024-01-16T14:30:00Z",
        sales_trend: [
          { month: "2024-01", sales: 28500, target: 25000 },
          { month: "2023-12", sales: 31000, target: 25000 },
          { month: "2023-11", sales: 28000, target: 25000 },
        ],
        commission_trend: [
          { month: "2024-01", commission: 2850 },
          { month: "2023-12", commission: 3100 },
          { month: "2023-11", commission: 2800 },
        ],
        customer_acquisition_trend: [
          { month: "2024-01", new_customers: 15 },
          { month: "2023-12", new_customers: 18 },
          { month: "2023-11", new_customers: 14 },
        ],
      };

      mockResponse({ data: performanceData });

      const result = await client.getPartnerPerformance("partner_123", {
        start_date: "2023-11-01",
        end_date: "2024-01-31",
        metrics: ["sales", "commissions", "customers"],
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/resellers/partners/partner_123/performance?start_date=2023-11-01&end_date=2024-01-31&metrics=sales%2Ccommissions%2Ccustomers",
        expect.any(Object),
      );

      expect(result.data.performance_score).toBe(92.3);
      expect(result.data.sales_trend).toHaveLength(3);
      expect(result.data.customer_satisfaction).toBe(4.8);
    });

    it("should get channel performance overview", async () => {
      const channelData = {
        total_partners: 150,
        active_partners: 142,
        total_sales: 5250000,
        total_commissions: 425000,
        top_performers: [
          {
            partner_id: "partner_001",
            partner_name: "Elite Sales Corp",
            sales_amount: 450000,
            ranking: 1,
          },
          {
            partner_id: "partner_123",
            partner_name: "TechSolutions LLC",
            sales_amount: 350000,
            ranking: 2,
          },
          {
            partner_id: "partner_789",
            partner_name: "Network Partners Inc",
            sales_amount: 280000,
            ranking: 3,
          },
        ],
        performance_by_tier: [
          { tier: "DIAMOND", partners: 5, avg_sales: 400000 },
          { tier: "PLATINUM", partners: 12, avg_sales: 280000 },
          { tier: "GOLD", partners: 25, avg_sales: 180000 },
          { tier: "SILVER", partners: 48, avg_sales: 95000 },
          { tier: "BRONZE", partners: 52, avg_sales: 35000 },
        ],
        sales_by_region: [
          { region: "West Coast", sales: 1950000, partners: 45 },
          { region: "East Coast", sales: 1680000, partners: 38 },
          { region: "Midwest", sales: 980000, partners: 32 },
          { region: "South", sales: 640000, partners: 27 },
        ],
      };

      mockResponse({ data: channelData });

      const result = await client.getChannelPerformance({
        start_date: "2024-01-01",
        end_date: "2024-01-31",
      });

      expect(result.data.total_partners).toBe(150);
      expect(result.data.top_performers).toHaveLength(3);
      expect(result.data.performance_by_tier).toHaveLength(5);
    });

    it("should get partner leaderboard", async () => {
      const leaderboardData = [
        {
          rank: 1,
          partner_id: "partner_001",
          partner_name: "Elite Sales Corp",
          metric_value: 450000,
          change_from_previous: 15.5,
        },
        {
          rank: 2,
          partner_id: "partner_123",
          partner_name: "TechSolutions LLC",
          metric_value: 350000,
          change_from_previous: 8.2,
        },
        {
          rank: 3,
          partner_id: "partner_456",
          partner_name: "Network Solutions",
          metric_value: 295000,
          change_from_previous: -2.1,
        },
      ];

      mockResponse({ data: leaderboardData });

      const result = await client.getPartnerLeaderboard({
        metric: "SALES",
        period: "QUARTER",
        tier: "GOLD",
        limit: 10,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/resellers/analytics/leaderboard?metric=SALES&period=QUARTER&tier=GOLD&limit=10",
        expect.any(Object),
      );

      expect(result.data).toHaveLength(3);
      expect(result.data[0].rank).toBe(1);
      expect(result.data[2].change_from_previous).toBe(-2.1);
    });
  });

  describe("Onboarding Management", () => {
    it("should update onboarding status", async () => {
      const statusData = {
        stage: "CERTIFICATION" as const,
        completed_steps: [
          "application_submitted",
          "background_check_completed",
          "contract_signed",
          "training_completed",
        ],
        notes: "Partner completed all training modules, ready for certification exam",
      };

      mockResponse({
        data: {
          ...mockPartner,
          onboarding_status: {
            ...mockPartner.onboarding_status,
            stage: "CERTIFICATION",
            progress_percentage: 85,
            completed_steps: statusData.completed_steps,
            pending_steps: ["certification_exam", "final_approval"],
            notes: statusData.notes,
          },
        },
      });

      const result = await client.updateOnboardingStatus("partner_123", statusData);

      expect(result.data.onboarding_status.stage).toBe("CERTIFICATION");
      expect(result.data.onboarding_status.progress_percentage).toBe(85);
    });

    it("should assign onboarding manager", async () => {
      mockResponse({
        data: {
          ...mockPartner,
          onboarding_status: {
            ...mockPartner.onboarding_status,
            assigned_onboarding_manager: "manager_789",
          },
        },
      });

      const result = await client.assignOnboardingManager("partner_123", "manager_789");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/resellers/partners/partner_123/assign-onboarding-manager",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ manager_id: "manager_789" }),
        }),
      );

      expect(result.data.onboarding_status.assigned_onboarding_manager).toBe("manager_789");
    });

    it("should get onboarding checklist", async () => {
      const checklistData = [
        {
          step_name: "application_submitted",
          description: "Partner application form submitted",
          required: true,
          completed: true,
          completion_date: "2024-01-01T10:00:00Z",
        },
        {
          step_name: "background_check",
          description: "Business background verification",
          required: true,
          completed: true,
          completion_date: "2024-01-05T14:00:00Z",
          dependencies: ["application_submitted"],
        },
        {
          step_name: "contract_signed",
          description: "Partnership agreement executed",
          required: true,
          completed: true,
          completion_date: "2024-01-10T16:00:00Z",
          dependencies: ["background_check"],
        },
        {
          step_name: "training_completion",
          description: "Complete required training programs",
          required: true,
          completed: false,
          dependencies: ["contract_signed"],
        },
      ];

      mockResponse({ data: checklistData });

      const result = await client.getOnboardingChecklist("partner_123");

      expect(result.data).toHaveLength(4);
      expect(result.data[0].completed).toBe(true);
      expect(result.data[3].completed).toBe(false);
    });
  });

  describe("Document Management", () => {
    // Mock File for testing
    const createMockFile = (name: string, type: string) => {
      const file = new File(["mock content"], name, { type });
      return file;
    };

    const mockDocument: ContractDocument = {
      document_type: "AGREEMENT",
      document_name: "Partnership Agreement Amendment 2024",
      file_url: "https://storage.example.com/documents/partner_123_amendment_2024.pdf",
      signed_date: "2024-01-17T14:00:00Z",
      effective_date: "2024-02-01T00:00:00Z",
      version: "1.1",
    };

    it("should upload partner document", async () => {
      const mockFile = createMockFile("contract_amendment.pdf", "application/pdf");

      // Mock the direct fetch call in uploadPartnerDocument
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: mockDocument }),
      } as Response);

      const result = await client.uploadPartnerDocument("partner_123", mockFile, "AMENDMENT");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/resellers/partners/partner_123/documents",
        expect.objectContaining({
          method: "POST",
          headers: defaultHeaders,
          body: expect.any(FormData),
        }),
      );

      expect(result.data.document_type).toBe("AGREEMENT");
      expect(result.data.file_url).toContain(".pdf");
    });

    it("should handle document upload failure", async () => {
      const mockFile = createMockFile("large_file.pdf", "application/pdf");

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 413,
        statusText: "Payload Too Large",
      } as Response);

      await expect(
        client.uploadPartnerDocument("partner_123", mockFile, "AGREEMENT"),
      ).rejects.toThrow("Document upload failed: Payload Too Large");
    });

    it("should get partner documents", async () => {
      mockResponse({ data: [mockDocument] });

      const result = await client.getPartnerDocuments("partner_123");

      expect(result.data).toHaveLength(1);
      expect(result.data[0].version).toBe("1.1");
    });

    it("should sign document", async () => {
      const signatureData = {
        signature_method: "ELECTRONIC" as const,
        signer_name: "John Smith",
        signature_date: "2024-01-17T15:00:00Z",
        ip_address: "192.168.1.100",
      };

      mockResponse({
        data: {
          ...mockDocument,
          signed_date: signatureData.signature_date,
        },
      });

      const result = await client.signDocument("partner_123", "doc_123", signatureData);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/resellers/partners/partner_123/documents/doc_123/sign",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify(signatureData),
        }),
      );

      expect(result.data.signed_date).toBe(signatureData.signature_date);
    });
  });

  describe("Error Handling and Edge Cases", () => {
    it("should handle partner not found errors", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
        json: async () => ({
          error: {
            code: "PARTNER_NOT_FOUND",
            message: "Partner not found",
          },
        }),
      } as Response);

      await expect(client.getPartner("invalid_partner")).rejects.toThrow("Not Found");
    });

    it("should handle territory conflict errors", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 409,
        statusText: "Conflict",
        json: async () => ({
          error: {
            code: "TERRITORY_CONFLICT",
            message: "Territory overlaps with existing exclusive assignment",
          },
        }),
      } as Response);

      await expect(
        client.assignTerritory("partner_123", {
          name: "Conflicting Territory",
          type: "GEOGRAPHIC",
          boundaries: [],
          exclusive: true,
        }),
      ).rejects.toThrow("Conflict");
    });

    it("should handle commission calculation errors", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 422,
        statusText: "Unprocessable Entity",
        json: async () => ({
          error: {
            code: "INVALID_COMMISSION_PERIOD",
            message: "Commission period contains incomplete sales data",
          },
        }),
      } as Response);

      await expect(
        client.calculateCommissions("partner_123", {
          start_date: "2024-01-01T00:00:00Z",
          end_date: "2024-01-02T00:00:00Z",
        }),
      ).rejects.toThrow("Unprocessable Entity");
    });

    it("should handle network connectivity errors", async () => {
      mockFetch.mockRejectedValue(new Error("Network connection failed"));

      await expect(client.getPartners()).rejects.toThrow("Network connection failed");
    });
  });

  describe("Performance and Scalability", () => {
    it("should handle large partner lists efficiently", async () => {
      const largePartnerList = Array.from({ length: 500 }, (_, i) => ({
        ...mockPartner,
        id: `partner_${i}`,
        partner_code: `PTN-${String(i).padStart(3, "0")}`,
        company_name: `Partner Company ${i}`,
      }));

      mockResponse({
        data: largePartnerList,
        pagination: {
          page: 1,
          limit: 500,
          total: 500,
          total_pages: 1,
        },
      });

      const startTime = performance.now();
      const result = await client.getPartners({ limit: 500 });
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(100);
      expect(result.data).toHaveLength(500);
    });

    it("should handle complex commission calculations efficiently", async () => {
      const complexCommission = {
        ...mockCommissionPayment,
        sales_included: Array.from({ length: 100 }, (_, i) => `sale_${i}`),
        deductions: Array.from({ length: 20 }, (_, i) => ({
          type: "ADJUSTMENT" as const,
          description: `Adjustment ${i}`,
          amount: Math.random() * 100,
        })),
      };

      mockResponse({ data: complexCommission });

      const result = await client.calculateCommissions("partner_high_volume", {
        start_date: "2024-01-01T00:00:00Z",
        end_date: "2024-01-31T23:59:59Z",
      });

      expect(result.data.sales_included).toHaveLength(100);
      expect(result.data.deductions).toHaveLength(20);
    });

    it("should handle territory boundary complexity", async () => {
      const complexTerritory = {
        name: "Multi-State Metro Area",
        type: "GEOGRAPHIC" as const,
        boundaries: [
          {
            type: "POSTAL_CODE" as const,
            values: Array.from({ length: 200 }, (_, i) => String(10000 + i)),
          },
          {
            type: "COORDINATE" as const,
            values: [],
            coordinates: Array.from({ length: 50 }, (_, i) => ({
              latitude: 40.0 + i * 0.01,
              longitude: -74.0 + i * 0.01,
            })),
          },
        ],
        exclusive: false,
        population: 2500000,
        market_potential: 85000000,
      };

      mockResponse({
        data: {
          ...complexTerritory,
          id: "territory_complex",
        },
      });

      const result = await client.assignTerritory("partner_enterprise", complexTerritory);

      expect(result.data.boundaries[0].values).toHaveLength(200);
      expect(result.data.boundaries[1].coordinates).toHaveLength(50);
    });
  });
});
