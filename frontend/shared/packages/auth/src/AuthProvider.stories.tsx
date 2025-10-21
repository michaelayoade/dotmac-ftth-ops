import type { Meta, StoryObj } from "@storybook/react";
import { AuthProvider } from "./AuthProvider";
import { useAuth } from "./useAuth";
import { AuthVariant, PortalType } from "./types";

const meta: Meta<typeof AuthProvider> = {
  title: "Auth/AuthProvider",
  component: AuthProvider,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Universal authentication provider supporting Simple, Secure, and Enterprise variants across all portal types.",
      },
    },
  },
  argTypes: {
    variant: {
      control: "select",
      options: ["simple", "secure", "enterprise"],
      description: "Authentication implementation variant",
    },
    portal: {
      control: "select",
      options: [
        "admin",
        "customer",
        "reseller",
        "technician",
        "management-admin",
        "management-reseller",
        "tenant-portal",
      ],
      description: "Portal type for configuration",
    },
    config: {
      control: "object",
      description: "Authentication configuration object",
    },
  },
};

export default meta;
type Story = StoryObj<typeof AuthProvider>;

// Mock child component to demonstrate auth context
const AuthDemo = () => {
  const { user, isAuthenticated, login, logout, permissions } = useAuth();

  return (
    <div className="p-6 space-y-4">
      <div className="bg-gray-50 p-4 rounded-lg">
        <h3 className="font-semibold mb-2">Authentication Status</h3>
        <p>Authenticated: {isAuthenticated ? "Yes" : "No"}</p>
        {user && (
          <div className="mt-2">
            <p>User: {user.email}</p>
            <p>Role: {user.role}</p>
            <p>Permissions: {permissions?.join(", ") || "None"}</p>
          </div>
        )}
      </div>

      <div className="space-x-2">
        <button
          onClick={() =>
            login({
              username: "demo",
              email: "demo@dotmac.cloud",
              password: "demo123",
              portal: "admin",
            })
          }
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Login as Demo User
        </button>
        <button
          onClick={logout}
          className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Logout
        </button>
      </div>
    </div>
  );
};

export const AdminPortalSimple: Story = {
  args: {
    variant: "simple" as AuthVariant,
    portal: "admin" as PortalType,
    config: {
      endpoints: {
        login: "/api/auth/login",
        logout: "/api/auth/logout",
        refresh: "/api/auth/refresh",
        profile: "/api/auth/profile",
      },
      sessionTimeout: 3600000,
      enableMFA: false,
      enablePermissions: true,
    },
  },
  render: (args) => (
    <AuthProvider {...args}>
      <AuthDemo />
    </AuthProvider>
  ),
};

export const CustomerPortalSecure: Story = {
  args: {
    variant: "secure" as AuthVariant,
    portal: "customer" as PortalType,
    config: {
      endpoints: {
        login: "/api/auth/login",
        logout: "/api/auth/logout",
        refresh: "/api/auth/refresh",
        profile: "/api/auth/profile",
      },
      sessionTimeout: 1800000,
      enableMFA: true,
      enablePermissions: false,
    },
  },
  render: (args) => (
    <AuthProvider {...args}>
      <AuthDemo />
    </AuthProvider>
  ),
};

export const EnterprisePortal: Story = {
  args: {
    variant: "enterprise" as AuthVariant,
    portal: "management-admin" as PortalType,
    config: {
      endpoints: {
        login: "/api/auth/login",
        logout: "/api/auth/logout",
        refresh: "/api/auth/refresh",
        profile: "/api/auth/profile",
      },
      sessionTimeout: 28800000,
      enableMFA: true,
      enablePermissions: true,
      ssoEnabled: true,
      auditLogging: true,
    },
  },
  render: (args) => (
    <AuthProvider {...args}>
      <AuthDemo />
    </AuthProvider>
  ),
};
