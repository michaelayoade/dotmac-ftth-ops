import React from "react";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import BillingAddonsPage from "@/app/dashboard/billing-revenue/addons/page";

jest.mock("@/components/auth/PermissionGuard", () => ({
  RouteGuard: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock("@/components/tenant/billing/SkeletonLoaders", () => ({
  AddonsPageSkeleton: () => <div data-testid="addons-skeleton" />,
}));

// Replace Radix Select components with simple stubs to avoid act warnings during tests
jest.mock("@dotmac/ui", () => {
  const actual = jest.requireActual("@dotmac/ui");
  const Select = ({ children }: any) => <div data-testid="mock-select">{children}</div>;
  const SelectTrigger = ({ children }: any) => <div>{children}</div>;
  const SelectValue = ({ placeholder }: any) => <span>{placeholder}</span>;
  const SelectContent = ({ children }: any) => <div>{children}</div>;
  const SelectItem = ({ children, value }: any) => (
    <div data-value={value} role="option">
      {children}
    </div>
  );
  return {
    ...actual,
    Select,
    SelectTrigger,
    SelectValue,
    SelectContent,
    SelectItem,
  };
});

const mockPurchaseAddon = jest.fn();
const mockUpdateAddonQuantity = jest.fn();
const mockCancelAddon = jest.fn();
const mockReactivateAddon = jest.fn();
const mockFetchAvailableAddons = jest.fn();

jest.mock("@/hooks/useTenantAddons", () => ({
  useTenantAddons: () => ({
    availableAddons: [
      {
        addon_id: "addon-1",
        name: "Priority Support",
        description: "24/7 priority support",
        addon_type: "support",
        billing_type: "recurring",
        price: 49,
        currency: "USD",
        is_featured: true,
        is_quantity_based: true,
        min_quantity: 1,
        max_quantity: 5,
        features: ["Dedicated TAM"],
      },
    ],
    activeAddons: [
      {
        tenant_addon_id: "tenant-addon-1",
        addon_id: "addon-1",
        addon_name: "Priority Support",
        status: "active",
        quantity: 1,
        price: 49,
        currency: "USD",
        started_at: new Date().toISOString(),
      },
    ],
    loading: false,
    error: null,
    fetchAvailableAddons: mockFetchAvailableAddons,
    purchaseAddon: mockPurchaseAddon,
    updateAddonQuantity: mockUpdateAddonQuantity,
    cancelAddon: mockCancelAddon,
    reactivateAddon: mockReactivateAddon,
  }),
}));

describe("BillingAddonsPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders active and available add-ons", async () => {
    render(<BillingAddonsPage />);

    expect(await screen.findByText("Add-ons Marketplace")).toBeInTheDocument();
    const instances = await screen.findAllByText("Priority Support");
    expect(instances.length).toBeGreaterThan(0);
  });

  it("purchases an add-on", async () => {
    render(<BillingAddonsPage />);

    const addButton = await screen.findByRole("button", { name: /Add to Subscription/i });
    await act(async () => {
      await userEvent.click(addButton);
    });

    await waitFor(() => expect(mockPurchaseAddon).toHaveBeenCalled());
    expect(mockPurchaseAddon).toHaveBeenCalledWith("addon-1", { quantity: expect.any(Number) });
  });
});
