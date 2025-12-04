"""
Pydantic schemas for user management and teams.

These schemas are used for API request/response validation.
"""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


class TeamBase(BaseModel):  # BaseModel resolves to Any in isolation
    """Base team schema with common fields."""

    model_config = ConfigDict(
        str_strip_whitespace=True,
        validate_assignment=True,
    )

    name: str = Field(min_length=1, max_length=100, description="Team name")
    slug: str = Field(min_length=1, max_length=100, description="Team slug for URLs")
    description: str | None = Field(None, description="Team description")
    is_active: bool = Field(default=True, description="Whether team is active")
    is_default: bool = Field(default=False, description="Whether this is the default team")
    team_lead_id: UUID | None = Field(None, description="Team lead user ID")
    color: str | None = Field(None, max_length=7, description="Hex color code for UI")
    icon: str | None = Field(None, max_length=50, description="Icon identifier")

    @field_validator("slug")
    @classmethod
    def validate_slug(cls, v: str) -> str:
        """Validate slug format."""
        if not v.replace("-", "").replace("_", "").isalnum():
            raise ValueError(
                "Slug must contain only alphanumeric characters, hyphens, and underscores"
            )
        return v.lower()

    @field_validator("color")
    @classmethod
    def validate_color(cls, v: str | None) -> str | None:
        """Validate hex color format."""
        if v is None:
            return v
        if not v.startswith("#") or len(v) != 7:
            raise ValueError("Color must be in hex format (#RRGGBB)")
        try:
            int(v[1:], 16)
        except ValueError:
            raise ValueError("Invalid hex color code")
        return v.upper()


class TeamCreate(TeamBase):  # TeamBase resolves to Any in isolation
    """Schema for creating a new team."""

    pass


class TeamUpdate(BaseModel):  # BaseModel resolves to Any in isolation
    """Schema for updating a team."""

    model_config = ConfigDict(
        str_strip_whitespace=True,
        validate_assignment=True,
    )

    name: str | None = Field(None, min_length=1, max_length=100)
    slug: str | None = Field(None, min_length=1, max_length=100)
    description: str | None = None
    is_active: bool | None = None
    is_default: bool | None = None
    team_lead_id: UUID | None = None
    color: str | None = None
    icon: str | None = None

    @field_validator("slug")
    @classmethod
    def validate_slug(cls, v: str | None) -> str | None:
        """Validate slug format."""
        if v is None:
            return v
        if not v.replace("-", "").replace("_", "").isalnum():
            raise ValueError(
                "Slug must contain only alphanumeric characters, hyphens, and underscores"
            )
        return v.lower()

    @field_validator("color")
    @classmethod
    def validate_color(cls, v: str | None) -> str | None:
        """Validate hex color format."""
        if v is None:
            return v
        if not v.startswith("#") or len(v) != 7:
            raise ValueError("Color must be in hex format (#RRGGBB)")
        try:
            int(v[1:], 16)
        except ValueError:
            raise ValueError("Invalid hex color code")
        return v.upper()


class Team(TeamBase):  # TeamBase resolves to Any in isolation
    """Schema for team response."""

    id: UUID = Field(description="Team ID")
    tenant_id: str = Field(description="Tenant ID")
    created_at: datetime = Field(description="Creation timestamp")
    updated_at: datetime = Field(description="Last update timestamp")
    member_count: int | None = Field(None, description="Number of team members")

    model_config = ConfigDict(from_attributes=True)


class TeamMemberBase(BaseModel):  # BaseModel resolves to Any in isolation
    """Base team member schema with common fields."""

    model_config = ConfigDict(
        str_strip_whitespace=True,
        validate_assignment=True,
    )

    team_id: UUID = Field(description="Team ID")
    user_id: UUID = Field(description="User ID")
    role: str = Field(default="member", max_length=50, description="Member role")
    is_active: bool = Field(default=True, description="Whether membership is active")
    notes: str | None = Field(None, description="Notes about this team member")

    @field_validator("role")
    @classmethod
    def validate_role(cls, v: str) -> str:
        """Validate role is one of the allowed values."""
        allowed_roles = ["member", "lead", "admin"]
        if v.lower() not in allowed_roles:
            raise ValueError(f"Role must be one of: {', '.join(allowed_roles)}")
        return v.lower()


class TeamMemberCreate(TeamMemberBase):  # TeamMemberBase resolves to Any in isolation
    """Schema for adding a member to a team."""

    pass


class TeamMemberUpdate(BaseModel):  # BaseModel resolves to Any in isolation
    """Schema for updating team membership."""

    model_config = ConfigDict(
        str_strip_whitespace=True,
        validate_assignment=True,
    )

    role: str | None = None
    is_active: bool | None = None
    notes: str | None = None

    @field_validator("role")
    @classmethod
    def validate_role(cls, v: str | None) -> str | None:
        """Validate role is one of the allowed values."""
        if v is None:
            return v
        allowed_roles = ["member", "lead", "admin"]
        if v.lower() not in allowed_roles:
            raise ValueError(f"Role must be one of: {', '.join(allowed_roles)}")
        return v.lower()


class TeamMember(TeamMemberBase):  # TeamMemberBase resolves to Any in isolation
    """Schema for team member response."""

    id: UUID = Field(description="Team member ID")
    tenant_id: str = Field(description="Tenant ID")
    joined_at: datetime = Field(description="When member joined team")
    left_at: datetime | None = Field(None, description="When member left team")
    created_at: datetime = Field(description="Creation timestamp")
    updated_at: datetime = Field(description="Last update timestamp")

    # Include user details if populated
    user_name: str | None = Field(None, description="User's display name")
    user_email: str | None = Field(None, description="User's email")

    model_config = ConfigDict(from_attributes=True)


class TeamWithMembers(Team):
    """Schema for team response with members."""

    members: list[TeamMember] = Field(default_factory=list, description="Team members")


class TeamListResponse(BaseModel):  # BaseModel resolves to Any in isolation
    """Schema for paginated team list response."""

    model_config = ConfigDict()

    items: list[Team] = Field(description="List of teams")
    total: int = Field(description="Total number of teams")
    page: int = Field(default=1, ge=1, description="Current page number")
    page_size: int = Field(default=50, ge=1, le=100, description="Number of items per page")
    pages: int = Field(description="Total number of pages")


class TeamMemberListResponse(BaseModel):  # BaseModel resolves to Any in isolation
    """Schema for paginated team member list response."""

    model_config = ConfigDict()

    items: list[TeamMember] = Field(description="List of team members")
    total: int = Field(description="Total number of members")
    page: int = Field(default=1, ge=1, description="Current page number")
    page_size: int = Field(default=50, ge=1, le=100, description="Number of items per page")
    pages: int = Field(description="Total number of pages")
