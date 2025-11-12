"""
Geocoding Service using OpenStreetMap Nominatim

Provides address → coordinates conversion with caching and rate limiting.
"""

import asyncio
import hashlib
import logging
from datetime import datetime, timedelta
from typing import Any
from urllib.parse import urlencode

import aiohttp

logger = logging.getLogger(__name__)


class GeocodingCache:
    """
    Simple in-memory cache for geocoding results.

    Prevents redundant API calls for the same address.
    """

    def __init__(self, ttl_hours: int = 24):
        self.cache: dict[str, dict[str, Any]] = {}
        self.ttl = timedelta(hours=ttl_hours)

    def _get_cache_key(self, address: str) -> str:
        """Generate cache key from address."""
        # MD5 used for cache key generation, not security
        return hashlib.md5(address.lower().strip().encode(), usedforsecurity=False).hexdigest()

    def get(self, address: str) -> dict[str, Any] | None:
        """Get cached result if exists and not expired."""
        key = self._get_cache_key(address)
        cached = self.cache.get(key)

        if not cached:
            return None

        # Check expiry
        if datetime.utcnow() - cached["cached_at"] > self.ttl:
            del self.cache[key]
            return None

        return cached["result"]

    def set(self, address: str, result: dict[str, Any]) -> None:
        """Cache geocoding result."""
        key = self._get_cache_key(address)
        self.cache[key] = {
            "result": result,
            "cached_at": datetime.utcnow(),
        }

    def clear(self):
        """Clear all cached results."""
        self.cache.clear()


class RateLimiter:
    """
    Rate limiter to respect Nominatim's usage policy (1 request/second).
    """

    def __init__(self, requests_per_second: float = 1.0):
        self.min_interval = 1.0 / requests_per_second
        self.last_request = 0.0

    async def wait(self):
        """Wait if necessary to respect rate limit."""
        now = asyncio.get_event_loop().time()
        time_since_last = now - self.last_request

        if time_since_last < self.min_interval:
            wait_time = self.min_interval - time_since_last
            await asyncio.sleep(wait_time)

        self.last_request = asyncio.get_event_loop().time()


