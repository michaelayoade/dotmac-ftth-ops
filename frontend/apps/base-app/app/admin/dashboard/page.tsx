"use client";

import { ApolloProvider } from "@apollo/client";
import { graphqlClient } from "@/lib/graphql/client";
import { UnifiedAdminDashboard } from "@/components/admin/UnifiedAdminDashboard";

export default function AdminDashboardPage() {
  return (
    <ApolloProvider client={graphqlClient}>
      <div className="container mx-auto py-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Platform Admin Dashboard</h1>
          <p className="text-gray-600 mt-1">
            Unified view of tenants, customers, and revenue metrics powered by GraphQL
          </p>
        </div>

        <UnifiedAdminDashboard />
      </div>
    </ApolloProvider>
  );
}
