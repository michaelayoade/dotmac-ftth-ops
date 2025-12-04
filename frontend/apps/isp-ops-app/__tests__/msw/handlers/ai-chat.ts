/**
 * MSW Handlers for AI Chat API
 * Mocks AI chat functionality including sessions, messages, and feedback
 */

import { http, HttpResponse, delay } from "msw";

// In-memory storage
let sessions: any[] = [];
let messages: Map<number, any[]> = new Map();
let nextSessionId = 1;

// Configurable delay for testing loading states (default 50ms)
const API_DELAY = parseInt(process.env.MSW_API_DELAY || "50");

// Factory functions
function createMockSession(data: Partial<any> = {}): any {
  const now = new Date().toISOString();
  return {
    id: data.id || nextSessionId++,
    session_type: data.session_type || "admin_assistant",
    status: data.status || "active",
    provider: data.provider || "openai",
    created_at: data.created_at || now,
    message_count: data.message_count || 0,
    total_tokens: data.total_tokens || 0,
    total_cost: data.total_cost || 0,
    user_rating: data.user_rating,
    user_feedback: data.user_feedback,
    escalation_reason: data.escalation_reason,
    escalated_at: data.escalated_at,
    ...data,
  };
}

function createMockMessage(data: Partial<any> = {}): any {
  const now = new Date().toISOString();
  return {
    role: data.role || "user",
    content: data.content || "Message content",
    created_at: data.created_at || now,
    tokens: data.tokens,
    ...data,
  };
}

// Seed functions
export function seedSessions(sessionsList: Partial<any>[]): void {
  sessions = sessionsList.map((s) => {
    const session = createMockSession(s);
    if (typeof s.id === "number" && s.id >= nextSessionId) {
      nextSessionId = s.id + 1;
    }
    return session;
  });
}

export function seedMessages(sessionId: number, messagesList: Partial<any>[]): void {
  messages.set(sessionId, messagesList.map(createMockMessage));
}

export function clearAIChatData(): void {
  sessions = [];
  messages.clear();
  nextSessionId = 1;
}

// Legacy function for backward compatibility
export function seedAIChatData(initialSessions: any[]): void {
  seedSessions(initialSessions);
}

export const aiChatHandlers = [
  // POST /api/v1/ai/chat - Send a message
  http.post("*/api/v1/ai/chat", async (req) => {
    // Add delay to simulate network latency (makes loading states testable)
    await delay(API_DELAY);

    const body = await req.json<{ message: string; session_id?: number; context?: any }>();

    if (!body.message || body.message.trim() === "") {
      return HttpResponse.json({ detail: "Message cannot be empty" }, { status: 400 });
    }

    let sessionId = body.session_id;

    // Create new session if none provided
    if (!sessionId) {
      const newSession = createMockSession({
        session_type: "admin_assistant",
        status: "active",
        message_count: 1,
        total_tokens: 150,
        total_cost: 0.01,
      });
      sessionId = newSession.id;
      sessions.push(newSession);
      messages.set(sessionId, []);
    } else {
      // Update existing session
      const session = sessions.find((s) => s.id === sessionId);
      if (session) {
        session.message_count += 1;
        session.total_tokens += 150;
        session.total_cost += 0.01;
      }
    }

    // Add user message to history
    const sessionMessages = messages.get(sessionId) || [];
    sessionMessages.push(
      createMockMessage({
        role: "user",
        content: body.message,
      }),
    );

    // Add AI response
    const aiResponse = createMockMessage({
      role: "assistant",
      content: `AI response to: ${body.message}`,
      tokens: 50,
    });
    sessionMessages.push(aiResponse);
    messages.set(sessionId, sessionMessages);

    return HttpResponse.json({
      session_id: sessionId,
      message: aiResponse.content,
      role: "assistant",
      metadata: { tokens: 50, cost_cents: 1 },
    });
  }),

  // POST /api/v1/ai/sessions - Create a session
  http.post("*/api/v1/ai/sessions", async (req) => {
    // Add delay to simulate network latency (makes loading states testable)
    await delay(API_DELAY);

    const body = await req.json<{ session_type?: string; context?: any; customer_id?: number }>();

    const newSession = createMockSession({
      session_type: body.session_type || "admin_assistant",
      status: "active",
      message_count: 0,
      total_tokens: 0,
      total_cost: 0,
    });

    sessions.push(newSession);
    messages.set(newSession.id, []);

    return HttpResponse.json(newSession);
  }),

  // GET /api/v1/ai/sessions/:id/history - Get chat history
  http.get("*/api/v1/ai/sessions/:id/history", ({ params }) => {
    const id = params.id as string;
    const sessionId = parseInt(id as string);

    if (isNaN(sessionId)) {
      return HttpResponse.json({ detail: "Invalid session ID" }, { status: 400 });
    }

    const session = sessions.find((s) => s.id === sessionId);
    if (!session) {
      return HttpResponse.json({ detail: "Session not found" }, { status: 404 });
    }

    const sessionMessages = messages.get(sessionId) || [];

    return HttpResponse.json({
      session_id: sessionId,
      messages: sessionMessages,
    });
  }),

  // GET /api/v1/ai/sessions/my - Get user's sessions
  http.get("*/api/v1/ai/sessions/my", ({ request }) => {
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get("limit") || "20");

    const limitedSessions = sessions.slice(0, limit);

    return HttpResponse.json(limitedSessions);
  }),

  // POST /api/v1/ai/sessions/:id/feedback - Submit feedback
  http.post("*/api/v1/ai/sessions/:id/feedback", async (req) => {
    // Add delay to simulate network latency (makes loading states testable)
    await delay(API_DELAY);

    const { id } = req.params;
    const sessionId = parseInt(id as string);
    const body = await req.json<{ session_id: number; rating: number; feedback?: string }>();

    if (isNaN(sessionId)) {
      return HttpResponse.json({ detail: "Invalid session ID" }, { status: 400 });
    }

    const session = sessions.find((s) => s.id === sessionId);
    if (!session) {
      return HttpResponse.json({ detail: "Session not found" }, { status: 404 });
    }

    if (typeof body.rating !== "number" || body.rating < 1 || body.rating > 5) {
      return HttpResponse.json({ detail: "Rating must be between 1 and 5" }, { status: 400 });
    }

    session.user_rating = body.rating;
    if (body.feedback) {
      session.user_feedback = body.feedback;
    }

    return HttpResponse.json(session);
  }),

  // POST /api/v1/ai/sessions/:id/escalate - Escalate to human
  http.post("*/api/v1/ai/sessions/:id/escalate", async (req) => {
    // Add delay to simulate network latency (makes loading states testable)
    await delay(API_DELAY);

    const { id } = req.params;
    const sessionId = parseInt(id as string);
    const body = await req.json<{ session_id: number; reason: string }>();

    if (isNaN(sessionId)) {
      return HttpResponse.json({ detail: "Invalid session ID" }, { status: 400 });
    }

    const session = sessions.find((s) => s.id === sessionId);
    if (!session) {
      return HttpResponse.json({ detail: "Session not found" }, { status: 404 });
    }

    if (!body.reason || body.reason.trim() === "") {
      return HttpResponse.json({ detail: "Escalation reason is required" }, { status: 400 });
    }

    session.status = "escalated";
    session.escalation_reason = body.reason;
    session.escalated_at = new Date().toISOString();

    return HttpResponse.json(session);
  }),
];
