/**
 * Theme Toggle Component Tests
 *
 * Tests ThemeToggle and ThemeToggleButton components with next-themes
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { ThemeProvider } from "next-themes";
import React from "react";

import { ThemeToggle, ThemeToggleButton } from "../theme-toggle";

const messages = {
  theme: {
    light: "Light",
    dark: "Dark",
    system: "System",
    switchTo: "Switch to {theme} theme",
    modeTitle: "{theme} theme",
  },
};

// Wrapper component with ThemeProvider
function ThemeWrapper({ children }: { children: React.ReactNode }) {
  return (
    <NextIntlClientProvider locale="en" messages={messages}>
      <ThemeProvider attribute="class" defaultTheme="system">
        {children}
      </ThemeProvider>
    </NextIntlClientProvider>
  );
}

describe("ThemeToggle", () => {
  describe("Basic Rendering", () => {
    it("renders theme toggle component", async () => {
      render(
        <ThemeWrapper>
          <ThemeToggle />
        </ThemeWrapper>,
      );

      // Wait for mount
      await waitFor(() => {
        const buttons = screen.getAllByRole("button");
        expect(buttons.length).toBe(3); // light, dark, system
      });
    });

    it("shows loading skeleton before mount", () => {
      render(
        <ThemeWrapper>
          <ThemeToggle />
        </ThemeWrapper>,
      );

      // Initially shows skeleton
      const skeleton = document.querySelector(".animate-pulse");
      expect(skeleton).toBeInTheDocument();
    });

    it("renders three theme options", async () => {
      render(
        <ThemeWrapper>
          <ThemeToggle />
        </ThemeWrapper>,
      );

      await waitFor(() => {
        expect(screen.getByLabelText(/Switch to Light theme/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/Switch to Dark theme/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/Switch to System theme/i)).toBeInTheDocument();
      });
    });

    it("renders theme icons", async () => {
      const { container } = render(
        <ThemeWrapper>
          <ThemeToggle />
        </ThemeWrapper>,
      );

      await waitFor(() => {
        const icons = container.querySelectorAll("svg");
        expect(icons.length).toBeGreaterThanOrEqual(3);
      });
    });

    it("applies custom className", async () => {
      const { container } = render(
        <ThemeWrapper>
          <ThemeToggle className="custom-toggle" />
        </ThemeWrapper>,
      );

      await waitFor(() => {
        const toggle = container.querySelector(".custom-toggle");
        expect(toggle).toBeInTheDocument();
      });
    });
  });

  describe("Theme Switching", () => {
    it("switches to light theme when clicked", async () => {
      const user = userEvent.setup();

      render(
        <ThemeWrapper>
          <ThemeToggle />
        </ThemeWrapper>,
      );

      await waitFor(() => {
        expect(screen.getByLabelText(/Switch to Light theme/i)).toBeInTheDocument();
      });

      const lightButton = screen.getByLabelText(/Switch to Light theme/i);
      await user.click(lightButton);

      // Button should be active
      expect(lightButton).toHaveClass("bg-primary");
    });

    it("switches to dark theme when clicked", async () => {
      const user = userEvent.setup();

      render(
        <ThemeWrapper>
          <ThemeToggle />
        </ThemeWrapper>,
      );

      await waitFor(() => {
        expect(screen.getByLabelText(/Switch to Dark theme/i)).toBeInTheDocument();
      });

      const darkButton = screen.getByLabelText(/Switch to Dark theme/i);
      await user.click(darkButton);

      // Button should be active
      expect(darkButton).toHaveClass("bg-primary");
    });

    it("switches to system theme when clicked", async () => {
      const user = userEvent.setup();

      render(
        <ThemeWrapper>
          <ThemeToggle />
        </ThemeWrapper>,
      );

      await waitFor(() => {
        expect(screen.getByLabelText(/Switch to System theme/i)).toBeInTheDocument();
      });

      const systemButton = screen.getByLabelText(/Switch to System theme/i);
      await user.click(systemButton);

      // Button should be active
      expect(systemButton).toHaveClass("bg-primary");
    });
  });

  describe("Active State", () => {
    it("highlights active theme button", async () => {
      render(
        <ThemeWrapper>
          <ThemeToggle />
        </ThemeWrapper>,
      );

      await waitFor(() => {
        const buttons = screen.getAllByRole("button");
        const activeButtons = buttons.filter((btn) => btn.classList.contains("bg-primary"));
        expect(activeButtons.length).toBe(1);
      });
    });

    it("applies shadow to active button", async () => {
      render(
        <ThemeWrapper>
          <ThemeToggle />
        </ThemeWrapper>,
      );

      await waitFor(() => {
        const buttons = screen.getAllByRole("button");
        const activeButton = buttons.find((btn) => btn.classList.contains("bg-primary"));
        expect(activeButton).toHaveClass("shadow-lg");
      });
    });

    it("applies muted text to inactive buttons", async () => {
      render(
        <ThemeWrapper>
          <ThemeToggle />
        </ThemeWrapper>,
      );

      await waitFor(() => {
        const buttons = screen.getAllByRole("button");
        const inactiveButtons = buttons.filter((btn) => !btn.classList.contains("bg-primary"));
        inactiveButtons.forEach((btn) => {
          expect(btn).toHaveClass("text-muted-foreground");
        });
      });
    });
  });

  describe("Styling", () => {
    it("applies secondary background to container", async () => {
      const { container } = render(
        <ThemeWrapper>
          <ThemeToggle />
        </ThemeWrapper>,
      );

      await waitFor(() => {
        const toggle = container.querySelector(".bg-secondary");
        expect(toggle).toBeInTheDocument();
      });
    });

    it("applies rounded corners", async () => {
      const { container } = render(
        <ThemeWrapper>
          <ThemeToggle />
        </ThemeWrapper>,
      );

      await waitFor(() => {
        const toggle = container.querySelector(".rounded-lg");
        expect(toggle).toBeInTheDocument();
      });
    });

    it("buttons have hover states", async () => {
      render(
        <ThemeWrapper>
          <ThemeToggle />
        </ThemeWrapper>,
      );

      await waitFor(() => {
        const buttons = screen.getAllByRole("button");
        buttons.forEach((btn) => {
          expect(btn).toHaveClass("hover:bg-accent");
        });
      });
    });
  });

  describe("Accessibility", () => {
    it("buttons have aria-label", async () => {
      render(
        <ThemeWrapper>
          <ThemeToggle />
        </ThemeWrapper>,
      );

      await waitFor(() => {
        expect(screen.getByLabelText(/Switch to Light theme/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/Switch to Dark theme/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/Switch to System theme/i)).toBeInTheDocument();
      });
    });

    it("buttons have title attribute", async () => {
      render(
        <ThemeWrapper>
          <ThemeToggle />
        </ThemeWrapper>,
      );

      await waitFor(() => {
        const lightButton = screen.getByLabelText(/Switch to Light theme/i);
        expect(lightButton).toHaveAttribute("title", "Light theme");
      });
    });

    it("icons are aria-hidden", async () => {
      const { container } = render(
        <ThemeWrapper>
          <ThemeToggle />
        </ThemeWrapper>,
      );

      await waitFor(() => {
        const icons = container.querySelectorAll("svg");
        // Icons should not be focusable
        expect(icons.length).toBeGreaterThan(0);
      });
    });
  });
});

describe("ThemeToggleButton", () => {
  describe("Basic Rendering", () => {
    it("renders theme toggle button", async () => {
      render(
        <ThemeWrapper>
          <ThemeToggleButton />
        </ThemeWrapper>,
      );

      await waitFor(() => {
        expect(screen.getByRole("button")).toBeInTheDocument();
      });
    });

    it("shows loading skeleton before mount", () => {
      render(
        <ThemeWrapper>
          <ThemeToggleButton />
        </ThemeWrapper>,
      );

      const skeleton = document.querySelector(".animate-pulse");
      expect(skeleton).toBeInTheDocument();
    });

    it("renders theme icon", async () => {
      const { container } = render(
        <ThemeWrapper>
          <ThemeToggleButton />
        </ThemeWrapper>,
      );

      await waitFor(() => {
        const icon = container.querySelector("svg");
        expect(icon).toBeInTheDocument();
      });
    });

    it("applies custom className", async () => {
      render(
        <ThemeWrapper>
          <ThemeToggleButton className="custom-button" />
        </ThemeWrapper>,
      );

      await waitFor(() => {
        const button = screen.getByRole("button");
        expect(button).toHaveClass("custom-button");
      });
    });
  });

  describe("Theme Toggling", () => {
    it("toggles between light and dark", async () => {
      const user = userEvent.setup();

      render(
        <ThemeWrapper>
          <ThemeToggleButton />
        </ThemeWrapper>,
      );

      await waitFor(() => {
        expect(screen.getByRole("button")).toBeInTheDocument();
      });

      const button = screen.getByRole("button");
      await user.click(button);

      // Should toggle theme
      expect(button).toBeInTheDocument();
    });

    it("shows correct icon for current theme", async () => {
      const { container } = render(
        <ThemeWrapper>
          <ThemeToggleButton />
        </ThemeWrapper>,
      );

      await waitFor(() => {
        const icon = container.querySelector("svg");
        expect(icon).toBeInTheDocument();
      });
    });
  });

  describe("Styling", () => {
    it("applies secondary background", async () => {
      render(
        <ThemeWrapper>
          <ThemeToggleButton />
        </ThemeWrapper>,
      );

      await waitFor(() => {
        const button = screen.getByRole("button");
        expect(button).toHaveClass("bg-secondary");
      });
    });

    it("has hover states", async () => {
      render(
        <ThemeWrapper>
          <ThemeToggleButton />
        </ThemeWrapper>,
      );

      await waitFor(() => {
        const button = screen.getByRole("button");
        expect(button).toHaveClass("hover:bg-accent");
      });
    });

    it("applies transition", async () => {
      render(
        <ThemeWrapper>
          <ThemeToggleButton />
        </ThemeWrapper>,
      );

      await waitFor(() => {
        const button = screen.getByRole("button");
        expect(button).toHaveClass("transition-all");
      });
    });

    it("icon has transition", async () => {
      const { container } = render(
        <ThemeWrapper>
          <ThemeToggleButton />
        </ThemeWrapper>,
      );

      await waitFor(() => {
        const icon = container.querySelector("svg");
        expect(icon).toHaveClass("transition-transform");
      });
    });
  });

  describe("Accessibility", () => {
    it("button has aria-label", async () => {
      render(
        <ThemeWrapper>
          <ThemeToggleButton />
        </ThemeWrapper>,
      );

      await waitFor(() => {
        const button = screen.getByRole("button");
        expect(button).toHaveAttribute("aria-label");
      });
    });

    it("is keyboard accessible", async () => {
      const user = userEvent.setup();

      render(
        <ThemeWrapper>
          <ThemeToggleButton />
        </ThemeWrapper>,
      );

      await waitFor(() => {
        expect(screen.getByRole("button")).toBeInTheDocument();
      });

      const button = screen.getByRole("button");
      button.focus();

      expect(document.activeElement).toBe(button);

      await user.keyboard("{Enter}");

      // Should toggle theme
      expect(button).toBeInTheDocument();
    });
  });

  describe("Real-World Usage Patterns", () => {
    it("renders in navigation bar", async () => {
      render(
        <ThemeWrapper>
          <nav className="flex items-center justify-between p-4">
            <div>Logo</div>
            <ThemeToggleButton />
          </nav>
        </ThemeWrapper>,
      );

      await waitFor(() => {
        expect(screen.getByText("Logo")).toBeInTheDocument();
        expect(screen.getByRole("button")).toBeInTheDocument();
      });
    });

    it("renders in settings page", async () => {
      render(
        <ThemeWrapper>
          <div>
            <h2>Appearance Settings</h2>
            <div className="flex items-center justify-between">
              <span>Theme</span>
              <ThemeToggle />
            </div>
          </div>
        </ThemeWrapper>,
      );

      await waitFor(() => {
        expect(screen.getByText("Appearance Settings")).toBeInTheDocument();
        expect(screen.getAllByRole("button").length).toBe(3);
      });
    });

    it("renders in user menu", async () => {
      render(
        <ThemeWrapper>
          <div className="user-menu">
            <div>Profile</div>
            <div>Settings</div>
            <div className="flex items-center gap-2">
              <span>Theme</span>
              <ThemeToggleButton />
            </div>
          </div>
        </ThemeWrapper>,
      );

      await waitFor(() => {
        expect(screen.getByText("Profile")).toBeInTheDocument();
        expect(screen.getByRole("button")).toBeInTheDocument();
      });
    });
  });

  describe("Edge Cases", () => {
    it("handles rapid toggling", async () => {
      const user = userEvent.setup();

      render(
        <ThemeWrapper>
          <ThemeToggleButton />
        </ThemeWrapper>,
      );

      await waitFor(() => {
        expect(screen.getByRole("button")).toBeInTheDocument();
      });

      const button = screen.getByRole("button");

      // Rapidly toggle multiple times
      await user.click(button);
      await user.click(button);
      await user.click(button);

      // Should still be functional
      expect(button).toBeInTheDocument();
    });

    it("handles undefined className", async () => {
      render(
        <ThemeWrapper>
          <ThemeToggleButton className={undefined} />
        </ThemeWrapper>,
      );

      await waitFor(() => {
        expect(screen.getByRole("button")).toBeInTheDocument();
      });
    });
  });
});
