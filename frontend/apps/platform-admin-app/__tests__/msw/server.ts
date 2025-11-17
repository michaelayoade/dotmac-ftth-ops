import { readdirSync } from "node:fs";
import path from "node:path";
import type { RequestHandler } from "msw";
import { setupServer } from "msw/node";
import { webhookHandlers } from "./handlers/webhooks";

interface HandlerGroup {
  id: string;
  handlers: RequestHandler[];
}

const handlerGroups: HandlerGroup[] = [{ id: "webhooks", handlers: webhookHandlers }];

export const handlers = handlerGroups.flatMap((group) => group.handlers);

if (shouldValidateHandlers()) {
  validateHandlerRegistration(handlerGroups);
}

export const server = setupServer(...handlers);

export function resetServerHandlers() {
  server.resetHandlers();
}

export function addRuntimeHandler(...newHandlers: RequestHandler[]) {
  newHandlers.forEach((handler) => server.use(handler));
}

function shouldValidateHandlers() {
  return process.env.MSW_SKIP_HANDLER_VALIDATION !== "true";
}

function validateHandlerRegistration(groups: HandlerGroup[]) {
  try {
    const handlersDir = path.resolve(__dirname, "handlers");
    const discovered = readdirSync(handlersDir)
      .filter((file) => /\.(ts|tsx|js|cjs|mjs)$/.test(file))
      .map((file) => file.replace(/\.(ts|tsx|js|cjs|mjs)$/, ""));
    const registered = new Set(groups.map((group) => group.id));

    const missing = discovered.filter((name) => !registered.has(name));
    if (missing.length > 0) {
      throw new Error(`MSW missing handler registrations: ${missing.join(", ")}`);
    }

    const obsolete = groups.map((group) => group.id).filter((name) => !discovered.includes(name));
    if (obsolete.length > 0) {
      console.warn(
        `[MSW] Handler registrations without corresponding files: ${obsolete.join(", ")}`,
      );
    }
  } catch (error) {
    console.error(
      `[MSW] Handler registration validation failed: ${
        error instanceof Error ? error.message : error
      }`,
    );
    throw error;
  }
}
