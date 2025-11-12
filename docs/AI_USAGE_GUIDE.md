# AI Integration - Quick Start Guide

This guide shows you how to use the AI chat functionality that has been integrated into the platform.

## Overview

The AI integration provides:
- ✅ **Backend API** - FastAPI endpoints for chat sessions and messages
- ✅ **Database Tables** - PostgreSQL tables for session and message storage
- ✅ **Frontend Widget** - Ready-to-use React chat component
- ✅ **React Hook** - Custom hook for easy API integration

## Prerequisites

1. **Set up OpenAI API Key** (or another LLM provider)

```bash
# Add to your .env file
OPENAI_API_KEY=sk-your-api-key-here
ANTHROPIC_API_KEY=sk-ant-your-key-here  # Optional
```

2. **Run Database Migration**

```bash
# Apply the AI chat tables migration
poetry run alembic upgrade head
```

This will create:
- `ai_chat_sessions` table
- `ai_chat_messages` table
- Indexes and triggers

3. **Verify Backend Registration**

The AI router should be automatically registered in `/src/dotmac/platform/routers.py`. Check logs during startup to confirm:

```
✅ AI-powered chat for customer support and admin assistance registered at /api/v1
```

## Backend API Endpoints

### 1. Send a Chat Message

**POST** `/api/v1/ai/chat`

```bash
curl -X POST "http://localhost:8000/api/v1/ai/chat" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "How do I reset a customer password?",
    "session_id": null,
    "context": {
      "user_role": "admin"
    }
  }'
```

Response:
```json
{
  "session_id": 1,
  "message": "To reset a customer password, navigate to...",
  "role": "assistant",
  "metadata": {
    "tokens": 150,
    "cost_cents": 3
  }
}
```

### 2. Create a Chat Session

**POST** `/api/v1/ai/sessions`

```bash
curl -X POST "http://localhost:8000/api/v1/ai/sessions" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "session_type": "admin_assistant",
    "context": {
      "department": "network_ops"
    }
  }'
```

### 3. Get Chat History

**GET** `/api/v1/ai/sessions/{session_id}/history`

```bash
curl -X GET "http://localhost:8000/api/v1/ai/sessions/1/history" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 4. Get Your Sessions

**GET** `/api/v1/ai/sessions/my?limit=20`

### 5. Submit Feedback

**POST** `/api/v1/ai/sessions/{session_id}/feedback`

```bash
curl -X POST "http://localhost:8000/api/v1/ai/sessions/1/feedback" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": 1,
    "rating": 5,
    "feedback": "Very helpful!"
  }'
```

### 6. Escalate to Human

**POST** `/api/v1/ai/sessions/{session_id}/escalate`

```bash
curl -X POST "http://localhost:8000/api/v1/ai/sessions/1/escalate" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": 1,
    "reason": "Complex billing issue requiring human review"
  }'
```

## Frontend Integration

### Option 1: Use the Chat Widget (Recommended)

The simplest way to add AI chat to your app:

```tsx
// In your main layout or page component
import { AIChatWidget } from "@/components/ai/AIChatWidget";

export default function DashboardLayout() {
  return (
    <>
      {/* Your existing layout */}
      <div>Dashboard content...</div>

      {/* Add AI chat widget - it floats in bottom-right */}
      <AIChatWidget
        sessionType="admin_assistant"
        context={{
          currentPage: "dashboard",
          userRole: "admin",
        }}
      />
    </>
  );
}
```

The widget:
- ✅ Floats in the bottom-right corner
- ✅ Can be minimized/maximized
- ✅ Automatically manages sessions
- ✅ Handles errors gracefully
- ✅ Includes feedback buttons
- ✅ Shows typing indicators

### Option 2: Use the Hook Directly

For custom UI implementations:

```tsx
import { useAIChat } from "@/hooks/useAIChat";
import { useState } from "react";

