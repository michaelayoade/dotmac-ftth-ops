import { FullConfig, chromium } from "@playwright/test";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";

const FRONTEND_ROOT = path.resolve(__dirname, "..");
const PNPM_CMD = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const SERVER_STATE_PATH = path.join(__dirname, ".server-state.json");
const AUTH_DIR = path.join(__dirname, ".auth");
const ISP_BASE_URL = process.env.ISP_OPS_URL || "http://localhost:3001";
const ADMIN_BASE_URL = process.env.PLATFORM_ADMIN_URL || "http://localhost:3002";
const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:8000";
const BOOT_TIMEOUT = parseInt(process.env.E2E_BOOT_TIMEOUT || "120000", 10);

type ServerInfo = {
  name: string;
  pid: number;
};

type UserProfile = {
  role: string;
  username: string;
  email: string;
  password: string;
  fullName: string;
  storageFile: string;
  baseUrl?: string;
};

const USER_PROFILES: UserProfile[] = [
  {
    role: "admin",
    username: process.env.E2E_ADMIN_USERNAME || "admin",
    email: process.env.E2E_ADMIN_EMAIL || "admin@test.com",
    password: process.env.E2E_ADMIN_PASSWORD || "admin123",
    fullName: "Test Admin",
    storageFile: "isp-admin.json",
  },
  {
    role: "user",
    username: process.env.E2E_USER_USERNAME || "regularuser",
    email: process.env.E2E_USER_EMAIL || "user@test.com",
    password: process.env.E2E_USER_PASSWORD || "admin123",
    fullName: "Test User",
    storageFile: "isp-user.json",
  },
  {
    role: "technician",
    username: process.env.E2E_TECHNICIAN_USERNAME || "technician",
    email: process.env.E2E_TECHNICIAN_EMAIL || "technician@dotmac.com",
    password: process.env.E2E_TECHNICIAN_PASSWORD || "tech123!",
    fullName: "Field Technician",
    storageFile: "isp-technician.json",
  },
  {
    role: "dispatcher",
    username: process.env.E2E_DISPATCHER_USERNAME || "dispatcher",
    email: process.env.E2E_DISPATCHER_EMAIL || "dispatcher@dotmac.com",
    password: process.env.E2E_DISPATCHER_PASSWORD || "dispatch123!",
    fullName: "Field Dispatcher",
    storageFile: "isp-dispatcher.json",
  },
  {
    role: "manager",
    username: process.env.E2E_MANAGER_USERNAME || "manager",
    email: process.env.E2E_MANAGER_EMAIL || "manager@dotmac.com",
    password: process.env.E2E_MANAGER_PASSWORD || "manager123!",
    fullName: "Field Manager",
    storageFile: "isp-manager.json",
  },
];

/**
 * Global setup for E2E tests
 * Builds production bundles, starts Next.js servers, and seeds test data.
 */
async function globalSetup(config: FullConfig) {
  console.log("🚀 Starting E2E test environment...");

  process.env.NODE_ENV = "test";
  process.env.DOTMAC_JWT_SECRET_KEY = "test-secret-key-for-e2e-tests";
  process.env.DOTMAC_REDIS_URL = "redis://localhost:6379/1";
  process.env.DATABASE_URL = "sqlite:///tmp/e2e_test.db";
  process.env.ISP_OPS_URL = ISP_BASE_URL;
  process.env.PLATFORM_ADMIN_URL = ADMIN_BASE_URL;

  await waitForService("http://localhost:8000/health", "Backend API", BOOT_TIMEOUT);

  if (process.env.E2E_SKIP_FRONTEND_BUILD === "true") {
    console.log("⏭  Skipping Next.js build (E2E_SKIP_FRONTEND_BUILD set)");
  } else {
    await buildNextApps();
  }

  const servers: ServerInfo[] = [];
  if (process.env.E2E_USE_DEV_SERVER === "true") {
    console.log("🟡 Using external dev servers (E2E_USE_DEV_SERVER=true)");
    if (fs.existsSync(SERVER_STATE_PATH)) {
      fs.rmSync(SERVER_STATE_PATH, { force: true });
    }
  } else {
    servers.push(startNextServer("@dotmac/isp-ops-app", "ISP Operations Frontend"));
    servers.push(startNextServer("@dotmac/platform-admin-app", "Platform Admin Frontend"));
    persistServerState(servers);
  }

  await waitForService(`${ISP_BASE_URL}/login`, "ISP Operations Frontend", BOOT_TIMEOUT);
  await waitForService(`${ADMIN_BASE_URL}/login`, "Platform Admin Frontend", BOOT_TIMEOUT);

  await createTestData();
  await prepareAuthStates();

  console.log("✅ E2E test environment ready");
}

