import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import React from 'react';
import { UniversalProviders, type FeatureFlags } from './UniversalProviders';
import { Card, Button } from '@dotmac/primitives';

const meta: Meta<typeof UniversalProviders> = {
  title: 'Providers/UniversalProviders',
  component: UniversalProviders,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: `
Universal Provider System for standardized provider architecture across all portals.

## Features
- **Portal-specific configurations** with optimized settings for each portal type
- **Feature flag system** for conditional functionality
- **Authentication variants** (simple, secure, enterprise)
- **Tenant management** with multi-tenancy support
- **Query client management** with React Query integration
- **Error boundaries** with portal-specific fallbacks
- **Theme management** with portal-specific styling
- **Notification system** with configurable positioning

## Usage
\`\`\`tsx
import { UniversalProviders } from '@dotmac/providers';

<UniversalProviders
  portal="admin"
  features={{ realtime: true, analytics: true }}
  authVariant="enterprise"
>
  <App />
</UniversalProviders>
\`\`\`
      `,
    },
  },
  tags: ['autodocs', 'providers', 'architecture'],
  argTypes: {
    portal: {
      control: { type: 'select' },
      options: ['admin', 'customer', 'reseller', 'technician', 'management', 'management-admin', 'management-reseller', 'tenant-portal'],
      description: 'Portal type for configuration',
    },
    authVariant: {
      control: { type: 'select' },
      options: ['simple', 'secure', 'enterprise'],
      description: 'Authentication implementation variant',
    },
    tenantVariant: {
      control: { type: 'select' },
      options: ['single', 'multi', 'isp'],
      description: 'Tenant management variant',
    },
    enableDevtools: {
      control: 'boolean',
      description: 'Enable React Query devtools',
    },
    features: {
      control: 'object',
      description: 'Feature flags configuration',
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

// Demo component that uses various providers
const ProviderDemo: React.FC<{ portal: string }> = ({ portal }) => {
  const { user, isAuthenticated, login, logout, permissions } = useMockAuth(portal);
  const [notifications, setNotifications] = React.useState<string[]>([]);

  const addNotification = () => {
    setNotifications(prev => [...prev, `Notification ${Date.now()}`]);
  };

  return (
    <div className="p-6 space-y-6 max-w-2xl mx-auto">
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">
          {portal.charAt(0).toUpperCase() + portal.slice(1)} Portal Demo
        </h3>

        {/* Authentication Status */}
        <div className="space-y-4">
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="font-medium mb-2">Authentication Status</h4>
            <div className="text-sm space-y-1">
              <p>Authenticated: {isAuthenticated ? '✅ Yes' : '❌ No'}</p>
              {user && (
                <>
                  <p>User: {user.email}</p>
                  <p>Role: {user.role}</p>
                </>
              )}
              {permissions && permissions.length > 0 && (
                <p>Permissions: {permissions.join(', ')}</p>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            {!isAuthenticated ? (
              <Button
                onClick={login}
                variant={portal === 'admin' ? 'admin' : 'default'}
              >
                Login as Demo User
              </Button>
            ) : (
              <Button
                onClick={logout}
                variant="outline"
              >
                Logout
              </Button>
            )}

            <Button
              onClick={addNotification}
              variant="outline"
            >
              Test Notification
            </Button>
          </div>

          {/* Portal-specific Information */}
          <div className="bg-blue-50 p-4 rounded-lg">
            <h4 className="font-medium mb-2">Portal Configuration</h4>
            <div className="text-sm space-y-1">
              <p>Portal: {portal}</p>
              <p>Theme: {getPortalTheme(portal)}</p>
              <p>Auth Timeout: {getAuthTimeout(portal)}</p>
              <p>Max Notifications: {getMaxNotifications(portal)}</p>
            </div>
          </div>

          {/* Notifications List */}
          {notifications.length > 0 && (
            <div className="bg-green-50 p-4 rounded-lg">
              <h4 className="font-medium mb-2">Recent Notifications</h4>
              <div className="text-sm space-y-1">
                {notifications.slice(-3).map((notification, index) => (
                  <p key={index}>• {notification}</p>
                ))}
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

// Helper functions for demo
const getPortalTheme = (portal: string) => {
  const themes: Record<string, string> = {
    admin: 'Professional',
    customer: 'Friendly',
    reseller: 'Business',
    technician: 'Mobile',
    management: 'Enterprise'
  };
  return themes[portal] || 'Default';
};

const getAuthTimeout = (portal: string) => {
  const timeouts: Record<string, string> = {
    admin: '1 hour',
    customer: '30 minutes',
    reseller: '45 minutes',
    technician: '8 hours',
    management: '2 hours'
  };
  return timeouts[portal] || '30 minutes';
};

const getMaxNotifications = (portal: string) => {
  const maxNotifications: Record<string, number> = {
    admin: 5,
    customer: 3,
    reseller: 4,
    technician: 2,
    management: 6
  };
  return maxNotifications[portal] || 3;
};

function useMockAuth(portal: string) {
  const [isAuthenticated, setIsAuthenticated] = React.useState(false);

  const user = isAuthenticated
    ? {
        email: `demo@${portal}.dotmac.cloud`,
        role: portal === 'admin' ? 'super_admin' : 'member',
      }
    : null;

  const login = async () => {
    setIsAuthenticated(true);
  };

  const logout = async () => {
    setIsAuthenticated(false);
  };

  const permissions = isAuthenticated ? ['system.manage'] : [];

  return { user, isAuthenticated, login, logout, permissions };
}

// Basic usage
export const Default: Story = {
  args: {
    portal: 'admin',
    features: {
      notifications: true,
      realtime: false,
      analytics: false,
      offline: false,
    },
    authVariant: 'secure',
    tenantVariant: 'multi',
  },
  render: (args) => (
    <UniversalProviders {...args}>
      <ProviderDemo portal={args.portal} />
    </UniversalProviders>
  ),
};

// Portal variants
export const AdminPortal: Story = {
  args: {
    portal: 'admin',
    features: {
      notifications: true,
      realtime: true,
      analytics: true,
      offline: false,
      errorHandling: true,
      devtools: true,
    },
    authVariant: 'enterprise',
    tenantVariant: 'multi',
  },
  render: (args) => (
    <UniversalProviders {...args}>
      <ProviderDemo portal={args.portal} />
    </UniversalProviders>
  ),
  parameters: {
    portal: 'admin',
    docs: {
      description: {
        story: 'Admin portal with enterprise authentication and full feature set.',
      },
    },
  },
};

export const CustomerPortal: Story = {
  args: {
    portal: 'customer',
    features: {
      notifications: true,
      realtime: false,
      analytics: false,
      offline: true,
      pwa: true,
    },
    authVariant: 'simple',
    tenantVariant: 'single',
  },
  render: (args) => (
    <UniversalProviders {...args}>
      <ProviderDemo portal={args.portal} />
    </UniversalProviders>
  ),
  parameters: {
    portal: 'customer',
    docs: {
      description: {
        story: 'Customer portal with simple authentication and offline capabilities.',
      },
    },
  },
};

export const ResellerPortal: Story = {
  args: {
    portal: 'reseller',
    features: {
      notifications: true,
      realtime: true,
      analytics: true,
      offline: false,
      tenantManagement: true,
    },
    authVariant: 'secure',
    tenantVariant: 'multi',
  },
  render: (args) => (
    <UniversalProviders {...args}>
      <ProviderDemo portal={args.portal} />
    </UniversalProviders>
  ),
  parameters: {
    portal: 'reseller',
    docs: {
      description: {
        story: 'Reseller portal with secure authentication and tenant management.',
      },
    },
  },
};

export const TechnicianPortal: Story = {
  args: {
    portal: 'technician',
    features: {
      notifications: true,
      realtime: true,
      analytics: false,
      offline: true,
      pwa: true,
    },
    authVariant: 'simple',
    tenantVariant: 'single',
  },
  render: (args) => (
    <UniversalProviders {...args}>
      <ProviderDemo portal={args.portal} />
    </UniversalProviders>
  ),
  parameters: {
    portal: 'technician',
    docs: {
      description: {
        story: 'Technician portal optimized for mobile field work with offline support.',
      },
    },
  },
};

export const ManagementPortal: Story = {
  args: {
    portal: 'management',
    features: {
      notifications: true,
      realtime: true,
      analytics: true,
      offline: false,
      tenantManagement: true,
      errorHandling: true,
    },
    authVariant: 'enterprise',
    tenantVariant: 'isp',
  },
  render: (args) => (
    <UniversalProviders {...args}>
      <ProviderDemo portal={args.portal} />
    </UniversalProviders>
  ),
  parameters: {
    portal: 'management',
    docs: {
      description: {
        story: 'Management portal with enterprise-grade security and ISP tenant management.',
      },
    },
  },
};

// Authentication variants
export const SimpleAuth: Story = {
  args: {
    portal: 'customer',
    authVariant: 'simple',
    features: { notifications: true },
  },
  render: (args) => (
    <UniversalProviders {...args}>
      <div className="p-6 text-center">
        <Card className="p-6 max-w-md mx-auto">
          <h3 className="text-lg font-semibold mb-4">Simple Authentication</h3>
          <div className="space-y-2 text-sm text-left">
            <p>• Basic login/logout functionality</p>
            <p>• No MFA required</p>
            <p>• Minimal security features</p>
            <p>• Suitable for customer portals</p>
          </div>
        </Card>
      </div>
    </UniversalProviders>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Simple authentication variant for basic login functionality.',
      },
    },
  },
};

export const SecureAuth: Story = {
  args: {
    portal: 'reseller',
    authVariant: 'secure',
    features: { notifications: true },
  },
  render: (args) => (
    <UniversalProviders {...args}>
      <div className="p-6 text-center">
        <Card className="p-6 max-w-md mx-auto">
          <h3 className="text-lg font-semibold mb-4">Secure Authentication</h3>
          <div className="space-y-2 text-sm text-left">
            <p>• Enhanced security features</p>
            <p>• Optional MFA support</p>
            <p>• Session management</p>
            <p>• Suitable for business users</p>
          </div>
        </Card>
      </div>
    </UniversalProviders>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Secure authentication variant with enhanced security features.',
      },
    },
  },
};

export const EnterpriseAuth: Story = {
  args: {
    portal: 'admin',
    authVariant: 'enterprise',
    features: { notifications: true, errorHandling: true },
  },
  render: (args) => (
    <UniversalProviders {...args}>
      <div className="p-6 text-center">
        <Card className="p-6 max-w-md mx-auto">
          <h3 className="text-lg font-semibold mb-4">Enterprise Authentication</h3>
          <div className="space-y-2 text-sm text-left">
            <p>• Maximum security features</p>
            <p>• MFA enforced</p>
            <p>• Audit logging</p>
            <p>• Advanced session controls</p>
            <p>• Suitable for admin portals</p>
          </div>
        </Card>
      </div>
    </UniversalProviders>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Enterprise authentication variant with maximum security features.',
      },
    },
  },
};

// Feature flags demonstration
export const FeatureFlags: Story = {
  render: () => {
    const [features, setFeatures] = React.useState<FeatureFlags>({
      notifications: true,
      realtime: false,
      analytics: false,
      offline: false,
      websocket: false,
      tenantManagement: false,
      errorHandling: true,
    });

    const toggleFeature = (feature: keyof FeatureFlags) => {
      setFeatures(prev => ({
        ...prev,
        [feature]: !prev[feature]
      }));
    };

    const FeatureToggle: React.FC<{
      feature: keyof FeatureFlags;
      label: string;
      description: string
    }> = ({ feature, label, description }) => (
      <Card className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h4 className="font-medium">{label}</h4>
            <p className="text-sm text-gray-600 mt-1">{description}</p>
          </div>
          <button
            onClick={() => toggleFeature(feature)}
            className={`ml-4 px-3 py-1 rounded text-sm font-medium ${
              features[feature]
                ? 'bg-green-100 text-green-700'
                : 'bg-gray-100 text-gray-700'
            }`}
          >
            {features[feature] ? 'Enabled' : 'Disabled'}
          </button>
        </div>
      </Card>
    );

    return (
      <UniversalProviders
        portal="admin"
        features={features}
        authVariant="secure"
      >
        <div className="p-6 space-y-6">
          <div className="text-center">
            <h3 className="text-xl font-bold mb-2">Feature Flags System</h3>
            <p className="text-gray-600 mb-6">
              Toggle features to see how they affect the provider configuration
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FeatureToggle
              feature="notifications"
              label="Notifications"
              description="Enable toast notifications and alerts"
            />
            <FeatureToggle
              feature="realtime"
              label="Real-time Updates"
              description="Enable WebSocket connections for live data"
            />
            <FeatureToggle
              feature="analytics"
              label="Analytics"
              description="Enable usage tracking and metrics"
            />
            <FeatureToggle
              feature="offline"
              label="Offline Support"
              description="Enable offline functionality and sync"
            />
            <FeatureToggle
              feature="websocket"
              label="WebSocket"
              description="Enable WebSocket communication"
            />
            <FeatureToggle
              feature="tenantManagement"
              label="Tenant Management"
              description="Enable multi-tenant features"
            />
          </div>

          <Card className="p-6">
            <h4 className="font-medium mb-4">Current Configuration</h4>
            <pre className="bg-gray-50 p-4 rounded text-sm overflow-auto">
              {JSON.stringify(features, null, 2)}
            </pre>
          </Card>
        </div>
      </UniversalProviders>
    );
  },
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        story: 'Interactive feature flags system showing how different features can be enabled/disabled.',
      },
    },
  },
};

