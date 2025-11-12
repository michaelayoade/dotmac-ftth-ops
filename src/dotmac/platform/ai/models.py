"""
AI Chat Models and Schemas
"""

from datetime import datetime
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field
from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship

from dotmac.platform.models import Base


class ChatRole(str, Enum):
    """Chat message roles."""

    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"
    FUNCTION = "function"


class ChatProvider(str, Enum):
    """LLM providers."""

    OPENAI = "openai"
    ANTHROPIC = "anthropic"
    AZURE_OPENAI = "azure_openai"
    LOCAL = "local"


class ChatSessionType(str, Enum):
    """Types of chat sessions."""

    CUSTOMER_SUPPORT = "customer_support"
    ADMIN_ASSISTANT = "admin_assistant"
    NETWORK_DIAGNOSTICS = "network_diagnostics"
    ANALYTICS = "analytics"


class ChatSessionStatus(str, Enum):
    """Chat session statuses."""

    ACTIVE = "active"
    COMPLETED = "completed"
    ESCALATED = "escalated"
    ABANDONED = "abandoned"


# ============================================================================
# Database Models
# ============================================================================


class ChatSession(Base):
    """Chat session database model."""

    __tablename__ = "ai_chat_sessions"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(String(50), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=True)

    # Session metadata
    session_type = Column(String(50), nullable=False, default=ChatSessionType.CUSTOMER_SUPPORT)
    status = Column(String(20), nullable=False, default=ChatSessionStatus.ACTIVE)
    provider = Column(String(20), nullable=False, default=ChatProvider.OPENAI)
    model = Column(String(50), nullable=True)

    # Context
    context = Column(JSON, nullable=True)  # Additional context data
    metadata = Column(JSON, nullable=True)  # Session metadata

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)

    # Metrics
    message_count = Column(Integer, default=0)
    total_tokens = Column(Integer, default=0)
    total_cost = Column(Integer, default=0)  # In cents

    # Satisfaction
    user_rating = Column(Integer, nullable=True)  # 1-5
    user_feedback = Column(Text, nullable=True)

    # Escalation
    escalated_to_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    escalation_reason = Column(Text, nullable=True)

    # Relationships
    messages = relationship("ChatMessage", back_populates="session", cascade="all, delete-orphan")


class ChatMessage(Base):
    """Chat message database model."""

    __tablename__ = "ai_chat_messages"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("ai_chat_sessions.id"), nullable=False, index=True)

    # Message content
    role = Column(String(20), nullable=False)
    content = Column(Text, nullable=False)

    # Function calling
    function_name = Column(String(100), nullable=True)
    function_args = Column(JSON, nullable=True)
    function_result = Column(JSON, nullable=True)

    # Metadata
    metadata = Column(JSON, nullable=True)
    tokens = Column(Integer, nullable=True)
    cost = Column(Integer, nullable=True)  # In cents

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    session = relationship("ChatSession", back_populates="messages")


# ============================================================================
# Pydantic Schemas
# ============================================================================


class ChatMessageRequest(BaseModel):
    """Request to send a chat message."""

    message: str = Field(..., min_length=1, max_length=10000, description="User message")
    session_id: int | None = Field(default=None, description="Existing session ID (optional)")
    context: dict[str, Any] | None = Field(default=None, description="Additional context")


class ChatMessageResponse(BaseModel):
    """Chat message response."""

    session_id: int
    message: str
    role: str = "assistant"
    function_calls: list[dict[str, Any]] | None = None
    metadata: dict[str, Any] | None = None


class ChatSessionCreate(BaseModel):
    """Create a new chat session."""

    session_type: ChatSessionType = Field(default=ChatSessionType.CUSTOMER_SUPPORT)
    context: dict[str, Any] | None = Field(default=None)
    customer_id: int | None = None


class ChatSessionResponse(BaseModel):
    """Chat session response."""

    id: int
    session_type: str
    status: str
    provider: str
    created_at: datetime
    message_count: int
    total_tokens: int
    total_cost: int
    user_rating: int | None = None

    model_config = {"from_attributes": True}


class ChatHistoryResponse(BaseModel):
    """Chat history response."""

    session_id: int
    messages: list[dict[str, Any]]
    metadata: dict[str, Any] | None = None


class ChatFeedback(BaseModel):
    """User feedback for a chat session."""

    session_id: int
    rating: int = Field(..., ge=1, le=5)
    feedback: str | None = Field(default=None, max_length=1000)


class EscalateRequest(BaseModel):
    """Request to escalate chat to human agent."""

    session_id: int
    reason: str = Field(..., min_length=1, max_length=500)


# ============================================================================
# Configuration
# ============================================================================


class AIConfig(BaseModel):
    """AI service configuration."""

    # Provider settings
    provider: ChatProvider = ChatProvider.OPENAI
    openai_api_key: str | None = None
    anthropic_api_key: str | None = None
    azure_endpoint: str | None = None

    # Model settings
    default_model: str = "gpt-3.5-turbo"
    temperature: float = Field(default=0.7, ge=0.0, le=2.0)
    max_tokens: int = Field(default=500, ge=1, le=4000)

    # Feature flags
    enable_customer_chat: bool = True
    enable_admin_assistant: bool = True
    enable_function_calling: bool = True
    enable_voice: bool = False

    # Rate limiting
    max_messages_per_session: int = 100
    max_sessions_per_user_per_day: int = 50

    # Cost controls
    daily_cost_limit_cents: int = 10000  # $100
    per_session_cost_limit_cents: int = 100  # $1

    # Context settings
    max_context_messages: int = 10  # How many messages to include in context
    include_customer_data: bool = True
    include_billing_data: bool = True
    include_network_data: bool = False
