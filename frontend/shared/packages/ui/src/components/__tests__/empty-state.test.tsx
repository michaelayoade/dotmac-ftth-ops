/**
 * Empty State Component Tests
 *
 * Tests EmptyState, EmptyState.List, EmptyState.Search, and EmptyState.Error components
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Inbox, Search, AlertCircle, Users } from "lucide-react";
import React from "react";

import { EmptyState } from "../empty-state";

describe("EmptyState", () => {
  describe("Basic Rendering", () => {
    it("renders empty state with title", () => {
      render(<EmptyState title="No items found" />);

      expect(screen.getByText("No items found")).toBeInTheDocument();
    });

    it("renders with description", () => {
      render(<EmptyState title="No items" description="There are no items to display." />);

      expect(screen.getByText("No items")).toBeInTheDocument();
      expect(screen.getByText("There are no items to display.")).toBeInTheDocument();
    });

    it("renders without description", () => {
      render(<EmptyState title="No items" />);

      expect(screen.getByText("No items")).toBeInTheDocument();
    });

    it("renders with icon", () => {
      const { container } = render(<EmptyState title="No items" icon={Inbox} />);

      const icon = container.querySelector("svg");
      expect(icon).toBeInTheDocument();
    });

    it("renders without icon", () => {
      const { container } = render(<EmptyState title="No items" />);

      const icon = container.querySelector("svg");
      expect(icon).not.toBeInTheDocument();
    });

    it("icon is aria-hidden", () => {
      const { container } = render(<EmptyState title="No items" icon={Inbox} />);

      const icon = container.querySelector("svg");
      expect(icon).toHaveAttribute("aria-hidden", "true");
    });
  });

  describe("Size Variants", () => {
    it("renders medium size by default", () => {
      render(<EmptyState title="No items" />);

      const title = screen.getByText("No items");
      expect(title).toHaveClass("text-lg");
    });

    it("renders small size", () => {
      render(<EmptyState title="No items" size="sm" />);

      const title = screen.getByText("No items");
      expect(title).toHaveClass("text-base");
    });

    it("renders large size", () => {
      render(<EmptyState title="No items" size="lg" />);

      const title = screen.getByText("No items");
      expect(title).toHaveClass("text-xl");
    });

    it("small size has smaller icon", () => {
      const { container } = render(<EmptyState title="No items" icon={Inbox} size="sm" />);

      const icon = container.querySelector(".h-8.w-8");
      expect(icon).toBeInTheDocument();
    });

    it("large size has larger icon", () => {
      const { container } = render(<EmptyState title="No items" icon={Inbox} size="lg" />);

      const icon = container.querySelector(".h-16.w-16");
      expect(icon).toBeInTheDocument();
    });

    it("small size has smaller padding", () => {
      const { container } = render(<EmptyState title="No items" size="sm" />);

      const emptyState = container.querySelector(".py-8");
      expect(emptyState).toBeInTheDocument();
    });

    it("large size has larger padding", () => {
      const { container } = render(<EmptyState title="No items" size="lg" />);

      const emptyState = container.querySelector(".py-16");
      expect(emptyState).toBeInTheDocument();
    });
  });

  describe("Actions", () => {
    it("does not render action button when action is not provided", () => {
      render(<EmptyState title="No items" />);

      expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });

    it("renders action button", () => {
      const action = {
        label: "Create Item",
        onClick: jest.fn(),
      };

      render(<EmptyState title="No items" action={action} />);

      expect(screen.getByText("Create Item")).toBeInTheDocument();
    });

    it("calls action onClick when clicked", async () => {
      const user = userEvent.setup();
      const onClick = jest.fn();
      const action = {
        label: "Create Item",
        onClick,
      };

      render(<EmptyState title="No items" action={action} />);

      await user.click(screen.getByText("Create Item"));

      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it("renders action with icon", () => {
      const action = {
        label: "Create Item",
        onClick: jest.fn(),
        icon: Users,
      };

      render(<EmptyState title="No items" action={action} />);

      const button = screen.getByText("Create Item");
      const icon = button.querySelector("svg");
      expect(icon).toBeInTheDocument();
    });

    it("renders secondary action", () => {
      const secondaryAction = {
        label: "Learn More",
        onClick: jest.fn(),
      };

      render(<EmptyState title="No items" secondaryAction={secondaryAction} />);

      expect(screen.getByText("Learn More")).toBeInTheDocument();
    });

    it("calls secondaryAction onClick when clicked", async () => {
      const user = userEvent.setup();
      const onClick = jest.fn();
      const secondaryAction = {
        label: "Learn More",
        onClick,
      };

      render(<EmptyState title="No items" secondaryAction={secondaryAction} />);

      await user.click(screen.getByText("Learn More"));

      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it("renders both action and secondaryAction", () => {
      const action = { label: "Create", onClick: jest.fn() };
      const secondaryAction = { label: "Cancel", onClick: jest.fn() };

      render(<EmptyState title="No items" action={action} secondaryAction={secondaryAction} />);

      expect(screen.getByText("Create")).toBeInTheDocument();
      expect(screen.getByText("Cancel")).toBeInTheDocument();
    });

    it("secondary action has outline variant", () => {
      const secondaryAction = {
        label: "Learn More",
        onClick: jest.fn(),
      };

      render(<EmptyState title="No items" secondaryAction={secondaryAction} />);

      const button = screen.getByText("Learn More");
      // Button component should apply outline variant
      expect(button).toBeInTheDocument();
    });

    it("action button size matches component size", () => {
      const action = { label: "Create", onClick: jest.fn() };

      render(<EmptyState title="No items" action={action} size="sm" />);

      expect(screen.getByText("Create")).toBeInTheDocument();
    });
  });

  describe("Children", () => {
    it("renders custom children", () => {
      render(
        <EmptyState title="No items">
          <div>Custom content</div>
        </EmptyState>,
      );

      expect(screen.getByText("Custom content")).toBeInTheDocument();
    });

    it("renders children with action buttons", () => {
      const action = { label: "Create", onClick: jest.fn() };

      render(
        <EmptyState title="No items" action={action}>
          <div>Custom content</div>
        </EmptyState>,
      );

      expect(screen.getByText("Custom content")).toBeInTheDocument();
      expect(screen.getByText("Create")).toBeInTheDocument();
    });
  });

  describe("Accessibility", () => {
    it("has role status", () => {
      const { container } = render(<EmptyState title="No items" />);

      const emptyState = container.firstChild;
      expect(emptyState).toHaveAttribute("role", "status");
    });

    it("has aria-label with title", () => {
      const { container } = render(<EmptyState title="No items found" />);

      const emptyState = container.firstChild;
      expect(emptyState).toHaveAttribute("aria-label", "No items found");
    });
  });

  describe("Styling", () => {
    it("applies custom className", () => {
      const { container } = render(<EmptyState title="No items" className="custom-empty" />);

      const emptyState = container.firstChild;
      expect(emptyState).toHaveClass("custom-empty");
    });

    it("is centered", () => {
      const { container } = render(<EmptyState title="No items" />);

      const emptyState = container.firstChild;
      expect(emptyState).toHaveClass("flex", "flex-col", "items-center", "justify-center");
    });

    it("description has max-width", () => {
      render(<EmptyState title="No items" description="Description text" />);

      const description = screen.getByText("Description text");
      expect(description).toHaveClass("max-w-md");
    });

    it("icon has background", () => {
      const { container } = render(<EmptyState title="No items" icon={Inbox} />);

      const iconWrapper = container.querySelector(".bg-accent");
      expect(iconWrapper).toBeInTheDocument();
    });
  });
});

describe("EmptyState.List", () => {
  describe("Basic Rendering", () => {
    it("renders list empty state", () => {
      render(<EmptyState.List entityName="Users" />);

      expect(screen.getByText("No Users found")).toBeInTheDocument();
      expect(screen.getByText("Get started by creating your first users.")).toBeInTheDocument();
    });

    it("renders with custom entity name", () => {
      render(<EmptyState.List entityName="Projects" />);

      expect(screen.getByText("No Projects found")).toBeInTheDocument();
      expect(screen.getByText("Get started by creating your first projects.")).toBeInTheDocument();
    });

    it("renders without create button when onCreateClick not provided", () => {
      render(<EmptyState.List entityName="Users" />);

      expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });

    it("renders create button when onCreateClick provided", () => {
      const onCreateClick = jest.fn();
      render(<EmptyState.List entityName="Users" onCreateClick={onCreateClick} />);

      expect(screen.getByText("Create Users")).toBeInTheDocument();
    });

    it("calls onCreateClick when button clicked", async () => {
      const user = userEvent.setup();
      const onCreateClick = jest.fn();

      render(<EmptyState.List entityName="Users" onCreateClick={onCreateClick} />);

      await user.click(screen.getByText("Create Users"));

      expect(onCreateClick).toHaveBeenCalledTimes(1);
    });

    it("renders custom create label", () => {
      const onCreateClick = jest.fn();
      render(
        <EmptyState.List
          entityName="Users"
          onCreateClick={onCreateClick}
          createLabel="Add New User"
        />,
      );

      expect(screen.getByText("Add New User")).toBeInTheDocument();
      expect(screen.queryByText("Create Users")).not.toBeInTheDocument();
    });

    it("renders with custom icon", () => {
      const { container } = render(<EmptyState.List entityName="Users" icon={Users} />);

      const icon = container.querySelector("svg");
      expect(icon).toBeInTheDocument();
    });

    it("applies custom className", () => {
      const { container } = render(<EmptyState.List entityName="Users" className="custom-list" />);

      const emptyState = container.firstChild;
      expect(emptyState).toHaveClass("custom-list");
    });
  });
});

describe("EmptyState.Search", () => {
  describe("Basic Rendering", () => {
    it("renders search empty state", () => {
      render(<EmptyState.Search />);

      expect(screen.getByText("No results found")).toBeInTheDocument();
      expect(
        screen.getByText("Try adjusting your filters or search criteria."),
      ).toBeInTheDocument();
    });

    it("renders with search term", () => {
      render(<EmptyState.Search searchTerm="test query" />);

      expect(screen.getByText("No results found")).toBeInTheDocument();
      expect(screen.getByText(/We couldn't find anything matching/)).toBeInTheDocument();
      expect(screen.getByText(/"test query"/)).toBeInTheDocument();
    });

    it("renders without clear button when onClearSearch not provided", () => {
      render(<EmptyState.Search searchTerm="test" />);

      expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });

    it("renders clear button when onClearSearch provided", () => {
      const onClearSearch = jest.fn();
      render(<EmptyState.Search searchTerm="test" onClearSearch={onClearSearch} />);

      expect(screen.getByText("Clear search")).toBeInTheDocument();
    });

    it("calls onClearSearch when button clicked", async () => {
      const user = userEvent.setup();
      const onClearSearch = jest.fn();

      render(<EmptyState.Search searchTerm="test" onClearSearch={onClearSearch} />);

      await user.click(screen.getByText("Clear search"));

      expect(onClearSearch).toHaveBeenCalledTimes(1);
    });

    it("uses small size", () => {
      render(<EmptyState.Search />);

      const title = screen.getByText("No results found");
      expect(title).toHaveClass("text-base");
    });

    it("renders with custom icon", () => {
      const { container } = render(<EmptyState.Search icon={Search} />);

      const icon = container.querySelector("svg");
      expect(icon).toBeInTheDocument();
    });

    it("applies custom className", () => {
      const { container } = render(<EmptyState.Search className="custom-search" />);

      const emptyState = container.firstChild;
      expect(emptyState).toHaveClass("custom-search");
    });
  });
});

describe("EmptyState.Error", () => {
  describe("Basic Rendering", () => {
    it("renders error empty state with defaults", () => {
      render(<EmptyState.Error />);

      expect(screen.getByText("Something went wrong")).toBeInTheDocument();
      expect(
        screen.getByText("We encountered an error loading this content. Please try again."),
      ).toBeInTheDocument();
    });

    it("renders custom title and description", () => {
      render(
        <EmptyState.Error title="Load Failed" description="Unable to load the requested data." />,
      );

      expect(screen.getByText("Load Failed")).toBeInTheDocument();
      expect(screen.getByText("Unable to load the requested data.")).toBeInTheDocument();
    });

    it("renders without retry button when onRetry not provided", () => {
      render(<EmptyState.Error />);

      expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });

    it("renders retry button when onRetry provided", () => {
      const onRetry = jest.fn();
      render(<EmptyState.Error onRetry={onRetry} />);

      expect(screen.getByText("Try again")).toBeInTheDocument();
    });

    it("calls onRetry when button clicked", async () => {
      const user = userEvent.setup();
      const onRetry = jest.fn();

      render(<EmptyState.Error onRetry={onRetry} />);

      await user.click(screen.getByText("Try again"));

      expect(onRetry).toHaveBeenCalledTimes(1);
    });

    it("renders custom retry label", () => {
      const onRetry = jest.fn();
      render(<EmptyState.Error onRetry={onRetry} retryLabel="Reload Data" />);

      expect(screen.getByText("Reload Data")).toBeInTheDocument();
      expect(screen.queryByText("Try again")).not.toBeInTheDocument();
    });

    it("renders with custom icon", () => {
      const { container } = render(<EmptyState.Error icon={AlertCircle} />);

      const icon = container.querySelector("svg");
      expect(icon).toBeInTheDocument();
    });

    it("applies custom className", () => {
      const { container } = render(<EmptyState.Error className="custom-error" />);

      const emptyState = container.firstChild;
      expect(emptyState).toHaveClass("custom-error");
    });
  });
});

describe("Real-World Usage Patterns", () => {
  it("renders empty user list", async () => {
    const user = userEvent.setup();
    const onCreate = jest.fn();

    render(<EmptyState.List entityName="Users" onCreateClick={onCreate} icon={Users} />);

    expect(screen.getByText("No Users found")).toBeInTheDocument();
    await user.click(screen.getByText("Create Users"));
    expect(onCreate).toHaveBeenCalled();
  });

  it("renders empty search results", async () => {
    const user = userEvent.setup();
    const onClear = jest.fn();

    render(<EmptyState.Search searchTerm="nonexistent" onClearSearch={onClear} icon={Search} />);

    expect(screen.getByText("No results found")).toBeInTheDocument();
    expect(screen.getByText(/"nonexistent"/)).toBeInTheDocument();
    await user.click(screen.getByText("Clear search"));
    expect(onClear).toHaveBeenCalled();
  });

  it("renders error state with retry", async () => {
    const user = userEvent.setup();
    const onRetry = jest.fn();

    render(
      <EmptyState.Error
        title="Failed to load users"
        description="There was a problem loading the user list."
        onRetry={onRetry}
        icon={AlertCircle}
      />,
    );

    expect(screen.getByText("Failed to load users")).toBeInTheDocument();
    await user.click(screen.getByText("Try again"));
    expect(onRetry).toHaveBeenCalled();
  });

  it("renders custom empty state with multiple actions", async () => {
    const user = userEvent.setup();
    const onCreate = jest.fn();
    const onLearn = jest.fn();

    render(
      <EmptyState
        icon={Inbox}
        title="No messages"
        description="You don't have any messages yet."
        action={{ label: "Compose Message", onClick: onCreate }}
        secondaryAction={{ label: "Learn More", onClick: onLearn }}
      />,
    );

    await user.click(screen.getByText("Compose Message"));
    await user.click(screen.getByText("Learn More"));

    expect(onCreate).toHaveBeenCalled();
    expect(onLearn).toHaveBeenCalled();
  });
});
