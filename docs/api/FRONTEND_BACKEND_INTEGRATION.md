# Frontend-Backend Integration Guide

## Overview

This guide demonstrates how to integrate the DotMac frontend packages (`frontend/shared/packages/`) with the backend platform services to create a unified full-stack application.

## Architecture Alignment

### Backend Services ↔ Frontend Packages

| Backend Service | Frontend Package | Integration Points |
|---|---|---|
| **Service Registry** | `@dotmac/headless` (useWebSocket) | Real-time service status, health monitoring |
| **Audit Trail** | `@dotmac/analytics`, `@dotmac/dashboard` | Compliance dashboards, event visualization |
| **Distributed Locks** | `@dotmac/headless` (useRealTimeSync) | Optimistic UI updates, conflict resolution |
| **Authentication** | `@shared/lib/auth` (AuthProvider, useSession, 2FA helpers) | Login flows, session management |
| **API Gateway** | `@dotmac/http-client` | Request routing, tenant resolution |
| **Multi-tenant** | `@dotmac/headless` (useISPTenant) | Tenant switching, context |

## Integration Examples

### 1. HTTP Client Configuration

Configure the frontend HTTP client to work with the backend platform:

```typescript
// frontend/apps/admin/src/lib/api-client.ts
import { createHttpClient } from '@dotmac/http-client';
import { get_config } from '../backend-config';

const config = get_config();

export const apiClient = createHttpClient({
  baseURL: config.api_gateway.base_url || 'http://localhost:8000',
  timeout: 30000,
  retries: 3,
  retryDelay: 1000,
  tenantIdSource: 'header', // Matches backend tenant middleware
  authTokenSource: 'cookie', // Matches backend session config
});

// Configure for service discovery
apiClient.interceptors.request.use(async (config) => {
  // Add service registry integration
  if (config.url?.includes('/api/services/')) {
    config.headers['X-Service-Registry'] = 'true';
  }

  // Add audit trail context
  config.headers['X-Audit-Context'] = JSON.stringify({
    component: 'frontend',
    user_agent: navigator.userAgent,
    timestamp: new Date().toISOString(),
  });

  return config;
});
```

### 2. Real-time Service Monitoring Dashboard

Create a service health dashboard using the service registry:

```typescript
// frontend/apps/admin/src/components/ServiceMonitor.tsx
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useWebSocket, useNotifications } from '@dotmac/headless';
import { Card } from '@dotmac/primitives';
import { ServiceHealthChart } from '@dotmac/dashboard';

export function ServiceMonitor() {
  const { addNotification } = useNotifications();

  // Fetch initial service list
  const { data: services } = useQuery({
    queryKey: ['services'],
    queryFn: () => apiClient.get('/api/service-registry/services'),
    refetchInterval: 30000,
  });

  // Real-time service health updates
  useWebSocket('/ws/service-health', {
    onMessage: (data) => {
      const { service_name, status, health_score } = data;

      if (status === 'unhealthy') {
        addNotification({
          type: 'error',
          title: 'Service Alert',
          message: `${service_name} is unhealthy (score: ${health_score})`,
        });
      }
    },
  });

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {services?.map((service) => (
        <Card key={service.id} className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">{service.name}</h3>
            <ServiceStatusBadge status={service.status} />
          </div>

          <ServiceHealthChart
            data={service.health_history}
            height={120}
          />

          <div className="mt-4 text-sm text-gray-600">
            <p>Version: {service.version}</p>
            <p>Host: {service.host}:{service.port}</p>
            <p>Last Check: {service.last_health_check}</p>
          </div>
        </Card>
      ))}
    </div>
  );
}
```

### 3. Audit Trail Analytics Dashboard

Build compliance dashboards using the audit trail aggregator:

```typescript
// frontend/apps/admin/src/components/AuditDashboard.tsx
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useDateRange, useFilters } from '@dotmac/headless';
import { AuditChart, ComplianceReport, EventTimeline } from '@dotmac/analytics';
import { DataTable } from '@dotmac/data-tables';

export function AuditDashboard() {
  const { dateRange, setDateRange } = useDateRange();
  const { filters, updateFilter } = useFilters();

  // Fetch audit events
  const { data: auditEvents } = useQuery({
    queryKey: ['audit-events', dateRange, filters],
    queryFn: () => apiClient.post('/api/audit-trail/query', {
      start_time: dateRange.start,
      end_time: dateRange.end,
      categories: filters.categories,
      user_id: filters.user_id,
      tenant_id: filters.tenant_id,
    }),
  });

  // Fetch compliance report
  const { data: complianceReport } = useQuery({
    queryKey: ['compliance-report', dateRange],
    queryFn: () => apiClient.post('/api/audit-trail/compliance-report', {
      start_date: dateRange.start,
      end_date: dateRange.end,
      report_type: 'security_overview',
    }),
  });

  // Fetch anomaly alerts
  const { data: anomalies } = useQuery({
    queryKey: ['audit-anomalies'],
    queryFn: () => apiClient.get('/api/audit-trail/anomalies'),
    refetchInterval: 60000, // Check for new anomalies every minute
  });

  return (
    <div className="space-y-6">
      {/* Compliance Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ComplianceReport data={complianceReport} />
        <AuditChart
          data={auditEvents?.aggregated_by_hour}
          type="events_over_time"
          title="Security Events (24h)"
        />
      </div>

      {/* Anomaly Alerts */}
      {anomalies?.length > 0 && (
        <AnomalyAlerts anomalies={anomalies} />
      )}

      {/* Event Timeline */}
      <EventTimeline events={auditEvents?.recent_events} />

      {/* Detailed Event Table */}
      <DataTable
        data={auditEvents?.events || []}
        columns={[
          { key: 'timestamp', label: 'Time', sortable: true },
          { key: 'category', label: 'Category', filterable: true },
          { key: 'action', label: 'Action' },
          { key: 'user_id', label: 'User', filterable: true },
          { key: 'ip_address', label: 'IP Address' },
          { key: 'outcome', label: 'Result', filterable: true },
        ]}
        exportable={true}
        exportFormats={['csv', 'json', 'pdf']}
        onExport={(format, selectedRows) => {
          return apiClient.post('/api/audit-trail/export', {
            format,
            event_ids: selectedRows.map(row => row.id),
          });
        }}
      />
    </div>
  );
}
```

