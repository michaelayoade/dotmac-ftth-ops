"""
Routing Service using OSRM (Open Source Routing Machine)

Provides turn-by-turn directions for technicians to reach any location:
- Customer sites
- Job locations
- Fiber infrastructure (splice points, distribution points, closures, etc.)
"""

import logging
from typing import Any

import aiohttp

logger = logging.getLogger(__name__)


class RoutingService:
    """
    Routing service using OSRM for turn-by-turn directions.

    Features:
    - Calculate route between two points
    - Get distance and duration
    - Turn-by-turn instructions
    - Route geometry (for map display)
    - Optimized for driving (can support walking, cycling)
    """

    OSRM_URL = "https://router.project-osrm.org"

    async def get_route(
        self,
        start_lat: float,
        start_lon: float,
        end_lat: float,
        end_lon: float,
        profile: str = "driving",
        alternatives: bool = False,
        steps: bool = True,
        geometries: str = "geojson",
    ) -> dict | None:
        """
        Calculate route from start to end point.

        Args:
            start_lat: Starting latitude
            start_lon: Starting longitude
            end_lat: Destination latitude
            end_lon: Destination longitude
            profile: Routing profile ("driving", "walking", "cycling")
            alternatives: Whether to return alternative routes
            steps: Whether to include turn-by-turn instructions
            geometries: Geometry format ("geojson", "polyline", "polyline6")

        Returns:
            Route information or None if routing failed

        Example:
            route = await service.get_route(
                start_lat=6.5244, start_lon=3.3792,  # Technician current location
                end_lat=6.4281, end_lon=3.4219,      # Job site
            )

            # Returns:
            {
                "distance_meters": 15342.5,
                "duration_seconds": 1834.2,
                "geometry": {...},  # GeoJSON LineString
                "steps": [...]      # Turn-by-turn instructions
            }
        """
        # Build coordinates string: lon,lat;lon,lat (note: lon first!)
        coordinates = f"{start_lon},{start_lat};{end_lon},{end_lat}"

        # Build request URL
        url = f"{self.OSRM_URL}/route/v1/{profile}/{coordinates}"

        params = {
            "overview": "full",
            "geometries": geometries,
            "steps": "true" if steps else "false",
            "alternatives": "true" if alternatives else "false",
        }

        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    url,
                    params=params,
                    timeout=aiohttp.ClientTimeout(total=15),
                ) as response:
                    if response.status != 200:
                        logger.error(
                            f"OSRM routing error: {response.status} for route "
                            f"({start_lat},{start_lon}) → ({end_lat},{end_lon})"
                        )
                        return None

                    data = await response.json()

                    if data.get("code") != "Ok":
                        logger.warning(
                            f"OSRM routing failed: {data.get('message')} for route "
                            f"({start_lat},{start_lon}) → ({end_lat},{end_lon})"
                        )
                        return None

                    routes = data.get("routes", [])
                    if not routes:
                        logger.warning("No routes found")
                        return None

                    # Get primary route
                    route = routes[0]

                    # Extract turn-by-turn steps
                    step_details: list[dict[str, Any]] = []
                    if steps and route.get("legs"):
                        for leg in route["legs"]:
                            for step in leg.get("steps", []):
                                step_details.append(
                                    {
                                        "instruction": step.get("maneuver", {}).get(
                                            "instruction", ""
                                        ),
                                        "type": step.get("maneuver", {}).get("type", ""),
                                        "distance_meters": step.get("distance", 0),
                                        "duration_seconds": step.get("duration", 0),
                                        "location": step.get("maneuver", {}).get("location", []),
                                    }
                                )

                    result = {
                        "distance_meters": route.get("distance", 0),
                        "duration_seconds": route.get("duration", 0),
                        "geometry": route.get("geometry", {}),
                        "steps": step_details,
                        "waypoints": data.get("waypoints", []),
                    }

                    logger.info(
                        f"Route calculated: {result['distance_meters'] / 1000:.1f}km, "
                        f"{result['duration_seconds'] / 60:.0f}min"
                    )

                    return result

        except TimeoutError:
            logger.error("OSRM routing request timed out")
            return None
        except Exception as e:
            logger.error(f"OSRM routing error: {e}")
            return None

    async def get_route_summary(
        self,
        start_lat: float,
        start_lon: float,
        end_lat: float,
        end_lon: float,
        profile: str = "driving",
    ) -> dict[str, float] | None:
        """
        Get quick route summary (distance and duration only).

        Faster than full route calculation - use for displaying ETA.

        Args:
            start_lat: Starting latitude
            start_lon: Starting longitude
            end_lat: Destination latitude
            end_lon: Destination longitude
            profile: Routing profile

        Returns:
            Dictionary with distance_meters, duration_seconds, duration_formatted

        Example:
            summary = await service.get_route_summary(
                start_lat=6.5244, start_lon=3.3792,
                end_lat=6.4281, end_lon=3.4219
            )
            # Returns: {
            #     "distance_meters": 15342.5,
            #     "duration_seconds": 1834.2,
            #     "duration_formatted": "31 min",
            #     "distance_formatted": "15.3 km"
            # }
        """
        route = await self.get_route(
            start_lat=start_lat,
            start_lon=start_lon,
            end_lat=end_lat,
            end_lon=end_lon,
            profile=profile,
            steps=False,  # Don't need turn-by-turn for summary
            geometries="polyline",  # Smaller response
        )

        if not route:
            return None

        distance_m = route["distance_meters"]
        duration_s = route["duration_seconds"]

        # Format distance
        if distance_m >= 1000:
            distance_formatted = f"{distance_m / 1000:.1f} km"
        else:
            distance_formatted = f"{int(distance_m)} m"

        # Format duration
        duration_min = int(duration_s / 60)
        if duration_min >= 60:
            hours = duration_min // 60
            minutes = duration_min % 60
            duration_formatted = f"{hours}h {minutes}min"
        else:
            duration_formatted = f"{duration_min} min"

        return {
            "distance_meters": distance_m,
            "duration_seconds": duration_s,
            "distance_formatted": distance_formatted,
            "duration_formatted": duration_formatted,
        }

    async def get_distance_matrix(
        self,
        sources: list[tuple[float, float]],
        destinations: list[tuple[float, float]],
        profile: str = "driving",
    ) -> dict | None:
        """
        Calculate distances and durations between multiple points.

        Useful for:
        - Finding nearest technician to a job
        - Optimizing multi-stop routes
        - Calculating travel time matrices

        Args:
            sources: List of (lat, lon) tuples for origins
            destinations: List of (lat, lon) tuples for destinations
            profile: Routing profile

        Returns:
            Distance/duration matrix

        Example:
            # Find nearest technician to job site
            technicians = [(6.5244, 3.3792), (6.4281, 3.4219)]
            job_sites = [(6.5000, 3.4000)]

            matrix = await service.get_distance_matrix(
                sources=technicians,
                destinations=job_sites
            )

            # matrix["durations"][0][0] = time from tech 1 to job 1
            # matrix["durations"][1][0] = time from tech 2 to job 1
        """
        # Build coordinates string
        all_coords = sources + destinations
        coords_str = ";".join([f"{lon},{lat}" for lat, lon in all_coords])

        # Build source and destination indices
        source_indices = ";".join([str(i) for i in range(len(sources))])
        dest_indices = ";".join([str(i + len(sources)) for i in range(len(destinations))])

        url = f"{self.OSRM_URL}/table/v1/{profile}/{coords_str}"
        params = {
            "sources": source_indices,
            "destinations": dest_indices,
        }

        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    url,
                    params=params,
                    timeout=aiohttp.ClientTimeout(total=15),
                ) as response:
                    if response.status != 200:
                        logger.error(f"OSRM distance matrix error: {response.status}")
                        return None

                    data = await response.json()

                    if data.get("code") != "Ok":
                        logger.warning(f"OSRM distance matrix failed: {data.get('message')}")
                        return None

                    return {
                        "durations": data.get("durations", []),
                        "distances": data.get("distances", []),
                    }

        except TimeoutError:
            logger.error("OSRM distance matrix request timed out")
            return None
        except Exception as e:
            logger.error(f"OSRM distance matrix error: {e}")
            return None

    async def find_nearest_point(
        self,
        origin: tuple[float, float],
        destinations: list[tuple[float, float]],
        profile: str = "driving",
    ) -> tuple[int, float, float] | None:
        """
        Find the nearest destination point from origin.

        Args:
            origin: (lat, lon) of starting point
            destinations: List of (lat, lon) tuples
            profile: Routing profile

        Returns:
            Tuple of (index, distance_meters, duration_seconds) or None

        Example:
            # Find nearest technician to job site
            job_location = (6.5244, 3.3792)
            technician_locations = [
                (6.5000, 3.4000),  # Tech 1
                (6.4281, 3.4219),  # Tech 2
                (6.6000, 3.3500),  # Tech 3
            ]

            nearest = await service.find_nearest_point(
                origin=job_location,
                destinations=technician_locations
            )
            # Returns: (1, 12500.0, 950.0)  # Tech 2 is nearest
        """
        if not destinations:
            return None

        matrix = await self.get_distance_matrix(
            sources=[origin],
            destinations=destinations,
            profile=profile,
        )

        if not matrix or not matrix.get("durations"):
            return None

        durations = matrix["durations"][0]  # First (and only) source
        distances = matrix.get("distances", [[]])[0]

        # Find minimum duration
        min_idx = min(range(len(durations)), key=lambda i: durations[i] or float("inf"))
        min_duration = durations[min_idx]
        min_distance = distances[min_idx] if distances else 0

        if min_duration is None:
            return None

        logger.info(
            f"Nearest point: index={min_idx}, distance={min_distance / 1000:.1f}km, "
            f"duration={min_duration / 60:.0f}min"
        )

        return (min_idx, min_distance, min_duration)


# Global singleton instance
routing_service = RoutingService()
