"use client";

import { useState, useCallback } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  created_at?: string;
  tokens?: number;
}

export interface ChatSession {
  id: number;
  session_type: string;
  status: string;
  provider: string;
  created_at: string;
  message_count: number;
  total_tokens: number;
  total_cost: number;
  user_rating?: number;
}

export interface SendMessageRequest {
  message: string;
  session_id?: number | undefined;
  context?: Record<string, any> | undefined;
}

export interface SendMessageResponse {
  session_id: number;
  message: string;
  role: string;
  metadata?: {
    tokens?: number;
    cost_cents?: number;
  };
}

export interface CreateSessionRequest {
  session_type?:
    | "customer_support"
    | "admin_assistant"
    | "network_diagnostics"
    | "analytics"
    | undefined;
  context?: Record<string, any> | undefined;
  customer_id?: number | undefined;
}

export interface SubmitFeedbackRequest {
  session_id: number;
  rating: number;
  feedback?: string | undefined;
}

/**
 * Custom hook for AI chat functionality
 */
export function useAIChat() {
  const [currentSessionId, setCurrentSessionId] = useState<number | null>(null);

  // Send a chat message
  const sendMessageMutation = useMutation<SendMessageResponse, Error, SendMessageRequest>({
    mutationFn: async (data: SendMessageRequest) => {
      const response = await fetch("/api/v1/ai/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Failed to send message");
      }

      return response.json();
    },
    onSuccess: (data) => {
      if (data.session_id && !currentSessionId) {
        setCurrentSessionId(data.session_id);
      }
    },
  });

  // Create a new chat session
  const createSessionMutation = useMutation<ChatSession, Error, CreateSessionRequest>({
    mutationFn: async (data: CreateSessionRequest) => {
      const response = await fetch("/api/v1/ai/sessions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Failed to create session");
      }

      return response.json();
    },
    onSuccess: (data) => {
      setCurrentSessionId(data.id);
    },
  });

  // Get chat history for a session
  const { data: chatHistory, refetch: refetchHistory } = useQuery<{
    session_id: number;
    messages: ChatMessage[];
  }>({
    queryKey: ["ai-chat-history", currentSessionId],
    queryFn: async () => {
      if (!currentSessionId) throw new Error("No session ID");

      const response = await fetch(`/api/v1/ai/sessions/${currentSessionId}/history`);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Failed to fetch history");
      }

      return response.json();
    },
    enabled: !!currentSessionId,
  });

  // Get user's chat sessions
  const { data: sessions, refetch: refetchSessions } = useQuery<ChatSession[]>({
    queryKey: ["ai-chat-sessions"],
    queryFn: async () => {
      const response = await fetch("/api/v1/ai/sessions/my?limit=20");

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Failed to fetch sessions");
      }

      return response.json();
    },
  });

  // Submit feedback for a session
  const submitFeedbackMutation = useMutation<ChatSession, Error, SubmitFeedbackRequest>({
    mutationFn: async (data: SubmitFeedbackRequest) => {
      const response = await fetch(`/api/v1/ai/sessions/${data.session_id}/feedback`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Failed to submit feedback");
      }

      return response.json();
    },
  });

  // Escalate session to human agent
  const escalateSessionMutation = useMutation<
    ChatSession,
    Error,
    { session_id: number; reason: string }
  >({
    mutationFn: async ({ session_id, reason }) => {
      const response = await fetch(`/api/v1/ai/sessions/${session_id}/escalate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ session_id, reason }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Failed to escalate session");
      }

      return response.json();
    },
  });

  // Helper function to send a message
  const sendMessage = useCallback(
    async (message: string, context?: Record<string, any>) => {
      return sendMessageMutation.mutateAsync({
        message,
        session_id: currentSessionId || undefined,
        context,
      });
    },
    [currentSessionId, sendMessageMutation],
  );

  // Helper function to create a session
  const createSession = useCallback(
    async (
      sessionType:
        | "customer_support"
        | "admin_assistant"
        | "network_diagnostics"
        | "analytics" = "admin_assistant",
      context?: Record<string, any>,
    ) => {
      return createSessionMutation.mutateAsync({
        session_type: sessionType,
        context,
      });
    },
    [createSessionMutation],
  );

  // Helper function to submit feedback
  const submitFeedback = useCallback(
    async (rating: number, feedback?: string) => {
      if (!currentSessionId) {
        throw new Error("No active session");
      }

      return submitFeedbackMutation.mutateAsync({
        session_id: currentSessionId,
        rating,
        feedback,
      });
    },
    [currentSessionId, submitFeedbackMutation],
  );

  // Helper function to escalate session
  const escalateSession = useCallback(
    async (reason: string) => {
      if (!currentSessionId) {
        throw new Error("No active session");
      }

      return escalateSessionMutation.mutateAsync({
        session_id: currentSessionId,
        reason,
      });
    },
    [currentSessionId, escalateSessionMutation],
  );

  return {
    // State
    currentSessionId,
    setCurrentSessionId,

    // Data
    chatHistory: currentSessionId ? chatHistory?.messages || [] : [],
    sessions: sessions || [],

    // Actions
    sendMessage,
    createSession,
    submitFeedback,
    escalateSession,

    // Loading states
    isSending: sendMessageMutation.isPending,
    isCreatingSession: createSessionMutation.isPending,
    isSubmittingFeedback: submitFeedbackMutation.isPending,
    isEscalating: escalateSessionMutation.isPending,

    // Errors
    sendError: sendMessageMutation.error,
    createSessionError: createSessionMutation.error,
    feedbackError: submitFeedbackMutation.error,
    escalateError: escalateSessionMutation.error,

    // Refetch functions
    refetchHistory,
    refetchSessions,
  };
}
