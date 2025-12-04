#!/usr/bin/env python3
"""
Generate OpenAPI spec from ISP Settings Pydantic models.

This script creates a temporary FastAPI app to generate OpenAPI JSON,
which can then be used with openapi-zod-client to generate Zod schemas.
"""

import json
import sys

# Ensure we can import from src
sys.path.insert(0, "src")

from fastapi import FastAPI
from fastapi.openapi.utils import get_openapi

from dotmac.platform.tenant.isp_settings_models import ISPSettings
from dotmac.platform.tenant.isp_settings_router import (
    SettingsUpdateRequest,
    SettingsUpdateResponse,
    SettingsSectionUpdateRequest,
    SettingsValidationRequest,
    SettingsValidationResponse,
    SettingsImportRequest,
)

# Create a minimal FastAPI app with the ISP Settings schema
app = FastAPI(
    title="ISP Settings API",
    version="1.0.0",
    description="API for ISP Settings - used to generate TypeScript/Zod schemas",
)


# Dummy endpoint to expose ISPSettings in the OpenAPI schema
@app.get("/isp-settings", response_model=ISPSettings)
def get_isp_settings():
    """Get ISP settings - exposes ISPSettings schema."""
    pass


@app.patch("/isp-settings", response_model=SettingsUpdateResponse)
def update_isp_settings(request: SettingsUpdateRequest):
    """Update ISP settings - exposes update request/response schemas."""
    pass


@app.patch("/isp-settings/{section}", response_model=SettingsUpdateResponse)
def update_isp_settings_section(section: str, request: SettingsSectionUpdateRequest):
    """Update ISP settings section - exposes section update schema."""
    pass


@app.post("/isp-settings/validate", response_model=SettingsValidationResponse)
def validate_isp_settings(request: SettingsValidationRequest):
    """Validate ISP settings - exposes validation schemas."""
    pass


@app.post("/isp-settings/import", response_model=SettingsUpdateResponse)
def import_isp_settings(request: SettingsImportRequest):
    """Import ISP settings - exposes import schema."""
    pass


if __name__ == "__main__":
    openapi_schema = get_openapi(
        title=app.title,
        version=app.version,
        description=app.description,
        routes=app.routes,
    )
    print(json.dumps(openapi_schema, indent=2))
