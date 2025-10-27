"""
Fiber Infrastructure Management Module.

Provides comprehensive fiber optic network infrastructure management including:
- Fiber cable tracking and management
- Splice point monitoring
- Distribution point capacity management
- Service area coverage tracking
- Health metrics and analytics
- OTDR test result tracking
- GeoJSON mapping and visualization utilities
"""

from dotmac.platform.fiber import geojson_utils
from dotmac.platform.fiber.models import (
    DistributionPoint,
    FiberCable,
    FiberHealthMetric,
    OTDRTestResult,
    ServiceArea,
    SplicePoint,
)
from dotmac.platform.fiber.service import FiberService

__all__ = [
    "FiberCable",
    "SplicePoint",
    "DistributionPoint",
    "ServiceArea",
    "FiberHealthMetric",
    "OTDRTestResult",
    "FiberService",
    "geojson_utils",
]
