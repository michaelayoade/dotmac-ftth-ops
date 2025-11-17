/**
 * MSW Tests for useAIChat hook
 * Tests AI chat functionality with realistic API mocking
 */

// Mock platformConfig to provide a base URL for MSW to intercept
jest.mock("@/lib/config", () => ({
  platformConfig: {
    api: {
      baseUrl: "http://localhost:3000",
      prefix: "/api/v1",
      timeout: 30000,
      buildUrl: (path: string) => `http://localhost:3000/api/v1${path}`,
      graphqlEndpoint: "http://localhost:3000/api/v1/graphql",
    },
  },
}));

import { renderHook, waitFor, act } from "@testing-library/react";
import { createQueryWrapper } from "@/__tests__/test-utils";
import { useAIChat } from "../useAIChat";
import {
  seedSessions,
  seedMessages,
  clearAIChatData,
} from "@/__tests__/msw/handlers/ai-chat";

// Mock useToast
jest.mock("@dotmac/ui", () => ({
  ...jest.requireActual("@dotmac/ui"),
  useToast: () => ({
    toast: jest.fn(),
  }),
}));

describe("useAIChat", () => {
  beforeEach(() => {
    clearAIChatData();
  });

  describe("Query Hooks - Sessions", () => {
    describe("sessions query", () => {
      it("should fetch user sessions successfully", async () => {
        seedSessions([
          {
            id: 1,
            session_type: "customer_support",
            status: "active",
            provider: "openai",
            message_count: 5,
            total_tokens: 500,
            total_cost: 0.05,
          },
          {
            id: 2,
            session_type: "admin_assistant",
            status: "active",
            provider: "openai",
            message_count: 3,
            total_tokens: 300,
            total_cost: 0.03,
          },
        ]);

        const { result } = renderHook(() => useAIChat(), {
          wrapper: createQueryWrapper(),
        });

        await waitFor(() => expect(result.current.sessions.length).toBeGreaterThan(0));

        expect(result.current.sessions).toHaveLength(2);
        expect(result.current.sessions[0].session_type).toBe("customer_support");
        expect(result.current.sessions[1].session_type).toBe("admin_assistant");
      });

      it("should return empty array when no sessions exist", async () => {
        const { result } = renderHook(() => useAIChat(), {
          wrapper: createQueryWrapper(),
        });

        await waitFor(() => expect(result.current.sessions).toBeDefined());

        expect(result.current.sessions).toHaveLength(0);
      });

      it("should respect limit parameter", async () => {
        seedSessions(
          Array.from({ length: 25 }, (_, i) => ({
            id: i + 1,
            session_type: "admin_assistant",
            status: "active",
          }))
        );

        const { result } = renderHook(() => useAIChat(), {
          wrapper: createQueryWrapper(),
        });

        await waitFor(() => expect(result.current.sessions.length).toBeGreaterThan(0));

        // Hook uses limit=20 by default
        expect(result.current.sessions.length).toBeLessThanOrEqual(20);
      });
    });

    describe("chat history query", () => {
      it("should fetch chat history when session is set", async () => {
        seedSessions([
          {
            id: 1,
            session_type: "admin_assistant",
            status: "active",
          },
        ]);

        seedMessages(1, [
          { role: "user", content: "Hello" },
          { role: "assistant", content: "Hi there!" },
          { role: "user", content: "How are you?" },
          { role: "assistant", content: "I'm doing well, thank you!" },
        ]);

        const { result } = renderHook(() => useAIChat(), {
          wrapper: createQueryWrapper(),
        });

        await waitFor(() => expect(result.current.sessions).toBeDefined());

        act(() => {
          result.current.setCurrentSessionId(1);
        });

        await waitFor(() => expect(result.current.chatHistory.length).toBeGreaterThan(0));

        expect(result.current.chatHistory).toHaveLength(4);
        expect(result.current.chatHistory[0].role).toBe("user");
        expect(result.current.chatHistory[1].role).toBe("assistant");
      });

      it("should not fetch history when no session is set", async () => {
        const { result } = renderHook(() => useAIChat(), {
          wrapper: createQueryWrapper(),
        });

        await waitFor(() => expect(result.current.sessions).toBeDefined());

        expect(result.current.currentSessionId).toBeNull();
        expect(result.current.chatHistory).toHaveLength(0);
      });

      it("should return empty array for session with no messages", async () => {
        seedSessions([
          {
            id: 1,
            session_type: "admin_assistant",
            status: "active",
            message_count: 0,
          },
        ]);

        const { result } = renderHook(() => useAIChat(), {
          wrapper: createQueryWrapper(),
        });

        await waitFor(() => expect(result.current.sessions).toBeDefined());

        act(() => {
          result.current.setCurrentSessionId(1);
        });

        await waitFor(() => expect(result.current.chatHistory).toBeDefined());

        expect(result.current.chatHistory).toHaveLength(0);
      });
    });
  });

  describe("Mutation Hooks - Send Message", () => {
    describe("sendMessage", () => {
      it("should send message and create new session", async () => {
        const { result } = renderHook(() => useAIChat(), {
          wrapper: createQueryWrapper(),
        });

        await waitFor(() => expect(result.current.sessions).toBeDefined());

        expect(result.current.currentSessionId).toBeNull();

        await act(async () => {
          await result.current.sendMessage("Hello AI");
        });

        expect(result.current.isSending).toBe(false);
        expect(result.current.currentSessionId).toBeDefined();
        expect(result.current.currentSessionId).toBeGreaterThan(0);
      });

      it("should send message to existing session", async () => {
        seedSessions([
          {
            id: 42,
            session_type: "admin_assistant",
            status: "active",
            message_count: 0,
          },
        ]);

        const { result } = renderHook(() => useAIChat(), {
          wrapper: createQueryWrapper(),
        });

        await waitFor(() => expect(result.current.sessions).toBeDefined());

        act(() => {
          result.current.setCurrentSessionId(42);
        });

        await act(async () => {
          await result.current.sendMessage("How can you help?");
        });

        expect(result.current.currentSessionId).toBe(42);
        expect(result.current.isSending).toBe(false);
      });

      it("should send message with context", async () => {
        const { result } = renderHook(() => useAIChat(), {
          wrapper: createQueryWrapper(),
        });

        await waitFor(() => expect(result.current.sessions).toBeDefined());

        await act(async () => {
          await result.current.sendMessage("Help with billing", {
            customer_id: 123,
            region: "emea",
          });
        });

        expect(result.current.currentSessionId).toBeDefined();
        expect(result.current.sendError).toBeNull();
      });

      it("should handle send message error", async () => {
        const { result } = renderHook(() => useAIChat(), {
          wrapper: createQueryWrapper(),
        });

        await waitFor(() => expect(result.current.sessions).toBeDefined());

        await act(async () => {
          try {
            await result.current.sendMessage("");
          } catch (error) {
            // Expected to throw
          }
        });

        await waitFor(() => expect(result.current.sendError).not.toBeNull());
      });

      it("should update loading state during send", async () => {
        const { result } = renderHook(() => useAIChat(), {
          wrapper: createQueryWrapper(),
        });

        await waitFor(() => expect(result.current.sessions).toBeDefined());

        expect(result.current.isSending).toBe(false);

        const sendPromise = act(async () => {
          await result.current.sendMessage("Test message");
        });

        // Should eventually complete
        await sendPromise;
        expect(result.current.isSending).toBe(false);
      });
    });
  });

  describe("Mutation Hooks - Create Session", () => {
    describe("createSession", () => {
      it("should create session successfully", async () => {
        const { result } = renderHook(() => useAIChat(), {
          wrapper: createQueryWrapper(),
        });

        await waitFor(() => expect(result.current.sessions).toBeDefined());

        let newSession: any;
        await act(async () => {
          newSession = await result.current.createSession("customer_support");
        });

        expect(newSession).toBeDefined();
        expect(newSession.id).toBeDefined();
        expect(newSession.session_type).toBe("customer_support");
        expect(newSession.status).toBe("active");
        expect(result.current.currentSessionId).toBe(newSession.id);
      });

      it("should create session with default type", async () => {
        const { result } = renderHook(() => useAIChat(), {
          wrapper: createQueryWrapper(),
        });

        await waitFor(() => expect(result.current.sessions).toBeDefined());

        let newSession: any;
        await act(async () => {
          newSession = await result.current.createSession();
        });

        expect(newSession).toBeDefined();
        expect(newSession.session_type).toBe("admin_assistant");
      });

      it("should create session with context", async () => {
        const { result } = renderHook(() => useAIChat(), {
          wrapper: createQueryWrapper(),
        });

        await waitFor(() => expect(result.current.sessions).toBeDefined());

        let newSession: any;
        await act(async () => {
          newSession = await result.current.createSession("network_diagnostics", {
            device_id: 456,
          });
        });

        expect(newSession).toBeDefined();
        expect(newSession.session_type).toBe("network_diagnostics");
      });

      it("should create analytics session", async () => {
        const { result } = renderHook(() => useAIChat(), {
          wrapper: createQueryWrapper(),
        });

        await waitFor(() => expect(result.current.sessions).toBeDefined());

        let newSession: any;
        await act(async () => {
          newSession = await result.current.createSession("analytics");
        });

        expect(newSession).toBeDefined();
        expect(newSession.session_type).toBe("analytics");
      });

      it("should update loading state during creation", async () => {
        const { result } = renderHook(() => useAIChat(), {
          wrapper: createQueryWrapper(),
        });

        await waitFor(() => expect(result.current.sessions).toBeDefined());

        expect(result.current.isCreatingSession).toBe(false);

        await act(async () => {
          await result.current.createSession("admin_assistant");
        });

        expect(result.current.isCreatingSession).toBe(false);
      });
    });
  });

  describe("Mutation Hooks - Submit Feedback", () => {
    describe("submitFeedback", () => {
      it("should submit feedback successfully", async () => {
        seedSessions([
          {
            id: 10,
            session_type: "customer_support",
            status: "active",
          },
        ]);

        const { result } = renderHook(() => useAIChat(), {
          wrapper: createQueryWrapper(),
        });

        await waitFor(() => expect(result.current.sessions).toBeDefined());

        act(() => {
          result.current.setCurrentSessionId(10);
        });

        let feedbackResult: any;
        await act(async () => {
          feedbackResult = await result.current.submitFeedback(5, "Very helpful!");
        });

        expect(feedbackResult).toBeDefined();
        expect(feedbackResult.user_rating).toBe(5);
        expect(feedbackResult.user_feedback).toBe("Very helpful!");
      });

      it("should submit feedback without text", async () => {
        seedSessions([
          {
            id: 11,
            session_type: "admin_assistant",
            status: "active",
          },
        ]);

        const { result } = renderHook(() => useAIChat(), {
          wrapper: createQueryWrapper(),
        });

        await waitFor(() => expect(result.current.sessions).toBeDefined());

        act(() => {
          result.current.setCurrentSessionId(11);
        });

        let feedbackResult: any;
        await act(async () => {
          feedbackResult = await result.current.submitFeedback(3);
        });

        expect(feedbackResult).toBeDefined();
        expect(feedbackResult.user_rating).toBe(3);
      });

      it("should handle error when no session is set", async () => {
        const { result } = renderHook(() => useAIChat(), {
          wrapper: createQueryWrapper(),
        });

        await waitFor(() => expect(result.current.sessions).toBeDefined());

        await act(async () => {
          try {
            await result.current.submitFeedback(5);
          } catch (error: any) {
            expect(error.message).toBe("No active session");
          }
        });
      });

      it("should update loading state during submission", async () => {
        seedSessions([
          {
            id: 12,
            session_type: "admin_assistant",
            status: "active",
          },
        ]);

        const { result } = renderHook(() => useAIChat(), {
          wrapper: createQueryWrapper(),
        });

        await waitFor(() => expect(result.current.sessions).toBeDefined());

        act(() => {
          result.current.setCurrentSessionId(12);
        });

        expect(result.current.isSubmittingFeedback).toBe(false);

        await act(async () => {
          await result.current.submitFeedback(4, "Good");
        });

        expect(result.current.isSubmittingFeedback).toBe(false);
      });
    });
  });

  describe("Mutation Hooks - Escalate Session", () => {
    describe("escalateSession", () => {
      it("should escalate session successfully", async () => {
        seedSessions([
          {
            id: 20,
            session_type: "customer_support",
            status: "active",
          },
        ]);

        const { result } = renderHook(() => useAIChat(), {
          wrapper: createQueryWrapper(),
        });

        await waitFor(() => expect(result.current.sessions).toBeDefined());

        act(() => {
          result.current.setCurrentSessionId(20);
        });

        let escalationResult: any;
        await act(async () => {
          escalationResult = await result.current.escalateSession(
            "Complex billing issue requiring human expertise"
          );
        });

        expect(escalationResult).toBeDefined();
        expect(escalationResult.status).toBe("escalated");
        expect(escalationResult.escalation_reason).toBe(
          "Complex billing issue requiring human expertise"
        );
        expect(escalationResult.escalated_at).toBeDefined();
      });

      it("should handle error when no session is set", async () => {
        const { result } = renderHook(() => useAIChat(), {
          wrapper: createQueryWrapper(),
        });

        await waitFor(() => expect(result.current.sessions).toBeDefined());

        await act(async () => {
          try {
            await result.current.escalateSession("Need help");
          } catch (error: any) {
            expect(error.message).toBe("No active session");
          }
        });
      });

      it("should update loading state during escalation", async () => {
        seedSessions([
          {
            id: 21,
            session_type: "customer_support",
            status: "active",
          },
        ]);

        const { result } = renderHook(() => useAIChat(), {
          wrapper: createQueryWrapper(),
        });

        await waitFor(() => expect(result.current.sessions).toBeDefined());

        act(() => {
          result.current.setCurrentSessionId(21);
        });

        expect(result.current.isEscalating).toBe(false);

        await act(async () => {
          await result.current.escalateSession("Technical issue");
        });

        expect(result.current.isEscalating).toBe(false);
      });
    });
  });

  describe("Error States", () => {
    it("should expose error states for all operations", async () => {
      const { result } = renderHook(() => useAIChat(), {
        wrapper: createQueryWrapper(),
      });

      await waitFor(() => expect(result.current.sessions).toBeDefined());

      expect(result.current.sendError).toBeNull();
      expect(result.current.createSessionError).toBeNull();
      expect(result.current.feedbackError).toBeNull();
      expect(result.current.escalateError).toBeNull();
    });

    it("should handle 404 error for session history", async () => {
      const { result } = renderHook(() => useAIChat(), {
        wrapper: createQueryWrapper(),
      });

      await waitFor(() => expect(result.current.sessions).toBeDefined());

      // Set a non-existent session ID
      act(() => {
        result.current.setCurrentSessionId(9999);
      });

      // The query should fail
      await waitFor(
        () => {
          return result.current.chatHistory.length === 0;
        },
        { timeout: 3000 }
      );
    });
  });

  describe("Real-world Scenarios", () => {
    it("should handle complete chat conversation workflow", async () => {
      const { result } = renderHook(() => useAIChat(), {
        wrapper: createQueryWrapper(),
      });

      await waitFor(() => expect(result.current.sessions).toBeDefined());

      // Step 1: Create a session
      let session: any;
      await act(async () => {
        session = await result.current.createSession("customer_support", {
          customer_id: 123,
        });
      });

      expect(session.id).toBeDefined();
      expect(result.current.currentSessionId).toBe(session.id);

      // Step 2: Send first message
      await act(async () => {
        await result.current.sendMessage("I need help with my bill");
      });

      // Step 3: Send follow-up message
      await act(async () => {
        await result.current.sendMessage("Can you explain the charges?");
      });

      // Step 4: Fetch history
      await act(async () => {
        await result.current.refetchHistory();
      });

      await waitFor(() => expect(result.current.chatHistory.length).toBeGreaterThan(0));

      // Should have at least 4 messages (2 user + 2 assistant)
      expect(result.current.chatHistory.length).toBeGreaterThanOrEqual(4);

      // Step 5: Submit feedback
      await act(async () => {
        await result.current.submitFeedback(5, "Very helpful!");
      });

      expect(result.current.feedbackError).toBeNull();
    });

    it("should handle escalation workflow", async () => {
      const { result } = renderHook(() => useAIChat(), {
        wrapper: createQueryWrapper(),
      });

      await waitFor(() => expect(result.current.sessions).toBeDefined());

      // Create session
      let session: any;
      await act(async () => {
        session = await result.current.createSession("customer_support");
      });

      // Send messages
      await act(async () => {
        await result.current.sendMessage("I have a complex issue");
      });

      await act(async () => {
        await result.current.sendMessage("I need to speak with someone");
      });

      // Escalate
      let escalationResult: any;
      await act(async () => {
        escalationResult = await result.current.escalateSession(
          "Customer requests human agent for complex billing dispute"
        );
      });

      expect(escalationResult.status).toBe("escalated");
      expect(escalationResult.escalation_reason).toBeDefined();
    });

    it("should maintain session context across multiple messages", async () => {
      const { result } = renderHook(() => useAIChat(), {
        wrapper: createQueryWrapper(),
      });

      await waitFor(() => expect(result.current.sessions).toBeDefined());

      // Send first message (creates session)
      await act(async () => {
        await result.current.sendMessage("First message");
      });

      const sessionId = result.current.currentSessionId;
      expect(sessionId).toBeDefined();

      // Send second message (should use same session)
      await act(async () => {
        await result.current.sendMessage("Second message");
      });

      expect(result.current.currentSessionId).toBe(sessionId);

      // Send third message
      await act(async () => {
        await result.current.sendMessage("Third message");
      });

      expect(result.current.currentSessionId).toBe(sessionId);
    });

    it("should handle multiple sessions", async () => {
      seedSessions([
        {
          id: 1,
          session_type: "customer_support",
          status: "active",
          message_count: 5,
        },
        {
          id: 2,
          session_type: "admin_assistant",
          status: "active",
          message_count: 3,
        },
        {
          id: 3,
          session_type: "network_diagnostics",
          status: "escalated",
          message_count: 8,
        },
      ]);

      const { result } = renderHook(() => useAIChat(), {
        wrapper: createQueryWrapper(),
      });

      await waitFor(() => expect(result.current.sessions.length).toBeGreaterThan(0));

      expect(result.current.sessions).toHaveLength(3);

      // Switch between sessions
      act(() => {
        result.current.setCurrentSessionId(1);
      });

      expect(result.current.currentSessionId).toBe(1);

      act(() => {
        result.current.setCurrentSessionId(2);
      });

      expect(result.current.currentSessionId).toBe(2);

      act(() => {
        result.current.setCurrentSessionId(3);
      });

      expect(result.current.currentSessionId).toBe(3);
    });

    it("should refetch sessions after operations", async () => {
      const { result } = renderHook(() => useAIChat(), {
        wrapper: createQueryWrapper(),
      });

      await waitFor(() => expect(result.current.sessions).toBeDefined());

      expect(result.current.sessions).toHaveLength(0);

      // Create a session
      await act(async () => {
        await result.current.createSession("analytics");
      });

      // Refetch sessions
      await act(async () => {
        await result.current.refetchSessions();
      });

      await waitFor(() => expect(result.current.sessions.length).toBeGreaterThan(0));

      expect(result.current.sessions.length).toBeGreaterThanOrEqual(1);
    });
  });
});