// Portal comparison
export const PortalComparison: Story = {
  render: () => {
    const portals = ['admin', 'customer', 'reseller', 'technician', 'management'];

    const PortalCard: React.FC<{ portal: string }> = ({ portal }) => (
      <Card className="p-4">
        <h4 className="font-semibold mb-3 capitalize">{portal} Portal</h4>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span>Theme:</span>
            <span className="font-medium">{getPortalTheme(portal)}</span>
          </div>
          <div className="flex justify-between">
            <span>Auth Timeout:</span>
            <span className="font-medium">{getAuthTimeout(portal)}</span>
          </div>
          <div className="flex justify-between">
            <span>Max Notifications:</span>
            <span className="font-medium">{getMaxNotifications(portal)}</span>
          </div>
          <div className="flex justify-between">
            <span>Security Level:</span>
            <span className="font-medium">
              {portal === 'customer' ? 'Basic' :
               portal === 'technician' ? 'Medium' : 'High'}
            </span>
          </div>
        </div>
      </Card>
    );

    return (
      <div className="p-6 space-y-6">
        <div className="text-center">
          <h3 className="text-xl font-bold mb-2">Portal Configuration Comparison</h3>
          <p className="text-gray-600">
            Each portal has optimized settings for its specific use case
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {portals.map(portal => (
            <PortalCard key={portal} portal={portal} />
          ))}
        </div>

        <Card className="p-6">
          <h4 className="font-medium mb-4">Key Differences</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h5 className="font-medium mb-2">Authentication</h5>
              <ul className="text-sm space-y-1 text-gray-600">
                <li>• <strong>Customer:</strong> Simple, no MFA</li>
                <li>• <strong>Technician:</strong> Long sessions for field work</li>
                <li>• <strong>Admin:</strong> Enterprise security with MFA</li>
                <li>• <strong>Management:</strong> Highest security standards</li>
              </ul>
            </div>
            <div>
              <h5 className="font-medium mb-2">Notifications</h5>
              <ul className="text-sm space-y-1 text-gray-600">
                <li>• <strong>Technician:</strong> Fewer, longer duration</li>
                <li>• <strong>Customer:</strong> Bottom-right positioning</li>
                <li>• <strong>Admin:</strong> More notifications allowed</li>
                <li>• <strong>Management:</strong> Top-center for visibility</li>
              </ul>
            </div>
          </div>
        </Card>
      </div>
    );
  },
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        story: 'Comparison of all portal configurations showing their optimized settings.',
      },
    },
  },
};

