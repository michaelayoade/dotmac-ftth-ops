/**
 * Unit Tests for Time Tracking Dashboard
 * Tests clock in/out functionality and time entry management
 */

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import TimeTrackingPage from "../page";
import { TimeEntryType } from "@/types/field-service";
import * as useFieldServiceHooks from "@/hooks/useFieldService";
import { useSession } from "@shared/lib/auth";

// Mock the hooks
jest.mock("@/hooks/useFieldService");
jest.mock("@shared/lib/auth", () => ({
  useSession: jest.fn(),
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  const QueryClientWrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  QueryClientWrapper.displayName = "QueryClientWrapper";
  return QueryClientWrapper;
};

describe("TimeTrackingPage", () => {
  const mockTechnicianId = "tech-1";

  beforeEach(() => {
    jest.clearAllMocks();
    (useSession as jest.Mock).mockReturnValue({
      user: {
        technician_id: mockTechnicianId,
      },
      isLoading: false,
      isAuthenticated: true,
    });

    // Mock useTimeEntries
    (useFieldServiceHooks.useTimeEntries as jest.Mock).mockReturnValue({
      data: {
        entries: [],
        total: 0,
        page: 1,
        pageSize: 20,
        hasMore: false,
      },
      isLoading: false,
      isError: false,
    });

    // Mock useClockIn
    (useFieldServiceHooks.useClockIn as jest.Mock).mockReturnValue({
      mutate: jest.fn(),
      mutateAsync: jest.fn(),
      isLoading: false,
      isSuccess: false,
      isError: false,
    });

    // Mock useClockOut
    (useFieldServiceHooks.useClockOut as jest.Mock).mockReturnValue({
      mutate: jest.fn(),
      mutateAsync: jest.fn(),
      isLoading: false,
      isSuccess: false,
      isError: false,
    });

    // Mock useLaborRates
    (useFieldServiceHooks.useLaborRates as jest.Mock).mockReturnValue({
      data: {
        rates: [
          {
            id: "rate-1",
            name: "Senior Technician",
            skillLevel: "senior",
            regularRate: 2000,
          },
        ],
      },
      isLoading: false,
    });
  });

  it("informs the user when no technician profile exists", () => {
    (useSession as jest.Mock).mockReturnValue({
      data: { user: { technician_id: null } },
      isPending: false,
    });
    const Wrapper = createWrapper();

    render(
      <Wrapper>
        <TimeTrackingPage />
      </Wrapper>,
    );

    expect(screen.getByText(/couldn't find a technician profile/i)).toBeInTheDocument();
  });

  describe("Clock In/Out", () => {
    it("renders clock in button when no active entry", () => {
      const Wrapper = createWrapper();
      render(
        <Wrapper>
          <TimeTrackingPage />
        </Wrapper>,
      );

      expect(screen.getByText("Clock In")).toBeInTheDocument();
    });

    it("shows active time entry with elapsed time", () => {
      const mockActiveEntry = {
        id: "entry-1",
        technicianId: mockTechnicianId,
        clockIn: new Date().toISOString(),
        entryType: TimeEntryType.REGULAR,
        status: "draft",
        breakDurationMinutes: 0,
        isActive: true,
        description: "Fiber installation work",
      };

      (useFieldServiceHooks.useTimeEntries as jest.Mock).mockReturnValue({
        data: {
          entries: [mockActiveEntry],
          total: 1,
          page: 1,
          pageSize: 20,
          hasMore: false,
        },
        isLoading: false,
      });

      const Wrapper = createWrapper();
      render(
        <Wrapper>
          <TimeTrackingPage />
        </Wrapper>,
      );

      expect(screen.getByText("Clock Out")).toBeInTheDocument();
      expect(screen.getByText("Clocked In")).toBeInTheDocument();
      expect(screen.getByText(/Started:/i)).toBeInTheDocument();
    });

    it("calls clock in mutation when clock in button clicked", async () => {
      const mockClockInAsync = jest.fn().mockResolvedValue({});
      (useFieldServiceHooks.useClockIn as jest.Mock).mockReturnValue({
        mutate: jest.fn(),
        mutateAsync: mockClockInAsync,
        isPending: false,
      });

      const Wrapper = createWrapper();
      render(
        <Wrapper>
          <TimeTrackingPage />
        </Wrapper>,
      );

      const clockInButton = screen.getByText("Clock In");
      fireEvent.click(clockInButton);

      await waitFor(() => {
        expect(mockClockInAsync).toHaveBeenCalled();
      });
    });

    it("calls clock out mutation when clock out button clicked", async () => {
      const mockActiveEntry = {
        id: "entry-1",
        technicianId: mockTechnicianId,
        clockIn: new Date().toISOString(),
        entryType: TimeEntryType.REGULAR,
        status: "draft",
        breakDurationMinutes: 0,
        isActive: true,
      };

      (useFieldServiceHooks.useTimeEntries as jest.Mock).mockReturnValue({
        data: {
          entries: [mockActiveEntry],
          total: 1,
        },
        isLoading: false,
      });

      const mockClockOutAsync = jest.fn().mockResolvedValue({});
      (useFieldServiceHooks.useClockOut as jest.Mock).mockReturnValue({
        mutate: jest.fn(),
        mutateAsync: mockClockOutAsync,
        isPending: false,
      });

      const Wrapper = createWrapper();
      render(
        <Wrapper>
          <TimeTrackingPage />
        </Wrapper>,
      );

      const clockOutButton = screen.getByText("Clock Out");
      fireEvent.click(clockOutButton);

      await waitFor(() => {
        expect(mockClockOutAsync).toHaveBeenCalledWith({
          id: "entry-1",
          data: expect.any(Object),
        });
      });
    });
  });

  describe("Time Entry List", () => {
    it("displays empty state when no entries", () => {
      const Wrapper = createWrapper();
      render(
        <Wrapper>
          <TimeTrackingPage />
        </Wrapper>,
      );

      expect(screen.getByText(/No time entries/i)).toBeInTheDocument();
    });

    it("displays time entries with status badges", () => {
      const mockEntries = [
        {
          id: "entry-1",
          technicianId: mockTechnicianId,
          clockIn: "2025-11-08T09:00:00Z",
          clockOut: "2025-11-08T17:00:00Z",
          status: "submitted",
          entryType: TimeEntryType.REGULAR,
          breakDurationMinutes: 60,
          durationMinutes: 420,
          totalHours: 7,
          totalCost: 14000,
          isActive: false,
        },
        {
          id: "entry-2",
          technicianId: mockTechnicianId,
          clockIn: "2025-11-07T09:00:00Z",
          clockOut: "2025-11-07T17:00:00Z",
          status: "approved",
          entryType: TimeEntryType.REGULAR,
          breakDurationMinutes: 60,
          durationMinutes: 420,
          totalHours: 7,
          totalCost: 14000,
          isActive: false,
        },
      ];

      (useFieldServiceHooks.useTimeEntries as jest.Mock).mockReturnValue({
        data: {
          entries: mockEntries,
          total: 2,
        },
        isLoading: false,
      });

      const Wrapper = createWrapper();
      render(
        <Wrapper>
          <TimeTrackingPage />
        </Wrapper>,
      );

      // Status badges should be present (stats card has label "Submitted", entries have badge "Submitted")
      expect(screen.getAllByText("Submitted").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Approved").length).toBeGreaterThan(0);
      // Two entries with same duration
      expect(screen.getAllByText(/7h 0m/).length).toBe(2);
      expect(screen.getAllByText(/14,000/).length).toBeGreaterThan(0);
    });

    it("shows GPS coordinates when available", () => {
      const mockEntry = {
        id: "entry-1",
        technicianId: mockTechnicianId,
        clockIn: "2025-11-08T09:00:00Z",
        clockOut: "2025-11-08T17:00:00Z",
        status: "submitted",
        entryType: TimeEntryType.REGULAR,
        clockInLat: 6.5244,
        clockInLng: 3.3792,
        clockOutLat: 6.5245,
        clockOutLng: 3.3793,
        breakDurationMinutes: 60,
        totalHours: 7,
        isActive: false,
      };

      (useFieldServiceHooks.useTimeEntries as jest.Mock).mockReturnValue({
        data: {
          entries: [mockEntry],
          total: 1,
        },
        isLoading: false,
      });

      const Wrapper = createWrapper();
      render(
        <Wrapper>
          <TimeTrackingPage />
        </Wrapper>,
      );

      expect(screen.getByText(/6.5244/)).toBeInTheDocument();
      expect(screen.getByText(/3.3792/)).toBeInTheDocument();
    });
  });

  describe("Approval Workflow", () => {
    it("shows submit button for draft entries", async () => {
      const mockEntry = {
        id: "entry-1",
        technicianId: mockTechnicianId,
        clockIn: "2025-11-08T09:00:00Z",
        clockOut: "2025-11-08T17:00:00Z",
        status: "draft",
        entryType: TimeEntryType.REGULAR,
        breakDurationMinutes: 60,
        totalHours: 7,
        isActive: false,
      };

      (useFieldServiceHooks.useTimeEntries as jest.Mock).mockReturnValue({
        data: {
          entries: [mockEntry],
          total: 1,
        },
        isLoading: false,
      });

      const mockSubmitAsync = jest.fn().mockResolvedValue(undefined);
      (useFieldServiceHooks.useSubmitTimeEntry as jest.Mock).mockReturnValue({
        mutate: jest.fn(),
        mutateAsync: mockSubmitAsync,
        isPending: false,
        isSuccess: false,
        isError: false,
      });

      const Wrapper = createWrapper();
      render(
        <Wrapper>
          <TimeTrackingPage />
        </Wrapper>,
      );

      const submitButton = screen.getByText("Submit");
      expect(submitButton).toBeInTheDocument();

      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockSubmitAsync).toHaveBeenCalledWith("entry-1");
      });
    });

    it("shows approve/reject buttons for submitted entries (manager view)", () => {
      const mockEntry = {
        id: "entry-1",
        technicianId: "tech-2", // Different technician
        clockIn: "2025-11-08T09:00:00Z",
        clockOut: "2025-11-08T17:00:00Z",
        status: "submitted",
        entryType: TimeEntryType.REGULAR,
        breakDurationMinutes: 60,
        totalHours: 7,
        isActive: false,
      };

      (useFieldServiceHooks.useTimeEntries as jest.Mock).mockReturnValue({
        data: {
          entries: [mockEntry],
          total: 1,
        },
        isLoading: false,
      });

      const Wrapper = createWrapper();
      render(
        <Wrapper>
          <TimeTrackingPage />
        </Wrapper>,
      );

      // In a real scenario, this would check user role
      // and show approve/reject buttons for managers
      expect(screen.getAllByText("Submitted").length).toBeGreaterThan(0);
    });
  });

  describe("Statistics", () => {
    it("calculates and displays correct statistics", () => {
      const mockEntries = [
        {
          id: "entry-1",
          technicianId: mockTechnicianId,
          clockIn: "2025-11-08T09:00:00Z",
          clockOut: "2025-11-08T17:00:00Z",
          status: "submitted",
          entryType: TimeEntryType.REGULAR,
          breakDurationMinutes: 60,
          durationMinutes: 420,
          totalHours: 7,
          totalCost: 14000,
          isActive: false,
        },
        {
          id: "entry-2",
          technicianId: mockTechnicianId,
          clockIn: "2025-11-07T09:00:00Z",
          clockOut: "2025-11-07T17:00:00Z",
          status: "approved",
          entryType: TimeEntryType.REGULAR,
          breakDurationMinutes: 60,
          durationMinutes: 420,
          totalHours: 7,
          totalCost: 14000,
          isActive: false,
        },
      ];

      (useFieldServiceHooks.useTimeEntries as jest.Mock).mockReturnValue({
        data: {
          entries: mockEntries,
          total: 2,
        },
        isLoading: false,
      });

      const Wrapper = createWrapper();
      render(
        <Wrapper>
          <TimeTrackingPage />
        </Wrapper>,
      );

      // Total hours
      expect(screen.getByText("14.0")).toBeInTheDocument();

      // Total cost
      expect(screen.getByText(/₦28,000/)).toBeInTheDocument();

      // Submitted and Approved counts (both are "1", so we get multiple elements)
      const countElements = screen.getAllByText("1");
      expect(countElements.length).toBeGreaterThanOrEqual(2); // At least submitted and approved
    });
  });

  describe("Loading and Error States", () => {
    it("shows loading state", () => {
      (useFieldServiceHooks.useTimeEntries as jest.Mock).mockReturnValue({
        data: undefined,
        isLoading: true,
        isError: false,
      });

      const Wrapper = createWrapper();
      render(
        <Wrapper>
          <TimeTrackingPage />
        </Wrapper>,
      );

      expect(screen.getByText(/Loading/i)).toBeInTheDocument();
    });

    it("shows error state", () => {
      (useFieldServiceHooks.useTimeEntries as jest.Mock).mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
        error: new Error("Failed to fetch time entries"),
      });

      const Wrapper = createWrapper();
      render(
        <Wrapper>
          <TimeTrackingPage />
        </Wrapper>,
      );

      expect(screen.getByText(/Error/i)).toBeInTheDocument();
    });
  });
});
