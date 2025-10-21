import type { Meta, StoryObj } from "@storybook/react";
import { useAuth } from "./useAuth";
import { AuthProvider } from "./AuthProvider";
import { AuthVariant, PortalType } from "./types";
import { useState } from "react";

const meta: Meta = {
  title: "Auth/useAuth Hook",
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Hook for accessing authentication context. Provides login, logout, and user state management.",
      },
    },
  },
};

export default meta;

// Interactive demo component
const UseAuthDemo = () => {
  const { user, isAuthenticated, isLoading, error, login, logout, checkPermission, permissions } =
    useAuth();

  const [email, setEmail] = useState("admin@dotmac.cloud");
  const [password, setPassword] = useState("admin123");
  const [permissionToCheck, setPermissionToCheck] = useState("users:read");

  const handleLogin = async () => {
    try {
      await login({ username: email.split("@")[0], email, password });
    } catch (err) {
      console.error("Login failed:", err);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <h2 className="text-2xl font-bold">useAuth Hook Demo</h2>

      {/* Authentication Status */}
      <div className="bg-gray-50 p-4 rounded-lg">
        <h3 className="font-semibold mb-2">Current State</h3>
        <div className="space-y-1 text-sm">
          <p>
            <strong>Authenticated:</strong> {isAuthenticated ? "Yes" : "No"}
          </p>
          <p>
            <strong>Loading:</strong> {isLoading ? "Yes" : "No"}
          </p>
          <p>
            <strong>Error:</strong> {error || "None"}
          </p>
          {user && (
            <div className="mt-2">
              <p>
                <strong>User Email:</strong> {user.email}
              </p>
              <p>
                <strong>Role:</strong> {user.role}
              </p>
              <p>
                <strong>Permissions:</strong> {permissions?.join(", ") || "None"}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Login Form */}
      {!isAuthenticated && (
        <div className="bg-white border border-gray-200 p-4 rounded-lg">
          <h3 className="font-semibold mb-3">Login</h3>
          <div className="space-y-3">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              className="w-full px-3 py-2 border border-gray-300 rounded"
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full px-3 py-2 border border-gray-300 rounded"
            />
            <button
              onClick={handleLogin}
              disabled={isLoading}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {isLoading ? "Logging in..." : "Login"}
            </button>
          </div>
        </div>
      )}

      {/* Actions */}
      {isAuthenticated && (
        <div className="space-y-4">
          <button
            onClick={logout}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Logout
          </button>

          {/* Permission Check */}
          <div className="bg-white border border-gray-200 p-4 rounded-lg">
            <h3 className="font-semibold mb-3">Check Permission</h3>
            <div className="flex space-x-2">
              <input
                type="text"
                value={permissionToCheck}
                onChange={(e) => setPermissionToCheck(e.target.value)}
                placeholder="e.g., users:read"
                className="flex-1 px-3 py-2 border border-gray-300 rounded"
              />
              <button
                onClick={() => {
                  const hasPermission = checkPermission(permissionToCheck);
                  alert(
                    `Permission "${permissionToCheck}": ${hasPermission ? "Granted" : "Denied"}`,
                  );
                }}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              >
                Check
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

type Story = StoryObj;

export const InteractiveDemo: Story = {
  render: () => (
    <AuthProvider
      variant={"simple" as AuthVariant}
      portal={"admin" as PortalType}
      config={{
        endpoints: {
          login: "/api/auth/login",
          logout: "/api/auth/logout",
          refresh: "/api/auth/refresh",
          profile: "/api/auth/profile",
        },
        sessionTimeout: 3600000,
        enableMFA: false,
        enablePermissions: true,
      }}
    >
      <UseAuthDemo />
    </AuthProvider>
  ),
  parameters: {
    docs: {
      description: {
        story:
          "Interactive demonstration of the useAuth hook with login/logout functionality and permission checking.",
      },
    },
  },
};
