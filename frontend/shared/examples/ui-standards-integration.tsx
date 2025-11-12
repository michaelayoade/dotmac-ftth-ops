/**
 * Example: UI Standards Integration
 *
 * This file demonstrates how to integrate the @dotmac/ui-standards package
 * into management and ISP portal applications.
 */

import React, { Suspense, useState } from "react";
import {
  StandardShells,
  ErrorBoundaries,
  PWAFeatures,
  usePerformanceMonitor,
  useOnlineStatus,
  useInstallPrompt,
  trackComponentRender,
  debounce,
  preloadResource,
} from "@dotmac/ui-standards";

// 1. Basic Loading States Example
export function CustomersPage() {
  const [customers, setCustomers] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  if (error) {
    return (
      <StandardShells.ServerError
        onRetry={() => window.location.reload()}
        onHome={() => (window.location.href = "/dashboard")}
      />
    );
  }

  if (loading) {
    return (
      <div className="p-6">
        <StandardShells.CardSkeleton />
        <div className="mt-6">
          <StandardShells.TableSkeleton rows={10} columns={5} />
        </div>
      </div>
    );
  }

  return <div className="p-6">{/* Your customer content here */}</div>;
}

// 2. Error Boundary Integration Example
export function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundaries.Page
      onError={(error, errorInfo) => {
        // Send to error reporting service
        console.error("Dashboard error:", error, errorInfo);
      }}
    >
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow-sm border-b">
          <ErrorBoundaries.Section>
            <NavigationHeader />
          </ErrorBoundaries.Section>
        </header>

        <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <ErrorBoundaries.Section>{children}</ErrorBoundaries.Section>
        </main>
      </div>
    </ErrorBoundaries.Page>
  );
}

// 3. Component-Level Error Handling
function NavigationHeader() {
  return (
    <nav className="flex items-center justify-between p-4">
      <div className="flex items-center space-x-4">
        <h1 className="text-xl font-semibold">DotMac Portal</h1>

        <ErrorBoundaries.Component
          fallback={({ error, resetErrorBoundary }) => (
            <div className="text-sm text-red-600">
              Navigation error: {error.message}
              <button onClick={resetErrorBoundary} className="ml-2 text-blue-600 underline">
                Retry
              </button>
            </div>
          )}
        >
          <NavigationMenu />
        </ErrorBoundaries.Component>
      </div>

      <PWAFeatures.OfflineDetector position="top" />
    </nav>
  );
}

function NavigationMenu() {
  // This component might fail and will be caught by the error boundary
  return (
    <ul className="flex space-x-4">
      <li>
        <a href="/dashboard">Dashboard</a>
      </li>
      <li>
        <a href="/customers">Customers</a>
      </li>
      <li>
        <a href="/billing">Billing</a>
      </li>
    </ul>
  );
}

// 4. PWA Features Integration
export function AppWithPWAFeatures() {
  const isOnline = useOnlineStatus();
  const { isInstallable, install } = useInstallPrompt();

  return (
    <div>
      <PWAFeatures.OfflineDetector
        showStatus={true}
        showToast={true}
        onOffline={() => {
          // Handle offline mode
          console.log("App went offline");
        }}
        onOnline={() => {
          // Handle online mode
          console.log("App came online");
        }}
      />

      {isInstallable && (
        <PWAFeatures.InstallPrompt
          appName="DotMac Portal"
          description="Install for a better experience"
          onInstall={() => install()}
          onDismiss={() => console.log("Install dismissed")}
        />
      )}

      {!isOnline && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
          <p className="text-yellow-700">You're offline. Some features may not be available.</p>
        </div>
      )}
    </div>
  );
}

// 5. Performance Monitoring Integration
export function PerformanceMonitoredApp() {
  const { metrics, budgetViolations, performanceScore, reportMetrics } = usePerformanceMonitor({
    fcp: 1500, // Custom budget: 1.5s for FCP
    lcp: 2000, // Custom budget: 2s for LCP
  });

  React.useEffect(() => {
    // Report metrics when component unmounts
    return () => {
      reportMetrics();
    };
  }, [reportMetrics]);

  React.useEffect(() => {
    // Log performance violations in development
    if (process.env["NODE_ENV"] === "development" && budgetViolations.length > 0) {
      console.warn("Performance budget violations:", budgetViolations);
    }
  }, [budgetViolations]);

  return (
    <div>
      {process.env["NODE_ENV"] === "development" && (
        <div className="fixed bottom-4 right-4 bg-white border border-gray-200 rounded-lg p-3 shadow-lg text-xs">
          <div>Performance Score: {performanceScore}</div>
          <div>FCP: {metrics.fcp}ms</div>
          <div>LCP: {metrics.lcp}ms</div>
          {budgetViolations.length > 0 && (
            <div className="text-red-600 mt-1">{budgetViolations.length} violations</div>
          )}
        </div>
      )}

      {/* Your app content */}
    </div>
  );
}

