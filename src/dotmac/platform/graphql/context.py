"""GraphQL context with authentication and managed database session."""

import asyncio

import strawberry
from fastapi import Request
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.background import BackgroundTasks
from strawberry.fastapi import BaseContext

from dotmac.platform.auth.core import UserInfo, jwt_service
from dotmac.platform.db import AsyncSessionLocal
from dotmac.platform.graphql.loaders import DataLoaderRegistry


@strawberry.type
class Context(BaseContext):
    """
    GraphQL execution context.

    Provides:
    - request: FastAPI Request object
    - db: SQLAlchemy async session
    - current_user: Authenticated user info (optional for public queries)
    """

    request: Request
    db: AsyncSession
    current_user: UserInfo | None = None
    loaders: DataLoaderRegistry

    def __init__(
        self,
        *,
        request: Request,
        db: AsyncSession,
        current_user: UserInfo | None = None,
    ) -> None:
        super().__init__()
        self.request = request
        self.db = db
        self.current_user = current_user
        self.loaders = DataLoaderRegistry(db)
        self._background_tasks: BackgroundTasks | None = None
        self._close_registered = False
        self._session_closed = False

    @property
    def background_tasks(self) -> BackgroundTasks | None:
        return self._background_tasks

    @background_tasks.setter
    def background_tasks(self, tasks: BackgroundTasks | None) -> None:
        self._background_tasks = tasks
        if tasks is not None and not self._close_registered:
            tasks.add_task(self._close_db_session)
            self._close_registered = True

    async def _close_db_session(self) -> None:
        """Ensure the attached session is closed after the response is sent."""
        if self._session_closed:
            return
        await self.db.close()
        self._session_closed = True

    def __del__(self) -> None:  # pragma: no cover - defensive
        if self._session_closed:
            return
        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            return
        if loop.is_running():
            loop.create_task(self.db.close())
            self._session_closed = True

    @staticmethod
    async def get_context(request: Request) -> "Context":
        """
        Create GraphQL context from FastAPI request.

        Extracts authentication token and database session.
        Allows guest access for public queries.

        Args:
            request: FastAPI request object

        Returns:
            Context instance with db session and optional user
        """
        # Lazily create database session; closed via background tasks
        db_session = AsyncSessionLocal()

        # Extract user from token if present
        current_user = None
        try:
            # Try Authorization header first
            auth_header = request.headers.get("Authorization", "")
            token = auth_header.replace("Bearer ", "").strip()

            # Fall back to cookie if no header
            if not token:
                token = request.cookies.get("access_token", "")

            # Verify token and extract user info
            if token:
                payload = jwt_service.verify_token(token)
                current_user = UserInfo(
                    user_id=str(payload.get("sub", "")),
                    tenant_id=payload.get("tenant_id"),
                    roles=list(payload.get("roles", [])),
                    permissions=list(payload.get("permissions", [])),
                    email=payload.get("email"),
                    username=payload.get("preferred_username"),
                )
        except Exception:
            # Guest access - no user context
            pass

        return Context(request=request, db=db_session, current_user=current_user)
