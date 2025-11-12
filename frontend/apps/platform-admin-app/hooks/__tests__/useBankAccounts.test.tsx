/**
 * Platform Admin App - useBankAccounts tests
 *
 * Validates bank account queries/mutations and manual payment recording.
 */

import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import {
  useBankAccounts,
  useCreateBankAccount,
  useRecordCashPayment,
} from "../useBankAccounts";
import { bankAccountsService } from "@/lib/services/bank-accounts-service";
import { useToast } from "@dotmac/ui";

jest.unmock("@tanstack/react-query");

jest.mock("@/lib/services/bank-accounts-service", () => ({
  bankAccountsService: {
    listBankAccounts: jest.fn(),
    createBankAccount: jest.fn(),
    recordCashPayment: jest.fn(),
  },
}));

const toastMock = jest.fn();
jest.mock("@dotmac/ui", () => ({
  useToast: () => ({
    toast: toastMock,
  }),
}));

const mockedService = bankAccountsService as jest.Mocked<typeof bankAccountsService>;

describe("Platform Admin useBankAccounts hooks", () => {
  const createWrapper = () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    return { wrapper, queryClient };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    toastMock.mockClear();
  });

  it("fetches bank accounts", async () => {
    mockedService.listBankAccounts.mockResolvedValue([{ id: 1, name: "Operating" }] as any);

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useBankAccounts(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedService.listBankAccounts).toHaveBeenCalledWith(false);
    expect(result.current.data?.[0].name).toBe("Operating");
  });

  it("creates accounts and invalidates caches", async () => {
    mockedService.createBankAccount.mockResolvedValue({ id: 2 } as any);

    const { wrapper, queryClient } = createWrapper();
    const invalidateSpy = jest.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useCreateBankAccount(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ name: "Reserve" } as any);
    });

    expect(mockedService.createBankAccount).toHaveBeenCalledWith({ name: "Reserve" });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["bank-accounts"] });
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Bank Account Created" }),
    );
  });

  it("records manual cash payments and invalidates summaries", async () => {
    mockedService.recordCashPayment.mockResolvedValue(undefined as any);

    const { wrapper, queryClient } = createWrapper();
    const invalidateSpy = jest.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useRecordCashPayment(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ amount: 100 } as any);
    });

    expect(mockedService.recordCashPayment).toHaveBeenCalledWith({ amount: 100 });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["manual-payments"] });
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Cash Payment Recorded" }),
    );
  });
});