// Configuration showcase
export const ConfigurationShowcase: Story = {
  args: {
    portal: 'admin',
    features: { notifications: true, realtime: true },
    config: {
      auth: {
        sessionTimeout: 30 * 60 * 1000, // 30 minutes
        maxLoginAttempts: 5,
      },
      notificationOptions: {
        maxNotifications: 8,
        defaultDuration: 6000,
      },
      apiConfig: {
        baseUrl: 'https://api.example.com',
        timeout: 10000,
      },
    },
  },
  render: (args) => (
    <UniversalProviders {...args}>
      <div className="p-6">
        <Card className="p-6 max-w-2xl mx-auto">
          <h3 className="text-lg font-semibold mb-4">Custom Configuration</h3>
          <div className="space-y-4">
            <div className="bg-gray-50 p-4 rounded">
              <h4 className="font-medium mb-2">Applied Configuration</h4>
              <pre className="text-sm overflow-auto">
                {JSON.stringify(args.config, null, 2)}
              </pre>
            </div>
            <div className="bg-blue-50 p-4 rounded">
              <h4 className="font-medium mb-2">Features Enabled</h4>
              <pre className="text-sm">
                {JSON.stringify(args.features, null, 2)}
              </pre>
            </div>
          </div>
        </Card>
      </div>
    </UniversalProviders>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Custom configuration override showing how to customize provider settings.',
      },
    },
  },
};

