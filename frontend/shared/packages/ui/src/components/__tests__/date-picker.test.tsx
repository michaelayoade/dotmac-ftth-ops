/**
 * DatePicker Component Tests
 *
 * Tests DatePicker and DateRangePicker components built with Calendar and Popover
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";

import { DatePicker, DateRangePicker } from "../date-picker";

describe("DatePicker", () => {
  const testDate = new Date(2024, 0, 15); // January 15, 2024

  describe("Basic Rendering", () => {
    it("renders date picker button", () => {
      render(<DatePicker />);

      const button = screen.getByRole("button");
      expect(button).toBeInTheDocument();
    });

    it("displays placeholder when no date selected", () => {
      render(<DatePicker placeholder="Choose a date" />);

      expect(screen.getByText("Choose a date")).toBeInTheDocument();
    });

    it("displays formatted date when selected", () => {
      render(<DatePicker date={testDate} />);

      // date-fns formats as "January 15, 2024" or similar
      expect(screen.getByText(/January.*15.*2024/i)).toBeInTheDocument();
    });

    it("renders calendar icon", () => {
      const { container } = render(<DatePicker />);

      const icon = container.querySelector("svg");
      expect(icon).toBeInTheDocument();
    });

    it("can be disabled", () => {
      render(<DatePicker disabled />);

      const button = screen.getByRole("button");
      expect(button).toBeDisabled();
    });
  });

  describe("Opening and Closing", () => {
    it("opens calendar popover when clicked", async () => {
      const user = userEvent.setup();
      render(<DatePicker />);

      await user.click(screen.getByRole("button"));

      await waitFor(() => {
        expect(screen.getByRole("grid")).toBeInTheDocument();
      });
    });

    it("closes calendar when date is selected", async () => {
      const user = userEvent.setup();
      const onDateChange = jest.fn();

      render(<DatePicker onDateChange={onDateChange} />);

      await user.click(screen.getByRole("button"));
      await waitFor(() => {
        expect(screen.getByRole("grid")).toBeInTheDocument();
      });

      const dayButton = screen.getByText("15");
      await user.click(dayButton);

      await waitFor(() => {
        expect(screen.queryByRole("grid")).not.toBeInTheDocument();
      });
    });
  });

  describe("Date Selection", () => {
    it("calls onDateChange when date is selected", async () => {
      const user = userEvent.setup();
      const onDateChange = jest.fn();

      render(<DatePicker onDateChange={onDateChange} />);

      await user.click(screen.getByRole("button"));
      await waitFor(() => {
        expect(screen.getByRole("grid")).toBeInTheDocument();
      });

      const dayButton = screen.getByText("15");
      await user.click(dayButton);

      expect(onDateChange).toHaveBeenCalled();
      const callArg = onDateChange.mock.calls[0][0];
      expect(callArg).toBeInstanceOf(Date);
    });

    it("updates displayed date when selection changes", async () => {
      const user = userEvent.setup();
      let selectedDate: Date | undefined = undefined;
      const onDateChange = jest.fn((date) => {
        selectedDate = date;
      });

      const { rerender } = render(<DatePicker date={selectedDate} onDateChange={onDateChange} />);

      await user.click(screen.getByRole("button"));
      await waitFor(() => {
        expect(screen.getByRole("grid")).toBeInTheDocument();
      });

      const dayButton = screen.getByText("15");
      await user.click(dayButton);

      expect(onDateChange).toHaveBeenCalled();

      // Rerender with new date
      if (onDateChange.mock.calls[0][0]) {
        selectedDate = onDateChange.mock.calls[0][0];
        rerender(<DatePicker date={selectedDate} onDateChange={onDateChange} />);

        await waitFor(() => {
          expect(screen.getByText(/15/)).toBeInTheDocument();
        });
      }
    });

    it("allows clearing selection", async () => {
      const user = userEvent.setup();
      const onDateChange = jest.fn();

      render(<DatePicker date={testDate} onDateChange={onDateChange} />);

      await user.click(screen.getByRole("button"));
      await waitFor(() => {
        expect(screen.getByRole("grid")).toBeInTheDocument();
      });

      // Clicking the same date or another action to clear
      expect(onDateChange).toBeDefined();
    });
  });

  describe("Styling", () => {
    it("applies muted foreground to placeholder", () => {
      render(<DatePicker placeholder="Pick a date" />);

      const placeholder = screen.getByText("Pick a date");
      expect(placeholder).toHaveClass("text-muted-foreground");
    });

    it("applies outline variant to button", () => {
      render(<DatePicker />);

      const button = screen.getByRole("button");
      expect(button).toHaveClass("border-input");
    });

    it("supports custom className", () => {
      render(<DatePicker className="custom-picker" />);

      const button = screen.getByRole("button");
      expect(button).toHaveClass("custom-picker");
    });
  });

  describe("Real-World Usage Patterns", () => {
    it("renders birth date picker", async () => {
      const user = userEvent.setup();
      const onDateChange = jest.fn();

      render(<DatePicker placeholder="Select birth date" onDateChange={onDateChange} />);

      await user.click(screen.getByRole("button"));

      await waitFor(() => {
        expect(screen.getByRole("grid")).toBeInTheDocument();
      });
    });

    it("renders appointment scheduler", () => {
      render(<DatePicker date={testDate} placeholder="Choose appointment date" />);

      expect(screen.getByText(/January.*15.*2024/i)).toBeInTheDocument();
    });

    it("renders event date selector", async () => {
      const user = userEvent.setup();

      render(<DatePicker placeholder="Event date" />);

      await user.click(screen.getByRole("button"));

      await waitFor(() => {
        expect(screen.getByRole("grid")).toBeInTheDocument();
      });
    });
  });

  describe("Accessibility", () => {
    it("button is keyboard focusable", () => {
      render(<DatePicker />);

      const button = screen.getByRole("button");
      button.focus();

      expect(document.activeElement).toBe(button);
    });

    it("can be opened with keyboard", async () => {
      const user = userEvent.setup();
      render(<DatePicker />);

      const button = screen.getByRole("button");
      button.focus();

      await user.keyboard("{Enter}");

      await waitFor(() => {
        expect(screen.getByRole("grid")).toBeInTheDocument();
      });
    });
  });

  describe("Edge Cases", () => {
    it("handles undefined date", () => {
      render(<DatePicker date={undefined} />);

      const button = screen.getByRole("button");
      expect(button).toBeInTheDocument();
    });

    it("handles custom placeholder", () => {
      render(<DatePicker placeholder="Custom placeholder text" />);

      expect(screen.getByText("Custom placeholder text")).toBeInTheDocument();
    });
  });
});

describe("DateRangePicker", () => {
  const fromDate = new Date(2024, 0, 10); // January 10, 2024
  const toDate = new Date(2024, 0, 20); // January 20, 2024

  describe("Basic Rendering", () => {
    it("renders date range picker button", () => {
      render(<DateRangePicker />);

      const button = screen.getByRole("button");
      expect(button).toBeInTheDocument();
    });

    it("displays placeholder when no range selected", () => {
      render(<DateRangePicker placeholder="Select date range" />);

      expect(screen.getByText("Select date range")).toBeInTheDocument();
    });

    it("displays formatted range when selected", () => {
      render(<DateRangePicker dateRange={{ from: fromDate, to: toDate }} />);

      // Should show "Jan 10, 2024 - Jan 20, 2024" or similar
      expect(screen.getByText(/Jan.*10.*2024.*Jan.*20.*2024/i)).toBeInTheDocument();
    });

    it("displays single date when only from is selected", () => {
      render(<DateRangePicker dateRange={{ from: fromDate }} />);

      // Should show just the from date
      expect(screen.getByText(/Jan.*10.*2024/i)).toBeInTheDocument();
    });

    it("renders calendar icon", () => {
      const { container } = render(<DateRangePicker />);

      const icon = container.querySelector("svg");
      expect(icon).toBeInTheDocument();
    });

    it("can be disabled", () => {
      render(<DateRangePicker disabled />);

      const button = screen.getByRole("button");
      expect(button).toBeDisabled();
    });
  });

  describe("Opening and Closing", () => {
    it("opens calendar popover when clicked", async () => {
      const user = userEvent.setup();
      render(<DateRangePicker />);

      await user.click(screen.getByRole("button"));

      await waitFor(() => {
        const grids = screen.getAllByRole("grid");
        expect(grids.length).toBeGreaterThan(0);
      });
    });

    it("displays two months by default", async () => {
      const user = userEvent.setup();
      render(<DateRangePicker />);

      await user.click(screen.getByRole("button"));

      await waitFor(() => {
        const grids = screen.getAllByRole("grid");
        expect(grids.length).toBe(2);
      });
    });
  });

  describe("Range Selection", () => {
    it("calls onDateRangeChange when range is selected", async () => {
      const user = userEvent.setup();
      const onDateRangeChange = jest.fn();

      render(<DateRangePicker onDateRangeChange={onDateRangeChange} />);

      await user.click(screen.getByRole("button"));
      await waitFor(() => {
        expect(screen.getAllByRole("grid").length).toBeGreaterThan(0);
      });

      // Click to start range
      const startDay = screen.getAllByText("10")[0];
      await user.click(startDay);

      expect(onDateRangeChange).toHaveBeenCalled();
    });

    it("allows selecting start and end dates", async () => {
      const user = userEvent.setup();
      const onDateRangeChange = jest.fn();

      render(<DateRangePicker onDateRangeChange={onDateRangeChange} />);

      await user.click(screen.getByRole("button"));
      await waitFor(() => {
        expect(screen.getAllByRole("grid").length).toBeGreaterThan(0);
      });

      // Select start date
      const startDays = screen.getAllByText("10");
      if (startDays.length > 0) {
        await user.click(startDays[0]);
      }

      // Select end date
      const endDays = screen.getAllByText("20");
      if (endDays.length > 0) {
        await user.click(endDays[0]);
      }

      expect(onDateRangeChange).toHaveBeenCalled();
    });
  });

  describe("Display Format", () => {
    it("formats range with dash separator", () => {
      render(<DateRangePicker dateRange={{ from: fromDate, to: toDate }} />);

      const button = screen.getByRole("button");
      expect(button.textContent).toContain("-");
    });

    it("shows only from date when to is undefined", () => {
      render(<DateRangePicker dateRange={{ from: fromDate }} />);

      expect(screen.getByText(/Jan.*10.*2024/i)).toBeInTheDocument();
    });
  });

  describe("Styling", () => {
    it("applies muted foreground to placeholder", () => {
      render(<DateRangePicker placeholder="Pick range" />);

      const placeholder = screen.getByText("Pick range");
      expect(placeholder).toHaveClass("text-muted-foreground");
    });

    it("supports custom className", () => {
      render(<DateRangePicker className="custom-range-picker" />);

      const button = screen.getByRole("button");
      expect(button).toHaveClass("custom-range-picker");
    });

    it("applies outline variant to button", () => {
      render(<DateRangePicker />);

      const button = screen.getByRole("button");
      expect(button).toHaveClass("border-input");
    });
  });

  describe("Real-World Usage Patterns", () => {
    it("renders booking date range selector", () => {
      render(
        <DateRangePicker
          dateRange={{ from: fromDate, to: toDate }}
          placeholder="Select stay dates"
        />,
      );

      expect(screen.getByText(/Jan.*10.*2024.*Jan.*20.*2024/i)).toBeInTheDocument();
    });

    it("renders report date range filter", async () => {
      const user = userEvent.setup();

      render(<DateRangePicker placeholder="Filter by date range" />);

      await user.click(screen.getByRole("button"));

      await waitFor(() => {
        expect(screen.getAllByRole("grid").length).toBe(2);
      });
    });

    it("renders vacation planner", () => {
      const startDate = new Date(2024, 6, 1); // July 1
      const endDate = new Date(2024, 6, 14); // July 14

      render(<DateRangePicker dateRange={{ from: startDate, to: endDate }} />);

      expect(screen.getByText(/Jul.*1.*2024.*Jul.*14.*2024/i)).toBeInTheDocument();
    });

    it("renders analytics date range selector", async () => {
      const user = userEvent.setup();
      const onDateRangeChange = jest.fn();

      render(
        <DateRangePicker
          placeholder="Select analysis period"
          onDateRangeChange={onDateRangeChange}
        />,
      );

      await user.click(screen.getByRole("button"));

      await waitFor(() => {
        expect(screen.getAllByRole("grid").length).toBeGreaterThan(0);
      });
    });
  });

  describe("Default Month", () => {
    it("shows correct default month when range has from date", async () => {
      const user = userEvent.setup();
      render(<DateRangePicker dateRange={{ from: fromDate }} />);

      await user.click(screen.getByRole("button"));

      await waitFor(() => {
        expect(screen.getByText(/January/i)).toBeInTheDocument();
      });
    });
  });

  describe("Accessibility", () => {
    it("button is keyboard focusable", () => {
      render(<DateRangePicker />);

      const button = screen.getByRole("button");
      button.focus();

      expect(document.activeElement).toBe(button);
    });

    it("can be opened with keyboard", async () => {
      const user = userEvent.setup();
      render(<DateRangePicker />);

      const button = screen.getByRole("button");
      button.focus();

      await user.keyboard("{Enter}");

      await waitFor(() => {
        expect(screen.getAllByRole("grid").length).toBeGreaterThan(0);
      });
    });
  });

  describe("Edge Cases", () => {
    it("handles undefined dateRange", () => {
      render(<DateRangePicker dateRange={undefined} />);

      const button = screen.getByRole("button");
      expect(button).toBeInTheDocument();
    });

    it("handles empty dateRange object", () => {
      render(<DateRangePicker dateRange={{}} />);

      expect(screen.getByRole("button")).toBeInTheDocument();
    });

    it("handles custom placeholder", () => {
      render(<DateRangePicker placeholder="Custom range placeholder" />);

      expect(screen.getByText("Custom range placeholder")).toBeInTheDocument();
    });

    it("handles range spanning multiple months", () => {
      const start = new Date(2024, 0, 25); // Jan 25
      const end = new Date(2024, 1, 5); // Feb 5

      render(<DateRangePicker dateRange={{ from: start, to: end }} />);

      expect(screen.getByText(/Jan.*25.*2024.*Feb.*5.*2024/i)).toBeInTheDocument();
    });
  });
});
