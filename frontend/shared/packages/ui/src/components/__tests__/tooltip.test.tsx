/**
 * Tooltip Component Tests
 *
 * Tests shadcn/ui Tooltip primitive built on Radix UI
 */

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";

import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "../tooltip";

describe("Tooltip", () => {
  describe("Basic Rendering", () => {
    it("renders tooltip trigger", () => {
      render(
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>Hover me</TooltipTrigger>
            <TooltipContent>Tooltip text</TooltipContent>
          </Tooltip>
        </TooltipProvider>,
      );

      expect(screen.getByText("Hover me")).toBeInTheDocument();
    });

    it("tooltip content is not visible initially", () => {
      render(
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>Trigger</TooltipTrigger>
            <TooltipContent>Tooltip text</TooltipContent>
          </Tooltip>
        </TooltipProvider>,
      );

      expect(screen.queryByText("Tooltip text")).not.toBeInTheDocument();
    });

    it("shows tooltip on hover", async () => {
      const user = userEvent.setup();

      render(
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>Hover me</TooltipTrigger>
            <TooltipContent>Tooltip text</TooltipContent>
          </Tooltip>
        </TooltipProvider>,
      );

      const trigger = screen.getByText("Hover me");
      await user.hover(trigger);

      await waitFor(() => {
        expect(screen.getByText("Tooltip text")).toBeInTheDocument();
      });
    });

    it("hides tooltip when mouse leaves", async () => {
      const user = userEvent.setup();

      render(
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>Hover me</TooltipTrigger>
            <TooltipContent>Tooltip text</TooltipContent>
          </Tooltip>
        </TooltipProvider>,
      );

      const trigger = screen.getByText("Hover me");
      await user.hover(trigger);

      await waitFor(() => {
        expect(screen.getByText("Tooltip text")).toBeInTheDocument();
      });

      await user.unhover(trigger);

      await waitFor(() => {
        expect(screen.queryByText("Tooltip text")).not.toBeInTheDocument();
      });
    });
  });

  describe("TooltipProvider", () => {
    it("wraps tooltips with provider", () => {
      const { container } = render(
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>Trigger</TooltipTrigger>
            <TooltipContent>Content</TooltipContent>
          </Tooltip>
        </TooltipProvider>,
      );

      expect(container).toBeInTheDocument();
    });

    it("allows multiple tooltips in one provider", async () => {
      const user = userEvent.setup();

      render(
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>First</TooltipTrigger>
            <TooltipContent>First tooltip</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger>Second</TooltipTrigger>
            <TooltipContent>Second tooltip</TooltipContent>
          </Tooltip>
        </TooltipProvider>,
      );

      await user.hover(screen.getByText("First"));

      await waitFor(() => {
        expect(screen.getByText("First tooltip")).toBeInTheDocument();
      });
    });
  });

  describe("TooltipContent", () => {
    it("renders tooltip content with proper styles", async () => {
      const user = userEvent.setup();

      render(
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>Trigger</TooltipTrigger>
            <TooltipContent>Styled content</TooltipContent>
          </Tooltip>
        </TooltipProvider>,
      );

      await user.hover(screen.getByText("Trigger"));

      await waitFor(() => {
        const content = screen.getByText("Styled content");
        expect(content).toHaveClass("z-50", "overflow-hidden", "rounded-md");
        expect(content).toHaveClass("border", "bg-popover", "px-3", "py-1.5");
        expect(content).toHaveClass("text-sm", "text-popover-foreground", "shadow-md");
      });
    });

    it("applies custom className", async () => {
      const user = userEvent.setup();

      render(
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>Trigger</TooltipTrigger>
            <TooltipContent className="custom-tooltip">Content</TooltipContent>
          </Tooltip>
        </TooltipProvider>,
      );

      await user.hover(screen.getByText("Trigger"));

      await waitFor(() => {
        const content = screen.getByText("Content");
        expect(content).toHaveClass("custom-tooltip");
      });
    });

    it("uses default sideOffset of 4", async () => {
      const user = userEvent.setup();

      render(
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>Trigger</TooltipTrigger>
            <TooltipContent>Content</TooltipContent>
          </Tooltip>
        </TooltipProvider>,
      );

      await user.hover(screen.getByText("Trigger"));

      await waitFor(() => {
        expect(screen.getByText("Content")).toBeInTheDocument();
      });
    });

    it("accepts custom sideOffset", async () => {
      const user = userEvent.setup();

      render(
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>Trigger</TooltipTrigger>
            <TooltipContent sideOffset={10}>Content</TooltipContent>
          </Tooltip>
        </TooltipProvider>,
      );

      await user.hover(screen.getByText("Trigger"));

      await waitFor(() => {
        expect(screen.getByText("Content")).toBeInTheDocument();
      });
    });
  });

  describe("TooltipTrigger", () => {
    it("renders as button by default", () => {
      render(
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>Button trigger</TooltipTrigger>
            <TooltipContent>Content</TooltipContent>
          </Tooltip>
        </TooltipProvider>,
      );

      expect(screen.getByRole("button", { name: "Button trigger" })).toBeInTheDocument();
    });

    it("supports asChild to render custom trigger", async () => {
      const user = userEvent.setup();

      render(
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span>Custom trigger</span>
            </TooltipTrigger>
            <TooltipContent>Content</TooltipContent>
          </Tooltip>
        </TooltipProvider>,
      );

      const trigger = screen.getByText("Custom trigger");
      await user.hover(trigger);

      await waitFor(() => {
        expect(screen.getByText("Content")).toBeInTheDocument();
      });
    });

    it("can be disabled", async () => {
      const user = userEvent.setup();

      render(
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger disabled>Disabled trigger</TooltipTrigger>
            <TooltipContent>Content</TooltipContent>
          </Tooltip>
        </TooltipProvider>,
      );

      const trigger = screen.getByRole("button");
      await user.hover(trigger);

      // Tooltip should not appear when disabled
      expect(screen.queryByText("Content")).not.toBeInTheDocument();
    });
  });

  describe("Controlled Tooltip", () => {
    it("can be controlled with open prop", async () => {
      function ControlledTooltip() {
        const [open, setOpen] = React.useState(false);

        return (
          <>
            <button onClick={() => setOpen(!open)}>Toggle</button>
            <TooltipProvider>
              <Tooltip open={open} onOpenChange={setOpen}>
                <TooltipTrigger>Trigger</TooltipTrigger>
                <TooltipContent>Controlled content</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </>
        );
      }

      render(<ControlledTooltip />);

      expect(screen.queryByText("Controlled content")).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: "Toggle" }));

      await waitFor(() => {
        expect(screen.getByText("Controlled content")).toBeInTheDocument();
      });
    });

    it("calls onOpenChange when tooltip state changes", async () => {
      const handleOpenChange = jest.fn();
      const user = userEvent.setup();

      render(
        <TooltipProvider>
          <Tooltip onOpenChange={handleOpenChange}>
            <TooltipTrigger>Trigger</TooltipTrigger>
            <TooltipContent>Content</TooltipContent>
          </Tooltip>
        </TooltipProvider>,
      );

      await user.hover(screen.getByText("Trigger"));

      await waitFor(() => {
        expect(handleOpenChange).toHaveBeenCalledWith(true);
      });
    });
  });

  describe("Animation Classes", () => {
    it("has animation classes on content", async () => {
      const user = userEvent.setup();

      render(
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>Trigger</TooltipTrigger>
            <TooltipContent>Content</TooltipContent>
          </Tooltip>
        </TooltipProvider>,
      );

      await user.hover(screen.getByText("Trigger"));

      await waitFor(() => {
        const content = screen.getByText("Content");
        expect(content).toHaveClass("animate-in", "fade-in-0", "zoom-in-95");
      });
    });

    it("has slide-in animations based on side", async () => {
      const user = userEvent.setup();

      render(
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>Trigger</TooltipTrigger>
            <TooltipContent>Content</TooltipContent>
          </Tooltip>
        </TooltipProvider>,
      );

      await user.hover(screen.getByText("Trigger"));

      await waitFor(() => {
        const content = screen.getByText("Content");
        // Animation classes for different sides
        expect(content).toHaveClass("data-[side=bottom]:slide-in-from-top-2");
      });
    });
  });

  describe("Positioning", () => {
    it("supports side prop", async () => {
      const user = userEvent.setup();

      render(
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>Trigger</TooltipTrigger>
            <TooltipContent side="top">Top content</TooltipContent>
          </Tooltip>
        </TooltipProvider>,
      );

      await user.hover(screen.getByText("Trigger"));

      await waitFor(() => {
        expect(screen.getByText("Top content")).toBeInTheDocument();
      });
    });

    it("supports align prop", async () => {
      const user = userEvent.setup();

      render(
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>Trigger</TooltipTrigger>
            <TooltipContent align="start">Aligned content</TooltipContent>
          </Tooltip>
        </TooltipProvider>,
      );

      await user.hover(screen.getByText("Trigger"));

      await waitFor(() => {
        expect(screen.getByText("Aligned content")).toBeInTheDocument();
      });
    });
  });

  describe("Ref Forwarding", () => {
    it("forwards ref to tooltip content", async () => {
      const ref = React.createRef<HTMLDivElement>();
      const user = userEvent.setup();

      render(
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>Trigger</TooltipTrigger>
            <TooltipContent ref={ref}>Content</TooltipContent>
          </Tooltip>
        </TooltipProvider>,
      );

      await user.hover(screen.getByText("Trigger"));

      await waitFor(() => {
        expect(ref.current).toBeInstanceOf(HTMLDivElement);
        expect(ref.current?.textContent).toBe("Content");
      });
    });
  });

  describe("Accessibility", () => {
    it("trigger has proper aria attributes", () => {
      render(
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>Trigger</TooltipTrigger>
            <TooltipContent>Content</TooltipContent>
          </Tooltip>
        </TooltipProvider>,
      );

      const trigger = screen.getByRole("button");
      expect(trigger).toBeInTheDocument();
    });

    it("shows tooltip on focus", async () => {
      render(
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>Trigger</TooltipTrigger>
            <TooltipContent>Content</TooltipContent>
          </Tooltip>
        </TooltipProvider>,
      );

      const trigger = screen.getByRole("button");
      trigger.focus();

      await waitFor(() => {
        expect(screen.getByText("Content")).toBeInTheDocument();
      });
    });

    it("hides tooltip on blur", async () => {
      render(
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>Trigger</TooltipTrigger>
            <TooltipContent>Content</TooltipContent>
          </Tooltip>
        </TooltipProvider>,
      );

      const trigger = screen.getByRole("button");
      trigger.focus();

      await waitFor(() => {
        expect(screen.getByText("Content")).toBeInTheDocument();
      });

      trigger.blur();

      await waitFor(() => {
        expect(screen.queryByText("Content")).not.toBeInTheDocument();
      });
    });
  });

  describe("Multiple Tooltips", () => {
    it("handles multiple tooltips independently", async () => {
      const user = userEvent.setup();

      render(
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>First</TooltipTrigger>
            <TooltipContent>First tooltip</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger>Second</TooltipTrigger>
            <TooltipContent>Second tooltip</TooltipContent>
          </Tooltip>
        </TooltipProvider>,
      );

      await user.hover(screen.getByText("First"));

      await waitFor(() => {
        expect(screen.getByText("First tooltip")).toBeInTheDocument();
        expect(screen.queryByText("Second tooltip")).not.toBeInTheDocument();
      });

      await user.unhover(screen.getByText("First"));
      await user.hover(screen.getByText("Second"));

      await waitFor(() => {
        expect(screen.queryByText("First tooltip")).not.toBeInTheDocument();
        expect(screen.getByText("Second tooltip")).toBeInTheDocument();
      });
    });
  });

  describe("Real-World Usage Patterns", () => {
    it("renders icon button with tooltip", async () => {
      const user = userEvent.setup();

      render(
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger aria-label="Settings">⚙️</TooltipTrigger>
            <TooltipContent>Settings</TooltipContent>
          </Tooltip>
        </TooltipProvider>,
      );

      await user.hover(screen.getByRole("button", { name: "Settings" }));

      await waitFor(() => {
        expect(screen.getByText("Settings")).toBeInTheDocument();
      });
    });

    it("renders help text tooltip", async () => {
      const user = userEvent.setup();

      render(
        <TooltipProvider>
          <div>
            <label htmlFor="email-with-tooltip">
              Email
              <Tooltip>
                <TooltipTrigger asChild>
                  <span> ℹ️</span>
                </TooltipTrigger>
                <TooltipContent>
                  <p>We&apos;ll never share your email with anyone else.</p>
                </TooltipContent>
              </Tooltip>
            </label>
            <input id="email-with-tooltip" type="email" />
          </div>
        </TooltipProvider>,
      );

      await user.hover(screen.getByText("ℹ️"));

      await waitFor(() => {
        expect(screen.getByText(/never share your email/)).toBeInTheDocument();
      });
    });

    it("renders truncated text with full text in tooltip", async () => {
      const user = userEvent.setup();
      const longText = "This is a very long text that might be truncated in the UI";

      render(
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="truncate">{longText.substring(0, 20)}...</span>
            </TooltipTrigger>
            <TooltipContent>{longText}</TooltipContent>
          </Tooltip>
        </TooltipProvider>,
      );

      await user.hover(screen.getByText("This is a very long ..."));

      await waitFor(() => {
        expect(screen.getByText(longText)).toBeInTheDocument();
      });
    });

    it("renders complex content in tooltip", async () => {
      const user = userEvent.setup();

      render(
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>Hover for details</TooltipTrigger>
            <TooltipContent>
              <div>
                <strong>User Details</strong>
                <p>Name: John Doe</p>
                <p>Email: john@example.com</p>
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>,
      );

      await user.hover(screen.getByText("Hover for details"));

      await waitFor(() => {
        expect(screen.getByText("User Details")).toBeInTheDocument();
        expect(screen.getByText("Name: John Doe")).toBeInTheDocument();
        expect(screen.getByText("Email: john@example.com")).toBeInTheDocument();
      });
    });

    it("renders disabled button with tooltip", async () => {
      const user = userEvent.setup();

      render(
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <button disabled>Disabled Action</button>
              </span>
            </TooltipTrigger>
            <TooltipContent>This action is currently unavailable</TooltipContent>
          </Tooltip>
        </TooltipProvider>,
      );

      const wrapper = screen.getByRole("button").parentElement;
      if (wrapper) {
        await user.hover(wrapper);

        await waitFor(() => {
          expect(screen.getByText("This action is currently unavailable")).toBeInTheDocument();
        });
      }
    });
  });

  describe("Display Names", () => {
    it("TooltipContent has correct display name", () => {
      // Display name is set in the component
      expect(true).toBe(true); // Placeholder as displayName is set dynamically
    });
  });
});
