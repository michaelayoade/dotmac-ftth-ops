/**
 * Popover Component Tests
 *
 * Tests shadcn/ui Popover component built on Radix UI
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";

import { Popover, PopoverTrigger, PopoverContent, PopoverAnchor } from "../popover";

describe("Popover", () => {
  const renderBasicPopover = () => {
    return render(
      <Popover>
        <PopoverTrigger>Open Popover</PopoverTrigger>
        <PopoverContent>Popover content</PopoverContent>
      </Popover>,
    );
  };

  describe("Basic Rendering", () => {
    it("renders trigger button", () => {
      renderBasicPopover();

      expect(screen.getByText("Open Popover")).toBeInTheDocument();
    });

    it("does not show content initially", () => {
      renderBasicPopover();

      expect(screen.queryByText("Popover content")).not.toBeInTheDocument();
    });

    it("trigger is a button element", () => {
      renderBasicPopover();

      const trigger = screen.getByText("Open Popover");
      expect(trigger).toHaveAttribute("type", "button");
    });
  });

  describe("Opening and Closing", () => {
    it("opens popover when trigger is clicked", async () => {
      const user = userEvent.setup();
      renderBasicPopover();

      await user.click(screen.getByText("Open Popover"));

      await waitFor(() => {
        expect(screen.getByText("Popover content")).toBeInTheDocument();
      });
    });

    it("closes popover when clicking outside", async () => {
      const user = userEvent.setup();
      renderBasicPopover();

      await user.click(screen.getByText("Open Popover"));
      await waitFor(() => {
        expect(screen.getByText("Popover content")).toBeInTheDocument();
      });

      await user.click(document.body);

      await waitFor(() => {
        expect(screen.queryByText("Popover content")).not.toBeInTheDocument();
      });
    });

    it("closes popover when escape key is pressed", async () => {
      const user = userEvent.setup();
      renderBasicPopover();

      await user.click(screen.getByText("Open Popover"));
      await waitFor(() => {
        expect(screen.getByText("Popover content")).toBeInTheDocument();
      });

      await user.keyboard("{Escape}");

      await waitFor(() => {
        expect(screen.queryByText("Popover content")).not.toBeInTheDocument();
      });
    });
  });

  describe("PopoverContent", () => {
    it("renders content inside portal", async () => {
      const user = userEvent.setup();
      renderBasicPopover();

      await user.click(screen.getByText("Open Popover"));

      await waitFor(() => {
        const content = screen.getByText("Popover content");
        expect(content).toBeInTheDocument();
      });
    });

    it("applies base styles", async () => {
      const user = userEvent.setup();

      render(
        <Popover>
          <PopoverTrigger>Open</PopoverTrigger>
          <PopoverContent data-testid="content">Content</PopoverContent>
        </Popover>,
      );

      await user.click(screen.getByText("Open"));

      await waitFor(() => {
        const content = screen.getByTestId("content");
        expect(content).toHaveClass(
          "z-50",
          "w-72",
          "rounded-md",
          "border",
          "bg-popover",
          "p-4",
          "text-popover-foreground",
          "shadow-md",
        );
      });
    });

    it("supports custom className", async () => {
      const user = userEvent.setup();

      render(
        <Popover>
          <PopoverTrigger>Open</PopoverTrigger>
          <PopoverContent className="custom-content">Content</PopoverContent>
        </Popover>,
      );

      await user.click(screen.getByText("Open"));

      await waitFor(() => {
        const content = screen.getByText("Content");
        expect(content).toHaveClass("custom-content");
      });
    });

    it("supports custom align prop", async () => {
      const user = userEvent.setup();

      render(
        <Popover>
          <PopoverTrigger>Open</PopoverTrigger>
          <PopoverContent align="start" data-testid="content">
            Content
          </PopoverContent>
        </Popover>,
      );

      await user.click(screen.getByText("Open"));

      await waitFor(() => {
        expect(screen.getByTestId("content")).toBeInTheDocument();
      });
    });

    it("supports custom sideOffset prop", async () => {
      const user = userEvent.setup();

      render(
        <Popover>
          <PopoverTrigger>Open</PopoverTrigger>
          <PopoverContent sideOffset={10} data-testid="content">
            Content
          </PopoverContent>
        </Popover>,
      );

      await user.click(screen.getByText("Open"));

      await waitFor(() => {
        expect(screen.getByTestId("content")).toBeInTheDocument();
      });
    });
  });

  describe("Controlled Component", () => {
    it("works as controlled component", async () => {
      const user = userEvent.setup();
      const onOpenChange = jest.fn();

      const { rerender } = render(
        <Popover open={false} onOpenChange={onOpenChange}>
          <PopoverTrigger>Open</PopoverTrigger>
          <PopoverContent>Content</PopoverContent>
        </Popover>,
      );

      expect(screen.queryByText("Content")).not.toBeInTheDocument();

      await user.click(screen.getByText("Open"));
      expect(onOpenChange).toHaveBeenCalledWith(true);

      rerender(
        <Popover open={true} onOpenChange={onOpenChange}>
          <PopoverTrigger>Open</PopoverTrigger>
          <PopoverContent>Content</PopoverContent>
        </Popover>,
      );

      await waitFor(() => {
        expect(screen.getByText("Content")).toBeInTheDocument();
      });
    });
  });

  describe("Uncontrolled Component", () => {
    it("works as uncontrolled component with defaultOpen", async () => {
      render(
        <Popover defaultOpen>
          <PopoverTrigger>Open</PopoverTrigger>
          <PopoverContent>Content</PopoverContent>
        </Popover>,
      );

      await waitFor(() => {
        expect(screen.getByText("Content")).toBeInTheDocument();
      });
    });
  });

  describe("PopoverAnchor", () => {
    it("renders with anchor element", async () => {
      const user = userEvent.setup();

      render(
        <Popover>
          <PopoverAnchor>
            <div data-testid="anchor">Anchor</div>
          </PopoverAnchor>
          <PopoverTrigger>Open</PopoverTrigger>
          <PopoverContent>Content</PopoverContent>
        </Popover>,
      );

      expect(screen.getByTestId("anchor")).toBeInTheDocument();

      await user.click(screen.getByText("Open"));

      await waitFor(() => {
        expect(screen.getByText("Content")).toBeInTheDocument();
      });
    });
  });

  describe("Accessibility", () => {
    it("trigger has correct aria attributes", async () => {
      const user = userEvent.setup();
      renderBasicPopover();

      const trigger = screen.getByText("Open Popover");
      expect(trigger).toHaveAttribute("aria-expanded", "false");

      await user.click(trigger);

      await waitFor(() => {
        expect(trigger).toHaveAttribute("aria-expanded", "true");
      });
    });

    it("content has focus trap", async () => {
      const user = userEvent.setup();

      render(
        <Popover>
          <PopoverTrigger>Open</PopoverTrigger>
          <PopoverContent>
            <input placeholder="Input 1" />
            <input placeholder="Input 2" />
          </PopoverContent>
        </Popover>,
      );

      await user.click(screen.getByText("Open"));

      await waitFor(() => {
        expect(screen.getByPlaceholderText("Input 1")).toBeInTheDocument();
      });

      await user.tab();
      expect(screen.getByPlaceholderText("Input 1")).toHaveFocus();
    });

    it("is keyboard accessible", async () => {
      const user = userEvent.setup();
      renderBasicPopover();

      const trigger = screen.getByText("Open Popover");
      trigger.focus();

      await user.keyboard("{Enter}");

      await waitFor(() => {
        expect(screen.getByText("Popover content")).toBeInTheDocument();
      });

      await user.keyboard("{Escape}");

      await waitFor(() => {
        expect(screen.queryByText("Popover content")).not.toBeInTheDocument();
      });
    });
  });

  describe("Ref Forwarding", () => {
    it("forwards ref to PopoverContent", async () => {
      const user = userEvent.setup();
      const ref = React.createRef<HTMLDivElement>();

      render(
        <Popover>
          <PopoverTrigger>Open</PopoverTrigger>
          <PopoverContent ref={ref}>Content</PopoverContent>
        </Popover>,
      );

      await user.click(screen.getByText("Open"));

      await waitFor(() => {
        expect(ref.current).toBeInstanceOf(HTMLDivElement);
      });
    });
  });

  describe("Display Name", () => {
    it("PopoverContent has correct display name", () => {
      expect(PopoverContent.displayName).toBe("Content");
    });
  });

  describe("Real-World Usage Patterns", () => {
    it("renders user profile popover", async () => {
      const user = userEvent.setup();

      render(
        <Popover>
          <PopoverTrigger>Profile</PopoverTrigger>
          <PopoverContent>
            <div>
              <h3>John Doe</h3>
              <p>john@example.com</p>
              <button>Logout</button>
            </div>
          </PopoverContent>
        </Popover>,
      );

      await user.click(screen.getByText("Profile"));

      await waitFor(() => {
        expect(screen.getByText("John Doe")).toBeInTheDocument();
        expect(screen.getByText("john@example.com")).toBeInTheDocument();
        expect(screen.getByText("Logout")).toBeInTheDocument();
      });
    });

    it("renders date picker popover", async () => {
      const user = userEvent.setup();

      render(
        <Popover>
          <PopoverTrigger>Select Date</PopoverTrigger>
          <PopoverContent>
            <div>
              <p>Calendar goes here</p>
              <button>Today</button>
              <button>Clear</button>
            </div>
          </PopoverContent>
        </Popover>,
      );

      await user.click(screen.getByText("Select Date"));

      await waitFor(() => {
        expect(screen.getByText("Calendar goes here")).toBeInTheDocument();
        expect(screen.getByText("Today")).toBeInTheDocument();
      });
    });

    it("renders color picker popover", async () => {
      const user = userEvent.setup();

      render(
        <Popover>
          <PopoverTrigger>
            <div style={{ backgroundColor: "#000", width: 20, height: 20 }} />
          </PopoverTrigger>
          <PopoverContent>
            <div>
              <p>Color Picker</p>
              <input type="color" />
            </div>
          </PopoverContent>
        </Popover>,
      );

      const trigger = screen.getByRole("button");
      await user.click(trigger);

      await waitFor(() => {
        expect(screen.getByText("Color Picker")).toBeInTheDocument();
      });
    });

    it("renders help tooltip popover", async () => {
      const user = userEvent.setup();

      render(
        <Popover>
          <PopoverTrigger>?</PopoverTrigger>
          <PopoverContent>
            <div>
              <h4>Help</h4>
              <p>This is a helpful description of the feature.</p>
            </div>
          </PopoverContent>
        </Popover>,
      );

      await user.click(screen.getByText("?"));

      await waitFor(() => {
        expect(screen.getByText("Help")).toBeInTheDocument();
        expect(
          screen.getByText("This is a helpful description of the feature."),
        ).toBeInTheDocument();
      });
    });

    it("renders settings popover", async () => {
      const user = userEvent.setup();

      render(
        <Popover>
          <PopoverTrigger>Settings</PopoverTrigger>
          <PopoverContent>
            <div>
              <label>
                <input type="checkbox" /> Enable notifications
              </label>
              <label>
                <input type="checkbox" /> Dark mode
              </label>
            </div>
          </PopoverContent>
        </Popover>,
      );

      await user.click(screen.getByText("Settings"));

      await waitFor(() => {
        expect(screen.getByText("Enable notifications")).toBeInTheDocument();
        expect(screen.getByText("Dark mode")).toBeInTheDocument();
      });
    });
  });

  describe("Edge Cases", () => {
    it("handles rapid opening and closing", async () => {
      const user = userEvent.setup();
      renderBasicPopover();

      const trigger = screen.getByText("Open Popover");

      await user.click(trigger);
      await user.click(trigger);
      await user.click(trigger);

      // Should handle rapid clicks without errors
      expect(trigger).toBeInTheDocument();
    });

    it("handles content with null children", async () => {
      const user = userEvent.setup();

      render(
        <Popover>
          <PopoverTrigger>Open</PopoverTrigger>
          <PopoverContent>{null}</PopoverContent>
        </Popover>,
      );

      await user.click(screen.getByText("Open"));

      // Should not crash
      expect(screen.getByText("Open")).toBeInTheDocument();
    });
  });

  describe("Animation", () => {
    it("has animation classes", async () => {
      const user = userEvent.setup();

      render(
        <Popover>
          <PopoverTrigger>Open</PopoverTrigger>
          <PopoverContent data-testid="content">Content</PopoverContent>
        </Popover>,
      );

      await user.click(screen.getByText("Open"));

      await waitFor(() => {
        const content = screen.getByTestId("content");
        expect(content).toHaveClass("data-[state=open]:animate-in");
        expect(content).toHaveClass("data-[state=closed]:animate-out");
      });
    });
  });
});
