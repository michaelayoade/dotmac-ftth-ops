/**
 * Apollo Provider Wrapper
 *
 * Wraps the app with Apollo Client for GraphQL support.
 * Can be added incrementally without breaking existing REST APIs.
 */

"use client";

import { useMemo } from "react";
import { ApolloProvider as BaseApolloProvider } from "@apollo/client/react";

import { useAppConfig } from "@/providers/AppConfigContext";

import { createApolloClient } from "./client";

export function ApolloProvider({ children }: { children: React.ReactNode }) {
  const { api } = useAppConfig();

  const client = useMemo(() => createApolloClient(api.graphqlEndpoint), [api.graphqlEndpoint]);

  return <BaseApolloProvider client={client}>{children}</BaseApolloProvider>;
}
