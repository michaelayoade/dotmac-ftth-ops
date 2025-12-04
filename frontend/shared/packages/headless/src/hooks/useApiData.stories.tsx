import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import React from 'react';
import {
  useApiData,
  useCustomerDashboard,
  useCustomerServices,
  useCustomerBilling,
  useCustomerUsage,
} from './useApiData';
import { Card, Button } from '@dotmac/primitives';

const meta: Meta = {
  title: 'Headless/useApiData',
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: `
Headless hook for API data fetching with caching, retry logic, and fallback handling.

## Features
- **Automatic caching** with configurable TTL
- **Retry mechanism** with exponential backoff
- **Fallback data support** for graceful degradation
- **Error handling** with notifications
- **Loading states** and status tracking
- **Specialized hooks** for common data types

## Usage
\`\`\`tsx
import { useApiData, useCustomerDashboard } from '@dotmac/headless';

// Basic usage
const { data, isLoading, error, refetch } = useApiData(
  'my-data',
  () => fetchMyData(),
  { ttl: 300000, fallbackData: defaultData }
);

// Specialized hook
const { data: dashboard } = useCustomerDashboard();
\`\`\`
      `,
    },
  },
  tags: ['autodocs', 'headless', 'api', 'hooks'],
};

export default meta;

// Mock API functions for demonstrations
const mockApiDelay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const mockSuccessfulApi = async (data: any) => {
  await mockApiDelay(1000);
  return data;
};

const mockFailingApi = async () => {
  await mockApiDelay(1000);
  throw new Error('API call failed');
};

const mockIntermittentApi = async (data: any, failureRate = 0.3) => {
  await mockApiDelay(800);
  if (Math.random() < failureRate) {
    throw new Error('Network error');
  }
  return data;
};

// Demo component for useApiData
const ApiDataDemo: React.FC<{
  apiType: 'success' | 'failure' | 'intermittent';
  dataKey: string;
  mockData: any;
  options?: any;
}> = ({ apiType, dataKey, mockData, options = {} }) => {
  const fetcher = React.useCallback(async () => {
    switch (apiType) {
      case 'success':
        return mockSuccessfulApi(mockData);
      case 'failure':
        return mockFailingApi();
      case 'intermittent':
        return mockIntermittentApi(mockData);
      default:
        return mockSuccessfulApi(mockData);
    }
  }, [apiType, mockData]);

  const { data, isLoading, error, refetch, lastUpdated } = useApiData(
    dataKey,
    fetcher,
    options
  );

  return (
    <Card className="p-6 max-w-md">
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">
          API Data Hook Demo
        </h3>

        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span>Status:</span>
            <span className={`font-medium ${
              isLoading ? 'text-blue-600' :
              error ? 'text-red-600' :
              'text-green-600'
            }`}>
              {isLoading ? 'Loading...' : error ? 'Error' : 'Success'}
            </span>
          </div>

          <div className="flex justify-between">
            <span>API Type:</span>
            <span className="font-medium capitalize">{apiType}</span>
          </div>

          {lastUpdated && (
            <div className="flex justify-between">
              <span>Last Updated:</span>
              <span className="font-medium text-xs">
                {lastUpdated.toLocaleTimeString()}
              </span>
            </div>
          )}
        </div>

        {/* Data Display */}
        <div className="bg-gray-50 p-3 rounded">
          <h4 className="font-medium text-sm mb-2">Data:</h4>
          {isLoading ? (
            <div className="animate-pulse">
              <div className="h-4 bg-gray-200 rounded mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            </div>
          ) : error ? (
            <div className="text-red-600 text-sm">{error.message}</div>
          ) : (
            <pre className="text-xs overflow-auto">
              {JSON.stringify(data, null, 2)}
            </pre>
          )}
        </div>

        {/* Controls */}
        <div className="flex gap-2">
          <Button onClick={refetch} size="sm" disabled={isLoading}>
            Refetch
          </Button>
          <Button
            onClick={() => window.location.reload()}
            variant="outline"
            size="sm"
          >
            Reset
          </Button>
        </div>
      </div>
    </Card>
  );
};

