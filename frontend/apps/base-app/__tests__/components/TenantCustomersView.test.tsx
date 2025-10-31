/**
 * @jest-environment jsdom
 */

import { render, screen } from "@testing-library/react";
import TenantCustomersView from "@/components/tenant/TenantCustomersView";

jest.mock("@/hooks/useCustomersGraphQL", () => ({
  useCustomerListGraphQL: jest.fn(),
  useCustomerMetricsGraphQL: jest.fn(),
}));

jest.mock("@/lib/api/client", () => ({
  apiClient: {
    delete: jest.fn(),
  },
}));

jest.mock("@/components/ui/toast", () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

const mockedUseCustomerListGraphQL = jest.requireMock("@/hooks/useCustomersGraphQL")
  .useCustomerListGraphQL as jest.Mock;
const mockedUseCustomerMetricsGraphQL = jest.requireMock("@/hooks/useCustomersGraphQL")
  .useCustomerMetricsGraphQL as jest.Mock;

const buildCustomer = () => ({
  id: "cust-001",
  customerNumber: "SUB-001",
  firstName: "Jane",
  lastName: "Doe",
  middleName: null,
  displayName: "Jane Doe",
  companyName: "Acme Fiber",
  status: "ACTIVE",
  customerType: "BUSINESS",
  tier: "STANDARD",
  email: "jane.doe@example.com",
  phone: "+15551234567",
  mobile: "+15557654321",
  website: "https://example.com",
  addressLine1: "100 Main Street",
  addressLine2: "Suite 200",
  city: "Metropolis",
  stateProvince: "CA",
  postalCode: "94016",
  country: "USA",
  taxId: "TAX-123",
  lifetimeValue: 1200,
  totalPurchases: 12,
  averageOrderValue: 100,
  lastPurchaseDate: "2024-12-01T00:00:00.000Z",
  firstPurchaseDate: "2022-06-15T00:00:00.000Z",
  lastContactDate: "2024-12-10T00:00:00.000Z",
  createdAt: "2022-06-01T00:00:00.000Z",
  updatedAt: "2024-12-10T00:00:00.000Z",
  activities: [],
  notes: [],
});

const buildMetrics = () => ({
  totalCustomers: 120,
  activeCustomers: 95,
  newCustomers: 15,
  churnedCustomers: 3,
  totalCustomerValue: 50000,
  averageCustomerValue: 1250,
});

describe("TenantCustomersView", () => {
  beforeEach(() => {
    mockedUseCustomerListGraphQL.mockReturnValue({
      customers: [buildCustomer()],
      total: 1,
      hasNextPage: false,
      limit: 100,
      offset: 0,
      isLoading: false,
      error: undefined,
      refetch: jest.fn(),
    });

    mockedUseCustomerMetricsGraphQL.mockReturnValue({
      metrics: buildMetrics(),
      isLoading: false,
      error: undefined,
      refetch: jest.fn(),
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("renders subscriber list with mapped customer details", async () => {
    render(<TenantCustomersView />);

    expect(await screen.findByText("Customer Management")).toBeInTheDocument();
    expect(screen.getByText("#SUB-001")).toBeInTheDocument();
    expect(screen.getByText("jane.doe@example.com")).toBeInTheDocument();
    expect(screen.getByText("$1,200")).toBeInTheDocument();
  });

  it("displays KPI cards using transformed metrics", async () => {
    render(<TenantCustomersView />);

    expect(await screen.findByText("Total Customers")).toBeInTheDocument();
    expect(screen.getByText("$50,000")).toBeInTheDocument();
    expect(screen.getByText("$1,250")).toBeInTheDocument();
    expect(screen.getByText("Churn rate: 2.5%")).toBeInTheDocument();
  });
});