// 6. Advanced Loading Patterns
export function DataTableWithSkeletons() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState([]);

  // Simulate data loading
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setData([
        /* mock data */
      ]);
      setLoading(false);
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        <StandardShells.Loading variant="shimmer" size="lg" width="1/4" />
        <StandardShells.TableSkeleton rows={8} columns={6} />
      </div>
    );
  }

  return (
    <div>
      <h2>Customer Data</h2>
      {/* Your data table here */}
    </div>
  );
}

// 7. Custom Error Components
export function NetworkAwareContent({ children }: { children: React.ReactNode }) {
  const isOnline = useOnlineStatus();
  const [networkError, setNetworkError] = useState(false);

  if (!isOnline || networkError) {
    return (
      <StandardShells.NetworkError
        onRetry={() => {
          setNetworkError(false);
          window.location.reload();
        }}
      />
    );
  }

  return (
    <ErrorBoundaries.Section
      onError={(error) => {
        // Check if it's a network-related error
        if (error.message.includes("fetch") || error.message.includes("network")) {
          setNetworkError(true);
        }
      }}
    >
      {children}
    </ErrorBoundaries.Section>
  );
}

// 8. Performance-Optimized Component
const ExpensiveComponent = React.memo(function ExpensiveComponent({ data }: { data: any }) {
  const { onRenderStart, onRenderEnd } = trackComponentRender("ExpensiveComponent");

  React.useLayoutEffect(() => {
    onRenderStart();
    return onRenderEnd;
  });

  // Expensive computation here
  return <div>Expensive content</div>;
});

// 9. Search with Debouncing
export function SearchComponent() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const debouncedSearch = React.useMemo(
    () =>
      debounce(async (searchQuery: string) => {
        if (!searchQuery.trim()) {
          setResults([]);
          return;
        }

        setLoading(true);
        try {
          // Your search API call here
          const response = await fetch(`/api/search?q=${searchQuery}`);
          const data = await response.json();
          setResults(data.results);
        } catch (error) {
          console.error("Search failed:", error);
        } finally {
          setLoading(false);
        }
      }, 300),
    [],
  );

  React.useEffect(() => {
    debouncedSearch(query);
  }, [query, debouncedSearch]);

  return (
    <div>
      <input
        type="text"
        placeholder="Search..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="border rounded px-3 py-2"
      />

      {loading && (
        <div className="mt-4">
          <StandardShells.ListSkeleton items={3} />
        </div>
      )}

      {!loading && results.length > 0 && (
        <div className="mt-4">
          {results.map((result: any) => (
            <div key={result.id}>{result.title}</div>
          ))}
        </div>
      )}
    </div>
  );
}

// 10. Resource Preloading Integration
export function OptimizedPage() {
  React.useEffect(() => {
    // Preload critical resources
    preloadResource("/api/dashboard/stats", "fetch");
    preloadResource("/images/hero.webp", "image");

    // Prefetch next page resources when user hovers
    const prefetchNextPage = () => {
      preloadResource("/customers", "document");
    };

    const navLinks = document.querySelectorAll('nav a[href="/customers"]');
    navLinks.forEach((link) => {
      link.addEventListener("mouseenter", prefetchNextPage);
    });

    return () => {
      navLinks.forEach((link) => {
        link.removeEventListener("mouseenter", prefetchNextPage);
      });
    };
  }, []);

  return <div>{/* Your page content */}</div>;
}

// 11. Complete App Integration Example
export default function AppRoot() {
  return (
    <ErrorBoundaries.Page>
      <Suspense fallback={<StandardShells.Loading size="lg" />}>
        <AppWithPWAFeatures />
        <PerformanceMonitoredApp />

        <DashboardLayout>
          <NetworkAwareContent>
            <OptimizedPage />
            <SearchComponent />
          </NetworkAwareContent>
        </DashboardLayout>
      </Suspense>
    </ErrorBoundaries.Page>
  );
}