// Development vs Production
export const DevelopmentVsProduction: Story = {
  render: () => {
    const [isDevelopment, setIsDevelopment] = React.useState(true);

    return (
      <div className="space-y-6 p-6">
        <div className="text-center">
          <h3 className="text-xl font-bold mb-4">Development vs Production</h3>
          <div className="flex justify-center gap-2 mb-4">
            <Button
              onClick={() => setIsDevelopment(true)}
              variant={isDevelopment ? 'default' : 'outline'}
              size="sm"
            >
              Development
            </Button>
            <Button
              onClick={() => setIsDevelopment(false)}
              variant={!isDevelopment ? 'default' : 'outline'}
              size="sm"
            >
              Production
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="p-6">
            <h4 className="font-semibold mb-4">Development Mode</h4>
            <UniversalProviders
              portal="admin"
              enableDevtools={true}
              features={{
                notifications: true,
                devtools: true,
                errorHandling: true,
              }}
            >
              <div className="space-y-2 text-sm">
                <p>✅ React Query Devtools enabled</p>
                <p>✅ Enhanced error messages</p>
                <p>✅ Development warnings</p>
                <p>✅ Debug information</p>
              </div>
            </UniversalProviders>
          </Card>

          <Card className="p-6">
            <h4 className="font-semibold mb-4">Production Mode</h4>
            <UniversalProviders
              portal="admin"
              enableDevtools={false}
              features={{
                notifications: true,
                devtools: false,
                errorHandling: true,
              }}
            >
              <div className="space-y-2 text-sm">
                <p>❌ No devtools</p>
                <p>🔒 Secure error messages</p>
                <p>⚡ Optimized performance</p>
                <p>📊 Analytics enabled</p>
              </div>
            </UniversalProviders>
          </Card>
        </div>

        <Card className="p-6">
          <h4 className="font-medium mb-4">Environment Detection</h4>
          <div className="bg-gray-50 p-4 rounded text-sm">
            <p>
              <strong>Current Mode:</strong> {isDevelopment ? 'Development' : 'Production'}
            </p>
            <p className="mt-2 text-gray-600">
              The UniversalProviders automatically detect the environment and adjust
              settings accordingly. Devtools are enabled by default in development
              and disabled in production.
            </p>
          </div>
        </Card>
      </div>
    );
  },
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        story: 'Shows how providers behave differently in development vs production environments.',
      },
    },
  },
};
