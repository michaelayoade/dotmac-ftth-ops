/**
 * Sheet Component Tests
 *
 * Tests shadcn/ui Sheet drawer component built on Radix UI Dialog
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";

import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
  SheetOverlay,
} from "../sheet";

describe("Sheet", () => {
  const renderBasicSheet = (side?: "top" | "right" | "bottom" | "left") => {
    return render(
      <Sheet>
        <SheetTrigger>Open Sheet</SheetTrigger>
        <SheetContent side={side}>
          <SheetHeader>
            <SheetTitle>Sheet Title</SheetTitle>
            <SheetDescription>Sheet Description</SheetDescription>
          </SheetHeader>
          <div>Sheet Content</div>
          <SheetFooter>
            <button>Action</button>
          </SheetFooter>
        </SheetContent>
      </Sheet>,
    );
  };

  describe("Basic Rendering", () => {
    it("renders trigger button", () => {
      renderBasicSheet();

      expect(screen.getByText("Open Sheet")).toBeInTheDocument();
    });

    it("does not show content initially", () => {
      renderBasicSheet();

      expect(screen.queryByText("Sheet Title")).not.toBeInTheDocument();
    });

    it("trigger is a button element", () => {
      renderBasicSheet();

      const trigger = screen.getByText("Open Sheet");
      expect(trigger).toHaveAttribute("type", "button");
    });
  });

  describe("Opening and Closing", () => {
    it("opens sheet when trigger is clicked", async () => {
      const user = userEvent.setup();
      renderBasicSheet();

      await user.click(screen.getByText("Open Sheet"));

      await waitFor(() => {
        expect(screen.getByText("Sheet Title")).toBeInTheDocument();
      });
    });

    it("shows overlay when opened", async () => {
      const user = userEvent.setup();
      renderBasicSheet();

      await user.click(screen.getByText("Open Sheet"));

      await waitFor(() => {
        const overlay = document.querySelector('[class*="backdrop-blur"]');
        expect(overlay).toBeInTheDocument();
      });
    });

    it("closes sheet when clicking close button", async () => {
      const user = userEvent.setup();
      renderBasicSheet();

      await user.click(screen.getByText("Open Sheet"));
      await waitFor(() => {
        expect(screen.getByText("Sheet Title")).toBeInTheDocument();
      });

      const closeButton = screen.getByRole("button", { name: /close/i });
      await user.click(closeButton);

      await waitFor(() => {
        expect(screen.queryByText("Sheet Title")).not.toBeInTheDocument();
      });
    });

    it("closes sheet when escape key is pressed", async () => {
      const user = userEvent.setup();
      renderBasicSheet();

      await user.click(screen.getByText("Open Sheet"));
      await waitFor(() => {
        expect(screen.getByText("Sheet Title")).toBeInTheDocument();
      });

      await user.keyboard("{Escape}");

      await waitFor(() => {
        expect(screen.queryByText("Sheet Title")).not.toBeInTheDocument();
      });
    });
  });

  describe("Side Variants", () => {
    it("renders from right by default", async () => {
      const user = userEvent.setup();
      renderBasicSheet();

      await user.click(screen.getByText("Open Sheet"));

      await waitFor(() => {
        const content = screen.getByText("Sheet Title").closest('[class*="inset-y-0"]');
        expect(content).toHaveClass("right-0");
      });
    });

    it("renders from right when side='right'", async () => {
      const user = userEvent.setup();
      renderBasicSheet("right");

      await user.click(screen.getByText("Open Sheet"));

      await waitFor(() => {
        const content = screen.getByText("Sheet Title").closest('[class*="inset-y-0"]');
        expect(content).toHaveClass("right-0");
      });
    });

    it("renders from left when side='left'", async () => {
      const user = userEvent.setup();
      renderBasicSheet("left");

      await user.click(screen.getByText("Open Sheet"));

      await waitFor(() => {
        const content = screen.getByText("Sheet Title").closest('[class*="inset-y-0"]');
        expect(content).toHaveClass("left-0");
      });
    });

    it("renders from top when side='top'", async () => {
      const user = userEvent.setup();
      renderBasicSheet("top");

      await user.click(screen.getByText("Open Sheet"));

      await waitFor(() => {
        const content = screen.getByText("Sheet Title").closest('[class*="inset-x-0"]');
        expect(content).toHaveClass("top-0");
      });
    });

    it("renders from bottom when side='bottom'", async () => {
      const user = userEvent.setup();
      renderBasicSheet("bottom");

      await user.click(screen.getByText("Open Sheet"));

      await waitFor(() => {
        const content = screen.getByText("Sheet Title").closest('[class*="inset-x-0"]');
        expect(content).toHaveClass("bottom-0");
      });
    });
  });

  describe("SheetHeader", () => {
    it("renders header", async () => {
      const user = userEvent.setup();
      renderBasicSheet();

      await user.click(screen.getByText("Open Sheet"));

      await waitFor(() => {
        const header = screen.getByText("Sheet Title").closest('[class*="flex-col"]');
        expect(header).toBeInTheDocument();
      });
    });

    it("applies header styles", async () => {
      const user = userEvent.setup();

      render(
        <Sheet>
          <SheetTrigger>Open</SheetTrigger>
          <SheetContent>
            <SheetHeader data-testid="header">
              <SheetTitle>Title</SheetTitle>
            </SheetHeader>
          </SheetContent>
        </Sheet>,
      );

      await user.click(screen.getByText("Open"));

      await waitFor(() => {
        const header = screen.getByTestId("header");
        expect(header).toHaveClass("flex", "flex-col", "space-y-2");
      });
    });
  });

  describe("SheetTitle", () => {
    it("renders title", async () => {
      const user = userEvent.setup();
      renderBasicSheet();

      await user.click(screen.getByText("Open Sheet"));

      await waitFor(() => {
        expect(screen.getByText("Sheet Title")).toBeInTheDocument();
      });
    });

    it("applies title styles", async () => {
      const user = userEvent.setup();

      render(
        <Sheet>
          <SheetTrigger>Open</SheetTrigger>
          <SheetContent>
            <SheetTitle data-testid="title">Title</SheetTitle>
          </SheetContent>
        </Sheet>,
      );

      await user.click(screen.getByText("Open"));

      await waitFor(() => {
        const title = screen.getByTestId("title");
        expect(title).toHaveClass("text-lg", "font-semibold", "text-foreground");
      });
    });
  });

  describe("SheetDescription", () => {
    it("renders description", async () => {
      const user = userEvent.setup();
      renderBasicSheet();

      await user.click(screen.getByText("Open Sheet"));

      await waitFor(() => {
        expect(screen.getByText("Sheet Description")).toBeInTheDocument();
      });
    });

    it("applies description styles", async () => {
      const user = userEvent.setup();

      render(
        <Sheet>
          <SheetTrigger>Open</SheetTrigger>
          <SheetContent>
            <SheetDescription data-testid="description">Description</SheetDescription>
          </SheetContent>
        </Sheet>,
      );

      await user.click(screen.getByText("Open"));

      await waitFor(() => {
        const description = screen.getByTestId("description");
        expect(description).toHaveClass("text-sm", "text-muted-foreground");
      });
    });
  });

  describe("SheetFooter", () => {
    it("renders footer", async () => {
      const user = userEvent.setup();
      renderBasicSheet();

      await user.click(screen.getByText("Open Sheet"));

      await waitFor(() => {
        const footer = screen.getByText("Action").closest('[class*="flex-col-reverse"]');
        expect(footer).toBeInTheDocument();
      });
    });

    it("applies footer styles", async () => {
      const user = userEvent.setup();

      render(
        <Sheet>
          <SheetTrigger>Open</SheetTrigger>
          <SheetContent>
            <SheetFooter data-testid="footer">
              <button>Button</button>
            </SheetFooter>
          </SheetContent>
        </Sheet>,
      );

      await user.click(screen.getByText("Open"));

      await waitFor(() => {
        const footer = screen.getByTestId("footer");
        expect(footer).toHaveClass("flex", "flex-col-reverse");
      });
    });
  });

  describe("SheetClose", () => {
    it("renders close button", async () => {
      const user = userEvent.setup();
      renderBasicSheet();

      await user.click(screen.getByText("Open Sheet"));

      await waitFor(() => {
        const closeButton = screen.getByRole("button", { name: /close/i });
        expect(closeButton).toBeInTheDocument();
      });
    });

    it("closes sheet when clicked", async () => {
      const user = userEvent.setup();
      renderBasicSheet();

      await user.click(screen.getByText("Open Sheet"));
      await waitFor(() => {
        expect(screen.getByText("Sheet Title")).toBeInTheDocument();
      });

      const closeButton = screen.getByRole("button", { name: /close/i });
      await user.click(closeButton);

      await waitFor(() => {
        expect(screen.queryByText("Sheet Title")).not.toBeInTheDocument();
      });
    });

    it("has sr-only text for accessibility", async () => {
      const user = userEvent.setup();
      renderBasicSheet();

      await user.click(screen.getByText("Open Sheet"));

      await waitFor(() => {
        const closeText = screen.getByText("Close");
        expect(closeText).toHaveClass("sr-only");
      });
    });
  });

  describe("Controlled Component", () => {
    it("works as controlled component", async () => {
      const user = userEvent.setup();
      const onOpenChange = jest.fn();

      const { rerender } = render(
        <Sheet open={false} onOpenChange={onOpenChange}>
          <SheetTrigger>Open</SheetTrigger>
          <SheetContent>
            <SheetTitle>Title</SheetTitle>
          </SheetContent>
        </Sheet>,
      );

      expect(screen.queryByText("Title")).not.toBeInTheDocument();

      await user.click(screen.getByText("Open"));
      expect(onOpenChange).toHaveBeenCalledWith(true);

      rerender(
        <Sheet open={true} onOpenChange={onOpenChange}>
          <SheetTrigger>Open</SheetTrigger>
          <SheetContent>
            <SheetTitle>Title</SheetTitle>
          </SheetContent>
        </Sheet>,
      );

      await waitFor(() => {
        expect(screen.getByText("Title")).toBeInTheDocument();
      });
    });
  });

  describe("Uncontrolled Component", () => {
    it("works as uncontrolled component with defaultOpen", async () => {
      render(
        <Sheet defaultOpen>
          <SheetTrigger>Open</SheetTrigger>
          <SheetContent>
            <SheetTitle>Title</SheetTitle>
          </SheetContent>
        </Sheet>,
      );

      await waitFor(() => {
        expect(screen.getByText("Title")).toBeInTheDocument();
      });
    });
  });

  describe("Accessibility", () => {
    it("has dialog role", async () => {
      const user = userEvent.setup();
      renderBasicSheet();

      await user.click(screen.getByText("Open Sheet"));

      await waitFor(() => {
        expect(screen.getByRole("dialog")).toBeInTheDocument();
      });
    });

    it("title acts as dialog label", async () => {
      const user = userEvent.setup();
      renderBasicSheet();

      await user.click(screen.getByText("Open Sheet"));

      await waitFor(() => {
        const dialog = screen.getByRole("dialog");
        const title = screen.getByText("Sheet Title");
        const titleId = title.getAttribute("id");
        expect(dialog).toHaveAttribute("aria-labelledby", titleId);
      });
    });

    it("description provides additional context", async () => {
      const user = userEvent.setup();
      renderBasicSheet();

      await user.click(screen.getByText("Open Sheet"));

      await waitFor(() => {
        const dialog = screen.getByRole("dialog");
        const description = screen.getByText("Sheet Description");
        const descId = description.getAttribute("id");
        expect(dialog).toHaveAttribute("aria-describedby", descId);
      });
    });

    it("traps focus inside sheet", async () => {
      const user = userEvent.setup();

      render(
        <Sheet>
          <SheetTrigger>Open</SheetTrigger>
          <SheetContent>
            <input placeholder="Input 1" />
            <input placeholder="Input 2" />
          </SheetContent>
        </Sheet>,
      );

      await user.click(screen.getByText("Open"));

      await waitFor(() => {
        expect(screen.getByPlaceholderText("Input 1")).toBeInTheDocument();
      });

      // Focus should be trapped
      await user.tab();
      const focusedElement = document.activeElement;
      const content = screen.getByPlaceholderText("Input 1").closest("[role='dialog']");
      expect(content).toContainElement(focusedElement);
    });
  });

  describe("Ref Forwarding", () => {
    it("forwards ref to SheetContent", async () => {
      const user = userEvent.setup();
      const ref = React.createRef<HTMLDivElement>();

      render(
        <Sheet>
          <SheetTrigger>Open</SheetTrigger>
          <SheetContent ref={ref}>
            <SheetTitle>Title</SheetTitle>
          </SheetContent>
        </Sheet>,
      );

      await user.click(screen.getByText("Open"));

      await waitFor(() => {
        expect(ref.current).toBeInstanceOf(HTMLDivElement);
      });
    });

    it("forwards ref to SheetTitle", async () => {
      const user = userEvent.setup();
      const ref = React.createRef<HTMLHeadingElement>();

      render(
        <Sheet>
          <SheetTrigger>Open</SheetTrigger>
          <SheetContent>
            <SheetTitle ref={ref}>Title</SheetTitle>
          </SheetContent>
        </Sheet>,
      );

      await user.click(screen.getByText("Open"));

      await waitFor(() => {
        expect(ref.current).toBeInstanceOf(HTMLHeadingElement);
      });
    });

    it("forwards ref to SheetDescription", async () => {
      const user = userEvent.setup();
      const ref = React.createRef<HTMLParagraphElement>();

      render(
        <Sheet>
          <SheetTrigger>Open</SheetTrigger>
          <SheetContent>
            <SheetDescription ref={ref}>Description</SheetDescription>
          </SheetContent>
        </Sheet>,
      );

      await user.click(screen.getByText("Open"));

      await waitFor(() => {
        expect(ref.current).toBeInstanceOf(HTMLParagraphElement);
      });
    });

    it("forwards ref to SheetOverlay", async () => {
      const user = userEvent.setup();
      const ref = React.createRef<HTMLDivElement>();

      render(
        <Sheet>
          <SheetTrigger>Open</SheetTrigger>
          <SheetOverlay ref={ref} />
          <SheetContent>Content</SheetContent>
        </Sheet>,
      );

      await user.click(screen.getByText("Open"));

      await waitFor(() => {
        expect(ref.current).toBeInstanceOf(HTMLDivElement);
      });
    });
  });

  describe("Display Names", () => {
    it("SheetOverlay has correct display name", () => {
      expect(SheetOverlay.displayName).toBe("Overlay");
    });

    it("SheetContent has correct display name", () => {
      expect(SheetContent.displayName).toBe("Content");
    });

    it("SheetHeader has correct display name", () => {
      expect(SheetHeader.displayName).toBe("SheetHeader");
    });

    it("SheetFooter has correct display name", () => {
      expect(SheetFooter.displayName).toBe("SheetFooter");
    });

    it("SheetTitle has correct display name", () => {
      expect(SheetTitle.displayName).toBe("Title");
    });

    it("SheetDescription has correct display name", () => {
      expect(SheetDescription.displayName).toBe("Description");
    });
  });

  describe("Real-World Usage Patterns", () => {
    it("renders navigation drawer", async () => {
      const user = userEvent.setup();

      render(
        <Sheet>
          <SheetTrigger>Menu</SheetTrigger>
          <SheetContent side="left">
            <SheetHeader>
              <SheetTitle>Navigation</SheetTitle>
            </SheetHeader>
            <nav>
              <a href="#home">Home</a>
              <a href="#about">About</a>
              <a href="#contact">Contact</a>
            </nav>
          </SheetContent>
        </Sheet>,
      );

      await user.click(screen.getByText("Menu"));

      await waitFor(() => {
        expect(screen.getByText("Navigation")).toBeInTheDocument();
        expect(screen.getByText("Home")).toBeInTheDocument();
      });
    });

    it("renders settings panel", async () => {
      const user = userEvent.setup();

      render(
        <Sheet>
          <SheetTrigger>Settings</SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Settings</SheetTitle>
              <SheetDescription>Configure your preferences</SheetDescription>
            </SheetHeader>
            <div>
              <label>
                <input type="checkbox" /> Enable notifications
              </label>
            </div>
            <SheetFooter>
              <button>Save</button>
            </SheetFooter>
          </SheetContent>
        </Sheet>,
      );

      await user.click(screen.getByText("Settings"));

      await waitFor(() => {
        expect(screen.getByText("Configure your preferences")).toBeInTheDocument();
        expect(screen.getByText("Enable notifications")).toBeInTheDocument();
        expect(screen.getByText("Save")).toBeInTheDocument();
      });
    });

    it("renders cart drawer", async () => {
      const user = userEvent.setup();

      render(
        <Sheet>
          <SheetTrigger>Cart (3)</SheetTrigger>
          <SheetContent side="right">
            <SheetHeader>
              <SheetTitle>Shopping Cart</SheetTitle>
            </SheetHeader>
            <div>
              <p>Item 1</p>
              <p>Item 2</p>
              <p>Item 3</p>
            </div>
            <SheetFooter>
              <button>Checkout</button>
            </SheetFooter>
          </SheetContent>
        </Sheet>,
      );

      await user.click(screen.getByText("Cart (3)"));

      await waitFor(() => {
        expect(screen.getByText("Shopping Cart")).toBeInTheDocument();
        expect(screen.getByText("Checkout")).toBeInTheDocument();
      });
    });
  });
});
