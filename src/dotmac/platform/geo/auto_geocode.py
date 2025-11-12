"""
Auto-Geocoding Utilities

Automatically geocode addresses when customers or jobs are created/updated.
"""

import logging
from collections.abc import Mapping
from typing import Any

from dotmac.platform.geo.geocoding_service import geocoding_service

logger = logging.getLogger(__name__)


async def geocode_customer_address(
    customer_data: Mapping[str, Any], force: bool = False
) -> dict[str, float] | None:
    """
    Auto-geocode customer service address.

    Args:
        customer_data: Dictionary with customer address fields:
            - service_address_line1
            - service_address_line2
            - service_city
            - service_state_province
            - service_postal_code
            - service_country
            - service_coordinates (existing coordinates)
        force: Force re-geocode even if coordinates exist

    Returns:
        Dictionary with "lat" and "lon" keys, or None if geocoding failed

    Example:
        coords = await geocode_customer_address({
            "service_address_line1": "123 Main St",
            "service_city": "Lagos",
            "service_state_province": "Lagos",
            "service_country": "Nigeria",
            "service_coordinates": {}  # Empty, needs geocoding
        })
        # Returns: {"lat": 6.5244, "lon": 3.3792}
    """
    # Check if already geocoded
    existing_coords = customer_data.get("service_coordinates") or {}
    lat = existing_coords.get("lat")
    lon = existing_coords.get("lon")
    if lat is not None and lon is not None and not force:
        logger.debug("Customer already has coordinates, skipping geocoding")
        return {"lat": float(lat), "lon": float(lon)}

    # Build address parts
    address_parts = {
        "line1": customer_data.get("service_address_line1"),
        "line2": customer_data.get("service_address_line2"),
        "city": customer_data.get("service_city"),
        "state": customer_data.get("service_state_province"),
        "postal_code": customer_data.get("service_postal_code"),
        "country": customer_data.get("service_country"),
    }

    # Check if we have enough address information
    if not address_parts.get("line1") and not address_parts.get("city"):
        logger.warning("Insufficient address information for geocoding")
        return None

    # Extract country code (2-letter ISO)
    country_code = None
    country = address_parts.get("country")
    if isinstance(country, str) and len(country) == 2:
        country_code = country

    # Try geocoding with fallback
    result = await geocoding_service.geocode_with_fallback(
        address_parts=address_parts,
        country_code=country_code,
    )

    if result:
        logger.info(
            f"Geocoded customer address: "
            f"{address_parts.get('line1', '')}, {address_parts.get('city', '')} → "
            f"({result['lat']:.4f}, {result['lon']:.4f})"
        )
        return {"lat": result["lat"], "lon": result["lon"]}
    else:
        logger.warning(f"Failed to geocode customer address: {address_parts}")
        return None


async def geocode_job_location(
    job_data: Mapping[str, Any],
    customer_coords: dict[str, float] | None = None,
    force: bool = False,
) -> dict[str, float] | None:
    """
    Auto-geocode job location.

    Strategy:
    1. If job has explicit address, geocode it
    2. If job has coordinates already, use them
    3. If job is linked to customer, use customer's service coordinates
    4. Otherwise, fail

    Args:
        job_data: Dictionary with job location fields:
            - service_address (optional explicit address)
            - location_lat (existing latitude)
            - location_lng (existing longitude)
        customer_coords: Customer's service coordinates (fallback)
        force: Force re-geocode even if coordinates exist

    Returns:
        Dictionary with "lat" and "lon" keys, or None

    Example:
        # Job with address
        coords = await geocode_job_location({
            "service_address": "456 Oak St, Lagos, Nigeria",
            "location_lat": None,
            "location_lng": None
        })

        # Job using customer location
        coords = await geocode_job_location(
            job_data={"location_lat": None, "location_lng": None},
            customer_coords={"lat": 6.5244, "lon": 3.3792}
        )
    """
    # Check if already has coordinates
    lat = job_data.get("location_lat")
    lng = job_data.get("location_lng")
    if lat is not None and lng is not None and not force:
        logger.debug("Job already has coordinates, skipping geocoding")
        return {"lat": float(lat), "lon": float(lng)}

    # Try explicit address first
    service_address = job_data.get("service_address")
    if service_address and service_address.strip():
        result = await geocoding_service.geocode(address=service_address)
        if result:
            logger.info(
                f"Geocoded job address: {service_address[:50]}... → "
                f"({result['lat']:.4f}, {result['lon']:.4f})"
            )
            return {"lat": result["lat"], "lon": result["lon"]}

    # Fallback to customer coordinates
    if (
        customer_coords
        and customer_coords.get("lat") is not None
        and customer_coords.get("lon") is not None
    ):
        logger.info("Using customer coordinates for job location")
        return {"lat": customer_coords["lat"], "lon": customer_coords["lon"]}

    logger.warning("Failed to geocode job location (no address or customer coords)")
    return None


def should_geocode_customer(
    old_data: Mapping[str, Any] | None = None, new_data: Mapping[str, Any] | None = None
) -> bool:
    """
    Determine if customer address should be re-geocoded.

    Re-geocode if:
    - Creating new customer (old_data is None)
    - Address fields changed
    - Coordinates are missing

    Args:
        old_data: Original customer data (None for new customer)
        new_data: Updated customer data

    Returns:
        True if should geocode, False otherwise
    """
    if not new_data:
        return False

    # New customer - always geocode
    if not old_data:
        return True

    # Check if coordinates are missing
    coords = new_data.get("service_coordinates", {})
    if not coords.get("lat") or not coords.get("lon"):
        return True

    # Check if address changed
    address_fields = [
        "service_address_line1",
        "service_address_line2",
        "service_city",
        "service_state_province",
        "service_postal_code",
        "service_country",
    ]

    for field in address_fields:
        if old_data.get(field) != new_data.get(field):
            logger.debug(f"Address field changed: {field}")
            return True

    return False


def should_geocode_job(
    old_data: Mapping[str, Any] | None = None, new_data: Mapping[str, Any] | None = None
) -> bool:
    """
    Determine if job location should be re-geocoded.

    Re-geocode if:
    - Creating new job (old_data is None)
    - Location address changed
    - Coordinates are missing

    Args:
        old_data: Original job data (None for new job)
        new_data: Updated job data

    Returns:
        True if should geocode, False otherwise
    """
    if not new_data:
        return False

    # New job - always geocode
    if not old_data:
        return True

    # Check if coordinates are missing
    if not new_data.get("location_lat") or not new_data.get("location_lng"):
        return True

    # Check if service address changed
    if old_data.get("service_address") != new_data.get("service_address"):
        logger.debug("Job service address changed")
        return True

    return False
