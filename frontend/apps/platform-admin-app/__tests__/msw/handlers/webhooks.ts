/**
 * MSW Handlers for Platform Admin Webhook APIs
 */

import { http, HttpResponse } from "msw";
import type {
  WebhookSubscription,
  WebhookDelivery,
  WebhookSubscriptionCreate,
  WebhookSubscriptionUpdate,
} from "../../../hooks/useWebhooks";

let webhookSubscriptions: WebhookSubscription[] = [];
let deliveries: WebhookDelivery[] = [];
let nextWebhookId = 1;
let nextDeliveryId = 1;

export function resetWebhookStorage() {
  webhookSubscriptions = [];
  deliveries = [];
  nextWebhookId = 1;
  nextDeliveryId = 1;
}

export function createMockWebhook(overrides: Partial<WebhookSubscription> = {}): WebhookSubscription {
  return {
    id: `wh-${nextWebhookId++}`,
    url: "https://example.com/webhook",
    description: "Test webhook",
    events: ["customer.created"],
    is_active: true,
    retry_enabled: true,
    max_retries: 3,
    timeout_seconds: 30,
    success_count: 0,
    failure_count: 0,
    last_triggered_at: null,
    last_success_at: null,
    last_failure_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    custom_metadata: {},
    ...overrides,
  };
}

export function createMockDelivery(
  subscriptionId: string,
  overrides: Partial<WebhookDelivery> = {},
): WebhookDelivery {
  return {
    id: `del-${nextDeliveryId++}`,
    subscription_id: subscriptionId,
    event_type: "customer.created",
    event_id: `evt-${nextDeliveryId}`,
    status: "success",
    response_code: 200,
    error_message: null,
    attempt_number: 1,
    duration_ms: 320,
    created_at: new Date().toISOString(),
    next_retry_at: null,
    response_status: 200,
    delivered_at: new Date().toISOString(),
    retry_count: 0,
    ...overrides,
  } as WebhookDelivery;
}

export function seedWebhookData(
  webhookData: WebhookSubscription[],
  deliveriesData: WebhookDelivery[],
) {
  webhookSubscriptions = [...webhookData];
  deliveries = [...deliveriesData];
}

const FALLBACK_BASE_URL = "http://localhost:3000";

const resolveRequestUrl = (request: Request) => {
  try {
    return new URL(request.url);
  } catch {
    return new URL(request.url, FALLBACK_BASE_URL);
  }
};

export const webhookHandlers = [
  http.get("*/webhooks/subscriptions", ({ request }) => {
    try {
      console.log(
        "[MSW:webhooks] subscriptions request",
        request.url,
        "count=",
        webhookSubscriptions.length,
      );
      const url = resolveRequestUrl(request);
      const offset = Number(url.searchParams.get("offset") || "0");
      const limit = Number(url.searchParams.get("limit") || "20");
      const eventFilter = url.searchParams.get("event_type");
      const activeOnly = url.searchParams.get("is_active") === "true";

      let items = [...webhookSubscriptions];

      if (eventFilter) {
        items = items.filter((wh) => wh.events.includes(eventFilter));
      }

      if (activeOnly) {
        items = items.filter((wh) => wh.is_active);
      }

      const result = items.slice(offset, offset + limit);
      console.log("[MSW:webhooks] responding with", result.length);
      return HttpResponse.json(result, { status: 200 });
    } catch (error) {
      console.error("[MSW:webhooks] subscriptions handler failed", error);
      return HttpResponse.json({ error: (error as Error).message }, { status: 500 });
    }
  }),

  http.get("*/webhooks/events", () => {
    try {
      console.log("[MSW:webhooks] events request");
      return HttpResponse.json({
        events: [
          { event_type: "customer.created", description: "Triggered when a customer is created" },
          { event_type: "customer.updated", description: "Triggered when a customer is updated" },
          { event_type: "subscription.paused", description: "Triggered when a subscription is paused" },
        ],
      }, { status: 200 });
    } catch (error) {
      console.error("[MSW:webhooks] events handler failed", error);
      return HttpResponse.json({ error: (error as Error).message }, { status: 500 });
    }
  }),

  http.post("*/webhooks/subscriptions", async ({ request }) => {
    try {
      const payload = (await request.json()) as WebhookSubscriptionCreate & {
        custom_metadata?: Record<string, unknown>;
      };
      const newWebhook = createMockWebhook({
        ...payload,
        id: payload?.id ?? `wh-${nextWebhookId++}`,
        custom_metadata: {
          ...payload.custom_metadata,
          name: (payload as any).name,
          headers: (payload as any).headers,
        },
      });

      webhookSubscriptions = [newWebhook, ...webhookSubscriptions];
      return HttpResponse.json(newWebhook, { status: 201 });
    } catch (error) {
      console.error("[MSW:webhooks] create handler failed", error);
      return HttpResponse.json({ error: (error as Error).message }, { status: 500 });
    }
  }),

  http.patch("*/webhooks/subscriptions/:id", async ({ request, params }) => {
    const { id } = params;
    const updates = (await request.json()) as WebhookSubscriptionUpdate;
    const index = webhookSubscriptions.findIndex((wh) => wh.id === id);

    if (index === -1) {
      return HttpResponse.json(
        { error: "Webhook subscription not found", code: "NOT_FOUND" },
        { status: 404 },
      );
    }

    webhookSubscriptions[index] = {
      ...webhookSubscriptions[index],
      ...updates,
      updated_at: new Date().toISOString(),
    } as WebhookSubscription;

    return HttpResponse.json(webhookSubscriptions[index]);
  }),

  http.delete("*/webhooks/subscriptions/:id", ({ params }) => {
    const { id } = params;
    const index = webhookSubscriptions.findIndex((wh) => wh.id === id);

    if (index === -1) {
      return HttpResponse.json(
        { error: "Webhook subscription not found", code: "NOT_FOUND" },
        { status: 404 },
      );
    }

    webhookSubscriptions.splice(index, 1);
    return new HttpResponse(null, { status: 204 });
  }),

  http.get("*/webhooks/subscriptions/:id/deliveries", ({ params, request }) => {
    try {
      console.log("[MSW:webhooks] deliveries request", request.url);
      const { id } = params;
      const url = resolveRequestUrl(request);
      const offset = Number(url.searchParams.get("offset") || "0");
      const limit = Number(url.searchParams.get("limit") || "50");
      const status = url.searchParams.get("status");

      let items = deliveries.filter((delivery) => delivery.subscription_id === id);
      if (status) {
        items = items.filter((delivery) => delivery.status === status);
      }

      const result = items.slice(offset, offset + limit);
      return HttpResponse.json(result, { status: 200 });
    } catch (error) {
      console.error("[MSW:webhooks] deliveries handler failed", error);
      return HttpResponse.json({ error: (error as Error).message }, { status: 500 });
    }
  }),

  http.post("*/webhooks/deliveries/:id/retry", ({ params }) => {
    const { id } = params;
    const delivery = deliveries.find((d) => d.id === id);

    if (!delivery) {
      return HttpResponse.json({ error: "Delivery not found", code: "NOT_FOUND" }, { status: 404 });
    }

    delivery.status = "retrying";
    delivery.attempt_number = (delivery.attempt_number || 1) + 1;
    delivery.next_retry_at = new Date(Date.now() + 60_000).toISOString();

    return HttpResponse.json(delivery, { status: 202 });
  }),
];
