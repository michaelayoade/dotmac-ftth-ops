/**
 * AlertDialog Component Tests
 *
 * Tests shadcn/ui AlertDialog component built on Radix UI
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";

import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from "../alert-dialog";

describe("AlertDialog", () => {
  const renderBasicAlertDialog = () => {
    return render(
      <AlertDialog>
        <AlertDialogTrigger>Delete</AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction>Continue</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>,
    );
  };

  describe("Basic Rendering", () => {
    it("renders trigger button", () => {
      renderBasicAlertDialog();

      expect(screen.getByText("Delete")).toBeInTheDocument();
    });

    it("does not show dialog initially", () => {
      renderBasicAlertDialog();

      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    });

    it("trigger is a button element", () => {
      renderBasicAlertDialog();

      const trigger = screen.getByText("Delete");
      expect(trigger).toHaveAttribute("type", "button");
    });
  });

  describe("Opening and Closing", () => {
    it("opens dialog when trigger is clicked", async () => {
      const user = userEvent.setup();
      renderBasicAlertDialog();

      await user.click(screen.getByText("Delete"));

      await waitFor(() => {
        expect(screen.getByRole("alertdialog")).toBeInTheDocument();
      });
    });

    it("displays title when opened", async () => {
      const user = userEvent.setup();
      renderBasicAlertDialog();

      await user.click(screen.getByText("Delete"));

      await waitFor(() => {
        expect(screen.getByText("Are you sure?")).toBeInTheDocument();
      });
    });

    it("displays description when opened", async () => {
      const user = userEvent.setup();
      renderBasicAlertDialog();

      await user.click(screen.getByText("Delete"));

      await waitFor(() => {
        expect(screen.getByText("This action cannot be undone.")).toBeInTheDocument();
      });
    });

    it("closes dialog when cancel is clicked", async () => {
      const user = userEvent.setup();
      renderBasicAlertDialog();

      await user.click(screen.getByText("Delete"));
      await waitFor(() => {
        expect(screen.getByRole("alertdialog")).toBeInTheDocument();
      });

      await user.click(screen.getByText("Cancel"));

      await waitFor(() => {
        expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
      });
    });

    it("closes dialog when action is clicked", async () => {
      const user = userEvent.setup();
      renderBasicAlertDialog();

      await user.click(screen.getByText("Delete"));
      await waitFor(() => {
        expect(screen.getByRole("alertdialog")).toBeInTheDocument();
      });

      await user.click(screen.getByText("Continue"));

      await waitFor(() => {
        expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
      });
    });

    it("closes dialog when escape key is pressed", async () => {
      const user = userEvent.setup();
      renderBasicAlertDialog();

      await user.click(screen.getByText("Delete"));
      await waitFor(() => {
        expect(screen.getByRole("alertdialog")).toBeInTheDocument();
      });

      await user.keyboard("{Escape}");

      await waitFor(() => {
        expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
      });
    });
  });

  describe("AlertDialogContent", () => {
    it("renders content inside portal", async () => {
      const user = userEvent.setup();
      renderBasicAlertDialog();

      await user.click(screen.getByText("Delete"));

      await waitFor(() => {
        const dialog = screen.getByRole("alertdialog");
        expect(dialog).toBeInTheDocument();
      });
    });

    it("applies base styles", async () => {
      const user = userEvent.setup();
      renderBasicAlertDialog();

      await user.click(screen.getByText("Delete"));

      await waitFor(() => {
        const dialog = screen.getByRole("alertdialog");
        expect(dialog).toHaveClass(
          "fixed",
          "z-50",
          "gap-4",
          "border",
          "bg-card",
          "p-6",
          "shadow-lg",
        );
      });
    });

    it("supports custom className", async () => {
      const user = userEvent.setup();

      render(
        <AlertDialog>
          <AlertDialogTrigger>Open</AlertDialogTrigger>
          <AlertDialogContent className="custom-dialog">
            <AlertDialogTitle>Title</AlertDialogTitle>
          </AlertDialogContent>
        </AlertDialog>,
      );

      await user.click(screen.getByText("Open"));

      await waitFor(() => {
        const dialog = screen.getByRole("alertdialog");
        expect(dialog).toHaveClass("custom-dialog");
      });
    });

    it("renders with overlay", async () => {
      const user = userEvent.setup();
      const { container } = renderBasicAlertDialog();

      await user.click(screen.getByText("Delete"));

      await waitFor(() => {
        const overlays = container.querySelectorAll('[class*="fixed"][class*="inset-0"]');
        // Should find at least one overlay element
        expect(overlays.length).toBeGreaterThan(0);
      });
    });
  });

  describe("AlertDialogHeader", () => {
    it("renders header section", async () => {
      const user = userEvent.setup();
      renderBasicAlertDialog();

      await user.click(screen.getByText("Delete"));

      await waitFor(() => {
        expect(screen.getByText("Are you sure?")).toBeInTheDocument();
      });
    });

    it("applies header styles", async () => {
      const user = userEvent.setup();
      renderBasicAlertDialog();

      await user.click(screen.getByText("Delete"));

      await waitFor(() => {
        const title = screen.getByText("Are you sure?");
        const header = title.parentElement;
        expect(header).toHaveClass("flex", "flex-col", "space-y-2", "text-center");
      });
    });
  });

  describe("AlertDialogFooter", () => {
    it("renders footer section", async () => {
      const user = userEvent.setup();
      renderBasicAlertDialog();

      await user.click(screen.getByText("Delete"));

      await waitFor(() => {
        expect(screen.getByText("Cancel")).toBeInTheDocument();
        expect(screen.getByText("Continue")).toBeInTheDocument();
      });
    });

    it("applies footer styles", async () => {
      const user = userEvent.setup();
      renderBasicAlertDialog();

      await user.click(screen.getByText("Delete"));

      await waitFor(() => {
        const cancel = screen.getByText("Cancel");
        const footer = cancel.closest('[class*="flex"][class*="flex-col-reverse"]');
        expect(footer).toBeInTheDocument();
      });
    });
  });

  describe("AlertDialogTitle", () => {
    it("renders title text", async () => {
      const user = userEvent.setup();
      renderBasicAlertDialog();

      await user.click(screen.getByText("Delete"));

      await waitFor(() => {
        expect(screen.getByText("Are you sure?")).toBeInTheDocument();
      });
    });

    it("applies title styles", async () => {
      const user = userEvent.setup();
      renderBasicAlertDialog();

      await user.click(screen.getByText("Delete"));

      await waitFor(() => {
        const title = screen.getByText("Are you sure?");
        expect(title).toHaveClass("text-lg", "font-semibold");
      });
    });

    it("supports custom className", async () => {
      const user = userEvent.setup();

      render(
        <AlertDialog>
          <AlertDialogTrigger>Open</AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogTitle className="custom-title">Custom Title</AlertDialogTitle>
          </AlertDialogContent>
        </AlertDialog>,
      );

      await user.click(screen.getByText("Open"));

      await waitFor(() => {
        const title = screen.getByText("Custom Title");
        expect(title).toHaveClass("custom-title");
      });
    });
  });

  describe("AlertDialogDescription", () => {
    it("renders description text", async () => {
      const user = userEvent.setup();
      renderBasicAlertDialog();

      await user.click(screen.getByText("Delete"));

      await waitFor(() => {
        expect(screen.getByText("This action cannot be undone.")).toBeInTheDocument();
      });
    });

    it("applies description styles", async () => {
      const user = userEvent.setup();
      renderBasicAlertDialog();

      await user.click(screen.getByText("Delete"));

      await waitFor(() => {
        const description = screen.getByText("This action cannot be undone.");
        expect(description).toHaveClass("text-sm", "text-muted-foreground");
      });
    });

    it("supports custom className", async () => {
      const user = userEvent.setup();

      render(
        <AlertDialog>
          <AlertDialogTrigger>Open</AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogTitle>Title</AlertDialogTitle>
            <AlertDialogDescription className="custom-desc">Description</AlertDialogDescription>
          </AlertDialogContent>
        </AlertDialog>,
      );

      await user.click(screen.getByText("Open"));

      await waitFor(() => {
        const description = screen.getByText("Description");
        expect(description).toHaveClass("custom-desc");
      });
    });
  });

  describe("AlertDialogAction", () => {
    it("renders action button", async () => {
      const user = userEvent.setup();
      renderBasicAlertDialog();

      await user.click(screen.getByText("Delete"));

      await waitFor(() => {
        expect(screen.getByText("Continue")).toBeInTheDocument();
      });
    });

    it("applies button variant styles", async () => {
      const user = userEvent.setup();
      renderBasicAlertDialog();

      await user.click(screen.getByText("Delete"));

      await waitFor(() => {
        const action = screen.getByText("Continue");
        expect(action).toHaveClass("inline-flex");
      });
    });

    it("calls onClick when clicked", async () => {
      const user = userEvent.setup();
      const handleClick = jest.fn();

      render(
        <AlertDialog>
          <AlertDialogTrigger>Open</AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogTitle>Title</AlertDialogTitle>
            <AlertDialogAction onClick={handleClick}>Confirm</AlertDialogAction>
          </AlertDialogContent>
        </AlertDialog>,
      );

      await user.click(screen.getByText("Open"));
      await waitFor(() => {
        expect(screen.getByText("Confirm")).toBeInTheDocument();
      });

      await user.click(screen.getByText("Confirm"));

      expect(handleClick).toHaveBeenCalled();
    });

    it("supports custom className", async () => {
      const user = userEvent.setup();

      render(
        <AlertDialog>
          <AlertDialogTrigger>Open</AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogTitle>Title</AlertDialogTitle>
            <AlertDialogAction className="custom-action">Action</AlertDialogAction>
          </AlertDialogContent>
        </AlertDialog>,
      );

      await user.click(screen.getByText("Open"));

      await waitFor(() => {
        const action = screen.getByText("Action");
        expect(action).toHaveClass("custom-action");
      });
    });
  });

  describe("AlertDialogCancel", () => {
    it("renders cancel button", async () => {
      const user = userEvent.setup();
      renderBasicAlertDialog();

      await user.click(screen.getByText("Delete"));

      await waitFor(() => {
        expect(screen.getByText("Cancel")).toBeInTheDocument();
      });
    });

    it("applies outline button variant styles", async () => {
      const user = userEvent.setup();
      renderBasicAlertDialog();

      await user.click(screen.getByText("Delete"));

      await waitFor(() => {
        const cancel = screen.getByText("Cancel");
        // Check for outline variant classes
        expect(cancel).toHaveClass("border");
        expect(cancel).toHaveClass("border-input");
      });
    });

    it("calls onClick when clicked", async () => {
      const user = userEvent.setup();
      const handleClick = jest.fn();

      render(
        <AlertDialog>
          <AlertDialogTrigger>Open</AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogTitle>Title</AlertDialogTitle>
            <AlertDialogCancel onClick={handleClick}>Cancel</AlertDialogCancel>
          </AlertDialogContent>
        </AlertDialog>,
      );

      await user.click(screen.getByText("Open"));
      await waitFor(() => {
        expect(screen.getByText("Cancel")).toBeInTheDocument();
      });

      await user.click(screen.getByText("Cancel"));

      expect(handleClick).toHaveBeenCalled();
    });

    it("supports custom className", async () => {
      const user = userEvent.setup();

      render(
        <AlertDialog>
          <AlertDialogTrigger>Open</AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogTitle>Title</AlertDialogTitle>
            <AlertDialogCancel className="custom-cancel">Cancel</AlertDialogCancel>
          </AlertDialogContent>
        </AlertDialog>,
      );

      await user.click(screen.getByText("Open"));

      await waitFor(() => {
        const cancel = screen.getByText("Cancel");
        expect(cancel).toHaveClass("custom-cancel");
      });
    });
  });

  describe("Controlled Component", () => {
    it("works as controlled component", async () => {
      const user = userEvent.setup();
      const onOpenChange = jest.fn();

      const { rerender } = render(
        <AlertDialog open={false} onOpenChange={onOpenChange}>
          <AlertDialogTrigger>Open</AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogTitle>Title</AlertDialogTitle>
          </AlertDialogContent>
        </AlertDialog>,
      );

      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();

      await user.click(screen.getByText("Open"));
      expect(onOpenChange).toHaveBeenCalledWith(true);

      rerender(
        <AlertDialog open={true} onOpenChange={onOpenChange}>
          <AlertDialogTrigger>Open</AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogTitle>Title</AlertDialogTitle>
          </AlertDialogContent>
        </AlertDialog>,
      );

      await waitFor(() => {
        expect(screen.getByRole("alertdialog")).toBeInTheDocument();
      });
    });
  });

  describe("Uncontrolled Component", () => {
    it("works as uncontrolled component with defaultOpen", async () => {
      render(
        <AlertDialog defaultOpen>
          <AlertDialogTrigger>Open</AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogTitle>Title</AlertDialogTitle>
          </AlertDialogContent>
        </AlertDialog>,
      );

      await waitFor(() => {
        expect(screen.getByRole("alertdialog")).toBeInTheDocument();
      });
    });
  });

  describe("Accessibility", () => {
    it("dialog has correct role", async () => {
      const user = userEvent.setup();
      renderBasicAlertDialog();

      await user.click(screen.getByText("Delete"));

      await waitFor(() => {
        expect(screen.getByRole("alertdialog")).toBeInTheDocument();
      });
    });

    it("title is accessible name", async () => {
      const user = userEvent.setup();
      renderBasicAlertDialog();

      await user.click(screen.getByText("Delete"));

      await waitFor(() => {
        const dialog = screen.getByRole("alertdialog");
        const title = screen.getByText("Are you sure?");
        expect(dialog).toHaveAttribute("aria-labelledby", title.id);
      });
    });

    it("description is accessible description", async () => {
      const user = userEvent.setup();
      renderBasicAlertDialog();

      await user.click(screen.getByText("Delete"));

      await waitFor(() => {
        const dialog = screen.getByRole("alertdialog");
        const description = screen.getByText("This action cannot be undone.");
        expect(dialog).toHaveAttribute("aria-describedby", description.id);
      });
    });

    it("traps focus within dialog", async () => {
      const user = userEvent.setup();
      renderBasicAlertDialog();

      await user.click(screen.getByText("Delete"));

      await waitFor(() => {
        expect(screen.getByRole("alertdialog")).toBeInTheDocument();
      });

      // Focus starts on Cancel button, then moves to Continue
      await waitFor(() => {
        expect(screen.getByText("Cancel")).toHaveFocus();
      });

      await user.tab();
      expect(screen.getByText("Continue")).toHaveFocus();
    });

    it("is keyboard accessible", async () => {
      const user = userEvent.setup();
      renderBasicAlertDialog();

      const trigger = screen.getByText("Delete");
      trigger.focus();

      await user.keyboard("{Enter}");

      await waitFor(() => {
        expect(screen.getByRole("alertdialog")).toBeInTheDocument();
      });

      await user.keyboard("{Escape}");

      await waitFor(() => {
        expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
      });
    });

    it("cancel button can be activated with keyboard", async () => {
      const user = userEvent.setup();
      renderBasicAlertDialog();

      await user.click(screen.getByText("Delete"));
      await waitFor(() => {
        expect(screen.getByRole("alertdialog")).toBeInTheDocument();
      });

      const cancelButton = screen.getByText("Cancel");
      cancelButton.focus();
      await user.keyboard("{Enter}");

      await waitFor(() => {
        expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
      });
    });

    it("action button can be activated with keyboard", async () => {
      const user = userEvent.setup();
      renderBasicAlertDialog();

      await user.click(screen.getByText("Delete"));
      await waitFor(() => {
        expect(screen.getByRole("alertdialog")).toBeInTheDocument();
      });

      const actionButton = screen.getByText("Continue");
      actionButton.focus();
      await user.keyboard("{Enter}");

      await waitFor(() => {
        expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
      });
    });
  });

  describe("Real-World Usage Patterns", () => {
    it("renders delete confirmation dialog", async () => {
      const user = userEvent.setup();
      const handleDelete = jest.fn();

      render(
        <AlertDialog>
          <AlertDialogTrigger>Delete Account</AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Account</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete your account. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>,
      );

      await user.click(screen.getByText("Delete Account"));

      await waitFor(() => {
        expect(
          screen.getByText(
            "This will permanently delete your account. This action cannot be undone.",
          ),
        ).toBeInTheDocument();
      });

      await user.click(screen.getByText("Delete"));

      expect(handleDelete).toHaveBeenCalled();
    });

    it("renders logout confirmation dialog", async () => {
      const user = userEvent.setup();
      const handleLogout = jest.fn();

      render(
        <AlertDialog>
          <AlertDialogTrigger>Logout</AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Logout</AlertDialogTitle>
              <AlertDialogDescription>Are you sure you want to logout?</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Stay logged in</AlertDialogCancel>
              <AlertDialogAction onClick={handleLogout}>Logout</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>,
      );

      await user.click(screen.getByRole("button", { name: "Logout" }));

      await waitFor(() => {
        expect(screen.getByText("Are you sure you want to logout?")).toBeInTheDocument();
      });

      // Get all buttons with "Logout" text and click the action button (second one)
      const actionButton = screen
        .getAllByRole("button", { name: "Logout" })
        .find((button) => button.closest('[role="alertdialog"]'));

      if (!actionButton) {
        throw new Error("Logout action button not found");
      }

      await user.click(actionButton);

      expect(handleLogout).toHaveBeenCalled();
    });

    it("renders destructive action dialog", async () => {
      const user = userEvent.setup();
      const handleAction = jest.fn();

      render(
        <AlertDialog>
          <AlertDialogTrigger>Delete All Data</AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete all your data.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleAction} className="bg-destructive">
                Yes, delete everything
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>,
      );

      await user.click(screen.getByText("Delete All Data"));

      await waitFor(() => {
        expect(screen.getByText("Are you absolutely sure?")).toBeInTheDocument();
      });

      await user.click(screen.getByText("Yes, delete everything"));

      expect(handleAction).toHaveBeenCalled();
    });

    it("renders subscription cancellation dialog", async () => {
      const user = userEvent.setup();
      const handleCancel = jest.fn();

      render(
        <AlertDialog>
          <AlertDialogTrigger>Cancel Subscription</AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Cancel Subscription</AlertDialogTitle>
              <AlertDialogDescription>
                Your subscription will remain active until the end of the billing period.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep subscription</AlertDialogCancel>
              <AlertDialogAction onClick={handleCancel}>Cancel subscription</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>,
      );

      await user.click(screen.getByText("Cancel Subscription"));

      await waitFor(() => {
        expect(
          screen.getByText(
            "Your subscription will remain active until the end of the billing period.",
          ),
        ).toBeInTheDocument();
      });
    });

    it("renders confirmation with additional info", async () => {
      const user = userEvent.setup();

      render(
        <AlertDialog>
          <AlertDialogTrigger>Remove User</AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove User</AlertDialogTitle>
              <AlertDialogDescription>
                This will remove the user from your organization. They will no longer have access to
                any resources.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="text-sm">
              <p>User: john@example.com</p>
              <p>Role: Admin</p>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction>Remove</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>,
      );

      await user.click(screen.getByText("Remove User"));

      await waitFor(() => {
        expect(screen.getByText("User: john@example.com")).toBeInTheDocument();
        expect(screen.getByText("Role: Admin")).toBeInTheDocument();
      });
    });
  });

  describe("Ref Forwarding", () => {
    it("forwards ref to AlertDialogContent", async () => {
      const user = userEvent.setup();
      const ref = React.createRef<HTMLDivElement>();

      render(
        <AlertDialog>
          <AlertDialogTrigger>Open</AlertDialogTrigger>
          <AlertDialogContent ref={ref}>
            <AlertDialogTitle>Title</AlertDialogTitle>
          </AlertDialogContent>
        </AlertDialog>,
      );

      await user.click(screen.getByText("Open"));

      await waitFor(() => {
        expect(ref.current).toBeInstanceOf(HTMLDivElement);
      });
    });

    it("forwards ref to AlertDialogAction", async () => {
      const user = userEvent.setup();
      const ref = React.createRef<HTMLButtonElement>();

      render(
        <AlertDialog>
          <AlertDialogTrigger>Open</AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogTitle>Title</AlertDialogTitle>
            <AlertDialogAction ref={ref}>Action</AlertDialogAction>
          </AlertDialogContent>
        </AlertDialog>,
      );

      await user.click(screen.getByText("Open"));

      await waitFor(() => {
        expect(ref.current).toBeInstanceOf(HTMLButtonElement);
      });
    });

    it("forwards ref to AlertDialogCancel", async () => {
      const user = userEvent.setup();
      const ref = React.createRef<HTMLButtonElement>();

      render(
        <AlertDialog>
          <AlertDialogTrigger>Open</AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogTitle>Title</AlertDialogTitle>
            <AlertDialogCancel ref={ref}>Cancel</AlertDialogCancel>
          </AlertDialogContent>
        </AlertDialog>,
      );

      await user.click(screen.getByText("Open"));

      await waitFor(() => {
        expect(ref.current).toBeInstanceOf(HTMLButtonElement);
      });
    });

    it("forwards ref to AlertDialogTitle", async () => {
      const user = userEvent.setup();
      const ref = React.createRef<HTMLHeadingElement>();

      render(
        <AlertDialog>
          <AlertDialogTrigger>Open</AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogTitle ref={ref}>Title</AlertDialogTitle>
          </AlertDialogContent>
        </AlertDialog>,
      );

      await user.click(screen.getByText("Open"));

      await waitFor(() => {
        expect(ref.current).toBeInstanceOf(HTMLHeadingElement);
      });
    });

    it("forwards ref to AlertDialogDescription", async () => {
      const user = userEvent.setup();
      const ref = React.createRef<HTMLParagraphElement>();

      render(
        <AlertDialog>
          <AlertDialogTrigger>Open</AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogTitle>Title</AlertDialogTitle>
            <AlertDialogDescription ref={ref}>Description</AlertDialogDescription>
          </AlertDialogContent>
        </AlertDialog>,
      );

      await user.click(screen.getByText("Open"));

      await waitFor(() => {
        expect(ref.current).toBeInstanceOf(HTMLParagraphElement);
      });
    });
  });

  describe("Display Names", () => {
    it("AlertDialogContent has correct display name", () => {
      expect(AlertDialogContent.displayName).toBe("AlertDialogContent");
    });

    it("AlertDialogHeader has correct display name", () => {
      expect(AlertDialogHeader.displayName).toBe("AlertDialogHeader");
    });

    it("AlertDialogFooter has correct display name", () => {
      expect(AlertDialogFooter.displayName).toBe("AlertDialogFooter");
    });

    it("AlertDialogTitle has correct display name", () => {
      expect(AlertDialogTitle.displayName).toBe("AlertDialogTitle");
    });

    it("AlertDialogDescription has correct display name", () => {
      expect(AlertDialogDescription.displayName).toBe("AlertDialogDescription");
    });

    it("AlertDialogAction has correct display name", () => {
      expect(AlertDialogAction.displayName).toBe("AlertDialogAction");
    });

    it("AlertDialogCancel has correct display name", () => {
      expect(AlertDialogCancel.displayName).toBe("AlertDialogCancel");
    });
  });

  describe("Edge Cases", () => {
    it("handles rapid opening and closing", async () => {
      const user = userEvent.setup();
      renderBasicAlertDialog();

      const trigger = screen.getByText("Delete");

      await user.click(trigger);
      await user.keyboard("{Escape}");
      await user.click(trigger);

      // Should handle rapid interactions without errors
      expect(trigger).toBeInTheDocument();
    });

    it("handles content with null children", async () => {
      const user = userEvent.setup();

      render(
        <AlertDialog>
          <AlertDialogTrigger>Open</AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogTitle>Title</AlertDialogTitle>
            {null}
          </AlertDialogContent>
        </AlertDialog>,
      );

      await user.click(screen.getByText("Open"));

      // Should not crash
      await waitFor(() => {
        expect(screen.getByRole("alertdialog")).toBeInTheDocument();
      });
    });

    it("handles dialog without description", async () => {
      const user = userEvent.setup();

      render(
        <AlertDialog>
          <AlertDialogTrigger>Open</AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogTitle>Title Only</AlertDialogTitle>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>,
      );

      await user.click(screen.getByText("Open"));

      await waitFor(() => {
        expect(screen.getByText("Title Only")).toBeInTheDocument();
      });
    });

    it("handles dialog without footer", async () => {
      const user = userEvent.setup();

      render(
        <AlertDialog>
          <AlertDialogTrigger>Open</AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogTitle>Title</AlertDialogTitle>
            <AlertDialogDescription>Description</AlertDialogDescription>
          </AlertDialogContent>
        </AlertDialog>,
      );

      await user.click(screen.getByText("Open"));

      await waitFor(() => {
        expect(screen.getByRole("alertdialog")).toBeInTheDocument();
      });
    });
  });

  describe("Animation", () => {
    it("has animation classes", async () => {
      const user = userEvent.setup();
      renderBasicAlertDialog();

      await user.click(screen.getByText("Delete"));

      await waitFor(() => {
        const dialog = screen.getByRole("alertdialog");
        expect(dialog).toHaveClass("data-[state=open]:animate-in");
      });
    });

    it("overlay has animation classes", async () => {
      const user = userEvent.setup();
      const { container } = renderBasicAlertDialog();

      await user.click(screen.getByText("Delete"));

      await waitFor(() => {
        // Find overlay by its fixed inset-0 bg-black classes
        const overlay = container.querySelector(
          '[class*="fixed"][class*="inset-0"][class*="bg-black"]',
        );
        expect(overlay).toBeInTheDocument();
        expect(overlay).toHaveClass("data-[state=open]:animate-in");
      });
    });
  });
});