/**
 * Wait for a service to become available
 */
async function waitForService(url: string, name: string, timeout = BOOT_TIMEOUT) {
  const start = Date.now();

  while (Date.now() - start < timeout) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        console.log(`✅ ${name} is ready at ${url}`);
        return;
      }
    } catch (error) {
      // Service not ready yet
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error(`❌ ${name} did not start within ${timeout}ms`);
}

/**
 * Build the production bundles for both Next.js apps
 */
async function buildNextApps() {
  console.log("🏗  Building Next.js applications for production tests...");
  await runPnpmCommand(["--filter", "@dotmac/isp-ops-app", "build"], "ISP Ops build");
  await runPnpmCommand(["--filter", "@dotmac/platform-admin-app", "build"], "Platform Admin build");
}

/**
 * Start a Next.js server via `pnpm --filter <app> start`
 */
function startNextServer(filter: string, label: string): ServerInfo {
  console.log(`▶  Starting ${label} (pnpm --filter ${filter} start)`);
  const child = spawn(PNPM_CMD, ["--filter", filter, "start"], {
    cwd: FRONTEND_ROOT,
    env: { ...process.env, NODE_ENV: "production" },
    stdio: "inherit",
  });

  child.on("exit", (code) => {
    console.log(`⚠️  ${label} exited with code ${code ?? "unknown"}`);
  });

  if (!child.pid) {
    throw new Error(`Failed to start ${label}`);
  }

  return { name: label, pid: child.pid };
}

function persistServerState(servers: ServerInfo[]) {
  fs.mkdirSync(path.dirname(SERVER_STATE_PATH), { recursive: true });
  fs.writeFileSync(SERVER_STATE_PATH, JSON.stringify(servers, null, 2));
}

async function runPnpmCommand(args: string[], label: string) {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(PNPM_CMD, args, {
      cwd: FRONTEND_ROOT,
      stdio: "inherit",
      env: process.env,
    });

    child.on("close", (code) => {
      if (code === 0) {
        console.log(`✅ ${label} completed`);
        resolve();
      } else {
        reject(new Error(`${label} failed with exit code ${code}`));
      }
    });
    child.on("error", (error) => reject(error));
  });
}

async function prepareAuthStates() {
  fs.mkdirSync(AUTH_DIR, { recursive: true });

  for (const profile of USER_PROFILES) {
    const statePath = path.join(AUTH_DIR, profile.storageFile);
    await createStorageState({
      baseUrl: profile.baseUrl || ISP_BASE_URL,
      username: profile.username,
      password: profile.password,
      statePath,
    });
  }
}

/**
 * Create test data via API calls
 */
async function createTestData() {
  for (const profile of USER_PROFILES) {
    await ensureTestUser(profile);
  }
  console.log("✅ Test accounts provisioned");
}

async function ensureTestUser(profile: UserProfile) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: profile.email,
        password: profile.password,
        username: profile.username,
        full_name: profile.fullName,
      }),
    });

    if (response.ok) {
      console.log(`✅ Test ${profile.role} user ensured (${profile.email})`);
      return;
    }

    if (response.status === 400 || response.status === 409 || response.status === 422) {
      const details = await response.text();
      console.log(`ℹ️  ${profile.role} user already present (${response.status} ${details})`);
      return;
    }

    const errorText = await response.text();
    console.log(`⚠️  Failed to create ${profile.role} user (${response.status} ${errorText})`);
  } catch (error: any) {
    console.log(`⚠️  Test user creation failed for ${profile.role}:`, error.message);
  }
}

type StorageStateInput = {
  baseUrl: string;
  username: string;
  password: string;
  statePath: string;
};

async function createStorageState({ baseUrl, username, password, statePath }: StorageStateInput) {
  console.log(`🔐 Generating storage state for ${username}@${baseUrl}`);
  const browser = await chromium.launch();

  try {
    const page = await browser.newPage();
    await page.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded", timeout: BOOT_TIMEOUT });
    await page.waitForFunction(() => (window as any).__e2e_login !== undefined, {
      timeout: BOOT_TIMEOUT,
    });
    await page.evaluate(
      ({ username, password }) => {
        return (window as any).__e2e_login(username, password);
      },
      { username, password },
    );
    await page.waitForURL(/dashboard/, { timeout: BOOT_TIMEOUT });
    await page.context().storageState({ path: statePath });
    console.log(`✅ Storage state saved to ${statePath}`);
  } catch (error: any) {
    console.log(`⚠️  Failed to generate storage state for ${baseUrl}:`, error.message);
  } finally {
    await browser.close();
  }
}

export default globalSetup;
