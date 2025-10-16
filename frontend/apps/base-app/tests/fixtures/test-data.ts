/**
 * Test Data Factory Functions
 *
 * Factory functions to generate test data for all features.
 */

import type { Page } from '@playwright/test';

// ==================== Types ====================

export interface TestServer {
  id?: string;
  tenant_id?: string;
  name: string;
  location: string;
  endpoint: string;
  listen_port: number;
  subnet: string;
  dns_servers: string;
  max_peers: number;
  status?: 'active' | 'inactive' | 'degraded' | 'maintenance';
  peer_count?: number;
  traffic_rx?: number;
  traffic_tx?: number;
}

export interface TestPeer {
  id?: string;
  server_id: string;
  tenant_id?: string;
  peer_name: string;
  peer_ip?: string;
  allowed_ips: string;
  persistent_keepalive?: number;
  status?: 'active' | 'inactive' | 'disabled' | 'expired';
  expiration_date?: string;
  notes?: string;
}

export interface TestTemplate {
  id?: string;
  tenant_id?: string;
  name: string;
  description?: string;
  channel: 'email' | 'sms';
  subject?: string;
  body_html?: string;
  body_text?: string;
  is_active?: boolean;
  usage_count?: number;
}

export interface TestUser {
  email: string;
  password: string;
  tenant_id?: string;
  role?: string;
}

// ==================== WireGuard Fixtures ====================

export function generateTestServer(overrides: Partial<TestServer> = {}): TestServer {
  const id = overrides.id || `test-server-${Date.now()}`;

  return {
    name: `test-server-${Date.now()}`,
    location: 'US-East-1',
    endpoint: `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}:51820`,
    listen_port: 51820,
    subnet: `10.${Math.floor(Math.random() * 255)}.0.0/24`,
    dns_servers: '1.1.1.1, 8.8.8.8',
    max_peers: 100,
    status: 'active',
    peer_count: 0,
    traffic_rx: 0,
    traffic_tx: 0,
    ...overrides,
  };
}

export function generateTestPeer(serverId: string, overrides: Partial<TestPeer> = {}): TestPeer {
  return {
    server_id: serverId,
    peer_name: `test-peer-${Date.now()}`,
    allowed_ips: '0.0.0.0/0, ::/0',
    persistent_keepalive: 25,
    status: 'active',
    ...overrides,
  };
}

export function generateMultipleServers(count: number): TestServer[] {
  return Array.from({ length: count }, (_, i) =>
    generateTestServer({
      name: `test-server-${i + 1}`,
      peer_count: Math.floor(Math.random() * 20),
      traffic_rx: Math.floor(Math.random() * 10000000),
      traffic_tx: Math.floor(Math.random() * 5000000),
    })
  );
}

export function generateMultiplePeers(serverId: string, count: number): TestPeer[] {
  return Array.from({ length: count }, (_, i) =>
    generateTestPeer(serverId, {
      peer_name: `test-peer-${i + 1}`,
    })
  );
}

// ==================== Communications Fixtures ====================

export function generateTestTemplate(overrides: Partial<TestTemplate> = {}): TestTemplate {
  return {
    name: `test-template-${Date.now()}`,
    channel: 'email',
    subject: 'Test Subject {{ variable }}',
    body_text: 'Hello {{ name }}, this is a test email.',
    body_html: '<p>Hello {{ name }}, this is a test email.</p>',
    is_active: true,
    usage_count: 0,
    ...overrides,
  };
}

export function generateMultipleTemplates(count: number): TestTemplate[] {
  return Array.from({ length: count }, (_, i) =>
    generateTestTemplate({
      name: `template-${i + 1}`,
      usage_count: Math.floor(Math.random() * 100),
    })
  );
}

export interface TestEmail {
  to: string;
  subject: string;
  body_text?: string;
  body_html?: string;
  template_id?: string;
  variables?: Record<string, any>;
}

export function generateTestEmail(overrides: Partial<TestEmail> = {}): TestEmail {
  return {
    to: 'test@example.com',
    subject: 'Test Email',
    body_text: 'This is a test email message.',
    ...overrides,
  };
}

