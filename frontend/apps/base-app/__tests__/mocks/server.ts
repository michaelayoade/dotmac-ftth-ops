/**
 * MSW Server Setup for Tests
 * Provides a mock server for intercepting HTTP requests in tests
 */

import { setupServer } from "msw/node";
import { handlers } from "./handlers";

// Setup MSW server with default handlers
export const server = setupServer(...handlers);
