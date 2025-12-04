"""
GeoJSON Mapping Utilities for Fiber Infrastructure.

Provides helper functions for working with GeoJSON data in fiber infrastructure:
- Cable route mapping and visualization
- Distribution point location mapping
- Service area coverage polygon generation
- Network topology visualization
"""

from typing import Any

from dotmac.platform.fiber.models import (
    DistributionPoint,
    FiberCable,
    ServiceArea,
    SplicePoint,
)

# ============================================================================
# Point Generation
# ============================================================================


def create_point(
    longitude: float, latitude: float, altitude: float | None = None
) -> dict[str, Any]:
    """
    Create a GeoJSON Point geometry.

    Args:
        longitude: Longitude coordinate (-180 to 180)
        latitude: Latitude coordinate (-90 to 90)
        altitude: Optional altitude in meters

    Returns:
        GeoJSON Point geometry

    Example:
        >>> point = create_point(-122.4194, 37.7749)
        >>> point
        {"type": "Point", "coordinates": [-122.4194, 37.7749]}
    """
    coordinates = [longitude, latitude]
    if altitude is not None:
        coordinates.append(altitude)

    return {
        "type": "Point",
        "coordinates": coordinates,
    }


def create_feature_point(
    longitude: float,
    latitude: float,
    properties: dict[str, Any] | None = None,
    altitude: float | None = None,
) -> dict[str, Any]:
    """
    Create a GeoJSON Feature with Point geometry.

    Args:
        longitude: Longitude coordinate
        latitude: Latitude coordinate
        properties: Optional feature properties (metadata)
        altitude: Optional altitude in meters

    Returns:
        GeoJSON Feature with Point geometry

    Example:
        >>> feature = create_feature_point(
        ...     -122.4194, 37.7749,
        ...     properties={"name": "Distribution Point 1", "type": "FDH"}
        ... )
    """
    return {
        "type": "Feature",
        "geometry": create_point(longitude, latitude, altitude),
        "properties": properties or {},
    }


# ============================================================================
# LineString Generation (Cable Routes)
# ============================================================================


def create_linestring(coordinates: list[list[float]]) -> dict[str, Any]:
    """
    Create a GeoJSON LineString geometry for cable routes.

    Args:
        coordinates: List of [longitude, latitude] or [longitude, latitude, altitude] pairs

    Returns:
        GeoJSON LineString geometry

    Example:
        >>> route = create_linestring([
        ...     [-122.4194, 37.7749],
        ...     [-122.4184, 37.7739],
        ...     [-122.4174, 37.7729]
        ... ])
    """
    return {
        "type": "LineString",
        "coordinates": coordinates,
    }