// ==================== User Fixtures ====================

export function generateTestUser(overrides: Partial<TestUser> = {}): TestUser {
  const timestamp = Date.now();
  return {
    email: `testuser${timestamp}@example.com`,
    password: 'Test123!@#',
    tenant_id: 'test-tenant',
    role: 'admin',
    ...overrides,
  };
}

export function generateMultipleUsers(count: number, tenantId?: string): TestUser[] {
  return Array.from({ length: count }, (_, i) =>
    generateTestUser({
      email: `testuser${i + 1}@example.com`,
      tenant_id: tenantId || `tenant-${i + 1}`,
    })
  );
}

// ==================== Statistics Fixtures ====================

export interface TestStats {
  total_sent: number;
  total_delivered: number;
  total_failed: number;
  total_opened: number;
  total_clicked: number;
  delivery_rate: number;
  open_rate: number;
  click_rate: number;
}

export function generateTestStats(overrides: Partial<TestStats> = {}): TestStats {
  const total_sent = overrides.total_sent || 1000;
  const total_delivered = overrides.total_delivered || Math.floor(total_sent * 0.95);
  const total_opened = overrides.total_opened || Math.floor(total_delivered * 0.6);
  const total_clicked = overrides.total_clicked || Math.floor(total_opened * 0.3);

  return {
    total_sent,
    total_delivered,
    total_failed: total_sent - total_delivered,
    total_opened,
    total_clicked,
    delivery_rate: total_delivered / total_sent,
    open_rate: total_opened / total_delivered,
    click_rate: total_clicked / total_opened,
    ...overrides,
  };
}

// ==================== Real-Time Event Fixtures ====================

export interface TestAlertEvent {
  event_type: 'alert.raised' | 'alert.cleared';
  tenant_id: string;
  alert_id: string;
  alert_type: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  source: string;
  message: string;
  timestamp?: string;
}

export function generateAlertEvent(overrides: Partial<TestAlertEvent> = {}): TestAlertEvent {
  return {
    event_type: 'alert.raised',
    tenant_id: 'test-tenant',
    alert_id: `alert-${Date.now()}`,
    alert_type: 'test',
    severity: 'warning',
    source: 'test-source',
    message: 'Test alert message',
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

export interface TestSessionEvent {
  event_type: 'session.started' | 'session.stopped' | 'session.update';
  tenant_id: string;
  session_id: string;
  username?: string;
  nas_ip?: string;
  framed_ip?: string;
  acct_input_octets?: number;
  acct_output_octets?: number;
  timestamp?: string;
}

export function generateSessionEvent(overrides: Partial<TestSessionEvent> = {}): TestSessionEvent {
  return {
    event_type: 'session.started',
    tenant_id: 'test-tenant',
    session_id: `session-${Date.now()}`,
    username: 'testuser@isp',
    nas_ip: '10.0.0.1',
    framed_ip: '100.64.1.5',
    acct_input_octets: 0,
    acct_output_octets: 0,
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

// ==================== Bulk Data Generation ====================

export interface BulkTestData {
  servers: TestServer[];
  peers: TestPeer[];
  templates: TestTemplate[];
  users: TestUser[];
}

export function generateBulkTestData(): BulkTestData {
  const servers = generateMultipleServers(3);
  const peers = servers.flatMap(server =>
    generateMultiplePeers(server.name, 5)
  );
  const templates = generateMultipleTemplates(5);
  const users = generateMultipleUsers(3);

  return {
    servers,
    peers,
    templates,
    users,
  };
}

// ==================== Helper Functions ====================

export function randomString(length: number = 10): string {
  return Math.random().toString(36).substring(2, length + 2);
}

export function randomEmail(): string {
  return `test${randomString()}@example.com`;
}

export function randomPort(): number {
  return Math.floor(Math.random() * (65535 - 1024) + 1024);
}

export function randomIPv4(): string {
  return `${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
}

export function randomSubnet(): string {
  return `10.${Math.floor(Math.random() * 255)}.0.0/24`;
}

export function waitForSeconds(seconds: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, seconds * 1000));
}
