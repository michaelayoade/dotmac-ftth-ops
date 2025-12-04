/**
 * MSW Handlers for Webhook API Endpoints
 *
 * These handlers intercept webhook-related API calls during tests,
 * providing realistic responses without hitting a real server.
 */

import { http, HttpResponse } from "msw";
import type {
  WebhookSubscription,
  WebhookDelivery,
  WebhookSubscriptionCreate,
  WebhookSubscriptionUpdate,
  WebhookTestResult,
  AvailableEvents,
} from "../../../hooks/useWebhooks";

// In-memory storage for test data
let webhookSubscriptions: WebhookSubscription[] = [];
let deliveries: WebhookDelivery[] = [];
let nextWebhookId = 1;
let nextDeliveryId = 1;

// Reset storage between tests
export function resetWebhookStorage() {
  webhookSubscriptions = [];
  deliveries = [];
  nextWebhookId = 1;
  nextDeliveryId = 1;
}

// Helper to create a webhook subscription
export function createMockWebhook(overrides?: Partial<WebhookSubscription>): WebhookSubscription {
  return {
    id: `wh-${nextWebhookId++}`,
    url: "https://example.com/webhook",
    description: "Test webhook",
    events: ["subscriber.created"],
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

// Helper to create a webhook delivery
export function createMockDelivery(
  subscriptionId: string,
  overrides?: Partial<WebhookDelivery>,
): WebhookDelivery {
  const timestamp = new Date().toISOString();

  return {
    id: `del-${nextDeliveryId++}`,
    subscription_id: subscriptionId,
    event_type: "subscriber.created",
    event_id: `evt-${nextDeliveryId}`,
    status: "success",
    response_code: 200,
    error_message: null,
    attempt_number: 1,
    duration_ms: 320,
    created_at: timestamp,
    next_retry_at: null,
    response_body: "OK",
    ...overrides,
  };
}

// Helper to seed initial data
export function seedWebhookData(
  webhooks: WebhookSubscription[],
  deliveriesData: WebhookDelivery[],
) {
  webhookSubscriptions = [...webhooks];
  deliveries = [...deliveriesData];
}

export const webhookHandlers = [
  // GET /api/v1/webhooks/subscriptions - List webhook subscriptions
  http.get("*/api/v1/webhooks/subscriptions", ({ request, params }) => {
    const url = new URL(request.url);
    const offset = parseInt(url.searchParams.get("offset") || "0");
    const limit = parseInt(url.searchParams.get("limit") || "20");
    const event = url.searchParams.get("event_type");

    console.log("[MSW] GET /api/v1/webhooks/subscriptions", {
      offset,
      limit,
      event,
      totalWebhooks: webhookSubscriptions.length,
    });

    let filtered = webhookSubscriptions;
    if (event) {
      filtered = webhookSubscriptions.filter((wh) => wh.events.includes(event));
    }

    const start = offset;
    const end = offset + limit;
    const paginated = filtered.slice(start, end);

    console.log("[MSW] Returning", paginated.length, "webhooks");

    // Hook expects response.data to be the array directly
    return HttpResponse.json(paginated);
  }),

  // GET /api/v1/webhooks/subscriptions/:id/deliveries - Get webhook deliveries
  http.get("*/api/v1/webhooks/subscriptions/:id/deliveries", ({ request, params }) => {
    const { id } = params;
    const url = new URL(request.url);
    const offset = parseInt(url.searchParams.get("offset") || "0");
    const limit = parseInt(url.searchParams.get("limit") || "20");
    const status = url.searchParams.get("status");

    let filtered = deliveries.filter((d) => d.subscription_id === id);
    if (status) {
      filtered = filtered.filter((d) => d.status === status);
    }

    const start = offset;
    const end = offset + limit;
    const paginated = filtered.slice(start, end);

    // Hook expects response.data to be the array directly
    return HttpResponse.json(paginated);
  }),

  // GET /api/v1/webhooks/events - Get available webhook events
  http.get("*/api/v1/webhooks/events", ({ request, params }) => {
    return HttpResponse.json({
      events: [
        { event_type: "subscriber.created", description: "Triggered when a subscriber is created" },
        { event_type: "subscriber.updated", description: "Triggered when a subscriber is updated" },
        { event_type: "subscriber.deleted", description: "Triggered when a subscriber is deleted" },
      ],
    });
  }),

  // POST /api/v1/webhooks/subscriptions - Create webhook subscription
  http.post("*/api/v1/webhooks/subscriptions", async ({ request, params }) => {
    const data = (await request.json()) as Partial<WebhookSubscription>;

    const newWebhook = createMockWebhook({
      ...data,
      id: `wh-${nextWebhookId}`,
    });

    webhookSubscriptions.push(newWebhook);

    return HttpResponse.json(newWebhook, { status: 201 });
  }),

  // PATCH /api/v1/webhooks/subscriptions/:id - Update webhook subscription
  http.patch("*/api/v1/webhooks/subscriptions/:id", async ({ request, params }) => {
    const { id } = params;
    const updates = (await request.json()) as Partial<WebhookSubscription>;

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
    };

    return HttpResponse.json(webhookSubscriptions[index]);
  }),

  // DELETE /api/v1/webhooks/subscriptions/:id - Delete webhook subscription
  http.delete("*/api/v1/webhooks/subscriptions/:id", ({ request, params }) => {
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

  // POST /api/v1/webhooks/deliveries/:id/retry - Retry webhook delivery
  http.post("*/api/v1/webhooks/deliveries/:id/retry", ({ request, params }) => {
    const { id } = params;

    const delivery = deliveries.find((d) => d.id === id);

    if (!delivery) {
      return HttpResponse.json({ error: "Delivery not found", code: "NOT_FOUND" }, { status: 404 });
    }

    // Update delivery status to retrying
    delivery.status = "retrying";
    delivery.attempt_number = (delivery.attempt_number || 1) + 1;
    delivery.next_retry_at = new Date(Date.now() + 60000).toISOString(); // Retry in 1 minute

    return HttpResponse.json(delivery, { status: 202 });
  }),
];
