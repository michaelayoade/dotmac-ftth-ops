/**
 * Mock Service Worker Browser Setup
 *
 * This file sets up MSW for browser-based API mocking during development.
 */

import { setupWorker } from "msw/browser";
import { handlers } from "./handlers";

export const worker = setupWorker(...handlers);
