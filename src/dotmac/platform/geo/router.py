"""
Geographic Services API Router

Provides geocoding and routing endpoints.
"""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from dotmac.platform.auth.models import User
from dotmac.platform.auth.rbac_dependencies import get_current_active_user
from dotmac.platform.geo.geocoding_service import geocoding_service
from dotmac.platform.geo.routing_service import routing_service

router = APIRouter(prefix="/geo", tags=["geographic-services"])


# Request/Response Models


class GeocodeRequest(BaseModel):
    """Request model for geocoding."""

    address: str = Field(..., description="Full address to geocode")
    country_code: str | None = Field(None, description="ISO 3166-1 alpha-2 country code")


class GeocodeResponse(BaseModel):
    """Response model for geocoding."""

    lat: float
    lon: float
    display_name: str
    type: str
    importance: float


class ReverseGeocodeResponse(BaseModel):
    """Response model for reverse geocoding."""

    address: str


class RouteRequest(BaseModel):
    """Request model for routing."""

    start_lat: float = Field(..., ge=-90, le=90)
    start_lon: float = Field(..., ge=-180, le=180)
    end_lat: float = Field(..., ge=-90, le=90)
    end_lon: float = Field(..., ge=-180, le=180)
    profile: str = Field("driving", description="Routing profile: driving, walking, cycling")
    steps: bool = Field(True, description="Include turn-by-turn instructions")


class RouteStep(BaseModel):
    """Turn-by-turn instruction."""

    instruction: str
    type: str
    distance_meters: float
    duration_seconds: float
    location: list[float]


class RouteResponse(BaseModel):
    """Response model for routing."""

    distance_meters: float
    duration_seconds: float
    distance_formatted: str
    duration_formatted: str
    geometry: dict
    steps: list[RouteStep]


class RouteSummaryResponse(BaseModel):
    """Response model for route summary."""

    distance_meters: float
    duration_seconds: float
    distance_formatted: str
    duration_formatted: str


# Geocoding Endpoints


@router.post("/geocode", response_model=GeocodeResponse)
async def geocode_address(
    request: GeocodeRequest,
    current_user: User = Depends(get_current_active_user),
) -> GeocodeResponse:
    """
    Convert address to coordinates (geocoding).

    Example:
        POST /api/v1/geo/geocode
        {
            "address": "123 Main St, Lagos, Nigeria",
            "country_code": "NG"
        }

        Returns:
        {
            "lat": 6.5244,
            "lon": 3.3792,
            "display_name": "123 Main Street, Lagos, Nigeria",
            "type": "residential",
            "importance": 0.5
        }
    """
    result = await geocoding_service.geocode(
        address=request.address,
        country_code=request.country_code,
    )

    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Address not found or geocoding failed"
        )

    return GeocodeResponse(**result)


@router.get("/reverse-geocode", response_model=ReverseGeocodeResponse)
async def reverse_geocode(
    lat: float = Query(..., ge=-90, le=90),
    lon: float = Query(..., ge=-180, le=180),
    current_user: User = Depends(get_current_active_user),
) -> ReverseGeocodeResponse:
    """
    Convert coordinates to address (reverse geocoding).

    Example:
        GET /api/v1/geo/reverse-geocode?lat=6.5244&lon=3.3792

        Returns:
        {
            "address": "123 Main Street, Lagos, Nigeria"
        }
    """
    address = await geocoding_service.reverse_geocode(lat=lat, lon=lon)

    if not address:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Address not found for coordinates"
        )

    return ReverseGeocodeResponse(address=address)


# Routing Endpoints


