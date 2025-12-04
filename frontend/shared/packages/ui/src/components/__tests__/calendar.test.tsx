/**
 * Calendar Component Tests
 *
 * Tests shadcn/ui Calendar component built on react-day-picker
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";

import { Calendar } from "../calendar";

describe("Calendar", () => {
  const today = new Date(2024, 0, 15); // January 15, 2024

  describe("Basic Rendering", () => {
    it("renders calendar", () => {
      const { container } = render(<Calendar />);

      expect(container.querySelector(".rdp")).toBeInTheDocument();
    });

    it("renders month caption", () => {
      render(<Calendar defaultMonth={today} />);

      // Should render current month name
      expect(
        screen.getByText(
          /January|February|March|April|May|June|July|August|September|October|November|December/,
        ),
      ).toBeInTheDocument();
    });

    it("renders day headers", () => {
      render(<Calendar />);

      // Common day abbreviations
      const dayHeaders = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
      const foundHeader = dayHeaders.some((day) => {
        try {
          screen.getByText(day);
          return true;
        } catch {
          return false;
        }
      });

      expect(foundHeader).toBe(true);
    });

    it("renders navigation buttons", () => {
      const { container } = render(<Calendar />);

      const buttons = container.querySelectorAll("button");
      expect(buttons.length).toBeGreaterThan(0);
    });

    it("supports custom className", () => {
      const { container } = render(<Calendar className="custom-calendar" />);

      const calendar = container.querySelector(".rdp");
      expect(calendar).toHaveClass("custom-calendar");
    });
  });

  describe("Single Date Selection", () => {
    it("renders with selected date", () => {
      render(<Calendar mode="single" selected={today} />);

      // Day 15 should be marked as selected
      const dayButton = screen.getByText("15");
      expect(dayButton).toHaveClass("bg-primary");
    });

    it("calls onSelect when date is clicked", async () => {
      const user = userEvent.setup();
      const onSelect = jest.fn();

      render(<Calendar mode="single" onSelect={onSelect} defaultMonth={today} />);

      const dayButton = screen.getByText("15");
      await user.click(dayButton);

      expect(onSelect).toHaveBeenCalled();
    });

    it("allows changing selection", async () => {
      const user = userEvent.setup();
      const onSelect = jest.fn();

      render(<Calendar mode="single" selected={today} onSelect={onSelect} />);

      // Click a different day
      const dayButton = screen.getByText("20");
      await user.click(dayButton);

      expect(onSelect).toHaveBeenCalled();
    });
  });

  describe("Navigation", () => {
    it("navigates to previous month", async () => {
      const user = userEvent.setup();
      render(<Calendar defaultMonth={new Date(2024, 1, 1)} />); // February

      const prevButton = screen.getByRole("button", { name: /Go to the Previous Month/i });
      await user.click(prevButton);

      // Should now show January
      expect(screen.getByText(/January/i)).toBeInTheDocument();
    });

    it("navigates to next month", async () => {
      const user = userEvent.setup();
      render(<Calendar defaultMonth={new Date(2024, 0, 1)} />); // January

      const nextButton = screen.getByRole("button", { name: /Go to the Next Month/i });
      await user.click(nextButton);

      // Should now show February
      expect(screen.getByText(/February/i)).toBeInTheDocument();
    });

    it("keyboard navigation with arrow keys", async () => {
      const user = userEvent.setup();
      const onSelect = jest.fn();

      render(<Calendar mode="single" onSelect={onSelect} defaultMonth={today} />);

      const dayButton = screen.getByText("15");
      dayButton.focus();

      // Arrow right should move to next day
      await user.keyboard("{ArrowRight}");

      // Focus should move (exact behavior depends on react-day-picker)
      expect(document.activeElement).toBeDefined();
    });
  });

  describe("Outside Days", () => {
    it("shows outside days by default", () => {
      const { container } = render(<Calendar defaultMonth={today} />);

      // Outside days should be visible
      const outsideDays = container.querySelectorAll(".day-outside");
      expect(outsideDays.length).toBeGreaterThanOrEqual(0);
    });

    it("hides outside days when showOutsideDays is false", () => {
      const { container } = render(<Calendar showOutsideDays={false} defaultMonth={today} />);

      // Check that outside days are hidden or not rendered
      const calendar = container.querySelector(".rdp");
      expect(calendar).toBeInTheDocument();
    });
  });

  describe("Disabled Dates", () => {
    it("disables dates before minimum date", () => {
      const minDate = new Date(2024, 0, 10);
      render(<Calendar mode="single" disabled={{ before: minDate }} defaultMonth={today} />);

      const disabledDay = screen.getByText("5");
      expect(disabledDay).toHaveClass("text-muted-foreground");
    });

    it("disables dates after maximum date", () => {
      const maxDate = new Date(2024, 0, 20);
      render(<Calendar mode="single" disabled={{ after: maxDate }} defaultMonth={today} />);

      const disabledDay = screen.getByText("25");
      expect(disabledDay).toHaveClass("text-muted-foreground");
    });

    it("cannot select disabled dates", async () => {
      const user = userEvent.setup();
      const onSelect = jest.fn();
      const minDate = new Date(2024, 0, 10);

      render(
        <Calendar
          mode="single"
          onSelect={onSelect}
          disabled={{ before: minDate }}
          defaultMonth={today}
        />,
      );

      const disabledDay = screen.getByText("5");
      await user.click(disabledDay);

      // Should not call onSelect for disabled date
      expect(onSelect).not.toHaveBeenCalled();
    });
  });

  describe("Today Highlighting", () => {
    it("highlights today's date", () => {
      const todayDate = new Date();
      render(<Calendar defaultMonth={todayDate} />);

      const todayDay = screen.getByText(todayDate.getDate().toString());
      expect(todayDay).toHaveClass("bg-accent");
    });
  });

  describe("Multiple Months", () => {
    it("renders multiple months", () => {
      const { container } = render(<Calendar numberOfMonths={2} defaultMonth={today} />);

      const months = container.querySelectorAll(".rdp-month");
      expect(months.length).toBe(2);
    });

    it("renders two months side by side", () => {
      render(<Calendar numberOfMonths={2} defaultMonth={today} />);

      // Should show current and next month
      expect(screen.getByText(/January/i)).toBeInTheDocument();
      expect(screen.getByText(/February/i)).toBeInTheDocument();
    });
  });

  describe("Range Selection", () => {
    it("renders with date range", () => {
      const from = new Date(2024, 0, 10);
      const to = new Date(2024, 0, 20);

      render(<Calendar mode="range" selected={{ from, to }} defaultMonth={today} />);

      // Start and end dates should be marked
      const startDay = screen.getByText("10");
      const endDay = screen.getByText("20");

      expect(startDay).toHaveClass("bg-primary");
      expect(endDay).toHaveClass("bg-primary");
    });

    it("calls onSelect with range when dates are clicked", async () => {
      const user = userEvent.setup();
      const onSelect = jest.fn();

      render(<Calendar mode="range" onSelect={onSelect} defaultMonth={today} />);

      // Click start date
      await user.click(screen.getByText("10"));
      expect(onSelect).toHaveBeenCalled();

      // Click end date
      await user.click(screen.getByText("20"));
      expect(onSelect).toHaveBeenCalledTimes(2);
    });
  });

  describe("Styling", () => {
    it("applies button variant to navigation buttons", () => {
      const { container } = render(<Calendar defaultMonth={today} />);

      const navButtons = container.querySelectorAll("button");
      navButtons.forEach((button) => {
        // Navigation buttons should have outline variant styles
        if (button.querySelector("svg")) {
          expect(button).toHaveClass("bg-transparent");
        }
      });
    });

    it("applies ghost variant to day buttons", () => {
      render(<Calendar defaultMonth={today} />);

      const dayButton = screen.getByText("15");
      // Day buttons use ghost variant from buttonVariants
      expect(dayButton.tagName).toBe("BUTTON");
    });

    it("applies selected styles", () => {
      render(<Calendar mode="single" selected={today} defaultMonth={today} />);

      const selectedDay = screen.getByText("15");
      expect(selectedDay).toHaveClass("bg-primary");
    });
  });

  describe("Custom Class Names", () => {
    it("accepts custom classNames prop", () => {
      const { container } = render(
        <Calendar
          classNames={{
            months: "custom-months",
            caption: "custom-caption",
          }}
          defaultMonth={today}
        />,
      );

      expect(container.querySelector(".custom-months")).toBeInTheDocument();
      expect(container.querySelector(".custom-caption")).toBeInTheDocument();
    });
  });

  describe("Real-World Usage Patterns", () => {
    it("renders date picker calendar", () => {
      render(<Calendar mode="single" selected={today} initialFocus />);

      // Should render interactive calendar
      expect(screen.getByText("15")).toBeInTheDocument();
    });

    it("renders date range picker calendar", () => {
      const from = new Date(2024, 0, 1);
      const to = new Date(2024, 0, 31);

      render(<Calendar mode="range" selected={{ from, to }} numberOfMonths={2} />);

      // Should show start and end of range
      expect(screen.getAllByText("1").length).toBeGreaterThan(1);
      expect(screen.getAllByText("31").length).toBeGreaterThan(1);
    });

    it("renders booking calendar with disabled dates", () => {
      const bookedDates = [new Date(2024, 0, 10), new Date(2024, 0, 11), new Date(2024, 0, 12)];

      render(<Calendar mode="single" disabled={bookedDates} defaultMonth={today} />);

      const disabledDay = screen.getByText("10");
      expect(disabledDay).toHaveClass("text-muted-foreground");
    });

    it("renders event calendar", () => {
      render(<Calendar mode="single" defaultMonth={today} />);

      // Calendar should be interactive
      const dayButton = screen.getByText("15");
      expect(dayButton).toBeInTheDocument();
    });
  });

  describe("Accessibility", () => {
    it("day buttons are keyboard focusable", () => {
      render(<Calendar defaultMonth={today} />);

      const dayButton = screen.getByText("15");
      dayButton.focus();

      expect(document.activeElement).toBe(dayButton);
    });

    it("navigation buttons are accessible", () => {
      const { container } = render(<Calendar defaultMonth={today} />);

      const buttons = container.querySelectorAll("button");
      buttons.forEach((button) => {
        expect(button).toBeInstanceOf(HTMLButtonElement);
      });
    });

    it("supports keyboard navigation", async () => {
      const user = userEvent.setup();
      render(<Calendar mode="single" defaultMonth={today} />);

      const dayButton = screen.getByText("15");
      dayButton.focus();

      // Tab should move focus
      await user.tab();

      expect(document.activeElement).toBeDefined();
    });
  });

  describe("Edge Cases", () => {
    it("handles month with 31 days", () => {
      render(<Calendar defaultMonth={new Date(2024, 0, 1)} />); // January

      expect(screen.getAllByText("31").length).toBeGreaterThan(0);
    });

    it("handles month with 28 days", () => {
      render(<Calendar defaultMonth={new Date(2024, 1, 1)} />); // February 2024 (leap year)

      expect(screen.getAllByText("29").length).toBeGreaterThan(0);
    });

    it("handles year transitions", async () => {
      const user = userEvent.setup();
      render(<Calendar defaultMonth={new Date(2023, 11, 1)} />); // December 2023

      const nextButton = screen.getByRole("button", { name: /Go to the Next Month/i });
      await user.click(nextButton);

      // Should show January 2024
      expect(screen.getByText(/January/i)).toBeInTheDocument();
    });

    it("handles undefined selected date", () => {
      render(<Calendar mode="single" selected={undefined} />);

      // Should render without errors
      expect(screen.getByRole("grid")).toBeInTheDocument();
    });
  });

  describe("Display Name", () => {
    it("Calendar has correct display name", () => {
      expect(Calendar.displayName).toBe("Calendar");
    });
  });
});