### 4. Authentication Integration

Integrate frontend auth hooks with backend authentication services:

```typescript
import { useSession } from '@shared/lib/auth';
import { apiClient } from '@dotmac/headless/api';

export function useAuthenticatedApi() {
  const { user, isLoading, isAuthenticated } = useSession();

  return {
    user,
    isLoading,
    isAuthenticated,
    // Cookies are sent automatically with withCredentials: true
    client: apiClient.extend({
      withCredentials: true,
    }),
  };
}
```

### 5. Distributed Lock Integration

Use distributed locks for optimistic UI updates:

```typescript
// frontend/shared/packages/headless/src/hooks/useOptimisticUpdate.ts
import { useState, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { useNotifications } from './useNotifications';

export function useOptimisticUpdate(resourceType: string, resourceId: string) {
  const [isLocked, setIsLocked] = useState(false);
  const queryClient = useQueryClient();
  const { addNotification } = useNotifications();

  const acquireLock = useCallback(async () => {
    try {
      const response = await apiClient.post('/api/distributed-locks/acquire', {
        lock_name: `${resourceType}:${resourceId}`,
        timeout: 30.0,
        blocking_timeout: 5.0,
      });

      if (response.data.acquired) {
        setIsLocked(true);
        return response.data.lock_id;
      } else {
        addNotification({
          type: 'warning',
          title: 'Resource Locked',
          message: 'Another user is currently editing this resource.',
        });
        return null;
      }
    } catch (error) {
      addNotification({
        type: 'error',
        title: 'Lock Error',
        message: 'Failed to acquire lock for editing.',
      });
      return null;
    }
  }, [resourceType, resourceId, addNotification]);

  const releaseLock = useCallback(async (lockId: string) => {
    try {
      await apiClient.post('/api/distributed-locks/release', { lock_id: lockId });
      setIsLocked(false);
    } catch (error) {
      console.warn('Failed to release lock:', error);
    }
  }, []);

  const optimisticUpdate = useMutation({
    mutationFn: async ({ lockId, data, endpoint }) => {
      // Optimistically update the UI
      const queryKey = [resourceType, resourceId];
      const previousData = queryClient.getQueryData(queryKey);

      queryClient.setQueryData(queryKey, (old: any) => ({
        ...old,
        ...data,
        _optimistic: true,
      }));

      try {
        // Make the actual API call
        const response = await apiClient.put(endpoint, data);
        return response.data;
      } catch (error) {
        // Revert optimistic update on failure
        queryClient.setQueryData(queryKey, previousData);
        throw error;
      } finally {
        // Release the lock
        await releaseLock(lockId);
      }
    },
    onSuccess: (data) => {
      // Update with real data
      queryClient.setQueryData([resourceType, resourceId], data);
      addNotification({
        type: 'success',
        title: 'Updated',
        message: 'Changes saved successfully.',
      });
    },
    onError: (error) => {
      addNotification({
        type: 'error',
        title: 'Update Failed',
        message: error.message || 'Failed to save changes.',
      });
    },
  });

  return {
    isLocked,
    acquireLock,
    releaseLock,
    optimisticUpdate: optimisticUpdate.mutate,
    isUpdating: optimisticUpdate.isPending,
  };
}
```

### 6. Multi-tenant Context Integration

Connect frontend tenant management with backend multi-tenant system:

```typescript
// frontend/shared/packages/headless/src/providers/TenantProvider.tsx
import React, { createContext, useContext, useEffect } from 'react';
import { useTenantStore } from '../stores/tenantStore';
import { apiClient } from '../api/client';

export function TenantProvider({ children }) {
  const {
    currentTenant,
    tenants,
    switchTenant,
    loadTenants,
    tenantPermissions,
  } = useTenantStore();

  // Load user's accessible tenants
  useEffect(() => {
    loadTenants();
  }, [loadTenants]);

  // Configure API client for tenant context
  useEffect(() => {
    if (currentTenant) {
      apiClient.defaults.headers['X-Tenant-ID'] = currentTenant.id;

      // Update page title and branding
      document.title = `${currentTenant.name} - DotMac Platform`;

      // Load tenant-specific configuration
      apiClient.get('/api/isp/v1/config').then(response => {
        updateTenantConfig(response.data);
      });
    }
  }, [currentTenant]);

  return (
    <TenantContext.Provider value={{
      currentTenant,
      tenants,
      switchTenant,
      tenantPermissions,
    }}>
      {children}
    </TenantContext.Provider>
  );
}

// Tenant-aware component wrapper
export function withTenantContext(Component) {
  return function TenantAwareComponent(props) {
    const { currentTenant } = useContext(TenantContext);

    if (!currentTenant) {
      return <TenantSelector />;
    }

    return <Component {...props} tenant={currentTenant} />;
  };
}
```

## Configuration Integration

### Environment Configuration

Create a shared configuration that connects frontend and backend:

```typescript
// shared-config.ts (used by both frontend and backend)
export interface PlatformConfig {
  // API Configuration
  api: {
    base_url: string;
    timeout: number;
    rate_limit: {
      requests_per_minute: number;
      burst_size: number;
    };
  };

  // Service Registry
  service_registry: {
    redis_url: string;
    health_check_interval: number;
    default_ttl: number;
  };

  // Audit Trail
  audit_trail: {
    postgres_url: string;
    retention_days: number;
    real_time_alerts: boolean;
  };

  // Distributed Locks
  distributed_locks: {
    redis_url: string;
    default_timeout: number;
    auto_renewal: boolean;
  };

  // Frontend Specific
  frontend: {
    theme: 'light' | 'dark' | 'auto';
    features: {
      service_monitoring: boolean;
      audit_dashboard: boolean;
      real_time_notifications: boolean;
    };
    websocket_url: string;
  };
}

// Environment-based configuration
export function getConfig(): PlatformConfig {
  const isProduction = process.env.NODE_ENV === 'production';

  return {
    api: {
      base_url: process.env.VITE_API_URL || 'http://localhost:8000',
      timeout: 30000,
      rate_limit: {
        requests_per_minute: isProduction ? 100 : 1000,
        burst_size: isProduction ? 20 : 100,
      },
    },
    service_registry: {
      redis_url: process.env.VITE_REDIS_URL || 'redis://localhost:6379/0',
      health_check_interval: 30,
      default_ttl: 60,
    },
    // ... other config
    frontend: {
      theme: (process.env.VITE_THEME as any) || 'auto',
      features: {
        service_monitoring: process.env.VITE_FEATURE_SERVICE_MONITORING === 'true',
        audit_dashboard: process.env.VITE_FEATURE_AUDIT_DASHBOARD === 'true',
        real_time_notifications: process.env.VITE_FEATURE_REALTIME === 'true',
      },
      websocket_url: process.env.VITE_WS_URL || 'ws://localhost:8000/ws',
    },
  };
}
```

## Build and Development Integration

### Development Workflow

```bash
# Root project structure
dotmac-platform-services/
├── backend/                    # Python backend services
│   ├── src/dotmac/platform/   # Platform services
│   └── requirements.txt
├── frontend/                   # Frontend workspace
│   ├── shared/packages/       # Shared packages
│   └── package.json
└── docker-compose.yml         # Full-stack development

# Development commands
pnpm dev:frontend             # Start frontend dev server
python -m uvicorn main:app    # Start backend API
docker-compose up services    # Start Redis, PostgreSQL, etc.
```

### Docker Integration

```yaml
# docker-compose.override.yml (for development)
version: '3.8'
services:
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile.dev
    ports:
      - "3000:3000"
    volumes:
      - ./frontend:/app
      - /app/node_modules
    environment:
      - VITE_API_URL=http://backend:8000
      - VITE_WS_URL=ws://backend:8000/ws
    depends_on:
      - backend

  backend:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "8000:8000"
    volumes:
      - ./src:/app/src
    environment:
      - DATABASE_URL=postgresql+asyncpg://user:pass@postgres:5432/dotmac
      - REDIS_URL=redis://redis:6379/0
    depends_on:
      - postgres
      - redis
```

## Best Practices

### 1. State Management

- **Backend**: Use the unified configuration system and service registry
- **Frontend**: Use React Query for server state, Zustand for client state
- **Sync**: Real-time updates via WebSocket with optimistic UI

### 2. Error Handling

- **Backend**: Structured error responses with audit logging
- **Frontend**: Standardized error boundaries with user-friendly messages
- **Integration**: Error correlation IDs for debugging

### 3. Performance

- **Backend**: Service registry for load balancing and health checks
- **Frontend**: Code splitting, lazy loading, and caching strategies
- **Integration**: CDN for static assets, API response caching

### 4. Security

- **Backend**: JWT authentication, RBAC, audit trails
- **Frontend**: CSP headers, secure storage, input validation
- **Integration**: HTTPS, secure cookies, CORS configuration

This integration creates a comprehensive full-stack platform that leverages both the robust backend services and the sophisticated frontend component library for building modern ISP management applications.
