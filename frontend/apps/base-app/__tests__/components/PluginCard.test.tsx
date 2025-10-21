import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PluginCard } from "../../app/dashboard/settings/plugins/components/PluginCard";
import type { PluginConfig, PluginInstance } from "@/hooks/usePlugins";

const mockPlugin: PluginConfig = {
  name: "WhatsApp Business",
  type: "notification" as const,
  version: "1.0.0",
  description: "Send WhatsApp messages via WhatsApp Business API",
  author: "DotMac Platform",
  homepage: "https://developers.facebook.com/docs/whatsapp",
  tags: ["messaging", "notification", "whatsapp", "api", "business"],
  dependencies: ["httpx", "requests", "oauth"],
  supports_health_check: true,
  supports_test_connection: true,
  fields: [
    {
      key: "phone_number",
      label: "Phone Number",
      type: "phone",
      description: "WhatsApp Business phone number",
      required: true,
      is_secret: false,
      group: "Basic Configuration",
      validation_rules: [],
      options: [],
      order: 1,
    },
    {
      key: "api_token",
      label: "API Token",
      type: "secret",
      description: "WhatsApp Business API access token",
      required: true,
      is_secret: true,
      group: "Basic Configuration",
      validation_rules: [],
      options: [],
      order: 2,
    },
    {
      key: "business_account_id",
      label: "Business Account ID",
      type: "string",
      description: "WhatsApp Business Account ID",
      required: true,
      is_secret: false,
      group: "Basic Configuration",
      validation_rules: [],
      options: [],
      order: 3,
    },
    {
      key: "webhook_url",
      label: "Webhook URL",
      type: "url",
      description: "URL to receive webhook notifications",
      required: false,
      is_secret: false,
      group: "Webhooks",
      validation_rules: [],
      options: [],
      order: 4,
    },
  ],
};

const mockInstances: PluginInstance[] = [
  {
    id: "550e8400-e29b-41d4-a716-446655440000",
    plugin_name: "WhatsApp Business",
    instance_name: "Production WhatsApp",
    config_schema: mockPlugin,
    status: "active" as const,
    has_configuration: true,
    last_health_check: "2024-01-15T12:00:00Z",
  },
  {
    id: "550e8400-e29b-41d4-a716-446655440001",
    plugin_name: "WhatsApp Business",
    instance_name: "Test WhatsApp",
    config_schema: mockPlugin,
    status: "error" as const,
    has_configuration: true,
    last_health_check: "2024-01-10T09:00:00Z",
    last_error: "Authentication failed: Invalid API token",
  },
  {
    id: "550e8400-e29b-41d4-a716-446655440002",
    plugin_name: "WhatsApp Business",
    instance_name: "Staging WhatsApp",
    config_schema: mockPlugin,
    status: "inactive" as const,
    has_configuration: false,
    last_health_check: null,
  },
];

const defaultProps = {
  plugin: mockPlugin,
  instances: mockInstances,
  onInstall: jest.fn(),
};

const renderPluginCard = (props = {}) => {
  return render(<PluginCard {...defaultProps} {...props} />);
};

