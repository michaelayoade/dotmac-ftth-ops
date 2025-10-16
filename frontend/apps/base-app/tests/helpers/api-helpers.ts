/**
 * API Helper Functions for Testing
 *
 * Functions to interact with the backend API during tests.
 */

import { Page, APIRequestContext, request } from '@playwright/test';
import type { TestServer, TestPeer, TestTemplate, TestUser } from '../fixtures/test-data';

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:8000';
const DEFAULT_TENANT = 'test-tenant';

// ==================== API Request Helper ====================

export async function apiRequest<T = any>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
  endpoint: string,
  data?: any,
  token?: string
): Promise<T> {
  const apiContext = await request.newContext({
    baseURL: API_BASE_URL,
    extraHTTPHeaders: {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
    },
  });

  let response;

  switch (method) {
    case 'GET':
      response = await apiContext.get(endpoint);
      break;
    case 'POST':
      response = await apiContext.post(endpoint, { data });
      break;
    case 'PUT':
      response = await apiContext.put(endpoint, { data });
      break;
    case 'DELETE':
      response = await apiContext.delete(endpoint);
      break;
    case 'PATCH':
      response = await apiContext.patch(endpoint, { data });
      break;
  }

  if (!response.ok()) {
    throw new Error(`API request failed: ${response.status()} ${response.statusText()}`);
  }

  return await response.json() as T;
}

// ==================== Authentication ====================

export async function loginUser(page: Page, email: string, password: string): Promise<string> {
  // Navigate to login page
  await page.goto('/login');

  // Fill credentials
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);

  // Submit
  await page.click('button[type="submit"]');

  // Wait for redirect
  await page.waitForURL('/dashboard', { timeout: 10000 });

  // Extract token from localStorage or cookie
  const token = await page.evaluate(() => {
    return localStorage.getItem('auth_token') || document.cookie;
  });

  return token;
}

export async function getAuthToken(page: Page): Promise<string | null> {
  return await page.evaluate(() => {
    return localStorage.getItem('auth_token');
  });
}

export async function createTestUser(userData: TestUser, apiContext?: APIRequestContext): Promise<any> {
  return await apiRequest('POST', '/api/v1/auth/register', userData);
}

// ==================== WireGuard API ====================

export async function createServer(serverData: TestServer, token?: string): Promise<any> {
  return await apiRequest('POST', '/api/v1/wireguard/servers', serverData, token);
}

export async function getServer(serverId: string, token?: string): Promise<any> {
  return await apiRequest('GET', `/api/v1/wireguard/servers/${serverId}`, undefined, token);
}

export async function updateServer(serverId: string, updates: Partial<TestServer>, token?: string): Promise<any> {
  return await apiRequest('PUT', `/api/v1/wireguard/servers/${serverId}`, updates, token);
}

export async function deleteServer(serverId: string, token?: string): Promise<void> {
  await apiRequest('DELETE', `/api/v1/wireguard/servers/${serverId}`, undefined, token);
}

export async function listServers(params: Record<string, any> = {}, token?: string): Promise<any> {
  const queryString = new URLSearchParams(params).toString();
  return await apiRequest('GET', `/api/v1/wireguard/servers?${queryString}`, undefined, token);
}

export async function createPeer(peerData: TestPeer, token?: string): Promise<any> {
  return await apiRequest('POST', '/api/v1/wireguard/peers', peerData, token);
}

export async function getPeer(peerId: string, token?: string): Promise<any> {
  return await apiRequest('GET', `/api/v1/wireguard/peers/${peerId}`, undefined, token);
}

export async function updatePeer(peerId: string, updates: Partial<TestPeer>, token?: string): Promise<any> {
  return await apiRequest('PUT', `/api/v1/wireguard/peers/${peerId}`, updates, token);
}

export async function deletePeer(peerId: string, token?: string): Promise<void> {
  await apiRequest('DELETE', `/api/v1/wireguard/peers/${peerId}`, undefined, token);
}

export async function listPeers(params: Record<string, any> = {}, token?: string): Promise<any> {
  const queryString = new URLSearchParams(params).toString();
  return await apiRequest('GET', `/api/v1/wireguard/peers?${queryString}`, undefined, token);
}

export async function provisionVPN(provisionData: any, token?: string): Promise<any> {
  return await apiRequest('POST', '/api/v1/wireguard/provision', provisionData, token);
}

// ==================== Communications API ====================

export async function sendEmail(emailData: any, token?: string): Promise<any> {
  return await apiRequest('POST', '/api/v1/communications/email/send', emailData, token);
}

export async function queueEmail(emailData: any, token?: string): Promise<any> {
  return await apiRequest('POST', '/api/v1/communications/email/queue', emailData, token);
}

export async function createTemplate(templateData: TestTemplate, token?: string): Promise<any> {
  return await apiRequest('POST', '/api/v1/communications/templates', templateData, token);
}