class GeocodingService:
    """
    Geocoding service using OpenStreetMap Nominatim.

    Features:
    - Address → coordinates conversion
    - Reverse geocoding (coordinates → address)
    - Automatic caching (24h TTL)
    - Rate limiting (1 req/sec)
    - Error handling with retries
    """

    NOMINATIM_URL = "https://nominatim.openstreetmap.org"
    USER_AGENT = "DotMac-FTTH-Platform/1.0"

    def __init__(self):
        self.cache = GeocodingCache(ttl_hours=24)
        self.rate_limiter = RateLimiter(requests_per_second=1.0)

    async def geocode(
        self,
        address: str,
        use_cache: bool = True,
        country_code: str | None = None,
    ) -> dict[str, float] | None:
        """
        Convert address to coordinates.

        Args:
            address: Full address string (e.g., "123 Main St, Lagos, Nigeria")
            use_cache: Whether to use cached results
            country_code: ISO 3166-1 alpha-2 country code (e.g., "NG" for Nigeria)

        Returns:
            Dictionary with "lat" and "lon" keys, or None if not found

        Example:
            result = await service.geocode("123 Main St, Lagos, Nigeria")
            # Returns: {"lat": 6.5244, "lon": 3.3792, "display_name": "..."}
        """
        if not address or not address.strip():
            logger.warning("Empty address provided for geocoding")
            return None

        # Check cache first
        if use_cache:
            cached = self.cache.get(address)
            if cached:
                logger.debug(f"Cache hit for address: {address[:50]}...")
                return cached

        # Respect rate limit
        await self.rate_limiter.wait()

        # Build request
        params = {
            "q": address.strip(),
            "format": "json",
            "limit": 1,
            "addressdetails": 1,
        }

        if country_code:
            params["countrycodes"] = country_code.upper()

        url = f"{self.NOMINATIM_URL}/search?{urlencode(params)}"
        headers = {"User-Agent": self.USER_AGENT}

        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    url,
                    headers=headers,
                    timeout=aiohttp.ClientTimeout(total=10),
                ) as response:
                    if response.status != 200:
                        logger.error(
                            f"Geocoding API error: {response.status} for address: {address[:50]}"
                        )
                        return None

                    data = await response.json()

                    if not data:
                        logger.warning(f"No results found for address: {address[:50]}")
                        return None

                    result = {
                        "lat": float(data[0]["lat"]),
                        "lon": float(data[0]["lon"]),
                        "display_name": data[0].get("display_name", ""),
                        "type": data[0].get("type", ""),
                        "importance": data[0].get("importance", 0),
                    }

                    # Cache result
                    if use_cache:
                        self.cache.set(address, result)

                    logger.info(
                        f"Geocoded address: {address[:50]}... → "
                        f"({result['lat']:.4f}, {result['lon']:.4f})"
                    )

                    return result

        except TimeoutError:
            logger.error(f"Geocoding request timed out for address: {address[:50]}")
            return None
        except Exception as e:
            logger.error(f"Geocoding error for address {address[:50]}: {e}")
            return None

    async def reverse_geocode(self, lat: float, lon: float, zoom: int = 18) -> str | None:
        """
        Convert coordinates to address (reverse geocoding).

        Args:
            lat: Latitude
            lon: Longitude
            zoom: Zoom level (3=country, 10=city, 18=building)

        Returns:
            Human-readable address string, or None if not found

        Example:
            address = await service.reverse_geocode(6.5244, 3.3792)
            # Returns: "123 Main Street, Lagos, Nigeria"
        """
        # Respect rate limit
        await self.rate_limiter.wait()

        params = {
            "lat": lat,
            "lon": lon,
            "format": "json",
            "zoom": zoom,
        }

        url = f"{self.NOMINATIM_URL}/reverse?{urlencode(params)}"
        headers = {"User-Agent": self.USER_AGENT}

        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    url,
                    headers=headers,
                    timeout=aiohttp.ClientTimeout(total=10),
                ) as response:
                    if response.status != 200:
                        logger.error(
                            f"Reverse geocoding API error: {response.status} "
                            f"for coordinates: ({lat}, {lon})"
                        )
                        return None

                    data = await response.json()

                    address = data.get("display_name")

                    if address:
                        logger.info(f"Reverse geocoded ({lat:.4f}, {lon:.4f}) → {address[:50]}...")

                    return address

        except TimeoutError:
            logger.error(f"Reverse geocoding request timed out for coordinates: ({lat}, {lon})")
            return None
        except Exception as e:
            logger.error(f"Reverse geocoding error for ({lat}, {lon}): {e}")
            return None

    async def geocode_with_fallback(
        self, address_parts: dict[str, str | None], country_code: str | None = None
    ) -> dict[str, float] | None:
        """
        Geocode using progressive address detail reduction.

        Tries full address first, then falls back to less specific addresses
        if the full address doesn't geocode.

        Args:
            address_parts: Dictionary with address components:
                - line1: Street address
                - line2: Apartment/unit
                - city: City
                - state: State/province
                - postal_code: Postal code
                - country: Country
            country_code: ISO 3166-1 alpha-2 code

        Returns:
            Geocoding result or None

        Example:
            result = await service.geocode_with_fallback({
                "line1": "123 Main St",
                "city": "Lagos",
                "state": "Lagos",
                "country": "Nigeria"
            })
        """
        # Try progressively less specific addresses
        attempts = []

        # Full address
        full_parts = [
            part
            for key in ("line1", "line2", "city", "state", "postal_code", "country")
            if (part := address_parts.get(key))
        ]

        if full_parts:
            attempts.append(", ".join(full_parts))

        # Fallback: Street + City + Country
        line1 = address_parts.get("line1")
        city = address_parts.get("city")
        country = address_parts.get("country")
        if line1 and city:
            fallback_parts = [line1, city]
            if country:
                fallback_parts.append(country)
            attempts.append(", ".join(fallback_parts))

        # Fallback: City + Country only
        if city:
            city_parts = [city]
            if country:
                city_parts.append(country)
            attempts.append(", ".join(city_parts))

        # Try each address variant
        for i, address in enumerate(attempts):
            logger.debug(f"Geocoding attempt {i + 1}/{len(attempts)}: {address}")
            result = await self.geocode(address, country_code=country_code)
            if result:
                return result

        logger.warning(f"All geocoding attempts failed for address parts: {address_parts}")
        return None

    def clear_cache(self):
        """Clear the geocoding cache."""
        self.cache.clear()
        logger.info("Geocoding cache cleared")


# Global singleton instance
geocoding_service = GeocodingService()
