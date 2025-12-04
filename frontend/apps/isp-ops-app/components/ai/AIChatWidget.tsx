"use client";

import { useState, useRef, useEffect } from "react";
import {
  Bot,
  Send,
  X,
  Minimize2,
  Maximize2,
  ThumbsUp,
  ThumbsDown,
  AlertCircle,
} from "lucide-react";
import { Card } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Input } from "@dotmac/ui";
import { ScrollArea } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@dotmac/ui";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface AIChatWidgetProps {
  /** Whether the chat is minimized */
  minimized?: boolean;
  /** Callback when chat is toggled */
  onToggle?: () => void;
  /** Session type for the chat */
  sessionType?: "customer_support" | "admin_assistant" | "network_diagnostics";
  /** Additional context to pass to the AI */
  context?: Record<string, any>;
}

export function AIChatWidget({
  minimized = true,
  onToggle,
  sessionType = "admin_assistant",
  context,
}: AIChatWidgetProps) {
  const [isMinimized, setIsMinimized] = useState(minimized);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Hello! I'm your AI assistant. How can I help you today?",
      timestamp: new Date(),
    },
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleToggle = () => {
    setIsMinimized(!isMinimized);
    onToggle?.();
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: Message = {
      role: "user",
      content: inputValue,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/v1/ai/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: inputValue,
          session_id: sessionId,
          context,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to send message");
      }

      const data = await response.json();

      const assistantMessage: Message = {
        role: "assistant",
        content: data.message,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);

      // Update session ID if this was the first message
      if (!sessionId && data.session_id) {
        setSessionId(data.session_id);
      }
    } catch (err) {
      console.error("Error sending message:", err);
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleFeedback = async (rating: number) => {
    if (!sessionId) return;

    try {
      await fetch(`/api/v1/ai/sessions/${sessionId}/feedback`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          session_id: sessionId,
          rating,
        }),
      });
    } catch (err) {
      console.error("Error submitting feedback:", err);
    }
  };

  if (isMinimized) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              onClick={handleToggle}
              className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg"
              size="icon"
            >
              <Bot className="h-6 w-6" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Open AI Assistant</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <Card className="fixed bottom-6 right-6 w-96 shadow-2xl flex flex-col h-[600px] z-50">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-t-lg">
        <div className="flex items-center space-x-2">
          <Bot className="h-5 w-5" />
          <div>
            <h3 className="font-semibold">AI Assistant</h3>
            <p className="text-xs opacity-90">
              {sessionType === "customer_support" && "Customer Support"}
              {sessionType === "admin_assistant" && "Admin Helper"}
              {sessionType === "network_diagnostics" && "Network Diagnostics"}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleToggle}
            className="h-8 w-8 text-white hover:bg-white/20"
          >
            <Minimize2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        <div className="space-y-4">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-lg px-4 py-2 ${
                  message.role === "user"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                }`}
              >
                <p className="text-sm">{message.content}</p>
                <p className="text-xs opacity-70 mt-1">{message.timestamp.toLocaleTimeString()}</p>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 dark:bg-gray-800 rounded-lg px-4 py-2">
                <div className="flex space-x-2">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100" />
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200" />
                </div>
              </div>
            </div>
          )}
          {error && (
            <div className="flex justify-center">
              <Badge variant="destructive" className="flex items-center space-x-2">
                <AlertCircle className="h-4 w-4" />
                <span>{error}</span>
              </Badge>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="border-t p-4 space-y-2">
        {/* Feedback buttons */}
        {messages.length > 1 && (
          <div className="flex items-center justify-center space-x-2 text-sm text-gray-500">
            <span>Rate this conversation:</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => handleFeedback(5)}
            >
              <ThumbsUp className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => handleFeedback(1)}
            >
              <ThumbsDown className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Input */}
        <div className="flex space-x-2">
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type your message..."
            disabled={isLoading}
            className="flex-1"
          />
          <Button
            onClick={handleSendMessage}
            disabled={!inputValue.trim() || isLoading}
            size="icon"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>

        <p className="text-xs text-gray-500 text-center">
          AI-powered responses may not always be accurate
        </p>
      </div>
    </Card>
  );
}
