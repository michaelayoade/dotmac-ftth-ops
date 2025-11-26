/**
 * Smoke tests for AlarmPerformanceMonitoring to ensure alarm actions respect
 * the VOLTHA health flag and driver errors.
 */

import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { rest } from "msw";
import { setupServer } from "msw/node";

// Mock dependencies
jest.mock("@/hooks/useVOLTHA", () => {
  const actual = jest.requireActual("@/hooks/useVOLTHA");
  return {
    ...actual,
    useVOLTHAHealth: jest.fn(),
    useVOLTHAAlarms: jest.fn(),
    useAcknowledgeAlarm: jest.fn(),
    useClearAlarm: jest.fn(),
  };
});

jest.mock("@dotmac/ui", () => ({
  useToast: () => ({ toast: jest.fn() }),
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Button: ({ children, ...rest }: any) => (
    // eslint-disable-next-line react/forbid-elements
    <button {...rest}>{children}</button>
  ),
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  Select: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children, ...rest }: any) => (
    // eslint-disable-next-line react/forbid-elements
    <div role="option" aria-selected="false" {...rest}>
      {children}
    </div>
  ),
  SelectTrigger: ({ children, ...rest }: any) => (
    // eslint-disable-next-line react/forbid-elements
    <button {...rest}>{children}</button>
  ),
  SelectValue: () => null,
  Tabs: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TabsList: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TabsTrigger: ({ children, ...rest }: any) => (
    // eslint-disable-next-line react/forbid-elements
    <button {...rest}>{children}</button>
  ),
  TabsContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Progress: () => <div role="progressbar" />,
}));

// Use CommonJS require to avoid pulling Next/ESM transforms during test discovery
const { AlarmPerformanceMonitoring } = require("../AlarmPerformanceMonitoring");
import {
  useVOLTHAHealth,
  useVOLTHAAlarms,
  useAcknowledgeAlarm,
  useClearAlarm,
} from "@/hooks/useVOLTHA";

const mockHealth = useVOLTHAHealth as jest.Mock;
const mockAlarms = useVOLTHAAlarms as jest.Mock;
const mockAcknowledge = useAcknowledgeAlarm as jest.Mock;
const mockClear = useClearAlarm as jest.Mock;

const server = setupServer(
  rest.get("/api/v1/voltha/performance-metrics", (_req, res, ctx) =>
    res(ctx.status(200), ctx.json({})),
  ),
  rest.get("http://localhost/api/v1/voltha/performance-metrics", (_req, res, ctx) =>
    res(ctx.status(200), ctx.json({})),
  ),
);

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe("AlarmPerformanceMonitoring", () => {
  let originalFetch: any;

  beforeAll(() => {
    server.listen({ onUnhandledRequest: "bypass" });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    originalFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
    mockHealth.mockReturnValue({ data: { healthy: true, alarm_actions_enabled: true } });
    mockAlarms.mockReturnValue({
      data: [
        {
          id: "alarm-1",
          type: "LOS",
          severity: "CRITICAL",
          state: "RAISED",
          description: "Loss of signal",
          category: "optic",
          device_id: "olt-1",
          raised_ts: new Date().toISOString(),
        },
      ],
      isLoading: false,
      refetch: jest.fn(),
    });
    mockAcknowledge.mockReturnValue({ mutate: jest.fn(), isPending: false });
    mockClear.mockReturnValue({ mutate: jest.fn(), isPending: false });
  });

  afterEach(() => {
    global.fetch = originalFetch;
    server.resetHandlers();
  });

  afterAll(() => {
    server.close();
  });

  it("disables buttons when health reports alarm_actions_enabled=false", async () => {
    mockHealth.mockReturnValue({
      data: { healthy: true, alarm_actions_enabled: false },
    });

    renderWithClient(<AlarmPerformanceMonitoring />);

    await waitFor(() => {
      expect(screen.getAllByText(/alarm acknowledge\/clear is disabled/i).length).toBeGreaterThan(
        0,
      );
    });

    const ackButton = screen.getByRole("button", { name: /acknowledge alarm/i });
    const clearButton = screen.getByRole("button", { name: /clear alarm/i });
    expect(ackButton).toBeDisabled();
    expect(clearButton).toBeDisabled();
  });

  it("shows banner and disables after driver error message", async () => {
    mockAcknowledge.mockImplementation(({ onError }: any) => ({
      mutate: () => onError?.(new Error("Alarm acknowledgement not supported by this driver")),
      isPending: false,
    }));

    renderWithClient(<AlarmPerformanceMonitoring />);

    const ackButton = screen.getByRole("button", { name: /acknowledge alarm/i });
    fireEvent.click(ackButton);

    await waitFor(() => {
      expect(screen.getAllByText(/alarm acknowledge\/clear is disabled/i).length).toBeGreaterThan(
        0,
      );
    });
  });
});
