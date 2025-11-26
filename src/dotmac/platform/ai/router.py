"""
AI Chat API Router
"""

import logging
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.ai.models import (
    AIConfig,
    ChatFeedback,
    ChatHistoryResponse,
    ChatMessageRequest,
    ChatMessageResponse,
    ChatSessionCreate,
    ChatSessionResponse,
    EscalateRequest,
)
from dotmac.platform.ai.service import AIService
from dotmac.platform.auth.core import UserInfo, get_current_user
from dotmac.platform.db import get_db

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/ai",
    tags=["AI - Chat"],
)


def _require_tenant_id(current_user: UserInfo) -> str:
    """Ensure the current request has a tenant context."""
    if not current_user.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tenant context is required for AI chat",
        )
    return current_user.tenant_id


# TODO: Load from tenant settings or environment
def get_ai_config() -> AIConfig:
    """Get AI configuration."""
    import os

    return AIConfig(
        openai_api_key=os.getenv("OPENAI_API_KEY"),
        anthropic_api_key=os.getenv("ANTHROPIC_API_KEY"),
    )


def get_ai_service(
    db: Annotated[AsyncSession, Depends(get_db)],
    config: Annotated[AIConfig, Depends(get_ai_config)],
) -> AIService:
    """Get AI service instance."""
    return AIService(session=db, config=config)


@router.post("/chat", response_model=ChatMessageResponse)
async def send_chat_message(
    request: ChatMessageRequest,
    current_user: Annotated[UserInfo, Depends(get_current_user)],
    service: Annotated[AIService, Depends(get_ai_service)],
) -> ChatMessageResponse:
    """
    Send a chat message and get AI response.

    If session_id is provided, continues existing conversation.
    Otherwise, creates a new session.
    """
    try:
        tenant_id = _require_tenant_id(current_user)

        # Create new session if not provided
        if not request.session_id:
            from dotmac.platform.ai.models import ChatSessionType

            session = await service.create_session(
                tenant_id=tenant_id,
                session_type=ChatSessionType.CUSTOMER_SUPPORT,
                user_id=UUID(current_user.user_id),
                context=request.context,
            )
            session_id = session.id
        else:
            session_id = request.session_id

        # Send message
        chat_session, message = await service.send_message(
            session_id=session_id,
            message=request.message,
            user_id=UUID(current_user.user_id),
        )

        return ChatMessageResponse(
            session_id=chat_session.id,
            message=message.content,
            role=message.role,
            metadata={
                "tokens": message.tokens,
                "cost_cents": message.cost,
            },
        )

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception as e:
        logger.error(f"Chat error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to process chat message",
        )


@router.post("/sessions", response_model=ChatSessionResponse)
async def create_chat_session(
    request: ChatSessionCreate,
    current_user: Annotated[UserInfo, Depends(get_current_user)],
    service: Annotated[AIService, Depends(get_ai_service)],
) -> ChatSessionResponse:
    """Create a new chat session."""
    try:
        tenant_id = _require_tenant_id(current_user)
        session = await service.create_session(
            tenant_id=tenant_id,
            session_type=request.session_type,
            user_id=UUID(current_user.user_id),
            customer_id=request.customer_id,
            context=request.context,
        )

        return ChatSessionResponse.model_validate(session)

    except Exception as e:
        logger.error(f"Session creation error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create chat session",
        )


@router.get("/sessions/{session_id}/history", response_model=ChatHistoryResponse)
async def get_session_history(
    session_id: int,
    current_user: Annotated[UserInfo, Depends(get_current_user)],
    service: Annotated[AIService, Depends(get_ai_service)],
) -> ChatHistoryResponse:
    """Get chat history for a session."""
    try:
        messages = await service.get_session_history(session_id)

        return ChatHistoryResponse(
            session_id=session_id,
            messages=[
                {
                    "role": msg.role,
                    "content": msg.content,
                    "created_at": msg.created_at.isoformat(),
                    "tokens": msg.tokens,
                }
                for msg in messages
            ],
        )

    except Exception as e:
        logger.error(f"History retrieval error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve chat history",
        )


@router.get("/sessions/my", response_model=list[ChatSessionResponse])
async def get_my_sessions(
    current_user: Annotated[UserInfo, Depends(get_current_user)],
    service: Annotated[AIService, Depends(get_ai_service)],
    limit: int = 20,
) -> list[ChatSessionResponse]:
    """Get current user's chat sessions."""
    try:
        sessions = await service.get_user_sessions(
            user_id=UUID(current_user.user_id),
            limit=limit,
        )

        return [ChatSessionResponse.model_validate(s) for s in sessions]

    except Exception as e:
        logger.error(f"Sessions retrieval error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve sessions",
        )


@router.post("/sessions/{session_id}/escalate", response_model=ChatSessionResponse)
async def escalate_session(
    session_id: int,
    request: EscalateRequest,
    current_user: Annotated[UserInfo, Depends(get_current_user)],
    service: Annotated[AIService, Depends(get_ai_service)],
) -> ChatSessionResponse:
    """Escalate chat to human agent."""
    try:
        session = await service.escalate_to_human(
            session_id=session_id,
            reason=request.reason,
        )

        return ChatSessionResponse.model_validate(session)

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )
    except Exception as e:
        logger.error(f"Escalation error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to escalate session",
        )


@router.post("/sessions/{session_id}/feedback", response_model=ChatSessionResponse)
async def submit_session_feedback(
    session_id: int,
    feedback: ChatFeedback,
    current_user: Annotated[UserInfo, Depends(get_current_user)],
    service: Annotated[AIService, Depends(get_ai_service)],
) -> ChatSessionResponse:
    """Submit feedback for a chat session."""
    try:
        session = await service.submit_feedback(
            session_id=session_id,
            rating=feedback.rating,
            feedback=feedback.feedback,
        )

        return ChatSessionResponse.model_validate(session)

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )
    except Exception as e:
        logger.error(f"Feedback submission error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to submit feedback",
        )
