"""GraphQL context with authentication and managed database session."""

from __future__ import annotations

import asyncio
from typing import Any

import strawberry
from fastapi import HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.background import BackgroundTasks
from strawberry.fastapi import BaseContext
from strawberry.types import Info

from dotmac.platform.auth.core import TokenType, UserInfo, jwt_service
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

    def require_authenticated_user(self) -> UserInfo:
        """Return the authenticated user or raise 401."""
        if not self.current_user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required."
            )
        return self.current_user

    def get_active_tenant_id(self) -> str:
        """
        Resolve the tenant identifier for GraphQL operations.

        Platform administrators may target tenants via X-Target-Tenant-ID.
        Regular users are restricted to their own tenant context.
        """
        user = self.require_authenticated_user()
        request_tenant = getattr(self.request.state, "tenant_id", None)

        if getattr(user, "is_platform_admin", False):
            target_tenant = (
                self.request.headers.get("X-Target-Tenant-ID")
                or self.request.query_params.get("tenant_id")
                or request_tenant
            )
            if not target_tenant:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Platform administrators must specify X-Target-Tenant-ID header.",
                )
            return target_tenant

        tenant_id_value = user.tenant_id or request_tenant
        if tenant_id_value is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="Tenant context is required."
            )

        tenant_id = str(tenant_id_value)

        if request_tenant and str(request_tenant) != tenant_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Tenant ID mismatch between authenticated user and request context.",
            )

        return tenant_id

    # ------------------------------------------------------------------ #
    # Dict-style compatibility helpers
    # ------------------------------------------------------------------ #

    def __getitem__(self, key: str) -> Any:
        """Provide dict-style access for legacy resolvers."""
        if key == "db":
            return self.db
        if key == "current_user":
            return self.current_user
        if key == "tenant_id":
            return self.get_active_tenant_id()
        raise KeyError(key)

    def get(self, key: str, default: Any = None) -> Any:
        """Compatibility get method."""
        try:
            return self.__getitem__(key)
        except KeyError:
            return default

    def __contains__(self, key: str) -> bool:
        """Support `in` checks for resolvers."""
        if key in {"db", "tenant_id", "current_user"}:
            return True
        return False

    @staticmethod
    async def get_context(request: Request) -> Context:
        """
        Create GraphQL context from FastAPI request.

        Extracts authentication token and database session. Authentication
        is mandatory for GraphQL access.

        Args:
            request: FastAPI request object

        Returns:
            Context instance with db session and authenticated user
        """
        # Lazily create database session; closed via background tasks
        db_session = AsyncSessionLocal()

        # Extract user from token; GraphQL requires authenticated access
        try:
            auth_header = request.headers.get("Authorization", "")
            token = auth_header.replace("Bearer ", "").strip()

            if not token:
                token = request.cookies.get("access_token", "")

            if not token:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Authentication required for GraphQL access.",
                )

            payload: dict[str, Any] = jwt_service.verify_token(
                token, expected_type=TokenType.ACCESS
            )
            current_user = UserInfo(
                user_id=str(payload.get("sub", "")),
                tenant_id=payload.get("tenant_id"),
                roles=list(payload.get("roles") or []),
                permissions=list(payload.get("permissions") or []),
                email=payload.get("email"),
                username=payload.get("preferred_username"),
                is_platform_admin=bool(payload.get("is_platform_admin", False)),
            )

        except HTTPException:
            await db_session.close()
            raise

        try:
            return Context(request=request, db=db_session, current_user=current_user)
        except Exception:
            await db_session.close()
            raise


async def get_context(info: Info) -> dict[str, Any]:
    """
    Compatibility helper returning dict-style context.

    Args:
        info: Strawberry execution info
    """
    ctx = info.context

    if isinstance(ctx, Context):
        return {
            "db_session": ctx.db,
            "tenant_id": ctx.get_active_tenant_id(),
            "current_user": ctx.current_user,
            "loaders": ctx.loaders,
            "request": ctx.request,
        }

    if isinstance(ctx, dict):
        return ctx

    db_session = getattr(ctx, "db", None)
    tenant_id = getattr(ctx, "tenant_id", None)
    current_user = getattr(ctx, "current_user", None)

    get_tenant = getattr(ctx, "get_active_tenant_id", None)
    if tenant_id is None and callable(get_tenant):
        tenant_id = get_tenant()

    return {
        "db_session": db_session,
        "tenant_id": tenant_id,
        "current_user": current_user,
    }