type Story = StoryObj;

// Basic successful API call
export const SuccessfulAPI: Story = {
  render: () => (
    <ApiDataDemo
      apiType="success"
      dataKey="success-demo"
      mockData={{
        id: 1,
        name: 'John Doe',
        email: 'john@example.com',
        status: 'active'
      }}
      options={{ ttl: 60000 }}
    />
  ),
  parameters: {
    docs: {
      description: {
        story: 'Basic API data fetching with successful response and caching.',
      },
    },
  },
};

// Failing API with error handling
export const FailingAPI: Story = {
  render: () => (
    <ApiDataDemo
      apiType="failure"
      dataKey="failure-demo"
      mockData={null}
      options={{
        ttl: 60000,
        retryCount: 2,
        fallbackData: { message: 'Using fallback data' }
      }}
    />
  ),
  parameters: {
    docs: {
      description: {
        story: 'API call that fails with error handling and fallback data.',
      },
    },
  },
};

// Intermittent API with retry logic
export const IntermittentAPI: Story = {
  render: () => (
    <ApiDataDemo
      apiType="intermittent"
      dataKey="intermittent-demo"
      mockData={{
        message: 'Data loaded successfully',
        timestamp: new Date().toISOString()
      }}
      options={{
        ttl: 30000,
        retryCount: 3,
        retryDelay: 500,
        fallbackData: { message: 'Fallback data while retrying' }
      }}
    />
  ),
  parameters: {
    docs: {
      description: {
        story: 'Intermittent API that sometimes fails, demonstrating retry logic.',
      },
    },
  },
};

// Caching demonstration
export const CachingDemo: Story = {
  render: () => {
    const [instances, setInstances] = React.useState(1);

    const addInstance = () => setInstances(prev => prev + 1);
    const resetInstances = () => setInstances(1);

    return (
      <div className="space-y-4">
        <div className="text-center">
          <h3 className="text-lg font-semibold mb-2">Caching Demonstration</h3>
          <p className="text-sm text-gray-600 mb-4">
            Multiple components using the same data key will share cached data
          </p>
          <div className="flex justify-center gap-2 mb-4">
            <Button onClick={addInstance} size="sm">
              Add Instance ({instances})
            </Button>
            <Button onClick={resetInstances} variant="outline" size="sm">
              Reset
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: instances }, (_, i) => (
            <ApiDataDemo
              key={i}
              apiType="success"
              dataKey="shared-cache-demo" // Same key for all instances
              mockData={{
                instance: i + 1,
                data: `Shared cached data ${Date.now()}`,
                cached: true
              }}
              options={{ ttl: 120000 }} // 2 minute cache
            />
          ))}
        </div>

        <Card className="p-4 bg-blue-50">
          <p className="text-sm text-blue-700">
            💡 Notice how all instances load instantly after the first one -
            they're using the same cached data!
          </p>
        </Card>
      </div>
    );
  },
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        story: 'Demonstrates how multiple components share cached data when using the same key.',
      },
    },
  },
};