export async function getTemplate(templateId: string, token?: string): Promise<any> {
  return await apiRequest('GET', `/api/v1/communications/templates/${templateId}`, undefined, token);
}

export async function updateTemplate(templateId: string, updates: Partial<TestTemplate>, token?: string): Promise<any> {
  return await apiRequest('PUT', `/api/v1/communications/templates/${templateId}`, updates, token);
}

export async function deleteTemplate(templateId: string, token?: string): Promise<void> {
  await apiRequest('DELETE', `/api/v1/communications/templates/${templateId}`, undefined, token);
}

export async function listTemplates(params: Record<string, any> = {}, token?: string): Promise<any> {
  const queryString = new URLSearchParams(params).toString();
  return await apiRequest('GET', `/api/v1/communications/templates?${queryString}`, undefined, token);
}

export async function getCommunicationStats(params: Record<string, any> = {}, token?: string): Promise<any> {
  const queryString = new URLSearchParams(params).toString();
  return await apiRequest('GET', `/api/v1/communications/stats?${queryString}`, undefined, token);
}

export async function getCommunicationHealth(token?: string): Promise<any> {
  return await apiRequest('GET', '/api/v1/communications/health', undefined, token);
}

// ==================== Real-Time API ====================

export async function publishEvent(channel: string, event: any, token?: string): Promise<void> {
  // This would use a test endpoint to publish events
  await apiRequest('POST', `/api/v1/test/publish-event`, { channel, event }, token);
}

// ==================== Database Seeding ====================

export async function seedServers(servers: TestServer[], token?: string): Promise<any[]> {
  const createdServers = [];
  for (const server of servers) {
    const created = await createServer(server, token);
    createdServers.push(created);
  }
  return createdServers;
}

export async function seedPeers(serverId: string, peers: TestPeer[], token?: string): Promise<any[]> {
  const createdPeers = [];
  for (const peer of peers) {
    const created = await createPeer({ ...peer, server_id: serverId }, token);
    createdPeers.push(created);
  }
  return createdPeers;
}

export async function seedTemplates(templates: TestTemplate[], token?: string): Promise<any[]> {
  const createdTemplates = [];
  for (const template of templates) {
    const created = await createTemplate(template, token);
    createdTemplates.push(created);
  }
  return createdTemplates;
}

// ==================== Database Cleanup ====================

export async function cleanupServers(token?: string): Promise<void> {
  try {
    const servers = await listServers({}, token);
    for (const server of servers) {
      await deleteServer(server.id, token);
    }
  } catch (error) {
    console.error('Failed to cleanup servers:', error);
  }
}

export async function cleanupPeers(token?: string): Promise<void> {
  try {
    const peers = await listPeers({}, token);
    for (const peer of peers) {
      await deletePeer(peer.id, token);
    }
  } catch (error) {
    console.error('Failed to cleanup peers:', error);
  }
}

export async function cleanupTemplates(token?: string): Promise<void> {
  try {
    const response = await listTemplates({}, token);
    for (const template of response.templates) {
      await deleteTemplate(template.id, token);
    }
  } catch (error) {
    console.error('Failed to cleanup templates:', error);
  }
}

export async function cleanupAll(token?: string): Promise<void> {
  await Promise.all([
    cleanupPeers(token),
    cleanupServers(token),
    cleanupTemplates(token),
  ]);
}

// ==================== Mock Helpers ====================

export async function mockAPIResponse(page: Page, endpoint: string, response: any, status: number = 200): Promise<void> {
  await page.route(endpoint, route => {
    route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(response),
    });
  });
}

export async function mockAPIError(page: Page, endpoint: string, status: number = 500, error: any = {}): Promise<void> {
  await page.route(endpoint, route => {
    route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify({
        detail: error.detail || 'Internal Server Error',
        ...error,
      }),
    });
  });
}

export async function mockAPIDelay(page: Page, endpoint: string, delayMs: number): Promise<void> {
  await page.route(endpoint, async route => {
    await new Promise(resolve => setTimeout(resolve, delayMs));
    route.continue();
  });
}

// ==================== Wait Helpers ====================

export async function waitForAPICall(page: Page, endpoint: string): Promise<any> {
  const response = await page.waitForResponse(
    response => response.url().includes(endpoint) && response.status() === 200
  );
  return await response.json();
}

export async function waitForToast(page: Page, text?: string): Promise<void> {
  if (text) {
    await page.waitForSelector(`.toast:has-text("${text}")`, { timeout: 5000 });
  } else {
    await page.waitForSelector('.toast', { timeout: 5000 });
  }
}

export async function waitForElement(page: Page, selector: string, timeout: number = 5000): Promise<void> {
  await page.waitForSelector(selector, { timeout });
}
