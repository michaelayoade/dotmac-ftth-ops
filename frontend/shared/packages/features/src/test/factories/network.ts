/**
 * Test data factories for network module
 */

let onuCounter = 1;
let oltCounter = 1;

/**
 * Create a mock ONU (Optical Network Unit)
 */
export const createMockONU = (overrides?: Partial<any>) => {
  const id = onuCounter++;
  return {
    onu_id: `onu_${id}`,
    serial_number: `ALCL${String(id).padStart(8, "0")}`,
    mac_address: `00:11:22:33:44:${String(id).padStart(2, "0")}`,
    model: "ALCATEL-LUCENT-I240WQ",
    vendor: "ALCATEL-LUCENT",
    status: "online",
    operational_state: "enabled",
    subscriber_id: `sub_${id}`,
    olt_id: "olt_1",
    pon_port: "1/1/1",
    onu_index: id,
    distance: 1250, // meters
    signal_level: -21.5, // dBm
    upstream_bandwidth: 1000, // Mbps
    downstream_bandwidth: 1000, // Mbps
    last_seen: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
};

/**
 * Create an offline ONU
 */
export const createOfflineONU = (overrides?: Partial<any>) => {
  return createMockONU({
    status: "offline",
    operational_state: "disabled",
    last_seen: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
    ...overrides,
  });
};

/**
 * Create an ONU with poor signal
 */
export const createPoorSignalONU = (overrides?: Partial<any>) => {
  return createMockONU({
    status: "online",
    signal_level: -28.5, // Poor signal
    ...overrides,
  });
};

/**
 * Create multiple ONUs for list testing
 */
export const createMockONUs = (count: number = 5) => {
  return Array.from({ length: count }, (_, i) =>
    createMockONU({
      onu_id: `onu_${i + 1}`,
      serial_number: `ALCL${String(i + 1).padStart(8, "0")}`,
    }),
  );
};

/**
 * Create a mock OLT (Optical Line Terminal)
 */
export const createMockOLT = (overrides?: Partial<any>) => {
  const id = oltCounter++;
  return {
    olt_id: `olt_${id}`,
    name: `OLT-${id}`,
    ip_address: `192.168.1.${id}`,
    model: "HUAWEI-MA5800",
    vendor: "HUAWEI",
    status: "online",
    location: "Central Office",
    total_ports: 16,
    active_ports: 12,
    total_onus: 480,
    online_onus: 432,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
};

/**
 * Create a mock PON port
 */
export const createMockPONPort = (overrides?: Partial<any>) => {
  return {
    port_id: "port_1",
    name: "1/1/1",
    olt_id: "olt_1",
    status: "online",
    type: "GPON",
    max_distance: 20000, // meters
    total_onus: 32,
    online_onus: 28,
    splitter_ratio: "1:32",
    ...overrides,
  };
};

/**
 * Create a mock network device
 */
export const createMockNetworkDevice = (overrides?: Partial<any>) => {
  return {
    device_id: "dev_1",
    name: "Core-Switch-1",
    type: "switch",
    ip_address: "10.0.0.1",
    status: "online",
    location: "Data Center",
    model: "Cisco Catalyst 9300",
    vendor: "Cisco",
    uptime: 864000, // seconds
    cpu_usage: 35, // percent
    memory_usage: 42, // percent
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
};

/**
 * Create a mock subscriber network profile
 */
export const createMockNetworkProfile = (overrides?: Partial<any>) => {
  return {
    profile_id: "profile_1",
    name: "Residential 500Mbps",
    upstream_bandwidth: 500,
    downstream_bandwidth: 500,
    traffic_shaping: "enabled",
    qos_profile: "residential",
    vlan_id: 100,
    ip_assignment: "dhcp",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
};

/**
 * Create a mock NAS Device
 */
export const createMockNASDevice = (overrides?: Partial<any>) => {
  return {
    id: 1,
    nasname: "192.168.1.10",
    shortname: "OLT-CORE-01",
    type: "olt",
    secret: "radiussecret123",
    server: "radius-1",
    community: "public",
    description: "Primary OLT",
    secret_configured: true,
    ...overrides,
  };
};

/**
 * Create a mock Router
 */
export const createMockRouter = (overrides?: Partial<any>) => {
  return createMockNASDevice({
    type: "router",
    shortname: "Router-01",
    ...overrides,
  });
};

/**
 * Create a mock Bandwidth Profile
 */
export const createMockBandwidthProfile = (overrides?: Partial<any>) => {
  return {
    id: 1,
    name: "Business 200Mbps",
    download_rate: 200000, // Kbps
    upload_rate: 100000, // Kbps
    download_burst: 0,
    upload_burst: 0,
    ...overrides,
  };
};

/**
 * Create a basic profile
 */
export const createBasicProfile = (overrides?: Partial<any>) => {
  return createMockBandwidthProfile({
    name: "Basic 50Mbps",
    download_rate: 50000,
    upload_rate: 10000,
    ...overrides,
  });
};

/**
 * Create a high speed profile
 */
export const createHighSpeedProfile = (overrides?: Partial<any>) => {
  return createMockBandwidthProfile({
    name: "Gigabit",
    download_rate: 1000000,
    upload_rate: 1000000,
    ...overrides,
  });
};

/**
 * Create a mock RADIUS Session
 */
export const createMockRADIUSSession = (overrides?: Partial<any>) => {
  const now = new Date();
  const startTime = new Date(now.getTime() - 3600 * 1000); // 1 hour ago
  const input = overrides?.acctinputoctets ?? 1000000;
  const output = overrides?.acctoutputoctets ?? 500000;

  return {
    radacctid: `session_${Math.random().toString(36).substr(2, 9)}`,
    acctsessionid: `sess_${Math.random().toString(36).substr(2, 9)}`,
    acctuniqueid: `unique_${Math.random().toString(36).substr(2, 9)}`,
    username: "customer@isp.com",
    groupname: "residential",
    realm: "isp.com",
    nasipaddress: "192.168.1.10",
    nasportid: "port_1",
    nasporttype: "Ethernet",
    acctstarttime: startTime.toISOString(),
    acctupdatetime: now.toISOString(),
    acctstoptime: null,
    acctinterval: 300,
    acctsessiontime: 3600,
    acctauthentic: "RADIUS",
    connectinfo_start: "CONNECT 1000Mbps",
    connectinfo_stop: "",
    acctinputoctets: input,
    acctoutputoctets: output,
    calledstationid: "00-11-22-33-44-55",
    callingstationid: "AA-BB-CC-DD-EE-FF",
    acctterminatecause: null,
    servicetype: "Framed-User",
    framedprotocol: "PPP",
    framedipaddress: "10.0.0.100",
    is_active: true,
    total_bytes: input + output,
    ...overrides,
  };
};

/**
 * Create a terminated RADIUS Session
 */
export const createTerminatedRADIUSSession = (overrides?: Partial<any>) => {
  const now = new Date();
  const startTime = new Date(now.getTime() - 7200 * 1000); // 2 hours ago

  return createMockRADIUSSession({
    is_active: false,
    acctstarttime: startTime.toISOString(),
    acctstoptime: now.toISOString(),
    acctsessiontime: 7200,
    acctterminatecause: "User-Request",
    ...overrides,
  });
};

/**
 * Reset counters (useful between test suites)
 */
export const resetNetworkCounters = () => {
  onuCounter = 1;
  oltCounter = 1;
};
