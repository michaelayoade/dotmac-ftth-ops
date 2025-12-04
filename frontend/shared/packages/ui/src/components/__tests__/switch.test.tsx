/**
 * Switch Component Tests
 *
 * Tests shadcn/ui Switch toggle component
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";

import { Switch } from "../switch";

describe("Switch", () => {
  describe("Basic Rendering", () => {
    it("renders switch button", () => {
      render(<Switch />);

      const switchButton = screen.getByRole("switch");
      expect(switchButton).toBeInTheDocument();
    });

    it("renders as button element", () => {
      render(<Switch />);

      const switchButton = screen.getByRole("switch");
      expect(switchButton.tagName).toBe("BUTTON");
    });

    it("applies base styles", () => {
      render(<Switch data-testid="switch" />);

      const switchButton = screen.getByTestId("switch");
      expect(switchButton).toHaveClass(
        "relative",
        "inline-flex",
        "h-6",
        "w-11",
        "items-center",
        "rounded-full",
        "transition-colors",
      );
    });

    it("renders with custom className", () => {
      render(<Switch className="custom-switch" />);

      const switchButton = screen.getByRole("switch");
      expect(switchButton).toHaveClass("custom-switch");
    });

    it("renders toggle indicator", () => {
      const { container } = render(<Switch />);

      const indicator = container.querySelector("span");
      expect(indicator).toBeInTheDocument();
      expect(indicator).toHaveClass("rounded-full", "bg-primary-foreground");
    });
  });

  describe("Checked State", () => {
    it("renders unchecked by default", () => {
      render(<Switch />);

      const switchButton = screen.getByRole("switch");
      expect(switchButton).toHaveAttribute("aria-checked", "false");
    });

    it("renders checked when checked prop is true", () => {
      render(<Switch checked={true} />);

      const switchButton = screen.getByRole("switch");
      expect(switchButton).toHaveAttribute("aria-checked", "true");
    });

    it("applies bg-muted when unchecked", () => {
      render(<Switch checked={false} data-testid="switch" />);

      const switchButton = screen.getByTestId("switch");
      expect(switchButton).toHaveClass("bg-muted");
      expect(switchButton).not.toHaveClass("bg-primary");
    });

    it("applies bg-primary when checked", () => {
      render(<Switch checked={true} data-testid="switch" />);

      const switchButton = screen.getByTestId("switch");
      expect(switchButton).toHaveClass("bg-primary");
      expect(switchButton).not.toHaveClass("bg-muted");
    });

    it("positions indicator at start when unchecked", () => {
      const { container } = render(<Switch checked={false} />);

      const indicator = container.querySelector("span");
      expect(indicator).toHaveClass("translate-x-1");
      expect(indicator).not.toHaveClass("translate-x-6");
    });

    it("positions indicator at end when checked", () => {
      const { container } = render(<Switch checked={true} />);

      const indicator = container.querySelector("span");
      expect(indicator).toHaveClass("translate-x-6");
      expect(indicator).not.toHaveClass("translate-x-1");
    });
  });

  describe("User Interaction", () => {
    it("calls onCheckedChange when clicked", async () => {
      const user = userEvent.setup();
      const handleChange = jest.fn();

      render(<Switch checked={false} onCheckedChange={handleChange} />);

      const switchButton = screen.getByRole("switch");
      await user.click(switchButton);

      expect(handleChange).toHaveBeenCalledWith(true);
      expect(handleChange).toHaveBeenCalledTimes(1);
    });

    it("toggles from checked to unchecked", async () => {
      const user = userEvent.setup();
      const handleChange = jest.fn();

      render(<Switch checked={true} onCheckedChange={handleChange} />);

      const switchButton = screen.getByRole("switch");
      await user.click(switchButton);

      expect(handleChange).toHaveBeenCalledWith(false);
    });

    it("does not call onCheckedChange when not provided", async () => {
      const user = userEvent.setup();

      render(<Switch checked={false} />);

      const switchButton = screen.getByRole("switch");
      await user.click(switchButton);

      // Should not throw error
      expect(switchButton).toBeInTheDocument();
    });

    it("can be toggled multiple times", async () => {
      const user = userEvent.setup();
      const TestComponent = () => {
        const [checked, setChecked] = React.useState(false);
        return <Switch checked={checked} onCheckedChange={setChecked} />;
      };

      render(<TestComponent />);

      const switchButton = screen.getByRole("switch");

      expect(switchButton).toHaveAttribute("aria-checked", "false");

      await user.click(switchButton);
      expect(switchButton).toHaveAttribute("aria-checked", "true");

      await user.click(switchButton);
      expect(switchButton).toHaveAttribute("aria-checked", "false");
    });
  });

  describe("Controlled Component", () => {
    it("works as controlled component", async () => {
      const user = userEvent.setup();
      let checked = false;
      const handleChange = jest.fn((newChecked: boolean) => {
        checked = newChecked;
      });

      const { rerender } = render(<Switch checked={checked} onCheckedChange={handleChange} />);

      const switchButton = screen.getByRole("switch");
      expect(switchButton).toHaveAttribute("aria-checked", "false");

      await user.click(switchButton);
      expect(handleChange).toHaveBeenCalledWith(true);

      rerender(<Switch checked={true} onCheckedChange={handleChange} />);
      expect(switchButton).toHaveAttribute("aria-checked", "true");
    });

    it("uses checked prop when provided", () => {
      render(<Switch checked={true} onCheckedChange={() => {}} />);

      const switchButton = screen.getByRole("switch");
      expect(switchButton).toHaveAttribute("aria-checked", "true");
    });
  });

  describe("Disabled State", () => {
    it("can be disabled", () => {
      render(<Switch disabled />);

      const switchButton = screen.getByRole("switch");
      expect(switchButton).toBeDisabled();
    });

    it("does not call onCheckedChange when disabled", async () => {
      const user = userEvent.setup();
      const handleChange = jest.fn();

      render(<Switch disabled checked={false} onCheckedChange={handleChange} />);

      const switchButton = screen.getByRole("switch");
      await user.click(switchButton);

      expect(handleChange).not.toHaveBeenCalled();
    });

    it("maintains visual state when disabled", () => {
      render(<Switch disabled checked={true} data-testid="switch" />);

      const switchButton = screen.getByTestId("switch");
      expect(switchButton).toHaveClass("bg-primary");
      expect(switchButton).toHaveAttribute("aria-checked", "true");
    });
  });

  describe("Accessibility", () => {
    it("has role='switch'", () => {
      render(<Switch />);

      const switchButton = screen.getByRole("switch");
      expect(switchButton).toHaveAttribute("role", "switch");
    });

    it("has aria-checked attribute", () => {
      render(<Switch checked={false} />);

      const switchButton = screen.getByRole("switch");
      expect(switchButton).toHaveAttribute("aria-checked");
    });

    it("updates aria-checked on toggle", async () => {
      const user = userEvent.setup();

      const TestComponent = () => {
        const [checked, setChecked] = React.useState(false);
        return <Switch checked={checked} onCheckedChange={setChecked} />;
      };

      render(<TestComponent />);

      const switchButton = screen.getByRole("switch");
      expect(switchButton).toHaveAttribute("aria-checked", "false");

      await user.click(switchButton);
      expect(switchButton).toHaveAttribute("aria-checked", "true");
    });

    it("supports aria-label", () => {
      render(<Switch aria-label="Enable notifications" />);

      const switchButton = screen.getByRole("switch", { name: "Enable notifications" });
      expect(switchButton).toBeInTheDocument();
    });

    it("supports aria-labelledby", () => {
      render(
        <div>
          <span id="switch-label">Dark mode</span>
          <Switch aria-labelledby="switch-label" />
        </div>,
      );

      const switchButton = screen.getByRole("switch");
      expect(switchButton).toHaveAttribute("aria-labelledby", "switch-label");
    });

    it("is focusable", () => {
      render(<Switch />);

      const switchButton = screen.getByRole("switch");
      switchButton.focus();

      expect(document.activeElement).toBe(switchButton);
    });

    it("can be toggled with keyboard", async () => {
      const user = userEvent.setup();

      const TestComponent = () => {
        const [checked, setChecked] = React.useState(false);
        return <Switch checked={checked} onCheckedChange={setChecked} />;
      };

      render(<TestComponent />);

      const switchButton = screen.getByRole("switch");
      switchButton.focus();

      await user.keyboard(" ");
      expect(switchButton).toHaveAttribute("aria-checked", "true");

      await user.keyboard("{Enter}");
      expect(switchButton).toHaveAttribute("aria-checked", "false");
    });
  });

  describe("Ref Forwarding", () => {
    it("forwards ref to button element", () => {
      const ref = React.createRef<HTMLButtonElement>();

      render(<Switch ref={ref} />);

      expect(ref.current).toBeInstanceOf(HTMLButtonElement);
      expect(ref.current?.getAttribute("role")).toBe("switch");
    });

    it("allows calling focus on ref", () => {
      const ref = React.createRef<HTMLButtonElement>();

      render(<Switch ref={ref} />);

      ref.current?.focus();
      expect(document.activeElement).toBe(ref.current);
    });
  });

  describe("Display Name", () => {
    it("has correct display name", () => {
      expect(Switch.displayName).toBe("Switch");
    });
  });

  describe("HTML Attributes", () => {
    it("supports id attribute", () => {
      render(<Switch id="my-switch" />);

      const switchButton = screen.getByRole("switch");
      expect(switchButton).toHaveAttribute("id", "my-switch");
    });

    it("supports name attribute", () => {
      render(<Switch name="notifications" />);

      const switchButton = screen.getByRole("switch");
      expect(switchButton).toHaveAttribute("name", "notifications");
    });

    it("forwards data attributes", () => {
      render(<Switch data-testid="custom-switch" data-custom="value" />);

      const switchButton = screen.getByTestId("custom-switch");
      expect(switchButton).toHaveAttribute("data-custom", "value");
    });

    it("supports onClick handler", async () => {
      const user = userEvent.setup();
      const handleClick = jest.fn();

      render(<Switch onClick={handleClick} />);

      const switchButton = screen.getByRole("switch");
      await user.click(switchButton);

      expect(handleClick).toHaveBeenCalledTimes(1);
    });
  });

  describe("Real-World Usage Patterns", () => {
    it("renders switch with label", () => {
      render(
        <div className="flex items-center space-x-2">
          <Switch id="airplane-mode" />
          <label htmlFor="airplane-mode">Airplane Mode</label>
        </div>,
      );

      expect(screen.getByText("Airplane Mode")).toBeInTheDocument();
      expect(screen.getByRole("switch")).toBeInTheDocument();
    });

    it("renders controlled switch with state", async () => {
      const user = userEvent.setup();

      const TestComponent = () => {
        const [enabled, setEnabled] = React.useState(false);
        return (
          <div>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
            <span>{enabled ? "On" : "Off"}</span>
          </div>
        );
      };

      render(<TestComponent />);

      expect(screen.getByText("Off")).toBeInTheDocument();

      await user.click(screen.getByRole("switch"));

      expect(screen.getByText("On")).toBeInTheDocument();
    });

    it("renders disabled switch with explanation", () => {
      render(
        <div>
          <Switch disabled checked={false} />
          <span className="text-muted-foreground">Feature not available</span>
        </div>,
      );

      const switchButton = screen.getByRole("switch");
      expect(switchButton).toBeDisabled();
      expect(screen.getByText("Feature not available")).toBeInTheDocument();
    });

    it("renders form with multiple switches", () => {
      render(
        <form>
          <div>
            <Switch id="email" />
            <label htmlFor="email">Email notifications</label>
          </div>
          <div>
            <Switch id="push" />
            <label htmlFor="push">Push notifications</label>
          </div>
          <div>
            <Switch id="sms" />
            <label htmlFor="sms">SMS notifications</label>
          </div>
        </form>,
      );

      const switches = screen.getAllByRole("switch");
      expect(switches).toHaveLength(3);
    });

    it("renders settings panel with switches", () => {
      render(
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3>Dark Mode</h3>
              <p className="text-sm text-muted-foreground">Use dark theme</p>
            </div>
            <Switch />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <h3>Notifications</h3>
              <p className="text-sm text-muted-foreground">Receive notifications</p>
            </div>
            <Switch checked={true} />
          </div>
        </div>,
      );

      const switches = screen.getAllByRole("switch");
      expect(switches).toHaveLength(2);
      expect(screen.getByText("Dark Mode")).toBeInTheDocument();
      expect(screen.getByText("Notifications")).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("handles rapid toggling", async () => {
      const user = userEvent.setup();
      const handleChange = jest.fn();

      render(<Switch checked={false} onCheckedChange={handleChange} />);

      const switchButton = screen.getByRole("switch");

      await user.click(switchButton);
      await user.click(switchButton);
      await user.click(switchButton);
      await user.click(switchButton);

      expect(handleChange).toHaveBeenCalledTimes(4);
    });

    it("handles undefined checked prop", () => {
      render(<Switch checked={undefined} />);

      const switchButton = screen.getByRole("switch");
      expect(switchButton).toHaveAttribute("aria-checked", "false");
    });

    it("maintains styling with custom className", () => {
      render(<Switch checked={true} className="custom-class" data-testid="switch" />);

      const switchButton = screen.getByTestId("switch");
      expect(switchButton).toHaveClass("custom-class", "bg-primary");
    });
  });

  describe("Animation", () => {
    it("has transition classes", () => {
      const { container } = render(<Switch data-testid="switch" />);

      const switchButton = screen.getByTestId("switch");
      expect(switchButton).toHaveClass("transition-colors");

      const indicator = container.querySelector("span");
      expect(indicator).toHaveClass("transition-transform");
    });
  });
});