// Specialized hooks demonstration
export const SpecializedHooks: Story = {
  render: () => {
    const CustomerDashboardDemo = () => {
      // Mock the hook since we don't have real API
      const [mockData, setMockData] = React.useState(null);
      const [isLoading, setIsLoading] = React.useState(true);

      React.useEffect(() => {
        setTimeout(() => {
          setMockData({
            totalServices: 3,
            activeTickets: 2,
            currentBill: 129.99,
            dataUsage: '45.2 GB',
            status: 'active'
          });
          setIsLoading(false);
        }, 1500);
      }, []);

      return (
        <Card className="p-4">
          <h4 className="font-medium mb-2">Customer Dashboard</h4>
          {isLoading ? (
            <div className="space-y-2">
              <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
              <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
            </div>
          ) : (
            <div className="space-y-1 text-sm">
              <p>Services: {mockData?.totalServices}</p>
              <p>Support Tickets: {mockData?.activeTickets}</p>
              <p>Current Bill: ${mockData?.currentBill}</p>
              <p>Data Usage: {mockData?.dataUsage}</p>
            </div>
          )}
        </Card>
      );
    };

    const CustomerServicesDemo = () => {
      const [mockData, setMockData] = React.useState(null);
      const [isLoading, setIsLoading] = React.useState(true);

      React.useEffect(() => {
        setTimeout(() => {
          setMockData([
            { id: 1, name: 'Internet Service', status: 'active' },
            { id: 2, name: 'Phone Service', status: 'active' },
            { id: 3, name: 'TV Package', status: 'suspended' }
          ]);
          setIsLoading(false);
        }, 1200);
      }, []);

      return (
        <Card className="p-4">
          <h4 className="font-medium mb-2">Customer Services</h4>
          {isLoading ? (
            <div className="space-y-2">
              {[1,2,3].map(i => (
                <div key={i} className="h-4 bg-gray-200 rounded animate-pulse"></div>
              ))}
            </div>
          ) : (
            <div className="space-y-1 text-sm">
              {mockData?.map((service: any) => (
                <div key={service.id} className="flex justify-between">
                  <span>{service.name}</span>
                  <span className={`capitalize ${
                    service.status === 'active' ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {service.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      );
    };

    const CustomerBillingDemo = () => {
      const [mockData, setMockData] = React.useState(null);
      const [isLoading, setIsLoading] = React.useState(true);

      React.useEffect(() => {
        setTimeout(() => {
          setMockData({
            currentBalance: 129.99,
            dueDate: '2024-03-15',
            lastPayment: 129.99,
            paymentDate: '2024-02-15'
          });
          setIsLoading(false);
        }, 800);
      }, []);

      return (
        <Card className="p-4">
          <h4 className="font-medium mb-2">Billing Information</h4>
          {isLoading ? (
            <div className="space-y-2">
              <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
              <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
            </div>
          ) : (
            <div className="space-y-1 text-sm">
              <p>Balance: ${mockData?.currentBalance}</p>
              <p>Due: {mockData?.dueDate}</p>
              <p>Last Payment: ${mockData?.lastPayment}</p>
            </div>
          )}
        </Card>
      );
    };

    return (
      <div className="space-y-4">
        <div className="text-center">
          <h3 className="text-lg font-semibold mb-2">Specialized API Hooks</h3>
          <p className="text-sm text-gray-600">
            Pre-built hooks for common API endpoints
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <CustomerDashboardDemo />
          <CustomerServicesDemo />
          <CustomerBillingDemo />
        </div>

        <Card className="p-4 bg-green-50">
          <h4 className="font-medium mb-2 text-green-800">Available Specialized Hooks</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-green-700">
            <div>• useCustomerDashboard()</div>
            <div>• useCustomerServices()</div>
            <div>• useCustomerBilling()</div>
            <div>• useCustomerUsage(period)</div>
            <div>• useCustomerDocuments()</div>
            <div>• useCustomerSupportTickets()</div>
          </div>
        </Card>
      </div>
    );
  },
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        story: 'Specialized hooks for common API endpoints with realistic mock data.',
      },
    },
  },
};

// Options configuration
export const ConfigurationOptions: Story = {
  render: () => {
    const [selectedConfig, setSelectedConfig] = React.useState('default');

    const configurations = {
      default: {
        ttl: 300000, // 5 minutes
        retryCount: 2,
        retryDelay: 1000,
        enabled: true
      },
      aggressive: {
        ttl: 60000, // 1 minute
        retryCount: 5,
        retryDelay: 500,
        enabled: true
      },
      conservative: {
        ttl: 900000, // 15 minutes
        retryCount: 1,
        retryDelay: 2000,
        enabled: true
      },
      disabled: {
        ttl: 0,
        retryCount: 0,
        retryDelay: 0,
        enabled: false
      }
    };

    return (
      <div className="space-y-6">
        <div className="text-center">
          <h3 className="text-lg font-semibold mb-2">Configuration Options</h3>
          <p className="text-sm text-gray-600 mb-4">
            Different configuration options for various use cases
          </p>

          <div className="flex justify-center gap-2 mb-4">
            {Object.keys(configurations).map(config => (
              <Button
                key={config}
                onClick={() => setSelectedConfig(config)}
                variant={selectedConfig === config ? 'default' : 'outline'}
                size="sm"
              >
                {config.charAt(0).toUpperCase() + config.slice(1)}
              </Button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="p-4">
            <h4 className="font-medium mb-3">Current Configuration</h4>
            <pre className="bg-gray-50 p-3 rounded text-sm">
              {JSON.stringify(configurations[selectedConfig as keyof typeof configurations], null, 2)}
            </pre>
          </Card>

          <ApiDataDemo
            apiType="intermittent"
            dataKey={`config-demo-${selectedConfig}`}
            mockData={{
              config: selectedConfig,
              message: `Data with ${selectedConfig} configuration`
            }}
            options={configurations[selectedConfig as keyof typeof configurations]}
          />
        </div>

        <Card className="p-4 bg-blue-50">
          <h4 className="font-medium mb-2 text-blue-800">Configuration Guide</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-blue-700">
            <div>
              <strong>Default:</strong> Balanced approach for most use cases
            </div>
            <div>
              <strong>Aggressive:</strong> Frequent updates, fast retries
            </div>
            <div>
              <strong>Conservative:</strong> Long caching, fewer retries
            </div>
            <div>
              <strong>Disabled:</strong> No caching or retries
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
        story: 'Different configuration options showing how to customize the hook behavior.',
      },
    },
  },
};

// Real-time updates simulation
export const RealTimeUpdates: Story = {
  render: () => {
    const [isActive, setIsActive] = React.useState(false);
    const [updateCount, setUpdateCount] = React.useState(0);

    const MockRealTimeComponent = () => {
      const fetcher = React.useCallback(async () => {
        await mockApiDelay(500);
        return {
          timestamp: new Date().toISOString(),
          value: Math.floor(Math.random() * 1000),
          updateCount: updateCount
        };
      }, [updateCount]);

      const { data, isLoading, refetch } = useApiData(
        `realtime-${updateCount}`, // Change key to force refetch
        fetcher,
        { ttl: 1000 } // Very short cache
      );

      React.useEffect(() => {
        if (isActive) {
          const interval = setInterval(() => {
            setUpdateCount(prev => prev + 1);
            refetch();
          }, 2000);

          return () => clearInterval(interval);
        }
      }, [isActive, refetch]);

      return (
        <Card className="p-4">
          <h4 className="font-medium mb-2">Real-time Data</h4>
          {isLoading ? (
            <div className="animate-pulse">
              <div className="h-4 bg-gray-200 rounded mb-2"></div>
            </div>
          ) : (
            <div className="space-y-1 text-sm">
              <p>Value: {data?.value}</p>
              <p>Updates: {data?.updateCount}</p>
              <p className="text-xs text-gray-500">
                Last: {data?.timestamp ? new Date(data.timestamp).toLocaleTimeString() : 'Never'}
              </p>
            </div>
          )}
        </Card>
      );
    };

    return (
      <div className="space-y-4">
        <div className="text-center">
          <h3 className="text-lg font-semibold mb-2">Real-time Updates</h3>
          <p className="text-sm text-gray-600 mb-4">
            Simulates real-time data updates with automatic refetching
          </p>
          <Button
            onClick={() => setIsActive(!isActive)}
            variant={isActive ? 'destructive' : 'default'}
          >
            {isActive ? 'Stop Updates' : 'Start Updates'}
          </Button>
          {isActive && (
            <p className="text-xs text-green-600 mt-2">
              🟢 Updates every 2 seconds
            </p>
          )}
        </div>

        <div className="flex justify-center">
          <MockRealTimeComponent />
        </div>
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'Demonstrates real-time data updates with automatic refetching.',
      },
    },
  },
};

// Error recovery patterns
export const ErrorRecovery: Story = {
  render: () => {
    const [errorRate, setErrorRate] = React.useState(0.7);
    const [attempts, setAttempts] = React.useState(0);

    const ErrorRecoveryDemo = () => {
      const fetcher = React.useCallback(async () => {
        const currentAttempt = attempts + 1;
        setAttempts(currentAttempt);

        await mockApiDelay(800);

        if (Math.random() < errorRate) {
          throw new Error(`API Error (Attempt ${currentAttempt})`);
        }

        return {
          message: 'Success after retries!',
          attempts: currentAttempt,
          errorRate: errorRate
        };
      }, [attempts, errorRate]);

      const { data, isLoading, error, refetch } = useApiData(
        `error-recovery-${errorRate}`,
        fetcher,
        {
          ttl: 10000,
          retryCount: 3,
          retryDelay: 1000,
          fallbackData: {
            message: 'Using fallback data due to errors',
            fallback: true
          }
        }
      );

      return (
        <Card className="p-4">
          <h4 className="font-medium mb-2">Error Recovery Demo</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Attempts:</span>
              <span>{attempts}</span>
            </div>
            <div className="flex justify-between">
              <span>Error Rate:</span>
              <span>{Math.round(errorRate * 100)}%</span>
            </div>
            <div className="flex justify-between">
              <span>Status:</span>
              <span className={
                isLoading ? 'text-blue-600' :
                error ? 'text-red-600' :
                data?.fallback ? 'text-yellow-600' :
                'text-green-600'
              }>
                {isLoading ? 'Retrying...' :
                 error ? 'Failed' :
                 data?.fallback ? 'Fallback' :
                 'Success'}
              </span>
            </div>
          </div>

          {data && (
            <div className="mt-3 p-2 bg-gray-50 rounded text-xs">
              <strong>Data:</strong> {data.message}
            </div>
          )}

          {error && (
            <div className="mt-3 p-2 bg-red-50 rounded text-xs text-red-700">
              <strong>Error:</strong> {error.message}
            </div>
          )}
        </Card>
      );
    };

    return (
      <div className="space-y-4">
        <div className="text-center">
          <h3 className="text-lg font-semibold mb-2">Error Recovery Patterns</h3>
          <p className="text-sm text-gray-600 mb-4">
            Demonstrates retry logic and fallback data handling
          </p>

          <div className="flex justify-center items-center gap-4 mb-4">
            <label className="text-sm font-medium">Error Rate:</label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={errorRate}
              onChange={(e) => setErrorRate(parseFloat(e.target.value))}
              className="w-32"
            />
            <span className="text-sm">{Math.round(errorRate * 100)}%</span>
          </div>

          <Button onClick={() => setAttempts(0)}>
            Reset Demo
          </Button>
        </div>

        <div className="flex justify-center">
          <ErrorRecoveryDemo />
        </div>

        <Card className="p-4 bg-yellow-50">
          <h4 className="font-medium mb-2 text-yellow-800">Recovery Strategy</h4>
          <div className="text-sm text-yellow-700 space-y-1">
            <p>1. <strong>Retry:</strong> Attempts up to 3 times with exponential backoff</p>
            <p>2. <strong>Fallback:</strong> Uses fallback data if all retries fail</p>
            <p>3. <strong>Error State:</strong> Shows error if no fallback is available</p>
          </div>
        </Card>
      </div>
    );
  },
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        story: 'Demonstrates error recovery patterns with retry logic and fallback data.',
      },
    },
  },
};