def create_feature_linestring(
    coordinates: list[list[float]],
    properties: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """
    Create a GeoJSON Feature with LineString geometry.

    Args:
        coordinates: List of coordinate pairs for the line
        properties: Optional feature properties

    Returns:
        GeoJSON Feature with LineString geometry
    """
    return {
        "type": "Feature",
        "geometry": create_linestring(coordinates),
        "properties": properties or {},
    }


# ============================================================================
# Polygon Generation (Service Areas)
# ============================================================================


def create_polygon(coordinates: list[list[list[float]]]) -> dict[str, Any]:
    """
    Create a GeoJSON Polygon geometry for service area coverage.

    Args:
        coordinates: List of linear rings (first is exterior, rest are holes)
                    Each ring is a list of [longitude, latitude] pairs
                    First and last coordinate must be identical (closed ring)

    Returns:
        GeoJSON Polygon geometry

    Example:
        >>> coverage = create_polygon([[
        ...     [-122.4194, 37.7749],
        ...     [-122.4184, 37.7749],
        ...     [-122.4184, 37.7739],
        ...     [-122.4194, 37.7739],
        ...     [-122.4194, 37.7749]  # Close the ring
        ... ]])
    """
    return {
        "type": "Polygon",
        "coordinates": coordinates,
    }


def create_feature_polygon(
    coordinates: list[list[list[float]]],
    properties: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """
    Create a GeoJSON Feature with Polygon geometry.

    Args:
        coordinates: Polygon coordinate rings
        properties: Optional feature properties

    Returns:
        GeoJSON Feature with Polygon geometry
    """
    return {
        "type": "Feature",
        "geometry": create_polygon(coordinates),
        "properties": properties or {},
    }


# ============================================================================
# FeatureCollection Generation
# ============================================================================


def create_feature_collection(features: list[dict[str, Any]]) -> dict[str, Any]:
    """
    Create a GeoJSON FeatureCollection from a list of features.

    Args:
        features: List of GeoJSON Feature objects

    Returns:
        GeoJSON FeatureCollection

    Example:
        >>> features = [
        ...     create_feature_point(-122.4194, 37.7749, {"name": "Point 1"}),
        ...     create_feature_point(-122.4184, 37.7739, {"name": "Point 2"}),
        ... ]
        >>> collection = create_feature_collection(features)
    """
    return {
        "type": "FeatureCollection",
        "features": features,
    }


# ============================================================================
# Model-to-GeoJSON Mappers
# ============================================================================


def fiber_cable_to_feature(cable: FiberCable) -> dict[str, Any]:
    """
    Convert a FiberCable model to a GeoJSON Feature.

    Args:
        cable: FiberCable model instance

    Returns:
        GeoJSON Feature representing the cable route

    Example:
        >>> from dotmac.platform.fiber.models import FiberCable
        >>> cable = FiberCable(...)  # With route_geojson set
        >>> feature = fiber_cable_to_feature(cable)
    """
    # If route is already GeoJSON, use it; otherwise create a simple geometry
    geometry = cable.route_geojson if cable.route_geojson else None

    properties = {
        "id": str(cable.id),
        "cable_id": cable.cable_id,
        "name": cable.name,
        "fiber_type": cable.fiber_type.value,
        "fiber_count": cable.fiber_count,
        "status": cable.status.value,
        "installation_type": cable.installation_type.value if cable.installation_type else None,
        "length_km": float(cable.length_km) if cable.length_km else None,
        "manufacturer": cable.manufacturer,
        "model": cable.model,
        "attenuation_db_per_km": (
            float(cable.attenuation_db_per_km) if cable.attenuation_db_per_km else None
        ),
        "max_capacity": cable.max_capacity,
        "start_site_id": cable.start_site_id,
        "end_site_id": cable.end_site_id,
    }

    return {
        "type": "Feature",
        "geometry": geometry,
        "properties": properties,
    }


def distribution_point_to_feature(point: DistributionPoint) -> dict[str, Any]:
    """
    Convert a DistributionPoint model to a GeoJSON Feature.

    Args:
        point: DistributionPoint model instance

    Returns:
        GeoJSON Feature representing the distribution point location

    Example:
        >>> from dotmac.platform.fiber.models import DistributionPoint
        >>> dp = DistributionPoint(...)  # With location_geojson set
        >>> feature = distribution_point_to_feature(dp)
    """
    # If location is already GeoJSON, use it
    geometry = point.location_geojson if point.location_geojson else None

    properties = {
        "id": str(point.id),
        "point_id": point.point_id,
        "point_type": point.point_type.value,
        "name": point.name,
        "status": point.status.value,
        "site_id": point.site_id,
        "address": point.address,
        "total_ports": point.total_ports,
        "used_ports": point.used_ports,
        "available_ports": (point.total_ports - point.used_ports) if point.total_ports else None,
        "utilization_percentage": (
            (point.used_ports / point.total_ports * 100)
            if point.total_ports and point.total_ports > 0
            else 0
        ),
        "manufacturer": point.manufacturer,
        "model": point.model,
    }

    return {
        "type": "Feature",
        "geometry": geometry,
        "properties": properties,
    }


def splice_point_to_feature(splice: SplicePoint) -> dict[str, Any]:
    """
    Convert a SplicePoint model to a GeoJSON Feature.

    Args:
        splice: SplicePoint model instance

    Returns:
        GeoJSON Feature representing the splice point location
    """
    geometry = splice.location_geojson if splice.location_geojson else None

    properties = {
        "id": str(splice.id),
        "splice_id": splice.splice_id,
        "cable_id": str(splice.cable_id),
        "distribution_point_id": (
            str(splice.distribution_point_id) if splice.distribution_point_id else None
        ),
        "status": splice.status.value,
        "splice_type": splice.splice_type,
        "enclosure_type": splice.enclosure_type,
        "insertion_loss_db": float(splice.insertion_loss_db) if splice.insertion_loss_db else None,
        "return_loss_db": float(splice.return_loss_db) if splice.return_loss_db else None,
    }

    return {
        "type": "Feature",
        "geometry": geometry,
        "properties": properties,
    }


def service_area_to_feature(area: ServiceArea) -> dict[str, Any]:
    """
    Convert a ServiceArea model to a GeoJSON Feature.

    Args:
        area: ServiceArea model instance

    Returns:
        GeoJSON Feature representing the service area coverage polygon
    """
    geometry = area.coverage_geojson if area.coverage_geojson else None

    residential_penetration = (
        (area.homes_connected / area.homes_passed * 100) if area.homes_passed > 0 else 0
    )
    commercial_penetration = (
        (area.businesses_connected / area.businesses_passed * 100)
        if area.businesses_passed > 0
        else 0
    )

    properties = {
        "id": str(area.id),
        "area_id": area.area_id,
        "name": area.name,
        "area_type": area.area_type.value,
        "is_serviceable": area.is_serviceable,
        "postal_codes": area.postal_codes,
        "construction_status": area.construction_status,
        "go_live_date": area.go_live_date.isoformat() if area.go_live_date else None,
        "homes_passed": area.homes_passed,
        "homes_connected": area.homes_connected,
        "businesses_passed": area.businesses_passed,
        "businesses_connected": area.businesses_connected,
        "residential_penetration_pct": round(residential_penetration, 2),
        "commercial_penetration_pct": round(commercial_penetration, 2),
    }

    return {
        "type": "Feature",
        "geometry": geometry,
        "properties": properties,
    }


# ============================================================================
# Network Topology Visualization
# ============================================================================


def create_network_topology_collection(
    cables: list[FiberCable],
    distribution_points: list[DistributionPoint],
    splice_points: list[SplicePoint] | None = None,
) -> dict[str, Any]:
    """
    Create a comprehensive GeoJSON FeatureCollection for network topology visualization.

    Args:
        cables: List of fiber cables
        distribution_points: List of distribution points
        splice_points: Optional list of splice points

    Returns:
        GeoJSON FeatureCollection with all network elements

    Example:
        >>> topology = create_network_topology_collection(
        ...     cables=[cable1, cable2],
        ...     distribution_points=[dp1, dp2],
        ...     splice_points=[splice1, splice2]
        ... )
        >>> # Can be directly used in mapping libraries like Leaflet, Mapbox, etc.
    """
    features = []

    # Add cable routes (LineStrings)
    for cable in cables:
        feature = fiber_cable_to_feature(cable)
        if feature["geometry"]:  # Only add if geometry exists
            feature["properties"]["layer"] = "cables"
            features.append(feature)

    # Add distribution points (Points)
    for point in distribution_points:
        feature = distribution_point_to_feature(point)
        if feature["geometry"]:
            feature["properties"]["layer"] = "distribution_points"
            features.append(feature)

    # Add splice points (Points)
    if splice_points:
        for splice in splice_points:
            feature = splice_point_to_feature(splice)
            if feature["geometry"]:
                feature["properties"]["layer"] = "splice_points"
                features.append(feature)

    return create_feature_collection(features)


def create_service_coverage_collection(service_areas: list[ServiceArea]) -> dict[str, Any]:
    """
    Create a GeoJSON FeatureCollection for service area coverage visualization.

    Args:
        service_areas: List of service areas

    Returns:
        GeoJSON FeatureCollection with coverage polygons

    Example:
        >>> coverage = create_service_coverage_collection([area1, area2, area3])
        >>> # Visualize coverage areas with color-coding by penetration rate
    """
    features = []

    for area in service_areas:
        feature = service_area_to_feature(area)
        if feature["geometry"]:
            # Add color hints for visualization
            residential_pct = feature["properties"]["residential_penetration_pct"]
            if residential_pct >= 80:
                feature["properties"]["coverage_color"] = "#00FF00"  # Green - High penetration
            elif residential_pct >= 50:
                feature["properties"]["coverage_color"] = "#FFFF00"  # Yellow - Medium penetration
            elif residential_pct >= 20:
                feature["properties"]["coverage_color"] = "#FFA500"  # Orange - Low penetration
            else:
                feature["properties"]["coverage_color"] = "#FF0000"  # Red - Very low penetration

            features.append(feature)

    return create_feature_collection(features)


# ============================================================================
# Utility Functions
# ============================================================================


def calculate_linestring_length(coordinates: list[list[float]]) -> float:
    """
    Calculate approximate length of a LineString in kilometers using Haversine formula.

    Args:
        coordinates: List of [longitude, latitude] pairs

    Returns:
        Approximate length in kilometers

    Note:
        This is an approximation. For precise calculations, use a proper GIS library.
    """
    import math

    def haversine(lon1: float, lat1: float, lon2: float, lat2: float) -> float:
        """Calculate great-circle distance between two points."""
        R = 6371  # Earth radius in kilometers

        lat1, lon1, lat2, lon2 = map(math.radians, [lat1, lon1, lat2, lon2])
        dlat = lat2 - lat1
        dlon = lon2 - lon1

        a = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
        c = 2 * math.asin(math.sqrt(a))

        return R * c

    total_length = 0.0
    for i in range(len(coordinates) - 1):
        lon1, lat1 = coordinates[i][:2]
        lon2, lat2 = coordinates[i + 1][:2]
        total_length += haversine(lon1, lat1, lon2, lat2)

    return total_length


def validate_geojson_geometry(geojson: dict[str, Any]) -> tuple[bool, str | None]:
    """
    Validate a GeoJSON geometry object.

    Args:
        geojson: GeoJSON geometry object to validate

    Returns:
        Tuple of (is_valid, error_message)

    Example:
        >>> is_valid, error = validate_geojson_geometry({"type": "Point", "coordinates": [-122.4, 37.7]})
        >>> if not is_valid:
        ...     print(f"Invalid GeoJSON: {error}")
    """
    if not isinstance(geojson, dict):
        return False, "GeoJSON must be a dictionary"

    if "type" not in geojson:
        return False, "GeoJSON must have a 'type' field"

    geom_type = geojson["type"]
    valid_types = [
        "Point",
        "LineString",
        "Polygon",
        "MultiPoint",
        "MultiLineString",
        "MultiPolygon",
    ]

    if geom_type not in valid_types:
        return False, f"Invalid geometry type: {geom_type}"

    if "coordinates" not in geojson:
        return False, "GeoJSON must have a 'coordinates' field"

    coordinates = geojson["coordinates"]

    # Basic validation for each type
    if geom_type == "Point":
        if not isinstance(coordinates, list) or len(coordinates) < 2:
            return (
                False,
                "Point coordinates must be [longitude, latitude] or [longitude, latitude, altitude]",
            )

    elif geom_type == "LineString":
        if not isinstance(coordinates, list) or len(coordinates) < 2:
            return False, "LineString must have at least 2 coordinate pairs"

    elif geom_type == "Polygon":
        if not isinstance(coordinates, list) or len(coordinates) < 1:
            return False, "Polygon must have at least one ring"
        for ring in coordinates:
            if not isinstance(ring, list) or len(ring) < 4:
                return False, "Polygon ring must have at least 4 coordinate pairs"
            # Check if ring is closed (first and last coordinates are the same)
            if ring[0] != ring[-1]:
                return (
                    False,
                    "Polygon ring must be closed (first and last coordinates must be identical)",
                )

    return True, None
