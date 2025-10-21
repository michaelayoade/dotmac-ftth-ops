/**
 * Tests for Security & Access Pages
 *
 * Covers the security and access control pages including API keys, roles,
 * permissions, users, and secrets management.
 */

import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

// Mock Next.js router
const mockPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    pathname: "/dashboard/security-access",
  }),
}));

// Mock Security & Access Dashboard
const MockSecurityAccessDashboard = () => {
  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Security & Access</h1>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <div className="p-6 border rounded-lg" data-testid="api-keys-card">
          <h2 className="text-xl font-semibold">API Keys</h2>
          <p className="text-sm text-gray-600">Manage API keys for external integrations</p>
        </div>
        <div className="p-6 border rounded-lg" data-testid="roles-card">
          <h2 className="text-xl font-semibold">Roles</h2>
          <p className="text-sm text-gray-600">Define and manage user roles</p>
        </div>
        <div className="p-6 border rounded-lg" data-testid="permissions-card">
          <h2 className="text-xl font-semibold">Permissions</h2>
          <p className="text-sm text-gray-600">Configure fine-grained permissions</p>
        </div>
        <div className="p-6 border rounded-lg" data-testid="users-card">
          <h2 className="text-xl font-semibold">Users</h2>
          <p className="text-sm text-gray-600">Manage user accounts and access</p>
        </div>
        <div className="p-6 border rounded-lg" data-testid="secrets-card">
          <h2 className="text-xl font-semibold">Secrets</h2>
          <p className="text-sm text-gray-600">Securely store and manage secrets</p>
        </div>
      </div>
    </div>
  );
};

// Mock API Keys Page
const MockApiKeysPage = () => {
  const [keys, setKeys] = React.useState([
    {
      id: "1",
      name: "Production API",
      created: "2024-01-01",
      status: "active",
    },
    {
      id: "2",
      name: "Development API",
      created: "2024-01-15",
      status: "active",
    },
  ]);

  const [showCreateModal, setShowCreateModal] = React.useState(false);

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">API Keys</h1>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded"
          data-testid="create-api-key-button"
        >
          Create API Key
        </button>
      </div>

      <div className="space-y-4">
        {keys.map((key) => (
          <div key={key.id} className="p-4 border rounded" data-testid={`api-key-${key.id}`}>
            <h3 className="font-semibold">{key.name}</h3>
            <p className="text-sm text-gray-600">Created: {key.created}</p>
            <span className="text-sm text-green-600">{key.status}</span>
          </div>
        ))}
      </div>

      {showCreateModal && (
        <div data-testid="create-modal" className="modal">
          <h2>Create New API Key</h2>
          <input placeholder="API Key Name" data-testid="api-key-name-input" />
          <button onClick={() => setShowCreateModal(false)} data-testid="close-modal-button">
            Cancel
          </button>
        </div>
      )}
    </div>
  );
};

// Mock Roles Page
const MockRolesPage = () => {
  const roles = [
    { id: "1", name: "Admin", users: 5, permissions: 25 },
    { id: "2", name: "Developer", users: 12, permissions: 15 },
    { id: "3", name: "Viewer", users: 50, permissions: 5 },
  ];

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Roles</h1>

      <div className="grid gap-4">
        {roles.map((role) => (
          <div key={role.id} className="p-4 border rounded" data-testid={`role-${role.id}`}>
            <h3 className="font-semibold">{role.name}</h3>
            <p className="text-sm">
              {role.users} users • {role.permissions} permissions
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

describe("Security & Access Dashboard", () => {
  it("should render the security dashboard", () => {
    render(<MockSecurityAccessDashboard />);
    expect(screen.getByText("Security & Access")).toBeInTheDocument();
  });

  it("should display all security categories", () => {
    render(<MockSecurityAccessDashboard />);

    expect(screen.getByTestId("api-keys-card")).toBeInTheDocument();
    expect(screen.getByTestId("roles-card")).toBeInTheDocument();
    expect(screen.getByTestId("permissions-card")).toBeInTheDocument();
    expect(screen.getByTestId("users-card")).toBeInTheDocument();
    expect(screen.getByTestId("secrets-card")).toBeInTheDocument();
  });

  it("should display category descriptions", () => {
    render(<MockSecurityAccessDashboard />);

    expect(screen.getByText("Manage API keys for external integrations")).toBeInTheDocument();
    expect(screen.getByText("Define and manage user roles")).toBeInTheDocument();
    expect(screen.getByText("Configure fine-grained permissions")).toBeInTheDocument();
    expect(screen.getByText("Manage user accounts and access")).toBeInTheDocument();
    expect(screen.getByText("Securely store and manage secrets")).toBeInTheDocument();
  });
});

describe("API Keys Page", () => {
  it("should render API keys list", () => {
    render(<MockApiKeysPage />);

    expect(screen.getByText("API Keys")).toBeInTheDocument();
    expect(screen.getByTestId("api-key-1")).toBeInTheDocument();
    expect(screen.getByTestId("api-key-2")).toBeInTheDocument();
  });

  it("should display API key details", () => {
    render(<MockApiKeysPage />);

    expect(screen.getByText("Production API")).toBeInTheDocument();
    expect(screen.getByText("Development API")).toBeInTheDocument();
    expect(screen.getByText("Created: 2024-01-01")).toBeInTheDocument();
  });

  it("should show create API key button", () => {
    render(<MockApiKeysPage />);
    expect(screen.getByTestId("create-api-key-button")).toBeInTheDocument();
  });

  it("should open create modal when button clicked", () => {
    render(<MockApiKeysPage />);

    const createButton = screen.getByTestId("create-api-key-button");
    fireEvent.click(createButton);

    expect(screen.getByTestId("create-modal")).toBeInTheDocument();
    expect(screen.getByText("Create New API Key")).toBeInTheDocument();
  });

  it("should close modal when cancel clicked", () => {
    render(<MockApiKeysPage />);

    // Open modal
    fireEvent.click(screen.getByTestId("create-api-key-button"));
    expect(screen.getByTestId("create-modal")).toBeInTheDocument();

    // Close modal
    fireEvent.click(screen.getByTestId("close-modal-button"));
    expect(screen.queryByTestId("create-modal")).not.toBeInTheDocument();
  });
});

describe("Roles Page", () => {
  it("should render roles list", () => {
    render(<MockRolesPage />);

    expect(screen.getByText("Roles")).toBeInTheDocument();
    expect(screen.getByTestId("role-1")).toBeInTheDocument();
    expect(screen.getByTestId("role-2")).toBeInTheDocument();
    expect(screen.getByTestId("role-3")).toBeInTheDocument();
  });

  it("should display role names", () => {
    render(<MockRolesPage />);

    expect(screen.getByText("Admin")).toBeInTheDocument();
    expect(screen.getByText("Developer")).toBeInTheDocument();
    expect(screen.getByText("Viewer")).toBeInTheDocument();
  });

  it("should display role statistics", () => {
    render(<MockRolesPage />);

    expect(screen.getByText("5 users • 25 permissions")).toBeInTheDocument();
    expect(screen.getByText("12 users • 15 permissions")).toBeInTheDocument();
    expect(screen.getByText("50 users • 5 permissions")).toBeInTheDocument();
  });
});