export function CustomChatPage() {
  const {
    sendMessage,
    chatHistory,
    isSending,
    sendError,
    submitFeedback,
  } = useAIChat();

  const [input, setInput] = useState("");

  const handleSend = async () => {
    if (!input.trim()) return;

    try {
      const response = await sendMessage(input, {
        page: "custom-chat",
      });
      console.log("AI response:", response.message);
      setInput("");
    } catch (error) {
      console.error("Failed to send:", error);
    }
  };

  return (
    <div>
      {/* Display chat history */}
      <div className="space-y-2">
        {chatHistory.map((msg, i) => (
          <div key={i} className={msg.role}>
            {msg.content}
          </div>
        ))}
      </div>

      {/* Input */}
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyPress={(e) => e.key === "Enter" && handleSend()}
        disabled={isSending}
      />

      <button onClick={handleSend} disabled={isSending}>
        {isSending ? "Sending..." : "Send"}
      </button>

      {sendError && <p>Error: {sendError.message}</p>}

      {/* Feedback */}
      <button onClick={() => submitFeedback(5)}>👍</button>
      <button onClick={() => submitFeedback(1)}>👎</button>
    </div>
  );
}
```

## Session Types

Choose the appropriate session type for your use case:

### 1. `customer_support`
- **Purpose**: Customer-facing chatbot
- **Capabilities**: Answer billing questions, troubleshoot connectivity, explain charges
- **System Prompt**: Friendly, professional, focused on customer satisfaction

### 2. `admin_assistant`
- **Purpose**: Help operators navigate the admin dashboard
- **Capabilities**: Answer configuration questions, provide quick data lookups, suggest troubleshooting steps
- **System Prompt**: Technical but clear, step-by-step guidance

### 3. `network_diagnostics`
- **Purpose**: Analyze network issues
- **Capabilities**: Suggest diagnostic steps, interpret error logs, recommend solutions
- **System Prompt**: Technical and precise, actionable recommendations

### 4. `analytics`
- **Purpose**: Natural language analytics queries
- **Capabilities**: Generate insights, create reports, trend analysis
- **System Prompt**: Data-focused, visualization suggestions

## Context Passing

Pass relevant context to improve AI responses:

```tsx
<AIChatWidget
  sessionType="admin_assistant"
  context={{
    // User context
    userRole: "network_engineer",
    department: "network_ops",

    // Page context
    currentPage: "subscriber-management",
    currentAction: "troubleshooting",

    // Business context
    subscriberId: "12345",
    issueType: "connectivity",

    // System context
    tenant: "acme-isp",
    environment: "production",
  }}
/>
```

The AI uses this context to provide more relevant answers.

## Cost Management

The system includes built-in cost controls:

```python
# In AIConfig (src/dotmac/platform/ai/models.py)
daily_cost_limit_cents: int = 10000  # $100 per day
per_session_cost_limit_cents: int = 100  # $1 per session
max_messages_per_session: int = 100
```

Adjust these limits based on your budget and usage patterns.

## Rate Limiting

Sessions are automatically rate-limited:
- Max messages per session
- Daily cost limits per user
- Session cost limits

If a limit is exceeded, the API returns a 400 error with details.

## Monitoring

Track AI usage and costs:

```sql
-- Total AI usage cost today
SELECT
  SUM(total_cost) as total_cost_cents,
  COUNT(*) as session_count,
  SUM(message_count) as total_messages
FROM ai_chat_sessions
WHERE DATE(created_at) = CURRENT_DATE;

-- User satisfaction ratings
SELECT
  user_rating,
  COUNT(*) as count
FROM ai_chat_sessions
WHERE user_rating IS NOT NULL
GROUP BY user_rating
ORDER BY user_rating;

-- Most expensive sessions
SELECT
  id,
  session_type,
  total_cost,
  message_count,
  created_at
FROM ai_chat_sessions
ORDER BY total_cost DESC
LIMIT 10;
```

## Advanced Features

### Function Calling

The AI can call backend functions to perform actions:

```python
# Example: AI can create a support ticket
{
  "function_name": "create_ticket",
  "function_args": {
    "title": "Customer connectivity issue",
    "priority": "high"
  }
}
```

This is defined in the backend service (currently not implemented - see roadmap).

### Escalation to Human Agents

Users can escalate complex issues:

```tsx
const { escalateSession } = useAIChat();

await escalateSession("Complex billing dispute requiring human review");
```

This changes the session status to "escalated" and can trigger notifications to support staff.

## Troubleshooting

### "OpenAI API key not configured"

Make sure your `.env` file contains:
```
OPENAI_API_KEY=sk-...
```

### "Session not found"

The session may have expired or been deleted. Start a new session.

### "Daily cost limit reached"

Your tenant has exceeded the daily AI usage limit. Wait until tomorrow or contact support to increase limits.

### Widget not showing

Make sure you've imported and rendered the component:
```tsx
import { AIChatWidget } from "@/components/ai/AIChatWidget";

// In your JSX
<AIChatWidget />
```

## Next Steps

1. **Add to your layout** - Add `<AIChatWidget />` to your dashboard layout
2. **Configure API key** - Add `OPENAI_API_KEY` to `.env`
3. **Run migration** - Execute `poetry run alembic upgrade head`
4. **Test it** - Open your dashboard and click the chat button
5. **Monitor usage** - Check session costs and ratings
6. **Customize prompts** - Edit system prompts in `ai/service.py` for your use case

## API Documentation

Full API documentation is available at:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

Look for the "AI - Chat" tag for all AI endpoints.

## Support

For issues or questions:
1. Check the main [AI Integration Guide](./AI_INTEGRATION_GUIDE.md)
2. Review logs: `docker compose logs -f backend`
3. Check database: `SELECT * FROM ai_chat_sessions ORDER BY created_at DESC LIMIT 5;`
