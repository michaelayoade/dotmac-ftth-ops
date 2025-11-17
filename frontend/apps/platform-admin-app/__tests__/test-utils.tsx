import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { server } from "./msw/server";
import {
  resetWebhookStorage as mswResetWebhookStorage,
  createMockWebhook as mswCreateMockWebhook,
  createMockDelivery as mswCreateMockDelivery,
  seedWebhookData as mswSeedWebhookData,
} from "./msw/handlers/webhooks";

export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        cacheTime: 0,
        staleTime: 0,
        refetchOnMount: false,
        refetchOnReconnect: false,
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: false,
      },
    },
    logger: {
      log: console.log,
      warn: console.warn,
      error: () => {},
    },
  });
}

export function createQueryWrapper(queryClient?: QueryClient) {
  const client = queryClient || createTestQueryClient();
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

export const resetWebhookStorage = mswResetWebhookStorage;
export const createMockWebhook = mswCreateMockWebhook;
export const createMockDelivery = mswCreateMockDelivery;
export const seedWebhookData = mswSeedWebhookData;

type HttpMethod = "get" | "post" | "put" | "patch" | "delete";

type HandlerResolver = Parameters<typeof http.get>[1];

function overrideApiEndpoint(method: HttpMethod, path: string, resolver: HandlerResolver) {
  const httpMethod = http[method];
  const fullPath = path.startsWith("*") ? path : `*${path}`;
  server.use(httpMethod(fullPath as any, resolver as any));
}

export function makeApiEndpointFail(
  method: HttpMethod,
  path: string,
  errorMessage: string,
  status = 500,
) {
  overrideApiEndpoint(method, path, () =>
    HttpResponse.json({ error: errorMessage, code: "TEST_ERROR" }, { status }),
  );
}

export function makeApiEndpointReturn(method: HttpMethod, path: string, data: unknown, status = 200) {
  overrideApiEndpoint(method, path, () => HttpResponse.json(data, { status }));
}
