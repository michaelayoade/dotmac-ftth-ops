"""
AI Chat Service

Core service for AI-powered chat functionality.
"""

import json
import logging
from datetime import datetime
from typing import Any
from uuid import UUID

import openai
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.ai.models import (
    AIConfig,
    ChatMessage,
    ChatProvider,
    ChatRole,
    ChatSession,
    ChatSessionStatus,
    ChatSessionType,
)

logger = logging.getLogger(__name__)


class AIService:
    """AI chat service for customer support and admin assistance."""

    def __init__(self, session: AsyncSession, config: AIConfig):
        self.session = session
        self.config = config
        self._setup_provider()

    def _setup_provider(self):
        """Setup LLM provider client."""
        if self.config.provider == ChatProvider.OPENAI:
            if not self.config.openai_api_key:
                raise ValueError("OpenAI API key not configured")
            openai.api_key = self.config.openai_api_key
        elif self.config.provider == ChatProvider.ANTHROPIC:
            # Setup Anthropic client
            pass
        # Add other providers as needed

    async def create_session(
        self,
        tenant_id: str,
        session_type: ChatSessionType,
        user_id: UUID | None = None,
        customer_id: UUID | None = None,
        context: dict[str, Any] | None = None,
    ) -> ChatSession:
        """Create a new chat session."""

        session = ChatSession(
            tenant_id=tenant_id,
            user_id=user_id,
            customer_id=customer_id,
            session_type=session_type.value,
            provider=self.config.provider.value,
            model=self.config.default_model,
            context=context or {},
            status="active",
        )

        self.session.add(session)
        await self.session.commit()
        await self.session.refresh(session)

        logger.info(f"Created chat session {session.id} for tenant {tenant_id}")
        return session

    async def send_message(
        self,
        session_id: int,
        message: str,
        user_id: UUID | None = None,
    ) -> tuple[ChatSession, ChatMessage]:
        """Send a message and get AI response."""

        # Get session
        stmt = select(ChatSession).where(ChatSession.id == session_id)
        result = await self.session.execute(stmt)
        chat_session = result.scalar_one_or_none()

        if not chat_session:
            raise ValueError(f"Session {session_id} not found")

        if chat_session.status != "active":
            raise ValueError(f"Session {session_id} is not active")

        # Check rate limits
        await self._check_rate_limits(chat_session)

        # Save user message
        user_message = ChatMessage(
            session_id=session_id,
            role=ChatRole.USER,
            content=message,
        )
        self.session.add(user_message)

        # Get conversation history
        history = await self._get_conversation_history(session_id)

        # Build context
        system_prompt = await self._build_system_prompt(chat_session)

        # Call LLM
        assistant_content, tokens, cost = await self._call_llm(
            system_prompt=system_prompt,
            history=history,
            user_message=message,
        )

        # Save assistant response
        assistant_message = ChatMessage(
            session_id=session_id,
            role=ChatRole.ASSISTANT.value,
            content=assistant_content,
            tokens=tokens,
            cost=cost,
        )
        self.session.add(assistant_message)

        # Update session metrics
        chat_session.message_count += 2  # User + assistant
        chat_session.total_tokens += tokens
        chat_session.total_cost += cost
        chat_session.updated_at = datetime.utcnow()

        await self.session.commit()
        await self.session.refresh(assistant_message)

        return chat_session, assistant_message

    async def _call_llm(
        self,
        system_prompt: str,
        history: list[dict[str, str]],
        user_message: str,
    ) -> tuple[str, int, int]:
        """Call LLM provider and get response."""

        messages = [{"role": "system", "content": system_prompt}]
        messages.extend(history)
        messages.append({"role": "user", "content": user_message})

        try:
            if self.config.provider == ChatProvider.OPENAI:
                response = await openai.ChatCompletion.acreate(
                    model=self.config.default_model,
                    messages=messages,
                    temperature=self.config.temperature,
                    max_tokens=self.config.max_tokens,
                )

                content = response.choices[0].message.content
                tokens = response.usage.total_tokens

                # Estimate cost (rough approximation)
                cost_per_1k = 0.002 if "gpt-4" in self.config.default_model else 0.0015
                cost_cents = int((tokens / 1000) * cost_per_1k * 100)

                return content, tokens, cost_cents

            elif self.config.provider == ChatProvider.ANTHROPIC:
                # Implement Anthropic API call
                raise NotImplementedError("Anthropic provider is not yet implemented")

            else:
                raise ValueError(f"Unsupported provider: {self.config.provider}")

        except Exception as e:  # pragma: no cover - network/LLM errors
            logger.error(f"LLM API error: {e}")
            raise

    async def _build_system_prompt(self, chat_session: ChatSession) -> str:
        """Build system prompt based on session type and context."""

        base_prompts = {
            ChatSessionType.CUSTOMER_SUPPORT: """You are a helpful customer support assistant for an Internet Service Provider (ISP).
Your role is to:
- Answer billing questions clearly and accurately
- Help troubleshoot connectivity issues
- Explain charges and services
- Guide customers through self-service tasks
- Escalate complex issues to human agents when needed

Be friendly, professional, and concise. Always prioritize customer satisfaction.
If you don't know something, say so and offer to escalate to a human agent.""",
            ChatSessionType.ADMIN_ASSISTANT: """You are an AI assistant helping ISP operators and administrators.
Your role is to:
- Help navigate the admin dashboard
- Answer questions about configurations
- Provide quick data lookups
- Suggest troubleshooting steps
- Generate reports and insights

Be technical but clear. Provide step-by-step guidance when needed.""",
            ChatSessionType.NETWORK_DIAGNOSTICS: """You are a network diagnostics AI assistant.
Your role is to:
- Analyze network issues
- Suggest diagnostic steps
- Interpret error logs
- Recommend solutions
- Predict potential failures

Be technical and precise. Focus on actionable recommendations.""",
        }

        try:
            session_type = ChatSessionType(chat_session.session_type)
        except ValueError:
            session_type = ChatSessionType.CUSTOMER_SUPPORT

        prompt = base_prompts.get(
            session_type,
            base_prompts[ChatSessionType.CUSTOMER_SUPPORT],
        )

        # Add context if available
        if chat_session.context:
            prompt += f"\n\nContext:\n{json.dumps(chat_session.context, indent=2)}"

        return prompt

    async def _get_conversation_history(self, session_id: int) -> list[dict[str, str]]:
        """Get recent conversation history for context."""

        stmt = (
            select(ChatMessage)
            .where(ChatMessage.session_id == session_id)
            .order_by(ChatMessage.created_at.desc())
            .limit(self.config.max_context_messages)
        )

        result = await self.session.execute(stmt)
        messages = result.scalars().all()

        # Reverse to get chronological order
        history: list[dict[str, str]] = []
        for msg in reversed(messages):
            history.append(
                {
                    "role": str(msg.role),
                    "content": str(msg.content),
                }
            )

        return history

    async def _check_rate_limits(self, chat_session: ChatSession) -> None:
        """Check rate limits for session and user."""

        # Check message count per session
        if chat_session.message_count >= self.config.max_messages_per_session:
            raise ValueError("Session message limit reached")

        # Check cost per session
        if chat_session.total_cost >= self.config.per_session_cost_limit_cents:
            raise ValueError("Session cost limit reached")

        # Check daily cost for tenant (if user_id available)
        if chat_session.user_id:
            today = datetime.utcnow().date()
            stmt = (
                select(func.sum(ChatSession.total_cost))
                .where(ChatSession.user_id == chat_session.user_id)
                .where(func.date(ChatSession.created_at) == today)
            )
            result = await self.session.execute(stmt)
            daily_cost = result.scalar() or 0

            if daily_cost >= self.config.daily_cost_limit_cents:
                raise ValueError("Daily cost limit reached for user")

    async def get_session_history(self, session_id: int) -> list[ChatMessage]:
        """Get all messages for a session."""

        stmt = (
            select(ChatMessage)
            .where(ChatMessage.session_id == session_id)
            .order_by(ChatMessage.created_at.asc())
        )

        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def escalate_to_human(
        self,
        session_id: int,
        reason: str,
        escalate_to_user_id: UUID | None = None,
    ) -> ChatSession:
        """Escalate chat session to human agent."""

        stmt = select(ChatSession).where(ChatSession.id == session_id)
        result = await self.session.execute(stmt)
        chat_session = result.scalar_one_or_none()

        if not chat_session:
            raise ValueError(f"Session {session_id} not found")

        chat_session.status = ChatSessionStatus.ESCALATED.value
        chat_session.escalation_reason = reason
        chat_session.escalated_to_user_id = escalate_to_user_id

        await self.session.commit()

        logger.info(f"Escalated session {session_id} to human agent")
        return chat_session

    async def submit_feedback(
        self,
        session_id: int,
        rating: int,
        feedback: str | None = None,
    ) -> ChatSession:
        """Submit user feedback for a session."""

        stmt = select(ChatSession).where(ChatSession.id == session_id)
        result = await self.session.execute(stmt)
        chat_session = result.scalar_one_or_none()

        if not chat_session:
            raise ValueError(f"Session {session_id} not found")

        chat_session.user_rating = rating
        chat_session.user_feedback = feedback
        chat_session.status = ChatSessionStatus.COMPLETED.value
        chat_session.completed_at = datetime.utcnow()

        await self.session.commit()

        logger.info(f"Feedback submitted for session {session_id}: {rating}/5")
        return chat_session

    async def get_user_sessions(
        self,
        user_id: UUID,
        limit: int = 20,
    ) -> list[ChatSession]:
        """Get recent sessions for a user."""

        stmt = (
            select(ChatSession)
            .where(ChatSession.user_id == user_id)
            .order_by(ChatSession.created_at.desc())
            .limit(limit)
        )

        result = await self.session.execute(stmt)
        return list(result.scalars().all())
