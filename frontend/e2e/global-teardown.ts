import { FullConfig } from "@playwright/test";
import fs from "fs";
import path from "path";

const SERVER_STATE_PATH = path.join(__dirname, ".server-state.json");

/**
 * Global teardown for E2E tests
 * Cleans up test environment and data
 */
async function globalTeardown(config: FullConfig) {
  console.log("🧹 Cleaning up E2E test environment...");

  try {
    await stopFrontendServers();
    // Clean up test database
    await cleanupTestData();

    // Additional cleanup if needed
    // e.g., remove uploaded files, clear cache, etc.

    console.log("✅ E2E test environment cleaned up");
  } catch (error) {
    console.log("⚠️  Cleanup failed:", error.message);
  }
}

/**
 * Clean up test data
 */
async function cleanupTestData() {
  const baseUrl = "http://localhost:8000";

  try {
    // Login as admin to get token for cleanup
    const loginResponse = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "admin@test.com",
        password: "Test123!@#",
      }),
    });

    if (loginResponse.ok) {
      const { access_token } = await loginResponse.json();

      // Clean up API keys
      const apiKeysResponse = await fetch(`${baseUrl}/auth/api-keys`, {
        headers: { Authorization: `Bearer ${access_token}` },
      });

      if (apiKeysResponse.ok) {
        const apiKeys = await apiKeysResponse.json();
        for (const key of apiKeys) {
          if (key.name === "E2E Test API Key") {
            await fetch(`${baseUrl}/auth/api-keys/${key.id}`, {
              method: "DELETE",
              headers: { Authorization: `Bearer ${access_token}` },
            });
          }
        }
      }

      // Clean up test users (optional - depends on your cleanup strategy)
      // You might want to keep them for subsequent test runs
      console.log("✅ Test data cleaned up");
    }
  } catch (error) {
    console.log("⚠️  Test data cleanup failed:", error.message);
  }
}

type ServerInfo = {
  name: string;
  pid: number;
};

async function stopFrontendServers() {
  if (!fs.existsSync(SERVER_STATE_PATH)) {
    return;
  }

  const data = JSON.parse(fs.readFileSync(SERVER_STATE_PATH, "utf-8")) as ServerInfo[];
  for (const server of data) {
    if (!server?.pid) continue;
    try {
      process.kill(server.pid);
      console.log(`🛑 Stopped ${server.name} (pid ${server.pid})`);
    } catch (error: any) {
      console.log(`⚠️  Failed to stop ${server.name}:`, error.message);
    }
  }

  fs.rmSync(SERVER_STATE_PATH, { force: true });
}

export default globalTeardown;
