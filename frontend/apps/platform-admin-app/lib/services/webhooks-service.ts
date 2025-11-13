import { apiClient } from "../api/client";

export interface Webhook {
  id: string;
  url: string;
  events: string[];
  active: boolean;
  secret?: string;
}

export interface WebhookSubscriptionResponse {
  id: string;
  url: string;
  event_types: string[];
  is_active: boolean;
  success_rate: number;
  description?: string;
  created_at: string;
  updated_at: string;
}

export async function getWebhooks(): Promise<Webhook[]> {
  const response = await apiClient.get<Webhook[]>("/webhooks");
  return response.data;
}

export async function createWebhook(data: Partial<Webhook>): Promise<Webhook> {
  const response = await apiClient.post<Webhook>("/webhooks", data);
  return response.data;
}

export async function deleteWebhook(id: string): Promise<void> {
  await apiClient.delete(`/webhooks/${id}`);
}

export async function listSubscriptions(): Promise<WebhookSubscriptionResponse[]> {
  const response = await apiClient.get<WebhookSubscriptionResponse[]>("/webhooks/subscriptions");
  return response.data;
}

export async function createSubscription(data: {
  url: string;
  event_types: string[];
  is_active?: boolean;
}): Promise<WebhookSubscriptionResponse> {
  const response = await apiClient.post<WebhookSubscriptionResponse>(
    "/webhooks/subscriptions",
    data,
  );
  return response.data;
}

export async function pauseSubscription(id: string): Promise<void> {
  await apiClient.post(`/webhooks/subscriptions/${id}/pause`);
}

export async function activateSubscription(id: string): Promise<void> {
  await apiClient.post(`/webhooks/subscriptions/${id}/activate`);
}

export async function deleteSubscription(id: string): Promise<void> {
  await apiClient.delete(`/webhooks/subscriptions/${id}`);
}

export async function testWebhook(id: string): Promise<void> {
  await apiClient.post(`/webhooks/subscriptions/${id}/test`);
}

export function getActiveStatusColor(isActive: boolean): string {
  return isActive ? "bg-green-500" : "bg-gray-500";
}

export function formatSuccessRate(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}

export function needsAttention(webhook: WebhookSubscriptionResponse): boolean {
  return webhook.success_rate < 0.9;
}

export function getAvailableEventTypes(): string[] {
  return [
    "customer.created",
    "customer.updated",
    "subscription.created",
    "subscription.updated",
    "invoice.created",
    "invoice.paid",
    "payment.succeeded",
    "payment.failed",
  ];
}

export const webhooksService = {
  getWebhooks,
  createWebhook,
  deleteWebhook,
  listSubscriptions,
  createSubscription,
  pauseSubscription,
  activateSubscription,
  deleteSubscription,
  testWebhook,
  getActiveStatusColor,
  formatSuccessRate,
  needsAttention,
  getAvailableEventTypes,
};

export default webhooksService;