@router.post("/route", response_model=RouteResponse)
async def calculate_route(
    request: RouteRequest,
    current_user: User = Depends(get_current_active_user),
) -> RouteResponse:
    """
    Calculate route between two points with turn-by-turn directions.

    Use cases:
    - Direct technician to job site
    - Direct technician to fiber asset (splice point, closure, etc.)
    - Calculate travel time and distance

    Example:
        POST /api/v1/geo/route
        {
            "start_lat": 6.5244,
            "start_lon": 3.3792,
            "end_lat": 6.4281,
            "end_lon": 3.4219,
            "profile": "driving",
            "steps": true
        }

        Returns:
        {
            "distance_meters": 15342.5,
            "duration_seconds": 1834.2,
            "distance_formatted": "15.3 km",
            "duration_formatted": "31 min",
            "geometry": {...},  // GeoJSON LineString for map display
            "steps": [
                {
                    "instruction": "Turn right onto Main Street",
                    "type": "turn",
                    "distance_meters": 150,
                    "duration_seconds": 12,
                    "location": [3.3792, 6.5244]
                },
                ...
            ]
        }
    """
    route = await routing_service.get_route(
        start_lat=request.start_lat,
        start_lon=request.start_lon,
        end_lat=request.end_lat,
        end_lon=request.end_lon,
        profile=request.profile,
        steps=request.steps,
    )

    if not route:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Route not found or routing failed"
        )

    # Format distance and duration
    distance_m = route["distance_meters"]
    duration_s = route["duration_seconds"]

    if distance_m >= 1000:
        distance_formatted = f"{distance_m / 1000:.1f} km"
    else:
        distance_formatted = f"{int(distance_m)} m"

    duration_min = int(duration_s / 60)
    if duration_min >= 60:
        hours = duration_min // 60
        minutes = duration_min % 60
        duration_formatted = f"{hours}h {minutes}min"
    else:
        duration_formatted = f"{duration_min} min"

    return RouteResponse(
        distance_meters=distance_m,
        duration_seconds=duration_s,
        distance_formatted=distance_formatted,
        duration_formatted=duration_formatted,
        geometry=route["geometry"],
        steps=[RouteStep(**step) for step in route["steps"]],
    )


@router.get("/route-summary", response_model=RouteSummaryResponse)
async def get_route_summary(
    start_lat: float = Query(..., ge=-90, le=90),
    start_lon: float = Query(..., ge=-180, le=180),
    end_lat: float = Query(..., ge=-90, le=90),
    end_lon: float = Query(..., ge=-180, le=180),
    profile: str = Query("driving", description="Routing profile"),
    current_user: User = Depends(get_current_active_user),
) -> RouteSummaryResponse:
    """
    Get quick route summary (distance and duration only).

    Faster than full route calculation - use for displaying ETA.

    Example:
        GET /api/v1/geo/route-summary
          ?start_lat=6.5244&start_lon=3.3792
          &end_lat=6.4281&end_lon=3.4219

        Returns:
        {
            "distance_meters": 15342.5,
            "duration_seconds": 1834.2,
            "distance_formatted": "15.3 km",
            "duration_formatted": "31 min"
        }
    """
    summary = await routing_service.get_route_summary(
        start_lat=start_lat,
        start_lon=start_lon,
        end_lat=end_lat,
        end_lon=end_lon,
        profile=profile,
    )

    if not summary:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Route not found or routing failed"
        )

    return RouteSummaryResponse(**summary)


@router.get("/route-to-fiber-asset")
async def route_to_fiber_asset(
    technician_id: UUID,
    asset_type: str = Query(
        ..., description="splice_point, distribution_point, closure, cable, etc."
    ),
    asset_id: UUID = Query(..., description="Asset UUID"),
    profile: str = Query("driving", description="Routing profile"),
    current_user: User = Depends(get_current_active_user),
) -> RouteResponse:
    """
    Calculate route from technician's current location to a fiber asset.

    Supports routing to:
    - Splice points
    - Distribution points
    - Fiber closures
    - Cable segments
    - Any infrastructure with GPS coordinates

    Example:
        GET /api/v1/geo/route-to-fiber-asset
          ?technician_id=uuid
          &asset_type=splice_point
          &asset_id=uuid
          &profile=driving

        Returns route information with turn-by-turn directions.
    """

    # This would need proper dependency injection
    # For now, returning error - full implementation needs database access
    # You would:
    # 1. Get technician current location
    # 2. Get asset coordinates based on type
    # 3. Calculate route
    # 4. Return result

    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="This endpoint requires database integration. Use /route endpoint directly for now.",
    )