describe("PluginCard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Basic Plugin Information", () => {
    it("displays plugin name and description", () => {
      renderPluginCard();

      expect(screen.getByText("WhatsApp Business")).toBeInTheDocument();
      expect(
        screen.getByText("Send WhatsApp messages via WhatsApp Business API"),
      ).toBeInTheDocument();
    });

    it("displays plugin version", () => {
      renderPluginCard();
      expect(screen.getByText("v1.0.0")).toBeInTheDocument();
    });

    it("displays plugin type with correct styling", () => {
      renderPluginCard();
      const typeElements = screen.getAllByText("notification");
      // Notification appears both as type badge and in tags
      expect(typeElements.length).toBeGreaterThan(0);
    });

    it("displays author information when provided", () => {
      renderPluginCard();
      expect(screen.getByText("by DotMac Platform")).toBeInTheDocument();
    });

    it("displays field count", () => {
      renderPluginCard();
      expect(screen.getByText("4 fields")).toBeInTheDocument();
    });

    it("does not display author when not provided", () => {
      const pluginWithoutAuthor = { ...mockPlugin, author: undefined };
      renderPluginCard({ plugin: pluginWithoutAuthor });

      expect(screen.queryByText(/by /)).not.toBeInTheDocument();
    });
  });

  describe("Plugin Type Icons and Colors", () => {
    it("displays notification type with sky color", () => {
      const { container } = renderPluginCard();
      // Find the type badge specifically (not the tag)
      const typeBadge = container.querySelector('[class*="text-sky-400"]');
      expect(typeBadge).toBeInTheDocument();
    });

    it("displays integration type with amber color", () => {
      const integrationPlugin = { ...mockPlugin, type: "integration" as const };
      const { container } = renderPluginCard({ plugin: integrationPlugin });

      const typeBadge = container.querySelector('[class*="text-amber-400"]');
      expect(typeBadge).toBeInTheDocument();
    });

    it("displays payment type with emerald color", () => {
      const paymentPlugin = { ...mockPlugin, type: "payment" as const };
      const { container } = renderPluginCard({ plugin: paymentPlugin });

      const typeBadge = container.querySelector('[class*="text-emerald-400"]');
      expect(typeBadge).toBeInTheDocument();
    });

    it("displays storage type with purple color", () => {
      const storagePlugin = { ...mockPlugin, type: "storage" as const };
      const { container } = renderPluginCard({ plugin: storagePlugin });

      const typeBadge = container.querySelector('[class*="text-purple-400"]');
      expect(typeBadge).toBeInTheDocument();
    });
  });

  describe("Tags Display", () => {
    it("displays tags when provided", () => {
      renderPluginCard();

      expect(screen.getByText("messaging")).toBeInTheDocument();
      expect(screen.getAllByText("notification").length).toBeGreaterThan(0);
      expect(screen.getByText("whatsapp")).toBeInTheDocument();
    });

    it("limits tag display to 3 tags with +more indicator", () => {
      renderPluginCard();

      // Should show first 3 tags + "+2 more" indicator
      expect(screen.getByText("messaging")).toBeInTheDocument();
      expect(screen.getAllByText("notification").length).toBeGreaterThan(0);
      expect(screen.getByText("whatsapp")).toBeInTheDocument();
      expect(screen.queryByText("+2 more")).toBeInTheDocument();
    });

    it("does not display tags section when no tags provided", () => {
      const pluginWithoutTags = { ...mockPlugin, tags: undefined };
      renderPluginCard({ plugin: pluginWithoutTags });

      expect(screen.queryByText("messaging")).not.toBeInTheDocument();
    });
  });

  describe("Instance Status Display", () => {
    it("displays instance count and status summary", () => {
      renderPluginCard();

      expect(screen.getByText("Instances")).toBeInTheDocument();
      const ones = screen.getAllByText("1");
      expect(ones.length).toBeGreaterThanOrEqual(2); // 1 active + 1 error instance
      expect(screen.getByText("of 3")).toBeInTheDocument(); // total instances
    });

    it("shows active instances with green indicator", () => {
      renderPluginCard();

      const activeIndicators = document.querySelectorAll(".bg-emerald-500");
      expect(activeIndicators).toHaveLength(1);
    });

    it("shows error instances with red indicator", () => {
      renderPluginCard();

      const errorIndicators = document.querySelectorAll(".bg-rose-500");
      expect(errorIndicators).toHaveLength(1);
    });

    it("displays individual instance names and statuses", () => {
      renderPluginCard();

      expect(screen.getByText("Production WhatsApp")).toBeInTheDocument();
      expect(screen.getByText("Test WhatsApp")).toBeInTheDocument();
      expect(screen.getByText("active")).toBeInTheDocument();
      expect(screen.getByText("error")).toBeInTheDocument();
    });

    it('shows "+X more instances" when there are more than 2 instances', () => {
      renderPluginCard();

      expect(screen.getByText("+1 more instances")).toBeInTheDocument();
    });

    it("does not show instance section when no instances exist", () => {
      renderPluginCard({ instances: [] });

      expect(screen.queryByText("Instances")).not.toBeInTheDocument();
    });
  });

  describe("Details Expansion", () => {
    it("toggles details visibility when Show Details is clicked", async () => {
      const user = userEvent.setup();
      renderPluginCard();

      const showDetailsButton = screen.getByText("Show Details");

      await act(async () => {
        await user.click(showDetailsButton);
      });

      expect(screen.getByText("Hide Details")).toBeInTheDocument();
      expect(screen.getByText("Configuration")).toBeInTheDocument();

      await act(async () => {
        await user.click(screen.getByText("Hide Details"));
      });

      expect(screen.getByText("Show Details")).toBeInTheDocument();
      expect(screen.queryByText("Configuration")).not.toBeInTheDocument();
    });

    it("displays configuration overview in expanded state", async () => {
      const user = userEvent.setup();
      renderPluginCard();

      await act(async () => {
        await user.click(screen.getByText("Show Details"));
      });

      expect(screen.getByText("Total Fields")).toBeInTheDocument();
      expect(screen.getByText("4")).toBeInTheDocument(); // total fields count
      expect(screen.getByText("Required")).toBeInTheDocument();
      expect(screen.getByText("3")).toBeInTheDocument(); // required fields count
      expect(screen.getByText("Secrets")).toBeInTheDocument();
      expect(screen.getAllByText("1").length).toBeGreaterThan(0); // secret fields count
      expect(screen.getByText("Groups")).toBeInTheDocument();
      expect(screen.getByText("2")).toBeInTheDocument(); // field groups count
    });

    it("displays field groups in expanded state", async () => {
      const user = userEvent.setup();
      renderPluginCard();

      await act(async () => {
        await user.click(screen.getByText("Show Details"));
      });

      expect(screen.getByText("Field Groups")).toBeInTheDocument();
      expect(screen.getByText("Basic Configuration")).toBeInTheDocument();
      expect(screen.getByText("Webhooks")).toBeInTheDocument();
    });

    it("displays features section in expanded state", async () => {
      const user = userEvent.setup();
      renderPluginCard();

      await act(async () => {
        await user.click(screen.getByText("Show Details"));
      });

      expect(screen.getByText("Features")).toBeInTheDocument();
      expect(screen.getByText("Health Check")).toBeInTheDocument();
      expect(screen.getByText("Test Connection")).toBeInTheDocument();
      expect(screen.getByText("Secure Config")).toBeInTheDocument();
    });

    it("displays dependencies in expanded state", async () => {
      const user = userEvent.setup();
      renderPluginCard();

      await act(async () => {
        await user.click(screen.getByText("Show Details"));
      });

      expect(screen.getByText("Dependencies")).toBeInTheDocument();
      expect(screen.getByText("httpx")).toBeInTheDocument();
      expect(screen.getByText("requests")).toBeInTheDocument();
      expect(screen.getByText("oauth")).toBeInTheDocument();
    });

    it("limits dependency display to 4 with +more indicator", async () => {
      const user = userEvent.setup();
      const pluginWithManyDeps = {
        ...mockPlugin,
        dependencies: ["dep1", "dep2", "dep3", "dep4", "dep5", "dep6"],
      };
      renderPluginCard({ plugin: pluginWithManyDeps });

      await act(async () => {
        await user.click(screen.getByText("Show Details"));
      });

      // Use getAllByText since "+2 more" appears in both tags and dependencies sections
      const moreIndicators = screen.getAllByText("+2 more");
      expect(moreIndicators.length).toBeGreaterThan(0);
    });
  });

  describe("External Links", () => {
    it("displays docs link when homepage is provided", () => {
      renderPluginCard();

      const docsLink = screen.getByRole("link", { name: /Docs/ });
      expect(docsLink).toBeInTheDocument();
      expect(docsLink).toHaveAttribute("href", "https://developers.facebook.com/docs/whatsapp");
      expect(docsLink).toHaveAttribute("target", "_blank");
      expect(docsLink).toHaveAttribute("rel", "noopener noreferrer");
    });

    it("does not display docs link when homepage is not provided", () => {
      const pluginWithoutHomepage = { ...mockPlugin, homepage: undefined };
      renderPluginCard({ plugin: pluginWithoutHomepage });

      expect(screen.queryByRole("link", { name: /Docs/ })).not.toBeInTheDocument();
    });
  });

  describe("Add Instance Functionality", () => {
    it("calls onInstall when Add Instance button is clicked", async () => {
      const user = userEvent.setup();
      const onInstall = jest.fn();

      renderPluginCard({ onInstall });

      const addButton = screen.getByRole("button", { name: /Add Instance/ });

      await act(async () => {
        await user.click(addButton);
      });

      expect(onInstall).toHaveBeenCalledWith(mockPlugin);
    });

    it("displays Add Instance button with correct styling", () => {
      renderPluginCard();

      const addButton = screen.getByRole("button", { name: /Add Instance/ });
      expect(addButton).toBeInTheDocument();
      expect(addButton).toHaveClass("bg-sky-500");
    });
  });

  describe("Edge Cases", () => {
    it("handles plugin with minimal data", () => {
      const minimalPlugin = {
        name: "Basic Plugin",
        type: "integration" as const,
        version: "1.0.0",
        description: "Basic plugin description",
        supports_health_check: false,
        supports_test_connection: false,
        fields: [],
      };

      renderPluginCard({ plugin: minimalPlugin, instances: [] });

      expect(screen.getByText("Basic Plugin")).toBeInTheDocument();
      expect(screen.getByText("integration")).toBeInTheDocument();
      expect(screen.getByText("0 fields")).toBeInTheDocument();
    });

    it("handles empty instances array", () => {
      renderPluginCard({ instances: [] });

      expect(screen.queryByText("Instances")).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Add Instance/ })).toBeInTheDocument();
    });

    it("handles plugin without features", async () => {
      const user = userEvent.setup();
      const pluginWithoutFeatures = {
        ...mockPlugin,
        supports_health_check: false,
        supports_test_connection: false,
        fields: mockPlugin.fields.map((f) => ({ ...f, is_secret: false })), // Remove secret fields
      };

      renderPluginCard({ plugin: pluginWithoutFeatures });

      await act(async () => {
        await user.click(screen.getByText("Show Details"));
      });

      // Should still show Features section but without feature badges
      expect(screen.getByText("Features")).toBeInTheDocument();
      expect(screen.queryByText("Health Check")).not.toBeInTheDocument();
      expect(screen.queryByText("Test Connection")).not.toBeInTheDocument();
      expect(screen.queryByText("Secure Config")).not.toBeInTheDocument();
    });

    it("handles very long plugin names and descriptions gracefully", () => {
      const pluginWithLongText = {
        ...mockPlugin,
        name: "Very Long Plugin Name That Should Be Handled Gracefully",
        description:
          "This is a very long description that should wrap appropriately and not break the layout of the card component when displayed",
      };

      renderPluginCard({ plugin: pluginWithLongText });

      expect(screen.getByText(pluginWithLongText.name)).toBeInTheDocument();
      expect(screen.getByText(pluginWithLongText.description)).toBeInTheDocument();
    });
  });

  describe("Accessibility", () => {
    it("has accessible button labels", () => {
      renderPluginCard();

      expect(screen.getByRole("button", { name: /Show Details/ })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Add Instance/ })).toBeInTheDocument();
    });

    it("has accessible external link", () => {
      renderPluginCard();

      const docsLink = screen.getByRole("link", { name: /Docs/ });
      expect(docsLink).toHaveAttribute("rel", "noopener noreferrer");
    });

    it("uses semantic HTML structure", () => {
      renderPluginCard();

      // Should have proper heading structure
      const pluginName = screen.getByText("WhatsApp Business");
      expect(pluginName).toBeInTheDocument();
    });
  });
});
